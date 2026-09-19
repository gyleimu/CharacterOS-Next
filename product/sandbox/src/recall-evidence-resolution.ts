/**
 * RECALL_EVIDENCE_SELECTOR_PRODUCT_AUTHORITY_V0 — product integration.
 *
 * Wraps the cognition provider at the product/session layer. When the recall
 * selector authority is enabled AND the turn is a recall-shaped question, the
 * host:
 *
 *   1. deterministically extracts the closed candidate set from the evidence the
 *      projection already carries (§5/§6);
 *   2. makes ONE tiny isolated selector call whose only lawful output is a
 *      candidate handle or ABSTAIN (§8/§10);
 *   3. on a valid selection, builds the SOURCE_QUOTE claim from the SELECTED
 *      CANDIDATE'S VERBATIM TEXT and authorizes it through the frozen
 *      `authorizeFactualClaimV1` (§18/§19);
 *   4. hands the resulting V8 proposal to the EXISTING provider parse, so the
 *      realization and language validation that follow are unchanged (§20/§21).
 *
 * Anything else — ABSTAIN, an invalid selector output, a transport failure, an
 * authorization rejection, or a non-recall turn — yields null and the normal
 * cognition path runs unchanged (§9/§19).
 *
 * The model NEVER authors factual text: every factual character in the delivered
 * claim comes from the candidate span, which is itself a verbatim substring of the
 * already-authorized recorded evidence (§22).
 */

import type { ModelTransportV0 } from "@characteros-next/runtime";

import { extractRecallQueryV0 } from "./direct-recall-resolution.js";
import {
  buildRecallCandidateSetV0,
  type RecallCandidateSetV0,
  type RecallProjectionViewV0
} from "./recall-evidence-candidates.js";
import {
  buildSelectorProposalV0,
  parseRecallSelectorOutputV0,
  requestRecallSelectionV0
} from "./recall-evidence-selector-authority.js";

/**
 * RECALL-SHAPED TURN LAW (precision-first).
 *
 * The selector is only asked on turns that are plausibly asking the subject to
 * recall something. This is deliberately a WIDE pre-filter, not a relevance
 * judgement: it decides only whether spending one selection call is warranted.
 * The precision decision itself belongs entirely to the selector (which may
 * always answer ABSTAIN), and the legality decision remains the frozen authority's.
 *
 * A turn qualifies when the unwrapped user text ends with '?' and contains a
 * recall interrogative. Statements, greetings and non-questions never qualify.
 */
const RECALL_INTERROGATIVES_V0 = Object.freeze(["where", "what", "which", "who", "when", "how"]);

export function isRecallShapedTurnV0(query: string): boolean {
  const lower = query.toLowerCase();
  if (!query.trimEnd().endsWith("?")) return false;
  return RECALL_INTERROGATIVES_V0.some((word) => new RegExp(`\\b${word}\\b`).test(lower));
}

/** Non-canonical, process-local accounting of selector activity (observability only). */
export interface RecallSelectorAccountingV0 {
  readonly calls: number;
  readonly selections: number;
  readonly abstains: number;
  readonly transport_failures: number;
  readonly authorization_rejections: number;
  readonly skipped_not_recall_shaped: number;
  readonly skipped_no_candidates: number;
  readonly last_selection_handle: string | null;
  readonly last_selection_text: string | null;
  readonly last_abstain_reason: string | null;
  readonly last_latency_ms: number | null;
  readonly last_input_bytes: number | null;
  readonly last_candidate_count: number | null;
}

export interface RecallSelectorAuthorityV0 {
  /**
   * Resolves ONE turn. Returns the host-constructed V8 proposal when a selection
   * was made and authorized, or null to fall back to normal cognition.
   */
  readonly resolve: (projection: unknown) => Promise<Record<string, unknown> | null>;
  readonly accounting: () => RecallSelectorAccountingV0;
}

export interface CreateRecallSelectorAuthorityOptionsV0 {
  readonly transport: ModelTransportV0;
  /** Monotonic clock override for deterministic tests. */
  readonly now?: (() => number) | undefined;
  /** Optional observer for operator visibility (never canonical state). */
  readonly onEvent?: ((event: RecallSelectorEventV0) => void) | undefined;
}

/** Bounded, prompt-free operator event. Never carries candidate text. */
export interface RecallSelectorEventV0 {
  readonly kind: "SELECTED" | "ABSTAINED" | "TRANSPORT_FAILED" | "AUTHORIZATION_REJECTED" | "SKIPPED";
  readonly reason: string;
  readonly candidate_count: number;
  readonly latency_ms: number | null;
  readonly handle: string | null;
}

/**
 * Builds the recall selector authority. Read-only with respect to the subject:
 * it never writes belief, affect, relationship, memory or an episode (§26).
 */
export function createRecallSelectorAuthorityV0(
  options: CreateRecallSelectorAuthorityOptionsV0
): RecallSelectorAuthorityV0 {
  let calls = 0;
  let selections = 0;
  let abstains = 0;
  let transportFailures = 0;
  let authorizationRejections = 0;
  let skippedNotRecallShaped = 0;
  let skippedNoCandidates = 0;
  let lastSelectionHandle: string | null = null;
  let lastSelectionText: string | null = null;
  let lastAbstainReason: string | null = null;
  let lastLatencyMs: number | null = null;
  let lastInputBytes: number | null = null;
  let lastCandidateCount: number | null = null;

  const emit = (event: RecallSelectorEventV0): void => {
    try {
      options.onEvent?.(event);
    } catch {
      // Observability must never break a turn.
    }
  };

  return {
    async resolve(projection: unknown): Promise<Record<string, unknown> | null> {
      const view = projection as RecallProjectionViewV0 | null | undefined;
      const query = extractRecallQueryV0(projection);
      const candidateSet: RecallCandidateSetV0 = buildRecallCandidateSetV0(view ?? {});
      lastCandidateCount = candidateSet.candidates.length;

      if (!isRecallShapedTurnV0(query)) {
        skippedNotRecallShaped += 1;
        emit({ kind: "SKIPPED", reason: "not a recall-shaped question", candidate_count: candidateSet.candidates.length, latency_ms: null, handle: null });
        return null;
      }
      if (candidateSet.candidates.length === 0) {
        skippedNoCandidates += 1;
        lastAbstainReason = "no lawful candidates";
        emit({ kind: "SKIPPED", reason: "no lawful candidates", candidate_count: 0, latency_ms: null, handle: null });
        return null;
      }

      const requested = await requestRecallSelectionV0({
        transport: options.transport,
        query,
        candidateSet,
        ...(options.now === undefined ? {} : { now: options.now })
      });
      if (!requested.ok) {
        transportFailures += 1;
        lastAbstainReason = `selector transport failed: ${requested.detail}`;
        emit({ kind: "TRANSPORT_FAILED", reason: requested.detail, candidate_count: candidateSet.candidates.length, latency_ms: null, handle: null });
        return null;
      }
      calls += 1;
      lastLatencyMs = requested.outcome.latency_ms;
      lastInputBytes = candidateSet.candidates.reduce((total, candidate) => total + candidate.text.length, 0) + query.length;

      const outcome = parseRecallSelectorOutputV0(requested.outcome.content, candidateSet);
      if (outcome.kind === "ABSTAIN") {
        abstains += 1;
        lastAbstainReason = outcome.reason;
        lastSelectionHandle = null;
        lastSelectionText = null;
        emit({ kind: "ABSTAINED", reason: outcome.reason, candidate_count: candidateSet.candidates.length, latency_ms: requested.outcome.latency_ms, handle: null });
        return null;
      }

      const built = buildSelectorProposalV0({ candidate: outcome.candidate, projection: view });
      if (built === null) {
        authorizationRejections += 1;
        lastAbstainReason = "selected evidence failed frozen authorization";
        lastSelectionHandle = null;
        lastSelectionText = null;
        emit({ kind: "AUTHORIZATION_REJECTED", reason: lastAbstainReason, candidate_count: candidateSet.candidates.length, latency_ms: requested.outcome.latency_ms, handle: outcome.candidate.handle });
        return null;
      }

      selections += 1;
      lastSelectionHandle = outcome.candidate.handle;
      lastSelectionText = outcome.candidate.text;
      lastAbstainReason = null;
      emit({ kind: "SELECTED", reason: "selection authorized", candidate_count: candidateSet.candidates.length, latency_ms: requested.outcome.latency_ms, handle: outcome.candidate.handle });
      return built.proposal;
    },
    accounting(): RecallSelectorAccountingV0 {
      return {
        calls,
        selections,
        abstains,
        transport_failures: transportFailures,
        authorization_rejections: authorizationRejections,
        skipped_not_recall_shaped: skippedNotRecallShaped,
        skipped_no_candidates: skippedNoCandidates,
        last_selection_handle: lastSelectionHandle,
        last_selection_text: lastSelectionText,
        last_abstain_reason: lastAbstainReason,
        last_latency_ms: lastLatencyMs,
        last_input_bytes: lastInputBytes,
        last_candidate_count: lastCandidateCount
      };
    }
  };
}
