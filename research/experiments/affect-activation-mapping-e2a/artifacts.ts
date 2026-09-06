/**
 * ACTIVATION_MAPPING_ABLATION_E2A — artifact helpers (E1/E2 conventions).
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { check, sha256 } from "./fixtures.ts";
import { BASELINE_COMMIT, EXPERIMENT_PATH, TEST_PATH } from "./contract.ts";

export const ROOT = fileURLToPath(new URL("../../../", import.meta.url));

export const git = (...args: string[]): string =>
  execFileSync("git", args, { cwd: ROOT, encoding: "utf8", windowsHide: true, maxBuffer: 64 * 1024 * 1024 }).trim();

export const writeJson = (path: string, value: unknown): void => {
  mkdirSync(resolve(path, ".."), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n", { flag: "wx" });
};

export function writeText(path: string, text: string): void {
  mkdirSync(resolve(path, ".."), { recursive: true });
  writeFileSync(path, text, { flag: "wx" });
}

export function freshDirectory(path: string): string {
  const absolute = resolve(ROOT, path);
  const rel = relative(ROOT, absolute).replaceAll("\\", "/");
  check(rel.startsWith("tmp/") || rel.startsWith(`${EXPERIMENT_PATH}/evidence/`), "new E2A evidence/tmp child only");
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
      entries = readdirSyncSafe(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile()) paths.push(path);
    }
  }
  for (const pkg of readdirSyncSafe("packages")) {
    if (pkg.isDirectory()) visit(`packages/${pkg.name}/dist`);
  }
  visit("product/sandbox/dist");
  return sha256(JSON.stringify(paths.sort().map((p) => [p, sha256(readFileSync(join(ROOT, p)))])));
}

function readdirSyncSafe(dir: string): { name: string; isDirectory(): boolean; isFile(): boolean }[] {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).map((e) => ({ name: e.name, isDirectory: () => e.isDirectory(), isFile: () => e.isFile() }));
}

import { readdirSync } from "node:fs";

/** §56 production isolation. The E1/E2 harness guard-authorizations are the
 * documented mechanical exceptions (same as the E2 lineage established). */
export function frozenIntegrity(): {
  readonly baseline: string;
  readonly changed_paths: readonly string[];
  readonly production_diff: string;
} {
  git("merge-base", "--is-ancestor", BASELINE_COMMIT, "HEAD");
  const allowed = (p: string): boolean =>
    p.startsWith(`${EXPERIMENT_PATH}/`) || p === TEST_PATH ||
    p === "evals/conformance/affect-production-shaped-e2.test.ts" ||
    p === "research/experiments/affect-production-shaped-e2/artifacts.ts" ||
    p === "evals/conformance/affect-state-retention-e1.test.ts" ||
    p === "research/experiments/affect-state-retention-e1/artifacts.ts";
  const changed = git("diff", "--name-only", BASELINE_COMMIT).split("\n").filter(Boolean);
  const untracked = git("ls-files", "--others", "--exclude-standard").split("\n").filter(Boolean);
  check(changed.every(allowed), `all baseline-file changes isolated to E2A + authorized guards: ${changed.join(",")}`);
  check(untracked.every(allowed), `all new files isolated to E2A: ${untracked.join(",")}`);
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
