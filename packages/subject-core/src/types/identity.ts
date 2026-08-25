/**
 * P2.1.1 — Transition identity durability types (§14), types-only.
 * Source: docs/implementation/p2-1-contract-freeze.md §14.
 */

import type {
  HashV1,
  HistorySequenceV0,
  IdentifierV0,
  LogicalTimeV0,
  StateRevisionV0,
  TransitionIdV0
} from "./scalars.js";
import type { CanonicalRefV0 } from "./ref.js";
import type { ErrorCode, RequirementId, TransitionType } from "./enums.js";

/** §14.1 reservation outcome discriminator. */
export type ReservationRoute =
  | "NEW_RESERVED"
  | "SAME_OPEN_OR_RETRY"
  | "SAME_TERMINAL_COMMITTED"
  | "SAME_TERMINAL_NO_OP"
  | "REUSE_CONFLICT_PENDING";

/** §14.1 ReservedTransitionContinuationV1 — trusted, noncanonical invocation capability. */
export interface ReservedTransitionContinuationV1 {
  readonly schema_version: "reserved-transition-continuation-v1";
  readonly transition_id: TransitionIdV0;
  readonly subject_id: IdentifierV0;
  readonly transition_type: TransitionType;
  readonly proposal_ref: CanonicalRefV0;
  readonly payload_fingerprint: HashV1;
  readonly identity_record_version_observed: number;
  readonly route: "NEW_RESERVED" | "SAME_OPEN_OR_RETRY";
}

/** §14.2 AuthoritativeTransitionRecordV1. */
export interface AuthoritativeTransitionRecordV1 {
  readonly schema_version: "transition-record-v1";
  readonly record_version: number;
  readonly transition_id: TransitionIdV0;
  readonly subject_id: IdentifierV0;
  readonly transition_type: TransitionType;
  readonly proposal_ref: CanonicalRefV0;
  readonly payload_fingerprint: HashV1;
  readonly fingerprint_version: "proposal-fingerprint-v1";
  readonly first_seen_sequence: HistorySequenceV0;
  readonly attempts: readonly TransitionAttemptV1[];
  readonly reuse_conflicts: readonly TransitionReuseConflictV1[];
  readonly terminal_status: "COMMITTED" | "NO_OP" | null;
  readonly terminal_result_ref: CanonicalRefV0 | null;
}

/** §14.3 TransitionAttemptV1. */
export interface TransitionAttemptV1 {
  readonly attempt_sequence: number;
  readonly status: "REJECTED" | "ABORTED" | "NO_OP" | "COMMITTED";
  readonly revision_before: StateRevisionV0;
  readonly revision_after: StateRevisionV0;
  readonly state_hash_before: HashV1;
  readonly state_hash_after: HashV1;
  readonly result_ref: CanonicalRefV0;
  readonly prepared_result_ref: CanonicalRefV0;
  readonly trace_ref: CanonicalRefV0 | null;
  readonly audit_ref: CanonicalRefV0 | null;
  readonly error_code: ErrorCode | null;
  readonly reason: RequirementId | null;
}

/** §14.3 TransitionReuseConflictV1. */
export interface TransitionReuseConflictV1 {
  readonly conflict_sequence: number;
  readonly attempted_subject_id: IdentifierV0;
  readonly attempted_transition_type: TransitionType;
  readonly attempted_proposal_ref: CanonicalRefV0;
  readonly attempted_payload_fingerprint: HashV1;
  readonly revision_before: StateRevisionV0;
  readonly logical_time_before: LogicalTimeV0;
  readonly state_hash_before: HashV1;
  readonly snapshot_hash_before: HashV1;
  readonly error_code: "TRANSITION_ID_REUSE";
  readonly reason: "IDEM-REUSE-001";
  readonly audit_ref: CanonicalRefV0;
  readonly result_ref: CanonicalRefV0;
}

/** §14.3 AuditEventV1 — rejected/aborted/reuse-conflict durable audit record. */
export interface AuditEventV1 {
  readonly schema_version: "audit-event-v1";
  readonly audit_ref: CanonicalRefV0;
  readonly subject_id: IdentifierV0;
  readonly transition_id: TransitionIdV0;
  readonly payload_fingerprint: HashV1;
  readonly attempt_sequence: number;
  readonly status: "REJECTED" | "ABORTED" | "REUSE_CONFLICT";
  readonly error_code: ErrorCode;
  readonly reason: RequirementId;
  readonly revision_before: StateRevisionV0;
  readonly state_hash_before: HashV1;
}
