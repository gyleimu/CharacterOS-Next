/**
 * ModelTransportTraceV0 — diagnostic-only transport observation contracts
 * (OLLAMA_COGNITION_TRANSPORT_INSTRUMENTATION_V0).
 *
 * Diagnostic metadata ONLY. Never canonical state, never cognition proposal,
 * never behavior evidence, never persistence authority, never experiment protocol.
 *
 * trace_id is host-generated correlation only — never inserted into prompt,
 * HTTP body, model messages, or canonical subject state. No model sees it.
 *
 * Raw error material is bounded/sanitized diagnostic copy only. The actual
 * production exception (ModelTransportErrorV0) is unchanged.
 *
 * Observer failures must never affect transport behavior.
 */

export const MODEL_TRANSPORT_TRACE_SCHEMA_VERSION_V0 =
  "model-transport-trace-v0" as const;

export const MODEL_TRANSPORT_TRACE_EVENT_SCHEMA_VERSION_V0 =
  "model-transport-trace-event-v0" as const;

export type ModelTransportTraceStageV0 =
  | "STARTED"
  | "ABORT_TRIGGERED"
  | "RESPONSE_HEADERS_RECEIVED"
  | "BODY_READ_STARTED"
  | "BODY_READ_COMPLETED"
  | "MODEL_RESPONSE_RECEIVED"
  | "TERMINAL";

export type ModelTransportTraceOutcomeV0 = "SUCCESS" | "FAILURE";

export type ModelTransportTerminalStageV0 =
  | "BEFORE_FETCH_RESPONSE"
  | "RESPONSE_HEADERS_RECEIVED"
  | "BODY_READ"
  | "MODEL_RESPONSE_RECEIVED"
  | "COMPLETED";

/** Partial progress event emitted during transport execution. */
export interface ModelTransportTraceEventV0 {
  readonly schema_version: typeof MODEL_TRANSPORT_TRACE_EVENT_SCHEMA_VERSION_V0;
  readonly trace_id: string;
  readonly stage: ModelTransportTraceStageV0;
  readonly elapsed_ms: number;
  readonly timestamp: string;
}

/** Ollama inference timing metadata (optional, side-read from response body). */
export interface OllamaInferenceMetadataV0 {
  readonly total_duration: number | null;
  readonly load_duration: number | null;
  readonly prompt_eval_count: number | null;
  readonly prompt_eval_duration: number | null;
  readonly eval_count: number | null;
  readonly eval_duration: number | null;
  readonly done_reason: string | null;
}

/** Complete diagnostic trace for one transport invocation. */
export interface ModelTransportTraceV0 {
  readonly schema_version: typeof MODEL_TRANSPORT_TRACE_SCHEMA_VERSION_V0;
  readonly trace_id: string;
  readonly transport: "ollama-native-cognition-transport-v0";
  readonly model: string;
  readonly endpoint: string;
  readonly request_hash: string;
  readonly request_bytes: number;
  readonly request_started_at: string;
  readonly request_finished_at: string | null;
  readonly elapsed_ms: number | null;
  readonly timeout_ms: number;
  readonly timeout_deadline_at: string;
  readonly abort_triggered: boolean;
  readonly abort_triggered_elapsed_ms: number | null;
  readonly fetch_response_elapsed_ms: number | null;
  readonly body_read_elapsed_ms: number | null;
  readonly terminal_stage: ModelTransportTerminalStageV0;
  readonly response_status: number | null;
  readonly response_headers_received: boolean;
  readonly outcome: ModelTransportTraceOutcomeV0;
  readonly failure_code: string | null;
  readonly raw_error_name: string | null;
  readonly raw_error_message: string | null;
  readonly raw_error_cause_code: string | null;
  readonly ollama: OllamaInferenceMetadataV0;
}

/** Observer receives partial events during execution and the final trace. */
export type ModelTransportTraceObserverV0 =
  (event: ModelTransportTraceEventV0 | ModelTransportTraceV0) => void;
