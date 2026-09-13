/**
 * Research-only transports.
 *
 * - recordingCognitionTransport wraps a transport, captures the exact rendered
 *   request, then delegates unchanged.
 * - stubCognitionTransport returns a schema-valid proposal without any real
 *   model call (used ONLY to obtain the production-rendered base request).
 * - validLanguageStub keeps the production lifecycle complete without a real
 *   language call.
 */

import { requestIdentityBody, sha256 } from './hash.mjs';

export function recordingCognitionTransport(inner, sink) {
  return {
    complete: async (request) => {
      const systemContent = request.messages.find((m) => m.role === 'system')?.content ?? '';
      const userContent = request.messages.find((m) => m.role === 'user')?.content ?? '';
      sink.push({ systemContent, userContent, requestHash: sha256(JSON.stringify(request)) });
      return inner.complete(request);
    }
  };
}

/** Deterministic schema-valid cognition stub — NEVER counts as evidence. */
export function stubCognitionTransport() {
  return {
    complete: async (request) => {
      const user = request.messages.find((m) => m.role === 'user')?.content ?? '';
      const projectionHash = /\[projection_hash\]\s+(\S+)/.exec(user)?.[1] ?? '';
      return {
        content: JSON.stringify({
          schema_version: 'conversation-cognition-proposal-v1',
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
          communication_directive: { kind: 'REALIZE_CURRENT_INTENT' }
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

/** Replays one previously captured raw cognition response (production re-validates it). */
export function fixedCognitionTransport(rawContent) {
  return { complete: async () => ({ content: rawContent, model: 'replay' }) };
}

export function productionRequestHash({ model, systemContent, userContent, numPredict, contextWindowTokens }) {
  return sha256(requestIdentityBody({ model, systemContent, userContent, numPredict, contextWindowTokens }));
}
