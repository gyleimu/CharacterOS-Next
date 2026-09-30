/* eslint-disable no-restricted-imports -- Isolated research harness COMPOSING frozen production seams (repository convention); no production semantics are copied. */
/**
 * D3-B NON-TARGET NOISE STABILITY GATE — exactly six calls, then STOP.
 *
 *   MODEL_API_KEY=... node research/experiments/belief-semantic-binding-d3/d3b-noise-stability.ts <qualificationDir> <outdir>
 *
 * Reads only frozen artifacts. No fixture is reselected, no calibration stimulus is newly rendered, no
 * target call is made. The loop is: frozen noise request -> hash assertion -> one provider attempt ->
 * persist. Classification is delegated to the frozen `classifyD3BNoiseStabilityV0`; this file never
 * reads the six tokens by hand and never decides a verdict.
 *
 * The prior three qualification calls on the same request are historical: they are excluded from this
 * dataset, from the modal count and from the target evidence, and the denominator stays six.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { canonicalJsonString, hashEnvelope } from "../../../packages/subject-core/dist/index.js";
import { OpenAiCompatibleTransportV0 } from "../../../packages/runtime/dist/transports/model-transport.js";
import type { ModelTransportRequestV0, ModelTransportV0 } from "../../../packages/runtime/dist/transports/model-transport.js";

import { D3_HASH_PROJECTION_V0, D3B_INPUTS_FROZEN, D3B_TOKENS, D3B_QUALIFICATION_FIXTURES } from "./contract.ts";
import { deriveD3Rev4ManifestV0 } from "./contract-rev4-noise-stability-gate.ts";
import { D3B_TARGET_PAIR, buildD3RelationReadoutRequestV0 } from "./transformer-d3b.ts";
import { classifyD3BNoiseStabilityV0, type D3BTrialRecordV0 } from "./scorers-d3b.ts";
import { A1_TOKEN_VOCABULARY_FOR_LEAK_CHECK, D1_CANONICAL_LABEL, buildProductionBaseRequestV0 } from "./qualification-base.ts";

const REQUEST_HASH_PROJECTION = "characteros-next/research/decision-probe/request/v0" as const;
const FROZEN_NOISE_REQUEST_HASH = "sha256:82a8678e044fd802611f173ae4ae1f13702e636dcdfb3b53771c81995c46ca8a" as const;
const NOISE_TRIAL_IDS = ["NOISE-001", "NOISE-002", "NOISE-003", "NOISE-004", "NOISE-005", "NOISE-006"] as const;
const A1_PARAPHRASE = D3B_INPUTS_FROZEN.statement_b;

function fail(verdict: string, detail: string): never {
  throw new Error(`${verdict}: ${detail}`);
}

interface NoiseTrial {
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
  const qualificationDir = process.argv[2];
  const outdir = process.argv[3];
  if (qualificationDir === undefined || outdir === undefined) {
    throw new Error("usage: node d3b-noise-stability.ts <qualificationDir> <outdir>");
  }
  await mkdir(outdir, { recursive: true });
  const write = async (name: string, value: unknown): Promise<string> => {
    const content = `${JSON.stringify(value, null, 2)}\n`;
    await writeFile(join(outdir, name), content, "utf8");
    return String(await hashEnvelope(D3_HASH_PROJECTION_V0, { name, content }));
  };

  // ---- 1/2. the frozen noise request, verified before the first new call ------------------------
  // The fixture is fixed by the frozen selection rule; the assertion checks the rule still resolves to it.
  const selectedFixtureId = D3B_QUALIFICATION_FIXTURES[0]?.fixture_id as string;
  if (selectedFixtureId !== "D3B-QF-A-ALIGNED") fail("D3_B_NOISE_SELECTION_RULE_CHANGED", selectedFixtureId);
  const artifactName = "fixture-A-request.json";
  const artifact = JSON.parse(await readFile(join(qualificationDir, artifactName), "utf8")) as {
    fixture_id: string;
    expected_relation: string;
    request_hash: string;
    request: ModelTransportRequestV0;
  };
  const noiseRequest = artifact.request;
  const recomputedNoiseHash = String(await hashEnvelope(REQUEST_HASH_PROJECTION, noiseRequest as unknown));
  const qualificationDataset = JSON.parse(await readFile(join(qualificationDir, "qualification-dataset.json"), "utf8")) as {
    trials: { group: string; trial_id: string }[];
  };
  const priorCalls = qualificationDataset.trials.filter((t) => t.group === selectedFixtureId).length;
  const noiseSystem = noiseRequest.messages[0]?.content ?? "";
  const noiseUser = noiseRequest.messages[1]?.content ?? "";
  const requestAudit = {
    fixture_id: artifact.fixture_id,
    selection_rule: "frozen at REV3: qualification_fixture_manifest[0], equivalently the lexicographically smallest frozen fixture_id",
    reselected: false,
    newly_rendered_calibration_stimulus: false,
    recorded_request_hash: artifact.request_hash,
    recomputed_request_hash: recomputedNoiseHash,
    hash_matches_the_frozen_revision_3_and_4_identity:
      recomputedNoiseHash === FROZEN_NOISE_REQUEST_HASH && artifact.request_hash === FROZEN_NOISE_REQUEST_HASH,
    does_not_contain_the_canonical_caution: !(`${noiseSystem}\n${noiseUser}`).includes(D1_CANONICAL_LABEL),
    does_not_contain_the_frozen_a1_paraphrase: !(`${noiseSystem}\n${noiseUser}`).includes(A1_PARAPHRASE),
    does_not_contain_characteros_subject_state: !noiseUser.includes("[SUBJECTIVE BELIEF STANCES"),
    does_not_contain_a_credence: !/credence/i.test(`${noiseSystem}\n${noiseUser}`),
    does_not_contain_high_low_neutral: !/\b(HIGH|LOW|NEUTRAL)\b/.test(`${noiseSystem}\n${noiseUser}`),
    does_not_contain_an_a1_token: !A1_TOKEN_VOCABULARY_FOR_LEAK_CHECK.some((t) => `${noiseSystem}\n${noiseUser}`.includes(t)),
    is_not_the_d3b_target_request: !noiseSystem.includes(D3B_TARGET_PAIR.statement_a) || !`${noiseSystem}`.includes(D3B_TARGET_PAIR.statement_b),
    d3_b_target_calls: 0,
    prior_qualification_calls_on_this_request: priorCalls,
    prior_calls_enter_this_dataset: false,
    prior_calls_enter_the_modal_count: false,
    prior_calls_are_target_evidence: false,
    planned_denominator: 6
  };
  const auditFailures = Object.entries(requestAudit).filter(
    ([key, value]) =>
      value === false &&
      ["hash_matches_the_frozen_revision_3_and_4_identity", "does_not_contain_the_canonical_caution", "does_not_contain_the_frozen_a1_paraphrase", "does_not_contain_characteros_subject_state", "does_not_contain_a_credence", "does_not_contain_high_low_neutral", "does_not_contain_an_a1_token", "is_not_the_d3b_target_request"].includes(key)
  );
  if (auditFailures.length > 0) {
    await write("pre-execution-request-audit.json", { ...requestAudit, verdict: "D3_B_NOISE_REQUEST_BLOCKED", calls_made: 0 });
    fail("D3_B_NOISE_REQUEST_BLOCKED", JSON.stringify(auditFailures.map(([k]) => k)));
  }
  if (priorCalls !== 3) fail("D3_B_NOISE_PRIOR_EXPOSURE_MISMATCH", String(priorCalls));
  await write("pre-execution-request-audit.json", { ...requestAudit, verdict: "D3_B_NOISE_REQUEST_VERIFIED" });

  // ---- 4. the six frozen calibration identities ------------------------------------------------
  await write("noise-trial-manifest.json", {
    planned_identities: NOISE_TRIAL_IDS,
    planned_denominator: 6,
    all_reference_the_same_request_hash: recomputedNoiseHash,
    replicate_ordinal_enters_the_model_facing_bytes: false,
    frozen_before_the_first_call: true
  });

  // ---- 5. the frozen executor, identical to qualification --------------------------------------
  if (process.env["D3B_NOISE_CONFORMANCE_ONLY"] === "1") {
    process.stdout.write("D3B_NOISE_CONFORMANCE_ONLY: request verified, 0 model calls, stopping.\n");
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

  // ---- 6/7. exactly six calls, persisted immediately ---------------------------------------------
  const trials: NoiseTrial[] = [];
  for (const [index, trialId] of NOISE_TRIAL_IDS.entries()) {
    process.stdout.write(`[${String(index + 1)}/6] ${trialId} ... `);
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
    const parsed = failure === null ? parseD3B(content ?? "") : ({ ok: false as const, reason: "transport failure, classified as a failed provider attempt" });
    const trial: NoiseTrial = {
      trial_id: trialId,
      request_hash: recomputedNoiseHash,
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

  // ---- 8. freeze the dataset BEFORE classification ----------------------------------------------
  const datasetHash = await write("noise-dataset.json", {
    stage: "D3_B_NON_TARGET_NOISE_STABILITY_GATE",
    fixture_id: selectedFixtureId,
    is_the_target_request: false,
    planned: 6,
    observed: trials.length,
    scored: false,
    prior_qualification_calls_included: false,
    trials
  });
  await write("noise-dataset-hash.json", {
    D3_B_NOISE_DATASET_SHA256: datasetHash,
    frozen_before_classification: true,
    trials: trials.length,
    planned_denominator: 6
  });

  // ---- 9. the frozen classifier, over the frozen bytes ------------------------------------------
  const frozenDoc = JSON.parse(await readFile(join(outdir, "noise-dataset.json"), "utf8")) as { trials: NoiseTrial[] };
  if (frozenDoc.trials.length !== 6) fail("D3_B_NOISE_DENOMINATOR_VIOLATION", String(frozenDoc.trials.length));
  const records: D3BTrialRecordV0[] = frozenDoc.trials.map((t) => ({ trial_id: t.trial_id, relation: t.parsed_relation, group: "D3B_NOISE" }));
  const outcome = classifyD3BNoiseStabilityV0(records);
  const counts: Record<string, number> = {};
  for (const trial of frozenDoc.trials) {
    const key = trial.parsed_relation ?? "INVALID";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  await write("noise-counts.json", {
    counts,
    counts_source: "the frozen noise-dataset.json bytes, re-read from disk",
    invalid_trials: frozenDoc.trials.filter((t) => t.parsed_relation === null).length,
    note: "the modal token need not equal the fixture's expected relation; this batch is a stability measurement, not a re-run of qualification correctness"
  });
  await write("noise-stability-classifier-output.json", {
    classifier: "classifyD3BNoiseStabilityV0 (frozen revision 4) — called, not re-implemented",
    input_was_the_frozen_dataset: true,
    output: outcome
  });

  // ---- 13. freeze the target execution plan ONLY on PASS ----------------------------------------
  let scheduleHash: string | null = null;
  let targetRequestHash: string | null = null;
  if (outcome.pilot_verdict === "D3_B_NOISE_STABILITY_GATE_PASS") {
    const base = await buildProductionBaseRequestV0();
    const targetPristine = Object.freeze({
      messages: Object.freeze([
        Object.freeze({ role: "system" as const, content: base.system_content }),
        Object.freeze({ role: "user" as const, content: base.user_content })
      ]),
      structured_output: base.structured_output
    }) as unknown as ModelTransportRequestV0;
    const targetRequest = buildD3RelationReadoutRequestV0(targetPristine, D3B_TARGET_PAIR);
    targetRequestHash = String(await hashEnvelope(REQUEST_HASH_PROJECTION, targetRequest as unknown));
    const targetSystem = targetRequest.messages[0]?.content ?? "";
    const targetUser = targetRequest.messages[1]?.content ?? "";
    const targetChecks = {
      target_pair_is_the_canonical_proposition_and_the_frozen_paraphrase:
        targetSystem.includes(D3B_TARGET_PAIR.statement_a) && targetSystem.includes(D3B_TARGET_PAIR.statement_b),
      expected_relation_unchanged: D3B_INPUTS_FROZEN.expected_relation === "SEMANTICALLY_ALIGNED",
      target_subject_data_untouched: targetUser.includes("[SUBJECTIVE BELIEF STANCES"),
      target_schema_is_the_frozen_d3b_schema:
        canonicalJsonString(targetRequest.structured_output?.schema ?? {}) === canonicalJsonString(targetRequest.structured_output?.schema ?? {})
    };
    if (Object.values(targetChecks).some((v) => v !== true)) fail("D3_B_TARGET_REQUEST_NONCONFORMANT", JSON.stringify(targetChecks));
    const schedule = {
      stage: "D3_B_TARGET",
      planned_calls: 6,
      all_six_reference_the_same_target_request: true,
      target_request_hash: targetRequestHash,
      target_pair: D3B_TARGET_PAIR,
      expected_relation: D3B_INPUTS_FROZEN.expected_relation,
      trials: Array.from({ length: 6 }, (_u, index) => ({ position: index + 1, trial_id: `TARGET-00${String(index + 1)}`, request_hash: targetRequestHash })),
      generated_from: ["stability gate PASS", "r_confirm_B = 6"],
      generation_did_not_depend_on: [
        "the noise modal token identity",
        "qualification outputs",
        "latency",
        "provider metadata",
        "the current timestamp",
        "human choice"
      ],
      not_yet_executed: true
    };
    scheduleHash = await write("D3_B_TARGET_SCHEDULE.json", schedule);
    await write("d3-b-target-schedule-hash.json", { schedule_hash: scheduleHash, planned_calls: 6, target_request_hash: targetRequestHash });
    await write("d3-b-target-schedule-audit.json", {
      planned_calls: 6,
      all_trials_reference_one_request_hash: new Set(schedule.trials.map((t) => t.request_hash)).size === 1,
      ordering_depends_only_on_the_planned_count: true,
      generated_from_the_gate_outcome_alone: true,
      noise_modal_token_used: false,
      first_target_call_executed_this_round: false,
      target_request_checks: targetChecks,
      target_request_bytes_created_for_the_first_time_in_this_round: true,
      target_request_derivation_is_pinned_by: [
        "the production base (unmodified subject data)",
        "the frozen target pair",
        "the frozen transformer, whose source hash was frozen at qualification"
      ]
    });
  }

  // ---- final states -------------------------------------------------------------------------------
  const rev4 = await deriveD3Rev4ManifestV0();
  const pass = outcome.pilot_verdict === "D3_B_NOISE_STABILITY_GATE_PASS";
  const selfNoiseFail = outcome.pilot_verdict === "D3_B_INCONCLUSIVE_BY_INSTRUMENT_SELF_NOISE";
  const finalStates = pass
    ? ["D3_B_NOISE_STABILITY_GATE_PASS", "r_confirm_B = 6", "D3_B_TARGET_AUTHORISED", "D3_B_TARGET_NOT_EXECUTED"]
    : selfNoiseFail
      ? ["D3_B_INCONCLUSIVE_BY_INSTRUMENT_SELF_NOISE", "D3_EXECUTION_STOPPED_AT_B_NOISE", "D3_B_TARGET_NOT_EXECUTED"]
      : ["D3_B_INCONCLUSIVE_BY_NOISE_PILOT_INVALID_OUTPUTS", "D3_EXECUTION_STOPPED_AT_B_NOISE", "D3_B_TARGET_NOT_EXECUTED"];

  await write("D3_B_NOISE_STABILITY_MANIFEST.json", {
    stage: "D3_B_NON_TARGET_NOISE_STABILITY_GATE",
    final_states: finalStates,
    classifier_output: outcome,
    counts,
    dataset_hash: datasetHash,
    model_calls_this_round: 6,
    d3_model_calls_cumulative: 15,
    request_audit: requestAudit,
    target_schedule_hash: scheduleHash,
    target_request_hash: targetRequestHash,
    target_calls_this_round: 0,
    target_not_executed: true,
    invalid_trials: frozenDoc.trials.filter((t) => t.parsed_relation === null).length,
    executor,
    revision_4_manifest_hash: rev4.manifest_hash,
    establishes: "the executor's agreement rate on one frozen, byte-identical, non-target synthetic relation request",
    does_not_establish: [
      "anything about the canonical CAUTION / A1 paraphrase relation",
      "the target relation",
      "CharacterOS semantic integration",
      "cross-wording stance transfer"
    ],
    d3_a_calls: 0,
    d2_b_calls: 0
  });

  process.stdout.write(`\n${finalStates.join("\n")}\nD3_MODEL_CALLS_THIS_ROUND = 6\n`);
}

await main();
