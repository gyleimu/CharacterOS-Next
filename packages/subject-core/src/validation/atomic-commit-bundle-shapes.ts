/**
 * Closed nested-shape validators shared by the AtomicCommitBundle V1/V2
 * single-record validators
 * (ATOMIC_COMMIT_BUNDLE_V2_AUTHORITY_SCHEMA_FOUNDATION, LEVEL_2).
 *
 * Shape-level only: closed key sets, frozen literals, and scalar/ref/hash
 * formats. Cross-field equalities that need whole-bundle context live in
 * `atomic-commit-bundle.ts`.
 */

import type { CanonicalCommitResultV1 } from "../types/result.js";
import type {
  AuthoritativeTransitionRecordV1,
  TransitionAttemptV1
} from "../types/identity.js";
import type { MutationHistoryLinkV1 } from "../types/persistence.js";
import type { RepositoryRevisionBindingV1 } from "../types/persistence.js";
import type { TraceEntryV1, TraceWindowV1 } from "../types/trace.js";
import type { CanonicalWriterAuthorityRecordV0, CanonicalWriterFamilyV0 } from "../types/writer-authority.js";
import {
  CANONICAL_WRITER_AUTHORITY_RECORD_SCHEMA_VERSION,
  CANONICAL_WRITER_FAMILIES_V0,
  CANONICAL_WRITER_FAMILY_CLASSES_V0
} from "../types/writer-authority.js";
import type { HashV1 } from "../types/scalars.js";
import type { RepositoryRevisionIdV0 } from "../types/scalars.js";
import type { CanonicalRefV0 } from "../types/ref.js";
import type { TransitionType } from "../types/enums.js";
import { TRANSITION_TYPES } from "../types/enums.js";
import { fail, ok, type ValidationResult } from "./result.js";
import {
  isNumber,
  isRecord,
  isString,
  validateHash,
  validateIdentifier,
  validateLogicalTime,
  validateRefArray,
  validateRefElement,
  validateStateRevision
} from "./scalars.js";

const SCHEMA = "SS-SCHEMA-001";

export function bundleClosedKeys(
  o: Record<string, unknown>,
  allowed: readonly string[],
  d: string
): ValidationResult<void> {
  const keys = Object.keys(o);
  for (const key of keys) {
    if (!allowed.includes(key)) {
      return fail("INVALID_SCHEMA", SCHEMA, `${d}.${key}: unknown key`);
    }
  }
  for (const key of allowed) {
    if (!keys.includes(key)) {
      return fail("INVALID_SCHEMA", SCHEMA, `${d}.${key}: missing key`);
    }
  }
  return ok(undefined);
}

export function bundleLit(v: unknown, want: string, d: string): ValidationResult<void> {
  if (v !== want) return fail("INVALID_SCHEMA", SCHEMA, `${d}: expected ${want}`);
  return ok(undefined);
}

export function bundleSafeInteger(v: unknown, d: string): ValidationResult<number> {
  if (!isNumber(v) || !Number.isSafeInteger(v) || v < 0) {
    return fail("INVALID_SCHEMA", SCHEMA, `${d}: nonnegative safe integer required`);
  }
  return ok(v);
}

export function bundleOptionalRef(
  v: unknown,
  d: string,
  kinds?: readonly string[]
): ValidationResult<CanonicalRefV0 | null> {
  if (v === null) return ok(null);
  return validateRefElement(v, d, kinds as never);
}

export function bundleOptionalHash(v: unknown, d: string): ValidationResult<HashV1 | null> {
  if (v === null) return ok(null);
  return validateHash(v as string, d);
}

export function bundleTransitionType(v: unknown, d: string): ValidationResult<TransitionType> {
  if (!isString(v) || !(TRANSITION_TYPES as readonly string[]).includes(v)) {
    return fail("INVALID_SCHEMA", SCHEMA, `${d}: invalid enum`);
  }
  return ok(v as TransitionType);
}

const TRACE_ENTRY_KEYS: readonly string[] = [
  "trace_schema_version",
  "trace_id",
  "history_sequence",
  "transition_id",
  "transition_type",
  "subject_id",
  "subject_revision_before",
  "subject_revision_after",
  "logical_time",
  "rule_ids",
  "cause_refs",
  "proposal_ref",
  "domain_mutations",
  "state_hash_before",
  "state_hash_after",
  "memory_revision_before",
  "memory_revision_after",
  "outcome"
];

const TRACE_WINDOW_KEYS: readonly string[] = [
  "trace_window_schema_version",
  "capacity",
  "cursor",
  "entries"
];

const TRACE_CURSOR_KEYS: readonly string[] = [
  "last_history_sequence",
  "offloaded_through_sequence",
  "offloaded_through_trace_ref"
];

const DOMAIN_MUTATION_KEYS: readonly string[] = ["producer", "domain", "layers", "field_changes"];
const FIELD_CHANGE_KEYS: readonly string[] = ["path", "operation"];

const MUTATION_HISTORY_LINK_KEYS: readonly string[] = [
  "history_sequence",
  "previous_trace_ref",
  "current_trace_ref"
];

const TRANSITION_RECORD_KEYS: readonly string[] = [
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

const TRANSITION_ATTEMPT_KEYS: readonly string[] = [
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

const REUSE_CONFLICT_KEYS: readonly string[] = [
  "conflict_sequence",
  "attempted_subject_id",
  "attempted_transition_type",
  "attempted_proposal_ref",
  "attempted_payload_fingerprint",
  "revision_before",
  "logical_time_before",
  "state_hash_before",
  "snapshot_hash_before"
];

const CANONICAL_RESULT_KEYS: readonly string[] = [
  "schema_version",
  "status",
  "transition_id",
  "subject_id",
  "payload_fingerprint",
  "previous_revision",
  "next_revision",
  "state_hash_before",
  "state_hash_after",
  "snapshot_hash_after",
  "trace_ref",
  "commit_ref",
  "result_ref"
];

const REPOSITORY_BINDING_KEYS: readonly string[] = [
  "repository_revision",
  "repository_revision_hash"
];

const WRITER_AUTHORITY_KEYS: readonly string[] = [
  "schema_version",
  "proposal_ref",
  "payload_fingerprint",
  "writer_family",
  "writer_class",
  "writer_schema_id",
  "writer_schema_fingerprint",
  "authorization_gate_id",
  "authorization_gate_fingerprint",
  "authority_payload",
  "authority_payload_hash"
];

export function validateTraceEntryShape(v: unknown, d: string): ValidationResult<TraceEntryV1> {
  if (!isRecord(v)) return fail("INVALID_SCHEMA", SCHEMA, `${d}: expected object`);
  const closed = bundleClosedKeys(v, TRACE_ENTRY_KEYS, d);
  if (!closed.ok) return closed;
  const sv = bundleLit(v["trace_schema_version"], "trace-v1", `${d}.trace_schema_version`);
  if (!sv.ok) return sv;
  const traceId = validateRefElement(v["trace_id"], `${d}.trace_id`, ["trace"]);
  if (!traceId.ok) return traceId;
  const seq = bundleSafeInteger(v["history_sequence"], `${d}.history_sequence`);
  if (!seq.ok) return seq;
  const tid = validateIdentifier(v["transition_id"] as string, `${d}.transition_id`);
  if (!tid.ok) return tid;
  const tt = bundleTransitionType(v["transition_type"], `${d}.transition_type`);
  if (!tt.ok) return tt;
  const sid = validateIdentifier(v["subject_id"] as string, `${d}.subject_id`);
  if (!sid.ok) return sid;
  const before = validateStateRevision(v["subject_revision_before"] as number, `${d}.subject_revision_before`);
  if (!before.ok) return before;
  const after = validateStateRevision(v["subject_revision_after"] as number, `${d}.subject_revision_after`);
  if (!after.ok) return after;
  const lt = validateLogicalTime(v["logical_time"] as number, `${d}.logical_time`);
  if (!lt.ok) return lt;
  if (!Array.isArray(v["rule_ids"]) || !v["rule_ids"].every((item) => isString(item))) {
    return fail("INVALID_SCHEMA", SCHEMA, `${d}.rule_ids: expected string array`);
  }
  const cause = validateRefArray(v["cause_refs"], `${d}.cause_refs`, { sorted: true });
  if (!cause.ok) return cause;
  const pr = validateRefElement(v["proposal_ref"], `${d}.proposal_ref`, ["proposal"]);
  if (!pr.ok) return pr;
  if (!Array.isArray(v["domain_mutations"])) {
    return fail("INVALID_SCHEMA", SCHEMA, `${d}.domain_mutations: expected array`);
  }
  for (let i = 0; i < v["domain_mutations"].length; i++) {
    const label = `${d}.domain_mutations[${i}]`;
    const mutation = v["domain_mutations"][i];
    if (!isRecord(mutation)) return fail("INVALID_SCHEMA", SCHEMA, `${label}: expected object`);
    const mc = bundleClosedKeys(mutation, DOMAIN_MUTATION_KEYS, label);
    if (!mc.ok) return mc;
    const producer = validateIdentifier(mutation["producer"] as string, `${label}.producer`);
    if (!producer.ok) return producer;
    if (!isString(mutation["domain"])) {
      return fail("INVALID_SCHEMA", SCHEMA, `${label}.domain: expected domain literal`);
    }
    if (!Array.isArray(mutation["layers"]) || !mutation["layers"].every((item) => isString(item))) {
      return fail("INVALID_SCHEMA", SCHEMA, `${label}.layers: expected string array`);
    }
    if (!Array.isArray(mutation["field_changes"])) {
      return fail("INVALID_SCHEMA", SCHEMA, `${label}.field_changes: expected array`);
    }
    for (let j = 0; j < mutation["field_changes"].length; j++) {
      const changeLabel = `${label}.field_changes[${j}]`;
      const change = mutation["field_changes"][j];
      if (!isRecord(change)) return fail("INVALID_SCHEMA", SCHEMA, `${changeLabel}: expected object`);
      const cc = bundleClosedKeys(change, FIELD_CHANGE_KEYS, changeLabel);
      if (!cc.ok) return cc;
      if (!isString(change["path"])) {
        return fail("INVALID_SCHEMA", SCHEMA, `${changeLabel}.path: expected string`);
      }
      const op = bundleLit(change["operation"], "SET", `${changeLabel}.operation`);
      if (!op.ok) return op;
    }
  }
  const shb = validateHash(v["state_hash_before"] as string, `${d}.state_hash_before`);
  if (!shb.ok) return shb;
  const sha = validateHash(v["state_hash_after"] as string, `${d}.state_hash_after`);
  if (!sha.ok) return sha;
  const mrb = validateIdentifier(v["memory_revision_before"] as string, `${d}.memory_revision_before`);
  if (!mrb.ok) return mrb;
  const mra = validateIdentifier(v["memory_revision_after"] as string, `${d}.memory_revision_after`);
  if (!mra.ok) return mra;
  const outcome = bundleLit(v["outcome"], "COMMITTED", `${d}.outcome`);
  if (!outcome.ok) return outcome;
  return ok(v as unknown as TraceEntryV1);
}

export function validateTraceWindowShape(v: unknown, d: string): ValidationResult<TraceWindowV1> {
  if (!isRecord(v)) return fail("INVALID_SCHEMA", SCHEMA, `${d}: expected object`);
  const closed = bundleClosedKeys(v, TRACE_WINDOW_KEYS, d);
  if (!closed.ok) return closed;
  const sv = bundleLit(v["trace_window_schema_version"], "trace-window-v1", `${d}.trace_window_schema_version`);
  if (!sv.ok) return sv;
  const cap = v["capacity"];
  if (cap !== 64) return fail("INVALID_SCHEMA", SCHEMA, `${d}.capacity: expected 64`);
  const cursor = v["cursor"];
  if (!isRecord(cursor)) return fail("INVALID_SCHEMA", SCHEMA, `${d}.cursor: expected object`);
  const cc = bundleClosedKeys(cursor, TRACE_CURSOR_KEYS, `${d}.cursor`);
  if (!cc.ok) return cc;
  const last = bundleSafeInteger(cursor["last_history_sequence"], `${d}.cursor.last_history_sequence`);
  if (!last.ok) return last;
  const offloaded = bundleSafeInteger(
    cursor["offloaded_through_sequence"],
    `${d}.cursor.offloaded_through_sequence`
  );
  if (!offloaded.ok) return offloaded;
  const offRef = bundleOptionalRef(
    cursor["offloaded_through_trace_ref"],
    `${d}.cursor.offloaded_through_trace_ref`,
    ["trace"]
  );
  if (!offRef.ok) return offRef;
  if (!Array.isArray(v["entries"])) {
    return fail("INVALID_SCHEMA", SCHEMA, `${d}.entries: expected array`);
  }
  for (let i = 0; i < v["entries"].length; i++) {
    const entry = validateTraceEntryShape(v["entries"][i], `${d}.entries[${i}]`);
    if (!entry.ok) return entry;
  }
  return ok(v as unknown as TraceWindowV1);
}

export function validateMutationHistoryLinkShape(
  v: unknown,
  d: string
): ValidationResult<MutationHistoryLinkV1> {
  if (!isRecord(v)) return fail("INVALID_SCHEMA", SCHEMA, `${d}: expected object`);
  const closed = bundleClosedKeys(v, MUTATION_HISTORY_LINK_KEYS, d);
  if (!closed.ok) return closed;
  const seq = bundleSafeInteger(v["history_sequence"], `${d}.history_sequence`);
  if (!seq.ok) return seq;
  const prev = bundleOptionalRef(v["previous_trace_ref"], `${d}.previous_trace_ref`, ["trace"]);
  if (!prev.ok) return prev;
  const cur = validateRefElement(v["current_trace_ref"], `${d}.current_trace_ref`, ["trace"]);
  if (!cur.ok) return cur;
  return ok(v as unknown as MutationHistoryLinkV1);
}

export function validateTransitionAttemptShape(
  v: unknown,
  d: string
): ValidationResult<TransitionAttemptV1> {
  if (!isRecord(v)) return fail("INVALID_SCHEMA", SCHEMA, `${d}: expected object`);
  const closed = bundleClosedKeys(v, TRANSITION_ATTEMPT_KEYS, d);
  if (!closed.ok) return closed;
  const seq = bundleSafeInteger(v["attempt_sequence"], `${d}.attempt_sequence`);
  if (!seq.ok) return seq;
  if (!isString(v["status"]) || !["REJECTED", "ABORTED", "NO_OP", "COMMITTED"].includes(v["status"])) {
    return fail("INVALID_SCHEMA", SCHEMA, `${d}.status: invalid enum`);
  }
  const rb = validateStateRevision(v["revision_before"] as number, `${d}.revision_before`);
  if (!rb.ok) return rb;
  const ra = validateStateRevision(v["revision_after"] as number, `${d}.revision_after`);
  if (!ra.ok) return ra;
  const shb = validateHash(v["state_hash_before"] as string, `${d}.state_hash_before`);
  if (!shb.ok) return shb;
  const sha = validateHash(v["state_hash_after"] as string, `${d}.state_hash_after`);
  if (!sha.ok) return sha;
  const resultRef = validateRefElement(v["result_ref"], `${d}.result_ref`, ["result"]);
  if (!resultRef.ok) return resultRef;
  const prepared = validateRefElement(v["prepared_result_ref"], `${d}.prepared_result_ref`, ["workflow"]);
  if (!prepared.ok) return prepared;
  const traceRef = validateRefElement(v["trace_ref"], `${d}.trace_ref`, ["trace"]);
  if (!traceRef.ok) return traceRef;
  const audit = bundleOptionalRef(v["audit_ref"], `${d}.audit_ref`);
  if (!audit.ok) return audit;
  if (v["error_code"] !== null && !isString(v["error_code"])) {
    return fail("INVALID_SCHEMA", SCHEMA, `${d}.error_code: expected string or null`);
  }
  if (v["reason"] !== null && !isString(v["reason"])) {
    return fail("INVALID_SCHEMA", SCHEMA, `${d}.reason: expected string or null`);
  }
  return ok(v as unknown as TransitionAttemptV1);
}

export function validateTransitionRecordShape(
  v: unknown,
  d: string
): ValidationResult<AuthoritativeTransitionRecordV1> {
  if (!isRecord(v)) return fail("INVALID_SCHEMA", SCHEMA, `${d}: expected object`);
  const closed = bundleClosedKeys(v, TRANSITION_RECORD_KEYS, d);
  if (!closed.ok) return closed;
  const sv = bundleLit(v["schema_version"], "transition-record-v1", `${d}.schema_version`);
  if (!sv.ok) return sv;
  const rv = bundleSafeInteger(v["record_version"], `${d}.record_version`);
  if (!rv.ok) return rv;
  const tid = validateIdentifier(v["transition_id"] as string, `${d}.transition_id`);
  if (!tid.ok) return tid;
  const sid = validateIdentifier(v["subject_id"] as string, `${d}.subject_id`);
  if (!sid.ok) return sid;
  const tt = bundleTransitionType(v["transition_type"], `${d}.transition_type`);
  if (!tt.ok) return tt;
  const pr = validateRefElement(v["proposal_ref"], `${d}.proposal_ref`, ["proposal"]);
  if (!pr.ok) return pr;
  const pf = validateHash(v["payload_fingerprint"] as string, `${d}.payload_fingerprint`);
  if (!pf.ok) return pf;
  const fv = bundleLit(v["fingerprint_version"], "proposal-fingerprint-v1", `${d}.fingerprint_version`);
  if (!fv.ok) return fv;
  const fss = bundleSafeInteger(v["first_seen_sequence"], `${d}.first_seen_sequence`);
  if (!fss.ok) return fss;
  if (!Array.isArray(v["attempts"]) || v["attempts"].length === 0) {
    return fail("INVALID_SCHEMA", SCHEMA, `${d}.attempts: nonempty array required`);
  }
  for (let i = 0; i < v["attempts"].length; i++) {
    const attempt = validateTransitionAttemptShape(v["attempts"][i], `${d}.attempts[${i}]`);
    if (!attempt.ok) return attempt;
  }
  if (!Array.isArray(v["reuse_conflicts"])) {
    return fail("INVALID_SCHEMA", SCHEMA, `${d}.reuse_conflicts: expected array`);
  }
  for (let i = 0; i < v["reuse_conflicts"].length; i++) {
    const label = `${d}.reuse_conflicts[${i}]`;
    const conflict = v["reuse_conflicts"][i];
    if (!isRecord(conflict)) return fail("INVALID_SCHEMA", SCHEMA, `${label}: expected object`);
    const cc = bundleClosedKeys(conflict, REUSE_CONFLICT_KEYS, label);
    if (!cc.ok) return cc;
    const seq = bundleSafeInteger(conflict["conflict_sequence"], `${label}.conflict_sequence`);
    if (!seq.ok) return seq;
    const sid = validateIdentifier(conflict["attempted_subject_id"] as string, `${label}.attempted_subject_id`);
    if (!sid.ok) return sid;
    const tt = bundleTransitionType(conflict["attempted_transition_type"], `${label}.attempted_transition_type`);
    if (!tt.ok) return tt;
    const pr = validateRefElement(conflict["attempted_proposal_ref"], `${label}.attempted_proposal_ref`, ["proposal"]);
    if (!pr.ok) return pr;
    const pf = validateHash(conflict["attempted_payload_fingerprint"] as string, `${label}.attempted_payload_fingerprint`);
    if (!pf.ok) return pf;
    const rb = validateStateRevision(conflict["revision_before"] as number, `${label}.revision_before`);
    if (!rb.ok) return rb;
    const lt = validateLogicalTime(conflict["logical_time_before"] as number, `${label}.logical_time_before`);
    if (!lt.ok) return lt;
    const shb = validateHash(conflict["state_hash_before"] as string, `${label}.state_hash_before`);
    if (!shb.ok) return shb;
    const snb = validateHash(conflict["snapshot_hash_before"] as string, `${label}.snapshot_hash_before`);
    if (!snb.ok) return snb;
  }
  if (v["terminal_status"] !== "COMMITTED" && v["terminal_status"] !== "NO_OP" && v["terminal_status"] !== null) {
    return fail("INVALID_SCHEMA", SCHEMA, `${d}.terminal_status: invalid enum`);
  }
  const terminal = bundleOptionalRef(v["terminal_result_ref"], `${d}.terminal_result_ref`, ["result"]);
  if (!terminal.ok) return terminal;
  return ok(v as unknown as AuthoritativeTransitionRecordV1);
}

export function validateCanonicalResultShape(
  v: unknown,
  d: string
): ValidationResult<CanonicalCommitResultV1> {
  if (!isRecord(v)) return fail("INVALID_SCHEMA", SCHEMA, `${d}: expected object`);
  const closed = bundleClosedKeys(v, CANONICAL_RESULT_KEYS, d);
  if (!closed.ok) return closed;
  const sv = bundleLit(v["schema_version"], "canonical-commit-result-v1", `${d}.schema_version`);
  if (!sv.ok) return sv;
  const status = bundleLit(v["status"], "COMMITTED", `${d}.status`);
  if (!status.ok) return status;
  const tid = validateIdentifier(v["transition_id"] as string, `${d}.transition_id`);
  if (!tid.ok) return tid;
  const sid = validateIdentifier(v["subject_id"] as string, `${d}.subject_id`);
  if (!sid.ok) return sid;
  const pf = validateHash(v["payload_fingerprint"] as string, `${d}.payload_fingerprint`);
  if (!pf.ok) return pf;
  const prev = validateStateRevision(v["previous_revision"] as number, `${d}.previous_revision`);
  if (!prev.ok) return prev;
  const next = validateStateRevision(v["next_revision"] as number, `${d}.next_revision`);
  if (!next.ok) return next;
  const shb = validateHash(v["state_hash_before"] as string, `${d}.state_hash_before`);
  if (!shb.ok) return shb;
  const sha = validateHash(v["state_hash_after"] as string, `${d}.state_hash_after`);
  if (!sha.ok) return sha;
  const ssa = validateHash(v["snapshot_hash_after"] as string, `${d}.snapshot_hash_after`);
  if (!ssa.ok) return ssa;
  const tr = validateRefElement(v["trace_ref"], `${d}.trace_ref`, ["trace"]);
  if (!tr.ok) return tr;
  const cr = validateRefElement(v["commit_ref"], `${d}.commit_ref`, ["commit"]);
  if (!cr.ok) return cr;
  const rr = validateRefElement(v["result_ref"], `${d}.result_ref`, ["result"]);
  if (!rr.ok) return rr;
  return ok(v as unknown as CanonicalCommitResultV1);
}

export function validateRepositoryBindings(
  v: unknown,
  d: string
): ValidationResult<RepositoryRevisionBindingV1[]> {
  if (!Array.isArray(v)) return fail("INVALID_SCHEMA", SCHEMA, `${d}: expected array`);
  const bindings: RepositoryRevisionBindingV1[] = [];
  for (let i = 0; i < v.length; i++) {
    const label = `${d}[${i}]`;
    const item = v[i];
    if (!isRecord(item)) return fail("INVALID_SCHEMA", SCHEMA, `${label}: expected object`);
    const closed = bundleClosedKeys(item, REPOSITORY_BINDING_KEYS, label);
    if (!closed.ok) return closed;
    const rev = validateIdentifier(item["repository_revision"] as string, `${label}.repository_revision`);
    if (!rev.ok) return rev;
    const hash = validateHash(item["repository_revision_hash"] as string, `${label}.repository_revision_hash`);
    if (!hash.ok) return hash;
    bindings.push({
      repository_revision: rev.value as unknown as RepositoryRevisionIdV0,
      repository_revision_hash: hash.value
    });
  }
  return ok(bindings);
}

/**
 * Generic 11-field writer-authority envelope shape: closed keys, frozen
 * schema literal, family vocabulary, family-admitted class, identifier/hash
 * formats, canonical-JSON-object payload. Family-specific payload semantics
 * are validated by the family-owned validator in its owning package.
 */
export function validateWriterAuthorityShape(
  v: unknown,
  d: string
): ValidationResult<CanonicalWriterAuthorityRecordV0> {
  if (!isRecord(v)) return fail("INVALID_SCHEMA", SCHEMA, `${d}: expected object`);
  const closed = bundleClosedKeys(v, WRITER_AUTHORITY_KEYS, d);
  if (!closed.ok) return closed;
  const sv = bundleLit(v["schema_version"], CANONICAL_WRITER_AUTHORITY_RECORD_SCHEMA_VERSION, `${d}.schema_version`);
  if (!sv.ok) return sv;
  const pr = validateRefElement(v["proposal_ref"], `${d}.proposal_ref`, ["proposal"]);
  if (!pr.ok) return pr;
  const pf = validateHash(v["payload_fingerprint"] as string, `${d}.payload_fingerprint`);
  if (!pf.ok) return pf;
  if (!(CANONICAL_WRITER_FAMILIES_V0 as readonly string[]).includes(v["writer_family"] as string)) {
    return fail("INVALID_SCHEMA", SCHEMA, `${d}.writer_family: unknown writer family`);
  }
  const family = v["writer_family"] as CanonicalWriterFamilyV0;
  const allowedClasses = CANONICAL_WRITER_FAMILY_CLASSES_V0[family];
  if (!isString(v["writer_class"]) || !(allowedClasses as readonly string[]).includes(v["writer_class"])) {
    return fail("INVALID_SCHEMA", SCHEMA, `${d}.writer_class: not admitted for writer_family ${family}`);
  }
  const wsid = validateIdentifier(v["writer_schema_id"] as string, `${d}.writer_schema_id`);
  if (!wsid.ok) return wsid;
  const wsf = validateHash(v["writer_schema_fingerprint"] as string, `${d}.writer_schema_fingerprint`);
  if (!wsf.ok) return wsf;
  const gid = validateIdentifier(v["authorization_gate_id"] as string, `${d}.authorization_gate_id`);
  if (!gid.ok) return gid;
  const gf = validateHash(v["authorization_gate_fingerprint"] as string, `${d}.authorization_gate_fingerprint`);
  if (!gf.ok) return gf;
  if (!isRecord(v["authority_payload"])) {
    return fail("INVALID_SCHEMA", SCHEMA, `${d}.authority_payload: expected canonical JSON object`);
  }
  const aph = validateHash(v["authority_payload_hash"] as string, `${d}.authority_payload_hash`);
  if (!aph.ok) return aph;
  return ok(v as unknown as CanonicalWriterAuthorityRecordV0);
}
