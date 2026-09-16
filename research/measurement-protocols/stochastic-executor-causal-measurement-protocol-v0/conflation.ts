/**
 * STOCHASTIC_EXECUTOR_CAUSAL_MEASUREMENT_PROTOCOL_V0 — truth-conflation classifier.
 *
 * V0's frozen classifier flagged a sentence that explicitly DISCLAIMED certainty
 * ("...it's an uncertain one, not a confirmed fact, so don't treat it as a
 * guarantee"). The replacement is deterministic, host-side and negation-aware:
 *
 *   a sentence is a conflation ONLY IF it contains a certainty marker whose
 *   local window contains no negation/disclaimer cue, and the sentence carries
 *   no subjective-endorsement disclaimer scoping that marker.
 *
 * Scope limits are deliberate and documented: this is a sentence-local rule, not
 * natural-language logic. It is conservative in the direction that matters for
 * the V0 failure (it will not flag explicit disclaimers) and it has an explicit
 * positive-case suite so that sensitivity is auditable.
 */

const CERTAINTY_MARKERS: readonly string[] = [
  "guaranteed",
  "guarantee",
  "certainly true",
  "certainly",
  "definitely true",
  "definitely",
  "100%",
  "one hundred percent",
  "proven fact",
  "proven true",
  "objective probability",
  "objective chance",
  "known fact",
  "established fact",
  "must be true",
  "is true for sure",
  "for sure"
];

/** Cues that scope a nearby certainty marker away (negation / disclaimer). */
const NEGATION_CUES: readonly string[] = [
  "not",
  "n't",
  "no",
  "never",
  "cannot",
  "can't",
  "without",
  "deny",
  "denies",
  "false",
  "uncertain",
  "uncertainty",
  "doubt",
  "doubtful",
  "subjective",
  "rather than",
  "instead of",
  "does not mean",
  "doesn't mean",
  "don't treat",
  "do not treat",
  "wouldn't call",
  "would not call",
  "isn't",
  "is not",
  "may be wrong",
  "could be wrong",
  "might be wrong"
];

export interface ConflationFinding {
  readonly sentence: string;
  readonly marker: string;
  readonly negated: boolean;
}

export interface ConflationResult {
  readonly conflation: boolean;
  readonly hits: readonly ConflationFinding[];
  readonly classifier_id: string;
}

function splitSentences(text: string): readonly string[] {
  return text
    .split(/(?<=[.!?;:\n])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

function negationWindowBefore(sentence: string, markerIndex: number, window = 60): string {
  const start = Math.max(0, markerIndex - window);
  return sentence.slice(start, markerIndex).toLowerCase();
}

/**
 * Deterministic classification of ONE text (a delivered behaviour, a cognition
 * intent, or any host-visible string).
 */
export function classifyTruthConflation(text: string): ConflationResult {
  const hits: ConflationFinding[] = [];
  for (const sentence of splitSentences(text)) {
    const lower = sentence.toLowerCase();
    for (const marker of CERTAINTY_MARKERS) {
      let searchFrom = 0;
      for (;;) {
        const index = lower.indexOf(marker, searchFrom);
        if (index < 0) break;
        searchFrom = index + marker.length;
        const windowText = negationWindowBefore(sentence, index);
        const negated = NEGATION_CUES.some((cue) => windowText.includes(cue));
        if (!negated) {
          hits.push({ sentence, marker, negated: false });
        }
      }
    }
  }
  return {
    conflation: hits.length > 0,
    hits,
    classifier_id: "NEGATION_AWARE_CERTAINTY_ASSERTION_V1"
  };
}

export const CONFLATION_POSITIVE_CASES: readonly string[] = Object.freeze([
  "It is guaranteed true.",
  "The credence means it is definitely true.",
  "This is a known fact and must be true.",
  "The credence of 0.65 means there is a 65% objective probability that the passage is usable."
]);

export const CONFLATION_NEGATIVE_CASES: readonly string[] = Object.freeze([
  "It is not guaranteed.",
  "Do not treat it as a confirmed fact.",
  "Credence is subjective, not objective probability.",
  "That is my own read of the passage, and it is an uncertain one, not a confirmed fact, so do not treat it as a guarantee.",
  "I cannot promise the passage is open; the belief is only my endorsement.",
  "This is not certainly true."
]);
