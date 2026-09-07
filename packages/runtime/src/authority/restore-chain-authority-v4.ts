/**
 * Explicit SubjectStateV4 authoritative restore.
 *
 * Positive revisions are admitted only through the opaque explicit-v4 genesis
 * boundary plus the complete V2 history replayed by the shared chain
 * validator. This module never runs dynamics, providers, appraisal, migration,
 * repair, or catch-up time.
 */

import {
  canonicalJsonString,
  fullSnapshotChecksumAnyVersion,
  lastTraceRef,
  snapshotHashAnyVersion,
  stateHashAnyVersion,
  validateSubjectStateV4,
  type HashV1,
  type RepositoryRevisionBindingV1,
  type SubjectStateV4,
  type V4PersistenceEnvelopeV0
} from "@characteros-next/subject-core";
import { validateAtomicCommitChainV0 } from "./atomic-commit-chain-validator.js";
import {
  isTrustedCanonicalHistoryBoundaryReceiptV0,
  validateTrustedCanonicalHeadInputV0,
  type TrustedCanonicalHeadInputV0,
  type TrustedCanonicalHistoryBoundaryReceiptV0
} from "./trusted-canonical-history-boundary.js";

export const SUBJECT_STATE_V4_AUTHORITATIVE_RESTORE_ENVELOPE_SCHEMA_VERSION_V0 =
  "subject-state-v4-authoritative-restore-envelope-v0" as const;

export interface SubjectStateV4AuthoritativeRestoreEnvelopeV0 {
  readonly schema_version: typeof SUBJECT_STATE_V4_AUTHORITATIVE_RESTORE_ENVELOPE_SCHEMA_VERSION_V0;
  readonly serialization_version: "canonical-json-v1";
  readonly snapshot: SubjectStateV4;
  readonly full_snapshot_checksum: HashV1;
  readonly state_hash: HashV1;
  readonly snapshot_hash: HashV1;
  readonly commit_head: TrustedCanonicalHeadInputV0;
  readonly repository_binding: RepositoryRevisionBindingV1;
}

export type RestoreSubjectStateV4AuthoritativelyFailureCodeV0 =
  | "UNTRUSTED_BOUNDARY"
  | "INVALID_ENVELOPE"
  | "INVALID_SNAPSHOT"
  | "FULL_CHECKSUM_MISMATCH"
  | "STATE_HASH_MISMATCH"
  | "SNAPSHOT_HASH_MISMATCH"
  | "HEAD_MISMATCH"
  | "V4_CHAIN_INVALID"
  | "FINAL_SNAPSHOT_MISMATCH"
  | "REPOSITORY_BINDING_INVALID";

export type RestoreSubjectStateV4AuthoritativelyResultV0 =
  | { readonly kind: "RESTORED"; readonly snapshot: SubjectStateV4 }
  | {
      readonly kind: "REJECTED";
      readonly code: RestoreSubjectStateV4AuthoritativelyFailureCodeV0;
      readonly detail: string;
    };

function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return;
  Object.freeze(value);
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
}

function exactKeys(value: object, expected: readonly string[]): boolean {
  const keys = Object.keys(value).sort();
  const sorted = [...expected].sort();
  return keys.length === sorted.length && keys.every((key, index) => key === sorted[index]);
}

export async function createSubjectStateV4AuthoritativeRestoreEnvelopeV0(input: {
  readonly snapshot: SubjectStateV4;
  readonly commit_head: TrustedCanonicalHeadInputV0;
  readonly repository_binding: RepositoryRevisionBindingV1;
}): Promise<SubjectStateV4AuthoritativeRestoreEnvelopeV0> {
  const checked = validateSubjectStateV4(input.snapshot);
  if (!checked.ok) throw new Error(`cannot export invalid v4 snapshot: ${checked.error.detail}`);
  const stateHash = await stateHashAnyVersion(checked.value);
  const snapshotHash = await snapshotHashAnyVersion(checked.value, {
    state_hash: stateHash,
    subject_id: checked.value.identity.subject_id,
    state_revision: checked.value.runtime_metadata.state_revision,
    trace_cursor: checked.value.trace_window.cursor,
    last_trace_ref: lastTraceRef(checked.value.trace_window)
  });
  const fullChecksum = await fullSnapshotChecksumAnyVersion(checked.value);
  if (
    input.commit_head.subject_id !== checked.value.identity.subject_id ||
    input.commit_head.revision !== checked.value.runtime_metadata.state_revision ||
    input.commit_head.state_hash !== stateHash ||
    input.commit_head.snapshot_hash !== snapshotHash
  ) {
    throw new Error("cannot export v4 envelope: commit head does not bind the exact snapshot");
  }
  const envelope: SubjectStateV4AuthoritativeRestoreEnvelopeV0 = {
    schema_version: SUBJECT_STATE_V4_AUTHORITATIVE_RESTORE_ENVELOPE_SCHEMA_VERSION_V0,
    serialization_version: "canonical-json-v1",
    snapshot: checked.value,
    full_snapshot_checksum: fullChecksum,
    state_hash: stateHash,
    snapshot_hash: snapshotHash,
    commit_head: input.commit_head,
    repository_binding: input.repository_binding
  };
  deepFreeze(envelope);
  return envelope;
}

export async function restoreSubjectStateV4AuthoritativelyV0(input: {
  readonly envelope: SubjectStateV4AuthoritativeRestoreEnvelopeV0;
  readonly trusted_boundary: TrustedCanonicalHistoryBoundaryReceiptV0<V4PersistenceEnvelopeV0>;
  readonly bundles: readonly unknown[];
  readonly reference_validator: (
    binding: RepositoryRevisionBindingV1
  ) => boolean | Promise<boolean>;
}): Promise<RestoreSubjectStateV4AuthoritativelyResultV0> {
  const reject = (
    code: RestoreSubjectStateV4AuthoritativelyFailureCodeV0,
    detail: string
  ): RestoreSubjectStateV4AuthoritativelyResultV0 => ({ kind: "REJECTED", code, detail });

  if (!isTrustedCanonicalHistoryBoundaryReceiptV0(input.trusted_boundary)) {
    return reject("UNTRUSTED_BOUNDARY", "v4 restore boundary was not minted by the trusted issuer");
  }
  if (input.trusted_boundary.genesis.snapshot.schema_version !== "subject-state-v4") {
    return reject("UNTRUSTED_BOUNDARY", "v4 restore requires an explicit subject-state-v4 genesis boundary");
  }
  const envelope = input.envelope;
  if (
    typeof envelope !== "object" ||
    envelope === null ||
    !exactKeys(envelope, [
      "schema_version",
      "serialization_version",
      "snapshot",
      "full_snapshot_checksum",
      "state_hash",
      "snapshot_hash",
      "commit_head",
      "repository_binding"
    ]) ||
    envelope.schema_version !== SUBJECT_STATE_V4_AUTHORITATIVE_RESTORE_ENVELOPE_SCHEMA_VERSION_V0 ||
    envelope.serialization_version !== "canonical-json-v1"
  ) {
    return reject("INVALID_ENVELOPE", "v4 authoritative restore envelope has an invalid closed shape");
  }
  const checked = validateSubjectStateV4(envelope.snapshot);
  if (!checked.ok) return reject("INVALID_SNAPSHOT", checked.error.detail);
  const snapshot = checked.value;
  const fullChecksum = await fullSnapshotChecksumAnyVersion(snapshot);
  if (fullChecksum !== envelope.full_snapshot_checksum) {
    return reject("FULL_CHECKSUM_MISMATCH", "v4 full snapshot checksum does not recompute");
  }
  const stateHash = await stateHashAnyVersion(snapshot);
  if (stateHash !== envelope.state_hash) {
    return reject("STATE_HASH_MISMATCH", "v4 state hash does not recompute");
  }
  const snapshotHash = await snapshotHashAnyVersion(snapshot, {
    state_hash: stateHash,
    subject_id: snapshot.identity.subject_id,
    state_revision: snapshot.runtime_metadata.state_revision,
    trace_cursor: snapshot.trace_window.cursor,
    last_trace_ref: lastTraceRef(snapshot.trace_window)
  });
  if (snapshotHash !== envelope.snapshot_hash) {
    return reject("SNAPSHOT_HASH_MISMATCH", "v4 snapshot hash does not recompute");
  }
  const headCheck = validateTrustedCanonicalHeadInputV0(envelope.commit_head);
  if (!headCheck.ok) return reject("HEAD_MISMATCH", headCheck.error.detail);
  if (canonicalJsonString(envelope.commit_head) !== canonicalJsonString(input.trusted_boundary.head)) {
    return reject("HEAD_MISMATCH", "restore envelope head is not the exact trusted boundary head");
  }
  if (
    envelope.commit_head.subject_id !== snapshot.identity.subject_id ||
    envelope.commit_head.revision !== snapshot.runtime_metadata.state_revision ||
    envelope.commit_head.state_hash !== stateHash ||
    envelope.commit_head.snapshot_hash !== snapshotHash
  ) {
    return reject("HEAD_MISMATCH", "restore envelope head does not bind the exact v4 snapshot");
  }

  const chain = await validateAtomicCommitChainV0({
    trusted_boundary: input.trusted_boundary,
    bundles: input.bundles
  });
  if (chain.kind !== "VALID") {
    return reject("V4_CHAIN_INVALID", `${chain.failure.code}: ${chain.failure.detail}`);
  }
  if (
    chain.receipt.bundle_count !== snapshot.runtime_metadata.state_revision ||
    chain.receipt.v1_bundle_count !== 0 ||
    chain.receipt.v2_bundle_count !== chain.receipt.bundle_count
  ) {
    return reject("V4_CHAIN_INVALID", "v4 restore requires the complete all-V2 history from revision zero");
  }
  if (snapshot.runtime_metadata.state_revision > 0) {
    const terminal = input.bundles[input.bundles.length - 1] as {
      readonly next_snapshot?: unknown;
      readonly repository_revision_bindings?: readonly RepositoryRevisionBindingV1[];
    } | undefined;
    if (terminal === undefined || canonicalJsonString(terminal.next_snapshot) !== canonicalJsonString(snapshot)) {
      return reject("FINAL_SNAPSHOT_MISMATCH", "terminal bundle successor is not the exact restore snapshot");
    }
    if (
      !terminal.repository_revision_bindings?.some(
        (binding) =>
          binding.repository_revision === envelope.repository_binding.repository_revision &&
          binding.repository_revision_hash === envelope.repository_binding.repository_revision_hash
      )
    ) {
      return reject("REPOSITORY_BINDING_INVALID", "terminal bundle lacks the exact restore repository binding");
    }
  }
  if (
    envelope.repository_binding.repository_revision !== snapshot.memory_state.repository_revision ||
    await input.reference_validator(envelope.repository_binding) !== true
  ) {
    return reject("REPOSITORY_BINDING_INVALID", "restore repository binding is not authoritative for the snapshot");
  }

  const restored = structuredClone(snapshot);
  deepFreeze(restored);
  return { kind: "RESTORED", snapshot: restored };
}
