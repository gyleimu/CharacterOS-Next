/**
 * Native Ollama adapter for the Relationship semantic channel contract.
 *
 * Sibling of OpenAICompatibleRelationshipSemanticChannelProviderV0 (which is
 * NOT replaced and remains available). This dedicated provider exists because
 * `think: false` is an Ollama-native runtime capability, NOT part of the
 * generic OpenAI-compatible transport contract — `ModelTransportRequestV0`
 * deliberately carries only `{ messages }`, so the generic transport is NOT
 * widened. Instead this provider performs its own narrow single-shot HTTP call
 * to the Ollama-native endpoint `POST {base_url}/api/chat`.
 *
 * Fixed request policy (NONE caller-controlled in V0): think = false
 * (reasoning EXPLICITLY disabled), stream = false, temperature = 0,
 * num_predict = 512. Exactly one request; no retry, no fallback, no repair,
 * no structured output, no tool calls, no streaming.
 *
 * Response authority: ONLY `message.content`. A separate Ollama `thinking`
 * field, if present, is ignored entirely and NEVER becomes semantic output.
 * Empty / missing final content fails closed with a typed provider failure.
 * The returned candidate is NOT semantically validated here — the frozen
 * runRelationshipSemanticChannelV0 runner remains the exclusive semantic
 * validation authority (closed schema, fingerprint bindings, channel
 * membership, CHANNEL/ABSTAIN legality, capability minting).
 */

import {
  RelationshipSemanticProviderErrorV0,
  type RelationshipSemanticChannelProviderInputV0,
  type RelationshipSemanticChannelProviderV0
} from "./relationship-semantic-channel.js";
import { buildRelationshipSemanticChannelPromptMessages } from "./relationship-semantic-openai-provider.js";

export const OLLAMA_RELATIONSHIP_SEMANTIC_PROVIDER_NUM_PREDICT = 512 as const;
export const OLLAMA_RELATIONSHIP_SEMANTIC_PROVIDER_TIMEOUT_MS = 60_000 as const;

/** Host-only, noncanonical live-provider configuration. */
export interface OllamaRelationshipSemanticChannelProviderConfigV0 {
  /** Ollama base URL, e.g. "http://127.0.0.1:11434" (explicit; no default). */
  readonly base_url: string;
  readonly model: string;
  /** Bounded request timeout; defaults to 60s (proven 9B workload headroom). */
  readonly timeout_ms?: number;
}

type OllamaChatResponse = {
  message?: { content?: unknown; thinking?: unknown };
};

export class OllamaRelationshipSemanticChannelProviderV0
  implements RelationshipSemanticChannelProviderV0
{
  constructor(private readonly config: OllamaRelationshipSemanticChannelProviderConfigV0) {}

  async propose(input: RelationshipSemanticChannelProviderInputV0): Promise<unknown> {
    const timeoutMs = this.config.timeout_ms ?? OLLAMA_RELATIONSHIP_SEMANTIC_PROVIDER_TIMEOUT_MS;
    const base = this.config.base_url.replace(/\/$/, "");
    let response: Response;
    try {
      response = await fetch(`${base}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: this.config.model,
          messages: buildRelationshipSemanticChannelPromptMessages(input).map(
            (m: { role: "system" | "user"; content: string }) => ({
              role: m.role,
              content: m.content
            })
          ),
          think: false,
          stream: false,
          options: {
            temperature: 0,
            num_predict: OLLAMA_RELATIONSHIP_SEMANTIC_PROVIDER_NUM_PREDICT
          }
        }),
        signal: AbortSignal.timeout(timeoutMs)
      });
    } catch (error) {
      if ((error as { name?: string } | null)?.name === "TimeoutError") {
        throw new RelationshipSemanticProviderErrorV0(
          "PROVIDER_TIMEOUT",
          `ollama model transport timed out after ${timeoutMs}ms`
        );
      }
      throw new RelationshipSemanticProviderErrorV0(
        "PROVIDER_TRANSPORT_FAILURE",
        `ollama model transport failed: ${error instanceof Error ? error.message : "unknown failure"}`
      );
    }
    if (!response.ok) {
      throw new RelationshipSemanticProviderErrorV0(
        "PROVIDER_TRANSPORT_FAILURE",
        `ollama model endpoint returned HTTP ${response.status}`
      );
    }
    let body: OllamaChatResponse;
    try {
      body = (await response.json()) as OllamaChatResponse;
    } catch (error) {
      throw new RelationshipSemanticProviderErrorV0(
        "PROVIDER_TRANSPORT_FAILURE",
        `ollama model endpoint returned a non-JSON body: ${error instanceof Error ? error.message : "unknown failure"}`
      );
    }
    const content = body.message?.content;
    if (typeof content !== "string" || content.length === 0) {
      throw new RelationshipSemanticProviderErrorV0(
        "PROVIDER_TRANSPORT_FAILURE",
        "ollama final message.content is empty or missing"
      );
    }
    let candidate: unknown;
    try {
      candidate = JSON.parse(content) as unknown;
    } catch (error) {
      throw new RelationshipSemanticProviderErrorV0(
        "PROVIDER_MALFORMED_JSON",
        `ollama final content is not valid JSON: ${error instanceof Error ? error.message : "unknown failure"}`
      );
    }
    return candidate;
  }
}
