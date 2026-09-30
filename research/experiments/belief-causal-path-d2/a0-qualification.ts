/* eslint-disable no-restricted-imports -- Isolated research harness COMPOSING frozen production seams (repository convention); no production semantics are copied. */
/**
 * D2 A0 INSTRUMENT QUALIFICATION — exactly 9 calls, state-blind fixtures, no CharacterOS state.
 *
 *   MODEL_API_KEY=... node research/experiments/belief-causal-path-d2/a0-qualification.ts <outdir>
 *
 * Order: implement/verify the transformer offline → fixture identity gate → build three frozen
 * requests → 9 calls → freeze the raw dataset and its hash → score with the frozen rule.
 * Nothing is scored before the dataset hash exists, and no call happens before conformance passes.
 */

import { mkdir, writeFile } from "node:fs/promises";
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

import { D2_HASH_PROJECTION_V0, D2A0_TOKENS } from "./contract-rev1.ts";
import {
  D2A0_CONTRACT_TEXT,
  D2A0_JSON_SCHEMA,
  D2A0_QUALIFICATION_FIXTURES,
  D2A0_QUALIFICATION_INVARIANTS,
  D2A0_TRANSFORMER_CONTRACT,
  deriveD2Rev11bManifestV0
} from "./contract-rev1-1b-a0-fixtures.ts";
import {
  DP_V2_MARKER,
  buildD2StructuralReadoutRequestV0
} from "./transformer-a0.ts";
import { buildArmWorldV0 } from "../belief-state-sensitivity-d1/world-a1.ts";

const BELIEF_HEADER = "[SUBJECTIVE BELIEF STANCES";

function fail(verdict: string, detail: string): never {
  throw new Error(`${verdict}: ${detail}`);
}

/** Mechanical belief-block substitution used ONLY to place a qualification fixture's stimulus. */
function replaceBeliefBlockBody(userContent: string, fixtureBeliefLine: string): string {
  const lines = userContent.split("\n");
  const start = lines.findIndex((l) => l.startsWith(BELIEF_HEADER));
  if (start < 0) fail("D2_A0_STIMULUS_BINDING_FAILED", "belief header absent");
  let end = start + 1;
  while (end < lines.length && !(lines[end] ?? "").startsWith("[")) end += 1;
  const header = lines[start] ?? "";
  return [...lines.slice(0, start), header, ...fixtureBeliefLine.split("\n"), ...lines.slice(end)].join("\n");
}

/** Byte-level proof that the fixture substitution touched the belief block and nothing else. */
function substitutionScopeV0(pristineUser: string, stimUser: string): {
  readonly only_block_changed: boolean;
  readonly outside_identical: boolean;
  readonly line_delta: number;
} {
  const pristineLines = pristineUser.split("\n");
  const stimLines = stimUser.split("\n");
  const start = pristineLines.findIndex((l) => l.startsWith(BELIEF_HEADER));
  if (start < 0) fail("D2_A0_STIMULUS_BINDING_FAILED", "belief header absent");
  let end = start + 1;
  while (end < pristineLines.length && !(pristineLines[end] ?? "").startsWith("[")) end += 1;
  let stimEnd = start + 1;
  while (stimEnd < stimLines.length && !(stimLines[stimEnd] ?? "").startsWith("[")) stimEnd += 1;
  const prefixIdentical =
    pristineLines.slice(0, start).join("\n") === stimLines.slice(0, start).join("\n");
  const suffixIdentical =
    pristineLines.slice(end).join("\n") === stimLines.slice(stimEnd).join("\n");
  return {
    only_block_changed: prefixIdentical && suffixIdentical,
    outside_identical: prefixIdentical && suffixIdentical,
    line_delta: stimLines.length - pristineLines.length
  };
}

interface A0Trial {
  readonly trial_id: string;
  readonly fixture_id: string;
  readonly replicate_ordinal: number;
  readonly request_hash: string;
  readonly expected_token: string;
  readonly raw_output: string | null;
  readonly parsed_token: string | null;
  readonly parser_status: string;
  readonly transport_status: string;
  readonly transport_failure: string | null;
  readonly executor: Record<string, unknown>;
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
  if (typeof stance !== "string" || !(D2A0_TOKENS as readonly string[]).includes(stance)) return { ok: false, code: "STANCE_NOT_IN_CLOSED_SET" };
  return { ok: true, token: stance };
}

async function main(): Promise<void> {
  const outdir = process.argv[2];
  if (outdir === undefined) throw new Error("usage: node a0-qualification.ts <outdir>");
  await mkdir(outdir, { recursive: true });
  const write = async (name: string, value: unknown): Promise<void> => {
    await writeFile(join(outdir, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");
  };

  // ---- 0/1. transformer conformance, OFFLINE, before any call -------------------------
  await write("qualification-fixture-manifest.json", {
    source: "contract-rev1-1b-a0-fixtures.ts",
    rewritten_at_runtime: false,
    fixtures: D2A0_QUALIFICATION_FIXTURES,
    invariants: D2A0_QUALIFICATION_INVARIANTS
  });
  // fixture identity gate
  for (const f of D2A0_QUALIFICATION_FIXTURES) {
    if (f.belief_line.includes("Caution is warranted")) fail("D2_A0_FIXTURE_CONTAINS_CAUTION", f.fixture_id);
    for (const marker of ["HIGH", "LOW", "NEUTRAL", "\"credence\":0.8", "\"credence\":0.2", "\"credence\":0.5"]) {
      if (f.belief_line.includes(marker)) fail("D2_A0_FIXTURE_LEAKAGE", `${f.fixture_id}: ${marker}`);
    }
    if (D2A0_TOKENS.some((t) => f.belief_line.includes(t))) fail("D2_A0_FIXTURE_CONTAINS_EXPECTED_TOKEN", f.fixture_id);
  }
  const propositions = new Set(D2A0_QUALIFICATION_FIXTURES.map((f) => /"proposition_label":"([^"]+)"/.exec(f.belief_line)?.[1] ?? ""));
  if (propositions.size !== 1 || propositions.has("")) fail("D2_A0_FIXTURE_PROPOSITION_NOT_SHARED", JSON.stringify([...propositions]));

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
  for (const f of D2A0_QUALIFICATION_FIXTURES) {
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
    const transformed = buildD2StructuralReadoutRequestV0(stimPristine);
    const sys = transformed.messages.find((m) => m.role === "system")?.content ?? "";
    const contractCount = sys.split(D2A0_CONTRACT_TEXT).length - 1;
    const prefixOk = sys.slice(0, sys.length - D2A0_CONTRACT_TEXT.length) === (stimPristine.messages[0]?.content ?? "");
    const dpAbsent = !sys.includes(DP_V2_MARKER);
    const schemaExact = canonicalJsonString(transformed.structured_output?.schema ?? {}) === canonicalJsonString(D2A0_JSON_SCHEMA);
    conformance[f.fixture_id] = {
      production_prefix_byte_identical: prefixOk,
      schema_is_frozen_a0_schema: schemaExact,
      contract_text_appended_count: contractCount,
      decision_probe_v2_absent: dpAbsent,
      belief_block_is_the_only_substituted_region: substitution.only_block_changed,
      outside_block_bytes_identical: substitution.outside_identical,
      line_count_delta: substitution.line_delta,
      system_prompt_bytes: sys.length,
      user_content_bytes: stimUser.length
    };
    if (!prefixOk || !schemaExact || contractCount !== 1 || !dpAbsent || !substitution.only_block_changed) {
      fail("D2_A0_TRANSFORMER_IMPLEMENTATION_NONCONFORMANT", `${f.fixture_id}: ${JSON.stringify(conformance[f.fixture_id])}`);
    }
    requests.set(f.fixture_id, transformed);
  }
  let rejected = false;
  try {
    buildD2StructuralReadoutRequestV0(requests.get(D2A0_QUALIFICATION_FIXTURES[0]?.fixture_id ?? "") as ModelTransportRequestV0);
  } catch {
    rejected = true;
  }
  if (!rejected) fail("D2_A0_TRANSFORMER_ON_TRANSFORMER_NOT_REJECTED", "second application was accepted");
  const rev11b = await deriveD2Rev11bManifestV0();
  await write("transformer-conformance-report.json", {
    transformer: D2A0_TRANSFORMER_CONTRACT.name,
    frozen_contract_hash: rev11b.contract_text_hash,
    per_fixture: conformance,
    transformer_on_transformer_rejected: rejected,
    decision_probe_v2_used: false,
    a1_transformer_present: false,
    b_transformer_present: false,
    verdict: "D2_A0_TRANSFORMER_CONFORMANT"
  });

  // ---- 3. three frozen requests, one per fixture -------------------------------------
  for (const [index, f] of D2A0_QUALIFICATION_FIXTURES.entries()) {
    const request = requests.get(f.fixture_id) as ModelTransportRequestV0;
    await write(`fixture-${["A", "B", "C"][index]}-request.json`, {
      fixture_id: f.fixture_id,
      expected_token: f.expected_token,
      request_hash: String(await hashEnvelope("characteros-next/research/decision-probe/request/v0", request as unknown)),
      request
    });
  }

  // ---- 4. executor ---------------------------------------------------------------------
  if (process.env["D2_A0_CONFORMANCE_ONLY"] === "1") {
    process.stdout.write("D2_A0_CONFORMANCE_ONLY: offline gate passed, 0 model calls, stopping before the executor.\n");
    return;
  }
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
  const executor = { provider: "DeepSeek", model, endpoint, temperature: 0, max_output_tokens: 256, provider_thinking: "disabled" };

  // ---- 5/6. exactly nine calls --------------------------------------------------------
  const trials: A0Trial[] = [];
  let ordinal = 0;
  for (const f of D2A0_QUALIFICATION_FIXTURES) {
    const request = requests.get(f.fixture_id) as ModelTransportRequestV0;
    const requestHash = String(await hashEnvelope("characteros-next/research/decision-probe/request/v0", request as unknown));
    for (let replicate = 1; replicate <= 3; replicate += 1) {
      ordinal += 1;
      process.stdout.write(`[${String(ordinal)}/9] ${f.fixture_id} r=${String(replicate)} ... `);
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
      const parsed = failure === null ? parseA0(content ?? "") : { ok: false as const, code: "TRANSPORT_FAILED" };
      const trial: A0Trial = {
        trial_id: `d2-a0-qf-${String(ordinal).padStart(3, "0")}`,
        fixture_id: f.fixture_id,
        replicate_ordinal: replicate,
        request_hash: requestHash,
        expected_token: f.expected_token,
        raw_output: content,
        parsed_token: parsed.ok ? parsed.token : null,
        parser_status: parsed.ok ? "VALID" : parsed.code,
        transport_status: failure === null ? "OK" : "FAILED",
        transport_failure: failure,
        executor,
        latency_ms: latency
      };
      trials.push(trial);
      await write(`trial-${String(ordinal).padStart(3, "0")}.json`, trial);
      process.stdout.write(`${parsed.ok ? parsed.token : `REJECTED:${parsed.code}`}\n`);
    }
  }

  // ---- 7. freeze the raw dataset BEFORE scoring --------------------------------------
  const datasetHash = String(await hashEnvelope(D2_HASH_PROJECTION_V0, { trials }));
  await write("qualification-dataset.json", { ordered_by: "trial_id", scored: false, trials });
  await write("qualification-dataset-hash.json", { qualification_dataset_sha256: datasetHash, frozen_before_scoring: true });

  // ---- 8. frozen qualification rule ---------------------------------------------------
  const counts: Record<string, Record<string, number>> = {};
  const modalReport: Record<string, unknown> = {};
  let allPass = true;
  for (const f of D2A0_QUALIFICATION_FIXTURES) {
    const rows = trials.filter((t) => t.fixture_id === f.fixture_id);
    const c: Record<string, number> = {};
    for (const row of rows) {
      const key = row.parsed_token ?? `INVALID:${row.parser_status}`;
      c[key] = (c[key] ?? 0) + 1;
    }
    counts[f.fixture_id] = c;
    const top = Object.entries(c).sort((a, b) => b[1] - a[1])[0];
    const modal = top !== undefined && top[1] > 1 ? top[0] : null;
    const pass = modal === f.expected_token;
    modalReport[f.fixture_id] = { counts: c, modal, expected: f.expected_token, pass };
    if (!pass) allPass = false;
  }
  await write("qualification-counts.json", counts);
  await write("qualification-modal-report.json", modalReport);

  const verdict = allPass
    ? {
        verdict: "D2_A0_INSTRUMENT_QUALIFIED",
        d2_a0_neutral_pilot_authorised: true,
        d2_a0_state_experiment_not_started: true,
        model_calls_this_round: 9
      }
    : {
        verdict: "D2_A0_INSTRUMENT_UNQUALIFIED",
        d2_execution_stopped_at_qualification: true,
        d2_a0_state_experiment_not_started: true,
        model_calls_this_round: 9,
        forbidden_verdicts_not_emitted: ["BELIEF_PROJECTION_STRUCTURAL_READOUT_NOT_ESTABLISHED"],
        causal_breakpoint_localised: false
      };
  await write("qualification-verdict.json", { ...verdict, dataset_hash: datasetHash, executor, scorer: "frozen qualification rule (modal == pre-registered expected token)" });
  await write("A0_QUALIFICATION_MANIFEST.json", {
    ...verdict,
    dataset_hash: datasetHash,
    transformer_contract_hash: rev11b.contract_text_hash,
    fixture_manifest_hash: rev11b.fixture_manifest_hash,
    uses_characteros_canonical_state: false,
    may_be_used_as_characteros_evidence: false,
    decision_probe_v2_used: false,
    d2_model_calls_total: 9
  });

  process.stdout.write(`\n${verdict.verdict}\nD2_MODEL_CALLS = 9\n`);
  for (const [id, r] of Object.entries(modalReport)) {
    const row = r as { modal: string | null; expected: string; pass: boolean };
    process.stdout.write(`  ${id}: modal=${String(row.modal)} expected=${row.expected} ${row.pass ? "PASS" : "FAIL"}\n`);
  }
}

await main();
