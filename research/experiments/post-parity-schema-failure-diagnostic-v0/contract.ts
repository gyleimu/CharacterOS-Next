/**
 * POST_PARITY_SCHEMA_FAILURE_DIAGNOSTIC — frozen diagnostic contract.
 *
 * A NEW, independent exploratory namespace. The previous diagnostic
 * (EXECUTOR_SCHEMA_FAILURE_DIAGNOSTIC, commit e1dbc31/561032f) characterized the
 * UNDERSPECIFIED-contract mechanism and its artifacts stay immutable; this one
 * asks the follow-up question: under the FULLY VISIBLE post-parity contract,
 * which production rule does a rejection actually violate?
 *
 * EXPLORATORY ONLY. It is not a calibration, not a re-run of any calibration, not
 * evidence about readiness, and it enters no denominator. It makes no rate claim:
 * a handful of captured rejections characterizes a MECHANISM, nothing else.
 *
 * The stop rule below is frozen BEFORE the first diagnostic call.
 */

export const DIAGNOSTIC_ID = "POST_PARITY_SCHEMA_FAILURE_DIAGNOSTIC_V0" as const;
export const DIAGNOSTIC_NAMESPACE = "POST_PARITY_SCHEMA_FAILURE_DIAGNOSTIC" as const;

export const DIAGNOSTIC_MARKERS = Object.freeze({
  EXPLORATORY_ONLY: true,
  NON_CONFIRMATORY: true,
  NOT_CALIBRATION_RERUN: true,
  NOT_IN_CALIBRATION_DENOMINATOR: true,
  NOT_PRIMARY_AUTHORIZATION_EVIDENCE: true,
  DOES_NOT_MODIFY_PRIOR_RESULTS: true
});

/**
 * STOP RULE — frozen before the first call, never widened after seeing results:
 *
 *   R1  stop as soon as TARGET_SCHEMA_INVALID_EXAMPLES real schema-invalid
 *       responses have been captured (the object of study is the MECHANISM, so a
 *       couple of real examples suffice);
 *   R2  stop unconditionally at MAX_CALLS calls;
 *   R3  stop immediately, before the next call, on any pre-call integrity failure;
 *   R4  never retry a validation failure and never extend the budget because a
 *       particular failure family looks interesting.
 */
export const MAX_CALLS = 40 as const;
export const TARGET_SCHEMA_INVALID_EXAMPLES = 2 as const;

export const DIAGNOSTIC_STOP_RULE = Object.freeze({
  rule_id: "POST_PARITY_DIAGNOSTIC_STOP_RULE_V0",
  frozen_before_first_call: true,
  max_calls: MAX_CALLS,
  target_schema_invalid_examples: TARGET_SCHEMA_INVALID_EXAMPLES,
  retry_invalid_responses: false,
  budget_may_be_widened_after_outcomes: false,
  estimates_failure_rate: false,
  uses_calibration_readiness_law: false,
  contributes_to_any_denominator: false,
  rationale:
    "exploratory characterization of a rejection mechanism: a couple of real captured rejections plus a hard ceiling, never a rate, a probability or a readiness estimate"
});

/**
 * The post-parity authority this diagnostic binds. The request must be
 * BYTE-IDENTICAL to the formal post-parity calibration: no debug hint, no
 * "stay below N" reminder, no few-shot, no repair instruction may be added —
 * such an addition would destroy the diagnostic's validity.
 */
export const POST_PARITY_AUTHORITY = Object.freeze({
  preregistration_commit: "cc7caf4ddd2a73e85061fe3b16953c8beb8920b5",
  manifest_hash: "sha256:356f482cd843e77e480e05ed098891227cbe7c06fb36d20a568a8f6948656a56",
  request_hash: "sha256:79f1d679c6dcd9622f4f154055462ca540eed56680847499a3b4420971ac9c35",
  request_bytes: 17381,
  system_hash: "sha256:044bfe7b7641cb9cadcf9f02005560fd6b9332576bcfb3c8a0cd40ae4a91f121",
  user_hash: "sha256:55d27d60fe3087537e66c1075dbe43677160ddbc0d8569207577b46962a219f3",
  schema_hash: "sha256:54ac7977f3b9e7f2e422fd6dc5f218fe34e82ffc368ebec68a58b4e634feec35",
  model_config_hash: "sha256:0ed9df37fb4b2981ae5ff69bbe37c0858ea82cec200bb87249f66478927810d5",
  executor_model: "deepseek-flash",
  post_parity_calibration_terminal_result: "EXECUTOR_CALIBRATION_RESULT_APPROVED_STOP_EARLY",
  /** The formal calibration's rejections stay UNATTRIBUTED: the evidence records the class only. */
  formal_calibration_invalid_trials: [43, 44, 49] as readonly number[],
  formal_calibration_failure_class: "MODEL_SCHEMA_INVALID" as const,
  formal_calibration_failure_exact_rule: "UNKNOWN_OR_NOT_PERSISTED" as const,
  formal_calibration_root_cause: "NOT_IDENTIFIED" as const
});

export const DIAGNOSTIC_ARTIFACT_SCHEMA_VERSION = "post-parity-schema-failure-diagnostic-v0" as const;

export const DIAGNOSTIC_STAGES: readonly string[] = Object.freeze([
  "STAGE_A_TRANSPORT",
  "STAGE_B_ENVELOPE_JSON",
  "STAGE_C_CONTENT_JSON",
  "STAGE_D_PRODUCTION_SCHEMA",
  "STAGE_E_PRODUCTION_HOST_AUTHORITY",
  "STAGE_F_DIRECTIVE_ADMISSIBILITY"
]);

/**
 * Candidate categories. The declared list is a VOCABULARY, never a hypothesis:
 * only categories the captured evidence supports appear in a result, and
 * unobserved ones are reported as declared-but-unobserved. No root cause is
 * presumed for the formal calibration's rejections.
 */
export const FAILURE_TAXONOMY_DECLARED_BEFORE_CALLS: readonly string[] = Object.freeze([
  "LENGTH_BOUND_EXCEEDED",
  "REQUIRED_FIELD_MISSING",
  "ENUM_INVALID",
  "TYPE_INVALID",
  "UNEXPECTED_KEY",
  "CLOSED_KEY_SET_VIOLATION",
  "SCHEMA_VERSION_INVALID",
  "PROJECTION_BINDING_INVALID",
  "SOURCE_HANDLE_INVALID",
  "SEMANTIC_CONTRACT_INVALID",
  "DERIVATION_INVALID",
  "DIRECTIVE_NOT_ADMISSIBLE",
  "JSON_SYNTAX_INVALID",
  "TRANSPORT_FAILURE",
  "OTHER"
]);

export const PRODUCTION_VALIDATOR_STRUCTURED_FIELDS_EXPOSED = false as const;
export const PRODUCTION_VALIDATOR_SURFACE_NOTE =
  "the production validator exposes a path-prefixed detail STRING and a factual-authorization trace; it does not expose keyword/expected/actual tuples, so those fields are reported as NOT_EXPOSED_BY_PRODUCTION_VALIDATOR rather than guessed";
