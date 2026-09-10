/**
 * INTERACTIVE_PERSISTENT_SUBJECT_RUNTIME_V0 — product provider wiring.
 *
 * Uses the EXISTING production Ollama cognition transport for both the
 * cognition call and the language-realization call (they share compatible
 * configuration but keep their distinct semantics). No second transport
 * implementation is introduced here.
 */

import type { ModelTransportTraceV0, ModelTransportV0 } from "@characteros-next/runtime";
import {
  MODEL_TRANSPORT_TRACE_SCHEMA_VERSION_V0,
  OllamaNativeCognitionTransportV0
} from "@characteros-next/runtime";

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
  /** Terminal trace of the most recent cognition call (operational evidence). */
  readonly lastCognitionTrace: () => ModelTransportTraceV0 | null;
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
  return { cognition, language, lastCognitionTrace: () => lastTrace };
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
