/**
 * RELATIONSHIP_FAMILIARITY_CONTEXT_MEDIATION_FINAL_REPLICATION_V2 — FROZEN PREREGISTRATION.
 *
 * The FINAL familiarity replication slice. Its ONLY purpose is to remove the host/model
 * compliance problem that left V1 at `FAMILIARITY_CONTEXT_MEDIATION_INCONCLUSIVE`
 * (host-valid 0.850 < 0.900), and then run ONE decisive preregistered replication.
 *
 * Reuses the V1 harness (`familiarity-context-mediation-replication-v1`): governed
 * familiarity history construction, the seed contamination gate, the authoritative v4
 * restore path, the model runner, the intervention cells and the instrument are unchanged
 * in shape. The MINIMAL increment is entirely host-validity work, all of it inside the
 * protocol's sanctioned levers:
 *
 *   1. SHORT IDENTIFIERS — the scenario id is `S1` and the episode refs are short, so the
 *      observation ref the model must echo in `clarification_basis` is short. V1's dominant
 *      failure was `current_observation_ref: no kind prefix` on a long generated ref.
 *   2. SHORT SOURCE TEXTS — every episode scene is one short clause.
 *   3. THE GENERIC ITEM IS A GENERIC DEFAULT THAT ANSWERS THE QUESTION — so the baseline
 *      cell produces a normal factual answer instead of being funnelled into the fragile
 *      CLARIFY path. Protocol §5 explicitly allows "只能依赖 generic evidence" as the
 *      baseline outcome, and the endpoint still discriminates by SOURCE.
 *   4. CORPUS 6 ITEMS — 4 counterpart-specific + 2 non-counterpart, exactly protocol §2.
 *
 * NOT changed: the familiarity mechanism, the host laws, the factual authority, the
 * semantic checks, any threshold, and the produced behaviour of any production package.
 *
 * FROZEN HYPOTHESES:
 *   H1  higher lawful familiarity activates counterpart-specific retrieval.
 *   H2  that retrieval changes model-facing context availability.
 *   H3  context availability changes structured cognition / behavior.
 *   H4  when context availability is equalized, high vs low familiarity produces no
 *       meaningful independent behavioral difference.
 *   H5  familiarity does not imply trust / liking / safety / intimacy / dependence /
 *       affinity / willingness to take risk.
 *
 * FINAL VERDICT SPACE (only these three): see PRINCIPAL_VERDICTS.
 */
export const EXPERIMENT_ID = "RELATIONSHIP_FAMILIARITY_CONTEXT_MEDIATION_FINAL_REPLICATION_V2";
export const SUBJECT = "subject-familiarity-final-replication";
export const ALICE = "entity:alice" as const;
export const BOB = "entity:bob" as const;
export const TASK = "Respond to the user's latest message.";

/** Non-counterpart item 1 — the GENERIC DEFAULT that answers the task question generically. */
export const GENERIC_REF = "episode:generic-01" as const;
export const GENERIC_SCENE = "By default the subject keeps project checklists in the shared team wiki.";

/** Non-counterpart item 2 — an unrelated distractor a counterpart-bound query must not select. */
export const DISTRACTOR_REF = "episode:other-01" as const;
export const DISTRACTOR_SCENE = "Bob mentioned the clinic replaced its appointment software.";

/** FOUR counterpart-specific items (protocol §2). One is the TASK-RELEVANT agreement. */
export const COUNTERPART_EPISODES: readonly {
  readonly ref: string;
  readonly scene: string;
  readonly shared_context: boolean;
}[] = Object.freeze([
  { ref: "episode:alice-01", scene: "Reviewed the deployment checklist with alice.", shared_context: false },
  { ref: "episode:alice-02", scene: "alice asked for concise, factual status notes with no unnecessary apology.", shared_context: true },
  { ref: "episode:alice-03", scene: "alice and the subject agreed to keep the rollback checklist in the shared review doc.", shared_context: true },
  { ref: "episode:alice-04", scene: "Debugged the flaky test with alice.", shared_context: false }
]);

export const EPISODE_REFS: readonly string[] = Object.freeze(COUNTERPART_EPISODES.map((entry) => entry.ref));
export const SHARED_CONTEXT_REFS: readonly string[] = Object.freeze(
  COUNTERPART_EPISODES.filter((entry) => entry.shared_context).map((entry) => entry.ref)
);
/** The ONE counterpart item that correctly answers the primary task. */
export const TASK_CONTEXT_REF = "episode:alice-03" as const;

/** The four core cells (protocol §3). `D` is built AFTER `B`'s retrieval selection is known. */
export const CONDITIONS = Object.freeze({
  A_LOW_NO_CONTEXT: { credits: 1, expected_level: 1, expected_strategy: "BASIC_CONTEXT_FIRST", expected_retrieval_queries: 0, counterpart_context_available: false },
  B_HIGH_CONTEXT: { credits: 4, expected_level: 4, expected_strategy: "COUNTERPART_CONTEXT_SEARCH_FIRST", expected_retrieval_queries: 1, counterpart_context_available: true },
  C_HIGH_CONTEXT_ABLATED: { credits: 4, expected_level: 4, expected_strategy: "COUNTERPART_CONTEXT_SEARCH_FIRST", expected_retrieval_queries: 1, counterpart_context_available: false },
  D_LOW_CONTEXT_EQUALIZED: { credits: 1, expected_level: 1, expected_strategy: "BASIC_CONTEXT_FIRST", expected_retrieval_queries: 0, counterpart_context_available: true }
} as const);
export type ConditionId = keyof typeof CONDITIONS;

export const CONDITION_IDS: readonly ConditionId[] = Object.freeze([
  "A_LOW_NO_CONTEXT",
  "B_HIGH_CONTEXT",
  "C_HIGH_CONTEXT_ABLATED",
  "D_LOW_CONTEXT_EQUALIZED"
]);

/** Research-only interventions. NONE writes canonical or production state. */
export const RESEARCH_INTERVENTIONS = Object.freeze({
  C_HIGH_CONTEXT_ABLATED: "RETRIEVAL_CONTEXT_ABLATION",
  D_LOW_CONTEXT_EQUALIZED: "CANONICAL_WORKING_REF_CONTEXT_EQUALIZATION"
} as const);

export interface Scenario {
  readonly id: string;
  readonly utterance: string;
  readonly primary: boolean;
}

/** ONE primary scenario (protocol §5). Continuing a shared coordination task; it needs
 * counterpart-specific shared context, and involves no trust, liking, risk, promise
 * reliability or safety judgement.
 *
 * PILOT-DRIVEN FORM (three rounds, all pre-scientific):
 *   R1 QUESTION ("where should it go?") — the 9B model emitted an echo claim quoting
 *      alice's own question as claim[0] and then failed to bind the observation ref in its
 *      cognition handles. That single slip dominated host-validity failure across three
 *      experiment generations (0.667).
 *   R2 NEUTRAL STATEMENT ("I'm filing the rollback checklist today.") — 1.000 host-valid,
 *      but the shared context was never NEEDED, so every cell answered from the generic
 *      default and no behavioral difference existed (all contrasts 0/6).
 *   R3 DECLARATIVE STATEMENT WITH THE DESTINATION ("I'm filing the rollback checklist in
 *      the team wiki.") — 0.958 host-valid, still no contrast: alice's message already
 *      contained the destination, so the model simply agreed with it and never consulted
 *      the stored agreement.
 *   R4 REQUEST FORM (below) — an imperative that WITHHOLDS the destination, so the subject
 *      must determine it from a source, while still giving the model no question to echo. */
export const SCENARIOS: readonly Scenario[] = Object.freeze([
  {
    id: "S1",
    utterance: 'alice says: "Please file the rollback checklist."',
    primary: true
  }
]);

export const ENDPOINT_CLASSES = Object.freeze([
  "CITES_COUNTERPART_CONTEXT",
  "CITES_GENERIC_ONLY",
  "ASKS_FOR_FRAMING",
  "GENERATIVE_ACT",
  "STANCE",
  "UNCLASSIFIED"
] as const);
export type EndpointClass = (typeof ENDPOINT_CLASSES)[number];

export const REPLICATES = 10;

/** Frozen gates (protocol §8). No threshold may be changed after the first model call. */
export const GATES = Object.freeze({
  host_valid_rate_min: 0.95,
  paired_directional_min: 6,
  same_corpus_required: true,
  seed_contamination_required: true,
  semantic_non_conflation_required: true,
  /** H5 vocabulary. Its presence is a recorded semantic violation, never a deletion. */
  forbidden_behavior_vocabulary: Object.freeze([
    "i trust", "trust you", "trust me", "i like you", "i love", "affection", "intimacy",
    "we are friends", "bonded", "safe with you", "depend on you", "rely on you", "loyal",
    "friendship", "closer to you"
  ]),
  statistical_significance_claim: false
});

/** §15/§1 model configuration. UNCHANGED from the frozen Core manifest and from V1: no
 * more reliable model is installed locally (only a 752M vision model), so the compliance
 * work is done through the protocol's sanctioned simplification levers instead. */
export const MODEL = Object.freeze({
  provider: "OLLAMA_NATIVE",
  base_url: "http://127.0.0.1:11434",
  model: "qwen3.5:9b",
  digest: "6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7",
  server_version: "0.34.0",
  temperature: 0,
  top_p: null,
  think: false,
  stream: false,
  num_predict: 2048,
  timeout_ms: 480000,
  seed: null,
  seed_policy: "NOT_EXPOSED_BY_FROZEN_NATIVE_TRANSPORT; FIXED_COUNTERBALANCED_ORDER"
} as const);

/** pilot: 4 cells × 6 = 24 scenes; requires ≥ 20 valid AND ≥ 0.95. */
export const PILOT_CELL_IDS: readonly ConditionId[] = CONDITION_IDS;
export const PILOT_REPLICATES = 6;
export const PILOT_CALL_BUDGET = Object.freeze({ readiness: 0, max_total: 50 });

export const CALL_BUDGET = Object.freeze({
  readiness: 0,
  per_scene_cognition: 1,
  per_scene_language_max: 1,
  max_total: 82,
  retries: 0
});
export const REPLICATION_CALL_BUDGET = Object.freeze({ readiness: 0, max_total: 82 });

export const PRINCIPAL_VERDICTS = Object.freeze([
  "FAMILIARITY_CONTEXT_MEDIATION_REPLICATED",
  "FAMILIARITY_CONTEXT_MEDIATION_NOT_REPLICATED",
  "EXPERIMENT_INVALID"
] as const);

export function scheduledScenes(): readonly { readonly condition: ConditionId; readonly scenario: Scenario; readonly replicate: number }[] {
  const scenes: { condition: ConditionId; scenario: Scenario; replicate: number }[] = [];
  for (const scenario of SCENARIOS) {
    for (const condition of CONDITION_IDS) {
      for (let replicate = 1; replicate <= REPLICATES; replicate += 1) scenes.push({ condition, scenario, replicate });
    }
  }
  return scenes;
}

export function replicationScenes(): readonly { readonly condition: ConditionId; readonly scenario: Scenario; readonly replicate: number }[] {
  const scenes: { condition: ConditionId; scenario: Scenario; replicate: number }[] = [];
  for (const scenario of SCENARIOS) {
    for (const condition of CONDITION_IDS) {
      for (let replicate = REPLICATES + 1; replicate <= REPLICATES * 2; replicate += 1) {
        scenes.push({ condition, scenario, replicate });
      }
    }
  }
  return scenes;
}

export function pilotScenes(): readonly { readonly condition: ConditionId; readonly scenario: Scenario; readonly replicate: number }[] {
  const scenes: { condition: ConditionId; scenario: Scenario; replicate: number }[] = [];
  for (const scenario of SCENARIOS) {
    for (const condition of PILOT_CELL_IDS) {
      for (let replicate = 1; replicate <= PILOT_REPLICATES; replicate += 1) {
        scenes.push({ condition, scenario, replicate });
      }
    }
  }
  return scenes;
}

export function scheduledCallMaximum(): number {
  return CALL_BUDGET.readiness + scheduledScenes().length * (CALL_BUDGET.per_scene_cognition + CALL_BUDGET.per_scene_language_max);
}

export function replicationCallMaximum(): number {
  return REPLICATION_CALL_BUDGET.readiness + replicationScenes().length * (CALL_BUDGET.per_scene_cognition + CALL_BUDGET.per_scene_language_max);
}
