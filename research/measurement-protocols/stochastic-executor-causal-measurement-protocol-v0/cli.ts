/**
 * STOCHASTIC_EXECUTOR_CAUSAL_MEASUREMENT_PROTOCOL_V0 — offline CLI.
 *
 *   power     write the offline power / sensitivity artifact (0 model calls)
 *   verify    verify the V0 freeze manifest and report hash offline (read-only)
 *   conflation run the negation-aware classifier over its own case suite
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildPowerArtifact } from "./power.ts";
import { CONFLATION_NEGATIVE_CASES, CONFLATION_POSITIVE_CASES, classifyTruthConflation } from "./conflation.ts";
import { canonicalJson, contentHashOf } from "./hashing.ts";

const here = dirname(fileURLToPath(import.meta.url));

async function main(): Promise<void> {
  const command = process.argv[2] ?? "";
  if (command === "power") {
    const artifact = buildPowerArtifact();
    const core = { ...artifact } as Record<string, unknown>;
    const sealed = { ...core, artifact_hash: contentHashOf(canonicalJson(core)) };
    mkdirSync(join(here, "evidence"), { recursive: true });
    writeFileSync(join(here, "evidence", "power-analysis.json"), `${JSON.stringify(sealed, null, 2)}\n`);
    process.stderr.write(`power analysis written: ${String(sealed["artifact_hash"])}\n`);
    return;
  }
  if (command === "conflation") {
    const positives = CONFLATION_POSITIVE_CASES.map((text) => ({
      text,
      conflation: classifyTruthConflation(text).conflation
    }));
    const negatives = CONFLATION_NEGATIVE_CASES.map((text) => ({
      text,
      conflation: classifyTruthConflation(text).conflation
    }));
    const ok = positives.every((entry) => entry.conflation) && negatives.every((entry) => !entry.conflation);
    process.stdout.write(`${JSON.stringify({ ok, positives, negatives }, null, 2)}\n`);
    if (!ok) process.exitCode = 1;
    return;
  }
  if (command === "verify") {
    const { verifyV0Evidence } = await import("./v0-verification.ts");
    const result = verifyV0Evidence(process.env["REPO_ROOT"] ?? process.cwd());
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (!result.v0_evidence_intact) process.exitCode = 1;
    return;
  }
  process.stderr.write("usage: cli.ts <power|conflation|verify>\n");
  process.exitCode = 2;
}

await main();
