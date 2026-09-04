import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, relative, join } from "node:path";
import { fileURLToPath } from "node:url";
import { check, equal } from "./fixtures.ts";
import { BASELINE, MODEL, OLLAMA_VERSION, LINT_DEBT } from "./contract.ts";
import { sha256 } from "./observe.ts";

export const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
export const EXPERIMENT_PATH = "research/experiments/familiarity-causal-behavior-v1";
export const TEST_PATH = "evals/conformance/familiarity-causal-behavior-v1.test.ts";
export const V0_PATH = "research/experiments/familiarity-causal-behavior-v0";
/**
 * Buffer bound for V1 HARNESS GIT READS ONLY (PRECALL_TECHNICAL_ABORT repair):
 * committed experiment evidence files exceed Node's default execFileSync
 * maxBuffer (~1 MiB; readiness-v1/preflight.json is ~1.28 MB), so verification
 * reads need an explicit bounded buffer. 16 MiB is a fixed engineering bound
 * safely above the largest committed evidence artifact — never unbounded, and
 * NEVER reused as a production runtime constant.
 */
export const V1_GIT_READ_MAX_BUFFER_BYTES = 16 * 1024 * 1024;
export const git = (...args: string[]) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8", windowsHide: true, maxBuffer: V1_GIT_READ_MAX_BUFFER_BYTES }).trim();
export const readJson = (path: string): unknown => JSON.parse(readFileSync(path, "utf8"));
export const writeJson = (path: string, value: unknown) => writeFileSync(path, JSON.stringify(value, null, 2) + "\n", { flag: "wx" });
export function saver(directory: string) {
  return async (name: string, value: unknown) => {
    check(/^[a-z0-9/-]+$/.test(name) && !name.includes(".."), "scoped artifact name");
    const path = join(directory, `${name}.json`);
    mkdirSync(resolve(path, ".."), { recursive: true }); writeJson(path, value);
  };
}
export function freshDirectory(path: string) {
  const absolute = resolve(ROOT, path);
  const rel = relative(ROOT, absolute).replaceAll("\\", "/");
  check(rel.startsWith("tmp/") || rel.startsWith(`${EXPERIMENT_PATH}/evidence/`), "new V1 evidence/tmp child only");
  mkdirSync(resolve(absolute, ".."), { recursive: true }); mkdirSync(absolute); return absolute;
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
      if (entry.isDirectory()) visit(path); else if (entry.isFile()) paths.push(path);
    }
  }
  for (const entry of readdirSync(join(ROOT, "packages"), { withFileTypes: true })) if (entry.isDirectory()) visit(`packages/${entry.name}/dist`);
  visit("product/sandbox/dist");
  return sha256(JSON.stringify(paths.sort().map(p => [p, sha256(readFileSync(join(ROOT, p)))])));
}
export function frozenIntegrity() {
  git("merge-base", "--is-ancestor", BASELINE, "HEAD");
  const allowed = (p: string) => p.startsWith(`${EXPERIMENT_PATH}/`) || p === TEST_PATH;
  check(git("diff", "--name-only", BASELINE).split("\n").filter(Boolean).every(allowed), "production/V0 and all other baseline files frozen");
  check(git("ls-files", "--others", "--exclude-standard").split("\n").filter(Boolean).every(allowed), "all new files isolated to V1");
  const v0 = git("ls-tree", "-r", BASELINE, "--", V0_PATH, "evals/conformance/familiarity-causal-behavior-v0.test.ts");
  check(v0 === git("ls-tree", "-r", "HEAD", "--", V0_PATH, "evals/conformance/familiarity-causal-behavior-v0.test.ts"), "V0 committed blobs unchanged");
  return { baseline: BASELINE, v0_git_blob_inventory_hash: sha256(v0), v0_files: v0.split("\n").length,
    production_and_v0_diff: "EMPTY", only_v1_changes: true };
}
export function committedBaseline() {
  check(git("branch", "--show-current") === "main", "main branch");
  check(git("status", "--porcelain").length === 0, "clean committed worktree");
  frozenIntegrity();
  const head = git("rev-parse", "HEAD");
  check(git("ls-remote", "origin", "refs/heads/main").split(/\s/)[0] === head, "HEAD equals remote main");
  return head;
}
export async function probeProvider() {
  const response = await fetch(`${MODEL.base_url}/api/tags`, { signal: AbortSignal.timeout(10000) });
  check(response.ok, "provider tags");
  const data = await response.json() as { models: { name: string; digest: string; details: unknown }[] };
  const model = data.models.find(m => m.name === MODEL.model);
  check(model?.digest === MODEL.digest, "exact pinned local model digest; never pull/fallback");
  const responseVersion = await fetch(`${MODEL.base_url}/api/version`, { signal: AbortSignal.timeout(10000) });
  check(responseVersion.ok, "provider version");
  const version = await responseVersion.json() as { version: string };
  check(version.version === OLLAMA_VERSION, "exact frozen Ollama server version");
  return { model: model.name, digest: model.digest, details: model.details, server_version: version.version };
}
export interface Gates {
  status: "PASS"; source_fingerprint: string; built_fingerprint: string;
  commands: { name: string; exit_code: number | null; stdout: string; stderr: string }[];
  full_lint: unknown;
}
export function verifyGates(gates: Gates) {
  check(gates.status === "PASS" && gates.source_fingerprint === sourceFingerprint() && gates.built_fingerprint === builtFingerprint(), "green gates match exact source/build");
  check(gates.commands.length >= 34 && gates.commands.every(c => c.exit_code === 0) &&
    ["targeted-tests", "v0-integrity-tests", "production-behavior-tests", "full-tests", "harness-typecheck", "diff-check"].every(n => gates.commands.some(c => c.name === n)) &&
    gates.commands.some(c => c.name.startsWith("build:")) && gates.commands.some(c => c.name.startsWith("typecheck:")) && equal(gates.full_lint, LINT_DEBT), "complete green gates with exactly existing lint debt");
}
