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
const category = String(summary["result_category"]);
if (calls.length > 4) throw new Error(`model call count exceeds four: ${calls.length}`);
if (counts["cognition"] !== calls.length || counts["language"] !== 0 || counts["evaluator"] !== 0) {
  throw new Error("model call counts violate protocol");
}
const hashes = calls.map((call) => {
  const callId = String(call["call"]);
  const trace = JSON.parse(readFileSync(join(root, `call-${callId}`, "trace.json"), "utf8")) as Record<string, unknown>;
  return trace["request_hash"];
});
if (calls.length > 0 && new Set(hashes).size !== 1) throw new Error("expected exactly one request hash");
if (
  integrity["model_calls_at_most_four"] !== true ||
  integrity["frozen_request_match"] !== true ||
  integrity["artificial_pressure_processes_before"] !== 0 ||
  integrity["artificial_pressure_processes_after"] !== 0 ||
  integrity["production_paths_changed_before_run"] !== false ||
  (calls.length > 0 && integrity["exactly_one_request_hash"] !== true) ||
  (category === "NATURAL_LOW_RESOURCE_WINDOW_LOST" && calls.length !== 0)
) throw new Error("natural low-resource diagnostic integrity validation failed");
console.log(`VALID ${files.length} JSON files; ${calls.length} cognition; 0 language; 0 evaluator; no artificial pressure`);
