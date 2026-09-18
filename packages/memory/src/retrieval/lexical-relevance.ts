/**
 * DETERMINISTIC LEXICAL RELEVANCE V0 — the read-only ranking signal that lets the
 * CURRENT USER UTTERANCE influence memory selection (LONG_HORIZON_MEMORY_RETRIEVAL_
 * REMEDIATION_V0).
 *
 * Adjudicated deficiency (MULTI_STAGE_RECALL_DEFICIENCY): the production retrieval
 * query anchored semantics on a session observation ref that shares no namespace with
 * episode refs, every candidate carried constant entity/context refs and equal declared
 * salience, so ranking degenerated to recency — old, topically relevant episodes were
 * cut by top-K before they could ever reach cognition.
 *
 * This module adds the missing signal with NO model calls, NO embeddings, NO network
 * and NO domain vocabulary (no stopword tables, no workshop words, no lookup maps):
 *   - `normalizeLexicalTokensV0` — deterministic, Unicode-aware word tokens
 *     (case-folded, punctuation stripped, deduplicated) with a MINIMAL deterministic
 *     plural fold so "drawers" and "drawer" meet; no stemming beyond that;
 *   - `distinctiveWeightsV0` — one IDF-style weight per query token, computed over the
 *     candidate set of THIS query: tokens present in many candidates ("the", "and",
 *     "you") carry no weight, rare topic tokens carry the most. This replaces any
 *     hand-maintained stopword list with the candidate distribution itself;
 *   - `lexicalScoreV0` — the candidate's score: the summed weight of the DISTINCTIVE
 *     query tokens its factual text contains. Zero ⇒ the candidate stays in the
 *     existing structural ranking; positive ⇒ it enters the relevance-aware tier.
 *
 * The signal is representation-only ranking assistance: nothing here writes state, and
 * the canonical visibility authority still decides which episodes are candidates.
 */

/** Minimum distinct query tokens for a query text to carry a meaningful signal. */
export const LEXICAL_MIN_QUERY_TOKENS_V0 = 3;

/**
 * A query token is DISTINCTIVE when its document frequency stays below this fraction of
 * the candidate set (tokens shared by a third of the life — "the", "you", "and" —
 * cannot discriminate anything). Genuine topics appear in a small minority of episodes.
 */
export const LEXICAL_DISTINCTIVE_MAX_DF_FRACTION_V0 = 1 / 3;

/** Maximum query text length accepted for the lexical signal (bounded work). */
export const LEXICAL_MAX_QUERY_CHARS_V0 = 4096;

/**
 * Deterministic word tokens: Unicode letters/digits only, case-folded, minimum two
 * characters, deduplicated in first-occurrence order, with a minimal singular fold
 * (girls→girl, boxes→box, cities→city; never recursive, no stemming beyond the fold).
 * Locale-independent by construction.
 */
export function normalizeLexicalTokensV0(text: string | null | undefined): readonly string[] {
  if (typeof text !== "string" || text.length === 0) return [];
  const folded = text.toLowerCase().normalize("NFKC");
  const tokens: string[] = [];
  const seen = new Set<string>();
  for (const match of folded.matchAll(/[\p{L}\p{N}]{2,}/gu)) {
    const token = singularFoldV0(match[0]);
    if (token.length < 2 || seen.has(token)) continue;
    seen.add(token);
    tokens.push(token);
  }
  return tokens;
}

/** Minimal deterministic plural fold (shared shape, no dictionary, no recursion). */
function singularFoldV0(token: string): string {
  if (token.length >= 5 && token.endsWith("ies")) return `${token.slice(0, -3)}y`;
  if (token.length >= 4 && /(sh|ch|ss|x)es$/.test(token)) return token.slice(0, -2);
  if (token.length >= 4 && token.endsWith("s") && !token.endsWith("ss")) return token.slice(0, -1);
  return token;
}

/** True when a query text can carry a meaningful lexical signal at all. */
export function hasMeaningfulLexicalSignalV0(queryText: string | null | undefined): boolean {
  if (typeof queryText !== "string" || queryText.length === 0) return false;
  if (queryText.length > LEXICAL_MAX_QUERY_CHARS_V0) return false;
  return normalizeLexicalTokensV0(queryText).length >= LEXICAL_MIN_QUERY_TOKENS_V0;
}

/**
 * IDF-style weight per DISTINCT query token over THIS query's candidate set:
 * weight = log2(1 + candidateCount / df) for tokens whose document frequency stays
 * within the distinctiveness fraction; ubiquitous tokens get weight 0. Deterministic,
 * bounded, computed fresh per query from the candidate distribution itself.
 */
export function distinctiveWeightsV0(
  queryTokens: readonly string[],
  candidateTokenSets: readonly (readonly string[])[]
): ReadonlyMap<string, number> {
  const weights = new Map<string, number>();
  if (queryTokens.length === 0 || candidateTokenSets.length === 0) return weights;
  const sets = candidateTokenSets.map((tokens) => new Set<string>(tokens));
  for (const token of queryTokens) {
    let df = 0;
    for (const set of sets) {
      if (set.has(token)) df += 1;
    }
    if (df === 0 || df / sets.length > LEXICAL_DISTINCTIVE_MAX_DF_FRACTION_V0) {
      weights.set(token, 0);
    } else {
      weights.set(token, Math.log2(1 + sets.length / df));
    }
  }
  return weights;
}

/**
 * The candidate's relevance score: the summed weight of the DISTINCTIVE query tokens
 * its factual text contains. 0 ⇒ keep the existing structural ranking; > 0 ⇒ the
 * candidate enters the relevance-aware tier, higher score first.
 */
export function lexicalScoreV0(
  candidateTokens: readonly string[],
  weights: ReadonlyMap<string, number>
): number {
  if (weights.size === 0) return 0;
  const set = new Set<string>(candidateTokens);
  let score = 0;
  for (const [token, weight] of weights) {
    if (weight > 0 && set.has(token)) score += weight;
  }
  return score;
}
