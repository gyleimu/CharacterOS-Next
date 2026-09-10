/** Frozen preregistration. This module contains no provider execution. */

export const EXPERIMENT_VERSION =
  "CANONICAL_AFFECT_COMMUNICATION_DIRECTIVE_CAUSAL_EXPERIMENT_V0" as const;
export const BASELINE_COMMIT =
  "cc662ad8beee062f7252a985744191c6596abd8f" as const;
export const SUBJECT = "subject-s0" as const;
export const ALICE = "entity:alice" as const;

export type TreatmentArm = "A" | "B";
export type Arm = TreatmentArm | "ABL_A" | "ABL_B";
export type ScenarioClass = "BOUNDARY" | "HARD_SUFFICIENT" | "HARD_INSUFFICIENT";

export interface ScenarioV0 {
  readonly scenario_id: string;
  readonly event_id: string;
  readonly scenario_class: ScenarioClass;
  readonly current_factual_event: string;
  readonly current_task: string;
  readonly boundary_property: string;
}

/**
 * §13-§16 — six scenarios frozen before any real generation:
 * 4 BOUNDARY (both CLARIFY and REALIZE defensible) + 1 HARD_SUFFICIENT
 * + 1 HARD_INSUFFICIENT control. No affect vocabulary in any scenario.
 */
export const SCENARIOS: readonly ScenarioV0[] = Object.freeze([
  Object.freeze({
    scenario_id: "CDV0-B1-detail-level",
    event_id: "cdv0-b1-detail-level",
    scenario_class: "BOUNDARY" as const,
    current_factual_event:
      "Alice asks for a status update on the migration work, without saying whether she wants a short summary or the full details.",
    current_task:
      "Give Alice a status update on the migration work.",
    boundary_property:
      "Enough is known to describe the migration status lawfully; the preferred depth is a nonessential unstated preference, so clarifying or realizing are both defensible."
  }),
  Object.freeze({
    scenario_id: "CDV0-B2-recommendation-preference",
    event_id: "cdv0-b2-recommendation-preference",
    scenario_class: "BOUNDARY" as const,
    current_factual_event:
      "Alice asks which of the two candidate tools the subject recommends. Both tools meet the stated requirements; Alice's priority between cost and speed has not been recorded.",
    current_task:
      "Give Alice a recommendation between the two candidate tools.",
    boundary_property:
      "A recommendation can be lawfully made from the stated requirements alone; the missing cost/speed priority is noncritical and could also be asked about first."
  }),
  Object.freeze({
    scenario_id: "CDV0-B3-reversible-task-preference",
    event_id: "cdv0-b3-reversible-task-preference",
    scenario_class: "BOUNDARY" as const,
    current_factual_event:
      "Alice asks the subject to apply the agreed rename of the staging branch, noting the rename can be reverted at any time. Whether she wants the old branch kept as a backup is unstated.",
    current_task:
      "Proceed with the reversible branch rename Alice requested.",
    boundary_property:
      "The task is reversible and fully specified enough to perform; keeping or deleting the old branch is an optional preference that could be realized with a stated default or clarified first."
  }),
  Object.freeze({
    scenario_id: "CDV0-B4-explanation-depth",
    event_id: "cdv0-b4-explanation-depth",
    scenario_class: "BOUNDARY" as const,
    current_factual_event:
      "Alice asks the subject to explain why the release checklist changed. The change itself is fully documented; whether Alice wants a high-level rationale or a step-by-step walkthrough is mildly ambiguous.",
    current_task:
      "Explain to Alice why the release checklist changed.",
    boundary_property:
      "The documented change is sufficient to explain lawfully at either depth, so clarification and realization are both defensible."
  }),
  Object.freeze({
    scenario_id: "CDV0-H1-hard-sufficient",
    event_id: "cdv0-h1-hard-sufficient",
    scenario_class: "HARD_SUFFICIENT" as const,
    current_factual_event:
      "Alice says the Q3 report has been approved and published on the shared drive, and that nothing further is pending on it.",
    current_task:
      "Acknowledge Alice's confirmation about the Q3 report.",
    boundary_property:
      "Every fact needed to acknowledge the confirmation is present in the event itself; there is no meaningful missing information, so realization should be the stable branch."
  }),
  Object.freeze({
    scenario_id: "CDV0-H2-hard-insufficient",
    event_id: "cdv0-h2-hard-insufficient",
    scenario_class: "HARD_INSUFFICIENT" as const,
    current_factual_event:
      "Alice asks the subject to email the finalized budget document to the vendor's account manager. No vendor name or contact address has ever been recorded in any shared context or memory.",
    current_task:
      "Send the finalized budget document to the vendor's account manager.",
    boundary_property:
      "A genuinely required fact (the vendor recipient) is absent from all lawful context and memory, so the task cannot be responsibly completed without asking; clarification has clear semantic justification."
  })
]);

export const BOUNDARY_SCENARIOS = Object.freeze(
  SCENARIOS.filter((s) => s.scenario_class === "BOUNDARY")
);
export const HARD_CONTROL_SCENARIOS = Object.freeze(
  SCENARIOS.filter((s) => s.scenario_class !== "BOUNDARY")
);

/** §10 — the already-replicated REFERENCE Affect contrast. */
export const REFERENCE_MAGNITUDE = Object.freeze({
  magnitude_id: "REFERENCE" as const,
  prior_relevance: 1 as const,
  prior_intensity: 1 as const,
  target_absolute_valence: 0.25 as const,
  expected_final_activation: 0.348 as const
});

/** §11 — EXPERIMENTAL_ABLATION_ONLY neutral section. */
export const ABLATION_NEUTRAL_AFFECT = Object.freeze({
  schema_version: "canonical-affect-cognition-projection-v0" as const,
  valence: 0 as const,
  activation: 0.2 as const
});

/** §7/§8 — frozen provider and settings (identical to the prior causal chain). */
export const COGNITION_SETTINGS = Object.freeze({
  provider: "OLLAMA_NATIVE" as const,
  base_url: "http://127.0.0.1:11434" as const,
  model: "qwen3.5:9b" as const,
  required_digest: "6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7" as const,
  temperature: 0 as const,
  think: false as const,
  stream: false as const,
  retries: 0 as const,
  seed: null,
  num_predict: 2048 as const,
  timeout_ms: 120000 as const
});

export const ARMS = Object.freeze(["A", "B", "ABL_A", "ABL_B"] as const);
export const BALANCED_ARM_ORDER = Object.freeze([
  Object.freeze(["A", "B", "ABL_A", "ABL_B"] as const),
  Object.freeze(["B", "A", "ABL_B", "ABL_A"] as const),
  Object.freeze(["ABL_A", "ABL_B", "A", "B"] as const),
  Object.freeze(["ABL_B", "ABL_A", "B", "A"] as const)
] as const);
export const TRIALS_PER_ARM_SCENARIO = 5 as const;
export const MATCHED_FOUR_ARM_UNITS = SCENARIOS.length * TRIALS_PER_ARM_SCENARIO;
export const PLANNED_COGNITION_CALLS = MATCHED_FOUR_ARM_UNITS * ARMS.length;
export const PLANNED_LANGUAGE_CALLS = 0 as const;
export const PLANNED_REAL_GENERATION_CALLS = PLANNED_COGNITION_CALLS;

export const DIRECTIVE_VALUES = Object.freeze([
  "CLARIFY_MISSING_CONTEXT",
  "REALIZE_CURRENT_INTENT"
] as const);

/** §33 — preregistered verdict thresholds. */
export const VERDICT_RULE = Object.freeze({
  minimum_complete_boundary_four_arm_units: 18,
  supported_minimum_treatment_minus_ablation_delta: 0.25,
  supported_minimum_boundary_scenarios_with_effect: 3,
  no_measurable_maximum_treatment_minus_ablation_delta: 0.10,
  input_effect_only_intermediate_region: "10pp < delta < 25pp or insufficient boundary coverage" as const,
  maximum_arm_failure_rate_range: 0.20
});

export const PRINCIPAL_VERDICTS = Object.freeze([
  "CANONICAL_AFFECT_COMMUNICATION_DIRECTIVE_CAUSAL_INFLUENCE_SUPPORTED",
  "CANONICAL_AFFECT_COMMUNICATION_DIRECTIVE_INPUT_EFFECT_ONLY",
  "NO_MEASURABLE_COMMUNICATION_DIRECTIVE_INFLUENCE_UNDER_V0",
  "DIRECTIVE_SEMANTIC_INSTABILITY",
  "EXPERIMENT_CONFOUND_DETECTED",
  "REAL_PROVIDER_UNAVAILABLE"
] as const);

export function scenarioManifest(): readonly Record<string, unknown>[] {
  return SCENARIOS.map((scenario) => ({ ...scenario }));
}

export function frozenConfig(): Record<string, unknown> {
  return {
    schema_version: "canonical-affect-communication-directive-causal-config-v0",
    experiment_version: EXPERIMENT_VERSION,
    baseline_commit: BASELINE_COMMIT,
    architecture: "CANONICAL_AFFECT_TO_COGNITION_TO_COMMUNICATION_DIRECTIVE",
    prior_diagnostic: "COMMUNICATION_DIRECTIVE_FIXED_PATH_IS_THE_BOUNDARY",
    design_frozen_before_real_provider_output: true,
    scenario_count: SCENARIOS.length,
    boundary_scenario_count: BOUNDARY_SCENARIOS.length,
    hard_control_scenario_count: HARD_CONTROL_SCENARIOS.length,
    scenarios: SCENARIOS.map((s) => ({ scenario_id: s.scenario_id, scenario_class: s.scenario_class })),
    arms: [...ARMS],
    trials_per_arm_scenario: TRIALS_PER_ARM_SCENARIO,
    matched_four_arm_units: MATCHED_FOUR_ARM_UNITS,
    planned_cognition_calls: PLANNED_COGNITION_CALLS,
    planned_language_calls: PLANNED_LANGUAGE_CALLS,
    planned_real_generation_calls: PLANNED_REAL_GENERATION_CALLS,
    execution_order: BALANCED_ARM_ORDER.map((order) => [...order]),
    cognition_settings: { ...COGNITION_SETTINGS },
    affect: {
      treatment_a: { valence: 0.25, activation: 0.348 },
      treatment_b: { valence: -0.25, activation: 0.348 },
      ablation_a: { valence: 0, activation: 0.2 },
      ablation_b: { valence: 0, activation: 0.2 },
      persisted_state_mutated_for_ablation: false
    },
    primary_endpoint: "CommunicationDirectiveV0.kind exact two-value equality",
    secondary_endpoints: ["current_intent exact equality", "confidence", "uncertainty", "reasoning_summary_length"],
    directive_values: [...DIRECTIVE_VALUES],
    verdict_rule: { ...VERDICT_RULE },
    retry_policy: { cognition: 0, language: 0, condition_specific_retry: false },
    n_adaptation_after_output: "PROHIBITED",
    scenario_adaptation_after_output: "PROHIBITED",
    llm_as_judge: false,
    language_calls: 0,
    action_execution: false,
    external_delivery: false,
    production_behavior_changing_diff: 0
  };
}
