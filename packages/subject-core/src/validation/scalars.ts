/**
 * P2.1.2 — Scalar, text and reference validators (pure functions only).
 * Source: docs/implementation/p2-1-contract-freeze.md §5.1 (global schema rules),
 * §5.2 (scalar contracts), §5.3 (CanonicalRefV0 grammar + per-field kind allowlists).
 *
 * Every exported function is input -> ValidationResult. No mutation, no persistence,
 * no storage, no runtime/domain dependency, and only frozen §13.2 error codes.
 */

import type {
  HashV1,
  HistorySequenceV0,
  IdentifierV0,
  LogicalTimeV0,
  RepositoryRevisionIdV0,
  StateRevisionV0,
  UnitIntervalV0
} from "../types/scalars.js";
import type { CanonicalRefV0 } from "../types/ref.js";
import { REF_KINDS, type RefKind } from "../types/enums.js";
import { fail, ok, type ValidationResult } from "./result.js";

const SCHEMA = "SS-SCHEMA-001";

/** §5.2 IdentifierV0 grammar: `^[A-Za-z0-9][A-Za-z0-9._~-]{0,127}$`. */
const IDENTIFIER_RE = /^[A-Za-z0-9][A-Za-z0-9._~-]{0,127}$/;

/** §8.1 hash wire format: `sha256:` + 64 lowercase hex. */
const HASH_RE = /^sha256:[0-9a-f]{64}$/;

export function isString(v: unknown): v is string {
  return typeof v === "string";
}

export function isNumber(v: unknown): v is number {
  return typeof v === "number";
}

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * §5.1 rule 3: canonical text must already be NFC, contain no NUL and no unpaired
 * surrogate. Validation rejects rather than normalizes.
 */
export function isCanonicalText(s: string): boolean {
  return s.normalize("NFC") === s && !s.includes("\u0000") && s.isWellFormed();
}

/** §5.1 rule 3 applied to an unknown input that must be a canonical string. */
export function validateCanonicalText(v: unknown, detail: string): ValidationResult<string> {
  if (!isString(v)) return fail("INVALID_SCHEMA", SCHEMA, `${detail}: expected string`);
  if (!isCanonicalText(v)) return fail("INVALID_SCHEMA", SCHEMA, `${detail}: not canonical NFC text`);
  return ok(v);
}

function validateSafeInteger(v: number, detail: string): ValidationResult<number> {
  if (!Number.isSafeInteger(v) || v < 0 || v > Number.MAX_SAFE_INTEGER) {
    return fail("INVALID_SCHEMA", SCHEMA, `${detail}: not a safe integer in [0, 2^53-1]`);
  }
  return ok(v);
}

/** §5.2 IdentifierV0 (also the format contract of TransitionIdV0 / RepositoryRevisionIdV0). */
export function validateIdentifier(v: string, detail: string): ValidationResult<IdentifierV0> {
  if (!isCanonicalText(v)) return fail("INVALID_SCHEMA", SCHEMA, `${detail}: not canonical NFC text`);
  if (!IDENTIFIER_RE.test(v)) return fail("INVALID_SCHEMA", SCHEMA, `${detail}: identifier format`);
  return ok(v as IdentifierV0);
}

/** §5.2 LogicalTimeV0: safe integer `0..9007199254740991`. */
export function validateLogicalTime(v: number, detail: string): ValidationResult<LogicalTimeV0> {
  const r = validateSafeInteger(v, detail);
  return r.ok ? ok(v as LogicalTimeV0) : r;
}

/** §5.2 StateRevisionV0: safe integer `0..9007199254740991`. */
export function validateStateRevision(v: number, detail: string): ValidationResult<StateRevisionV0> {
  const r = validateSafeInteger(v, detail);
  return r.ok ? ok(v as StateRevisionV0) : r;
}

/** §5.2 HistorySequenceV0: positive safe integer (trace history position). */
export function validateHistorySequence(v: number, detail: string): ValidationResult<HistorySequenceV0> {
  const r = validateSafeInteger(v, detail);
  if (!r.ok) return r;
  if (v < 1) return fail("INVALID_SCHEMA", SCHEMA, `${detail}: history sequence must be >= 1`);
  return ok(v as HistorySequenceV0);
}

/** §5.2 UnitIntervalV0: finite IEEE-754 number in `[0,1]`. */
export function validateUnitInterval(v: number, detail: string): ValidationResult<UnitIntervalV0> {
  if (!Number.isFinite(v) || v < 0 || v > 1) {
    return fail("INVALID_VALUE_RANGE", SCHEMA, `${detail}: not a finite number in [0,1]`);
  }
  return ok(v as UnitIntervalV0);
}

/** §8.1 HashV1 wire format. */
export function validateHash(v: string, detail: string): ValidationResult<HashV1> {
  if (!HASH_RE.test(v)) return fail("INVALID_SCHEMA", SCHEMA, `${detail}: hash format`);
  return ok(v as HashV1);
}

/** §5.2 RepositoryRevisionIdV0: IdentifierV0 verified through the ReferenceValidator capability. */
export function validateRepositoryRevision(v: string, detail: string): ValidationResult<RepositoryRevisionIdV0> {
  const r = validateIdentifier(v, detail);
  return r.ok ? ok(v as RepositoryRevisionIdV0) : r;
}

/**
 * §5.3 CanonicalRefV0 grammar + enumerated kind check for one ref value.
 * Semantic existence against a repository revision is a ReferenceValidator capability
 * owned by the memory package and is NOT part of this pure validation layer.
 */
export function parseRef(v: string, detail: string): ValidationResult<CanonicalRefV0> {
  if (!isCanonicalText(v)) return fail("INVALID_SCHEMA", SCHEMA, `${detail}: not canonical NFC text`);
  const colon = v.indexOf(":");
  if (colon <= 0) return fail("INVALID_SCHEMA", SCHEMA, `${detail}: no kind prefix`);
  const kind = v.slice(0, colon);
  const id = v.slice(colon + 1);
  if (!(REF_KINDS as readonly string[]).includes(kind)) {
    return fail("INVALID_SCHEMA", SCHEMA, `${detail}: unknown ref kind ${kind}`);
  }
  if (!IDENTIFIER_RE.test(id)) return fail("INVALID_SCHEMA", SCHEMA, `${detail}: ref id format`);
  return ok(v as CanonicalRefV0);
}

/** parseRef over an unknown value plus an optional kind allowlist (§5.3 field table). */
export function validateRefElement(
  v: unknown,
  detail: string,
  kinds?: readonly RefKind[]
): ValidationResult<CanonicalRefV0> {
  if (!isString(v)) return fail("INVALID_SCHEMA", SCHEMA, `${detail}: expected ref string`);
  const r = parseRef(v, detail);
  if (!r.ok) return r;
  if (kinds !== undefined && !kinds.includes(refKind(r.value))) {
    return fail("INVALID_SCHEMA", SCHEMA, `${detail}: ref kind not allowed`);
  }
  return r;
}

/** Kind of a well-formed ref; caller must have validated the ref first. */
export function refKind(ref: CanonicalRefV0): RefKind {
  return ref.slice(0, ref.indexOf(":")) as RefKind;
}

export interface RefArrayOptions {
  /** §5.3 per-field kind allowlist; omit to accept every enumerated kind. */
  readonly kinds?: readonly RefKind[];
  /**
   * Set-like arrays (§6.3) must additionally be sorted ascending by raw UTF-16 code
   * units. Duplicates always reject (§5.1 rule 5); validators never deduplicate or
   * reorder.
   */
  readonly sorted?: boolean;
}

/**
 * Validates an array field of canonical refs: every element passes §5.3 grammar/kind,
 * duplicates reject (§5.1 rule 5), and set-like arrays must be lexicographically sorted.
 */
export function validateRefArray(
  v: unknown,
  detail: string,
  opts: RefArrayOptions = {}
): ValidationResult<void> {
  if (!Array.isArray(v)) return fail("INVALID_SCHEMA", SCHEMA, `${detail}: expected array`);
  let prev: string | undefined;
  for (let i = 0; i < v.length; i++) {
    const label = `${detail}[${i}]`;
    const r = validateRefElement(v[i], label, opts.kinds);
    if (!r.ok) return r;
    if (prev !== undefined) {
      if (r.value === prev) {
        return fail("INVALID_SCHEMA", SCHEMA, `${label}: duplicate ref`);
      }
      if (opts.sorted === true && r.value < prev) {
        return fail("INVALID_SCHEMA", SCHEMA, `${label}: refs not lexicographically sorted`);
      }
    }
    prev = r.value;
  }
  return ok(undefined);
}
