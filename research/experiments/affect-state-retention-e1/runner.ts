/**
 * STATE_RETENTION_AND_RECOVERY_E1 — deterministic experiment runner.
 * Executes every frozen sequence for every mechanism, the partition variants,
 * the sensitivity runs, the restore branch and the replay proofs, then
 * evaluates the primary decision gates G1-G9 and derives the verdict.
 * No randomness, no wall clock, no LLM.
 */

import {
  BASELINE_STATE, MONOTONIC_SLACK, PARTITION_TOLERANCE, RECOVERY_HORIZON_TICKS,
  RESTORE_TIME_S5, SATURATION_EPSILON, SETTLING_TOLERANCE, SENSITIVITY_SCALES,
  type AffectStateE1, type SequenceE1, type VerdictE1
} from "./contract.ts";
import { SEQUENCES } from "./contract.ts";
import {
  continueValenceRun, runB2, runValenceFamily, serializeValenceRun,
  type B2RunE1, type ImpulseE1, type ValenceRunE1
} from "./mechanisms.ts";
import { check, eventPayloadHash, round12 } from "./fixtures.ts";
import { computeValenceMetrics, distanceToBaseline, divergenceSeries, partitionError, type ValenceMetricsE1 } from "./metrics.ts";

export type FamilyMechanism = "B0" | "B1" | "B3_RESET" | "B3";

const FAMILY_MECHANISMS: readonly FamilyMechanism[] = ["B0", "B1", "B3_RESET", "B3"];

export function tEndOf(seq: SequenceE1): number {
  const last = Math.max(...seq.events.map((e) => e.time));
  return last + RECOVERY_HORIZON_TICKS;
}

export interface SerializedRunE1 {
  readonly mechanism: string;
  readonly sequence_id: string;
  readonly impulse_scale: number;
  readonly partition: string;
  readonly outputs: readonly (readonly number[])[];
  readonly events: readonly unknown[];
}

export interface RunSet {
  readonly valence: Map<string, ValenceRunE1>;
  readonly b2: Map<string, B2RunE1>;
}

function key(mechanism: string, seq: SequenceE1, partition: string, scale: number): string {
  return `${mechanism}|${seq.id}|${partition}|${scale}`;
}

/** Run-set lookup key (exported for deterministic evidence persistence/plots). */
export const runKey = key;

export interface RestoreProofE1 {
  readonly mechanism: string;
  readonly sequence_id: string;
  readonly restore_time: number;
  readonly max_abs_error: number;
  readonly tolerance: number;
  readonly pass: boolean;
}

export interface ReplayProofE1 {
  replay_application: "REPLAY" | "CONFLICT" | "UNEXPECTED";
  replay_impulse: ImpulseE1 | null;
  replay_delta: number;
  trajectory_unchanged_vs_no_event: boolean;
  conflict_application: "REPLAY" | "CONFLICT" | "UNEXPECTED";
  conflict_impulse: ImpulseE1 | null;
  distinct_ids_both_applied: boolean;
  pass: boolean;
}

export interface GateResultE1 {
  readonly id: string;
  readonly status: "PASS" | "FAIL";
  readonly evidence: string;
}

export interface ComparisonRowE1 {
  readonly event_id: string;
  readonly time: number;
  readonly b3: { readonly pre: AffectStateE1; readonly impulse: ImpulseE1 | null; readonly post: AffectStateE1 };
  readonly b3_reset: { readonly pre: AffectStateE1; readonly impulse: ImpulseE1 | null; readonly post: AffectStateE1 };
}

export interface ComparisonBlockE1 {
  readonly sequence_id: string;
  readonly unsaturated: boolean;
  readonly rows: readonly ComparisonRowE1[];
  readonly summary: {
    readonly b3: ValenceMetricsE1;
    readonly b3_reset: ValenceMetricsE1;
  };
}

export interface ExperimentResultE1 {
  readonly manifest_hash: string;
  readonly source_fingerprint: string;
  readonly built_fingerprint: string;
  readonly structural_law: { readonly holds: boolean; readonly detail: string };
  readonly restore_proofs: readonly RestoreProofE1[];
  readonly replay_proof: ReplayProofE1;
  readonly partition_errors: readonly { readonly mechanism: string; readonly sequence_id: string; readonly max_abs_error: number; readonly common_timestamps: number }[];
  readonly comparison: readonly ComparisonBlockE1[];
  readonly sensitivity: readonly { readonly sequence_id: string; readonly scale: number; readonly b3_peak_valence: number; readonly b3_reset_peak_valence: number }[];
  readonly gates: readonly GateResultE1[];
  readonly verdict: VerdictE1;
  readonly verdict_rationale: string;
}

function maxAbsDiff(a: readonly (readonly number[])[], b: readonly (readonly number[])[]): number {
  const bByTime = new Map(b.map((o) => [o[0], o]));
  let max = 0;
  for (const o of a) {
    const other = bByTime.get(o[0]);
    if (other === undefined) continue;
    for (let i = 1; i < o.length; i++) {
      const x = o[i];
      const y = other[i];
      if (x === undefined || y === undefined) continue;
      max = Math.max(max, Math.abs(x - y));
    }
  }
  return max;
}

function isUnsaturated(run: ValenceRunE1): boolean {
  return run.outputs.every((o) => {
    const v = o[1] ?? 0;
    const a = o[2] ?? 0;
    return Math.abs(v) < 1 - SATURATION_EPSILON && a > SATURATION_EPSILON && a < 1 - SATURATION_EPSILON;
  });
}

export async function executeExperiment(manifestHash: string, source: string, built: string): Promise<{
  result: ExperimentResultE1;
  runSets: Map<string, RunSet>;
  valenceMetrics: Map<string, ValenceMetricsE1>;
}> {
  const runSets = new Map<string, RunSet>();
  const valenceMetrics = new Map<string, ValenceMetricsE1>();

  // ---- primary tick1 runs + partition variants ------------------------------------
  for (const seq of SEQUENCES) {
    const tEnd = tEndOf(seq);
    const set: RunSet = { valence: new Map(), b2: new Map() };
    for (const mechanism of FAMILY_MECHANISMS) {
      for (const partition of ["tick1", "tick10", "direct"] as const) {
        set.valence.set(key(mechanism, seq, partition, 1), runValenceFamily(mechanism, seq, { partition, tEnd }));
      }
    }
    for (const partition of ["tick1", "tick10", "direct"] as const) {
      set.b2.set(key("B2", seq, partition, 1), await runB2(seq, { partition, tEnd }));
    }
    runSets.set(seq.id, set);
    for (const mechanism of FAMILY_MECHANISMS) {
      const run = set.valence.get(key(mechanism, seq, "tick1", 1));
      check(run !== undefined, `missing primary run ${mechanism}/${seq.id}`);
      valenceMetrics.set(key(mechanism, seq, "tick1", 1), computeValenceMetrics(run));
    }
  }

  // ---- §29 sensitivity: half / double impulse on unsaturated S2/S3/S5 -------------
  const sensitivityBlocks: { sequence_id: string; scale: number; b3_peak_valence: number; b3_reset_peak_valence: number }[] = [];
  const sensitivitySeqs = [SEQUENCES.find((s) => s.id === "S2"), SEQUENCES.find((s) => s.id === "S3"), SEQUENCES.find((s) => s.id === "S5_A"), SEQUENCES.find((s) => s.id === "S5_B")];
  for (const seq of sensitivitySeqs) {
    if (seq === undefined) continue;
    const tEnd = tEndOf(seq);
    const base = runSets.get(seq.id);
    check(base !== undefined, `missing run set for ${seq.id}`);
    const baseRun = base.valence.get(key("B3", seq, "tick1", 1));
    check(baseRun !== undefined, `missing base run for ${seq.id}`);
    if (!isUnsaturated(baseRun)) continue;
    for (const scale of SENSITIVITY_SCALES) {
      const b3 = runValenceFamily("B3", seq, { partition: "tick1", tEnd, impulseScale: scale });
      const reset = runValenceFamily("B3_RESET", seq, { partition: "tick1", tEnd, impulseScale: scale });
      base.valence.set(key("B3", seq, "tick1", scale), b3);
      base.valence.set(key("B3_RESET", seq, "tick1", scale), reset);
      valenceMetrics.set(key("B3", seq, "tick1", scale), computeValenceMetrics(b3));
      valenceMetrics.set(key("B3_RESET", seq, "tick1", scale), computeValenceMetrics(reset));
      sensitivityBlocks.push({
        sequence_id: seq.id, scale,
        b3_peak_valence: round12(b3.outputs.map((o) => o[1] ?? 0).reduce((a, b) => Math.min(a, b), 0)),
        b3_reset_peak_valence: round12(reset.outputs.map((o) => o[1] ?? 0).reduce((a, b) => Math.min(a, b), 0))
      });
    }
  }

  // ---- §30 restore branch (S5, B3 + B3_RESET) --------------------------------------
  const restoreProofs: RestoreProofE1[] = [];
  for (const mechanism of ["B3", "B3_RESET"] as const) {
    const seq = SEQUENCES.find((s) => s.id === "S5_A");
    check(seq !== undefined, "missing S5_A");
    const tEnd = tEndOf(seq);
    const snapshot = serializeValenceRun(mechanism, seq, RESTORE_TIME_S5);
    const continued = continueValenceRun(JSON.parse(JSON.stringify(snapshot)) as Parameters<typeof continueValenceRun>[0], seq, tEnd);
    const uninterrupted = runSets.get("S5_A")?.valence.get(key(mechanism, seq, "tick1", 1));
    check(uninterrupted !== undefined, "missing uninterrupted S5_A run");
    const common = continued.outputs.filter((o) => o[0] >= RESTORE_TIME_S5);
    const maxError = maxAbsDiff(common, uninterrupted.outputs);
    restoreProofs.push({
      mechanism, sequence_id: "S5_A", restore_time: RESTORE_TIME_S5,
      max_abs_error: round12(maxError), tolerance: PARTITION_TOLERANCE, pass: maxError <= PARTITION_TOLERANCE
    });
  }

  // ---- §32 replay proof (B3, S1 with pre-registered identity) -----------------------
  const s1 = SEQUENCES.find((s) => s.id === "S1");
  check(s1 !== undefined, "missing S1");
  const s1Event = s1.events[0];
  check(s1Event !== undefined, "S1 must have an event");
  const s1Hash = eventPayloadHash(s1Event.event_id, s1Event.time, s1Event.appraisal);
  const tEndS1 = tEndOf(s1);
  const noEventS1: SequenceE1 = { ...s1, events: [] };
  const replayRun = runValenceFamily("B3", s1, { partition: "tick1", tEnd: tEndS1, preRegistered: [[s1Event.event_id, s1Hash]] });
  const conflictHash = eventPayloadHash(s1Event.event_id, s1Event.time, { ...s1Event.appraisal, intensity: 0.7 });
  const conflictRun = runValenceFamily("B3", s1, { partition: "tick1", tEnd: tEndS1, preRegistered: [[s1Event.event_id, conflictHash]] });
  const noEventRun = runValenceFamily("B3", noEventS1, { partition: "tick1", tEnd: tEndS1 });
  const replayRecord = replayRun.events[0];
  const conflictRecord = conflictRun.events[0];
  check(replayRecord !== undefined && conflictRecord !== undefined, "replay proof requires event records");
  const replayDelta = replayRecord === undefined ? 1 : Math.max(
    Math.abs(replayRecord.post_event_state.valence - replayRecord.pre_event_state.valence),
    Math.abs(replayRecord.post_event_state.activation - replayRecord.pre_event_state.activation)
  );
  const trajectoryUnchanged = maxAbsDiff(replayRun.outputs, noEventRun.outputs) <= PARTITION_TOLERANCE;
  // Distinct ids + same payload content: S2's two events are both APPLIED.
  const s2 = SEQUENCES.find((s) => s.id === "S2");
  check(s2 !== undefined, "missing S2");
  const s2Run = runSets.get("S2")?.valence.get(key("B3", s2, "tick1", 1));
  check(s2Run !== undefined, "missing S2 run");
  const distinctBothApplied = s2Run.events.every((e) => e.application === "APPLIED") && s2Run.events.length === 2;
  const replayProof: ReplayProofE1 = {
    replay_application: replayRecord?.application === "REPLAY" ? "REPLAY" : "UNEXPECTED",
    replay_impulse: replayRecord?.impulse ?? null,
    replay_delta: round12(replayDelta),
    trajectory_unchanged_vs_no_event: trajectoryUnchanged,
    conflict_application: conflictRecord?.application === "CONFLICT" ? "CONFLICT" : "UNEXPECTED",
    conflict_impulse: conflictRecord?.impulse ?? null,
    distinct_ids_both_applied: distinctBothApplied,
    pass: replayRecord?.application === "REPLAY" && replayRecord.impulse === null && replayDelta === 0 &&
      trajectoryUnchanged && conflictRecord?.application === "CONFLICT" && conflictRecord.impulse === null && distinctBothApplied
  };

  // ---- §38 structural law: only event-state retention differs ------------------------
  const structuralDetails: string[] = [];
  let structuralHolds = true;
  for (const seq of SEQUENCES) {
    const set = runSets.get(seq.id);
    check(set !== undefined, `missing run set ${seq.id}`);
    const b1 = set.valence.get(key("B1", seq, "tick1", 1));
    const reset = set.valence.get(key("B3_RESET", seq, "tick1", 1));
    const b3 = set.valence.get(key("B3", seq, "tick1", 1));
    const b0 = set.valence.get(key("B0", seq, "tick1", 1));
    if (b1 === undefined || reset === undefined || b3 === undefined || b0 === undefined) {
      structuralHolds = false;
      structuralDetails.push(`${seq.id}: missing runs`);
      continue;
    }
    // B1 == B3_RESET byte-equal (both clamp(b + u) under the frozen semantics).
    if (maxAbsDiff(b1.outputs, reset.outputs) !== 0) {
      structuralHolds = false;
      structuralDetails.push(`${seq.id}: B1 != B3_RESET`);
    }
    // Identical event set, times, application results and impulse values.
    if (b3.events.length !== reset.events.length ||
      b3.events.some((e, i) => {
        const other = reset.events[i];
        return other === undefined || e.event_id !== other.event_id || e.time !== other.time ||
          e.application !== other.application ||
          e.impulse === null !== (other.impulse === null) ||
          (e.impulse !== null && other.impulse !== null &&
            (e.impulse.u_v !== other.impulse.u_v || e.impulse.u_a !== other.impulse.u_a));
      })) {
      structuralHolds = false;
      structuralDetails.push(`${seq.id}: event records differ beyond retention`);
    }
    // Both mechanisms start from the same baseline: the FIRST event's
    // pre-event state is the recovered baseline (nothing precedes it).
    const firstB3 = b3.events[0];
    const firstReset = reset.events[0];
    const baselineStart =
      firstB3 !== undefined && firstReset !== undefined &&
      firstB3.pre_event_state.valence === BASELINE_STATE.valence &&
      firstB3.pre_event_state.activation === BASELINE_STATE.activation &&
      firstReset.pre_event_state.valence === BASELINE_STATE.valence &&
      firstReset.pre_event_state.activation === BASELINE_STATE.activation;
    if (!baselineStart) {
      structuralHolds = false;
      structuralDetails.push(`${seq.id}: first-event pre-event states are not the common baseline`);
    }
    // B0 is the constant no-state baseline.
    if (!b0.outputs.every((o) => o[1] === BASELINE_STATE.valence && o[2] === BASELINE_STATE.activation)) {
      structuralHolds = false;
      structuralDetails.push(`${seq.id}: B0 not constant baseline`);
    }
  }
  if (structuralDetails.length === 0) structuralDetails.push("B1==B3_RESET byte-equal; identical event records; common baseline start; B0 constant");

  // ---- partition errors --------------------------------------------------------------
  const partitionErrors: { mechanism: string; sequence_id: string; max_abs_error: number; common_timestamps: number }[] = [];
  for (const seq of SEQUENCES) {
    const set = runSets.get(seq.id);
    check(set !== undefined, `missing run set ${seq.id}`);
    for (const mechanism of [...FAMILY_MECHANISMS, "B2"]) {
      const tick1 = mechanism === "B2" ? set.b2.get(key("B2", seq, "tick1", 1)) : set.valence.get(key(mechanism, seq, "tick1", 1));
      const tick10 = mechanism === "B2" ? set.b2.get(key("B2", seq, "tick10", 1)) : set.valence.get(key(mechanism, seq, "tick10", 1));
      const direct = mechanism === "B2" ? set.b2.get(key("B2", seq, "direct", 1)) : set.valence.get(key(mechanism, seq, "direct", 1));
      if (tick1 === undefined || tick10 === undefined || direct === undefined) continue;
      const error = partitionError([tick1, tick10, direct]);
      partitionErrors.push({ mechanism, sequence_id: seq.id, max_abs_error: round12(error.max_abs_error), common_timestamps: error.common_timestamps });
    }
  }

  // ---- §38 comparison table ------------------------------------------------------------
  const comparison: ComparisonBlockE1[] = [];
  for (const seq of SEQUENCES) {
    const set = runSets.get(seq.id);
    check(set !== undefined, `missing run set ${seq.id}`);
    const b3 = set.valence.get(key("B3", seq, "tick1", 1));
    const reset = set.valence.get(key("B3_RESET", seq, "tick1", 1));
    if (b3 === undefined || reset === undefined) continue;
    const rows: ComparisonRowE1[] = [];
    for (let i = 0; i < b3.events.length; i++) {
      const e3 = b3.events[i];
      const eR = reset.events[i];
      if (e3 === undefined || eR === undefined) continue;
      rows.push({
        event_id: e3.event_id, time: e3.time,
        b3: { pre: e3.pre_event_state, impulse: e3.impulse, post: e3.post_event_state },
        b3_reset: { pre: eR.pre_event_state, impulse: eR.impulse, post: eR.post_event_state }
      });
    }
    const m3 = valenceMetrics.get(key("B3", seq, "tick1", 1));
    const mR = valenceMetrics.get(key("B3_RESET", seq, "tick1", 1));
    check(m3 !== undefined && mR !== undefined, `missing metrics ${seq.id}`);
    comparison.push({
      sequence_id: seq.id, unsaturated: isUnsaturated(b3) && isUnsaturated(reset), rows,
      summary: { b3: m3, b3_reset: mR }
    });
  }

  // ---- gates ----------------------------------------------------------------------------
  const gates = evaluateGates(runSets, valenceMetrics, restoreProofs, replayProof, partitionErrors, structuralHolds);

  // ---- verdict (§45) ---------------------------------------------------------------------
  const hardGates = ["G1", "G2", "G3", "G4", "G8", "G9"];
  const retentionGates = ["G5", "G6", "G7"];
  const hardPass = gates.filter((g) => hardGates.includes(g.id)).every((g) => g.status === "PASS");
  const retentionPass = gates.filter((g) => retentionGates.includes(g.id)).every((g) => g.status === "PASS");
  let verdict: VerdictE1;
  let rationale: string;
  if (!structuralHolds) {
    verdict = "INVALID_EXPERIMENT";
    rationale = `Structural law violated: ${structuralDetails.join("; ")}`;
  } else if (hardPass && retentionPass) {
    verdict = "SUPPORTED_FOR_NEXT_STAGE";
    rationale = "All hard stability/integrity gates (G1-G4, G8, G9) PASS and all retention/accumulation/path-dependence gates (G5-G7) PASS.";
  } else {
    verdict = "MECHANISM_NOT_SUPPORTED";
    const failed = gates.filter((g) => g.status === "FAIL").map((g) => g.id);
    rationale = `Failing gates: ${failed.join(", ")}. Hard gates ${hardPass ? "PASS" : "FAIL"}; retention gates ${retentionPass ? "PASS" : "FAIL"}.`;
  }

  return {
    result: {
      manifest_hash: manifestHash, source_fingerprint: source, built_fingerprint: built,
      structural_law: { holds: structuralHolds, detail: structuralDetails.join("; ") },
      restore_proofs: restoreProofs, replay_proof: replayProof,
      partition_errors: partitionErrors, comparison, sensitivity: sensitivityBlocks,
      gates, verdict, verdict_rationale: rationale
    },
    runSets, valenceMetrics
  };
}

function evaluateGates(
  runSets: Map<string, RunSet>,
  metrics: Map<string, ValenceMetricsE1>,
  restoreProofs: readonly RestoreProofE1[],
  replayProof: ReplayProofE1,
  partitionErrors: readonly { mechanism: string; sequence_id: string; max_abs_error: number }[],
  structuralHolds: boolean
): GateResultE1[] {
  const gates: GateResultE1[] = [];
  const seqIds = SEQUENCES.map((s) => s.id);

  // ---- G1 boundedness ------------------------------------------------------------------
  let g1 = true;
  const g1Detail: string[] = [];
  for (const seq of SEQUENCES) {
    const set = runSets.get(seq.id);
    check(set !== undefined, `missing run set ${seq.id}`);
    for (const [k, run] of set.valence) {
      if (!k.startsWith("B3|")) continue;
      for (const o of run.outputs) {
        const v = o[1] ?? Number.NaN;
        const a = o[2] ?? Number.NaN;
        if (!Number.isFinite(v) || !Number.isFinite(a) || v < -1 || v > 1 || a < 0 || a > 1) {
          g1 = false;
          g1Detail.push(`${k}@t=${String(o[0])}: v=${String(v)}, a=${String(a)}`);
        }
      }
    }
  }
  if (g1) g1Detail.push(`all B3 outputs finite and within [-1,1]x[0,1] across ${seqIds.length} sequences (incl. sensitivity + partitions)`);
  gates.push({ id: "G1", status: g1 ? "PASS" : "FAIL", evidence: g1Detail.join("; ") });

  // ---- G2 recovery ------------------------------------------------------------------------
  let g2 = true;
  const g2Detail: string[] = [];
  for (const seq of SEQUENCES) {
    const set = runSets.get(seq.id);
    check(set !== undefined, `missing run set ${seq.id}`);
    for (const [k, run] of set.valence) {
      if (!k.startsWith("B3|") || !k.endsWith("|1") || !k.includes("|tick1|")) continue;
      const applied = run.events.filter((e) => e.application === "APPLIED");
      if (applied.length === 0) continue;
      const lastTime = Math.max(...applied.map((e) => e.time));
      const tail = run.outputs.filter((o) => (o[0] ?? 0) >= lastTime);
      let monotone = true;
      for (let i = 1; i < tail.length; i++) {
        const prev = tail[i - 1];
        const cur = tail[i];
        if (prev === undefined || cur === undefined) continue;
        if (distanceToBaseline({ valence: cur[1] ?? 0, activation: cur[2] ?? 0 }) >
          distanceToBaseline({ valence: prev[1] ?? 0, activation: prev[2] ?? 0 }) + MONOTONIC_SLACK) {
          monotone = false;
        }
      }
      const d0Sample = tail[0];
      const dEndSample = tail[tail.length - 1];
      if (d0Sample === undefined || dEndSample === undefined) { g2 = false; g2Detail.push(`${k}: missing tail samples`); continue; }
      const d0 = distanceToBaseline({ valence: d0Sample[1] ?? 0, activation: d0Sample[2] ?? 0 });
      const dEnd = distanceToBaseline({ valence: dEndSample[1] ?? 0, activation: dEndSample[2] ?? 0 });
      const limit = d0 * Math.exp(-8) + 1e-12;
      if (!monotone || dEnd > limit) {
        g2 = false;
        g2Detail.push(`${k}: monotone=${String(monotone)}, dEnd=${String(dEnd)} > limit=${String(limit)}`);
      }
    }
  }
  if (g2) g2Detail.push(`post-event distance non-increasing and <= d0*exp(-8)+1e-12 at last_event+1200 for every B3 run`);
  gates.push({ id: "G2", status: g2 ? "PASS" : "FAIL", evidence: g2Detail.join("; ") });

  // ---- G3 time consistency ------------------------------------------------------------------
  const b3Errors = partitionErrors.filter((p) => p.mechanism === "B3");
  const g3Max = b3Errors.reduce((a, b) => Math.max(a, b.max_abs_error), 0);
  gates.push({
    id: "G3", status: g3Max <= PARTITION_TOLERANCE ? "PASS" : "FAIL",
    evidence: `B3 max partition error across all sequences and strategies: ${String(g3Max)} <= ${String(PARTITION_TOLERANCE)}; per-mechanism/sequence errors recorded in partition_errors.`
  });

  // ---- G4 zero relevance -----------------------------------------------------------------------
  {
    const s6 = SEQUENCES.find((s) => s.id === "S6");
    const s1 = SEQUENCES.find((s) => s.id === "S1");
    check(s6 !== undefined && s1 !== undefined, "missing S6/S1");
    const set6 = runSets.get("S6");
    const set1 = runSets.get("S1");
    check(set6 !== undefined && set1 !== undefined, "missing S6/S1 run sets");
    let g4 = true;
    const detail: string[] = [];
    for (const mechanism of ["B3", "B3_RESET"] as const) {
      const run6 = set6.valence.get(key(mechanism, s6, "tick1", 1));
      const run1 = set1.valence.get(key(mechanism, s1, "tick1", 1));
      const b2Run6 = set6.b2.get(key("B2", s6, "tick1", 1));
      const b2Run1 = set1.b2.get(key("B2", s1, "tick1", 1));
      if (run6 === undefined || run1 === undefined || b2Run6 === undefined || b2Run1 === undefined) { g4 = false; detail.push("missing runs"); continue; }
      const zRecord = run6.events.find((e) => e.time === 10);
      if (zRecord === undefined) { g4 = false; detail.push("missing Z record"); continue; }
      const zImpulse = zRecord.impulse;
      if (zImpulse === null || zImpulse.u_v !== 0 || zImpulse.u_a !== 0 || zImpulse.q !== 0) {
        g4 = false;
        detail.push(`${mechanism}: Z impulse not exactly 0`);
      }
      const diff = maxAbsDiff(run6.outputs, run1.outputs);
      if (diff > PARTITION_TOLERANCE) { g4 = false; detail.push(`${mechanism}: S6 differs from S1 control by ${String(diff)}`); }
      // B2 native: Z must leave the native state byte-identical to the S1 control at common times.
      const b2Diff = maxAbsDiff(b2Run6.outputs, b2Run1.outputs);
      if (b2Diff > PARTITION_TOLERANCE) { g4 = false; detail.push(`B2: S6 differs from S1 control by ${String(b2Diff)}`); }
    }
    if (g4) detail.push("Z impulse exactly 0 and S6 == S1 control within 1e-12 (B3, B3_RESET, B2 native)");
    gates.push({ id: "G4", status: g4 ? "PASS" : "FAIL", evidence: detail.join("; ") });
  }

  // ---- G5 state retention (unsaturated S2) ---------------------------------------------------------
  {
    const s2 = SEQUENCES.find((s) => s.id === "S2");
    check(s2 !== undefined, "missing S2");
    const set = runSets.get("S2");
    check(set !== undefined, "missing S2 run set");
    const b3 = set.valence.get(key("B3", s2, "tick1", 1));
    const reset = set.valence.get(key("B3_RESET", s2, "tick1", 1));
    let g5 = false;
    let evidence = "missing runs";
    if (b3 !== undefined && reset !== undefined) {
      const weakB3 = b3.events.find((e) => e.event_id === "S2#1");
      const weakReset = reset.events.find((e) => e.event_id === "S2#1");
      if (weakB3 === undefined || weakReset === undefined || weakB3.impulse === null) {
        evidence = "missing weak-event records";
      } else {
        const u = weakB3.impulse;
        const pre = weakB3.pre_event_state;
        const expectedB3 = { valence: pre.valence + u.u_v, activation: pre.activation + u.u_a };
        const clampedExpected = expectedB3.valence >= -1 && expectedB3.valence <= 1 && expectedB3.activation >= 0 && expectedB3.activation <= 1;
        const retentionExact = clampedExpected &&
          weakB3.post_event_state.valence === expectedB3.valence &&
          weakB3.post_event_state.activation === expectedB3.activation;
        const resetOverwrote = weakReset.post_event_state.valence !== weakB3.post_event_state.valence;
        const unsaturated = isUnsaturated(b3) && isUnsaturated(reset);
        g5 = retentionExact === true && resetOverwrote && unsaturated && structuralHolds;
        evidence = `B3 post-event == pre+u exactly (${String(weakB3.post_event_state.valence)}), ` +
          `B3_RESET post-event == clamp(b+u) (${String(weakReset.post_event_state.valence)}), ` +
          `retention difference ${String(Math.abs(weakB3.post_event_state.valence - weakReset.post_event_state.valence))}, unsaturated=${String(unsaturated)}`;
      }
    }
    gates.push({ id: "G5", status: g5 ? "PASS" : "FAIL", evidence });
  }

  // ---- G6 repeated accumulation (unsaturated S3) -----------------------------------------------------
  {
    const s3 = SEQUENCES.find((s) => s.id === "S3");
    const s3c = SEQUENCES.find((s) => s.id === "S3_CONTROL");
    check(s3 !== undefined && s3c !== undefined, "missing S3/S3_CONTROL");
    const set3 = runSets.get("S3");
    const set3c = runSets.get("S3_CONTROL");
    check(set3 !== undefined && set3c !== undefined, "missing S3 run sets");
    const b3Repeated = set3.valence.get(key("B3", s3, "tick1", 1));
    const b3Control = set3c.valence.get(key("B3", s3c, "tick1", 1));
    let g6 = false;
    let evidence = "missing runs";
    if (b3Repeated !== undefined && b3Control !== undefined) {
      const lastRepeated = b3Repeated.events[b3Repeated.events.length - 1];
      const lastControl = b3Control.events[b3Control.events.length - 1];
      if (lastRepeated === undefined || lastControl === undefined) {
        evidence = "missing final event records";
      } else {
        const vRepeated = lastRepeated.post_event_state.valence;
        const vControl = lastControl.post_event_state.valence;
        const unsaturated = isUnsaturated(b3Repeated) && isUnsaturated(b3Control);
        // Predicted retained-history direction: repeated negative events
        // accumulate MORE negative valence than the matched single event.
        g6 = unsaturated && vRepeated < vControl && vRepeated < 0 && vControl < 0;
        evidence = `B3 repeated post=${String(round12(vRepeated))} < B3 single-event control post=${String(round12(vControl))} < 0, unsaturated=${String(unsaturated)}`;
      }
    }
    gates.push({ id: "G6", status: g6 ? "PASS" : "FAIL", evidence });
  }

  // ---- G7 history divergence (unsaturated S5) ----------------------------------------------------------
  {
    const setA = runSets.get("S5_A");
    const setB = runSets.get("S5_B");
    check(setA !== undefined && setB !== undefined, "missing S5 run sets");
    const seqA = SEQUENCES.find((s) => s.id === "S5_A");
    const seqB = SEQUENCES.find((s) => s.id === "S5_B");
    check(seqA !== undefined && seqB !== undefined, "missing S5_A/S5_B sequences");
    const a3 = setA.valence.get(key("B3", seqA, "tick1", 1));
    const b3b = setB.valence.get(key("B3", seqB, "tick1", 1));
    const aR = setA.valence.get(key("B3_RESET", seqA, "tick1", 1));
    const bR = setB.valence.get(key("B3_RESET", seqB, "tick1", 1));
    let g7 = false;
    let evidence = "missing runs";
    if (a3 !== undefined && b3b !== undefined && aR !== undefined && bR !== undefined) {
      const series = divergenceSeries(a3, b3b);
      const preCommon = series.find((s) => s.t === 60);
      const postCommon = series.find((s) => s.t === 60);
      const preFromRecords = Math.abs(
        (a3.events.find((e) => e.time === 60)?.pre_event_state.valence ?? 0) -
        (b3b.events.find((e) => e.time === 60)?.pre_event_state.valence ?? 0)
      );
      const postFromRecords = Math.abs(
        (a3.events.find((e) => e.time === 60)?.post_event_state.valence ?? 0) -
        (b3b.events.find((e) => e.time === 60)?.post_event_state.valence ?? 0)
      );
      const endSample = series[series.length - 1];
      const resetPostDiff = Math.abs(
        (aR.events.find((e) => e.time === 60)?.post_event_state.valence ?? 0) -
        (bR.events.find((e) => e.time === 60)?.post_event_state.valence ?? 0)
      );
      const unsaturated = isUnsaturated(a3) && isUnsaturated(b3b);
      const differsBefore = preFromRecords > SATURATION_EPSILON;
      const preservedAfter = postFromRecords > SATURATION_EPSILON;
      const decays = endSample !== undefined &&
        Math.abs(endSample.delta_valence) < postFromRecords;
      void preCommon;
      void postCommon;
      g7 = unsaturated && differsBefore && preservedAfter && decays;
      evidence = `pre-common-event |dv|=${String(round12(preFromRecords))}, post-common-event |dv|=${String(round12(postFromRecords))}, ` +
        `end-of-recovery |dv|=${endSample === undefined ? "n/a" : String(round12(Math.abs(endSample.delta_valence)))}, ` +
        `B3_RESET post-common |dv|=${String(round12(resetPostDiff))} (overwrite by construction), unsaturated=${String(unsaturated)}`;
    }
    gates.push({ id: "G7", status: g7 ? "PASS" : "FAIL", evidence });
  }

  // ---- G8 saturation recovery (S7) ------------------------------------------------------------------------
  {
    const s7 = SEQUENCES.find((s) => s.id === "S7");
    check(s7 !== undefined, "missing S7");
    const set = runSets.get("S7");
    check(set !== undefined, "missing S7 run set");
    const b3 = set.valence.get(key("B3", s7, "tick1", 1));
    let g8 = false;
    let evidence = "missing run";
    if (b3 !== undefined) {
      const saturatedDuring = b3.outputs.some((o) => (o[0] ?? 0) <= 199 && Math.abs(o[1] ?? 0) >= 1 - SATURATION_EPSILON);
      const leftBoundary = b3.outputs.some((o) => (o[0] ?? 0) > 199 && Math.abs(o[1] ?? 0) < 1 - SETTLING_TOLERANCE);
      const applied = b3.events.filter((e) => e.application === "APPLIED");
      const lastTime = Math.max(...applied.map((e) => e.time));
      const d0Sample = b3.outputs.find((o) => o[0] === lastTime);
      const endSample = b3.outputs[b3.outputs.length - 1];
      const d0 = d0Sample === undefined ? 0 : distanceToBaseline({ valence: d0Sample[1] ?? 0, activation: d0Sample[2] ?? 0 });
      const dEnd = endSample === undefined ? Number.NaN : distanceToBaseline({ valence: endSample[1] ?? 0, activation: endSample[2] ?? 0 });
      const recovers = dEnd <= d0 * Math.exp(-8) + 1e-12;
      const finite = b3.outputs.every((o) => Number.isFinite(o[1] ?? Number.NaN) && Number.isFinite(o[2] ?? Number.NaN));
      g8 = saturatedDuring && leftBoundary && recovers && finite;
      evidence = `saturated during input=${String(saturatedDuring)}, left boundary after input stopped=${String(leftBoundary)}, ` +
        `d0=${String(round12(d0))}, dEnd=${String(round12(dEnd))} <= d0*exp(-8)+1e-12=${String(round12(d0 * Math.exp(-8) + 1e-12))}, finite=${String(finite)}`;
    }
    gates.push({ id: "G8", status: g8 ? "PASS" : "FAIL", evidence });
  }

  // ---- G9 replay --------------------------------------------------------------------------------------------
  gates.push({
    id: "G9", status: replayProof.pass ? "PASS" : "FAIL",
    evidence: `same id+payload -> ${replayProof.replay_application} (impulse ${String(replayProof.replay_impulse)}, delta ${String(replayProof.replay_delta)}, trajectory unchanged=${String(replayProof.trajectory_unchanged_vs_no_event)}); ` +
      `same id+changed payload -> ${replayProof.conflict_application}; distinct ids same payload -> both APPLIED=${String(replayProof.distinct_ids_both_applied)}`
  });

  // ---- restore proof (reported alongside, part of integrity) ------------------------------------------------
  const restoreOk = restoreProofs.every((p) => p.pass);
  gates.push({
    id: "RESTORE", status: restoreOk ? "PASS" : "FAIL",
    evidence: restoreProofs.map((p) => `${p.mechanism}: max_abs_error=${String(p.max_abs_error)} <= ${String(p.tolerance)}`).join("; ")
  });

  return gates;
}
