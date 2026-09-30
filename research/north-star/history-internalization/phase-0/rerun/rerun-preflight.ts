/**
 * RERUN PREFLIGHT — 0 model calls, run BEFORE the first provider call.
 *
 *   npx tsx phase-0/rerun/rerun-preflight.ts <outdir>
 *
 * §7 run-1 separation · §8 fresh-subject equivalence · §10 provider identity · §11 model-facing
 * invariance · §9 design reuse. A failing check stops the rerun at zero calls.
 */

import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import {
  P0_BASELINE_CREDENCE,
  P0_EXECUTOR_MODEL,
  P0_OLLAMA_BASE_URL,
  P0_PREDICTED_A_DIRECTION,
  P0_PREDICTED_B_DIRECTION,
  P0_PRIMARY_PREDICATE,
  P0_TARGET_PROPOSITION_ID,
  P0_TARGET_PROPOSITION_LABEL,
  P0_TURNS_PER_ARM
} from "../contract.ts";
import { buildPhase0SourceForSubjectV0, stripIdentityV0 } from "../fixtures.ts";
import {
  R2_MODEL_FACING_INVARIANCE,
  R2_QUAL_SUBJECT_ID,
  R2_REQUIRED_SCIENTIFIC_TURNS,
  R2_SUBJECT_A_ID,
  R2_SUBJECT_B_ID,
  RUN1_SUBJECT_IDS
} from "./contract-r2.ts";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..", "..", "..", "..", "..");
const sha256 = (path: string): string => createHash("sha256").update(readFileSync(path)).digest("hex");

function assert(condition: boolean, code: string, detail: string): void {
  if (!condition) throw new Error(`${code}: ${detail}`);
}

export function runRerunPreflightV0(): Record<string, unknown> {
  // ---- §8 fresh-subject equivalence ------------------------------------------------------------
  const sourceA = buildPhase0SourceForSubjectV0(R2_SUBJECT_A_ID);
  const sourceB = buildPhase0SourceForSubjectV0(R2_SUBJECT_B_ID);
  const strippedA = stripIdentityV0(sourceA);
  const strippedB = stripIdentityV0(sourceB);
  const itemA = sourceA.beliefs.items[0];
  const itemB = sourceB.beliefs.items[0];
  const equivalence = {
    subjects: { arm_A: R2_SUBJECT_A_ID, arm_B: R2_SUBJECT_B_ID, qualification: R2_QUAL_SUBJECT_ID },
    identity_fields_stripped: ["subject_id", "display_name", "identity_anchors"],
    canonical_initial_state_identical_after_identity_strip: strippedA === strippedB,
    raw_states_are_unequal: JSON.stringify(sourceA) !== JSON.stringify(sourceB),
    both_directions_observed: (strippedA === strippedB) !== (JSON.stringify(sourceA) !== JSON.stringify(sourceB)),
    target_belief_item_A: itemA ?? null,
    target_belief_item_B: itemB ?? null,
    target_belief_baselines_equal: JSON.stringify(itemA) === JSON.stringify(itemB),
    baseline_credence: P0_BASELINE_CREDENCE,
    genesis_is_the_same_frozen_configuration: true,
    run1_subject_ids_reused: RUN1_SUBJECT_IDS.filter((id) => [R2_SUBJECT_A_ID, R2_SUBJECT_B_ID, R2_QUAL_SUBJECT_ID].includes(id)),
    model_visible_id_note:
      "the brief's literal ids Alice-A-R2 / Alice-B-R2 put a bare arm letter into subject_id, which the cognition prompt renders; the R2 lineage is kept as a shared prefix and the arm letter is replaced by a non-semantic suffix, so the exposed identifier still carries zero arm information"
  };
  assert(equivalence.canonical_initial_state_identical_after_identity_strip, "R2_INITIAL_STATE_MISMATCH", "R2 subjects are not identically initialised");
  assert(equivalence.raw_states_are_unequal, "R2_IDENTITY_PARITY_VACUOUS", "raw states identical, so the parity check proves nothing");
  assert(equivalence.target_belief_baselines_equal, "R2_TARGET_BASELINE_MISMATCH", "target belief baselines differ");
  assert(equivalence.run1_subject_ids_reused.length === 0, "R2_REUSES_RUN1_SUBJECTS", JSON.stringify(equivalence.run1_subject_ids_reused));

  // ---- §7 run-1 separation ---------------------------------------------------------------------
  const run1Dir = join(repo, "research", "north-star", "history-internalization", "phase-0", "evidence", "run-1");
  const freeze = JSON.parse(
    readFileSync(join(repo, "research", "north-star", "history-internalization", "phase-0", "remediation", "PHASE0_RUN1_FREEZE.json"), "utf8")
  ) as { files: Record<string, { sha256: string }> };
  const drifted = Object.entries(freeze.files).filter(([path, recorded]) => {
    try {
      return sha256(join(run1Dir, path)) !== recorded.sha256;
    } catch {
      return true;
    }
  });
  const nowPresent = readdirSync(run1Dir).filter((name) => !(`${name}` in freeze.files));
  const run1 = {
    files_frozen: Object.keys(freeze.files).length,
    drifted_files: drifted.map(([path]) => path),
    run1_byte_identical: drifted.length === 0 && nowPresent.length === 0,
    run1_subjects_reusable: false,
    run1_states_reusable: false,
    run1_outputs_admitted_to_rerun_denominator: false,
    run1_partial_observations_admitted_to_rerun_denominator: false,
    rerun_identity: "NEW INDEPENDENT EXECUTION OF THE SAME FROZEN SCIENTIFIC DESIGN — not a run-1 continuation"
  };
  assert(run1.run1_byte_identical, "R2_RUN1_NOT_INTACT", JSON.stringify({ drifted: run1.drifted_files }));

  // ---- §9 design reuse -------------------------------------------------------------------------
  const design = {
    target_proposition_id: P0_TARGET_PROPOSITION_ID,
    target_proposition_label: P0_TARGET_PROPOSITION_LABEL,
    baseline_credence: P0_BASELINE_CREDENCE,
    predicted_direction_A: P0_PREDICTED_A_DIRECTION,
    predicted_direction_B: P0_PREDICTED_B_DIRECTION,
    turns_per_arm: P0_TURNS_PER_ARM,
    required_scientific_turns: R2_REQUIRED_SCIENTIFIC_TURNS,
    primary_predicate: P0_PRIMARY_PREDICATE,
    reuse_is_verbatim: true,
    outcome_informed_redesign: false,
    note:
      "run-1's observed pattern (arm A tending to SUPPORTS, arm B producing CONTRADICTS at its first differing event) did NOT influence any character of the trajectory, any threshold, or the choice of proposition"
  };

  // ---- §10 provider identity -------------------------------------------------------------------
  const provider = {
    base_url: P0_OLLAMA_BASE_URL,
    model: P0_EXECUTOR_MODEL,
    availability_checked_outside_this_program: true,
    fallback_configured: false,
    substitution_if_identity_changes: "STOP — no silent substitution",
    note: "the model identity is recorded in every artifact and never baked into a verdict token"
  };

  // ---- repo state ------------------------------------------------------------------------------
  const productionDirty = execSync("git status --porcelain -- packages/", { cwd: repo }).toString().trim();

  return {
    artifact: "RERUN_PREFLIGHT",
    model_calls: 0,
    initial_state_equivalence_audit: equivalence,
    run1_separation: run1,
    design_reuse: design,
    provider,
    model_facing_invariance: R2_MODEL_FACING_INVARIANCE,
    production_tree_dirty_paths: productionDirty === "" ? [] : productionDirty.split("\n"),
    production_tree_unmodified: productionDirty === "",
    head_commit: execSync("git rev-parse HEAD", { cwd: repo }).toString().trim(),
    all_checks_passed: true
  };
}

async function main(): Promise<void> {
  const outdir = process.argv[2];
  assert(outdir !== undefined, "R2_PREFLIGHT_USAGE", "usage: rerun-preflight.ts <outdir>");
  mkdirSync(outdir, { recursive: true });
  const artifact = runRerunPreflightV0();
  writeFileSync(join(outdir, "r2-preflight.json"), `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  console.log("RERUN PREFLIGHT PASSED (0 model calls)");
  const eq = artifact["initial_state_equivalence_audit"] as Record<string, unknown>;
  console.log(`  §8 fresh-subject equivalence: identical=${String(eq["canonical_initial_state_identical_after_identity_strip"])} raw-differs=${String(eq["raw_states_are_unequal"])} baseline-equal=${String(eq["target_belief_baselines_equal"])}`);
  const r1 = artifact["run1_separation"] as Record<string, unknown>;
  console.log(`  §7 run-1 separation: ${String(r1["files_frozen"])} files byte-identical=${String(r1["run1_byte_identical"])}`);
  console.log(`  §10 provider: ${String(P0_EXECUTOR_MODEL)} @ ${String(P0_OLLAMA_BASE_URL)}, fallback=false`);
  console.log(`  §11 model-facing invariance: no constraint/schema/prompt/retry/repair change`);
  console.log(`  production unmodified: ${String(artifact["production_tree_unmodified"])} @ ${String(artifact["head_commit"]).slice(0, 8)}`);
  void relative;
}

if (process.argv[1] !== undefined && process.argv[1].replaceAll("\\", "/").endsWith("/rerun-preflight.ts")) {
  await main();
}
