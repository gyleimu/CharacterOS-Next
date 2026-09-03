/**
 * Interaction Familiarity Cognition Influence V0
 * (RELATIONSHIP_FAMILIARITY_COGNITION_INFLUENCE_V0, READ-ONLY).
 *
 * The ONE deterministic, feature-specific cognition strategy artifact derived
 * from the frozen interaction-familiarity read projection:
 *
 *   canonical Relationship state
 *   → frozen familiarity read projection
 *   → THIS fixed V0 policy
 *   → CognitiveContextProjectionV0.interaction_familiarity_cognition_influences
 *
 * EXACT V0 COGNITION EFFECT: interaction familiarity changes exactly ONE
 * cognition process — the CONTEXT RESOLUTION STRATEGY for the exact active
 * counterpart. Closed strategy vocabulary, no third strategy, no score, no
 * confidence, no utility, no action preference, no free-form hint.
 *
 *   BASIC_CONTEXT_FIRST            familiarity does not authorize an additional
 *                                  counterpart-specific retrieval priority;
 *                                  cognition may still use normally supplied
 *                                  memory and ordinary clarification.
 *   COUNTERPART_CONTEXT_SEARCH_FIRST  before broad clarification, cognition is
 *                                  authorized to prefer ONE future exact-
 *                                  counterpart interaction-memory lookup. This
 *                                  artifact EXPRESSES the strategy only — it
 *                                  performs NO retrieval (Layer B executes it
 *                                  later; empty/irrelevant/unavailable results
 *                                  fall back to clarification; nothing may be
 *                                  invented from familiarity).
 *
 * FIXED V0 POLICY (single source of truth in THIS module):
 *   ABSENT          → BASIC_CONTEXT_FIRST
 *   PRESENT 0/32    → BASIC_CONTEXT_FIRST
 *   PRESENT 1/32    → BASIC_CONTEXT_FIRST
 *   PRESENT k/32, 2 <= k <= 32 → COUNTERPART_CONTEXT_SEARCH_FIRST
 *
 * The threshold 2 is an explicit V0 ENGINEERING POLICY, not a psychology claim:
 * k = 1 proves exactly one credited firsthand interaction; k >= 2 is the first
 * mechanically verifiable state showing repeated independent admitted receipts,
 * sufficient to justify the cost of one future extra exact-counterpart
 * retrieval attempt. It does NOT mean two human interactions make someone
 * familiar. The threshold exists in ONE place and must not be duplicated into
 * renderers, builders or tests as independent production logic.
 *
 * ABSENT vs PRESENT 0: the frozen read projections remain structurally
 * different, and the cognition strategy INTENTIONALLY maps both to
 * BASIC_CONTEXT_FIRST — neither carries positive credited firsthand
 * interaction. Equal strategies from different source projections are
 * intentional, not a coercion.
 *
 * INPUT BOUNDARY: derivation consumes ONLY the frozen
 * RelationshipInteractionFamiliarityReadProjectionV0 — raw Relationship
 * dimensions are never re-read and no familiarity validation is duplicated.
 * The artifact carries no familiarity value, ordinal, presence, threshold,
 * memory/evidence/authority refs, confidence, explanation or utility; it is
 * associated with its source projection by exact counterpart_ref and bound by
 * the parent cognition projection hash.
 *
 * ACTIVE COUNTERPART GATE: influence exists only for counterpart refs that are
 * BOTH canonically registered (their read projection exists) AND present in the
 * current context.active_entity_refs (exact canonical ref equality — no alias,
 * no fuzzy matching, no global influence). Entries are raw-ASCII sorted by
 * counterpart_ref; no eligible active counterpart → empty array.
 *
 * This strategy must NOT affect action utility, Belief tendency, decision
 * arbitration, action ranking, compliance, willingness, risk tolerance, trust,
 * affinity, safety or valence. The causal endpoint is COGNITION STRATEGY, not
 * action selection. Fully deterministic: zero model calls, zero retrieval calls.
 */

import type { CanonicalRefV0 } from "@characteros-next/subject-core";

import type { RelationshipInteractionFamiliarityReadProjectionV0 } from "./relationship-interaction-familiarity-read-projection.js";

export const RELATIONSHIP_INTERACTION_FAMILIARITY_COGNITION_INFLUENCE_SCHEMA_VERSION_V0 =
  "relationship-interaction-familiarity-cognition-influence-v0" as const;

/** Closed context-resolution strategy vocabulary — no third strategy exists. */
export const RELATIONSHIP_INTERACTION_FAMILIARITY_CONTEXT_RESOLUTION_STRATEGIES_V0 = Object.freeze([
  "BASIC_CONTEXT_FIRST",
  "COUNTERPART_CONTEXT_SEARCH_FIRST"
] as const);

export type RelationshipInteractionFamiliarityContextResolutionStrategyV0 =
  (typeof RELATIONSHIP_INTERACTION_FAMILIARITY_CONTEXT_RESOLUTION_STRATEGIES_V0)[number];

/**
 * FIXED V0 ENGINEERING POLICY (single source of truth): the smallest credited
 * ordinal that authorizes COUNTERPART_CONTEXT_SEARCH_FIRST. Not a psychology
 * claim; do not duplicate this value elsewhere as production logic.
 */
export const COUNTERPART_CONTEXT_SEARCH_FIRST_MIN_CREDIT_LEVEL_V0 = 2;

/** Exact closed read-only influence artifact (3 fields, nothing more). */
export interface RelationshipInteractionFamiliarityCognitionInfluenceV0 {
  readonly schema_version: typeof RELATIONSHIP_INTERACTION_FAMILIARITY_COGNITION_INFLUENCE_SCHEMA_VERSION_V0;
  readonly counterpart_ref: CanonicalRefV0;
  readonly context_resolution_strategy: RelationshipInteractionFamiliarityContextResolutionStrategyV0;
}

function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  if (Object.isFrozen(value)) return;
  Object.freeze(value);
  for (const key of Object.keys(value as Record<string, unknown>)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
}

/**
 * The ONE fixed V0 policy derivation from the frozen read projection.
 * Deterministic and total: every lawful read projection maps to exactly one
 * closed strategy.
 */
export function deriveInteractionFamiliarityCognitionInfluenceV0(
  projection: RelationshipInteractionFamiliarityReadProjectionV0
): RelationshipInteractionFamiliarityCognitionInfluenceV0 {
  const strategy: RelationshipInteractionFamiliarityContextResolutionStrategyV0 =
    projection.presence === "PRESENT" &&
    projection.ordinal_level !== null &&
    projection.ordinal_level >= COUNTERPART_CONTEXT_SEARCH_FIRST_MIN_CREDIT_LEVEL_V0
      ? "COUNTERPART_CONTEXT_SEARCH_FIRST"
      : "BASIC_CONTEXT_FIRST";
  const influence: RelationshipInteractionFamiliarityCognitionInfluenceV0 = {
    schema_version: RELATIONSHIP_INTERACTION_FAMILIARITY_COGNITION_INFLUENCE_SCHEMA_VERSION_V0,
    counterpart_ref: projection.counterpart_ref,
    context_resolution_strategy: strategy
  };
  deepFreeze(influence);
  return influence;
}

/**
 * Active-counterpart gate + batch derivation used by the cognitive context
 * builder: only counterparts whose read projection exists AND whose exact
 * canonical ref appears in the current context.active_entity_refs produce an
 * influence. Entries are raw-ASCII sorted by counterpart_ref; deep frozen.
 */
export function deriveInteractionFamiliarityCognitionInfluencesV0(input: {
  readonly familiarityProjections: readonly RelationshipInteractionFamiliarityReadProjectionV0[];
  readonly activeEntityRefs: readonly CanonicalRefV0[];
}): readonly RelationshipInteractionFamiliarityCognitionInfluenceV0[] {
  const activeRefs = new Set<string>(input.activeEntityRefs as readonly string[]);
  const influences = input.familiarityProjections
    .filter((projection) => activeRefs.has(projection.counterpart_ref))
    .map((projection) => deriveInteractionFamiliarityCognitionInfluenceV0(projection))
    .sort((a, b) => (a.counterpart_ref < b.counterpart_ref ? -1 : a.counterpart_ref > b.counterpart_ref ? 1 : 0));
  deepFreeze(influences);
  return influences;
}

/**
 * The ONE shared deterministic model-facing rendering of the influence surface,
 * used IDENTICALLY by the V0 and V1 cognition provider paths (no semantic
 * divergence between provider versions). Pure function of the influence list.
 */
export function renderInteractionFamiliarityCognitionInfluencesV0(
  influences: readonly RelationshipInteractionFamiliarityCognitionInfluenceV0[]
): string {
  const entries =
    influences.length === 0
      ? "(no active counterpart familiarity influence)"
      : influences
          .map(
            (influence) =>
              `- ${influence.counterpart_ref}: context_resolution_strategy=${influence.context_resolution_strategy}`
          )
          .join("\n");
  return [
    "[interaction familiarity cognition influence — context-resolution ordering ONLY: BASIC_CONTEXT_FIRST = no counterpart-specific retrieval priority (use normally supplied memory and ordinary clarification as needed); COUNTERPART_CONTEXT_SEARCH_FIRST = prefer ONE future exact-counterpart interaction-memory lookup before broad clarification (that lookup is NOT performed by this strategy; if its future results are empty, irrelevant or unavailable, fall back to clarification; no shared fact may be invented from familiarity)]",
    "[this influence is derived from canonical familiarity state; it is NOT factual evidence, does NOT imply trust, liking or safety, carries no preference or desirability of any kind, and is NOT citeable — never place it in any refs array]",
    entries
  ].join("\n");
}
