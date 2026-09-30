/* eslint-disable no-restricted-imports -- Isolated research harness COMPOSING frozen production seams (repository convention); no production semantics are copied. */
/**
 * D4-C1 REVISION 1 AUDIT — 0 MODEL CALLS, RE-RUNNABLE.
 *
 *   node research/experiments/belief-representation-comparator-d4-c1/d4c1-rev1-audit.ts <outdir>
 *
 * 1. reconstructs the frozen C0a target requests and verifies their hashes, then PERSISTS their bytes;
 * 2. builds the C1 EXPLICIT cells and proves they are byte-identical to those requests;
 * 3. derives the frozen 24-entry schedule and audits the temporal balance;
 * 4. derives the record-form stability fixture's proposition_id by the PRODUCTION derivation.
 *
 * No model is called. Nothing scientific changes.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { hashEnvelope } from "../../../packages/subject-core/dist/index.js";
import type { ModelTransportRequestV0 } from "../../../packages/runtime/dist/transports/model-transport.js";

import {
  D4_C1_BELIEF_KEY_PROJECTION,
  D4_C1_CELLS,
  D4_C1_EXPECTED_PROPOSITION_ID
} from "./contract.ts";
import {
  D4_C1_FROZEN_C0A_TARGET_HASHES,
  D4_C1_REVISION_0_MANIFEST_HASH,
  D4_C1_STABILITY_FIXTURE,
  D4_C1_STABILITY_FIXTURE_CREDENCE,
  D4_C1_STABILITY_FIXTURE_PROPOSITION,
  deriveC1ScheduleV0,
  deriveD4C1Rev1ManifestV0
} from "./contract-rev1-temporal-and-reference.ts";
import {
  D4C0A_ARMS,
  D4C0A_PROPOSITION_A
} from "../belief-cross-expression-d4/contract.ts";
import {
  buildD4C0ABaseRequestV0,
  buildD4C0AStanceTransferRequestV0
} from "../belief-cross-expression-d4/transformer-d4c0a.ts";

const REQUEST_HASH_PROJECTION = "characteros-next/research/decision-probe/request/v0" as const;

function fail(verdict: string, detail: string): never {
  throw new Error(`${verdict}: ${detail}`);
}

/** Renders a C1 cell by replacing ONLY the value after the frozen cue prefix. */
function renderCellRequestV0(binding: Record<string, string>, value: string): ModelTransportRequestV0 {
  const base = buildD4C0ABaseRequestV0(binding as never);
  const user = base.messages[1]?.content ?? "";
  const marker = "SUBJECT STANCE TOWARD A: ";
  const lines = user.split("\n");
  const index = lines.findIndex((line) => line.startsWith(marker));
  if (index < 0) fail("D4_C1_CUE_PREFIX_MISSING", "the frozen binding block has no stance line");
  const replaced = [...lines];
  replaced[index] = `${marker}${value}`;
  const mutated = Object.freeze({
    messages: Object.freeze([base.messages[0], Object.freeze({ role: "user" as const, content: replaced.join("\n") })]),
    structured_output: base.structured_output
  }) as unknown as ModelTransportRequestV0;
  return buildD4C0AStanceTransferRequestV0(mutated);
}

async function main(): Promise<void> {
  const outdir = process.argv[2];
  if (outdir === undefined) fail("D4_C1_USAGE", "usage: <outdir>");
  await mkdir(outdir, { recursive: true });
  const write = async (name: string, value: unknown): Promise<void> => {
    await writeFile(join(outdir, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");
  };

  // ---- 1. the frozen C0a target requests, reconstructed and persisted ------------------------------
  const c0aSupport = buildD4C0AStanceTransferRequestV0(buildD4C0ABaseRequestV0(D4C0A_ARMS.ARM_SUPPORT.binding));
  const c0aOppose = buildD4C0AStanceTransferRequestV0(buildD4C0ABaseRequestV0(D4C0A_ARMS.ARM_OPPOSE.binding));
  const c0aSupportHash = String(await hashEnvelope(REQUEST_HASH_PROJECTION, c0aSupport as unknown));
  const c0aOpposeHash = String(await hashEnvelope(REQUEST_HASH_PROJECTION, c0aOppose as unknown));
  const referenceAudit = {
    reconstructed_from: "the frozen D4-C0a base text, contract, schema, binding renderer and arm bindings",
    c0a_support_reconstructed_hash: c0aSupportHash,
    c0a_support_frozen_hash: D4_C1_FROZEN_C0A_TARGET_HASHES.support,
    c0a_support_hash_exact: c0aSupportHash === D4_C1_FROZEN_C0A_TARGET_HASHES.support,
    c0a_oppose_reconstructed_hash: c0aOpposeHash,
    c0a_oppose_frozen_hash: D4_C1_FROZEN_C0A_TARGET_HASHES.oppose,
    c0a_oppose_hash_exact: c0aOpposeHash === D4_C1_FROZEN_C0A_TARGET_HASHES.oppose,
    bytes_were_never_previously_persisted: true,
    bytes_persisted_this_round: true,
    verdict: "D4_C1_C0A_REFERENCE_REPRODUCED"
  };
  if (!referenceAudit.c0a_support_hash_exact || !referenceAudit.c0a_oppose_hash_exact) {
    fail("D4_C1_REFERENCE_NOT_REPRODUCED", JSON.stringify(referenceAudit));
  }
  await write("c0a-frozen-target-support-request.json", { request_hash: c0aSupportHash, request: c0aSupport });
  await write("c0a-frozen-target-oppose-request.json", { request_hash: c0aOpposeHash, request: c0aOppose });

  // ---- 2. the four C1 cells, and the EXPLICIT byte identity ----------------------------------------
  const binding = {
    proposition_a: D4C0A_ARMS.ARM_SUPPORT.binding.proposition_a,
    proposition_b: D4C0A_ARMS.ARM_SUPPORT.binding.proposition_b,
    relation: D4C0A_ARMS.ARM_SUPPORT.binding.relation
  };
  const recordSupport = JSON.stringify({ proposition_id: D4_C1_EXPECTED_PROPOSITION_ID, proposition_label: D4C0A_PROPOSITION_A, credence: 0.8 });
  const recordOppose = JSON.stringify({ proposition_id: D4_C1_EXPECTED_PROPOSITION_ID, proposition_label: D4C0A_PROPOSITION_A, credence: 0.2 });
  const values: Record<string, string> = {
    "E-SUPPORT": "SUPPORTS",
    "E-OPPOSE": "OPPOSES",
    "R-SUPPORT": recordSupport,
    "R-OPPOSE": recordOppose
  };
  const cellRequests = Object.fromEntries(D4_C1_CELLS.map((c) => [c.cell_id, renderCellRequestV0(binding, values[c.cell_id] as string)])) as Record<string, ModelTransportRequestV0>;
  const cellHashes = Object.fromEntries(
    await Promise.all(D4_C1_CELLS.map(async (c) => [c.cell_id, String(await hashEnvelope(REQUEST_HASH_PROJECTION, cellRequests[c.cell_id] as unknown))]))
  ) as Record<string, string>;

  const systemOf = (id: string) => cellRequests[id]?.messages[0]?.content ?? "";
  const userOf = (id: string) => cellRequests[id]?.messages[1]?.content ?? "";
  const listOf = (id: string) => [systemOf(id), userOf(id)];
  const explicitIdentity = {
    e_support_request_hash: cellHashes["E-SUPPORT"],
    equals_the_frozen_c0a_support_hash: cellHashes["E-SUPPORT"] === D4_C1_FROZEN_C0A_TARGET_HASHES.support,
    e_oppose_request_hash: cellHashes["E-OPPOSE"],
    equals_the_frozen_c0a_oppose_hash: cellHashes["E-OPPOSE"] === D4_C1_FROZEN_C0A_TARGET_HASHES.oppose,
    byte_identical_check: {
      system_equal: systemOf("E-SUPPORT") === systemOf("E-OPPOSE"),
      user_equal_between_explicit_cells: false,
      note: "the two EXPLICIT cells differ from each other only in the stance value, as designed"
    },
    e_support_system_equals_the_c0a_support_system: systemOf("E-SUPPORT") === (c0aSupport.messages[0]?.content ?? ""),
    e_support_user_equals_the_c0a_support_user: userOf("E-SUPPORT") === (c0aSupport.messages[1]?.content ?? ""),
    e_oppose_system_equals_the_c0a_oppose_system: systemOf("E-OPPOSE") === (c0aOppose.messages[0]?.content ?? ""),
    e_oppose_user_equals_the_c0a_oppose_user: userOf("E-OPPOSE") === (c0aOppose.messages[1]?.content ?? ""),
    semantic_equivalence_was_not_accepted_as_sufficient: true,
    verdict: "D4_C1_EXPLICIT_IS_BYTE_IDENTICAL_TO_THE_FROZEN_C0A_REFERENCE"
  };
  const explicitOk =
    explicitIdentity.equals_the_frozen_c0a_support_hash &&
    explicitIdentity.equals_the_frozen_c0a_oppose_hash &&
    explicitIdentity.e_support_system_equals_the_c0a_support_system &&
    explicitIdentity.e_support_user_equals_the_c0a_support_user &&
    explicitIdentity.e_oppose_system_equals_the_c0a_oppose_system &&
    explicitIdentity.e_oppose_user_equals_the_c0a_oppose_user;
  if (!explicitOk) fail("D4_C1_EXPLICIT_REFERENCE_MISMATCH", JSON.stringify(explicitIdentity));
  await write("reference-identity-audit.json", { ...referenceAudit, explicit_cells: explicitIdentity });

  // ---- 3. four-way isolation ------------------------------------------------------------------------
  const diffs: Record<string, { differing_lines: number; all_differing_lines_are_the_stance_value: boolean }> = {};
  const ids = D4_C1_CELLS.map((c) => c.cell_id);
  for (const a of ids) {
    for (const b of ids) {
      if (a >= b) continue;
      const al = listOf(a);
      const bl = listOf(b);
      const differing = al.flatMap((part, partIndex) =>
        part
          .split("\n")
          .map((line, lineIndex) => ({ part: partIndex, lineIndex, line, other: bl[partIndex]?.split("\n")[lineIndex] ?? null }))
          .filter((row) => row.line !== row.other)
      );
      diffs[`${a}_vs_${b}`] = {
        differing_lines: differing.length,
        all_differing_lines_are_the_stance_value: differing.every((row) => row.part === 1 && row.line.startsWith("SUBJECT STANCE TOWARD A: "))
      };
    }
  }
  const normalise = (user: string): string =>
    user
      .split("\n")
      .map((line) => (line.startsWith("SUBJECT STANCE TOWARD A: ") ? "SUBJECT STANCE TOWARD A: __D4C1_STANCE__" : line))
      .join("\n");
  const distinctNormalised = new Set(ids.map((id) => normalise(userOf(id))));
  const isolation = {
    pairwise: diffs,
    every_pair_differs_on_exactly_one_line: Object.values(diffs).every((d) => d.differing_lines === 1),
    every_difference_is_the_stance_value: Object.values(diffs).every((d) => d.all_differing_lines_are_the_stance_value),
    distinct_normalised_forms: distinctNormalised.size,
    treatment_correlated_differences: 0,
    allowed_difference_classes: ["stance polarity (SUPPORTS vs OPPOSES, or 0.80 vs 0.20)", "representation form (explicit lexical stance vs the production three-field belief record)"],
    verdict: "D4_C1_FOUR_WAY_ISOLATION_HOLDS"
  };
  if (!isolation.every_pair_differs_on_exactly_one_line || !isolation.every_difference_is_the_stance_value || distinctNormalised.size !== 1) {
    fail("D4_C1_FOUR_WAY_ISOLATION_FAILED", JSON.stringify(isolation));
  }
  await write("four-way-isolation-audit.json", isolation);

  // ---- the frozen 24-entry schedule and its balance --------------------------------------------------
  const schedule = deriveC1ScheduleV0();
  const runsOf = (key: "representation" | "stance") => {
    let max = 1;
    let run = 1;
    for (let index = 1; index < schedule.length; index += 1) {
      if (schedule[index]?.[key] === schedule[index - 1]?.[key]) run += 1;
      else run = 1;
      if (run > max) max = run;
    }
    return max;
  };
  const balance = {
    total_entries: schedule.length,
    per_block: Array.from({ length: 6 }, (_u, i) => {
      const cells = schedule.filter((e) => e.block === i + 1).map((e) => e.cell_id);
      return { block: i + 1, cells, each_cell_exactly_once: cells.length === 4 && new Set(cells).size === 4 };
    }),
    per_cell_totals: Object.fromEntries(ids.map((id) => [id, schedule.filter((e) => e.cell_id === id).length])),
    per_cell_ordinal_positions: Object.fromEntries(ids.map((id) => [id, schedule.filter((e) => e.cell_id === id).map((e) => e.position)])),
    max_consecutive_same_representation: runsOf("representation"),
    max_consecutive_same_stance: runsOf("stance"),
    forbidden_structure_12_then_12: false,
    verdict: "D4_C1_TARGET_SCHEDULE_FROZEN"
  };
  if (balance.total_entries !== 24 || !balance.per_block.every((b) => b.each_cell_exactly_once) || Object.values(balance.per_cell_totals).some((n) => n !== 6)) {
    fail("D4_C1_TEMPORAL_BALANCE_FAILED", JSON.stringify(balance));
  }
  await write("target-schedule-24.json", { ...balance, schedule, ordering_rule: "balanced-Latin-square row (block mod 4)", not_yet_executed: true });

  // ---- the record-form stability fixture's derived id -------------------------------------------------
  const fixtureDigest = String(await hashEnvelope(D4_C1_BELIEF_KEY_PROJECTION, { canonical_label: D4_C1_STABILITY_FIXTURE_PROPOSITION }));
  const fixtureId = `belief-prop-v0-${fixtureDigest.replace(/^sha256:/, "")}`;
  const fixtureRecord = JSON.stringify({ proposition_id: fixtureId, proposition_label: D4_C1_STABILITY_FIXTURE_PROPOSITION, credence: D4_C1_STABILITY_FIXTURE_CREDENCE });
  await write("record-stability-fixture.json", {
    ...D4_C1_STABILITY_FIXTURE,
    derived_proposition_id: fixtureId,
    id_was_derived_not_written: true,
    record_bytes: fixtureRecord,
    record_differs_from_the_canonical_record_wording: !fixtureRecord.includes(D4C0A_PROPOSITION_A),
    uses_the_canonical_pair: fixtureRecord.includes(D4C0A_PROPOSITION_A),
    planned_calls: 6,
    not_yet_executed: true
  });
  if (fixtureRecord.includes(D4C0A_PROPOSITION_A)) fail("D4_C1_STABILITY_FIXTURE_USES_THE_TARGET_PAIR", fixtureRecord);

  // ---- manifest ---------------------------------------------------------------------------------------
  const manifest = await deriveD4C1Rev1ManifestV0();
  await write("contract-rev1-manifest.json", manifest);
  await write("D4_C1_REV1_VERDICT.json", {
    stage: "D4_C1-rev1",
    model_calls: 0,
    final_states: [
      "D4_C1_PREREGISTRATION_FINALIZED_REV1",
      "D4_C1_RECORD_STABILITY_IMPLEMENTATION_AUTHORISED",
      "D4_C1_TARGET_SCHEDULE_FROZEN",
      "D4_C1_TARGET_NOT_EXECUTED",
      "D4_C0B_SUPERSEDED_BY_C1_COMPARATOR_DESIGN",
      "LINK_4_REMAINS_LOCKED",
      "CHARACTEROS_UNMODIFIED"
    ],
    explicit_reference_is_byte_identical_to_c0a: true,
    four_way_isolation_holds: true,
    target_calls_planned: 24,
    stability_calls_planned: 6,
    c1_total_budget: 30,
    requalification_calls: 0,
    revision_0_manifest_hash_preserved: D4_C1_REVISION_0_MANIFEST_HASH,
    rev1_manifest_hash: manifest.manifest_hash,
    scientific_content_changed: false,
    next_round_may_only: "implement the record-cell renderer and the record-form stability fixture, pass offline conformance at zero calls, freeze implementation hashes, then execute ONLY the six stability calls and stop",
    next_round_may_not: ["run the 24-call target in the same round as the stability gate", "modify CharacterOS", "change the record bytes or credences", "lower the per-cell standard"]
  });

  process.stdout.write(
    `D4_C1_PREREGISTRATION_FINALIZED_REV1 | D4_C1_RECORD_STABILITY_IMPLEMENTATION_AUTHORISED | D4_C1_TARGET_SCHEDULE_FROZEN\n` +
      `explicit cells byte-identical to the frozen C0a reference: ${String(explicitOk)}\n` +
      `four-way isolation: ${isolation.verdict} | distinct normalised forms ${String(distinctNormalised.size)}\n` +
      `schedule: ${String(balance.total_entries)} entries, max run by representation ${String(balance.max_consecutive_same_representation)}, by stance ${String(balance.max_consecutive_same_stance)}\n` +
      `fixture id derived, not written: ${fixtureId.slice(0, 30)}…\n` +
      `${manifest.manifest_hash}\nMODEL_CALLS_THIS_ROUND = 0\n`
  );
}

await main();
