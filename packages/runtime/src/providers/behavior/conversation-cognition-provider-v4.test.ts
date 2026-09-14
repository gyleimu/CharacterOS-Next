/**
 * Family C3 provider regressions: host-bound identity, no model-emitted hash,
 * no repair and no retry. Zero model calls.
 */

import { describe, expect, it } from "vitest";
import type { ModelTransportRequestV0, ModelTransportV0 } from "../../transports/model-transport.js";
import type { CognitiveContextProjectionAnyVersion } from "../../transitions/cognition-action/types.js";
import {
  CONVERSATION_COGNITION_PROPOSAL_V4_JSON_SCHEMA,
  CONVERSATION_COGNITION_SYSTEM_PROMPT_V4,
  ConversationCognitionProviderV4,
  ConversationCognitionRejectionErrorV4
} from "./conversation-cognition-provider-v4.js";

const OBS = "observation:c3-provider";
const HASH = `sha256:${"a".repeat(64)}`;
const OTHER_HASH = `sha256:${"b".repeat(64)}`;

function projection(options: { readonly hash?: string; readonly revision?: number } = {}): CognitiveContextProjectionAnyVersion {
  return {
    schema_version: "cognitive-context-projection-v2",
    subject_id: "subject-c3-provider",
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

/** Model-shaped proposal: semantics only, NO projection_hash. */
function proposal(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema_version: "conversation-cognition-proposal-v4",
    factual_assessment: { claims: [] },
    cognition: {
      schema_version: "cognition-proposal-v0", reasoning_summary: "the teammate asks for a commitment",
      relevant_memory_refs: [], considered_context_refs: [], current_intent: "summarize and decide",
      confidence: 1, uncertainty: 0, action_intent: null, evidence_refs: []
    },
    subjective_choice: { stance: "I would volunteer." },
    communication_directive: { kind: "REALIZE_CURRENT_INTENT" },
    clarification_basis: null,
    ...overrides
  };
}

class Capture implements ModelTransportV0 {
  readonly requests: ModelTransportRequestV0[] = [];
  constructor(private readonly value: unknown, private readonly onCall?: () => void) {}
  async complete(request: ModelTransportRequestV0) {
    this.requests.push(request);
    this.onCall?.();
    return { content: typeof this.value === "string" ? this.value : JSON.stringify(this.value), model: "fake" };
  }
}

describe("ConversationCognitionProviderV4 host-bound identity", () => {
  it("sends the closed native V4 schema and never asks the model for a projection hash", async () => {
    const capture = new Capture(proposal());
    const provider = new ConversationCognitionProviderV4(capture);
    const result = await provider.propose(projection());
    expect(capture.requests[0]?.structured_output).toEqual({ kind: "JSON_SCHEMA", schema: CONVERSATION_COGNITION_PROPOSAL_V4_JSON_SCHEMA });
    expect(capture.requests[0]?.messages[0]?.content).toBe(CONVERSATION_COGNITION_SYSTEM_PROMPT_V4);
    expect(JSON.stringify(CONVERSATION_COGNITION_PROPOSAL_V4_JSON_SCHEMA)).not.toContain("projection_hash");
    // The host injected the authoritative hash; the model never supplied one.
    expect(result.cognition.projection_hash).toBe(HASH);
    expect(result.subjective_choice).toEqual({ stance: "I would volunteer." });
  });

  it("fails closed when the model emits a projection_hash of its own, without repair or retry", async () => {
    const withHash = proposal({ cognition: { ...(proposal()["cognition"] as object), projection_hash: HASH } });
    const capture = new Capture(withHash);
    await expect(new ConversationCognitionProviderV4(capture).propose(projection())).rejects.toThrow(/unexpected key|projection_hash/);
    expect(capture.requests).toHaveLength(1);
  });

  it("fails closed when the model omits the explicit choice field", async () => {
    const withoutChoice = proposal();
    delete withoutChoice["subjective_choice"];
    const capture = new Capture(withoutChoice);
    await expect(new ConversationCognitionProviderV4(capture).propose(projection())).rejects.toThrow(ConversationCognitionRejectionErrorV4);
    expect(capture.requests).toHaveLength(1);
  });

  it("rejects the directive-enum echo in the stance without a second call", async () => {
    const echoed = proposal({ subjective_choice: { stance: "REALIZE_CURRENT_INTENT" } });
    const capture = new Capture(echoed);
    await expect(new ConversationCognitionProviderV4(capture).propose(projection())).rejects.toThrow(/directive enum echo/);
    expect(capture.requests).toHaveLength(1);
  });

  it("binds each invocation to its own projection hash and rejects a duplicate host binding", async () => {
    const capture = new Capture(proposal());
    const provider = new ConversationCognitionProviderV4(capture);
    await provider.propose(projection());
    // Same subject + revision + schema version + projection hash = same binding.
    await expect(provider.propose(projection())).rejects.toThrow(/duplicate invocation/);
    expect(capture.requests).toHaveLength(1);
    // A different projection hash is a different invocation and is lawful.
    const result = await provider.propose(projection({ hash: OTHER_HASH }));
    expect(result.cognition.projection_hash).toBe(OTHER_HASH);
    expect(capture.requests).toHaveLength(2);
  });

  it("isolates concurrent invocations: each response binds to its own captured hash", async () => {
    const gates: Array<() => void> = [];
    const seen: string[] = [];
    let bothStarted: (() => void) | null = null;
    const both = new Promise<void>((resolve) => { bothStarted = resolve; });
    const transport: ModelTransportV0 = {
      complete: async (request) => {
        // Distinguish the two invocations by the projection hash in the prompt.
        const hash = /sha256:[0-9a-f]{64}/.exec(request.messages[1]?.content ?? "")?.[0] ?? "";
        seen.push(hash);
        if (seen.length === 2) bothStarted?.();
        await new Promise<void>((resolve) => { gates.push(resolve); });
        return { content: JSON.stringify(proposal()), model: "fake" };
      }
    };
    const provider = new ConversationCognitionProviderV4(transport);
    const first = provider.propose(projection({ hash: HASH, revision: 1 }));
    const second = provider.propose(projection({ hash: OTHER_HASH, revision: 2 }));
    await both;
    for (const release of gates) release();
    const [a, b] = await Promise.all([first, second]);
    expect(seen).toEqual([HASH, OTHER_HASH]);
    expect(a.cognition.projection_hash).toBe(HASH);
    expect(b.cognition.projection_hash).toBe(OTHER_HASH);
  });

  it("does not repair malformed JSON", async () => {
    const capture = new Capture('{"schema_version":');
    await expect(new ConversationCognitionProviderV4(capture).propose(projection())).rejects.toThrow(/not strict JSON/);
    expect(capture.requests).toHaveLength(1);
  });
});
