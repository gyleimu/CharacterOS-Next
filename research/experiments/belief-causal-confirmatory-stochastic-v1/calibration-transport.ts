/**
 * BELIEF_CAUSAL_CONFIRMATORY_STOCHASTIC_V1 — experiment-local minimal transport adapter.
 *
 * Scope is deliberately minimal (an OpenAI-compatible POST with timeout, the
 * frozen retry law and usage extraction). It is NOT a general provider or model
 * framework, it carries no fallback of any kind, and it is the ONLY place in this
 * experiment that touches the network.
 *
 * AUTHORITATIVE BYTES: the caller hands in the ONE authoritative serialized body
 * (`canonicalJson`). The transport sends that exact string and a retry reuses the
 * identical string — there is no second serialization anywhere in this module.
 * `bodyHash` is passed through for DIAGNOSTIC attempt ledgers only: it is never
 * re-derived here and never authoritative.
 *
 * FAILURE CLASSIFICATION (the point of this module): a transport/network
 * exception and an HTTP-envelope parse failure are DIFFERENT KINDS of event.
 *   RETRYABLE     — 429 / 5xx / timeout / real network error, per the frozen law.
 *   NON-RETRYABLE — a 200 response whose body is not JSON, or an envelope whose
 *                   `message.content` is missing, or a non-retryable HTTP status.
 * A non-JSON 200 envelope is NEVER retried and never disguised as a network
 * reset: it returns exactly ONE raw attempt with an explicit failure class.
 *
 * Credential handling: the API key is read from the environment by the caller and
 * passed in; it appears ONLY in the HTTP `Authorization` header. It is never
 * printed, hashed, returned, serialized into evidence or included in any
 * request-body hash. Every failure detail that could contain a response body or
 * an error message goes through `redact`.
 */
import { MODEL, RETRY_LAW } from "./contract.ts";

export interface TransportUsage {
  readonly prompt_tokens: number;
  readonly completion_tokens: number;
  readonly total_tokens: number;
  readonly cached_tokens: number;
  readonly reasoning_tokens: number;
}

/**
 * Explicit, never-null failure class for EVERY attempt ledger entry, including
 * successful ones. A null class would hide an unclassified event.
 */
export type TransportFailureClass =
  | "NO_FAILURE"
  | "HTTP_429_RETRYABLE"
  | "HTTP_500_RETRYABLE"
  | "HTTP_502_RETRYABLE"
  | "HTTP_503_RETRYABLE"
  | "HTTP_504_RETRYABLE"
  | "HTTP_NON_RETRYABLE"
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "TRANSPORT_ENVELOPE_JSON_PARSE_ERROR"
  | "TRANSPORT_EMPTY_RESPONSE"
  | "ATTEMPTS_EXHAUSTED";

/** The ONLY classes the frozen retry law permits a further attempt for. */
export const RETRYABLE_FAILURE_CLASSES: readonly TransportFailureClass[] = Object.freeze([
  "HTTP_429_RETRYABLE",
  "HTTP_500_RETRYABLE",
  "HTTP_502_RETRYABLE",
  "HTTP_503_RETRYABLE",
  "HTTP_504_RETRYABLE",
  "TIMEOUT",
  "NETWORK_ERROR"
]);

/** Non-retryable outcomes, each with a stable machine-readable code. */
export const TRANSPORT_ENVELOPE_JSON_PARSE_ERROR = "TRANSPORT_ENVELOPE_JSON_PARSE_ERROR" as const;
export const TRANSPORT_EMPTY_RESPONSE = "TRANSPORT_EMPTY_RESPONSE" as const;
export const TRANSPORT_HTTP_FAILURE = "TRANSPORT_HTTP_FAILURE" as const;
export const TRANSPORT_TIMEOUT = "TRANSPORT_TIMEOUT" as const;
export const TRANSPORT_NETWORK_ERROR = "TRANSPORT_NETWORK_ERROR" as const;

export function isRetryableFailureClass(failureClass: TransportFailureClass): boolean {
  return RETRYABLE_FAILURE_CLASSES.includes(failureClass);
}

export interface TransportAttempt {
  readonly attempt: number;
  readonly http_status: number | null;
  /** ALWAYS an explicit class — never null. */
  readonly failure_class: TransportFailureClass;
  readonly elapsed_ms: number;
  /** Diagnostic echo of the caller's body hash: identical across one trial's attempts. */
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
  /** The explicit class of the LAST attempt (the one that produced this outcome). */
  readonly failure_class: TransportFailureClass;
  readonly detail: string;
  readonly attempts: readonly TransportAttempt[];
}

export interface MinimalTransport {
  readonly id: string;
  /**
   * @param serializedBody the ONE authoritative serialized request body — sent verbatim.
   * @param bodyHash       DIAGNOSTIC echo only; never an authority.
   */
  complete(serializedBody: string, bodyHash: string): Promise<TransportResult | TransportFailure>;
}

/** The frozen retry/backoff law, imported — never re-typed. */
export const TRANSPORT_MAX_ATTEMPTS = RETRY_LAW.max_attempts;
export const TRANSPORT_RETRYABLE_HTTP = RETRY_LAW.retry_on_http;
export const TRANSPORT_BACKOFF_MS = RETRY_LAW.backoff_ms;

export interface TransportOptions {
  /** Test seam ONLY: production always uses the frozen backoff law. */
  readonly backoffMs?: readonly number[];
  /** Test seam ONLY: defaults to the global fetch. */
  readonly fetchImpl?: typeof fetch;
  readonly sleepImpl?: (ms: number) => Promise<void>;
}

export function redact(text: string): string {
  return text
    .replace(/sk-[A-Za-z0-9]{8,}/g, "sk-<redacted>")
    .replace(/Bearer\s+[A-Za-z0-9._-]{8,}/gi, "Bearer <redacted>");
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryableClassFor(status: number): TransportFailureClass {
  return (TRANSPORT_RETRYABLE_HTTP as readonly number[]).includes(status)
    ? (`HTTP_${status}_RETRYABLE` as TransportFailureClass)
    : "HTTP_NON_RETRYABLE";
}

/**
 * Builds the real transport. Requires the credential from the environment
 * (never a file, never an argument persisted anywhere).
 */
export function createDeepSeekTransport(
  apiKey: string,
  baseUrl: string = MODEL.base_url,
  options: TransportOptions = {}
): MinimalTransport {
  if (apiKey.trim().length === 0) throw new Error("CALIBRATION_TRANSPORT_NO_CREDENTIAL");
  const endpoint = `${baseUrl.replace(/\/$/, "")}/chat/completions`;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const backoff = options.backoffMs ?? TRANSPORT_BACKOFF_MS;
  const sleep = options.sleepImpl ?? defaultSleep;
  return {
    id: "deepseek-openai-compatible",
    async complete(serializedBody: string, bodyHash: string): Promise<TransportResult | TransportFailure> {
      const attempts: TransportAttempt[] = [];
      const record = (attempt: number, httpStatus: number | null, failureClass: TransportFailureClass, startedAt: number): void => {
        attempts.push({
          attempt,
          http_status: httpStatus,
          failure_class: failureClass,
          elapsed_ms: Date.now() - startedAt,
          body_hash: bodyHash
        });
      };
      const pause = async (attempt: number): Promise<void> => {
        await sleep(backoff[attempt - 1] ?? backoff[backoff.length - 1] ?? 0);
      };

      for (let attempt = 1; attempt <= TRANSPORT_MAX_ATTEMPTS; attempt += 1) {
        const startedAt = Date.now();
        const abort = new AbortController();
        const timer = setTimeout(() => abort.abort(), MODEL.timeout_ms);
        try {
          let response: Response;
          try {
            // THE authoritative body: the exact string handed in, byte for byte.
            response = await fetchImpl(endpoint, {
              method: "POST",
              headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
              body: serializedBody,
              signal: abort.signal
            });
          } catch (error) {
            // A REAL network/socket/timeout exception. This is the ONLY path that
            // may profit from the frozen retry law. An abort is recognised either
            // by the controller's signal or by the error's own name, because the
            // two are not guaranteed to agree across engines.
            const aborted = abort.signal.aborted || (error instanceof Error && error.name === "AbortError");
            const failureClass: TransportFailureClass = aborted ? "TIMEOUT" : "NETWORK_ERROR";
            record(attempt, null, failureClass, startedAt);
            if (attempt < TRANSPORT_MAX_ATTEMPTS) {
              await pause(attempt);
              continue;
            }
            return {
              ok: false,
              code: aborted ? TRANSPORT_TIMEOUT : TRANSPORT_NETWORK_ERROR,
              failure_class: failureClass,
              detail: redact(error instanceof Error ? error.message : String(error)),
              attempts
            };
          }

          let raw = "";
          try {
            raw = await response.text();
          } catch (error) {
            raw = "";
            void error;
          }

          if (!response.ok) {
            const failureClass = retryableClassFor(response.status);
            record(attempt, response.status, failureClass, startedAt);
            if (isRetryableFailureClass(failureClass) && attempt < TRANSPORT_MAX_ATTEMPTS) {
              await pause(attempt);
              continue;
            }
            return {
              ok: false,
              code: TRANSPORT_HTTP_FAILURE,
              failure_class: failureClass,
              detail: redact(raw.slice(0, 300)),
              attempts
            };
          }

          // ---- HTTP 200: envelope parsing is NOT a transport exception --------
          let parsed: {
            choices?: readonly { message?: { content?: unknown } }[];
            model?: unknown;
            usage?: {
              prompt_tokens?: number;
              completion_tokens?: number;
              total_tokens?: number;
              prompt_tokens_details?: { cached_tokens?: number };
              completion_tokens_details?: { reasoning_tokens?: number };
            };
          };
          try {
            parsed = JSON.parse(raw) as typeof parsed;
          } catch (error) {
            // NON-RETRYABLE: exactly one raw attempt, explicit parse class, HTTP 200
            // recorded. It must never enter a generic catch/retry path.
            record(attempt, response.status, TRANSPORT_ENVELOPE_JSON_PARSE_ERROR, startedAt);
            return {
              ok: false,
              code: TRANSPORT_ENVELOPE_JSON_PARSE_ERROR,
              failure_class: TRANSPORT_ENVELOPE_JSON_PARSE_ERROR,
              detail: redact(
                `HTTP 200 response body is not JSON: ${error instanceof Error ? error.message : "unknown failure"}`
              ),
              attempts
            };
          }

          const content = parsed.choices?.[0]?.message?.content;
          if (typeof content !== "string" || content.length === 0) {
            // NON-RETRYABLE: an empty completion is an executor-output fact, not a
            // transport hiccup. One raw attempt, explicit class.
            record(attempt, response.status, TRANSPORT_EMPTY_RESPONSE, startedAt);
            return {
              ok: false,
              code: TRANSPORT_EMPTY_RESPONSE,
              failure_class: TRANSPORT_EMPTY_RESPONSE,
              detail: "completion content missing",
              attempts
            };
          }

          record(attempt, response.status, "NO_FAILURE", startedAt);
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
        } finally {
          clearTimeout(timer);
        }
      }
      // Unreachable in practice: the loop always returns. Fail closed, explicitly.
      return {
        ok: false,
        code: "TRANSPORT_EXHAUSTED",
        failure_class: "ATTEMPTS_EXHAUSTED",
        detail: "attempts exhausted",
        attempts
      };
    }
  };
}
