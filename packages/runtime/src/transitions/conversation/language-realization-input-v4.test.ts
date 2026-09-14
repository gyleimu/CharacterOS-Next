/** C2 host-bound Language V4 tests. All transports are deterministic fakes. */

import { describe, expect, it } from "vitest";
import type { ModelTransportRequestV0, ModelTransportV0 } from "../../transports/model-transport.js";
import type { CognitiveContextProjectionV2 } from "../cognition-action/types.js";
import {
  LANGUAGE_REALIZATION_SEMANTIC_DRAFT_V1_JSON_SCHEMA,
  LanguageRealizationProviderV0,
  deriveLanguageInvocationBindingHashV0
} from "../../providers/behavior/language-realization-provider.js";
import {
  buildLanguageRealizationInputV4,
  validateLanguageRealizationInputAnyVersion
} from "./language-realization-input.js";

const OBS = "observation:c2-language";
const HASH = `sha256:${"a".repeat(64)}`;
const WRONG_HASH = `sha256:${"b".repeat(64)}`;

function projection(): CognitiveContextProjectionV2 {
  return {
    schema_version: "cognitive-context-projection-v2", subject_id: "subject-c2-language" as never,
    current_logical_time: 2 as never, state_revision: 2 as never, traits_dimensions: {}, personality_dimensions: {},
    personality_disposition: {}, canonical_affect: { schema_version: "canonical-affect-cognition-projection-v0", valence: -0.6, activation: 0.5 } as never,
    regulation: { energy: 1, stress: 0, arousal: 0.5, fatigue: 0 },
    context: { scene: "17 + 25", task: "Give the sum.", focus_refs: [], active_entity_refs: [], environment_refs: [], current_observation_ref: OBS as never },
    memory_working_refs: [], recent_retrieval_refs: [], belief_item_count: 0, belief_items: [], relationship_counterpart_count: 0,
    relationship_dimensions: [], interaction_familiarity: [], interaction_familiarity_cognition_influences: [], allowed_actions: [], projection_hash: HASH as never
  };
}

function proposal() {
  return {
    schema_version: "conversation-cognition-proposal-v3",
    factual_assessment: { claims: [{ kind: "DERIVED_RESULT", text: "42", source_refs: [OBS] }] },
    cognition: {
      schema_version: "cognition-proposal-v0", projection_hash: HASH, reasoning_summary: "sum is derived",
      relevant_memory_refs: [], considered_context_refs: [OBS], current_intent: "The answer is 42.", confidence: 1,
      uncertainty: 0, action_intent: null, evidence_refs: [OBS]
    },
    communication_directive: { kind: "REALIZE_CURRENT_INTENT" }, clarification_basis: null
  };
}

async function built(requestId = "opaque-a1b2c3") {
  return buildLanguageRealizationInputV4({
    subject_id: projection().subject_id, source_revision: projection().state_revision,
    response_request_id: requestId as never, projection: projection(), conversation_proposal: proposal(), memory_episode_contents: []
  });
}

class Capture implements ModelTransportV0 {
  readonly requests: ModelTransportRequestV0[] = [];
  constructor(private readonly output: unknown) {}
  async complete(request: ModelTransportRequestV0) {
    this.requests.push(request);
    return { content: JSON.stringify(this.output), model: "fake" };
  }
}

describe("LanguageRealizationInputV4", () => {
  it("carries explicit facts and selected intent while excluding raw subject-state causes", async () => {
    const result = await built();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.input.schema_version).toBe("language-realization-input-v4");
    expect(result.input.factual_assessment.claims[0]?.text).toBe("42");
    expect(result.input.selected_current_intent).toBe("The answer is 42.");
    for (const forbidden of ["canonical_affect", "affect_channels", "mood_baseline", "regulation", "belief_items", "personality_dimensions", "reasoning_summary"]) {
      expect(result.input).not.toHaveProperty(forbidden);
    }
    expect(validateLanguageRealizationInputAnyVersion(result.input).ok).toBe(true);
    expect(Object.isFrozen(result.input)).toBe(true);
  });

  it("rejects wrong subject/revision/turn and does not allow caller-supplied facts or intent", async () => {
    const p = projection();
    const base = { subject_id: p.subject_id, source_revision: p.state_revision, response_request_id: "opaque" as never, projection: p, conversation_proposal: proposal(), memory_episode_contents: [] };
    expect((await buildLanguageRealizationInputV4({ ...base, subject_id: "subject-other" as never })).ok).toBe(false);
    expect((await buildLanguageRealizationInputV4({ ...base, source_revision: 9 as never })).ok).toBe(false);
    expect((await buildLanguageRealizationInputV4({ ...base, factual_assessment: {} } as never)).ok).toBe(false);
    expect((await buildLanguageRealizationInputV4({ ...base, selected_current_intent: "forged" } as never)).ok).toBe(false);
  });
});

describe("HOST_BOUND_HASH_OUTSIDE_MODEL_OUTPUT", () => {
  it("asks for a structured semantic draft without exposing input_hash and host-attaches integrity", async () => {
    const result = await built();
    if (!result.ok) throw new Error(result.detail);
    const transport = new Capture({ schema_version: "language-realization-semantic-draft-v1", text: "The answer is 42.", evidence_refs: [OBS] });
    const provider = new LanguageRealizationProviderV0(transport);
    const draft = await provider.realize({ input: result.input, input_hash: result.input_hash, lawful_evidence_refs: new Set([OBS]) });
    expect(draft.input_hash).toBe(result.input_hash);
    expect(transport.requests[0]?.structured_output).toEqual({ kind: "JSON_SCHEMA", schema: LANGUAGE_REALIZATION_SEMANTIC_DRAFT_V1_JSON_SCHEMA });
    const modelInput = transport.requests[0]?.messages.map((message) => message.content).join("\n") ?? "";
    expect(modelInput).not.toContain(result.input_hash);
    expect(modelInput).not.toContain('"input_hash"');
    const binding = provider.lastInvocationBinding;
    if (binding === null) throw new Error("host invocation binding missing");
    expect(binding).toMatchObject({
      subject_id: result.input.subject_id, source_revision: result.input.source_revision,
      response_request_id: result.input.response_request_id, current_turn_ref: OBS,
      conversation_cognition_proposal_hash: result.input.communication_binding.proposal_hash,
      language_input_hash: result.input_hash
    });
    expect(await deriveLanguageInvocationBindingHashV0(binding)).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it("rejects model-generated integrity metadata instead of stamping arbitrary shape", async () => {
    const result = await built();
    if (!result.ok) throw new Error(result.detail);
    const provider = new LanguageRealizationProviderV0(new Capture({ schema_version: "language-realization-semantic-draft-v1", input_hash: result.input_hash, text: "42", evidence_refs: [] }));
    await expect(provider.realize({ input: result.input, input_hash: result.input_hash, lawful_evidence_refs: new Set([OBS]) })).rejects.toThrow(/unexpected keys/);
  });

  it("rejects wrong request binding before transport, preserves cross-request isolation, and prevents duplicate completion", async () => {
    const first = await built("opaque-first");
    const second = await built("opaque-second");
    if (!first.ok || !second.ok) throw new Error("build failed");
    expect(first.input_hash).not.toBe(second.input_hash);
    let calls = 0;
    const transport: ModelTransportV0 = { complete: async () => { calls += 1; return { content: JSON.stringify({ schema_version: "language-realization-semantic-draft-v1", text: "42", evidence_refs: [] }), model: "fake" }; } };
    const provider = new LanguageRealizationProviderV0(transport);
    await expect(provider.realize({ input: first.input, input_hash: WRONG_HASH as never, lawful_evidence_refs: new Set([OBS]) })).rejects.toThrow(/INPUT_HASH_MISMATCH/);
    expect(calls).toBe(0);
    await provider.realize({ input: first.input, input_hash: first.input_hash, lawful_evidence_refs: new Set([OBS]) });
    await expect(provider.realize({ input: first.input, input_hash: first.input_hash, lawful_evidence_refs: new Set([OBS]) })).rejects.toThrow(/duplicate invocation/);
    await provider.realize({ input: second.input, input_hash: second.input_hash, lawful_evidence_refs: new Set([OBS]) });
    expect(calls).toBe(2);
  });
});
