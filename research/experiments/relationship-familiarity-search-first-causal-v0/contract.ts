/**
 * RELATIONSHIP_FAMILIARITY_SEARCH_FIRST_CAUSAL_EXPERIMENT_V0 — FROZEN PREREGISTRATION.
 *
 * Frozen BEFORE the first real model call. Tests exactly ONE frozen production
 * mechanism (Channel B — retrieval mediation):
 *
 *   familiarity → interaction_familiarity_cognition_influence
 *     → COUNTERPART_CONTEXT_SEARCH_FIRST → retrieval orchestration
 *     → retrieved counterpart context → Cognition → behavior
 *
 * SCOPE: production executor (`ConversationTextResponseExecutorV1`, Cognition V8 +
 * Language V10 + response-semantics atom) composed with the PRODUCTION retrieval
 * service (`RepositoryBackedMemoryRetrievalServiceV0`). The delivered session
 * composition is deliberately NOT touched (its retrieval port is inert and its own
 * query is familiarity-blind); any product-level claim would require a later,
 * separate session-integration review.
 *
 * SAME-CORPUS INVARIANT: every condition exposes exactly the SAME candidate Memory
 * corpus (same repository revision, same records, same bytes, same payload hashes).
 * Only the number of ADMITTED familiarity receipts differs (lawful producer path),
 * and only the familiarity-mediated retrieval selection differs at the scene.
 */
export const EXPERIMENT_ID = "RELATIONSHIP_FAMILIARITY_SEARCH_FIRST_CAUSAL_EXPERIMENT_V0";
export const SUBJECT = "subject-familiarity-search-first";
export const ALICE = "entity:alice" as const;
export const BOB = "entity:bob" as const;
export const TASK = "Respond to the user's latest message.";

/** The generic/basic context item (visible in EVERY condition via working refs). */
export const GENERIC_REF = "episode:generic-habit-01" as const;
export const GENERIC_SCENE = "The subject keeps the general habit of asking one clarifying question before acting on an ambiguous request.";

/** The distractor item: a lawful candidate that a counterpart-bound query must NOT surface. */
export const DISTRACTOR_REF = "episode:bob-clinic-01" as const;
export const DISTRACTOR_SCENE = "Bob mentioned the clinic replaced its appointment software last month.";

/** The counterpart-specific convention (the MEDIATOR): ONLY reachable through the
 * SEARCH_FIRST priority retrieval in HIGH_FULL; never in working refs. */
export const CONVENTION_REF = "episode:alice-08" as const;
export const CONVENTION_SCENE =
  'While revising a status update together, alice asked for a shared habit: "Use concise wording, a factual tone, and no unnecessary apology for these status updates."';

/** 16 canonical firsthand interaction episodes (identical bytes in every condition;
 * index 7 is the convention item above). */
export const HISTORY_SCENES: readonly string[] = Object.freeze([
  "Worked through the weekly status update with alice.",
  "Reviewed the deployment checklist with alice.",
  "Discussed the incident review with alice.",
  "Reviewed the release notes with alice.",
  "Reviewed the on-call handoff with alice.",
  "Debugged the flaky test with alice.",
  "Reviewed the capacity report with alice.",
  CONVENTION_SCENE,
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

/** LOW/HIGH familiarity arise ONLY from lawful producer writes over the SAME corpus. */
export const CONDITIONS = Object.freeze({
  LOW: { credits: 1, expected_value: 1 / 32, expected_strategy: "BASIC_CONTEXT_FIRST" },
  HIGH: { credits: 16, expected_value: 16 / 32, expected_strategy: "COUNTERPART_CONTEXT_SEARCH_FIRST" }
} as const);
export type ConditionId = keyof typeof CONDITIONS;

/** §10/§11 ablation: same HIGH restored state and same corpus, but the
 * familiarity-mediated priority retrieval CONTRIBUTION is suppressed (the port
 * returns an empty selection; the orchestration still fires). This is a
 * `RETRIEVAL_MEDIATOR_ABLATION`, NOT a claim that BASIC_CONTEXT_FIRST caused the
 * result, and persistent state is never touched. */
export const ABLATED_CONDITION_ID = "HIGH_SEARCH_ABLATED" as const;

export interface Scenario {
  readonly id: string;
  readonly utterance: string;
  readonly primary: boolean;
}

/** Latitude-preserving scenarios: WITHOUT counterpart context a generic/explicit
 * response or a framing question is fully lawful; WITH counterpart context, using
 * the established convention is also lawful. No unique quote mechanically
 * determines the answer. */
export const SCENARIOS: readonly Scenario[] = Object.freeze([
  {
    id: "S1_STATUS_UPDATE_REQUEST",
    utterance: 'alice says: "I need the status update for the review."',
    primary: true
  },
  {
    id: "S2_FORMAT_CHECK",
    utterance: 'alice says: "Should I keep formatting these the way we agreed?"',
    primary: false
  }
]);

/** §26: endpoint classes frozen BEFORE any call; derived from the host-validated
 * response atom + the designated claim's authority (never from free text). */
export const ENDPOINT_CLASSES = Object.freeze([
  "USES_RETRIEVED_COUNTERPART_CONTEXT",
  "ASKS_FOR_FRAMING",
  "GENERATIVE_ACT",
  "STANCE",
  "OTHER_FACT",
  "UNCLASSIFIED"
] as const);
export type EndpointClass = (typeof ENDPOINT_CLASSES)[number];

export const CLASS_MAPPING = Object.freeze({
  PRIMARY_FACT_CONVENTION: "USES_RETRIEVED_COUNTERPART_CONTEXT",
  PRIMARY_CLARIFICATION: "ASKS_FOR_FRAMING",
  PRIMARY_CONVERSATIONAL_ACT: "GENERATIVE_ACT",
  PRIMARY_STANCE: "STANCE",
  PRIMARY_FACT_OTHER: "OTHER_FACT",
  UNCLASSIFIED: "UNCLASSIFIED"
});

export const REPLICATES = 8;

/** §29 preregistered gates (frozen before the first call). */
export const GATES = Object.freeze({
  host_complete_required: true,
  cell_stability_min: 6,
  /** LOW_FULL vs HIGH_FULL must differ on the endpoint */
  paired_directional_min: 6,
  /** the ablation must return toward LOW_FULL where they differ */
  ablation_returns_toward_low_min: 6,
  /** mandatory manipulation check: HIGH must retrieve the counterpart item */
  manipulation_required: true,
  /** same-corpus digest equality is mandatory */
  same_corpus_required: true,
  forbidden_behavior_vocabulary: Object.freeze([
    "i trust", "trust you", "trust me", "i like you", "i love", "affection", "intimacy",
    "we are friends", "bonded", "safe with you", "depend on you"
  ]),
  statistical_significance_claim: false
});

/** §31 frozen provider/model configuration (repository Core manifest). */
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

/** §30 calls: 2 scenarios × 3 conditions × 8 replicates = 48 scenes ⇒ ≤ 96
 * generation calls (+ ≤ 2 readiness). No retries, no replacement, no repair. */
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
    for (const condition of ["LOW", "HIGH", ABLATED_CONDITION_ID] as const) {
      for (let replicate = 1; replicate <= REPLICATES; replicate += 1) scenes.push({ condition, scenario, replicate });
    }
  }
  return scenes;
}

export function scheduledCallMaximum(): number {
  return CALL_BUDGET.readiness + scheduledScenes().length * (CALL_BUDGET.per_scene_cognition + CALL_BUDGET.per_scene_language_max);
}
