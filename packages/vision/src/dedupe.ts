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

interface DedupeEntryV0 {
  readonly key: string;
  readonly tokens: ReadonlySet<string>;
}

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
  inspect(key: string, tokens: ReadonlySet<string>): DedupeDecisionV0 {
    let best = 0;
    for (const entry of this.entries) {
      if (entry.key === key) return { duplicate: true, exact: true, similarity: 1 };
      best = Math.max(best, observationSimilarityV0(tokens, entry.tokens));
    }
    const near = best >= this.nearDuplicateThreshold;
    return { duplicate: near, exact: false, similarity: Math.round(best * 100) / 100 };
  }

  /** Remembers an observation once it has been delivered to the sink. */
  record(key: string, tokens: ReadonlySet<string>): void {
    this.entries.push({ key, tokens });
    while (this.entries.length > this.size) this.entries.shift();
  }

  reset(): void {
    this.entries.length = 0;
  }
}
