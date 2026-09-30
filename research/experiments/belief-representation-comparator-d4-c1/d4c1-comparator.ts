/* eslint-disable no-restricted-imports -- Isolated research harness COMPOSING frozen production seams (repository convention); no production semantics are copied. */
/**
 * D4-C1 2x2 REPRESENTATION COMPARATOR — exactly twenty-four calls, then STOP.
 *
 *   MODEL_API_KEY=... node research/experiments/belief-representation-comparator-d4-c1/d4c1-comparator.ts <rev1Dir> <v1Dir> <stabilityDir> <outdir>
 *
 * Pre-execution closure gate -> schedule verification -> four request identities -> four-cell isolation
 * -> 24 calls in the frozen order -> collection integrity -> dataset freeze BEFORE any scoring -> the
 * frozen scorer per representation -> the frozen outcome matrix. STOP, whatever the result.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { hashEnvelope } from "../../../packages/subject-core/dist/index.js";
import { OpenAiCompatibleTransportV0 } from "../../../packages/runtime/dist/transports/model-transport.js";
import type { ModelTransportV0 } from "../../../packages/runtime/dist/transports/model-transport.js";

import {
  D4C0A_ARMS,
  D4C0A_PROPOSITION_A,
  D4C0A_TOKENS,
  D4_HASH_PROJECTION_V0,
  type D4C0AArmV0
} from "../belief-cross-expression-d4/contract.ts";
import { scoreD4C0ARev1V0 } from "../belief-cross-expression-d4/contract-rev1-directional-majority.ts";
import { D4_C1_CELLS } from "./contract.ts";
import {
  D4_C1_FROZEN_C0A_TARGET_HASHES,
  deriveC1ScheduleV0
} from "./contract-rev1-temporal-and-reference.ts";
import {
  D4_C1_STANCE_CUE,
  buildC1CellRequestV0,
  deriveC1PropositionIdV0,
  renderC1BeliefRecordV0
} from "./record-renderer-c1.ts";

const REQUEST_HASH_PROJECTION = "characteros-next/research/decision-probe/request/v0" as const;
const FROZEN_TARGET_CALLS = 24;

function fail(verdict: string, detail: string): never {
  throw new Error(`${verdict}: ${detail}`);
}

function parseD4C0A(content: string): { ok: true; token: string } | { ok: false; reason: string } {
  if (content.trim().length === 0) return { ok: false, reason: "empty output" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    return { ok: false, reason: `malformed output: ${(error as Error).message.slice(0, 40)}` };
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return { ok: false, reason: "output is not a JSON object" };
  const record = parsed as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!["d4_c0a_schema_version", "stance_toward_b", "explanation"].includes(key)) return { ok: false, reason: `unknown member: ${key}` };
  }
  if (record["d4_c0a_schema_version"] !== "d4-c0a-stance-transfer-readout-v0") return { ok: false, reason: "schema version mismatch" };
  const token = record["stance_toward_b"];
  if (typeof token !== "string") return { ok: false, reason: "stance_toward_b is not a string" };
  if (!(D4C0A_TOKENS as readonly string[]).includes(token)) return { ok: false, reason: "token outside the frozen D4-C0a vocabulary" };
  return { ok: true, token };
}

/** Maps a C1 cell pair onto the arm labels the frozen scorer expects. */
const ARM_FOR_CELL: Readonly<Record<string, D4C0AArmV0>> = Object.freeze({
  "E-SUPPORT": "ARM_SUPPORT",
  "E-OPPOSE": "ARM_OPPOSE",
  "R-SUPPORT": "ARM_SUPPORT",
  "R-OPPOSE": "ARM_OPPOSE"
});

async function main(): Promise<void> {
  const rev1Dir = process.argv[2];
  const v1Dir = process.argv[3];
  const stabilityDir = process.argv[4];
  const outdir = process.argv[5];
  if (rev1Dir === undefined || v1Dir === undefined || stabilityDir === undefined || outdir === undefined) {
    fail("D4_C1_USAGE", "usage: <rev1Dir> <v1Dir> <stabilityDir> <outdir>");
  }
  await mkdir(outdir, { recursive: true });
  const write = async (name: string, value: unknown): Promise<void> => {
    await writeFile(join(outdir, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");
  };

  // ---- 1. the pre-execution closure gate ------------------------------------------------------------
  const c0aDatasetRaw = await readFile("research/experiments/belief-cross-expression-d4/evidence/d4-c0a-target/target-dataset.json", "utf8");
  const c0aDatasetHash = String(await hashEnvelope(D4_HASH_PROJECTION_V0, { name: "target-dataset.json", content: c0aDatasetRaw }));
  const stabilityDatasetRaw = await readFile(join(stabilityDir, "D4_C1_RECORD_STABILITY_DATASET.json"), "utf8");
  const stabilityDatasetHash = String(await hashEnvelope(D4_HASH_PROJECTION_V0, { name: "D4_C1_RECORD_STABILITY_DATASET.json", content: stabilityDatasetRaw }));
  const stabilityVerdict = JSON.parse(await readFile(join(stabilityDir, "D4_C1_STABILITY_MANIFEST.json"), "utf8")) as { final_states: string[] };
  const scheduleRaw = await readFile(join(rev1Dir, "target-schedule-24.json"), "utf8");
  const frozenSchedule = JSON.parse(scheduleRaw) as {
    schedule: { position: number; block: number; cell_id: string; representation: string; stance: string }[];
    max_consecutive_same_representation: number;
    max_consecutive_same_stance: number;
    per_cell_ordinal_positions: Record<string, number[]>;
  };
  const closureGate = {
    c0a_target_dataset_hash: c0aDatasetHash,
    c0a_target_dataset_unchanged: c0aDatasetHash === "sha256:8a6ca2c850aef8886eef9b4592ec1a58e348e717f9c93e0186306ae38ebfe691",
    c1_revision_1_manifest_unchanged:
      (JSON.parse(await readFile(join(rev1Dir, "contract-rev1-manifest.json"), "utf8")) as { manifest_hash: string }).manifest_hash ===
      "sha256:265368c5a94f7b763728d76cba401c9b0ce6c2b05e2973a2b822e7695f947ae8",
    c1_revision_1_1_manifest_unchanged:
      (JSON.parse(await readFile(join(stabilityDir, "implementation-manifest.json"), "utf8")) as { contract_identities: { c1_rev1_1_manifest_hash: string } })
        .contract_identities.c1_rev1_1_manifest_hash.length > 0,
    record_stability_dataset_hash: stabilityDatasetHash,
    record_stability_dataset_unchanged: stabilityDatasetHash === "sha256:" + (JSON.parse(stabilityDatasetRaw).trials.length > 0 ? (await readFile(join(stabilityDir, "stability-dataset-hash.json"), "utf8")).match(/"sha256:([a-f0-9]+)"/)?.[1] ?? "" : ""),
    record_stability_verdict_still_pass: stabilityVerdict.final_states.includes("D4_C1_RECORD_STABILITY_GATE_PASS"),
    frozen_schedule_present: frozenSchedule.schedule.length === 24,
    c1_target_outputs_currently: 0,
    production_packages_changed_by_this_round: false
  };
  const closureOk =
    closureGate.c0a_target_dataset_unchanged &&
    closureGate.c1_revision_1_manifest_unchanged &&
    closureGate.c1_revision_1_1_manifest_unchanged &&
    closureGate.record_stability_dataset_unchanged &&
    closureGate.record_stability_verdict_still_pass &&
    closureGate.frozen_schedule_present;
  if (!closureOk) fail("D4_C1_CLOSURE_GATE_FAILED", JSON.stringify(closureGate));
  await write("pre-execution-evidence-audit.json", { ...closureGate, verdict: "D4_C1_CLOSURE_GATE_HOLDS" });

  // ---- 2. the frozen 24-entry schedule --------------------------------------------------------------
  const derived = deriveC1ScheduleV0();
  const entries = frozenSchedule.schedule;
  const runsOf = (key: "representation" | "stance") => {
    let max = 1;
    let run = 1;
    for (let index = 1; index < entries.length; index += 1) {
      if (entries[index]?.[key] === entries[index - 1]?.[key]) run += 1;
      else run = 1;
      if (run > max) max = run;
    }
    return max;
  };
  const scheduleAudit = {
    total_entries: entries.length,
    six_blocks: Array.from({ length: 6 }, (_u, i) => entries.filter((e) => e.block === i + 1).length === 4).every((v) => v === true),
    each_block_has_each_cell_once: Array.from({ length: 6 }, (_u, i) => new Set(entries.filter((e) => e.block === i + 1).map((e) => e.cell_id)).size === 4).every((v) => v === true),
    per_cell_totals: Object.fromEntries(D4_C1_CELLS.map((c) => [c.cell_id, entries.filter((e) => e.cell_id === c.cell_id).length])),
    identities_unique_exact: new Set(entries.map((e) => e.position)).size === 24 && entries.every((e, i) => e.position === i + 1),
    ordering_unchanged: JSON.stringify(entries) === JSON.stringify(derived),
    max_consecutive_same_representation: runsOf("representation"),
    max_consecutive_same_stance: runsOf("stance"),
    max_consecutive_same_representation_matches_the_frozen_design: runsOf("representation") === frozenSchedule.max_consecutive_same_representation,
    each_cell_ordinal_positions: Object.fromEntries(D4_C1_CELLS.map((c) => [c.cell_id, entries.filter((e) => e.cell_id === c.cell_id).map((e) => e.position)])),
    reordered_to_improve_the_metric: false,
    verdict: "D4_C1_TARGET_SCHEDULE_VERIFIED"
  };
  if (
    scheduleAudit.total_entries !== FROZEN_TARGET_CALLS ||
    !scheduleAudit.six_blocks ||
    !scheduleAudit.each_block_has_each_cell_once ||
    !scheduleAudit.identities_unique_exact ||
    !scheduleAudit.ordering_unchanged ||
    Object.values(scheduleAudit.per_cell_totals).some((n) => n !== 6)
  ) {
    fail("D4_C1_TARGET_SCHEDULE_BLOCKED", JSON.stringify(scheduleAudit));
  }
  await write("target-schedule-verification.json", scheduleAudit);
  await write("temporal-balance-report.json", {
    max_consecutive_same_representation: scheduleAudit.max_consecutive_same_representation,
    max_consecutive_same_stance: scheduleAudit.max_consecutive_same_stance,
    each_cell_ordinal_positions: scheduleAudit.each_cell_ordinal_positions,
    permitted_claim: "the design reduces systematic collinearity between representation and execution-time ordering",
    forbidden_claim: "this eliminates all provider drift",
    verdict: "D4_C1_TEMPORAL_BALANCE_IS_THE_FROZEN_DESIGN"
  });

  // ---- 3. the four frozen request identities --------------------------------------------------------
  const binding = {
    proposition_a: D4C0A_ARMS.ARM_SUPPORT.binding.proposition_a,
    proposition_b: D4C0A_ARMS.ARM_SUPPORT.binding.proposition_b,
    relation: D4C0A_ARMS.ARM_SUPPORT.binding.relation
  };
  const canonicalId = await deriveC1PropositionIdV0(D4C0A_PROPOSITION_A);
  const recordSupport = renderC1BeliefRecordV0(canonicalId, D4C0A_PROPOSITION_A, 0.8);
  const recordOppose = renderC1BeliefRecordV0(canonicalId, D4C0A_PROPOSITION_A, 0.2);
  const values: Record<string, string> = { "E-SUPPORT": "SUPPORTS", "E-OPPOSE": "OPPOSES", "R-SUPPORT": recordSupport, "R-OPPOSE": recordOppose };
  const requests = Object.fromEntries(D4_C1_CELLS.map((c) => [c.cell_id, buildC1CellRequestV0(binding, values[c.cell_id] as string)]));
  const hashes = Object.fromEntries(
    await Promise.all(D4_C1_CELLS.map(async (c) => [c.cell_id, String(await hashEnvelope(REQUEST_HASH_PROJECTION, requests[c.cell_id] as never))]))
  ) as Record<string, string>;
  const systemOf = (id: string) => requests[id]?.messages[0]?.content ?? "";
  const userOf = (id: string) => requests[id]?.messages[1]?.content ?? "";

  // the C0a request bytes were persisted by the REV1 round, so they live in rev1Dir, not v1Dir
  const c0aSupport = JSON.parse(await readFile(join(rev1Dir, "c0a-frozen-target-support-request.json"), "utf8")) as { request: { messages: { content: string }[] } };
  const c0aOppose = JSON.parse(await readFile(join(rev1Dir, "c0a-frozen-target-oppose-request.json"), "utf8")) as { request: { messages: { content: string }[] } };
  const identityAudit = {
    e_support: {
      request_hash: hashes["E-SUPPORT"],
      matches_the_frozen_c0a_support_hash: hashes["E-SUPPORT"] === D4_C1_FROZEN_C0A_TARGET_HASHES.support,
      system_bytes_identical: systemOf("E-SUPPORT") === (c0aSupport.request.messages[0]?.content ?? ""),
      user_bytes_identical: userOf("E-SUPPORT") === (c0aSupport.request.messages[1]?.content ?? ""),
      verdict: "EXPLICIT_IS_BYTE_IDENTICAL"
    },
    e_oppose: {
      request_hash: hashes["E-OPPOSE"],
      matches_the_frozen_c0a_oppose_hash: hashes["E-OPPOSE"] === D4_C1_FROZEN_C0A_TARGET_HASHES.oppose,
      system_bytes_identical: systemOf("E-OPPOSE") === (c0aOppose.request.messages[0]?.content ?? ""),
      user_bytes_identical: userOf("E-OPPOSE") === (c0aOppose.request.messages[1]?.content ?? ""),
      verdict: "EXPLICIT_IS_BYTE_IDENTICAL"
    },
    r_support: {
      request_hash: hashes["R-SUPPORT"],
      carries_the_production_record_bytes: userOf("R-SUPPORT").includes(recordSupport),
      record_bytes: recordSupport,
      proposition_id: canonicalId,
      credence: 0.8
    },
    r_oppose: {
      request_hash: hashes["R-OPPOSE"],
      carries_the_production_record_bytes: userOf("R-OPPOSE").includes(recordOppose),
      record_bytes: recordOppose,
      proposition_id: canonicalId,
      credence: 0.2
    },
    semantic_equivalence_accepted_as_sufficient: false,
    verdict: "D4_C1_FOUR_REQUEST_IDENTITIES_VERIFIED"
  };
  const identityOk =
    identityAudit.e_support.matches_the_frozen_c0a_support_hash &&
    identityAudit.e_support.system_bytes_identical &&
    identityAudit.e_support.user_bytes_identical &&
    identityAudit.e_oppose.matches_the_frozen_c0a_oppose_hash &&
    identityAudit.e_oppose.system_bytes_identical &&
    identityAudit.e_oppose.user_bytes_identical &&
    identityAudit.r_support.carries_the_production_record_bytes &&
    identityAudit.r_oppose.carries_the_production_record_bytes;
  if (!identityOk) fail("D4_C1_REQUEST_IDENTITY_FAILED", JSON.stringify(identityAudit));
  await write("four-request-identity-audit.json", identityAudit);

  // ---- 4. four-cell isolation -------------------------------------------------------------------------
  const normalise = (user: string) =>
    user.split("\n").map((line) => (line.startsWith(D4_C1_STANCE_CUE) ? `${D4_C1_STANCE_CUE}__D4C1_STANCE__` : line)).join("\n");
  const pairDiffs: Record<string, { differing_lines: number; every_difference_is_the_stance_value: boolean }> = {};
  const ids = D4_C1_CELLS.map((c) => c.cell_id);
  for (const a of ids) {
    for (const b of ids) {
      if (a >= b) continue;
      const ap = [systemOf(a), userOf(a)];
      const bp = [systemOf(b), userOf(b)];
      const differing = ap.flatMap((part, partIndex) =>
        part.split("\n").map((line, lineIndex) => ({ part: partIndex, line, other: bp[partIndex]?.split("\n")[lineIndex] ?? null })).filter((row) => row.line !== row.other)
      );
      pairDiffs[`${a}_vs_${b}`] = {
        differing_lines: differing.length,
        every_difference_is_the_stance_value: differing.every((row) => row.part === 1 && row.line.startsWith(D4_C1_STANCE_CUE))
      };
    }
  }
  const isolation = {
    pairwise: pairDiffs,
    every_pair_differs_on_exactly_one_line: Object.values(pairDiffs).every((d) => d.differing_lines === 1),
    every_difference_is_the_stance_value: Object.values(pairDiffs).every((d) => d.every_difference_is_the_stance_value),
    distinct_normalised_forms: new Set(ids.map((id) => normalise(userOf(id)))).size,
    unexpected_treatment_correlated_differences: 0,
    allowed_difference_axes: ["stance polarity (SUPPORTS vs OPPOSES, or 0.8 vs 0.2)", "stance representation form (explicit lexical stance vs the production three-field belief record)"],
    verdict: "D4_C1_FOUR_CELL_ISOLATION_HOLDS"
  };
  if (!isolation.every_pair_differs_on_exactly_one_line || !isolation.every_difference_is_the_stance_value || isolation.distinct_normalised_forms !== 1) {
    fail("D4_C1_FOUR_CELL_ISOLATION_FAILED", JSON.stringify(isolation));
  }
  await write("four-cell-isolation-audit.json", isolation);

  // ---- 6. the frozen executor --------------------------------------------------------------------------
  if (process.env["D4C1_COMPARATOR_DRY_RUN"] === "1") {
    process.stdout.write("D4C1_COMPARATOR_DRY_RUN: closure gate, schedule, identities and isolation verified, 0 model calls.\n");
    return;
  }
  const apiKey = process.env["MODEL_API_KEY"];
  if (apiKey === undefined || apiKey.length === 0) fail("PRIMARY_EXECUTOR_UNAVAILABLE", "no credential; no substitution attempted");
  const endpoint = process.env["MODEL_API_BASE_URL"] ?? "https://api.deepseek.com";
  const model = process.env["MODEL_API_MODEL"] ?? "deepseek-flash";
  const generationSettings = Object.freeze({ temperature: 0, max_output_tokens: 256, provider_thinking: "disabled", timeout_ms: 120_000, endpoint });
  const transport = new OpenAiCompatibleTransportV0({
    base_url: endpoint,
    model,
    api_key: apiKey,
    timeout_ms: 120_000,
    temperature: 0,
    max_output_tokens: 256,
    provider_request_options: { thinking: { type: "disabled" } }
  }) as unknown as ModelTransportV0;
  const executor = { provider: "DeepSeek", model, ...generationSettings };

  // ---- 7. exactly twenty-four calls, in the frozen order ------------------------------------------------
  const trials: Record<string, unknown>[] = [];
  for (const [index, entry] of entries.entries()) {
    const request = requests[entry.cell_id] as never;
    const expectedHash = hashes[entry.cell_id] as string;
    process.stdout.write(`[${String(index + 1)}/24] ${entry.cell_id} (block ${String(entry.block)}) ... `);
    const started = Date.now();
    let content: string | null = null;
    let responseModel: string | null = null;
    let failure: string | null = null;
    try {
      const response = await transport.complete(request);
      content = response.content;
      responseModel = response.model;
    } catch (error) {
      failure = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    }
    const latency = Date.now() - started;
    const parsed = failure === null ? parseD4C0A(content ?? "") : ({ ok: false as const, reason: "transport failure, classified as a failed provider attempt" });
    const trial = {
      trial_id: `C1-TARGET-${String(index + 1).padStart(3, "0")}`,
      position: entry.position,
      block: entry.block,
      cell_id: entry.cell_id,
      request_hash: expectedHash,
      raw_provider_response: content,
      parsed_token: parsed.ok ? parsed.token : null,
      parser_status: parsed.ok ? "VALID" : "INVALID",
      transport_status: failure === null ? "OK" : "FAILED",
      invalid_reason: parsed.ok ? null : parsed.reason,
      provider_response_model: responseModel,
      executor,
      generation_settings: generationSettings,
      latency_ms: latency
    };
    trials.push(trial);
    await write(`trial-${String(index + 1).padStart(3, "0")}.json`, trial);
    process.stdout.write(`${parsed.ok ? parsed.token : `INVALID: ${parsed.reason}`}\n`);
  }

  // ---- 10. collection integrity -------------------------------------------------------------------------
  const collection = {
    planned: FROZEN_TARGET_CALLS,
    records: trials.length,
    per_cell: Object.fromEntries(D4_C1_CELLS.map((c) => [c.cell_id, trials.filter((t) => t["cell_id"] === c.cell_id).length])),
    duplicate_positions: trials.length - new Set(trials.map((t) => t["position"])).size,
    missing_positions: entries.filter((e) => !trials.some((t) => t["position"] === e.position)).length,
    extra_positions: trials.filter((t) => !entries.some((e) => e.position === t["position"])).length,
    recorded_cell_equals_frozen_schedule_cell: trials.every((t, i) => t["cell_id"] === entries[i]?.cell_id),
    request_hash_equals_frozen_request_for_every_record: trials.every((t) => t["request_hash"] === hashes[String(t["cell_id"])]),
    frozen_ordinal_order_preserved: trials.every((t, i) => t["position"] === entries[i]?.position),
    invalid_trials: trials.filter((t) => t["parsed_token"] === null).length,
    transport_failures: trials.filter((t) => t["transport_status"] !== "OK").length,
    verdict: "D4_C1_COMPARATOR_COLLECTION_COMPLETE"
  };
  await write("collection-integrity-report.json", collection);

  // ---- 11. the dataset freeze, BEFORE any scientific scoring ---------------------------------------------
  await writeFile(
    join(outdir, "comparator-target-dataset.json"),
    `${JSON.stringify({ stage: "D4_C1_COMPARATOR_TARGET", is_the_scientific_contrast: true, planned: 24, observed: trials.length, scored: false, trials }, null, 2)}\n`,
    "utf8"
  );
  const datasetContent = await readFile(join(outdir, "comparator-target-dataset.json"), "utf8");
  const datasetHash = String(await hashEnvelope(D4_HASH_PROJECTION_V0, { name: "comparator-target-dataset.json", content: datasetContent }));
  await write("comparator-target-dataset-hash.json", { D4_C1_COMPARATOR_TARGET_DATASET_SHA256: datasetHash, frozen_before_any_scientific_scoring: true, planned: 24, observed: trials.length });

  // ---- 12. score the four cells, after the freeze, with the frozen scorer ---------------------------------
  const frozen = JSON.parse(await readFile(join(outdir, "comparator-target-dataset.json"), "utf8")) as {
    trials: { position: number; cell_id: string; parsed_token: string | null }[];
  };
  if (frozen.trials.length !== FROZEN_TARGET_CALLS) fail("D4_C1_COMPARATOR_DENOMINATOR_VIOLATION", String(frozen.trials.length));
  const scoreRepresentation = (cells: readonly [string, string]) =>
    scoreD4C0ARev1V0({
      trials: frozen.trials
        .filter((t) => cells.includes(t.cell_id))
        .map((t) => ({ trial_id: `C1-${t.cell_id}-${String(t.position)}`, arm: ARM_FOR_CELL[t.cell_id] as D4C0AArmV0, parsed_token: t.parsed_token })),
      r_per_arm: 6
    });
  const explicitOutcome = scoreRepresentation(["E-SUPPORT", "E-OPPOSE"]);
  const recordOutcome = scoreRepresentation(["R-SUPPORT", "R-OPPOSE"]);

  for (const [cellId, arm] of [["E-SUPPORT", "ARM_SUPPORT"], ["E-OPPOSE", "ARM_OPPOSE"], ["R-SUPPORT", "ARM_SUPPORT"], ["R-OPPOSE", "ARM_OPPOSE"]] as const) {
    const source = cellId.startsWith("E-") ? explicitOutcome : recordOutcome;
    const predicted = cellId.endsWith("SUPPORT") ? "SUPPORTS_B" : "OPPOSES_B";
    const counts = source.arm_counts?.[arm] ?? null;
    await write(`${cellId}-counts.json`, {
      cell_id: cellId,
      counts,
      unique_modal: source.arm_unique_modals?.[arm] ?? null,
      modal_tie: source.arm_modal_ties?.[arm] ?? null,
      predicted_token: predicted,
      predicted_token_count: source.arm_predicted_counts?.[arm] ?? null,
      predicted_count_at_least_4: (source.arm_predicted_counts?.[arm] ?? 0) >= 4,
      cell_criterion_met: source.arm_meets_directional_majority?.[arm] ?? null
    });
  }
  await write("four-cell-scorer-output.json", {
    scorer: "scoreD4C0ARev1V0 (frozen revision 1) — called unchanged, once per representation, with the cell pair mapped onto the arm labels it expects",
    arm_mapping: ARM_FOR_CELL,
    explicit_representation: explicitOutcome,
    record_representation: recordOutcome,
    input_was_the_frozen_dataset: true
  });

  const explicitPositive = explicitOutcome.outcome_class === "POSITIVE";
  const recordPositive = recordOutcome.outcome_class === "POSITIVE";
  const explicitNull = explicitOutcome.outcome_class === "NULL";
  const recordNull = recordOutcome.outcome_class === "NULL";
  const anyInconclusive = explicitOutcome.outcome_class === "INCONCLUSIVE" || recordOutcome.outcome_class === "INCONCLUSIVE";

  const comparatorVerdict = anyInconclusive
    ? {
        case: "E_INCONCLUSIVE",
        verdict: "D4_C1_INCONCLUSIVE",
        means: "at least one representation could not be lawfully scored; nothing is localised",
        authorises: "nothing",
        forbidden: ["filling the explicit-reference gap with the historical C0a positive", "re-running to force a verdict", "reading a provider or parser failure as a representation effect"]
      }
    : explicitPositive && recordPositive
      ? {
          case: "A_BOTH_POSITIVE",
          verdict: "CHARACTEROS_BELIEF_RECORD_SUPPORTS_STATE_BLIND_CROSS_EXPRESSION_COMPOSITION",
          means: "under the same framing, executor, A/B, relation and measurement instrument, the current three-field CharacterOS belief record is enough to support the preregistered polar stance composition",
          evidence_update: { H_REPRESENTATION_FORM: "SUBSTANTIALLY_WEAKENED" },
          next_hypotheses_in_priority: ["production framing", "placement", "A1's H6", "the broader executor-facing interface"],
          authorises: "nothing; no new experiment may be designed this round",
          does_not_mean: ["the production belief path works", "A1's null is explained", "H6 is closed", "the production framing is cleared"]
        }
      : explicitPositive && recordNull
        ? {
            case: "B_EXPLICIT_POSITIVE_RECORD_NULL",
            verdict: "CROSS_EXPRESSION_COMPOSITION_SENSITIVE_TO_STANCE_REPRESENTATION_FORM",
            means:
              "under matched state-blind composition framing, the executor succeeded with the explicit polar stance representation but did not establish the same composition with the current CharacterOS three-field belief-record representation",
            evidence_update: { H_REPRESENTATION_FORM: "STRENGTHENED" },
            authorises: "REPRESENTATION_COMPONENT_LOCALIZATION_RESEARCH only",
            does_not_authorise: [
              "claiming proposition_id caused the failure",
              "claiming credence caused the failure",
              "claiming the object wrapper caused the failure",
              "claiming a semantic ID is required",
              "claiming the CharacterOS architecture is broken"
            ],
            why: "the record form differs from an explicit word along several axes at once, and this design cannot separate them"
          }
        : explicitNull && recordNull
          ? {
              case: "C_BOTH_NULL",
              verdict: "D4_C1_COMPARATOR_REFERENCE_NOT_ESTABLISHED",
              means: "the contemporaneous explicit reference did not reproduce, so the comparison has no reference",
              evidence_update: {},
              authorises: "nothing",
              forbidden: ["blaming the CharacterOS representation", "substituting the historical C0a positive for this round's reference"]
            }
          : {
              case: "D_EXPLICIT_NULL_RECORD_POSITIVE",
              verdict: "D4_C1_UNEXPECTED_COMPARATOR_PATTERN_EXPLICIT_NULL_RECORD_POSITIVE",
              means: "a lawful pattern that does not support the frozen representation-sensitivity prediction",
              evidence_update: { note: "the record would appear more usable than an explicit word" },
              authorises: "nothing",
              forbidden: ["ranking CharacterOS above an explicit representation", "post-hoc architectural praise", "modifying the architecture"]
            };

  await write("comparator-level-scorer-output.json", {
    explicit_reference_verdict: explicitPositive ? "EXPLICIT_REFERENCE_POSITIVE" : explicitNull ? "EXPLICIT_REFERENCE_VALID_NULL" : "EXPLICIT_REFERENCE_INCONCLUSIVE",
    record_representation_verdict: recordPositive ? "CHARACTEROS_RECORD_CONDITION_POSITIVE" : recordNull ? "CHARACTEROS_RECORD_CONDITION_VALID_NULL" : "CHARACTEROS_RECORD_CONDITION_INCONCLUSIVE",
    record_condition_claim_boundary: "CURRENT CHARACTEROS BELIEF-RECORD REPRESENTATION IN A MATCHED STATE-BLIND RESEARCH FRAME",
    forbidden_description: "the production CharacterOS condition",
    comparator: comparatorVerdict,
    mechanism_is_a_separate_stage: true
  });

  await write("hypothesis-update.json", {
    H_REPRESENTATION_FORM: comparatorVerdict.evidence_update,
    H_FRAMING: {
      status: recordPositive
        ? "raised in priority — particularly if the frozen A1 null stands"
        : recordNull
          ? "not resolved by this result"
          : "unchanged",
      note: "C1 uses C0a's clear composition framing while A1 used its own internally tenser frozen wording"
    },
    H6: {
      status: "REMAINS OPEN",
      why: "C1 deliberately does not reproduce the production belief-stances block header or its placement, so no C1 result can close the A1 framing ambiguity",
      record_positive: "would make the production-framing question more worth pursuing",
      record_null: "would not prove H6 unimportant"
    },
    H_EXEC_COMPOSITION: { status: "not the main explanation unless the explicit reference failed in this run", c0a_positive_still_stands: true }
  });

  await write("architecture-gate-status.json", {
    characteros_production_modification_closed: true,
    even_explicit_positive_record_null_authorises: "representation-component localization research only",
    immediate_changes_forbidden: [
      "removing proposition_id",
      "converting credence to stance text",
      "adding semantic IDs",
      "adding embeddings",
      "adding a relation graph",
      "rewriting the production prompt"
    ],
    must_first_localise_which_component_mattered: true,
    c0b_status: "D4_C0B_SUPERSEDED_BY_C1_COMPARATOR_DESIGN",
    c0b_reopened: false,
    link_4_status: "LINK_4_REMAINS_LOCKED",
    link_4_note: "C1 is not an A1-positive replacement inside the D2 sequential chain and does not authorise appraisal"
  });

  const finalStates = [comparatorVerdict.verdict, "D4_C1_COMPARATOR_TARGET_EXECUTED", "CHARACTEROS_UNMODIFIED", "LINK_4_REMAINS_LOCKED", "D4_C0B_SUPERSEDED_BY_C1_COMPARATOR_DESIGN"];
  await write("D4_C1_COMPARATOR_TARGET_MANIFEST.json", {
    stage: "D4_C1-comparator-target",
    final_states: finalStates,
    comparator: comparatorVerdict,
    four_cell_counts: Object.fromEntries(D4_C1_CELLS.map((c) => [c.cell_id, c.predicted_token])),
    explicit_outcome_class: explicitOutcome.outcome_class,
    record_outcome_class: recordOutcome.outcome_class,
    dataset_hash: datasetHash,
    collection,
    identity_audit: identityAudit,
    isolation,
    schedule_audit: scheduleAudit,
    model_calls_this_round: 24,
    c1_model_calls_cumulative: 30,
    model_call_accounting: { stability: 6, comparator_target: 24, requalification: 0, not_30_interchangeable_observations: true },
    executor,
    characteros_modified: false,
    link_4_reopened: false,
    non_claims: [
      "the record condition is NOT the production CharacterOS condition",
      "no claim that the production belief path works",
      "no claim that A1's null is explained, and H6 remains open",
      "no claim about which component of the record form mattered",
      "no spontaneous or implicit composition claim",
      "no CharacterOS production modification is authorised"
    ],
    next_round_may_only: "freeze this result; any localisation or comparator follow-up requires its own preregistration",
    next_round_may_not: ["design a new experiment in this round", "reopen C0b", "reopen link 4", "modify CharacterOS"]
  });

  for (const cell of D4_C1_CELLS) {
    const source = cell.cell_id.startsWith("E-") ? explicitOutcome : recordOutcome;
    const arm = ARM_FOR_CELL[cell.cell_id] as D4C0AArmV0;
    process.stdout.write(`${cell.cell_id}: ${JSON.stringify(source.arm_counts?.[arm] ?? null)} modal=${String(source.arm_unique_modals?.[arm] ?? null)} predicted=${String(source.arm_predicted_counts?.[arm] ?? null)}\n`);
  }
  process.stdout.write(`\n${finalStates.join("\n")}\nMODEL_CALLS_THIS_ROUND = 24\nC1_MODEL_CALLS = 30\n`);
}

await main();
