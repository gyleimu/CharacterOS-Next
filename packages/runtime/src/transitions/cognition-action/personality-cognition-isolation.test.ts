/**
 * PERSONALITY_CHANGE_THROUGH_LIVED_EVIDENCE_V0 — Level 5 projection isolation.
 *
 * Two cognition projections identical in EVERY behaviorally relevant field
 * (current event, memory refs, canonical affect, beliefs, relationships,
 * regulation, context, allowed actions, traits_seed) except the CURRENT acquired
 * Personality: rendering them differs on exactly the acquired-personality line.
 * The Personality values used are the lawful producer outputs established by the
 * production chain (P0 and P0→P1 with the frozen bounded step).
 */

import { describe, expect, it } from "vitest";
import type { HashV1, IdentifierV0 } from "@characteros-next/subject-core";

import type { CognitiveContextProjectionV2, PersonalityDispositionEntryV0 } from "./types.js";
import { renderCognitiveSubjectData } from "../../providers/cognition/cognitive-prompt-projection.js";
import { PERSONALITY_DIMENSION_REGISTRY_V0 } from "../../transitions/personality/personality-dimension-registry-v0.js";

const HASH = `sha256:${"a".repeat(64)}` as HashV1;
/** EXPERIMENT FIXTURE ONLY. */
const P0 = { agreeableness: 0.5, conscientiousness: 0.5, extraversion: 0.5, openness: 0.4 };
const P1 = { agreeableness: 0.5, conscientiousness: 0.5, extraversion: 0.5, openness: 0.45 };

/** Production-equivalent disposition projection derived from the frozen registry. */
function disposition(personality: Record<string, number>): Record<string, PersonalityDispositionEntryV0> {
  return Object.fromEntries(
    Object.entries(personality).flatMap(([dimension_id, value]) => {
      const definition = PERSONALITY_DIMENSION_REGISTRY_V0.find((entry) => entry.dimension_id === dimension_id);
      if (definition === undefined) return [];
      return [
        [
          dimension_id,
          {
            value,
            description: definition.description,
            low_anchor: definition.low_anchor,
            high_anchor: definition.high_anchor
          }
        ]
      ];
    })
  );
}

function projection(personality: Record<string, number>): CognitiveContextProjectionV2 {
  return {
    schema_version: "cognitive-context-projection-v2",
    subject_id: "subject-s0" as IdentifierV0,
    current_logical_time: 4 as never,
    state_revision: 4 as never,
    traits_dimensions: { ...P0 },
    personality_dimensions: personality,
    personality_disposition: disposition(personality),
    canonical_affect: {
      schema_version: "canonical-affect-cognition-projection-v0",
      valence: 0.25,
      activation: 0.5
    } as never,
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
    // Identical derived hash isolates the SEMANTIC field under test.
    projection_hash: HASH
  };
}

describe("PERSONALITY_CHANGE_THROUGH_LIVED_EVIDENCE_V0 — Level 5 isolation", () => {
  it("personality-only difference changes the rendered cognition input on exactly that line", () => {
    const before = renderCognitiveSubjectData(projection({ ...P0 }));
    const after = renderCognitiveSubjectData(projection({ ...P1 }));
    const beforeLines = before.split("\n");
    const afterLines = after.split("\n");
    expect(afterLines).toHaveLength(beforeLines.length);
    const differing = beforeLines
      .map((line, index) => (line === afterLines[index] ? null : line))
      .filter((line): line is string => line !== null);
    expect(differing.length).toBeGreaterThan(0);
    // Every difference is inside the current-acquired-Personality projection
    // (raw values line + registry-semantics line); nothing else changes.
    for (const line of differing) {
      expect(line.startsWith("[current acquired personality"), line).toBe(true);
    }
    expect(before).toContain("[current acquired personality semantics");
    expect(before).toContain("[personality disposition role");
    // traits_seed (immutable P0) is rendered identically before/after.
    const traitsBefore = beforeLines.find((line) => line.startsWith("[traits seed"));
    const traitsAfter = afterLines.find((line) => line.startsWith("[traits seed"));
    expect(traitsAfter).toBe(traitsBefore);
    expect(traitsBefore).toContain(`"openness":${P0.openness}`);
    expect(after).toContain(`"openness":${P1.openness}`);
  });
});
