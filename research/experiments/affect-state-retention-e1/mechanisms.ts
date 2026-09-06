/**
 * STATE_RETENTION_AND_RECOVERY_E1 — mechanism implementations.
 *
 * B0/B1/B3_RESET/B3 share the §7 experimental valence/activation state, the
 * §11 frozen impulse mapping, the §12 exponential recovery law, the §13
 * deterministic clamp and the §19 event order law. They differ ONLY in
 * event-time state retention (§38): B3 reads the recovered pre-event state;
 * B3_RESET/B1 apply clamp(b + u); B0 ignores events entirely.
 *
 * B2 drives the FROZEN production FAST_EMA_V0 reference producer untouched,
 * in its native representation. It is a contextual baseline; no
 * cross-representation numeric comparison is used for inference.
 *
 * Time partition law (§20/§33): internal time advances in partition-specific
 * decompositions (1-tick steps / 10-tick steps / direct closed-form jumps);
 * every output is a read-only closed-form evaluation from the current anchor.
 * No sample ever advances experiment time.
 */

/* eslint-disable no-restricted-imports -- Isolated research experiment host over frozen built roots (v1 convention). */

import type { SubjectStateV0 } from "../../../packages/subject-core/dist/index.js";
import { ReferenceFastEmaAffectProducer } from "../../../packages/runtime/dist/index.js";
import type { AppraisalFixtureE1, AffectStateE1, ScheduledEventE1, SequenceE1 } from "./contract.ts";
import {
  ACTIVATION_BOUNDS, BASELINE_STATE, SATURATION_EPSILON, TAU, VALENCE_BOUNDS
} from "./contract.ts";
import { b2Snapshot, check, eventPayloadHash } from "./fixtures.ts";

// ----------------------------------------------------------------------------------
// §11 frozen impulse mapping
// ----------------------------------------------------------------------------------

export interface ImpulseE1 {
  readonly q: number;
  readonly u_v: number;
  readonly u_a: number;
}

export function impulseOf(appraisal: AppraisalFixtureE1): ImpulseE1 {
  const q = appraisal.relevance * appraisal.intensity;
  const signedGoal = 2 * appraisal.goal_congruence - 1;
  // -0 -> 0 normalization keeps serialized impulses canonical.
  const normalize = (value: number): number => (value === 0 ? 0 : value);
  return { q: normalize(q), u_v: normalize(0.25 * q * signedGoal), u_a: normalize(0.2 * q) };
}

// ----------------------------------------------------------------------------------
// §12/§13 recovery + deterministic clamp
// ----------------------------------------------------------------------------------

export function recover(state: AffectStateE1, dt: number): AffectStateE1 {
  const factor = Math.exp(-dt / TAU);
  return {
    valence: BASELINE_STATE.valence + (state.valence - BASELINE_STATE.valence) * factor,
    activation: BASELINE_STATE.activation + (state.activation - BASELINE_STATE.activation) * factor
  };
}

export interface SaturationEventE1 {
  readonly time: number;
  readonly axis: "valence" | "activation";
  readonly direction: "low" | "high";
  readonly pre_clamp_value: number;
  readonly post_clamp_value: number;
}

export function clampState(state: AffectStateE1, time: number): {
  readonly state: AffectStateE1;
  readonly saturation: readonly SaturationEventE1[];
} {
  const saturation: SaturationEventE1[] = [];
  const [vLow, vHigh] = VALENCE_BOUNDS;
  const [aLow, aHigh] = ACTIVATION_BOUNDS;
  let valence = state.valence;
  if (valence < vLow) {
    saturation.push({ time, axis: "valence", direction: "low", pre_clamp_value: valence, post_clamp_value: vLow });
    valence = vLow;
  } else if (valence > vHigh) {
    saturation.push({ time, axis: "valence", direction: "high", pre_clamp_value: valence, post_clamp_value: vHigh });
    valence = vHigh;
  }
  let activation = state.activation;
  if (activation < aLow) {
    saturation.push({ time, axis: "activation", direction: "low", pre_clamp_value: activation, post_clamp_value: aLow });
    activation = aLow;
  } else if (activation > aHigh) {
    saturation.push({ time, axis: "activation", direction: "high", pre_clamp_value: activation, post_clamp_value: aHigh });
    activation = aHigh;
  }
  return { state: { valence, activation }, saturation };
}

// ----------------------------------------------------------------------------------
// §31/§32 application identity registry (experiment-local, exactly-once)
// ----------------------------------------------------------------------------------

export type ApplicationResultE1 = "APPLIED" | "REPLAY" | "CONFLICT";

export class ApplicationRegistry {
  private readonly entries = new Map<string, string>();

  /** Verdict for one application attempt: exactly-once law (§31). */
  verdict(eventId: string, payloadHash: string): ApplicationResultE1 {
    const existing = this.entries.get(eventId);
    if (existing === undefined) return "APPLIED";
    return existing === payloadHash ? "REPLAY" : "CONFLICT";
  }

  register(eventId: string, payloadHash: string): void {
    this.entries.set(eventId, payloadHash);
  }

  exportState(): readonly (readonly [string, string])[] {
    return [...this.entries.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
  }

  restoreState(entries: readonly (readonly [string, string])[]): void {
    this.entries.clear();
    for (const [id, hash] of entries) this.entries.set(id, hash);
  }
}

// ----------------------------------------------------------------------------------
// §19 event order law + B-family engine
// ----------------------------------------------------------------------------------

export type PartitionStrategyE1 = "tick1" | "tick10" | "direct";

export interface EventRecordE1 {
  readonly event_id: string;
  readonly time: number;
  readonly payload_hash: string;
  readonly application: ApplicationResultE1;
  /** Computed impulse; null when the application was refused (REPLAY/CONFLICT). */
  readonly impulse: ImpulseE1 | null;
  readonly pre_event_state: AffectStateE1;
  readonly post_event_state: AffectStateE1;
  readonly saturation: readonly SaturationEventE1[];
}

export interface ValenceRunE1 {
  readonly mechanism: "B0" | "B1" | "B3_RESET" | "B3";
  readonly sequence_id: string;
  readonly impulse_scale: number;
  readonly partition: PartitionStrategyE1;
  readonly t_end: number;
  /** Read-only outputs [t, valence, activation] at this partition's output
   * timestamps (tick1 partition = the primary 1-tick sample trajectory). */
  readonly outputs: readonly (readonly [number, number, number])[];
  readonly events: readonly EventRecordE1[];
}

function chunkFor(partition: PartitionStrategyE1): number | null {
  return partition === "tick1" ? 1 : partition === "tick10" ? 10 : null;
}

/** Internal anchored time advance in the partition's decomposition (§20). */
function advanceAnchored(state: AffectStateE1, dt: number, partition: PartitionStrategyE1): AffectStateE1 {
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

/** Read-only closed-form state read at a future timestamp (§33). */
function readAt(anchor: AffectStateE1, anchorTime: number, t: number): AffectStateE1 {
  return t === anchorTime ? anchor : recover(anchor, t - anchorTime);
}

export function runValenceFamily(
  mechanism: "B0" | "B1" | "B3_RESET" | "B3",
  seq: SequenceE1,
  options: {
    readonly impulseScale?: number;
    readonly partition?: PartitionStrategyE1;
    readonly tEnd: number;
    /** §30 restore continuation: resume from a serialized anchor; past events
     * are NEVER re-applied (the restored registry makes any duplicate REPLAY). */
    readonly resumeFrom?: {
      readonly anchor_time: number;
      readonly anchor_state: AffectStateE1;
      readonly registry: readonly (readonly [string, string])[];
    };
    /** §32 replay proof: registry entries pre-registered BEFORE the run.
     * Same event_id + same payload -> REPLAY (no impulse); same event_id +
     * changed payload -> CONFLICT. Both leave the trajectory unchanged. */
    readonly preRegistered?: readonly (readonly [string, string])[];
  }
): ValenceRunE1 {
  const impulseScale = options.impulseScale ?? 1;
  const partition = options.partition ?? "tick1";
  const tEnd = options.tEnd;
  const resume = options.resumeFrom;
  const events = [...seq.events].sort((a, b) => a.time - b.time);
  for (let i = 1; i < events.length; i++) {
    const previous = events[i - 1];
    const current = events[i];
    check(previous !== undefined && current !== undefined && current.time > previous.time, `sequence ${seq.id}: event times must be strictly increasing`);
  }
  check(events.every((e) => e.time >= 0), `sequence ${seq.id}: event times must be non-negative`);
  // Events beyond tEnd simply never fire in this run (serialize uses this).

  const registry = new ApplicationRegistry();
  if (options.preRegistered !== undefined) registry.restoreState(options.preRegistered);
  let anchor: AffectStateE1;
  let anchorTime: number;
  if (resume === undefined) {
    anchor = { ...BASELINE_STATE };
    anchorTime = 0;
  } else {
    anchor = { ...resume.anchor_state };
    anchorTime = resume.anchor_time;
    registry.restoreState(resume.registry);
  }
  // History cutoff: a fresh run starts BEFORE t=0 (nothing is history); a
  // resumed run has already applied every event at or before its anchor time.
  const historyCutoff = resume === undefined ? -1 : anchorTime;
  // Restore law (§30): history is never recomputed — past events are skipped.
  const futureEvents = events.filter((e) => e.time > historyCutoff && e.time <= tEnd);
  const outputTimes: number[] = [];
  if (partition === "tick1") {
    for (let t = anchorTime; t <= tEnd; t++) outputTimes.push(t);
  } else if (partition === "tick10") {
    for (let t = Math.ceil(anchorTime / 10) * 10; t <= tEnd; t += 10) outputTimes.push(t);
    for (const e of futureEvents) if (!outputTimes.includes(e.time)) outputTimes.push(e.time);
    if (!outputTimes.includes(tEnd)) outputTimes.push(tEnd);
  } else {
    outputTimes.push(anchorTime);
    for (const e of futureEvents) if (!outputTimes.includes(e.time)) outputTimes.push(e.time);
    if (!outputTimes.includes(tEnd)) outputTimes.push(tEnd);
  }
  outputTimes.sort((a, b) => a - b);

  const outputs: [number, number, number][] = [];
  const eventRecords: EventRecordE1[] = [];
  const eventTimes = new Set(futureEvents.map((e) => e.time));

  for (const t of outputTimes) {
    // 1. advance the anchor from the previous anchor time to t (§19 step 1).
    if (t > anchorTime) {
      anchor = advanceAnchored(anchor, t - anchorTime, partition);
      anchorTime = t;
    }
    // 2. event application at t, AFTER elapsed-time recovery (§19).
    if (eventTimes.has(t)) {
      for (const scheduled of events.filter((e) => e.time === t)) {
        const pre = readAt(anchor, anchorTime, t);
        const payloadHash = eventPayloadHash(scheduled.event_id, scheduled.time, scheduled.appraisal);
        const application = registry.verdict(scheduled.event_id, payloadHash);
        let impulse: ImpulseE1 | null = null;
        let post = pre;
        let saturation: readonly SaturationEventE1[] = [];
        if (application === "APPLIED") {
          registry.register(scheduled.event_id, payloadHash);
          impulse = impulseOf(scheduled.appraisal);
          const scaled: ImpulseE1 = { q: impulse.q, u_v: impulse.u_v * impulseScale, u_a: impulse.u_a * impulseScale };
          // §27 zero-impulse application law: an appraisal with exactly zero
          // impulse triggers NO event application in ANY mechanism (recorded,
          // state-neutral) — this is what makes S6 == S1 per §27/G4.
          const zeroImpulse = scaled.q === 0;
          // §14-§18: the ONLY per-mechanism difference.
          const candidate = zeroImpulse
            ? pre
            : mechanism === "B0"
              ? pre
              : mechanism === "B3"
                ? { valence: pre.valence + scaled.u_v, activation: pre.activation + scaled.u_a }
                : { valence: BASELINE_STATE.valence + scaled.u_v, activation: BASELINE_STATE.activation + scaled.u_a };
          const clamped = clampState(candidate, t);
          post = clamped.state;
          saturation = clamped.saturation;
          anchor = post;
        }
        eventRecords.push({
          event_id: scheduled.event_id, time: t, payload_hash: payloadHash, application,
          impulse, pre_event_state: pre, post_event_state: post, saturation
        });
      }
    }
    // 3. read-only output at t (never advances experiment time, §33).
    {
      const s = readAt(anchor, anchorTime, t);
      outputs.push([t, s.valence, s.activation]);
    }
  }
  return { mechanism, sequence_id: seq.id, impulse_scale: impulseScale, partition, t_end: tEnd, outputs, events: eventRecords };
}

// ----------------------------------------------------------------------------------
// §30 restore branch: serialize/restore the anchored experiment state
// ----------------------------------------------------------------------------------

export interface ValenceRunSnapshotE1 {
  readonly mechanism: "B0" | "B1" | "B3_RESET" | "B3";
  readonly sequence_id: string;
  readonly anchor_time: number;
  readonly anchor_state: AffectStateE1;
  readonly registry: readonly (readonly [string, string])[];
}

export function serializeValenceRun(mechanism: "B0" | "B1" | "B3_RESET" | "B3", seq: SequenceE1, anchorTime: number): ValenceRunSnapshotE1 {
  // Re-derive the anchored state at anchorTime by running the tick1 partition
  // up to anchorTime (deterministic; the serialization captures the anchor).
  const partial = runValenceFamily(mechanism, seq, { partition: "tick1", tEnd: anchorTime });
  const lastSample = partial.outputs[partial.outputs.length - 1];
  check(lastSample !== undefined && lastSample[0] === anchorTime, `serialize: anchor time ${anchorTime} must be an output`);
  const registry = new ApplicationRegistry();
  for (const record of partial.events) {
    if (record.application === "APPLIED") registry.register(record.event_id, record.payload_hash);
  }
  return {
    mechanism, sequence_id: seq.id, anchor_time: anchorTime,
    anchor_state: { valence: lastSample[1], activation: lastSample[2] },
    registry: registry.exportState()
  };
}

/** Continues a serialized run with identical future inputs (no historical replay). */
export function continueValenceRun(
  snapshot: ValenceRunSnapshotE1,
  seq: SequenceE1,
  tEnd: number
): ValenceRunE1 {
  check(snapshot.sequence_id === seq.id, "restore: sequence identity must match");
  return runValenceFamily(snapshot.mechanism, seq, {
    partition: "tick1",
    tEnd,
    resumeFrom: {
      anchor_time: snapshot.anchor_time,
      anchor_state: snapshot.anchor_state,
      registry: snapshot.registry
    }
  });
}

// ----------------------------------------------------------------------------------
// §16 B2 — frozen production FAST_EMA_V0, native representation
// ----------------------------------------------------------------------------------

export interface B2NativeState {
  readonly channels: readonly {
    readonly channel_id: "anger" | "fear" | "sadness" | "joy";
    readonly intensity: number;
    readonly phase: "ACTIVE" | "RELEASING";
    readonly started_at: number;
    readonly source_appraisal_ref: string;
  }[];
  readonly mood: number;
}

export interface B2EventRecordE1 {
  readonly event_id: string;
  readonly time: number;
  readonly payload_hash: string;
  readonly application: ApplicationResultE1;
  readonly routed_channel: string | null;
  readonly saturation: readonly string[];
}

export interface B2RunE1 {
  readonly mechanism: "B2";
  readonly sequence_id: string;
  readonly impulse_scale: number;
  readonly partition: PartitionStrategyE1;
  readonly t_end: number;
  /** Native outputs [t, mood, anger, fear, sadness, joy] at this partition's
   * output timestamps (tick1 partition = the primary 1-tick trajectory). */
  readonly outputs: readonly (readonly [number, number, number, number, number, number])[];
  readonly events: readonly B2EventRecordE1[];
}

const PRODUCER = new ReferenceFastEmaAffectProducer();

interface B2Anchor {
  channels: B2NativeState["channels"];
  mood: number;
  time: number;
}

function channelIntensity(state: B2NativeState, id: string): number {
  return state.channels.find((c) => c.channel_id === id)?.intensity ?? 0;
}

async function b2Observation(anchor: B2Anchor, scheduled: ScheduledEventE1): Promise<{ routed: string | null; saturation: string[] }> {
  const payloadHash = eventPayloadHash(scheduled.event_id, scheduled.time, scheduled.appraisal);
  const snapshot = b2Snapshot(anchor.channels as never, anchor.mood, anchor.time) as SubjectStateV0;
  const delta = await PRODUCER.produceAffectDelta({
    context: { subject_id: "subject-e1-b2" as never, current_logical_time: anchor.time as never, state_revision: 0 as never },
    snapshot,
    transition_type: "Observation",
    appraisal: {
      schema_version: "appraisal-v0",
      appraisal_ref: `appraisal:${payloadHash}` as never,
      evidence_refs: [],
      relevance: scheduled.appraisal.relevance as never,
      goal_congruence: scheduled.appraisal.goal_congruence as never,
      attribution: scheduled.appraisal.attribution,
      controllability: scheduled.appraisal.controllability as never,
      uncertainty: scheduled.appraisal.uncertainty as never,
      intensity: scheduled.appraisal.intensity as never
    },
    elapsed_ticks: null
  } as never);
  return applyB2Delta(anchor, delta, scheduled.time, payloadHash);
}

async function b2TimeAdvance(anchor: B2Anchor, ticks: number): Promise<void> {
  if (ticks <= 0) return;
  const snapshot = b2Snapshot(anchor.channels as never, anchor.mood, anchor.time) as SubjectStateV0;
  const delta = await PRODUCER.produceAffectDelta({
    context: { subject_id: "subject-e1-b2" as never, current_logical_time: anchor.time as never, state_revision: 0 as never },
    snapshot,
    transition_type: "Time",
    appraisal: null,
    elapsed_ticks: ticks
  } as never);
  applyB2Delta(anchor, delta, anchor.time + ticks, null);
}

function applyB2Delta(
  anchor: B2Anchor,
  delta: { operations: readonly { path: string; value: unknown }[] },
  time: number,
  payloadHash: string | null
): { routed: string | null; saturation: string[] } {
  const saturation: string[] = [];
  let routed: string | null = null;
  for (const op of delta.operations) {
    if (op.path === "/affect") {
      const value = op.value as { active_channels: B2NativeState["channels"] };
      const before = anchor.channels;
      anchor.channels = value.active_channels.map((c) => ({ ...c }));
      if (payloadHash !== null) {
        for (const c of anchor.channels) {
          if (!before.some((b) => b.channel_id === c.channel_id && b.intensity === c.intensity && b.started_at === c.started_at)) {
            routed = c.channel_id;
          }
          if (c.intensity >= 1 - SATURATION_EPSILON) saturation.push(`channel:${c.channel_id}`);
        }
      }
    } else if (op.path === "/mood") {
      const value = op.value as { baseline: number };
      anchor.mood = value.baseline;
      if (anchor.mood >= 0.25 - SATURATION_EPSILON) saturation.push("mood");
    }
  }
  anchor.time = time;
  return { routed, saturation };
}

export async function runB2(
  seq: SequenceE1,
  options: { readonly impulseScale?: number; readonly partition?: PartitionStrategyE1; readonly tEnd: number }
): Promise<B2RunE1> {
  const impulseScale = options.impulseScale ?? 1;
  const partition = options.partition ?? "tick1";
  const tEnd = options.tEnd;
  void impulseScale; // B2 is run once per sequence; the frozen producer has no impulse scale knob.
  const events = [...seq.events].sort((a, b) => a.time - b.time);
  const registry = new ApplicationRegistry();
  const anchor: B2Anchor = { channels: [], mood: 0, time: 0 };
  const outputs: [number, number, number, number, number, number][] = [];
  const eventRecords: B2EventRecordE1[] = [];

  const outputTimes: number[] = [];
  if (partition === "tick1") {
    for (let t = 0; t <= tEnd; t++) outputTimes.push(t);
  } else if (partition === "tick10") {
    for (let t = 0; t <= tEnd; t += 10) outputTimes.push(t);
    for (const e of events) if (!outputTimes.includes(e.time)) outputTimes.push(e.time);
  } else {
    outputTimes.push(0);
    for (const e of events) if (!outputTimes.includes(e.time)) outputTimes.push(e.time);
  }
  outputTimes.sort((a, b) => a - b);
  const eventTimes = new Map<number, ScheduledEventE1[]>();
  for (const e of events) {
    const list = eventTimes.get(e.time) ?? [];
    list.push(e);
    eventTimes.set(e.time, list);
  }

  for (const t of outputTimes) {
    if (t > anchor.time) {
      // Partition-specific internal decomposition; FAST_EMA evolves in its own
      // closed contract (closed-form channel decay + per-tick mood recurrence).
      const chunk = chunkFor(partition);
      let remaining = t - anchor.time;
      while (remaining > 0) {
        const step = chunk === null ? remaining : Math.min(chunk, remaining);
        await b2TimeAdvance(anchor, step);
        remaining -= step;
      }
    }
    const scheduledList = eventTimes.get(t);
    if (scheduledList !== undefined) {
      for (const scheduled of scheduledList) {
        const payloadHash = eventPayloadHash(scheduled.event_id, scheduled.time, scheduled.appraisal);
        const application = registry.verdict(scheduled.event_id, payloadHash);
        let routed: string | null = null;
        let saturation: string[] = [];
        if (application === "APPLIED") {
          registry.register(scheduled.event_id, payloadHash);
          const applied = await b2Observation(anchor, scheduled);
          routed = applied.routed;
          saturation = applied.saturation;
        }
        eventRecords.push({ event_id: scheduled.event_id, time: t, payload_hash: payloadHash, application, routed_channel: routed, saturation });
      }
    }
    outputs.push([t, anchor.mood, channelIntensity(anchor, "anger"), channelIntensity(anchor, "fear"), channelIntensity(anchor, "sadness"), channelIntensity(anchor, "joy")]);
  }
  return { mechanism: "B2", sequence_id: seq.id, impulse_scale: 1, partition, t_end: tEnd, outputs, events: eventRecords };
}

// §38 structural law: only event-state retention differs between B3 and B3_RESET.
export function retentionDiffersOnly(preEvent: AffectStateE1, impulse: ImpulseE1): {
  readonly b3: AffectStateE1;
  readonly b3Reset: AffectStateE1;
} {
  return {
    b3: clampState({ valence: preEvent.valence + impulse.u_v, activation: preEvent.activation + impulse.u_a }, 0).state,
    b3Reset: clampState({ valence: BASELINE_STATE.valence + impulse.u_v, activation: BASELINE_STATE.activation + impulse.u_a }, 0).state
  };
}
