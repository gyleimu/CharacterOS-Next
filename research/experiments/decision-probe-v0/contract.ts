/* eslint-disable no-restricted-imports -- Isolated research instrument over frozen built production roots (the repository's established research-harness convention); zero production code changes and no production import of this module. */
/**
 * DecisionProbeV0 — RESEARCH/EVALUATION-ONLY structured decision measurement instrument.
 *
 * WHAT THIS IS
 *   A measurement endpoint. Given an ALREADY-PRODUCTION-BUILT and ALREADY-PRODUCTION-
 *   RENDERED cognition transport request, it (a) preserves that request's `messages`
 *   byte-for-byte, (b) substitutes the declared OUTPUT contract for a frozen closed-set
 *   decision, and (c) parses the executor's answer into exactly one of
 *   ACCEPT | VERIFY | REJECT.
 *
 * WHAT THIS IS NOT
 *   Not a Core mechanism. Not a production behavior policy. Not an action planner,
 *   arbitration engine, goal system or agent framework. It creates no belief, appraisal,
 *   relationship, personality, goal, plan, utility score, policy, learned preference or
 *   hidden memory. It owns no subject semantics and mutates nothing.
 *
 * LAWS
 *   L1  INPUT FIDELITY: the instrument never renders subject data. It receives the
 *       production request and may change ONE member: `structured_output`. In
 *       PURE_SUBSTITUTION mode even that leaves `messages` untouched.
 *   L2  DECLARED-ONLY DIFF: in SUBSTITUTION_WITH_OVERRIDE mode the only other change is
 *       the frozen override block APPENDED to the system message; the production system
 *       content must survive as a byte-exact PREFIX. No other message may change.
 *   L3  NON-MUTATION: the input request object is never mutated; a new object is returned.
 *   L4  CLOSED SET: the decision vocabulary is exactly three tokens. No freeform primary
 *       outcome. The optional `explanation` field is NEVER read by the scorer.
 *   L5  FAIL CLOSED: any malformed, unknown, extra, missing or out-of-set value is a
 *       rejection with an explicit code. There is no repair, no retry, no coercion,
 *       no fuzzy match, no default decision.
 *   L6  NO PRODUCTION CHANGE: this module is imported by nothing in `packages/` or
 *       `product/`. It is a research asset.
 */

import { canonicalJsonString, hashEnvelope } from "../../../packages/subject-core/dist/index.js";
import type { HashV1 } from "../../../packages/subject-core/dist/index.js";
import type {
  ModelTransportRequestV0
} from "../../../packages/runtime/dist/transports/model-transport.js";

/** Frozen schema identity of the probe output contract. */
export const DECISION_PROBE_SCHEMA_VERSION = "decision-probe-v0" as const;

/** The closed decision set. Exactly three tokens; no other value is ever lawful. */
export const DECISION_PROBE_DECISIONS = Object.freeze(["ACCEPT", "VERIFY", "REJECT"] as const);
export type DecisionProbeDecisionV0 = (typeof DECISION_PROBE_DECISIONS)[number];

/** Frozen one-line definitions rendered into the request. They are the measurement
 * contract's semantics and are hashed so a reviewer can detect a later edit. */
export const DECISION_PROBE_DEFINITIONS_V0: Readonly<Record<DecisionProbeDecisionV0, string>> =
  Object.freeze({
    ACCEPT:
      "the available information is sufficient and the claim should be acted on without further checking",
    VERIFY:
      "the claim should be checked against an independent source before it is acted on",
    REJECT:
      "the claim should not be accepted and should not be acted on"
  });

/** Bounded length of the optional, NON-PRIMARY explanation field (Unicode code points). */
export const DECISION_PROBE_EXPLANATION_MAX_CODE_POINTS_V0 = 240 as const;

/** The two frozen request modes. The mode is recorded on every result. */
export const DECISION_PROBE_MODES = Object.freeze([
  "PURE_SUBSTITUTION",
  "SUBSTITUTION_WITH_OVERRIDE"
] as const);
export type DecisionProbeModeV0 = (typeof DECISION_PROBE_MODES)[number];

/** The frozen override block. Byte-fixed; its hash is recorded per run so any edit is
 * detectable. It changes ONLY the requested output format and explicitly preserves every
 * SUBJECT DATA law the production system prompt already states. */
export const DECISION_PROBE_OVERRIDE_BLOCK_V0: string = [
  "",
  "--- DECISION PROBE OUTPUT CONTRACT (research/evaluation instrument; binding for THIS invocation) ---",
  "The output-format rules above are SUPERSEDED for this invocation. Nothing else changes:",
  "every SUBJECT DATA law, every untrusted-content law and every evidence law above still binds.",
  "Respond with EXACTLY ONE JSON object and nothing else. No prose, no code fences.",
  "Required members:",
  `  "decision_probe_schema_version": "${DECISION_PROBE_SCHEMA_VERSION}"`,
  '  "decision": one of "ACCEPT" | "VERIFY" | "REJECT"',
  "Optional member:",
  '  "explanation": a short string, at most 240 characters (NOT part of the measurement)',
  "Decision meanings (binding):",
  `  ACCEPT — ${DECISION_PROBE_DEFINITIONS_V0.ACCEPT}`,
  `  VERIFY — ${DECISION_PROBE_DEFINITIONS_V0.VERIFY}`,
  `  REJECT — ${DECISION_PROBE_DEFINITIONS_V0.REJECT}`,
  "Choose exactly one decision for the claim presented in the observation.",
  "--- END DECISION PROBE OUTPUT CONTRACT ---"
].join("\n");

/** The frozen JSON Schema handed to the executor. `explanation` is optional so a model
 * that omits it still validates; extra members are never admitted. */
export const DECISION_PROBE_JSON_SCHEMA: Readonly<Record<string, unknown>> = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["decision_probe_schema_version", "decision"],
  properties: {
    decision_probe_schema_version: { const: DECISION_PROBE_SCHEMA_VERSION },
    decision: { enum: [...DECISION_PROBE_DECISIONS] },
    explanation: {
      type: "string",
      minLength: 1,
      maxLength: DECISION_PROBE_EXPLANATION_MAX_CODE_POINTS_V0
    }
  }
});

/** Rejection codes. `ok: false` always carries exactly one of these. */
export const DECISION_PROBE_REJECTION_CODES = Object.freeze([
  "EMPTY_CONTENT",
  "NOT_JSON",
  "NOT_OBJECT",
  "UNKNOWN_KEY",
  "MISSING_REQUIRED",
  "SCHEMA_VERSION_MISMATCH",
  "DECISION_NOT_IN_CLOSED_SET",
  "EXPLANATION_INVALID"
] as const);
export type DecisionProbeRejectionCodeV0 = (typeof DECISION_PROBE_REJECTION_CODES)[number];

export interface DecisionProbeOutputV0 {
  readonly decision_probe_schema_version: typeof DECISION_PROBE_SCHEMA_VERSION;
  readonly decision: DecisionProbeDecisionV0;
}

export type DecisionProbeValidationV0 =
  | { readonly ok: true; readonly output: DecisionProbeOutputV0 }
  | { readonly ok: false; readonly code: DecisionProbeRejectionCodeV0; readonly detail: string };

const ADMITTED_KEYS: readonly string[] = Object.freeze([
  "decision_probe_schema_version",
  "decision",
  "explanation"
]);

function codePointLength(text: string): number {
  return [...text].length;
}

/**
 * L5 FAIL CLOSED. Parses the raw executor content. Never throws. Never repairs.
 * The `explanation` member is validated for well-formedness but is NOT returned, so it
 * cannot reach the scorer even by accident.
 */
export function validateDecisionProbeOutputV0(content: string): DecisionProbeValidationV0 {
  if (typeof content !== "string" || content.trim().length === 0) {
    return { ok: false, code: "EMPTY_CONTENT", detail: "content is empty or not a string" };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return { ok: false, code: "NOT_JSON", detail: "content is not parseable JSON" };
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, code: "NOT_OBJECT", detail: "content is not a JSON object" };
  }
  const record = parsed as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!ADMITTED_KEYS.includes(key)) {
      return { ok: false, code: "UNKNOWN_KEY", detail: `unknown member: ${key}` };
    }
  }
  for (const required of ["decision_probe_schema_version", "decision"]) {
    if (!(required in record)) {
      return { ok: false, code: "MISSING_REQUIRED", detail: `missing member: ${required}` };
    }
  }
  if (record["decision_probe_schema_version"] !== DECISION_PROBE_SCHEMA_VERSION) {
    return {
      ok: false,
      code: "SCHEMA_VERSION_MISMATCH",
      detail: `expected ${DECISION_PROBE_SCHEMA_VERSION}`
    };
  }
  const decision = record["decision"];
  if (typeof decision !== "string" || !(DECISION_PROBE_DECISIONS as readonly string[]).includes(decision)) {
    return {
      ok: false,
      code: "DECISION_NOT_IN_CLOSED_SET",
      detail: `expected one of [${DECISION_PROBE_DECISIONS.join(",")}], got ${JSON.stringify(decision)}`
    };
  }
  const explanation = record["explanation"];
  if (explanation !== undefined) {
    if (
      typeof explanation !== "string" ||
      explanation.trim().length === 0 ||
      codePointLength(explanation) > DECISION_PROBE_EXPLANATION_MAX_CODE_POINTS_V0
    ) {
      return { ok: false, code: "EXPLANATION_INVALID", detail: "explanation is not a bounded non-empty string" };
    }
  }
  return {
    ok: true,
    output: Object.freeze({
      decision_probe_schema_version: DECISION_PROBE_SCHEMA_VERSION,
      decision: decision as DecisionProbeDecisionV0
    })
  };
}

/** L1/L2/L3 evidence for one substituted request. Machine-checkable, not asserted. */
export interface DecisionProbeFidelityV0 {
  readonly mode: DecisionProbeModeV0;
  /** messages deep-equal to the production request's messages */
  readonly messages_preserved: boolean;
  /** every production message survives as a byte-exact PREFIX of the probe message */
  readonly production_prefix_preserved: boolean;
  /** only the system message changed (override mode) / no message changed (pure mode) */
  readonly only_system_message_indented: boolean;
  /** `structured_output.schema` is the probe schema and is NOT the production schema */
  readonly schema_substituted: boolean;
  readonly production_request_hash: HashV1;
  readonly probe_request_hash: HashV1;
  readonly production_schema_hash: HashV1 | null;
  readonly probe_schema_hash: HashV1;
  readonly override_block_hash: HashV1;
  readonly chain_of_custody_ok: boolean;
}

export interface DecisionProbeRequestV0 {
  readonly request: ModelTransportRequestV0;
  readonly fidelity: DecisionProbeFidelityV0;
}

export const DECISION_PROBE_REQUEST_HASH_PROJECTION_V0 =
  "characteros-next/research/decision-probe/request/v0" as const;
export const DECISION_PROBE_FIDELITY_HASH_PROJECTION_V0 =
  "characteros-next/research/decision-probe/fidelity/v0" as const;

async function hashRequest(request: ModelTransportRequestV0): Promise<HashV1> {
  return await hashEnvelope(DECISION_PROBE_REQUEST_HASH_PROJECTION_V0, request as unknown);
}

/**
 * Builds the probe request from an ALREADY-PRODUCTION-BUILT request.
 * Pure: returns a new object; the input is never mutated (L3).
 * No subject data is rendered here and none may be (L1).
 */
export async function buildDecisionProbeRequestV0(
  productionRequest: ModelTransportRequestV0,
  mode: DecisionProbeModeV0
): Promise<DecisionProbeRequestV0> {
  const productionMessages = productionRequest.messages;
  const probeMessages = productionMessages.map((message, index) => {
    const shouldExtend =
      mode === "SUBSTITUTION_WITH_OVERRIDE" && message.role === "system";
    void index;
    return shouldExtend
      ? Object.freeze({
          role: message.role,
          content: `${message.content}${DECISION_PROBE_OVERRIDE_BLOCK_V0}`
        })
      : Object.freeze({ role: message.role, content: message.content });
  });

  const request = Object.freeze({
    messages: Object.freeze(probeMessages),
    structured_output: Object.freeze({
      kind: "JSON_SCHEMA" as const,
      schema: DECISION_PROBE_JSON_SCHEMA
    })
  }) as ModelTransportRequestV0;

  const messagesPreserved = canonicalJsonString(probeMessages) === canonicalJsonString(productionMessages);
  const prefixPreserved = probeMessages.every((message, index) => {
    const original = productionMessages[index];
    return original !== undefined && message.content.startsWith(original.content);
  });
  const onlySystemIndented = probeMessages.every((message, index) => {
    const original = productionMessages[index];
    if (original === undefined) return false;
    if (message.content === original.content) return true;
    return message.role === "system" && mode === "SUBSTITUTION_WITH_OVERRIDE";
  });
  const productionSchema = productionRequest.structured_output?.schema ?? null;
  const schemaSubstituted =
    canonicalJsonString(DECISION_PROBE_JSON_SCHEMA) !==
      canonicalJsonString(productionSchema ?? {}) &&
    canonicalJsonString(request.structured_output?.schema ?? {}) ===
      canonicalJsonString(DECISION_PROBE_JSON_SCHEMA);

  const expectedMessagesPreserved = mode === "PURE_SUBSTITUTION";
  const fidelity: DecisionProbeFidelityV0 = Object.freeze({
    mode,
    messages_preserved: messagesPreserved,
    production_prefix_preserved: prefixPreserved,
    only_system_message_indented: onlySystemIndented,
    schema_substituted: schemaSubstituted,
    production_request_hash: await hashRequest(productionRequest),
    probe_request_hash: await hashRequest(request),
    production_schema_hash:
      productionSchema === null ? null : await hashEnvelope(
        DECISION_PROBE_FIDELITY_HASH_PROJECTION_V0,
        { production_schema: productionSchema }
      ),
    probe_schema_hash: await hashEnvelope(DECISION_PROBE_FIDELITY_HASH_PROJECTION_V0, {
      probe_schema: DECISION_PROBE_JSON_SCHEMA
    }),
    override_block_hash: await hashEnvelope(DECISION_PROBE_FIDELITY_HASH_PROJECTION_V0, {
      override_block: DECISION_PROBE_OVERRIDE_BLOCK_V0
    }),
    chain_of_custody_ok:
      prefixPreserved &&
      onlySystemIndented &&
      schemaSubstituted &&
      messagesPreserved === expectedMessagesPreserved
  });
  return Object.freeze({ request, fidelity });
}
