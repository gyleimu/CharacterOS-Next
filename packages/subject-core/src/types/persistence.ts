/**
 * P2.1.1 — Persistence port + bundle types (§8.5, §11, §15), types-only.
 * Source: docs/implementation/p2-1-contract-freeze.md §8.5, §11, §15.
 *
 * These are conceptual contracts; no store/DB selection and no persistence behavior.
 */

import type {
  HashV1,
  IdentifierV0,
  StateRevisionV0,
  TransitionIdV0
} from "./scalars.js";
import type { CanonicalRefV0 } from "./ref.js";
import type { TransitionType } from "./enums.js";
import type { SubjectStateV0 } from "./subject-state.js";
import type { TraceEntryV1, TraceWindowV1 } from "./trace.js";
import type { AuthoritativeTransitionRecordV1 } from "./identity.js";
import type { CanonicalCommitResultV1 } from "./result.js";

/** §8.5 RepositoryRevisionManifestV1 — owned by memory package. */
export interface RepositoryRevisionManifestV1 {
  readonly schema_version: "repository-revision-manifest-v1";
  readonly repository_revision: import("./scalars.js").RepositoryRevisionIdV0;
  readonly parent_revision: import("./scalars.js").RepositoryRevisionIdV0 | null;
  readonly record_hashes: readonly RepositoryRecordHashV1[];
  readonly index_manifest_hash: HashV1 | null;
}

export interface RepositoryRecordHashV1 {
  readonly ref: CanonicalRefV0;
  readonly payload_hash: HashV1;
}

/** §11 RepositoryRevisionBindingV1. */
export interface RepositoryRevisionBindingV1 {
  readonly repository_revision: import("./scalars.js").RepositoryRevisionIdV0;
  readonly repository_revision_hash: HashV1;
}

/** §11 PersistedSubjectEnvelopeV1 — the only accepted restore input. */
export interface PersistedSubjectEnvelopeV1 {
  readonly schema_version: "subject-persistence-envelope-v1";
  readonly serialization_version: "canonical-json-v1";
  readonly snapshot: SubjectStateV0;
  readonly full_snapshot_checksum: HashV1;
  readonly state_hash: HashV1;
  readonly snapshot_hash: HashV1;
  readonly repository_bindings: readonly RepositoryRevisionBindingV1[];
  readonly commit_head: CommitHeadV1 | null;
}

export interface CommitHeadV1 {
  readonly commit_ref: CanonicalRefV0;
  readonly record_checksum: HashV1;
}

/** §15.2 mutation-history linkage. */
export interface MutationHistoryLinkV1 {
  readonly history_sequence: number;
  readonly previous_trace_ref: CanonicalRefV0 | null;
  readonly current_trace_ref: CanonicalRefV0;
}

/** §15.2 AtomicCommitBundleV1 — the only canonical write authority payload. */
export interface AtomicCommitBundleV1 {
  readonly commit_version: "atomic-commit-v1";
  readonly serialization_version: "canonical-json-v1";
  readonly commit_ref: CanonicalRefV0;
  readonly subject_id: IdentifierV0;
  readonly transition_id: TransitionIdV0;
  readonly transition_type: TransitionType;
  readonly payload_fingerprint: HashV1;
  readonly prepared_result_ref: CanonicalRefV0;
  readonly expected_revision: StateRevisionV0;
  readonly next_revision: StateRevisionV0;
  readonly identity_record_version_before: number;
  readonly previous_commit_ref: CanonicalRefV0 | null;
  readonly previous_record_checksum: HashV1 | null;
  readonly next_snapshot: SubjectStateV0;
  readonly logical_time_before: import("./scalars.js").LogicalTimeV0;
  readonly logical_time_after: import("./scalars.js").LogicalTimeV0;
  readonly state_hash_before: HashV1;
  readonly state_hash_after: HashV1;
  readonly snapshot_hash_before: HashV1;
  readonly snapshot_hash_after: HashV1;
  readonly trace_entry: TraceEntryV1;
  readonly trace_window: TraceWindowV1;
  readonly mutation_history_link: MutationHistoryLinkV1;
  readonly transition_record: AuthoritativeTransitionRecordV1;
  readonly canonical_result: CanonicalCommitResultV1;
  readonly repository_revision_bindings: readonly RepositoryRevisionBindingV1[];
  readonly record_checksum: HashV1;
}

/** §15.2 AtomicCommitStore failure certainty. */
export type CommitFailureCertainty = "DEFINITE_NOT_COMMITTED" | "OUTCOME_UNKNOWN";

/** §15.2 AtomicCommitStore top-level conceptual outcomes. */
export type AtomicCommitOutcomeV1 =
  | { readonly outcome: "COMMITTED"; readonly bundle: AtomicCommitBundleV1 }
  | { readonly outcome: "CONFLICT" }
  | { readonly outcome: "FAILURE"; readonly certainty: CommitFailureCertainty };

/**
 * §15.1 Conceptual persistence ports (types-only, no implementation). These declare the
 * capability contract surface so that P2.1.2+ adapters can implement it without selecting
 * a store vendor here.
 */
export interface StateReaderPort {
  // P2.1.1 marker only: method signatures are finalized in the persistence adapter work.
}

export interface AtomicCommitStorePort {
  // P2.1.1 marker only: compare-and-commit semantics are frozen conceptually in §15.2.
}

export interface PublishSinkPort {
  // P2.1.1 marker only.
}

export interface ReferenceValidatorPort {
  // P2.1.1 marker only.
}
