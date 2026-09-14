/**
 * Family C4 language handoff (V6): the tagged choice is authoritative, the
 * rationale never becomes evidence, and `NOT_APPLICABLE` cannot produce an
 * invented preference. All transports are deterministic fakes; zero model calls.
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
import { validateConversationCognitionProposalV5 } from "./conversation-cognition-proposal.js";
import {
  buildLanguageRealizationInputV6,
  validateLanguageRealizationInputAnyVersion
} from "./language-realization-input.js";

const OBS = "observation:c4-language";
const HASH = `sha256:${"a".repeat(64)}` as HashV1;
const WRONG_HASH = `sha256:${"b".repeat(64)}` as HashV1;

function projection(): CognitiveContextProjectionV2 {
  return {
    schema_version: "cognitive-context-projection-v2", subject_id: "subject-c4-language" as never,
    current_logical_time: 2 as never, state_revision: 2 as never, traits_dimensions: {}, personality_dimensions: {},
    personality_disposition: {}, canonical_affect: { schema_version: "canonical-affect-cognition-projection-v0", valence: -0.6, activation: 0.5 } as never,
    regulation: { energy: 1, stress: 0, arousal: 0.5, fatigue: 0 },
    context: { scene: "Would you volunteer for the weekend shift?", task: "Decide.", focus_refs: [], active_entity_refs: [], environment_refs: [], current_observation_ref: OBS as never },
    memory_working_refs: [], recent_retrieval_refs: [], belief_item_count: 0, belief_items: [], relationship_counterpart_count: 0,
    relationship_dimensions: [], interaction_familiarity: [], interaction_familiarity_cognition_influences: [], allowed_actions: [], projection_hash: HASH
  };
}

/** Host-bound V5 proposal: cognition.projection_hash was injected by the host. */
async function hostBoundProposal(choice: unknown) {
  const checked = validateConversationCognitionProposalV5({
    schema_version: "conversation-cognition-proposal-v5",
    factual_assessment: { claims: [] },
    cognition: {
      schema_version: "cognition-proposal-v0", reasoning_summary: "the teammate asks for a commitment",
      relevant_memory_refs: [], considered_context_refs: [], current_intent: "summarize and decide",
      confidence: 1, uncertainty: 0, action_intent: null, evidence_refs: []
    },
    subjective_choice: choice,
    communication_directive: { kind: "REALIZE_CURRENT_INTENT" },
    clarification_basis: null
  }, projection(), HASH);
  if (!checked.ok) throw new Error(checked.detail);
  return checked.proposal;
}

async function built(choice: unknown, requestId = "opaque-c4-a1b2c3") {
  return buildLanguageRealizationInputV6({
    subject_id: projection().subject_id, source_revision: projection().state_revision,
    response_request_id: requestId as never, projection: projection(),
    conversation_proposal: await hostBoundProposal(choice), memory_episode_contents: []
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

describe("LanguageRealizationInputV6", () => {
  it("carries the tagged choice, excludes raw subject state and forbids rationale authority", async () => {
    const result = await built({ kind: "SELECTED", stance: "I would volunteer.", subjective_rationale: "I prefer to help." });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.input.schema_version).toBe("language-realization-input-v6");
    expect(result.input.selected_subjective_choice).toEqual({ kind: "SELECTED", stance: "I would volunteer.", subjective_rationale: "I prefer to help." });
    expect(result.input.communication_binding.schema_version).toBe("conversation-cognition-proposal-v5");
    expect(result.input.constraints.no_factual_authority_for_rationale).toBe(true);
    expect(result.input).not.toHaveProperty("selected_current_intent");
    for (const forbidden of ["canonical_affect", "affect_channels", "mood_baseline", "regulation", "belief_items", "personality_dimensions", "reasoning_summary"]) {
      expect(result.input).not.toHaveProperty(forbidden);
    }
    expect(validateLanguageRealizationInputAnyVersion(result.input).ok).toBe(true);
    expect(Object.isFrozen(result.input)).toBe(true);
  });

  it("carries NOT_APPLICABLE as a positive token", async () => {
    const result = await built({ kind: "NOT_APPLICABLE" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.input.selected_subjective_choice).toEqual({ kind: "NOT_APPLICABLE" });
    // The C3-era implicit null carrier is no longer a lawful handoff.
    const legacyNull = await buildLanguageRealizationInputV6({
      subject_id: projection().subject_id, source_revision: projection().state_revision, response_request_id: "opaque" as never,
      projection: projection(), conversation_proposal: { ...(await hostBoundProposal({ kind: "NOT_APPLICABLE" })), subjective_choice: null } as never,
      memory_episode_contents: []
    });
    expect(legacyNull.ok).toBe(false);
  });

  it("rejects caller-supplied facts or choice, wrong subject/revision, an untagged choice and a stale projection", async () => {
    const p = projection();
    const base = {
      subject_id: p.subject_id, source_revision: p.state_revision, response_request_id: "opaque" as never,
      projection: p, conversation_proposal: await hostBoundProposal({ kind: "SELECTED", stance: "I would volunteer.", subjective_rationale: null }),
      memory_episode_contents: []
    };
    expect((await buildLanguageRealizationInputV6({ ...base, subject_id: "subject-other" as never })).ok).toBe(false);
    expect((await buildLanguageRealizationInputV6({ ...base, source_revision: 9 as never })).ok).toBe(false);
    expect((await buildLanguageRealizationInputV6({ ...base, selected_subjective_choice: { kind: "NOT_APPLICABLE" } } as never)).ok).toBe(false);
    expect((await buildLanguageRealizationInputV6({ ...base, projection: { ...p, projection_hash: WRONG_HASH as never } })).ok).toBe(false);
  });

  it("rejects a CLARIFY proposal and a tampered stance at the language boundary", async () => {
    const clarify = validateConversationCognitionProposalV5({
      schema_version: "conversation-cognition-proposal-v5",
      factual_assessment: { claims: [] },
      cognition: {
        schema_version: "cognition-proposal-v0", reasoning_summary: "need the identifier",
        relevant_memory_refs: [], considered_context_refs: [OBS], current_intent: "ask for the required identifier",
        confidence: 1, uncertainty: 0, action_intent: null, evidence_refs: [OBS]
      },
      subjective_choice: { kind: "NOT_APPLICABLE" },
      communication_directive: { kind: "CLARIFY_MISSING_CONTEXT" },
      clarification_basis: { current_observation_ref: OBS, missing_information: "the required identifier", needed_for: "the lookup" }
    }, projection(), HASH);
    if (!clarify.ok) throw new Error(clarify.detail);
    const builtClarify = await buildLanguageRealizationInputV6({
      subject_id: projection().subject_id, source_revision: projection().state_revision, response_request_id: "opaque" as never,
      projection: projection(), conversation_proposal: clarify.proposal, memory_episode_contents: []
    });
    expect(builtClarify.ok).toBe(false);

    const tampered = { ...(await hostBoundProposal({ kind: "NOT_APPLICABLE" })), subjective_choice: { kind: "SELECTED", stance: "REALIZE_CURRENT_INTENT", subjective_rationale: null } };
    const builtTampered = await buildLanguageRealizationInputV6({
      subject_id: projection().subject_id, source_revision: projection().state_revision, response_request_id: "opaque" as never,
      projection: projection(), conversation_proposal: tampered as never, memory_episode_contents: []
    });
    expect(builtTampered.ok).toBe(false);
  });
});

describe("Language stage under C4", () => {
  it("forbids preference on NOT_APPLICABLE and forbids upgrading the rationale into a fact", async () => {
    const notApplicable = await built({ kind: "NOT_APPLICABLE" });
    if (!notApplicable.ok) throw new Error(notApplicable.detail);
    const transport = new Capture({ schema_version: "language-realization-semantic-draft-v1", text: "The shift is on the weekend.", evidence_refs: [] });
    const provider = new LanguageRealizationProviderV0(transport);
    const draft = await provider.realize({ input: notApplicable.input, input_hash: notApplicable.input_hash, lawful_evidence_refs: new Set([OBS]) });
    expect(draft.input_hash).toBe(notApplicable.input_hash);
    expect(transport.requests[0]?.structured_output).toEqual({ kind: "JSON_SCHEMA", schema: LANGUAGE_REALIZATION_SEMANTIC_DRAFT_V1_JSON_SCHEMA });
    const modelInput = transport.requests[0]?.messages.map((message) => message.content).join("\n") ?? "";
    expect(modelInput).not.toContain(notApplicable.input_hash);
    expect(modelInput).not.toContain('"input_hash"');
    expect(modelInput).toContain('"kind": "NOT_APPLICABLE"');
    expect(modelInput).toContain("Do NOT introduce");
    expect(modelInput).toContain("never upgrade it into a factual claim");
    expect(modelInput).toContain("express no preference at all");
    const binding = provider.lastInvocationBinding;
    if (binding === null) throw new Error("host invocation binding missing");
    expect(binding.conversation_cognition_proposal_hash).toBe(notApplicable.input.communication_binding.proposal_hash);
    expect(await deriveLanguageInvocationBindingHashV0(binding)).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it("hands over the selected stance and its rationale, and binds them into the proposal hash", async () => {
    const withBasis = await built({ kind: "SELECTED", stance: "I would stop now.", subjective_rationale: "I prefer not to spend unmeasured effort." });
    const withoutBasis = await built({ kind: "SELECTED", stance: "I would stop now.", subjective_rationale: null });
    const notApplicable = await built({ kind: "NOT_APPLICABLE" });
    if (!withBasis.ok || !withoutBasis.ok || !notApplicable.ok) throw new Error("build failed");
    expect(withBasis.input.selected_subjective_choice).toEqual({ kind: "SELECTED", stance: "I would stop now.", subjective_rationale: "I prefer not to spend unmeasured effort." });
    expect(withoutBasis.input.selected_subjective_choice).toEqual({ kind: "SELECTED", stance: "I would stop now.", subjective_rationale: null });
    expect(withoutBasis.input.communication_binding.proposal_hash).not.toBe(withBasis.input.communication_binding.proposal_hash);
    expect(withoutBasis.input_hash).not.toBe(withBasis.input_hash);
    expect(notApplicable.input_hash).not.toBe(withBasis.input_hash);
  });

  it("rejects model-generated integrity metadata and preserves cross-request isolation", async () => {
    const result = await built({ kind: "SELECTED", stance: "I would volunteer.", subjective_rationale: null });
    if (!result.ok) throw new Error(result.detail);
    const provider = new LanguageRealizationProviderV0(new Capture({ schema_version: "language-realization-semantic-draft-v1", input_hash: result.input_hash, text: "ok", evidence_refs: [] }));
    await expect(provider.realize({ input: result.input, input_hash: result.input_hash, lawful_evidence_refs: new Set([OBS]) })).rejects.toThrow(/unexpected keys/);

    const first = await built({ kind: "SELECTED", stance: "I would volunteer.", subjective_rationale: null }, "opaque-c4-first");
    const second = await built({ kind: "SELECTED", stance: "I would volunteer.", subjective_rationale: null }, "opaque-c4-second");
    if (!first.ok || !second.ok) throw new Error("build failed");
    expect(first.input_hash).not.toBe(second.input_hash);
    let calls = 0;
    const transport: ModelTransportV0 = { complete: async () => { calls += 1; return { content: JSON.stringify({ schema_version: "language-realization-semantic-draft-v1", text: "ok", evidence_refs: [] }), model: "fake" }; } };
    const host = new LanguageRealizationProviderV0(transport);
    await expect(host.realize({ input: first.input, input_hash: WRONG_HASH, lawful_evidence_refs: new Set([OBS]) })).rejects.toThrow(/INPUT_HASH_MISMATCH/);
    expect(calls).toBe(0);
    await host.realize({ input: first.input, input_hash: first.input_hash, lawful_evidence_refs: new Set([OBS]) });
    await expect(host.realize({ input: first.input, input_hash: first.input_hash, lawful_evidence_refs: new Set([OBS]) })).rejects.toThrow(/duplicate invocation/);
    await host.realize({ input: second.input, input_hash: second.input_hash, lawful_evidence_refs: new Set([OBS]) });
    expect(calls).toBe(2);
  });
});
