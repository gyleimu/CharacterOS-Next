/**
 * P2.4 — shared MICL test fixtures (test-only; not public runtime surface).
 */

import { observationInput } from "../transitions/observation/observation-fixtures.js";
import type { MICLRequestV0 } from "./micl-types.js";

/** Deterministic default MICL request: occurrence at logical time 50. */
export function miclRequest(overrides: Record<string, unknown> = {}): MICLRequestV0 {
  return {
    schema_version: "micl-request-v0",
    micl_id: "micl-m-1",
    subject_id: "subject-s0",
    expected_initial_state_revision: 0,
    observation: observationInput({
      occurrence_logical_time: 50,
      observation_id: "observation:o-micl"
    }),
    cause_refs: [],
    declared_salience: 0.42,
    ...overrides
  } as unknown as MICLRequestV0;
}
