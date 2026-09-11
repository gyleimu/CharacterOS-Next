/**
 * PERSONALITY_DIMENSION_SEMANTIC_ADMISSION_V0 — canonical dimension contract.
 *
 * These tests seal the closed V0 registry and the genesis initialization law:
 * a fresh subject starts from the immutable P0 disposition (traits_seed) with
 * the mutable personality initialized as its exact copy, and nothing else.
 */

import { describe, expect, it } from "vitest";

import { createInteractiveSubjectSeedV0 } from "../../session/interactive-subject-runtime-v0.js";
import {
  ENGINEERING_REFERENCE_V0_GENESIS_DISPOSITION,
  PERSONALITY_DIMENSION_DOMAIN,
  PERSONALITY_DIMENSION_IDS_V0,
  PERSONALITY_DIMENSION_REGISTRY_SCHEMA_VERSION,
  PERSONALITY_DIMENSION_REGISTRY_V0,
  canonicalGenesisTraitsSeedV0,
  initializeCanonicalGenesisPersonalityV0,
  isCanonicalPersonalityDimensionV0
} from "./personality-dimension-registry-v0.js";

const EXPECTED_IDS = ["agreeableness", "conscientiousness", "extraversion", "openness"] as const;

describe("PERSONALITY_DIMENSION_SEMANTIC_ADMISSION_V0 — canonical registry", () => {
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

  it("C. no universal 0.5 neutral: semantics and anchors are qualitative and distinct", () => {
    for (const definition of PERSONALITY_DIMENSION_REGISTRY_V0) {
      expect(definition.domain).toBe(PERSONALITY_DIMENSION_DOMAIN);
      expect(definition.description.length).toBeGreaterThan(0);
      expect(definition.low_anchor).not.toBe(definition.high_anchor);
      expect(definition.low_anchor.length).toBeGreaterThan(0);
      expect(definition.high_anchor.length).toBeGreaterThan(0);
      expect(definition.plasticity_admissible).toBe(true);
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

  it("E. genesis disposition is explicit, bounded, and not all-0.5", () => {
    const keys = Object.keys(ENGINEERING_REFERENCE_V0_GENESIS_DISPOSITION).sort((a, b) =>
      a < b ? -1 : a > b ? 1 : 0
    );
    expect(keys).toEqual([...EXPECTED_IDS]);
    const values = Object.values(ENGINEERING_REFERENCE_V0_GENESIS_DISPOSITION);
    for (const value of values) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
    expect(values.every((value) => value === 0.5)).toBe(false);
    expect(Object.isFrozen(ENGINEERING_REFERENCE_V0_GENESIS_DISPOSITION)).toBe(true);
  });

  it("F. canonical genesis traits_seed P0 is deterministic and frozen", () => {
    const first = canonicalGenesisTraitsSeedV0();
    const second = canonicalGenesisTraitsSeedV0();
    expect(first).toEqual(second);
    expect(Object.keys(first.dimensions)).toEqual([...EXPECTED_IDS]);
    expect(Object.isFrozen(first.dimensions)).toBe(true);
    for (const id of EXPECTED_IDS) {
      expect(first.dimensions[id]).toBe(ENGINEERING_REFERENCE_V0_GENESIS_DISPOSITION[id]);
    }
  });

  it("G. personality(t=0) is exactly P0 (traits_seed only read)", () => {
    const seed = canonicalGenesisTraitsSeedV0();
    const personality = initializeCanonicalGenesisPersonalityV0();
    expect(personality.schema_version).toBe("personality-state-v0");
    expect(personality.dimensions.map((dimension) => dimension.dimension_id)).toEqual([...EXPECTED_IDS]);
    for (const dimension of personality.dimensions) {
      expect(dimension.value).toBe(seed.dimensions[dimension.dimension_id as string]);
    }
    // The seed is never mutated by initialization.
    expect(seed.dimensions).toEqual(canonicalGenesisTraitsSeedV0().dimensions);
  });

  it("H. a fresh product subject is admitted with P0 and no fake lived history", () => {
    const subject = createInteractiveSubjectSeedV0("alice", "Alice", []);
    expect(subject.identity.subject_id).toBe("alice");
    expect(subject.identity.display_name).toBe("Alice");
    expect(Object.keys(subject.traits_seed.dimensions)).toEqual([...EXPECTED_IDS]);
    expect(subject.personality.dimensions.map((dimension) => dimension.dimension_id)).toEqual([...EXPECTED_IDS]);
    for (const dimension of subject.personality.dimensions) {
      expect(dimension.value).toBe(subject.traits_seed.dimensions[dimension.dimension_id as string]);
    }
    // Genesis is disposition only: no Memory, Experience, Belief or Relationship.
    expect(subject.memory_state.working_refs).toEqual([]);
    expect(subject.memory_state.active_episode_refs).toEqual([]);
    expect(subject.memory_state.recent_retrieval_trace).toEqual([]);
    expect(subject.memory_state.pending_encoding_refs).toEqual([]);
    expect(subject.beliefs.items).toEqual([]);
    expect(subject.relationships.counterparts).toEqual([]);
  });

  it("I. the admitted canonical set is targetable by the existing dimension contract", () => {
    // The registry exposes exactly the string ids the frozen
    // PersonalityUpdateProposal / producer contract already consumes; no
    // producer mathematics or transition executor semantics change here.
    for (const id of PERSONALITY_DIMENSION_IDS_V0) {
      expect(typeof id).toBe("string");
      expect(id).toMatch(/^[a-z][a-z0-9_]{0,63}$/);
    }
  });
});
