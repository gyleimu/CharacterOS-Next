/**
 * CHARACTEROS_VOICE_SESSION_V0 — orchestration and, above all, DEGRADATION.
 *
 * The property under test is that a speech problem is never a turn problem:
 *
 *   TTS down / timed out / returned garbage  ⇒ the text turn still stands
 *   ASR down                                 ⇒ typed input still works
 *   microphone heard only silence            ⇒ no turn is created at all
 *
 * and that speech can always be interrupted without touching CharacterOS state
 * (by the time anything is spoken the turn has already committed).
 */

import { describe, expect, it, vi } from "vitest";

import {
  VoiceFailureV0,
  VoiceSessionV0,
  type SpeechExpressionInputsV0,
  type SpeechInputV0,
  type SpeechOutputRequestV0,
  type SpeechRecognitionResultV0,
  type SpeechSynthesisResultV0,
  type VoiceAsrAdapterV0,
  type VoiceSessionDepsV0,
  type VoiceSubjectPortV0,
  type VoiceTtsAdapterV0,
  type VoiceTurnResultV0
} from "./index.js";

const GENESIS = { energy: 1, stress: 0, arousal: 0.5, fatigue: 0 } as const;

class FakeSubject implements VoiceSubjectPortV0 {
  readonly submitted: string[] = [];
  constructor(
    private readonly inputs: SpeechExpressionInputsV0 = {
      valence: -0.2,
      activation: 0.3,
      ...GENESIS,
      familiarity: null
    },
    private readonly result: VoiceTurnResultV0 = {
      status: "COMPLETED",
      reply_text: "我记得你。",
      state_revision: 7,
      failure: null
    },
    private readonly inputsError: Error | null = null
  ) {}

  async readSpeechExpressionInputs(): Promise<SpeechExpressionInputsV0> {
    if (this.inputsError !== null) throw this.inputsError;
    return this.inputs;
  }

  async submitUserText(text: string): Promise<VoiceTurnResultV0> {
    this.submitted.push(text);
    return this.result;
  }
}

class FakeTts implements VoiceTtsAdapterV0 {
  readonly adapter_id = "test/tts";
  readonly calls: SpeechOutputRequestV0[] = [];
  cancelCount = 0;
  constructor(private readonly behaviour: "ok" | "unavailable" | "timeout" | "malformed" = "ok") {}

  private fail(): never {
    if (this.behaviour === "unavailable") {
      throw new VoiceFailureV0("VOICE_RUNTIME_UNAVAILABLE", "connection refused");
    }
    if (this.behaviour === "timeout") {
      throw new VoiceFailureV0("VOICE_RUNTIME_TIMEOUT", "no answer within 1000ms");
    }
    throw new VoiceFailureV0("VOICE_RUNTIME_MALFORMED", "response was not JSON");
  }

  async synthesize(request: SpeechOutputRequestV0): Promise<SpeechSynthesisResultV0> {
    this.calls.push(request);
    if (this.behaviour !== "ok") this.fail();
    return {
      adapter_id: this.adapter_id,
      voice_id: request.voice_id,
      sample_rate: 24000,
      audio_ms: 1200,
      total_ms: 4000,
      first_chunk_ms: null,
      rtf: 3.3,
      played: true,
      saved_path: null,
      audio: null,
      instruct: "test"
    };
  }

  async cancel(): Promise<void> {
    this.cancelCount += 1;
  }
}

class StreamingFakeTts extends FakeTts {
  streamCalls = 0;
  async synthesizeStream(): Promise<{
    sample_rate: number;
    chunks: number;
    bytes: number;
    audio_ms: number;
    ttfa_ms: number;
    total_ms: number;
    cancelled: boolean;
  }> {
    this.streamCalls += 1;
    return {
      sample_rate: 24000,
      chunks: 3,
      bytes: 96000,
      audio_ms: 2000,
      ttfa_ms: 4200,
      total_ms: 6000,
      cancelled: false
    };
  }
}

class FakeAsr implements VoiceAsrAdapterV0 {
  readonly adapter_id = "test/asr";
  listenCount = 0;
  constructor(private readonly outcome: SpeechRecognitionResultV0 | null = null) {}
  async transcribe(): Promise<SpeechRecognitionResultV0> {
    throw new VoiceFailureV0("VOICE_RUNTIME_UNAVAILABLE", "not used in these tests");
  }
  async listen(): Promise<SpeechRecognitionResultV0 | null> {
    this.listenCount += 1;
    return this.outcome;
  }
}

function recognized(text: string): SpeechRecognitionResultV0 {
  const input: SpeechInputV0 = {
    schema_version: "speech-input-v0",
    utterance_ref: "utterance:test",
    text,
    language: "zh",
    confidence: null,
    duration_ms: 1500,
    timestamps: null,
    observed_vocal_affect: { label: "HAPPY", event: "Speech", authoritative: false },
    source: "microphone"
  };
  return { adapter_id: "test/asr", input, latency_ms: 800 };
}

function session(deps: Partial<VoiceSessionDepsV0>, speak = true, streaming = false): VoiceSessionV0 {
  return new VoiceSessionV0(
    { voice_id: "characteros-default", language: "zh", speak, streaming },
    { subject: new FakeSubject(), ...deps }
  );
}

describe("a working spoken turn", () => {
  it("projects read-only state and speaks the reply", async () => {
    const tts = new FakeTts();
    const subject = new FakeSubject();
    const voice = new VoiceSessionV0(
      { voice_id: "characteros-default", language: "zh", speak: true, streaming: false },
      { subject, tts }
    );
    const turn = await voice.handleText("你好。");
    expect(subject.submitted).toEqual(["你好。"]);
    expect(turn.turn.status).toBe("COMPLETED");
    expect(turn.expression).not.toBeNull();
    expect(turn.expression?.provenance.state_revision).toBe(7);
    expect(turn.speech?.audio_ms).toBe(1200);
    expect(turn.speech_failure).toBeNull();
    // The synthesized text is the reply, unchanged — voice adds audio, not words.
    expect(tts.calls[0]?.text).toBe("我记得你。");
  });

  it("uses streaming when configured and supported", async () => {
    const tts = new StreamingFakeTts();
    const voice = session({ tts }, true, true);
    const turn = await voice.handleText("你好。");
    expect(tts.streamCalls).toBe(1);
    expect(turn.speech_stream?.ttfa_ms).toBe(4200);
    expect(turn.speech).toBeNull();
  });

  it("falls back to one-pass synthesis when the backend cannot stream", async () => {
    const tts = new FakeTts();
    const voice = session({ tts }, true, true);
    const turn = await voice.handleText("你好。");
    expect(turn.speech_stream).toBeNull();
    expect(turn.speech?.audio_ms).toBe(1200);
  });

  it("does not touch the speech channel when speaking is disabled", async () => {
    const tts = new FakeTts();
    const voice = session({ tts }, false, false);
    const turn = await voice.handleText("你好。");
    expect(turn.turn.status).toBe("COMPLETED");
    expect(turn.expression).toBeNull();
    expect(turn.speech).toBeNull();
    expect(tts.calls).toHaveLength(0);
  });
});

describe("degradation: speech failure is never turn failure", () => {
  for (const behaviour of ["unavailable", "timeout", "malformed"] as const) {
    it(`keeps the text turn valid when synthesis is ${behaviour}`, async () => {
      const voice = session({ tts: new FakeTts(behaviour) });
      const turn = await voice.handleText("你好。");
      expect(turn.turn.status).toBe("COMPLETED");
      expect(turn.turn.reply_text).toBe("我记得你。");
      expect(turn.speech).toBeNull();
      expect(turn.speech_failure).not.toBeNull();
      expect(turn.speech_failure?.code).toBe(
        behaviour === "unavailable"
          ? "VOICE_RUNTIME_UNAVAILABLE"
          : behaviour === "timeout"
            ? "VOICE_RUNTIME_TIMEOUT"
            : "VOICE_RUNTIME_MALFORMED"
      );
    });
  }

  it("records a projection failure as a speech failure, not a turn failure", async () => {
    const subject = new FakeSubject(
      { valence: 0, activation: 0.2, ...GENESIS, familiarity: null },
      { status: "COMPLETED", reply_text: "我记得你。", state_revision: 7, failure: null },
      new VoiceFailureV0("VOICE_REQUEST_INVALID", "activation outside [0,1]")
    );
    const voice = new VoiceSessionV0(
      { voice_id: "characteros-default", language: "zh", speak: true, streaming: false },
      { subject, tts: new FakeTts() }
    );
    const turn = await voice.handleText("你好。");
    expect(turn.turn.status).toBe("COMPLETED");
    expect(turn.expression).toBeNull();
    expect(turn.speech_failure?.code).toBe("VOICE_REQUEST_INVALID");
  });

  it("does not speak a failed turn", async () => {
    const subject = new FakeSubject(
      { valence: 0, activation: 0.2, ...GENESIS, familiarity: null },
      { status: "FAILED", reply_text: null, state_revision: 7, failure: "TURN_FAILED_CLOSED" }
    );
    const tts = new FakeTts();
    const voice = new VoiceSessionV0(
      { voice_id: "characteros-default", language: "zh", speak: true, streaming: false },
      { subject, tts }
    );
    const turn = await voice.handleText("你好。");
    expect(turn.turn.status).toBe("FAILED");
    expect(turn.expression).toBeNull();
    expect(turn.speech).toBeNull();
    expect(tts.calls).toHaveLength(0);
  });
});

describe("microphone path", () => {
  it("runs a turn from a recognized utterance", async () => {
    const asr = new FakeAsr(recognized("你还记得我吗？"));
    const subject = new FakeSubject();
    const voice = new VoiceSessionV0(
      { voice_id: "characteros-default", language: "zh", speak: true, streaming: false },
      { subject, asr, tts: new FakeTts() }
    );
    const turn = await voice.handleMicrophone();
    expect(turn).not.toBeNull();
    expect(subject.submitted).toEqual(["你还记得我吗？"]);
    expect(turn?.recognized?.input.text).toBe("你还记得我吗？");
    // SenseVoice's emotion label is carried as observation, never as subject state.
    expect(turn?.recognized?.input.observed_vocal_affect?.authoritative).toBe(false);
  });

  it("creates no turn when only silence was heard", async () => {
    const asr = new FakeAsr(null);
    const subject = new FakeSubject();
    const voice = new VoiceSessionV0(
      { voice_id: "characteros-default", language: "zh", speak: true, streaming: false },
      { subject, asr, tts: new FakeTts() }
    );
    expect(await voice.handleMicrophone()).toBeNull();
    expect(asr.listenCount).toBe(1);
    expect(subject.submitted).toHaveLength(0);
  });

  it("fails closed when the deployment cannot hear at all", async () => {
    const voice = session({ tts: new FakeTts() });
    expect(voice.canListen()).toBe(false);
    await expect(voice.handleMicrophone()).rejects.toMatchObject({ code: "VOICE_RUNTIME_UNAVAILABLE" });
  });
});

describe("interruption", () => {
  it("cancels in-flight speech through the adapter", async () => {
    const tts = new FakeTts();
    const voice = session({ tts });
    await voice.handleText("你好。");
    // Nothing is in flight after the turn, so cancellation must be a safe no-op
    // that still asks the runtime to stop its speaker.
    expect(voice.isSpeaking()).toBe(false);
    await voice.cancelSpeech();
    expect(tts.cancelCount).toBe(1);
  });

  it("aborts the outstanding request when speech is still in flight", async () => {
    let captured: AbortSignal | undefined;
    const tts = new FakeTts();
    const slow: VoiceTtsAdapterV0 = {
      adapter_id: "test/slow",
      async synthesize(request, options): Promise<SpeechSynthesisResultV0> {
        captured = options?.signal;
        await new Promise((resolve) => setTimeout(resolve, 50));
        return tts.synthesize(request);
      },
      async cancel(): Promise<void> {
        tts.cancelCount += 1;
      }
    };
    const voice = session({ tts: slow });
    const turn = voice.handleText("你好。");
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(voice.isSpeaking()).toBe(true);
    await voice.cancelSpeech();
    expect(captured?.aborted).toBe(true);
    expect(tts.cancelCount).toBe(1);
    await turn;
  });

  it("never throws when the runtime is already gone", async () => {
    const voice = session({ tts: new FakeTts("unavailable") });
    await expect(voice.cancelSpeech()).resolves.toBeUndefined();
  });
});

describe("observability", () => {
  it("reports capability from the assembled dependencies", () => {
    expect(session({}).canSpeak()).toBe(false);
    expect(session({ tts: new FakeTts() }).canSpeak()).toBe(true);
    expect(session({ asr: new FakeAsr(null) }).canListen()).toBe(true);
  });

  it("keeps speech failure visible without logging any canonical state", async () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const voice = session({ tts: new FakeTts("unavailable") });
    const turn = await voice.handleText("你好。");
    expect(turn.speech_failure?.message).toContain("connection refused");
    spy.mockRestore();
  });
});
