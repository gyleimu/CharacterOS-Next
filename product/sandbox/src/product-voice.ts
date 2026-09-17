/**
 * PERSISTENT_LIVING_SUBJECT_PRODUCT_EXPERIENCE_V0 — VOICE MODALITY BOUNDARY.
 *
 * Voice is an INPUT/OUTPUT MODALITY only. Nothing in this file knows about the
 * subject: it turns audio into text (STT) and text into audio (TTS) and reports
 * bounded failures. The product then feeds the transcript through the SAME
 * `submitHumanText` path a typed message uses, and speaks ONLY the final delivered
 * text a turn produced.
 *
 * HARD LAWS (enforced by the callers, stated here so the boundary is unambiguous):
 *   - STT output is a user-input CANDIDATE: it never writes Memory, Experience,
 *     Belief, Affect, Relationship, Personality or any canonical state. A failed
 *     transcription therefore mutates nothing at all.
 *   - TTS input is ALWAYS the final delivered subject text (or the host's fixed
 *     degraded reply). Raw model output, rejected attempts and internal details are
 *     never spoken.
 *   - RAW AUDIO IS NOT PERSISTED. Audio bytes live only inside the request/response
 *     that carries them; no audio file, blob or base64 copy is written to durable
 *     storage by anything in this module or its callers.
 *   - NO VOICE IDENTITY. Nothing here infers emotion, identity, gender, personality
 *     or intent from voice characteristics; there is no prosody analysis.
 *
 * PROVIDERS: the ports are injected. The shipped default is UNAVAILABLE (voice is an
 * optional capability and must never block the text product); a local/replaceable
 * HTTP contract can be enabled with `CHARACTEROS_STT_URL` / `CHARACTEROS_TTS_URL`.
 * No vendor SDK, no model benchmark, no second runtime.
 */

export const PRODUCT_VOICE_SCHEMA_VERSION = "product-voice-v0" as const;

/** The audio payload one voice request carries. Never persisted. */
export interface ProductAudioInputV0 {
  readonly audio: Uint8Array;
  readonly content_type: string;
}

export type SpeechToTextResultV0 =
  | { readonly kind: "TEXT"; readonly text: string }
  | {
      readonly kind: "FAILED";
      readonly code:
        | "STT_UNAVAILABLE"
        | "STT_TIMEOUT"
        | "STT_FAILED"
        | "STT_EMPTY"
        | "AUDIO_TOO_LARGE";
      readonly detail: string;
    };

export type TextToSpeechResultV0 =
  | { readonly kind: "AUDIO"; readonly audio: Uint8Array; readonly content_type: string }
  | {
      readonly kind: "FAILED";
      readonly code: "TTS_UNAVAILABLE" | "TTS_TIMEOUT" | "TTS_FAILED" | "TTS_EMPTY";
      readonly detail: string;
    };

/** Audio → transcript. Implementations must be side-effect free. */
export interface SpeechToTextPortV0 {
  readonly available: boolean;
  transcribe(input: ProductAudioInputV0): Promise<SpeechToTextResultV0>;
}

/** Final delivered text → audio. Implementations must be side-effect free. */
export interface TextToSpeechPortV0 {
  readonly available: boolean;
  synthesize(input: { readonly text: string }): Promise<TextToSpeechResultV0>;
}

export interface ProductVoicePortsV0 {
  readonly stt: SpeechToTextPortV0;
  readonly tts: TextToSpeechPortV0;
}

/** The shipped default: voice is an optional capability, never a startup blocker. */
export function unavailableVoicePortsV0(): ProductVoicePortsV0 {
  return Object.freeze({
    stt: Object.freeze({
      available: false,
      transcribe: async (): Promise<SpeechToTextResultV0> => ({
        kind: "FAILED",
        code: "STT_UNAVAILABLE",
        detail: "no speech-to-text adapter is configured (set CHARACTEROS_STT_URL to enable voice input)"
      })
    }),
    tts: Object.freeze({
      available: false,
      synthesize: async (): Promise<TextToSpeechResultV0> => ({
        kind: "FAILED",
        code: "TTS_UNAVAILABLE",
        detail: "no text-to-speech adapter is configured (the browser reads replies aloud when it can)"
      })
    })
  });
}

export const PRODUCT_VOICE_MAX_AUDIO_BYTES_V0 = 8 * 1024 * 1024;
export const PRODUCT_VOICE_MAX_SPEAK_CHARS_V0 = 4096;

function base64ToBytes(value: string): Uint8Array | null {
  try {
    return new Uint8Array(Buffer.from(value, "base64"));
  } catch {
    return null;
  }
}

function bytesToBase64(value: string): string {
  return Buffer.from(value, "base64").toString("base64");
}

export interface HttpSpeechAdapterOptionsV0 {
  /** Base URL of the local speech service (no vendor SDK, plain HTTP). */
  readonly base_url: string;
  /** Optional bearer credential; sent as an Authorization header, never logged. */
  readonly token?: string | undefined;
  readonly timeout_ms?: number | undefined;
  /** Injectable fetch for tests; defaults to the platform fetch. */
  readonly fetch_impl?: typeof fetch | undefined;
}

/**
 * Local/replaceable HTTP contract (documented, schema-checked, bounded):
 *   POST {base}/transcribe  { audio_base64, content_type }            → { text }
 *   POST {base}/speak       { text }                                   → { audio_base64, content_type }
 * A shim in front of any local engine satisfies it; nothing vendor-specific is
 * assumed, and both directions fail closed with bounded codes.
 */
export function createHttpSpeechPortsV0(options: HttpSpeechAdapterOptionsV0): ProductVoicePortsV0 {
  const timeoutMs = options.timeout_ms ?? 120_000;
  const doFetch = options.fetch_impl ?? fetch;
  const url = (suffix: string): string => `${options.base_url.replace(/\/$/, "")}/${suffix}`;
  const headers = (): Record<string, string> => ({
    "content-type": "application/json",
    ...(options.token === undefined ? {} : { authorization: `Bearer ${options.token}` })
  });
  const post = async (suffix: string, body: unknown): Promise<unknown | { readonly __failure: string }> => {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), timeoutMs);
    try {
      const response = await doFetch(url(suffix), {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(body),
        signal: abort.signal
      });
      if (!response.ok) return { __failure: `HTTP ${String(response.status)}` };
      return (await response.json()) as unknown;
    } catch (error) {
      return { __failure: abort.signal.aborted ? "TIMEOUT" : (error as Error).message.slice(0, 200) };
    } finally {
      clearTimeout(timer);
    }
  };
  return Object.freeze({
    stt: Object.freeze({
      available: true,
      transcribe: async (input: ProductAudioInputV0): Promise<SpeechToTextResultV0> => {
        if (input.audio.byteLength === 0) {
          return { kind: "FAILED", code: "STT_EMPTY", detail: "empty audio payload" };
        }
        if (input.audio.byteLength > PRODUCT_VOICE_MAX_AUDIO_BYTES_V0) {
          return { kind: "FAILED", code: "AUDIO_TOO_LARGE", detail: "audio payload exceeds the product bound" };
        }
        const response = await post("transcribe", {
          audio_base64: Buffer.from(input.audio).toString("base64"),
          content_type: input.content_type
        });
        if (response === null || typeof response !== "object") {
          return { kind: "FAILED", code: "STT_FAILED", detail: "speech service returned no object" };
        }
        const failure = (response as { __failure?: unknown }).__failure;
        if (typeof failure === "string") {
          return {
            kind: "FAILED",
            code: failure === "TIMEOUT" ? "STT_TIMEOUT" : "STT_FAILED",
            detail: `speech service ${failure}`
          };
        }
        const text = (response as { text?: unknown }).text;
        if (typeof text !== "string") {
          return { kind: "FAILED", code: "STT_FAILED", detail: "speech service returned no text" };
        }
        if (text.trim().length === 0) {
          return { kind: "FAILED", code: "STT_EMPTY", detail: "speech service returned an empty transcript" };
        }
        return { kind: "TEXT", text };
      }
    }),
    tts: Object.freeze({
      available: true,
      synthesize: async (input: { readonly text: string }): Promise<TextToSpeechResultV0> => {
        if (input.text.trim().length === 0) {
          return { kind: "FAILED", code: "TTS_EMPTY", detail: "nothing to speak" };
        }
        const response = await post("speak", { text: input.text.slice(0, PRODUCT_VOICE_MAX_SPEAK_CHARS_V0) });
        if (response === null || typeof response !== "object") {
          return { kind: "FAILED", code: "TTS_FAILED", detail: "speech service returned no object" };
        }
        const failure = (response as { __failure?: unknown }).__failure;
        if (typeof failure === "string") {
          return {
            kind: "FAILED",
            code: failure === "TIMEOUT" ? "TTS_TIMEOUT" : "TTS_FAILED",
            detail: `speech service ${failure}`
          };
        }
        const audioBase64 = (response as { audio_base64?: unknown }).audio_base64;
        const contentType = (response as { content_type?: unknown }).content_type;
        if (typeof audioBase64 !== "string" || audioBase64.length === 0) {
          return { kind: "FAILED", code: "TTS_FAILED", detail: "speech service returned no audio" };
        }
        const audio = base64ToBytes(audioBase64);
        if (audio === null || audio.byteLength === 0) {
          return { kind: "FAILED", code: "TTS_FAILED", detail: "speech service returned undecodable audio" };
        }
        return {
          kind: "AUDIO",
          audio,
          content_type: typeof contentType === "string" && contentType.length > 0 ? contentType : "audio/wav"
        };
      }
    })
  });
}

/** Exported for the product layer's request decoding. */
export const PRODUCT_VOICE_AUDIO_BASE64_HELPER_V0 = bytesToBase64;
