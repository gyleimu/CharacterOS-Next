/**
 * EXPLORATORY_EXECUTOR_SCHEMA_FAILURE_DIAGNOSTIC_V0 — bounded diagnostic runner.
 *
 * Runs at most `DIAGNOSTIC_MAX_MODEL_CALLS` calls and stops as soon as
 * `DIAGNOSTIC_TARGET_SCHEMA_INVALID_EXAMPLES` schema-invalid responses have been
 * captured. The stop rule was frozen in `contract.ts` before the first call and
 * is recorded verbatim in the artifact; it is never widened after seeing an
 * outcome.
 *
 * It cannot produce a RUN/STOP/REPLICATED verdict, it has no denominator, and it
 * writes nothing into the calibration evidence tree.
 */
import { MODEL } from "../belief-causal-confirmatory-stochastic-v1/contract.ts";

import {
  CALIBRATION_PREREG_SHA,
  CALIBRATION_RESULT_VERDICT,
  DIAGNOSTIC_ARTIFACT_SCHEMA_VERSION,
  DIAGNOSTIC_ID,
  DIAGNOSTIC_MARKERS,
  DIAGNOSTIC_MAX_MODEL_CALLS,
  DIAGNOSTIC_NAMESPACE,
  DIAGNOSTIC_STAGES,
  DIAGNOSTIC_STOP_RULE,
  DIAGNOSTIC_TARGET_SCHEMA_INVALID_EXAMPLES,
  FAILURE_TAXONOMY_IDS,
  FROZEN_MODEL_FACING_REQUEST_HASH,
  PRODUCTION_VALIDATOR_SURFACE_NOTE
} from "./contract.ts";
import { assertFrozenRequest, buildDiagnosticRequest, type DiagnosticRequestBinding } from "./frozen-request.ts";
import { classifyResponse, summarizeTaxonomy, type Classification, type TaxonomySummary } from "./taxonomy.ts";
import {
  DIAGNOSTIC_RETRY_LAW,
  type DiagnosticTransport,
  type DiagnosticTransportFailure,
  type DiagnosticTransportSuccess
} from "./diagnostic-transport.ts";
import { buildValidationTrace, type ValidationTrace } from "./validation-trace.ts";

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
  readonly calibration_reference: {
    readonly prereg_sha: string;
    readonly prior_result_verdict: string;
    readonly prior_authorization: "CONSUMED";
    readonly this_artifact_modifies_prior_result: false;
    readonly this_artifact_enters_prior_denominator: false;
    readonly reused_request_hash: string;
    readonly reused_request_bytes: number;
  };
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
    readonly byte_identical_to_calibration: boolean;
    readonly reconstructed_hashes: DiagnosticRequestBinding["reconstructed_hashes"];
  };
  readonly responses: readonly DiagnosticTrialRecord[];
  readonly summary: {
    readonly model_calls: number;
    readonly total_responses: number;
    readonly request_hash_unique_count: number;
    readonly schema_valid: number;
    readonly schema_invalid: number;
    readonly host_invalid: number;
    readonly transport_failures: number;
    readonly envelope_json_invalid: number;
    readonly content_json_invalid: number;
    readonly directive_counts: Readonly<Record<string, number>>;
    readonly model_identities: readonly string[];
    readonly reasoning_content_present_count: number;
    readonly taxonomy: TaxonomySummary;
    readonly stop_reason: string;
    readonly stopped_by: "TARGET_SCHEMA_INVALID_EXAMPLES_REACHED" | "BUDGET_EXHAUSTED" | "EXTERNAL_ABORT";
  };
  readonly limitations: readonly string[];
  readonly not_proven: readonly string[];
  readonly artifact_hash?: string;
}

export interface DiagnosticRunInput {
  readonly transport: DiagnosticTransport;
  readonly maxCalls?: number;
  readonly targetInvalidExamples?: number;
}

function trialId(index: number): string {
  return `${DIAGNOSTIC_NAMESPACE}|${String(index).padStart(3, "0")}`;
}

/**
 * Runs the bounded diagnostic. One call per logical draw, no retry of any
 * validation failure, hard stop at the frozen budget.
 */
export async function runDiagnostic(input: DiagnosticRunInput): Promise<DiagnosticRunResult> {
  const maxCalls = input.maxCalls ?? DIAGNOSTIC_MAX_MODEL_CALLS;
  const targetInvalid = input.targetInvalidExamples ?? DIAGNOSTIC_TARGET_SCHEMA_INVALID_EXAMPLES;

  // The request binding is checked ONCE before the first call: a diagnostic may
  // deepen observation, never alter the treatment.
  const binding = await buildDiagnosticRequest();
  assertFrozenRequest(binding);

  const responses: DiagnosticTrialRecord[] = [];
  let invalidExamples = 0;
  let stoppedBy: DiagnosticRunResult["summary"]["stopped_by"] = "BUDGET_EXHAUSTED";
  let stopReason = `budget exhausted after ${maxCalls} calls`;

  for (let index = 1; index <= maxCalls; index += 1) {
    const outcome = await input.transport.complete(binding.serialized_body);
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

    const lastAttempt = outcome.attempts.at(-1) ?? null;
    responses.push({
      trial_id: trialId(index),
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
      raw_envelope: success?.raw_envelope ?? null,
      raw_content: success?.content ?? null,
      reasoning_content_present: success?.reasoning_content_present ?? false,
      finish_reason: success?.finish_reason ?? null,
      content_json_valid: trace.STAGE_C_CONTENT_JSON === "PASS",
      schema_valid: trace.STAGE_D_PRODUCTION_SCHEMA === "PASS" && trace.STAGE_E_PRODUCTION_HOST_AUTHORITY === "PASS",
      host_valid: trace.STAGE_D_PRODUCTION_SCHEMA === "PASS" && trace.STAGE_E_PRODUCTION_HOST_AUTHORITY === "PASS" && trace.STAGE_F_DIRECTIVE_ADMISSIBILITY !== "FAIL",
      directive: trace.stage_details.directive_admissibility.directive,
      usage: success?.usage ?? null,
      validation_trace: trace,
      classification
    });

    if (classification.classification === "SCHEMA_CONTRACT_VIOLATION") invalidExamples += 1;
    if (invalidExamples >= targetInvalid) {
      stoppedBy = "TARGET_SCHEMA_INVALID_EXAMPLES_REACHED";
      stopReason = `${invalidExamples} schema-invalid examples captured (target ${targetInvalid}) at call ${index} of a ${maxCalls}-call budget`;
      break;
    }
  }

  const modelIdentities = [...new Set(responses.map((record) => record.model_identity ?? "none"))].sort();
  const directiveCounts: Record<string, number> = {};
  for (const record of responses) {
    const key = record.directive ?? "NONE";
    directiveCounts[key] = (directiveCounts[key] ?? 0) + 1;
  }
  const schemaInvalid = responses.filter((record) => !record.schema_valid && record.transport_status.ok && record.content_json_valid).length;
  const hostInvalid = responses.filter(
    (record) => record.validation_trace.STAGE_E_PRODUCTION_HOST_AUTHORITY === "FAIL"
  ).length;

  return {
    schema_version: DIAGNOSTIC_ARTIFACT_SCHEMA_VERSION,
    diagnostic_id: DIAGNOSTIC_ID,
    namespace: DIAGNOSTIC_NAMESPACE,
    markers: DIAGNOSTIC_MARKERS,
    calibration_reference: {
      prereg_sha: CALIBRATION_PREREG_SHA,
      prior_result_verdict: CALIBRATION_RESULT_VERDICT,
      prior_authorization: "CONSUMED",
      this_artifact_modifies_prior_result: false,
      this_artifact_enters_prior_denominator: false,
      reused_request_hash: FROZEN_MODEL_FACING_REQUEST_HASH,
      reused_request_bytes: binding.body_bytes
    },
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
      byte_identical_to_calibration: binding.byte_identical_to_calibration,
      reconstructed_hashes: binding.reconstructed_hashes
    },
    responses,
    summary: {
      model_calls: responses.length,
      total_responses: responses.length,
      request_hash_unique_count: new Set(responses.map((record) => record.request_hash)).size,
      schema_valid: responses.filter((record) => record.schema_valid).length,
      schema_invalid: schemaInvalid,
      host_invalid: hostInvalid,
      transport_failures: responses.filter((record) => !record.transport_status.ok).length,
      envelope_json_invalid: responses.filter((record) => record.validation_trace.STAGE_B_ENVELOPE_JSON === "FAIL").length,
      content_json_invalid: responses.filter((record) => record.validation_trace.STAGE_C_CONTENT_JSON === "FAIL").length,
      directive_counts: directiveCounts,
      model_identities: modelIdentities,
      reasoning_content_present_count: responses.filter((record) => record.reasoning_content_present).length,
      taxonomy: summarizeTaxonomy(
        responses.map((record, index) => ({ trial: index + 1, classification: record.classification })),
        FAILURE_TAXONOMY_IDS
      ),
      stop_reason: stopReason,
      stopped_by: stoppedBy
    },
    limitations: [
      "EXPLORATORY and NON-CONFIRMATORY: this investigation characterizes a failure mechanism. It is not a calibration, not a re-run of the consumed calibration, and it enters no denominator.",
      "It cannot yield a run/stop decision or any causal claim, and it is not evidence for or against the primary hypothesis.",
      "The sample is bounded by a pre-written budget, so observed category COUNTS are characterization data, not rates: no proportion, interval or p-value may be computed from them.",
      "The request is the frozen EMPTY-genesis calibration request: findings may not transfer to projection-bearing A/B/C/D scenes.",
      PRODUCTION_VALIDATOR_SURFACE_NOTE,
      "Stage D/E are a mechanical projection of the production pipeline's single contract call using the provider's own classification rule; the recorded production verdict is the ground truth for each trial."
    ],
    not_proven: [
      "Why the executor produced a given invalid response (no root-cause claim is made here).",
      "Whether the failure frequency generalizes beyond this frozen request and this executor configuration.",
      "Whether any fix would change the behaviour: no fix is applied or proposed in this slice."
    ]
  };
}

/** The artifact hash law: sha256 of the canonical core without `artifact_hash`. */
export function diagnosticArtifactCore(result: DiagnosticRunResult): Record<string, unknown> {
  const { artifact_hash: _ignored, ...core } = result;
  void _ignored;
  return core as unknown as Record<string, unknown>;
}
