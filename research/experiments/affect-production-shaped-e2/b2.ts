/**
 * PRODUCTION_SHAPED_APPRAISAL_DYNAMICS_E2 — B2 native driver (§7/§53).
 *
 * Drives the FROZEN production ReferenceFastEmaAffectProducer exactly as
 * production defines it (imported lawfully from the built public root — never
 * copied or reimplemented). Reports ONLY native state: per-channel
 * intensities, phases, mood, replacement/upsert classification and routed
 * emotions. No VA translation; B2 cannot decide the E2 verdict.
 *
 * Per-tick Time(1) driving is the production legacy_tick semantics; the
 * snapshot carrier object is reused across calls (the producer never mutates
 * its inputs — no allocation-per-tick, results identical to fresh carriers).
 */

/* eslint-disable no-restricted-imports -- Isolated research experiment host over frozen built roots (v1/E1 convention). */
import { ReferenceFastEmaAffectProducer } from "../../../packages/runtime/dist/index.js";
import type { SubjectStateV0 } from "../../../packages/subject-core/dist/index.js";
import { b2Snapshot, eventPayloadHash } from "../affect-state-retention-e1/fixtures.ts";
import { ApplicationRegistry, type ApplicationResultE1 } from "../affect-state-retention-e1/mechanisms.ts";
import type { AppraisalEventE2 } from "./contract.ts";
import { check } from "./fixtures.ts";

const PRODUCER = new ReferenceFastEmaAffectProducer();

type ChannelId = "anger" | "fear" | "sadness" | "joy";

interface B2ChannelE2 {
  channel_id: ChannelId;
  intensity: number;
  phase: "ACTIVE" | "RELEASING";
  started_at: number;
  source_appraisal_ref: string;
}

interface B2State {
  channels: B2ChannelE2[];
  mood: number;
  time: number;
}

export type B2ApplicationKindE2 = "identity" | "upsert" | "fresh_fill" | "replacement";

export interface B2EventRecordE2 {
  readonly event_id: string;
  readonly tick: number;
  readonly payload_hash: string;
  readonly application: ApplicationResultE1;
  readonly routed_channel: ChannelId | null;
  readonly kind: B2ApplicationKindE2;
}

export interface B2RunE2 {
  readonly mechanism: "B2";
  readonly corpus_id: string;
  readonly T: number;
  /** [t, mood, anger, fear, sadness, joy, activeCount, releasingCount] per tick. */
  readonly outputs: readonly (readonly [number, number, number, number, number, number, number, number])[];
  readonly events: readonly B2EventRecordE2[];
  readonly counts: { readonly upserts: number; readonly replacements: number; readonly fresh_fills: number; readonly identity: number };
  readonly routed_counts: { readonly anger: number; readonly fear: number; readonly sadness: number; readonly joy: number };
}

/** Applies one producer delta to the state; returns the post-application channels. */
function applyDelta(state: B2State, delta: { operations: readonly { path: string; value: unknown }[] }, time: number): B2ChannelE2[] {
  let channels: B2ChannelE2[] | null = null;
  for (const op of delta.operations) {
    if (op.path === "/affect") {
      const value = op.value as { active_channels: B2ChannelE2[] };
      channels = value.active_channels.map((c) => ({ ...c }));
    } else if (op.path === "/mood") {
      state.mood = (op.value as { baseline: number }).baseline;
    }
  }
  if (channels !== null) state.channels = channels;
  state.time = time;
  return state.channels;
}

export async function runB2E2(
  corpusId: string,
  T: number,
  events: readonly AppraisalEventE2[],
  options: { readonly preRegistered?: readonly (readonly [string, string])[] } = {}
): Promise<B2RunE2> {
  const registry = new ApplicationRegistry();
  if (options.preRegistered !== undefined) registry.restoreState(options.preRegistered);

  const state: B2State = { channels: [], mood: 0, time: 0 };
  // Reusable snapshot carrier: the producer is read-only over its inputs.
  const carrier = b2Snapshot([], 0, 0) as SubjectStateV0;
  function syncCarrier(): SubjectStateV0 {
    (carrier.affect as { active_channels: unknown }).active_channels = state.channels;
    (carrier.mood as { baseline: number }).baseline = state.mood;
    (carrier.runtime_metadata as { logical_time: number }).logical_time = state.time;
    return carrier;
  }

  const outputs: [number, number, number, number, number, number, number, number][] = [];
  const eventRecords: B2EventRecordE2[] = [];
  const counts = { upserts: 0, replacements: 0, fresh_fills: 0, identity: 0 };
  const routedCounts = { anger: 0, fear: 0, sadness: 0, joy: 0 };
  const eventTicks = new Map<number, AppraisalEventE2[]>();
  for (const e of events) {
    const list = eventTicks.get(e.tick) ?? [];
    list.push(e);
    eventTicks.set(e.tick, list);
  }

  const channelIntensity = (id: ChannelId): number => state.channels.find((c) => c.channel_id === id)?.intensity ?? 0;

  for (let t = 0; t <= T; t++) {
    if (t > state.time) {
      // Per-tick Time(1) evolution (production legacy_tick semantics).
      const delta = await PRODUCER.produceAffectDelta({
        context: { subject_id: "subject-e2-b2" as never, current_logical_time: state.time as never, state_revision: 0 as never },
        snapshot: syncCarrier(),
        transition_type: "Time",
        appraisal: null,
        elapsed_ticks: 1
      } as never);
      applyDelta(state, delta as { operations: readonly { path: string; value: unknown }[] }, t);
    }
    const scheduled = eventTicks.get(t);
    if (scheduled !== undefined) {
      for (const e of scheduled) {
        const payloadHash = eventPayloadHash(e.event_id, e.tick, e as never);
        const application = registry.verdict(e.event_id, payloadHash);
        let routed: ChannelId | null = null;
        let kind: B2ApplicationKindE2 = "identity";
        if (application === "APPLIED") {
          registry.register(e.event_id, payloadHash);
          const before = state.channels.map((c) => ({ ...c }));
          const delta = await PRODUCER.produceAffectDelta({
            context: { subject_id: "subject-e2-b2" as never, current_logical_time: state.time as never, state_revision: 0 as never },
            snapshot: syncCarrier(),
            transition_type: "Observation",
            appraisal: {
              schema_version: "appraisal-v0",
              appraisal_ref: `appraisal:${payloadHash}` as never,
              evidence_refs: [],
              relevance: e.relevance as never,
              goal_congruence: e.goal_congruence as never,
              attribution: e.attribution,
              controllability: e.controllability as never,
              uncertainty: e.uncertainty as never,
              intensity: e.intensity as never
            },
            elapsed_ticks: null
          } as never);
          const after = applyDelta(state, delta as { operations: readonly { path: string; value: unknown }[] }, t);
          // Classify the application against the pre-event channel set.
          let changed = false;
          for (const c of after) {
            const was = before.find((b) => b.channel_id === c.channel_id);
            if (was === undefined || was.intensity !== c.intensity || was.started_at !== c.started_at) {
              routed = c.channel_id;
              changed = true;
            }
          }
          if (!changed) {
            kind = "identity";
            counts.identity += 1;
          } else if (routed !== null) {
            routedCounts[routed] += 1;
            const appeared = !before.some((b) => b.channel_id === routed);
            if (!appeared) kind = before.length >= 4 ? "replacement" : "fresh_fill";
            else kind = "upsert";
            if (kind === "upsert") counts.upserts += 1;
            else if (kind === "replacement") counts.replacements += 1;
            else counts.fresh_fills += 1;
          }
        }
        eventRecords.push({ event_id: e.event_id, tick: e.tick, payload_hash: payloadHash, application, routed_channel: routed, kind });
      }
    }
    let active = 0;
    let releasing = 0;
    for (const c of state.channels) {
      if (c.phase === "ACTIVE") active += 1;
      else releasing += 1;
    }
    outputs.push([t, state.mood, channelIntensity("anger"), channelIntensity("fear"), channelIntensity("sadness"), channelIntensity("joy"), active, releasing]);
  }

  return { mechanism: "B2", corpus_id: corpusId, T, outputs, events: eventRecords, counts, routed_counts: routedCounts };
}

export function b2QuietRecovery(run: B2RunE2, windows: readonly { start: number; end: number }[]): readonly {
  readonly start: number; readonly end: number;
  readonly mood_start: number; readonly mood_end: number;
  readonly max_channel_start: number; readonly max_channel_end: number;
}[] {
  check(run.outputs.length > 0, "b2 quiet recovery: empty run");
  return windows.map((w) => {
    const s = run.outputs[w.start];
    const e = run.outputs[w.end];
    check(s !== undefined && e !== undefined, "b2 quiet recovery: missing window endpoints");
    const maxChannel = (o: readonly number[] | undefined): number =>
      o === undefined ? 0 : Math.max(o[2] ?? 0, o[3] ?? 0, o[4] ?? 0, o[5] ?? 0);
    return {
      start: w.start, end: w.end,
      mood_start: s?.[1] ?? 0, mood_end: e?.[1] ?? 0,
      max_channel_start: maxChannel(s), max_channel_end: maxChannel(e)
    };
  });
}
