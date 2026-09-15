/**
 * CHARACTEROS_SENSEVOICE_ASR_ADAPTER_V0 — the only module that knows SenseVoice
 * exists.
 *
 *   microphone / WAV
 *     → runtime ASR
 *     → SpeechInputV0
 *     → (caller) existing CharacterOS text ingress
 *
 * The adapter's output is a plain recognized utterance. It is fed to the SAME
 * text ingress a typed message uses, so speech adds an input channel without
 * adding a second way into the subject.
 *
 * WHAT SENSEVOICE'S EMOTION OUTPUT IS AND IS NOT. SenseVoice reports an affect
 * label and an audio event. That is stored as `observed_vocal_affect`: an
 * observation ABOUT the speaker's voice, typed as non-authoritative. It is never
 * written into CharacterOS affect, and no code path here can turn
 * `SenseVoice says ANGRY` into `subject affect = angry`. If CharacterOS wants to
 * make something of how the user sounded, that goes through its existing
 * appraisal path as an observation, like any other evidence.
 */

import { createHash } from "node:crypto";

import {
  SPEECH_INPUT_SCHEMA_VERSION,
  VoiceFailureV0,
  type ObservedVocalAffectV0,
  type SpeechInputSourceV0,
  type SpeechInputV0
} from "../contracts.js";
import { VoiceRuntimeClientV0, type AsrRuntimeResultV0 } from "../runtime-client.js";

export const SENSEVOICE_ASR_ADAPTER_ID_V0 = "characteros-next/voice/asr/sensevoice-small-v0" as const;

/**
 * Content-addressed utterance identity.
 *
 * Derived from the audio itself, so the same recording always maps to the same
 * utterance ref and a replay cannot be mistaken for a new utterance. This
 * mirrors the repository's habit of deriving identity from committed content
 * rather than from a mutable counter.
 */
export function deriveUtteranceRefV0(audio: Uint8Array): string {
  const digest = createHash("sha256").update(audio).digest("hex");
  return `utterance:${digest}`;
}

/** Stable identity for a microphone capture, which has no bytes until captured. */
export function deriveLiveUtteranceRefV0(capturedAt: string, sequence: number): string {
  const digest = createHash("sha256").update(`${capturedAt}\n${sequence}`, "utf8").digest("hex");
  return `utterance:${digest}`;
}

/** Per-utterance measurement, surfaced for honest latency reporting. */
export interface SpeechRecognitionResultV0 {
  readonly adapter_id: string;
  readonly input: SpeechInputV0;
  readonly latency_ms: number;
}

/**
 * Replaceable ASR backend. Only SenseVoice is implemented today.
 */
export interface VoiceAsrAdapterV0 {
  readonly adapter_id: string;
  /** Transcribes an existing WAV buffer. */
  transcribe(
    audio: Uint8Array,
    options?: {
      readonly language?: string | null;
      readonly source?: SpeechInputSourceV0;
      readonly signal?: AbortSignal;
    }
  ): Promise<SpeechRecognitionResultV0>;
  /**
   * Captures one utterance from the microphone (with voice-activity detection)
   * and transcribes it. Resolves to `null` when only silence was captured, which
   * is an ordinary outcome and not a failure.
   */
  listen(options?: {
    readonly language?: string | null;
    readonly max_ms?: number;
    readonly silence_ms?: number;
    readonly timeout_ms?: number;
    readonly fixed_ms?: number | null;
    readonly signal?: AbortSignal;
  }): Promise<SpeechRecognitionResultV0 | null>;
}

function toSpeechInputV0(
  result: AsrRuntimeResultV0,
  utterance_ref: string,
  source: SpeechInputSourceV0
): SpeechInputV0 {
  const hasAffect = result.emotion !== null || result.event !== null;
  const observed: ObservedVocalAffectV0 | null = hasAffect
    ? { label: result.emotion ?? "UNKNOWN", event: result.event, authoritative: false }
    : null;
  return {
    schema_version: SPEECH_INPUT_SCHEMA_VERSION,
    utterance_ref,
    text: result.text,
    language: result.language,
    confidence: null,
    duration_ms: result.duration_ms,
    timestamps: null,
    observed_vocal_affect: observed,
    source
  };
}

export interface SenseVoiceAsrAdapterOptionsV0 {
  readonly client: VoiceRuntimeClientV0;
  /** Injectable clock so microphone utterance identity is deterministic in tests. */
  readonly now?: () => string;
}

export class SenseVoiceAsrAdapterV0 implements VoiceAsrAdapterV0 {
  readonly adapter_id = SENSEVOICE_ASR_ADAPTER_ID_V0;
  private readonly client: VoiceRuntimeClientV0;
  private readonly now: () => string;
  private sequence = 0;

  constructor(options: SenseVoiceAsrAdapterOptionsV0) {
    this.client = options.client;
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async transcribe(
    audio: Uint8Array,
    options?: {
      readonly language?: string | null;
      readonly source?: SpeechInputSourceV0;
      readonly signal?: AbortSignal;
    }
  ): Promise<SpeechRecognitionResultV0> {
    if (audio.byteLength === 0) {
      throw new VoiceFailureV0("VOICE_REQUEST_INVALID", "cannot transcribe empty audio");
    }
    const result = await this.client.transcribe(
      { audio_base64: Buffer.from(audio).toString("base64"), language: options?.language ?? null },
      options?.signal
    );
    return {
      adapter_id: this.adapter_id,
      input: toSpeechInputV0(result, deriveUtteranceRefV0(audio), options?.source ?? "file"),
      latency_ms: result.latency_ms
    };
  }

  async listen(options?: {
    readonly language?: string | null;
    readonly max_ms?: number;
    readonly silence_ms?: number;
    readonly timeout_ms?: number;
    readonly fixed_ms?: number | null;
    readonly signal?: AbortSignal;
  }): Promise<SpeechRecognitionResultV0 | null> {
    const result = await this.client.listen(
      {
        language: options?.language ?? null,
        max_ms: options?.max_ms ?? 15_000,
        silence_ms: options?.silence_ms ?? 700,
        timeout_ms: options?.timeout_ms ?? 20_000,
        fixed_ms: options?.fixed_ms ?? null
      },
      options?.signal
    );
    if (!result.captured) return null;
    this.sequence += 1;
    return {
      adapter_id: this.adapter_id,
      input: toSpeechInputV0(result, deriveLiveUtteranceRefV0(this.now(), this.sequence), "microphone"),
      latency_ms: result.latency_ms
    };
  }
}
