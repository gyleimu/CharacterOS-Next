/**
 * Configuration: every knob has a working default, every default is overridable
 * from the environment. Nothing here reaches outside the local machine.
 */

import { DEFAULT_OBSERVATION_LIMITS_V0, type ObservationLimitsV0 } from "./observation.js";
import type { ChangeThresholdsV0 } from "./change-detection.js";
import type { DesktopRegionV0 } from "./capture/ffmpeg-source.js";
import { ATTENTION_LEVELS_V0, type AttentionLevelV0 } from "./types.js";

export interface VisionSourceConfigV0 {
  readonly enabled: boolean;
  /** Still-sampling cadence at the FOCUSED attention level. */
  readonly stream_fps: number;
  /** Rate of the full-resolution still that model input is taken from. */
  readonly still_fps: number;
  /** Hard floor between two model invocations for this source. */
  readonly min_inference_interval_ms: number;
  readonly change: ChangeThresholdsV0;
}

export interface VisionCameraConfigV0 extends VisionSourceConfigV0 {
  /** Resolved from `device_index` when no explicit name is configured. */
  readonly device_index: number;
  readonly device_name: string | null;
  /** Optional DirectShow input mode, e.g. `1280x720`. */
  readonly input_size: string | null;
}

export interface VisionDesktopConfigV0 extends VisionSourceConfigV0 {
  /** Primary monitor by default; a sub-rectangle is a one-line extension. */
  readonly region: DesktopRegionV0 | null;
}

export interface VisionInferenceConfigV0 {
  readonly provider: "ollama" | "openai-compatible";
  readonly endpoint: string;
  readonly model: string;
  readonly timeout_ms: number;
  readonly num_predict: number;
  readonly keep_alive: string;
  readonly think: boolean | null;
  readonly api_key: string | null;
}

export interface VisionConfigV0 {
  readonly enabled: boolean;
  readonly attention_level: AttentionLevelV0;
  readonly ffmpeg_path: string;
  readonly camera: VisionCameraConfigV0;
  readonly desktop: VisionDesktopConfigV0;
  /** Longest side sent to the model; higher is not better here. */
  readonly analysis_width: number;
  readonly thumb_width: number;
  readonly thumb_height: number;
  readonly inference: VisionInferenceConfigV0;
  readonly observation_limits: ObservationLimitsV0;
  /** How many previously emitted observation keys are remembered per source. */
  readonly dedupe_history: number;
  readonly restart_backoff_ms: number;
  readonly max_restarts: number;
  readonly stable_after_ms: number;
  /** Debug only: writes the analysed still to `debug_frames_dir` (off by default). */
  readonly debug_save_frames: boolean;
  readonly debug_frames_dir: string;
}

function readStringV0(
  environment: Readonly<Record<string, string | undefined>>,
  name: string,
  fallback: string
): string {
  const value = environment[name];
  return value === undefined || value.trim().length === 0 ? fallback : value.trim();
}

function readOptionalStringV0(
  environment: Readonly<Record<string, string | undefined>>,
  name: string
): string | null {
  const value = environment[name];
  return value === undefined || value.trim().length === 0 ? null : value.trim();
}

function readIntV0(
  environment: Readonly<Record<string, string | undefined>>,
  name: string,
  fallback: number,
  min: number,
  max: number
): number {
  const raw = environment[name];
  if (raw === undefined || raw.trim().length === 0) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isSafeInteger(Math.round(parsed))) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function readFloatV0(
  environment: Readonly<Record<string, string | undefined>>,
  name: string,
  fallback: number,
  min: number,
  max: number
): number {
  const raw = environment[name];
  if (raw === undefined || raw.trim().length === 0) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function readBoolV0(
  environment: Readonly<Record<string, string | undefined>>,
  name: string,
  fallback: boolean
): boolean {
  const raw = environment[name];
  if (raw === undefined || raw.trim().length === 0) return fallback;
  const normalized = raw.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function readAttentionV0(
  environment: Readonly<Record<string, string | undefined>>,
  name: string,
  fallback: AttentionLevelV0
): AttentionLevelV0 {
  const raw = environment[name];
  if (raw === undefined) return fallback;
  const upper = raw.trim().toUpperCase();
  return (ATTENTION_LEVELS_V0 as readonly string[]).includes(upper) ? (upper as AttentionLevelV0) : fallback;
}

function readRegionV0(value: string | null): DesktopRegionV0 | null {
  if (value === null) return null;
  const match = /^(\d+)[x,](\d+)\+(\d+)\+(\d+)$/u.exec(value) ?? /^(\d+),(\d+),(\d+),(\d+)$/u.exec(value);
  if (match === null) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  const x = Number(match[3]);
  const y = Number(match[4]);
  if (![width, height, x, y].every((entry) => Number.isSafeInteger(entry) && entry >= 0)) return null;
  return { x, y, width, height };
}

export const VISION_CONFIG_DEFAULTS_V0 = {
  enabled: true,
  attention_level: "NORMAL" satisfies AttentionLevelV0,
  ffmpeg_path: "ffmpeg",
  analysis_width: 1280,
  thumb_width: 64,
  thumb_height: 36,
  camera_stream_fps: 1,
  desktop_stream_fps: 2,
  still_fps: 1,
  camera_min_inference_interval_ms: 5000,
  desktop_min_inference_interval_ms: 3000,
  camera_min_mean_abs_difference: 0.02,
  camera_min_hash_distance: 0.12,
  desktop_min_mean_abs_difference: 0.012,
  desktop_min_hash_distance: 0.08,
  dedupe_history: 3,
  restart_backoff_ms: 1000,
  max_restarts: 5,
  stable_after_ms: 15000
} as const;

/** Reads the environment into a complete configuration (no undefined fields). */
export function resolveVisionConfigV0(
  environment: Readonly<Record<string, string | undefined>> = {},
  overrides: Partial<VisionConfigV0> = {}
): VisionConfigV0 {
  const camera: VisionCameraConfigV0 = {
    enabled: readBoolV0(environment, "VISION_CAMERA_ENABLED", true),
    device_index: readIntV0(environment, "VISION_CAMERA_DEVICE_INDEX", 0, 0, 16),
    device_name: readOptionalStringV0(environment, "VISION_CAMERA_DEVICE_NAME"),
    input_size: readOptionalStringV0(environment, "VISION_CAMERA_INPUT_SIZE"),
    stream_fps: readFloatV0(environment, "VISION_CAMERA_STREAM_FPS", VISION_CONFIG_DEFAULTS_V0.camera_stream_fps, 0.1, 10),
    still_fps: readFloatV0(environment, "VISION_STILL_FPS", VISION_CONFIG_DEFAULTS_V0.still_fps, 0.1, 10),
    min_inference_interval_ms: readIntV0(
      environment,
      "VISION_MIN_INFERENCE_INTERVAL_CAMERA_MS",
      VISION_CONFIG_DEFAULTS_V0.camera_min_inference_interval_ms,
      0,
      600000
    ),
    change: {
      min_mean_abs_difference: readFloatV0(
        environment,
        "VISION_CHANGE_THRESHOLD_CAMERA",
        VISION_CONFIG_DEFAULTS_V0.camera_min_mean_abs_difference,
        0,
        1
      ),
      min_hash_distance: readFloatV0(
        environment,
        "VISION_HASH_DISTANCE_CAMERA",
        VISION_CONFIG_DEFAULTS_V0.camera_min_hash_distance,
        0,
        1
      )
    }
  };
  const desktop: VisionDesktopConfigV0 = {
    enabled: readBoolV0(environment, "VISION_DESKTOP_ENABLED", true),
    stream_fps: readFloatV0(environment, "VISION_DESKTOP_STREAM_FPS", VISION_CONFIG_DEFAULTS_V0.desktop_stream_fps, 0.1, 10),
    still_fps: readFloatV0(environment, "VISION_STILL_FPS", VISION_CONFIG_DEFAULTS_V0.still_fps, 0.1, 10),
    min_inference_interval_ms: readIntV0(
      environment,
      "VISION_MIN_INFERENCE_INTERVAL_DESKTOP_MS",
      VISION_CONFIG_DEFAULTS_V0.desktop_min_inference_interval_ms,
      0,
      600000
    ),
    region: readRegionV0(readOptionalStringV0(environment, "VISION_DESKTOP_REGION")),
    change: {
      min_mean_abs_difference: readFloatV0(
        environment,
        "VISION_CHANGE_THRESHOLD_DESKTOP",
        VISION_CONFIG_DEFAULTS_V0.desktop_min_mean_abs_difference,
        0,
        1
      ),
      min_hash_distance: readFloatV0(
        environment,
        "VISION_HASH_DISTANCE_DESKTOP",
        VISION_CONFIG_DEFAULTS_V0.desktop_min_hash_distance,
        0,
        1
      )
    }
  };
  const thinkRaw = readOptionalStringV0(environment, "VISION_THINK");
  const base: VisionConfigV0 = {
    enabled: readBoolV0(environment, "VISION_ENABLED", VISION_CONFIG_DEFAULTS_V0.enabled),
    attention_level: readAttentionV0(environment, "VISION_ATTENTION", VISION_CONFIG_DEFAULTS_V0.attention_level),
    ffmpeg_path: readStringV0(environment, "VISION_FFMPEG_PATH", VISION_CONFIG_DEFAULTS_V0.ffmpeg_path),
    camera,
    desktop,
    analysis_width: readIntV0(environment, "VISION_ANALYSIS_WIDTH", VISION_CONFIG_DEFAULTS_V0.analysis_width, 160, 4096),
    thumb_width: readIntV0(environment, "VISION_THUMB_WIDTH", VISION_CONFIG_DEFAULTS_V0.thumb_width, 8, 256),
    thumb_height: readIntV0(environment, "VISION_THUMB_HEIGHT", VISION_CONFIG_DEFAULTS_V0.thumb_height, 8, 256),
    inference: {
      provider: readStringV0(environment, "VISION_PROVIDER", "ollama") === "openai-compatible" ? "openai-compatible" : "ollama",
      endpoint: readStringV0(environment, "VISION_ENDPOINT", "http://127.0.0.1:11434"),
      model: readStringV0(environment, "VISION_MODEL", "minicpm-v4.6"),
      timeout_ms: readIntV0(environment, "VISION_TIMEOUT_MS", 60000, 1000, 600000),
      num_predict: readIntV0(environment, "VISION_NUM_PREDICT", 900, 32, 4096),
      keep_alive: readStringV0(environment, "VISION_KEEP_ALIVE", "5m"),
      think: thinkRaw === null ? false : ["1", "true", "yes", "on"].includes(thinkRaw.toLowerCase()),
      api_key: readOptionalStringV0(environment, "VISION_API_KEY")
    },
    observation_limits: DEFAULT_OBSERVATION_LIMITS_V0,
    dedupe_history: readIntV0(environment, "VISION_DEDUPE_HISTORY", VISION_CONFIG_DEFAULTS_V0.dedupe_history, 1, 64),
    restart_backoff_ms: readIntV0(environment, "VISION_RESTART_BACKOFF_MS", VISION_CONFIG_DEFAULTS_V0.restart_backoff_ms, 100, 60000),
    max_restarts: readIntV0(environment, "VISION_MAX_RESTARTS", VISION_CONFIG_DEFAULTS_V0.max_restarts, 0, 100),
    stable_after_ms: readIntV0(environment, "VISION_STABLE_AFTER_MS", VISION_CONFIG_DEFAULTS_V0.stable_after_ms, 1000, 300000),
    debug_save_frames: readBoolV0(environment, "VISION_DEBUG_SAVE_FRAMES", false),
    debug_frames_dir: readStringV0(environment, "VISION_DEBUG_FRAMES_DIR", "vision-debug-frames")
  };
  return { ...base, ...overrides };
}
