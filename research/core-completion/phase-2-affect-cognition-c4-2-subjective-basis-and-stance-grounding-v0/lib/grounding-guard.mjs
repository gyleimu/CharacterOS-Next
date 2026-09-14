/**
 * C4.2 — candidate lexical grounding guard (RESEARCH ONLY, evaluated once).
 *
 * The rule under evaluation, frozen before the run:
 *   A `SELECTED` stance is turn-grounded when it shares at least one CONTENT TOKEN
 *   with the turn's own material:
 *       turn request text (projection.context.scene)
 *       UNION lawful factual_assessment claim texts
 *   Content token = lowercase `[a-z0-9]{4,}` run, excluding the frozen
 *   stopword/connector list below.
 *
 * Grounding sources deliberately excluded (per the C4.1 decision): the rationale,
 * current_intent, Language output, Affect and subject state.
 *
 * No embeddings, no second model, no task taxonomy, no option list.
 */

/** Frozen stopword/connector list (grammar only — never task vocabulary). */
export const FROZEN_STOPWORDS = Object.freeze([
  'that', 'this', 'these', 'those', 'with', 'without', 'would', 'should', 'could', 'will', 'shall',
  'have', 'has', 'had', 'been', 'being', 'from', 'into', 'onto', 'they', 'them', 'their', 'there',
  'then', 'than', 'when', 'what', 'which', 'while', 'whom', 'whose', 'your', 'yours', 'you',
  'the', 'and', 'for', 'not', 'but', 'are', 'was', 'were', 'its', 'it', 'is', 'as', 'at', 'on',
  'in', 'of', 'to', 'a', 'an', 'my', 'me', 'i', 'we', 'us', 'our', 'ours', 'do', 'does', 'did',
  'done', 'be', 'or', 'if', 'so', 'no', 'yes', 'about', 'over', 'under', 'again', 'more', 'most',
  'some', 'any', 'all', 'both', 'each', 'also', 'just', 'very', 'only', 'still', 'even', 'here',
  'state', 'exactly', 'given', 'says', 'asks', 'asked', 'user', 'personally', 'brief', 'reason',
  'respond', 'latest', 'message', 'now', 'next', 'first', 'last', 'later', 'today', 'tomorrow'
]);

/** Deterministic content-token extraction (rule frozen with the suite). */
export function contentTokens(text) {
  const matches = String(text ?? '').toLowerCase().match(/[a-z0-9]{4,}/g) ?? [];
  return [...new Set(matches)].filter((token) => !FROZEN_STOPWORDS.includes(token));
}

/**
 * Grounding verdict for one SELECTED stance.
 * @param stance the selected stance text
 * @param requestText the current turn's user-facing request/scene text
 * @param lawfulClaimTexts the lawful factual_assessment claim texts
 */
export function groundingVerdict(stance, requestText, lawfulClaimTexts = []) {
  const stanceTokens = contentTokens(stance);
  const sourceTokens = new Set([...contentTokens(requestText), ...lawfulClaimTexts.flatMap((text) => contentTokens(text))]);
  const shared = stanceTokens.filter((token) => sourceTokens.has(token));
  return {
    grounded: shared.length > 0,
    stance_tokens: stanceTokens,
    shared_tokens: shared,
    source_token_count: sourceTokens.size
  };
}

/** The host-level decision this guard would implement (if it ever ships). */
export const GROUNDING_REJECTION_CODE = 'STANCE_NOT_TURN_GROUNDED';
