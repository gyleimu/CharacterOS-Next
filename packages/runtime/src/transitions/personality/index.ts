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
  PERSONALITY_DIMENSION_DOMAIN,
  PERSONALITY_DIMENSION_IDS_V0,
  PERSONALITY_DIMENSION_REGISTRY_SCHEMA_VERSION,
  PERSONALITY_DIMENSION_REGISTRY_V0,
  isCanonicalPersonalityDimensionV0,
  type PersonalityDimensionDefinitionV0
} from "./personality-dimension-registry-v0.js";

export {
  PERSONALITY_GENESIS_PRIOR_SCHEMA_VERSION,
  buildGenesisPersonalityFromPriorV0,
  traitsSeedFromPersonalityGenesisPriorV0,
  validatePersonalityGenesisPriorV0,
  type PersonalityGenesisPriorV0
} from "./personality-genesis-prior-v0.js";

export {
  PersonalityTransitionExecutor,
  type PersonalityExecutionResult
} from "./personality-transition-executor.js";
