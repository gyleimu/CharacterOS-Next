/**
 * Family C3 deterministic proposal/authority regressions. Zero model calls.
 *
 * C3 makes the subject's selection EXPLICIT (`subjective_choice`) and moves the
 * projection hash OUT of model output (host-bound). These tests pin both
 * properties structurally, including the exact failure that motivated C3: the
 * directive-enum echo that previously flowed to Language as a "selected intent".
 */

import { describe, expect, it } from "vitest";
import type { HashV1 } from "@characteros-next/subject-core";
import type { CognitiveContextProjectionAnyVersion } from "../cognition-action/types.js";
import {
  COGNITION_SEMANTIC_KEYS_V0,
  SUBJECTIVE_CHOICE_STANCE_MAX_CODE_POINTS_V0,
  deriveConversationCognitionProposalHashV3,
  deriveConversationCognitionProposalHashV4,
  validateConversationCognitionProposalV3,
  validateConversationCognitionProposalV4,
  validateHostBoundConversationCognitionProposalV4,
  validateSubjectiveChoiceV0
} from "./conversation-cognition-proposal.js";

const OBS = "observation:c3-current";
const HASH = `sha256:${"a".repeat(64)}` as HashV1;

function projection(projectionHash: HashV1 = HASH): CognitiveContextProjectionAnyVersion {
  return {
    schema_version: "cognitive-context-projection-v2",
    subject_id: "subject-c3",
    current_logical_time: 3,
    state_revision: 3,
    canonical_affect: { schema_version: "canonical-affect-cognition-projection-v0", valence: 0.6, activation: 0.5 },
    regulation: { energy: 1, stress: 0, arousal: 0.5, fatigue: 0 },
    context: {
      scene: "A teammate asks whether you would volunteer for the weekend shift.",
      task: "Decide whether to volunteer.",
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
    projection_hash: projectionHash
  } as unknown as CognitiveContextProjectionAnyVersion;
}

/** Model-shaped cognition: semantics only, NO projection_hash (host-owned). */
function semanticCognition(intent: string | null = "summarize the request"): Record<string, unknown> {
  return {
    schema_version: "cognition-proposal-v0",
    reasoning_summary: "The teammate asks for a weekend commitment.",
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
    schema_version: "conversation-cognition-proposal-v4",
    factual_assessment: { claims: [{ kind: "SOURCE_QUOTE", text: "weekend shift", source_refs: [OBS] }] },
    cognition: semanticCognition(),
    subjective_choice: { stance: "I would volunteer." },
    communication_directive: { kind: "REALIZE_CURRENT_INTENT" },
    clarification_basis: null,
    ...overrides
  };
}

function clarifyProposal(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return proposal({
    factual_assessment: { claims: [] },
    cognition: { ...semanticCognition("ask for the required identifier"), evidence_refs: [], considered_context_refs: [OBS] },
    subjective_choice: null,
    communication_directive: { kind: "CLARIFY_MISSING_CONTEXT" },
    clarification_basis: {
      current_observation_ref: OBS,
      missing_information: "the required identifier",
      needed_for: "the requested lookup"
    },
    ...overrides
  });
}

describe("SubjectiveChoiceV0 structural stance validation", () => {
  it("accepts selected stances including a conditional one that states its condition", () => {
    for (const stance of [
      "I would volunteer.",
      "I would keep the current approach and not raise the price.",
      "I would volunteer if the deadline moves to Friday."
    ]) {
      const checked = validateSubjectiveChoiceV0({ stance });
      expect(checked.ok).toBe(true);
      if (checked.ok) expect(checked.choice.stance).toBe(stance);
    }
  });

  it("rejects the exact C2 enum-copy failure in either directive token and any case", () => {
    for (const stance of ["REALIZE_CURRENT_INTENT", "realize_current_intent", "Clarify_Missing_Context", " CLARIFY_MISSING_CONTEXT "]) {
      const checked = validateSubjectiveChoiceV0({ stance });
      expect(checked.ok).toBe(false);
      if (!checked.ok) expect(checked.detail).toContain("directive enum echo");
    }
  });

  it("rejects placeholders that defer the choice instead of making it", () => {
    for (const stance of [
      "express a preference",
      "Express my preference about volunteering",
      "decide whether I want to participate",
      "consider whether to try it",
      "choose an option",
      "select an option from the list"
    ]) {
      const checked = validateSubjectiveChoiceV0({ stance });
      expect(checked.ok).toBe(false);
      if (!checked.ok) expect(checked.detail).toContain("states no selected choice");
    }
  });

  it("rejects empty, whitespace, oversized, non-NFC, non-string, unknown-key and non-object stances", () => {
    expect(validateSubjectiveChoiceV0({ stance: "" }).ok).toBe(false);
    expect(validateSubjectiveChoiceV0({ stance: "   " }).ok).toBe(false);
    expect(validateSubjectiveChoiceV0({ stance: "x".repeat(SUBJECTIVE_CHOICE_STANCE_MAX_CODE_POINTS_V0 + 1) }).ok).toBe(false);
    expect(validateSubjectiveChoiceV0({ stance: "e\u0301" }).ok).toBe(false);
    expect(validateSubjectiveChoiceV0({ stance: 7 }).ok).toBe(false);
    expect(validateSubjectiveChoiceV0({ stance: "I would volunteer.", reason: "because" }).ok).toBe(false);
    expect(validateSubjectiveChoiceV0("I would volunteer.").ok).toBe(false);
    expect(validateSubjectiveChoiceV0(null).ok).toBe(false);
  });

  it("accepts a stance exactly at the code-point limit", () => {
    expect(validateSubjectiveChoiceV0({ stance: "x".repeat(SUBJECTIVE_CHOICE_STANCE_MAX_CODE_POINTS_V0) }).ok).toBe(true);
  });
});

describe("ConversationCognitionProposalV4 host-bound identity", () => {
  it("accepts an explicit choice and a null-choice factual turn", () => {
    const selected = validateConversationCognitionProposalV4(proposal(), projection(), HASH);
    expect(selected.ok).toBe(true);
    if (selected.ok) expect(selected.proposal.subjective_choice).toEqual({ stance: "I would volunteer." });

    const factual = validateConversationCognitionProposalV4(
      proposal({ subjective_choice: null, cognition: semanticCognition("state the sum") }),
      projection(),
      HASH
    );
    expect(factual.ok).toBe(true);
    if (factual.ok) expect(factual.proposal.subjective_choice).toBeNull();
  });

  it("rejects a model-emitted projection_hash inside cognition as an unknown key", () => {
    const withHash = proposal({ cognition: { ...semanticCognition(), projection_hash: HASH } });
    const checked = validateConversationCognitionProposalV4(withHash, projection(), HASH);
    expect(checked.ok).toBe(false);
    if (!checked.ok) expect(checked.detail).toContain("conversation proposal.cognition");
    // The model shape and the host-bound shape are disjoint key sets.
    expect(COGNITION_SEMANTIC_KEYS_V0).not.toContain("projection_hash");
  });

  it("injects the authoritative hash into the returned cognition, not the model's", () => {
    const other = `sha256:${"b".repeat(64)}` as HashV1;
    const checked = validateConversationCognitionProposalV4(proposal(), projection(other), other);
    expect(checked.ok).toBe(true);
    if (checked.ok) {
      expect(checked.proposal.cognition.projection_hash).toBe(other);
      expect(checked.proposal.cognition.current_intent).toBe("summarize the request");
    }
  });

  it("rejects unknown outer keys, a missing subjective_choice, and a wrong schema version", () => {
    expect(validateConversationCognitionProposalV4(proposal({ extra: true }), projection(), HASH).ok).toBe(false);
    const withoutChoice = proposal();
    delete withoutChoice["subjective_choice"];
    expect(validateConversationCognitionProposalV4(withoutChoice, projection(), HASH).ok).toBe(false);
    expect(validateConversationCognitionProposalV4(
      proposal({ schema_version: "conversation-cognition-proposal-v3" }),
      projection(),
      HASH
    ).ok).toBe(false);
  });

  it("keeps current_intent descriptive: a directive enum in it is not a selection and does not fail the turn", () => {
    // Under C3 current_intent carries no authority; the choice lives in
    // subjective_choice. A descriptive-only intent is legal.
    const checked = validateConversationCognitionProposalV4(
      proposal({ cognition: semanticCognition("reply with the volunteer decision") }),
      projection(),
      HASH
    );
    expect(checked.ok).toBe(true);
  });

  it("rejects a non-null action_intent", () => {
    const checked = validateConversationCognitionProposalV4(
      proposal({ cognition: { ...semanticCognition(), action_intent: "VOLUNTEER" } }),
      projection(),
      HASH
    );
    expect(checked.ok).toBe(false);
  });
});

describe("ConversationCognitionProposalV4 clarification boundary", () => {
  it("accepts a bound CLARIFY with exactly null choice", () => {
    const checked = validateConversationCognitionProposalV4(clarifyProposal(), projection(), HASH);
    expect(checked.ok).toBe(true);
    if (checked.ok) {
      expect(checked.proposal.subjective_choice).toBeNull();
      expect(checked.proposal.clarification_basis?.current_observation_ref).toBe(OBS);
    }
  });

  it("rejects CLARIFY that also declares a choice", () => {
    const checked = validateConversationCognitionProposalV4(
      clarifyProposal({ subjective_choice: { stance: "I would volunteer." } }),
      projection(),
      HASH
    );
    expect(checked.ok).toBe(false);
    if (!checked.ok) expect(checked.detail).toContain("CLARIFY requires exactly null");
  });

  it("rejects CLARIFY without a basis, with an unbound observation ref, or with the ref missing from considered_context_refs", () => {
    expect(validateConversationCognitionProposalV4(clarifyProposal({ clarification_basis: null }), projection(), HASH).ok).toBe(false);
    expect(validateConversationCognitionProposalV4(
      clarifyProposal({ clarification_basis: {
        current_observation_ref: "observation:other",
        missing_information: "the required identifier",
        needed_for: "the requested lookup"
      } }),
      projection(),
      HASH
    ).ok).toBe(false);
    expect(validateConversationCognitionProposalV4(
      clarifyProposal({ cognition: { ...semanticCognition("ask for the required identifier"), considered_context_refs: [], evidence_refs: [] } }),
      projection(),
      HASH
    ).ok).toBe(false);
  });

  it("rejects REALIZE with a non-null clarification basis", () => {
    const checked = validateConversationCognitionProposalV4(
      proposal({ clarification_basis: {
        current_observation_ref: OBS,
        missing_information: "the required identifier",
        needed_for: "the requested lookup"
      } }),
      projection(),
      HASH
    );
    expect(checked.ok).toBe(false);
    if (!checked.ok) expect(checked.detail).toContain("REALIZE requires exactly null");
  });
});

describe("ConversationCognitionProposalV4 hash domain", () => {
  it("is distinct from V3 and covers the stance (including null vs non-null)", async () => {
    const selected = validateConversationCognitionProposalV4(proposal(), projection(), HASH);
    if (!selected.ok) throw new Error(selected.detail);
    const factual = validateConversationCognitionProposalV4(proposal({ subjective_choice: null }), projection(), HASH);
    if (!factual.ok) throw new Error(factual.detail);
    const other = validateConversationCognitionProposalV4(
      proposal({ subjective_choice: { stance: "I would not volunteer." } }),
      projection(),
      HASH
    );
    if (!other.ok) throw new Error(other.detail);

    const selectedHash = await deriveConversationCognitionProposalHashV4(selected.proposal);
    expect(await deriveConversationCognitionProposalHashV4(factual.proposal)).not.toBe(selectedHash);
    expect(await deriveConversationCognitionProposalHashV4(other.proposal)).not.toBe(selectedHash);
    const v3 = await deriveConversationCognitionProposalHashV3({
      schema_version: "conversation-cognition-proposal-v3",
      factual_assessment: selected.proposal.factual_assessment,
      cognition: selected.proposal.cognition,
      communication_directive: selected.proposal.communication_directive,
      clarification_basis: null
    });
    expect(selectedHash).not.toBe(v3);
  });
});

describe("validateHostBoundConversationCognitionProposalV4", () => {
  it("accepts the host-bound proposal and rejects a swapped or tampered one", () => {
    const checked = validateConversationCognitionProposalV4(proposal(), projection(), HASH);
    if (!checked.ok) throw new Error(checked.detail);
    const rebound = validateHostBoundConversationCognitionProposalV4(checked.proposal, projection());
    expect(rebound.ok).toBe(true);
    if (rebound.ok) expect(rebound.proposal.subjective_choice).toEqual({ stance: "I would volunteer." });

    // A proposal validated against a different projection must not re-bind here.
    const other = `sha256:${"b".repeat(64)}` as HashV1;
    expect(validateHostBoundConversationCognitionProposalV4(checked.proposal, projection(other)).ok).toBe(false);

    // Raw model shape (no host-injected hash) is not a host-bound proposal.
    expect(validateHostBoundConversationCognitionProposalV4(proposal(), projection()).ok).toBe(false);

    // Tampered semantics still fail closed through the delegated validator.
    const tampered = {
      ...checked.proposal,
      subjective_choice: { stance: "REALIZE_CURRENT_INTENT" }
    };
    expect(validateHostBoundConversationCognitionProposalV4(tampered, projection()).ok).toBe(false);
  });

  it("still rejects a V3 proposal at the V4 boundary", () => {
    const v3 = validateConversationCognitionProposalV3({
      schema_version: "conversation-cognition-proposal-v3",
      factual_assessment: { claims: [] },
      cognition: { ...semanticCognition(), projection_hash: HASH },
      communication_directive: { kind: "REALIZE_CURRENT_INTENT" },
      clarification_basis: null
    }, projection());
    if (!v3.ok) throw new Error(v3.detail);
    expect(validateHostBoundConversationCognitionProposalV4(v3.proposal, projection()).ok).toBe(false);
  });
});
