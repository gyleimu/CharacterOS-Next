/**
 * DecisionProbeV1 — frozen measurement protocol. RESEARCH-ONLY.
 *
 * V1 does NOT change the measurement contract text. It changes WHICH MODE is the measurement
 * contract, WHAT qualifies as evidence, and adds three frozen audits that V0 did not have.
 *
 * V0 is untouched: `research/experiments/decision-probe-v0/` and all of its evidence remain
 * byte-identical. V1 lives in its own version namespace with its own schema version token, its
 * own request hashes, and its own artifacts.
 *
 * THE ONLY DELTA IN THE MEASUREMENT CONTRACT vs V0 is the schema version token. The override
 * block is re-derived from V0's block by substituting that single token, and the audit in
 * `audits.ts` proves no other character differs. Three definitions, the enum, the JSON schema
 * shape, `r_pilot`, the fixtures, the expected decisions and every generation setting are
 * inherited byte-identically.
 */

import {
  DECISION_PROBE_DEFINITIONS_V0,
  DECISION_PROBE_DECISIONS,
  DECISION_PROBE_EXPLANATION_MAX_CODE_POINTS_V0,
  DECISION_PROBE_OVERRIDE_BLOCK_V0,
  DECISION_PROBE_SCHEMA_VERSION
} from "../decision-probe-v0/contract.ts";

/** V1's own schema version token. Required to differ from V0's (version independence). */
export const DECISION_PROBE_V1_SCHEMA_VERSION = "decision-probe-v1" as const;

/** The single declared delta: the version token, substituted once. */
export const DECISION_PROBE_V1_TOKEN_SUBSTITUTION_COUNT = 1 as const;

/** V1's override block = V0's block with exactly the version token substituted. */
export const DECISION_PROBE_V1_OVERRIDE_BLOCK_V0_INHERITED: string =
  DECISION_PROBE_OVERRIDE_BLOCK_V0.replaceAll(
    `"${DECISION_PROBE_SCHEMA_VERSION}"`,
    `"${DECISION_PROBE_V1_SCHEMA_VERSION}"`
  );

export const DECISION_PROBE_V1_JSON_SCHEMA: Readonly<Record<string, unknown>> = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["decision_probe_schema_version", "decision"],
  properties: {
    decision_probe_schema_version: { const: DECISION_PROBE_V1_SCHEMA_VERSION },
    decision: { enum: [...DECISION_PROBE_DECISIONS] },
    explanation: {
      type: "string",
      minLength: 1,
      maxLength: DECISION_PROBE_EXPLANATION_MAX_CODE_POINTS_V0
    }
  }
});

/** Inherited invariants, re-exported so a V1 artifact never needs to read V0 at run time. */
export const DECISION_PROBE_V1_INHERITED_V0 = Object.freeze({
  decisions: DECISION_PROBE_DECISIONS,
  definitions: DECISION_PROBE_DEFINITIONS_V0,
  source_schema_version: DECISION_PROBE_SCHEMA_VERSION,
  source_override_block_length: DECISION_PROBE_OVERRIDE_BLOCK_V0.length
});

/**
 * V1 QUALIFICATION RULE (frozen).
 *
 * `DECISION_INSTRUMENT_V1_QUALIFIED` requires, in the MEASUREMENT mode
 * (`SUBSTITUTION_WITH_OVERRIDE`):
 *   - every frozen fixture's modal decision equals its pre-registered expectation;
 *   - agreement >= the frozen `min_agreement_fraction`;
 *   - schema-rejection rate within the frozen `max_schema_rejection_rate`;
 *   - zero transport failures on the qualification cells;
 *   - CONSTRUCT_NEUTRALITY audit PASS;
 *   - FIXTURE_BLINDNESS audit PASS;
 *   - STATE_BLINDNESS audit PASS.
 *
 * `PURE_SUBSTITUTION` is a DIAGNOSTIC in V1. Its result is reported and never vetoes the
 * measurement mode. Its retained load-bearing claim is narrower and still real:
 * it establishes `SCHEMA_SUBSTITUTION_HONORED` — that the executor obeys a swapped JSON schema
 * at all. Its failure on an ambiguous fixture establishes
 * `CONSTRUCT_NOT_INSTANTIATED_BY_SCHEMA_ALONE`, which is a statement about the *control*, not
 * about the measurability of the construct.
 *
 * NOT applied retrospectively: V0's `INCONCLUSIVE_BY_MODE_DIVERGENCE` stands.
 */
export const DECISION_PROBE_V1_QUALIFICATION_RULE = Object.freeze({
  measurement_mode: "SUBSTITUTION_WITH_OVERRIDE" as const,
  diagnostic_mode: "PURE_SUBSTITUTION" as const,
  diagnostic_vetoes: false as const,
  diagnostic_retained_claim: "SCHEMA_SUBSTITUTION_HONORED" as const,
  requires_audits: ["CONSTRUCT_NEUTRALITY", "FIXTURE_BLINDNESS", "STATE_BLINDNESS"] as const,
  applies_retrospectively_to_v0: false as const
});

/** V1 verdict vocabulary. `DECISION_INSTRUMENT_V1_QUALIFIED` is executor-scoped by rule. */
export const DECISION_PROBE_V1_VERDICTS = Object.freeze([
  "DECISION_INSTRUMENT_V1_QUALIFIED",
  "DECISION_INSTRUMENT_V1_UNQUALIFIED",
  "EXECUTOR_UNQUALIFIED_FOR_DECISION_PROBE",
  "INCONCLUSIVE_BY_DECISION_NOISE",
  "INCONCLUSIVE_AUDIT_FAILED"
] as const);
