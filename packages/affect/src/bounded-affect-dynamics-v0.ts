/**
 * CANONICAL_AFFECT_STATE_FOUNDATION_V0 — BOUNDED_AFFECT_DYNAMICS_V0.
 *
 * The production source of truth for the bounded-VA Affect dynamics version.
 * PURE: no runtime, repository, journal, provider, Appraisal-persistence,
 * SubjectStore or LLM dependency. Depends only on canonical state types from
 * subject-core. Deterministic; no wall clock; no randomness.
 *
 * Event law (frozen E2A candidate):
 *   q   = relevance * intensity
 *   u_v = 0.25 * q * (2*goal_congruence - 1)
 *   u_a = 0.10 * q
 *   event:  x_after = clamp(x_before + u)   — retains current state
 *   time:   x(t+dt) = b + (x(t)-b) * exp(-dt/150), b = (0, 0.2)
 */

import type { CanonicalAffectV0, SignedUnitIntervalV0, UnitIntervalV0 } from "@characteros-next/subject-core";
import { CANONICAL_AFFECT_SCHEMA_VERSION } from "@characteros-next/subject-core";

/** §10 — the frozen dynamics constants. Exact values; no tuning. */
export const BOUNDED_AFFECT_DYNAMICS_V0 = Object.freeze({
  profile_id: "BOUNDED_AFFECT_DYNAMICS_V0",
  timebase: "tick",

  baseline: {
    valence: 0,
    activation: 0.2
  },

  gains: {
    valence: 0.25,
    activation: 0.1
  },

  tau_ticks: 150,

  bounds: {
    valence: [-1, 1],
    activation: [0, 1]
  }
});

/** §11 — the pure impulse input: only the three lawful Appraisal axes. */
export interface AffectImpulseInputV0 {
  readonly relevance: UnitIntervalV0;
  readonly goal_congruence: UnitIntervalV0;
  readonly intensity: UnitIntervalV0;
}

/** §12 — the derived event impulse. */
export interface AffectImpulseV0 {
  readonly q: UnitIntervalV0;
  readonly u_v: number;
  readonly u_a: number;
}

/** §17 — bounded package-local error. Never persisted. */
export type AffectDynamicsErrorCodeV0 =
  | "INVALID_INPUT"
  | "INVALID_STATE"
  | "INVALID_ELAPSED_TICKS"
  | "NON_FINITE_RESULT";

export class AffectDynamicsContractErrorV0 extends RangeError {
  readonly code: AffectDynamicsErrorCodeV0;
  constructor(code: AffectDynamicsErrorCodeV0, detail: string) {
    super(`bounded affect dynamics: ${code}: ${detail}`);
    this.name = "AffectDynamicsContractErrorV0";
    this.code = code;
  }
}

function normalizeZero(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}

function clamp(value: number, low: number, high: number): number {
  return normalizeZero(Math.min(high, Math.max(low, value)));
}

function requireFiniteNumber(value: unknown, code: AffectDynamicsErrorCodeV0, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new AffectDynamicsContractErrorV0(code, `${label} must be a finite number`);
  }
  return value;
}

function requireUnitInterval(value: unknown, code: AffectDynamicsErrorCodeV0, label: string): number {
  const n = requireFiniteNumber(value, code, label);
  if (n < 0 || n > 1) {
    throw new AffectDynamicsContractErrorV0(code, `${label} must be in [0,1]`);
  }
  return n;
}

function asCanonicalAffect(value: unknown, code: AffectDynamicsErrorCodeV0, label: string): CanonicalAffectV0 {
  if (typeof value !== "object" || value === null) {
    throw new AffectDynamicsContractErrorV0(code, `${label} must be a CanonicalAffectV0 object`);
  }
  const o = value as Record<string, unknown>;
  if (o["schema_version"] !== CANONICAL_AFFECT_SCHEMA_VERSION) {
    throw new AffectDynamicsContractErrorV0(code, `${label}.schema_version must be ${CANONICAL_AFFECT_SCHEMA_VERSION}`);
  }
  const valence = requireFiniteNumber(o["valence"], code, `${label}.valence`);
  const activation = requireFiniteNumber(o["activation"], code, `${label}.activation`);
  if (valence < -1 || valence > 1) {
    throw new AffectDynamicsContractErrorV0(code, `${label}.valence outside [-1,1]`);
  }
  if (activation < 0 || activation > 1) {
    throw new AffectDynamicsContractErrorV0(code, `${label}.activation outside [0,1]`);
  }
  if (Object.is(valence, -0) || Object.is(activation, -0)) {
    throw new AffectDynamicsContractErrorV0(code, `${label} carries negative zero`);
  }
  return value as CanonicalAffectV0;
}

/** §13 — the exact frozen impulse law. No clamp beyond validated inputs, no
 * hidden epsilon, no rounding; `-0` normalized to `0`. */
export function deriveAffectImpulseV0(input: AffectImpulseInputV0): AffectImpulseV0 {
  if (typeof input !== "object" || input === null) {
    throw new AffectDynamicsContractErrorV0("INVALID_INPUT", "input must be an object");
  }
  const relevance = requireUnitInterval(input.relevance, "INVALID_INPUT", "input.relevance");
  const intensity = requireUnitInterval(input.intensity, "INVALID_INPUT", "input.intensity");
  const goalCongruence = requireUnitInterval(input.goal_congruence, "INVALID_INPUT", "input.goal_congruence");
  const q = normalizeZero(relevance * intensity);
  const uV = normalizeZero(0.25 * q * (2 * goalCongruence - 1));
  const uA = normalizeZero(0.1 * q);
  if (!Number.isFinite(q) || !Number.isFinite(uV) || !Number.isFinite(uA)) {
    throw new AffectDynamicsContractErrorV0("NON_FINITE_RESULT", "impulse derivation produced a non-finite value");
  }
  return {
    q: q as UnitIntervalV0,
    u_v: uV,
    u_a: uA
  };
}

/** §14 — additive event application from the CURRENT state: retains the
 * pre-event state, never resets, never recovers, never inspects time, never
 * mutates the input. Returns a frozen CanonicalAffectV0. */
export function applyAffectImpulseV0(current: CanonicalAffectV0, impulse: AffectImpulseV0): CanonicalAffectV0 {
  const state = asCanonicalAffect(current, "INVALID_STATE", "current");
  if (typeof impulse !== "object" || impulse === null) {
    throw new AffectDynamicsContractErrorV0("INVALID_INPUT", "impulse must be an object");
  }
  const uV = requireFiniteNumber(impulse.u_v, "INVALID_INPUT", "impulse.u_v");
  const uA = requireFiniteNumber(impulse.u_a, "INVALID_INPUT", "impulse.u_a");
  const valence = clamp(state.valence + uV, -1, 1);
  const activation = clamp(state.activation + uA, 0, 1);
  if (!Number.isFinite(valence) || !Number.isFinite(activation)) {
    throw new AffectDynamicsContractErrorV0("NON_FINITE_RESULT", "event application produced a non-finite value");
  }
  return Object.freeze({
    schema_version: CANONICAL_AFFECT_SCHEMA_VERSION,
    valence: valence as SignedUnitIntervalV0,
    activation: activation as UnitIntervalV0
  });
}

/** §15/§16 — exponential time recovery toward the frozen baseline. dt=0 is a
 * numeric identity that still returns a valid frozen result. No clamp beyond
 * the state bounds; no Appraisal; no event identity; no wall clock. */
export function advanceAffectTimeV0(current: CanonicalAffectV0, elapsedTicks: number): CanonicalAffectV0 {
  const state = asCanonicalAffect(current, "INVALID_STATE", "current");
  if (typeof elapsedTicks !== "number" || !Number.isSafeInteger(elapsedTicks) || elapsedTicks < 0) {
    throw new AffectDynamicsContractErrorV0("INVALID_ELAPSED_TICKS", "elapsedTicks must be a non-negative safe integer");
  }
  const factor = Math.exp(-elapsedTicks / BOUNDED_AFFECT_DYNAMICS_V0.tau_ticks);
  const valence = normalizeZero(state.valence * factor);
  const activation = normalizeZero(
    BOUNDED_AFFECT_DYNAMICS_V0.baseline.activation +
      (state.activation - BOUNDED_AFFECT_DYNAMICS_V0.baseline.activation) * factor
  );
  if (!Number.isFinite(valence) || !Number.isFinite(activation)) {
    throw new AffectDynamicsContractErrorV0("NON_FINITE_RESULT", "time advance produced a non-finite value");
  }
  return Object.freeze({
    schema_version: CANONICAL_AFFECT_SCHEMA_VERSION,
    valence: valence as SignedUnitIntervalV0,
    activation: activation as UnitIntervalV0
  });
}

/** §18 — the frozen canonical baseline constructor. Frozen; never a shared
 * mutable singleton. */
export function createCanonicalAffectBaselineV0(): CanonicalAffectV0 {
  return Object.freeze({
    schema_version: CANONICAL_AFFECT_SCHEMA_VERSION,
    valence: BOUNDED_AFFECT_DYNAMICS_V0.baseline.valence as SignedUnitIntervalV0,
    activation: BOUNDED_AFFECT_DYNAMICS_V0.baseline.activation as UnitIntervalV0
  });
}

