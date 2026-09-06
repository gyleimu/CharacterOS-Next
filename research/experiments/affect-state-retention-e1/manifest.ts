/**
 * STATE_RETENTION_AND_RECOVERY_E1 — frozen manifest (§42).
 *
 * The manifest is computed and hashed BEFORE any trajectory is produced.
 * It is never amended after observing results; a correction would require a
 * new experiment revision/run identity.
 */

import {
  ACTIVATION_BOUNDS, APPLICATION_IDENTITY_RULES, BASELINE_COMMIT, BASELINE_STATE,
  GATES, MECHANISM_DEFINITIONS, MECHANISM_IDS, METRICS_PROTOCOL, MONOTONIC_SLACK,
  PARTITION_TOLERANCE, RESTORE_TIME_S5, SAMPLE_TICK, SATURATION_EPSILON,
  SENSITIVITY_SCALES, SETTLING_TOLERANCE, SUCCESS_NARROWING, TAU,
  VALENCE_BOUNDS, VERDICT_RULES, SEQUENCES, S1, S2, S2_CONTROL, S3, S3_CONTROL,
  S4, S5_A, S5_B, S6, S7, VALENCE_GAIN, ACTIVATION_GAIN, EXPERIMENT_ID,
  RECOVERY_HORIZON_TICKS, ZERO_IMPULSE_APPLICATION_LAW, type SequenceE1
} from "./contract.ts";
import { canonicalJson, sha256 } from "./fixtures.ts";

export function impulseMapping() {
  return {
    q: "relevance * intensity",
    signed_goal: "2 * goal_congruence - 1",
    u_v: "0.25 * q * signed_goal",
    u_a: "0.20 * q",
    coefficients: { valence_gain: VALENCE_GAIN, activation_gain: ACTIVATION_GAIN },
    frozen_note: "Coefficients are frozen before any run and are never tuned after viewing results (§11)."
  };
}

export function sequenceSummary(seq: SequenceE1) {
  return { id: seq.id, purpose: seq.purpose, control_of: seq.control_of, events: seq.events };
}

export function protocol() {
  return {
    experiment_id: EXPERIMENT_ID,
    schema_version: "affect-state-retention-manifest-e1",
    research_class: "Emotion Dynamics research experiment (isolated; production untouched)",
    git_baseline: BASELINE_COMMIT,
    primary_question: "When a new Appraisal arrives, should Affect retain the still-unrecovered previous state and accumulate from it (B3), or should the new event overwrite/reset the state (B3_RESET)?",
    hypothesis: "Bounded accumulation from the current Affect state preserves recent emotional history better than reset/overwrite, while remaining bounded, deterministic, recoverable, time-consistent and replay-safe. The experiment is allowed to reject B3.",
    state_representation: {
      valence: { range: VALENCE_BOUNDS },
      activation: { range: ACTIVATION_BOUNDS },
      note: "EXPERIMENTAL representation for E1 only; never a production schema; not exported into production packages."
    },
    baseline: BASELINE_STATE,
    tau: TAU,
    recovery_law: "x(t + dt) = b + (x(t) - b) * exp(-dt / tau), applied independently to valence and activation; deterministic, finite, monotonic toward baseline with no input, no wall clock, no randomness.",
    bounds: { valence: VALENCE_BOUNDS, activation: ACTIVATION_BOUNDS, clamp: "deterministic clamp after event application; every saturation event recorded" },
    impulse_mapping: impulseMapping(),
    zero_impulse_application_law: ZERO_IMPULSE_APPLICATION_LAW,
    mechanisms: { ids: MECHANISM_IDS, definitions: MECHANISM_DEFINITIONS },
    sequences: {
      primary: [sequenceSummary(S1), sequenceSummary(S2), sequenceSummary(S2_CONTROL), sequenceSummary(S3), sequenceSummary(S3_CONTROL), sequenceSummary(S4), sequenceSummary(S5_A), sequenceSummary(S5_B), sequenceSummary(S6), sequenceSummary(S7)],
      count: SEQUENCES.length
    },
    event_fixtures: {
      N: "relevance=1, intensity=q, goal_congruence=0, controllability=0.25, uncertainty=0.25, attribution=other",
      P: "relevance=1, intensity=q, goal_congruence=1, controllability=0.25, uncertainty=0.25, attribution=other",
      Z: "relevance=0, remaining fields valid",
      random_generation: "none"
    },
    sensitivity: { scales: SENSITIVITY_SCALES, scope: "unsaturated S2/S3/S5", tuning_use: "forbidden" },
    event_order_law: "at every event timestamp: advance from previous time via recovery; capture pre_event_state; apply impulse; clamp; capture post_event_state; record trace. Events are never applied before elapsed-time recovery.",
    time_partition: {
      strategies: ["tick1", "tick10", "direct"],
      law: "advancing dt=100 in one step is numerically equivalent within tolerance to 10 x dt=10 or 100 x dt=1 when no events intervene; outputs are read-only closed-form evaluations and never advance experiment time",
      tolerance: PARTITION_TOLERANCE,
      note: "1e-12 is the frozen protocol value; no looser tolerance was chosen."
    },
    sampling: { primary_resolution_ticks: SAMPLE_TICK, sampling_is_read_only: true, recovery_horizon_ticks: RECOVERY_HORIZON_TICKS },
    settling_tolerance: SETTLING_TOLERANCE,
    saturation_epsilon: SATURATION_EPSILON,
    monotonic_slack: MONOTONIC_SLACK,
    restore_branch: {
      sequence: "S5", time: RESTORE_TIME_S5,
      law: "serialize the anchored experiment state + application registry at t=30; restore into a fresh experiment instance; continue with identical future inputs; no recomputation of historical events; trajectory must match the uninterrupted run within 1e-12."
    },
    application_identity: APPLICATION_IDENTITY_RULES,
    metrics: METRICS_PROTOCOL,
    decision_gates: GATES,
    verdict_classes: VERDICT_RULES,
    success_narrowing: SUCCESS_NARROWING,
    llm_usage: { real_model_calls: 0, llm_judge: false, providers: "none" },
    determinism: { random_seeds: "none (no random values anywhere)", wall_clock_in_results: false }
  };
}

export type ProtocolE1 = ReturnType<typeof protocol>;

export function protocolHash(): string {
  return sha256(canonicalJson(protocol()));
}
