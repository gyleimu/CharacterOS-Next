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
  BELIEF_COGNITION_MAX_ITEMS,
  cognitiveProjectionHash,
  COGNITIVE_CONTEXT_PROJECTION_HASH_PROJECTION,
  COGNITIVE_CONTEXT_PROJECTION_SCHEMA_VERSION,
  findUnsupportedEvidenceRef,
  validateCognitionProposal,
  type ActionIntentV0,
  type AllowedActionV0,
  type BeliefStanceProjectionV0,
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

// --- Ollama Native Cognition Transport V0 (transport/provider compatibility) -------

export {
  OllamaNativeCognitionTransportV0,
  OLLAMA_NATIVE_COGNITION_TRANSPORT_TIMEOUT_MS,
  OLLAMA_NATIVE_COGNITION_TRANSPORT_NUM_PREDICT,
  type OllamaNativeCognitionTransportConfigV0
} from "./providers/cognition/ollama-native-cognition-transport.js";

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

// --- BeliefState Foundation V0 -----------------------------------------------------

export {
  BELIEF_MUTATION_PROPOSAL_SCHEMA_VERSION,
  BELIEF_TRANSITION_ID_PROJECTION,
  BeliefTransitionExecutor,
  deriveBeliefEvidenceMemberSetFingerprint,
  deriveBeliefTransitionId,
  initializeEmptyBeliefState,
  validateBeliefMutationProposal,
  type BeliefEvidenceBindingV0,
  type BeliefExecutionResult,
  type BeliefMutationProposalV0,
  type BeliefMutationV0
} from "./transitions/belief/index.js";

// --- Belief Semantic Target Resolution V0 ------------------------------------------

export {
  BELIEF_SEMANTIC_CONTEXT_FINGERPRINT_PROJECTION,
  BELIEF_SEMANTIC_EVIDENCE_PROJECTION_SCHEMA_VERSION,
  BELIEF_SEMANTIC_MAX_CANDIDATE_PROPOSITION_IDS,
  BELIEF_SEMANTIC_MAX_EVIDENCE_EPISODES,
  BELIEF_SEMANTIC_PROPOSITION_CATALOG_FINGERPRINT_PROJECTION,
  BELIEF_SEMANTIC_PROPOSITION_CATALOG_SCHEMA_VERSION,
  BELIEF_SEMANTIC_PROVIDER_INPUT_SCHEMA_VERSION,
  BELIEF_SEMANTIC_PROVIDER_OUTPUT_SCHEMA_VERSION,
  BELIEF_SEMANTIC_RELATIONS,
  BELIEF_SEMANTIC_TARGET_RESOLUTION_SCHEMA_VERSION,
  isAuthorizedBeliefSemanticTargetResolutionV0,
  runBeliefSemanticTargetResolutionV0,
  type BeliefSemanticEvidenceEntryV0,
  type BeliefSemanticEvidenceProjectionV0,
  type BeliefSemanticPropositionCandidateV0,
  type BeliefSemanticPropositionCatalogV0,
  type BeliefSemanticProviderOutputV0,
  type BeliefSemanticRelationV0,
  type BeliefSemanticTargetDecisionV0,
  type BeliefSemanticTargetResolutionProviderInputV0,
  type BeliefSemanticTargetResolutionProviderV0,
  type BeliefSemanticTargetResolutionRunResultV0,
  type BeliefSemanticTargetResolutionRunnerDepsV0,
  type BeliefSemanticTargetResolutionRunnerInputV0,
  type BeliefSemanticTargetResolutionV0
} from "./transitions/belief/index.js";

// --- BeliefPlasticityProducer V0 -------------------------------------------------

export {
  BELIEF_PLASTICITY_NUMERIC_CANONICALIZATION,
  BELIEF_PLASTICITY_OUTPUT_FINGERPRINT_PROJECTION,
  BELIEF_PLASTICITY_POLICY_VERSION,
  BELIEF_PLASTICITY_REJECTION_CODES,
  BELIEF_PLASTICITY_RESULT_SCHEMA_VERSION,
  BELIEF_PLASTICITY_STEP,
  isAuthorizedBeliefPlasticityResultV0,
  produceBeliefPlasticityV0,
  type BeliefPlasticityOutcomeV0,
  type BeliefPlasticityProducerInputV0,
  type BeliefPlasticityProducerRunResultV0,
  type BeliefPlasticityRejectionCodeV0,
  type BeliefPlasticityResultV0
} from "./transitions/belief/index.js";

// --- Belief Adaptation Workflow V0 -------------------------------------------------

export {
  BELIEF_ADAPTATION_PROPOSAL_CHECKPOINT_FINGERPRINT_PROJECTION,
  BELIEF_ADAPTATION_PROPOSAL_CHECKPOINT_SCHEMA_VERSION,
  BELIEF_ADAPTATION_REQUEST_FINGERPRINT_PROJECTION,
  BELIEF_ADAPTATION_REQUEST_SCHEMA_VERSION,
  BELIEF_ADAPTATION_SEMANTIC_CANDIDATE_FINGERPRINT_PROJECTION,
  BELIEF_ADAPTATION_WORKFLOW_CHECKPOINT_FINGERPRINT_PROJECTION,
  BELIEF_ADAPTATION_WORKFLOW_RECORD_SCHEMA_VERSION,
  BELIEF_WORKFLOW_MAX_EXTERNAL_SEMANTIC_CALLS,
  BELIEF_WORKFLOW_MAX_STALE_REBUILDS,
  deriveBeliefAdaptationProposalCheckpointFingerprint,
  deriveBeliefAdaptationSemanticCandidateFingerprint,
  deriveBeliefAdaptationWorkflowCheckpointFingerprint,
  runBeliefAdaptationWorkflowV0,
  type BeliefAdaptationProposalCheckpointV0,
  type BeliefAdaptationRequestV0,
  type BeliefAdaptationSemanticCandidateV0,
  type BeliefAdaptationStageV0,
  type BeliefAdaptationTerminalV0,
  type BeliefAdaptationWorkflowDepsV0,
  type BeliefAdaptationWorkflowRecordV0,
  type BeliefAdaptationWorkflowStoreV0
} from "./transitions/belief/index.js";

// --- Belief Ollama Semantic Provider V0 ---------------------------------------------

export {
  BELIEF_SEMANTIC_OLLAMA_PROVIDER_ERROR_CODES,
  BeliefSemanticOllamaProviderErrorV0,
  OLLAMA_BELIEF_SEMANTIC_PROVIDER_NUM_PREDICT,
  OLLAMA_BELIEF_SEMANTIC_PROVIDER_TIMEOUT_MS,
  OllamaBeliefSemanticProviderV0,
  buildBeliefSemanticOllamaPromptMessages,
  type BeliefSemanticOllamaProviderErrorCodeV0,
  type OllamaBeliefSemanticProviderConfigV0
} from "./transitions/belief/index.js";

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

// --- RelationshipPlasticityProducer V0 ---------------------------------------------

export {
  RELATIONSHIP_PLASTICITY_EVIDENCE_SCALE,
  RELATIONSHIP_PLASTICITY_MAX_PROJECTIONS,
  RELATIONSHIP_PLASTICITY_MAX_SINGLE_STEP,
  produceRelationshipPlasticityV0,
  type RelationshipPlasticityNoProposalReasonV0,
  type RelationshipPlasticityProducerInputV0,
  type RelationshipPlasticityProducerResultV0,
  type RelationshipPlasticityRejectionCodeV0
} from "./transitions/relationship/index.js";

// --- Relationship Adaptation Workflow V0 -------------------------------------------

export {
  RELATIONSHIP_ADAPTATION_PROPOSAL_CHECKPOINT_FINGERPRINT_PROJECTION,
  RELATIONSHIP_ADAPTATION_PROVIDER_CANDIDATE_FINGERPRINT_PROJECTION,
  RELATIONSHIP_ADAPTATION_REQUEST_FINGERPRINT_PROJECTION,
  RELATIONSHIP_ADAPTATION_REQUEST_SCHEMA_VERSION,
  RELATIONSHIP_ADAPTATION_WORKFLOW_RECORD_SCHEMA_VERSION,
  runRelationshipAdaptationWorkflowV0,
  type RelationshipAdaptationPlasticityRebuildOrdinalV0,
  type RelationshipAdaptationProposalCheckpointV0,
  type RelationshipAdaptationProviderCandidateV0,
  type RelationshipAdaptationRequestV0,
  type RelationshipAdaptationStageV0,
  type RelationshipAdaptationTerminalV0,
  type RelationshipAdaptationWorkflowDepsV0,
  type RelationshipAdaptationWorkflowRecordV0,
  type RelationshipAdaptationWorkflowStoreV0
} from "./transitions/relationship/index.js";

export {
  OllamaRelationshipSemanticChannelProviderV0,
  type OllamaRelationshipSemanticChannelProviderConfigV0
} from "./transitions/relationship/index.js";

// --- Belief Decision Influence Relation Foundation V0 ------------------------------

export {
  ACCEPTED_COGNITION_PROPOSAL_FINGERPRINT_PROJECTION,
  ACCEPTED_COGNITION_PROPOSAL_SCHEMA_VERSION,
  ACTION_SPACE_FINGERPRINT_PROJECTION,
  BELIEF_STATE_ACTION_RELATION_KINDS,
  COGNITION_ACTION_SPACE_SCHEMA_VERSION,
  COGNITION_PROPOSAL_V1_SCHEMA_VERSION,
  CognitionRelationRejectionErrorV1,
  MAX_RELATION_ALLOWED_ACTIONS,
  MAX_RELATION_BELIEF_ITEMS,
  MAX_STATE_ACTION_RELATIONS,
  deriveAcceptedCognitionProposalFingerprintV1,
  deriveCognitionActionSpaceFingerprintV1,
  validateAllowedActionSpaceV1,
  type AcceptedCognitionProposalV1,
  type BeliefStateActionRelationKindV0,
  type BeliefStateActionRelationV0,
  type BeliefStateLocatorV0,
  type CognitionProposalV1,
  type CognitionProposalV1RejectionCodeV1
} from "./transitions/cognition-action/cognition-proposal-v1.js";

export {
  COGNITION_RELATION_PROVIDER_INPUT_SCHEMA_VERSION,
  type CognitionRelationProviderInputV1,
  type CognitionRelationProviderV1
} from "./ports/cognition-relation-port.js";

export {
  COGNITIVE_PROMPT_PROJECTION_V1_VERSION,
  buildCognitivePromptMessagesV1
} from "./providers/cognition/cognitive-prompt-projection-v1.js";

export {
  COGNITION_V1_MAX_MODEL_CALLS_PER_INVOCATION,
  LlmCognitionRelationProviderV1,
  type LlmCognitionRelationProviderConfigV1
} from "./providers/cognition/llm-cognition-relation-provider-v1.js";

export {
  DECISION_INFLUENCE_PROJECTION_SCHEMA_VERSION,
  DECISION_INFLUENCE_RELATION_OUTPUT_FINGERPRINT_PROJECTION,
  produceBeliefDecisionInfluenceRelationProjectionV0,
  runCognitionRelationAdmissionV1,
  type CognitionRelationAdmissionResultV1,
  type CognitionRelationHostBindingV1,
  type DecisionInfluenceProjectionV0
} from "./transitions/cognition-action/belief-decision-influence-relation.js";

export {
  BELIEF_DECISION_INFLUENCE_RELATION_PROVIDER_OUTCOME_SCHEMA_VERSION,
  BELIEF_DECISION_INFLUENCE_RELATION_REQUEST_FINGERPRINT_PROJECTION,
  BELIEF_DECISION_INFLUENCE_RELATION_REQUEST_SCHEMA_VERSION,
  BELIEF_DECISION_INFLUENCE_RELATION_WORKFLOW_CHECKPOINT_FINGERPRINT_PROJECTION,
  BELIEF_DECISION_INFLUENCE_RELATION_WORKFLOW_RECORD_SCHEMA_VERSION,
  deriveBeliefDecisionInfluenceRelationRequestFingerprintV0,
  deriveBeliefDecisionInfluenceRelationWorkflowCheckpointFingerprintV0,
  runBeliefDecisionInfluenceRelationWorkflowV0,
  type BeliefDecisionInfluenceRelationProviderOutcomeV0,
  type BeliefDecisionInfluenceRelationRequestV0,
  type BeliefDecisionInfluenceRelationStageV0,
  type BeliefDecisionInfluenceRelationWorkflowDepsV0,
  type BeliefDecisionInfluenceRelationWorkflowRecordV0,
  type BeliefDecisionInfluenceRelationWorkflowResultV0,
  type BeliefDecisionInfluenceRelationWorkflowStoreV0
} from "./transitions/cognition-action/belief-decision-influence-relation-workflow.js";

// --- Belief Decision Integration Policy V0 -----------------------------------------

export {
  BELIEF_DECISION_INTEGRATION_POLICY_DESCRIPTOR_V0,
  BELIEF_DECISION_INTEGRATION_POLICY_FINGERPRINT_PROJECTION,
  BELIEF_DECISION_INTEGRATION_POLICY_ID_V0,
  BELIEF_DECISION_TENDENCY_OUTPUT_FINGERPRINT_PROJECTION,
  BELIEF_DECISION_TENDENCY_PROJECTION_SCHEMA_VERSION,
  BeliefDecisionIntegrationPolicyErrorV0,
  deriveBeliefDecisionIntegrationPolicyFingerprintV0,
  produceBeliefDecisionTendencyProjectionV0,
  type BeliefActionTendencyV0,
  type BeliefDecisionContributionV0,
  type BeliefDecisionIntegrationPolicyDescriptorV0,
  type BeliefDecisionIntegrationPolicyErrorCodeV0,
  type BeliefDecisionRelationContributionV0,
  type BeliefDecisionTendencyProducerInputV0,
  type BeliefDecisionTendencyProjectionV0,
  type BeliefDecisionTendencyV0,
  type BeliefStanceV0
} from "./transitions/cognition-action/belief-decision-integration-policy.js";

// --- Cognition Decision Arbitration Policy V0 (Belief-only) -----------------------------------------

export {
  BELIEF_POSITIVE_MAX_ARBITRATION_POLICY_DESCRIPTOR_V0,
  BELIEF_POSITIVE_MAX_ARBITRATION_POLICY_FINGERPRINT_PROJECTION,
  BELIEF_POSITIVE_MAX_ARBITRATION_POLICY_ID_V0,
  BELIEF_DECISION_SELECTION_OUTPUT_FINGERPRINT_PROJECTION,
  BELIEF_DECISION_SELECTION_SCHEMA_VERSION,
  BeliefDecisionArbitrationErrorV0,
  deriveBeliefPositiveMaxArbitrationPolicyFingerprintV0,
  isAuthorizedBeliefDecisionSelectionV0,
  produceBeliefDecisionSelectionV0,
  type BeliefDecisionArbitrationErrorCodeV0,
  type BeliefDecisionArbitrationInputV0,
  type BeliefDecisionNoSelectionReasonV0,
  type BeliefDecisionSelectionBaseV0,
  type BeliefDecisionSelectionV0,
  type BeliefPositiveMaxArbitrationPolicyDescriptorV0
} from "./transitions/cognition-action/belief-decision-arbitration-policy.js";

// --- Tendency Scale Contract Foundation V0 ----------------------------------------------------------

export {
  BELIEF_ACTION_ALIGNMENT_SCALE_FINGERPRINT_PROJECTION,
  BELIEF_ACTION_ALIGNMENT_SCALE_ID_V0,
  CROSS_DOMAIN_OPERATIONS_V0,
  DEFAULT_CROSS_DOMAIN_COMPARABILITY_V0,
  REGISTERED_TENDENCY_SCALE_IDS_V0,
  TENDENCY_COMPARABILITY_CONTRACT_FINGERPRINT_PROJECTION,
  TENDENCY_COMPARABILITY_CONTRACT_SCHEMA_VERSION,
  TENDENCY_SCALE_CONTRACT_FINGERPRINT_PROJECTION,
  TENDENCY_SCALE_CONTRACT_SCHEMA_VERSION,
  TendencyComparabilityContractValidationErrorV0,
  TendencyScaleContractResolutionErrorV0,
  TendencyScaleContractValidationErrorV0,
  deriveTendencyComparabilityContractFingerprintV0,
  deriveTendencyScaleContractFingerprintV0,
  getBeliefActionAlignmentScaleContractV0,
  queryCrossDomainOperationAuthorizationV0,
  resolveRegisteredTendencyScaleContractV0,
  validateTendencyComparabilityContractV0,
  validateTendencyScaleContractV0,
  type CrossDomainOperationV0,
  type DefaultCrossDomainComparabilityV0,
  type ResolveRegisteredTendencyScaleInputV0,
  type TendencyComparabilityContractV0,
  type TendencyComparabilityContractValidationErrorCodeV0,
  type TendencyComparabilityParticipantV0,
  type TendencyScaleContractResolutionErrorCodeV0,
  type TendencyScaleContractValidationErrorCodeV0,
  type TendencyScaleContractV0,
  type TendencyScaleNormalizationSemanticsV0
} from "./transitions/cognition-action/tendency-scale-contract.js";

// --- Relationship Feature Decision Semantics Foundation V0 -------------------------------------------

export {
  RELATIONSHIP_FEATURE_DECISION_DOMAIN_ID_V0,
  RELATIONSHIP_FEATURE_DECISION_ROLES_V0,
  RELATIONSHIP_FEATURE_DECISION_SEMANTICS_CONTRACT_FINGERPRINT_PROJECTION,
  RELATIONSHIP_FEATURE_DECISION_SEMANTICS_CONTRACT_SCHEMA_VERSION,
  RELATIONSHIP_FEATURE_DECISION_SOURCE_STATE_SCHEMA_VERSION_V0,
  RELATIONSHIP_FEATURE_MONOTONICITY_SEMANTICS_V0,
  REGISTERED_RELATIONSHIP_DECISION_FEATURE_IDS_V0,
  RelationshipFeatureDecisionSemanticsResolutionErrorV0,
  RelationshipFeatureDecisionSemanticsValidationErrorV0,
  deriveRelationshipFeatureDecisionSemanticsContractFingerprintV0,
  queryRelationshipFeatureDecisionAdmissionV0,
  resolveRegisteredRelationshipFeatureDecisionSemanticsV0,
  validateRelationshipFeatureDecisionSemanticsContractV0,
  type RelationshipFeatureDecisionAdmissionV0,
  type RelationshipFeatureDecisionRoleV0,
  type RelationshipFeatureDecisionSemanticsContractV0,
  type RelationshipFeatureDecisionSemanticsResolutionErrorCodeV0,
  type RelationshipFeatureDecisionSemanticsValidationErrorCodeV0,
  type RelationshipFeatureMonotonicitySemanticsV0,
  type RelationshipFeatureSemanticPointV0,
  type ResolveRelationshipFeatureDecisionSemanticsInputV0
} from "./transitions/relationship/relationship-feature-decision-semantics.js";

// --- Relationship Governed Dimension Namespace V0 ------------------------------------------------------

export {
  RELATIONSHIP_GOVERNED_DIMENSION_RESERVED_PREFIX_V0,
  isReservedRelationshipCoreDimensionIdV0
} from "./transitions/relationship/relationship-governed-dimension-namespace.js";

// --- Atomic Commit Bundle V2 Authority Schema Foundation (historical registry) -------

export {
  RELATIONSHIP_GOVERNED_WRITER_SCHEMA_ID_V0,
  RELATIONSHIP_GOVERNED_WRITER_SCHEMA_PROJECTION,
  RELATIONSHIP_GOVERNED_WRITER_SCHEMA_DESCRIPTOR_V0,
  deriveRelationshipGovernedWriterSchemaFingerprintV0,
  getRecognizedWriterSchemaContractsV0,
  resolveRecognizedWriterSchemaContractV0,
  RECOGNIZED_WRITER_SCHEMA_CONTRACT_IDS_V0,
  REGISTERED_AUTHORIZATION_GATE_IDS_V0,
  REGISTERED_GOVERNED_RELATIONSHIP_WRITE_POLICY_IDS_V0,
  HOST_DYNAMIC_WRITER_AUTHORITY_REGISTRATION_V0,
  PRODUCTION_GOVERNED_RELATIONSHIP_WRITER_AUTHORITY_V0,
  GOVERNED_RELATIONSHIP_WRITE_POLICY_COUNT_V0,
  type RecognizedWriterSchemaContractV0,
  type RelationshipGovernedWriterSchemaDescriptorV0
} from "./authority/historical-writer-authority-registry.js";

// --- Relationship Governed Feature Writer Authority V0 (static gate/policy/resolver) ---
// Read-only descriptors, fingerprints, resolvers and TYPES only. The trusted
// history issuer, the prepared-authority service and every minting/verifying
// surface are deliberately NOT root-exported
// (ARBITRARY_GOVERNED_AUTHORITY_MINT_PRODUCT_EXPOSED = NO).

export {
  RELATIONSHIP_GOVERNED_FEATURE_AUTHORIZATION_GATE_ID_V0,
  RELATIONSHIP_GOVERNED_FEATURE_AUTHORIZATION_GATE_PROJECTION,
  RELATIONSHIP_GOVERNED_FEATURE_AUTHORIZATION_GATE_DESCRIPTOR_V0,
  deriveRelationshipGovernedFeatureAuthorizationGateFingerprintV0,
  getRegisteredAuthorizationGatesV0,
  resolveAuthorizationGateV0,
  RELATIONSHIP_GOVERNED_FEATURE_WRITE_POLICY_ID_V0,
  RELATIONSHIP_GOVERNED_FEATURE_WRITE_POLICY_PROJECTION,
  RELATIONSHIP_GOVERNED_FEATURE_WRITE_POLICY_DESCRIPTOR_V0,
  deriveRelationshipGovernedFeatureWritePolicyFingerprintV0,
  getRegisteredGovernedWritePoliciesV0,
  resolveGovernedWritePolicyV0,
  classifyHistoricalWriterAuthorityStatusV0,
  type RegisteredAuthorizationGateV0,
  type RegisteredGovernedWritePolicyV0,
  type HistoricalWriterAuthorityStatusV0,
  type HistoricalWriterAuthorityResolutionV0
} from "./authority/historical-writer-authority-registry.js";

export {
  RELATIONSHIP_GOVERNED_WRITE_POLICY_RECEIPT_SCHEMA_VERSION_V0,
  RELATIONSHIP_GOVERNED_WRITE_POLICY_RECEIPT_PROJECTION,
  deriveRelationshipGovernedWritePolicyReceiptRefV0,
  type RelationshipGovernedWritePolicyReceiptDescriptorV0
} from "./authority/relationship-governed-write-policy-receipt.js";

export type {
  RelationshipGovernedTrustedHistoryCapabilityV0,
  CurrentCanonicalHeadFactsV0
} from "./authority/relationship-governed-trusted-history.js";

export type { RelationshipPreparedAuthorityCapabilityV0 } from "./transitions/relationship/relationship-governed-write-authority-service.js";

// --- Relationship Registered Feature Admission V1 (interaction familiarity) -----------
// Read-only admitted-feature identity, receipt contract and feature-law
// validators only. There is NO product governed-write API: no caller can
// supply dimension ids, canonical familiarity values, increments, epochs or
// authority payloads; the governed writer-authority service, trusted-history
// issuer and every minting surface remain internal.

export {
  INTERACTION_FAMILIARITY_DIMENSION_ID_V0,
  INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_ID_V0,
  INTERACTION_FAMILIARITY_QUANTITY_SEMANTICS_ID_V0,
  INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_V0,
  INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_FINGERPRINT_V0
} from "./transitions/relationship/relationship-feature-decision-semantics.js";

export {
  RELATIONSHIP_INTERACTION_FAMILIARITY_EVIDENCE_RECEIPT_SCHEMA_VERSION_V0,
  RELATIONSHIP_INTERACTION_FAMILIARITY_EVIDENCE_ADMISSION_POLICY_ID_V0,
  RELATIONSHIP_INTERACTION_FAMILIARITY_EVIDENCE_RECEIPT_PROJECTION,
  RELATIONSHIP_INTERACTION_FAMILIARITY_EVIDENCE_RECEIPT_REF_KIND_V0,
  RELATIONSHIP_INTERACTION_FAMILIARITY_QUALIFYING_CLASSES_V0,
  validateRelationshipInteractionFamiliarityEvidenceReceiptV0,
  deriveRelationshipInteractionFamiliarityEvidenceReceiptRefV0,
  isRelationshipInteractionFamiliarityEvidenceReceiptRefV0,
  type RelationshipInteractionFamiliarityEvidenceReceiptV0,
  type RelationshipInteractionFamiliarityQualifyingClassV0
} from "./transitions/relationship/relationship-interaction-familiarity-evidence-receipt.js";

export {
  RELATIONSHIP_INTERACTION_FAMILIARITY_ACCRUAL_POLICY_ID_V0,
  RELATIONSHIP_INTERACTION_FAMILIARITY_GRID_DENOMINATOR_V0,
  classifyInteractionFamiliarityGridValueV0,
  interactionFamiliarityGridValueV0,
  validateInteractionFamiliarityAuthorityLawV0,
  type InteractionFamiliarityGridClassificationV0,
  type InteractionFamiliarityLawRejectionCodeV0,
  type InteractionFamiliarityAuthorityLawCheckV0
} from "./transitions/relationship/relationship-interaction-familiarity-accrual-policy.js";

// --- Interaction Familiarity Experience Ingestion V0 ----------------------------------
// The narrow EXPERIENCE-oriented product capability: the caller supplies an
// experience identity (subject, registered counterpart, candidate episode);
// CharacterOS owns the entire derivation from experience to governed commit.
// No state-oriented API exists (no setFamiliarity / writeRelationshipCore /
// mintFamiliarityReceipt); authority issuers and capabilities remain internal
// to trusted composition.

export {
  RELATIONSHIP_INTERACTION_FAMILIARITY_INGESTION_SCHEMA_VERSION_V0,
  RELATIONSHIP_INTERACTION_QUALIFYING_ADMISSION_CLASSES_V0,
  processInteractionExperience,
  type InteractionFamiliarityIngestionDepsV0,
  type InteractionFamiliarityIngestionOutcomeV0,
  type InteractionFamiliarityIngestionRejectionCodeV0,
  type ProcessInteractionExperienceRequestV0,
  type RelationshipInteractionQualifyingAdmissionClassV0,
  type RelationshipInteractionQualifyingAdmissionInputV0,
  type RelationshipInteractionQualifyingAdmissionProviderV0,
  type RelationshipInteractionQualifyingAdmissionV0
} from "./transitions/relationship/relationship-interaction-familiarity-ingestion.js";

// --- Relationship Governed Writer Authority Payload Contract V0 ----------------------

export {
  RELATIONSHIP_GOVERNED_FEATURE_WRITER_AUTHORITY_PAYLOAD_SCHEMA_VERSION,
  RELATIONSHIP_GOVERNED_FEATURE_WRITER_AUTHORITY_PAYLOAD_PROJECTION,
  RELATIONSHIP_GOVERNED_WRITER_OPERATION_KINDS_V0,
  deriveRelationshipGovernedFeatureWriterAuthorityPayloadFingerprintV0,
  validateRelationshipGovernedFeatureWriterAuthorityPayloadV0,
  validateRelationshipGovernedFeatureAuthorityBindingV0,
  type RelationshipGovernedFeatureWriterAuthorityPayloadV0,
  type RelationshipGovernedWriterOperationKindV0,
  type RelationshipGovernedFeaturePreviousValueV0,
  type RelationshipGovernedFeatureNextValueV0,
  type RelationshipGovernedFeaturePreviousGovernedAuthorityV0
} from "./transitions/relationship/relationship-governed-writer-authority.js";

// --- CharacterOS Atomic Commit Chain Validator V0 --------------------------------------

export {
  ATOMIC_COMMIT_CHAIN_VALIDATOR_POLICY_ID_V0,
  ATOMIC_COMMIT_CHAIN_VALIDATION_POLICY_PROJECTION_V0,
  ATOMIC_COMMIT_CHAIN_VALIDATION_POLICY_DESCRIPTOR_V0,
  V1_CHAIN_PROOF_LEVEL_V0,
  V2_CHAIN_PROOF_LEVEL_V0,
  ATOMIC_COMMIT_CHAIN_CHECKPOINT_SUPPORT_V0,
  TRUNCATED_CHAIN_POLICY_V0,
  deriveAtomicCommitChainValidationPolicyFingerprintV0,
  validateAtomicCommitChainV0,
  type AtomicCommitChainValidationInputV0,
  type AtomicCommitChainValidationResultV0,
  type AtomicCommitChainValidationPolicyDescriptorV0,
  type ChainValidationFailureCodeV0,
  type ChainValidationFailureV0,
  type ChainValidationReceiptV0,
  type WriterAuthorityStatusV0
} from "./authority/atomic-commit-chain-validator.js";

// --- Trusted Canonical History Boundary V0 (receipt types + verification only) ---------

export {
  TRUSTED_CANONICAL_HEAD_SCHEMA_VERSION_V0,
  TRUSTED_CANONICAL_HISTORY_BOUNDARY_SCHEMA_VERSION_V0,
  isTrustedCanonicalHistoryBoundaryReceiptV0,
  verifyGenesisEnvelopeV0,
  validateTrustedCanonicalHeadInputV0,
  type TrustedCanonicalHeadInputV0,
  type TrustedCanonicalHistoryBoundaryReceiptV0,
  type MintTrustedCanonicalHistoryBoundaryInputV0,
  type MintTrustedCanonicalHistoryBoundaryOutcomeV0
} from "./authority/trusted-canonical-history-boundary.js";

// --- Restore Chain Authority Integration V0 --------------------------------------------
// RESTORE_AUTHORITY_FACTORY_SURFACE = TRUSTED_COMPOSITION_ONLY: the reference-
// validator-capable factory (createRestoreChainAuthorityV0) is deliberately NOT
// root-exported — ordinary product callers get only the closed-input product
// entrypoint below and can never inject repository/chain authority callbacks.

export {
  restoreCanonicalSubjectFromHistoryV0,
  type RestoreCanonicalSubjectFromHistoryInputV0,
  type RestoreChainAuthorityResultV0,
  type RestoreChainAuthorityFailureCodeV0,
  type RestoreChainAuthorityFailureV0
} from "./authority/restore-chain-authority.js";

// --- Atomic Commit Bundle V2 Production Emission V0 -------------------------------------
// RESTORE_AUTHORITY_FACTORY_SURFACE note: the version policy module and V2
// assembler are production-internal (no caller version selector is exported).
// The cutover quiescence and target-version constants are re-exported from
// @characteros-next/subject-core (added by this slice's index change).
