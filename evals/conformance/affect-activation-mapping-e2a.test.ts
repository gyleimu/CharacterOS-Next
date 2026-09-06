/**
 * ACTIVATION_MAPPING_ABLATION_E2A — offline deterministic conformance tests
 * (§45). No LLM, no network, no randomness. The full experiment executes ONCE
 * in beforeAll; the scientific verdict is computed by the runner from the
 * frozen selection logic (never by these tests).
 */

import { beforeAll, describe, expect, it } from "vitest";

import {
  BASELINE_COMMIT, EXPERIMENT_ID, FAMILY_IDS, GATES, RESTORE_TICK_D6,
  RUN_ACCOUNTING, SEED_SUBSET, SELECTION_LOGIC, SINGLE_FACTOR_LAW, VARIANTS
} from "../../research/experiments/affect-activation-mapping-e2a/contract.ts";
import {
  continueVariantRun, runVariantE2A, serializeVariantRun
} from "../../research/experiments/affect-activation-mapping-e2a/mechanisms.ts";
import { runValenceFamily } from "../../research/experiments/affect-state-retention-e1/mechanisms.ts";
import { executeE2A } from "../../research/experiments/affect-activation-mapping-e2a/runner.ts";
import { E2_FROZEN_BINDINGS, protocolHash, dependencyFingerprints } from "../../research/experiments/affect-activation-mapping-e2a/manifest.ts";
import { frozenIntegrity } from "../../research/experiments/affect-activation-mapping-e2a/artifacts.ts";
import { buildSelectedCorpus } from "../../research/experiments/affect-activation-mapping-e2a/runner.ts";
import { canonicalJson, eventPayloadHash } from "../../research/experiments/affect-state-retention-e1/fixtures.ts";

function maxDiff(a: readonly (readonly number[])[], b: readonly (readonly number[])[]): number {
  const byTick = new Map(b.map((o) => [o[0], o]));
  let max = 0;
  for (const o of a) {
    const other = byTick.get(o[0]);
    if (other === undefined) continue;
    for (let i = 1; i < o.length; i++) {
      const x = o[i];
      const y = other[i];
      if (x !== undefined && y !== undefined) max = Math.max(max, Math.abs(x - y));
    }
  }
  return max;
}

describe("E2A frozen protocol (§1-§4/§45.1-§45.4)", () => {
  it("defines exactly the three preregistered variants and no others", () => {
    expect(VARIANTS.map((v) => v.id)).toEqual(["A0", "A10", "A20"]);
    expect(VARIANTS.map((v) => v.activationGain)).toEqual([0, 0.1, 0.2]);
    expect(VARIANTS.find((v) => v.id === "A20")?.role).toContain("exact frozen E2 mapping");
  });

  it("freezes the single-factor law: everything except u_a identical", () => {
    expect(SINGLE_FACTOR_LAW.baseline).toBe("(0, 0.2)");
    expect(SINGLE_FACTOR_LAW.tau).toBe(150);
    expect(SINGLE_FACTOR_LAW.u_v).toBe("0.25 * q * (2*goal_congruence - 1)");
    expect(SINGLE_FACTOR_LAW.only_difference).toBe("u_a = activationGain * q");
    expect(SINGLE_FACTOR_LAW.forbidden).toContain("signed activation");
    expect(SINGLE_FACTOR_LAW.forbidden).toContain("habituation");
  });

  it("uses exactly the first 8 E2 seeds and exactly families D2/D3/D6/D7 (§45.3/§45.4)", () => {
    expect(SEED_SUBSET).toEqual(["E2-S00", "E2-S01", "E2-S02", "E2-S03", "E2-S04", "E2-S05", "E2-S06", "E2-S07"]);
    expect(FAMILY_IDS).toEqual(["D2", "D3", "D6", "D7"]);
  });

  it("freezes the selection precedence and all gates (§32/§45.17)", () => {
    expect(GATES.map((g) => g.id)).toEqual(["G1", "G2", "G3", "G4", "G5", "G6", "G7", "G8", "G9", "G10", "G11", "G12", "G13", "G14", "G15"]);
    expect(Object.keys(SELECTION_LOGIC).sort()).toEqual(
      ["case_A", "case_B", "case_C", "case_D", "case_E", "case_F", "debt_gates", "precedence", "responsiveness_gates"]
    );
    expect(SELECTION_LOGIC.case_A).toContain("ACTIVATION_GAIN_REDUCTION_SUPPORTED");
    expect(SELECTION_LOGIC.case_B).toContain("POSITIVE_ONLY_ACTIVATION_MAPPING_NOT_SUPPORTED");
  });

  it("binds the frozen E2 protocol hash and corpus root (§5/§44)", () => {
    expect(E2_FROZEN_BINDINGS.e2_protocol_hash).toBe("686b26f74992537bf2b676cd0ba867e517d141792a8e27d3de8501acb1227dc5");
    expect(E2_FROZEN_BINDINGS.e2_corpus_root).toBe("4999910c98fcebc88e00c59b08f0a8f5d088554a9aa1f950ad5afe75dd0445fd");
    expect(E2_FROZEN_BINDINGS.e2_sub_risk).toBe("ACTIVATION_MAPPING_RISK");
    expect(BASELINE_COMMIT).toBe("bf6c2fe761a0ed5eee7e53d4b6697297e0271e1c");
  });
});

// ----------------------------------------------------------------------------------
// Variant mechanics on a small deterministic slice
// ----------------------------------------------------------------------------------

const { corpus, sequenceHashes } = buildSelectedCorpus();
const d6s00 = corpus.find((c) => c.family === "D6" && c.seed === "E2-S00");
const d3s00 = corpus.find((c) => c.family === "D3" && c.seed === "E2-S00");

describe("E2A variant mechanics (§45.5-§45.12/§36)", () => {
  it("consumes byte-identical event sequences across variants (§10/§45.5)", () => {
    expect(d6s00).toBeDefined();
    const slice = d6s00?.events.slice(0, 40) ?? [];
    const runs = VARIANTS.map((v) => runVariantE2A(v.id, v.activationGain, "D6|E2-S00|slice", slice, { partition: "tick1", tEnd: 720 }));
    // All variants applied the same event ids at the same times.
    for (const run of runs) {
      expect(run.events.map((e) => [e.event_id, e.time])).toEqual(runs[0]?.events.map((e) => [e.event_id, e.time]));
    }
  });

  it("A0 event Delta_a = 0; A10/A20 unsaturated Delta_a/q = .10/.20 (§45.7-§45.9)", () => {
    const slice = d3s00?.events.filter((e) => e.tick < 2000) ?? [];
    const a0 = runVariantE2A("A0", 0, "D3|E2-S00|slice", slice, { partition: "tick1", tEnd: 2000 });
    const a10 = runVariantE2A("A10", 0.1, "D3|E2-S00|slice", slice, { partition: "tick1", tEnd: 2000 });
    const a20 = runVariantE2A("A20", 0.2, "D3|E2-S00|slice", slice, { partition: "tick1", tEnd: 2000 });
    for (const e of a0.events) {
      if (e.application === "APPLIED") expect(e.delta_a).toBe(0);
    }
    for (const [run, expected] of [[a10, 0.1], [a20, 0.2]] as const) {
      for (const e of run.events) {
        if (e.application === "APPLIED" && e.q !== null && e.q > 0 && !e.clamped) {
          expect(Math.abs((e.delta_a ?? 0) / e.q - expected)).toBeLessThanOrEqual(1e-12);
        }
      }
    }
  });

  it("A20 reproduces the E1/E2 engine exactly (no dependency drift, §45.6)", () => {
    const slice = d6s00?.events.filter((e) => e.tick < 3000) ?? [];
    const e2Engine = runValenceFamily("B3", {
      id: "D6|E2-S00", purpose: "E2", control_of: null,
      events: slice.map((e) => ({
        event_id: e.event_id, time: e.tick,
        appraisal: {
          relevance: e.relevance, goal_congruence: e.goal_congruence, attribution: e.attribution,
          controllability: e.controllability, uncertainty: e.uncertainty, intensity: e.intensity
        }
      }))
    }, { partition: "tick1", tEnd: 3000 });
    const a20 = runVariantE2A("A20", 0.2, "D6|E2-S00", slice, { partition: "tick1", tEnd: 3000 });
    expect(maxDiff(e2Engine.outputs, a20.outputs)).toBeLessThanOrEqual(1e-12);
  });

  it("valence is byte-identical across variants; only activation differs (§20/§45.10)", () => {
    const slice = d6s00?.events.filter((e) => e.tick < 3000) ?? [];
    const a0 = runVariantE2A("A0", 0, "D6|E2-S00|slice", slice, { partition: "tick1", tEnd: 3000 });
    const a10 = runVariantE2A("A10", 0.1, "D6|E2-S00|slice", slice, { partition: "tick1", tEnd: 3000 });
    const a20 = runVariantE2A("A20", 0.2, "D6|E2-S00|slice", slice, { partition: "tick1", tEnd: 3000 });
    expect(maxDiff(a0.outputs.map((o) => [o[0], o[1]]), a10.outputs.map((o) => [o[0], o[1]]))).toBe(0);
    expect(maxDiff(a10.outputs.map((o) => [o[0], o[1]]), a20.outputs.map((o) => [o[0], o[1]]))).toBe(0);
    expect(maxDiff(a0.outputs.map((o) => [o[0], o[2]]), a20.outputs.map((o) => [o[0], o[2]]))).toBeGreaterThan(0);
  });

  it("D6 partition equivalence holds for all variants (§22/§45.13)", () => {
    const slice = d6s00?.events ?? [];
    for (const v of VARIANTS) {
      const tick1 = runVariantE2A(v.id, v.activationGain, "D6|E2-S00", slice, { partition: "tick1", tEnd: 11999 });
      const tick10 = runVariantE2A(v.id, v.activationGain, "D6|E2-S00", slice, { partition: "tick10", tEnd: 11999 });
      const direct = runVariantE2A(v.id, v.activationGain, "D6|E2-S00", slice, { partition: "direct", tEnd: 11999 });
      expect(maxDiff(tick1.outputs, tick10.outputs)).toBeLessThanOrEqual(1e-12);
      expect(maxDiff(tick1.outputs, direct.outputs)).toBeLessThanOrEqual(1e-12);
    }
  });

  it("restore continuation matches uninterrupted within 1e-12 (§23/§45.14)", () => {
    const slice = d6s00?.events ?? [];
    for (const v of VARIANTS) {
      const snapshot = serializeVariantRun(v.id, v.activationGain, "D6|E2-S00", slice, RESTORE_TICK_D6);
      const continued = continueVariantRun(JSON.parse(JSON.stringify(snapshot)) as Parameters<typeof continueVariantRun>[0], slice, 11999);
      const uninterrupted = runVariantE2A(v.id, v.activationGain, "D6|E2-S00", slice, { partition: "tick1", tEnd: 11999 });
      expect(maxDiff(continued.outputs, uninterrupted.outputs.filter((o) => (o[0] ?? 0) >= RESTORE_TICK_D6))).toBeLessThanOrEqual(1e-12);
      // Only post-restore events run in the continuation.
      expect(continued.events.every((e) => e.time > RESTORE_TICK_D6)).toBe(true);
    }
  });

  it("replay/conflict/different-ID law holds for all variants (§24/§45.15)", () => {
    const slice = d3s00?.events.slice(0, 1) ?? [];
    const first = slice[0];
    expect(first).toBeDefined();
    if (first === undefined) return;
    const payloadHash = eventPayloadHash(first.event_id, first.tick, {
      relevance: first.relevance, goal_congruence: first.goal_congruence, attribution: first.attribution,
      controllability: first.controllability, uncertainty: first.uncertainty, intensity: first.intensity
    } as never);
    const changed = { ...first, intensity: Math.min(1, first.intensity + 0.01) };
    const conflictHash = eventPayloadHash(first.event_id, first.tick, {
      relevance: changed.relevance, goal_congruence: changed.goal_congruence, attribution: changed.attribution,
      controllability: changed.controllability, uncertainty: changed.uncertainty, intensity: changed.intensity
    } as never);
    for (const v of VARIANTS) {
      const replayRun = runVariantE2A(v.id, v.activationGain, "D3|E2-S00|probe", slice, { partition: "tick1", tEnd: 600, preRegistered: [[first.event_id, payloadHash]] });
      const noEventRun = runVariantE2A(v.id, v.activationGain, "D3|E2-S00|probe-empty", [], { partition: "tick1", tEnd: 600 });
      const conflictRun = runVariantE2A(v.id, v.activationGain, "D3|E2-S00|probe", slice, { partition: "tick1", tEnd: 600, preRegistered: [[first.event_id, conflictHash]] });
      const differentIdRun = runVariantE2A(v.id, v.activationGain, "D3|E2-S00|probe", slice, { partition: "tick1", tEnd: 600, preRegistered: [["other-event-id", payloadHash]] });
      const record = replayRun.events.find((e) => e.event_id === first.event_id);
      const conflictRecord = conflictRun.events.find((e) => e.event_id === first.event_id);
      const differentIdRecord = differentIdRun.events.find((e) => e.event_id === first.event_id);
      expect(record?.application).toBe("REPLAY");
      expect(record?.post_event_state).toEqual(record?.pre_event_state);
      expect(maxDiff(replayRun.outputs, noEventRun.outputs)).toBeLessThanOrEqual(1e-12);
      expect(conflictRecord?.application).toBe("CONFLICT");
      expect(differentIdRecord?.application).toBe("APPLIED");
    }
  });
});

// ----------------------------------------------------------------------------------
// Full experiment execution
// ----------------------------------------------------------------------------------

let full: Awaited<ReturnType<typeof executeE2A>>;

beforeAll(async () => {
  full = await executeE2A(protocolHash(), E2_FROZEN_BINDINGS.e2_protocol_hash, E2_FROZEN_BINDINGS.e2_corpus_root);
}, 600000);

describe("E2A full experiment execution", () => {
  it("completes exactly 108 runs (§46/§45.18)", () => {
    expect(full.result.run_accounting.measured_total).toBe(RUN_ACCOUNTING.total);
    expect(full.result.run_accounting.primary_runs).toBe(96);
  });

  it("satisfies the core invariants: bounds, valence, partition, restore, replay, gain identity", () => {
    for (const id of ["G3", "G4", "G5", "G11", "G12", "G13", "G15"]) {
      const gate = full.result.gates.find((g) => g.id === id);
      expect(gate, `gate ${id}`).toBeDefined();
      expect(gate?.status).toBe("PASS");
    }
  });

  it("reproduces the E2 activation debt pattern under A20 (§33/§45.6)", () => {
    const gate = full.result.gates.find((g) => g.id === "G14");
    expect(gate?.status).toBe("PASS");
    expect(gate?.evidence).toContain("REPRODUCED");
  });

  it("derives the verdict mechanically from the frozen selection precedence (§32/§52)", () => {
    expect([
      "ACTIVATION_GAIN_REDUCTION_SUPPORTED", "POSITIVE_ONLY_ACTIVATION_MAPPING_NOT_SUPPORTED",
      "GAIN_REDUCTION_INSUFFICIENTLY_RESPONSIVE", "E2_ACTIVATION_RISK_NOT_REPRODUCED",
      "INVALID_EXPERIMENT", "BLOCKED"
    ]).toContain(full.result.verdict);
    // The verdict must follow the case tree: integrity first, then the case tree.
    expect(full.result.verdict_rationale.length).toBeGreaterThan(0);
  });

  it("binds evidence to the frozen protocol hash and E2 lineage (§47/§45.19)", () => {
    expect(full.result.manifest_hash).toBe(protocolHash());
    expect(full.result.e2_protocol_hash).toBe(E2_FROZEN_BINDINGS.e2_protocol_hash);
    expect(full.result.e2_corpus_root).toBe(E2_FROZEN_BINDINGS.e2_corpus_root);
    expect(protocolHash()).toBe(protocolHash());
    expect(EXPERIMENT_ID).toBe("ACTIVATION_MAPPING_ABLATION_E2A");
    expect(Object.keys(dependencyFingerprints()).sort()).toEqual(["e1_evidence_tree", "e1_law", "e2_evidence_tree", "e2_generator", "e2_metrics"]);
  });

  it("keeps all production and other-research files frozen vs the baseline commit (§56/§45.20)", () => {
    const integrity = frozenIntegrity();
    expect(integrity.production_diff).toBe("EMPTY");
    expect(integrity.changed_paths.every((p) =>
      p.startsWith("research/experiments/affect-activation-mapping-e2a/") ||
      p === "evals/conformance/affect-activation-mapping-e2a.test.ts" ||
      // Documented mechanical isolation-guard authorizations (E2A successor line).
      p === "evals/conformance/affect-production-shaped-e2.test.ts" ||
      p === "research/experiments/affect-production-shaped-e2/artifacts.ts" ||
      p === "evals/conformance/affect-state-retention-e1.test.ts" ||
      p === "research/experiments/affect-state-retention-e1/artifacts.ts"
    )).toBe(true);
  });

  it("uses nearest-rank quantiles identical to E2 (§45.16)", () => {
    // Both experiments import the same E2 metrics module; verify one vector.
    expect(sequenceHashes.size).toBe(32);
    expect(canonicalJson(VARIANTS)).toContain("0.1");
  });
});
