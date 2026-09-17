/**
 * PRODUCT OUTPUT ROBUSTNESS V0 — tests.
 *
 * Model output tolerance is a PRODUCT DELIVERY property, not a scientific one:
 *   FORMAT MAY BE REPAIRED. MEANING MAY NEVER BE INVENTED.
 * Every case here is offline (mock transports); no model is called.
 */
import { describe, expect, it } from "vitest";

import type { ModelTransportRequestV0, ModelTransportResponseV0, ModelTransportV0 } from "../../transports/model-transport.js";

import {
  createNormalizingTransport,
  normalizeModelContent,
  regenerationFeedbackText,
  ROBUST_COGNITION_POLICY
} from "./robust-cognition-output-v8.js";

/* -------------------------------------------------------------------------- */
/* SAFE NORMALIZATION — semantics-preserving only                              */
/* -------------------------------------------------------------------------- */

describe("OUTPUT ROBUSTNESS — safe normalization", () => {
  it("VALID_FIRST_RESPONSE: a valid object is untouched and nothing is applied", () => {
    const valid = JSON.stringify({ schema_version: "x", cognition: { ok: true } });
    const result = normalizeModelContent(valid);
    expect(result.content).toBe(valid);
    expect(result.applied).toEqual([]);
    expect(result.unchanged).toBe(true);
  });

  it("MARKDOWN_FENCE: one outer fence is stripped when the body parses", () => {
    const body = '{"a":1}';
    const fenced = "```json\n" + body + "\n```";
    const result = normalizeModelContent(fenced);
    expect(result.content).toBe(body);
    expect(result.applied).toContain("MARKDOWN_FENCE_STRIPPED");
    // a fence whose body is NOT JSON is left alone (never guessed)
    const notJson = normalizeModelContent("```\nhello\n```");
    expect(notJson.unchanged).toBe(true);
  });

  it("BOM and surrounding whitespace are removed", () => {
    const result = normalizeModelContent("\uFEFF  {\"a\":1}  \n");
    expect(result.content).toBe('{"a":1}');
    expect(result.applied).toEqual(["BOM_REMOVED", "WHITESPACE_TRIMMED"]);
  });

  it("SINGLE_OBJECT_EXTRACTED: exactly one unambiguous object surrounded by prose", () => {
    const result = normalizeModelContent('Sure! Here it is:\n{"a":1}\nHope that helps.');
    expect(result.content).toBe('{"a":1}');
    expect(result.applied).toContain("SINGLE_OBJECT_EXTRACTED");
    // TWO objects are ambiguous and are never guessed
    const ambiguous = normalizeModelContent('{"a":1} and also {"b":2}');
    expect(ambiguous.unchanged).toBe(true);
  });

  it("DIRECTIVE_STRING: an exactly-known directive atom is canonicalized to the contract shape", () => {
    const raw = JSON.stringify({ schema_version: "v8", communication_directive: "CLARIFY_MISSING_CONTEXT" });
    const result = normalizeModelContent(raw);
    expect(result.applied).toContain("KNOWN_DIRECTIVE_STRING_CANONICALIZED");
    const parsed = JSON.parse(result.content) as { communication_directive: { kind: string } };
    expect(parsed.communication_directive).toEqual({ kind: "CLARIFY_MISSING_CONTEXT" });
    // every other field is preserved byte-for-byte in meaning
    expect((JSON.parse(result.content) as { schema_version: string }).schema_version).toBe("v8");
    // the other known atom too
    const other = normalizeModelContent(JSON.stringify({ communication_directive: "REALIZE_CURRENT_INTENT" }));
    expect((JSON.parse(other.content) as { communication_directive: { kind: string } }).communication_directive.kind).toBe(
      "REALIZE_CURRENT_INTENT"
    );
  });

  it("UNKNOWN_ENUM: an unknown directive string is NEVER repaired", () => {
    const raw = JSON.stringify({ communication_directive: "DO_SOMETHING_RANDOM" });
    const result = normalizeModelContent(raw);
    expect(result.content).toBe(raw);
    expect(result.applied).toEqual([]);
    expect(result.unchanged).toBe(true);
  });

  it("normalization NEVER invents or removes semantic content", () => {
    const raw = JSON.stringify({
      communication_directive: "CLARIFY_MISSING_CONTEXT",
      cognition: { reasoning_summary: "kept", current_intent: "kept" },
      factual_assessment: { claims: [{ kind: "SOURCE_QUOTE", text: "kept", source_handles: ["F1"] }] }
    });
    const result = normalizeModelContent(raw);
    const before = JSON.parse(raw) as Record<string, unknown>;
    const after = JSON.parse(result.content) as Record<string, unknown>;
    // only the directive representation changed; every other key is identical
    expect(Object.keys(after).sort()).toEqual(Object.keys(before).sort());
    expect(after["cognition"]).toEqual(before["cognition"]);
    expect(after["factual_assessment"]).toEqual(before["factual_assessment"]);
    // no field is ever added beyond the canonical directive shape
    const addedKeys = Object.keys(after).filter((key) => !(key in before));
    expect(addedKeys).toEqual([]);
    // a missing required field is NOT filled in
    const missing = normalizeModelContent(JSON.stringify({ cognition: {} }));
    expect(missing.unchanged).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/* BOUNDED REGENERATION — exactly one extra attempt                            */
/* -------------------------------------------------------------------------- */

function scriptedTransport(script: readonly (() => ModelTransportResponseV0)[]): {
  readonly transport: ModelTransportV0;
  readonly requests: ModelTransportRequestV0[];
} {
  const requests: ModelTransportRequestV0[] = [];
  let index = 0;
  return {
    requests,
    transport: {
      async complete(request: ModelTransportRequestV0): Promise<ModelTransportResponseV0> {
        requests.push(request);
        const entry = script[Math.min(index, script.length - 1)];
        index += 1;
        if (entry === undefined) throw new Error("script exhausted");
        return entry();
      }
    }
  };
}

const VALID_PROPOSAL = JSON.stringify({
  schema_version: "conversation-cognition-proposal-v8",
  response_semantics: { kind: "PRIMARY_CONVERSATIONAL_ACT", act: "ACKNOWLEDGE" },
  factual_assessment: { claims: [] },
  cognition: {
    schema_version: "cognition-proposal-v0",
    reasoning_summary: "offline",
    relevant_memory_handles: [],
    considered_handles: [],
    current_intent: "respond",
    confidence: 0.5,
    uncertainty: 0.5,
    action_intent: null,
    evidence_handles: []
  },
  subjective_selection: { kind: "NO_SUBJECTIVE_SELECTION" },
  communication_directive: { kind: "REALIZE_CURRENT_INTENT" },
  clarification_basis: null
});

describe("OUTPUT ROBUSTNESS — bounded regeneration policy", () => {
  it("THE POLICY IS FROZEN AT TWO ATTEMPTS AND IS NOT RETRY-UNTIL-VALID", () => {
    expect(ROBUST_COGNITION_POLICY.max_attempts).toBe(2);
    expect(ROBUST_COGNITION_POLICY.max_attempts).toBeLessThanOrEqual(2);
  });

  it("the regeneration feedback quotes the REAL validator, adds no cognition guidance", () => {
    const feedback = regenerationFeedbackText({
      failure_class: "MODEL_SCHEMA_INVALID",
      detail: "conversation proposal.communication_directive: directive: expected plain object"
    });
    expect(feedback).toContain("did not satisfy the required output contract");
    expect(feedback).toContain("expected plain object");
    expect(feedback).toContain("Do not change the underlying semantic decision.");
    // no new cognitive instruction is smuggled in
    expect(feedback.toLowerCase()).not.toMatch(/belief|affect|familiarity|prefer|should feel/);
  });

  it("the normalizing transport appends feedback only when a regeneration asks for it", async () => {
    const script = scriptedTransport([() => ({ content: "```json\n" + VALID_PROPOSAL + "\n```", model: "fake" })]);
    const plain = createNormalizingTransport(script.transport);
    const withoutFeedback = await plain.complete({ messages: [{ role: "user", content: "hi" }] });
    expect(script.requests[0]?.messages).toHaveLength(1);
    expect(withoutFeedback.content).toBe(VALID_PROPOSAL);

    const second = scriptedTransport([() => ({ content: VALID_PROPOSAL, model: "fake" })]);
    const withFeedback = createNormalizingTransport(second.transport, { feedback: "fix it" });
    const withFeedbackResponse = await withFeedback.complete({ messages: [{ role: "user", content: "hi" }] });
    expect(second.requests[0]?.messages).toHaveLength(2);
    expect(second.requests[0]?.messages[1]?.content).toBe("fix it");
    expect(withFeedbackResponse.content).toBe(VALID_PROPOSAL);
  });
});
