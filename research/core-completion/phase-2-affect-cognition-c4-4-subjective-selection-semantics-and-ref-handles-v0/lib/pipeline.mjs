/* globals structuredClone */
/**
 * AFFECT_COGNITION_C4_SELECTION_APPLICABILITY_AND_SUBJECTIVE_BASIS_V0 — runtime driver.
 *
 * The condition is applied at the transport boundary against the UNMODIFIED
 * production runtime. The cognition stub speaks the C4 protocol
 * (`conversation-cognition-proposal-v6`: tagged choice, no model-emitted
 * projection_hash), and the record captures the tagged choice plus the V6
 * language handoff (`selected_subjective_selection`).
 */
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
function parseJson(text) {
  try { return JSON.parse(text ?? ''); } catch { return null; }
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

/** Valid C4 (V5) stub: semantics only, tagged choice, no model-owned integrity. */
export function stubCognitionTransport() {
  return { complete: async () => ({ model: 'stub', content: JSON.stringify({
    schema_version: 'conversation-cognition-proposal-v6',
    factual_assessment: { claims: [] },
    cognition: {
      schema_version: 'cognition-proposal-v0',
      reasoning_summary: 'deterministic capture stub',
      relevant_memory_handles: [], considered_handles: [],
      current_intent: 'respond directly to the current request',
      confidence: 0.5, uncertainty: 0.5, action_intent: null, evidence_handles: []
    },
    subjective_selection: { kind: 'SUBJECTIVE_SELECTION', stance: 'I would respond directly to the current request.', subjective_rationale: null },
    communication_directive: { kind: 'REALIZE_CURRENT_INTENT' },
    clarification_basis: null
  }) }) };
}

export function stubLanguageTransport() {
  return { complete: async () => ({ model: 'stub', content: JSON.stringify({
    schema_version: 'language-realization-semantic-draft-v1', text: '[research stub reply]', evidence_refs: []
  }) }) };
}

export async function growSnapshot(events) {
  const runtime = await InteractiveSubjectRuntimeV0.create(runtimeOptions(stubCognitionTransport(), `c4-${randomUUID()}`, stubLanguageTransport()));
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
  return {
    request: captured,
    system_content: captured.messages.find((message) => message.role === 'system')?.content ?? '',
    user_content: user,
    projection_hash: projectionHash(user),
    observation_ref: observationRef(user)
  };
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

/** The V6 wire handles as the model saw them, plus the host's handle→ref map. */
function advertisedHandles(user) {
  const block = (header) => {
    const lines = user.split('\n');
    const start = lines.findIndex((line) => line.startsWith(header));
    if (start < 0) return [];
    const out = [];
    for (let index = start + 1; index < lines.length; index += 1) {
      const match = /^-\s*([FC][0-9]+):\s*(\S+)\s*$/.exec(lines[index].trim());
      if (match === null) break;
      out.push({ handle: match[1], ref: match[2] });
    }
    return out;
  };
  const factual = block('FACTUAL SOURCE HANDLES');
  const context = block('CONTEXT HANDLES');
  return {
    factual: factual.map((entry) => entry.handle),
    context: context.map((entry) => entry.handle),
    // The host printed these bindings; resolving a wire handle is reading back the host's own map.
    handle_to_ref: Object.fromEntries([...factual, ...context].map((entry) => [entry.handle, entry.ref]))
  };
}

function languageInputFromRequest(request) {
  const user = request?.messages?.find((message) => message.role === 'user')?.content ?? '';
  const body = /LANGUAGE REALIZATION INPUT V7[\s\S]*?\n(\{[\s\S]*?\n\})\n/.exec(user)?.[1];
  return parseJson(body);
}

function languageLeakage(request, scenario) {
  if (request === null) return { ok: true, found: [] };
  const text = request.messages.map((message) => message.content).join('\n');
  const found = [];
  for (const token of [scenario.id, `${scenario.id}_`, 'replicate', 'condition_id', 'scenario_id']) {
    if (text.includes(token)) found.push(token);
  }
  const user = request.messages.find((message) => message.role === 'user')?.content ?? '';
  if (/input_hash/i.test(user)) found.push('model_visible_input_hash');
  if (/(?:canonical_affect|affect_channels|mood_baseline|regulation|belief_items|traits_dimensions|interaction_familiarity)/.test(user)) found.push('raw_subject_state');
  const parsed = languageInputFromRequest(request);
  if (parsed !== null) {
    if (Object.hasOwn(parsed, 'selected_current_intent')) found.push('descriptive_intent_leaked_to_language');
    if (!Object.hasOwn(parsed, 'selected_subjective_selection')) found.push('explicit_choice_missing_from_language_input');
  }
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
  const proposal = parseJson(cognitionResponse);
  const advertised = advertisedHandles(cognitionRequest?.messages?.find((message) => message.role === 'user')?.content ?? '');
  const proposalCognitionHandles = proposal?.cognition === undefined ? null : {
    considered_handles: Array.isArray(proposal.cognition.considered_handles) ? proposal.cognition.considered_handles : [],
    evidence_handles: Array.isArray(proposal.cognition.evidence_handles) ? proposal.cognition.evidence_handles : []
  };
  const languageInput = languageInputFromRequest(languageRequest);
  const failure = outcome.status === 'COMPLETE' ? null : String(outcome.failure ?? '');
  return {
    scenario: scenario.id, family: scenario.family, condition: conditionId, status: outcome.status,
    failure_stage: failure === null ? null : (/([A-Z_]{4,}):/.exec(failure)?.[1] ?? 'FAILED'), failure_detail: failure,
    directive: outcome.directive ?? proposal?.communication_directive?.kind ?? null,
    current_intent: outcome.current_intent ?? proposal?.cognition?.current_intent ?? null,
    subjective_selection: proposal?.subjective_selection ?? null,
    language_selected_subjective_selection: languageInput?.selected_subjective_selection ?? null,
    factual_assessment: proposal?.factual_assessment ?? null,
    proposal_cognition_handles: proposalCognitionHandles,
    advertised_handles: advertised,
    raw_cognition_wire: proposal,
    clarification_basis: proposal?.clarification_basis ?? null,
    language_call_required: outcome.language_call_required ?? false,
    final_behavior: outcome.status === 'COMPLETE' ? outcome.subject_text : null,
    cognition_calls: cognitionCalls, language_calls: languageCalls,
    stages: {
      RAW_PROVIDER_RESPONSE: cognitionResponse !== null,
      SCHEMA_VALID: proposal?.schema_version === 'conversation-cognition-proposal-v6',
      EXECUTOR_ADMISSIBLE: outcome.status === 'COMPLETE',
      LANGUAGE_ADMISSIBLE: outcome.status === 'COMPLETE' && outcome.language_call_required ? languageCalls === 1 : true,
      FINAL_BEHAVIOR: outcome.status === 'COMPLETE' && typeof outcome.subject_text === 'string'
    },
    raw_cognition_request: cognitionRequest, raw_cognition_response: cognitionResponse,
    raw_language_request: languageRequest, raw_language_response: languageResponse,
    request_attestation: attestation, language_leakage: languageLeakage(languageRequest, scenario), wrapper_error: wrapperError
  };
}
