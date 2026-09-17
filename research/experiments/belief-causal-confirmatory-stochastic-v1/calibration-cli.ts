/**
 * BELIEF_CAUSAL_CONFIRMATORY_STOCHASTIC_V1 — formal calibration CLI (M7).
 *
 * WHY THIS MODULE EXISTS: the audited execution path was driven from an UNTRACKED
 * scratch script, so the exact procedure that would spend 50 real calls was not
 * itself part of the frozen tree. These two commands are the tracked, reviewable
 * entry points:
 *
 *   calibration-preflight  steps 1–10 below, ZERO network, ZERO transport
 *   calibration-run        steps 1–10, then (11) the transport is created
 *
 * Both take an EXTERNAL authorization value (`--approved-prereg-sha`) that is
 * never hardcoded here, and both compute every integrity fact themselves. The
 * credential is read from `MODEL_API_KEY` in the environment and appears nowhere
 * else: not in an argument, not in a report, not in the evidence, not in stdout.
 *
 * NO AUTO-PRIMARY: a successful calibration yields EXECUTOR_CALIBRATION_RUN and
 * STOPS. It never calls the primary or replication phase and never enters the
 * A/B/C/D scheduler — `PRIMARY_AUTHORIZED` is false in every report this module
 * can produce.
 */
import {
  createGitCalibrationAuthority,
  verifyExecutionAuthority,
  type CalibrationAuthority,
  type ExecutionPreflight
} from "./calibration-authority.ts";
import {
  buildCalibrationEvidence,
  writeCalibrationEvidence,
  type CalibrationEvidence
} from "./calibration-evidence.ts";
import { runCalibration, type CalibrationRunResult } from "./calibration-runner.ts";
import { createDeepSeekTransport, type MinimalTransport, type TransportOptions } from "./calibration-transport.ts";
import { MODEL } from "./contract.ts";
import { auditScanSurface } from "./scan-surface.ts";
import { hashJson } from "./histories.ts";

export const MODEL_API_KEY_ENV = "MODEL_API_KEY" as const;
export const PRIMARY_AUTHORIZED = false as const;

export interface CalibrationCliInput {
  readonly approvedPreregSha: string;
  readonly manifestPath: string;
  readonly evidenceOut?: string | undefined;
  readonly reportOut?: string | undefined;
}

export interface CalibrationCliDeps {
  readonly repoDir: string;
  readonly experimentDir: string;
  /** The credential, already read from the environment by the CLI host. Never logged. */
  readonly apiKey: string | undefined;
  /** Test seam: an authority that satisfies the same contract without touching git. */
  readonly authority?: CalibrationAuthority | undefined;
  /** Test seam: a fetch implementation. Production leaves this unset ⇒ global fetch. */
  readonly fetchImpl?: typeof fetch | undefined;
  /** Test seam: the transport constructor, defaulting to the REAL tracked one. */
  readonly transportFactory?: ((apiKey: string) => MinimalTransport) | undefined;
  readonly writeEvidence?: ((path: string, evidence: CalibrationEvidence) => string) | undefined;
}

export interface PreflightStepReport {
  readonly step: number;
  readonly id: string;
  readonly ok: boolean;
  readonly detail: unknown;
}

export interface CalibrationPreflightReport {
  readonly schema_version: "bcv1-calibration-preflight-v1";
  readonly experiment_id: string;
  readonly verdict: "CALIBRATION_PREFLIGHT_PASS" | "CALIBRATION_PREFLIGHT_STOP";
  readonly failures: readonly string[];
  readonly steps: readonly PreflightStepReport[];
  readonly approved_prereg_sha: string;
  readonly manifest_path: string;
  readonly current_head: string | null;
  readonly manifest_prereg_sha: string | null;
  readonly three_way_equal: boolean;
  readonly model_calls: 0;
  readonly network_calls: 0;
  readonly transport_constructed: false;
  readonly api_key_source: typeof MODEL_API_KEY_ENV;
  readonly api_key_present: boolean;
  readonly primary_authorized: false;
  readonly frozen_request_hash: string | null;
  readonly runtime_request_hash: string | null;
  readonly design_rederivation_matches: Readonly<Record<string, boolean>>;
}

export interface CalibrationRunReport {
  readonly schema_version: "bcv1-calibration-run-report-v1";
  readonly experiment_id: string;
  readonly verdict: CalibrationRunResult["decision"]["decision"];
  readonly law_detail: string;
  readonly model_calls: number;
  readonly network_calls: number;
  readonly preflight: CalibrationPreflightReport;
  readonly run: CalibrationRunResult;
  readonly evidence_path: string | null;
  readonly evidence_hash: string | null;
  readonly api_key_source: typeof MODEL_API_KEY_ENV;
  readonly primary_authorized: false;
  readonly stopped_before_primary: true;
}

function authorityOf(input: CalibrationCliInput, deps: CalibrationCliDeps): CalibrationAuthority {
  return (
    deps.authority ??
    createGitCalibrationAuthority({
      approvedPreregSha: input.approvedPreregSha,
      manifestPath: input.manifestPath,
      repoDir: deps.repoDir,
      experimentDir: deps.experimentDir
    })
  );
}

/**
 * Steps 1–10 of the formal preflight order. Step 11 (creating the real
 * transport) is deliberately NOT part of this function: preflight must be
 * incapable of constructing a network surface.
 */
export async function calibrationPreflight(
  input: CalibrationCliInput,
  deps: CalibrationCliDeps
): Promise<{ readonly report: CalibrationPreflightReport; readonly preflight: ExecutionPreflight; readonly authority: CalibrationAuthority }> {
  const authority = authorityOf(input, deps);
  const steps: PreflightStepReport[] = [];
  const record = (step: number, id: string, ok: boolean, detail: unknown): void => {
    steps.push({ step, id, ok, detail });
  };

  // 1/2/3 — current git HEAD, tracked tree clean, three-way approved-SHA law.
  // These are computed by `verifyExecutionAuthority` below; step 1 records the
  // raw reads first so a failure is still fully legible.
  let currentHead: string | null = null;
  try {
    currentHead = authority.currentHead();
    const trackedTreeClean = authority.trackedTreeClean();
    record(1, "CURRENT_GIT_HEAD", true, currentHead);
    record(2, "TRACKED_TREE_CLEAN", trackedTreeClean, trackedTreeClean);
  } catch (error) {
    record(1, "CURRENT_GIT_HEAD", false, error instanceof Error ? error.message : String(error));
    record(2, "TRACKED_TREE_CLEAN", false, "git read failed");
  }
  const manifestPreregSha = String(authority.manifest()["preregistration_commit_sha"] ?? "");
  const threeWayEqual =
    currentHead !== null && currentHead === manifestPreregSha && manifestPreregSha === input.approvedPreregSha;
  record(3, "APPROVED_PREREG_SHA_THREE_WAY", threeWayEqual, {
    current_head: currentHead,
    manifest_prereg_sha: manifestPreregSha,
    approved_prereg_sha: input.approvedPreregSha
  });

  // 4–9 — manifest verification, independent design re-derivation, actual request
  // bytes, the five-hash comparison, the P17 write surface and the P22 firewall.
  const preflight = await verifyExecutionAuthority(authority);
  record(4, "MANIFEST_VERIFICATION", preflight.manifest_verification.ok, preflight.manifest_verification.detail);
  record(5, "INDEPENDENT_DESIGN_REDERIVATION", preflight.design_rederivation.all_match, {
    matches: preflight.design_rederivation.matches,
    mismatched: preflight.design_rederivation.mismatched,
    formation_attestation: preflight.design_rederivation.formation_attestation
  });
  record(6, "AUTHORITATIVE_REQUEST_BYTES", preflight.request_binding.request.serialized_body.length > 0, {
    request_hash: preflight.request_binding.request.request_hash,
    body_bytes: Buffer.byteLength(preflight.request_binding.request.serialized_body, "utf8"),
    serialization: "canonicalJson"
  });
  record(7, "REQUEST_SYSTEM_USER_SCHEMA_CONFIG_HASHES", preflight.request_binding.ok, {
    expected: preflight.request_binding.expected,
    actual: preflight.request_binding.request.hashes,
    failures: preflight.request_binding.failures
  });
  record(8, "P17_WRITE_SURFACE", preflight.write_surface.passed, {
    execution_closure: preflight.write_surface.execution_closure,
    violations: preflight.write_surface.violations,
    durable_stable: preflight.write_surface.durable_stable
  });
  record(9, "P22_V0_FIREWALL", preflight.v0_firewall.passed, {
    files_scanned: preflight.v0_firewall.files_scanned.length,
    violations: preflight.v0_firewall.read_or_import_violations
  });

  // 10 — credential presence, read from the environment ONLY. Its value is never
  // captured, logged, hashed or returned.
  const apiKeyPresent = (deps.apiKey ?? "").trim().length > 0;
  record(10, "API_KEY_ENV_PRESENT", apiKeyPresent, { source: MODEL_API_KEY_ENV, value_recorded: false });

  const failures = [...preflight.failures];
  if (!threeWayEqual) failures.push("APPROVED_PREREG_SHA_THREE_WAY_MISMATCH");
  if (!apiKeyPresent) failures.push("MODEL_API_KEY_ENV_ABSENT");
  const report: CalibrationPreflightReport = {
    schema_version: "bcv1-calibration-preflight-v1",
    experiment_id: "BELIEF_CAUSAL_CONFIRMATORY_STOCHASTIC_V1",
    verdict: failures.length === 0 ? "CALIBRATION_PREFLIGHT_PASS" : "CALIBRATION_PREFLIGHT_STOP",
    failures,
    steps,
    approved_prereg_sha: input.approvedPreregSha,
    manifest_path: input.manifestPath,
    current_head: currentHead,
    manifest_prereg_sha: manifestPreregSha,
    three_way_equal: threeWayEqual,
    model_calls: 0,
    network_calls: 0,
    transport_constructed: false,
    api_key_source: MODEL_API_KEY_ENV,
    api_key_present: apiKeyPresent,
    primary_authorized: PRIMARY_AUTHORIZED,
    frozen_request_hash: String(
      (authority.manifest()["design"] as { calibration_request?: { model_facing_request_hash?: string } } | undefined)
        ?.calibration_request?.model_facing_request_hash ?? ""
    ),
    runtime_request_hash: preflight.request_binding.request.request_hash,
    design_rederivation_matches: preflight.design_rederivation.matches
  };
  return { report, preflight, authority };
}

/**
 * The formal run: preflight first, and the transport is created ONLY after every
 * authority step has passed. A blocker at any step means zero network calls.
 */
export async function calibrationRun(
  input: CalibrationCliInput,
  deps: CalibrationCliDeps
): Promise<CalibrationRunReport> {
  const { report: preflightReport, authority } = await calibrationPreflight(input, deps);
  if (preflightReport.verdict !== "CALIBRATION_PREFLIGHT_PASS") {
    // No transport is constructed and no call is made: the run report is a STOP
    // carrying the preflight failures.
    const emptyRun = await runCalibration(
      { transport: unreachableTransport(), authority, maxTrials: 0 },
      { scanSurface: auditScanSurface(authority.computeSchemaHash()).exact_scan_surface }
    );
    return {
      schema_version: "bcv1-calibration-run-report-v1",
      experiment_id: "BELIEF_CAUSAL_CONFIRMATORY_STOCHASTIC_V1",
      verdict: "EXECUTOR_CALIBRATION_STOP",
      law_detail: `preflight failed: ${preflightReport.failures.join(", ")}`,
      model_calls: 0,
      network_calls: 0,
      preflight: preflightReport,
      run: emptyRun,
      evidence_path: null,
      evidence_hash: null,
      api_key_source: MODEL_API_KEY_ENV,
      primary_authorized: PRIMARY_AUTHORIZED,
      stopped_before_primary: true
    };
  }

  // 11 — ONLY NOW is a real transport created, from the environment credential.
  const apiKey = (deps.apiKey ?? "").trim();
  const transportOptions: TransportOptions = deps.fetchImpl === undefined ? {} : { fetchImpl: deps.fetchImpl };
  const transport = deps.transportFactory?.(apiKey) ?? createDeepSeekTransport(apiKey, MODEL.base_url, transportOptions);
  const run = await runCalibration(
    { transport, authority },
    { scanSurface: auditScanSurface(authority.computeSchemaHash()).exact_scan_surface }
  );

  let evidencePath: string | null = null;
  let evidenceHash: string | null = null;
  if (input.evidenceOut !== undefined) {
    const evidence = buildCalibrationEvidence({
      preregistrationCommit: run.integrity.manifest_prereg_sha,
      approvedPreregSha: run.integrity.approved_prereg_sha,
      manifestHash: String((authority.manifest() as { manifest_hash?: string }).manifest_hash ?? ""),
      manifestPath: input.manifestPath,
      calibrationDescriptorHash: hashJson({
        law: run.decision.law_id,
        scheduled: run.aggregates.planned,
        request: run.request.model_facing_request_hash
      }),
      headBefore: run.integrity.current_head_before,
      headAfter: run.integrity.current_head_after,
      trackedTreeCleanBefore: run.integrity.tracked_tree_clean_before,
      trackedTreeCleanAfter: run.integrity.tracked_tree_clean_after,
      modelId: MODEL.id,
      modelConfigHash: run.request.model_config_hash,
      run
    });
    const writer = deps.writeEvidence ?? writeCalibrationEvidence;
    evidenceHash = writer(input.evidenceOut, evidence);
    evidencePath = input.evidenceOut;
  }

  const modelCalls = run.aggregates.raw_api_attempts;
  return {
    schema_version: "bcv1-calibration-run-report-v1",
    experiment_id: "BELIEF_CAUSAL_CONFIRMATORY_STOCHASTIC_V1",
    verdict: run.decision.decision,
    law_detail: run.decision.detail,
    model_calls: modelCalls,
    network_calls: modelCalls,
    preflight: preflightReport,
    run,
    evidence_path: evidencePath,
    evidence_hash: evidenceHash,
    api_key_source: MODEL_API_KEY_ENV,
    primary_authorized: PRIMARY_AUTHORIZED,
    stopped_before_primary: true
  };
}

/**
 * A transport that fails closed. It is used ONLY on the preflight-failure path,
 * where the run is invoked with zero scheduled trials, so `complete` is never
 * reachable — and if it ever were, it would refuse rather than reach a network.
 */
function unreachableTransport(): MinimalTransport {
  return {
    id: "UNREACHABLE_PREFLIGHT_BLOCKED",
    complete: async () => ({
      ok: false,
      code: "CALIBRATION_PREFLIGHT_BLOCKED",
      failure_class: "ATTEMPTS_EXHAUSTED",
      detail: "no transport is constructed while preflight has not passed",
      attempts: []
    })
  };
}
