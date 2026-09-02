/**
 * Closed single-record AtomicCommitBundle validators (V1 + V2), the
 * version-dispatch entry point, and the pure version-step policy primitive
 * (ATOMIC_COMMIT_BUNDLE_V2_AUTHORITY_SCHEMA_FOUNDATION, LEVEL_2).
 *
 * Scope freeze:
 *   - Each validator validates EXACTLY ONE bundle record starting from
 *     `unknown` — this is NOT the full chain validator (chain linking,
 *     predecessor snapshots, and proposal application belong to
 *     CHARACTEROS_ATOMIC_COMMIT_CHAIN_VALIDATOR_V0).
 *   - V1 hash/ref semantics are byte-for-byte the existing frozen V1 behavior:
 *     the V1 commit ref, canonical result ref, state/snapshot hash bindings
 *     and record checksum are RECOMPUTED with the exact V1 projections.
 *   - V1 does NOT persist the canonical proposal, so V1 `proposal_ref` /
 *     `payload_fingerprint` are format-validated only (V2 persists the full
 *     proposal and therefore recomputes both).
 *   - validateAtomicCommitBundleV2 proves exact shape + deterministic internal
 *     integrity + canonical cross-bindings available inside the record.
 *     V2_BUNDLE_STRUCTURALLY_VALID != GOVERNED_WRITER_AUTHORIZED: no authority
 *     capability is minted here and no current feature registry is consulted
 *     (V2_BUNDLE_VALIDATOR_REQUIRES_CURRENT_RELATIONSHIP_FEATURE_REGISTRY =
 *     NO). Family-specific payload semantics are validated by the family-owned
 *     validator in its owning package.
 *
 * No normalization, no defaults, no extra-key stripping, no implicit upcast.
 */

import { deriveRef, hashEnvelope } from "../canonical/hash.js";
import {
  proposalFingerprint,
  proposalRef,
  snapshotHash,
  stateHash
} from "../canonical/projections.js";
import {
  deriveAtomicCommitRecordChecksumV2,
  deriveAtomicCommitRefV2,
  deriveWriterAuthorityPayloadHashV0
} from "../canonical/writer-authority-projections.js";
import type { CanonicalWriterAuthorityRecordV0 } from "../types/writer-authority.js";
import type {
  AtomicCommitBundleAnyVersion,
  AtomicCommitBundleV2
} from "../types/persistence-v2.js";
import { ATOMIC_COMMIT_BUNDLE_VERSIONS_V0 } from "../types/persistence-v2.js";
import type { AtomicCommitBundleV1, RepositoryRevisionBindingV1 } from "../types/persistence.js";
import type { CanonicalCommitResultV1 } from "../types/result.js";
import type {
  AuthoritativeTransitionRecordV1,
  TransitionAttemptV1
} from "../types/identity.js";
import type { TraceEntryV1, TraceWindowV1 } from "../types/trace.js";
import type { TransitionType } from "../types/enums.js";
import type { SubjectStateV0 } from "../types/subject-state.js";
import type { HashV1, StateRevisionV0 } from "../types/scalars.js";
import type { IdentifierV0, TransitionIdV0, HistorySequenceV0 } from "../types/scalars.js";
import type { CanonicalRefV0 } from "../types/ref.js";
import { fail, ok, type ValidationResult } from "./result.js";
import { isRecord, isString, validateHash, validateIdentifier, validateLogicalTime, validateRefElement, validateStateRevision } from "./scalars.js";
import { validateProposal } from "./proposal.js";
import { validateSubjectState } from "./subject-state.js";
import { lastTraceRef } from "../trace/trace.js";
import {
  bundleClosedKeys,
  bundleLit,
  bundleOptionalHash,
  bundleOptionalRef,
  bundleSafeInteger,
  validateCanonicalResultShape,
  validateMutationHistoryLinkShape,
  validateRepositoryBindings,
  validateTraceEntryShape,
  validateTraceWindowShape,
  validateTransitionRecordShape,
  validateWriterAuthorityShape
} from "./atomic-commit-bundle-shapes.js";

const SCHEMA = "SS-SCHEMA-001";

/** Frozen V1 projection literals (byte-identical to the V1 assembler). */
const COMMIT_ID_PROJECTION_V1 = "characteros-next/subject-core/commit-id/v1";
const RESULT_ID_PROJECTION_V1 = "characteros-next/subject-core/result-id/v1";
const RECORD_CHECKSUM_PROJECTION_V1 = "characteros-next/atomic-commit/record-checksum/v1";

const V1_BUNDLE_KEYS: readonly string[] = [
  "commit_version",
  "serialization_version",
  "commit_ref",
  "subject_id",
  "transition_id",
  "transition_type",
  "payload_fingerprint",
  "prepared_result_ref",
  "expected_revision",
  "next_revision",
  "identity_record_version_before",
  "previous_commit_ref",
  "previous_record_checksum",
  "next_snapshot",
  "logical_time_before",
  "logical_time_after",
  "state_hash_before",
  "state_hash_after",
  "snapshot_hash_before",
  "snapshot_hash_after",
  "trace_entry",
  "trace_window",
  "mutation_history_link",
  "transition_record",
  "canonical_result",
  "repository_revision_bindings",
  "record_checksum"
];

const V2_ONLY_KEYS: readonly string[] = ["canonical_proposal", "writer_authority"];

const V2_BUNDLE_KEYS: readonly string[] = [...V1_BUNDLE_KEYS, ...V2_ONLY_KEYS];

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

interface ValidatedBundleCore {
  readonly subject_id: IdentifierV0;
  readonly transition_id: TransitionIdV0;
  readonly transition_type: TransitionType;
  readonly payload_fingerprint: HashV1;
  readonly expected_revision: StateRevisionV0;
  readonly next_revision: StateRevisionV0;
  readonly previous_commit_ref: CanonicalRefV0 | null;
  readonly previous_record_checksum: HashV1 | null;
  readonly next_snapshot: SubjectStateV0;
  readonly trace_entry: TraceEntryV1;
  readonly trace_window: TraceWindowV1;
  readonly transition_record: AuthoritativeTransitionRecordV1;
  readonly canonical_result: CanonicalCommitResultV1;
  readonly repository_bindings: readonly RepositoryRevisionBindingV1[];
}

/**
 * Structural + cross-field validation of the V1-compatible core shared by V1
 * and V2. The `commit_version` literal is checked by the caller.
 */
async function validateBundleCore(
  o: Record<string, unknown>
): Promise<ValidationResult<ValidatedBundleCore>> {
  const d = "bundle";

  const sid = validateIdentifier(o["subject_id"] as string, `${d}.subject_id`);
  if (!sid.ok) return sid;
  const tid = validateIdentifier(o["transition_id"] as string, `${d}.transition_id`);
  if (!tid.ok) return tid;
  if (!isString(o["transition_type"]) || !["Time", "Observation", "CognitionAction", "Learning", "Personality", "Relationship", "Belief"].includes(o["transition_type"])) {
    return fail("INVALID_SCHEMA", SCHEMA, `${d}.transition_type: invalid enum`);
  }
  const transitionType = o["transition_type"] as TransitionType;
  const pf = validateHash(o["payload_fingerprint"] as string, `${d}.payload_fingerprint`);
  if (!pf.ok) return pf;
  const prepared = validateRefElement(o["prepared_result_ref"], `${d}.prepared_result_ref`, ["workflow"]);
  if (!prepared.ok) return prepared;
  const expected = validateStateRevision(o["expected_revision"] as number, `${d}.expected_revision`);
  if (!expected.ok) return expected;
  const next = validateStateRevision(o["next_revision"] as number, `${d}.next_revision`);
  if (!next.ok) return next;
  if (next.value !== expected.value + 1) {
    return fail("INVALID_SCHEMA", SCHEMA, `${d}.next_revision: must equal expected_revision + 1`);
  }
  const idv = bundleSafeInteger(o["identity_record_version_before"], `${d}.identity_record_version_before`);
  if (!idv.ok) return idv;
  const pcr = bundleOptionalRef(o["previous_commit_ref"], `${d}.previous_commit_ref`, ["commit"]);
  if (!pcr.ok) return pcr;
  const prc = bundleOptionalHash(o["previous_record_checksum"], `${d}.previous_record_checksum`);
  if (!prc.ok) return prc;
  const ltb = validateLogicalTime(o["logical_time_before"] as number, `${d}.logical_time_before`);
  if (!ltb.ok) return ltb;
  const lta = validateLogicalTime(o["logical_time_after"] as number, `${d}.logical_time_after`);
  if (!lta.ok) return lta;
  if ((lta.value as number) < (ltb.value as number)) {
    return fail("INVALID_SCHEMA", SCHEMA, `${d}.logical_time_after: must not regress below logical_time_before`);
  }
  const shb = validateHash(o["state_hash_before"] as string, `${d}.state_hash_before`);
  if (!shb.ok) return shb;
  const sha = validateHash(o["state_hash_after"] as string, `${d}.state_hash_after`);
  if (!sha.ok) return sha;
  const snb = validateHash(o["snapshot_hash_before"] as string, `${d}.snapshot_hash_before`);
  if (!snb.ok) return snb;
  const sna = validateHash(o["snapshot_hash_after"] as string, `${d}.snapshot_hash_after`);
  if (!sna.ok) return sna;
  const crc = validateHash(o["record_checksum"] as string, `${d}.record_checksum`);
  if (!crc.ok) return crc;

  const snapshot = validateSubjectState(o["next_snapshot"]);
  if (!snapshot.ok) {
    return fail("INVALID_SCHEMA", SCHEMA, `${d}.next_snapshot: ${snapshot.error.detail}`);
  }
  const nextSnapshot = o["next_snapshot"] as unknown as SubjectStateV0;

  const traceEntry = validateTraceEntryShape(o["trace_entry"], `${d}.trace_entry`);
  if (!traceEntry.ok) return traceEntry;
  const traceWindow = validateTraceWindowShape(o["trace_window"], `${d}.trace_window`);
  if (!traceWindow.ok) return traceWindow;
  const link = validateMutationHistoryLinkShape(o["mutation_history_link"], `${d}.mutation_history_link`);
  if (!link.ok) return link;
  const record = validateTransitionRecordShape(o["transition_record"], `${d}.transition_record`);
  if (!record.ok) return record;
  const result = validateCanonicalResultShape(o["canonical_result"], `${d}.canonical_result`);
  if (!result.ok) return result;
  const bindings = validateRepositoryBindings(o["repository_revision_bindings"], `${d}.repository_revision_bindings`);
  if (!bindings.ok) return bindings;

  // ---- core cross-field equalities (frozen §15.2 construction) -------------------

  if (nextSnapshot.runtime_metadata.state_revision !== next.value) {
    return fail("INVALID_SCHEMA", SCHEMA, `${d}.next_snapshot.runtime_metadata.state_revision: must equal next_revision`);
  }
  if (nextSnapshot.identity.subject_id !== sid.value) {
    return fail("INVALID_SCHEMA", SCHEMA, `${d}.next_snapshot.identity.subject_id: must equal subject_id`);
  }
  if (nextSnapshot.runtime_metadata.logical_time !== lta.value) {
    return fail("INVALID_SCHEMA", SCHEMA, `${d}.next_snapshot.runtime_metadata.logical_time: must equal logical_time_after`);
  }
  const recomputedStateHashAfter = await stateHash(nextSnapshot);
  if (recomputedStateHashAfter !== sha.value) {
    return fail("INVALID_SCHEMA", SCHEMA, `${d}.state_hash_after: does not match stateHash(next_snapshot)`);
  }
  const recomputedSnapshotHashAfter = await snapshotHash({
    state_hash: sha.value,
    subject_id: sid.value,
    state_revision: next.value,
    trace_cursor: nextSnapshot.trace_window.cursor,
    last_trace_ref: lastTraceRef(nextSnapshot.trace_window)
  });
  if (recomputedSnapshotHashAfter !== sna.value) {
    return fail("INVALID_SCHEMA", SCHEMA, `${d}.snapshot_hash_after: does not match the canonical snapshot projection of next_snapshot`);
  }

  const entry = traceEntry.value;
  if (entry.transition_id !== (tid.value as unknown as TransitionIdV0)) {
    return fail("INVALID_SCHEMA", SCHEMA, `${d}.trace_entry.transition_id: must equal transition_id`);
  }
  if (entry.subject_id !== sid.value) {
    return fail("INVALID_SCHEMA", SCHEMA, `${d}.trace_entry.subject_id: must equal subject_id`);
  }
  if (entry.transition_type !== transitionType) {
    return fail("INVALID_SCHEMA", SCHEMA, `${d}.trace_entry.transition_type: must equal transition_type`);
  }
  if (entry.subject_revision_before !== expected.value) {
    return fail("INVALID_SCHEMA", SCHEMA, `${d}.trace_entry.subject_revision_before: must equal expected_revision`);
  }
  if (entry.subject_revision_after !== next.value) {
    return fail("INVALID_SCHEMA", SCHEMA, `${d}.trace_entry.subject_revision_after: must equal next_revision`);
  }
  if (entry.history_sequence !== (next.value as unknown as HistorySequenceV0)) {
    return fail("INVALID_SCHEMA", SCHEMA, `${d}.trace_entry.history_sequence: must equal next_revision`);
  }
  if (entry.logical_time !== lta.value) {
    return fail("INVALID_SCHEMA", SCHEMA, `${d}.trace_entry.logical_time: must equal logical_time_after`);
  }
  if (entry.state_hash_before !== shb.value || entry.state_hash_after !== sha.value) {
    return fail("INVALID_SCHEMA", SCHEMA, `${d}.trace_entry.state_hash_*: must equal the bundle state hashes`);
  }
  if (traceWindow.value.entries.length === 0) {
    return fail("INVALID_SCHEMA", SCHEMA, `${d}.trace_window.entries: must contain the committed trace entry`);
  }
  const lastWindowEntry = traceWindow.value.entries[traceWindow.value.entries.length - 1];
  if (!sameJson(lastWindowEntry, entry)) {
    return fail("INVALID_SCHEMA", SCHEMA, `${d}.trace_window.entries: last entry must equal trace_entry`);
  }
  if (traceWindow.value.cursor.last_history_sequence !== entry.history_sequence) {
    return fail("INVALID_SCHEMA", SCHEMA, `${d}.trace_window.cursor.last_history_sequence: must equal trace_entry.history_sequence`);
  }
  if (link.value.history_sequence !== (next.value as unknown as HistorySequenceV0)) {
    return fail("INVALID_SCHEMA", SCHEMA, `${d}.mutation_history_link.history_sequence: must equal next_revision`);
  }
  if (link.value.current_trace_ref !== entry.trace_id) {
    return fail("INVALID_SCHEMA", SCHEMA, `${d}.mutation_history_link.current_trace_ref: must equal trace_entry.trace_id`);
  }

  const cr = result.value;
  if (cr.transition_id !== (tid.value as unknown as TransitionIdV0)) {
    return fail("INVALID_SCHEMA", SCHEMA, `${d}.canonical_result.transition_id: must equal transition_id`);
  }
  if (cr.subject_id !== sid.value) {
    return fail("INVALID_SCHEMA", SCHEMA, `${d}.canonical_result.subject_id: must equal subject_id`);
  }
  if (cr.payload_fingerprint !== pf.value) {
    return fail("INVALID_SCHEMA", SCHEMA, `${d}.canonical_result.payload_fingerprint: must equal payload_fingerprint`);
  }
  if (cr.previous_revision !== expected.value) {
    return fail("INVALID_SCHEMA", SCHEMA, `${d}.canonical_result.previous_revision: must equal expected_revision`);
  }
  if (cr.next_revision !== next.value) {
    return fail("INVALID_SCHEMA", SCHEMA, `${d}.canonical_result.next_revision: must equal next_revision`);
  }
  if (cr.state_hash_before !== shb.value || cr.state_hash_after !== sha.value) {
    return fail("INVALID_SCHEMA", SCHEMA, `${d}.canonical_result.state_hash_*: must equal the bundle state hashes`);
  }
  if (cr.snapshot_hash_after !== sna.value) {
    return fail("INVALID_SCHEMA", SCHEMA, `${d}.canonical_result.snapshot_hash_after: must equal snapshot_hash_after`);
  }
  if (cr.trace_ref !== entry.trace_id) {
    return fail("INVALID_SCHEMA", SCHEMA, `${d}.canonical_result.trace_ref: must equal trace_entry.trace_id`);
  }
  if (cr.commit_ref !== (o["commit_ref"] as string)) {
    return fail("INVALID_SCHEMA", SCHEMA, `${d}.canonical_result.commit_ref: must equal commit_ref`);
  }
  const recomputedResultRef = (await deriveRef("result", RESULT_ID_PROJECTION_V1, {
    schema_version: "canonical-commit-result-v1",
    status: "COMMITTED",
    transition_id: cr.transition_id,
    subject_id: cr.subject_id,
    payload_fingerprint: cr.payload_fingerprint,
    previous_revision: cr.previous_revision,
    next_revision: cr.next_revision,
    state_hash_before: cr.state_hash_before,
    state_hash_after: cr.state_hash_after,
    snapshot_hash_after: cr.snapshot_hash_after,
    trace_ref: cr.trace_ref,
    commit_ref: cr.commit_ref
  })) as CanonicalRefV0;
  if (recomputedResultRef !== cr.result_ref) {
    return fail("INVALID_SCHEMA", SCHEMA, `${d}.canonical_result.result_ref: does not match the frozen V1 result-id projection`);
  }

  const tr = record.value;
  if (tr.transition_id !== (tid.value as unknown as TransitionIdV0)) {
    return fail("INVALID_SCHEMA", SCHEMA, `${d}.transition_record.transition_id: must equal transition_id`);
  }
  if (tr.subject_id !== sid.value) {
    return fail("INVALID_SCHEMA", SCHEMA, `${d}.transition_record.subject_id: must equal subject_id`);
  }
  if (tr.transition_type !== transitionType) {
    return fail("INVALID_SCHEMA", SCHEMA, `${d}.transition_record.transition_type: must equal transition_type`);
  }
  if (tr.payload_fingerprint !== pf.value) {
    return fail("INVALID_SCHEMA", SCHEMA, `${d}.transition_record.payload_fingerprint: must equal payload_fingerprint`);
  }
  if (tr.record_version !== idv.value + 1) {
    return fail("INVALID_SCHEMA", SCHEMA, `${d}.transition_record.record_version: must equal identity_record_version_before + 1`);
  }
  if (tr.terminal_status !== "COMMITTED") {
    return fail("INVALID_SCHEMA", SCHEMA, `${d}.transition_record.terminal_status: committed bundles terminate COMMITTED`);
  }
  if (tr.terminal_result_ref !== cr.result_ref) {
    return fail("INVALID_SCHEMA", SCHEMA, `${d}.transition_record.terminal_result_ref: must equal canonical_result.result_ref`);
  }
  const attempts = tr.attempts;
  const lastAttempt: TransitionAttemptV1 = attempts[attempts.length - 1] as TransitionAttemptV1;
  if (lastAttempt.attempt_sequence !== attempts.length) {
    return fail("INVALID_SCHEMA", SCHEMA, `${d}.transition_record.attempts: last attempt_sequence must equal attempts.length`);
  }
  if (lastAttempt.status !== "COMMITTED") {
    return fail("INVALID_SCHEMA", SCHEMA, `${d}.transition_record.attempts: last attempt must be COMMITTED`);
  }
  if (lastAttempt.revision_before !== expected.value || lastAttempt.revision_after !== next.value) {
    return fail("INVALID_SCHEMA", SCHEMA, `${d}.transition_record.attempts: last attempt revisions must equal the bundle revisions`);
  }
  if (lastAttempt.state_hash_before !== shb.value || lastAttempt.state_hash_after !== sha.value) {
    return fail("INVALID_SCHEMA", SCHEMA, `${d}.transition_record.attempts: last attempt state hashes must equal the bundle state hashes`);
  }
  if (lastAttempt.result_ref !== cr.result_ref) {
    return fail("INVALID_SCHEMA", SCHEMA, `${d}.transition_record.attempts: last attempt result_ref must equal canonical_result.result_ref`);
  }
  if (lastAttempt.prepared_result_ref !== prepared.value) {
    return fail("INVALID_SCHEMA", SCHEMA, `${d}.transition_record.attempts: last attempt prepared_result_ref must equal prepared_result_ref`);
  }
  if (lastAttempt.trace_ref !== entry.trace_id) {
    return fail("INVALID_SCHEMA", SCHEMA, `${d}.transition_record.attempts: last attempt trace_ref must equal trace_entry.trace_id`);
  }
  for (let i = 0; i < attempts.length - 1; i++) {
    if ((attempts[i] as TransitionAttemptV1).status === "COMMITTED") {
      return fail("INVALID_SCHEMA", SCHEMA, `${d}.transition_record.attempts: only the last attempt may be COMMITTED`);
    }
    if ((attempts[i] as TransitionAttemptV1).attempt_sequence !== i + 1) {
      return fail("INVALID_SCHEMA", SCHEMA, `${d}.transition_record.attempts: attempt_sequence must be 1-based contiguous`);
    }
  }

  return ok({
    subject_id: sid.value,
    transition_id: tid.value as unknown as TransitionIdV0,
    transition_type: transitionType,
    payload_fingerprint: pf.value,
    expected_revision: expected.value,
    next_revision: next.value,
    previous_commit_ref: pcr.value,
    previous_record_checksum: prc.value,
    next_snapshot: nextSnapshot,
    trace_entry: entry,
    trace_window: traceWindow.value,
    transition_record: tr,
    canonical_result: cr,
    repository_bindings: bindings.value
  });
}

// ---- V1 validator -----------------------------------------------------------------

/** Exact closed single-record AtomicCommitBundleV1 validator. */
export async function validateAtomicCommitBundleV1(
  v: unknown
): Promise<ValidationResult<AtomicCommitBundleV1>> {
  if (!isRecord(v)) return fail("INVALID_SCHEMA", SCHEMA, "bundle: expected object");
  const closed = bundleClosedKeys(v, V1_BUNDLE_KEYS, "bundle");
  if (!closed.ok) return closed;
  const cv = bundleLit(v["commit_version"], "atomic-commit-v1", "bundle.commit_version");
  if (!cv.ok) return cv;
  const sv = bundleLit(v["serialization_version"], "canonical-json-v1", "bundle.serialization_version");
  if (!sv.ok) return sv;

  const core = await validateBundleCore(v);
  if (!core.ok) return core;
  const c = core.value;

  // V1 commit ref recomputation — exact frozen V1 projection.
  const recomputedCommitRef = (await deriveRef("commit", COMMIT_ID_PROJECTION_V1, {
    subject_id: c.subject_id,
    transition_id: c.transition_id,
    transition_type: c.transition_type,
    next_revision: c.next_revision,
    state_hash_after: v["state_hash_after"],
    snapshot_hash_after: v["snapshot_hash_after"],
    trace_ref: c.trace_entry.trace_id,
    previous_commit_ref: c.previous_commit_ref
  })) as CanonicalRefV0;
  if (recomputedCommitRef !== v["commit_ref"]) {
    return fail("INVALID_SCHEMA", SCHEMA, "bundle.commit_ref: does not match the frozen V1 commit-id projection");
  }

  // V1 record checksum recomputation over the bundle minus record_checksum.
  const bundleWithoutChecksum: Record<string, unknown> = { ...v };
  delete bundleWithoutChecksum["record_checksum"];
  const recomputedChecksum = await hashEnvelope(RECORD_CHECKSUM_PROJECTION_V1, bundleWithoutChecksum);
  if (recomputedChecksum !== v["record_checksum"]) {
    return fail("INVALID_SCHEMA", SCHEMA, "bundle.record_checksum: does not match the frozen V1 record-checksum projection");
  }

  return ok(v as unknown as AtomicCommitBundleV1);
}

// ---- V2 validator -----------------------------------------------------------------

/**
 * Exact closed single-record AtomicCommitBundleV2 validator. Proves the exact
 * 29-key shape, deterministic internal integrity, canonical cross-bindings
 * available inside the record, and (when non-null) the generic 11-field
 * writer-authority envelope binding. Structurally valid != authorized.
 */
export async function validateAtomicCommitBundleV2(
  v: unknown
): Promise<ValidationResult<AtomicCommitBundleV2>> {
  if (!isRecord(v)) return fail("INVALID_SCHEMA", SCHEMA, "bundle: expected object");
  const closed = bundleClosedKeys(v, V2_BUNDLE_KEYS, "bundle");
  if (!closed.ok) return closed;
  const cv = bundleLit(v["commit_version"], "atomic-commit-v2", "bundle.commit_version");
  if (!cv.ok) return cv;
  const sv = bundleLit(v["serialization_version"], "canonical-json-v1", "bundle.serialization_version");
  if (!sv.ok) return sv;

  const proposal = validateProposal(v["canonical_proposal"]);
  if (!proposal.ok) {
    return fail("INVALID_SCHEMA", SCHEMA, `bundle.canonical_proposal: ${proposal.error.detail}`);
  }
  const p = proposal.value;

  if (v["writer_authority"] !== null) {
    const authorityShape = validateWriterAuthorityShape(v["writer_authority"], "bundle.writer_authority");
    if (!authorityShape.ok) return authorityShape;
  }

  const core = await validateBundleCore(v);
  if (!core.ok) return core;
  const c = core.value;

  // Canonical proposal cross-bindings — V2 persists the full proposal, so
  // proposal_ref and payload_fingerprint are RECOMPUTED, not just formatted.
  if (p.subject_id !== c.subject_id) {
    return fail("INVALID_SCHEMA", SCHEMA, "bundle.canonical_proposal.subject_id: must equal subject_id");
  }
  if (p.transition_id !== c.transition_id) {
    return fail("INVALID_SCHEMA", SCHEMA, "bundle.canonical_proposal.transition_id: must equal transition_id");
  }
  if (p.transition_type !== c.transition_type) {
    return fail("INVALID_SCHEMA", SCHEMA, "bundle.canonical_proposal.transition_type: must equal transition_type");
  }
  if (p.expected_state_revision !== c.expected_revision) {
    return fail("INVALID_SCHEMA", SCHEMA, "bundle.canonical_proposal.expected_state_revision: must equal expected_revision");
  }
  const recomputedProposalRef = await proposalRef(p);
  const recomputedPayloadFingerprint = await proposalFingerprint(p);
  if (recomputedPayloadFingerprint !== c.payload_fingerprint) {
    return fail("INVALID_SCHEMA", SCHEMA, "bundle.payload_fingerprint: does not match proposalFingerprint(canonical_proposal)");
  }
  if (c.transition_record.proposal_ref !== recomputedProposalRef) {
    return fail("INVALID_SCHEMA", SCHEMA, "bundle.transition_record.proposal_ref: does not match proposalRef(canonical_proposal)");
  }
  if (c.trace_entry.proposal_ref !== recomputedProposalRef) {
    return fail("INVALID_SCHEMA", SCHEMA, "bundle.trace_entry.proposal_ref: does not match proposalRef(canonical_proposal)");
  }

  // Generic writer-authority envelope bindings.
  let writerAuthorityPayloadHash: HashV1 | null = null;
  if (v["writer_authority"] !== null) {
    const authority = v["writer_authority"] as CanonicalWriterAuthorityRecordV0;
    if (authority.proposal_ref !== recomputedProposalRef) {
      return fail("INVALID_SCHEMA", SCHEMA, "bundle.writer_authority.proposal_ref: does not match proposalRef(canonical_proposal)");
    }
    if (authority.payload_fingerprint !== c.payload_fingerprint) {
      return fail("INVALID_SCHEMA", SCHEMA, "bundle.writer_authority.payload_fingerprint: must equal payload_fingerprint");
    }
    const recordBody: Record<string, unknown> = { ...authority };
    delete recordBody["authority_payload_hash"];
    writerAuthorityPayloadHash = await deriveWriterAuthorityPayloadHashV0(
      recordBody as unknown as Omit<CanonicalWriterAuthorityRecordV0, "authority_payload_hash">
    );
    if (writerAuthorityPayloadHash !== authority.authority_payload_hash) {
      return fail("INVALID_SCHEMA", SCHEMA, "bundle.writer_authority.authority_payload_hash: does not match the frozen writer-authority-record projection");
    }
  }

  // V2 commit ref + record checksum recomputation.
  const recomputedCommitRef = await deriveAtomicCommitRefV2({
    commit_version: "atomic-commit-v2",
    serialization_version: "canonical-json-v1",
    proposal_ref: recomputedProposalRef,
    payload_fingerprint: c.payload_fingerprint,
    subject_id: c.subject_id,
    transition_id: c.transition_id,
    transition_type: c.transition_type,
    expected_revision: c.expected_revision,
    next_revision: c.next_revision,
    previous_commit_ref: c.previous_commit_ref,
    previous_record_checksum: c.previous_record_checksum,
    state_hash_before: v["state_hash_before"] as HashV1,
    state_hash_after: v["state_hash_after"] as HashV1,
    snapshot_hash_before: v["snapshot_hash_before"] as HashV1,
    snapshot_hash_after: v["snapshot_hash_after"] as HashV1,
    trace_ref: c.trace_entry.trace_id,
    writer_authority_payload_hash: writerAuthorityPayloadHash
  });
  if (recomputedCommitRef !== v["commit_ref"]) {
    return fail("INVALID_SCHEMA", SCHEMA, "bundle.commit_ref: does not match the V2 commit-id projection");
  }
  const bundleWithoutChecksum: Record<string, unknown> = { ...v };
  delete bundleWithoutChecksum["record_checksum"];
  const recomputedChecksum = await deriveAtomicCommitRecordChecksumV2(
    bundleWithoutChecksum as unknown as Omit<AtomicCommitBundleV2, "record_checksum">
  );
  if (recomputedChecksum !== v["record_checksum"]) {
    return fail("INVALID_SCHEMA", SCHEMA, "bundle.record_checksum: does not match the V2 record-checksum projection");
  }

  return ok(v as unknown as AtomicCommitBundleV2);
}

// ---- version dispatch + version-step policy ---------------------------------------

/**
 * Version dispatcher: plain object required; exact `commit_version` inspection
 * routes to the matching closed validator. Missing/malformed/unknown versions
 * fail closed. No normalization, no defaults, no implicit upcast.
 */
export async function validateAtomicCommitBundleAnyVersion(
  v: unknown
): Promise<ValidationResult<AtomicCommitBundleAnyVersion>> {
  if (!isRecord(v)) return fail("INVALID_SCHEMA", SCHEMA, "bundle: expected object");
  if (!isString(v["commit_version"])) {
    return fail("INVALID_SCHEMA", SCHEMA, "bundle.commit_version: expected literal");
  }
  if (!(ATOMIC_COMMIT_BUNDLE_VERSIONS_V0 as readonly string[]).includes(v["commit_version"])) {
    return fail("INVALID_SCHEMA", SCHEMA, `bundle.commit_version: unknown version ${v["commit_version"]}`);
  }
  if (v["commit_version"] === "atomic-commit-v1") {
    return validateAtomicCommitBundleV1(v);
  }
  return validateAtomicCommitBundleV2(v);
}

export type CommitBundleVersionStepVerdictV0 = "ALLOWED" | "DOWNGRADE_FORBIDDEN";

const VERSION_RANK_V0: Readonly<Record<(typeof ATOMIC_COMMIT_BUNDLE_VERSIONS_V0)[number], number>> =
  Object.freeze({
    "atomic-commit-v1": 1,
    "atomic-commit-v2": 2
  });

/**
 * Pure version-monotonicity policy primitive: V1→V1 allowed, V1→V2 allowed,
 * V2→V2 allowed, V2→V1 DOWNGRADE_FORBIDDEN. Inspects ONLY the two version
 * literals — no predecessor refs, hashes, or revisions (chain validation is a
 * later slice). Once V2, never back to V1.
 */
export function evaluateCommitBundleVersionStepV0(
  previous: (typeof ATOMIC_COMMIT_BUNDLE_VERSIONS_V0)[number],
  next: (typeof ATOMIC_COMMIT_BUNDLE_VERSIONS_V0)[number]
): CommitBundleVersionStepVerdictV0 {
  return VERSION_RANK_V0[next] >= VERSION_RANK_V0[previous] ? "ALLOWED" : "DOWNGRADE_FORBIDDEN";
}
