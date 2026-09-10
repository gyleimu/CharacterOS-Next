/**
 * PERSISTENT_SUBJECT_CONFIGURATION_V0 — atomic local JSON file helper.
 *
 * Product-owned durable files (subject config, subject snapshot) are written to
 * a temporary sibling and renamed over the target, so a crash mid-write can
 * never leave a half-written file in place as the only copy.
 */

import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";

/** Atomically writes one JSON document (pretty-printed, trailing newline). */
export function writeJsonAtomicV0(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  const tempPath = `${path}.tmp`;
  writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  renameSync(tempPath, path);
}

/** Reads a JSON object, or null when the file does not exist. */
export function readJsonFileV0(path: string): unknown | null {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}
