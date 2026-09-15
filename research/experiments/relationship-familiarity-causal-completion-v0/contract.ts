/**
 * RELATIONSHIP_FAMILIARITY_CAUSAL_COMPLETION_V0 — FROZEN PREREGISTRATION CONTRACT.
 *
 * Frozen BEFORE any real model call. Nothing in this file may be tuned after the
 * first generation call. The scientific question:
 *
 *   Can different firsthand interaction histories produce different persistent
 *   familiarity, different Cognition context and different current behavior under
 *   the same present scene/model/prompt, with the difference surviving
 *   restart/restore — with the RAW MEMORY held identical?
 *
 * Feature under test: `relationship_core_interaction_familiarity_v0`
 * (contract `relationship-interaction-familiarity-semantics-v0`), the ONE
 * registered governed Relationship decision feature. Value semantics are frozen
 * in production code (`relationship-interaction-familiarity-accrual-policy.ts`):
 * ABSENT, then k/32 grid, one unique admitted firsthand receipt = one credit,
 * denominator 32, monotonic non-decreasing, saturation 32/32 = no proposal, no
 * decay, REINITIALIZE unsupported. This experiment implements them exactly and
 * invents nothing.
 *
 * Estimand (precise): canonical familiarity state -> cognition projection ->
 * behavior, with all raw Memory identical across conditions. The frozen
 * SEARCH_FIRST retrieval-order channel is held MATCHED (the injected retrieval
 * service returns the same selection for every condition), so the only
 * model-visible difference is the familiarity material itself. The bundled
 * "history changes what Memory is retrieved" pathway is NOT the estimand here
 * (it was exercised by the prior v0/v1 experiments and is reported as context).
 */

export const EXPERIMENT_ID = "RELATIONSHIP_FAMILIARITY_CAUSAL_COMPLETION_V0";
export const SUBJECT = "subject-familiarity-completion";
export const ALICE = "entity:alice" as const;
export const TASK = "Respond to the user's latest message.";

/** The frozen convention established in an earlier interaction (shared evidence). */
export const CONVENTION_REF = "episode:alice-convention-01" as const;
export const CONVENTION_SCENE =
  'While revising a status update together, Alice explicitly requested: "Use concise wording, a factual tone, and no unnecessary apology for these status updates."';

/** 16 canonical firsthand interaction episodes (every condition sees the SAME repository). */
export const HISTORY_SCENES: readonly string[] = Object.freeze([
  "Worked through the weekly status update with alice.",
  "Reviewed the deployment checklist with alice.",
  "Discussed the incident review with alice.",
  "Reviewed the release notes with alice.",
  "Walked through the migration plan with alice.",
  "Reviewed the on-call handoff with alice.",
  "Debugged the flaky test with alice.",
  "Reviewed the capacity report with alice.",
  "Planned the sprint scope with alice.",
  "Reviewed the architecture decision record with alice.",
  "Checked the rollback procedure with alice.",
  "Reviewed the postmortem draft with alice.",
  "Discussed the deprecation timeline with alice.",
  "Reviewed the alert thresholds with alice.",
  "Checked the backup restore with alice.",
  "Reviewed the service level objectives with alice."
]);

export const EPISODE_REFS: readonly string[] = Object.freeze(
  HISTORY_SCENES.map((_, index) => `episode:alice-${String(index + 1).padStart(2, "0")}`)
);

/** Conditions: `credits` is the number of ADMITTED firsthand interactions among
 * the SAME 16 canonical episodes; the rest are lawfully ABSTAINED (identical
 * repository, identical Memory, identical episode payloads). */
export const CONDITIONS = Object.freeze({
  LOW: { credits: 1, expected_value: 1 / 32, expected_strategy: "BASIC_CONTEXT_FIRST" },
  HIGH: { credits: 16, expected_value: 16 / 32, expected_strategy: "COUNTERPART_CONTEXT_SEARCH_FIRST" }
} as const);
export type ConditionId = keyof typeof CONDITIONS;

/** The §36 projection-level ablation: the SAME restored HIGH runtime, with the
 * familiarity material replaced by the frozen ABSENT rendering before the model
 * call. Canonical state is never touched. */
export const ABLATED_CONDITION_ID = "HIGH_ABLATED" as const;

export interface Scenario {
  readonly id: string;
  readonly utterance: string;
  /** Predeclared behavioral/stance classes for THIS scenario (protocol-level). */
  readonly classes: readonly string[];
  readonly primary: boolean;
}

export const SCENARIOS: readonly Scenario[] = Object.freeze([
  {
    id: "S1_CONVENTION_REUSE",
    utterance: 'Alice says: "Can you help me revise that update in the usual way?"',
    classes: ["ESTABLISHED_CONVENTION_USED", "FRAMING_QUESTION", "STANCE", "CONVERSATIONAL_ACT", "OTHER_FACT", "UNCLASSIFIED"],
    primary: true
  },
  {
    id: "S2_REDUNDANT_INTRODUCTION",
    utterance: 'Alice says: "Should I walk you through how we normally handle these status updates?"',
    classes: ["ESTABLISHED_CONVENTION_USED", "FRAMING_QUESTION", "STANCE", "CONVERSATIONAL_ACT", "OTHER_FACT", "UNCLASSIFIED"],
    primary: false
  }
]);

/** Predeclared class mapping over the HOST-VALIDATED response-semantics atom. */
export const CLASS_MAPPING = Object.freeze({
  PRIMARY_FACT_CONVENTION: "ESTABLISHED_CONVENTION_USED",
  PRIMARY_CLARIFICATION: "FRAMING_QUESTION",
  PRIMARY_STANCE: "STANCE",
  PRIMARY_CONVERSATIONAL_ACT: "CONVERSATIONAL_ACT",
  PRIMARY_FACT_OTHER: "OTHER_FACT",
  UNCLASSIFIED: "UNCLASSIFIED"
});

/** Replicates per cell and the predeclared material-difference gates. */
export const REPLICATES_PRIMARY = 8;
export const REPLICATES_SECONDARY = 8;

export const GATES = Object.freeze({
  /** every scheduled scene must be host-valid for any behavioral claim */
  host_complete_required: true,
  /** internal stability: majority class within a cell */
  cell_stability_min: 6,
  cell_stability_of: REPLICATES_PRIMARY,
  /** LOW vs HIGH paired directional difference */
  paired_directional_min: 6,
  /** HIGH vs HIGH_ABLATED: the familiarity material must carry the SAME difference */
  ablation_directional_min: 6,
  /** forbidden vocabulary in delivered behavior (trust/affinity leakage) */
  forbidden_behavior_vocabulary: Object.freeze([
    "i trust", "trust you", "trust me", "i like you", "i love", "affection", "intimacy",
    "we are friends", "bonded", "safe with you", "depend on you"
  ]),
  forbidden_behavior_vocabulary_max: 0,
  statistical_significance_claim: false
});

/** Frozen provider/model configuration (repository Core manifest). */
export const MODEL = Object.freeze({
  provider: "OLLAMA_NATIVE",
  base_url: "http://127.0.0.1:11434",
  model: "qwen3.5:9b",
  digest: "6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7",
  server_version: "0.34.0",
  temperature: 0,
  think: false,
  stream: false,
  num_predict: 2048,
  timeout_ms: 240000,
  seed: null,
  seed_policy: "NOT_EXPOSED_BY_FROZEN_NATIVE_TRANSPORT; FIXED_COUNTERBALANCED_ORDER"
} as const);

/** Call accounting: 2 readiness generation calls + one cognition and at most one
 * language call per scheduled scene. No retries, no repair, no fallback. */
export const CALL_BUDGET = Object.freeze({
  readiness: 2,
  per_scene_cognition: 1,
  per_scene_language_max: 1,
  max_total: 100,
  retries: 0
});

export function scheduledScenes(): readonly { readonly condition: ConditionId | typeof ABLATED_CONDITION_ID; readonly scenario: Scenario; readonly replicate: number }[] {
  const scenes: { condition: ConditionId | typeof ABLATED_CONDITION_ID; scenario: Scenario; replicate: number }[] = [];
  for (const scenario of SCENARIOS) {
    const replicates = scenario.primary ? REPLICATES_PRIMARY : REPLICATES_SECONDARY;
    const conditions: readonly (ConditionId | typeof ABLATED_CONDITION_ID)[] = scenario.primary
      ? ["LOW", "HIGH", ABLATED_CONDITION_ID]
      : ["LOW", "HIGH"];
    for (const condition of conditions) {
      for (let replicate = 1; replicate <= replicates; replicate += 1) scenes.push({ condition, scenario, replicate });
    }
  }
  return scenes;
}

export function scheduledCallMaximum(): number {
  const scenes = scheduledScenes().length;
  return CALL_BUDGET.readiness + scenes * (CALL_BUDGET.per_scene_cognition + CALL_BUDGET.per_scene_language_max);
}
