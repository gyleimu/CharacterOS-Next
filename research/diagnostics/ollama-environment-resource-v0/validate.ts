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
const counts = summary["model_call_counts"] as Record<string, unknown>;
const integrity = summary["integrity"] as Record<string, unknown>;
const hashes = calls.map((call) => {
  const callId = String(call["call"]);
  const level = Number(call["level"]);
  const tracePath = join(root, `level-${level}`, `call-${callId.toLowerCase()}`, "trace.json");
  return (JSON.parse(readFileSync(tracePath, "utf8")) as Record<string, unknown>)["request_hash"];
});
if (calls.length > 6) throw new Error(`model call count exceeds six: ${calls.length}`);
if (counts["cognition"] !== calls.length || counts["language"] !== 0 || counts["evaluator"] !== 0) {
  throw new Error("model call counts violate protocol");
}
if (new Set(hashes).size !== 1) throw new Error("expected exactly one request hash");
if (
  integrity["model_calls_at_most_six"] !== true ||
  integrity["exactly_one_request_hash"] !== true ||
  integrity["frozen_request_match"] !== true ||
  integrity["production_paths_changed_before_run"] !== false ||
  integrity["all_started_helpers_terminated"] !== true
) throw new Error("diagnostic integrity validation failed");
console.log(`VALID ${files.length} JSON files; ${calls.length} cognition; 0 language; 0 evaluator; 1 request hash; helpers terminated`);
