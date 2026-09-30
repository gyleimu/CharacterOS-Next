/**
 * §1 — FREEZE PHASE 0 RUN 1 EXACTLY.
 *
 *   npx tsx phase-0/remediation/freeze-run1.ts
 *
 * Hashes every artifact of run-1 and records the production commit, so the run can never be
 * silently edited, "repaired", or superseded. Writes a verification manifest; running it again
 * after any edit to run-1 must FAIL. Run-1 is evidence and stays exactly as it was produced.
 */

import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..", "..", "..", "..", "..");
const runDir = join(repo, "research", "north-star", "history-internalization", "phase-0", "evidence", "run-1");
const outDir = join(repo, "research", "north-star", "history-internalization", "phase-0", "remediation");

const sha256 = (path: string): string => createHash("sha256").update(readFileSync(path)).digest("hex");

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const files = walk(runDir).sort();
const manifest = {
  artifact: "PHASE0_RUN1_FREEZE",
  purpose:
    "run-1 is immutable evidence. It is INCONCLUSIVE and must never be overwritten, repaired, or re-interpreted as a positive.",
  frozen_verdict: "HISTORY_INTERNALIZATION_V1_INCONCLUSIVE",
  descriptive_partial_observation: "LIVED_EXPERIENCE_TO_CANONICAL_BELIEF_COMMIT_OBSERVED_IN_PARTIAL_RUN",
  forbidden_mislabels: ["LIVED_EXPERIENCE_TO_PERSISTENT_BELIEF_CHANGE_ESTABLISHED", "HISTORY_INTERNALIZATION_ESTABLISHED"],
  production_commit: execSync("git rev-parse HEAD", { cwd: repo }).toString().trim(),
  production_tree_dirty_paths: execSync("git status --porcelain -- packages/", { cwd: repo }).toString().trim().split("\n").filter((line) => line !== ""),
  file_count: files.length,
  files: Object.fromEntries(
    files.map((path) => [relative(runDir, path).replaceAll("\\", "/"), { sha256: sha256(path), bytes: statSync(path).size }])
  )
};

mkdirSync(outDir, { recursive: true });
const content = `${JSON.stringify(manifest, null, 2)}\n`;
writeFileSync(join(outDir, "PHASE0_RUN1_FREEZE.json"), content, "utf8");
const manifestHash = createHash("sha256").update(content).digest("hex");
writeFileSync(join(outDir, "PHASE0_RUN1_FREEZE.hash"), `sha256:${manifestHash}\n`, "utf8");

console.log(`run-1 frozen: ${manifest.file_count} files hashed`);
console.log(`  production commit: ${manifest.production_commit.slice(0, 8)}, packages dirty: ${manifest.production_tree_dirty_paths.length}`);
console.log(`  freeze manifest hash: sha256:${manifestHash}`);
console.log(`  verdict frozen as: ${manifest.frozen_verdict}`);
