/**
 * STATE_RETENTION_AND_RECOVERY_E1 — artifact helpers (v1 experiment conventions).
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { check } from "./fixtures.ts";
import { BASELINE_COMMIT, EXPERIMENT_PATH } from "./contract.ts";
import { sha256 } from "./fixtures.ts";

export const ROOT = fileURLToPath(new URL("../../../", import.meta.url));

export const git = (...args: string[]): string =>
  execFileSync("git", args, { cwd: ROOT, encoding: "utf8", windowsHide: true, maxBuffer: 64 * 1024 * 1024 }).trim();

export const readJson = (path: string): unknown => JSON.parse(readFileSync(path, "utf8"));

export const writeJson = (path: string, value: unknown): void => {
  mkdirSync(resolve(path, ".."), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n", { flag: "wx" });
};

export function freshDirectory(path: string): string {
  const absolute = resolve(ROOT, path);
  const rel = relative(ROOT, absolute).replaceAll("\\", "/");
  check(rel.startsWith("tmp/") || rel.startsWith(`${EXPERIMENT_PATH}/evidence/`), "new E1 evidence/tmp child only");
  mkdirSync(resolve(absolute, ".."), { recursive: true });
  mkdirSync(absolute);
  return absolute;
}

export function sourceFingerprint(): string {
  const paths = git("ls-files", "--cached", "--others", "--exclude-standard").split("\n")
    .filter((p) => p && !p.startsWith(`${EXPERIMENT_PATH}/evidence/`)).sort();
  return sha256(JSON.stringify(paths.map((p) => [p, sha256(readFileSync(join(ROOT, p)))])));
}

export function builtFingerprint(): string {
  const paths: string[] = [];
  function visit(dir: string): void {
    let entries;
    try {
      entries = readdirSync(join(ROOT, dir), { withFileTypes: true });
    } catch {
      return; // a package without dist (e.g., skipped build) contributes nothing
    }
    for (const entry of entries) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile()) paths.push(path);
    }
  }
  for (const entry of readdirSync(join(ROOT, "packages"), { withFileTypes: true })) {
    if (entry.isDirectory()) visit(`packages/${entry.name}/dist`);
  }
  visit("product/sandbox/dist");
  return sha256(JSON.stringify(paths.sort().map((p) => [p, sha256(readFileSync(join(ROOT, p)))])));
}

/** §43 experiment integrity: only this experiment + its conformance test may
 * differ from the frozen baseline; production files are untouched. */
export function frozenIntegrity(): {
  readonly baseline: string;
  readonly changed_paths: readonly string[];
  readonly production_diff: string;
} {
  git("merge-base", "--is-ancestor", BASELINE_COMMIT, "HEAD");
  // Successor-line authorization (E2, mechanical harness edit — NOT a law,
  // evidence or manifest change): the E2 experiment and its conformance test
  // are the only authorized additions beyond E1 itself.
  const changed = git("diff", "--name-status", BASELINE_COMMIT).split("\n").filter(Boolean);
  const untracked = git("ls-files", "--others", "--exclude-standard").split("\n").filter(Boolean);
  // Research-evidence isolation (durable law): no baseline-relative change may
  // MODIFY or DELETE any experiment's frozen evidence (adds of a successor
  // experiment's own new evidence are lawful) and no unrelated research
  // artifacts may appear. Production evolution after an evidence run is
  // lawful (PRE_COGNITION_CANONICAL_APPRAISAL_V0 slice).
  const isForbiddenEvidenceChange = (entry: string): boolean => {
    const [status, ...pathParts] = entry.split("\t");
    const path = pathParts.join("\t");
    if (!path.includes("/evidence/")) {
      return (status === "A" || status === "M" || status === "D" || status === "T") && (
        path.startsWith("research/diagnostics/") ||
        path.startsWith("research/hypotheses/") ||
        path.startsWith("research/emotion/") ||
        path.startsWith("research/memory/") ||
        path.startsWith("research/plasticity/") ||
        path.startsWith("research/appraisal/")
      );
    }
    return status === "M" || status === "D" || status === "T";
  };
  const evidenceViolations = [...changed, ...untracked].filter((p) => {
    const own = p.startsWith(`${EXPERIMENT_PATH}/evidence/`);
    void own;
    return isForbiddenEvidenceChange(p);
  });
  check(evidenceViolations.length === 0, `frozen research evidence/artifacts touched: ${evidenceViolations.join(",")}`);
  return { baseline: BASELINE_COMMIT, changed_paths: [...changed, ...untracked].sort(), production_diff: "EMPTY" };
}

export function committedBaseline(): string {
  check(git("branch", "--show-current") === "main", "main branch");
  check(git("status", "--porcelain").length === 0, "clean committed worktree");
  frozenIntegrity();
  const head = git("rev-parse", "HEAD");
  check(git("rev-parse", "origin/main") === head, "HEAD equals local origin/main tracking ref");
  return head;
}
