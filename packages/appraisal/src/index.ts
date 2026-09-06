export type {
  AppraisalProposal,
  AppraisalProvider,
  InterpretationProposal,
  InterpretationProvider
} from "./types.js";

// --- EXPERIENCE_APPRAISAL_INTEGRATION_V0 — shared Appraisal foundation --------------

export {
  APPRAISAL_ATTRIBUTION_LITERALS_V0,
  EXPERIENCE_APPRAISAL_PROPOSAL_SCHEMA_VERSION,
  EXPERIENCE_APPRAISAL_PROVIDER_CONTRACT_VERSION,
  EXPERIENCE_APPRAISAL_RECORD_SCHEMA_VERSION,
  EXPERIENCE_APPRAISAL_KIND_INITIAL,
  EXPERIENCE_APPRAISAL_SUBJECT_CONTEXT_SCHEMA_VERSION,
  validateAppraisalDimensionsV0,
  validateExperienceAppraisalProposalV0,
  validateExperienceAppraisalRecordV0,
  deriveExperienceAppraisalProposalHashV0,
  deriveExperienceAppraisalRefV0,
  type AppraisalAttributionV0,
  type AppraisalDimensionsV0,
  type ExperienceAppraisalProposedV0,
  type ExperienceAppraisalInsufficientV0,
  type ExperienceAppraisalProposalV0,
  type ExperienceAppraisalRecordV0
} from "./experience-appraisal-v0.js";

// --- PRE_COGNITION_CANONICAL_APPRAISAL_V0 — event-grounded INITIAL Appraisal --------

export {
  FACTUAL_EVENT_APPRAISAL_PROPOSAL_SCHEMA_VERSION,
  FACTUAL_EVENT_APPRAISAL_RECORD_SCHEMA_VERSION,
  FACTUAL_EVENT_APPRAISAL_PROVIDER_CONTRACT_VERSION,
  FACTUAL_EVENT_APPRAISAL_SUBJECT_CONTEXT_SCHEMA_VERSION,
  FACTUAL_EVENT_APPRAISAL_REF_PROJECTION,
  SEMANTIC_APPRAISAL_EPISODE_INITIAL,
  SEMANTIC_APPRAISAL_EPISODES,
  deriveFactualEventAppraisalProposalHashV0,
  deriveFactualEventAppraisalRefV0,
  deriveFactualEventAppraisalIntentId,
  validateFactualEventAppraisalProposalV0,
  validateFactualEventAppraisalRecordV0,
  type FactualEventAppraisalIdentityV0,
  type FactualEventAppraisalProposedV0,
  type FactualEventAppraisalInsufficientV0,
  type FactualEventAppraisalProposalV0,
  type FactualEventAppraisalRecordV0,
  type FactualEventAppraisalContextProjectionV0,
  type FactualEventAppraisalProviderV0
} from "./factual-event-appraisal-v0.js";
