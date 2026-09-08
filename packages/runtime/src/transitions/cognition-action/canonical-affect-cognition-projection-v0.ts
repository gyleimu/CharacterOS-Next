/**
 * CANONICAL_AFFECT_COGNITION_INTEGRATION_V0 — the frozen raw-VA cognition
 * section.
 *
 * One responsibility only: CanonicalAffectV0 → the exact frozen cognition
 * section, with EXACT canonical numeric values preserved (no rounding, no
 * quantization, no bins, no percentages, no transforms). Pure: no runtime, no
 * provider, no state access, no dynamics constants, no history, no named
 * emotions, no Mood.
 *
 * Numeric semantics (engineering-state dimensions only — never psychological
 * diagnosis, never named emotion meaning):
 *   valence    ∈ [-1, 1]  -1 = maximally negative pole, 0 = neutral, +1 =
 *                          maximally positive pole
 *   activation ∈ [0, 1]    0 = minimal activation,       1 = maximal activation
 */

import type { CanonicalAffectV0 } from "@characteros-next/subject-core";
import { validateCanonicalAffectShape } from "@characteros-next/subject-core";

export const CANONICAL_AFFECT_COGNITION_PROJECTION_V0_SCHEMA_VERSION =
  "canonical-affect-cognition-projection-v0" as const;

/** The exact frozen section embedded in CognitiveContextProjectionV2. */
export interface CanonicalAffectCognitionProjectionV0 {
  readonly schema_version: typeof CANONICAL_AFFECT_COGNITION_PROJECTION_V0_SCHEMA_VERSION;
  readonly valence: number;
  readonly activation: number;
}

/**
 * Projects the committed canonical Affect into the cognition section with the
 * exact canonical numeric values. Fails closed on any malformed affect shape —
 * no coercion, no defaults, no fabrication.
 */
export function projectCanonicalAffectForCognitionV0(
  affect: CanonicalAffectV0
): CanonicalAffectCognitionProjectionV0 {
  const checked = validateCanonicalAffectShape(affect, "canonical affect cognition projection");
  if (!checked.ok) {
    throw new Error(`canonical affect cognition projection: ${checked.error.detail}`);
  }
  return Object.freeze({
    schema_version: CANONICAL_AFFECT_COGNITION_PROJECTION_V0_SCHEMA_VERSION,
    valence: checked.value.valence,
    activation: checked.value.activation
  });
}
