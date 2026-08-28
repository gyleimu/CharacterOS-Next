/**
 * PersonalityState V0 — deterministic initialization helpers.
 *
 * ENGINEERING_INITIALIZATION_V0: the derivations below are explicit,
 * deterministic engineering initializations, NOT psychological truth and NOT
 * historical acquisition inference. The traits_seed → PersonalityState mapping
 * is EXACT (same key grammar, same UnitIntervalV0 value domain) and is performed
 * only when a caller explicitly requests it; it never mutates traits_seed.
 */

import {
  PERSONALITY_STATE_SCHEMA_VERSION,
  validateIdentifier,
  validateUnitInterval,
  type PersonalityStateV0,
  type TraitsSeedV0
} from "@characteros-next/subject-core";

/** Empty registered container: the legal V0 default (no dimensions registered). */
export function initializeEmptyPersonalityState(): PersonalityStateV0 {
  return { schema_version: PERSONALITY_STATE_SCHEMA_VERSION, dimensions: [] };
}

/**
 * Explicit deterministic derivation of the initial registered dimension set
 * from the immutable traits_seed. Every seed key becomes a registered
 * dimension_id with the same value; unknown/unverifiable entries fail closed.
 * traits_seed itself is only READ — never written.
 */
export function initializePersonalityFromTraitsSeed(
  seed: TraitsSeedV0
): PersonalityStateV0 {
  const entries = Object.entries(seed.dimensions);
  const dimensions = entries
    .map(([dimension_id, value]) => {
      const id = validateIdentifier(dimension_id, "personality.dimensions.dimension_id");
      if (!id.ok) {
        throw new Error(`INVALID_SEED_DIMENSION: ${id.error.reason} ${id.error.detail}`);
      }
      const v = validateUnitInterval(value, "personality.dimensions.value");
      if (!v.ok) {
        throw new Error(`INVALID_SEED_VALUE: ${v.error.reason} ${v.error.detail}`);
      }
      return { dimension_id: id.value, value: v.value };
    })
    .sort((a, b) => (a.dimension_id < b.dimension_id ? -1 : a.dimension_id > b.dimension_id ? 1 : 0));
  return { schema_version: PERSONALITY_STATE_SCHEMA_VERSION, dimensions };
}
