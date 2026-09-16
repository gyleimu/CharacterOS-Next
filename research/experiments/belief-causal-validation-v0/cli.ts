/**
 * BELIEF_CAUSAL_VALIDATION_V0 — CLI.
 *
 *   precheck    deterministic offline gates (0 model calls)
 *   history     (re)build + freeze the LOW/HIGH durable histories
 *   pilot       >= 24 host-validity scenes
 *   primary     40 scenes
 *   replication 40 scenes
 *   report      score the collected evidence and derive the verdict
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import { EXPERIMENT_ID, type Phase } from "./contract.ts";
import { runPrecheck } from "./precheck.ts";
import { runPhase } from "./runner.ts";

const here = dirname(fileURLToPath(import.meta.url));
const evidenceRoot = join(here, "evidence");

function phaseArg(value: string | undefined): Phase | null {
  if (value === "pilot") return "PILOT";
  if (value === "primary") return "PRIMARY";
  if (value === "replication") return "REPLICATION";
  return null;
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? "";
  if (command === "precheck") {
    const result = await runPrecheck(join(evidenceRoot, "precheck"));
    process.stderr.write(`precheck ok=${String(result.ok)} failed=${JSON.stringify(result.failed_gates)}\n`);
    if (!result.ok) process.exitCode = 1;
    return;
  }
  const phase = phaseArg(command);
  if (phase !== null) {
    const summary = await runPhase(phase, evidenceRoot, process.env, (line) => process.stderr.write(line));
    process.stderr.write(`${command} complete: ${JSON.stringify(summary.verdict)}\n`);
    return;
  }
  if (command === "freeze") {
    const { writeFreezeManifest } = await import("./freeze.ts");
    const manifest = writeFreezeManifest(here, evidenceRoot);
    process.stderr.write(`freeze manifest: ${String((manifest as { manifest_hash?: string }).manifest_hash)}
`);
    return;
  }
  if (command === "report") {
    const { writeReport } = await import("./runner.ts");
    const report = await writeReport(evidenceRoot);
    process.stderr.write(`report: ${JSON.stringify(report.verdict)}\n`);
    return;
  }
  if (command === "worker") {
    // Internal: one scene in a fresh process. Input JSON on stdin, output JSON on stdout.
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
    const { runSceneWorker } = await import("./scene-worker.ts");
    const output = await runSceneWorker(JSON.parse(Buffer.concat(chunks).toString("utf8")) as never);
    process.stdout.write(JSON.stringify(output));
    return;
  }
  process.stderr.write(`usage: cli.ts <precheck|history|pilot|primary|replication|report>\n`);
  process.exitCode = 2;
}

void mkdirSync;
void readFileSync;
void writeFileSync;
void spawnSync;
void EXPERIMENT_ID;

await main();
