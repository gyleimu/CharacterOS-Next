/* eslint-disable no-restricted-imports -- Isolated research instrument over frozen built production roots (the repository's established research-harness convention); zero production code changes and no production import of this module. */
/**
 * DecisionProbeV1 — probe driver. RESEARCH-ONLY.
 *
 * V0 is NOT modified: `research/experiments/decision-probe-v0/` stays byte-identical. This file
 * is the V1 sibling with V1's version token, V1's override block and V1's own request hashes.
 * The measurement logic is identical by construction — same substitution rule, same fail-closed
 * parsing, same non-mutation, one call with no retry.
 */

import { canonicalJsonString, hashEnvelope } from "../../../packages/subject-core/dist/index.js";
import type { HashV1 } from "../../../packages/subject-core/dist/index.js";
import type {
  ModelTransportRequestV0,
  ModelTransportV0
} from "../../../packages/runtime/dist/transports/model-transport.js";

import {
  DECISION_PROBE_DECISIONS,
  DECISION_PROBE_EXPLANATION_MAX_CODE_POINTS_V0
} from "../decision-probe-v0/contract.ts";
import {
  DECISION_PROBE_V1_JSON_SCHEMA,
  DECISION_PROBE_V1_OVERRIDE_BLOCK_V0_INHERITED,
  DECISION_PROBE_V1_SCHEMA_VERSION
} from "./contract.ts";

export type DecisionProbeV1Decision = (typeof DECISION_PROBE_DECISIONS)[number];
export type DecisionProbeV1Mode = "PURE_SUBSTITUTION" | "SUBSTITUTION_WITH_OVERRIDE";
export type DecisionProbeV1Validation =
  | { readonly ok: true; readonly decision: DecisionProbeV1Decision }
  | { readonly ok: false; readonly code: string; readonly detail: string };

const ADMITTED = Object.freeze(["decision_probe_schema_version", "decision", "explanation"]);

/** Fail closed. No repair, no coercion. The explanation is validated then discarded. */
export function validateDecisionProbeV1Output(content: string): DecisionProbeV1Validation {
  if (typeof content !== "string" || content.trim().length === 0) {
    return { ok: false, code: "EMPTY_CONTENT", detail: "empty content" };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return { ok: false, code: "NOT_JSON", detail: "not parseable JSON" };
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, code: "NOT_OBJECT", detail: "not a JSON object" };
  }
  const record = parsed as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!ADMITTED.includes(key)) return { ok: false, code: "UNKNOWN_KEY", detail: `unknown member ${key}` };
  }
  if (!("decision_probe_schema_version" in record) || !("decision" in record)) {
    return { ok: false, code: "MISSING_REQUIRED", detail: "missing required member" };
  }
  if (record["decision_probe_schema_version"] !== DECISION_PROBE_V1_SCHEMA_VERSION) {
    return { ok: false, code: "SCHEMA_VERSION_MISMATCH", detail: "wrong schema version" };
  }
  const decision = record["decision"];
  if (typeof decision !== "string" || !(DECISION_PROBE_DECISIONS as readonly string[]).includes(decision)) {
    return { ok: false, code: "DECISION_NOT_IN_CLOSED_SET", detail: `got ${JSON.stringify(decision)}` };
  }
  const explanation = record["explanation"];
  if (explanation !== undefined) {
    if (
      typeof explanation !== "string" ||
      explanation.trim().length === 0 ||
      [...explanation].length > DECISION_PROBE_EXPLANATION_MAX_CODE_POINTS_V0
    ) {
      return { ok: false, code: "EXPLANATION_INVALID", detail: "explanation invalid" };
    }
  }
  return { ok: true, decision: decision as DecisionProbeV1Decision };
}

export interface DecisionProbeV1RequestV0 {
  readonly request: ModelTransportRequestV0;
  readonly messages_preserved: boolean;
  readonly production_prefix_preserved: boolean;
  readonly only_system_message_indented: boolean;
  readonly schema_substituted: boolean;
  readonly chain_of_custody_ok: boolean;
  readonly production_request_hash: HashV1;
  readonly probe_request_hash: HashV1;
  readonly override_block_hash: HashV1;
  readonly applied_override_block: string;
}

/** Pure: returns new objects; the production request is never mutated. */
export async function buildDecisionProbeV1Request(input: {
  readonly production_request: ModelTransportRequestV0;
  readonly mode: DecisionProbeV1Mode;
  readonly override_block: string;
}): Promise<DecisionProbeV1RequestV0> {
  const productionMessages = input.production_request.messages;
  const probeMessages = productionMessages.map((message) =>
    input.mode === "SUBSTITUTION_WITH_OVERRIDE" && message.role === "system"
      ? Object.freeze({ role: message.role, content: `${message.content}${input.override_block}` })
      : Object.freeze({ role: message.role, content: message.content })
  );
  const request = Object.freeze({
    messages: Object.freeze(probeMessages),
    structured_output: Object.freeze({ kind: "JSON_SCHEMA" as const, schema: DECISION_PROBE_V1_JSON_SCHEMA })
  }) as unknown as ModelTransportRequestV0;

  const messagesPreserved = canonicalJsonString(probeMessages) === canonicalJsonString(productionMessages);
  const prefixPreserved = probeMessages.every((message, index) => {
    const original = productionMessages[index];
    return original !== undefined && message.content.startsWith(original.content);
  });
  const onlySystemIndented = probeMessages.every((message, index) => {
    const original = productionMessages[index];
    if (original === undefined) return false;
    if (message.content === original.content) return true;
    return message.role === "system" && input.mode === "SUBSTITUTION_WITH_OVERRIDE";
  });
  const productionSchema = input.production_request.structured_output?.schema ?? {};
  const schemaSubstituted =
    canonicalJsonString(DECISION_PROBE_V1_JSON_SCHEMA) !== canonicalJsonString(productionSchema);

  const requestHashOf = async (value: unknown): Promise<HashV1> =>
    await hashEnvelope("characteros-next/research/decision-probe/request/v0", value);
  const blockHash = await hashEnvelope(
    "characteros-next/research/decision-probe-v1/c3-paraphrase-manifest/v0",
    { applied_override_block: input.override_block }
  );

  return Object.freeze({
    request,
    messages_preserved: messagesPreserved,
    production_prefix_preserved: prefixPreserved,
    only_system_message_indented: onlySystemIndented,
    schema_substituted: schemaSubstituted,
    chain_of_custody_ok:
      prefixPreserved &&
      onlySystemIndented &&
      schemaSubstituted &&
      messagesPreserved === (input.mode === "PURE_SUBSTITUTION"),
    production_request_hash: await requestHashOf(input.production_request),
    probe_request_hash: await requestHashOf(request),
    override_block_hash: blockHash,
    applied_override_block: input.override_block
  });
}

export interface DecisionProbeV1TrialV0 {
  readonly phase: "PRIMARY" | "CONTROL" | "C3";
  readonly fixture_id: string;
  readonly mode: DecisionProbeV1Mode;
  readonly replicate_ordinal: number;
  readonly outcome: "DECIDED" | "REJECTED" | "TRANSPORT_FAILED";
  readonly decision: DecisionProbeV1Decision | null;
  readonly rejection_code: string | null;
  readonly transport_failure: string | null;
  readonly raw_content: string | null;
  readonly elapsed_ms: number;
  readonly production_request_hash: string;
  readonly probe_request_hash: string;
  readonly override_block_hash: string;
  readonly record_hash: HashV1;
}

export async function runDecisionProbeV1Trial(input: {
  readonly transport: ModelTransportV0;
  readonly production_request: ModelTransportRequestV0;
  readonly mode: DecisionProbeV1Mode;
  readonly override_block: string;
  readonly phase: "PRIMARY" | "CONTROL" | "C3";
  readonly fixture_id: string;
  readonly replicate_ordinal: number;
}): Promise<DecisionProbeV1TrialV0> {
  const built = await buildDecisionProbeV1Request({
    production_request: input.production_request,
    mode: input.mode,
    override_block: input.override_block
  });
  if (!built.chain_of_custody_ok) {
    throw new Error(`DECISION_PROBE_V1_FIDELITY_VIOLATION: ${JSON.stringify(built)}`);
  }
  const startedAt = Date.now();
  let content: string | null = null;
  let failure: string | null = null;
  try {
    const response = await input.transport.complete(built.request);
    content = response.content;
  } catch (error) {
    failure = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  }
  const elapsedMs = Date.now() - startedAt;

  let outcome: DecisionProbeV1TrialV0["outcome"] = "TRANSPORT_FAILED";
  let decision: DecisionProbeV1Decision | null = null;
  let rejectionCode: string | null = null;
  if (failure === null) {
    const validation = validateDecisionProbeV1Output(content ?? "");
    if (validation.ok) {
      outcome = "DECIDED";
      decision = validation.decision;
    } else {
      outcome = "REJECTED";
      rejectionCode = validation.code;
    }
  }

  const body = Object.freeze({
    phase: input.phase,
    fixture_id: input.fixture_id,
    mode: input.mode,
    replicate_ordinal: input.replicate_ordinal,
    outcome,
    decision,
    override_block_hash: built.override_block_hash,
    probe_request_hash: built.probe_request_hash
  });

  return Object.freeze({
    ...body,
    rejection_code: rejectionCode,
    transport_failure: failure,
    raw_content: content,
    elapsed_ms: elapsedMs,
    production_request_hash: built.production_request_hash,
    record_hash: await hashEnvelope("characteros-next/research/decision-probe-v1/trial/v0", body)
  });
}

export { DECISION_PROBE_V1_OVERRIDE_BLOCK_V0_INHERITED, DECISION_PROBE_V1_SCHEMA_VERSION };
