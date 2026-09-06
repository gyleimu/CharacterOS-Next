/**
 * PRODUCTION_SHAPED_APPRAISAL_DYNAMICS_E2 — deterministic metrics (§39-§53).
 * All rules frozen in the manifest; nearest-rank quantiles, no interpolation;
 * streaming-friendly (single pass over tick-ordered samples).
 */

import { Q_BUCKETS, type QuietWindowE2 } from "./contract.ts";
import { check } from "./fixtures.ts";
import type { AppraisalEventE2 } from "./contract.ts";

export type Sample = readonly [number, number, number]; // [t, valence, activation]

export function quantileNearestRank(values: readonly number[], p: number): number {
  check(values.length > 0, "quantile of empty series");
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil(p * sorted.length) - 1;
  const v = sorted[Math.max(0, Math.min(sorted.length - 1, index))];
  check(v !== undefined, "quantile index");
  return v;
}

export function distanceToBaseline(v: number, a: number): number {
  return Math.max(Math.abs(v), Math.abs(a - 0.2));
}

export interface OccupancyMetricsE2 {
  readonly o_v_minus: number;
  readonly o_v_plus: number;
  readonly o_a_minus: number;
  readonly o_a_plus: number;
  readonly n_v: number;
  readonly n_a_plus: number;
  readonly n_a_minus: number;
}

const EPS = 1e-12;

export function occupancyMetrics(samples: readonly Sample[]): OccupancyMetricsE2 {
  let oVm = 0, oVp = 0, oAm = 0, oAp = 0, nV = 0, nAp = 0, nAm = 0;
  for (const s of samples) {
    const v = s[1];
    const a = s[2];
    if (v === undefined || a === undefined) throw new Error("metrics: malformed sample");
    if (v <= -1 + EPS) oVm += 1;
    if (v >= 1 - EPS) oVp += 1;
    if (a <= EPS) oAm += 1;
    if (a >= 1 - EPS) oAp += 1;
    if (Math.abs(v) >= 0.9) nV += 1;
    if (a >= 0.9) nAp += 1;
    if (a <= 0.1) nAm += 1;
  }
  const n = samples.length;
  return { o_v_minus: oVm / n, o_v_plus: oVp / n, o_a_minus: oAm / n, o_a_plus: oAp / n, n_v: nV / n, n_a_plus: nAp / n, n_a_minus: nAm / n };
}

export interface BaselineMetricsE2 {
  readonly q50_d: number;
  readonly q90_d: number;
  readonly q99_d: number;
  readonly b_05: number;
  readonly mu_v: number;
}

export function baselineMetrics(samples: readonly Sample[]): BaselineMetricsE2 {
  const distances = samples.map((s) => distanceToBaseline(s[1], s[2]));
  let vSum = 0;
  for (const s of samples) vSum += s[1];
  return {
    q50_d: quantileNearestRank(distances, 0.5),
    q90_d: quantileNearestRank(distances, 0.9),
    q99_d: quantileNearestRank(distances, 0.99),
    b_05: distances.filter((d) => d <= 0.05).length / samples.length,
    mu_v: vSum / samples.length
  };
}

export interface SaturationEpisodesE2 {
  readonly count: number;
  readonly max_duration: number;
  readonly p95_duration: number;
}

/** §48: exact-bound predicate, maximal contiguous sampled intervals. */
export function saturationEpisodes(samples: readonly Sample[]): SaturationEpisodesE2 {
  const durations: number[] = [];
  let current = 0;
  const atBound = (s: Sample): boolean => {
    const v = s[1];
    const a = s[2];
    return v <= -1 + EPS || v >= 1 - EPS || a <= EPS || a >= 1 - EPS;
  };
  for (const s of samples) {
    if (atBound(s)) current += 1;
    else if (current > 0) { durations.push(current); current = 0; }
  }
  if (current > 0) durations.push(current);
  return {
    count: durations.length,
    max_duration: durations.length === 0 ? 0 : Math.max(...durations),
    p95_duration: durations.length === 0 ? 0 : quantileNearestRank(durations, 0.95)
  };
}

// ----------------------------------------------------------------------------------
// §44/§49 event sensitivity and sparsity
// ----------------------------------------------------------------------------------

export interface EventSensitivityInputE2 {
  readonly event_id: string;
  readonly q: number;
  readonly j: number;
  readonly clamped: boolean;
}

export interface SensitivityBucketE2 {
  readonly bucket: string;
  readonly count: number;
  readonly median_j: number;
  readonly p90_j: number;
  readonly clamp_fraction: number;
  readonly fraction_below_005: number;
  readonly fraction_at_least_02: number;
}


export function sensitivityBuckets(events: readonly EventSensitivityInputE2[]): readonly SensitivityBucketE2[] {
  return Q_BUCKETS.map(([lo, hi]) => {
    const inBucket = events.filter((e) => e.q >= lo && (lo === 0.36 ? e.q <= 1 : e.q < hi));
    const js = inBucket.map((e) => e.j);
    return {
      bucket: `${lo}-${hi}`,
      count: inBucket.length,
      median_j: js.length === 0 ? 0 : quantileNearestRank(js, 0.5),
      p90_j: js.length === 0 ? 0 : quantileNearestRank(js, 0.9),
      clamp_fraction: inBucket.length === 0 ? 0 : inBucket.filter((e) => e.clamped).length / inBucket.length,
      fraction_below_005: inBucket.length === 0 ? 0 : inBucket.filter((e) => e.j < 0.005).length / inBucket.length,
      fraction_at_least_02: inBucket.length === 0 ? 0 : inBucket.filter((e) => e.j >= 0.02).length / inBucket.length
    };
  });
}

export function stateChangeSparsity(events: readonly EventSensitivityInputE2[]): readonly {
  readonly bucket: string; readonly below_005: number; readonly mid: number; readonly at_least_02: number;
}[] {
  return Q_BUCKETS.map(([lo, hi]) => {
    const inBucket = events.filter((e) => e.q >= lo && (lo === 0.36 ? e.q <= 1 : e.q < hi));
    const n = inBucket.length;
    return {
      bucket: `${lo}-${hi}`,
      below_005: n === 0 ? 0 : inBucket.filter((e) => e.j < 0.005).length / n,
      mid: n === 0 ? 0 : inBucket.filter((e) => e.j >= 0.005 && e.j < 0.02).length / n,
      at_least_02: n === 0 ? 0 : inBucket.filter((e) => e.j >= 0.02).length / n
    };
  });
}

// ----------------------------------------------------------------------------------
// §45 unsaturated gain checks
// ----------------------------------------------------------------------------------

export interface GainCheckE2 {
  readonly count: number;
  readonly max_abs_error_delta_a_over_q: number;
  readonly max_abs_error_delta_v_over_signed: number;
}

export function gainChecks(
  events: readonly { q: number; delta_v: number; delta_a: number; signed_denominator: number; unsaturated: boolean }[]
): GainCheckE2 {
  let count = 0;
  let maxA = 0;
  let maxV = 0;
  for (const e of events) {
    if (!e.unsaturated || e.q === 0) continue;
    count += 1;
    maxA = Math.max(maxA, Math.abs(e.delta_a / e.q - 0.2));
    if (Math.abs(e.signed_denominator) > 0) {
      maxV = Math.max(maxV, Math.abs(e.delta_v / e.signed_denominator - 0.25));
    }
  }
  return { count, max_abs_error_delta_a_over_q: maxA, max_abs_error_delta_v_over_signed: maxV };
}

// ----------------------------------------------------------------------------------
// §46 activation debt
// ----------------------------------------------------------------------------------

export interface DebtMetricsE2 {
  readonly strong_debt: number;
  readonly quiet_debt: number;
}

/**
 * Exact boundary semantics (§46, documented):
 * - strong_debt tick predicate: a >= .4 AND (t - t_latest_strong) >= 300 where
 *   t_latest_strong is the latest event tick with q >= .25 and
 *   t_latest_strong = -1 when no such event exists (so ticks_since = t + 1);
 *   an event AT t is 0 ticks ago.
 * - quiet_debt tick predicate: a - .2 > .02 + 1e-12 AND no event tick in
 *   (t - 600, t] (an event at t itself counts as recent).
 */
export function activationDebt(samples: readonly Sample[], events: readonly AppraisalEventE2[]): DebtMetricsE2 {
  const strongTicks = events.filter((e) => e.relevance * e.intensity >= 0.25).map((e) => e.tick).sort((a, b) => a - b);
  const allTicks = events.map((e) => e.tick).sort((a, b) => a - b);
  let strongIndex = 0;
  let quietIndex = 0;
  let strong = 0;
  let quiet = 0;
  for (const s of samples) {
    const t = s[0];
    const a = s[2];
    if (t === undefined || a === undefined) throw new Error("metrics: malformed sample");
    while (strongIndex < strongTicks.length && (strongTicks[strongIndex] as number) <= t) strongIndex += 1;
    const latestStrong = strongIndex === 0 ? -1 : strongTicks[strongIndex - 1] as number;
    if (a >= 0.4 && (t - latestStrong) >= 300) strong += 1;
    while (quietIndex < allTicks.length && (allTicks[quietIndex] as number) <= t) quietIndex += 1;
    // no event in (t-600, t]: the latest event at or before t must be > t-600.
    const hasRecent = quietIndex > 0 && (allTicks[quietIndex - 1] as number) > t - 600;
    if (a - 0.2 > 0.02 + EPS && !hasRecent) quiet += 1;
  }
  return { strong_debt: strong / samples.length, quiet_debt: quiet / samples.length };
}

// ----------------------------------------------------------------------------------
// §50 recovery windows
// ----------------------------------------------------------------------------------

export interface RecoveryWindowResultE2 {
  readonly start: number;
  readonly end: number;
  readonly d_start: number;
  readonly max_axis_error: number;
  readonly monotonicity_violations: number;
  readonly d_ratio_end_over_start: number | null;
  readonly d_at_plus600: number | null;
  readonly d_at_plus1200: number | null;
}

export function recoveryWindows(samples: readonly Sample[], windows: readonly QuietWindowE2[]): readonly RecoveryWindowResultE2[] {
  const byTick = new Map(samples.map((s) => [s[0], s]));
  const results: RecoveryWindowResultE2[] = [];
  for (const w of windows) {
    const startSample = byTick.get(w.start);
    check(startSample !== undefined, `recovery window ${w.start}: no sample at window start`);
    if (startSample === undefined) continue;
    const vS = startSample[1];
    const aS = startSample[2];
    let maxError = 0;
    let violations = 0;
    let dPrev = distanceToBaseline(vS, aS);
    let dEnd = dPrev;
    // +600/+1200 thresholds are evaluated ONLY inside the quiet window:
    // beyond the window an event may lawfully fire and reset the distance.
    const dAt = (tick: number): number | null => {
      if (tick > w.end) return null;
      const s = byTick.get(tick);
      return s === undefined ? null : distanceToBaseline(s[1], s[2]);
    };
    for (let t = w.start; t <= w.end; t++) {
      const actual = byTick.get(t);
      if (actual === undefined) continue;
      const factor = Math.exp(-(t - w.start) / 150);
      const expectedV = vS * factor;
      const expectedA = 0.2 + (aS - 0.2) * factor;
      maxError = Math.max(maxError, Math.abs(actual[1] - expectedV), Math.abs(actual[2] - expectedA));
      const d = distanceToBaseline(actual[1], actual[2]);
      if (t > w.start && d > dPrev + 1e-15) violations += 1;
      dPrev = d;
      dEnd = d;
    }
    const dStart = distanceToBaseline(vS, aS);
    results.push({
      start: w.start, end: w.end, d_start: dStart,
      max_axis_error: maxError, monotonicity_violations: violations,
      d_ratio_end_over_start: dStart > 0 ? dEnd / dStart : null,
      d_at_plus600: dAt(w.start + 600),
      d_at_plus1200: dAt(w.start + 1200)
    });
  }
  return results;
}

// ----------------------------------------------------------------------------------
// §51 activation load reconstruction
// ----------------------------------------------------------------------------------

/**
 * After the latest activation-clamp anchor s (or tick 0 if never clamped):
 *   a_t - .2 = (a_s - .2) * exp(-(t-s)/150) + .20 * sum(q_i * exp(-(t-t_i)/150))
 * evaluated incrementally over the final clamp-free stretch. Exact for B3
 * (activation impulses never clamp below the anchor within the stretch).
 */
export function activationReconstruction(
  samples: readonly Sample[],
  events: readonly { tick: number; q: number }[]
): { readonly anchor_tick: number; readonly max_abs_error: number; readonly covered_ticks: number } {
  let anchorTick = 0;
  let anchorOffset = 0;
  for (const s of samples) {
    if ((s[2] ?? 0) >= 1 - EPS) { anchorTick = s[0]; anchorOffset = (s[2] ?? 0) - 0.2; }
  }
  // incremental discounted q mass after the anchor
  const eventsAfter = events.filter((e) => e.tick > anchorTick).sort((a, b) => a.tick - b.tick);
  let mass = 0;
  let cursor = anchorTick;
  let maxError = 0;
  let covered = 0;
  const decay = Math.exp(-1 / 150);
  const byTick = new Map(samples.map((s) => [s[0], s]));
  let eventIndex = 0;
  for (let t = anchorTick; t <= (samples[samples.length - 1]?.[0] ?? 0); t++) {
    const gap = t - cursor;
    if (gap > 0) { mass *= Math.pow(decay, gap); cursor = t; }
    while (eventIndex < eventsAfter.length && (eventsAfter[eventIndex]?.tick ?? Number.POSITIVE_INFINITY) <= t) {
      const ev = eventsAfter[eventIndex];
      if (ev !== undefined && ev.tick === t) mass += ev.q;
      eventIndex += 1;
    }
    if (t > anchorTick) {
      const actual = byTick.get(t);
      if (actual === undefined) continue;
      const predicted = anchorOffset * Math.exp(-(t - anchorTick) / 150) + 0.2 * mass;
      maxError = Math.max(maxError, Math.abs((actual[2] - 0.2) - predicted));
      covered += 1;
    }
  }
  return { anchor_tick: anchorTick, max_abs_error: maxError, covered_ticks: covered };
}

// ----------------------------------------------------------------------------------
// §52 path dependence
// ----------------------------------------------------------------------------------

export function stateAt(samples: readonly Sample[], tick: number): { readonly valence: number; readonly activation: number } | null {
  const s = samples.find((x) => x[0] === tick);
  return s === undefined ? null : { valence: s[1] ?? 0, activation: s[2] ?? 0 };
}

export function infNormDiff(
  x: { readonly valence: number; readonly activation: number },
  y: { readonly valence: number; readonly activation: number }
): number {
  return Math.max(Math.abs(x.valence - y.valence), Math.abs(x.activation - y.activation));
}

/** §35: max absolute difference across partition runs at common timestamps. */
export function partitionError(
  runs: readonly { readonly outputs: readonly (readonly number[])[] }[]
): { readonly common_timestamps: number; readonly max_abs_error: number } {
  const base = runs[0];
  if (runs.length < 2 || base === undefined) return { common_timestamps: 0, max_abs_error: 0 };
  let maxError = 0;
  let common = 0;
  for (const o of base.outputs) {
    const t = o[0];
    if (t === undefined) continue;
    let present = true;
    for (const run of runs.slice(1)) {
      if (!run.outputs.some((x) => x[0] === t)) present = false;
    }
    if (!present) continue;
    common += 1;
    for (const run of runs) {
      const match = run.outputs.find((x) => x[0] === t);
      if (match === undefined) continue;
      for (let i = 1; i < o.length; i++) {
        const a = o[i];
        const b = match[i];
        if (a === undefined || b === undefined) continue;
        maxError = Math.max(maxError, Math.abs(a - b));
      }
    }
  }
  return { common_timestamps: common, max_abs_error: maxError };
}
