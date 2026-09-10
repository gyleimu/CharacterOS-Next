/**
 * CANONICAL_AFFECT_COMMUNICATION_DIRECTIVE_CAUSAL_EXPERIMENT_V0 — CI
 * conformance gate. Re-executes the deterministic Phase A in-process and
 * asserts the §37 gates with zero real provider generation calls: six frozen
 * scenarios (4 boundary + 2 hard controls), lawful ±0.25 valence histories
 * with equal activation, scenario ingress into the actual provider input,
 * non-Affect input equality, ablation equality, directive vocabulary, and
 * restore invariance.
 */

/* eslint-disable @typescript-eslint/no-non-null-assertion -- non-null assertions follow expects that already proved presence */
import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { executePhaseA } from "../../research/experiments/canonical-affect-communication-directive-causal-v0/harness.ts";
import { BOUNDARY_SCENARIOS, HARD_CONTROL_SCENARIOS, SCENARIOS } from "../../research/experiments/canonical-affect-communication-directive-causal-v0/contract.ts";

function roundValence(v: number): number {
  return Math.round(v * 1e6) / 1e6;
}

describe("CANONICAL_AFFECT_COMMUNICATION_DIRECTIVE_CAUSAL_EXPERIMENT_V0 — Phase A (§37)", () => {
  it("freezes 6 scenarios, lawful Affect, ingress, equality, ablation, restore — 0 real calls", async () => {
    const phaseA = await executePhaseA();
    // Scenario structure: exactly 4 boundary + 2 hard controls.
    expect(SCENARIOS.length).toBe(6);
    expect(BOUNDARY_SCENARIOS.length).toBe(4);
    expect(HARD_CONTROL_SCENARIOS.length).toBe(2);
    expect(phaseA.prepared.length).toBe(6);
    // Lawful Affect construction: ±0.25 valence, equal activation.
    for (const cell of phaseA.prepared) {
      expect(roundValence(cell.provider_inputs.A.canonical_affect.valence)).toBe(0.25);
      expect(roundValence(cell.provider_inputs.B.canonical_affect.valence)).toBe(-0.25);
      expect(roundValence(cell.provider_inputs.A.canonical_affect.activation)).toBe(0.348);
      expect(roundValence(cell.provider_inputs.B.canonical_affect.activation)).toBe(0.348);
      // Ablation equality: both ablated inputs identical.
      expect(cell.provider_inputs.ABL_A).toStrictEqual(cell.provider_inputs.ABL_B);
      // Non-Affect input equality between arms.
      const strip = (input: Record<string, unknown>) => {
        const { canonical_affect, projection_hash, ...rest } = input as Record<string, unknown>;
        void canonical_affect;
        void projection_hash;
        return rest;
      };
      expect(strip(cell.provider_inputs.A)).toStrictEqual(strip(cell.provider_inputs.B));
    }
    // Scenario ingress: semantics present in the actual provider input.
    const ingress = phaseA.artifacts.scenario_ingress_audit as { rows: { scenario_id: string; semantics_present: boolean }[] };
    expect(ingress.rows.length).toBe(6);
    for (const row of ingress.rows) expect(row.semantics_present).toBe(true);
    // Restore invariance.
    const restore = phaseA.artifacts.restore_controls as { status: string; provider_facing_input_identical: boolean };
    expect(restore.status).toBe("PASS");
    expect(restore.provider_facing_input_identical).toBe(true);
    // Phase A gate set.
    const phaseAState = phaseA.artifacts.phase_a as Record<string, unknown>;
    for (const [key, value] of Object.entries(phaseAState)) {
      if (key.startsWith("all_") || key.endsWith("_PASS") || value === "PASS") {
        if (typeof value === "string") expect(value).toBe("PASS");
        if (typeof value === "boolean") expect(value).toBe(true);
      }
    }
    expect(phaseA.artifacts.phase_a.real_provider_generation_calls).toBe(0);
  });

  it("RECONCILIATION: authoritative directive counts from raw trials (B1 5/5, boundary 5/20, overall 5/30, ablation 0/25)", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const evidenceDir = join(process.cwd(), "research/experiments/canonical-affect-communication-directive-causal-v0/evidence/run-1-real-provider");
    if (!existsSync(evidenceDir)) {
      console.log("evidence/run-1-real-provider not present (pre-collection checkout); skipping raw-trial reconciliation");
      return;
    }
    const trials = readFileSync(join(evidenceDir, "trials.jsonl"), "utf8")
      .split("\n").filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as {
        scenario_id: string; scenario_class: string; trial_ordinal: number; arm: string;
        cognition: { status: string; current_intent: string | null; communication_directive: string | null };
      });
    expect(trials.length).toBe(120);
    // Identity integrity.
    const ids = trials.map((t) => t.trial_id);
    expect(new Set(ids).size).toBe(120);
    // Stage-valid pair denominators.
    const units = new Map<string, { scenario_class: string; arms: Record<string, typeof trials[number]> }>();
    for (const t of trials) {
      const key = t.scenario_id + "|" + t.trial_ordinal;
      if (!units.has(key)) units.set(key, { scenario_id: t.scenario_id, scenario_class: t.scenario_class, arms: {} });
      units.get(key)!.arms[t.arm] = t;
      void units.get(key)!.scenario_class;
    }
    const allUnits = [...units.values()];
    const validPair = (u: { arms: Record<string, { cognition: { status: string; communication_directive: string | null; current_intent: string | null } }> }, x: string, y: string): boolean | null => {
      const a = u.arms[x]; const b = u.arms[y];
      if (!a || !b || a.cognition.status !== "VALID" || b.cognition.status !== "VALID") return null;
      return a.cognition.communication_directive !== b.cognition.communication_directive;
    };
    // Complete four-arm units: 25 (boundary 20, H1 0, H2 5).
    const complete = allUnits.filter((u) =>
      ["A", "B", "ABL_A", "ABL_B"].every((arm) => u.arms[arm] && u.arms[arm].cognition.status === "VALID"));
    expect(complete.length).toBe(25);
    expect(complete.filter((u) => u.scenario_class === "BOUNDARY").length).toBe(20);
    expect(complete.filter((u) => u.scenario_id.includes("H1")).length).toBe(0);
    expect(complete.filter((u) => u.scenario_id.includes("H2")).length).toBe(5);
    // Stage-valid treatment pairs: 30 (H1 contributes 5 valid A/B pairs).
    const treatPairs = allUnits.filter((u) => validPair(u, "A", "B") !== null);
    expect(treatPairs.length).toBe(30);
    // B1: treatment disagreement exactly 5/5.
    const b1 = allUnits.filter((u) => u.scenario_id.includes("B1"));
    const b1Diff = b1.filter((u) => validPair(u, "A", "B") === true).length;
    expect(b1.length).toBe(5);
    expect(b1Diff).toBe(5);
    // Boundary: 5/20 treatment disagreement; 0/20 ablation.
    const boundaryPairs = allUnits.filter((u) => u.scenario_class === "BOUNDARY" && validPair(u, "A", "B") !== null);
    const boundaryDiff = boundaryPairs.filter((u) => validPair(u, "A", "B") === true).length;
    expect(boundaryPairs.length).toBe(20);
    expect(boundaryDiff).toBe(5);
    const boundaryAblPairs = allUnits.filter((u) => u.scenario_class === "BOUNDARY" && validPair(u, "ABL_A", "ABL_B") !== null);
    expect(boundaryAblPairs.filter((u) => validPair(u, "ABL_A", "ABL_B") === true).length).toBe(0);
    expect(boundaryAblPairs.length).toBe(20);
    // Overall: 5/30 treatment; 0/25 ablation.
    const overallAbl = allUnits.filter((u) => validPair(u, "ABL_A", "ABL_B") !== null);
    expect(overallAbl.length).toBe(25);
    expect(overallAbl.filter((u) => validPair(u, "ABL_A", "ABL_B") === true).length).toBe(0);
    const overallDiff = treatPairs.filter((u) => validPair(u, "A", "B") === true).length;
    expect(overallDiff).toBe(5);
    // Hard controls: 10 valid treatment pairs, 0 disagreements (H1 REALIZE/REALIZE, H2 CLARIFY/CLARIFY).
    const hardPairs = allUnits.filter((u) => u.scenario_class !== "BOUNDARY" && validPair(u, "A", "B") !== null);
    expect(hardPairs.length).toBe(10);
    expect(hardPairs.filter((u) => validPair(u, "A", "B") === true).length).toBe(0);
    // Preregistered verdict: delta 16.67pp is in the intermediate region AND
    // boundary scenario coverage is 1/4 < 3/4 → INPUT_EFFECT_ONLY.
    const summary = JSON.parse(readFileSync(join(evidenceDir, "summary.json"), "utf8")) as { verdict: string; overall: { delta: number } };
    expect(summary.verdict).toBe("CANONICAL_AFFECT_COMMUNICATION_DIRECTIVE_INPUT_EFFECT_ONLY");
    expect(summary.overall.delta).toBeCloseTo(5 / 30, 12);
  });
});
