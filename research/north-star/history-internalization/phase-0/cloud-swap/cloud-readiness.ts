/**
 * SWAPPED-CONDITION PROVIDER READINESS — runnable gate.
 *
 *   npx tsx phase-0/cloud-swap/cloud-readiness.ts <outdir>
 *
 * Exactly the frozen schedule, then STOP:
 *   1 identity request, then 3 planned probes. All planned work runs regardless of intermediate
 *   outcomes, and no probe is retried. Nothing is scored scientifically and no Phase-0 turn executes.
 *
 * The credential is read from the environment ONLY (`MODEL_API_KEY`). It never reaches an artifact, a
 * log line, an error message or a request record: every string that can be written is passed through
 * `redactCsV0`, and the artifact records a presence flag and a fingerprint instead of the value.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  CS_BASE_URL_DEFAULT,
  CS_CREDENTIAL_ENV,
  CS_MODEL_DEFAULT,
  CS_READINESS_COMPLETIONS_PATH,
  CS_READINESS_MODELS_PATH,
  credentialFingerprintV0,
  redactCsV0,
  resolveCloudExecutorConfigV0,
  type CsExecutorConfigV0
} from "./contract-cloud-v0.ts";
import {
  CS_READINESS_NOT_EVALUABLE,
  CS_READINESS_PROBES,
  CS_READINESS_TIMEOUT_MS,
  CS_READINESS_CAPACITY_REQUIREMENT,
  CS_READINESS_EXECUTION_RULE,
  CS_READINESS_FAIL_TOKENS,
  CS_READINESS_PASS_TOKENS,
  auditProbeRequestIsNonTargetV0,
  buildCsReadinessRequestBodyV0,
  evaluateCsReadinessV0,
  hashCsReadinessArtifact,
  hashCsReadinessRequestBodyV0
} from "./cloud-readiness-contract.ts";
import { declareCloudExecutorV0 } from "./cloud-bundle.ts";

type CsProbeStatusV0 = "COMPLETED" | "MODEL_TIMEOUT" | "TRANSPORT_FAILURE" | "PROVIDER_ERROR";

interface CsProbeResultV0 {
  readonly attempt_id: string;
  readonly scientific: false;
  readonly replicate_ordinal: number;
  readonly request_hash: string;
  readonly model_configured: string;
  readonly provider_reported_model: string | null;
  readonly started_at: string;
  readonly ended_at: string;
  readonly latency_ms: number;
  readonly http_status: number | null;
  readonly completion_tokens: number | null;
  readonly prompt_tokens: number | null;
  readonly finish_reason: string | null;
  readonly status: CsProbeStatusV0;
  readonly error: string | null;
  readonly timeout_ms: number;
}

function classifyProbeFailure(error: unknown): { status: CsProbeStatusV0; detail: string } {
  const message = error instanceof Error ? error.message : String(error);
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
    return { status: "MODEL_TIMEOUT", detail: `probe timed out after ${CS_READINESS_TIMEOUT_MS}ms` };
  }
  return { status: "TRANSPORT_FAILURE", detail: message };
}

async function runProbeV0(
  config: CsExecutorConfigV0,
  body: ReturnType<typeof buildCsReadinessRequestBodyV0>,
  ordinal: number
): Promise<CsProbeResultV0> {
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  const requestHash = hashCsReadinessRequestBodyV0(body);
  let status: CsProbeStatusV0 = "COMPLETED";
  let error: string | null = null;
  let httpStatus: number | null = null;
  let completionTokens: number | null = null;
  let promptTokens: number | null = null;
  let finishReason: string | null = null;
  let providerReportedModel: string | null = null;

  try {
    const response = await fetch(`${config.base_url}${CS_READINESS_COMPLETIONS_PATH}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        // The credential is used, never echoed into any recorded field.
        ...(config.api_key === null ? {} : { authorization: `Bearer ${config.api_key}` })
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(CS_READINESS_TIMEOUT_MS)
    });
    httpStatus = response.status;
    if (!response.ok) {
      status = "PROVIDER_ERROR";
      const text = await response.text().catch(() => "");
      error = redactCsV0(`HTTP ${response.status}: ${text.slice(0, 400)}`);
    } else {
      const parsed = (await response.json()) as {
        model?: unknown;
        choices?: readonly { finish_reason?: unknown; message?: { content?: unknown } }[];
        usage?: { completion_tokens?: unknown; prompt_tokens?: unknown };
      };
      providerReportedModel = typeof parsed.model === "string" ? parsed.model : null;
      const first = parsed.choices?.[0];
      finishReason = typeof first?.finish_reason === "string" ? first.finish_reason : null;
      completionTokens = typeof parsed.usage?.completion_tokens === "number" ? parsed.usage.completion_tokens : null;
      promptTokens = typeof parsed.usage?.prompt_tokens === "number" ? parsed.usage.prompt_tokens : null;
      const content = first?.message?.content;
      if (typeof content !== "string" || content.length === 0) {
        status = "PROVIDER_ERROR";
        error = "response carried no non-empty message.content";
      }
    }
  } catch (thrown) {
    const classified = classifyProbeFailure(thrown);
    status = classified.status;
    error = redactCsV0(classified.detail);
  }

  return {
    attempt_id: `cloud-readiness-${String(ordinal).padStart(3, "0")}`,
    scientific: false,
    replicate_ordinal: ordinal,
    request_hash: requestHash,
    model_configured: config.model,
    provider_reported_model: providerReportedModel,
    started_at: startedAt,
    ended_at: new Date().toISOString(),
    latency_ms: Date.now() - startedMs,
    http_status: httpStatus,
    completion_tokens: completionTokens,
    prompt_tokens: promptTokens,
    finish_reason: finishReason,
    status,
    error,
    timeout_ms: CS_READINESS_TIMEOUT_MS
  };
}

interface CsIdentityResultV0 {
  readonly path: string;
  readonly http_status: number | null;
  readonly credential_accepted: boolean;
  readonly served_model_ids_count: number | null;
  readonly configured_model_listed: boolean | null;
  readonly error: string | null;
}

async function resolveIdentityV0(config: CsExecutorConfigV0): Promise<CsIdentityResultV0> {
  const path = CS_READINESS_MODELS_PATH;
  try {
    const response = await fetch(`${config.base_url}${path}`, {
      method: "GET",
      headers: {
        ...(config.api_key === null ? {} : { authorization: `Bearer ${config.api_key}` })
      },
      signal: AbortSignal.timeout(30_000)
    });
    if (!response.ok) {
      return {
        path,
        http_status: response.status,
        credential_accepted: response.status !== 401 && response.status !== 403,
        served_model_ids_count: null,
        configured_model_listed: null,
        error: redactCsV0(`HTTP ${response.status}`)
      };
    }
    const parsed = (await response.json()) as { data?: readonly { id?: unknown }[] };
    const ids = Array.isArray(parsed.data)
      ? parsed.data.map((entry) => (typeof entry?.id === "string" ? entry.id : null)).filter((id): id is string => id !== null)
      : [];
    return {
      path,
      http_status: response.status,
      credential_accepted: true,
      served_model_ids_count: ids.length,
      configured_model_listed: ids.includes(config.model),
      error: null
    };
  } catch (thrown) {
    return {
      path,
      http_status: null,
      credential_accepted: false,
      served_model_ids_count: null,
      configured_model_listed: null,
      error: redactCsV0(thrown instanceof Error ? thrown.message : String(thrown))
    };
  }
}

async function main(): Promise<void> {
  const outdir = process.argv[2];
  if (outdir === undefined) throw new Error("CS_READINESS_USAGE: usage: cloud-readiness.ts <outdir>");
  mkdirSync(outdir, { recursive: true });

  const write = async (name: string, value: unknown): Promise<string> => {
    // ONE write path for every artifact, so redaction cannot be forgotten on a new one.
    // The single exception is noted below for the flag-only identity record.
    const content = `${JSON.stringify(value, null, 2)}\n`;
    writeFileSync(join(outdir, name), content, "utf8");
    return hashCsReadinessArtifact(content, name);
  };

  // ---- pre-call law: the probe must be non-target -------------------------------------------------
  const probeAudit = auditProbeRequestIsNonTargetV0();
  if (!probeAudit.ok) {
    await write("CLOUD_READINESS_ABORT.json", {
      artifact: "CLOUD_READINESS_ABORT",
      reason: "PROBE_REQUEST_IS_NOT_NON_TARGET",
      violations: probeAudit.violations,
      provider_attempts: 0
    });
    console.log("STOP — the probe request violates the frozen non-target law; no provider call was made.");
    console.log(`  violations: ${probeAudit.violations.join(", ")}`);
    process.exitCode = 1;
    return;
  }

  const apiKey = process.env[CS_CREDENTIAL_ENV] ?? null;
  let config: CsExecutorConfigV0;
  try {
    config = resolveCloudExecutorConfigV0({
      base_url: process.env["CS_BASE_URL"] ?? CS_BASE_URL_DEFAULT,
      model: process.env["CS_MODEL"] ?? CS_MODEL_DEFAULT,
      api_key: apiKey
    });
  } catch (thrown) {
    // Fail closed: an absent credential is a STOP, never a downgrade to the local executor.
    await write("CLOUD_READINESS_VERDICT.json", {
      artifact: "CLOUD_READINESS_VERDICT",
      outcome: "FAIL",
      tokens: CS_READINESS_FAIL_TOKENS,
      reason: redactCsV0(thrown instanceof Error ? thrown.message : String(thrown)),
      provider_attempts: 0,
      probes_planned: CS_READINESS_PROBES,
      probes_executed: 0,
      credential_present: apiKey !== null,
      credential_value_recorded: false
    });
    console.log("STOP — the swapped executor configuration could not be resolved; no provider call was made.");
    console.log(`  ${redactCsV0(thrown instanceof Error ? thrown.message : String(thrown))}`);
    process.exitCode = 1;
    return;
  }

  const declaration = declareCloudExecutorV0(config);
  const credentialFingerprint = await credentialFingerprintV0(config.api_key as string);
  await write("CLOUD_EXECUTOR_DECLARATION.json", {
    artifact: "CLOUD_EXECUTOR_DECLARATION",
    operator_decision: "OPTION_2_REPLACE_THE_EXECUTOR_AS_INFRASTRUCTURE",
    declaration,
    credential_fingerprint: credentialFingerprint,
    credential_value_recorded: false,
    packages_modified: false
  });
  await write("CLOUD_READINESS_CAPACITY_REQUIREMENT.json", CS_READINESS_CAPACITY_REQUIREMENT);
  await write("CLOUD_READINESS_EXECUTION_RULE.json", CS_READINESS_EXECUTION_RULE);
  await write("CLOUD_READINESS_PROBE_REQUEST.json", {
    artifact: "CLOUD_READINESS_PROBE_REQUEST",
    non_target_audit: probeAudit,
    system_prompt_bytes: buildCsReadinessRequestBodyV0(config.model).messages[0]?.content.length ?? 0,
    user_prompt_bytes: buildCsReadinessRequestBodyV0(config.model).messages[1]?.content.length ?? 0,
    request_hash: hashCsReadinessRequestBodyV0(buildCsReadinessRequestBodyV0(config.model))
  });

  console.log(`swapped executor: ${declaration.provider} / ${declaration.model} @ ${declaration.base_url}`);
  console.log(`  schema enforcement: ${declaration.schema_enforcement_mode}`);
  console.log(`  credential: present (fingerprint ${credentialFingerprint}); value never recorded`);

  // ---- §4 identity, then the planned probes -------------------------------------------------------
  const identity = await resolveIdentityV0(config);
  await write("CLOUD_READINESS_IDENTITY.json", {
    artifact: "CLOUD_READINESS_IDENTITY",
    ...identity,
    is_an_identity_proof: false,
    stated_weakness:
      "a provider-reported model id is strictly weaker than a content digest: it cannot detect a silent revision change behind a stable id"
  });

  const body = buildCsReadinessRequestBodyV0(config.model);
  const probes: CsProbeResultV0[] = [];
  for (let ordinal = 1; ordinal <= CS_READINESS_PROBES; ordinal += 1) {
    const probe = await runProbeV0(config, body, ordinal);
    probes.push(probe);
    await write(`cloud-readiness-attempt-${String(ordinal).padStart(3, "0")}.json`, probe);
    console.log(
      `  probe ${ordinal}: ${probe.status} http=${probe.http_status ?? "none"} ${probe.latency_ms}ms tokens=${probe.completion_tokens ?? "n/a"} finish=${probe.finish_reason ?? "n/a"} provider_model=${probe.provider_reported_model ?? "n/a"}`
    );
  }

  // ---- criteria (pure function; exercised offline on constructed input) -----------------------------
  const evaluation = evaluateCsReadinessV0({
    probes: probes.map((probe) => ({
      request_hash: probe.request_hash,
      status: probe.status,
      latency_ms: probe.latency_ms,
      provider_reported_model: probe.provider_reported_model
    })),
    identity: {
      http_status: identity.http_status,
      credential_accepted: identity.credential_accepted,
      configured_model_listed: identity.configured_model_listed
    }
  });
  const criteria = evaluation.criteria;
  const pass = evaluation.pass;

  const verdict = {
    artifact: "CLOUD_READINESS_VERDICT",
    outcome: pass ? "PASS" : "FAIL",
    tokens: pass ? CS_READINESS_PASS_TOKENS : CS_READINESS_FAIL_TOKENS,
    identity: {
      provider: declaration.provider,
      api_style: declaration.api_style,
      base_url: declaration.base_url,
      model_configured: declaration.model,
      credential_present: true,
      credential_fingerprint: credentialFingerprint,
      credential_value_recorded: false,
      fallback_configured: false,
      identity_path: identity.path,
      identity_http_status: identity.http_status,
      served_model_ids_count: identity.served_model_ids_count,
      configured_model_listed: identity.configured_model_listed
    },
    probes_planned: CS_READINESS_PROBES,
    probes_executed: probes.length,
    planned_equals_actual: probes.length === CS_READINESS_PROBES,
    criteria,
    criteria_actually_gating_the_verdict: [
      "credential_present_and_accepted",
      "configured_model_is_served_by_the_endpoint",
      "all_probes_completed_normally",
      "all_probes_completed_within_the_frozen_timeout",
      "all_probes_used_the_same_frozen_request_hash",
      "provider_reported_model_identical_across_all_probes"
    ],
    criteria_NOT_EVALUABLE_ON_A_REMOTE_PROVIDER: CS_READINESS_NOT_EVALUABLE,
    descriptive_metrics_not_gating: {
      latencies_ms: probes.map((probe) => probe.latency_ms),
      completion_tokens: probes.map((probe) => probe.completion_tokens),
      prompt_tokens: probes.map((probe) => probe.prompt_tokens),
      finish_reasons: probes.map((probe) => probe.finish_reason),
      provider_reported_models: probes.map((probe) => probe.provider_reported_model)
    },
    what_a_pass_means: CS_READINESS_CAPACITY_REQUIREMENT.stated_limitation,
    what_a_pass_does_not_authorise: [
      "the scientific run (contract qualification must pass first)",
      "HISTORY_INTERNALIZATION_PHASE_1",
      "any claim that the swapped executor satisfies the production cognition contract",
      "any claim that the remote model revision is unchanged"
    ],
    next_step_if_pass:
      "PHASE0_CONTRACT_QUALIFICATION_AUTHORISED — the N=6 state-blind qualification on the production cognition path (a separate, separately-authorised gate)",
    next_step_if_fail: "PHASE0_CLOUD_SWAP_REMAINS_BLOCKED_BY_PROVIDER — the scientific run is NOT attempted"
  };
  await write("CLOUD_READINESS_VERDICT.json", verdict);

  console.log("");
  console.log(`CLOUD READINESS: ${verdict.outcome}  ${verdict.tokens.join(" ")}`);
  console.log(`  probes ${probes.length}/${CS_READINESS_PROBES} executed, planned==actual: ${verdict.planned_equals_actual}`);
  console.log(`  criteria not evaluable remotely: ${CS_READINESS_NOT_EVALUABLE.map((row) => row.criterion).join(", ")}`);
  console.log("STOP — no qualification, no scientific run, no retry.");
  if (!pass) process.exitCode = 1;
}

await main();
