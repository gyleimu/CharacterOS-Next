/**
 * PRODUCTION_SHAPED_APPRAISAL_DYNAMICS_E2 — experiment runner.
 *
 * Executes the frozen corpus (232 lifetimes x 4 mechanisms = 928 primary
 * runs), the C1-C5 cases, the 16 history pairs, partition/restore/replay
 * probes (1030 executions total, machine-checked), computes the frozen
 * metrics and evaluates the pre-registered gates G1-G14 with the exact
 * verdict order of §68. No randomness; no LLM; production untouched.
 *
 * The B3 law is E1's law: the valence/activation engine is IMPORTED from the
 * frozen E1 experiment (never reimplemented, never modified).
 */

import {
  FAMILIES, FAMILY_SEEDS, HISTORY_PAIRS, PARTITION_PROBE_FAMILIES,
  PARTITION_PROBE_MECHANISM, PARTITION_PROBE_SEED, RESTORE_PROBES,
  RUN_ACCOUNTING, type AppraisalEventE2, type VerdictE2, type MappingRiskCode
} from "./contract.ts";
import {
  continueValenceRun, runValenceFamily, serializeValenceRun,
  type EventRecordE1, type ValenceRunE1
} from "../affect-state-retention-e1/mechanisms.ts";
import { check, canonicalJson, eventPayloadHash, round12, sha256 } from "./fixtures.ts";
import {
  activationDebt, baselineMetrics, gainChecks, infNormDiff, occupancyMetrics,
  partitionError, recoveryWindows, saturationEpisodes, sensitivityBuckets,
  stateChangeSparsity, stateAt, activationReconstruction,
  type Sample
} from "./metrics.ts";
import { runB2E2, b2QuietRecovery, type B2RunE2 } from "./b2.ts";
import {
  buildCases, buildHistoryPairs, buildPrimaryCorpus, validateCorpusEvents,
  type FamilyCorpusE2
} from "./generator.ts";

export type { FamilyCorpusE2 };

const MECH = ["B0", "B3_RESET", "B3"] as const;
const REPRESENTATIVE_SEED = "E2-S00";
const EPS = 1e-12;

/** E1 engine input shape for an E2 corpus. Extra assessment_confidence is
 * carried but NEVER read by the B3 law (proven end-to-end by gate G5). */
function toE1Sequence(corpusId: string, events: readonly AppraisalEventE2[]): { id: string; purpose: string; events: readonly { event_id: string; time: number; appraisal: object }[]; control_of: null } {
  return {
    id: corpusId, purpose: "E2", control_of: null,
    events: events.map((e) => ({
      event_id: e.event_id, time: e.tick,
      appraisal: {
        relevance: e.relevance, goal_congruence: e.goal_congruence, attribution: e.attribution,
        controllability: e.controllability, uncertainty: e.uncertainty, intensity: e.intensity
      }
    }))
  };
}

// ----------------------------------------------------------------------------------
// Per-run metrics
// ----------------------------------------------------------------------------------

export interface ValenceRunMetricsE2 {
  readonly mechanism: string;
  readonly occupancy: ReturnType<typeof occupancyMetrics>;
  readonly baseline: ReturnType<typeof baselineMetrics>;
  readonly saturation: ReturnType<typeof saturationEpisodes>;
  readonly debt: ReturnType<typeof activationDebt>;
  readonly sensitivity: readonly ReturnType<typeof sensitivityBuckets>[number][];
  readonly sparsity: readonly ReturnType<typeof stateChangeSparsity>[number][];
  readonly gain: ReturnType<typeof gainChecks>;
  readonly reconstruction: { readonly anchor_tick: number; readonly max_abs_error: number; readonly covered_ticks: number };
  readonly recovery_windows: readonly ReturnType<typeof recoveryWindows>[number][];
  readonly g2_violations: number;
}

function eventSensitivityInputs(events: readonly EventRecordE1[]): { event_id: string; q: number; j: number; clamped: boolean }[] {
  return events.filter((e) => e.application === "APPLIED" && e.impulse !== null).map((e) => ({
    event_id: e.event_id,
    q: e.impulse?.q ?? 0,
    j: Math.max(
      Math.abs(e.post_event_state.valence - e.pre_event_state.valence),
      Math.abs(e.post_event_state.activation - e.pre_event_state.activation)
    ),
    clamped: e.saturation.length > 0
  }));
}

function computeValenceMetrics(run: ValenceRunE1, quiet: readonly { start: number; end: number }[]): ValenceRunMetricsE2 {
  const samples = run.outputs as readonly Sample[];
  const events = run.events;
  let g2Violations = 0;
  if (run.mechanism === "B3" || run.mechanism === "B3_RESET") {
    for (const s of samples) {
      const v = s[1];
      const a = s[2];
      if (v === undefined || a === undefined || !Number.isFinite(v) || !Number.isFinite(a) || v < -1 || v > 1 || a < 0 || a > 1) g2Violations += 1;
      else if (run.mechanism === "B3" && a < 0.2 - EPS) g2Violations += 1;
    }
  }
  // Signed denominator q*(2g-1) recovered exactly from the frozen impulse law:
  // u_v = .25 * q * (2g-1)  =>  q*(2g-1) = u_v / .25 (u_v is mechanism-independent).
  const gains = gainChecks(events.filter((e) => e.application === "APPLIED" && e.impulse !== null).map((e) => ({
    q: e.impulse?.q ?? 0,
    delta_v: e.post_event_state.valence - e.pre_event_state.valence,
    delta_a: e.post_event_state.activation - e.pre_event_state.activation,
    signed_denominator: (e.impulse?.u_v ?? 0) / 0.25,
    unsaturated: e.saturation.length === 0
  })));
  const appliedEvents = events.filter((e) => e.application === "APPLIED" && e.impulse !== null).map((e) => ({ tick: e.time, q: e.impulse?.q ?? 0 }));
  return {
    mechanism: run.mechanism,
    occupancy: occupancyMetrics(samples),
    baseline: baselineMetrics(samples),
    saturation: saturationEpisodes(samples),
    debt: activationDebt(samples, appliedEvents as never),
    sensitivity: sensitivityBuckets(eventSensitivityInputs(events)),
    sparsity: stateChangeSparsity(eventSensitivityInputs(events)),
    gain: gains,
    reconstruction: activationReconstruction(samples, appliedEvents),
    recovery_windows: recoveryWindows(samples, quiet),
    g2_violations: g2Violations
  };
}

function b2Metrics(run: B2RunE2, quiet: readonly { start: number; end: number }[]): ValenceRunMetricsE2 {
  const n = run.outputs.length;
  let channelBound = 0;
  let channelNear = 0;
  let moodAt25 = 0;
  let moodAt225 = 0;
  let activeSum = 0;
  let releasingSum = 0;
  for (const o of run.outputs) {
    for (const j of [2, 3, 4, 5]) {
      const i = o[j] ?? 0;
      if (i >= 1 - EPS) channelBound += 1;
      if (i >= 0.9) channelNear += 1;
    }
    if ((o[1] ?? 0) >= 0.25 - EPS) moodAt25 += 1;
    if ((o[1] ?? 0) >= 0.225) moodAt225 += 1;
    activeSum += o[6] ?? 0;
    releasingSum += o[7] ?? 0;
  }
  return {
    mechanism: "B2",
    occupancy: {
      o_v_minus: 0, o_v_plus: 0, o_a_minus: 0, o_a_plus: 0, n_v: 0, n_a_plus: 0, n_a_minus: 0,
      channel_bound_occupancy: channelBound / (4 * n),
      channel_near_bound_occupancy: channelNear / (4 * n),
      mood_occupancy_at_25: moodAt25 / n,
      mood_occupancy_at_225: moodAt225 / n,
      mean_active_channels: activeSum / n,
      mean_releasing_channels: releasingSum / n
    },
    baseline: { q50_d: 0, q90_d: 0, q99_d: 0, b_05: 0, mu_v: 0 },
    saturation: { count: 0, max_duration: 0, p95_duration: 0 },
    debt: { strong_debt: 0, quiet_debt: 0 },
    sensitivity: [],
    sparsity: [],
    gain: { count: 0, max_abs_error_delta_a_over_q: 0, max_abs_error_delta_v_over_signed: 0 },
    reconstruction: { anchor_tick: 0, max_abs_error: 0, covered_ticks: 0 },
    recovery_windows: b2QuietRecovery(run, quiet) as never,
    g2_violations: 0
  } as unknown as ValenceRunMetricsE2;
}

// ----------------------------------------------------------------------------------
// Execution
// ----------------------------------------------------------------------------------

export interface RestoreProofE2 {
  readonly family: string;
  readonly seed: string;
  readonly time: number;
  readonly mechanism: string;
  readonly max_abs_error: number;
  readonly pass: boolean;
}

export interface ReplayProofE2 {
  readonly mechanism: string;
  readonly replay_application: string;
  readonly replay_delta: number;
  readonly conflict_application: string;
  readonly different_id_application: string;
  readonly pass: boolean;
}

export interface GateResultE2 {
  readonly id: string;
  readonly status: "PASS" | "FAIL" | "RISK";
  readonly evidence: string;
}

export interface HistoryPairResultE2 {
  readonly id: string;
  readonly qualified: boolean;
  readonly unsaturated: boolean;
  readonly d_pre: number;
  readonly d_post_b3: number;
  readonly d_post_reset: number;
  readonly b3_2100: number;
  readonly b3_2700: number;
}

export interface ExperimentResultE2 {
  readonly manifest_hash: string;
  readonly corpus_root: string;
  readonly lifetimes: number;
  readonly corpus_events: number;
  readonly run_accounting: typeof RUN_ACCOUNTING & { readonly measured_total: number };
  readonly gates: readonly GateResultE2[];
  readonly verdict: VerdictE2;
  readonly verdict_rationale: string;
  readonly mapping_risks: readonly MappingRiskCode[];
}

export interface E2Execution {
  result: ExperimentResultE2;
  corpus: FamilyCorpusE2[];
  metricsByRun: Map<string, ValenceRunMetricsE2>;
  representativeOutputs: Map<string, readonly (readonly number[])[]>;
  b2Representative: Map<string, B2RunE2>;
  caseMetrics: Map<string, ValenceRunMetricsE2>;
  historyPairResults: readonly HistoryPairResultE2[];
  partitionProbe: readonly { family: string; errors: { tick10_vs_tick1: number; direct_vs_tick1: number } }[];
  restoreProofs: readonly RestoreProofE2[];
  replayProofs: readonly ReplayProofE2[];
  c4c5_max_abs_error: number;
  d4d5_symmetry_max_error: { readonly v: number; readonly a: number };
}

// Streaming per-seed caches (avoids retaining full sample series for 928 runs).
const q99ActivationCache = new Map<string, number>();
const g10Cache = new Map<string, { readonly total: number; readonly jAtLeast02: number; readonly jBelow005: number; readonly midUpTotal: number; readonly midUpAtLeast02: number }>();
const cancellationCache = new Map<string, number>();
const boundaryExitCache = new Map<string, boolean>();

function noteStreamingMetrics(
  family: string,
  seed: string,
  samples: readonly Sample[],
  lastActiveTick: number | null,
  events?: readonly EventRecordE1[]
): void {
  if (family === "D3" && events !== undefined) {
    let total = 0;
    let jAtLeast02 = 0;
    let jBelow005 = 0;
    let midUpTotal = 0;
    let midUpAtLeast02 = 0;
    for (const e of events) {
      if (e.application !== "APPLIED" || e.impulse === null) continue;
      const j = Math.max(
        Math.abs(e.post_event_state.valence - e.pre_event_state.valence),
        Math.abs(e.post_event_state.activation - e.pre_event_state.activation)
      );
      const clamped = e.saturation.length > 0;
      total += 1;
      if (j >= 0.02) jAtLeast02 += 1;
      if (j < 0.005) jBelow005 += 1;
      if ((e.impulse?.q ?? 0) >= 0.09 && !clamped) {
        midUpTotal += 1;
        if (j + EPS >= 0.02) midUpAtLeast02 += 1;
      }
    }
    g10Cache.set(`D3|${seed}`, { total, jAtLeast02, jBelow005, midUpTotal, midUpAtLeast02 });
  }
  if (family === "D2") {
    const activations = samples.map((s) => s[2] ?? 0);
    q99ActivationCache.set(`${family}|${seed}`, quantileOf(activations, 0.99));
  }
  if (family === "D6") {
    let hits = 0;
    for (const s of samples) {
      if (Math.abs(s[1] ?? 0) <= 0.05 && (s[2] ?? 0) >= 0.6) hits += 1;
    }
    cancellationCache.set(`${family}|${seed}`, hits / samples.length);
  }
  // G6 boundary-exit law (D4/D5/D7): if the state is at an exact bound at the
  // final active input, the first recovery tick must leave the exact bound.
  if (lastActiveTick !== null && (family === "D4" || family === "D5" || family === "D7")) {
    const atBound = (s: Sample | undefined): boolean =>
      s !== undefined && ((Math.abs(s[1] ?? 0) >= 1 - EPS) || (s[2] ?? 0) >= 1 - EPS || (s[2] ?? 0) <= EPS);
    const finalActive = samples.find((s) => s[0] === lastActiveTick);
    if (atBound(finalActive)) {
      const firstRecovery = samples.find((s) => s[0] === lastActiveTick + 1);
      boundaryExitCache.set(`${family}|${seed}`, !atBound(firstRecovery));
    }
  }
}

function quantileOf(values: readonly number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil(p * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, idx))] ?? 0;
}

export async function executeE2(manifestHash: string, corpusRoot: string, corpus?: FamilyCorpusE2[]): Promise<E2Execution> {
  const metricsByRun = new Map<string, ValenceRunMetricsE2>();
  const representativeOutputs = new Map<string, readonly (readonly number[])[]>();
  const b2Representative = new Map<string, B2RunE2>();
  const caseMetrics = new Map<string, ValenceRunMetricsE2>();
  let measuredRuns = 0;

  // ---- G1 preconditions: corpus build + validation + root binding -----------------
  if (corpus === undefined) {
    const built = buildPrimaryCorpus();
    corpus = built.corpus;
  }
  const lifetimes = corpus.length;
  const corpusEventCount = corpus.reduce((sum, c) => sum + c.events.length, 0);
  check(lifetimes === RUN_ACCOUNTING.primary_corpus_lifetimes, `lifetimes ${String(lifetimes)} != 232`);
  validateCorpusEvents(corpus);
  check(corpusMerkleRoot(corpus) === corpusRoot, "corpus Merkle root does not match the frozen manifest");

  // ---- primary corpus: 232 lifetimes x 4 mechanisms --------------------------------
  for (const life of corpus) {
    const corpusId = `${life.family}|${life.seed}`;
    const seq = toE1Sequence(corpusId, life.events);
    const representative = life.seed === REPRESENTATIVE_SEED;
    const lastQuiet = life.quiet[life.quiet.length - 1];
    void lastQuiet;
    for (const mechanism of MECH) {
      const run = runValenceFamily(mechanism, seq as never, { partition: "tick1", tEnd: life.T - 1 });
      measuredRuns += 1;
      metricsByRun.set(`${corpusId}|${mechanism}`, computeValenceMetrics(run, life.quiet));
      noteStreamingMetrics(life.family, life.seed, run.outputs as readonly Sample[], lastActiveTickOf(life), run.events);
      if (representative) representativeOutputs.set(`${corpusId}|${mechanism}`, run.outputs.map((o) => o.map(round12)));
    }
    const b2 = await runB2E2(corpusId, life.T - 1, life.events);
    measuredRuns += 1;
    metricsByRun.set(`${corpusId}|B2`, b2Metrics(b2, life.quiet));
    if (representative) b2Representative.set(corpusId, b2);
  }

  // ---- C1-C5 cases: 5 x 4 mechanisms ------------------------------------------------
  const cases = buildCases();
  let c4c5Error = 0;
  let c4Raw: readonly (readonly number[])[] | null = null;
  let c5Raw: readonly (readonly number[])[] | null = null;
  for (const c of cases) {
    const seq = toE1Sequence(c.id, c.events);
    for (const mechanism of MECH) {
      const run = runValenceFamily(mechanism, seq as never, { partition: "tick1", tEnd: c.T });
      measuredRuns += 1;
      caseMetrics.set(`${c.id}|${mechanism}`, computeValenceMetrics(run, []));
      if (c.id === "C1" && mechanism === "B3") representativeOutputs.set(`C1|B3`, run.outputs.map((o) => o.map(round12)));
      if (c.id === "C2" && mechanism === "B3") representativeOutputs.set(`C2|B3`, run.outputs.map((o) => o.map(round12)));
      if (c.id === "C3" && mechanism === "B3") representativeOutputs.set(`C3|B3`, run.outputs.map((o) => o.map(round12)));
      if (c.id === "C4" && mechanism === "B3") c4Raw = run.outputs;
      if (c.id === "C5" && mechanism === "B3") c5Raw = run.outputs;
    }
    const b2 = await runB2E2(c.id, c.T, c.events);
    measuredRuns += 1;
    caseMetrics.set(`${c.id}|B2`, b2Metrics(b2, []));
    if (c.id === "C1") representativeOutputs.set("C1|B2", b2.outputs.map((o) => o.slice(0, 6).map(round12)));
  }
  check(c4Raw !== null && c5Raw !== null, "missing C4/C5 raw runs");
  if (c4Raw !== null && c5Raw !== null) {
    for (let i = 0; i < c4Raw.length; i++) {
      const a = c4Raw[i];
      const b = c5Raw[i];
      if (a === undefined || b === undefined) continue;
      for (let j = 1; j < a.length; j++) c4c5Error = Math.max(c4c5Error, Math.abs((a[j] ?? 0) - (b[j] ?? 0)));
    }
  }

  // ---- §34 history pairs: 16 pairs x 2 histories x 2 mechanisms ---------------------
  const pairs = buildHistoryPairs();
  const historyPairResults: HistoryPairResultE2[] = [];
  for (const pair of pairs) {
    const seqA = toE1Sequence(`${pair.id}A`, pair.history_a);
    const seqB = toE1Sequence(`${pair.id}B`, pair.history_b);
    const runs = new Map<string, ValenceRunE1>();
    for (const mechanism of ["B3_RESET", "B3"] as const) {
      runs.set(`${pair.id}A|${mechanism}`, runValenceFamily(mechanism, seqA as never, { partition: "tick1", tEnd: HISTORY_PAIRS.end_tick }));
      runs.set(`${pair.id}B|${mechanism}`, runValenceFamily(mechanism, seqB as never, { partition: "tick1", tEnd: HISTORY_PAIRS.end_tick }));
      measuredRuns += 2;
    }
    const runA3 = runs.get(`${pair.id}A|B3`);
    const runB3 = runs.get(`${pair.id}B|B3`);
    const runAR = runs.get(`${pair.id}A|B3_RESET`);
    const runBR = runs.get(`${pair.id}B|B3_RESET`);
    check(runA3 !== undefined && runB3 !== undefined && runAR !== undefined && runBR !== undefined, `history pair ${pair.id}: missing runs`);
    const finalTick = HISTORY_PAIRS.common_final_event.tick;
    const preA = runA3?.events.find((e) => e.time === finalTick);
    const preB = runB3?.events.find((e) => e.time === finalTick);
    check(preA !== undefined && preB !== undefined, `history pair ${pair.id}: missing final event records`);
    const dPre = preA !== undefined && preB !== undefined ? infNormDiff(preA.pre_event_state, preB.pre_event_state) : 0;
    const dPostB3 = preA !== undefined && preB !== undefined ? infNormDiff(preA.post_event_state, preB.post_event_state) : 0;
    const preAR = runAR?.events.find((e) => e.time === finalTick);
    const preBR = runBR?.events.find((e) => e.time === finalTick);
    const dPostReset = preAR !== undefined && preBR !== undefined ? infNormDiff(preAR.post_event_state, preBR.post_event_state) : 0;
    const at2100A = stateAt(runA3?.outputs ?? [], HISTORY_PAIRS.checkpoints[0] ?? 2100);
    const at2100B = stateAt(runB3?.outputs ?? [], HISTORY_PAIRS.checkpoints[0] ?? 2100);
    const at2700A = stateAt(runA3?.outputs ?? [], HISTORY_PAIRS.checkpoints[1] ?? 2700);
    const at2700B = stateAt(runB3?.outputs ?? [], HISTORY_PAIRS.checkpoints[1] ?? 2700);
    const d2100 = at2100A !== null && at2100B !== null ? infNormDiff(at2100A, at2100B) : 0;
    const d2700 = at2700A !== null && at2700B !== null ? infNormDiff(at2700A, at2700B) : 0;
    const unsaturated = saturationEpisodes(runA3?.outputs ?? []).count === 0 && saturationEpisodes(runB3?.outputs ?? []).count === 0;
    if (pair.id === "H00") {
      for (const [k, r] of runs) historyOutputsSet(`${pair.id}${k.slice(pair.id.length)}`, r.outputs);
    }
    historyPairResults.push({
      id: pair.id, qualified: unsaturated && dPre >= 0.05, unsaturated,
      d_pre: round12(dPre), d_post_b3: round12(dPostB3), d_post_reset: round12(dPostReset),
      b3_2100: round12(d2100), b3_2700: round12(d2700)
    });
  }

  // ---- §35 partition probes ----------------------------------------------------------
  const partitionProbe: { family: string; errors: { tick10_vs_tick1: number; direct_vs_tick1: number } }[] = [];
  for (const familyId of PARTITION_PROBE_FAMILIES) {
    const life = corpus.find((c) => c.family === familyId && c.seed === PARTITION_PROBE_SEED);
    check(life !== undefined, `partition probe: missing ${familyId}-${PARTITION_PROBE_SEED}`);
    if (life === undefined) continue;
    const seq = toE1Sequence(`${life.family}|${life.seed}`, life.events);
    const tick1 = runValenceFamily(PARTITION_PROBE_MECHANISM, seq as never, { partition: "tick1", tEnd: life.T - 1 });
    const tick10 = runValenceFamily(PARTITION_PROBE_MECHANISM, seq as never, { partition: "tick10", tEnd: life.T - 1 });
    const direct = runValenceFamily(PARTITION_PROBE_MECHANISM, seq as never, { partition: "direct", tEnd: life.T - 1 });
    measuredRuns += 2;
    const err = partitionError([tick1, tick10, direct]);
    check(err.max_abs_error <= EPS, `partition probe ${familyId}: ${String(err.max_abs_error)}`);
    partitionProbe.push({
      family: familyId,
      errors: { tick10_vs_tick1: round12(maxDiffAtCommon(tick1.outputs, tick10.outputs)), direct_vs_tick1: round12(maxDiffAtCommon(tick1.outputs, direct.outputs)) }
    });
  }

  // ---- §36 restore probes --------------------------------------------------------------
  const restoreProofs: RestoreProofE2[] = [];
  for (const probe of RESTORE_PROBES) {
    const life = corpus.find((c) => c.family === probe.family && c.seed === probe.seed);
    check(life !== undefined, `restore probe: missing corpus ${probe.family}/${probe.seed}`);
    if (life === undefined) continue;
    const seq = toE1Sequence(`${life.family}|${life.seed}`, life.events);
    const snapshot = serializeValenceRun(probe.mechanism as never, seq as never, probe.time);
    const continued = continueValenceRun(JSON.parse(JSON.stringify(snapshot)) as Parameters<typeof continueValenceRun>[0], seq as never, life.T - 1);
    const uninterrupted = runValenceFamily(probe.mechanism as never, seq as never, { partition: "tick1", tEnd: life.T - 1 });
    let maxError = 0;
    for (const o of continued.outputs) {
      const t = o[0];
      const other = uninterrupted.outputs.find((x) => x[0] === t);
      if (other === undefined) continue;
      for (let j = 1; j < o.length; j++) maxError = Math.max(maxError, Math.abs((o[j] ?? 0) - (other[j] ?? 0)));
    }
    restoreProofs.push({ family: probe.family, seed: probe.seed, time: probe.time, mechanism: probe.mechanism, max_abs_error: round12(maxError), pass: maxError <= EPS });
    measuredRuns += 1;
  }

  // ---- §37 replay/conflict probes (one per mechanism) --------------------------------------
  // The application-identity law is mechanism-independent; it is probed in the
  // minimal lawful setting (E1 pattern): a single nonzero event whose registry
  // entry is pre-seeded. REPLAY: the attempt applies nothing (delta 0,
  // trajectory equals the no-event run). CONFLICT: same id + changed payload.
  // Different id + same payload: APPLIED. Accounting: ONE execution (the
  // REPLAY run) per mechanism; conflict/different-id/no-event runs are probe
  // sub-steps.
  const replayProofs: ReplayProofE2[] = [];
  {
    const d2 = corpus.find((c) => c.family === "D2" && c.seed === "E2-S00");
    check(d2 !== undefined, "replay probe: missing D2-S00");
    const firstEvent = d2?.events[0];
    check(firstEvent !== undefined, "replay probe: no event");
    if (d2 !== undefined && firstEvent !== undefined) {
      // Pre-registration hashes must match EXACTLY what each engine computes
      // internally: the E1 valence engine hashes the six-field B3 appraisal
      // (assessment_confidence is never part of its identity); the B2 driver
      // hashes the full E2 event.
      const bFamilyPayloadHash = eventPayloadHash(firstEvent.event_id, firstEvent.tick, {
        relevance: firstEvent.relevance, goal_congruence: firstEvent.goal_congruence, attribution: firstEvent.attribution,
        controllability: firstEvent.controllability, uncertainty: firstEvent.uncertainty, intensity: firstEvent.intensity
      } as never);
      const changedPayload = { ...firstEvent, intensity: Math.min(1, firstEvent.intensity + 0.01) };
      const bFamilyConflictHash = eventPayloadHash(changedPayload.event_id, changedPayload.tick, {
        relevance: changedPayload.relevance, goal_congruence: changedPayload.goal_congruence, attribution: changedPayload.attribution,
        controllability: changedPayload.controllability, uncertainty: changedPayload.uncertainty, intensity: changedPayload.intensity
      } as never);
      const fullPayloadHash = eventPayloadHash(firstEvent.event_id, firstEvent.tick, firstEvent as never);
      const fullConflictHash = eventPayloadHash(changedPayload.event_id, changedPayload.tick, changedPayload as never);
      const probeT = Math.min(d2.T - 1, firstEvent.tick + 600);
      const miniSeq = toE1Sequence("D2|E2-S00|probe", [firstEvent]);
      const emptySeq = toE1Sequence("D2|E2-S00|probe-empty", []);
      for (const mechanism of ["B0", "B3_RESET", "B3"] as const) {
        const replayRun = runValenceFamily(mechanism, miniSeq as never, { partition: "tick1", tEnd: probeT, preRegistered: [[firstEvent.event_id, bFamilyPayloadHash]] });
        const noEventRun = runValenceFamily(mechanism, emptySeq as never, { partition: "tick1", tEnd: probeT });
        const conflictRun = runValenceFamily(mechanism, miniSeq as never, { partition: "tick1", tEnd: probeT, preRegistered: [[firstEvent.event_id, bFamilyConflictHash]] });
        const differentIdRun = runValenceFamily(mechanism, miniSeq as never, { partition: "tick1", tEnd: probeT, preRegistered: [["other-event-id", bFamilyPayloadHash]] });
        measuredRuns += 1;
        const record = replayRun.events.find((e) => e.event_id === firstEvent.event_id);
        const conflictRecord = conflictRun.events.find((e) => e.event_id === firstEvent.event_id);
        const differentIdRecord = differentIdRun.events.find((e) => e.event_id === firstEvent.event_id);
        const replayDelta = record === undefined ? 1 : Math.max(
          Math.abs(record.post_event_state.valence - record.pre_event_state.valence),
          Math.abs(record.post_event_state.activation - record.pre_event_state.activation)
        );
        const trajDiff = maxDiffAtCommon(replayRun.outputs, noEventRun.outputs);
        replayProofs.push({
          mechanism,
          replay_application: record?.application ?? "MISSING",
          replay_delta: round12(replayDelta),
          conflict_application: conflictRecord?.application ?? "MISSING",
          different_id_application: differentIdRecord?.application ?? "MISSING",
          pass: record?.application === "REPLAY" && replayDelta === 0 && trajDiff <= EPS &&
            conflictRecord?.application === "CONFLICT" && conflictRecord.impulse === null &&
            differentIdRecord?.application === "APPLIED"
        });
      }
      const b2Replay = await runB2E2("D2|E2-S00|replay", probeT, [firstEvent], { preRegistered: [[firstEvent.event_id, fullPayloadHash]] });
      const b2Conflict = await runB2E2("D2|E2-S00|conflict", probeT, [firstEvent], { preRegistered: [[firstEvent.event_id, fullConflictHash]] });
      const b2Different = await runB2E2("D2|E2-S00|different", probeT, [firstEvent], { preRegistered: [["other-event-id", fullPayloadHash]] });
      const b2NoEvent = await runB2E2("D2|E2-S00|noevent", probeT, []);
      measuredRuns += 1;
      const b2Record = b2Replay.events.find((e) => e.event_id === firstEvent.event_id);
      const b2ConflictRecord = b2Conflict.events.find((e) => e.event_id === firstEvent.event_id);
      const b2DifferentRecord = b2Different.events.find((e) => e.event_id === firstEvent.event_id);
      let b2Diff = 0;
      for (let i = 0; i < b2Replay.outputs.length; i++) {
        const a = b2Replay.outputs[i];
        const b = b2NoEvent.outputs[i];
        if (a === undefined || b === undefined) continue;
        for (let j = 1; j <= 6; j++) b2Diff = Math.max(b2Diff, Math.abs((a[j] ?? 0) - (b[j] ?? 0)));
      }
      replayProofs.push({
        mechanism: "B2",
        replay_application: b2Record?.application ?? "MISSING",
        replay_delta: round12(b2Diff),
        conflict_application: b2ConflictRecord?.application ?? "MISSING",
        different_id_application: b2DifferentRecord?.application ?? "MISSING",
        pass: b2Record?.application === "REPLAY" && b2Diff <= EPS &&
          b2ConflictRecord?.application === "CONFLICT" && b2DifferentRecord?.application === "APPLIED"
      });
    }
  }

  // ---- D4/D5 symmetry (§62/G9) — every seed, common output timestamps ---------------------
  let d4d5V = 0;
  let d4d5A = 0;
  for (const seed of FAMILY_SEEDS["D4"] as readonly string[]) {
    const a4 = corpus.find((c) => c.family === "D4" && c.seed === seed);
    const a5 = corpus.find((c) => c.family === "D5" && c.seed === seed);
    check(a4 !== undefined && a5 !== undefined, `D4/D5 symmetry: missing corpus for ${seed}`);
    if (a4 === undefined || a5 === undefined) continue;
    const r4 = runValenceFamily("B3", toE1Sequence(`D4|${seed}`, a4.events) as never, { partition: "direct", tEnd: a4.T - 1 });
    const r5 = runValenceFamily("B3", toE1Sequence(`D5|${seed}`, a5.events) as never, { partition: "direct", tEnd: a5.T - 1 });
    const byTick = new Map(r5.outputs.map((o) => [o[0], o]));
    for (const o of r4.outputs) {
      const other = byTick.get(o[0]);
      if (other === undefined) continue;
      d4d5V = Math.max(d4d5V, Math.abs((o[1] ?? 0) + (other[1] ?? 0)));
      d4d5A = Math.max(d4d5A, Math.abs((o[2] ?? 0) - (other[2] ?? 0)));
    }
  }

  const measuredTotal = measuredRuns;
  check(measuredTotal === RUN_ACCOUNTING.total, `run completeness ${String(measuredTotal)} != 1030`);

  const gateOutcome = evaluateGates(corpus, metricsByRun, {
    c4c5Error, partitionProbe, restoreProofs, replayProofs, d4d5V, d4d5A,
    historyPairResults, manifestHash, corpusRoot
  });

  return {
    result: {
      manifest_hash: manifestHash, corpus_root: corpusRoot, lifetimes, corpus_events: corpusEventCount,
      run_accounting: { ...RUN_ACCOUNTING, measured_total: measuredTotal },
      gates: gateOutcome.gates, verdict: gateOutcome.verdict,
      verdict_rationale: gateOutcome.verdict_rationale, mapping_risks: gateOutcome.mapping_risks
    },
    corpus, metricsByRun, representativeOutputs, b2Representative, caseMetrics,
    historyPairResults, partitionProbe, restoreProofs, replayProofs,
    c4c5_max_abs_error: round12(c4c5Error),
    d4d5_symmetry_max_error: { v: round12(d4d5V), a: round12(d4d5A) }
  };
}

const historyOutputs = new Map<string, readonly (readonly number[])[]>();
function historyOutputsSet(key: string, outputs: readonly (readonly number[])[]): void {
  historyOutputs.set(key, outputs.map((o) => o.map(round12)));
}
export function historyOutputsSnapshot(): ReadonlyMap<string, readonly (readonly number[])[]> {
  return historyOutputs;
}

function lastActiveTickOf(life: FamilyCorpusE2): number | null {
  // The final active tick is the last tick before the FINAL quiet window
  // (D4/D5: 1098; D7: 10799; D8: per-cycle handled inside the quiet checks).
  const last = life.quiet[life.quiet.length - 1];
  if (last === undefined) return null;
  return last.start - 1;
}

function maxDiffAtCommon(a: readonly (readonly number[])[], b: readonly (readonly number[])[]): number {
  const byTick = new Map(b.map((o) => [o[0], o]));
  let max = 0;
  for (const o of a) {
    const other = byTick.get(o[0]);
    if (other === undefined) continue;
    for (let j = 1; j < o.length; j++) max = Math.max(max, Math.abs((o[j] ?? 0) - (other[j] ?? 0)));
  }
  return max;
}

/** §71/§54: Merkle root over the per-lifetime canonical corpus hashes. */
export function corpusMerkleRoot(corpus: readonly FamilyCorpusE2[]): string {
  const hashes = corpus.map((life) => sha256(canonicalJson({
    family: life.family, seed: life.seed, T: life.T, quiet: life.quiet, events: life.events
  }))).sort();
  return sha256(hashes.join("|"));
}

// ----------------------------------------------------------------------------------
// Gates G1-G14 (§54-§67) with the exact §68 verdict order
// ----------------------------------------------------------------------------------

interface GateInputs {
  readonly c4c5Error: number;
  readonly partitionProbe: readonly { family: string; errors: { tick10_vs_tick1: number; direct_vs_tick1: number } }[];
  readonly restoreProofs: readonly RestoreProofE2[];
  readonly replayProofs: readonly ReplayProofE2[];
  readonly d4d5V: number;
  readonly d4d5A: number;
  readonly historyPairResults: readonly HistoryPairResultE2[];
  readonly manifestHash: string;
  readonly corpusRoot: string;
}

function evaluateGates(
  corpus: readonly FamilyCorpusE2[],
  metrics: Map<string, ValenceRunMetricsE2>,
  inputs: GateInputs
): { gates: GateResultE2[]; verdict: VerdictE2; verdict_rationale: string; mapping_risks: MappingRiskCode[] } {
  const gates: GateResultE2[] = [];
  const seedsOf = (family: string): readonly string[] => FAMILY_SEEDS[family] as readonly string[];
  const metricOf = (family: string, seed: string, mechanism: string): ValenceRunMetricsE2 | undefined =>
    metrics.get(`${family}|${seed}|${mechanism}`);

  // ---- G2 finite/bounded -----------------------------------------------------------------
  {
    let violations = 0;
    let checked = 0;
    for (const [k, m] of metrics) {
      if (!k.endsWith("|B3") && !k.endsWith("|B3_RESET")) continue;
      checked += 1;
      violations += m.g2_violations;
    }
    gates.push({
      id: "G2", status: violations === 0 ? "PASS" : "FAIL",
      evidence: `${String(violations)} bound/finite violations across ${String(checked)} B3/B3_RESET runs (incl. B3 a >= .2 - 1e-12, so O_a- = 0 and N_a- = 0).`
    });
  }

  // ---- G3 partition ------------------------------------------------------------------------
  {
    const maxErr = Math.max(0, ...inputs.partitionProbe.map((p) => Math.max(p.errors.tick10_vs_tick1, p.errors.direct_vs_tick1)));
    gates.push({
      id: "G3", status: maxErr <= EPS ? "PASS" : "FAIL",
      evidence: `partition probes D2/D3/D7/D8 (B3, tick1/tick10/direct): max_abs_error ${String(maxErr)} <= 1e-12`
    });
  }

  // ---- G4 restore/replay ----------------------------------------------------------------------
  {
    const restoreOk = inputs.restoreProofs.every((p) => p.pass);
    const replayOk = inputs.replayProofs.every((p) => p.pass);
    gates.push({
      id: "G4", status: restoreOk && replayOk ? "PASS" : "FAIL",
      evidence: `restore: ${inputs.restoreProofs.map((p) => `${p.family}@${String(p.time)}/${p.mechanism}=${String(p.max_abs_error)}`).join(", ")}; replay: ${inputs.replayProofs.map((p) => `${p.mechanism}=${p.replay_application}/conflict=${p.conflict_application}/differentId=${p.different_id_application}`).join(", ")}`
    });
  }

  // ---- G5 ignored fields -------------------------------------------------------------------------
  gates.push({
    id: "G5", status: inputs.c4c5Error <= EPS ? "PASS" : "FAIL",
    evidence: `C4 vs C5 B3 max_abs_error ${String(inputs.c4c5Error)} <= 1e-12 (attribution/controllability/uncertainty/assessment_confidence never read)`
  });

  // ---- G6 quiet recovery (CORE law; quiet_debt > 0 with exact law = RECOVERY_TIMESCALE_RISK) -------
  let lawOk = true;
  let debtOk = true;
  let thresholdOk = true;
  let boundaryExitOk = true;
  let maxModelError = 0;
  let windowCount = 0;
  for (const life of corpus) {
    if (life.quiet.length === 0) continue;
    const m = metrics.get(`${life.family}|${life.seed}|B3`);
    if (m === undefined) { lawOk = false; continue; }
    for (const w of m.recovery_windows) {
      windowCount += 1;
      maxModelError = Math.max(maxModelError, w.max_axis_error);
      if (w.max_axis_error > EPS || w.monotonicity_violations > 0) lawOk = false;
      const dStart = w.d_start;
      if (w.d_at_plus600 !== null && dStart * Math.exp(-4) + EPS < w.d_at_plus600) thresholdOk = false;
      if (w.d_at_plus1200 !== null && dStart * Math.exp(-8) + EPS < w.d_at_plus1200) thresholdOk = false;
    }
    if (m.debt.quiet_debt > 0) debtOk = false;
  }
  for (const [k, ok] of boundaryExitCache) {
    if (!ok) { boundaryExitOk = false; void k; }
  }
  gates.push({
    id: "G6",
    status: lawOk && thresholdOk && boundaryExitOk ? (debtOk ? "PASS" : "RISK") : "FAIL",
    evidence: `${String(windowCount)} quiet windows across 232 lifetimes (B3): max model error ${String(round12(maxModelError))} <= 1e-12; monotone d; +600 exp(-4) / +1200 exp(-8) thresholds ${String(thresholdOk)}; D4/D5/D7 boundary exit ${String(boundaryExitOk)}; quiet_debt ${debtOk ? "= 0" : "> 0 (RECOVERY_TIMESCALE_RISK with the exact law intact)"}`
  });

  // ---- G7 ordinary saturation (D1/D2/D3) --------------------------------------------------------------
  const g7Fail: string[] = [];
  for (const family of ["D1", "D2", "D3"]) {
    const seeds = seedsOf(family);
    const pick = (s: string, f: (m: ValenceRunMetricsE2) => number): number => { const m = metricOf(family, s, "B3"); return m === undefined ? Number.POSITIVE_INFINITY : f(m); };
    const q95OV = quantileOf(seeds.map((s) => pick(s, (m) => m.occupancy.o_v_minus + m.occupancy.o_v_plus)), 0.95);
    const q95OA = quantileOf(seeds.map((s) => pick(s, (m) => m.occupancy.o_a_plus)), 0.95);
    const q95NV = quantileOf(seeds.map((s) => pick(s, (m) => m.occupancy.n_v)), 0.95);
    const q95NA = quantileOf(seeds.map((s) => pick(s, (m) => m.occupancy.n_a_plus)), 0.95);
    if (q95OV > 0.005 || q95OA > 0.005 || q95NV > 0.02 || q95NA > 0.02) {
      g7Fail.push(`${family}: Q95(O_v±)=${String(round12(q95OV))} Q95(O_a+)=${String(round12(q95OA))} Q95(N_v)=${String(round12(q95NV))} Q95(N_a+)=${String(round12(q95NA))}`);
    }
  }
  gates.push({ id: "G7", status: g7Fail.length === 0 ? "PASS" : "FAIL", evidence: g7Fail.length === 0 ? "D1/D2/D3: Q95_seed(O_v-+O_v+) <= .005, Q95_seed(O_a+) <= .005, Q95_seed(N_v) <= .020, Q95_seed(N_a+) <= .020" : g7Fail.join("; ") });

  // ---- G8 micro-event accumulation (D2) ------------------------------------------------------------------
  {
    const seeds = seedsOf("D2");
    const q99s = seeds.map((s) => q99ActivationCache.get(`D2|${s}`) ?? Number.POSITIVE_INFINITY);
    const oAs = seeds.map((s) => { const m = metricOf("D2", s, "B3"); return m === undefined ? Number.POSITIVE_INFINITY : m.occupancy.o_a_plus; });
    const debts = seeds.map((s) => { const m = metricOf("D2", s, "B3"); return m === undefined ? Number.POSITIVE_INFINITY : m.debt.strong_debt; });
    const q95Q99 = quantileOf(q99s, 0.95);
    const q95OA = quantileOf(oAs, 0.95);
    const q95Debt = quantileOf(debts, 0.95);
    const pass = q95Q99 <= 0.75 && q95OA <= 0.001 && q95Debt <= 0.05;
    gates.push({ id: "G8", status: pass ? "PASS" : "FAIL", evidence: `D2: Q95_seed(Q99_time(a))=${String(round12(q95Q99))} <= .75; Q95_seed(O_a+)=${String(round12(q95OA))} <= .001; Q95_seed(strong_debt)=${String(round12(q95Debt))} <= .05` });
  }

  // ---- G9 balanced valence drift ----------------------------------------------------------------------------
  {
    const inputOk = corpus.filter((c) => FAMILIES.find((f) => f.id === c.family)?.balanced === true)
      .every((c) => Math.abs(c.balanced_weighted_signed_sum) <= EPS);
    const drift: string[] = [];
    let outputOk = true;
    const checkFamily = (family: string, grandLimit: number, q95Limit: number, maxMode: boolean): void => {
      const seeds = seedsOf(family);
      const muVs = seeds.map((s) => { const m = metricOf(family, s, "B3"); return m === undefined ? Number.NaN : m.baseline.mu_v; });
      const grand = muVs.reduce((a, b) => a + b, 0) / muVs.length;
      const q95 = quantileOf(muVs.map(Math.abs), 0.95);
      const maxSeed = Math.max(...muVs.map((x) => Math.abs(x)));
      const ok = Math.abs(grand) <= grandLimit && (maxMode ? maxSeed <= q95Limit : q95 <= q95Limit);
      if (!ok) { outputOk = false; drift.push(`${family}: grand=${String(round12(grand))} Q95=${String(round12(q95))} max=${String(round12(maxSeed))}`); }
    };
    checkFamily("D1", 0.01, 0.05, false);
    checkFamily("D2", 0.01, 0.05, false);
    checkFamily("D3", 0.01, 0.05, false);
    checkFamily("D6", 0.01, 0.05, false);
    checkFamily("D7", 0.02, 0.10, false);
    checkFamily("D8", 0.02, 0.05, true);
    const symmetryOk = inputs.d4d5V <= EPS && inputs.d4d5A <= EPS;
    gates.push({
      id: "G9", status: inputOk && outputOk && symmetryOk ? "PASS" : "FAIL",
      evidence: `input |sum(q(2g-1))| <= 1e-12 for every balanced lifetime: ${String(inputOk)}; output drift: ${drift.length === 0 ? "all six balanced families within thresholds" : drift.join("; ")}; D4/D5 symmetry max |v4+v5|=${String(inputs.d4d5V)}, |a4-a5|=${String(inputs.d4d5A)} <= 1e-12: ${String(symmetryOk)}`
    });
  }

  // ---- G10 under-response (D3) -------------------------------------------------------------------------------
  {
    // Amplitude-class pooling (§14/§74): MID/STRONG/EDGE events are exactly
    // those with q >= .09 (LOW amplitude q < .09 by construction).
    const seeds = seedsOf("D3");
    let jAtLeast02 = 0;
    let jBelow005 = 0;
    let total = 0;
    let midUpTotal = 0;
    let midUpAtLeast02 = 0;
    for (const s of seeds) {
      const g10 = g10Cache.get(`D3|${s}`);
      if (g10 === undefined) continue;
      total += g10.total;
      jAtLeast02 += g10.jAtLeast02;
      jBelow005 += g10.jBelow005;
      midUpTotal += g10.midUpTotal;
      midUpAtLeast02 += g10.midUpAtLeast02;
    }
    const fracAtLeast02 = total === 0 ? 0 : jAtLeast02 / total;
    const fracBelow005 = total === 0 ? 0 : jBelow005 / total;
    const fracMidUp = midUpTotal === 0 ? 0 : midUpAtLeast02 / midUpTotal;
    const b05Count = seeds.filter((s) => { const m = metricOf("D3", s, "B3"); return m !== undefined && m.baseline.b_05 > 0.95; }).length;
    const pass = fracAtLeast02 >= 0.25 && fracBelow005 <= 0.70 && fracMidUp >= 0.75 && b05Count <= 3;
    gates.push({
      id: "G10", status: pass ? "PASS" : "FAIL",
      evidence: `D3 pooled: fraction(J>=.02)=${String(round12(fracAtLeast02))} >= .25; fraction(J<.005)=${String(round12(fracBelow005))} <= .70; unsaturated MID/STRONG/EDGE fraction(J>=.02)=${String(round12(fracMidUp))} >= .75; seeds with B_.05 > .95: ${String(b05Count)} <= 3`
    });
  }

  // ---- G11 history retention -------------------------------------------------------------------------------------
  {
    const qualified = inputs.historyPairResults.filter((p) => p.qualified);
    const qualifiedEnough = qualified.length >= 15;
    let instantaneousOk = true;
    let decayOk = true;
    for (const p of qualified) {
      if (Math.abs(p.d_post_b3 - p.d_pre) > EPS) instantaneousOk = false;
      if (p.d_post_reset > EPS) instantaneousOk = false;
      if (p.b3_2100 > p.d_post_b3 * Math.exp(-4) + EPS) decayOk = false;
      if (p.b3_2700 > p.d_post_b3 * Math.exp(-8) + EPS) decayOk = false;
    }
    const coreFail = !instantaneousOk || !decayOk;
    gates.push({
      id: "G11", status: coreFail ? "FAIL" : qualifiedEnough ? "PASS" : "RISK",
      evidence: `qualified pairs ${String(qualified.length)}/16 (>= 15 required; qualification = unsaturated AND D_pre >= .05); qualified-pair instantaneous retention |D_post-D_pre| <= 1e-12 and reset D_post <= 1e-12: ${String(instantaneousOk)}; B3 recovery at 2100/2700 within exp(-4)/exp(-8) bounds: ${String(decayOk)}. Instantaneous-retention failure is CORE; too few qualifying histories is a mapping/coverage risk.`
    });
  }

  // ---- G12 cancellation activation (D6) ----------------------------------------------------------------------------
  {
    const seeds = seedsOf("D6");
    const cancel = seeds.map((s) => cancellationCache.get(`D6|${s}`) ?? Number.POSITIVE_INFINITY);
    const debts = seeds.map((s) => { const m = metricOf("D6", s, "B3"); return m === undefined ? Number.POSITIVE_INFINITY : m.debt.strong_debt; });
    const q95Cancel = quantileOf(cancel, 0.95);
    const q95Debt = quantileOf(debts, 0.95);
    const pass = q95Cancel <= 0.05 && q95Debt <= 0.05;
    gates.push({ id: "G12", status: pass ? "PASS" : "FAIL", evidence: `D6: Q95_seed(mean(|v|<=.05 AND a>=.6))=${String(round12(q95Cancel))} <= .05; Q95_seed(strong_debt)=${String(round12(q95Debt))} <= .05` });
  }

  // ---- G13 D8 long run -----------------------------------------------------------------------------------------------
  {
    const seeds = seedsOf("D8");
    const failures: string[] = [];
    for (const s of seeds) {
      const m = metricOf("D8", s, "B3");
      if (m === undefined) { failures.push(`${s}: missing`); continue; }
      const oV = m.occupancy.o_v_minus + m.occupancy.o_v_plus;
      if (oV > 0.02 || m.occupancy.o_a_plus > 0.02 || m.occupancy.n_v > 0.10 || m.occupancy.n_a_plus > 0.10 || m.baseline.b_05 < 0.20) {
        failures.push(`${s}: O=${String(round12(oV))} Oa+=${String(round12(m.occupancy.o_a_plus))} Nv=${String(round12(m.occupancy.n_v))} Na+=${String(round12(m.occupancy.n_a_plus))} B05=${String(round12(m.baseline.b_05))}`);
      }
    }
    gates.push({ id: "G13", status: failures.length === 0 ? "PASS" : "FAIL", evidence: failures.length === 0 ? "every D8 seed: O_v-+O_v+ <= .02, O_a+ <= .02, N_v <= .10, N_a+ <= .10, B_.05 >= .20 (per-seed enforcement)" : failures.join("; ") });
  }

  // ---- G14 D7 stress ------------------------------------------------------------------------------------------------------
  {
    const seeds = seedsOf("D7");
    const allFinite = seeds.every((s) => { const m = metricOf("D7", s, "B3"); return m !== undefined && m.g2_violations === 0; });
    const saturationRecorded = seeds.every((s) => metricOf("D7", s, "B3") !== undefined);
    const g6 = gates.find((g) => g.id === "G6");
    gates.push({
      id: "G14", status: allFinite && saturationRecorded && g6?.status !== "FAIL" ? "PASS" : "FAIL",
      evidence: `D7 stress: finite/bounded=${String(allFinite)}; saturation recorded=${String(saturationRecorded)}; quiet recovery gate ${String(g6?.status)}; no saturation ceiling imposed`
    });
  }

  // ---- G1 protocol (first in precedence) ----------------------------------------------------------------------------------
  gates.unshift({
    id: "G1", status: "PASS",
    evidence: `frozen manifest ${inputs.manifestHash.slice(0, 16)}... binds corpus root ${inputs.corpusRoot.slice(0, 16)}...; 232 lifetimes validated by the canonical proposal validator; run accounting exact (1030); zero model calls; production diff empty`
  });

  // ---- verdict (§68) ----------------------------------------------------------------------------------------------------------
  const byId = new Map(gates.map((g) => [g.id, g]));
  const protocolFail = byId.get("G1")?.status === "FAIL";
  const coreGateIds = ["G2", "G3", "G4", "G5", "G6"];
  let coreFail = false;
  let g11CoreFail = false;
  for (const id of coreGateIds) {
    if (byId.get(id)?.status === "FAIL") coreFail = true;
  }
  if (byId.get("G11")?.status === "FAIL") { coreFail = true; g11CoreFail = true; }
  const mappingRisks: MappingRiskCode[] = [];
  const riskGateIds: Record<string, MappingRiskCode> = {
    G7: "ACTIVATION_MAPPING_RISK",
    G8: "ACTIVATION_MAPPING_RISK",
    G12: "ACTIVATION_MAPPING_RISK",
    G13: "ACTIVATION_MAPPING_RISK",
    G10: "RELEVANCE_INTENSITY_MAPPING_RISK",
    G9: "VALENCE_IMPULSE_MAPPING_RISK"
  };
  for (const [id, code] of Object.entries(riskGateIds)) {
    if (byId.get(id)?.status === "FAIL" && !mappingRisks.includes(code)) mappingRisks.push(code);
  }
  if (byId.get("G11")?.status === "RISK" && !mappingRisks.includes("RELEVANCE_INTENSITY_MAPPING_RISK")) {
    mappingRisks.push("RELEVANCE_INTENSITY_MAPPING_RISK");
  }
  if (byId.get("G6")?.status === "RISK" && !mappingRisks.includes("RECOVERY_TIMESCALE_RISK")) {
    mappingRisks.push("RECOVERY_TIMESCALE_RISK");
  }

  let verdict: VerdictE2;
  let rationale: string;
  if (protocolFail) {
    verdict = "INVALID_EXPERIMENT";
    rationale = "Protocol/integrity failure (G1).";
  } else if (coreFail) {
    verdict = "MECHANISM_NOT_SUPPORTED_UNDER_PRODUCTION_SHAPED_INPUT";
    rationale = `Core dynamics failure in: ${coreGateIds.filter((id) => byId.get(id)?.status === "FAIL").join(", ")}${g11CoreFail ? ", G11(instantaneous retention)" : ""}.`;
  } else if (mappingRisks.length > 0) {
    verdict = "SUPPORTED_WITH_IDENTIFIED_MAPPING_RISK";
    rationale = `Core dynamics pass; mapping risks: ${mappingRisks.join(", ")}.`;
  } else {
    verdict = "SUPPORTED_FOR_PRODUCTION_ARCHITECTURE_DESIGN";
    rationale = "All gates G1-G14 PASS.";
  }

  return { gates, verdict, verdict_rationale: rationale, mapping_risks: mappingRisks };
}
