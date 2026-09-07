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
  fullSnapshotChecksumAnyVersion,
  lastTraceRef,
  snapshotHash,
  snapshotHashAnyVersion,
  stateHash,
  stateHashAnyVersion,
  validateCommitHeadRule,
  validateRepositoryBindingSet,
  validateSubjectState,
  validateSubjectStateV4,
  type PersistedSubjectEnvelopeV1,
  type SubjectStateAnyVersionV0,
  type V4PersistenceEnvelopeV0
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
export type TrustedCanonicalGenesisEnvelopeAnyVersionV0 =
  | PersistedSubjectEnvelopeV1
  | V4PersistenceEnvelopeV0;

export interface TrustedCanonicalHistoryBoundaryReceiptV0<
  TGenesis extends TrustedCanonicalGenesisEnvelopeAnyVersionV0 = PersistedSubjectEnvelopeV1
> {
  readonly schema_version: typeof TRUSTED_CANONICAL_HISTORY_BOUNDARY_SCHEMA_VERSION_V0;
  readonly genesis: TGenesis;
  readonly head: TrustedCanonicalHeadInputV0;
}

export type TrustedCanonicalHistoryBoundaryAnyVersionReceiptV0 =
  | TrustedCanonicalHistoryBoundaryReceiptV0
  | TrustedCanonicalHistoryBoundaryReceiptV0<V4PersistenceEnvelopeV0>;

const trustedBoundaries = new WeakSet<object>();

export interface MintTrustedCanonicalHistoryBoundaryInputV0 {
  /** Revision-zero persisted envelope (validated against the genesis law). */
  readonly genesis: PersistedSubjectEnvelopeV1;
  readonly head: TrustedCanonicalHeadInputV0;
}

export type MintTrustedCanonicalHistoryBoundaryOutcomeV0 =
  | { readonly kind: "MINTED"; readonly receipt: TrustedCanonicalHistoryBoundaryReceiptV0 }
  | { readonly kind: "REJECTED"; readonly code: "INVALID_GENESIS" | "INVALID_TRUSTED_HEAD"; readonly detail: string };

export type MintTrustedCanonicalHistoryBoundaryV4OutcomeV0 =
  | {
      readonly kind: "MINTED";
      readonly receipt: TrustedCanonicalHistoryBoundaryReceiptV0<V4PersistenceEnvelopeV0>;
    }
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

/** Explicit v4 boundary issuer. A valid-looking v4 snapshot is insufficient:
 * the exact materializer envelope, genesis baseline, R0 binding, /v2 hashes,
 * and trusted repository verdict are all required. */
export async function mintTrustedCanonicalHistoryBoundaryV4V0(input: {
  readonly genesis: V4PersistenceEnvelopeV0;
  readonly head: TrustedCanonicalHeadInputV0;
  readonly reference_validator: (binding: V4PersistenceEnvelopeV0["repository_binding"]) => boolean | Promise<boolean>;
}): Promise<MintTrustedCanonicalHistoryBoundaryV4OutcomeV0> {
  const genesisCheck = await verifyGenesisEnvelopeV4V0(input.genesis, input.reference_validator);
  if (!genesisCheck.ok) {
    return { kind: "REJECTED", code: "INVALID_GENESIS", detail: genesisCheck.error.detail };
  }
  const headCheck = validateTrustedCanonicalHeadInputV0(input.head);
  if (!headCheck.ok) {
    return { kind: "REJECTED", code: "INVALID_TRUSTED_HEAD", detail: headCheck.error.detail };
  }
  if (headCheck.head.subject_id !== input.genesis.snapshot.identity.subject_id) {
    return { kind: "REJECTED", code: "INVALID_TRUSTED_HEAD", detail: "trusted head subject does not match v4 genesis" };
  }
  const receipt: TrustedCanonicalHistoryBoundaryReceiptV0<V4PersistenceEnvelopeV0> = {
    schema_version: TRUSTED_CANONICAL_HISTORY_BOUNDARY_SCHEMA_VERSION_V0,
    genesis: input.genesis,
    head: input.head
  };
  deepFreeze(receipt);
  trustedBoundaries.add(receipt);
  return { kind: "MINTED", receipt };
}

/** WeakSet admission: only issuer-minted receipts are trusted. */
export function isTrustedCanonicalHistoryBoundaryReceiptV0(
  value: unknown
): value is TrustedCanonicalHistoryBoundaryAnyVersionReceiptV0 {
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

/** Exact explicit-foundation v4 genesis law. */
export async function verifyGenesisEnvelopeV4V0(
  envelope: V4PersistenceEnvelopeV0,
  referenceValidator?: (
    binding: V4PersistenceEnvelopeV0["repository_binding"]
  ) => boolean | Promise<boolean>
): Promise<{ readonly ok: true } | { readonly ok: false; readonly error: { readonly detail: string } }> {
  const failGenesis = (detail: string) => ({ ok: false as const, error: { detail } });
  if (typeof envelope !== "object" || envelope === null) return failGenesis("v4 genesis envelope: expected object");
  const keys = Object.keys(envelope).sort();
  const expectedKeys = [
    "full_checksum",
    "mode",
    "repository_binding",
    "schema_version",
    "snapshot",
    "snapshot_hash",
    "state_hash"
  ];
  if (keys.length !== expectedKeys.length || keys.some((key, index) => key !== expectedKeys[index])) {
    return failGenesis("v4 genesis envelope: exact 7-field materializer shape required");
  }
  if (envelope.schema_version !== "subject-state-v4-persistence-envelope-v0") {
    return failGenesis("v4 genesis envelope schema_version");
  }
  if (envelope.mode !== "EXPLICIT_V4_FOUNDATION_V0") {
    return failGenesis("v4 genesis envelope mode");
  }
  const stateCheck = validateSubjectStateV4(envelope.snapshot);
  if (!stateCheck.ok) return failGenesis(`v4 genesis snapshot: ${stateCheck.error.detail}`);
  const snapshot = stateCheck.value;
  const rm = snapshot.runtime_metadata;
  const genesisLaw =
    rm.state_revision === 0 &&
    rm.logical_time === 0 &&
    rm.created_at === 0 &&
    rm.updated_at === 0 &&
    rm.last_transition_time === null &&
    rm.last_transition_type === null &&
    rm.schema_lineage === "subject-state-v4" &&
    snapshot.affect.schema_version === "canonical-affect-v0" &&
    snapshot.affect.valence === 0 &&
    snapshot.affect.activation === 0.2 &&
    !("mood" in snapshot) &&
    snapshot.mechanism_config.affect_profile.profile_id === "BOUNDED_AFFECT_DYNAMICS_V0" &&
    snapshot.mechanism_config.affect_profile.timebase === "tick" &&
    snapshot.trace_window.trace_window_schema_version === "trace-window-v1" &&
    snapshot.trace_window.capacity === 64 &&
    snapshot.trace_window.cursor.last_history_sequence === 0 &&
    snapshot.trace_window.cursor.offloaded_through_sequence === 0 &&
    snapshot.trace_window.cursor.offloaded_through_trace_ref === null &&
    snapshot.trace_window.entries.length === 0;
  if (!genesisLaw) return failGenesis("v4 genesis revision/time/baseline/profile/trace law failed");
  if (
    envelope.repository_binding.repository_revision !== "R0" ||
    envelope.repository_binding.repository_revision !== snapshot.memory_state.repository_revision
  ) {
    return failGenesis("v4 genesis requires the exact snapshot R0 repository binding");
  }
  if (referenceValidator !== undefined && await referenceValidator(envelope.repository_binding) !== true) {
    return failGenesis("v4 genesis R0 repository binding failed trusted validation");
  }
  const fullChecksum = await fullSnapshotChecksumAnyVersion(snapshot);
  if (fullChecksum !== envelope.full_checksum) return failGenesis("v4 genesis full checksum does not recompute");
  const stateHashValue = await stateHashAnyVersion(snapshot);
  if (stateHashValue !== envelope.state_hash) return failGenesis("v4 genesis state hash does not recompute");
  const snapshotHashValue = await snapshotHashAnyVersion(snapshot, {
    state_hash: stateHashValue,
    subject_id: snapshot.identity.subject_id,
    state_revision: 0,
    trace_cursor: snapshot.trace_window.cursor,
    last_trace_ref: null
  });
  if (snapshotHashValue !== envelope.snapshot_hash) return failGenesis("v4 genesis snapshot hash does not recompute");
  return { ok: true };
}

export async function verifyGenesisEnvelopeAnyVersionV0(
  envelope: TrustedCanonicalGenesisEnvelopeAnyVersionV0
): Promise<{ readonly ok: true } | { readonly ok: false; readonly error: { readonly detail: string } }> {
  const snapshot = envelope.snapshot as SubjectStateAnyVersionV0;
  if (snapshot.schema_version === "subject-state-v3") {
    if (envelope.schema_version !== "subject-persistence-envelope-v1") {
      return { ok: false, error: { detail: "v3 genesis requires subject-persistence-envelope-v1" } };
    }
    return verifyGenesisEnvelopeV0(envelope as PersistedSubjectEnvelopeV1);
  }
  if (snapshot.schema_version === "subject-state-v4") {
    if (envelope.schema_version !== "subject-state-v4-persistence-envelope-v0") {
      return { ok: false, error: { detail: "v4 genesis requires the explicit foundation envelope" } };
    }
    return verifyGenesisEnvelopeV4V0(envelope as V4PersistenceEnvelopeV0);
  }
  return { ok: false, error: { detail: "genesis snapshot schema_version is unsupported" } };
}

export function readTrustedGenesisIntegrityV0(
  envelope: TrustedCanonicalGenesisEnvelopeAnyVersionV0
): {
  readonly snapshot: SubjectStateAnyVersionV0;
  readonly full_snapshot_checksum: HashV1;
  readonly state_hash: HashV1;
  readonly snapshot_hash: HashV1;
} {
  return {
    snapshot: envelope.snapshot,
    full_snapshot_checksum: "full_snapshot_checksum" in envelope
      ? envelope.full_snapshot_checksum
      : envelope.full_checksum,
    state_hash: envelope.state_hash,
    snapshot_hash: envelope.snapshot_hash
  };
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
