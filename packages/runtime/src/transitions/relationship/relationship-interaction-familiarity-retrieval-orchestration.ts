/**
 * Interaction Familiarity Retrieval Orchestration V0 — LAYER B
 * (RELATIONSHIP_FAMILIARY_RETRIEVAL_ORCHESTRATION_V0, deterministic,
 * ZERO model calls).
 *
 * Makes the frozen cognition strategy COUNTERPART_CONTEXT_SEARCH_FIRST actually
 * trigger EXACTLY ONE exact-counterpart memory retrieval attempt through the
 * EXISTING CharacterOS Memory retrieval machinery:
 *
 *   real lived history
 *   → persistent familiarity
 *   → frozen familiarity read projection
 *   → frozen cognition influence
 *   → context-resolution strategy          (the ONLY trigger source)
 *   → exact-counterpart retrieval orchestration   (THIS module)
 *   → validated retrieved evidence          (existing Memory validation law)
 *
 * TRIGGER LAW (§4): the trigger source is the frozen cognition influence
 * artifact ALONE. This module never inspects a raw familiarity scalar, an
 * ordinal level, the threshold 2, or Relationship dimensions — duplicated
 * policy logic is structurally impossible here. BASIC_CONTEXT_FIRST (or no
 * influence) requests NO familiarity-priority retrieval; it does NOT disable
 * any existing normal Memory retrieval.
 *
 * ONE-ATTEMPT LAW (§6): for each triggering influence exactly ONE attempt is
 * made, in the already-sorted influence order — no unbounded loop, no
 * retry-until-found, no broad search expansion, no query against unrelated
 * counterparts. The bound is per context-resolution cycle, not permanent
 * history; identical recomputation under identical canonical inputs remains
 * deterministic (§23).
 *
 * QUERY OWNERSHIP (§7/§8): the HOST owns query construction — the exact
 * canonical counterpart ref is bound as semantic_reference and sole
 * entity_ref, with the current repository revision, logical time and
 * context refs following the existing observation retrieval conventions.
 * No fabricated relationship: refs, no aliases, no fuzzy matching, and the
 * Memory retrieval algorithm/scoring itself is untouched: familiarity changes
 * WHETHER this exact query is prioritized, never HOW retrieval ranks.
 *
 * RESULT LAW (§10/§11/§12/§13/§14): every result passes the EXISTING
 * validateMemoryRetrievalResult trust boundary (fingerprint recomputation,
 * subject ownership, repository revision) before any interpretation. A valid
 * empty result is a SUCCESSFUL orchestration outcome (no usable counterpart
 * evidence found) — never invented context, never an automatic broadened
 * search, never a familiarity mutation. Irrelevant candidates that existing
 * selection does not surface are equivalent to no usable context. A technical
 * retrieval failure is marked RETRIEVAL_FAILED — it is NEVER silently
 * represented as "no memory exists".
 *
 * EVIDENCE BOUNDARY: familiarity remains STATE_VISIBLE_NOT_CITEABLE; no
 * familiarity receipt ref and no writer-authority ref becomes factual
 * evidence. Only existing validated/selected Memory evidence may enter
 * factual cognition context. The trace artifact below is an OBSERVATION for
 * causality proofs — not an authority, not persisted canonical state.
 *
 * INTEGRATION POINT: this orchestrator consumes the existing
 * MemoryRetrievalService port and the existing validateMemoryRetrievalResult
 * law — the ONE canonical retrieval pipeline the ObservationTransitionExecutor
 * already uses. No second retrieval engine, no new scoring, no new schema.
 */

import type { CanonicalRefV0, SubjectStateV0 } from "@characteros-next/subject-core";
import type {
  MemoryRetrievalQueryV0,
  MemoryRetrievalService
} from "@characteros-next/memory";
import { validateMemoryRetrievalResult } from "@characteros-next/memory";

import type { RelationshipInteractionFamiliarityCognitionInfluenceV0 } from "./relationship-interaction-familiarity-cognition-influence.js";

export const RELATIONSHIP_FAMILIARITY_RETRIEVAL_ORCHESTRATION_SCHEMA_VERSION_V0 =
  "relationship-familiarity-retrieval-orchestration-v0" as const;

/** Minimal closed outcome vocabulary (§14). No dozens of statuses. */
export const INTERACTION_FAMILIARITY_RETRIEVAL_OUTCOMES_V0 = Object.freeze([
  "NO_PRIORITY_REQUESTED",
  "ATTEMPTED_EMPTY",
  "ATTEMPTED_WITH_USABLE_EVIDENCE",
  "RETRIEVAL_FAILED"
] as const);

export type InteractionFamiliarityRetrievalOutcomeV0 =
  (typeof INTERACTION_FAMILIARITY_RETRIEVAL_OUTCOMES_V0)[number];

/** One deterministic per-counterpart attempt trace (observation, not authority). */
export interface InteractionFamiliarityRetrievalAttemptTraceV0 {
  readonly counterpart_ref: CanonicalRefV0;
  /** The frozen strategy that triggered this attempt (always SEARCH_FIRST here). */
  readonly triggering_strategy: "COUNTERPART_CONTEXT_SEARCH_FIRST";
  readonly outcome: InteractionFamiliarityRetrievalOutcomeV0;
  /** Fingerprint of the exact executed query, where the existing contract exposes it. */
  readonly query_fingerprint: string | null;
  /** Validated selected episode refs (empty unless the existing selection surfaced them). */
  readonly selected_memory_refs: readonly CanonicalRefV0[];
  readonly candidate_count: number;
}

/** Deterministic orchestration trace for one context-resolution cycle. */
export interface InteractionFamiliarityRetrievalOrchestrationV0 {
  readonly schema_version: typeof RELATIONSHIP_FAMILIARITY_RETRIEVAL_ORCHESTRATION_SCHEMA_VERSION_V0;
  readonly attempts: readonly InteractionFamiliarityRetrievalAttemptTraceV0[];
  /** BASIC_CONTEXT_FIRST / no-influence counterparts that requested nothing. */
  readonly no_priority_request_count: number;
  readonly attempted_count: number;
  readonly attempted_with_usable_evidence_count: number;
  readonly attempted_empty_count: number;
  readonly retrieval_failed_count: number;
}

/**
 * HOST-owned deterministic query construction for one exact counterpart,
 * following the existing observation retrieval conventions exactly: the
 * counterpart is bound as semantic_reference AND sole entity_ref; revision,
 * logical time and context refs come from the canonical snapshot. Contains NO
 * familiarity/threshold logic — the strategy decision lives in the frozen
 * influence, not here.
 */
export function buildInteractionFamiliarityCounterpartQueryV0(
  snapshot: SubjectStateV0,
  counterpartRef: CanonicalRefV0
): MemoryRetrievalQueryV0 {
  const merged = [...snapshot.context.focus_refs, ...snapshot.context.environment_refs].sort();
  const uniqueMerged = merged.filter((ref, index) => index === 0 || merged[index - 1] !== ref);
  return {
    schema_version: "memory-retrieval-query-v0",
    subject_id: snapshot.identity.subject_id,
    repository_revision: snapshot.memory_state.repository_revision,
    semantic_reference: counterpartRef,
    temporal: {
      now_logical_time: snapshot.runtime_metadata.logical_time,
      window_start: null
    },
    entity_refs: [counterpartRef],
    relationship_refs: [],
    current_context_refs: uniqueMerged,
    salience_constraints: { min_declared_score: null, max_candidates: 16 }
  } as unknown as MemoryRetrievalQueryV0;
}

/**
 * LAYER B: orchestrates at most ONE exact-counterpart familiarity-priority
 * retrieval attempt per triggering influence, through the EXISTING retrieval
 * service and validation law. Deterministic; zero model calls; no retry loops;
 * no familiarity mutation; no context invention.
 */
export async function orchestrateInteractionFamiliarityRetrievalV0(input: {
  /** The frozen cognition influence artifacts (already sorted by the projection). */
  readonly influences: readonly RelationshipInteractionFamiliarityCognitionInfluenceV0[];
  /** The existing canonical Memory retrieval service (the ONE pipeline). */
  readonly retrieval: MemoryRetrievalService;
  /** HOST-owned query construction bound to the exact counterpart. */
  readonly buildCounterpartQuery: (counterpartRef: CanonicalRefV0) => MemoryRetrievalQueryV0;
}): Promise<InteractionFamiliarityRetrievalOrchestrationV0> {
  const attempts: InteractionFamiliarityRetrievalAttemptTraceV0[] = [];
  let noPriorityRequestCount = 0;

  for (const influence of input.influences) {
    // Trigger law: the frozen influence artifact is the ONLY trigger source.
    if (influence.context_resolution_strategy !== "COUNTERPART_CONTEXT_SEARCH_FIRST") {
      noPriorityRequestCount += 1;
      continue;
    }
    const query = input.buildCounterpartQuery(influence.counterpart_ref);
    try {
      const raw = await input.retrieval.retrieve(query);
      // Existing Memory trust boundary: full result validation including
      // fingerprint recomputation against the EXACT query, subject ownership
      // and repository revision binding. No result is trusted merely because
      // familiarity caused the retrieval.
      const checked = await validateMemoryRetrievalResult(raw as unknown, query);
      if (!checked.ok) {
        attempts.push({
          counterpart_ref: influence.counterpart_ref,
          triggering_strategy: "COUNTERPART_CONTEXT_SEARCH_FIRST",
          outcome: "RETRIEVAL_FAILED",
          query_fingerprint: null,
          selected_memory_refs: [],
          candidate_count: 0
        });
        continue;
      }
      const result = checked.value;
      if (result.subject_id !== query.subject_id) {
        attempts.push({
          counterpart_ref: influence.counterpart_ref,
          triggering_strategy: "COUNTERPART_CONTEXT_SEARCH_FIRST",
          outcome: "RETRIEVAL_FAILED",
          query_fingerprint: null,
          selected_memory_refs: [],
          candidate_count: 0
        });
        continue;
      }
      if (result.deterministic_metadata.repository_revision !== query.repository_revision) {
        attempts.push({
          counterpart_ref: influence.counterpart_ref,
          triggering_strategy: "COUNTERPART_CONTEXT_SEARCH_FIRST",
          outcome: "RETRIEVAL_FAILED",
          query_fingerprint: null,
          selected_memory_refs: [],
          candidate_count: 0
        });
        continue;
      }
      // Empty is a SUCCESSFUL orchestration outcome (§12): no usable counterpart
      // evidence was found — nothing is invented, broadened or mutated.
      attempts.push({
        counterpart_ref: influence.counterpart_ref,
        triggering_strategy: "COUNTERPART_CONTEXT_SEARCH_FIRST",
        outcome:
          result.selected_memory_refs.length > 0
            ? "ATTEMPTED_WITH_USABLE_EVIDENCE"
            : "ATTEMPTED_EMPTY",
        query_fingerprint: result.deterministic_metadata.query_fingerprint,
        selected_memory_refs: result.selected_memory_refs as readonly CanonicalRefV0[],
        candidate_count: result.deterministic_metadata.candidate_count
      });
    } catch {
      // §14: a technical failure is NEVER silently represented as
      // "no memory exists" — it is marked RETRIEVAL_FAILED.
      attempts.push({
        counterpart_ref: influence.counterpart_ref,
        triggering_strategy: "COUNTERPART_CONTEXT_SEARCH_FIRST",
        outcome: "RETRIEVAL_FAILED",
        query_fingerprint: null,
        selected_memory_refs: [],
        candidate_count: 0
      });
    }
  }

  const orchestration: InteractionFamiliarityRetrievalOrchestrationV0 = {
    schema_version: RELATIONSHIP_FAMILIARITY_RETRIEVAL_ORCHESTRATION_SCHEMA_VERSION_V0,
    attempts,
    no_priority_request_count: noPriorityRequestCount,
    attempted_count: attempts.length,
    attempted_with_usable_evidence_count: attempts.filter(
      (attempt) => attempt.outcome === "ATTEMPTED_WITH_USABLE_EVIDENCE"
    ).length,
    attempted_empty_count: attempts.filter((attempt) => attempt.outcome === "ATTEMPTED_EMPTY")
      .length,
    retrieval_failed_count: attempts.filter((attempt) => attempt.outcome === "RETRIEVAL_FAILED")
      .length
  };
  deepFreeze(orchestration);
  return orchestration;
}

function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  if (Object.isFrozen(value)) return;
  Object.freeze(value);
  for (const key of Object.keys(value as Record<string, unknown>)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
}
