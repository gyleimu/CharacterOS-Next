/**
 * PROVIDER REQUEST OBSERVER — deterministic offline test (0 model calls).
 *
 * Proves the monitoring instrumentation that the DeepSeek long-run needs:
 * exact request counting, token-usage capture from the provider's own `usage`
 * field, pass-through behaviour (the caller sees the untouched response), and
 * the honest NOT_AVAILABLE result when a provider returns no usage. A stubbed
 * `fetch` stands in for the network, so this test never reaches a real endpoint
 * and never needs a credential.
 */

import { afterEach, describe, expect, it } from "vitest";

import {
  installProviderRequestObserverV0,
  summariseProviderRequestsV0,
  type ProviderRequestObserverV0
} from "./provider-request-observer.js";

const BASE_URL = "https://api.example.invalid";

/** OpenAI-compatible completion body with usage, as the cloud family returns it. */
function completionBodyV0(usage: boolean): string {
  return JSON.stringify({
    id: "cmpl-1",
    object: "chat.completion",
    model: "deepseek-flash",
    choices: [{ index: 0, message: { role: "assistant", content: "hello" }, finish_reason: "stop" }],
    ...(usage
      ? { usage: { prompt_tokens: 1200, completion_tokens: 300, total_tokens: 1500 } }
      : {})
  });
}

const originalFetch = globalThis.fetch;
let observer: ProviderRequestObserverV0 | null = null;

afterEach(() => {
  observer?.uninstall();
  observer = null;
  globalThis.fetch = originalFetch;
});

describe("provider request observer", () => {
  it("counts observed requests, captures usage, and passes the response through untouched", async () => {
    const seen: { url: string; body: string | null }[] = [];
    globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      seen.push({ url: String(input), body: typeof init?.body === "string" ? init.body : null });
      return new Response(completionBodyV0(true), { status: 200, headers: { "content-type": "application/json" } });
    }) as typeof globalThis.fetch;

    observer = installProviderRequestObserverV0([BASE_URL]);
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer not-a-real-credential" },
      body: JSON.stringify({ model: "deepseek-flash", messages: [{ role: "user", content: "hi" }], max_tokens: 2048 })
    });

    // Pass-through: the caller can still read the body exactly once.
    const body = (await response.json()) as { choices: { message: { content: string } }[] };
    expect(body.choices[0]?.message.content).toBe("hello");
    expect(seen).toHaveLength(1);

    const summary = observer.summary();
    expect(summary.total_requests).toBe(1);
    expect(summary.by_path["/chat/completions"]).toBe(1);
    expect(summary.by_outcome["OK"]).toBe(1);
    expect(summary.usage.presence).toBe("AVAILABLE");
    expect(summary.usage.prompt_tokens).toBe(1200);
    expect(summary.usage.completion_tokens).toBe(300);
    expect(summary.usage.total_tokens).toBe(1500);

    // Secret safety: records carry no headers and no bodies at all.
    const record = observer.records()[0];
    expect(record?.model).toBe("deepseek-flash");
    expect(record?.max_output_tokens).toBe(2048);
    expect(observer.summary().by_output_budget["2048"]).toBe(1);
    expect(Object.keys(record ?? {}).sort()).toEqual(
      [
        "duration_ms",
        "host",
        "max_output_tokens",
        "model",
        "outcome",
        "path",
        "request_bytes",
        "response_bytes",
        "sequence",
        "started_at",
        "status",
        "usage"
      ].sort()
    );
    expect(JSON.stringify(observer.records())).not.toContain("not-a-real-credential");
  });

  it("records NOT_AVAILABLE usage honestly and counts HTTP failures", async () => {
    globalThis.fetch = (async () =>
      new Response(completionBodyV0(false), { status: 200 })) as typeof globalThis.fetch;
    observer = installProviderRequestObserverV0([BASE_URL]);
    await fetch(`${BASE_URL}/chat/completions`, { method: "POST", body: JSON.stringify({ model: "m" }) });
    const first = observer.summary();
    expect(first.total_requests).toBe(1);
    expect(first.usage.presence).toBe("NOT_AVAILABLE");
    expect(first.usage.prompt_tokens).toBeNull();

    observer.uninstall();
    globalThis.fetch = (async () => new Response("nope", { status: 429 })) as typeof globalThis.fetch;
    observer = installProviderRequestObserverV0([BASE_URL]);
    await fetch(`${BASE_URL}/chat/completions`, { method: "POST", body: JSON.stringify({ model: "m" }) });
    const second = observer.summary();
    expect(second.total_requests).toBe(1);
    expect(second.by_outcome["HTTP_ERROR"]).toBe(1);
    expect(second.http_error_statuses).toEqual([429]);
  });

  it("ignores hosts outside the observed set and never throws into the call path", async () => {
    globalThis.fetch = (async () => new Response("{}", { status: 200 })) as typeof globalThis.fetch;
    observer = installProviderRequestObserverV0([BASE_URL]);
    await fetch("https://other.example.invalid/chat/completions", { method: "POST", body: "{}" });
    expect(observer.summary().total_requests).toBe(0);

    // A transport error is still recorded as such and re-thrown unchanged.
    observer.uninstall();
    globalThis.fetch = (async () => {
      throw new Error("connection refused");
    }) as typeof globalThis.fetch;
    observer = installProviderRequestObserverV0([BASE_URL]);
    await expect(fetch(`${BASE_URL}/chat/completions`, { method: "POST", body: "{}" })).rejects.toThrow(
      "connection refused"
    );
    const summary = observer.summary();
    expect(summary.by_outcome["TRANSPORT_ERROR"]).toBe(1);
    expect(summary.usage.presence).toBe("NOT_AVAILABLE");
  });

  it("summarises durations without inventing values", () => {
    const summary = summariseProviderRequestsV0([], []);
    expect(summary.total_requests).toBe(0);
    expect(summary.duration_ms).toEqual({ min: null, median: null, p95: null, max: null });
    expect(summary.usage).toEqual({
      requests_with_usage: 0,
      prompt_tokens: null,
      completion_tokens: null,
      total_tokens: null,
      presence: "NOT_AVAILABLE"
    });
  });
});
