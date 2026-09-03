/**
 * Relationship Governed Dimension Namespace V0 — CharacterOS-owned reservation
 * of the `relationship_core_*` dimension-id namespace
 * (RELATIONSHIP_RESERVED_NAMESPACE_AND_GENERIC_WRITER_HARDENING_V0).
 *
 * SOURCE OF TRUTH (RELATIONSHIP_GOVERNED_FEATURE_WRITER_AUTHORITY_V0 §4): the
 * exact prefix literal and the pure exact-prefix classifier now live in the
 * SubjectCore writer-authority boundary (one persistence-layer source of
 * truth; RELATIONSHIP_GOVERNED_RESERVED_PREFIX_SOURCE_COUNT = ONE) and are
 * re-exported here UNCHANGED — exact same value, exact same behavior. This
 * module keeps the namespace-reservation documentation and the frozen
 * executable distinctions.
 *
 * EXECUTABLE DISTINCTION (frozen):
 *   reserved ID          = generic host writer forbidden
 *   reserved ID          != registered feature
 *   reserved ID          != positive decision admission
 *   reserved ID          != authoritative canonical value
 *
 * A dimension matching the reserved prefix is only RESERVED. Full governance
 * later requires reserved namespace + registered semantics + authoritative
 * value lineage — so this module deliberately exposes NO predicate named
 * "isGovernedRelationshipFeature". Generic Relationship writers reject
 * reserved ids independently of registry membership; ordinary opaque,
 * non-reserved dimensions keep their existing generic behavior unchanged.
 * No registry entry, no admission logic, no numeric mapping, no model.
 */

// Single SubjectCore-owned source of truth; exact same value and behavior as
// the original local definitions (RESERVED_NAMESPACE_SEMANTICS_CHANGED = NO).
export {
  isReservedRelationshipCoreDimensionIdV0,
  RELATIONSHIP_GOVERNED_DIMENSION_RESERVED_PREFIX_V0
} from "@characteros-next/subject-core";
