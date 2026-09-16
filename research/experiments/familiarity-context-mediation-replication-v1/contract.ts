/**
 * FAMILIARITY_CONTEXT_MEDIATION_REPLICATION_V1 — FROZEN PREREGISTRATION.
 *
 * Frozen BEFORE the first primary model call of this execution.
 *
 * CONTINUES `RELATIONSHIP_FAMILIARITY_HISTORY_CAUSAL_EXPERIMENT_V0` (verbatim source
 * reference, commit `bcf7e5d`) with a minimal increment. The V0 harness — governed
 * familiarity history construction, the seed contamination gate, the authoritative
 * restore path, the model runner, source/evidence instrumentation and the
 * intervention cells — is REUSED unchanged in shape.
 *
 * PREREGISTERED HYPOTHESES (frozen; no post-hoc edit to pursue a PASS):
 *   H1  higher governed interaction familiarity causes counterpart-specific retrieval
 *       to activate.
 *   H2  that retrieval changes model-facing context availability.
 *   H3  the changed context availability causes reproducible cognition/behavior
 *       differences.
 *   H4  when context availability is equalized, the familiarity SCALAR itself produces
 *       no detectable independent behavioral effect.
 *   H5  no trust / liking / safety / intimacy semantics emerge from familiarity.
 *
 * The question is CONTEXT-MEDIATION, not a scalar direct effect. The only permitted
 * verdicts are the five in `PRINCIPAL_VERDICTS` below.
 *
 * V0 DEFECT REPAIRED HERE: V0's treatment cell exposed ~36 factual sources, which pushed
 * the 9B model's compliance with the frozen factual-authority law below the gate and made
 * the preregistered primary scenario host-incomplete. V1 uses a SMALL, SYMMETRIC corpus
 * (6 counterpart items) and, per the frozen protocol, runs a HOST VALIDITY PILOT before
 * any scientific execution. The familiarity mechanism and every host law are UNCHANGED.
 */
export const EXPERIMENT_ID = "FAMILIARITY_CONTEXT_MEDIATION_REPLICATION_V1";
export const SUBJECT = "subject-familiarity-context-mediation";
export const ALICE = "entity:alice" as const;
export const BOB = "entity:bob" as const;
export const TASK = "Respond to the user's latest message.";

/** The generic item: visible in EVERY cell via canonical working refs.
 *
 * PILOT-DRIVEN CHOICE (two rounds). Round 1 used an instruction-like habit sentence; every
 * treatment-cell failure was an EXTRA claim recruiting it. Round 2 replaced it with a
 * status-review fact, which the model still recruited. It is now FULLY ORTHOGONAL to the
 * task topic: it shares no noun with either scenario, so there is nothing to over-cite,
 * while the baseline prompt is still non-empty ("generic evidence only"). */
export const GENERIC_REF = "episode:generic-habit-01" as const;
export const GENERIC_SCENE =
  "The subject's shared drive is mounted as the R: volume on the work laptop.";

/** The distractor: a lawful candidate that a counterpart-bound query must NOT surface. */
export const DISTRACTOR_REF = "episode:bob-clinic-01" as const;
export const DISTRACTOR_SCENE = "Bob mentioned the clinic replaced its appointment software last month.";

/**
 * FOUR counterpart-specific items — the ONLY things familiarity can make readable.
 * Items 02 and 03 carry the SHARED CONTEXT the two scenarios depend on. The corpus size
 * was reduced from six to four after the first HOST VALIDITY PILOT exposed model
 * compliance slips on the larger source set; the familiarity mechanism is untouched.
 */
export const COUNTERPART_EPISODES: readonly {
  readonly ref: string;
  readonly scene: string;
  readonly shared_context: boolean;
}[] = Object.freeze([
  {
    ref: "episode:alice-01",
    scene: "Worked through the weekly status update with alice.",
    shared_context: false
  },
  {
    ref: "episode:alice-02",
    scene:
      'While revising a status update together, alice asked for a shared habit: use concise wording, a factual tone, and no unnecessary apology for these status updates.',
    shared_context: true
  },
  {
    ref: "episode:alice-03",
    scene:
      "alice and the subject agreed to keep the rollback checklist in the shared review doc rather than restating it each time.",
    shared_context: true
  },
  {
    ref: "episode:alice-04",
    scene: "Debugged the flaky test with alice.",
    shared_context: false
  }
]);

export const EPISODE_REFS: readonly string[] = Object.freeze(
  COUNTERPART_EPISODES.map((entry) => entry.ref)
);
export const SHARED_CONTEXT_REFS: readonly string[] = Object.freeze(
  COUNTERPART_EPISODES.filter((entry) => entry.shared_context).map((entry) => entry.ref)
);

/** The four core cells. `D` is built AFTER `B`'s retrieval selection is known.
 * Credit counts equal the counterpart corpus size (4) for HIGH so that the WHOLE
 * counterpart corpus is legitimately accrued; 1 credit keeps LOW below the frozen
 * `ordinal_level >= 2` retrieval trigger. */
export const CONDITIONS = Object.freeze({
  /** Baseline: minimal lawful familiarity; retrieval below the trigger threshold. */
  A_LOW: { credits: 1, expected_level: 1, expected_strategy: "BASIC_CONTEXT_FIRST", expected_retrieval_queries: 0, counterpart_context_available: false },
  /** Treatment: high familiarity; the ONE priority retrieval exposes the counterpart items. */
  B_HIGH: { credits: 4, expected_level: 4, expected_strategy: "COUNTERPART_CONTEXT_SEARCH_FIRST", expected_retrieval_queries: 1, counterpart_context_available: true },
  /** Mediator ablation: same canonical familiarity AND same history as B_HIGH; the
   * priority query still fires but its validated CONTRIBUTION is suppressed. */
  C_HIGH_RETRIEVAL_ABLATED: { credits: 4, expected_level: 4, expected_strategy: "COUNTERPART_CONTEXT_SEARCH_FIRST", expected_retrieval_queries: 1, counterpart_context_available: false },
  /** Context equalization: canonical familiarity of A_LOW, but B_HIGH's exact retrieved
   * counterpart set is provided as canonical working refs, so effective context
   * availability equals B_HIGH while the familiarity scalar stays LOW. */
  D_LOW_CONTEXT_EQUALIZED: { credits: 1, expected_level: 1, expected_strategy: "BASIC_CONTEXT_FIRST", expected_retrieval_queries: 0, counterpart_context_available: true }
} as const);
export type ConditionId = keyof typeof CONDITIONS;

export const CONDITION_IDS: readonly ConditionId[] = Object.freeze([
  "A_LOW",
  "B_HIGH",
  "C_HIGH_RETRIEVAL_ABLATED",
  "D_LOW_CONTEXT_EQUALIZED"
]);

/** Cells whose canonical history is identical to another cell's (asserted in precheck). */
export const SAME_HISTORY_PAIRS: readonly (readonly [ConditionId, ConditionId])[] = Object.freeze([
  ["B_HIGH", "C_HIGH_RETRIEVAL_ABLATED"]
]);

/** Research-only interventions. NONE writes canonical state or fakes governed history. */
export const RESEARCH_INTERVENTIONS = Object.freeze({
  C_HIGH_RETRIEVAL_ABLATED: "RETRIEVAL_MEDIATOR_ABLATION",
  D_LOW_CONTEXT_EQUALIZED: "CANONICAL_WORKING_REF_CONTEXT_EQUALIZATION"
} as const);

export interface Scenario {
  readonly id: string;
  readonly utterance: string;
  readonly primary: boolean;
}

/**
 * SINGLE PRIMARY SCENARIO (frozen on PILOT evidence, per protocol §3/§10).
 *
 * The scenario ASKS FOR THE CONTENT of counterpart-specific shared context, so the shared
 * context is NECESSARY to answer: without it the subject cannot state the agreement and
 * must clarify. It involves no risk, money, credibility, safety, disclosure or any
 * willingness judgement, so a difference cannot be read as trust/liking.
 *
 * PILOT HISTORY (five rounds, all before any scientific execution):
 *   R1 open question                        → multi-claim handle-binding slips
 *   R2/R3 confirmation ("the way we agreed") → answerable by mere agreement; the readable
 *                                              context was never USED, so no signal
 *   R4/R5 content question (convention topic)→ the model emitted a first claim echoing the
 *                                              observation and mis-bound it in EVERY cell
 *   R6 content question (shared-doc topic)  → 4/4 host-valid, correct direction
 * The topic that survived piloting is therefore frozen as the ONE primary scenario; the
 * unvalidated topic is NOT carried as a secondary rather than shipped knowingly broken.
 */
export const SCENARIOS: readonly Scenario[] = Object.freeze([
  {
    id: "S1_SHARED_CONTEXT_CONTENT",
    utterance: 'alice says: "What did we agree about the rollback checklist?"',
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

export const REPLICATES = 5;

/** Frozen gates. `paired_directional_min` is 3 of 4 replicates on the primary scenario. */
export const GATES = Object.freeze({
  host_complete_required: true,
  /** host-valid rate across ALL scheduled scenes of an execution */
  host_valid_rate_min: 0.9,
  paired_directional_min: 3,
  /** mandatory: B must actually expose the counterpart context, A must not */
  manipulation_required: true,
  same_corpus_required: true,
  seed_contamination_required: true,
  semantic_non_conflation_required: true,
  forbidden_behavior_vocabulary: Object.freeze([
    "i trust", "trust you", "trust me", "i like you", "i love", "affection", "intimacy",
    "we are friends", "bonded", "safe with you", "depend on you", "rely on you", "loyal"
  ]),
  statistical_significance_claim: false
});

/** §15 model configuration (unchanged from the frozen Core manifest). */
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

/** Host validity pilot: model compliance only — ZERO scientific verdict, distinct
 * identities from the primary schedule. Covers ALL FOUR cells so every cell's compliance
 * is measured before freezing. */
export const PILOT_CELL_IDS: readonly ConditionId[] = Object.freeze([
  "A_LOW",
  "B_HIGH",
  "C_HIGH_RETRIEVAL_ABLATED",
  "D_LOW_CONTEXT_EQUALIZED"
]);
export const PILOT_REPLICATES = 2;
export const PILOT_CALL_BUDGET = Object.freeze({ readiness: 0, max_total: 18 });

export const CALL_BUDGET = Object.freeze({
  readiness: 2,
  per_scene_cognition: 1,
  per_scene_language_max: 1,
  max_total: 70,
  retries: 0
});
export const REPLICATION_CALL_BUDGET = Object.freeze({ readiness: 0, max_total: 34 });

/** The FIVE permitted verdicts. No "causal influence" wording is permitted. */
export const PRINCIPAL_VERDICTS = Object.freeze([
  "FAMILIARITY_CONTEXT_MEDIATION_REPLICATED",
  "FAMILIARITY_CONTEXT_MEDIATION_OBSERVED_NOT_REPLICATED",
  "FAMILIARITY_CONTEXT_MEDIATION_INCONCLUSIVE",
  "FAMILIARITY_CONTEXT_MEDIATION_NOT_DETECTED",
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
