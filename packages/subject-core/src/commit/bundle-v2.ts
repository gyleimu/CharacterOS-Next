/**
 * AtomicCommitBundleV2 production assembler (V0)
 * (ATOMIC_COMMIT_BUNDLE_V2_PRODUCTION_EMISSION_V0).
 *
 * DIRECT V2 assembly — the production commit path NEVER assembles a V1 bundle
 * and mutates/lifts it into V2. The assembler consumes the SAME finalized
 * canonical transition effect and the exact stable validated
 * CanonicalTransitionProposalV1 used by the shared prepare/finalize pipeline,
 * and follows the frozen V2 projection order:
 *
 *   proposal_ref + payload_fingerprint
 *   → writer_authority = null (internally fixed; no caller parameter)
 *   → derive V2 commit_ref
 *   → CanonicalCommitResultV1 using the V2 commit_ref → result_ref
 *   → committed attempt → AuthoritativeTransitionRecordV1
 *   → exact 29-field V2 bundle → V2 record_checksum → deep freeze
 *
 * Uses ONLY the frozen V2 projections (deriveAtomicCommitRefV2 /
 * deriveAtomicCommitRecordChecksumV2). Pure: no store, no clock, no caller
 * writer authority (ORDINARY_PRODUCTION_V2_WRITER_AUTHORITY = NULL).
 */

import type { AtomicCommitBundleV2 } from "../types/persistence-v2.js";
import type { CanonicalCommitResultV1 } from "../types/result.js";
import type { CanonicalWriterAuthorityRecordV0 } from "../types/writer-authority.js";
import type { AuthoritativeTransitionRecordV1, TransitionAttemptV1 } from "../types/identity.js";
import type { HashV1, HistorySequenceV0, StateRevisionV0 } from "../types/scalars.js";
import type { CanonicalRefV0 } from "../types/ref.js";
import type { SubjectStateV0 } from "../types/subject-state.js";
import type { TraceEntryV1 } from "../types/trace.js";
import type { CanonicalTransitionProposalV1 } from "../types/transition.js";
import type { RepositoryRevisionBindingV1 } from "../types/persistence.js";
import { deriveRef } from "../canonical/hash.js";
import { proposalFingerprint, proposalRef } from "../canonical/projections.js";
import {
  deriveAtomicCommitRefV2,
  deriveAtomicCommitRecordChecksumV2,
  deriveWriterAuthorityPayloadHashV0
} from "../canonical/writer-authority-projections.js";
import {
  verifyPreparedGovernedWriterAuthorityTokenV0,
  type PreparedGovernedWriterAuthorityTokenV0
} from "./writer-authority-membrane.js";

export interface AssembleCommitBundleV2Input {
  /** Exact stable validated canonical proposal (ONE snapshot for the whole pipeline). */
  readonly proposal: CanonicalTransitionProposalV1;
  /** Authoritative current snapshot (trusted read). */
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
  /** lastTraceRef(predecessor.trace_window) — mutation-history continuity. */
  readonly previous_trace_ref: CanonicalRefV0 | null;
  /** Trusted `workflow:` ref minted outside subject-core (§7.6 binding). */
  readonly prepared_result_ref: CanonicalRefV0;
  readonly repository_revision_bindings: readonly RepositoryRevisionBindingV1[];
  /**
   * Governed path ONLY (RELATIONSHIP_GOVERNED_FEATURE_WRITER_AUTHORITY_V0):
   * a SubjectCore-issued, WeakSet-admitted prepared authority token. Absent /
   * undefined → the ordinary path: writer_authority = null with EXACTLY the
   * frozen ordinary byte output. A raw CanonicalWriterAuthorityRecordV0 input
   * is forbidden by construction — the record is materialized HERE from the
   * verified token with the frozen record projection.
   */
  readonly writer_authority_token?: PreparedGovernedWriterAuthorityTokenV0;
}

const RESULT_ID_PROJECTION = "characteros-next/subject-core/result-id/v1";

function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  if (Object.isFrozen(value)) return;
  Object.freeze(value);
  for (const key of Object.keys(value as Record<string, unknown>)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
}

/**
 * Assembles one complete, closed, deeply frozen AtomicCommitBundleV2 with
 * `writer_authority = null` (ordinary production commit; caller-supplied
 * writer authority is impossible by construction).
 */
export async function assembleCommitBundleV2(
  input: AssembleCommitBundleV2Input
): Promise<AtomicCommitBundleV2> {
  const p = input.proposal;
  const pref = await proposalRef(p);
  const payloadFingerprint = await proposalFingerprint(p);

  // Governed path: materialize the EXACT durable record from the verified
  // internal token. Ordinary path: null (byte-identical to the frozen
  // pre-membrane production output). Raw record input is impossible here.
  let writerAuthority: CanonicalWriterAuthorityRecordV0 | null = null;
  let writerAuthorityPayloadHash: HashV1 | null = null;
  if (input.writer_authority_token !== undefined) {
    const admission = verifyPreparedGovernedWriterAuthorityTokenV0(input.writer_authority_token);
    if (!admission.ok) {
      throw new Error(`assembleCommitBundleV2: prepared authority token rejected (${admission.code})`);
    }
    const token = admission.token;
    if (token.proposal_ref !== pref || token.payload_fingerprint !== payloadFingerprint) {
      throw new Error("assembleCommitBundleV2: prepared authority token does not bind the exact proposal");
    }
    const recordBody: Omit<CanonicalWriterAuthorityRecordV0, "authority_payload_hash"> = {
      schema_version: "canonical-writer-authority-record-v0",
      proposal_ref: token.proposal_ref,
      payload_fingerprint: token.payload_fingerprint,
      writer_family: token.writer_family,
      writer_class: token.writer_class,
      writer_schema_id: token.writer_schema_id,
      writer_schema_fingerprint: token.writer_schema_fingerprint,
      authorization_gate_id: token.authorization_gate_id,
      authorization_gate_fingerprint: token.authorization_gate_fingerprint,
      authority_payload: token.authority_payload
    };
    writerAuthorityPayloadHash = await deriveWriterAuthorityPayloadHashV0(recordBody);
    writerAuthority = { ...recordBody, authority_payload_hash: writerAuthorityPayloadHash };
  }

  const commitRef = await deriveAtomicCommitRefV2({
    commit_version: "atomic-commit-v2",
    serialization_version: "canonical-json-v1",
    proposal_ref: pref,
    payload_fingerprint: payloadFingerprint,
    subject_id: p.subject_id,
    transition_id: p.transition_id,
    transition_type: p.transition_type,
    expected_revision: input.expected_revision,
    next_revision: input.next_revision,
    previous_commit_ref: input.previous_commit_ref,
    previous_record_checksum: input.previous_record_checksum,
    state_hash_before: input.state_hash_before,
    state_hash_after: input.state_hash_after,
    snapshot_hash_before: input.snapshot_hash_before,
    snapshot_hash_after: input.snapshot_hash_after,
    trace_ref: input.trace_entry.trace_id,
    writer_authority_payload_hash: writerAuthorityPayloadHash
  });

  const resultBody = {
    schema_version: "canonical-commit-result-v1" as const,
    status: "COMMITTED" as const,
    transition_id: p.transition_id,
    subject_id: p.subject_id,
    payload_fingerprint: payloadFingerprint,
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
    proposal_ref: pref,
    payload_fingerprint: canonicalResult.payload_fingerprint,
    fingerprint_version: "proposal-fingerprint-v1",
    first_seen_sequence: input.first_seen_sequence,
    attempts: [...input.prior_attempts, committedAttempt],
    reuse_conflicts: [],
    terminal_status: "COMMITTED",
    terminal_result_ref: canonicalResult.result_ref
  };

  const partial: Omit<AtomicCommitBundleV2, "record_checksum"> = {
    commit_version: "atomic-commit-v2",
    serialization_version: "canonical-json-v1",
    canonical_proposal: p,
    writer_authority: writerAuthority,
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
      history_sequence: input.next_revision as unknown as HistorySequenceV0,
      previous_trace_ref: input.previous_trace_ref,
      current_trace_ref: input.trace_entry.trace_id
    },
  transition_record: transitionRecord,
    canonical_result: canonicalResult,
    repository_revision_bindings: [...input.repository_revision_bindings]
  };

  const bundle: AtomicCommitBundleV2 = {
    ...partial,
    record_checksum: await deriveAtomicCommitRecordChecksumV2(partial)
  };
  deepFreeze(bundle);
  return bundle;
}
