/* eslint-disable no-restricted-imports -- Isolated research harness COMPOSING frozen production seams (repository convention); no production semantics are copied. */
/**
 * D2 A0 — THE FROZEN HIGH/LOW STATE EXPERIMENT. EXACTLY TWELVE CALLS.
 *
 *   MODEL_API_KEY=... node research/experiments/belief-causal-path-d2/a0-state-experiment.ts <freezeDir> <pilotDir> <outDir>
 *
 * This runner REBUILDS NOTHING. It does not construct a world, a subject state, an observation, a
 * projection, a pristine V8 request or a transformed request. Its whole job is:
 *
 *   schedule entry -> frozen request read from disk -> hash check -> one call -> persist immediately
 *
 * One trial is one attempt, whatever it returns: a legal token, malformed output, a parser rejection
 * or a transport failure all consume the trial. No retry, no replacement, no deleted invalid, no
 * thirteenth call, no changed denominator.
 *
 * Before the first call it re-verifies that the schedule still names exactly the frozen request
 * bytes, and it refuses to run at all otherwise.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { hashEnvelope } from "../../../packages/subject-core/dist/index.js";
import type { ModelTransportRequestV0, ModelTransportV0 } from "../../../packages/runtime/dist/transports/model-transport.js";
import { OpenAiCompatibleTransportV0 } from "../../../packages/runtime/dist/transports/model-transport.js";

import { D2_HASH_PROJECTION_V0, D2A0_PREDICTION, D2A0_TOKENS } from "./contract-rev1.ts";

const REQUEST_HASH_PROJECTION = "characteros-next/research/decision-probe/request/v0" as const;
const SCHEDULE_FILE = "A0_STATE_EXPERIMENT_SCHEDULE.json";

function fail(verdict: string, detail: string): never {
  throw new Error(`${verdict}: ${detail}`);
}

interface ScheduleEntry {
  readonly position: number;
  readonly arm: "HIGH" | "LOW";
  readonly request_hash: string;
}
interface ScheduleDoc {
  readonly r_confirm_A0: number;
  readonly calls_per_arm: number;
  readonly total_calls: number;
  readonly trials: readonly ScheduleEntry[];
}
interface Trial {
  readonly trial_id: string;
  readonly global_ordinal: number;
  readonly schedule_position: number;
  readonly arm: "HIGH" | "LOW";
  readonly replicate_ordinal: number;
  readonly request_hash: string;
  readonly raw_response: string | null;
  readonly parsed_stance_token: string | null;
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

/** Counts for one arm, keyed by token or `INVALID:<status>`. */
function countsOf(trials: readonly Trial[], arm: "HIGH" | "LOW"): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const trial of trials.filter((t) => t.arm === arm)) {
    const key = trial.parsed_stance_token ?? `INVALID:${trial.parser_status}`;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function modalOf(counts: Record<string, number>): { modal: string | null; modal_count: number; tie: boolean } {
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const top = ranked[0];
  if (top === undefined) return { modal: null, modal_count: 0, tie: false };
  const tie = ranked.length > 1 && ranked[1] !== undefined && ranked[1][1] === top[1];
  return { modal: tie ? null : top[0], modal_count: top[1], tie };
}

async function main(): Promise<void> {
  const freezeDir = process.argv[2];
  const pilotDir = process.argv[3];
  const outDir = process.argv[4];
  if (freezeDir === undefined || pilotDir === undefined || outDir === undefined) {
    throw new Error("usage: node a0-state-experiment.ts <freezeDir> <pilotDir> <outDir>");
  }
  await mkdir(outDir, { recursive: true });
  const write = async (name: string, value: unknown): Promise<string> => {
    const content = `${JSON.stringify(value, null, 2)}\n`;
    await writeFile(join(outDir, name), content, "utf8");
    return String(await hashEnvelope(D2_HASH_PROJECTION_V0, { name, content }));
  };
  const writeIn = async (dir: string, name: string, value: unknown): Promise<void> => {
    await writeFile(join(dir, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");
  };

  // ---- 1. read the frozen artifacts; rebuild nothing ----------------------------------------
  const manifest = JSON.parse(await readFile(join(freezeDir, "A0_CHARACTEROS_REQUEST_SET_MANIFEST.json"), "utf8")) as Record<string, unknown>;
  const highDoc = JSON.parse(await readFile(join(freezeDir, "final-high.json"), "utf8")) as {
    final_request_hash: string;
    request: ModelTransportRequestV0;
    credence: number;
  };
  const lowDoc = JSON.parse(await readFile(join(freezeDir, "final-low.json"), "utf8")) as {
    final_request_hash: string;
    request: ModelTransportRequestV0;
    credence: number;
  };
  const scheduleRaw = await readFile(join(pilotDir, SCHEDULE_FILE), "utf8");
  const schedule = JSON.parse(scheduleRaw) as ScheduleDoc;
  const scheduleHashDoc = JSON.parse(await readFile(join(pilotDir, "schedule-hash.json"), "utf8")) as { schedule_hash: string };

  // ---- 2. pre-execution integrity, before the first call -------------------------------------
  const recomputedScheduleHash = String(await hashEnvelope(D2_HASH_PROJECTION_V0, { name: SCHEDULE_FILE, content: scheduleRaw }));
  const recomputedHigh = String(await hashEnvelope(REQUEST_HASH_PROJECTION, highDoc.request as unknown));
  const recomputedLow = String(await hashEnvelope(REQUEST_HASH_PROJECTION, lowDoc.request as unknown));
  const entries = [...schedule.trials];
  const positions = entries.map((e) => e.position);
  const arms = entries.map((e) => e.arm);
  const integrity = {
    schedule_entries: entries.length,
    expected_schedule_entries: 12,
    high_entries: arms.filter((a) => a === "HIGH").length,
    low_entries: arms.filter((a) => a === "LOW").length,
    neutral_or_unknown_entries: arms.filter((a) => a !== "HIGH" && a !== "LOW").length,
    duplicate_trial_identities: positions.length - new Set(positions).size,
    positions_are_1_to_12_in_order: positions.every((p, i) => p === i + 1),
    schedule_hash_recorded: scheduleHashDoc.schedule_hash,
    schedule_hash_recomputed: recomputedScheduleHash,
    schedule_hash_exact: recomputedScheduleHash === scheduleHashDoc.schedule_hash,
    high_request_hash_in_manifest: String(manifest["high_request_hash"]),
    high_request_hash_recomputed: recomputedHigh,
    high_request_hash_exact: recomputedHigh === String(manifest["high_request_hash"]) && recomputedHigh === highDoc.final_request_hash,
    low_request_hash_in_manifest: String(manifest["low_request_hash"]),
    low_request_hash_recomputed: recomputedLow,
    low_request_hash_exact: recomputedLow === String(manifest["low_request_hash"]) && recomputedLow === lowDoc.final_request_hash,
    a0_contract_hash_in_manifest: String(manifest["a0_contract_hash"]),
    every_schedule_entry_joins_to_a_frozen_request: entries.every(
      (e) => e.request_hash === (e.arm === "HIGH" ? recomputedHigh : recomputedLow)
    ),
    request_map_join: `${String(entries.filter((e) => e.request_hash === (e.arm === "HIGH" ? recomputedHigh : recomputedLow)).length)}/12`,
    high_credence: highDoc.credence,
    low_credence: lowDoc.credence,
    rebuilt_anything_at_runtime: false
  };
  const integrityOk =
    integrity.schedule_entries === 12 &&
    integrity.high_entries === 6 &&
    integrity.low_entries === 6 &&
    integrity.neutral_or_unknown_entries === 0 &&
    integrity.duplicate_trial_identities === 0 &&
    integrity.positions_are_1_to_12_in_order &&
    integrity.schedule_hash_exact &&
    integrity.high_request_hash_exact &&
    integrity.low_request_hash_exact &&
    integrity.every_schedule_entry_joins_to_a_frozen_request &&
    highDoc.credence === 0.8 &&
    lowDoc.credence === 0.2;
  if (!integrityOk) {
    await write("collection-integrity-report.json", { ...integrity, verdict: "D2_A0_STATE_EXPERIMENT_BLOCKED_BY_INTEGRITY_FAILURE", calls_made: 0 });
    fail("D2_A0_STATE_EXPERIMENT_BLOCKED_BY_INTEGRITY_FAILURE", JSON.stringify(integrity));
  }

  // ---- 3. the frozen primary executor, unchanged ---------------------------------------------
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

  // ---- 4. the frozen ordering, exactly as written --------------------------------------------
  const trials: Trial[] = [];
  const replicateCounter: Record<"HIGH" | "LOW", number> = { HIGH: 0, LOW: 0 };
  for (const [index, entry] of entries.entries()) {
    const request = entry.arm === "HIGH" ? highDoc.request : lowDoc.request;
    replicateCounter[entry.arm] += 1;
    process.stdout.write(`[${String(index + 1)}/12] pos=${String(entry.position)} ${entry.arm} r${String(replicateCounter[entry.arm])} ... `);
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
    const parsed = failure === null ? parseA0(content ?? "") : ({ ok: false as const, code: "TRANSPORT_FAILED" });
    const trial: Trial = {
      trial_id: `d2-a0-state-${String(index + 1).padStart(3, "0")}`,
      global_ordinal: index + 1,
      schedule_position: entry.position,
      arm: entry.arm,
      replicate_ordinal: replicateCounter[entry.arm],
      request_hash: entry.request_hash,
      raw_response: content,
      parsed_stance_token: parsed.ok ? parsed.token : null,
      parser_status: parsed.ok ? "VALID" : parsed.code,
      transport_status: failure === null ? "OK" : "FAILED",
      transport_failure: failure,
      provider_response_model: responseModel,
      executor,
      generation_settings: generationSettings,
      latency_ms: latency
    };
    trials.push(trial);
    await writeIn(outDir, `trial-${String(index + 1).padStart(3, "0")}.json`, trial);
    process.stdout.write(`${parsed.ok ? parsed.token : `REJECTED:${parsed.code}`}\n`);
  }

  // ---- 5. collection integrity, then the dataset freeze BEFORE any scoring --------------------
  const armCounts = { HIGH: countsOf(trials, "HIGH"), LOW: countsOf(trials, "LOW") };
  const collection = {
    planned: 12,
    observed: trials.length,
    high: trials.filter((t) => t.arm === "HIGH").length,
    low: trials.filter((t) => t.arm === "LOW").length,
    duplicates: trials.length - new Set(trials.map((t) => t.trial_id)).size,
    missing: 12 - trials.length,
    extra: Math.max(0, trials.length - 12),
    invalid_trials: trials.filter((t) => t.parsed_stance_token === null).length,
    transport_failures: trials.filter((t) => t.transport_status !== "OK").length,
    distinct_request_hashes: new Set(trials.map((t) => t.request_hash)).size,
    frozen_ordering_preserved: trials.every((t, i) => t.schedule_position === entries[i]?.position && t.arm === entries[i]?.arm),
    executor,
    verdict: "D2_A0_STATE_EXPERIMENT_COLLECTION_COMPLETE"
  };
  await write("collection-integrity-report.json", { ...integrity, collection });
  const datasetHash = await write("a0-state-dataset.json", {
    stage: "D2_A0_STATE_EXPERIMENT",
    arm_credences: { HIGH: highDoc.credence, LOW: lowDoc.credence },
    planned: 12,
    observed: trials.length,
    scored: false,
    trials
  });
  await write("a0-state-dataset-hash.json", {
    A0_STATE_EXPERIMENT_DATASET_SHA256: datasetHash,
    frozen_before_any_scientific_scoring: true,
    trials: trials.length
  });
  await write("arm-counts.json", { arm_counts: armCounts, invalid_and_transport_counts: { invalid: collection.invalid_trials, transport_failures: collection.transport_failures } });

  // ---- 6. scoring, against the FROZEN bytes, after the freeze ---------------------------------
  const frozen = JSON.parse(await readFile(join(outDir, "a0-state-dataset.json"), "utf8")) as { trials: Trial[] };
  if (frozen.trials.length !== 12) fail("D2_A0_STATE_EXPERIMENT_DATASET_INCOMPLETE", String(frozen.trials.length));
  const frozenCounts = { HIGH: countsOf(frozen.trials, "HIGH"), LOW: countsOf(frozen.trials, "LOW") };
  const highModal = modalOf(frozenCounts["HIGH"]);
  const lowModal = modalOf(frozenCounts["LOW"]);
  const endorsing = D2A0_PREDICTION.directional.endorsing_set as readonly string[];
  const doubting = D2A0_PREDICTION.directional.doubting_set as readonly string[];
  const highInEndorsing = highModal.modal !== null && endorsing.includes(highModal.modal);
  const lowInDoubting = lowModal.modal !== null && doubting.includes(lowModal.modal);
  const modalitiesDiffer = highModal.modal !== null && lowModal.modal !== null && highModal.modal !== lowModal.modal;
  const directional = highInEndorsing && lowInDoubting && modalitiesDiffer;
  const magnitude = highModal.modal === "ENDORSES_STRONGLY" && lowModal.modal === "DOUBTS_STRONGLY";
  const anyInvalid = collection.invalid_trials > 0 || collection.transport_failures > 0;

  await write("modal-report.json", {
    high: { counts: frozenCounts["HIGH"], ...highModal },
    low: { counts: frozenCounts["LOW"], ...lowModal },
    counts_source: "the frozen a0-state-dataset.json bytes, re-read from disk",
    invalid_trials_excluded_from_the_modal: false,
    invalid_trials_disclosed: anyInvalid,
    denominator_unchanged: true
  });
  await write("direction-scoring.json", {
    rule: D2A0_PREDICTION.directional,
    high_modal: highModal.modal,
    high_modal_in_endorsing_set: highInEndorsing,
    low_modal: lowModal.modal,
    low_modal_in_doubting_set: lowInDoubting,
    modalities_differ: modalitiesDiffer,
    primary_criterion_met: directional,
    verdict_if_met: directional ? "STRUCTURAL_DIRECTION_LEGIBLE" : null,
    verdict_if_not_met: directional ? null : "BELIEF_PROJECTION_STRUCTURAL_READOUT_NOT_ESTABLISHED",
    individual_calls_used_to_override_the_modal: false
  });
  await write("magnitude-diagnostic.json", {
    rule: D2A0_PREDICTION.magnitude,
    high_modal: highModal.modal,
    low_modal: lowModal.modal,
    secondary_magnitude_calibrated: magnitude,
    replaces_the_primary_criterion: false,
    primary_criterion_unaffected_by_this_diagnostic: true
  });

  const verdict = {
    stage: "D2_A0_STATE_EXPERIMENT",
    execution_status: "D2_A0_STATE_EXPERIMENT_COMPLETED",
    dataset_hash: datasetHash,
    r_confirm_A0: 6,
    calls_per_arm: 6,
    total_calls: 12,
    high_counts: frozenCounts["HIGH"],
    low_counts: frozenCounts["LOW"],
    high_modal: highModal.modal,
    low_modal: lowModal.modal,
    primary_direction_criterion_met: directional,
    scientific_verdict: directional
      ? ["STRUCTURAL_DIRECTION_LEGIBLE", "CANONICAL_BELIEF_PROJECTION_STRUCTURALLY_LEGIBLE"]
      : ["BELIEF_PROJECTION_STRUCTURAL_READOUT_NOT_ESTABLISHED"],
    secondary_magnitude_calibrated: magnitude,
    a1_unlock_decision: directional ? "D2_A1_AUTHORISED" : "D2_A1_NOT_AUTHORISED",
    a1_or_b_executed_this_round: false,
    d2_execution_stopped_at_a0: !directional,
    invalid_trials: collection.invalid_trials,
    transport_failures: collection.transport_failures,
    degraded_evidence_note: anyInvalid
      ? "invalid/transport-failed trials are disclosed above; the frozen contracts contain no A0 state-experiment invalid rule and this round invented no tolerance ratio, deleted nothing and replaced nothing"
      : null,
    neutral_noise_context: {
      source: "the A0 endpoint's own frozen NEUTRAL pilot",
      modal_count: 6,
      r_confirm_A0: 6,
      observed_self_noise: 0,
      neutral_token_used_as_correctness_evidence: false
    },
    non_claims: [
      "NOT proposition-semantic uptake (that is A1)",
      "NOT cognition use, appraisal effect or structured-decision effect",
      "NOT a statement that D1 was wrong",
      "NOT history internalization and NOT autonomous belief formation",
      "A0 answers ONE question only: whether the production canonical belief representation is distinguishable by the executor at the structural/numeric readout layer"
    ]
  };
  await write("a0-scientific-verdict.json", verdict);
  await write("A0_STATE_EXPERIMENT_MANIFEST.json", {
    ...verdict,
    frozen_request_identity: {
      high_request_hash: recomputedHigh,
      low_request_hash: recomputedLow,
      a0_contract_hash: String(manifest["a0_contract_hash"]),
      request_set_manifest_hash: "sha256:289b52c30923440b084aa603af40f31c321ffd63b3e7b83e16f0888c82e45271"
    },
    frozen_schedule_identity: {
      schedule_hash: recomputedScheduleHash,
      ordering: entries.map((e) => e.arm).join(" "),
      ordering_rule_respected: collection.frozen_ordering_preserved
    },
    d2_model_calls_this_round: 12,
    d2_model_calls_cumulative: 27,
    executor
  });

  process.stdout.write(`\n${verdict.execution_status}\nHIGH modal=${String(highModal.modal)} LOW modal=${String(lowModal.modal)}\n`);
  process.stdout.write(`${verdict.scientific_verdict.join(" | ")}\n${verdict.a1_unlock_decision}\nD2_MODEL_CALLS_THIS_ROUND = 12\n`);
  if (magnitude) process.stdout.write("STRUCTURAL_MAGNITUDE_CALIBRATED\n");
}

await main();
