/**
 * Lightweight deduplication.
 *
 * Change detection fires on pixels; the model then often describes an unchanged
 * situation in the same words. Emitting that again would spam CharacterOS with
 * repeat observations, so a normalized semantic key is compared against a small
 * per-source ring buffer (no embeddings, no similarity search).
 *
 * The key deliberately excludes `observation_id`, `timestamp` and `frame_ref`
 * (identity, not meaning) and excludes `uncertainty` (a certainty qualifier does
 * not turn the same claim into a new observation).
 */

import { createHash } from "node:crypto";
import type { VisualObservationV0 } from "./types.js";

/** Case-, punctuation- and whitespace-insensitive text, unicode aware. */
export function normalizeObservationTextV0(text: string): string {
  return text
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function normalizedListV0(values: readonly string[] | undefined): readonly string[] {
  return [...(values ?? [])].map(normalizeObservationTextV0).filter((entry) => entry.length > 0).sort();
}

export function observationDedupeKeyV0(observation: VisualObservationV0): string {
  const semantic = {
    source: observation.source,
    description: normalizeObservationTextV0(observation.description),
    application: observation.application === undefined ? null : normalizeObservationTextV0(observation.application),
    activities: normalizedListV0(observation.activities),
    visible_text: normalizedListV0(observation.visible_text),
    notable_events: normalizedListV0(observation.notable_events),
    entity_types: [...(observation.entities ?? [])].map((entity) => normalizeObservationTextV0(entity.type)).sort()
  };
  return createHash("sha256").update(JSON.stringify(semantic)).digest("hex");
}

/** Meaning-bearing tokens of a description, for near-duplicate comparison. */
export function observationTokensV0(text: string): ReadonlySet<string> {
  return new Set(normalizeObservationTextV0(text).split(" ").filter((token) => token.length > 0));
}

/** Jaccard similarity of two descriptions, 0..1. No embeddings involved. */
export function observationSimilarityV0(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const token of a) if (b.has(token)) shared += 1;
  return shared / (a.size + b.size - shared);
}

export interface DedupeDecisionV0 {
  readonly duplicate: boolean;
  readonly exact: boolean;
  readonly similarity: number;
}

/**
 * V-05: negation words. "A person is present" and "No person is present" are
 * 0.83 similar as token sets and mean the opposite, so an asymmetric negation
 * set vetoes near-duplicate matching (exact key equality still applies).
 */
export const NEGATION_TOKENS_V0: readonly string[] = ["no", "not", "without", "absent"];

export function negationTokensV0(tokens: ReadonlySet<string>): ReadonlySet<string> {
  return new Set(NEGATION_TOKENS_V0.filter((token) => tokens.has(token)));
}

export interface DedupeCandidateV0 {
  readonly key: string;
  readonly tokens: ReadonlySet<string>;
  /** Normalized `application`, or null. A different application is a new scene. */
  readonly application: string | null;
  readonly negations: ReadonlySet<string>;
}

/** Everything the ring needs to judge one observation, derived in one place. */
export function observationDedupeCandidateV0(input: {
  readonly key: string;
  readonly description: string;
  readonly application: string | null;
}): DedupeCandidateV0 {
  const tokens = observationTokensV0(input.description);
  return {
    key: input.key,
    tokens,
    application: input.application === null ? null : normalizeObservationTextV0(input.application),
    negations: negationTokensV0(tokens)
  };
}

function sameSetV0(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) return false;
  for (const entry of a) if (!b.has(entry)) return false;
  return true;
}

/**
 * Near-duplicate matching is only allowed when nothing structural contradicts it.
 * Both vetoes are deterministic and cheap; anything subtler (semantic negation,
 * entailment, embeddings) is deliberately NOT attempted.
 */
function nearDuplicateAllowedV0(entry: DedupeEntryV0, candidate: DedupeCandidateV0): boolean {
  if (entry.application !== candidate.application) return false;
  return sameSetV0(entry.negations, candidate.negations);
}

/** A remembered observation is exactly a candidate that was delivered. */
type DedupeEntryV0 = DedupeCandidateV0;

export class ObservationDedupeRingV0 {
  private readonly entries: DedupeEntryV0[] = [];

  constructor(
    private readonly size: number,
    /**
     * Exact keys catch a repeated description; near-duplicates catch a small
     * model restating the same scene in different words, which is what actually
     * happened in the acceptance runs (a wall with framed pictures described
     * four different ways). Measured example: 0.73 similarity for the same scene.
     */
    private readonly nearDuplicateThreshold = 0.7
  ) {
    if (!Number.isSafeInteger(size) || size < 1) throw new Error("dedupe ring size must be a positive integer");
  }

  /** Reports whether this observation was already emitted (no side effect). */
  inspect(candidate: DedupeCandidateV0): DedupeDecisionV0 {
    let best = 0;
    for (const entry of this.entries) {
      if (entry.key === candidate.key) return { duplicate: true, exact: true, similarity: 1 };
      if (!nearDuplicateAllowedV0(entry, candidate)) continue;
      best = Math.max(best, observationSimilarityV0(candidate.tokens, entry.tokens));
    }
    const near = best >= this.nearDuplicateThreshold;
    return { duplicate: near, exact: false, similarity: Math.round(best * 100) / 100 };
  }

  /** Remembers an observation once it has been delivered to the sink. */
  record(candidate: DedupeCandidateV0): void {
    this.entries.push(candidate);
    while (this.entries.length > this.size) this.entries.shift();
  }

  reset(): void {
    this.entries.length = 0;
  }
}
