/**
 * Ollama Native Cognition Transport V0 — instrumentation trace suite
 * (OLLAMA_COGNITION_TRANSPORT_INSTRUMENTATION_V0).
 *
 * NO real model, NO network, NO Ollama: the HTTP boundary is fully mocked via
 * `vi.stubGlobal("fetch", ...)`. The suite proves the diagnostic trace contract
 * is observational ONLY: every stage event, terminal trace, raw-error copy and
 * Ollama metadata side-read is emitted without changing the transport's frozen
 * observable semantics (endpoint, request bytes, ONE attempt, timeout/abort
 * behavior, response validation, error codes/messages — all asserted unchanged
 * alongside the trace).
 *
 * Also proves the preserved known gap: the timeout timer guards ONLY the fetch
 * await; a stalled body read is instrumented, never repaired.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { sha256Hex } from "@characteros-next/subject-core";

import {
  OllamaNativeCognitionTransportV0,
  type OllamaNativeCognitionTransportConfigV0
} from "./ollama-native-cognition-transport.js";
import {
  MODEL_TRANSPORT_TRACE_EVENT_SCHEMA_VERSION_V0,
  MODEL_TRANSPORT_TRACE_SCHEMA_VERSION_V0,
  type ModelTransportTraceEventV0,
  type ModelTransportTraceObserverV0,
  type ModelTransportTraceV0
} from "../../transports/model-transport-trace-v0.js";

const BASE_URL = "http://127.0.0.1:11434";
const MODEL = "qwen3.5:9b";

function config(overrides: Partial<OllamaNativeCognitionTransportConfigV0> = {}): OllamaNativeCognitionTransportConfigV0 {
  return { base_url: BASE_URL, model: MODEL, ...overrides };
}

interface FetchCall {
  url: string;
  init: RequestInit | undefined;
}

/** Fetch stub with call capture (every test asserts ONE attempt). */
function stubFetch(respond: (call: FetchCall) => Response | Promise<Response>): { calls: FetchCall[] } {
  const calls: FetchCall[] = [];
  vi.stubGlobal("fetch", async (input: unknown, init?: RequestInit) => {
    const call: FetchCall = { url: typeof input === "string" ? input : String((input as { url?: string })?.url ?? input), init };
    calls.push(call);
    return respond(call);
  });
  return { calls };
}

function okJson(body: string): Response {
  return new Response(body, { status: 200, headers: { "content-type": "application/json" } });
}

/** Envelope with final content, optional vendor reasoning, optional metadata. */
function ollamaBody(
  content: string,
  metadata: Record<string, unknown> = {}
): string {
  return JSON.stringify({ model: MODEL, message: { role: "assistant", content }, ...metadata });
}

const REQUEST = { messages: [{ role: "user" as const, content: "ping" }] };

interface Recording {
  events: ModelTransportTraceEventV0[];
  trace: ModelTransportTraceV0 | null;
}

/** Observer collector that NEVER feeds back into the transport. */
function collect(): { recording: Recording; observer: ModelTransportTraceObserverV0 } {
  const recording: Recording = { events: [], trace: null };
  const observer: ModelTransportTraceObserverV0 = (event) => {
    if ("stage" in event) recording.events.push(event);
    else recording.trace = event;
  };
  return { recording, observer };
}

function tracedTransport(
  recording: Recording,
  observer: ModelTransportTraceObserverV0,
  overrides: Partial<OllamaNativeCognitionTransportConfigV0> = {}
): OllamaNativeCognitionTransportV0 {
  return new OllamaNativeCognitionTransportV0({ ...config(overrides), trace_observer: observer });
}

/** Trace or fail loudly (narrows the terminal trace for assertions). */
function traceOf(recording: Recording): ModelTransportTraceV0 {
  if (recording.trace === null) throw new Error("expected a terminal trace");
  return recording.trace;
}

function bodyOf(calls: FetchCall[]): string {
  const call = calls[0];
  if (call === undefined) throw new Error("expected one fetch call");
  return String(call.init?.body);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

// ============================================================================
// Success path: stage event sequence, terminal trace, metadata side-read
// ============================================================================

describe("instrumentation — success path", () => {
  it("emits the full ordered stage event sequence and one SUCCESS terminal trace", async () => {
    const { recording, observer } = collect();
    stubFetch(() => okJson(ollamaBody("pong")));
    const transport = tracedTransport(recording, observer);
    const response = await transport.complete(REQUEST);

    expect(response).toEqual({ content: "pong", model: MODEL }); // semantics unchanged
    expect(recording.events.map((event) => event.stage)).toEqual([
      "STARTED",
      "RESPONSE_HEADERS_RECEIVED",
      "BODY_READ_STARTED",
      "BODY_READ_COMPLETED",
      "MODEL_RESPONSE_RECEIVED"
    ]);
    const trace = traceOf(recording);
    expect(trace.schema_version).toBe(MODEL_TRANSPORT_TRACE_SCHEMA_VERSION_V0);
    expect(trace.transport).toBe("ollama-native-cognition-transport-v0");
    expect(trace.outcome).toBe("SUCCESS");
    expect(trace.terminal_stage).toBe("COMPLETED");
    expect(trace.failure_code).toBeNull();
    expect(trace.model).toBe(MODEL);
    expect(trace.endpoint).toBe(`${BASE_URL}/api/chat`);
    expect(trace.response_status).toBe(200);
    expect(trace.response_headers_received).toBe(true);
    expect(trace.abort_triggered).toBe(false);
    expect(trace.abort_triggered_elapsed_ms).toBeNull();
    expect(trace.fetch_response_elapsed_ms).not.toBeNull();
    expect(trace.body_read_elapsed_ms).not.toBeNull();
    expect(trace.elapsed_ms).not.toBeNull();
    expect(trace.request_finished_at).not.toBeNull();
  });

  it("correlates every event and the trace through one per-invocation trace_id", async () => {
    const { recording, observer } = collect();
    stubFetch(() => okJson(ollamaBody("pong")));
    await tracedTransport(recording, observer).complete(REQUEST);
    const trace = traceOf(recording);
    const traceId = trace.trace_id;
    expect(traceId).toMatch(/^[0-9a-f-]{36}$/);
    for (const event of recording.events) {
      expect(event.schema_version).toBe(MODEL_TRANSPORT_TRACE_EVENT_SCHEMA_VERSION_V0);
      expect(event.trace_id).toBe(traceId);
      expect(typeof event.elapsed_ms).toBe("number");
      expect(Number.isNaN(Date.parse(event.timestamp))).toBe(false);
    }
  });

  it("records stage elapsed_ms non-decreasing across the success sequence", async () => {
    const { recording, observer } = collect();
    stubFetch(() => okJson(ollamaBody("pong")));
    await tracedTransport(recording, observer).complete(REQUEST);
    let previous = -1;
    for (const event of recording.events) {
      expect(event.elapsed_ms).toBeGreaterThanOrEqual(previous);
      previous = event.elapsed_ms;
    }
  });

  it("carries the request identity: sha256 hash of the exact wire body and byte length", async () => {
    const { recording, observer } = collect();
    const { calls } = stubFetch(() => okJson(ollamaBody("pong")));
    await tracedTransport(recording, observer).complete(REQUEST);
    const trace = traceOf(recording);
    const wireBody = bodyOf(calls);
    expect(trace.request_hash).toBe(`sha256:${await sha256Hex(wireBody)}`);
    expect(trace.request_bytes).toBe(new TextEncoder().encode(wireBody).length);
    expect(trace.timeout_ms).toBe(120000);
    const startedMs = Date.parse(trace.request_started_at);
    const deadlineMs = Date.parse(trace.timeout_deadline_at);
    // 120000 ± small wall-clock skew between the two Date reads.
    expect(Math.abs(deadlineMs - startedMs - 120000)).toBeLessThanOrEqual(5);
  });

  it("identical inputs produce identical request hashes but distinct trace ids", async () => {
    const first = collect();
    const second = collect();
    stubFetch(() => okJson(ollamaBody("pong")));
    const transportConfig = config();
    await new OllamaNativeCognitionTransportV0({ ...transportConfig, trace_observer: first.observer }).complete(REQUEST);
    await new OllamaNativeCognitionTransportV0({ ...transportConfig, trace_observer: second.observer }).complete(REQUEST);
    expect(traceOf(first.recording).request_hash).toBe(traceOf(second.recording).request_hash);
    expect(traceOf(first.recording).trace_id).not.toBe(traceOf(second.recording).trace_id);
  });
});

// ============================================================================
// Ollama inference metadata side-read (diagnostic only)
// ============================================================================

describe("instrumentation — Ollama inference metadata", () => {
  it("extracts the full inference timing block from the envelope", async () => {
    const { recording, observer } = collect();
    stubFetch(() =>
      okJson(ollamaBody("pong", {
        total_duration: 1_234_567_890,
        load_duration: 5_000_000,
        prompt_eval_count: 11,
        prompt_eval_duration: 22_000_000,
        eval_count: 33,
        eval_duration: 44_000_000,
        done_reason: "stop",
        thinking: "hidden reasoning must not become content"
      }))
    );
    const response = await tracedTransport(recording, observer).complete(REQUEST);
    expect(response.content).toBe("pong"); // content authority unchanged
    const trace = traceOf(recording);
    expect(trace.ollama).toEqual({
      total_duration: 1_234_567_890,
      load_duration: 5_000_000,
      prompt_eval_count: 11,
      prompt_eval_duration: 22_000_000,
      eval_count: 33,
      eval_duration: 44_000_000,
      done_reason: "stop"
    });
  });

  it("narrows ill-typed and absent metadata fields to null without failing the call", async () => {
    const { recording, observer } = collect();
    stubFetch(() =>
      okJson(ollamaBody("pong", { total_duration: "not-a-number", eval_count: true }))
    );
    await tracedTransport(recording, observer).complete(REQUEST);
    const trace = traceOf(recording);
    expect(trace.ollama.total_duration).toBeNull();
    expect(trace.ollama.eval_count).toBeNull();
    expect(trace.ollama.load_duration).toBeNull();
    expect(trace.ollama.done_reason).toBeNull();
  });

  it("still extracts metadata on an empty-content failure (side-read precedes authority check)", async () => {
    const { recording, observer } = collect();
    stubFetch(() => okJson(ollamaBody("", { eval_count: 7 })));
    await expect(tracedTransport(recording, observer).complete(REQUEST))
      .rejects.toMatchObject({ code: "MODEL_EMPTY_RESPONSE" });
    const trace = traceOf(recording);
    expect(trace.ollama.eval_count).toBe(7);
    expect(trace.outcome).toBe("FAILURE");
  });
});

// ============================================================================
// Failure paths: terminal trace preserves codes/messages while adding detail
// ============================================================================

describe("instrumentation — failure terminal traces", () => {
  it("timeout: ABORT_TRIGGERED event, MODEL_TIMEOUT trace, unchanged thrown error", async () => {
    const { recording, observer } = collect();
    stubFetch((_call) => new Promise<Response>((_resolve, reject) => {
      const abort = (_call.init?.signal as AbortSignal | undefined) ?? null;
      abort?.addEventListener("abort", () => reject(new Error("aborted")));
    }));
    const timeoutMs = 25;
    await expect(tracedTransport(recording, observer, { timeout_ms: timeoutMs }).complete(REQUEST))
      .rejects.toMatchObject({
        code: "MODEL_TIMEOUT",
        http_status: null,
        message: `MODEL_TRANSPORT_MODEL_TIMEOUT: ollama native cognition transport timed out after ${timeoutMs}ms`
      });
    expect(recording.events.map((event) => event.stage)).toEqual(["STARTED", "ABORT_TRIGGERED"]);
    const trace = traceOf(recording);
    expect(trace.outcome).toBe("FAILURE");
    expect(trace.terminal_stage).toBe("BEFORE_FETCH_RESPONSE");
    expect(trace.failure_code).toBe("MODEL_TIMEOUT");
    expect(trace.abort_triggered).toBe(true);
    expect(trace.abort_triggered_elapsed_ms).toBeGreaterThanOrEqual(timeoutMs - 5);
    expect(trace.abort_triggered_elapsed_ms).toBeLessThan(timeoutMs + 1000);
    expect(trace.fetch_response_elapsed_ms).toBeNull();
    expect(trace.response_headers_received).toBe(false);
    expect(trace.response_status).toBeNull();
  });

  it("HTTP failure: trace keeps status and stage; thrown error unchanged", async () => {
    const { recording, observer } = collect();
    stubFetch(() => new Response("nope", { status: 500 }));
    await expect(tracedTransport(recording, observer).complete(REQUEST))
      .rejects.toMatchObject({ code: "MODEL_HTTP_FAILURE", http_status: 500 });
    expect(recording.events.map((event) => event.stage)).toEqual([
      "STARTED",
      "RESPONSE_HEADERS_RECEIVED"
    ]);
    const trace = traceOf(recording);
    expect(trace.outcome).toBe("FAILURE");
    expect(trace.terminal_stage).toBe("RESPONSE_HEADERS_RECEIVED");
    expect(trace.failure_code).toBe("MODEL_HTTP_FAILURE");
    expect(trace.response_status).toBe(500);
    expect(trace.body_read_elapsed_ms).toBeNull();
  });

  it("body-read failure: BODY_READ stage with measured body time and raw error copy", async () => {
    const { recording, observer } = collect();
    stubFetch(() => new Response("<html>not json</html>", { status: 200 }));
    await expect(tracedTransport(recording, observer).complete(REQUEST))
      .rejects.toMatchObject({ code: "MODEL_HTTP_FAILURE" });
    expect(recording.events.map((event) => event.stage)).toEqual([
      "STARTED",
      "RESPONSE_HEADERS_RECEIVED",
      "BODY_READ_STARTED"
    ]);
    const trace = traceOf(recording);
    expect(trace.terminal_stage).toBe("BODY_READ");
    expect(trace.failure_code).toBe("MODEL_HTTP_FAILURE");
    expect(trace.body_read_elapsed_ms).not.toBeNull();
    expect(trace.raw_error_name).not.toBeNull();
    expect(trace.raw_error_message).not.toBeNull();
  });

  it("connection failure: raw error name/message/cause code captured, BEFORE_FETCH_RESPONSE stage", async () => {
    const { recording, observer } = collect();
    stubFetch(() => {
      const failure = new Error("connect ECONNREFUSED 127.0.0.1:11434") as Error & { cause?: unknown };
      failure.cause = { code: "ECONNREFUSED" };
      throw failure;
    });
    await expect(tracedTransport(recording, observer).complete(REQUEST))
      .rejects.toMatchObject({
        code: "MODEL_CONNECTION_FAILURE",
        message: "MODEL_TRANSPORT_MODEL_CONNECTION_FAILURE: ollama native cognition transport failed: connect ECONNREFUSED 127.0.0.1:11434"
      });
    const trace = traceOf(recording);
    expect(trace.terminal_stage).toBe("BEFORE_FETCH_RESPONSE");
    expect(trace.failure_code).toBe("MODEL_CONNECTION_FAILURE");
    expect(trace.raw_error_name).toBe("Error");
    expect(trace.raw_error_message).toBe("connect ECONNREFUSED 127.0.0.1:11434");
    expect(trace.raw_error_cause_code).toBe("ECONNREFUSED");
    expect(trace.fetch_response_elapsed_ms).toBeNull();
  });

  it("empty content: MODEL_RESPONSE_RECEIVED stage; thrown error message unchanged", async () => {
    const { recording, observer } = collect();
    stubFetch(() => okJson(ollamaBody("   \n\t ")));
    await expect(tracedTransport(recording, observer).complete(REQUEST))
      .rejects.toMatchObject({ code: "MODEL_EMPTY_RESPONSE" });
    const trace = traceOf(recording);
    expect(trace.terminal_stage).toBe("MODEL_RESPONSE_RECEIVED");
    expect(trace.failure_code).toBe("MODEL_EMPTY_RESPONSE");
  });
});

// ============================================================================
// Observer isolation and absent-observer equivalence
// ============================================================================

describe("instrumentation — observer isolation", () => {
  it("a throwing observer never affects the success path", async () => {
    stubFetch(() => okJson(ollamaBody("pong")));
    const transport = new OllamaNativeCognitionTransportV0({
      ...config(),
      trace_observer: () => {
        throw new Error("observer exploded");
      }
    });
    const response = await transport.complete(REQUEST);
    expect(response.content).toBe("pong");
  });

  it("a throwing observer never affects the timeout path (abort still fires)", async () => {
    stubFetch((_call) => new Promise<Response>((_resolve, reject) => {
      const abort = (_call.init?.signal as AbortSignal | undefined) ?? null;
      abort?.addEventListener("abort", () => reject(new Error("aborted")));
    }));
    const transport = new OllamaNativeCognitionTransportV0({
      ...config({ timeout_ms: 20 }),
      trace_observer: () => {
        throw new Error("observer exploded");
      }
    });
    await expect(transport.complete(REQUEST)).rejects.toMatchObject({ code: "MODEL_TIMEOUT" });
  });

  it("without an observer the transport behaves identically (no events, normal result)", async () => {
    const { calls } = stubFetch(() => okJson(ollamaBody("pong")));
    const response = await new OllamaNativeCognitionTransportV0(config()).complete(REQUEST);
    expect(response).toEqual({ content: "pong", model: MODEL });
    expect(calls).toHaveLength(1);
  });
});

// ============================================================================
// Preserved known gap: the timer does NOT guard the body read
// ============================================================================

describe("instrumentation — preserved body-read timeout gap", () => {
  it("a stalled body read survives well past the timeout (instrumented, never repaired)", async () => {
    let closeStream: (() => void) | undefined;
    const { recording, observer } = collect();
    stubFetch(() =>
      new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode(ollamaBody("late body", { eval_count: 5 }))
            );
            closeStream = () => controller.close();
          }
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    const transport = tracedTransport(recording, observer, { timeout_ms: 30 });
    const pending = transport.complete(REQUEST);

    let resolved = false;
    let rejection: unknown = null;
    pending.then(
      () => { resolved = true; },
      (error: unknown) => { rejection = error; }
    );
    await new Promise((resolve) => setTimeout(resolve, 250));
    // The 30ms timeout fired long ago; the body read is still pending — the
    // preserved gap. No timeout error, no abort, no repair.
    expect(resolved).toBe(false);
    expect(rejection).toBeNull();

    closeStream?.();
    const response = await pending;
    expect(response.content).toBe("late body");
    const trace = traceOf(recording);
    expect(trace.abort_triggered).toBe(false); // timer was cleared after fetch
    expect(trace.outcome).toBe("SUCCESS");
    expect(trace.body_read_elapsed_ms).not.toBeNull();
    expect(trace.fetch_response_elapsed_ms).toBeLessThan(trace.body_read_elapsed_ms as number);
  });
});
