export type {
  ControlledContextProjection,
  ContextDelta
} from "./context/index.js";
export type {
  MICLRequestV0,
  MiclResultV0,
  MiclRunResult
} from "./micl/index.js";

export {
  InMemoryMiclWorkflowStore,
  MiclRuntime,
  validateMiclRequest,
  type MiclWorkflowStore
} from "./micl/index.js";
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
  AppraisalAttributionV0,
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

// --- P2.3.5.3a Learning trusted input / source authority -------------------------

export {
  validateLearningExperienceCandidate,
  type LearningExperienceCandidateV0
} from "./transitions/learning/learning-candidate.js";

export {
  validateTrustedLearningExperience,
  isTrustedLearningExperience,
  type LearningSourceReadAuthority,
  type TrustedLearningExperienceV0
} from "./transitions/learning/learning-source-authority.js";

export {
  ExperienceEncoderV0,
  type LearningEncodingContextV0
} from "./transitions/learning/experience-encoder-v0.js";

export {
  LearningTransitionExecutor,
  buildLearningProposal,
  type LearningTransitionInputV0,
  type LearningExecutionResult
} from "./transitions/learning/learning-transition-executor.js";

// --- P2-next CognitionActionTransition V0 ------------------------------------------

export {
  CognitionActionTransitionExecutor,
  buildCognitionActionProposal,
  buildCognitiveContextProjection,
  cognitionActionTransitionId,
  COGNITION_ACTION_TRANSITION_ID_PROJECTION,
  type CognitionActionExecutionResultV0
} from "./transitions/cognition-action/cognition-action-transition-executor.js";

export {
  actionIntentAllowed,
  allowedEvidenceSet,
  cognitiveProjectionHash,
  COGNITIVE_CONTEXT_PROJECTION_HASH_PROJECTION,
  COGNITIVE_CONTEXT_PROJECTION_SCHEMA_VERSION,
  findUnsupportedEvidenceRef,
  validateCognitionProposal,
  type ActionIntentV0,
  type AllowedActionV0,
  type CognitionActionInputV0,
  type CognitionProposalV0,
  type CognitiveContextProjectionV0
} from "./transitions/cognition-action/types.js";

export { ReferenceCognitionProviderV0 } from "./producers/reference-cognition-provider.js";
export type { CognitionProviderV0 } from "./ports/cognition-port.js";

export type {
  LearningAdoptionAuthority,
  LearningAdoptionRevision
} from "./transitions/learning/learning-adoption-authority.js";
