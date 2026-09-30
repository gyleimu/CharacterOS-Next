/**
 * PHASE0-RUN-3 SCORING — separate program, runs only after the dataset freeze.
 *
 *   npx tsx phase-0/run-3/run3-score.ts <run-3-dir>
 *
 * §17: refuses to score unless PHASE0_RUN3_DATASET.json exists with `scored: false` and its
 * SHA256 re-computes. §18: the endpoint is the target canonical belief credence divergence ONLY;
 * affect and relationship are descriptive and can never substitute.
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  P0_HIERARCHY_BEFORE,
  P0_L2_MEANING,
  P0_PREDICTED_A_DIRECTION,
  P0_PREDICTED_B_DIRECTION,
  P0_PRIMARY_PREDICATE,
  scorePhase0V0,
  type Phase0ScoreInputV0
} from "../contract.ts";
import { R3_VERDICT_TOKENS, R3_POSITIVE_MEANS, R3_FORBIDDEN_POSITIVE_CLAIMS } from "./contract-r3.ts";

const sha256 = (value: string): string => createHash("sha256").update(value).digest("hex");

function targetCredence(state: unknown, propositionId: string): number | null {
  const beliefs = (state as { canonical_state_view?: { beliefs?: readonly { proposition_id: string; credence: number }[] } })
    .canonical_state_view?.beliefs;
  return beliefs?.find((entry) => entry.proposition_id === propositionId)?.credence ?? null;
}

async function main(): Promise<void> {
  const dir = process.argv[2];
  if (dir === undefined) throw new Error("RUN3_SCORE_USAGE: usage: run3-score.ts <run-3-dir>");
  const write = (name: string, value: unknown): void => {
    writeFileSync(join(dir, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");
  };
  const readJson = (name: string): Record<string, unknown> =>
    JSON.parse(readFileSync(join(dir, name), "utf8")) as Record<string, unknown>;

  const integrity = readJson("RUN3_COLLECTION_INTEGRITY.json");
  const accounting = integrity["accounting"] as Record<string, unknown>;
  const allValid = integrity["all_required_turns_valid"] === true;
  const quarantined = (integrity["quarantined_subjects"] as readonly string[] | undefined) ?? [];

  if (!allValid) {
    write("PHASE0_RUN3_VERDICT.json", {
      run: "PHASE0_RUN3",
      outcome: "INCONCLUSIVE",
      verdict: R3_VERDICT_TOKENS.inconclusive[0],
      tokens: [...R3_VERDICT_TOKENS.inconclusive, "HISTORY_INTERNALIZATION_PHASE_1_NOT_AUTHORISED"],
      evidence_level: P0_HIERARCHY_BEFORE,
      reason: "a required scientific turn was invalid; the run ended at that turn",
      invalid_scientific_turns: accounting["invalid_scientific_turns"],
      integrity_failures: integrity["integrity_failures"],
      quarantined_subjects: quarantined,
      accounting,
      no_retry_no_restore_no_run4:
        "engineering recovery capability is NOT scientific recovery: no retry, no restore-and-continue, no run-4 in this round"
    });
    write("PHASE0_RUN3_SCORER_OUTPUT.json", {
      scorer: "scorePhase0V0",
      invoked_on_scientific_data: false,
      reason: "no scientific post-state endpoint exists without all ten valid required turns"
    });
    console.log(`RUN-3 VERDICT: INCONCLUSIVE (${String(accounting["invalid_scientific_turns"])} invalid scientific turn(s))`);
    console.log(`  ${R3_VERDICT_TOKENS.inconclusive[0]}`);
    console.log("STOP — no retry, no restore-and-continue, no run-4.");
    return;
  }

  // ---- §17 verify the freeze before scoring ----------------------------------------------------
  const datasetRaw = readFileSync(join(dir, "PHASE0_RUN3_DATASET.json"), "utf8");
  const dataset = JSON.parse(datasetRaw) as { scored?: boolean };
  const recorded = readJson("PHASE0_RUN3_DATASET_SHA256.json");
  const recomputed = `sha256:${sha256(datasetRaw)}`;
  const freezeVerified = dataset.scored === false && recomputed === recorded["dataset_sha256"];
  if (!freezeVerified) {
    write("PHASE0_RUN3_VERDICT.json", {
      run: "PHASE0_RUN3",
      outcome: "INCONCLUSIVE",
      verdict: R3_VERDICT_TOKENS.inconclusive[0],
      reason: "DATASET_FREEZE_NOT_VERIFIED — scoring refused",
      dataset_scored_flag: dataset.scored,
      recorded_sha256: recorded["dataset_sha256"],
      recomputed_sha256: recomputed
    });
    console.log("RUN-3 VERDICT: INCONCLUSIVE (dataset freeze not verified; scoring refused)");
    return;
  }

  // ---- §18 the endpoint: target canonical belief credence divergence ONLY -----------------------
  const preA = JSON.parse(readFileSync(join(dir, "RUN3_PRE_STATE_A.json"), "utf8")) as { scored?: boolean; state?: unknown };
  const preB = JSON.parse(readFileSync(join(dir, "RUN3_PRE_STATE_B.json"), "utf8")) as { scored?: boolean; state?: unknown };
  const postA = JSON.parse(readFileSync(join(dir, "RUN3_POST_STATE_A.json"), "utf8")) as { scored?: boolean; state?: unknown };
  const postB = JSON.parse(readFileSync(join(dir, "RUN3_POST_STATE_B.json"), "utf8")) as { scored?: boolean; state?: unknown };
  const freezeFlagsOk = [preA, preB, postA, postB].every((artifact) => artifact.scored === false);
  const schedule = readJson("RUN3_SCIENTIFIC_SCHEDULE.json");
  const propositionId = "prop.nadia-keeps-commitments";
  void schedule;

  const credencePreA = targetCredence(preA.state, propositionId);
  const credencePostA = targetCredence(postA.state, propositionId);
  const credencePreB = targetCredence(preB.state, propositionId);
  const credencePostB = targetCredence(postB.state, propositionId);
  const integrityFailures: string[] = freezeFlagsOk ? [] : ["a state artifact was not frozen with scored:false"];

  const input: Phase0ScoreInputV0 = {
    credence_pre_A: credencePreA ?? Number.NaN,
    credence_post_A: credencePostA ?? Number.NaN,
    credence_pre_B: credencePreB ?? Number.NaN,
    credence_post_B: credencePostB ?? Number.NaN,
    turns_executed_A: 5,
    turns_executed_B: 5,
    integrity_failures: integrityFailures
  };
  const score = scorePhase0V0(input);

  const stateDelta = {
    artifact: "RUN3_STATE_DELTA_REPORT",
    primary_endpoint: "target canonical belief credence divergence",
    proposition_id: propositionId,
    credence_pre_A: credencePreA,
    credence_post_A: credencePostA,
    credence_pre_B: credencePreB,
    credence_post_B: credencePostB,
    delta_A: score.delta_A,
    delta_B: score.delta_B,
    between_arm_divergence: score.between_subject_divergence,
    predicted_direction_A: P0_PREDICTED_A_DIRECTION,
    predicted_direction_B: P0_PREDICTED_B_DIRECTION,
    directional_match_A: score.directional_match_A,
    directional_match_B: score.directional_match_B,
    post_values_differ: score.values_differ,
    primary_predicate: P0_PRIMARY_PREDICATE,
    primary_predicate_satisfied: score.primary_predicate_satisfied,
    dataset_sha256: recorded["dataset_sha256"],
    freeze_verified_before_scoring: true,
    secondary_state_never_substitutes:
      "affect and relationship values are recorded for description only and cannot replace, rescue or weaken this belief endpoint"
  };
  write("RUN3_STATE_DELTA_REPORT.json", stateDelta);
  write("PHASE0_RUN3_SCORER_OUTPUT.json", {
    scorer: "scorePhase0V0",
    unchanged_since_run1: true,
    frozen_before_any_run: true,
    invoked_on_scientific_data: true,
    dataset_freeze_verified_first: true,
    result: score
  });

  const positive = score.verdict.outcome === "POSITIVE";
  const validNull = score.verdict.outcome === "FAILURE_A";
  const tokens = positive
    ? [...R3_VERDICT_TOKENS.positive]
    : validNull
      ? [...R3_VERDICT_TOKENS.valid_null, "HISTORY_INTERNALIZATION_PHASE_1_NOT_AUTHORISED"]
      : [...R3_VERDICT_TOKENS.inconclusive, "HISTORY_INTERNALIZATION_PHASE_1_NOT_AUTHORISED"];

  write("PHASE0_RUN3_VERDICT.json", {
    run: "PHASE0_RUN3",
    outcome: score.verdict.outcome,
    verdict: score.verdict.verdict,
    tokens,
    evidence_level: positive ? "L2" : P0_HIERARCHY_BEFORE,
    evidence_level_ceiling: "L2",
    levels_raised: positive ? 1 : 0,
    primary_predicate: P0_PRIMARY_PREDICATE,
    primary_predicate_satisfied: score.primary_predicate_satisfied,
    state_delta: stateDelta,
    accounting,
    integrity_failures: integrityFailures,
    positive_means: positive ? R3_POSITIVE_MEANS : null,
    forbidden_positive_claims: R3_FORBIDDEN_POSITIVE_CLAIMS,
    explicit_non_claims: [
      "that persistent belief alters cognition in a new scenario with the history removed (L3)",
      "that it alters decision or behaviour (L4)",
      "that it survives restart (L5)",
      "that it separates from a summary baseline (L6)",
      "that the subject has been shaped by its life, or that history internalization is established",
      "anything about the model's own dispositions: the LLM is an executor; the subject is the canonical state"
    ],
    phase_1_authorised: positive,
    run1_run2_gate_evidence_excluded: true,
    l2_meaning_if_positive: positive ? P0_L2_MEANING : null
  });

  console.log(`RUN-3 VERDICT: ${score.verdict.outcome}`);
  console.log(`  ${score.verdict.verdict}`);
  console.log(`  credence A ${String(credencePreA)} -> ${String(credencePostA)} (delta ${score.delta_A}, predicted ${P0_PREDICTED_A_DIRECTION}, match=${score.directional_match_A})`);
  console.log(`  credence B ${String(credencePreB)} -> ${String(credencePostB)} (delta ${score.delta_B}, predicted ${P0_PREDICTED_B_DIRECTION}, match=${score.directional_match_B})`);
  console.log(`  between-arm divergence: ${score.between_subject_divergence}`);
  console.log(`  evidence level: ${positive ? "L2" : "L1"}`);
  console.log(`  dataset sha256: ${String(recorded["dataset_sha256"])}`);
}

await main();
