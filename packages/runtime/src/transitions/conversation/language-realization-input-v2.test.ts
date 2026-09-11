/**
 * CANONICAL_AFFECT_DOWNSTREAM_LANGUAGE_BEHAVIOR_INTEGRATION_V0 — closed handoff
 * contract tests. Offline only; real model calls 0.
 */

import { describe, expect, it } from "vitest";
import { hashEnvelope } from "@characteros-next/subject-core";
import type { ModelTransportV0 } from "../../transports/model-transport.js";
import { LanguageRealizationProviderV0 } from "../../providers/behavior/language-realization-provider.js";
import type { CognitiveContextProjectionV2, CognitionProposalV0 } from "../cognition-action/types.js";
import {
  buildLanguageRealizationInputV1,
  validateLanguageRealizationInputAnyVersion
} from "./language-realization-input.js";

const HASH_A = "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const HASH_B = "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

function projection(overrides: Partial<CognitiveContextProjectionV2> = {}): CognitiveContextProjectionV2 {
  return {
    schema_version: "cognitive-context-projection-v2",
    subject_id: "subject-s0" as never,
    current_logical_time: 4 as never,
    state_revision: 4 as never,
    traits_dimensions: {},
    personality_dimensions: {},
    canonical_affect: { schema_version: "canonical-affect-cognition-projection-v0", valence: 0.25, activation: 0.5 } as never,
    regulation: { energy: 1, stress: 0, arousal: 0.5, fatigue: 0 },
    context: {
      scene: "same current scene",
      task: "reply",
      focus_refs: [],
      active_entity_refs: ["entity:alice"] as never,
      environment_refs: [],
      current_observation_ref: null
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
    projection_hash: HASH_A as never,
    ...overrides
  };
}

function cognition(currentIntent: string | null, projectionHash = HASH_A): CognitionProposalV0 {
  return {
    schema_version: "cognition-proposal-v0",
    projection_hash: projectionHash as never,
    reasoning_summary: "inspectable but excluded from language",
    relevant_memory_refs: [],
    considered_context_refs: [],
    current_intent: currentIntent,
    confidence: 0.75,
    uncertainty: 0.25,
    action_intent: null,
    evidence_refs: []
  };
}

async function build(currentIntent: string | null, projectionValue = projection()) {
  const cognitionValue = cognition(currentIntent, projectionValue.projection_hash);
  const directive = { kind: "REALIZE_CURRENT_INTENT" as const };
  const proposalHash = await hashEnvelope(
    "characteros-next/runtime/conversation-cognition-proposal/v1",
    {
      schema_version: "conversation-cognition-proposal-v1",
      cognition: cognitionValue,
      communication_directive: directive
    }
  );
  return buildLanguageRealizationInputV1({
    subject_id: projectionValue.subject_id,
    source_revision: projectionValue.state_revision,
    response_request_id: "response-1" as never,
    projection: projectionValue,
    cognition: cognitionValue,
    conversation_cognition_proposal_hash: proposalHash,
    communication_directive: directive,
    memory_episode_contents: []
  });
}

describe("LanguageRealizationInputV2 handoff", () => {
  it("preserves non-null intent exactly, excludes direct Affect/Mood/summary, and binds intent in the hash", async () => {
    const first = await build("answer directly and warmly");
    const second = await build("ask one careful follow-up");
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    expect(first.input.schema_version).toBe("language-realization-input-v2");
    expect(first.input.cognition_proposal_binding.current_intent).toBe("answer directly and warmly");
    expect(first.input_hash).not.toBe(second.input_hash);
    expect(Object.isFrozen(first.input)).toBe(true);
    expect(Object.isFrozen(first.input.cognition_proposal_binding)).toBe(true);
    expect(first.input).not.toHaveProperty("canonical_affect");
    expect(first.input).not.toHaveProperty("affect_channels");
    expect(first.input).not.toHaveProperty("mood_baseline");
    expect(first.input).not.toHaveProperty("reasoning_summary");
  });

  it("preserves lawful null without synthesis", async () => {
    const result = await build(null);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.input.cognition_proposal_binding.current_intent).toBeNull();
  });

  it("fails closed on cross-version and malformed binding combinations", async () => {
    const result = await build("intent");
    if (!result.ok) throw new Error(result.detail);
    const base = result.input as unknown as Record<string, unknown>;
    const cases = [
      { ...base, schema_version: "language-realization-input-v1" },
      { ...base, affect_channels: [], mood_baseline: 0 },
      { ...base, reasoning_summary: "must not leak" },
      {
        ...base,
        cognition_proposal_binding: {
          ...(base["cognition_proposal_binding"] as Record<string, unknown>),
          projection_hash: HASH_B
        }
      },
      {
        ...base,
        cognition_proposal_binding: {
          ...(base["cognition_proposal_binding"] as Record<string, unknown>),
          schema_version: "cognition-proposal-v1"
        }
      }
    ];
    for (const candidate of cases) {
      expect(validateLanguageRealizationInputAnyVersion(candidate).ok).toBe(false);
    }
  });

  it("rejects wrong subject, wrong projection hash, unsupported cognition version, and caller intent injection", async () => {
    const projectionValue = projection();
    const validCognition = cognition("validated");
    const directive = { kind: "REALIZE_CURRENT_INTENT" as const };
    const proposalHash = await hashEnvelope(
      "characteros-next/runtime/conversation-cognition-proposal/v1",
      {
        schema_version: "conversation-cognition-proposal-v1",
        cognition: validCognition,
        communication_directive: directive
      }
    );
    const base = {
      subject_id: projectionValue.subject_id,
      source_revision: projectionValue.state_revision,
      response_request_id: "response-1" as never,
      projection: projectionValue,
      cognition: validCognition as unknown,
      conversation_cognition_proposal_hash: proposalHash,
      communication_directive: directive,
      memory_episode_contents: []
    };

    expect((await buildLanguageRealizationInputV1({ ...base, subject_id: "subject-other" as never })).ok).toBe(false);
    expect((await buildLanguageRealizationInputV1({ ...base, source_revision: 99 as never })).ok).toBe(false);
    expect((await buildLanguageRealizationInputV1({
      ...base,
      cognition: { ...validCognition, projection_hash: HASH_B }
    })).ok).toBe(false);
    expect((await buildLanguageRealizationInputV1({
      ...base,
      cognition: { ...validCognition, schema_version: "cognition-proposal-v1" }
    })).ok).toBe(false);
    expect((await buildLanguageRealizationInputV1({
      ...base,
      current_intent: "caller forged" as never
    } as never)).ok).toBe(false);
  });

  it("provider rejects an unbound input hash before touching transport", async () => {
    const result = await build("bound intent");
    if (!result.ok) throw new Error(result.detail);
    let calls = 0;
    const transport: ModelTransportV0 = {
      complete: async () => {
        calls += 1;
        throw new Error("transport must remain untouched");
      }
    };
    const provider = new LanguageRealizationProviderV0(transport);
    await expect(provider.realize({
      input: result.input,
      input_hash: HASH_B as never,
      lawful_evidence_refs: new Set()
    })).rejects.toThrow("INPUT_HASH_MISMATCH");
    expect(calls).toBe(0);
  });
});
