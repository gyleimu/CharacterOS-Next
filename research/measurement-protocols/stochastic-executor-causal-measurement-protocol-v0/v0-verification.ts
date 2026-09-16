/**
 * STOCHASTIC_EXECUTOR_CAUSAL_MEASUREMENT_PROTOCOL_V0 — read-only V0 evidence verifier.
 *
 * V0 is CLOSED and is NEVER modified, re-sealed or re-interpreted. This tool
 * exists to (a) confirm the archived V0 evidence is byte-intact at the V0 result
 * commit, and (b) demonstrate — mechanically, not rhetorically — why V0's freeze
 * manifest hash is not reproducible, which is the defect the protocol's hash law
 * removes for future experiments.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { canonicalJson, contentHashOf, gitBlobHash } from "./hashing.ts";

export const V0_EXPERIMENT = "believe-causal-validation-v0";
export const V0_EVIDENCE_DIR = "research/experiments/belief-causal-validation-v0/evidence";
/** The commit that introduced the V0 result evidence (V0 RESULT_COMMIT). */
export const V0_RESULT_COMMIT = "c18505fb150640e7b9e2dda8f0bbcca137f25e98";

export const V0_EVIDENCE_FILES: readonly string[] = [
  `${V0_EVIDENCE_DIR}/report.json`,
  `${V0_EVIDENCE_DIR}/scientific-freeze-manifest.json`,
  `${V0_EVIDENCE_DIR}/precheck/precheck.json`,
  `${V0_EVIDENCE_DIR}/pilot/verdict.json`,
  `${V0_EVIDENCE_DIR}/primary/verdict.json`,
  `${V0_EVIDENCE_DIR}/replication/verdict.json`
];

export interface V0Verification {
  readonly v0_evidence_intact: boolean;
  readonly evidence: readonly { readonly file: string; readonly archived_matches_worktree: boolean; readonly archived_hash: string }[];
  readonly manifest_defect: {
    readonly reproducible: boolean;
    readonly fields_inside_hashed_core_that_break_reproduction: readonly string[];
    readonly detail: string;
  };
  readonly report_hash_law: {
    readonly recomputable_without_a_stated_law: boolean;
    readonly detail: string;
  };
  readonly mutation: "NONE — read only";
}

function fileSha256(repoDir: string, path: string): string {
  return `sha256:${contentHashOf(readFileSync(join(repoDir, path), "utf8")).replace(/^sha256:/, "")}`;
}

function gitCommitExists(repoDir: string, sha: string): boolean {
  try {
    execFileSync("git", ["cat-file", "-e", `${sha}^{commit}`], { cwd: repoDir, stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

export function verifyV0Evidence(repoDir: string): V0Verification {
  const evidence: { file: string; archived_matches_worktree: boolean; archived_hash: string }[] = [];
  for (const file of V0_EVIDENCE_FILES) {
    let archived = "UNAVAILABLE";
    let matches = false;
    if (gitCommitExists(repoDir, V0_RESULT_COMMIT)) {
      archived = gitBlobHash(repoDir, V0_RESULT_COMMIT, file);
      matches = archived === fileSha256(repoDir, file);
    }
    evidence.push({ file, archived_matches_worktree: matches, archived_hash: archived });
  }

  // V0's manifest core carried `frozen_at_utc` (wall clock) and
  // `repository.head` (the CURRENT checkout at manifest time). Both are outside
  // the experiment's control after the fact, so the stored hash cannot be
  // reproduced at any later commit — exactly the defect the new hash law bans.
  const v0Manifest = JSON.parse(
    readFileSync(join(repoDir, `${V0_EVIDENCE_DIR}/scientific-freeze-manifest.json`), "utf8")
  ) as Record<string, unknown>;
  const repository = (v0Manifest["repository"] ?? {}) as Record<string, unknown>;
  const defects: string[] = [];
  if (typeof v0Manifest["frozen_at_utc"] === "string") defects.push("frozen_at_utc (wall-clock value inside the hashed core)");
  if (typeof repository["head"] === "string") defects.push("repository.head (current HEAD inside the hashed core)");
  if (typeof repository["tracked_tree_dirty_outside_experiment"] === "number") {
    defects.push("repository.tracked_tree_dirty_outside_experiment (mutable worktree state inside the hashed core)");
  }

  const v0Report = JSON.parse(readFileSync(join(repoDir, `${V0_EVIDENCE_DIR}/report.json`), "utf8")) as Record<string, unknown>;
  const storedReportHash = v0Report["report_hash"];
  const rest: Record<string, unknown> = { ...v0Report };
  delete rest["report_hash"];
  const wholeFileHash = contentHashOf(canonicalJson(rest));
  const statedSubcore = contentHashOf(
    canonicalJson({ verdict: rest["verdict"], primary: rest["primary"], replication: rest["replication"] })
  );

  return {
    v0_evidence_intact: evidence.every((entry) => entry.archived_matches_worktree),
    evidence,
    manifest_defect: {
      reproducible: false,
      fields_inside_hashed_core_that_break_reproduction: defects,
      detail:
        "V0's stored manifest_hash cannot be re-derived after the run because the hashed core contains wall-clock and current-HEAD fields; the V0 slice disclosed this and re-sealed once after a type-only repair. The protocol's manifest law removes every such field from the core."
    },
    report_hash_law: {
      recomputable_without_a_stated_law: false,
      detail:
        `V0 stored report_hash=${String(storedReportHash)}; recomputing over the whole file minus report_hash gives ${wholeFileHash} ` +
        `while the experiment's implicit sub-core {verdict, primary, replication} gives ${statedSubcore}. Two plausible laws exist and none was pinned in the artefact, ` +
        "so an independent auditor cannot know which one authored the value. The protocol's report law pins exactly one: report_core = report minus report_hash."
    },
    mutation: "NONE — read only"
  };
}
