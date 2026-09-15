/**
 * AFFECT_COGNITION_RESPONSE_SEMANTICS_ATOM_V0 — production tests.
 *
 * Proves the V8/V10 contract:
 *  - the zero-authority path is gone: REALIZE without a valid response atom fails closed
 *    before Language (no NO_FACTUAL_PRIMARY_RESPONSE live semantics remain);
 *  - PRIMARY_FACT may designate an authorized SOURCE_QUOTE (the pure-quote false
 *    negative is removed) or a host-verified derivation; out-of-range/invalid
 *    designations fail closed;
 *  - PRIMARY_STANCE requires an authoritative stance; PRIMARY_CLARIFICATION requires an
 *    authorized basis; conversational acts are closed-registry and current-turn bound;
 *  - a conversational/generative act never carries factual authority;
 *  - RI-D holds at V10 (the host-only request id is not model-visible).
 */
import { describe, expect, it } from "vitest";
import {
  buildSourceHandleMapV0,
  canonicalizeConversationCognitionModelOutputV8,
  factualAssessmentSourceRefs,
  type ModelTransportRequestV0
} from "../../index.js";
import {
  buildLanguageRealizationInputV10,
  deriveModelFacingLanguagePayloadHashV10,
  modelFacingLanguagePayloadV10
} from "./language-realization-input.js";
import { LanguageRealizationProviderV0 } from "../../providers/behavior/language-realization-provider.js";
import type { ModelTransportV0 } from "../../transports/model-transport.js";

const OBS = "observation:o-atom-review";
const HASH = `sha256:${"a".repeat(64)}` as never;
const SCENE = 'Alice asks: "What is 17 + 25?" Reverse the characters in the token R8K2. A token is MATCH iff its first and last characters are identical. Classify abca. Hello there.';

function projection() {
  return {
    schema_version: "cognitive-context-projection-v2", subject_id: "subject-atom-review" as never,
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
    schema_version: "conversation-cognition-proposal-v8",
    factual_assessment: { claims: [] },
    cognition: {
      schema_version: "cognition-proposal-v0", reasoning_summary: "deterministic atom test",
      relevant_memory_handles: [], considered_handles: [OBS_HANDLE], current_intent: "respond",
      confidence: 1, uncertainty: 0, action_intent: null, evidence_handles: [OBS_HANDLE]
    },
    subjective_selection: { kind: "NO_SUBJECTIVE_SELECTION" },
    communication_directive: { kind: "REALIZE_CURRENT_INTENT" },
    clarification_basis: null,
    response_semantics: { kind: "PRIMARY_CONVERSATIONAL_ACT", act: "ACKNOWLEDGE" },
    ...overrides
  };
}

const quoteClaim = (text: string) => ({ kind: "SOURCE_QUOTE", text, source_handles: [OBS_HANDLE] });
const derivationClaim = (operation: string, derivation: Record<string, unknown>) =>
  ({ kind: "HOST_VERIFIABLE_DERIVATION", operation, source_handles: [OBS_HANDLE], derivation });

function canonicalize(value: unknown) {
  return canonicalizeConversationCognitionModelOutputV8(value, projection(), HASH);
}

function canonicalizeOk(value: unknown) {
  const checked = canonicalize(value);
  if (!checked.ok) throw new Error(`fixture rejected: ${checked.detail}`);
  return checked.proposal;
}

const buildRequest = (proposal: unknown) => ({
  subject_id: "subject-atom-review" as never,
  source_revision: 3 as never,
  response_request_id: "req-atom-review" as never,
  projection: projection(),
  conversation_proposal: proposal,
  memory_episode_contents: [] as never
});

describe("zero-authority invariant (§2/§23/§41)", () => {
  it("a REALIZE wire without a response atom fails closed", () => {
    const noAtom = wire();
    delete (noAtom as Record<string, unknown>)["response_semantics"];
    const checked = canonicalize(noAtom);
    expect(checked.ok).toBe(false);
    if (checked.ok) return;
    expect(checked.detail).toContain("SEMANTIC_COMPLETENESS_FAILED");
  });

  it("the former zero-fact escape hatch no longer exists: Language is never built without a primary", async () => {
    // zero claims + NO_SUBJECTIVE_SELECTION + an admitted act is the only lawful form
    const admitted = await buildLanguageRealizationInputV10(buildRequest(canonicalizeOk(wire())));
    expect(admitted.ok).toBe(true);
    if (!admitted.ok) return;
    expect(admitted.input.realization_plan.primary.kind).toBe("PRIMARY_CONVERSATIONAL_ACT");
    // and with an invalid/absent atom the builder refuses before Language
    const broken = { ...canonicalizeOk(wire()), response_semantics: undefined };
    const refused = await buildLanguageRealizationInputV10(buildRequest(broken));
    expect(refused.ok).toBe(false);
  });
});

describe("PRIMARY_FACT (§7/§8/§37/§38)", () => {
  const quoted = wire({
    factual_assessment: { claims: [quoteClaim("Hello there.")] },
    response_semantics: { kind: "PRIMARY_FACT", claim_index: 0 }
  });

  it("an authorized SOURCE_QUOTE may be the primary response (false negative removed)", async () => {
    const proposal = canonicalizeOk(quoted);
    expect(proposal.response_semantics).toEqual({ kind: "PRIMARY_FACT", claim_index: 0 });
    const built = await buildLanguageRealizationInputV10(buildRequest(proposal));
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.input.realization_plan.primary).toEqual({ kind: "PRIMARY_FACT", claim_index: 0, claim_kind: "SOURCE_QUOTE" });
  });

  it("an authorized host-verifiable derivation may be the primary response", async () => {
    const derived = wire({
      factual_assessment: { claims: [derivationClaim("INTEGER_ARITHMETIC", { source_expression: "17 + 25", operands: { left: 17, operator: "ADD", right: 25 }, claimed_result: 42 })] },
      response_semantics: { kind: "PRIMARY_FACT", claim_index: 0 }
    });
    const built = await buildLanguageRealizationInputV10(buildRequest(canonicalizeOk(derived)));
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.input.realization_plan.primary).toEqual({ kind: "PRIMARY_FACT", claim_index: 0, claim_kind: "HOST_VERIFIABLE_DERIVATION" });
  });

  it("out-of-range or unauthorized designations fail closed", () => {
    const outOfRange = canonicalize(wire({ response_semantics: { kind: "PRIMARY_FACT", claim_index: 3 } }));
    expect(outOfRange.ok).toBe(false);
    const fabricated = canonicalize(wire({
      factual_assessment: { claims: [quoteClaim("A token is MATCH iff its first and last characters are identical.")] },
      response_semantics: { kind: "PRIMARY_FACT", claim_index: 0 }
    }));
    expect(fabricated.ok).toBe(true);
    const badQuote = canonicalize(wire({
      factual_assessment: { claims: [quoteClaim("This text is not in the source at all.")] },
      response_semantics: { kind: "PRIMARY_FACT", claim_index: 0 }
    }));
    expect(badQuote.ok).toBe(false);
  });
});

describe("PRIMARY_STANCE (§9/§39)", () => {
  it("requires an authoritative stance and is lawful with or without a rationale", async () => {
    for (const rationale of ["I prefer to use the available time.", null]) {
      const stanceWire = wire({
        subjective_selection: { kind: "SUBJECTIVE_SELECTION", stance: "I would rather help with the revision.", subjective_rationale: rationale },
        response_semantics: { kind: "PRIMARY_STANCE" }
      });
      const built = await buildLanguageRealizationInputV10(buildRequest(canonicalizeOk(stanceWire)));
      expect(built.ok).toBe(true);
      if (!built.ok) return;
      expect(built.input.realization_plan.primary).toEqual({ kind: "PRIMARY_STANCE" });
    }
  });

  it("NO_SUBJECTIVE_SELECTION + PRIMARY_STANCE fails closed", () => {
    const checked = canonicalize(wire({ response_semantics: { kind: "PRIMARY_STANCE" } }));
    expect(checked.ok).toBe(false);
  });
});

describe("PRIMARY_CLARIFICATION (§10/§40)", () => {
  it("requires the authorized basis and never builds a language input", async () => {
    const clarify = wire({
      communication_directive: { kind: "CLARIFY_MISSING_CONTEXT" },
      clarification_basis: { current_observation_ref: OBS, missing_information: "the missing detail", needed_for: "answering the request" },
      response_semantics: { kind: "PRIMARY_CLARIFICATION" }
    });
    const proposal = canonicalizeOk(clarify);
    const built = await buildLanguageRealizationInputV10(buildRequest(proposal));
    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.code).toBe("INPUT_INVALID");
    const noBasis = canonicalize(wire({
      communication_directive: { kind: "CLARIFY_MISSING_CONTEXT" },
      clarification_basis: null,
      response_semantics: { kind: "PRIMARY_CLARIFICATION" }
    }));
    expect(noBasis.ok).toBe(false);
  });
});

describe("conversational/generative acts (§11–§17/§33–§36)", () => {
  for (const act of ["GREET", "ACKNOWLEDGE", "GENERATIVE"] as const) {
    it(`${act}: admitted, current-turn bound, and never factual authority`, async () => {
      const proposal = canonicalizeOk(wire({ response_semantics: { kind: "PRIMARY_CONVERSATIONAL_ACT", act } }));
      expect(proposal.response_semantics).toEqual({ kind: "PRIMARY_CONVERSATIONAL_ACT", act, target_ref: OBS });
      expect(proposal.factual_assessment.claims).toHaveLength(0);
      const built = await buildLanguageRealizationInputV10(buildRequest(proposal));
      expect(built.ok).toBe(true);
      if (!built.ok) return;
      expect(built.input.realization_plan.primary).toEqual({ kind: "PRIMARY_CONVERSATIONAL_ACT", act, target_ref: OBS });
      const payload = modelFacingLanguagePayloadV10(built.input);
      const wirePayload = JSON.stringify(payload);
      expect(wirePayload).toContain("realization_plan");
      expect(wirePayload).not.toContain("response_request_id");
      expect(payload["factual_assessment"]).toEqual({ claims: [] });
    });
  }

  it("the act registry is frozen: unknown acts fail closed", () => {
    const checked = canonicalize(wire({ response_semantics: { kind: "PRIMARY_CONVERSATIONAL_ACT", act: "APOLOGIZE" } }));
    expect(checked.ok).toBe(false);
  });

  it("a turn with an authoritative stance cannot be replaced by a conversational act", () => {
    const checked = canonicalize(wire({
      subjective_selection: { kind: "SUBJECTIVE_SELECTION", stance: "I would rather help.", subjective_rationale: null },
      response_semantics: { kind: "PRIMARY_CONVERSATIONAL_ACT", act: "GREET" }
    }));
    expect(checked.ok).toBe(false);
  });

  it("model-supplied targets are rejected: the host stamps the current turn", () => {
    const checked = canonicalize(wire({ response_semantics: { kind: "PRIMARY_CONVERSATIONAL_ACT", act: "GREET", target_ref: "observation:o-other-turn" } }));
    expect(checked.ok).toBe(false);
  });
});

describe("downstream Memory epistemic boundary (§17/§18)", () => {
  const GENERATED = "Sure — here is a small haiku about rain on the roof.";
  const EPISODE_REF = `episode:${"b".repeat(64)}`;

  function deliveryProjection() {
    const base = projection() as unknown as Record<string, unknown>;
    return {
      ...base,
      memory_working_refs: [EPISODE_REF],
      factual_memory_evidence: {
        entries: [{
          kind: "BEHAVIOR_OUTCOME",
          episode_ref: EPISODE_REF,
          repository_revision: "R1",
          episode_payload_hash: `sha256:${"c".repeat(64)}`,
          experience_ref: `experience:${"d".repeat(64)}`,
          experience_payload_hash: `sha256:${"e".repeat(64)}`,
          event_ref: `event:${"f".repeat(64)}`,
          event_payload_hash: `sha256:${"0".repeat(64)}`,
          actor_ref: "entity:alice",
          delivered_behavior_text: GENERATED,
          exact_outcome_text: "That was lovely, thanks.",
          delivered_logical_time: 2,
          outcome_logical_time: 3
        }]
      }
    } as never;
  }

  it("a delivered generative surface is a record of what was said, citable only verbatim", () => {
    const p = deliveryProjection();
    // the verified delivery record is lawful inspectable evidence (frozen pre-slice semantics)
    expect(factualAssessmentSourceRefs(p)).toContain(EPISODE_REF);
    const handle = buildSourceHandleMapV0(p).refToHandle.get(EPISODE_REF);
    expect(handle).toBeDefined();
    const citing = (text: string) => ({
      ...wire(),
      factual_assessment: { claims: [{ kind: "SOURCE_QUOTE", text, source_handles: [handle as string] }] },
      response_semantics: { kind: "PRIMARY_FACT", claim_index: 0 }
    });
    // an exact quote of the record is authorized (a statement about the interaction record) ...
    const exact = canonicalizeConversationCognitionModelOutputV8(citing(GENERATED), p, HASH);
    expect(exact.ok).toBe(true);
    // ... while any reinterpretation of the generated wording is refused
    const paraphrased = canonicalizeConversationCognitionModelOutputV8(citing("a haiku about rain"), p, HASH);
    expect(paraphrased.ok).toBe(false);
    if (paraphrased.ok) return;
    expect(paraphrased.factual_authorization_trace.some((entry) => entry.status === "REJECTED")).toBe(true);
  });
});

describe("non-regressions (§30–§32) and RI-D at V10 (§26)", () => {
  it("M1-style fabricated quotes still fail factual authorization", () => {
    const checked = canonicalize(wire({
      factual_assessment: { claims: [quoteClaim('Alice says: "The code review deadline is Thursday."')] },
      response_semantics: { kind: "PRIMARY_FACT", claim_index: 0 }
    }));
    expect(checked.ok).toBe(false);
    if (checked.ok) return;
    expect(checked.factual_authorization_trace.some((entry) => entry.status === "REJECTED")).toBe(true);
  });

  it("forbidden rationale still drops to null while the turn survives", () => {
    const proposal = canonicalizeOk(wire({
      subjective_selection: { kind: "SUBJECTIVE_SELECTION", stance: "I would rather help.", subjective_rationale: "I have enough capacity." },
      response_semantics: { kind: "PRIMARY_STANCE" }
    }));
    const selection = proposal.subjective_selection;
    expect(selection.kind).toBe("SUBJECTIVE_SELECTION");
    if (selection.kind !== "SUBJECTIVE_SELECTION") return;
    expect(selection.subjective_rationale).toBeNull();
  });

  it("two V10 inputs differing only in request id serialize identical model-facing bytes", async () => {
    const proposal = canonicalizeOk(wire());
    const first = await buildLanguageRealizationInputV10({ ...buildRequest(proposal), response_request_id: "req-alpha" as never });
    const second = await buildLanguageRealizationInputV10({ ...buildRequest(proposal), response_request_id: "req-beta" as never });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(modelFacingLanguagePayloadV10(first.input)).toEqual(modelFacingLanguagePayloadV10(second.input));
    expect(await deriveModelFacingLanguagePayloadHashV10(first.input)).toBe(await deriveModelFacingLanguagePayloadHashV10(second.input));
    const requests: ModelTransportRequestV0[] = [];
    const transport: ModelTransportV0 = {
      complete: async (request: ModelTransportRequestV0) => {
        requests.push(request);
        return { model: "recording", content: JSON.stringify({ schema_version: "language-realization-semantic-draft-v1", text: "Sure.", evidence_refs: [] }) };
      }
    } as never;
    const provider = new LanguageRealizationProviderV0(transport as never);
    await provider.realize({ input: first.input as never, input_hash: first.input_hash, lawful_evidence_refs: new Set([OBS]) as never });
    await provider.realize({ input: second.input as never, input_hash: second.input_hash, lawful_evidence_refs: new Set([OBS]) as never });
    const userOf = (request: ModelTransportRequestV0) => request.messages.find((message) => message.role === "user")?.content ?? "";
    expect(userOf(requests[0] as ModelTransportRequestV0)).toBe(userOf(requests[1] as ModelTransportRequestV0));
    expect(userOf(requests[0] as ModelTransportRequestV0)).toContain("LANGUAGE REALIZATION INPUT V10");
    expect(userOf(requests[0] as ModelTransportRequestV0)).not.toContain("req-alpha");
  });
});
