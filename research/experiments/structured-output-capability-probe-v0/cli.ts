/**
 * STRUCTURED_OUTPUT_CAPABILITY_PROBE_V0 — tracked CLI.
 *
 *   probe-preflight   Phase A: the capability matrix, 0 model calls, 0 network calls
 *   probe-run         Phase B: at most 3 capability calls, explicit authorization flag
 *
 * The credential comes from `MODEL_API_KEY` in the process environment only and is
 * never printed, hashed or written into an artifact.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  MAX_PROBE_CALLS,
  PROBE_MARKERS,
  PROBE_NAMESPACE,
  PROBE_STOP_RULE
} from "./contract.ts";
import { buildCapabilityMatrix, probePayloadPreview } from "./payload-audit.ts";
import { createProbeTransport, runCapabilityProbe, type ProbeResult } from "./probe.ts";

export const MODEL_API_KEY_ENV = "MODEL_API_KEY" as const;

export interface ProbeCliDeps {
  readonly apiKey: string | undefined;
  readonly fetchImpl?: typeof fetch | undefined;
  readonly writeArtifact?: ((path: string, text: string) => void) | undefined;
  /** Test seam: may only lower the frozen ceiling. */
  readonly maxCalls?: number | undefined;
}

async function probePreflight(deps: ProbeCliDeps): Promise<Record<string, unknown>> {
  const matrix = await buildCapabilityMatrix();
  const apiKeyPresent = (deps.apiKey ?? "").trim().length > 0;
  return {
    schema_version: "structured-output-capability-probe-preflight-v0",
    namespace: PROBE_NAMESPACE,
    markers: PROBE_MARKERS,
    stop_rule: PROBE_STOP_RULE,
    capability_matrix: matrix,
    payload_preview: probePayloadPreview(),
    api_key_source: MODEL_API_KEY_ENV,
    api_key_present: apiKeyPresent,
    model_calls: 0,
    network_calls: 0,
    transport_constructed: false,
    verdict: apiKeyPresent ? "PROBE_PREFLIGHT_PASS" : "PROBE_PREFLIGHT_STOP"
  };
}

export interface ProbeRunReport {
  readonly verdict: "PROBE_RUN_COMPLETE" | "PROBE_PREFLIGHT_STOP";
  readonly result: ProbeResult | null;
  readonly artifact_path: string | null;
  readonly artifact_hash: string | null;
  readonly model_calls: number;
  readonly network_calls: number;
  readonly primary_authorized: false;
}

export async function probeRun(
  input: { readonly artifactOut: string },
  deps: ProbeCliDeps
): Promise<ProbeRunReport> {
  const apiKey = (deps.apiKey ?? "").trim();
  if (apiKey.length === 0) {
    return { verdict: "PROBE_PREFLIGHT_STOP", result: null, artifact_path: null, artifact_hash: null, model_calls: 0, network_calls: 0, primary_authorized: false };
  }
  const transport = createProbeTransport(apiKey, undefined, deps.fetchImpl === undefined ? {} : { fetchImpl: deps.fetchImpl });
  const result = await runCapabilityProbe({
    transport,
    maxCalls: deps.maxCalls === undefined ? undefined : Math.min(deps.maxCalls, MAX_PROBE_CALLS)
  });
  const { artifact_hash: _ignored, ...core } = result;
  void _ignored;
  const artifactHash = `sha256:${createHash("sha256").update(JSON.stringify(core), "utf8").digest("hex")}`;
  const writer =
    deps.writeArtifact ??
    ((path: string, text: string): void => {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, text);
    });
  writer(input.artifactOut, `${JSON.stringify({ ...core, artifact_hash: artifactHash }, null, 2)}\n`);
  return {
    verdict: "PROBE_RUN_COMPLETE",
    result,
    artifact_path: input.artifactOut,
    artifact_hash: artifactHash,
    model_calls: result.summary.model_calls,
    network_calls: result.summary.network_calls,
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
  if (command === "probe-preflight") {
    const report = await probePreflight({ apiKey: process.env[MODEL_API_KEY_ENV] });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    const reportOut = flagValue(args, "--report-out");
    if (reportOut !== undefined) {
      mkdirSync(dirname(reportOut), { recursive: true });
      writeFileSync(reportOut, `${JSON.stringify(report, null, 2)}\n`);
    }
    process.stderr.write(`probe-preflight ${String(report["verdict"])} (model calls 0, network calls 0)\n`);
    if (report["verdict"] !== "PROBE_PREFLIGHT_PASS") process.exitCode = 1;
    return;
  }
  if (command === "probe-run") {
    const artifactOut = flagValue(args, "--artifact-out");
    const authorized = args.includes("--authorize-capability-probe");
    if (artifactOut === undefined || !authorized) {
      process.stderr.write("usage: cli.ts probe-run --artifact-out <PATH> --authorize-capability-probe\n");
      process.exitCode = 2;
      return;
    }
    const report = await probeRun({ artifactOut }, { apiKey: process.env[MODEL_API_KEY_ENV] });
    const summary = report.result === null
      ? { verdict: report.verdict, note: "no credential in the process environment" }
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
    process.stderr.write(`probe-run ${report.verdict}: ${report.model_calls} capability calls (ceiling ${MAX_PROBE_CALLS})\n`);
    return;
  }
  process.stderr.write("usage: cli.ts <probe-preflight|probe-run --artifact-out <PATH> --authorize-capability-probe>\n");
  process.exitCode = 2;
}

const invokedDirectly =
  process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) await main();
