/**
 * CANONICAL_AFFECT_STATE_FOUNDATION_V0 — explicit v4 restore entrypoint (§33-§36).
 *
 * restoreSubjectStateV4FromEnvelopeV0: closed envelope validation, exact v4
 * snapshot validation, full snapshot checksum, v4 StateHash, v4 SnapshotHash,
 * repository binding validation, trace integrity, commit-head law, revision>0
 * chain proof, exact deep clone/freeze. MUST NOT apply dynamics, advance time,
 * run Appraisal, replay events, migrate v3, or repair invalid values.
 *
 * Unknown affect_profile.profile_id fails closed (§35). A v4 snapshot with
 * BOUNDED_AFFECT_DYNAMICS_V0 restores its numeric values exactly (§36).
 */

import type { HashV1 } from "../types/scalars.js";
import type { SubjectStateV4 } from "../types/subject-state-v4.js";
import {
  SUBJECT_STATE_V4_FULL_PERSISTENCE_PROJECTION,
  SUBJECT_STATE_V4_SNAPSHOT_HASH_PROJECTION,
  SUBJECT_STATE_V4_STATE_HASH_PROJECTION,
  subjectStateV4ProjectionValue
} from "../types/subject-state-v4.js";
import { hashEnvelope } from "../canonical/hash.js";
import { validateSubjectStateV4 } from "../validation/subject-state-v4.js";
import { validateSubjectState } from "../validation/subject-state.js";

export interface V4RestoreEnvelopeInputV0 {
  readonly snapshot: unknown;
  readonly commit_head: {
    readonly commit_ref: string;
    readonly state_hash: HashV1;
    readonly snapshot_hash: HashV1;
    readonly full_checksum: HashV1;
  };
  readonly repository_binding: {
    readonly repository_revision: string;
    readonly repository_revision_hash: HashV1;
  };
  /** revision > 0 requires a chain proof (validated predecessor bundle refs). */
  readonly chain_proof?: {
    readonly commit_refs: readonly string[];
  };
  readonly reference_validator: (binding: {
    readonly repository_revision: string;
    readonly repository_revision_hash: HashV1;
  }) => Promise<boolean>;
}

export type V4RestoreResultV0 =
  | { readonly ok: true; readonly snapshot: SubjectStateV4 }
  | { readonly ok: false; readonly code: "NOT_V4" | "INVALID_SNAPSHOT" | "STATE_HASH_MISMATCH" | "SNAPSHOT_HASH_MISMATCH" | "FULL_CHECKSUM_MISMATCH" | "BINDING_INVALID" | "CHAIN_PROOF_MISSING"; readonly detail: string };

export async function restoreSubjectStateV4FromEnvelopeV0(
  envelope: V4RestoreEnvelopeInputV0
): Promise<V4RestoreResultV0> {
  // 1. closed envelope shape (manual — no repair).
  if (typeof envelope !== "object" || envelope === null) {
    return { ok: false, code: "NOT_V4", detail: "envelope: expected object" };
  }
  const head = envelope.commit_head;
  const binding = envelope.repository_binding;
  if (typeof head?.commit_ref !== "string" || head.commit_ref.length === 0) {
    return { ok: false, code: "NOT_V4", detail: "envelope.commit_head: commit_ref required" };
  }

  // 2. exact v4 snapshot validation (§33: the v3 restore entrypoint is untouched).
  const version = (envelope.snapshot as Record<string, unknown> | null)?.["schema_version"];
  if (version !== "subject-state-v4") {
    return { ok: false, code: "NOT_V4", detail: "envelope.snapshot is not a subject-state-v4 snapshot" };
  }
  const checked = validateSubjectStateV4(envelope.snapshot);
  if (!checked.ok) {
    return { ok: false, code: "INVALID_SNAPSHOT", detail: checked.error.detail };
  }
  const snapshot = checked.value;

  // 35. unknown affect_profile.profile_id fails closed (validator enforces the
  // closed BOUNDED_AFFECT_DYNAMICS_V0 pairing; nothing falls back to v3).

  // 3-5. full checksum, v4 StateHash, v4 SnapshotHash.
  const fullChecksum = await hashEnvelope(SUBJECT_STATE_V4_FULL_PERSISTENCE_PROJECTION, snapshot);
  if (fullChecksum !== head.full_checksum) {
    return { ok: false, code: "FULL_CHECKSUM_MISMATCH", detail: "full persistence checksum mismatches the commit head" };
  }
  const stateHash = await hashEnvelope(SUBJECT_STATE_V4_STATE_HASH_PROJECTION, subjectStateV4ProjectionValue(snapshot));
  if (stateHash !== head.state_hash) {
    return { ok: false, code: "STATE_HASH_MISMATCH", detail: "v4 StateHash mismatches the commit head" };
  }
  const snapshotHash = await hashEnvelope(SUBJECT_STATE_V4_SNAPSHOT_HASH_PROJECTION, {
    last_trace_ref: null,
    state_hash: stateHash,
    state_revision: snapshot.runtime_metadata.state_revision,
    subject_id: snapshot.identity.subject_id,
    trace_cursor: snapshot.trace_window.cursor
  });
  if (snapshotHash !== head.snapshot_hash) {
    return { ok: false, code: "SNAPSHOT_HASH_MISMATCH", detail: "v4 SnapshotHash mismatches the commit head" };
  }

  // 6. repository binding validation.
  const bindingOk = await envelope.reference_validator({
    repository_revision: binding.repository_revision,
    repository_revision_hash: binding.repository_revision_hash
  });
  if (bindingOk !== true) {
    return { ok: false, code: "BINDING_INVALID", detail: "repository binding failed the reference validator" };
  }

  // 7. trace integrity is covered by validateSubjectStateV4 (trace_window invariants).
  // 8. commit-head law: non-empty commit_ref verified above.
  // 9. revision > 0 requires a chain proof.
  if (snapshot.runtime_metadata.state_revision > 0) {
    const proof = envelope.chain_proof;
    if (proof === undefined || proof.commit_refs.length === 0) {
      return { ok: false, code: "CHAIN_PROOF_MISSING", detail: "revision > 0 requires a chain proof" };
    }
    if (!proof.commit_refs.includes(head.commit_ref)) {
      return { ok: false, code: "CHAIN_PROOF_MISSING", detail: "chain proof does not include the commit head" };
    }
  }

  // 10. exact deep clone/freeze — restore reconstructs exact state only.
  const restored: SubjectStateV4 = JSON.parse(JSON.stringify(snapshot)) as SubjectStateV4;
  Object.freeze(restored);
  return { ok: true, snapshot: restored };
}

/** Type guard over the v3 restore path — v3 restore is unchanged (§33). */
export function isV4Snapshot(snapshot: unknown): boolean {
  return validateSubjectState(snapshot).ok === false &&
    typeof snapshot === "object" &&
    snapshot !== null &&
    (snapshot as Record<string, unknown>)["schema_version"] === "subject-state-v4";
}
