/**
 * PERSISTENT_SUBJECT_CONFIGURATION_V0 — atomic local JSON file helper.
 *
 * Product-owned durable files (subject config, subject snapshot) are written to
 * a temporary sibling and renamed over the target, so a crash mid-write can
 * never leave a half-written file in place as the only copy.
 *
 * PERSISTENCE_SCALABILITY_R1: a file may choose its SERIALIZATION MODE. `pretty`
 * (the default, byte-identical to the historical writer) stays for small
 * human-readable files; `minified` is for the LARGE durable store files whose
 * indentation whitespace dominates their size. The mode changes representation
 * only — the parsed value, every checksum, every revision, the restore chain and
 * the atomic temp+rename semantics are untouched, and the reader accepts both.
 */

import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";

/** Serialization modes for product durable files. */
export type JsonFileSerializationV0 = "pretty" | "minified";

/** Atomically writes one JSON document (default: pretty-printed, trailing newline). */
export function writeJsonAtomicV0(
  path: string,
  value: unknown,
  serialization: JsonFileSerializationV0 = "pretty"
): void {
  mkdirSync(dirname(path), { recursive: true });
  const tempPath = `${path}.tmp`;
  const text =
    serialization === "minified" ? `${JSON.stringify(value)}\n` : `${JSON.stringify(value, null, 2)}\n`;
  writeFileSync(tempPath, text, "utf8");
  renameSync(tempPath, path);
}

/** Reads a JSON object, or null when the file does not exist. */
export function readJsonFileV0(path: string): unknown | null {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}
