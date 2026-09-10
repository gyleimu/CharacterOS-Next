/**
 * COGNITION_PROVIDER_OUTPUT_BUDGET_REPAIR_V0 — session-level provider budget
 * conformance.
 *
 * Fully OFFLINE: the HTTP boundary is mocked, so the REAL
 * OllamaNativeCognitionTransportV0 runs end to end against a deterministic
 * Ollama-shaped envelope. Zero real model calls.
 *
 * Proves:
 *  - the configured context budget reaches the native wire body as num_ctx and
 *    is distinct from num_predict;
 *  - the session's request-identity audit agrees with the transport's wire body
 *    (no shadow mismatch) and fails when the two budgets disagree;
 *  - provider-declared truncation fails the interaction closed without
 *    language, behavior, Experience or Memory;
 *  - a provider terminal trace carrying prompt/generation token counts, finish
 *    reason and the configured budget survives per interaction (not only as a
 *    single overwritable `lastTrace`);
 *  - normal valid output is unaffected.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import type { SubjectStateV0 } from "@characteros-next/subject-core";
import type { FactualEventAppraisalProviderV0 } from "@characteros-next/appraisal";

import { s0 } from "../transitions/observation/observation-fixtures.js";
import {
  OllamaNativeCognitionTransportV0,
  OLLAMA_NATIVE_COGNITION_TRANSPORT_CONTEXT_WINDOW_TOKENS,
  OLLAMA_NATIVE_COGNITION_TRANSPORT_NUM_PREDICT
} from "../providers/cognition/ollama-native-cognition-transport.js";
import type { ModelTransportTraceV0 } from "../transports/model-transport-trace-v0.js";
import type {
  ModelTransportResponseV0,
  ModelTransportV0
} from "../transports/model-transport.js";
import type {
  EnvironmentConsequenceV0,
  EnvironmentInteractionV0,
  EnvironmentObservationInputV0,
  EnvironmentStateV0,
  SubjectEnvironmentV0
} from "./session-contracts-v0.js";
import { createLongHorizonSubjectSessionV0, type LongHorizonSubjectSessionOptionsV0 } from "./subject-session-v0.js";

const SUBJECT_ID = "subject-s0";
const BASE_URL = "http://127.0.0.1:11434";
const MODEL = "qwen3.5:9b";

class BudgetTestEnvironment implements SubjectEnvironmentV0 {
  readonly environment_id = "budget-test-environment-v0";
  readonly interaction_count = 4;
  private state = { exchange_count: 0 };

  nextInteraction(index: number): EnvironmentInteractionV0 {
    return { interaction_id: `b${index}`, scene: `scene ${index}`, task: "respond to Alice" };
  }

  observeBehavior(input: EnvironmentObservationInputV0): EnvironmentConsequenceV0 {
    this.state = { exchange_count: this.state.exchange_count + 1 + input.interaction_index * 0 };
    return { reply_text: "Noted on the shared checklist.", state: this.exportState() };
  }

  exportState(): EnvironmentStateV0 {
    const payload = { ...this.state } as Record<string, unknown>;
    return { schema_version: "subject-environment-state-v0", state_hash: `hash:${JSON.stringify(payload)}`, payload };
  }

  restoreState(state: EnvironmentStateV0): void {
    this.state = { exchange_count: Number(state.payload["exchange_count"] ?? 0) };
  }

  stateHash(): string {
    return this.exportState().state_hash;
  }
}

function fakeAppraisalProvider(): FactualEventAppraisalProviderV0 {
  return {
    proposeFactualEventAppraisal: async (context: never) => {
      const ctx = context as unknown as { subject_id: string; factual_event_ref: string; context_projection_hash: string };
      return {
        schema_version: "factual-event-appraisal-proposal-v0",
        status: "APPRAISED",
        subject_id: ctx.subject_id,
        factual_event_ref: ctx.factual_event_ref,
        context_projection_hash: ctx.context_projection_hash,
        dimensions: {
          relevance: 0.7,
          goal_congruence: 0.6,
          attribution: "other",
          controllability: 0.5,
          uncertainty: 0.4,
          intensity: 0.5
        },
        assessment_confidence: 0.8,
        evidence_refs: [ctx.factual_event_ref].sort()
      };
    }
  } as unknown as FactualEventAppraisalProviderV0;
}

/** Never reached: a CLARIFY-directive cognition turn requires no language call. */
function unusedTransport(): ModelTransportV0 {
  return {
    complete: async (): Promise<ModelTransportResponseV0> => {
      throw new Error("language transport must not be called for CLARIFY cognition");
    }
  } as ModelTransportV0;
}

interface CapturedCall {
  readonly body: Record<string, unknown>;
  readonly options: Record<string, unknown>;
}

function mustCall(calls: readonly CapturedCall[]): CapturedCall {
  const call = calls[0];
  if (call === undefined) throw new Error("expected one captured provider call");
  return call;
}

function mustTrace(trace: ModelTransportTraceV0 | null): ModelTransportTraceV0 {
  if (trace === null) throw new Error("expected a provider terminal trace");
  return trace;
}

function mustNumber(value: unknown, label: string): number {
  if (typeof value !== "number") throw new Error(`expected numeric ${label}, got ${typeof value}`);
  return value;
}

/**
 * Stub the HTTP boundary with an Ollama-shaped envelope. The proposal's
 * projection_hash is echoed from the prompt so the real cognition validator
 * accepts it, and metadata controls the finish signal.
 */
function stubOllama(metadata: Record<string, unknown>): { calls: CapturedCall[] } {
  const calls: CapturedCall[] = [];
  vi.stubGlobal("fetch", async (_input: unknown, init?: RequestInit) => {
    const raw = String(init?.body ?? "{}");
    const body = JSON.parse(raw) as {
      messages?: { role: string; content: string }[];
      options?: Record<string, unknown>;
    };
    calls.push({ body: body as Record<string, unknown>, options: body.options ?? {} });
    const user = body.messages?.find((message) => message.role === "user")?.content ?? "";
    const projectionHash = /\[projection_hash\]\s+(\S+)/.exec(user)?.[1] ?? "";
    const content = JSON.stringify({
      schema_version: "conversation-cognition-proposal-v1",
      cognition: {
        schema_version: "cognition-proposal-v0",
        projection_hash: projectionHash,
        reasoning_summary: "offline budget conformance cognition",
        relevant_memory_refs: [],
        considered_context_refs: [],
        current_intent: "report the current status",
        confidence: 0.7,
        uncertainty: 0.3,
        action_intent: null,
        evidence_refs: []
      },
      communication_directive: { kind: "CLARIFY_MISSING_CONTEXT" }
    });
    return new Response(JSON.stringify({ model: MODEL, message: { role: "assistant", content }, ...metadata }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  });
  return { calls };
}

/** Builds the real native transport with a per-call trace ledger. */
function realCognitionTransport(input: {
  readonly traces: ModelTransportTraceV0[];
  readonly contextWindowTokens?: number;
  readonly numPredict?: number;
}): OllamaNativeCognitionTransportV0 {
  return new OllamaNativeCognitionTransportV0({
    base_url: BASE_URL,
    model: MODEL,
    timeout_ms: 120_000,
    num_predict: input.numPredict ?? OLLAMA_NATIVE_COGNITION_TRANSPORT_NUM_PREDICT,
    ...(input.contextWindowTokens === undefined ? {} : { context_window_tokens: input.contextWindowTokens }),
    trace_observer: (event) => {
      if (!("stage" in event)) input.traces.push(event);
    }
  });
}

function sessionOptions(input: {
  readonly transport: ModelTransportV0;
  readonly traces: ModelTransportTraceV0[];
  readonly contextWindowTokens: number;
  readonly numPredict?: number;
}): LongHorizonSubjectSessionOptionsV0 {
  const numPredict = input.numPredict ?? OLLAMA_NATIVE_COGNITION_TRANSPORT_NUM_PREDICT;
  return {
    session_id: "sess-budget-1",
    subject: { subject_id: SUBJECT_ID, display_name: "", identity_anchors: [] },
    v3_source: s0() as unknown as SubjectStateV0,
    conversationCognitionTransport: input.transport,
    languageTransport: unusedTransport(),
    factualEventAppraisalProvider: fakeAppraisalProvider(),
    environment: new BudgetTestEnvironment(),
    interaction_interval_ticks: 300,
    provider_identity: {
      model: MODEL,
      num_predict: numPredict,
      context_window_tokens: input.contextWindowTokens,
      last_trace: () => input.traces.at(-1) ?? null
    },
    clock: () => "2026-01-01T00:00:00.000Z"
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("COGNITION_PROVIDER_OUTPUT_BUDGET_REPAIR_V0 — wire budget", () => {
  it("sends an explicit num_ctx distinct from num_predict and records it in the trace", async () => {
    const { calls } = stubOllama({ done_reason: "stop" });
    const traces: ModelTransportTraceV0[] = [];
    const session = await createLongHorizonSubjectSessionV0(sessionOptions({
      transport: realCognitionTransport({ traces, contextWindowTokens: 8192, numPredict: 2048 }),
      traces,
      contextWindowTokens: 8192,
      numPredict: 2048
    }));
    const outcome = await session.processInteraction();

    expect(outcome.status).toBe("COMPLETE");
    expect(calls).toHaveLength(1);
    const call = mustCall(calls);
    expect(mustNumber(call.options["num_ctx"], "options.num_ctx")).toBe(8192);
    expect(mustNumber(call.options["num_predict"], "options.num_predict")).toBe(2048);
    expect(mustTrace(outcome.provider_terminal_trace).budget).toEqual({
      context_window_tokens: 8192,
      max_output_tokens: 2048
    });
  });

  it("uses the CharacterOS-owned default context budget when none is configured", async () => {
    const { calls } = stubOllama({ done_reason: "stop" });
    const traces: ModelTransportTraceV0[] = [];
    const session = await createLongHorizonSubjectSessionV0(sessionOptions({
      transport: realCognitionTransport({ traces }),
      traces,
      contextWindowTokens: OLLAMA_NATIVE_COGNITION_TRANSPORT_CONTEXT_WINDOW_TOKENS
    }));
    await session.processInteraction();
    expect(mustNumber(mustCall(calls).options["num_ctx"], "options.num_ctx"))
      .toBe(OLLAMA_NATIVE_COGNITION_TRANSPORT_CONTEXT_WINDOW_TOKENS);
    // Explicit, and comfortably clear of the implicit default that caused the failure.
    expect(OLLAMA_NATIVE_COGNITION_TRANSPORT_CONTEXT_WINDOW_TOKENS).toBeGreaterThan(4096);
  });
});

describe("COGNITION_PROVIDER_OUTPUT_BUDGET_REPAIR_V0 — request identity agreement", () => {
  it("the session's rebuilt identity body matches the transport wire body (no shadow mismatch)", async () => {
    const { calls } = stubOllama({ done_reason: "stop" });
    const traces: ModelTransportTraceV0[] = [];
    const session = await createLongHorizonSubjectSessionV0(sessionOptions({
      transport: realCognitionTransport({ traces, contextWindowTokens: 8192 }),
      traces,
      contextWindowTokens: 8192
    }));
    const outcome = await session.processInteraction();
    expect(outcome.provider_request_identity_match).toBe(true);
    expect(outcome.provider_request_hash).toBe(outcome.transport_request_hash);
    // ...and that agreement holds while num_ctx is genuinely on the wire.
    expect(mustNumber(mustCall(calls).options["num_ctx"], "options.num_ctx")).toBe(8192);
  });

  it("a mismatched context budget is reported as an identity failure, never silently accepted", async () => {
    stubOllama({ done_reason: "stop" });
    const traces: ModelTransportTraceV0[] = [];
    const session = await createLongHorizonSubjectSessionV0(sessionOptions({
      transport: realCognitionTransport({ traces, contextWindowTokens: 8192 }),
      traces,
      contextWindowTokens: 16384 // session believes a different budget than the transport sends
    }));
    const outcome = await session.processInteraction();
    expect(outcome.provider_request_identity_match).toBe(false);
    expect(outcome.provider_request_hash).not.toBe(outcome.transport_request_hash);
  });
});

describe("COGNITION_PROVIDER_OUTPUT_BUDGET_REPAIR_V0 — truncation fails closed", () => {
  it("provider-declared truncation yields no language, behavior, Experience or Memory", async () => {
    // Exact frozen E7 shape: prompt 3568 + generated 528 = the configured 4096.
    stubOllama({ done_reason: "length", prompt_eval_count: 3568, eval_count: 528 });
    const traces: ModelTransportTraceV0[] = [];
    const session = await createLongHorizonSubjectSessionV0(sessionOptions({
      transport: realCognitionTransport({ traces, contextWindowTokens: 4096, numPredict: 2048 }),
      traces,
      contextWindowTokens: 4096,
      numPredict: 2048
    }));
    const outcome = await session.processInteraction();

    expect(outcome.status).toBe("FAILED");
    expect(outcome.experience_ref).toBeNull();
    expect(outcome.episode_ref).toBeNull();
    expect(outcome.memory_event_ref).toBeNull();
    expect(outcome.behavior_text).toBe("");
    expect(outcome.language_call_required).toBe(false);
    expect(outcome.language_status).toBe("NOT_REACHED");
    const status = await session.status();
    expect(status.interaction_index).toBe(0);
    expect(status.completed_interactions).toBe(0);
    // The failure is attributable from CharacterOS evidence alone.
    const trace = mustTrace(outcome.provider_terminal_trace);
    expect(trace.failure_code).toBe("MODEL_OUTPUT_TRUNCATED");
    expect(trace.ollama.done_reason).toBe("length");
    expect(trace.ollama.prompt_eval_count).toBe(3568);
    expect(trace.ollama.eval_count).toBe(528);
    expect(trace.budget).toEqual({ context_window_tokens: 4096, max_output_tokens: 2048 });
  });

  it("normal valid output is unaffected by the truncation classification", async () => {
    stubOllama({ done_reason: "stop", prompt_eval_count: 3157, eval_count: 778 });
    const traces: ModelTransportTraceV0[] = [];
    const session = await createLongHorizonSubjectSessionV0(sessionOptions({
      transport: realCognitionTransport({ traces, contextWindowTokens: 8192 }),
      traces,
      contextWindowTokens: 8192
    }));
    const outcome = await session.processInteraction();
    expect(outcome.status).toBe("COMPLETE");
    expect(outcome.failure).toBeNull();
    const trace = mustTrace(outcome.provider_terminal_trace);
    expect(trace.failure_code).toBeNull();
    expect(trace.outcome).toBe("SUCCESS");
    expect(trace.budget.context_window_tokens).toBe(8192);
  });
});

describe("COGNITION_PROVIDER_OUTPUT_BUDGET_REPAIR_V0 — durable per-call finish telemetry", () => {
  it("keeps a distinct terminal trace per interaction instead of one overwritable lastTrace", async () => {
    stubOllama({ done_reason: "stop", prompt_eval_count: 1200, eval_count: 300 });
    const traces: ModelTransportTraceV0[] = [];
    const session = await createLongHorizonSubjectSessionV0(sessionOptions({
      transport: realCognitionTransport({ traces, contextWindowTokens: 8192 }),
      traces,
      contextWindowTokens: 8192
    }));
    for (let index = 0; index < 3; index += 1) {
      const outcome = await session.processInteraction();
      expect(outcome.status).toBe("COMPLETE");
    }
    // All three calls are recoverable from the session ledger…
    const ledger = session.ledger();
    expect(ledger).toHaveLength(3);
    const perCallTraces = ledger.map((outcome) => mustTrace(outcome.provider_terminal_trace));
    for (const trace of perCallTraces) {
      expect(trace.ollama.prompt_eval_count).toBe(1200);
      expect(trace.ollama.eval_count).toBe(300);
      expect(trace.ollama.done_reason).toBe("stop");
      expect(trace.budget.context_window_tokens).toBe(8192);
      expect(trace.budget.max_output_tokens).toBe(OLLAMA_NATIVE_COGNITION_TRANSPORT_NUM_PREDICT);
    }
    // …and the three requests are distinct prompts, not one overwritten trace.
    expect(traces).toHaveLength(3);
    const hashes = new Set(perCallTraces.map((trace) => trace.request_hash));
    expect(hashes.size).toBe(3);
    // The observer saw the same chronological ledger the outcomes expose.
    expect(traces.map((trace) => trace.request_hash)).toEqual(perCallTraces.map((trace) => trace.request_hash));
  });

  it("a provider that omits optional finish fields still yields a valid trace with nulls (no invented values)", async () => {
    stubOllama({});
    const traces: ModelTransportTraceV0[] = [];
    const session = await createLongHorizonSubjectSessionV0(sessionOptions({
      transport: realCognitionTransport({ traces, contextWindowTokens: 8192 }),
      traces,
      contextWindowTokens: 8192
    }));
    const outcome = await session.processInteraction();
    expect(outcome.status).toBe("COMPLETE");
    const trace = mustTrace(outcome.provider_terminal_trace);
    expect(trace.ollama.prompt_eval_count).toBeNull();
    expect(trace.ollama.eval_count).toBeNull();
    expect(trace.ollama.done_reason).toBeNull();
    // Configured budget is CharacterOS-side, so it is always present.
    expect(trace.budget).toEqual({
      context_window_tokens: 8192,
      max_output_tokens: OLLAMA_NATIVE_COGNITION_TRANSPORT_NUM_PREDICT
    });
  });
});
