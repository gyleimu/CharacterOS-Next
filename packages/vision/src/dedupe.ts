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

export class ObservationDedupeRingV0 {
  private readonly keys: string[] = [];

  constructor(private readonly size: number) {
    if (!Number.isSafeInteger(size) || size < 1) throw new Error("dedupe ring size must be a positive integer");
  }

  /** Reports whether the key is inside the current window (no side effect). */
  contains(key: string): boolean {
    return this.keys.includes(key);
  }

  /** Remembers a key once it has been delivered to the sink. */
  record(key: string): void {
    this.keys.push(key);
    while (this.keys.length > this.size) this.keys.shift();
  }

  /** Records the key and reports whether it was already inside the window. */
  isDuplicateAndRecord(key: string): boolean {
    const duplicate = this.contains(key);
    this.record(key);
    return duplicate;
  }

  reset(): void {
    this.keys.length = 0;
  }
}
