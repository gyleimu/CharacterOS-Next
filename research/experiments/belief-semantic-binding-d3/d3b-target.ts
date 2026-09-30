/* eslint-disable no-restricted-imports -- Isolated research harness COMPOSING frozen production seams (repository convention); no production semantics are copied. */
/**
 * D3-B TARGET — EXACTLY SIX FROZEN CALLS. THEN STOP.
 *
 *   MODEL_API_KEY=... node research/experiments/belief-semantic-binding-d3/d3b-target.ts <rev5Dir> <outdir>
 *
 * ONE HONEST NOTE ABOUT READING THE FROZEN REQUEST. Revision 5 froze the corrected target's HASH and its
 * derivation (frozen state-blind base + frozen statement pair + frozen transformer), but did not store
 * the bytes as an artifact. This runner therefore reconstructs the request from exactly those frozen
 * pieces and asserts its hash equals the frozen value BEFORE using it, then persists the bytes. That is
 * the same verification discipline used everywhere else in this line: the frozen identity is the hash,
 * and a reconstruction that does not reproduce it would stop the run.
 *
 * The old invalid target (`70f69a1f…`) is never loaded, never verified against and never called.
 * Classification is delegated to the frozen `scoreD3BTargetV0`; the six tokens are never read by hand
 * before the scorer runs.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { canonicalJsonString, hashEnvelope } from "../../../packages/subject-core/dist/index.js";
import { OpenAiCompatibleTransportV0 } from "../../../packages/runtime/dist/transports/model-transport.js";
import type { ModelTransportRequestV0, ModelTransportV0 } from "../../../packages/runtime/dist/transports/model-transport.js";

import {
  D3_HASH_PROJECTION_V0,
  D3B_ANCHORS,
  D3B_CONTRACT_TEXT,
  D3B_INPUTS_FROZEN,
  D3B_JSON_SCHEMA,
  D3B_TOKENS
} from "./contract.ts";
import { D3B_INVALID_TARGET_REQUEST } from "./contract-rev5-target-state-blind.ts";
import { D3B_TARGET_PAIR, buildD3RelationReadoutRequestV0, renderD3BContractTextV0 } from "./transformer-d3b.ts";
import { scoreD3BTargetV0, type D3BTrialRecordV0 } from "./scorers-d3b.ts";
import { D1_CANONICAL_LABEL, buildProductionBaseRequestV0, stripBeliefBlockV0 } from "./qualification-base.ts";

const REQUEST_HASH_PROJECTION = "characteros-next/research/decision-probe/request/v0" as const;
const CORRECTED_TARGET_HASH = "sha256:27fe6b992b1d5b433ae889d7cbb5507c3818638e955e79112b4fe7f661c7b800" as const;
const TRANSFORMER_SOURCE = "research/experiments/belief-semantic-binding-d3/transformer-d3b.ts" as const;
const FROZEN_TRANSFORMER_SOURCE_HASH = "sha256:9daa5521e010597443d0d67801ba200b3811fc165804c18b6a94c11a460259aa" as const;
const TARGET_TRIAL_IDS = ["TARGET-001", "TARGET-002", "TARGET-003", "TARGET-004", "TARGET-005", "TARGET-006"] as const;
const A1_PARAPHRASE = D3B_INPUTS_FROZEN.statement_b;
const countOf = (haystack: string, needle: string): number => haystack.split(needle).length - 1;

function fail(verdict: string, detail: string): never {
  throw new Error(`${verdict}: ${detail}`);
}

interface TargetTrial {
  readonly trial_id: string;
  readonly request_hash: string;
  readonly raw_provider_response: string | null;
  readonly parsed_relation: string | null;
  readonly parser_status: "VALID" | "INVALID";
  readonly transport_status: "OK" | "FAILED";
  readonly invalid_reason: string | null;
  readonly provider_response_model: string | null;
  readonly executor: Record<string, unknown>;
  readonly generation_settings: Record<string, unknown>;
  readonly latency_ms: number;
}

function parseD3B(content: string): { ok: true; relation: string } | { ok: false; reason: string } {
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
    if (!["d3_relation_schema_version", "relation", "explanation"].includes(key)) return { ok: false, reason: `unknown member: ${key}` };
  }
  if (record["d3_relation_schema_version"] !== "d3-relation-readout-v0") return { ok: false, reason: "schema version mismatch" };
  const relation = record["relation"];
  if (typeof relation !== "string") return { ok: false, reason: "relation is not a string" };
  if (!(D3B_TOKENS as readonly string[]).includes(relation)) return { ok: false, reason: "relation outside the frozen D3-B vocabulary" };
  return { ok: true, relation };
}

async function main(): Promise<void> {
  const rev5Dir = process.argv[2];
  const outdir = process.argv[3];
  if (rev5Dir === undefined || outdir === undefined) throw new Error("usage: node d3b-target.ts <rev5Dir> <outdir>");
  await mkdir(outdir, { recursive: true });
  const write = async (name: string, value: unknown): Promise<string> => {
    const content = `${JSON.stringify(value, null, 2)}\n`;
    await writeFile(join(outdir, name), content, "utf8");
    return String(await hashEnvelope(D3_HASH_PROJECTION_V0, { name, content }));
  };

  // ---- 1/2/3. reconstruct the corrected request from the frozen pieces and verify its hash ---------
  const correctedManifest = JSON.parse(
    await readFile(join(rev5Dir, "D3_B_CORRECTED_TARGET_REQUEST_MANIFEST.json"), "utf8")
  ) as Record<string, unknown>;
  if (correctedManifest["corrected_target_hash"] !== CORRECTED_TARGET_HASH) fail("D3_B_TARGET_MANIFEST_HASH_MISMATCH", String(correctedManifest["corrected_target_hash"]));

  const base = await buildProductionBaseRequestV0();
  const pristine = Object.freeze({
    messages: Object.freeze([
      Object.freeze({ role: "system" as const, content: base.system_content }),
      Object.freeze({ role: "user" as const, content: stripBeliefBlockV0(base.user_content) })
    ]),
    structured_output: base.structured_output
  }) as unknown as ModelTransportRequestV0;
  const targetRequest = buildD3RelationReadoutRequestV0(pristine, D3B_TARGET_PAIR);
  // Widened so both identity checks below stay falsifiable: with literal types the compiler proves
  // they cannot fail, and a check that cannot fail certifies nothing.
  const correctedTargetHashConstant: string = CORRECTED_TARGET_HASH;
  const invalidTargetHashConstant: string = D3B_INVALID_TARGET_REQUEST.request_hash;
  const observedTargetHash: string = String(await hashEnvelope(REQUEST_HASH_PROJECTION, targetRequest as unknown));
  if (correctedTargetHashConstant === invalidTargetHashConstant) {
    fail("D3_B_TARGET_HASH_CONSTANTS_COLLIDE", correctedTargetHashConstant);
  }
  if (observedTargetHash !== correctedTargetHashConstant) {
    fail("D3_B_TARGET_RECONSTRUCTION_MISMATCH", `expected ${correctedTargetHashConstant}, got ${observedTargetHash}`);
  }
  if (observedTargetHash === invalidTargetHashConstant) fail("D3_B_TARGET_RECONSTRUCTED_THE_INVALID_REQUEST", observedTargetHash);
  const targetHash = observedTargetHash;

  const system = targetRequest.messages[0]?.content ?? "";
  const user = targetRequest.messages[1]?.content ?? "";
  const contract = renderD3BContractTextV0(D3B_TARGET_PAIR);
  const sourceHash = String(await hashEnvelope(D3_HASH_PROJECTION_V0, { source: await readFile(TRANSFORMER_SOURCE, "utf8") }));
  const audit = {
    corrected_target_hash: targetHash,
    hash_matches_the_revision_5_frozen_identity: true,
    old_invalid_target_hash: D3B_INVALID_TARGET_REQUEST.request_hash,
    old_invalid_target_loaded: false,
    old_invalid_target_marking: D3B_INVALID_TARGET_REQUEST.marking,
    uses_the_frozen_state_blind_base: user === stripBeliefBlockV0(base.user_content),
    no_characteros_belief_block: !user.includes("[SUBJECTIVE BELIEF STANCES"),
    no_credence: !/credence/i.test(`${system}\n${user}`),
    no_high_low_neutral: !/\b(HIGH|LOW|NEUTRAL)\b/.test(`${system}\n${user}`),
    no_subject_state_treatment: !user.includes("[SUBJECTIVE BELIEF STANCES"),
    no_a1_experimental_output: !/SUPPORTS_PARAPHRASED|OPPOSES_PARAPHRASED|UNCERTAIN_ABOUT_PARAPHRASED/.test(`${system}\n${user}`),
    canonical_caution_appears_exactly_once: countOf(`${system}\n${user}`, D1_CANONICAL_LABEL) === 1,
    canonical_caution_owned_by_statement_a: countOf(system, D1_CANONICAL_LABEL) === 1 && countOf(user, D1_CANONICAL_LABEL) === 0,
    frozen_paraphrase_appears_exactly_once: countOf(`${system}\n${user}`, A1_PARAPHRASE) === 1,
    frozen_paraphrase_owned_by_statement_b: countOf(system, A1_PARAPHRASE) === 1 && countOf(user, A1_PARAPHRASE) === 0,
    schema_exact: canonicalJsonString(targetRequest.structured_output?.schema ?? {}) === canonicalJsonString(D3B_JSON_SCHEMA),
    anchors_exact: Object.values(D3B_ANCHORS).every((a) => system.includes(a)),
    contract_present_exactly_once: countOf(system, contract) === 1,
    transformer_source_hash_unchanged: sourceHash === FROZEN_TRANSFORMER_SOURCE_HASH,
    contract_hash: String(await hashEnvelope(D3_HASH_PROJECTION_V0, { contract_text: D3B_CONTRACT_TEXT })),
    expected_relation: D3B_INPUTS_FROZEN.expected_relation
  };
  const gateFailures = Object.entries(audit).filter(
    ([key, value]) => value === false && !["old_invalid_target_loaded", "no_subject_state_treatment"].includes(key)
  );
  if (gateFailures.length > 0) {
    await write("pre-execution-target-audit.json", { ...audit, verdict: "D3_B_TARGET_BLOCKED_BY_IDENTITY_GATE", target_calls_made: 0 });
    fail("D3_B_TARGET_BLOCKED_BY_IDENTITY_GATE", JSON.stringify(gateFailures.map(([k]) => k)));
  }
  await write("pre-execution-target-audit.json", { ...audit, verdict: "D3_B_TARGET_IDENTITY_GATE_HOLDS" });
  await write("target-request.json", { request_hash: targetHash, request: targetRequest, frozen_identity_source: "revision 5 manifest + pinned derivation" });

  // ---- 4. the frozen schedule --------------------------------------------------------------------
  const schedule = JSON.parse(await readFile(join(rev5Dir, "D3_B_TARGET_SCHEDULE.json"), "utf8")) as {
    planned_calls: number;
    trials: { position: number; trial_id: string; request_hash: string }[];
  };
  const scheduleAudit = {
    planned_identities: schedule.trials.length,
    expected_identities: TARGET_TRIAL_IDS,
    identities_match: schedule.trials.map((t) => t.trial_id).join(",") === TARGET_TRIAL_IDS.join(","),
    positions_are_1_to_6: schedule.trials.every((t, i) => t.position === i + 1),
    duplicate_identities: schedule.trials.length - new Set(schedule.trials.map((t) => t.trial_id)).size,
    missing_identities: TARGET_TRIAL_IDS.filter((id) => !schedule.trials.some((t) => t.trial_id === id)).length,
    every_entry_references_the_corrected_hash: schedule.trials.every((t) => t.request_hash === CORRECTED_TARGET_HASH),
    old_invalid_hash_in_executable_entries: schedule.trials.filter((t) => t.request_hash === D3B_INVALID_TARGET_REQUEST.request_hash).length,
    schedule_rebuilt_at_runtime: false
  };
  if (
    scheduleAudit.planned_identities !== 6 ||
    !scheduleAudit.identities_match ||
    !scheduleAudit.positions_are_1_to_6 ||
    scheduleAudit.duplicate_identities !== 0 ||
    scheduleAudit.missing_identities !== 0 ||
    !scheduleAudit.every_entry_references_the_corrected_hash ||
    scheduleAudit.old_invalid_hash_in_executable_entries !== 0
  ) {
    await write("target-schedule-verification.json", { ...scheduleAudit, verdict: "D3_B_TARGET_SCHEDULE_BLOCKED", target_calls_made: 0 });
    fail("D3_B_TARGET_SCHEDULE_BLOCKED", JSON.stringify(scheduleAudit));
  }
  await write("target-schedule-verification.json", { ...scheduleAudit, verdict: "D3_B_TARGET_SCHEDULE_VERIFIED" });

  // ---- 5. the frozen executor --------------------------------------------------------------------
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

  // ---- 6. exactly six calls, persisted immediately -------------------------------------------------
  const trials: TargetTrial[] = [];
  for (const [index, trialId] of TARGET_TRIAL_IDS.entries()) {
    process.stdout.write(`[${String(index + 1)}/6] ${trialId} ... `);
    const started = Date.now();
    let content: string | null = null;
    let responseModel: string | null = null;
    let failure: string | null = null;
    try {
      const response = await transport.complete(targetRequest);
      content = response.content;
      responseModel = response.model;
    } catch (error) {
      failure = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    }
    const latency = Date.now() - started;
    const parsed = failure === null ? parseD3B(content ?? "") : ({ ok: false as const, reason: "transport failure, classified as a failed provider attempt" });
    const trial: TargetTrial = {
      trial_id: trialId,
      request_hash: targetHash,
      raw_provider_response: content,
      parsed_relation: parsed.ok ? parsed.relation : null,
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
    process.stdout.write(`${parsed.ok ? parsed.relation : `INVALID: ${parsed.reason}`}\n`);
  }

  // ---- 9. collection integrity, then the dataset freeze BEFORE scoring ----------------------------
  const collection = {
    planned: 6,
    records: trials.length,
    duplicate_identities: trials.length - new Set(trials.map((t) => t.trial_id)).size,
    missing_identities: TARGET_TRIAL_IDS.filter((id) => !trials.some((t) => t.trial_id === id)).length,
    extra_identities: trials.filter((t) => !TARGET_TRIAL_IDS.includes(t.trial_id as (typeof TARGET_TRIAL_IDS)[number])).length,
    every_record_references_the_corrected_hash: trials.every((t) => t.request_hash === CORRECTED_TARGET_HASH),
    invalid_trials: trials.filter((t) => t.parsed_relation === null).length,
    transport_failures: trials.filter((t) => t.transport_status !== "OK").length,
    frozen_ordering_preserved: trials.map((t) => t.trial_id).join(",") === TARGET_TRIAL_IDS.join(","),
    verdict: "D3_B_TARGET_COLLECTION_COMPLETE"
  };
  await write("collection-integrity-report.json", collection);
  const datasetHash = await write("target-dataset.json", {
    stage: "D3_B_TARGET",
    is_the_target_request: true,
    state_blind: true,
    planned: 6,
    observed: trials.length,
    scored: false,
    expected_relation: D3B_INPUTS_FROZEN.expected_relation,
    trials
  });
  await write("target-dataset-hash.json", {
    D3_B_TARGET_DATASET_SHA256: datasetHash,
    frozen_before_any_scientific_scoring: true,
    planned: 6,
    observed: trials.length
  });

  // ---- 10. the frozen scorer, over the frozen bytes ------------------------------------------------
  const frozenDoc = JSON.parse(await readFile(join(outdir, "target-dataset.json"), "utf8")) as { trials: TargetTrial[] };
  if (frozenDoc.trials.length !== 6) fail("D3_B_TARGET_DATASET_INCOMPLETE", String(frozenDoc.trials.length));
  const records: D3BTrialRecordV0[] = frozenDoc.trials.map((t) => ({ trial_id: t.trial_id, relation: t.parsed_relation, group: "D3B_TARGET" }));
  const outcome = scoreD3BTargetV0({ trials: records, r_confirm_B: 6 });
  const counts: Record<string, number> = {};
  for (const trial of frozenDoc.trials) {
    const key = trial.parsed_relation ?? "INVALID";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  await write("relation-counts.json", { counts, counts_source: "the frozen target-dataset.json bytes, re-read from disk", invalid_trials: collection.invalid_trials });
  await write("target-scorer-output.json", {
    scorer: "scoreD3BTargetV0 (frozen) — called, not re-implemented",
    input_was_the_frozen_dataset: true,
    output: outcome
  });

  const combined = outcome.outcome_class === "POSITIVE"
    ? {
        statement: "SEMANTIC_COMPONENT_CAPABILITIES_SEPARATELY_PRESENT_BUT_CROSS_WORDING_STANCE_TRANSFER_NOT_ESTABLISHED",
        components: {
          d2_a0_canonical_stance_binding: "ESTABLISHED",
          d3_b_direct_relation_recognition: "ESTABLISHED",
          d2_a1_cross_wording_stance_transfer: "NOT ESTABLISHED (frozen valid null)"
        }
      }
    : outcome.outcome_class === "NULL"
      ? {
          statement: "PREREGISTERED_PARAPHRASE_RELATION_RECOGNITION_NOT_ESTABLISHED",
          strongest_permitted_conclusion:
            "canonical proposition stance binding was established by D2-A0, but direct recognition of the preregistered canonical-paraphrase relation was not established by D3-B; the D2-A1 null therefore cannot be localized further to cross-wording stance integration"
        }
      : {
          statement: "no new localization verdict; the D2-A1 valid null is retained and the D3-B diagnostic is inconclusive",
          inconclusive_verdict: outcome.verdict
        };

  await write("combined-localization-verdict.json", {
    ...combined,
    integration_failure_may_only_be_stated_as: "an architectural hypothesis, never as an observational verdict",
    link_4_reopened: false,
    d2_b_authorised: false,
    d2_b_lock_reason: "D2's frozen sequential rule requires an A1 positive; the frozen A1 result is a valid null and no D3 result can substitute for it"
  });

  const finalVerdicts = outcome.outcome_class === "POSITIVE"
    ? ["D3_B_TARGET_COMPLETED", "PREREGISTERED_PARAPHRASE_RELATION_RECOGNIZED", combined.statement as string, "D3_B_TARGET_EXECUTED", "D2_B_STILL_LOCKED"]
    : outcome.outcome_class === "NULL"
      ? ["D3_B_TARGET_COMPLETED", "PREREGISTERED_PARAPHRASE_RELATION_RECOGNITION_NOT_ESTABLISHED", "D3_EXECUTION_STOPPED_AT_B_TARGET", "D2_B_STILL_LOCKED"]
      : ["D3_B_TARGET_COMPLETED", outcome.verdict, "D3_EXECUTION_STOPPED_AT_B_TARGET", "D2_B_STILL_LOCKED"];

  await write("d3-b-scientific-verdict.json", {
    stage: "D3_B_TARGET",
    execution_status: "D3_B_TARGET_EXECUTED",
    outcome_class: outcome.outcome_class,
    verdict: outcome.verdict,
    collection_integrity: outcome.collection_integrity,
    invalid_count: outcome.invalid_count,
    scientific_scoring_executed: outcome.scientific_scoring_executed,
    counts,
    combined_localization: combined,
    non_claims: [
      "NOT an observation that an internal integration mechanism failed",
      "NOT proof of semantic integration failure; that reading stays an architectural hypothesis",
      "NOT a licence to reopen D2-B or link 4",
      "NOT a claim about CharacterOS cognition or appraisal",
      "NOT a claim that the paraphrase is objectively non-equivalent, or that the executor lacks semantic understanding"
    ]
  });
  await write("D3_B_TARGET_MANIFEST.json", {
    stage: "D3_B_TARGET",
    final_verdicts: finalVerdicts,
    corrected_target_hash: targetHash,
    old_invalid_target_hash: D3B_INVALID_TARGET_REQUEST.request_hash,
    old_invalid_target_status: D3B_INVALID_TARGET_REQUEST.marking,
    old_invalid_target_calls: 0,
    expected_relation: D3B_INPUTS_FROZEN.expected_relation,
    dataset_hash: datasetHash,
    collection,
    model_calls_this_round: 6,
    d3_model_calls_cumulative: 21,
    target_calls_total: 6,
    executor,
    d2_b_authorised: false,
    d3_a_calls: 0,
    d2_b_calls: 0,
    qualification_or_noise_rerun: false
  });

  process.stdout.write(
    `\n${finalVerdicts.join("\n")}\nHIGH ${JSON.stringify(counts)}\nD3_MODEL_CALLS_THIS_ROUND = 6\nD3_MODEL_CALLS = 21\n`
  );
}

await main();
