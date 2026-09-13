/**
 * Revalidation pipeline: the UNMODIFIED production runtime with the condition
 * applied at the transport boundary.
 *
 * The runtime builds the normal production request (V2 conversation cognition);
 * this wrapper swaps ONLY the Affect section of the rendered user content before
 * the REAL transport sees it, then hands the response back. All production
 * validation, directive branching, Language binding and behavior construction
 * therefore run exactly as in production, and the endpoint is the final
 * production-admissible observable behavior.
 */

import { InteractiveSubjectRuntimeV0, createInteractiveSubjectSeedV0 } from '../../../../packages/runtime/dist/index.js';
import { contentSensitiveAppraisalProvider } from '../../phase-2-affect-causal-completion-v0/lib/appraisal.mjs';
import { sha256, memorySection, subjectDataInvariantDigest } from '../../phase-2-affect-causal-completion-v0/lib/hash.mjs';
import {
  affectValueLine,
  assertNoExperimentalLabels,
  auditAffectVariant,
  removeAffectSection,
  swapAffectValue,
  verifyAbsentIsBaseMinusAffect
} from '../../phase-2-affect-causal-completion-v0/lib/ablation.mjs';
import {
  ACTIVATION_CONDITIONS,
  CONDITIONS,
  FROZEN_CLOCK,
  INTERVAL_TICKS,
  PROVIDER,
  SUBJECT_ID
} from './config.mjs';

export function runtimeOptions(cognitionTransport, sessionId, languageTransport) {
  return {
    session_id: sessionId,
    subject: { subject_id: SUBJECT_ID, display_name: '', identity_anchors: [] },
    v3_source: createInteractiveSubjectSeedV0(SUBJECT_ID),
    conversationCognitionTransport: cognitionTransport,
    languageTransport,
    factualEventAppraisalProvider: contentSensitiveAppraisalProvider(),
    interval_ticks: INTERVAL_TICKS,
    provider_identity: {
      model: PROVIDER.model,
      num_predict: PROVIDER.cognition_num_predict,
      context_window_tokens: PROVIDER.context_window_tokens
    },
    clock: () => FROZEN_CLOCK
  };
}

export function stubCognitionTransport() {
  return {
    complete: async (request) => {
      const user = request.messages.find((m) => m.role === 'user')?.content ?? '';
      const projectionHash = /\[projection_hash\]\s+(\S+)/.exec(user)?.[1] ?? '';
      return {
        content: JSON.stringify({
          schema_version: 'conversation-cognition-proposal-v2',
          cognition: {
            schema_version: 'cognition-proposal-v0',
            projection_hash: projectionHash,
            reasoning_summary: 'capture stub',
            relevant_memory_refs: [],
            considered_context_refs: [],
            current_intent: 'respond to the user',
            confidence: 0.5,
            uncertainty: 0.5,
            action_intent: null,
            evidence_refs: []
          },
          communication_directive: { kind: 'REALIZE_CURRENT_INTENT' },
          clarification_basis: null
        }),
        model: 'stub'
      };
    }
  };
}

export function validLanguageStub() {
  return {
    complete: async (request) => {
      const user = request.messages.find((m) => m.role === 'user')?.content ?? '';
      const inputHash = /input_hash: (\S+)/.exec(user)?.[1] ?? '';
      return {
        content: JSON.stringify({
          schema_version: 'language-realization-draft-v0',
          input_hash: inputHash,
          text: '[research stub reply]',
          evidence_refs: []
        }),
        model: 'stub'
      };
    }
  };
}

/** Grow the lawful lived history once (deterministic stub; no real calls). */
export async function growSnapshot(historyEvents) {
  const runtime = await InteractiveSubjectRuntimeV0.create(
    runtimeOptions(stubCognitionTransport(), 'sess-authority-grow', validLanguageStub())
  );
  for (const event of historyEvents) {
    const outcome = await runtime.submitUserText(event);
    if (outcome.status !== 'COMPLETE') throw new Error(`grow turn failed: ${outcome.failure}`);
  }
  return runtime.snapshot();
}

/** Capture the production-rendered base request for one scenario (no real call). */
export async function captureBaseRequest(snapshot, scenario, sessionId) {
  const sink = [];
  const recording = {
    complete: async (request) => {
      const system = request.messages.find((m) => m.role === 'system')?.content ?? '';
      const user = request.messages.find((m) => m.role === 'user')?.content ?? '';
      sink.push({ systemContent: system, userContent: user });
      return stubCognitionTransport().complete(request);
    }
  };
  const runtime = await InteractiveSubjectRuntimeV0.restore(
    runtimeOptions(recording, sessionId, validLanguageStub()),
    JSON.parse(JSON.stringify(snapshot))
  );
  const outcome = await runtime.submitUserText(scenario.event);
  if (outcome.status !== 'COMPLETE') throw new Error(`${scenario.id} capture turn FAILED: ${outcome.failure}`);
  const captured = sink.at(-1);
  if (captured === undefined) throw new Error(`${scenario.id}: no cognition request captured`);
  const projectionHash = /\[projection_hash\]\s+(\S+)/.exec(captured.userContent)?.[1] ?? '';
  if (projectionHash === '') throw new Error(`${scenario.id}: projection_hash missing`);
  return {
    systemContent: captured.systemContent,
    userContent: captured.userContent,
    projectionHash
  };
}

/** Build the condition variant of a rendered user content. */
export function conditionVariant(userContent, conditionId, activation = false) {
  if (activation) {
    const condition = ACTIVATION_CONDITIONS[conditionId];
    return { ...swapAffectValue(userContent, affectValueLine(condition.valence, condition.activation)), condition };
  }
  if (conditionId === 'A') return { ...removeAffectSection(userContent), condition: CONDITIONS.A };
  const condition = CONDITIONS[conditionId];
  return { ...swapAffectValue(userContent, affectValueLine(condition.valence, condition.activation)), condition };
}

function attest(scenarioId, base, variant, conditionId) {
  const audit = auditAffectVariant(base, variant.transformed, variant.removedIndices ?? []);
  const absent =
    conditionId === 'A'
      ? verifyAbsentIsBaseMinusAffect(base, variant.transformed, variant.removedIndices)
      : { ok: true, reasons: [] };
  const labels = assertNoExperimentalLabels(variant.transformed);
  const invariantOk = subjectDataInvariantDigest(base) === subjectDataInvariantDigest(variant.transformed);
  const ok = audit.ok && absent.ok && labels.ok && invariantOk && memorySection(variant.transformed) !== '';
  return {
    ok,
    reasons: [...audit.reasons, ...absent.reasons, ...labels.found.map((t) => `label:${t}`)],
    base_sha256: sha256(base),
    variant_sha256: sha256(variant.transformed),
    memory_section_sha256: sha256(memorySection(variant.transformed)),
    invariant_digest: subjectDataInvariantDigest(variant.transformed),
    affect_section: conditionId === 'A' ? [] : [variant.replacement],
    differing_indices: audit.differing_indices,
    removed_indices: variant.removedIndices ?? []
  };
}

/**
 * Run ONE production turn under one condition.
 * `realTransport` MUST be the real Ollama cognition transport.
 */
export async function runCondition(input) {
  const { snapshot, scenario, conditionId, realTransport, realLanguageTransport, sessionId, activation = false } = input;
  const languageCalls = [];
  const languageRecorder = {
    complete: async (request) => {
      const user = request.messages.find((m) => m.role === 'user')?.content ?? '';
      languageCalls.push({ userContentSha256: sha256(user) });
      return realLanguageTransport.complete(request);
    }
  };
  let attestation = null;
  let raws = { cognition: null };
  const mutatingTransport = {
    complete: async (request) => {
      const system = request.messages.find((m) => m.role === 'system')?.content ?? '';
      const base = request.messages.find((m) => m.role === 'user')?.content ?? '';
      if (conditionId === null) {
        // Pass-through: a lawfully reached state, no research mutation.
        raws.userContent = base;
        const response = await realTransport.complete(request);
        raws.cognition = response.content;
        return response;
      }
      const variant = conditionVariant(base, conditionId, activation);
      attestation = { scenario: scenario.id, condition: conditionId, ...attest(scenario.id, base, variant, conditionId) };
      raws.userContent = variant.transformed;
      const response = await realTransport.complete({
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: variant.transformed }
        ]
      });
      raws.cognition = response.content;
      return response;
    }
  };

  const runtime = await InteractiveSubjectRuntimeV0.restore(
    runtimeOptions(mutatingTransport, sessionId, languageRecorder),
    JSON.parse(JSON.stringify(snapshot))
  );
  const outcome = await runtime.submitUserText(scenario.event);
  const failure = outcome.status === 'COMPLETE' ? null : String(outcome.failure ?? '');

  const schemaValid = (() => {
    try {
      return JSON.parse(raws.cognition ?? '').schema_version === 'conversation-cognition-proposal-v2';
    } catch {
      return false;
    }
  })();

  return {
    scenario: scenario.id,
    role: scenario.role,
    condition: conditionId,
    activation_experiment: activation,
    status: outcome.status,
    failure_stage: failure === null ? null : (/([A-Z_]{4,}):/.exec(failure)?.[1] ?? 'FAILED'),
    failure_detail: failure,
    // staged admissibility
    stages: {
      RAW_PROVIDER_RESPONSE: raws.cognition !== null,
      SCHEMA_VALID: schemaValid,
      EXECUTOR_ADMISSIBLE: outcome.status === 'COMPLETE',
      LANGUAGE_ADMISSIBLE: outcome.status === 'COMPLETE' && outcome.language_call_required ? languageCalls.length > 0 : true,
      FINAL_BEHAVIOR: outcome.status === 'COMPLETE' && typeof outcome.subject_text === 'string'
    },
    directive: outcome.directive,
    current_intent: outcome.current_intent,
    request_affect_line: /^\[affect \(canonical\)\][^\n]*$/m.exec(raws.userContent ?? '')?.[0] ?? null,
    language_call_required: outcome.language_call_required,
    language_calls: languageCalls.length,
    final_behavior: outcome.status === 'COMPLETE' ? outcome.subject_text : null,
    raw_cognition_response: raws.cognition,
    raw_language_response: outcome.raw_language_response ?? null,
    attestation
  };
}
