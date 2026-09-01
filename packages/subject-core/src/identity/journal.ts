/**
 * P2.3 Pre-Learning P0-1 — TransitionIdentityJournal (reference implementation).
 * Source: docs/implementation/p2-1-contract-freeze.md §14.1–§14.3.
 *
 * Durable semantics over in-memory state:
 * - `reserveIdentity` routes NEW_RESERVED / SAME_OPEN_OR_RETRY / SAME_TERMINAL_COMMITTED /
 *   SAME_TERMINAL_NO_OP / REUSE_CONFLICT_PENDING by first-seen header + fingerprint.
 * - Records carry append-only attempts, reuse-conflict successors and single-assignment
 *   terminal fields; every successor bumps `record_version` exactly once under CAS.
 * - COMMITTED terminals are authoritative in AtomicCommitBundleV1.transition_record:
 *   `rebuildFromCommittedBundles` reconstructs terminal records after "restart", so a
 *   changed payload with the same ID is still detected without trace_window and
 *   without relying on runtime memory.
 * - The journal NEVER reads canonical state itself: position facts (revision/logical
 *   time/state hash/snapshot hash) enter `recordReuseConflict` explicitly from the
 *   caller (subject-core loads them, §14.1).
 * - Optional host-side persistence: `exportState` returns a deep-frozen snapshot
 *   and `importState` FULLY validates every record — closed shape, branded
 *   scalars, terminal pairing AND frozen transition-identity SEMANTICS (§14.2/
 *   §14.3 attempt status invariants, terminal attempt/result agreement, OPEN
 *   emptiness, impossible reuse conflicts, record-version floor) — before
 *   applying anything. One invalid record rejects the whole batch, so a
 *   structurally valid but semantically forged terminal record can never be
 *   injected; the first-seen sequence counter is recovered deterministically so
 *   restarted journals never collide with pre-restart identities. COMMITTED
 *   records additionally rebuild from the authoritative store.
 */

import type {
  AuthoritativeTransitionRecordV1,
  TransitionAttemptV1,
  TransitionReuseConflictV1,
  AuditEventV1,
  ReservationRoute
} from "../types/identity.js";
import type { HashV1, HistorySequenceV0, IdentifierV0, LogicalTimeV0, StateRevisionV0, TransitionIdV0 } from "../types/scalars.js";
import type { CanonicalRefV0 } from "../types/ref.js";
import { TRANSITION_TYPES, type TransitionType } from "../types/enums.js";
import type { AtomicCommitBundleV1 } from "../types/persistence.js";
import { deriveRef } from "../canonical/hash.js";
import { fail, ok, type ValidationResult } from "../validation/result.js";
import {
  isNumber,
  isRecord,
  isString,
  validateHash,
  validateHistorySequence,
  validateIdentifier,
  validateLogicalTime,
  validateStateRevision,
  parseRef
} from "../validation/scalars.js";

const AUDIT_ID_PROJECTION = "characteros-next/subject-core/audit-id/v1";
const RESULT_ID_PROJECTION = "characteros-next/subject-core/result-id/v1";

export interface ReserveIdentityInput {
  readonly transition_id: TransitionIdV0;
  readonly subject_id: IdentifierV0;
  readonly transition_type: TransitionType;
  readonly proposal_ref: CanonicalRefV0;
  readonly payload_fingerprint: HashV1;
}

export type ReserveIdentityOutcome =
  | { readonly route: "NEW_RESERVED" }
  | { readonly route: "SAME_OPEN_OR_RETRY" }
  | { readonly route: "SAME_TERMINAL_COMMITTED" }
  | { readonly route: "SAME_TERMINAL_NO_OP" }
  | { readonly route: "REUSE_CONFLICT_PENDING" };

export interface ReuseConflictInput {
  readonly transition_id: TransitionIdV0;
  readonly attempted_subject_id: IdentifierV0;
  readonly attempted_transition_type: TransitionType;
  readonly attempted_proposal_ref: CanonicalRefV0;
  readonly attempted_payload_fingerprint: HashV1;
  /** Caller-loaded canonical position facts (journal never reads state). */
  readonly revision_before: number;
  readonly logical_time_before: number;
  readonly state_hash_before: HashV1;
  readonly snapshot_hash_before: HashV1;
}

export interface ReuseConflictRecorded {
  readonly conflict: TransitionReuseConflictV1;
  readonly audit: AuditEventV1;
}

export interface TransitionIdentityJournalPort {
  reserveIdentity(input: ReserveIdentityInput): Promise<ReserveIdentityOutcome>;
  readRecord(transitionId: TransitionIdV0): Promise<AuthoritativeTransitionRecordV1 | null>;
  /**
   * CAS append of one attempt + optional terminal fields. Returns false when the
   * expected record version is stale (race); callers reconcile.
   */
  appendAttempt(
    transitionId: TransitionIdV0,
    expectedRecordVersion: number,
    attempt: TransitionAttemptV1,
    terminal?: { readonly status: "COMMITTED" | "NO_OP"; readonly result_ref: CanonicalRefV0 }
  ): Promise<boolean>;
  /** Explicit caller-bound reuse-conflict recording (§14.1). */
  recordReuseConflict(input: ReuseConflictInput): Promise<ReuseConflictRecorded>;
  /** Rebuild COMMITTED terminal records from authoritative bundles (restart recovery). */
  rebuildFromCommittedBundles(bundles: readonly AtomicCommitBundleV1[]): void;
  /** Host-side persistence round-trip. */
  exportState(): AuthoritativeTransitionRecordV1[];
  importState(records: readonly AuthoritativeTransitionRecordV1[]): void;
}

function stableTupleKey(input: ReuseConflictInput): string {
  return [
    input.attempted_subject_id,
    input.attempted_transition_type,
    input.attempted_proposal_ref,
    input.attempted_payload_fingerprint
  ].join("\u0000");
}

/** §16 hardening error mapping: host-supplied journal bodies are a trust boundary. */
function importIntegrity(detail: string): Error {
  return new Error(`COMMIT_CHAIN_INTEGRITY_FAILURE/SS-RESTORE-001: ${detail}`);
}

type Check = ValidationResult<void>;

function asCheck(r: ValidationResult<unknown>): Check {
  return r.ok ? ok(undefined) : fail(r.error.error_code, r.error.reason, r.error.detail);
}

function closedKeys(o: Record<string, unknown>, allowed: readonly string[], d: string): Check {
  for (const key of Object.keys(o)) {
    if (!allowed.includes(key)) return fail("COMMIT_CHAIN_INTEGRITY_FAILURE", "SS-RESTORE-001", `${d}.${key}: unknown key`);
  }
  return ok(undefined);
}

function literal(v: unknown, want: string, d: string): Check {
  return v === want
    ? ok(undefined)
    : fail("COMMIT_CHAIN_INTEGRITY_FAILURE", "SS-RESTORE-001", `${d}: expected ${want}`);
}

function oneOf(v: unknown, set: readonly string[], d: string): Check {
  return typeof v === "string" && set.includes(v)
    ? ok(undefined)
    : fail("COMMIT_CHAIN_INTEGRITY_FAILURE", "SS-RESTORE-001", `${d}: invalid enum`);
}

function positiveSafeInteger(v: unknown, d: string): Check {
  return typeof v === "number" && Number.isSafeInteger(v) && v >= 1
    ? ok(undefined)
    : fail("COMMIT_CHAIN_INTEGRITY_FAILURE", "SS-RESTORE-001", `${d}: expected positive safe integer`);
}

function refOrNull(v: unknown, d: string): Check {
  if (v === null) return ok(undefined);
  if (!isString(v)) return fail("COMMIT_CHAIN_INTEGRITY_FAILURE", "SS-RESTORE-001", `${d}: expected ref or null`);
  return asCheck(parseRef(v, d));
}

function stringOrNull(v: unknown, d: string): Check {
  if (v === null) return ok(undefined);
  return isString(v) && v.length > 0
    ? ok(undefined)
    : fail("COMMIT_CHAIN_INTEGRITY_FAILURE", "SS-RESTORE-001", `${d}: expected nonempty string or null`);
}

const IMPORT_TRANSITION_TYPES: readonly string[] = TRANSITION_TYPES;
const IMPORT_ATTEMPT_STATUSES: readonly string[] = ["REJECTED", "ABORTED", "NO_OP", "COMMITTED"];

const RECORD_KEYS: readonly string[] = [
  "schema_version",
  "record_version",
  "transition_id",
  "subject_id",
  "transition_type",
  "proposal_ref",
  "payload_fingerprint",
  "fingerprint_version",
  "first_seen_sequence",
  "attempts",
  "reuse_conflicts",
  "terminal_status",
  "terminal_result_ref"
];

const ATTEMPT_KEYS: readonly string[] = [
  "attempt_sequence",
  "status",
  "revision_before",
  "revision_after",
  "state_hash_before",
  "state_hash_after",
  "result_ref",
  "prepared_result_ref",
  "trace_ref",
  "audit_ref",
  "error_code",
  "reason"
];

const CONFLICT_KEYS: readonly string[] = [
  "conflict_sequence",
  "attempted_subject_id",
  "attempted_transition_type",
  "attempted_proposal_ref",
  "attempted_payload_fingerprint",
  "revision_before",
  "logical_time_before",
  "state_hash_before",
  "snapshot_hash_before",
  "error_code",
  "reason",
  "audit_ref",
  "result_ref"
];

function hashField(v: unknown, d: string): Check {
  if (!isString(v)) return fail("COMMIT_CHAIN_INTEGRITY_FAILURE", "SS-RESTORE-001", `${d}: expected hash`);
  return asCheck(validateHash(v, d));
}

function validateImportedAttempt(
  v: unknown,
  d: string,
  index: number,
  transitionType: TransitionType
): Check {
  if (!isRecord(v)) return fail("COMMIT_CHAIN_INTEGRITY_FAILURE", "SS-RESTORE-001", `${d}: expected object`);
  const o = v;
  const c = closedKeys(o, ATTEMPT_KEYS, d);
  if (!c.ok) return c;
  const seq = positiveSafeInteger(o["attempt_sequence"], `${d}.attempt_sequence`);
  if (!seq.ok) return seq;
  if (o["attempt_sequence"] !== index + 1) {
    return fail("COMMIT_CHAIN_INTEGRITY_FAILURE", "SS-RESTORE-001", `${d}.attempt_sequence must equal ${index + 1}`);
  }
  const st = oneOf(o["status"], IMPORT_ATTEMPT_STATUSES, `${d}.status`);
  if (!st.ok) return st;
  const rb = asCheck(validateStateRevision(o["revision_before"] as number, `${d}.revision_before`));
  if (!rb.ok) return rb;
  const ra = asCheck(validateStateRevision(o["revision_after"] as number, `${d}.revision_after`));
  if (!ra.ok) return ra;
  const hb = hashField(o["state_hash_before"], `${d}.state_hash_before`);
  if (!hb.ok) return hb;
  const ha = hashField(o["state_hash_after"], `${d}.state_hash_after`);
  if (!ha.ok) return ha;
  const resultRef = isString(o["result_ref"]) ? asCheck(parseRef(o["result_ref"], `${d}.result_ref`)) : fail("COMMIT_CHAIN_INTEGRITY_FAILURE", "SS-RESTORE-001", `${d}.result_ref: expected ref`);
  if (!resultRef.ok) return resultRef;
  const prepRef = isString(o["prepared_result_ref"]) ? asCheck(parseRef(o["prepared_result_ref"], `${d}.prepared_result_ref`)) : fail("COMMIT_CHAIN_INTEGRITY_FAILURE", "SS-RESTORE-001", `${d}.prepared_result_ref: expected ref`);
  if (!prepRef.ok) return prepRef;
  const tr = refOrNull(o["trace_ref"], `${d}.trace_ref`);
  if (!tr.ok) return tr;
  const ar = refOrNull(o["audit_ref"], `${d}.audit_ref`);
  if (!ar.ok) return ar;
  const ec = stringOrNull(o["error_code"], `${d}.error_code`);
  if (!ec.ok) return ec;
  const reason = stringOrNull(o["reason"], `${d}.reason`);
  if (!reason.ok) return reason;
  return attemptStatusInvariants(o, d, transitionType);
}

/**
 * §14.3 attempt status invariants (Round-3 B3): structural validity alone cannot
 * prove a transition happened — the frozen status semantics must hold too.
 */
function attemptStatusInvariants(
  o: Record<string, unknown>,
  d: string,
  transitionType: TransitionType
): Check {
  const status = o["status"];
  if (status === "COMMITTED") {
    if ((o["revision_after"] as number) !== (o["revision_before"] as number) + 1) {
      return fail("COMMIT_CHAIN_INTEGRITY_FAILURE", "SS-RESTORE-001", `${d}: COMMITTED attempt must advance the revision by exactly one`);
    }
    if (o["trace_ref"] === null) {
      return fail("COMMIT_CHAIN_INTEGRITY_FAILURE", "SS-RESTORE-001", `${d}: COMMITTED attempt requires a trace ref`);
    }
    if (o["audit_ref"] !== null || o["error_code"] !== null || o["reason"] !== null) {
      return fail("COMMIT_CHAIN_INTEGRITY_FAILURE", "SS-RESTORE-001", `${d}: COMMITTED attempt carries audit/error/reason`);
    }
    return ok(undefined);
  }
  if (status === "NO_OP") {
    if (
      o["revision_after"] !== o["revision_before"] ||
      o["state_hash_after"] !== o["state_hash_before"]
    ) {
      return fail("COMMIT_CHAIN_INTEGRITY_FAILURE", "SS-RESTORE-001", `${d}: NO_OP attempt must keep revision and state hash unchanged`);
    }
    if (o["trace_ref"] !== null || o["audit_ref"] !== null || o["error_code"] !== null) {
      return fail("COMMIT_CHAIN_INTEGRITY_FAILURE", "SS-RESTORE-001", `${d}: NO_OP attempt carries trace/audit/error`);
    }
    if (transitionType === "Time") {
      return literal(o["reason"], "TIME-NOOP-001", `${d}.reason`);
    }
    if (transitionType === "CognitionAction" || transitionType === "Belief") {
      return literal(o["reason"], "TR-ATOMIC-001", `${d}.reason`);
    }
    return fail(
      "COMMIT_CHAIN_INTEGRITY_FAILURE",
      "SS-RESTORE-001",
      `${d}: ${transitionType} cannot terminalize as NO_OP`
    );
  }
  // REJECTED / ABORTED: no authority advance, durable audit trail required.
  if (
    o["revision_after"] !== o["revision_before"] ||
    o["state_hash_after"] !== o["state_hash_before"]
  ) {
    return fail("COMMIT_CHAIN_INTEGRITY_FAILURE", "SS-RESTORE-001", `${d}: ${String(status)} attempt must keep revision and state hash unchanged`);
  }
  if (o["trace_ref"] !== null) {
    return fail("COMMIT_CHAIN_INTEGRITY_FAILURE", "SS-RESTORE-001", `${d}: ${String(status)} attempt carries a trace ref`);
  }
  if (o["audit_ref"] === null || o["error_code"] === null || o["reason"] === null) {
    return fail("COMMIT_CHAIN_INTEGRITY_FAILURE", "SS-RESTORE-001", `${d}: ${String(status)} attempt requires audit/error/reason`);
  }
  return ok(undefined);
}

function validateImportedConflict(v: unknown, d: string, index: number): Check {
  if (!isRecord(v)) return fail("COMMIT_CHAIN_INTEGRITY_FAILURE", "SS-RESTORE-001", `${d}: expected object`);
  const o = v;
  const c = closedKeys(o, CONFLICT_KEYS, d);
  if (!c.ok) return c;
  const seq = positiveSafeInteger(o["conflict_sequence"], `${d}.conflict_sequence`);
  if (!seq.ok) return seq;
  if (o["conflict_sequence"] !== index + 1) {
    return fail("COMMIT_CHAIN_INTEGRITY_FAILURE", "SS-RESTORE-001", `${d}.conflict_sequence must equal ${index + 1}`);
  }
  if (!isString(o["attempted_subject_id"])) {
    return fail("COMMIT_CHAIN_INTEGRITY_FAILURE", "SS-RESTORE-001", `${d}.attempted_subject_id: expected identifier`);
  }
  const sid = asCheck(validateIdentifier(o["attempted_subject_id"], `${d}.attempted_subject_id`));
  if (!sid.ok) return sid;
  const tt = oneOf(o["attempted_transition_type"], IMPORT_TRANSITION_TYPES, `${d}.attempted_transition_type`);
  if (!tt.ok) return tt;
  const pref = isString(o["attempted_proposal_ref"]) ? asCheck(parseRef(o["attempted_proposal_ref"], `${d}.attempted_proposal_ref`)) : fail("COMMIT_CHAIN_INTEGRITY_FAILURE", "SS-RESTORE-001", `${d}.attempted_proposal_ref: expected ref`);
  if (!pref.ok) return pref;
  const fp = hashField(o["attempted_payload_fingerprint"], `${d}.attempted_payload_fingerprint`);
  if (!fp.ok) return fp;
  const rb = asCheck(validateStateRevision(o["revision_before"] as number, `${d}.revision_before`));
  if (!rb.ok) return rb;
  const lt = asCheck(validateLogicalTime(o["logical_time_before"] as number, `${d}.logical_time_before`));
  if (!lt.ok) return lt;
  const hb = hashField(o["state_hash_before"], `${d}.state_hash_before`);
  if (!hb.ok) return hb;
  const sh = hashField(o["snapshot_hash_before"], `${d}.snapshot_hash_before`);
  if (!sh.ok) return sh;
  const ec = literal(o["error_code"], "TRANSITION_ID_REUSE", `${d}.error_code`);
  if (!ec.ok) return ec;
  const reason = literal(o["reason"], "IDEM-REUSE-001", `${d}.reason`);
  if (!reason.ok) return reason;
  const auditRef = isString(o["audit_ref"]) ? asCheck(parseRef(o["audit_ref"], `${d}.audit_ref`)) : fail("COMMIT_CHAIN_INTEGRITY_FAILURE", "SS-RESTORE-001", `${d}.audit_ref: expected ref`);
  if (!auditRef.ok) return auditRef;
  const resultRef = isString(o["result_ref"]) ? asCheck(parseRef(o["result_ref"], `${d}.result_ref`)) : fail("COMMIT_CHAIN_INTEGRITY_FAILURE", "SS-RESTORE-001", `${d}.result_ref: expected ref`);
  if (!resultRef.ok) return resultRef;
  return ok(undefined);
}

/**
 * §14.2/§14.3 terminal semantics (Round-3 B3): a structurally valid record can
 * still be FORGED — terminal COMMITTED/NO_OP must correspond to a genuine last
 * attempt whose authoritative fields agree with the terminal fields, attempts
 * may be empty only while OPEN, only the last attempt may be terminal, and a
 * reuse conflict can never replay the record's own reserved identity.
 */
function validateRecordTerminalSemantics(o: Record<string, unknown>, d: string): Check {
  const attempts = o["attempts"] as unknown[];
  const conflicts = o["reuse_conflicts"] as unknown[];
  const terminal = o["terminal_status"];

  // record_version counts reservation + one bump per successor event.
  const minVersion = 1 + attempts.length + conflicts.length;
  if ((o["record_version"] as number) < minVersion) {
    return fail("COMMIT_CHAIN_INTEGRITY_FAILURE", "SS-RESTORE-001", `${d}.record_version inconsistent with journal history (expected >= ${minVersion})`);
  }

  // OPEN records never carry terminal attempts.
  if (terminal === null) {
    for (let i = 0; i < attempts.length; i++) {
      const status = (attempts[i] as Record<string, unknown>)["status"];
      if (status === "COMMITTED" || status === "NO_OP") {
        return fail("COMMIT_CHAIN_INTEGRITY_FAILURE", "SS-RESTORE-001", `${d}: OPEN record carries a terminal ${String(status)} attempt`);
      }
    }
  }

  if (terminal !== null) {
    if (attempts.length === 0) {
      return fail("COMMIT_CHAIN_INTEGRITY_FAILURE", "SS-RESTORE-001", `${d}: terminal ${String(terminal)} record without any attempt`);
    }
    const last = attempts[attempts.length - 1] as Record<string, unknown>;
    if (last["status"] !== terminal) {
      return fail("COMMIT_CHAIN_INTEGRITY_FAILURE", "SS-RESTORE-001", `${d}: terminal ${String(terminal)} requires the last attempt to be ${String(terminal)}`);
    }
    if (o["terminal_result_ref"] !== last["result_ref"]) {
      return fail("COMMIT_CHAIN_INTEGRITY_FAILURE", "SS-RESTORE-001", `${d}.terminal_result_ref disagrees with the last ${String(terminal)} attempt`);
    }
    // Single-assignment terminal: no earlier attempt may already be terminal.
    for (let i = 0; i < attempts.length - 1; i++) {
      const status = (attempts[i] as Record<string, unknown>)["status"];
      if (status === "COMMITTED" || status === "NO_OP") {
        return fail("COMMIT_CHAIN_INTEGRITY_FAILURE", "SS-RESTORE-001", `${d}: attempt ${i + 1} appends after a terminal attempt`);
      }
    }
  }

  // A reuse conflict exists ONLY for a differing identity/fingerprint; replaying
  // the record's own reserved tuple is impossible under the frozen routing rules.
  for (let i = 0; i < conflicts.length; i++) {
    const conflict = conflicts[i] as Record<string, unknown>;
    if (
      conflict["attempted_proposal_ref"] === o["proposal_ref"] &&
      conflict["attempted_payload_fingerprint"] === o["payload_fingerprint"]
    ) {
      return fail("COMMIT_CHAIN_INTEGRITY_FAILURE", "SS-RESTORE-001", `${d}.reuse_conflicts[${i}] replays the reserved identity tuple`);
    }
  }
  return ok(undefined);
}

/** Full structural validation of one host-supplied journal record (§16). */
function validateImportedRecord(v: unknown, index: number): Check {
  const d = `journalImport[${index}]`;
  if (!isRecord(v)) return fail("COMMIT_CHAIN_INTEGRITY_FAILURE", "SS-RESTORE-001", `${d}: expected object`);
  const o = v;
  const c = closedKeys(o, RECORD_KEYS, d);
  if (!c.ok) return c;
  const sv = literal(o["schema_version"], "transition-record-v1", `${d}.schema_version`);
  if (!sv.ok) return sv;
  const rv = positiveSafeInteger(o["record_version"], `${d}.record_version`);
  if (!rv.ok) return rv;
  if (!isString(o["transition_id"])) {
    return fail("COMMIT_CHAIN_INTEGRITY_FAILURE", "SS-RESTORE-001", `${d}.transition_id: expected identifier`);
  }
  const tid = asCheck(validateIdentifier(o["transition_id"], `${d}.transition_id`));
  if (!tid.ok) return tid;
  if (!isString(o["subject_id"])) {
    return fail("COMMIT_CHAIN_INTEGRITY_FAILURE", "SS-RESTORE-001", `${d}.subject_id: expected identifier`);
  }
  const sid = asCheck(validateIdentifier(o["subject_id"], `${d}.subject_id`));
  if (!sid.ok) return sid;
  const tt = oneOf(o["transition_type"], IMPORT_TRANSITION_TYPES, `${d}.transition_type`);
  if (!tt.ok) return tt;
  if (!isString(o["proposal_ref"])) {
    return fail("COMMIT_CHAIN_INTEGRITY_FAILURE", "SS-RESTORE-001", `${d}.proposal_ref: expected ref`);
  }
  const pref = asCheck(parseRef(o["proposal_ref"], `${d}.proposal_ref`));
  if (!pref.ok) return pref;
  const fp = hashField(o["payload_fingerprint"], `${d}.payload_fingerprint`);
  if (!fp.ok) return fp;
  const fv = literal(o["fingerprint_version"], "proposal-fingerprint-v1", `${d}.fingerprint_version`);
  if (!fv.ok) return fv;
  if (!isNumber(o["first_seen_sequence"])) {
    return fail("COMMIT_CHAIN_INTEGRITY_FAILURE", "SS-RESTORE-001", `${d}.first_seen_sequence: expected number`);
  }
  const fss = asCheck(validateHistorySequence(o["first_seen_sequence"], `${d}.first_seen_sequence`));
  if (!fss.ok) return fss;
  if (!Array.isArray(o["attempts"])) {
    return fail("COMMIT_CHAIN_INTEGRITY_FAILURE", "SS-RESTORE-001", `${d}.attempts: expected array`);
  }
  for (let i = 0; i < o["attempts"].length; i++) {
    const a = validateImportedAttempt(
      o["attempts"][i],
      `${d}.attempts[${i}]`,
      i,
      o["transition_type"] as TransitionType
    );
    if (!a.ok) return a;
  }
  if (!Array.isArray(o["reuse_conflicts"])) {
    return fail("COMMIT_CHAIN_INTEGRITY_FAILURE", "SS-RESTORE-001", `${d}.reuse_conflicts: expected array`);
  }
  for (let i = 0; i < o["reuse_conflicts"].length; i++) {
    const cf = validateImportedConflict(o["reuse_conflicts"][i], `${d}.reuse_conflicts[${i}]`, i);
    if (!cf.ok) return cf;
  }
  // Single-assignment terminal pairing: status and result ref rise together.
  const terminal = o["terminal_status"];
  if (terminal === null) {
    if (o["terminal_result_ref"] !== null) {
      return fail("COMMIT_CHAIN_INTEGRITY_FAILURE", "SS-RESTORE-001", `${d}.terminal_result_ref without terminal_status`);
    }
    return validateRecordTerminalSemantics(o, d);
  }
  const ts = oneOf(terminal, ["COMMITTED", "NO_OP"], `${d}.terminal_status`);
  if (!ts.ok) return ts;
  if (!isString(o["terminal_result_ref"])) {
    return fail("COMMIT_CHAIN_INTEGRITY_FAILURE", "SS-RESTORE-001", `${d}.terminal_result_ref required for terminal ${String(terminal)}`);
  }
  const refCheck = asCheck(parseRef(o["terminal_result_ref"], `${d}.terminal_result_ref`));
  if (!refCheck.ok) return refCheck;
  return validateRecordTerminalSemantics(o, d);
}

function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  if (Object.isFrozen(value)) return;
  Object.freeze(value);
  for (const key of Object.keys(value as Record<string, unknown>)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
  if (Array.isArray(value)) {
    for (const element of value) deepFreeze(element);
  }
}

export class InMemoryTransitionIdentityJournal implements TransitionIdentityJournalPort {
  private readonly records = new Map<TransitionIdV0, AuthoritativeTransitionRecordV1>();
  private sequence = 0;

  private nextSequence(): number {
    this.sequence += 1;
    return this.sequence;
  }

  /**
   * Single storage point (§16): every stored record is deep-frozen, so neither
   * readRecord nor exportState can leak a mutable authority surface.
   */
  private setRecord(record: AuthoritativeTransitionRecordV1): void {
    deepFreeze(record);
    this.records.set(record.transition_id, record);
  }

  async reserveIdentity(input: ReserveIdentityInput): Promise<ReserveIdentityOutcome> {
    const existing = this.records.get(input.transition_id);
    if (existing === undefined) {
      this.setRecord({
        schema_version: "transition-record-v1",
        record_version: 1,
        transition_id: input.transition_id,
        subject_id: input.subject_id,
        transition_type: input.transition_type,
        proposal_ref: input.proposal_ref,
        payload_fingerprint: input.payload_fingerprint,
        fingerprint_version: "proposal-fingerprint-v1",
        first_seen_sequence: this.nextSequence() as HistorySequenceV0,
        attempts: [],
        reuse_conflicts: [],
        terminal_status: null,
        terminal_result_ref: null
      });
      return { route: "NEW_RESERVED" };
    }
    const sameIdentity =
      existing.subject_id === input.subject_id &&
      existing.transition_type === input.transition_type &&
      existing.proposal_ref === input.proposal_ref &&
      existing.payload_fingerprint === input.payload_fingerprint;
    if (!sameIdentity) {
      return { route: "REUSE_CONFLICT_PENDING" };
    }
    if (existing.terminal_status === "COMMITTED") {
      return { route: "SAME_TERMINAL_COMMITTED" };
    }
    if (existing.terminal_status === "NO_OP") {
      return { route: "SAME_TERMINAL_NO_OP" };
    }
    return { route: "SAME_OPEN_OR_RETRY" };
  }

  async readRecord(transitionId: TransitionIdV0): Promise<AuthoritativeTransitionRecordV1 | null> {
    return this.records.get(transitionId) ?? null;
  }

  async appendAttempt(
    transitionId: TransitionIdV0,
    expectedRecordVersion: number,
    attempt: TransitionAttemptV1,
    terminal?: { readonly status: "COMMITTED" | "NO_OP"; readonly result_ref: CanonicalRefV0 }
  ): Promise<boolean> {
    const record = this.records.get(transitionId);
    if (record === undefined || record.record_version !== expectedRecordVersion) {
      return false; // stale version — caller reconciles
    }
    if (record.terminal_status !== null) {
      return false; // single-assignment terminal
    }
    const next: AuthoritativeTransitionRecordV1 = {
      ...record,
      record_version: record.record_version + 1,
      attempts: [...record.attempts, attempt],
      terminal_status: terminal?.status ?? null,
      terminal_result_ref: terminal?.result_ref ?? null
    };
    this.setRecord(next);
    return true;
  }

  async recordReuseConflict(input: ReuseConflictInput): Promise<ReuseConflictRecorded> {
    const record = this.records.get(input.transition_id);
    if (record === undefined) {
      throw new Error("reuse conflict requires an existing reserved record");
    }
    // Idempotency key: the attempted tuple; first observed position is captured once.
    const attemptedTuple = stableTupleKey(input);
    const already = record.reuse_conflicts.find((conflict) => {
      const tuple = [
        conflict.attempted_subject_id,
        conflict.attempted_transition_type,
        conflict.attempted_proposal_ref,
        conflict.attempted_payload_fingerprint
      ].join("\u0000");
      return tuple === attemptedTuple;
    });
    if (already !== undefined) {
      return {
        conflict: already,
        audit: {
          schema_version: "audit-event-v1",
          audit_ref: already.audit_ref,
          subject_id: already.attempted_subject_id,
          transition_id: input.transition_id,
          payload_fingerprint: already.attempted_payload_fingerprint,
          attempt_sequence: already.conflict_sequence,
          status: "REUSE_CONFLICT",
          error_code: "TRANSITION_ID_REUSE",
          reason: "IDEM-REUSE-001",
          revision_before: already.revision_before,
          state_hash_before: already.state_hash_before
        }
      };
    }

    const conflictSequence = record.reuse_conflicts.length + 1;
    // §14.4 deterministic refs over exact projection bodies.
    const auditRef = (await deriveRef("audit", AUDIT_ID_PROJECTION, {
      subject_id: input.attempted_subject_id,
      transition_id: input.transition_id,
      payload_fingerprint: input.attempted_payload_fingerprint,
      attempt_sequence: conflictSequence,
      status: "REUSE_CONFLICT",
      revision_before: input.revision_before,
      state_hash_before: input.state_hash_before,
      error_code: "TRANSITION_ID_REUSE",
      reason: "IDEM-REUSE-001"
    })) as CanonicalRefV0;
    const audit: AuditEventV1 = {
      schema_version: "audit-event-v1",
      audit_ref: auditRef,
      subject_id: input.attempted_subject_id,
      transition_id: input.transition_id,
      payload_fingerprint: input.attempted_payload_fingerprint,
      attempt_sequence: conflictSequence,
      status: "REUSE_CONFLICT",
      error_code: "TRANSITION_ID_REUSE",
      reason: "IDEM-REUSE-001",
      revision_before: input.revision_before as StateRevisionV0,
      state_hash_before: input.state_hash_before
    };
    const conflictBody = {
      conflict_sequence: conflictSequence,
      attempted_subject_id: input.attempted_subject_id,
      attempted_transition_type: input.attempted_transition_type,
      attempted_proposal_ref: input.attempted_proposal_ref,
      attempted_payload_fingerprint: input.attempted_payload_fingerprint,
      revision_before: input.revision_before,
      logical_time_before: input.logical_time_before,
      state_hash_before: input.state_hash_before,
      snapshot_hash_before: input.snapshot_hash_before,
      error_code: "TRANSITION_ID_REUSE",
      reason: "IDEM-REUSE-001",
      audit_ref: auditRef
    };
    const resultRef = (await deriveRef("result", RESULT_ID_PROJECTION, conflictBody)) as CanonicalRefV0;
    const conflict = {
      ...conflictBody,
      revision_before: conflictBody.revision_before as StateRevisionV0,
      logical_time_before: conflictBody.logical_time_before as LogicalTimeV0,
      result_ref: resultRef
    } as unknown as TransitionReuseConflictV1;
    const next: AuthoritativeTransitionRecordV1 = {
      ...record,
      record_version: record.record_version + 1,
      reuse_conflicts: [...record.reuse_conflicts, conflict]
    };
    this.setRecord(next);
    return { conflict, audit };
  }

  rebuildFromCommittedBundles(bundles: readonly AtomicCommitBundleV1[]): void {
    for (const bundle of bundles) {
      const record = bundle.transition_record;
      const existing = this.records.get(record.transition_id);
      if (existing === undefined || existing.record_version < record.record_version) {
        this.setRecord(record);
        if (record.first_seen_sequence > this.sequence) {
          this.sequence = record.first_seen_sequence;
        }
      }
    }
  }

  exportState(): AuthoritativeTransitionRecordV1[] {
    // §16: the snapshot array is itself frozen; records are frozen at storage.
    const snapshot = [...this.records.values()];
    return Object.freeze(snapshot) as AuthoritativeTransitionRecordV1[];
  }

  importState(records: readonly AuthoritativeTransitionRecordV1[]): void {
    // §16 trust boundary: validate EVERY record before mutating anything —
    // one invalid record rejects the whole batch (no partial application, no
    // injectable invalid terminal).
    for (let i = 0; i < records.length; i++) {
      const check = validateImportedRecord(records[i], i);
      if (!check.ok) {
        throw importIntegrity(check.error.detail);
      }
    }
    for (const record of records) {
      const existing = this.records.get(record.transition_id);
      if (existing === undefined || existing.record_version < record.record_version) {
        this.setRecord(record);
      }
      // Deterministic sequence-counter recovery: first-seen sequences never
      // collide or regress across a restart.
      if (record.first_seen_sequence > this.sequence) {
        this.sequence = record.first_seen_sequence;
      }
    }
  }
}

/** Export the route literal type for typed consumers. */
export type { ReservationRoute };
