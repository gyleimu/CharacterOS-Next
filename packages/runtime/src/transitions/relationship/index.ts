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
