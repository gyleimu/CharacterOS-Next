/**
 * BELIEF_CAUSAL_CONFIRMATORY_STOCHASTIC_V1 — offline CLI.
 *
 *   precheck   run P1–P24 deterministic prechecks (0 model calls)
 *   manifest   build the immutable prereg freeze manifest from a prereg commit
 *   verify     verify a stored manifest offline (HEAD-independent)
 *
 * NO command in this file may make a model call: the confirmatory run is
 * forbidden until the preregistration passes an independent audit.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { runPrecheck } from "./precheck.ts";
import { buildPreregManifest, verifyPreregManifest } from "./manifest.ts";

const here = dirname(fileURLToPath(import.meta.url));
const evidenceRoot = join(here, "evidence");
const repoRoot = join(here, "..", "..", "..");

async function main(): Promise<void> {
  const command = process.argv[2] ?? "";
  if (command === "precheck") {
    const result = await runPrecheck(evidenceRoot, repoRoot);
    process.stderr.write(`precheck ok=${String(result.ok)} failed=${JSON.stringify(result.failed)}\n`);
    if (!result.ok) process.exitCode = 1;
    return;
  }
  if (command === "manifest") {
    const commitSha = process.argv[3];
    if (commitSha === undefined) {
      process.stderr.write("usage: cli.ts manifest <preregistration-commit-sha>\n");
      process.exitCode = 2;
      return;
    }
    const manifest = buildPreregManifest({ repoDir: repoRoot, preregistrationCommitSha: commitSha, evidenceRoot });
    mkdirSync(evidenceRoot, { recursive: true });
    writeFileSync(join(evidenceRoot, "freeze-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    process.stderr.write(`manifest hash: ${String((manifest as { manifest_hash?: string }).manifest_hash)}\n`);
    return;
  }
  if (command === "verify") {
    const stored = JSON.parse(
      readFileSync(process.argv[3] ?? join(repoRoot, "tmp", "bcv1", "freeze-manifest.json"), "utf8")
    ) as unknown;
    const verification = verifyPreregManifest(repoRoot, stored);
    process.stdout.write(`${JSON.stringify(verification, null, 2)}\n`);
    if (!verification.ok) process.exitCode = 1;
    return;
  }
  process.stderr.write("usage: cli.ts <precheck|manifest <sha>|verify>\n");
  process.exitCode = 2;
}

await main();
