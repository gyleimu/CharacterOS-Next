/**
 * STRICT_SCHEMA_EXECUTOR_QUALIFICATION_V0 — research-only qualification transports.
 *
 * These are RESEARCH transports: the production adapter in `packages/runtime` is
 * untouched, because whether the formal executor changes is not decided here.
 *
 * Both transports make ONE attempt per call, enforce a timeout, keep the credential
 * in the Authorization header only, redact key-shaped text from anything retained,
 * and NEVER retry a constraint/validation failure. Only real transport failures
 * (429 / 5xx / timeout / network reset) are transport-retryable, and this slice does
 * not retry them either: a capability question needs one clean observation.
 */
import { MODEL } from "../belief-causal-confirmatory-stochastic-v1/contract.ts";
import { scanAndRedactCredentialPatterns } from "../executor-schema-failure-diagnostic-v0/diagnostic-transport.ts";

export interface QualificationResponse {
  readonly ok: boolean;
  readonly http_status: number | null;
  readonly raw_envelope: string | null;
  readonly content: string | null;
  readonly model: string | null;
  readonly error_class: string | null;
  readonly error_message: string | null;
  readonly elapsed_ms: number;
}

export interface QualificationTransport {
  readonly id: string;
  /** `schema` is the constraint; `prompt` the user message. */
  complete(input: { readonly prompt: string; readonly schema: Readonly<Record<string, unknown>> }): Promise<QualificationResponse>;
}

export interface QualificationTransportOptions {
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
  readonly maxTokens?: number;
}

function parseContentFromOpenAiEnvelope(raw: string): { content: string | null; model: string | null; error: string | null } {
  try {
    const parsed = JSON.parse(raw) as {
      choices?: readonly { message?: { content?: unknown } }[];
      model?: unknown;
      error?: { message?: unknown };
    };
    if (typeof parsed.error?.message === "string") return { content: null, model: null, error: parsed.error.message };
    return {
      content: typeof parsed.choices?.[0]?.message?.content === "string" ? String(parsed.choices[0]?.message?.content) : null,
      model: typeof parsed.model === "string" ? parsed.model : null,
      error: null
    };
  } catch {
    return { content: null, model: null, error: "response envelope is not JSON" };
  }
}

/**
 * OpenAI-compatible research transport with a caller-supplied `response_format`.
 * This is what a strict-schema provider would need, and it is deliberately NOT
 * wired into production.
 */
export function createStrictOpenAiTransport(
  apiKey: string,
  baseUrl: string,
  model: string,
  responseFormat: Readonly<Record<string, unknown>>,
  options: QualificationTransportOptions = {}
): QualificationTransport {
  const endpoint = `${baseUrl.replace(/\/$/, "")}/chat/completions`;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? 120000;
  return {
    id: `openai-compatible-strict:${model}`,
    async complete(input) {
      const startedAt = Date.now();
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), timeoutMs);
      try {
        let response: Response;
        try {
          response = await fetchImpl(endpoint, {
            method: "POST",
            headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({
              model,
              messages: [{ role: "user", content: input.prompt }],
              temperature: 0,
              max_tokens: options.maxTokens ?? 512,
              stream: false,
              response_format: responseFormat
            }),
            signal: abort.signal
          });
        } catch (error) {
          return {
            ok: false,
            http_status: null,
            raw_envelope: null,
            content: null,
            model: null,
            error_class: abort.signal.aborted ? "TIMEOUT" : "NETWORK_ERROR",
            error_message: error instanceof Error ? error.message : String(error),
            elapsed_ms: Date.now() - startedAt
          };
        }
        const raw = await response.text().catch(() => "");
        const scanned = scanAndRedactCredentialPatterns(raw);
        if (!response.ok) {
          const parsed = parseContentFromOpenAiEnvelope(raw);
          return {
            ok: false,
            http_status: response.status,
            raw_envelope: scanned.text.slice(0, 2000),
            content: null,
            model: null,
            error_class: "HTTP_FAILURE",
            error_message: parsed.error ?? scanned.text.slice(0, 300),
            elapsed_ms: Date.now() - startedAt
          };
        }
        const parsed = parseContentFromOpenAiEnvelope(raw);
        return {
          ok: true,
          http_status: response.status,
          raw_envelope: scanned.text,
          content: parsed.content,
          model: parsed.model,
          error_class: parsed.error === null ? null : "ENVELOPE_PARSE",
          error_message: parsed.error,
          elapsed_ms: Date.now() - startedAt
        };
      } finally {
        clearTimeout(timer);
      }
    }
  };
}

/**
 * Ollama-NATIVE research transport: posts the schema as `format`, which the local
 * runtime converts into a grammar. No credential is involved.
 */
export function createOllamaGrammarTransport(
  baseUrl: string,
  model: string,
  options: QualificationTransportOptions = {}
): QualificationTransport {
  const endpoint = `${baseUrl.replace(/\/$/, "")}/api/chat`;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? 180000;
  return {
    id: `ollama-native-grammar:${model}`,
    async complete(input) {
      const startedAt = Date.now();
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), timeoutMs);
      try {
        let response: Response;
        try {
          response = await fetchImpl(endpoint, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              model,
              messages: [{ role: "user", content: input.prompt }],
              format: input.schema,
              think: false,
              stream: false,
              options: { temperature: 0, num_predict: options.maxTokens ?? 512 }
            }),
            signal: abort.signal
          });
        } catch (error) {
          return {
            ok: false,
            http_status: null,
            raw_envelope: null,
            content: null,
            model: null,
            error_class: abort.signal.aborted ? "TIMEOUT" : "NETWORK_ERROR",
            error_message: error instanceof Error ? error.message : String(error),
            elapsed_ms: Date.now() - startedAt
          };
        }
        const raw = await response.text().catch(() => "");
        const scanned = scanAndRedactCredentialPatterns(raw);
        if (!response.ok) {
          return {
            ok: false,
            http_status: response.status,
            raw_envelope: scanned.text.slice(0, 2000),
            content: null,
            model: null,
            error_class: "HTTP_FAILURE",
            error_message: scanned.text.slice(0, 300),
            elapsed_ms: Date.now() - startedAt
          };
        }
        try {
          const parsed = JSON.parse(raw) as {
            model?: unknown;
            message?: { content?: unknown };
            error?: unknown;
            done_reason?: unknown;
          };
          return {
            ok: true,
            http_status: response.status,
            raw_envelope: scanned.text,
            content: typeof parsed.message?.content === "string" ? String(parsed.message.content) : null,
            model: typeof parsed.model === "string" ? parsed.model : null,
            error_class: parsed.error === undefined ? null : "OLLAMA_ERROR",
            error_message: parsed.error === undefined ? null : JSON.stringify(parsed.error).slice(0, 300),
            elapsed_ms: Date.now() - startedAt
          };
        } catch {
          return {
            ok: true,
            http_status: response.status,
            raw_envelope: scanned.text,
            content: null,
            model: null,
            error_class: "ENVELOPE_PARSE",
            error_message: "native response envelope is not JSON",
            elapsed_ms: Date.now() - startedAt
          };
        }
      } finally {
        clearTimeout(timer);
      }
    }
  };
}

/** The Ollama base URL used by the local structural control (never hardcoded into production). */
export const OLLAMA_LOCAL_BASE_URL = "http://127.0.0.1:11434" as const;
export const FORMAL_EXECUTOR_MODEL = MODEL.id;
