/**
 * CHARACTEROS_SPEECH_QUEUE_V0 — ordered, cancellable segment delivery.
 *
 * The properties worth protecting:
 *   - segments are spoken in the order they were written, never reordered;
 *   - an interruption drops the segments that have not started rather than
 *     letting a long reply play to the end;
 *   - one bad segment does not swallow the rest of the reply;
 *   - the queue is not a parallel prefetcher, because the runtime serializes
 *     synthesis behind a single lock (asserted below by observing that no two
 *     requests overlap).
 */

import { describe, expect, it } from "vitest";

import {
  VoiceFailureV0,
  projectSpeechExpressionV0,
  SpeechQueueV0,
  type SpeechExpressionInputsV0,
  type SpeechOutputRequestV0,
  type SpeechSynthesisResultV0,
  type VoiceTtsAdapterV0
} from "./index.js";

const GENESIS = { energy: 1, stress: 0, arousal: 0.5, fatigue: 0 } as const;

function expression() {
  const inputs: SpeechExpressionInputsV0 = {
    valence: -0.2,
    activation: 0.3,
    ...GENESIS,
    familiarity: null
  };
  return projectSpeechExpressionV0(inputs);
}

/** Records every dispatch, and can be made slow, failing, or abortable. */
class FakeTts implements VoiceTtsAdapterV0 {
  readonly adapter_id = "test/tts";
  readonly dispatched: string[] = [];
  cancelCount = 0;
  /** Highest number of overlapping dispatches observed. */
  peakConcurrency = 0;
  private active = 0;

  constructor(private readonly behaviour: "ok" | "fail-second" = "ok") {}

  private async track<T>(request: SpeechOutputRequestV0, produce: () => Promise<T>): Promise<T> {
    this.active += 1;
    this.peakConcurrency = Math.max(this.peakConcurrency, this.active);
    this.dispatched.push(request.text);
    try {
      return await produce();
    } finally {
      this.active -= 1;
    }
  }

  async synthesize(request: SpeechOutputRequestV0): Promise<SpeechSynthesisResultV0> {
    return await this.track(request, async () => {
      if (this.behaviour === "fail-second" && this.dispatched.length === 2) {
        throw new VoiceFailureV0("VOICE_RUNTIME_REJECTED", "segment rejected");
      }
      await new Promise((resolve) => setTimeout(resolve, 5));
      return {
        adapter_id: this.adapter_id,
        voice_id: request.voice_id,
        sample_rate: 24000,
        audio_ms: 500,
        total_ms: 20,
        first_chunk_ms: null,
        rtf: 0.04,
        played: true,
        saved_path: null,
        audio: null,
        instruct: "test"
      };
    });
  }

  async cancel(): Promise<void> {
    this.cancelCount += 1;
  }
}

function queue(tts: VoiceTtsAdapterV0, streaming = false) {
  return new SpeechQueueV0(
    { voice_id: "characteros-default", language: "zh", streaming },
    { tts }
  );
}

describe("ordering", () => {
  it("speaks every segment exactly once, in order", async () => {
    const tts = new FakeTts();
    const result = await queue(tts).enqueue("一。二。三。", expression());
    expect(tts.dispatched).toEqual(["一。", "二。", "三。"]);
    expect(result.segments.map((s) => s.index)).toEqual([0, 1, 2]);
    expect(result.segments.every((s) => !s.skipped)).toBe(true);
  });

  it("never overlaps dispatches, because the runtime serializes synthesis", async () => {
    const tts = new FakeTts();
    await queue(tts).enqueue("一。二。三。四。", expression());
    expect(tts.peakConcurrency).toBe(1);
  });

  it("reports the first audio time", async () => {
    const tts = new FakeTts();
    const result = await queue(tts).enqueue("一。二。", expression());
    expect(result.first_audio_ms).not.toBeNull();
    expect(result.first_audio_ms as number).toBeGreaterThanOrEqual(0);
  });

  it("handles a single-sentence reply", async () => {
    const tts = new FakeTts();
    const result = await queue(tts).enqueue("我没事。", expression());
    expect(tts.dispatched).toEqual(["我没事。"]);
    expect(result.cancelled).toBe(false);
  });

  it("does nothing for empty text", async () => {
    const tts = new FakeTts();
    const result = await queue(tts).enqueue("   ", expression());
    expect(tts.dispatched).toEqual([]);
    expect(result.segments).toEqual([]);
  });
});

describe("cancellation", () => {
  it("drops the segments that have not started", async () => {
    const tts = new FakeTts();
    // A slow first segment gives the cancel a chance to land mid-reply.
    const slow: VoiceTtsAdapterV0 = {
      adapter_id: "test/slow",
      async synthesize(request) {
        tts.dispatched.push(request.text);
        await new Promise((resolve) => setTimeout(resolve, 60));
        return {
          adapter_id: "test/slow",
          voice_id: request.voice_id,
          sample_rate: 24000,
          audio_ms: 500,
          total_ms: 60,
          first_chunk_ms: null,
          rtf: 0.12,
          played: true,
          saved_path: null,
          audio: null,
          instruct: "test"
        };
      },
      async cancel() {
        tts.cancelCount += 1;
      }
    };
    const speech = queue(slow);
    const pending = speech.enqueue("一。二。三。四。", expression());
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(speech.isSpeaking()).toBe(true);
    await speech.cancel();
    const result = await pending;
    expect(result.cancelled).toBe(true);
    expect(tts.cancelCount).toBe(1);
    // Whatever was not dispatched is reported as skipped, not silently lost.
    expect(result.segments.some((s) => s.skipped)).toBe(true);
    expect(result.segments.length).toBe(4);
  });

  it("is safe to cancel when nothing is queued", async () => {
    const tts = new FakeTts();
    const speech = queue(tts);
    await expect(speech.cancel()).resolves.toBeUndefined();
    expect(speech.isSpeaking()).toBe(false);
  });
});

describe("failure isolation", () => {
  it("keeps speaking the remaining segments after one fails", async () => {
    const tts = new FakeTts("fail-second");
    const result = await queue(tts).enqueue("一。二。三。", expression());
    expect(tts.dispatched).toEqual(["一。", "二。", "三。"]);
    const failed = result.segments.filter((s) => s.failure !== null);
    expect(failed).toHaveLength(1);
    expect(failed[0]?.index).toBe(1);
    expect(failed[0]?.failure?.code).toBe("VOICE_RUNTIME_REJECTED");
    // The third segment still played.
    expect(result.segments[2]?.failure).toBeNull();
    expect(result.cancelled).toBe(false);
  });
});

describe("observability", () => {
  it("exposes the segments a reply would be spoken as", () => {
    const speech = queue(new FakeTts());
    expect(speech.segmentsFor("我没事。你呢？").map((s) => s.text)).toEqual(["我没事。", "你呢？"]);
  });

  it("reports progress through the segment callbacks", async () => {
    const started: number[] = [];
    const completed: number[] = [];
    const tts = new FakeTts();
    const speech = new SpeechQueueV0(
      { voice_id: "v", language: "zh", streaming: false },
      {
        tts,
        onSegmentStart: (segment) => started.push(segment.index),
        onSegmentComplete: (result) => completed.push(result.index)
      }
    );
    await speech.enqueue("一。二。", expression());
    expect(started).toEqual([0, 1]);
    expect(completed).toEqual([0, 1]);
  });

  it("leaves the queue idle after the reply", async () => {
    const speech = queue(new FakeTts());
    await speech.enqueue("一。二。", expression());
    expect(speech.isSpeaking()).toBe(false);
    expect(speech.pendingSegments()).toBe(0);
  });
});

describe("streaming path", () => {
  it("uses streamed synthesis when the backend supports it", async () => {
    const calls: string[] = [];
    const tts: VoiceTtsAdapterV0 = {
      adapter_id: "test/streaming",
      async synthesize() {
        throw new Error("one-pass synthesis should not be used when streaming is available");
      },
      async synthesizeStream(request) {
        calls.push(request.text);
        return {
          sample_rate: 24000,
          chunks: 2,
          bytes: 9600,
          audio_ms: 200,
          ttfa_ms: 400,
          total_ms: 900,
          cancelled: false
        };
      }
    };
    const result = await queue(tts, true).enqueue("一。二。", expression());
    expect(calls).toEqual(["一。", "二。"]);
    expect(result.first_audio_ms).toBe(400);
    expect(result.segments.every((s) => s.stream !== null)).toBe(true);
  });
});
