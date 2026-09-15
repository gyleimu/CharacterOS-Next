/**
 * Counters that answer the only resource question that matters here:
 * "how often does this thing actually call the model, and what does each call
 * cost?" Every counter is honest — nothing is inferred, nothing is smoothed.
 */

import type { AttentionLevelV0, SourceMetricsV0, VisionSourceKindV0, VisionMetricsSnapshotV0 } from "./types.js";

interface MutableSourceMetricsV0 {
  frames_captured: number;
  frames_skipped_cadence: number;
  frames_dropped_no_change: number;
  frames_dropped_rate_limit: number;
  frames_dropped_superseded: number;
  frames_analyzed: number;
  capture_errors: number;
  restarts: number;
}

function emptySourceMetricsV0(): MutableSourceMetricsV0 {
  return {
    frames_captured: 0,
    frames_skipped_cadence: 0,
    frames_dropped_no_change: 0,
    frames_dropped_rate_limit: 0,
    frames_dropped_superseded: 0,
    frames_analyzed: 0,
    capture_errors: 0,
    restarts: 0
  };
}

export class VisionMetricsV0 {
  private readonly sources: Record<VisionSourceKindV0, MutableSourceMetricsV0> = {
    camera: emptySourceMetricsV0(),
    desktop: emptySourceMetricsV0()
  };
  private observationsEmitted = 0;
  private observationsDeduplicated = 0;
  private modelErrors = 0;
  private invalidModelOutputs = 0;
  private sinkErrors = 0;
  private inferenceCalls = 0;
  private latencySumMs = 0;
  private latencySamples = 0;
  private maxLatencyMs = 0;
  private lastLatencyMs: number | null = null;
  private startedAtMs = 0;

  markStarted(atMs: number): void {
    this.startedAtMs = atMs;
  }

  recordFrameCaptured(source: VisionSourceKindV0): void {
    this.sources[source].frames_captured += 1;
  }
  recordFrameSkippedCadence(source: VisionSourceKindV0): void {
    this.sources[source].frames_skipped_cadence += 1;
  }
  recordFrameDroppedNoChange(source: VisionSourceKindV0): void {
    this.sources[source].frames_dropped_no_change += 1;
  }
  recordFrameDroppedRateLimit(source: VisionSourceKindV0): void {
    this.sources[source].frames_dropped_rate_limit += 1;
  }
  recordFrameDroppedSuperseded(source: VisionSourceKindV0): void {
    this.sources[source].frames_dropped_superseded += 1;
  }
  recordFrameAnalyzed(source: VisionSourceKindV0): void {
    this.sources[source].frames_analyzed += 1;
  }
  recordCaptureError(source: VisionSourceKindV0): void {
    this.sources[source].capture_errors += 1;
  }
  recordRestart(source: VisionSourceKindV0): void {
    this.sources[source].restarts += 1;
  }
  recordObservationEmitted(): void {
    this.observationsEmitted += 1;
  }
  recordObservationDeduplicated(): void {
    this.observationsDeduplicated += 1;
  }
  recordModelError(): void {
    this.modelErrors += 1;
  }
  recordInvalidModelOutput(): void {
    this.invalidModelOutputs += 1;
  }
  recordSinkError(): void {
    this.sinkErrors += 1;
  }
  /** Records one COMPLETED model invocation (successful answers only). */
  recordInferenceLatency(latencyMs: number): void {
    this.inferenceCalls += 1;
    this.latencySumMs += latencyMs;
    this.latencySamples += 1;
    this.maxLatencyMs = Math.max(this.maxLatencyMs, latencyMs);
    this.lastLatencyMs = latencyMs;
  }
  recordInferenceCall(): void {
    this.inferenceCalls += 1;
  }

  snapshot(params: {
    readonly nowMs: number;
    readonly attention: AttentionLevelV0;
    readonly running: boolean;
    readonly enabled: Readonly<Record<VisionSourceKindV0, boolean>>;
    readonly active: Readonly<Record<VisionSourceKindV0, boolean>>;
  }): VisionMetricsSnapshotV0 {
    const uptime = Math.max(0, params.nowMs - this.startedAtMs);
    const minutes = uptime / 60000;
    const sourceView = (kind: VisionSourceKindV0): SourceMetricsV0 & { enabled: boolean; active: boolean } => ({
      ...this.sources[kind],
      enabled: params.enabled[kind],
      active: params.active[kind]
    });
    return {
      started_at: new Date(this.startedAtMs).toISOString(),
      uptime_ms: uptime,
      attention_level: params.attention,
      running: params.running,
      sources: { camera: sourceView("camera"), desktop: sourceView("desktop") },
      frames_captured: this.sources.camera.frames_captured + this.sources.desktop.frames_captured,
      frames_skipped_cadence:
        this.sources.camera.frames_skipped_cadence + this.sources.desktop.frames_skipped_cadence,
      frames_dropped_no_change:
        this.sources.camera.frames_dropped_no_change + this.sources.desktop.frames_dropped_no_change,
      frames_dropped_rate_limit:
        this.sources.camera.frames_dropped_rate_limit + this.sources.desktop.frames_dropped_rate_limit,
      frames_dropped_superseded:
        this.sources.camera.frames_dropped_superseded + this.sources.desktop.frames_dropped_superseded,
      frames_analyzed: this.sources.camera.frames_analyzed + this.sources.desktop.frames_analyzed,
      observations_emitted: this.observationsEmitted,
      observations_deduplicated: this.observationsDeduplicated,
      model_errors: this.modelErrors,
      invalid_model_outputs: this.invalidModelOutputs,
      sink_errors: this.sinkErrors,
      capture_errors: this.sources.camera.capture_errors + this.sources.desktop.capture_errors,
      inference_calls: this.inferenceCalls,
      average_inference_latency_ms:
        this.latencySamples === 0 ? 0 : Math.round((this.latencySumMs / this.latencySamples) * 10) / 10,
      max_inference_latency_ms: Math.round(this.maxLatencyMs),
      last_inference_latency_ms: this.lastLatencyMs,
      inference_calls_per_minute: minutes <= 0 ? 0 : Math.round((this.inferenceCalls / minutes) * 100) / 100
    };
  }
}
