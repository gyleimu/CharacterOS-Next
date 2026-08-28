/** P2.3.1 — runtime boundary ports (types-only re-exports; no implementations). */

export type { SubjectCorePort } from "./subject-core-port.js";
export type { MemoryPort } from "./memory-port.js";
export type { RetrievalPort } from "./retrieval-port.js";
export type {
  ControlledProjectionViewV0,
  InterpretationPort,
  InterpretationProposalDraftV0
} from "./interpretation-port.js";
export type { AppraisalPort, AppraisalProposalDraftV0, AppraisalAttributionV0 } from "./appraisal-port.js";
export type { AffectProducerInputV0, AffectProducerPort } from "./affect-producer-port.js";
export type { RegulationProducerInputV0, RegulationProducerPort } from "./regulation-producer-port.js";

// --- P2-next CognitionActionTransition provider seam -------------------------------

export type { CognitionProviderV0 } from "./cognition-port.js";

// --- P2.3.3.1 observation input + context producer --------------------------------

export {
  CONTROLLED_PROJECTION_HASH_PROJECTION,
  CONTROLLED_PROJECTION_SCHEMA_VERSION,
  ReferenceContextProducer,
  buildContextDelta,
  buildControlledProjectionView,
  type ContextProducerPort,
  type ControlledProjectionAssembly
} from "./context-producer-port.js";
export type { ObservationInputV0 } from "../transitions/observation/types.js";

// --- P2.3.3 (P0-6 §21) retrieval-metadata producer ---------------------------------

export {
  ReferenceRetrievalMetadataProducer,
  buildRetrievalMetadataDelta,
  type RetrievalMetadataProducerInputV0,
  type RetrievalMetadataProducerPort
} from "./retrieval-metadata-producer-port.js";
