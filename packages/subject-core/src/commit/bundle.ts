/**
 * P2.1.3 — AtomicCommitBundleV1 assembly (pure, asynchronous).
 * Source: docs/implementation/p2-1-contract-freeze.md §14.2–§14.4, §15.2.
 *
 * Assembles the complete closed bundle: deterministic commit/result refs (§14.4), the
 * terminal-COMMITTED authoritative transition record successor, mutation-history
 * linkage and the record checksum over `{projection,value:BUNDLE_WITHOUT_CHECKSUM}` in
 * JCS. Every input must already satisfy the engine's semantic guards; assembly adds
 * the §15.2 cross-field equalities by construction. Output is deeply frozen — a
 * bundle is immutable evidence once assembled.
 */

import type {
  AtomicCommitBundleV1,
  RepositoryRevisionBindingV1
} from "../types/persistence.js";
import type { CanonicalCommitResultV1 } from "../types/result.js";
import type { AuthoritativeTransitionRecordV1, TransitionAttemptV1 } from "../types/identity.js";
import type { HashV1, HistorySequenceV0, StateRevisionV0 } from "../types/scalars.js";
import type { CanonicalRefV0 } from "../types/ref.js";
import type { SubjectStateV0 } from "../types/subject-state.js";
import type { TraceEntryV1 } from "../types/trace.js";
import type { CanonicalTransitionProposalV1 } from "../types/transition.js";
import { deriveRef, hashEnvelope } from "../canonical/hash.js";
import { proposalFingerprint, proposalRef } from "../canonical/projections.js";
import { lastTraceRef } from "../trace/trace.js";

const COMMIT_ID_PROJECTION = "characteros-next/subject-core/commit-id/v1";
const RESULT_ID_PROJECTION = "characteros-next/subject-core/result-id/v1";
const RECORD_CHECKSUM_PROJECTION = "characteros-next/atomic-commit/record-checksum/v1";

export interface AssembleBundleInput {
  readonly proposal: CanonicalTransitionProposalV1;
  readonly currentState: SubjectStateV0;
  /** Final candidate including the projected trace_window; deeply frozen by caller. */
  readonly candidate: SubjectStateV0;
  readonly state_hash_before: HashV1;
  readonly state_hash_after: HashV1;
  readonly snapshot_hash_before: HashV1;
  readonly snapshot_hash_after: HashV1;
  readonly trace_entry: TraceEntryV1;
  readonly expected_revision: StateRevisionV0;
  readonly next_revision: StateRevisionV0;
  readonly identity_record_version_before: number;
  readonly first_seen_sequence: HistorySequenceV0;
  readonly prior_attempts: readonly TransitionAttemptV1[];
  readonly previous_commit_ref: CanonicalRefV0 | null;
  readonly previous_record_checksum: HashV1 | null;
  /** Trusted `workflow:` ref minted outside subject-core (§7.6 binding). */
  readonly prepared_result_ref: CanonicalRefV0;
  readonly repository_revision_bindings: readonly RepositoryRevisionBindingV1[];
}

function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  if (Object.isFrozen(value)) return;
  Object.freeze(value);
  for (const key of Object.keys(value as Record<string, unknown>)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
}

/** Assembles one complete AtomicCommitBundleV1 (§15.2). */
export async function assembleCommitBundle(input: AssembleBundleInput): Promise<AtomicCommitBundleV1> {
  const p = input.proposal;
  const commitRef = (await deriveRef("commit", COMMIT_ID_PROJECTION, {
    subject_id: p.subject_id,
    transition_id: p.transition_id,
    transition_type: p.transition_type,
    next_revision: input.next_revision,
    state_hash_after: input.state_hash_after,
    snapshot_hash_after: input.snapshot_hash_after,
    trace_ref: input.trace_entry.trace_id,
    previous_commit_ref: input.previous_commit_ref
  })) as CanonicalRefV0;

  const resultBody = {
    schema_version: "canonical-commit-result-v1" as const,
    status: "COMMITTED" as const,
    transition_id: p.transition_id,
    subject_id: p.subject_id,
    payload_fingerprint: await proposalFingerprint(p),
    previous_revision: input.expected_revision,
    next_revision: input.next_revision,
    state_hash_before: input.state_hash_before,
    state_hash_after: input.state_hash_after,
    snapshot_hash_after: input.snapshot_hash_after,
    trace_ref: input.trace_entry.trace_id,
    commit_ref: commitRef
  };
  const canonicalResult = {
    ...resultBody,
    result_ref: (await deriveRef("result", RESULT_ID_PROJECTION, resultBody)) as CanonicalRefV0
  } as CanonicalCommitResultV1;

  const committedAttempt: TransitionAttemptV1 = {
    attempt_sequence: input.prior_attempts.length + 1,
    status: "COMMITTED",
    revision_before: input.expected_revision,
    revision_after: input.next_revision,
    state_hash_before: input.state_hash_before,
    state_hash_after: input.state_hash_after,
    result_ref: canonicalResult.result_ref,
    prepared_result_ref: input.prepared_result_ref,
    trace_ref: input.trace_entry.trace_id,
    audit_ref: null,
    error_code: null,
    reason: null
  };

  const transitionRecord: AuthoritativeTransitionRecordV1 = {
    schema_version: "transition-record-v1",
    record_version: input.identity_record_version_before + 1,
    transition_id: p.transition_id,
    subject_id: p.subject_id,
    transition_type: p.transition_type,
    proposal_ref: await proposalRef(p),
    payload_fingerprint: canonicalResult.payload_fingerprint,
    fingerprint_version: "proposal-fingerprint-v1",
    first_seen_sequence: input.first_seen_sequence,
    attempts: [...input.prior_attempts, committedAttempt],
    reuse_conflicts: [],
    terminal_status: "COMMITTED",
    terminal_result_ref: canonicalResult.result_ref
  };

  const partial: Omit<AtomicCommitBundleV1, "record_checksum"> = {
    commit_version: "atomic-commit-v1",
    serialization_version: "canonical-json-v1",
    commit_ref: commitRef,
    subject_id: p.subject_id,
    transition_id: p.transition_id,
    transition_type: p.transition_type,
    payload_fingerprint: canonicalResult.payload_fingerprint,
    prepared_result_ref: input.prepared_result_ref,
    expected_revision: input.expected_revision,
    next_revision: input.next_revision,
    identity_record_version_before: input.identity_record_version_before,
    previous_commit_ref: input.previous_commit_ref,
    previous_record_checksum: input.previous_record_checksum,
    next_snapshot: input.candidate,
    logical_time_before: input.currentState.runtime_metadata.logical_time,
    logical_time_after: input.candidate.runtime_metadata.logical_time,
    state_hash_before: input.state_hash_before,
    state_hash_after: input.state_hash_after,
    snapshot_hash_before: input.snapshot_hash_before,
    snapshot_hash_after: input.snapshot_hash_after,
    trace_entry: input.trace_entry,
    trace_window: input.candidate.trace_window,
    mutation_history_link: {
      // §15.2 equality 7: link sequence equals next revision under V0 branding.
      history_sequence: input.next_revision as unknown as HistorySequenceV0,
      previous_trace_ref: lastTraceRef(input.currentState.trace_window),
      current_trace_ref: input.trace_entry.trace_id
    },
    transition_record: transitionRecord,
    canonical_result: canonicalResult,
    repository_revision_bindings: [...input.repository_revision_bindings]
  };

  const bundle: AtomicCommitBundleV1 = {
    ...partial,
    record_checksum: (await hashEnvelope(RECORD_CHECKSUM_PROJECTION, partial)) as HashV1
  };
  deepFreeze(bundle);
  return bundle;
}
