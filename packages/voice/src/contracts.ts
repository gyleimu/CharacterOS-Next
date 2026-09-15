/**
 * CHARACTEROS_VOICE_CONTRACTS_V0 — the stable, backend-neutral boundary between
 * CharacterOS and any speech model runtime.
 *
 * Voice is a PRESENTATION / INTERACTION channel. Nothing in this module can
 * become canonical state: it carries no commit authority, no belief/affect
 * mutator, and no reference to a SubjectState writer.
 *
 * Causal direction is one-way and is enforced by the types here:
 *
 *   CharacterOS state
 *     → SpeechExpressionProjection (read-only, deterministic)
 *     → SpeechExpressionV0
 *     → SpeechOutputRequestV0
 *     → TTS adapter (model-specific)
 *     → audio
 *
 * The reverse direction never exists. A speech model may describe what it
 * OBSERVED (SpeechInputV0.observed_vocal_affect) but that value is typed as
 * non-authoritative evidence, so it cannot be mistaken for CharacterOS affect.
 */

// ----------------------------------------------------------------------------------
// §1 Speech input — what the subject heard (ASR result).
// ----------------------------------------------------------------------------------

export const SPEECH_INPUT_SCHEMA_VERSION = "speech-input-v0" as const;

/** Where the utterance came from. Never a canonical provenance kind. */
export type SpeechInputSourceV0 = "microphone" | "file";

/**
 * A speech model's OWN observation about the speaker's voice.
 *
 * This is perception evidence and NOTHING ELSE. It is not CharacterOS affect,
 * it does not enter any canonical transition, and `authoritative` is the
 * literal `false` so a caller cannot promote it by type. CharacterOS decides
 * what the subject makes of it through its existing appraisal path.
 */
export interface ObservedVocalAffectV0 {
  /** Model-reported affect label (e.g. `HAPPY`, `SAD`, `ANGRY`, `NEUTRAL`). */
  readonly label: string;
  /** Model-reported audio event, if any (e.g. `Laughter`, `Applause`). */
  readonly event: string | null;
  /** Type-level guarantee: this observation never becomes canonical state. */
  readonly authoritative: false;
}

export interface SpeechTimestampV0 {
  readonly text: string;
  readonly start_ms: number;
  readonly end_ms: number;
}

/**
 * ONE recognized utterance. `utterance_ref` is the caller-owned stable identity
 * used for de-duplication; it is derived from the audio, never from subject
 * state, so replaying the same audio cannot create two utterances.
 */
export interface SpeechInputV0 {
  readonly schema_version: typeof SPEECH_INPUT_SCHEMA_VERSION;
  readonly utterance_ref: string;
  readonly text: string;
  /** Model-reported language tag, or `null` when the model does not report one. */
  readonly language: string | null;
  /** Recognizer confidence in [0,1], or `null` when not reliably provided. */
  readonly confidence: number | null;
  readonly duration_ms: number | null;
  readonly timestamps: readonly SpeechTimestampV0[] | null;
  readonly observed_vocal_affect: ObservedVocalAffectV0 | null;
  readonly source: SpeechInputSourceV0;
}

// ----------------------------------------------------------------------------------
// §2 Speech expression — the READ-ONLY projection of CharacterOS state.
// ----------------------------------------------------------------------------------

export const SPEECH_EXPRESSION_SCHEMA_VERSION = "speech-expression-v0" as const;
export const SPEECH_EXPRESSION_PROJECTION_ID = "characteros-next/voice/speech-expression/v0" as const;

/**
 * Bounded presentation parameters for one utterance.
 *
 * Every field is a presentation parameter, not a CharacterOS state dimension.
 * `valence`/`activation` are carried THROUGH from canonical affect (they are the
 * subject's real affect, not a new one); every other field is a presentation
 * projection derived from readable CharacterOS state by a deterministic,
 * inspectable, bounded function.
 *
 * Continuous and compositional on purpose: there is no emotion label here, and
 * the projection must never be implemented as `valence < 0 → sad`.
 */
export interface SpeechExpressionV0 {
  readonly schema_version: typeof SPEECH_EXPRESSION_SCHEMA_VERSION;
  /** Carried from canonical affect valence, [-1, 1]. */
  readonly valence: number;
  /** Carried from canonical affect activation, [0, 1]. */
  readonly activation: number;
  /** Overall expressive intensity, [0, 1]. */
  readonly intensity: number;
  /** Interpersonal warmth, [0, 1]. */
  readonly warmth: number;
  /** Confidence in what is being said, [0, 1]. */
  readonly certainty: number;
  /** Reluctance / hedging, [0, 1]. */
  readonly hesitation: number;
  /** Relative speaking rate, [-1, 1]; negative is slower than neutral. */
  readonly speaking_rate: number;
  /** Relative volume, [-1, 1]; negative is softer than neutral. */
  readonly volume: number;
  /** Tendency toward longer pauses, [0, 1]. */
  readonly pause_bias: number;
  /** Prosodic animation, [0, 1]. */
  readonly expressiveness: number;
  /**
   * Presentation-level forcefulness, [0, 1].
   *
   * DERIVED PRESENTATION ONLY. CharacterOS has no canonical dominance
   * dimension, so this is explicitly NOT a claim about a subject state axis;
   * it is a bounded function of regulation (energy/stress) and affect.
   */
  readonly assertiveness: number;
  /** Exact inputs and config identity that produced this expression. */
  readonly provenance: SpeechExpressionProvenanceV0;
}

/**
 * Bounded, inspectable record of how the expression was produced.
 *
 * `inputs` holds the normalized values actually consumed, so any expression can
 * be re-derived and audited. `state_revision` is the CharacterOS revision the
 * inputs were read at, or `null` when the caller has no revision to report.
 */
export interface SpeechExpressionProvenanceV0 {
  readonly projection_id: typeof SPEECH_EXPRESSION_PROJECTION_ID;
  readonly config_id: string;
  readonly state_revision: number | null;
  readonly inputs: SpeechExpressionInputsV0;
}

/**
 * The bounded set of CharacterOS values the projection is allowed to read.
 *
 * These mirror fields already exposed by the product's read-only canonical
 * state projection. The projection never receives a mutable SubjectState and
 * never writes anything back.
 */
export interface SpeechExpressionInputsV0 {
  /** Canonical affect valence, [-1, 1]. */
  readonly valence: number;
  /** Canonical affect activation, [0, 1]. */
  readonly activation: number;
  /** Regulatory energy, [0, 1]. */
  readonly energy: number;
  /** Regulatory stress, [0, 1]. */
  readonly stress: number;
  /** Regulatory arousal, [0, 1]. */
  readonly arousal: number;
  /** Regulatory fatigue, [0, 1]. */
  readonly fatigue: number;
  /** Counterpart familiarity, [0, 1], or `null` when no counterpart is known. */
  readonly familiarity: number | null;
}

// ----------------------------------------------------------------------------------
// §3 Speech output request — what to say, and how it should sound.
// ----------------------------------------------------------------------------------

export const SPEECH_OUTPUT_REQUEST_SCHEMA_VERSION = "speech-output-request-v0" as const;

/**
 * ONE utterance to synthesize.
 *
 * Deliberately model-neutral: it names no model, no voice-cloning prompt and no
 * vendor instruction string. A TTS adapter translates `expression` into
 * whatever its backend understands, so CosyVoice3 can be replaced without any
 * CharacterOS-side change.
 */
export interface SpeechOutputRequestV0 {
  readonly schema_version: typeof SPEECH_OUTPUT_REQUEST_SCHEMA_VERSION;
  readonly request_ref: string;
  readonly text: string;
  /** Language tag for the utterance. */
  readonly language: string;
  /** Stable voice identity reference. Never a path to a reference recording. */
  readonly voice_id: string;
  readonly expression: SpeechExpressionV0;
  /** Request chunked audio as it is produced. */
  readonly streaming: boolean;
}

// ----------------------------------------------------------------------------------
// §4 Voice identity — an external asset reference, never canonical state.
// ----------------------------------------------------------------------------------

export const VOICE_PROFILE_SCHEMA_VERSION = "voice-profile-v0" as const;

/**
 * A voice the subject can speak with.
 *
 * Only the ID ever reaches CharacterOS. The reference recording stays an
 * external asset owned by the voice runtime: it is never stored in canonical
 * state, never committed to the repository, and must only be audio the operator
 * has the right to use.
 */
export interface VoiceProfileV0 {
  readonly schema_version: typeof VOICE_PROFILE_SCHEMA_VERSION;
  readonly voice_id: string;
  readonly display_name: string;
  /** `default` uses the runtime's built-in speaker; `zero_shot` clones a reference. */
  readonly kind: "default" | "zero_shot";
  /** Opaque runtime-side handle for the reference audio; `null` for `default`. */
  readonly reference_handle: string | null;
}

// ----------------------------------------------------------------------------------
// §5 Failures — voice is optional, so every failure is a typed, recoverable value.
// ----------------------------------------------------------------------------------

export type VoiceFailureCodeV0 =
  | "VOICE_RUNTIME_UNAVAILABLE"
  | "VOICE_RUNTIME_TIMEOUT"
  | "VOICE_RUNTIME_REJECTED"
  | "VOICE_RUNTIME_MALFORMED"
  | "VOICE_REQUEST_INVALID"
  | "VOICE_CANCELLED";

/**
 * A voice-channel failure. Callers MUST treat this as a degraded-but-valid
 * outcome: a failed synthesis never invalidates a text turn, and a failed
 * recognition never invalidates typed input.
 */
export class VoiceFailureV0 extends Error {
  constructor(
    readonly code: VoiceFailureCodeV0,
    detail: string,
    override readonly cause?: unknown
  ) {
    super(`${code}: ${detail}`);
    this.name = "VoiceFailureV0";
  }
}
