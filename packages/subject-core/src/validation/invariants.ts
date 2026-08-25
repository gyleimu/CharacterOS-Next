/**
 * P2.1.2 — Invariant validators (pure).
 * Source: docs/implementation/p2-1-contract-freeze.md §5.2 (successor arithmetic),
 * §6.2/§13.3 (revision monotonicity, logical-time monotonicity), §8.1 (hash format).
 * No commit, no mutation, no current-state read: these are pure comparisons the
 * P2.1.3 commit engine calls with actual before/after values.
 */

import type { StateRevisionV0, LogicalTimeV0, HashV1 } from "../types/scalars.js";
import { fail, ok, type ValidationResult } from "./result.js";
import { isNumber, validateHash } from "./scalars.js";

const SS_REV = "SS-REVISION-001";
const TIME_ADV = "TIME-ADVANCE-001";
const SCHEMA = "SS-SCHEMA-001";

/**
 * §5.2/§6.2: `state_revision` must strictly increase by exactly the representable
 * successor on a successful commit. A successor outside the safe-integer domain
 * rejects as INVARIANT_VIOLATION / SS-REVISION-001 before candidate construction.
 */
export function assertRevisionIncrement(
  next: StateRevisionV0,
  prev: StateRevisionV0
): ValidationResult<void> {
  if (!isNumber(prev) || !Number.isSafeInteger(prev) || prev < 0) {
    return fail("INVARIANT_VIOLATION", SS_REV, `previous revision not a safe integer: ${String(prev)}`);
  }
  if (!isNumber(next) || !Number.isSafeInteger(next)) {
    return fail("INVARIANT_VIOLATION", SS_REV, "state_revision successor not representable");
  }
  if (next <= prev) {
    return fail("INVARIANT_VIOLATION", SS_REV, `revision not monotonic: ${next} <= ${prev}`);
  }
  return ok(undefined);
}

/**
 * §20 logical-time monotonicity: non-decreasing across transitions (elapsed=0 Time
 * never reaches candidate construction; only Time advances logical time).
 */
export function assertLogicalTimeMonotonic(
  next: LogicalTimeV0,
  prev: LogicalTimeV0
): ValidationResult<void> {
  if (
    !isNumber(next) ||
    !isNumber(prev) ||
    !Number.isSafeInteger(next) ||
    !Number.isSafeInteger(prev) ||
    next < 0 ||
    prev < 0
  ) {
    return fail("INVALID_LOGICAL_TIME", TIME_ADV, "logical times must be safe integers >= 0");
  }
  if (next < prev) {
    return fail("INVALID_LOGICAL_TIME", TIME_ADV, `logical_time not monotonic: ${next} < ${prev}`);
  }
  return ok(undefined);
}

/**
 * §5.2: checked safe-integer time addition. `logical_time_before + elapsed_time.value`
 * outside the safe-integer domain returns INVALID_LOGICAL_TIME / TIME-ADVANCE-001
 * before candidate construction; addition never saturates, wraps or rounds.
 */
export function assertCheckedLogicalTimeAdvance(
  prev: LogicalTimeV0,
  elapsed: LogicalTimeV0
): ValidationResult<LogicalTimeV0> {
  const mono = assertLogicalTimeMonotonic(prev, prev);
  if (!mono.ok) return mono;
  if (!isNumber(elapsed) || !Number.isSafeInteger(elapsed) || elapsed < 0) {
    return fail("INVALID_LOGICAL_TIME", TIME_ADV, "elapsed ticks must be a safe integer >= 0");
  }
  if (prev > Number.MAX_SAFE_INTEGER - elapsed) {
    return fail("INVALID_LOGICAL_TIME", TIME_ADV, "logical_time advance overflows the safe integer domain");
  }
  return ok((prev + elapsed) as LogicalTimeV0);
}

/** §8.1 hash wire format `sha256:<64 lowercase hex>`. */
export function validateHashFormat(v: unknown): ValidationResult<HashV1> {
  if (typeof v !== "string") return fail("INVALID_SCHEMA", SCHEMA, "hash: expected string");
  return validateHash(v, "hash");
}
