/**
 * CHARACTEROS_VOICE_RUNTIME_CLIENT_V0 — the process boundary between
 * CharacterOS and the local speech runtime.
 *
 * The speech models are Python. They run in a SEPARATE process (a local HTTP
 * server on 127.0.0.1) so that a model crash, a CUDA OOM, or a hung generation
 * can never take down a CharacterOS session. This client owns:
 *
 *   - the wire contract (JSON over localhost HTTP),
 *   - failure CLASSIFICATION (unavailable / timeout / rejected / malformed),
 *   - cancellation.
 *
 * Every failure becomes a typed `VoiceFailureV0`. Nothing here throws a raw
 * network error upward, and nothing here touches canonical state — a dead voice
 * runtime leaves the text product fully functional.
 *
 * Deliberately plain: `fetch` plus `AbortSignal`. No broker, no gRPC, no
 * message queue. This is one local process talking to another.
 */

import { VoiceFailureV0, type VoiceProfileV0 } from "./contracts.js";

export const VOICE_RUNTIME_DEFAULT_BASE_URL_V0 = "http://127.0.0.1:8181" as const;
export const VOICE_RUNTIME_HEALTH_PATH_V0 = "/health" as const;
export const VOICE_RUNTIME_TTS_PATH_V0 = "/tts" as const;
export const VOICE_RUNTIME_TTS_STREAM_PATH_V0 = "/tts/stream" as const;
export const VOICE_RUNTIME_TTS_CANCEL_PATH_V0 = "/tts/cancel" as const;
export const VOICE_RUNTIME_ASR_PATH_V0 = "/asr" as const;
export const VOICE_RUNTIME_ASR_LISTEN_PATH_V0 = "/asr/listen" as const;
export const VOICE_RUNTIME_VOICES_PATH_V0 = "/voices" as const;

// ----------------------------------------------------------------------------------
// §1 Configuration
// ----------------------------------------------------------------------------------

export interface VoiceRuntimeConfigV0 {
  readonly base_url: string;
  /** Liveness/health budget. */
  readonly health_timeout_ms: number;
  /** Cold synthesis may load a model, so this is generous by default. */
  readonly tts_timeout_ms: number;
  readonly asr_timeout_ms: number;
  /** Upper bound for one microphone capture, including VAD trailing silence. */
  readonly listen_timeout_ms: number;
}

export const DEFAULT_VOICE_RUNTIME_CONFIG_V0: VoiceRuntimeConfigV0 = {
  base_url: VOICE_RUNTIME_DEFAULT_BASE_URL_V0,
  health_timeout_ms: 5_000,
  tts_timeout_ms: 180_000,
  asr_timeout_ms: 60_000,
  listen_timeout_ms: 30_000
};

// ----------------------------------------------------------------------------------
// §2 Health and model status
// ----------------------------------------------------------------------------------

export interface VoiceModelStatusV0 {
  readonly loaded: boolean;
  readonly model_id: string;
  readonly device: string;
  readonly load_ms: number | null;
  /** Why the model is unavailable, when it is. */
  readonly error: string | null;
}

export interface VoiceVramStatusV0 {
  readonly total_mb: number;
  readonly used_mb: number;
  readonly peak_mb: number;
}

/**
 * Whole-runtime lifecycle, as reported by the service.
 *
 * `LOADING`  models are still coming up; speech requests may be refused.
 * `READY`    both recognition and synthesis are usable.
 * `DEGRADED` exactly one of them is usable — the runtime stays partly useful.
 * `FAILED`   neither is usable; CharacterOS falls back to text.
 */
export type VoiceRuntimeStateV0 = "LOADING" | "READY" | "DEGRADED" | "FAILED";

export interface VoiceRuntimeHealthV0 {
  readonly status: "ok";
  readonly state: VoiceRuntimeStateV0;
  readonly device: string;
  readonly fp16: boolean;
  readonly uptime_ms: number;
  readonly asr: VoiceModelStatusV0;
  readonly tts: VoiceModelStatusV0;
  readonly vram: VoiceVramStatusV0 | null;
}

// ----------------------------------------------------------------------------------
// §3 Request/response bodies
// ----------------------------------------------------------------------------------

export interface TtsRuntimeRequestV0 {
  readonly text: string;
  readonly voice_id: string;
  /**
   * Model-side delivery directive. Built from `SpeechExpressionV0` by the TTS
   * adapter — the runtime never derives style from CharacterOS state itself.
   */
  readonly instruct: string | null;
  /** Play through the host speaker on the runtime side. */
  readonly play: boolean;
  /** Synthesize incrementally (streaming) instead of in one pass. */
  readonly stream: boolean;
  /** Absolute path to write the WAV to, or `null` to keep it in memory. */
  readonly save_path: string | null;
  /** Return the WAV bytes base64-encoded (used by the differential demo). */
  readonly return_audio: boolean;
}

export interface TtsRuntimeResultV0 {
  readonly sample_rate: number;
  readonly audio_ms: number;
  /** Wall-clock from request acceptance to complete audio. */
  readonly total_ms: number;
  /** Time to the first audio chunk; `null` for non-streaming synthesis. */
  readonly first_chunk_ms: number | null;
  /** Real-time factor: generation seconds per audio second. */
  readonly rtf: number;
  readonly played: boolean;
  readonly saved_path: string | null;
  readonly audio_base64: string | null;
}

export interface AsrRuntimeRequestV0 {
  readonly audio_base64: string;
  readonly language: string | null;
}

export interface AsrRuntimeResultV0 {
  readonly text: string;
  readonly language: string | null;
  /** Model-reported affect label — perception evidence only, never canonical. */
  readonly emotion: string | null;
  readonly event: string | null;
  readonly duration_ms: number | null;
  readonly latency_ms: number;
}

export interface AsrListenRequestV0 {
  readonly language: string | null;
  readonly max_ms: number;
  readonly silence_ms: number;
  readonly timeout_ms: number;
  /** Capture exactly this many ms regardless of silence (deterministic mode). */
  readonly fixed_ms: number | null;
}

export interface AsrListenResultV0 extends AsrRuntimeResultV0 {
  /** False when the microphone captured only silence. */
  readonly captured: boolean;
}

export interface VoiceListResultV0 {
  readonly voices: readonly VoiceProfileV0[];
}

/**
 * One increment of streamed audio: raw signed-16-bit little-endian mono PCM.
 *
 * Deliberately headerless. The sample rate is known from the response and does
 * not change mid-stream, so per-chunk framing would only add overhead.
 */
export interface SpeechStreamChunkV0 {
  readonly pcm: Uint8Array;
  readonly sample_rate: number;
  /** Index of this chunk within the utterance, starting at 0. */
  readonly index: number;
  /** Milliseconds from request start to this chunk arriving. */
  readonly elapsed_ms: number;
}

/**
 * Measurements for one streamed utterance.
 *
 * `ttfa_ms` is the number that matters: request start → first audio chunk the
 * caller could play. It is measured on the client side of the socket, so it
 * includes transport and is not a model-internal figure.
 */
export interface SpeechStreamResultV0 {
  readonly sample_rate: number;
  readonly chunks: number;
  readonly bytes: number;
  readonly audio_ms: number;
  readonly ttfa_ms: number | null;
  readonly total_ms: number;
  readonly cancelled: boolean;
}

// ----------------------------------------------------------------------------------
// §4 Failure classification
// ----------------------------------------------------------------------------------

function classifyNetworkError(error: unknown, timeout_ms: number): VoiceFailureV0 {
  if (error instanceof VoiceFailureV0) return error;
  const name = error instanceof Error ? error.name : "";
  if (name === "TimeoutError") {
    return new VoiceFailureV0(
      "VOICE_RUNTIME_TIMEOUT",
      `voice runtime did not answer within ${timeout_ms}ms`,
      error
    );
  }
  if (name === "AbortError") {
    return new VoiceFailureV0("VOICE_CANCELLED", "voice request was cancelled", error);
  }
  const detail = error instanceof Error ? error.message : String(error);
  return new VoiceFailureV0("VOICE_RUNTIME_UNAVAILABLE", detail, error);
}

// ----------------------------------------------------------------------------------
// §5 Client
// ----------------------------------------------------------------------------------

/**
 * Local HTTP client for the speech runtime.
 *
 * Every method rejects with `VoiceFailureV0`. Callers decide how to degrade;
 * the text product stays valid either way.
 */
export class VoiceRuntimeClientV0 {
  constructor(private readonly config: VoiceRuntimeConfigV0 = DEFAULT_VOICE_RUNTIME_CONFIG_V0) {}

  baseUrl(): string {
    return this.config.base_url;
  }

  private async requestJson<T>(
    path: string,
    init: { readonly method: "GET" | "POST"; readonly body?: unknown; readonly timeout_ms: number },
    signal?: AbortSignal
  ): Promise<T> {
    const signals: AbortSignal[] = [AbortSignal.timeout(init.timeout_ms)];
    if (signal !== undefined) signals.push(signal);
    const combined = AbortSignal.any(signals);

    let response: Response;
    try {
      response = await fetch(`${this.config.base_url}${path}`, {
        method: init.method,
        headers: init.body === undefined ? {} : { "content-type": "application/json" },
        ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
        signal: combined
      });
    } catch (error) {
      throw classifyNetworkError(error, init.timeout_ms);
    }

    const raw = await response.text();
    if (!response.ok) {
      throw new VoiceFailureV0(
        "VOICE_RUNTIME_REJECTED",
        `${path} returned ${response.status}: ${raw.slice(0, 500)}`
      );
    }
    try {
      return JSON.parse(raw) as T;
    } catch (error) {
      throw new VoiceFailureV0("VOICE_RUNTIME_MALFORMED", `${path} returned non-JSON body`, error);
    }
  }

  /** Liveness plus which models are resident. Never triggers a model load. */
  async health(signal?: AbortSignal): Promise<VoiceRuntimeHealthV0> {
    return await this.requestJson<VoiceRuntimeHealthV0>(
      VOICE_RUNTIME_HEALTH_PATH_V0,
      { method: "GET", timeout_ms: this.config.health_timeout_ms },
      signal
    );
  }

  /** True when the runtime answers at all; a down runtime is a normal state. */
  async isAvailable(signal?: AbortSignal): Promise<boolean> {
    try {
      await this.health(signal);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * One complete utterance, generated in a single pass.
   *
   * Audio is only returned when the caller asked for it (`return_audio`); the
   * runtime can also play it and/or write it to `save_path` on its own host.
   */
  async synthesize(
    request: TtsRuntimeRequestV0,
    signal?: AbortSignal
  ): Promise<TtsRuntimeResultV0> {
    return await this.requestJson<TtsRuntimeResultV0>(
      VOICE_RUNTIME_TTS_PATH_V0,
      { method: "POST", body: { ...request, stream: false }, timeout_ms: this.config.tts_timeout_ms },
      signal
    );
  }

  /**
   * Streams one utterance as PCM chunks, invoking `onChunk` as each arrives.
   *
   * This is genuinely incremental: chunks are read off the socket as the model
   * produces them, so a caller can begin playback before generation finishes.
   * `ttfa_ms` is measured here, on the client side of the socket.
   */
  async synthesizeStream(
    request: TtsRuntimeRequestV0,
    options?: {
      readonly onChunk?: (chunk: SpeechStreamChunkV0) => void;
      readonly signal?: AbortSignal;
    }
  ): Promise<SpeechStreamResultV0> {
    const timeout_ms = this.config.tts_timeout_ms;
    const signals: AbortSignal[] = [AbortSignal.timeout(timeout_ms)];
    if (options?.signal !== undefined) signals.push(options.signal);
    const started = performance.now();

    let response: Response;
    try {
      response = await fetch(`${this.config.base_url}${VOICE_RUNTIME_TTS_STREAM_PATH_V0}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...request, stream: true }),
        signal: AbortSignal.any(signals)
      });
    } catch (error) {
      throw classifyNetworkError(error, timeout_ms);
    }
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new VoiceFailureV0(
        "VOICE_RUNTIME_REJECTED",
        `streaming synthesis returned ${response.status}: ${detail.slice(0, 500)}`
      );
    }
    if (response.body === null) {
      throw new VoiceFailureV0("VOICE_RUNTIME_MALFORMED", "streaming response had no body");
    }
    const sample_rate = Number(response.headers.get("X-Voice-Sample-Rate") ?? 24000);

    const reader = response.body.getReader();
    let index = 0;
    let bytes = 0;
    let ttfa_ms: number | null = null;
    let cancelled = false;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value === undefined || value.byteLength === 0) continue;
        const elapsed_ms = Math.round(performance.now() - started);
        if (ttfa_ms === null) ttfa_ms = elapsed_ms;
        bytes += value.byteLength;
        options?.onChunk?.({ pcm: value, sample_rate, index, elapsed_ms });
        index += 1;
      }
    } catch (error) {
      if (options?.signal?.aborted === true) {
        cancelled = true;
      } else {
        throw classifyNetworkError(error, timeout_ms);
      }
    } finally {
      reader.releaseLock();
    }

    return {
      sample_rate,
      chunks: index,
      bytes,
      audio_ms: Math.round((bytes / 2 / sample_rate) * 1000),
      ttfa_ms,
      total_ms: Math.round(performance.now() - started),
      cancelled
    };
  }

  /**
   * Stops the runtime's in-flight generation and playback.
   *
   * Best effort by design: it exists so that a user interruption can silence the
   * speaker, and a runtime that is already gone has nothing to cancel. It never
   * throws, and it never touches CharacterOS state.
   */
  async cancel(signal?: AbortSignal): Promise<void> {
    try {
      await this.requestJson<{ cancelled: boolean }>(
        VOICE_RUNTIME_TTS_CANCEL_PATH_V0,
        { method: "POST", body: {}, timeout_ms: this.config.health_timeout_ms },
        signal
      );
    } catch {
      // Cancellation is a courtesy; the caller has already stopped listening.
    }
  }

  async transcribe(
    request: AsrRuntimeRequestV0,
    signal?: AbortSignal
  ): Promise<AsrRuntimeResultV0> {
    return await this.requestJson<AsrRuntimeResultV0>(
      VOICE_RUNTIME_ASR_PATH_V0,
      { method: "POST", body: request, timeout_ms: this.config.asr_timeout_ms },
      signal
    );
  }

  /** Records from the microphone on the runtime host and transcribes it. */
  async listen(request: AsrListenRequestV0, signal?: AbortSignal): Promise<AsrListenResultV0> {
    return await this.requestJson<AsrListenResultV0>(
      VOICE_RUNTIME_ASR_LISTEN_PATH_V0,
      { method: "POST", body: request, timeout_ms: this.config.listen_timeout_ms },
      signal
    );
  }

  async listVoices(signal?: AbortSignal): Promise<readonly VoiceProfileV0[]> {
    const result = await this.requestJson<VoiceListResultV0>(
      VOICE_RUNTIME_VOICES_PATH_V0,
      { method: "GET", timeout_ms: this.config.health_timeout_ms },
      signal
    );
    return result.voices;
  }
}
