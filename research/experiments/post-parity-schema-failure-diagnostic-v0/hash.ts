/**
 * POST_PARITY_SCHEMA_FAILURE_DIAGNOSTIC — local hash helpers.
 *
 * A local copy of the canonical-JSON/sha256 law (sorted keys, no whitespace,
 * UTF-8), so this diagnostic depends on the frozen experiment's module graph only
 * where it must (the production request rendering path).
 */
import { createHash } from "node:crypto";

export function hashText(text: string): string {
  return `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`;
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
