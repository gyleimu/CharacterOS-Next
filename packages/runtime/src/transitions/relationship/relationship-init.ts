/**
 * RelationshipState V0 deterministic engineering initialization.
 *
 * Registration is explicit. No traits, memory, text, model output, or
 * psychological defaults are consulted. The factory canonicalizes ordering and
 * then delegates all shape/range/ref authority to SubjectCore validation.
 */

import {
  RELATIONSHIP_STATE_SCHEMA_VERSION,
  validateRelationshipState,
  type RelationshipCounterpartStateV0,
  type RelationshipStateV0
} from "@characteros-next/subject-core";
import { isReservedRelationshipCoreDimensionIdV0 } from "./relationship-governed-dimension-namespace.js";

function compareRaw(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/** Legal empty state: no persistent counterpart has been registered. */
export function initializeEmptyRelationshipState(): RelationshipStateV0 {
  return {
    schema_version: RELATIONSHIP_STATE_SCHEMA_VERSION,
    counterparts: []
  };
}

/**
 * Explicit deterministic registration for canonical initial-state construction.
 * Duplicate/invalid members fail closed; no update path calls this factory.
 */
export function initializeRelationshipState(
  counterparts: readonly RelationshipCounterpartStateV0[]
): RelationshipStateV0 {
  // Reserved-namespace guard: relationship_core_* dimensions can never enter
  // canonical state through generic initialization, independently of registry
  // membership. Ordinary opaque dimensions keep their existing behavior.
  for (const counterpart of counterparts) {
    for (const dimension of counterpart.dimensions) {
      if (isReservedRelationshipCoreDimensionIdV0(dimension.dimension_id)) {
        throw new Error(
          `INVALID_RELATIONSHIP_INITIAL_STATE: RESERVED_DIMENSION_FORBIDDEN ${dimension.dimension_id} (relationship_core_* is reserved for CharacterOS-governed features)`
        );
      }
    }
  }
  const candidate = {
    schema_version: RELATIONSHIP_STATE_SCHEMA_VERSION,
    counterparts: counterparts
      .map((counterpart) => ({
        counterpart_ref: counterpart.counterpart_ref,
        dimensions: [...counterpart.dimensions]
          .map((dimension) => ({
            dimension_id: dimension.dimension_id,
            value: dimension.value
          }))
          .sort((a, b) => compareRaw(a.dimension_id, b.dimension_id))
      }))
      .sort((a, b) => compareRaw(a.counterpart_ref, b.counterpart_ref))
  };
  const checked = validateRelationshipState(candidate, "relationships");
  if (!checked.ok) {
    throw new Error(
      `INVALID_RELATIONSHIP_INITIAL_STATE: ${checked.error.reason} ${checked.error.detail}`
    );
  }
  return Object.freeze({
    schema_version: RELATIONSHIP_STATE_SCHEMA_VERSION,
    counterparts: Object.freeze(
      candidate.counterparts.map((counterpart) =>
        Object.freeze({
          counterpart_ref: counterpart.counterpart_ref,
          dimensions: Object.freeze(
            counterpart.dimensions.map((dimension) => Object.freeze(dimension))
          )
        })
      )
    )
  });
}
