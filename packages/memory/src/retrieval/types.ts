/**
 * P2.2.3 — Memory Retrieval Contract types (types-only; NO algorithm).
 * Source: docs/implementation/p2-1-contract-freeze.md §16 (actor chain),
 * §5.3 (ref kinds), plan §3.3 (MEM-RET-* oracles: exact refs/order/scores/evidence,
 * candidate_count nonnegative safe integer, normalized UnitIntervalV0 reasons).
 *
 * ARCHITECTURE — Repository ≠ Retrieval:
 * - MemoryRepository stores and validates immutable revisions (P2.2.1/P2.2.2).
 * - MemoryRetrievalService PROPOSES candidate episodes against exactly one immutable
 *   repository revision. The two concerns never mix: the service consumes a repository
 *   through injected capabilities at composition time and exposes no mutation surface.
 * - This module defines shapes, dimension vocabulary and a deterministic query
 *   fingerprint ONLY. Scoring/ordering algorithms belong to a later phase.
 */

import type {
  Brand,
  CanonicalRefV0,
  HashV1,
  IdentifierV0,
  LogicalTimeV0,
  RepositoryRevisionIdV0,
  UnitIntervalV0
} from "@characteros-next/subject-core";
import { hashEnvelope } from "@characteros-next/subject-core";

export const MEMORY_RETRIEVAL_QUERY_SCHEMA_VERSION = "memory-retrieval-query-v0" as const;
export const MEMORY_RETRIEVAL_RESULT_SCHEMA_VERSION = "memory-retrieval-result-v0" as const;

/** Config identity stamped into results so golden evidence pins its configuration. */
export const MEMORY_RETRIEVAL_CONFIG_V0 = "MEMORY_RETRIEVAL_V0" as const;

const QUERY_FINGERPRINT_PROJECTION = "characteros-next/memory/retrieval-query/v1";

/** Evidence dimensions (raw-ASCII-sorted in evidence entries). */
export const RETRIEVAL_REASON_DIMENSIONS = [
  "CONTEXT",
  "ENTITY",
  "RELATIONSHIP",
  "SALIENCE",
  "SEMANTIC",
  "TEMPORAL"
] as const;

export type RetrievalReasonDimension = (typeof RETRIEVAL_REASON_DIMENSIONS)[number];

/** Kind-branded episode pointer used in result selections. */
export type SelectedEpisodeRef = Brand<CanonicalRefV0, "EpisodeRef">;

/** Kind-branded retrieval-trace pointer for `recent_retrieval_trace` rings. */
export type RetrievalTraceRef = Brand<CanonicalRefV0, "RetrievalTraceRef">;

// ----------------------------------------------------------------------------------
// Query
// ----------------------------------------------------------------------------------

export interface RetrievalTemporalContextV0 {
  /** Canonical logical clock position of the query (never wall clock). */
  readonly now_logical_time: LogicalTimeV0;
  /** Inclusive lower bound of interest, or null for unbounded history. */
  readonly window_start: LogicalTimeV0 | null;
}

export interface RetrievalSalienceConstraintsV0 {
  /** Minimum declared salience score a candidate must carry, or null for no floor. */
  readonly min_declared_score: UnitIntervalV0 | null;
  /** Hard upper bound on candidates considered/returned; positive safe integer. */
  readonly max_candidates: number;
}

/**
 * Closed retrieval query. Every field is an INPUT to a later-phase deterministic
 * service; nothing here computes relevance.
 */
export interface MemoryRetrievalQueryV0 {
  readonly schema_version: typeof MEMORY_RETRIEVAL_QUERY_SCHEMA_VERSION;
  readonly subject_id: IdentifierV0;
  /** Queries are scoped to exactly ONE immutable repository revision. */
  readonly repository_revision: RepositoryRevisionIdV0;
  /** Semantic/context anchor (e.g. current observation/experience), or null. */
  readonly semantic_reference: CanonicalRefV0 | null;
  readonly temporal: RetrievalTemporalContextV0;
  /** Entity references relevant to the query; set-like: unique and sorted. */
  readonly entity_refs: readonly CanonicalRefV0[];
  /** Relationship references; set-like: unique and sorted, kind `relationship`. */
  readonly relationship_refs: readonly CanonicalRefV0[];
  /** Current working-context refs; set-like: unique and sorted. */
  readonly current_context_refs: readonly CanonicalRefV0[];
  readonly salience_constraints: RetrievalSalienceConstraintsV0;
}

/**
 * Deterministic fingerprint over the complete closed query (JCS envelope). Same query
 * bytes ⇒ same fingerprint; any input change ⇒ different fingerprint. Pure hash, not
 * part of any search algorithm.
 */
export function retrievalQueryFingerprint(query: MemoryRetrievalQueryV0): Promise<HashV1> {
  return hashEnvelope(QUERY_FINGERPRINT_PROJECTION, {
    schema_version: query.schema_version,
    subject_id: query.subject_id,
    repository_revision: query.repository_revision,
    semantic_reference: query.semantic_reference,
    temporal: query.temporal,
    entity_refs: query.entity_refs,
    relationship_refs: query.relationship_refs,
    current_context_refs: query.current_context_refs,
    salience_constraints: query.salience_constraints
  });
}

// ----------------------------------------------------------------------------------
// Evidence and result
// ----------------------------------------------------------------------------------

/** One normalized reason: dimension tag + declared-by-algorithm score in [0,1]. */
export interface RetrievalReasonV0 {
  readonly dimension: RetrievalReasonDimension;
  readonly score: UnitIntervalV0;
}

/**
 * Per-selection evidence. Entries are order-aligned with the result's selected refs;
 * reasons are unique by dimension and raw-ASCII-sorted.
 */
export interface RetrievalEvidenceV0 {
  readonly episode_ref: SelectedEpisodeRef;
  readonly reasons: readonly RetrievalReasonV0[];
}

export interface RetrievalDeterministicMetadataV0 {
  /** The single immutable revision results were computed against. */
  readonly repository_revision: RepositoryRevisionIdV0;
  /** Nonnegative safe integer: number of candidates the service examined. */
  readonly candidate_count: number;
  /** Frozen configuration identity for this computation. */
  readonly computed_under_config: typeof MEMORY_RETRIEVAL_CONFIG_V0;
  /** Fingerprint of the exact query these results answer. */
  readonly query_fingerprint: HashV1;
}

/**
 * Closed retrieval result: selected memory refs (ordered), aligned evidence and
 * deterministic metadata. A later-phase service produces it; nothing here does.
 */
export interface MemoryRetrievalResultV0 {
  readonly schema_version: typeof MEMORY_RETRIEVAL_RESULT_SCHEMA_VERSION;
  readonly subject_id: IdentifierV0;
  /** Ordered selected episode refs; unique; order is the service's deterministic order. */
  readonly selected_memory_refs: readonly SelectedEpisodeRef[];
  /** Exactly one evidence entry per selection, same order. */
  readonly evidence: readonly RetrievalEvidenceV0[];
  /** Pointer for `memory_state.recent_retrieval_trace`, or null when none produced. */
  readonly retrieval_trace_ref: RetrievalTraceRef | null;
  readonly deterministic_metadata: RetrievalDeterministicMetadataV0;
}
