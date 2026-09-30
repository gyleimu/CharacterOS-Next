/* eslint-disable no-restricted-imports -- Isolated research harness COMPOSING frozen production seams (repository convention); no production semantics are copied. */
/**
 * D2 A1 NEUTRAL SELF-NOISE PILOT — EXACTLY SIX CALLS, THEN STOP.
 *
 *   MODEL_API_KEY=... node research/experiments/belief-causal-path-d2/a1-neutral-pilot.ts <freezeDir> <pilotDir>
 *
 * The pilot measures ONE thing: the A1 endpoint's self-noise on six byte-identical NEUTRAL requests.
 * It is not a correctness test — the neutral modal token is never semantic evidence, and any token is
 * equally consistent with a quiet endpoint. Classification is delegated entirely to the frozen
 * `classifyA1NeutralPilotV0` from REV1.1d; this file does not restate or re-implement the policy.
 *
 * The frozen request is re-verified by hash before the first call: a noise estimate for drifted bytes
 * would describe a different question.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { hashEnvelope } from "../../../packages/subject-core/dist/index.js";
import type { ModelTransportRequestV0, ModelTransportV0 } from "../../../packages/runtime/dist/transports/model-transport.js";
import { OpenAiCompatibleTransportV0 } from "../../../packages/runtime/dist/transports/model-transport.js";

import { D2_HASH_PROJECTION_V0, D2A1_TOKENS } from "./contract-rev1.ts";
import {
  D2A1_NEUTRAL_PILOT_INVALID_POLICY,
  D2A1_NEUTRAL_TRIAL_IDS,
  classifyA1NeutralPilotV0
} from "./contract-rev1-1d-a1-neutral-and-context.ts";

const REQUEST_HASH_PROJECTION = "characteros-next/research/decision-probe/request/v0" as const;
const PILOT_TRIALS = 6 as const;
const INVALID_VOCABULARY = D2A1_NEUTRAL_PILOT_INVALID_POLICY.counts_as_invalid;

function fail(verdict: string, detail: string): never {
  throw new Error(`${verdict}: ${detail}`);
}

interface A1PilotTrial {
  readonly trial_id: string;
  readonly replicate_ordinal: number;
  readonly arm: "NEUTRAL";
  readonly request_hash: string;
  readonly raw_provider_response: string | null;
  readonly parsed_stance_token: string | null;
  readonly parser_status: string;
  readonly transport_status: "OK" | "FAILED";
  readonly transport_failure: string | null;
  readonly invalid_reason: string | null;
  readonly provider_response_model: string | null;
  readonly executor: Record<string, unknown>;
  readonly generation_settings: Record<string, unknown>;
  readonly latency_ms: number;
}

function parseA1(content: string): { ok: true; token: string } | { ok: false; reason: string } {
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
    if (!["d2_readout_schema_version", "stance", "explanation"].includes(key)) return { ok: false, reason: `unknown member: ${key}` };
  }
  if (record["d2_readout_schema_version"] !== "d2-a1-semantic-readout-v0") return { ok: false, reason: "schema version mismatch" };
  const stance = record["stance"];
  if (typeof stance !== "string") return { ok: false, reason: "stance is not a string" };
  if (!(D2A1_TOKENS as readonly string[]).includes(stance)) return { ok: false, reason: "token outside the frozen A1 vocabulary" };
  return { ok: true, token: stance };
}

/** Deterministic, outcome-blind ordering: a pure function of r alone. */
function buildSchedule(r: number): { position: number; arm: "HIGH" | "LOW" }[] {
  const order: { position: number; arm: "HIGH" | "LOW" }[] = [];
  for (let index = 0; index < r; index += 1) {
    order.push({ position: 2 * index + 1, arm: index % 2 === 0 ? "HIGH" : "LOW" });
    order.push({ position: 2 * index + 2, arm: index % 2 === 0 ? "LOW" : "HIGH" });
  }
  return order;
}

async function main(): Promise<void> {
  const freezeDir = process.argv[2];
  const pilotDir = process.argv[3];
  if (freezeDir === undefined || pilotDir === undefined) throw new Error("usage: node a1-neutral-pilot.ts <freezeDir> <pilotDir>");
  await mkdir(pilotDir, { recursive: true });
  const write = async (dir: string, name: string, value: unknown): Promise<string> => {
    const content = `${JSON.stringify(value, null, 2)}\n`;
    await writeFile(join(dir, name), content, "utf8");
    return String(await hashEnvelope(D2_HASH_PROJECTION_V0, { name, content }));
  };

  // ---- the frozen bytes, re-verified before anything is spent ---------------------------------
  const manifest = JSON.parse(await readFile(join(freezeDir, "A1_CHARACTEROS_REQUEST_SET_MANIFEST.json"), "utf8")) as Record<string, unknown>;
  const neutralDoc = JSON.parse(await readFile(join(freezeDir, "final-neutral.json"), "utf8")) as {
    final_request_hash: string;
    request: ModelTransportRequestV0;
  };
  const recomputed = String(await hashEnvelope(REQUEST_HASH_PROJECTION, neutralDoc.request as unknown));
  if (recomputed !== manifest["neutral_final_request_hash"] || recomputed !== neutralDoc.final_request_hash) {
    fail("D2_A1_STATE_REQUEST_SET_CHANGED_AFTER_FREEZE", `manifest ${String(manifest["neutral_final_request_hash"])} vs recomputed ${recomputed}`);
  }

  // ---- the frozen primary executor ------------------------------------------------------------
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
  await write(pilotDir, "neutral-request-hash.json", {
    request_hash: recomputed,
    source: "a1-characteros-request-freeze/final-neutral.json",
    identical_to_manifest: true,
    replicate_ordinal_is_in_the_request: false
  });

  // ---- exactly six trials, one identical payload, no recovery ---------------------------------
  const trials: A1PilotTrial[] = [];
  for (let ordinal = 1; ordinal <= PILOT_TRIALS; ordinal += 1) {
    process.stdout.write(`[${String(ordinal)}/${String(PILOT_TRIALS)}] NEUTRAL ... `);
    const started = Date.now();
    let content: string | null = null;
    let responseModel: string | null = null;
    let failure: string | null = null;
    try {
      const response = await transport.complete(neutralDoc.request);
      content = response.content;
      responseModel = response.model;
    } catch (error) {
      failure = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    }
    const latency = Date.now() - started;
    const parsed = failure === null ? parseA1(content ?? "") : ({ ok: false as const, reason: "transport failure, classified as a failed provider attempt" });
    const trial: A1PilotTrial = {
      trial_id: D2A1_NEUTRAL_TRIAL_IDS[ordinal - 1] as string,
      replicate_ordinal: ordinal,
      arm: "NEUTRAL",
      request_hash: recomputed,
      raw_provider_response: content,
      parsed_stance_token: parsed.ok ? parsed.token : null,
      parser_status: parsed.ok ? "VALID" : "INVALID",
      transport_status: failure === null ? "OK" : "FAILED",
      transport_failure: failure,
      invalid_reason: parsed.ok ? null : parsed.reason,
      provider_response_model: responseModel,
      executor,
      generation_settings: generationSettings,
      latency_ms: latency
    };
    trials.push(trial);
    await write(pilotDir, `trial-${String(ordinal).padStart(3, "0")}.json`, trial);
    process.stdout.write(`${parsed.ok ? parsed.token : `INVALID: ${parsed.reason}`}\n`);
  }

  // ---- freeze the raw dataset BEFORE classification -------------------------------------------
  const datasetHash = await write(pilotDir, "pilot-dataset.json", {
    stage: "D2_A1_NEUTRAL_PILOT",
    arm: "NEUTRAL",
    planned_denominator: 6,
    observed: trials.length,
    scored: false,
    invalid_vocabulary: INVALID_VOCABULARY,
    trials
  });
  await write(pilotDir, "pilot-dataset-hash.json", {
    A1_NEUTRAL_PILOT_DATASET_SHA256: datasetHash,
    frozen_before_classification: true,
    trials: trials.length,
    planned_denominator: 6
  });

  // ---- classification by the FROZEN procedure, over the frozen bytes --------------------------
  const frozen = JSON.parse(await readFile(join(pilotDir, "pilot-dataset.json"), "utf8")) as { trials: A1PilotTrial[] };
  if (frozen.trials.length !== PILOT_TRIALS) fail("D2_A1_NEUTRAL_PILOT_DENOMINATOR_VIOLATION", String(frozen.trials.length));
  const inputs = frozen.trials.map((t) => ({ trial_id: t.trial_id, parsed_token: t.parsed_stance_token }));
  let classification: Record<string, unknown>;
  let tieUndefined = false;
  try {
    classification = classifyA1NeutralPilotV0(inputs) as unknown as Record<string, unknown>;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("MODAL_TIE_UNDEFINED")) throw error;
    tieUndefined = true;
    classification = {
      pilot_verdict: "D2_A1_NEUTRAL_PILOT_MODAL_TIE_UNDEFINED",
      r_confirm_A1: null,
      modal_token: null,
      modal_count: null,
      note: "the frozen procedure defines no verdict for a tied modal; no r value is derived and the treatment is not authorised"
    };
  }
  const counts: Record<string, number> = {};
  for (const t of frozen.trials) {
    const key = t.parsed_stance_token ?? `INVALID:${t.invalid_reason ?? "unspecified"}`;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  const rConfirm = (classification["r_confirm_A1"] ?? null) as number | null;
  const stopVerdict = (classification["noise_verdict"] ?? null) as string | null;
  await write(pilotDir, "pilot-counts.json", {
    counts,
    invalid_trials: frozen.trials.filter((t) => t.parsed_stance_token === null).length,
    invalid_is_not_a_modal_category: true
  });
  await write(pilotDir, "pilot-classification.json", {
    classification,
    produced_by: "classifyA1NeutralPilotV0 (REV1.1d, frozen) — called, not re-implemented",
    counts_derived_from: "the frozen pilot-dataset.json bytes, re-read from disk",
    is_a_correctness_test: false,
    required_correct_token: null,
    neutral_token_identity_influenced_r: false,
    example: "six SUPPORTS and six UNCERTAIN are equivalent for noise calibration: both are modal_count = 6",
    modal_tie_undefined: tieUndefined
  });
  await write(pilotDir, "r-confirm-a1.json", {
    r_confirm_A1: rConfirm,
    modal_count: classification["modal_count"] ?? null,
    modal_token: classification["modal_token"] ?? null,
    pilot_verdict: classification["pilot_verdict"],
    stop_verdict: stopVerdict,
    mapping_source: "D2_NOISE_RULE.deterministic_mapping via the frozen REV1.1d procedure",
    mapping_may_not_be_modified: true
  });

  // ---- freeze the HIGH/LOW schedule only if the pilot authorised it ---------------------------
  let scheduleHash: string | null = null;
  if (rConfirm !== null && (rConfirm === 6 || rConfirm === 14)) {
    const order = buildSchedule(rConfirm);
    const highHash = String(manifest["high_final_request_hash"]);
    const lowHash = String(manifest["low_final_request_hash"]);
    const arms = order.map((o) => o.arm);
    const runLengths: number[] = [];
    let run = 1;
    for (let index = 1; index < arms.length; index += 1) {
      if (arms[index] === arms[index - 1]) run += 1;
      else {
        runLengths.push(run);
        run = 1;
      }
    }
    runLengths.push(run);
    scheduleHash = await write(pilotDir, "A1_STATE_EXPERIMENT_SCHEDULE.json", {
      stage: "D2_A1_STATE_EXPERIMENT",
      r_confirm_A1: rConfirm,
      calls_per_arm: rConfirm,
      total_calls: 2 * rConfirm,
      ordering_rule: "position k alternates arms per pair; within each pair HIGH,LOW then LOW,HIGH, and so on — a pure function of r alone",
      ordering_is_deterministic: true,
      ordering_is_counterbalanced: true,
      ordering_is_outcome_blind: true,
      ordering_depended_on: ["r_confirm_A1"],
      ordering_did_not_depend_on: ["the neutral modal token identity", "the A0 result token pattern", "human choice", "the current timestamp", "provider output"],
      requests_must_equal_the_frozen_hashes: { HIGH: highHash, LOW: lowHash },
      trials: order.map((o) => ({ position: o.position, arm: o.arm, request_hash: o.arm === "HIGH" ? highHash : lowHash })),
      not_yet_executed: true
    });
    const scheduleAuditHash = await write(pilotDir, "schedule-audit.json", {
      r_confirm_A1: rConfirm,
      total_calls: 2 * rConfirm,
      high_calls: arms.filter((a) => a === "HIGH").length,
      low_calls: arms.filter((a) => a === "LOW").length,
      arms_are_equal: arms.filter((a) => a === "HIGH").length === arms.filter((a) => a === "LOW").length,
      max_consecutive_run: Math.max(...runLengths),
      max_run_is_bounded_by_2: Math.max(...runLengths) <= 2,
      regenerating_from_r_alone_reproduces_the_schedule:
        JSON.stringify(buildSchedule(rConfirm)) === JSON.stringify(order),
      consecutive_arms_never_exceed_a_pair: runLengths.every((l) => l <= 2),
      schedule_hash: scheduleHash,
      first_high_low_call_executed_this_round: false
    });
    await write(pilotDir, "schedule-hash.json", { schedule_hash: scheduleHash, schedule_audit_hash: scheduleAuditHash, r_confirm_A1: rConfirm, total_calls_if_executed: 2 * rConfirm });
  }

  const finalStates = rConfirm === null
    ? tieUndefined
      ? ["D2_A1_NEUTRAL_PILOT_MODAL_TIE_UNDEFINED", "D2_A1_STATE_EXPERIMENT_NOT_STARTED"]
      : (classification["pilot_verdict"] === "D2_A1_INCONCLUSIVE_BY_PILOT_INVALID_OUTPUTS"
          ? ["D2_A1_INCONCLUSIVE_BY_PILOT_INVALID_OUTPUTS", "D2_EXECUTION_STOPPED_AT_A1_PILOT", "D2_A1_STATE_EXPERIMENT_NOT_STARTED"]
          : ["D2_A1_INCONCLUSIVE_BY_DECISION_NOISE", "D2_EXECUTION_STOPPED_AT_A1_NOISE"])
    : ["D2_A1_NEUTRAL_PILOT_COMPLETED", `r_confirm_A1 = ${String(rConfirm)}`, "D2_A1_STATE_REQUEST_SET_FROZEN", "D2_A1_STATE_EXPERIMENT_SCHEDULE_FROZEN", "D2_A1_STATE_EXPERIMENT_NOT_STARTED"];

  await write(pilotDir, "A1_NEUTRAL_PILOT_MANIFEST.json", {
    stage: "D2_A1",
    pilot_dataset_hash: datasetHash,
    pilot_dataset_frozen_before_classification: true,
    model_calls_this_round: PILOT_TRIALS,
    retries_replacements_deletions_extra_replicates_or_a_seventh_call: false,
    executor,
    neutral_request_hash: recomputed,
    six_request_hashes_identical: new Set(frozen.trials.map((t) => t.request_hash)).size === 1,
    counts,
    invalid_trials: frozen.trials.filter((t) => t.parsed_stance_token === null).length,
    classification,
    r_confirm_A1: rConfirm,
    schedule_hash: scheduleHash,
    final_states: finalStates,
    d2_model_calls_this_round: PILOT_TRIALS,
    d2_model_calls_cumulative: 42,
    a1_high_low_executed_this_round: false,
    establishes: "A1 endpoint self-noise under one byte-identical NEUTRAL CharacterOS request",
    does_not_establish: [
      "semantic transfer",
      "proposition understanding",
      "cognition use",
      "appraisal effect",
      "behaviour effect"
    ],
    real_link_3b_evidence_requires: "the frozen HIGH vs LOW A1 state experiment in a later round"
  });

  process.stdout.write(`\n${finalStates.join("\n")}\nD2_MODEL_CALLS_THIS_ROUND = 6\n`);
}

await main();
