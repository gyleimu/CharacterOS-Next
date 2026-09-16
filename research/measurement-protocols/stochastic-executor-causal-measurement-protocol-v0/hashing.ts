/**
 * STOCHASTIC_EXECUTOR_CAUSAL_MEASUREMENT_PROTOCOL_V0 — evidence hash laws.
 *
 * WHY THIS EXISTS: the V0 audit found two evidence-integrity defects —
 * (1) the freeze manifest hash was not reproducible (a timestamp and the CURRENT
 *     git HEAD were inside the hashed core, so any new commit invalidated it and
 *     a re-seal was needed after the science had already run);
 * (2) the report hash was not independently reproducible.
 *
 * LAWS IMPLEMENTED HERE
 *   manifest_core  excludes manifest_hash, generated_at and ANY current-HEAD
 *                  lookup; it contains ONLY the frozen design plus the code
 *                  hashes of the PREREGISTRATION COMMIT's git blobs.
 *   manifest_hash  = sha256(canonicalJson(manifest_core))       [sorted keys, UTF-8]
 *   report_hash    = sha256(canonicalJson(report_core))         [report_core = report minus report_hash]
 *   verification   compares the stored commit identity and the stored hashes —
 *                  NEVER the current checkout HEAD — so an old manifest stays
 *                  valid forever and is verifiable offline at any later commit.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

/** Canonical JSON: sorted keys at every level, no whitespace, UTF-8. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
}

export function sha256Hex(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export function contentHashOf(text: string): string {
  return `sha256:${sha256Hex(text)}`;
}

export function manifestHashOf(manifestCore: Record<string, unknown>): string {
  return contentHashOf(canonicalJson(manifestCore));
}

export function reportHashOf(reportCore: Record<string, unknown>): string {
  return contentHashOf(canonicalJson(reportCore));
}

/** Reads a file's exact bytes from a git commit (no checkout, no HEAD dependency). */
export function gitBlobHash(repoDir: string, commitSha: string, path: string): string {
  const content = execFileSync("git", ["cat-file", "blob", `${commitSha}:${path}`], {
    cwd: repoDir,
    encoding: "buffer",
    maxBuffer: 64 * 1024 * 1024
  });
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

export function gitBlobContent(repoDir: string, commitSha: string, path: string): string {
  return execFileSync("git", ["cat-file", "blob", `${commitSha}:${path}`], {
    cwd: repoDir,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024
  });
}

export function gitCommitExists(repoDir: string, commitSha: string): boolean {
  try {
    execFileSync("git", ["cat-file", "-e", `${commitSha}^{commit}`], { cwd: repoDir, stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

export interface ManifestVerification {
  readonly ok: boolean;
  readonly detail: string;
  readonly checked: readonly string[];
}

export interface FreezeManifestShape {
  readonly schema_version: string;
  readonly protocol_id: string;
  readonly preregistration_commit_sha: string;
  readonly code_blob_hashes: Readonly<Record<string, string>>;
  readonly design: Readonly<Record<string, unknown>>;
  readonly manifest_hash: string;
}

/**
 * Verifies a stored freeze manifest WITHOUT looking at the current HEAD:
 *   1. the stored hash reproduces from the stored core,
 *   2. the preregistration commit exists and every recorded blob still hashes
 *      to the recorded value (in the git object database, not the worktree).
 */
export function verifyFreezeManifest(repoDir: string, manifest: FreezeManifestShape): ManifestVerification {
  const checked: string[] = [];
  const { manifest_hash: storedHash, ...core } = manifest as FreezeManifestShape & Record<string, unknown>;
  void storedHash;
  const recomputed = manifestHashOf(core as Record<string, unknown>);
  checked.push(`manifest_core_hash:${recomputed === storedHash ? "OK" : "MISMATCH"}`);
  if (recomputed !== storedHash) {
    return { ok: false, detail: `manifest core hash mismatch: stored ${storedHash}, recomputed ${recomputed}`, checked };
  }
  if (!gitCommitExists(repoDir, manifest.preregistration_commit_sha)) {
    return { ok: false, detail: `preregistration commit ${manifest.preregistration_commit_sha} not found`, checked };
  }
  checked.push("preregistration_commit:OK");
  for (const [path, expected] of Object.entries(manifest.code_blob_hashes)) {
    const actual = gitBlobHash(repoDir, manifest.preregistration_commit_sha, path);
    checked.push(`blob:${path}:${actual === expected ? "OK" : "MISMATCH"}`);
    if (actual !== expected) {
      return {
        ok: false,
        detail: `blob hash mismatch for ${path} at ${manifest.preregistration_commit_sha}: stored ${expected}, actual ${actual}`,
        checked
      };
    }
  }
  return { ok: true, detail: "manifest core hash reproduces and every preregistration blob matches", checked };
}

/**
 * Builds a freeze manifest from a preregistration commit. `design` must contain
 * only frozen design values (no timestamps, no HEAD lookups, no run results).
 */
export function buildFreezeManifest(input: {
  readonly repoDir: string;
  readonly preregistrationCommitSha: string;
  readonly protocolId: string;
  readonly codeFiles: readonly string[];
  readonly design: Readonly<Record<string, unknown>>;
}): FreezeManifestShape {
  const codeBlobHashes: Record<string, string> = {};
  for (const path of input.codeFiles) {
    codeBlobHashes[path] = gitBlobHash(input.repoDir, input.preregistrationCommitSha, path);
  }
  const core = {
    schema_version: "stochastic-executor-causal-freeze-manifest-v1",
    protocol_id: input.protocolId,
    preregistration_commit_sha: input.preregistrationCommitSha,
    code_blob_hashes: codeBlobHashes,
    design: input.design
  };
  return { ...core, manifest_hash: manifestHashOf(core) };
}

export interface ReportVerification {
  readonly ok: boolean;
  readonly detail: string;
  readonly report_hash: string;
}

/** Verifies a report's own hash after any serialize/deserialize round trip. */
export function verifyReport(report: Record<string, unknown>): ReportVerification {
  const stored = report["report_hash"];
  const core: Record<string, unknown> = { ...report };
  delete core["report_hash"];
  const recomputed = reportHashOf(core);
  return {
    ok: stored === recomputed,
    detail: stored === recomputed ? "report hash reproduces from report_core" : `stored ${String(stored)} != recomputed ${recomputed}`,
    report_hash: recomputed
  };
}

export function sealReport(reportCore: Record<string, unknown>): Record<string, unknown> {
  return { ...reportCore, report_hash: reportHashOf(reportCore) };
}

/** §27: the run-start gate. Compares the CURRENT HEAD to the recorded prereg SHA. */
export function assertFormalRunCodeState(repoDir: string, preregistrationCommitSha: string): void {
  const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoDir, encoding: "utf8" }).trim();
  if (head !== preregistrationCommitSha) {
    throw new Error(
      `SCIENTIFIC_CODE_STATE_MISMATCH: HEAD ${head} != PREREGISTRATION_COMMIT ${preregistrationCommitSha}`
    );
  }
}
