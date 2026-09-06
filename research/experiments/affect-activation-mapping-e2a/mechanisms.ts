/**
 * ACTIVATION_MAPPING_ABLATION_E2A — variant mechanism runner.
 *
 * Reuses the frozen E1 law primitives (recover, clampState, impulseOf,
 * ApplicationRegistry, eventPayloadHash) — never reimplemented. The ONLY
 * per-variant difference is the activation gain: u_a = activationGain * q
 * instead of the frozen .20q. Everything else (baseline, tau, u_v, event
 * order law, bounds, recovery, clamping) is byte-identical; the conformance
 * suite machine-checks that the A20 variant reproduces the E1/E2 engine
 * within 1e-12 (no dependency drift).
 */

import type { AppraisalEventE2 } from "../affect-production-shaped-e2/contract.ts";
import {
  clampState, impulseOf, recover,
  ApplicationRegistry, type ApplicationResultE1, type ImpulseE1, type SaturationEventE1
} from "../affect-state-retention-e1/mechanisms.ts";
import { eventPayloadHash } from "../affect-state-retention-e1/fixtures.ts";
import { BASELINE_STATE, VARIANTS } from "./contract.ts";
import { check } from "./fixtures.ts";

export type VariantId = "A0" | "A10" | "A20";
export type PartitionStrategyE2A = "tick1" | "tick10" | "direct";

export interface EventRecordE2A {
  readonly event_id: string;
  readonly time: number;
  readonly payload_hash: string;
  readonly application: ApplicationResultE1;
  readonly impulse: ImpulseE1 | null;
  /** The variant's actual activation impulse (activationGain * u_a). */
  readonly u_a_variant: number | null;
  readonly delta_a: number | null;
  readonly q: number | null;
  readonly clamped: boolean;
  readonly pre_event_state: { readonly valence: number; readonly activation: number };
  readonly post_event_state: { readonly valence: number; readonly activation: number };
  readonly saturation: readonly SaturationEventE1[];
}

export interface VariantRunE2A {
  readonly variant: VariantId;
  readonly corpus_id: string;
  readonly partition: PartitionStrategyE2A;
  readonly t_end: number;
  readonly outputs: readonly (readonly [number, number, number])[];
  readonly events: readonly EventRecordE2A[];
}

function chunkFor(partition: PartitionStrategyE2A): number | null {
  return partition === "tick1" ? 1 : partition === "tick10" ? 10 : null;
}

function advanceAnchored(state: { valence: number; activation: number }, dt: number, partition: PartitionStrategyE2A): { valence: number; activation: number } {
  const chunk = chunkFor(partition);
  if (chunk === null || dt <= chunk) return recover(state, dt);
  let current = state;
  let remaining = dt;
  while (remaining > 0) {
    const step = Math.min(chunk, remaining);
    current = recover(current, step);
    remaining -= step;
  }
  return current;
}

function readAt(anchor: { valence: number; activation: number }, anchorTime: number, t: number): { valence: number; activation: number } {
  return t === anchorTime ? anchor : recover(anchor, t - anchorTime);
}

export interface RunOptionsE2A {
  readonly partition?: PartitionStrategyE2A;
  readonly tEnd: number;
  readonly preRegistered?: readonly (readonly [string, string])[];
  readonly resumeFrom?: {
    readonly anchor_time: number;
    readonly anchor_state: { readonly valence: number; readonly activation: number };
    readonly registry: readonly (readonly [string, string])[];
  };
}

/** Runs one variant over one E2 corpus slice (the §19 event order law). */
export function runVariantE2A(
  variant: VariantId,
  activationGain: number,
  corpusId: string,
  events: readonly AppraisalEventE2[],
  options: RunOptionsE2A
): VariantRunE2A {
  const partition = options.partition ?? "tick1";
  const tEnd = options.tEnd;
  const sorted = [...events].sort((a, b) => a.tick - b.tick);
  const resume = options.resumeFrom;
  const registry = new ApplicationRegistry();
  if (options.preRegistered !== undefined) registry.restoreState(options.preRegistered);
  let anchor: { valence: number; activation: number };
  let anchorTime: number;
  if (resume === undefined) {
    anchor = { ...BASELINE_STATE };
    anchorTime = 0;
  } else {
    anchor = { ...resume.anchor_state };
    anchorTime = resume.anchor_time;
    registry.restoreState(resume.registry);
  }
  const historyCutoff = resume === undefined ? -1 : anchorTime;
  const futureEvents = sorted.filter((e) => e.tick > historyCutoff && e.tick <= tEnd);

  const outputTimes: number[] = [];
  if (partition === "tick1") {
    for (let t = anchorTime; t <= tEnd; t++) outputTimes.push(t);
  } else if (partition === "tick10") {
    for (let t = Math.ceil(anchorTime / 10) * 10; t <= tEnd; t += 10) outputTimes.push(t);
    for (const e of futureEvents) if (!outputTimes.includes(e.tick)) outputTimes.push(e.tick);
    if (!outputTimes.includes(tEnd)) outputTimes.push(tEnd);
  } else {
    outputTimes.push(anchorTime);
    for (const e of futureEvents) if (!outputTimes.includes(e.tick)) outputTimes.push(e.tick);
    if (!outputTimes.includes(tEnd)) outputTimes.push(tEnd);
  }
  outputTimes.sort((a, b) => a - b);

  const outputs: [number, number, number][] = [];
  const records: EventRecordE2A[] = [];
  const eventTimes = new Set(futureEvents.map((e) => e.tick));

  for (const t of outputTimes) {
    if (t > anchorTime) {
      anchor = advanceAnchored(anchor, t - anchorTime, partition);
      anchorTime = t;
    }
    if (eventTimes.has(t)) {
      for (const scheduled of futureEvents.filter((e) => e.tick === t)) {
        const pre = readAt(anchor, anchorTime, t);
        const payloadHash = eventPayloadHash(scheduled.event_id, scheduled.tick, { relevance: scheduled.relevance, goal_congruence: scheduled.goal_congruence, attribution: scheduled.attribution, controllability: scheduled.controllability, uncertainty: scheduled.uncertainty, intensity: scheduled.intensity } as never);
        const application = registry.verdict(scheduled.event_id, payloadHash);
        let impulse: ImpulseE1 | null = null;
        let uAVariant: number | null = null;
        let deltaA: number | null = null;
        let clamped = false;
        let post = pre;
        let saturation: readonly SaturationEventE1[] = [];
        if (application === "APPLIED") {
          registry.register(scheduled.event_id, payloadHash);
          impulse = impulseOf({
            relevance: scheduled.relevance, goal_congruence: scheduled.goal_congruence,
            attribution: scheduled.attribution, controllability: scheduled.controllability,
            uncertainty: scheduled.uncertainty, intensity: scheduled.intensity
          });
          // u_a = activationGain * q (ABSOLUTE gain per the frozen §3 variants;
          // A20 = .20q reproduces the E1/E2 law exactly). The E1 impulseOf
          // already embeds the .20 gain, so recompute from q — never re-scale it.
          uAVariant = activationGain * impulse.q;
          // §3/§4 single factor: ONLY u_a scales; u_v is the frozen law.
          const candidate = {
            valence: pre.valence + impulse.u_v,
            activation: pre.activation + uAVariant
          };
          const clampedState = clampState(candidate, t);
          post = clampedState.state;
          saturation = clampedState.saturation;
          clamped = saturation.length > 0;
          deltaA = post.activation - pre.activation;
          anchor = post;
        }
        records.push({
          event_id: scheduled.event_id, time: t, payload_hash: payloadHash, application,
          impulse, u_a_variant: uAVariant, delta_a: deltaA, q: impulse?.q ?? null, clamped,
          pre_event_state: pre, post_event_state: post, saturation
        });
      }
    }
    {
      const s = readAt(anchor, anchorTime, t);
      outputs.push([t, s.valence, s.activation]);
    }
  }
  return { variant, corpus_id: corpusId, partition, t_end: tEnd, outputs, events: records };
}

// ----------------------------------------------------------------------------------
// §23 restore serialization (anchored state + registry, no historical replay)
// ----------------------------------------------------------------------------------

export interface VariantSnapshotE2A {
  readonly variant: VariantId;
  readonly corpus_id: string;
  readonly anchor_time: number;
  readonly anchor_state: { readonly valence: number; readonly activation: number };
  readonly registry: readonly (readonly [string, string])[];
}

export function serializeVariantRun(variant: VariantId, activationGain: number, corpusId: string, events: readonly AppraisalEventE2[], anchorTime: number): VariantSnapshotE2A {
  const partial = runVariantE2A(variant, activationGain, corpusId, events, { partition: "tick1", tEnd: anchorTime });
  const last = partial.outputs[partial.outputs.length - 1];
  check(last !== undefined && last[0] === anchorTime, `serialize: anchor time ${anchorTime} must be an output`);
  const lastSample = last as readonly [number, number, number];
  const registry = new ApplicationRegistry();
  for (const record of partial.events) {
    if (record.application === "APPLIED") registry.register(record.event_id, record.payload_hash);
  }
  return {
    variant, corpus_id: corpusId, anchor_time: anchorTime,
    anchor_state: { valence: lastSample[1], activation: lastSample[2] },
    registry: registry.exportState()
  };
}

export function continueVariantRun(snapshot: VariantSnapshotE2A, events: readonly AppraisalEventE2[], tEnd: number): VariantRunE2A {
  const variant = VARIANTS.find((v) => v.id === snapshot.variant);
  check(variant !== undefined, `restore: unknown variant ${snapshot.variant}`);
  const resolved = variant as { id: VariantId; activationGain: number };
  return runVariantE2A(resolved.id, resolved.activationGain, snapshot.corpus_id, events, {
    partition: "tick1", tEnd,
    resumeFrom: { anchor_time: snapshot.anchor_time, anchor_state: snapshot.anchor_state, registry: snapshot.registry }
  });
}
