/**
 * Family C4 provider regressions: tagged native schema, host-bound identity,
 * no repair and no retry. Zero model calls.
 */

import { describe, expect, it } from "vitest";
import type { ModelTransportRequestV0, ModelTransportV0 } from "../../transports/model-transport.js";
import type { CognitiveContextProjectionAnyVersion } from "../../transitions/cognition-action/types.js";
import {
  CONVERSATION_COGNITION_PROPOSAL_V5_JSON_SCHEMA,
  CONVERSATION_COGNITION_SYSTEM_PROMPT_V5,
  ConversationCognitionProviderV5,
  ConversationCognitionRejectionErrorV5
} from "./conversation-cognition-provider-v5.js";

const OBS = "observation:c4-provider";
const HASH = `sha256:${"a".repeat(64)}`;
const OTHER_HASH = `sha256:${"b".repeat(64)}`;

function projection(options: { readonly hash?: string; readonly revision?: number } = {}): CognitiveContextProjectionAnyVersion {
  return {
    schema_version: "cognitive-context-projection-v2",
    subject_id: "subject-c4-provider",
    current_logical_time: 1,
    state_revision: options.revision ?? 1,
    canonical_affect: { schema_version: "canonical-affect-cognition-projection-v0", valence: 0.4, activation: 0.5 },
    regulation: { energy: 1, stress: 0, arousal: 0.5, fatigue: 0 },
    context: { scene: "Would you volunteer?", task: "decide", focus_refs: [], active_entity_refs: [], environment_refs: [], current_observation_ref: OBS },
    memory_working_refs: [], recent_retrieval_refs: [], belief_item_count: 0, belief_items: [],
    relationship_counterpart_count: 0, relationship_dimensions: [], interaction_familiarity: [],
    interaction_familiarity_cognition_influences: [], traits_dimensions: {}, personality_dimensions: {},
    personality_disposition: {}, allowed_actions: [], projection_hash: options.hash ?? HASH
  } as unknown as CognitiveContextProjectionAnyVersion;
}

/** Model-shaped proposal: semantics only, no projection_hash, tagged choice. */
function proposal(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema_version: "conversation-cognition-proposal-v5",
    factual_assessment: { claims: [] },
    cognition: {
      schema_version: "cognition-proposal-v0", reasoning_summary: "the teammate asks for a commitment",
      relevant_memory_refs: [], considered_context_refs: [], current_intent: "summarize and decide",
      confidence: 1, uncertainty: 0, action_intent: null, evidence_refs: []
    },
    subjective_choice: { kind: "SELECTED", stance: "I would volunteer.", subjective_rationale: null },
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

describe("ConversationCognitionProviderV5", () => {
  it("sends the closed tagged V5 schema, never asks for a projection hash, and injects the host one", async () => {
    const capture = new Capture(proposal());
    const provider = new ConversationCognitionProviderV5(capture);
    const result = await provider.propose(projection());
    expect(capture.requests[0]?.structured_output).toEqual({ kind: "JSON_SCHEMA", schema: CONVERSATION_COGNITION_PROPOSAL_V5_JSON_SCHEMA });
    expect(capture.requests[0]?.messages[0]?.content).toBe(CONVERSATION_COGNITION_SYSTEM_PROMPT_V5);
    expect(JSON.stringify(CONVERSATION_COGNITION_PROPOSAL_V5_JSON_SCHEMA)).not.toContain("projection_hash");
    expect(result.cognition.projection_hash).toBe(HASH);
    expect(result.subjective_choice).toEqual({ kind: "SELECTED", stance: "I would volunteer.", subjective_rationale: null });
  });

  it("advertises both applicability branches and states the authority rule in the prompt", () => {
    const advertised = JSON.stringify(CONVERSATION_COGNITION_PROPOSAL_V5_JSON_SCHEMA);
    expect(advertised).toContain("NOT_APPLICABLE");
    expect(advertised).toContain("SELECTED");
    expect(advertised).toContain("subjective_rationale");
    expect(CONVERSATION_COGNITION_SYSTEM_PROMPT_V5).toContain("no subjective selection for you to make");
    expect(CONVERSATION_COGNITION_SYSTEM_PROMPT_V5).toContain("belongs ONLY in subjective_rationale");
    expect(CONVERSATION_COGNITION_SYSTEM_PROMPT_V5).toContain("NEVER assert subject state as fact");
    expect(CONVERSATION_COGNITION_SYSTEM_PROMPT_V5).not.toContain("MUST appear as a claim in factual_assessment with a lawful source; never smuggle");
  });

  it("accepts the NOT_APPLICABLE branch through the same closed schema", async () => {
    const capture = new Capture(proposal({ subjective_choice: { kind: "NOT_APPLICABLE" } }));
    const result = await new ConversationCognitionProviderV5(capture).propose(projection());
    expect(result.subjective_choice).toEqual({ kind: "NOT_APPLICABLE" });
  });

  it("fails closed without repair or retry on enum echo, missing kind and model-emitted hash", async () => {
    const cases: Array<[unknown, RegExp]> = [
      [proposal({ subjective_choice: { kind: "SELECTED", stance: "REALIZE_CURRENT_INTENT", subjective_rationale: null } }), /directive enum echo/],
      [proposal({ subjective_choice: { stance: "I would volunteer." } }), /kind/],
      [proposal({ cognition: { ...(proposal()["cognition"] as object), projection_hash: HASH } }), /unexpected key|projection_hash/],
      ['{"schema_version":', /not strict JSON/]
    ];
    for (const [value, pattern] of cases) {
      const capture = new Capture(value);
      await expect(new ConversationCognitionProviderV5(capture).propose(projection())).rejects.toThrow(pattern);
      expect(capture.requests).toHaveLength(1);
    }
  });

  it("binds each invocation to its own captured hash and rejects a duplicate binding", async () => {
    const capture = new Capture(proposal());
    const provider = new ConversationCognitionProviderV5(capture);
    await provider.propose(projection());
    await expect(provider.propose(projection())).rejects.toThrow(/duplicate invocation/);
    expect(capture.requests).toHaveLength(1);
    const second = await provider.propose(projection({ hash: OTHER_HASH }));
    expect(second.cognition.projection_hash).toBe(OTHER_HASH);
  });

  it("reports rejections with the C4 error type", async () => {
    const capture = new Capture(proposal({ subjective_choice: { kind: "SELECTED", stance: "decide whether to help", subjective_rationale: null } }));
    await expect(new ConversationCognitionProviderV5(capture).propose(projection())).rejects.toBeInstanceOf(ConversationCognitionRejectionErrorV5);
  });
});
