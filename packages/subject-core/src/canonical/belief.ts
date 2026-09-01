/** CharacterOS-owned deterministic proposition identity authority. */

import type { IdentifierV0 } from "../types/scalars.js";
import { validateIdentifier } from "../validation/scalars.js";
import { hashEnvelope } from "./hash.js";

export const BELIEF_PROPOSITION_ID_PROJECTION =
  "characteros-next/belief/proposition-id/v1" as const;

/**
 * Derives `belief-<sha256 hex>` from the exact versioned JCS envelope over the
 * canonical subject id and explicit CharacterOS-owned proposition key.
 */
export async function deriveBeliefPropositionId(
  subjectId: IdentifierV0,
  propositionKey: IdentifierV0
): Promise<IdentifierV0> {
  const subject = validateIdentifier(subjectId, "belief.proposition_identity.subject_id");
  if (!subject.ok) {
    throw new Error(`INVALID_BELIEF_SUBJECT_ID: ${subject.error.reason} ${subject.error.detail}`);
  }
  const key = validateIdentifier(
    propositionKey,
    "belief.proposition_identity.proposition_key"
  );
  if (!key.ok) {
    throw new Error(`INVALID_BELIEF_PROPOSITION_KEY: ${key.error.reason} ${key.error.detail}`);
  }
  const digest = await hashEnvelope(BELIEF_PROPOSITION_ID_PROJECTION, {
    subject_id: subject.value,
    proposition_key: key.value
  });
  const raw = `belief-${digest.replace(/^sha256:/, "")}`;
  const identifier = validateIdentifier(raw, "belief.proposition_id");
  if (!identifier.ok) {
    throw new Error(
      `INVALID_DERIVED_BELIEF_PROPOSITION_ID: ${identifier.error.reason} ${identifier.error.detail}`
    );
  }
  return identifier.value;
}
