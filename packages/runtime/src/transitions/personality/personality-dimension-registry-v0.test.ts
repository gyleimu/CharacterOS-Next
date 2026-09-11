/**
 * PERSONALITY_GENESIS_PRIOR_AUTHORITY_V0 — dimension admission vs value authority.
 *
 * These tests seal the corrected contract:
 * - the registry admits dimension IDS and qualitative semantics only;
 * - it carries NO numeric genesis prior, NO default disposition, NO 0.5 and NO
 *   randomness;
 * - a fresh production subject therefore starts with empty traits_seed and
 *   empty personality until an explicit lawful genesis-prior admission exists;
 * - the dimension law is independent of any particular subject's P0 values.
 */

import { describe, expect, it } from "vitest";
import type { SubjectStateV0, TraitsSeedV0 } from "@characteros-next/subject-core";

import { createInteractiveSubjectSeedV0 } from "../../session/interactive-subject-runtime-v0.js";
import { initializePersonalityFromTraitsSeed } from "./personality-init.js";
import * as registryModule from "./personality-dimension-registry-v0.js";
import {
  PERSONALITY_DIMENSION_DOMAIN,
  PERSONALITY_DIMENSION_IDS_V0,
  PERSONALITY_DIMENSION_REGISTRY_SCHEMA_VERSION,
  PERSONALITY_DIMENSION_REGISTRY_V0,
  isCanonicalPersonalityDimensionV0
} from "./personality-dimension-registry-v0.js";

const EXPECTED_IDS = ["agreeableness", "conscientiousness", "extraversion", "openness"] as const;

function freshSubject(subjectId = "alice", displayName = "Alice"): SubjectStateV0 {
  return createInteractiveSubjectSeedV0(subjectId, displayName, []);
}

describe("PERSONALITY_GENESIS_PRIOR_AUTHORITY_V0 — admission without value authority", () => {
  it("A. registry is closed, frozen, versioned, and admits exactly the V0 set", () => {
    expect(PERSONALITY_DIMENSION_REGISTRY_SCHEMA_VERSION).toBe("personality-dimension-registry-v0");
    expect(Object.isFrozen(PERSONALITY_DIMENSION_REGISTRY_V0)).toBe(true);
    expect(PERSONALITY_DIMENSION_IDS_V0).toEqual([...EXPECTED_IDS]);
    for (const definition of PERSONALITY_DIMENSION_REGISTRY_V0) {
      expect(Object.isFrozen(definition)).toBe(true);
      expect(Object.keys(definition).sort()).toEqual([
        "description",
        "dimension_id",
        "domain",
        "high_anchor",
        "low_anchor",
        "plasticity_admissible"
      ]);
    }
  });

  it("B. dimension ids are unique and raw-ASCII ascending (deterministic ordering)", () => {
    const ids = PERSONALITY_DIMENSION_REGISTRY_V0.map((definition) => definition.dimension_id as string);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))).toEqual(ids);
  });

  it("C. semantics are qualitative with distinct poles and no numeric fields", () => {
    for (const definition of PERSONALITY_DIMENSION_REGISTRY_V0) {
      expect(definition.domain).toBe(PERSONALITY_DIMENSION_DOMAIN);
      expect(definition.description.length).toBeGreaterThan(0);
      expect(definition.low_anchor).not.toBe(definition.high_anchor);
      expect(definition.plasticity_admissible).toBe(true);
      for (const value of Object.values(definition)) {
        expect(typeof value).not.toBe("number");
      }
    }
  });

  it("D. cross-domain firewall: no relationship/affect/belief/regulation dimensions admitted", () => {
    for (const rejected of [
      "trust",
      "attachment",
      "fear",
      "control",
      "neuroticism",
      "resilience",
      "self_control",
      "emotional_sensitivity",
      "sadness",
      "anger"
    ]) {
      expect(PERSONALITY_DIMENSION_IDS_V0).not.toContain(rejected);
      expect(isCanonicalPersonalityDimensionV0(rejected)).toBe(false);
    }
    for (const admitted of EXPECTED_IDS) {
      expect(isCanonicalPersonalityDimensionV0(admitted)).toBe(true);
    }
  });

  it("E. the module exposes NO numeric genesis/value authority whatsoever", () => {
    const exports = registryModule as unknown as Record<string, unknown>;
    expect(exports["ENGINEERING_REFERENCE_V0_GENESIS_DISPOSITION"]).toBeUndefined();
    expect(exports["canonicalGenesisTraitsSeedV0"]).toBeUndefined();
    expect(exports["initializeCanonicalGenesisPersonalityV0"]).toBeUndefined();
  });

  it("F. dimension law is independent of any subject's P0 values", () => {
    const registryBefore = PERSONALITY_DIMENSION_REGISTRY_V0;
    const idsBefore = PERSONALITY_DIMENSION_IDS_V0;
    // Two arbitrary, mutually contradictory subject-specific priors.
    const priorA: TraitsSeedV0 = { dimensions: { openness: 0.9 as never } };
    const priorB: TraitsSeedV0 = { dimensions: { agreeableness: 0.1 as never, extraversion: 0.4 as never } };
    const personalityA = initializePersonalityFromTraitsSeed(priorA);
    const personalityB = initializePersonalityFromTraitsSeed(priorB);
    expect(personalityA.dimensions.map((d) => d.dimension_id)).toEqual(["openness"]);
    expect(personalityB.dimensions.map((d) => d.dimension_id)).toEqual(["agreeableness", "extraversion"]);
    // Introducing subject-specific values does not add/remove/reorder dimension law.
    expect(PERSONALITY_DIMENSION_REGISTRY_V0).toBe(registryBefore);
    expect(PERSONALITY_DIMENSION_IDS_V0).toBe(idsBefore);
    expect(PERSONALITY_DIMENSION_IDS_V0).toEqual([...EXPECTED_IDS]);
  });

  it("G. a fresh production subject has empty P0: no 0.5 fallback, no fabricated prior", () => {
    const subject = freshSubject();
    expect(subject.traits_seed.dimensions).toEqual({});
    expect(subject.personality.dimensions).toEqual([]);
    // Absence is not midpoint: nothing is silently set to 0.5.
    expect(Object.keys(subject.traits_seed.dimensions)).toHaveLength(0);
    expect(subject.personality.dimensions).toHaveLength(0);
  });

  it("H. genesis is deterministic: no randomness, no hidden value source", () => {
    const first = freshSubject("alice", "Alice");
    const second = freshSubject("alice", "Alice");
    expect(first.traits_seed).toEqual(second.traits_seed);
    expect(first.personality).toEqual(second.personality);
    expect(first).toEqual(second);
  });

  it("I. genesis creates no fake Memory/Experience/Belief/Relationship", () => {
    const subject = freshSubject();
    expect(subject.memory_state.working_refs).toEqual([]);
    expect(subject.memory_state.active_episode_refs).toEqual([]);
    expect(subject.memory_state.recent_retrieval_trace).toEqual([]);
    expect(subject.memory_state.pending_encoding_refs).toEqual([]);
    expect(subject.beliefs.items).toEqual([]);
    expect(subject.relationships.counterparts).toEqual([]);
  });

  it("J. cognition genesis input is exactly the empty genesis law (traits_seed is authoritative G)", () => {
    // Cognition projects `snapshot.traits_seed.dimensions` verbatim. With the
    // empty genesis law this is deterministically `{}` for every fresh subject,
    // for every subject id / display name / anchor set.
    for (const [id, name] of [
      ["alice", "Alice"],
      ["bob", ""],
      ["subject-1", "Some Name"]
    ] as const) {
      expect(freshSubject(id, name).traits_seed.dimensions).toEqual({});
    }
  });

  it("K. acquire/persist separation: traits_seed stays frozen, personality is a mutable copy", () => {
    // The genesis law itself carries no values; the frozen traits_seed →
    // personality mapping still produces an independent mutable structure.
    const seed: TraitsSeedV0 = { dimensions: Object.freeze({ openness: 0.7 as never }) };
    const personality = initializePersonalityFromTraitsSeed(seed);
    expect(personality.dimensions).toEqual([{ dimension_id: "openness", value: 0.7 }]);
    const mutable = [...personality.dimensions] as { dimension_id: string; value: number }[];
    const first = mutable[0];
    expect(first).toBeDefined();
    if (first !== undefined) first.value = 0.2;
    // The immutable seed is untouched by mutating the derived acquired copy.
    expect(seed.dimensions["openness"]).toBe(0.7);
  });
});
