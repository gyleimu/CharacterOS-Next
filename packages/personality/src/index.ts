/**
 * @characteros-next/personality — PersonalityPlasticityProducerV0 + explicit
 * PersonalityEvidenceChannelPolicyV0. Deterministic, host/config-supplied
 * semantic routing and bounded plasticity proposal production. Pure layers:
 * no canonical mutation, no automatic evidence/channel selection, no semantic
 * inference, no LLM, no network, no wall clock. Canonical authority stays with
 * SubjectCore (frozen PersonalityTransitionExecutor).
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
