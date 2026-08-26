/**
 * P2.3 Pre-Learning P0-1 — SubjectCoreFacade: the authorized two-call identity/commit
 * protocol.
 * Source: docs/implementation/p2-1-contract-freeze.md §7.1, §13.4, §14.1–§14.3.
 *
 * Public mutation surface is EXACTLY:
 *   reserveAndRoute(proposal) → continuation | already committed | terminal NO_OP | reuse conflict
 *   commitReserved(proposal, continuation, ProducerAuthorizationSetV1, PreparedLogicalResultBindingV1)
 *   terminalizeReservedNoOp(...)            (durable NO_OP terminal, runtime-owned status)
 *   readCurrentSnapshot(subjectId)
 *   reconcile(transitionId, subjectId, fingerprint)
 *
 * Authority rules enforced here (audit P0-1):
 * 1. SubjectCore reads authoritative state ITSELF via the injected StateReader —
 *    callers cannot supply currentState.
 * 2. The latest authority is RE-READ on the second call; pre-preparation snapshots
 *    are never reused.
 * 3. Journal facts (identity version, prior attempts, first-seen sequence) and
 *    previous-chain refs come from the injected journal/store — callers cannot forge
 *    them. The trusted prepared binding is VERIFIED verdict-only against the proposal
 *    identity/fingerprint; missing/corrupt → COMMIT_CHAIN_INTEGRITY_FAILURE.
 * 4. Same transition id + same fingerprint routes to the original authoritative
 *    outcome (ALREADY_COMMITTED / terminal NO_OP).
 * 5. Same id + different fingerprint → REUSE_CONFLICT_PENDING → durable conflict
 *    record + audit appended via the explicit conflict operation (position facts
 *    loaded by core, never read implicitly by the journal).
 * 6. OUTCOME_UNKNOWN never re-runs mutation: `reconcile` must resolve before retry.
 * 7. NO_OP is a DURABLE terminal identity record (journal terminal_status=NO_OP),
 *    never a bare early return.
 *
 * Producer authorization (P0-2): commitReserved requires a trusted
 * ProducerAuthorizationSetV1 whose binding set equals EXACTLY the distinct
 * (producer,domain) pairs of the proposal deltas; a self-declared producer string
 * without the capability is UNAUTHORIZED_PRODUCER.
 */

import type {
  CanonicalTransitionProposalV1,
  ProducerAuthorizationSetV1
} from "../types/transition.js";
import type { PreparedLogicalResultBindingV1 } from "../types/result.js";
import type {
  ReservedTransitionContinuationV1,
  TransitionAttemptV1
} from "../types/identity.js";
import type {
  AtomicCommitBundleV1,
  RepositoryRevisionBindingV1
} from "../types/persistence.js";
import type { AtomicCommitStorePort } from "./store.js";
import type {
  TransitionIdentityJournalPort,
  ReuseConflictInput
} from "../identity/journal.js";
import type { SubjectStateV0 } from "../types/subject-state.js";
import type { CanonicalRefV0 } from "../types/ref.js";
import type { HashV1, IdentifierV0, StateRevisionV0, TransitionIdV0 } from "../types/scalars.js";
import type { ErrorCode, RequirementId } from "../types/enums.js";
import type { ReferenceValidatorCapability, MemoryAdoptionValidatorCapability } from "./engine.js";
import {
  createCommitEngine,
  type CommitEngine,
  type CommitTransitionInput,
  type CommitTransitionOutcome
} from "./engine.js";
import { validateProposal } from "../validation/proposal.js";
import {
  proposalFingerprint,
  proposalRef,
  snapshotHash,
  stateHash
} from "../canonical/projections.js";
import { deriveRef } from "../canonical/hash.js";
import { lastTraceRef } from "../trace/trace.js";

const AUDIT_ID_PROJECTION = "characteros-next/subject-core/audit-id/v1";
const RESULT_ID_PROJECTION = "characteros-next/subject-core/result-id/v1";

export interface StateReaderPort {
  readCurrentSnapshot(subjectId: IdentifierV0): Promise<SubjectStateV0 | null>;
}

/** Verdict-only inverted capability for the trusted prepared record binding (§7.6). */
export type PreparedResultValidatorCapability = (
  binding: PreparedLogicalResultBindingV1
) => boolean | Promise<boolean>;

/**
 * Verdict-only inverted capability for the trusted producer authorization set
 * (§7.1, ATTACK D closure): true ONLY for issuer-minted capabilities.
 */
export type ProducerAuthorizationVerifierCapability = (
  set: ProducerAuthorizationSetV1
) => boolean | Promise<boolean>;

export interface SubjectCoreFacadePorts {
  readonly store: AtomicCommitStorePort;
  readonly journal: TransitionIdentityJournalPort;
  readonly stateReader: StateReaderPort;
  readonly preparedResultValidator: PreparedResultValidatorCapability;
  readonly producerAuthorizationVerifier: ProducerAuthorizationVerifierCapability;
  readonly referenceValidator?: ReferenceValidatorCapability;
  /**
   * R2-H (ATTACK F): verdict-only memory adoption proof. REQUIRED — fail-closed —
   * whenever a proposal changes the canonical memory binding; never consulted for
   * binding-neutral proposals.
   */
  readonly memoryAdoptionValidator?: MemoryAdoptionValidatorCapability;
}

export type ReserveAndRouteOutcome =
  | { readonly kind: "CONTINUE"; readonly continuation: ReservedTransitionContinuationV1 }
  | { readonly kind: "ALREADY_COMMITTED"; readonly bundle: AtomicCommitBundleV1 }
  | { readonly kind: "TERMINAL_NO_OP" }
  | {
      readonly kind: "REUSE_CONFLICT";
      readonly error_code: "TRANSITION_ID_REUSE";
      readonly reason: "IDEM-REUSE-001";
    };

export type CommitReservedOutcome = CommitTransitionOutcome;

export interface TerminalizeNoOpInput {
  readonly proposal: CanonicalTransitionProposalV1;
  readonly continuation: ReservedTransitionContinuationV1;
  readonly producerAuthorization: ProducerAuthorizationSetV1;
  readonly preparedBinding: PreparedLogicalResultBindingV1;
}

export interface CommitReservedInput {
  readonly proposal: CanonicalTransitionProposalV1;
  readonly continuation: ReservedTransitionContinuationV1;
  readonly producerAuthorization: ProducerAuthorizationSetV1;
  readonly preparedBinding: PreparedLogicalResultBindingV1;
  readonly repository_bindings: readonly RepositoryRevisionBindingV1[];
}

export type ReconcileOutcome =
  | { readonly kind: "COMMITTED"; readonly bundle: AtomicCommitBundleV1 }
  | { readonly kind: "COMMIT_CONFLICT"; readonly bundle: AtomicCommitBundleV1 }
  | { readonly kind: "TERMINAL_NO_OP" }
  | { readonly kind: "NOT_COMMITTED" };

function admissionFailure(code: string, reason: string, detail: string): Error {
  return new Error(`${code}/${reason}: ${detail}`);
}

interface PositionFacts {
  readonly revision: number;
  readonly logical_time: number;
  readonly state_hash: HashV1;
  readonly snapshot_hash: HashV1;
}

interface StoreReadSurface {
  readCommittedByTransitionId?(id: string): Promise<AtomicCommitBundleV1 | null>;
  getCommittedBundles?(): readonly AtomicCommitBundleV1[];
  readCurrentCommitRef?(id: string): CanonicalRefV0 | null;
  readCurrentBundle?(id: string): AtomicCommitBundleV1 | null;
}

export class SubjectCoreFacade {
  private readonly engine: CommitEngine;

  constructor(private readonly ports: SubjectCoreFacadePorts) {
    this.engine = createCommitEngine({ store: ports.store });
  }

  async reserveAndRoute(proposal: CanonicalTransitionProposalV1): Promise<ReserveAndRouteOutcome> {
    const syntax = validateProposal(proposal);
    if (!syntax.ok) {
      throw admissionFailure("INVALID_SCHEMA", "SS-SCHEMA-001", syntax.error.detail);
    }

    const pref = await proposalRef(proposal);
    const fingerprint = await proposalFingerprint(proposal);
    const route = await this.ports.journal.reserveIdentity({
      transition_id: proposal.transition_id,
      subject_id: proposal.subject_id,
      transition_type: proposal.transition_type,
      proposal_ref: pref,
      payload_fingerprint: fingerprint
    });

    switch (route.route) {
      case "NEW_RESERVED":
      case "SAME_OPEN_OR_RETRY": {
        const record = await this.ports.journal.readRecord(proposal.transition_id);
        if (record === null) {
          throw admissionFailure(
            "COMMIT_CHAIN_INTEGRITY_FAILURE",
            "SS-RESTORE-001",
            "reservation vanished after routing"
          );
        }
        const continuation: ReservedTransitionContinuationV1 = {
          schema_version: "reserved-transition-continuation-v1",
          transition_id: proposal.transition_id,
          subject_id: proposal.subject_id,
          transition_type: proposal.transition_type,
          proposal_ref: pref,
          payload_fingerprint: fingerprint,
          identity_record_version_observed: record.record_version,
          route: route.route
        };
        return { kind: "CONTINUE", continuation };
      }
      case "SAME_TERMINAL_COMMITTED": {
        const bundle = await this.readCommittedBundle(proposal.transition_id);
        if (bundle === null) {
          throw admissionFailure(
            "COMMIT_CHAIN_INTEGRITY_FAILURE",
            "SS-RESTORE-001",
            "terminal COMMITTED record without an authoritative bundle"
          );
        }
        return { kind: "ALREADY_COMMITTED", bundle };
      }
      case "SAME_TERMINAL_NO_OP":
        return { kind: "TERMINAL_NO_OP" };
      case "REUSE_CONFLICT_PENDING": {
        const position = await this.loadPositionFacts(proposal.subject_id);
        const conflictInput: ReuseConflictInput = {
          transition_id: proposal.transition_id,
          attempted_subject_id: proposal.subject_id,
          attempted_transition_type: proposal.transition_type,
          attempted_proposal_ref: pref,
          attempted_payload_fingerprint: fingerprint,
          revision_before: position?.revision ?? 0,
          logical_time_before: position?.logical_time ?? 0,
          state_hash_before: position?.state_hash ?? ("sha256:" as HashV1),
          snapshot_hash_before: position?.snapshot_hash ?? ("sha256:" as HashV1)
        };
        await this.ports.journal.recordReuseConflict(conflictInput);
        return {
          kind: "REUSE_CONFLICT",
          error_code: "TRANSITION_ID_REUSE",
          reason: "IDEM-REUSE-001"
        };
      }
    }
  }

  async commitReserved(input: CommitReservedInput): Promise<CommitReservedOutcome> {
    // 1. Syntax gate: the second call never trusts the reserved parse (§13.4 (1)).
    const syntax = validateProposal(input.proposal);
    if (!syntax.ok) {
      throw admissionFailure("INVALID_SCHEMA", "SS-SCHEMA-001", syntax.error.detail);
    }

    // 2. Forged-capability gate (§13.4 layer 0, ATTACK D closure): the producer
    // authorization set must be an issuer-minted trusted capability; a merely
    // structural copy is UNAUTHORIZED_PRODUCER before anything else runs.
    const capabilityOk = await this.ports.producerAuthorizationVerifier(input.producerAuthorization);
    if (capabilityOk !== true) {
      return this.rejected(
        "UNAUTHORIZED_PRODUCER",
        "SS-AUTH-001",
        "producer authorization capability invalid or forged"
      );
    }

    // 3. Continuation integrity: immutable header must match the journal record.
    const record = await this.ports.journal.readRecord(input.continuation.transition_id);
    if (record === null) {
      throw admissionFailure("COMMIT_CHAIN_INTEGRITY_FAILURE", "SS-RESTORE-001", "reservation record missing");
    }
    const headerMatches =
      record.subject_id === input.continuation.subject_id &&
      record.transition_type === input.continuation.transition_type &&
      record.proposal_ref === input.continuation.proposal_ref &&
      record.payload_fingerprint === input.continuation.payload_fingerprint;
    if (!headerMatches) {
      throw admissionFailure(
        "COMMIT_CHAIN_INTEGRITY_FAILURE",
        "SS-RESTORE-001",
        "continuation header does not match the journal record"
      );
    }

    // 4. Proposal identity re-bind (ATTACK A closure): the submitted proposal's
    // cryptographic identity is RECOMPUTED and must equal the identity recorded
    // at reservation — a continuation can never carry a different proposal.
    const recomputedRef = await proposalRef(input.proposal);
    const recomputedFingerprint = await proposalFingerprint(input.proposal);
    if (
      input.proposal.transition_id !== record.transition_id ||
      input.proposal.subject_id !== record.subject_id ||
      input.proposal.transition_type !== record.transition_type ||
      recomputedRef !== record.proposal_ref ||
      recomputedFingerprint !== record.payload_fingerprint
    ) {
      throw admissionFailure(
        "COMMIT_CHAIN_INTEGRITY_FAILURE",
        "SS-RESTORE-001",
        "proposal identity does not match the reserved continuation"
      );
    }

    if (record.terminal_status === "COMMITTED") {
      const bundle = await this.readCommittedBundle(input.continuation.transition_id);
      if (bundle === null) {
        throw admissionFailure("COMMIT_CHAIN_INTEGRITY_FAILURE", "SS-RESTORE-001", "committed bundle missing");
      }
      return { kind: "COMMITTED", bundle, result: bundle.canonical_result };
    }
    if (record.terminal_status === "NO_OP") {
      return { kind: "NO_OP" };
    }

    // 5. Trusted prepared binding: bound to the reserved identity (§7.6, ATTACK C
    // closure) — a binding minted for another transition/subject/type is refused
    // before any verdict is consulted.
    const bindingBound =
      input.preparedBinding.transition_id === record.transition_id &&
      input.preparedBinding.subject_id === record.subject_id &&
      input.preparedBinding.transition_type === record.transition_type;
    if (!bindingBound) {
      throw admissionFailure(
        "COMMIT_CHAIN_INTEGRITY_FAILURE",
        "SS-RESTORE-001",
        "prepared result binding is not bound to the reserved identity"
      );
    }
    const bindingOk = await this.ports.preparedResultValidator(input.preparedBinding);
    if (bindingOk !== true) {
      throw admissionFailure(
        "COMMIT_CHAIN_INTEGRITY_FAILURE",
        "SS-RESTORE-001",
        "prepared result binding invalid or corrupt"
      );
    }

    // 6. Producer authorization: capability set equals the proposal's distinct pairs.
    const distinctPairs = new Set<string>();
    for (const delta of input.proposal.domain_deltas) {
      distinctPairs.add(`${delta.producer}|${delta.domain}`);
    }
    const authorizedPairs = new Set<string>();
    for (const binding of input.producerAuthorization.bindings) {
      authorizedPairs.add(`${binding.producer}|${binding.domain}`);
    }
    if (
      distinctPairs.size !== authorizedPairs.size ||
      [...distinctPairs].some((pair) => !authorizedPairs.has(pair))
    ) {
      return this.rejected("UNAUTHORIZED_PRODUCER", "SS-AUTH-001", "producer authorization set mismatch");
    }

    // 7. RE-READ latest authority.
    const currentState = await this.ports.stateReader.readCurrentSnapshot(
      input.continuation.subject_id
    );
    if (currentState === null) {
      return this.rejected("UNKNOWN_SUBJECT", "SS-AUTH-001", "subject not found at second call");
    }

    // 8. Journal/store-derived facts.
    const store = this.ports.store as StoreReadSurface;
    const previousCommitRef =
      (await this.readCurrentCommitRef(input.continuation.subject_id)) ??
      null;
    const previousBundle = store.readCurrentBundle?.(input.continuation.subject_id) ?? null;

    const engineInput: CommitTransitionInput = {
      proposal: input.proposal,
      currentState,
      identity_record_version_before: record.record_version,
      first_seen_sequence: record.first_seen_sequence,
      prior_attempts: record.attempts,
      previous_commit_ref: previousCommitRef,
      previous_record_checksum: previousBundle?.record_checksum ?? null,
      prepared_result_ref: input.preparedBinding.prepared_result_ref,
      repository_bindings: input.repository_bindings,
      ...(this.ports.referenceValidator !== undefined
        ? { reference_validator: this.ports.referenceValidator }
        : {}),
      ...(this.ports.memoryAdoptionValidator !== undefined
        ? { memory_adoption_validator: this.ports.memoryAdoptionValidator }
        : {})
    };

    const outcome = await this.engine.commitTransition(engineInput);
    return this.finalizeAfterCommit(outcome, record.record_version, input.continuation.transition_id);
  }

  async terminalizeReservedNoOp(input: TerminalizeNoOpInput): Promise<CommitReservedOutcome> {
    const syntax = validateProposal(input.proposal);
    if (!syntax.ok) {
      throw admissionFailure("INVALID_SCHEMA", "SS-SCHEMA-001", syntax.error.detail);
    }
    // Forged-capability gate (§13.4 layer 0, ATTACK D closure).
    const capabilityOk = await this.ports.producerAuthorizationVerifier(input.producerAuthorization);
    if (capabilityOk !== true) {
      return this.rejected(
        "UNAUTHORIZED_PRODUCER",
        "SS-AUTH-001",
        "producer authorization capability invalid or forged"
      );
    }
    const record = await this.ports.journal.readRecord(input.continuation.transition_id);
    if (record === null) {
      throw admissionFailure("COMMIT_CHAIN_INTEGRITY_FAILURE", "SS-RESTORE-001", "reservation record missing");
    }
    if (
      record.subject_id !== input.continuation.subject_id ||
      record.transition_type !== input.continuation.transition_type ||
      record.proposal_ref !== input.continuation.proposal_ref ||
      record.payload_fingerprint !== input.continuation.payload_fingerprint
    ) {
      throw admissionFailure("COMMIT_CHAIN_INTEGRITY_FAILURE", "SS-RESTORE-001", "continuation header mismatch");
    }
    // Proposal identity re-bind (ATTACK A closure): the exact reserved proposal only.
    const recomputedRef = await proposalRef(input.proposal);
    const recomputedFingerprint = await proposalFingerprint(input.proposal);
    if (
      input.proposal.transition_id !== record.transition_id ||
      input.proposal.subject_id !== record.subject_id ||
      input.proposal.transition_type !== record.transition_type ||
      recomputedRef !== record.proposal_ref ||
      recomputedFingerprint !== record.payload_fingerprint
    ) {
      throw admissionFailure(
        "COMMIT_CHAIN_INTEGRITY_FAILURE",
        "SS-RESTORE-001",
        "proposal identity does not match the reserved continuation"
      );
    }
    // Prepared binding bound to the reserved identity (§7.6, ATTACK C closure).
    const bindingBound =
      input.preparedBinding.transition_id === record.transition_id &&
      input.preparedBinding.subject_id === record.subject_id &&
      input.preparedBinding.transition_type === record.transition_type;
    if (!bindingBound) {
      throw admissionFailure(
        "COMMIT_CHAIN_INTEGRITY_FAILURE",
        "SS-RESTORE-001",
        "prepared result binding is not bound to the reserved identity"
      );
    }
    const bindingOk = await this.ports.preparedResultValidator(input.preparedBinding);
    if (bindingOk !== true) {
      throw admissionFailure("COMMIT_CHAIN_INTEGRITY_FAILURE", "SS-RESTORE-001", "prepared result binding invalid");
    }
    if (input.proposal.domain_deltas.length !== 0) {
      return this.rejected(
        "INVALID_TRANSITION_COMPOSITION",
        "TR-ATOMIC-001",
        "NO_OP terminalization requires zero deltas"
      );
    }
    if (input.producerAuthorization.bindings.length !== 0) {
      return this.rejected(
        "UNAUTHORIZED_PRODUCER",
        "SS-AUTH-001",
        "NO_OP terminalization requires an empty authorization set"
      );
    }

    // Re-read latest authority; stale must reject, never fake NO_OP (§14).
    const currentState = await this.ports.stateReader.readCurrentSnapshot(
      input.continuation.subject_id
    );
    if (currentState === null) {
      return this.rejected("UNKNOWN_SUBJECT", "SS-AUTH-001", "subject not found at NO_OP terminalization");
    }
    if (input.proposal.expected_state_revision !== currentState.runtime_metadata.state_revision) {
      return this.rejected(
        "STALE_STATE_REVISION",
        "SS-REVISION-001",
        "stale authority cannot terminalize NO_OP"
      );
    }

    // Durable terminal NO_OP record (freeze §14.2/§14.3).
    const stateHashBefore = await stateHash(currentState);
    const snapshotHashBefore = await snapshotHash({
      state_hash: stateHashBefore,
      subject_id: currentState.identity.subject_id,
      state_revision: currentState.runtime_metadata.state_revision,
      trace_cursor: currentState.trace_window.cursor,
      last_trace_ref: lastTraceRef(currentState.trace_window)
    });
    const fingerprint = await proposalFingerprint(input.proposal);
    const noOpBody = {
      schema_version: "no-op-transition-result-v1",
      status: "NO_OP",
      transition_id: input.proposal.transition_id,
      subject_id: input.proposal.subject_id,
      transition_type: "Time",
      payload_fingerprint: fingerprint,
      previous_revision: currentState.runtime_metadata.state_revision,
      next_revision: currentState.runtime_metadata.state_revision,
      logical_time_before: currentState.runtime_metadata.logical_time,
      logical_time_after: currentState.runtime_metadata.logical_time,
      state_hash_before: stateHashBefore,
      state_hash_after: stateHashBefore,
      snapshot_hash_before: snapshotHashBefore,
      snapshot_hash_after: snapshotHashBefore,
      trace_ref: null,
      prepared_result_ref: input.preparedBinding.prepared_result_ref,
      reason: "TIME-NOOP-001"
    };
    const resultRef = (await deriveRef("result", RESULT_ID_PROJECTION, noOpBody)) as CanonicalRefV0;
    const attempt: TransitionAttemptV1 = {
      attempt_sequence: record.attempts.length + 1,
      status: "NO_OP",
      revision_before: currentState.runtime_metadata.state_revision,
      revision_after: currentState.runtime_metadata.state_revision,
      state_hash_before: stateHashBefore,
      state_hash_after: stateHashBefore,
      result_ref: resultRef,
      prepared_result_ref: input.preparedBinding.prepared_result_ref,
      trace_ref: null,
      audit_ref: null,
      error_code: null,
      reason: "TIME-NOOP-001"
    };
    const appended = await this.ports.journal.appendAttempt(
      input.proposal.transition_id,
      record.record_version,
      attempt,
      { status: "NO_OP", result_ref: resultRef }
    );
    if (!appended) {
      const fresh = await this.ports.journal.readRecord(input.proposal.transition_id);
      if (fresh !== null && fresh.terminal_status === "NO_OP") {
        return { kind: "NO_OP" };
      }
      return this.rejected("COMMIT_CONFLICT", "FAIL-CAS-001", "NO_OP terminalization lost a journal race");
    }
    return { kind: "NO_OP" };
  }

  async readCurrentSnapshot(subjectId: IdentifierV0): Promise<SubjectStateV0 | null> {
    return this.ports.stateReader.readCurrentSnapshot(subjectId);
  }

  async reconcile(
    transitionId: TransitionIdV0,
    subjectId: IdentifierV0,
    fingerprint: HashV1
  ): Promise<ReconcileOutcome> {
    const bundle = await this.readCommittedBundle(transitionId);
    if (bundle !== null) {
      // Committed truth wins ONLY when the caller's identity claim matches the
      // authoritative bundle; a differing subject/fingerprint is a durable conflict
      // the host must resolve explicitly — never silently treated as the same run.
      if (bundle.subject_id === subjectId && bundle.payload_fingerprint === fingerprint) {
        return { kind: "COMMITTED", bundle };
      }
      return { kind: "COMMIT_CONFLICT", bundle };
    }
    const record = await this.ports.journal.readRecord(transitionId);
    if (record !== null && record.terminal_status === "NO_OP") {
      return { kind: "TERMINAL_NO_OP" };
    }
    return { kind: "NOT_COMMITTED" };
  }

  // -------------------------------------------------------------------------------
  private async finalizeAfterCommit(
    outcome: CommitTransitionOutcome,
    expectedRecordVersion: number,
    transitionId: TransitionIdV0
  ): Promise<CommitTransitionOutcome> {
    if (outcome.kind !== "COMMITTED") {
      if (outcome.kind === "REJECTED" || outcome.kind === "ABORTED") {
        await this.appendRejectedAttempt(
          transitionId,
          expectedRecordVersion,
          outcome.kind === "REJECTED" ? outcome.failure.error_code : "SERVICE_UNAVAILABLE",
          outcome.kind === "REJECTED" ? outcome.failure.reason : "FAIL-PRECOMMIT-001"
        );
      }
      return outcome;
    }
    const attempts = outcome.bundle.transition_record.attempts;
    const committedAttempt = attempts[attempts.length - 1];
    if (committedAttempt === undefined) {
      return outcome;
    }
    const appended = await this.ports.journal.appendAttempt(
      transitionId,
      expectedRecordVersion,
      committedAttempt,
      {
        status: "COMMITTED",
        result_ref: outcome.bundle.transition_record.terminal_result_ref as CanonicalRefV0
      }
    );
    if (!appended) {
      await this.ports.journal.rebuildFromCommittedBundles([outcome.bundle]);
    }
    return outcome;
  }

  private async appendRejectedAttempt(
    transitionId: TransitionIdV0,
    expectedRecordVersion: number,
    errorCode: ErrorCode,
    reason: RequirementId
  ): Promise<void> {
    const record = await this.ports.journal.readRecord(transitionId);
    if (record === null) return;
    const current = await this.ports.stateReader.readCurrentSnapshot(record.subject_id);
    const revisionBefore = (current?.runtime_metadata.state_revision ?? 0) as StateRevisionV0;
    const stateHashBefore = current === null ? ("sha256:" as HashV1) : await stateHash(current);
    const status = errorCode === "SERVICE_UNAVAILABLE" ? "ABORTED" : "REJECTED";
    const auditRef = (await deriveRef("audit", AUDIT_ID_PROJECTION, {
      subject_id: record.subject_id,
      transition_id: transitionId,
      payload_fingerprint: record.payload_fingerprint,
      attempt_sequence: record.attempts.length + 1,
      status,
      revision_before: revisionBefore,
      state_hash_before: stateHashBefore,
      error_code: errorCode,
      reason
    })) as CanonicalRefV0;
    const attempt: TransitionAttemptV1 = {
      attempt_sequence: record.attempts.length + 1,
      status,
      revision_before: revisionBefore,
      revision_after: revisionBefore,
      state_hash_before: stateHashBefore,
      state_hash_after: stateHashBefore,
      result_ref: auditRef,
      prepared_result_ref: ("workflow:unused" as CanonicalRefV0),
      trace_ref: null,
      audit_ref: auditRef,
      error_code: errorCode,
      reason
    };
    await this.ports.journal.appendAttempt(transitionId, expectedRecordVersion, attempt);
  }

  private async loadPositionFacts(subjectId: IdentifierV0): Promise<PositionFacts | null> {
    const current = await this.ports.stateReader.readCurrentSnapshot(subjectId);
    if (current === null) return null;
    const stateHashValue = await stateHash(current);
    return {
      revision: current.runtime_metadata.state_revision,
      logical_time: current.runtime_metadata.logical_time,
      state_hash: stateHashValue,
      snapshot_hash: await snapshotHash({
        state_hash: stateHashValue,
        subject_id: current.identity.subject_id,
        state_revision: current.runtime_metadata.state_revision,
        trace_cursor: current.trace_window.cursor,
        last_trace_ref: lastTraceRef(current.trace_window)
      })
    };
  }

  private async readCommittedBundle(transitionId: string): Promise<AtomicCommitBundleV1 | null> {
    const store = this.ports.store as StoreReadSurface;
    if (typeof store.readCommittedByTransitionId === "function") {
      return await store.readCommittedByTransitionId(transitionId);
    }
    const bundles = store.getCommittedBundles?.() ?? [];
    for (let i = bundles.length - 1; i >= 0; i--) {
      const bundle = bundles[i] as AtomicCommitBundleV1;
      if (bundle.transition_id === transitionId) return bundle;
    }
    return null;
  }

  private async readCurrentCommitRef(subjectId: string): Promise<CanonicalRefV0 | null> {
    const store = this.ports.store as StoreReadSurface;
    if (typeof store.readCurrentCommitRef === "function") {
      return store.readCurrentCommitRef(subjectId) ?? null;
    }
    return store.readCurrentBundle?.(subjectId)?.commit_ref ?? null;
  }

  private rejected(errorCode: ErrorCode, reason: RequirementId, detail: string): CommitTransitionOutcome {
    return {
      kind: "REJECTED",
      failure: { error_code: errorCode, reason, detail }
    };
  }
}

/** Type-only re-export for facade consumers. */
export type { CommitTransitionOutcome };
