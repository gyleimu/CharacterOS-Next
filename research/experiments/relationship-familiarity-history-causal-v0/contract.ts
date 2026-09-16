/**
 * RELATIONSHIP_FAMILIARITY_HISTORY_CAUSAL_EXPERIMENT_V0 — FROZEN PREREGISTRATION.
 *
 * Frozen BEFORE the first real model call of this execution.
 *
 * QUESTION (north star): does a DIFFERENT INTERACTION HISTORY, acting ONLY through
 * the REAL governed familiarity writer, produce a SYSTEMATIC difference in
 * cognition/behavior under the SAME model, SAME current scenario, SAME base prompt,
 * SAME memory corpus — and is that difference MEDIATED by familiarity itself
 * (rather than by mere context availability)?
 *
 *   history → (real ingestion → governed writer) → familiarity state
 *           → cognition projection/influence → behavior
 *
 * LINEAGE: continues the ONE channel the closure review left untested
 * (`RELATIONSHIP_FAMILIARITY_SEARCH_FIRST_CAUSAL_CHANNEL_UNTESTED`): the
 * familiarity-mediated retrieval channel. Two defects of the predecessor runs are
 * repaired HERE and only here:
 *   (1) INSTRUMENT: the predecessor endpoint accepted ANY designated source quote
 *       of >= 20 characters, so it matched LOW and HIGH identically by
 *       construction. The endpoint is now HOST-DETERMINED and
 *       DISCRIMINATOR-SPECIFIC: the designated factual claim must cite the EXACT
 *       counterpart mediator ref (host-validated `source_refs`).
 *   (2) CONTROLS: the predecessor design could not separate "familiarity caused it"
 *       from "the context was simply available". Two new conditions do exactly that.
 *
 * SCOPE: production executor (`ConversationTextResponseExecutorV1`, Cognition V8 +
 * Language V10 + response-semantics atom) composed with the PRODUCTION retrieval
 * service (`RepositoryBackedMemoryRetrievalServiceV0`). Executor composition, not
 * the delivered session composition.
 *
 * FROZEN INVARIANTS (never violated by any condition):
 *   - familiarity is NEVER seeded and NEVER assigned: it accrues ONLY through real
 *     occurred interaction experience → real ingestion → governed writer authority;
 *   - decision admission stays `NOT_DECISION_ADMISSIBLE` (0). Nothing here opens
 *     typed action relations; familiarity reaches cognition only through the
 *     existing lawful projection/influence/retrieval seams;
 *   - the candidate Memory corpus is byte-identical across conditions;
 *   - no history text is ever written into the prompt by the experiment.
 */
export const EXPERIMENT_ID = "RELATIONSHIP_FAMILIARITY_HISTORY_CAUSAL_EXPERIMENT_V0";
export const SUBJECT = "subject-familiarity-history-causal";
export const ALICE = "entity:alice" as const;
export const BOB = "entity:bob" as const;
export const TASK = "Respond to the user's latest message.";

/** The generic/basic context item (visible in EVERY condition via working refs). */
export const GENERIC_REF = "episode:generic-habit-01" as const;
export const GENERIC_SCENE =
  "The subject keeps the general habit of asking one clarifying question before acting on an ambiguous request.";

/** The distractor item: a lawful candidate that a counterpart-bound query must NOT surface. */
export const DISTRACTOR_REF = "episode:bob-clinic-01" as const;
export const DISTRACTOR_SCENE = "Bob mentioned the clinic replaced its appointment software last month.";

/** THE MEDIATOR: a counterpart-specific convention that is reachable ONLY through the
 * familiarity-mediated priority retrieval (or, in the availability control, through an
 * explicit canonical working ref). It is never in working refs for the other cells. */
export const MEDIATOR_REF = "episode:alice-08" as const;
export const MEDIATOR_SCENE =
  'While revising a status update together, alice asked for a shared habit: "Use concise wording, a factual tone, and no unnecessary apology for these status updates."';

/** 16 canonical firsthand interaction episodes (identical bytes in every condition). */
export const HISTORY_SCENES: readonly string[] = Object.freeze([
  "Worked through the weekly status update with alice.",
  "Reviewed the deployment checklist with alice.",
  "Discussed the incident review with alice.",
  "Reviewed the release notes with alice.",
  "Reviewed the on-call handoff with alice.",
  "Debugged the flaky test with alice.",
  "Reviewed the capacity report with alice.",
  MEDIATOR_SCENE,
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

/** The five preregistered cells. Only `credits` (the number of ADMITTED interaction
 * receipts) and the explicitly-named research intervention distinguish them.
 * `expected_retrieval_queries` is the frozen host-side consequence of the cell's
 * influence strategy (BASIC ⇒ 0; SEARCH_FIRST ⇒ exactly 1), regardless of whether that
 * query's CONTRIBUTION is then suppressed by an intervention. */
export const CONDITIONS = Object.freeze({
  /** Baseline: minimal lawful familiarity (1 credited interaction → 1/32, BASIC strategy). */
  A_LOW: { credits: 1, expected_level: 1, expected_strategy: "BASIC_CONTEXT_FIRST", expected_retrieval_queries: 0, mediator_available: false },
  /** Treatment: high familiarity (16 credited interactions → 16/32, SEARCH_FIRST). */
  B_HIGH: { credits: 16, expected_level: 16, expected_strategy: "COUNTERPART_CONTEXT_SEARCH_FIRST", expected_retrieval_queries: 1, mediator_available: true },
  /** MEDIATOR ABLATION: same HIGH state; the priority retrieval still fires but its
   * validated contribution is suppressed → mediator unavailable, familiarity HIGH. */
  C_MEDIATOR_ABLATED: { credits: 16, expected_level: 16, expected_strategy: "COUNTERPART_CONTEXT_SEARCH_FIRST", expected_retrieval_queries: 1, mediator_available: false },
  /** FAMILIARITY EQUALIZATION (mediation test): same HIGH history/state, but the
   * familiarity REPRESENTATION handed to cognition is replaced by A_LOW's
   * (level 1/32, BASIC) and the mediator contribution is suppressed, so the EFFECTIVE
   * familiarity equals A_LOW while the HISTORY stays HIGH. The host still runs the one
   * priority query (the influence is derived from the REAL state) and discards its
   * contribution, so the model-facing prompt carries A_LOW's representation.
   * RESEARCH_INTERVENTION_ONLY / NOT_PRODUCTION_WRITE — no canonical state is written. */
  D_FAMILIARITY_EQUALIZED: { credits: 16, expected_level: 1, expected_strategy: "BASIC_CONTEXT_FIRST", expected_retrieval_queries: 1, mediator_available: false },
  /** AVAILABILITY CONTROL: minimal familiarity (1/32, BASIC) but the mediator is made
   * available WITHOUT familiarity via an explicit canonical working ref. Separates
   * "familiarity selected it" from "it was simply there". */
  E_LOW_WITH_MEDIATOR: { credits: 1, expected_level: 1, expected_strategy: "BASIC_CONTEXT_FIRST", expected_retrieval_queries: 0, mediator_available: true },
  /** ADVERSARIAL AVAILABILITY CONTROL (declared as an additional control AFTER the
   * primary execution observed an effect, i.e. an explicitly post-hoc-added control that
   * can only WEAKEN the finding): minimal familiarity (1/32, BASIC, 0 priority queries)
   * but the ENTIRE counterpart corpus is readable, matching the treatment's availability
   * scope without any familiarity. If this cell reproduces the treatment behaviour, the
   * effect is availability-driven and NOT familiarity-causal. */
  F_LOW_FULL_CORPUS: { credits: 1, expected_level: 1, expected_strategy: "BASIC_CONTEXT_FIRST", expected_retrieval_queries: 0, mediator_available: true }
} as const);
export type ConditionId = keyof typeof CONDITIONS;

/** The five preregistered primary cells (the frozen primary design). */
export const CONDITION_IDS: readonly ConditionId[] = Object.freeze([
  "A_LOW",
  "B_HIGH",
  "C_MEDIATOR_ABLATED",
  "D_FAMILIARITY_EQUALIZED",
  "E_LOW_WITH_MEDIATOR"
]);

/** Cells built/verified in the deterministic phase (primary five + the control cell). */
export const ALL_CELL_IDS: readonly ConditionId[] = Object.freeze([
  ...CONDITION_IDS,
  "F_LOW_FULL_CORPUS"
]);

/** The control execution's schedule: baseline, treatment and the adversarial control,
 * measured in ONE execution so the comparison is matched. */
export const CONTROL_CONDITIONS: readonly ConditionId[] = Object.freeze([
  "A_LOW",
  "B_HIGH",
  "F_LOW_FULL_CORPUS"
]);
export const CONTROL_CALL_BUDGET = Object.freeze({ readiness: 0, max_total: 50 });

export function controlScenes(): readonly {
  readonly condition: ConditionId;
  readonly scenario: Scenario;
  readonly replicate: number;
}[] {
  const scenes: { condition: ConditionId; scenario: Scenario; replicate: number }[] = [];
  for (const scenario of SCENARIOS) {
    for (const condition of CONTROL_CONDITIONS) {
      for (let replicate = 1; replicate <= REPLICATES; replicate += 1) scenes.push({ condition, scenario, replicate });
    }
  }
  return scenes;
}

export function controlCallMaximum(): number {
  return CONTROL_CALL_BUDGET.readiness
    + controlScenes().length * (CALL_BUDGET.per_scene_cognition + CALL_BUDGET.per_scene_language_max);
}

/** Research interventions applied by `scene.ts`, declared explicitly so no reader can
 * mistake them for production writes. */
export const RESEARCH_INTERVENTIONS = Object.freeze({
  C_MEDIATOR_ABLATED: "RETRIEVAL_MEDIATOR_ABLATION",
  D_FAMILIARITY_EQUALIZED: "FAMILIARITY_REPRESENTATION_EQUALIZATION",
  E_LOW_WITH_MEDIATOR: "CANONICAL_WORKING_REF_AVAILABILITY"
} as const);

export interface Scenario {
  readonly id: string;
  readonly utterance: string;
  readonly primary: boolean;
}

/** Latitude-preserving scenarios: WITHOUT counterpart context a framing question or a
 * generic answer is fully lawful; WITH counterpart context, answering from the
 * established convention is ALSO lawful. Neither utterance mechanically determines the
 * answer, so the model retains a real choice.
 *
 * PRE-RUN INSTRUMENT NOTE (declared before the primary execution, after a single
 * scoping smoke call on the predecessor's S1 phrasing): the host's frozen factual
 * authority requires a SOURCE_QUOTE to be an exact substring of EVERY cited source, and
 * the 9B model frequently fails that law when it cites several sources at once —
 * observed failure `claims[1]: REJECTED_SOURCE_BINDING`. S1 therefore asks a question
 * whose natural answer is ONE convention from ONE source, which keeps the endpoint
 * diagnostic while removing an avoidable model-compliance artefact. The endpoint
 * classes, gates and cells are unchanged. */
export const SCENARIOS: readonly Scenario[] = Object.freeze([
  {
    id: "S1_CONVENTION_RECALL",
    utterance: 'alice says: "How do you want these status updates written?"',
    primary: true
  },
  {
    id: "S2_FORMAT_CHECK",
    utterance: 'alice says: "Should I keep formatting these the way we agreed?"',
    primary: false
  }
]);

/** §26 endpoint classes frozen BEFORE any call. Derived ONLY from host-validated
 * facts (the response-semantics atom + the designated claim's authorized
 * `source_refs`), never from free text and never from a model judge. */
export const ENDPOINT_CLASSES = Object.freeze([
  "CITES_COUNTERPART_MEDIATOR",
  "CITES_OTHER_EVIDENCE",
  "ASKS_FOR_FRAMING",
  "GENERATIVE_ACT",
  "STANCE",
  "UNCLASSIFIED"
] as const);
export type EndpointClass = (typeof ENDPOINT_CLASSES)[number];

export const REPLICATES = 4;

/** §29 preregistered gates (frozen before the first call). */
export const GATES = Object.freeze({
  host_complete_required: true,
  cell_stability_min: 3,
  /** A_LOW vs B_HIGH must differ on the endpoint */
  paired_directional_min: 3,
  /** the two ablations must return toward A_LOW where A/B differ */
  ablation_returns_toward_low_min: 3,
  /** the availability control must NOT reproduce the treatment effect */
  availability_control_must_not_reproduce: true,
  manipulation_required: true,
  same_corpus_required: true,
  seed_contamination_required: true,
  forbidden_behavior_vocabulary: Object.freeze([
    "i trust", "trust you", "trust me", "i like you", "i love", "affection", "intimacy",
    "we are friends", "bonded", "safe with you", "depend on you"
  ]),
  statistical_significance_claim: false
});

/** §31 frozen provider/model configuration.
 *
 * PRE-RUN DECLARATION: `timeout_ms` is 480000 here (the repository's other
 * familiarity experiments use 240000). The treatment cell legitimately exposes a
 * much larger factual-source set (17 sources vs 2), and the 9B model's
 * `reasoning_summary` grows with it; a scoping smoke call observed one scene
 * exceeding the 240000 ms bound on the treatment path. Raising the bound removes a
 * transport artefact that is unrelated to the causal question. `num_predict`,
 * temperature, think, stream and the model/digest are unchanged. */
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
  timeout_ms: 480000,
  seed: null,
  seed_policy: "NOT_EXPOSED_BY_FROZEN_NATIVE_TRANSPORT; FIXED_COUNTERBALANCED_ORDER"
} as const);

/** §30 calls: 2 scenarios × 5 conditions × 4 replicates = 40 scenes ⇒ ≤ 80 generation
 * calls (+ ≤ 2 readiness). No retries, no replacement, no repair. */
export const CALL_BUDGET = Object.freeze({
  readiness: 2,
  per_scene_cognition: 1,
  per_scene_language_max: 1,
  max_total: 82,
  retries: 0
});

/** §7 replication execution (authorized ONLY if the primary execution passes its
 * gates): A_LOW vs B_HIGH on both scenarios, fresh execution identity. */
export const REPLICATION_CONDITIONS: readonly ConditionId[] = Object.freeze(["A_LOW", "B_HIGH"]);
export const REPLICATION_CALL_BUDGET = Object.freeze({
  readiness: 0,
  max_total: 34
});

export function scheduledScenes(): readonly {
  readonly condition: ConditionId;
  readonly scenario: Scenario;
  readonly replicate: number;
}[] {
  const scenes: { condition: ConditionId; scenario: Scenario; replicate: number }[] = [];
  for (const scenario of SCENARIOS) {
    for (const condition of CONDITION_IDS) {
      for (let replicate = 1; replicate <= REPLICATES; replicate += 1) scenes.push({ condition, scenario, replicate });
    }
  }
  return scenes;
}

export function scheduledCallMaximum(): number {
  return CALL_BUDGET.readiness
    + scheduledScenes().length * (CALL_BUDGET.per_scene_cognition + CALL_BUDGET.per_scene_language_max);
}

export function replicationScenes(): readonly {
  readonly condition: ConditionId;
  readonly scenario: Scenario;
  readonly replicate: number;
}[] {
  const scenes: { condition: ConditionId; scenario: Scenario; replicate: number }[] = [];
  for (const scenario of SCENARIOS) {
    for (const condition of REPLICATION_CONDITIONS) {
      for (let replicate = 1; replicate <= REPLICATES; replicate += 1) scenes.push({ condition, scenario, replicate });
    }
  }
  return scenes;
}

export function replicationCallMaximum(): number {
  return REPLICATION_CALL_BUDGET.readiness
    + replicationScenes().length * (CALL_BUDGET.per_scene_cognition + CALL_BUDGET.per_scene_language_max);
}

/** §8 the ONLY permitted principal scientific verdicts of this experiment. */
export const PRINCIPAL_VERDICTS = Object.freeze([
  "FAMILIARITY_CAUSAL_INFLUENCE_REPLICATED",
  "FAMILIARITY_CAUSAL_INFLUENCE_OBSERVED_NOT_REPLICATED",
  "FAMILIARITY_EFFECT_INCONCLUSIVE",
  "FAMILIARITY_NO_DETECTABLE_CAUSAL_INFLUENCE",
  "EXPERIMENT_INVALID_SEED_CONTAMINATION",
  "EXPERIMENT_INVALID"
] as const);
