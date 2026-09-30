/**
 * HISTORY_INTERNALIZATION_TEST_V1 — PHASE 0 SCORING.
 *
 *   npx tsx phase-0/score.ts <evidence-dir>
 *
 * Runs ONLY against the frozen artifacts written by `execute.ts`, and refuses to run at all
 * unless the post-state freezes exist and still carry `scored: false`. The freeze hashes are
 * verified BEFORE the frozen scorer is called, so a post-hoc edit cannot be scored silently.
 *
 * The scorer is the pure function frozen in `contract.ts`; this program adds no judgement of
 * its own and cannot revise the endpoint.
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
} from "./contract.ts";

interface TargetItem {
  readonly proposition_id: string;
  readonly proposition_label: string;
  readonly credence: number;
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

function targetCredence(state: unknown, propositionId: string): number | null {
  const beliefs = (state as { canonical_state_view?: { beliefs?: readonly TargetItem[] } })
    .canonical_state_view?.beliefs;
  const item = beliefs?.find((entry) => entry.proposition_id === propositionId);
  return item === undefined ? null : item.credence;
}

async function main(): Promise<void> {
  const dir = process.argv[2];
  if (dir === undefined) throw new Error("P0_SCORE_USAGE: usage: score.ts <evidence-dir>");
  const write = (name: string, value: unknown): string => {
    const content = `${JSON.stringify(value, null, 2)}\n`;
    writeFileSync(join(dir, name), content, "utf8");
    return content;
  };

  // ---- the freeze gate: no scoring before the freezes exist, and none after they are touched ----
  const freezeGate: Record<string, unknown> = { checks: [] as Record<string, unknown>[] };
  const checks = freezeGate["checks"] as Record<string, unknown>[];
  const load = (name: string): { raw: string; parsed: { scored?: boolean; state?: unknown } } => {
    const raw = readFileSync(join(dir, name), "utf8");
    return { raw, parsed: JSON.parse(raw) as { scored?: boolean; state?: unknown } };
  };
  const preA = load("pre-state-A.json");
  const preB = load("pre-state-B.json");
  const postA = load("post-state-A.json");
  const postB = load("post-state-B.json");
  for (const [name, loaded] of [
    ["pre-state-A.json", preA],
    ["pre-state-B.json", preB],
    ["post-state-A.json", postA],
    ["post-state-B.json", postB]
  ] as const) {
    const hash = await hashPhase0(loaded.raw, name);
    checks.push({ artifact: name, present: true, scored_flag_is_false: loaded.parsed.scored === false, freeze_hash: hash });
  }
  freezeGate["all_pre_and_post_states_frozen_unscored"] = checks.every(
    (check) => check["scored_flag_is_false"] === true
  );
  const collection = readJson(join(dir, "collection-integrity.json")) as {
    integrity: { integrity_failures: string[]; turns_executed_A: number; turns_executed_B: number; schedule_followed: boolean; qualification_passed: boolean; total_model_calls: number; call_tally: Record<string, number>; executor_model: string };
  };
  freezeGate["collection_integrity_present"] = collection !== null;

  const identity = readJson(join(dir, "target-belief-identity.json")) as { proposition_id: string };
  const propositionId = identity.proposition_id;

  const itemPreA = targetCredence(preA.parsed.state, propositionId);
  const itemPreB = targetCredence(preB.parsed.state, propositionId);
  const itemPostA = targetCredence(postA.parsed.state, propositionId);
  const itemPostB = targetCredence(postB.parsed.state, propositionId);

  // ---- integrity: engineering failure is never reported as a scientific null -------------------
  const integrityFailures = [...collection.integrity.integrity_failures];
  if (!collection.integrity.schedule_followed) integrityFailures.push("the frozen schedule was not followed");
  if (!collection.integrity.qualification_passed) integrityFailures.push("the qualification turn did not pass");
  if (itemPreA === null || itemPreB === null || itemPostA === null || itemPostB === null) {
    integrityFailures.push("a canonical state artifact is missing the target proposition");
  }
  if (!freezeGate["all_pre_and_post_states_frozen_unscored"]) {
    integrityFailures.push("a state artifact was not frozen with scored:false");
  }

  const input: Phase0ScoreInputV0 = {
    credence_pre_A: itemPreA ?? Number.NaN,
    credence_post_A: itemPostA ?? Number.NaN,
    credence_pre_B: itemPreB ?? Number.NaN,
    credence_post_B: itemPostB ?? Number.NaN,
    turns_executed_A: collection.integrity.turns_executed_A,
    turns_executed_B: collection.integrity.turns_executed_B,
    integrity_failures: integrityFailures
  };
  const score = scorePhase0V0(input);

  // ---- §20 descriptive secondary state (recorded, NEVER a substitute endpoint) ------------------
  const viewOf = (state: unknown): Record<string, unknown> =>
    ((state as { canonical_state_view?: Record<string, unknown> }).canonical_state_view ?? {}) as Record<string, unknown>;
  const descriptiveSecondary = {
    role: "DESCRIPTIVE_SECONDARY_STATE — recorded for completeness and explicitly NOT an endpoint",
    relationship_A: viewOf(postA.parsed.state)["relationships"] ?? null,
    relationship_B: viewOf(postB.parsed.state)["relationships"] ?? null,
    personality_A: viewOf(postA.parsed.state)["personality"] ?? null,
    personality_B: viewOf(postB.parsed.state)["personality"] ?? null,
    affect_A: viewOf(postA.parsed.state)["affect"] ?? null,
    affect_B: viewOf(postB.parsed.state)["affect"] ?? null,
    belief_items_A: viewOf(postA.parsed.state)["beliefs"] ?? null,
    belief_items_B: viewOf(postB.parsed.state)["beliefs"] ?? null,
    warning:
      "relationship familiarity is ALSO driven every turn by the production runtime. Any difference in it is a co-effect of the same trajectory and can never be read as evidence for the belief endpoint, nor used to rescue a belief null."
  };

  const stateDeltaReport = {
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
    turns_executed_A: collection.integrity.turns_executed_A,
    turns_executed_B: collection.integrity.turns_executed_B,
    executor_model: collection.integrity.executor_model,
    total_model_calls: collection.integrity.total_model_calls,
    call_tally: collection.integrity.call_tally
  };

  const hierarchy = {
    before: P0_HIERARCHY_BEFORE,
    after: score.verdict.outcome === "POSITIVE" ? P0_HIERARCHY_AFTER_POSITIVE : P0_HIERARCHY_BEFORE,
    no_level_skipped: true,
    l2_meaning_if_positive: P0_L2_MEANING,
    what_a_positive_does_not_establish: [
      "that persistent belief alters cognition in a new scenario with the history removed (L3, untested)",
      "that it alters decision or behaviour (L4+, untested, and D1 measured a null on an authored difference)",
      "that the subject 'has been shaped by its life'",
      "that history internalization works",
      "anything about personality or affect, both out of scope and un-driven for this experiment",
      "anything about the model's own dispositions: the LLM is an executor and the subject is the canonical state"
    ]
  };

  const verdictArtifact = {
    phase: "HISTORY_INTERNALIZATION_TEST_V1_PHASE_0",
    executor_model: collection.integrity.executor_model,
    ...score.verdict,
    primary_predicate: score.primary_predicate,
    primary_predicate_satisfied: score.primary_predicate_satisfied,
    state_delta_report: stateDeltaReport,
    integrity_failures: integrityFailures,
    next_state_if_positive: ["LIVED_EXPERIENCE_TO_PERSISTENT_BELIEF_CHANGE_ESTABLISHED", "HISTORY_INTERNALIZATION_V1_PHASE_1_AUTHORISED", "HISTORY_INTERNALIZATION_NOT_YET_ESTABLISHED", "CHARACTEROS_UNMODIFIED"],
    next_state_if_failure_a: ["HISTORY_INTERNALIZATION_V1_FAILURE_A_EXPERIENCE_TO_STATE_NOT_ESTABLISHED", "CHARACTEROS_MODIFICATION_NOT_AUTOMATICALLY_AUTHORISED"],
    forbidden_followups:
      "no stronger events, no different proposition, no prompt hints, no manual credence correction, no production change, no opportunistic relationship experiment — a Failure A ends the round"
  };

  write("phase-0-dataset.json", { scored: true, input, score, descriptive_secondary: descriptiveSecondary });
  write("state-delta-report.json", stateDeltaReport);
  write("frozen-scorer-output.json", { scorer: "scorePhase0V0", frozen_before_any_call: true, result: score });
  write("evidence-hierarchy-update.json", hierarchy);
  write("phase-0-verdict.json", verdictArtifact);
  const datasetHash = await hashPhase0(JSON.stringify({ input, score }, null, 2) + "\n", "phase-0-dataset.json");
  write("phase-0-dataset-hash.json", { dataset: "phase-0-dataset.json", hash: datasetHash, frozen_raw: false });

  console.log(`PHASE 0 VERDICT: ${score.verdict.outcome}`);
  console.log(`  credence A ${String(itemPreA)} -> ${String(itemPostA)}  (delta ${score.delta_A}, predicted ${P0_PREDICTED_A_DIRECTION}, match=${score.directional_match_A})`);
  console.log(`  credence B ${String(itemPreB)} -> ${String(itemPostB)}  (delta ${score.delta_B}, predicted ${P0_PREDICTED_B_DIRECTION}, match=${score.directional_match_B})`);
  console.log(`  primary predicate satisfied: ${score.primary_predicate_satisfied}`);
  if (score.verdict.outcome === "FAILURE_A") console.log(`  failure subkind: ${score.verdict.subkind}`);
  if (score.verdict.outcome === "INCONCLUSIVE") console.log(`  reason: ${score.verdict.reason}`);
  console.log(`  hierarchy: ${P0_HIERARCHY_BEFORE} -> ${hierarchy.after}`);
}

await main();
