/**
 * PersonalityState V0 — canonical slow-state foundation.
 * Personality update proposal + transition executor + deterministic identity.
 */

export {
  PERSONALITY_UPDATE_PROPOSAL_SCHEMA_VERSION,
  PERSONALITY_TRANSITION_ID_PROJECTION,
  PERSONALITY_EVIDENCE_MEMBER_SET_PROJECTION,
  deriveEvidenceMemberSetFingerprint,
  derivePersonalityTransitionId,
  validatePersonalityUpdateProposal,
  type PersonalityDimensionUpdateV0,
  type PersonalityEvidenceBindingV0,
  type PersonalityUpdateProposalV0
} from "./personality-update-proposal.js";

export {
  initializeEmptyPersonalityState,
  initializePersonalityFromTraitsSeed
} from "./personality-init.js";

export {
  PersonalityTransitionExecutor,
  type PersonalityExecutionResult,
  type RuntimeContext
} from "./personality-transition-executor.js";
