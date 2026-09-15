/**
 * VISUAL_PERCEPTION_ADAPTER_V0 — the vision adapter's public vocabulary.
 *
 * The adapter turns periodic camera/desktop stills into ONE bounded, validated,
 * deduplicated `VisualObservationV0`. It reports OBSERVED FACTS only: it never
 * emits emotion, belief, memory, relationship, personality, desire or action —
 * those remain the cognition layer's job behind the existing CharacterOS input
 * boundary.
 */

export const VISUAL_OBSERVATION_SCHEMA_VERSION = "visual-observation-v0" as const;

/** The two independent visual sources. They never share a queue or a cadence. */
export type VisionSourceKindV0 = "camera" | "desktop";

/**
 * Capture cadence presets. Attention NEVER relaxes the minimum inference
 * interval or the backpressure rules — it only raises/lowers how often a still
 * is *looked at*.
 */
export type AttentionLevelV0 = "IDLE" | "NORMAL" | "FOCUSED";

export const ATTENTION_LEVELS_V0: readonly AttentionLevelV0[] = ["IDLE", "NORMAL", "FOCUSED"];

/** Per-attention still-sampling cadence, in milliseconds. */
export const ATTENTION_CADENCE_MS_V0: Readonly<Record<AttentionLevelV0, Readonly<Record<VisionSourceKindV0, number>>>> = {
  IDLE: { desktop: 5000, camera: 10000 },
  NORMAL: { desktop: 1000, camera: 2000 },
  FOCUSED: { desktop: 500, camera: 1000 }
};

/** One observed entity. Type is a coarse category, never an identity database. */
export interface VisualEntityV0 {
  readonly type: string;
  readonly description: string;
  readonly confidence?: number;
}

/**
 * The unified structured observation. `schema_version` follows repository
 * convention (snake_case literal) rather than the camelCase sketch.
 */
export interface VisualObservationV0 {
  readonly schema_version: typeof VISUAL_OBSERVATION_SCHEMA_VERSION;
  readonly observation_id: string;
  readonly timestamp: string;
  readonly source: VisionSourceKindV0;
  readonly description: string;
  readonly confidence?: number;
  readonly entities?: readonly VisualEntityV0[];
  readonly activities?: readonly string[];
  readonly visible_text?: readonly string[];
  readonly notable_events?: readonly string[];
  readonly uncertainty?: readonly string[];
  /** Desktop-only: the application the still is dominated by, when legible. */
  readonly application?: string;
  /** Content address of the analysed still (`sha256:<hex>`); never the image. */
  readonly frame_ref?: string;
}

/**
 * Every failure this adapter can report. `INVALID_MODEL_OUTPUT` is deliberately
 * distinct: a malformed model payload is dropped, logged and NEVER silently
 * degraded into natural language or a partial observation.
 */
export type VisionErrorCodeV0 =
  | "FFMPEG_NOT_FOUND"
  | "CAMERA_DEVICE_NOT_FOUND"
  | "CAMERA_DEVICE_UNAVAILABLE"
  | "CAPTURE_FAILED"
  | "CAPTURE_STOPPED"
  | "DECODE_FAILED"
  | "MODEL_UNAVAILABLE"
  | "MODEL_TIMEOUT"
  | "MODEL_REQUEST_FAILED"
  | "INVALID_MODEL_OUTPUT"
  | "SINK_FAILED"
  | "SOURCE_DISABLED"
  | "VISION_NOT_RUNNING";

/**
 * The ONLY diagnostic surface. Field set is closed on purpose: no image bytes,
 * no screenshot content, no observation descriptions, no telemetry endpoint.
 */
export interface VisionLogEventV0 {
  readonly timestamp: string;
  readonly level: "info" | "warn" | "error";
  readonly code:
    | VisionErrorCodeV0
    | "OBSERVATION_EMITTED"
    | "OBSERVATION_DEDUPLICATED"
    | "ANALYSIS_STARTED"
    | "SOURCE_STARTED"
    | "SOURCE_STOPPED"
    | "VISION_STARTED"
    | "VISION_STOPPED"
    | "VISION_PAUSED"
    | "VISION_RESUMED"
    | "ATTENTION_CHANGED"
    | "MODEL_RELEASED";
  readonly source?: VisionSourceKindV0;
  readonly detail?: string;
  readonly observation_id?: string;
  readonly latency_ms?: number;
  readonly change_score?: number;
}

export type VisionLoggerV0 = (event: VisionLogEventV0) => void;

/** Structural, content-free diagnostics for a capture error. */
export interface VisionCaptureDiagnosticsV0 {
  readonly exit_code: number | null;
  readonly stderr_tail: string;
}

/** The destination of an accepted observation (the CharacterOS input boundary). */
export interface VisionObservationSinkV0 {
  readonly sink_id: string;
  accept(observation: VisualObservationV0): Promise<VisionSinkOutcomeV0>;
}

export type VisionSinkOutcomeV0 =
  | { readonly kind: "ACCEPTED"; readonly detail?: string }
  | { readonly kind: "REJECTED"; readonly detail: string };

/** One captured still, before or after change detection. */
export interface CapturedFrameV0 {
  readonly source: VisionSourceKindV0;
  readonly jpeg: Buffer;
  readonly captured_at_ms: number;
  readonly sequence: number;
}

export interface SourceMetricsV0 {
  readonly frames_captured: number;
  readonly frames_skipped_cadence: number;
  readonly frames_dropped_no_change: number;
  readonly frames_dropped_rate_limit: number;
  readonly frames_dropped_superseded: number;
  readonly frames_analyzed: number;
  readonly capture_errors: number;
  readonly restarts: number;
}

export interface VisionMetricsSnapshotV0 {
  readonly started_at: string;
  readonly uptime_ms: number;
  readonly attention_level: AttentionLevelV0;
  readonly running: boolean;
  readonly sources: Readonly<Record<VisionSourceKindV0, SourceMetricsV0 & { readonly enabled: boolean; readonly active: boolean }>>;
  readonly frames_captured: number;
  readonly frames_skipped_cadence: number;
  readonly frames_dropped_no_change: number;
  readonly frames_dropped_rate_limit: number;
  readonly frames_dropped_superseded: number;
  readonly frames_analyzed: number;
  readonly observations_emitted: number;
  readonly observations_deduplicated: number;
  readonly model_errors: number;
  readonly invalid_model_outputs: number;
  readonly sink_errors: number;
  readonly capture_errors: number;
  readonly inference_calls: number;
  readonly average_inference_latency_ms: number;
  readonly max_inference_latency_ms: number;
  readonly last_inference_latency_ms: number | null;
  /** Real VLM invocations per minute since start (the number that must stay low). */
  readonly inference_calls_per_minute: number;
}
