/** Family C2 deterministic proposal/authority regressions. Zero model calls. */

import { describe, expect, it } from "vitest";
import type { CognitiveContextProjectionAnyVersion } from "../cognition-action/types.js";
import {
  FACTUAL_ASSESSMENT_CLAIM_TEXT_MAX_CODE_POINTS_V0,
  deriveConversationCognitionProposalHashV2,
  deriveConversationCognitionProposalHashV3,
  validateConversationCognitionProposalV2,
  validateConversationCognitionProposalV3
} from "./conversation-cognition-proposal.js";

const OBS = "observation:c2-current";
const HASH = `sha256:${"a".repeat(64)}`;

function projection(): CognitiveContextProjectionAnyVersion {
  return {
    schema_version: "cognitive-context-projection-v2",
    subject_id: "subject-c2",
    current_logical_time: 3,
    state_revision: 3,
    canonical_affect: { schema_version: "canonical-affect-cognition-projection-v0", valence: 0.6, activation: 0.5 },
    regulation: { energy: 1, stress: 0, arousal: 0.5, fatigue: 0 },
    context: {
      scene: "The printed code is K7. Add 17 and 25.",
      task: "State the code and the sum.",
      focus_refs: [],
      active_entity_refs: [],
      environment_refs: [],
      current_observation_ref: OBS
    },
    memory_working_refs: [],
    recent_retrieval_refs: [],
    belief_item_count: 0,
    belief_items: [],
    relationship_counterpart_count: 0,
    relationship_dimensions: [],
    interaction_familiarity: [],
    interaction_familiarity_cognition_influences: [],
    traits_dimensions: {},
    personality_dimensions: {},
    personality_disposition: {},
    allowed_actions: [],
    projection_hash: HASH
  } as unknown as CognitiveContextProjectionAnyVersion;
}

function cognition(intent = "The printed code is K7 and the sum is 42."): Record<string, unknown> {
  return {
    schema_version: "cognition-proposal-v0",
    projection_hash: HASH,
    reasoning_summary: "The observation supplies the code and operands.",
    relevant_memory_refs: [],
    considered_context_refs: [OBS],
    current_intent: intent,
    confidence: 0.9,
    uncertainty: 0.1,
    action_intent: null,
    evidence_refs: [OBS]
  };
}

function proposal(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema_version: "conversation-cognition-proposal-v3",
    factual_assessment: {
      claims: [
        { kind: "SOURCE_QUOTE", text: "K7", source_refs: [OBS] },
        { kind: "DERIVED_RESULT", text: "42", source_refs: [OBS] }
      ]
    },
    cognition: cognition(),
    communication_directive: { kind: "REALIZE_CURRENT_INTENT" },
    clarification_basis: null,
    ...overrides
  };
}

describe("ConversationCognitionProposalV3 factual assessment", () => {
  it("accepts a valid SOURCE_QUOTE and DERIVED_RESULT with exact binding", () => {
    const checked = validateConversationCognitionProposalV3(proposal(), projection());
    expect(checked.ok).toBe(true);
    if (checked.ok) expect(checked.proposal.factual_assessment.claims.map((claim) => claim.text)).toEqual(["K7", "42"]);
  });

  it("rejects quote mismatch, illegal refs, empty/duplicate/unsorted refs, unknown kinds and fields", () => {
    const cases = [
      { kind: "SOURCE_QUOTE", text: "k7", source_refs: [OBS] },
      { kind: "SOURCE_QUOTE", text: "K7", source_refs: ["observation:other"] },
      { kind: "DERIVED_RESULT", text: "42", source_refs: [] },
      { kind: "DERIVED_RESULT", text: "42", source_refs: [OBS, OBS] },
      { kind: "GUESS", text: "42", source_refs: [OBS] },
      { kind: "DERIVED_RESULT", text: "42", source_refs: [OBS], extra: true }
    ];
    for (const claim of cases) {
      expect(validateConversationCognitionProposalV3(
        proposal({ factual_assessment: { claims: [claim] } }),
        projection()
      ).ok).toBe(false);
    }
  });

  it("rejects more than 8 claims, oversized/non-NFC text and unknown assessment fields", () => {
    const claim = { kind: "DERIVED_RESULT", text: "42", source_refs: [OBS] };
    expect(validateConversationCognitionProposalV3(proposal({ factual_assessment: { claims: Array(9).fill(claim) } }), projection()).ok).toBe(false);
    expect(validateConversationCognitionProposalV3(proposal({ factual_assessment: { claims: [{ ...claim, text: "x".repeat(FACTUAL_ASSESSMENT_CLAIM_TEXT_MAX_CODE_POINTS_V0 + 1) }] } }), projection()).ok).toBe(false);
    expect(validateConversationCognitionProposalV3(proposal({ factual_assessment: { claims: [{ ...claim, text: "e\u0301" }] } }), projection()).ok).toBe(false);
    expect(validateConversationCognitionProposalV3(proposal({ factual_assessment: { claims: [claim], extra: true } }), projection()).ok).toBe(false);
  });

  it("requires every factual source to bind into cognition considered/evidence refs", () => {
    expect(validateConversationCognitionProposalV3(proposal({ cognition: { ...cognition(), considered_context_refs: [] } }), projection()).ok).toBe(false);
    expect(validateConversationCognitionProposalV3(proposal({ cognition: { ...cognition(), evidence_refs: [] } }), projection()).ok).toBe(false);
  });
});

describe("ConversationCognitionProposalV3 selected intent and clarification", () => {
  it.each([
    "I accept the invitation.",
    "I decline the invitation.",
    "I prefer option A.",
    "I prefer option B.",
    "I will attend if the time remains available."
  ])("accepts an actually selected intent: %s", (intent) => {
    expect(validateConversationCognitionProposalV3(proposal({ cognition: cognition(intent) }), projection()).ok).toBe(true);
  });

  it.each(["express a preference", "decide whether I want to participate", "consider whether to try it"])(
    "rejects unresolved meta-intent: %s",
    (intent) => expect(validateConversationCognitionProposalV3(proposal({ cognition: cognition(intent) }), projection()).ok).toBe(false)
  );

  it("cross-checks CLARIFY current observation against authority and considered refs", () => {
    const clarify = proposal({
      factual_assessment: { claims: [] },
      cognition: { ...cognition("ask for the required identifier"), evidence_refs: [], considered_context_refs: [OBS] },
      communication_directive: { kind: "CLARIFY_MISSING_CONTEXT" },
      clarification_basis: { current_observation_ref: OBS, missing_information: "the required identifier", needed_for: "the requested lookup" }
    });
    expect(validateConversationCognitionProposalV3(clarify, projection()).ok).toBe(true);
    expect(validateConversationCognitionProposalV3({ ...clarify, cognition: { ...(clarify["cognition"] as object), considered_context_refs: [] } }, projection()).ok).toBe(false);
    expect(validateConversationCognitionProposalV3({ ...clarify, clarification_basis: { ...(clarify["clarification_basis"] as object), current_observation_ref: "observation:other" } }, projection()).ok).toBe(false);
  });

  it("uses a distinct V3 hash domain covering factual assessment and null", async () => {
    const checked = validateConversationCognitionProposalV3(proposal(), projection());
    if (!checked.ok) throw new Error(checked.detail);
    const first = await deriveConversationCognitionProposalHashV3(checked.proposal);
    const changed = await deriveConversationCognitionProposalHashV3({
      ...checked.proposal,
      factual_assessment: { claims: [{ kind: "DERIVED_RESULT", text: "43", source_refs: [OBS] as never }] }
    });
    const v2 = await deriveConversationCognitionProposalHashV2({
      schema_version: "conversation-cognition-proposal-v2",
      cognition: checked.proposal.cognition,
      communication_directive: checked.proposal.communication_directive,
      clarification_basis: null
    });
    expect(first).not.toBe(changed);
    expect(first).not.toBe(v2);
    expect(validateConversationCognitionProposalV2(proposal({ schema_version: "conversation-cognition-proposal-v2" }), projection()).ok).toBe(false);
  });
});
