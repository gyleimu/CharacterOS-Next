/* eslint-disable no-restricted-imports -- Isolated research harness over frozen built production roots (repository convention); zero production code changes. */
/**
 * DecisionProbeV2 — D0-V2 qualification driver (cloud / primary executor). RESEARCH-ONLY.
 *
 *   CHARACTEROS_DECISION_PROBE_EXECUTOR=openai node research/experiments/decision-probe-v2/qualify-v2.ts <outdir>
 *
 * Order (the order IS the preregistration):
 *   0. LOCAL_EXECUTOR_V2_DEFERRED.json   — written BEFORE any call (human deferred local models)
 *   1. PREREGISTRATION.json + preflight  — identity, credential presence, contract hashes
 *   2. TRANSPORT_EQUIVALENCE_GATE        — mechanical, offline
 *   3. PRIMARY     9 calls
 *   4. C3          9 calls   (qualification requirement in V2)
 *   5. FORMAT_ONLY 9 calls   (diagnostic, no veto)
 *   6. TOKEN_REMAP 9 calls   (diagnostic, no veto)
 *
 * No retry, no repair, no re-prompt, no run-time replicate change, no cherry-picking.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { hashEnvelope } from "../../../packages/subject-core/dist/index.js";
import type { HashV1 } from "../../../packages/subject-core/dist/index.js";
import { OpenAiCompatibleTransportV0 } from "../../../packages/runtime/dist/transports/model-transport.js";
import type { ModelTransportV0 } from "../../../packages/runtime/dist/transports/model-transport.js";
import {
  environmentFromRecordV0,
  PRODUCT_CLOUD_CREDENTIAL_ENV_V0,
  resolveProductConfigurationV0
} from "../../../product/sandbox/dist/product-configuration.js";

import { captureProductionRequestForFixtureV0 } from "../decision-probe-v0/binding.ts";
import { DECISION_PROBE_DECISIONS } from "../decision-probe-v0/contract.ts";
import { D0_FIXTURES, D0_PROTOCOL_V0 } from "../decision-probe-v0/fixtures.ts";
import { C3_OVERRIDE_BLOCK, deriveC3ManifestV1 } from "../decision-probe-v1/c3-paraphrase.ts";
import { auditTransportEquivalenceV0, runV2AuditsV0 } from "./audits.ts";
import {
  DECISION_PROBE_V2_PROTOCOL_VERSION,
  V2_FORMAT_ONLY_CONTRACT,
  V2_PRIMARY_SEMANTIC_CONTRACT,
  V2_TOKEN_REMAP_CONTRACT,
  deriveV2ProtocolHashesV0
} from "./contract.ts";
import { buildV2Request, runV2Trial, schemaForPhase, type V2Phase, type V2TrialV0 } from "./probe-v2.ts";

const GENERATION = Object.freeze({
  temperature: 0,
  max_output_tokens: 256,
  provider_thinking: "disabled"
});

type Cell = {
  phase: string;
  fixture_id: string;
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

function summarize(trials: readonly V2TrialV0[], phase: V2Phase): Cell[] {
  return D0_FIXTURES.map((fixture) => {
    const rows = trials.filter((t) => t.phase === phase && t.fixture_id === fixture.fixture_id);
    const counts: Record<string, number> = { ACCEPT: 0, VERIFY: 0, REJECT: 0 };
    let rejected = 0;
    let failed = 0;
    for (const row of rows) {
      if (row.outcome === "DECIDED" && row.construct !== null) counts[row.construct] = (counts[row.construct] ?? 0) + 1;
      else if (row.outcome === "REJECTED") rejected += 1;
      else failed += 1;
    }
    const valid = rows.length - rejected - failed;
    const top = DECISION_PROBE_DECISIONS.map((t) => [t, counts[t] ?? 0] as const).sort((a, b) => b[1] - a[1])[0] ?? ["", 0];
    const modal = valid > 0 && top[1] > 0 ? top[0] : null;
    const agreement = valid > 0 ? top[1] / valid : 0;
    return {
      phase,
      fixture_id: fixture.fixture_id,
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

async function main(): Promise<void> {
  const outdir = process.argv[2];
  if (outdir === undefined) throw new Error("usage: node qualify-v2.ts <outdir>");
  await mkdir(outdir, { recursive: true });
  const write = async (name: string, value: unknown): Promise<void> => {
    await writeFile(join(outdir, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");
  };

  const env = process.env as Record<string, string | undefined>;

  // ---- PHASE 0: defer record FIRST, before anything else -----------------------------
  await write("LOCAL_EXECUTOR_V2_DEFERRED.json", {
    applies_to: DECISION_PROBE_V2_PROTOCOL_VERSION,
    reason: "HUMAN_REQUESTED_NO_LOCAL_MODEL_RUN",
    qwen_v2_fresh_data_available: false,
    this_is_not_a_failure: true,
    this_does_not_modify_protocol: true,
    cross_transport_replication_status: "PENDING",
    no_qwen_v2_pass_is_claimed: true,
    v1_qwen_data_may_not_be_used_as_v2_replication: true,
    recorded_at_utc: new Date().toISOString(),
    model_calls_before_this_record: 0
  });

  // ---- PHASE 1: preflight ------------------------------------------------------------
  const environment = environmentFromRecordV0(
    Object.fromEntries(Object.entries(env).filter((e): e is [string, string] => e[1] !== undefined))
  );
  const configuration = resolveProductConfigurationV0({
    environment,
    default_data_root: ".",
    default_data_root_origin: "research"
  });
  const protocolHashes = await deriveV2ProtocolHashesV0();
  const c3 = await deriveC3ManifestV1();
  const cloudModel = env["MODEL_API_MODEL"] ?? "deepseek-flash";
  const cloudEndpoint = env["MODEL_API_BASE_URL"] ?? "https://api.deepseek.com";
  const apiKey = env[PRODUCT_CLOUD_CREDENTIAL_ENV_V0];

  const preflight = {
    requested_executor: configuration.executor.requested,
    effective_executor: configuration.executor.effective,
    resolution_reason: configuration.executor.reason,
    credential_env_var: PRODUCT_CLOUD_CREDENTIAL_ENV_V0,
    credential_present: configuration.credential_present,
    credential_value_recorded: false,
    model: cloudModel,
    endpoint: cloudEndpoint,
    generation: GENERATION,
    semantic_contract_hash: protocolHashes.semantic_contract_hash,
    c3_manifest_hash: c3.hashes.manifest_hash,
    c3_all_audits_pass: c3.all_audits_pass,
    local_executor_invoked: false
  };
  await write("preflight.json", preflight);
  if (configuration.executor.effective !== "deepseek" || apiKey === undefined || apiKey.length === 0) {
    await write("verdict.json", { verdict: "PRIMARY_EXECUTOR_UNAVAILABLE_FOR_D0_V2", model_calls_made: 0 });
    process.stdout.write("VERDICT = PRIMARY_EXECUTOR_UNAVAILABLE_FOR_D0_V2\n");
    return;
  }

  const transport = new OpenAiCompatibleTransportV0({
    base_url: cloudEndpoint,
    model: cloudModel,
    api_key: apiKey,
    timeout_ms: 120_000,
    temperature: GENERATION.temperature,
    max_output_tokens: GENERATION.max_output_tokens,
    provider_request_options: { thinking: { type: "disabled" } }
  }) as unknown as ModelTransportV0;

  const executor = {
    family: "openai",
    transport_class: "OpenAiCompatibleTransportV0",
    model: cloudModel,
    endpoint: cloudEndpoint,
    generation: GENERATION,
    structured_enforcement: "PROMPT_CONTRACT_PLUS_HOST_FAIL_CLOSED_PARSER",
    native_schema_transmitted: false,
    declares_primary_executor: true
  };
  await write("executor-manifest.json", executor);
  await write("protocol-hashes.json", {
    protocol_version: DECISION_PROBE_V2_PROTOCOL_VERSION,
    ...protocolHashes,
    c3_manifest_hash: c3.hashes.manifest_hash,
    primary_contract_is_v1_contract_byte_identical:
      V2_PRIMARY_SEMANTIC_CONTRACT === (await import("../decision-probe-v1/contract.ts")).DECISION_PROBE_V1_OVERRIDE_BLOCK_V0_INHERITED
  });
  await write("fixture-manifest.json", { fixtures: D0_FIXTURES, protocol: D0_PROTOCOL_V0 });

  const bound = [];
  for (const fixture of D0_FIXTURES) bound.push(await captureProductionRequestForFixtureV0(fixture));
  await write("binding-manifest.json", bound.map((b) => ({
    fixture_id: b.fixture_id, observation: b.observation, hashes: b.hashes
  })));

  // ---- PHASE 2: transport equivalence gate ------------------------------------------
  const first = bound[0];
  if (first === undefined) throw new Error("no binding");
  const primaryBuilt = await buildV2Request({
    production_request: first.production_request,
    mode: { kind: "SUBSTITUTION_WITH_OVERRIDE", contract: V2_PRIMARY_SEMANTIC_CONTRACT },
    schema: schemaForPhase("PRIMARY")
  });
  const formatOnlyBuilt = await buildV2Request({
    production_request: first.production_request,
    mode: { kind: "SUBSTITUTION_WITH_OVERRIDE", contract: V2_FORMAT_ONLY_CONTRACT },
    schema: schemaForPhase("FORMAT_ONLY")
  });
  const gate = auditTransportEquivalenceV0({
    primary_request: primaryBuilt.request,
    format_only_request: formatOnlyBuilt.request
  });
  const audits = await runV2AuditsV0({ primary_request: primaryBuilt.request, format_only_request: formatOnlyBuilt.request });
  await write("transport-equivalence-report.json", {
    gate,
    all_audits_pass: audits.all_pass,
    audits: audits.results,
    layer_a_carrier: "messages",
    layer_b: {
      native_schema_transmitted: false,
      mechanism: "PROMPT_CONTRACT_PLUS_HOST_FAIL_CLOSED_PARSER"
    },
    cross_transport_output_comparison: "NOT_PERFORMED_LOCAL_EXECUTOR_DEFERRED_BY_HUMAN"
  });
  if (gate.status !== "PASS" || !audits.all_pass) {
    await write("verdict.json", { verdict: "INCONCLUSIVE_TRANSPORT_EQUIVALENCE_FAILED", model_calls_made: 0 });
    process.stdout.write("VERDICT = INCONCLUSIVE_TRANSPORT_EQUIVALENCE_FAILED\n");
    return;
  }

  // ---- PHASES 3-6: the 36 frozen calls ----------------------------------------------
  const phases: readonly { readonly phase: V2Phase; readonly contract: string }[] = [
    { phase: "PRIMARY", contract: V2_PRIMARY_SEMANTIC_CONTRACT },
    { phase: "C3", contract: C3_OVERRIDE_BLOCK },
    { phase: "FORMAT_ONLY", contract: V2_FORMAT_ONLY_CONTRACT },
    { phase: "TOKEN_REMAP", contract: V2_TOKEN_REMAP_CONTRACT }
  ];
  const trials: V2TrialV0[] = [];
  let ordinal = 0;
  for (const spec of phases) {
    for (const fixture of D0_FIXTURES) {
      const b = bound.find((entry) => entry.fixture_id === fixture.fixture_id);
      if (b === undefined) throw new Error(`no binding for ${fixture.fixture_id}`);
      for (let replicate = 1; replicate <= D0_PROTOCOL_V0.r_pilot; replicate += 1) {
        ordinal += 1;
        process.stdout.write(`[${String(ordinal)}] ${spec.phase} ${fixture.fixture_id} r=${String(replicate)}/3 ... `);
        const trial = await runV2Trial({
          transport,
          production_request: b.production_request,
          phase: spec.phase,
          contract: spec.contract,
          fixture_id: fixture.fixture_id,
          replicate_ordinal: replicate
        });
        trials.push(trial);
        process.stdout.write(`${trial.outcome}${trial.construct === null ? "" : ` ${trial.construct}`}\n`);
      }
    }
  }

  const cells = {
    PRIMARY: summarize(trials, "PRIMARY"),
    C3: summarize(trials, "C3"),
    FORMAT_ONLY: summarize(trials, "FORMAT_ONLY"),
    TOKEN_REMAP: summarize(trials, "TOKEN_REMAP")
  };
  const primary = cells.PRIMARY;
  const primaryRejected = primary.reduce((s, c) => s + c.rejected, 0);
  const primaryFailed = primary.reduce((s, c) => s + c.transport_failed, 0);
  const primaryCalls = primary.reduce((s, c) => s + c.valid + c.rejected + c.transport_failed, 0);

  const primaryVerdict =
    primaryFailed > 0 && primary.every((c) => c.valid === 0)
      ? "EXECUTOR_UNQUALIFIED_FOR_DECISION_PROBE"
      : primaryCalls > 0 && primaryRejected / primaryCalls > D0_PROTOCOL_V0.max_schema_rejection_rate
        ? "EXECUTOR_UNQUALIFIED_FOR_DECISION_PROBE"
        : primary.some((c) => c.modal !== null && c.modal !== c.expected)
          ? "DECISION_INSTRUMENT_V2_UNQUALIFIED"
          : primary.some((c) => !c.passes)
            ? "INCONCLUSIVE_BY_DECISION_NOISE"
            : "PRIMARY_MEASUREMENT_PASSED";

  const divergent = (rows: readonly Cell[]): string[] =>
    rows.filter((c) => c.modal !== null && c.modal !== c.expected).map((c) => c.fixture_id);

  const c3Verdict = divergent(cells.C3).length === 0 ? "CONSTRUCT_RESPONSE_PARAPHRASE_STABLE" : "LEXICALLY_SENSITIVE";
  const anchorVerdict =
    cells.FORMAT_ONLY.every((c) => c.valid === 0)
      ? "FORMAT_ONLY_NO_VALID_OUTPUT"
      : divergent(cells.FORMAT_ONLY).length === 0
        ? "CONSTRUCT_ANCHORS_NOT_NECESSARY"
        : "CONSTRUCT_ANCHORS_ARE_NECESSARY";
  const tokenVerdict =
    cells.TOKEN_REMAP.every((c) => c.valid === 0)
      ? "TOKEN_REMAP_NO_VALID_OUTPUT"
      : divergent(cells.TOKEN_REMAP).length === 0
        ? "TOKEN_PRIORS_NOT_LOAD_BEARING"
        : "TOKEN_PRIORS_LOAD_BEARING";

  const qualified = primaryVerdict === "PRIMARY_MEASUREMENT_PASSED" && c3Verdict === "CONSTRUCT_RESPONSE_PARAPHRASE_STABLE";
  const overall = qualified ? "DECISION_INSTRUMENT_V2_QUALIFIED" : primaryVerdict === "PRIMARY_MEASUREMENT_PASSED" ? "DECISION_INSTRUMENT_V2_UNQUALIFIED" : primaryVerdict;

  await write("trials.json", trials);
  await write("cells.json", cells);
  await write("verdict.json", {
    protocol_version: DECISION_PROBE_V2_PROTOCOL_VERSION,
    r: D0_PROTOCOL_V0.r_pilot,
    executor,
    primary_measurement_verdict: primaryVerdict,
    c3_diagnostic_verdict: c3Verdict,
    format_only_diagnostic_verdict: anchorVerdict,
    token_remap_diagnostic_verdict: tokenVerdict,
    diagnostics_veto: false,
    overall_qualification_verdict: overall,
    qualified_executor_label: qualified ? `DECISION_INSTRUMENT_V2_QUALIFIED_ON_${cloudModel.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}` : null,
    cross_transport_replication_status: "PENDING",
    cross_transport_validated: false,
    d1_gate: qualified ? "PRIMARY_EXECUTOR_V2_QUALIFIED" : "D1 LOCKED",
    d1_executed: false
  });

  const artifactNames = ["LOCAL_EXECUTOR_V2_DEFERRED.json", "preflight.json", "executor-manifest.json", "protocol-hashes.json", "fixture-manifest.json", "binding-manifest.json", "transport-equivalence-report.json", "trials.json", "cells.json", "verdict.json"];
  const artifactHashes: Record<string, HashV1> = {};
  for (const name of artifactNames) {
    artifactHashes[name] = await hashEnvelope("characteros-next/research/decision-probe-v2/artifact/v0", {
      name,
      content: await readFile(join(outdir, name), "utf8")
    });
  }
  await write("RUN_MANIFEST.json", {
    artifact_hashes: artifactHashes,
    protocol_version: DECISION_PROBE_V2_PROTOCOL_VERSION,
    semantic_contract_hash: protocolHashes.semantic_contract_hash,
    executor,
    overall_qualification_verdict: overall
  });

  process.stdout.write(`\nprimary_measurement_verdict = ${primaryVerdict}\n`);
  process.stdout.write(`c3_diagnostic_verdict = ${c3Verdict}\n`);
  process.stdout.write(`format_only_diagnostic_verdict = ${anchorVerdict}\n`);
  process.stdout.write(`token_remap_diagnostic_verdict = ${tokenVerdict}\n`);
  process.stdout.write(`overall_qualification_verdict = ${overall}\n`);
  process.stdout.write(`artifacts written to ${outdir}\n`);
}

await main();
