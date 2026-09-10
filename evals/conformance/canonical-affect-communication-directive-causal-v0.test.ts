/**
 * CANONICAL_AFFECT_COMMUNICATION_DIRECTIVE_CAUSAL_EXPERIMENT_V0 — CI
 * conformance gate. Re-executes the deterministic Phase A in-process and
 * asserts the §37 gates with zero real provider generation calls: six frozen
 * scenarios (4 boundary + 2 hard controls), lawful ±0.25 valence histories
 * with equal activation, scenario ingress into the actual provider input,
 * non-Affect input equality, ablation equality, directive vocabulary, and
 * restore invariance.
 */

import { describe, expect, it } from "vitest";

import { executePhaseA } from "../../research/experiments/canonical-affect-communication-directive-causal-v0/harness.ts";
import { BOUNDARY_SCENARIOS, HARD_CONTROL_SCENARIOS, SCENARIOS } from "../../research/experiments/canonical-affect-communication-directive-causal-v0/contract.ts";

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

  function roundValence(v: number): number {
    return Math.round(v * 1e6) / 1e6;
  }
  function stripUndefined(value: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value)) {
      if (value[key] !== undefined) out[key] = value[key];
    }
    return out;
  }
});
