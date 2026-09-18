/**
 * DEEPSEEK_PRODUCT_EXECUTOR_HARDENING_V0 — product executor hardening, offline.
 *
 * E1: the DeepSeek product transport sends the provider-supported thinking switch
 *     through the REAL product path (product configuration → provider bundle →
 *     OpenAI-compatible transport). No proxy, no DeepSeek logic anywhere else.
 * E2: every other OpenAI-compatible request is byte-identical to the historical
 *     one (the option is absent), and the local native family is untouched.
 * E3: a 200 response whose `message.content` is empty still fails closed, even
 *     when a `reasoning_content` field is present — reasoning is never used.
 * E8: no credential appears in errors, records or configuration text.
 *
 * NO NETWORK: `fetch` is stubbed in every test in this file.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ProductConfigurationErrorV0,
  environmentFromRecordV0,
  formatConfigurationLinesV0,
  resolveProductConfigurationV0,
  type ProductConfigurationSubjectV0
} from "./product-configuration.js";
import { createProductProviderBundleV0 } from "./product-provider-bundle.js";
import { createProductTransportsV0, deepSeekProviderRequestOptionsV0 } from "./product-providers.js";
import { installProviderRequestObserverV0 } from "./provider-request-observer.js";

const CREDENTIAL = "test-credential-value-never-printed";
const BASE_URL = "https://cloud.example.invalid";

interface CapturedCall {
  readonly url: string;
  readonly headers: Record<string, string>;
  readonly body: Record<string, unknown>;
}

let calls: CapturedCall[] = [];

function stubFetch(response: (call: CapturedCall) => Response): void {
  vi.stubGlobal("fetch", async (input: unknown, init?: { headers?: Record<string, string>; body?: unknown }) => {
    const call: CapturedCall = {
      url: String(input),
      headers: { ...(init?.headers ?? {}) },
      body: typeof init?.body === "string" ? (JSON.parse(init.body) as Record<string, unknown>) : {}
    };
    calls.push(call);
    return response(call);
  });
}

function cloudResponse(content: string, extra: Record<string, unknown> = {}): Response {
  return new Response(
    JSON.stringify({
      id: "cmpl-1",
      object: "chat.completion",
      model: "deepseek-flash",
      choices: [{ index: 0, message: { role: "assistant", content, ...extra }, finish_reason: "stop" }],
      usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 }
    }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
}

function resolveDeepSeek(extra: Readonly<Record<string, string | undefined>> = {}) {
  return resolveProductConfigurationV0({
    environment: environmentFromRecordV0({
      CHARACTEROS_EXECUTOR: "deepseek",
      MODEL_API_KEY: CREDENTIAL,
      MODEL_API_BASE_URL: BASE_URL,
      ...extra
    }),
    default_data_root: "/tmp/characteros-hardening",
    default_data_root_origin: "deepseek-hardening test"
  });
}

function subjectView(): ProductConfigurationSubjectV0 {
  return {
    subject_id: "s-1",
    display_name: "Test",
    status: "RESTORED",
    durable_state: "PRESENT",
    identity: { source: "DEFAULT", origin: "test" },
    data_location: null,
    provider_ready: true
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  calls = [];
});

describe("E1: the thinking switch travels through the real product path", () => {
  it("the provider bundle sends thinking.type=disabled on the cloud request", async () => {
    stubFetch(() => cloudResponse("{}"));
    const configuration = resolveDeepSeek();
    const bundle = createProductProviderBundleV0({
      configuration,
      environment: environmentFromRecordV0({ MODEL_API_KEY: CREDENTIAL }),
      write: () => undefined
    });
    const response = await bundle.transports.cognition.complete({
      messages: [{ role: "user", content: "hello" }]
    });
    expect(response.content).toBe("{}");
    expect(calls).toHaveLength(1);
    const call = calls[0];
    expect(call?.url).toBe(`${BASE_URL}/chat/completions`);
    expect(call?.body["thinking"]).toEqual({ type: "disabled" });
    // Frozen request semantics are untouched.
    expect(call?.body["model"]).toBe("deepseek-flash");
    expect(call?.body["temperature"]).toBe(0);
    expect(call?.body["max_tokens"]).toBe(2048);
    expect(call?.headers["authorization"]).toBe(`Bearer ${CREDENTIAL}`);
  });

  it("PROVIDER_DEFAULT sends no thinking field (byte-identical request)", async () => {
    stubFetch(() => cloudResponse("{}"));
    const providerDefault = createProductTransportsV0({
      executor: "deepseek",
      api_key: CREDENTIAL,
      base_url: BASE_URL,
      model: "deepseek-flash",
      timeout_ms: 1000,
      num_predict: 2048,
      context_window_tokens: 8192
    });
    await providerDefault.cognition.complete({ messages: [{ role: "user", content: "hi" }] });
    expect(Object.hasOwn(calls[0]?.body ?? {}, "thinking")).toBe(false);
  });

  it("ENABLED sends the switch explicitly enabled", async () => {
    stubFetch(() => cloudResponse("{}"));
    const enabled = createProductTransportsV0({
      executor: "deepseek",
      api_key: CREDENTIAL,
      base_url: BASE_URL,
      model: "deepseek-flash",
      timeout_ms: 1000,
      num_predict: 2048,
      context_window_tokens: 8192,
      provider_request_options: deepSeekProviderRequestOptionsV0("ENABLED")
    });
    await enabled.cognition.complete({ messages: [{ role: "user", content: "hi" }] });
    expect(calls[0]?.body["thinking"]).toEqual({ type: "enabled" });
  });

  it("the configuration text shows the effective thinking setting without the credential", () => {
    const text = formatConfigurationLinesV0(resolveDeepSeek(), subjectView()).join("\n");
    expect(text).toContain("thinking: disabled");
    expect(text).toContain("credential: present (MODEL_API_KEY, value never printed)");
    expect(text).not.toContain(CREDENTIAL);
  });
});

describe("E2: other providers are unaffected", () => {
  it("a cloud request without the option keeps the historical byte-identical body", async () => {
    stubFetch(() => cloudResponse("{}"));
    const transports = createProductTransportsV0({
      executor: "deepseek",
      api_key: null,
      base_url: BASE_URL,
      model: "some-other-model",
      timeout_ms: 1000,
      num_predict: 512,
      context_window_tokens: 8192
    });
    await transports.language.complete({ messages: [{ role: "user", content: "hi" }] });
    expect(calls[0]?.body).toEqual({
      model: "some-other-model",
      messages: [{ role: "user", content: "hi" }],
      temperature: 0,
      max_tokens: 512
    });
  });

  it("the local native family keeps its own request policy untouched", async () => {
    stubFetch(() =>
      new Response(JSON.stringify({ message: { content: "{}" } }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );
    const transports = createProductTransportsV0({
      executor: "ollama",
      base_url: "http://127.0.0.1:11434",
      model: "qwen3.5:9b",
      timeout_ms: 1000,
      num_predict: 2048,
      context_window_tokens: 8192
    });
    await transports.language.complete({ messages: [{ role: "user", content: "hi" }] });
    expect(calls[0]?.url).toBe("http://127.0.0.1:11434/api/chat");
    const body = calls[0]?.body ?? {};
    expect(body["think"]).toBe(false);
    expect(Object.hasOwn(body, "thinking")).toBe(false);
  });
});

describe("E3: empty content fails closed and never falls back to reasoning", () => {
  it("a 200 with empty content and a long reasoning field still rejects", async () => {
    stubFetch(() => cloudResponse("", { reasoning_content: "step 1: think very hard about the answer" }));
    const transports = createProductTransportsV0({
      executor: "deepseek",
      api_key: CREDENTIAL,
      base_url: BASE_URL,
      model: "deepseek-flash",
      timeout_ms: 1000,
      num_predict: 2048,
      context_window_tokens: 8192,
      provider_request_options: deepSeekProviderRequestOptionsV0("DISABLED")
    });
    await expect(transports.cognition.complete({ messages: [{ role: "user", content: "hi" }] })).rejects.toMatchObject({
      code: "MODEL_EMPTY_RESPONSE"
    });
  });
});

describe("E8: no credential leaks into observations or errors", () => {
  it("error messages and observer records contain no credential material", async () => {
    stubFetch(() => new Response("nope", { status: 401 }));
    const observer = installProviderRequestObserverV0([BASE_URL]);
    const transports = createProductTransportsV0({
      executor: "deepseek",
      api_key: CREDENTIAL,
      base_url: BASE_URL,
      model: "deepseek-flash",
      timeout_ms: 1000,
      num_predict: 2048,
      context_window_tokens: 8192,
      provider_request_options: deepSeekProviderRequestOptionsV0("DISABLED")
    });
    const failure = await transports.cognition.complete({ messages: [{ role: "user", content: "hi" }] }).then(
      () => null,
      (error: unknown) => (error instanceof Error ? error.message : String(error))
    );
    expect(failure).not.toBeNull();
    expect(failure ?? "").toContain("MODEL_HTTP_FAILURE");
    expect(failure ?? "").not.toContain(CREDENTIAL);
    const serialized = JSON.stringify(observer.records());
    expect(serialized).not.toContain(CREDENTIAL);
    expect(serialized).not.toContain("authorization");
    observer.uninstall();
  });
});

describe("configuration surface", () => {
  it("defaults to disabled, accepts the narrow overrides, and fails closed on junk", () => {
    expect(resolveDeepSeek().deepseek_thinking.value).toBe("DISABLED");
    expect(resolveDeepSeek({ CHARACTEROS_DEEPSEEK_THINKING: "provider-default" }).deepseek_thinking.value).toBe(
      "PROVIDER_DEFAULT"
    );
    expect(resolveDeepSeek({ CHARACTEROS_DEEPSEEK_THINKING: "ENABLED" }).deepseek_thinking.value).toBe("ENABLED");
    expect(() => resolveDeepSeek({ CHARACTEROS_DEEPSEEK_THINKING: "maybe" })).toThrow(ProductConfigurationErrorV0);
    // The setting is inert for the local family and does not affect its request.
    const local = resolveProductConfigurationV0({
      environment: environmentFromRecordV0({}),
      default_data_root: "/tmp/x",
      default_data_root_origin: "test"
    });
    expect(local.executor.effective).toBe("ollama");
    expect(local.deepseek_thinking.value).toBe("DISABLED");
  });
});
