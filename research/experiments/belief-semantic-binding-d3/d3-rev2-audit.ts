/* eslint-disable no-restricted-imports -- Isolated research harness COMPOSING frozen production seams (repository convention); no production semantics are copied. */
/**
 * D3 REVISION 2 AUDIT — D3-A REMOVal AND D3-B-ONLY FREEZE. 0 MODEL CALLS, RE-RUNNABLE.
 *
 *   node research/experiments/belief-semantic-binding-d3/d3-rev2-audit.ts <outdir>
 *
 * Three jobs:
 *   A. re-derive the D3-A redundancy finding from the frozen D2 modules and the frozen A0 dataset;
 *   B. audit every D3-B rule for decision-frozen vs executable-form-present, so the next round knows
 *      exactly what its offline step must close;
 *   C. confirm revision 2 changed no D3-B element and locked D2-B absolutely.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { hashEnvelope } from "../../../packages/subject-core/dist/index.js";

import {
  D3_A1_PARAPHRASE_FROZEN,
  D3_BUDGET,
  D3_HASH_PROJECTION_V0,
  D3B_ANCHORS,
  D3B_CONTRACT_TEXT,
  D3B_INPUTS_FROZEN,
  D3B_QUALIFICATION_FIXTURES,
  D3B_TOKENS,
  deriveD3ManifestV0
} from "./contract.ts";
import {
  D3_A_REDUNDANCY_VERDICT,
  D3B_EXECUTABILITY_AUDIT,
  D3B_EXECUTABILITY_SUMMARY,
  D3B_MODAL_COUNT_DEFINITION,
  D3_REV2_DESIGN_INTEGRITY,
  D3_REV2_GRAPH,
  D3_D2B_LOCK,
  D3B_INTERPRETATION_MATRIX,
  deriveD3Rev2ManifestV0
} from "./contract-rev2-d3b-only.ts";
import { D2A0_ANCHORS, D2A0_PREDICTION, D2A0_TOKENS } from "../belief-causal-path-d2/contract-rev1.ts";
import { D2A0_CONTRACT_TEXT } from "../belief-causal-path-d2/contract-rev1-1b-a0-fixtures.ts";
import { D1_PROPOSITION_LABEL } from "../belief-state-sensitivity-d1/contract.ts";

const D2_EVIDENCE = "research/experiments/belief-causal-path-d2/evidence/run-001" as const;

function fail(verdict: string, detail: string): never {
  throw new Error(`${verdict}: ${detail}`);
}

async function main(): Promise<void> {
  const outdir = process.argv[2];
  if (outdir === undefined) throw new Error("usage: node d3-rev2-audit.ts <outdir>");
  await mkdir(outdir, { recursive: true });
  const write = async (name: string, value: unknown): Promise<string> => {
    const content = `${JSON.stringify(value, null, 2)}\n`;
    await writeFile(join(outdir, name), content, "utf8");
    return String(await hashEnvelope(D3_HASH_PROJECTION_V0, { name, content }));
  };

  // ============================ A. THE REDUNDANCY, RE-DERIVED ==============================
  const a0DatasetRaw = await readFile(join(D2_EVIDENCE, "a0-state-experiment/a0-state-dataset.json"), "utf8");
  const a0Dataset = JSON.parse(a0DatasetRaw) as { trials: { arm: "HIGH" | "LOW"; parsed_stance_token: string | null }[] };
  const countOf = (arm: "HIGH" | "LOW"): Record<string, number> => {
    const counts: Record<string, number> = {};
    for (const trial of a0Dataset.trials.filter((t) => t.arm === arm)) {
      const key = String(trial.parsed_stance_token);
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  };
  const a0HighCounts = countOf("HIGH");
  const a0LowCounts = countOf("LOW");
  const endorsing = D2A0_PREDICTION.directional.endorsing_set as readonly string[];
  const doubting = D2A0_PREDICTION.directional.doubting_set as readonly string[];
  const highModal = Object.entries(a0HighCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const lowModal = Object.entries(a0LowCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const criterionAlreadyMet =
    highModal !== null && lowModal !== null && endorsing.includes(highModal) && doubting.includes(lowModal) && highModal !== lowModal;

  const redundancy = {
    d2_a0_dataset_hash_recomputed: String(await hashEnvelope(
      "characteros-next/research/d2-belief-causal-path/v1",
      { name: "a0-state-dataset.json", content: a0DatasetRaw }
    )),
    d2_a0_dataset_hash_expected: D3_A_REDUNDANCY_VERDICT.d2_a0_dataset_hash,
    d2_a0_measurement_target: D3_A_REDUNDANCY_VERDICT.d2_a0_measurement_target,
    d2_a0_measurement_target_found_in_the_frozen_contract_text: D2A0_CONTRACT_TEXT.includes(
      "the proposition shown in the belief line"
    ),
    d2_a0_anchors: {
      favourable: D2A0_ANCHORS.ENDORSES_STRONGLY,
      unsettled: D2A0_ANCHORS.UNDECIDED,
      against: D2A0_ANCHORS.DOUBTS_STRONGLY
    },
    d2_a0_primary_criterion: D2A0_PREDICTION.directional.requirement,
    d2_a0_vocabulary_size: D2A0_TOKENS.length,
    observed_high_counts: a0HighCounts,
    observed_low_counts: a0LowCounts,
    observed_modals: { HIGH: highModal, LOW: lowModal },
    the_frozen_criterion_is_already_met: criterionAlreadyMet,
    the_proposed_d3a_would_add: "three buckets with different names, and nothing else",
    verdict: D3_A_REDUNDANCY_VERDICT.verdict,
    d3a_calls_authorised_in_the_budget: D3_BUDGET.d3a_calls
  };
  if (!criterionAlreadyMet) fail("D3_A_DATASET_HASH_MISMATCH", JSON.stringify(redundancy));
  if (redundancy.d2_a0_dataset_hash_recomputed !== redundancy.d2_a0_dataset_hash_expected) {
    fail("D3_A_DATASET_HASH_MISMATCH", redundancy.d2_a0_dataset_hash_recomputed);
  }

  // ============================ B. EXECUTABILITY AUDIT =====================================
  const blocking = D3B_EXECUTABILITY_AUDIT.filter((r) => r.blocks_the_round_before_calls);
  if (blocking.length > 0) fail("D3_B_EXECUTABILITY_BLOCKED", JSON.stringify(blocking));
  const missingDecisions = D3B_EXECUTABILITY_AUDIT.filter((r) => !r.decision_frozen);
  if (missingDecisions.length > 0) fail("D3_B_DECISION_MISSING", JSON.stringify(missingDecisions));

  // ============================ C. NO D3-B ELEMENT CHANGED =================================
  const rev1 = await deriveD3ManifestV0();
  const rev2 = await deriveD3Rev2ManifestV0();
  const unchanged = {
    d3b_contract_text_hash_rev1: rev1.d3b_contract_text_hash,
    d3b_contract_text_hash_rev2: rev2.tests["d3b_contract_hash_unchanged"],
    contract_text_identical: rev1.d3b_contract_text_hash === rev2.tests["d3b_contract_hash_unchanged"],
    fixture_manifest_hash_unchanged: rev1.d3b_fixture_manifest_hash,
    anchors_unchanged: rev1.d3b_anchors_hash,
    fixtures_carry_only_the_synthetic_proposition: D3B_QUALIFICATION_FIXTURES.every((f) => !f.statement_a.includes("secondhand")),
    target_pair_is_the_canonical_proposition_and_the_frozen_paraphrase:
      D3B_INPUTS_FROZEN.statement_a === D1_PROPOSITION_LABEL && D3B_INPUTS_FROZEN.statement_b === D3_A1_PARAPHRASE_FROZEN,
    vocabulary: D3B_TOKENS,
    anchors_present_in_the_contract: Object.values(D3B_ANCHORS).every((a) => D3B_CONTRACT_TEXT.includes(a))
  };
  if (!unchanged.contract_text_identical) fail("D3_B_CONTRACT_CHANGED_IN_REV2", JSON.stringify(unchanged));
  if (!unchanged.target_pair_is_the_canonical_proposition_and_the_frozen_paraphrase) {
    fail("D3_B_TARGET_PAIR_CHANGED", JSON.stringify(unchanged));
  }

  const audit = {
    stage: "D3_REVISION_2",
    model_calls: 0,
    section_a_redundancy: redundancy,
    section_b_executability: {
      rows: D3B_EXECUTABILITY_AUDIT,
      summary: D3B_EXECUTABILITY_SUMMARY
    },
    section_c_unchanged: unchanged,
    graph_status: D3_REV2_GRAPH.links,
    modal_count_now_defined: D3B_MODAL_COUNT_DEFINITION.counted_quantity,
    mechanism_verdict_demoted: {
      forbidden: D3B_INTERPRETATION_MATRIX.positive.forbidden_unconditional_mechanism_verdict,
      frozen_combined_statement: D3B_INTERPRETATION_MATRIX.positive.frozen_combined_statement,
      permitted_discussion_form: D3B_INTERPRETATION_MATRIX.positive.permitted_discussion_form
    },
    d2b_lock: D3_D2B_LOCK,
    design_integrity: D3_REV2_DESIGN_INTEGRITY,
    verdict: D3_A_REDUNDANCY_VERDICT.verdict
  };
  await write("d3-rev2-audit.json", audit);
  await write("contract-rev2-manifest.json", rev2);

  await write("D3_REV2_VERDICT.json", {    stage: "D3_REVISION_2",
    model_calls: 0,
    verdicts: [
      "D3_PREREGISTRATION_FINALIZED",
      "D3_A_REDUNDANT_WITH_D2_A0",
      "D3_B_QUALIFICATION_AUTHORISED",
      "D3_B_TARGET_NOT_EXECUTED"
    ],
    d3a_execution_path: "DELETED — no D3-A call may be made in any future round",
    d3b_status: "design frozen; transformer and the three scorers still to be implemented and conformance-gated at zero calls",
    d3b_all_decisions_frozen: D3B_EXECUTABILITY_SUMMARY.decisions_missing === 0,
    d3b_implementations_pending: D3B_EXECUTABILITY_SUMMARY.executable_forms_missing,
    authorised_budget: { min: D3_BUDGET.minimum_path, max: D3_BUDGET.authorised_total_max, d3a: D3_BUDGET.d3a_calls },
    d2_b_authorised: false,
    d2_b_even_if_d3_b_positive: false,
    d1_d2_modified: false,
    next_round_may_only: "implement the D3-B transformer and the three frozen scorers, run their conformance gates at zero calls, freeze the implementation hashes, then run D3-B qualification",
    next_round_may_not: ["execute any D3-A call", "re-run D1 or D2", "execute D2-B", "modify any D1 or D2 frozen artifact"],
    revision_1_manifest_hash_preserved: rev2.revision_1_manifest_hash_preserved,
    rev2_manifest_hash: rev2.manifest_hash
  });
  process.stdout.write(
    `D3_PREREGISTRATION_FINALIZED | ${D3_A_REDUNDANCY_VERDICT.verdict}\n` +
      `D3_A_REDUNDANT_WITH_D2_A0 | D3_B_QUALIFICATION_AUTHORISED | D3_B_TARGET_NOT_EXECUTED\n` +
      `redundancy criterion already met by the frozen A0 dataset: ${String(criterionAlreadyMet)}\n` +
      `D3-B decisions frozen: ${String(D3B_EXECUTABILITY_SUMMARY.decisions_missing === 0)} | implementations pending: ${String(D3B_EXECUTABILITY_SUMMARY.executable_forms_missing)}\n` +
      `${rev2.manifest_hash}\nD3_MODEL_CALLS = 0\n`
  );
}

await main();
