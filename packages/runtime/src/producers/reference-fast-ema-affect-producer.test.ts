/**
 * P2.3.4.1 — ReferenceFastEmaAffectProducer unit tests aligned to the COMMITTED
 * FAST_EMA_V0 reference dynamics contract (d3be869). Matrix U1–U15.
 *
 * Engineering conformance ONLY: nothing here claims psychological realism.
 */

import { describe, expect, it } from "vitest";

import type {
  AffectChannelV0,
  AffectV0,
  DomainDeltaV0,
  MoodV0,
  SubjectStateV0
} from "@characteros-next/subject-core";
import type { RuntimeContext } from "../types/runtime-context.js";
import type { AffectProducerInputV0 } from "../ports/affect-producer-port.js";
import type { AppraisalProposalDraftV0 } from "../ports/appraisal-port.js";
import {
  ReferenceFastEmaAffectProducer,
  applyChannelActivation,
  victimIndexOfLowestIntensity,
  type WorkingChannel
} from "./reference-fast-ema-affect-producer.js";

// ---------------------------------------------------------------------------
// fixtures
// ---------------------------------------------------------------------------

interface S0Overrides {
  readonly mood?: Record<string, unknown>;
  readonly affect?: Record<string, unknown>;
  readonly mechanismConfig?: Record<string, unknown>;
  readonly logicalTime?: number;
}

function s0State(overrides: S0Overrides = {}): SubjectStateV0 {
  return {
    schema_version: "subject-state-v1",
    identity: {
      subject_id: "subject-s0",
      display_name: "",
      origin_metadata: { creation_source: null, seed_version: null },
      identity_anchors: [],
      self_schema_seed_refs: []
    },
    traits_seed: { dimensions: {} },
    personality: { schema_version: "personality-state-v0", dimensions: [] },
    memory_state: {
      working_refs: [],
      active_episode_refs: [],
      autobiographical_index_revision: null,
      repository_revision: "R0",
      consolidation_cursor: null,
      retrieval_config: {
        profile_id: "RETRIEVAL_V0",
        affect_congruence_enabled: false,
        recent_trace_capacity: 64
      },
      recent_retrieval_trace: [],
      lifecycle_metadata: {},
      pending_encoding_refs: [],
      last_retrieval_at: null
    },
    beliefs: { items: [] },
    relationships: { models: [] },
    mood: { baseline: 0, generated_under_profile: null, last_update: null, ...overrides.mood },
    affect: { active_channels: [], generated_under_profile: null, updated_at: null, ...overrides.affect },
    regulation: { energy: 1, stress: 0, arousal: 0.5, fatigue: 0, last_update: null },
    context: {
      scene: "idle",
      task: null,
      focus_refs: [],
      active_entity_refs: [],
      environment_refs: [],
      current_observation_ref: null
    },
    mechanism_config:
      overrides.mechanismConfig ?? {
        affect_profile: { profile_id: "FAST_EMA_V0", timebase: "legacy_tick" },
        legacy_reference_defaults: { tHold: 60, alpha: 0.06, tau: 150, clamp: 0.25 },
        feature_flags: {},
        thresholds: {}
      },
    trace_window: {
      trace_window_schema_version: "trace-window-v1",
      capacity: 64,
      cursor: { last_history_sequence: 0, offloaded_through_sequence: 0, offloaded_through_trace_ref: null },
      entries: []
    },
    runtime_metadata: {
      subject_version: "subject-v0",
      state_revision: 0,
      logical_time: overrides.logicalTime ?? 0,
      last_transition_time: null,
      last_transition_type: null,
      created_at: 0,
      updated_at: 0
    }
  } as unknown as SubjectStateV0;
}

function ctxAt(logicalTime: number): RuntimeContext {
  return {
    subject_id: "subject-s0" as never,
    current_logical_time: logicalTime as never,
    state_revision: 0 as never
  };
}

function appraisalOf(overrides: Partial<Record<string, number | string>> = {}): AppraisalProposalDraftV0 {
  return {
    schema_version: "appraisal-v0",
    appraisal_ref: "appraisal:ap-1",
    evidence_refs: [],
    relevance: 1,
    goal_congruence: 0.9,
    attribution: "situation",
    controllability: 0.5,
    uncertainty: 0.2,
    intensity: 0.8,
    ...overrides
  } as unknown as AppraisalProposalDraftV0;
}

function observationInputOf(appraisal: AppraisalProposalDraftV0): AffectProducerInputV0 {
  return {
    context: ctxAt(0),
    snapshot: s0State(),
    transition_type: "Observation",
    appraisal,
    elapsed_ticks: null
  };
}

function timeInputOf(elapsedTicks: number, snapshot: SubjectStateV0 = s0State()): AffectProducerInputV0 {
  return {
    context: ctxAt(snapshot.runtime_metadata.logical_time as number),
    snapshot,
    transition_type: "Time",
    appraisal: null,
    elapsed_ticks: elapsedTicks
  };
}

function affectOf(delta: DomainDeltaV0): AffectV0 {
  const op = delta.operations.find((o) => o.path === "/affect");
  if (op === undefined || op.path !== "/affect") throw new Error("missing /affect operation");
  return op.value;
}

function moodOf(delta: DomainDeltaV0): MoodV0 {
  const op = delta.operations.find((o) => o.path === "/mood");
  if (op === undefined || op.path !== "/mood") throw new Error("missing /mood operation");
  return op.value;
}

function firstChannel(affect: AffectV0): AffectChannelV0 {
  const channel = affect.active_channels[0];
  if (channel === undefined) throw new Error("expected at least one active channel");
  return channel;
}

function fingerprint(value: unknown): string {
  return JSON.stringify(value);
}

function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  if (Object.isFrozen(value)) return;
  Object.freeze(value);
  for (const key of Object.keys(value as Record<string, unknown>)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
}

function assertNoMinusZero(value: unknown, path = "$"): void {
  if (typeof value === "number") {
    expect(Object.is(value, -0), `${path} must not be -0`).toBe(false);
    expect(Number.isFinite(value), `${path} must be finite`).toBe(true);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoMinusZero(item, `${path}[${index}]`));
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const key of Object.keys(value as Record<string, unknown>)) {
      assertNoMinusZero((value as Record<string, unknown>)[key], `${path}.${key}`);
    }
  }
}

function channelOf(
  channelId: "anger" | "fear" | "sadness" | "joy",
  intensity: number,
  phase: "ACTIVE" | "RELEASING",
  startedAt: number,
  sourceAppraisalRef = "appraisal:ap-old"
): WorkingChannel {
  return {
    channel_id: channelId,
    intensity,
    phase,
    started_at: startedAt,
    source_appraisal_ref: sourceAppraisalRef
  };
}

const producer = new ReferenceFastEmaAffectProducer();

// ---------------------------------------------------------------------------
// U1 determinism / U15 replay
// ---------------------------------------------------------------------------

describe("FAST_EMA_V0 determinism and replay", () => {
  it("U1: same state + same appraisal ⇒ byte-equivalent delta", async () => {
    const a = await producer.produceAffectDelta(observationInputOf(appraisalOf()));
    const b = await producer.produceAffectDelta(observationInputOf(appraisalOf()));
    expect(fingerprint(a)).toBe(fingerprint(b));
  });

  it("U1: same state + same elapsed ⇒ byte-equivalent Time delta", async () => {
    const snapshot = s0State({
      affect: {
        active_channels: [
          {
            channel_id: "joy",
            intensity: 0.6,
            phase: "ACTIVE",
            started_at: 0,
            source_appraisal_ref: "appraisal:ap-old"
          }
        ],
        generated_under_profile: "FAST_EMA_V0",
        updated_at: 0
      },
      mood: { baseline: 0.1, generated_under_profile: "FAST_EMA_V0", last_update: 0 }
    });
    const a = await producer.produceAffectDelta(timeInputOf(37, snapshot));
    const b = await producer.produceAffectDelta(timeInputOf(37, snapshot));
    expect(fingerprint(a)).toBe(fingerprint(b));
  });

  it("U15: four isolated producer runs replay the exact serialized delta", async () => {
    const fingerprints: string[] = [];
    for (let run = 0; run < 4; run++) {
      const isolated = new ReferenceFastEmaAffectProducer();
      const delta = await isolated.produceAffectDelta(observationInputOf(appraisalOf()));
      fingerprints.push(fingerprint(delta));
    }
    expect(new Set(fingerprints).size).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// U2 strength / U3 routing / U4 attribution independence
// ---------------------------------------------------------------------------

describe("FAST_EMA_V0 observation bridge (contract §5–§6)", () => {
  it("U2: strength = clamp01(relevance * intensity)", async () => {
    const delta = await producer.produceAffectDelta(observationInputOf(appraisalOf()));
    expect(delta.producer).toBe("affect");
    expect(delta.domain).toBe("affect");
    expect(delta.expected_repository_revision).toBeNull();
    expect(delta.operations.map((op) => op.path)).toEqual(["/affect", "/mood"]);
    expect(delta.provenance_refs).toEqual(["appraisal:ap-1"]);

    const affect = affectOf(delta);
    expect(affect.generated_under_profile).toBe("FAST_EMA_V0");
    expect(affect.updated_at).toBe(0);
    expect(affect.active_channels).toHaveLength(1);
    const channel = firstChannel(affect);
    // strength = 1 * 0.8 = 0.8; goal_congruence 0.9 ⇒ joy.
    expect(channel.channel_id).toBe("joy");
    expect(channel.intensity).toBe(1 * 0.8);
    expect(channel.phase).toBe("ACTIVE");
    expect(channel.started_at).toBe(0);
    expect(channel.source_appraisal_ref).toBe("appraisal:ap-1");

    // mood is EMA-derived (never directly assigned): 0 + 0.06 * (0.8 - 0).
    const mood = moodOf(delta);
    expect(mood.baseline).toBe(0.06 * (0.8 - 0));
    expect(mood.generated_under_profile).toBe("FAST_EMA_V0");
    expect(mood.last_update).toBe(0);
  });

  it("U3: routing table exact branch boundaries", async () => {
    const joy = await producer.produceAffectDelta(observationInputOf(appraisalOf({ goal_congruence: 0.9 })));
    expect(firstChannel(affectOf(joy)).channel_id).toBe("joy");

    const neutral = await producer.produceAffectDelta(observationInputOf(appraisalOf({ goal_congruence: 0.5 })));
    expect(affectOf(neutral).active_channels).toEqual([]);
    expect(moodOf(neutral).baseline).toBe(0);

    const fear = await producer.produceAffectDelta(
      observationInputOf(appraisalOf({ goal_congruence: 0.2, uncertainty: 0.9, controllability: 0.1 }))
    );
    expect(firstChannel(affectOf(fear)).channel_id).toBe("fear");

    const anger = await producer.produceAffectDelta(
      observationInputOf(appraisalOf({ goal_congruence: 0.2, uncertainty: 0.2, controllability: 0.1 }))
    );
    expect(firstChannel(affectOf(anger)).channel_id).toBe("anger");

    const sadness = await producer.produceAffectDelta(
      observationInputOf(appraisalOf({ goal_congruence: 0.2, uncertainty: 0.2, controllability: 0.8 }))
    );
    expect(firstChannel(affectOf(sadness)).channel_id).toBe("sadness");

    const boundaryAnger = await producer.produceAffectDelta(
      observationInputOf(appraisalOf({ goal_congruence: 0.2, uncertainty: 0.5, controllability: 0.5 }))
    );
    // uncertainty == 0.5 and controllability == 0.5: neither fear nor anger ⇒ sadness.
    expect(firstChannel(affectOf(boundaryAnger)).channel_id).toBe("sadness");
  });

  it("U3: zero strength activates nothing (identity delta)", async () => {
    const zeroIntensity = await producer.produceAffectDelta(observationInputOf(appraisalOf({ intensity: 0 })));
    expect(fingerprint(zeroIntensity)).toContain('"generated_under_profile":null');
    expect(affectOf(zeroIntensity).active_channels).toEqual([]);
    expect(moodOf(zeroIntensity).baseline).toBe(0);
  });

  it("U4: attribution independence — same inputs except attribution ⇒ byte-identical output (all three closed-enum literals, P2.3.5.0b)", async () => {
    const base = { goal_congruence: 0.2, uncertainty: 0.2, controllability: 0.8 };
    const self = await producer.produceAffectDelta(
      observationInputOf(appraisalOf({ attribution: "self", ...base }))
    );
    const other = await producer.produceAffectDelta(
      observationInputOf(appraisalOf({ attribution: "other", ...base }))
    );
    const situation = await producer.produceAffectDelta(
      observationInputOf(appraisalOf({ attribution: "situation", ...base }))
    );
    expect(fingerprint(self)).toBe(fingerprint(other));
    expect(fingerprint(other)).toBe(fingerprint(situation));
  });

  it("U4: every categorical attribution literal never enters any branch (joy path)", async () => {
    const a = await producer.produceAffectDelta(observationInputOf(appraisalOf({ attribution: "self" })));
    const b = await producer.produceAffectDelta(observationInputOf(appraisalOf({ attribution: "other" })));
    expect(fingerprint(a)).toBe(fingerprint(b));
  });
});

// ---------------------------------------------------------------------------
// U5 history dependence
// ---------------------------------------------------------------------------

describe("FAST_EMA_V0 history dependence", () => {
  it("U5: same appraisal over different persistent states yields different deltas", async () => {
    const historyless = await producer.produceAffectDelta(observationInputOf(appraisalOf()));

    const withHistory = s0State({
      mood: { baseline: 0.2, generated_under_profile: "FAST_EMA_V0", last_update: 3 },
      affect: {
        active_channels: [
          {
            channel_id: "fear",
            intensity: 0.5,
            phase: "ACTIVE",
            started_at: 2,
            source_appraisal_ref: "appraisal:ap-old"
          }
        ],
        generated_under_profile: "FAST_EMA_V0",
        updated_at: 3
      }
    });
    const input: AffectProducerInputV0 = {
      context: ctxAt(4),
      snapshot: withHistory,
      transition_type: "Observation",
      appraisal: appraisalOf(),
      elapsed_ticks: null
    };
    const historical = await producer.produceAffectDelta(input);

    expect(fingerprint(historical)).not.toBe(fingerprint(historyless));
    const affect = affectOf(historical);
    // Frozen channel order anger,fear,sadness,joy is preserved with two channels.
    expect(affect.active_channels.map((c) => c.channel_id)).toEqual(["fear", "joy"]);
    // EMA operates on the persistent baseline: 0.2 + 0.06 * (0.8 - 0.2).
    expect(moodOf(historical).baseline).toBe(0.2 + 0.06 * (0.8 - 0.2));
  });
});

// ---------------------------------------------------------------------------
// U6/U7/U8 closed-form release decay + U9 no floor + U10 EMA N-tick
// ---------------------------------------------------------------------------

/**
 * Contract-aligned mirror: §8 closed-form decay over the interval, then §10
 * option-A EMA recurrence (elapsed ticks, constant post-advance fast_level).
 * Mirrors the producer operation-for-operation so floats compare exactly.
 */
function mirrorTimeEvolution(params: {
  channels: readonly WorkingChannel[];
  mood: number;
  logicalTime: number;
  elapsed: number;
}) {
  const tHold = 60;
  const alpha = 0.06;
  const tau = 150;
  const evolved = params.channels.map((channel) => {
    const ageBefore = params.logicalTime - channel.started_at;
    const ageAfter = ageBefore + params.elapsed;
    const releaseTicks = Math.max(0, ageAfter - tHold) - Math.max(0, ageBefore - tHold);
    if (releaseTicks <= 0) return { ...channel };
    return {
      ...channel,
      phase: channel.phase === "ACTIVE" ? "RELEASING" : channel.phase,
      intensity: channel.intensity * Math.exp(-releaseTicks / tau)
    };
  });
  let fast = 0;
  for (const channel of evolved) {
    if (channel.intensity > fast) fast = channel.intensity;
  }
  let mood = params.mood;
  for (let step = 0; step < params.elapsed; step++) {
    mood = Math.min(0.25, Math.max(0, mood + alpha * (fast - mood)));
  }
  return { channels: evolved, fast, mood };
}

function releasingSnapshot(intensity: number, startedAt: number, logicalTime: number): SubjectStateV0 {
  return s0State({
    mood: { baseline: 0.2, generated_under_profile: "FAST_EMA_V0", last_update: logicalTime },
    affect: {
      active_channels: [
        {
          channel_id: "sadness",
          intensity,
          phase: "RELEASING",
          started_at: startedAt,
          source_appraisal_ref: "appraisal:ap-old"
        }
      ],
      generated_under_profile: "FAST_EMA_V0",
      updated_at: logicalTime
    }
  });
}

describe("FAST_EMA_V0 time dynamics (contract §7–§10)", () => {
  it("U6: entire interval before tHold — no release decay", async () => {
    const snapshot = s0State({
      affect: {
        active_channels: [
          {
            channel_id: "joy",
            intensity: 0.8,
            phase: "ACTIVE",
            started_at: 0,
            source_appraisal_ref: "appraisal:ap-old"
          }
        ],
        generated_under_profile: "FAST_EMA_V0",
        updated_at: 0
      },
      mood: { baseline: 0, generated_under_profile: "FAST_EMA_V0", last_update: 0 }
    });
    const elapsed = 30; // age_after = 30 < tHold 60
    const delta = await producer.produceAffectDelta(timeInputOf(elapsed, snapshot));
    const expected = mirrorTimeEvolution({
      channels: [channelOf("joy", 0.8, "ACTIVE", 0)],
      mood: 0,
      logicalTime: 0,
      elapsed
    });
    const affect = affectOf(delta);
    expect(affect.active_channels).toHaveLength(1);
    const channel = firstChannel(affect);
    expect(channel.phase).toBe("ACTIVE");
    expect(channel.intensity).toBe(0.8);
    // fast_level = 0.8 (unchanged); EMA runs elapsed ticks toward it.
    expect(moodOf(delta).baseline).toBe(expected.mood);
    expect(affect.updated_at).toBe(elapsed);
    expect(delta.provenance_refs).toEqual([]);
  });

  it("U7: interval crosses tHold — only post-hold ticks decay", async () => {
    const snapshot = s0State({
      affect: {
        active_channels: [
          {
            channel_id: "joy",
            intensity: 0.8,
            phase: "ACTIVE",
            started_at: 0,
            source_appraisal_ref: "appraisal:ap-old"
          }
        ],
        generated_under_profile: "FAST_EMA_V0",
        updated_at: 0
      },
      mood: { baseline: 0.2, generated_under_profile: "FAST_EMA_V0", last_update: 0 }
    });
    const elapsed = 62; // release_ticks = (62 - 60) - 0 = 2
    const delta = await producer.produceAffectDelta(timeInputOf(elapsed, snapshot));
    const expected = mirrorTimeEvolution({
      channels: [channelOf("joy", 0.8, "ACTIVE", 0)],
      mood: 0.2,
      logicalTime: 0,
      elapsed
    });
    const channel = firstChannel(affectOf(delta));
    expect(channel.phase).toBe("RELEASING");
    expect(channel.intensity).toBe(0.8 * Math.exp(-2 / 150));
    expect(channel.started_at).toBe(0);
    expect(moodOf(delta).baseline).toBe(expected.mood);
  });

  it("U8: already RELEASING — full elapsed ticks decay closed-form", async () => {
    const logicalTime = 170;
    const startedAt = 100; // age_before = 70 ≥ tHold
    const elapsed = 20; // release_ticks == elapsed == 20
    const snapshot = releasingSnapshot(0.8, startedAt, logicalTime);
    const delta = await producer.produceAffectDelta({
      context: ctxAt(logicalTime),
      snapshot,
      transition_type: "Time",
      appraisal: null,
      elapsed_ticks: elapsed
    });
    const expected = mirrorTimeEvolution({
      channels: [channelOf("sadness", 0.8, "RELEASING", startedAt)],
      mood: 0.2,
      logicalTime,
      elapsed
    });
    const channel = firstChannel(affectOf(delta));
    expect(channel.phase).toBe("RELEASING");
    expect(channel.intensity).toBe(0.8 * Math.exp(-20 / 150));
    expect(moodOf(delta).baseline).toBe(expected.mood);
    expect(affectOf(delta).updated_at).toBe(logicalTime + elapsed);
  });

  it("U9: NO release-floor removal — mathematically positive intensity is retained", async () => {
    const logicalTime = 170;
    const startedAt = 100;
    const elapsed = 1000;
    const snapshot = releasingSnapshot(0.02, startedAt, logicalTime);
    const delta = await producer.produceAffectDelta({
      context: ctxAt(logicalTime),
      snapshot,
      transition_type: "Time",
      appraisal: null,
      elapsed_ticks: elapsed
    });
    const expected = mirrorTimeEvolution({
      channels: [channelOf("sadness", 0.02, "RELEASING", startedAt)],
      mood: 0.2,
      logicalTime,
      elapsed
    });
    const affect = affectOf(delta);
    expect(affect.active_channels).toHaveLength(1);
    const channel = firstChannel(affect);
    expect(channel.intensity).toBeGreaterThan(0);
    expect(channel.intensity).toBe(0.02 * Math.exp(-1000 / 150));
    expect(moodOf(delta).baseline).toBe(expected.mood);
  });

  it("U10: EMA N-tick recurrence matches the contract for N=1, N=2, N=10", async () => {
    const alpha = 0.06;
    for (const elapsed of [1, 2, 10]) {
      const snapshot = s0State({
        mood: { baseline: 0.2, generated_under_profile: "FAST_EMA_V0", last_update: 0 }
      });
      const delta = await producer.produceAffectDelta(timeInputOf(elapsed, snapshot));
      // No channels ⇒ fast_level = 0 held constant across N ticks.
      let expected = 0.2;
      for (let step = 0; step < elapsed; step++) {
        expected = Math.min(0.25, Math.max(0, expected + alpha * (0 - expected)));
      }
      expect(moodOf(delta).baseline).toBe(expected);
      expect(moodOf(delta).baseline).not.toBe(0.2); // recurrence actually ran
    }
  });

  it("U10: Observation applies exactly ONE EMA step toward the post-event fast level", async () => {
    const delta = await producer.produceAffectDelta(observationInputOf(appraisalOf()));
    // One step only: 0 + 0.06 * (0.8 - 0) — NOT repeated across ticks.
    expect(moodOf(delta).baseline).toBe(0.06 * (0.8 - 0));
  });

  it("elapsed = 0 emits a legal byte-identical zero-effect delta", async () => {
    const snapshot = s0State({
      affect: {
        active_channels: [
          {
            channel_id: "joy",
            intensity: 0.4,
            phase: "ACTIVE",
            started_at: 0,
            source_appraisal_ref: "appraisal:ap-old"
          }
        ],
        generated_under_profile: "FAST_EMA_V0",
        updated_at: 0
      },
      mood: { baseline: 0.05, generated_under_profile: "FAST_EMA_V0", last_update: 0 }
    });
    const delta = await producer.produceAffectDelta(timeInputOf(0, snapshot));
    expect(fingerprint(affectOf(delta))).toBe(fingerprint(snapshot.affect));
    expect(fingerprint(moodOf(delta))).toBe(fingerprint(snapshot.mood));
  });
});

// ---------------------------------------------------------------------------
// U11 capacity policy (contract §14)
// ---------------------------------------------------------------------------

describe("FAST_EMA_V0 capacity policy (contract §14)", () => {
  it("U11: same-channel upsert does not grow the set", () => {
    const channels = [channelOf("anger", 0.5, "ACTIVE", 0), channelOf("joy", 0.9, "ACTIVE", 0)];
    const updated = applyChannelActivation(channels, "joy", 0.7, 10, "appraisal:ap-new");
    expect(updated.map((c) => c.channel_id)).toEqual(["anger", "joy"]);
    const joy = updated.find((c) => c.channel_id === "joy");
    if (joy === undefined) throw new Error("joy must exist");
    expect(joy.intensity).toBe(0.7);
    expect(joy.phase).toBe("ACTIVE");
    expect(joy.started_at).toBe(10);
    expect(joy.source_appraisal_ref).toBe("appraisal:ap-new");
  });

  it("U11: empty-slot fill appends in frozen order", () => {
    const filled = applyChannelActivation([channelOf("sadness", 0.5, "ACTIVE", 0)], "fear", 0.4, 5, "appraisal:ap-new");
    expect(filled.map((c) => c.channel_id)).toEqual(["fear", "sadness"]);
  });

  it("U11: full-capacity replacement picks the lowest intensity (internal fixture)", () => {
    // Over the closed 4-channel enum a 5th distinct channel is unreachable via
    // legal FAST_EMA_V0 inputs (contract §14 note), so the replacement rule is
    // proven executable through the exported victim selector: lowest intensity,
    // frozen-order tie-break.
    const channels = [
      channelOf("anger", 0.9, "ACTIVE", 0),
      channelOf("fear", 0.5, "ACTIVE", 0),
      channelOf("sadness", 0.5, "ACTIVE", 0),
      channelOf("joy", 0.7, "ACTIVE", 0)
    ];
    expect(victimIndexOfLowestIntensity(channels)).toBe(1); // fear: lowest 0.5, earliest in frozen order
  });

  it("U11: unique lowest intensity wins regardless of order position", () => {
    const channels = [
      channelOf("anger", 0.5, "ACTIVE", 0),
      channelOf("fear", 0.9, "ACTIVE", 0),
      channelOf("sadness", 0.3, "ACTIVE", 0),
      channelOf("joy", 0.7, "ACTIVE", 0)
    ];
    expect(victimIndexOfLowestIntensity(channels)).toBe(2); // sadness
  });

  it("U11: full set + present target stays within capacity via upsert (4 → 4)", () => {
    const full = [
      channelOf("anger", 0.5, "ACTIVE", 0),
      channelOf("fear", 0.8, "ACTIVE", 0),
      channelOf("sadness", 0.3, "ACTIVE", 0),
      channelOf("joy", 0.9, "ACTIVE", 0)
    ];
    const updated = applyChannelActivation(full, "joy", 0.99, 7, "appraisal:ap-new");
    expect(updated).toHaveLength(4);
    expect(updated.map((c) => c.channel_id)).toEqual(["anger", "fear", "sadness", "joy"]);
    const joy = updated.find((c) => c.channel_id === "joy");
    if (joy === undefined) throw new Error("joy must exist");
    expect(joy.intensity).toBe(0.99);
  });
});

// ---------------------------------------------------------------------------
// U12 fail-closed / U13 numeric hygiene / U14 immutability
// ---------------------------------------------------------------------------

describe("FAST_EMA_V0 fail-closed validation", () => {
  function withDefaults(defaults: Record<string, unknown>): SubjectStateV0 {
    return s0State({
      mechanismConfig: {
        affect_profile: { profile_id: "FAST_EMA_V0", timebase: "legacy_tick" },
        legacy_reference_defaults: defaults,
        feature_flags: {},
        thresholds: {}
      }
    });
  }

  const cases: Array<[string, Record<string, unknown>]> = [
    ["NaN alpha", { tHold: 60, alpha: Number.NaN, tau: 150, clamp: 0.25 }],
    ["Infinity tau", { tHold: 60, alpha: 0.06, tau: Number.POSITIVE_INFINITY, clamp: 0.25 }],
    ["zero tHold", { tHold: 0, alpha: 0.06, tau: 150, clamp: 0.25 }],
    ["clamp above frozen mood ceiling", { tHold: 60, alpha: 0.06, tau: 150, clamp: 0.5 }],
    ["negative tau", { tHold: 60, alpha: 0.06, tau: -1, clamp: 0.25 }]
  ];

  for (const [label, defaults] of cases) {
    it(`U12: rejects ${label} before producing any delta`, async () => {
      const snapshot = withDefaults(defaults);
      const input: AffectProducerInputV0 = {
        context: ctxAt(0),
        snapshot,
        transition_type: "Time",
        appraisal: null,
        elapsed_ticks: 5
      };
      await expect(producer.produceAffectDelta(input)).rejects.toThrow(/reference affect producer/);
    });
  }

  it("U12: rejects wrong profile id fail-closed", async () => {
    const snapshot = s0State({
      mechanismConfig: {
        affect_profile: { profile_id: "SOMETHING_ELSE", timebase: "legacy_tick" },
        legacy_reference_defaults: { tHold: 60, alpha: 0.06, tau: 150, clamp: 0.25 },
        feature_flags: {},
        thresholds: {}
      }
    });
    await expect(producer.produceAffectDelta(timeInputOf(5, snapshot))).rejects.toThrow(/FAST_EMA_V0/);
  });

  it("U12: rejects malformed input shapes fail-closed", async () => {
    // Observation without appraisal.
    await expect(
      producer.produceAffectDelta({
        context: ctxAt(0),
        snapshot: s0State(),
        transition_type: "Observation",
        appraisal: null,
        elapsed_ticks: null
      })
    ).rejects.toThrow(/appraisal/);
    // Time carrying an appraisal.
    await expect(
      producer.produceAffectDelta({
        context: ctxAt(0),
        snapshot: s0State(),
        transition_type: "Time",
        appraisal: appraisalOf(),
        elapsed_ticks: 5
      })
    ).rejects.toThrow(/appraisal/);
    // Non-integer / negative elapsed.
    await expect(producer.produceAffectDelta(timeInputOf(1.5))).rejects.toThrow(/elapsed_ticks/);
    await expect(producer.produceAffectDelta(timeInputOf(-3))).rejects.toThrow(/elapsed_ticks/);
    // Out-of-range appraisal dimension.
    await expect(
      producer.produceAffectDelta(observationInputOf(appraisalOf({ intensity: 1.5 })))
    ).rejects.toThrow(/intensity/);
    // Wrong-kind appraisal ref.
    await expect(
      producer.produceAffectDelta(observationInputOf(appraisalOf({ appraisal_ref: "event:e-1" })))
    ).rejects.toThrow(/appraisal_ref/);
  });
});

describe("FAST_EMA_V0 numeric hygiene and immutability", () => {
  it("U13: extreme legal inputs stay inside frozen ranges with no -0/NaN/Infinity", async () => {
    const extreme = observationInputOf(appraisalOf({ relevance: 1, intensity: 1 }));
    const delta = await producer.produceAffectDelta(extreme);
    expect(firstChannel(affectOf(delta)).intensity).toBeLessThanOrEqual(1);
    expect(moodOf(delta).baseline).toBeLessThanOrEqual(0.25);
    assertNoMinusZero(delta);

    const saturated = s0State({
      mood: { baseline: 0.25, generated_under_profile: "FAST_EMA_V0", last_update: 0 },
      affect: {
        active_channels: [
          {
            channel_id: "fear",
            intensity: 1,
            phase: "RELEASING",
            started_at: 0,
            source_appraisal_ref: "appraisal:ap-old"
          }
        ],
        generated_under_profile: "FAST_EMA_V0",
        updated_at: 0
      }
    });
    const aged = await producer.produceAffectDelta(timeInputOf(100000, saturated));
    assertNoMinusZero(aged);
    for (const channel of affectOf(aged).active_channels) {
      expect(channel.intensity).toBeGreaterThanOrEqual(0);
      expect(channel.intensity).toBeLessThanOrEqual(1);
    }
    expect(moodOf(aged).baseline).toBeGreaterThanOrEqual(0);
    expect(moodOf(aged).baseline).toBeLessThanOrEqual(0.25);
  });

  it("U14: deeply frozen inputs survive both paths with unchanged bytes", async () => {
    const snapshot = s0State({
      mood: { baseline: 0.1, generated_under_profile: "FAST_EMA_V0", last_update: 0 },
      affect: {
        active_channels: [
          {
            channel_id: "fear",
            intensity: 0.5,
            phase: "ACTIVE",
            started_at: 0,
            source_appraisal_ref: "appraisal:ap-old"
          }
        ],
        generated_under_profile: "FAST_EMA_V0",
        updated_at: 0
      }
    });
    deepFreeze(snapshot);
    const appraisal = appraisalOf();
    deepFreeze(appraisal);
    const before = JSON.stringify(snapshot);

    const observation: AffectProducerInputV0 = {
      context: ctxAt(2),
      snapshot,
      transition_type: "Observation",
      appraisal,
      elapsed_ticks: null
    };
    deepFreeze(observation);
    await producer.produceAffectDelta(observation);

    const time: AffectProducerInputV0 = {
      context: ctxAt(2),
      snapshot,
      transition_type: "Time",
      appraisal: null,
      elapsed_ticks: 7
    };
    deepFreeze(time);
    await producer.produceAffectDelta(time);

    expect(JSON.stringify(snapshot)).toBe(before);
  });
});

// ---------------------------------------------------------------------------
// Boundary surface (contract §3)
// ---------------------------------------------------------------------------

describe("FAST_EMA_V0 boundary surface", () => {
  it("producer instances are stateless and expose only the port surface", () => {
    const instance = new ReferenceFastEmaAffectProducer();
    expect(Object.keys(instance)).toEqual([]);
    expect(typeof instance.produceAffectDelta).toBe("function");
    expect(Object.getPrototypeOf(instance) === ReferenceFastEmaAffectProducer.prototype).toBe(true);
  });
});
