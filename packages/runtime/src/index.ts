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

// --- P2-next Real LLM Cognition Provider V0 ------------------------------------------

export {
  LlmCognitionProviderV0,
  LlmCognitionRejectionErrorV0,
  type LlmCognitionProviderConfigV0,
  type LlmCognitionRejectionCode
} from "./providers/cognition/llm-cognition-provider.js";

export {
  buildCognitivePromptMessages,
  renderCognitiveSubjectData,
  renderCognitiveSystemRules,
  COGNITIVE_PROMPT_PROJECTION_VERSION
} from "./providers/cognition/cognitive-prompt-projection.js";

export {
  ModelTransportErrorV0,
  OpenAiCompatibleTransportV0,
  type ModelTransportV0,
  type ModelTransportConfigV0,
  type ModelTransportRequestV0,
  type ModelTransportResponseV0,
  type ModelTransportMessageV0,
  type ModelTransportFailureCode
} from "./transports/model-transport.js";

// --- P2-next Action Execution / Outcome V0 --------------------------------------------

export {
  ACTION_OUTCOME_SCHEMA_VERSION,
  ACTION_EXECUTION_ID_PROJECTION,
  deriveExecutionId,
  validateActionOutcome,
  type ActionOutcomeV0,
  type ActionOutcomeStatusV0,
  type ActionExecutionContextV0
} from "./actions/types.js";

export {
  ActionExecutionRunner,
  type ActionRunnerInputV0,
  type ActionRunnerResultV0
} from "./actions/action-runner.js";

export {
  InMemoryActionExecutionLedger,
  type ActionExecutorV0,
  type ActionExecutionLedgerV0,
  type ActionExecutionRecordV0
} from "./actions/action-executor-port.js";

export {
  DeterministicSandboxWorldV0,
  sandboxObservationRef,
  type SandboxActionTypeV0,
  type SandboxEntityPostureV0
} from "./actions/sandbox-world.js";

export {
  OutcomeReintegrationRunnerV0,
  type OutcomeReintegrationResultV0
} from "./actions/outcome-reintegration-runner.js";

export {
  adaptOutcomeToObservation,
  factualOutcomeSummary,
  type OutcomeObservationMappingV0,
  type OutcomeProvenanceV0
} from "./actions/outcome-observation-adapter.js";

export type {
  LearningAdoptionAuthority,
  LearningAdoptionRevision
} from "./transitions/learning/learning-adoption-authority.js";

// --- P2-next PersonalityState V0 Foundation ------------------------------------------

export {
  PERSONALITY_UPDATE_PROPOSAL_SCHEMA_VERSION,
  PERSONALITY_TRANSITION_ID_PROJECTION,
  PERSONALITY_EVIDENCE_MEMBER_SET_PROJECTION,
  PersonalityTransitionExecutor,
  deriveEvidenceMemberSetFingerprint,
  derivePersonalityTransitionId,
  initializeEmptyPersonalityState,
  initializePersonalityFromTraitsSeed,
  validatePersonalityUpdateProposal,
  type PersonalityDimensionUpdateV0,
  type PersonalityEvidenceBindingV0,
  type PersonalityExecutionResult,
  type PersonalityUpdateProposalV0
} from "./transitions/personality/index.js";

// --- RelationshipState V0 Foundation ----------------------------------------------

export {
  RELATIONSHIP_TRANSITION_ID_PROJECTION,
  RELATIONSHIP_UPDATE_PROPOSAL_SCHEMA_VERSION,
  RelationshipTransitionExecutor,
  deriveRelationshipEvidenceMemberSetFingerprint,
  deriveRelationshipTransitionId,
  initializeEmptyRelationshipState,
  initializeRelationshipState,
  validateRelationshipUpdateProposal,
  type RelationshipDimensionUpdateV0,
  type RelationshipEvidenceBindingV0,
  type RelationshipExecutionResult,
  type RelationshipUpdateProposalV0
} from "./transitions/relationship/index.js";

// --- Relationship Counterpart Registration V0 --------------------------------------

export {
  RELATIONSHIP_COUNTERPART_REGISTRATION_PROPOSAL_SCHEMA_VERSION,
  RELATIONSHIP_COUNTERPART_REGISTRATION_TRANSITION_ID_PROJECTION,
  RelationshipCounterpartRegistrationExecutor,
  deriveCounterpartRegistrationEvidenceMemberSetFingerprint,
  deriveRelationshipCounterpartRegistrationTransitionId,
  validateRelationshipCounterpartRegistrationProposal,
  type RelationshipCounterpartRegistrationDimensionV0,
  type RelationshipCounterpartRegistrationEvidenceBindingV0,
  type RelationshipCounterpartRegistrationProposalV0,
  type RelationshipCounterpartRegistrationResult
} from "./transitions/relationship/index.js";

// --- Relationship Semantic Routing / Evidence Semantics V0 -------------------------

export {
  RELATIONSHIP_EVIDENCE_CHANNEL_POLICY_SCHEMA_VERSION,
  RELATIONSHIP_EVIDENCE_CHANNEL_POLICY_FINGERPRINT_PROJECTION,
  RELATIONSHIP_EVIDENCE_CHANNEL_DIRECTIONS,
  RELATIONSHIP_EVIDENCE_CHANNEL_MAX_CHANNELS,
  RELATIONSHIP_SEMANTIC_CHANNEL_AUDIT_SCHEMA_VERSION,
  RELATIONSHIP_SEMANTIC_CHANNEL_CATALOG_SCHEMA_VERSION,
  RELATIONSHIP_SEMANTIC_CHANNEL_RESULT_SCHEMA_VERSION,
  RELATIONSHIP_SEMANTIC_CONTEXT_FINGERPRINT_PROJECTION,
  RELATIONSHIP_SEMANTIC_CATALOG_FINGERPRINT_PROJECTION,
  RELATIONSHIP_SEMANTIC_CONTEXT_PROJECTION_SCHEMA_VERSION,
  RELATIONSHIP_SEMANTIC_MAX_CHANNELS,
  RELATIONSHIP_SEMANTIC_MAX_CRITERION_LENGTH,
  RELATIONSHIP_SEMANTIC_MAX_EVIDENCE_RECORDS,
  RELATIONSHIP_SEMANTIC_MAX_SCENE_LENGTH,
  RELATIONSHIP_SEMANTIC_PROMPT_PROJECTION_VERSION,
  RELATIONSHIP_SEMANTIC_PROVIDER_MAX_OUTPUT_TOKENS,
  RELATIONSHIP_SEMANTIC_PROVIDER_OUTPUT_SCHEMA_VERSION,
  OpenAICompatibleRelationshipSemanticChannelProviderV0,
  RelationshipSemanticProviderErrorV0,
  buildRelationshipSemanticChannelPromptMessages,
  deriveRelationshipEvidenceChannelPolicyFingerprint,
  deriveRelationshipSemanticCatalogFingerprint,
  deriveRelationshipSemanticContextFingerprint,
  isHostMintedRelationshipSemanticResult,
  resolveRelationshipEvidenceChannel,
  runRelationshipSemanticChannelV0,
  validateRelationshipEvidenceChannelPolicy,
  validateRelationshipSemanticChannelCatalog,
  type OpenAICompatibleRelationshipSemanticChannelProviderConfigV0,
  type RelationshipEvidenceChannelDirectionV0,
  type RelationshipEvidenceChannelPolicyV0,
  type RelationshipEvidenceChannelRuleV0,
  type RelationshipSemanticChannelCatalogV0,
  type RelationshipSemanticChannelDefinitionV0,
  type RelationshipSemanticChannelProviderCatalogV0,
  type RelationshipSemanticChannelProviderInputV0,
  type RelationshipSemanticChannelProviderV0,
  type RelationshipSemanticChannelRejectionCodeV0,
  type RelationshipSemanticChannelResultV0,
  type RelationshipSemanticChannelRunResultV0,
  type RelationshipSemanticChannelRunnerInputV0,
  type RelationshipSemanticContextProjectionV0,
  type RelationshipSemanticEvidenceItemV0,
  type RelationshipSemanticEvidenceRepositoryV0,
  type RelationshipSemanticProviderFailureCodeV0,
  type RelationshipSemanticProviderOutputV0
} from "./transitions/relationship/index.js";
