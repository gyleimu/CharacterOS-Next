/** Frozen preregistration. No provider execution in this module. */

export const EXPERIMENT_VERSION =
  "AFFECT_DRIVEN_BEHAVIOR_EXPERIENCE_MEMORY_CAUSAL_CHAIN_V0" as const;
export const BASELINE_COMMIT =
  "dda0d8ed0b570217987dc18bbd806d8e5f91ed8c" as const;
export const SUBJECT = "subject-s0" as const;
export const ALICE = "entity:alice" as const;
export const CONVERSATION_ID = "conv-affect-chain-v0" as const;
export const TASK = "revise the update" as const;

export type TreatmentArm = "A" | "B";
export type Arm = TreatmentArm | "ABL_A" | "ABL_B";

/** §7/§8 — two behavior-sensitive scenarios (REALIZE-path patterns that
 * propagated 15/15 in the frozen language causal evidence) plus one
 * preregistered alternate used ONLY if a primary pair does not diverge. */
export interface ScenarioV0 {
  readonly scenario_id: string;
  readonly event_id: string;
  readonly role: "PRIMARY" | "ALTERNATE";
  readonly current_factual_event: string;
  readonly current_task: string;
}

export const SCENARIOS: readonly ScenarioV0[] = Object.freeze([
  Object.freeze({
    scenario_id: "CDLC-S1-figures",
    event_id: "cdlc-s1-figures",
    role: "PRIMARY" as const,
    current_factual_event:
      "The draft is ready for review except that two figures do not yet have labels, and Alice may know the intended labels.",
    current_task:
      "Ask Alice for the missing information while communicating what can proceed in the meantime."
  }),
  Object.freeze({
    scenario_id: "CDLC-S2-combine-sections",
    event_id: "cdlc-s2-combine-sections",
    role: "PRIMARY" as const,
    current_factual_event:
      "Alice suggests combining the implementation notes and validation notes into one section; the current draft keeps them separate.",
    current_task:
      "Respond to Alice's suggestion and communicate your view of the tradeoff."
  }),
  Object.freeze({
    scenario_id: "CDLC-S3-soft-boundary",
    event_id: "cdlc-s3-soft-boundary",
    role: "ALTERNATE" as const,
    current_factual_event:
      "Alice asks for an additional review today while the current deliverable is due in two hours.",
    current_task:
      "Respond to Alice by setting a workable boundary and keeping coordination possible."
  })
]);

/** §10 — reuse-law determination recorded before execution. */
export const BEHAVIOR_SOURCE_PLAN = Object.freeze({
  prior_artifact_reuse_rejected: true,
  reason:
    "Prior frozen behavior artifacts live in in-memory v4 worlds whose subject/delivery/chronology authority bindings cannot lawfully transfer; §10 forbids copying behavior strings into a fabricated history. Fresh minimal generation through the frozen production chain is the lawful source.",
  fresh_generation: {
    scenarios: SCENARIOS.filter((s) => s.role === "PRIMARY").map((s) => s.scenario_id),
    alternate_scenario: SCENARIOS.filter((s) => s.role === "ALTERNATE").map((s) => s.scenario_id),
    arms: ["A", "B"],
    trials_per_arm_scenario: 1,
    max_cognition_calls: 6,
    max_language_calls: 6
  },
  no_output_fishing: true
});

/** §13-§15 — treatment-blind deterministic counterpart policy. It inspects
 * ONLY the delivered behavior text: it acknowledges the behavior's own first
 * sentence and answers a question with the concrete detail if one was asked. */
export const COUNTERPART_POLICY = Object.freeze({
  policy_id: "DETERMINISTIC_COUNTERPART_V0",
  treatment_blind: true,
  inputs: ["behavior.text"],
  forbidden_inputs: ["arm", "valence", "activation", "canonical_affect", "trial labels"],
  question_pattern: "behavior text contains '?' or '？'",
  question_reply_template:
    "Sure — about \"{topic}\": the details you asked about are confirmed on my side, and I have added the remaining item to the shared checklist.",
  statement_reply_template:
    "Thanks for the update — regarding \"{topic}\": I reviewed it and left one follow-up note on the shared checklist for tomorrow.",
  topic_extraction: "first sentence of the behavior text, trimmed, max 80 characters"
});

/** §21 — lawful time equalization under the frozen dynamics (§23/§24):
 * 1500 ticks = 10 tau; residual valence ±0.25·e^-10 ≈ ∓1.14e-5. */
export const TIME_EQUALIZATION = Object.freeze({
  mechanism: "lawful v4 TimeTransition (the ONLY recovery writer)",
  ticks: 1500,
  tau_ticks: 150,
  expected_residual_valence_magnitude: 0.25 * Math.exp(-10),
  expected_future_activation: 0.2 + 0.148 * Math.exp(-10)
});

/** §21 — the SAME future scenario for both restored subjects. */
export const FUTURE_SCENARIO = Object.freeze({
  scenario_id: "CDLC-FUTURE-followup",
  event_id: "cdlc-future-followup",
  current_factual_event:
    "Alice follows up before the review: \"Can you walk me through what you need from me before we finalize?\"",
  current_task:
    "Respond to Alice's follow-up before the review."
});

/** §29 — preregistered principal verdicts. */
export const PRINCIPAL_VERDICTS = Object.freeze([
  "AFFECT_DRIVEN_BEHAVIOR_EXPERIENCE_MEMORY_CAUSAL_CHAIN_SUPPORTED",
  "BEHAVIOR_TO_DURABLE_MEMORY_CHAIN_SUPPORTED_FUTURE_COGNITION_NOT_ESTABLISHED",
  "BEHAVIOR_FEEDBACK_AUTHORITY_BLOCKS_CAUSAL_CHAIN",
  "FUTURE_COGNITION_MEMORY_VISIBILITY_BLOCKED",
  "CAUSAL_CHAIN_CONFOUND_DETECTED",
  "REAL_PROVIDER_BEHAVIOR_DIVERGENCE_NOT_AVAILABLE"
] as const);

/** §31 — bounded real-call budget. */
export const REAL_CALL_BUDGET = Object.freeze({
  cognition_calls_max: 6,
  language_calls_max: 6,
  future_real_calls: 0,
  no_output_fishing: true,
  alternate_scenario_attempts_max: 1
});

export function frozenConfig(): Record<string, unknown> {
  return {
    schema_version: "affect-driven-behavior-experience-memory-causal-chain-config-v0",
    experiment_version: EXPERIMENT_VERSION,
    baseline_commit: BASELINE_COMMIT,
    prior_frozen_results: {
      affect_to_cognition: "STRONGLY_SUPPORTED",
      affect_to_language_behavior: "PARTIAL_SCENARIO_SENSITIVE (15/25 vs 1/25)",
      communication_directive: "CANONICAL_AFFECT_COMMUNICATION_DIRECTIVE_INPUT_EFFECT_ONLY"
    },
    design_frozen_before_real_provider_output: true,
    scenarios: SCENARIOS.map((s) => ({ scenario_id: s.scenario_id, role: s.role })),
    counterpart_policy: { ...COUNTERPART_POLICY },
    time_equalization: { ...TIME_EQUALIZATION },
    future_scenario: { ...FUTURE_SCENARIO },
    real_call_budget: { ...REAL_CALL_BUDGET },
    manual_injection: {
      manual_affect_patch: false,
      manual_current_intent_patch: false,
      manual_behavior_patch: false,
      manual_memory_write: false,
      manual_memory_ref_injection: false,
      treatment_label_leakage: false
    },
    production_behavior_changing_diff: 0
  };
}
