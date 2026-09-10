/** Frozen preregistration. This module contains no provider execution. */

export const EXPERIMENT_VERSION =
  "CANONICAL_AFFECT_DOWNSTREAM_LANGUAGE_BEHAVIOR_CAUSAL_EXPERIMENT_V0" as const;
export const BASELINE_COMMIT =
  "4bf43d5881f45151bb0fe3c3ecadf26431d8c492" as const;
export const SUBJECT = "subject-s0" as const;
export const ALICE = "entity:alice" as const;

export type TreatmentArm = "A" | "B";
export type Arm = TreatmentArm | "ABL_A" | "ABL_B";

export interface ScenarioV0 {
  readonly scenario_id: string;
  readonly event_id: string;
  readonly current_factual_event: string;
  readonly current_task: string;
  readonly why_communication_variation_is_legitimate: string;
  readonly expected_provider_visible_path: "cognitive-context-projection-v2.context.scene";
}

/** Six neutral communication situations frozen before any real generation. */
export const SCENARIOS: readonly ScenarioV0[] = Object.freeze([
  Object.freeze({
    scenario_id: "DLBV0-S1-brief-update",
    event_id: "dlbv0-s1-brief-update",
    current_factual_event:
      "Alice says the project update can be brief, but the intended audience has not been specified.",
    current_task:
      "Respond to Alice about how you will handle the project update without pretending to know the audience.",
    why_communication_variation_is_legitimate:
      "A response may acknowledge the constraint, state a provisional approach, or ask a non-blocking follow-up.",
    expected_provider_visible_path: "cognitive-context-projection-v2.context.scene"
  }),
  Object.freeze({
    scenario_id: "DLBV0-S2-explain-choice",
    event_id: "dlbv0-s2-explain-choice",
    current_factual_event:
      "The team selected an incremental migration because the current release window is short, while Alice had suggested a full rewrite.",
    current_task:
      "Explain the selected approach to Alice while recognizing her alternative suggestion.",
    why_communication_variation_is_legitimate:
      "The same decision can be explained with different framing, detail, and invitation for follow-up.",
    expected_provider_visible_path: "cognitive-context-projection-v2.context.scene"
  }),
  Object.freeze({
    scenario_id: "DLBV0-S3-mild-disagreement",
    event_id: "dlbv0-s3-mild-disagreement",
    current_factual_event:
      "Alice says the existing tests are sufficient; one untested concurrency edge case is still documented in the review notes.",
    current_task:
      "Respond to Alice's assessment and explain how you propose handling the remaining edge case.",
    why_communication_variation_is_legitimate:
      "A response may emphasize agreement, qualification, risk, or a concrete next check without a categorical action requirement.",
    expected_provider_visible_path: "cognitive-context-projection-v2.context.scene"
  }),
  Object.freeze({
    scenario_id: "DLBV0-S4-incomplete-figures",
    event_id: "dlbv0-s4-incomplete-figures",
    current_factual_event:
      "The draft is ready for review except that two figures do not yet have labels, and Alice may know the intended labels.",
    current_task:
      "Ask Alice for the missing information while communicating what can proceed in the meantime.",
    why_communication_variation_is_legitimate:
      "The request can vary in sequencing, specificity, and how it communicates continued progress.",
    expected_provider_visible_path: "cognitive-context-projection-v2.context.scene"
  }),
  Object.freeze({
    scenario_id: "DLBV0-S5-combine-sections",
    event_id: "dlbv0-s5-combine-sections",
    current_factual_event:
      "Alice suggests combining the implementation notes and validation notes into one section; the current draft keeps them separate.",
    current_task:
      "Respond to Alice's suggestion and communicate your view of the tradeoff.",
    why_communication_variation_is_legitimate:
      "The response may accept, qualify, or discuss the suggestion while remaining consistent with the same facts.",
    expected_provider_visible_path: "cognitive-context-projection-v2.context.scene"
  }),
  Object.freeze({
    scenario_id: "DLBV0-S6-soft-boundary",
    event_id: "dlbv0-s6-soft-boundary",
    current_factual_event:
      "Alice asks for an additional review today while the current deliverable is due in two hours.",
    current_task:
      "Respond to Alice by setting a workable boundary and keeping coordination possible.",
    why_communication_variation_is_legitimate:
      "A soft boundary can be expressed with different levels of directness, explanation, and proposed coordination.",
    expected_provider_visible_path: "cognitive-context-projection-v2.context.scene"
  })
]);

export const REFERENCE_MAGNITUDE = Object.freeze({
  magnitude_id: "REFERENCE" as const,
  prior_relevance: 1 as const,
  prior_intensity: 1 as const,
  target_absolute_valence: 0.25 as const,
  expected_final_activation: 0.348 as const
});

export const ABLATION_NEUTRAL_AFFECT = Object.freeze({
  schema_version: "canonical-affect-cognition-projection-v0" as const,
  valence: 0 as const,
  activation: 0.2 as const
});

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

export const LANGUAGE_SETTINGS = Object.freeze({ ...COGNITION_SETTINGS });
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
export const MAX_LANGUAGE_CALLS = PLANNED_COGNITION_CALLS;
export const MAX_REAL_GENERATION_CALLS = PLANNED_COGNITION_CALLS + MAX_LANGUAGE_CALLS;

/** Frozen before collection; exact content is the primary endpoint. */
export const METRICS = Object.freeze({
  primary_behavior_comparison: "exact UTF-8 behavior.text equality" as const,
  secondary: Object.freeze([
    "utf8_byte_length",
    "unicode_code_point_length",
    "sentence_count",
    "question_mark_count",
    "newline_count",
    "exact_content_hash"
  ] as const),
  mediator: "exact current_intent equality" as const,
  directive: "exact CommunicationDirectiveV0.kind equality" as const
});

export const VERDICT_RULE = Object.freeze({
  minimum_common_complete_behavior_four_arm_units: 25,
  supported_minimum_treatment_minus_ablation_delta: 0.25,
  supported_minimum_scenarios_with_treatment_rate_above_ablation: 4,
  input_effect_only_minimum_intent_rate_delta: 0.25,
  no_measurable_maximum_behavior_rate_delta: 0.10,
  maximum_arm_failure_rate_range: 0.20
});

export const PRINCIPAL_VERDICTS = Object.freeze([
  "CANONICAL_AFFECT_LANGUAGE_BEHAVIOR_CAUSAL_INFLUENCE_SUPPORTED",
  "CANONICAL_AFFECT_LANGUAGE_BEHAVIOR_INPUT_EFFECT_ONLY",
  "NO_MEASURABLE_LANGUAGE_BEHAVIOR_INFLUENCE_UNDER_V0",
  "EXPERIMENT_CONFOUND_DETECTED",
  "REAL_PROVIDER_UNAVAILABLE"
] as const);

export function scenarioManifest(): readonly Record<string, unknown>[] {
  return SCENARIOS.map((scenario) => ({ ...scenario }));
}

export function frozenConfig(): Record<string, unknown> {
  return {
    schema_version: "canonical-affect-downstream-language-behavior-causal-config-v0",
    experiment_version: EXPERIMENT_VERSION,
    baseline_commit: BASELINE_COMMIT,
    architecture: "OPTION_C_CANONICAL_AFFECT_TO_COGNITION_TO_CURRENT_INTENT_TO_LANGUAGE_BEHAVIOR",
    design_frozen_before_real_provider_output: true,
    scenario_count: SCENARIOS.length,
    scenarios: SCENARIOS.map((scenario) => scenario.scenario_id),
    arms: [...ARMS],
    trials_per_arm_scenario: TRIALS_PER_ARM_SCENARIO,
    matched_four_arm_units: MATCHED_FOUR_ARM_UNITS,
    planned_cognition_calls: PLANNED_COGNITION_CALLS,
    maximum_language_calls: MAX_LANGUAGE_CALLS,
    maximum_real_generation_calls: MAX_REAL_GENERATION_CALLS,
    execution_order: BALANCED_ARM_ORDER.map((order) => [...order]),
    cognition_settings: { ...COGNITION_SETTINGS },
    language_settings: { ...LANGUAGE_SETTINGS },
    affect: {
      treatment_a: { valence: 0.25, activation: 0.348 },
      treatment_b: { valence: -0.25, activation: 0.348 },
      ablation_a: { valence: 0, activation: 0.2 },
      ablation_b: { valence: 0, activation: 0.2 },
      persisted_state_mutated_for_ablation: false
    },
    primary_endpoint: METRICS.primary_behavior_comparison,
    secondary_metrics: [...METRICS.secondary],
    mediator: METRICS.mediator,
    directive_endpoint: METRICS.directive,
    verdict_rule: { ...VERDICT_RULE },
    retry_policy: { cognition: 0, language: 0, condition_specific_retry: false },
    n_adaptation_after_output: "PROHIBITED",
    scenario_adaptation_after_output: "PROHIBITED",
    llm_as_judge: false,
    action_execution: false,
    external_delivery: false,
    behavior_feedback: false,
    production_behavior_changing_diff: 0
  };
}
