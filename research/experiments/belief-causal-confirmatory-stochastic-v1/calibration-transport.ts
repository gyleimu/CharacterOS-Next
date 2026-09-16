/**
 * BELIEF_CAUSAL_CONFIRMATORY_STOCHASTIC_V1 — experiment-local minimal transport adapter.
 *
 * Scope is deliberately minimal (an OpenAI-compatible POST with timeout, the
 * frozen retry law and usage extraction). It is NOT a general provider or model
 * framework, it carries no fallback of any kind, and it is the ONLY place in this
 * experiment that touches the network.
 *
 * Credential handling: the API key is read from the environment by the caller and
 * passed in; it appears ONLY in the HTTP `Authorization` header. It is never
 * printed, hashed, returned, serialized into evidence or included in any
 * request-body hash.
 */
import { MODEL } from "./contract.ts";

export interface TransportUsage {
  readonly prompt_tokens: number;
  readonly completion_tokens: number;
  readonly total_tokens: number;
  readonly cached_tokens: number;
  readonly reasoning_tokens: number;
}

export interface TransportAttempt {
  readonly attempt: number;
  readonly http_status: number | null;
  readonly failure_class: string | null;
  readonly elapsed_ms: number;
  /** Body hash of THIS attempt: must be identical across attempts of one trial. */
  readonly body_hash: string;
}

export interface TransportResult {
  readonly ok: true;
  readonly content: string;
  readonly model: string;
  readonly usage: TransportUsage;
  readonly attempts: readonly TransportAttempt[];
}

export interface TransportFailure {
  readonly ok: false;
  readonly code: string;
  readonly detail: string;
  readonly attempts: readonly TransportAttempt[];
}

export interface MinimalTransport {
  readonly id: string;
  complete(body: unknown, bodyHash: string): Promise<TransportResult | TransportFailure>;
}

const RETRYABLE_HTTP = [429, 500, 502, 503, 504] as const;
const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [4000, 12000] as const;

export function redact(text: string): string {
  return text
    .replace(/sk-[A-Za-z0-9]{8,}/g, "sk-<redacted>")
    .replace(/Bearer\s+[A-Za-z0-9._-]{8,}/gi, "Bearer <redacted>");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Builds the real transport. Requires the credential from the environment
 * (never a file, never an argument persisted anywhere).
 */
export function createDeepSeekTransport(apiKey: string, baseUrl: string = MODEL.base_url): MinimalTransport {
  if (apiKey.trim().length === 0) throw new Error("CALIBRATION_TRANSPORT_NO_CREDENTIAL");
  const endpoint = `${baseUrl.replace(/\/$/, "")}/chat/completions`;
  return {
    id: "deepseek-openai-compatible",
    async complete(body: unknown, bodyHash: string): Promise<TransportResult | TransportFailure> {
      const attempts: TransportAttempt[] = [];
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
        const startedAt = Date.now();
        const abort = new AbortController();
        const timer = setTimeout(() => abort.abort(), MODEL.timeout_ms);
        try {
          const response = await fetch(endpoint, {
            method: "POST",
            headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
            body: JSON.stringify(body),
            signal: abort.signal
          });
          const raw = await response.text().catch(() => "");
          if (!response.ok) {
            attempts.push({
              attempt,
              http_status: response.status,
              failure_class: "HTTP_FAILURE",
              elapsed_ms: Date.now() - startedAt,
              body_hash: bodyHash
            });
            if ((RETRYABLE_HTTP as readonly number[]).includes(response.status) && attempt < MAX_ATTEMPTS) {
              await sleep(BACKOFF_MS[attempt - 1] ?? 12000);
              continue;
            }
            return { ok: false, code: "TRANSPORT_HTTP_FAILURE", detail: redact(raw.slice(0, 300)), attempts };
          }
          const parsed = JSON.parse(raw) as {
            choices?: readonly { message?: { content?: unknown }; finish_reason?: unknown }[];
            model?: unknown;
            usage?: {
              prompt_tokens?: number;
              completion_tokens?: number;
              total_tokens?: number;
              prompt_tokens_details?: { cached_tokens?: number };
              completion_tokens_details?: { reasoning_tokens?: number };
            };
          };
          const content = parsed.choices?.[0]?.message?.content;
          attempts.push({
            attempt,
            http_status: response.status,
            failure_class: null,
            elapsed_ms: Date.now() - startedAt,
            body_hash: bodyHash
          });
          if (typeof content !== "string" || content.length === 0) {
            // An empty/absent completion is a TRANSPORT-class failure (never a
            // schema verdict): retry legally, byte-identically.
            if (attempt < MAX_ATTEMPTS) {
              await sleep(BACKOFF_MS[attempt - 1] ?? 12000);
              continue;
            }
            return { ok: false, code: "TRANSPORT_EMPTY_RESPONSE", detail: "completion content missing", attempts };
          }
          // `reasoning_content` is deliberately never read: not a scientific
          // output, and it must not reach any prompt, score or state.
          return {
            ok: true,
            content,
            model: typeof parsed.model === "string" ? parsed.model : MODEL.id,
            usage: {
              prompt_tokens: Number(parsed.usage?.prompt_tokens ?? 0),
              completion_tokens: Number(parsed.usage?.completion_tokens ?? 0),
              total_tokens: Number(parsed.usage?.total_tokens ?? 0),
              cached_tokens: Number(parsed.usage?.prompt_tokens_details?.cached_tokens ?? 0),
              reasoning_tokens: Number(parsed.usage?.completion_tokens_details?.reasoning_tokens ?? 0)
            },
            attempts
          };
        } catch (error) {
          const aborted = abort.signal.aborted;
          attempts.push({
            attempt,
            http_status: null,
            failure_class: aborted ? "TIMEOUT" : "TRANSPORT_RESET",
            elapsed_ms: Date.now() - startedAt,
            body_hash: bodyHash
          });
          if (attempt < MAX_ATTEMPTS) {
            await sleep(BACKOFF_MS[attempt - 1] ?? 12000);
            continue;
          }
          return {
            ok: false,
            code: aborted ? "TRANSPORT_TIMEOUT" : "TRANSPORT_RESET",
            detail: redact(error instanceof Error ? error.message : String(error)),
            attempts
          };
        } finally {
          clearTimeout(timer);
        }
      }
      return { ok: false, code: "TRANSPORT_EXHAUSTED", detail: "attempts exhausted", attempts };
    }
  };
}
