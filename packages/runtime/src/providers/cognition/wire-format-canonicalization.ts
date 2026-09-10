/**
 * Provider-boundary wire-format canonicalization for the CognitionProposalV0
 * set-like ref collections.
 *
 * FROZEN LAW (single source, extracted verbatim from the LLM cognition
 * provider's LIVE-SMOKE REPAIR): `relevant_memory_refs`,
 * `considered_context_refs` and `evidence_refs` are SET-LIKE collections whose
 * frozen canonical order is lexicographic. The model's array order carries no
 * authority — `CognitionProposalV1` already states this ("the model's array
 * order has no authority") and sorts the same three fields itself.
 *
 * Sorting a set-like field is a pure REPRESENTATION transform: membership,
 * provenance and semantics are unchanged; no ref is added, removed, renamed,
 * prefixed, aliased or dropped. This layer is NOT a trust boundary — every
 * substantive gate (closed schema, ref grammar, duplicate rejection,
 * projection binding, evidence grounding, action space) still runs afterwards
 * on the canonicalized object, and bare/hallucinated refs still reach the
 * frozen validation and are rejected there.
 */

/** The CognitionProposalV0 set-like ref collections in frozen canonical order. */
export const SET_LIKE_REF_FIELDS: readonly string[] = [
  "relevant_memory_refs",
  "considered_context_refs",
  "evidence_refs"
];

/**
 * Returns a shallow copy of `proposalLike` whose set-like ref arrays are in
 * canonical (UTF-16 ascending) order. Non-array values are passed through
 * untouched so the frozen validation still rejects them. Never mutates the
 * input object.
 */
export function canonicalizeSetLikeRefFields(proposalLike: unknown): unknown {
  if (typeof proposalLike !== "object" || proposalLike === null || Array.isArray(proposalLike)) {
    return proposalLike;
  }
  const out: Record<string, unknown> = { ...(proposalLike as Record<string, unknown>) };
  for (const field of SET_LIKE_REF_FIELDS) {
    const value = out[field];
    if (Array.isArray(value)) {
      out[field] = [...(value as unknown[])].sort((a, b) =>
        String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0
      );
    }
  }
  return out;
}
