/* eslint-disable no-restricted-imports -- Research harness: imports frozen built production roots by relative dist path. */
/**
 * BELIEF_CAUSAL_CONFIRMATORY_STOCHASTIC_V1 — calibration runner (FROZEN).
 *
 * Executes exactly `CALIBRATION_SCHEDULED_LOGICAL_TRIALS` logical calibration
 * trials. Per trial:
 *
 *   1. BEFORE ANY NETWORK CALL the execution authority is re-checked: current git
 *      HEAD, tracked-worktree state, and a FRESH re-render of the authoritative
 *      request bytes compared against the five manifest-frozen hashes. A drift
 *      detected here stops the run BEFORE the drifted call.
 *   2. the transport sends the ONE frozen request body — the authoritative
 *      `canonicalJson` string, byte-identical every time; retries live inside the
 *      transport and reuse that same string;
 *   3. a FRESH production `ConversationCognitionProviderV8` validates the
 *      response through the real production pipeline (schema + factual authority
 *      + response semantics) — fresh per draw, so no conversation state and no
 *      duplicate guard carries over;
 *   4. the trial is HOST_VALID only if transport succeeded, JSON/schema
 *      validation passed and the directive atom is one of the frozen atoms;
 *   5. a response that reports a DIFFERENT model identity is recorded, and no
 *      further call is made: response-model drift stops the run at the next trial.
 *
 * It NEVER retries a schema-invalid, host-invalid or "unwanted" outcome, never
 * replaces an invalid trial, applies the deterministic early-stop law, and
 * performs NO canonical write: it imports no Belief writer, no executor, no
 * commit path and no A/B/C/D trial identity.
 */
import { ConversationCognitionProviderV8 } from "../../../packages/runtime/dist/providers/behavior/conversation-cognition-provider-v8.js";
import { classifyTruthConflation } from "../../measurement-protocols/stochastic-executor-causal-measurement-protocol-v0/conflation.ts";

import {
  type CalibrationAuthority,
  type ExecutionPreflight,
  verifyExecutionAuthority,
  verifyTrialPreCall
} from "./calibration-authority.ts";
import {
  ALLOWED_DIRECTIVE_ATOMS,
  CALIBRATION_SCHEDULED_LOGICAL_TRIALS,
  evaluateCalibrationLaw,
  floorUnreachable,
  type CalibrationLawDecision
} from "./calibration-law.ts";
import { buildCalibrationProjection, buildCalibrationSubject } from "./calibration-request.ts";
import { isRetryableFailureClass, type MinimalTransport, type TransportUsage } from "./calibration-transport.ts";
import { MODEL } from "./contract.ts";
import { hashJson, hashText } from "./histories.ts";

export interface CalibrationTrialRecord {
  readonly logical_trial: number;
  readonly trial_id: string;
  readonly host_valid: boolean;
  readonly host_invalid_reason: string | null;
  readonly schema_valid: boolean;
  /** The model content parsed as JSON at all (envelope vs cognition distinction). */
  readonly content_json_valid: boolean;
  readonly directive: string | null;
  readonly truth_conflation_flags: number;
  readonly raw_attempts: number;
  readonly transport_failure: string | null;
  readonly transport_failure_class: string | null;
  readonly retry_attempted: boolean;
  readonly usage: TransportUsage;
  /** AUTHORITATIVE: hash of the exact bytes this trial handed to the transport. */
  readonly request_hash: string;
  /** DIAGNOSTIC ONLY: what the transport echoed back for those attempts. */
  readonly transport_body_hash: string;
  readonly serialized_body_bytes: number;
  readonly system_hash: string;
  readonly user_hash: string;
  readonly schema_hash: string;
  readonly model_config_hash: string;
  readonly model_reported: string | null;
}

export interface CalibrationRunInput {
  readonly transport: MinimalTransport;
  readonly authority: CalibrationAuthority;
  /** Test hook: cap the loop (defaults to the frozen 50). */
  readonly maxTrials?: number;
}

export interface CalibrationIntegrityGates {
  readonly PREREG_SHA_MATCH: boolean;
  readonly MANIFEST_VALID: boolean;
  readonly DESIGN_REDERIVATION: boolean;
  readonly TRACKED_TREE_CLEAN: boolean;
  readonly REQUEST_HASH_IDENTITY: boolean;
  readonly MODEL_IDENTITY: boolean;
  readonly CONFIG_HASH_IDENTITY: boolean;
  readonly SCHEMA_HASH_IDENTITY: boolean;
  readonly SYSTEM_HASH_IDENTITY: boolean;
  readonly USER_HASH_IDENTITY: boolean;
  readonly RETRY_LEGALITY: boolean;
  readonly SECRET_SAFETY: boolean;
  readonly NO_PRODUCTION_WRITE: boolean;
  readonly NO_FORBIDDEN_PROVIDER: boolean;
}

export interface CalibrationRunResult {
  readonly schema_version: "bcv1-calibration-run-v1";
  readonly experiment_id: string;
  readonly phase: "CALIBRATION";
  readonly request: {
    readonly system_hash: string;
    readonly user_hash: string;
    readonly schema_hash: string;
    readonly model_config_hash: string;
    readonly model_facing_request_hash: string;
    readonly serialized_body: string;
    readonly body_bytes: number;
  };
  readonly trials: readonly CalibrationTrialRecord[];
  readonly aggregates: {
    readonly planned: number;
    readonly executed: number;
    readonly host_valid: number;
    readonly non_host_valid: number;
    readonly schema_invalid: number;
    readonly transport_failures: number;
    readonly realize_count: number;
    readonly clarify_count: number;
    readonly other_count: number;
    readonly truth_conflation_flags: number;
    readonly raw_api_attempts: number;
    readonly retries: number;
    readonly request_hash_unique_count: number;
    readonly model_id_unique_count: number;
    readonly config_hash_unique_count: number;
    readonly schema_hash_unique_count: number;
    readonly system_hash_unique_count: number;
    readonly user_hash_unique_count: number;
    readonly usage: TransportUsage;
  };
  readonly early_stopped: boolean;
  readonly pre_call_verifications: number;
  /** The logical trial a pre-call drift stop prevented from being sent, if any. */
  readonly stopped_before_trial: number | null;
  readonly stop_reason: string | null;
  readonly integrity: {
    readonly gates: CalibrationIntegrityGates;
    readonly request_hash_identity: boolean;
    readonly model_identity: boolean;
    readonly config_hash_identity: boolean;
    readonly schema_hash_identity: boolean;
    readonly system_hash_identity: boolean;
    readonly user_hash_identity: boolean;
    readonly retry_legality: boolean;
    readonly approved_prereg_sha: string;
    readonly manifest_prereg_sha: string;
    readonly current_head_before: string;
    readonly current_head_after: string;
    readonly tracked_tree_clean_before: boolean;
    readonly tracked_tree_clean_after: boolean;
    readonly frozen_request_hash: string;
    readonly runtime_request_hash: string;
    readonly design_rederivation_matches: Readonly<Record<string, boolean>>;
    readonly preflight: {
      readonly ok: boolean;
      readonly failures: readonly string[];
      readonly manifest_verification: { readonly ok: boolean; readonly detail: string };
      readonly write_surface: ExecutionPreflight["write_surface"];
      readonly v0_firewall: ExecutionPreflight["v0_firewall"];
      readonly secret_safety: ExecutionPreflight["secret_safety"];
      readonly formation_attestation: Readonly<Record<string, unknown>>;
    } | null;
  };
  readonly decision: CalibrationLawDecision;
}

function emptyUsage(): TransportUsage {
  return { prompt_tokens: 0, completion_tokens: 0, cached_tokens: 0, reasoning_tokens: 0, total_tokens: 0 };
}

function addUsage(left: TransportUsage, right: TransportUsage): TransportUsage {
  return {
    prompt_tokens: left.prompt_tokens + right.prompt_tokens,
    completion_tokens: left.completion_tokens + right.completion_tokens,
    total_tokens: left.total_tokens + right.total_tokens,
    cached_tokens: left.cached_tokens + right.cached_tokens,
    reasoning_tokens: left.reasoning_tokens + right.reasoning_tokens
  };
}

function uniqueCount(values: readonly string[]): number {
  return new Set(values).size;
}

export interface CalibrationScanResult {
  readonly flags: number;
  readonly paths_scanned: number;
}

/**
 * Runs the FROZEN classifier over the frozen scan surface only: the 12
 * model-authored semantic text paths declared by the preregistration.
 */
export function scanResponseForConflation(content: string, surface: readonly string[]): CalibrationScanResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return { flags: 0, paths_scanned: 0 };
  }
  const texts: string[] = [];
  for (const path of surface) {
    if (path === "factual_assessment.claims[*].text") {
      const claims = (parsed as { factual_assessment?: { claims?: readonly { text?: unknown }[] } }).factual_assessment?.claims ?? [];
      for (const claim of claims) if (typeof claim.text === "string") texts.push(claim.text);
      continue;
    }
    const segments = path.split(".");
    const arrayIndex = segments.findIndex((segment) => segment.endsWith("[*]"));
    if (arrayIndex >= 0) {
      const arrayKey = (segments[arrayIndex] as string).replace("[*]", "");
      const head = readPath(parsed, segments.slice(0, arrayIndex).concat(arrayKey));
      if (!Array.isArray(head)) continue;
      for (const entry of head) {
        const tail = segments.slice(arrayIndex + 1);
        const value = readPath(entry, tail);
        if (typeof value === "string") texts.push(value);
      }
      continue;
    }
    const value = readPath(parsed, segments);
    if (typeof value === "string") texts.push(value);
  }
  const result = classifyTruthConflation(texts.join("\n"));
  return { flags: result.conflation ? result.hits.length : 0, paths_scanned: texts.length };
}

function readPath(value: unknown, path: readonly string[]): unknown {
  let cursor: unknown = value;
  for (const key of path) {
    if (typeof cursor !== "object" || cursor === null) return undefined;
    cursor = (cursor as Record<string, unknown>)[key];
  }
  return cursor;
}

/** A retry is legal only when every attempt before the last carries a retryable class. */
function retryIsLegal(attempts: readonly { readonly body_hash: string; readonly failure_class: string }[], requestHash: string): boolean {
  const hashes = new Set(attempts.map((attempt) => attempt.body_hash));
  if (hashes.size !== 1 || !hashes.has(requestHash)) return false;
  return attempts.slice(0, -1).every((attempt) => isRetryableFailureClass(attempt.failure_class as never));
}

function stoppedResult(input: {
  readonly scheduled: number;
  readonly authority: CalibrationAuthority;
  readonly preflight: ExecutionPreflight | null;
  readonly failures: readonly string[];
  readonly reason: string;
  readonly stoppedBeforeTrial: number | null;
  readonly executedTrials: number;
}): CalibrationRunResult {
  const binding = input.authority.frozenRequestBinding();
  const gates: CalibrationIntegrityGates = {
    PREREG_SHA_MATCH: false,
    MANIFEST_VALID: input.preflight?.manifest_verification.ok === true,
    DESIGN_REDERIVATION: input.preflight?.design_rederivation.all_match === true,
    TRACKED_TREE_CLEAN: false,
    REQUEST_HASH_IDENTITY: false,
    MODEL_IDENTITY: false,
    CONFIG_HASH_IDENTITY: false,
    SCHEMA_HASH_IDENTITY: false,
    SYSTEM_HASH_IDENTITY: false,
    USER_HASH_IDENTITY: false,
    RETRY_LEGALITY: false,
    SECRET_SAFETY: input.preflight?.secret_safety.ok === true,
    NO_PRODUCTION_WRITE: input.preflight?.write_surface.passed === true,
    NO_FORBIDDEN_PROVIDER: input.preflight?.v0_firewall.passed === true
  };
  return {
    schema_version: "bcv1-calibration-run-v1",
    experiment_id: "BELIEF_CAUSAL_CONFIRMATORY_STOCHASTIC_V1",
    phase: "CALIBRATION",
    request: {
      system_hash: binding.system_hash,
      user_hash: binding.user_hash,
      schema_hash: binding.schema_hash,
      model_config_hash: binding.model_config_hash,
      model_facing_request_hash: binding.model_facing_request_hash,
      serialized_body: "",
      body_bytes: 0
    },
    trials: [],
    aggregates: {
      planned: input.scheduled,
      executed: input.executedTrials,
      host_valid: 0,
      non_host_valid: 0,
      schema_invalid: 0,
      transport_failures: 0,
      realize_count: 0,
      clarify_count: 0,
      other_count: 0,
      truth_conflation_flags: 0,
      raw_api_attempts: 0,
      retries: 0,
      request_hash_unique_count: 0,
      model_id_unique_count: 0,
      config_hash_unique_count: 0,
      schema_hash_unique_count: 0,
      system_hash_unique_count: 0,
      user_hash_unique_count: 0,
      usage: emptyUsage()
    },
    early_stopped: false,
    pre_call_verifications: 0,
    stopped_before_trial: input.stoppedBeforeTrial,
    stop_reason: input.reason,
    integrity: {
      gates,
      request_hash_identity: false,
      model_identity: false,
      config_hash_identity: false,
      schema_hash_identity: false,
      system_hash_identity: false,
      user_hash_identity: false,
      retry_legality: false,
      approved_prereg_sha: input.authority.approved_prereg_sha,
      manifest_prereg_sha: String(input.authority.manifest()["preregistration_commit_sha"] ?? ""),
      current_head_before: input.preflight?.code_state.current_head ?? input.authority.currentHead(),
      current_head_after: input.authority.currentHead(),
      tracked_tree_clean_before: input.preflight?.code_state.tracked_tree_clean ?? false,
      tracked_tree_clean_after: input.authority.trackedTreeClean(),
      frozen_request_hash: binding.model_facing_request_hash,
      runtime_request_hash: "",
      design_rederivation_matches: input.preflight?.design_rederivation.matches ?? {},
      preflight: input.preflight === null
        ? null
        : {
            ok: input.preflight.ok,
            failures: input.failures,
            manifest_verification: input.preflight.manifest_verification,
            write_surface: input.preflight.write_surface,
            v0_firewall: input.preflight.v0_firewall,
            secret_safety: input.preflight.secret_safety,
            formation_attestation: input.preflight.design_rederivation.formation_attestation
          }
    },
    decision: {
      law_id: "CALIBRATION_RUN_STOP_LAW_V1",
      decision: "EXECUTOR_CALIBRATION_STOP",
      // The failed GATE IDs (machine-readable), while the raw failure codes stay
      // in `stop_reason` and in `integrity.preflight.failures`.
      failed_integrity_gates: Object.entries(gates)
        .filter(([, passed]) => !passed)
        .map(([id]) => id),
      detail: input.reason
    }
  };
}

/**
 * Runs the frozen calibration. Given a transport behaviour it is deterministic;
 * the only nondeterminism in the real run is the executor's own sampling.
 */
export async function runCalibration(
  input: CalibrationRunInput,
  options: { readonly scanSurface: readonly string[] }
): Promise<CalibrationRunResult> {
  const scheduled = input.maxTrials ?? CALIBRATION_SCHEDULED_LOGICAL_TRIALS;

  // ---- steps 1–9: the authority preflight, BEFORE any network call -----------
  const preflight = await verifyExecutionAuthority(input.authority);
  if (!preflight.ok) {
    return stoppedResult({
      scheduled,
      authority: input.authority,
      preflight,
      failures: preflight.failures,
      reason: `preflight refused the run before any network call: ${preflight.failures.join(", ")}`,
      stoppedBeforeTrial: 1,
      executedTrials: 0
    });
  }
  const binding = input.authority.frozenRequestBinding();

  const subject = await buildCalibrationSubject();
  const projection = await buildCalibrationProjection(subject);

  const trials: CalibrationTrialRecord[] = [];
  let nonHostValid = 0;
  let earlyStopped = false;
  let retryLegality = true;
  let realized = 0;
  let clarified = 0;
  let flags = 0;
  let usage = emptyUsage();
  let preCallVerifications = 0;
  let stoppedBeforeTrial: number | null = null;
  let stopReason: string | null = null;
  let runtimeRequestHash = "";
  /** Every pre-call drift code seen. A drift that STOPPED the run also fails its identity gate. */
  const driftFailures = new Set<string>();

  for (let logical = 1; logical <= scheduled; logical += 1) {
    // ---- per-trial PRE-CALL authority gate (M5/M6) ---------------------------
    const preCall = await verifyTrialPreCall(input.authority);
    preCallVerifications += 1;
    if (!preCall.ok) {
      for (const failure of preCall.failures) driftFailures.add(failure.split(":")[0] ?? failure);
      stoppedBeforeTrial = logical;
      stopReason = `pre-call drift detected before trial ${logical}: ${preCall.failures.join(", ")} (network calls stop at trial ${logical - 1})`;
      break;
    }
    const authoritative = preCall.request_binding.request;
    runtimeRequestHash = authoritative.request_hash;
    const outcome = await input.transport.complete(authoritative.serialized_body, authoritative.request_hash);
    const rawAttempts = outcome.attempts.length;
    const transportedBodyHash = outcome.attempts.at(-1)?.body_hash ?? authoritative.request_hash;
    if (rawAttempts > 1 && !retryIsLegal(outcome.attempts, authoritative.request_hash)) {
      retryLegality = false;
    }
    if (outcome.attempts.some((attempt) => attempt.body_hash !== authoritative.request_hash)) {
      retryLegality = false;
    }

    let hostValid = false;
    let hostInvalidReason: string | null = null;
    let schemaValid = false;
    let contentJsonValid = false;
    let directive: string | null = null;
    let transportFailure: string | null = null;
    let trialFlags = 0;
    let modelReported: string | null = null;
    let trialUsage = emptyUsage();
    let failureClass: string | null = null;

    if (!outcome.ok) {
      // Transport-class failures: HTTP status classes, timeouts, real network
      // errors, a non-JSON 200 envelope or an empty completion. Each is recorded
      // with its EXPLICIT class and never turned into a schema verdict.
      transportFailure = outcome.code;
      failureClass = outcome.failure_class;
      hostInvalidReason = `${outcome.code}:${outcome.failure_class}`;
    } else {
      modelReported = outcome.model;
      trialUsage = outcome.usage;
      const scan = scanResponseForConflation(outcome.content, options.scanSurface);
      trialFlags = scan.flags;
      try {
        JSON.parse(outcome.content);
        contentJsonValid = true;
      } catch {
        contentJsonValid = false;
      }
      // FRESH production provider per draw: real schema + factual + semantics validation.
      const provider = new ConversationCognitionProviderV8({
        complete: async () => ({ content: outcome.content, model: outcome.model })
      } as never);
      try {
        const proposal = await provider.propose(projection as never);
        schemaValid = true;
        contentJsonValid = true;
        directive = proposal.communication_directive.kind;
        hostValid = ALLOWED_DIRECTIVE_ATOMS.includes(directive);
        if (!hostValid) hostInvalidReason = `DIRECTIVE_NOT_IN_ALLOWED_ATOMS:${directive}`;
      } catch (error) {
        const rejectionCode = (error as { code?: string }).code ?? "HOST_VALIDATION_REJECTED";
        // `MODEL_SCHEMA_INVALID` means the production schema rejected the content;
        // any other rejection code is a HOST-authority rejection that happens
        // AFTER schema validation, and schema_valid records that distinction.
        schemaValid = rejectionCode !== "MODEL_SCHEMA_INVALID";
        hostInvalidReason = rejectionCode;
      }
    }

    trials.push({
      logical_trial: logical,
      trial_id: `CALIBRATION|${String(logical).padStart(3, "0")}`,
      host_valid: hostValid,
      host_invalid_reason: hostInvalidReason,
      schema_valid: schemaValid,
      content_json_valid: contentJsonValid,
      directive,
      truth_conflation_flags: trialFlags,
      raw_attempts: rawAttempts,
      transport_failure: transportFailure,
      transport_failure_class: failureClass,
      retry_attempted: rawAttempts > 1,
      usage: trialUsage,
      request_hash: authoritative.request_hash,
      transport_body_hash: transportedBodyHash,
      serialized_body_bytes: Buffer.byteLength(authoritative.serialized_body, "utf8"),
      system_hash: authoritative.hashes.system_hash,
      user_hash: authoritative.hashes.user_hash,
      schema_hash: authoritative.hashes.schema_hash,
      model_config_hash: authoritative.hashes.model_config_hash,
      model_reported: modelReported
    });
    flags += trialFlags;
    usage = addUsage(usage, trialUsage);
    if (directive === "REALIZE_CURRENT_INTENT") realized += 1;
    if (directive === "CLARIFY_MISSING_CONTEXT") clarified += 1;

    // ---- response-model drift: trial k is recorded, k+1 is never sent --------
    if (modelReported !== null && modelReported !== MODEL.id) {
      stoppedBeforeTrial = logical + 1;
      stopReason = `response model drift at trial ${logical}: provider reported ${modelReported} (frozen model ${MODEL.id}); no call is made for trial ${logical + 1} or later`;
      break;
    }

    if (!hostValid) {
      nonHostValid += 1;
      if (floorUnreachable(nonHostValid)) {
        earlyStopped = true;
        break;
      }
    }
  }

  const codeStateAfter = input.authority.codeState();
  const requestHashes = trials.map((trial) => trial.request_hash);
  const systemHashes = trials.map((trial) => trial.system_hash);
  const userHashes = trials.map((trial) => trial.user_hash);
  const schemaHashes = trials.map((trial) => trial.schema_hash);
  const configHashes = trials.map((trial) => trial.model_config_hash);
  const modelIds = trials.map((trial) => trial.model_reported ?? "none");
  const hostValidCount = trials.filter((trial) => trial.host_valid).length;
  const allEqual = (values: readonly string[], expected: string): boolean =>
    values.every((value) => value === expected);
  const requestHashIdentity = requestHashes.length > 0 && uniqueCount(requestHashes) === 1 && allEqual(requestHashes, binding.model_facing_request_hash);
  const modelIdentity = modelIds.length > 0 && uniqueCount(modelIds) === 1 && allEqual(modelIds, MODEL.id);
  const configHashIdentity = configHashes.length > 0 && uniqueCount(configHashes) === 1 && allEqual(configHashes, binding.model_config_hash);
  const schemaHashIdentity = schemaHashes.length > 0 && uniqueCount(schemaHashes) === 1 && allEqual(schemaHashes, binding.schema_hash);
  const systemHashIdentity = systemHashes.length > 0 && uniqueCount(systemHashes) === 1 && allEqual(systemHashes, binding.system_hash);
  const userHashIdentity = userHashes.length > 0 && uniqueCount(userHashes) === 1 && allEqual(userHashes, binding.user_hash);
  const codeStateStable = preflight.code_state.code_state === codeStateAfter;
  // A drift that stopped the run is a FAILED identity: the identity did not hold
  // for the scheduled run, whatever the executed prefix happened to contain.
  const drifted = (code: string): boolean => [...driftFailures].some((failure) => failure.startsWith(code));
  const gates: CalibrationIntegrityGates = {
    PREREG_SHA_MATCH:
      preflight.code_state.current_head === preflight.code_state.manifest_prereg_sha &&
      preflight.code_state.manifest_prereg_sha === preflight.code_state.approved_prereg_sha,
    MANIFEST_VALID: preflight.manifest_verification.ok,
    DESIGN_REDERIVATION: preflight.design_rederivation.all_match,
    TRACKED_TREE_CLEAN:
      preflight.code_state.tracked_tree_clean && input.authority.trackedTreeClean() && codeStateStable,
    REQUEST_HASH_IDENTITY: requestHashIdentity && !drifted("CALIBRATION_REQUEST_FROZEN_HASH_MISMATCH"),
    MODEL_IDENTITY: modelIdentity,
    CONFIG_HASH_IDENTITY: configHashIdentity && !drifted("CALIBRATION_MODEL_CONFIG_HASH_DRIFT"),
    SCHEMA_HASH_IDENTITY: schemaHashIdentity && !drifted("CALIBRATION_SCHEMA_HASH_DRIFT"),
    SYSTEM_HASH_IDENTITY: systemHashIdentity && !drifted("CALIBRATION_SYSTEM_HASH_DRIFT"),
    USER_HASH_IDENTITY: userHashIdentity && !drifted("CALIBRATION_USER_HASH_DRIFT"),
    RETRY_LEGALITY: retryLegality,
    SECRET_SAFETY: preflight.secret_safety.ok,
    NO_PRODUCTION_WRITE: preflight.write_surface.passed,
    NO_FORBIDDEN_PROVIDER: preflight.v0_firewall.passed
  };
  const decision = evaluateCalibrationLaw({
    scheduled_trials: scheduled,
    executed_trials: trials.length,
    host_valid_count: hostValidCount,
    non_host_valid_count: nonHostValid,
    integrity_gates: { ...gates },
    early_stopped: earlyStopped
  });

  return {
    schema_version: "bcv1-calibration-run-v1",
    experiment_id: "BELIEF_CAUSAL_CONFIRMATORY_STOCHASTIC_V1",
    phase: "CALIBRATION",
    request: {
      system_hash: binding.system_hash,
      user_hash: binding.user_hash,
      schema_hash: binding.schema_hash,
      model_config_hash: binding.model_config_hash,
      model_facing_request_hash: binding.model_facing_request_hash,
      serialized_body: preflight.request_binding.request.serialized_body,
      body_bytes: Buffer.byteLength(preflight.request_binding.request.serialized_body, "utf8")
    },
    trials,
    aggregates: {
      planned: scheduled,
      executed: trials.length,
      host_valid: hostValidCount,
      non_host_valid: nonHostValid,
      schema_invalid: trials.filter((trial) => !trial.schema_valid).length,
      transport_failures: trials.filter((trial) => trial.transport_failure !== null).length,
      realize_count: realized,
      clarify_count: clarified,
      other_count: trials.filter((trial) => !trial.host_valid).length,
      truth_conflation_flags: flags,
      raw_api_attempts: trials.reduce((total, trial) => total + trial.raw_attempts, 0),
      retries: trials.reduce((total, trial) => total + Math.max(0, trial.raw_attempts - 1), 0),
      request_hash_unique_count: uniqueCount(requestHashes),
      model_id_unique_count: uniqueCount(modelIds),
      config_hash_unique_count: uniqueCount(configHashes),
      schema_hash_unique_count: uniqueCount(schemaHashes),
      system_hash_unique_count: uniqueCount(systemHashes),
      user_hash_unique_count: uniqueCount(userHashes),
      usage
    },
    early_stopped: earlyStopped,
    pre_call_verifications: preCallVerifications,
    stopped_before_trial: stoppedBeforeTrial,
    stop_reason: stopReason,
    integrity: {
      gates,
      request_hash_identity: requestHashIdentity,
      model_identity: modelIdentity,
      config_hash_identity: configHashIdentity,
      schema_hash_identity: schemaHashIdentity,
      system_hash_identity: systemHashIdentity,
      user_hash_identity: userHashIdentity,
      retry_legality: retryLegality,
      approved_prereg_sha: input.authority.approved_prereg_sha,
      manifest_prereg_sha: preflight.code_state.manifest_prereg_sha,
      current_head_before: preflight.code_state.current_head,
      current_head_after: codeStateAfter.split(":")[0] ?? "",
      tracked_tree_clean_before: preflight.code_state.tracked_tree_clean,
      tracked_tree_clean_after: input.authority.trackedTreeClean(),
      frozen_request_hash: binding.model_facing_request_hash,
      runtime_request_hash: runtimeRequestHash,
      design_rederivation_matches: preflight.design_rederivation.matches,
      preflight: {
        ok: preflight.ok,
        failures: preflight.failures,
        manifest_verification: preflight.manifest_verification,
        write_surface: preflight.write_surface,
        v0_firewall: preflight.v0_firewall,
        secret_safety: preflight.secret_safety,
        formation_attestation: preflight.design_rederivation.formation_attestation
      }
    },
    decision
  };
}

export { hashJson, hashText };
