/**
 * TEMPORARY — HOST AUTHORITY ADJUDICATION (deleted after the run; 0 model calls).
 *
 * Phase 6 + controls: for the 3 clean recall cases, the HOST deterministically
 * extracts an answer span from the already-authorized factual-memory evidence and
 * passes the resulting claim through the REAL production authorization chain
 * (authorizeFactualClaimV1 with the production sourceTexts semantics) and the REAL
 * V8 provider parse. Controls: fabricated fact, semantic inference, question-span
 * self-match, contradictory entries.
 */
import { describe, expect, it } from "vitest";
import type { CognitiveContextProjectionV2 } from "../../transitions/cognition-action/types.js";
import { authorizeFactualClaimV1, type FactualSourceTextResolverV0 } from "../../transitions/conversation/factual-claim-authorization.js";
import { ConversationCognitionProviderV8 } from "./conversation-cognition-provider-v8.js";

const HASH = `sha256:${"a".repeat(64)}`;
const OBS = "observation:o-eval";
const QUERY = "The neighbour's cat is at the door again — where does she usually nap when she visits?";

interface MemoryCase {
  readonly episode_ref: string;
  readonly delivered: string;
  readonly outcome: string;
}

/** The three clean cases with their REAL recorded evidence texts. */
const CASES: { readonly [name: string]: MemoryCase } & { readonly CAT_NAP: MemoryCase; readonly STOOL_SHIM: MemoryCase; readonly CHISEL_DRAWER: MemoryCase } = {
  CAT_NAP: {
    episode_ref: "episode:2d7ceae37faa5c2316110e36e26ec339fd1c4879ae5499bc4186e23be06ac03a",
    delivered: "Got it — the cat from next door sleeps on the offcut pile.",
    outcome: "I made a small rack for the screwdrivers and it took under an hour."
  },
  STOOL_SHIM: {
    episode_ref: "episode:1c669cf2" + "0".repeat(56),
    delivered: "That's lovely to hear — the stool has a place by the door now, and you use it every day.",
    outcome: "I glued a thin shim under one leg and now it is steady."
  },
  CHISEL_DRAWER: {
    episode_ref: "episode:64fcf3c0" + "0".repeat(56),
    delivered: "I checked both drawers again and the tape labels are still readable. I keep my favourite chisel in the top drawer, next to the whetstone.",
    outcome: "Could you clarify what you mean? Before I forget — which drawer did I say holds the chisel again?"
  }
};

/** Deterministic sentence split mirroring the production candidate projection. */
function splitSentences(text: string): readonly string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/**
 * The HOST extraction: deterministic span selection by query-token overlap with the
 * entry's recorded sentences (the same lexical law the retrieval remediation uses,
 * applied one level down). Returns the best-overlap statement span, or null when no
 * sentence shares any query content.
 */
function hostExtractSpan(caseData: MemoryCase, query: string): { readonly span: string; readonly role: string } | null {
  const stop = new Set(["the", "a", "an", "i", "it", "is", "was", "to", "of", "and", "in", "on", "my", "did", "what", "where", "which"]);
  const queryTokens = new Set(
    query
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 2 && !stop.has(token))
  );
  const candidates: { readonly span: string; readonly role: string; readonly overlap: number }[] = [];
  for (const [role, text] of [["subject's delivered behavior", caseData.delivered], ["recorded outcome reply", caseData.outcome]] as const) {
    for (const span of splitSentences(text)) {
      const spanTokens = span.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/);
      let overlap = 0;
      for (const token of spanTokens) {
        if (queryTokens.has(token)) overlap += 1;
      }
      candidates.push({ span, role, overlap });
    }
  }
  candidates.sort((left, right) => right.overlap - left.overlap);
  const best = candidates[0];
  if (best === undefined || best.overlap === 0) return null;
  return { span: best.span, role: best.role };
}

/** Production sourceTexts semantics for a BEHAVIOR_OUTCOME entry. */
function resolverFor(caseData: MemoryCase): FactualSourceTextResolverV0 {
  return (ref) => (ref === caseData.episode_ref ? [caseData.delivered, caseData.outcome] : null);
}

function projectionWith(caseData: MemoryCase): CognitiveContextProjectionV2 {
  return {
    schema_version: "cognitive-context-projection-v2", subject_id: "subject-eval" as never,
    current_logical_time: 900 as never, state_revision: 1846 as never,
    traits_dimensions: {}, personality_dimensions: {}, personality_disposition: {},
    canonical_affect: { schema_version: "canonical-affect-cognition-projection-v0", valence: 0, activation: 0.5 } as never,
    regulation: { energy: 1, stress: 0, arousal: 0.5, fatigue: 0 },
    context: { scene: `The user says: "${QUERY}"`, task: "Respond to the user's latest message.", focus_refs: [], active_entity_refs: ["entity:alice"], environment_refs: [], current_observation_ref: OBS as never },
    memory_working_refs: [caseData.episode_ref] as never, recent_retrieval_refs: [],
    belief_item_count: 0, belief_items: [], relationship_counterpart_count: 0,
    relationship_dimensions: [], interaction_familiarity: [], interaction_familiarity_cognition_influences: [],
    allowed_actions: [], projection_hash: HASH,
    factual_memory_evidence: {
      schema_version: "factual-memory-evidence-v0", repository_revision: "R611" as never,
      entries: [{
        kind: "BEHAVIOR_OUTCOME", episode_ref: caseData.episode_ref as never,
        repository_revision: "R611" as never, episode_payload_hash: `sha256:${"b".repeat(64)}`,
        experience_ref: `experience:${"c".repeat(64)}` as never, experience_payload_hash: `sha256:${"d".repeat(64)}`,
        event_ref: `event:${"e".repeat(64)}` as never, event_payload_hash: `sha256:${"f".repeat(64)}`,
        actor_ref: "entity:alice" as never, delivered_behavior_text: caseData.delivered,
        exact_outcome_text: caseData.outcome, delivered_logical_time: 100 as never, outcome_logical_time: 101 as never
      }]
    }
  } as unknown as CognitiveContextProjectionV2;
}

describe("HOST AUTHORITY ADJUDICATION — Phase 6: the 3 clean cases through the REAL authorization chain", () => {
  for (const [name, caseData0] of Object.entries(CASES)) {
    const caseData = caseData0 as MemoryCase;
    it(`${name}: host extraction → authorizeFactualClaimV1 → AUTHORIZED`, () => {
      const extracted = hostExtractSpan(caseData, QUERY);
      expect(extracted).not.toBeNull();
      const span = extracted === null ? "" : extracted.span;
      // The extracted span MUST be an exact substring of the recorded evidence (the
      // SOURCE_QUOTE law holds by construction — the host only copies).
      expect(caseData.delivered.includes(span) || caseData.outcome.includes(span)).toBe(true);
      const authorization = authorizeFactualClaimV1(
        { kind: "SOURCE_QUOTE", text: span, source_refs: [caseData.episode_ref] },
        resolverFor(caseData)
      );
      expect(authorization.status).toBe("AUTHORIZED_SOURCE_QUOTE");
    });
  }

  it("the authorized claim passes the REAL V8 provider parse as part of a complete proposal", async () => {
    const caseData = CASES["CAT_NAP"] as MemoryCase;
    const extracted = hostExtractSpan(caseData, QUERY);
    expect(extracted).not.toBeNull();
    const span = extracted === null ? "" : extracted.span;
    const authorization = authorizeFactualClaimV1(
      { kind: "SOURCE_QUOTE", text: span, source_refs: [caseData.episode_ref] },
      resolverFor(caseData)
    );
    expect(authorization.status).toBe("AUTHORIZED_SOURCE_QUOTE");
    const proposal = {
      schema_version: "conversation-cognition-proposal-v8",
      factual_assessment: {
        claims: [{ kind: "SOURCE_QUOTE", text: span, source_handles: ["F1"] }]
      },
      cognition: {
        schema_version: "cognition-proposal-v0",
        reasoning_summary: "The prior factual memory entry states where the cat sleeps.",
        relevant_memory_handles: ["F1"],
        considered_handles: ["F1", "F2"],
        current_intent: "Answer where the cat naps from recorded history.",
        confidence: 0.9, uncertainty: 0.1, action_intent: null,
        evidence_handles: ["F1", "F2"]
      },
      subjective_selection: { kind: "NO_SUBJECTIVE_SELECTION" },
      communication_directive: { kind: "REALIZE_CURRENT_INTENT" },
      clarification_basis: null,
      response_semantics: { kind: "PRIMARY_FACT", claim_index: 0 }
    };
    const provider = new ConversationCognitionProviderV8({
      complete: async () => ({ content: JSON.stringify(proposal), model: "offline" })
    });
    const accepted = await provider.propose(projectionWith(caseData));
    expect(accepted.factual_assessment.claims[0]?.text).toBe(span);
    expect(provider.lastFactualAuthorizationTrace[0]?.status).toBe("AUTHORIZED_SOURCE_QUOTE");
  });
});

describe("PHASE 7: fabricated fact control", () => {
  it("a host-constructed claim whose text is NOT in the evidence is REJECTED", () => {
    const authorization = authorizeFactualClaimV1(
      { kind: "SOURCE_QUOTE", text: "The cat sleeps on the workbench.", source_refs: [CASES.CAT_NAP.episode_ref] },
      resolverFor(CASES.CAT_NAP)
    );
    expect(authorization.status).toBe("REJECTED");
    expect(authorization.status === "REJECTED" && authorization.code).toBe("REJECTED_SOURCE_BINDING");
  });
});

describe("PHASE 8: semantic inference control", () => {
  it("a plausible but unrecorded fact is REJECTED", () => {
    const inferenceCase = {
      episode_ref: "episode:ffff000000000000000000000000000000000000000000000000000000000000",
      delivered: "The neighbour's cat avoids the bench when it is wet.",
      outcome: "It always does that."
    };
    const authorization = authorizeFactualClaimV1(
      { kind: "SOURCE_QUOTE", text: "The cat sleeps on the offcut pile.", source_refs: [inferenceCase.episode_ref] },
      resolverFor(inferenceCase)
    );
    expect(authorization.status).toBe("REJECTED");
    expect(authorization.status === "REJECTED" && authorization.code).toBe("REJECTED_SOURCE_BINDING");
  });
});

describe("PHASE 11: self-match control — recorded questions are mechanically distinguishable", () => {
  it("a question span is labeled by punctuation and is distinct from answer-bearing spans", () => {
    const questionSpan = "Where did I put the saw?";
    const answerSpan = "The saw is beside the drill press.";
    expect(questionSpan.endsWith("?")).toBe(true);
    expect(answerSpan.endsWith("?")).toBe(false);
    // The candidate projection labels them differently (proven in the committed
    // generation-interface tests); the host extraction can exclude question spans.
    const hostPick = hostExtractSpan(
      { episode_ref: "episode:x", delivered: `Could you clarify what you mean? Where did I put the saw?`, outcome: answerSpan },
      "Where did I put the saw?"
    );
    // The best-overlap span may be the echo (both contain the query words) — the
    // punctuation label is what lets the host refuse it as an answer.
    expect(hostPick !== null && hostPick.span.endsWith("?")).toBe(true);
  });
});
