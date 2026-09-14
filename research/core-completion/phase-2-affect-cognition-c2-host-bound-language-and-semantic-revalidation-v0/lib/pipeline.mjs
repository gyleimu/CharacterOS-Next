/* globals structuredClone */
import { randomUUID } from 'node:crypto';
import { InteractiveSubjectRuntimeV0, createInteractiveSubjectSeedV0 } from '../../../../packages/runtime/dist/index.js';
import { contentSensitiveAppraisalProvider } from '../../phase-2-affect-causal-completion-v0/lib/appraisal.mjs';
import { sha256, memorySection, subjectDataInvariantDigest } from '../../phase-2-affect-causal-completion-v0/lib/hash.mjs';
import { affectValueLine, assertNoExperimentalLabels, auditAffectVariant, removeAffectSection, swapAffectValue, verifyAbsentIsBaseMinusAffect } from '../../phase-2-affect-causal-completion-v0/lib/ablation.mjs';
import { CONDITIONS, FROZEN_CLOCK, PROVIDER, SUBJECT_ID } from './config.mjs';

function observationRef(user) {
  return /^\[current observation\]\s+(\S+)$/m.exec(user)?.[1] ?? '';
}
function projectionHash(user) {
  return /^\[projection_hash\]\s+(\S+)$/m.exec(user)?.[1] ?? '';
}

export function runtimeOptions(cognitionTransport, sessionId, languageTransport) {
  return {
    session_id: sessionId,
    subject: { subject_id: SUBJECT_ID, display_name: '', identity_anchors: [] },
    v3_source: createInteractiveSubjectSeedV0(SUBJECT_ID),
    conversationCognitionTransport: cognitionTransport,
    languageTransport,
    factualEventAppraisalProvider: contentSensitiveAppraisalProvider(),
    interval_ticks: 1,
    provider_identity: { model: PROVIDER.model, num_predict: PROVIDER.cognition_num_predict, context_window_tokens: PROVIDER.context_window_tokens },
    clock: () => FROZEN_CLOCK
  };
}

export function stubCognitionTransport() {
  return { complete: async (request) => {
    const user = request.messages.find((message) => message.role === 'user')?.content ?? '';
    return { model: 'stub', content: JSON.stringify({
      schema_version: 'conversation-cognition-proposal-v3',
      factual_assessment: { claims: [] },
      cognition: {
        schema_version: 'cognition-proposal-v0', projection_hash: projectionHash(user), reasoning_summary: 'deterministic capture stub',
        relevant_memory_refs: [], considered_context_refs: [], current_intent: 'I will respond directly to the current request.',
        confidence: 0.5, uncertainty: 0.5, action_intent: null, evidence_refs: []
      },
      communication_directive: { kind: 'REALIZE_CURRENT_INTENT' }, clarification_basis: null
    }) };
  }};
}

export function stubLanguageTransport() {
  return { complete: async () => ({ model: 'stub', content: JSON.stringify({
    schema_version: 'language-realization-semantic-draft-v1', text: '[research stub reply]', evidence_refs: []
  }) }) };
}

export async function growSnapshot(events) {
  const runtime = await InteractiveSubjectRuntimeV0.create(runtimeOptions(stubCognitionTransport(), `c2-${randomUUID()}`, stubLanguageTransport()));
  for (const event of events) {
    const outcome = await runtime.submitUserText(event);
    if (outcome.status !== 'COMPLETE') throw new Error(`snapshot growth failed: ${outcome.failure}`);
  }
  return runtime.snapshot();
}

export async function captureBaseRequest(snapshot, scenario, sessionId) {
  let captured = null;
  const cognition = { complete: async (request) => { captured = structuredClone(request); return stubCognitionTransport().complete(request); } };
  const runtime = await InteractiveSubjectRuntimeV0.restore(runtimeOptions(cognition, sessionId, stubLanguageTransport()), structuredClone(snapshot));
  const outcome = await runtime.submitUserText(scenario.event);
  if (outcome.status !== 'COMPLETE' || captured === null) throw new Error(`${scenario.id}: capture failed`);
  const user = captured.messages.find((message) => message.role === 'user')?.content ?? '';
  return { request: captured, system_content: captured.messages.find((message) => message.role === 'system')?.content ?? '', user_content: user, projection_hash: projectionHash(user), observation_ref: observationRef(user) };
}

export function conditionVariant(base, conditionId) {
  if (conditionId === 'A') return { ...removeAffectSection(base), condition: CONDITIONS.A };
  const condition = CONDITIONS[conditionId];
  return { ...swapAffectValue(base, affectValueLine(condition.valence, condition.activation)), condition };
}

function requestAttestation(base, transformed, conditionId, removedIndices) {
  const audit = auditAffectVariant(base, transformed, removedIndices);
  const absent = conditionId === 'A' ? verifyAbsentIsBaseMinusAffect(base, transformed, removedIndices) : { ok: true, reasons: [] };
  const labels = assertNoExperimentalLabels(transformed);
  const invariant = subjectDataInvariantDigest(base) === subjectDataInvariantDigest(transformed);
  return {
    ok: audit.ok && absent.ok && labels.ok && invariant && memorySection(transformed) !== '',
    reasons: [...audit.reasons, ...absent.reasons, ...labels.found.map((value) => `label:${value}`)],
    base_sha256: sha256(base), variant_sha256: sha256(transformed), memory_sha256: sha256(memorySection(transformed)),
    invariant_digest: subjectDataInvariantDigest(transformed), differing_indices: audit.differing_indices, removed_indices: removedIndices
  };
}

function languageLeakage(request, scenario) {
  if (request === null) return { ok: true, found: [] };
  const text = request.messages.map((message) => message.content).join('\n');
  const found = [];
  for (const token of [scenario.id, `${scenario.id}_`, `replicate`, 'condition_id', 'scenario_id']) {
    if (text.includes(token)) found.push(token);
  }
  const user = request.messages.find((message) => message.role === 'user')?.content ?? '';
  if (/input_hash/i.test(user)) found.push('model_visible_input_hash');
  if (/(?:canonical_affect|affect_channels|mood_baseline|regulation|belief_items|traits_dimensions|interaction_familiarity)/.test(user)) found.push('raw_subject_state');
  return { ok: found.length === 0, found };
}

export async function runCondition({ snapshot, scenario, conditionId, cognitionTransport, languageTransport, sessionId }) {
  let cognitionRequest = null;
  let cognitionResponse = null;
  let languageRequest = null;
  let languageResponse = null;
  let attestation = null;
  let cognitionCalls = 0;
  let languageCalls = 0;
  let wrapperError = null;
  const cognitionWrapper = { complete: async (request) => {
    cognitionCalls += 1;
    try {
      const base = request.messages.find((message) => message.role === 'user')?.content ?? '';
      const variant = conditionId === null ? { transformed: base, removedIndices: [] } : conditionVariant(base, conditionId);
      attestation = conditionId === null
        ? { ok: true, reasons: [], base_sha256: sha256(base), variant_sha256: sha256(base), memory_sha256: sha256(memorySection(base)), invariant_digest: subjectDataInvariantDigest(base), differing_indices: [], removed_indices: [] }
        : requestAttestation(base, variant.transformed, conditionId, variant.removedIndices ?? []);
      cognitionRequest = structuredClone({ ...request, messages: request.messages.map((message) => message.role === 'user' ? { ...message, content: variant.transformed } : message) });
      const response = await cognitionTransport.complete(cognitionRequest);
      cognitionResponse = response.content;
      return response;
    } catch (error) {
      wrapperError = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      throw error;
    }
  }};
  const languageWrapper = { complete: async (request) => {
    languageCalls += 1; languageRequest = structuredClone(request);
    const response = await languageTransport.complete(request); languageResponse = response.content; return response;
  }};
  const runtime = await InteractiveSubjectRuntimeV0.restore(runtimeOptions(cognitionWrapper, sessionId, languageWrapper), structuredClone(snapshot));
  const outcome = await runtime.submitUserText(scenario.event);
  const proposal = (() => {
    try { return JSON.parse(cognitionResponse ?? ''); } catch { return null; }
  })();
  const failure = outcome.status === 'COMPLETE' ? null : String(outcome.failure ?? '');
  const leakage = languageLeakage(languageRequest, scenario);
  return {
    scenario: scenario.id, family: scenario.family, condition: conditionId, status: outcome.status,
    failure_stage: failure === null ? null : (/([A-Z_]{4,}):/.exec(failure)?.[1] ?? 'FAILED'), failure_detail: failure,
    directive: outcome.directive ?? proposal?.communication_directive?.kind ?? null,
    current_intent: outcome.current_intent ?? proposal?.cognition?.current_intent ?? null,
    factual_assessment: proposal?.factual_assessment ?? null,
    language_call_required: outcome.language_call_required ?? false,
    final_behavior: outcome.status === 'COMPLETE' ? outcome.subject_text : null,
    cognition_calls: cognitionCalls, language_calls: languageCalls,
    stages: {
      RAW_PROVIDER_RESPONSE: cognitionResponse !== null,
      SCHEMA_VALID: proposal?.schema_version === 'conversation-cognition-proposal-v3',
      EXECUTOR_ADMISSIBLE: outcome.status === 'COMPLETE',
      LANGUAGE_ADMISSIBLE: outcome.status === 'COMPLETE' && outcome.language_call_required ? languageCalls === 1 : true,
      FINAL_BEHAVIOR: outcome.status === 'COMPLETE' && typeof outcome.subject_text === 'string'
    },
    raw_cognition_request: cognitionRequest, raw_cognition_response: cognitionResponse,
    raw_language_request: languageRequest, raw_language_response: languageResponse,
    request_attestation: attestation, language_leakage: leakage, wrapper_error: wrapperError
  };
}
