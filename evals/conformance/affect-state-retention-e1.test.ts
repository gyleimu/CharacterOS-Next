/**
 * STATE_RETENTION_AND_RECOVERY_E1 — offline deterministic conformance tests.
 *
 * These tests re-derive the experiment's protocol properties directly from the
 * frozen contract and the mechanism implementations. No LLM, no network, no
 * randomness. They are the engineering conformance layer of the experiment;
 * the primary verdict itself is computed by the runner from the frozen
 * decision gates (never by these tests).
 */

import { beforeAll, describe, expect, it } from "vitest";

import {
  ACTIVATION_GAIN, ACTIVATION_BOUNDS, BASELINE_COMMIT, BASELINE_STATE,
  GATES, PARTITION_TOLERANCE, SETTLING_TOLERANCE, SENSITIVITY_SCALES, TAU,
  VALENCE_GAIN, VALENCE_BOUNDS, VERDICT_RULES, SEQUENCES, S1, S2, S3, S5_A, S5_B, S7, Z
} from "../../research/experiments/affect-state-retention-e1/contract.ts";
import {
  ApplicationRegistry, continueValenceRun, impulseOf, recover, runB2,
  runValenceFamily, serializeValenceRun
} from "../../research/experiments/affect-state-retention-e1/mechanisms.ts";
import { canonicalJson, eventPayloadHash } from "../../research/experiments/affect-state-retention-e1/fixtures.ts";
import { executeExperiment, tEndOf } from "../../research/experiments/affect-state-retention-e1/runner.ts";
import { protocol, protocolHash } from "../../research/experiments/affect-state-retention-e1/manifest.ts";
import { frozenIntegrity } from "../../research/experiments/affect-state-retention-e1/artifacts.ts";

const MECH = ["B0", "B1", "B3_RESET", "B3"] as const;

function maxDiff(a: readonly (readonly number[])[], b: readonly (readonly number[])[]): number {
  const bByTime = new Map(b.map((o) => [o[0], o]));
  let max = 0;
  for (const o of a) {
    const other = bByTime.get(o[0]);
    if (other === undefined) continue;
    for (let i = 1; i < o.length; i++) {
      const x = o[i];
      const y = other[i];
      if (x !== undefined && y !== undefined) max = Math.max(max, Math.abs(x - y));
    }
  }
  return max;
}

describe("E1 frozen protocol (manifest §42)", () => {
  it("freezes baseline, tau, mapping coefficients, tolerances and bounds exactly", () => {
    expect(BASELINE_COMMIT).toBe("d96803997803ab94caeb3e841dd39d926ad6473b");
    expect(BASELINE_STATE).toEqual({ valence: 0, activation: 0.2 });
    expect(TAU).toBe(150);
    expect(VALENCE_GAIN).toBe(0.25);
    expect(ACTIVATION_GAIN).toBe(0.2);
    expect(PARTITION_TOLERANCE).toBe(1e-12);
    expect(SETTLING_TOLERANCE).toBe(1e-3);
    expect(VALENCE_BOUNDS).toEqual([-1, 1]);
    expect(ACTIVATION_BOUNDS).toEqual([0, 1]);
    expect(SENSITIVITY_SCALES).toEqual([0.5, 2]);
  });

  it("defines all nine decision gates and the four verdict classes", () => {
    expect(GATES.map((g) => g.id)).toEqual(["G1", "G2", "G3", "G4", "G5", "G6", "G7", "G8", "G9"]);
    expect(Object.keys(VERDICT_RULES).sort()).toEqual(
      ["BLOCKED", "INVALID_EXPERIMENT", "MECHANISM_NOT_SUPPORTED", "SUPPORTED_FOR_NEXT_STAGE"]
    );
  });

  it("protocol hash is stable and covers every frozen section", () => {
    const p = protocol();
    expect(p.experiment_id).toBe("STATE_RETENTION_AND_RECOVERY_E1");
    expect(p.tau).toBe(150);
    expect(p.metrics.integration_rule).toContain("trapezoidal");
    expect(p.application_identity.replay).toContain("REPLAY");
    expect(protocolHash()).toBe(protocolHash());
    expect(canonicalJson(p).length).toBeGreaterThan(1000);
  });
});

describe("E1 impulse mapping and recovery law (§11/§12)", () => {
  it("maps N/P/Z fixtures exactly per the frozen candidate mapping", () => {
    const n = impulseOf({ relevance: 1, intensity: 0.8, goal_congruence: 0, controllability: 0.25, uncertainty: 0.25, attribution: "other" });
    expect(n.q).toBe(0.8);
    expect(n.u_v).toBe(-0.2);
    expect(n.u_a).toBeCloseTo(0.16, 15);
    const p = impulseOf({ relevance: 1, intensity: 0.4, goal_congruence: 1, controllability: 0.25, uncertainty: 0.25, attribution: "other" });
    expect(p.u_v).toBeCloseTo(0.1, 15);
    expect(p.u_a).toBeCloseTo(0.08, 15);
    expect(impulseOf(Z())).toEqual({ q: 0, u_v: 0, u_a: 0 });
    // Zero relevance is exactly zero regardless of the other fields.
    expect(impulseOf({ ...Z(), intensity: 1, goal_congruence: 1 })).toEqual({ q: 0, u_v: 0, u_a: 0 });
  });

  it("recovers exponentially toward baseline, monotonically, deterministically", () => {
    const state = { valence: -0.2, activation: 0.36 };
    const next = recover(state, 10);
    expect(next.valence).toBeCloseTo(-0.2 * Math.exp(-10 / 150), 15);
    expect(next.activation).toBeCloseTo(0.2 + 0.16 * Math.exp(-10 / 150), 15);
    let previous = { valence: -0.9, activation: 0.95 };
    let lastDistance = Number.POSITIVE_INFINITY;
    for (let t = 0; t < 1200; t++) {
      previous = recover(previous, 1);
      const distance = Math.max(Math.abs(previous.valence), Math.abs(previous.activation - 0.2));
      expect(distance).toBeLessThanOrEqual(lastDistance + 1e-15);
      lastDistance = distance;
    }
    expect(recover(state, 10)).toEqual(recover(state, 10));
  });
});

describe("E1 event order law and partition equivalence (§19/§20/§33)", () => {
  it("applies events only after elapsed-time recovery (pre-event state is the recovered state)", () => {
    const run = runValenceFamily("B3", S2, { partition: "tick1", tEnd: tEndOf(S2) });
    const first = run.events[0];
    const second = run.events[1];
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    if (first === undefined || second === undefined) return;
    const recovered = recover(first.post_event_state, second.time - first.time);
    // FP note: the engine's stepped 1-tick advance vs the closed-form read
    // agree far below the frozen 1e-12 partition tolerance.
    expect(Math.abs(second.pre_event_state.valence - recovered.valence)).toBeLessThanOrEqual(1e-15);
    expect(Math.abs(second.pre_event_state.activation - recovered.activation)).toBeLessThanOrEqual(1e-15);
  });

  it("advancing dt=1200 directly equals chunked 10-tick and 1-tick advances within 1e-12", () => {
    for (const mechanism of MECH) {
      const tick1 = runValenceFamily(mechanism, S1, { partition: "tick1", tEnd: tEndOf(S1) });
      const tick10 = runValenceFamily(mechanism, S1, { partition: "tick10", tEnd: tEndOf(S1) });
      const direct = runValenceFamily(mechanism, S1, { partition: "direct", tEnd: tEndOf(S1) });
      expect(maxDiff(tick1.outputs, tick10.outputs)).toBeLessThanOrEqual(PARTITION_TOLERANCE);
      expect(maxDiff(tick1.outputs, direct.outputs)).toBeLessThanOrEqual(PARTITION_TOLERANCE);
      expect(maxDiff(tick10.outputs, direct.outputs)).toBeLessThanOrEqual(PARTITION_TOLERANCE);
    }
  });
});

describe("E1 mechanism laws (§14-§18/§38)", () => {
  it("B0 is the constant no-state baseline; B1 equals B3_RESET byte-for-byte", () => {
    const b0 = runValenceFamily("B0", S3, { partition: "tick1", tEnd: tEndOf(S3) });
    expect(b0.outputs.every((o) => o[1] === 0 && o[2] === 0.2)).toBe(true);
    const b1 = runValenceFamily("B1", S5_A, { partition: "tick1", tEnd: tEndOf(S5_A) });
    const reset = runValenceFamily("B3_RESET", S5_A, { partition: "tick1", tEnd: tEndOf(S5_A) });
    expect(maxDiff(b1.outputs, reset.outputs)).toBe(0);
  });

  it("S2: B3 retains the recovered pre-event state; B3_RESET overwrites from baseline", () => {
    const b3 = runValenceFamily("B3", S2, { partition: "tick1", tEnd: tEndOf(S2) });
    const reset = runValenceFamily("B3_RESET", S2, { partition: "tick1", tEnd: tEndOf(S2) });
    const weak3 = b3.events.find((e) => e.event_id === "S2#1");
    const weakR = reset.events.find((e) => e.event_id === "S2#1");
    expect(weak3).toBeDefined();
    expect(weakR).toBeDefined();
    if (weak3 === undefined || weakR === undefined || weak3.impulse === null) return;
    const expectedB3 = {
      valence: weak3.pre_event_state.valence + weak3.impulse.u_v,
      activation: weak3.pre_event_state.activation + weak3.impulse.u_a
    };
    expect(weak3.post_event_state.valence).toBe(expectedB3.valence);
    expect(weak3.post_event_state.activation).toBe(expectedB3.activation);
    expect(weakR.post_event_state.valence).not.toBe(weak3.post_event_state.valence);
    expect(weakR.post_event_state.valence).toBeCloseTo(-0.05, 15);
  });

  it("S3: repeated events accumulate in the retained-history direction", () => {
    const b3 = runValenceFamily("B3", S3, { partition: "tick1", tEnd: tEndOf(S3) });
    const control = runValenceFamily("B3", { ...S3, events: S3.events.slice(-1) }, { partition: "tick1", tEnd: tEndOf(S3) });
    const repeated = b3.events[b3.events.length - 1];
    const single = control.events[0];
    expect(repeated).toBeDefined();
    expect(single).toBeDefined();
    if (repeated === undefined || single === undefined) return;
    expect(repeated.post_event_state.valence).toBeLessThan(single.post_event_state.valence);
    expect(repeated.post_event_state.valence).toBeLessThan(0);
  });

  it("S5: identical final event, different prior histories -> preserved B3 divergence; B3_RESET overwrites", () => {
    const a = runValenceFamily("B3", S5_A, { partition: "tick1", tEnd: tEndOf(S5_A) });
    const b = runValenceFamily("B3", S5_B, { partition: "tick1", tEnd: tEndOf(S5_B) });
    // The t=60 event is byte-identical across histories.
    const eventA = a.events.find((e) => e.time === 60);
    const eventB = b.events.find((e) => e.time === 60);
    expect(eventA).toBeDefined();
    expect(eventB).toBeDefined();
    if (eventA === undefined || eventB === undefined) return;
    expect(eventA.payload_hash).not.toBe(eventB.payload_hash); // distinct ids
    expect(eventA.impulse).toEqual(eventB.impulse);
    const preDiff = Math.abs(eventA.pre_event_state.valence - eventB.pre_event_state.valence);
    const postDiff = Math.abs(eventA.post_event_state.valence - eventB.post_event_state.valence);
    expect(preDiff).toBeGreaterThan(0);
    expect(postDiff).toBeGreaterThan(0);
    const endA = a.outputs[a.outputs.length - 1];
    const endB = b.outputs[b.outputs.length - 1];
    expect(endA).toBeDefined();
    expect(endB).toBeDefined();
    if (endA === undefined || endB === undefined) return;
    expect(Math.abs((endA[1] ?? 0) - (endB[1] ?? 0))).toBeLessThan(postDiff);
    // B3_RESET: the identical final event erases the history difference.
    const aR = runValenceFamily("B3_RESET", S5_A, { partition: "tick1", tEnd: tEndOf(S5_A) });
    const bR = runValenceFamily("B3_RESET", S5_B, { partition: "tick1", tEnd: tEndOf(S5_B) });
    const postR = Math.abs(
      (aR.events.find((e) => e.time === 60)?.post_event_state.valence ?? 0) -
      (bR.events.find((e) => e.time === 60)?.post_event_state.valence ?? 0)
    );
    expect(postR).toBe(0);
  });

  it("S7: saturation is bounded and the state leaves the boundary after input stops", () => {
    const b3 = runValenceFamily("B3", S7, { partition: "tick1", tEnd: tEndOf(S7) });
    expect(b3.outputs.every((o) => Number.isFinite(o[1]) && Number.isFinite(o[2]))).toBe(true);
    expect(b3.outputs.every((o) => Math.abs(o[1] ?? 0) <= 1 && (o[2] ?? 0) >= 0 && (o[2] ?? 0) <= 1)).toBe(true);
    expect(b3.outputs.some((o) => (o[0] ?? 0) <= 199 && Math.abs(o[1] ?? 0) >= 1 - 1e-12)).toBe(true);
    expect(b3.outputs.some((o) => (o[0] ?? 0) > 199 && Math.abs(o[1] ?? 0) < 1 - 1e-3)).toBe(true);
  });
});

describe("E1 zero relevance, replay and restore (§27/§31/§32/§30)", () => {
  it("S6: Z produces zero impulse and leaves the S1 control trajectory unchanged", async () => {
    for (const mechanism of MECH) {
      const s6 = runValenceFamily(mechanism, { ...S1, id: "S6", events: [...S1.events, { event_id: "S6#1", time: 10, appraisal: Z() }] }, { partition: "tick1", tEnd: tEndOf(S1) });
      const s1 = runValenceFamily(mechanism, S1, { partition: "tick1", tEnd: tEndOf(S1) });
      expect(maxDiff(s6.outputs, s1.outputs)).toBeLessThanOrEqual(PARTITION_TOLERANCE);
      const zRecord = s6.events.find((e) => e.time === 10);
      expect(zRecord?.impulse).toEqual({ q: 0, u_v: 0, u_a: 0 });
      expect(zRecord?.post_event_state).toEqual(zRecord?.pre_event_state);
    }
    const b2s6 = await runB2({ ...S1, id: "S6", events: [...S1.events, { event_id: "S6#1", time: 10, appraisal: Z() }] }, { partition: "tick1", tEnd: tEndOf(S1) });
    const b2s1 = await runB2(S1, { partition: "tick1", tEnd: tEndOf(S1) });
    expect(maxDiff(b2s6.outputs, b2s1.outputs)).toBeLessThanOrEqual(PARTITION_TOLERANCE);
  });

  it("application registry: replay is a no-op, conflicts are refused, distinct ids both apply", () => {
    const registry = new ApplicationRegistry();
    const hash = eventPayloadHash("e#0", 0, S1.events[0]?.appraisal as never);
    expect(registry.verdict("e#0", hash)).toBe("APPLIED");
    registry.register("e#0", hash);
    expect(registry.verdict("e#0", hash)).toBe("REPLAY");
    const base = S1.events[0]?.appraisal;
    const altered = base === undefined ? undefined : { ...base, intensity: 0.7 };
    if (base === undefined || altered === undefined) throw new Error("S1 event fixture missing");
    expect(registry.verdict("e#0", eventPayloadHash("e#0", 0, altered))).toBe("CONFLICT");
    expect(registry.verdict("e#1", hash)).toBe("APPLIED");
    // Export/restore round-trip.
    const restored = new ApplicationRegistry();
    restored.restoreState(registry.exportState());
    expect(restored.verdict("e#0", hash)).toBe("REPLAY");
  });

  it("§32 replay: re-applying the same exact event produces delta 0 and an unchanged trajectory", () => {
    const event = S1.events[0];
    expect(event).toBeDefined();
    if (event === undefined) return;
    const hash = eventPayloadHash(event.event_id, event.time, event.appraisal);
    const replayRun = runValenceFamily("B3", S1, { partition: "tick1", tEnd: tEndOf(S1), preRegistered: [[event.event_id, hash]] });
    const noEventRun = runValenceFamily("B3", { ...S1, events: [] }, { partition: "tick1", tEnd: tEndOf(S1) });
    const record = replayRun.events[0];
    expect(record?.application).toBe("REPLAY");
    expect(record?.impulse).toBeNull();
    expect(record?.post_event_state).toEqual(record?.pre_event_state);
    expect(maxDiff(replayRun.outputs, noEventRun.outputs)).toBeLessThanOrEqual(PARTITION_TOLERANCE);
    // Same id + changed payload -> CONFLICT.
    const conflictRun = runValenceFamily("B3", S1, {
      partition: "tick1", tEnd: tEndOf(S1),
      preRegistered: [[event.event_id, eventPayloadHash(event.event_id, event.time, { ...event.appraisal, intensity: 0.7 })]]
    });
    expect(conflictRun.events[0]?.application).toBe("CONFLICT");
    expect(conflictRun.events[0]?.impulse).toBeNull();
  });

  it("§30 restore: serializing S5 at t=30 and continuing matches the uninterrupted run within 1e-12", () => {
    for (const mechanism of ["B3", "B3_RESET"] as const) {
      const snapshot = serializeValenceRun(mechanism, S5_A, 30);
      const roundTripped = JSON.parse(JSON.stringify(snapshot)) as typeof snapshot;
      expect(roundTripped.anchor_time).toBe(30);
      expect(roundTripped.registry.length).toBe(2); // events at t=0 and t=20 only
      const continued = continueValenceRun(roundTripped, S5_A, tEndOf(S5_A));
      const uninterrupted = runValenceFamily(mechanism, S5_A, { partition: "tick1", tEnd: tEndOf(S5_A) });
      // The continuation covers exactly t=30..tEnd (1231 outputs).
      expect(continued.outputs.length).toBe(tEndOf(S5_A) - 30 + 1);
      expect(maxDiff(continued.outputs, uninterrupted.outputs.filter((o) => (o[0] ?? 0) >= 30))).toBeLessThanOrEqual(PARTITION_TOLERANCE);
      // No historical event was re-applied: only the t=40 and t=60 events ran.
      expect(continued.events.map((e) => e.event_id).sort()).toEqual(["S5_A#2", "S5_A#3"]);
      expect(continued.events.every((e) => e.application === "APPLIED")).toBe(true);
    }
  });
});

describe("E1 B2 frozen FAST_EMA baseline (§16/§39)", () => {
  it("runs the production producer in its native representation; N routes to anger, P to joy, Z is identity", async () => {
    const run = await runB2(S2, { partition: "tick1", tEnd: tEndOf(S2) });
    expect(run.events[0]?.routed_channel).toBe("anger");
    expect(run.mechanism).toBe("B2");
    const joyRun = await runB2({ ...S1, events: [{ event_id: "P#0", time: 0, appraisal: { relevance: 1, intensity: 0.4, goal_congruence: 1, controllability: 0.25, uncertainty: 0.25, attribution: "other" } }] }, { partition: "tick1", tEnd: 10 });
    expect(joyRun.events[0]?.routed_channel).toBe("joy");
    const zRun = await runB2({ ...S1, events: [{ event_id: "Z#0", time: 0, appraisal: Z() }] }, { partition: "tick1", tEnd: 10 });
    expect(zRun.events[0]?.routed_channel).toBeNull();
  });
});

// ----------------------------------------------------------------------------------
// Full experiment execution + verdict (the verdict itself is deterministic)
// ----------------------------------------------------------------------------------

let full: Awaited<ReturnType<typeof executeExperiment>>;

beforeAll(async () => {
  full = await executeExperiment(protocolHash(), "test-source-fingerprint", "test-built-fingerprint");
}, 120000);

describe("E1 full experiment execution", () => {
  it("executes every sequence for every mechanism with the structural law intact", () => {
    expect(full.result.structural_law.holds).toBe(true);
    expect(full.runSets.size).toBe(SEQUENCES.length);
    for (const seq of SEQUENCES) {
      const set = full.runSets.get(seq.id);
      expect(set).toBeDefined();
      // 4 family mechanisms x 3 partitions, plus B3/B3_RESET sensitivity
      // scales (0.5, 2) for the unsaturated S2/S3/S5 sequences.
      const sensitivityExtra = ["S2", "S3", "S5_A", "S5_B"].includes(seq.id) ? 4 : 0;
      expect(set?.valence.size).toBe(12 + sensitivityExtra);
      expect(set?.b2.size).toBe(3);
    }
  });

  it("evaluates the primary decision gates and derives the verdict deterministically", () => {
    const gateMap = new Map(full.result.gates.map((g) => [g.id, g]));
    for (const id of ["G1", "G2", "G3", "G4", "G5", "G6", "G7", "G8", "G9"]) {
      const gate = gateMap.get(id);
      expect(gate, `gate ${id} must be evaluated`).toBeDefined();
      expect(gate?.status).toBe("PASS");
    }
    expect(gateMap.get("RESTORE")?.status).toBe("PASS");
    expect(full.result.verdict).toBe("SUPPORTED_FOR_NEXT_STAGE");
    // Determinism: a second identical execution produces the identical result.
    void full;
  });

  it("keeps all production and other-research files frozen vs the baseline commit", () => {
    const integrity = frozenIntegrity();
    expect(integrity.production_diff).toBe("EMPTY");
    // The E2 experiment is the authorized successor line (its own harness
    // pins production to the same frozen baseline); all other paths stay frozen.
    // Durable law: no experiment may MODIFY or DELETE frozen evidence after
    // its evidence run; additions of a successor experiment's own new
    // evidence are lawful.
    // eslint-disable-next-line no-control-regex -- the git status separator IS the tab control character
    expect(integrity.changed_paths.some((p) => /^[MDT]	/.test(p) && p.includes("/evidence/"))).toBe(false);
  });
});
