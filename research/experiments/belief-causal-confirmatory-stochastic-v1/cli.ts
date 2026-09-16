/* eslint-disable no-restricted-imports -- Research harness: imports frozen built production roots by relative dist path. */
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
import { buildCalibrationRequest } from "./calibration-request.ts";
import { CALIBRATION_LAW } from "./calibration-law.ts";
import { modelConfigManifest } from "./contract.ts";
import { hashJson } from "./histories.ts";
import { CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA } from "../../../packages/runtime/dist/index.js";

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
  if (command === "request") {
    // Builds the ACTUAL model-facing calibration request offline (0 model calls)
    // and freezes it as evidence for the manifest design binding.
    const request = await buildCalibrationRequest({
      schemaHash: hashJson(CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA),
      modelConfigHash: hashJson(modelConfigManifest())
    });
    mkdirSync(evidenceRoot, { recursive: true });
    const bodyBytes = Buffer.byteLength(JSON.stringify(request.body), "utf8");
    writeFileSync(
      join(evidenceRoot, "calibration-request.json"),
      `${JSON.stringify(
        {
          ...request,
          calibration_law: CALIBRATION_LAW,
          body_bytes: bodyBytes,
          model_calls: 0
        },
        null,
        2
      )}
`
    );
    process.stderr.write(`calibration request frozen: ${request.hashes.model_facing_request_hash} (${bodyBytes} bytes)
`);
    return;
  }
  if (command === "manifest") {
    const commitSha = process.argv[3];
    if (commitSha === undefined) {
      process.stderr.write("usage: cli.ts manifest <preregistration-commit-sha> [out-path]\n");
      process.exitCode = 2;
      return;
    }
    // The manifest is a PRE-RUN artifact: by default it is written OUTSIDE the
    // tracked tree, so HEAD stays exactly at the PREREGISTRATION_COMMIT with a
    // clean worktree. It is byte-reproducible from that commit at any time, and
    // the frozen timeline commits it at the RESULT stage.
    const outPath = process.argv[4] ?? join(repoRoot, "tmp", "bcv1", "freeze-manifest.json");
    const manifest = buildPreregManifest({ repoDir: repoRoot, preregistrationCommitSha: commitSha, evidenceRoot });
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`);
    process.stderr.write(`manifest written: ${outPath}\n`);
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
