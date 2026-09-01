/**
 * Ollama Native Cognition Transport V0 — transport/provider compatibility slice.
 *
 * Background: over the generic OpenAI-compatible endpoint (`/v1/chat/completions`)
 * a thinking model can spend its whole output budget on non-standard reasoning
 * fields and return an empty `message.content` (the frozen transport fails closed
 * there by design; REAL_MODEL_BELIEF_BEHAVIORAL_CAUSAL_PROOF_V0 observed exactly
 * this). The Ollama-NATIVE endpoint can explicitly suppress reasoning with
 * `think: false`, so `message.content` carries the final answer.
 *
 * This file is a ModelTransportV0 implementation ONLY. It plugs into the
 * EXISTING frozen LlmCognitionProviderV0 unchanged: the deterministic prompt
 * builder, JSON parsing, closed-schema validation, projection binding, evidence
 * grounding and action-space validation all remain the frozen provider's
 * authority. The transport is cognition-semantics-free: it moves prompt text to
 * `POST {base_url}/api/chat` and returns raw `message.content` — never
 * `message.thinking` / `reasoning` / any vendor reasoning field.
 *
 * Fixed request policy (NONE caller-controlled): stream = false, think = false,
 * options.temperature = 0, options.num_predict = configured output budget.
 * Exactly one request; no retry, no fallback, no repair, no format field
 * (OLLAMA_FORMAT_MODE NONE — the frozen prompt + parser remain the authority),
 * no Authorization header (native local Ollama needs no fake OpenAI auth).
 *
 * Precedents: OllamaBeliefSemanticProviderV0 and
 * OllamaRelationshipSemanticChannelProviderV0 (same native envelope discipline).
 */

import {
  ModelTransportErrorV0,
  type ModelTransportRequestV0,
  type ModelTransportResponseV0,
  type ModelTransportV0
} from "../../transports/model-transport.js";

/** Default native-call timeout (ms); host-overridable via explicit config. */
export const OLLAMA_NATIVE_COGNITION_TRANSPORT_TIMEOUT_MS = 120_000;

/**
 * Default output-token budget mapped to Ollama `options.num_predict`. Cognition
 * proposals are structurally larger than small Belief semantic outputs; this
 * matches the budget the previous real cognition experiment used. Hosts may
 * override via explicit config — never via ambient environment.
 */
export const OLLAMA_NATIVE_COGNITION_TRANSPORT_NUM_PREDICT = 2048;

/** Explicit host-owned configuration. No ambient defaults, no env magic. */
export interface OllamaNativeCognitionTransportConfigV0 {
  /** Ollama-native base URL, e.g. "http://127.0.0.1:11434". */
  readonly base_url: string;
  readonly model: string;
  /** Request timeout in milliseconds; a per-call abort enforces it. */
  readonly timeout_ms?: number;
  /** Output-token budget → native `options.num_predict`. */
  readonly num_predict?: number;
}

/** Native Ollama chat response envelope (only `message.content` is read). */
interface OllamaChatResponse {
  readonly message?: { readonly content?: unknown };
}

/**
 * Native Ollama transport for the frozen real cognition provider. Single
 * attempt per invocation; every failure surfaces as a ModelTransportErrorV0
 * which the frozen LlmCognitionProviderV0 wraps as a provider failure —
 * canonical state stays untouched because nothing is reserved before the
 * validated proposal.
 */
export class OllamaNativeCognitionTransportV0 implements ModelTransportV0 {
  constructor(private readonly config: OllamaNativeCognitionTransportConfigV0) {
    if (typeof config.base_url !== "string" || config.base_url.trim().length === 0) {
      throw new ModelTransportErrorV0(
        "MODEL_CONNECTION_FAILURE",
        null,
        "config.base_url: non-empty string required"
      );
    }
    if (typeof config.model !== "string" || config.model.trim().length === 0) {
      throw new ModelTransportErrorV0(
        "MODEL_CONNECTION_FAILURE",
        null,
        "config.model: non-empty string required"
      );
    }
    if (config.timeout_ms !== undefined && (!Number.isFinite(config.timeout_ms) || config.timeout_ms <= 0)) {
      throw new ModelTransportErrorV0(
        "MODEL_CONNECTION_FAILURE",
        null,
        "config.timeout_ms: positive finite number required"
      );
    }
    if (
      config.num_predict !== undefined &&
      (!Number.isInteger(config.num_predict) || config.num_predict <= 0)
    ) {
      throw new ModelTransportErrorV0(
        "MODEL_CONNECTION_FAILURE",
        null,
        "config.num_predict: positive integer required"
      );
    }
  }

  async complete(request: ModelTransportRequestV0): Promise<ModelTransportResponseV0> {
    const timeoutMs = this.config.timeout_ms ?? OLLAMA_NATIVE_COGNITION_TRANSPORT_TIMEOUT_MS;
    const numPredict = this.config.num_predict ?? OLLAMA_NATIVE_COGNITION_TRANSPORT_NUM_PREDICT;
    const base = this.config.base_url.replace(/\/$/, "");
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetch(`${base}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: this.config.model,
          messages: request.messages.map((message) => ({
            role: message.role,
            content: message.content
          })),
          think: false,
          stream: false,
          options: {
            temperature: 0,
            num_predict: numPredict
          }
        }),
        signal: abort.signal
      });
    } catch (error) {
      if (abort.signal.aborted) {
        throw new ModelTransportErrorV0(
          "MODEL_TIMEOUT",
          null,
          `ollama native cognition transport timed out after ${timeoutMs}ms`
        );
      }
      throw new ModelTransportErrorV0(
        "MODEL_CONNECTION_FAILURE",
        null,
        `ollama native cognition transport failed: ${error instanceof Error ? error.message : "unknown failure"}`
      );
    } finally {
      clearTimeout(timer);
    }
    if (!response.ok) {
      throw new ModelTransportErrorV0(
        "MODEL_HTTP_FAILURE",
        response.status,
        `ollama native endpoint returned HTTP ${response.status}`
      );
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch (error) {
      throw new ModelTransportErrorV0(
        "MODEL_HTTP_FAILURE",
        response.status,
        `ollama native endpoint returned a non-JSON body: ${error instanceof Error ? error.message : "unknown failure"}`
      );
    }
    if (body === null || typeof body !== "object") {
      throw new ModelTransportErrorV0(
        "MODEL_EMPTY_RESPONSE",
        response.status,
        "ollama native response envelope is not an object"
      );
    }
    // RESPONSE AUTHORITY: message.content ONLY. `thinking` / `reasoning` /
    // `reasoning_content` and any other vendor reasoning fields are ignored
    // entirely and NEVER become cognition content.
    const content = (body as OllamaChatResponse).message?.content;
    if (typeof content !== "string" || content.trim().length === 0) {
      throw new ModelTransportErrorV0(
        "MODEL_EMPTY_RESPONSE",
        response.status,
        "ollama native message.content is missing, empty or whitespace-only (thinking-only responses fail closed)"
      );
    }
    return { content, model: this.config.model };
  }
}
