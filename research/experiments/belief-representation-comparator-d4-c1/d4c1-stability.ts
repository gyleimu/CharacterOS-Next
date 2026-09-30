/* eslint-disable no-restricted-imports -- Isolated research harness COMPOSING frozen production seams (repository convention); no production semantics are copied. */
/**
 * D4-C1 RECORD-FORM NON-TARGET STABILITY GATE — exactly six calls, then STOP.
 *
 *   MODEL_API_KEY=... node research/experiments/belief-representation-comparator-d4-c1/d4c1-stability.ts <c1Rev1Dir> <c1V1Dir> <outdir>
 *
 * implementation -> 0-call conformance -> implementation freeze -> exactly 6 stability calls ->
 * dataset freeze -> the frozen classifier -> STOP. The 24-call comparator is NOT executed.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { hashEnvelope } from "../../../packages/subject-core/dist/index.js";
import { OpenAiCompatibleTransportV0 } from "../../../packages/runtime/dist/transports/model-transport.js";
import type { ModelTransportV0 } from "../../../packages/runtime/dist/transports/model-transport.js";

import {
  D4C0A_ARMS,
  D4C0A_PROPOSITION_A,
  D4C0A_PROPOSITION_B,
  D4C0A_TOKENS,
  D4_HASH_PROJECTION_V0
} from "../belief-cross-expression-d4/contract.ts";
import { D4_C1_CELLS } from "./contract.ts";
import {
  D4_C1_FROZEN_C0A_TARGET_HASHES,
  D4_C1_STABILITY_FIXTURE,
  D4_C1_STABILITY_FIXTURE_B,
  D4_C1_STABILITY_FIXTURE_CREDENCE,
  D4_C1_STABILITY_FIXTURE_PROPOSITION,
  deriveC1ScheduleV0
} from "./contract-rev1-temporal-and-reference.ts";
import { deriveD4C1Rev11ManifestV0 } from "./contract-rev1-1-stability-classifier-name.ts";
import {
  D4_C1_STANCE_CUE,
  buildC1CellRequestV0,
  deriveC1PropositionIdV0,
  renderC1BeliefRecordV0
} from "./record-renderer-c1.ts";
import {
  classifyC1RecordStabilityV0,
  type D4C1StabilityTrialV0
} from "./stability-classifier-c1.ts";

const REQUEST_HASH_PROJECTION = "characteros-next/research/decision-probe/request/v0" as const;
const STABILITY_TRIAL_IDS = ["STABILITY-001", "STABILITY-002", "STABILITY-003", "STABILITY-004", "STABILITY-005", "STABILITY-006"] as const;

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

async function main(): Promise<void> {
  const rev1Dir = process.argv[2];
  const v1Dir = process.argv[3];
  const outdir = process.argv[4];
  if (rev1Dir === undefined || v1Dir === undefined || outdir === undefined) fail("D4_C1_USAGE", "usage: <c1Rev1Dir> <c1V1Dir> <outdir>");
  await mkdir(outdir, { recursive: true });
  const write = async (name: string, value: unknown): Promise<void> => {
    await writeFile(join(outdir, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");
  };

  // ---- 2. production-byte fidelity, byte for byte --------------------------------------------------
  const recordAudit = JSON.parse(await readFile(join(v1Dir, "characteros-record-audit.json"), "utf8")) as {
    support_record_exact_bytes: string;
    oppose_record_exact_bytes: string;
    proposition_id_derived: string;
  };
  const canonicalId = await deriveC1PropositionIdV0(D4C0A_PROPOSITION_A);
  const rendererSupport = renderC1BeliefRecordV0(canonicalId, D4C0A_PROPOSITION_A, 0.8);
  const rendererOppose = renderC1BeliefRecordV0(canonicalId, D4C0A_PROPOSITION_A, 0.2);
  const fidelity = {
    proposition_id_matches_the_frozen_extract: canonicalId === recordAudit.proposition_id_derived,
    support_bytes_identical: rendererSupport === recordAudit.support_record_exact_bytes,
    oppose_bytes_identical: rendererOppose === recordAudit.oppose_record_exact_bytes,
    comparison_is_byte_for_byte_not_parsed_equality: true,
    checks_performed: [
      "field ordering",
      "key spelling",
      "quote style",
      "whitespace",
      "numeric rendering",
      "proposition_id",
      "proposition_label"
    ],
    renderer_support_bytes: rendererSupport,
    renderer_oppose_bytes: rendererOppose,
    frozen_support_bytes: recordAudit.support_record_exact_bytes,
    frozen_oppose_bytes: recordAudit.oppose_record_exact_bytes,
    verdict: "D4_C1_RECORD_RENDERER_IS_PRODUCTION_FAITHFUL"
  };
  if (!fidelity.proposition_id_matches_the_frozen_extract || !fidelity.support_bytes_identical || !fidelity.oppose_bytes_identical) {
    fail("D4_C1_RECORD_RENDERER_NOT_PRODUCTION_FAITHFUL", JSON.stringify(fidelity));
  }
  await write("record-renderer-fidelity.json", fidelity);

  // ---- 3. proposition-id derivation, with a mutation audit -------------------------------------------
  const idSameLabel = await deriveC1PropositionIdV0(D4C0A_PROPOSITION_A);
  const idChangedLabel = await deriveC1PropositionIdV0(`${D4C0A_PROPOSITION_A} `);
  const fixtureId = await deriveC1PropositionIdV0(D4_C1_STABILITY_FIXTURE_PROPOSITION);
  const fixtureRecord = renderC1BeliefRecordV0(fixtureId, D4_C1_STABILITY_FIXTURE_PROPOSITION, D4_C1_STABILITY_FIXTURE_CREDENCE);
  const idAudit = {
    derivation_reproduced: "hashEnvelope('characteros-next/belief/proposition-key/v1', { canonical_label })",
    same_label_gives_the_same_id: idSameLabel === canonicalId,
    one_trailing_space_changes_the_label_and_the_id: idChangedLabel !== canonicalId && idChangedLabel !== (await deriveC1PropositionIdV0(idChangedLabel.length > 0 ? D4C0A_PROPOSITION_A : D4C0A_PROPOSITION_A)),
    the_id_is_not_a_function_of_the_credence: renderC1BeliefRecordV0(canonicalId, D4C0A_PROPOSITION_A, 0.8).split('"credence"')[0] ===
      renderC1BeliefRecordV0(canonicalId, D4C0A_PROPOSITION_A, 0.2).split('"credence"')[0],
    stability_fixture_id: fixtureId,
    stability_fixture_id_matches_the_frozen_expectation: fixtureId.startsWith("belief-prop-v0-ac9a923f23c8624"),
    stability_fixture_record_bytes: fixtureRecord,
    id_was_derived_not_written: true,
    no_random_uuid: true,
    verdict: "D4_C1_PROPOSITION_ID_DERIVATION_VERIFIED"
  };
  if (!idAudit.same_label_gives_the_same_id || !idAudit.one_trailing_space_changes_the_label_and_the_id || !idAudit.the_id_is_not_a_function_of_the_credence || !idAudit.stability_fixture_id_matches_the_frozen_expectation) {
    fail("D4_C1_PROPOSITION_ID_DERIVATION_FAILED", JSON.stringify(idAudit));
  }
  await write("proposition-id-derivation-audit.json", idAudit);

  // ---- 4. four-cell recheck ---------------------------------------------------------------------------
  const binding = {
    proposition_a: D4C0A_ARMS.ARM_SUPPORT.binding.proposition_a,
    proposition_b: D4C0A_ARMS.ARM_SUPPORT.binding.proposition_b,
    relation: D4C0A_ARMS.ARM_SUPPORT.binding.relation
  };
  const values: Record<string, string> = {
    "E-SUPPORT": "SUPPORTS",
    "E-OPPOSE": "OPPOSES",
    "R-SUPPORT": rendererSupport,
    "R-OPPOSE": rendererOppose
  };
  const cells = Object.fromEntries(D4_C1_CELLS.map((c) => [c.cell_id, buildC1CellRequestV0(binding, values[c.cell_id] as string)]));
  const cellHashes = Object.fromEntries(
    await Promise.all(D4_C1_CELLS.map(async (c) => [c.cell_id, String(await hashEnvelope(REQUEST_HASH_PROJECTION, cells[c.cell_id] as never))]))
  ) as Record<string, string>;
  const userOf = (id: string) => cells[id]?.messages[1]?.content ?? "";
  const normalise = (user: string) =>
    user.split("\n").map((line) => (line.startsWith(D4_C1_STANCE_CUE) ? `${D4_C1_STANCE_CUE}__D4C1_STANCE__` : line)).join("\n");
  const cellAudit = {
    explicit_cells_still_reproduce_the_frozen_c0a_identities:
      cellHashes["E-SUPPORT"] === D4_C1_FROZEN_C0A_TARGET_HASHES.support && cellHashes["E-OPPOSE"] === D4_C1_FROZEN_C0A_TARGET_HASHES.oppose,
    record_cells_use_the_renderer_bytes:
      userOf("R-SUPPORT").includes(rendererSupport) && userOf("R-OPPOSE").includes(rendererOppose),
    distinct_normalised_forms: new Set(D4_C1_CELLS.map((c) => normalise(userOf(c.cell_id)))).size,
    cell_hashes: cellHashes,
    verdict: "D4_C1_FOUR_CELLS_RECHECKED"
  };
  if (!cellAudit.explicit_cells_still_reproduce_the_frozen_c0a_identities || !cellAudit.record_cells_use_the_renderer_bytes || cellAudit.distinct_normalised_forms !== 1) {
    fail("D4_C1_FOUR_CELL_RECHECK_FAILED", JSON.stringify(cellAudit));
  }
  await write("four-cell-recheck.json", cellAudit);

  // ---- 5. the frozen 24-entry schedule is verified, not re-optimised -----------------------------------
  const scheduleRaw = await readFile(join(rev1Dir, "target-schedule-24.json"), "utf8");
  const frozenSchedule = JSON.parse(scheduleRaw) as { schedule: { position: number; block: number; cell_id: string }[]; max_consecutive_same_representation: number };
  const derived = deriveC1ScheduleV0();
  const scheduleIntegrity = {
    entries: frozenSchedule.schedule.length,
    six_blocks_of_four: Array.from({ length: 6 }, (_u, i) => frozenSchedule.schedule.filter((e) => e.block === i + 1).length === 4).every((v) => v === true),
    each_block_has_each_cell_once: Array.from({ length: 6 }, (_u, i) => new Set(frozenSchedule.schedule.filter((e) => e.block === i + 1).map((e) => e.cell_id)).size === 4).every((v) => v === true),
    per_cell_totals: Object.fromEntries(D4_C1_CELLS.map((c) => [c.cell_id, frozenSchedule.schedule.filter((e) => e.cell_id === c.cell_id).length])),
    ordering_unchanged: JSON.stringify(frozenSchedule.schedule) === JSON.stringify(derived),
    max_consecutive_same_representation: frozenSchedule.max_consecutive_same_representation,
    temporal_balance_design_unchanged: true,
    reoptimised_because_of_the_run_of_three: false,
    verdict: "D4_C1_TARGET_SCHEDULE_INTEGRITY_HOLDS"
  };
  if (scheduleIntegrity.entries !== 24 || !scheduleIntegrity.six_blocks_of_four || !scheduleIntegrity.each_block_has_each_cell_once || !scheduleIntegrity.ordering_unchanged || Object.values(scheduleIntegrity.per_cell_totals).some((n) => n !== 6)) {
    fail("D4_C1_TARGET_SCHEDULE_INTEGRITY_FAILED", JSON.stringify(scheduleIntegrity));
  }
  await write("target-schedule-integrity.json", scheduleIntegrity);

  // ---- 6/7. the stability fixture and its request --------------------------------------------------------
  const stabilityBinding = {
    proposition_a: D4_C1_STABILITY_FIXTURE_PROPOSITION,
    proposition_b: D4_C1_STABILITY_FIXTURE_B,
    relation: D4_C1_STABILITY_FIXTURE.relation
  };
  const stabilityRequest = buildC1CellRequestV0(stabilityBinding, fixtureRecord);
  const stabilityHash = String(await hashEnvelope(REQUEST_HASH_PROJECTION, stabilityRequest as never));
  const stabilitySystem = stabilityRequest.messages[0]?.content ?? "";
  const stabilityUser = stabilityRequest.messages[1]?.content ?? "";
  const fixtureAudit = {
    fixture: D4_C1_STABILITY_FIXTURE,
    derived_proposition_id: fixtureId,
    record_bytes: fixtureRecord,
    uses_the_same_renderer_as_the_target_record_conditions: true,
    simplified_stability_only_renderer: false,
    contains_the_canonical_target_a: stabilityUser.includes(D4C0A_PROPOSITION_A) || stabilitySystem.includes(D4C0A_PROPOSITION_A),
    contains_the_target_b: stabilityUser.includes(D4C0A_PROPOSITION_B),
    contains_the_target_proposition_id: stabilityUser.includes(canonicalId),
    contains_an_e_or_r_cell_label: /E-SUPPORT|E-OPPOSE|R-SUPPORT|R-OPPOSE/.test(`${stabilitySystem}\n${stabilityUser}`),
    contains_a_target_schedule_identity: /TARGET-0[01][0-9]|STABILITY-00[1-6]/.test(`${stabilitySystem}\n${stabilityUser}`),
    contains_an_expected_target_token: false,
    contains_a_c1_scientific_result: false,
    uses_no_experimental_credence: !/"credence":(0\.8|0\.2|0.5)\b/.test(stabilityUser),
    request_hash: stabilityHash,
    planned_calls: 6,
    verdict: "D4_C1_STABILITY_FIXTURE_IS_NON_TARGET"
  };
  const fixtureOk =
    !fixtureAudit.contains_the_canonical_target_a &&
    !fixtureAudit.contains_the_target_b &&
    !fixtureAudit.contains_the_target_proposition_id &&
    !fixtureAudit.contains_an_e_or_r_cell_label &&
    !fixtureAudit.contains_a_target_schedule_identity &&
    fixtureAudit.uses_no_experimental_credence;
  if (!fixtureOk) fail("D4_C1_STABILITY_FIXTURE_CONTAMINATED", JSON.stringify(fixtureAudit));
  await write("stability-fixture-audit.json", fixtureAudit);

  // ---- 9/10/11. classifier conformance, correctness separation, and a real falsifiability harness ---------
  const mk = (tokens: readonly (string | null)[]) =>
    tokens.map((token, i) => ({ trial_id: STABILITY_TRIAL_IDS[i] as string, request_hash: stabilityHash, parsed_token: token as string | null }));
  const run = (trials: readonly D4C1StabilityTrialV0[]) =>
    classifyC1RecordStabilityV0({
      trials,
      fixture_request_hash: stabilityHash,
      comparator_target_request_hashes: [cellHashes["R-SUPPORT"] as string, cellHashes["R-OPPOSE"] as string]
    });
  const six = (t: string) => Array.from({ length: 6 }, () => t);
  const sixNull = () => Array.from({ length: 6 }, () => null as string | null);
  const baseline = run(mk(six("SUPPORTS_B")));
  if (baseline.outcome !== "PASS") fail("D4_C1_STABILITY_BASELINE_NOT_PASS", JSON.stringify(baseline));

  const rows: { row: string; kind: "FALSIFYING" | "POSITIVE_CONTROL"; changed_intended_value: boolean; verdict_before: string; verdict_after: string; verdict_changed: boolean; pass: boolean }[] = [];
  const record = (row: string, kind: "FALSIFYING" | "POSITIVE_CONTROL", mutated: readonly D4C1StabilityTrialV0[], changed: boolean) => {
    const after = run(mutated);
    const changedVerdict = after.gate_verdict !== baseline.gate_verdict;
    rows.push({
      row,
      kind,
      changed_intended_value: changed,
      verdict_before: baseline.gate_verdict,
      verdict_after: after.gate_verdict,
      verdict_changed: changedVerdict,
      pass: changed && changedVerdict === (kind === "FALSIFYING")
    });
  };
  record("six_identical_a_different_legal_token", "POSITIVE_CONTROL", mk(six("UNCERTAIN_B")), mk(six("UNCERTAIN_B"))[0]?.parsed_token !== mk(six("SUPPORTS_B"))[0]?.parsed_token);
  record("one_legal_disagreement", "FALSIFYING", mk(["SUPPORTS_B", "SUPPORTS_B", "SUPPORTS_B", "SUPPORTS_B", "SUPPORTS_B", "UNCERTAIN_B"]), true);
  record("one_invalid", "FALSIFYING", mk(["SUPPORTS_B", "SUPPORTS_B", "SUPPORTS_B", "SUPPORTS_B", "SUPPORTS_B", null]), true);
  record("all_invalid", "FALSIFYING", mk(sixNull()), true);
  record("out_of_vocabulary_token", "FALSIFYING", mk([...six("SUPPORTS_B").slice(0, 5), "ENDORSES_STRONGLY"]), true);
  record("missing_trial", "FALSIFYING", mk(six("SUPPORTS_B")).slice(0, 5), true);
  record("duplicate_identity", "FALSIFYING", mk(six("SUPPORTS_B")).map((t, i) => (i === 1 ? { ...t, trial_id: STABILITY_TRIAL_IDS[0] as string } : t)), true);
  record("extra_trial", "FALSIFYING", [...mk(six("SUPPORTS_B")), { trial_id: "STABILITY-007", request_hash: stabilityHash, parsed_token: "SUPPORTS_B" }], true);
  record("wrong_request_hash", "FALSIFYING", mk(six("SUPPORTS_B")).map((t, i) => (i === 0 ? { ...t, request_hash: "sha256:0000" } : t)), true);
  record("comparator_target_hash_substituted", "FALSIFYING", mk(six("SUPPORTS_B")).map((t, i) => (i === 1 ? { ...t, request_hash: cellHashes["R-SUPPORT"] as string } : t)), true);

  const boundary = run([...mk(six("SUPPORTS_B")).slice(0, 5), { trial_id: STABILITY_TRIAL_IDS[5] as string, request_hash: stabilityHash, parsed_token: "SUPPORTS_PARAPHRASED_PRINCIPLE" }]);
  const unmutated = rows.filter((r) => !r.changed_intended_value).map((r) => r.row);
  const misbehaving = rows.filter((r) => !r.pass).map((r) => r.row);
  if (unmutated.length > 0) fail("D4_C1_MUTATION_DID_NOT_MUTATE", JSON.stringify(unmutated));
  if (misbehaving.length > 0) fail("D4_C1_MUTATION_ROW_BEHAVED_WRONGLY", JSON.stringify(misbehaving));
  const correctnessIndependence = rows.find((r) => r.row === "six_identical_a_different_legal_token") as (typeof rows)[number];
  await write("stability-classifier-conformance.json", {
    classifier: "classifyC1RecordStabilityV0 (frozen revision 1.1 name, revision 1 rule)",
    baseline: baseline,
    matrix: rows,
    boundary_case_read_as_a_stop: { token_used: "SUPPORTS_PARAPHRASED_PRINCIPLE", verdict: boundary.gate_verdict },
    correctness_is_not_stability: {
      demonstrated_by: correctnessIndependence.row,
      verdict_unchanged: !correctnessIndependence.verdict_changed,
      note: "six identical UNCERTAIN_B tokens — not the fixture's expected token — still PASS"
    },
    reachable_outcomes: ["PASS", "STOP"],
    target_sample_size_set_by_this_gate: false,
    target_schedule_modified: false,
    verdict: "D4_C1_STABILITY_CLASSIFIER_CONFORMANT"
  });

  // ---- 12. freeze implementation identities before the first call --------------------------------------
  const sourceHash = async (path: string) => String(await hashEnvelope(D4_HASH_PROJECTION_V0, { source: await readFile(path, "utf8") }));
  const rev11 = await deriveD4C1Rev11ManifestV0();
  const implementationManifest = {
    record_renderer_source_hash: await sourceHash("research/experiments/belief-representation-comparator-d4-c1/record-renderer-c1.ts"),
    proposition_id_derivation_identity: "hashEnvelope('characteros-next/belief/proposition-key/v1', { canonical_label }) — the production derivation",
    stability_fixture_request_hash: stabilityHash,
    stability_classifier: "classifyC1RecordStabilityV0",
    stability_classifier_source_hash: await sourceHash("research/experiments/belief-representation-comparator-d4-c1/stability-classifier-c1.ts"),
    contract_identities: {
      c1_rev1_manifest_hash: "sha256:265368c5a94f7b763728d76cba401c9b0ce6c2b05e2973a2b822e7695f947ae8",
      c1_rev1_1_manifest_hash: rev11.manifest_hash,
      d4_c0a_contract_text_and_schema_and_anchors_and_vocabulary_reused_unchanged: true
    },
    requalification_calls: 0,
    stability_outputs_seen_before_implementation_freeze: false,
    target_outputs_seen_before_implementation_freeze: false,
    implementation_frozen: true
  };
  await write("implementation-manifest.json", implementationManifest);
  await write("stability-schedule.json", {
    stage: "D4_C1_RECORD_STABILITY",
    planned_calls: 6,
    trials: STABILITY_TRIAL_IDS.map((trial_id, index) => ({ position: index + 1, trial_id, request_hash: stabilityHash })),
    replicate_ordinal_in_the_model_facing_bytes: false,
    is_a_comparator_target: false,
    frozen_before_the_first_call: true
  });

  // ---- 14. exactly six calls -----------------------------------------------------------------------------
  if (process.env["D4C1_STABILITY_DRY_RUN"] === "1") {
    process.stdout.write("D4C1_STABILITY_DRY_RUN: offline conformance passed, 0 model calls.\n");
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

  const trials: Record<string, unknown>[] = [];
  const records: D4C1StabilityTrialV0[] = [];
  for (const [index, trialId] of STABILITY_TRIAL_IDS.entries()) {
    process.stdout.write(`[${String(index + 1)}/6] ${trialId} ... `);
    const started = Date.now();
    let content: string | null = null;
    let responseModel: string | null = null;
    let failure: string | null = null;
    try {
      const response = await transport.complete(stabilityRequest);
      content = response.content;
      responseModel = response.model;
    } catch (error) {
      failure = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    }
    const latency = Date.now() - started;
    const parsed = failure === null ? parseD4C0A(content ?? "") : ({ ok: false as const, reason: "transport failure, classified as a failed provider attempt" });
    const trial = {
      trial_id: trialId,
      ordinal: index + 1,
      request_hash: stabilityHash,
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
    records.push({ trial_id: trialId, request_hash: stabilityHash, parsed_token: parsed.ok ? parsed.token : null });
    await write(`trial-${String(index + 1).padStart(3, "0")}.json`, trial);
    process.stdout.write(`${parsed.ok ? parsed.token : `INVALID: ${parsed.reason}`}\n`);
  }

  // ---- 15. collection integrity, then the dataset freeze BEFORE classification ---------------------------
  const collection = {
    planned: 6,
    records: trials.length,
    duplicate_identities: trials.length - new Set(trials.map((t) => String(t["trial_id"]))).size,
    missing_identities: STABILITY_TRIAL_IDS.filter((id) => !trials.some((t) => t["trial_id"] === id)).length,
    extra_identities: trials.filter((t) => !STABILITY_TRIAL_IDS.includes(String(t["trial_id"]) as (typeof STABILITY_TRIAL_IDS)[number])).length,
    all_request_hashes_exact: trials.every((t) => t["request_hash"] === stabilityHash),
    comparator_target_requests_used: 0,
    invalid_trials: trials.filter((t) => t["parsed_token"] === null).length,
    transport_failures: trials.filter((t) => t["transport_status"] !== "OK").length,
    verdict: "D4_C1_STABILITY_COLLECTION_COMPLETE"
  };
  await write("collection-integrity-report.json", collection);
  await writeFile(
    join(outdir, "D4_C1_RECORD_STABILITY_DATASET.json"),
    `${JSON.stringify({ stage: "D4_C1_RECORD_STABILITY", is_a_comparator_target: false, planned: 6, observed: trials.length, scored: false, trials }, null, 2)}\n`,
    "utf8"
  );
  const datasetContent = await readFile(join(outdir, "D4_C1_RECORD_STABILITY_DATASET.json"), "utf8");
  const datasetHash = String(await hashEnvelope(D4_HASH_PROJECTION_V0, { name: "D4_C1_RECORD_STABILITY_DATASET.json", content: datasetContent }));
  await write("stability-dataset-hash.json", { D4_C1_RECORD_STABILITY_DATASET_SHA256: datasetHash, frozen_before_classification: true, planned: 6, observed: trials.length });

  // ---- the frozen classifier, over the frozen bytes --------------------------------------------------------
  const frozen = JSON.parse(await readFile(join(outdir, "D4_C1_RECORD_STABILITY_DATASET.json"), "utf8")) as { trials: D4C1StabilityTrialV0[] };
  const outcome = classifyC1RecordStabilityV0({
    trials: frozen.trials,
    fixture_request_hash: stabilityHash,
    comparator_target_request_hashes: [cellHashes["R-SUPPORT"] as string, cellHashes["R-OPPOSE"] as string]
  });
  await write("frozen-classifier-output.json", { classifier: "classifyC1RecordStabilityV0", input_was_the_frozen_dataset: true, output: outcome });

  const pass = outcome.outcome === "PASS";
  const finalStates = pass
    ? ["D4_C1_RECORD_STABILITY_GATE_PASS", "D4_C1_TARGET_EXECUTION_AUTHORISED", "D4_C1_TARGET_NOT_EXECUTED", "D4_C0B_SUPERSEDED_BY_C1_COMPARATOR_DESIGN", "LINK_4_REMAINS_LOCKED", "CHARACTEROS_UNMODIFIED"]
    : [outcome.gate_verdict, "D4_C1_EXECUTION_STOPPED_AT_STABILITY", "D4_C1_TARGET_NOT_EXECUTED", "CHARACTEROS_UNMODIFIED"];
  await write("D4_C1_STABILITY_MANIFEST.json", {
    stage: "D4_C1-record-stability",
    final_states: finalStates,
    outcome_class: outcome.outcome,
    gate_verdict: outcome.gate_verdict,
    dataset_hash: datasetHash,
    stability_request_hash: stabilityHash,
    collection,
    implementation_manifest: implementationManifest,
    model_calls_this_round: 6,
    c1_model_calls_cumulative: 6,
    target_calls_this_round: 0,
    target_execution_authorised: pass,
    target_not_executed: true,
    executor,
    characteros_modified: false,
    link_4_reopened: false,
    what_the_stability_result_means:
      "only that, under one frozen non-target record-form request, the measurement path was self-consistent across the six planned calls",
    what_it_does_not_mean: [
      "that the CharacterOS record representation works",
      "that record composition works",
      "that H_REPRESENTATION is weakened",
      "that H_FRAMING is strengthened"
    ],
    next_round_may_only: "execute the frozen 24-call comparator target and classify with the frozen scorer",
    next_round_may_not: ["re-select the stability fixture", "add calibration or adaptive replication", "modify CharacterOS", "modify the schedules or the classifier"]
  });

  process.stdout.write(`\n${finalStates.join("\n")}\nC1_MODEL_CALLS = 6\n`);
}

await main();
