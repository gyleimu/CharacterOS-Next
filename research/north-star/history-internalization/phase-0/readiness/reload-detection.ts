/**
 * MID-GATE RELOAD DETECTION — conformance correction (§2/§3).
 *
 * The frozen readiness predicate requires "no mid-run provider reload". The previous implementation
 * computed that as `every probe's pre-state equals probe 1's pre-state`, which conflates two
 * different events:
 *
 *   ALLOWED   the model starts UNLOADED, the FIRST planned probe causes exactly one initial load,
 *             and the same resident model then serves every remaining planned probe.
 *
 *   FORBIDDEN anything that happens AFTER the gate has begun, within the planned probe sequence:
 *             an unload, a re-load, a model replacement, a digest change, or a provider restart
 *             that reinitializes the model.
 *
 * This module implements the frozen semantics over a REAL observation timeline
 * (model-resident flag and model digest sampled immediately BEFORE and AFTER each planned probe).
 * It changes the executable interpretation only. The scientific predicate, the request bytes, the
 * request hash, the provider configuration and the timeout are untouched.
 */

export interface ReloadObservationV0 {
  /** Sample point, e.g. "probe_1:before". Diagnostics only. */
  readonly at: string;
  /** Was the model resident at this sample point? */
  readonly loaded: boolean;
  /** Model digest observed at this sample point, or null when it could not be read. */
  readonly digest: string | null;
}

export interface ReloadDetectionResultV0 {
  readonly mid_gate_reload: boolean;
  readonly reason: string;
  readonly transitions_observed: number;
  readonly unloads_observed: number;
  readonly loads_observed: number;
  readonly digest_changes_observed: number;
  /**
   * What this detector can and cannot see. Recorded so the criterion's reach is never overstated.
   */
  readonly detection_scope: string;
}

export function detectMidGateReloadV0(observations: readonly ReloadObservationV0[]): ReloadDetectionResultV0 {
  let transitions = 0;
  let unloads = 0;
  let loads = 0;
  let digestChanges = 0;
  let verdict: { mid_gate_reload: boolean; reason: string } | null = null;

  for (let index = 1; index < observations.length; index += 1) {
    const previous = observations[index - 1] as ReloadObservationV0;
    const current = observations[index] as ReloadObservationV0;

    if (previous.loaded !== current.loaded) {
      transitions += 1;
      if (previous.loaded && !current.loaded) {
        unloads += 1;
        // An observed unload after the gate began is forbidden, full stop.
        verdict ??= { mid_gate_reload: true, reason: `the model was UNLOADED at ${current.at} (observed after ${previous.at})` };
      } else {
        loads += 1;
      }
    }

    if (previous.digest !== null && current.digest !== null && previous.digest !== current.digest) {
      digestChanges += 1;
      verdict ??= { mid_gate_reload: true, reason: `the model digest CHANGED at ${current.at} (${previous.digest.slice(0, 12)}… → ${current.digest.slice(0, 12)}…)` };
    }
  }

  // More than one load transition means the model was loaded, then loaded AGAIN: a reload.
  if (verdict === null && loads > 1) {
    verdict = { mid_gate_reload: true, reason: `the model was loaded ${loads} times within the planned sequence — an initial load is allowed, a second load is a reload` };
  }

  return {
    mid_gate_reload: verdict !== null,
    reason: verdict?.reason ?? "at most one initial load; the same resident model served every remaining planned probe",
    transitions_observed: transitions,
    unloads_observed: unloads,
    loads_observed: loads,
    digest_changes_observed: digestChanges,
    detection_scope:
      "detects every unload and every digest change observable at the per-probe sample points, and any second load transition. It does NOT detect a silent unload-and-reload that completes entirely between two sample points while ending resident — that limitation is recorded rather than hidden."
  };
}

/** Convenience: builds the before/after timeline from per-probe samples. */
export function buildReloadTimelineV0(
  samples: readonly { readonly ordinal: number; readonly loadedBefore: boolean; readonly loadedAfter: boolean; readonly digestBefore: string | null; readonly digestAfter: string | null }[]
): ReloadObservationV0[] {
  return samples.flatMap((sample) => [
    { at: `probe_${sample.ordinal}:before`, loaded: sample.loadedBefore, digest: sample.digestBefore },
    { at: `probe_${sample.ordinal}:after`, loaded: sample.loadedAfter, digest: sample.digestAfter }
  ]);
}
