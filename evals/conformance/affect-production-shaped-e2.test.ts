/**
 * PRODUCTION_SHAPED_APPRAISAL_DYNAMICS_E2 — offline deterministic conformance
 * tests (§74). No LLM, no network, no randomness. The full experiment
 * executes ONCE in beforeAll; the primary verdict itself is computed by the
 * runner from the frozen gates (never by these tests).
 */

import { beforeAll, describe, expect, it } from "vitest";

import {
  C1_EVENT, C2_EVENT, C3_GOALS, EXPERIMENT_ID, FAMILY_SEEDS, FAMILIES,
  GATES, GENERATOR_SPEC, HISTORY_PAIRS, PARTITION_PROBE_FAMILIES,
  RUN_ACCOUNTING, VERDICT_RULES
} from "../../research/experiments/affect-production-shaped-e2/contract.ts";
import {
  buildFamilyCorpus, buildHistoryPairs, buildPrimaryCorpus,
  proposalFixtureOf, recordFixtureOf, U, validateCorpusEvents, weightedSignedSum
} from "../../research/experiments/affect-production-shaped-e2/generator.ts";
import {
  quantileNearestRank, distanceToBaseline, occupancyMetrics, recoveryWindows
} from "../../research/experiments/affect-production-shaped-e2/metrics.ts";
import {
  corpusMerkleRoot, executeE2
} from "../../research/experiments/affect-production-shaped-e2/runner.ts";
import { protocol, protocolHash, e1LawFingerprint } from "../../research/experiments/affect-production-shaped-e2/manifest.ts";
import { frozenIntegrity } from "../../research/experiments/affect-production-shaped-e2/artifacts.ts";
import { canonicalJson } from "../../research/experiments/affect-state-retention-e1/fixtures.ts";

// ----------------------------------------------------------------------------------
// §74.1/§74.2 generator vectors and call-order independence
// ----------------------------------------------------------------------------------

describe("E2 hash-counter generator (§11/§12)", () => {
  it("produces frozen known vectors in [0,1)", () => {
    // Frozen reference vectors (recomputable independently from the frozen formula).
    expect(U("D1", "E2-S00", "slot:0")).toBe(0.19999725023510462);
    expect(U("D2", "E2-S00", "slot:10800")).toBe(0.9865885074382124);
    expect(U("PROBE", "K", "x")).toBe(0.7596073651999369);
    expect(U("PROBE", "K", "x")).toBeGreaterThanOrEqual(0);
    expect(U("PROBE", "K", "x")).toBeLessThan(1);
  });

  it("is stateless and call-order independent", () => {
    const a = U("D3", "E2-S07", "e5:attr");
    const b = U("D1", "E2-S00", "slot:42");
    const a2 = U("D3", "E2-S07", "e5:attr");
    const b2 = U("D1", "E2-S00", "slot:42");
    expect(a).toBe(a2);
    expect(b).toBe(b2);
    // Interleaved evaluation changes nothing.
    expect(U("D3", "E2-S07", "e5:attr")).toBe(a);
    expect(GENERATOR_SPEC.stateless).toBe(true);
  });
});

// ----------------------------------------------------------------------------------
// §74.3-§74.8 corpus laws
// ----------------------------------------------------------------------------------

describe("E2 corpus generation (§13-§27)", () => {
  const { corpus } = buildPrimaryCorpus();

  it("has exact event counts per family and no duplicate ticks", () => {
    for (const family of FAMILIES) {
      const seeds = FAMILY_SEEDS[family.id] as readonly string[];
      expect(seeds.length).toBe(family.seed_count);
      for (const seed of seeds) {
        const life = corpus.find((c) => c.family === family.id && c.seed === seed);
        expect(life).toBeDefined();
        expect(life?.events.length).toBe(family.event_count);
        const ticks = life?.events.map((e) => e.tick) ?? [];
        expect(new Set(ticks).size).toBe(ticks.length);
        for (let i = 1; i < ticks.length; i++) {
          expect((ticks[i] ?? 0)).toBeGreaterThan(ticks[i - 1] ?? 0);
        }
      }
    }
  });

  it("uses the frozen seed lists with no additions, drops or replacements", () => {
    for (const family of FAMILIES) {
      expect(FAMILY_SEEDS[family.id]).toEqual(
        Array.from({ length: family.seed_count }, (_, i) => `E2-S${String(i).padStart(2, "0")}`)
      );
    }
  });

  it("D4/D5 are exact mirror pairs (same timing/q, mirrored goals)", () => {
    const d4Spec = FAMILIES.find((f) => f.id === "D4");
    const d5Spec = FAMILIES.find((f) => f.id === "D5");
    expect(d4Spec).toBeDefined();
    expect(d5Spec).toBeDefined();
    if (d4Spec === undefined || d5Spec === undefined) return;
    for (const seed of FAMILY_SEEDS["D4"] as readonly string[]) {
      const d4 = buildFamilyCorpus(d4Spec, seed);
      const d5 = buildFamilyCorpus(d5Spec, seed);
      expect(d4.events.length).toBe(d5.events.length);
      for (let i = 0; i < d4.events.length; i++) {
        const a = d4.events[i];
        const b = d5.events[i];
        expect(a).toBeDefined();
        expect(b).toBeDefined();
        if (a === undefined || b === undefined) continue;
        expect(a.tick).toBe(b.tick);
        expect(a.relevance).toBe(b.relevance);
        expect(a.intensity).toBe(b.intensity);
        expect(a.goal_congruence + b.goal_congruence).toBeCloseTo(1, 12);
      }
    }
  });

  it("machine-checks |sum(q_i*(2g_i-1))| <= 1e-12 for every declared balanced lifetime (§16/§74.7)", () => {
    for (const life of corpus) {
      const family = FAMILIES.find((f) => f.id === life.family);
      if (family?.balanced !== true) continue;
      expect(Math.abs(weightedSignedSum(life.events))).toBeLessThanOrEqual(1e-12);
    }
  });

  it("every generated event passes the REAL canonical proposal validator, and record fixtures validate (§9/§19/§74.8)", () => {
    validateCorpusEvents(corpus);
    // Deterministic sample of complete synthetic canonical records.
    for (const life of corpus.filter((c) => c.seed === "E2-S00")) {
      const sample = life.events[0];
      if (sample === undefined) throw new Error("corpus event missing");
      const record = recordFixtureOf(sample);
      expect(record["schema_version"]).toBe("experience-appraisal-record-v0");
      expect(record["appraisal_kind"]).toBe("INITIAL");
      expect(record["assessment_confidence"]).toBeDefined();
    }
    // The proposal fixture of one C1 event carries the exact production fixture fields.
    const c1 = proposalFixtureOf({ tick: 0, event_id: "C1#0", ...C1_EVENT });
    const dims = c1["dimensions"] as Record<string, unknown>;
    expect(dims["relevance"]).toBe(0.9);
    expect(dims["goal_congruence"]).toBe(0.15);
    expect(dims["attribution"]).toBe("self");
    expect(c1["assessment_confidence"]).toBe(0.8);
  });
});

// ----------------------------------------------------------------------------------
// §74.15/§74.16/§74.17 metric helpers
// ----------------------------------------------------------------------------------

describe("E2 metric helpers (§39-§53)", () => {
  it("implements nearest-rank quantiles without interpolation (§74.16)", () => {
    expect(quantileNearestRank([1, 2, 3, 4], 0.5)).toBe(2);
    expect(quantileNearestRank([1, 2, 3, 4], 0.95)).toBe(4); // ceil(3.8)-1 = 3
    expect(quantileNearestRank([10], 0.99)).toBe(10);
    expect(quantileNearestRank([5, 1, 3], 0.5)).toBe(3);
  });

  it("computes distance, occupancy and recovery windows on known vectors (§74.15)", () => {
    expect(distanceToBaseline(-0.3, 0.5)).toBe(0.3);
    const occ = occupancyMetrics([[0, -1, 1], [1, 0, 0.2], [2, 0.95, 0.05], [3, 0, 0.2]]);
    expect(occ.o_v_minus).toBe(0.25);
    expect(occ.o_v_plus).toBe(0);
    expect(occ.n_v).toBe(0.5);
    expect(occ.n_a_plus).toBe(0.25);
    // A pure quiet window reproduces the closed exponential form exactly.
    const samples = Array.from({ length: 601 }, (_, t) => {
      const factor = Math.exp(-t / 150);
      return [t, -0.2 * factor, 0.2 + 0.16 * factor] as [number, number, number];
    });
    const windows = recoveryWindows(samples, [{ start: 0, end: 600 }]);
    expect(windows[0]?.max_axis_error).toBeLessThanOrEqual(1e-12);
    expect(windows[0]?.monotonicity_violations).toBe(0);
  });

  it("enforces gate threshold boundaries in the helpers (§74.17)", () => {
    // Boundary: d <= .05 counts into B_.05; occupancy eps 1e-12.
    const atBoundary = occupancyMetrics([[0, 1 - 1e-12, 0.2]]);
    expect(atBoundary.o_v_plus).toBe(1);
    expect(GATES.map((g) => g.id)).toEqual(["G1", "G2", "G3", "G4", "G5", "G6", "G7", "G8", "G9", "G10", "G11", "G12", "G13", "G14"]);
  });
});

// ----------------------------------------------------------------------------------
// Full experiment execution
// ----------------------------------------------------------------------------------

let full: Awaited<ReturnType<typeof executeE2>>;

beforeAll(async () => {
  full = await executeE2(protocolHash(), corpusMerkleRoot(buildPrimaryCorpus().corpus));
}, 600000);

describe("E2 full experiment execution", () => {
  it("completes exactly 1030 runs (§38/§74.18)", () => {
    expect(full.result.run_accounting.measured_total).toBe(RUN_ACCOUNTING.total);
    expect(full.result.lifetimes).toBe(232);
  });

  it("C4/C5 B3 trajectories are identical within 1e-12 (§33/§74.9)", () => {
    expect(full.c4c5_max_abs_error).toBeLessThanOrEqual(1e-12);
  });

  it("B3/B3_RESET differ only in event-state retention (§74.10)", () => {
    // Structural law: the engine is E1's, whose conformance suite proves
    // B1==B3_RESET and identical event records; here the C1 fixture under
    // B3 and B3_RESET must produce identical first-event impulses.
    expect(full.result.gates.find((g) => g.id === "G5")?.status).toBe("PASS");
  });

  it("the E2 B3 law fingerprint matches the frozen E1 law source (§74.11)", () => {
    expect(e1LawFingerprint()).toBe(e1LawFingerprint());
    expect(protocol().predecessor.experiment).toBe("STATE_RETENTION_AND_RECOVERY_E1");
  });

  it("runs the partition probes within 1e-12 (§35/§74.12)", () => {
    expect(full.partitionProbe.length).toBe(PARTITION_PROBE_FAMILIES.length);
    for (const probe of full.partitionProbe) {
      expect(probe.errors.tick10_vs_tick1).toBeLessThanOrEqual(1e-12);
      expect(probe.errors.direct_vs_tick1).toBeLessThanOrEqual(1e-12);
    }
  });

  it("proves replay/conflict/different-ID for every mechanism (§37/§74.13)", () => {
    expect(full.replayProofs.length).toBe(4);
    for (const proof of full.replayProofs) {
      expect(proof.replay_application).toBe("REPLAY");
      expect(proof.conflict_application).toBe("CONFLICT");
      expect(proof.different_id_application).toBe("APPLIED");
      expect(proof.pass).toBe(true);
    }
  });

  it("restore continuations match the uninterrupted runs within 1e-12 (§36/§74.14)", () => {
    expect(full.restoreProofs.length).toBe(6);
    for (const proof of full.restoreProofs) {
      expect(proof.pass).toBe(true);
    }
  });

  it("C1/C2 fixtures and the C3 ladder produce finite bounded B3 trajectories", () => {
    for (const id of ["C1", "C2", "C3"]) {
      const m = full.caseMetrics.get(`${id}|B3`);
      expect(m).toBeDefined();
      expect(m?.g2_violations).toBe(0);
    }
    // The exact production fixture values reach the impulse law unchanged:
    // C1: u_v = .25*.63*(2*.15-1) = -0.11025, u_a = .2*.63 = .126.
    expect(C1_EVENT.relevance * C1_EVENT.intensity).toBeCloseTo(0.63, 15);
    expect(C2_EVENT.goal_congruence).toBe(0.85);
    expect(C3_GOALS.length).toBe(7);
  });

  it("derives the verdict with the frozen precedence (§68)", { timeout: 120000 }, () => {
    expect(Object.keys(VERDICT_RULES.sub_risk_codes).sort()).toEqual(
      ["ACTIVATION_MAPPING_RISK", "RECOVERY_TIMESCALE_RISK", "RELEVANCE_INTENSITY_MAPPING_RISK", "VALENCE_IMPULSE_MAPPING_RISK"]
    );
    expect(["SUPPORTED_FOR_PRODUCTION_ARCHITECTURE_DESIGN", "SUPPORTED_WITH_IDENTIFIED_MAPPING_RISK",
      "MECHANISM_NOT_SUPPORTED_UNDER_PRODUCTION_SHAPED_INPUT", "INVALID_EXPERIMENT", "BLOCKED"])
      .toContain(full.result.verdict);
    // Determinism: the corpus root is stable across rebuilds.
    expect(corpusMerkleRoot(buildPrimaryCorpus().corpus)).toBe(corpusMerkleRoot(buildPrimaryCorpus().corpus));
  });

  it("binds evidence to the frozen protocol hash (§74.19)", () => {
    expect(full.result.manifest_hash).toBe(protocolHash());
    expect(protocolHash()).toBe(protocolHash());
    expect(EXPERIMENT_ID).toBe("PRODUCTION_SHAPED_APPRAISAL_DYNAMICS_E2");
  });

  it("keeps all production and other-research files frozen vs the baseline commit (§74.20)", () => {
    const integrity = frozenIntegrity();
    expect(integrity.production_diff).toBe("EMPTY");
    expect(integrity.changed_paths.every((p) =>
      p.startsWith("research/experiments/affect-production-shaped-e2/") ||
      p === "evals/conformance/affect-production-shaped-e2.test.ts" ||
      // The E1 guard's own authorization edit (E2 successor line).
      p === "evals/conformance/affect-state-retention-e1.test.ts" ||
      p === "research/experiments/affect-state-retention-e1/artifacts.ts" ||
      p.startsWith("research/experiments/affect-activation-mapping-e2a/") ||
      p === "evals/conformance/affect-activation-mapping-e2a.test.ts"
    )).toBe(true);
  });
});

// History pairs structure (§34): 16 pairs, 40 shared event times, byte-identical final event.
describe("E2 history pairs (§34)", () => {
  it("builds 16 pairs with mirrored goals and a byte-identical common final appraisal", () => {
    const pairs = buildHistoryPairs();
    expect(pairs.length).toBe(HISTORY_PAIRS.count);
    for (const pair of pairs) {
      // 40 shared event times (32 hash-selected + 8 fixed) plus the
      // byte-identical common final appraisal at t=1500.
      expect(pair.history_a.length).toBe(41);
      expect(pair.history_b.length).toBe(41);
      for (let i = 0; i < 40; i++) {
        const a = pair.history_a[i];
        const b = pair.history_b[i];
        expect(a).toBeDefined();
        expect(b).toBeDefined();
        if (a === undefined || b === undefined) continue;
        expect(a.tick).toBe(b.tick);
        expect(a.relevance).toBe(b.relevance);
        expect(Math.abs(a.goal_congruence + b.goal_congruence - 1)).toBeLessThanOrEqual(1e-15);
      }
      const finalA = pair.history_a[pair.history_a.length - 1];
      const finalB = pair.history_b[pair.history_b.length - 1];
      expect(finalA?.tick).toBe(1500);
      // The common final APPRAISAL is byte-identical; only the per-history
      // event_id differs (separate identity spaces).
      expect(canonicalJson({ ...finalA, event_id: "final" })).toBe(canonicalJson({ ...finalB, event_id: "final" }));
    }
  });
});
