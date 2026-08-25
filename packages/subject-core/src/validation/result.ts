/**
 * P2.1.2 — Validation result types.
 * Pure input→result contract. Uses only frozen `ErrorCode` + `RequirementId` (no new error codes).
 * `detail` is NON-CANONICAL diagnostic text (mirrors §13: human text/stack/wall-clock are
 * noncanonical); it never enters the canonical error envelopes produced by P2.1.3.
 */

import type { ErrorCode, RequirementId } from "../types/enums.js";

export interface ValidationFailure {
  /** Frozen error code (§13.2). */
  readonly error_code: ErrorCode;
  /** Frozen requirement reason (§13.3). */
  readonly reason: RequirementId;
  /** Non-canonical diagnostic path/message for tests and operators only. */
  readonly detail: string;
}

export type ValidationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: ValidationFailure };

export function ok<T>(value: T): ValidationResult<T> {
  return { ok: true, value };
}

export function fail<T>(
  error_code: ErrorCode,
  reason: RequirementId,
  detail: string
): ValidationResult<T> {
  return { ok: false, error: { error_code, reason, detail } };
}
