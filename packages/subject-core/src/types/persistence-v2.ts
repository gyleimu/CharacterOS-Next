/**
 * AtomicCommitBundleV2 — versioned persistence type ADD-ONLY companion to the
 * frozen AtomicCommitBundleV1 (§15.2)
 * (ATOMIC_COMMIT_BUNDLE_BUNDLE_V2_AUTHORITY_SCHEMA_FOUNDATION, LEVEL_2).
 *
 * ATOMIC_COMMIT_BUNDLE_V1_SCHEMA_CHANGED = NO: `types/persistence.ts` is not
 * modified by this module. V2 is a distinct closed record that durably
 * preserves, for later CharacterOS-owned validators:
 *   - the complete canonical proposal            (`canonical_proposal`)
 *   - the generic writer-authority envelope      (`writer_authority`)
 * alongside every V1-compatible field with identical semantics.
 *
 * V2_WRITER_AUTHORITY_PAYLOAD_HASH_ROLE =
 *   INTEGRITY_AND_BINDING_NOT_LEVEL3_AUTHENTICATION (no TPM / signatures / keys).
 * This is a SCHEMA FOUNDATION only: nothing in this module is wired into the
 * production commit engine, facade, store, or restore path, and V2 is NOT the
 * default emitted bundle.
 */

import type { AtomicCommitBundleV1, RepositoryRevisionBindingV1 } from "./persistence.js";
import type { CanonicalCommitResultV1 } from "./result.js";
import type { AuthoritativeTransitionRecordV1 } from "./identity.js";
import type { HashV1, IdentifierV0, LogicalTimeV0, StateRevisionV0, TransitionIdV0 } from "./scalars.js";
import type { CanonicalRefV0 } from "./ref.js";
import type { TransitionType } from "./enums.js";
import type { SubjectStateV0 } from "./subject-state.js";
import type { TraceEntryV1, TraceWindowV1 } from "./trace.js";
import type { MutationHistoryLinkV1 } from "./persistence.js";
import type { CanonicalTransitionProposalV1 } from "./transition.js";
import type { CanonicalWriterAuthorityRecordV0 } from "./writer-authority.js";

/**
 * §15.2 successor — AtomicCommitBundleV2. Exact 29 top-level fields, every
 * field required, no optional fields. `writer_authority` is null for ordinary
 * commits; a non-null record is durable EVIDENCE, never by itself a production
 * authorization.
 */
export interface AtomicCommitBundleV2 {
  readonly commit_version: "atomic-commit-v2";
  readonly serialization_version: "canonical-json-v1";

  /** Complete canonical proposal — REQUIRED for every V2 commit. */
  readonly canonical_proposal: CanonicalTransitionProposalV1;
  /** Generic durable writer-authority envelope; null for ordinary commits. */
  readonly writer_authority: CanonicalWriterAuthorityRecordV0 | null;

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
  readonly logical_time_before: LogicalTimeV0;
  readonly logical_time_after: LogicalTimeV0;
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

/** Version-discriminated union over persisted atomic commit bundles. */
export type AtomicCommitBundleAnyVersion = AtomicCommitBundleV1 | AtomicCommitBundleV2;

/** Exact bundle-version literals recognized by the closed validators. */
export const ATOMIC_COMMIT_BUNDLE_VERSIONS_V0 = Object.freeze([
  "atomic-commit-v1",
  "atomic-commit-v2"
] as const);

export type AtomicCommitBundleVersionV0 = (typeof ATOMIC_COMMIT_BUNDLE_VERSIONS_V0)[number];
