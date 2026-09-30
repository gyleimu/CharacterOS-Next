/* eslint-disable no-restricted-imports -- Isolated research harness COMPOSING frozen production seams (repository convention); no production semantics are copied. */
/**
 * D3-B — THE FROZEN SEMANTIC-RELATION TRANSFORMER.
 *
 * Implements `D3B_TRANSFORMER_CONTRACT` (contract.ts, frozen at revision 1 and unchanged at revision
 * 2) exactly, under its frozen name `buildD3RelationReadoutRequestV0`.
 *
 * ONE IMPLEMENTATION DETAIL WORTH STATING. The frozen contract text is a literal whose STATEMENT A and
 * STATEMENT B lines hold the target pair (the canonical CAUTION proposition and the frozen A1
 * paraphrase). Qualification fixtures need the same contract with a different pair, so the text is
 * rendered by substituting exactly those two lines and nothing else. A conformance check asserts that
 * rendering the TARGET pair reproduces `D3B_CONTRACT_TEXT` byte-for-byte, so the template cannot drift
 * from the frozen literal — and each fixture's rendered text is checked to differ from the frozen one
 * only on those two lines.
 *
 * The transformer also fails closed on a request already carrying ANY research measurement contract.
 */

import { canonicalJsonString } from "../../../packages/subject-core/dist/index.js";
import type { ModelTransportRequestV0 } from "../../../packages/runtime/dist/transports/model-transport.js";

import {
  D3B_CONTRACT_TEXT,
  D3B_INPUTS_FROZEN,
  D3B_JSON_SCHEMA
} from "./contract.ts";

export const D3B_MARKER = "DECISION PROBE SEMANTIC RELATION CONTRACT" as const;
export const A0_MARKER = "DECISION PROBE STRUCTURAL READOUT CONTRACT" as const;
export const A1_MARKER = "DECISION PROBE SEMANTIC READOUT CONTRACT" as const;
export const D2B_MARKER = "DECISION PROBE APPRAISAL READOUT CONTRACT" as const;
export const DP_V2_MARKER = "DECISION PROBE OUTPUT CONTRACT" as const;

const STATEMENT_A_MARKER = "STATEMENT A:" as const;
const STATEMENT_B_MARKER = "STATEMENT B:" as const;

export function failD3B(verdict: string, detail: string): never {
  throw new Error(`${verdict}: ${detail}`);
}

export interface D3BStatementPairV0 {
  readonly statement_a: string;
  readonly statement_b: string;
}

/** The target pair, as frozen. */
export const D3B_TARGET_PAIR: D3BStatementPairV0 = Object.freeze({
  statement_a: D3B_INPUTS_FROZEN.statement_a,
  statement_b: D3B_INPUTS_FROZEN.statement_b
});

/**
 * Renders the frozen contract text with a statement pair. Substitutes EXACTLY the two statement lines;
 * every other line must be byte-identical to the frozen literal.
 */
export function renderD3BContractTextV0(pair: D3BStatementPairV0): string {
  const lines = D3B_CONTRACT_TEXT.split("\n");
  const indexOfA = lines.indexOf(STATEMENT_A_MARKER);
  const indexOfB = lines.indexOf(STATEMENT_B_MARKER);
  if (indexOfA < 0 || indexOfB < 0) failD3B("D3_B_CONTRACT_TEMPLATE_BROKEN", "a statement marker is missing");
  if (indexOfA + 1 >= lines.length || indexOfB + 1 >= lines.length) {
    failD3B("D3_B_CONTRACT_TEMPLATE_BROKEN", "a statement marker has no following line");
  }
  const rendered = [...lines];
  rendered[indexOfA + 1] = `  ${pair.statement_a}`;
  rendered[indexOfB + 1] = `  ${pair.statement_b}`;
  return rendered.join("\n");
}

/** Which lines of a rendered text differ from the frozen literal. Used to prove the substitution scope. */
export function renderedDifferencesFromTheFrozenTextV0(rendered: string): readonly number[] {
  const frozenLines = D3B_CONTRACT_TEXT.split("\n");
  const renderedLines = rendered.split("\n");
  if (frozenLines.length !== renderedLines.length) {
    failD3B("D3_B_RENDER_CHANGED_THE_LINE_COUNT", `${frozenLines.length} vs ${renderedLines.length}`);
  }
  const differing: number[] = [];
  for (let index = 0; index < frozenLines.length; index += 1) {
    if (frozenLines[index] !== renderedLines[index]) differing.push(index);
  }
  return differing;
}

/**
 * Appends the rendered contract to the system message and replaces the V8 structured-output
 * declaration with the frozen D3-B schema. Fails closed on an already-transformed request and on a
 * request carrying any other research measurement contract.
 */
export function buildD3RelationReadoutRequestV0(
  pristine: ModelTransportRequestV0,
  pair: D3BStatementPairV0 = D3B_TARGET_PAIR
): ModelTransportRequestV0 {
  const system = pristine.messages.find((m) => m.role === "system")?.content ?? "";
  if (system.includes(D3B_MARKER)) failD3B("D3_B_TRANSFORMER_ON_TRANSFORMER_REJECTED", "already D3-B-transformed");
  if (system.includes(A0_MARKER)) failD3B("D3_B_INPUT_ALREADY_CARRIES_A0_CONTRACT", "the A0 contract is present");
  if (system.includes(A1_MARKER)) failD3B("D3_B_INPUT_ALREADY_CARRIES_A1_CONTRACT", "the A1 contract is present");
  if (system.includes(D2B_MARKER)) failD3B("D3_B_INPUT_ALREADY_CARRIES_D2B_CONTRACT", "a B contract is present");
  if (system.includes(DP_V2_MARKER)) failD3B("D3_B_INPUT_ALREADY_CARRIES_DECISION_PROBE_V2", "a DecisionProbeV2 contract is present");
  if (canonicalJsonString(pristine.structured_output?.schema ?? {}) === canonicalJsonString(D3B_JSON_SCHEMA)) {
    failD3B("D3_B_ALREADY_TRANSFORMED_REJECTED", "the schema is already the D3-B schema");
  }
  const contractText = renderD3BContractTextV0(pair);
  const messages = pristine.messages.map((m) =>
    m.role === "system"
      ? Object.freeze({ role: m.role, content: `${m.content}${contractText}` })
      : Object.freeze({ role: m.role, content: m.content })
  );
  return Object.freeze({
    messages: Object.freeze(messages),
    structured_output: Object.freeze({ kind: "JSON_SCHEMA" as const, schema: D3B_JSON_SCHEMA })
  }) as unknown as ModelTransportRequestV0;
}
