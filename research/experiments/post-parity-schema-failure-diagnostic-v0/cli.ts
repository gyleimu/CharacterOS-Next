/**
 * POST_PARITY_SCHEMA_FAILURE_DIAGNOSTIC — tracked CLI.
 *
 *   diagnostic-preflight   Phase A gate: 0 model calls, 0 network calls
 *   diagnostic-run         Phase B: bounded exploratory calls (40 max, stop at 2 rejections)
 *
 * The credential is read from `MODEL_API_KEY` in the process environment only and
 * is never printed, hashed, stored or written into an artifact.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createDiagnosticTransport, type DiagnosticTransport } from "../executor-schema-failure-diagnostic-v0/diagnostic-transport.ts";

import {
  DIAGNOSTIC_ID,
  DIAGNOSTIC_MARKERS,
  DIAGNOSTIC_NAMESPACE,
  DIAGNOSTIC_STOP_RULE,
  FAILURE_TAXONOMY_DECLARED_BEFORE_CALLS,
  MAX_CALLS,
  POST_PARITY_AUTHORITY,
  TARGET_SCHEMA_INVALID_EXAMPLES
} from "./contract.ts";
import { hashJson } from "./hash.ts";
import { assertPostParityRequest, buildPostParityRequest, runPostParityDiagnostic, type DiagnosticRunResult } from "./runner.ts";

export const MODEL_API_KEY_ENV = "MODEL_API_KEY" as const;

export interface DiagnosticCliDeps {
  readonly apiKey: string | undefined;
  readonly fetchImpl?: typeof fetch | undefined;
  readonly transportFactory?: ((apiKey: string) => DiagnosticTransport) | undefined;
  readonly writeArtifact?: ((path: string, text: string) => void) | undefined;
  /** Test seam: may only LOWER the frozen budget, never raise it. */
  readonly maxCalls?: number | undefined;
}

export interface DiagnosticPreflightReport {
  readonly schema_version: "post-parity-schema-failure-diagnostic-preflight-v0";
  readonly diagnostic_id: typeof DIAGNOSTIC_ID;
  readonly namespace: typeof DIAGNOSTIC_NAMESPACE;
  readonly markers: typeof DIAGNOSTIC_MARKERS;
  readonly verdict: "DIAGNOSTIC_PREFLIGHT_PASS" | "DIAGNOSTIC_PREFLIGHT_STOP";
  readonly failures: readonly string[];
  readonly steps: readonly { readonly step: number; readonly id: string; readonly ok: boolean; readonly detail: unknown }[];
  readonly stop_rule: typeof DIAGNOSTIC_STOP_RULE;
  readonly taxonomy_vocabulary: readonly string[];
  readonly authority_reference: typeof POST_PARITY_AUTHORITY;
  readonly model_calls: 0;
  readonly network_calls: 0;
  readonly transport_constructed: false;
  readonly api_key_source: typeof MODEL_API_KEY_ENV;
  readonly api_key_present: boolean;
}

/** Phase A gate: the whole instrumentation path with ZERO calls. */
export async function diagnosticPreflight(deps: DiagnosticCliDeps): Promise<DiagnosticPreflightReport> {
  const steps: DiagnosticPreflightReport["steps"][number][] = [];
  const record = (step: number, id: string, ok: boolean, detail: unknown): void => {
    steps.push({ step, id, ok, detail });
  };
  const failures: string[] = [];

  const binding = await buildPostParityRequest();
  const byteIdentical = binding.byte_identical_to_post_parity_calibration;
  record(1, "POST_PARITY_REQUEST_BYTE_IDENTITY", byteIdentical, {
    request_hash: binding.request_hash,
    expected_request_hash: POST_PARITY_AUTHORITY.request_hash,
    body_bytes: binding.body_bytes,
    expected_bytes: POST_PARITY_AUTHORITY.request_bytes,
    reconstructed_hashes: binding.reconstructed_hashes,
    divergences: binding.divergences
  });
  if (!byteIdentical) failures.push("POST_PARITY_REQUEST_BINDING_MISMATCH");

  try {
    assertPostParityRequest(binding);
    record(2, "FAIL_CLOSED_REQUEST_ASSERTION", true, "assertion accepted the post-parity bytes");
  } catch (error) {
    record(2, "FAIL_CLOSED_REQUEST_ASSERTION", false, error instanceof Error ? error.message : String(error));
    failures.push("POST_PARITY_REQUEST_ASSERTION_FAILED");
  }

  const prompt = binding.serialized_body;
  const noDiagnosticHints = !/few-shot|few shot|stay below|debug hint|repair instruction/i.test(prompt);
  record(3, "NO_DIAGNOSTIC_PROMPT_AUGMENTATION", noDiagnosticHints, {
    note: "the body is the frozen post-parity calibration body: no hint, example or repair instruction was added",
    body_bytes: binding.body_bytes
  });
  if (!noDiagnosticHints) failures.push("DIAGNOSTIC_PROMPT_AUGMENTED");

  const stopRuleFrozen =
    DIAGNOSTIC_STOP_RULE.frozen_before_first_call &&
    DIAGNOSTIC_STOP_RULE.budget_may_be_widened_after_outcomes === false &&
    DIAGNOSTIC_STOP_RULE.estimates_failure_rate === false;
  record(4, "STOP_RULE_FROZEN", stopRuleFrozen, {
    max_calls: MAX_CALLS,
    target_schema_invalid_examples: TARGET_SCHEMA_INVALID_EXAMPLES,
    estimates_failure_rate: DIAGNOSTIC_STOP_RULE.estimates_failure_rate,
    contributes_to_any_denominator: DIAGNOSTIC_STOP_RULE.contributes_to_any_denominator
  });
  if (!stopRuleFrozen) failures.push("STOP_RULE_NOT_FROZEN");

  const markersComplete =
    DIAGNOSTIC_MARKERS.EXPLORATORY_ONLY &&
    DIAGNOSTIC_MARKERS.NON_CONFIRMATORY &&
    DIAGNOSTIC_MARKERS.NOT_CALIBRATION_RERUN &&
    DIAGNOSTIC_MARKERS.NOT_IN_CALIBRATION_DENOMINATOR &&
    DIAGNOSTIC_MARKERS.NOT_PRIMARY_AUTHORIZATION_EVIDENCE;
  record(5, "NON_CONFIRMATORY_MARKERS", markersComplete, DIAGNOSTIC_MARKERS);
  if (!markersComplete) failures.push("DIAGNOSTIC_MARKERS_INCOMPLETE");

  record(6, "FAILURE_TAXONOMY_VOCABULARY", FAILURE_TAXONOMY_DECLARED_BEFORE_CALLS.length > 0, FAILURE_TAXONOMY_DECLARED_BEFORE_CALLS);

  const apiKeyPresent = (deps.apiKey ?? "").trim().length > 0;
  record(7, "API_KEY_ENV_PRESENT", apiKeyPresent, { source: MODEL_API_KEY_ENV, value_recorded: false });
  if (!apiKeyPresent) failures.push("MODEL_API_KEY_ENV_ABSENT");

  return {
    schema_version: "post-parity-schema-failure-diagnostic-preflight-v0",
    diagnostic_id: DIAGNOSTIC_ID,
    namespace: DIAGNOSTIC_NAMESPACE,
    markers: DIAGNOSTIC_MARKERS,
    verdict: failures.length === 0 ? "DIAGNOSTIC_PREFLIGHT_PASS" : "DIAGNOSTIC_PREFLIGHT_STOP",
    failures,
    steps,
    stop_rule: DIAGNOSTIC_STOP_RULE,
    taxonomy_vocabulary: FAILURE_TAXONOMY_DECLARED_BEFORE_CALLS,
    authority_reference: POST_PARITY_AUTHORITY,
    model_calls: 0,
    network_calls: 0,
    transport_constructed: false,
    api_key_source: MODEL_API_KEY_ENV,
    api_key_present: apiKeyPresent
  };
}

export interface DiagnosticRunReport {
  readonly verdict: "DIAGNOSTIC_RUN_COMPLETE" | "DIAGNOSTIC_PREFLIGHT_STOP";
  readonly preflight: DiagnosticPreflightReport;
  readonly result: DiagnosticRunResult | null;
  readonly artifact_path: string | null;
  readonly artifact_hash: string | null;
  readonly model_calls: number;
  readonly network_calls: number;
  readonly api_key_source: typeof MODEL_API_KEY_ENV;
  readonly primary_authorized: false;
}

export async function diagnosticRun(
  input: { readonly artifactOut: string },
  deps: DiagnosticCliDeps
): Promise<DiagnosticRunReport> {
  const preflight = await diagnosticPreflight(deps);
  if (preflight.verdict !== "DIAGNOSTIC_PREFLIGHT_PASS") {
    return {
      verdict: "DIAGNOSTIC_PREFLIGHT_STOP",
      preflight,
      result: null,
      artifact_path: null,
      artifact_hash: null,
      model_calls: 0,
      network_calls: 0,
      api_key_source: MODEL_API_KEY_ENV,
      primary_authorized: false
    };
  }
  const apiKey = (deps.apiKey ?? "").trim();
  const transport =
    deps.transportFactory?.(apiKey) ??
    createDiagnosticTransport(apiKey, undefined, deps.fetchImpl === undefined ? {} : { fetchImpl: deps.fetchImpl });
  const result = await runPostParityDiagnostic({ transport, maxCalls: deps.maxCalls === undefined ? undefined : Math.min(deps.maxCalls, MAX_CALLS) });
  const { artifact_hash: _ignored, ...core } = result;
  void _ignored;
  const artifactHash = hashJson(core);
  const writer =
    deps.writeArtifact ??
    ((path: string, text: string): void => {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, text);
    });
  writer(input.artifactOut, `${JSON.stringify({ ...core, artifact_hash: artifactHash }, null, 2)}\n`);
  return {
    verdict: "DIAGNOSTIC_RUN_COMPLETE",
    preflight,
    result,
    artifact_path: input.artifactOut,
    artifact_hash: artifactHash,
    model_calls: result.summary.model_calls,
    network_calls: result.summary.logical_executed,
    api_key_source: MODEL_API_KEY_ENV,
    primary_authorized: false
  };
}

function flagValue(args: readonly string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index < 0) return undefined;
  return args[index + 1];
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0] ?? "";
  if (command === "diagnostic-preflight") {
    const reportOut = flagValue(args, "--report-out");
    const report = await diagnosticPreflight({ apiKey: process.env[MODEL_API_KEY_ENV] });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (reportOut !== undefined) {
      mkdirSync(dirname(reportOut), { recursive: true });
      writeFileSync(reportOut, `${JSON.stringify(report, null, 2)}\n`);
    }
    process.stderr.write(`diagnostic-preflight ${report.verdict} (model calls 0, network calls 0)\n`);
    if (report.verdict !== "DIAGNOSTIC_PREFLIGHT_PASS") process.exitCode = 1;
    return;
  }
  if (command === "diagnostic-run") {
    const artifactOut = flagValue(args, "--artifact-out");
    const authorized = args.includes("--exploratory-authorized");
    if (artifactOut === undefined || !authorized) {
      process.stderr.write(
        "usage: cli.ts diagnostic-run --artifact-out <PATH> --exploratory-authorized [--report-out <PATH>]\n"
      );
      process.exitCode = 2;
      return;
    }
    const report = await diagnosticRun({ artifactOut }, { apiKey: process.env[MODEL_API_KEY_ENV] });
    const summary =
      report.result === null
        ? { verdict: report.verdict, preflight_failures: report.preflight.failures }
        : {
            verdict: report.verdict,
            model_calls: report.model_calls,
            summary: report.result.summary,
            artifact_path: report.artifact_path,
            artifact_hash: report.artifact_hash
          };
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    const reportOut = flagValue(args, "--report-out");
    if (reportOut !== undefined && report.result !== null) {
      mkdirSync(dirname(reportOut), { recursive: true });
      writeFileSync(reportOut, `${JSON.stringify(report.result, null, 2)}\n`);
    }
    process.stderr.write(
      `diagnostic-run ${report.verdict}: ${report.model_calls} exploratory calls, primary authorized ${String(report.primary_authorized)}\n`
    );
    return;
  }
  process.stderr.write(
    "usage: cli.ts <diagnostic-preflight [--report-out <PATH>]|diagnostic-run --artifact-out <PATH> --exploratory-authorized>\n"
  );
  process.exitCode = 2;
}

const invokedDirectly =
  process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) await main();
