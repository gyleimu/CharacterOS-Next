/**
 * BELIEF_CAUSAL_CONFIRMATORY_STOCHASTIC_V1 — preregistration contract.
 *
 * This is a NEW confirmatory experiment: not a V0 rerun, not a V0 patch and not a
 * pooled extension. V0's scientific observations contribute ZERO to any
 * confirmatory count (planning-only firewall, enforced in `precheck.ts`).
 *
 * Every statistical constant, the gate set, the retry law, the host-validity law,
 * the manifest law and the report-hash law are IMPORTED from the frozen
 * measurement protocol — nothing is copied and nothing is retuned.
 */
import {
  ANALYSIS_LAW,
  BYTE_LEVEL_FREEZE,
  CONFLATION_LAW,
  DESIGN,
  EXECUTOR_CALIBRATION,
  HOST_VALIDITY,
  POST_PREREG_CALIBRATION,
  PROTOCOL_ID,
  RETRY_LAW as FROZEN_RETRY_LAW,
  SAMPLING
} from "../../measurement-protocols/stochastic-executor-causal-measurement-protocol-v0/contract.ts";

export const EXPERIMENT_ID = "BELIEF_CAUSAL_CONFIRMATORY_STOCHASTIC_V1" as const;
export const FROZEN_PROTOCOL_ID = PROTOCOL_ID;

/** §6 model: fixed executor, fixed configuration, no fallback of any kind. */
export const MODEL = Object.freeze({
  provider: "deepseek-openai-compatible",
  id: "deepseek-flash",
  base_url: "https://api.deepseek.com",
  temperature: 0,
  top_p: null,
  max_tokens: 16384,
  timeout_ms: 240000,
  stream: false,
  response_format: "json_object (the provider's available mapping of the frozen JSON_SCHEMA constraint)",
  fallbacks: [] as readonly string[]
});

export const RETRY_LAW = FROZEN_RETRY_LAW;

/** §4 claim scope: Belief → Cognition ONLY. */
export const CLAIM_SCOPE = Object.freeze({
  allowed: "Belief -> Cognition",
  forbidden: [
    "Belief -> production Decision",
    "Belief -> action execution",
    "Belief -> delivered natural-language behavior",
    "human-like belief",
    "objective truth tracking"
  ]
});

/** §7 target proposition (unchanged from the frozen protocol's planning design). */
export const TARGET_PROPOSITION_LABEL = "The service passage is usable." as const;

/** §9/§10 histories: real formation from a normal empty genesis. */
export const SHARED_FORMATION_EPISODE = Object.freeze({
  ref: "episode:bcv1-shared-1",
  occurrence_logical_time: 2,
  scene:
    "I walked the service passage with the caretaker and we carried two crates through it without any problem.",
  bearing: "SUPPORTS" as const
});

export const LOW_EPISODES: readonly {
  readonly ref: string;
  readonly occurrence_logical_time: number;
  readonly scene: string;
  readonly bearing: "SUPPORTS" | "CONTRADICTS";
}[] = Object.freeze([
  SHARED_FORMATION_EPISODE,
  Object.freeze({
    ref: "episode:bcv1-low-2",
    occurrence_logical_time: 4,
    scene:
      "A note on the service passage door said the service passage is unusable this week because of the renovation.",
    bearing: "CONTRADICTS" as const
  }),
  Object.freeze({
    ref: "episode:bcv1-low-3",
    occurrence_logical_time: 6,
    scene:
      "The building manager told me the service passage is closed and not usable for residents until further notice.",
    bearing: "CONTRADICTS" as const
  })
]);

export const HIGH_EPISODES: readonly {
  readonly ref: string;
  readonly occurrence_logical_time: number;
  readonly scene: string;
  readonly bearing: "SUPPORTS" | "CONTRADICTS";
}[] = Object.freeze([
  SHARED_FORMATION_EPISODE,
  Object.freeze({
    ref: "episode:bcv1-high-2",
    occurrence_logical_time: 4,
    scene: "I used the service passage again this morning and the service passage was usable as usual.",
    bearing: "SUPPORTS" as const
  }),
  Object.freeze({
    ref: "episode:bcv1-high-3",
    occurrence_logical_time: 6,
    scene: "The caretaker confirmed the service passage is usable and helped me carry a box through it.",
    bearing: "SUPPORTS" as const
  })
]);

export const EXPECTED_LOW_PROGRESSION: readonly number[] = Object.freeze([0.55, 0.5, 0.45]);
export const EXPECTED_HIGH_PROGRESSION: readonly number[] = Object.freeze([0.55, 0.6000000000000001, 0.6500000000000001]);

/** §14 the frozen current scenario (byte-frozen at the preregistration commit). */
export const CURRENT_SCENE = Object.freeze({
  text:
    "We need to move the archive boxes out of the basement tonight before the inspection, and the lift is out of service. Should I take them up through the service passage?",
  source_event_id: "source-event-bcv1-current-scene-1",
  conversation_id: "conv-belief-causal-confirmatory",
  observed_utterance_prefix: 'The user says: "',
  task: "Respond to the user's latest message."
});

/** §27 the frozen calibration input: representative, byte-stable, outside A/B/C/D counts. */
export const CALIBRATION_INPUT = Object.freeze({
  namespace: "CALIBRATION",
  subject: "calibration-subject",
  description:
    "A byte-identical cognition-only scene over a frozen calibration subject whose belief state is the normal empty genesis, using the SAME current-scene text and the SAME system prompt as the confirmatory scenes so the calibration exercises the real schema surface without belonging to any cell.",
  cell_labels_absent: true,
  belongs_to_confirmatory_counts: false
});

/** §24 sample size — imported, never recomputed. */
export const SAMPLE_SIZE = Object.freeze({
  n_per_cell_per_phase: SAMPLING.n_per_cell_primary,
  primary_cognition_calls: SAMPLING.n_per_cell_primary * 4,
  replication_cognition_calls: SAMPLING.n_per_cell_primary * 4,
  calibration_draws: SAMPLING.calibration_draws,
  potential_total_after_authorization: SAMPLING.n_per_cell_primary * 4 * 2 + SAMPLING.calibration_draws
});

/** §12 four cells. */
export const CELL_IDS = [
  "A_LOW",
  "B_HIGH",
  "C_HIGH_ABLATED",
  "D_LOW_EQUALIZED"
] as const;
export type CellId = (typeof CELL_IDS)[number];

export const CELL_DEFINITION: Readonly<
  Record<CellId, { readonly durable: "LOW" | "HIGH"; readonly intervention: "NONE" | "ABLATE_TARGET" | "EQUALIZE_TARGET_TO_HIGH" }>
> = Object.freeze({
  A_LOW: { durable: "LOW", intervention: "NONE" },
  B_HIGH: { durable: "HIGH", intervention: "NONE" },
  C_HIGH_ABLATED: { durable: "HIGH", intervention: "ABLATE_TARGET" },
  D_LOW_EQUALIZED: { durable: "LOW", intervention: "EQUALIZE_TARGET_TO_HIGH" }
});

/** §50 host-side cell labels are allowed; model-facing labels are forbidden. */
export const FORBIDDEN_MODEL_FACING_LABELS: readonly string[] = Object.freeze([
  "A_LOW",
  "B_HIGH",
  "C_HIGH_ABLATED",
  "D_LOW_EQUALIZED",
  "A_LOW_BELIEF",
  "B_HIGH_BELIEF",
  "treatment",
  "control group",
  "control",
  "experiment hypothesis",
  "intervention",
  "calibration",
  "replicate",
  "phase"
]);

/** §33 trial identities: primary 1–200, replication 201–400, calibration separate. */
export const PHASES = ["PRIMARY", "REPLICATION"] as const;
export type Phase = (typeof PHASES)[number];

export interface TrialIdentity {
  readonly experiment_id: string;
  readonly phase: Phase;
  readonly cell: CellId;
  readonly replicate: number;
  readonly trial_id: string;
}

export function trialIdentity(phase: Phase, cell: CellId, replicate: number): TrialIdentity {
  return {
    experiment_id: EXPERIMENT_ID,
    phase,
    cell,
    replicate,
    trial_id: `${EXPERIMENT_ID}|${phase}|${cell}|${String(replicate).padStart(3, "0")}`
  };
}

export function replicateRange(phase: Phase): { readonly start: number; readonly end: number } {
  return phase === "PRIMARY"
    ? { start: 1, end: SAMPLE_SIZE.n_per_cell_per_phase }
    : { start: SAMPLE_SIZE.n_per_cell_per_phase + 1, end: SAMPLE_SIZE.n_per_cell_per_phase * 2 };
}

/** §49 the deterministic balanced schedule: A B C D per replicate, cells rotated deterministically. */
export function trialSchedule(phase: Phase): readonly TrialIdentity[] {
  const { start, end } = replicateRange(phase);
  const schedule: TrialIdentity[] = [];
  let rotation = 0;
  for (let replicate = start; replicate <= end; replicate += 1) {
    const ordered = CELL_IDS.slice(rotation).concat(CELL_IDS.slice(0, rotation));
    for (const cell of ordered) schedule.push(trialIdentity(phase, cell, replicate));
    rotation = (rotation + 1) % CELL_IDS.length;
  }
  return schedule;
}

/** §38 experiment-specific hard gates: every one is an executable evaluator. */
export const HARD_GATE_IDS: readonly string[] = Object.freeze([
  "PREREG_SHA_MATCH",
  "MANIFEST_VALID",
  "SEED_BELIEF_EMPTY",
  "FORMATION_ATTESTATION",
  "RAW_HISTORY_ZERO",
  "MEMORY_RETRIEVAL_ZERO",
  "NON_BELIEF_STATE_EQUAL",
  "A_B_ONLY_BELIEF_DIFFERENCE",
  "B_D_FULL_INPUT_IDENTITY",
  "INTERVENTION_NO_PRODUCTION_WRITE",
  "TRUTH_CONFLATION_ZERO_FLAGS",
  "HOST_VALIDITY",
  "CELL_INVALID_IMBALANCE",
  "CALL_ACCOUNTING",
  "SECRET_SAFETY",
  "PRIMARY_FULL_CONJUNCTION",
  "REPLICATION_FULL_CONJUNCTION"
]);

/** §39/§40 the frozen verdict menu (imported semantics; no new verdicts). */
export const VERDICT_MENU: readonly string[] = Object.freeze([
  "BELIEF_CAUSAL_INFLUENCE_REPLICATED",
  "BELIEF_CAUSAL_INFLUENCE_NOT_REPLICATED",
  "BELIEF_CAUSAL_RESULT_INCONCLUSIVE",
  "EXPERIMENT_INVALID",
  "BELIEF_CAUSAL_HOST_VALIDITY_GATE_FAILED",
  "BELIEF_EFFECT_CONFOUNDED_BY_RAW_HISTORY",
  "BELIEF_EFFECT_CONFOUNDED_BY_MEMORY_RETRIEVAL",
  "BELIEF_EFFECT_CONFOUNDED_BY_NON_BELIEF_STATE",
  "BELIEF_MEDIATOR_EQUALIZATION_FAILED",
  "BELIEF_CAUSAL_TRUTH_CONFLATION_FAILED",
  "BELIEF_CAUSAL_ACCOUNTING_FAILED"
]);

/** §46 V0 firewall: the evaluator may never read V0 outcomes. */
export const V0_FIREWALL = Object.freeze({
  forbidden_reads: [
    "research/experiments/belief-causal-validation-v0/evidence/primary",
    "research/experiments/belief-causal-validation-v0/evidence/replication",
    "research/experiments/belief-causal-validation-v0/evidence/pilot"
  ],
  allowed_use: "PLANNING_ONLY documentation reference",
  confirmatory_count_contribution: 0
});

/** §8 no treatment-development pilot is run in this slice. */
export const TREATMENT_DEVELOPMENT_PILOT_STATUS = Object.freeze({
  status: "NOT_RUN",
  treatment_viability_basis: "V0_PLANNING_ONLY",
  authorized_calls: 0,
  requires_human_authorization: true
});

/** §3/§45 zero-call attestation for this slice. */
export const SLICE_CALL_ATTESTATION = Object.freeze({
  deepseek_calls: 0,
  ollama_calls: 0,
  calibration_calls: 0,
  pilot_calls: 0,
  primary_calls: 0,
  replication_calls: 0,
  total_model_calls: 0
});

export const FROZEN_REFERENCES = Object.freeze({
  analysis_law: ANALYSIS_LAW,
  design: DESIGN,
  host_validity: HOST_VALIDITY,
  conflation_law: CONFLATION_LAW,
  byte_level_freeze: BYTE_LEVEL_FREEZE,
  executor_calibration: EXECUTOR_CALIBRATION,
  post_prereg_calibration: POST_PREREG_CALIBRATION
});

/** The intervention law as a hashable manifest (read-side only, no durable write). */
export function cellInterventionLawManifest(): Readonly<Record<string, unknown>> {
  return Object.freeze({
    C: "ABLATE_TARGET — the target belief item is removed from the research-side model-facing view only",
    D: "EQUALIZE_TARGET_TO_HIGH — the target item is presented with the HIGH credence in the research-side view only",
    production_write: false,
    durable_state_unchanged: "verified per trial by before/after durable belief hashes",
    cells: CELL_DEFINITION
  });
}

export function modelConfigManifest(): Readonly<Record<string, unknown>> {
  return Object.freeze({
    provider: MODEL.provider,
    model: MODEL.id,
    base_url: MODEL.base_url,
    temperature: MODEL.temperature,
    top_p: MODEL.top_p,
    max_tokens: MODEL.max_tokens,
    timeout_ms: MODEL.timeout_ms,
    stream: MODEL.stream,
    response_format: MODEL.response_format,
    retry_policy: RETRY_LAW,
    fallbacks: MODEL.fallbacks
  });
}
