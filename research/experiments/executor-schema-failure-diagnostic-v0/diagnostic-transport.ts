/**
 * EXPLORATORY_EXECUTOR_SCHEMA_FAILURE_DIAGNOSTIC_V0 — raw-capturing transport.
 *
 * Same endpoint, same headers, same authoritative body bytes, same timeout and
 * same frozen retry law as the calibration transport — the diagnostic difference
 * is that the FULL provider envelope is retained for offline inspection. The
 * frozen calibration transport is not modified or imported for I/O; its
 * classification vocabulary is reused so the two cannot drift apart silently.
 *
 * Retry law (unchanged): 429 / 500 / 502 / 503 / 504 / timeout / real network
 * error only. A non-JSON envelope, an empty completion and every schema/host
 * rejection are NEVER retried.
 */
import { MODEL, RETRY_LAW } from "../belief-causal-confirmatory-stochastic-v1/contract.ts";
import {
  isRetryableFailureClass,
  redact,
  TRANSPORT_BACKOFF_MS,
  TRANSPORT_ENVELOPE_JSON_PARSE_ERROR,
  TRANSPORT_EMPTY_RESPONSE,
  TRANSPORT_MAX_ATTEMPTS,
  TRANSPORT_RETRYABLE_HTTP,
  type TransportFailureClass,
  type TransportUsage
} from "../belief-causal-confirmatory-stochastic-v1/calibration-transport.ts";

export interface DiagnosticAttempt {
  readonly attempt: number;
  readonly http_status: number | null;
  readonly failure_class: TransportFailureClass;
  readonly elapsed_ms: number;
  /** The complete raw response body of THIS attempt (credential-scanned, never a header). */
  readonly raw_envelope: string;
  readonly envelope_bytes: number;
}

export interface DiagnosticTransportSuccess {
  readonly ok: true;
  /** The exact HTTP 200 body, verbatim. */
  readonly raw_envelope: string;
  readonly envelope_json_valid: boolean;
  readonly envelope_json_error: string | null;
  readonly envelope_keys: readonly string[];
  readonly content: string;
  readonly content_present: boolean;
  readonly content_type: string | null;
  readonly model: string | null;
  readonly usage: TransportUsage;
  /** Presence only — the VALUE never leaves this module. */
  readonly reasoning_content_present: boolean;
  readonly finish_reason: string | null;
  readonly attempts: readonly DiagnosticAttempt[];
}

export interface DiagnosticTransportFailure {
  readonly ok: false;
  readonly code: string;
  readonly failure_class: TransportFailureClass;
  readonly detail: string;
  readonly attempts: readonly DiagnosticAttempt[];
}

export interface DiagnosticTransport {
  readonly id: string;
  complete(serializedBody: string): Promise<DiagnosticTransportSuccess | DiagnosticTransportFailure>;
}

export interface DiagnosticTransportOptions {
  /** Test seam ONLY: production leaves this unset and posts to the real endpoint. */
  readonly fetchImpl?: typeof fetch;
  readonly backoffMs?: readonly number[];
  readonly sleepImpl?: (ms: number) => Promise<void>;
  readonly timeoutMs?: number;
}

function emptyUsage(): TransportUsage {
  return { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, cached_tokens: 0, reasoning_tokens: 0 };
}

/**
 * Credential pattern scan. Raw provider responses are saved for offline analysis,
 * but nothing key-shaped may be persisted: the envelope is redacted first and the
 * number of redactions is reported, so a redaction is visible in the evidence
 * rather than silent.
 */
export function scanAndRedactCredentialPatterns(text: string): { readonly text: string; readonly hits: number } {
  const redacted = redact(text);
  if (redacted === text) return { text, hits: 0 };
  const hits = (text.match(/sk-[A-Za-z0-9]{8,}|Bearer\s+[A-Za-z0-9._-]{8,}/gi) ?? []).length;
  return { text: redacted, hits };
}

export function createDiagnosticTransport(
  apiKey: string,
  baseUrl: string = MODEL.base_url,
  options: DiagnosticTransportOptions = {}
): DiagnosticTransport {
  if (apiKey.trim().length === 0) throw new Error("DIAGNOSTIC_TRANSPORT_NO_CREDENTIAL");
  const endpoint = `${baseUrl.replace(/\/$/, "")}/chat/completions`;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const backoff = options.backoffMs ?? TRANSPORT_BACKOFF_MS;
  const sleep = options.sleepImpl ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const timeoutMs = options.timeoutMs ?? MODEL.timeout_ms;
  return {
    id: "deepseek-openai-compatible-diagnostic",
    async complete(serializedBody: string): Promise<DiagnosticTransportSuccess | DiagnosticTransportFailure> {
      const attempts: DiagnosticAttempt[] = [];
      const record = (
        attempt: number,
        httpStatus: number | null,
        failureClass: TransportFailureClass,
        startedAt: number,
        rawEnvelope: string
      ): void => {
        const scanned = scanAndRedactCredentialPatterns(rawEnvelope);
        attempts.push({
          attempt,
          http_status: httpStatus,
          failure_class: failureClass,
          elapsed_ms: Date.now() - startedAt,
          raw_envelope: scanned.text,
          envelope_bytes: Buffer.byteLength(scanned.text, "utf8")
        });
      };
      for (let attempt = 1; attempt <= TRANSPORT_MAX_ATTEMPTS; attempt += 1) {
        const startedAt = Date.now();
        const abort = new AbortController();
        const timer = setTimeout(() => abort.abort(), timeoutMs);
        try {
          let response: Response;
          try {
            response = await fetchImpl(endpoint, {
              method: "POST",
              headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
              body: serializedBody,
              signal: abort.signal
            });
          } catch (error) {
            const aborted = abort.signal.aborted || (error instanceof Error && error.name === "AbortError");
            const failureClass: TransportFailureClass = aborted ? "TIMEOUT" : "NETWORK_ERROR";
            record(attempt, null, failureClass, startedAt, "");
            if (attempt < TRANSPORT_MAX_ATTEMPTS) {
              await sleep(backoff[attempt - 1] ?? backoff[backoff.length - 1] ?? 0);
              continue;
            }
            return {
              ok: false,
              code: aborted ? "TRANSPORT_TIMEOUT" : "TRANSPORT_NETWORK_ERROR",
              failure_class: failureClass,
              detail: redact(error instanceof Error ? error.message : String(error)),
              attempts
            };
          }
          let raw = "";
          try {
            raw = await response.text();
          } catch {
            raw = "";
          }
          if (!response.ok) {
            const retryable = (TRANSPORT_RETRYABLE_HTTP as readonly number[]).includes(response.status);
            const failureClass: TransportFailureClass = retryable
              ? (`HTTP_${response.status}_RETRYABLE` as TransportFailureClass)
              : "HTTP_NON_RETRYABLE";
            record(attempt, response.status, failureClass, startedAt, raw.slice(0, 4000));
            if (isRetryableFailureClass(failureClass) && attempt < TRANSPORT_MAX_ATTEMPTS) {
              await sleep(backoff[attempt - 1] ?? backoff[backoff.length - 1] ?? 0);
              continue;
            }
            return { ok: false, code: "TRANSPORT_HTTP_FAILURE", failure_class: failureClass, detail: redact(raw.slice(0, 300)), attempts };
          }

          const scannedRaw = scanAndRedactCredentialPatterns(raw).text;
          let parsed: unknown = null;
          let envelopeError: string | null = null;
          try {
            parsed = JSON.parse(raw);
          } catch (error) {
            envelopeError = error instanceof Error ? error.message : "unknown parse failure";
          }
          if (envelopeError !== null) {
            record(attempt, response.status, TRANSPORT_ENVELOPE_JSON_PARSE_ERROR, startedAt, scannedRaw);
            return {
              ok: false,
              code: TRANSPORT_ENVELOPE_JSON_PARSE_ERROR,
              failure_class: TRANSPORT_ENVELOPE_JSON_PARSE_ERROR,
              detail: `HTTP 200 response body is not JSON: ${envelopeError}`,
              attempts
            };
          }
          const envelope = parsed as {
            readonly choices?: readonly { readonly message?: Record<string, unknown>; readonly finish_reason?: unknown }[];
            readonly model?: unknown;
            readonly usage?: {
              readonly prompt_tokens?: number;
              readonly completion_tokens?: number;
              readonly total_tokens?: number;
              readonly prompt_tokens_details?: { readonly cached_tokens?: number };
              readonly completion_tokens_details?: { readonly reasoning_tokens?: number };
            };
          };
          const message = envelope.choices?.[0]?.message ?? {};
          const content = typeof message["content"] === "string" ? message["content"] : "";
          if (content.length === 0) {
            record(attempt, response.status, TRANSPORT_EMPTY_RESPONSE, startedAt, scannedRaw);
            return {
              ok: false,
              code: TRANSPORT_EMPTY_RESPONSE,
              failure_class: TRANSPORT_EMPTY_RESPONSE,
              detail: "completion content missing",
              attempts
            };
          }
          record(attempt, response.status, "NO_FAILURE", startedAt, scannedRaw);
          return {
            ok: true,
            raw_envelope: scannedRaw,
            envelope_json_valid: true,
            envelope_json_error: null,
            envelope_keys: typeof parsed === "object" && parsed !== null ? Object.keys(parsed as Record<string, unknown>).sort() : [],
            content,
            content_present: true,
            content_type: typeof message["content"],
            model: typeof envelope.model === "string" ? envelope.model : null,
            usage: envelope.usage === undefined
              ? emptyUsage()
              : {
                  prompt_tokens: Number(envelope.usage.prompt_tokens ?? 0),
                  completion_tokens: Number(envelope.usage.completion_tokens ?? 0),
                  total_tokens: Number(envelope.usage.total_tokens ?? 0),
                  cached_tokens: Number(envelope.usage.prompt_tokens_details?.cached_tokens ?? 0),
                  reasoning_tokens: Number(envelope.usage.completion_tokens_details?.reasoning_tokens ?? 0)
                },
            reasoning_content_present: Object.prototype.hasOwnProperty.call(message, "reasoning_content"),
            finish_reason: typeof envelope.choices?.[0]?.finish_reason === "string" ? String(envelope.choices[0]?.finish_reason) : null,
            attempts
          };
        } finally {
          clearTimeout(timer);
        }
      }
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

/** The frozen retry law this diagnostic obeys, recorded in its artifacts. */
export const DIAGNOSTIC_RETRY_LAW = Object.freeze({
  max_attempts: TRANSPORT_MAX_ATTEMPTS,
  retry_on_http: RETRY_LAW.retry_on_http,
  backoff_ms: RETRY_LAW.backoff_ms,
  retry_on_schema_invalid: false,
  retry_on_host_invalid: false,
  retry_on_envelope_parse_error: false,
  request_mutation_between_attempts: "FORBIDDEN"
});
