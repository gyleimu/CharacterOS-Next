/* eslint-disable no-restricted-imports -- Isolated research harness COMPOSING frozen production seams (repository convention); no production semantics are copied. */
/**
 * D1 CORE TREATMENT EXECUTION — exactly the 60 frozen trials, in frozen order.
 *
 *   MODEL_API_KEY=... node research/experiments/belief-state-sensitivity-d1/core-treatment.ts <outdir>
 *
 * The runner does NOT build worlds, observations, projections or requests. It looks up frozen
 * payloads, verifies their hashes, calls the primary executor once per trial, and persists each
 * result before the next call. Scoring runs only after the raw dataset is frozen and hashed.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { hashEnvelope } from "../../../packages/subject-core/dist/index.js";
import { OpenAiCompatibleTransportV0 } from "../../../packages/runtime/dist/transports/model-transport.js";
import type { ModelTransportRequestV0, ModelTransportV0 } from "../../../packages/runtime/dist/transports/model-transport.js";

import {
  classifyContrastV0,
  classifyFrameV0,
  classifyNegativeControlV0,
  computeContrastV0,
  type D1CellCountsV0,
  type D1ContrastVerdict
} from "./amendment.ts";
import { D1_HASH_PROJECTION_V0, deriveD1ManifestV0, deriveRConfirmV0 } from "./contract.ts";
import { validateV2Output } from "../decision-probe-v2/probe-v2.ts";

const REQUEST_DIR = "research/experiments/belief-state-sensitivity-d1/evidence/run-001/treatment-request-freeze";
const SCHEDULE_FILE = "research/experiments/belief-state-sensitivity-d1/evidence/run-001/schedule-amendment/D1_CORE_TREATMENT_SCHEDULE_V2.json";
const FROZEN_CORE_HASH = "sha256:d1ee515fa295cf4290a0e68cd15128b58db01420fe06a6866bf50ab12da8e371";
const BLOCKS = ["P1_FULL", "P2_FULL", "P3_NEGATIVE_CONTROL", "P1_FRAME_MINIMAL", "STATE_REVERSAL"] as const;
const ARMS = ["HIGH", "LOW"] as const;

function fail(verdict: string, detail: string): never {
  throw new Error(`${verdict}: ${detail}`);
}

async function main(): Promise<void> {
  const outdir = process.argv[2];
  if (outdir === undefined) throw new Error("usage: node core-treatment.ts <outdir>");
  await mkdir(outdir, { recursive: true });
  const write = async (name: string, value: unknown): Promise<void> => {
    await writeFile(join(outdir, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");
  };

  const manifest = await deriveD1ManifestV0();
  const noiseCeiling = deriveRConfirmV0(6).noise_ceiling;
  if (noiseCeiling === null) fail("D1_RECONFIRM_MISSING", "no frozen ceiling");

  // ---- 1/2. frozen artifacts only, with pre-execution hash verification ---------------
  const scheduleDoc = JSON.parse(await readFile(SCHEDULE_FILE, "utf8")) as {
    schedule: { schedule_hash: string; trials: { ordinal: number; block: string; arm: string; replicate_ordinal: number }[] };
  };
  if (scheduleDoc.schedule.schedule_hash !== FROZEN_CORE_HASH) fail("D1_CORE_SCHEDULE_HASH_CHANGED", scheduleDoc.schedule.schedule_hash);
  if (scheduleDoc.schedule.trials.length !== 60) fail("D1_CORE_SCHEDULE_NOT_60", String(scheduleDoc.schedule.trials.length));

  const payloads = new Map<string, ModelTransportRequestV0>();
  const payloadHashes = new Map<string, string>();
  let hashMismatch = 0;
  for (const block of BLOCKS) {
    for (const arm of ARMS) {
      const doc = JSON.parse(await readFile(join(REQUEST_DIR, `${block}_${arm}.json`), "utf8")) as {
        request: ModelTransportRequestV0;
        final_model_facing_request_hash: string;
      };
      const recomputed = String(await hashEnvelope("characteros-next/research/decision-probe/request/v0", doc.request as unknown));
      if (recomputed !== doc.final_model_facing_request_hash) hashMismatch += 1;
      payloads.set(`${block}|${arm}`, doc.request);
      payloadHashes.set(`${block}|${arm}`, recomputed);
    }
  }
  const joinedEntries = scheduleDoc.schedule.trials.map((t) => ({ t, key: `${t.block}|${t.arm}` }));
  const missing = joinedEntries.filter((j) => !payloads.has(j.key)).length;
  if (payloads.size !== 10 || missing !== 0 || hashMismatch !== 0) {
    await write("collection-integrity-report.json", { verdict: "STOP_BEFORE_ANY_CALL", payloads: payloads.size, missing, hashMismatch });
    fail("STOP_WITH_0_HIGH_LOW_CALLS", `payloads=${String(payloads.size)} missing=${String(missing)} hashMismatch=${String(hashMismatch)}`);
  }

  // ---- 3. primary executor (no fallback) ----------------------------------------------
  const apiKey = process.env["MODEL_API_KEY"];
  if (apiKey === undefined || apiKey.length === 0) fail("PRIMARY_EXECUTOR_UNAVAILABLE", "no credential; no substitution attempted");
  const endpoint = process.env["MODEL_API_BASE_URL"] ?? "https://api.deepseek.com";
  const model = process.env["MODEL_API_MODEL"] ?? "deepseek-flash";
  const transport = new OpenAiCompatibleTransportV0({
    base_url: endpoint,
    model,
    api_key: apiKey,
    timeout_ms: 120_000,
    temperature: 0,
    max_output_tokens: 256,
    provider_request_options: { thinking: { type: "disabled" } }
  }) as unknown as ModelTransportV0;

  // ---- 4/5/6/7. execute exactly, persist immediately, never adapt --------------------
  const records = [];
  for (const trial of scheduleDoc.schedule.trials) {
    const key = `${trial.block}|${trial.arm}`;
    const request = payloads.get(key);
    if (request === undefined) fail("D1_PAYLOAD_LOOKUP_FAILED", key);
    process.stdout.write(`[${String(trial.ordinal).padStart(3, "0")}/60] ${trial.block} ${trial.arm} r=${String(trial.replicate_ordinal)} ... `);
    const started = Date.now();
    let content: string | null = null;
    let failure: string | null = null;
    try {
      const response = await transport.complete(request);
      content = response.content;
    } catch (error) {
      failure = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    }
    const latency = Date.now() - started;
    const validation = failure === null ? validateV2Output(content ?? "", "PRIMARY") : { ok: false as const, code: "TRANSPORT_FAILED", detail: failure };
    const outcome = failure !== null ? "TRANSPORT_FAILED" : validation.ok ? "DECIDED" : "REJECTED";
    const decision = validation.ok ? validation.construct : null;
    const record = {
      global_ordinal: trial.ordinal,
      block: trial.block,
      arm: trial.arm,
      replicate_ordinal: trial.replicate_ordinal,
      frozen_payload_hash: payloadHashes.get(key) ?? null,
      schedule_hash: FROZEN_CORE_HASH,
      executor: { provider: "DeepSeek", model, endpoint, temperature: 0, max_output_tokens: 256, provider_thinking: "disabled" },
      outcome,
      parser_status: validation.ok ? "VALID" : (validation as { code: string }).code,
      parsed_decision: decision,
      raw_text: content,
      transport_status: failure === null ? "OK" : "FAILED",
      transport_failure: failure,
      latency_ms: latency,
      provider_request_metadata: "not exposed by the transport"
    };
    records.push(record);
    await write(`trial-${String(trial.ordinal).padStart(3, "0")}.json`, record);
    process.stdout.write(`${outcome}${decision === null ? "" : ` ${decision}`}\n`);
  }

  // ---- 9. collection integrity --------------------------------------------------------
  const expected = scheduleDoc.schedule.trials.map((t) => `${t.ordinal}|${t.block}|${t.arm}|${t.replicate_ordinal}`);
  const observed = records.map((r) => `${r.global_ordinal}|${r.block}|${r.arm}|${r.replicate_ordinal}`);
  const dupes = observed.length - new Set(observed).size;
  const blockCounts: Record<string, { HIGH: number; LOW: number }> = {};
  for (const r of records) {
    blockCounts[r.block] = blockCounts[r.block] ?? { HIGH: 0, LOW: 0 };
    blockCounts[r.block][r.arm as "HIGH" | "LOW"] += 1;
  }
  const complete =
    records.length === 60 && expected.length === 60 && dupes === 0 &&
    expected.every((e) => observed.includes(e)) &&
    Object.values(blockCounts).every((c) => c.HIGH === 6 && c.LOW === 6);
  await write("collection-integrity-report.json", {
    planned_core_trials: 60, observed_trial_records: records.length, duplicate_identities: dupes,
    missing_identities: expected.filter((e) => !observed.includes(e)).length,
    extra_identities: observed.filter((o) => !expected.includes(o)).length,
    block_counts: blockCounts, complete,
    retries: 0, replacements: 0, replicates_added: 0
  });
  if (!complete) fail("D1_CORE_TREATMENT_COLLECTION_INCOMPLETE", JSON.stringify({ records: records.length, dupes, blockCounts }));

  // ---- 10. freeze the raw dataset BEFORE scoring --------------------------------------
  const dataset = [...records].sort((a, b) => a.global_ordinal - b.global_ordinal);
  const datasetHash = String(await hashEnvelope(D1_HASH_PROJECTION_V0, { dataset }));
  await write("core-treatment-dataset.json", {
    ordered_by: "global_ordinal (the frozen schedule order)",
    treatment_outputs_scored: false,
    dataset
  });
  await write("core-treatment-dataset-hash.json", { CORE_TREATMENT_DATASET_SHA256: datasetHash, frozen_before_scoring: true });

  // ---- 11-16. scoring with the frozen implementation only ----------------------------
  const cellOf = (block: string, arm: "HIGH" | "LOW"): D1CellCountsV0 => {
    const rows = dataset.filter((r) => r.block === block && r.arm === arm);
    const counts = { ACCEPT: 0, VERIFY: 0, REJECT: 0 };
    let invalid = 0;
    for (const row of rows) {
      if (row.outcome === "DECIDED" && row.parsed_decision !== null) counts[row.parsed_decision as "ACCEPT"] += 1;
      else invalid += 1;
    }
    return { n: rows.length, ACCEPT: counts.ACCEPT, VERIFY: counts.VERIFY, REJECT: counts.REJECT, invalid };
  };
  const scored: Record<string, { high: D1CellCountsV0; low: D1CellCountsV0; verdict: D1ContrastVerdict; contrast: ReturnType<typeof computeContrastV0> }> = {};
  for (const block of BLOCKS) {
    const high = cellOf(block, "HIGH");
    const low = cellOf(block, "LOW");
    const contrast = computeContrastV0({ high, low, noise_ceiling: noiseCeiling });
    scored[block] = { high, low, contrast, verdict: classifyContrastV0(contrast) };
    await write(`${block}_scoring.json`, {
      block, high_counts: high, low_counts: low, contrast, contrast_verdict: scored[block]?.verdict,
      frozen_inputs: { noise_ceiling: noiseCeiling, delta_min: 0.5 },
      scorer: "classifyContrastV0 (frozen, uncopied)"
    });
  }

  const p1 = scored["P1_FULL"];
  const p2 = scored["P2_FULL"];
  const p3 = scored["P3_NEGATIVE_CONTROL"];
  const minimal = scored["P1_FRAME_MINIMAL"];
  const reversal = scored["STATE_REVERSAL"];
  if (p1 === undefined || p2 === undefined || p3 === undefined || minimal === undefined || reversal === undefined) {
    fail("D1_SCORING_FAILED", "a block is missing");
  }
  const nearTransfer = p2.verdict === "CONTRAST_POSITIVE" ? "NEAR_TRANSFER_SURVIVED" : "SCENARIO_BOUND";
  const negativeControl = classifyNegativeControlV0(p3.contrast);
  const frame = classifyFrameV0({ full: p1.verdict, minimal: minimal.verdict });
  const reversalTracksBelief = reversal.verdict === "CONTRAST_POSITIVE";

  await write("frame-interaction-report.json", {
    full_frame_verdict: p1.verdict, minimal_frame_verdict: minimal.verdict, frame_verdict: frame,
    matrix_used: "the frozen five-row frame matrix; no new interpretation category added"
  });
  await write("reconstruction-replication-report.json", {
    contrast_verdict: reversal.verdict,
    tracks_belief_value: reversalTracksBelief,
    supported_claim: reversalTracksBelief
      ? "STATE_EFFECT_REPLICATED_AFTER_FRESH_RECONSTRUCTION"
      : "WITHIN_IDENTITY_RECONSTRUCTION_NOT_TRACKING_BELIEF",
    interpretation_boundary: "governed by STATE_REVERSAL_INTERPRETATION_CONTRACT.json, frozen before any HIGH/LOW output",
    forbidden_and_not_claimed: [
      "second independent intervention", "second independent estimand",
      "independent behavioural mechanism", "cross-identity mediation",
      "double independent confirmation", "pooling with P1_FULL as statistically independent evidence"
    ]
  });

  const coreVerdict = {
    collection: "D1_CORE_TREATMENT_COMPLETED",
    dataset_hash: datasetHash,
    noise_ceiling: noiseCeiling,
    delta_min: 0.5,
    primary_P1_FULL: { verdict: p1.verdict, high: p1.high, low: p1.low, delta_verify: p1.contrast.delta_verify, delta_accept: p1.contrast.delta_accept, invalid_fraction: p1.contrast.invalid_fraction },
    near_transfer_P2_FULL: { verdict: p2.verdict, label: nearTransfer },
    specificity_P3: { verdict: negativeControl, high: p3.high, low: p3.low },
    frame: { verdict: frame, full: p1.verdict, minimal: minimal.verdict },
    reconstruction_replication: { verdict: reversal.verdict, tracks_belief: reversalTracksBelief },
    notes: "the five blocks are the frozen evidence families; P1_FULL and STATE_REVERSAL are NOT pooled as independent evidence"
  };
  await write("core-scientific-verdict.json", coreVerdict);
  await write("block-counts.json", blockCounts);

  // ---- 18. restart unlock decision (materialize only, never execute) ------------------
  const unlocked = p1.verdict === "CONTRAST_POSITIVE";
  await write("restart-unlock-decision.json", {
    predicate: "the frozen direct-positive predicate on P1_FULL: contrast verdict CONTRAST_POSITIVE",
    predicate_satisfied: unlocked,
    restart_status: unlocked ? "RESTART_CONTRAST_UNLOCKED" : "RESTART_CONTRAST_LOCKED",
    restart_schedule_materialized: false,
    restart_calls_executed: 0,
    note: "this round materializes no restart schedule and executes no restart call"
  });

  await write("CORE_TREATMENT_MANIFEST.json", {
    verdict: "D1_CORE_TREATMENT_COMPLETED",
    model_calls_this_round: 60,
    model_calls_total: 66,
    schedule_hash: FROZEN_CORE_HASH,
    dataset_hash: datasetHash,
    core_verdict: coreVerdict,
    restart_status: unlocked ? "RESTART_CONTRAST_UNLOCKED" : "RESTART_CONTRAST_LOCKED",
    preregistration_hash: manifest.preregistration_hash
  });

  process.stdout.write(`\nD1_CORE_TREATMENT_COMPLETED\n`);
  process.stdout.write(`dataset hash = ${datasetHash}\n`);
  process.stdout.write(`P1 = ${p1.verdict} (dV=${p1.contrast.delta_verify.toFixed(3)} dA=${p1.contrast.delta_accept.toFixed(3)})\n`);
  process.stdout.write(`P2 = ${p2.verdict} -> ${nearTransfer}\nP3 = ${negativeControl}\nframe = ${frame}\nreversal = ${reversal.verdict}\n`);
  process.stdout.write(`restart = ${unlocked ? "RESTART_CONTRAST_UNLOCKED" : "RESTART_CONTRAST_LOCKED"}\n`);
}

await main();
