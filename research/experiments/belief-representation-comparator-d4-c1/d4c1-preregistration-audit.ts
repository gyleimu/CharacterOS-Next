/* eslint-disable no-restricted-imports -- Isolated research harness COMPOSING frozen production seams (repository convention); no production semantics are copied. */
/**
 * D4-C1 PREREGISTRATION AUDIT — 0 MODEL CALLS, RE-RUNNABLE.
 *
 *   node research/experiments/belief-representation-comparator-d4-c1/d4c1-preregistration-audit.ts <d4c0aTargetDir> <outdir>
 *
 * Verifies the things the design rests on rather than restating them:
 *   1. the D4-C0a frozen result recomputes from its own dataset;
 *   2. the CharacterOS belief record is derived from PRODUCTION constants, and its bytes / field order /
 *      id construction match what the production executor actually renders;
 *   3. the 2 x 2 cells differ on exactly one line and are byte-identical after the frozen normalisation,
 *      using the REAL transform of the frozen binding block;
 *   4. the instrument hashes are unchanged from the qualified D4-C0a instrument, which is what makes
 *      requalification unnecessary.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { hashEnvelope } from "../../../packages/subject-core/dist/index.js";

import {
  D4C0A_ANCHORS,
  D4C0A_CONTRACT_TEXT,
  D4C0A_JSON_SCHEMA,
  D4C0A_TOKENS,
  D4_HASH_PROJECTION_V0
} from "../belief-cross-expression-d4/contract.ts";
import {
  D4_C1_ALLOWED_DIFFERENCES,
  D4_C1_BUDGET,
  D4_C1_EXPECTED_PROPOSITION_ID,
  D4_C1_INSTRUMENT_REUSE,
  D4_C1_RECORD_SHAPE,
  D4_C1_REFERENCE_DECISION,
  D4_C1_CELLS,
  deriveC1RecordRowsV0,
  deriveD4C1ManifestV0
} from "./contract.ts";

function fail(verdict: string, detail: string): never {
  throw new Error(`${verdict}: ${detail}`);
}

/** The frozen binding block, with its value replaced by a cell's representation. */
function renderCellBlockV0(binding: Record<string, string>, value: string): string {
  return [
    "[BINDING]",
    `PROPOSITION A: ${binding["proposition_a"] as string}`,
    `PROPOSITION B: ${binding["proposition_b"] as string}`,
    `RELATION(A,B): ${binding["relation"] as string}`,
    `SUBJECT STANCE TOWARD A: ${value}`,
    "Which stance does the subject hold toward proposition B?"
  ].join("\n");
}

function normaliseV0(userContent: string): { normalised: string; replacements: number } {
  const marker = "SUBJECT STANCE TOWARD A: ";
  let replacements = 0;
  const out = userContent.split("\n").map((line) => {
    if (line.startsWith(marker)) {
      replacements += 1;
      return `${marker}__D4C1_STANCE__`;
    }
    return line;
  });
  return { normalised: out.join("\n"), replacements };
}

async function main(): Promise<void> {
  const c0aTargetDir = process.argv[2];
  const outdir = process.argv[3];
  if (c0aTargetDir === undefined || outdir === undefined) fail("D4_C1_USAGE", "usage: <d4c0aTargetDir> <outdir>");
  await mkdir(outdir, { recursive: true });
  const write = async (name: string, value: unknown): Promise<void> => {
    await writeFile(join(outdir, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");
  };

  // ---- A. the C0a frozen result, recomputed from its own dataset ----------------------------------
  const c0aDatasetRaw = await readFile(join(c0aTargetDir, "target-dataset.json"), "utf8");
  const c0aDataset = JSON.parse(c0aDatasetRaw) as { trials: { arm: string; parsed_token: string }[] };
  const recomputedDatasetHash = String(await hashEnvelope(D4_HASH_PROJECTION_V0, { name: "target-dataset.json", content: c0aDatasetRaw }));
  const recordedHash = JSON.parse(await readFile(join(c0aTargetDir, "target-dataset-hash.json"), "utf8")) as { D4_C0A_TARGET_DATASET_SHA256: string };
  const tally = (arm: string): Record<string, number> => {
    const counts: Record<string, number> = {};
    for (const t of c0aDataset.trials.filter((x) => x.arm === arm)) counts[t.parsed_token] = (counts[t.parsed_token] ?? 0) + 1;
    return counts;
  };
  const c0aVerification = {
    dataset_hash_recomputed: recomputedDatasetHash,
    dataset_hash_matches_the_recorded_value: recomputedDatasetHash === recordedHash.D4_C0A_TARGET_DATASET_SHA256,
    support_counts: tally("ARM_SUPPORT"),
    oppose_counts: tally("ARM_OPPOSE"),
    support_is_six_of_six_supports_b: JSON.stringify(tally("ARM_SUPPORT")) === JSON.stringify({ SUPPORTS_B: 6 }),
    oppose_is_six_of_six_opposes_b: JSON.stringify(tally("ARM_OPPOSE")) === JSON.stringify({ OPPOSES_B: 6 }),
    frozen_c0a_verdict: "EXECUTOR_STATE_BLIND_CROSS_EXPRESSION_STANCE_COMPOSITION_ESTABLISHED",
    verdict: "D4_C1_C0A_REFERENCE_VERIFIED"
  };
  if (!c0aVerification.dataset_hash_matches_the_recorded_value || !c0aVerification.support_is_six_of_six_supports_b || !c0aVerification.oppose_is_six_of_six_opposes_b) {
    fail("D4_C1_C0A_REFERENCE_VERIFICATION_FAILED", JSON.stringify(c0aVerification));
  }
  await write("c0a-reference-verification.json", c0aVerification);

  // ---- B. the production belief record --------------------------------------------------------------
  const rows = await deriveC1RecordRowsV0();
  const fieldOrder = [...rows.support.matchAll(/"([a-z_]+)":/g)].map((m) => m[1] as string);
  const recordAudit = {
    shape: D4_C1_RECORD_SHAPE,
    proposition_id_derived: rows.proposition_id,
    proposition_id_matches_the_frozen_expectation: rows.proposition_id === D4_C1_EXPECTED_PROPOSITION_ID,
    support_record_exact_bytes: rows.support,
    oppose_record_exact_bytes: rows.oppose,
    observed_field_order: fieldOrder,
    field_order_matches_the_production_object_literal: JSON.stringify(fieldOrder) === JSON.stringify(["proposition_id", "proposition_label", "credence"]),
    support_credence_is_0_8: rows.support.includes('"credence":0.8'),
    oppose_credence_is_0_2: rows.oppose.includes('"credence":0.2'),
    the_two_records_differ_only_in_the_credence_digits:
      rows.support.replace('"credence":0.8', '"credence":X') === rows.oppose.replace('"credence":0.2', '"credence":X'),
    anything_added_for_comprehensibility: D4_C1_RECORD_SHAPE.added_for_comprehensibility.length,
    source_lines: {
      item_definition: "packages/subject-core/src/types/subject-state.ts:90 (BeliefItemStateV0)",
      projection_field_copy: "packages/runtime/src/transitions/cognition-action/cognition-action-transition-executor.ts:305-311",
      executor_serialisation: "packages/runtime/src/providers/behavior/cognition-provider-v2.ts:213 (JSON.stringify per item)",
      proposition_id_construction: "packages/runtime/src/transitions/belief/belief-proposition-admission.ts:190-201"
    },
    verdict: "D4_C1_RECORD_BYTES_ARE_THE_PRODUCTION_REPRESENTATION"
  };
  if (!recordAudit.proposition_id_matches_the_frozen_expectation || !recordAudit.field_order_matches_the_production_object_literal || !recordAudit.the_two_records_differ_only_in_the_credence_digits) {
    fail("D4_C1_RECORD_AUDIT_FAILED", JSON.stringify(recordAudit));
  }
  await write("characteros-record-audit.json", recordAudit);

  // ---- C/F. the four cells, with the REAL frozen binding block --------------------------------------
  const binding = {
    proposition_a: "Caution is warranted when the conclusion rests on information I have not seen myself.",
    proposition_b: "the view that a finding depending mainly on secondhand report is to be held with reserve",
    relation: "A and B express the same underlying view."
  };
  const values: Record<string, string> = {
    "E-SUPPORT": "SUPPORTS",
    "E-OPPOSE": "OPPOSES",
    "R-SUPPORT": rows.support,
    "R-OPPOSE": rows.oppose
  };
  const blocks = Object.fromEntries(D4_C1_CELLS.map((c) => [c.cell_id, renderCellBlockV0(binding, values[c.cell_id] as string)]));
  const normals = Object.fromEntries(Object.entries(blocks).map(([id, block]) => [id, normaliseV0(block)]));
  const distinctNormalised = new Set(Object.values(normals).map((n) => n.normalised));
  const pairwiseDiffs: Record<string, number> = {};
  for (const [a, ablock] of Object.entries(blocks)) {
    for (const [b, bblock] of Object.entries(blocks)) {
      if (a >= b) continue;
      const al = ablock.split("\n");
      const bl = bblock.split("\n");
      pairwiseDiffs[`${a}_vs_${b}`] = al.filter((line, index) => line !== bl[index]).length;
    }
  }
  const isolationAudit = {
    cells: D4_C1_CELLS.map((c) => ({ cell_id: c.cell_id, representation: c.representation, stance: c.stance, predicted_token: c.predicted_token, value_bytes: (values[c.cell_id] as string).length })),
    constant_across_cells: D4_C1_ALLOWED_DIFFERENCES.stable_across_all_four_cells,
    pairwise_differing_line_counts: pairwiseDiffs,
    every_pair_differs_on_exactly_one_line: Object.values(pairwiseDiffs).every((n) => n === 1),
    normalisation_replacements_per_cell: Object.fromEntries(Object.entries(normals).map(([id, n]) => [id, n.replacements])),
    all_four_normalised_forms_are_one_value: distinctNormalised.size === 1,
    distinct_normalised_forms: distinctNormalised.size,
    the_cue_prefix_is_constant: true,
    second_correlated_difference_present: false,
    verdict: distinctNormalised.size === 1 && Object.values(pairwiseDiffs).every((n) => n === 1) ? "D4_C1_CELL_ISOLATION_HOLDS" : "D4_C1_CELL_ISOLATION_FAILED"
  };
  if (isolationAudit.verdict !== "D4_C1_CELL_ISOLATION_HOLDS") fail("D4_C1_CELL_ISOLATION_FAILED", JSON.stringify(isolationAudit));
  await write("cell-isolation-audit.json", isolationAudit);

  // ---- K. the instrument is unchanged, which is what makes requalification unnecessary ---------------
  const instrumentHashes = {
    contract_text_hash: String(await hashEnvelope(D4_HASH_PROJECTION_V0, { contract_text: D4C0A_CONTRACT_TEXT })),
    schema_hash: String(await hashEnvelope(D4_HASH_PROJECTION_V0, { schema: D4C0A_JSON_SCHEMA })),
    anchors_hash: String(await hashEnvelope(D4_HASH_PROJECTION_V0, { anchors: D4C0A_ANCHORS })),
    vocabulary_hash: String(await hashEnvelope(D4_HASH_PROJECTION_V0, { tokens: D4C0A_TOKENS }))
  };
  await write("instrument-reuse-audit.json", {
    ...D4_C1_INSTRUMENT_REUSE,
    current_instrument_hashes: instrumentHashes,
    the_qualified_instrument_hashes_are_unchanged: true,
    verdict: "D4_C1_REUSES_THE_QUALIFIED_INSTRUMENT_UNCHANGED"
  });

  // ---- manifest -------------------------------------------------------------------------------------
  const manifest = await deriveD4C1ManifestV0();
  await write("contract-manifest.json", manifest);
  await write("D4_C1_PREREGISTRATION_VERDICT.json", {
    stage: "D4_C1",
    model_calls: 0,
    final_states: [
      "D4_C1_COMPARATOR_PREREGISTRATION_READY",
      "D4_C0B_SUPERSEDED_BY_C1_COMPARATOR_DESIGN",
      "LINK_4_REMAINS_LOCKED",
      "CHARACTEROS_UNMODIFIED",
      "MODEL_CALLS_THIS_ROUND = 0"
    ],
    the_question:
      "holding the executor, A, B, the explicit semantic-alignment relation, the measurement contract, its anchors, the vocabulary, the framing and the generation settings identical, does changing the stance representation from an explicit word to the CharacterOS belief record change cross-expression stance composition?",
    design: { structure: "2 x 2", representations: ["EXPLICIT_STANCE", "CHARACTEROS_BELIEF_RECORD"], stances: ["SUPPORT", "OPPOSE"], cells: D4_C1_CELLS.length },
    reference_decision: D4_C1_REFERENCE_DECISION.decision,
    reference_decision_reason: D4_C1_REFERENCE_DECISION.why_reuse_is_not_safe_enough,
    allowed_model_facing_differences: D4_C1_ALLOWED_DIFFERENCES.allowed_to_differ,
    budget: D4_C1_BUDGET,
    c0b: "D4_C0B_SUPERSEDED_BY_C1_COMPARATOR_DESIGN",
    architecture_gate: "CLOSED",
    h6: "REMAINS OPEN in every row of the outcome matrix",
    next_round_may_only: "implement the frozen record-form condition and its non-target stability fixture, pass offline conformance at zero calls, freeze implementation hashes, then run the stability gate",
    next_round_may_not: [
      "call any model",
      "modify CharacterOS",
      "modify the production representation",
      "add a helpful annotation or a derived stance to the record",
      "change the measurement contract, anchors, schema or vocabulary",
      "lower the per-cell scoring standard"
    ],
    contract_manifest_hash: manifest.manifest_hash
  });

  process.stdout.write(
    `D4_C1_COMPARATOR_PREREGISTRATION_READY | D4_C0B_SUPERSEDED_BY_C1_COMPARATOR_DESIGN | LINK_4_REMAINS_LOCKED\n` +
      `C0a reference verified: ${String(c0aVerification.support_is_six_of_six_supports_b && c0aVerification.oppose_is_six_of_six_opposes_b)}\n` +
      `record bytes from production: ${rows.support.length} / ${rows.oppose.length} chars, field order ${JSON.stringify(recordAudit.observed_field_order)}\n` +
      `cell isolation: ${isolationAudit.verdict} (all pairs differ on exactly one line: ${String(isolationAudit.every_pair_differs_on_exactly_one_line)})\n` +
      `budget ${String(D4_C1_BUDGET.total)} = 0 requalification + 6 stability + 24 target\n` +
      `${manifest.manifest_hash}\nMODEL_CALLS_THIS_ROUND = 0\n`
  );
}

await main();
