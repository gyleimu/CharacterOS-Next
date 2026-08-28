/**
 * MemoryInfluencePolicyV0 — explicit, versioned decay/activation policy.
 *
 * ENGINEERING_REFERENCE_V0: the default parameters below are adapted from the
 * legacy CharacterOS decay reference (research/legacy-characteros/memory/
 * influence-decay.ts, itself adapted from legacy src/core/memory/decay.ts and
 * src/core/galaxy/memoryDecay.ts). They are ENGINEERING placeholders chosen for
 * determinism and boundedness — NOT validated human-memory constants.
 *
 * Legacy components whose inputs do not exist on the current main
 * EpisodicMemoryRecordV0 are OMITTED from V0 (see the availability matrix in
 * memory-influence-projection.ts): repetition bonus (no repetition count on
 * records), emotional salience bonus (no emotion label; affect pointer only),
 * personality pressure (forbidden: domain-neutral contract), cluster key
 * (no cluster concept in V0).
 */

import { fail, ok, isRecord, type ValidationResult } from "@characteros-next/subject-core";

export const MEMORY_INFLUENCE_POLICY_SCHEMA_VERSION = "memory-influence-policy-v0" as const;

export interface MemoryInfluencePolicyV0 {
  /** Base exponential decay rate per logical tick, (0, 1]. ENGINEERING_REFERENCE_V0 legacy default: 0.03. */
  readonly baseDecayRate: number;
  /** Weight of the recency (decay) term in activation, [0, 1]. Legacy implicit default: 0.5. */
  readonly recencyWeight: number;
  /** Weight of the declared-salience term in activation, [0, 1]. Legacy implicit default: 0.5. */
  readonly importanceWeight: number;
}

export const ENGINEERING_REFERENCE_V0_MEMORY_INFLUENCE_POLICY: MemoryInfluencePolicyV0 =
  Object.freeze({
    baseDecayRate: 0.03,
    recencyWeight: 0.5,
    importanceWeight: 0.5
  });

const POLICY_KEYS: readonly string[] = ["baseDecayRate", "recencyWeight", "importanceWeight"];

function isNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function inUnitInterval(v: number): boolean {
  return v >= 0 && v <= 1;
}

/** Fail-closed policy validation: closed keys, explicit numeric bounds. */
export function validateMemoryInfluencePolicy(v: unknown): ValidationResult<MemoryInfluencePolicyV0> {
  if (!isRecord(v)) return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "policy: expected object");
  for (const key of Object.keys(v)) {
    if (!POLICY_KEYS.includes(key)) {
      return fail("INVALID_SCHEMA", "SS-SCHEMA-001", `policy.${key}: unknown key`);
    }
  }
  const baseDecayRate = v["baseDecayRate"];
  if (!isNumber(baseDecayRate) || !(baseDecayRate > 0) || baseDecayRate > 1) {
    return fail(
      "INVALID_VALUE_RANGE",
      "SS-SCHEMA-001",
      "policy.baseDecayRate: required number in (0, 1]"
    );
  }
  const recencyWeight = v["recencyWeight"];
  if (!isNumber(recencyWeight) || !inUnitInterval(recencyWeight)) {
    return fail("INVALID_VALUE_RANGE", "SS-SCHEMA-001", "policy.recencyWeight: required [0, 1]");
  }
  const importanceWeight = v["importanceWeight"];
  if (!isNumber(importanceWeight) || !inUnitInterval(importanceWeight)) {
    return fail("INVALID_VALUE_RANGE", "SS-SCHEMA-001", "policy.importanceWeight: required [0, 1]");
  }
  return ok({
    baseDecayRate,
    recencyWeight,
    importanceWeight
  });
}
