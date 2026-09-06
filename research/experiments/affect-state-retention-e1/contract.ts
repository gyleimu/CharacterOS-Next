/**
 * STATE_RETENTION_AND_RECOVERY_E1 — frozen protocol constants (manifest §42).
 *
 * RESEARCH EXPERIMENT — every constant in this file is frozen BEFORE any
 * result is observed. E1 is a deterministic, zero-LLM, zero-randomness
 * Emotion Dynamics research experiment. It does NOT modify production Affect
 * semantics: production SubjectState/FAST_EMA/Mood/Observation/canonical
 * Appraisal/Affect event authority stay frozen at the baseline commit.
 *
 * Claim boundary (§2): this experiment tests ONE mechanism — event-time STATE
 * RETENTION vs EVENT RESET — under bounded, deterministic, recoverable,
 * time-consistent, exactly-once dynamics. It makes NO claim about
 * psychological realism, human emotion accuracy, LLM behavior quality,
 * Personality, Relationship, Belief, Mood necessity, attractors, learned
 * parameters, production migration, or a canonical Affect writer.
 */

export const EXPERIMENT_ID = "STATE_RETENTION_AND_RECOVERY_E1" as const;
export const BASELINE_COMMIT = "d96803997803ab94caeb3e841dd39d926ad6473b" as const;
export const EXPERIMENT_PATH = "research/experiments/affect-state-retention-e1" as const;
export const TEST_PATH = "evals/conformance/affect-state-retention-e1.test.ts" as const;

// ----------------------------------------------------------------------------------
// §7 state representation (EXPERIMENTAL — never a production schema)
// ----------------------------------------------------------------------------------

export interface AffectStateE1 {
  /** §7 valence, legal range [-1, 1]. */
  readonly valence: number;
  /** §7 activation, legal range [0, 1]. */
  readonly activation: number;
}

// ----------------------------------------------------------------------------------
// §8/§9/§13 frozen engineering parameters
// ----------------------------------------------------------------------------------

/** §8 engineering test baseline b = (0, 0.2) — not a human-neutral claim. */
export const BASELINE_STATE: AffectStateE1 = Object.freeze({ valence: 0, activation: 0.2 });
/** §9 recovery time constant tau = 150 ticks (engineering parameter only). */
export const TAU = 150;
/** §13 legal state bounds (deterministic clamp after event application). */
export const VALENCE_BOUNDS: readonly [number, number] = Object.freeze([-1, 1]) as readonly [number, number];
export const ACTIVATION_BOUNDS: readonly [number, number] = Object.freeze([0, 1]) as readonly [number, number];

// ----------------------------------------------------------------------------------
// §11 frozen candidate impulse mapping (never tuned after viewing results)
// ----------------------------------------------------------------------------------

export const VALENCE_GAIN = 0.25;
export const ACTIVATION_GAIN = 0.2;

// ----------------------------------------------------------------------------------
// §33/§35 frozen numeric protocol
// ----------------------------------------------------------------------------------

/** §33 primary trajectory sample resolution (ticks). */
export const SAMPLE_TICK = 1;
/** §33/§36 G3 partition-equivalence tolerance (absolute). */
export const PARTITION_TOLERANCE = 1e-12;
/** §35 settling tolerance, frozen before any run: distance-to-baseline <= 1e-3. */
export const SETTLING_TOLERANCE = 1e-3;
/** Saturation/bound detection epsilon. */
export const SATURATION_EPSILON = 1e-12;
/** §22-§28 post-event observation horizon after the last event (ticks). */
export const RECOVERY_HORIZON_TICKS = 1200;
/** §29 impulse sensitivity scales for unsaturated S2/S3/S5 (never used for tuning). */
export const SENSITIVITY_SCALES: readonly number[] = Object.freeze([0.5, 2]);
/** §30 restore branch point for S5. */
export const RESTORE_TIME_S5 = 30;
/** Monotonicity slack for FP-level equality in G2 (below partition tolerance). */
export const MONOTONIC_SLACK = 1e-15;

// ----------------------------------------------------------------------------------
// §14-§18 mechanism definitions
// ----------------------------------------------------------------------------------

export type MechanismId = "B0" | "B1" | "B2" | "B3_RESET" | "B3";

export const MECHANISM_IDS: readonly MechanismId[] = Object.freeze([
  "B0", "B1", "B2", "B3_RESET", "B3"
]);

/**
 * §14-§18 exact mechanism semantics. Only event-state retention differs
 * between B3 and B3_RESET (§38): identical state representation, impulse
 * mapping, baseline, recovery equation, bounds, timing and parameters.
 *
 * - B0: state = baseline always; events do nothing (no-state baseline).
 * - B1: x_after = clamp(b + u) at every event. TIMING SEMANTICS (§15): B1 is
 *   the GPT-6-design direct-mapping control. Its event application overwrites
 *   the state from baseline + impulse and is independent of the pre-event
 *   state by construction; between events the recorded trajectory recovers
 *   exponentially from the last post-event value. B1 is contextual only — it
 *   is NEVER used to infer the state-retention effect (the primary causal
 *   comparator is B3_RESET).
 * - B2: the existing production FAST_EMA_V0 reference implementation, run
 *   FROZEN (equations untouched) in its NATIVE representation
 *   (anger/fear/sadness/joy channel intensities + mood baseline).
 *   Contextual comparison only; no cross-representation numeric inference.
 * - B3_RESET (primary control): x_after = clamp(b + u) at every event — the
 *   pre-event offset is discarded; between events the same exponential
 *   recovery as B3.
 * - B3 (candidate): x_after = clamp(x_before + u) where x_before is the
 *   already-recovered current state at event time; between events the same
 *   exponential recovery. The ONLY intentional difference from B3_RESET.
 */
export const MECHANISM_DEFINITIONS: Readonly<Record<MechanismId, string>> = Object.freeze({
  B0: "state = baseline always; events apply no impulse.",
  B1: "event: x_after = clamp(b + u) (direct mapping control; pre-event state never read). inter-event: exponential recovery for trajectory recording only. NOT the causal comparator.",
  B2: "frozen production FAST_EMA_V0 reference producer, native representation (4 channel intensities + mood baseline). Contextual baseline only.",
  B3_RESET: "event: x_after = clamp(b + u) (discard pre-event offset). inter-event: x(t+dt) = b + (x-b)*exp(-dt/tau). PRIMARY CONTROL.",
  B3: "event: x_after = clamp(x_before + u) (retain recovered pre-event state). inter-event: x(t+dt) = b + (x-b)*exp(-dt/tau). CANDIDATE."
});

// ----------------------------------------------------------------------------------
// §10/§21 deterministic appraisal fixtures (synthetic, structured; no LLM)
// ----------------------------------------------------------------------------------

/** Categorical attribution is carried for contract shape parity; §11 never reads it. */
export type E1Attribution = "self" | "other" | "situation";

export interface AppraisalFixtureE1 {
  readonly relevance: number;
  readonly goal_congruence: number;
  readonly attribution: E1Attribution;
  readonly controllability: number;
  readonly uncertainty: number;
  readonly intensity: number;
}

/** §21 N(q): negative-direction event of strength q. */
export function N(q: number): AppraisalFixtureE1 {
  return Object.freeze({
    relevance: 1, intensity: q, goal_congruence: 0,
    controllability: 0.25, uncertainty: 0.25, attribution: "other"
  });
}
/** §21 P(q): positive-direction event of strength q. */
export function P(q: number): AppraisalFixtureE1 {
  return Object.freeze({
    relevance: 1, intensity: q, goal_congruence: 1,
    controllability: 0.25, uncertainty: 0.25, attribution: "other"
  });
}
/** §21 Z: zero-relevance event (valid remaining fields, no impulse). */
export function Z(): AppraisalFixtureE1 {
  return Object.freeze({
    relevance: 0, intensity: 0.5, goal_congruence: 0,
    controllability: 0.25, uncertainty: 0.25, attribution: "other"
  });
}

// §27 zero-impulse application law (frozen before the evidence run): an
// appraisal with q = 0 (zero relevance) produces exactly zero impulse and
// triggers NO event application in ANY mechanism — it is recorded and is
// state-neutral. This is the protocol's own stated expectation for S6/§27 and
// hard gate G4 ("Z must ... not alter trajectory relative to the matched
// control"): under a reset mechanism, treating a zero-impulse appraisal as an
// event would overwrite the state with baseline and violate §27/G4. Only
// events WITH an impulse trigger the retain-vs-reset application.
export const ZERO_IMPULSE_APPLICATION_LAW = Object.freeze(
  "q === 0 (zero relevance) => impulse exactly 0 and NO state application in any mechanism (recorded, state-neutral; §27/G4)."
);

// ----------------------------------------------------------------------------------
// §22-§28 frozen event sequences
// ----------------------------------------------------------------------------------

export interface ScheduledEventE1 {
  readonly event_id: string;
  readonly time: number;
  readonly appraisal: AppraisalFixtureE1;
}

export interface SequenceE1 {
  readonly id: string;
  readonly purpose: string;
  readonly events: readonly ScheduledEventE1[];
  /** The sequence whose trajectory is the matched control, when applicable. */
  readonly control_of: string | null;
}

function sequence(id: string, purpose: string, events: readonly ScheduledEventE1[], controlOf: string | null): SequenceE1 {
  return Object.freeze({ id, purpose, events, control_of: controlOf });
}

function at(id: string, time: number, appraisal: AppraisalFixtureE1): ScheduledEventE1 {
  return Object.freeze({ event_id: id, time, appraisal });
}

/** §22 S1 — single impulse, then no further events. */
export const S1: SequenceE1 = sequence("S1", "single impulse: peak, recovery, half-life, boundedness",
  [at("S1#0", 0, N(0.8))], null);

/** §23 S2 — weak same-direction second event; matched control without it. */
export const S2: SequenceE1 = sequence("S2", "weak same-direction event after a strong one",
  [at("S2#0", 0, N(0.8)), at("S2#1", 10, N(0.2))], null);
export const S2_CONTROL: SequenceE1 = sequence("S2_CONTROL", "matched control for S2: strong event only",
  [at("S2_CONTROL#0", 0, N(0.8))], "S2");

/** §24 S3 — repeated small events; matched single-event control. */
export const S3: SequenceE1 = sequence("S3", "repeated small events (accumulation test)",
  [0, 10, 20, 30, 40].map((t) => at(`S3#${t / 10}`, t, N(0.2))), null);
export const S3_CONTROL: SequenceE1 = sequence("S3_CONTROL", "matched control for S3: one small event at t=40",
  [at("S3_CONTROL#0", 40, N(0.2))], "S3");

/** §25 S4 — alternating events every 10 ticks from t=0 to t=90. */
export const S4: SequenceE1 = sequence("S4", "alternating negative/positive events (carryover, cancellation, ordering)",
  Array.from({ length: 10 }, (_, i) =>
    at(`S4#${i}`, i * 10, i % 2 === 0 ? N(0.4) : P(0.4))), null);

/** §26 S5 — history divergence; the t=60 event is byte-identical in both histories. */
export const S5_A: SequenceE1 = sequence("S5_A", "history divergence, negative prior history",
  [at("S5_A#0", 0, N(0.2)), at("S5_A#1", 20, N(0.2)), at("S5_A#2", 40, N(0.2)), at("S5_A#3", 60, N(0.2))], null);
export const S5_B: SequenceE1 = sequence("S5_B", "history divergence, positive prior history",
  [at("S5_B#0", 0, P(0.2)), at("S5_B#1", 20, P(0.2)), at("S5_B#2", 40, P(0.2)), at("S5_B#3", 60, N(0.2))], null);

/** §27 S6 — zero-relevance event after the S1 disturbance; control is S1. */
export const S6: SequenceE1 = sequence("S6", "zero relevance produces no impulse and no trajectory change",
  [at("S6#0", 0, N(0.8)), at("S6#1", 10, Z())], "S1");

/** §28 S7 — sustained maximum input t=0..199, then 1200 recovery ticks. */
export const S7: SequenceE1 = sequence("S7", "sustained maximum input: saturation, boundedness, boundary exit",
  Array.from({ length: 200 }, (_, i) => at(`S7#${i}`, i, N(1))), null);

/** All primary sequences in execution order. */
export const SEQUENCES: readonly SequenceE1[] = Object.freeze([
  S1, S2, S2_CONTROL, S3, S3_CONTROL, S4, S5_A, S5_B, S6, S7
]);

// ----------------------------------------------------------------------------------
// §31/§32 application identity law (experiment-local, exactly-once)
// ----------------------------------------------------------------------------------

export const APPLICATION_IDENTITY_RULES = Object.freeze({
  fields_per_event: ["event_id", "payload_hash", "timestamp"],
  replay: "same event_id + same payload_hash -> REPLAY: no second impulse, trajectory unchanged",
  conflict: "same event_id + changed payload_hash -> CONFLICT: application refused, recorded",
  distinct: "different event_ids + same payload -> two distinct events, two impulses",
  implementation: "experiment-local deterministic registry; production Affect authority is NOT reused and NOT modified"
});

// ----------------------------------------------------------------------------------
// §34 metrics protocol (fixed deterministic rules)
// ----------------------------------------------------------------------------------

export const METRICS_PROTOCOL = Object.freeze({
  integration_rule: "trapezoidal on 1-tick samples (primary tick-partition run)",
  peak_response: "maximum and minimum value per axis over sampled time",
  absolute_peak_offset: "max(|v - b_v|, per axis separately)",
  signed_valence_auc: "integral of (valence - b_v) over sampled time (b_v = 0)",
  absolute_valence_offset_auc: "integral of |valence - b_v|",
  activation_excess_auc: "integral of max(0, activation - b_a)",
  recovery_half_life: "first sampled tick after the last event where distance-to-baseline <= half the post-event distance (distance = max axis offset); none if post-event distance is 0",
  settling_time: "first tick after the last event where distance-to-baseline <= 1e-3 and stays <= 1e-3 through the end; none if never",
  saturation_fraction: "fraction of sampled ticks at a state bound (|v| >= 1-1e-12 or a <= 1e-12 or a >= 1-1e-12)",
  history_divergence: "S5: |A - B| immediately before the common event, immediately after it, and over recovery",
  partition_error: "max absolute difference across partition strategies at common output timestamps",
  distance_to_baseline: "max(|v - b_v|, |a - b_a|)"
});

// ----------------------------------------------------------------------------------
// §36 primary decision gates
// ----------------------------------------------------------------------------------

export interface GateDefinitionE1 {
  readonly id: string;
  readonly statement: string;
  readonly failure_verdict_effect: string;
}

export const GATES: readonly GateDefinitionE1[] = Object.freeze([
  { id: "G1", statement: "Boundedness: every B3 state finite and inside legal ranges in every run (any NaN/Infinity FAILs).", failure_verdict_effect: "hard fail" },
  { id: "G2", statement: "Recovery: after the last event, distance-to-baseline is non-increasing (<= 1e-15 slack) and at last_event+1200 satisfies dist <= d0*exp(-8) + 1e-12.", failure_verdict_effect: "hard fail" },
  { id: "G3", statement: "Time consistency: B3 common-timestamp outputs under 1-tick / 10-tick / direct partitioning agree within 1e-12.", failure_verdict_effect: "hard fail" },
  { id: "G4", statement: "Zero relevance: Z produces impulse 0 and does not alter the trajectory relative to its matched control within 1e-12.", failure_verdict_effect: "hard fail" },
  { id: "G5", statement: "State retention (unsaturated S2): B3 post-event state equals pre_event + impulse exactly and differs from B3_RESET's clamp(b + u); reset demonstrates overwrite by construction.", failure_verdict_effect: "retention unsupported if equal" },
  { id: "G6", statement: "Repeated accumulation (unsaturated S3): B3 repeated-event state differs from the matched single-event control in the predicted retained-history direction (more negative valence for repeated N).", failure_verdict_effect: "accumulation unsupported" },
  { id: "G7", statement: "History divergence (unsaturated S5): pre-event histories differ; after the byte-identical final event B3 preserves a measurable difference; the difference decays during recovery.", failure_verdict_effect: "path dependence unsupported" },
  { id: "G8", statement: "Saturation recovery (S7): saturation may occur under sustained input; after input stops the state must leave the boundary and recover; no permanent clamp sticking.", failure_verdict_effect: "hard fail" },
  { id: "G9", statement: "Replay: same event_id + same payload produces no second impulse; same event_id + changed payload is a CONFLICT.", failure_verdict_effect: "hard fail" }
]);

// ----------------------------------------------------------------------------------
// §45 verdict classes
// ----------------------------------------------------------------------------------

export type VerdictE1 =
  | "SUPPORTED_FOR_NEXT_STAGE"
  | "MECHANISM_NOT_SUPPORTED"
  | "INVALID_EXPERIMENT"
  | "BLOCKED";

export const VERDICT_RULES = Object.freeze({
  SUPPORTED_FOR_NEXT_STAGE: "G1-G4, G8, G9 (hard stability/integrity gates) all PASS and G5-G7 (retention/accumulation/path-dependence) all PASS.",
  MECHANISM_NOT_SUPPORTED: "Hard gates pass but B3 fails to demonstrate the intended retention/accumulation/path-dependence distinction.",
  INVALID_EXPERIMENT: "A protocol/integrity/runtime defect prevents interpretation.",
  BLOCKED: "The experiment cannot be executed lawfully."
});

// §37: larger AUC/accumulation/difference from B3_RESET alone is NOT success.
// Success is exactly: state retention demonstrated while remaining bounded,
// stable, recoverable, deterministic, time-consistent, and exactly-once.
export const SUCCESS_NARROWING = Object.freeze(
  "Success is ONLY: B3 demonstrates state retention (G5), accumulation (G6) and history divergence (G7) while remaining bounded, stable, recoverable, deterministic, time-consistent (G1-G4, G8) and exactly-once (G9). Larger magnitudes, longer excursions or bigger AUC never count as success by themselves."
);
