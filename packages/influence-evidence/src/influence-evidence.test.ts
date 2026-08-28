/**
 * InfluenceEvidenceAggregation V0 acceptance suite (E1–E34).
 * Deterministic and offline: no LLM, no network, no wall clock, no random.
 */

import { describe, expect, it } from "vitest";

import type { MemoryInfluenceProjectionV0 } from "@characteros-next/memory-influence";

import {
  aggregateInfluenceEvidence,
  ENGINEERING_REFERENCE_V0_ELIGIBILITY_POLICY,
  evaluateInfluenceEligibility,
  InfluenceEvidenceErrorV0,
  validateEvidenceEligibilityPolicy,
  type EvidenceEligibilityPolicyV0
} from "./index.js";

const REF_A = "episode:b7a0d91e171ee47470324bc8bfe02ac2b307018f56b9e03e76d946298636c05d";
const REF_B = "episode:c81e728d9d4c2f636f067f89cc14862c00000000000000000000000000000000";
const REF_C = "episode:eccbc87e4b5ce2fe28308fd9f2a7baf30000000000000000000000000000000";

interface ProjectionOverrides {
  memory_ref?: string;
  age_logical?: number;
  decay_factor?: number;
  activation_strength?: number;
}

function projection(overrides: ProjectionOverrides = {}): MemoryInfluenceProjectionV0 {
  const base = {
    memory_ref: REF_A,
    age_logical: 0,
    decay_factor: 1,
    activation_strength: 0.8,
    ...overrides
  };
  return base as unknown as MemoryInfluenceProjectionV0;
}

const POLICY: EvidenceEligibilityPolicyV0 = { minMemberCount: 2, minTotalActivation: 1.0, minLogicalSpan: 0 };

describe("InfluenceEvidenceAggregation V0", () => {
  it("E1/E2/E32: deterministic; shuffled and independent-world inputs yield equivalent aggregates", () => {
    const set = [
      projection({ memory_ref: REF_A, activation_strength: 0.9, age_logical: 10 }),
      projection({ memory_ref: REF_B, activation_strength: 0.5, age_logical: 2 }),
      projection({ memory_ref: REF_C, activation_strength: 0.7, age_logical: 6 })
    ];
    const a = aggregateInfluenceEvidence(set);
    const b = aggregateInfluenceEvidence([...set].reverse());
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const independent = set.map((p) => ({ ...p }));
    expect(JSON.stringify(aggregateInfluenceEvidence(independent))).toBe(JSON.stringify(a));
  });

  it("E3: input projections remain immutable", () => {
    const set = Object.freeze([
      Object.freeze(projection({ memory_ref: REF_A })),
      Object.freeze(projection({ memory_ref: REF_B }))
    ]) as readonly MemoryInfluenceProjectionV0[];
    expect(() => aggregateInfluenceEvidence(set)).not.toThrow();
    expect(set).toHaveLength(2);
  });

  it("E4: empty set is a legal aggregate with member_count 0 and zero metrics", () => {
    const a = aggregateInfluenceEvidence([]);
    expect(a.member_count).toBe(0);
    expect(a.member_refs).toEqual([]);
    expect(a.total_activation).toBe(0);
    expect(a.mean_activation).toBe(0);
    expect(a.logical_span).toBe(0);
    // Eligibility is naturally false under any positive threshold.
    const e = evaluateInfluenceEligibility(a, POLICY);
    expect(e.eligible).toBe(false);
  });

  it("E5: single projection is legal; span is 0", () => {
    const a = aggregateInfluenceEvidence([projection({ activation_strength: 0.6, age_logical: 4 })]);
    expect(a.member_count).toBe(1);
    expect(a.member_refs).toEqual([REF_A]);
    expect(a.total_activation).toBe(0.6);
    expect(a.mean_activation).toBe(0.6);
    expect(a.max_activation).toBe(0.6);
    expect(a.min_activation).toBe(0.6);
    expect(a.oldest_age_logical).toBe(4);
    expect(a.newest_age_logical).toBe(4);
    expect(a.logical_span).toBe(0);
  });

  it("E6/E7/E8: multiple projections; member_count exact; member_refs exact and raw-ASCII ordered", () => {
    const a = aggregateInfluenceEvidence([
      projection({ memory_ref: REF_C, activation_strength: 0.1 }),
      projection({ memory_ref: REF_A, activation_strength: 0.9 }),
      projection({ memory_ref: REF_B, activation_strength: 0.5 })
    ]);
    expect(a.member_count).toBe(3);
    expect(a.member_refs).toEqual([REF_A, REF_B, REF_C]);
  });

  it("E9: duplicate memory_ref fails closed with typed error", () => {
    expect(() =>
      aggregateInfluenceEvidence([projection({ memory_ref: REF_A }), projection({ memory_ref: REF_A })])
    ).toThrow(InfluenceEvidenceErrorV0);
    try {
      aggregateInfluenceEvidence([projection({ memory_ref: REF_A }), projection({ memory_ref: REF_A })]);
      expect.unreachable();
    } catch (e) {
      expect((e as InfluenceEvidenceErrorV0).code).toBe("DUPLICATE_MEMORY_REF");
    }
  });

  it("E10/E11/E12: total/mean/min/max activation exact; total may exceed 1 without clamping", () => {
    const a = aggregateInfluenceEvidence([
      projection({ activation_strength: 0.9 }),
      projection({ memory_ref: REF_B, activation_strength: 0.85 }),
      projection({ memory_ref: REF_C, activation_strength: 0.2 })
    ]);
    expect(a.total_activation).toBe(1.95);
    expect(a.total_activation).toBeGreaterThan(1); // raw evidence NOT clamped to [0,1]
    expect(a.mean_activation).toBe(0.65);
    expect(a.max_activation).toBe(0.9);
    expect(a.min_activation).toBe(0.2);
  });

  it("E13: logical age range and span exact", () => {
    const a = aggregateInfluenceEvidence([
      projection({ memory_ref: REF_A, age_logical: 100 }),
      projection({ memory_ref: REF_B, age_logical: 3 }),
      projection({ memory_ref: REF_C, age_logical: 40 })
    ]);
    expect(a.oldest_age_logical).toBe(100);
    expect(a.newest_age_logical).toBe(3);
    expect(a.logical_span).toBe(97);
  });

  it("E14: activation values are consumed verbatim per frozen projection contract", () => {
    const a = aggregateInfluenceEvidence([projection({ activation_strength: 0.37, age_logical: 9 })]);
    expect(a.total_activation).toBe(0.37);
    expect(a.mean_activation).toBe(0.37);
  });

  it("E15/E16/E17/E18: no personality/belief/relationship output and no traits_seed use", () => {
    const a = aggregateInfluenceEvidence([
      projection({ memory_ref: REF_A }),
      projection({ memory_ref: REF_B })
    ]);
    const serialized = JSON.stringify(a);
    for (const banned of [
      "personality",
      "belief",
      "relationship",
      "traits_seed",
      "trust",
      "emotion",
      "drift",
      "trait_delta",
      "cluster_gravity"
    ]) {
      expect(serialized.includes(banned)).toBe(false);
    }
    expect(Object.keys(a).sort()).toEqual([
      "logical_span",
      "max_activation",
      "mean_activation",
      "member_count",
      "member_refs",
      "min_activation",
      "newest_age_logical",
      "oldest_age_logical",
      "total_activation"
    ]);
  });

  it("E19: eligibility min-count boundary is exact", () => {
    const two = aggregateInfluenceEvidence([
      projection({ memory_ref: REF_A, activation_strength: 1 }),
      projection({ memory_ref: REF_B, activation_strength: 0.5 })
    ]);
    const at = evaluateInfluenceEligibility(two, { ...POLICY, minMemberCount: 2, minTotalActivation: 0 });
    expect(at.eligible).toBe(true);
    const below = evaluateInfluenceEligibility(two, { ...POLICY, minMemberCount: 3, minTotalActivation: 0 });
    expect(below.eligible).toBe(false);
    expect(below.reasons).toEqual(["INSUFFICIENT_MEMBER_COUNT"]);
  });

  it("E20: eligibility activation boundary is exact (boundary value satisfies, raw unclamped)", () => {
    const set = [
      projection({ memory_ref: REF_A, activation_strength: 0.75 }),
      projection({ memory_ref: REF_B, activation_strength: 0.75 })
    ];
    const a = aggregateInfluenceEvidence(set);
    expect(a.total_activation).toBe(1.5);
    const at = evaluateInfluenceEligibility(a, { ...POLICY, minMemberCount: 0, minTotalActivation: 1.5 });
    expect(at.eligible).toBe(true);
    const below = evaluateInfluenceEligibility(a, { ...POLICY, minMemberCount: 0, minTotalActivation: 1.51 });
    expect(below.reasons).toEqual(["INSUFFICIENT_TOTAL_ACTIVATION"]);
  });

  it("E21/E22: logical-span threshold boundary and deterministic multi-reason ordering", () => {
    const set = [
      projection({ memory_ref: REF_A, age_logical: 10, activation_strength: 0.2 }),
      projection({ memory_ref: REF_B, age_logical: 0, activation_strength: 0.2 })
    ];
    const a = aggregateInfluenceEvidence(set);
    expect(a.logical_span).toBe(10);
    const at = evaluateInfluenceEligibility(a, { minMemberCount: 2, minTotalActivation: 0, minLogicalSpan: 10 });
    expect(at.eligible).toBe(true);
    const failAll = evaluateInfluenceEligibility(a, { minMemberCount: 3, minTotalActivation: 5, minLogicalSpan: 11 });
    expect(failAll.reasons).toEqual([
      "INSUFFICIENT_MEMBER_COUNT",
      "INSUFFICIENT_TOTAL_ACTIVATION",
      "INSUFFICIENT_LOGICAL_SPAN"
    ]);
  });

  it("E23: default thresholds are explicitly ENGINEERING_REFERENCE_V0 and validated fail-closed", () => {
    expect(validateEvidenceEligibilityPolicy(ENGINEERING_REFERENCE_V0_ELIGIBILITY_POLICY).ok).toBe(true);
    expect(validateEvidenceEligibilityPolicy({ ...ENGINEERING_REFERENCE_V0_ELIGIBILITY_POLICY, extra: 1 } as unknown).ok).toBe(false);
    expect(
      validateEvidenceEligibilityPolicy({ minMemberCount: -1, minTotalActivation: 0, minLogicalSpan: 0 }).ok
    ).toBe(false);
    expect(
      validateEvidenceEligibilityPolicy({ minMemberCount: 0, minTotalActivation: -0.5, minLogicalSpan: 0 }).ok
    ).toBe(false);
    expect(
      validateEvidenceEligibilityPolicy({ minMemberCount: 0, minTotalActivation: 0, minLogicalSpan: 1.5 } as unknown).ok
    ).toBe(false);
  });

  it("E24/E25: no automatic semantic grouping and no free-text inference — the caller owns membership", () => {
    // The package aggregates exactly the supplied set; it neither filters nor
    // expands nor re-labels members. Projections carry no text at all.
    const a = aggregateInfluenceEvidence([
      projection({ memory_ref: REF_A }),
      projection({ memory_ref: REF_B })
    ]);
    expect(a.member_refs).toEqual([REF_A, REF_B]);
    expect(a.member_count).toBe(2);
  });

  it("E27/E28: no simulation authority — repeated calls bit-identical", () => {
    const set = [
      projection({ memory_ref: REF_A, activation_strength: 0.3, age_logical: 7 }),
      projection({ memory_ref: REF_B, activation_strength: 0.9, age_logical: 1 })
    ];
    const runs = [1, 2, 3].map(() => JSON.stringify(aggregateInfluenceEvidence(set)));
    expect(new Set(runs).size).toBe(1);
  });
});
