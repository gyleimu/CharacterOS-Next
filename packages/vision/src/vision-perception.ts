/**
 * VisionPerception — the whole adapter in one place.
 *
 *   capture (per source) → change detection → [rate limit] → latest-wins pending
 *   → ONE model call at a time → strict validation → dedupe → observation sink
 *
 * Invariants this class owns:
 *   - attention changes the LOOK cadence only; it can never relax the minimum
 *     inference interval or the single-flight model rule;
 *   - at most ONE still is pending per source and the newest still always wins;
 *   - the change reference advances only after a still has actually been looked
 *     at, so a rate-limited or failed analysis is re-detected instead of lost;
 *   - a malformed model answer is dropped as INVALID_MODEL_OUTPUT, never coerced;
 *   - no image bytes ever reach the log, the metrics, or the disk (unless the
 *     debug flag explicitly asks for stills to be saved).
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { assessFrameChangeV0, fingerprintGrayV0, roundChangeScoreV0, type FrameFingerprintV0 } from "./change-detection.js";
import {
  FfmpegFrameSourceV0,
  type FrameSourceCallbacksV0,
  type FrameSourceConfigV0,
  type FrameSourceStartResultV0,
  type StillFrameV0,
  type ThumbnailFrameV0
} from "./capture/ffmpeg-source.js";
import { listDshowVideoDevicesV0 } from "./capture/dshow-devices.js";
import { resolveVisionConfigV0, type VisionConfigV0 } from "./config.js";
import { ObservationDedupeRingV0, observationDedupeKeyV0, observationTokensV0 } from "./dedupe.js";
import { createOllamaVisionProviderV0 } from "./inference/ollama-provider.js";
import { createOpenAiCompatibleVisionProviderV0 } from "./inference/openai-compatible-provider.js";
import type { VisionInferenceProviderV0 } from "./inference/provider.js";
import { VisionMetricsV0 } from "./metrics.js";
import { buildVisualObservationV0, parseModelObservationV0 } from "./observation.js";
import {
  ATTENTION_CADENCE_MS_V0,
  type AttentionLevelV0,
  type VisualObservationV0,
  type VisionErrorCodeV0,
  type VisionLogEventV0,
  type VisionLoggerV0,
  type VisionMetricsSnapshotV0,
  type VisionObservationSinkV0,
  type VisionSourceKindV0
} from "./types.js";

export interface FrameSourceV0 {
  readonly running: boolean;
  readonly restartCount: number;
  start(): Promise<FrameSourceStartResultV0>;
  stop(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
}

export type FrameSourceFactoryV0 = (
  config: FrameSourceConfigV0,
  callbacks: FrameSourceCallbacksV0,
  now: () => number
) => FrameSourceV0;

export interface VisionPerceptionDepsV0 {
  readonly config?: VisionConfigV0 | undefined;
  readonly environment?: Readonly<Record<string, string | undefined>> | undefined;
  /** Where accepted observations go. `null` runs the adapter without a consumer. */
  readonly sink?: VisionObservationSinkV0 | null | undefined;
  readonly logger?: VisionLoggerV0 | undefined;
  readonly now?: (() => number) | undefined;
  /** Test seams — production leaves both undefined. */
  readonly provider?: VisionInferenceProviderV0 | undefined;
  readonly source_factory?: FrameSourceFactoryV0 | undefined;
}

export interface VisionStartResultV0 {
  readonly started: readonly VisionSourceKindV0[];
  readonly failed: readonly { readonly source: VisionSourceKindV0; readonly code: VisionErrorCodeV0; readonly detail: string }[];
}

interface PendingAnalysisV0 {
  readonly source: VisionSourceKindV0;
  readonly still: StillFrameV0;
  readonly fingerprint: FrameFingerprintV0;
  readonly change_score: number;
  readonly decided_at_ms: number;
}

interface SourceRuntimeV0 {
  readonly source: FrameSourceV0;
  readonly dedupe: ObservationDedupeRingV0;
  active: boolean;
  reference: FrameFingerprintV0 | null;
  last_evaluation_ms: number;
  last_decision_ms: number;
  pending: PendingAnalysisV0 | null;
  latest_still: StillFrameV0 | null;
}

/** The default logger: one compact JSON line, structural fields only. */
export function createStreamVisionLoggerV0(write: (line: string) => void): VisionLoggerV0 {
  return (event: VisionLogEventV0) => {
    write(JSON.stringify(event));
  };
}

export class VisionPerceptionV0 {
  private readonly config: VisionConfigV0;
  private readonly sink: VisionObservationSinkV0 | null;
  private readonly log: VisionLoggerV0;
  private readonly now: () => number;
  private readonly provider: VisionInferenceProviderV0;
  private readonly sourceFactory: FrameSourceFactoryV0;
  private readonly metrics = new VisionMetricsV0();
  private readonly runtimes: Partial<Record<VisionSourceKindV0, SourceRuntimeV0>> = {};
  private running = false;
  private paused = false;
  private busy = false;
  private attention: AttentionLevelV0;

  constructor(deps: VisionPerceptionDepsV0 = {}) {
    this.config = deps.config ?? resolveVisionConfigV0(deps.environment ?? {});
    this.sink = deps.sink ?? null;
    this.log =
      deps.logger ?? createStreamVisionLoggerV0((line) => process.stderr.write(`${line}\n`));
    this.now = deps.now ?? (() => Date.now());
    this.attention = this.config.attention_level;
    this.provider =
      deps.provider ??
      (this.config.inference.provider === "openai-compatible"
        ? createOpenAiCompatibleVisionProviderV0({
            endpoint: this.config.inference.endpoint,
            model: this.config.inference.model,
            timeout_ms: this.config.inference.timeout_ms,
            max_tokens: this.config.inference.num_predict,
            api_key: this.config.inference.api_key
          })
        : createOllamaVisionProviderV0({
            endpoint: this.config.inference.endpoint,
            model: this.config.inference.model,
            timeout_ms: this.config.inference.timeout_ms,
            num_predict: this.config.inference.num_predict,
            keep_alive: this.config.inference.keep_alive,
            think: this.config.inference.think
          }));
    this.sourceFactory = deps.source_factory ?? ((config, callbacks, now) => new FfmpegFrameSourceV0(config, callbacks, now));
  }

  get runningState(): boolean {
    return this.running;
  }

  getAttentionLevel(): AttentionLevelV0 {
    return this.attention;
  }

  /**
   * Capture cadence only. The model is still gated by change detection, the
   * minimum inference interval and single-flight backpressure.
   */
  setAttentionLevel(level: AttentionLevelV0): void {
    if (this.attention === level) return;
    this.attention = level;
    this.emitLog({ level: "info", code: "ATTENTION_CHANGED", detail: level });
  }

  getMetrics(): VisionMetricsSnapshotV0 {
    return this.metrics.snapshot({
      nowMs: this.now(),
      attention: this.attention,
      running: this.running,
      enabled: { camera: this.config.camera.enabled, desktop: this.config.desktop.enabled },
      active: { camera: this.runtimes.camera?.active === true, desktop: this.runtimes.desktop?.active === true }
    });
  }

  /** Starts every enabled source. A source that cannot start is reported, not fatal. */
  async start(): Promise<VisionStartResultV0> {
    if (this.running) return { started: [], failed: [] };
    this.running = true;
    this.paused = false;
    this.metrics.markStarted(this.now());
    const started: VisionSourceKindV0[] = [];
    const failed: { source: VisionSourceKindV0; code: VisionErrorCodeV0; detail: string }[] = [];
    if (!this.config.enabled) {
      this.emitLog({ level: "info", code: "VISION_STOPPED", detail: "vision is disabled by configuration" });
      this.running = false;
      return { started, failed };
    }
    this.emitLog({ level: "info", code: "VISION_STARTED", detail: this.provider.provider_id });
    for (const kind of ["desktop", "camera"] as const) {
      if (!this.sourceConfig(kind).enabled) continue;
      const result = await this.startSource(kind);
      if (result.ok) started.push(kind);
      else {
        failed.push({ source: kind, code: result.code, detail: result.detail });
        this.metrics.recordCaptureError(kind);
        this.emitLog({ level: "error", code: result.code, source: kind, detail: result.detail });
      }
    }
    return { started, failed };
  }

  /** Releases the capture devices AND the model. Nothing keeps running. */
  async stop(): Promise<void> {
    if (!this.running && Object.keys(this.runtimes).length === 0) return;
    this.running = false;
    for (const kind of ["camera", "desktop"] as const) {
      const runtime = this.runtimes[kind];
      if (runtime === undefined) continue;
      await runtime.source.stop();
      runtime.active = false;
      runtime.pending = null;
      runtime.latest_still = null;
      this.emitLog({ level: "info", code: "SOURCE_STOPPED", source: kind });
    }
    delete this.runtimes.camera;
    delete this.runtimes.desktop;
    await this.provider.release().catch(() => undefined);
    this.emitLog({ level: "info", code: "MODEL_RELEASED" });
    this.emitLog({ level: "info", code: "VISION_STOPPED" });
  }

  /** Stops looking (releases the webcam) while keeping the model resident. */
  async pause(): Promise<void> {
    if (!this.running || this.paused) return;
    this.paused = true;
    for (const kind of ["camera", "desktop"] as const) {
      await this.runtimes[kind]?.source.pause();
    }
    this.emitLog({ level: "info", code: "VISION_PAUSED", detail: "capture suspended" });
  }

  async resume(): Promise<void> {
    if (!this.running || !this.paused) return;
    this.paused = false;
    for (const kind of ["camera", "desktop"] as const) {
      await this.runtimes[kind]?.source.resume();
    }
    this.emitLog({ level: "info", code: "VISION_RESUMED", detail: "capture resumed" });
  }

  private sourceConfig(kind: VisionSourceKindV0): VisionConfigV0["camera"] | VisionConfigV0["desktop"] {
    return kind === "camera" ? this.config.camera : this.config.desktop;
  }

  private async startSource(kind: VisionSourceKindV0): Promise<FrameSourceStartResultV0> {
    let deviceName: string | null = null;
    if (kind === "camera") {
      if (this.config.camera.device_name !== null) deviceName = this.config.camera.device_name;
      else {
        const enumerated = await listDshowVideoDevicesV0(this.config.ffmpeg_path);
        if (!enumerated.ok) {
          return { ok: false, code: "FFMPEG_NOT_FOUND", detail: enumerated.detail };
        }
        const device = enumerated.devices[this.config.camera.device_index];
        if (device === undefined) {
          return {
            ok: false,
            code: "CAMERA_DEVICE_NOT_FOUND",
            detail: `device_index ${this.config.camera.device_index} does not exist (${enumerated.devices.length} video devices found)`
          };
        }
        deviceName = device.name;
      }
    }
    const callbacks: FrameSourceCallbacksV0 = {
      onThumbnail: (frame) => this.onThumbnail(frame),
      onStill: (frame) => this.onStill(frame),
      onDiagnostic: (event) => {
        this.metrics.recordCaptureError(kind);
        if (!event.fatal) this.metrics.recordRestart(kind);
        this.emitLog({ level: event.fatal ? "error" : "warn", code: event.code, source: kind, detail: event.detail });
        if (event.fatal) {
          const runtime = this.runtimes[kind];
          if (runtime !== undefined) runtime.active = false;
        }
      }
    };
    const sourceConfig: FrameSourceConfigV0 = {
      source: kind,
      ffmpeg_path: this.config.ffmpeg_path,
      stream_fps: this.sourceConfig(kind).stream_fps,
      still_fps: this.sourceConfig(kind).still_fps,
      analysis_width: this.config.analysis_width,
      thumb_width: this.config.thumb_width,
      thumb_height: this.config.thumb_height,
      camera_device_name: deviceName,
      camera_input_size: kind === "camera" ? this.config.camera.input_size : null,
      desktop_region: kind === "desktop" ? this.config.desktop.region : null,
      restart_backoff_ms: this.config.restart_backoff_ms,
      max_restarts: this.config.max_restarts,
      stable_after_ms: this.config.stable_after_ms
    };
    const source = this.sourceFactory(sourceConfig, callbacks, this.now);
    const result = await source.start();
    if (!result.ok) {
      await source.stop().catch(() => undefined);
      return result;
    }
    this.runtimes[kind] = {
      source,
      dedupe: new ObservationDedupeRingV0(this.config.dedupe_history),
      active: true,
      reference: null,
      // The first frame of a source must never be throttled by a zero start.
      last_evaluation_ms: Number.NEGATIVE_INFINITY,
      last_decision_ms: Number.NEGATIVE_INFINITY,
      pending: null,
      latest_still: null
    };
    this.emitLog({ level: "info", code: "SOURCE_STARTED", source: kind, detail: deviceName ?? "primary desktop" });
    return { ok: true };
  }

  private onStill(frame: StillFrameV0): void {
    const runtime = this.runtimes[frame.source];
    if (runtime === undefined || !this.running || this.paused) return;
    runtime.latest_still = frame;
  }

  private onThumbnail(frame: ThumbnailFrameV0): void {
    const runtime = this.runtimes[frame.source];
    if (runtime === undefined) return;
    this.metrics.recordFrameCaptured(frame.source);
    if (!this.running || this.paused || !runtime.active) return;

    const cadence = ATTENTION_CADENCE_MS_V0[this.attention][frame.source];
    if (frame.captured_at_ms - runtime.last_evaluation_ms < cadence) {
      this.metrics.recordFrameSkippedCadence(frame.source);
      return;
    }
    runtime.last_evaluation_ms = frame.captured_at_ms;

    const fingerprint = fingerprintGrayV0(frame.gray, frame.width, frame.height);
    const assessment = assessFrameChangeV0(runtime.reference, fingerprint, this.sourceConfig(frame.source).change);
    if (!assessment.significant) {
      this.metrics.recordFrameDroppedNoChange(frame.source);
      return;
    }
    const config = this.sourceConfig(frame.source);
    if (frame.captured_at_ms - runtime.last_decision_ms < config.min_inference_interval_ms) {
      // The change stays un-analyzed: the reference deliberately does NOT advance,
      // so the next cadence tick re-detects it once the interval has elapsed.
      this.metrics.recordFrameDroppedRateLimit(frame.source);
      return;
    }
    const still = runtime.latest_still;
    if (still === null) {
      // Startup transient: the thumbnail stream runs faster than the still
      // stream, so the very first ticks can decide before any still exists. The
      // change is NOT lost — the reference does not advance, so it is
      // re-detected on the next tick.
      this.metrics.recordFrameDroppedNoStill(frame.source);
      this.emitLog({
        level: "info",
        code: "STILL_PENDING",
        source: frame.source,
        detail: "waiting for the first full-resolution still"
      });
      return;
    }
    runtime.last_decision_ms = frame.captured_at_ms;
    if (runtime.pending !== null) this.metrics.recordFrameDroppedSuperseded(frame.source);
    runtime.pending = {
      source: frame.source,
      still,
      fingerprint,
      change_score: assessment.mean_abs_difference,
      decided_at_ms: frame.captured_at_ms
    };
    void this.pump();
  }

  /** Single-flight drain: the newest pending still of the oldest source wins. */
  private async pump(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      for (;;) {
        const next = this.takeOldestPending();
        if (next === null) break;
        await this.analyze(next);
      }
    } finally {
      this.busy = false;
    }
  }

  private takeOldestPending(): PendingAnalysisV0 | null {
    let chosen: PendingAnalysisV0 | null = null;
    for (const kind of ["desktop", "camera"] as const) {
      const pending = this.runtimes[kind]?.pending ?? null;
      if (pending === null) continue;
      if (chosen === null || pending.decided_at_ms < chosen.decided_at_ms) chosen = pending;
    }
    if (chosen === null) return null;
    const runtime = this.runtimes[chosen.source];
    if (runtime !== undefined) runtime.pending = null;
    return chosen;
  }

  private async analyze(pending: PendingAnalysisV0): Promise<void> {
    const runtime = this.runtimes[pending.source];
    this.metrics.recordFrameAnalyzed(pending.source);
    this.emitLog({
      level: "info",
      code: "ANALYSIS_STARTED",
      source: pending.source,
      change_score: roundChangeScoreV0(pending.change_score)
    });
    await this.maybeSaveDebugFrame(pending);
    const outcome = await this.provider.infer({
      source: pending.source,
      image_jpeg_base64: pending.still.jpeg.toString("base64")
    });
    if (outcome.kind === "ERROR") {
      // The model never actually looked at this frame, so the change reference
      // deliberately does NOT advance: the same change is retried on a later
      // frame, still bounded by the minimum inference interval.
      this.metrics.recordModelError();
      this.emitLog({
        level: "error",
        code: outcome.code,
        source: pending.source,
        detail: outcome.detail,
        latency_ms: outcome.latency_ms,
        change_score: roundChangeScoreV0(pending.change_score)
      });
      return;
    }
    // The model answered (well or badly), so this frame has been looked at.
    // A malformed answer advances the reference too: re-asking a deterministic
    // model about an identical still would only produce the same garbage.
    if (runtime !== undefined) runtime.reference = pending.fingerprint;
    this.metrics.recordInferenceLatency(outcome.latency_ms);
    const parsed = parseModelObservationV0(outcome.text, this.config.observation_limits);
    if (parsed.kind === "INVALID") {
      this.metrics.recordInvalidModelOutput();
      this.emitLog({
        level: "error",
        code: "INVALID_MODEL_OUTPUT",
        source: pending.source,
        detail: parsed.detail,
        latency_ms: outcome.latency_ms,
        change_score: roundChangeScoreV0(pending.change_score)
      });
      return;
    }
    const observation = await buildVisualObservationV0({
      source: pending.source,
      observation: parsed.observation,
      captured_at_ms: pending.still.received_at_ms,
      frame_jpeg: pending.still.jpeg,
      clock: (atMs) => new Date(atMs).toISOString()
    });
    const tokens = observationTokensV0(observation.description);
    const decision = runtime?.dedupe.inspect(observationDedupeKeyV0(observation), tokens);
    if (decision?.duplicate === true) {
      this.metrics.recordObservationDeduplicated();
      this.emitLog({
        level: "info",
        code: "OBSERVATION_DEDUPLICATED",
        source: pending.source,
        observation_id: observation.observation_id,
        detail: decision.exact ? "identical description" : `restated scene (similarity ${decision.similarity})`,
        latency_ms: outcome.latency_ms,
        change_score: roundChangeScoreV0(pending.change_score)
      });
      return;
    }
    const delivered = await this.deliver(observation, pending, outcome.latency_ms);
    if (delivered && runtime !== undefined) runtime.dedupe.record(observationDedupeKeyV0(observation), tokens);
  }

  private async deliver(
    observation: VisualObservationV0,
    pending: PendingAnalysisV0,
    latencyMs: number
  ): Promise<boolean> {
    if (this.sink === null) {
      this.metrics.recordObservationEmitted();
      this.emitLog({
        level: "info",
        code: "OBSERVATION_EMITTED",
        source: pending.source,
        observation_id: observation.observation_id,
        latency_ms: latencyMs,
        change_score: roundChangeScoreV0(pending.change_score)
      });
      return true;
    }
    try {
      const outcome = await this.sink.accept(observation);
      if (outcome.kind === "REJECTED") {
        this.metrics.recordSinkError();
        this.emitLog({
          level: "error",
          code: "SINK_FAILED",
          source: pending.source,
          observation_id: observation.observation_id,
          detail: outcome.detail
        });
        return false;
      }
      this.metrics.recordObservationEmitted();
      this.emitLog({
        level: "info",
        code: "OBSERVATION_EMITTED",
        source: pending.source,
        observation_id: observation.observation_id,
        latency_ms: latencyMs,
        change_score: roundChangeScoreV0(pending.change_score)
      });
      return true;
    } catch (error) {
      this.metrics.recordSinkError();
      this.emitLog({
        level: "error",
        code: "SINK_FAILED",
        source: pending.source,
        observation_id: observation.observation_id,
        detail: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /** The ONLY code path that can write a still to disk, and only when asked. */
  private async maybeSaveDebugFrame(pending: PendingAnalysisV0): Promise<void> {
    if (!this.config.debug_save_frames) return;
    try {
      await mkdir(this.config.debug_frames_dir, { recursive: true });
      const name = `${pending.source}-${new Date(pending.still.received_at_ms).toISOString().replace(/[:.]/gu, "-")}.jpg`;
      await writeFile(join(this.config.debug_frames_dir, name), pending.still.jpeg);
    } catch {
      // Debug capture is best-effort and never affects perception.
    }
  }

  private emitLog(event: Omit<VisionLogEventV0, "timestamp">): void {
    this.log({ timestamp: new Date(this.now()).toISOString(), ...event });
  }
}
