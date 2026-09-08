/**
 * CANONICAL_AFFECT_COGNITION_INTEGRATION_V0 — pure projection matrix.
 *
 * Proves the frozen RAW_CANONICAL_VA section: exact canonical numeric values
 * (no rounding/bins/percentages/transforms), determinism, boundary values,
 * closed shape, fail-closed malformed affect, and the complete absence of
 * Mood, named emotions, dynamics config and history. Real model calls 0.
 */

import { describe, expect, it } from "vitest";

import {
  projectCanonicalAffectForCognitionV0,
  CANONICAL_AFFECT_COGNITION_PROJECTION_V0_SCHEMA_VERSION,
  type CanonicalAffectCognitionProjectionV0
} from "./canonical-affect-cognition-projection-v0.js";

function affect(valence: number, activation: number): unknown {
  return { schema_version: "canonical-affect-v0", valence, activation };
}

describe("CanonicalAffectCognitionProjectionV0 — pure projection (§43)", () => {
  it("1-3. projects exact values; deterministic", () => {
    const a = projectCanonicalAffectForCognitionV0(affect(0.8, 0.6) as never);
    const b = projectCanonicalAffectForCognitionV0(affect(0.8, 0.6) as never);
    expect(a.valence).toBe(0.8);
    expect(a.activation).toBe(0.6);
    expect(a.schema_version).toBe(CANONICAL_AFFECT_COGNITION_PROJECTION_V0_SCHEMA_VERSION);
    expect(a).toStrictEqual(b);
    expect(Object.isFrozen(a)).toBe(true);
  });

  it("4. negative valence preserved exactly", () => {
    const p = projectCanonicalAffectForCognitionV0(affect(-0.048, 0.248) as never);
    expect(p.valence).toBe(-0.048);
  });

  it("5. positive valence preserved exactly", () => {
    const p = projectCanonicalAffectForCognitionV0(affect(1, 0.2) as never);
    expect(p.valence).toBe(1);
  });

  it("6/8. activation 0 preserved exactly (no rounding)", () => {
    const p = projectCanonicalAffectForCognitionV0(affect(-0.123456789, 0) as never);
    expect(p.activation).toBe(0);
    expect(p.valence).toBe(-0.123456789);
  });

  it("7/8. activation 1 preserved exactly (no rounding)", () => {
    const p = projectCanonicalAffectForCognitionV0(affect(0.987654321, 1) as never);
    expect(p.activation).toBe(1);
    expect(p.valence).toBe(0.987654321);
  });

  it("9-13. closed section shape — no Mood, no channels, no named emotions, no dynamics, no history", () => {
    const p = projectCanonicalAffectForCognitionV0(affect(0.1, 0.2) as never) as unknown as Record<string, unknown>;
    expect(Object.keys(p).sort()).toStrictEqual(["activation", "schema_version", "valence"]);
    const json = JSON.stringify(p);
    expect(json).not.toContain("mood");
    expect(json).not.toContain("channel");
    expect(json).not.toContain("anger");
    expect(json).not.toContain("fear");
    expect(json).not.toContain("sadness");
    expect(json).not.toContain("joy");
    expect(json).not.toContain("tau");
    expect(json).not.toContain("gain");
    expect(json).not.toContain("BOUNDED_AFFECT_DYNAMICS_V0");
    expect(json).not.toContain("history");
    expect(json).not.toContain("eligibility");
    const section: CanonicalAffectCognitionProjectionV0 = p as never;
    void section;
  });

  it("14. malformed affect fails closed (no coercion, no defaults)", () => {
    expect(() => projectCanonicalAffectForCognitionV0({ schema_version: "legacy-affect", valence: 0, activation: 0 } as never)).toThrow();
    expect(() => projectCanonicalAffectForCognitionV0({ schema_version: "canonical-affect-v0", valence: 5, activation: 0.2 } as never)).toThrow();
    expect(() => projectCanonicalAffectForCognitionV0({ schema_version: "canonical-affect-v0", valence: 0.1 } as never)).toThrow();
    expect(() => projectCanonicalAffectForCognitionV0(null as never)).toThrow();
  });
});
