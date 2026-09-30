/**
 * PROVIDER READINESS GATE — frozen contract.
 *
 * Frozen BEFORE the first readiness provider attempt. Nothing here may be revised after that point.
 *
 * The question this gate answers is NOT "is Ollama fast?" It is:
 *
 *   Has this machine returned to a state in which the FROZEN scientific protocol can be executed
 *   faithfully — same provider, same model, same digest, same transport configuration, same timeout,
 *   no fallback?
 *
 * The gate observes the environment. It never alters it, and it never changes the protocol to fit
 * the environment.
 */

import { createHash } from "node:crypto";

export const READINESS_PROBES_PLANNED = 3 as const;

// ---------------------------------------------------------------------------------------------
// §4 EXECUTOR IDENTITY — must equal the future Phase-0 execution exactly
// ---------------------------------------------------------------------------------------------

export const READINESS_OLLAMA_BASE_URL = process.env["OLLAMA_BASE_URL"] ?? "http://127.0.0.1:11434";
export const READINESS_MODEL = process.env["CHARACTEROS_MODEL"] ?? "qwen3.5:9b";
/** Recorded at freeze time and asserted again at run time; an identity change STOPs the gate. */
export const READINESS_MODEL_DIGEST_FROZEN = "6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7";

/** EXACTLY the production cognition transport configuration — unchanged from run-1. */
export const READINESS_NUM_PREDICT = 2048 as const;
export const READINESS_CONTEXT_TOKENS = 8192 as const;
export const READINESS_TIMEOUT_MS = 120_000 as const;
export const READINESS_TEMPERATURE = 0 as const;
export const READINESS_STRUCTURED_OUTPUT_CONSTRAINT = null;

// ---------------------------------------------------------------------------------------------
// §5/§6 THE FROZEN PROBE REQUEST — non-scientific, byte-frozen, identical for every replicate
// ---------------------------------------------------------------------------------------------

/**
 * The probe contains NO scientific input: no Phase-0 trajectory event, no target proposition, no
 * A/B valence span, no subject state, no arm identity. It tests transport + model execution
 * capacity only.
 *
 * Its shape is calibrated from run-1's persisted evidence rather than chosen by taste:
 * run-1's production cognition requests carried a system message of 12,771 bytes and a user message
 * of 4,300–5,584 bytes, against a 2048-token output budget and an 8192-token context.
 *
 * The output demand is deliberately large and deterministic: at the frozen 120 s timeout, a request
 * that forces a long generation is a meaningful capacity test, whereas a request that returns 20
 * tokens would pass on a machine that cannot serve production calls at all.
 */
const FILLER_SENTENCE =
  "Operational readiness probe for a text generation service. This request measures transport and model execution capacity only. ";

/** Deterministic padding: a frozen repetition count, never a runtime-computed length. */
function padToFrozenBytes(sentence: string, repetitions: number, tail: string): string {
  return `${sentence.repeat(repetitions)}${tail}`;
}

export const READINESS_SYSTEM_PROMPT = padToFrozenBytes(
  FILLER_SENTENCE,
  88,
  "[end of readiness system context] Reply to the user message directly and completely."
);

export const READINESS_USER_PROMPT =
  "Output the integers from 1 to 400, one integer per line, and nothing else. " +
  "Do not add commentary, headings, punctuation, or blank lines. " +
  "Begin with 1 on its own line and end with 400 on its own line. " +
  "This is a capacity check, so produce the complete list without abbreviating it. " +
  "[end of readiness user request]";

export const READINESS_SYSTEM_BYTES = READINESS_SYSTEM_PROMPT.length;
export const READINESS_USER_BYTES = READINESS_USER_PROMPT.length;

/** The exact wire request every replicate sends. Byte-identical; no replicate ordinal inside. */
export function buildReadinessRequestV0(): {
  readonly model: string;
  readonly messages: readonly { readonly role: "system" | "user"; readonly content: string }[];
  readonly think: false;
  readonly stream: false;
  readonly options: { readonly temperature: number; readonly num_predict: number; readonly num_ctx: number };
} {
  return {
    model: READINESS_MODEL,
    messages: [
      { role: "system", content: READINESS_SYSTEM_PROMPT },
      { role: "user", content: READINESS_USER_PROMPT }
    ],
    think: false,
    stream: false,
    options: {
      temperature: READINESS_TEMPERATURE,
      num_predict: READINESS_NUM_PREDICT,
      num_ctx: READINESS_CONTEXT_TOKENS
    }
  };
}

export const READINESS_REQUEST = buildReadinessRequestV0();

export function hashReadinessRequestV0(): string {
  return `sha256:${createHash("sha256").update(JSON.stringify(READINESS_REQUEST)).digest("hex")}`;
}

// ---------------------------------------------------------------------------------------------
// §7 THE READINESS CRITERION — functional, derived; NOT a fabricated throughput threshold
// ---------------------------------------------------------------------------------------------

export const READINESS_CAPACITY_REQUIREMENT = Object.freeze({
  question:
    "does the current provider have enough capacity to complete production cognition calls without changing the frozen timeout or any other configuration?",
  // §7 forbids inventing a tokens/second threshold. run-1 persisted its REQUESTS (system 12,771 bytes,
  // user 4,300-5,584 bytes) but NOT its completion lengths or per-call latency, so no credible
  // tokens/second requirement can be derived from evidence. What CAN be derived is functional.
  derivation_status: "FUNCTIONAL_PREDICATE_DERIVED_FROM_FROZEN_LIMITS",
  why_not_a_throughput_threshold:
    "run-1 artifacts persist request bytes but no completion lengths and no per-call latency, so any tokens/second number would be invented rather than derived. §7 forbids fabricating one.",
  derived_from: [
    "the frozen transport timeout: 120,000 ms",
    "the frozen production output budget: num_predict 2048",
    "the frozen production context: num_ctx 8192",
    "run-1's measured prompt sizes: system 12,771 bytes, user 4,300-5,584 bytes",
    "the probe's forced output demand: 400 numbered lines"
  ],
  functional_predicate:
    "ALL planned readiness probes must complete normally, under the existing frozen timeout and the frozen transport configuration, with no transport failure, no model timeout, no mid-run provider reload, and no fallback",
  descriptive_metrics_recorded_but_not_gating: [
    "wall-clock latency per probe",
    "completion tokens per probe",
    "tokens/second per probe",
    "time-to-first-token if reported"
  ],
  stated_limitation:
    "even a PASS establishes only that a production-shaped request with a long forced output fits inside the frozen timeout. It does NOT prove that a worst-case 2048-token production output fits, because run-1 did not persist completion lengths. The limitation is recorded rather than papered over."
});

// ---------------------------------------------------------------------------------------------
// §11/§12 GATE OUTCOMES
// ---------------------------------------------------------------------------------------------

export const READINESS_PASS_TOKENS = Object.freeze([
  "PHASE0_PROVIDER_READINESS_GATE_PASS",
  "PHASE0_FRESH_RERUN_AUTHORISED"
]);

export const READINESS_FAIL_TOKENS = Object.freeze([
  "PHASE0_PROVIDER_READINESS_GATE_FAIL",
  "PHASE0_RERUN_REMAINS_BLOCKED_BY_PROVIDER_ENVIRONMENT"
]);

/** §10: the count is fixed in advance and is never extended while running. */
export const READINESS_EXECUTION_RULE = Object.freeze({
  planned: READINESS_PROBES_PLANNED,
  planned_equals_actual: true,
  run_all_planned_probes_regardless_of_intermediate_outcomes: true,
  forbidden: [
    "stopping early and reporting a different N",
    "running extra probes until three succeed",
    "raising the timeout",
    "lowering num_ctx",
    "swapping the provider or model",
    "changing generation settings",
    "killing the operator's GPU consumers or altering OS/GPU settings"
  ],
  on_any_failure: "the gate is FAIL and the run stops after the planned probes are done"
});
