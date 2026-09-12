/**
 * Research-only transports.
 *
 * - recordingCognitionTransport wraps the REAL production transport, captures
 *   the exact rendered request, then delegates unchanged (FULL condition is a
 *   pure pass-through).
 * - fixedCognitionTransport replays a previously captured raw response, so the
 *   production provider re-validates it against the current projection (used by
 *   Phase C language realization).
 * - validLanguageStub keeps collection turns complete without any real language
 *   call; it copies back the host-computed input_hash.
 * - recordingLanguageTransport wraps the REAL language transport for Phase C.
 */

import { requestIdentityBody, sha256 } from './hash.mjs';

export function recordingCognitionTransport(realTransport, sink) {
  return {
    complete: async (request) => {
      const systemContent = request.messages.find((m) => m.role === 'system')?.content ?? '';
      const userContent = request.messages.find((m) => m.role === 'user')?.content ?? '';
      sink.push({ systemContent, userContent, requestHash: sha256(JSON.stringify(request)) });
      return realTransport.complete(request);
    }
  };
}

export function fixedCognitionTransport(rawContent) {
  return { complete: async () => ({ content: rawContent, model: 'replay' }) };
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

export function recordingLanguageTransport(realTransport, sink) {
  return {
    complete: async (request) => {
      const user = request.messages.find((m) => m.role === 'user')?.content ?? '';
      const response = await realTransport.complete(request);
      sink.push({ userContent: user, userHash: sha256(user), response: response.content });
      return response;
    }
  };
}

export function productionRequestHash({ model, systemContent, userContent, numPredict, contextWindowTokens }) {
  return sha256(requestIdentityBody({ model, systemContent, userContent, numPredict, contextWindowTokens }));
}
