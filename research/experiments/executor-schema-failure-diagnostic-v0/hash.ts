/**
 * EXPLORATORY_EXECUTOR_SCHEMA_FAILURE_DIAGNOSTIC_V0 — local hash helpers.
 *
 * A local copy, deliberately: the diagnostic must not depend on the frozen
 * experiment's module graph any more than necessary, and these two functions are
 * the same canonical-JSON/sha256 law the frozen protocol uses (sorted keys at
 * every level, no whitespace, UTF-8).
 */
import { createHash } from "node:crypto";

export function sha256Hex(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export function hashText(text: string): string {
  return `sha256:${sha256Hex(text)}`;
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}

export function hashJson(value: unknown): string {
  return hashText(canonicalJson(value));
}
