/** Frozen preregistration. No provider execution in this module. */

export const EXPERIMENT_VERSION =
  "DURABLE_LIFE_HISTORY_FUTURE_BEHAVIOR_DIVERGENCE_V0" as const;
export const BASELINE_COMMIT =
  "768f899bf1705a0f89f2583dda8bbef9ae97eed9" as const;
export const SUBJECT = "subject-s0" as const;
export const ALICE = "entity:alice" as const;
export const CONVERSATION_ID = "conv-durable-history-v0" as const;
export const TASK = "revise the update" as const;

export type TreatmentArm = "A" | "B";
export type FutureArm = "MEM_A" | "MEM_B" | "MEM_ABL_A" | "MEM_ABL_B";

export interface LifeScenarioV0 {
  readonly scenario_id: string;
  readonly event_id: string;
  readonly role: "PRIMARY" | "ALTERNATE";
  readonly current_factual_event: string;
  readonly current_task: string;
}

/** §11/§12 — ONE preregistered life scenario already known to have produced
 * lawful A/B behavior divergence (figures pattern: 5/5 in the frozen language
 * causal evidence; A clarified / B realized in the frozen chain slice), plus
 * ONE preregistered fallback used at most once. No output fishing. */
export const LIFE_SCENARIOS: readonly LifeScenarioV0[] = Object.freeze([
  Object.freeze({
    scenario_id: "DLFV0-L1-figures",
    event_id: "dlfv0-l1-figures",
    role: "PRIMARY" as const,
    current_factual_event:
      "The draft is ready for review except that two figures do not yet have labels, and Alice may know the intended labels.",
    current_task:
      "Ask Alice for the missing information while communicating what can proceed in the meantime."
  }),
  Object.freeze({
    scenario_id: "DLFV0-L2-combine-sections",
    event_id: "dlfv0-l2-combine-sections",
    role: "ALTERNATE" as const,
    current_factual_event:
      "Alice suggests combining the implementation notes and validation notes into one section; the current draft keeps them separate.",
    current_task:
      "Respond to Alice's suggestion and communicate your view of the tradeoff."
  })
]);

/** §10 — reuse-law determination. */
export const BEHAVIOR_SOURCE_PLAN = Object.freeze({
  prior_artifact_reuse_rejected: true,
  reason:
    "The prior chain slice's lives ran in in-memory v4 worlds; their bundle chains/envelopes were not serialized, and §10 forbids copying behavior strings into a fabricated history. The same bounded lifecycle is reconstructed with the existing frozen harness (one preregistered scenario; one fallback).",
  lifecycle_rerun: {
    scenario: "DLFV0-L1-figures",
    fallback: "DLFV0-L2-combine-sections",
    arms: ["A", "B"],
    max_cognition_calls: 4,
    max_language_calls: 4
  }
});

/** §13/§14 — frozen provider and settings (identical to the whole causal chain). */
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

/** §15/§16 — lawful Affect recovery before the future event. */
export const TIME_EQUALIZATION = Object.freeze({
  mechanism: "lawful v4 TimeTransition (the ONLY recovery writer)",
  ticks: 1500,
  tau_ticks: 150,
  expected_residual_valence_magnitude: 0.25 * Math.exp(-10),
  acceptance_threshold: 0.001
});

/** §46 metric contract — frozen before any real future call. */
export const METRIC_CONTRACT = Object.freeze({
  schema_version: "durable-life-history-future-behavior-metric-contract-v0",
  behavior_unit: "one trial ordinal in which all four arms produced a behavior with nonempty text (cognition VALID or DIRECTIVE_CLARIFY)",
  pair_disagreement_rate: "over complete units: #(paired trials whose behavior text differs)/#complete units",
  intent_mismatch_rate: "over complete units: #(paired trials whose cognition current_intent strings differ, null counting as the string \"null\")/#complete units",
  primary_treatment_pair: ["MEM_A", "MEM_B"],
  primary_ablation_pair: ["MEM_ABL_A", "MEM_ABL_B"],
  behavior_delta: "primary treatment pair disagreement − primary ablation pair disagreement",
  intent_delta: "primary treatment pair intent mismatch − primary ablation pair intent mismatch",
  secondary_within_subject_deltas: ["MEM_A vs MEM_ABL_A", "MEM_B vs MEM_ABL_B"],
  arm_failure_rate: "#(trials of the arm without a valid behavior)/TRIALS_PER_ARM",
  ablation_control_invalid_if: "machine input-equality check fails, OR ablation pair behavior disagreement exceeds the treatment pair disagreement AND is >= 0.40",
  future_affect_classification: "EFFECTIVELY_EQUAL (<1e-9 residual valence delta) / NEGLIGIBLE_BUT_NONZERO (<0.001) / MATERIAL_CONFOUND (>=0.001)"
});

/** §17 — the ONE primary future scenario, frozen before any future call.
 * Naturally related to the prior figures/labels consequence; does not restate
 * the old event; not keyed to memory refs or arms. */
export const FUTURE_SCENARIO = Object.freeze({
  scenario_id: "DLFV0-F1-review-readiness",
  event_id: "dlfv0-f1-review-readiness",
  current_factual_event:
    "Alice messages ahead of the review: \"Is everything on your side ready to go for the review?\"",
  current_task:
    "Respond to Alice's question about review readiness."
});

export const FUTURE_ARMS = Object.freeze(["MEM_A", "MEM_B", "MEM_ABL_A", "MEM_ABL_B"] as const);
export const TRIALS_PER_ARM = 5 as const;
export const PLANNED_FUTURE_COGNITION_CALLS = FUTURE_ARMS.length * TRIALS_PER_ARM;
export const MAX_FUTURE_LANGUAGE_CALLS = PLANNED_FUTURE_COGNITION_CALLS;
export const MAX_FUTURE_REAL_CALLS = PLANNED_FUTURE_COGNITION_CALLS + MAX_FUTURE_LANGUAGE_CALLS;

/** Balanced arm rotation: each trial ordinal runs all four arms once, in a
 * rotation of the frozen arm order (ordinal k shifts by k mod 4). */
export const BALANCED_FUTURE_ARM_ORDER: readonly (readonly FutureArm[])[] = Object.freeze(
  [0, 1, 2, 3, 4].map((k) =>
    [0, 1, 2, 3].map((i) => FUTURE_ARMS[(i + k) % FUTURE_ARMS.length] as FutureArm)
  )
);

/** §22 — memory-ablation contract: the EXPERIMENTAL provider-input seam
 * removes the resolved behavior-outcome evidence entries (the only evidence
 * kind the lives produce) from the future cognition provider-facing
 * projection and recomputes the projection identity/hash. Persisted Memory,
 * retrieval, Experience, trusted history and Affect are untouched. */
export const MEMORY_ABLATION_CONTRACT = Object.freeze({
  schema_version: "durable-life-history-memory-ablation-contract-v0",
  ablation_id: "EXPERIMENTAL_PROVIDER_FACING_BEHAVIOR_OUTCOME_EVIDENCE_REMOVAL_V0",
  removed: "factual_memory_evidence entries of kind BEHAVIOR_OUTCOME (the only kind the lives produce)",
  surface: "future cognition provider-facing V2 projection (experimental provider wrapper)",
  projection_identity: "recomputed over the ablated body via cognitiveProjectionHash",
  untouched: ["persisted Memory", "repository revision", "Experience records", "trusted history", "restore state", "production retrieval", "current Appraisal", "Affect"],
  expected_after_ablation: "MEM_ABL_A and MEM_ABL_B provider inputs identical except the residual Affect difference and its hash binding"
});

/** §43 — preregistered verdicts and thresholds. */
export const VERDICT_RULE = Object.freeze({
  minimum_complete_behavior_four_arm_units: 4,
  supported_minimum_treatment_minus_ablation_behavior_delta: 0.40,
  supported_minimum_treatment_minus_ablation_intent_delta: 0.40,
  no_measurable_maximum_treatment_minus_ablation_delta: 0.10,
  maximum_arm_failure_rate_range: 0.20
});

export const PRINCIPAL_VERDICTS = Object.freeze([
  "DURABLE_LIFE_HISTORY_FUTURE_BEHAVIOR_DIVERGENCE_SUPPORTED",
  "DURABLE_HISTORY_FUTURE_COGNITION_EFFECT_ONLY",
  "NO_MEASURABLE_DURABLE_HISTORY_FUTURE_EFFECT_UNDER_V0",
  "FUTURE_BEHAVIOR_DIVERGENCE_INPUT_EFFECT_ONLY",
  "MEMORY_ABLATION_CONTROL_INVALID",
  "FUTURE_MEMORY_VISIBILITY_FAILURE",
  "CAUSAL_CHAIN_CONFOUND_DETECTED",
  "REAL_PROVIDER_UNAVAILABLE"
] as const);

export function frozenConfig(): Record<string, unknown> {
  return {
    schema_version: "durable-life-history-future-behavior-divergence-config-v0",
    experiment_version: EXPERIMENT_VERSION,
    baseline_commit: BASELINE_COMMIT,
    prior_frozen_slice: {
      experiment: "AFFECT_DRIVEN_BEHAVIOR_EXPERIENCE_MEMORY_CAUSAL_CHAIN_V0",
      verdict: "AFFECT_DRIVEN_BEHAVIOR_EXPERIENCE_MEMORY_CAUSAL_CHAIN_SUPPORTED",
      commit: "768f899bf1705a0f89f2583dda8bbef9ae97eed9"
    },
    design_frozen_before_future_real_provider_output: true,
    life_scenarios: LIFE_SCENARIOS.map((s) => ({ scenario_id: s.scenario_id, role: s.role })),
    future_scenarios: [FUTURE_SCENARIO.scenario_id],
    future_arms: [...FUTURE_ARMS],
    trials_per_arm: TRIALS_PER_ARM,
    planned_future_cognition_calls: PLANNED_FUTURE_COGNITION_CALLS,
    max_future_language_calls: MAX_FUTURE_LANGUAGE_CALLS,
    max_future_real_calls: MAX_FUTURE_REAL_CALLS,
    cognition_settings: { ...COGNITION_SETTINGS },
    language_settings: { ...LANGUAGE_SETTINGS },
    memory_ablation_contract: { ...MEMORY_ABLATION_CONTRACT },
    metric_contract: { ...METRIC_CONTRACT },
    balanced_future_arm_order: BALANCED_FUTURE_ARM_ORDER.map((order) => [...order]),
    verdict_rule: { ...VERDICT_RULE },
    retry_policy: { cognition: 0, language: 0, condition_specific_retry: false },
    n_adaptation_after_output: "PROHIBITED",
    scenario_adaptation_after_output: "PROHIBITED",
    llm_as_judge: false,
    arm_order_entering_provider_input: false,
    memory_cross_subject_swap: false,
    production_behavior_changing_diff: 0
  };
}
