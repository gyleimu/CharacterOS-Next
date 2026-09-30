/* eslint-disable no-restricted-imports -- Isolated research harness COMPOSING frozen production seams (repository convention); no production semantics are copied. */
/**
 * D4-C0a — THE FROZEN STANCE-TRANSFER TRANSFORMER.
 *
 * Implements `D4C0A_TRANSFORMER_CONTRACT` (contract-rev2-transformer.ts) exactly, under its frozen name
 * `buildD4C0AStanceTransferRequestV0`. It is a RENDERING of the frozen specification: it rewrites no
 * wording, adds no explanation, states no mapping, and copies nothing from the A1, D2 or D3 contracts.
 *
 * The base request it accepts is the state-blind minimal research frame: one system message carrying the
 * frozen base text, one user message carrying a rendered binding block.
 */

import { canonicalJsonString } from "../../../packages/subject-core/dist/index.js";
import type { ModelTransportRequestV0 } from "../../../packages/runtime/dist/transports/model-transport.js";

import {
  D4C0A_BASE_SYSTEM_TEXT,
  D4C0A_CONTRACT_TEXT,
  D4C0A_JSON_SCHEMA,
  renderD4C0ABindingBlockV0,
  type D4C0ABindingV0
} from "./contract.ts";

/** Headers of every research measurement contract this line must refuse to stack on. */
const FOREIGN_CONTRACT_MARKERS: readonly string[] = Object.freeze([
  "DECISION PROBE OUTPUT CONTRACT",
  "DECISION PROBE STRUCTURAL READOUT CONTRACT",
  "DECISION PROBE SEMANTIC READOUT CONTRACT",
  "DECISION PROBE SEMANTIC RELATION CONTRACT",
  "DECISION PROBE APPRAISAL READOUT CONTRACT"
]);

export const D4C0A_CONTRACT_MARKER = "D4-C0A STANCE TRANSFER CONTRACT" as const;

/**
 * The contract's OPENING header line, which appears exactly once in a correctly rendered request. The
 * bare marker is NOT usable for that check: the frozen contract text contains it twice (its opening and
 * its END lines), so counting the marker could never yield one — a check that can never pass.
 */
export const D4C0A_CONTRACT_OPENING_LINE =
  "--- D4-C0A STANCE TRANSFER CONTRACT (research instrument; binding for THIS invocation) ---" as const;

/**
 * THE ONE IMPLEMENTATION DECISION, STATED SO IT IS NOT DISCOVERED LATER.
 * The frozen transformer contract says the schema is "replaced ... exactly once", which requires the base
 * to carry something ELSE — and the frozen contract text opens with "The output-format rules above are
 * SUPERSEDED for this invocation", which presupposes an output-format declaration above it. So the base
 * carries this minimal placeholder and the transformer substitutes the frozen schema, exactly as the
 * contract describes. The placeholder carries no semantics: it is replaced before any call, and the
 * conformance gate checks that the final request's schema equals the frozen schema exactly.
 */
export const D4C0A_BASE_PLACEHOLDER_SCHEMA: Readonly<Record<string, unknown>> = Object.freeze({ type: "object" });

export function failD4C0A(verdict: string, detail: string): never {
  throw new Error(`${verdict}: ${detail}`);
}

/** Builds the state-blind base request for one binding. Frozen by the contract's input clause. */
export function buildD4C0ABaseRequestV0(binding: D4C0ABindingV0): ModelTransportRequestV0 {
  return Object.freeze({
    messages: Object.freeze([
      Object.freeze({ role: "system" as const, content: D4C0A_BASE_SYSTEM_TEXT }),
      Object.freeze({ role: "user" as const, content: renderD4C0ABindingBlockV0(binding) })
    ]),
    structured_output: Object.freeze({ kind: "JSON_SCHEMA" as const, schema: D4C0A_BASE_PLACEHOLDER_SCHEMA })
  }) as unknown as ModelTransportRequestV0;
}

/** The four binding lines that must each appear exactly once in a user message. */
export const D4C0A_BINDING_LINE_PREFIXES: readonly string[] = Object.freeze([
  "PROPOSITION A: ",
  "PROPOSITION B: ",
  "RELATION(A,B): ",
  "SUBJECT STANCE TOWARD A: "
]);

const countOf = (haystack: string, needle: string): number => haystack.split(needle).length - 1;

/**
 * Appends the frozen contract to the SYSTEM message and sets the frozen schema. Fails closed on every
 * condition the frozen contract names.
 */
export function buildD4C0AStanceTransferRequestV0(base: ModelTransportRequestV0): ModelTransportRequestV0 {
  const messages = base.messages;
  if (messages.length !== 2) failD4C0A("D4_C0A_BASE_SHAPE_INVALID", `${messages.length} messages, expected exactly 2`);
  const system = messages[0];
  const user = messages[1];
  if (system === undefined || system.role !== "system") failD4C0A("D4_C0A_BASE_SHAPE_INVALID", "the first message is not a system message");
  if (user === undefined || user.role !== "user") failD4C0A("D4_C0A_BASE_SHAPE_INVALID", "the second message is not a user message");
  if (system.content !== D4C0A_BASE_SYSTEM_TEXT) failD4C0A("D4_C0A_BASE_SYSTEM_TEXT_NOT_FROZEN", "the system content is not the frozen base text");
  if (system.content.includes(D4C0A_CONTRACT_MARKER)) failD4C0A("D4_C0A_TRANSFORMER_ON_TRANSFORMER_REJECTED", "already transformed");
  for (const marker of FOREIGN_CONTRACT_MARKERS) {
    if (system.content.includes(marker)) failD4C0A("D4_C0A_FOREIGN_CONTRACT_PRESENT", marker);
  }
  if (canonicalJsonString(base.structured_output?.schema ?? {}) === canonicalJsonString(D4C0A_JSON_SCHEMA)) {
    failD4C0A("D4_C0A_ALREADY_TRANSFORMED_REJECTED", "the schema is already the D4-C0a schema");
  }
  for (const prefix of D4C0A_BINDING_LINE_PREFIXES) {
    if (countOf(user.content, prefix) !== 1) {
      failD4C0A("D4_C0A_BINDING_BLOCK_INVALID", `${prefix.trim()} appears ${String(countOf(user.content, prefix))} times`);
    }
  }
  return Object.freeze({
    messages: Object.freeze([
      Object.freeze({ role: "system" as const, content: `${D4C0A_BASE_SYSTEM_TEXT}${D4C0A_CONTRACT_TEXT}` }),
      Object.freeze({ role: "user" as const, content: user.content })
    ]),
    structured_output: Object.freeze({ kind: "JSON_SCHEMA" as const, schema: D4C0A_JSON_SCHEMA })
  }) as unknown as ModelTransportRequestV0;
}
