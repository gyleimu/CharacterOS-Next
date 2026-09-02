/**
 * Relationship Governed Dimension Namespace V0 — CharacterOS-owned reservation
 * of the `relationship_core_*` dimension-id namespace
 * (RELATIONSHIP_RESERVED_NAMESPACE_AND_GENERIC_WRITER_HARDENING_V0).
 *
 * This module owns ONLY the namespace reservation:
 *   - the exact reserved prefix literal
 *   - one pure, exact-prefix classifier
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

/**
 * The exact reserved prefix for CharacterOS-governed Relationship feature
 * dimensions. Generic writers forbid this namespace; a future registration
 * slice requires governed dimensions to live inside it.
 */
export const RELATIONSHIP_GOVERNED_DIMENSION_RESERVED_PREFIX_V0 =
  "relationship_core_" as const;

/**
 * Pure exact-prefix classifier: true iff the identifier's exact beginning is
 * `relationship_core_`. No fuzzy matching, no case folding, no regex
 * guessing, no psychological-meaning validation.
 *
 *   reserved:     relationship_core_x, relationship_core_relational_bond_strength_v0
 *   NOT reserved: relationship, relationship_core, relationship-core_x,
 *                 x_relationship_core_y, test_trust_like, arbitrary_host_dimension
 */
export function isReservedRelationshipCoreDimensionIdV0(dimensionId: string): boolean {
  return dimensionId.startsWith(RELATIONSHIP_GOVERNED_DIMENSION_RESERVED_PREFIX_V0);
}
