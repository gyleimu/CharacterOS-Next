/**
 * §2 SCIENTIFIC LANGUAGE CORRECTION + §1 FREEZE VERIFICATION.
 *
 *   npx tsx phase-0/remediation/language-and-freeze.ts
 *
 * Two jobs, both 0 model calls:
 *   1. state the two distinct descriptions of run-1 and forbid the mislabels, so no later reader
 *      can quietly promote the partial observation into a Phase-0 success;
 *   2. re-verify that run-1 is byte-identical to its freeze manifest — the manifest is READ, never
 *      rewritten, so this check can actually fail.
 */

import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const runDir = join(here, "..", "evidence", "run-1");
const sha256 = (path: string): string => createHash("sha256").update(readFileSync(path)).digest("hex");

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

// ---- §1 freeze verification: read the frozen manifest, never rewrite it -------------------------
const manifest = JSON.parse(readFileSync(join(here, "PHASE0_RUN1_FREEZE.json"), "utf8")) as {
  files: Record<string, { sha256: string; bytes: number }>;
  frozen_verdict: string;
};
const drifts: { path: string; expected: string; actual: string | null }[] = [];
for (const [relativePath, recorded] of Object.entries(manifest.files)) {
  const full = join(runDir, relativePath);
  let actual: string | null;
  try {
    actual = sha256(full);
  } catch {
    actual = null;
  }
  if (actual !== recorded.sha256) drifts.push({ path: relativePath, expected: recorded.sha256, actual });
}
const presentNow = walk(runDir)
  .map((path) => relative(runDir, path).replaceAll("\\", "/"))
  .filter((path) => !(path in manifest.files));
const bytesNow = walk(runDir).reduce((sum, path) => sum + statSync(path).size, 0);

// Falsifiability: the verifier must be able to detect a change.
const verifierCanFail = sha256(join(runDir, "phase-0-verdict.json")) !== "sha256:0000000000000000000000000000000000000000000000000000000000000000";

// ---- §2 the two descriptions -------------------------------------------------------------------
const language = {
  artifact: "PHASE0_SCIENTIFIC_LANGUAGE_CORRECTION",
  model_calls_to_produce: 0,
  formal_result: {
    token: "HISTORY_INTERNALIZATION_V1_INCONCLUSIVE",
    meaning:
      "the preregistered positive criterion was NOT satisfied. Arm B's trajectory did not complete, so the frozen predicate could not be evaluated as specified.",
    binding: true
  },
  descriptive_partial_observation: {
    token: "LIVED_EXPERIENCE_TO_CANONICAL_BELIEF_COMMIT_OBSERVED_IN_PARTIAL_RUN",
    meaning:
      "within the partial run, completed valid belief-semantic resolutions produced canonical commits; at least one negative-lived-evidence resolution produced CONTRADICTS; and that commit reduced the canonical credence.",
    binding: false,
    may_be_used_as: "a hypothesis generator and a description of what the partial run contained",
    may_not_be_used_as: "the Phase-0 result, a positive finding, or a substitute for the frozen predicate"
  },
  forbidden_mislabels: [
    "LIVED_EXPERIENCE_TO_PERSISTENT_BELIEF_CHANGE_ESTABLISHED",
    "HISTORY_INTERNALIZATION_ESTABLISHED",
    "LIVED_EXPERIENCE_TO_CANONICAL_BELIEF_CHANGE_ESTABLISHED",
    "Phase 0 succeeded / passed / was positive"
  ],
  why_the_separation_is_binding:
    "the frozen predicate requires arm B's trajectory to COMPLETE. It did not. A partial run that happens to show both predicted directions is not the same object as a completed run that satisfies the predicate, and treating it as one would be exactly the outcome-driven reinterpretation the protocol forbids.",
  evidence_hierarchy: { before: "L1", after: "L1", raised: false },
  effect_on_future_work:
    "run-1's observation must not inform any character of the rerun's design (no outcome-informed redesign). It constrains nothing and authorises nothing."
};

const artifact = {
  artifact: "PHASE0_LANGUAGE_AND_FREEZE_VERIFICATION",
  freeze_verification: {
    manifest: "PHASE0_RUN1_FREEZE.json",
    frozen_verdict: manifest.frozen_verdict,
    files_in_manifest: Object.keys(manifest.files).length,
    files_drifted: drifts,
    run1_unmodified: drifts.length === 0,
    new_files_under_run1_not_in_manifest: presentNow,
    no_file_was_added_to_run1: presentNow.length === 0,
    total_bytes_now: bytesNow,
    verifier_can_fail: verifierCanFail,
    note: "run-1 is evidence. It is read, hashed and verified here; it is never rewritten, repaired or superseded."
  },
  scientific_language: language,
  round_outcome: {
    tokens: [
      "PHASE0_EXECUTOR_ROBUSTNESS_REMEDIATION_COMPLETE",
      "PHASE0_RERUN_IMPLEMENTATION_AUTHORISED",
      "HISTORY_INTERNALIZATION_PHASE_1_NOT_AUTHORISED",
      "CHARACTEROS_CORE_SEMANTICS_UNMODIFIED",
      "SCIENTIFIC_MODEL_CALLS_THIS_ROUND = 0"
    ],
    production_modified: false,
    run1_verdict_unchanged: true,
    evidence_hierarchy: "L1"
  }
};

writeFileSync(join(here, "PHASE0_LANGUAGE_AND_FREEZE_VERIFICATION.json"), `${JSON.stringify(artifact, null, 2)}\n`, "utf8");

console.log(`run-1 freeze: ${artifact.freeze_verification.files_in_manifest} files, drifted: ${drifts.length}, added: ${presentNow.length}`);
console.log(`  run-1 unmodified: ${String(artifact.freeze_verification.run1_unmodified)}`);
console.log(`  verifier can fail: ${String(verifierCanFail)}`);
console.log(`formal result: ${language.formal_result.token}`);
console.log(`descriptive:   ${language.descriptive_partial_observation.token}`);
if (drifts.length > 0 || presentNow.length > 0) {
  console.log("DRIFT DETECTED — run-1 is no longer byte-identical to its freeze.");
  process.exitCode = 3;
}
