/**
 * PHASE 0 RERUN — scoring.
 *
 *   npx tsx phase-0/rerun/rerun-score.ts <run-2-dir>
 *
 * Runs ONLY against the artifacts frozen by `rerun.ts`, and refuses to run unless the post-state
 * freezes exist with `scored: false`. The scorer is the SAME pure function frozen before run-1 and
 * unchanged by anything run-1 or the remediation observed.
 *
 * Policy inherited verbatim:
 *   - any invalid required scientific turn  -> HISTORY_INTERNALIZATION_V1_PHASE0_RERUN_INCONCLUSIVE
 *   - all ten valid + predicate satisfied   -> positive
 *   - all ten valid + predicate unsatisfied -> valid null (Failure A)
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  P0_HIERARCHY_AFTER_POSITIVE,
  P0_HIERARCHY_BEFORE,
  P0_L2_MEANING,
  P0_PREDICTED_A_DIRECTION,
  P0_PREDICTED_B_DIRECTION,
  P0_TURNS_PER_ARM,
  hashPhase0,
  scorePhase0V0,
  type Phase0ScoreInputV0
} from "../contract.ts";
import {
  R2_EXPLICIT_NON_CLAIMS,
  R2_HIERARCHY_CEILING,
  R2_REQUIRED_SCIENTIFIC_TURNS,
  R2_SCIENTIFIC_POLICY,
  R2_VERDICT_TOKENS
} from "./contract-r2.ts";

interface TargetItem {
  readonly proposition_id: string;
  readonly proposition_label: string;
  readonly credence: number;
}

function targetCredence(state: unknown, propositionId: string): number | null {
  const beliefs = (state as { canonical_state_view?: { beliefs?: readonly TargetItem[] } }).canonical_state_view?.beliefs;
  return beliefs?.find((entry) => entry.proposition_id === propositionId)?.credence ?? null;
}

async function main(): Promise<void> {
  const dir = process.argv[2];
  if (dir === undefined) throw new Error("R2_SCORE_USAGE: usage: rerun-score.ts <run-2-dir>");
  const write = (name: string, value: unknown): string => {
    const content = `${JSON.stringify(value, null, 2)}\n`;
    writeFileSync(join(dir, name), content, "utf8");
    return content;
  };
  const readJson = (name: string): Record<string, unknown> =>
    JSON.parse(readFileSync(join(dir, name), "utf8")) as Record<string, unknown>;

  // ---- infrastructure block: the run never reached a scientific turn -----------------------------
  // A resource failure that stops the run at the non-scientific bootstrap is NOT a scientific null.
  // It is handled here, in the single scoring program, so there is exactly one verdict path.
  try {
    readFileSync(join(dir, "r2-execution-manifest.json"), "utf8");
  } catch {
    const block = readJson("r2-infrastructure-block.json");
    const verdictArtifact = {
      run: "HISTORY_INTERNALIZATION_V1_PHASE0_RERUN",
      outcome: "INCONCLUSIVE",
      verdict: R2_VERDICT_TOKENS.inconclusive[0],
      failure_class: block["failure_class"],
      reason: block["observed_failure"],
      scientific_turns_executed: block["scientific_turns_executed"],
      scientific_data_produced: block["scientific_data_produced"],
      states: {
        run1: "HISTORY_INTERNALIZATION_V1_INCONCLUSIVE (unchanged)",
        run2: "INCONCLUSIVE — infrastructure, zero scientific turns",
        evidence_hierarchy: "L1 (unchanged)",
        phase_1_authorised: false
      },
      explicitly_not_established: R2_EXPLICIT_NON_CLAIMS,
      note:
        "no retry, no provider swap, no configuration change, no event redesign. The precondition to resume is recorded in r2-infrastructure-block.json."
    };
    write("r2-verdict.json", verdictArtifact);
    write("r2-dataset.json", {
      scored: false,
      reason: "no scientific turn was executed, so there is no dataset to score",
      scientific_turns_executed: 0
    });
    console.log(`RERUN VERDICT: INCONCLUSIVE (${String(block["failure_class"])})`);
    console.log(`  scientific turns executed: ${String(block["scientific_turns_executed"])}`);
    console.log(`  ${R2_VERDICT_TOKENS.inconclusive[0]}`);
    console.log("STOP — no retry, no provider swap, no configuration change.");
    return;
  }

  const manifest = readJson("r2-execution-manifest.json");
  const accounting = manifest["accounting"] as Record<string, unknown>;
  const allValid = manifest["all_required_turns_valid"] === true;
  const quarantined = (manifest["quarantined_subjects"] as readonly string[] | undefined) ?? [];

  // ---- integrity: an invalid required turn is an INCONCLUSIVE run, never a scientific null -------
  const integrityFailures: string[] = [];
  if (!allValid) {
    integrityFailures.push(
      `${R2_SCIENTIFIC_POLICY.law}: ${R2_SCIENTIFIC_POLICY.on_invalid}`
    );
  }
  if (quarantined.length > 0) {
    integrityFailures.push(`${R2_SCIENTIFIC_POLICY.quarantine_token}: ${quarantined.join(", ")}`);
  }

  let score = null as ReturnType<typeof scorePhase0V0> | null;
  let stateDelta: Record<string, unknown> = {
    status: "NOT_COMPUTED",
    reason:
      "the post-state endpoint is only defined when all ten required scientific turns are valid; a quarantined state may not enter the state-delta scorer"
  };
  let hierarchyAfter: string = P0_HIERARCHY_BEFORE;

  if (allValid) {
    const preA = JSON.parse(readFileSync(join(dir, "r2-pre-state-A.json"), "utf8")) as { scored?: boolean; state?: unknown };
    const preB = JSON.parse(readFileSync(join(dir, "r2-pre-state-B.json"), "utf8")) as { scored?: boolean; state?: unknown };
    const postA = JSON.parse(readFileSync(join(dir, "r2-post-state-A.json"), "utf8")) as { scored?: boolean; state?: unknown };
    const postB = JSON.parse(readFileSync(join(dir, "r2-post-state-B.json"), "utf8")) as { scored?: boolean; state?: unknown };
    if ([preA, preB, postA, postB].some((artifact) => artifact.scored !== false)) {
      integrityFailures.push("a state artifact was not frozen with scored:false");
    }
    const identity = readJson("r2-preflight.json")["design_reuse"] as Record<string, unknown>;
    const propositionId = String(identity["target_proposition_id"]);

    const itemPreA = targetCredence(preA.state, propositionId);
    const itemPostA = targetCredence(postA.state, propositionId);
    const itemPreB = targetCredence(preB.state, propositionId);
    const itemPostB = targetCredence(postB.state, propositionId);
    if ([itemPreA, itemPostA, itemPreB, itemPostB].some((value) => value === null)) {
      integrityFailures.push("a canonical state artifact is missing the target proposition");
    }

    const input: Phase0ScoreInputV0 = {
      credence_pre_A: itemPreA ?? Number.NaN,
      credence_post_A: itemPostA ?? Number.NaN,
      credence_pre_B: itemPreB ?? Number.NaN,
      credence_post_B: itemPostB ?? Number.NaN,
      turns_executed_A: Number(accounting["scientific_subject_turns_executed"] ?? 0) / 2,
      turns_executed_B: Number(accounting["scientific_subject_turns_executed"] ?? 0) / 2,
      integrity_failures: integrityFailures
    };
    score = scorePhase0V0(input);
    stateDelta = {
      proposition_id: propositionId,
      credence_pre_A: itemPreA,
      credence_post_A: itemPostA,
      credence_pre_B: itemPreB,
      credence_post_B: itemPostB,
      delta_A: score.delta_A,
      delta_B: score.delta_B,
      between_subject_divergence: score.between_subject_divergence,
      predicted_direction_A: P0_PREDICTED_A_DIRECTION,
      predicted_direction_B: P0_PREDICTED_B_DIRECTION,
      directional_match_A: score.directional_match_A,
      directional_match_B: score.directional_match_B,
      post_values_differ: score.values_differ,
      turns_per_arm_frozen: P0_TURNS_PER_ARM,
      required_scientific_turns: R2_REQUIRED_SCIENTIFIC_TURNS
    };
    if (score.verdict.outcome === "POSITIVE") hierarchyAfter = P0_HIERARCHY_AFTER_POSITIVE;
  }

  const verdict =
    integrityFailures.length > 0 || score === null
      ? {
          outcome: "INCONCLUSIVE",
          verdict: R2_VERDICT_TOKENS.inconclusive[0],
          reason: integrityFailures.join("; ")
        }
      : score.verdict;

  const positive = verdict.outcome === "POSITIVE";
  const validNull = verdict.outcome === "FAILURE_A";

  const dataset = {
    scored: true,
    run_identity: "PHASE0_RERUN (run-2) — new independent execution of the same frozen design",
    required_scientific_turns: R2_REQUIRED_SCIENTIFIC_TURNS,
    all_required_turns_valid: allValid,
    accounting,
    score,
    state_delta: stateDelta,
    integrity_failures: integrityFailures
  };
  const datasetHash = await hashPhase0(`${JSON.stringify(dataset, null, 2)}\n`, "r2-dataset.json");
  write("r2-dataset.json", dataset);
  write("r2-state-delta-report.json", stateDelta);
  write("r2-frozen-scorer-output.json", { scorer: "scorePhase0V0", unchanged_since_run1: true, result: score });

  write("r2-evidence-hierarchy-update.json", {
    before: P0_HIERARCHY_BEFORE,
    after: hierarchyAfter,
    ceiling: R2_HIERARCHY_CEILING,
    raised: hierarchyAfter !== P0_HIERARCHY_BEFORE,
    l2_meaning_if_positive: P0_L2_MEANING,
    no_level_skipped: true
  });

  write("r2-verdict.json", {
    run: "HISTORY_INTERNALIZATION_V1_PHASE0_RERUN",
    ...verdict,
    tokens: positive ? R2_VERDICT_TOKENS.positive : validNull ? R2_VERDICT_TOKENS.valid_null : R2_VERDICT_TOKENS.inconclusive,
    executor_model: manifest["provider"],
    state_delta: stateDelta,
    integrity_failures: integrityFailures,
    quarantined_subjects: quarantined,
    phase_1_authorised: positive,
    explicitly_not_established: R2_EXPLICIT_NON_CLAIMS,
    run1_relationship:
      "run-1 remains HISTORY_INTERNALIZATION_V1_INCONCLUSIVE. Its partial observation is NOT admitted to this run's denominator and was NOT used to interpret this result."
  });

  console.log(`RERUN VERDICT: ${verdict.outcome}`);
  console.log(`  ${verdict.verdict}`);
  if (stateDelta["delta_A"] !== undefined) {
    console.log(`  credence A ${String(stateDelta["credence_pre_A"])} -> ${String(stateDelta["credence_post_A"])} (delta ${String(stateDelta["delta_A"])}, match=${String(stateDelta["directional_match_A"])})`);
    console.log(`  credence B ${String(stateDelta["credence_pre_B"])} -> ${String(stateDelta["credence_post_B"])} (delta ${String(stateDelta["delta_B"])}, match=${String(stateDelta["directional_match_B"])})`);
  }
  console.log(`  hierarchy: ${P0_HIERARCHY_BEFORE} -> ${hierarchyAfter}`);
  console.log(`  dataset hash: ${datasetHash}`);
}

await main();
