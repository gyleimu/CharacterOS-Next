/**
 * PersonalityDimensionRegistryV0 — canonical personality dimension ADMISSION.
 *
 * This module is the SINGLE closed semantic contract that answers "which
 * persistent subject-global properties may count as personality in
 * CharacterOS-Next V0?". It defines the admitted dimension vocabulary and its
 * qualitative semantics ONLY.
 *
 * AUTHORITY SEPARATION (PERSONALITY_GENESIS_PRIOR_AUTHORITY_V0):
 *   dimension admission   — THIS module (which ids may exist)
 *   dimension value assignment — NOT authorized here (no genesis prior,
 *   no default disposition, no numeric authority of any kind)
 *
 * A registry that says "openness is a Personality dimension" does NOT thereby
 * say "every new subject has openness = X". The genesis P0 value authority is a
 * distinct, currently-unresolved authority: this module deliberately ships NO
 * default values, NO fallback (no universal 0.5), and NO randomness. A fresh
 * production subject therefore starts with `traits_seed = {}` and
 * `personality = []` until an explicit lawful genesis-prior admission exists.
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
 * The registry is closed and frozen: adding a dimension is a schema admission
 * decision (a new slice), never a runtime/plasticity action.
 */

import {
  validateIdentifier,
  type IdentifierV0
} from "@characteros-next/subject-core";

export const PERSONALITY_DIMENSION_REGISTRY_SCHEMA_VERSION =
  "personality-dimension-registry-v0" as const;

/** Domain literal — a registry entry can only ever be PERSONALITY. */
export const PERSONALITY_DIMENSION_DOMAIN = "PERSONALITY" as const;

/**
 * One admitted canonical personality dimension. Purely qualitative semantic
 * metadata (no numeric values, no cross-domain weights, no affect/belief/
 * relationship semantics).
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

/** Closed, frozen canonical V0 personality dimension registry (admission only). */
export const PERSONALITY_DIMENSION_REGISTRY_V0: readonly PersonalityDimensionDefinitionV0[] =
  buildRegistry(RAW_DIMENSIONS_V0);

/** Exact admitted dimension ids, raw-ASCII ascending. */
export const PERSONALITY_DIMENSION_IDS_V0: readonly string[] = Object.freeze(
  PERSONALITY_DIMENSION_REGISTRY_V0.map((definition) => definition.dimension_id as string)
);

/** True iff the id is an admitted canonical personality dimension. */
export function isCanonicalPersonalityDimensionV0(dimensionId: string): boolean {
  return PERSONALITY_DIMENSION_IDS_V0.includes(dimensionId);
}
