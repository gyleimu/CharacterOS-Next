/**
 * BELIEF_CAUSAL_CONFIRMATORY_STOCHASTIC_V1 — HTTP transport classification tests.
 *
 * T1–T6, T22–T24. Every case injects a MOCK fetch: zero real network calls, zero
 * credentials (the fixture key is a literal that never leaves the mock) and zero
 * model calls. These tests exist because the audited transport funnelled an
 * HTTP-200-non-JSON envelope into the generic catch and RETRIED it as if the
 * network had reset — an envelope parse error is not a transport exception.
 */
import { describe, expect, it } from "vitest";

import {
  createDeepSeekTransport,
  RETRYABLE_FAILURE_CLASSES,
  TRANSPORT_EMPTY_RESPONSE,
  TRANSPORT_ENVELOPE_JSON_PARSE_ERROR,
  TRANSPORT_HTTP_FAILURE,
  TRANSPORT_MAX_ATTEMPTS,
  TRANSPORT_NETWORK_ERROR,
  TRANSPORT_TIMEOUT
} from "./calibration-transport.ts";

const TEST_KEY = "sk-test-key-not-a-credential-000000";
const BODY = '{"model":"deepseek-flash","messages":[],"temperature":0}';
const BODY_HASH = "sha256:" + "b".repeat(64);

interface FetchCall {
  readonly url: string;
  readonly body: unknown;
  readonly headers: Record<string, string>;
}

function mockFetch(script: readonly (() => Response)[]): { readonly fetchImpl: typeof fetch; readonly calls: FetchCall[] } {
  const calls: FetchCall[] = [];
  let index = 0;
  const fetchImpl = (async (url: unknown, init: unknown) => {
    const options = (init ?? {}) as { body?: unknown; headers?: Record<string, string> };
    calls.push({ url: String(url), body: options.body, headers: options.headers ?? {} });
    const entry = script[Math.min(index, script.length - 1)];
    index += 1;
    if (entry === undefined) throw new Error("mock fetch script exhausted");
    return entry();
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

function jsonResponse(status: number, body: string): Response {
  return new Response(body, { status, headers: { "content-type": "application/json" } });
}

function completion(content: string, model = "deepseek-flash"): Response {
  return jsonResponse(200, JSON.stringify({ model, choices: [{ message: { content }, finish_reason: "stop" }], usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 } }));
}

function transportWith(script: readonly (() => Response)[]): {
  readonly transport: ReturnType<typeof createDeepSeekTransport>;
  readonly calls: FetchCall[];
} {
  const mock = mockFetch(script);
  return {
    transport: createDeepSeekTransport(TEST_KEY, "https://api.example.invalid", {
      fetchImpl: mock.fetchImpl,
      // The frozen backoff law is unchanged; the WAIT is zeroed so the suite does
      // not sleep 16 s on a retry case.
      backoffMs: [0, 0],
      sleepImpl: async () => undefined
    }),
    calls: mock.calls
  };
}

describe("TRANSPORT — T1 envelope parse failure on HTTP 200", () => {
  it("TEST_T1_ENVELOPE_PARSE: status 200 + non-JSON body is NON-RETRYABLE with exactly ONE raw attempt", async () => {
    const { transport, calls } = transportWith([() => jsonResponse(200, "not json")]);
    const outcome = await transport.complete(BODY, BODY_HASH);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error("unreachable");
    expect(outcome.code).toBe(TRANSPORT_ENVELOPE_JSON_PARSE_ERROR);
    expect(outcome.failure_class).toBe(TRANSPORT_ENVELOPE_JSON_PARSE_ERROR);
    expect(outcome.attempts).toHaveLength(1);
    expect(outcome.attempts[0]?.http_status).toBe(200);
    expect(outcome.attempts[0]?.failure_class).toBe(TRANSPORT_ENVELOPE_JSON_PARSE_ERROR);
    expect(calls).toHaveLength(1);
    expect(outcome.detail).toMatch(/not JSON/i);
  });

  it("TEST_T1B: a parse failure never enters the generic catch/retry path (three non-JSON bodies are never retried)", async () => {
    const { transport, calls } = transportWith([
      () => jsonResponse(200, "<html>gateway</html>"),
      () => jsonResponse(200, "<html>gateway</html>"),
      () => jsonResponse(200, "<html>gateway</html>")
    ]);
    const outcome = await transport.complete(BODY, BODY_HASH);
    expect(outcome.ok).toBe(false);
    expect(calls).toHaveLength(1);
  });

  it("TEST_T1C: the envelope parse failure is NOT in the frozen retryable set", () => {
    expect(RETRYABLE_FAILURE_CLASSES).not.toContain(TRANSPORT_ENVELOPE_JSON_PARSE_ERROR);
    expect(RETRYABLE_FAILURE_CLASSES).not.toContain(TRANSPORT_EMPTY_RESPONSE);
    expect(RETRYABLE_FAILURE_CLASSES).toContain("TIMEOUT");
    expect(RETRYABLE_FAILURE_CLASSES).toContain("NETWORK_ERROR");
  });
});

describe("TRANSPORT — T2/T3 real exceptions do retry under the frozen law", () => {
  it("TEST_T2_NETWORK_RESET: a thrown network error is retried, and a later success completes the trial", async () => {
    const { transport, calls } = transportWith([
      () => {
        throw new TypeError("fetch failed: ECONNRESET");
      },
      () => completion("{}")
    ]);
    const outcome = await transport.complete(BODY, BODY_HASH);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error("unreachable");
    expect(calls).toHaveLength(2);
    expect(outcome.attempts).toHaveLength(2);
    expect(outcome.attempts[0]?.failure_class).toBe("NETWORK_ERROR");
    expect(outcome.attempts[1]?.failure_class).toBe("NO_FAILURE");
    expect(outcome.attempts.every((attempt) => attempt.body_hash === BODY_HASH)).toBe(true);
  });

  it("TEST_T2B: a persistent network error exhausts the frozen attempt budget and reports the network class", async () => {
    const { transport, calls } = transportWith([
      () => {
        throw new TypeError("fetch failed: socket hang up");
      }
    ]);
    const outcome = await transport.complete(BODY, BODY_HASH);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error("unreachable");
    expect(outcome.code).toBe(TRANSPORT_NETWORK_ERROR);
    expect(calls).toHaveLength(TRANSPORT_MAX_ATTEMPTS);
    expect(outcome.attempts).toHaveLength(TRANSPORT_MAX_ATTEMPTS);
    expect(outcome.attempts.every((attempt) => attempt.failure_class === "NETWORK_ERROR")).toBe(true);
  });

  it("TEST_T3_TIMEOUT: a timeout (abort) is retried and classified as TIMEOUT", async () => {
    const { transport, calls } = transportWith([
      () => {
        const error = new Error("The operation was aborted");
        error.name = "AbortError";
        throw error;
      },
      () => completion("{}")
    ]);
    const outcome = await transport.complete(BODY, BODY_HASH);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error("unreachable");
    expect(calls).toHaveLength(2);
    expect(outcome.attempts[0]?.failure_class).toBe("TIMEOUT");
  });

  it("TEST_T3B: a persistent timeout reports TRANSPORT_TIMEOUT after the frozen attempt budget", async () => {
    const { transport, calls } = transportWith([
      () => {
        const error = new Error("The operation was aborted");
        error.name = "AbortError";
        throw error;
      }
    ]);
    const outcome = await transport.complete(BODY, BODY_HASH);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error("unreachable");
    expect(outcome.code).toBe(TRANSPORT_TIMEOUT);
    expect(calls).toHaveLength(TRANSPORT_MAX_ATTEMPTS);
  });
});

describe("TRANSPORT — T4/T5/T6 HTTP status classification", () => {
  it("TEST_T4_429: 429 is retried, then succeeds", async () => {
    const { transport, calls } = transportWith([() => jsonResponse(429, '{"error":"rate"}'), () => completion("{}")]);
    const outcome = await transport.complete(BODY, BODY_HASH);
    expect(outcome.ok).toBe(true);
    expect(calls).toHaveLength(2);
    if (!outcome.ok) throw new Error("unreachable");
    expect(outcome.attempts[0]?.failure_class).toBe("HTTP_429_RETRYABLE");
    expect(outcome.attempts[0]?.http_status).toBe(429);
  });

  it("TEST_T5_5XX: 500/502/503/504 are all retryable", async () => {
    for (const status of [500, 502, 503, 504]) {
      const { transport, calls } = transportWith([() => jsonResponse(status, "upstream failure"), () => completion("{}")]);
      const outcome = await transport.complete(BODY, BODY_HASH);
      expect(outcome.ok, `status ${status}`).toBe(true);
      expect(calls, `status ${status}`).toHaveLength(2);
      if (!outcome.ok) throw new Error("unreachable");
      expect(outcome.attempts[0]?.failure_class).toBe(`HTTP_${status}_RETRYABLE`);
    }
  });

  it("TEST_T5B: a persistent 503 exhausts the attempt budget and reports TRANSPORT_HTTP_FAILURE", async () => {
    const { transport, calls } = transportWith([() => jsonResponse(503, "unavailable")]);
    const outcome = await transport.complete(BODY, BODY_HASH);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error("unreachable");
    expect(outcome.code).toBe(TRANSPORT_HTTP_FAILURE);
    expect(calls).toHaveLength(TRANSPORT_MAX_ATTEMPTS);
  });

  it("TEST_T6_NONRETRY_HTTP: 400/401/403/404/422 consume exactly ONE attempt", async () => {
    for (const status of [400, 401, 403, 404, 422]) {
      const { transport, calls } = transportWith([() => jsonResponse(status, "rejected"), () => completion("{}")]);
      const outcome = await transport.complete(BODY, BODY_HASH);
      expect(outcome.ok, `status ${status}`).toBe(false);
      expect(calls, `status ${status}`).toHaveLength(1);
      if (outcome.ok) throw new Error("unreachable");
      expect(outcome.failure_class).toBe("HTTP_NON_RETRYABLE");
      expect(outcome.attempts[0]?.http_status).toBe(status);
    }
  });
});

describe("TRANSPORT — T22 retry byte identity", () => {
  it("TEST_T22_RETRY_EXACT_BYTES: a 429 retry re-sends the IDENTICAL serialized body", async () => {
    const { transport, calls } = transportWith([() => jsonResponse(429, "slow down"), () => completion("{}")]);
    const outcome = await transport.complete(BODY, BODY_HASH);
    expect(outcome.ok).toBe(true);
    expect(calls).toHaveLength(2);
    expect(calls[0]?.body).toBe(BODY);
    expect(calls[1]?.body).toBe(BODY);
    expect(calls[0]?.body).toBe(calls[1]?.body);
  });

  it("TEST_T22B: the retry also re-sends identical HEADERS, and no credential is ever logged", async () => {
    const { transport, calls } = transportWith([() => jsonResponse(500, "boom"), () => completion("{}")]);
    await transport.complete(BODY, BODY_HASH);
    expect(calls[0]?.headers["content-type"]).toBe("application/json");
    expect(calls[0]?.headers["authorization"]).toBe(`Bearer ${TEST_KEY}`);
    expect(calls[1]?.headers["authorization"]).toBe(`Bearer ${TEST_KEY}`);
  });
});

describe("TRANSPORT — T23/T24 empty and non-retryable executor outcomes", () => {
  it("TEST_T23_MISSING_CONTENT: a valid envelope with no completion content is an explicit NON-RETRYABLE class", async () => {
    const { transport, calls } = transportWith([() => jsonResponse(200, JSON.stringify({ model: "deepseek-flash", choices: [] }))]);
    const outcome = await transport.complete(BODY, BODY_HASH);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error("unreachable");
    expect(outcome.code).toBe(TRANSPORT_EMPTY_RESPONSE);
    expect(outcome.failure_class).toBe(TRANSPORT_EMPTY_RESPONSE);
    expect(outcome.attempts).toHaveLength(1);
    expect(calls).toHaveLength(1);
  });

  it("TEST_T23B: an empty-string completion is also one attempt with an explicit class", async () => {
    const { transport, calls } = transportWith([() => completion("")]);
    const outcome = await transport.complete(BODY, BODY_HASH);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error("unreachable");
    expect(outcome.failure_class).toBe(TRANSPORT_EMPTY_RESPONSE);
    expect(calls).toHaveLength(1);
  });

  it("TEST_T24_ATTEMPT_LEDGER: every attempt carries a NON-NULL failure class, success included", async () => {
    const { transport } = transportWith([() => completion('{"ok":true}')]);
    const outcome = await transport.complete(BODY, BODY_HASH);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error("unreachable");
    for (const attempt of outcome.attempts) {
      expect(attempt.failure_class).toBeTypeOf("string");
      expect(attempt.failure_class).not.toBeNull();
      expect(attempt.failure_class.length).toBeGreaterThan(0);
    }
    expect(outcome.attempts[0]?.failure_class).toBe("NO_FAILURE");
  });

  it("TEST_T24B: a failure outcome carries no credential in its detail", async () => {
    const { transport } = transportWith([
      () => jsonResponse(401, `unauthorized: Authorization: Bearer ${TEST_KEY}`)
    ]);
    const outcome = await transport.complete(BODY, BODY_HASH);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error("unreachable");
    expect(outcome.detail).not.toContain(TEST_KEY);
    expect(outcome.detail).toContain("<redacted>");
  });
});
