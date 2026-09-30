/* eslint-disable no-restricted-imports -- Isolated research harness COMPOSING frozen production seams (repository convention); no production semantics are copied. */
/**
 * D2 A1 — THE FROZEN HIGH/LOW STATE EXPERIMENT. EXACTLY TWELVE CALLS.
 *
 *   MODEL_API_KEY=... node research/experiments/belief-causal-path-d2/a1-state-experiment.ts <freezeDir> <pilotDir> <outDir>
 *
 * REBUILDS NOTHING. No world, subject state, observation, projection, pristine request, transformed
 * request, paraphrase or schedule is constructed here. The loop is:
 *
 *   schedule entry -> frozen payload from disk -> hash assertion -> one provider attempt -> persist
 *
 * One trial is one attempt: a legal token, a malformed output, a parser rejection, a transport failure
 * or a missing result all consume that trial. No retry, no replacement, no deletion, no thirteenth
 * call, no moving a failed trial to the end, no substituting a later valid output.
 *
 * Scoring is delegated to the frozen `classifyA1StateExperimentV0`; this file never decides a verdict.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { hashEnvelope } from "../../../packages/subject-core/dist/index.js";
import type { ModelTransportRequestV0, ModelTransportV0 } from "../../../packages/runtime/dist/transports/model-transport.js";
import { OpenAiCompatibleTransportV0 } from "../../../packages/runtime/dist/transports/model-transport.js";

import { D2_HASH_PROJECTION_V0, D2A1_PARAPHRASE, D2A1_TOKENS } from "./contract-rev1.ts";
import {
  D2A1_ANCHORS_FROZEN_V0,
  D2A1_CONTRACT_TEXT,
  deriveD2Rev11cManifestV0
} from "./contract-rev1-1c-a1-prerequisites.ts";
import {
  D2A1_STATE_SCHEDULE_IDENTITIES,
  D2A1_TREATMENT_RECOVERY_POLICY,
  classifyA1StateExperimentV0,
  deriveD2Rev11eManifestV0,
  type A1StateRecordV0
} from "./contract-rev1-1e-a1-state-scoring.ts";
import { A0_MARKER, B_MARKER, DP_V2_MARKER, A1_MARKER } from "./transformer-a1.ts";
import { D1_PROPOSITION_LABEL } from "../belief-state-sensitivity-d1/contract.ts";

const REQUEST_HASH_PROJECTION = "characteros-next/research/decision-probe/request/v0" as const;
const TRANSFORMER_SOURCE = "research/experiments/belief-causal-path-d2/transformer-a1.ts" as const;
const FROZEN_TRANSFORMER_SOURCE_HASH =
  "sha256:628c5094deee14dea88b79b8e1a65692f9cd9766490347f2ba2e6c3125172406" as const;
const SCHEDULE_FILE = "A1_STATE_EXPERIMENT_SCHEDULE.json" as const;

function fail(verdict: string, detail: string): never {
  throw new Error(`${verdict}: ${detail}`);
}

interface ScheduleEntry {
  readonly position: number;
  readonly arm: "HIGH" | "LOW";
  readonly request_hash: string;
}
interface ScheduleDoc {
  readonly r_confirm_A1: number;
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
  readonly provider_attempt_status: "SUCCEEDED" | "FAILED";
  readonly raw_response: string | null;
  readonly parsed_stance_token: string | null;
  readonly parser_status: "VALID" | "INVALID";
  readonly transport_status: "OK" | "FAILED";
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
  if (!(D2A1_TOKENS as readonly string[]).includes(stance)) return { ok: false, reason: "token outside the frozen A1 stance vocabulary" };
  return { ok: true, token: stance };
}

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

function ngrams(text: string, n: number): string[] {
  const words = text.toLowerCase().split(/\s+/).filter((w) => w.length > 0);
  const out: string[] = [];
  for (let index = 0; index + n <= words.length; index += 1) out.push(words.slice(index, index + n).join(" "));
  return out;
}

async function main(): Promise<void> {
  const freezeDir = process.argv[2];
  const pilotDir = process.argv[3];
  const outDir = process.argv[4];
  if (freezeDir === undefined || pilotDir === undefined || outDir === undefined) {
    throw new Error("usage: node a1-state-experiment.ts <freezeDir> <pilotDir> <outDir>");
  }
  await mkdir(outDir, { recursive: true });
  const write = async (dir: string, name: string, value: unknown): Promise<string> => {
    const content = `${JSON.stringify(value, null, 2)}\n`;
    await writeFile(join(dir, name), content, "utf8");
    return String(await hashEnvelope(D2_HASH_PROJECTION_V0, { name, content }));
  };

  // ---- 1. frozen inputs only ------------------------------------------------------------------
  const manifest = JSON.parse(await readFile(join(freezeDir, "A1_CHARACTEROS_REQUEST_SET_MANIFEST.json"), "utf8")) as Record<string, unknown>;
  const highDoc = JSON.parse(await readFile(join(freezeDir, "final-high.json"), "utf8")) as { final_request_hash: string; request: ModelTransportRequestV0; credence: number };
  const lowDoc = JSON.parse(await readFile(join(freezeDir, "final-low.json"), "utf8")) as { final_request_hash: string; request: ModelTransportRequestV0; credence: number };
  const scheduleRaw = await readFile(join(pilotDir, SCHEDULE_FILE), "utf8");
  const schedule = JSON.parse(scheduleRaw) as ScheduleDoc;
  const scheduleHashDoc = JSON.parse(await readFile(join(pilotDir, "schedule-hash.json"), "utf8")) as { schedule_hash: string };

  // ---- 2. pre-execution integrity, before the first call ---------------------------------------
  const recomputedScheduleHash = String(await hashEnvelope(D2_HASH_PROJECTION_V0, { name: SCHEDULE_FILE, content: scheduleRaw }));
  const recomputedHigh = String(await hashEnvelope(REQUEST_HASH_PROJECTION, highDoc.request as unknown));
  const recomputedLow = String(await hashEnvelope(REQUEST_HASH_PROJECTION, lowDoc.request as unknown));
  const sourceHash = String(await hashEnvelope(D2_HASH_PROJECTION_V0, { source: await readFile(TRANSFORMER_SOURCE, "utf8") }));
  const rev11c = await deriveD2Rev11cManifestV0();
  const contractHash = String(await hashEnvelope(D2_HASH_PROJECTION_V0, { contract_text: D2A1_CONTRACT_TEXT }));
  const entries = [...schedule.trials];
  const positions = entries.map((e) => e.position);
  const identityParity = entries.map((entry, index) => {
    const frozen = D2A1_STATE_SCHEDULE_IDENTITIES[index];
    return {
      position: entry.position,
      position_matches: frozen?.position === entry.position,
      arm_matches: frozen?.arm === entry.arm,
      arm_and_hash_match:
        frozen?.arm === entry.arm && entry.request_hash === (entry.arm === "HIGH" ? recomputedHigh : recomputedLow)
    };
  });
  // Semantic structure re-asserted on the FROZEN bytes, not rebuilt.
  const structureRecheck: Record<string, unknown> = {};
  let structureOk = true;
  for (const [arm, doc] of [["HIGH", highDoc], ["LOW", lowDoc]] as const) {
    const sys = doc.request.messages[0]?.content ?? "";
    const user = doc.request.messages[1]?.content ?? "";
    const contractText = sys.slice(sys.length - D2A1_CONTRACT_TEXT.length);
    const productionPrefix = sys.slice(0, sys.length - D2A1_CONTRACT_TEXT.length);
    const row = {
      // The frozen request alone does not carry its pristine twin, so the prefix check is stated as
      // properties that can actually fail: the production prefix must be non-empty and must contain
      // nothing that belongs to the measurement contract.
      production_prefix_is_non_empty: productionPrefix.length > 0,
      production_prefix_contains_no_a1_contract_marker: !productionPrefix.includes(A1_MARKER),
      production_prefix_contains_no_paraphrase: !productionPrefix.includes(D2A1_PARAPHRASE),
      canonical_wording_present_in_the_subject_state: user.includes(D1_PROPOSITION_LABEL),
      paraphrase_absent_from_the_subject_state: !user.includes(D2A1_PARAPHRASE),
      paraphrase_present_once_in_the_contract: countOccurrences(contractText, D2A1_PARAPHRASE) === 1,
      canonical_wording_absent_from_the_contract: !contractText.includes(D1_PROPOSITION_LABEL),
      contract_is_present_exactly_once: countOccurrences(sys, D2A1_CONTRACT_TEXT) === 1,
      anchors_present: Object.values(D2A1_ANCHORS_FROZEN_V0).every((m) => sys.includes(m)),
      no_a0_contract: !sys.includes(A0_MARKER),
      no_b_contract: !sys.includes(B_MARKER),
      no_decision_probe_v2: !sys.includes(DP_V2_MARKER),
      a1_contract_marker_present: sys.includes(A1_MARKER),
      canonical_wording_and_paraphrase_share_no_4gram:
        ngrams(D1_PROPOSITION_LABEL, 4).filter((g) => ngrams(D2A1_PARAPHRASE, 4).includes(g)).length === 0
    };
    if (Object.values(row).some((v) => v !== true)) structureOk = false;
    structureRecheck[arm] = { ...row, pass: Object.values(row).every((v) => v === true) };
  }
  const integrity = {
    schedule_entries: entries.length,
    positions_are_1_to_12_in_order: positions.every((p, i) => p === i + 1),
    high_entries: entries.filter((e) => e.arm === "HIGH").length,
    low_entries: entries.filter((e) => e.arm === "LOW").length,
    neutral_or_unknown_entries: entries.filter((e) => e.arm !== "HIGH" && e.arm !== "LOW").length,
    duplicate_trial_identities: positions.length - new Set(positions).size,
    missing_identities: 12 - entries.length,
    high_request_hash_exact: recomputedHigh === String(manifest["high_final_request_hash"]) && recomputedHigh === highDoc.final_request_hash,
    low_request_hash_exact: recomputedLow === String(manifest["low_final_request_hash"]) && recomputedLow === lowDoc.final_request_hash,
    every_identity_carries_its_frozen_arm_and_hash: identityParity.every((p) => p.arm_and_hash_match),
    schedule_hash_recorded: scheduleHashDoc.schedule_hash,
    schedule_hash_recomputed: recomputedScheduleHash,
    schedule_hash_exact: recomputedScheduleHash === scheduleHashDoc.schedule_hash,
    r_confirm_A1: schedule.r_confirm_A1,
    total_calls_planned: schedule.total_calls,
    transformer_source_hash: sourceHash,
    transformer_source_unchanged: sourceHash === FROZEN_TRANSFORMER_SOURCE_HASH,
    a1_contract_hash: contractHash,
    a1_contract_hash_unchanged: contractHash === rev11c.contract_text_hash,
    semantic_structure_recheck: structureRecheck,
    semantic_structure_audit_still_passes: structureOk,
    rebuilt_anything_at_runtime: false
  };
  const integrityOk =
    integrity.schedule_entries === 12 &&
    integrity.positions_are_1_to_12_in_order &&
    integrity.high_entries === 6 &&
    integrity.low_entries === 6 &&
    integrity.neutral_or_unknown_entries === 0 &&
    integrity.duplicate_trial_identities === 0 &&
    integrity.missing_identities === 0 &&
    integrity.high_request_hash_exact &&
    integrity.low_request_hash_exact &&
    integrity.every_identity_carries_its_frozen_arm_and_hash &&
    integrity.schedule_hash_exact &&
    integrity.transformer_source_unchanged &&
    integrity.a1_contract_hash_unchanged &&
    structureOk;
  if (!integrityOk) {
    await write(outDir, "pre-execution-integrity-report.json", { ...integrity, verdict: "D2_A1_STATE_EXPERIMENT_BLOCKED_BY_INTEGRITY_FAILURE", calls_made: 0 });
    fail("D2_A1_STATE_EXPERIMENT_BLOCKED_BY_INTEGRITY_FAILURE", JSON.stringify(integrity));
  }
  await write(outDir, "pre-execution-integrity-report.json", { ...integrity, verdict: "D2_A1_STATE_EXPERIMENT_INTEGRITY_HOLDS" });

  // ---- 3. the frozen primary executor ----------------------------------------------------------
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

  // ---- 4. the frozen ordering, exactly as written ----------------------------------------------
  const trials: Trial[] = [];
  const replicateCounter: Record<"HIGH" | "LOW", number> = { HIGH: 0, LOW: 0 };
  for (const [index, entry] of entries.entries()) {
    const identity = D2A1_STATE_SCHEDULE_IDENTITIES[index] as { trial_id: string };
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
    const parsed = failure === null ? parseA1(content ?? "") : ({ ok: false as const, reason: "transport failure, classified as a failed provider attempt" });
    const trial: Trial = {
      trial_id: identity.trial_id,
      global_ordinal: index + 1,
      schedule_position: entry.position,
      arm: entry.arm,
      replicate_ordinal: replicateCounter[entry.arm],
      request_hash: entry.request_hash,
      provider_attempt_status: failure === null ? "SUCCEEDED" : "FAILED",
      raw_response: content,
      parsed_stance_token: parsed.ok ? parsed.token : null,
      parser_status: parsed.ok ? "VALID" : "INVALID",
      transport_status: failure === null ? "OK" : "FAILED",
      invalid_reason: parsed.ok ? null : parsed.reason,
      provider_response_model: responseModel,
      executor,
      generation_settings: generationSettings,
      latency_ms: latency
    };
    trials.push(trial);
    await write(outDir, `trial-${String(index + 1).padStart(3, "0")}.json`, trial);
    process.stdout.write(`${parsed.ok ? parsed.token : `INVALID: ${parsed.reason}`}\n`);
  }

  // ---- 8. collection integrity -----------------------------------------------------------------
  const collection = {
    planned_identities: 12,
    trial_records: trials.length,
    high_records: trials.filter((t) => t.arm === "HIGH").length,
    low_records: trials.filter((t) => t.arm === "LOW").length,
    duplicate_trial_identities: trials.length - new Set(trials.map((t) => t.trial_id)).size,
    missing_identities: D2A1_STATE_SCHEDULE_IDENTITIES.filter((e) => !trials.some((t) => t.trial_id === e.trial_id)).length,
    extra_identities: trials.filter((t) => !D2A1_STATE_SCHEDULE_IDENTITIES.some((e) => e.trial_id === t.trial_id)).length,
    recorded_arm_equals_frozen_arm_for_every_identity: trials.every(
      (t) => D2A1_STATE_SCHEDULE_IDENTITIES.find((e) => e.trial_id === t.trial_id)?.arm === t.arm
    ),
    recorded_request_hash_equals_frozen_schedule_hash: trials.every(
      (t, index) => t.request_hash === entries[index]?.request_hash
    ),
    invalid_trials: trials.filter((t) => t.parsed_stance_token === null).length,
    transport_failures: trials.filter((t) => t.transport_status !== "OK").length,
    frozen_ordering_preserved: trials.every((t, index) => t.schedule_position === entries[index]?.position && t.arm === entries[index]?.arm),
    provider_calls_instead_of_planned_denominator: false,
    executor,
    verdict: "D2_A1_STATE_EXPERIMENT_COLLECTION_COMPLETE"
  };
  await write(outDir, "collection-integrity-report.json", collection);

  // ---- 9. freeze the dataset BEFORE scoring ----------------------------------------------------
  const datasetHash = await write(outDir, "a1-state-dataset.json", {
    stage: "D2_A1_STATE_EXPERIMENT",
    arm_credences: { HIGH: highDoc.credence, LOW: lowDoc.credence },
    planned: 12,
    observed: trials.length,
    scored: false,
    trials
  });
  await write(outDir, "a1-state-dataset-hash.json", {
    A1_STATE_EXPERIMENT_DATASET_SHA256: datasetHash,
    frozen_before_any_scientific_scoring: true,
    planned: 12,
    observed: trials.length
  });

  // ---- 10. the frozen scorer, called over the frozen bytes -------------------------------------
  const frozenDoc = JSON.parse(await readFile(join(outDir, "a1-state-dataset.json"), "utf8")) as { trials: Trial[] };
  if (frozenDoc.trials.length !== 12) fail("D2_A1_STATE_EXPERIMENT_DATASET_INCOMPLETE", String(frozenDoc.trials.length));
  const frozenRecords: A1StateRecordV0[] = frozenDoc.trials.map((t) => ({
    trial_id: t.trial_id,
    arm: t.arm,
    parsed_stance_token: t.parsed_stance_token
  }));
  const outcome = classifyA1StateExperimentV0({ records: frozenRecords, schedule: D2A1_STATE_SCHEDULE_IDENTITIES });
  const rev11e = await deriveD2Rev11eManifestV0();

  await write(outDir, "arm-counts.json", {
    counts_source: "the frozen a1-state-dataset.json bytes, re-read from disk",
    high_counts: outcome.high_counts,
    low_counts: outcome.low_counts,
    invalid_count: outcome.invalid_count,
    invalid_trials_are_not_a_modal_category: true
  });
  await write(outDir, "unique-modal-report.json", {
    high_unique_modal: outcome.high_unique_modal,
    low_unique_modal: outcome.low_unique_modal,
    high_modal_tie: outcome.high_modal_tie,
    low_modal_tie: outcome.low_modal_tie,
    unique_modal_definition: "the token with a strictly highest count; a tie yields null",
    permissive_interpretation_used: false
  });
  await write(outDir, "scorer-output.json", {
    scorer: "classifyA1StateExperimentV0 (REV1.1e, frozen) — called, not re-implemented",
    scorer_manifest_hash: rev11e.manifest_hash,
    input_was_the_frozen_dataset: true,
    output: outcome
  });

  const scientificVerdict = {
    stage: "D2_A1_STATE_EXPERIMENT",
    execution_status: "D2_A1_STATE_EXPERIMENT_COMPLETED",
    outcome_class: outcome.outcome_class,
    verdict: outcome.verdict,
    positive_predicate: outcome.positive_predicate,
    collection_integrity: outcome.collection_integrity,
    collection_integrity_failures: outcome.collection_integrity_failures,
    invalid_count: outcome.invalid_count,
    scientific_scoring_executed: outcome.scientific_scoring_executed,
    high_unique_modal: outcome.high_unique_modal,
    low_unique_modal: outcome.low_unique_modal,
    dataset_hash: datasetHash,
    r_confirm_A1: 6,
    calls_per_arm: 6,
    total_calls: 12,
    link_3b_status:
      outcome.outcome_class === "POSITIVE"
        ? "LINK 3B ESTABLISHED ON THE PREREGISTERED PARAPHRASE"
        : outcome.outcome_class === "NULL"
          ? "LINK 3B NOT ESTABLISHED (valid null)"
          : "LINK 3B NOT ADJUDICATED (inconclusive run)",
    claim_scope_note: outcome.claim_scope_note,
    non_claims: [
      "NOT global semantic understanding",
      "NOT cognition use, appraisal effect or decision effect",
      "NOT a statement that D1 was overturned",
      "NOT human-like understanding",
      "the term 'cognitively inert' is licensed only by A0 positive + A1 positive + B null, and is not used here"
    ]
  };
  await write(outDir, "a1-scientific-verdict.json", scientificVerdict);
  const unlockHash = await write(outDir, "d2-b-unlock-decision.json", {
    d2_b_authorised: outcome.d2_b_authorised,
    decision_basis: outcome.verdict,
    d2_b_executed_this_round: false,
    reason: outcome.d2_b_authorised
      ? "the frozen scorer returned the preregistered positive; B is authorised but belongs to a later round"
      : outcome.outcome_class === "NULL"
        ? "the frozen scorer returned a valid null; a null treatment result does not unlock the next stage"
        : "the run was inconclusive; an inconclusive run authorises nothing",
    d2_execution_stopped_at: outcome.outcome_class === "NULL" ? "D2_EXECUTION_STOPPED_AT_A1" : null
  });
  await write(outDir, "A1_STATE_EXPERIMENT_MANIFEST.json", {
    ...scientificVerdict,
    frozen_request_identity: {
      high_final_request_hash: recomputedHigh,
      low_final_request_hash: recomputedLow,
      request_set_manifest_hash: "sha256:5be552f3c0d76ebdbd537b7af2d7ffdcb33a585ac1f100540971a7e1b218810e"
    },
    frozen_schedule_identity: {
      schedule_hash: recomputedScheduleHash,
      ordering: entries.map((e) => e.arm).join(" "),
      ordering_rule_respected: collection.frozen_ordering_preserved,
      r_confirm_A1: schedule.r_confirm_A1
    },
    frozen_policy: {
      recovery_policy: D2A1_TREATMENT_RECOVERY_POLICY.on_any_invalid.verdict,
      invariant: "one scheduled trial = one provider attempt; no retry, replacement, deletion, extra replicate or thirteenth call"
    },
    unlock_decision_hash: unlockHash,
    d2_model_calls_this_round: 12,
    d2_model_calls_cumulative: 54,
    d2_b_executed_this_round: false,
    executor
  });

  process.stdout.write(
    `\n${scientificVerdict.execution_status}\n${outcome.outcome_class}: ${outcome.verdict}\nHIGH ${JSON.stringify(outcome.high_counts)}\nLOW  ${JSON.stringify(outcome.low_counts)}\n` +
      `unique modals: ${String(outcome.high_unique_modal)} / ${String(outcome.low_unique_modal)}\nd2_b_authorised=${String(outcome.d2_b_authorised)}\n` +
      `D2_MODEL_CALLS_THIS_ROUND = 12\n`
  );
}

await main();
