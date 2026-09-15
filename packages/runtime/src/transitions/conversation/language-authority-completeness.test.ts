/**
 * LANGUAGE AUTHORITY HARDENING + INPUT ISOLATION — production tests.
 *
 * Proves the V9 contract:
 *  - the pre-Language realization completeness gate (LC-C) refuses determined-content
 *    turns whose authoritative proposal lacks a host-verifiable derivation (the N6 shape),
 *    and Language is never eligible for them;
 *  - complete derivations (arithmetic / reverse / classification) and authoritative
 *    stances pass, and the realization plan references only already-authorized atoms;
 *  - the model-facing serialization excludes the host-only request identity, so two
 *    semantically identical requests with different ids produce identical model bytes;
 *  - none of the V7 factual authority, rationale authorization or clarification behavior
 *    is weakened.
 */
import { describe, expect, it } from "vitest";
import {
  canonicalizeConversationCognitionModelOutputV7,
  type ModelTransportRequestV0,
  type ModelTransportV0
} from "../../index.js";
import {
  buildLanguageRealizationInputV9,
  deriveModelFacingLanguagePayloadHashV9,
  modelFacingLanguagePayloadV9
} from "./language-realization-input.js";
import { LanguageRealizationProviderV0 } from "../../providers/behavior/language-realization-provider.js";

const OBS = "observation:o-language-v9";
const HASH = `sha256:${"a".repeat(64)}` as never;
const SCENE = 'Alice asks: "What is 17 + 25?" Reverse the characters in the token R8K2. A token is MATCH iff its first and last characters are identical. Classify abca.';

function projection() {
  return {
    schema_version: "cognitive-context-projection-v2", subject_id: "subject-language-v9" as never,
    current_logical_time: 3 as never, state_revision: 3 as never, traits_dimensions: {}, personality_dimensions: {},
    personality_disposition: {}, canonical_affect: { schema_version: "canonical-affect-cognition-projection-v0", valence: 0, activation: 0.5 } as never,
    regulation: { energy: 1, stress: 0, arousal: 0.5, fatigue: 0 },
    context: {
      scene: SCENE, task: "Respond to the user's latest message.", focus_refs: [],
      active_entity_refs: ["entity:alice"], environment_refs: ["environment:room-1"], current_observation_ref: OBS as never
    },
    memory_working_refs: [] as never, recent_retrieval_refs: [], belief_item_count: 0, belief_items: [],
    relationship_counterpart_count: 0, relationship_dimensions: [], interaction_familiarity: [],
    interaction_familiarity_cognition_influences: [], allowed_actions: [], projection_hash: HASH,
    factual_memory_evidence: { entries: [] }
  } as never;
}

const OBS_HANDLE = "F1";

function wire(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: "conversation-cognition-proposal-v7",
    factual_assessment: { claims: [] },
    cognition: {
      schema_version: "cognition-proposal-v0", reasoning_summary: "deterministic test",
      relevant_memory_handles: [], considered_handles: [OBS_HANDLE], current_intent: "respond",
      confidence: 1, uncertainty: 0, action_intent: null, evidence_handles: [OBS_HANDLE]
    },
    subjective_selection: { kind: "NO_SUBJECTIVE_SELECTION" },
    communication_directive: { kind: "REALIZE_CURRENT_INTENT" },
    clarification_basis: null,
    ...overrides
  };
}

function quoteClaim(text: string) {
  return { kind: "SOURCE_QUOTE", text, source_handles: [OBS_HANDLE] };
}

function derivationClaim(operation: string, derivation: Record<string, unknown>) {
  return { kind: "HOST_VERIFIABLE_DERIVATION", operation, source_handles: [OBS_HANDLE], derivation };
}

function canonicalize(value: unknown) {
  const checked = canonicalizeConversationCognitionModelOutputV7(value, projection(), HASH);
  if (!checked.ok) throw new Error(`fixture proposal rejected: ${checked.detail}`);
  return checked.proposal;
}

const N6_SHAPE = wire({ factual_assessment: { claims: [
  quoteClaim("A token is MATCH iff its first and last characters are identical."),
  quoteClaim("Classify abca.")
] } });

const COMPLETE_CLASSIFICATION = wire({ factual_assessment: { claims: [
  quoteClaim("A token is MATCH iff its first and last characters are identical."),
  quoteClaim("Classify abca."),
  derivationClaim("RULE_CLASSIFICATION", {
    source_rule: "A token is MATCH iff its first and last characters are identical.",
    source_query: "Classify abca.",
    claimed_result: "MATCH"
  })
] } });

const COMPLETE_ARITHMETIC = wire({ factual_assessment: { claims: [
  derivationClaim("INTEGER_ARITHMETIC", { source_expression: "17 + 25", operands: { left: 17, operator: "ADD", right: 25 }, claimed_result: 42 })
] } });

const COMPLETE_REVERSE = wire({ factual_assessment: { claims: [
  derivationClaim("STRING_REVERSE", { source_instruction: "Reverse the characters in the token R8K2.", input: "R8K2", claimed_result: "2K8R" })
] } });

const SUBJECTIVE = wire({
  factual_assessment: { claims: [quoteClaim("What is 17 + 25?")] },
  subjective_selection: { kind: "SUBJECTIVE_SELECTION", stance: "I would rather use the free time.", subjective_rationale: "I prefer to use the available time productively." }
});

const SUBJECTIVE_NULL_RATIONALE = wire({
  subjective_selection: { kind: "SUBJECTIVE_SELECTION", stance: "I would rather use the free time.", subjective_rationale: null }
});

function buildRequest(proposal: unknown, responseRequestId = "req-language-v9-1") {
  return {
    subject_id: "subject-language-v9" as never,
    source_revision: 3 as never,
    response_request_id: responseRequestId as never,
    projection: projection(),
    conversation_proposal: proposal,
    memory_episode_contents: [] as never
  };
}

describe("V9 pre-Language realization completeness gate (LC-C)", () => {
  it("refuses the N6 shape: quotes only, no authorized derivation", async () => {
    const built = await buildLanguageRealizationInputV9(buildRequest(canonicalize(N6_SHAPE)));
    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.code).toBe("SEMANTIC_COMPLETENESS_FAILED");
    expect(built.detail).toContain("host-verifiable derivation");
  });

  it("admits a complete classification: the plan references the authorized derivation", async () => {
    const built = await buildLanguageRealizationInputV9(buildRequest(canonicalize(COMPLETE_CLASSIFICATION)));
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.input.realization_plan.mode).toBe("FACTUAL_DERIVATION_RESPONSE");
    const references = built.input.realization_plan.references;
    expect(references.length).toBe(1);
    const reference = references[0];
    expect(reference?.kind).toBe("FACTUAL_CLAIM");
    if (reference?.kind !== "FACTUAL_CLAIM") return;
    const claim = built.input.factual_assessment.claims[reference.claim_index];
    expect(claim?.kind).toBe("HOST_VERIFIABLE_DERIVATION");
    expect(claim?.text).toContain("MATCH");
  });

  it("admits authorized arithmetic and reverse results, and refuses their absence", async () => {
    const arithmetic = await buildLanguageRealizationInputV9(buildRequest(canonicalize(COMPLETE_ARITHMETIC)));
    expect(arithmetic.ok).toBe(true);
    const reverse = await buildLanguageRealizationInputV9(buildRequest(canonicalize(COMPLETE_REVERSE)));
    expect(reverse.ok).toBe(true);
    const missingArithmetic = await buildLanguageRealizationInputV9(buildRequest(canonicalize(wire({ factual_assessment: { claims: [quoteClaim("What is 17 + 25?")] } }))));
    expect(missingArithmetic.ok).toBe(false);
    const missingReverse = await buildLanguageRealizationInputV9(buildRequest(canonicalize(wire({ factual_assessment: { claims: [quoteClaim("Reverse the characters in the token R8K2.")] } }))));
    expect(missingReverse.ok).toBe(false);
  });

  it("admits an authoritative stance with or without a rationale", async () => {
    for (const proposal of [SUBJECTIVE, SUBJECTIVE_NULL_RATIONALE]) {
      const built = await buildLanguageRealizationInputV9(buildRequest(canonicalize(proposal)));
      expect(built.ok).toBe(true);
      if (!built.ok) return;
      expect(built.input.realization_plan.mode).toBe("SUBJECTIVE_SELECTION_RESPONSE");
      expect(built.input.realization_plan.references).toEqual([{ kind: "SUBJECTIVE_STANCE" }]);
    }
  });

  it("admits ordinary conversational realization when no factual claim is asserted", async () => {
    const built = await buildLanguageRealizationInputV9(buildRequest(canonicalize(wire({}))))
      ;
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.input.realization_plan.mode).toBe("NO_FACTUAL_PRIMARY_RESPONSE");
    expect(built.input.realization_plan.references).toEqual([]);
  });

  it("rejects a conversational-mode plan that carries references", async () => {
    const built = await buildLanguageRealizationInputV9(buildRequest(canonicalize(wire({}))));
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const tampered = { ...built.input, realization_plan: { schema_version: "language-realization-plan-v0", mode: "NO_FACTUAL_PRIMARY_RESPONSE", references: [{ kind: "SUBJECTIVE_STANCE" }] } };
    const rejected = await buildLanguageRealizationInputV9(buildRequest(tampered));
    expect(rejected.ok).toBe(false);
  });

  it("never builds a language input for CLARIFY proposals (clarification stays host-rendered)", async () => {
    const clarification = wire({
      factual_assessment: { claims: [quoteClaim("What is 17 + 25?")] },
      communication_directive: { kind: "CLARIFY_MISSING_CONTEXT" },
      clarification_basis: { current_observation_ref: OBS, missing_information: "the operand", needed_for: "answering the question" }
    });
    const built = await buildLanguageRealizationInputV9(buildRequest(canonicalize(clarification)));
    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.code).toBe("INPUT_INVALID");
  });

  it("rejects tampered plans: out-of-range indices and mode/reference mismatches", async () => {
    const built = await buildLanguageRealizationInputV9(buildRequest(canonicalize(COMPLETE_ARITHMETIC)));
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const tampered = { ...built.input, realization_plan: { schema_version: "language-realization-plan-v0", mode: "FACTUAL_DERIVATION_RESPONSE", references: [{ kind: "FACTUAL_CLAIM", claim_index: 9 }] } };
    const rejected = await buildLanguageRealizationInputV9(buildRequest(tampered));
    expect(rejected.ok).toBe(false);
    const wrongMode = { ...built.input, realization_plan: { schema_version: "language-realization-plan-v0", mode: "SUBJECTIVE_SELECTION_RESPONSE", references: [{ kind: "SUBJECTIVE_STANCE" }] } };
    const rejectedMode = await buildLanguageRealizationInputV9(buildRequest(wrongMode));
    expect(rejectedMode.ok).toBe(false);
  });
});

describe("RI-D model-facing request identity isolation", () => {
  it("identical semantics with different request ids produce identical model-facing payloads and hashes", async () => {
    const first = await buildLanguageRealizationInputV9(buildRequest(canonicalize(COMPLETE_ARITHMETIC), "req-language-v9-alpha"));
    const second = await buildLanguageRealizationInputV9(buildRequest(canonicalize(COMPLETE_ARITHMETIC), "req-language-v9-beta"));
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    // host carriers differ (they bind the request identity) ...
    expect(first.input.response_request_id).not.toBe(second.input.response_request_id);
    expect(first.input_hash).not.toBe(second.input_hash);
    // ... while the model-facing semantic payload and its hash are identical
    expect(modelFacingLanguagePayloadV9(first.input)).toEqual(modelFacingLanguagePayloadV9(second.input));
    expect(Object.hasOwn(modelFacingLanguagePayloadV9(first.input), "response_request_id")).toBe(false);
    expect(await deriveModelFacingLanguagePayloadHashV9(first.input)).toBe(await deriveModelFacingLanguagePayloadHashV9(second.input));
  });

  it("the provider serializes the same model-facing bytes for both ids", async () => {
    const first = await buildLanguageRealizationInputV9(buildRequest(canonicalize(COMPLETE_ARITHMETIC), "req-language-v9-alpha"));
    const second = await buildLanguageRealizationInputV9(buildRequest(canonicalize(COMPLETE_ARITHMETIC), "req-language-v9-beta"));
    if (!first.ok || !second.ok) throw new Error("fixture inputs must build");
    const requests: ModelTransportRequestV0[] = [];
    const transport: ModelTransportV0 = {
      complete: async (request: ModelTransportRequestV0) => {
        requests.push(request);
        return { model: "recording", content: JSON.stringify({ schema_version: "language-realization-semantic-draft-v1", text: "17 + 25 = 42.", evidence_refs: [] }) };
      }
    } as never;
    const provider = new LanguageRealizationProviderV0(transport as never);
    await provider.realize({ input: first.input as never, input_hash: first.input_hash, lawful_evidence_refs: new Set([OBS]) as never });
    await provider.realize({ input: second.input as never, input_hash: second.input_hash, lawful_evidence_refs: new Set([OBS]) as never });
    expect(requests).toHaveLength(2);
    const userOf = (request: ModelTransportRequestV0) => request.messages.find((message) => message.role === "user")?.content ?? "";
    const firstUser = userOf(requests[0] as ModelTransportRequestV0);
    const secondUser = userOf(requests[1] as ModelTransportRequestV0);
    expect(firstUser).toBe(secondUser);
    expect(firstUser).toContain("LANGUAGE REALIZATION INPUT V9");
    expect(firstUser).not.toContain("req-language-v9-alpha");
    expect(firstUser).not.toContain("req-language-v9-beta");
    expect(firstUser).not.toContain("response_request_id");
    expect(firstUser).toContain("realization_plan");
  });
});
