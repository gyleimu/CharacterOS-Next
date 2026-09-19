/**
 * TEMPORARY — READ-ONLY ARCHITECTURAL ADJUDICATION (deleted after the run; 0 model calls).
 *
 * Hand-constructs the smallest memory-grounded cognition output for ONE clean real
 * recall case (the cat/offcut-pile fact, target rank 2 in the checkpoint-200
 * evaluation) and runs it through the REAL production chain: V8 provider parse →
 * factual authorization → proposal acceptance → language realization input → language
 * draft validation. Controls: current-observation fact, wrong quote, irrelevant quote.
 * No mocks on contract boundaries — only the transport is stubbed (standard test
 * pattern; the transport is not a contract boundary).
 */
import { describe, expect, it } from "vitest";
import type { HashV1 } from "@characteros-next/subject-core";
import type { ModelTransportRequestV0, ModelTransportV0 } from "../../transports/model-transport.js";
import type { CognitiveContextProjectionV2 } from "../../transitions/cognition-action/types.js";
import { ConversationCognitionProviderV8 } from "./conversation-cognition-provider-v8.js";
import { ConversationCognitionRejectionErrorV8 } from "./conversation-cognition-provider-v8.js";
import { buildLanguageRealizationInputV10, validateLanguageRealizationInputAnyVersion } from "../../transitions/conversation/language-realization-input.js";
import { LanguageRealizationProviderV0 } from "./language-realization-provider.js";

const OBS = "observation:o-eval";
const HASH = `sha256:${"a".repeat(64)}` as HashV1;
const CAT_EPISODE = "episode:2d7ceae37faa5c2316110e36e26ec339fd1c4879ae5499bc4186e23be06ac03a";
const CAT_BEHAVIOR = "Got it — the cat from next door sleeps on the offcut pile.";
const CAT_OUTCOME = "I made a small rack for the screwdrivers and it took under an hour.";
const QUERY = "The neighbour's cat is at the door again — where does she usually nap when she visits?";
const QUOTE = "the cat from next door sleeps on the offcut pile";

function projection(overrides: Partial<Record<string, unknown>> = {}): CognitiveContextProjectionV2 {
  return {
    schema_version: "cognitive-context-projection-v2", subject_id: "subject-eval" as never,
    current_logical_time: 900 as never, state_revision: 1846 as never,
    traits_dimensions: {}, personality_dimensions: {}, personality_disposition: {},
    canonical_affect: { schema_version: "canonical-affect-cognition-projection-v0", valence: 0, activation: 0.5 } as never,
    regulation: { energy: 1, stress: 0, arousal: 0.5, fatigue: 0 },
    context: { scene: `The user says: "${QUERY}"`, task: "Respond to the user's latest message.", focus_refs: [], active_entity_refs: ["entity:alice"], environment_refs: [], current_observation_ref: OBS as never },
    memory_working_refs: [CAT_EPISODE as never], recent_retrieval_refs: [],
    belief_item_count: 0, belief_items: [], relationship_counterpart_count: 0,
    relationship_dimensions: [], interaction_familiarity: [], interaction_familiarity_cognition_influences: [],
    allowed_actions: [], projection_hash: HASH,
    factual_memory_evidence: {
      schema_version: "factual-memory-evidence-v0",
      repository_revision: "R611" as never,
      entries: [
        {
          kind: "BEHAVIOR_OUTCOME",
          episode_ref: CAT_EPISODE as never,
          repository_revision: "R611" as never,
          episode_payload_hash: `sha256:${"b".repeat(64)}`,
          experience_ref: "experience:e4730b5f276e558dc3fd99f87e63fae307e47a54177bac4aa069938c370b9244" as never,
          experience_payload_hash: `sha256:${"c".repeat(64)}`,
          event_ref: "event:81fc9f4063a285a993e0cfdbfe02f4b2e2bc5dee8ed75ff107da58feb782e1f2" as never,
          event_payload_hash: `sha256:${"d".repeat(64)}`,
          actor_ref: "entity:alice" as never,
          delivered_behavior_text: CAT_BEHAVIOR,
          exact_outcome_text: CAT_OUTCOME,
          delivered_logical_time: 100 as never,
          outcome_logical_time: 101 as never
        }
      ]
    },
    ...overrides
  } as unknown as CognitiveContextProjectionV2;
}

const MEMORY_GROUNDED_PROPOSAL = {
  schema_version: "conversation-cognition-proposal-v8",
  factual_assessment: {
    claims: [{ kind: "SOURCE_QUOTE", text: QUOTE, source_handles: ["F1"] }]
  },
  cognition: {
    schema_version: "cognition-proposal-v0",
    reasoning_summary: "The prior factual memory entry states where the cat sleeps.",
    relevant_memory_handles: ["F1"],
    considered_handles: ["F1", "F2"],
    current_intent: "Answer where the cat usually naps, from recorded history.",
    confidence: 0.9,
    uncertainty: 0.1,
    action_intent: null,
    evidence_handles: ["F1", "F2"]
  },
  subjective_selection: { kind: "NO_SUBJECTIVE_SELECTION" },
  communication_directive: { kind: "REALIZE_CURRENT_INTENT" },
  clarification_basis: null,
  response_semantics: { kind: "PRIMARY_FACT", claim_index: 0 }
};

/** Fake transport: returns the canned body; records requests. */
function cannedTransport(body: string): { transport: ModelTransportV0; requests: ModelTransportRequestV0[] } {
  const requests: ModelTransportRequestV0[] = [];
  return {
    requests,
    transport: {
      complete: async (request) => {
        requests.push(request);
        return { content: body, model: "offline-fixture" };
      }
    }
  };
}

describe("MEMORY-GROUNDED COGNITION ADJUDICATION (synthetic, 0 model calls)", () => {
  it("MATRIX/cognition: the hand-built memory-grounded proposal passes the REAL V8 parse + factual authorization", async () => {
    const { transport } = cannedTransport(JSON.stringify(MEMORY_GROUNDED_PROPOSAL));
    const provider = new ConversationCognitionProviderV8(transport);
    const accepted = await provider.propose(projection());
    expect(accepted.factual_assessment.claims).toHaveLength(1);
    expect(accepted.factual_assessment.claims[0]?.text).toBe(QUOTE);
    // The claim's source binding resolved to the REAL memory episode ref.
    const trace = provider.lastFactualAuthorizationTrace;
    expect(trace.length).toBe(1);
    expect(trace[0]?.status).toBe("AUTHORIZED_SOURCE_QUOTE");
    // The handle map advertised the memory episode as an F handle.
    const handleMap = provider.lastHandleMap;
    expect(handleMap?.handleToRef.get("F1")).toBe(CAT_EPISODE);
    expect(handleMap?.factualSourceHandles).toContain("F1");
  });

  it("MATRIX/source-quote control: a quote NOT contained in the cited memory source is REJECTED", async () => {
    const forged = JSON.parse(JSON.stringify(MEMORY_GROUNDED_PROPOSAL));
    (forged.factual_assessment.claims[0] as { text: string }).text = "the whetstone is in the bottom drawer";
    const { transport } = cannedTransport(JSON.stringify(forged));
    const provider = new ConversationCognitionProviderV8(transport);
    await expect(provider.propose(projection())).rejects.toMatchObject({ code: "FACTUAL_AUTHORIZATION_REJECTED" });
  });

  it("MATRIX/current-observation control: a fact quoted from the CURRENT SCENE also passes (no memory-only privilege)", async () => {
    const currentGrounded = JSON.parse(JSON.stringify(MEMORY_GROUNDED_PROPOSAL));
    (currentGrounded.factual_assessment.claims[0] as { text: string; source_handles: string[] }).text =
      "The neighbour's cat is at the door again";
    (currentGrounded.factual_assessment.claims[0] as { source_handles: string[] }).source_handles = ["F2"];
    (currentGrounded.cognition as { relevant_memory_handles: string[] }).relevant_memory_handles = [];
    const { transport } = cannedTransport(JSON.stringify(currentGrounded));
    const provider = new ConversationCognitionProviderV8(transport);
    const accepted = await provider.propose(projection());
    expect(accepted.factual_assessment.claims[0]?.source_refs).toEqual(["observation:o-eval"]);
  });

  it("MATRIX/language: the accepted memory-grounded proposal builds a REALIZATION INPUT whose authorized claims carry the memory fact and the source ref", async () => {
    const { transport } = cannedTransport(JSON.stringify(MEMORY_GROUNDED_PROPOSAL));
    const provider = new ConversationCognitionProviderV8(transport);
    const accepted = await provider.propose(projection());
    const built = await buildLanguageRealizationInputV10({
      subject_id: projection().subject_id,
      source_revision: projection().state_revision,
      response_request_id: "eval-request" as never,
      projection: projection() as never,
      conversation_proposal: accepted as never,
      memory_episode_contents: []
    });
    if (!built.ok) throw new Error(`language input build failed: ${built.detail}`);
    const inputCheck = validateLanguageRealizationInputAnyVersion(built.input);
    expect(inputCheck.ok).toBe(true);
    // The authorized payload must carry the memory-grounded fact for Language.
    const payload = JSON.stringify(built.input);
    expect(payload).toContain("the cat from next door sleeps on the offcut pile");
    expect(payload).toContain(CAT_EPISODE);
  });

  it("MATRIX/language draft: a draft quoting the memory fact with the episode as evidence ref passes the REAL draft validator", async () => {
    const { transport } = cannedTransport(JSON.stringify(MEMORY_GROUNDED_PROPOSAL));
    const provider = new ConversationCognitionProviderV8(transport);
    const accepted = await provider.propose(projection());
    const built = await buildLanguageRealizationInputV10({
      subject_id: projection().subject_id,
      source_revision: projection().state_revision,
      response_request_id: "eval-request" as never,
      projection: projection() as never,
      conversation_proposal: accepted as never,
      memory_episode_contents: []
    });
    if (!built.ok) throw new Error(built.detail);
    const draftTransport = {
      requests: [] as unknown[],
      complete: async () => ({
        content: JSON.stringify({
          schema_version: "language-realization-semantic-draft-v1",
          text: "She sleeps on the offcut pile — you told me that yourself.",
          evidence_refs: [CAT_EPISODE]
        }),
        model: "offline-fixture"
      })
    };
    const language = new LanguageRealizationProviderV0(draftTransport as unknown as ModelTransportV0);
    const draft = await language.realize({
      input: built.input,
      input_hash: built.input_hash,
      lawful_evidence_refs: new Set([CAT_EPISODE])
    });
    expect(draft.text).toContain("offcut pile");
    expect(draft.evidence_refs).toEqual([CAT_EPISODE]);
  });

  it("MATRIX/clarify: an empty-claim clarification proposal remains structurally lawful (no forced answer)", async () => {
    const clarify = {
      schema_version: "conversation-cognition-proposal-v8",
      factual_assessment: { claims: [] },
      cognition: {
        schema_version: "cognition-proposal-v0",
        reasoning_summary: "No entry resolves the question.",
        relevant_memory_handles: [],
        considered_handles: ["F2"],
        current_intent: null,
        confidence: 0.5,
        uncertainty: 0.5,
        action_intent: null,
        evidence_handles: []
      },
      subjective_selection: { kind: "NO_SUBJECTIVE_SELECTION" },
      communication_directive: { kind: "CLARIFY_MISSING_CONTEXT" },
      clarification_basis: {
        current_observation_ref: OBS,
        missing_information: "which specific object the user is asking about",
        needed_for: "answering the location question"
      },
      response_semantics: { kind: "PRIMARY_CLARIFICATION" }
    };
    const { transport } = cannedTransport(JSON.stringify(clarify));
    const provider = new ConversationCognitionProviderV8(transport);
    const accepted = await provider.propose(projection());
    expect(accepted.communication_directive.kind).toBe("CLARIFY_MISSING_CONTEXT");
  });

  it("MATRIX/recent-vs-old: a recent-memory entry takes the identical path (no age rule in the bundle)", async () => {
    const recentProjection = projection();
    void recentProjection;
    // The evidence bundle carries no age/occurrence field: the same entry shape with a
    // different episode ref passes identically — verified by swapping the ref.
    const swapped = JSON.parse(JSON.stringify(MEMORY_GROUNDED_PROPOSAL));
    (swapped.factual_assessment.claims[0] as { text: string }).text = QUOTE;
    const { transport } = cannedTransport(JSON.stringify(swapped));
    const provider = new ConversationCognitionProviderV8(transport);
    const accepted = await provider.propose(projection({
      memory_working_refs: ["episode:0000000000000000000000000000000000000000000000000000000000000000" as never],
      factual_memory_evidence: {
        schema_version: "factual-memory-evidence-v0",
        repository_revision: "R611" as never,
        entries: [
          {
            kind: "BEHAVIOR_OUTCOME",
            episode_ref: "episode:0000000000000000000000000000000000000000000000000000000000000000" as never,
            repository_revision: "R611" as never,
            episode_payload_hash: `sha256:${"b".repeat(64)}`,
            experience_ref: "experience:e4730b5f276e558dc3fd99f87e63fae307e47a54177bac4aa069938c370b9244" as never,
            experience_payload_hash: `sha256:${"c".repeat(64)}`,
            event_ref: "event:81fc9f4063a285a993e0cfdbfe02f4b2e2bc5dee8ed75ff107da58feb782e1f2" as never,
            event_payload_hash: `sha256:${"d".repeat(64)}`,
            actor_ref: "entity:alice" as never,
            delivered_behavior_text: CAT_BEHAVIOR,
            exact_outcome_text: CAT_OUTCOME,
            delivered_logical_time: 899 as never,
            outcome_logical_time: 900 as never
          }
        ]
      }
    }));
    expect(accepted.factual_assessment.claims[0]?.text).toBe(QUOTE);
    expect(provider.lastHandleMap?.handleToRef.get("F1")).toContain("00000000");
  });

  it("MATRIX/contradiction: two conflicting memory entries are BOTH advertised as claim-admissible sources (contract can represent the conflict)", async () => {
    const entryA = {
      kind: "BEHAVIOR_OUTCOME",
      episode_ref: "episode:aaaa000000000000000000000000000000000000000000000000000000000000" as never,
      repository_revision: "R611" as never,
      episode_payload_hash: `sha256:${"1".repeat(64)}`,
      experience_ref: "experience:aaaa000000000000000000000000000000000000000000000000000000000000" as never,
      experience_payload_hash: `sha256:${"2".repeat(64)}`,
      event_ref: "event:aaaa000000000000000000000000000000000000000000000000000000000000" as never,
      event_payload_hash: `sha256:${"3".repeat(64)}`,
      actor_ref: "entity:alice" as never,
      delivered_behavior_text: "The key was in the drawer.",
      exact_outcome_text: "The key was in the drawer.",
      delivered_logical_time: 10 as never,
      outcome_logical_time: 11 as never
    };
    const entryB = {
      kind: "BEHAVIOR_OUTCOME",
      episode_ref: "episode:bbbb000000000000000000000000000000000000000000000000000000000000" as never,
      repository_revision: "R611" as never,
      episode_payload_hash: `sha256:${"4".repeat(64)}`,
      experience_ref: "experience:bbbb000000000000000000000000000000000000000000000000000000000000" as never,
      experience_payload_hash: `sha256:${"5".repeat(64)}`,
      event_ref: "event:bbbb000000000000000000000000000000000000000000000000000000000000" as never,
      event_payload_hash: `sha256:${"6".repeat(64)}`,
      actor_ref: "entity:alice" as never,
      delivered_behavior_text: "The key was moved to the shelf.",
      exact_outcome_text: "The key was moved to the shelf.",
      delivered_logical_time: 800 as never,
      outcome_logical_time: 801 as never
    };
    // A claim grounded in entry A (the older conflicting entry) — the contract lets
    // EITHER entry be quoted; chronology adjudication lives above retrieval.
    const claimA = {
      schema_version: "conversation-cognition-proposal-v8",
      factual_assessment: {
        claims: [{ kind: "SOURCE_QUOTE", text: "The key was in the drawer.", source_handles: ["F1"] }]
      },
      cognition: {
        schema_version: "cognition-proposal-v0",
        reasoning_summary: "Both entries are available; this turn cites the older one.",
        relevant_memory_handles: ["F1"],
        considered_handles: ["F1", "F2"],
        current_intent: "Answer from the recorded history.",
        confidence: 0.8,
        uncertainty: 0.2,
        action_intent: null,
        evidence_handles: ["F1", "F2"]
      },
      subjective_selection: { kind: "NO_SUBJECTIVE_SELECTION" },
      communication_directive: { kind: "REALIZE_CURRENT_INTENT" },
      clarification_basis: null,
      response_semantics: { kind: "PRIMARY_FACT", claim_index: 0 }
    };
    const { transport } = cannedTransport(JSON.stringify(claimA));
    const provider = new ConversationCognitionProviderV8(transport);
    const acceptedA = await provider.propose(projection({
      memory_working_refs: [entryA.episode_ref, entryB.episode_ref],
      factual_memory_evidence: {
        schema_version: "factual-memory-evidence-v0",
        repository_revision: "R611" as never,
        entries: [entryA, entryB]
      }
    }));
    expect(acceptedA.factual_assessment.claims[0]?.text).toBe("The key was in the drawer.");
    // And entry B is equally claim-admissible (chronology adjudication is upstream).
    const claimB = JSON.parse(JSON.stringify(claimA));
    (claimB.factual_assessment.claims[0] as { text: string }).text = "The key was moved to the shelf.";
    (claimB.factual_assessment.claims[0] as { source_handles: string[] }).source_handles = ["F2"];
    (claimB.cognition as { relevant_memory_handles: string[] }).relevant_memory_handles = ["F2"];
    // One provider instance per projection instance (the invocation binding is
    // one-call-per-projection by frozen law), with its OWN canned transport body.
    const providerB = new ConversationCognitionProviderV8(cannedTransport(JSON.stringify(claimB)).transport);
    const acceptedB = await providerB.propose(projection({
      memory_working_refs: [entryA.episode_ref, entryB.episode_ref],
      factual_memory_evidence: {
        schema_version: "factual-memory-evidence-v0",
        repository_revision: "R611" as never,
        entries: [entryA, entryB]
      }
    }));
    expect(acceptedB.factual_assessment.claims[0]?.text).toBe("The key was moved to the shelf.");
    const map = provider.lastHandleMap;
    const handleA = map?.refToHandle.get(entryA.episode_ref);
    const handleB = map?.refToHandle.get(entryB.episode_ref);
    expect(handleA).toMatch(/^F\d+$/);
    expect(handleB).toMatch(/^F\d+$/);
    // Both conflict-bearing entries are claim-admissible factual sources; either may be
    // quoted (chronology adjudication lives above retrieval, per the frozen law).
    expect(map?.factualSourceHandles).toContain(handleA);
    expect(map?.factualSourceHandles).toContain(handleB);
  });

  it("FACTUAL_AUTHORIZATION trace records the REJECTED status for a forged quote (§14 evidence)", async () => {
    const forged = JSON.parse(JSON.stringify(MEMORY_GROUNDED_PROPOSAL));
    (forged.factual_assessment.claims[0] as { text: string }).text = "the whetstone is in the bottom drawer";
    const { transport } = cannedTransport(JSON.stringify(forged));
    const provider = new ConversationCognitionProviderV8(transport);
    try {
      await provider.propose(projection());
      throw new Error("expected rejection");
    } catch (error) {
      expect(error).toBeInstanceOf(ConversationCognitionRejectionErrorV8);
      const trace = provider.lastFactualAuthorizationTrace;
      expect(trace[0]?.status).toBe("REJECTED");
    }
  });
});
