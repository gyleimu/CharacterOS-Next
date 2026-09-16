/* eslint-disable no-restricted-imports -- Experiment host imports the frozen built production root by relative dist path (workspace packages are not linked under research/). */
/**
 * EXECUTOR_MODEL_SUBSTITUTION_EXPERIMENT_V0 — research-only API executor transport.
 *
 * The SMALLEST possible adapter: it implements the EXISTING production `ModelTransportV0`
 * port (the same port the local Ollama transport implements) so the frozen V2 harness can be
 * reused with zero harness changes. It is transport-level only: it moves prompt text to an
 * OpenAI-compatible `/chat/completions` endpoint and returns raw `message.content`. It never
 * interprets, never repairs, never mutates canonical state and never touches prompts.
 *
 * Transport-level adaptation ONLY. The prompt bytes are produced upstream by the unmodified
 * V2 modules, so substituting the transport cannot change prompt semantics.
 *
 * SECURITY: the API key lives only in this object's private field, is sent only in the
 * Authorization header of the outbound request, and is NEVER written to a log, manifest,
 * artifact or error message. Errors carry a redacted detail only.
 *
 * NO LOCAL FALLBACK: `assertNotLocalFallback` rejects any localhost/Ollama base URL at
 * configuration time, and this adapter has no other endpoint to fall back to.
 */
import { createHash } from "node:crypto";

import {
  ModelTransportErrorV0,
  type ModelTransportRequestV0,
  type ModelTransportResponseV0,
  type ModelTransportV0
} from "../../../packages/runtime/dist/index.js";

import { RETRY_POLICY, type ApiExecutorConfig } from "./contract.ts";

export interface TransportAttemptRecord {
  readonly attempt: number;
  readonly http_status: number | null;
  readonly failure_class: string | null;
  readonly elapsed_ms: number;
}

export interface TransportUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  requests: number;
}

export interface ApiTransportOptions {
  readonly config: ApiExecutorConfig;
  readonly api_key: string;
  readonly usage_sink?: (usage: {
    readonly prompt_tokens: number;
    readonly completion_tokens: number;
    readonly total_tokens: number;
  }) => void;
  readonly attempt_sink?: (attempt: TransportAttemptRecord) => void;
}

/** Redact anything that could carry a credential out of an outbound-text derived string. */
export function redact(text: string): string {
  return text
    .replace(/sk-[A-Za-z0-9]{8,}/g, "sk-<redacted>")
    .replace(/Bearer\s+[A-Za-z0-9._-]{8,}/gi, "Bearer <redacted>")
    .replace(/authorization["']?\s*[:=]\s*["']?[^"',}\s]+/gi, "authorization: <redacted>");
}

export function keyFingerprint(apiKey: string): string {
  return `sha256:${createHash("sha256").update(apiKey).digest("hex").slice(0, 16)}`;
}

function isRetryableHttp(status: number): boolean {
  return (RETRY_POLICY.retry_on_http as readonly number[]).includes(status);
}

function isRetryableTransport(code: string): boolean {
  return (RETRY_POLICY.retry_on_transport as readonly string[]).includes(code);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class ApiExecutorTransportV0 implements ModelTransportV0 {
  readonly config: ApiExecutorConfig;
  private readonly apiKey: string;
  private readonly usageSink: ApiTransportOptions["usage_sink"];
  private readonly attemptSink: ApiTransportOptions["attempt_sink"];

  constructor(options: ApiTransportOptions) {
    this.config = options.config;
    this.apiKey = options.api_key;
    this.usageSink = options.usage_sink;
    this.attemptSink = options.attempt_sink;
  }

  async complete(request: ModelTransportRequestV0): Promise<ModelTransportResponseV0> {
    const body = JSON.stringify({
      model: this.config.model,
      messages: request.messages.map((message) => ({ role: message.role, content: message.content })),
      temperature: this.config.temperature,
      ...(this.config.top_p === null ? {} : { top_p: this.config.top_p }),
      max_tokens: this.config.max_tokens,
      ...(this.config.seed === null ? {} : { seed: this.config.seed }),
      // PROVIDER CAPABILITY MAPPING (transport-level, protocol §6): the frozen provider
      // passes a JSON_SCHEMA constraint whenever it wants machine-enforced JSON. The LOCAL
      // executor maps it to Ollama's grammar-enforced `format`; this provider's strongest
      // AVAILABLE mode is `json_object` (its `json_schema` mode returns
      // "This response_format type is unavailable now"). The schema itself is unchanged and
      // the host parser remains authoritative — this only asks for bare JSON.
      ...(request.structured_output === undefined
        ? {}
        : { response_format: { type: "json_object" } }),
      stream: false
    });
    const endpoint = `${this.config.base_url}/chat/completions`;

    let lastError: ModelTransportErrorV0 | null = null;
    for (let attempt = 1; attempt <= RETRY_POLICY.max_attempts; attempt += 1) {
      const startedAt = Date.now();
      try {
        const result = await this.attemptFetch(endpoint, body);
        this.attemptSink?.({ attempt, http_status: result.http_status, failure_class: null, elapsed_ms: Date.now() - startedAt });
        return { content: result.content, model: result.model };
      } catch (error) {
        const transportError = error instanceof ModelTransportErrorV0
          ? error
          : new ModelTransportErrorV0("MODEL_CONNECTION_FAILURE", null, redact(String(error)));
        lastError = transportError;
        this.attemptSink?.({
          attempt,
          http_status: transportError.http_status,
          failure_class: transportError.code,
          elapsed_ms: Date.now() - startedAt
        });
        const retryable = transportError.http_status !== null
          ? isRetryableHttp(transportError.http_status)
          : isRetryableTransport(transportError.code);
        if (!retryable || attempt === RETRY_POLICY.max_attempts) throw transportError;
        const backoff = (RETRY_POLICY.backoff_ms as readonly number[])[attempt - 1] ?? 3000;
        await sleep(backoff);
      }
    }
    throw lastError ?? new ModelTransportErrorV0("MODEL_CONNECTION_FAILURE", null, "exhausted attempts");
  }

  private async attemptFetch(
    endpoint: string,
    body: string
  ): Promise<{ readonly content: string; readonly model: string; readonly http_status: number }> {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), this.config.timeout_ms);
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.apiKey}`
        },
        body,
        signal: abort.signal
      });
    } catch (error) {
      if (abort.signal.aborted) {
        throw new ModelTransportErrorV0("MODEL_TIMEOUT", null, `timed out after ${this.config.timeout_ms} ms`);
      }
      throw new ModelTransportErrorV0("MODEL_CONNECTION_FAILURE", null, redact(String(error)));
    } finally {
      clearTimeout(timer);
    }

    const raw = await response.text().catch(() => "");
    if (!response.ok) {
      // The provider error body never contains our credential; still redact defensively.
      throw new ModelTransportErrorV0(
        "MODEL_HTTP_FAILURE",
        response.status,
        redact(raw.slice(0, 400))
      );
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new ModelTransportErrorV0("MODEL_EMPTY_RESPONSE", response.status, "response is not JSON");
    }
    const choices = (parsed as { choices?: unknown }).choices;
    if (!Array.isArray(choices) || choices.length === 0) {
      throw new ModelTransportErrorV0("MODEL_EMPTY_RESPONSE", response.status, "completion response has no choices");
    }
    const first = choices[0] as { message?: { content?: unknown }; finish_reason?: unknown };
    const content = first?.message?.content;
    if (typeof content !== "string" || content.length === 0) {
      throw new ModelTransportErrorV0("MODEL_EMPTY_RESPONSE", response.status, "completion message content is not a non-empty string");
    }
    if (first?.finish_reason === "length") {
      throw new ModelTransportErrorV0("MODEL_OUTPUT_TRUNCATED", response.status, "finish_reason=length");
    }

    const usage = (parsed as {
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    }).usage;
    if (usage !== undefined) {
      this.usageSink?.({
        prompt_tokens: Number(usage.prompt_tokens ?? 0),
        completion_tokens: Number(usage.completion_tokens ?? 0),
        total_tokens: Number(usage.total_tokens ?? 0)
      });
    }

    const reportedModel = (parsed as { model?: unknown }).model;
    return {
      content,
      model: typeof reportedModel === "string" ? reportedModel : this.config.model,
      http_status: response.status
    };
  }
}
