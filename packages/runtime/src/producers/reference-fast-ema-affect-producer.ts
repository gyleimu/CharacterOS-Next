/**
 * P2.3.4.1 — ReferenceFastEmaAffectProducer: deterministic reference
 * AffectProducerPort implementation aligned to the COMMITTED FAST_EMA_V0
 * reference dynamics contract (docs/implementation/p2-3-4-fast-ema-v0-reference-contract.md,
 * commit d3be869).
 *
 * STATUS — REFERENCE ENGINEERING BASELINE ONLY. FAST_EMA_V0 is NOT scientific
 * truth, NOT a validated psychology model, NOT human emotion theory, and NOT
 * superior to LLM prompting; it exists so the frozen Observation/Time pipelines
 * operate against a persistent, deterministic, history-dependent, time-evolving
 * affect producer instead of fixed test fakes.
 *
 * Architecture principle (Producer != Mutator): this producer reads controlled
 * canonical inputs, computes a deterministic affect-domain delta (/affect + /mood)
 * and returns it. It NEVER commits, NEVER mutates the snapshot, NEVER touches
 * memory/retrieval/LLM/clocks, and NEVER owns logical time or revision.
 *
 * Mood ownership (P2.3.4 exit condition "Mood 非直设"): `mood.baseline` only ever
 * arises from the committed EMA reference dynamics below — no code path assigns
 * mood directly; no executor-side mood setting exists. Regulation-side mood
 * behavior belongs to P2.3.4.2 and is deliberately NOT anticipated here.
 *
 * Attribution boundary (contract §4 / MUST_RESOLVE_BEFORE_P2_3_5): the disputed
 * appraisal `attribution` field is NEVER read, validated, or interpreted, and no
 * other field indirectly encodes its categorical semantics.
 *
 * Contract section map: §3 inputs / §5–§6 bridge+routing / §7 hold-release
 * lifecycle / §8 closed-form decay / §9 fast aggregation / §10 EMA recurrence /
 * §11 update order / §12 numeric rules / §13 zero-effect / §14 capacity /
 * §15 provenance table.
 */

import {
  parseRef,
  refKind,
  type AffectChannelId,
  type AffectChannelV0,
  type AffectPhase,
  type AffectV0,
  type DomainDeltaV0,
  type MoodV0,
  type SubjectStateV0
} from "@characteros-next/subject-core";
import type { AffectProducerInputV0, AffectProducerPort } from "../ports/affect-producer-port.js";
import type { AppraisalProposalDraftV0 } from "../ports/appraisal-port.js";

/** Frozen §6.2 channel order; emitted channels always follow it exactly. */
const CHANNEL_ORDER: readonly AffectChannelId[] = ["anger", "fear", "sadness", "joy"];

/**
 * Frozen channel capacity (contract §14): the closed channel enum admits exactly
 * these slots, so a snapshot can never hold more than 4 active channels.
 */
const CHANNEL_CAPACITY = CHANNEL_ORDER.length;

/** Mutable per-computation channel working copy (never the snapshot's arrays). */
export interface WorkingChannel {
  channel_id: AffectChannelId;
  intensity: number;
  phase: AffectPhase;
  started_at: number;
  source_appraisal_ref: string;
}

/** The sole active affect config authority (spec §18): validated fail-closed. */
interface FastEmaConfig {
  readonly tHold: number;
  readonly alpha: number;
  readonly tau: number;
  readonly clamp: number;
}

// ---------------------------------------------------------------------------
// Numeric hygiene (contract §12): finite-only, -0 → 0, frozen legal ranges,
// no decimal rounding, no locale-dependent conversion.
// ---------------------------------------------------------------------------

/** `-0 → 0` normalization for every produced numeric value. */
function normalizeNumber(value: number): number {
  return value === 0 ? 0 : value;
}

/** Contract §5.1: `clamp01(x) = normalize(min(1, max(0, x)))`. */
function clamp01(value: number): number {
  return normalizeNumber(Math.min(1, Math.max(0, value)));
}

/** Contract §10: `clamp_mood(x) = normalize(min(config.clamp, max(0, x)))`. */
function clampMood(value: number, clamp: number): number {
  return normalizeNumber(Math.min(clamp, Math.max(0, value)));
}

/** Fail-closed finite-only guard on produced values (contract §12). */
function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`reference affect producer: ${label} produced a non-finite value`);
  }
}

function failClosed(detail: string): never {
  throw new Error(`reference affect producer: ${detail}`);
}

function requireUnitInterval(value: number, label: string): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    failClosed(`${label} must be a finite number in [0,1]`);
  }
}

// ---------------------------------------------------------------------------
// Config intake (contract §3/§12): fail-closed, no silent defaults.
// ---------------------------------------------------------------------------

function readConfig(snapshot: SubjectStateV0): FastEmaConfig {
  const profile = snapshot.mechanism_config.affect_profile;
  if (profile.profile_id !== "FAST_EMA_V0" || profile.timebase !== "legacy_tick") {
    failClosed("mechanism_config.affect_profile must be FAST_EMA_V0/legacy_tick");
  }
  const d = snapshot.mechanism_config.legacy_reference_defaults;
  if (!Number.isFinite(d.tHold) || !Number.isSafeInteger(d.tHold) || d.tHold < 1) {
    failClosed("legacy_reference_defaults.tHold must be a positive safe integer");
  }
  if (!Number.isFinite(d.alpha) || d.alpha <= 0 || d.alpha > 1) {
    failClosed("legacy_reference_defaults.alpha must be finite in (0,1]");
  }
  if (!Number.isFinite(d.tau) || d.tau <= 0) {
    failClosed("legacy_reference_defaults.tau must be finite and > 0");
  }
  // clamp must also respect the frozen §6.3 mood range [0,0.25].
  if (!Number.isFinite(d.clamp) || d.clamp < 0 || d.clamp > 0.25) {
    failClosed("legacy_reference_defaults.clamp must be finite in [0,0.25]");
  }
  const mood = snapshot.mood.baseline as number;
  if (!Number.isFinite(mood) || mood < 0 || mood > 0.25) {
    failClosed("mood.baseline outside frozen [0,0.25]");
  }
  for (const channel of snapshot.affect.active_channels) {
    if (!Number.isFinite(channel.intensity as number) || (channel.intensity as number) < 0 || (channel.intensity as number) > 1) {
      failClosed(`channel ${channel.channel_id}: intensity outside [0,1]`);
    }
    if (!Number.isFinite(channel.started_at as number) || (channel.started_at as number) < 0) {
      failClosed(`channel ${channel.channel_id}: invalid started_at`);
    }
  }
  return { tHold: d.tHold, alpha: d.alpha, tau: d.tau, clamp: d.clamp };
}

/** Fail-closed appraisal intake (contract §4): attribution is never read. */
function checkAppraisal(appraisal: AppraisalProposalDraftV0): void {
  const ref = parseRef(appraisal.appraisal_ref, "appraisal.appraisal_ref");
  if (!ref.ok || refKind(ref.value) !== "appraisal") {
    failClosed("appraisal_ref must be a well-formed appraisal ref");
  }
  requireUnitInterval(appraisal.relevance, "appraisal.relevance");
  requireUnitInterval(appraisal.goal_congruence, "appraisal.goal_congruence");
  requireUnitInterval(appraisal.controllability, "appraisal.controllability");
  requireUnitInterval(appraisal.uncertainty, "appraisal.uncertainty");
  requireUnitInterval(appraisal.intensity, "appraisal.intensity");
  // attribution: deliberately absent — ignored by FAST_EMA_V0 (contract §4).
}

// ---------------------------------------------------------------------------
// Bridge + routing (contract §5–§6): FAST_EMA_V0 REFERENCE POLICY ONLY.
// ---------------------------------------------------------------------------

/**
 * Contract §5.1 activation strength, then §6 routing. Returns the single
 * dominant channel + clamped strength, or null when the appraisal carries no
 * activation:
 *  - strength == 0 ⇒ never activates (§5.2);
 *  - goal_congruence > 0.5 ⇒ joy; == 0.5 ⇒ no activation;
 *  - < 0.5: uncertainty > 0.5 ⇒ fear; else controllability < 0.5 ⇒ anger;
 *    otherwise ⇒ sadness.
 * Branch precedence is normative ONLY for FAST_EMA_V0; not a validated
 * appraisal theory. `attribution` is never consumed.
 */
function bridgeAppraisal(
  appraisal: AppraisalProposalDraftV0
): { readonly channel: AffectChannelId; readonly strength: number } | null {
  const strength = clamp01(appraisal.relevance * appraisal.intensity);
  if (strength === 0) return null;
  if (appraisal.goal_congruence > 0.5) return { channel: "joy", strength };
  if (appraisal.goal_congruence < 0.5) {
    if (appraisal.uncertainty > 0.5) return { channel: "fear", strength };
    if (appraisal.controllability < 0.5) return { channel: "anger", strength };
    return { channel: "sadness", strength };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Channel lifecycle (contract §7–§8): pure canonical-tick evolution.
// ---------------------------------------------------------------------------

function sortByChannelOrder(channels: readonly WorkingChannel[]): WorkingChannel[] {
  return [...channels].sort(
    (a, b) => CHANNEL_ORDER.indexOf(a.channel_id) - CHANNEL_ORDER.indexOf(b.channel_id)
  );
}

function maxIntensity(channels: readonly WorkingChannel[]): number {
  let fast = 0;
  for (const channel of channels) {
    if (channel.intensity > fast) fast = channel.intensity;
  }
  return fast;
}

/**
 * Contract §8 closed-form release decay, applied EXACTLY ONCE per Time
 * evolution interval (no per-tick multiplication, no loop-driven decay):
 *
 *   age_before = T - started_at;  age_after = (T + e) - started_at
 *   release_ticks = max(0, age_after - tHold) - max(0, age_before - tHold)
 *   if release_ticks > 0: phase ← RELEASING (if ACTIVE); intensity ×= exp(-release_ticks / tau)
 *
 * Self-consistency (contract §8): an already-RELEASING channel always has
 * age_before ≥ tHold ⇒ release_ticks == e; an ACTIVE channel that crosses
 * tHold inside the interval decays only over the post-hold ticks.
 */
function advanceChannelsOverInterval(
  channels: readonly WorkingChannel[],
  logicalTime: number,
  ticks: number,
  config: FastEmaConfig
): WorkingChannel[] {
  return channels.map((channel) => {
    const ageBefore = logicalTime - channel.started_at;
    const ageAfter = ageBefore + ticks;
    const releaseTicks = Math.max(0, ageAfter - config.tHold) - Math.max(0, ageBefore - config.tHold);
    if (releaseTicks <= 0) return { ...channel };
    const next: WorkingChannel = { ...channel };
    if (next.phase === "ACTIVE") next.phase = "RELEASING";
    next.intensity = normalizeNumber(next.intensity * Math.exp(-releaseTicks / config.tau));
    return next;
  });
}

// ---------------------------------------------------------------------------
// Capacity policy (contract §14): deterministic, REFERENCE POLICY.
// ---------------------------------------------------------------------------

/**
 * Deterministic lowest-intensity victim with frozen-order tie-break (contract
 * §14 rule 3): among equal intensities, the channel earliest in the frozen
 * order anger < fear < sadness < joy is replaced first. `channels` must be
 * non-empty and must not contain the target channel.
 *
 * Exported as the internal reference fixture for the full-capacity replacement
 * branch: over the closed 4-channel enum, legal FAST_EMA_V0 inputs can never
 * produce a 5th distinct channel (contract §14 note), so this branch is proven
 * executable through this narrowest-valid internal fixture instead.
 */
export function victimIndexOfLowestIntensity(channels: readonly WorkingChannel[]): number {
  const first = channels[0];
  if (first === undefined) throw new Error("reference affect producer: victim selection requires a non-empty channel set");
  let index = 0;
  let minIntensity = first.intensity;
  let minOrder = CHANNEL_ORDER.indexOf(first.channel_id);
  for (let i = 1; i < channels.length; i++) {
    const channel = channels[i];
    if (channel === undefined) continue;
    if (
      channel.intensity < minIntensity ||
      (channel.intensity === minIntensity && CHANNEL_ORDER.indexOf(channel.channel_id) < minOrder)
    ) {
      index = i;
      minIntensity = channel.intensity;
      minOrder = CHANNEL_ORDER.indexOf(channel.channel_id);
    }
  }
  return index;
}

/**
 * Contract §14 activation entry: 1) same-channel upsert (filter + re-add),
 * 2) empty-slot fill when capacity available, 3) deterministic replacement of
 * the lowest-intensity channel when full. Returns channels in frozen order.
 * Exported as a pure reference fixture surface so the full-capacity branch is
 * executable even though legal FAST_EMA_V0 inputs over the closed 4-channel
 * enum cannot produce a 5th distinct channel (contract §14, gap D note).
 */
export function applyChannelActivation(
  channels: readonly WorkingChannel[],
  target: AffectChannelId,
  strength: number,
  startedAt: number,
  sourceAppraisalRef: string
): WorkingChannel[] {
  const withoutSame = channels.filter((channel) => channel.channel_id !== target);
  const newChannel: WorkingChannel = {
    channel_id: target,
    intensity: clamp01(strength),
    phase: "ACTIVE",
    started_at: startedAt,
    source_appraisal_ref: sourceAppraisalRef
  };
  if (withoutSame.length < CHANNEL_CAPACITY) {
    return sortByChannelOrder([...withoutSame, newChannel]);
  }
  const replaced = [...withoutSame];
  replaced[victimIndexOfLowestIntensity(withoutSame)] = newChannel;
  return sortByChannelOrder(replaced);
}

// ---------------------------------------------------------------------------
// Delta assembly (contract §11/§12/§13/§15).
// ---------------------------------------------------------------------------

function channelsEqual(a: readonly WorkingChannel[], b: readonly AffectChannelV0[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (x === undefined || y === undefined) return false;
    if (
      x.channel_id !== y.channel_id ||
      x.intensity !== y.intensity ||
      x.phase !== y.phase ||
      x.started_at !== y.started_at ||
      x.source_appraisal_ref !== y.source_appraisal_ref
    ) {
      return false;
    }
  }
  return true;
}

function buildDelta(params: {
  readonly snapshot: SubjectStateV0;
  readonly channels: readonly WorkingChannel[];
  readonly mood: number;
  readonly stamp: number;
  readonly provenanceRefs: readonly string[];
}): DomainDeltaV0 {
  const { snapshot, channels, mood, stamp, provenanceRefs } = params;
  const unchanged =
    channelsEqual(channels, snapshot.affect.active_channels) && mood === (snapshot.mood.baseline as number);
  // Identity dynamics emit byte-identical values (no fabricated provenance stamps,
  // contract §13 zero-effect semantics).
  const affectValue = (unchanged
    ? {
        active_channels: snapshot.affect.active_channels.map((channel) => ({ ...channel })),
        generated_under_profile: snapshot.affect.generated_under_profile,
        updated_at: snapshot.affect.updated_at
      }
    : {
        active_channels: channels.map((channel) => ({
          channel_id: channel.channel_id,
          intensity: normalizeNumber(assertFiniteValue(channel.intensity, "intensity")),
          phase: channel.phase,
          started_at: channel.started_at,
          source_appraisal_ref: channel.source_appraisal_ref
        })),
        generated_under_profile: "FAST_EMA_V0",
        updated_at: stamp
      }) as unknown as AffectV0;
  const moodValue = (unchanged
    ? {
        baseline: normalizeNumber(snapshot.mood.baseline as number),
        generated_under_profile: snapshot.mood.generated_under_profile,
        last_update: snapshot.mood.last_update
      }
    : {
        baseline: normalizeNumber(assertFiniteValue(mood, "mood.baseline")),
        generated_under_profile: "FAST_EMA_V0",
        last_update: stamp
      }) as unknown as MoodV0;
  const delta = {
    producer: "affect",
    domain: "affect",
    expected_repository_revision: null,
    // raw-ASCII path order: /affect before /mood (frozen §7.2 sort rule).
    operations: [
      { path: "/affect", value: affectValue },
      { path: "/mood", value: moodValue }
    ],
    provenance_refs: [...provenanceRefs]
  } as unknown as DomainDeltaV0;
  deepFreeze(delta);
  return delta;
}

function assertFiniteValue(value: number, label: string): number {
  assertFinite(value, label);
  return value;
}

function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  if (Object.isFrozen(value)) return;
  Object.freeze(value);
  for (const key of Object.keys(value as Record<string, unknown>)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
}

// ---------------------------------------------------------------------------
// Reference producer (contract §3/§11 update ordering).
// ---------------------------------------------------------------------------

/**
 * Deterministic FAST+EMA reference producer. Same (snapshot, appraisal,
 * elapsed_ticks) ⇒ byte-equivalent DomainDeltaV0; no randomness, no clocks, no
 * mutation of any input.
 */
export class ReferenceFastEmaAffectProducer implements AffectProducerPort {
  async produceAffectDelta(input: AffectProducerInputV0): Promise<DomainDeltaV0> {
    const { snapshot, context, transition_type: transitionType } = input;

    // ---- closed input shape (contract §3, fail-closed before any computation)
    if (transitionType === "Observation") {
      if (input.appraisal === null) failClosed("Observation requires an accepted appraisal");
      if (input.elapsed_ticks !== null) failClosed("Observation carries no elapsed ticks");
    } else if (transitionType === "Time") {
      if (input.appraisal !== null) failClosed("Time never consumes an appraisal");
      const ticks = input.elapsed_ticks;
      if (typeof ticks !== "number" || !Number.isSafeInteger(ticks) || ticks < 0) {
        failClosed("Time elapsed_ticks must be a non-negative safe integer");
      }
    } else {
      failClosed(`unsupported transition_type ${String(transitionType)}`);
    }

    const config = readConfig(snapshot);
    const logicalTime: number = context.current_logical_time as number;
    const channels: WorkingChannel[] = snapshot.affect.active_channels.map((channel) => ({
      channel_id: channel.channel_id,
      intensity: channel.intensity as number,
      phase: channel.phase,
      started_at: channel.started_at as number,
      source_appraisal_ref: channel.source_appraisal_ref
    }));
    const mood: number = snapshot.mood.baseline as number;

    if (transitionType === "Observation") {
      // Contract §11 Observation order: validate → strength → route → upsert
      // (with capacity policy) → fast_level → one EMA step → delta.
      const appraisal = input.appraisal as AppraisalProposalDraftV0;
      checkAppraisal(appraisal);
      const signal = bridgeAppraisal(appraisal);
      if (signal !== null) {
        const updated = applyChannelActivation(
          channels,
          signal.channel,
          signal.strength,
          logicalTime,
          appraisal.appraisal_ref
        );
        channels.length = 0;
        channels.push(...updated);
        const fastLevel = maxIntensity(channels);
        const moodNext = clampMood(mood + config.alpha * (fastLevel - mood), config.clamp);
        return buildDelta({
          snapshot,
          channels,
          mood: moodNext,
          stamp: logicalTime,
          provenanceRefs: [appraisal.appraisal_ref]
        });
      }
      // Zero activation (contract §13): identity delta, byte-identical to the
      // snapshot; mood is NOT touched (contract §10).
      return buildDelta({
        snapshot,
        channels,
        mood,
        stamp: logicalTime,
        provenanceRefs: [appraisal.appraisal_ref]
      });
    }

    // ---- Time (contract §11 order): validate → closed-form advance all
    // channels → fast_level → EMA recurrence for exactly elapsed ticks → delta.
    const ticks = input.elapsed_ticks as number;
    const evolved = advanceChannelsOverInterval(channels, logicalTime, ticks, config);
    const fastLevel = maxIntensity(evolved);
    let moodNext = mood;
    for (let step = 0; step < ticks; step++) {
      // Contract §10 option A: discrete recurrence, N = elapsed ticks, with
      // fast_level held constant at the post-advance value.
      moodNext = clampMood(moodNext + config.alpha * (fastLevel - moodNext), config.clamp);
    }
    return buildDelta({
      snapshot,
      channels: sortByChannelOrder(evolved),
      mood: moodNext,
      // Core-derived logical_time_after equals current + elapsed; stamping it
      // keeps the whole-state timestamp invariant (≤ logical_time) exact.
      stamp: logicalTime + ticks,
      provenanceRefs: []
    });
  }
}

/** Factory alias (contract-adjacent naming): same reference producer. */
export function createReferenceFastEmaAffectProducer(): AffectProducerPort {
  return new ReferenceFastEmaAffectProducer();
}
