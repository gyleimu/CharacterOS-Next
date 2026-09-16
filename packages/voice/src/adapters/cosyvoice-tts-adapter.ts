/**
 * CHARACTEROS_COSYVOICE_TTS_ADAPTER_V0 — the only module that knows CosyVoice
 * exists.
 *
 * Responsibility split, deliberately strict:
 *
 *   SpeechExpressionV0            (backend-neutral presentation parameters)
 *     → buildCosyVoiceInstructionV0   (this adapter: quantize to delivery primitives)
 *     → runtime request
 *     → audio
 *
 * The adapter never reads CharacterOS state, never decides how the subject
 * feels, and never inspects a SubjectState. It receives an already-projected
 * `SpeechExpressionV0` and translates it. Swapping CosyVoice for another engine
 * means writing another `VoiceTtsAdapterV0`; no CharacterOS-side change.
 *
 * WHY NO EMOTION WORDS. CosyVoice's own instruction examples include emotion
 * directives ("请非常开心地说一句话。"). This adapter deliberately does NOT use
 * them. Selecting an emotion word from a numeric state is precisely the
 * `valence < 0 → sad` label mapping the projection exists to avoid, and it would
 * make the model — not CharacterOS — the thing deciding the character's
 * emotion. Only continuous DELIVERY primitives (tempo, loudness) are used, so
 * what is being expressed stays a function of CharacterOS state.
 */

import {
  VoiceFailureV0,
  type SpeechExpressionV0,
  type SpeechOutputRequestV0
} from "../contracts.js";
import {
  VoiceRuntimeClientV0,
  DEFAULT_VOICE_RUNTIME_CONFIG_V0,
  type SpeechStreamChunkV0,
  type SpeechStreamResultV0,
  type TtsRuntimeResultV0,
  type VoiceRuntimeConfigV0
} from "../runtime-client.js";

// ----------------------------------------------------------------------------------
// §1 Expression → delivery directive
// ----------------------------------------------------------------------------------

/**
 * Quantizer config.
 *
 * `rate_threshold`/`volume_threshold` are the magnitudes of
 * `speaking_rate`/`volume` beyond which a delivery directive is emitted. The
 * phrases are the ones CosyVoice documents as supported controls, so the
 * directive stays inside the model's trained instruction distribution instead of
 * inventing prose it was never trained to follow.
 */
export interface CosyVoiceInstructionConfigV0 {
  readonly config_id: string;
  readonly prefix: string;
  readonly terminator: string;
  readonly rate_threshold: number;
  readonly volume_threshold: number;
  readonly slow_directive: string;
  readonly fast_directive: string;
  readonly soft_directive: string;
  readonly loud_directive: string;
}

export const DEFAULT_COSYVOICE_INSTRUCTION_CONFIG_V0: CosyVoiceInstructionConfigV0 = {
  config_id: "characteros-next/voice/cosyvoice-instruction/default-v0",
  prefix: "You are a helpful assistant. ",
  terminator: "<|endofprompt|>",
  rate_threshold: 0.25,
  volume_threshold: 0.18,
  slow_directive: "请用尽可能慢地语速说一句话。",
  fast_directive: "请用尽可能快地语速说一句话。",
  soft_directive: "Please say a sentence in a very soft voice.",
  loud_directive: "Please say a sentence as loudly as possible."
};

/**
 * Quantizes a continuous expression into one CosyVoice delivery directive.
 *
 * WHICH EXPRESSION FIELDS ARE HONOURED. Only `speaking_rate` and `volume`, which
 * are the two perceptual axes CosyVoice documents as directly controllable and
 * which were measured to move the audio. `warmth` is deliberately NOT consumed
 * here: nothing in the model's verified instruction vocabulary maps to it, so
 * valence currently has no acoustic channel. That is recorded rather than faked —
 * see SpeechExpressionV0.warmth (PROJECTED_NOT_YET_RENDERED).
 *
 * Deterministic and total: the same expression always yields the same directive,
 * and the neutral case yields an empty directive list.
 */
export function buildCosyVoiceInstructionV0(
  expression: SpeechExpressionV0,
  config: CosyVoiceInstructionConfigV0 = DEFAULT_COSYVOICE_INSTRUCTION_CONFIG_V0
): string {
  const directives: string[] = [];
  if (expression.speaking_rate <= -config.rate_threshold) {
    directives.push(config.slow_directive);
  } else if (expression.speaking_rate >= config.rate_threshold) {
    directives.push(config.fast_directive);
  }
  if (expression.volume <= -config.volume_threshold) {
    directives.push(config.soft_directive);
  } else if (expression.volume >= config.volume_threshold) {
    directives.push(config.loud_directive);
  }
  return `${config.prefix}${directives.join("")}${config.terminator}`;
}

// ----------------------------------------------------------------------------------
// §2 Adapter contract
// ----------------------------------------------------------------------------------

/** One synthesized utterance, with the measurements needed for honest reporting. */
export interface SpeechSynthesisResultV0 {
  readonly adapter_id: string;
  readonly voice_id: string;
  readonly sample_rate: number;
  readonly audio_ms: number;
  readonly total_ms: number;
  readonly first_chunk_ms: number | null;
  readonly rtf: number;
  readonly played: boolean;
  readonly saved_path: string | null;
  /** Raw WAV bytes when the caller asked for them. */
  readonly audio: Uint8Array | null;
  /** The exact directive sent to the model, for auditing. */
  readonly instruct: string;
}

/**
 * Replaceable TTS backend.
 *
 * A second engine (Kokoro, a cloud provider) implements this same interface;
 * nothing above it changes. Only CosyVoice3 is implemented today — no
 * speculative empty backends.
 */
export interface VoiceTtsAdapterV0 {
  readonly adapter_id: string;
  synthesize(
    request: SpeechOutputRequestV0,
    options?: {
      readonly play?: boolean;
      readonly save_path?: string | null;
      readonly return_audio?: boolean;
      readonly signal?: AbortSignal;
    }
  ): Promise<SpeechSynthesisResultV0>;
  /**
   * Streams the utterance, invoking `onChunk` as audio arrives.
   *
   * Optional so that a backend without incremental synthesis remains usable:
   * callers fall back to `synthesize` when it is absent. When present it must be
   * genuinely incremental, not pre-generated audio sliced up.
   */
  synthesizeStream?(
    request: SpeechOutputRequestV0,
    options?: {
      readonly play?: boolean;
      readonly onChunk?: (chunk: SpeechStreamChunkV0) => void;
      readonly signal?: AbortSignal;
    }
  ): Promise<SpeechStreamResultV0>;
  /**
   * Stops in-flight generation and playback.
   *
   * Optional because it is a courtesy to the audio device, not a correctness
   * requirement: aborting the request already stops the caller listening.
   */
  cancel?(signal?: AbortSignal): Promise<void>;
}

// ----------------------------------------------------------------------------------
// §3 CosyVoice adapter
// ----------------------------------------------------------------------------------

export const COSYVOICE_TTS_ADAPTER_ID_V0 = "characteros-next/voice/tts/cosyvoice3-v0" as const;

export interface CosyVoiceTtsAdapterOptionsV0 {
  readonly client: VoiceRuntimeClientV0;
  readonly instruction_config?: CosyVoiceInstructionConfigV0;
}

export class CosyVoiceTtsAdapterV0 implements VoiceTtsAdapterV0 {
  readonly adapter_id = COSYVOICE_TTS_ADAPTER_ID_V0;
  private readonly client: VoiceRuntimeClientV0;
  private readonly instructionConfig: CosyVoiceInstructionConfigV0;

  constructor(options: CosyVoiceTtsAdapterOptionsV0) {
    this.client = options.client;
    this.instructionConfig = options.instruction_config ?? DEFAULT_COSYVOICE_INSTRUCTION_CONFIG_V0;
  }

  /** Convenience constructor for callers that only override the endpoint. */
  static withBaseUrl(
    base_url: string,
    overrides?: Partial<VoiceRuntimeConfigV0>,
    instruction_config?: CosyVoiceInstructionConfigV0
  ): CosyVoiceTtsAdapterV0 {
    return new CosyVoiceTtsAdapterV0({
      client: new VoiceRuntimeClientV0({ ...DEFAULT_VOICE_RUNTIME_CONFIG_V0, ...overrides, base_url }),
      ...(instruction_config === undefined ? {} : { instruction_config })
    });
  }

  /** The directive this adapter would send for an expression (auditable). */
  instructionFor(expression: SpeechExpressionV0): string {
    return buildCosyVoiceInstructionV0(expression, this.instructionConfig);
  }

  async synthesize(
    request: SpeechOutputRequestV0,
    options?: {
      readonly play?: boolean;
      readonly save_path?: string | null;
      readonly return_audio?: boolean;
      readonly signal?: AbortSignal;
    }
  ): Promise<SpeechSynthesisResultV0> {
    if (request.text.trim().length === 0) {
      throw new VoiceFailureV0("VOICE_REQUEST_INVALID", "cannot synthesize empty text");
    }
    const instruct = this.instructionFor(request.expression);
    const result: TtsRuntimeResultV0 = await this.client.synthesize(
      {
        text: request.text,
        voice_id: request.voice_id,
        instruct,
        play: options?.play ?? false,
        stream: request.streaming,
        save_path: options?.save_path ?? null,
        return_audio: options?.return_audio ?? false
      },
      options?.signal
    );
    return {
      adapter_id: this.adapter_id,
      voice_id: request.voice_id,
      sample_rate: result.sample_rate,
      audio_ms: result.audio_ms,
      total_ms: result.total_ms,
      first_chunk_ms: result.first_chunk_ms,
      rtf: result.rtf,
      played: result.played,
      saved_path: result.saved_path,
      audio: result.audio_base64 === null ? null : decodeBase64V0(result.audio_base64),
      instruct
    };
  }

  /**
   * Streams the utterance; the runtime plays each chunk as it is produced.
   *
   * Playback stays on the runtime side because that is where the audio device
   * and the model are; the CharacterOS process never needs an audio stack. The
   * chunks are still surfaced through `onChunk`, so a caller can observe
   * progress and measure real time-to-first-audio.
   */
  async synthesizeStream(
    request: SpeechOutputRequestV0,
    options?: {
      readonly play?: boolean;
      readonly onChunk?: (chunk: SpeechStreamChunkV0) => void;
      readonly signal?: AbortSignal;
    }
  ): Promise<SpeechStreamResultV0> {
    if (request.text.trim().length === 0) {
      throw new VoiceFailureV0("VOICE_REQUEST_INVALID", "cannot synthesize empty text");
    }
    const instruct = this.instructionFor(request.expression);
    return await this.client.synthesizeStream(
      {
        text: request.text,
        voice_id: request.voice_id,
        instruct,
        play: options?.play ?? false,
        stream: true,
        save_path: null,
        return_audio: false
      },
      {
        ...(options?.onChunk === undefined ? {} : { onChunk: options.onChunk }),
        ...(options?.signal === undefined ? {} : { signal: options.signal })
      }
    );
  }

  /** Stops the runtime's in-flight generation and playback. */
  async cancel(signal?: AbortSignal): Promise<void> {
    await this.client.cancel(signal);
  }
}

/** Base64 → bytes, without pulling a decoder dependency. */
export function decodeBase64V0(value: string): Uint8Array {
  return Uint8Array.from(Buffer.from(value, "base64"));
}
