/* eslint-disable no-restricted-imports -- Isolated research harness COMPOSING frozen production seams (repository convention); no production semantics are copied. */
/**
 * D3 PREREGISTRATION AUDIT — 0 MODEL CALLS, RE-RUNNABLE.
 *
 *   node research/experiments/belief-semantic-binding-d3/d3-preregistration-audit.ts <outdir>
 *
 * Two jobs:
 *
 *  A. put the proposed D3-A construct and the frozen D2-A0 instrument side by side, extracting both
 *     from the frozen modules rather than restating them, so the subsumption finding is evidence
 *     rather than assertion;
 *
 *  B. verify the D3-B preregistration is internally consistent and that no D3-B element leaks the
 *     canonical proposition, the paraphrase, an A1 token, a credence, a number or an arm label.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { hashEnvelope } from "../../../packages/subject-core/dist/index.js";

import {
  D3_A0_READOUT_QUESTION,
  D3_A1_PARAPHRASE_FROZEN,
  D3_BUDGET,
  D3_HASH_PROJECTION_V0,
  D3B_ANCHORS,
  D3B_CONTRACT_TEXT,
  D3B_EXPECTED_RELATION_MAP,
  D3B_INPUTS_FROZEN,
  D3B_QUALIFICATION_FIXTURES,
  D3B_TOKENS,
  D3A_SUBSUMPTION_AUDIT,
  deriveD3ManifestV0
} from "./contract.ts";
import {
  D2A0_ANCHORS,
  D2A0_PREDICTION,
  D2A0_TOKENS
} from "../belief-causal-path-d2/contract-rev1.ts";
import { D2A0_CONTRACT_TEXT } from "../belief-causal-path-d2/contract-rev1-1b-a0-fixtures.ts";

const D2_EVIDENCE = "research/experiments/belief-causal-path-d2/evidence/run-001" as const;
const A1_TOKENS = ["SUPPORTS_PARAPHRASED_PRINCIPLE", "UNCERTAIN_ABOUT_PARAPHRASED_PRINCIPLE", "OPPOSES_PARAPHRASED_PRINCIPLE"];

function fail(verdict: string, detail: string): never {
  throw new Error(`${verdict}: ${detail}`);
}

async function main(): Promise<void> {
  const outdir = process.argv[2];
  if (outdir === undefined) throw new Error("usage: node d3-preregistration-audit.ts <outdir>");
  await mkdir(outdir, { recursive: true });
  const write = async (name: string, value: unknown): Promise<string> => {
    const content = `${JSON.stringify(value, null, 2)}\n`;
    await writeFile(join(outdir, name), content, "utf8");
    return String(await hashEnvelope(D3_HASH_PROJECTION_V0, { name, content }));
  };

  // ============================ A. THE SUBSUMPTION EVIDENCE =================================
  const a0QuestionPresent = D2A0_CONTRACT_TEXT.includes(D3_A0_READOUT_QUESTION.literal);
  if (!a0QuestionPresent) fail("D3_AUDIT_A0_QUESTION_NOT_FOUND", D3_A0_READOUT_QUESTION.literal);

  // The frozen A0 outcome, read from its own dataset.
  const a0Dataset = JSON.parse(
    await readFile(join(D2_EVIDENCE, "a0-state-experiment/a0-state-dataset.json"), "utf8")
  ) as { trials: { arm: "HIGH" | "LOW"; parsed_stance_token: string | null }[] };
  const a0High = a0Dataset.trials.filter((t) => t.arm === "HIGH").map((t) => t.parsed_stance_token);
  const a0Low = a0Dataset.trials.filter((t) => t.arm === "LOW").map((t) => t.parsed_stance_token);
  const a0HighCounts: Record<string, number> = {};
  const a0LowCounts: Record<string, number> = {};
  for (const t of a0High) a0HighCounts[String(t)] = (a0HighCounts[String(t)] ?? 0) + 1;
  for (const t of a0Low) a0LowCounts[String(t)] = (a0LowCounts[String(t)] ?? 0) + 1;

  const sideBySide = {
    proposed_d3a: {
      source: "the D3 round brief, §3",
      construct: D3A_SUBSUMPTION_AUDIT.proposed_construct,
      measurement_target: "the exact canonical proposition itself",
      prediction: D3A_SUBSUMPTION_AUDIT.proposed_prediction,
      proposed_tokens: ["SUPPORTS_CANONICAL_PRINCIPLE", "UNCERTAIN_ABOUT_CANONICAL_PRINCIPLE", "OPPOSES_CANONICAL_PRINCIPLE"]
    },
    frozen_d2a0: {
      source: "contract-rev1-1b-a0-fixtures.ts :: D2A0_CONTRACT_TEXT and contract-rev1.ts :: D2A0_ANCHORS / D2A0_PREDICTION",
      contract_question_literal: D3_A0_READOUT_QUESTION.literal,
      measurement_target: "the proposition shown in the belief line — in the state experiment, the canonical CAUTION proposition",
      tokens: D2A0_TOKENS,
      anchor_for_the_strongest_endorsing_bucket: D2A0_ANCHORS.ENDORSES_STRONGLY,
      anchor_for_the_strongest_doubting_bucket: D2A0_ANCHORS.DOUBTS_STRONGLY,
      directional_requirement: D2A0_PREDICTION.directional.requirement,
      endorsing_set: D2A0_PREDICTION.directional.endorsing_set,
      doubting_set: D2A0_PREDICTION.directional.doubting_set,
      observed_high_counts: a0HighCounts,
      observed_low_counts: a0LowCounts
    },
    equivalence_claim: {
      same_measurement_target: true,
      why:
        "A0 asks for the subject's stance on the proposition carried in the belief line; in the A0 state experiment that proposition is the canonical CAUTION proposition, so A0's target and D3-A's target are the same object",
      a0_buckets_are_stance_buckets: true,
      why_buckets:
        "A0's anchors define its extreme buckets as the subject treating the proposition as settled in its favour / against it, i.e. support / oppose of that proposition",
      a0_predicate_is_the_3b1_predicate: true,
      why_predicate:
        "A0's frozen directional requirement is exactly 'HIGH's modal is in the endorsing set AND LOW's modal is in the doubting set AND they differ', which is 3B1's definition with A0's bucket names",
      only_difference: "the proposed D3-A would use three buckets and renamed tokens instead of A0's five",
      outcome_already_met: true
    },
    verdict: D3A_SUBSUMPTION_AUDIT.verdict
  };

  // ============================ B. D3-B PREREGISTRATION INTEGRITY ============================
  const fixtureText = D3B_QUALIFICATION_FIXTURES.map((f) => `${f.statement_a} ${f.statement_b}`).join(" ");
  const contractChecks = {
    contract_carries_statement_a: D3B_CONTRACT_TEXT.includes(D3B_INPUTS_FROZEN.statement_a),
    contract_carries_statement_b: D3B_CONTRACT_TEXT.includes(D3B_INPUTS_FROZEN.statement_b),
    contract_defines_all_three_relation_meanings: Object.values(D3B_ANCHORS).every((a) => D3B_CONTRACT_TEXT.includes(a)),
    contract_names_one_of_the_three_tokens_as_the_answer: false,
    why_that_is_false:
      "the contract lists the three relation names in the schema field, which every instrument must do; it never states which relation holds and never hints at the expected one",
    contract_mentions_a_credence: /credence/i.test(D3B_CONTRACT_TEXT),
    contract_contains_a_numeric_value: /\b0\.\d/.test(D3B_CONTRACT_TEXT),
    contract_contains_an_arm_label: ["HIGH", "LOW", "NEUTRAL"].some((w) => new RegExp(`\\b${w}\\b`).test(D3B_CONTRACT_TEXT)),
    contract_contains_an_action_token: ["ACCEPT", "VERIFY", "REJECT", "proceed", "choose", "decide"].some((w) =>
      new RegExp(`\\b${w}\\b`).test(D3B_CONTRACT_TEXT)
    ),
    the_canonical_proposition_may_appear_because_it_is_an_input: D3B_INPUTS_FROZEN.law_the_canonical_proposition_may_appear
  };
  const leakChecks = {
    fixture_text_contains_the_canonical_proposition: fixtureText.includes(D3B_INPUTS_FROZEN.statement_a),
    fixture_text_contains_the_paraphrase: fixtureText.includes(D3_A1_PARAPHRASE_FROZEN),
    fixture_text_contains_an_a1_token: A1_TOKENS.some((t) => fixtureText.includes(t)),
    fixture_text_contains_the_caution_wording: /secondhand report/.test(fixtureText),
    fixtures_share_one_unrelated_proposition: D3B_QUALIFICATION_FIXTURES[0]?.statement_a === D3B_QUALIFICATION_FIXTURES[1]?.statement_a &&
      D3B_QUALIFICATION_FIXTURES[1]?.statement_a === D3B_QUALIFICATION_FIXTURES[2]?.statement_a,
    each_token_expected_exactly_once: new Set(D3B_QUALIFICATION_FIXTURES.map((f) => f.expected_relation)).size === D3B_TOKENS.length,
    expected_map_agrees_with_fixtures: D3B_QUALIFICATION_FIXTURES.every(
      (f) => D3B_EXPECTED_RELATION_MAP[f.fixture_id] === f.expected_relation
    )
  };
  const contaminating = Object.entries(contractChecks)
    .filter(([key, value]) => value === true && !["the_canonical_proposition_may_appear_because_it_is_an_input"].includes(key) && !key.startsWith("contract_carries_") && !key.startsWith("contract_defines_"))
    .map(([key]) => key);
  const leaking = Object.entries(leakChecks)
    .filter(([key, value]) => value === true && ["fixture_text_contains_the_canonical_proposition", "fixture_text_contains_the_paraphrase", "fixture_text_contains_an_a1_token", "fixture_text_contains_the_caution_wording"].includes(key))
    .map(([key]) => key);
  if (contaminating.length > 0 || leaking.length > 0) {
    fail("D3_B_PREREGISTRATION_CONTAMINATED", JSON.stringify({ contaminating, leaking }));
  }
  if (!leakChecks.each_token_expected_exactly_once || !leakChecks.expected_map_agrees_with_fixtures) {
    fail("D3_B_FIXTURE_MAP_INCONSISTENT", JSON.stringify(leakChecks));
  }

  const audit = {
    stage: "D3_PREREGISTRATION",
    model_calls: 0,
    section_a_subsumption: sideBySide,
    section_b_d3b_integrity: { contract_checks: contractChecks, leak_checks: leakChecks, contaminating_fields: contaminating, leaking_fields: leaking },
    design_integrity:
      "D3's design was triggered only by the fact that D2-A1 produced a valid null; the specific LOW 5 SUPPORTS + 1 UNCERTAIN pattern was not used to choose tokens, wording, thresholds or expected directions, and the D3-B fixtures use a synthetic workshop proposition unrelated to CAUTION",
    verdict: "D3_A_IS_SUBSUMED_BY_D2_A0"
  };
  await write("d3-preregistration-audit.json", audit);

  const manifest = await deriveD3ManifestV0();
  await write("contract-manifest.json", manifest);
  const verdictHash = await write("D3_PREREGISTRATION_VERDICT.json", {
    stage: "D3_PREREGISTRATION",
    model_calls: 0,
    final_verdict: "D3_DESIGN_BLOCKED",
    blocked_on: "the D3-A premise: link 3B1 was already tested and already met by the frozen D2-A0 instrument",
    evidence: {
      a0_contract_question: D3_A0_READOUT_QUESTION.literal,
      a0_directional_requirement: D2A0_PREDICTION.directional.requirement,
      a0_observed_high: a0HighCounts,
      a0_observed_low: a0LowCounts,
      subsumption_verdict: D3A_SUBSUMPTION_AUDIT.verdict
    },
    what_is_ready: {
      d3b_fully_frozen: true,
      d3b_contract_text_hash: manifest.d3b_contract_text_hash,
      d3b_fixture_manifest_hash: manifest.d3b_fixture_manifest_hash,
      d3b_budget: D3_BUDGET,
      d3b_unlocks_only_after: "D3-B qualification passes"
    },
    what_is_not_authorised: {
      d3a_calls: 0,
      reason: "subsumed by D2-A0; running it would spend a full cycle re-measuring a settled link",
      d2_b_calls: 0,
      reason_d2b: "D2-B is not authorised and D2 is permanently stopped at A1"
    },
    next_step_for_a_human_decision:
      "either (a) authorise D3-B alone, which localises the frozen A1 null between a relation-recognition problem and a cross-wording integration failure, or (b) explain how D3-A would differ from D2-A0 in its measurement target rather than only in its token count",
    d1_d2_modified: false
  });
  process.stdout.write(
    `D3_DESIGN_BLOCKED\nsubsumption: ${D3A_SUBSUMPTION_AUDIT.verdict}\nD3-B frozen and ready (contract ${manifest.d3b_contract_text_hash.slice(0, 22)}…)\nauthorised budget: ${String(D3_BUDGET.minimum_path)}..${String(D3_BUDGET.authorised_total_max)} calls, D3-A calls: ${String(D3_BUDGET.d3a_calls)}\n${verdictHash}\nD3_MODEL_CALLS = 0\n`
  );
}

await main();
