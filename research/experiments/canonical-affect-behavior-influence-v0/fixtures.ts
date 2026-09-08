/**
 * CANONICAL_AFFECT_COGNITION_BEHAVIOR_INFLUENCE_EXPERIMENT_V0 — deterministic
 * helpers (single-sourced conventions from the frozen e2/e1 experiment
 * helpers; never reimplemented semantics).
 */

import { createHash } from "node:crypto";

export function sha256(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

/** Canonical JSON: recursively sorted object keys (JCS-style). */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson((value as Record<string, unknown>)[k])}`).join(",")}}`;
}

export function canonicalJsonString(value: unknown): string {
  return canonicalJson(value);
}

export function equal(a: unknown, b: unknown): boolean {
  return canonicalJson(a) === canonicalJson(b);
}

export function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`EXPERIMENT: ${message}`);
}
