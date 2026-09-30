/* eslint-disable no-restricted-imports -- Isolated research harness COMPOSING frozen production seams (repository convention); no production semantics are copied. */
/**
 * D2 A0 — THE NEUTRAL SELF-NOISE PILOT. EXACTLY SIX CALLS, THEN STOP.
 *
 *   MODEL_API_KEY=... node research/experiments/belief-causal-path-d2/a0-neutral-pilot.ts <freezeDir> <pilotDir>
 *
 * The pilot is NOT a correctness test. It does not ask whether credence 0.50 should read as
 * UNDECIDED — no authoritative contract froze that, so nothing here may require it. It measures one
 * thing: the endpoint's own SELF-NOISE on six byte-identical requests. Only `modal_count` feeds the
 * frozen mapping; the modal token itself is never interpreted as scientific evidence.
 *
 * Reads the three requests frozen by `a0-state-requests.ts` and re-verifies their hashes before the
 * first call: a pilot on drifted bytes would produce a noise estimate for a different question.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { hashEnvelope } from "../../../packages/subject-core/dist/index.js";
import type { ModelTransportRequestV0, ModelTransportV0 } from "../../../packages/runtime/dist/transports/model-transport.js";
import { OpenAiCompatibleTransportV0 } from "../../../packages/runtime/dist/transports/model-transport.js";

import { D2_HASH_PROJECTION_V0, D2_NOISE_RULE, D2A0_TOKENS } from "./contract-rev1.ts";

const PILOT_TRIALS = 6 as const;
const REQUEST_HASH_PROJECTION = "characteros-next/research/decision-probe/request/v0" as const;

function fail(verdict: string, detail: string): never {
  throw new Error(`${verdict}: ${detail}`);
}

interface A0PilotTrial {
  readonly trial_id: string;
  readonly arm: "NEUTRAL";
  readonly replicate_ordinal: number;
  readonly request_hash: string;
  readonly raw_response: string | null;
  readonly parsed_token: string | null;
  readonly parser_status: string;
  readonly transport_status: "OK" | "FAILED";
  readonly transport_failure: string | null;
  readonly provider_response_model: string | null;
  readonly executor: Record<string, unknown>;
  readonly generation_settings: Record<string, unknown>;
  readonly latency_ms: number;
}

function parseA0(content: string): { ok: true; token: string } | { ok: false; code: string } {
  if (content.trim().length === 0) return { ok: false, code: "EMPTY_CONTENT" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    return { ok: false, code: `NOT_JSON:${(error as Error).message.slice(0, 40)}` };
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return { ok: false, code: "NOT_OBJECT" };
  const record = parsed as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!["d2_readout_schema_version", "stance", "explanation"].includes(key)) return { ok: false, code: `UNKNOWN_KEY:${key}` };
  }
  if (record["d2_readout_schema_version"] !== "d2-a0-structural-readout-v0") return { ok: false, code: "SCHEMA_VERSION_MISMATCH" };
  const stance = record["stance"];
  if (typeof stance !== "string" || !(D2A0_TOKENS as readonly string[]).includes(stance)) {
    return { ok: false, code: "STANCE_NOT_IN_CLOSED_SET" };
  }
  return { ok: true, token: stance };
}

async function main(): Promise<void> {
  const freezeDir = process.argv[2];
  const pilotDir = process.argv[3];
  if (freezeDir === undefined || pilotDir === undefined) {
    throw new Error("usage: node a0-neutral-pilot.ts <freezeDir> <pilotDir>");
  }
  await mkdir(pilotDir, { recursive: true });
  const write = async (dir: string, name: string, value: unknown): Promise<string> => {
    const content = `${JSON.stringify(value, null, 2)}\n`;
    await writeFile(join(dir, name), content, "utf8");
    return String(await hashEnvelope(D2_HASH_PROJECTION_V0, { name, content }));
  };

  // ---- 1. re-verify the frozen bytes, then re-verify them again after the number is fixed -----
  const manifest = JSON.parse(await readFile(join(freezeDir, "A0_CHARACTEROS_REQUEST_SET_MANIFEST.json"), "utf8")) as Record<string, unknown>;
  const neutralDoc = JSON.parse(await readFile(join(freezeDir, "final-neutral.json"), "utf8")) as {
    level: string;
    final_request_hash: string;
    request: ModelTransportRequestV0;
  };
  const neutralRequest = neutralDoc.request;
  const recomputed = String(await hashEnvelope(REQUEST_HASH_PROJECTION, neutralRequest as unknown));
  if (recomputed !== manifest["neutral_request_hash"] || recomputed !== neutralDoc.final_request_hash) {
    fail("D2_A0_STATE_REQUEST_SET_CHANGED_AFTER_FREEZE", `manifest ${String(manifest["neutral_request_hash"])} vs recomputed ${recomputed}`);
  }

  // ---- 2. the frozen primary executor; no fallback, no substitution --------------------------
  const apiKey = process.env["MODEL_API_KEY"];
  if (apiKey === undefined || apiKey.length === 0) fail("PRIMARY_EXECUTOR_UNAVAILABLE", "no credential; no substitution attempted");
  const endpoint = process.env["MODEL_API_BASE_URL"] ?? "https://api.deepseek.com";
  const model = process.env["MODEL_API_MODEL"] ?? "deepseek-flash";
  const generationSettings = Object.freeze({
    temperature: 0,
    max_output_tokens: 256,
    provider_thinking: "disabled",
    timeout_ms: 120_000,
    endpoint
  });
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
    source: "a0-characteros-request-freeze/final-neutral.json",
    identical_to_manifest: true,
    replicate_ordinal_is_in_the_request: false
  });

  // ---- 3. exactly six calls, one identical payload, no retry and no replacement --------------
  const trials: A0PilotTrial[] = [];
  for (let ordinal = 1; ordinal <= PILOT_TRIALS; ordinal += 1) {
    process.stdout.write(`[${String(ordinal)}/${String(PILOT_TRIALS)}] NEUTRAL ... `);
    const started = Date.now();
    let content: string | null = null;
    let responseModel: string | null = null;
    let failure: string | null = null;
    try {
      const response = await transport.complete(neutralRequest);
      content = response.content;
      responseModel = response.model;
    } catch (error) {
      failure = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    }
    const latency = Date.now() - started;
    const parsed = failure === null ? parseA0(content ?? "") : ({ ok: false as const, code: "TRANSPORT_FAILED" });
    const trial: A0PilotTrial = {
      trial_id: `d2-a0-neutral-${String(ordinal).padStart(3, "0")}`,
      arm: "NEUTRAL",
      replicate_ordinal: ordinal,
      request_hash: recomputed,
      raw_response: content,
      parsed_token: parsed.ok ? parsed.token : null,
      parser_status: parsed.ok ? "VALID" : parsed.code,
      transport_status: failure === null ? "OK" : "FAILED",
      transport_failure: failure,
      provider_response_model: responseModel,
      executor,
      generation_settings: generationSettings,
      latency_ms: latency
    };
    trials.push(trial);
    await write(pilotDir, `trial-${String(ordinal).padStart(3, "0")}.json`, trial);
    process.stdout.write(`${parsed.ok ? parsed.token : `REJECTED:${parsed.code}`}\n`);
  }

  // ---- 4. freeze the raw dataset BEFORE any noise calculation ---------------------------------
  const datasetHash = await write(pilotDir, "pilot-dataset.json", {
    stage: "D2_A0_NEUTRAL_PILOT",
    arm: "NEUTRAL",
    corrected_before_any_scoring: false,
    scored: false,
    trials
  });
  await write(pilotDir, "pilot-dataset-hash.json", {
    pilot_dataset_sha256: datasetHash,
    frozen_before_noise_calculation: true,
    trials: trials.length
  });

  // ---- 5. the frozen noise rule, applied mechanically to the FROZEN BYTES ---------------------
  // Counts are derived by re-reading the frozen dataset from disk, not from the in-memory array:
  // the number that becomes r_confirm must be a function of the artifact that was hashed.
  const frozen = JSON.parse(await readFile(join(pilotDir, "pilot-dataset.json"), "utf8")) as { trials: A0PilotTrial[] };
  if (frozen.trials.length !== PILOT_TRIALS) fail("D2_A0_PILOT_DATASET_INCOMPLETE", String(frozen.trials.length));
  const counts: Record<string, number> = {};
  for (const trial of frozen.trials) {
    const key = trial.parsed_token ?? `INVALID:${trial.parser_status}`;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (ranked.length === 0) fail("D2_A0_INCONCLUSIVE_BY_ENDPOINT_NOISE", "no trials in the frozen dataset");
  const modal = ranked[0] as [string, number];
  const modalToken = modal[0];
  const modalCount = modal[1];
  const mapped = (D2_NOISE_RULE.deterministic_mapping as Record<string, number | string>)[String(modalCount)];
  const rConfirm = typeof mapped === "number" ? mapped : null;
  const noiseReport = {
    stage: "D2_A0_NEUTRAL_PILOT",
    is_a_correctness_test: false,
    required_correct_token: null,
    correct_token_was_never_preregistered: true,
    counts,
    modal_token: modalToken,
    modal_count: modalCount,
    disagreement_count: frozen.trials.length - modalCount,
    disagreement_rate: (frozen.trials.length - modalCount) / frozen.trials.length,
    counts_derived_from: "the frozen pilot-dataset.json bytes, re-read from disk",
    mapping_source: "D2_NOISE_RULE.deterministic_mapping (frozen before any call)",
    mapping_applied: String(modalCount),
    mapped_value: mapped,
    r_confirm_A0: rConfirm,
    modal_token_interpreted_as_scientific_evidence: false,
    verdict: rConfirm === null ? D2_NOISE_RULE.stop_verdict : "D2_A0_NEUTRAL_PILOT_COMPLETED"
  };
  await write(pilotDir, "pilot-counts.json", counts);
  await write(pilotDir, "pilot-noise-report.json", noiseReport);
  await write(pilotDir, "r-confirm-a0.json", {
    r_confirm_A0: rConfirm,
    modal_count: modalCount,
    mapping_source: "D2_NOISE_RULE.deterministic_mapping",
    mapping_may_not_be_modified: true
  });

  // ---- 6. only on success: freeze the HIGH/LOW schedule ---------------------------------------
  let scheduleHash: string | null = null;
  if (rConfirm !== null) {
    // Outcome-blind, deterministic, counterbalanced: the neutral modal token cannot reach this
    // ordering, which depends on r alone. Alternating HIGH/LOW with the starting arm fixed by parity,
    // so neither arm is systematically early or late in a position-correlated provider stream.
    const order: { readonly position: number; readonly arm: "HIGH" | "LOW" }[] = [];
    for (let index = 0; index < rConfirm; index += 1) {
      order.push({ position: 2 * index + 1, arm: index % 2 === 0 ? "HIGH" : "LOW" });
      order.push({ position: 2 * index + 2, arm: index % 2 === 0 ? "LOW" : "HIGH" });
    }
    const highRequestHash = String(manifest["high_request_hash"]);
    const lowRequestHash = String(manifest["low_request_hash"]);
    const schedule = {
      stage: "D2_A0_STATE_EXPERIMENT",
      r_confirm_A0: rConfirm,
      calls_per_arm: rConfirm,
      total_calls: 2 * rConfirm,
      ordering_rule:
        "position k (1-based) alternates arms per pair; within each pair the arm order is HIGH,LOW then LOW,HIGH, and so on — a pure function of r alone",
      ordering_is_deterministic: true,
      ordering_is_counterbalanced: true,
      ordering_is_outcome_blind: true,
      neutral_modal_token_influenced_ordering: false,
      neutral_pilot_influenced_anything_but_r: false,
      requests_must_equal_the_frozen_hashes: { HIGH: highRequestHash, LOW: lowRequestHash },
      trials: order.map((step) => ({
        position: step.position,
        arm: step.arm,
        request_hash: step.arm === "HIGH" ? highRequestHash : lowRequestHash
      })),
      not_yet_executed: true
    };
    scheduleHash = await write(pilotDir, "A0_STATE_EXPERIMENT_SCHEDULE.json", schedule);
    await write(pilotDir, "schedule-hash.json", {
      schedule_hash: scheduleHash,
      r_confirm_A0: rConfirm,
      total_calls_if_executed: 2 * rConfirm
    });
  }

  await write(pilotDir, "A0_NEUTRAL_PILOT_MANIFEST.json", {
    stage: "D2_A0",
    pilot_dataset_hash: datasetHash,
    pilot_dataset_frozen_before_noise_calculation: true,
    model_calls_this_round: PILOT_TRIALS,
    refunds_retries_replacements_or_a_seventh_call: false,
    executor,
    neutral_request_hash: recomputed,
    six_request_hashes_identical: new Set(trials.map((t) => t.request_hash)).size === 1,
    distinct_parsed_tokens: Object.keys(counts).length,
    modal_token: modalToken,
    modal_count: modalCount,
    r_confirm_A0: rConfirm,
    schedule_hash: scheduleHash,
    d2_a0_state_experiment_not_started: true,
    neutral_modal_token_interpreted_as_scientific_evidence: false,
    may_be_used_as_characteros_evidence_for_a_legibility_claim: false,
    only_a_high_vs_low_state_experiment_may_emit:
      "STRUCTURAL_DIRECTION_LEGIBLE (+ secondary STRUCTURAL_MAGNITUDE_CALIBRATED)"
  });

  process.stdout.write(`\n${noiseReport.verdict}\nmodal=${modalToken} modal_count=${modalCount} r_confirm_A0=${String(rConfirm)}\n`);
  if (scheduleHash !== null) process.stdout.write(`schedule_hash=${scheduleHash}\nD2_A0_STATE_EXPERIMENT_NOT_STARTED (0 HIGH/LOW calls this round)\n`);
}

await main();
