/**
 * CANONICAL_AFFECT_STATE_FOUNDATION_V0 — internal validation helpers for the
 * v4 closed snapshot validator. The v3 block validators are REUSED (exported
 * from subject-state.ts without any behavior change); only the V4-specific
 * pieces (runtime-metadata lineage, CanonicalAffectV0, MechanismConfigV1)
 * live here.
 */

import { fail, ok, type ValidationResult } from "./result.js";
import { isRecord } from "./scalars.js";
import { validateCanonicalAffectShape, validateMechanismConfigV1Shape } from "./subject-state-v4-values.js";
import {
  closedKeys,
  lit,
  reqRecord,
  validateBeliefState,
  validateIdentity,
  validateMemoryState,
  validatePersonalityState,
  validateRelationshipState,
  validateTraitsSeed,
  validateTraceWindow
} from "./subject-state.js";
import { validateRegulationShape, validateWorkingContextShape } from "./values.js";
import type { CanonicalAffectV0 } from "../types/subject-state-v4.js";

type Check = ValidationResult<void>;

function asCheck(r: ValidationResult<unknown>): Check {
  return r.ok ? ok(undefined) : fail(r.error.error_code, r.error.reason, r.error.detail);
}

export interface ValidationHelpers {
  readonly reqRecord: (v: unknown, d: string) => ValidationResult<Record<string, unknown>>;
  readonly closedKeys: (o: Record<string, unknown>, allowed: readonly string[], d: string) => Check;
  readonly lit: (v: unknown, want: string | number | boolean, d: string) => Check;
  readonly validateIdentity: (v: unknown, d: string) => Check;
  readonly validateTraitsSeed: (v: unknown, d: string) => Check;
  readonly validatePersonalityState: (v: unknown, d: string) => Check;
  readonly validateBeliefState: (v: unknown, d: string) => Check;
  readonly validateRelationshipState: (v: unknown, d: string) => Check;
  readonly validateMemoryState: (v: unknown, d: string, logicalTime: number) => Check;
  readonly validateRegulationShape: (v: unknown, d: string, ctx: { logical_time: number }) => Check;
  readonly validateWorkingContext: (v: unknown, d: string) => Check;
  readonly validateTraceWindow: (v: unknown, d: string, stateRevision: number) => Check;
  readonly validateRuntimeMetadataV4: (v: unknown, d: string) => ValidationResult<{ logical_time: number; state_revision: number }>;
  readonly validateCanonicalAffect: (v: unknown, d: string) => ValidationResult<CanonicalAffectV0>;
  readonly validateMechanismConfigV1: (v: unknown, d: string) => Check;
}

export const v4ValidationHelpers: ValidationHelpers = {
  reqRecord,
  closedKeys,
  lit,
  validateIdentity,
  validateTraitsSeed,
  validatePersonalityState,
  validateBeliefState,
  validateRelationshipState,
  validateMemoryState,
  validateRegulationShape: (v, d, ctx) => asCheck(validateRegulationShape(v, d, ctx)),
  validateWorkingContext: (v, d) => asCheck(validateWorkingContextShape(v, d)),
  validateTraceWindow,
  validateRuntimeMetadataV4,
  validateCanonicalAffect: validateCanonicalAffectShape,
  validateMechanismConfigV1: (v, d) => asCheck(validateMechanismConfigV1Shape(v, d))
};

/** V4 runtime metadata: same timestamp/revision law as v3 plus the explicit
 * schema_lineage discriminator. */
export function validateRuntimeMetadataV4(v: unknown, d: string): ValidationResult<{ logical_time: number; state_revision: number }> {
  if (!isRecord(v)) return fail("INVALID_SCHEMA", SCHEMA, d + ": expected object");
  const o = v;
  const root = ok(undefined); void root;
  const KEYS: readonly string[] = [
    "subject_version",
    "schema_lineage",
    "state_revision",
    "logical_time",
    "last_transition_time",
    "last_transition_type",
    "created_at",
    "updated_at"
  ];
  for (const key of Object.keys(o)) {
    if (!KEYS.includes(key)) return fail("INVALID_SCHEMA", SCHEMA, d + "." + key + ": unknown key");
  }
  const sv = lit(o["subject_version"], "subject-v0", d + ".subject_version");
  if (!sv.ok) return sv;
  const lineage = lit(o["schema_lineage"], "subject-state-v4", d + ".schema_lineage");
  if (!lineage.ok) return lineage;
  const stateRevision = o["state_revision"];
  const logicalTime = o["logical_time"];
  for (const pair of [["state_revision", stateRevision], ["logical_time", logicalTime], ["created_at", o["created_at"]], ["updated_at", o["updated_at"]]] as const) {
    const value = pair[1];
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
      return fail("INVALID_VALUE_RANGE", SCHEMA, d + "." + pair[0] + ": non-negative safe integer required");
    }
  }
  if (o["last_transition_time"] !== null) {
    if (typeof o["last_transition_time"] !== "number" || !Number.isSafeInteger(o["last_transition_time"])) {
      return fail("INVALID_VALUE_RANGE", SCHEMA, d + ".last_transition_time: non-negative safe integer or null required");
    }
  }
  if (o["last_transition_type"] !== null && typeof o["last_transition_type"] !== "string") {
    return fail("INVALID_SCHEMA", SCHEMA, d + ".last_transition_type: enum or null required");
  }
  const createdAt = o["created_at"] as number;
  const updatedAt = o["updated_at"] as number;
  if (!(createdAt <= updatedAt && updatedAt <= (logicalTime as number))) {
    return fail("INVARIANT_VIOLATION", SCHEMA, d + ": requires created_at <= updated_at <= logical_time");
  }
  if ((stateRevision as number) === 0) {
    if (o["last_transition_time"] !== null) {
      return fail("INVARIANT_VIOLATION", SCHEMA, d + ".last_transition_time must be null at revision 0");
    }
  } else if (o["last_transition_time"] === null) {
    return fail("INVARIANT_VIOLATION", SCHEMA, d + ".last_transition_time must be non-null after revision 0");
  }
  return ok({ logical_time: logicalTime as number, state_revision: stateRevision as number });
}

const SCHEMA = "SS-SCHEMA-001";
