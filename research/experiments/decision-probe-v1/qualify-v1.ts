/* eslint-disable no-restricted-imports -- Isolated research harness over frozen built production roots (repository convention); zero production code changes. */
/**
 * DecisionProbeV1 — D0-V1 qualification driver. RESEARCH-ONLY.
 *
 *   node research/experiments/decision-probe-v1/qualify-v1.ts <outdir>
 *
 * Phases, in this order (the order is the preregistration):
 *   0. write + hash + freeze the V1-C3 paraphrase manifest and its audits  (BEFORE any call)
 *   1. PRIMARY   — measurement mode, V1 contract,      3 fixtures x r_pilot 3 =  9 calls
 *   2. CONTROL   — PURE_SUBSTITUTION diagnostic,       3 fixtures x r_pilot 3 =  9 calls
 *   3. C3        — DEFINITION_PARAPHRASE_CONTROL,      3 fixtures x r_pilot 3 =  9 calls
 *
 * V0 is never written to. No retry, no repair, no re-prompt, no parameter change.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { canonicalJsonString, hashEnvelope } from "../../../packages/subject-core/dist/index.js";
import type { HashV1 } from "../../../packages/subject-core/dist/index.js";
import { OllamaNativeCognitionTransportV0 } from "../../../packages/runtime/dist/providers/cognition/ollama-native-cognition-transport.js";
import { OpenAiCompatibleTransportV0 } from "../../../packages/runtime/dist/transports/model-transport.js";
import type { ModelTransportV0 } from "../../../packages/runtime/dist/transports/model-transport.js";

import { captureProductionRequestForFixtureV0 } from "../decision-probe-v0/binding.ts";
import { DECISION_PROBE_DECISIONS } from "../decision-probe-v0/contract.ts";
import { D0_FIXTURES, D0_PROTOCOL_V0 } from "../decision-probe-v0/fixtures.ts";
import { deriveC3ManifestV1 } from "./c3-paraphrase.ts";
import {
  DECISION_PROBE_V1_INHERITED_V0,
  DECISION_PROBE_V1_OVERRIDE_BLOCK_V0_INHERITED,
  DECISION_PROBE_V1_QUALIFICATION_RULE,
  DECISION_PROBE_V1_SCHEMA_VERSION
} from "./contract.ts";
import { runDecisionProbeV1Trial, type DecisionProbeV1TrialV0 } from "./probe-v1.ts";
import { runV1AuditsV0 } from "./audits.ts";

const GENERATION = Object.freeze({
  temperature: 0,
  cognition_num_predict: 256,
  context_window_tokens: 8192,
  think: false
});

type Cell = {
  fixture_id: string;
  phase: string;
  ACCEPT: number;
  VERIFY: number;
  REJECT: number;
  rejected: number;
  transport_failed: number;
  valid: number;
  modal: string | null;
  agreement: number;
  expected: string;
  passes: boolean;
};

function summarize(trials: readonly DecisionProbeV1TrialV0[], phase: string): Cell[] {
  return D0_FIXTURES.map((fixture) => {
    const rows = trials.filter((t) => t.phase === phase && t.fixture_id === fixture.fixture_id);
    const counts: Record<string, number> = { ACCEPT: 0, VERIFY: 0, REJECT: 0 };
    let rejected = 0;
    let failed = 0;
    for (const row of rows) {
      if (row.outcome === "DECIDED" && row.decision !== null) counts[row.decision] = (counts[row.decision] ?? 0) + 1;
      else if (row.outcome === "REJECTED") rejected += 1;
      else failed += 1;
    }
    const valid = rows.length - rejected - failed;
    const top = DECISION_PROBE_DECISIONS.map((t) => [t, counts[t] ?? 0] as const).sort((a, b) => b[1] - a[1])[0] ?? ["", 0];
    const modal = valid > 0 && top[1] > 0 ? top[0] : null;
    const agreement = valid > 0 ? top[1] / valid : 0;
    return {
      fixture_id: fixture.fixture_id,
      phase,
      ACCEPT: counts["ACCEPT"] ?? 0,
      VERIFY: counts["VERIFY"] ?? 0,
      REJECT: counts["REJECT"] ?? 0,
      rejected,
      transport_failed: failed,
      valid,
      modal,
      agreement,
      expected: fixture.expected_decision,
      passes: modal === fixture.expected_decision && agreement >= D0_PROTOCOL_V0.min_agreement_fraction
    };
  });
}

async function readOllamaDigest(baseUrl: string, model: string): Promise<string | null> {
  try {
    const response = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(6000) });
    const body = (await response.json()) as { models?: { name?: string; digest?: string }[] };
    return body.models?.find((entry) => entry.name === model)?.digest ?? null;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const outdir = process.argv[2];
  if (outdir === undefined) throw new Error("usage: node qualify-v1.ts <outdir>");
  await mkdir(outdir, { recursive: true });
  const write = async (name: string, value: unknown, pretty = true): Promise<void> => {
    await writeFile(join(outdir, name), pretty ? `${JSON.stringify(value, null, 2)}\n` : `${canonicalJsonString(value)}\n`, "utf8");
  };

  // ---- PHASE 0: preregister C3 before any model call -------------------------------
  const c3 = await deriveC3ManifestV1();
  await write("V1_C3_PARAPHRASE_MANIFEST.json", c3);
  const preregistration = {
    order: [
      "V1_C3_PARAPHRASE_MANIFEST.json written and hashed BEFORE any model call",
      "PRIMARY measurement-mode qualification",
      "CONTROL PURE_SUBSTITUTION diagnostic",
      "C3 definition-paraphrase control"
    ],
    c3_manifest_hash: c3.hashes.manifest_hash,
    c3_all_audits_pass: c3.all_audits_pass,
    recorded_at_utc: new Date().toISOString(),
    model_calls_before_this_record: 0
  };
  await write("PREREGISTRATION.json", preregistration);

  const audits = await runV1AuditsV0();
  await write("audit-manifest.json", audits);

  // PROVIDER-SPECIFIC TRANSPORT SELECTION (tooling only). The frozen protocol artifacts —
  // fixtures, expected decisions, V1 override bytes, C3 paraphrase bytes, schema, thresholds,
  // scoring and verdict rules — are identical for both families. Only the transport differs,
  // which the preregistration lists as an allowed executor-specific difference.
  const family = (process.env["CHARACTEROS_DECISION_PROBE_EXECUTOR"] ?? "ollama") as "ollama" | "openai";
  let transport: ModelTransportV0;
  let executor: Record<string, unknown>;
  if (family === "openai") {
    const cloudBase = process.env["MODEL_API_BASE_URL"] ?? "https://api.deepseek.com";
    const cloudModel = process.env["MODEL_API_MODEL"] ?? "deepseek-flash";
    const apiKey = process.env["MODEL_API_KEY"];
    if (apiKey === undefined || apiKey.length === 0) {
      throw new Error("PRIMARY_EXECUTOR_UNAVAILABLE_FOR_D0_V1: MODEL_API_KEY absent (cloud family)");
    }
    transport = new OpenAiCompatibleTransportV0({
      base_url: cloudBase,
      model: cloudModel,
      api_key: apiKey,
      timeout_ms: 120_000,
      temperature: GENERATION.temperature,
      max_output_tokens: GENERATION.cognition_num_predict,
      // Provider-specific generation parameter, recorded in the manifest. `deepseek-flash` is
      // thinking-first; with thinking enabled it spends the whole output budget on reasoning and
      // returns empty content, which the frozen fail-closed parser would reject. This matches the
      // product's documented default (`CHARACTEROS_DEEPSEEK_THINKING = disabled`).
      provider_request_options: { thinking: { type: "disabled" } }
    }) as unknown as ModelTransportV0;
    executor = {
      family: "openai",
      transport_class: "OpenAiCompatibleTransportV0",
      model: cloudModel,
      model_digest: null,
      endpoint: cloudBase,
      generation: {
        ...GENERATION,
        provider_thinking: "disabled",
        context_window_tokens: "NOT_APPLICABLE_CLOUD_FAMILY"
      },
      structured_output_support: "SCHEMA_NOT_FORWARDED_PROMPT_CONTRACT_AND_HOST_PARSER_ONLY",
      declares_primary_executor: process.env["CHARACTEROS_DECISION_PROBE_PRIMARY"] === "1"
    };
  } else {
    const baseUrl = process.env["OLLAMA_BASE_URL"] ?? "http://127.0.0.1:11434";
    const localModel = process.env["CHARACTEROS_MODEL"] ?? "qwen3.5:9b";
    transport = new OllamaNativeCognitionTransportV0({
      base_url: baseUrl,
      model: localModel,
      timeout_ms: 120_000,
      num_predict: GENERATION.cognition_num_predict,
      context_window_tokens: GENERATION.context_window_tokens
    }) as unknown as ModelTransportV0;
    executor = {
      family: "ollama",
      transport_class: "OllamaNativeCognitionTransportV0",
      model: localModel,
      model_digest: await readOllamaDigest(baseUrl, localModel),
      endpoint: baseUrl,
      generation: GENERATION,
      structured_output_support: "GRAMMAR_ENFORCED_VIA_NATIVE_format",
      declares_primary_executor: process.env["CHARACTEROS_DECISION_PROBE_PRIMARY"] === "1"
    };
  }
  await write("executor-manifest.json", executor);
  await write("inherited-parameter-manifest.json", {
    decision_probe_version: DECISION_PROBE_V1_SCHEMA_VERSION,
    inherited_from: "decision-probe-v0",
    inherited: DECISION_PROBE_V1_INHERITED_V0,
    qualification_rule: DECISION_PROBE_V1_QUALIFICATION_RULE
  });
  await write("fixture-manifest.json", { fixtures: D0_FIXTURES, protocol: D0_PROTOCOL_V0 });

  const bindings = [];
  for (const fixture of D0_FIXTURES) bindings.push(await captureProductionRequestForFixtureV0(fixture));
  await write("binding-manifest.json", bindings.map((b) => ({
    fixture_id: b.fixture_id,
    observation: b.observation,
    provenance: b.provenance,
    hashes: b.hashes
  })));

  const boundByFixture = new Map(bindings.map((b) => [b.fixture_id, b]));
  const trials: DecisionProbeV1TrialV0[] = [];
  const r = D0_PROTOCOL_V0.r_pilot;

  const phases: readonly { readonly phase: "PRIMARY" | "CONTROL" | "C3"; readonly mode: "SUBSTITUTION_WITH_OVERRIDE" | "PURE_SUBSTITUTION"; readonly block: string }[] = [
    { phase: "PRIMARY", mode: "SUBSTITUTION_WITH_OVERRIDE", block: DECISION_PROBE_V1_OVERRIDE_BLOCK_V0_INHERITED },
    { phase: "CONTROL", mode: "PURE_SUBSTITUTION", block: DECISION_PROBE_V1_OVERRIDE_BLOCK_V0_INHERITED },
    { phase: "C3", mode: "SUBSTITUTION_WITH_OVERRIDE", block: c3.c3_override_block }
  ];

  let ordinal = 0;
  for (const spec of phases) {
    for (const fixture of D0_FIXTURES) {
      const bound = boundByFixture.get(fixture.fixture_id);
      if (bound === undefined) throw new Error(`no binding for ${fixture.fixture_id}`);
      for (let replicate = 1; replicate <= r; replicate += 1) {
        ordinal += 1;
        process.stdout.write(`[${String(ordinal)}] ${spec.phase} ${fixture.fixture_id} r=${String(replicate)}/${String(r)} ... `);
        const trial = await runDecisionProbeV1Trial({
          transport,
          production_request: bound.production_request,
          mode: spec.mode,
          override_block: spec.block,
          phase: spec.phase,
          fixture_id: fixture.fixture_id,
          replicate_ordinal: replicate
        });
        trials.push(trial);
        process.stdout.write(`${trial.outcome}${trial.decision === null ? "" : ` ${trial.decision}`}\n`);
      }
    }
  }

  const primaryCells = summarize(trials, "PRIMARY");
  const controlCells = summarize(trials, "CONTROL");
  const c3Cells = summarize(trials, "C3");

  const executorTag = String(executor.model).toUpperCase().replace(/[^A-Z0-9]+/g, "_");
  const primaryRejected = primaryCells.reduce((s, c) => s + c.rejected, 0);
  const primaryFailed = primaryCells.reduce((s, c) => s + c.transport_failed, 0);
  const primaryCalls = primaryCells.reduce((s, c) => s + c.valid + c.rejected + c.transport_failed, 0);

  let primaryVerdict: string;
  if (!audits.all_pass) primaryVerdict = "INCONCLUSIVE_AUDIT_FAILED";
  else if (primaryFailed > 0 && primaryCells.every((c) => c.valid === 0)) primaryVerdict = "EXECUTOR_UNQUALIFIED_FOR_DECISION_PROBE";
  else if (primaryCalls > 0 && primaryRejected / primaryCalls > D0_PROTOCOL_V0.max_schema_rejection_rate) primaryVerdict = "EXECUTOR_UNQUALIFIED_FOR_DECISION_PROBE";
  else if (primaryCells.some((c) => c.modal !== null && c.modal !== c.expected)) primaryVerdict = `DECISION_INSTRUMENT_V1_UNQUALIFIED_ON_${executorTag}`;
  else if (primaryCells.some((c) => !c.passes)) primaryVerdict = "INCONCLUSIVE_BY_DECISION_NOISE";
  else primaryVerdict = `DECISION_INSTRUMENT_V1_QUALIFIED_ON_${executorTag}`;

  const controlAllFail = controlCells.every((c) => c.valid === 0);
  const controlDivergent = controlCells.filter((c) => c.modal !== null && c.modal !== c.expected).map((c) => c.fixture_id);
  const controlVerdict = controlAllFail
    ? "EXECUTOR_UNQUALIFIED_FOR_DECISION_PROBE"
    : controlDivergent.length === 0
      ? "SCHEMA_SUBSTITUTION_HONORED"
      : `CONSTRUCT_NOT_INSTANTIATED_BY_SCHEMA_ALONE (${controlDivergent.join(", ")})`;

  const c3Divergent = c3Cells.filter((c) => c.modal !== null && c.modal !== c.expected).map((c) => c.fixture_id);
  const c3Valid = c3Cells.reduce((s, c) => s + c.valid, 0);
  const c3Verdict = !c3.all_audits_pass
    ? "PARAPHRASE_CONTROL_INVALID"
    : c3Valid === 0
      ? "PARAPHRASE_CONTROL_INVALID"
      : c3Divergent.length === 0
        ? "CONSTRUCT_RESPONSE_PARAPHRASE_STABLE"
        : c3Divergent.length >= 3
          ? "LEXICALLY_SENSITIVE_SCALE_WIDE"
          : "LEXICALLY_SENSITIVE";

  // ---- V1-C4: override identity across all primary cells ---------------------------
  const primaryBlockHashes = [...new Set(trials.filter((t) => t.phase === "PRIMARY").map((t) => t.override_block_hash))];
  const overrideIdentity = {
    rule: "OVERRIDE_IDENTITY_ACROSS_ARMS",
    primary_cells_share_one_block_hash: primaryBlockHashes.length === 1,
    primary_override_block_hashes: primaryBlockHashes,
    c3_block_hash_distinct: !primaryBlockHashes.includes(c3.hashes.c3_override_block_hash),
    verdict: primaryBlockHashes.length === 1 ? "OVERRIDE_IDENTITY_HELD" : "PROTOCOL_VIOLATION_OVERRIDE_DRIFT"
  };

  await write("trials.json", trials);
  await write("cells.json", { primary: primaryCells, control: controlCells, c3: c3Cells });
  await write("verdict.json", {
    decision_probe_version: DECISION_PROBE_V1_SCHEMA_VERSION,
    inherited_from: "decision-probe-v0",
    r,
    executor_declares_primary: executor.declares_primary_executor,
    audits_all_pass: audits.all_pass,
    primary_measurement_mode_verdict: primaryVerdict,
    control_diagnostic_verdict: controlVerdict,
    c3_diagnostic_verdict: c3Verdict,
    override_identity: overrideIdentity,
    control_veto_equivalent_outcome: controlAllFail,
    overall_qualification_verdict:
      controlAllFail && primaryVerdict.startsWith("DECISION_INSTRUMENT_V1_QUALIFIED")
        ? "EXECUTOR_UNQUALIFIED_FOR_DECISION_PROBE"
        : primaryVerdict,
    d1_unlock_eligible: false,
    d1_unlock_rule: primaryVerdict.startsWith("DECISION_INSTRUMENT_V1_QUALIFIED") && executor.declares_primary_executor
  });

  const names = Object.keys({
    "V1_C3_PARAPHRASE_MANIFEST.json": 1, "PREREGISTRATION.json": 1, "audit-manifest.json": 1,
    "executor-manifest.json": 1, "inherited-parameter-manifest.json": 1, "fixture-manifest.json": 1,
    "binding-manifest.json": 1, "trials.json": 1, "cells.json": 1, "verdict.json": 1
  });
  const artifactHashes: Record<string, HashV1> = {};
  for (const name of names) {
    artifactHashes[name] = await hashEnvelope("characteros-next/research/decision-probe-v1/artifact/v0", {
      name,
      content: await readFile(join(outdir, name), "utf8")
    });
  }
  await write("RUN_MANIFEST.json", {
    artifact_hashes: artifactHashes,
    decision_probe_version: DECISION_PROBE_V1_SCHEMA_VERSION,
    executor,
    r,
    primary_measurement_mode_verdict: primaryVerdict,
    control_diagnostic_verdict: controlVerdict,
    c3_diagnostic_verdict: c3Verdict,
    override_identity_verdict: overrideIdentity.verdict
  });

  process.stdout.write(`\nprimary_measurement_mode_verdict = ${primaryVerdict}\n`);
  process.stdout.write(`control_diagnostic_verdict = ${controlVerdict}\n`);
  process.stdout.write(`c3_diagnostic_verdict = ${c3Verdict}\n`);
  process.stdout.write(`override_identity = ${overrideIdentity.verdict}\n`);
  process.stdout.write(`artifacts written to ${outdir}\n`);
}

await main();
