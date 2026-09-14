/** C2 provider structured-output and independent validation regressions. */

import { describe, expect, it } from "vitest";
import type { ModelTransportRequestV0, ModelTransportV0 } from "../../transports/model-transport.js";
import type { CognitiveContextProjectionAnyVersion } from "../../transitions/cognition-action/types.js";
import {
  CONVERSATION_COGNITION_PROPOSAL_V3_JSON_SCHEMA,
  ConversationCognitionProviderV3
} from "./conversation-cognition-provider-v3.js";

const OBS = "observation:c2-provider";
const HASH = `sha256:${"a".repeat(64)}`;

function projection(valence = 0): CognitiveContextProjectionAnyVersion {
  return {
    schema_version: "cognitive-context-projection-v2",
    subject_id: "subject-c2-provider",
    current_logical_time: 1,
    state_revision: 1,
    canonical_affect: { schema_version: "canonical-affect-cognition-projection-v0", valence, activation: 0.5 },
    regulation: { energy: 1, stress: 0, arousal: 0.5, fatigue: 0 },
    context: { scene: "17 plus 25", task: "give the result", focus_refs: [], active_entity_refs: [], environment_refs: [], current_observation_ref: OBS },
    memory_working_refs: [], recent_retrieval_refs: [], belief_item_count: 0, belief_items: [],
    relationship_counterpart_count: 0, relationship_dimensions: [], interaction_familiarity: [],
    interaction_familiarity_cognition_influences: [], traits_dimensions: {}, personality_dimensions: {},
    personality_disposition: {}, allowed_actions: [], projection_hash: HASH
  } as unknown as CognitiveContextProjectionAnyVersion;
}

function proposal(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema_version: "conversation-cognition-proposal-v3",
    factual_assessment: { claims: [{ kind: "DERIVED_RESULT", text: "42", source_refs: [OBS] }] },
    cognition: {
      schema_version: "cognition-proposal-v0", projection_hash: HASH, reasoning_summary: "derived sum",
      relevant_memory_refs: [], considered_context_refs: [OBS], current_intent: "The result is 42.",
      confidence: 1, uncertainty: 0, action_intent: null, evidence_refs: [OBS]
    },
    communication_directive: { kind: "REALIZE_CURRENT_INTENT" },
    clarification_basis: null,
    ...overrides
  };
}

class Capture implements ModelTransportV0 {
  readonly requests: ModelTransportRequestV0[] = [];
  constructor(private readonly value: unknown) {}
  async complete(request: ModelTransportRequestV0) {
    this.requests.push(request);
    return { content: typeof this.value === "string" ? this.value : JSON.stringify(this.value), model: "fake" };
  }
}

describe("ConversationCognitionProviderV3", () => {
  it("uses the same closed native schema across Affect conditions", async () => {
    const p = new Capture(proposal());
    const n = new Capture(proposal());
    await new ConversationCognitionProviderV3(p).propose(projection(0.6));
    await new ConversationCognitionProviderV3(n).propose(projection(-0.6));
    expect(p.requests[0]?.structured_output).toEqual({ kind: "JSON_SCHEMA", schema: CONVERSATION_COGNITION_PROPOSAL_V3_JSON_SCHEMA });
    expect(n.requests[0]?.structured_output).toEqual(p.requests[0]?.structured_output);
  });

  it("host validation still rejects a source mismatch and does not repair/retry", async () => {
    const mismatch = new Capture(proposal({ factual_assessment: { claims: [{ kind: "SOURCE_QUOTE", text: "42", source_refs: [OBS] }] } }));
    await expect(new ConversationCognitionProviderV3(mismatch).propose(projection())).rejects.toThrow(/SOURCE_QUOTE/);
    expect(mismatch.requests).toHaveLength(1);
    const malformed = new Capture('{"schema_version":');
    await expect(new ConversationCognitionProviderV3(malformed).propose(projection())).rejects.toThrow(/not strict JSON/);
    expect(malformed.requests).toHaveLength(1);
  });
});
