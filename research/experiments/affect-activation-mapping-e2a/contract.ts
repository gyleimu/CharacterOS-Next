/**
 * ACTIVATION_MAPPING_ABLATION_E2A — frozen protocol constants.
 *
 * Deterministic, zero-LLM, zero-randomness follow-up to E2's single identified
 * risk (ACTIVATION_MAPPING_RISK). The ONLY experimental factor is the
 * activation impulse gain u_a ∈ {0, 0.10q, 0.20q}; everything else is the
 * frozen E2/E1 law (baseline (0,.2), tau=150, q=r*i, u_v=.25q(2g−1), B3
 * retention, exponential recovery, [-1,1]×[0,1] bounds) — machine-checked.
 *
 * Prior evidence is FROZEN: E1 SUPPORTED_FOR_NEXT_STAGE; E2
 * SUPPORTED_WITH_IDENTIFIED_MAPPING_RISK (ACTIVATION_MAPPING_RISK). No E1/E2
 * evidence is edited or reinterpreted.
 */

import { ACTIVATION_BOUNDS, BASELINE_STATE, PARTITION_TOLERANCE, SATURATION_EPSILON, SETTLING_TOLERANCE, TAU, VALENCE_BOUNDS } from "../affect-state-retention-e1/contract.ts";

export {
  ACTIVATION_BOUNDS, BASELINE_STATE, PARTITION_TOLERANCE, SATURATION_EPSILON,
  SETTLING_TOLERANCE, TAU, VALENCE_BOUNDS
};

export const EXPERIMENT_ID = "ACTIVATION_MAPPING_ABLATION_E2A" as const;
export const BASELINE_COMMIT = "bf6c2fe761a0ed5eee7e53d4b6697297e0271e1c" as const;
export const EXPERIMENT_PATH = "research/experiments/affect-activation-mapping-e2a" as const;
export const TEST_PATH = "evals/conformance/affect-activation-mapping-e2a.test.ts" as const;
export const E1_PATH = "research/experiments/affect-state-retention-e1" as const;
export const E2_PATH = "research/experiments/affect-production-shaped-e2" as const;

// ----------------------------------------------------------------------------------
// §3/§4 single factor: activation gain — A20 is the exact frozen E2 control
// ----------------------------------------------------------------------------------

export interface VariantE2A {
  readonly id: "A0" | "A10" | "A20";
  /** u_a = activationGain * q. */
  readonly activationGain: number;
  readonly role: string;
}

export const VARIANTS: readonly VariantE2A[] = Object.freeze([
  { id: "A0", activationGain: 0, role: "no event-driven activation (control for responsiveness)" },
  { id: "A10", activationGain: 0.1, role: "candidate reduced gain" },
  { id: "A20", activationGain: 0.2, role: "exact frozen E2 mapping (control); must reproduce the E2 D6 debt pattern" }
]);

/** §4 single-factor law: everything else is byte-identical across variants. */
export const SINGLE_FACTOR_LAW = Object.freeze({
  baseline: "(0, 0.2)",
  tau: 150,
  q: "relevance * intensity",
  u_v: "0.25 * q * (2*goal_congruence - 1)",
  event: "x_after = clamp(x_before + u)",
  recovery: "x(t+dt) = b + (x(t)-b) * exp(-dt/150) per axis",
  bounds: "valence [-1,1], activation [0,1]",
  only_difference: "u_a = activationGain * q",
  forbidden: ["signed activation", "goal-dependent activation", "controllability-dependent activation", "uncertainty-dependent activation", "nonlinear activation", "saturation-dependent gain", "habituation", "refractory periods"]
});

// ----------------------------------------------------------------------------------
// §6/§7/§8/§9 seed subset, families, accounting
// ----------------------------------------------------------------------------------

export const SEED_SUBSET: readonly string[] = Object.freeze(
  Array.from({ length: 8 }, (_, i) => `E2-S${String(i).padStart(2, "0")}`)
);

export const FAMILY_IDS: readonly ("D2" | "D3" | "D6" | "D7")[] = Object.freeze(["D2", "D3", "D6", "D7"]);

export const FAMILY_PURPOSE: Readonly<Record<string, string>> = Object.freeze({
  D2: "chatter: repeated low-q accumulation (debt gate)",
  D3: "ordinary: activation responsiveness safety (responsiveness gate)",
  D6: "alternating: where E2 identified the ACTIVATION_MAPPING_RISK (primary)",
  D7: "high density stress: boundedness/recovery safety"
});

export const RUN_ACCOUNTING = Object.freeze({
  primary_runs: 96, // 4 families x 8 seeds x 3 variants
  partition_probe_runs: 6, // D6-S00 x 3 variants x (tick10 + direct); tick1 is the primary run
  restore_probe_runs: 3, // D6-S00 x 3 variants at the frozen restore tick
  replay_probe_runs: 3, // one REPLAY execution per variant (conflict/different-id/no-event runs are sub-steps)
  total: 108,
  counting_law: "restore counts the continuation run (uninterrupted reference is a sub-step); partition counts tick10+direct (tick1 reuses the primary run); replay counts the REPLAY execution per variant"
});

/** §23 restore tick: frozen BEFORE the run — inside D6's final active stretch,
 * before the declared quiet window [10567,11999]. */
export const RESTORE_TICK_D6 = 9000;

// ----------------------------------------------------------------------------------
// §13-§15 metrics reuse + activation-specific additions
// ----------------------------------------------------------------------------------

export const METRIC_PROTOCOL = Object.freeze({
  reuse: "E2 definitions exactly: O_a+, N_a+, activation quantiles, strong_debt, quiet_debt, saturation episodes, baseline occupancy, event sensitivity J, discounted-load reconstruction, quiet recovery, partition consistency, restore/replay",
  delta_a_event: "Delta_a_event = a_post - a_pre per event",
  observed_gain: "for unsaturated q>0 events: activation_gain_observed = Delta_a_event / q (A0 -> 0, A10 -> .10, A20 -> .20 within tolerance)",
  q_buckets: "[0,.01) [.01,.04) [.04,.16) [.16,.36) [.36,1] (E2 buckets)",
  activation_buckets: "per bucket: count, median Delta_a, p90 Delta_a, fraction Delta_a >= .005, fraction Delta_a >= .01, clamp fraction",
  expected_relation: "Delta_a(A10) ~= 0.5 * Delta_a(A20) and Delta_a(A0) = 0 for unsaturated identical events (implementation integrity check)"
});

// ----------------------------------------------------------------------------------
// §26-§31 pre-registered gates
// ----------------------------------------------------------------------------------

export interface GateSpecE2A {
  readonly id: string;
  readonly statement: string;
  readonly kind: "PROTOCOL" | "DEBT" | "RESPONSIVENESS" | "STRONG_EVENT" | "QUIET" | "CANCELLATION" | "BOUNDS" | "INVARIANT" | "REPRODUCTION";
}

export const GATES: readonly GateSpecE2A[] = Object.freeze([
  { id: "G1", statement: "Protocol integrity: frozen manifest binds E2 protocol hash, E2 corpus root, E2/E1 source fingerprints, sequence hashes, seed subset, variants, gates, accounting (108), zero-model, production isolation. All runs validate.", kind: "PROTOCOL" },
  { id: "G2", statement: "Input identity: for each family+seed the event sequences consumed by A0/A10/A20 are byte-identical (persisted sequence hash equality).", kind: "INVARIANT" },
  { id: "G3", statement: "Bounds/finite: all states finite, 0 <= a <= 1, and a >= .2 - 1e-12 (nonnegative impulses, baseline .2).", kind: "BOUNDS" },
  { id: "G4", statement: "Valence invariance: for every family/seed and common timestamp |v_A0 - v_A10| and |v_A10 - v_A20| <= 1e-12. Violation => INVALID_EXPERIMENT.", kind: "INVARIANT" },
  { id: "G5", statement: "Recovery invariant: during declared event-free windows each variant satisfies a(t) = .2 + (a_s-.2)*exp(-(t-s)/150) within 1e-12; quiet_debt = 0.", kind: "QUIET" },
  { id: "G6", statement: "D6 debt: Q95_seed(strong_debt) <= .05 (the original E2 failure criterion, authoritative).", kind: "DEBT" },
  { id: "G7", statement: "D2 debt: Q95_seed(strong_debt) <= .05 and Q95_seed(Q99_time(activation)) <= .75.", kind: "DEBT" },
  { id: "G8", statement: "D6 cancellation: Q95_seed(mean(|v| <= .05 AND a >= .6)) <= .05.", kind: "CANCELLATION" },
  { id: "G9", statement: "D3 responsiveness: unsaturated MID/STRONG/EDGE events fraction(Delta_a + 1e-12 >= .005) >= .75; pooled all-q>0 ordinary events fraction(Delta_a + 1e-12 >= .002) >= .25. Frozen before the official run; A0 is expected to fail this by construction.", kind: "RESPONSIVENESS" },
  { id: "G10", statement: "Strong event response: D3/D7 unsaturated events with q >= .25 have median Delta_a >= .02 for a variant to qualify as an activation candidate.", kind: "STRONG_EVENT" },
  { id: "G11", statement: "Partition equivalence: D6-S00 all variants tick1/tick10/direct max_abs_error <= 1e-12 on both axes.", kind: "INVARIANT" },
  { id: "G12", statement: "Restore equivalence: D6-S00 all variants restore continuation vs uninterrupted max_abs_error <= 1e-12, no historical replay.", kind: "INVARIANT" },
  { id: "G13", statement: "Replay law: same ID + same payload -> REPLAY delta 0; same ID + changed payload -> CONFLICT; different ID + same payload -> APPLIED (all variants).", kind: "INVARIANT" },
  { id: "G14", statement: "A20 reproduction: at least one A20 D6 seed has strong_debt > .05 (the E2 identified risk must reproduce on the reused subset); the aggregate subset result is reported.", kind: "REPRODUCTION" },
  { id: "G15", statement: "Gain identity: unsaturated identical events satisfy Delta_a(A10) ~= .5*Delta_a(A20) and Delta_a(A0) = 0 within 1e-12 (implementation integrity).", kind: "INVARIANT" }
]);

// ----------------------------------------------------------------------------------
// §32 selection logic (exact precedence) + §52 verdicts
// ----------------------------------------------------------------------------------

export type VerdictE2A =
  | "ACTIVATION_GAIN_REDUCTION_SUPPORTED"
  | "POSITIVE_ONLY_ACTIVATION_MAPPING_NOT_SUPPORTED"
  | "GAIN_REDUCTION_INSUFFICIENTLY_RESPONSIVE"
  | "E2_ACTIVATION_RISK_NOT_REPRODUCED"
  | "INVALID_EXPERIMENT"
  | "BLOCKED";

export const SELECTION_LOGIC = Object.freeze({
  debt_gates: "G6 (D6) and G7 (D2) — a variant 'passes debt' when both hold",
  responsiveness_gates: "G9 and G10 — a variant 'passes responsiveness' when both hold",
  case_A: "A10 passes debt + responsiveness and A20 fails debt => ACTIVATION_GAIN_REDUCTION_SUPPORTED (candidate u_a = .10q)",
  case_B: "A10 and A20 both fail debt while A0 passes debt but fails responsiveness => POSITIVE_ONLY_ACTIVATION_MAPPING_NOT_SUPPORTED",
  case_C: "A10 and A20 both pass debt => E2_ACTIVATION_RISK_NOT_REPRODUCED; if additionally A20 shows no D6 seed with strong_debt > .05 => INVALID_EXPERIMENT (corpus identity investigation)",
  case_D: "A10 passes debt but fails responsiveness => GAIN_REDUCTION_INSUFFICIENTLY_RESPONSIVE",
  case_E: "A0 passes responsiveness => INVALID_EXPERIMENT (protocol defect: u_a = 0 cannot respond)",
  case_F: "core integrity failure (G2-G5, G11-G13, G15) => INVALID_EXPERIMENT / MECHANISM_INTEGRITY_FAILURE; gain results are not interpreted",
  precedence: "F (integrity) > E (A0 anomaly) > C (not reproduced) > A/B/D (selection)"
});

// §25: more activation is NOT better; §37/§38/§39/§40/§41: no parameter search,
// no tau/q ablation, no valence changes, no contextual activation.
export const DISCIPLINE_LAW = Object.freeze({
  no_parameter_search: "only 0, .10, .20; no .05/.08/.12/.15, no binary search, no fitting",
  no_tau_ablation: true,
  no_q_ablation: true,
  no_valence_changes: true,
  no_contextual_activation: true,
  optimization_target: "responsive, bounded, recoverable, not dominated by event count, not persistently elevated after significance decayed — NOT maximum activation/AUC"
});

export const ZERO_MODEL_LAW = Object.freeze("No OpenAI, Ollama, DeepSeek, Qwen or any evaluator/LLM call exists anywhere in E2A. Real model calls: 0.");
export const PRODUCTION_ISOLATION_LAW = Object.freeze("Production source diff relative to the required baseline is empty; only research/experiments/affect-activation-mapping-e2a/ and evals/conformance/affect-activation-mapping-e2a.test.ts may change (plus the mechanical isolation-guard authorization edits in the E1/E2 harness files, documented in the manifest).");
