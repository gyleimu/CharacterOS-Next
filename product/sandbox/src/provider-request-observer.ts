/**
 * PROVIDER REQUEST OBSERVER (monitoring instrumentation, not core).
 *
 * The product's transports answer the `ModelTransportV0` port; the cloud family
 * (OpenAI-compatible `/chat/completions`) returns token `usage` in its JSON body
 * and the transports intentionally discard everything except the message content.
 * Long-run operation needs EXACT provider request accounting and token usage, so
 * this module observes the HTTP layer from the OUTSIDE:
 *
 * - it wraps `globalThis.fetch` for the duration of a run and records, per call,
 *   only NON-SECRET telemetry: host, path, HTTP status, duration, request and
 *   response BYTE sizes, the model name and the provider's `usage` numbers;
 * - it never records headers (an `authorization` header is never read), never
 *   records request or response bodies, prompts, memory content or model output;
 * - it never throws into the observed call path and never changes a request,
 *   a response, an error or a timeout — observation is pass-through;
 * - calls to endpoints outside the observed hosts are untouched and unrecorded.
 *
 * Usage that the provider does not return is recorded as `null` (NOT_AVAILABLE),
 * never estimated.
 */

export interface ProviderUsageV0 {
  readonly prompt_tokens: number | null;
  readonly completion_tokens: number | null;
  readonly total_tokens: number | null;
}

export interface ProviderRequestRecordV0 {
  readonly sequence: number;
  readonly started_at: string;
  readonly duration_ms: number;
  readonly host: string;
  readonly path: string;
  readonly status: number | null;
  readonly outcome: "OK" | "HTTP_ERROR" | "TRANSPORT_ERROR";
  readonly request_bytes: number;
  readonly response_bytes: number | null;
  readonly model: string | null;
  /**
   * Output-token budget the request asked for (`max_tokens` on the cloud family,
   * `options.num_predict` on the native local family). A non-content field, used
   * only to separate stages that use a distinct budget (the appraisal stage asks
   * for a much smaller budget than cognition/language).
   */
  readonly max_output_tokens: number | null;
  readonly usage: ProviderUsageV0 | null;
}

export interface ProviderRequestSummaryV0 {
  readonly observed_hosts: readonly string[];
  readonly total_requests: number;
  readonly by_outcome: Readonly<Record<string, number>>;
  readonly by_path: Readonly<Record<string, number>>;
  /** Requests grouped by the output-token budget they asked for (content-free). */
  readonly by_output_budget: Readonly<Record<string, number>>;
  readonly http_error_statuses: readonly number[];
  readonly usage: {
    readonly requests_with_usage: number;
    readonly prompt_tokens: number | null;
    readonly completion_tokens: number | null;
    readonly total_tokens: number | null;
    readonly presence: "AVAILABLE" | "NOT_AVAILABLE";
  };
  readonly duration_ms: { readonly min: number | null; readonly median: number | null; readonly p95: number | null; readonly max: number | null };
}

export interface ProviderRequestObserverV0 {
  /** Records collected so far, in call order (read-only copy). */
  records(): readonly ProviderRequestRecordV0[];
  summary(): ProviderRequestSummaryV0;
  /** Removes the wrapper (idempotent). */
  uninstall(): void;
}

function finiteNumberV0(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Reads ONLY the provider's usage numbers; bodies are never retained. */
function usageFromBodyV0(body: unknown): ProviderUsageV0 | null {
  if (body === null || typeof body !== "object") return null;
  const usage = (body as { usage?: unknown }).usage;
  if (usage === null || typeof usage !== "object") return null;
  const record = usage as { prompt_tokens?: unknown; completion_tokens?: unknown; total_tokens?: unknown };
  const prompt = finiteNumberV0(record.prompt_tokens);
  const completion = finiteNumberV0(record.completion_tokens);
  const total = finiteNumberV0(record.total_tokens);
  if (prompt === null && completion === null && total === null) return null;
  return { prompt_tokens: prompt, completion_tokens: completion, total_tokens: total };
}

function modelFromRequestV0(init: RequestInit | undefined): string | null {
  const body = init?.body;
  if (typeof body !== "string") return null;
  try {
    const parsed: unknown = JSON.parse(body);
    if (parsed !== null && typeof parsed === "object") {
      const model = (parsed as { model?: unknown }).model;
      if (typeof model === "string") return model;
    }
  } catch {
    // A non-JSON or unparsable body is fine: the model name is optional telemetry.
  }
  return null;
}

function budgetFromRequestV0(init: RequestInit | undefined): number | null {
  const body = init?.body;
  if (typeof body !== "string") return null;
  try {
    const parsed: unknown = JSON.parse(body);
    if (parsed === null || typeof parsed !== "object") return null;
    const record = parsed as { max_tokens?: unknown; options?: { num_predict?: unknown } };
    return finiteNumberV0(record.max_tokens) ?? finiteNumberV0(record.options?.num_predict);
  } catch {
    return null;
  }
}

function requestBytesV0(init: RequestInit | undefined): number {
  const body = init?.body;
  if (typeof body === "string") return Buffer.byteLength(body, "utf8");
  return 0;
}

function percentileV0(sorted: readonly number[], fraction: number): number | null {
  if (sorted.length === 0) return null;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(fraction * sorted.length) - 1));
  return sorted[index] ?? null;
}

/**
 * Observes every `fetch` whose HOST matches one of `observed_base_urls`.
 * Installs exactly one wrapper; calling install twice is a no-op for the second
 * call. Safe to uninstall at any time.
 */
export function installProviderRequestObserverV0(
  observed_base_urls: readonly string[]
): ProviderRequestObserverV0 {
  const hosts = new Set<string>();
  for (const raw of observed_base_urls) {
    try {
      hosts.add(new URL(raw).host);
    } catch {
      // An unparsable base URL simply observes nothing for that entry.
    }
  }

  const collected: ProviderRequestRecordV0[] = [];
  const original = globalThis.fetch;
  let sequence = 0;
  let installed = true;

  const wrapped: typeof globalThis.fetch = async (input, init) => {
    const startedAt = Date.now();
    const url = (() => {
      if (typeof input === "string") return input;
      if (input instanceof URL) return input.href;
      return input.url;
    })();
    let observed: boolean;
    let host = "";
    let path = "";
    try {
      const parsed = new URL(url);
      host = parsed.host;
      path = parsed.pathname;
      observed = hosts.has(host);
    } catch {
      observed = false;
    }
    if (!observed) return original(input as never, init as never);

    const model = modelFromRequestV0(init ?? undefined);
    const budget = budgetFromRequestV0(init ?? undefined);
    const bytes = requestBytesV0(init ?? undefined);
    const record = (record_: Omit<ProviderRequestRecordV0, "sequence" | "started_at" | "duration_ms" | "host" | "path" | "request_bytes" | "model" | "max_output_tokens">): void => {
      sequence += 1;
      collected.push({
        sequence,
        started_at: new Date(startedAt).toISOString(),
        duration_ms: Date.now() - startedAt,
        host,
        path,
        request_bytes: bytes,
        model,
        max_output_tokens: budget,
        ...record_
      });
    };

    let response: Response;
    try {
      response = await original(input as never, init as never);
    } catch (error) {
      record({
        status: null,
        outcome: "TRANSPORT_ERROR",
        response_bytes: null,
        usage: null
      });
      throw error;
    }
    if (!response.ok) {
      record({ status: response.status, outcome: "HTTP_ERROR", response_bytes: null, usage: null });
      return response;
    }
    // Success path: clone the body so the observed stream is never consumed twice.
    // Any failure while reading telemetry leaves the returned response untouched.
    let responseBytes: number | null;
    let usage: ProviderUsageV0 | null;
    try {
      const clone = response.clone();
      const text = await clone.text();
      responseBytes = Buffer.byteLength(text, "utf8");
      try {
        usage = usageFromBodyV0(JSON.parse(text) as unknown);
      } catch {
        usage = null;
      }
    } catch {
      responseBytes = null;
      usage = null;
    }
    record({ status: response.status, outcome: "OK", response_bytes: responseBytes, usage });
    return response;
  };

  globalThis.fetch = wrapped;

  return {
    records: () => [...collected],
    summary: () => summariseProviderRequestsV0(collected, [...hosts]),
    uninstall: () => {
      if (!installed) return;
      installed = false;
      globalThis.fetch = original;
    }
  };
}

/** Aggregates records into the summary shape the long-run artifact records. */
export function summariseProviderRequestsV0(
  records: readonly ProviderRequestRecordV0[],
  observedHosts: readonly string[]
): ProviderRequestSummaryV0 {
  const byOutcome: Record<string, number> = {};
  const byPath: Record<string, number> = {};
  const byBudget: Record<string, number> = {};
  const httpErrors: number[] = [];
  const durations: number[] = [];
  let withUsage = 0;
  let prompt = 0;
  let completion = 0;
  let total = 0;
  let promptSeen = false;
  let completionSeen = false;
  let totalSeen = false;

  for (const record of records) {
    byOutcome[record.outcome] = (byOutcome[record.outcome] ?? 0) + 1;
    byPath[record.path] = (byPath[record.path] ?? 0) + 1;
    const budgetKey = record.max_output_tokens === null ? "UNSPECIFIED" : String(record.max_output_tokens);
    byBudget[budgetKey] = (byBudget[budgetKey] ?? 0) + 1;
    if (record.outcome === "HTTP_ERROR" && record.status !== null) httpErrors.push(record.status);
    durations.push(record.duration_ms);
    if (record.usage !== null) {
      withUsage += 1;
      if (record.usage.prompt_tokens !== null) {
        prompt += record.usage.prompt_tokens;
        promptSeen = true;
      }
      if (record.usage.completion_tokens !== null) {
        completion += record.usage.completion_tokens;
        completionSeen = true;
      }
      if (record.usage.total_tokens !== null) {
        total += record.usage.total_tokens;
        totalSeen = true;
      }
    }
  }
  const sorted = [...durations].sort((a, b) => a - b);
  return {
    observed_hosts: [...observedHosts],
    total_requests: records.length,
    by_outcome: byOutcome,
    by_path: byPath,
    by_output_budget: byBudget,
    http_error_statuses: httpErrors,
    usage: {
      requests_with_usage: withUsage,
      prompt_tokens: promptSeen ? prompt : null,
      completion_tokens: completionSeen ? completion : null,
      total_tokens: totalSeen ? total : null,
      presence: withUsage > 0 ? "AVAILABLE" : "NOT_AVAILABLE"
    },
    duration_ms: {
      min: sorted[0] ?? null,
      median: percentileV0(sorted, 0.5),
      p95: percentileV0(sorted, 0.95),
      max: sorted.at(-1) ?? null
    }
  };
}
