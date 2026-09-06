/**
 * CANONICAL_AFFECT_STATE_FOUNDATION_V0 — CanonicalAffectV0 closed shape
 * validator (§21): rejects extra/missing keys, non-finite values, out-of-range
 * axes, `-0`, and legacy v3 affect keys. No coercion, no defaults.
 */

import { fail, ok, type ValidationResult } from "./result.js";
import { isNumber, isRecord } from "./scalars.js";
import type { CanonicalAffectV0 } from "../types/subject-state-v4.js";
import { CANONICAL_AFFECT_SCHEMA_VERSION } from "../types/subject-state-v4.js";

const SCHEMA = "SS-SCHEMA-001";

export function validateCanonicalAffectShape(v: unknown, d: string): ValidationResult<CanonicalAffectV0> {
  if (!isRecord(v)) return fail("INVALID_SCHEMA", SCHEMA, d + ": expected object");
  const o: Record<string, unknown> = v;
  const KEYS: readonly string[] = ["schema_version", "valence", "activation"];
  for (const key of Object.keys(o)) {
    if (!KEYS.includes(key)) return fail("INVALID_SCHEMA", SCHEMA, `${d}.${key}: unknown key`);
  }
  if (Object.keys(o).length !== 3) return fail("INVALID_SCHEMA", SCHEMA, `${d}: exactly schema_version/valence/activation required`);
  if (o["schema_version"] !== CANONICAL_AFFECT_SCHEMA_VERSION) {
    return fail("INVALID_SCHEMA", SCHEMA, `${d}.schema_version: expected ${CANONICAL_AFFECT_SCHEMA_VERSION}`);
  }
  const valence = o["valence"];
  const activation = o["activation"];
  for (const [name, value] of [["valence", valence], ["activation", activation]] as const) {
    if (!isNumber(value)) {
      return fail("INVALID_VALUE_RANGE", SCHEMA, `${d}.${name}: finite number required`);
    }
    if (Object.is(value, -0)) {
      return fail("INVALID_VALUE_RANGE", SCHEMA, `${d}.${name}: negative zero is not canonical`);
    }
  }
  if ((valence as number) < -1 || (valence as number) > 1) {
    return fail("INVALID_VALUE_RANGE", SCHEMA, `${d}.valence: outside [-1,1]`);
  }
  if ((activation as number) < 0 || (activation as number) > 1) {
    return fail("INVALID_VALUE_RANGE", SCHEMA, `${d}.activation: outside [0,1]`);
  }
  if ("active_channels" in o || "generated_under_profile" in o || "updated_at" in o) {
    return fail("INVALID_SCHEMA", SCHEMA, `${d}: legacy v3 affect keys are not canonical in v4`);
  }
  return ok(o as unknown as CanonicalAffectV0);
}

/** §8 — MechanismConfigV1 closed validation: exactly the v4 pairing. */
export function validateMechanismConfigV1Shape(v: unknown, d: string): ValidationResult<void> {
  if (!isRecord(v)) return fail("INVALID_SCHEMA", SCHEMA, d + ": expected object");
  const o: Record<string, unknown> = v;
  const KEYS: readonly string[] = ["affect_profile", "feature_flags", "thresholds"];
  for (const key of Object.keys(o)) {
    if (!KEYS.includes(key)) return fail("INVALID_SCHEMA", SCHEMA, `${d}.${key}: unknown key`);
  }
  if (!isRecord(o["affect_profile"])) return fail("INVALID_SCHEMA", SCHEMA, `${d}.affect_profile: expected object`);
  const affectProfile: Record<string, unknown> = o["affect_profile"];
  for (const key of Object.keys(affectProfile)) {
    if (!["profile_id", "timebase"].includes(key)) return fail("INVALID_SCHEMA", SCHEMA, `${d}.affect_profile.${key}: unknown key`);
  }
  if (affectProfile["profile_id"] !== "BOUNDED_AFFECT_DYNAMICS_V0") return fail("INVALID_SCHEMA", SCHEMA, `${d}.affect_profile.profile_id: expected BOUNDED_AFFECT_DYNAMICS_V0`);
  if (affectProfile["timebase"] !== "tick") return fail("INVALID_SCHEMA", SCHEMA, `${d}.affect_profile.timebase: expected tick`);
  for (const key of ["feature_flags", "thresholds"] as const) {
    const block = o[key];
    if (typeof block !== "object" || block === null || Array.isArray(block)) {
      return fail("INVALID_SCHEMA", SCHEMA, `${d}.${key}: expected object`);
    }
    if (Object.keys(block as Record<string, unknown>).length !== 0) {
      return fail("INVALID_SCHEMA", SCHEMA, `${d}.${key}: closed empty object required`);
    }
  }
  return ok(undefined);
}
