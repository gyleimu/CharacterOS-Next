import { describe, expect, it } from "vitest";
import type { FrameSourceCallbacksV0 } from "./capture/ffmpeg-source.js";
import { resolveVisionConfigV0, type VisionConfigV0 } from "./config.js";
import type { VisionInferenceOutcomeV0, VisionInferenceProviderV0 } from "./inference/provider.js";
import {
  VisionPerceptionV0,
  type FrameSourceFactoryV0,
  type FrameSourceV0
} from "./vision-perception.js";
import type {
  AttentionLevelV0,
  VisualObservationV0,
  VisionLogEventV0,
  VisionSinkOutcomeV0,
  VisionSourceKindV0
} from "./types.js";

const THUMB = 8;
const FRAME = Buffer.from([0xff, 0xd8, 1, 2, 0xff, 0xd9]);

function sourceAt(sources: readonly FakeFrameSource[], index: number): FakeFrameSource {
  const source = sources[index];
  if (source === undefined) throw new Error(`source ${index} was never created`);
  return source;
}

function firstOf<T>(values: readonly T[]): T {
  const value = values[0];
  if (value === undefined) throw new Error("expected at least one entry");
  return value;
}

class FakeFrameSource implements FrameSourceV0 {
  running = false;
  restartCount = 0;
  started = false;
  constructor(
    readonly kind: VisionSourceKindV0,
    private readonly callbacks: FrameSourceCallbacksV0
  ) {}
  async start(): Promise<{ ok: true }> {
    this.running = true;
    this.started = true;
    return { ok: true };
  }
  async stop(): Promise<void> {
    this.running = false;
  }
  async pause(): Promise<void> {
    this.running = false;
  }
  async resume(): Promise<void> {
    if (this.started) this.running = true;
  }
  thumbnail(capturedAtMs: number, fill: number): void {
    this.callbacks.onThumbnail({
      source: this.kind,
      gray: new Uint8Array(THUMB * THUMB).fill(fill),
      width: THUMB,
      height: THUMB,
      captured_at_ms: capturedAtMs
    });
  }
  still(receivedAtMs: number): void {
    this.callbacks.onStill({ source: this.kind, jpeg: FRAME, received_at_ms: receivedAtMs });
  }
}

class FakeProvider implements VisionInferenceProviderV0 {
  provider_id = "fake";
  model = "fake-model";
  responses: string[] = ["{\"description\":\"a scene\"}"];
  calls = 0;
  concurrent = 0;
  maxConcurrent = 0;
  releaseCalls = 0;
  error: VisionInferenceOutcomeV0 | null = null;
  gate: (() => Promise<void>) | null = null;
  requests: { source: VisionSourceKindV0; imageBytes: number }[] = [];

  async infer(request: { source: VisionSourceKindV0; image_jpeg_base64: string }): Promise<VisionInferenceOutcomeV0> {
    this.calls += 1;
    this.concurrent += 1;
    this.maxConcurrent = Math.max(this.maxConcurrent, this.concurrent);
    this.requests.push({ source: request.source, imageBytes: request.image_jpeg_base64.length });
    try {
      if (this.gate !== null) await this.gate();
      if (this.error !== null) return this.error;
      const text = this.responses.length > 1 ? (this.responses.shift() ?? "") : (this.responses[0] ?? "");
      return { kind: "OK", text, latency_ms: 7 };
    } finally {
      this.concurrent -= 1;
    }
  }
  async release(): Promise<void> {
    this.releaseCalls += 1;
  }
}

interface HarnessOptions {
  readonly attention?: AttentionLevelV0;
  readonly minInferenceIntervalMs?: number;
  readonly change?: { min_mean_abs_difference: number; min_hash_distance: number };
  readonly sink?: (observation: VisualObservationV0) => Promise<VisionSinkOutcomeV0>;
}

async function flush(rounds = 8): Promise<void> {
  for (let index = 0; index < rounds; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

function testConfig(options: HarnessOptions): VisionConfigV0 {
  const base = resolveVisionConfigV0({});
  const source = (streamFps: number): VisionConfigV0["camera"] => ({
    enabled: true,
    stream_fps: streamFps,
    still_fps: 1,
    min_inference_interval_ms: options.minInferenceIntervalMs ?? 0,
    device_index: 0,
    device_name: "Fake Camera",
    input_size: null,
    change: options.change ?? { min_mean_abs_difference: 0.02, min_hash_distance: 0.12 }
  });
  return {
    ...base,
    attention_level: options.attention ?? "NORMAL",
    thumb_width: THUMB,
    thumb_height: THUMB,
    camera: { ...source(1) },
    desktop: { ...source(2), region: null }
  };
}

function harness(options: HarnessOptions = {}): {
  perception: VisionPerceptionV0;
  sources: FakeFrameSource[];
  provider: FakeProvider;
  emitted: VisualObservationV0[];
  logs: VisionLogEventV0[];
  setNow: (value: number) => void;
} {
  const sources: FakeFrameSource[] = [];
  const provider = new FakeProvider();
  const emitted: VisualObservationV0[] = [];
  const logs: VisionLogEventV0[] = [];
  let nowMs = 0;
  const factory: FrameSourceFactoryV0 = (config, callbacks) => {
    const source = new FakeFrameSource(config.source, callbacks);
    sources.push(source);
    return source;
  };
  const sinkOverride = options.sink;
  const perception = new VisionPerceptionV0({
    config: testConfig(options),
    provider,
    now: () => nowMs,
    logger: (event) => logs.push(event),
    source_factory: factory,
    sink:
      sinkOverride === undefined
        ? {
            sink_id: "test",
            accept: async (observation) => {
              emitted.push(observation);
              return { kind: "ACCEPTED" };
            }
          }
        : {
            sink_id: "test",
            accept: async (observation) => {
              const outcome = await sinkOverride(observation);
              if (outcome.kind === "ACCEPTED") emitted.push(observation);
              return outcome;
            }
          }
  });
  return { perception, sources, provider, emitted, logs, setNow: (value) => (nowMs = value) };
}

describe("vision perception orchestration", () => {
  it("analyses the first frame of a source and emits exactly one observation", async () => {
    const { perception, sources, provider, emitted } = harness();
    await perception.start();
    expect(sources).toHaveLength(2);
    sourceAt(sources, 0).still(0);
    sourceAt(sources, 0).thumbnail(0, 100);
    await flush();
    expect(provider.calls).toBe(1);
    expect(emitted).toHaveLength(1);
    expect(firstOf(emitted).source).toBe("desktop");
    expect(firstOf(emitted).schema_version).toBe("visual-observation-v0");
    const metrics = perception.getMetrics();
    expect(metrics.frames_analyzed).toBe(1);
    expect(metrics.observations_emitted).toBe(1);
    await perception.stop();
  });

  it("drops an unchanged frame without calling the model", async () => {
    const { perception, sources, provider } = harness();
    await perception.start();
    sourceAt(sources, 0).still(0);
    sourceAt(sources, 0).thumbnail(0, 100);
    await flush();
    sourceAt(sources, 0).thumbnail(1000, 100);
    await flush();
    expect(provider.calls).toBe(1);
    expect(perception.getMetrics().frames_dropped_no_change).toBe(1);
    await perception.stop();
  });

  it("skips frames inside the attention cadence", async () => {
    const { perception, sources } = harness({ attention: "NORMAL" });
    await perception.start();
    sourceAt(sources, 0).still(0);
    sourceAt(sources, 0).thumbnail(0, 100);
    await flush();
    sourceAt(sources, 0).thumbnail(500, 220);
    await flush();
    expect(perception.getMetrics().frames_skipped_cadence).toBe(1);
    expect(perception.getMetrics().frames_analyzed).toBe(1);
    await perception.stop();
  });

  it("looks more often at FOCUSED and much less at IDLE", async () => {
    const focused = harness({ attention: "FOCUSED" });
    await focused.perception.start();
    sourceAt(focused.sources, 0).still(0);
    sourceAt(focused.sources, 0).thumbnail(0, 100);
    await flush();
    sourceAt(focused.sources, 0).thumbnail(500, 220);
    await flush();
    expect(focused.perception.getMetrics().frames_analyzed).toBe(2);

    const idle = harness({ attention: "IDLE" });
    await idle.perception.start();
    sourceAt(idle.sources, 0).still(0);
    sourceAt(idle.sources, 0).thumbnail(0, 100);
    await flush();
    sourceAt(idle.sources, 0).thumbnail(500, 220);
    await flush();
    expect(idle.perception.getMetrics().frames_analyzed).toBe(1);
    expect(idle.perception.getMetrics().frames_skipped_cadence).toBe(1);
    await focused.perception.stop();
    await idle.perception.stop();
  });

  it("honours the minimum inference interval and re-detects the change afterwards", async () => {
    const { perception, sources, provider } = harness({ minInferenceIntervalMs: 3000 });
    await perception.start();
    sourceAt(sources, 0).still(0);
    sourceAt(sources, 0).thumbnail(0, 100);
    await flush();
    expect(provider.calls).toBe(1);

    sourceAt(sources, 0).thumbnail(1000, 240);
    await flush();
    sourceAt(sources, 0).thumbnail(2000, 240);
    await flush();
    expect(provider.calls).toBe(1);
    expect(perception.getMetrics().frames_dropped_rate_limit).toBe(2);

    sourceAt(sources, 0).thumbnail(3000, 240);
    await flush();
    expect(provider.calls).toBe(2);
    await perception.stop();
  });

  it("keeps only the newest pending still and never runs two model calls at once", async () => {
    const { perception, sources, provider } = harness();
    let release: () => void = () => undefined;
    provider.gate = () =>
      new Promise<void>((resolve) => {
        release = resolve;
      });
    await perception.start();
    sourceAt(sources, 0).still(0);
    sourceAt(sources, 0).thumbnail(0, 100);
    await flush();
    // The cadence is respected, so these arrive as three separate decisions
    // while the single model call is still in flight.
    sourceAt(sources, 0).thumbnail(1000, 200);
    sourceAt(sources, 0).thumbnail(2000, 240);
    await flush();
    release();
    await flush();
    provider.gate = null;
    expect(provider.maxConcurrent).toBe(1);
    expect(provider.calls).toBe(2);
    expect(perception.getMetrics().frames_dropped_superseded).toBe(1);
    await perception.stop();
  });

  it("serves both sources through the same single-flight model", async () => {
    const { perception, sources, provider, emitted } = harness();
    provider.responses = ['{"description":"desktop view"}', '{"description":"a person is present"}'];
    await perception.start();
    sourceAt(sources, 0).still(0);
    sourceAt(sources, 0).thumbnail(0, 100);
    sourceAt(sources, 1).still(0);
    sourceAt(sources, 1).thumbnail(0, 50);
    await flush();
    expect(provider.maxConcurrent).toBe(1);
    expect(provider.calls).toBe(2);
    expect(emitted.map((entry) => entry.source).sort()).toEqual(["camera", "desktop"]);
    const metrics = perception.getMetrics();
    expect(metrics.sources.desktop.frames_analyzed).toBe(1);
    expect(metrics.sources.camera.frames_analyzed).toBe(1);
    await perception.stop();
  });

  it("drops a malformed model answer as INVALID_MODEL_OUTPUT", async () => {
    const { perception, sources, provider, emitted, logs } = harness();
    provider.responses = ["I think the user is sitting at the desk."];
    await perception.start();
    sourceAt(sources, 0).still(0);
    sourceAt(sources, 0).thumbnail(0, 100);
    await flush();
    expect(emitted).toHaveLength(0);
    expect(perception.getMetrics().invalid_model_outputs).toBe(1);
    expect(perception.getMetrics().model_errors).toBe(0);
    expect(logs.some((entry) => entry.code === "INVALID_MODEL_OUTPUT")).toBe(true);
    await perception.stop();
  });

  it("counts a model error and retries the same change on a later frame", async () => {
    const { perception, sources, provider } = harness({ minInferenceIntervalMs: 3000 });
    provider.error = { kind: "ERROR", code: "MODEL_TIMEOUT", detail: "slow", latency_ms: 60000 };
    await perception.start();
    sourceAt(sources, 0).still(0);
    sourceAt(sources, 0).thumbnail(0, 100);
    await flush();
    expect(perception.getMetrics().model_errors).toBe(1);

    provider.error = null;
    provider.responses = ['{"description":"recovered"}'];
    sourceAt(sources, 0).thumbnail(3000, 100);
    await flush();
    expect(provider.calls).toBe(2);
    expect(perception.getMetrics().observations_emitted).toBe(1);
    await perception.stop();
  });

  it("deduplicates a repeated description instead of re-emitting it", async () => {
    const { perception, sources, provider, emitted } = harness({ minInferenceIntervalMs: 0 });
    provider.responses = ['{"description":"A person is sitting at the desk looking at the monitor."}'];
    await perception.start();
    sourceAt(sources, 0).still(0);
    sourceAt(sources, 0).thumbnail(0, 100);
    await flush();
    sourceAt(sources, 0).still(1000);
    sourceAt(sources, 0).thumbnail(1000, 240);
    await flush();
    expect(provider.calls).toBe(2);
    expect(emitted).toHaveLength(1);
    expect(perception.getMetrics().observations_deduplicated).toBe(1);
    await perception.stop();
  });

  it("reports a rejected sink and does not treat the observation as delivered", async () => {
    let rejectNext = true;
    const { perception, sources, provider, emitted } = harness({
      sink: async () => {
        if (rejectNext) return { kind: "REJECTED", detail: "canonical conflict" };
        return { kind: "ACCEPTED" };
      }
    });
    provider.responses = ['{"description":"A person is present."}'];
    await perception.start();
    sourceAt(sources, 0).still(0);
    sourceAt(sources, 0).thumbnail(0, 100);
    await flush();
    expect(perception.getMetrics().sink_errors).toBe(1);
    expect(perception.getMetrics().observations_emitted).toBe(0);
    expect(emitted).toHaveLength(0);

    rejectNext = false;
    sourceAt(sources, 0).still(1000);
    sourceAt(sources, 0).thumbnail(1000, 240);
    await flush();
    expect(perception.getMetrics().observations_emitted).toBe(1);
    await perception.stop();
  });

  it("stops capture, releases the model, and ignores late frames", async () => {
    const { perception, sources, provider } = harness();
    await perception.start();
    sourceAt(sources, 0).still(0);
    sourceAt(sources, 0).thumbnail(0, 100);
    await flush();
    await perception.stop();
    expect(provider.releaseCalls).toBe(1);
    expect(sources.every((source) => !source.running)).toBe(true);
    const callsAfterStop = provider.calls;
    sourceAt(sources, 0).still(1000);
    sourceAt(sources, 0).thumbnail(1000, 240);
    await flush();
    expect(provider.calls).toBe(callsAfterStop);
    expect(perception.getMetrics().running).toBe(false);
  });

  it("pauses capture without unloading the model and resumes afterwards", async () => {
    const { perception, sources, provider } = harness();
    await perception.start();
    await perception.pause();
    expect(sources.every((source) => !source.running)).toBe(true);
    expect(provider.releaseCalls).toBe(0);
    sourceAt(sources, 0).thumbnail(0, 100);
    await flush();
    expect(provider.calls).toBe(0);
    await perception.resume();
    expect(sources.every((source) => source.running)).toBe(true);
    sourceAt(sources, 0).still(0);
    sourceAt(sources, 0).thumbnail(0, 100);
    await flush();
    expect(provider.calls).toBe(1);
    await perception.stop();
  });

  it("requests the prompt for the right source", async () => {
    const { perception, sources, provider } = harness();
    provider.responses = ['{"description":"a"}', '{"description":"b"}'];
    await perception.start();
    sourceAt(sources, 1).still(0);
    sourceAt(sources, 1).thumbnail(0, 40);
    await flush();
    expect(firstOf(provider.requests).source).toBe("camera");
    expect(firstOf(provider.requests).imageBytes).toBeGreaterThan(0);
    await perception.stop();
  });
});

describe("V-01 — stop() / in-flight inference race", () => {
  /** A sink that records every delivery attempt, including rejected ones. */
  function countingHarness(): {
    perception: VisionPerceptionV0;
    sources: FakeFrameSource[];
    provider: FakeProvider;
    accepted: VisualObservationV0[];
    attempted: VisualObservationV0[];
    logs: VisionLogEventV0[];
    release: () => void;
    gateOpen: () => void;
  } {
    const sources: FakeFrameSource[] = [];
    const provider = new FakeProvider();
    const accepted: VisualObservationV0[] = [];
    const attempted: VisualObservationV0[] = [];
    const logs: VisionLogEventV0[] = [];
    let release: () => void = () => undefined;
    provider.gate = () =>
      new Promise<void>((resolve) => {
        release = resolve;
      });
    const factory: FrameSourceFactoryV0 = (config, callbacks) => {
      const source = new FakeFrameSource(config.source, callbacks);
      sources.push(source);
      return source;
    };
    const perception = new VisionPerceptionV0({
      config: testConfig({}),
      provider,
      now: () => 0,
      logger: (event) => logs.push(event),
      source_factory: factory,
      sink: {
        sink_id: "counting",
        accept: async (observation) => {
          attempted.push(observation);
          accepted.push(observation);
          return { kind: "ACCEPTED" };
        }
      }
    });
    const gateOpen = (): void => {
      provider.gate = null;
    };
    return { perception, sources, provider, accepted, attempted, logs, release: () => release(), gateOpen };
  }

  it("A: a model answer that arrives after stop() never reaches the sink", async () => {
    const test = countingHarness();
    await test.perception.start();
    sourceAt(test.sources, 0).still(0);
    sourceAt(test.sources, 0).thumbnail(0, 100);
    await flush();
    expect(test.provider.calls).toBe(1);

    // stop() begins while the model call is still unresolved.
    const stopping = test.perception.stop();
    await flush();
    // The model answers only now — after shutdown has begun.
    test.release();
    await stopping;
    await flush();

    expect(test.attempted).toHaveLength(0);
    expect(test.accepted).toHaveLength(0);
    const metrics = test.perception.getMetrics();
    expect(metrics.observations_emitted).toBe(0);
    expect(metrics.frames_dropped_stale_run).toBe(1);
    expect(test.logs.some((entry) => entry.code === "ANALYSIS_DROPPED_STALE_RUN")).toBe(true);
    expect(test.logs.some((entry) => entry.code === "OBSERVATION_EMITTED")).toBe(false);
  });

  it("A: no OBSERVATION_EMITTED is ever logged after VISION_STOPPED", () => {
    const test = countingHarness();
    return (async () => {
      await test.perception.start();
      sourceAt(test.sources, 0).still(0);
      sourceAt(test.sources, 0).thumbnail(0, 100);
      await flush();
      const stopping = test.perception.stop();
      await flush();
      test.release();
      await stopping;
      await flush();
      const codes = test.logs.map((entry) => entry.code);
      const stoppedAt = codes.lastIndexOf("VISION_STOPPED");
      const lastEmitAt = codes.lastIndexOf("OBSERVATION_EMITTED");
      expect(stoppedAt).toBeGreaterThanOrEqual(0);
      expect(lastEmitAt).toBeLessThan(stoppedAt);
      const stopRequestedAt = codes.indexOf("STOP_REQUESTED");
      expect(stopRequestedAt).toBeGreaterThanOrEqual(0);
      expect(stopRequestedAt).toBeLessThan(stoppedAt);
    })();
  });

  it("B: the camera source obeys the same rule as the desktop source", async () => {
    const test = countingHarness();
    await test.perception.start();
    // sources[1] is the camera: same state machine, different source.
    sourceAt(test.sources, 1).still(0);
    sourceAt(test.sources, 1).thumbnail(0, 60);
    await flush();
    expect(firstOf(test.provider.requests).source).toBe("camera");
    const stopping = test.perception.stop();
    await flush();
    test.release();
    await stopping;
    await flush();
    expect(test.attempted).toHaveLength(0);
    expect(test.perception.getMetrics().sources.camera.frames_dropped_stale_run).toBe(1);
  });

  it("B: a pending frame is dropped when stop() begins, not analysed later", async () => {
    const test = countingHarness();
    await test.perception.start();
    sourceAt(test.sources, 0).still(0);
    sourceAt(test.sources, 0).thumbnail(0, 100);
    await flush();
    // A second decision is queued behind the in-flight model call.
    sourceAt(test.sources, 0).thumbnail(1000, 200);
    await flush();
    const stopping = test.perception.stop();
    await flush();
    test.release();
    await stopping;
    await flush();
    // Only the first (in-flight) call happened; the queued frame died with stop.
    expect(test.provider.calls).toBe(1);
    expect(test.attempted).toHaveLength(0);
  });

  it("C: without stop() the same flow still delivers exactly once", async () => {
    const test = countingHarness();
    await test.perception.start();
    sourceAt(test.sources, 0).still(0);
    sourceAt(test.sources, 0).thumbnail(0, 100);
    await flush();
    test.release();
    await flush();
    expect(test.accepted).toHaveLength(1);
    expect(test.attempted).toHaveLength(1);
    expect(test.perception.getMetrics().observations_emitted).toBe(1);
    expect(test.perception.getMetrics().frames_dropped_stale_run).toBe(0);
    await test.perception.stop();
  });
});
