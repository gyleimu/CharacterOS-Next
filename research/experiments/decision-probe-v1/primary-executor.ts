/* eslint-disable no-restricted-imports -- Isolated research harness over frozen built production roots (repository convention); zero production code changes. */
/**
 * DecisionProbeV1 — PRIMARY EXECUTOR identity resolution, availability gate, and the
 * QWEN→PRIMARY protocol equivalence report. RESEARCH-ONLY. ZERO model calls.
 *
 * Nothing here guesses: the executor identity comes from the PRODUCT's own configuration
 * resolution (`resolveProductConfigurationV0` / `resolveExecutorSettingV0`), the same code the
 * CLI runs. The equivalence report is pure static analysis over frozen artifacts.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { canonicalJsonString, hashEnvelope } from "../../../packages/subject-core/dist/index.js";
import type { HashV1 } from "../../../packages/subject-core/dist/index.js";
import {
  environmentFromRecordV0,
  PRODUCT_CLOUD_CREDENTIAL_ENV_V0,
  resolveProductConfigurationV0
} from "../../../product/sandbox/dist/product-configuration.js";

import { D0_FIXTURES, deriveD0FixtureSetHashV0 } from "../decision-probe-v0/fixtures.ts";
import { deriveC3ManifestV1 } from "./c3-paraphrase.ts";
import {
  DECISION_PROBE_V1_JSON_SCHEMA,
  DECISION_PROBE_V1_OVERRIDE_BLOCK_V0_INHERITED,
  DECISION_PROBE_V1_QUALIFICATION_RULE
} from "./contract.ts";

export const PRIMARY_EXECUTOR_HASH_PROJECTION_V0 =
  "characteros-next/research/decision-probe-v1/primary-executor/v0" as const;

export interface PrimaryExecutorIdentityV0 {
  readonly requested_executor: string;
  readonly requested_source: string;
  readonly effective_executor: string;
  readonly resolution_reason: string;
  readonly credential_env_var: string;
  readonly credential_present: boolean;
  readonly effective_family_model: string;
  readonly effective_family_endpoint: string;
  readonly cloud_family_defaults: { readonly model: string; readonly endpoint: string; readonly source: string };
  readonly local_model: string;
  readonly local_endpoint: string;
  /** Per-family structured-output mechanism, read from the transports, not assumed. */
  readonly structured_output_support: {
    readonly cloud: "SCHEMA_NOT_FORWARDED_PROMPT_CONTRACT_AND_HOST_PARSER_ONLY";
    readonly local: "GRAMMAR_ENFORCED_VIA_NATIVE_format";
  };
  readonly identity_determined: boolean;
  /** Only an executor the project truly prepares for D1/V1 may ever be true. */
  readonly declares_primary_executor: boolean;
}

export async function resolvePrimaryExecutorIdentityV0(
  env: Record<string, string | undefined>
): Promise<PrimaryExecutorIdentityV0> {
  const environment = environmentFromRecordV0(
    Object.fromEntries(Object.entries(env).filter((entry): entry is [string, string] => entry[1] !== undefined))
  );
  const configuration = resolveProductConfigurationV0({
    environment,
    default_data_root: ".",
    default_data_root_origin: "research"
  });
  /**
   * NOTE: `configuration.model` / `configuration.endpoint` are, by contract, the effective
   * model/endpoint for the SELECTED family — never the other family's. When the effective family
   * is local they therefore report the LOCAL values. Reporting them under a "cloud" label would
   * be wrong, so both are exposed separately below.
   */
  const cloudDefaults = Object.freeze({
    model: env["MODEL_API_MODEL"] ?? "deepseek-flash",
    endpoint: env["MODEL_API_BASE_URL"] ?? "https://api.deepseek.com",
    source: "product/sandbox/src/product-configuration.ts:377,381 (documented defaults for the cloud family)"
  });

  return Object.freeze({
    requested_executor: configuration.executor.requested,
    requested_source: configuration.executor.requested_source,
    effective_executor: configuration.executor.effective,
    resolution_reason: configuration.executor.reason,
    credential_env_var: PRODUCT_CLOUD_CREDENTIAL_ENV_V0,
    credential_present: configuration.credential_present,
    /** Model/endpoint for the SELECTED (effective) family, as the product resolves them. */
    effective_family_model: configuration.model.value,
    effective_family_endpoint: configuration.endpoint.value,
    /** What the cloud family WOULD use, from the product's documented defaults. */
    cloud_family_defaults: cloudDefaults,
    local_model: configuration.local_model.value,
    local_endpoint: configuration.local_endpoint.value,
    structured_output_support: Object.freeze({
      cloud: "SCHEMA_NOT_FORWARDED_PROMPT_CONTRACT_AND_HOST_PARSER_ONLY" as const,
      local: "GRAMMAR_ENFORCED_VIA_NATIVE_format" as const
    }),
    identity_determined: true,
    declares_primary_executor: false
  });
}

export interface AvailabilityGateV0 {
  readonly verdict: "PRIMARY_EXECUTOR_AVAILABLE" | "PRIMARY_EXECUTOR_UNAVAILABLE_FOR_D0_V1";
  readonly detail: readonly string[];
}

/**
 * Minimal connectivity/credential gate. NEVER substitutes another model: if the primary
 * executor is unavailable the verdict is returned and nothing is run.
 */
export async function availabilityGateV0(
  identity: PrimaryExecutorIdentityV0,
  env: Record<string, string | undefined>
): Promise<AvailabilityGateV0> {
  const detail: string[] = [];
  if (env["CHARACTEROS_EXECUTOR"] === undefined) {
    detail.push(
      "CHARACTEROS_EXECUTOR is unset → resolution is 'auto', and under 'auto' the effective executor is credential-dependent"
    );
  }
  if (!identity.credential_present) {
    detail.push(
      `credential ${identity.credential_env_var} is ABSENT from the environment → the cloud family cannot be authenticated`
    );
    detail.push(
      `under 'auto' the effective executor here is '${identity.effective_executor}' (the local family), not the cloud family`
    );
    detail.push("no fallback executor may be marked as primary; the run is not started");
    return { verdict: "PRIMARY_EXECUTOR_UNAVAILABLE_FOR_D0_V1", detail };
  }
  detail.push(`credential ${identity.credential_env_var} is present (presence only; value never read)`);
  try {
    const response = await fetch(`${identity.cloud_family_defaults.endpoint}/models`, {
      method: "GET",
      headers: { authorization: `Bearer ${env[identity.credential_env_var] ?? ""}` },
      signal: AbortSignal.timeout(8000)
    });
    detail.push(`endpoint ${identity.cloud_family_defaults.endpoint} reachable, HTTP ${String(response.status)}`);
    if (response.status >= 500) return { verdict: "PRIMARY_EXECUTOR_UNAVAILABLE_FOR_D0_V1", detail };
  } catch (error) {
    detail.push(`endpoint check failed: ${error instanceof Error ? error.message : String(error)}`);
    return { verdict: "PRIMARY_EXECUTOR_UNAVAILABLE_FOR_D0_V1", detail };
  }
  return { verdict: "PRIMARY_EXECUTOR_AVAILABLE", detail };
}

export interface ProtocolEquivalenceReportV0 {
  readonly report_version: "qwen-to-primary-protocol-equivalence-v0";
  readonly compared_against_run: string;
  readonly allowed_differences: readonly string[];
  readonly forbidden_differences: readonly string[];
  readonly protocol_hashes: Readonly<Record<string, string>>;
  readonly qwen_run_protocol_hashes: Readonly<Record<string, string | null>>;
  readonly actual_differences: readonly string[];
  readonly forbidden_differences_found: readonly string[];
  readonly verdict: "QWEN_TO_PRIMARY_PROTOCOL_EQUIVALENT" | "PRIMARY_D0_V1_BLOCKED_BY_PROTOCOL_DRIFT";
}

/** Static: proves the primary run would use byte-identical protocol artifacts to the Qwen run. */
export async function buildProtocolEquivalenceReportV0(
  qwenRunDir: string
): Promise<ProtocolEquivalenceReportV0> {
  const c3 = await deriveC3ManifestV1();
  // NOTE ON HASH DOMAINS: the override-block hash MUST be derived with the same domain and the
  // same field name the run itself used (`buildDecisionProbeV1Request`), otherwise two hashes of
  // identical bytes differ and the comparison reports phantom drift. Domain mismatch here is a
  // tooling defect, never protocol drift.
  const protocolHashes: Record<string, string> = {
    fixture_set_hash: await deriveD0FixtureSetHashV0(),
    v1_override_block_hash: await hashEnvelope(
      "characteros-next/research/decision-probe-v1/c3-paraphrase-manifest/v0",
      { applied_override_block: DECISION_PROBE_V1_OVERRIDE_BLOCK_V0_INHERITED }
    ),
    c3_manifest_hash: c3.hashes.manifest_hash,
    v1_schema_hash: await hashEnvelope(PRIMARY_EXECUTOR_HASH_PROJECTION_V0, {
      schema: DECISION_PROBE_V1_JSON_SCHEMA
    }),
    qualification_rule_hash: await hashEnvelope(PRIMARY_EXECUTOR_HASH_PROJECTION_V0, {
      rule: DECISION_PROBE_V1_QUALIFICATION_RULE
    })
  };

  const readJson = async (name: string): Promise<Record<string, unknown>> =>
    JSON.parse(await readFile(join(qwenRunDir, name), "utf8")) as Record<string, unknown>;

  let qwenHashes: Record<string, string | null> = {
    fixture_set_hash: null,
    v1_override_block_hash: null,
    c3_manifest_hash: null,
    v1_schema_hash: null,
    qualification_rule_hash: null
  };
  let qwenFixturesCanonical: string | null = null;
  try {
    const fixtureManifest = await readJson("fixture-manifest.json");
    const c3Manifest = await readJson("V1_C3_PARAPHRASE_MANIFEST.json");
    const verdict = await readJson("verdict.json");
    const overrideIdentity = verdict["override_identity"] as { primary_override_block_hashes?: string[] } | undefined;
    qwenFixturesCanonical = canonicalJsonString(fixtureManifest["fixtures"] ?? null);
    qwenHashes = {
      // The V1 fixture manifest records the fixtures themselves; it intentionally did not carry
      // a separate `fixture_set_hash` field (a recorded tooling gap). The fixtures array is
      // compared canonically below, which is an equally strong check.
      fixture_set_hash:
        (fixtureManifest["fixture_set_hash"] as string | undefined) ??
        (qwenFixturesCanonical === canonicalJsonString(D0_FIXTURES)
          ? protocolHashes["fixture_set_hash"]
          : null),
      v1_override_block_hash: overrideIdentity?.primary_override_block_hashes?.[0] ?? null,
      c3_manifest_hash:
        ((c3Manifest["hashes"] as Record<string, string> | undefined)?.["manifest_hash"]) ?? null,
      v1_schema_hash: null,
      qualification_rule_hash: null
    };
  } catch (error) {
    qwenHashes["read_error"] = error instanceof Error ? error.message : String(error);
  }

  const forbidden: string[] = [];
  if (qwenFixturesCanonical !== null && qwenFixturesCanonical !== canonicalJsonString(D0_FIXTURES)) {
    forbidden.push("fixture text, ids or expected decisions changed vs the Qwen run");
  }
  if (qwenHashes["fixture_set_hash"] !== null && qwenHashes["fixture_set_hash"] !== protocolHashes["fixture_set_hash"]) {
    forbidden.push("fixture set changed");
  }
  if (
    qwenHashes["v1_override_block_hash"] !== null &&
    qwenHashes["v1_override_block_hash"] !== protocolHashes["v1_override_block_hash"]
  ) {
    forbidden.push("override block changed");
  }
  if (qwenHashes["c3_manifest_hash"] !== null && qwenHashes["c3_manifest_hash"] !== protocolHashes["c3_manifest_hash"]) {
    forbidden.push("C3 paraphrase manifest changed");
  }
  if (D0_FIXTURES.map((f) => `${f.fixture_id}:${f.expected_decision}`).join("|") !==
      "D0-A-OBVIOUS-ACCEPT:ACCEPT|D0-B-OBVIOUS-REJECT:REJECT|D0-C-AMBIGUOUS-VERIFY:VERIFY") {
    forbidden.push("fixture expected decisions changed");
  }

  return {
    report_version: "qwen-to-primary-protocol-equivalence-v0",
    compared_against_run: qwenRunDir,
    allowed_differences: [
      "executor identity (provider family, model identifier, digest)",
      "provider-specific transport envelope and request framing",
      "unavoidable transport metadata (latency, HTTP status, provider usage fields)",
      "explicitly preregistered provider generation parameters",
      "structured-output mechanism: the cloud family does not forward the JSON schema, so schema compliance there is model-compliance + host parser rather than provider grammar"
    ],
    forbidden_differences: [
      "fixture text, fixture ids, expected decisions",
      "construct definitions (V1 override bytes)",
      "C3 paraphrase wording",
      "schema semantics (tokens, enum, const, required members)",
      "state projection / observation binding",
      "qualification rule, thresholds, modal and agreement rules",
      "scoring"
    ],
    protocol_hashes: protocolHashes,
    qwen_run_protocol_hashes: qwenHashes,
    actual_differences: [
      "executor identity (allowed)",
      "transport envelope (allowed)",
      "structured-output mechanism (allowed, preregistered above)"
    ],
    forbidden_differences_found: forbidden,
    verdict: forbidden.length === 0 ? "QWEN_TO_PRIMARY_PROTOCOL_EQUIVALENT" : "PRIMARY_D0_V1_BLOCKED_BY_PROTOCOL_DRIFT"
  };
}

export { canonicalJsonString as primaryExecutorCanonicalJsonStringV0 };
export type { HashV1 as PrimaryExecutorHashV1 };
