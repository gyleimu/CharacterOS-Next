/* eslint-disable no-restricted-imports -- Isolated research harness composing frozen built production surfaces (repository convention); no production semantics are copied. */
/**
 * OPENAI-COMPATIBLE BELIEF SEMANTIC PROVIDER — the swapped condition's sibling of
 * `OllamaBeliefSemanticProviderV0`.
 *
 * Why a sibling exists at all: the local provider is deliberately Ollama-NATIVE. Its own header says so
 * — it performs a narrow single-shot call to `POST {base_url}/api/chat` precisely because `think: false`
 * is an Ollama-native capability and the generic OpenAI-compatible transport is NOT widened. The
 * production bundle makes the same choice (`product-provider-bundle.ts`: "ADAPTATION IS LOCAL-ONLY").
 * So a swap that leaves the belief channel on Ollama would leave the local executor inside the ONE
 * channel that produces Phase 0's endpoint, and would make "the executor changed" false.
 *
 * This module therefore exists, and it is built to change the transport and NOTHING ELSE:
 *
 *   prompt bytes     the SAME function object as the frozen local builder
 *                    (`buildBeliefSemanticOllamaPromptMessages`, imported from the built runtime and
 *                    re-exported by reference — asserted by identity, not by paraphrasing it here)
 *   temperature      0 (identical)
 *   output budget    512 (identical)
 *   timeout          60 s (identical, and bounded — no infinite wait)
 *   attempts         exactly ONE per invocation; no retry, no repair, no second call
 *   response authority  `message.content` ONLY. Reasoning output is NEVER read, NEVER a fallback.
 *   parsing          direct `JSON.parse` only; no markdown stripping, no regex salvage, no repair
 *   validation       NONE here — the closed schema, catalog membership, label contract, fingerprint
 *                    equality and capability minting remain EXCLUSIVELY with the frozen
 *                    `runBeliefSemanticTargetResolutionV0` runner. This class mints no capability and
 *                    holds no canonical mutation authority.
 *
 * The transport is INJECTED (the repository's own pattern: `createProductAppraisalProviderV0({ transport })`),
 * which is what makes the byte-identity and fail-closed behaviour testable at 0 model calls.
 */

import {
  buildBeliefSemanticOllamaPromptMessages,
  ModelTransportErrorV0,
  type BeliefSemanticTargetResolutionProviderInputV0,
  type BeliefSemanticTargetResolutionProviderV0,
  type ModelTransportV0
} from "../../../../../packages/runtime/dist/index.js";

/** Identical to `OLLAMA_BELIEF_SEMANTIC_PROVIDER_NUM_PREDICT`; equal by measurement, not by copying a number blindly. */
export const CS_BELIEF_SEMANTIC_NUM_PREDICT = 512 as const;
/** Identical to `OLLAMA_BELIEF_SEMANTIC_PROVIDER_TIMEOUT_MS`. */
export const CS_BELIEF_SEMANTIC_TIMEOUT_MS = 60_000 as const;

/**
 * The frozen prompt builder, re-exported BY REFERENCE. The offline test asserts
 * `CS_BELIEF_SEMANTIC_PROMPT_BUILDER === buildBeliefSemanticOllamaPromptMessages`, so a future edit
 * that quietly introduced a second, slightly different prompt cannot pass.
 */
export const CS_BELIEF_SEMANTIC_PROMPT_BUILDER = buildBeliefSemanticOllamaPromptMessages;

/**
 * The local sibling's error vocabulary, plus exactly ONE member: `PROVIDER_OUTPUT_TRUNCATED`.
 * `OpenAiCompatibleTransportV0` is the only one of the two that can raise `MODEL_OUTPUT_TRUNCATED`, so
 * the cloud provider can report a truncation while the Ollama envelope cannot. The offline test pins the
 * difference to exactly that one member, so vocabulary drift is caught rather than tolerated.
 */
export const CS_BELIEF_SEMANTIC_PROVIDER_ERROR_CODES = [
  "PROVIDER_INVALID_CONFIG",
  "PROVIDER_TIMEOUT",
  "PROVIDER_TRANSPORT_FAILURE",
  "PROVIDER_HTTP_FAILURE",
  "PROVIDER_INVALID_ENVELOPE",
  "PROVIDER_EMPTY_CONTENT",
  "PROVIDER_MALFORMED_JSON",
  "PROVIDER_OUTPUT_TRUNCATED"
] as const;

export type CsBeliefSemanticProviderErrorCodeV0 = (typeof CS_BELIEF_SEMANTIC_PROVIDER_ERROR_CODES)[number];

export class CsBeliefSemanticProviderErrorV0 extends Error {
  readonly code: CsBeliefSemanticProviderErrorCodeV0;
  readonly http_status: number | null;

  constructor(code: CsBeliefSemanticProviderErrorCodeV0, detail: string, httpStatus: number | null = null) {
    super(`${code}: ${detail}`);
    this.name = "CsBeliefSemanticProviderErrorV0";
    this.code = code;
    this.http_status = httpStatus;
  }
}

export interface CsBeliefSemanticProviderConfigV0 {
  /**
   * The injected transport. The bounded 60 s timeout is enforced by the transport configuration that
   * built it (`CS_FAMILY_TIMEOUTS_MS.belief_semantic`), exactly as the local sibling enforces its own
   * 60 s via `AbortSignal.timeout` — so there is no second, divergent timeout here.
   */
  readonly transport: ModelTransportV0;
}

/** Maps the transport's typed failure onto this provider's vocabulary. Total, never lossy. */
function mapTransportFailureV0(error: unknown): CsBeliefSemanticProviderErrorV0 {
  if (error instanceof ModelTransportErrorV0) {
    const detail = error.message;
    switch (error.code) {
      case "MODEL_TIMEOUT":
        return new CsBeliefSemanticProviderErrorV0("PROVIDER_TIMEOUT", detail, error.http_status);
      case "MODEL_HTTP_FAILURE":
        return new CsBeliefSemanticProviderErrorV0("PROVIDER_HTTP_FAILURE", detail, error.http_status);
      case "MODEL_CONNECTION_FAILURE":
        return new CsBeliefSemanticProviderErrorV0("PROVIDER_TRANSPORT_FAILURE", detail, error.http_status);
      case "MODEL_EMPTY_RESPONSE":
        return new CsBeliefSemanticProviderErrorV0("PROVIDER_EMPTY_CONTENT", detail, error.http_status);
      case "MODEL_OUTPUT_TRUNCATED":
        return new CsBeliefSemanticProviderErrorV0("PROVIDER_OUTPUT_TRUNCATED", detail, error.http_status);
      default:
        return new CsBeliefSemanticProviderErrorV0("PROVIDER_TRANSPORT_FAILURE", detail, error.http_status);
    }
  }
  return new CsBeliefSemanticProviderErrorV0(
    "PROVIDER_TRANSPORT_FAILURE",
    `belief semantic transport failed: ${error instanceof Error ? error.message : "unknown failure"}`
  );
}

export class OpenAiCompatibleBeliefSemanticProviderV0 implements BeliefSemanticTargetResolutionProviderV0 {
  constructor(private readonly config: CsBeliefSemanticProviderConfigV0) {
    const transport = config.transport as { complete?: unknown } | null | undefined;
    if (transport === null || typeof transport !== "object" || typeof transport.complete !== "function") {
      throw new CsBeliefSemanticProviderErrorV0(
        "PROVIDER_INVALID_CONFIG",
        "transport: a ModelTransportV0 with a callable complete() is required"
      );
    }
  }

  async propose(input: BeliefSemanticTargetResolutionProviderInputV0): Promise<unknown> {
    // The prompt is the FROZEN local builder's output, byte for byte. No mapping, no role rewriting.
    const messages = CS_BELIEF_SEMANTIC_PROMPT_BUILDER(input).map((message) => ({
      role: message.role,
      content: message.content
    }));

    let content: string;
    try {
      const response = await this.config.transport.complete({
        messages
      } as never);
      content = (response as { content?: unknown }).content as string;
    } catch (error) {
      throw mapTransportFailureV0(error);
    }

    // Response authority: the final content ONLY. A separate reasoning field (DeepSeek
    // `reasoning_content`, or any equivalent) is NEVER read and NEVER becomes semantic output.
    if (typeof content !== "string" || content.trim().length === 0) {
      throw new CsBeliefSemanticProviderErrorV0(
        "PROVIDER_EMPTY_CONTENT",
        "cloud final message.content is empty or missing"
      );
    }

    // Direct JSON.parse only: no markdown stripping, no regex salvage, no repair.
    let candidate: unknown;
    try {
      candidate = JSON.parse(content) as unknown;
    } catch (error) {
      throw new CsBeliefSemanticProviderErrorV0(
        "PROVIDER_MALFORMED_JSON",
        `cloud final content is not valid JSON: ${error instanceof Error ? error.message : "unknown failure"}`
      );
    }
    if (candidate === null || typeof candidate !== "object" || Array.isArray(candidate)) {
      throw new CsBeliefSemanticProviderErrorV0("PROVIDER_MALFORMED_JSON", "cloud final content is not a JSON object");
    }
    return candidate;
  }
}

/** The frozen bounded timeout this provider falls back to when the caller does not pin one. */
export const CS_BELIEF_SEMANTIC_EFFECTIVE_TIMEOUT_MS = CS_BELIEF_SEMANTIC_TIMEOUT_MS;
