/* eslint-disable no-restricted-imports -- Isolated research harness over frozen built production roots (repository convention); zero production code changes. */
/**
 * D1 Phase B — NOISE PILOT ONLY. Six byte-identical calls on STATE_NEUTRAL.
 *
 *   CHARACTEROS_DECISION_PROBE_EXECUTOR=openai MODEL_API_KEY=... node phase-b-pilot.ts <outdir>
 *
 * Then mechanically derives r_confirm and freezes the ACTUAL treatment schedule. It never runs a
 * HIGH/LOW treatment call.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";


import { OpenAiCompatibleTransportV0 } from "../../../packages/runtime/dist/transports/model-transport.js";
import type { ModelTransportV0 } from "../../../packages/runtime/dist/transports/model-transport.js";

import {
  D1_BLOCKS,
  D1_AMENDMENT_VERSION,
  planScheduleV0
} from "./amendment.ts";
import { D1_P1, D1_STATE_LEVELS, deriveD1ManifestV0, deriveRConfirmV0 } from "./contract.ts";
import { V2_PRIMARY_SEMANTIC_CONTRACT } from "../decision-probe-v2/contract.ts";
import { runV2Trial, schemaForPhase } from "../decision-probe-v2/probe-v2.ts";
import { buildD1RequestV0, createBaseSubjectV0, derivePropositionV0, materializeLevelV0 } from "./state-construction.ts";

const SUBJECT_ID = "d1-belief-sensitivity-subject";

async function main(): Promise<void> {
  const outdir = process.argv[2];
  if (outdir === undefined) throw new Error("usage: node phase-b-pilot.ts <outdir>");
  await mkdir(outdir, { recursive: true });
  const write = async (name: string, value: unknown): Promise<void> => {
    await writeFile(join(outdir, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");
  };

  const apiKey = process.env["MODEL_API_KEY"];
  if (apiKey === undefined || apiKey.length === 0) {
    throw new Error("PRIMARY_EXECUTOR_UNAVAILABLE_FOR_D0_V2: MODEL_API_KEY absent");
  }
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

  const { seed } = await createBaseSubjectV0({
    subject_id: SUBJECT_ID,
    display_name: "D1 Subject",
    identity_anchors: ["characteros-next", "d1-preregistration"]
  });
  const proposition = await derivePropositionV0(SUBJECT_ID);
  const neutral = await materializeLevelV0({ baseSeed: seed, proposition, level: "NEUTRAL" });

  // ONE request, built once and reused for all six pilot calls: byte-identical by construction.
  const rendered = await buildD1RequestV0({
    state: neutral.state,
    contract: V2_PRIMARY_SEMANTIC_CONTRACT,
    schema: schemaForPhase("PRIMARY")
  });

  const trials = [];
  for (let ordinal = 1; ordinal <= 6; ordinal += 1) {
    process.stdout.write(`[pilot ${String(ordinal)}/6] ... `);
    const trial = await runV2Trial({
      transport,
      production_request: rendered.request,
      phase: "PRIMARY",
      contract: V2_PRIMARY_SEMANTIC_CONTRACT,
      fixture_id: D1_P1.probe_id,
      replicate_ordinal: ordinal
    });
    trials.push(trial);
    process.stdout.write(`${trial.outcome}${trial.construct === null ? "" : ` ${trial.construct}`}\n`);
  }
  void schemaForPhase;

  const counts: Record<string, number> = { ACCEPT: 0, VERIFY: 0, REJECT: 0 };
  for (const trial of trials) {
    if (trial.outcome === "DECIDED" && trial.construct !== null) {
      counts[trial.construct] = (counts[trial.construct] ?? 0) + 1;
    }
  }
  const modalCount = Math.max(...Object.values(counts));
  const modal = Object.entries(counts).find(([, value]) => value === modalCount)?.[0] ?? null;
  const decision = deriveRConfirmV0(modalCount);
  const manifest = await deriveD1ManifestV0();

  await write("noise-pilot-trials.json", trials);
  await write("noise-pilot-report.json", {
    pilot_state: "STATE_NEUTRAL",
    pilot_state_credence: D1_STATE_LEVELS.NEUTRAL_NOISE_CALIBRATION,
    probe_id: D1_P1.probe_id,
    frame: "FULL (frozen DecisionProbeV2 primary contract)",
    replicates: 6,
    request_hash: trials[0]?.probe_request_hash ?? null,
    byte_identical_requests: new Set(trials.map((t) => t.probe_request_hash)).size === 1,
    counts,
    modal,
    modal_count: modalCount,
    agreement: modalCount / 6,
    disagreement_rate: (6 - modalCount) / 6,
    executor: { family: "openai", model, endpoint, temperature: 0, max_output_tokens: 256, provider_thinking: "disabled" }
  });
  await write("r-confirm-derivation.json", {
    ...decision,
    rule: "deterministic mapping from modal_count; see D1_SCORING_SPEC.json",
    derived_before_any_treatment_call: true
  });

  if (decision.verdict !== "R_CONFIRM_FROZEN" || decision.r_confirm === null) {
    await write("phase-b-verdict.json", {
      verdict: "INCONCLUSIVE_BY_DECISION_NOISE",
      model_calls_made: 6,
      treatment_calls_made: 0
    });
    process.stdout.write(`\nINCONCLUSIVE_BY_DECISION_NOISE (modal_count=${String(modalCount)})\n`);
    return;
  }

  const schedule = await planScheduleV0({
    preregistration_hash: manifest.preregistration_hash,
    r_confirm: decision.r_confirm,
    blocks: D1_BLOCKS
  });
  await write("D1_EXECUTION_SCHEDULE.json", {
    schedule_spec_version: D1_AMENDMENT_VERSION,
    frozen_before_first_treatment_call: true,
    treatment_calls_made_at_freeze: 0,
    r_confirm: decision.r_confirm,
    schedule
  });
  await write("phase-b-verdict.json", {
    verdict: "D1_TREATMENT_SCHEDULE_FROZEN",
    model_calls_made: 6,
    treatment_calls_made: 0,
    derived_r_confirm: decision.r_confirm,
    schedule_hash: schedule.schedule_hash,
    scheduled_trials: schedule.trials.length
  });

  process.stdout.write(`\nD1_TREATMENT_SCHEDULE_FROZEN\n`);
  process.stdout.write(`modal=${String(modal)} modal_count=${String(modalCount)} -> r_confirm=${String(decision.r_confirm)}\n`);
  process.stdout.write(`schedule_hash=${schedule.schedule_hash} trials=${String(schedule.trials.length)}\n`);
}

await main();
