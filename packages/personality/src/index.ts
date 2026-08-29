/**
 * @characteros-next/personality — PersonalityPlasticityProducerV0 + explicit
 * PersonalityEvidenceChannelPolicyV0. Deterministic, host/config-supplied
 * semantic routing and bounded plasticity proposal production. The additive
 * semantic layer may ask a least-authority provider to choose one allowlisted
 * channel or ABSTAIN from an exact authoritative evidence set; only its explicit
 * OpenAI-compatible adapter can reach the existing runtime transport. No layer
 * performs canonical mutation or uses wall clock. Canonical authority stays
 * with SubjectCore (frozen PersonalityTransitionExecutor).
 */

export {
  ENGINEERING_REFERENCE_V0_PLASTICITY_POLICY,
  proposePersonalityPlasticityV0,
  validatePersonalityPlasticityPolicy,
  type PersonalityPlasticityContextV0,
  type PersonalityPlasticityDirectionV0,
  type PersonalityPlasticityPolicyV0,
  type PersonalityPlasticityResultV0,
  type PersonalityPlasticityTargetV0
} from "./personality-plasticity-producer.js";

export {
  PERSONALITY_EVIDENCE_CHANNEL_DECISION_SCHEMA_VERSION,
  PERSONALITY_EVIDENCE_CHANNEL_POLICY_FINGERPRINT_PROJECTION,
  PERSONALITY_EVIDENCE_CHANNEL_POLICY_SCHEMA_VERSION,
  derivePersonalityEvidenceChannelPolicyFingerprint,
  producePersonalityPlasticityFromChannel,
  resolvePersonalityEvidenceChannel,
  validatePersonalityEvidenceChannelPolicy,
  type PersonalityEvidenceChannelDecisionV0,
  type PersonalityEvidenceChannelPlasticityResultV0,
  type PersonalityEvidenceChannelPolicyV0,
  type PersonalityEvidenceChannelResolutionV0,
  type PersonalityEvidenceChannelRuleV0
} from "./personality-evidence-channel.js";

export {
  PERSONALITY_SEMANTIC_CHANNEL_AUDIT_SCHEMA_VERSION,
  PERSONALITY_SEMANTIC_CHANNEL_CATALOG_SCHEMA_VERSION,
  PERSONALITY_SEMANTIC_CHANNEL_PROPOSAL_SCHEMA_VERSION,
  PERSONALITY_SEMANTIC_CATALOG_FINGERPRINT_PROJECTION,
  PERSONALITY_SEMANTIC_CONTEXT_FINGERPRINT_PROJECTION,
  PERSONALITY_SEMANTIC_EVIDENCE_PROJECTION_SCHEMA_VERSION,
  PERSONALITY_SEMANTIC_MAX_CHANNELS,
  PERSONALITY_SEMANTIC_MAX_CRITERION_LENGTH,
  PERSONALITY_SEMANTIC_MAX_SCENE_LENGTH,
  PERSONALITY_SEMANTIC_MAX_SELECTED_RECORDS,
  DeterministicReferenceSemanticChannelProviderV0,
  derivePersonalitySemanticCatalogFingerprint,
  derivePersonalitySemanticContextFingerprint,
  producePersonalityPlasticityFromSemanticChannelProposal,
  runPersonalitySemanticChannelProposalV0,
  validatePersonalitySemanticChannelCatalog,
  type DeterministicReferenceSemanticChannelDecisionV0,
  type PersonalitySemanticChannelAcceptedV0,
  type PersonalitySemanticChannelAuditV0,
  type PersonalitySemanticChannelCatalogV0,
  type PersonalitySemanticChannelDefinitionV0,
  type PersonalitySemanticChannelProposalV0,
  type PersonalitySemanticChannelProviderCatalogV0,
  type PersonalitySemanticChannelProviderInputV0,
  type PersonalitySemanticChannelProviderV0,
  type PersonalitySemanticChannelRejectionCodeV0,
  type PersonalitySemanticChannelRunResultV0,
  type PersonalitySemanticChannelRunnerInputV0,
  type PersonalitySemanticEvidenceItemV0,
  type PersonalitySemanticEvidenceProjectionV0,
  type PersonalitySemanticEvidenceRepositoryV0,
  type PersonalitySemanticPlasticityBridgeRejectionCodeV0,
  type PersonalitySemanticPlasticityBridgeResultV0
} from "./personality-semantic-channel.js";

export {
  PERSONALITY_SEMANTIC_PROMPT_PROJECTION_VERSION,
  PERSONALITY_SEMANTIC_PROVIDER_MAX_OUTPUT_TOKENS,
  OpenAICompatiblePersonalitySemanticChannelProviderV0,
  PersonalitySemanticProviderWireErrorV0,
  buildPersonalitySemanticChannelPromptMessages,
  type OpenAICompatiblePersonalitySemanticChannelProviderConfigV0
} from "./personality-semantic-openai-provider.js";
