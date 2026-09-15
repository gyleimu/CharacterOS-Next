/**
 * CHARACTEROS_SPEECH_EXPRESSION_PROJECTION_V0 — behaviour tests.
 *
 * Two different guarantees are tested here, and it matters that they are not
 * confused:
 *
 *   1. CharacterOS state -> SpeechExpression  MUST be deterministic and exact.
 *      Same state, same config ⇒ identical expression, always.
 *
 *   2. SpeechExpression -> waveform is NOT required to be deterministic.
 *      Neural TTS is allowed to vary between runs; that is a property of the
 *      model, not of CharacterOS, and nothing here asserts on audio.
 *
 * The differential tests are the ones that matter most: they pin the claim that
 * DIFFERENT CHARACTEROS STATES PRODUCE DIFFERENT DELIVERY, and they pin it
 * directionally (slower, softer, more pausing) rather than by golden numbers.
 */

import { describe, expect, it } from "vitest";

import {
  DEFAULT_SPEECH_EXPRESSION_CONFIG_V0,
  projectSpeechExpressionV0,
  speechExpressionFingerprintV0,
  normalizeSpeechExpressionInputsV0,
  type SpeechExpressionConfigV0,
  type SpeechExpressionInputsV0
} from "./index.js";
import { VoiceFailureV0 } from "./contracts.js";

/**
 * Regulation at subject genesis, read from the real seed
 * (`createInteractiveSubjectSeedV0`) rather than assumed:
 * energy 1, stress 0, arousal 0.5, fatigue 0.
 */
const GENESIS_REGULATION = {
  energy: 1,
  stress: 0,
  arousal: 0.5,
  fatigue: 0
} as const;

function inputs(overrides: Partial<SpeechExpressionInputsV0>): SpeechExpressionInputsV0 {
  return {
    valence: 0,
    activation: 0.2,
    ...GENESIS_REGULATION,
    familiarity: null,
    ...overrides
  };
}

const LOW_LOW = inputs({ valence: -0.6, activation: 0.1 });
const LOW_HIGH = inputs({ valence: -0.6, activation: 0.9 });
const HIGH_LOW = inputs({ valence: 0.6, activation: 0.1 });
const HIGH_HIGH = inputs({ valence: 0.6, activation: 0.9 });

describe("determinism (state -> expression)", () => {
  it("produces an identical expression for an identical state", () => {
    const first = projectSpeechExpressionV0(LOW_LOW);
    const second = projectSpeechExpressionV0(LOW_LOW);
    expect(second).toEqual(first);
    expect(speechExpressionFingerprintV0(second)).toBe(speechExpressionFingerprintV0(first));
  });

  it("is stable across many repeats (no hidden randomness)", () => {
    const fingerprints = new Set(
      Array.from({ length: 50 }, () => speechExpressionFingerprintV0(projectSpeechExpressionV0(LOW_HIGH)))
    );
    expect(fingerprints.size).toBe(1);
  });

  it("records the exact normalized inputs and config identity in provenance", () => {
    const expression = projectSpeechExpressionV0(inputs({ valence: -0.25, activation: 0.4, familiarity: 0.75 }), {
      state_revision: 42
    });
    expect(expression.provenance.projection_id).toBe("characteros-next/voice/speech-expression/v0");
    expect(expression.provenance.config_id).toBe(DEFAULT_SPEECH_EXPRESSION_CONFIG_V0.config_id);
    expect(expression.provenance.state_revision).toBe(42);
    expect(expression.provenance.inputs).toEqual({
      valence: -0.25,
      activation: 0.4,
      energy: 1,
      stress: 0,
      arousal: 0.5,
      fatigue: 0,
      familiarity: 0.75
    });
  });

  it("resolves an unknown counterpart to the configured default familiarity", () => {
    const expression = projectSpeechExpressionV0(inputs({ familiarity: null }));
    expect(expression.provenance.inputs.familiarity).toBe(
      DEFAULT_SPEECH_EXPRESSION_CONFIG_V0.default_familiarity
    );
  });

  it("changes when the config changes, and says which config it used", () => {
    const custom: SpeechExpressionConfigV0 = {
      ...DEFAULT_SPEECH_EXPRESSION_CONFIG_V0,
      config_id: "test-config",
      weights: { ...DEFAULT_SPEECH_EXPRESSION_CONFIG_V0.weights, volume: { activation: 0.1, intensity: 0.1 } }
    };
    const base = projectSpeechExpressionV0(LOW_HIGH);
    const altered = projectSpeechExpressionV0(LOW_HIGH, { config: custom });
    expect(altered.volume).not.toBe(base.volume);
    expect(altered.provenance.config_id).toBe("test-config");
  });
});

describe("differential projection (the causal claim)", () => {
  it("separates low-activation from high-activation at the same valence", () => {
    const calm = projectSpeechExpressionV0(LOW_LOW);
    const agitated = projectSpeechExpressionV0(LOW_HIGH);

    // The four properties a listener actually hears.
    expect(calm.speaking_rate).toBeLessThan(agitated.speaking_rate);
    expect(calm.volume).toBeLessThan(agitated.volume);
    expect(calm.pause_bias).toBeGreaterThan(agitated.pause_bias);
    expect(calm.intensity).toBeLessThan(agitated.intensity);
    expect(calm.expressiveness).toBeLessThan(agitated.expressiveness);
    expect(calm.assertiveness).toBeLessThan(agitated.assertiveness);
  });

  it("makes the withdrawn state slower and softer than neutral, not merely different", () => {
    const neutral = projectSpeechExpressionV0(inputs({ valence: 0, activation: 0.5 }));
    const withdrawn = projectSpeechExpressionV0(LOW_LOW);
    expect(withdrawn.speaking_rate).toBeLessThan(0);
    expect(withdrawn.volume).toBeLessThan(0);
    expect(withdrawn.intensity).toBeLessThan(neutral.intensity);
  });

  it("carries valence through as warmth without disturbing tempo", () => {
    const cold = projectSpeechExpressionV0(LOW_LOW);
    const warm = projectSpeechExpressionV0(HIGH_LOW);
    // Same activation ⇒ same tempo and loudness...
    expect(warm.speaking_rate).toBe(cold.speaking_rate);
    expect(warm.volume).toBe(cold.volume);
    // ...but a genuinely different interpersonal colour.
    expect(warm.warmth).toBeGreaterThan(cold.warmth);
  });

  it("gives all four affect quadrants a distinct expression", () => {
    const fingerprints = [LOW_LOW, LOW_HIGH, HIGH_LOW, HIGH_HIGH].map((state) =>
      speechExpressionFingerprintV0(projectSpeechExpressionV0(state))
    );
    expect(new Set(fingerprints).size).toBe(4);
  });

  it("never emits an emotion label — the expression is purely parametric", () => {
    const expression = projectSpeechExpressionV0(LOW_HIGH);
    expect(Object.keys(expression).sort()).toEqual(
      [
        "activation",
        "assertiveness",
        "certainty",
        "expressiveness",
        "hesitation",
        "intensity",
        "pause_bias",
        "provenance",
        "schema_version",
        "speaking_rate",
        "valence",
        "volume",
        "warmth"
      ].sort()
    );
  });
});

describe("bounds", () => {
  it("clamps outputs to their declared ranges at extreme lawful inputs", () => {
    const extremes: SpeechExpressionInputsV0[] = [
      inputs({ valence: -1, activation: 0 }),
      inputs({ valence: 1, activation: 1 }),
      inputs({ valence: -1, activation: 1, energy: 1, stress: 1, fatigue: 1, arousal: 1 }),
      inputs({ valence: 1, activation: 0, energy: 0, stress: 1, fatigue: 1, arousal: 0 })
    ];
    for (const state of extremes) {
      const expression = projectSpeechExpressionV0(state);
      for (const unit of [
        expression.intensity,
        expression.warmth,
        expression.certainty,
        expression.hesitation,
        expression.pause_bias,
        expression.expressiveness,
        expression.assertiveness
      ]) {
        expect(unit).toBeGreaterThanOrEqual(0);
        expect(unit).toBeLessThanOrEqual(1);
      }
      for (const signed of [expression.speaking_rate, expression.volume]) {
        expect(signed).toBeGreaterThanOrEqual(-1);
        expect(signed).toBeLessThanOrEqual(1);
      }
    }
  });

  it("normalizes -0 so equal states cannot produce unequal values", () => {
    const expression = projectSpeechExpressionV0(inputs({ valence: 0, activation: 0.5 }));
    expect(Object.is(expression.speaking_rate, -0)).toBe(false);
    expect(Object.is(expression.volume, -0)).toBe(false);
    expect(Object.is(expression.valence, -0)).toBe(false);
  });
});

describe("fail-closed input validation", () => {
  const invalid: Array<[string, Partial<SpeechExpressionInputsV0>]> = [
    ["valence above 1", { valence: 1.5 }],
    ["valence below -1", { valence: -1.01 }],
    ["activation above 1", { activation: 1.2 }],
    ["activation below 0", { activation: -0.1 }],
    ["energy above 1", { energy: 2 }],
    ["stress below 0", { stress: -0.5 }],
    ["fatigue NaN", { fatigue: Number.NaN }],
    ["arousal Infinity", { arousal: Number.POSITIVE_INFINITY }],
    ["familiarity above 1", { familiarity: 1.5 }]
  ];

  for (const [name, override] of invalid) {
    it(`rejects ${name} rather than clamping it`, () => {
      expect(() => projectSpeechExpressionV0(inputs(override))).toThrow(VoiceFailureV0);
      try {
        projectSpeechExpressionV0(inputs(override));
      } catch (error) {
        expect(error).toBeInstanceOf(VoiceFailureV0);
        expect((error as VoiceFailureV0).code).toBe("VOICE_REQUEST_INVALID");
      }
    });
  }

  it("accepts exact boundary values", () => {
    expect(() => normalizeSpeechExpressionInputsV0(inputs({ valence: 1, activation: 0 }))).not.toThrow();
    expect(() => normalizeSpeechExpressionInputsV0(inputs({ valence: -1, activation: 1 }))).not.toThrow();
  });
});
