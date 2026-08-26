/**
 * P2.3 Pre-Learning P0-1 — TransitionIdentityJournal (reference implementation).
 * Source: docs/implementation/p2-1-contract-freeze.md §14.1–§14.3.
 *
 * Durable semantics over in-memory state:
 * - `reserveIdentity` routes NEW_RESERVED / SAME_OPEN_OR_RETRY / SAME_TERMINAL_COMMITTED /
 *   SAME_TERMINAL_NO_OP / REUSE_CONFLICT_PENDING by first-seen header + fingerprint.
 * - Records carry append-only attempts, reuse-conflict successors and single-assignment
 *   terminal fields; every successor bumps `record_version` exactly once under CAS.
 * - COMMITTED terminals are authoritative in AtomicCommitBundleV1.transition_record:
 *   `rebuildFromCommittedBundles` reconstructs terminal records after "restart", so a
 *   changed payload with the same ID is still detected without trace_window and
 *   without relying on runtime memory.
 * - The journal NEVER reads canonical state itself: position facts (revision/logical
 *   time/state hash/snapshot hash) enter `recordReuseConflict` explicitly from the
 *   caller (subject-core loads them, §14.1).
 * - Optional host-side persistence: `exportState` / `importState` round-trip the full
 *   record set so a host can survive process loss; COMMITTED records additionally
 *   rebuild from the authoritative store.
 */

import type {
  AuthoritativeTransitionRecordV1,
  TransitionAttemptV1,
  TransitionReuseConflictV1,
  AuditEventV1,
  ReservationRoute
} from "../types/identity.js";
import type { HashV1, HistorySequenceV0, IdentifierV0, LogicalTimeV0, StateRevisionV0, TransitionIdV0 } from "../types/scalars.js";
import type { CanonicalRefV0 } from "../types/ref.js";
import type { TransitionType } from "../types/enums.js";
import type { AtomicCommitBundleV1 } from "../types/persistence.js";
import { deriveRef } from "../canonical/hash.js";

const AUDIT_ID_PROJECTION = "characteros-next/subject-core/audit-id/v1";
const RESULT_ID_PROJECTION = "characteros-next/subject-core/result-id/v1";

export interface ReserveIdentityInput {
  readonly transition_id: TransitionIdV0;
  readonly subject_id: IdentifierV0;
  readonly transition_type: TransitionType;
  readonly proposal_ref: CanonicalRefV0;
  readonly payload_fingerprint: HashV1;
}

export type ReserveIdentityOutcome =
  | { readonly route: "NEW_RESERVED" }
  | { readonly route: "SAME_OPEN_OR_RETRY" }
  | { readonly route: "SAME_TERMINAL_COMMITTED" }
  | { readonly route: "SAME_TERMINAL_NO_OP" }
  | { readonly route: "REUSE_CONFLICT_PENDING" };

export interface ReuseConflictInput {
  readonly transition_id: TransitionIdV0;
  readonly attempted_subject_id: IdentifierV0;
  readonly attempted_transition_type: TransitionType;
  readonly attempted_proposal_ref: CanonicalRefV0;
  readonly attempted_payload_fingerprint: HashV1;
  /** Caller-loaded canonical position facts (journal never reads state). */
  readonly revision_before: number;
  readonly logical_time_before: number;
  readonly state_hash_before: HashV1;
  readonly snapshot_hash_before: HashV1;
}

export interface ReuseConflictRecorded {
  readonly conflict: TransitionReuseConflictV1;
  readonly audit: AuditEventV1;
}

export interface TransitionIdentityJournalPort {
  reserveIdentity(input: ReserveIdentityInput): Promise<ReserveIdentityOutcome>;
  readRecord(transitionId: TransitionIdV0): Promise<AuthoritativeTransitionRecordV1 | null>;
  /**
   * CAS append of one attempt + optional terminal fields. Returns false when the
   * expected record version is stale (race); callers reconcile.
   */
  appendAttempt(
    transitionId: TransitionIdV0,
    expectedRecordVersion: number,
    attempt: TransitionAttemptV1,
    terminal?: { readonly status: "COMMITTED" | "NO_OP"; readonly result_ref: CanonicalRefV0 }
  ): Promise<boolean>;
  /** Explicit caller-bound reuse-conflict recording (§14.1). */
  recordReuseConflict(input: ReuseConflictInput): Promise<ReuseConflictRecorded>;
  /** Rebuild COMMITTED terminal records from authoritative bundles (restart recovery). */
  rebuildFromCommittedBundles(bundles: readonly AtomicCommitBundleV1[]): void;
  /** Host-side persistence round-trip. */
  exportState(): AuthoritativeTransitionRecordV1[];
  importState(records: readonly AuthoritativeTransitionRecordV1[]): void;
}

function stableTupleKey(input: ReuseConflictInput): string {
  return [
    input.attempted_subject_id,
    input.attempted_transition_type,
    input.attempted_proposal_ref,
    input.attempted_payload_fingerprint
  ].join("\u0000");
}

export class InMemoryTransitionIdentityJournal implements TransitionIdentityJournalPort {
  private readonly records = new Map<TransitionIdV0, AuthoritativeTransitionRecordV1>();
  private sequence = 0;

  private nextSequence(): number {
    this.sequence += 1;
    return this.sequence;
  }

  async reserveIdentity(input: ReserveIdentityInput): Promise<ReserveIdentityOutcome> {
    const existing = this.records.get(input.transition_id);
    if (existing === undefined) {
      this.records.set(input.transition_id, {
        schema_version: "transition-record-v1",
        record_version: 1,
        transition_id: input.transition_id,
        subject_id: input.subject_id,
        transition_type: input.transition_type,
        proposal_ref: input.proposal_ref,
        payload_fingerprint: input.payload_fingerprint,
        fingerprint_version: "proposal-fingerprint-v1",
        first_seen_sequence: this.nextSequence() as HistorySequenceV0,
        attempts: [],
        reuse_conflicts: [],
        terminal_status: null,
        terminal_result_ref: null
      });
      return { route: "NEW_RESERVED" };
    }
    const sameIdentity =
      existing.subject_id === input.subject_id &&
      existing.transition_type === input.transition_type &&
      existing.proposal_ref === input.proposal_ref &&
      existing.payload_fingerprint === input.payload_fingerprint;
    if (!sameIdentity) {
      return { route: "REUSE_CONFLICT_PENDING" };
    }
    if (existing.terminal_status === "COMMITTED") {
      return { route: "SAME_TERMINAL_COMMITTED" };
    }
    if (existing.terminal_status === "NO_OP") {
      return { route: "SAME_TERMINAL_NO_OP" };
    }
    return { route: "SAME_OPEN_OR_RETRY" };
  }

  async readRecord(transitionId: TransitionIdV0): Promise<AuthoritativeTransitionRecordV1 | null> {
    return this.records.get(transitionId) ?? null;
  }

  async appendAttempt(
    transitionId: TransitionIdV0,
    expectedRecordVersion: number,
    attempt: TransitionAttemptV1,
    terminal?: { readonly status: "COMMITTED" | "NO_OP"; readonly result_ref: CanonicalRefV0 }
  ): Promise<boolean> {
    const record = this.records.get(transitionId);
    if (record === undefined || record.record_version !== expectedRecordVersion) {
      return false; // stale version — caller reconciles
    }
    if (record.terminal_status !== null) {
      return false; // single-assignment terminal
    }
    const next: AuthoritativeTransitionRecordV1 = {
      ...record,
      record_version: record.record_version + 1,
      attempts: [...record.attempts, attempt],
      terminal_status: terminal?.status ?? null,
      terminal_result_ref: terminal?.result_ref ?? null
    };
    this.records.set(transitionId, next);
    return true;
  }

  async recordReuseConflict(input: ReuseConflictInput): Promise<ReuseConflictRecorded> {
    const record = this.records.get(input.transition_id);
    if (record === undefined) {
      throw new Error("reuse conflict requires an existing reserved record");
    }
    // Idempotency key: the attempted tuple; first observed position is captured once.
    const attemptedTuple = stableTupleKey(input);
    const already = record.reuse_conflicts.find((conflict) => {
      const tuple = [
        conflict.attempted_subject_id,
        conflict.attempted_transition_type,
        conflict.attempted_proposal_ref,
        conflict.attempted_payload_fingerprint
      ].join("\u0000");
      return tuple === attemptedTuple;
    });
    if (already !== undefined) {
      return {
        conflict: already,
        audit: {
          schema_version: "audit-event-v1",
          audit_ref: already.audit_ref,
          subject_id: already.attempted_subject_id,
          transition_id: input.transition_id,
          payload_fingerprint: already.attempted_payload_fingerprint,
          attempt_sequence: already.conflict_sequence,
          status: "REUSE_CONFLICT",
          error_code: "TRANSITION_ID_REUSE",
          reason: "IDEM-REUSE-001",
          revision_before: already.revision_before,
          state_hash_before: already.state_hash_before
        }
      };
    }

    const conflictSequence = record.reuse_conflicts.length + 1;
    // §14.4 deterministic refs over exact projection bodies.
    const auditRef = (await deriveRef("audit", AUDIT_ID_PROJECTION, {
      subject_id: input.attempted_subject_id,
      transition_id: input.transition_id,
      payload_fingerprint: input.attempted_payload_fingerprint,
      attempt_sequence: conflictSequence,
      status: "REUSE_CONFLICT",
      revision_before: input.revision_before,
      state_hash_before: input.state_hash_before,
      error_code: "TRANSITION_ID_REUSE",
      reason: "IDEM-REUSE-001"
    })) as CanonicalRefV0;
    const audit: AuditEventV1 = {
      schema_version: "audit-event-v1",
      audit_ref: auditRef,
      subject_id: input.attempted_subject_id,
      transition_id: input.transition_id,
      payload_fingerprint: input.attempted_payload_fingerprint,
      attempt_sequence: conflictSequence,
      status: "REUSE_CONFLICT",
      error_code: "TRANSITION_ID_REUSE",
      reason: "IDEM-REUSE-001",
      revision_before: input.revision_before as StateRevisionV0,
      state_hash_before: input.state_hash_before
    };
    const conflictBody = {
      conflict_sequence: conflictSequence,
      attempted_subject_id: input.attempted_subject_id,
      attempted_transition_type: input.attempted_transition_type,
      attempted_proposal_ref: input.attempted_proposal_ref,
      attempted_payload_fingerprint: input.attempted_payload_fingerprint,
      revision_before: input.revision_before,
      logical_time_before: input.logical_time_before,
      state_hash_before: input.state_hash_before,
      snapshot_hash_before: input.snapshot_hash_before,
      error_code: "TRANSITION_ID_REUSE",
      reason: "IDEM-REUSE-001",
      audit_ref: auditRef
    };
    const resultRef = (await deriveRef("result", RESULT_ID_PROJECTION, conflictBody)) as CanonicalRefV0;
    const conflict = {
      ...conflictBody,
      revision_before: conflictBody.revision_before as StateRevisionV0,
      logical_time_before: conflictBody.logical_time_before as LogicalTimeV0,
      result_ref: resultRef
    } as unknown as TransitionReuseConflictV1;
    const next: AuthoritativeTransitionRecordV1 = {
      ...record,
      record_version: record.record_version + 1,
      reuse_conflicts: [...record.reuse_conflicts, conflict]
    };
    this.records.set(input.transition_id, next);
    return { conflict, audit };
  }

  rebuildFromCommittedBundles(bundles: readonly AtomicCommitBundleV1[]): void {
    for (const bundle of bundles) {
      const record = bundle.transition_record;
      const existing = this.records.get(record.transition_id);
      if (existing === undefined || existing.record_version < record.record_version) {
        this.records.set(record.transition_id, record);
      }
    }
  }

  exportState(): AuthoritativeTransitionRecordV1[] {
    return [...this.records.values()];
  }

  importState(records: readonly AuthoritativeTransitionRecordV1[]): void {
    for (const record of records) {
      const existing = this.records.get(record.transition_id);
      if (existing === undefined || existing.record_version < record.record_version) {
        this.records.set(record.transition_id, record);
      }
    }
  }
}

/** Export the route literal type for typed consumers. */
export type { ReservationRoute };
