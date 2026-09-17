/**
 * PERSISTENT_LIVING_SUBJECT_PRODUCT_EXPERIENCE_V0 — thin PRODUCT TRANSCRIPT.
 *
 * WHAT THIS IS: an append-only OPERATIONAL log of the human-visible conversation,
 * one row per turn, so a browser reload or a fresh process can show what was said
 * without inventing history. It stores only values the turn already exposed to the
 * product surface (user text, delivered text, status, prior-outcome refs,
 * revisions) — never prompts, never provider internals, never credentials.
 *
 * WHAT THIS IS NOT: it is NOT canonical state, NOT Memory, NOT an identity or
 * authority of any kind. SubjectState, Memory and the delivery/ingress ledgers
 * remain the only authorities; a missing, truncated or foreign transcript row can
 * therefore never change what the subject knows or is. Every durable fact the UI
 * shows for state/evolution comes from the runtime reads; this file only carries
 * the conversation VIEW.
 *
 * The row schema is the one the CLI already appends
 * (`interactive-subject-operational-turn-v0`), so both entry points share ONE
 * operational-log format instead of two.
 */

import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const PRODUCT_TURN_TRANSCRIPT_SCHEMA_VERSION = "interactive-subject-operational-turn-v0" as const;
export const PRODUCT_TURN_TRANSCRIPT_DEFAULT_LIMIT = 50 as const;
export const PRODUCT_TURN_TRANSCRIPT_MAX_LIMIT = 500 as const;

/** The turn fields the transcript records (the product-visible subset). */
export interface ProductTurnTranscriptInputV0 {
  readonly session_id: string;
  readonly subject_id: string;
  readonly turn_index: number;
  readonly status: "COMPLETE" | "FAILED" | "DEGRADED";
  readonly user_text: string;
  readonly subject_text: string;
  readonly directive: string | null;
  readonly current_intent: string | null;
  readonly delivery_id: string | null;
  readonly completed_prior_outcome: unknown;
  readonly observational_experience_ref: string | null;
  readonly failure: string | null;
  readonly repository_revision_before: string;
  readonly repository_revision_after: string;
  readonly state_revision_before: number;
  readonly state_revision_after: number;
}

export interface ProductTurnTranscriptRowV0 {
  readonly schema_version: typeof PRODUCT_TURN_TRANSCRIPT_SCHEMA_VERSION;
  readonly at: string;
  readonly session_id: string;
  readonly subject_id: string;
  readonly turn_index: number;
  readonly status: "COMPLETE" | "FAILED" | "DEGRADED";
  readonly user_text: string;
  readonly subject_text: string;
  readonly directive: string | null;
  readonly current_intent: string | null;
  readonly delivery_id: string | null;
  readonly completed_prior_outcome: unknown;
  readonly observational_experience_ref: string | null;
  readonly failure: string | null;
  readonly repository_revision_before: string;
  readonly repository_revision_after: string;
  readonly state_revision_before: number;
  readonly state_revision_after: number;
}

/** Deterministic transcript path for one subject inside a data root. */
export function productTurnTranscriptPathV0(dataRoot: string, subjectId: string): string {
  return join(dataRoot, `subject-${subjectId}.interactions.jsonl`);
}

/**
 * Appends ONE turn row. Idempotent per (subject, turn_index): a replayed turn never
 * appends a second row, so a redelivered HTTP request cannot duplicate history.
 */
export function appendProductTurnTranscriptV0(input: {
  readonly transcript_path: string;
  readonly row: ProductTurnTranscriptInputV0;
  readonly now: string;
}): void {
  const existing = readProductTurnTranscriptV0({ transcript_path: input.transcript_path, limit: PRODUCT_TURN_TRANSCRIPT_MAX_LIMIT });
  if (existing.some((row) => row.turn_index === input.row.turn_index && row.status === input.row.status)) return;
  const row: ProductTurnTranscriptRowV0 = {
    schema_version: PRODUCT_TURN_TRANSCRIPT_SCHEMA_VERSION,
    at: input.now,
    ...input.row
  };
  appendFileSync(input.transcript_path, `${JSON.stringify(row)}\n`, "utf8");
}

/** Bounded, oldest-first read of the human-visible conversation. */
export function readProductTurnTranscriptV0(input: {
  readonly transcript_path: string;
  readonly limit?: number;
}): readonly ProductTurnTranscriptRowV0[] {
  if (!existsSync(input.transcript_path)) return [];
  const requested = input.limit ?? PRODUCT_TURN_TRANSCRIPT_DEFAULT_LIMIT;
  const limit = Math.max(1, Math.min(PRODUCT_TURN_TRANSCRIPT_MAX_LIMIT, Number.isSafeInteger(requested) ? requested : PRODUCT_TURN_TRANSCRIPT_DEFAULT_LIMIT));
  const rows: ProductTurnTranscriptRowV0[] = [];
  for (const line of readFileSync(input.transcript_path, "utf8").split("\n")) {
    if (line.trim().length === 0) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line) as unknown;
    } catch {
      // A corrupt row is SKIPPED, never repaired and never fatal: the transcript is
      // a view, and the durable subject state is unaffected by its damage.
      continue;
    }
    if (
      parsed !== null &&
      typeof parsed === "object" &&
      (parsed as { schema_version?: unknown }).schema_version === PRODUCT_TURN_TRANSCRIPT_SCHEMA_VERSION &&
      typeof (parsed as { turn_index?: unknown }).turn_index === "number"
    ) {
      rows.push(parsed as ProductTurnTranscriptRowV0);
    }
  }
  rows.sort((left, right) => left.turn_index - right.turn_index);
  return Object.freeze(rows.slice(Math.max(0, rows.length - limit)));
}
