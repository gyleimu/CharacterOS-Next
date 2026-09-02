/**
 * Trusted Canonical History Boundary V0
 * (CHARACTEROS_ATOMIC_COMMIT_CHAIN_VALIDATOR_V0, LEVEL_2).
 *
 * Binds a revision-zero PersistedSubjectEnvelopeV1 (trusted genesis) plus a
 * TrustedCanonicalHeadInputV0 into an OPAQUE, deeply frozen, object-identity
 * admitted boundary receipt. Structurally copied objects and caller-built
 * lookalikes are rejected — admission is module-private WeakSet membership,
 * the exact existing repository capability idiom.
 *
 * TRUST LEVEL (frozen): this is LEVEL_2 application composition authority —
 * NOT cryptographic, NOT tamper-proof, NOT Level-3, NOT hardware-backed.
 * Deep-import of this module is technically possible in TypeScript; no
 * OS/security isolation is claimed.
 *
 * The receipt ISSUER is deliberately NOT root-exported: the trusted boundary
 * stays internal to trusted runtime/store composition. The public surface
 * exposes only TYPES plus read-only verification helpers.
 */

import type {
  HashV1,
  IdentifierV0,
  StateRevisionV0,
  CanonicalRefV0
} from "@characteros-next/subject-core";
import {
  fullSnapshotChecksum,
  lastTraceRef,
  snapshotHash,
  stateHash,
  validateCommitHeadRule,
  validateRepositoryBindingSet,
  validateSubjectState,
  type PersistedSubjectEnvelopeV1
} from "@characteros-next/subject-core";

// ---- trusted head input ------------------------------------------------------------

export const TRUSTED_CANONICAL_HEAD_SCHEMA_VERSION_V0 = "trusted-canonical-head-v0" as const;

/**
 * Exact 7-field trusted canonical head claim. Revision 0 requires null
 * commit_ref/record_checksum; a positive revision requires both.
 */
export interface TrustedCanonicalHeadInputV0 {
  readonly schema_version: typeof TRUSTED_CANONICAL_HEAD_SCHEMA_VERSION_V0;
  readonly subject_id: IdentifierV0;
  readonly revision: StateRevisionV0;
  readonly commit_ref: CanonicalRefV0 | null;
  readonly record_checksum: HashV1 | null;
  readonly state_hash: HashV1;
  readonly snapshot_hash: HashV1;
}

// ---- opaque receipt ----------------------------------------------------------------

export const TRUSTED_CANONICAL_HISTORY_BOUNDARY_SCHEMA_VERSION_V0 =
  "trusted-canonical-history-boundary-v0" as const;

/** Opaque durable boundary evidence. Contents are frozen at mint time. */
export interface TrustedCanonicalHistoryBoundaryReceiptV0 {
  readonly schema_version: typeof TRUSTED_CANONICAL_HISTORY_BOUNDARY_SCHEMA_VERSION_V0;
  readonly genesis: PersistedSubjectEnvelopeV1;
  readonly head: TrustedCanonicalHeadInputV0;
}

const trustedBoundaries = new WeakSet<object>();

export interface MintTrustedCanonicalHistoryBoundaryInputV0 {
  /** Revision-zero persisted envelope (validated against the genesis law). */
  readonly genesis: PersistedSubjectEnvelopeV1;
  readonly head: TrustedCanonicalHeadInputV0;
}

export type MintTrustedCanonicalHistoryBoundaryOutcomeV0 =
  | { readonly kind: "MINTED"; readonly receipt: TrustedCanonicalHistoryBoundaryReceiptV0 }
  | { readonly kind: "REJECTED"; readonly code: "INVALID_GENESIS" | "INVALID_TRUSTED_HEAD"; readonly detail: string };

/**
 * INTERNAL trusted-boundary issuer. Deliberately NOT root-exported: the
 * trusted boundary stays internal to trusted runtime/store composition. Tests
 * may import this module directly (Level-2 composition authority; no
 * OS/security isolation is claimed).
 *
 * Verifies the full genesis law (§5) and the head structural law before
 * minting the opaque, deeply frozen, WeakSet-admitted receipt.
 */
export async function mintTrustedCanonicalHistoryBoundaryV0(
  input: MintTrustedCanonicalHistoryBoundaryInputV0
): Promise<MintTrustedCanonicalHistoryBoundaryOutcomeV0> {
  const genesisCheck = await verifyGenesisEnvelopeV0(input.genesis);
  if (!genesisCheck.ok) {
    return { kind: "REJECTED", code: "INVALID_GENESIS", detail: genesisCheck.error.detail };
  }
  const headCheck = validateTrustedCanonicalHeadInputV0(input.head);
  if (!headCheck.ok) {
    return { kind: "REJECTED", code: "INVALID_TRUSTED_HEAD", detail: headCheck.error.detail };
  }
  const receipt: TrustedCanonicalHistoryBoundaryReceiptV0 = {
    schema_version: TRUSTED_CANONICAL_HISTORY_BOUNDARY_SCHEMA_VERSION_V0,
    genesis: input.genesis,
    head: input.head
  };
  deepFreeze(receipt);
  trustedBoundaries.add(receipt);
  return { kind: "MINTED", receipt };
}

/** WeakSet admission: only issuer-minted receipts are trusted. */
export function isTrustedCanonicalHistoryBoundaryReceiptV0(value: unknown): boolean {
  return typeof value === "object" && value !== null && trustedBoundaries.has(value);
}

// ---- genesis + head verification ----------------------------------------------------

/**
 * Exact genesis law (§5) over a revision-zero PersistedSubjectEnvelopeV1:
 * closed subject-state validation, zero revision/logical-time/created_at/
 * updated_at, null last-transition fields, empty genesis trace window, null
 * commit_head, the current repository binding-set contract, and full
 * checksum/state/snapshot hash recomputation.
 */
export async function verifyGenesisEnvelopeV0(
  envelope: PersistedSubjectEnvelopeV1
): Promise<{ readonly ok: true } | { readonly ok: false; readonly error: { readonly detail: string } }> {
  const snapshot = envelope.snapshot;
  const stateCheck = validateSubjectState(snapshot);
  if (!stateCheck.ok) {
    return { ok: false, error: { detail: `genesis snapshot: ${stateCheck.error.detail}` } };
  }
  const rm = snapshot.runtime_metadata;
  const expect = (condition: boolean, detail: string) =>
    condition ? undefined : ({ ok: false, error: { detail } } as const);
  const firstFailure =
    expect(envelope.schema_version === "subject-persistence-envelope-v1", "genesis envelope schema_version") ??
    expect(envelope.serialization_version === "canonical-json-v1", "genesis envelope serialization_version") ??
    expect(rm.state_revision === 0, "genesis state_revision must be 0") ??
    expect(rm.logical_time === 0, "genesis logical_time must be 0") ??
    expect(rm.created_at === 0, "genesis created_at must be 0") ??
    expect(rm.updated_at === 0, "genesis updated_at must be 0") ??
    expect(rm.last_transition_time === null, "genesis last_transition_time must be null") ??
    expect(rm.last_transition_type === null, "genesis last_transition_type must be null") ??
    expect(snapshot.trace_window.trace_window_schema_version === "trace-window-v1", "genesis trace schema") ??
    expect(snapshot.trace_window.capacity === 64, "genesis trace capacity must be 64") ??
    expect(snapshot.trace_window.cursor.last_history_sequence === 0, "genesis trace cursor must be 0") ??
    expect(snapshot.trace_window.cursor.offloaded_through_sequence === 0, "genesis offload cursor must be 0") ??
    expect(snapshot.trace_window.cursor.offloaded_through_trace_ref === null, "genesis offload trace ref must be null") ??
    expect(snapshot.trace_window.entries.length === 0, "genesis trace entries must be empty") ??
    expect(envelope.commit_head === null, "genesis commit_head must be null");
  if (firstFailure !== undefined) return firstFailure;

  const bindings = validateRepositoryBindingSet(snapshot, envelope.repository_bindings);
  if (!bindings.ok) {
    return { ok: false, error: { detail: `genesis repository bindings: ${bindings.error.detail}` } };
  }
  const head = validateCommitHeadRule(snapshot, envelope.commit_head);
  if (!head.ok) {
    return { ok: false, error: { detail: `genesis commit head: ${head.error.detail}` } };
  }

  // Recompute the three integrity hashes over the exact genesis snapshot.
  const checksum = await fullSnapshotChecksum(snapshot);
  if (checksum !== envelope.full_snapshot_checksum) {
    return { ok: false, error: { detail: "genesis full_snapshot_checksum does not recompute" } };
  }
  const stateHashValue = await stateHash(snapshot);
  if (stateHashValue !== envelope.state_hash) {
    return { ok: false, error: { detail: "genesis state_hash does not recompute" } };
  }
  const snapshotHashValue = await snapshotHash({
    state_hash: stateHashValue,
    subject_id: snapshot.identity.subject_id,
    state_revision: snapshot.runtime_metadata.state_revision,
    trace_cursor: snapshot.trace_window.cursor,
    last_trace_ref: lastTraceRef(snapshot.trace_window)
  });
  if (snapshotHashValue !== envelope.snapshot_hash) {
    return { ok: false, error: { detail: "genesis snapshot_hash does not recompute" } };
  }
  return { ok: true };
}

/** Structural head law: closed 7-field shape + revision↔head-field coherence. */
export function validateTrustedCanonicalHeadInputV0(
  v: unknown
): { readonly ok: true; readonly head: TrustedCanonicalHeadInputV0 } | { readonly ok: false; readonly error: { readonly detail: string } } {
  const failHead = (detail: string) => ({ ok: false as const, error: { detail } });
  if (typeof v !== "object" || v === null) return failHead("trusted head: expected object");
  const head = v as Record<string, unknown>;
  const keys = Object.keys(head).sort();
  const expected = [
    "commit_ref",
    "record_checksum",
    "revision",
    "schema_version",
    "snapshot_hash",
    "state_hash",
    "subject_id"
  ];
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    return failHead("trusted head: exact 7-field closed shape required");
  }
  if (head["schema_version"] !== TRUSTED_CANONICAL_HEAD_SCHEMA_VERSION_V0) {
    return failHead("trusted head.schema_version: expected trusted-canonical-head-v0");
  }
  if (typeof head["subject_id"] !== "string" || head["subject_id"].length === 0) {
    return failHead("trusted head.subject_id: expected identifier");
  }
  if (typeof head["revision"] !== "number" || !Number.isSafeInteger(head["revision"]) || head["revision"] < 0) {
    return failHead("trusted head.revision: nonnegative safe integer required");
  }
  const commitRef = head["commit_ref"];
  const recordChecksum = head["record_checksum"];
  if (head["revision"] === 0) {
    if (commitRef !== null || recordChecksum !== null) {
      return failHead("trusted head: revision 0 requires null commit_ref and record_checksum");
    }
  } else {
    if (typeof commitRef !== "string" || !commitRef.startsWith("commit:")) {
      return failHead("trusted head: positive revision requires a commit ref");
    }
    if (typeof recordChecksum !== "string" || !recordChecksum.startsWith("sha256:")) {
      return failHead("trusted head: positive revision requires a record checksum");
    }
  }
  if (typeof head["state_hash"] !== "string" || !head["state_hash"].startsWith("sha256:")) {
    return failHead("trusted head.state_hash: expected HashV1");
  }
  if (typeof head["snapshot_hash"] !== "string" || !head["snapshot_hash"].startsWith("sha256:")) {
    return failHead("trusted head.snapshot_hash: expected HashV1");
  }
  return { ok: true, head: v as unknown as TrustedCanonicalHeadInputV0 };
}

function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  if (Object.isFrozen(value)) return;
  Object.freeze(value);
  for (const key of Object.keys(value as Record<string, unknown>)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
}
