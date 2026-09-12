/**
 * CHARACTEROS_PRODUCT_PROVIDER_RESILIENCE_AND_DIAGNOSTICS_V0 — product provider
 * diagnostics.
 *
 * Pure PRODUCT/transport observability: which model-backed stage is running, how
 * long it took, and how it failed. It never reads or writes canonical subject
 * state, never persists diagnostics, and never fabricates an appraisal,
 * cognition, language or adaptation result. Process-local only; resets on
 * restart by design.
 */

import type { ModelTransportRequestV0, ModelTransportResponseV0, ModelTransportV0 } from "@characteros-next/runtime";
import { ModelTransportErrorV0 } from "@characteros-next/runtime";

/** Product-only operator taxonomy; only stages that actually make model calls. */
export type ProviderStageV0 =
  | "APPRAISAL"
  | "BELIEF_ADAPTATION"
  | "PERSONALITY_ADAPTATION"
  | "RELATIONSHIP_ADAPTATION"
  | "COGNITION"
  | "LANGUAGE";

/** Smallest useful product failure categories (existing typed errors preserved). */
export type ProviderFailureCategoryV0 =
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_MALFORMED_RESPONSE"
  | "PROVIDER_REJECTED_OUTPUT"
  | "PROVIDER_INTERNAL_ERROR";

export type ProviderStageStatusV0 = "DISABLED" | "RUNNING" | "OK" | "FAILED";

export interface ProviderStageRecordV0 {
  readonly stage: ProviderStageV0;
  readonly status: ProviderStageStatusV0;
  readonly latency_ms: number | null;
  readonly category: ProviderFailureCategoryV0 | null;
  readonly error_code: string | null;
  readonly detail: string | null;
}

export interface ProviderDiagnosticsOptionsV0 {
  readonly write: (line: string) => void;
  /** Monotonic millisecond clock (injectable for deterministic tests). */
  readonly now?: () => number;
  readonly model: string;
  readonly timeout_ms: number;
  readonly debug: boolean;
}

function defaultMonotonicNowV0(): number {
  return Number(process.hrtime.bigint() / 1_000_000n);
}

/** Maps an existing provider/transport error into a product category. */
export function classifyProviderFailureV0(error: unknown): {
  readonly category: ProviderFailureCategoryV0;
  readonly error_code: string | null;
  readonly detail: string;
} {
  if (error instanceof ModelTransportErrorV0) {
    switch (error.code) {
      case "MODEL_TIMEOUT":
        return { category: "PROVIDER_TIMEOUT", error_code: error.code, detail: error.message };
      case "MODEL_CONNECTION_FAILURE":
        return { category: "PROVIDER_UNAVAILABLE", error_code: error.code, detail: error.message };
      case "MODEL_HTTP_FAILURE":
        return error.http_status === 404
          ? { category: "PROVIDER_UNAVAILABLE", error_code: error.code, detail: error.message }
          : { category: "PROVIDER_INTERNAL_ERROR", error_code: error.code, detail: error.message };
      case "MODEL_EMPTY_RESPONSE":
      case "MODEL_OUTPUT_TRUNCATED":
        return { category: "PROVIDER_MALFORMED_RESPONSE", error_code: error.code, detail: error.message };
      default:
        return { category: "PROVIDER_INTERNAL_ERROR", error_code: error.code, detail: error.message };
    }
  }
  const detail = error instanceof Error ? error.message : String(error);
  const code = (error as { code?: unknown } | null)?.code;
  const errorCode = typeof code === "string" ? code : null;
  if (/MODEL_TIMEOUT|timed out|timeout/i.test(detail)) {
    return { category: "PROVIDER_TIMEOUT", error_code: errorCode, detail };
  }
  if (/MODEL_CONNECTION_FAILURE|ECONNREFUSED|fetch failed|connection refused|not reachable/i.test(detail)) {
    return { category: "PROVIDER_UNAVAILABLE", error_code: errorCode, detail };
  }
  if (/SCHEMA_INVALID|MODEL_SCHEMA_INVALID|not strict JSON|malformed/i.test(detail)) {
    return { category: "PROVIDER_MALFORMED_RESPONSE", error_code: errorCode, detail };
  }
  if (/REJECTED|rejection|unsupported/i.test(detail)) {
    return { category: "PROVIDER_REJECTED_OUTPUT", error_code: errorCode, detail };
  }
  return { category: "PROVIDER_INTERNAL_ERROR", error_code: errorCode, detail };
}

/** Extracts the failing product stage from a runtime turn failure string. */
export function extractFailureStageV0(failure: string | null): ProviderStageV0 | null {
  if (failure === null) return null;
  if (/APPRAISAL_FAILED/.test(failure)) return "APPRAISAL";
  if (/COGNITION_FAILED|COGNITION_/.test(failure)) return "COGNITION";
  if (/LANGUAGE_/.test(failure)) return "LANGUAGE";
  if (/BELIEF/i.test(failure)) return "BELIEF_ADAPTATION";
  if (/PERSONALITY/i.test(failure)) return "PERSONALITY_ADAPTATION";
  if (/RELATIONSHIP|FAMILIARITY/i.test(failure)) return "RELATIONSHIP_ADAPTATION";
  return null;
}

function shorten(value: string, max = 220): string {
  const flattened = value.replace(/[\r\n]+/g, " ");
  return flattened.length > max ? `${flattened.slice(0, max)}…` : flattened;
}

export class ProviderDiagnosticsV0 {
  private readonly records = new Map<ProviderStageV0, ProviderStageRecordV0>();

  constructor(private readonly options: ProviderDiagnosticsOptionsV0) {
    this.records.set("APPRAISAL", disabled("APPRAISAL"));
    this.records.set("BELIEF_ADAPTATION", disabled("BELIEF_ADAPTATION"));
    this.records.set("PERSONALITY_ADAPTATION", disabled("PERSONALITY_ADAPTATION"));
    this.records.set("RELATIONSHIP_ADAPTATION", disabled("RELATIONSHIP_ADAPTATION"));
    this.records.set("COGNITION", disabled("COGNITION"));
    this.records.set("LANGUAGE", disabled("LANGUAGE"));
  }

  now(): number {
    return (this.options.now ?? defaultMonotonicNowV0)();
  }

  /** Marks a stage as ENABLED (configured) without a call yet. */
  enable(stage: ProviderStageV0): void {
    if (stage === "BELIEF_ADAPTATION" || stage === "PERSONALITY_ADAPTATION") {
      this.records.set(stage, { stage, status: "OK", latency_ms: null, category: null, error_code: null, detail: "configured" });
    }
  }

  noteRunning(stage: ProviderStageV0): void {
    this.records.set(stage, { stage, status: "RUNNING", latency_ms: null, category: null, error_code: null, detail: null });
    this.options.write(`[${stage.toLowerCase()}] running...`);
  }

  noteSucceeded(stage: ProviderStageV0, latencyMs: number): void {
    this.records.set(stage, { stage, status: "OK", latency_ms: latencyMs, category: null, error_code: null, detail: null });
    this.options.write(`[${stage.toLowerCase()}] done (${formatLatencyV0(latencyMs)})`);
  }

  noteFailed(stage: ProviderStageV0, latencyMs: number, error: unknown): void {
    const classified = classifyProviderFailureV0(error);
    this.records.set(stage, {
      stage,
      status: "FAILED",
      latency_ms: latencyMs,
      category: classified.category,
      error_code: classified.error_code,
      detail: classified.detail
    });
    this.options.write(
      `[${stage.toLowerCase()}] failed (${formatLatencyV0(latencyMs)}): ${classified.category}` +
        (this.options.debug ? ` [${classified.error_code ?? "no-code"}] ${shorten(classified.detail, 160)}` : "")
    );
  }

  /** Records a stage outcome reported after the turn (e.g. belief adaptation). */
  noteReported(stage: ProviderStageV0, status: "OK" | "FAILED" | "DISABLED", detail: string | null): void {
    this.records.set(stage, {
      stage,
      status,
      latency_ms: this.records.get(stage)?.latency_ms ?? null,
      category: status === "FAILED" ? "PROVIDER_INTERNAL_ERROR" : null,
      error_code: null,
      detail
    });
  }

  last(stage: ProviderStageV0): ProviderStageRecordV0 {
    return this.records.get(stage) ?? disabled(stage);
  }

  formatLines(): readonly string[] {
    const lines = [
      `Provider: ${this.options.model}`,
      `Configured timeout: ${this.options.timeout_ms} ms`,
      "Stages:"
    ];
    for (const stage of ["APPRAISAL", "BELIEF_ADAPTATION", "PERSONALITY_ADAPTATION", "RELATIONSHIP_ADAPTATION", "COGNITION", "LANGUAGE"] as const) {
      const record = this.last(stage);
      if (record.status === "DISABLED") {
        lines.push(`  ${stage}: DISABLED (not configured)`);
        continue;
      }
      const latency = record.latency_ms === null ? "n/a" : formatLatencyV0(record.latency_ms);
      const category = record.category === null ? "" : ` ${record.category}`;
      const detail = record.detail === null ? "" : ` — ${shorten(record.detail, 120)}`;
      lines.push(`  ${stage}: ${record.status} latency=${latency}${category}${detail}`);
    }
    lines.push("No canonical subject state is written by provider diagnostics.");
    return lines;
  }
}

function disabled(stage: ProviderStageV0): ProviderStageRecordV0 {
  return { stage, status: "DISABLED", latency_ms: null, category: null, error_code: null, detail: null };
}

export function formatLatencyV0(latencyMs: number): string {
  if (latencyMs < 1000) return `${latencyMs} ms`;
  return `${(latencyMs / 1000).toFixed(1)} s`;
}

/** Wraps ONE transport instance with a single stage label. Pass-through only. */
export function wrapTransportForStageV0(
  inner: ModelTransportV0,
  stage: ProviderStageV0,
  diagnostics: ProviderDiagnosticsV0
): ModelTransportV0 {
  return {
    complete: async (request: ModelTransportRequestV0): Promise<ModelTransportResponseV0> => {
      diagnostics.noteRunning(stage);
      const started = diagnostics.now();
      try {
        const response = await inner.complete(request);
        diagnostics.noteSucceeded(stage, diagnostics.now() - started);
        return response;
      } catch (error) {
        diagnostics.noteFailed(stage, diagnostics.now() - started, error);
        throw error;
      }
    }
  } as ModelTransportV0;
}
