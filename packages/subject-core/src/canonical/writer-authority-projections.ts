/**
 * Deterministic V2 authority/hash/ref/checksum projections
 * (ATOMIC_COMMIT_BUNDLE_V2_AUTHORITY_SCHEMA_FOUNDATION, LEVEL_2).
 *
 * PURE + NONCANONICAL: nothing here is wired into the production commit
 * engine, facade, store, or restore path. Uses ONLY the existing canonical
 * JSON / hashEnvelope / deriveRef primitives — no duplicate serializer.
 *
 * Forbidden inputs by construction: wall clock, randomness, environment,
 * host, filesystem, network, model output. Every function depends only on its
 * explicit arguments.
 */

import type { AtomicCommitBundleV2 } from "../types/persistence-v2.js";
import type { CanonicalWriterAuthorityRecordV0 } from "../types/writer-authority.js";
import type { HashV1, IdentifierV0, StateRevisionV0, TransitionIdV0 } from "../types/scalars.js";
import type { CanonicalRefV0 } from "../types/ref.js";
import type { TransitionType } from "../types/enums.js";
import { deriveRef, hashEnvelope } from "./hash.js";

/**
 * Authority-record hash namespace. The hash deterministically binds the
 * COMPLETE CanonicalWriterAuthorityRecordV0 body EXCLUDING
 * `authority_payload_hash` itself.
 */
export const WRITER_AUTHORITY_RECORD_PROJECTION =
  "characteros-next/subject-core/writer-authority-record/v1" as const;

/** V2 commit-id namespace (V1 keeps `characteros-next/subject-core/commit-id/v1`). */
export const COMMIT_ID_PROJECTION_V2 = "characteros-next/subject-core/commit-id/v2" as const;

/** V2 record-checksum namespace (V1 keeps `.../record-checksum/v1`). */
export const RECORD_CHECKSUM_PROJECTION_V2 =
  "characteros-next/atomic-commit/record-checksum/v2" as const;

/**
 * Role freeze: the authority payload hash is deterministic content integrity
 * and cross-binding material — it is NOT Level-3 authentication (no TPM, no
 * signatures, no keys, no remote anchor).
 */
export const V2_WRITER_AUTHORITY_PAYLOAD_HASH_ROLE =
  "INTEGRITY_AND_BINDING_NOT_LEVEL3_AUTHENTICATION" as const;

/**
 * Role freeze: the V2 record checksum covers the COMPLETE bundle record
 * (canonical_proposal, writer_authority incl. authority_payload, and every
 * V1-compatible field) — complete-record integrity, NOT independent
 * authentication.
 */
export const V2_RECORD_CHECKSUM_AUTHORITY_ROLE =
  "COMPLETE_RECORD_INTEGRITY_NOT_INDEPENDENT_AUTHENTICATION" as const;

/**
 * Deterministic hash over the writer-authority record body excluding
 * `authority_payload_hash` itself.
 */
export async function deriveWriterAuthorityPayloadHashV0(
  record: Omit<CanonicalWriterAuthorityRecordV0, "authority_payload_hash">
): Promise<HashV1> {
  return hashEnvelope(WRITER_AUTHORITY_RECORD_PROJECTION, record) as Promise<HashV1>;
}

export interface AtomicCommitRefV2Input {
  readonly commit_version: "atomic-commit-v2";
  readonly serialization_version: "canonical-json-v1";
  readonly proposal_ref: CanonicalRefV0;
  readonly payload_fingerprint: HashV1;
  readonly subject_id: IdentifierV0;
  readonly transition_id: TransitionIdV0;
  readonly transition_type: TransitionType;
  readonly expected_revision: StateRevisionV0;
  readonly next_revision: StateRevisionV0;
  readonly previous_commit_ref: CanonicalRefV0 | null;
  readonly previous_record_checksum: HashV1 | null;
  readonly state_hash_before: HashV1;
  readonly state_hash_after: HashV1;
  readonly snapshot_hash_before: HashV1;
  readonly snapshot_hash_after: HashV1;
  /** The canonical trace ref of this commit (existing trace projection). */
  readonly trace_ref: CanonicalRefV0;
  /** null for ordinary commits; the exact authority hash otherwise. */
  readonly writer_authority_payload_hash: HashV1 | null;
}

/**
 * Pure deterministic V2 commit-ref projection → `commit:<sha256>`.
 * trace_ref is an INPUT derived from the existing canonical trace projection
 * (`trace_entry.trace_id`); it is NOT a new bundle field.
 */
export async function deriveAtomicCommitRefV2(input: AtomicCommitRefV2Input): Promise<CanonicalRefV0> {
  return (await deriveRef("commit", COMMIT_ID_PROJECTION_V2, {
    commit_version: input.commit_version,
    serialization_version: input.serialization_version,
    proposal_ref: input.proposal_ref,
    payload_fingerprint: input.payload_fingerprint,
    subject_id: input.subject_id,
    transition_id: input.transition_id,
    transition_type: input.transition_type,
    expected_revision: input.expected_revision,
    next_revision: input.next_revision,
    previous_commit_ref: input.previous_commit_ref,
    previous_record_checksum: input.previous_record_checksum,
    state_hash_before: input.state_hash_before,
    state_hash_after: input.state_hash_after,
    snapshot_hash_before: input.snapshot_hash_before,
    snapshot_hash_after: input.snapshot_hash_after,
    trace_ref: input.trace_ref,
    writer_authority_payload_hash: input.writer_authority_payload_hash
  })) as CanonicalRefV0;
}

/**
 * Deterministic V2 record checksum over the COMPLETE AtomicCommitBundleV2
 * excluding `record_checksum` itself — covering canonical_proposal,
 * writer_authority (including authority_payload) and every V1-compatible
 * field.
 */
export async function deriveAtomicCommitRecordChecksumV2(
  bundle: Omit<AtomicCommitBundleV2, "record_checksum">
): Promise<HashV1> {
  return hashEnvelope(RECORD_CHECKSUM_PROJECTION_V2, bundle) as Promise<HashV1>;
}
