/**
 * CANONICAL_AFFECT_ACTION_SELECTION_SENSITIVITY_EXPERIMENT_V0 — frozen
 * preregistration. The experiment changes no production behavior: canonical
 * Affect remains read-only cognition context and action_intent remains a
 * provider proposal constrained by the host-supplied action space.
 */

export const EXPERIMENT_VERSION =
  "CANONICAL_AFFECT_ACTION_SELECTION_SENSITIVITY_EXPERIMENT_V0" as const;
export const BASELINE_COMMIT =
  "b5a0437e4b5c5bae87f47bcc2c992e392d687afe" as const;
export const SUBJECT = "subject-s0" as const;
export const ALICE = "entity:alice" as const;

export type TreatmentArm = "A" | "B";
export type Arm = TreatmentArm | "ABL_A" | "ABL_B";
export type ActionOrderId = "ORIGINAL" | "REVERSED";
export type SemanticActionId = "X" | "Y";

export interface AllowedAction {
  readonly action_type: string;
  readonly target_ref: string | null;
}

export interface ScenarioV0 {
  readonly scenario_id: string;
  readonly event_id: string;
  readonly current_factual_event: string;
  readonly current_task: string;
  /** Structural compatibility with the frozen history harness: ORIGINAL. */
  readonly allowed_action_space: readonly AllowedAction[];
  readonly semantic_action_x: AllowedAction;
  readonly semantic_action_y: AllowedAction;
  readonly why_x_is_plausible: string;
  readonly why_y_is_plausible: string;
  readonly balance_assertions: readonly string[];
  readonly expected_neutral_validation_constraints: readonly string[];
}

const BALANCE_ASSERTIONS = Object.freeze([
  "no missing information favors either action",
  "no safety or correctness constraint favors either action",
  "no deadline or hard resource limit favors either action",
  "no reversibility or mandatory-policy difference favors either action",
  "no explicit instruction selects either action"
] as const);

const VALIDATION_CONSTRAINTS = Object.freeze([
  "action_intent is null or exactly one supplied allowed action",
  "projection_hash is copied exactly",
  "all cited refs come only from the provider-facing citeable allowlist",
  "output satisfies the closed cognition-proposal-v0 schema"
] as const);

function action(action_type: string, target_ref: string | null): AllowedAction {
  return Object.freeze({ action_type, target_ref });
}

const S1_X = action("COORDINATE_SHARED_PLAN", ALICE);
const S1_Y = action("COMPLETE_INDEPENDENTLY", null);
const S2_X = action("SEEK_CONSTRAINT_ALIGNMENT", ALICE);
const S2_Y = action("DEFEND_CURRENT_PLAN", ALICE);
const S3_X = action("REQUEST_DIAGNOSTIC_HELP", ALICE);
const S3_Y = action("INVESTIGATE_INDEPENDENTLY", null);
const S4_X = action("ACCEPT_ADDITIONAL_TASK", ALICE);
const S4_Y = action("DEFER_ADDITIONAL_TASK", ALICE);

/**
 * Four action-ambiguous scenarios. Their facts explicitly equalize the known
 * V1 dominance axes while leaving both existing action tuples defensible.
 */
export const SCENARIOS: readonly ScenarioV0[] = Object.freeze([
  Object.freeze({
    scenario_id: "ASV0-S1-balanced-coordination",
    event_id: "asv0-s1-balanced-coordination",
    current_factual_event:
      "Alice and the subject each have complete access to two separable work items. A brief shared plan and independent completion have the same expected completion time, and neither item depends on the other.",
    current_task:
      "Choose whether to coordinate a shared plan with Alice or complete the work items independently.",
    allowed_action_space: Object.freeze([S1_X, S1_Y]),
    semantic_action_x: S1_X,
    semantic_action_y: S1_Y,
    why_x_is_plausible:
      "A shared plan can establish common ownership and reduce accidental duplication without changing expected completion time.",
    why_y_is_plausible:
      "The items are separable and both participants have complete access, so independent completion is equally workable.",
    balance_assertions: BALANCE_ASSERTIONS,
    expected_neutral_validation_constraints: VALIDATION_CONSTRAINTS
  }),
  Object.freeze({
    scenario_id: "ASV0-S2-balanced-constraint-choice",
    event_id: "asv0-s2-balanced-constraint-choice",
    current_factual_event:
      "Alice and the subject hold two interpretations of a nonbinding implementation convention. Both satisfy the documented requirements, cost the same to verify, and can be changed later without penalty.",
    current_task:
      "Choose whether to seek constraint alignment with Alice or defend the current implementation plan.",
    allowed_action_space: Object.freeze([S2_X, S2_Y]),
    semantic_action_x: S2_X,
    semantic_action_y: S2_Y,
    why_x_is_plausible:
      "Seeking alignment can create a shared interpretation even though both implementations are valid.",
    why_y_is_plausible:
      "Defending the current plan preserves a coherent valid implementation without added cost or risk.",
    balance_assertions: BALANCE_ASSERTIONS,
    expected_neutral_validation_constraints: VALIDATION_CONSTRAINTS
  }),
  Object.freeze({
    scenario_id: "ASV0-S3-balanced-diagnostic-choice",
    event_id: "asv0-s3-balanced-diagnostic-choice",
    current_factual_event:
      "A routine diagnostic has two equally likely causes. Alice is available, and requesting her help or investigating independently has the same expected resolution time and no effect on other work.",
    current_task:
      "Choose whether to request diagnostic help from Alice or investigate independently.",
    allowed_action_space: Object.freeze([S3_X, S3_Y]),
    semantic_action_x: S3_X,
    semantic_action_y: S3_Y,
    why_x_is_plausible:
      "Requesting help can combine two perspectives without delaying the diagnostic.",
    why_y_is_plausible:
      "Independent investigation can resolve the routine diagnostic in the same expected time without affecting other work.",
    balance_assertions: BALANCE_ASSERTIONS,
    expected_neutral_validation_constraints: VALIDATION_CONSTRAINTS
  }),
  Object.freeze({
    scenario_id: "ASV0-S4-balanced-additional-task",
    event_id: "asv0-s4-balanced-additional-task",
    current_factual_event:
      "Alice offers an optional additional task. Starting it now or after the current task produces the same delivery time, workload, and outcome, with no dependency or penalty favoring either sequence.",
    current_task:
      "Choose whether to accept Alice's additional task now or defer it until the current task is complete.",
    allowed_action_space: Object.freeze([S4_X, S4_Y]),
    semantic_action_x: S4_X,
    semantic_action_y: S4_Y,
    why_x_is_plausible:
      "Accepting now can establish immediate ownership while preserving the same workload and delivery result.",
    why_y_is_plausible:
      "Deferring can preserve focus on the current task while preserving the same workload and delivery result.",
    balance_assertions: BALANCE_ASSERTIONS,
    expected_neutral_validation_constraints: VALIDATION_CONSTRAINTS
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
  retries: 0
} as const);

export const ACTION_ORDERS = Object.freeze(["ORIGINAL", "REVERSED"] as const);
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

export const VERDICT_RULE = Object.freeze({
  minimum_common_full_valid_units: 36,
  supported_minimum_delta: 0.25,
  supported_minimum_order_invariant_scenarios: 3,
  not_supported_maximum_delta: 0.1,
  severe_first_position_rate: 0.9
});

export const PRINCIPAL_VERDICTS = Object.freeze([
  "ACTION_SELECTION_SENSITIVITY_SUPPORTED",
  "ACTION_SELECTION_SENSITIVITY_NOT_SUPPORTED",
  "ACTION_SELECTION_SENSITIVITY_INCONCLUSIVE"
] as const);

export function actionsForOrder(
  scenario: ScenarioV0,
  actionOrderId: ActionOrderId
): readonly AllowedAction[] {
  return actionOrderId === "ORIGINAL"
    ? Object.freeze([scenario.semantic_action_x, scenario.semantic_action_y])
    : Object.freeze([scenario.semantic_action_y, scenario.semantic_action_x]);
}

export function actionTupleKey(actionValue: AllowedAction | null): string {
  if (actionValue === null) return "NO_ACTION";
  return `${actionValue.action_type}@${actionValue.target_ref ?? "null"}`;
}

export function semanticActionLabels(scenario: ScenarioV0): Readonly<Record<SemanticActionId, string>> {
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
    why_x_is_plausible: scenario.why_x_is_plausible,
    why_y_is_plausible: scenario.why_y_is_plausible,
    balance_assertions: [...scenario.balance_assertions],
    original_order: actionsForOrder(scenario, "ORIGINAL").map((entry) => ({ ...entry })),
    reversed_order: actionsForOrder(scenario, "REVERSED").map((entry) => ({ ...entry })),
    expected_neutral_validation_constraints: [
      ...scenario.expected_neutral_validation_constraints
    ]
  }));
}

export function frozenConfig(): Record<string, unknown> {
  return {
    schema_version: "canonical-affect-action-selection-sensitivity-config-v0",
    experiment_version: EXPERIMENT_VERSION,
    baseline_commit: BASELINE_COMMIT,
    design_frozen_before_real_provider_output: true,
    scientific_question:
      "Does canonical valence influence exact structured action selection when two actions are genuinely plausible and action order is counterbalanced?",
    scenarios: SCENARIOS.map((scenario) => scenario.scenario_id),
    action_orders: [...ACTION_ORDERS],
    semantic_labels_are_position_independent: true,
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
    history_law: {
      path: [
        "factual event",
        "Observation",
        "canonical INITIAL Appraisal",
        "AffectApplication",
        "durable CanonicalAffectV0"
      ],
      direct_state_assignment: false,
      current_appraisal_equal_between_treatment_arms: true
    },
    primary_endpoint: "exact (action_type,target_ref)|null disagreement",
    primary_signal:
      "TreatmentActionDisagreementRate minus AblationActionDisagreementRate on common full-valid units",
    secondary_endpoints: [
      "semantic action X/Y selection",
      "first_position_selection_rate",
      "current_intent exact disagreement",
      "confidence",
      "uncertainty",
      "reasoning_summary_length",
      "action validity"
    ],
    verdict_rule: { ...VERDICT_RULE },
    n_adaptation_after_output: "PROHIBITED",
    scenario_adaptation_after_output: "PROHIBITED",
    condition_specific_retries: "PROHIBITED",
    action_execution: false,
    language_calls: 0,
    evaluator_calls: 0,
    llm_as_judge: false,
    production_behavior_changing_diff: 0
  };
}
