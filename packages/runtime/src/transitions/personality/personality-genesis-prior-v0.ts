/**
 * PersonalityGenesisPriorV0 — explicit, creation-time authoring of P0.
 *
 * PERSONALITY_GENESIS_PRIOR_ADMISSION_V0. This module is the ONLY lawful source
 * of a non-empty genesis Personality disposition. A value may enter genesis
 * solely because an explicit caller/author supplied it; there is NO default,
 * NO 0.5 fallback, NO randomness, and NO model inference.
 *
 * AUTHORITY BOUNDARY:
 * - ADMISSION = the frozen dimension registry (which ids may exist).
 * - VALUE ASSIGNMENT = this explicit prior only (creation-time, caller-supplied).
 * The registry itself remains value-free; authoring values never enter it.
 *
 * LAW:
 * - FULL_REGISTERED_PRIOR_REQUIRED: every registered dimension must be present
 *   exactly once; a partial prior fails closed (the frozen plasticity mechanism
 *   can only ever update dimensions already present in `PersonalityStateV0`, so
 *   a partial P0 would make "why can openness change but X cannot?" ambiguous).
 * - Unknown/duplicate keys, wrong schema, non-finite or out-of-[0,1] values fail
 *   closed with no repair.
 * - The prior is creation authority ONLY. It is not persisted as a second
 *   authority source: once genesis completes, the canonical `SubjectState`
 *   (immutable `traits_seed` = P0, mutable `personality(t=0)` = P0) is authority.
 */

import {
  fail,
  isRecord,
  ok,
  validateUnitInterval,
  type PersonalityStateV0,
  type TraitsSeedV0,
  type UnitIntervalV0,
  type ValidationResult
} from "@characteros-next/subject-core";

import { PERSONALITY_DIMENSION_IDS_V0 } from "./personality-dimension-registry-v0.js";
import { initializePersonalityFromTraitsSeed } from "./personality-init.js";

export const PERSONALITY_GENESIS_PRIOR_SCHEMA_VERSION = "personality-genesis-prior-v0" as const;

/**
 * Explicit authoring input for a fresh subject's P0. Closed over the frozen
 * registry dimension ids; every registered id must be present.
 */
export interface PersonalityGenesisPriorV0 {
  readonly schema_version: typeof PERSONALITY_GENESIS_PRIOR_SCHEMA_VERSION;
  readonly dimensions: Readonly<Record<string, UnitIntervalV0>>;
}

const PRIOR_KEYS: readonly string[] = ["schema_version", "dimensions"];
const REQUIREMENT = "SS-SCHEMA-001" as const;

/**
 * Fail-closed admission of an explicit genesis prior. Rejects wrong
 * schema_version, unknown/extra fields, unknown or missing registered
 * dimensions, duplicate/impossible shapes, and every non-finite or
 * out-of-[0,1] value. No repair, no fallback, no partial acceptance.
 */
export function validatePersonalityGenesisPriorV0(
  v: unknown
): ValidationResult<PersonalityGenesisPriorV0> {
  if (!isRecord(v)) {
    return fail("INVALID_SCHEMA", REQUIREMENT, "personality_genesis_prior: expected object");
  }
  for (const key of Object.keys(v)) {
    if (!PRIOR_KEYS.includes(key)) {
      return fail("INVALID_SCHEMA", REQUIREMENT, `personality_genesis_prior.${key}: unknown key`);
    }
  }
  if (v["schema_version"] !== PERSONALITY_GENESIS_PRIOR_SCHEMA_VERSION) {
    return fail("INVALID_SCHEMA", REQUIREMENT, "personality_genesis_prior.schema_version: invalid literal");
  }
  const dimensionsRaw = v["dimensions"];
  if (!isRecord(dimensionsRaw)) {
    return fail("INVALID_SCHEMA", REQUIREMENT, "personality_genesis_prior.dimensions: expected object");
  }
  for (const key of Object.keys(dimensionsRaw)) {
    if (!PERSONALITY_DIMENSION_IDS_V0.includes(key)) {
      return fail(
        "INVALID_SCHEMA",
        REQUIREMENT,
        `personality_genesis_prior.dimensions.${key}: unknown personality dimension`
      );
    }
  }
  const dimensions: Record<string, UnitIntervalV0> = {};
  for (const dimensionId of PERSONALITY_DIMENSION_IDS_V0) {
    if (!(dimensionId in dimensionsRaw)) {
      return fail(
        "INVALID_SCHEMA",
        REQUIREMENT,
        `personality_genesis_prior.dimensions.${dimensionId}: missing registered dimension`
      );
    }
    const raw = dimensionsRaw[dimensionId];
    if (typeof raw !== "number") {
      return fail(
        "INVALID_SCHEMA",
        REQUIREMENT,
        `personality_genesis_prior.dimensions.${dimensionId}: expected number`
      );
    }
    const checked = validateUnitInterval(raw, `personality_genesis_prior.dimensions.${dimensionId}`);
    if (!checked.ok) {
      return fail(checked.error.error_code, checked.error.reason, checked.error.detail);
    }
    dimensions[dimensionId] = checked.value;
  }
  return ok({
    schema_version: PERSONALITY_GENESIS_PRIOR_SCHEMA_VERSION,
    dimensions: Object.freeze(dimensions)
  });
}

/**
 * Canonical P0 as a `TraitsSeedV0`: registry-ordered (raw-ASCII ascending)
 * keys. The input is assumed already validated.
 */
export function traitsSeedFromPersonalityGenesisPriorV0(
  prior: PersonalityGenesisPriorV0
): TraitsSeedV0 {
  const dimensions: Record<string, UnitIntervalV0> = {};
  for (const dimensionId of PERSONALITY_DIMENSION_IDS_V0) {
    dimensions[dimensionId] = prior.dimensions[dimensionId] as UnitIntervalV0;
  }
  return { dimensions: Object.freeze(dimensions) };
}

/**
 * Validate an explicit prior and derive the exact genesis pair it authorizes:
 * `traits_seed = canonical P0` and `personality(t=0) = P0` via the existing
 * frozen bridge (no duplicated initialization logic). Throws fail-closed on an
 * invalid prior — before any subject state is created.
 */
export function buildGenesisPersonalityFromPriorV0(prior: unknown): {
  readonly traits_seed: TraitsSeedV0;
  readonly personality: PersonalityStateV0;
} {
  const checked = validatePersonalityGenesisPriorV0(prior);
  if (!checked.ok) {
    throw new Error(`PERSONALITY_GENESIS_PRIOR_INVALID: ${checked.error.detail}`);
  }
  const traitsSeed = traitsSeedFromPersonalityGenesisPriorV0(checked.value);
  return {
    traits_seed: traitsSeed,
    personality: initializePersonalityFromTraitsSeed(traitsSeed)
  };
}
