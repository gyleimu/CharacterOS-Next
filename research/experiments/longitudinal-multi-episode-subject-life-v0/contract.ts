/** Frozen preregistration for the longitudinal multi-episode subject life. No provider execution here. */

export const EXPERIMENT_VERSION = "LONGITUDINAL_MULTI_EPISODE_SUBJECT_LIFE_V0" as const;
export const BASELINE_COMMIT = "a5c1e883b33b8635612ca3f4fdbd851834ab4299" as const;
export const SUBJECT = "subject-s0" as const;
export const ALICE = "entity:alice" as const;
export const CONVERSATION_ID = "conv-longitudinal-life-v0" as const;

export type EpisodeId = "E1" | "E2" | "E3" | "E4";

export interface EpisodePlanV0 {
  readonly episode: EpisodeId;
  readonly order: number;
  /** Explicit external interval before this episode (lawful TimeTransition), 0 for E1. */
  readonly interval_ticks: number;
  readonly scene: string;
  readonly task: string;
  /** Minimal, scenario-appropriate current Appraisal (no hidden script). */
  readonly appraisal: { readonly relevance: number; readonly goal_congruence: number; readonly intensity: number };
  readonly requires_prior_evidence: boolean;
}

/** §7/§43 — exactly four chronological episodes with one authoritative restore
 * between E3 and E4. One continuing interaction domain, one counterpart. */
export const EPISODES: readonly EpisodePlanV0[] = Object.freeze([
  Object.freeze({
    episode: "E1" as const,
    order: 1,
    interval_ticks: 0,
    scene: "Alice asks how the review document should be organized: the implementation notes and the validation notes could stay separate or be merged before the review.",
    task: "Decide how the review document should be organized and tell Alice.",
    appraisal: Object.freeze({ relevance: 0.8, goal_congruence: 0.6, intensity: 0.6 }),
    requires_prior_evidence: false
  }),
  Object.freeze({
    episode: "E2" as const,
    order: 2,
    interval_ticks: 300,
    scene: "Alice asks where the review document stands now, some time after the organization question came up.",
    task: "Report the current status of the review document to Alice.",
    appraisal: Object.freeze({ relevance: 0.7, goal_congruence: 0.7, intensity: 0.5 }),
    requires_prior_evidence: true
  }),
  Object.freeze({
    episode: "E3" as const,
    order: 3,
    interval_ticks: 300,
    scene: "Alice asks whether the outstanding item on the shared checklist can be closed before the review, and whether the earlier organization decision still holds.",
    task: "Answer Alice about the outstanding checklist item and the organization decision.",
    appraisal: Object.freeze({ relevance: 0.8, goal_congruence: 0.5, intensity: 0.6 }),
    requires_prior_evidence: true
  }),
  Object.freeze({
    episode: "E4" as const,
    order: 4,
    interval_ticks: 300,
    scene: "Alice asks for a final confirmation before the review that reflects everything agreed so far.",
    task: "Give Alice the final pre-review confirmation.",
    appraisal: Object.freeze({ relevance: 0.7, goal_congruence: 0.7, intensity: 0.4 }),
    requires_prior_evidence: true
  })
]);

/** §25/§26 — deterministic, treatment-blind counterpart with a minimal explicit
 * external task state. It observes ONLY the delivered behavior text and its own
 * recorded world state; never Affect, Memory refs, current_intent or any label. */
export const COUNTERPART_POLICY = Object.freeze({
  policy_id: "DETERMINISTIC_COUNTERPART_WITH_EXPLICIT_TASK_STATE_V0",
  inputs: ["delivered behavior text", "explicit external task state"],
  forbidden_inputs: ["affect", "memory refs", "current_intent", "treatment labels", "expected outcome"],
  question_pattern: "behavior text contains '?' or '？'",
  topic_extraction: "first sentence of the behavior text, trimmed, max 80 characters",
  question_reply_template:
    "Sure — about \"{topic}\": I have noted the open item on the shared checklist and will confirm it before the review.",
  statement_reply_template:
    "Thanks — about \"{topic}\": I have recorded that on the shared checklist and left one follow-up item for the review.",
  state_updates: [
    "decision_recorded = first 120 characters of the behavior's first sentence (statement behaviors only)",
    "open_item_raised = true when the behavior asks a question",
    "exchange_count = exchange_count + 1"
  ],
  world_state_is_external: true,
  world_state_is_subject_memory: false
});

/** §22/§23 — lawful affect evolution: explicit external intervals only. */
export const AFFECT_POLICY = Object.freeze({
  interval_mechanism: "lawful v4 TimeTransition between episodes",
  manual_patch: false,
  equalization: false,
  affect_carries_across_episodes: true
});

/** Frozen affect-work-queue law: before an AffectApplication, every earlier
 * admitted factual event must carry a terminal INITIAL appraisal disposition
 * (`PRIOR_AFFECT_WORK_PENDING` otherwise). Each episode therefore also appraises
 * the counterpart reply it just received — the reply is a factual event the
 * subject lived through, and resolving it keeps the queue chronological and
 * terminal. These dimensions are minimal, neutral and NOT behavior scripts, and
 * they apply identically to every episode. */
export const REPLY_APPRAISAL = Object.freeze({
  relevance: 0.5,
  goal_congruence: 0.6,
  intensity: 0.3,
  rationale: "keep the frozen affect work queue terminal; the counterpart reply is a lived factual event",
  identical_for_all_episodes: true
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

/** §8 — real model budget. */
export const CALL_BUDGET = Object.freeze({
  cognition_calls: 4,
  language_calls_max: 4,
  maximum_real_calls: 8,
  trial_repetitions: 0,
  clarification_branch_uses_fixed_behavior: true
});

/** §38 — principal verdict vocabulary. */
export const PRINCIPAL_VERDICTS = Object.freeze([
  "LONGITUDINAL_MULTI_EPISODE_SUBJECT_LIFE_SUPPORTED",
  "LONGITUDINAL_LIFE_SUPPORTED_WITH_PARTIAL_MULTI_EPISODE_RETRIEVAL",
  "LONGITUDINAL_MEMORY_ACCUMULATES_BUT_COGNITION_VISIBILITY_PARTIAL",
  "POST_RESTORE_LIFE_CONTINUITY_BLOCKED",
  "LONGITUDINAL_LIFECYCLE_AUTHORITY_BLOCKED",
  "REAL_PROVIDER_UNAVAILABLE",
  "LONGITUDINAL_MULTI_EPISODE_SUBJECT_LIFE_FAILED"
] as const);

/** §39/§40 — secondary verdicts. */
export const MULTI_EPISODE_RETRIEVAL_VERDICTS = Object.freeze([
  "MULTI_EPISODE_RETRIEVAL_SUPPORTED",
  "MULTI_EPISODE_RETRIEVAL_PARTIAL",
  "MULTI_EPISODE_RETRIEVAL_NOT_OBSERVED"
] as const);
export const POST_RESTORE_VERDICTS = Object.freeze([
  "POST_RESTORE_LIFE_CONTINUITY_SUPPORTED",
  "POST_RESTORE_MEMORY_PRESENT_NOT_RETRIEVED",
  "POST_RESTORE_LIFE_CONTINUITY_FAILED"
] as const);

/** §32 — longitudinal metrics. */
export const LONGITUDINAL_METRICS = Object.freeze([
  "number_of_completed_episodes",
  "number_of_durable_memory_commits",
  "number_of_later_episodes_with_prior_memory_retrieved",
  "number_of_provider_requests_with_prior_life_factual_content",
  "number_of_post_restore_episodes_retrieving_pre_restore_memory"
] as const);

/** §37 — retrieval contribution classes. */
export const RETRIEVAL_CONTRIBUTION_CLASSES = Object.freeze([
  "FROM_E1",
  "FROM_E2",
  "FROM_E3",
  "CURRENT_EPISODE_ONLY",
  "OTHER_FROZEN_CONTEXT"
] as const);

export function frozenConfig(): Record<string, unknown> {
  return {
    schema_version: "longitudinal-multi-episode-subject-life-config-v0",
    experiment_version: EXPERIMENT_VERSION,
    baseline_commit: BASELINE_COMMIT,
    prior_frozen_slices: {
      future_behavior_remeasure: "FUTURE_BEHAVIOR_DIVERGENCE_INPUT_EFFECT_ONLY",
      propagation_diagnostic: "MEMORY_GROUNDED_INTENT_SIGNAL_EXISTS_BUT_CURRENT_METRIC_CANNOT_CAPTURE_IT",
      provider_surface_repair: "DURABLE_MEMORY_COGNITION_PROVIDER_SURFACE_REPAIR_IMPLEMENTED_GREEN"
    },
    subjects: 1,
    arms: 0,
    memory_ablation: false,
    control_experiment: false,
    episode_count: EPISODES.length,
    restore_boundary: "between E3 and E4",
    design_frozen_before_real_provider_output: true,
    call_budget: { ...CALL_BUDGET },
    cognition_settings: { ...COGNITION_SETTINGS },
    language_settings: { ...LANGUAGE_SETTINGS },
    counterpart_policy: { ...COUNTERPART_POLICY },
    affect_policy: { ...AFFECT_POLICY },
    verdicts: [...PRINCIPAL_VERDICTS],
    multi_episode_retrieval_verdicts: [...MULTI_EPISODE_RETRIEVAL_VERDICTS],
    post_restore_verdicts: [...POST_RESTORE_VERDICTS],
    longitudinal_metrics: [...LONGITUDINAL_METRICS],
    retrieval_contribution_classes: [...RETRIEVAL_CONTRIBUTION_CLASSES],
    prompt_changes_after_phase_a: "PROHIBITED",
    scenario_edits_after_phase_a: "PROHIBITED",
    retrieval_tuning: "PROHIBITED",
    manual_memory_write: "PROHIBITED",
    manual_memory_ref_injection: "PROHIBITED",
    new_psychology_fields: "PROHIBITED",
    production_behavior_changing_diff: 0
  };
}
