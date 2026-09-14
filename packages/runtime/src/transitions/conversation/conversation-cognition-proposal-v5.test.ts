/**
 * Family C4 deterministic proposal/applicability regressions. Zero model calls.
 *
 * C4 replaces the implicit `null | {stance}` carrier with a tagged choice: the
 * applicability question gets a positive token (`NOT_APPLICABLE`), and the
 * subject-side reason gets a lawful non-factual slot (`subjective_rationale`).
 * These tests pin both, plus the unchanged factual-source authority.
 */

import { describe, expect, it } from "vitest";
import type { HashV1 } from "@characteros-next/subject-core";
import type { CognitiveContextProjectionAnyVersion } from "../cognition-action/types.js";
import {
  SUBJECTIVE_RATIONALE_MAX_CODE_POINTS_V1,
  deriveConversationCognitionProposalHashV4,
  deriveConversationCognitionProposalHashV5,
  validateConversationCognitionProposalV5,
  validateHostBoundConversationCognitionProposalV5,
  validateSubjectiveChoiceV1
} from "./conversation-cognition-proposal.js";

const OBS = "observation:c4-current";
const HASH = `sha256:${"a".repeat(64)}` as HashV1;

function projection(projectionHash: HashV1 = HASH): CognitiveContextProjectionAnyVersion {
  return {
    schema_version: "cognitive-context-projection-v2",
    subject_id: "subject-c4",
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
    schema_version: "conversation-cognition-proposal-v5",
    factual_assessment: { claims: [{ kind: "SOURCE_QUOTE", text: "weekend shift", source_refs: [OBS] }] },
    cognition: semanticCognition(),
    subjective_choice: { kind: "SELECTED", stance: "I would volunteer.", subjective_rationale: null },
    communication_directive: { kind: "REALIZE_CURRENT_INTENT" },
    clarification_basis: null,
    ...overrides
  };
}

function clarifyProposal(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return proposal({
    factual_assessment: { claims: [] },
    cognition: { ...semanticCognition("ask for the required identifier"), evidence_refs: [], considered_context_refs: [OBS] },
    subjective_choice: { kind: "NOT_APPLICABLE" },
    communication_directive: { kind: "CLARIFY_MISSING_CONTEXT" },
    clarification_basis: {
      current_observation_ref: OBS,
      missing_information: "the required identifier",
      needed_for: "the requested lookup"
    },
    ...overrides
  });
}

describe("SubjectiveChoiceV1 tagged applicability", () => {
  it("accepts the exact NOT_APPLICABLE shape and nothing more", () => {
    const checked = validateSubjectiveChoiceV1({ kind: "NOT_APPLICABLE" });
    expect(checked.ok).toBe(true);
    if (checked.ok) expect(checked.choice).toEqual({ kind: "NOT_APPLICABLE" });
    // The C4 branch that answers "no selection exists" structurally cannot carry a
    // stance: a plan-shaped sentence has nowhere to live here.
    expect(validateSubjectiveChoiceV1({ kind: "NOT_APPLICABLE", stance: "I would provide the calculated sum of 42." }).ok).toBe(false);
    expect(validateSubjectiveChoiceV1({ kind: "NOT_APPLICABLE", subjective_rationale: "I prefer to help." }).ok).toBe(false);
    expect(validateSubjectiveChoiceV1({ kind: "NOT_APPLICABLE", extra: true }).ok).toBe(false);
  });

  it("accepts SELECTED with a stance and a null or bounded rationale", () => {
    const withoutBasis = validateSubjectiveChoiceV1({ kind: "SELECTED", stance: "I would volunteer.", subjective_rationale: null });
    expect(withoutBasis.ok).toBe(true);
    if (withoutBasis.ok) expect(withoutBasis.choice).toEqual({ kind: "SELECTED", stance: "I would volunteer.", subjective_rationale: null });

    const withBasis = validateSubjectiveChoiceV1({
      kind: "SELECTED",
      stance: "I would stop now.",
      subjective_rationale: "I prefer not to spend more effort on an unmeasured improvement."
    });
    expect(withBasis.ok).toBe(true);
    if (withBasis.ok) {
      expect(withBasis.choice).toEqual({
        kind: "SELECTED",
        stance: "I would stop now.",
        subjective_rationale: "I prefer not to spend more effort on an unmeasured improvement."
      });
    }
  });

  it("requires the rationale key exactly (missing, empty, oversized, non-NFC and non-string are rejected)", () => {
    expect(validateSubjectiveChoiceV1({ kind: "SELECTED", stance: "I would volunteer." }).ok).toBe(false);
    expect(validateSubjectiveChoiceV1({ kind: "SELECTED", stance: "I would volunteer.", subjective_rationale: "" }).ok).toBe(false);
    expect(validateSubjectiveChoiceV1({ kind: "SELECTED", stance: "I would volunteer.", subjective_rationale: "   " }).ok).toBe(false);
    expect(validateSubjectiveChoiceV1({ kind: "SELECTED", stance: "I would volunteer.", subjective_rationale: "x".repeat(SUBJECTIVE_RATIONALE_MAX_CODE_POINTS_V1 + 1) }).ok).toBe(false);
    expect(validateSubjectiveChoiceV1({ kind: "SELECTED", stance: "I would volunteer.", subjective_rationale: "e\u0301" }).ok).toBe(false);
    expect(validateSubjectiveChoiceV1({ kind: "SELECTED", stance: "I would volunteer.", subjective_rationale: 7 }).ok).toBe(false);
    expect(validateSubjectiveChoiceV1({ kind: "SELECTED", stance: "I would volunteer.", subjective_rationale: null, extra: true }).ok).toBe(false);
    // A rationale exactly at the limit is lawful.
    expect(validateSubjectiveChoiceV1({ kind: "SELECTED", stance: "I would volunteer.", subjective_rationale: "x".repeat(SUBJECTIVE_RATIONALE_MAX_CODE_POINTS_V1) }).ok).toBe(true);
  });

  it("carries over the frozen stance rules", () => {
    for (const stance of ["REALIZE_CURRENT_INTENT", "realize_current_intent", "CLARIFY_MISSING_CONTEXT"]) {
      expect(validateSubjectiveChoiceV1({ kind: "SELECTED", stance, subjective_rationale: null }).ok).toBe(false);
    }
    for (const stance of ["express a preference", "decide whether I want to participate", "choose an option"]) {
      expect(validateSubjectiveChoiceV1({ kind: "SELECTED", stance, subjective_rationale: null }).ok).toBe(false);
    }
    expect(validateSubjectiveChoiceV1({ kind: "SELECTED", stance: "", subjective_rationale: null }).ok).toBe(false);
    expect(validateSubjectiveChoiceV1({ kind: "SELECTED", stance: "x".repeat(257), subjective_rationale: null }).ok).toBe(false);
    expect(validateSubjectiveChoiceV1({ kind: "SELECTED", stance: "I would volunteer.", subjective_rationale: "REALIZE_CURRENT_INTENT" }).ok).toBe(true);
  });

  it("rejects an unknown, missing or non-object tag", () => {
    expect(validateSubjectiveChoiceV1({ kind: "FACT_ONLY" }).ok).toBe(false);
    expect(validateSubjectiveChoiceV1({}).ok).toBe(false);
    expect(validateSubjectiveChoiceV1(null).ok).toBe(false);
    expect(validateSubjectiveChoiceV1("SELECTED").ok).toBe(false);
    // C4 has no implicit null carrier: absence of a selection is a positive token.
    expect(validateSubjectiveChoiceV1({ kind: "SELECTED", stance: null, subjective_rationale: null }).ok).toBe(false);
  });
});

describe("ConversationCognitionProposalV5 relations", () => {
  it("accepts the tagged choice on REALIZE and rejects the old null carrier", () => {
    expect(validateConversationCognitionProposalV5(proposal(), projection(), HASH).ok).toBe(true);
    expect(validateConversationCognitionProposalV5(
      proposal({ subjective_choice: { kind: "NOT_APPLICABLE" } }),
      projection(),
      HASH
    ).ok).toBe(true);
    // A C3-era `subjective_choice: null` is no longer a lawful carrier.
    expect(validateConversationCognitionProposalV5(proposal({ subjective_choice: null }), projection(), HASH).ok).toBe(false);
    // A C3-era untagged `{ stance }` is no longer a lawful carrier.
    expect(validateConversationCognitionProposalV5(proposal({ subjective_choice: { stance: "I would volunteer." } }), projection(), HASH).ok).toBe(false);
  });

  it("requires CLARIFY to be NOT_APPLICABLE and to keep its basis binding", () => {
    const lawful = validateConversationCognitionProposalV5(clarifyProposal(), projection(), HASH);
    expect(lawful.ok).toBe(true);
    if (lawful.ok) {
      expect(lawful.proposal.subjective_choice).toEqual({ kind: "NOT_APPLICABLE" });
      expect(lawful.proposal.clarification_basis?.current_observation_ref).toBe(OBS);
    }
    const selected = validateConversationCognitionProposalV5(
      clarifyProposal({ subjective_choice: { kind: "SELECTED", stance: "I would volunteer.", subjective_rationale: null } }),
      projection(),
      HASH
    );
    expect(selected.ok).toBe(false);
    if (!selected.ok) expect(selected.detail).toContain("CLARIFY requires NOT_APPLICABLE");
    expect(validateConversationCognitionProposalV5(clarifyProposal({ clarification_basis: null }), projection(), HASH).ok).toBe(false);
    expect(validateConversationCognitionProposalV5(proposal({ clarification_basis: { current_observation_ref: OBS, missing_information: "x", needed_for: "y" } }), projection(), HASH).ok).toBe(false);
  });

  it("rejects a model-emitted projection_hash and binds the authoritative one", () => {
    const withHash = proposal({ cognition: { ...semanticCognition(), projection_hash: HASH } });
    const checked = validateConversationCognitionProposalV5(withHash, projection(), HASH);
    expect(checked.ok).toBe(false);
    if (!checked.ok) expect(checked.detail).toContain("conversation proposal.cognition");
    const other = `sha256:${"b".repeat(64)}` as HashV1;
    const rebound = validateConversationCognitionProposalV5(proposal(), projection(other), other);
    expect(rebound.ok).toBe(true);
    if (rebound.ok) expect(rebound.proposal.cognition.projection_hash).toBe(other);
  });

  it("still rejects subject, entity and environment refs as factual sources", () => {
    for (const ref of ["subject:subject-c4", "entity:alice", "environment:room-1"]) {
      const checked = validateConversationCognitionProposalV5(
        proposal({ factual_assessment: { claims: [{ kind: "DERIVED_RESULT", text: "a fact", source_refs: [ref] }] } }),
        projection(),
        HASH
      );
      expect(checked.ok).toBe(false);
      if (!checked.ok) expect(checked.detail).toContain("not a lawful FACTUAL SOURCE REF");
    }
  });

  it("uses a distinct C4 hash domain covering the tag and the rationale", async () => {
    const selected = validateConversationCognitionProposalV5(proposal(), projection(), HASH);
    const notApplicable = validateConversationCognitionProposalV5(proposal({ subjective_choice: { kind: "NOT_APPLICABLE" } }), projection(), HASH);
    const withBasis = validateConversationCognitionProposalV5(
      proposal({ subjective_choice: { kind: "SELECTED", stance: "I would volunteer.", subjective_rationale: "I prefer to help." } }),
      projection(),
      HASH
    );
    if (!selected.ok || !notApplicable.ok || !withBasis.ok) throw new Error("fixtures must validate");
    const selectedHash = await deriveConversationCognitionProposalHashV5(selected.proposal);
    expect(await deriveConversationCognitionProposalHashV5(notApplicable.proposal)).not.toBe(selectedHash);
    expect(await deriveConversationCognitionProposalHashV5(withBasis.proposal)).not.toBe(selectedHash);
    const v4 = await deriveConversationCognitionProposalHashV4({
      schema_version: "conversation-cognition-proposal-v4",
      factual_assessment: selected.proposal.factual_assessment,
      cognition: selected.proposal.cognition,
      subjective_choice: { stance: "I would volunteer." },
      communication_directive: selected.proposal.communication_directive,
      clarification_basis: null
    });
    expect(selectedHash).not.toBe(v4);
  });
});

describe("validateHostBoundConversationCognitionProposalV5", () => {
  it("accepts the host-bound proposal and rejects swapped, raw or tampered shapes", () => {
    const checked = validateConversationCognitionProposalV5(proposal(), projection(), HASH);
    if (!checked.ok) throw new Error(checked.detail);
    expect(validateHostBoundConversationCognitionProposalV5(checked.proposal, projection()).ok).toBe(true);
    const other = `sha256:${"b".repeat(64)}` as HashV1;
    expect(validateHostBoundConversationCognitionProposalV5(checked.proposal, projection(other)).ok).toBe(false);
    expect(validateHostBoundConversationCognitionProposalV5(proposal(), projection()).ok).toBe(false);
    expect(validateHostBoundConversationCognitionProposalV5(
      { ...checked.proposal, subjective_choice: { kind: "SELECTED", stance: "REALIZE_CURRENT_INTENT", subjective_rationale: null } },
      projection()
    ).ok).toBe(false);
  });
});
