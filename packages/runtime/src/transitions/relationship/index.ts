/** RelationshipState V0 canonical foundation exports. */

export {
  initializeEmptyRelationshipState,
  initializeRelationshipState
} from "./relationship-init.js";

export {
  RELATIONSHIP_TRANSITION_ID_PROJECTION,
  RELATIONSHIP_UPDATE_PROPOSAL_SCHEMA_VERSION,
  deriveRelationshipEvidenceMemberSetFingerprint,
  deriveRelationshipTransitionId,
  validateRelationshipUpdateProposal,
  type RelationshipDimensionUpdateV0,
  type RelationshipEvidenceBindingV0,
  type RelationshipUpdateProposalV0
} from "./relationship-update-proposal.js";

export {
  RelationshipTransitionExecutor,
  type RelationshipExecutionResult
} from "./relationship-transition-executor.js";

export {
  RELATIONSHIP_COUNTERPART_REGISTRATION_PROPOSAL_SCHEMA_VERSION,
  RELATIONSHIP_COUNTERPART_REGISTRATION_TRANSITION_ID_PROJECTION,
  deriveCounterpartRegistrationEvidenceMemberSetFingerprint,
  deriveRelationshipCounterpartRegistrationTransitionId,
  validateRelationshipCounterpartRegistrationProposal,
  type RelationshipCounterpartRegistrationDimensionV0,
  type RelationshipCounterpartRegistrationEvidenceBindingV0,
  type RelationshipCounterpartRegistrationProposalV0
} from "./relationship-counterpart-registration-proposal.js";

export {
  RelationshipCounterpartRegistrationExecutor,
  type RelationshipCounterpartRegistrationResult
} from "./relationship-counterpart-registration-executor.js";

export {
  RELATIONSHIP_EVIDENCE_CHANNEL_POLICY_SCHEMA_VERSION,
  RELATIONSHIP_EVIDENCE_CHANNEL_POLICY_FINGERPRINT_PROJECTION,
  RELATIONSHIP_EVIDENCE_CHANNEL_DIRECTIONS,
  RELATIONSHIP_EVIDENCE_CHANNEL_MAX_CHANNELS,
  deriveRelationshipEvidenceChannelPolicyFingerprint,
  resolveRelationshipEvidenceChannel,
  validateRelationshipEvidenceChannelPolicy,
  type RelationshipEvidenceChannelDirectionV0,
  type RelationshipEvidenceChannelPolicyV0,
  type RelationshipEvidenceChannelRuleV0
} from "./relationship-evidence-channel-policy.js";

export {
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
  RELATIONSHIP_SEMANTIC_PROVIDER_OUTPUT_SCHEMA_VERSION,
  RelationshipSemanticProviderErrorV0,
  deriveRelationshipSemanticCatalogFingerprint,
  deriveRelationshipSemanticContextFingerprint,
  isHostMintedRelationshipSemanticResult,
  runRelationshipSemanticChannelV0,
  validateRelationshipSemanticChannelCatalog,
  type RelationshipSemanticChannelCatalogV0,
  type RelationshipSemanticChannelDefinitionV0,
  type RelationshipSemanticChannelProviderCatalogV0,
  type RelationshipSemanticChannelProviderInputV0,
  type RelationshipSemanticChannelProviderV0,
  type RelationshipSemanticChannelRejectionCodeV0,
  type RelationshipSemanticChannelResultV0,
  type RelationshipSemanticChannelRunnerInputV0,
  type RelationshipSemanticChannelRunResultV0,
  type RelationshipSemanticContextProjectionV0,
  type RelationshipSemanticEvidenceItemV0,
  type RelationshipSemanticEvidenceRepositoryV0,
  type RelationshipSemanticProviderFailureCodeV0,
  type RelationshipSemanticProviderOutputV0
} from "./relationship-semantic-channel.js";

export {
  RELATIONSHIP_SEMANTIC_PROMPT_PROJECTION_VERSION,
  RELATIONSHIP_SEMANTIC_PROVIDER_MAX_OUTPUT_TOKENS,
  OpenAICompatibleRelationshipSemanticChannelProviderV0,
  buildRelationshipSemanticChannelPromptMessages,
  type OpenAICompatibleRelationshipSemanticChannelProviderConfigV0
} from "./relationship-semantic-openai-provider.js";

export {
  RELATIONSHIP_PLASTICITY_EVIDENCE_SCALE,
  RELATIONSHIP_PLASTICITY_MAX_PROJECTIONS,
  RELATIONSHIP_PLASTICITY_MAX_SINGLE_STEP,
  produceRelationshipPlasticityV0,
  type RelationshipPlasticityNoProposalReasonV0,
  type RelationshipPlasticityProducerInputV0,
  type RelationshipPlasticityProducerResultV0,
  type RelationshipPlasticityRejectionCodeV0
} from "./relationship-plasticity-producer.js";

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
} from "./relationship-adaptation-workflow.js";

export {
  OllamaRelationshipSemanticChannelProviderV0,
  type OllamaRelationshipSemanticChannelProviderConfigV0
} from "./relationship-semantic-ollama-provider.js";

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
} from "./relationship-feature-decision-semantics.js";

// --- Relationship Governed Dimension Namespace V0 ------------------------------------------------------

export {
  RELATIONSHIP_GOVERNED_DIMENSION_RESERVED_PREFIX_V0,
  isReservedRelationshipCoreDimensionIdV0
} from "./relationship-governed-dimension-namespace.js";
