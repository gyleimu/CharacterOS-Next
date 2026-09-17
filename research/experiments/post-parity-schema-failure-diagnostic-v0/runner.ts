/**
 * POST_PARITY_SCHEMA_FAILURE_DIAGNOSTIC — request binding + bounded runner.
 *
 * REUSE-FIRST: the transport, the six-stage validation trace and the
 * evidence-derived taxonomy are imported UNCHANGED from the previously audited
 * diagnostic instrumentation (commit e1dbc31 / 561032f). Nothing there is edited
 * and its frozen artifacts are untouched. This module adds only what the new
 * question needs: the post-parity request binding, the new namespace/markers and
 * the pre-written 40-call / 2-example stop rule.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { buildCalibrationProjection, buildCalibrationSubject } from "../belief-causal-confirmatory-stochastic-v1/calibration-request.ts";
import { MODEL } from "../belief-causal-confirmatory-stochastic-v1/contract.ts";
import {
  DIAGNOSTIC_RETRY_LAW,
  type DiagnosticTransport,
  type DiagnosticTransportFailure,
  type DiagnosticTransportSuccess
} from "../executor-schema-failure-diagnostic-v0/diagnostic-transport.ts";
import { classifyResponse, summarizeTaxonomy, type Classification, type TaxonomySummary } from "../executor-schema-failure-diagnostic-v0/taxonomy.ts";
import { buildValidationTrace, type ValidationTrace } from "../executor-schema-failure-diagnostic-v0/validation-trace.ts";

import {
  DIAGNOSTIC_ARTIFACT_SCHEMA_VERSION,
  DIAGNOSTIC_ID,
  DIAGNOSTIC_MARKERS,
  DIAGNOSTIC_NAMESPACE,
  DIAGNOSTIC_STAGES,
  DIAGNOSTIC_STOP_RULE,
  FAILURE_TAXONOMY_DECLARED_BEFORE_CALLS,
  MAX_CALLS,
  POST_PARITY_AUTHORITY,
  PRODUCTION_VALIDATOR_SURFACE_NOTE,
  TARGET_SCHEMA_INVALID_EXAMPLES
} from "./contract.ts";
import { hashJson, hashText } from "./hash.ts";

export interface PostParityRequestBinding {
  readonly serialized_body: string;
  readonly request_hash: string;
  readonly body_bytes: number;
  readonly projection: unknown;
  readonly reconstructed_hashes: {
    readonly system_hash: string;
    readonly user_hash: string;
    readonly schema_hash: string;
    readonly model_config_hash: string;
  };
  readonly byte_identical_to_post_parity_calibration: boolean;
  readonly divergences: readonly string[];
}

export class PostParityRequestMismatchError extends Error {
  readonly code = "POST_PARITY_REQUEST_BINDING_MISMATCH";
}

/**
 * Rebuilds the post-parity calibration request through the SAME production
 * rendering path and refuses any divergence from the approved authority. The
 * diagnostic may deepen observation; it may not alter the treatment, and it may
 * not add any prompt hint, few-shot example or repair instruction.
 */
export async function buildPostParityRequest(input?: {
  readonly schemaHash: string;
  readonly modelConfigHash: string;
}): Promise<PostParityRequestBinding> {
  const subject = await buildCalibrationSubject();
  const projection = await buildCalibrationProjection(subject);
  const { buildCalibrationRequest, serializeAuthoritativeRequest } = await import(
    "../belief-causal-confirmatory-stochastic-v1/calibration-request.ts"
  );
  const request = await buildCalibrationRequest({
    schemaHash: input?.schemaHash ?? "",
    modelConfigHash: input?.modelConfigHash ?? "",
    subject
  });
  const serialized = serializeAuthoritativeRequest(request.body);
  const requestHash = hashText(serialized);
  const bodyBytes = Buffer.byteLength(serialized, "utf8");
  const divergences: string[] = [];
  if (requestHash !== POST_PARITY_AUTHORITY.request_hash) divergences.push("REQUEST_HASH_DIVERGENCE");
  if (bodyBytes !== POST_PARITY_AUTHORITY.request_bytes) divergences.push("REQUEST_BYTES_DIVERGENCE");
  if (request.hashes.system_hash !== POST_PARITY_AUTHORITY.system_hash) divergences.push("SYSTEM_HASH_DIVERGENCE");
  if (request.hashes.user_hash !== POST_PARITY_AUTHORITY.user_hash) divergences.push("USER_HASH_DIVERGENCE");
  return {
    serialized_body: serialized,
    request_hash: requestHash,
    body_bytes: bodyBytes,
    projection,
    reconstructed_hashes: request.hashes,
    byte_identical_to_post_parity_calibration: divergences.length === 0,
    divergences
  };
}

export function assertPostParityRequest(binding: PostParityRequestBinding): void {
  if (binding.divergences.length > 0) {
    throw new PostParityRequestMismatchError(
      `post-parity request diverged from the approved authority: ${binding.divergences.join(", ")}`
    );
  }
}

/**
 * The raw envelope is retained for offline analysis, but the reasoning trace is
 * NOT: the model's private reasoning body is stripped from the stored envelope
 * (only its presence is recorded), so no artifact can carry it forward into any
 * later request, state or score.
 */
export function stripReasoningContent(rawEnvelope: string): { readonly envelope: string; readonly stripped: boolean } {
  try {
    const parsed = JSON.parse(rawEnvelope) as { choices?: readonly { message?: Record<string, unknown> }[] };
    let stripped = false;
    for (const choice of parsed.choices ?? []) {
      if (choice.message !== undefined && Object.prototype.hasOwnProperty.call(choice.message, "reasoning_content")) {
        choice.message["reasoning_content"] = "<stripped:reasoning_content>";
        stripped = true;
      }
    }
    return { envelope: stripped ? JSON.stringify(parsed) : rawEnvelope, stripped };
  } catch {
    return { envelope: rawEnvelope, stripped: false };
  }
}

export interface DiagnosticTrialRecord {
  readonly trial_id: string;
  readonly namespace: typeof DIAGNOSTIC_NAMESPACE;
  readonly request_hash: string;
  readonly request_bytes: number;
  readonly model_identity: string | null;
  readonly transport_status: {
    readonly ok: boolean;
    readonly code: string | null;
    readonly failure_class: string | null;
    readonly http_status: number | null;
    readonly raw_attempts: number;
    readonly retried: boolean;
    readonly attempts: readonly {
      readonly attempt: number;
      readonly http_status: number | null;
      readonly failure_class: string;
      readonly envelope_bytes: number;
    }[];
  };
  readonly raw_envelope: string | null;
  readonly raw_content: string | null;
  readonly reasoning_content_present: boolean;
  readonly reasoning_content_stripped_from_artifact: boolean;
  readonly finish_reason: string | null;
  readonly content_json_valid: boolean;
  readonly schema_valid: boolean;
  readonly host_valid: boolean;
  readonly directive: string | null;
  readonly usage: DiagnosticTransportSuccess["usage"] | null;
  readonly validation_trace: ValidationTrace;
  readonly classification: Classification;
}

export interface DiagnosticRunResult {
  readonly schema_version: typeof DIAGNOSTIC_ARTIFACT_SCHEMA_VERSION;
  readonly diagnostic_id: typeof DIAGNOSTIC_ID;
  readonly namespace: typeof DIAGNOSTIC_NAMESPACE;
  readonly markers: typeof DIAGNOSTIC_MARKERS;
  readonly authority_reference: typeof POST_PARITY_AUTHORITY;
  readonly stop_rule: typeof DIAGNOSTIC_STOP_RULE;
  readonly stop_rule_evaluated_before_first_call: true;
  readonly stages: readonly string[];
  readonly retry_law: typeof DIAGNOSTIC_RETRY_LAW;
  readonly model: {
    readonly provider: string;
    readonly id: string;
    readonly base_url: string;
    readonly temperature: number;
    readonly max_tokens: number;
    readonly stream: boolean;
    readonly timeout_ms: number;
    readonly response_format: string;
    readonly fallbacks: readonly string[];
  };
  readonly request_binding: {
    readonly serialized_body_bytes: number;
    readonly request_hash: string;
    readonly byte_identical_to_post_parity_calibration: boolean;
    readonly divergences: readonly string[];
  };
  readonly responses: readonly DiagnosticTrialRecord[];
  readonly summary: {
    readonly model_calls: number;
    readonly logical_executed: number;
    readonly raw_http_attempts: number;
    readonly retries: number;
    readonly request_hash_unique_count: number;
    readonly schema_valid: number;
    readonly schema_invalid: number;
    readonly host_invalid: number;
    readonly transport_failures: number;
    readonly envelope_json_invalid: number;
    readonly content_json_invalid: number;
    readonly directive_counts: Readonly<Record<string, number>>;
    readonly model_identities: readonly string[];
    readonly model_drift: boolean;
    readonly reasoning_content_present_count: number;
    readonly taxonomy: TaxonomySummary;
    readonly token_usage: DiagnosticTransportSuccess["usage"];
    readonly stop_reason: string;
    readonly stopped_by: "TARGET_SCHEMA_INVALID_EXAMPLES_REACHED" | "MAX_CALL_BUDGET_REACHED";
  };
  readonly limitations: readonly string[];
  readonly not_proven: readonly string[];
  readonly artifact_hash?: string;
}

function addUsage(
  left: DiagnosticTransportSuccess["usage"],
  right: DiagnosticTransportSuccess["usage"]
): DiagnosticTransportSuccess["usage"] {
  return {
    prompt_tokens: left.prompt_tokens + right.prompt_tokens,
    completion_tokens: left.completion_tokens + right.completion_tokens,
    total_tokens: left.total_tokens + right.total_tokens,
    cached_tokens: left.cached_tokens + right.cached_tokens,
    reasoning_tokens: left.reasoning_tokens + right.reasoning_tokens
  };
}

const EMPTY_USAGE = Object.freeze({
  prompt_tokens: 0,
  completion_tokens: 0,
  total_tokens: 0,
  cached_tokens: 0,
  reasoning_tokens: 0
});

/**
 * Applies the CURRENT evidence-derived taxonomy to an ALREADY CAPTURED artifact:
 * zero calls, the stored validation traces are the input, and the original
 * artifact is left untouched so a reviewer can diff the two. Used only to refine
 * the mechanical mapping of a rule the vocabulary already declared.
 */
export function reclassifyPostParityArtifact(input: {
  readonly artifact: DiagnosticRunResult & { readonly artifact_hash?: string };
  readonly declaredTaxonomy: readonly string[];
}): Record<string, unknown> {
  const responses = input.artifact.responses.map((record) => ({
    ...record,
    classification: classifyResponse(record.validation_trace)
  }));
  return {
    schema_version: input.artifact.schema_version,
    diagnostic_id: input.artifact.diagnostic_id,
    namespace: input.artifact.namespace,
    markers: input.artifact.markers,
    derived_from_artifact_hash: input.artifact.artifact_hash ?? null,
    reclassification: {
      makes_model_calls: false,
      input_is_the_stored_artifact: true,
      original_artifact_left_unmodified: true,
      stop_rule_unchanged: true,
      why:
        "the mechanical production-string mapping was refined to recognise an already-declared category (TYPE_INVALID) that the earlier pattern missed; no call, no budget change and no new category",
      declared_taxonomy: input.declaredTaxonomy
    },
    authority_reference: input.artifact.authority_reference,
    stop_rule: input.artifact.stop_rule,
    request_binding: input.artifact.request_binding,
    model: input.artifact.model,
    responses,
    summary: {
      ...input.artifact.summary,
      taxonomy: summarizeTaxonomy(
        responses.map((record, index) => ({ trial: index + 1, classification: record.classification })),
        input.declaredTaxonomy
      )
    }
  };
}

/** Reads a stored artifact, reclassifies it offline and writes the derived artifact. */
export function reclassifyPostParityFile(input: {
  readonly inPath: string;
  readonly outPath: string;
  readonly declaredTaxonomy: readonly string[];
}): { readonly derived_hash: string; readonly responses: number; readonly categories_observed: readonly string[] } {
  const stored = JSON.parse(readFileSync(input.inPath, "utf8")) as DiagnosticRunResult & { readonly artifact_hash?: string };
  const derived = reclassifyPostParityArtifact({ artifact: stored, declaredTaxonomy: input.declaredTaxonomy });
  const derivedHash = hashJson(derived);
  mkdirSync(dirname(input.outPath), { recursive: true });
  writeFileSync(input.outPath, `${JSON.stringify({ ...derived, derived_artifact_hash: derivedHash }, null, 2)}\n`);
  const summary = derived["summary"] as { readonly taxonomy: { readonly categories_observed: readonly string[] } };
  return { derived_hash: derivedHash, responses: stored.responses.length, categories_observed: summary.taxonomy.categories_observed };
}

export interface DiagnosticRunOptions {
  readonly transport: DiagnosticTransport;
  readonly maxCalls?: number | undefined;
  readonly targetInvalidExamples?: number | undefined;
}

/**
 * Runs the bounded diagnostic: at most MAX_CALLS provider calls, stopping as soon
 * as TARGET_SCHEMA_INVALID_EXAMPLES schema-invalid responses have been captured.
 */
export async function runPostParityDiagnostic(options: DiagnosticRunOptions): Promise<DiagnosticRunResult> {
  const maxCalls = Math.min(options.maxCalls ?? MAX_CALLS, MAX_CALLS);
  const target = options.targetInvalidExamples ?? TARGET_SCHEMA_INVALID_EXAMPLES;
  const binding = await buildPostParityRequest();
  assertPostParityRequest(binding);

  const responses: DiagnosticTrialRecord[] = [];
  let invalidExamples = 0;
  let stopReason = `maximum call budget reached (${maxCalls} calls)`;
  let stoppedBy: DiagnosticRunResult["summary"]["stopped_by"] = "MAX_CALL_BUDGET_REACHED";

  for (let index = 1; index <= maxCalls; index += 1) {
    const outcome = await options.transport.complete(binding.serialized_body);
    const success: DiagnosticTransportSuccess | null = outcome.ok ? outcome : null;
    const failure: DiagnosticTransportFailure | null = outcome.ok ? null : outcome;
    const trace = await buildValidationTrace({
      transportStage: success === null ? "FAIL" : "PASS",
      transportDetail:
        failure === null
          ? { ok: true, model: success?.model ?? null }
          : { ok: false, code: failure.code, failure_class: failure.failure_class, detail: failure.detail },
      envelopeJsonValid: success?.envelope_json_valid ?? false,
      envelopeJsonError: success?.envelope_json_error ?? failure?.detail ?? null,
      envelopeKeys: success?.envelope_keys ?? [],
      content: success?.content ?? null,
      projection: binding.projection
    });
    const classification = classifyResponse(trace);
    const sanitized = success === null ? null : stripReasoningContent(success.raw_envelope);
    const lastAttempt = outcome.attempts.at(-1) ?? null;
    responses.push({
      trial_id: `${DIAGNOSTIC_NAMESPACE}|${String(index).padStart(3, "0")}`,
      namespace: DIAGNOSTIC_NAMESPACE,
      request_hash: binding.request_hash,
      request_bytes: binding.body_bytes,
      model_identity: success?.model ?? null,
      transport_status: {
        ok: success !== null,
        code: failure?.code ?? null,
        failure_class: failure?.failure_class ?? null,
        http_status: lastAttempt?.http_status ?? null,
        raw_attempts: outcome.attempts.length,
        retried: outcome.attempts.length > 1,
        attempts: outcome.attempts.map((attempt) => ({
          attempt: attempt.attempt,
          http_status: attempt.http_status,
          failure_class: attempt.failure_class,
          envelope_bytes: attempt.envelope_bytes
        }))
      },
      raw_envelope: sanitized?.envelope ?? null,
      raw_content: success?.content ?? null,
      reasoning_content_present: success?.reasoning_content_present ?? false,
      reasoning_content_stripped_from_artifact: sanitized?.stripped ?? false,
      finish_reason: success?.finish_reason ?? null,
      content_json_valid: trace.STAGE_C_CONTENT_JSON === "PASS",
      schema_valid: trace.STAGE_D_PRODUCTION_SCHEMA === "PASS" && trace.STAGE_E_PRODUCTION_HOST_AUTHORITY === "PASS",
      host_valid:
        trace.STAGE_D_PRODUCTION_SCHEMA === "PASS" &&
        trace.STAGE_E_PRODUCTION_HOST_AUTHORITY === "PASS" &&
        trace.STAGE_F_DIRECTIVE_ADMISSIBILITY !== "FAIL",
      directive: trace.stage_details.directive_admissibility.directive,
      usage: success?.usage ?? null,
      validation_trace: trace,
      classification
    });

    if (classification.classification === "SCHEMA_CONTRACT_VIOLATION") invalidExamples += 1;
    if (invalidExamples >= target) {
      stoppedBy = "TARGET_SCHEMA_INVALID_EXAMPLES_REACHED";
      stopReason = `${invalidExamples} schema-invalid examples captured (target ${target}) at call ${index} of a ${maxCalls}-call budget`;
      break;
    }
  }

  const directiveCounts: Record<string, number> = {};
  for (const record of responses) {
    const key = record.directive ?? "NONE";
    directiveCounts[key] = (directiveCounts[key] ?? 0) + 1;
  }
  const modelIdentities = [...new Set(responses.map((record) => record.model_identity ?? "none"))].sort();
  const schemaInvalid = responses.filter(
    (record) => !record.schema_valid && record.transport_status.ok && record.content_json_valid
  ).length;
  const hostInvalid = responses.filter(
    (record) => record.validation_trace.STAGE_E_PRODUCTION_HOST_AUTHORITY === "FAIL"
  ).length;

  return {
    schema_version: DIAGNOSTIC_ARTIFACT_SCHEMA_VERSION,
    diagnostic_id: DIAGNOSTIC_ID,
    namespace: DIAGNOSTIC_NAMESPACE,
    markers: DIAGNOSTIC_MARKERS,
    authority_reference: POST_PARITY_AUTHORITY,
    stop_rule: DIAGNOSTIC_STOP_RULE,
    stop_rule_evaluated_before_first_call: true,
    stages: DIAGNOSTIC_STAGES,
    retry_law: DIAGNOSTIC_RETRY_LAW,
    model: {
      provider: MODEL.provider,
      id: MODEL.id,
      base_url: MODEL.base_url,
      temperature: MODEL.temperature,
      max_tokens: MODEL.max_tokens,
      stream: MODEL.stream,
      timeout_ms: MODEL.timeout_ms,
      response_format: MODEL.response_format,
      fallbacks: MODEL.fallbacks
    },
    request_binding: {
      serialized_body_bytes: binding.body_bytes,
      request_hash: binding.request_hash,
      byte_identical_to_post_parity_calibration: binding.byte_identical_to_post_parity_calibration,
      divergences: binding.divergences
    },
    responses,
    summary: {
      model_calls: responses.length,
      logical_executed: responses.length,
      raw_http_attempts: responses.reduce((total, record) => total + record.transport_status.raw_attempts, 0),
      retries: responses.reduce((total, record) => total + Math.max(0, record.transport_status.raw_attempts - 1), 0),
      request_hash_unique_count: new Set(responses.map((record) => record.request_hash)).size,
      schema_valid: responses.filter((record) => record.schema_valid).length,
      schema_invalid: schemaInvalid,
      host_invalid: hostInvalid,
      transport_failures: responses.filter((record) => !record.transport_status.ok).length,
      envelope_json_invalid: responses.filter((record) => record.validation_trace.STAGE_B_ENVELOPE_JSON === "FAIL").length,
      content_json_invalid: responses.filter((record) => record.validation_trace.STAGE_C_CONTENT_JSON === "FAIL").length,
      directive_counts: directiveCounts,
      model_identities: modelIdentities,
      model_drift: modelIdentities.filter((identity) => identity !== MODEL.id).length > 0,
      reasoning_content_present_count: responses.filter((record) => record.reasoning_content_present).length,
      taxonomy: summarizeTaxonomy(
        responses.map((record, index) => ({ trial: index + 1, classification: record.classification })),
        FAILURE_TAXONOMY_DECLARED_BEFORE_CALLS
      ),
      token_usage: responses.reduce<DiagnosticTransportSuccess["usage"]>(
        (total, record) => (record.usage === null ? total : addUsage(total, record.usage)),
        EMPTY_USAGE
      ),
      stop_reason: stopReason,
      stopped_by: stoppedBy
    },
    limitations: [
      "EXPLORATORY and NON-CONFIRMATORY: this characterizes a rejection MECHANISM under the post-parity contract. It is not a calibration, not a re-run of any calibration, and it enters no denominator.",
      "It makes no rate, probability or readiness claim, and it is not evidence for or against any causal hypothesis.",
      "The sample is bounded by a pre-written budget, so observed counts are characterization data only.",
      "The request is the frozen EMPTY-genesis post-parity calibration request: findings may not transfer to projection-bearing A/B/C/D scenes.",
      "The formal post-parity calibration's three rejections (trials 43/44/49) remain UNATTRIBUTED: that evidence records the rejection class only, and nothing captured here is retro-attributed to them.",
      "The stored provider envelope has the reasoning_content BODY stripped (only its presence is recorded): the model's private reasoning never enters an artifact, a later request, a state or a score.",
      PRODUCTION_VALIDATOR_SURFACE_NOTE
    ],
    not_proven: [
      "Whether the executor's behaviour generalizes beyond this frozen request and this executor configuration.",
      "Why any individual draw is rejected (the captured rule explains the rejection; it is not a root-cause model of the executor).",
      "Whether any change to the contract, the prompt or the executor would alter the outcome — no change is made or proposed here."
    ]
  };
}
