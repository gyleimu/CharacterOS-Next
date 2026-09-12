/**
 * REPLY_CRITICAL_LATENCY_FORENSIC_V0 — wire-level provider option regression.
 *
 * Ollama keeps a resident runner per model + generation options; a transport
 * whose `num_ctx` differs forces a runner rebuild (measured ~9–11 s of
 * load_duration). These tests pin the fixed property at the WIRE level: every
 * product transport sends the ONE configured context allocation, while each
 * stage keeps its own output budget (Appraisal stays 256).
 */

import { afterEach, describe, expect, it } from "vitest";
import { createProductTransportsV0, PRODUCT_APPRAISAL_NUM_PREDICT_V0 } from "./product-providers.js";
import { resolveProductConfigurationV0, environmentFromRecordV0 } from "./product-configuration.js";
import { createProductProviderBundleV0 } from "./product-provider-bundle.js";

interface CapturedCall {
  readonly url: string;
  readonly body: Record<string, unknown>;
}

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

function installFetchCapture(calls: CapturedCall[]): void {
  globalThis.fetch = (async (url: string, init: { body: string }) => {
    calls.push({ url: String(url), body: JSON.parse(init.body) as Record<string, unknown> });
    const payload = {
      model: "fake",
      message: { content: "{}" },
      done: true,
      done_reason: "stop",
      total_duration: 1,
      load_duration: 0,
      prompt_eval_count: 1,
      prompt_eval_duration: 1,
      eval_count: 1,
      eval_duration: 1
    };
    return {
      ok: true,
      status: 200,
      json: async () => payload,
      clone: () => ({ json: async () => payload }),
      text: async () => JSON.stringify(payload)
    } as unknown as Response;
  }) as unknown as typeof fetch;
}

describe("REPLY_CRITICAL_LATENCY_FORENSIC_V0 — one shared provider allocation", () => {
  it("all product transports send the same num_ctx; appraisal keeps its 256 output budget", async () => {
    const calls: CapturedCall[] = [];
    installFetchCapture(calls);
    const transports = createProductTransportsV0({
      base_url: "http://127.0.0.1:11434",
      model: "fake",
      timeout_ms: 1000,
      num_predict: 2048,
      context_window_tokens: 8192
    });
    const messages = [{ role: "user" as const, content: "hello" }];
    for (const transport of [transports.appraisal, transports.cognition, transports.language, transports.relationship]) {
      await transport.complete({ messages });
    }
    expect(calls.length).toBe(4);
    const options = calls.map((call) => call.body["options"] as Record<string, number>);
    expect(options.map((entry) => entry["num_ctx"])).toEqual([8192, 8192, 8192, 8192]);
    // Appraisal output budget unchanged; other stages keep the configured budget.
    expect(options[0]?.["num_predict"]).toBe(PRODUCT_APPRAISAL_NUM_PREDICT_V0);
    expect(options[1]?.["num_predict"]).toBe(2048);
    // Sampling options are unchanged across all stages.
    expect(options.map((entry) => entry["temperature"])).toEqual([0, 0, 0, 0]);
  });

  it("a different configured context budget propagates to every transport (no stage-specific override)", async () => {
    const calls: CapturedCall[] = [];
    installFetchCapture(calls);
    const transports = createProductTransportsV0({
      base_url: "http://127.0.0.1:11434",
      model: "fake",
      timeout_ms: 1000,
      num_predict: 2048,
      context_window_tokens: 4096
    });
    await transports.appraisal.complete({ messages: [{ role: "user", content: "x" }] });
    await transports.cognition.complete({ messages: [{ role: "user", content: "x" }] });
    expect(calls.map((call) => (call.body["options"] as Record<string, number>)["num_ctx"])).toEqual([4096, 4096]);
  });

  it("the provider bundle exposes the single shared allocation and the unchanged appraisal budget", () => {
    const configuration = resolveProductConfigurationV0({
      environment: environmentFromRecordV0({ CHARACTEROS_CONTEXT_WINDOW_TOKENS: "8192" }),
      default_data_root: "D:\\data"
    });
    const bundle = createProductProviderBundleV0({ configuration, write: () => undefined });
    expect(bundle.context_window_tokens).toBe(configuration.context_window_tokens.value);
    expect(bundle.appraisal_num_predict).toBe(256);
  });
});
