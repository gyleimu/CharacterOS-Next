/**
 * PersonalityDimensionRegistryV0 — canonical personality dimension admission.
 *
 * This module is the SINGLE closed semantic contract that answers "which
 * persistent subject-global properties may count as personality in
 * CharacterOS-Next V0?". It defines the admitted dimension vocabulary plus an
 * explicit, transparent genesis disposition; it performs NO plasticity, NO
 * runtime wiring, NO cognition projection, and NO canonical mutation.
 *
 * DOMAIN LAW (each admitted dimension satisfies all):
 * - subject-global (not tied to one counterpart or one proposition)
 * - relatively stable / slow-changing
 * - meaningful across many contexts
 * - NOT merely current Affect or transient Regulation
 * - NOT Memory content, appraisal output, reward, or sentiment
 * - potentially plastic over long lived history
 * - behavior/cognition relevance is interpretable without a 0.5 "neutral human"
 *
 * ENGINEERING_REFERENCE_V0: the genesis values below are explicit, transparent
 * engineering starting points for a fresh subject. They are NOT a validated
 * model of a typical human, NOT a universality claim, and NOT historical
 * acquisition inference. There is deliberately NO universal 0.5 "neutral
 * human": absence of a dimension is distinct from any numeric value.
 *
 * The registry is closed and frozen: adding a dimension is a schema admission
 * decision (a new slice), never a runtime/plasticity action. Existing
 * `PersonalityStateV0` updates may only target dimensions registered from this
 * registry (or another explicit genesis admission); plasticity never creates
 * dimensions spontaneously.
 */

import {
  validateIdentifier,
  validateUnitInterval,
  type IdentifierV0,
  type PersonalityStateV0,
  type TraitsSeedV0,
  type UnitIntervalV0
} from "@characteros-next/subject-core";

import { initializePersonalityFromTraitsSeed } from "./personality-init.js";

export const PERSONALITY_DIMENSION_REGISTRY_SCHEMA_VERSION =
  "personality-dimension-registry-v0" as const;

/** Domain literal — a registry entry can only ever be PERSONALITY. */
export const PERSONALITY_DIMENSION_DOMAIN = "PERSONALITY" as const;

/**
 * One admitted canonical personality dimension. Purely qualitative semantic
 * metadata (no numeric cross-domain weights, no affect/belief/relationship
 * semantics).
 */
export interface PersonalityDimensionDefinitionV0 {
  readonly dimension_id: IdentifierV0;
  readonly domain: typeof PERSONALITY_DIMENSION_DOMAIN;
  /** What subject-global disposition this dimension denotes. */
  readonly description: string;
  /** Qualitative low pole (a valid disposition, not a deficiency). */
  readonly low_anchor: string;
  /** Qualitative high pole (a valid disposition, not an ideal). */
  readonly high_anchor: string;
  /** Whether slow lived-evidence plasticity may later target this dimension. */
  readonly plasticity_admissible: boolean;
}

interface RawDimensionDefinitionV0 {
  readonly dimension_id: string;
  readonly description: string;
  readonly low_anchor: string;
  readonly high_anchor: string;
  readonly plasticity_admissible: boolean;
}

/**
 * The closed V0 admission set. Ordered raw-ASCII ascending by dimension_id.
 *
 * Rejected/deferred legacy candidates are deliberately NOT here:
 * trust / attachment (counterpart-specific → RELATIONSHIP),
 * fear (current state → AFFECT/APPRAISAL),
 * control (ambiguous with appraisal controllability),
 * neuroticism (ambiguous with Affect/Regulation reactivity),
 * resilience / self_control (ambiguous with Regulation),
 * curiosity (candidate but currently redundant with openness),
 * emotional_sensitivity (affect-like → AFFECT/REGULATION).
 */
const RAW_DIMENSIONS_V0: readonly RawDimensionDefinitionV0[] = Object.freeze([
  {
    dimension_id: "agreeableness",
    description:
      "Subject-global interpersonal orientation toward cooperation, accommodation, and softening conflict, independent of any specific counterpart and independent of any trust proposition.",
    low_anchor:
      "oppositional: holds a hard line and contests rather than accommodates in interpersonal friction",
    high_anchor:
      "cooperative: accommodates and softens interpersonal friction rather than escalating it",
    plasticity_admissible: true
  },
  {
    dimension_id: "conscientiousness",
    description:
      "Subject-global disposition toward order, follow-through, and sustained commitment to intended action, independent of any specific task, counterpart, or proposition.",
    low_anchor:
      "loosely organized: intentions are readily abandoned or left unfinished",
    high_anchor:
      "organized and deliberate: sustains intended action and follows through on commitments",
    plasticity_admissible: true
  },
  {
    dimension_id: "extraversion",
    description:
      "Subject-global disposition toward outward initiative, expression, and social energy, independent of any specific counterpart or relationship.",
    low_anchor:
      "reserved: low outward initiative and limited expressive output",
    high_anchor:
      "outgoing: initiates outward expression and seeks social engagement",
    plasticity_admissible: true
  },
  {
    dimension_id: "openness",
    description:
      "Subject-global disposition toward novel experiences, unfamiliar interpretations, and complexity, independent of any specific counterpart or proposition.",
    low_anchor:
      "prefers familiar interpretations: resists novelty and narrows to what is already known",
    high_anchor:
      "explores novelty: readily engages novel experiences and reinterprets what is already known",
    plasticity_admissible: true
  }
]);

function failInvariant(detail: string): never {
  throw new Error(`PERSONALITY_DIMENSION_REGISTRY_INVARIANT: ${detail}`);
}

function toIdentifier(value: string, label: string): IdentifierV0 {
  const checked = validateIdentifier(value, label);
  if (!checked.ok) failInvariant(`${label}: ${checked.error.reason} ${checked.error.detail}`);
  return checked.value;
}

function toUnitInterval(value: number, label: string): UnitIntervalV0 {
  const checked = validateUnitInterval(value, label);
  if (!checked.ok) failInvariant(`${label}: ${checked.error.reason} ${checked.error.detail}`);
  return checked.value;
}

function buildRegistry(
  raw: readonly RawDimensionDefinitionV0[]
): readonly PersonalityDimensionDefinitionV0[] {
  if (raw.length === 0) failInvariant("registry must admit at least one dimension");
  const definitions: PersonalityDimensionDefinitionV0[] = [];
  let previousId: string | undefined;
  for (const entry of raw) {
    const dimensionId = toIdentifier(entry.dimension_id, "dimension_id");
    if (previousId !== undefined) {
      if (dimensionId === previousId) failInvariant(`duplicate dimension_id ${dimensionId}`);
      if (dimensionId < previousId) {
        failInvariant(`dimension_ids must be raw-ASCII ascending (${dimensionId} after ${previousId})`);
      }
    }
    previousId = dimensionId;
    if (typeof entry.plasticity_admissible !== "boolean") {
      failInvariant(`dimension ${dimensionId}: plasticity_admissible must be boolean`);
    }
    if (entry.description.length === 0 || entry.low_anchor.length === 0 || entry.high_anchor.length === 0) {
      failInvariant(`dimension ${dimensionId}: description/anchors must be non-empty`);
    }
    definitions.push(
      Object.freeze({
        dimension_id: dimensionId,
        domain: PERSONALITY_DIMENSION_DOMAIN,
        description: entry.description,
        low_anchor: entry.low_anchor,
        high_anchor: entry.high_anchor,
        plasticity_admissible: entry.plasticity_admissible
      })
    );
  }
  return Object.freeze(definitions);
}

/** Closed, frozen canonical V0 personality dimension registry. */
export const PERSONALITY_DIMENSION_REGISTRY_V0: readonly PersonalityDimensionDefinitionV0[] =
  buildRegistry(RAW_DIMENSIONS_V0);

/** Exact admitted dimension ids, raw-ASCII ascending. */
export const PERSONALITY_DIMENSION_IDS_V0: readonly string[] = Object.freeze(
  PERSONALITY_DIMENSION_REGISTRY_V0.map((definition) => definition.dimension_id as string)
);

/**
 * ENGINEERING_REFERENCE_V0 genesis disposition — explicit transparent starting
 * values for a fresh subject's personality. Deliberately NOT all 0.5 (no
 * universal neutral human) and explicitly declared rather than inferred.
 */
export const ENGINEERING_REFERENCE_V0_GENESIS_DISPOSITION: Readonly<
  Record<string, UnitIntervalV0>
> = (() => {
  const raw: Readonly<Record<string, number>> = Object.freeze({
    agreeableness: 0.58,
    conscientiousness: 0.6,
    extraversion: 0.44,
    openness: 0.56
  });
  const ids = PERSONALITY_DIMENSION_IDS_V0;
  const keys = Object.keys(raw).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  if (keys.length !== ids.length || keys.some((key, index) => key !== ids[index])) {
    failInvariant(
      `genesis disposition keys must exactly cover the registry (expected ${ids.join(", ")}, got ${keys.join(", ")})`
    );
  }
  const values = keys.map((key) => toUnitInterval(raw[key] as number, `genesis_disposition.${key}`));
  if (values.every((value) => value === 0.5)) {
    failInvariant("genesis disposition must not be a universal 0.5 neutral human");
  }
  const frozen: Record<string, UnitIntervalV0> = {};
  for (let index = 0; index < keys.length; index++) {
    frozen[keys[index] as string] = values[index] as UnitIntervalV0;
  }
  return Object.freeze(frozen);
})();

/** True iff the id is an admitted canonical personality dimension. */
export function isCanonicalPersonalityDimensionV0(dimensionId: string): boolean {
  return PERSONALITY_DIMENSION_IDS_V0.includes(dimensionId);
}

/**
 * The immutable genesis prior P0 as a `TraitsSeedV0` (sorted keys). This is the
 * canonical disposition a fresh subject starts from; it says nothing about
 * lived history and creates no Memory/Experience/Belief/Relationship.
 */
export function canonicalGenesisTraitsSeedV0(): TraitsSeedV0 {
  const dimensions: Record<string, UnitIntervalV0> = {};
  for (const dimensionId of PERSONALITY_DIMENSION_IDS_V0) {
    dimensions[dimensionId] = ENGINEERING_REFERENCE_V0_GENESIS_DISPOSITION[dimensionId] as UnitIntervalV0;
  }
  return { dimensions: Object.freeze(dimensions) };
}

/**
 * `personality(t=0) = P0`: the acquired mutable personality state a fresh
 * subject is admitted with. Uses the existing frozen traits_seed → personality
 * mapping; traits_seed itself is only read, never written.
 */
export function initializeCanonicalGenesisPersonalityV0(): PersonalityStateV0 {
  return initializePersonalityFromTraitsSeed(canonicalGenesisTraitsSeedV0());
}
