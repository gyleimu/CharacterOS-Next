/**
 * C4.3 contract-legibility regressions (zero model calls).
 *
 * Reproduces the historical N2 failure — a factual claim citing a source that
 * cognition.considered_context_refs omitted — and pins the repair: the prompt now
 * states the binding, and the validator stays strict in both directions.
 */

import { describe, expect, it } from "vitest";
import type { HashV1 } from "@characteros-next/subject-core";
import type { CognitiveContextProjectionV2 } from "../../transitions/cognition-action/types.js";
import { CONVERSATION_COGNITION_SYSTEM_PROMPT_V5 } from "./conversation-cognition-provider-v5.js";
import { validateConversationCognitionProposalV5 } from "../../transitions/conversation/conversation-cognition-proposal.js";

const OBS = "observation:c43";
const HASH = `sha256:${"a".repeat(64)}` as HashV1;

function projection(): CognitiveContextProjectionV2 {
  return {
    schema_version: "cognitive-context-projection-v2", subject_id: "subject-c43" as never,
    current_logical_time: 2 as never, state_revision: 2 as never, traits_dimensions: {}, personality_dimensions: {},
    personality_disposition: {}, canonical_affect: { schema_version: "canonical-affect-cognition-projection-v0", valence: 0, activation: 0.5 } as never,
    regulation: { energy: 1, stress: 0, arousal: 0.5, fatigue: 0 },
    context: { scene: "What is 63 - 28?", task: "Answer.", focus_refs: [], active_entity_refs: [], environment_refs: [], current_observation_ref: OBS as never },
    memory_working_refs: [], recent_retrieval_refs: [], belief_item_count: 0, belief_items: [], relationship_counterpart_count: 0,
    relationship_dimensions: [], interaction_familiarity: [], interaction_familiarity_cognition_influences: [], allowed_actions: [], projection_hash: HASH
  };
}

/** Builds the N2-shaped proposal; the observation may be omitted from considered refs. */
function n2Proposal(options: { readonly consideredIncludesObservation: boolean; readonly evidenceIncludesObservation?: boolean }) {
  const considered = options.consideredIncludesObservation ? [OBS] : ["entity:alice"];
  const evidence = (options.evidenceIncludesObservation ?? true) ? [OBS] : ["entity:alice"];
  return {
    schema_version: "conversation-cognition-proposal-v5",
    factual_assessment: { claims: [{ kind: "DERIVED_RESULT", text: "63 minus 28 equals 35.", source_refs: [OBS] }] },
    cognition: {
      schema_version: "cognition-proposal-v0", reasoning_summary: "subtract",
      relevant_memory_refs: [], considered_context_refs: considered, current_intent: "state the difference",
      confidence: 1, uncertainty: 0, action_intent: null, evidence_refs: evidence
    },
    subjective_choice: { kind: "NOT_APPLICABLE" },
    communication_directive: { kind: "REALIZE_CURRENT_INTENT" },
    clarification_basis: null
  };
}

describe("C4.3 citation binding", () => {
  it("the cognition prompt states the citation-binding contract", () => {
    const prompt = CONVERSATION_COGNITION_SYSTEM_PROMPT_V5;
    expect(prompt).toContain("CITATION BINDING");
    expect(prompt).toContain("must ALSO be listed in cognition.considered_context_refs AND in cognition.evidence_refs");
    expect(prompt).toContain("is rejected and the whole turn is refused");
  });

  it("a claim whose source is bound in both cognition arrays passes", () => {
    const checked = validateConversationCognitionProposalV5(n2Proposal({ consideredIncludesObservation: true }), projection() as never, HASH);
    expect(checked.ok).toBe(true);
  });

  it("reproduces the historical N2 failure: a source missing from considered_context_refs fail-closes", () => {
    const checked = validateConversationCognitionProposalV5(n2Proposal({ consideredIncludesObservation: false }), projection() as never, HASH);
    expect(checked.ok).toBe(false);
    if (!checked.ok) expect(checked.detail).toContain("is not bound in cognition considered/evidence refs");
  });

  it("a source missing from evidence_refs fail-closes too (both arrays are required)", () => {
    const checked = validateConversationCognitionProposalV5(
      n2Proposal({ consideredIncludesObservation: true, evidenceIncludesObservation: false }),
      projection() as never,
      HASH
    );
    expect(checked.ok).toBe(false);
    if (!checked.ok) expect(checked.detail).toContain("is not bound in cognition considered/evidence refs");
  });
});
