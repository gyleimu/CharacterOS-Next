/* eslint-disable no-restricted-imports -- Diagnostic-only built public transport seam. */

/**
 * OLLAMA_COGNITION_TRANSPORT_DIAGNOSTIC_V0 — neutral diagnostic fixture.
 *
 * Defines the FOUR-CALL neutral reproduction material: byte-identical,
 * cognition-semantics-free requests plus the observer-side collection that
 * turns one instrumented transport invocation into a complete diagnostic
 * record. This fixture is NOT the cognition prompt, NOT the V0/V1 experiment
 * protocol, and carries zero canonical authority — it exists so stage timing
 * (request start, abort, response receipt, body read), raw error material,
 * Ollama inference metadata and local resource state can be distinguished on
 * identical inputs.
 */

import type {
  ModelTransportRequestV0,
  ModelTransportTraceEventV0,
  ModelTransportTraceObserverV0,
  ModelTransportTraceV0
} from "../../../packages/runtime/dist/index.js";

/** Diagnostic protocol identity (recorded into every run summary). */
export const DIAGNOSTIC_PROTOCOL_V0 = Object.freeze({
  schema_version: "ollama-cognition-transport-diagnostic-v0",
  transport: "ollama-native-cognition-transport-v0",
  call_count: 4,
  neutrality_law:
    "four byte-identical neutral requests; no cognition prompt, no experiment protocol, no canonical authority",
  authority_boundary:
    "diagnostic metadata only — never canonical state, never behavior evidence, never persistence"
});

/** The neutral diagnostic conversation (cognition-semantics-free). */
export const NEUTRAL_MESSAGES: readonly { role: "system" | "user"; content: string }[] =
  Object.freeze([
    { role: "system", content: "Diagnostic probe. Respond with exactly one word: pong." },
    { role: "user", content: "ping" }
  ]);

/** One byte-identical neutral request per call (fresh object, same bytes). */
export function neutralRequest(): ModelTransportRequestV0 {
  return {
    messages: NEUTRAL_MESSAGES.map((message) => ({ role: message.role, content: message.content }))
  };
}

/** Full diagnostic record of one transport invocation. */
export interface DiagnosticCallRecordingV0 {
  readonly call_index: number;
  readonly started_at: string;
  finished_at: string | null;
  events: ModelTransportTraceEventV0[];
  trace: ModelTransportTraceV0 | null;
  error: { readonly name: string; readonly message: string } | null;
}

/**
 * Observer-side collector: partial stage events and the terminal trace are
 * appended to the recording; the recording NEVER feeds back into the transport.
 */
export function collectDiagnosticCallV0(callIndex: number): {
  recording: DiagnosticCallRecordingV0;
  observer: ModelTransportTraceObserverV0;
} {
  const recording: DiagnosticCallRecordingV0 = {
    call_index: callIndex,
    started_at: new Date().toISOString(),
    finished_at: null,
    events: [],
    trace: null,
    error: null
  };
  const observer: ModelTransportTraceObserverV0 = (event) => {
    if ("stage" in event) {
      recording.events.push(event);
    } else {
      recording.trace = event;
    }
  };
  return { recording, observer };
}

/** Flat one-row summary of a call recording (for the console table). */
export function summarizeCallV0(recording: DiagnosticCallRecordingV0): {
  call: number;
  outcome: string;
  terminal_stage: string;
  failure_code: string | null;
  elapsed_ms: number | null;
  fetch_ms: number | null;
  body_ms: number | null;
  abort: boolean;
  ollama_eval_count: number | null;
  ollama_total_duration: number | null;
} {
  const trace = recording.trace;
  return {
    call: recording.call_index,
    outcome: trace?.outcome ?? (recording.error !== null ? "THREW" : "INCOMPLETE"),
    terminal_stage: trace?.terminal_stage ?? "NONE",
    failure_code: trace?.failure_code ?? null,
    elapsed_ms: trace?.elapsed_ms ?? null,
    fetch_ms: trace?.fetch_response_elapsed_ms ?? null,
    body_ms: trace?.body_read_elapsed_ms ?? null,
    abort: trace?.abort_triggered ?? false,
    ollama_eval_count: trace?.ollama.eval_count ?? null,
    ollama_total_duration: trace?.ollama.total_duration ?? null
  };
}
