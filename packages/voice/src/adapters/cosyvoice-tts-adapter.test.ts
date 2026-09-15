/**
 * CHARACTEROS_COSYVOICE_TTS_ADAPTER_V0 — the expression → delivery-directive
 * mapping, and the guarantee that it never selects an emotion.
 *
 * The distinction this file protects: CharacterOS decides the subject's state,
 * so the voice must not be handed an emotion word to interpret. The directive is
 * built only from continuous DELIVERY parameters (tempo, loudness), and the
 * neutral expression must produce a directive with no delivery instruction at
 * all — that is the control condition every differential measurement relies on.
 */

import { describe, expect, it } from "vitest";

import {
  DEFAULT_COSYVOICE_INSTRUCTION_CONFIG_V0,
  DEFAULT_SPEECH_EXPRESSION_CONFIG_V0,
  DEFAULT_VOICE_RUNTIME_CONFIG_V0,
  VoiceRuntimeClientV0,
  CosyVoiceTtsAdapterV0,
  buildCosyVoiceInstructionV0,
  projectSpeechExpressionV0,
  type SpeechExpressionInputsV0,
  type VoiceRuntimeConfigV0
} from "../index.js";

const GENESIS = { energy: 1, stress: 0, arousal: 0.5, fatigue: 0 } as const;

function inputs(overrides: Partial<SpeechExpressionInputsV0>): SpeechExpressionInputsV0 {
  return { valence: 0, activation: 0.2, ...GENESIS, familiarity: null, ...overrides };
}

/**
 * Every phrase CosyVoice documents for emotion. The directive must never contain
 * one, because choosing an emotion word from a number is exactly the label
 * mapping the projection exists to avoid.
 */
const EMOTION_WORDS = ["开心", "伤心", "生气", "happy", "sad", "angry", "excited", "emotion"];

describe("expression -> CosyVoice directive", () => {
  it("emits no delivery directive for a neutral expression", () => {
    const expression = projectSpeechExpressionV0(inputs({ valence: 0, activation: 0.5 }));
    const instruct = buildCosyVoiceInstructionV0(expression);
    expect(instruct).toBe(
      `${DEFAULT_COSYVOICE_INSTRUCTION_CONFIG_V0.prefix}${DEFAULT_COSYVOICE_INSTRUCTION_CONFIG_V0.terminator}`
    );
  });

  it("is deterministic: the same expression always yields the same directive", () => {
    const expression = projectSpeechExpressionV0(inputs({ valence: -0.6, activation: 0.1 }));
    expect(buildCosyVoiceInstructionV0(expression)).toBe(buildCosyVoiceInstructionV0(expression));
  });

  it("never selects an emotion word, for any lawful state", () => {
    for (let valence = -1; valence <= 1.0001; valence += 0.25) {
      for (let activation = 0; activation <= 1.0001; activation += 0.25) {
        const expression = projectSpeechExpressionV0(inputs({ valence, activation }));
        const instruct = buildCosyVoiceInstructionV0(expression);
        for (const word of EMOTION_WORDS) {
          expect(instruct.toLowerCase()).not.toContain(word.toLowerCase());
        }
      }
    }
  });

  it("always terminates with the delimiter so the model sees a well-formed prompt", () => {
    for (const activation of [0, 0.35, 0.5, 0.65, 1]) {
      const expresssion = projectSpeechExpressionV0(inputs({ valence: -0.4, activation }));
      expect(buildCosyVoiceInstructionV0(expresssion).endsWith("<|endofprompt|>")).toBe(true);
    }
  });

  it("separates the withdrawn quadrant from the agitated quadrant in the directive", () => {
    const withdrawn = buildCosyVoiceInstructionV0(projectSpeechExpressionV0(inputs({ valence: -0.6, activation: 0.1 })));
    const agitated = buildCosyVoiceInstructionV0(projectSpeechExpressionV0(inputs({ valence: -0.6, activation: 0.9 })));
    expect(withdrawn).not.toBe(agitated);
    expect(withdrawn).toContain(DEFAULT_COSYVOICE_INSTRUCTION_CONFIG_V0.slow_directive);
    expect(withdrawn).toContain(DEFAULT_COSYVOICE_INSTRUCTION_CONFIG_V0.soft_directive);
    expect(agitated).toContain(DEFAULT_COSYVOICE_INSTRUCTION_CONFIG_V0.fast_directive);
    expect(agitated).toContain(DEFAULT_COSYVOICE_INSTRUCTION_CONFIG_V0.loud_directive);
  });
});

describe("adapter boundary", () => {
  it("reports the runtime as unavailable instead of throwing a raw network error", async () => {
    // Port 1 is reserved and never listening, so this is a real connection failure.
    const config: VoiceRuntimeConfigV0 = {
      ...DEFAULT_VOICE_RUNTIME_CONFIG_V0,
      base_url: "http://127.0.0.1:1",
      tts_timeout_ms: 2_000
    };
    const adapter = new CosyVoiceTtsAdapterV0({ client: new VoiceRuntimeClientV0(config) });
    const expression = projectSpeechExpressionV0(inputs({ valence: 0, activation: 0.5 }));
    await expect(
      adapter.synthesize({
        schema_version: "speech-output-request-v0",
        request_ref: "test",
        text: "你好。",
        language: "zh",
        voice_id: "characteros-default",
        expression,
        streaming: false
      })
    ).rejects.toMatchObject({ code: "VOICE_RUNTIME_UNAVAILABLE" });
  });

  it("rejects empty text before any transport call", async () => {
    const adapter = new CosyVoiceTtsAdapterV0({
      client: new VoiceRuntimeClientV0({
        ...DEFAULT_VOICE_RUNTIME_CONFIG_V0,
        base_url: "http://127.0.0.1:1",
        tts_timeout_ms: 2_000
      })
    });
    const expression = projectSpeechExpressionV0(inputs({}));
    await expect(
      adapter.synthesize({
        schema_version: "speech-output-request-v0",
        request_ref: "test",
        text: "   ",
        language: "zh",
        voice_id: "characteros-default",
        expression,
        streaming: false
      })
    ).rejects.toMatchObject({ code: "VOICE_REQUEST_INVALID" });
  });
});

// Keep the config import honest: the default config must remain a valid value.
describe("default instruction config", () => {
  it("uses the model's documented delimiter and thresholds inside [-1,1]", () => {
    expect(DEFAULT_COSYVOICE_INSTRUCTION_CONFIG_V0.terminator).toBe("<|endofprompt|>");
    expect(DEFAULT_COSYVOICE_INSTRUCTION_CONFIG_V0.rate_threshold).toBeGreaterThan(0);
    expect(DEFAULT_COSYVOICE_INSTRUCTION_CONFIG_V0.rate_threshold).toBeLessThanOrEqual(1);
    expect(DEFAULT_COSYVOICE_INSTRUCTION_CONFIG_V0.volume_threshold).toBeLessThanOrEqual(1);
    expect(DEFAULT_SPEECH_EXPRESSION_CONFIG_V0.precision).toBeGreaterThan(0);
  });
});
