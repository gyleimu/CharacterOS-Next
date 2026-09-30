/* eslint-disable no-restricted-imports -- Isolated research harness COMPOSING frozen production seams (repository convention); no production semantics are copied. */
/**
 * D2 A1 — THE FROZEN SEMANTIC-READOUT TRANSFORMER.
 *
 * Implements `D2A1_TRANSFORMER_CONTRACT` (contract-rev1-1c-a1-prerequisites.ts) exactly. The
 * specification was frozen before this file existed; this is its engineering realisation, not a new
 * design. Nothing about the scientific construct is decided here: the token vocabulary, the anchors,
 * the paraphrase literal, the schema, the lexical laws, the fixtures and the invalid rule are all
 * read from the frozen module and none of them is restated or relaxed.
 *
 * The transformer also fails closed on a request that already carries ANY measurement contract — its
 * own, A0's, B's or DecisionProbeV2's — so "transformer on transformer" cannot happen by accident.
 */

import { canonicalJsonString } from "../../../packages/subject-core/dist/index.js";
import type { ModelTransportRequestV0 } from "../../../packages/runtime/dist/transports/model-transport.js";

import { D2A1_CONTRACT_TEXT, D2A1_JSON_SCHEMA } from "./contract-rev1-1c-a1-prerequisites.ts";

/** The A1 contract's own header: used to detect a request that was already A1-transformed. */
export const A1_MARKER = "DECISION PROBE SEMANTIC READOUT CONTRACT" as const;
/** A0's contract header — an A1 request must never carry it. */
export const A0_MARKER = "DECISION PROBE STRUCTURAL READOUT CONTRACT" as const;
/** B's contract header (not yet implemented; the string is reserved so it cannot collide later). */
export const B_MARKER = "DECISION PROBE APPRAISAL READOUT CONTRACT" as const;
/** DecisionProbeV2's contract header. Its presence in an A1 request is forbidden. */
export const DP_V2_MARKER = "DECISION PROBE OUTPUT CONTRACT" as const;

export function failD2A1(verdict: string, detail: string): never {
  throw new Error(`${verdict}: ${detail}`);
}

/**
 * Appends the frozen A1 contract to the system message and replaces the V8 structured-output
 * declaration with the frozen A1 schema. The production content survives as a byte-exact prefix.
 * Fails closed on any request that has already been transformed.
 */
export function buildD2SemanticReadoutRequestV0(
  pristine: ModelTransportRequestV0
): ModelTransportRequestV0 {
  const system = pristine.messages.find((m) => m.role === "system")?.content ?? "";
  if (system.includes(A1_MARKER)) failD2A1("D2_A1_TRANSFORMER_ON_TRANSFORMER_REJECTED", "already A1-transformed");
  if (system.includes(A0_MARKER)) failD2A1("D2_A1_INPUT_ALREADY_CARRIES_A0_CONTRACT", "A0 contract present");
  if (system.includes(B_MARKER)) failD2A1("D2_A1_INPUT_ALREADY_CARRIES_B_CONTRACT", "B contract present");
  if (system.includes(DP_V2_MARKER)) failD2A1("D2_A1_INPUT_ALREADY_CARRIES_DECISION_PROBE_V2", "DecisionProbeV2 contract present");
  if (canonicalJsonString(pristine.structured_output?.schema ?? {}) === canonicalJsonString(D2A1_JSON_SCHEMA)) {
    failD2A1("D2_A1_ALREADY_TRANSFORMED_REJECTED", "schema already the A1 schema");
  }
  const messages = pristine.messages.map((m) =>
    m.role === "system"
      ? Object.freeze({ role: m.role, content: `${m.content}${D2A1_CONTRACT_TEXT}` })
      : Object.freeze({ role: m.role, content: m.content })
  );
  return Object.freeze({
    messages: Object.freeze(messages),
    structured_output: Object.freeze({ kind: "JSON_SCHEMA" as const, schema: D2A1_JSON_SCHEMA })
  }) as unknown as ModelTransportRequestV0;
}
