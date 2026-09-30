/* eslint-disable no-restricted-imports -- Isolated research harness COMPOSING frozen production seams (repository convention); no production semantics are copied. */
/**
 * D3-B INSTRUMENT QUALIFICATION — exactly 9 calls, state-blind synthetic fixtures.
 *
 *   MODEL_API_KEY=... node research/experiments/belief-semantic-binding-d3/d3b-qualification.ts <outdir>
 *
 * Order: fixture identity gate -> offline conformance (transformer + scorers) -> freeze the
 * implementation identities -> build three requests once -> 9 calls -> freeze the raw dataset ->
 * score with the frozen qualification scorer. NO call happens before conformance passes, and nothing
 * is scored before the dataset hash exists.
 *
 * QUALIFICATION BASE BINDING. D3-B's qualification fixtures must contain no CharacterOS subject state
 * and no CAUTION proposition (revision 1 §7). The production user content DOES carry the CAUTION belief
 * line, so the belief block is stripped from the production request for the qualification base, using
 * the D1-frozen `stripBeliefBlockV0`. That is an implementation-level binding, not a scientific rule,
 * and the audit proves only the belief block changed. The D3-B TARGET request is not built here and
 * keeps the production subject data untouched.
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
  D3B_EXPECTED_RELATION_MAP,
  D3B_JSON_SCHEMA,
  D3B_QUALIFICATION_FIXTURES,
  D3B_QUALIFICATION_RULE,
  D3B_TOKENS,
  D3B_TRANSFORMER_CONTRACT
} from "./contract.ts";
import {
  A0_MARKER,
  A1_MARKER,
  D2B_MARKER,
  D3B_MARKER,
  DP_V2_MARKER,
  D3B_TARGET_PAIR,
  buildD3RelationReadoutRequestV0,
  renderD3BContractTextV0,
  renderedDifferencesFromTheFrozenTextV0
} from "./transformer-d3b.ts";
import {
  classifyD3BNoisePilotV0,
  scoreD3BQualificationV0,
  scoreD3BTargetV0,
  uniqueModalOfV0,
  type D3BTrialRecordV0
} from "./scorers-d3b.ts";
import {
  A1_TOKEN_VOCABULARY_FOR_LEAK_CHECK,
  D1_CANONICAL_LABEL,
  stripBeliefBlockV0,
  buildProductionBaseRequestV0
} from "./qualification-base.ts";

const REQUEST_HASH_PROJECTION = "characteros-next/research/decision-probe/request/v0" as const;
const TRANSFORMER_SOURCE = "research/experiments/belief-semantic-binding-d3/transformer-d3b.ts" as const;
const SCORERS_SOURCE = "research/experiments/belief-semantic-binding-d3/scorers-d3b.ts" as const;
const BASE_SOURCE = "research/experiments/belief-semantic-binding-d3/qualification-base.ts" as const;
const A1_PARAPHRASE = "the view that a finding depending mainly on secondhand report is to be held with reserve";

function fail(verdict: string, detail: string): never {
  throw new Error(`${verdict}: ${detail}`);
}

interface D3BTrial {
  readonly trial_id: string;
  readonly group: string;
  readonly replicate_ordinal: number;
  readonly request_hash: string;
  readonly expected_relation: string;
  readonly raw_response: string | null;
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
  const outdir = process.argv[2];
  if (outdir === undefined) throw new Error("usage: node d3b-qualification.ts <outdir>");
  await mkdir(outdir, { recursive: true });
  const write = async (name: string, value: unknown): Promise<string> => {
    const content = `${JSON.stringify(value, null, 2)}\n`;
    await writeFile(join(outdir, name), content, "utf8");
    return String(await hashEnvelope(D3_HASH_PROJECTION_V0, { name, content }));
  };

  // ---- 0/1. fixture identity gate -------------------------------------------------------------
  for (const fixture of D3B_QUALIFICATION_FIXTURES) {
    if (D3B_EXPECTED_RELATION_MAP[fixture.fixture_id] !== fixture.expected_relation) {
      fail("D3_B_FIXTURE_TOKEN_MAP_MISMATCH", fixture.fixture_id);
    }
    for (const [tag, text] of [["A", fixture.statement_a], ["B", fixture.statement_b]] as const) {
      if (text.includes(D1_CANONICAL_LABEL)) fail("D3_B_FIXTURE_CONTAINS_THE_CANONICAL_PROPOSITION", `${fixture.fixture_id} ${tag}`);
      if (text.includes(A1_PARAPHRASE)) fail("D3_B_FIXTURE_CONTAINS_THE_TARGET_PARAPHRASE", `${fixture.fixture_id} ${tag}`);
      if (A1_TOKEN_VOCABULARY_FOR_LEAK_CHECK.some((t) => text.includes(t))) fail("D3_B_FIXTURE_CONTAINS_AN_A1_TOKEN", `${fixture.fixture_id} ${tag}`);
      if (/\b(HIGH|LOW|NEUTRAL)\b/.test(text)) fail("D3_B_FIXTURE_CONTAINS_AN_ARM_LABEL", `${fixture.fixture_id} ${tag}`);
      if (/credence/i.test(text) || /\b0\.\d/.test(text)) fail("D3_B_FIXTURE_CONTAINS_A_CREDENCE", `${fixture.fixture_id} ${tag}`);
    }
  }
  await write("qualification-fixture-manifest.json", {
    source: "belief-semantic-binding-d3/contract.ts (revision 1, unchanged at revision 2)",
    rewritten_at_runtime: false,
    fixtures: D3B_QUALIFICATION_FIXTURES,
    expected_relation_map: D3B_EXPECTED_RELATION_MAP,
    qualification_rule: D3B_QUALIFICATION_RULE,
    states_blind: { uses_characteros_canonical_state: false, contains_treatment: false, contains_caution: false, contains_the_target_paraphrase: false }
  });

  // ---- 2. offline conformance: transformer + scorers ------------------------------------------
  const base = await buildProductionBaseRequestV0();
  const strippedUser = stripBeliefBlockV0(base.user_content);
  const beliefBlockStrippedCleanly =
    !strippedUser.includes(D1_CANONICAL_LABEL) &&
    base.user_content.includes(D1_CANONICAL_LABEL) &&
    strippedUser.split("\n").length < base.user_content.split("\n").length;
  if (!beliefBlockStrippedCleanly) fail("D3_B_QUALIFICATION_BASE_BINDING_FAILED", "the belief block was not removed cleanly");

  const conformance: Record<string, unknown> = {};
  const requests = new Map<string, ModelTransportRequestV0>();
  let conformanceOk = true;
  for (const fixture of D3B_QUALIFICATION_FIXTURES) {
    const pristine = Object.freeze({
      messages: Object.freeze([
        Object.freeze({ role: "system" as const, content: base.system_content }),
        Object.freeze({ role: "user" as const, content: strippedUser })
      ]),
      structured_output: base.structured_output
    }) as unknown as ModelTransportRequestV0;
    const pair = { statement_a: fixture.statement_a, statement_b: fixture.statement_b };
    const transformed = buildD3RelationReadoutRequestV0(pristine, pair);
    const sys = transformed.messages[0]?.content ?? "";
    const rendered = renderD3BContractTextV0(pair);
    const differences = renderedDifferencesFromTheFrozenTextV0(rendered);
    const targetRenderReproducesTheFrozenLiteral = renderD3BContractTextV0(D3B_TARGET_PAIR) === D3B_CONTRACT_TEXT;
    const checks = {
      accepts_a_pristine_production_v8_request: true,
      frozen_contract_text_reproduced_for_the_target_pair: targetRenderReproducesTheFrozenLiteral,
      fixture_render_differs_only_on_the_two_statement_lines:
        differences.length === 2 && differences[0] === 6 && differences[1] === 8,
      frozen_schema_exact: canonicalJsonString(transformed.structured_output?.schema ?? {}) === canonicalJsonString(D3B_JSON_SCHEMA),
      contract_appended_exactly_once: sys.split(rendered).length - 1 === 1,
      anchors_exact: Object.values(D3B_ANCHORS).every((a) => sys.includes(a)),
      fixture_literals_used_verbatim: sys.includes(fixture.statement_a) && sys.includes(fixture.statement_b),
      no_decision_probe_v2: !sys.includes(DP_V2_MARKER),
      no_a0_contract: !sys.includes(A0_MARKER),
      no_a1_contract: !sys.includes(A1_MARKER),
      no_d2b_contract: !sys.includes(D2B_MARKER),
      d3b_marker_present: sys.includes(D3B_MARKER),
      subject_data_contains_no_caution: !(transformed.messages[1]?.content ?? "").includes(D1_CANONICAL_LABEL),
      subject_data_contains_no_target_paraphrase: !(transformed.messages[1]?.content ?? "").includes(A1_PARAPHRASE),
      user_content_untouched_by_the_transformer: (transformed.messages[1]?.content ?? "") === strippedUser
    };
    let alreadyTransformedRejected = false;
    try {
      buildD3RelationReadoutRequestV0(transformed, pair);
    } catch {
      alreadyTransformedRejected = true;
    }
    if (Object.values(checks).some((v) => v !== true) || !alreadyTransformedRejected) conformanceOk = false;
    conformance[fixture.fixture_id] = { ...checks, already_transformed_input_rejected: alreadyTransformedRejected, render_differences: differences };
    requests.set(fixture.fixture_id, transformed);
  }
  if (!conformanceOk) fail("D3_B_TRANSFORMER_IMPLEMENTATION_NONCONFORMANT", JSON.stringify(conformance));
  await write("transformer-conformance-report.json", {
    transformer: D3B_TRANSFORMER_CONTRACT.name,
    per_fixture: conformance,
    qualification_base_binding: {
      production_base: "a real committed production world's V8 request",
      binding: "the belief block is stripped so the qualification fixture carries no CharacterOS state and no CAUTION",
      helper: "the D1-frozen stripBeliefBlockV0",
      belief_block_stripped_cleanly: beliefBlockStrippedCleanly,
      is_a_scientific_rule: false
    },
    verdict: "D3_B_TRANSFORMER_CONFORMANT"
  });

  // ---- scorer conformance: the frozen decisions, called on synthetic inputs ---------------------
  const S = "SEMANTICALLY_ALIGNED";
  const U = "SEMANTICALLY_UNRELATED";
  const O = "SEMANTICALLY_OPPOSED";
  const fixtureIds = D3B_QUALIFICATION_FIXTURES.map((f) => f.fixture_id);
  const qualify = (relation: string) =>
    D3B_QUALIFICATION_FIXTURES.flatMap((f, index) =>
      Array.from({ length: 3 }, (_unused, r) => ({ trial_id: `${String(index)}-${String(r)}`, relation, group: f.fixture_id }))
    );
  const perfectQualification = [
    ...Array.from({ length: 3 }, (_u, r) => ({ trial_id: `a${String(r)}`, relation: S, group: fixtureIds[0] as string })),
    ...Array.from({ length: 3 }, (_u, r) => ({ trial_id: `b${String(r)}`, relation: U, group: fixtureIds[1] as string })),
    ...Array.from({ length: 3 }, (_u, r) => ({ trial_id: `c${String(r)}`, relation: O, group: fixtureIds[2] as string }))
  ];
  const qualificationPerfect = scoreD3BQualificationV0(perfectQualification);
  const qualificationWithOneInvalid = scoreD3BQualificationV0(
    perfectQualification.map((t, i) => (i === 0 ? { ...t, relation: null } : t))
  );
  const qualificationAllSame = scoreD3BQualificationV0(qualify(S));
  const pilot = (tokens: readonly (string | null)[]) =>
    tokens.map((relation, index) => ({ trial_id: `p${String(index)}`, relation, group: "D3B_PILOT" }));
  const noiseSix = classifyD3BNoisePilotV0(pilot(Array.from({ length: 6 }, () => S)));
  const noiseFive = classifyD3BNoisePilotV0(pilot([S, S, S, S, S, U]));
  const noiseFour = classifyD3BNoisePilotV0(pilot([S, S, S, S, U, O]));
  const noiseTie = classifyD3BNoisePilotV0(pilot([S, S, S, U, U, U]));
  const noiseInvalid = classifyD3BNoisePilotV0(pilot([S, S, S, S, S, null]));
  const noiseAllInvalid = classifyD3BNoisePilotV0(pilot([null, null, null, null, null, null]));
  const targetPerfect = scoreD3BTargetV0({
    trials: Array.from({ length: 6 }, (_u, i) => ({ trial_id: `t${String(i)}`, relation: S, group: "D3B_TARGET" })),
    r_confirm_B: 6
  });
  const targetOneOff = scoreD3BTargetV0({
    trials: [...Array.from({ length: 5 }, (_u, i) => ({ trial_id: `t${String(i)}`, relation: S, group: "D3B_TARGET" })), { trial_id: "t5", relation: U, group: "D3B_TARGET" }],
    r_confirm_B: 6
  });
  const targetInvalid = scoreD3BTargetV0({
    trials: [...Array.from({ length: 5 }, (_u, i) => ({ trial_id: `t${String(i)}`, relation: S, group: "D3B_TARGET" })), { trial_id: "t5", relation: null, group: "D3B_TARGET" }],
    r_confirm_B: 6
  });
  const targetIntegrity = scoreD3BTargetV0({
    trials: Array.from({ length: 5 }, (_u, i) => ({ trial_id: `t${String(i)}`, relation: S, group: "D3B_TARGET" })),
    r_confirm_B: 6
  });
  const scorerChecks = {
    qualification_perfect_qualifies: qualificationPerfect.instrument_verdict === "D3_B_INSTRUMENT_QUALIFIED",
    qualification_one_invalid_fails: qualificationWithOneInvalid.instrument_verdict === "D3_B_INSTRUMENT_UNQUALIFIED",
    qualification_all_same_fails: qualificationAllSame.instrument_verdict === "D3_B_INSTRUMENT_UNQUALIFIED",
    noise_six_maps_to_six: noiseSix.pilot_verdict === "D3_B_NEUTRAL_PILOT_QUALIFIED" && noiseSix.r_confirm_B === 6,
    noise_five_maps_to_fourteen: noiseFive.pilot_verdict === "D3_B_NEUTRAL_PILOT_QUALIFIED" && noiseFive.r_confirm_B === 14,
    noise_four_stops: noiseFour.pilot_verdict === "D3_B_NEUTRAL_PILOT_QUALIFIED" && noiseFour.r_confirm_B === null,
    noise_tie_is_undefined: noiseTie.pilot_verdict === "D3_B_INCONCLUSIVE_BY_MODAL_TIE_UNDEFINED",
    noise_one_invalid_is_inconclusive: noiseInvalid.pilot_verdict === "D3_B_INCONCLUSIVE_BY_PILOT_INVALID_OUTPUTS",
    noise_all_invalid_is_inconclusive: noiseAllInvalid.pilot_verdict === "D3_B_INCONCLUSIVE_BY_PILOT_INVALID_OUTPUTS",
    target_perfect_is_positive: targetPerfect.outcome_class === "POSITIVE" && targetPerfect.verdict === "PREREGISTERED_PARAPHRASE_RELATION_RECOGNIZED",
    target_one_off_is_null_not_positive: targetOneOff.outcome_class === "NULL",
    target_invalid_is_inconclusive_not_null: targetInvalid.outcome_class === "INCONCLUSIVE",
    target_integrity_failure_is_inconclusive: targetIntegrity.outcome_class === "INCONCLUSIVE",
    no_result_reopens_link_4: [targetPerfect, targetOneOff, targetInvalid, targetIntegrity].every((o) => o.may_not_reopen_link_4 === true),
    target_positive_carries_the_frozen_combined_statement:
      targetPerfect.frozen_combined_statement_if_positive ===
      "SEMANTIC_COMPONENT_CAPABILITIES_SEPARATELY_PRESENT_BUT_CROSS_WORDING_STANCE_TRANSFER_NOT_ESTABLISHED"
  };
  if (Object.values(scorerChecks).some((v) => v !== true)) fail("D3_B_SCORER_NONCONFORMANT", JSON.stringify(scorerChecks));
  await write("scorer-conformance-report.json", {
    scorers: ["scoreD3BQualificationV0", "classifyD3BNoisePilotV0", "scoreD3BTargetV0"],
    called_not_reimplemented: true,
    synthetic_checks: scorerChecks,
    observations: {
      qualification_perfect: qualificationPerfect.instrument_verdict,
      qualification_one_invalid: qualificationWithOneInvalid.instrument_verdict,
      noise_six_five_four: [noiseSix.r_confirm_B, noiseFive.r_confirm_B, noiseFour.r_confirm_B],
      noise_tie: noiseTie.pilot_verdict,
      noise_all_invalid_modal_count: noiseAllInvalid.modal_count,
      target_perfect: targetPerfect.verdict,
      unique_modal_example: uniqueModalOfV0({ [S]: 3, [U]: 3, [O]: 0 })
    },
    verdict: "D3_B_SCORERS_CONFORMANT"
  });

  // ---- 5. freeze the implementation identities BEFORE the first call ---------------------------
  const sourceHashOf = async (path: string): Promise<string> =>
    String(await hashEnvelope(D3_HASH_PROJECTION_V0, { source: await readFile(path, "utf8") }));
  const implementationManifest = {
    transformer: D3B_TRANSFORMER_CONTRACT.name,
    transformer_source_hash: await sourceHashOf(TRANSFORMER_SOURCE),
    transformer_contract_hash: String(await hashEnvelope(D3_HASH_PROJECTION_V0, { contract_text: D3B_CONTRACT_TEXT })),
    schema_hash: String(await hashEnvelope(D3_HASH_PROJECTION_V0, { schema: D3B_JSON_SCHEMA })),
    anchors_hash: String(await hashEnvelope(D3_HASH_PROJECTION_V0, { anchors: D3B_ANCHORS })),
    fixture_manifest_hash: String(await hashEnvelope(D3_HASH_PROJECTION_V0, { fixtures: D3B_QUALIFICATION_FIXTURES })),
    qualification_scorer_source_hash: await sourceHashOf(SCORERS_SOURCE),
    noise_classifier_source_hash: await sourceHashOf(SCORERS_SOURCE),
    target_scorer_source_hash: await sourceHashOf(SCORERS_SOURCE),
    qualification_base_source_hash: await sourceHashOf(BASE_SOURCE),
    d3_b_outputs_seen_before_implementation_freeze: false,
    implementation_frozen: true,
    may_not_be_modified_after_the_first_call: true,
    rule_if_a_bug_is_found: "stop the whole qualification; a fixed implementation may not continue the remaining replicates"
  };
  await write("implementation-manifest.json", implementationManifest);

  // ---- 8. build each fixture's request once ---------------------------------------------------
  const letters = ["A", "B", "C"];
  for (const [index, fixture] of D3B_QUALIFICATION_FIXTURES.entries()) {
    const request = requests.get(fixture.fixture_id) as ModelTransportRequestV0;
    await write(`fixture-${letters[index]}-request.json`, {
      fixture_id: fixture.fixture_id,
      expected_relation: fixture.expected_relation,
      request_hash: String(await hashEnvelope(REQUEST_HASH_PROJECTION, request as unknown)),
      request
    });
  }

  // ---- 10. the frozen primary executor ---------------------------------------------------------
  if (process.env["D3B_CONFORMANCE_ONLY"] === "1") {
    process.stdout.write("D3B_CONFORMANCE_ONLY: offline gates passed, 0 model calls, stopping before the executor.\n");
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

  // ---- exactly nine trials ----------------------------------------------------------------------
  const trials: D3BTrial[] = [];
  let ordinal = 0;
  for (const fixture of D3B_QUALIFICATION_FIXTURES) {
    const request = requests.get(fixture.fixture_id) as ModelTransportRequestV0;
    const requestHash = String(await hashEnvelope(REQUEST_HASH_PROJECTION, request as unknown));
    for (let replicate = 1; replicate <= D3B_QUALIFICATION_RULE.replicates_per_fixture; replicate += 1) {
      ordinal += 1;
      process.stdout.write(`[${String(ordinal)}/9] ${fixture.fixture_id} r=${String(replicate)} ... `);
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
      const parsed = failure === null ? parseD3B(content ?? "") : ({ ok: false as const, reason: "transport failure, classified as a failed provider attempt" });
      const trial: D3BTrial = {
        trial_id: `d3b-qf-${String(ordinal).padStart(3, "0")}`,
        group: fixture.fixture_id,
        replicate_ordinal: replicate,
        request_hash: requestHash,
        expected_relation: fixture.expected_relation,
        raw_response: content,
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
      await write(`trial-${String(ordinal).padStart(3, "0")}.json`, trial);
      process.stdout.write(`${parsed.ok ? parsed.relation : `INVALID: ${parsed.reason}`}\n`);
    }
  }

  // ---- 11. freeze the raw dataset BEFORE scoring ------------------------------------------------
  const datasetHash = await write("qualification-dataset.json", {
    stage: "D3_B_INSTRUMENT_QUALIFICATION",
    uses_characteros_canonical_state: false,
    contains_treatment: false,
    planned: D3B_QUALIFICATION_FIXTURES.length * D3B_QUALIFICATION_RULE.replicates_per_fixture,
    observed: trials.length,
    scored: false,
    trials
  });
  await write("qualification-dataset-hash.json", {
    D3_B_QUALIFICATION_DATASET_SHA256: datasetHash,
    frozen_before_scoring: true,
    trials: trials.length
  });

  // ---- 12/13. the frozen qualification scorer, over the frozen bytes ----------------------------
  const frozen = JSON.parse(await readFile(join(outdir, "qualification-dataset.json"), "utf8")) as { trials: D3BTrial[] };
  const records: D3BTrialRecordV0[] = frozen.trials.map((t) => ({ trial_id: t.trial_id, relation: t.parsed_relation, group: t.group }));
  const outcome = scoreD3BQualificationV0(records);
  await write("qualification-counts.json", {
    counts_source: "the frozen qualification-dataset.json bytes, re-read from disk",
    per_fixture: Object.fromEntries(Object.entries(outcome.per_fixture).map(([k, v]) => [k, v.counts])),
    invalid_trials: outcome.invalid_trials
  });
  await write("qualification-modal-report.json", {
    per_fixture: Object.fromEntries(
      Object.entries(outcome.per_fixture).map(([k, v]) => [k, { modal: v.modal, tie: v.tie, expected: v.expected, pass: v.pass }])
    ),
    exact_token_match_required: true,
    similarity_substitution_allowed: false
  });
  await write("qualification-scorer-output.json", {
    scorer: "scoreD3BQualificationV0 (frozen) — called, not re-implemented",
    input_was_the_frozen_dataset: true,
    output: outcome
  });

  const qualified = outcome.instrument_verdict === "D3_B_INSTRUMENT_QUALIFIED";
  const verdict = qualified
    ? {
        verdicts: ["D3_B_INSTRUMENT_QUALIFIED", "D3_B_NOISE_PILOT_AUTHORISED", "D3_B_TARGET_NOT_EXECUTED"],
        d3_b_noise_pilot_authorised: true,
        d3_b_target_not_executed: true,
        d3_execution_stopped_at_b_qualification: false
      }
    : {
        verdicts: ["D3_B_INSTRUMENT_UNQUALIFIED", "D3_EXECUTION_STOPPED_AT_B_QUALIFICATION", "D3_B_TARGET_NOT_EXECUTED"],
        d3_b_noise_pilot_authorised: false,
        d3_b_target_not_executed: true,
        d3_execution_stopped_at_b_qualification: true,
        forbidden_interpretation:
          "this is an instrument qualification failure; it is NOT evidence that the canonical/paraphrase relation is unrecognised, because the target pair has not been run"
      };
  await write("D3_B_QUALIFICATION_MANIFEST.json", {
    stage: "D3_B",
    ...verdict,
    dataset_hash: datasetHash,
    instrument_verdict: outcome.instrument_verdict,
    invalid_trials: outcome.invalid_trials,
    invalid_rule_triggered: outcome.invalid_rule_triggered,
    denominator: outcome.denominator,
    implementation_manifest: implementationManifest,
    model_calls_this_round: 9,
    d3_model_calls_total: 9,
    executor,
    establishes:
      "that DeepSeek with the frozen D3-B measurement contract can realise its aligned / unrelated / opposed relation vocabulary on preregistered state-blind synthetic relation fixtures",
    does_not_establish: [
      "that the canonical CAUTION proposition and the A1 paraphrase are aligned",
      "CharacterOS semantic integration",
      "cross-wording stance transfer",
      "appraisal or behaviour",
      "anything about the D3-B target pair, which was not run"
    ],
    d3_a_calls: 0,
    d2_b_calls: 0
  });

  process.stdout.write(`\n${verdict.verdicts.join("\n")}\nD3_MODEL_CALLS_THIS_ROUND = 9\n`);
}

await main();
