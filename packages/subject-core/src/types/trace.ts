/**
 * P2.1.1 — Trace contract types (§10), types-only.
 * Source: docs/implementation/p2-1-contract-freeze.md §10.
 */

import type {
  HashV1,
  HistorySequenceV0,
  IdentifierV0,
  StateRevisionV0,
  TransitionIdV0,
  LogicalTimeV0,
  RepositoryRevisionIdV0
} from "./scalars.js";
import type { CanonicalRefV0 } from "./ref.js";
import type { DomainName, RequirementId, TransitionType } from "./enums.js";

/** §10.3 TraceCursorV1. Logical monotonic sequence, not a wall-clock or opaque pointer. */
export interface TraceCursorV1 {
  readonly last_history_sequence: HistorySequenceV0;
  readonly offloaded_through_sequence: HistorySequenceV0;
  readonly offloaded_through_trace_ref: CanonicalRefV0 | null;
}

/** §10.2 DomainMutationSummaryV1. */
export interface DomainMutationSummaryV1 {
  readonly producer: IdentifierV0;
  readonly domain: DomainName;
  readonly layers: readonly TraceLayerName[];
  readonly field_changes: readonly FieldChangeSummaryV1[];
}

export type TraceLayerName =
  | "mood"
  | "affect"
  | "regulation"
  | "context"
  | "memory_state"
  | "personality"
  | "relationships"
  | "beliefs";

export interface FieldChangeSummaryV1 {
  readonly path: string;
  readonly operation: "SET";
}

/** §10.2 TraceEntryV1 — all keys required; before/after hashes required (not optional). */
export interface TraceEntryV1 {
  readonly trace_schema_version: "trace-v1";
  readonly trace_id: CanonicalRefV0;
  readonly history_sequence: HistorySequenceV0;
  readonly transition_id: TransitionIdV0;
  readonly transition_type: TransitionType;
  readonly subject_id: IdentifierV0;
  readonly subject_revision_before: StateRevisionV0;
  readonly subject_revision_after: StateRevisionV0;
  readonly logical_time: LogicalTimeV0;
  readonly rule_ids: readonly RequirementId[];
  readonly cause_refs: readonly CanonicalRefV0[];
  readonly proposal_ref: CanonicalRefV0;
  readonly domain_mutations: readonly DomainMutationSummaryV1[];
  readonly state_hash_before: HashV1;
  readonly state_hash_after: HashV1;
  readonly memory_revision_before: RepositoryRevisionIdV0;
  readonly memory_revision_after: RepositoryRevisionIdV0;
  readonly outcome: "COMMITTED";
}

/** §10.3 TraceWindowV1 — capacity is the schema constant 64, not runtime config. */
export interface TraceWindowV1 {
  readonly trace_window_schema_version: "trace-window-v1";
  readonly capacity: 64;
  readonly cursor: TraceCursorV1;
  readonly entries: readonly TraceEntryV1[];
}
