/**
 * INTERACTIVE_PERSISTENT_SUBJECT_RUNTIME_V0 + CONTENT_SENSITIVE_APPRAISAL_PROVIDER_V0
 * — product provider wiring.
 *
 * Uses the EXISTING production Ollama cognition transport for the cognition
 * call, the language-realization call and the Appraisal proposal call. They
 * share compatible configuration but keep distinct prompts, output schemas and
 * semantic roles; each `complete()` is a separate model call. No second
 * transport implementation is introduced here.
 */

import type { ModelTransportTraceV0, ModelTransportV0 } from "@characteros-next/runtime";
import {
  MODEL_TRANSPORT_TRACE_SCHEMA_VERSION_V0,
  OllamaNativeCognitionTransportV0
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
  readonly base_url: string;
  readonly model: string;
  readonly timeout_ms: number;
  readonly num_predict: number;
  readonly context_window_tokens: number;
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

export function createProductTransportsV0(config: ProductProviderConfigV0): ProductTransportsV0 {
  let lastTrace: ModelTransportTraceV0 | null = null;
  const cognition: ModelTransportV0 = new OllamaNativeCognitionTransportV0({
    base_url: config.base_url,
    model: config.model,
    timeout_ms: config.timeout_ms,
    num_predict: config.num_predict,
    context_window_tokens: config.context_window_tokens,
    trace_observer: (event) => {
      if (event.schema_version === MODEL_TRANSPORT_TRACE_SCHEMA_VERSION_V0) {
        lastTrace = structuredClone(event);
      }
    }
  });
  const language: ModelTransportV0 = new OllamaNativeCognitionTransportV0({
    base_url: config.base_url,
    model: config.model,
    timeout_ms: config.timeout_ms,
    num_predict: config.num_predict,
    context_window_tokens: config.context_window_tokens
  });
  let lastAppraisalTrace: ModelTransportTraceV0 | null = null;
  const appraisal: ModelTransportV0 = new OllamaNativeCognitionTransportV0({
    base_url: config.base_url,
    model: config.model,
    timeout_ms: config.timeout_ms,
    num_predict: PRODUCT_APPRAISAL_NUM_PREDICT_V0,
    // SAME context allocation as cognition/language ⇒ one resident Ollama runner.
    context_window_tokens: config.context_window_tokens,
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
    relationship: new OllamaNativeCognitionTransportV0({
      base_url: config.base_url,
      model: config.model,
      timeout_ms: config.timeout_ms,
      num_predict: config.num_predict,
      context_window_tokens: config.context_window_tokens
    }) as unknown as ModelTransportV0,
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
