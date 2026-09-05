import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

function jsonFiles(root: string): string[] {
  return readdirSync(root).flatMap((entry) => {
    const path = join(root, entry);
    return statSync(path).isDirectory() ? jsonFiles(path) : path.endsWith(".json") ? [path] : [];
  });
}

const argument = process.argv[2];
if (typeof argument !== "string") throw new Error("usage: validate.ts <run-directory>");
const root = resolve(argument);
const files = jsonFiles(root);
for (const file of files) JSON.parse(readFileSync(file, "utf8"));
const summary = JSON.parse(readFileSync(join(root, "summary.json"), "utf8")) as Record<string, unknown>;
const calls = summary["calls"] as readonly Record<string, unknown>[];
const hashes = calls.map((call) => (call["trace"] as Record<string, unknown>)["request_hash"]);
const counts = summary["model_call_counts"] as Record<string, unknown>;
const integrity = summary["integrity"] as Record<string, unknown>;
if (calls.length !== 4) throw new Error(`expected 4 calls, got ${calls.length}`);
if (new Set(hashes).size !== 1) throw new Error("expected exactly one request hash");
if (counts["cognition"] !== 4 || counts["language"] !== 0 || counts["evaluator"] !== 0) {
  throw new Error("model-call counts violate the diagnostic contract");
}
if (
  integrity["exactly_four_traces"] !== true ||
  integrity["exactly_one_request_hash"] !== true ||
  integrity["request_hash_matches_offline"] !== true ||
  integrity["production_paths_changed_before_run"] !== false
) {
  throw new Error("integrity assertion failed");
}
console.log(`VALID ${files.length} JSON files; 4 cognition; 0 language; 0 evaluator; 1 request hash`);
