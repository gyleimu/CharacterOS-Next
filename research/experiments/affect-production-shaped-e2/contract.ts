/**
 * PRODUCTION_SHAPED_APPRAISAL_DYNAMICS_E2 — frozen protocol constants.
 *
 * RESEARCH EXPERIMENT — deterministic, zero-LLM, zero-randomness. Production
 * is frozen: nothing outside this directory and its conformance test may
 * change. E2 reuses the E1 B3 law EXACTLY (imported from the frozen E1
 * experiment, never reimplemented and never modified).
 *
 * "Production-shaped" claim discipline (§10): the corpus below is an
 * ENGINEERING COVERAGE DISTRIBUTION consistent with current canonical
 * Appraisal contracts. It is NOT an observed, calibrated, representative, or
 * provider-estimated production distribution. No artifact may claim otherwise.
 */

import {
  ACTIVATION_BOUNDS, BASELINE_STATE, PARTITION_TOLERANCE, SATURATION_EPSILON,
  SETTLING_TOLERANCE, TAU, VALENCE_BOUNDS, ACTIVATION_GAIN, VALENCE_GAIN
} from "../affect-state-retention-e1/contract.ts";

// ----------------------------------------------------------------------------------
// Identity (§0/§73)
// ----------------------------------------------------------------------------------

export const EXPERIMENT_ID = "PRODUCTION_SHAPED_APPRAISAL_DYNAMICS_E2" as const;
export const BASELINE_COMMIT = "1925bf465fc3d4e02b94384734a44f96b0568cbd" as const;
export const EXPERIMENT_PATH = "research/experiments/affect-production-shaped-e2" as const;
export const TEST_PATH = "evals/conformance/affect-production-shaped-e2.test.ts" as const;
export const E1_PATH = "research/experiments/affect-state-retention-e1" as const;
export const GENERATOR_DOMAIN = "PRODUCTION_SHAPED_APPRAISAL_DYNAMICS_E2|GENERATOR_V1|" as const;

// ----------------------------------------------------------------------------------
// §3/§4/§5 frozen B3 law — imported from the frozen E1 experiment (single source)
// ----------------------------------------------------------------------------------

export {
  ACTIVATION_BOUNDS, ACTIVATION_GAIN, BASELINE_STATE, PARTITION_TOLERANCE,
  SATURATION_EPSILON, SETTLING_TOLERANCE, TAU, VALENCE_BOUNDS, VALENCE_GAIN
};

// ----------------------------------------------------------------------------------
// §10 production-shaped claim discipline
// ----------------------------------------------------------------------------------

export const PRODUCTION_SHAPED_DISCLAIMER = Object.freeze(
  "This is an engineering coverage distribution consistent with current canonical Appraisal contracts. It is NOT an observed, calibrated, representative, or provider-estimated production distribution."
);

// ----------------------------------------------------------------------------------
// §9 canonical appraisal shape
// ----------------------------------------------------------------------------------

export type E2Attribution = "self" | "other" | "situation";
export const ATTRIBUTIONS: readonly E2Attribution[] = Object.freeze(["self", "other", "situation"]);

/** One synthetic accepted appraisal event (contract-valid shape, §9/§19). */
export interface AppraisalEventE2 {
  readonly tick: number;
  readonly event_id: string;
  readonly relevance: number;
  readonly goal_congruence: number;
  readonly attribution: E2Attribution;
  readonly controllability: number;
  readonly uncertainty: number;
  readonly intensity: number;
  readonly assessment_confidence: number;
}

// ----------------------------------------------------------------------------------
// §11/§12 hash-counter generator (frozen)
// ----------------------------------------------------------------------------------

export const GENERATOR_SPEC = Object.freeze({
  formula: "U(F,S,K) = int(first_13_hex(SHA256(UTF8(GENERATOR_DOMAIN + F + '|' + S + '|' + K)))) / 2^52",
  first_13_hex: 13,
  divisor: 2 ** 52,
  range: "[0,1)",
  stateless: true,
  uniform: "Uniform[a,b) = a + (b-a) * U(F,S,K)",
  trimid: "TriMid[a,b) = a + (b-a) * (U(F,S,K+'|tri:1') + U(F,S,K+'|tri:2')) / 2"
});

// ----------------------------------------------------------------------------------
// §14/§15/§16/§17 amplitude classes, mixtures, goal and field rules
// ----------------------------------------------------------------------------------

export interface AmplitudeClassE1 {
  readonly id: "LOW" | "MID" | "STRONG" | "EDGE";
  readonly relevance: readonly [number, number];
  readonly intensity: readonly [number, number];
}

export const AMPLITUDE_CLASSES: readonly AmplitudeClassE1[] = Object.freeze([
  { id: "LOW", relevance: [0.1, 0.3], intensity: [0.1, 0.3] },
  { id: "MID", relevance: [0.3, 0.7], intensity: [0.3, 0.7] },
  { id: "STRONG", relevance: [0.7, 0.95], intensity: [0.7, 0.95] },
  { id: "EDGE", relevance: [0.95, 1.0], intensity: [0.95, 1.0] }
]);

export type AmplitudeMix = Readonly<Record<"LOW" | "MID" | "STRONG" | "EDGE", number>>;

/** §15 ordinary amplitude mixture. */
export const ORDINARY_AMPLITUDE_MIX: AmplitudeMix = Object.freeze({ LOW: 0.55, MID: 0.35, STRONG: 0.09, EDGE: 0.01 });
/** §20 D1 amplitude mixture. */
export const D1_AMPLITUDE_MIX: AmplitudeMix = Object.freeze({ LOW: 0.8, MID: 0.19, STRONG: 0.01, EDGE: 0 });
/** §26 D7 amplitude mixture. */
export const D7_AMPLITUDE_MIX: AmplitudeMix = Object.freeze({ LOW: 0.4, MID: 0.45, STRONG: 0.14, EDGE: 0.01 });
/** §25 D6 amplitude mixture (no EDGE/STRONG). */
export const D6_AMPLITUDE_MIX: AmplitudeMix = Object.freeze({ LOW: 0.7, MID: 0.3, STRONG: 0, EDGE: 0 });

/** §16 ordinary goal mixture: draw absolute offset delta. */
export const GOAL_DELTA_MIX = Object.freeze([
  { p: 0.5, range: [0, 0.1] as const },
  { p: 0.4, range: [0.1, 0.35] as const },
  { p: 0.1, range: [0.35, 0.5] as const }
]);

/** §17 other-field coverage rules. */
export const FIELD_RULES = Object.freeze({
  attribution: "self/other/situation each 1/3",
  controllability: "TriMid[0,1)",
  uncertainty: "TriMid[0,1)",
  assessment_confidence: "90% TriMid[.50,1.00); 10% Uniform[0,.50)"
});

// ----------------------------------------------------------------------------------
// §18 insufficient context representation
// ----------------------------------------------------------------------------------

export const INSUFFICIENT_CONTEXT_LAW = Object.freeze(
  "INSUFFICIENT_CONTEXT is represented as NO accepted appraisal event at that tick: no dimensions are fabricated and no Affect impulse exists. E2 families contain only accepted appraisals."
);

// ----------------------------------------------------------------------------------
// §20-§27 family definitions
// ----------------------------------------------------------------------------------

/** Tick-range semantics (documented, exact): ticks are integers [0, T-1];
 * a window written [x, y] is the inclusive integer tick set x..min(y, T-1);
 * a window written [x, y) is x..y-1. Quiet windows exclude ticks from
 * eligibility and declare recovery windows for G6. */
export interface QuietWindowE2 {
  readonly start: number;
  readonly end: number; // inclusive tick
}

export interface FamilySpecE2 {
  readonly id: "D1" | "D2" | "D3" | "D4" | "D5" | "D6" | "D7" | "D8";
  readonly T: number;
  readonly event_count: number;
  readonly seed_count: number;
  readonly quiet: readonly QuietWindowE2[];
  readonly description: string;
  readonly balanced: boolean;
}

export const FAMILIES: readonly FamilySpecE2[] = Object.freeze([
  { id: "D1", T: 12000, event_count: 18, seed_count: 32,
    quiet: [{ start: 2500, end: 3099 }, { start: 6500, end: 7699 }, { start: 10800, end: 11999 }],
    description: "quiet: 18 events from 9000 eligible ticks; D1 amplitude mix; balanced ordinary goal pairs",
    balanced: true },
  { id: "D2", T: 12000, event_count: 1080, seed_count: 32,
    quiet: [{ start: 10800, end: 11999 }],
    description: "chatter: 1080 LOW events in [0,10800) at rate .10; fixed 8-goal cycle; complementary entries share q",
    balanced: true },
  { id: "D3", T: 12000, event_count: 192, seed_count: 32,
    quiet: [{ start: 3600, end: 4199 }, { start: 7800, end: 8399 }, { start: 10800, end: 11999 }],
    description: "ordinary: 192 events from 9600 eligible ticks; ordinary amplitude mixture; strictly balanced goal pairs",
    balanced: true },
  { id: "D4", T: 4000, event_count: 60, seed_count: 32,
    quiet: [{ start: 1099, end: 3999 }],
    description: "negative burst: 10 D1-like background events in [0,1000) + 50 burst events every 2 ticks from t=1000; burst goal ~ U[0,.20)",
    balanced: false },
  { id: "D5", T: 4000, event_count: 60, seed_count: 32,
    quiet: [{ start: 1099, end: 3999 }],
    description: "positive burst: exact D4 timing/q with goal_D5 = 1 - goal_D4 (symmetry pair)",
    balanced: false },
  { id: "D6", T: 12000, event_count: 588, seed_count: 32,
    quiet: [{ start: 10567, end: 11999 }],
    description: "alternating: events at 0,18,...,10566; amplitude LOW .70 / MID .30; 7-goal cycle x 84; complementary entries share q",
    balanced: true },
  { id: "D7", T: 12000, event_count: 2700, seed_count: 32,
    quiet: [{ start: 10800, end: 11999 }],
    description: "high density stress: 2700 events in [0,10800) at rate .25; D7 amplitude mixture; strictly balanced goal pairs",
    balanced: true },
  { id: "D8", T: 100000, event_count: 2520, seed_count: 8,
    quiet: [],
    description: "long run: 10 cycles of 10000 ticks; per cycle 4 D1-like + 80 D3-like + 100 D2-like + 50 burst (every 2 ticks) + 18 D1-like; even-cycle bursts negative, odd-cycle bursts mirror with same q; per-cycle quiet [c+8800, c+9999]",
    balanced: true }
]);

/** §28 frozen seeds. */
export const FAMILY_SEEDS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  D1: Object.freeze(Array.from({ length: 32 }, (_, i) => `E2-S${String(i).padStart(2, "0")}`)),
  D2: Object.freeze(Array.from({ length: 32 }, (_, i) => `E2-S${String(i).padStart(2, "0")}`)),
  D3: Object.freeze(Array.from({ length: 32 }, (_, i) => `E2-S${String(i).padStart(2, "0")}`)),
  D4: Object.freeze(Array.from({ length: 32 }, (_, i) => `E2-S${String(i).padStart(2, "0")}`)),
  D5: Object.freeze(Array.from({ length: 32 }, (_, i) => `E2-S${String(i).padStart(2, "0")}`)),
  D6: Object.freeze(Array.from({ length: 32 }, (_, i) => `E2-S${String(i).padStart(2, "0")}`)),
  D7: Object.freeze(Array.from({ length: 32 }, (_, i) => `E2-S${String(i).padStart(2, "0")}`)),
  D8: Object.freeze(Array.from({ length: 8 }, (_, i) => `E2-S${String(i).padStart(2, "0")}`))
});

/** §21/§25 fixed goal cycle (D2 groups of 8; D6 cycles of 7). */
export const D2_GOAL_CYCLE: readonly number[] = Object.freeze([0.4, 0.6, 0.45, 0.55, 0.48, 0.52, 0.5, 0.5]);
export const D6_GOAL_CYCLE: readonly number[] = Object.freeze([0.4, 0.6, 0.45, 0.55, 0.48, 0.52, 0.5]);
/** Paired cycle positions that share q: D2 (0,1),(2,3),(4,5); D6 same pairs. */
export const SHARED_Q_PAIRS: readonly (readonly [number, number])[] = Object.freeze([[0, 1], [2, 3], [4, 5]]);

// ----------------------------------------------------------------------------------
// §30-§34 case fixtures
// ----------------------------------------------------------------------------------

/** §30 C1 — exact production integration-test fixture (task A). */
export const C1_EVENT = Object.freeze({
  relevance: 0.9, goal_congruence: 0.15, attribution: "self" as const,
  controllability: 0.4, uncertainty: 0.3, intensity: 0.7, assessment_confidence: 0.8
});
/** §31 C2 — exact production integration-test fixture (task B). */
export const C2_EVENT = Object.freeze({
  relevance: 0.9, goal_congruence: 0.85, attribution: "other" as const,
  controllability: 0.9, uncertainty: 0.3, intensity: 0.5, assessment_confidence: 0.8
});
/** §32 C3 — neutral ladder. */
export const C3_GOALS: readonly number[] = Object.freeze([0.4, 0.45, 0.48, 0.5, 0.52, 0.55, 0.6]);
export const C3_COMMON = Object.freeze({
  relevance: 0.6, intensity: 0.5, controllability: 0.5, uncertainty: 0.5,
  attribution: "situation" as const, assessment_confidence: 0.8
});
/** §33 C4/C5 — ignored-field invariant (attribution/c/u/confidence ignored by B3). */
export const C4_FIELDS = Object.freeze({ attribution: "self" as const, controllability: 0, uncertainty: 0, assessment_confidence: 0 });
export const C5_FIELDS = Object.freeze({ attribution: "other" as const, controllability: 1, uncertainty: 1, assessment_confidence: 1 });
export const C4C5_COMMON = Object.freeze({ relevance: 0.6, goal_congruence: 0.45, intensity: 0.5 });

/** §34 history pairs. Range objects are {min, maxExclusive} per the generator's Uniform[a,b) semantics. */
export const HISTORY_PAIRS = Object.freeze({
  count: 16,
  shared_event_times_fixed: Object.freeze([1220, 1260, 1300, 1340, 1380, 1420, 1460, 1490]),
  hash_selected_ticks: 32,
  hash_tick_range: Object.freeze({ min: 0, maxExclusive: 1200 }),
  relevance_intensity: Object.freeze({ min: 0.35, maxExclusive: 0.65 }),
  delta: Object.freeze({ min: 0.15, maxExclusive: 0.30 }),
  common_final_event: Object.freeze({
    tick: 1500,
    relevance: 0.6, goal_congruence: 0.4, intensity: 0.5,
    attribution: "situation" as const, controllability: 0.5, uncertainty: 0.5,
    assessment_confidence: 0.8
  }),
  end_tick: 2700,
  mechanisms: Object.freeze(["B3_RESET", "B3"]),
  checkpoints: Object.freeze([2100, 2700])
});

// ----------------------------------------------------------------------------------
// §35/§36/§37 probes
// ----------------------------------------------------------------------------------

export const PARTITION_PROBE_FAMILIES: readonly string[] = Object.freeze(["D2", "D3", "D7", "D8"]);
export const PARTITION_PROBE_SEED = "E2-S00";
export const PARTITION_PROBE_MECHANISM = "B3" as const;

export const RESTORE_PROBES = Object.freeze([
  { family: "D2", seed: "E2-S00", time: 6000, mechanism: "B3" },
  { family: "D2", seed: "E2-S00", time: 6000, mechanism: "B3_RESET" },
  { family: "D7", seed: "E2-S00", time: 6000, mechanism: "B3" },
  { family: "D7", seed: "E2-S00", time: 6000, mechanism: "B3_RESET" },
  { family: "D8", seed: "E2-S00", time: 50000, mechanism: "B3" },
  { family: "D8", seed: "E2-S00", time: 50000, mechanism: "B3_RESET" }
]);

export const REPLAY_PROBE_MECHANISMS: readonly string[] = Object.freeze(["B0", "B2", "B3_RESET", "B3"]);

// ----------------------------------------------------------------------------------
// §38 run accounting
// ----------------------------------------------------------------------------------

export const RUN_ACCOUNTING = Object.freeze({
  primary_corpus_lifetimes: 232,
  primary_mechanisms: ["B0", "B2", "B3_RESET", "B3"],
  primary_corpus_runs: 928,
  c_cases: 5,
  c_runs: 20,
  history_pair_runs: 64,
  partition_probe_runs: 8,
  restore_probe_runs: 6,
  replay_probe_runs: 4,
  total: 1030,
  completeness_tolerance: "exact equality required (§38)",
  counting_law: "replay/restore/partition sub-steps are probe internals, not separate probe executions; 928 + 20 + 64 + 8 + 6 + 4 = 1030"
});

// ----------------------------------------------------------------------------------
// §39-§53 metric protocol
// ----------------------------------------------------------------------------------

export const METRIC_PROTOCOL = Object.freeze({
  base_distance: "d_t = max(|v_t|, |a_t - .2|)",
  epsilon: 1e-12,
  quantile: "nearest-rank Qp(z) = sorted(z)[ceil(p*n)-1], no interpolation",
  bound_occupancy: "O_v- = mean(v <= -1+eps); O_v+ = mean(v >= 1-eps); O_a- = mean(a <= eps); O_a+ = mean(a >= 1-eps)",
  near_bound_occupancy: "N_v = mean(|v| >= .9); N_a+ = mean(a >= .9); N_a- = mean(a <= .1)",
  baseline_metrics: "Q50/Q90/Q99(d_t); B_.05 = mean(d_t <= .05)",
  event_sensitivity: "J_i = max(|v_post - v_pre|, |a_post - a_pre|) per event; q buckets [0,.01) [.01,.04) [.04,.16) [.16,.36) [.36,1]; per bucket count/medianJ/p90J/clampFraction/J<.005 fraction/J>=.02 fraction",
  gain_checks: "unsaturated: Delta_a/q ~ .20 and Delta_v/(q*(2g-1)) ~ .25; max error recorded, never used for tuning",
  strong_debt: "mean(a >= .4 AND ticks_since_latest_event_with_q>=.25 >= 300); ticks_since = t - t_latest_strong with t_latest_strong = -1 when none exists (so ticks_since = t+1); an event AT t is 0 ticks ago",
  quiet_debt: "mean(a - .2 > .02 + 1e-12 AND no event in previous 600 ticks); previous-600 window is (t-600, t] inclusive of t",
  valence_drift: "mu_v = sum(v_t)/(T+1) over sampled ticks [0,T]",
  saturation_episodes: "exact-bound predicate (any of the four §41 bounds); maximal contiguous intervals; count, max duration, p95 duration nearest-rank",
  state_change_sparsity: "per q bucket: fractions of J < .005, .005 <= J < .02, J >= .02",
  recovery_window: "for each declared quiet window [s,e]: expected_v(t) = v_s*exp(-(t-s)/150), expected_a(t) = .2 + (a_s-.2)*exp(-(t-s)/150); max axis error, monotonicity violations (d_(t+1) <= d_t + 1e-15), d_e/d_s when d_s nonzero",
  activation_reconstruction: "after the latest activation-clamp anchor s (or 0 if never clamped): a_t-.2 = (a_s-.2)*exp(-(t-s)/150) + .20*sum(q_i*exp(-(t-t_i)/150)) while no further clamping occurs; reconstruction max error recorded",
  path_dependence: "D_pre/D_post = norm_inf of A-vs-B state difference at the common final event (pre/post); also recorded at t=2100 and t=2700",
  b2_native: "channel intensity bound/near-bound occupancy, replacement/upsert counts, routed emotion counts, ACTIVE/RELEASING phase occupancy, quiet recovery, mood occupancy at .25 and .225; no VA translation; no B3-vs-B2 winner"
});

export const Q_BUCKETS: readonly (readonly [number, number])[] = Object.freeze([
  [0, 0.01], [0.01, 0.04], [0.04, 0.16], [0.16, 0.36], [0.36, 1]
]);

// ----------------------------------------------------------------------------------
// §54-§67 decision gates
// ----------------------------------------------------------------------------------

export interface GateSpecE2 {
  readonly id: string;
  readonly statement: string;
  readonly classification: "PROTOCOL" | "CORE" | "ACTIVATION_MAPPING_RISK" | "RELEVANCE_INTENSITY_MAPPING_RISK" | "VALENCE_IMPULSE_MAPPING_RISK" | "RECOVERY_TIMESCALE_RISK" | "CONTEXTUAL";
}

export const GATES: readonly GateSpecE2[] = Object.freeze([
  { id: "G1", statement: "Protocol integrity: frozen manifest binds baseline, source fingerprints, E1 law fingerprint, E1 evidence fingerprint, generator hash, all seeds, corpus Merkle root, formulas, parameters, gates, run count (1030), zero-model flag, production-diff law. All 232 lifetimes and probes validate; any mismatch invalidates the experiment.", classification: "PROTOCOL" },
  { id: "G2", statement: "Finite/bounded: all B3/B3_RESET samples finite, -1 <= v <= 1, 0 <= a <= 1; additionally B3 a >= .2 - 1e-12 so O_a- = 0 and N_a- = 0.", classification: "CORE" },
  { id: "G3", statement: "Time consistency: partition probes (D2-S00/D3-S00/D7-S00/D8-S00, B3, tick1/tick10/direct) max_abs_error <= 1e-12.", classification: "CORE" },
  { id: "G4", statement: "Restore/replay: 6 restore continuations max_abs_error <= 1e-12 with no historical rerun; replay REPLAY delta 0, changed-payload CONFLICT, different-ID APPLIED for all four mechanisms.", classification: "CORE" },
  { id: "G5", statement: "Ignored fields: C4 vs C5 B3 trajectories max_abs_error <= 1e-12 (payload hashes need not match).", classification: "CORE" },
  { id: "G6", statement: "Quiet recovery: every declared quiet window model_error <= 1e-12, d monotone (<= 1e-15 slack), at +600 d <= d_start*exp(-4)+1e-12 and at +1200 d <= d_start*exp(-8)+1e-12 (where the window extends that far), quiet_debt = 0; for D4/D5/D7 if exact-bound at final active input the first recovery tick must leave the exact bound.", classification: "CORE" },
  { id: "G7", statement: "Ordinary saturation: D1, D2, D3 separately Q95_seed(O_v- + O_v+) <= .005, Q95_seed(O_a+) <= .005, Q95_seed(N_v) <= .020, Q95_seed(N_a+) <= .020.", classification: "ACTIVATION_MAPPING_RISK" },
  { id: "G8", statement: "Micro-event accumulation (D2): Q95_seed(Q99_time(activation)) <= .75, Q95_seed(O_a+) <= .001, Q95_seed(strong_debt) <= .05.", classification: "ACTIVATION_MAPPING_RISK" },
  { id: "G9", statement: "Balanced valence drift: machine-checked |sum(q_i*(2g_i-1))| <= 1e-12 for every balanced distribution; outputs: D1/D2/D3/D6 |grand_mean(mu_v)| <= .01 and Q95_seed(|mu_v|) <= .05; D7 <= .02 / <= .10; D8 <= .02 / max_seed <= .05; D4/D5 symmetry |v_D4+v_D5| <= 1e-12 and |a_D4-a_D5| <= 1e-12 at all common checkpoints.", classification: "VALENCE_IMPULSE_MAPPING_RISK" },
  { id: "G10", statement: "Under-response (D3): pooled fraction(J >= .02) >= .25; pooled fraction(J < .005) <= .70; pooled unsaturated MID/STRONG/EDGE fraction(J + 1e-12 >= .02) >= .75; across seeds count(B_.05 > .95) <= 3 of 32.", classification: "RELEVANCE_INTENSITY_MAPPING_RISK" },
  { id: "G11", statement: "History retention: >= 15/16 pairs qualify (unsaturated, D_pre >= .05); every qualified pair: B3 |D_post - D_pre| <= 1e-12, B3_RESET D_post <= 1e-12, B3 at 2100 D <= D_post*exp(-4)+1e-12 and at 2700 D <= D_post*exp(-8)+1e-12. Instantaneous-retention failure is a core mechanism failure; too few qualifying histories is a mapping/coverage risk (distinguished).", classification: "RELEVANCE_INTENSITY_MAPPING_RISK" },
  { id: "G12", statement: "Cancellation activation (D6): Q95_seed(mean(|v| <= .05 AND a >= .6)) <= .05 and Q95_seed(strong_debt) <= .05.", classification: "ACTIVATION_MAPPING_RISK" },
  { id: "G13", statement: "D8 long run: EVERY seed O_v- + O_v+ <= .02, O_a+ <= .02, N_v <= .10, N_a+ <= .10, B_.05 >= .20 (n=8 so p95 = max; enforced per seed).", classification: "ACTIVATION_MAPPING_RISK" },
  { id: "G14", statement: "D7 stress: no saturation ceiling; require finite, bounded, saturation recorded, post-input recovery, and the quiet-recovery gate to pass for D7. B3 is not rejected merely for saturating under D7.", classification: "CONTEXTUAL" }
]);

// ----------------------------------------------------------------------------------
// §68 verdict order
// ----------------------------------------------------------------------------------

export type VerdictE2 =
  | "SUPPORTED_FOR_PRODUCTION_ARCHITECTURE_DESIGN"
  | "SUPPORTED_WITH_IDENTIFIED_MAPPING_RISK"
  | "MECHANISM_NOT_SUPPORTED_UNDER_PRODUCTION_SHAPED_INPUT"
  | "INVALID_EXPERIMENT"
  | "BLOCKED";

export type MappingRiskCode =
  | "ACTIVATION_MAPPING_RISK"
  | "RELEVANCE_INTENSITY_MAPPING_RISK"
  | "VALENCE_IMPULSE_MAPPING_RISK"
  | "RECOVERY_TIMESCALE_RISK";

export const VERDICT_RULES = Object.freeze({
  order: [
    "A. any protocol/integrity failure -> INVALID_EXPERIMENT",
    "B. any core dynamics failure (finite/bounds, partition, restore/replay, recovery law, qualified-history immediate retention) -> MECHANISM_NOT_SUPPORTED_UNDER_PRODUCTION_SHAPED_INPUT",
    "C. core good + distribution gate failures -> SUPPORTED_WITH_IDENTIFIED_MAPPING_RISK with all triggered sub-risk codes",
    "D. all pass -> SUPPORTED_FOR_PRODUCTION_ARCHITECTURE_DESIGN"
  ],
  sub_risk_codes: {
    ACTIVATION_MAPPING_RISK: "G7/G8/G12/G13 activation-side failures",
    RELEVANCE_INTENSITY_MAPPING_RISK: "G10 q/response failures or G11 too-few qualifying histories",
    VALENCE_IMPULSE_MAPPING_RISK: "G9 balanced drift failures",
    RECOVERY_TIMESCALE_RISK: "operational baseline/quiet problem with the exact law still correct"
  }
});

// §69: a mapping-risk verdict is FINAL evidence — no retuning of .25/.20/tau/q/baseline/corpus/gates inside E2.
export const NO_RETUNE_LAW = Object.freeze(
  "If E2 returns SUPPORTED_WITH_IDENTIFIED_MAPPING_RISK, no coefficient, tau, q rule, baseline, corpus or gate may change inside E2. The result is final evidence; follow-up work is E2A only (documented, not run)."
);

// §70: future E2A design (documented only, NOT implemented, NOT run).
export const E2A_DESIGN = Object.freeze({
  trigger_retention_failure: "replay saved impulses with only retain/reset switched",
  trigger_gain_risk: "0.5x / 1x / 2x impulse scale on the failing axis",
  trigger_activation_mapping_risk: "u_a in {0, 0.10q, 0.20q}",
  trigger_q_risk: "q in {r*i, sqrt(r*i), min(r,i)}",
  trigger_tau_risk: "tau in {75, 150, 300}",
  discipline: "same corpus hashes; one factor only; relevant family; first 8 seeds; new manifest; new verdict. NOT implemented or run by E2."
});

// ----------------------------------------------------------------------------------
// §77 performance discipline
// ----------------------------------------------------------------------------------

export const PERFORMANCE_LAW = Object.freeze({
  allowed: ["event-indexed sparse stepping", "streaming metrics", "segmented trajectory artifacts", "avoiding unnecessary per-tick allocation"],
  forbidden: ["reducing seeds", "reducing T", "sampling fewer ticks for tick-level metrics", "changing formulas", "approximating exponentials", "dropping B2 runs", "changing gates"],
  blocked_verdict: "BLOCKED_BY_E2_RESOURCE_LIMIT"
});

export const ZERO_MODEL_LAW = Object.freeze(
  "No OpenAI, Ollama, DeepSeek, Qwen or any evaluator/LLM call exists anywhere in E2. Real model calls: 0."
);
