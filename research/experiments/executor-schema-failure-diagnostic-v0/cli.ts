/**
 * EXPLORATORY_EXECUTOR_SCHEMA_FAILURE_DIAGNOSTIC_V0 — tracked CLI.
 *
 *   diagnostic-preflight   Phase A gate: 0 model calls, 0 network calls
 *   diagnostic-run         Phase B: bounded exploratory calls within the frozen budget
 *
 * The credential is read from `MODEL_API_KEY` in the environment only and is
 * never printed, hashed, recorded or written into an artifact.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DIAGNOSTIC_ID,
  DIAGNOSTIC_MARKERS,
  DIAGNOSTIC_MAX_MODEL_CALLS,
  DIAGNOSTIC_NAMESPACE,
  DIAGNOSTIC_STOP_RULE,
  DIAGNOSTIC_TARGET_SCHEMA_INVALID_EXAMPLES,
  FAILURE_TAXONOMY_ADDED_AFTER_RUN,
  FAILURE_TAXONOMY_DECLARED_BEFORE_CALLS,
  FAILURE_TAXONOMY_IDS,
  FROZEN_MODEL_FACING_REQUEST_HASH
} from "./contract.ts";
import { assertFrozenRequest, buildDiagnosticRequest } from "./frozen-request.ts";
import { createDiagnosticTransport, type DiagnosticTransport } from "./diagnostic-transport.ts";
import { diagnosticArtifactCore, runDiagnostic, type DiagnosticRunResult } from "./diagnostic-runner.ts";
import { classifyResponse, summarizeTaxonomy } from "./taxonomy.ts";
import { hashJson } from "./hash.ts";

export const MODEL_API_KEY_ENV = "MODEL_API_KEY" as const;

export interface DiagnosticCliDeps {
  readonly apiKey: string | undefined;
  /** Test seam: a fetch implementation. Production leaves this unset. */
  readonly fetchImpl?: typeof fetch | undefined;
  /** Test seam: the transport constructor, defaulting to the REAL tracked one. */
  readonly transportFactory?: ((apiKey: string) => DiagnosticTransport) | undefined;
  readonly writeArtifact?: ((path: string, text: string) => void) | undefined;
  /** Test seam: may only LOWER the frozen budget, never raise it. */
  readonly maxCalls?: number | undefined;
}

export interface DiagnosticPreflightReport {
  readonly schema_version: "executor-schema-failure-diagnostic-preflight-v0";
  readonly diagnostic_id: typeof DIAGNOSTIC_ID;
  readonly namespace: typeof DIAGNOSTIC_NAMESPACE;
  readonly markers: typeof DIAGNOSTIC_MARKERS;
  readonly verdict: "DIAGNOSTIC_PREFLIGHT_PASS" | "DIAGNOSTIC_PREFLIGHT_STOP";
  readonly failures: readonly string[];
  readonly steps: readonly { readonly step: number; readonly id: string; readonly ok: boolean; readonly detail: unknown }[];
  readonly stop_rule: typeof DIAGNOSTIC_STOP_RULE;
  readonly taxonomy_vocabulary: readonly string[];
  readonly model_calls: 0;
  readonly network_calls: 0;
  readonly transport_constructed: false;
  readonly api_key_source: typeof MODEL_API_KEY_ENV;
  readonly api_key_present: boolean;
}

/**
 * Phase A gate. Runs the whole instrumentation path with ZERO calls:
 * request byte-identity, validator reachability, artifact isolation, credential
 * presence and the frozen stop rule.
 */
export async function diagnosticPreflight(deps: DiagnosticCliDeps): Promise<DiagnosticPreflightReport> {
  const steps: DiagnosticPreflightReport["steps"][number][] = [];
  const record = (step: number, id: string, ok: boolean, detail: unknown): void => {
    steps.push({ step, id, ok, detail });
  };
  const failures: string[] = [];

  const binding = await buildDiagnosticRequest();
  const byteIdentical = binding.byte_identical_to_calibration && binding.request_hash === FROZEN_MODEL_FACING_REQUEST_HASH;
  record(1, "FROZEN_REQUEST_BYTE_IDENTITY", byteIdentical, {
    request_hash: binding.request_hash,
    expected: FROZEN_MODEL_FACING_REQUEST_HASH,
    body_bytes: binding.body_bytes,
    reconstructed_hashes: binding.reconstructed_hashes
  });
  if (!byteIdentical) failures.push("DIAGNOSTIC_REQUEST_HASH_MISMATCH");
  try {
    assertFrozenRequest(binding);
    record(2, "FAIL_CLOSED_REQUEST_ASSERTION", true, "assertion accepted the frozen bytes");
  } catch (error) {
    record(2, "FAIL_CLOSED_REQUEST_ASSERTION", false, error instanceof Error ? error.message : String(error));
    failures.push("DIAGNOSTIC_REQUEST_ASSERTION_FAILED");
  }

  const stopRuleFrozen = DIAGNOSTIC_STOP_RULE.frozen_before_first_call && DIAGNOSTIC_STOP_RULE.budget_may_be_widened_after_outcomes === false;
  record(3, "STOP_RULE_FROZEN", stopRuleFrozen, {
    max_model_calls: DIAGNOSTIC_MAX_MODEL_CALLS,
    stop_when_schema_invalid_examples_reach: DIAGNOSTIC_TARGET_SCHEMA_INVALID_EXAMPLES,
    uses_run_stop_law: DIAGNOSTIC_STOP_RULE.uses_run_stop_law,
    contributes_to_any_denominator: DIAGNOSTIC_STOP_RULE.contributes_to_any_denominator
  });
  if (!stopRuleFrozen) failures.push("DIAGNOSTIC_STOP_RULE_NOT_FROZEN");

  const markersComplete =
    DIAGNOSTIC_MARKERS.EXPLORATORY_ONLY &&
    DIAGNOSTIC_MARKERS.NON_CONFIRMATORY &&
    DIAGNOSTIC_MARKERS.NOT_IN_CALIBRATION_DENOMINATOR &&
    DIAGNOSTIC_MARKERS.NOT_PRIMARY_AUTHORIZATION_EVIDENCE;
  record(4, "NON_CONFIRMATORY_MARKERS", markersComplete, DIAGNOSTIC_MARKERS);
  if (!markersComplete) failures.push("DIAGNOSTIC_MARKERS_INCOMPLETE");

  record(5, "TAXONOMY_VOCABULARY", FAILURE_TAXONOMY_IDS.length > 0, FAILURE_TAXONOMY_IDS);

  const apiKeyPresent = (deps.apiKey ?? "").trim().length > 0;
  record(6, "API_KEY_ENV_PRESENT", apiKeyPresent, { source: MODEL_API_KEY_ENV, value_recorded: false });
  if (!apiKeyPresent) failures.push("MODEL_API_KEY_ENV_ABSENT");

  return {
    schema_version: "executor-schema-failure-diagnostic-preflight-v0",
    diagnostic_id: DIAGNOSTIC_ID,
    namespace: DIAGNOSTIC_NAMESPACE,
    markers: DIAGNOSTIC_MARKERS,
    verdict: failures.length === 0 ? "DIAGNOSTIC_PREFLIGHT_PASS" : "DIAGNOSTIC_PREFLIGHT_STOP",
    failures,
    steps,
    stop_rule: DIAGNOSTIC_STOP_RULE,
    taxonomy_vocabulary: FAILURE_TAXONOMY_IDS,
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

/**
 * Phase B: the bounded exploratory investigation. Refuses to construct a
 * transport unless the preflight passed.
 */
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
  // The seam can only tighten the frozen budget; it can never widen it.
  const budget = Math.min(deps.maxCalls ?? DIAGNOSTIC_MAX_MODEL_CALLS, DIAGNOSTIC_MAX_MODEL_CALLS);
  const result = await runDiagnostic({ transport, maxCalls: budget });
  const core = diagnosticArtifactCore(result);
  const artifactHash = hashJson(core);
  const document = { ...core, artifact_hash: artifactHash };
  const writer = deps.writeArtifact ?? ((path: string, text: string): void => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text);
  });
  writer(input.artifactOut, `${JSON.stringify(document, null, 2)}\n`);
  return {
    verdict: "DIAGNOSTIC_RUN_COMPLETE",
    preflight,
    result,
    artifact_path: input.artifactOut,
    artifact_hash: artifactHash,
    model_calls: result.summary.model_calls,
    network_calls: result.summary.model_calls,
    api_key_source: MODEL_API_KEY_ENV,
    primary_authorized: false
  };
}

/* -------------------------------------------------------------------------- */
/* argv entry point                                                            */
/* -------------------------------------------------------------------------- */

function flagValue(args: readonly string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index < 0) return undefined;
  return args[index + 1];
}

/**
 * `diagnostic-run` additionally requires `--exploratory-authorized`, so a bare
 * invocation can never spend calls by accident.
 */
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
    const reportOut = flagValue(args, "--report-out");
    const authorized = args.includes("--exploratory-authorized");
    if (artifactOut === undefined || !authorized) {
      process.stderr.write(
        "usage: cli.ts diagnostic-run --artifact-out <PATH> --exploratory-authorized [--report-out <PATH>]\n"
      );
      process.exitCode = 2;
      return;
    }
    const report = await diagnosticRun({ artifactOut }, { apiKey: process.env[MODEL_API_KEY_ENV] });
    const summary = report.result === null
      ? { verdict: report.verdict, preflight: report.preflight.failures }
      : {
          verdict: report.verdict,
          model_calls: report.model_calls,
          summary: report.result.summary,
          artifact_path: report.artifact_path,
          artifact_hash: report.artifact_hash
        };
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    if (reportOut !== undefined) {
      mkdirSync(dirname(reportOut), { recursive: true });
      writeFileSync(reportOut, `${JSON.stringify(report.result ?? { preflight: report.preflight }, null, 2)}\n`);
    }
    process.stderr.write(
      `diagnostic-run ${report.verdict}: ${report.model_calls} exploratory calls, primary authorized ${String(report.primary_authorized)}\n`
    );
    return;
  }
  if (command === "diagnostic-reclassify") {
    const inPath = flagValue(args, "--artifact");
    const outPath = flagValue(args, "--out");
    if (inPath === undefined || outPath === undefined) {
      process.stderr.write("usage: cli.ts diagnostic-reclassify --artifact <PATH> --out <PATH>\n");
      process.exitCode = 2;
      return;
    }
    const result = reclassifyFile({ inPath, outPath });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.stderr.write(`diagnostic-reclassify: 0 model calls, ${result.responses} stored responses reclassified\n`);
    return;
  }
  process.stderr.write("usage: cli.ts <diagnostic-preflight [--report-out <PATH>]|diagnostic-run --artifact-out <PATH> --exploratory-authorized>\n");
  process.exitCode = 2;
}

const invokedDirectly =
  process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) await main();

/* -------------------------------------------------------------------------- */
/* offline reclassification (0 model calls)                                    */
/* -------------------------------------------------------------------------- */

/**
 * Applies the CURRENT (evidence-extended) taxonomy to an ALREADY CAPTURED
 * artifact. It makes no calls and reads no provider: the stored validation
 * traces are the input, so the original artifact stays bit-for-bit intact and a
 * reviewer can diff the two. The derived artifact states exactly which
 * categories were added after the run and why.
 */
export function reclassifyArtifact(input: {
  readonly artifact: DiagnosticRunResult & { readonly artifact_hash?: string };
}): Record<string, unknown> {
  const responses = input.artifact.responses.map((record) => ({
    ...record,
    classification: classifyResponse(record.validation_trace)
  }));
  const summary = {
    ...input.artifact.summary,
    taxonomy: summarizeTaxonomy(
      responses.map((record, index) => ({ trial: index + 1, classification: record.classification })),
      FAILURE_TAXONOMY_IDS
    )
  };
  return {
    schema_version: input.artifact.schema_version,
    diagnostic_id: input.artifact.diagnostic_id,
    namespace: input.artifact.namespace,
    markers: input.artifact.markers,
    derived_from_artifact_hash: input.artifact.artifact_hash ?? null,
    reclassification: {
      makes_model_calls: false,
      input_is_the_stored_artifact: true,
      original_artifact_left_unmodified: true,
      vocabulary_declared_before_calls: FAILURE_TAXONOMY_DECLARED_BEFORE_CALLS,
      vocabulary_added_after_run: FAILURE_TAXONOMY_ADDED_AFTER_RUN,
      why:
        "the taxonomy is built from real captured data (the declared list was explicitly a candidate vocabulary); no stop rule, budget or provider interaction was changed by this step",
      stop_rule_unchanged: true
    },
    calibration_reference: input.artifact.calibration_reference,
    stop_rule: input.artifact.stop_rule,
    model: input.artifact.model,
    request_binding: input.artifact.request_binding,
    responses,
    summary
  };
}

/** Reads a stored artifact, reclassifies it and writes the derived artifact. */
export function reclassifyFile(input: { readonly inPath: string; readonly outPath: string }): {
  readonly derived_hash: string;
  readonly responses: number;
  readonly categories_observed: readonly string[];
} {
  const stored = JSON.parse(readFileSync(input.inPath, "utf8")) as DiagnosticRunResult & { readonly artifact_hash?: string };
  const derived = reclassifyArtifact({ artifact: stored });
  const derivedHash = hashJson(derived);
  mkdirSync(dirname(input.outPath), { recursive: true });
  writeFileSync(input.outPath, `${JSON.stringify({ ...derived, derived_artifact_hash: derivedHash }, null, 2)}\n`);
  const summary = derived["summary"] as { readonly taxonomy: { readonly categories_observed: readonly string[] } };
  return { derived_hash: derivedHash, responses: stored.responses.length, categories_observed: summary.taxonomy.categories_observed };
}
