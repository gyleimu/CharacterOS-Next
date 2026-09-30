/* eslint-disable no-restricted-imports -- Isolated research harness COMPOSING frozen production seams (repository convention); no production semantics are copied. */
/**
 * D1 Phase B — NEUTRAL noise pilot (exactly 6 calls) + r_confirm derivation + schedule freeze.
 *
 *   MODEL_API_KEY=... node research/experiments/belief-state-sensitivity-d1/phase-b.ts <outdir>
 *
 * It reads the A2-CERTIFIED neutral final request, builds ONE payload, reuses it for all six
 * calls, and never runs a HIGH/LOW treatment call.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { hashEnvelope } from "../../../packages/subject-core/dist/index.js";
import { OpenAiCompatibleTransportV0 } from "../../../packages/runtime/dist/transports/model-transport.js";
import type { ModelTransportRequestV0, ModelTransportV0 } from "../../../packages/runtime/dist/transports/model-transport.js";

import { D1_AMENDMENT_VERSION, D1_BLOCKS, D1_SCORING_CONSTANTS, planScheduleV0 } from "./amendment.ts";
import { D1_DELTA_MIN, deriveD1ManifestV0, deriveRConfirmV0 } from "./contract.ts";
import { validateV2Output } from "../decision-probe-v2/probe-v2.ts";

const A2 = "research/experiments/belief-state-sensitivity-d1/evidence/run-001/phase-a-full-request/a2-final-request";
const REV_2_HASH = "sha256:d0255beeed92729e7391049739ee008c2505c2c0ef7d009b2b799e3444cd4b3b";
const REV_3_HASH = "sha256:1781b3458fd760a73c27adb224e29e4c9d156ac60815383ac1d65e2dd298b60c";
const REV_4_HASH = "sha256:ed8e6949f9b4cf2b393e3ec57d6b87682dd05ef03507edc3bb42dc2ab327f885";

async function main(): Promise<void> {
  const outdir = process.argv[2];
  if (outdir === undefined) throw new Error("usage: node phase-b.ts <outdir>");
  await mkdir(outdir, { recursive: true });
  const write = async (name: string, value: unknown): Promise<void> => {
    await writeFile(join(outdir, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");
  };

  // ---- 1/2. the certified request, built ONCE -----------------------------------------
  const certified = JSON.parse(
    await readFile(join(A2, "final-request-neutral.json"), "utf8")
  ) as { request: ModelTransportRequestV0; probe_request_hash: string };
  const request = certified.request;
  const pilotRequestHash = String(
    await hashEnvelope("characteros-next/research/decision-probe/request/v0", request as unknown)
  );
  await write("neutral-certified-request.json", {
    source_artifact: "a2-final-request/final-request-neutral.json",
    probe_request_hash: certified.probe_request_hash,
    recomputed_request_hash: pilotRequestHash,
    reused_for_all_six_trials: true,
    rebuilt: false,
    instrument_reapplied: false
  });
  await write("pilot-request-hash.json", {
    pilot_request_hash: pilotRequestHash,
    expectation: "all six trials must report this exact model_facing_request_hash"
  });

  // ---- 4. executor identity (frozen) ---------------------------------------------------
  const apiKey = process.env["MODEL_API_KEY"];
  const endpoint = process.env["MODEL_API_BASE_URL"] ?? "https://api.deepseek.com";
  const model = process.env["MODEL_API_MODEL"] ?? "deepseek-flash";
  if (apiKey === undefined || apiKey.length === 0) {
    await write("D1_NOISE_PILOT_STOP.json", {
      verdict: "PRIMARY_EXECUTOR_UNAVAILABLE",
      model_calls_transmitted: 0,
      executor_substituted: false
    });
    process.stdout.write("PRIMARY_EXECUTOR_UNAVAILABLE (no credential; no substitution attempted)\n");
    return;
  }
  const transport = new OpenAiCompatibleTransportV0({
    base_url: endpoint,
    model,
    api_key: apiKey,
    timeout_ms: 120_000,
    temperature: 0,
    max_output_tokens: 256,
    provider_request_options: { thinking: { type: "disabled" } }
  }) as unknown as ModelTransportV0;

  // ---- 5/6. exactly six calls, persisted before interpretation ------------------------
  const counts: Record<string, number> = { ACCEPT: 0, VERIFY: 0, REJECT: 0 };
  let invalid = 0;
  const trials = [];
  for (let ordinal = 1; ordinal <= 6; ordinal += 1) {
    process.stdout.write(`[pilot ${String(ordinal)}/6] ... `);
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
    if (validation.ok) counts[decision as string] = (counts[decision as string] ?? 0) + 1;
    else invalid += 1;
    const trial = {
      trial_id: `d1-pilot-neutral-${String(ordinal).padStart(3, "0")}`,
      trial_ordinal: ordinal,
      phase: "NEUTRAL_NOISE_PILOT",
      arm: "NEUTRAL",
      probe_id: "D1-P1-AWAITING-INSPECTION",
      frame: "FULL",
      model_facing_request_hash: pilotRequestHash,
      executor: { provider: "DeepSeek", model, endpoint, temperature: 0, max_output_tokens: 256, provider_thinking: "disabled" },
      outcome,
      parser_status: validation.ok ? "VALID" : (validation as { code: string }).code,
      parsed_decision: decision,
      raw_output: content,
      transport_failure: failure,
      latency_ms: latency,
      provider_metadata: "not captured beyond the transport response (transport exposes no request id)"
    };
    trials.push(trial);
    await write(`trial-${String(ordinal).padStart(3, "0")}.json`, trial);
    process.stdout.write(`${outcome}${decision === null ? "" : ` ${decision}`}\n`);
  }

  const modalCount = Math.max(...Object.values(counts));
  const topEntries = Object.entries(counts).filter(([, value]) => value === modalCount);
  const modal = topEntries.length === 1 && modalCount > 0 ? topEntries[0]?.[0] ?? null : null;

  await write("pilot-counts.json", { counts, invalid, total: 6, modal, modal_count: modalCount, tie: topEntries.length > 1 });
  await write("pilot-noise-report.json", {
    pilot_state: "NEUTRAL",
    pilot_credence: 0.5,
    probe_id: "D1-P1-AWAITING-INSPECTION",
    frame: "FULL",
    replicates: 6,
    byte_identical_requests: trials.every((t) => t.model_facing_request_hash === pilotRequestHash),
    distinct_request_hashes_observed: [...new Set(trials.map((t) => t.model_facing_request_hash))].length,
    agreement: modalCount / 6,
    disagreement_rate: (6 - modalCount) / 6,
    invalid_count: invalid,
    transport_metadata_note: "provider/HTTP metadata is not experimental content; the scientific object is the frozen model-facing request, which was byte-identical across all six trials",
    planning_values: { noise_ceiling_target: 0.4, delta_min: D1_DELTA_MIN, invalid_fraction_max: D1_SCORING_CONSTANTS.invalid_fraction_max }
  });

  // ---- 7/8. mechanical r_confirm ------------------------------------------------------
  const decision = deriveRConfirmV0(modalCount);
  await write("r-confirm-derivation.json", {
    ...decision,
    rule: "frozen deterministic mapping from modal_count (contract.ts D1_R_CONFIRM_TABLE)",
    hand_computed_or_adjusted: false,
    modal_tie_handled_by_frozen_implementation: true
  });

  if (decision.verdict !== "R_CONFIRM_FROZEN" || decision.r_confirm === null) {
    await write("D1_NOISE_PILOT_STOP.json", {
      verdict: "INCONCLUSIVE_BY_DECISION_NOISE",
      modal_count: modalCount,
      r_confirm: null,
      model_calls_transmitted: 6,
      high_low_treatment_started: false,
      treatment_schedule_generated: false
    });
    process.stdout.write(`\nD1_EXECUTION_STARTED\nINCONCLUSIVE_BY_DECISION_NOISE\nHIGH_LOW_TREATMENT_NOT_STARTED\n`);
    process.stdout.write(`modal=${String(modal)} modal_count=${String(modalCount)}\n`);
    return;
  }

  // ---- 11/12/13. freeze the ACTUAL treatment schedule --------------------------------
  const manifest = await deriveD1ManifestV0();
  const schedule = await planScheduleV0({
    preregistration_hash: manifest.preregistration_hash,
    r_confirm: decision.r_confirm,
    blocks: D1_BLOCKS
  });
  const audit = {
    deterministic: true,
    balanced_all_blocks: schedule.blocks.every((b) => b.high_count === decision.r_confirm && b.low_count === decision.r_confirm),
    max_run_length: Math.max(...schedule.blocks.map((b) => b.max_run_length)),
    max_run_constraint: "<= 2 (frozen pair-wise construction)",
    outcome_dependency: false,
    replicate_ordinal_model_facing: false,
    protocol_chain: {
      revision_2: REV_2_HASH,
      revision_3: REV_3_HASH,
      revision_4: REV_4_HASH,
      current_effective_preregistration_hash: manifest.preregistration_hash
    },
    actual_r_confirm: decision.r_confirm,
    frozen_block_list: D1_BLOCKS,
    scheduled_trials: schedule.trials.length,
    high_low_calls_executed: 0
  };
  await write("D1_EXECUTION_SCHEDULE_ACTUAL.json", {
    schedule_spec_version: D1_AMENDMENT_VERSION,
    created_before_first_treatment_call: true,
    treatment_calls_made_at_freeze: 0,
    audit,
    schedule
  });
  await write("treatment-schedule-hash.json", {
    schedule_hash: schedule.schedule_hash,
    preregistration_hash_used: manifest.preregistration_hash,
    protocol_chain: audit.protocol_chain
  });
  await write("treatment-schedule-audit.json", audit);
  await write("NOISE_PILOT_MANIFEST.json", {
    pilot_request_hash: pilotRequestHash,
    modal: modal,
    modal_count: modalCount,
    r_confirm: decision.r_confirm,
    schedule_hash: schedule.schedule_hash,
    model_calls_transmitted: 6,
    high_low_treatment_started: false
  });

  process.stdout.write(`\nD1_EXECUTION_STARTED\nNEUTRAL_NOISE_PILOT_COMPLETED\nr_confirm = ${String(decision.r_confirm)}\nD1_TREATMENT_SCHEDULE_FROZEN\nHIGH_LOW_TREATMENT_NOT_STARTED\n`);
  process.stdout.write(`modal=${String(modal)} modal_count=${String(modalCount)} schedule_hash=${schedule.schedule_hash}\n`);
}

await main();
