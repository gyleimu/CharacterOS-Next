/**
 * @characteros-next/vision — the Visual Perception / Vision Adapter.
 *
 * A pluggable, local-only adapter that periodically looks at the user's camera
 * and desktop, decides cheaply whether anything changed, and only then asks a
 * local MiniCPM-V model for ONE structured observation. It reports observed
 * facts into a sink (see `product/sandbox` for the CharacterOS bridge); it never
 * writes subject state itself.
 *
 * Nothing in this package imports CharacterOS: the dependency arrow points from
 * the product layer into the adapter.
 */

export {
  VISUAL_OBSERVATION_SCHEMA_VERSION,
  ATTENTION_LEVELS_V0,
  ATTENTION_CADENCE_MS_V0,
  type AttentionLevelV0,
  type CapturedFrameV0,
  type SourceMetricsV0,
  type VisualEntityV0,
  type VisualObservationV0,
  type VisionCaptureDiagnosticsV0,
  type VisionErrorCodeV0,
  type VisionLogEventV0,
  type VisionLoggerV0,
  type VisionMetricsSnapshotV0,
  type VisionObservationSinkV0,
  type VisionSinkOutcomeV0,
  type VisionSourceKindV0
} from "./types.js";

export {
  VISION_CONFIG_DEFAULTS_V0,
  resolveVisionConfigV0,
  type VisionCameraConfigV0,
  type VisionConfigV0,
  type VisionDesktopConfigV0,
  type VisionInferenceConfigV0,
  type VisionSourceConfigV0
} from "./config.js";

export {
  assessFrameChangeV0,
  fingerprintGrayV0,
  hammingDistanceV0,
  reduceGrayV0,
  roundChangeScoreV0,
  type ChangeAssessmentV0,
  type ChangeThresholdsV0,
  type FrameFingerprintV0
} from "./change-detection.js";

export { MjpegFrameSplitterV0, type MjpegSplitterDiagnosticsV0 } from "./frame-stream.js";

export {
  buildFrameSourceArgsV0,
  FfmpegFrameSourceV0,
  type DesktopRegionV0,
  type FrameSourceCallbacksV0,
  type FrameSourceConfigV0,
  type FrameSourceStartResultV0,
  type StillFrameV0,
  type ThumbnailFrameV0
} from "./capture/ffmpeg-source.js";

export {
  listDshowVideoDevicesV0,
  type DshowEnumerationResultV0,
  type DshowVideoDeviceV0
} from "./capture/dshow-devices.js";

export {
  buildVisualObservationV0,
  DEFAULT_OBSERVATION_LIMITS_V0,
  parseModelObservationV0,
  type ModelObservationParseResultV0,
  type ModelObservationV0,
  type ObservationLimitsV0
} from "./observation.js";

export {
  normalizeObservationTextV0,
  observationDedupeKeyV0,
  ObservationDedupeRingV0
} from "./dedupe.js";

export { VisionMetricsV0 } from "./metrics.js";

export { buildVisionPromptV0, type VisionPromptV0 } from "./inference/prompts.js";

export {
  boundedDetailV0,
  readContentStringV0,
  type VisionInferenceOutcomeV0,
  type VisionInferenceProviderV0,
  type VisionInferenceRequestV0
} from "./inference/provider.js";

export {
  createOllamaVisionProviderV0,
  type OllamaVisionProviderConfigV0
} from "./inference/ollama-provider.js";

export {
  createOpenAiCompatibleVisionProviderV0,
  type OpenAiCompatibleVisionProviderConfigV0
} from "./inference/openai-compatible-provider.js";

export {
  createStreamVisionLoggerV0,
  VisionPerceptionV0,
  type FrameSourceFactoryV0,
  type FrameSourceV0,
  type VisionPerceptionDepsV0,
  type VisionStartResultV0
} from "./vision-perception.js";
