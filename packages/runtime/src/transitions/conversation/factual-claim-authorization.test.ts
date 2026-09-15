/** Zero-model factual authority and V7 atomicity regressions. */
import { describe, expect, it } from "vitest";
import type { HashV1 } from "@characteros-next/subject-core";
import type { CognitiveContextProjectionV2 } from "../cognition-action/types.js";
import {
  FACTUAL_CLAIM_AUTHORIZATION_POLICY_VERSION_V0,
  HOST_VERIFIABLE_DERIVATION_OPERATIONS_V0,
  authorizeFactualClaimV1
} from "./factual-claim-authorization.js";
import {
  buildSourceHandleMapV0,
  canonicalizeConversationCognitionModelOutputV6,
  canonicalizeConversationCognitionModelOutputV7,
  deriveConversationCognitionProposalHashV7
} from "./conversation-cognition-proposal.js";
import {
  CONVERSATION_COGNITION_SYSTEM_PROMPT_V6
} from "../../providers/behavior/conversation-cognition-provider-v6.js";
import {
  CONVERSATION_COGNITION_SYSTEM_PROMPT_V7,
  ConversationCognitionProviderV7,
  ConversationCognitionRejectionErrorV7
} from "../../providers/behavior/conversation-cognition-provider-v7.js";

const OBS = "observation:o-session-t2";
const HASH = `sha256:${"a".repeat(64)}` as HashV1;
const SCENE = [
  "A free 30-minute slot is available, with no conflicting commitments.",
  "The optional review would take 20 minutes.",
  "17 + 25",
  "Reverse the characters in the token R8K2.",
  "A token is MATCH iff its first and last characters are identical.",
  "Classify radar."
].join(" ");

function projection(): CognitiveContextProjectionV2 {
  return {
    schema_version: "cognitive-context-projection-v2",
    subject_id: "subject-factual-authority" as never,
    current_logical_time: 3 as never,
    state_revision: 3 as never,
    traits_dimensions: {},
    personality_dimensions: {},
    personality_disposition: {},
    canonical_affect: { schema_version: "canonical-affect-cognition-projection-v0", valence: 0, activation: 0.5 } as never,
    regulation: { energy: 1, stress: 0, arousal: 0.5, fatigue: 0 },
    context: {
      scene: SCENE,
      task: "Answer.",
      focus_refs: [],
      active_entity_refs: [],
      environment_refs: [],
      current_observation_ref: OBS as never
    },
    memory_working_refs: [],
    recent_retrieval_refs: [],
    belief_item_count: 0,
    belief_items: [],
    relationship_counterpart_count: 0,
    relationship_dimensions: [],
    interaction_familiarity: [],
    interaction_familiarity_cognition_influences: [],
    allowed_actions: [],
    projection_hash: HASH,
    factual_memory_evidence: { entries: [] }
  } as unknown as CognitiveContextProjectionV2;
}

function sourceTexts(ref: string): readonly string[] | null {
  return ref === OBS ? [SCENE] : null;
}

function baseWire(claims: readonly unknown[], rationale: string | null = null) {
  const handle = buildSourceHandleMapV0(projection()).factualSourceHandles[0] ?? "F1";
  return {
    schema_version: "conversation-cognition-proposal-v7",
    factual_assessment: { claims },
    cognition: {
      schema_version: "cognition-proposal-v0",
      reasoning_summary: "bounded response planning",
      relevant_memory_handles: [],
      considered_handles: [handle],
      current_intent: "state the authorized content",
      confidence: 1,
      uncertainty: 0,
      action_intent: null,
      evidence_handles: [handle]
    },
    subjective_selection: {
      kind: "SUBJECTIVE_SELECTION",
      stance: "I would volunteer for the review.",
      subjective_rationale: rationale
    },
    communication_directive: { kind: "REALIZE_CURRENT_INTENT" },
    clarification_basis: null
  };
}

function sourceQuote(text: string) {
  return { kind: "SOURCE_QUOTE", text, source_handles: ["F1"] };
}

function arithmetic(result = 42) {
  return {
    kind: "HOST_VERIFIABLE_DERIVATION",
    operation: "INTEGER_ARITHMETIC",
    source_handles: ["F1"],
    derivation: {
      source_expression: "17 + 25",
      operands: { left: 17, operator: "ADD", right: 25 },
      claimed_result: result
    }
  };
}

describe("production factual authorization policy v0", () => {
  it("exposes only the workload-justified closed registry", () => {
    expect(FACTUAL_CLAIM_AUTHORIZATION_POLICY_VERSION_V0).toBe("factual-claim-authorization-policy-v0");
    expect(HOST_VERIFIABLE_DERIVATION_OPERATIONS_V0).toEqual([
      "INTEGER_ARITHMETIC",
      "STRING_REVERSE",
      "RULE_CLASSIFICATION"
    ]);
  });

  it("authorizes exact SOURCE_QUOTE and rejects case, substring, and source mismatches", () => {
    const exact = authorizeFactualClaimV1({ kind: "SOURCE_QUOTE", text: "free 30-minute slot", source_refs: [OBS] }, sourceTexts as never);
    expect(exact.status).toBe("AUTHORIZED_SOURCE_QUOTE");
    for (const claim of [
      { kind: "SOURCE_QUOTE", text: "Free 30-minute slot", source_refs: [OBS] },
      { kind: "SOURCE_QUOTE", text: "the subject has capacity", source_refs: [OBS] },
      { kind: "SOURCE_QUOTE", text: "free 30-minute slot", source_refs: ["observation:o-other"] }
    ]) {
      const checked = authorizeFactualClaimV1(claim, sourceTexts as never);
      expect(checked.status).toBe("REJECTED");
      if (checked.status === "REJECTED") expect(checked.code).toBe("REJECTED_SOURCE_BINDING");
    }
  });

  it("host-recomputes every admitted operation and emits canonical text", () => {
    const cases = [
      {
        claim: { ...arithmetic(), source_refs: [OBS], source_handles: undefined },
        text: "17 + 25 = 42."
      },
      {
        claim: {
          kind: "HOST_VERIFIABLE_DERIVATION", operation: "STRING_REVERSE", source_refs: [OBS],
          derivation: { source_instruction: "Reverse the characters in the token R8K2.", input: "R8K2", claimed_result: "2K8R" }
        },
        text: 'The reverse of "R8K2" is "2K8R".'
      },
      {
        claim: {
          kind: "HOST_VERIFIABLE_DERIVATION", operation: "RULE_CLASSIFICATION", source_refs: [OBS],
          derivation: { source_rule: "A token is MATCH iff its first and last characters are identical.", source_query: "Classify radar.", claimed_result: "MATCH" }
        },
        text: 'The supplied first/last-character rule classifies "radar" as "MATCH".'
      }
    ];
    // Remove the deliberately undefined wire-only key from the first policy payload.
    delete (cases[0]?.claim as Record<string, unknown>)["source_handles"];
    for (const { claim, text } of cases) {
      const checked = authorizeFactualClaimV1(claim, sourceTexts as never);
      expect(checked.status).toBe("AUTHORIZED_DERIVED_RESULT");
      if (checked.status === "AUTHORIZED_DERIVED_RESULT") expect(checked.authoritative_claim.text).toBe(text);
    }
  });

  it("rejects wrong results, malformed inputs, unsupported/ambiguous operations, and free-form authority text", () => {
    const bad = [
      { ...arithmetic(41), source_refs: [OBS], source_handles: undefined },
      {
        kind: "HOST_VERIFIABLE_DERIVATION", operation: "INTEGER_ARITHMETIC", source_refs: [OBS],
        derivation: { source_expression: "17 + 25", operands: { left: 17, operator: "ADD" }, claimed_result: 42 }
      },
      { kind: "HOST_VERIFIABLE_DERIVATION", operation: "SEMANTIC_INFERENCE", source_refs: [OBS], derivation: {} },
      { kind: "HOST_VERIFIABLE_DERIVATION", operation: "DERIVE", source_refs: [OBS], derivation: {} },
      {
        kind: "HOST_VERIFIABLE_DERIVATION", operation: "INTEGER_ARITHMETIC", source_refs: [OBS],
        derivation: { source_expression: "17 + 25", operands: { left: 17, operator: "ADD", right: 25 }, claimed_result: 42 },
        text: "Because there is capacity, either choice is permitted."
      }
    ];
    delete (bad[0] as Record<string, unknown>)["source_handles"];
    for (const claim of bad) expect(authorizeFactualClaimV1(claim, sourceTexts as never).status).toBe("REJECTED");
  });

  it("fails wrong result, wrong source, and malformed input for every admitted operation", () => {
    const valid = [
      {
        kind: "HOST_VERIFIABLE_DERIVATION", operation: "INTEGER_ARITHMETIC", source_refs: [OBS],
        derivation: { source_expression: "17 + 25", operands: { left: 17, operator: "ADD", right: 25 }, claimed_result: 42 }
      },
      {
        kind: "HOST_VERIFIABLE_DERIVATION", operation: "STRING_REVERSE", source_refs: [OBS],
        derivation: { source_instruction: "Reverse the characters in the token R8K2.", input: "R8K2", claimed_result: "2K8R" }
      },
      {
        kind: "HOST_VERIFIABLE_DERIVATION", operation: "RULE_CLASSIFICATION", source_refs: [OBS],
        derivation: { source_rule: "A token is MATCH iff its first and last characters are identical.", source_query: "Classify radar.", claimed_result: "MATCH" }
      }
    ] as const;
    for (const claim of valid) {
      expect(authorizeFactualClaimV1({ ...claim, source_refs: ["observation:o-other"] }, sourceTexts as never).status).toBe("REJECTED");
    }
    const wrongResults = [
      { ...valid[0], derivation: { ...valid[0].derivation, claimed_result: 41 } },
      { ...valid[1], derivation: { ...valid[1].derivation, claimed_result: "R8K2" } },
      { ...valid[2], derivation: { ...valid[2].derivation, claimed_result: "OTHER" } }
    ];
    for (const claim of wrongResults) {
      const checked = authorizeFactualClaimV1(claim, sourceTexts as never);
      expect(checked.status).toBe("REJECTED");
      if (checked.status === "REJECTED") expect(checked.code).toBe("REJECTED_DERIVATION_RESULT_MISMATCH");
    }
    const malformed = [
      { ...valid[0], derivation: { source_expression: "17 + 25", operands: { left: 17, operator: "ADD" }, claimed_result: 42 } },
      { ...valid[1], derivation: { source_instruction: "Reverse the token somehow.", input: "R8K2", claimed_result: "2K8R" } },
      { ...valid[2], derivation: { source_rule: "Use common sense.", source_query: "Classify radar.", claimed_result: "MATCH" } }
    ];
    for (const claim of malformed) {
      const checked = authorizeFactualClaimV1(claim, sourceTexts as never);
      expect(checked.status).toBe("REJECTED");
      if (checked.status === "REJECTED") expect(checked.code).toBe("REJECTED_DERIVATION_INPUT");
    }
  });
});

describe("V7 atomic authoritative transaction", () => {
  it("rejects exact R1 free-form DERIVED_RESULT despite lawful provenance", () => {
    const rawClaim = {
      kind: "DERIVED_RESULT",
      text: "Because the task is optional and the subject has capacity, the facts permit either volunteering or declining.",
      source_handles: ["F1"]
    };
    const checked = canonicalizeConversationCognitionModelOutputV7(baseWire([rawClaim]), projection(), HASH);
    expect(checked.ok).toBe(false);
    expect("proposal" in checked).toBe(false);
    expect(checked.factual_authorization_trace).toHaveLength(1);
    expect(checked.factual_authorization_trace[0]).toMatchObject({
      status: "REJECTED",
      rejection_code: "REJECTED_UNSUPPORTED_CLAIM_KIND",
      claim_kind: "DERIVED_RESULT",
      canonical_source_refs: [OBS]
    });
  });

  it("rejects the whole proposal when one of four facts is unauthorized", () => {
    const checked = canonicalizeConversationCognitionModelOutputV7(baseWire([
      sourceQuote("free 30-minute slot"),
      sourceQuote("no conflicting commitments"),
      sourceQuote("optional review would take 20 minutes"),
      { kind: "DERIVED_RESULT", text: "The subject has capacity.", source_handles: ["F1"] }
    ], "I prefer to help with the review."), projection(), HASH);
    expect(checked.ok).toBe(false);
    expect("proposal" in checked).toBe(false);
    expect(checked.factual_authorization_trace.at(-1)?.rejection_code).toBe("REJECTED_UNSUPPORTED_CLAIM_KIND");
  });

  it("keeps rationale rejection field-local after all authoritative facts pass", async () => {
    const checked = canonicalizeConversationCognitionModelOutputV7(
      baseWire([sourceQuote("free 30-minute slot"), arithmetic()], "I prefer this while my energy is high."),
      projection(),
      HASH
    );
    expect(checked.ok).toBe(true);
    if (!checked.ok) return;
    expect(checked.proposal.factual_assessment.claims).toHaveLength(2);
    expect(checked.proposal.subjective_selection.kind).toBe("SUBJECTIVE_SELECTION");
    if (checked.proposal.subjective_selection.kind === "SUBJECTIVE_SELECTION") {
      expect(checked.proposal.subjective_selection.stance).toBe("I would volunteer for the review.");
      expect(checked.proposal.subjective_selection.subjective_rationale).toBeNull();
    }
    await expect(deriveConversationCognitionProposalHashV7(checked.proposal)).resolves.toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("rejects unadvertised and unbound sources before authority", () => {
    const unknown = canonicalizeConversationCognitionModelOutputV7(baseWire([
      { kind: "SOURCE_QUOTE", text: "free 30-minute slot", source_handles: ["F99"] }
    ]), projection(), HASH);
    expect(unknown.ok).toBe(false);

    const unboundWire = baseWire([sourceQuote("free 30-minute slot")]);
    (unboundWire.cognition as Record<string, unknown>)["evidence_handles"] = [];
    const unbound = canonicalizeConversationCognitionModelOutputV7(unboundWire, projection(), HASH);
    expect(unbound.ok).toBe(false);
    expect(unbound.factual_authorization_trace[0]?.rejection_code).toBe("REJECTED_SOURCE_BINDING");
  });

  it("retains historical V6 DERIVED_RESULT semantics without reinterpretation", () => {
    const v6 = { ...baseWire([]), schema_version: "conversation-cognition-proposal-v6",
      factual_assessment: { claims: [{ kind: "DERIVED_RESULT", text: "The subject has capacity.", source_handles: ["F1"] }] }
    };
    expect(canonicalizeConversationCognitionModelOutputV6(v6, projection(), HASH).ok).toBe(true);
  });

  it("changes only mechanical V7 protocol/schema advertising in the cognition prompt", () => {
    expect(CONVERSATION_COGNITION_SYSTEM_PROMPT_V7).toContain("conversation-cognition-proposal-v7");
    expect(CONVERSATION_COGNITION_SYSTEM_PROMPT_V7).toContain("INTEGER_ARITHMETIC");
    expect(CONVERSATION_COGNITION_SYSTEM_PROMPT_V7).toContain("STRING_REVERSE");
    expect(CONVERSATION_COGNITION_SYSTEM_PROMPT_V7).toContain("RULE_CLASSIFICATION");
    expect(CONVERSATION_COGNITION_SYSTEM_PROMPT_V7).not.toContain("availability/capacity");
    expect(CONVERSATION_COGNITION_SYSTEM_PROMPT_V7).not.toContain("please don't infer capacity");
    expect(CONVERSATION_COGNITION_SYSTEM_PROMPT_V6).toContain("DERIVED_RESULT");
  });

  it("preserves raw wire claim/handles in provider diagnostics and performs no fallback call", async () => {
    const rawClaim = {
      kind: "DERIVED_RESULT",
      text: "Because the task is optional and the subject has capacity, the facts permit either volunteering or declining.",
      source_handles: ["F1"]
    };
    let calls = 0;
    const provider = new ConversationCognitionProviderV7({
      complete: async () => {
        calls += 1;
        return { model: "fake", content: JSON.stringify(baseWire([rawClaim])) };
      }
    } as never);
    await expect(provider.propose(projection())).rejects.toBeInstanceOf(ConversationCognitionRejectionErrorV7);
    expect(calls).toBe(1);
    expect(provider.lastConversationProposal).toBeNull();
    expect(provider.lastDirective).toBeNull();
    expect(provider.lastFactualAuthorizationTrace[0]?.raw_claim).toEqual(rawClaim);
    expect(provider.lastFactualAuthorizationTrace[0]?.rejection_code).toBe("REJECTED_UNSUPPORTED_CLAIM_KIND");
  });
});
