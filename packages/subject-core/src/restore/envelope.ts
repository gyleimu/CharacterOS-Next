/**
 * P2.1.4 — PersistedSubjectEnvelopeV1 creation interface (pure, asynchronous).
 * Source: docs/implementation/p2-1-contract-freeze.md §11 (envelope contract),
 * §8.3–§8.4 (hash projections), §13.3 (restore error mapping).
 *
 * `createPersistenceEnvelope` is the only snapshot-creation surface: it takes an
 * already-authoritative immutable snapshot plus the exact repository revision binding
 * set owned by the memory capability boundary and computes the three integrity hashes.
 * Creation validates the same closed rules restore enforces (binding set equality,
 * ordering, commit-head rule) so a malformed envelope can never be minted here.
 * The result is deeply frozen evidence; nothing writes to disk or network.
 */

import type {
  CommitHeadV1,
  PersistedSubjectEnvelopeV1,
  RepositoryRevisionBindingV1
} from "../types/persistence.js";
import type { HashV1 } from "../types/scalars.js";
import type { SubjectStateV0 } from "../types/subject-state.js";
import { fail, ok, type ValidationResult } from "../validation/result.js";
import { validateHash, validateRefElement } from "../validation/scalars.js";
import {
  fullSnapshotChecksum,
  snapshotHash,
  stateHash
} from "../canonical/projections.js";
import { lastTraceRef } from "../trace/trace.js";

const MEM_REV_CODE = "INVALID_MEMORY_REVISION";
const MEM_REV_REASON = "MEM-REV-001";
const CHAIN_CODE = "COMMIT_CHAIN_INTEGRITY_FAILURE";
const CHAIN_REASON = "SS-RESTORE-001";

/**
 * §11: bindings are exactly the distinct set containing the snapshot's repository
 * revision and its non-null autobiographical index revision — sorted ascending,
 * unique, every hash well-formed. No unrelated revision may appear.
 */
export function validateRepositoryBindingSet(
  snapshot: SubjectStateV0,
  bindings: readonly RepositoryRevisionBindingV1[]
): ValidationResult<void> {
  if (!Array.isArray(bindings) || bindings.length === 0) {
    return fail(MEM_REV_CODE, MEM_REV_REASON, "repository_bindings must be a nonempty array");
  }
  const expected = new Set<string>([snapshot.memory_state.repository_revision]);
  const autobio = snapshot.memory_state.autobiographical_index_revision;
  if (autobio !== null) expected.add(autobio);

  let previous: string | undefined;
  for (const binding of bindings) {
    const hashCheck = validateHash(binding.repository_revision_hash, "repository_revision_hash");
    if (!hashCheck.ok) {
      return fail(MEM_REV_CODE, MEM_REV_REASON, `binding ${binding.repository_revision}: malformed hash`);
    }
    if (previous !== undefined && !(binding.repository_revision > previous)) {
      return fail(
        MEM_REV_CODE,
        MEM_REV_REASON,
        `bindings must be unique and sorted by repository_revision (${previous} -> ${binding.repository_revision})`
      );
    }
    if (!expected.has(binding.repository_revision)) {
      return fail(
        MEM_REV_CODE,
        MEM_REV_REASON,
        `unrelated binding ${binding.repository_revision} is not part of the snapshot revision set`
      );
    }
    previous = binding.repository_revision;
  }
  for (const id of expected) {
    if (!bindings.some((binding) => binding.repository_revision === id)) {
      return fail(MEM_REV_CODE, MEM_REV_REASON, `missing binding for ${id}`);
    }
  }
  return ok(undefined);
}

/** §11: commit_head is null for revision 0; otherwise a well-formed closed record. */
export function validateCommitHeadRule(
  snapshot: SubjectStateV0,
  commitHead: CommitHeadV1 | null
): ValidationResult<void> {
  if (snapshot.runtime_metadata.state_revision === 0) {
    if (commitHead !== null) {
      return fail(CHAIN_CODE, CHAIN_REASON, "commit_head must be null at revision 0");
    }
    return ok(undefined);
  }
  if (commitHead === null) {
    return fail(CHAIN_CODE, CHAIN_REASON, "commit_head is required after revision 0");
  }
  const refCheck = validateRefElement(commitHead.commit_ref, "commit_head.commit_ref", ["commit"]);
  if (!refCheck.ok) {
    return fail(CHAIN_CODE, CHAIN_REASON, "commit_head.commit_ref must be a commit ref");
  }
  const checksumCheck = validateHash(commitHead.record_checksum, "commit_head.record_checksum");
  if (!checksumCheck.ok) {
    return fail(CHAIN_CODE, CHAIN_REASON, "commit_head.record_checksum must be a HashV1");
  }
  return ok(undefined);
}

export interface CreatePersistenceEnvelopeInput {
  /** Authoritative immutable snapshot (already committed truth). */
  readonly snapshot: SubjectStateV0;
  readonly repository_bindings: readonly RepositoryRevisionBindingV1[];
  readonly commit_head?: CommitHeadV1 | null;
}

/**
 * Builds one closed PersistedSubjectEnvelopeV1 over the given snapshot: recomputes
 * full-checksum/StateHash/SnapshotHash, enforces the binding-set and commit-head
 * rules, and returns deeply frozen envelope bytes-equivalent evidence.
 */
export async function createPersistenceEnvelope(
  input: CreatePersistenceEnvelopeInput
): Promise<ValidationResult<PersistedSubjectEnvelopeV1>> {
  const snapshot = input.snapshot;

  const bindingsCheck = validateRepositoryBindingSet(snapshot, input.repository_bindings);
  if (!bindingsCheck.ok) return bindingsCheck;
  const headCheck = validateCommitHeadRule(snapshot, input.commit_head ?? null);
  if (!headCheck.ok) return headCheck;

  const checksum = await fullSnapshotChecksum(snapshot);
  const stateHashValue = await stateHash(snapshot);
  const snapshotHashValue = await snapshotHash({
    state_hash: stateHashValue,
    subject_id: snapshot.identity.subject_id,
    state_revision: snapshot.runtime_metadata.state_revision,
    trace_cursor: snapshot.trace_window.cursor,
    last_trace_ref: lastTraceRef(snapshot.trace_window)
  });

  const envelope: PersistedSubjectEnvelopeV1 = {
    schema_version: "subject-persistence-envelope-v1",
    serialization_version: "canonical-json-v1",
    snapshot,
    full_snapshot_checksum: checksum as HashV1,
    state_hash: stateHashValue,
    snapshot_hash: snapshotHashValue,
    repository_bindings: [...input.repository_bindings],
    commit_head: (input.commit_head ?? null) as CommitHeadV1 | null
  };
  deepFreeze(envelope);
  return ok(envelope);
}

function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  if (Object.isFrozen(value)) return;
  Object.freeze(value);
  for (const key of Object.keys(value as Record<string, unknown>)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
}
