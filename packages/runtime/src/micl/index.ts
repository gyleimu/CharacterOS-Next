/**
 * P2.4 — MICL V0 public surface (Minimal Internal Continuity Loop).
 */

export {
  MICL_REQUEST_SCHEMA_VERSION,
  validateMiclRequest,
  type MICLRequestV0,
  type MiclFailureStage,
  type MiclResultStatus,
  type MiclResultV0,
  type MiclStageCheckpointV0,
  type MiclWorkflowRecordV0
} from "./micl-types.js";

export {
  MICL_REQUEST_FINGERPRINT_PROJECTION,
  deriveMiclRequestFingerprint,
  miclSemanticRequestBody
} from "./micl-identity.js";

export {
  InMemoryMiclWorkflowStore,
  MICL_PREPARED_RESULT_PROJECTION,
  type MiclWorkflowStore
} from "./micl-workflow-store.js";

export {
  createMiclStageMinter,
  MICL_SENTINEL_PREPARED_REF_PREFIX,
  miclWorkflowBinding,
  type MiclStageMinter
} from "./micl-capabilities.js";

export { MiclRuntime, type MiclRunResult } from "./micl-runtime.js";
