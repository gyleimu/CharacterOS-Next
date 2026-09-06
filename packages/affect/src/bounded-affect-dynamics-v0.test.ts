/**
 * CANONICAL_AFFECT_STATE_FOUNDATION_V0 — pure dynamics test matrix (§60).
 * Every item is exact: frozen constants, no tuning, deterministic.
 */

import { describe, expect, it } from "vitest";

import {
  BOUNDED_AFFECT_DYNAMICS_V0,
  AffectDynamicsContractErrorV0,
  advanceAffectTimeV0,
  applyAffectImpulseV0,
  createCanonicalAffectBaselineV0,
  deriveAffectImpulseV0
} from "@characteros-next/affect";
import type { CanonicalAffectV0 } from "@characteros-next/subject-core";

function affectOf(valence: number, activation: number): CanonicalAffectV0 {
  return {
    schema_version: "canonical-affect-v0",
    valence: (valence === 0 ? 0 : valence) as never,
    activation: (activation === 0 ? 0 : activation) as never
  };
}

describe("BOUNDED_AFFECT_DYNAMICS_V0 — impulse law (§60.1-§60.7)", () => {
  it("1. exact baseline", () => {
    const b = createCanonicalAffectBaselineV0();
    expect(b).toEqual({ schema_version: "canonical-affect-v0", valence: 0, activation: 0.2 });
    expect(Object.isFrozen(b)).toBe(true);
    expect(BOUNDED_AFFECT_DYNAMICS_V0.gains).toEqual({ valence: 0.25, activation: 0.1 });
    expect(BOUNDED_AFFECT_DYNAMICS_V0.tau_ticks).toBe(150);
  });

  it("2/3/4. exact q law, valence gain .25, activation gain .10", () => {
    const impulse = deriveAffectImpulseV0({ relevance: 0.8, goal_congruence: 0.3, intensity: 0.5 });
    expect(impulse.q).toBe(0.4);
    expect(impulse.u_v).toBeCloseTo(0.25 * 0.4 * (2 * 0.3 - 1), 15);
    expect(impulse.u_a).toBeCloseTo(0.1 * 0.4, 15);
    const neg = deriveAffectImpulseV0({ relevance: 1, goal_congruence: 0, intensity: 0.8 });
    expect(neg.u_v).toBe(-0.2);
    expect(neg.u_a).toBeCloseTo(0.1 * 0.8, 15);
  });

  it("5. q = 0 → zero impulse", () => {
    const impulse = deriveAffectImpulseV0({ relevance: 0, goal_congruence: 0.3, intensity: 0.9 });
    expect(impulse.q).toBe(0);
    expect(impulse.u_v).toBe(0);
    expect(impulse.u_a).toBe(0);
  });

  it("6. goal = .5 → zero valence impulse", () => {
    const impulse = deriveAffectImpulseV0({ relevance: 0.8, goal_congruence: 0.5, intensity: 0.5 });
    expect(impulse.u_v).toBe(0);
    expect(impulse.u_a).toBeCloseTo(0.1 * 0.4, 15);
  });

  it("7. event is additive from the CURRENT state (retention, no reset)", () => {
    const current = affectOf(-0.5, 0.7);
    const impulse = { q: 0.4, u_v: 0.1, u_a: 0.04 };
    const next = applyAffectImpulseV0(current, impulse);
    expect(next.valence).toBeCloseTo(-0.4, 15);
    expect(next.activation).toBeCloseTo(0.74, 15);
  });

  it("8/9/10. clamps: lower valence, upper valence, activation upper", () => {
    expect(applyAffectImpulseV0(affectOf(-0.95, 0.2), { q: 0.4, u_v: -0.1, u_a: 0 }).valence).toBe(-1);
    expect(applyAffectImpulseV0(affectOf(0.95, 0.2), { q: 0.4, u_v: 0.1, u_a: 0 }).valence).toBe(1);
    expect(applyAffectImpulseV0(affectOf(0, 0.97), { q: 0.4, u_v: 0, u_a: 0.04 }).activation).toBe(1);
  });

  it("11. positive activation impulse never lowers activation", () => {
    const before = 0.4;
    const after = applyAffectImpulseV0(affectOf(0, before), { q: 0.5, u_v: 0, u_a: 0.05 }).activation;
    expect(after).toBeGreaterThanOrEqual(before);
  });
});

describe("BOUNDED_AFFECT_DYNAMICS_V0 — time recovery (§60.12-§60.19)", () => {
  it("12. exact exponential recovery", () => {
    const next = advanceAffectTimeV0(affectOf(-0.2, 0.36), 10);
    expect(next.valence).toBe(-0.2 * Math.exp(-10 / 150));
    expect(next.activation).toBe(0.2 + 0.16 * Math.exp(-10 / 150));
  });

  it("13. dt = 0 is a numeric identity (still a valid frozen result)", () => {
    const next = advanceAffectTimeV0(affectOf(-0.3, 0.5), 0);
    expect(next.valence).toBe(-0.3);
    expect(next.activation).toBe(0.5);
    expect(Object.isFrozen(next)).toBe(true);
  });

  it("14-18. rejects negative/fractional/unsafe/NaN/Infinity elapsed ticks", () => {
    expect(() => advanceAffectTimeV0(affectOf(0, 0.2), -1)).toThrow(AffectDynamicsContractErrorV0);
    expect(() => advanceAffectTimeV0(affectOf(0, 0.2), 1.5)).toThrow(AffectDynamicsContractErrorV0);
    expect(() => advanceAffectTimeV0(affectOf(0, 0.2), Number.MAX_SAFE_INTEGER + 1)).toThrow(AffectDynamicsContractErrorV0);
    expect(() => advanceAffectTimeV0(affectOf(0, 0.2), Number.NaN)).toThrow(AffectDynamicsContractErrorV0);
    expect(() => advanceAffectTimeV0(affectOf(0, 0.2), Number.POSITIVE_INFINITY)).toThrow(AffectDynamicsContractErrorV0);
  });

  it("19. -0 is normalized to 0 in outputs", () => {
    const next = advanceAffectTimeV0(affectOf(-0.0000000000000001, 0.2), 5000);
    expect(Object.is(next.valence, -0)).toBe(false);
    expect(next.valence).toBeLessThan(0);
    expect(Math.abs(next.valence)).toBeLessThan(1e-10);
  });
});
