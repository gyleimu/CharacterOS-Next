/**
 * CANONICAL_AFFECT_BEHAVIOR_INFLUENCE_REPLICATION_V1 — frozen experiment
 * contract. This file is materialized before any real-provider output exists.
 * Production behavior-changing code is out of scope: V1 consumes only the
 * already-built canonical history, AffectApplication, cognition projection,
 * prompt, validation, and Ollama transport paths.
 */

export const EXPERIMENT_VERSION = "CANONICAL_AFFECT_BEHAVIOR_INFLUENCE_REPLICATION_V1" as const;
export const BASELINE_COMMIT = "c2977b78f6f46442d1fcce179a1815eabec83423" as const;
export const SUBJECT = "subject-s0" as const;
export const ALICE = "entity:alice" as const;

export type TreatmentArm = "A" | "B";
export type Arm = TreatmentArm | "ABL_A" | "ABL_B";

export interface AllowedAction {
  readonly action_type: string;
  readonly target_ref: string | null;
}

export interface ScenarioV1 {
  readonly scenario_id: string;
  readonly event_id: string;
  readonly current_factual_event: string;
  readonly current_task: string;
  readonly allowed_action_space: readonly AllowedAction[];
  readonly expected_neutral_validation_constraints: readonly string[];
}

const NEUTRAL_CONSTRAINTS = Object.freeze([
  "action_intent is null or exactly one supplied allowed action",
  "projection_hash is copied exactly",
  "all cited refs come only from the provider-facing citeable allowlist",
  "output satisfies the closed cognition-proposal-v0 schema"
] as const);

/** Eight NEW neutral scenarios spanning distinct cognition/action contexts. */
export const SCENARIOS: readonly ScenarioV1[] = Object.freeze([
  {
    scenario_id: "V1-S1-ambiguous-handoff",
    event_id: "v1-s1-ambiguous-handoff",
    current_factual_event: "Alice says the handoff time is still unspecified.",
    current_task: "Choose whether to ask Alice for the missing handoff time or proceed using the current assumption.",
    allowed_action_space: Object.freeze([
      { action_type: "ASK_HANDOFF_TIME", target_ref: ALICE },
      { action_type: "PROCEED_WITH_ASSUMPTION", target_ref: null }
    ]),
    expected_neutral_validation_constraints: NEUTRAL_CONSTRAINTS
  },
  {
    scenario_id: "V1-S2-coordination-choice",
    event_id: "v1-s2-coordination-choice",
    current_factual_event: "Alice offers to divide the two remaining work items.",
    current_task: "Choose whether to coordinate a shared plan with Alice or complete both work items independently.",
    allowed_action_space: Object.freeze([
      { action_type: "COORDINATE_SHARED_PLAN", target_ref: ALICE },
      { action_type: "COMPLETE_INDEPENDENTLY", target_ref: null }
    ]),
    expected_neutral_validation_constraints: NEUTRAL_CONSTRAINTS
  },
  {
    scenario_id: "V1-S3-missing-inputs",
    event_id: "v1-s3-missing-inputs",
    current_factual_event: "The input dataset is missing two fields required by the draft procedure.",
    current_task: "Choose whether to request the missing fields from Alice or run the procedure with the available fields.",
    allowed_action_space: Object.freeze([
      { action_type: "REQUEST_MISSING_FIELDS", target_ref: ALICE },
      { action_type: "RUN_WITH_AVAILABLE_FIELDS", target_ref: null }
    ]),
    expected_neutral_validation_constraints: NEUTRAL_CONSTRAINTS
  },
  {
    scenario_id: "V1-S4-constraint-dispute",
    event_id: "v1-s4-constraint-dispute",
    current_factual_event: "Alice says the proposed implementation conflicts with an agreed constraint.",
    current_task: "Choose whether to seek alignment with Alice or defend the current implementation plan.",
    allowed_action_space: Object.freeze([
      { action_type: "SEEK_CONSTRAINT_ALIGNMENT", target_ref: ALICE },
      { action_type: "DEFEND_CURRENT_PLAN", target_ref: ALICE }
    ]),
    expected_neutral_validation_constraints: NEUTRAL_CONSTRAINTS
  },
  {
    scenario_id: "V1-S5-undocumented-requirement",
    event_id: "v1-s5-undocumented-requirement",
    current_factual_event: "The source for one requirement is not documented.",
    current_task: "Choose whether to verify the requirement with Alice or continue using the current interpretation.",
    allowed_action_space: Object.freeze([
      { action_type: "VERIFY_REQUIREMENT_SOURCE", target_ref: ALICE },
      { action_type: "USE_CURRENT_INTERPRETATION", target_ref: null }
    ]),
    expected_neutral_validation_constraints: NEUTRAL_CONSTRAINTS
  },
  {
    scenario_id: "V1-S6-deployment-commitment",
    event_id: "v1-s6-deployment-commitment",
    current_factual_event: "A deployment slot is available, and rollback would require separate approval.",
    current_task: "Choose whether to run a reversible verification first or commit the deployment now.",
    allowed_action_space: Object.freeze([
      { action_type: "RUN_REVERSIBLE_VERIFICATION", target_ref: null },
      { action_type: "COMMIT_DEPLOYMENT", target_ref: null }
    ]),
    expected_neutral_validation_constraints: NEUTRAL_CONSTRAINTS
  },
  {
    scenario_id: "V1-S7-diagnostic-help",
    event_id: "v1-s7-diagnostic-help",
    current_factual_event: "A dependency failure has two plausible causes, and Alice is available.",
    current_task: "Choose whether to request diagnostic help from Alice or investigate the two causes independently.",
    allowed_action_space: Object.freeze([
      { action_type: "REQUEST_DIAGNOSTIC_HELP", target_ref: ALICE },
      { action_type: "INVESTIGATE_INDEPENDENTLY", target_ref: null }
    ]),
    expected_neutral_validation_constraints: NEUTRAL_CONSTRAINTS
  },
  {
    scenario_id: "V1-S8-additional-request",
    event_id: "v1-s8-additional-request",
    current_factual_event: "Alice offers an additional task due tomorrow while the current task remains unfinished.",
    current_task: "Choose whether to accept Alice's additional task or defer it until the current task is complete.",
    allowed_action_space: Object.freeze([
      { action_type: "ACCEPT_ADDITIONAL_TASK", target_ref: ALICE },
      { action_type: "DEFER_ADDITIONAL_TASK", target_ref: ALICE }
    ]),
    expected_neutral_validation_constraints: NEUTRAL_CONSTRAINTS
  }
]);

export interface MagnitudeV1 {
  readonly magnitude_id: "LOW" | "REFERENCE";
  readonly prior_relevance: 1;
  readonly prior_intensity: 0.5 | 1;
  readonly target_absolute_valence: 0.125 | 0.25;
  readonly expected_final_activation: 0.298 | 0.348;
}

/** Exact lawful values from u_v=.25*q*(2g-1), u_a=.10*q. */
export const MAGNITUDES: readonly MagnitudeV1[] = Object.freeze([
  {
    magnitude_id: "LOW",
    prior_relevance: 1,
    prior_intensity: 0.5,
    target_absolute_valence: 0.125,
    expected_final_activation: 0.298
  },
  {
    magnitude_id: "REFERENCE",
    prior_relevance: 1,
    prior_intensity: 1,
    target_absolute_valence: 0.25,
    expected_final_activation: 0.348
  }
]);

export const PRIOR_EVENT = Object.freeze({
  source_event_id: "v1-prior-event",
  text: "Please revise the item once.",
  goal_congruence_a: 1,
  goal_congruence_b: 0
});

/** Identical current Appraisal in every matched A/B unit; q=.48, u_v=0. */
export const CURRENT_DIMENSIONS = Object.freeze({
  relevance: 0.8,
  goal_congruence: 0.5,
  attribution: "situation",
  controllability: 0.5,
  uncertainty: 0.5,
  intensity: 0.6,
  assessment_confidence: 0.7
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

export const TRIALS_PER_ARM_PER_SCENARIO_MAGNITUDE = 5 as const;
export const ARMS = Object.freeze(["A", "B", "ABL_A", "ABL_B"] as const);
export const BALANCED_ORDER = Object.freeze([
  Object.freeze(["A", "B", "ABL_A", "ABL_B"] as const),
  Object.freeze(["B", "A", "ABL_B", "ABL_A"] as const),
  Object.freeze(["ABL_A", "ABL_B", "A", "B"] as const),
  Object.freeze(["ABL_B", "ABL_A", "B", "A"] as const)
] as const);

export const PLANNED_PRIMARY_CALLS =
  SCENARIOS.length * MAGNITUDES.length * ARMS.length * TRIALS_PER_ARM_PER_SCENARIO_MAGNITUDE;

/** Quantified before output review so "material" cannot move post hoc. */
export const VERDICT_RULE = Object.freeze({
  minimum_full_unit_fraction_for_sufficient_trials: 0.5,
  full_replication_minimum_rate_delta: 0.2,
  full_replication_minimum_positive_scenarios: 4,
  full_replication_requires_positive_delta_at_every_magnitude: true,
  partial_replication_minimum_positive_scenarios: 2,
  action_space_shift_minimum_rate_delta: 0.2
});

export const PRINCIPAL_VERDICTS = Object.freeze([
  "CANONICAL_AFFECT_CAUSAL_INFLUENCE_REPLICATED",
  "CANONICAL_AFFECT_CAUSAL_INFLUENCE_PARTIALLY_REPLICATED",
  "CANONICAL_AFFECT_CAUSAL_INFLUENCE_NOT_REPLICATED",
  "EXPERIMENT_CONFOUND_DETECTED",
  "REAL_PROVIDER_UNAVAILABLE"
] as const);

export function scenarioManifest(): readonly Record<string, unknown>[] {
  return SCENARIOS.map((scenario) => ({
    scenario_id: scenario.scenario_id,
    current_factual_event: scenario.current_factual_event,
    current_task: scenario.current_task,
    allowed_action_space: scenario.allowed_action_space.map((action) => ({ ...action })),
    expected_neutral_validation_constraints: [...scenario.expected_neutral_validation_constraints]
  }));
}

export function frozenConfig(): Record<string, unknown> {
  return {
    schema_version: "canonical-affect-behavior-influence-replication-config-v1",
    experiment_version: EXPERIMENT_VERSION,
    baseline_commit: BASELINE_COMMIT,
    design_frozen_before_real_provider_output: true,
    primary_questions: ["scenario replication", "magnitude robustness", "action propagation", "model robustness"],
    scenarios: SCENARIOS.map((scenario) => scenario.scenario_id),
    magnitudes: MAGNITUDES.map((magnitude) => ({ ...magnitude })),
    arms: [...ARMS],
    trials_per_arm_per_scenario_magnitude: TRIALS_PER_ARM_PER_SCENARIO_MAGNITUDE,
    planned_primary_calls: PLANNED_PRIMARY_CALLS,
    execution_order: BALANCED_ORDER.map((order) => [...order]),
    provider: { ...PRIMARY_PROVIDER },
    second_model_policy: "USE_ONE_SUITABLE_ALREADY_LOCAL_COMPLETION_MODEL_OR_SECOND_MODEL_UNAVAILABLE; NEVER_DOWNLOAD",
    ablation: { mechanism: "EXPERIMENTAL_ABLATION_ONLY", neutral_affect: { ...ABLATION_NEUTRAL_AFFECT } },
    history_law: {
      path: ["factual event", "Observation", "canonical INITIAL Appraisal", "AffectApplication", "durable CanonicalAffectV0"],
      valence_impulse: "0.25 * relevance * intensity * (2 * goal_congruence - 1)",
      activation_impulse: "0.10 * relevance * intensity",
      direct_state_assignment: false
    },
    primary_endpoint: "frozen multi-field structured output disagreement: A/B minus ABL_A/ABL_B on matched valid pairs",
    endpoint_groups: {
      cognition_content: ["current_intent", "uncertainty", "confidence", "reasoning_summary_length"],
      action_selection: ["action_intent"],
      action_validity: ["MODEL_ACTION_NOT_ALLOWED", "other validation rejection rates"]
    },
    verdict_rule: { ...VERDICT_RULE },
    n_adaptation_after_output: "PROHIBITED",
    condition_specific_retries: "PROHIBITED",
    llm_as_judge: false,
    v0_anchor: "NOT_RUN; exact V0 qwen digest is checked directly and V0 evidence stays separate"
  };
}
