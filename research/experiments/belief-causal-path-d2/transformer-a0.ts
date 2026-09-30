/* eslint-disable no-restricted-imports -- Isolated research harness COMPOSING frozen production seams (repository convention); no production semantics are copied. */
/**
 * D2 A0 — THE FROZEN STRUCTURAL-READOUT TRANSFORMER.
 *
 * Extracted verbatim from `a0-qualification.ts` after that round passed its conformance gate and
 * spent its nine calls, so that both the qualification and the state experiment apply exactly one
 * implementation. The extraction is behaviour-preserving: re-running the offline conformance gate
 * must reproduce the three qualification request hashes unchanged.
 *
 * Contract source: `D2A0_TRANSFORMER_CONTRACT` (contract-rev1-1b-a0-fixtures.ts), frozen before any
 * model call. This file is the implementation; it may not be edited without a new revision.
 */

import { canonicalJsonString } from "../../../packages/subject-core/dist/index.js";
import type { ModelTransportRequestV0 } from "../../../packages/runtime/dist/transports/model-transport.js";

import { D2A0_CONTRACT_TEXT, D2A0_JSON_SCHEMA } from "./contract-rev1-1b-a0-fixtures.ts";

/** The contract text's own header, used to detect a request that was already transformed. */
export const D2A0_MARKER = "DECISION PROBE STRUCTURAL READOUT CONTRACT" as const;
/** DecisionProbeV2's contract header. Its presence in an A0 request is forbidden. */
export const DP_V2_MARKER = "DECISION PROBE OUTPUT CONTRACT" as const;

export function failD2A0(verdict: string, detail: string): never {
  throw new Error(`${verdict}: ${detail}`);
}

/**
 * Appends the frozen A0 contract to the system message and replaces the V8 structured-output
 * declaration with the frozen A0 schema. The production content survives as a byte-exact prefix.
 * Fails closed on a request that has already been transformed.
 */
export function buildD2StructuralReadoutRequestV0(
  pristine: ModelTransportRequestV0
): ModelTransportRequestV0 {
  const system = pristine.messages.find((m) => m.role === "system")?.content ?? "";
  if (system.includes(D2A0_MARKER)) failD2A0("D2_A0_TRANSFORMER_ON_TRANSFORMER_REJECTED", "already transformed");
  if (canonicalJsonString(pristine.structured_output?.schema ?? {}) === canonicalJsonString(D2A0_JSON_SCHEMA)) {
    failD2A0("D2_A0_ALREADY_TRANSFORMED_REJECTED", "schema already the A0 schema");
  }
  const messages = pristine.messages.map((m) =>
    m.role === "system"
      ? Object.freeze({ role: m.role, content: `${m.content}${D2A0_CONTRACT_TEXT}` })
      : Object.freeze({ role: m.role, content: m.content })
  );
  return Object.freeze({
    messages: Object.freeze(messages),
    structured_output: Object.freeze({ kind: "JSON_SCHEMA" as const, schema: D2A0_JSON_SCHEMA })
  }) as unknown as ModelTransportRequestV0;
}
