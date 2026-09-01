/**
 * P2.1.2 — Subject Core validation layer public surface (pure functions only).
 *
 * Every name re-exported by src/index.ts must remain exported here unchanged;
 * additional P2.1.2 validators are exported for tests and the upcoming P2.1.3
 * commit engine, which imports this layer directly.
 */

export {
  ok,
  fail,
  type ValidationResult,
  type ValidationFailure
} from "./result.js";

export {
  isCanonicalText,
  isNumber,
  isRecord,
  isString,
  parseRef,
  refKind,
  validateCanonicalText,
  validateHash,
  validateHistorySequence,
  validateIdentifier,
  validateLogicalTime,
  validateRefArray,
  validateRefElement,
  validateRepositoryRevision,
  validateStateRevision,
  validateUnitInterval
} from "./scalars.js";

export {
  BELIEF_PROPOSITION_LABEL_MAX_UTF16_CODE_UNITS,
  validateBeliefPropositionLabel,
  validateBeliefState,
  validateSubjectState,
  validatePersonalityState,
  validateRelationshipState
} from "./subject-state.js";

export { validateProposal } from "./proposal.js";

export {
  isRegisteredBinding,
  isRegisteredDomain,
  isRegisteredProducer,
  isReadonlyPath,
  isWritablePath,
  validateOwnership
} from "./ownership.js";

export {
  assertCheckedLogicalTimeAdvance,
  assertLogicalTimeMonotonic,
  assertRevisionIncrement,
  validateHashFormat
} from "./invariants.js";

export {
  RETRIEVAL_TRACE_CAPACITY,
  validateActiveEpisodeRefsShape,
  validateAffectShape,
  validateAutobiographicalIndexRevisionShape,
  validateConsolidationCursorShape,
  validateEmptyClosedObjectShape,
  validateFieldValueForPath,
  validateLastRetrievalAtShape,
  validateMoodShape,
  validatePendingEncodingRefsShape,
  validateRegulationShape,
  validateRepositoryRevisionShape,
  validateRetrievalTraceShape,
  validateWorkingContextShape,
  validateWorkingRefsShape,
  type ShapeContext
} from "./values.js";
