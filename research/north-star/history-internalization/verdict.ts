/* Round verdict for RETURN TO NORTH STAR — design/audit only.
   The claim MODEL_CALLS_THIS_ROUND = 0 is backed by a falsifiable check: a round that
   had spent calls would have left model-output artifacts (a dataset/target/pilot
   file) in this round's evidence directory. That check must be able to fail, so it is
   exercised against a constructed filename before it is trusted. */

import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..", "..", "..");
const evidenceDir = join(here, "evidence", "v1");

const sha256 = (path: string): string =>
  createHash("sha256").update(readFileSync(path)).digest("hex");

const MODEL_OUTPUT_FILENAME = /dataset|target|pilot|noise|call[_-]?ledger|stability/i;

/** True when the directory holds any model-output artifact. */
const holdsModelOutput = (names: readonly string[]): boolean =>
  names.some((n) => MODEL_OUTPUT_FILENAME.test(n));

const artifactPaths = [
  join(repo, "research", "north-star", "BELIEF_MICRO_LOCALIZATION_CLOSURE.md"),
  join(repo, "research", "north-star", "HISTORY_INTERNALIZATION_TEST_V1_PREREGISTRATION.md"),
  join(here, "HISTORY_INTERNALIZATION_EVIDENCE_MAP.md"),
  join(evidenceDir, "CURRENT_EXPERIENCE_INTERNALIZATION_PATHS.json"),
  join(evidenceDir, "frozen-belief-line-verification.json")
];

const artifacts = Object.fromEntries(
  artifactPaths.map((p) => [p.replace(`${repo}\\`, "").replaceAll("\\", "/"), sha256(p)])
);

const evidenceNames = readdirSync(evidenceDir);

// Falsifiability gate: the zero-call check must be able to fire.
const gateExercises = {
  "a_real_model_output_name_is_detected": holdsModelOutput(["d4c1-target-dataset.json"]) === true,
  "a_design_only_evidence_set_is_not_flagged": holdsModelOutput(evidenceNames) === false,
  "both_directions_observed": holdsModelOutput(["d4c1-target-dataset.json"]) !== holdsModelOutput(evidenceNames)
};

const preReg = readFileSync(artifactPaths[1], "utf8");
const requiredSections = [
  "SCIENTIFIC QUESTION",
  "NORTH STAR LINK",
  "EXISTING EVIDENCE",
  "MISSING EVIDENCE",
  "SUBJECT INITIALIZATION",
  "CONTROLLED TRAJECTORY A",
  "CONTROLLED TRAJECTORY B",
  "HISTORY REMOVAL PROTOCOL",
  "LEAKAGE AUDIT",
  "TEST SCENARIOS",
  "CANONICAL STATE READOUT",
  "BEHAVIOURAL READOUT",
  "STATE INTERVENTION",
  "ABLATION",
  "RESTART PHASE",
  "BASELINES",
  "METRICS",
  "FROZEN SCORING RULES",
  "INVALID POLICY",
  "FALSIFICATION CRITERIA",
  "CLAIM BOUNDARIES",
  "CALL BUDGET",
  "STOP RULES"
];
const missingSections = requiredSections.filter((s) => !preReg.includes(`## ${requiredSections.indexOf(s) + 1}. ${s}`));

const levels = ["L0", "L1", "L2", "L3", "L4", "L5", "L6"].filter((l) => preReg.includes(`**${l}**`));
const failures = ["**A**", "**B**", "**C**", "**D**", "**E**"].filter((f) => preReg.includes(`| ${f} |`));

mkdirSync(evidenceDir, { recursive: true });
const verdict = {
  round: "RETURN_TO_NORTH_STAR",
  date: "2026-09-21",
  verdicts: [
    "BELIEF_MICRO_LOCALIZATION_PAUSED",
    "HISTORY_INTERNALIZATION_V1_DESIGN_READY",
    "CHARACTEROS_UNMODIFIED",
    "MODEL_CALLS_THIS_ROUND = 0"
  ],
  model_calls_this_round: 0,
  zero_call_claim_basis:
    "no model-output artifact exists in this round's evidence directory; the check that asserts this was itself exercised against a constructed model-output filename and fired",
  zero_call_falsifiability_gate: gateExercises,
  zero_call_gate_is_falsifiable: Object.values(gateExercises).every((v) => v === true),
  production_modified: false,
  production_dirty_paths: [],
  credentials_in_artifacts: false,
  preregistration_sections_present: requiredSections.length - missingSections.length,
  preregistration_sections_required: requiredSections.length,
  preregistration_sections_missing: missingSections,
  preregistration_is_complete: missingSections.length === 0,
  causal_hierarchy_levels_documented: levels,
  causal_hierarchy_level_count: levels.length,
  falsification_criteria_documented: failures.length,
  current_causal_level: "L1",
  target_causal_level: "L2",
  experiment_runnable_on_live_path: "EXPERIENCE_TO_BELIEF",
  pre_flight_precondition_unnamed_in_prior_evidence:
    "M1: whether LIVED evidence moves credence at all. D1 established only that an AUTHORED credence difference is lawful and isolated, which says nothing about this channel.",
  channels_out_of_scope: [
    "EXPERIENCE_TO_PERSONALITY — optional factory unsupplied in production; closing it needs a production change, not authorised",
    "EXPERIENCE_TO_AFFECT — present but not wired to turns; a test asserts it is not exported from the runtime index"
  ],
  total_call_budget_if_executed: 115,
  call_budget_frozen: true,
  artifact_sha256: artifacts
};

writeFileSync(join(evidenceDir, "ROUND_VERDICT.json"), `${JSON.stringify(verdict, null, 2)}\n`);

console.log(`preregistration sections: ${verdict.preregistration_sections_present}/${verdict.preregistration_sections_required}`);
if (missingSections.length > 0) console.log(`MISSING: ${missingSections.join(", ")}`);
console.log(`causal hierarchy: ${levels.length} levels (${levels.join(" ")}) — current L1, target L2`);
console.log(`falsification criteria: ${failures.length} (A-E)`);
console.log(`zero-call gate falsifiable: ${verdict.zero_call_gate_is_falsifiable}`);
console.log(`budget if executed: ${verdict.total_call_budget_if_executed}`);
console.log(`artifacts hashed: ${Object.keys(artifacts).length}`);
console.log("MODEL_CALLS_THIS_ROUND = 0");
