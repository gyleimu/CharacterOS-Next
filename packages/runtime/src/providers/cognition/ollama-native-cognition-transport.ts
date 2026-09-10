/**
 * Ollama Native Cognition Transport V0 — transport/provider compatibility slice.
 *
 * Background: over the generic OpenAI-compatible endpoint (`/v1/chat/completions`)
 * a thinking model can spend its whole output budget on non-standard reasoning
 * fields and return an empty `message.content` (the frozen transport fails closed
 * there by design; REAL_MODEL_BELIEF_BEHAVIORAL_CAUSAL_PROOF_V0 observed exactly
 * this). The Ollama-NATIVE endpoint can explicitly suppress reasoning with
 * `think: false`, so `message.content` carries the final answer.
 *
 * This file is a ModelTransportV0 implementation ONLY. It plugs into the
 * EXISTING frozen LlmCognitionProviderV0 unchanged: the deterministic prompt
 * builder, JSON parsing, closed-schema validation, projection binding, evidence
 * grounding and action-space validation all remain the frozen provider's
 * authority. The transport is cognition-semantics-free: it moves prompt text to
 * `POST {base_url}/api/chat` and returns raw `message.content` — never
 * `message.thinking` / `reasoning` / any vendor reasoning field.
 *
 * Fixed request policy (NONE caller-controlled): stream = false, think = false,
 * options.temperature = 0, options.num_predict = configured output budget,
 * options.num_ctx = configured context budget. Exactly one request; no retry, no
 * fallback, no repair, no format field
 * (OLLAMA_FORMAT_MODE NONE — the frozen prompt + parser remain the authority),
 * no Authorization header (native local Ollama needs no fake OpenAI auth).
 *
 * CONTEXT BUDGET MIGRATION POLICY (COGNITION_PROVIDER_OUTPUT_BUDGET_REPAIR_V0):
 * every construction of this transport now sends an explicit `num_ctx`. Making
 * the field mandatory would have forced edits to frozen historical experiment
 * harnesses and diagnostics, so it is optional and backed by a CharacterOS-owned
 * constant — never by "whatever Ollama happens to use". Callers that care about
 * the exact budget (new sessions, revalidations) should pass it explicitly and
 * keep it in step with any request-identity reconstruction they perform.
 *
 * OLLAMA_COGNITION_TRANSPORT_INSTRUMENTATION_V0: an optional host-supplied
 * `trace_observer` receives partial ModelTransportTraceEventV0 progress events
 * and exactly one final ModelTransportTraceV0 per invocation. Strictly
 * diagnostic: observer invocations are failure-isolated and can never alter
 * endpoint, request, timeout, abort, retry, response-validation or error
 * semantics. The timeout timer still guards ONLY the fetch await (the body
 * read remains unprotected — preserved known gap, instrumented, not repaired).
 *
 * Precedents: OllamaBeliefSemanticProviderV0 and
 * OllamaRelationshipSemanticChannelProviderV0 (same native envelope discipline).
 */

import { sha256HashV1 } from "@characteros-next/subject-core";

import {
  ModelTransportErrorV0,
  type ModelTransportRequestV0,
  type ModelTransportResponseV0,
  type ModelTransportV0
} from "../../transports/model-transport.js";
import {
  MODEL_TRANSPORT_TRACE_EVENT_SCHEMA_VERSION_V0,
  MODEL_TRANSPORT_TRACE_SCHEMA_VERSION_V0,
  type ModelTransportTerminalStageV0,
  type ModelTransportTraceEventV0,
  type ModelTransportTraceObserverV0,
  type ModelTransportTraceOutcomeV0,
  type ModelTransportTraceStageV0,
  type ModelTransportTraceV0,
  type OllamaInferenceMetadataV0
} from "../../transports/model-transport-trace-v0.js";

/** Default native-call timeout (ms); host-overridable via explicit config. */
export const OLLAMA_NATIVE_COGNITION_TRANSPORT_TIMEOUT_MS = 120_000;

/**
 * Default output-token budget mapped to Ollama `options.num_predict`. Cognition
 * proposals are structurally larger than small Belief semantic outputs; this
 * matches the budget the previous real cognition experiment used. Hosts may
 * override via explicit config — never via ambient environment.
 */
export const OLLAMA_NATIVE_COGNITION_TRANSPORT_NUM_PREDICT = 2048;

/**
 * Default total sequence budget mapped to Ollama `options.num_ctx` (prompt +
 * generation). CharacterOS-owned, deliberately explicit.
 *
 * Why 8192: the long-horizon session failed at interaction 7 because `num_ctx`
 * was never sent, so Ollama silently served every call from its own default of
 * 4096 while the model trains for 262144. That run's cognition prompt reached
 * 3568 tokens and then had only 528 tokens of generation room left — not enough
 * to finish the proposal. 8192 is the smallest value that clears the
 * demonstrated horizon with substantial reserve: prompt growth was linear at
 * ~420 tokens/interaction, so a full 8-interaction run needs roughly 4000 prompt
 * + ~900 output ≈ 4900 tokens (about 1.7x headroom). It is NOT 262144 because
 * the KV cache is f16 at ~32 KiB/token on this runtime: 4096 cells already cost
 * 128 MiB, so 8192 adds 128 MiB (projected GPU self-use ~5115 MiB against the
 * ~5128 MiB fit budget observed on the 8 GiB laptop GPU), while 16384+ would
 * exceed it and force CPU offload. Raise it explicitly per host when the
 * machine and horizon justify it.
 */
export const OLLAMA_NATIVE_COGNITION_TRANSPORT_CONTEXT_WINDOW_TOKENS = 8192;

/** Explicit host-owned configuration. No ambient defaults, no env magic. */
export interface OllamaNativeCognitionTransportConfigV0 {
  /** Ollama-native base URL, e.g. "http://127.0.0.1:11434". */
  readonly base_url: string;
  readonly model: string;
  /** Request timeout in milliseconds; a per-call abort enforces it. */
  readonly timeout_ms?: number;
  /** Output-token budget → native `options.num_predict`. */
  readonly num_predict?: number;
  /**
   * Total sequence budget (prompt + generation) → native `options.num_ctx`.
   * Deliberately distinct from `num_predict`: the model's trained context is NOT
   * the runtime context. When omitted, the CharacterOS-owned default is sent
   * explicitly so the call never inherits a provider default silently.
   */
  readonly context_window_tokens?: number;
  /**
   * Optional diagnostic-only observer. Receives trace events during execution
   * and exactly one final trace per `complete()` invocation. Observer
   * exceptions are swallowed and never affect transport behavior.
   */
  readonly trace_observer?: ModelTransportTraceObserverV0;
}

/**
 * Native Ollama chat response envelope. Only `message.content` is response
 * authority; the flat inference-timing fields are a diagnostic side-read.
 */
interface OllamaChatResponse {
  readonly message?: { readonly content?: unknown };
  readonly total_duration?: unknown;
  readonly load_duration?: unknown;
  readonly prompt_eval_count?: unknown;
  readonly prompt_eval_duration?: unknown;
  readonly eval_count?: unknown;
  readonly eval_duration?: unknown;
  readonly done_reason?: unknown;
}

/** Observe-or-drop: an observer failure can never propagate into transport. */
function safeObserve(
  observer: ModelTransportTraceObserverV0 | null,
  event: ModelTransportTraceEventV0 | ModelTransportTraceV0
): void {
  if (observer === null) return;
  try {
    observer(event);
  } catch {
    // Diagnostic only — observer failures never affect transport behavior.
  }
}

/**
 * Native Ollama transport for the frozen real cognition provider. Single
 * attempt per invocation; every failure surfaces as a ModelTransportErrorV0
 * which the frozen LlmCognitionProviderV0 wraps as a provider failure —
 * canonical state stays untouched because nothing is reserved before the
 * validated proposal.
 */
export class OllamaNativeCognitionTransportV0 implements ModelTransportV0 {
  private readonly traceObserver: ModelTransportTraceObserverV0 | null;

  constructor(private readonly config: OllamaNativeCognitionTransportConfigV0) {
    if (typeof config.base_url !== "string" || config.base_url.trim().length === 0) {
      throw new ModelTransportErrorV0(
        "MODEL_CONNECTION_FAILURE",
        null,
        "config.base_url: non-empty string required"
      );
    }
    if (typeof config.model !== "string" || config.model.trim().length === 0) {
      throw new ModelTransportErrorV0(
        "MODEL_CONNECTION_FAILURE",
        null,
        "config.model: non-empty string required"
      );
    }
    if (config.timeout_ms !== undefined && (!Number.isFinite(config.timeout_ms) || config.timeout_ms <= 0)) {
      throw new ModelTransportErrorV0(
        "MODEL_CONNECTION_FAILURE",
        null,
        "config.timeout_ms: positive finite number required"
      );
    }
    if (
      config.num_predict !== undefined &&
      (!Number.isInteger(config.num_predict) || config.num_predict <= 0)
    ) {
      throw new ModelTransportErrorV0(
        "MODEL_CONNECTION_FAILURE",
        null,
        "config.num_predict: positive integer required"
      );
    }
    if (
      config.context_window_tokens !== undefined &&
      (!Number.isInteger(config.context_window_tokens) || config.context_window_tokens <= 0)
    ) {
      throw new ModelTransportErrorV0(
        "MODEL_CONNECTION_FAILURE",
        null,
        "config.context_window_tokens: positive integer required"
      );
    }
    // Mechanically meaningful budget relationship, checked on the EFFECTIVE
    // values so an override cannot be paired with a silently smaller default:
    // generation cannot consume the whole sequence budget.
    const effectiveNumPredict = config.num_predict ?? OLLAMA_NATIVE_COGNITION_TRANSPORT_NUM_PREDICT;
    const effectiveContextWindow =
      config.context_window_tokens ?? OLLAMA_NATIVE_COGNITION_TRANSPORT_CONTEXT_WINDOW_TOKENS;
    if (effectiveNumPredict >= effectiveContextWindow) {
      throw new ModelTransportErrorV0(
        "MODEL_CONNECTION_FAILURE",
        null,
        "config.num_predict: must be smaller than config.context_window_tokens"
      );
    }
    this.traceObserver = config.trace_observer ?? null;
  }

  async complete(request: ModelTransportRequestV0): Promise<ModelTransportResponseV0> {
    const timeoutMs = this.config.timeout_ms ?? OLLAMA_NATIVE_COGNITION_TRANSPORT_TIMEOUT_MS;
    const numPredict = this.config.num_predict ?? OLLAMA_NATIVE_COGNITION_TRANSPORT_NUM_PREDICT;
    const numCtx =
      this.config.context_window_tokens ?? OLLAMA_NATIVE_COGNITION_TRANSPORT_CONTEXT_WINDOW_TOKENS;
    const base = this.config.base_url.replace(/\/$/, "");
    const endpoint = `${base}/api/chat`;
    const observer = this.traceObserver;
    const traceId = globalThis.crypto.randomUUID();

    // Serialize the request body exactly once (same value the original inline
    // JSON.stringify produced — identical key order and shape) so the trace can
    // carry size/hash without touching the wire path.
    const requestBody = JSON.stringify({
      model: this.config.model,
      messages: request.messages.map((message) => ({
        role: message.role,
        content: message.content
      })),
      think: false,
      stream: false,
      options: {
        temperature: 0,
        num_predict: numPredict,
        num_ctx: numCtx
      }
    });
    const requestBytes = new TextEncoder().encode(requestBody).length;

    const requestStartedAt = new Date().toISOString();
    const startMono = performance.now();
    const timeoutDeadlineAt = new Date(Date.now() + timeoutMs).toISOString();

    // Mutable observation state, folded into the terminal trace.
    let abortTriggered = false;
    let abortTriggeredElapsedMs: number | null = null;
    let fetchResponseElapsedMs: number | null = null;
    let bodyReadElapsedMs: number | null = null;
    let responseStatus: number | null = null;
    let responseHeadersReceived = false;
    let terminalStage: ModelTransportTerminalStageV0 = "BEFORE_FETCH_RESPONSE";
    let outcome: ModelTransportTraceOutcomeV0 = "FAILURE";
    let failureCode: string | null = null;
    let rawErrorName: string | null = null;
    let rawErrorMessage: string | null = null;
    let rawErrorCauseCode: string | null = null;
    let ollama: OllamaInferenceMetadataV0 = {
      total_duration: null,
      load_duration: null,
      prompt_eval_count: null,
      prompt_eval_duration: null,
      eval_count: null,
      eval_duration: null,
      done_reason: null
    };

    const observeStage = (stage: ModelTransportTraceStageV0): void => {
      safeObserve(observer, {
        schema_version: MODEL_TRANSPORT_TRACE_EVENT_SCHEMA_VERSION_V0,
        trace_id: traceId,
        stage,
        elapsed_ms: Math.round(performance.now() - startMono),
        timestamp: new Date().toISOString()
      });
    };
    const emitTerminalTrace = (): void => {
      safeObserve(observer, {
        schema_version: MODEL_TRANSPORT_TRACE_SCHEMA_VERSION_V0,
        trace_id: traceId,
        transport: "ollama-native-cognition-transport-v0",
        model: this.config.model,
        endpoint,
        request_hash: requestHash,
        request_bytes: requestBytes,
        request_started_at: requestStartedAt,
        request_finished_at: new Date().toISOString(),
        elapsed_ms: Math.round(performance.now() - startMono),
        timeout_ms: timeoutMs,
        timeout_deadline_at: timeoutDeadlineAt,
        abort_triggered: abortTriggered,
        abort_triggered_elapsed_ms: abortTriggeredElapsedMs,
        fetch_response_elapsed_ms: fetchResponseElapsedMs,
        body_read_elapsed_ms: bodyReadElapsedMs,
        terminal_stage: terminalStage,
        response_status: responseStatus,
        response_headers_received: responseHeadersReceived,
        outcome,
        failure_code: failureCode,
        raw_error_name: rawErrorName,
        raw_error_message: rawErrorMessage,
        raw_error_cause_code: rawErrorCauseCode,
        ollama: { ...ollama },
        budget: { context_window_tokens: numCtx, max_output_tokens: numPredict }
      });
    };

    observeStage("STARTED");

    const abort = new AbortController();
    const timer = setTimeout(() => {
      // Abort first, observe second — instrumentation can never delay or drop
      // the abort itself (safeObserve is failure-isolated anyway).
      abortTriggered = true;
      abortTriggeredElapsedMs = Math.round(performance.now() - startMono);
      abort.abort();
      observeStage("ABORT_TRIGGERED");
    }, timeoutMs);

    // The hash awaits AFTER the timer is armed, so the timeout timer keeps its
    // exact original placement (armed before any await, guarding the fetch).
    const requestHash = await sha256HashV1(requestBody);

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: requestBody,
        signal: abort.signal
      });
      if (!abortTriggered) {
        fetchResponseElapsedMs = Math.round(performance.now() - startMono);
        responseStatus = response.status;
        responseHeadersReceived = true;
        observeStage("RESPONSE_HEADERS_RECEIVED");
      }
    } catch (error) {
      rawErrorName = error instanceof Error ? error.name : null;
      rawErrorMessage = (error instanceof Error ? error.message : String(error)).slice(0, 2048);
      const cause: unknown = (error as { cause?: unknown }).cause;
      rawErrorCauseCode =
        typeof cause === "object" && cause !== null && typeof (cause as { code?: unknown }).code === "string"
          ? (cause as { code: string }).code
          : null;
      if (abort.signal.aborted) {
        failureCode = "MODEL_TIMEOUT";
        emitTerminalTrace();
        throw new ModelTransportErrorV0(
          "MODEL_TIMEOUT",
          null,
          `ollama native cognition transport timed out after ${timeoutMs}ms`
        );
      }
      failureCode = "MODEL_CONNECTION_FAILURE";
      emitTerminalTrace();
      throw new ModelTransportErrorV0(
        "MODEL_CONNECTION_FAILURE",
        null,
        `ollama native cognition transport failed: ${error instanceof Error ? error.message : "unknown failure"}`
      );
    } finally {
      // Preserved known gap: the timer guards ONLY the fetch await; the body
      // read below is not timeout-protected. Instrumented, never repaired here.
      clearTimeout(timer);
    }
    if (!response.ok) {
      terminalStage = "RESPONSE_HEADERS_RECEIVED";
      failureCode = "MODEL_HTTP_FAILURE";
      emitTerminalTrace();
      throw new ModelTransportErrorV0(
        "MODEL_HTTP_FAILURE",
        response.status,
        `ollama native endpoint returned HTTP ${response.status}`
      );
    }

    observeStage("BODY_READ_STARTED");
    const bodyReadStartMono = performance.now();
    let body: unknown;
    try {
      body = await response.json();
    } catch (error) {
      bodyReadElapsedMs = Math.round(performance.now() - bodyReadStartMono);
      terminalStage = "BODY_READ";
      failureCode = "MODEL_HTTP_FAILURE";
      rawErrorName = error instanceof Error ? error.name : null;
      rawErrorMessage = (error instanceof Error ? error.message : String(error)).slice(0, 2048);
      emitTerminalTrace();
      throw new ModelTransportErrorV0(
        "MODEL_HTTP_FAILURE",
        response.status,
        `ollama native endpoint returned a non-JSON body: ${error instanceof Error ? error.message : "unknown failure"}`
      );
    }
    bodyReadElapsedMs = Math.round(performance.now() - bodyReadStartMono);
    observeStage("BODY_READ_COMPLETED");

    if (body === null || typeof body !== "object") {
      terminalStage = "MODEL_RESPONSE_RECEIVED";
      failureCode = "MODEL_EMPTY_RESPONSE";
      emitTerminalTrace();
      throw new ModelTransportErrorV0(
        "MODEL_EMPTY_RESPONSE",
        response.status,
        "ollama native response envelope is not an object"
      );
    }
    observeStage("MODEL_RESPONSE_RECEIVED");

    // Diagnostic side-read of Ollama inference timing metadata. Type-narrowed
    // per field; absent or ill-typed fields become null. Never response
    // authority, never cognition content.
    const envelope = body as OllamaChatResponse;
    ollama = {
      total_duration: typeof envelope.total_duration === "number" ? envelope.total_duration : null,
      load_duration: typeof envelope.load_duration === "number" ? envelope.load_duration : null,
      prompt_eval_count: typeof envelope.prompt_eval_count === "number" ? envelope.prompt_eval_count : null,
      prompt_eval_duration: typeof envelope.prompt_eval_duration === "number" ? envelope.prompt_eval_duration : null,
      eval_count: typeof envelope.eval_count === "number" ? envelope.eval_count : null,
      eval_duration: typeof envelope.eval_duration === "number" ? envelope.eval_duration : null,
      done_reason: typeof envelope.done_reason === "string" ? envelope.done_reason : null
    };

    // RESPONSE AUTHORITY: message.content ONLY. `thinking` / `reasoning` /
    // `reasoning_content` and any other vendor reasoning fields are ignored
    // entirely and NEVER become cognition content.
    const content = envelope.message?.content;
    if (typeof content !== "string" || content.trim().length === 0) {
      terminalStage = "MODEL_RESPONSE_RECEIVED";
      failureCode = "MODEL_EMPTY_RESPONSE";
      emitTerminalTrace();
      throw new ModelTransportErrorV0(
        "MODEL_EMPTY_RESPONSE",
        response.status,
        "ollama native message.content is missing, empty or whitespace-only (thinking-only responses fail closed)"
      );
    }

    // Provider-reported truncation is a provider failure, not a candidate
    // proposal: `done_reason: "length"` means generation was cut by a token
    // limit (the configured num_predict, or the context ceiling before it), so
    // the content is incomplete by construction. Classifying it here keeps the
    // failure attributable to the provider budget instead of surfacing only as a
    // downstream JSON parse error — and closes the hole where a truncation
    // landing on a closing brace could parse as valid, incomplete cognition.
    // CognitionProposal validation is NOT weakened or bypassed by this.
    if (ollama.done_reason === "length") {
      terminalStage = "MODEL_RESPONSE_RECEIVED";
      failureCode = "MODEL_OUTPUT_TRUNCATED";
      emitTerminalTrace();
      throw new ModelTransportErrorV0(
        "MODEL_OUTPUT_TRUNCATED",
        response.status,
        `ollama native generation was truncated by the provider token budget (done_reason=length, prompt_eval_count=${ollama.prompt_eval_count ?? "unknown"}, eval_count=${ollama.eval_count ?? "unknown"}, num_ctx=${numCtx}, num_predict=${numPredict})`
      );
    }

    terminalStage = "COMPLETED";
    outcome = "SUCCESS";
    emitTerminalTrace();
    return { content, model: this.config.model };
  }
}
