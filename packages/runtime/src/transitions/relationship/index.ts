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
