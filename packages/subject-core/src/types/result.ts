/**
 * P2.1.1 — Result envelopes (§7.3–§7.6) and status/error wire types (§13), types-only.
 * Source: docs/implementation/p2-1-contract-freeze.md §7.3–§7.6 and §13.
 */

import type {
  HashV1,
  IdentifierV0,
  LogicalTimeV0,
  StateRevisionV0,
  TransitionIdV0
} from "./scalars.js";
import type { CanonicalRefV0 } from "./ref.js";
import type { ErrorCode, RequirementId, TransitionType } from "./enums.js";

/** §7.3 CanonicalCommitResultV1 — original committed result, all keys required. */
export interface CanonicalCommitResultV1 {
  readonly schema_version: "canonical-commit-result-v1";
  readonly status: "COMMITTED";
  readonly transition_id: TransitionIdV0;
  readonly subject_id: IdentifierV0;
  readonly payload_fingerprint: HashV1;
  readonly previous_revision: StateRevisionV0;
  readonly next_revision: StateRevisionV0;
  readonly state_hash_before: HashV1;
  readonly state_hash_after: HashV1;
  readonly snapshot_hash_after: HashV1;
  readonly trace_ref: CanonicalRefV0;
  readonly commit_ref: CanonicalRefV0;
  readonly result_ref: CanonicalRefV0;
}

/** §7.3 PublishObservationV1 — rebuildable, noncanonical publish projection. */
export interface PublishObservationV1 {
  readonly schema_version: "publish-observation-v1";
  readonly commit_ref: CanonicalRefV0;
  readonly status: "PENDING" | "PUBLISHED";
  readonly attempt_sequence: number;
}

/** §7.4 AlreadyCommittedResultV1 — derived response, never a second committed record. */
export interface AlreadyCommittedResultV1 {
  readonly schema_version: "already-committed-result-v1";
  readonly status: "ALREADY_COMMITTED";
  readonly transition_id: TransitionIdV0;
  readonly subject_id: IdentifierV0;
  readonly payload_fingerprint: HashV1;
  readonly previous_revision: StateRevisionV0;
  readonly next_revision: StateRevisionV0;
  readonly state_hash_before: HashV1;
  readonly state_hash_after: HashV1;
  readonly snapshot_hash_after: HashV1;
  readonly trace_ref: CanonicalRefV0;
  readonly commit_ref: CanonicalRefV0;
  readonly original_result_ref: CanonicalRefV0;
}

/** §7.4 NoOpTransitionResultV1 — durable terminal for Time elapsed=0 only. */
export interface NoOpTransitionResultV1 {
  readonly schema_version: "no-op-transition-result-v1";
  readonly status: "NO_OP";
  readonly transition_id: TransitionIdV0;
  readonly subject_id: IdentifierV0;
  readonly transition_type: "Time";
  readonly payload_fingerprint: HashV1;
  readonly previous_revision: StateRevisionV0;
  readonly next_revision: StateRevisionV0;
  readonly logical_time_before: LogicalTimeV0;
  readonly logical_time_after: LogicalTimeV0;
  readonly state_hash_before: HashV1;
  readonly state_hash_after: HashV1;
  readonly snapshot_hash_before: HashV1;
  readonly snapshot_hash_after: HashV1;
  readonly trace_ref: null;
  readonly prepared_result_ref: CanonicalRefV0;
  readonly result_ref: CanonicalRefV0;
  readonly reason: "TIME-NOOP-001";
}

/** §7.4 LearningRebaseRequiredResultV1 — runtime-owned, after core stale rejection + unsafe rebuild. */
export interface LearningRebaseRequiredResultV1 {
  readonly schema_version: "learning-rebase-result-v1";
  readonly status: "REBASE_REQUIRED";
  readonly transition_id: TransitionIdV0;
  readonly subject_id: IdentifierV0;
  readonly payload_fingerprint: HashV1;
  readonly previous_revision: StateRevisionV0;
  readonly next_revision: null;
  readonly state_hash_before: HashV1;
  readonly state_hash_after: HashV1;
  readonly error_code: "STALE_STATE_REVISION";
  readonly reason: "REBASE-STALE-001";
  readonly trace_ref: null;
  readonly audit_ref: CanonicalRefV0;
  readonly result_ref: CanonicalRefV0;
}

/** §7.5 CanonicalErrorResultV1 — post-context rejected/aborted, all keys required. */
export interface CanonicalErrorResultV1 {
  readonly schema_version: "canonical-error-result-v1";
  readonly status: "REJECTED" | "ABORTED";
  readonly transition_id: TransitionIdV0;
  readonly subject_id: IdentifierV0;
  readonly payload_fingerprint: HashV1;
  readonly previous_revision: StateRevisionV0;
  readonly next_revision: null;
  readonly state_hash_before: HashV1;
  readonly state_hash_after: HashV1;
  readonly error_code: ErrorCode;
  readonly reason: RequirementId;
  readonly trace_ref: null;
  readonly audit_ref: CanonicalRefV0;
  readonly result_ref: CanonicalRefV0;
}

/** §7.5 admission operation discriminator. */
export type AdmissionOperation = "CREATE" | "COMMIT" | "RESTORE";

/** §7.5 AdmissionErrorResultV1 — closed pre-attempt/restore envelope. */
export interface AdmissionErrorResultV1 {
  readonly schema_version: "admission-error-result-v1";
  readonly operation: AdmissionOperation;
  readonly status: "REJECTED" | "ABORTED";
  readonly transition_id: TransitionIdV0 | null;
  readonly subject_id: IdentifierV0 | null;
  readonly current_revision: StateRevisionV0 | null;
  readonly state_hash: HashV1 | null;
  readonly error_code: ErrorCode;
  readonly reason: RequirementId;
  readonly audit_ref: null;
  readonly result_ref: null;
}

/** §7.5 MICLAdmissionErrorResultV1 — separate workflow admission error (MICL_ID_REUSE). */
export interface MICLAdmissionErrorResultV1 {
  readonly schema_version: "micl-admission-error-result-v1";
  readonly status: "REJECTED";
  readonly micl_id: IdentifierV0;
  readonly subject_id: IdentifierV0;
  readonly stored_request_fingerprint: HashV1;
  readonly attempted_request_fingerprint: HashV1;
  readonly error_code: "MICL_ID_REUSE";
  readonly reason: "MICL-RESUME-001";
  readonly audit_refs: readonly [];
  readonly result_ref: CanonicalRefV0;
}

/** §7.6 status discriminator for the logical wrapper. */
export type LogicalTransitionStatus =
  | "COMMITTED"
  | "ALREADY_COMMITTED"
  | "NO_OP"
  | "REJECTED"
  | "ABORTED"
  | "REBASE_REQUIRED";

/** §7.6 LogicalTransitionResultV1 wrapper. */
export interface LogicalTransitionResultV1 {
  readonly schema_version: "logical-transition-result-v1";
  readonly transition_id: TransitionIdV0;
  readonly subject_id: IdentifierV0;
  readonly transition_type: TransitionType;
  readonly payload_fingerprint: HashV1;
  readonly status: LogicalTransitionStatus;
  readonly previous_revision: StateRevisionV0;
  readonly next_revision: StateRevisionV0 | null;
  readonly logical_time_before: LogicalTimeV0;
  readonly logical_time_after: LogicalTimeV0;
  readonly state_hash_before: HashV1;
  readonly state_hash_after: HashV1;
  readonly snapshot_hash_before: HashV1;
  readonly snapshot_hash_after: HashV1;
  readonly trace_ref: CanonicalRefV0 | null;
  readonly outcome_result_ref: CanonicalRefV0;
  readonly domain_result_refs: readonly CanonicalRefV0[];
  readonly external_effect_refs: readonly [];
  readonly error_code: ErrorCode | null;
  readonly reason: RequirementId | null;
  readonly audit_refs: readonly CanonicalRefV0[];
}

/** §7.6 workflow stage key for the prepared-record binding. */
export type MiclStageKey = "TIME" | "OBSERVATION" | "LEARNING";

/** §7.6 PreparedLogicalResultV1 — runtime-owned durable prepared record. */
export interface PreparedLogicalResultV1 {
  readonly schema_version: "prepared-logical-result-v1";
  readonly prepared_result_ref: CanonicalRefV0;
  readonly transition_id: TransitionIdV0;
  readonly subject_id: IdentifierV0;
  readonly transition_type: TransitionType;
  readonly payload_fingerprint: HashV1;
  readonly workflow_binding: WorkflowBindingV0 | null;
  readonly domain_result_refs: readonly CanonicalRefV0[];
  readonly external_effect_refs: readonly [];
}

export interface WorkflowBindingV0 {
  readonly micl_id: IdentifierV0;
  readonly micl_request_fingerprint: HashV1;
  readonly stage_key: MiclStageKey;
}

/** §7.6 PreparedLogicalResultBindingV1 — trusted capability minted by runtime. */
export interface PreparedLogicalResultBindingV1 {
  readonly prepared_result_ref: CanonicalRefV0;
  readonly transition_id: TransitionIdV0;
  readonly subject_id: IdentifierV0;
  readonly transition_type: TransitionType;
  readonly payload_fingerprint: HashV1;
}
