/**
 * C4.4 regressions (zero model calls):
 *  - CHANGE A: the subjective-selection semantics and the N6 latitude contract
 *  - CHANGE B: model-wire handle canonicalization (resolved, fail-closed, exact)
 *  - the historical R3 ref is reconstructed exactly from a short handle
 */

import { describe, expect, it } from "vitest";
import type { HashV1 } from "@characteros-next/subject-core";
import type { CognitiveContextProjectionV2 } from "../../transitions/cognition-action/types.js";
import {
  buildSourceHandleMapV0,
  canonicalizeConversationCognitionModelOutputV6,
  validateSubjectiveSelectionV1
} from "../../transitions/conversation/conversation-cognition-proposal.js";
import { CONVERSATION_COGNITION_SYSTEM_PROMPT_V6 } from "./conversation-cognition-provider-v6.js";

const OBS = "observation:o-session-t2";
const R3_EPISODE = "episode:858f4cf500a0126c54571327ede96796d6fd909b115236159abc014ad1740053";
const OTHER_EPISODE = "episode:de4430b977b456a61b5a9a6348336a64b7ab6335f702a164911b62fbfca30042";
const HASH = `sha256:${"a".repeat(64)}` as HashV1;
/** The handle the host advertises for the current observation under the default projection. */
const OBS_HANDLE = (() => {
  const map = buildSourceHandleMapV0(projection());
  return map.factualSourceHandles.find((handle) => map.handleToRef.get(handle) === OBS) ?? "F1";
})();

function projection(options: { readonly withR3Episode?: boolean } = {}): CognitiveContextProjectionV2 {
  const entries = [
    {
      episode_ref: R3_EPISODE, kind: "EPISODE_SCENE" as const,
      scene: "The user says: \"The required work is complete. One optional polish pass would take 10 minutes.\""
    },
    {
      episode_ref: OTHER_EPISODE, kind: "BEHAVIOR_OUTCOME" as const,
      delivered_behavior_text: "Noted.", exact_outcome_text: "Alice says the weekly review meeting moved to Thursday."
    }
  ];
  const working = options.withR3Episode === true ? [R3_EPISODE, OTHER_EPISODE] : [OTHER_EPISODE];
  return {
    schema_version: "cognitive-context-projection-v2", subject_id: "subject-c44" as never,
    current_logical_time: 3 as never, state_revision: 3 as never, traits_dimensions: {}, personality_dimensions: {},
    personality_disposition: {}, canonical_affect: { schema_version: "canonical-affect-cognition-projection-v0", valence: 0, activation: 0.5 } as never,
    regulation: { energy: 1, stress: 0, arousal: 0.5, fatigue: 0 },
    context: {
      scene: "What is 63 - 28?", task: "Answer.", focus_refs: [], active_entity_refs: ["entity:alice"], environment_refs: ["environment:room-1"],
      current_observation_ref: OBS as never
    },
    memory_working_refs: working as never,
    recent_retrieval_refs: [], belief_item_count: 0, belief_items: [], relationship_counterpart_count: 0,
    relationship_dimensions: [], interaction_familiarity: [], interaction_familiarity_cognition_influences: [],
    allowed_actions: [], projection_hash: HASH,
    // The inspectable factual source content the host binds to each episode ref.
    factual_memory_evidence: { entries }
  } as unknown as CognitiveContextProjectionV2;
}

/** A wire payload using handles only; `overrides` may break a specific field. */
function wire(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: "conversation-cognition-proposal-v6",
    factual_assessment: { claims: [{ kind: "DERIVED_RESULT", text: "63 minus 28 equals 35.", source_handles: [OBS_HANDLE] }] },
    cognition: {
      schema_version: "cognition-proposal-v0", reasoning_summary: "subtract",
      relevant_memory_handles: [], considered_handles: [OBS_HANDLE], current_intent: "state the difference",
      confidence: 1, uncertainty: 0, action_intent: null, evidence_handles: [OBS_HANDLE]
    },
    subjective_selection: { kind: "NO_SUBJECTIVE_SELECTION" },
    communication_directive: { kind: "REALIZE_CURRENT_INTENT" },
    clarification_basis: null,
    ...overrides
  };
}

const canonicalize = (value: unknown, p = projection()) => canonicalizeConversationCognitionModelOutputV6(value, p as never, HASH);

describe("C4.4 CHANGE A — subjective selection semantics", () => {
  it("accepts the two explicit category tags and nothing else", () => {
    expect(validateSubjectiveSelectionV1({ kind: "NO_SUBJECTIVE_SELECTION" }).ok).toBe(true);
    const selected = validateSubjectiveSelectionV1({ kind: "SUBJECTIVE_SELECTION", stance: "I would stop now.", subjective_rationale: "I'd rather not spend more effort." });
    expect(selected.ok).toBe(true);
    // the legacy carrier and its tokens are no longer lawful in V6
    expect(validateSubjectiveSelectionV1({ kind: "SELECTED", stance: "I would stop now.", subjective_rationale: null }).ok).toBe(false);
    expect(validateSubjectiveSelectionV1({ kind: "NOT_APPLICABLE" }).ok).toBe(false);
    expect(validateSubjectiveSelectionV1({ kind: "NO_SUBJECTIVE_SELECTION", stance: "x" }).ok).toBe(false);
  });

  it("N6 contract: the prompt defines a selection by behavioural latitude and excludes determined results", () => {
    const prompt = CONVERSATION_COGNITION_SYSTEM_PROMPT_V6;
    expect(prompt).toContain("a subjective selection exists ONLY when the supplied facts and rules leave more than one behaviourally admissible, fact-compatible response");
    expect(prompt).toContain("STATING A DETERMINED RESULT IS NOT A SUBJECTIVE SELECTION");
    expect(prompt).toContain("Deciding that a token is a MATCH");
    expect(prompt).toContain("The response plan belongs in cognition.current_intent");
    expect(prompt).toContain("NO_SUBJECTIVE_SELECTION");
    expect(prompt).toContain("SUBJECTIVE_SELECTION");
    // the rationale policy and the no-integrity rule survive
    expect(prompt).toContain("FORBIDDEN rationale content");
    expect(prompt).toContain("Do NOT output any projection hash");
  });
});

describe("C4.4 CHANGE B — model-wire handles", () => {
  it("advertises deterministic F and C namespaces from the existing authority sets", () => {
    const map = buildSourceHandleMapV0(projection());
    // factual sources are the inspectable ones, advertised in the frozen sorted order
    expect([...map.factualSourceHandles]).toEqual(["F1", "F2"]);
    expect(map.handleToRef.get("F1")).toBe(OTHER_EPISODE);
    expect(map.handleToRef.get("F2")).toBe(OBS);
    expect(map.contextHandles.length).toBeGreaterThan(0);
    expect(map.advertised.every((handle) => /^[FC][1-9][0-9]*$/.test(handle))).toBe(true);
    // deterministic for the same projection
    expect(buildSourceHandleMapV0(projection()).advertised).toEqual(map.advertised);
  });

  it("resolves lawful F and C handles to exact canonical refs and passes the existing validators", () => {
    const checked = canonicalize(wire());
    expect(checked.ok).toBe(true);
    if (!checked.ok) return;
    const claim = checked.proposal.factual_assessment.claims[0];
    expect(claim?.source_refs).toEqual([OBS]);
    expect(checked.proposal.cognition.considered_context_refs).toEqual([OBS]);
    expect(checked.proposal.cognition.evidence_refs).toEqual([OBS]);
    // membership in the citeable set is preserved through a C handle too
    const map = buildSourceHandleMapV0(projection());
    const contextHandle = map.contextHandles.find((handle) => map.handleToRef.get(handle) === "entity:alice");
    const withContext = canonicalize(wire({
      factual_assessment: { claims: [] },
      cognition: { ...(wire()["cognition"] as object), considered_handles: [contextHandle], evidence_handles: [contextHandle] }
    }));
    expect(withContext.ok).toBe(true);
    if (withContext.ok) expect(withContext.proposal.cognition.considered_context_refs).toEqual(["entity:alice"]);
  });

  it("fails closed on unknown, malformed, duplicated and cross-namespace handles", () => {
    const unknownSource = canonicalize(wire({ factual_assessment: { claims: [{ kind: "DERIVED_RESULT", text: "x", source_handles: ["F99"] }] } }));
    expect(unknownSource.ok).toBe(false);
    if (!unknownSource.ok) expect(unknownSource.detail).toContain("UNKNOWN_SOURCE_HANDLE");

    const unknownContext = canonicalize(wire({ cognition: { ...(wire()["cognition"] as object), considered_handles: ["C99"] } }));
    expect(unknownContext.ok).toBe(false);
    if (!unknownContext.ok) expect(unknownContext.detail).toContain("UNKNOWN_CONTEXT_HANDLE");

    for (const bad of ["X1", "F0", "f1", "F1a", ""]) {
      const malformed = canonicalize(wire({ factual_assessment: { claims: [{ kind: "DERIVED_RESULT", text: "x", source_handles: [bad] }] } }));
      expect(malformed.ok).toBe(false);
    }

    const duplicate = canonicalize(wire({ factual_assessment: { claims: [{ kind: "DERIVED_RESULT", text: "x", source_handles: [OBS_HANDLE, OBS_HANDLE] }] } }));
    expect(duplicate.ok).toBe(false);

    // namespace escalation: a C handle can never be a factual claim source
    const map = buildSourceHandleMapV0(projection());
    const contextHandle = map.contextHandles[0] ?? "C1";
    const escalated = canonicalize(wire({ factual_assessment: { claims: [{ kind: "DERIVED_RESULT", text: "x", source_handles: [contextHandle] }] } }));
    expect(escalated.ok).toBe(false);
    if (!escalated.ok) expect(escalated.detail).toContain("can never be a factual claim source");
  });

  it("keeps handles invocation-local: a handle from another turn's map is unknown here", () => {
    // The R3 episode exists only in the other projection, so F2 there is the observation here.
    const other = projection({ withR3Episode: true });
    const otherMap = buildSourceHandleMapV0(other);
    const r3Handle = otherMap.factualSourceHandles.find((handle) => otherMap.handleToRef.get(handle) === R3_EPISODE);
    expect(r3Handle).toBeDefined();
    const here = projection();
    const hereMap = buildSourceHandleMapV0(here);
    expect(hereMap.handleToRef.get(r3Handle ?? "F2")).not.toBe(R3_EPISODE);
    const crossTurn = canonicalize(wire({ factual_assessment: { claims: [{ kind: "DERIVED_RESULT", text: "x", source_handles: [r3Handle ?? "F2"] }] } }), here);
    expect(crossTurn.ok).toBe(false);
  });

  it("R3 historical regression: a short handle reconstructs the exact lawful canonical ref", () => {
    const p = projection({ withR3Episode: true });
    const map = buildSourceHandleMapV0(p);
    const handle = map.factualSourceHandles.find((entry) => map.handleToRef.get(entry) === R3_EPISODE);
    expect(handle).toBeDefined();
    const checked = canonicalize(wire({
      factual_assessment: { claims: [{ kind: "DERIVED_RESULT", text: "The user states that 10 minutes of time is available.", source_handles: [handle] }] },
      cognition: { ...(wire()["cognition"] as object), considered_handles: [handle], evidence_handles: [handle] }
    }), p);
    expect(checked.ok).toBe(true);
    if (checked.ok) {
      // byte-exact: no long-string echo from the model, host-owned identity restored
      expect(checked.proposal.factual_assessment.claims[0]?.source_refs).toEqual([R3_EPISODE]);
    }
    // an invented handle on the same shape still fails
    const invented = canonicalize(wire({
      factual_assessment: { claims: [{ kind: "DERIVED_RESULT", text: "x", source_handles: ["F7"] }] },
      cognition: { ...(wire()["cognition"] as object), considered_handles: ["F7"], evidence_handles: ["F7"] }
    }), p);
    expect(invented.ok).toBe(false);
  });

  it("never emits a model-owned projection hash (host-bound identity retained)", () => {
    const withHash = canonicalize(wire({ cognition: { ...(wire()["cognition"] as object), projection_hash: HASH } }));
    expect(withHash.ok).toBe(false);
  });
});
