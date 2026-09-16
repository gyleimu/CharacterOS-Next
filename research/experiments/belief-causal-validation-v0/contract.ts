/**
 * BELIEF_CAUSAL_VALIDATION_V0 — frozen experiment contract.
 *
 * PRIMARY SCIENTIFIC QUESTION: does a governed canonical Belief exert a
 * persistent causal influence on cognition — i.e. do different lived histories
 * produce different durable canonical Belief states that, under an otherwise
 * byte-identical present situation, produce different cognition?
 *
 * SCOPE: Belief → Cognition ONLY. The production Belief decision consumer is
 * DEAD / NOT_INTEGRATED and stays so; no arbitration, tendency, decision
 * relation or action runner is touched, and no new Belief decision feature is
 * created for this experiment.
 *
 * Everything in this file is frozen before the pilot and must not change
 * afterwards (see README.md §SCIENTIFIC FREEZE).
 */

export const EXPERIMENT_ID = "BELIEF_CAUSAL_VALIDATION_V0" as const;
export const SUBJECT = "subject-belief-causal" as const;

/** Frozen executor: the API executor independently validated by the matched executor experiment. */
export const MODEL = Object.freeze({
  id: "deepseek-flash",
  base_url: "https://api.deepseek.com",
  temperature: 0,
  top_p: null,
  max_tokens: 16384,
  timeout_ms: 240000
});

/** Frozen retry policy (§47): transport-level failures only, exact same request. */
export const RETRY_POLICY = Object.freeze({
  max_attempts: 3,
  retry_on_http: [429, 500, 502, 503, 504] as readonly number[],
  retry_on_transport: ["MODEL_TIMEOUT", "MODEL_CONNECTION_FAILURE", "MODEL_EMPTY_RESPONSE"] as readonly string[],
  backoff_ms: [4000, 12000] as readonly number[]
});

/** The ONE binary proposition under test (§6). */
export const TARGET_PROPOSITION_LABEL = "The service passage is usable." as const;

/**
 * History design (§7): three belief-relevant lived episodes per condition. The
 * FIRST episode is IDENTICAL in both conditions (the formation episode); only
 * episodes 2–3 differ (support vs contradict), so both histories share the same
 * proposition identity, the same commit count and the same evidence volume.
 */
export const SHARED_FORMATION_EPISODE = Object.freeze({
  ref: "episode:bcv-shared-1",
  occurrence_logical_time: 2,
  scene: "I walked the service passage with the caretaker and we carried two crates through it without any problem.",
  bearing: "SUPPORTS" as const
});

export const LOW_EPISODES: readonly { readonly ref: string; readonly occurrence_logical_time: number; readonly scene: string; readonly bearing: "SUPPORTS" | "CONTRADICTS" }[] = Object.freeze([
  SHARED_FORMATION_EPISODE, // forms the proposition (0.55)
  Object.freeze({
    ref: "episode:bcv-low-2",
    occurrence_logical_time: 4,
    scene: "A note on the service passage door said the service passage is unusable this week because of the renovation.",
    bearing: "CONTRADICTS" as const
  }),
  Object.freeze({
    ref: "episode:bcv-low-3",
    occurrence_logical_time: 6,
    scene: "The building manager told me the service passage is closed and not usable for residents until further notice.",
    bearing: "CONTRADICTS" as const
  })
]);

export const HIGH_EPISODES: readonly { readonly ref: string; readonly occurrence_logical_time: number; readonly scene: string; readonly bearing: "SUPPORTS" | "CONTRADICTS" }[] = Object.freeze([
  SHARED_FORMATION_EPISODE, // forms the proposition (0.55)
  Object.freeze({
    ref: "episode:bcv-high-2",
    occurrence_logical_time: 4,
    scene: "I used the service passage again this morning and the service passage was usable as usual.",
    bearing: "SUPPORTS" as const
  }),
  Object.freeze({
    ref: "episode:bcv-high-3",
    occurrence_logical_time: 6,
    scene: "The caretaker confirmed the service passage is usable and helped me carry a box through it.",
    bearing: "SUPPORTS" as const
  })
]);

/**
 * Frozen numeric expectations (canonical runtime truth; NO rounding is ever
 * applied — the frozen plasticity law uses one raw IEEE-754 double add).
 */
export const EXPECTED_LOW_PROGRESSION: readonly number[] = Object.freeze([0.55, 0.5, 0.45]);
export const EXPECTED_HIGH_PROGRESSION: readonly number[] = Object.freeze([0.55, 0.6000000000000001, 0.6500000000000001]);

/**
 * The deterministic RESEARCH-SIDE semantic provider law: it classifies the
 * bearing of the offered evidence from the episode SCENE TEXT ONLY (the same
 * authority position the production model provider occupies), and proposes a
 * NEW candidate with the target label when the canonical catalog is empty.
 * No identity, no number, no relation for a NEW candidate.
 */
export const SEMANTIC_PROVIDER_LAW = Object.freeze({
  new_when_catalog_empty: true,
  contradicts_pattern: "unusable|closed|not usable|obstructed",
  supports_pattern: "usable|carried|used the service passage"
});

/** The Current Scene (§10): identical bytes in every cell; underdetermined w.r.t. the proposition. */
export const CURRENT_SCENE = Object.freeze({
  text: "We need to move the archive boxes out of the basement tonight before the inspection, and the lift is out of service. Should I take them up through the service passage?",
  source_event_id: "source-event-bcv-current-scene-1",
  conversation_id: "conv-belief-causal"
});

export const CELL_IDS = [
  "A_LOW_BELIEF",
  "B_HIGH_BELIEF",
  "C_HIGH_BELIEF_MEDIATOR_ABLATED",
  "D_LOW_BELIEF_MEDIATOR_EQUALIZED"
] as const;
export type CellId = (typeof CELL_IDS)[number];

export const CELL_DEFINITION: Readonly<Record<CellId, { readonly durable: "LOW" | "HIGH"; readonly intervention: "NONE" | "ABLATE_TARGET" | "EQUALIZE_TARGET_TO_HIGH" }>> = Object.freeze({
  A_LOW_BELIEF: { durable: "LOW", intervention: "NONE" },
  B_HIGH_BELIEF: { durable: "HIGH", intervention: "NONE" },
  C_HIGH_BELIEF_MEDIATOR_ABLATED: { durable: "HIGH", intervention: "ABLATE_TARGET" },
  D_LOW_BELIEF_MEDIATOR_EQUALIZED: { durable: "LOW", intervention: "EQUALIZE_TARGET_TO_HIGH" }
});

/** §25/§28/§29 scene counts. */
export const PILOT_SCENES_PER_CELL = 6; // 24 pilot scenes total
export const SCENES_PER_CELL = 10; // 40 primary + 40 replication
export const PHASES = ["PILOT", "PRIMARY", "REPLICATION"] as const;
export type Phase = (typeof PHASES)[number];

/** §22 preregistered metrics + §52 thresholds. Frozen BEFORE any scientific call. */
export const GATES = Object.freeze({
  host_valid_rate_min: 0.95,
  cell_stability_min: 7, // per cell, primary outcome class must be stable in >= 7/10
  paired_directional_min: 6, // per contrast, >= 6/10 paired scenes must differ (effect) / <= 1 (null)
  null_difference_max: 1,
  truth_conflation_max: 0 // any objective-truth conflation in any cell fails the conflation gate
});

/**
 * Frozen deterministic outcome classifier over the DELIVERED text and the
 * structured cognition fields. Word lists are fixed here, before any model
 * call; evaluation NEVER happens by reading results and then inventing a rule.
 */
export const OUTCOME_CLASSIFIER = Object.freeze({
  passage_route_pattern: "service passage|back stairs|service stairs|service door",
  alternative_route_pattern: "front (entrance|lobby|door)|main (entrance|lobby|stairs)|outside|street|window|fire escape",
  verification_pattern: "check|confirm|verify|make sure|find out|ask|double-?check|unsure|not sure|uncertain|whether (it|the passage) is",
  truth_conflation_pattern: "guarantee(d|s)?|100%|certainly true|proven fact|definitely true|objective probability|probability that (it|the passage) is",
  cross_domain_pattern: "because i trust|my relationship|i feel (close|attached)|affection|my personality makes me"
});

export function scheduledScenes(phase: Phase, replicateCount: number): readonly { readonly cell: CellId; readonly replicate: number }[] {
  const schedule: { cell: CellId; replicate: number }[] = [];
  for (let replicate = 1; replicate <= replicateCount; replicate += 1) {
    for (const cell of CELL_IDS) schedule.push({ cell, replicate });
  }
  return schedule;
}

export function sceneCount(phase: Phase): number {
  return (phase === "PILOT" ? PILOT_SCENES_PER_CELL : SCENES_PER_CELL) * CELL_IDS.length;
}

/** Manifest of the frozen model configuration surfaced to every artifact. */
export function modelConfigManifest(): Readonly<Record<string, unknown>> {
  return Object.freeze({
    provider: "deepseek-openai-compatible",
    model: MODEL.id,
    base_url: MODEL.base_url,
    temperature: MODEL.temperature,
    top_p: MODEL.top_p,
    max_tokens: MODEL.max_tokens,
    timeout_ms: MODEL.timeout_ms,
    stream: false,
    response_format: "json_object (provider capability mapping of the frozen JSON_SCHEMA constraint)",
    thinking_mode: "provider default (reasoning_content is never read, scored or persisted)",
    retry_policy: RETRY_POLICY
  });
}
