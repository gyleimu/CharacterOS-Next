/**
 * AFFECT_COGNITION_C2_CLEAN_REVALIDATION_V0 — factual-source exposure regression.
 *
 * Frozen principle: subject state may influence subjective choice but is NOT
 * factual evidence. Context visibility and factual-source authority are
 * different permissions: a ref can be citeable while never being a lawful
 * `factual_assessment` source.
 *
 * Proves the advertised set and the enforced set are the SAME authority:
 *   - `factualAssessmentSourceRefs` contains the current observation and only
 *     Memory episode refs with inspectable content;
 *   - it excludes subject-state / entity / environment refs;
 *   - the V3 validator rejects a claim sourced from a citeable `subject:` ref;
 *   - the V3 prompt renders exactly the same set under FACTUAL SOURCE REFS.
 */

import { describe, expect, it } from "vitest";
import type { CognitiveContextProjectionAnyVersion } from "../../transitions/cognition-action/types.js";
import { allowedEvidenceSet } from "../../transitions/cognition-action/types.js";
import {
  factualAssessmentSourceRefs,
  validateConversationCognitionProposalV3
} from "../../transitions/conversation/conversation-cognition-proposal.js";
import { buildConversationSubjectDataV3 } from "./conversation-cognition-provider-v3.js";

const OBS = "observation:o-current-1";
const EPISODE = `episode:${"a".repeat(64)}`;
const UNRESOLVED_EPISODE = `episode:${"b".repeat(64)}`;
const SUBJECT = "subject:subject-s0";
const HASH = `sha256:${"c".repeat(64)}`;

function projection(): CognitiveContextProjectionAnyVersion {
  return {
    schema_version: "cognitive-context-projection-v2",
    subject_id: "subject-s0",
    current_logical_time: 4,
    state_revision: 4,
    canonical_affect: { schema_version: "canonical-affect-cognition-projection-v0", valence: 0, activation: 0.5 },
    regulation: { energy: 1, stress: 0, arousal: 0.5, fatigue: 0 },
    context: {
      scene: "Alice says: the review deadline is Thursday.",
      task: "respond",
      focus_refs: [SUBJECT],
      active_entity_refs: ["entity:alice", SUBJECT],
      environment_refs: ["environment:room-1"],
      current_observation_ref: OBS
    },
    memory_working_refs: [EPISODE, UNRESOLVED_EPISODE],
    recent_retrieval_refs: [],
    // Only EPISODE has resolved inspectable content; UNRESOLVED_EPISODE does not.
    factual_memory_evidence: {
      schema_version: "factual-memory-evidence-v0",
      entries: [
        {
          kind: "EPISODE_SCENE",
          episode_ref: EPISODE,
          scene: "Past scene about the review.",
          memory_written_at_logical_time: 1
        }
      ],
      entry_count: 1
    },
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
    projection_hash: HASH
  } as unknown as CognitiveContextProjectionAnyVersion;
}

function proposal(sourceRef: string, considered: readonly string[]) {
  return {
    schema_version: "conversation-cognition-proposal-v3",
    factual_assessment: { claims: [{ kind: "DERIVED_RESULT", text: "The deadline is Thursday.", source_refs: [sourceRef] }] },
    cognition: {
      schema_version: "cognition-proposal-v0",
      projection_hash: HASH,
      reasoning_summary: "s",
      relevant_memory_refs: [],
      considered_context_refs: [...considered],
      current_intent: "I would volunteer to own the review",
      confidence: 0.8,
      uncertainty: 0.2,
      action_intent: null,
      evidence_refs: [...considered]
    },
    communication_directive: { kind: "REALIZE_CURRENT_INTENT" },
    clarification_basis: null
  };
}

describe("factual-source authority is separate from context visibility", () => {
  it("advertises only inspectable factual sources; subject/entity/environment refs are citeable but excluded", () => {
    const value = projection();
    const sources = [...factualAssessmentSourceRefs(value)];
    expect(sources).toContain(OBS);
    expect(sources).toContain(EPISODE);
    expect(sources).not.toContain(UNRESOLVED_EPISODE);
    expect(sources).not.toContain(SUBJECT);
    expect(sources).not.toContain("entity:alice");
    expect(sources).not.toContain("environment:room-1");
    // The subject ref IS citeable context — visibility is a different permission.
    expect([...allowedEvidenceSet(value)]).toContain(SUBJECT);
  });

  it("accepts a claim sourced from the current observation and rejects one sourced from the citeable subject ref", () => {
    const value = projection();
    expect(validateConversationCognitionProposalV3(proposal(OBS, [OBS]), value).ok).toBe(true);
    const rejected = validateConversationCognitionProposalV3(proposal(SUBJECT, [SUBJECT]), value);
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) expect(rejected.detail).toContain("FACTUAL SOURCE REF");
  });

  it("renders exactly the enforced factual-source set in the V3 SUBJECT DATA", () => {
    const value = projection();
    const rendered = buildConversationSubjectDataV3(value);
    const block = /FACTUAL SOURCE REFS[\s\S]*?(?=\nCITEABLE CONTEXT REFS)/.exec(rendered)?.[0] ?? "";
    const listed = [...block.matchAll(/^- (\S+)$/gm)].map((match) => match[1]);
    expect(listed).toEqual([...factualAssessmentSourceRefs(value)].sort());
    expect(block).not.toContain(SUBJECT);
  });
});
