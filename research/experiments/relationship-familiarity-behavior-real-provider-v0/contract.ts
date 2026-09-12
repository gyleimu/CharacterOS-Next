/**
 * RELATIONSHIP_FAMILIARITY_BEHAVIORAL_DIFFERENTIATION_REAL_PROVIDER_V0 — frozen contract.
 *
 * Estimand: canonical `relationship_core_interaction_familiarity_v0` state →
 * observable production behavior, with ALL model-visible non-familiarity state
 * held byte-equal across arms.
 *
 * Frozen BEFORE any real model call. Never edited after the first call.
 */

export const EXPERIMENT_ID = "RELATIONSHIP_FAMILIARITY_BEHAVIORAL_DIFFERENTIATION_REAL_PROVIDER_V0" as const;
export const MANIFEST_SCHEMA = "relationship-familiarity-behavior-manifest-v0" as const;

export const SUBJECT = "subject-familiarity-behavior-v0" as const;
export const ALICE = "entity:alice" as const;
/** The single shared canonical convention episode, present in BOTH arms. */
export const CONVENTION_REF = "episode:alice-08" as const;
export const RESPONSE_REQUEST_ID = "response-request-familiarity-behavior" as const;
export const DIMENSION_ID = "relationship_core_interaction_familiarity_v0" as const;

/**
 * The frozen cognition-influence boundary is k >= 2 → COUNTERPART_CONTEXT_SEARCH_FIRST
 * (1/32 → BASIC_CONTEXT_FIRST). 1/32 vs 2/32 is therefore the MINIMAL lawful
 * crossing of the ONLY influence boundary; larger HIGH values would not change
 * the influence surface and would add no semantic distance.
 */
export const LOW = { label: "LOW", credits: 1, value: 1 / 32, strategy: "BASIC_CONTEXT_FIRST" } as const;
export const HIGH = { label: "HIGH", credits: 2, value: 2 / 32, strategy: "COUNTERPART_CONTEXT_SEARCH_FIRST" } as const;

export interface ScenarioV0 {
  readonly scenario_id: string;
  /** `context.scene` — the current event, identical in both arms. */
  readonly current_event: string;
  /** `context.task` — identical in both arms. */
  readonly task: string;
  /** The shared evidence available in both arms. */
  readonly shared_evidence: string;
  /** Expected familiarity-sensitive decision axis (lawful, from the frozen influence). */
  readonly decision_axis: string;
  /** Interpretations this scenario must NOT be used to test. */
  readonly forbidden_interpretations: readonly string[];
}

export const SCENARIOS: readonly ScenarioV0[] = Object.freeze([
  {
    scenario_id: "S1",
    current_event: 'Alice says: "Can you help me revise that update in the usual way?"',
    task: "respond to Alice's request",
    shared_evidence: "Alice's established status-update convention (concise, factual, no unnecessary apology)",
    decision_axis: "whether the response applies the already-supplied counterpart convention or asks broadly what 'the usual way' means",
    forbidden_interpretations: ["trust", "liking", "affection", "warmth", "obedience"]
  },
  {
    scenario_id: "S2",
    current_event: 'Alice says: "Please redo the status note the way we normally do."',
    task: "respond to Alice's request",
    shared_evidence: "Alice's established status-update convention (concise, factual, no unnecessary apology)",
    decision_axis: "whether the response applies the already-supplied counterpart convention or asks broadly what 'normally' means",
    forbidden_interpretations: ["trust", "liking", "affection", "warmth", "obedience"]
  },
  {
    scenario_id: "S3",
    current_event: 'Alice says: "Update it as usual."',
    task: "respond to Alice's request",
    shared_evidence: "Alice's established status-update convention (concise, factual, no unnecessary apology)",
    decision_axis: "whether the response applies the already-supplied counterpart convention or asks broadly what 'as usual' means",
    forbidden_interpretations: ["trust", "liking", "affection", "warmth", "obedience"]
  },
  {
    scenario_id: "S4",
    current_event: 'Alice says: "Rework that summary in our standard style."',
    task: "respond to Alice's request",
    shared_evidence: "Alice's established status-update convention (concise, factual, no unnecessary apology)",
    decision_axis: "whether the response applies the already-supplied counterpart convention or asks broadly what 'standard style' means",
    forbidden_interpretations: ["trust", "liking", "affection", "warmth", "obedience"]
  }
] as const);

/** Exact shared convention episode payload (identical bytes in both arms). */
export const CONVENTION_SCENE =
  "Alice asked for the status update in her usual way; the subject learned Alice's convention: concise, factual, no unnecessary apology.";

/** 4 scenarios x 2 counterbalanced repetitions = 8 paired trials = 16 arm executions. */
export const REPETITIONS = 2 as const;
/** Frozen counterbalanced order: repetition 1 AB, repetition 2 BA (per scenario). */
export const PAIR_ORDER = Object.freeze(["LOW_FIRST", "HIGH_FIRST"] as const);

export interface PairPlanV0 {
  readonly pair_id: string;
  readonly scenario_id: string;
  readonly repetition: number;
  readonly order: "LOW_FIRST" | "HIGH_FIRST";
}

/** Frozen pair schedule: scenario-major, repetition alternates AB/BA. */
export const PAIRS: readonly PairPlanV0[] = Object.freeze(
  SCENARIOS.flatMap((scenario, scenarioIndex) =>
    Array.from({ length: REPETITIONS }, (_, repIndex) => ({
      pair_id: `${scenario.scenario_id}-r${repIndex + 1}`,
      scenario_id: scenario.scenario_id,
      repetition: repIndex + 1,
      order: PAIR_ORDER[(scenarioIndex + repIndex) % 2] as "LOW_FIRST" | "HIGH_FIRST"
    }))
  )
);

/** Frozen primary rubric classes, derived ONLY from the current influence contract. */
export const RUBRIC_CLASSES = Object.freeze([
  "COUNTERPART_CONTEXT_USED",
  "BASIC_CONTEXT_USED",
  "CLARIFICATION_REQUESTED",
  "UNSUPPORTED_CONTEXT_ASSUMPTION",
  "NO_CLEAR_DIFFERENCE"
] as const);
export type RubricClassV0 = (typeof RUBRIC_CLASSES)[number];

export const RUBRIC_EVALUATOR_PROMPT = [
  "You are a blinded semantic rubric evaluator, version familiarity-behavior-rubric-v0.",
  "You receive ONE short current request and TWO candidate responses X and Y (order is arbitrary).",
  "Classify EACH response into exactly one class:",
  ...RUBRIC_CLASSES.map((c) => `  - ${c}`),
  "Definitions:",
  "COUNTERPART_CONTEXT_USED: the response applies the already-supplied counterpart convention (concise, factual, no unnecessary apology) as an established convention.",
  "BASIC_CONTEXT_USED: the response proceeds from the currently supplied generic request/context without claiming or applying a counterpart-specific convention.",
  "CLARIFICATION_REQUESTED: the response asks what 'usual'/'normal'/'standard' means or otherwise requests the missing convention rather than proceeding.",
  "UNSUPPORTED_CONTEXT_ASSUMPTION: the response asserts shared/historical knowledge or a convention that the supplied evidence does not support.",
  "NO_CLEAR_DIFFERENCE: the response cannot be placed in any class above.",
  "Then answer which response, if either, shows MORE counterpart-context use than the other.",
  "Respond with EXACTLY one JSON object and nothing else:",
  '{"schema_version":"familiarity-behavior-evaluation-v0","x_class":"<class>","y_class":"<class>","more_counterpart_context_use":"X"|"Y"|"NEITHER"|"BOTH","rationale":"<compact>"}'
].join("\n");

export const MODEL = {
  provider: "ollama" as const,
  base_url: "http://127.0.0.1:11434",
  name: "qwen3.5:9b",
  digest: "6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7",
  temperature: 0,
  think: false,
  stream: false,
  num_predict: 2048,
  timeout_ms: 120000,
  seed: null as number | null
} as const;

/** Pre-registered success threshold (never changed after calls). */
export const THRESHOLD = {
  complete_run: true,
  min_familiarity_consistent_pairs: 6,
  max_reverse_pairs: 0
} as const;

export function scenarioById(id: string): ScenarioV0 {
  const found = SCENARIOS.find((scenario) => scenario.scenario_id === id);
  if (found === undefined) throw new Error(`unknown scenario ${id}`);
  return found;
}
