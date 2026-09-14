/**
 * Family C3 Language handoff (V5): the host carries the ALREADY-SELECTED
 * subjective choice, and a null choice can never be turned into one by the
 * language stage. All transports are deterministic fakes; zero model calls.
 */

import { describe, expect, it } from "vitest";
import type { HashV1 } from "@characteros-next/subject-core";
import type { ModelTransportRequestV0, ModelTransportV0 } from "../../transports/model-transport.js";
import type { CognitiveContextProjectionV2 } from "../cognition-action/types.js";
import {
  LANGUAGE_REALIZATION_SEMANTIC_DRAFT_V1_JSON_SCHEMA,
  LanguageRealizationProviderV0,
  deriveLanguageInvocationBindingHashV0
} from "../../providers/behavior/language-realization-provider.js";
import { validateConversationCognitionProposalV4 } from "./conversation-cognition-proposal.js";
import {
  buildLanguageRealizationInputV5,
  validateLanguageRealizationInputAnyVersion
} from "./language-realization-input.js";

const OBS = "observation:c3-language";
const HASH = `sha256:${"a".repeat(64)}` as HashV1;
const WRONG_HASH = `sha256:${"b".repeat(64)}` as HashV1;

function projection(): CognitiveContextProjectionV2 {
  return {
    schema_version: "cognitive-context-projection-v2", subject_id: "subject-c3-language" as never,
    current_logical_time: 2 as never, state_revision: 2 as never, traits_dimensions: {}, personality_dimensions: {},
    personality_disposition: {}, canonical_affect: { schema_version: "canonical-affect-cognition-projection-v0", valence: -0.6, activation: 0.5 } as never,
    regulation: { energy: 1, stress: 0, arousal: 0.5, fatigue: 0 },
    context: { scene: "Would you volunteer for the weekend shift?", task: "Decide.", focus_refs: [], active_entity_refs: [], environment_refs: [], current_observation_ref: OBS as never },
    memory_working_refs: [], recent_retrieval_refs: [], belief_item_count: 0, belief_items: [], relationship_counterpart_count: 0,
    relationship_dimensions: [], interaction_familiarity: [], interaction_familiarity_cognition_influences: [], allowed_actions: [], projection_hash: HASH as never
  };
}

/** Host-bound V4 proposal: cognition.projection_hash was injected by the host. */
async function hostBoundProposal(stance: string | null) {
  const checked = validateConversationCognitionProposalV4({
    schema_version: "conversation-cognition-proposal-v4",
    factual_assessment: { claims: [] },
    cognition: {
      schema_version: "cognition-proposal-v0", reasoning_summary: "the teammate asks for a commitment",
      relevant_memory_refs: [], considered_context_refs: [], current_intent: "summarize and decide",
      confidence: 1, uncertainty: 0, action_intent: null, evidence_refs: []
    },
    subjective_choice: stance === null ? null : { stance },
    communication_directive: { kind: "REALIZE_CURRENT_INTENT" },
    clarification_basis: null
  }, projection(), HASH);
  if (!checked.ok) throw new Error(checked.detail);
  return checked.proposal;
}

async function built(stance: string | null, requestId = "opaque-c3-a1b2c3") {
  return buildLanguageRealizationInputV5({
    subject_id: projection().subject_id, source_revision: projection().state_revision,
    response_request_id: requestId as never, projection: projection(),
    conversation_proposal: await hostBoundProposal(stance), memory_episode_contents: []
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

describe("LanguageRealizationInputV5", () => {
  it("carries the selected subjective choice and explicit facts, excluding raw subject-state causes", async () => {
    const result = await built("I would volunteer.");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.input.schema_version).toBe("language-realization-input-v5");
    expect(result.input.selected_subjective_choice).toEqual({ stance: "I would volunteer." });
    expect(result.input.communication_binding.schema_version).toBe("conversation-cognition-proposal-v4");
    expect(result.input).not.toHaveProperty("selected_current_intent");
    for (const forbidden of ["canonical_affect", "affect_channels", "mood_baseline", "regulation", "belief_items", "personality_dimensions", "reasoning_summary"]) {
      expect(result.input).not.toHaveProperty(forbidden);
    }
    expect(validateLanguageRealizationInputAnyVersion(result.input).ok).toBe(true);
    expect(Object.isFrozen(result.input)).toBe(true);
  });

  it("carries a null choice as null for a factual turn", async () => {
    const result = await built(null);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.input.selected_subjective_choice).toBeNull();
    expect(result.input.constraints.no_invented_choice).toBe(true);
    expect(result.input.constraints.preserve_selected_subjective_choice).toBe(true);
  });

  it("rejects caller-supplied facts or choice, wrong subject/revision/turn, and a stale projection", async () => {
    const p = projection();
    const base = {
      subject_id: p.subject_id, source_revision: p.state_revision, response_request_id: "opaque" as never,
      projection: p, conversation_proposal: await hostBoundProposal("I would volunteer."), memory_episode_contents: []
    };
    expect((await buildLanguageRealizationInputV5({ ...base, subject_id: "subject-other" as never })).ok).toBe(false);
    expect((await buildLanguageRealizationInputV5({ ...base, source_revision: 9 as never })).ok).toBe(false);
    expect((await buildLanguageRealizationInputV5({ ...base, selected_subjective_choice: { stance: "forged" } } as never)).ok).toBe(false);
    expect((await buildLanguageRealizationInputV5({ ...base, factual_assessment: {} } as never)).ok).toBe(false);
  });

  it("rejects a proposal that is not host-bound by this exact projection", async () => {
    const p = projection();
    const proposal = await hostBoundProposal("I would volunteer.");
    const otherProjection = { ...p, projection_hash: WRONG_HASH as never };
    const checked = await buildLanguageRealizationInputV5({
      subject_id: p.subject_id, source_revision: p.state_revision, response_request_id: "opaque" as never,
      projection: otherProjection, conversation_proposal: proposal, memory_episode_contents: []
    });
    expect(checked.ok).toBe(false);
  });

  it("rejects a host-bound REALIZE proposal whose stance is an enum echo", async () => {
    const proposal = await hostBoundProposal("I would volunteer.");
    const tampered = { ...proposal, subjective_choice: { stance: "REALIZE_CURRENT_INTENT" } };
    const checked = await buildLanguageRealizationInputV5({
      subject_id: projection().subject_id, source_revision: projection().state_revision, response_request_id: "opaque" as never,
      projection: projection(), conversation_proposal: tampered as never, memory_episode_contents: []
    });
    expect(checked.ok).toBe(false);
  });

  it("rejects a CLARIFY proposal at the language boundary", async () => {
    const checked = validateConversationCognitionProposalV4({
      schema_version: "conversation-cognition-proposal-v4",
      factual_assessment: { claims: [] },
      cognition: {
        schema_version: "cognition-proposal-v0", reasoning_summary: "need the identifier",
        relevant_memory_refs: [], considered_context_refs: [OBS], current_intent: "ask for the required identifier",
        confidence: 1, uncertainty: 0, action_intent: null, evidence_refs: [OBS]
      },
      subjective_choice: null,
      communication_directive: { kind: "CLARIFY_MISSING_CONTEXT" },
      clarification_basis: { current_observation_ref: OBS, missing_information: "the required identifier", needed_for: "the lookup" }
    }, projection(), HASH);
    if (!checked.ok) throw new Error(checked.detail);
    const built = await buildLanguageRealizationInputV5({
      subject_id: projection().subject_id, source_revision: projection().state_revision, response_request_id: "opaque" as never,
      projection: projection(), conversation_proposal: checked.proposal, memory_episode_contents: []
    });
    expect(built.ok).toBe(false);
    if (!built.ok) expect(built.detail).toContain("REALIZE");
  });
});

describe("HOST_BOUND_HASH_OUTSIDE_MODEL_OUTPUT (C3 language stage)", () => {
  it("never exposes input_hash, and instructs the model never to invent a choice when the choice is null", async () => {
    const result = await built(null);
    if (!result.ok) throw new Error(result.detail);
    const transport = new Capture({ schema_version: "language-realization-semantic-draft-v1", text: "The shift is on the weekend.", evidence_refs: [] });
    const provider = new LanguageRealizationProviderV0(transport);
    const draft = await provider.realize({ input: result.input, input_hash: result.input_hash, lawful_evidence_refs: new Set([OBS]) });
    expect(draft.input_hash).toBe(result.input_hash);
    expect(transport.requests[0]?.structured_output).toEqual({ kind: "JSON_SCHEMA", schema: LANGUAGE_REALIZATION_SEMANTIC_DRAFT_V1_JSON_SCHEMA });
    const modelInput = transport.requests[0]?.messages.map((message) => message.content).join("\n") ?? "";
    expect(modelInput).not.toContain(result.input_hash);
    expect(modelInput).not.toContain('"input_hash"');
    expect(modelInput).toContain('"selected_subjective_choice": null');
    expect(modelInput).toContain("do NOT produce, imply or hedge any preference");
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
    const result = await built("I would volunteer.");
    if (!result.ok) throw new Error(result.detail);
    const provider = new LanguageRealizationProviderV0(new Capture({ schema_version: "language-realization-semantic-draft-v1", input_hash: result.input_hash, text: "ok", evidence_refs: [] }));
    await expect(provider.realize({ input: result.input, input_hash: result.input_hash, lawful_evidence_refs: new Set([OBS]) })).rejects.toThrow(/unexpected keys/);
  });

  it("binds the selected choice into the proposal hash so two stances are two bindings", async () => {
    const volunteer = await built("I would volunteer.");
    const decline = await built("I would not volunteer.");
    const factual = await built(null);
    if (!volunteer.ok || !decline.ok || !factual.ok) throw new Error("build failed");
    expect(volunteer.input.communication_binding.proposal_hash).not.toBe(decline.input.communication_binding.proposal_hash);
    expect(volunteer.input.communication_binding.proposal_hash).not.toBe(factual.input.communication_binding.proposal_hash);
    expect(volunteer.input_hash).not.toBe(decline.input_hash);
  });

  it("preserves cross-request isolation and prevents duplicate completion", async () => {
    const first = await built("I would volunteer.", "opaque-c3-first");
    const second = await built("I would volunteer.", "opaque-c3-second");
    if (!first.ok || !second.ok) throw new Error("build failed");
    expect(first.input_hash).not.toBe(second.input_hash);
    let calls = 0;
    const transport: ModelTransportV0 = { complete: async () => { calls += 1; return { content: JSON.stringify({ schema_version: "language-realization-semantic-draft-v1", text: "ok", evidence_refs: [] }), model: "fake" }; } };
    const provider = new LanguageRealizationProviderV0(transport);
    await expect(provider.realize({ input: first.input, input_hash: WRONG_HASH as never, lawful_evidence_refs: new Set([OBS]) })).rejects.toThrow(/INPUT_HASH_MISMATCH/);
    expect(calls).toBe(0);
    await provider.realize({ input: first.input, input_hash: first.input_hash, lawful_evidence_refs: new Set([OBS]) });
    await expect(provider.realize({ input: first.input, input_hash: first.input_hash, lawful_evidence_refs: new Set([OBS]) })).rejects.toThrow(/duplicate invocation/);
    await provider.realize({ input: second.input, input_hash: second.input_hash, lawful_evidence_refs: new Set([OBS]) });
    expect(calls).toBe(2);
  });
});
