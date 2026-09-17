/**
 * EXPLORATORY_EXECUTOR_SCHEMA_FAILURE_DIAGNOSTIC_V0 — frozen diagnostic contract.
 *
 * WHAT THIS IS: a NON-CONFIRMATORY, exploratory investigation of ONE question —
 * when `deepseek-flash` emits `MODEL_SCHEMA_INVALID` under the frozen V8
 * cognition request, which production schema / host-authority contract does the
 * response actually violate?
 *
 * WHAT THIS IS NOT: it is not a calibration, not a re-run of the consumed
 * calibration, not a new calibration result, not a confirmatory experiment and
 * not evidence for or against any causal claim. It uses no RUN/STOP law, no
 * Δ_min, no epsilon and no confirmatory threshold: the sample size serves
 * failure characterization only.
 *
 * The pre-written stop rule below is frozen BEFORE the first diagnostic call and
 * must never be widened after seeing an outcome.
 */

export const DIAGNOSTIC_ID = "EXPLORATORY_EXECUTOR_SCHEMA_FAILURE_DIAGNOSTIC_V0" as const;
export const DIAGNOSTIC_NAMESPACE = "EXECUTOR_SCHEMA_DIAGNOSTIC" as const;

/**
 * Every diagnostic artifact carries these markers verbatim, so no reader and no
 * downstream tool can mistake exploratory data for confirmatory evidence.
 */
export const DIAGNOSTIC_MARKERS = Object.freeze({
  EXPLORATORY_ONLY: true,
  NON_CONFIRMATORY: true,
  NOT_IN_CALIBRATION_DENOMINATOR: true,
  NOT_PRIMARY_AUTHORIZATION_EVIDENCE: true,
  IS_NOT_A_CALIBRATION_RERUN: true,
  DOES_NOT_MODIFY_PRIOR_RESULT: true
});

/** The consumed calibration authority this diagnostic references (read-only). */
export const CALIBRATION_PREREG_SHA = "917d5d107cc29033b036682875b69be9d02d34f2" as const;
export const CALIBRATION_RESULT_VERDICT = "EXECUTOR_CALIBRATION_STOP_EARLY" as const;

/** The frozen model-facing request this diagnostic must reproduce byte-identically. */
export const FROZEN_MODEL_FACING_REQUEST_HASH =
  "sha256:db8d8993c63e6de476c4ddb28dff5c55d5716f8f1fb3cc23ccfcd841bc31f509" as const;
export const FROZEN_MODEL_FACING_REQUEST_BYTES = 16085 as const;

/**
 * STOP RULE — written before the first diagnostic call, never widened afterwards:
 *
 *   R1  the diagnostic stops as soon as `DIAGNOSTIC_TARGET_SCHEMA_INVALID_EXAMPLES`
 *       responses have been classified SCHEMA_VALID = false (the mechanism is the
 *       object of study, not a rate);
 *   R2  the diagnostic stops unconditionally at `DIAGNOSTIC_MAX_MODEL_CALLS`
 *       calls, whatever the mixture of outcomes;
 *   R3  the diagnostic stops immediately, before the next call, on any pre-call
 *       integrity failure (request-byte drift, response-model drift, unexpected
 *       transport surface);
 *   R4  the diagnostic NEVER retries a schema/host-rejected response, and never
 *       extends the budget because a particular failure family looks interesting.
 */
export const DIAGNOSTIC_MAX_MODEL_CALLS = 30 as const;
export const DIAGNOSTIC_TARGET_SCHEMA_INVALID_EXAMPLES = 3 as const;

export const DIAGNOSTIC_STOP_RULE = Object.freeze({
  rule_id: "EXPLORATORY_DIAGNOSTIC_STOP_RULE_V0",
  frozen_before_first_call: true,
  max_model_calls: DIAGNOSTIC_MAX_MODEL_CALLS,
  stop_when_schema_invalid_examples_reach: DIAGNOSTIC_TARGET_SCHEMA_INVALID_EXAMPLES,
  retry_invalid_responses: false,
  budget_may_be_widened_after_outcomes: false,
  rationale:
    "the diagnostic characterizes a FAILURE MECHANISM, so it needs a handful of real rejections and a hard ceiling — not a rate, not a p-value and not a confirmatory denominator",
  uses_run_stop_law: false,
  uses_delta_min_or_epsilon: false,
  contributes_to_any_denominator: false
});

/** Every stage of the trace, in the order the production pipeline reaches them. */
export const DIAGNOSTIC_STAGES: readonly string[] = Object.freeze([
  "STAGE_A_TRANSPORT",
  "STAGE_B_ENVELOPE_JSON",
  "STAGE_C_CONTENT_JSON",
  "STAGE_D_PRODUCTION_SCHEMA",
  "STAGE_E_PRODUCTION_HOST_AUTHORITY",
  "STAGE_F_DIRECTIVE_ADMISSIBILITY"
]);

/**
 * Candidate failure categories DECLARED BEFORE the first diagnostic call. They are
 * a vocabulary, never a hypothesis: a category appears in a result ONLY when real
 * captured evidence supports it, and unobserved ones are reported as
 * declared-but-unobserved.
 */
export const FAILURE_TAXONOMY_DECLARED_BEFORE_CALLS: readonly string[] = Object.freeze([
  "JSON_SYNTAX_INVALID",
  "REQUIRED_FIELD_MISSING",
  "ENUM_INVALID",
  "TYPE_INVALID",
  "UNEXPECTED_KEY",
  "CLOSED_KEY_SET_VIOLATION",
  "SCHEMA_VERSION_INVALID",
  "PROJECTION_BINDING_INVALID",
  "SOURCE_HANDLE_INVALID",
  "RESPONSE_SEMANTICS_INCOMPLETE",
  "DERIVATION_INVALID",
  "HOST_AUTHORITY_INVALID",
  "DIRECTIVE_NOT_ADMISSIBLE",
  "TRANSPORT_FAILURE",
  "OTHER_SCHEMA_FAILURE"
]);

/**
 * Categories ADDED AFTER the run, derived from captured production output
 * (the taxonomy is built from real data, and an unlisted rule must not be hidden
 * inside `OTHER_SCHEMA_FAILURE`). Each addition is mechanical, is listed here
 * explicitly so a reviewer can see exactly what was added and when, and neither
 * the stop rule nor the call budget was touched.
 */
export const FAILURE_TAXONOMY_ADDED_AFTER_RUN: readonly string[] = Object.freeze([
  "LENGTH_BOUND_EXCEEDED"
]);

export const FAILURE_TAXONOMY_IDS: readonly string[] = Object.freeze([
  ...FAILURE_TAXONOMY_DECLARED_BEFORE_CALLS,
  ...FAILURE_TAXONOMY_ADDED_AFTER_RUN
]);

export const DIAGNOSTIC_ARTIFACT_SCHEMA_VERSION = "executor-schema-failure-diagnostic-v0" as const;

/**
 * The production validator's error surface is a human-readable `detail` string
 * with the shape `<json-path>: <rule>` (or a `SEMANTIC_COMPLETENESS_FAILED:`
 * prefix). It does NOT expose a structured keyword/expected/actual tuple, and the
 * diagnostic must never invent one: the RAW string is the authority here, and the
 * split below is a labelled, purely mechanical slicing of that string.
 */
export const PRODUCTION_VALIDATOR_STRUCTURED_FIELDS_EXPOSED = false as const;
export const PRODUCTION_VALIDATOR_SURFACE_NOTE =
  "the production validator exposes a path-prefixed detail STRING and a factual-authorization trace; it does not expose keyword/expected/actual tuples, so those fields are reported as NOT_EXPOSED_BY_PRODUCTION_VALIDATOR rather than guessed";
