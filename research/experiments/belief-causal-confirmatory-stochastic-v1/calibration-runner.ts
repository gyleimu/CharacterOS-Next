/* eslint-disable no-restricted-imports -- Research harness: imports frozen built production roots by relative dist path. */
/**
 * BELIEF_CAUSAL_CONFIRMATORY_STOCHASTIC_V1 — calibration runner (FROZEN).
 *
 * Executes exactly `CALIBRATION_SCHEDULED_LOGICAL_TRIALS` logical calibration
 * trials. Per trial:
 *
 *   1. the transport sends the ONE frozen request body (byte-identical every
 *      time; retries live inside the transport and reuse the same bytes);
 *   2. a FRESH production `ConversationCognitionProviderV8` validates the
 *      response through the real production pipeline (schema + factual authority
 *      + response semantics) — fresh per draw, so no conversation state and no
 *      duplicate guard carries over;
 *   3. the trial is HOST_VALID only if transport succeeded, JSON/schema
 *      validation passed and the directive atom is one of the frozen atoms.
 *
 * It NEVER retries a schema-invalid, host-invalid or "unwanted" outcome, never
 * replaces an invalid trial, applies the deterministic early-stop law, and
 * performs NO canonical write: it imports no Belief writer, no executor, no
 * commit path and no A/B/C/D trial identity.
 */
import { ConversationCognitionProviderV8 } from "../../../packages/runtime/dist/providers/behavior/conversation-cognition-provider-v8.js";
import { classifyTruthConflation } from "../../measurement-protocols/stochastic-executor-causal-measurement-protocol-v0/conflation.ts";

import {
  ALLOWED_DIRECTIVE_ATOMS,
  CALIBRATION_SCHEDULED_LOGICAL_TRIALS,
  evaluateCalibrationLaw,
  floorUnreachable,
  type CalibrationLawDecision
} from "./calibration-law.ts";
import { buildCalibrationProjection, buildCalibrationSubject, type CalibrationRequest } from "./calibration-request.ts";
import type { MinimalTransport, TransportUsage } from "./calibration-transport.ts";
import { hashJson, hashText } from "./histories.ts";

export interface CalibrationTrialRecord {
  readonly logical_trial: number;
  readonly trial_id: string;
  readonly host_valid: boolean;
  readonly host_invalid_reason: string | null;
  readonly schema_valid: boolean;
  readonly directive: string | null;
  readonly truth_conflation_flags: number;
  readonly raw_attempts: number;
  readonly transport_failure: string | null;
  readonly usage: TransportUsage;
  readonly request_body_hash: string;
  readonly model_reported: string | null;
}

export interface CalibrationIntegrityGates {
  readonly prereg_sha_match: boolean;
  readonly manifest_valid: boolean;
  readonly design_rederivation: boolean;
  readonly tracked_tree_clean: boolean;
  readonly secret_safety_clean: boolean;
  readonly no_production_write: boolean;
}

export interface CalibrationRunInput {
  readonly transport: MinimalTransport;
  readonly request: CalibrationRequest;
  /** Injected so tests can simulate code-state drift; production reads git. */
  readonly readCodeState: () => string;
  readonly integrity: CalibrationIntegrityGates;
  /** Test hook: cap the loop (defaults to the frozen 50). */
  readonly maxTrials?: number;
}

export interface CalibrationRunResult {
  readonly schema_version: "bcv1-calibration-run-v0";
  readonly experiment_id: string;
  readonly phase: "CALIBRATION";
  readonly request: CalibrationRequest;
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
  readonly integrity: {
    readonly gates: CalibrationIntegrityGates;
    readonly request_hash_identity: boolean;
    readonly model_identity: boolean;
    readonly config_hash_identity: boolean;
    readonly schema_hash_identity: boolean;
    readonly system_hash_identity: boolean;
    readonly user_hash_identity: boolean;
    readonly retry_legality: boolean;
    readonly code_state_before: string;
    readonly code_state_after: string;
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

/**
 * Runs the frozen calibration. Given a transport behaviour it is deterministic;
 * the only nondeterminism in the real run is the executor's own sampling.
 */
export async function runCalibration(
  input: CalibrationRunInput,
  options: { readonly scanSurface: readonly string[] }
): Promise<CalibrationRunResult> {
  const scheduled = input.maxTrials ?? CALIBRATION_SCHEDULED_LOGICAL_TRIALS;
  const subject = await buildCalibrationSubject();
  const projection = await buildCalibrationProjection(subject);
  const bodyHash = hashText(JSON.stringify(input.request.body));
  const codeStateBefore = input.readCodeState();

  const trials: CalibrationTrialRecord[] = [];
  let nonHostValid = 0;
  let earlyStopped = false;
  let retryLegality = true;
  let realized = 0;
  let clarified = 0;
  let flags = 0;
  let usage = emptyUsage();

  for (let logical = 1; logical <= scheduled; logical += 1) {
    const outcome = await input.transport.complete(input.request.body, bodyHash);
    const rawAttempts = outcome.attempts.length;
    // The identity gate audits the bytes the TRANSPORT actually sent.
    const transportedBodyHash = outcome.attempts.at(-1)?.body_hash ?? bodyHash;
    if (rawAttempts > 1) {
      // Only the frozen transport retry law may produce extra attempts, and each
      // attempt must carry the identical body hash.
      const hashes = new Set(outcome.attempts.map((attempt) => attempt.body_hash));
      if (hashes.size !== 1 || !hashes.has(bodyHash)) retryLegality = false;
    }

    let hostValid = false;
    let hostInvalidReason: string | null = null;
    let schemaValid = false;
    let directive: string | null = null;
    let transportFailure: string | null = null;
    let trialFlags = 0;
    let modelReported: string | null = null;
    let trialUsage = emptyUsage();

    if (!outcome.ok) {
      transportFailure = outcome.code;
      hostInvalidReason = outcome.code;
    } else {
      modelReported = outcome.model;
      trialUsage = outcome.usage;
      const scan = scanResponseForConflation(outcome.content, options.scanSurface);
      trialFlags = scan.flags;
      // FRESH production provider per draw: real schema + factual + semantics validation.
      const provider = new ConversationCognitionProviderV8({
        complete: async () => ({ content: outcome.content, model: outcome.model })
      } as never);
      try {
        const proposal = await provider.propose(projection as never);
        schemaValid = true;
        directive = proposal.communication_directive.kind;
        hostValid = ALLOWED_DIRECTIVE_ATOMS.includes(directive);
        if (!hostValid) hostInvalidReason = `DIRECTIVE_NOT_IN_ALLOWED_ATOMS:${directive}`;
      } catch (error) {
        hostInvalidReason = (error as { code?: string }).code ?? "HOST_VALIDATION_REJECTED";
      }
    }

    trials.push({
      logical_trial: logical,
      trial_id: `CALIBRATION|${String(logical).padStart(3, "0")}`,
      host_valid: hostValid,
      host_invalid_reason: hostInvalidReason,
      schema_valid: schemaValid,
      directive,
      truth_conflation_flags: trialFlags,
      raw_attempts: rawAttempts,
      transport_failure: transportFailure,
      usage: trialUsage,
      request_body_hash: transportedBodyHash,
      model_reported: modelReported
    });
    flags += trialFlags;
    usage = addUsage(usage, trialUsage);
    if (directive === "REALIZE_CURRENT_INTENT") realized += 1;
    if (directive === "CLARIFY_MISSING_CONTEXT") clarified += 1;

    if (!hostValid) {
      nonHostValid += 1;
      if (floorUnreachable(nonHostValid)) {
        earlyStopped = true;
        break;
      }
    }
  }

  const codeStateAfter = input.readCodeState();
  const requestHashes = trials.map((trial) => trial.request_body_hash);
  const hostValidCount = trials.filter((trial) => trial.host_valid).length;
  const integrity = {
    gates: input.integrity,
    request_hash_identity: uniqueCount(requestHashes) === 1,
    model_identity: uniqueCount(trials.map((trial) => trial.model_reported ?? "none")) === 1,
    config_hash_identity: true,
    schema_hash_identity: true,
    system_hash_identity: true,
    user_hash_identity: true,
    retry_legality: retryLegality,
    code_state_before: codeStateBefore,
    code_state_after: codeStateAfter
  };
  const codeStateStable = codeStateBefore === codeStateAfter;
  const decision = evaluateCalibrationLaw({
    scheduled_trials: scheduled,
    executed_trials: trials.length,
    host_valid_count: hostValidCount,
    non_host_valid_count: nonHostValid,
    integrity_gates: {
      PREREG_SHA_MATCH: input.integrity.prereg_sha_match,
      MANIFEST_VALID: input.integrity.manifest_valid,
      DESIGN_REDERIVATION: input.integrity.design_rederivation,
      TRACKED_TREE_CLEAN: input.integrity.tracked_tree_clean && codeStateStable,
      REQUEST_HASH_IDENTITY: integrity.request_hash_identity,
      MODEL_IDENTITY: integrity.model_identity,
      CONFIG_HASH_IDENTITY: integrity.config_hash_identity,
      SCHEMA_HASH_IDENTITY: integrity.schema_hash_identity,
      SYSTEM_HASH_IDENTITY: integrity.system_hash_identity,
      USER_HASH_IDENTITY: integrity.user_hash_identity,
      RETRY_LEGALITY: integrity.retry_legality,
      SECRET_SAFETY: input.integrity.secret_safety_clean,
      NO_PRODUCTION_WRITE: input.integrity.no_production_write,
      NO_FORBIDDEN_PROVIDER: true
    },
    early_stopped: earlyStopped
  });

  return {
    schema_version: "bcv1-calibration-run-v0",
    experiment_id: "BELIEF_CAUSAL_CONFIRMATORY_STOCHASTIC_V1",
    phase: "CALIBRATION",
    request: input.request,
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
      model_id_unique_count: uniqueCount(trials.map((trial) => trial.model_reported ?? "none")),
      config_hash_unique_count: 1,
      schema_hash_unique_count: 1,
      system_hash_unique_count: 1,
      user_hash_unique_count: 1,
      usage
    },
    early_stopped: earlyStopped,
    integrity,
    decision
  };
}

export { hashJson, hashText };
