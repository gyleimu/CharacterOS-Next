import { createHash } from "node:crypto";

export function sha256(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
}

export function equal(a: unknown, b: unknown): boolean {
  return canonicalJson(a) === canonicalJson(b);
}

export function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`REPLICATION_V1: ${message}`);
}

export function hashJson(value: unknown): string {
  return sha256(canonicalJson(value));
}

export function round(value: number, digits = 12): number {
  return Number(value.toFixed(digits));
}
