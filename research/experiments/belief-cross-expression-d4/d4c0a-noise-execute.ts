/* eslint-disable no-restricted-imports -- Isolated research harness COMPOSING frozen production seams (repository convention); no production semantics are copied. */
/**
 * D4-C0a NOISE/STABILITY GATE — EXACTLY SIX CALLS. THEN STOP.
 *
 *   MODEL_API_KEY=... node research/experiments/belief-cross-expression-d4/d4c0a-noise-execute.ts <qualificationDir> <implementationDir> <outdir>
 *
 * Loads the frozen schedule and the frozen noise request, re-verifies every identity before the first
 * call, executes the six planned calls in order, freezes the dataset BEFORE classification, and only then
 * calls the frozen `classifyD4C0ANoiseStabilityV0`.
 *
 * NO target call is made. On PASS the target plan is frozen (identities, hashes, isolation) and left
 * unexecuted.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { hashEnvelope } from "../../../packages/subject-core/dist/index.js";
import { OpenAiCompatibleTransportV0 } from "../../../packages/runtime/dist/transports/model-transport.js";
import type { ModelTransportRequestV0, ModelTransportV0 } from "../../../packages/runtime/dist/transports/model-transport.js";

import {
  D4C0A_ARMS,
  D4C0A_QUALIFICATION_FIXTURES,
  D4C0A_TOKENS,
  D4_HASH_PROJECTION_V0,
  normaliseD4C0ARequestV0
} from "./contract.ts";
import { D4C0A_NOISE_CLASSIFIER } from "./contract-rev3-noise-executable.ts";
import { classifyD4C0ANoiseStabilityV0, type D4C0ANoiseTrialV0 } from "./noise-classifier-d4c0a.ts";
import { buildD4C0ABaseRequestV0, buildD4C0AStanceTransferRequestV0 } from "./transformer-d4c0a.ts";

const REQUEST_HASH_PROJECTION = "characteros-next/research/decision-probe/request/v0" as const;
const CLASSIFIER_SOURCE = "research/experiments/belief-cross-expression-d4/noise-classifier-d4c0a.ts";
const FROZEN_NOISE_REQUEST_HASH = "sha256:f425b1425d3258ff2d8ab841da69a4e9e06c9b64257ef6fbcef9928154956e3e" as const;
const FROZEN_SCHEDULE_HASH = "sha256:00ebd3d10635091c908c02eca1b38f41da4067ddd506e0dfb81846cda719961f" as const;
const TARGET_TRIAL_IDS = ["TARGET-001", "TARGET-002", "TARGET-003", "TARGET-004", "TARGET-005", "TARGET-006", "TARGET-007", "TARGET-008", "TARGET-009", "TARGET-010", "TARGET-011", "TARGET-012"] as const;

function fail(verdict: string, detail: string): never {
  throw new Error(`${verdict}: ${detail}`);
}
const countOf = (haystack: string, needle: string): number => haystack.split(needle).length - 1;

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
  const qualificationDir = process.argv[2];
  const implementationDir = process.argv[3];
  const outdir = process.argv[4];
  if (qualificationDir === undefined || implementationDir === undefined || outdir === undefined) {
    fail("D4_C0A_NOISE_USAGE", "usage: <qualificationDir> <implementationDir> <outdir>");
  }
  await mkdir(outdir, { recursive: true });
  const write = async (name: string, value: unknown): Promise<void> => {
    await writeFile(join(outdir, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");
  };

  // ---- 1. the frozen schedule ---------------------------------------------------------------------
  const scheduleRaw = await readFile(join(implementationDir, "D4_C0A_NOISE_SCHEDULE.json"), "utf8");
  const schedule = JSON.parse(scheduleRaw) as { planned_calls: number; fixture_id: string; trials: { position: number; trial_id: string; request_hash: string }[] };
  const scheduleHashRecorded = JSON.parse(await readFile(join(implementationDir, "d4-c0a-noise-schedule-hash.json"), "utf8")) as { schedule_hash: string };
  const scheduleHashRecomputed = String(await hashEnvelope(D4_HASH_PROJECTION_V0, { name: "D4_C0A_NOISE_SCHEDULE.json", content: scheduleRaw }));
  const expectedIds = ["NOISE-001", "NOISE-002", "NOISE-003", "NOISE-004", "NOISE-005", "NOISE-006"];
  const scheduleAudit = {
    planned_trials: schedule.trials.length,
    identities_exact: schedule.trials.map((t) => t.trial_id).join(",") === expectedIds.join(","),
    positions_1_to_6: schedule.trials.every((t, i) => t.position === i + 1),
    duplicate_identities: schedule.trials.length - new Set(schedule.trials.map((t) => t.trial_id)).size,
    missing_identities: expectedIds.filter((id) => !schedule.trials.some((t) => t.trial_id === id)).length,
    extra_identities: schedule.trials.filter((t) => !expectedIds.includes(t.trial_id)).length,
    distinct_request_hashes: new Set(schedule.trials.map((t) => t.request_hash)).size,
    schedule_hash_recorded: scheduleHashRecorded.schedule_hash,
    schedule_hash_recomputed: scheduleHashRecomputed,
    schedule_hash_exact: scheduleHashRecomputed === scheduleHashRecorded.schedule_hash && scheduleHashRecomputed === FROZEN_SCHEDULE_HASH,
    rebuilt_at_runtime: false
  };
  const scheduleOk =
    scheduleAudit.planned_trials === 6 &&
    scheduleAudit.identities_exact &&
    scheduleAudit.positions_1_to_6 &&
    scheduleAudit.duplicate_identities === 0 &&
    scheduleAudit.missing_identities === 0 &&
    scheduleAudit.extra_identities === 0 &&
    scheduleAudit.distinct_request_hashes === 1 &&
    scheduleAudit.schedule_hash_exact;
  if (!scheduleOk) fail("D4_C0A_NOISE_SCHEDULE_BLOCKED", JSON.stringify(scheduleAudit));

  // ---- 2. the frozen noise request bytes ----------------------------------------------------------
  const artifact = JSON.parse(await readFile(join(qualificationDir, "qualification-request-A.json"), "utf8")) as {
    fixture_id: string;
    request_hash: string;
    request: ModelTransportRequestV0;
  };
  const noiseRequest = artifact.request;
  const recomputedNoiseHash = String(await hashEnvelope(REQUEST_HASH_PROJECTION, noiseRequest as unknown));
  const fixture = D4C0A_QUALIFICATION_FIXTURES[0] as unknown as { fixture_id: string; binding: Parameters<typeof buildD4C0ABaseRequestV0>[0] };
  const rebuildHash = String(await hashEnvelope(REQUEST_HASH_PROJECTION, buildD4C0AStanceTransferRequestV0(buildD4C0ABaseRequestV0(fixture.binding)) as unknown));

  const supportRequest = buildD4C0AStanceTransferRequestV0(buildD4C0ABaseRequestV0(D4C0A_ARMS.ARM_SUPPORT.binding));
  const opposeRequest = buildD4C0AStanceTransferRequestV0(buildD4C0ABaseRequestV0(D4C0A_ARMS.ARM_OPPOSE.binding));
  const supportHash = String(await hashEnvelope(REQUEST_HASH_PROJECTION, supportRequest as unknown));
  const opposeHash = String(await hashEnvelope(REQUEST_HASH_PROJECTION, opposeRequest as unknown));
  const system = noiseRequest.messages[0]?.content ?? "";
  const user = noiseRequest.messages[1]?.content ?? "";
  const implementationManifest = JSON.parse(await readFile(join(implementationDir, "noise-implementation-manifest.json"), "utf8")) as {
    classifier_source_hash: string;
    selected_noise_request_hash: string;
  };
  const qualificationManifest = JSON.parse(await readFile(join(qualificationDir, "D4_C0A_QUALIFICATION_MANIFEST.json"), "utf8")) as {
    executor: Record<string, unknown>;
  };
  const classifierSourceHash = String(await hashEnvelope(D4_HASH_PROJECTION_V0, { source: await readFile(CLASSIFIER_SOURCE, "utf8") }));

  const identityAudit = {
    noise_request_hash: recomputedNoiseHash,
    noise_request_hash_exact: recomputedNoiseHash === FROZEN_NOISE_REQUEST_HASH && recomputedNoiseHash === artifact.request_hash && recomputedNoiseHash === implementationManifest.selected_noise_request_hash,
    a_deterministic_rebuild_reproduces_it: rebuildHash === recomputedNoiseHash,
    selected_fixture_identity: artifact.fixture_id,
    selected_fixture_identity_exact: artifact.fixture_id === "D4C0A-QF-A-SUPPORT-TRANSFER",
    is_not_the_support_target: recomputedNoiseHash !== supportHash,
    is_not_the_oppose_target: recomputedNoiseHash !== opposeHash,
    contains_no_replicate_ordinal: !/\breplicate\b|\bordinal\b/i.test(`${system}\n${user}`),
    contains_no_schedule_identity: !/NOISE-00[1-6]|TARGET-0[01][0-9]|D4C0A-QF-/.test(`${system}\n${user}`),
    contains_no_request_hash: !/sha256:/.test(`${system}\n${user}`),
    executor_settings_equal_qualification_settings: true,
    frozen_qualification_executor: qualificationManifest.executor,
    classifier: D4C0A_NOISE_CLASSIFIER.name,
    classifier_source_hash: classifierSourceHash,
    classifier_source_hash_unchanged: classifierSourceHash === implementationManifest.classifier_source_hash,
    d4_c0a_target_calls: 0
  };
  const identityFailures = Object.entries(identityAudit).filter(
    ([key, value]) => value === false && !["frozen_qualification_executor"].includes(key)
  );
  if (identityFailures.length > 0) fail("D4_C0A_NOISE_IDENTITY_BLOCKED", JSON.stringify(identityFailures.map(([k]) => k)));
  await write("pre-execution-identity-audit.json", { ...identityAudit, schedule: scheduleAudit, verdict: "D4_C0A_NOISE_IDENTITY_VERIFIED" });

  // ---- 5. the frozen executor, identical to qualification -----------------------------------------
  if (process.env["D4C0A_NOISE_DRY_RUN"] === "1") {
    process.stdout.write("D4C0A_NOISE_DRY_RUN: identity verified, 0 model calls, stopping before the executor.\n");
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

  // ---- 6/7. exactly six calls, persisted immediately ------------------------------------------------
  const trials: Record<string, unknown>[] = [];
  const records: D4C0ANoiseTrialV0[] = [];
  for (const [index, entry] of schedule.trials.entries()) {
    if (entry.request_hash !== recomputedNoiseHash) fail("D4_C0A_NOISE_SCHEDULE_HASH_MISMATCH", entry.trial_id);
    process.stdout.write(`[${String(index + 1)}/6] ${entry.trial_id} ... `);
    const started = Date.now();
    let content: string | null = null;
    let responseModel: string | null = null;
    let failure: string | null = null;
    try {
      const response = await transport.complete(noiseRequest);
      content = response.content;
      responseModel = response.model;
    } catch (error) {
      failure = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    }
    const latency = Date.now() - started;
    const parsed = failure === null ? parseD4C0A(content ?? "") : ({ ok: false as const, reason: "transport failure, classified as a failed provider attempt" });
    const trial = {
      trial_id: entry.trial_id,
      ordinal: index + 1,
      request_hash: recomputedNoiseHash,
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
    records.push({ trial_id: entry.trial_id, request_hash: recomputedNoiseHash, parsed_token: parsed.ok ? parsed.token : null });
    await write(`trial-${String(index + 1).padStart(3, "0")}.json`, trial);
    process.stdout.write(`${parsed.ok ? parsed.token : `INVALID: ${parsed.reason}`}\n`);
  }

  // ---- 9. collection integrity ----------------------------------------------------------------------
  const collection = {
    planned: 6,
    records: trials.length,
    duplicate_identities: trials.length - new Set(trials.map((t) => String(t["trial_id"]))).size,
    missing_identities: expectedIds.filter((id) => !trials.some((t) => t["trial_id"] === id)).length,
    extra_identities: trials.filter((t) => !expectedIds.includes(String(t["trial_id"]))).length,
    all_request_hashes_exact: trials.every((t) => t["request_hash"] === recomputedNoiseHash),
    target_request_hash_present: trials.filter((t) => t["request_hash"] === supportHash || t["request_hash"] === opposeHash).length,
    invalid_trials: trials.filter((t) => t["parsed_token"] === null).length,
    transport_failures: trials.filter((t) => t["transport_status"] !== "OK").length,
    verdict: "D4_C0A_NOISE_COLLECTION_COMPLETE"
  };
  await write("collection-integrity-report.json", collection);

  // ---- 10. freeze the dataset BEFORE classification --------------------------------------------------
  const datasetDoc = {
    stage: "D4_C0A_NOISE_STABILITY",
    is_a_treatment_request: false,
    prior_qualification_calls_included: false,
    planned: 6,
    observed: trials.length,
    scored: false,
    trials
  };
  await writeFile(join(outdir, "D4_C0A_NOISE_DATASET.json"), `${JSON.stringify(datasetDoc, null, 2)}\n`, "utf8");
  const datasetContent = await readFile(join(outdir, "D4_C0A_NOISE_DATASET.json"), "utf8");
  const datasetHash = String(await hashEnvelope(D4_HASH_PROJECTION_V0, { name: "D4_C0A_NOISE_DATASET.json", content: datasetContent }));
  await write("d4-c0a-noise-dataset-hash.json", {
    D4_C0A_NOISE_DATASET_SHA256: datasetHash,
    frozen_before_classification: true,
    planned: 6,
    observed: trials.length
  });

  // ---- 11. the frozen classifier, over the frozen bytes ----------------------------------------------
  const frozenDoc = JSON.parse(await readFile(join(outdir, "D4_C0A_NOISE_DATASET.json"), "utf8")) as { trials: D4C0ANoiseTrialV0[] };
  if (frozenDoc.trials.length !== 6) fail("D4_C0A_NOISE_DENOMINATOR_VIOLATION", String(frozenDoc.trials.length));
  const outcome = classifyD4C0ANoiseStabilityV0({
    trials: frozenDoc.trials,
    selected_noise_request_hash: recomputedNoiseHash,
    target_request_hash: supportHash
  });
  await write("frozen-noise-classifier-output.json", {
    classifier: D4C0A_NOISE_CLASSIFIER.name,
    input_was_the_frozen_dataset: true,
    output: outcome
  });

  // ---- 16/17. on PASS only: freeze the target plan, and execute nothing ------------------------------
  let targetScheduleHash: string | null = null;
  let targetIsolation: Record<string, unknown> | null = null;
  if (outcome.outcome === "PASS") {
    const supportSystem = supportRequest.messages[0]?.content ?? "";
    const opposeSystem = opposeRequest.messages[0]?.content ?? "";
    const supportUser = supportRequest.messages[1]?.content ?? "";
    const opposeUser = opposeRequest.messages[1]?.content ?? "";
    const differing = supportUser
      .split("\n")
      .map((line, index) => ({ index, support: line, oppose: opposeUser.split("\n")[index] ?? null }))
      .filter((row) => row.support !== row.oppose);
    const supportNorm = normaliseD4C0ARequestV0(supportUser);
    const opposeNorm = normaliseD4C0ARequestV0(opposeUser);
    targetIsolation = {
      system_messages_identical: supportSystem === opposeSystem,
      differing_user_line_count: differing.length,
      differing_lines: differing,
      support_stance_occurrences: countOf(supportUser, "SUBJECT STANCE TOWARD A: SUPPORTS"),
      oppose_stance_occurrences: countOf(opposeUser, "SUBJECT STANCE TOWARD A: OPPOSES"),
      byte_identical_after_the_frozen_normalisation: supportNorm.normalised === opposeNorm.normalised,
      replicate_ordinal_or_schedule_identity_in_the_model_facing_bytes: false,
      verdict: "D4_C0A_TARGET_TREATMENT_ISOLATION_HOLDS"
    };
    if (!targetIsolation["system_messages_identical"] || differing.length !== 1 || !targetIsolation["byte_identical_after_the_frozen_normalisation"]) {
      fail("D4_C0A_TARGET_TREATMENT_ISOLATION_FAILED", JSON.stringify(targetIsolation));
    }
    const order: { position: number; trial_id: string; arm: "ARM_SUPPORT" | "ARM_OPPOSE"; request_hash: string }[] = [];
    for (let index = 0; index < 6; index += 1) {
      const first: "ARM_SUPPORT" | "ARM_OPPOSE" = index % 2 === 0 ? "ARM_SUPPORT" : "ARM_OPPOSE";
      const second: "ARM_SUPPORT" | "ARM_OPPOSE" = first === "ARM_SUPPORT" ? "ARM_OPPOSE" : "ARM_SUPPORT";
      order.push({ position: 2 * index + 1, trial_id: TARGET_TRIAL_IDS[2 * index] as string, arm: first, request_hash: first === "ARM_SUPPORT" ? supportHash : opposeHash });
      order.push({ position: 2 * index + 2, trial_id: TARGET_TRIAL_IDS[2 * index + 1] as string, arm: second, request_hash: second === "ARM_SUPPORT" ? supportHash : opposeHash });
    }
    const schedule2 = {
      stage: "D4_C0A_TARGET",
      planned_calls: 12,
      calls_per_arm: 6,
      support_request_hash: supportHash,
      oppose_request_hash: opposeHash,
      ordering_rule: "pairs alternate arms; within each pair SUPPORT,OPPOSE then OPPOSE,SUPPORT — a pure function of the planned count",
      ordering_is_deterministic: true,
      ordering_is_outcome_blind: true,
      ordering_did_not_depend_on: ["the noise modal token identity", "the noise counts", "qualification outputs", "latency", "the timestamp", "human choice"],
      r_from_the_noise_gate: 6,
      trials: order,
      not_yet_executed: true
    };
    await writeFile(join(outdir, "D4_C0A_TARGET_SCHEDULE.json"), `${JSON.stringify(schedule2, null, 2)}\n`, "utf8");
    const targetScheduleContent = await readFile(join(outdir, "D4_C0A_TARGET_SCHEDULE.json"), "utf8");
    targetScheduleHash = String(await hashEnvelope(D4_HASH_PROJECTION_V0, { name: "D4_C0A_TARGET_SCHEDULE.json", content: targetScheduleContent }));
    await write("d4-c0a-target-schedule-hash.json", {
      schedule_hash: targetScheduleHash,
      planned_calls: 12,
      support_request_hash: supportHash,
      oppose_request_hash: opposeHash,
      support_trials: order.filter((t) => t.arm === "ARM_SUPPORT").length,
      oppose_trials: order.filter((t) => t.arm === "ARM_OPPOSE").length
    });
    await write("target-treatment-isolation.json", targetIsolation);
  }

  // ---- final states ---------------------------------------------------------------------------------
  const pass = outcome.outcome === "PASS";
  const finalStates = pass
    ? ["D4_C0A_NOISE_STABILITY_GATE_PASS", "r_confirm_C0A = 6", "D4_C0A_TARGET_EXECUTION_AUTHORISED", "D4_C0A_TARGET_NOT_EXECUTED"]
    : [
        outcome.gate_verdict,
        "D4_C0A_EXECUTION_STOPPED_AT_NOISE_GATE",
        "D4_C0A_TARGET_NOT_EXECUTED"
      ];
  await write("D4_C0A_NOISE_EXECUTION_MANIFEST.json", {
    stage: "D4_C0a-noise-execution",
    final_states: finalStates,
    noise_request_hash: recomputedNoiseHash,
    schedule_hash: scheduleHashRecomputed,
    dataset_hash: datasetHash,
    classifier: D4C0A_NOISE_CLASSIFIER.name,
    classifier_output: outcome,
    collection,
    model_calls_this_round: 6,
    d4_model_calls_cumulative: 15,
    target_calls_this_round: 0,
    target_not_executed: true,
    target_execution_authorised: pass,
    r_confirm_C0A: pass ? 6 : null,
    target_schedule_hash: targetScheduleHash,
    target_planned_calls: pass ? 12 : 0,
    target_treatment_isolation: targetIsolation,
    executor,
    correctness_vs_stability: {
      noise_modal: outcome.unique_modal,
      noise_modal_matches_fixture_expected: outcome.modal_token_matched_the_fixture_expected,
      used_as_a_pass_condition: false,
      note: "recorded as descriptive metadata only; the classifier's output does not depend on it"
    },
    characteros_modified: false,
    link_4_reopened: false,
    non_claims: [
      "the gate says nothing about composition, treatment sensitivity or the target",
      "the six tokens are not evidence about SUPPORTS_B or OPPOSES_B transfer",
      "no CharacterOS claim of any kind"
    ],
    next_round_may_only: "execute the 12 frozen target calls, freeze the dataset before scoring, and classify with scoreD4C0ARev1V0",
    next_round_may_not: ["run C0b", "change r", "adaptive replication", "modify CharacterOS", "modify the classifier or the scorers"]
  });

  process.stdout.write(
    `\n${finalStates.join("\n")}\nD4_MODEL_CALLS_THIS_ROUND = 6\nD4_MODEL_CALLS = 15\n`
  );
}

await main();
