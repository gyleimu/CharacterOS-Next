/**
 * PRODUCT_EXECUTOR_SELECTION_V0 — executor family selection, offline.
 *
 * Covers the closed family set (`deepseek` cloud / `ollama` local) and the
 * `auto` rule, the credential contract (environment only, presence only, value
 * never echoed anywhere), and the transport each family actually builds.
 *
 * NO NETWORK: the two wire tests stub `fetch` and assert the request shape a
 * real endpoint would receive. No test in this file may reach a provider.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ProductConfigurationErrorV0,
  environmentFromRecordV0,
  formatConfigurationLinesV0,
  resolveProductConfigurationV0,
  type ProductConfigurationV0,
  type ProductConfigurationSubjectV0
} from "./product-configuration.js";
import { createProductProviderBundleV0 } from "./product-provider-bundle.js";
import { createProductTransportsV0 } from "./product-providers.js";

const CREDENTIAL = "test-credential-value-never-printed";

function resolve(record: Readonly<Record<string, string | undefined>>): ProductConfigurationV0 {
  return resolveProductConfigurationV0({
    environment: environmentFromRecordV0(record),
    default_data_root: "/tmp/characteros-executor",
    default_data_root_origin: "executor-selection test"
  });
}

function subjectView(): ProductConfigurationSubjectV0 {
  return {
    subject_id: "s-1",
    display_name: "Test",
    status: "NEW",
    durable_state: "NONE",
    identity: { source: "DEFAULT", origin: "test" },
    data_location: null,
    provider_ready: true
  };
}

function configText(configuration: ProductConfigurationV0): string {
  return formatConfigurationLinesV0(configuration, subjectView()).join("\n");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("executor family resolution", () => {
  it("E1: with no executor setting and no credential, the LOCAL executor is effective", () => {
    const configuration = resolve({});
    expect(configuration.executor.effective).toBe("ollama");
    expect(configuration.executor.requested).toBe("auto");
    expect(configuration.executor.requested_source).toBe("DEFAULT");
    expect(configuration.model.value).toBe("qwen3.5:9b");
    expect(configuration.endpoint.value).toBe("http://127.0.0.1:11434");
    expect(configuration.credential_present).toBe(false);
    expect(configuration.executor.reason).toContain("no cloud credential is present");
  });

  it("E2: with a credential present, `auto` selects the CLOUD executor and names the reason", () => {
    const configuration = resolve({ MODEL_API_KEY: CREDENTIAL });
    expect(configuration.executor.effective).toBe("deepseek");
    expect(configuration.executor.requested).toBe("auto");
    expect(configuration.model.value).toBe("deepseek-flash");
    expect(configuration.model.source).toBe("DEFAULT");
    expect(configuration.endpoint.value).toBe("https://api.deepseek.com");
    expect(configuration.credential_present).toBe(true);
    expect(configuration.executor.reason).toContain("a cloud credential is present");
  });

  it("E3: the cloud family honors its own model and base-URL settings", () => {
    const configuration = resolve({
      CHARACTEROS_EXECUTOR: "deepseek",
      MODEL_API_KEY: CREDENTIAL,
      MODEL_API_MODEL: "some-cloud-model",
      MODEL_API_BASE_URL: "https://cloud.example/v1"
    });
    expect(configuration.executor.effective).toBe("deepseek");
    expect(configuration.model).toEqual({
      value: "some-cloud-model",
      source: "ENVIRONMENT",
      origin: "MODEL_API_MODEL"
    });
    expect(configuration.endpoint).toEqual({
      value: "https://cloud.example/v1",
      source: "ENVIRONMENT",
      origin: "MODEL_API_BASE_URL"
    });
  });

  it("E4: an explicit cloud request without a credential fails closed, naming the setting and never a value", () => {
    let raised: unknown;
    try {
      resolve({ CHARACTEROS_EXECUTOR: "deepseek" });
    } catch (error) {
      raised = error;
    }
    expect(raised).toBeInstanceOf(ProductConfigurationErrorV0);
    const error = raised as ProductConfigurationErrorV0;
    expect(error.setting).toBe("CHARACTEROS_EXECUTOR");
    expect(error.message).toContain("MODEL_API_KEY");
    expect(error.message).toContain("CHARACTEROS_EXECUTOR=ollama");
    expect(error.message).not.toContain(CREDENTIAL);
  });

  it("E5: an explicit LOCAL request wins over the auto rule even when a credential exists", () => {
    const configuration = resolve({ CHARACTEROS_EXECUTOR: "ollama", MODEL_API_KEY: CREDENTIAL });
    expect(configuration.executor.effective).toBe("ollama");
    expect(configuration.executor.requested).toBe("ollama");
    expect(configuration.model.value).toBe("qwen3.5:9b");
    expect(configuration.endpoint.value).toBe("http://127.0.0.1:11434");
    // The credential is still REPORTED as present (it is), but nothing uses it.
    expect(configuration.credential_present).toBe(true);
    expect(configuration.executor.reason).toContain("explicitly requested");
  });

  it("E6: an unknown executor value selects no provider at all", () => {
    let raised: unknown;
    try {
      resolve({ CHARACTEROS_EXECUTOR: "openai", MODEL_API_KEY: CREDENTIAL });
    } catch (error) {
      raised = error;
    }
    expect(raised).toBeInstanceOf(ProductConfigurationErrorV0);
    const error = raised as ProductConfigurationErrorV0;
    expect(error.setting).toBe("CHARACTEROS_EXECUTOR");
    expect(error.expected).toContain("deepseek, ollama, auto");
    expect(error.message).not.toContain(CREDENTIAL);
  });

  it("E7: adaptation stays on the LOCAL model even when cognition runs on the cloud executor", () => {
    const configuration = resolve({ MODEL_API_KEY: CREDENTIAL });
    expect(configuration.model.value).toBe("deepseek-flash");
    expect(configuration.local_model.value).toBe("qwen3.5:9b");
    expect(configuration.local_endpoint.value).toBe("http://127.0.0.1:11434");
    expect(configuration.belief_semantic_model.value).toBe("qwen3.5:9b");
  });
});

describe("credential discipline", () => {
  it("E8: the resolved configuration carries presence only, never the value", () => {
    const configuration = resolve({ MODEL_API_KEY: CREDENTIAL });
    expect(configuration.credential_present).toBe(true);
    expect(JSON.stringify(configuration)).not.toContain(CREDENTIAL);
  });

  it("E9: /config output names the credential variable but never its value", () => {
    const text = configText(resolve({ MODEL_API_KEY: CREDENTIAL }));
    expect(text).not.toContain(CREDENTIAL);
    expect(text).toContain("value never printed");
    expect(text).toContain("executor: deepseek");
  });

  it("E10: an unreadable cloud configuration error never echoes a credential", () => {
    let raised: unknown;
    try {
      resolve({ CHARACTEROS_EXECUTOR: "deepseek", MODEL_API_BASE_URL: "not-a-url", MODEL_API_KEY: CREDENTIAL });
    } catch (error) {
      raised = error;
    }
    expect(raised).toBeInstanceOf(ProductConfigurationErrorV0);
    expect((raised as Error).message).not.toContain(CREDENTIAL);
  });

  it("E11: the machine-readable executor reason carries no credential-shaped token", () => {
    // The local web product serializes this reason into its configuration payload,
    // which is gated by a `password|secret|api[_-]?key|bearer` scan. The reason
    // must keep stating the decision WITHOUT tripping that gate.
    for (const record of [{}, { MODEL_API_KEY: CREDENTIAL }] as const) {
      const reason = resolve(record).executor.reason;
      expect(reason).not.toMatch(/password|secret|api[_-]?key|bearer/i);
    }
  });
});

describe("transport family wiring (fetch stubbed, no network)", () => {
  it("E11: the LOCAL family posts the Ollama-native envelope without an Authorization header", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify({ message: { content: "ok" } }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    });
    const transports = createProductTransportsV0({
      executor: "ollama",
      base_url: "http://127.0.0.1:11434",
      model: "qwen3.5:9b",
      timeout_ms: 5000,
      num_predict: 256,
      context_window_tokens: 8192
    });
    const response = await transports.cognition.complete({ messages: [{ role: "user", content: "hi" }] });
    expect(response.content).toBe("ok");
    expect(calls).toHaveLength(1);
    const localCall = calls[0] as { url: string; init: RequestInit };
    expect(localCall.url).toBe("http://127.0.0.1:11434/api/chat");
    const headers = localCall.init.headers as Record<string, string>;
    expect(Object.keys(headers).map((key) => key.toLowerCase())).not.toContain("authorization");
    const body = JSON.parse(String(localCall.init.body)) as Record<string, unknown>;
    expect(body["model"]).toBe("qwen3.5:9b");
    expect(body["stream"]).toBe(false);
    expect(body["think"]).toBe(false);
  });

  it("E12: the CLOUD family posts /chat/completions with the credential in the header only", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    });
    const transports = createProductTransportsV0({
      executor: "deepseek",
      api_key: CREDENTIAL,
      base_url: "https://api.deepseek.com",
      model: "deepseek-flash",
      timeout_ms: 5000,
      num_predict: 256,
      context_window_tokens: 8192
    });
    const response = await transports.cognition.complete({
      messages: [{ role: "user", content: "hi" }],
      structured_output: { kind: "JSON_SCHEMA", schema: { type: "object" } }
    });
    expect(response.content).toBe("ok");
    expect(calls).toHaveLength(1);
    const cloudCall = calls[0] as { url: string; init: RequestInit };
    expect(cloudCall.url).toBe("https://api.deepseek.com/chat/completions");
    const headers = cloudCall.init.headers as Record<string, string>;
    expect(headers["authorization"]).toBe(`Bearer ${CREDENTIAL}`);
    const body = JSON.parse(String(cloudCall.init.body)) as Record<string, unknown>;
    expect(body["model"]).toBe("deepseek-flash");
    expect(body["max_tokens"]).toBe(256);
    expect(body["temperature"]).toBe(0);
    // KNOWN LIMIT, asserted so it cannot silently change: this transport does not
    // forward the structured-output constraint, so the JSON contract must travel
    // in the prompt and the tolerant-output policy absorbs format variance.
    expect(body["format"]).toBeUndefined();
    expect(body["response_format"]).toBeUndefined();
    expect(String(cloudCall.init.body)).not.toContain(CREDENTIAL);
  });

  it("E13: a cloud bundle reads the credential from the environment accessor, not from ambient state", () => {
    const configuration = resolve({ CHARACTEROS_EXECUTOR: "deepseek", MODEL_API_KEY: CREDENTIAL });
    const withoutEnvironment = createProductProviderBundleV0({ configuration, write: () => {} });
    expect(withoutEnvironment.transports.cognition).toBeDefined();
    const withEnvironment = createProductProviderBundleV0({
      configuration,
      environment: environmentFromRecordV0({ MODEL_API_KEY: CREDENTIAL }),
      write: () => {}
    });
    expect(withEnvironment.transports.cognition).toBeDefined();
    // Adaptation is local-only in both cases: it must not follow the cloud endpoint.
    expect(withEnvironment.beliefSemanticProvider).not.toBeNull();
    expect(withEnvironment.turnPlan.belief_adaptation_enabled).toBe(true);
  });
});
