/**
 * BELIEF_CAUSAL_VALIDATION_V0 — research-only model transport.
 *
 * The API executor fixed by the contract: an OpenAI-compatible single-attempt
 * transport wrapped in the frozen retry/accounting decorator. Credentials come
 * from the environment ONLY and are never written to any artifact.
 *
 * `reasoning_content` is deliberately NEVER read: it is not a scientific output
 * and must not leak into scoring, prompts, CharacterOS state or interventions.
 */
import { createHash } from "node:crypto";

import { MODEL, RETRY_POLICY } from "./contract.ts";

const runtimeDist = new URL("../../../packages/runtime/dist/", import.meta.url).href;
const { ModelTransportErrorV0 } = await import(`${runtimeDist}transports/model-transport.js`);

export interface ModelTransportRequestShape {
  readonly messages: readonly { readonly role: string; readonly content: string }[];
  readonly structured_output?: unknown;
}
export interface ModelTransportResponseShape {
  readonly content: string;
  readonly model: string;
}

export interface UsageTotals {
  requests: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cached_tokens: number;
  reasoning_tokens: number;
}

export interface CapturedRequest {
  readonly role: "cognition" | "language";
  readonly system: string;
  readonly user: string;
  readonly structured_output: boolean;
}

export interface AttemptRecord {
  readonly role: "cognition" | "language";
  readonly attempt: number;
  readonly http_status: number | null;
  readonly failure_class: string | null;
  readonly elapsed_ms: number;
}

export interface TransportObservations {
  readonly usage: UsageTotals;
  readonly attempts: AttemptRecord[];
  readonly requests: CapturedRequest[];
  readonly responses: { readonly role: "cognition" | "language"; readonly content: string }[];
  readonly key_fingerprint: string;
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assertNotLocalFallback(baseUrl: string): void {
  const normalized = baseUrl.trim().toLowerCase();
  if (
    /^https?:\/\/(127\.0\.0\.1|localhost|0\.0\.0\.0|\[::1\])(:|\/|$)/.test(normalized) ||
    normalized.includes(":11434")
  ) {
    throw new Error(`BELIEF_CAUSAL: API base_url ${baseUrl} resolves to a LOCAL endpoint; local fallback is FORBIDDEN`);
  }
}

/** Exactly one attempt; no repair, no fallback, no local model. */
class RawApiTransport {
  private readonly apiKey: string;
  private readonly usage: UsageTotals;
  private readonly baseUrl: string;

  constructor(apiKey: string, usage: UsageTotals) {
    this.apiKey = apiKey;
    this.usage = usage;
    this.baseUrl = (process.env["MODEL_API_BASE_URL"] ?? MODEL.base_url).replace(/\/$/, "");
  }

  async complete(request: ModelTransportRequestShape): Promise<ModelTransportResponseShape> {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), MODEL.timeout_ms);
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({
          model: process.env["MODEL_API_MODEL"] ?? MODEL.id,
          messages: request.messages.map((message) => ({ role: message.role, content: message.content })),
          temperature: MODEL.temperature,
          max_tokens: MODEL.max_tokens,
          ...(request.structured_output === undefined ? {} : { response_format: { type: "json_object" } }),
          stream: false
        }),
        signal: abort.signal
      });
    } catch (error) {
      if (abort.signal.aborted) {
        throw new ModelTransportErrorV0("MODEL_TIMEOUT", null, `timed out after ${MODEL.timeout_ms} ms`);
      }
      throw new ModelTransportErrorV0("MODEL_CONNECTION_FAILURE", null, redact(String(error)));
    } finally {
      clearTimeout(timer);
    }
    const raw = await response.text().catch(() => "");
    if (!response.ok) {
      throw new ModelTransportErrorV0("MODEL_HTTP_FAILURE", response.status, redact(raw.slice(0, 400)));
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
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
        prompt_tokens_details?: { cached_tokens?: number };
        completion_tokens_details?: { reasoning_tokens?: number };
      };
    }).usage;
    if (usage !== undefined) {
      this.usage.prompt_tokens += Number(usage.prompt_tokens ?? 0);
      this.usage.completion_tokens += Number(usage.completion_tokens ?? 0);
      this.usage.total_tokens += Number(usage.total_tokens ?? 0);
      this.usage.cached_tokens += Number(usage.prompt_tokens_details?.cached_tokens ?? 0);
      this.usage.reasoning_tokens += Number(usage.completion_tokens_details?.reasoning_tokens ?? 0);
    }
    this.usage.requests += 1;
    const reported = (parsed as { model?: unknown }).model;
    return { content, model: typeof reported === "string" ? reported : MODEL.id };
  }
}

function isRetryable(error: InstanceType<typeof ModelTransportErrorV0>): boolean {
  if (error.http_status !== null) return RETRY_POLICY.retry_on_http.includes(error.http_status);
  return RETRY_POLICY.retry_on_transport.includes(error.code);
}

export interface BuiltTransport {
  readonly transport: { complete(request: ModelTransportRequestShape): Promise<ModelTransportResponseShape> };
  readonly observations: TransportObservations;
}

/**
 * Builds ONE captured+retried transport for a scene. The role label is used for
 * accounting only and never enters a request.
 */
export function buildCapturedTransport(input: {
  readonly role: "cognition" | "language";
  readonly env: Record<string, string | undefined>;
}): { readonly ok: true; readonly built: BuiltTransport } | { readonly ok: false; readonly missing: readonly string[]; readonly detail: string } {
  const apiKey = input.env["MODEL_API_KEY"];
  if (apiKey === undefined || apiKey.trim() === "") {
    return { ok: false, missing: ["MODEL_API_KEY"], detail: "API credential is read from the environment only" };
  }
  const baseUrl = input.env["MODEL_API_BASE_URL"] ?? MODEL.base_url;
  assertNotLocalFallback(baseUrl);
  const usage: UsageTotals = {
    requests: 0,
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
    cached_tokens: 0,
    reasoning_tokens: 0
  };
  const observations: TransportObservations = {
    usage,
    attempts: [],
    requests: [],
    responses: [],
    key_fingerprint: keyFingerprint(apiKey)
  };
  const inner = new RawApiTransport(apiKey, usage);
  const transport = {
    async complete(request: ModelTransportRequestShape): Promise<ModelTransportResponseShape> {
      const system = request.messages.find((message) => message.role === "system")?.content ?? "";
      const user = request.messages.find((message) => message.role === "user")?.content ?? "";
      observations.requests.push({ role: input.role, system, user, structured_output: request.structured_output !== undefined });
      for (let attempt = 1; attempt <= RETRY_POLICY.max_attempts; attempt += 1) {
        const startedAt = Date.now();
        try {
          const response = await inner.complete(request);
          observations.attempts.push({
            role: input.role,
            attempt,
            http_status: 200,
            failure_class: null,
            elapsed_ms: Date.now() - startedAt
          });
          observations.responses.push({ role: input.role, content: response.content });
          return response;
        } catch (error) {
          const transportError = error instanceof ModelTransportErrorV0
            ? error
            : new ModelTransportErrorV0("MODEL_CONNECTION_FAILURE", null, redact(String(error)));
          observations.attempts.push({
            role: input.role,
            attempt,
            http_status: transportError.http_status,
            failure_class: transportError.code,
            elapsed_ms: Date.now() - startedAt
          });
          if (!isRetryable(transportError) || attempt === RETRY_POLICY.max_attempts) throw transportError;
          await sleep(RETRY_POLICY.backoff_ms[attempt - 1] ?? 12000);
        }
      }
      throw new ModelTransportErrorV0("MODEL_CONNECTION_FAILURE", null, "exhausted attempts");
    }
  };
  return { ok: true, built: { transport, observations } };
}
