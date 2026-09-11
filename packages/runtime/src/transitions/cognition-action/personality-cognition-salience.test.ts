/**
 * PERSONALITY_COGNITION_SALIENCE_DESIGN_V0 — cognition-salience contract tests.
 *
 * The production renderer must expose CURRENT acquired Personality with the
 * FROZEN registry semantics (verbatim description + anchors) and one generic
 * dispositional-role rule, while keeping traits_seed (P0) distinct, inventing no
 * 0.5-neutrality, admitting no unknown dimensions, and preserving stronger
 * constraints above Personality.
 */

import { describe, expect, it } from "vitest";
import type { HashV1 } from "@characteros-next/subject-core";

import type { CognitiveContextProjectionV2, PersonalityDispositionEntryV0 } from "./types.js";
import { renderCognitiveSubjectData } from "../../providers/cognition/cognitive-prompt-projection.js";
import { PERSONALITY_DIMENSION_REGISTRY_V0 } from "../../transitions/personality/personality-dimension-registry-v0.js";

const HASH = `sha256:${"b".repeat(64)}` as HashV1;
const P0 = { agreeableness: 0.5, conscientiousness: 0.5, extraversion: 0.5, openness: 0.4 };
const P1 = { agreeableness: 0.5, conscientiousness: 0.5, extraversion: 0.5, openness: 0.45 };

function disposition(values: Record<string, number>): Record<string, PersonalityDispositionEntryV0> {
  return Object.fromEntries(
    Object.entries(values).flatMap(([dimension_id, value]) => {
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

function projection(
  personality: Record<string, number>,
  overrides: Partial<CognitiveContextProjectionV2> = {}
): CognitiveContextProjectionV2 {
  return {
    schema_version: "cognitive-context-projection-v2",
    subject_id: "subject-s0" as never,
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
      scene: "same scene",
      task: "reply",
      focus_refs: [],
      active_entity_refs: [],
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
    projection_hash: HASH,
    ...overrides
  };
}

function lineOf(text: string, prefix: string): string {
  const line = text.split("\n").find((entry) => entry.startsWith(prefix));
  if (line === undefined) throw new Error(`missing rendered line: ${prefix}`);
  return line;
}

describe("PERSONALITY_COGNITION_SALIENCE_DESIGN_V0 — salience contract", () => {
  it("projects CURRENT acquired Personality (P(t)), distinct from traits_seed P0", () => {
    const rendered = renderCognitiveSubjectData(projection({ ...P1 }));
    const seed = lineOf(rendered, "[traits seed");
    const current = lineOf(rendered, "[current acquired personality (read-only");
    expect(seed).toContain(`"openness":${P0.openness}`);
    expect(current).toContain(`"openness":${P1.openness}`);
    expect(seed).not.toBe(current);
    expect(seed).not.toContain(`"openness":${P1.openness}`);
  });

  it("reaches cognition with the EXACT frozen registry semantics (verbatim anchors)", () => {
    const rendered = renderCognitiveSubjectData(projection({ ...P1 }));
    const semantics = lineOf(rendered, "[current acquired personality semantics");
    for (const definition of PERSONALITY_DIMENSION_REGISTRY_V0) {
      expect(semantics).toContain(JSON.stringify(definition.description).slice(1, -1));
      expect(semantics).toContain(JSON.stringify(definition.low_anchor).slice(1, -1));
      expect(semantics).toContain(JSON.stringify(definition.high_anchor).slice(1, -1));
    }
  });

  it("never asserts a 0.5 neutral / average-human point", () => {
    const rendered = renderCognitiveSubjectData(projection({ ...P1 }));
    expect(rendered).toContain("0.5 is NOT neutral");
    expect(rendered).not.toMatch(/average human|typical human|0\.5\s*=\s*neutral|neutral disposition/);
  });

  it("adds ONE generic dispositional-role rule with constraint precedence and no scenario rules", () => {
    const rendered = renderCognitiveSubjectData(projection({ ...P1 }));
    const role = lineOf(rendered, "[personality disposition role");
    expect(role).toContain("never overrides");
    for (const stronger of ["facts", "safety", "task", "beliefs", "relationship", "affect"]) {
      expect(role).toContain(stronger);
    }
    // Generic across dimensions and contexts: no benchmark/scenario wording.
    for (const forbidden of [
      "openness",
      "novel-vs-familiar",
      "alternative-interpretation",
      "proven-vs-unproven",
      "choose the unfamiliar",
      "always initiate",
      "always comply",
      "if openness",
      "if extraversion",
      "if conscientiousness",
      "if agreeableness"
    ]) {
      expect(role.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });

  it("empty Personality fabricates no values or anchors (generic rule may remain)", () => {
    const rendered = renderCognitiveSubjectData(projection({}));
    const semantics = lineOf(rendered, "[current acquired personality semantics");
    expect(semantics.trim().endsWith("{}")).toBe(true);
    for (const definition of PERSONALITY_DIMENSION_REGISTRY_V0) {
      expect(semantics).not.toContain(JSON.stringify(definition.description).slice(1, -1));
    }
    expect(lineOf(rendered, "[personality disposition role")).toContain("never overrides");
  });

  it("registered dimensions only: an unregistered id gains no cognition semantics", () => {
    const unregistered = { ...P1, trust: 0.9 };
    const rendered = renderCognitiveSubjectData(projection(unregistered));
    const semantics = lineOf(rendered, "[current acquired personality semantics");
    // No `trust` dimension KEY and no unregistered value gains semantics.
    expect(semantics).not.toContain('"trust":');
    expect(semantics).not.toContain("0.9");
  });
});
