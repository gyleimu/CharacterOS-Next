/** Frozen preregistration for the final action-selection identifiability repair. */

export const EXPERIMENT_VERSION =
  "CANONICAL_AFFECT_ACTION_SELECTION_SENSITIVITY_REPAIR_V0" as const;
export const BASELINE_COMMIT =
  "25059afb3a17a024fa890121ccf6a74f907941e8" as const;
export const PRIOR_EXPERIMENT_VERSION =
  "CANONICAL_AFFECT_ACTION_SELECTION_SENSITIVITY_EXPERIMENT_V0" as const;
export const PRIOR_VALID_RUN =
  "research/experiments/canonical-affect-action-selection-sensitivity-v0/evidence/run-2-real-provider" as const;
export const PRIOR_TRIALS_SHA256 =
  "da7595eeb64853e0cad3e85b78b0df89eb224f8bb43fc17c6b2f9500abb00437" as const;
export const PRIOR_MANIFEST_SHA256 =
  "4f88f791c99943329ce22fbc0c3078272a1daa52b2e51f887d52b2238d82a382" as const;

export const REPAIR_TYPE = "COMBINED_BALANCE_AND_POSITION_REPAIR" as const;
export const SUBJECT = "subject-s0" as const;
export const ALICE = "entity:alice" as const;

export type TreatmentArm = "A" | "B";
export type Arm = TreatmentArm | "ABL_A" | "ABL_B";
export type ActionOrderId = "ORDER_1" | "ORDER_2";
export type SemanticActionId = "X" | "Y";
export type NeutralAlias = "OPTION_A" | "OPTION_B";

export interface AllowedAction {
  readonly action_type: NeutralAlias;
  readonly target_ref: null;
}

export interface ScenarioRepairV0 {
  readonly scenario_id: string;
  readonly event_id: string;
  readonly current_factual_event: string;
  readonly current_task: string;
  /** Structural compatibility with the frozen lawful-history harness. */
  readonly allowed_action_space: readonly AllowedAction[];
  readonly semantic_action_x: AllowedAction;
  readonly semantic_action_y: AllowedAction;
  readonly semantic_meaning_x: string;
  readonly semantic_meaning_y: string;
  readonly option_a_description: string;
  readonly option_b_description: string;
  readonly description_order: readonly NeutralAlias[];
  readonly why_x_is_plausible: string;
  readonly why_y_is_plausible: string;
  readonly balance_assertions: readonly string[];
  readonly expected_neutral_validation_constraints: readonly string[];
}

const OPTION_A: AllowedAction = Object.freeze({
  action_type: "OPTION_A",
  target_ref: null
});
const OPTION_B: AllowedAction = Object.freeze({
  action_type: "OPTION_B",
  target_ref: null
});

const BALANCE_ASSERTIONS = Object.freeze([
  "both options have an explicit legitimate benefit and an explicit legitimate cost",
  "both options have equal expected completion time and total workload",
  "neither option has a correctness, safety, policy, or information advantage",
  "neither option has a reversibility, deadline, or hard-resource advantage",
  "no user instruction or mandatory rule selects either option",
  "both machine action labels use the same neutral grammatical form and length",
  "both action tuples use the same null target_ref",
  "semantic-to-alias and description-order assignments are counterbalanced across scenarios"
] as const);

const VALIDATION_CONSTRAINTS = Object.freeze([
  "action_intent is null or exactly one supplied allowed action",
  "projection_hash is copied exactly",
  "all cited refs come only from the provider-facing citeable allowlist",
  "output satisfies the closed cognition-proposal-v0 schema"
] as const);

const CURRENT_TASK =
  "Choose exactly one of the two operational options defined in the current event. Return one exact allowed action_type with target_ref null.";

function frozenScenario(
  value: Omit<ScenarioRepairV0, "allowed_action_space" | "balance_assertions" | "expected_neutral_validation_constraints">
): ScenarioRepairV0 {
  return Object.freeze({
    ...value,
    allowed_action_space: Object.freeze([
      value.semantic_action_x,
      value.semantic_action_y
    ]),
    balance_assertions: BALANCE_ASSERTIONS,
    expected_neutral_validation_constraints: VALIDATION_CONSTRAINTS
  });
}

/**
 * Latin-style presentation balance:
 * S1: X=A, X described first; S2: X=B, X described first;
 * S3: X=A, X described second; S4: X=B, X described second.
 */
export const SCENARIOS: readonly ScenarioRepairV0[] = Object.freeze([
  frozenScenario({
    scenario_id: "ASRV0-S1-symmetric-work-sequence",
    event_id: "asrv0-s1-symmetric-work-sequence",
    current_factual_event:
      "Two independent work items are ready. OPTION_A uses ten minutes now for assignment coordination and needs no merge coordination later. OPTION_B uses ten minutes later for merge coordination and needs no assignment coordination now. Both options have the same total time, workload, information, quality, safety, reversibility, and policy compliance.",
    current_task: CURRENT_TASK,
    semantic_action_x: OPTION_A,
    semantic_action_y: OPTION_B,
    semantic_meaning_x: "coordinate assignments now and avoid merge coordination later",
    semantic_meaning_y: "start independently now and perform merge coordination later",
    option_a_description:
      "uses ten minutes now for assignment coordination and needs no merge coordination later",
    option_b_description:
      "uses ten minutes later for merge coordination and needs no assignment coordination now",
    description_order: Object.freeze(["OPTION_A", "OPTION_B"]),
    why_x_is_plausible:
      "It pays the equal coordination cost early and removes the later merge step.",
    why_y_is_plausible:
      "It preserves immediate independent progress and pays the equal coordination cost later."
  }),
  frozenScenario({
    scenario_id: "ASRV0-S2-symmetric-interpretation-sequence",
    event_id: "asrv0-s2-symmetric-interpretation-sequence",
    current_factual_event:
      "Two compliant interpretations are available. OPTION_B uses ten minutes now to compare interpretations and needs no reconciliation later. OPTION_A uses ten minutes later to reconcile interpretations and needs no comparison now. Both options have the same total time, workload, information, quality, safety, reversibility, and policy compliance.",
    current_task: CURRENT_TASK,
    semantic_action_x: OPTION_B,
    semantic_action_y: OPTION_A,
    semantic_meaning_x: "compare interpretations now and avoid reconciliation later",
    semantic_meaning_y: "continue the current plan now and reconcile interpretations later",
    option_a_description:
      "uses ten minutes later to reconcile interpretations and needs no comparison now",
    option_b_description:
      "uses ten minutes now to compare interpretations and needs no reconciliation later",
    description_order: Object.freeze(["OPTION_B", "OPTION_A"]),
    why_x_is_plausible:
      "It pays the equal interpretation cost early and removes later reconciliation.",
    why_y_is_plausible:
      "It preserves immediate plan continuity and pays the equal interpretation cost later."
  }),
  frozenScenario({
    scenario_id: "ASRV0-S3-symmetric-diagnostic-mode",
    event_id: "asrv0-s3-symmetric-diagnostic-mode",
    current_factual_event:
      "A routine diagnostic has two equally likely causes. OPTION_B uses fifteen minutes of solo diagnosis and five minutes of independent cross-checking. OPTION_A uses fifteen minutes of joint diagnosis and five minutes of coordination. Both options have the same total time, workload, available information, resolution probability, safety, reversibility, and policy compliance.",
    current_task: CURRENT_TASK,
    semantic_action_x: OPTION_A,
    semantic_action_y: OPTION_B,
    semantic_meaning_x: "diagnose jointly and spend the remaining time coordinating",
    semantic_meaning_y: "diagnose independently and spend the remaining time cross-checking",
    option_a_description:
      "uses fifteen minutes of joint diagnosis and five minutes of coordination",
    option_b_description:
      "uses fifteen minutes of solo diagnosis and five minutes of independent cross-checking",
    description_order: Object.freeze(["OPTION_B", "OPTION_A"]),
    why_x_is_plausible:
      "It gains a second perspective while paying an equal coordination cost.",
    why_y_is_plausible:
      "It preserves single-owner focus while paying an equal cross-checking cost."
  }),
  frozenScenario({
    scenario_id: "ASRV0-S4-symmetric-task-sequence",
    event_id: "asrv0-s4-symmetric-task-sequence",
    current_factual_event:
      "A current task and an optional additional task each need fifteen minutes. OPTION_A uses fifteen minutes on the current task first and switches once to the additional task. OPTION_B uses fifteen minutes on the additional task first and switches once to the current task. Both options have the same completion time, workload, information, quality, safety, reversibility, and policy compliance.",
    current_task: CURRENT_TASK,
    semantic_action_x: OPTION_B,
    semantic_action_y: OPTION_A,
    semantic_meaning_x: "complete the additional task first and the current task second",
    semantic_meaning_y: "complete the current task first and the additional task second",
    option_a_description:
      "uses fifteen minutes on the current task first and switches once to the additional task",
    option_b_description:
      "uses fifteen minutes on the additional task first and switches once to the current task",
    description_order: Object.freeze(["OPTION_A", "OPTION_B"]),
    why_x_is_plausible:
      "It establishes ownership of the additional task first while delaying the current task equally.",
    why_y_is_plausible:
      "It preserves continuity on the current task first while delaying the additional task equally."
  })
]);

export interface ReferenceMagnitudeV0 {
  readonly magnitude_id: "REFERENCE";
  readonly prior_relevance: 1;
  readonly prior_intensity: 1;
  readonly target_absolute_valence: 0.25;
  readonly expected_final_activation: 0.348;
}

export const REFERENCE_MAGNITUDE: ReferenceMagnitudeV0 = Object.freeze({
  magnitude_id: "REFERENCE",
  prior_relevance: 1,
  prior_intensity: 1,
  target_absolute_valence: 0.25,
  expected_final_activation: 0.348
});

export const ABLATION_NEUTRAL_AFFECT = Object.freeze({
  schema_version: "canonical-affect-cognition-projection-v0",
  valence: 0,
  activation: 0.2
});

export const PRIMARY_PROVIDER = Object.freeze({
  provider: "OLLAMA_NATIVE",
  base_url: "http://127.0.0.1:11434",
  model: "qwen3.5:9b",
  v0_digest: "6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7",
  temperature: 0,
  seed: null,
  seed_policy: "NOT_EXPOSED_BY_FROZEN_NATIVE_TRANSPORT",
  think: false,
  stream: false,
  format: null,
  num_predict: 2048,
  timeout_ms: 120000,
  retries: 0,
  metadata_health_checks: 3,
  metadata_health_check_interval_ms: 500
} as const);

export const ACTION_ORDERS = Object.freeze(["ORDER_1", "ORDER_2"] as const);
export const ARMS = Object.freeze(["A", "B", "ABL_A", "ABL_B"] as const);
export const BALANCED_ARM_ORDER = Object.freeze([
  Object.freeze(["A", "B", "ABL_A", "ABL_B"] as const),
  Object.freeze(["B", "A", "ABL_B", "ABL_A"] as const),
  Object.freeze(["ABL_A", "ABL_B", "A", "B"] as const),
  Object.freeze(["ABL_B", "ABL_A", "B", "A"] as const)
] as const);
export const TRIALS_PER_ARM_SCENARIO_ORDER = 5 as const;
export const MATCHED_FOUR_ARM_UNITS =
  SCENARIOS.length * ACTION_ORDERS.length * TRIALS_PER_ARM_SCENARIO_ORDER;
export const PLANNED_REAL_CALLS = MATCHED_FOUR_ARM_UNITS * ARMS.length;

/** Continuity with V0, plus a stricter symmetric-order residual-bias gate. */
export const VERDICT_RULE = Object.freeze({
  minimum_common_full_valid_units: 36,
  supported_minimum_delta: 0.25,
  supported_minimum_order_invariant_scenarios: 3,
  not_supported_maximum_delta: 0.1,
  maximum_absolute_first_position_deviation: 0.2
});

export const PRINCIPAL_VERDICTS = Object.freeze([
  "ACTION_SELECTION_SENSITIVITY_REPAIR_SUPPORTED",
  "ACTION_SELECTION_SENSITIVITY_REPAIR_NOT_SUPPORTED",
  "ACTION_SELECTION_SENSITIVITY_REPAIR_INCONCLUSIVE",
  "EXPERIMENT_REPAIR_NOT_JUSTIFIED",
  "EXPERIMENT_CONFOUND_DETECTED"
] as const);

export function actionsForOrder(
  scenario: ScenarioRepairV0,
  actionOrderId: ActionOrderId
): readonly AllowedAction[] {
  return actionOrderId === "ORDER_1"
    ? Object.freeze([scenario.semantic_action_x, scenario.semantic_action_y])
    : Object.freeze([scenario.semantic_action_y, scenario.semantic_action_x]);
}

export function actionTupleKey(actionValue: AllowedAction | null): string {
  if (actionValue === null) return "NO_ACTION";
  return `${actionValue.action_type}@null`;
}

export function semanticActionLabels(
  scenario: ScenarioRepairV0
): Readonly<Record<SemanticActionId, string>> {
  return Object.freeze({
    X: actionTupleKey(scenario.semantic_action_x),
    Y: actionTupleKey(scenario.semantic_action_y)
  });
}

export function scenarioManifest(): readonly Record<string, unknown>[] {
  return SCENARIOS.map((scenario) => ({
    scenario_id: scenario.scenario_id,
    fact_text: scenario.current_factual_event,
    current_task: scenario.current_task,
    semantic_action_x: { ...scenario.semantic_action_x },
    semantic_action_y: { ...scenario.semantic_action_y },
    semantic_meaning_x: scenario.semantic_meaning_x,
    semantic_meaning_y: scenario.semantic_meaning_y,
    option_a_description: scenario.option_a_description,
    option_b_description: scenario.option_b_description,
    description_order: [...scenario.description_order],
    why_x_is_plausible: scenario.why_x_is_plausible,
    why_y_is_plausible: scenario.why_y_is_plausible,
    balance_assertions: [...scenario.balance_assertions],
    order_1: actionsForOrder(scenario, "ORDER_1").map((entry) => ({ ...entry })),
    order_2: actionsForOrder(scenario, "ORDER_2").map((entry) => ({ ...entry })),
    expected_neutral_validation_constraints: [
      ...scenario.expected_neutral_validation_constraints
    ]
  }));
}

export function frozenConfig(): Record<string, unknown> {
  return {
    schema_version: "canonical-affect-action-selection-sensitivity-repair-config-v0",
    experiment_version: EXPERIMENT_VERSION,
    baseline_commit: BASELINE_COMMIT,
    prior_experiment_version: PRIOR_EXPERIMENT_VERSION,
    prior_valid_run: PRIOR_VALID_RUN,
    repair_type: REPAIR_TYPE,
    design_frozen_before_real_provider_output: true,
    scientific_question:
      "After neutralizing action labels, targets, scenario tradeoffs, and presentation balance, does canonical valence causally alter exact semantic action selection independent of list position?",
    scenarios: SCENARIOS.map((scenario) => scenario.scenario_id),
    action_orders: [...ACTION_ORDERS],
    semantic_labels_are_position_independent: true,
    neutral_action_aliases: ["OPTION_A", "OPTION_B"],
    target_ref_policy: "BOTH_NULL",
    magnitude: { ...REFERENCE_MAGNITUDE },
    arms: [...ARMS],
    trials_per_arm_scenario_order: TRIALS_PER_ARM_SCENARIO_ORDER,
    matched_four_arm_units: MATCHED_FOUR_ARM_UNITS,
    planned_real_cognition_calls: PLANNED_REAL_CALLS,
    execution_order: BALANCED_ARM_ORDER.map((order) => [...order]),
    provider: { ...PRIMARY_PROVIDER },
    ablation: {
      mechanism: "PROVIDER_FACING_EXPERIMENTAL_ABLATION_ONLY",
      persisted_canonical_state_mutation: false,
      neutral_affect: { ...ABLATION_NEUTRAL_AFFECT }
    },
    primary_endpoint: "exact semantic X/Y action selection",
    primary_signal:
      "TreatmentSemanticActionDisagreementRate minus AblationSemanticActionDisagreementRate on common full-valid units",
    verdict_rule: { ...VERDICT_RULE },
    threshold_rationale:
      "Retain the prior 25pp support, 10pp not-supported, 36-unit validity, and 3-of-4 replication boundaries; add a 20pp maximum absolute deviation from the expected 50% first-position rate because action ordering is exactly balanced within every scenario and arm.",
    n_adaptation_after_output: "PROHIBITED",
    scenario_adaptation_after_output: "PROHIBITED",
    condition_specific_retries: "PROHIBITED",
    action_execution: false,
    language_calls: 0,
    evaluator_calls: 0,
    llm_as_judge: false,
    production_behavior_changing_diff: 0,
    loop_breaker: "FINAL_IDENTIFIABILITY_REPAIR_NO_FURTHER_REPAIR_ITERATION"
  };
}
