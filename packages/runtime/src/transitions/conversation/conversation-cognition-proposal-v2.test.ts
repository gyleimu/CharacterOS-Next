/**
 * AFFECT_COGNITION_AUTHORITY_CONTRACT_AND_REVALIDATION_V0 — deterministic
 * regressions for the GPT-6 Family C conversation protocol.
 *
 * Fully offline (0 real model calls). Proves the structural authority boundary:
 *   - proposal V2 closed schema + CLARIFY/REALIZE clarification-basis contract;
 *   - basis observation-ref binding (wrong/cross-turn/stale refs fail closed);
 *   - bounded canonical text for both basis fields;
 *   - the V2 hash domain binds cognition + directive + clarification_basis;
 *   - the V2 language binding reconstructs the V2 hash and rejects V1 masquerade;
 *   - language receives no raw Affect and requires a null basis on REALIZE;
 *   - the historical Phase-2 V1 N1 response is NOT silently accepted as V2.
 */

import { describe, expect, it } from "vitest";
import { hashEnvelope } from "@characteros-next/subject-core";
import type { CognitiveContextProjectionAnyVersion } from "../cognition-action/types.js";
import {
  CLARIFICATION_BASIS_TEXT_MAX_CODE_POINTS,
  CONVERSATION_COGNITION_PROPOSAL_HASH_PROJECTION_V2,
  deriveConversationCognitionProposalHashV2,
  validateConversationCognitionProposalV2
} from "./conversation-cognition-proposal.js";
import { buildLanguageRealizationInputV1, validateLanguageRealizationInputAnyVersion } from "./language-realization-input.js";

const OBS = "observation:o-current-1";
const HASH = `sha256:${"a".repeat(64)}`;

function projection(overrides: Record<string, unknown> = {}): CognitiveContextProjectionAnyVersion {
  return {
    schema_version: "cognitive-context-projection-v2",
    subject_id: "subject-s0",
    current_logical_time: 4,
    state_revision: 4,
    canonical_affect: { schema_version: "canonical-affect-cognition-projection-v0", valence: -0.6, activation: 0.5 },
    regulation: { energy: 1, stress: 0, arousal: 0.5, fatigue: 0 },
    context: {
      scene: "Alice asks something ambiguous.",
      task: "respond",
      focus_refs: [],
      active_entity_refs: ["entity:alice"],
      environment_refs: [],
      current_observation_ref: OBS
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
    projection_hash: HASH,
    ...overrides
  } as unknown as CognitiveContextProjectionAnyVersion;
}

function cognition(projectionHash = HASH): Record<string, unknown> {
  return {
    schema_version: "cognition-proposal-v0",
    projection_hash: projectionHash,
    reasoning_summary: "offline",
    relevant_memory_refs: [],
    considered_context_refs: [],
    current_intent: "respond",
    confidence: 0.8,
    uncertainty: 0.2,
    action_intent: null,
    evidence_refs: []
  };
}

function basis(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    current_observation_ref: OBS,
    missing_information: "which document the request refers to",
    needed_for: "answering the current request",
    ...overrides
  };
}

function proposal(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema_version: "conversation-cognition-proposal-v2",
    cognition: cognition(),
    communication_directive: { kind: "REALIZE_CURRENT_INTENT" },
    clarification_basis: null,
    ...overrides
  };
}

describe("ConversationCognitionProposalV2 — structural authority contract", () => {
  it("accepts a lawful REALIZE (null basis) and a lawful CLARIFY (bound basis)", () => {
    const realize = validateConversationCognitionProposalV2(proposal(), projection());
    expect(realize.ok).toBe(true);
    if (realize.ok) expect(realize.proposal.clarification_basis).toBeNull();

    const clarify = validateConversationCognitionProposalV2(
      proposal({ communication_directive: { kind: "CLARIFY_MISSING_CONTEXT" }, clarification_basis: basis() }),
      projection()
    );
    expect(clarify.ok).toBe(true);
    if (clarify.ok) {
      expect(clarify.proposal.clarification_basis?.current_observation_ref).toBe(OBS);
    }
  });

  it("rejects the historical V1 schema and any unknown/extra outer key", () => {
    const v1 = proposal({ schema_version: "conversation-cognition-proposal-v1" });
    expect(validateConversationCognitionProposalV2(v1, projection()).ok).toBe(false);
    expect(validateConversationCognitionProposalV2(proposal({ extra: 1 }), projection()).ok).toBe(false);
    const missingKey = proposal();
    delete (missingKey as Record<string, unknown>)["clarification_basis"];
    expect(validateConversationCognitionProposalV2(missingKey, projection()).ok).toBe(false);
  });

  it("enforces CLARIFY ⇒ basis != null and REALIZE ⇒ basis == null", () => {
    const clarifyNoBasis = proposal({ communication_directive: { kind: "CLARIFY_MISSING_CONTEXT" } });
    expect(validateConversationCognitionProposalV2(clarifyNoBasis, projection()).ok).toBe(false);

    const realizeWithBasis = proposal({ clarification_basis: basis() });
    expect(validateConversationCognitionProposalV2(realizeWithBasis, projection()).ok).toBe(false);
  });

  it("binds the basis observation ref to the current projection observation (wrong/cross-turn/stale refs fail)", () => {
    for (const ref of [
      "observation:o-other-turn",
      "episode:e-1",
      "entity:alice",
      "subject:other",
      ""
    ]) {
      const candidate = proposal({
        communication_directive: { kind: "CLARIFY_MISSING_CONTEXT" },
        clarification_basis: basis({ current_observation_ref: ref })
      });
      expect(validateConversationCognitionProposalV2(candidate, projection()).ok, ref).toBe(false);
    }
    // No current observation at all ⇒ CLARIFY has nothing to bind to ⇒ fail closed.
    const noObservation = projection({ context: { scene: "x", task: null, focus_refs: [], active_entity_refs: [], environment_refs: [], current_observation_ref: null } });
    const candidate = proposal({
      communication_directive: { kind: "CLARIFY_MISSING_CONTEXT" },
      clarification_basis: basis({ current_observation_ref: "observation:o-anything" })
    });
    expect(validateConversationCognitionProposalV2(candidate, noObservation).ok).toBe(false);
  });

  it("requires bounded non-empty canonical text and a closed basis schema", () => {
    const withBasis = (b: Record<string, unknown>) =>
      proposal({ communication_directive: { kind: "CLARIFY_MISSING_CONTEXT" }, clarification_basis: b });
    expect(validateConversationCognitionProposalV2(withBasis(basis({ missing_information: "" })), projection()).ok).toBe(false);
    expect(
      validateConversationCognitionProposalV2(
        withBasis(basis({ missing_information: "x".repeat(CLARIFICATION_BASIS_TEXT_MAX_CODE_POINTS + 1) })),
        projection()
      ).ok
    ).toBe(false);
    expect(validateConversationCognitionProposalV2(withBasis(basis({ needed_for: "" })), projection()).ok).toBe(false);
    expect(
      validateConversationCognitionProposalV2(
        withBasis(basis({ needed_for: "y".repeat(CLARIFICATION_BASIS_TEXT_MAX_CODE_POINTS + 1) })),
        projection()
      ).ok
    ).toBe(false);
    // Non-NFC text is not canonical.
    expect(validateConversationCognitionProposalV2(withBasis(basis({ missing_information: "e\u0301" })), projection()).ok).toBe(false);
    // Unknown basis field.
    expect(validateConversationCognitionProposalV2(withBasis(basis({ extra: "x" })), projection()).ok).toBe(false);
    // Boundary is inclusive at exactly the frozen maximum.
    expect(
      validateConversationCognitionProposalV2(
        withBasis(basis({ missing_information: "z".repeat(CLARIFICATION_BASIS_TEXT_MAX_CODE_POINTS) })),
        projection()
      ).ok
    ).toBe(true);
  });

  it("binds cognition + directive + clarification_basis in the V2 hash domain, distinct from V1", async () => {
    const realize = proposal();
    const clarify = proposal({
      communication_directive: { kind: "CLARIFY_MISSING_CONTEXT" },
      clarification_basis: basis()
    });
    const realizeHash = await deriveConversationCognitionProposalHashV2(realize as never);
    const clarifyHash = await deriveConversationCognitionProposalHashV2(clarify as never);
    expect(realizeHash).not.toBe(clarifyHash);

    const body = {
      schema_version: "conversation-cognition-proposal-v2",
      cognition: cognition(),
      communication_directive: { kind: "REALIZE_CURRENT_INTENT" },
      clarification_basis: null
    };
    expect(realizeHash).toBe(await hashEnvelope(CONVERSATION_COGNITION_PROPOSAL_HASH_PROJECTION_V2, body));
    // A V1-domain hash of the same cognition/directive is a different value.
    const v1Hash = await hashEnvelope("characteros-next/runtime/conversation-cognition-proposal/v1", {
      schema_version: "conversation-cognition-proposal-v1",
      cognition: cognition(),
      communication_directive: { kind: "REALIZE_CURRENT_INTENT" }
    });
    expect(v1Hash).not.toBe(realizeHash);
  });

  it("historically replays the saved Phase-2 V1 N1 response: NOT silently accepted as V2", () => {
    // Exact shape of the Phase-2 N1/Z response (raw-cognition.jsonl): a V1
    // conversation proposal whose CLARIFY carried no structural basis.
    const historicalN1 = {
      schema_version: "conversation-cognition-proposal-v1",
      cognition: {
        schema_version: "cognition-proposal-v0",
        projection_hash: HASH,
        reasoning_summary: "Since the specific answer is not in the citeable memory, I must clarify.",
        relevant_memory_refs: [],
        considered_context_refs: [],
        current_intent: "clarify_missing_context",
        confidence: 0.95,
        uncertainty: 0.05,
        action_intent: null,
        evidence_refs: []
      },
      communication_directive: { kind: "CLARIFY_MISSING_CONTEXT" }
    };
    const checked = validateConversationCognitionProposalV2(historicalN1, projection());
    expect(checked.ok).toBe(false);
    if (!checked.ok) expect(checked.detail).toContain("schema_version");
  });
});

describe("Language V2 binding — REALIZE integrity survives to Language", () => {
  const projectionValue = projection();
  const cognitionValue = cognition();
  const directive = { kind: "REALIZE_CURRENT_INTENT" as const };
  const v1ProposalHash = "sha256:" + "b".repeat(64);

  async function buildWith(hash: string) {
    return buildLanguageRealizationInputV1({
      subject_id: projectionValue.subject_id,
      source_revision: projectionValue.state_revision,
      response_request_id: "response-1" as never,
      projection: projectionValue,
      cognition: cognitionValue,
      conversation_cognition_proposal_hash: hash as never,
      communication_directive: directive,
      memory_episode_contents: []
    });
  }

  it("reconstructs the V2 hash, emits the V3 input, and carries no raw Affect", async () => {
    const hash = await deriveConversationCognitionProposalHashV2({
      schema_version: "conversation-cognition-proposal-v2",
      cognition: cognitionValue as never,
      communication_directive: directive,
      clarification_basis: null
    });
    const built = await buildWith(hash);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.input.schema_version).toBe("language-realization-input-v3");
    expect((built.input as unknown as Record<string, unknown>)).not.toHaveProperty("canonical_affect");
    expect((built.input as unknown as Record<string, unknown>)).not.toHaveProperty("affect_channels");
    expect((built.input as unknown as Record<string, unknown>)).not.toHaveProperty("mood_baseline");
    const binding = (built.input as unknown as Record<string, unknown>)["communication_binding"] as Record<string, unknown>;
    expect(binding["schema_version"]).toBe("conversation-cognition-proposal-v2");
    expect(binding["clarification_basis"]).toBeNull();
    expect(binding["proposal_hash"]).toBe(hash);
  });

  it("rejects a caller-spoofed or V1 hash, and rejects a V1 binding masquerading as V2", async () => {
    expect((await buildWith(v1ProposalHash)).ok).toBe(false);
    const hash = await deriveConversationCognitionProposalHashV2({
      schema_version: "conversation-cognition-proposal-v2",
      cognition: cognitionValue as never,
      communication_directive: directive,
      clarification_basis: null
    });
    const built = await buildWith(hash);
    if (!built.ok) throw new Error(built.detail);
    const base = built.input as unknown as Record<string, unknown>;
    const spoofed = { ...base, communication_binding: { ...(base["communication_binding"] as object), schema_version: "conversation-cognition-proposal-v1" } };
    expect(validateLanguageRealizationInputAnyVersion(spoofed).ok).toBe(false);
    const nonNullBasis = { ...base, communication_binding: { ...(base["communication_binding"] as object), clarification_basis: { current_observation_ref: OBS } } };
    expect(validateLanguageRealizationInputAnyVersion(nonNullBasis).ok).toBe(false);
  });
});
