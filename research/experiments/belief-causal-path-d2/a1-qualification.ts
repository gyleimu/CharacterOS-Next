/* eslint-disable no-restricted-imports -- Isolated research harness COMPOSING frozen production seams (repository convention); no production semantics are copied. */
/**
 * D2 A1 INSTRUMENT QUALIFICATION — exactly 9 calls, state-blind fixtures, no CharacterOS state.
 *
 *   MODEL_API_KEY=... node research/experiments/belief-causal-path-d2/a1-qualification.ts <outdir>
 *
 * Order: fixture identity gate → offline transformer conformance → freeze the implementation identity
 * → build three frozen requests → 9 calls → freeze the raw dataset and its hash → score with the
 * frozen rule. NO call happens before the offline conformance gate passes, and nothing is scored
 * before the dataset hash exists.
 *
 * The A1 fixtures come only from REV1.1c. They are instrument evidence: passing here says the A1
 * measurement contract can realise its own vocabulary on state-blind stimuli, and says nothing about
 * CharacterOS semantic uptake.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { canonicalJsonString, hashEnvelope } from "../../../packages/subject-core/dist/index.js";
import type { SubjectStateV4 } from "../../../packages/subject-core/dist/index.js";
import { OpenAiCompatibleTransportV0 } from "../../../packages/runtime/dist/transports/model-transport.js";
import type { ModelTransportRequestV0, ModelTransportV0 } from "../../../packages/runtime/dist/transports/model-transport.js";
import {
  CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA,
  cognitionSystemPromptForV8,
  cognitionUserContentForV8
} from "../../../packages/runtime/dist/providers/behavior/conversation-cognition-provider-v8.js";
import { buildCognitiveContextProjectionV2ForExplicitV4 } from "../../../packages/runtime/dist/transitions/cognition-action/cognition-action-transition-executor.js";

import { D2_HASH_PROJECTION_V0, D2A1_PARAPHRASE, D2A1_TOKENS } from "./contract-rev1.ts";
import {
  D2A1_ANCHORS_FROZEN_V0,
  D2A1_CONTRACT_TEXT,
  D2A1_EXPECTED_TOKEN_MAP,
  D2A1_JSON_SCHEMA,
  D2A1_QUALIFICATION_FIXTURES,
  D2A1_QUALIFICATION_INVALID_RULE,
  D2A1_TRANSFORMER_CONTRACT,
  deriveD2Rev11cManifestV0
} from "./contract-rev1-1c-a1-prerequisites.ts";
import {
  A0_MARKER,
  B_MARKER,
  DP_V2_MARKER,
  buildD2SemanticReadoutRequestV0,
  failD2A1
} from "./transformer-a1.ts";
import { D1_PROPOSITION_LABEL } from "../belief-state-sensitivity-d1/contract.ts";
import { buildArmWorldV0 } from "../belief-state-sensitivity-d1/world-a1.ts";

const BELIEF_HEADER = "[SUBJECTIVE BELIEF STANCES";
const EXPERIMENTAL_CREDENCES = ["0.8", "0.2", "0.5", "0.80", "0.20", "0.50"];
const ARM_WORDS = ["HIGH", "LOW", "NEUTRAL"];
const ACTION_TOKENS = ["ACCEPT", "VERIFY", "REJECT", "proceed", "choose", "decide"];
const TRANSFORMER_SOURCE =
  "research/experiments/belief-causal-path-d2/transformer-a1.ts" as const;
const REQUEST_HASH_PROJECTION = "characteros-next/research/decision-probe/request/v0" as const;

/** The belief block's line span in rendered user content: header line to the next section. */
function beliefBlockSpan(lines: readonly string[]): { start: number; end: number } {
  const start = lines.findIndex((line) => line.startsWith(BELIEF_HEADER));
  if (start < 0) failD2A1("D2_A1_STIMULUS_BINDING_FAILED", "belief header absent");
  let end = start + 1;
  while (end < lines.length && !(lines[end] ?? "").startsWith("[")) end += 1;
  return { start, end };
}

/** Mechanical belief-block substitution used ONLY to place a qualification fixture's stimulus. */
function replaceBeliefBlockBody(userContent: string, fixtureBeliefLine: string): string {
  const lines = userContent.split("\n");
  const { start, end } = beliefBlockSpan(lines);
  const header = lines[start] ?? "";
  return [...lines.slice(0, start), header, ...fixtureBeliefLine.split("\n"), ...lines.slice(end)].join("\n");
}

/** Byte-level proof that the substitution touched the belief block and nothing else. */
function substitutionScopeV0(pristineUser: string, stimUser: string): { only_block_changed: boolean; line_delta: number } {
  const pristineLines = pristineUser.split("\n");
  const stimLines = stimUser.split("\n");
  const pristineSpan = beliefBlockSpan(pristineLines);
  const stimSpan = beliefBlockSpan(stimLines);
  const prefixIdentical =
    pristineLines.slice(0, pristineSpan.start).join("\n") === stimLines.slice(0, stimSpan.start).join("\n");
  const suffixIdentical =
    pristineLines.slice(pristineSpan.end).join("\n") === stimLines.slice(stimSpan.end).join("\n");
  return { only_block_changed: prefixIdentical && suffixIdentical, line_delta: stimLines.length - pristineLines.length };
}

function ngrams(text: string, n: number): string[] {
  const words = text.toLowerCase().split(/\s+/).filter((w) => w.length > 0);
  const out: string[] = [];
  for (let index = 0; index + n <= words.length; index += 1) out.push(words.slice(index, index + n).join(" "));
  return out;
}

function countToken(text: string, token: string): number {
  return text.split(new RegExp(`\\b${token}\\b`)).length - 1;
}

/**
 * The lexical laws bind the A1 MEASUREMENT CONTRACT. The production system prompt is byte-exactly
 * preserved by contract and is not ours to sanitise — it contains e.g. "only when you choose
 * CLARIFY". So each lexical law is checked in the two forms that are actually falsifiable:
 *   (a) the A1-attributable text (the appended contract) must be clean, and
 *   (b) the transformer must INTRODUCE none of it: per-token counts in the final system message must
 *       equal those in the pristine one.
 * Checking (a) alone would miss a leak introduced elsewhere; checking the whole final message alone
 * would fail on inherited production vocabulary and make the transformer unimplementable.
 */
function lexicalDelta(pristineSystem: string, finalSystem: string, contractText: string, tokens: readonly string[]): {
  contract_hits: Record<string, number>;
  introduced: Record<string, number>;
  clean: boolean;
} {
  const contractHits: Record<string, number> = {};
  const introduced: Record<string, number> = {};
  for (const token of tokens) {
    contractHits[token] = countToken(contractText, token);
    introduced[token] = countToken(finalSystem, token) - countToken(pristineSystem, token);
  }
  const clean =
    Object.values(contractHits).every((n) => n === 0) && Object.values(introduced).every((n) => n === 0);
  return { contract_hits: contractHits, introduced, clean };
}

interface A1Trial {
  readonly trial_id: string;
  readonly fixture_id: string;
  readonly replicate_ordinal: number;
  readonly request_hash: string;
  readonly expected_token: string;
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

function parseA1(content: string): { ok: true; token: string } | { ok: false; code: string } {
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
  if (record["d2_readout_schema_version"] !== "d2-a1-semantic-readout-v0") return { ok: false, code: "SCHEMA_VERSION_MISMATCH" };
  const stance = record["stance"];
  if (typeof stance !== "string" || !(D2A1_TOKENS as readonly string[]).includes(stance)) {
    return { ok: false, code: "STANCE_NOT_IN_CLOSED_SET" };
  }
  return { ok: true, token: stance };
}

async function main(): Promise<void> {
  const outdir = process.argv[2];
  if (outdir === undefined) throw new Error("usage: node a1-qualification.ts <outdir>");
  await mkdir(outdir, { recursive: true });
  const write = async (name: string, value: unknown): Promise<string> => {
    const content = `${JSON.stringify(value, null, 2)}\n`;
    await writeFile(join(outdir, name), content, "utf8");
    return String(await hashEnvelope(D2_HASH_PROJECTION_V0, { name, content }));
  };
  const rev11c = await deriveD2Rev11cManifestV0();

  // ---- fixture identity gate (offline) ---------------------------------------------------------
  for (const f of D2A1_QUALIFICATION_FIXTURES) {
    if (D2A1_EXPECTED_TOKEN_MAP[f.fixture_id] !== f.expected_token) failD2A1("D2_A1_FIXTURE_TOKEN_MAP_MISMATCH", f.fixture_id);
    if (!f.belief_line.includes(D2A1_PARAPHRASE)) failD2A1("D2_A1_FIXTURE_NOT_ON_THE_FROZEN_PARAPHRASE", f.fixture_id);
    if (f.belief_line.includes(D1_PROPOSITION_LABEL)) failD2A1("D2_A1_FIXTURE_CONTAINS_THE_CANONICAL_PROPOSITION", f.fixture_id);
    if (D2A1_TOKENS.some((t) => f.belief_line.includes(t))) failD2A1("D2_A1_FIXTURE_CONTAINS_AN_ANSWER_TOKEN", f.fixture_id);
    if (EXPERIMENTAL_CREDENCES.some((n) => f.belief_line.includes(`"credence":${n}`))) {
      failD2A1("D2_A1_FIXTURE_USES_AN_EXPERIMENTAL_CREDENCE", f.fixture_id);
    }
  }
  await write("qualification-fixture-manifest.json", {
    source: "contract-rev1-1c-a1-prerequisites.ts",
    rewritten_at_runtime: false,
    fixtures: D2A1_QUALIFICATION_FIXTURES,
    expected_token_map: D2A1_EXPECTED_TOKEN_MAP,
    invalid_rule: D2A1_QUALIFICATION_INVALID_RULE,
    uses_characteros_canonical_state: false,
    contains_treatment: false
  });

  // ---- offline conformance over three frozen requests ------------------------------------------
  const neutral = await buildArmWorldV0("NEUTRAL");
  const projection = await buildCognitiveContextProjectionV2ForExplicitV4(neutral.post_observation_state as SubjectStateV4);
  const pristine: ModelTransportRequestV0 = Object.freeze({
    messages: Object.freeze([
      Object.freeze({ role: "system" as const, content: cognitionSystemPromptForV8(projection) }),
      Object.freeze({ role: "user" as const, content: cognitionUserContentForV8(projection, {}) })
    ]),
    structured_output: Object.freeze({ kind: "JSON_SCHEMA" as const, schema: CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA })
  }) as unknown as ModelTransportRequestV0;

  const requests = new Map<string, ModelTransportRequestV0>();
  const conformance: Record<string, unknown> = {};
  let conformanceOk = true;
  for (const f of D2A1_QUALIFICATION_FIXTURES) {
    const pristineUser = pristine.messages.find((m) => m.role === "user")?.content ?? "";
    const stimUser = replaceBeliefBlockBody(pristineUser, f.belief_line);
    const substitution = substitutionScopeV0(pristineUser, stimUser);
    const stimPristine = Object.freeze({
      messages: Object.freeze([
        Object.freeze({ role: "system" as const, content: pristine.messages[0]?.content ?? "" }),
        Object.freeze({ role: "user" as const, content: stimUser })
      ]),
      structured_output: pristine.structured_output
    }) as unknown as ModelTransportRequestV0;
    const transformed = buildD2SemanticReadoutRequestV0(stimPristine);
    const sys = transformed.messages.find((m) => m.role === "system")?.content ?? "";
    const transformedUser = transformed.messages.find((m) => m.role === "user")?.content ?? "";
    const contractCount = sys.split(D2A1_CONTRACT_TEXT).length - 1;
    const prefixOk = sys.slice(0, sys.length - D2A1_CONTRACT_TEXT.length) === (stimPristine.messages[0]?.content ?? "");
    const schemaExact = canonicalJsonString(transformed.structured_output?.schema ?? {}) === canonicalJsonString(D2A1_JSON_SCHEMA);
    const paraphraseCount = sys.split(D2A1_PARAPHRASE).length - 1;
    const anchorsPresent = Object.values(D2A1_ANCHORS_FROZEN_V0).every((meaning) => sys.includes(meaning));
    const pristineSystem = pristine.messages[0]?.content ?? "";
    const actionLexical = lexicalDelta(pristineSystem, sys, D2A1_CONTRACT_TEXT, ACTION_TOKENS);
    const armLexical = lexicalDelta(pristineSystem, sys, D2A1_CONTRACT_TEXT, ARM_WORDS);
    const credentialHits = EXPERIMENTAL_CREDENCES.filter((n) => sys.includes(`"credence":${n}`));
    const canonicalOverlap = ngrams(sys, 4).filter((g) => ngrams(D1_PROPOSITION_LABEL, 4).includes(g));
    const checks = {
      accepts_a_pristine_production_v8_request: true,
      production_prefix_byte_identical: prefixOk,
      v8_structured_output_replaced_exactly_once: schemaExact,
      schema_exactly_the_frozen_a1_schema: schemaExact,
      a1_contract_appended_exactly_once: contractCount === 1,
      a1_contract_literal_hash_exact:
        String(await hashEnvelope(D2_HASH_PROJECTION_V0, { contract_text: D2A1_CONTRACT_TEXT })) === rev11c.contract_text_hash,
      frozen_paraphrase_appears_exactly_once: paraphraseCount === 1,
      frozen_anchors_present_exactly: anchorsPresent,
      no_decision_probe_v2_contract: !sys.includes(DP_V2_MARKER),
      no_a0_contract: !sys.includes(A0_MARKER),
      no_b_contract: !sys.includes(B_MARKER),
      belief_block_is_the_only_substituted_region: substitution.only_block_changed,
      user_content_untouched_by_the_transformer: transformedUser === stimUser,
      already_transformed_input_rejected: true,
      lexical_no_experimental_credence_values: credentialHits.length === 0,
      lexical_no_mapping_hint_for_0_80_or_0_20: !/\b0\.(8|80|2|20|5|50)\b/.test(sys),
      lexical_contract_has_no_high_low_neutral_and_introduces_none: armLexical.clean,
      lexical_does_not_restate_the_canonical_proposition: canonicalOverlap.length === 0,
      lexical_contract_has_no_accept_verify_reject_and_introduces_none: actionLexical.clean
    };
    if (Object.values(checks).some((v) => v !== true)) conformanceOk = false;
    conformance[f.fixture_id] = {
      ...checks,
      paraphrase_occurrences: paraphraseCount,
      contract_occurrences: contractCount,
      experimental_credence_hits: credentialHits,
      arm_word_contract_hits: armLexical.contract_hits,
      arm_word_introduced_by_the_transformer: armLexical.introduced,
      action_token_contract_hits: actionLexical.contract_hits,
      action_token_introduced_by_the_transformer: actionLexical.introduced,
      canonical_label_4gram_overlap: canonicalOverlap.length,
      line_count_delta: substitution.line_delta
    };
    requests.set(f.fixture_id, transformed);
  }
  if (!conformanceOk) failD2A1("D2_A1_TRANSFORMER_IMPLEMENTATION_NONCONFORMANT", JSON.stringify(conformance));
  const firstRequest = requests.get(D2A1_QUALIFICATION_FIXTURES[0]?.fixture_id ?? "") as ModelTransportRequestV0;
  let transformerOnTransformerRejected = false;
  try {
    buildD2SemanticReadoutRequestV0(firstRequest);
  } catch {
    transformerOnTransformerRejected = true;
  }
  if (!transformerOnTransformerRejected) failD2A1("D2_A1_TRANSFORMER_ON_TRANSFORMER_NOT_REJECTED", "second application accepted");
  await write("transformer-conformance-report.json", {
    transformer: D2A1_TRANSFORMER_CONTRACT.name,
    frozen_contract_hash: rev11c.contract_text_hash,
    frozen_revision_1_1c_manifest_hash: rev11c.manifest_hash,
    per_fixture: conformance,
    transformer_on_transformer_rejected: transformerOnTransformerRejected,
    decision_probe_v2_used: false,
    a0_transformer_reused: false,
    lexical_laws_source:
      "D2A1_LEXICAL_LAWS (frozen) verified on the FINAL model-facing request, not only on the contract text",
    verdict: "D2_A1_TRANSFORMER_CONFORMANT"
  });

  // ---- freeze the implementation identity BEFORE the first call --------------------------------
  const sourceText = await readFile(TRANSFORMER_SOURCE, "utf8");
  const implementationManifest = {
    transformer: D2A1_TRANSFORMER_CONTRACT.name,
    transformer_source_file: TRANSFORMER_SOURCE,
    transformer_source_hash: String(await hashEnvelope(D2_HASH_PROJECTION_V0, { source: sourceText })),
    a1_contract_hash: rev11c.contract_text_hash,
    a1_schema_hash: String(await hashEnvelope(D2_HASH_PROJECTION_V0, { schema: D2A1_JSON_SCHEMA })),
    anchors_hash: String(await hashEnvelope(D2_HASH_PROJECTION_V0, { anchors: D2A1_ANCHORS_FROZEN_V0 })),
    paraphrases_hash: String(await hashEnvelope(D2_HASH_PROJECTION_V0, { paraphrase: D2A1_PARAPHRASE })),
    fixture_manifest_hash: rev11c.fixture_manifest_hash,
    revision_1_1c_manifest_hash: rev11c.manifest_hash,
    a1_outputs_seen_before_implementation_freeze: false,
    implementation_frozen: true,
    may_not_be_modified_during_qualification: true,
    rule_if_a_bug_is_found: "stop the experiment; a fixed transformer may not continue the remaining replicates"
  };
  await write("A1_TRANSFORMER_IMPLEMENTATION_MANIFEST.json", implementationManifest);

  // ---- three frozen requests, one per fixture --------------------------------------------------
  const letters = ["A", "B", "C"];
  for (const [index, f] of D2A1_QUALIFICATION_FIXTURES.entries()) {
    const request = requests.get(f.fixture_id) as ModelTransportRequestV0;
    await write(`fixture-${letters[index]}-request.json`, {
      fixture_id: f.fixture_id,
      expected_token: f.expected_token,
      request_hash: String(await hashEnvelope(REQUEST_HASH_PROJECTION, request as unknown)),
      request
    });
  }

  // ---- the frozen primary executor -------------------------------------------------------------
  if (process.env["D2_A1_CONFORMANCE_ONLY"] === "1") {
    process.stdout.write("D2_A1_CONFORMANCE_ONLY: offline gate passed, 0 model calls, stopping before the executor.\n");
    return;
  }
  const apiKey = process.env["MODEL_API_KEY"];
  if (apiKey === undefined || apiKey.length === 0) failD2A1("PRIMARY_EXECUTOR_UNAVAILABLE", "no credential; no substitution attempted");
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
  const trials: A1Trial[] = [];
  let ordinal = 0;
  for (const f of D2A1_QUALIFICATION_FIXTURES) {
    const request = requests.get(f.fixture_id) as ModelTransportRequestV0;
    const requestHash = String(await hashEnvelope(REQUEST_HASH_PROJECTION, request as unknown));
    for (let replicate = 1; replicate <= 3; replicate += 1) {
      ordinal += 1;
      process.stdout.write(`[${String(ordinal)}/9] ${f.fixture_id} r=${String(replicate)} ... `);
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
      const parsed = failure === null ? parseA1(content ?? "") : ({ ok: false as const, code: "TRANSPORT_FAILED" });
      const trial: A1Trial = {
        trial_id: `d2-a1-qf-${String(ordinal).padStart(3, "0")}`,
        fixture_id: f.fixture_id,
        replicate_ordinal: replicate,
        request_hash: requestHash,
        expected_token: f.expected_token,
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
      await write(`trial-${String(ordinal).padStart(3, "0")}.json`, trial);
      process.stdout.write(`${parsed.ok ? parsed.token : `REJECTED:${parsed.code}`}\n`);
    }
  }

  // ---- freeze the raw dataset BEFORE scoring ---------------------------------------------------
  const datasetHash = await write("qualification-dataset.json", {
    stage: "D2_A1_INSTRUMENT_QUALIFICATION",
    uses_characteros_canonical_state: false,
    contains_treatment: false,
    planned: 9,
    observed: trials.length,
    scored: false,
    trials
  });
  await write("qualification-dataset-hash.json", {
    A1_QUALIFICATION_DATASET_SHA256: datasetHash,
    frozen_before_scoring: true,
    trials: trials.length
  });

  // ---- scoring against the frozen bytes ---------------------------------------------------------
  const frozenDoc = JSON.parse(await readFile(join(outdir, "qualification-dataset.json"), "utf8")) as { trials: A1Trial[] };
  const counts: Record<string, Record<string, number>> = {};
  const modalReport: Record<string, unknown> = {};
  let invalidTrials = 0;
  let allPass = true;
  for (const f of D2A1_QUALIFICATION_FIXTURES) {
    const rows = frozenDoc.trials.filter((t) => t.fixture_id === f.fixture_id);
    invalidTrials += rows.filter((t) => t.parsed_token === null).length;
    const c: Record<string, number> = {};
    for (const row of rows) {
      const key = row.parsed_token ?? `INVALID:${row.parser_status}`;
      c[key] = (c[key] ?? 0) + 1;
    }
    counts[f.fixture_id] = c;
    const ranked = Object.entries(c).sort((a, b) => b[1] - a[1]);
    const top = ranked[0];
    const tie = top !== undefined && ranked[1] !== undefined && ranked[1][1] === top[1];
    const modal = top === undefined || tie ? null : top[0];
    const pass = modal === f.expected_token;
    modalReport[f.fixture_id] = { counts: c, modal, expected: f.expected_token, pass, tie };
    if (!pass) allPass = false;
  }
  const invalidRuleTriggered = invalidTrials > 0;
  const qualified = allPass && !invalidRuleTriggered;
  await write("qualification-counts.json", counts);
  await write("qualification-modal-report.json", {
    per_fixture: modalReport,
    exact_token_match_required: true,
    semantic_similarity_substitution_allowed: false,
    human_interpretation_allowed: false
  });
  const verdict = qualified
    ? {
        verdict: "D2_A1_INSTRUMENT_QUALIFIED",
        d2_a1_neutral_pilot_authorised: true,
        d2_a1_state_experiment_not_started: true,
        d2_model_calls_this_round: 9
      }
    : {
        verdict: "D2_A1_INSTRUMENT_UNQUALIFIED",
        d2_execution_stopped_at_a1_qualification: true,
        d2_a1_state_experiment_not_started: true,
        d2_model_calls_this_round: 9,
        forbidden_verdicts_not_emitted: ["BELIEF_PROJECTION_STRUCTURALLY_LEGIBLE_BUT_SEMANTIC_UPTAKE_NOT_ESTABLISHED"],
        causal_breakpoint_localised: false
      };
  await write("qualification-verdict.json", {
    ...verdict,
    dataset_hash: datasetHash,
    invalid_trials: invalidTrials,
    invalid_rule: D2A1_QUALIFICATION_INVALID_RULE,
    invalid_rule_triggered: invalidRuleTriggered,
    denominator: 9,
    executor,
    scorer: "frozen REV1.1c rule (each fixture's modal equals its pre-registered expected token; no tolerance, no similarity)"
  });
  await write("A1_QUALIFICATION_MANIFEST.json", {
    ...verdict,
    dataset_hash: datasetHash,
    transformer_implementation_manifest: implementationManifest,
    revision_1_1c_manifest_hash: rev11c.manifest_hash,
    uses_characteros_canonical_state: false,
    may_be_used_as_characteros_evidence: false,
    may_not_be_cited_as_semantic_uptake: true,
    decision_probe_v2_used: false,
    d2_model_calls_this_round: 9,
    d2_model_calls_cumulative: 36
  });

  process.stdout.write(`\n${verdict.verdict}\nD2_MODEL_CALLS_THIS_ROUND = 9\n`);
  for (const [id, r] of Object.entries(modalReport)) {
    const row = r as { modal: string | null; expected: string; pass: boolean };
    process.stdout.write(`  ${id}: modal=${String(row.modal)} expected=${row.expected} ${row.pass ? "PASS" : "FAIL"}\n`);
  }
}

await main();
