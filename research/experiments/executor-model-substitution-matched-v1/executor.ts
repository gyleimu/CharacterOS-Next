/* eslint-disable no-restricted-imports -- Experiment host imports frozen built production roots by relative dist path (workspace packages are not linked under research/). */
/**
 * EXECUTOR_MODEL_SUBSTITUTION_MATCHED_V1 — executor construction.
 *
 * ONE retry + accounting decorator is applied to BOTH executors, so the frozen retry policy is a
 * single implementation rather than two similar ones. The inner transports are thin:
 *
 *   LOCAL_QWEN     the production `OllamaNativeCognitionTransportV0` (grammar-enforced `format`)
 *   API_DEEPSEEK   a research-only OpenAI-compatible single-attempt transport
 *
 * No local fallback exists or is reachable: each executor builds exactly one endpoint, and the
 * API path rejects a localhost/Ollama base URL at configuration time.
 */
import { createHash } from "node:crypto";

import {
  ModelTransportErrorV0,
  OllamaNativeCognitionTransportV0,
  type ModelTransportRequestV0,
  type ModelTransportResponseV0,
  type ModelTransportV0
} from "../../../packages/runtime/dist/index.js";

import {
  RETRY_POLICY,
  executorConfig,
  type ExecutorConfig,
  type ExecutorId
} from "./contract.ts";

export interface UsageTotals {
  requests: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cached_tokens: number;
  reasoning_tokens: number;
}

export interface AttemptRecord {
  readonly executor: ExecutorId;
  readonly attempt: number;
  readonly http_status: number | null;
  readonly failure_class: string | null;
  readonly elapsed_ms: number;
}

export interface ExecutorRuntimeObservations {
  readonly usage: UsageTotals;
  readonly attempts: AttemptRecord[];
  readonly requests: { readonly system: string; readonly user: string }[];
}

export function redact(text: string): string {
  return text
    .replace(/sk-[A-Za-z0-9]{8,}/g, "sk-<redacted>")
    .replace(/Bearer\s+[A-Za-z0-9._-]{8,}/gi, "Bearer <redacted>")
    .replace(/authorization["']?\s*[:=]\s*["']?[^"',}\s]+/gi, "authorization: <redacted>");
}

export function keyFingerprint(apiKey: string): string {
  return `sha256:${createHash("sha256").update(apiKey).digest("hex").slice(0, 16)}`;
}

function isRetryable(error: ModelTransportErrorV0): boolean {
  if (error.http_status !== null) return (RETRY_POLICY.retry_on_http as readonly number[]).includes(error.http_status);
  return (RETRY_POLICY.retry_on_transport as readonly string[]).includes(error.code);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assertNotLocalFallbackForApi(baseUrl: string): void {
  const normalized = baseUrl.trim().toLowerCase();
  if (/^https?:\/\/(127\.0\.0\.1|localhost|0\.0\.0\.0|\[::1\])(:|\/|$)/.test(normalized) || normalized.includes(":11434")) {
    throw new Error(
      `EXECUTOR_MODEL_SUBSTITUTION_MATCHED: API base_url ${baseUrl} resolves to a LOCAL endpoint; local fallback is FORBIDDEN (fail closed)`
    );
  }
}

/** Research-only OpenAI-compatible transport: exactly one attempt, no repair, no fallback.
 * Explicit field assignment (no parameter properties) so Node type-stripping can run it. */
class RawApiTransportV0 implements ModelTransportV0 {
  private readonly config: ExecutorConfig;
  private readonly apiKey: string;
  private readonly onUsage: (usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number; cached_tokens: number; reasoning_tokens: number }) => void;

  constructor(
    config: ExecutorConfig,
    apiKey: string,
    onUsage: (usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number; cached_tokens: number; reasoning_tokens: number }) => void
  ) {
    this.config = config;
    this.apiKey = apiKey;
    this.onUsage = onUsage;
  }

  async complete(request: ModelTransportRequestV0): Promise<ModelTransportResponseV0> {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), this.config.timeout_ms);
    let response: Response;
    try {
      response = await fetch(`${this.config.base_url.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({
          model: this.config.model,
          messages: request.messages.map((message) => ({ role: message.role, content: message.content })),
          temperature: this.config.temperature,
          ...(this.config.top_p === null ? {} : { top_p: this.config.top_p }),
          max_tokens: this.config.max_tokens,
          // Provider capability mapping (transport level): the frozen provider passes a
          // JSON_SCHEMA constraint; this provider's strongest AVAILABLE mode is JSON syntax.
          ...(request.structured_output === undefined ? {} : { response_format: { type: "json_object" } }),
          stream: false
        }),
        signal: abort.signal
      });
    } catch (error) {
      if (abort.signal.aborted) throw new ModelTransportErrorV0("MODEL_TIMEOUT", null, `timed out after ${this.config.timeout_ms} ms`);
      throw new ModelTransportErrorV0("MODEL_CONNECTION_FAILURE", null, redact(String(error)));
    } finally {
      clearTimeout(timer);
    }
    const raw = await response.text().catch(() => "");
    if (!response.ok) throw new ModelTransportErrorV0("MODEL_HTTP_FAILURE", response.status, redact(raw.slice(0, 400)));
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
      // `reasoning_content` is deliberately NEVER read: it is not a scientific output and must
      // not leak into any CharacterOS state, prompt or scoring path.
      throw new ModelTransportErrorV0("MODEL_EMPTY_RESPONSE", response.status, "completion message content is not a non-empty string");
    }
    if (first?.finish_reason === "length") {
      throw new ModelTransportErrorV0("MODEL_OUTPUT_TRUNCATED", response.status, "finish_reason=length");
    }
    const usage = (parsed as {
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
        prompt_tokens_details?: { cached_tokens?: number };
        completion_tokens_details?: { reasoning_tokens?: number };
      };
    }).usage;
    if (usage !== undefined) {
      this.onUsage({
        prompt_tokens: Number(usage.prompt_tokens ?? 0),
        completion_tokens: Number(usage.completion_tokens ?? 0),
        total_tokens: Number(usage.total_tokens ?? 0),
        cached_tokens: Number(usage.prompt_tokens_details?.cached_tokens ?? 0),
        reasoning_tokens: Number(usage.completion_tokens_details?.reasoning_tokens ?? 0)
      });
    }
    const reported = (parsed as { model?: unknown }).model;
    return { content, model: typeof reported === "string" ? reported : this.config.model };
  }
}

/** Frozen retry policy + accounting, applied identically to every executor. */
function withRetryAndAccounting(
  inner: ModelTransportV0,
  executor: ExecutorId,
  observations: ExecutorRuntimeObservations
): ModelTransportV0 {
  return {
    async complete(request: ModelTransportRequestV0): Promise<ModelTransportResponseV0> {
      const system = request.messages.find((message) => message.role === "system")?.content ?? "";
      const user = request.messages.find((message) => message.role === "user")?.content ?? "";
      observations.requests.push({ system, user });
      for (let attempt = 1; attempt <= RETRY_POLICY.max_attempts; attempt += 1) {
        const startedAt = Date.now();
        try {
          const response = await inner.complete(request);
          observations.attempts.push({ executor, attempt, http_status: 200, failure_class: null, elapsed_ms: Date.now() - startedAt });
          observations.usage.requests += 1;
          return response;
        } catch (error) {
          const transportError = error instanceof ModelTransportErrorV0
            ? error
            : new ModelTransportErrorV0("MODEL_CONNECTION_FAILURE", null, redact(String(error)));
          observations.attempts.push({
            executor,
            attempt,
            http_status: transportError.http_status,
            failure_class: transportError.code,
            elapsed_ms: Date.now() - startedAt
          });
          if (!isRetryable(transportError) || attempt === RETRY_POLICY.max_attempts) throw transportError;
          await sleep((RETRY_POLICY.backoff_ms as readonly number[])[attempt - 1] ?? 3000);
        }
      }
      throw new ModelTransportErrorV0("MODEL_CONNECTION_FAILURE", null, "exhausted attempts");
    }
  };
}

export interface BuiltExecutor {
  readonly id: ExecutorId;
  readonly config: ExecutorConfig;
  readonly transport: ModelTransportV0;
  readonly observations: ExecutorRuntimeObservations;
  readonly key_fingerprint: string | null;
}

export interface BuildExecutorInput {
  readonly id: ExecutorId;
  readonly env: Record<string, string | undefined>;
}

export function emptyObservations(): ExecutorRuntimeObservations {
  return {
    usage: { requests: 0, prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, cached_tokens: 0, reasoning_tokens: 0 },
    attempts: [],
    requests: []
  };
}

/** Build ONE executor. The API path reads its credential from the environment only. */
export function buildExecutor(input: BuildExecutorInput): { readonly ok: true; readonly executor: BuiltExecutor } | { readonly ok: false; readonly missing: readonly string[]; readonly detail: string } {
  const base = executorConfig(input.id);
  const observations = emptyObservations();

  if (input.id === "LOCAL_QWEN") {
    const inner = new OllamaNativeCognitionTransportV0({
      base_url: base.base_url,
      model: base.model,
      timeout_ms: base.timeout_ms,
      num_predict: base.max_tokens
    });
    return {
      ok: true,
      executor: {
        id: base.id,
        config: base,
        transport: withRetryAndAccounting(inner as unknown as ModelTransportV0, base.id, observations),
        observations,
        key_fingerprint: null
      }
    };
  }

  const apiKey = input.env.MODEL_API_KEY;
  const configuredModel = input.env.MODEL_API_MODEL ?? base.model;
  const configuredBaseUrl = input.env.MODEL_API_BASE_URL ?? base.base_url;
  const missing = [
    ...(apiKey === undefined || apiKey.trim() === "" ? ["MODEL_API_KEY"] : []),
    ...(input.env.MODEL_API_BASE_URL !== undefined || base.base_url !== undefined ? [] : ["MODEL_API_BASE_URL"])
  ];
  if (missing.length > 0) {
    return { ok: false, missing, detail: `API executor not configured: set ${missing.join(", ")} in the environment (never in a file)` };
  }
  assertNotLocalFallbackForApi(configuredBaseUrl);
  const effective: ExecutorConfig = Object.freeze({
    ...base,
    model: configuredModel,
    base_url: configuredBaseUrl.replace(/\/$/, ""),
    max_tokens: Number(input.env.MODEL_API_MAX_TOKENS ?? base.max_tokens),
    timeout_ms: Number(input.env.MODEL_API_TIMEOUT_MS ?? base.timeout_ms),
    temperature: Number(input.env.MODEL_API_TEMPERATURE ?? base.temperature)
  });
  const onUsage = (usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number; cached_tokens: number; reasoning_tokens: number }): void => {
    observations.usage.prompt_tokens += usage.prompt_tokens;
    observations.usage.completion_tokens += usage.completion_tokens;
    observations.usage.total_tokens += usage.total_tokens;
    observations.usage.cached_tokens += usage.cached_tokens;
    observations.usage.reasoning_tokens += usage.reasoning_tokens;
  };
  const inner = new RawApiTransportV0(effective, apiKey as string, onUsage);
  return {
    ok: true,
    executor: {
      id: effective.id,
      config: effective,
      transport: withRetryAndAccounting(inner, effective.id, observations),
      observations,
      key_fingerprint: keyFingerprint(apiKey as string)
    }
  };
}
