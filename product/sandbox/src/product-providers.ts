/**
 * INTERACTIVE_PERSISTENT_SUBJECT_RUNTIME_V0 + CONTENT_SENSITIVE_APPRAISAL_PROVIDER_V0
 * — product provider wiring.
 *
 * PRODUCT_EXECUTOR_SELECTION_V0 — TWO executor families, ONE place that chooses:
 *   ollama   → the EXISTING production Ollama-native cognition transport
 *              (native /api/chat, grammar-constrained by `format`);
 *   deepseek → the EXISTING generic OpenAI-compatible transport
 *              (/chat/completions, credential from the host's environment only).
 *
 * Both families serve every product stage (cognition, language realization,
 * appraisal, relationship admission). They keep distinct prompts, output schemas
 * and semantic roles; each `complete()` is a separate model call. No vendor SDK,
 * no new transport implementation, no per-provider branch inside the stages.
 *
 * KNOWN LIMIT of the cloud family, stated rather than hidden: the generic
 * OpenAI-compatible transport does NOT forward `structured_output` (the endpoint
 * rejects `response_format` json_schema — measured, see the frozen capability
 * probe), so on that family the JSON contract travels in the PROMPT text. The
 * host validators remain the only authority, and the tolerant-output policy
 * (normalize → validate → one regeneration → graceful degrade) is what absorbs
 * the resulting format variance.
 */

import type { ModelTransportTraceEventV0, ModelTransportTraceV0, ModelTransportV0 } from "@characteros-next/runtime";
import {
  MODEL_TRANSPORT_TRACE_SCHEMA_VERSION_V0,
  OllamaNativeCognitionTransportV0,
  OpenAiCompatibleTransportV0
} from "@characteros-next/runtime";

/** Appraisal structured output is small; a bounded output budget is chosen explicitly. */
export const PRODUCT_APPRAISAL_NUM_PREDICT_V0 = 256 as const;

/**
 * REPLY_CRITICAL_LATENCY_FORENSIC_V0 — EVERY product transport shares the ONE
 * configured context budget (`CHARACTEROS_CONTEXT_WINDOW_TOKENS`).
 *
 * WHY: Ollama keys its resident runner by model + generation options. A visitor
 * with a different `num_ctx` forces the server to rebuild the runner, and each
 * rebuild was measured at ~9–11 s of `load_duration` (identical prompt/output
 * tokens) — twice per turn whenever Appraisal used a 4096-token allocation while
 * Cognition/Language used 8192. Unifying the allocation keeps ONE resident runner
 * for all product calls. This changes no prompt, no schema, no output budget and
 * no sampling option; the appraisal prompt (~490 tokens) fits either budget.
 */
export const PRODUCT_APPRAISAL_OUTPUT_BUDGET_NOTE_V0 =
  "appraisal output budget stays 256; context budget is shared with cognition/language" as const;

export interface ProductProviderConfigV0 {
  /**
   * Executor family. ABSENT means the local family, so every existing caller
   * keeps the historical construction path unchanged.
   */
  readonly executor?: "deepseek" | "ollama" | undefined;
  /**
   * Cloud credential, supplied by the product configuration from the environment
   * ONLY. It is an explicit construction argument (this module never reads the
   * ambient environment), it is never traced, logged, hashed or persisted, and
   * it appears in no error message.
   */
  readonly api_key?: string | null | undefined;
  readonly base_url: string;
  readonly model: string;
  readonly timeout_ms: number;
  readonly num_predict: number;
  readonly context_window_tokens: number;
  /**
   * PROVIDER_REQUEST_OPTIONS_V0 — provider-specific request fields for the CLOUD
   * (OpenAI-compatible) family, built from the product configuration by
   * `deepSeekProviderRequestOptionsV0`. Absent means the request body is
   * byte-identical to the historical one. The local native family ignores this:
   * it has its own fixed request policy (`think: false`).
   */
  readonly provider_request_options?: Readonly<Record<string, unknown>> | undefined;
}

/**
 * DEEPSEEK_PRODUCT_EXECUTOR_HARDENING_V0 — the cloud request setting that makes a
 * thinking-first model return its FINAL content. The product's cognition/language
 * contract consumes `message.content` only (never `reasoning_content`), and a
 * model that spends its whole output budget on reasoning returns empty content,
 * which the frozen transport fails closed on. `DISABLED` therefore sends the
 * provider-supported switch; `PROVIDER_DEFAULT` sends nothing (byte-identical
 * request); `ENABLED` sends it explicitly enabled. This is the cloud counterpart
 * of the `think: false` the local native transport has always sent.
 */
export function deepSeekProviderRequestOptionsV0(
  setting: "DISABLED" | "PROVIDER_DEFAULT" | "ENABLED"
): Readonly<Record<string, unknown>> | undefined {
  if (setting === "PROVIDER_DEFAULT") return undefined;
  return { thinking: { type: setting === "DISABLED" ? "disabled" : "enabled" } };
}

export interface ProductTransportsV0 {
  readonly cognition: ModelTransportV0;
  readonly language: ModelTransportV0;
  /** Dedicated Appraisal transport (separate semantic role and call accounting). */
  readonly appraisal: ModelTransportV0;
  /**
   * Dedicated relationship-familiarity admission transport so product
   * diagnostics can label that model-backed stage distinctly from cognition.
   * Same model/configuration; separate instance only.
   */
  readonly relationship: ModelTransportV0;
  /** Terminal trace of the most recent cognition call (operational evidence). */
  readonly lastCognitionTrace: () => ModelTransportTraceV0 | null;
  /** Terminal trace of the most recent appraisal call (operational evidence). */
  readonly lastAppraisalTrace: () => ModelTransportTraceV0 | null;
}

/**
 * ONE construction site per executor family. Both families answer the same
 * `ModelTransportV0` port, so no stage above this line knows which is in use.
 */
function createProductTransportV0(
  config: ProductProviderConfigV0,
  options: {
    readonly num_predict: number;
    readonly trace_observer?: (event: ModelTransportTraceEventV0 | ModelTransportTraceV0) => void;
  }
): ModelTransportV0 {
  if (config.executor === "deepseek") {
    // Cloud family: generic OpenAI-compatible transport. `structured_output` is
    // not forwarded by this transport (the endpoint rejects json_schema), so the
    // prompt carries the contract and the tolerant-output policy absorbs format
    // variance. The temperature is 0 for the same reason every other product
    // call uses 0: deterministic-leaning output, never a determinism claim.
    return new OpenAiCompatibleTransportV0({
      base_url: config.base_url,
      model: config.model,
      api_key: config.api_key ?? null,
      timeout_ms: config.timeout_ms,
      temperature: 0,
      max_output_tokens: options.num_predict,
      ...(config.provider_request_options === undefined
        ? {}
        : { provider_request_options: config.provider_request_options })
    });
  }
  const transport = new OllamaNativeCognitionTransportV0({
    base_url: config.base_url,
    model: config.model,
    timeout_ms: config.timeout_ms,
    num_predict: options.num_predict,
    context_window_tokens: config.context_window_tokens,
    ...(options.trace_observer === undefined ? {} : { trace_observer: options.trace_observer })
  });
  return transport;
}

export function createProductTransportsV0(config: ProductProviderConfigV0): ProductTransportsV0 {
  let lastTrace: ModelTransportTraceV0 | null = null;
  const cognition = createProductTransportV0(config, {
    num_predict: config.num_predict,
    trace_observer: (event) => {
      if (event.schema_version === MODEL_TRANSPORT_TRACE_SCHEMA_VERSION_V0) {
        lastTrace = structuredClone(event);
      }
    }
  });
  const language = createProductTransportV0(config, { num_predict: config.num_predict });
  let lastAppraisalTrace: ModelTransportTraceV0 | null = null;
  const appraisal = createProductTransportV0(config, {
    num_predict: PRODUCT_APPRAISAL_NUM_PREDICT_V0,
    trace_observer: (event) => {
      if (event.schema_version === MODEL_TRANSPORT_TRACE_SCHEMA_VERSION_V0) {
        lastAppraisalTrace = structuredClone(event);
      }
    }
  });
  return {
    cognition,
    language,
    appraisal,
    relationship: createProductTransportV0(config, { num_predict: config.num_predict }),
    lastCognitionTrace: () => lastTrace,
    lastAppraisalTrace: () => lastAppraisalTrace
  };
}

export interface OllamaProbeResultV0 {
  readonly reachable: boolean;
  readonly version: string | null;
  readonly digest: string | null;
  readonly failure: string | null;
}

/** Metadata-only availability probe (never a generation call). */
export async function probeOllamaV0(baseUrl: string, model: string): Promise<OllamaProbeResultV0> {
  try {
    const tags = await fetch(`${baseUrl}/api/tags`);
    const version = await fetch(`${baseUrl}/api/version`);
    const body = (await tags.json()) as { models?: { name?: string; digest?: string }[] };
    const entry = (body.models ?? []).find((candidate) => candidate.name === model);
    const versionBody = (await version.json()) as { version?: string };
    return {
      reachable: true,
      version: versionBody.version ?? null,
      digest: entry?.digest ?? null,
      failure: entry === undefined ? `model ${model} is not available` : null
    };
  } catch (error) {
    return { reachable: false, version: null, digest: null, failure: error instanceof Error ? error.message : String(error) };
  }
}
