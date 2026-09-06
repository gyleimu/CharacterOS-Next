/**
 * STATE_RETENTION_AND_RECOVERY_E1 — deterministic metrics (§34).
 * All rules fixed in the manifest before any run; no adaptive logic.
 */

import { ACTIVATION_BOUNDS, BASELINE_STATE, SATURATION_EPSILON, SETTLING_TOLERANCE, VALENCE_BOUNDS } from "./contract.ts";
import type { ValenceRunE1 } from "./mechanisms.ts";

export interface ValenceMetricsE1 {
  readonly peak_valence: number;
  readonly min_valence: number;
  readonly peak_activation: number;
  readonly min_activation: number;
  readonly abs_peak_offset_valence: number;
  readonly abs_peak_offset_activation: number;
  readonly signed_valence_auc: number;
  readonly absolute_valence_offset_auc: number;
  readonly activation_excess_auc: number;
  /** Ticks after the last event to reach half the post-event distance. */
  readonly recovery_half_life_ticks: number | null;
  /** Ticks after the last event to settle within 1e-3 (and stay). */
  readonly settling_time_ticks: number | null;
  readonly saturation_fraction: number;
}

function trapezoid(times: readonly number[], values: readonly number[]): number {
  let total = 0;
  for (let i = 1; i < times.length; i++) {
    const t0 = times[i - 1];
    const t1 = times[i];
    const v0 = values[i - 1];
    const v1 = values[i];
    if (t0 === undefined || t1 === undefined || v0 === undefined || v1 === undefined) {
      throw new Error("metrics: malformed sample series");
    }
    total += ((v0 + v1) / 2) * (t1 - t0);
  }
  return total;
}

export function distanceToBaseline(state: { readonly valence: number; readonly activation: number }): number {
  return Math.max(
    Math.abs(state.valence - BASELINE_STATE.valence),
    Math.abs(state.activation - BASELINE_STATE.activation)
  );
}

export function computeValenceMetrics(run: ValenceRunE1): ValenceMetricsE1 {
  const outputs = run.outputs;
  const times = outputs.map((o) => o[0]);
  const valences = outputs.map((o) => o[1]);
  const activations = outputs.map((o) => o[2]);
  const valenceOffsets = valences.map((v) => v - BASELINE_STATE.valence);
  const activationExcess = activations.map((a) => Math.max(0, a - BASELINE_STATE.activation));
  const distances = outputs.map((o) =>
    distanceToBaseline({ valence: o[1] ?? 0, activation: o[2] ?? 0 })
  );

  const appliedEvents = run.events.filter((e) => e.application === "APPLIED");
  const lastEventTime = appliedEvents.length === 0
    ? null
    : Math.max(...appliedEvents.map((e) => e.time));

  let halfLife: number | null = null;
  let settling: number | null = null;
  if (lastEventTime !== null) {
    const lastIndex = times.lastIndexOf(lastEventTime);
    const d0 = distances[lastIndex];
    if (d0 !== undefined && d0 > 0) {
      const half = d0 / 2;
      for (let i = lastIndex; i < times.length; i++) {
        const t = times[i];
        const d = distances[i];
        if (t !== undefined && d !== undefined && t > lastEventTime && d <= half) {
          halfLife = t - lastEventTime;
          break;
        }
      }
    }
    if (d0 !== undefined && d0 > SETTLING_TOLERANCE) {
      for (let i = lastIndex; i < times.length; i++) {
        const t = times[i];
        const d = distances[i];
        if (t === undefined || d === undefined) continue;
        if (t > lastEventTime && d <= SETTLING_TOLERANCE) {
          const tail = distances.slice(i);
          if (tail.every((x) => x !== undefined && x <= SETTLING_TOLERANCE)) {
            settling = t - lastEventTime;
            break;
          }
        }
      }
    }
  }

  const [vLow, vHigh] = VALENCE_BOUNDS;
  const [aLow, aHigh] = ACTIVATION_BOUNDS;
  const saturated = outputs.filter((o) =>
    (o[1] ?? 0) <= vLow + SATURATION_EPSILON || (o[1] ?? 0) >= vHigh - SATURATION_EPSILON ||
    (o[2] ?? 0) <= aLow + SATURATION_EPSILON || (o[2] ?? 0) >= aHigh - SATURATION_EPSILON
  ).length;

  return {
    peak_valence: Math.max(...valences),
    min_valence: Math.min(...valences),
    peak_activation: Math.max(...activations),
    min_activation: Math.min(...activations),
    abs_peak_offset_valence: Math.max(...valenceOffsets.map(Math.abs)),
    abs_peak_offset_activation: Math.max(...activations.map((a) => Math.abs(a - BASELINE_STATE.activation))),
    signed_valence_auc: trapezoid(times, valenceOffsets),
    absolute_valence_offset_auc: trapezoid(times, valenceOffsets.map(Math.abs)),
    activation_excess_auc: trapezoid(times, activationExcess),
    recovery_half_life_ticks: halfLife,
    settling_time_ticks: settling,
    saturation_fraction: saturated / outputs.length
  };
}

/** Divergence series between two same-mechanism runs (S5 A vs B). */
export function divergenceSeries(
  runA: ValenceRunE1,
  runB: ValenceRunE1
): readonly { readonly t: number; readonly delta_valence: number; readonly delta_activation: number }[] {
  const bByTime = new Map(runB.outputs.map((o) => [o[0], o]));
  const series: { t: number; delta_valence: number; delta_activation: number }[] = [];
  for (const o of runA.outputs) {
    const other = bByTime.get(o[0]);
    if (other === undefined) continue;
    series.push({ t: o[0], delta_valence: (o[1] ?? 0) - (other[1] ?? 0), delta_activation: (o[2] ?? 0) - (other[2] ?? 0) });
  }
  return series;
}

/** Max absolute output difference across two partition runs at common timestamps. */
export function partitionError(
  runs: readonly { readonly outputs: readonly (readonly number[])[] }[]
): { readonly common_timestamps: number; readonly max_abs_error: number } {
  if (runs.length < 2) return { common_timestamps: 0, max_abs_error: 0 };
  let maxError = 0;
  let common = 0;
  const base = runs[0];
  if (base === undefined) return { common_timestamps: 0, max_abs_error: 0 };
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
