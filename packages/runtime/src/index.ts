export type {
  ControlledContextProjection,
  ContextDelta
} from "./context/index.js";
export type { MICLRequest, MICLResult, MICLWorkflow } from "./micl/index.js";
export type {
  TransitionExecutionContext,
  TransitionRequest,
  TransitionResult
} from "./transitions/index.js";

// --- P2.3.1 runtime boundary layer -------------------------------------------------

export type { RuntimeContext } from "./types/runtime-context.js";

export type { RuntimeDependencyContainer } from "./types/runtime-dependency-container.js";

export type {
  AppraisalPort,
  AppraisalProposalDraftV0,
  AffectProducerInputV0,
  AffectProducerPort,
  ControlledProjectionViewV0,
  InterpretationPort,
  InterpretationProposalDraftV0,
  MemoryPort,
  RegulationProducerInputV0,
  RegulationProducerPort,
  RetrievalPort,
  SubjectCorePort
} from "./ports/index.js";

export {
  RuntimeCompositionRoot,
  type RuntimeCompositionOptions
} from "./composition/runtime-composition-root.js";

export {
  TimeTransitionExecutor,
  timeTransitionId,
  type TimeExecutionResult,
  type TimeTransitionInputV0,
  type TransitionCapabilities
} from "./transitions/time/time-transition-executor.js";

// --- P2.3.3.1 observation input + context producer --------------------------------

export {
  CONTROLLED_PROJECTION_HASH_PROJECTION,
  CONTROLLED_PROJECTION_SCHEMA_VERSION,
  ReferenceContextProducer,
  buildControlledProjectionView,
  buildContextDelta,
  type ContextProducerPort,
  type ControlledProjectionAssembly
} from "./ports/context-producer-port.js";

export {
  OBSERVATION_INPUT_SCHEMA_VERSION,
  validateObservationInput,
  type ObservationInputV0
} from "./transitions/observation/types.js";

export {
  ObservationTransitionExecutor,
  buildObservationRetrievalQuery,
  observationTransitionId,
  type ObservationExecutionResult
} from "./transitions/observation/observation-transition-executor.js";

// --- P2.3.4.1 FAST+EMA reference affect producer ----------------------------------

export {
  ReferenceFastEmaAffectProducer,
  createReferenceFastEmaAffectProducer
} from "./producers/reference-fast-ema-affect-producer.js";

// --- P2.3.4.2b REGULATION_V0 reference producer ------------------------------------

export {
  ReferenceRegulationV0Producer,
  createReferenceRegulationV0Producer
} from "./producers/reference-regulation-v0-producer.js";
