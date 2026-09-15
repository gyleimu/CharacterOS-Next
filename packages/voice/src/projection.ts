/**
 * CHARACTEROS_SPEECH_EXPRESSION_PROJECTION_V0 — how CharacterOS state becomes
 * how the subject SOUNDS.
 *
 * This is a pure, deterministic, bounded function:
 *
 *   SpeechExpressionInputsV0 (read-only CharacterOS state)
 *     → SpeechExpressionV0 (presentation parameters)
 *
 * Design constraints, all deliberate:
 *
 * 1. NO EMOTION-LABEL MAPPING. There is no `valence < 0 → sad` branch anywhere.
 *    Every output is a continuous weighted combination of continuous inputs, so
 *    nearby states produce nearby delivery and no state is a special case.
 *
 * 2. COMPOSITIONAL. Activation drives rate/volume/pause; valence drives warmth
 *    and colour; regulation drives force and steadiness. The same valence with
 *    different activation therefore lands in clearly different places — that is
 *    the whole point, and `relationship-projection` tests pin it.
 *
 * 3. DETERMINISTIC AND RE-DERIVABLE. Same inputs + same config ⇒ byte-identical
 *    expression. Outputs are clamped then rounded to a fixed precision, and `-0`
 *    is normalized to `0` so equal states cannot produce unequal values.
 *
 * 4. INSPECTABLE. The exact normalized inputs and the config id travel in
 *    `provenance`, so any utterance can be audited and re-derived later.
 *
 * 5. FAIL-CLOSED INPUTS, BOUNDED OUTPUTS. Malformed or out-of-range INPUT is
 *    rejected rather than clamped (matching the repository's validator
 *    discipline); OUTPUT is bounded by construction.
 *
 * Nothing here reads a mutable SubjectState or writes anything back. The
 * projection is a consumer of a read-only view.
 */

import {
  SPEECH_EXPRESSION_PROJECTION_ID,
  SPEECH_EXPRESSION_SCHEMA_VERSION,
  VoiceFailureV0,
  type SpeechExpressionInputsV0,
  type SpeechExpressionV0
} from "./contracts.js";

// ----------------------------------------------------------------------------------
// §1 Config — explicit, named weights. Changing delivery is a config change.
// ----------------------------------------------------------------------------------

/**
 * Weight table for the projection. Every field is an explicit linear
 * coefficient so the mapping can be read, tuned and tested without touching
 * code. `neutral_activation` is the activation value treated as "unmarked"
 * (0.5), and `da` in the formulas below is activation relative to it, scaled to
 * [-1, 1].
 */
export interface SpeechExpressionConfigV0 {
  readonly config_id: string;
  readonly neutral_activation: number;
  readonly default_familiarity: number;
  readonly precision: number;
  readonly weights: {
    /** intensity: outward expressive energy. */
    readonly intensity: {
      readonly base: number;
      readonly activation: number;
      readonly stress: number;
      readonly fatigue: number;
      readonly affect_magnitude: number;
      readonly energy: number;
    };
    /** warmth: interpersonal softness. */
    readonly warmth: {
      readonly base: number;
      readonly valence: number;
      readonly stress: number;
      readonly familiarity: number;
    };
    /** certainty: steadiness of what is said. */
    readonly certainty: {
      readonly base: number;
      readonly energy: number;
      readonly activation: number;
      readonly valence: number;
      readonly stress: number;
      readonly fatigue: number;
    };
    /** hesitation: hedging and reluctance. */
    readonly hesitation: {
      readonly base: number;
      readonly stress: number;
      readonly fatigue: number;
      readonly low_energy: number;
      readonly activation: number;
    };
    /** speaking_rate: relative tempo. */
    readonly speaking_rate: {
      readonly activation: number;
      readonly energy: number;
      readonly fatigue: number;
    };
    /** volume: relative loudness. */
    readonly volume: {
      readonly activation: number;
      readonly intensity: number;
    };
    /** pause_bias: tendency to leave space. */
    readonly pause_bias: {
      readonly base: number;
      readonly fatigue: number;
      readonly low_activation: number;
      readonly energy: number;
    };
    /** expressiveness: prosodic animation. */
    readonly expressiveness: {
      readonly intensity: number;
      readonly activation: number;
    };
    /** assertiveness: presentation-level force (NOT a canonical dimension). */
    readonly assertiveness: {
      readonly energy: number;
      readonly stress: number;
      readonly activation: number;
      readonly fatigue: number;
    };
  };
}

/**
 * The reference config. Tuned so that the required contrast holds:
 *
 *   low valence + LOW activation   ⇒ slower, softer, longer pauses, withdrawn
 *   low valence + HIGH activation  ⇒ faster, louder, sharper, forceful
 *
 * `speaking_rate.energy` is deliberately small. A subject's regulatory energy at
 * GENESIS is 1.0 (read from the real seed: energy 1, stress 0, arousal 0.5,
 * fatigue 0), so a large energy weight would push an ordinary rested subject
 * past the rate threshold on its own and instruct it to speak as fast as
 * possible without anything having happened to it. Energy is therefore a mild
 * modifier on tempo, and the directive thresholds are set so that only a MARKED
 * deviation is quantized into a max-speed / min-speed instruction.
 */
export const DEFAULT_SPEECH_EXPRESSION_CONFIG_V0: SpeechExpressionConfigV0 = {
  config_id: "characteros-next/voice/speech-expression-config/default-v0",
  neutral_activation: 0.5,
  default_familiarity: 0.5,
  precision: 6,
  weights: {
    intensity: {
      base: 0.45,
      activation: 0.35,
      stress: 0.2,
      fatigue: 0.2,
      affect_magnitude: 0.25,
      energy: 0.15
    },
    warmth: { base: 0.35, valence: 0.3, stress: 0.15, familiarity: 0.2 },
    certainty: {
      base: 0.3,
      energy: 0.3,
      activation: 0.15,
      valence: 0.2,
      stress: 0.25,
      fatigue: 0.2
    },
    hesitation: { base: 0.1, stress: 0.35, fatigue: 0.3, low_energy: 0.25, activation: 0.35 },
    speaking_rate: { activation: 0.55, energy: 0.1, fatigue: 0.2 },
    volume: { activation: 0.5, intensity: 0.6 },
    pause_bias: { base: 0.1, fatigue: 0.35, low_activation: 0.45, energy: 0.25 },
    expressiveness: { intensity: 0.7, activation: 0.3 },
    assertiveness: { energy: 0.3, stress: 0.3, activation: 0.35, fatigue: 0.25 }
  }
};

// ----------------------------------------------------------------------------------
// §2 Validation — malformed or out-of-range input fails closed.
// ----------------------------------------------------------------------------------

function fail(detail: string): never {
  throw new VoiceFailureV0("VOICE_REQUEST_INVALID", detail);
}

function requireBounded(name: string, value: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail(`speech expression input ${name} must be a finite number, got ${String(value)}`);
  }
  if (value < min || value > max) {
    fail(`speech expression input ${name}=${value} is outside [${min}, ${max}]`);
  }
  return value;
}

/**
 * Inputs after normalization: identical to `SpeechExpressionInputsV0` except
 * that `familiarity` is resolved to a concrete number, so the projection body
 * never has to re-handle the "no counterpart known" case.
 */
export interface ResolvedSpeechExpressionInputsV0 extends SpeechExpressionInputsV0 {
  readonly familiarity: number;
}

/**
 * Validates and normalizes the read-only state inputs.
 *
 * Exported so callers can fail before doing any work, and so tests can assert
 * the rejection boundary directly.
 */
export function normalizeSpeechExpressionInputsV0(
  inputs: SpeechExpressionInputsV0,
  config: SpeechExpressionConfigV0 = DEFAULT_SPEECH_EXPRESSION_CONFIG_V0
): ResolvedSpeechExpressionInputsV0 {
  const valence = requireBounded("valence", inputs.valence, -1, 1);
  const activation = requireBounded("activation", inputs.activation, 0, 1);
  const energy = requireBounded("energy", inputs.energy, 0, 1);
  const stress = requireBounded("stress", inputs.stress, 0, 1);
  const arousal = requireBounded("arousal", inputs.arousal, 0, 1);
  const fatigue = requireBounded("fatigue", inputs.fatigue, 0, 1);
  const familiarity =
    inputs.familiarity === null
      ? config.default_familiarity
      : requireBounded("familiarity", inputs.familiarity, 0, 1);
  return { valence, activation, energy, stress, arousal, fatigue, familiarity };
}

// ----------------------------------------------------------------------------------
// §3 Bounded arithmetic — clamp, then round deterministically.
// ----------------------------------------------------------------------------------

/** Clamp to [0,1], normalizing `-0` so equal states cannot yield unequal values. */
export function clampUnitV0(value: number): number {
  const clamped = value < 0 ? 0 : value > 1 ? 1 : value;
  return clamped === 0 ? 0 : clamped;
}

/** Clamp to [-1,1], normalizing `-0`. */
export function clampSignedUnitV0(value: number): number {
  const clamped = value < -1 ? -1 : value > 1 ? 1 : value;
  return clamped === 0 ? 0 : clamped;
}

function roundTo(value: number, precision: number): number {
  const factor = 10 ** precision;
  const rounded = Math.round(value * factor) / factor;
  return rounded === 0 ? 0 : rounded;
}

/** Activation relative to the neutral point, rescaled to [-1, 1]. */
function activationDeviationV0(activation: number, config: SpeechExpressionConfigV0): number {
  return clampSignedUnitV0((activation - config.neutral_activation) / (1 - config.neutral_activation));
}

// ----------------------------------------------------------------------------------
// §4 Projection — the single pure entry point.
// ----------------------------------------------------------------------------------

/**
 * Projects read-only CharacterOS state into bounded speech presentation
 * parameters.
 *
 * Deterministic: the result depends only on `inputs` and `config`.
 */
export function projectSpeechExpressionV0(
  inputs: SpeechExpressionInputsV0,
  options?: {
    readonly config?: SpeechExpressionConfigV0;
    readonly state_revision?: number | null;
  }
): SpeechExpressionV0 {
  const config = options?.config ?? DEFAULT_SPEECH_EXPRESSION_CONFIG_V0;
  const normalized = normalizeSpeechExpressionInputsV0(inputs, config);
  const w = config.weights;

  const { valence, activation, energy, stress, fatigue, familiarity } = normalized;
  const da = activationDeviationV0(activation, config);
  const affectMagnitude = Math.abs(valence);
  const lowEnergy = 1 - energy;

  // Outward expressive energy. Negative valence does NOT by itself raise this:
  // a withdrawn subject and an agitated subject with the same valence separate
  // here through activation, stress and energy.
  const intensity = clampUnitV0(
    w.intensity.base +
      da * w.intensity.activation +
      stress * w.intensity.stress +
      fatigue * w.intensity.fatigue +
      affectMagnitude * w.intensity.affect_magnitude +
      (energy - config.neutral_activation) * 2 * w.intensity.energy
  );

  // Interpersonal softness: valence carries through, stress erodes it, and
  // familiarity adds closeness.
  const warmth = clampUnitV0(
    w.warmth.base +
      valence * w.warmth.valence +
      (1 - stress) * w.warmth.stress +
      familiarity * w.warmth.familiarity
  );

  const certainty = clampUnitV0(
    w.certainty.base +
      energy * w.certainty.energy +
      activation * w.certainty.activation +
      valence * w.certainty.valence -
      stress * w.certainty.stress -
      fatigue * w.certainty.fatigue
  );

  const hesitation = clampUnitV0(
    w.hesitation.base +
      stress * w.hesitation.stress +
      fatigue * w.hesitation.fatigue +
      lowEnergy * w.hesitation.low_energy -
      activation * w.hesitation.activation
  );

  const speakingRate = clampSignedUnitV0(
    da * w.speaking_rate.activation +
      (energy - config.neutral_activation) * 2 * w.speaking_rate.energy -
      fatigue * w.speaking_rate.fatigue
  );

  const volume = clampSignedUnitV0(
    da * w.volume.activation + (intensity - config.neutral_activation) * w.volume.intensity
  );

  const pauseBias = clampUnitV0(
    w.pause_bias.base +
      fatigue * w.pause_bias.fatigue +
      (1 - activation) * w.pause_bias.low_activation -
      energy * w.pause_bias.energy
  );

  const expressiveness = clampUnitV0(
    intensity * w.expressiveness.intensity + activation * w.expressiveness.activation
  );

  const assertiveness = clampUnitV0(
    energy * w.assertiveness.energy +
      stress * w.assertiveness.stress +
      activation * w.assertiveness.activation -
      fatigue * w.assertiveness.fatigue
  );

  const p = config.precision;
  return {
    schema_version: SPEECH_EXPRESSION_SCHEMA_VERSION,
    valence: roundTo(valence, p),
    activation: roundTo(activation, p),
    intensity: roundTo(intensity, p),
    warmth: roundTo(warmth, p),
    certainty: roundTo(certainty, p),
    hesitation: roundTo(hesitation, p),
    speaking_rate: roundTo(speakingRate, p),
    volume: roundTo(volume, p),
    pause_bias: roundTo(pauseBias, p),
    expressiveness: roundTo(expressiveness, p),
    assertiveness: roundTo(assertiveness, p),
    provenance: {
      projection_id: SPEECH_EXPRESSION_PROJECTION_ID,
      config_id: config.config_id,
      state_revision: options?.state_revision ?? null,
      inputs: normalized
    }
  };
}

/**
 * Stable comparison key for an expression's audible content.
 *
 * Used by tests and diagnostics to assert that two states produce genuinely
 * different delivery; `provenance` is excluded so a revision change alone does
 * not count as a difference.
 */
export function speechExpressionFingerprintV0(expression: SpeechExpressionV0): string {
  return [
    expression.valence,
    expression.activation,
    expression.intensity,
    expression.warmth,
    expression.certainty,
    expression.hesitation,
    expression.speaking_rate,
    expression.volume,
    expression.pause_bias,
    expression.expressiveness,
    expression.assertiveness
  ].join("|");
}
