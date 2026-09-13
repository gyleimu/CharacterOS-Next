/* globals structuredClone */
/** Production-path runner with projection-level Affect interventions only. */

import { InteractiveSubjectRuntimeV0 } from '../../../../packages/runtime/dist/index.js';
import {
  conditionVariant,
  runtimeOptions,
  stubCognitionTransport,
  validLanguageStub
} from '../../phase-2-affect-authority-contract-revalidation-v0/lib/pipeline.mjs';
import {
  sha256,
  memorySection,
  subjectDataInvariantDigest
} from '../../phase-2-affect-causal-completion-v0/lib/hash.mjs';
import {
  assertNoExperimentalLabels,
  auditAffectVariant,
  verifyAbsentIsBaseMinusAffect
} from '../../phase-2-affect-causal-completion-v0/lib/ablation.mjs';

/** Capture the exact production-built request without a real model call. */
export async function captureBaseRequest(snapshot, scenario, sessionId) {
  const requests = [];
  const recorder = {
    complete: async (request) => {
      requests.push(structuredClone(request));
      return stubCognitionTransport().complete(request);
    }
  };
  const runtime = await InteractiveSubjectRuntimeV0.restore(
    runtimeOptions(recorder, sessionId, validLanguageStub()),
    structuredClone(snapshot)
  );
  const outcome = await runtime.submitUserText(scenario.event);
  if (outcome.status !== 'COMPLETE') throw new Error(`${scenario.id}: capture failed: ${outcome.failure}`);
  const request = requests.at(-1);
  if (request === undefined) throw new Error(`${scenario.id}: no cognition request captured`);
  const systemContent = request.messages.find((message) => message.role === 'system')?.content ?? '';
  const userContent = request.messages.find((message) => message.role === 'user')?.content ?? '';
  const projectionHash = /\[projection_hash\]\s+(\S+)/.exec(userContent)?.[1] ?? '';
  if (projectionHash === '') throw new Error(`${scenario.id}: projection_hash missing`);
  if (request.structured_output?.kind !== 'JSON_SCHEMA') {
    throw new Error(`${scenario.id}: production request lacks JSON Schema constraint`);
  }
  return {
    systemContent,
    userContent,
    projectionHash,
    structuredOutput: request.structured_output
  };
}

function attest(base, transformed, conditionId, removedIndices, replacement) {
  const audit = auditAffectVariant(base, transformed, removedIndices);
  const absent =
    conditionId === 'A'
      ? verifyAbsentIsBaseMinusAffect(base, transformed, removedIndices)
      : { ok: true, reasons: [] };
  const labels = assertNoExperimentalLabels(transformed);
  const invariantOk = subjectDataInvariantDigest(base) === subjectDataInvariantDigest(transformed);
  return {
    ok: audit.ok && absent.ok && labels.ok && invariantOk && memorySection(transformed) !== '',
    reasons: [...audit.reasons, ...absent.reasons, ...labels.found.map((token) => `label:${token}`)],
    base_sha256: sha256(base),
    variant_sha256: sha256(transformed),
    memory_section_sha256: sha256(memorySection(transformed)),
    invariant_digest: subjectDataInvariantDigest(transformed),
    affect_section: conditionId === 'A' ? [] : [replacement],
    differing_indices: audit.differing_indices,
    removed_indices: removedIndices
  };
}

export async function runCondition({
  snapshot,
  scenario,
  conditionId,
  realTransport,
  realLanguageTransport,
  sessionId
}) {
  const languageCalls = [];
  const languageRecorder = {
    complete: async (request) => {
      languageCalls.push({ request });
      return realLanguageTransport.complete(request);
    }
  };
  let attestation = null;
  const raw = {
    cognition_request: null,
    cognition_response: null,
    base_user_content: null,
    transformed_user_content: null
  };
  let cognitionCalls = 0;
  const interventionTransport = {
    complete: async (request) => {
      cognitionCalls += 1;
      const baseUser = request.messages.find((message) => message.role === 'user')?.content ?? '';
      if (conditionId === null) {
        raw.base_user_content = baseUser;
        raw.transformed_user_content = baseUser;
        raw.cognition_request = structuredClone(request);
        attestation = {
          scenario: scenario.id,
          condition: null,
          kind: 'LAWFUL_PASS_THROUGH',
          ok: true,
          reasons: [],
          base_sha256: sha256(baseUser),
          variant_sha256: sha256(baseUser),
          memory_section_sha256: sha256(memorySection(baseUser)),
          invariant_digest: subjectDataInvariantDigest(baseUser),
          affect_section: /^\[affect \(canonical\)\][^\n]*$/m.exec(baseUser)?.[0] ?? null,
          differing_indices: [],
          removed_indices: []
        };
        const response = await realTransport.complete(request);
        raw.cognition_response = response.content;
        return response;
      }
      const variant = conditionVariant(baseUser, conditionId);
      attestation = {
        scenario: scenario.id,
        condition: conditionId,
        ...attest(
          baseUser,
          variant.transformed,
          conditionId,
          variant.removedIndices ?? [],
          variant.replacement ?? null
        )
      };
      const forwarded = {
        ...request,
        messages: request.messages.map((message) =>
          message.role === 'user' ? { ...message, content: variant.transformed } : message
        )
      };
      raw.base_user_content = baseUser;
      raw.transformed_user_content = variant.transformed;
      raw.cognition_request = forwarded;
      const response = await realTransport.complete(forwarded);
      raw.cognition_response = response.content;
      return response;
    }
  };

  const runtime = await InteractiveSubjectRuntimeV0.restore(
    runtimeOptions(interventionTransport, sessionId, languageRecorder),
    structuredClone(snapshot)
  );
  const outcome = await runtime.submitUserText(scenario.event);
  const failure = outcome.status === 'COMPLETE' ? null : String(outcome.failure ?? '');
  let strictJsonValid = false;
  if (raw.cognition_response !== null) {
    try {
      strictJsonValid = JSON.parse(raw.cognition_response).schema_version === 'conversation-cognition-proposal-v2';
    } catch {
      strictJsonValid = false;
    }
  }
  return {
    scenario: scenario.id,
    role: scenario.role,
    condition: conditionId,
    status: outcome.status,
    failure_stage: failure === null ? null : (/([A-Z_]{4,}):/.exec(failure)?.[1] ?? 'FAILED'),
    failure_detail: failure,
    stages: {
      RAW_PROVIDER_RESPONSE: raw.cognition_response !== null,
      SCHEMA_VALID: strictJsonValid,
      EXECUTOR_ADMISSIBLE: outcome.status === 'COMPLETE',
      LANGUAGE_ADMISSIBLE:
        outcome.status === 'COMPLETE' && outcome.language_call_required ? languageCalls.length === 1 : true,
      FINAL_BEHAVIOR: outcome.status === 'COMPLETE' && typeof outcome.subject_text === 'string'
    },
    directive: outcome.directive,
    current_intent: outcome.current_intent,
    language_call_required: outcome.language_call_required,
    cognition_calls: cognitionCalls,
    language_calls: languageCalls.length,
    final_behavior: outcome.status === 'COMPLETE' ? outcome.subject_text : null,
    raw_cognition_request: raw.cognition_request,
    raw_cognition_response: raw.cognition_response,
    raw_language_requests: languageCalls.map((call) => call.request),
    raw_language_response: outcome.raw_language_response ?? null,
    request_attestation: attestation
  };
}
