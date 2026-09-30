/* eslint-disable no-restricted-imports -- Isolated research instrument over frozen built production roots (the repository's established research-harness convention); zero production code changes and no production import of this module. */
/**
 * DecisionProbeV2 — probe driver. RESEARCH-ONLY.
 *
 * V0 and V1 are NOT modified. This is the V2 sibling: identical measurement logic (pure
 * substitution, one call, no retry, fail-closed parsing, non-mutation), parameterised by the
 * frozen contract and the legal token set of the phase being run.
 *
 * TOKEN_REMAP scoring maps the neutral labels back to constructs using the FROZEN PROTOCOL
 * mapping (`V2_NEUTRAL_LABEL_MAPPING`). The mapping is never placed in the prompt.
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
import { DECISION_PROBE_V1_SCHEMA_VERSION } from "../decision-probe-v1/contract.ts";
import { V2_NEUTRAL_LABELS, V2_NEUTRAL_LABEL_MAPPING } from "./contract.ts";

export type V2Construct = (typeof DECISION_PROBE_DECISIONS)[number];
export type V2Phase = "PRIMARY" | "C3" | "FORMAT_ONLY" | "TOKEN_REMAP";

/** The legal output tokens per phase. TOKEN_REMAP advertises the neutral labels. */
export function legalTokensForPhase(phase: V2Phase): readonly string[] {
  return phase === "TOKEN_REMAP" ? V2_NEUTRAL_LABELS : DECISION_PROBE_DECISIONS;
}

/** The output schema for a phase. Not transmitted by the cloud transport; recorded for honesty. */
export function schemaForPhase(phase: V2Phase): Readonly<Record<string, unknown>> {
  return Object.freeze({
    type: "object",
    additionalProperties: false,
    required: ["decision_probe_schema_version", "decision"],
    properties: {
      decision_probe_schema_version: { const: DECISION_PROBE_V1_SCHEMA_VERSION },
      decision: { enum: [...legalTokensForPhase(phase)] },
      explanation: {
        type: "string",
        minLength: 1,
        maxLength: DECISION_PROBE_EXPLANATION_MAX_CODE_POINTS_V0
      }
    }
  });
}

export type V2Validation =
  | { readonly ok: true; readonly construct: V2Construct; readonly emitted_token: string }
  | { readonly ok: false; readonly code: string; readonly detail: string };

const ADMITTED = Object.freeze(["decision_probe_schema_version", "decision", "explanation"]);

/** Fail closed. No repair, no coercion. The explanation is validated then discarded. */
export function validateV2Output(content: string, phase: V2Phase): V2Validation {
  if (typeof content !== "string" || content.trim().length === 0) {
    return { ok: false, code: "EMPTY_CONTENT", detail: "empty content" };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    return { ok: false, code: "NOT_JSON", detail: (error as Error).message.slice(0, 80) };
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
  const token = record["decision"];
  if (typeof token !== "string" || !legalTokensForPhase(phase).includes(token)) {
    return { ok: false, code: "DECISION_NOT_IN_CLOSED_SET", detail: `got ${JSON.stringify(token)}` };
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
  const construct: V2Construct =
    phase === "TOKEN_REMAP"
      ? (V2_NEUTRAL_LABEL_MAPPING[token as keyof typeof V2_NEUTRAL_LABEL_MAPPING] as V2Construct)
      : (token as V2Construct);
  return { ok: true, construct, emitted_token: token };
}

export interface V2BuiltRequestV0 {
  readonly request: ModelTransportRequestV0;
  readonly production_prefix_preserved: boolean;
  readonly only_system_message_indented: boolean;
  readonly schema_substituted: boolean;
  readonly chain_of_custody_ok: boolean;
  readonly production_request_hash: HashV1;
  readonly probe_request_hash: HashV1;
  readonly contract_hash: HashV1;
}

export interface V2Mode {
  /** `SUBSTITUTION_WITH_OVERRIDE` appends the contract; `CARRY_PRODUCTION` changes nothing. */
  readonly kind: "SUBSTITUTION_WITH_OVERRIDE";
  readonly contract: string;
}

/** Pure: returns new objects; the production request is never mutated. */
export async function buildV2Request(input: {
  readonly production_request: ModelTransportRequestV0;
  readonly mode: V2Mode;
  readonly schema: Readonly<Record<string, unknown>>;
}): Promise<V2BuiltRequestV0> {
  const productionMessages = input.production_request.messages;
  const probeMessages = productionMessages.map((message) =>
    message.role === "system"
      ? Object.freeze({ role: message.role, content: `${message.content}${input.mode.contract}` })
      : Object.freeze({ role: message.role, content: message.content })
  );
  const request = Object.freeze({
    messages: Object.freeze(probeMessages),
    structured_output: Object.freeze({ kind: "JSON_SCHEMA" as const, schema: input.schema })
  }) as unknown as ModelTransportRequestV0;

  const prefixPreserved = probeMessages.every((message, index) => {
    const original = productionMessages[index];
    return original !== undefined && message.content.startsWith(original.content);
  });
  const onlySystemIndented = probeMessages.every((message, index) => {
    const original = productionMessages[index];
    if (original === undefined) return false;
    return message.content === original.content || message.role === "system";
  });
  const schemaSubstituted =
    canonicalJsonString(input.schema) !==
    canonicalJsonString(input.production_request.structured_output?.schema ?? {});

  const requestHashOf = async (value: unknown): Promise<HashV1> =>
    await hashEnvelope("characteros-next/research/decision-probe/request/v0", value);

  return Object.freeze({
    request,
    production_prefix_preserved: prefixPreserved,
    only_system_message_indented: onlySystemIndented,
    schema_substituted: schemaSubstituted,
    chain_of_custody_ok: prefixPreserved && onlySystemIndented && schemaSubstituted,
    production_request_hash: await requestHashOf(input.production_request),
    probe_request_hash: await requestHashOf(request),
    contract_hash: await hashEnvelope("characteros-next/research/decision-probe-v2/protocol/v0", {
      contract: input.mode.contract
    })
  });
}

export interface V2TrialV0 {
  readonly phase: V2Phase;
  readonly fixture_id: string;
  readonly replicate_ordinal: number;
  readonly outcome: "DECIDED" | "REJECTED" | "TRANSPORT_FAILED";
  readonly construct: V2Construct | null;
  readonly emitted_token: string | null;
  readonly rejection_code: string | null;
  readonly transport_failure: string | null;
  readonly raw_content: string | null;
  readonly elapsed_ms: number;
  readonly production_request_hash: string;
  readonly probe_request_hash: string;
  readonly contract_hash: string;
  readonly record_hash: HashV1;
}

export async function runV2Trial(input: {
  readonly transport: ModelTransportV0;
  readonly production_request: ModelTransportRequestV0;
  readonly phase: V2Phase;
  readonly contract: string;
  readonly fixture_id: string;
  readonly replicate_ordinal: number;
}): Promise<V2TrialV0> {
  const built = await buildV2Request({
    production_request: input.production_request,
    mode: { kind: "SUBSTITUTION_WITH_OVERRIDE", contract: input.contract },
    schema: schemaForPhase(input.phase)
  });
  if (!built.chain_of_custody_ok) {
    throw new Error(`DECISION_PROBE_V2_FIDELITY_VIOLATION: ${JSON.stringify(built)}`);
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

  let outcome: V2TrialV0["outcome"] = "TRANSPORT_FAILED";
  let construct: V2Construct | null = null;
  let emittedToken: string | null = null;
  let rejectionCode: string | null = null;
  if (failure === null) {
    const validation = validateV2Output(content ?? "", input.phase);
    if (validation.ok) {
      outcome = "DECIDED";
      construct = validation.construct;
      emittedToken = validation.emitted_token;
    } else {
      outcome = "REJECTED";
      rejectionCode = validation.code;
    }
  }

  const body = Object.freeze({
    phase: input.phase,
    fixture_id: input.fixture_id,
    replicate_ordinal: input.replicate_ordinal,
    outcome,
    construct,
    emitted_token: emittedToken,
    contract_hash: built.contract_hash,
    probe_request_hash: built.probe_request_hash
  });

  return Object.freeze({
    ...body,
    rejection_code: rejectionCode,
    transport_failure: failure,
    raw_content: content,
    elapsed_ms: elapsedMs,
    production_request_hash: built.production_request_hash,
    record_hash: await hashEnvelope("characteros-next/research/decision-probe-v2/trial/v0", body)
  });
}
