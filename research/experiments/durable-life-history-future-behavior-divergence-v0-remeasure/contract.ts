/** Frozen remeasurement preregistration. No provider execution in this module. */

import {
  FUTURE_ARMS,
  FUTURE_SCENARIO,
  LIFE_SCENARIOS,
  SUBJECT as V0_SUBJECT,
  type FutureArm,
  type LifeScenarioV0,
  type TreatmentArm
} from "../durable-life-history-future-behavior-divergence-v0/contract.ts";

export const EXPERIMENT_VERSION =
  "DURABLE_LIFE_HISTORY_FUTURE_BEHAVIOR_DIVERGENCE_V0_REMEASURE" as const;
export const BASELINE_COMMIT =
  "e09d4b87e27c2935379da33a6e838592f0e00bcd" as const;
export const ORIGINAL_V0_VERSION =
  "DURABLE_LIFE_HISTORY_FUTURE_BEHAVIOR_DIVERGENCE_V0" as const;
export const ORIGINAL_V0_COMMIT =
  "b2031c6f114349a08643342b369ba5b2036c5107" as const;
export const REPAIR_VERSION =
  "DURABLE_MEMORY_COGNITION_PROVIDER_SURFACE_REPAIR_V0" as const;
export const REPAIR_COMMIT = BASELINE_COMMIT;
export const SUBJECT = V0_SUBJECT;

/** §7/§8/§14 — the frozen V0 design is reused verbatim, never redesigned. */
export const FROZEN_DESIGN_REUSE = Object.freeze({
  schema_version: "durable-life-history-remeasure-design-reuse-v0",
  future_scenario: { ...FUTURE_SCENARIO },
  life_scenarios: LIFE_SCENARIOS.map((scenario: LifeScenarioV0) => ({ ...scenario })),
  four_arms: [...FUTURE_ARMS],
  sample_size: { future_scenarios: 1, arms: 4, trials_per_arm: 5 },
  history_construction: {
    prior_goal_congruence: { A: 1, B: 0 },
    expected_prior_valence: { A: 0.25, B: -0.25 },
    chain: [
      "cognition", "behavior", "delivery", "treatment-blind counterpart response",
      "Observation", "Experience", "Learning", "durable Memory"
    ],
    manual_patch: false
  },
  affect_recovery: { mechanism: "lawful v4 TimeTransition", ticks: 1500, manual_equalization: false },
  provider: { provider: "OLLAMA_NATIVE", model: "qwen3.5:9b" },
  retry_policy: { cognition: 0, language: 0, condition_specific_rescue: false },
  arm_balancing: "frozen V0 balanced rotation (BALANCED_FUTURE_ARM_ORDER)",
  primary_endpoints: ["current_intent", "CharacterLanguageBehaviorV0 content"],
  ablation_contract: "EXPERIMENTAL_PROVIDER_FACING_BEHAVIOR_OUTCOME_EVIDENCE_REMOVAL_V0",
  verdict_thresholds: "frozen V0 §43 thresholds (40pp support, 10pp no-effect region, >=4/5 complete units)",
  claim_boundary: "frozen V0 §45 boundary",
  redesign_permitted: false,
  n_increase_permitted: false,
  scenario_change_permitted: false,
  prompt_change_permitted: false
});

/** §31 — remeasurement verdict vocabulary (V0 vocabulary + collection validity). */
export const PRINCIPAL_VERDICTS = Object.freeze([
  "DURABLE_LIFE_HISTORY_FUTURE_BEHAVIOR_DIVERGENCE_SUPPORTED",
  "DURABLE_HISTORY_FUTURE_COGNITION_EFFECT_ONLY",
  "FUTURE_BEHAVIOR_DIVERGENCE_INPUT_EFFECT_ONLY",
  "NO_MEASURABLE_DURABLE_HISTORY_FUTURE_EFFECT_UNDER_V0",
  "MEMORY_ABLATION_CONTROL_INVALID",
  "FUTURE_MEMORY_VISIBILITY_FAILURE",
  "CAUSAL_CHAIN_CONFOUND_DETECTED",
  "REAL_PROVIDER_UNAVAILABLE",
  "COLLECTION_VALIDITY_FAILURE"
] as const);

export const REMEASUREMENT_FAILURE_VERDICTS = Object.freeze([
  "COLLECTION_VALIDITY_FAILURE",
  "REMEASUREMENT_SOURCE_HISTORY_NOT_RECONSTRUCTABLE"
] as const);

/** §18 — provider-request difference classification vocabulary. */
export const REQUEST_DIFF_CLASSES = Object.freeze([
  "EXPECTED_MEMORY_CONTENT",
  "EXPECTED_MEMORY_REF_IDENTITY",
  "EXPECTED_BOUNDED_AFFECT_RESIDUAL",
  "EXPECTED_DERIVED_HASH",
  "UNEXPECTED_CONFOUND"
] as const);

/** §33 — collection validity gate for the full support/no-effect interpretation. */
export const COLLECTION_VALIDITY_GATE = Object.freeze({
  minimum_complete_behavior_four_arm_units: 4,
  trials_per_arm: 5,
  interpretation_requires: "complete behavior four-arm units >= 4/5",
  below_threshold_verdict: "COLLECTION_VALIDITY_FAILURE"
});

/** §32 — schema-failure taxonomy that must be reported for every rejection. */
export const FAILURE_TAXONOMY_FIELDS = Object.freeze([
  "arm",
  "trial",
  "error_code",
  "validation_field",
  "raw_considered_context_refs",
  "canonical_considered_context_refs"
]);

/** §48 — repair regression audit required before and after collection. */
export const REPAIR_REGRESSION_CHECKS = Object.freeze([
  "memory_factual_rendering_active",
  "set_like_ref_canonicalization_active",
  "validator_duplicate_rejection_active",
  "unknown_ref_rejection_active"
]);

export const TOKEN_ACCOUNTING_SECTIONS = Object.freeze([
  "life_reconstruction_cognition_tokens",
  "life_reconstruction_language_tokens",
  "future_cognition_tokens",
  "future_language_tokens",
  "total_tokens",
  "external_api_cost"
]);

/** Frozen original V0 evidence referenced (never rewritten, §3/§45). */
export const ORIGINAL_V0_EVIDENCE_DIR =
  "research/experiments/durable-life-history-future-behavior-divergence-v0/evidence/run-1-real-provider" as const;

export function frozenConfig(): Record<string, unknown> {
  return {
    schema_version: "durable-life-history-future-behavior-remeasure-config-v0",
    experiment_version: EXPERIMENT_VERSION,
    baseline_commit: BASELINE_COMMIT,
    original_v0: {
      experiment: ORIGINAL_V0_VERSION,
      commit: ORIGINAL_V0_COMMIT,
      verdict: "NO_MEASURABLE_DURABLE_HISTORY_FUTURE_EFFECT_UNDER_V0",
      verdict_is_informative: false,
      verdict_interpretation: "COLLECTION_VALIDITY_FAILURE_NOT_EVIDENCE_OF_ABSENCE_OF_EFFECT",
      evidence_dir: ORIGINAL_V0_EVIDENCE_DIR
    },
    repair: {
      experiment: REPAIR_VERSION,
      commit: REPAIR_COMMIT,
      verdict: "DURABLE_MEMORY_COGNITION_PROVIDER_SURFACE_REPAIR_IMPLEMENTED_GREEN"
    },
    design_reuse: { ...FROZEN_DESIGN_REUSE },
    verdicts: [...PRINCIPAL_VERDICTS],
    collection_validity_gate: { ...COLLECTION_VALIDITY_GATE },
    request_diff_classes: [...REQUEST_DIFF_CLASSES],
    failure_taxonomy_fields: [...FAILURE_TAXONOMY_FIELDS],
    repair_regression_checks: [...REPAIR_REGRESSION_CHECKS],
    token_accounting_sections: [...TOKEN_ACCOUNTING_SECTIONS],
    design_frozen_before_future_real_provider_output: true,
    prompt_changes_during_measurement: "PROHIBITED",
    retrieval_changes: "PROHIBITED",
    affect_changes: "PROHIBITED",
    history_transplant: "PROHIBITED",
    llm_as_judge: false,
    production_behavior_changing_diff: 0
  };
}

export type { FutureArm, LifeScenarioV0, TreatmentArm };
