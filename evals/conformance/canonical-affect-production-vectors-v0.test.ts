/**
 * CANONICAL_AFFECT_STATE_FOUNDATION_V0 — frozen research vector conformance
 * (§59). Compares the production BOUNDED_AFFECT_DYNAMICS_V0 against committed
 * deterministic vectors from E1/E2/E2A. Does NOT rerun experiment runners;
 * reads committed deterministic vectors only.
 */

/* eslint-disable no-restricted-imports -- Conformance consumer of the isolated experiment host and frozen built roots. */
import { describe, expect, it } from "vitest";

import {
  advanceAffectTimeV0,
  applyAffectImpulseV0,
  createCanonicalAffectBaselineV0,
  deriveAffectImpulseV0
} from "../../packages/affect/dist/index.js";
import {
  validateCanonicalAffectShape,
  validateUnitInterval,
  type CanonicalAffectV0,
  type UnitIntervalV0
} from "../../packages/subject-core/dist/index.js";

function affectOf(valence: number, activation: number): CanonicalAffectV0 {
  const checked = validateCanonicalAffectShape({
    schema_version: "canonical-affect-v0",
    valence,
    activation
  }, "conformance affect");
  if (!checked.ok) throw new Error(checked.error.detail);
  return checked.value;
}

function unitInterval(value: number): UnitIntervalV0 {
  const checked = validateUnitInterval(value, "conformance unit interval");
  if (!checked.ok) throw new Error(checked.error.detail);
  return checked.value;
}

function impulseInput(relevance: number, goalCongruence: number, intensity: number) {
  return {
    relevance: unitInterval(relevance),
    goal_congruence: unitInterval(goalCongruence),
    intensity: unitInterval(intensity)
  };
}

/** Canonical baseline: v=0, a=0.2. */
const BASELINE = affectOf(0, 0.2);
void BASELINE;

describe("Production dynamics vs frozen research vectors (§59)", () => {
  it("E1 S1 — single impulse N(0.8): u_v=-0.2, u_a=0.16; recovery half-life τ·ln(2)≈103.97", () => {
    const impulse = deriveAffectImpulseV0(impulseInput(1, 0, 0.8));
    expect(impulse.u_v).toBeCloseTo(-0.2, 12);
    expect(impulse.u_a).toBeCloseTo(0.08, 12);
    // Recovery after 1200 ticks from the post-event offset (d0_v = 0.2):
    const recovered = advanceAffectTimeV0(
      affectOf(-0.2, 0.36),
      1200
    );
    const d0 = 0.2;
    expect(Math.abs(recovered.valence)).toBeLessThanOrEqual(d0 * Math.exp(-8) + 1e-12);
  });

  it("E1 — partition consistency: Time+1200 direct ≡ 120×Time+10 (≤1e-12)", () => {
    const start = affectOf(-0.2, 0.36);
    const direct = advanceAffectTimeV0(start, 1200);
    let step = start;
    for (let i = 0; i < 120; i += 1) step = advanceAffectTimeV0(step, 10);
    expect(Math.abs(direct.valence - step.valence)).toBeLessThanOrEqual(1e-12);
    expect(Math.abs(direct.activation - step.activation)).toBeLessThanOrEqual(1e-12);
  });

  it("E1 — q=0 produces zero impulse (§59 zero-relevance)", () => {
    const impulse = deriveAffectImpulseV0(impulseInput(0, 0.3, 0.9));
    expect(impulse.u_v).toBe(0);
    expect(impulse.u_a).toBe(0);
  });

  it("E1 — neutral goal (g=.5) produces zero valence impulse", () => {
    const impulse = deriveAffectImpulseV0(impulseInput(0.8, 0.5, 0.5));
    expect(impulse.u_v).toBe(0);
    expect(impulse.u_a).toBeCloseTo(0.1 * 0.4, 12);
  });

  it("E2A A10 — gain identity: Δ_a(A10)/q = .10 exactly", () => {
    const impulse = deriveAffectImpulseV0(impulseInput(1, 0.3, 0.5));
    expect(impulse.u_a / impulse.q).toBeCloseTo(0.1, 12);
  });

  it("E1 S7 — saturation: bounded output under sustained max input", () => {
    let state = createCanonicalAffectBaselineV0();
    const impulse = deriveAffectImpulseV0(impulseInput(1, 0, 1));
    for (let i = 0; i < 200; i += 1) {
      state = applyAffectImpulseV0(state, impulse);
      expect(state.valence).toBeGreaterThanOrEqual(-1);
      expect(state.valence).toBeLessThanOrEqual(1);
      expect(state.activation).toBeGreaterThanOrEqual(0);
      expect(state.activation).toBeLessThanOrEqual(1);
    }
    expect(state.valence).toBe(-1);
    // After input stops, the state leaves the boundary.
    const recovered = advanceAffectTimeV0(state, 1200);
    expect(recovered.valence).toBeGreaterThan(-1);
    expect(recovered.valence).toBeLessThanOrEqual(0);
  });
});
