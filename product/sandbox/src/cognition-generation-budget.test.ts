/**
 * LOCAL_COGNITION_GENERATION_BUDGET_REMEDIATION — configuration matrix (B1–B8).
 *
 * Proves the approved change is EXACTLY cognition-only: the cognition transport's
 * generation budget is 3072 while appraisal, selector, language, relationship,
 * thinking mode, context window, cloud-family request policy and the query-aware
 * retrieval switch are all untouched. 0 model calls: the transports are only
 * constructed (no `complete()` is ever invoked).
 */

import { describe, expect, it } from "vitest";

import {
  PRODUCT_APPRAISAL_NUM_PREDICT_V0,
  PRODUCT_COGNITION_NUM_PREDICT_V0,
  PRODUCT_RECALL_SELECTOR_NUM_PREDICT_V0,
  createProductTransportsV0,
  deepSeekProviderRequestOptionsV0,
  type ProductProviderConfigV0
} from "./product-providers.js";
import { createProductProviderBundleV0 } from "./product-provider-bundle.js";
import { resolveProductConfigurationV0, environmentFromRecordV0 } from "./product-configuration.js";
import { OllamaNativeCognitionTransportV0, OpenAiCompatibleTransportV0 } from "@characteros-next/runtime";

/** The one shared product value language/relationship still read. */
const SHARED_NUM_PREDICT = 2048;

const localConfig = (overrides: Partial<ProductProviderConfigV0> = {}): ProductProviderConfigV0 => ({
  base_url: "http://127.0.0.1:11434",
  model: "qwen3.5:9b",
  timeout_ms: 120000,
  num_predict: SHARED_NUM_PREDICT,
  context_window_tokens: 8192,
  ...overrides
});

const privateField = (target: unknown, name: string): unknown => (target as Record<string, unknown>)[name];

describe("LOCAL_COGNITION_GENERATION_BUDGET_REMEDIATION — budget matrix", () => {
  it("B1/B6: cognition gets 3072 while the context window stays 8192", () => {
    const transports = createProductTransportsV0(localConfig());
    const cognition = transports.cognition as unknown as OllamaNativeCognitionTransportV0;
    expect(privateField(cognition, "config")).toMatchObject({ num_predict: PRODUCT_COGNITION_NUM_PREDICT_V0 });
    expect(PRODUCT_COGNITION_NUM_PREDICT_V0).toBe(3072);
    // num_ctx is the ONE shared context allocation and is NOT part of this change.
    expect(privateField(privateField(cognition, "config"), "context_window_tokens")).toBe(8192);
  });

  it("B4: language keeps the shared budget (the change is cognition-only)", () => {
    const transports = createProductTransportsV0(localConfig());
    expect(privateField(privateField(transports.language, "config"), "num_predict")).toBe(SHARED_NUM_PREDICT);
  });

  it("B2/B3: appraisal and selector keep their own dedicated budgets", () => {
    const transports = createProductTransportsV0(localConfig());
    expect(privateField(privateField(transports.appraisal, "config"), "num_predict")).toBe(
      PRODUCT_APPRAISAL_NUM_PREDICT_V0
    );
    expect(privateField(privateField(transports.recall_selector, "config"), "num_predict")).toBe(
      PRODUCT_RECALL_SELECTOR_NUM_PREDICT_V0
    );
    expect(PRODUCT_APPRAISAL_NUM_PREDICT_V0).toBe(256);
    expect(PRODUCT_RECALL_SELECTOR_NUM_PREDICT_V0).toBe(64);
  });

  it("relationship also keeps the shared budget (no silent widening)", () => {
    const transports = createProductTransportsV0(localConfig());
    expect(privateField(privateField(transports.relationship, "config"), "num_predict")).toBe(SHARED_NUM_PREDICT);
  });

  it("B5: the local family still has no way to enable thinking from product config", () => {
    // `think: false` is a FIXED policy of the Ollama native transport and is
    // asserted by that transport's own frozen tests
    // (`ollama-native-cognition-provider.test.ts`: `body["think"] === false`).
    // What this slice must prove is that the PRODUCT introduces no override: the
    // local cognition transport is constructed with no thinking field and no
    // provider_request_options, so the fixed policy is what reaches the wire.
    const transports = createProductTransportsV0(localConfig());
    const config = privateField(transports.cognition, "config") as Record<string, unknown>;
    expect(Object.keys(config)).not.toContain("think");
    expect(Object.keys(config)).not.toContain("provider_request_options");
  });

  it("B7: the cloud family's request policy and budget handling are unchanged", () => {
    // The cloud family carries its budget through the same shared value it always
    // did; only the local cognition transport was given a dedicated constant.
    const cloud = createProductTransportsV0(
      localConfig({ executor: "deepseek", model: "deepseek-flash", api_key: "placeholder-not-a-real-credential" })
    );
    expect(cloud.cognition).toBeInstanceOf(OpenAiCompatibleTransportV0);
    expect(privateField(privateField(cloud.cognition, "config"), "max_output_tokens")).toBe(SHARED_NUM_PREDICT);
    // Thinking remains the calibrated product default (DISABLED) on the cloud path.
    expect(deepSeekProviderRequestOptionsV0("DISABLED")).toEqual({ thinking: { type: "disabled" } });
    expect(deepSeekProviderRequestOptionsV0("PROVIDER_DEFAULT")).toBeUndefined();
  });

  it("B8: the query-aware retrieval switch and the other opt-ins are untouched", () => {
    const defaults = resolveProductConfigurationV0({
      environment: environmentFromRecordV0({}),
      default_data_root: "D:/x",
      default_data_root_origin: "test"
    });
    expect(defaults.query_aware_retrieval_enabled.value).toBe(false);
    expect(defaults.recall_evidence_selector_enabled.value).toBe(false);
    expect(defaults.direct_recall_enabled.value).toBe(false);
    // The shared value an operator sets is still resolved exactly as before.
    expect(defaults.num_predict.value).toBe(SHARED_NUM_PREDICT);
  });

  it("§6: the raised budget still leaves context headroom for the observed maximum prompt", () => {
    // Configuration EVIDENCE, not a frozen law: against the largest prompt the
    // executor adjudication actually observed (4098 tokens), 3072 of generation
    // still fits inside the shared 8192-token window.
    const OBSERVED_MAX_PROMPT_TOKENS = 4098;
    const NUM_CTX = 8192;
    const headroom = NUM_CTX - OBSERVED_MAX_PROMPT_TOKENS - PRODUCT_COGNITION_NUM_PREDICT_V0;
    expect(headroom).toBe(1022);
    expect(headroom).toBeGreaterThan(0);
    // The pre-remediation budget is what actually exhausted: prompt + 2048 = 6146.
    expect(OBSERVED_MAX_PROMPT_TOKENS + SHARED_NUM_PREDICT).toBeLessThan(NUM_CTX);
  });

  it("the bundle exposes the cognition budget so the raise is visible, not implicit", () => {
    const configuration = resolveProductConfigurationV0({
      environment: environmentFromRecordV0({ CHARACTEROS_NUM_PREDICT: "2048" }),
      default_data_root: "D:/x",
      default_data_root_origin: "test"
    });
    const bundle = createProductProviderBundleV0({ configuration, write: () => undefined });
    expect(bundle.cognition_num_predict).toBe(PRODUCT_COGNITION_NUM_PREDICT_V0);
    expect(bundle.appraisal_num_predict).toBe(PRODUCT_APPRAISAL_NUM_PREDICT_V0);
    // The operator-visible shared value is reported unchanged.
    expect(configuration.num_predict.value).toBe(SHARED_NUM_PREDICT);
    expect(bundle.context_window_tokens).toBe(8192);
  });
});
