/** BeliefState V0 deterministic empty genesis initialization. */

import {
  BELIEF_STATE_SCHEMA_VERSION,
  type BeliefStateV0
} from "@characteros-next/subject-core";

const EMPTY_ITEMS = Object.freeze([]) as BeliefStateV0["items"];
const EMPTY_BELIEF_STATE = Object.freeze({
  schema_version: BELIEF_STATE_SCHEMA_VERSION,
  items: EMPTY_ITEMS
});

/** Deeply immutable lawful empty canonical BeliefState. */
export function initializeEmptyBeliefState(): BeliefStateV0 {
  return EMPTY_BELIEF_STATE;
}
