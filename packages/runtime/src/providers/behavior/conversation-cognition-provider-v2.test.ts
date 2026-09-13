/**
 * AFFECT_AUTHORITY_REVALIDATION_REMEDIATION_V0 — offline structured-output
 * regressions. Zero network/model calls.
 */

import { describe, expect, it } from "vitest";

import type {
  ModelTransportRequestV0,
  ModelTransportResponseV0,
  ModelTransportV0
} from "../../transports/model-transport.js";
import type { CognitiveContextProjectionAnyVersion } from "../../transitions/cognition-action/types.js";
import {
  CONVERSATION_COGNITION_PROPOSAL_V2_JSON_SCHEMA,
  ConversationCognitionProviderV2
} from "./conversation-cognition-provider-v2.js";

const OBSERVATION_REF = "observation:o-structured-1";
const PROJECTION_HASH = `sha256:${"a".repeat(64)}`;

function projection(valence = 0): CognitiveContextProjectionAnyVersion {
  return {
    schema_version: "cognitive-context-projection-v2",
    subject_id: "subject-structured",
    current_logical_time: 1,
    state_revision: 1,
    canonical_affect: {
      schema_version: "canonical-affect-cognition-projection-v0",
      valence,
      activation: 0.5
    },
    regulation: { energy: 1, stress: 0, arousal: 0.5, fatigue: 0 },
    context: {
      scene: "The user asks a bounded question.",
      task: "respond",
      focus_refs: [],
      active_entity_refs: [],
      environment_refs: [],
      current_observation_ref: OBSERVATION_REF
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
    projection_hash: PROJECTION_HASH
  } as unknown as CognitiveContextProjectionAnyVersion;
}

function validProposal(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema_version: "conversation-cognition-proposal-v2",
    cognition: {
      schema_version: "cognition-proposal-v0",
      projection_hash: PROJECTION_HASH,
      reasoning_summary: "The current observation determines a response.",
      relevant_memory_refs: [],
      considered_context_refs: [OBSERVATION_REF],
      current_intent: "respond",
      confidence: 0.8,
      uncertainty: 0.2,
      action_intent: null,
      evidence_refs: [OBSERVATION_REF]
    },
    communication_directive: { kind: "REALIZE_CURRENT_INTENT" },
    clarification_basis: null,
    ...overrides
  };
}

class CapturingTransport implements ModelTransportV0 {
  readonly requests: ModelTransportRequestV0[] = [];

  constructor(private readonly response: unknown) {}

  async complete(request: ModelTransportRequestV0): Promise<ModelTransportResponseV0> {
    this.requests.push(request);
    return { content: typeof this.response === "string" ? this.response : JSON.stringify(this.response), model: "fake" };
  }
}

describe("ConversationCognitionProviderV2 — structured serialization request", () => {
  it("requests the exact same closed schema across different Affect projections", async () => {
    const positive = new CapturingTransport(validProposal());
    const negative = new CapturingTransport(validProposal());
    await new ConversationCognitionProviderV2(positive).propose(projection(0.6));
    await new ConversationCognitionProviderV2(negative).propose(projection(-0.6));

    expect(positive.requests).toHaveLength(1);
    expect(negative.requests).toHaveLength(1);
    expect(positive.requests[0]?.structured_output).toEqual({
      kind: "JSON_SCHEMA",
      schema: CONVERSATION_COGNITION_PROPOSAL_V2_JSON_SCHEMA
    });
    expect(negative.requests[0]?.structured_output).toEqual(positive.requests[0]?.structured_output);
    expect(CONVERSATION_COGNITION_PROPOSAL_V2_JSON_SCHEMA).toMatchObject({
      type: "object",
      additionalProperties: false,
      required: ["schema_version", "cognition", "communication_directive", "clarification_basis"]
    });
  });

  it("still accepts a valid constrained result through independent host validation", async () => {
    const transport = new CapturingTransport(validProposal());
    const accepted = await new ConversationCognitionProviderV2(transport).propose(projection());
    expect(accepted.schema_version).toBe("conversation-cognition-proposal-v2");
    expect(accepted.cognition.projection_hash).toBe(PROJECTION_HASH);
    expect(transport.requests).toHaveLength(1);
  });

  it("host validation rejects an unknown field despite structurally parseable JSON", async () => {
    const transport = new CapturingTransport(validProposal({ extra: "forbidden" }));
    await expect(new ConversationCognitionProviderV2(transport).propose(projection())).rejects.toThrow(
      /unexpected keys/
    );
    expect(transport.requests).toHaveLength(1);
  });

  it("host validation rejects a valid-shaped but stale projection binding", async () => {
    const candidate = validProposal();
    candidate["cognition"] = {
      ...(candidate["cognition"] as Record<string, unknown>),
      projection_hash: `sha256:${"b".repeat(64)}`
    };
    const transport = new CapturingTransport(candidate);
    await expect(new ConversationCognitionProviderV2(transport).propose(projection())).rejects.toThrow(
      /does not match projection/
    );
    expect(transport.requests).toHaveLength(1);
  });

  it("host validation enforces directive/basis relationships after shape validation", async () => {
    const transport = new CapturingTransport(
      validProposal({
        clarification_basis: {
          current_observation_ref: OBSERVATION_REF,
          missing_information: "unresolved detail",
          needed_for: "the response"
        }
      })
    );
    await expect(new ConversationCognitionProviderV2(transport).propose(projection())).rejects.toThrow(
      /REALIZE requires exactly null/
    );
    expect(transport.requests).toHaveLength(1);
  });

  it("does not repair or retry malformed provider text", async () => {
    const transport = new CapturingTransport('{"schema_version":');
    await expect(new ConversationCognitionProviderV2(transport).propose(projection())).rejects.toThrow(
      /not strict JSON/
    );
    expect(transport.requests).toHaveLength(1);
  });
});
