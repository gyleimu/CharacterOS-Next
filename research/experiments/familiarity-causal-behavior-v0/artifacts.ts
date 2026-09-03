import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, relative, join } from "node:path";
import { fileURLToPath } from "node:url";
import { check } from "./adapter.ts";
import { BASELINE, MODEL } from "./contract.ts";
import { sha256 } from "./harness.ts";

export const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
export const EXPERIMENT_PATH = "research/experiments/familiarity-causal-behavior-v0";
export const TEST_PATH = "evals/conformance/familiarity-causal-behavior-v0.test.ts";
export const git = (...args: string[]) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8", windowsHide: true }).trim();
export const readJson = (path: string): unknown => JSON.parse(readFileSync(path, "utf8"));
export const writeJson = (path: string, value: unknown) => writeFileSync(path, JSON.stringify(value, null, 2) + "\n", { flag: "wx" });

export function freshDirectory(path: string): string {
  const absolute = resolve(ROOT, path);
  const rel = relative(ROOT, absolute).replaceAll("\\", "/");
  check(rel.startsWith("tmp/") || rel.startsWith(`${EXPERIMENT_PATH}/evidence/`), "output must be a new scoped experiment evidence directory or tmp child");
  mkdirSync(resolve(absolute, ".."), { recursive: true });
  mkdirSync(absolute); // exclusive: never overwrite a prior bundle
  return absolute;
}

export function sourceFingerprint() {
  const paths = git("ls-files", "--cached", "--others", "--exclude-standard").split("\n")
    .filter(p => p && !p.startsWith(`${EXPERIMENT_PATH}/evidence/`)).sort();
  return sha256(JSON.stringify(paths.map(p => [p, sha256(readFileSync(join(ROOT, p)))])));
}
export function builtFingerprint() {
  const paths: string[] = [];
  function visit(dir: string) {
    for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile()) paths.push(path);
    }
  }
  for (const entry of readdirSync(join(ROOT, "packages"), { withFileTypes: true })) {
    if (entry.isDirectory()) visit(`packages/${entry.name}/dist`);
  }
  visit("product/sandbox/dist");
  return sha256(JSON.stringify(paths.sort().map(p => [p, sha256(readFileSync(join(ROOT, p)))])));
}

export function committedBaseline() {
  check(git("branch", "--show-current") === "main", "main branch");
  check(git("status", "--porcelain").length === 0, "clean committed worktree required");
  git("merge-base", "--is-ancestor", BASELINE, "HEAD");
  const changes = git("diff", "--name-only", BASELINE, "HEAD").split("\n").filter(Boolean);
  check(changes.length > 0 && changes.every(p => p.startsWith(`${EXPERIMENT_PATH}/`) || p === TEST_PATH), "only experiment code/evidence since required baseline");
  return git("rev-parse", "HEAD");
}

export async function probeProvider() {
  const response = await fetch(`${MODEL.base_url}/api/tags`, { signal: AbortSignal.timeout(10000) });
  check(response.ok, "provider tags endpoint");
  const data = await response.json() as { models: { name: string; digest: string; details: unknown }[] };
  const model = data.models.find(m => m.name === MODEL.model);
  check(model?.digest === MODEL.digest, "exact pinned local model digest; no fallback");
  const versionResponse = await fetch(`${MODEL.base_url}/api/version`, { signal: AbortSignal.timeout(10000) });
  check(versionResponse.ok, "provider version endpoint");
  const version = await versionResponse.json() as { version: string };
  return { model: model.name, digest: model.digest, details: model.details, server_version: version.version };
}

export interface Gates {
  status: "PASS";
  source_fingerprint: string;
  built_fingerprint: string;
  commands: { name: string; exit_code: number | null; stdout: string; stderr: string }[];
  full_lint: unknown;
}
export function verifyGates(gates: Gates) {
  check(gates.status === "PASS" && gates.source_fingerprint === sourceFingerprint() && gates.built_fingerprint === builtFingerprint(), "engineering gates match current source and built artifacts");
  check(gates.commands.length >= 5 && gates.commands.every(c => c.exit_code === 0) &&
    ["targeted-tests", "full-tests", "harness-typecheck", "diff-check"].every(n => gates.commands.some(c => c.name === n)) &&
    gates.commands.some(c => c.name.startsWith("build:")) && gates.commands.some(c => c.name.startsWith("typecheck:")), "all engineering gate commands green");
}
