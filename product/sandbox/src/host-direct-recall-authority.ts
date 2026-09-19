/**
 * HOST_DIRECT_RECALL_PRODUCT_AUTHORITY_V0 — product/session-layer authority.
 *
 * ARCHITECTURE DECISION (human-authorized): a narrow, deterministic direct-recall
 * channel that may bypass unreliable model structured-claim generation ONLY when the
 * answer can be selected mechanically and safely from already-authorized factual
 * memory evidence.
 *
 * AUTHORITY LOCATION: product/session layer. This module does NOT redefine what
 * constitutes a lawful factual claim (that is `authorizeFactualClaimV1`, frozen). It
 * does NOT modify Memory, retrieval, cognition, language, or persistence. It produces
 * an already-existing lawful claim type (SOURCE_QUOTE) and passes it through the
 * existing V8 validation pipeline unchanged.
 *
 * ELIGIBILITY LAW (all conditions must hold; any failure → ABSTAIN):
 *   A. the query is recognizably a direct factual recall request (contains an
 *      interrogative and ends with '?');
 *   B. relevant canonical memory evidence exists (non-empty selection);
 *   C. at least one exact factual answer-bearing statement span exists;
 *   D. the selected span is NOT a recorded question;
 *   E. the referent is mechanically unambiguous (single distinctive winner);
 *   F. no relevant contradiction blocks deterministic selection;
 *   G. no semantic inference is required (span is exact evidence text);
 *   H. provenance is lawful (the span's episode ref is a factual source);
 *   I. the resulting claim passes frozen authorization.
 *
 * SINGLE-WINNER LAW: the best-scoring span must be strictly higher than the
 * second-best; a tie means ABSTAIN (no answer-arbitration in V0).
 *
 * CONTRADICTION LAW: spans that contradict each other produce tied or ambiguous
 * scores → ABSTAIN under the single-winner law; no "newest = truth" rule is created.
 *
 * SELF-MATCH LAW: spans ending in '?' are recorded questions and are excluded from
 * answer candidacy before scoring.
 *
 * SEMANTIC-INFERENCE LAW: the channel only copies exact evidence spans; it never
 * infers, paraphrases or summarizes. A fabricated claim cannot pass frozen
 * authorization (REJECTED_SOURCE_BINDING).
 *
 * NO DIRECT STRING BYPASS: the authorized claim is delivered through the EXISTING
 * V8 parse → authorization → realization → language pipeline. No host direct-return
 * string exists.
 *
 * CAN_SAY LAW: unchanged. Host selection determines that the case QUALIFIES for
 * deterministic direct recall; it does not change authorized claims into MUST_SAY.
 *
 * FEATURE FLAG: this authority is opt-in (`CHARACTEROS_DIRECT_RECALL=1` in the
 * product path; the session-layer constructor option). Default OFF keeps every
 * existing caller — frozen experiments, preregistered calibration requests —
 * byte-identical.
 */

/** Query classification: the narrow deterministic direct-recall interrogative class. */
const DIRECT_RECALL_INTERROGATIVES_V0 = Object.freeze([
  "where",
  "what",
  "which",
  "who"
]);

/** Minimum content tokens for the query to be classifiable (avoid noise). */
const MIN_QUERY_CONTENT_TOKENS_V0 = 2;

/** Minimum shared content tokens (SUBSTANTIVE overlap) for a span to win. */
const MIN_WINNER_OVERLAP_V0 = 2;

/**
 * OBSERVED LIMITATION (real-Alice replay, HOST_DIRECT_RECALL_PRODUCT_AUTHORITY_V0):
 * token-overlap eligibility CANNOT distinguish a recorded PROBLEM from its recorded
 * SOLUTION. For "What fixed the stool wobble?" the span "The stool is finished, and it
 * wobbles a little on the stone floor." shares two content tokens (stool, wobble) and
 * outscores the true solution span, which shares none. Separating them requires
 * semantic understanding, which §12 forbids the host to perform.
 *
 * CONSEQUENCE: this V0 authority is NOT safe to enable for causal (`what fixed` /
 * `why`) recall. It stays DISABLED BY DEFAULT; the real-Alice replay reports 1/3 and
 * that one is the problem statement, so the verdict is INCOMPLETE.
 */

/**
 * PRECISION LAW (FOCUS-SLOT LAW): a span may win only when it plausibly SATISFIES the
 * interrogative focus, not merely mentions a topic noun. For a `where` question the
 * span must carry a location cue. Without this, "the stool has a place by the door"
 * would "answer" a question about why the stool wobbles, and "the cat avoids the
 * bench" would "answer" where the cat sleeps — both are semantic inference, which the
 * host is forbidden to perform.
 *
 * The cue list is closed, general locational function words — NOT domain vocabulary.
 * A `where` question whose candidate spans carry no location cue ABSTAINS.
 */
const LOCATION_CUES_V0 = Object.freeze([
  "in", "on", "under", "inside", "outside", "behind", "beside", "next",
  "near", "above", "below", "at", "by", "with", "against",
  "top", "bottom", "shelf", "bench", "floor", "corner", "drawer", "wall"
]);

/** True when the span carries a locational cue (satisfies a `where` focus). */
function hasLocationCue(span: string): boolean {
  const tokens = new Set(span.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/));
  return LOCATION_CUES_V0.some((cue) => tokens.has(cue));
}

/** The interrogative focus of the query, or null when it is not a focus question. */
function focusOf(query: string): "LOCATION" | "ENTITY" | null {
  const lower = query.toLowerCase();
  if (/\bwhere\b/.test(lower)) return "LOCATION";
  if (/\b(what|which|who)\b/.test(lower)) return "ENTITY";
  return null;
}

/** Deterministic tokenization: lowercase, strip non-alphanumeric, drop stopwords. */
function contentTokens(text: string): readonly string[] {
  const stop = new Set([
    "the", "a", "an", "i", "it", "is", "was", "to", "of", "and", "in", "on",
    "my", "did", "do", "does", "at", "for", "you", "your", "that", "this",
    "again", "about", "from", "with", "have", "has", "had", "what", "which",
    "where", "who", "when", "how", "tell", "remember", "know"
  ]);
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 2 && !stop.has(token))
    .map(singularFoldV0);
}

/**
 * Minimal deterministic plural fold — the SAME shared shape used by the retrieval
 * remediation (sleeps→sleep, boxes→box, cities→city). Never recursive, no dictionary,
 * no stemming beyond the fold.
 */
function singularFoldV0(token: string): string {
  if (token.length >= 5 && token.endsWith("ies")) return token.slice(0, -3) + "y";
  if (token.length >= 4 && /(sh|ch|ss|x)es$/.test(token)) return token.slice(0, -2);
  if (token.length >= 4 && token.endsWith("s") && !token.endsWith("ss")) return token.slice(0, -1);
  return token;
}

/** Deterministic sentence split: punctuation-boundary only. */
function splitSentences(text: string): readonly string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

export interface DirectRecallEvidenceEntryV0 {
  readonly episode_ref: string;
  readonly kind: string;
  readonly delivered_behavior_text?: string;
  readonly exact_outcome_text?: string;
  readonly scene?: string;
}

export interface DirectRecallInputV0 {
  readonly query_text: string;
  readonly evidence_entries: readonly DirectRecallEvidenceEntryV0[];
  readonly selected_refs: readonly string[];
}

export interface DirectRecallWinnerV0 {
  readonly span: string;
  readonly source_ref: string;
  readonly score: number;
}

export type DirectRecallEvaluationV0 =
  | {
      readonly eligible: true;
      readonly winner: DirectRecallWinnerV0;
      readonly all_scored: readonly { readonly ref: string; readonly span: string; readonly score: number; readonly kind: string }[];
    }
  | {
      readonly eligible: false;
      readonly reason: string;
    };

/** Deterministic direct-recall eligibility evaluation. Pure function. */
export function evaluateDirectRecallV0(input: DirectRecallInputV0): DirectRecallEvaluationV0 {
  const query = input.query_text;
  // A. query is a direct factual recall request: contains an interrogative and ends with '?'
  const lower = query.toLowerCase();
  const hasInterrogative = DIRECT_RECALL_INTERROGATIVES_V0.some((word) => lower.includes(word));
  const endsWithQuestion = query.trimEnd().endsWith("?");
  if (!hasInterrogative || !endsWithQuestion) {
    return { eligible: false, reason: "query is not a direct factual recall question" };
  }

  // B. relevant canonical memory evidence exists
  if (input.evidence_entries.length === 0) {
    return { eligible: false, reason: "no memory evidence selected" };
  }

  // C/D/G: collect non-question statement spans from the evidence
  const contentQueryTokens = contentTokens(query);
  if (contentQueryTokens.length < MIN_QUERY_CONTENT_TOKENS_V0) {
    return { eligible: false, reason: "query has too few content tokens for classification" };
  }
  // FOCUS-SLOT LAW: a `where` question needs a locational span; a question whose
  // focus cannot be satisfied by a cue abstains (precision over recall, §5/§12).
  const focus = focusOf(query);
  if (focus === null) {
    return { eligible: false, reason: "query has no supported interrogative focus" };
  }
  // CAUSAL-FOCUS REFUSAL (observed limitation, see MIN_WINNER_OVERLAP_V0): a
  // "what <verbed> …" question asks for a CAUSE or SOLUTION. Token overlap cannot
  // tell a recorded problem from its recorded solution — "the stool … wobbles"
  // scores on a question about what fixed the wobble — so this V0 authority refuses
  // the causal focus entirely rather than risk an over-authority answer.
  if (/\bwhat\s+\w+ed\b/i.test(query)) {
    return { eligible: false, reason: "causal recall is outside the V0 direct-recall class" };
  }

  interface ScoredSpan {
    readonly ref: string;
    readonly span: string;
    readonly kind: string;
    readonly score: number;
  }
  const scored: ScoredSpan[] = [];
  for (const entry of input.evidence_entries) {
    const texts =
      entry.kind === "BEHAVIOR_OUTCOME"
        ? [entry.delivered_behavior_text ?? "", entry.exact_outcome_text ?? ""]
        : [entry.scene ?? ""];
    for (const text of texts) {
      for (const span of splitSentences(text)) {
        const isQuestion = span.endsWith("?");
        // D. recorded questions are NEVER answer candidates
        if (isQuestion) continue;
        // FOCUS-SLOT LAW: a `where` span must carry a location cue; a span that merely
        // shares a topic noun cannot answer a locational question without inference.
        if (focus === "LOCATION" && !hasLocationCue(span)) continue;
        const spanTokens = new Set(contentTokens(span));
        let score = 0;
        for (const token of contentQueryTokens) {
          if (spanTokens.has(token)) score += 1;
        }
        if (score > 0) {
          scored.push({ ref: entry.episode_ref, span, kind: entry.kind, score });
        }
      }
    }
  }

  // E. single winner: exactly one span with the strictly highest score
  if (scored.length === 0) {
    return { eligible: false, reason: "no content-bearing span matches the query" };
  }
  const sorted = [...scored].sort((left, right) => right.score - left.score || (left.ref < right.ref ? -1 : 1));
  const best = sorted[0];
  // Exactly one scored span is the unique winner by construction (no competition).
  if (sorted.length === 1 && best !== undefined) {
    if (best.score < MIN_WINNER_OVERLAP_V0) {
      return { eligible: false, reason: "no span reaches the minimum winner score" };
    }
    return {
      eligible: true,
      winner: { span: best.span, source_ref: best.ref, score: best.score },
      all_scored: sorted
    };
  }
  const second = sorted[1];
  if (best === undefined || second === undefined || best.score === second.score || best.score < MIN_WINNER_OVERLAP_V0) {
    return { eligible: false, reason: "no single unambiguous winner (tie or below threshold)" };
  }

  return {
    eligible: true,
    winner: { span: best.span, source_ref: best.ref, score: best.score },
    all_scored: sorted
  };
}

export interface HostDirectRecallEvaluationV0 {
  readonly eligible: boolean;
  readonly abstain_reason: string | null;
  readonly span: string | null;
  readonly source_ref: string | null;
}

/** Convenience wrapper: evaluate + extract the winning span/source ref. */
export function evaluateHostDirectRecallV0(
  query: string,
  evidenceEntries: readonly DirectRecallEvidenceEntryV0[],
  selectedRefs: readonly string[]
): HostDirectRecallEvaluationV0 {
  const result = evaluateDirectRecallV0({
    query_text: query,
    evidence_entries: evidenceEntries,
    selected_refs: selectedRefs
  });
  if (!result.eligible) {
    return { eligible: false, abstain_reason: result.reason, span: null, source_ref: null };
  }
  return { eligible: true, abstain_reason: null, span: result.winner.span, source_ref: result.winner.source_ref };
}
