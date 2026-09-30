/* eslint-disable no-restricted-imports -- Isolated research harness over frozen built production roots (repository convention); zero production code changes. */
/**
 * DecisionProbeV1 — PRIMARY EXECUTOR preflight. RESEARCH-ONLY, ZERO model calls.
 *
 *   node research/experiments/decision-probe-v1/primary-preflight.ts <outdir>
 *
 * Performs, in order:
 *   1. resolve the primary executor identity from the PRODUCT's own configuration resolution
 *   2. credential / availability gate
 *   3. QWEN → PRIMARY protocol equivalence report (static)
 * and STOPS. It never substitutes another executor and never marks a fallback as primary.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { hashEnvelope } from "../../../packages/subject-core/dist/index.js";
import type { HashV1 } from "../../../packages/subject-core/dist/index.js";

import {
  availabilityGateV0,
  buildProtocolEquivalenceReportV0,
  resolvePrimaryExecutorIdentityV0
} from "./primary-executor.ts";
import { DECISION_PROBE_V1_SCHEMA_VERSION } from "./contract.ts";

const QWEN_RUN_DIR = "research/experiments/decision-probe-v1/evidence/d0-v1-run-001-qwen35-9b";

async function main(): Promise<void> {
  const outdir = process.argv[2];
  if (outdir === undefined) throw new Error("usage: node primary-preflight.ts <outdir>");
  await mkdir(outdir, { recursive: true });

  const env = process.env as Record<string, string | undefined>;
  const identity = await resolvePrimaryExecutorIdentityV0(env);
  const gate = await availabilityGateV0(identity, env);
  const equivalence = await buildProtocolEquivalenceReportV0(QWEN_RUN_DIR);

  const verdict = {
    decision_probe_version: DECISION_PROBE_V1_SCHEMA_VERSION,
    round: "PRIMARY_EXECUTOR_QUALIFICATION_PREFLIGHT",
    executor_identity: identity,
    availability_gate: gate,
    protocol_equivalence_verdict: equivalence.verdict,
    protocol_equivalence_forbidden_differences: equivalence.forbidden_differences_found,
    primary_d0_v1_run_started: false,
    model_calls_made: 0,
    verdict: gate.verdict,
    d1_gate: "D1 LOCKED",
    reason:
      gate.verdict === "PRIMARY_EXECUTOR_UNAVAILABLE_FOR_D0_V1"
        ? "the primary (cloud) executor cannot be authenticated in this environment; no substitution is permitted"
        : "primary executor available; D0-V1 may now be executed"
  };

  const write = async (name: string, value: unknown): Promise<HashV1> => {
    const content = `${JSON.stringify(value, null, 2)}\n`;
    await writeFile(join(outdir, name), content, "utf8");
    return await hashEnvelope("characteros-next/research/decision-probe-v1/artifact/v0", { name, content });
  };

  await write("primary-executor-identity.json", identity);
  await write("availability-gate.json", gate);
  await write("QWEN_TO_PRIMARY_PROTOCOL_EQUIVALENCE_REPORT.json", equivalence);
  const verdictHash = await write("verdict.json", verdict);
  await write("PREFLIGHT_MANIFEST.json", {
    artifacts: [
      "primary-executor-identity.json",
      "availability-gate.json",
      "QWEN_TO_PRIMARY_PROTOCOL_EQUIVALENCE_REPORT.json",
      "verdict.json"
    ],
    verdict_hash: verdictHash,
    decision_probe_version: DECISION_PROBE_V1_SCHEMA_VERSION,
    model_calls_made: 0
  });

  process.stdout.write(`\nrequested_executor   = ${identity.requested_executor} (${identity.requested_source})\n`);
  process.stdout.write(`effective_executor   = ${identity.effective_executor}\n`);
  process.stdout.write(`effective family     = ${identity.effective_family_model} @ ${identity.effective_family_endpoint}\n`);
  process.stdout.write(`cloud family defaults= ${identity.cloud_family_defaults.model} @ ${identity.cloud_family_defaults.endpoint}\n`);
  process.stdout.write(`local model/endpoint = ${identity.local_model} @ ${identity.local_endpoint}\n`);
  process.stdout.write(`credential_present   = ${String(identity.credential_present)} (${identity.credential_env_var})\n`);
  for (const line of gate.detail) process.stdout.write(`  · ${line}\n`);
  process.stdout.write(`protocol_equivalence = ${equivalence.verdict}\n`);
  process.stdout.write(`\nVERDICT = ${verdict.verdict}\n`);
  process.stdout.write(`artifacts written to ${outdir}\n`);
}

await main();
