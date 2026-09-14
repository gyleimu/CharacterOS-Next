/**
 * C4.2 semantic-policy regressions (zero model calls): the cognition prompt must
 * carry the latent-subject-state rationale policy and the grounded-stance
 * requirement, and the language prompt must carry the no-semantic-completion rule.
 */

import { describe, expect, it } from "vitest";
import type { HashV1 } from "@characteros-next/subject-core";
import type { ModelTransportRequestV0, ModelTransportV0 } from "../../transports/model-transport.js";
import type { CognitiveContextProjectionV2 } from "../../transitions/cognition-action/types.js";
import { CONVERSATION_COGNITION_SYSTEM_PROMPT_V5 } from "./conversation-cognition-provider-v5.js";
import { LanguageRealizationProviderV0 } from "./language-realization-provider.js";
import { validateConversationCognitionProposalV5 } from "../../transitions/conversation/conversation-cognition-proposal.js";
import { buildLanguageRealizationInputV6 } from "../../transitions/conversation/language-realization-input.js";

const OBS = "observation:c42";
const HASH = `sha256:${"a".repeat(64)}` as HashV1;

function projection(): CognitiveContextProjectionV2 {
  return {
    schema_version: "cognitive-context-projection-v2", subject_id: "subject-c42" as never,
    current_logical_time: 2 as never, state_revision: 2 as never, traits_dimensions: {}, personality_dimensions: {},
    personality_disposition: {}, canonical_affect: { schema_version: "canonical-affect-cognition-projection-v0", valence: 0, activation: 0.5 } as never,
    regulation: { energy: 1, stress: 0, arousal: 0.5, fatigue: 0 },
    context: { scene: "Would you prefer to attend the planning meeting?", task: "Decide.", focus_refs: [], active_entity_refs: [], environment_refs: [], current_observation_ref: OBS as never },
    memory_working_refs: [], recent_retrieval_refs: [], belief_item_count: 0, belief_items: [], relationship_counterpart_count: 0,
    relationship_dimensions: [], interaction_familiarity: [], interaction_familiarity_cognition_influences: [], allowed_actions: [], projection_hash: HASH
  };
}

class Capture implements ModelTransportV0 {
  readonly requests: ModelTransportRequestV0[] = [];
  async complete(request: ModelTransportRequestV0) {
    this.requests.push(request);
    return { content: JSON.stringify({ schema_version: "language-realization-semantic-draft-v1", text: "ok", evidence_refs: [] }), model: "fake" };
  }
}

describe("C4.2 cognition prompt policy", () => {
  it("states the allowed rationale classes and forbids subject-state narration", () => {
    const prompt = CONVERSATION_COGNITION_SYSTEM_PROMPT_V5;
    expect(prompt).toContain("ALLOWED rationale content is exactly: preference, priority, aversion, willingness or subjective strategy");
    expect(prompt).toContain("FORBIDDEN rationale content");
    for (const forbidden of ["energy, stress, fatigue, arousal, freshness, mood, alertness", "claiming capacity or capability", "naming a psychological condition", "newly asserting a world/history fact"]) {
      expect(prompt).toContain(forbidden);
    }
    expect(prompt).toContain("must stay LATENT");
    expect(prompt).toContain("No numeric or linguistic mapping exists between your regulation/affect values and psychological language");
  });

  it("requires a grounded stance that answers the requested choice and stands alone", () => {
    const prompt = CONVERSATION_COGNITION_SYSTEM_PROMPT_V5;
    expect(prompt).toContain("The stance MUST answer the choice the user actually requested");
    expect(prompt).toContain("it is the ONLY record of what you chose, and no later stage may fill in a missing target, action or object");
  });

  it("leaves the proposal schema and validator unchanged (no version bump)", () => {
    // The C4.2 change is prompt/validation semantics only: the V5 protocol still accepts
    // the same tagged carrier and the same relations.
    const checked = validateConversationCognitionProposalV5({
      schema_version: "conversation-cognition-proposal-v5",
      factual_assessment: { claims: [] },
      cognition: {
        schema_version: "cognition-proposal-v0", reasoning_summary: "x", relevant_memory_refs: [], considered_context_refs: [],
        current_intent: "respond", confidence: 1, uncertainty: 0, action_intent: null, evidence_refs: []
      },
      subjective_choice: { kind: "SELECTED", stance: "I would attend the meeting.", subjective_rationale: "I'd rather be there." },
      communication_directive: { kind: "REALIZE_CURRENT_INTENT" },
      clarification_basis: null
    }, projection() as never, HASH);
    expect(checked.ok).toBe(true);
  });
});

describe("C4.2 language prompt policy", () => {
  it("forbids semantic completion of an incomplete stance", async () => {
    const checked = validateConversationCognitionProposalV5({
      schema_version: "conversation-cognition-proposal-v5",
      factual_assessment: { claims: [] },
      cognition: {
        schema_version: "cognition-proposal-v0", reasoning_summary: "x", relevant_memory_refs: [], considered_context_refs: [],
        current_intent: "respond", confidence: 1, uncertainty: 0, action_intent: null, evidence_refs: []
      },
      subjective_choice: { kind: "SELECTED", stance: "I would volunteer.", subjective_rationale: null },
      communication_directive: { kind: "REALIZE_CURRENT_INTENT" },
      clarification_basis: null
    }, projection() as never, HASH);
    if (!checked.ok) throw new Error(checked.detail);
    const built = await buildLanguageRealizationInputV6({
      subject_id: projection().subject_id, source_revision: projection().state_revision, response_request_id: "opaque-c42" as never,
      projection: projection() as never, conversation_proposal: checked.proposal, memory_episode_contents: []
    });
    if (!built.ok) throw new Error(built.detail);
    const capture = new Capture();
    const provider = new LanguageRealizationProviderV0(capture);
    await provider.realize({ input: built.input, input_hash: built.input_hash, lawful_evidence_refs: new Set([OBS]) });
    const system = capture.requests[0]?.messages.find((message) => message.role === "system")?.content ?? "";
    expect(system).toContain("NO SEMANTIC COMPLETION");
    expect(system).toContain("Never supply a decision target, action, object, option or choice meaning that is absent from the selected stance");
    expect(system).toContain("you must NOT repair it");
    expect(system).toContain("Semantic completion of a decision is a failure");
  });
});
