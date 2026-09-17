/* eslint-disable no-restricted-imports -- Research harness: imports frozen built production roots by relative dist path. */
/**
 * BELIEF_CAUSAL_CONFIRMATORY_STOCHASTIC_V1 — offline CLI.
 *
 *   precheck              run P1–P24 deterministic prechecks (0 model calls)
 *   request               build the frozen calibration request (0 model calls)
 *   manifest <sha>        build the immutable prereg freeze manifest from a prereg commit
 *   verify [path]         verify a stored manifest offline (HEAD-independent)
 *   calibration-preflight --approved-prereg-sha <SHA> --manifest <PATH>
 *   calibration-run       --approved-prereg-sha <SHA> --manifest <PATH> --evidence-out <PATH>
 *
 * The two calibration commands are the ONLY formal execution entry points. They
 * replace the untracked scratch driver: every authority fact is computed in the
 * tracked tree, the approved preregistration SHA is an EXTERNAL argument, and the
 * credential comes from the `MODEL_API_KEY` environment variable only.
 *
 * NO command in this file may make a model call unless it is `calibration-run`
 * AND its preflight passed. A passing calibration still authorizes NOTHING
 * further: `PRIMARY_AUTHORIZED` is false and the run stops before the primary
 * phase.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { runPrecheck } from "./precheck.ts";
import { buildPreregManifest, verifyPreregManifest } from "./manifest.ts";
import { authoritativeRequestHash, buildCalibrationRequest, serializeAuthoritativeRequest } from "./calibration-request.ts";
import { calibrationPreflight, calibrationRun, MODEL_API_KEY_ENV } from "./calibration-cli.ts";
import { CALIBRATION_LAW } from "./calibration-law.ts";
import { modelConfigManifest } from "./contract.ts";
import { hashJson } from "./histories.ts";
import { CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA } from "../../../packages/runtime/dist/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const evidenceRoot = join(here, "evidence");
const repoRoot = join(here, "..", "..", "..");

function flagValue(args: readonly string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index < 0) return undefined;
  return args[index + 1];
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0] ?? "";
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
    const serialized = serializeAuthoritativeRequest(request.body);
    const bodyBytes = Buffer.byteLength(serialized, "utf8");
    writeFileSync(
      join(evidenceRoot, "calibration-request.json"),
      `${JSON.stringify(
        {
          ...request,
          calibration_law: CALIBRATION_LAW,
          authoritative_serialization: {
            scheme: "canonicalJson",
            body_bytes: bodyBytes,
            model_facing_request_hash: authoritativeRequestHash(serialized)
          },
          model_calls: 0
        },
        null,
        2
      )}\n`
    );
    process.stderr.write(`calibration request frozen: ${request.hashes.model_facing_request_hash} (${bodyBytes} authoritative bytes)\n`);
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
  if (command === "calibration-preflight" || command === "calibration-run") {
    const approvedPreregSha = flagValue(args, "--approved-prereg-sha");
    const manifestPath = flagValue(args, "--manifest");
    const evidenceOut = flagValue(args, "--evidence-out") ?? join(repoRoot, "tmp", "bcv1", "calibration-evidence.json");
    const reportOut = flagValue(args, "--report-out");
    if (approvedPreregSha === undefined || manifestPath === undefined) {
      process.stderr.write(
        `usage: cli.ts ${command} --approved-prereg-sha <SHA> --manifest <PATH>${command === "calibration-run" ? " --evidence-out <PATH>" : ""}\n`
      );
      process.exitCode = 2;
      return;
    }
    const input = { approvedPreregSha, manifestPath, evidenceOut, reportOut };
    // The credential is read HERE, from the environment, and nowhere else in the
    // tracked tree. It is passed as an opaque value; it is never printed, hashed
    // or written into any artifact.
    const deps = { repoDir: repoRoot, experimentDir: here, apiKey: process.env.MODEL_API_KEY };
    if (command === "calibration-preflight") {
      const { report } = await calibrationPreflight(input, deps);
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      if (reportOut !== undefined) {
        mkdirSync(dirname(reportOut), { recursive: true });
        writeFileSync(reportOut, `${JSON.stringify(report, null, 2)}\n`);
      }
      process.stderr.write(
        `calibration-preflight ${report.verdict} (model calls 0, network calls 0, credential source ${MODEL_API_KEY_ENV}, primary authorized ${String(report.primary_authorized)})\n`
      );
      if (report.verdict !== "CALIBRATION_PREFLIGHT_PASS") process.exitCode = 1;
      return;
    }
    const report = await calibrationRun(input, deps);
    if (reportOut !== undefined) {
      mkdirSync(dirname(reportOut), { recursive: true });
      writeFileSync(reportOut, `${JSON.stringify(report, null, 2)}\n`);
    }
    process.stdout.write(
      `${JSON.stringify(
        {
          verdict: report.verdict,
          law_detail: report.law_detail,
          model_calls: report.model_calls,
          network_calls: report.network_calls,
          pre_call_verifications: report.run.pre_call_verifications,
          stopped_before_trial: report.run.stopped_before_trial,
          stop_reason: report.run.stop_reason,
          aggregates: report.run.aggregates,
          decision: report.run.decision,
          evidence_path: report.evidence_path,
          evidence_hash: report.evidence_hash,
          api_key_source: report.api_key_source,
          primary_authorized: report.primary_authorized,
          stopped_before_primary: report.stopped_before_primary
        },
        null,
        2
      )}\n`
    );
    process.stderr.write(
      `calibration-run ${report.verdict}: primary authorized ${String(report.primary_authorized)} — STOPPING before the primary phase\n`
    );
    return;
  }
  process.stderr.write(
    "usage: cli.ts <precheck|request|manifest <sha> [out]|verify [path]|calibration-preflight --approved-prereg-sha <SHA> --manifest <PATH>|calibration-run --approved-prereg-sha <SHA> --manifest <PATH> --evidence-out <PATH>>\n"
  );
  process.exitCode = 2;
}

await main();
