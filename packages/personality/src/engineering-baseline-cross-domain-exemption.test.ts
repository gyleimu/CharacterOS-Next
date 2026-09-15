/**
 * ENGINEERING_BASELINE cross-domain magnitude exemption — boundary suite
 * (AUDIT_REMEDIATION_AND_FREEZE_V0, TASK 5).
 *
 * DECISION RECORD — see
 * `research/core-completion/audit-remediation-and-freeze-v0/CROSS_DOMAIN_AUTHORIZATION_DECISION.md`.
 *
 * The `EVIDENCE_SCALE × mean_activation` transfer performed by the Relationship
 * and Personality plasticity producers is authorized by an EXPLICIT LOCAL
 * SEMANTIC AUTHORIZATION (declared `ENGINEERING_BASELINE` /
 * `ENGINEERING_REFERENCE_V0`), NOT by a registered cross-domain comparability
 * contract. It is a bounded engineering magnitude mapping from an
 * evidence-strength scalar into a single bounded state delta. It is NOT an
 * operation between tendency scales, so the comparability registry (whose
 * participants are tendency scales and whose operations are
 * COMPARE_ORDER / ADD / SUBTRACT_CANCEL / MEAN / MAX / ...) is the WRONG
 * carrier — forcing it in would require inventing scales and registrations that
 * the frozen architecture does not have.
 *
 * This suite PINS that exemption and proves it cannot be generalized:
 *   1. the exemption's constants are frozen and exact
 *   2. no caller can widen the movement bound, and the policy admits no extra
 *      cross-domain channel
 *   3. the resulting movement is bounded by max_step and stays inside [0,1]
 *   4. the exemption grants NO general cross-domain authorization: the
 *      default-deny gate still denies EVERY operation between the memory
 *      evidence domain and the relationship / personality domains
 *   5. the transferred magnitude never becomes another domain's VALUE
 *
 * Fully OFFLINE: deterministic fixtures only — 0 real model calls.
 */

import { describe, expect, it } from "vitest";

import {
  validateUnitInterval,
  type UnitIntervalV0,
  type ValidationResult
} from "@characteros-next/subject-core";
import type { MemoryInfluenceProjectionV0 } from "@characteros-next/memory-influence";
import {
  CROSS_DOMAIN_OPERATIONS_V0,
  DEFAULT_CROSS_DOMAIN_COMPARABILITY_V0,
  RELATIONSHIP_PLASTICITY_EVIDENCE_SCALE,
  RELATIONSHIP_PLASTICITY_MAX_SINGLE_STEP,
  queryCrossDomainOperationAuthorizationV0,
  type TendencyComparabilityParticipantV0
} from "@characteros-next/runtime";

import {
  ENGINEERING_REFERENCE_V0_PLASTICITY_POLICY,
  proposePersonalityPlasticityV0,
  validatePersonalityPlasticityPolicy,
  type PersonalityPlasticityContextV0,
  type PersonalityPlasticityPolicyV0
} from "./personality-plasticity-producer.js";

const SUBJECT_ID = "subject-s0";
const DIM = "test_openness_like";
const EP_A = `episode:${"a".repeat(64)}`;
const EP_B = `episode:${"b".repeat(64)}`;
const EP_C = `episode:${"c".repeat(64)}`;

function requireBrand<T>(r: ValidationResult<T>): T {
  if (!r.ok) throw new Error(`fixture brand invalid: ${r.error.detail}`);
  return r.value;
}

function unit(v: number): UnitIntervalV0 {
  return requireBrand(validateUnitInterval(v, "fixture.unit"));
}

function producerCtx(currentValue: number): PersonalityPlasticityContextV0 {
  return {
    subject_id: SUBJECT_ID as never,
    expected_state_revision: 0 as never,
    current_personality: {
      schema_version: "personality-state-v0",
      dimensions: [{ dimension_id: DIM, value: unit(currentValue) }]
    }
  } as unknown as PersonalityPlasticityContextV0;
}

function projections(activations: readonly number[]): MemoryInfluenceProjectionV0[] {
  const refs = [EP_A, EP_B, EP_C];
  return activations.map((activation, index) => ({
    memory_ref: refs[index] as MemoryInfluenceProjectionV0["memory_ref"],
    age_logical: index,
    decay_factor: unit(1),
    activation_strength: unit(activation)
  }));
}

/** A maximal-but-lawful evidence set: three members at full activation. */
const SATURATED_EVIDENCE = projections([1, 1, 1]);

/** Synthetic participants naming the evidence / state domains in the gate. */
function participant(domainId: string, scaleId: string): TendencyComparabilityParticipantV0 {
  return {
    domain_id: domainId as never,
    scale_contract_id: scaleId as never,
    scale_contract_fingerprint:
      "sha256:4444444444444444444444444444444444444444444444444444444444444444" as never
  };
}

const MEMORY_EVIDENCE = participant("MEMORY_INFLUENCE", "memory-activation-magnitude-v0");
const RELATIONSHIP_DOMAIN = participant(
  "RELATIONSHIP",
  "relationship-interaction-familiarity-semantics-v0"
);
const PERSONALITY_DOMAIN = participant("PERSONALITY", "personality-dimension-scale-v0");

describe("ENGINEERING_BASELINE cross-domain magnitude exemption is bounded and non-generalizable", () => {
  it("1. the exemption's constants are frozen and exact", () => {
    // Relationship producer constants.
    expect(RELATIONSHIP_PLASTICITY_EVIDENCE_SCALE).toBe(1);
    expect(RELATIONSHIP_PLASTICITY_MAX_SINGLE_STEP).toBe(0.05);

    // Personality producer policy: frozen, with the same engineering values.
    expect(Object.isFrozen(ENGINEERING_REFERENCE_V0_PLASTICITY_POLICY)).toBe(true);
    expect(ENGINEERING_REFERENCE_V0_PLASTICITY_POLICY.evidence_scale).toBe(1);
    expect(ENGINEERING_REFERENCE_V0_PLASTICITY_POLICY.max_step).toBe(0.05);
    expect(ENGINEERING_REFERENCE_V0_PLASTICITY_POLICY.eligibility_policy).toStrictEqual({
      minMemberCount: 3,
      minTotalActivation: 1.5,
      minLogicalSpan: 0
    });
  });

  it("2. the movement bound cannot be widened and the policy admits no extra cross-domain channel", () => {
    const base = ENGINEERING_REFERENCE_V0_PLASTICITY_POLICY;

    // The frozen policy itself is admissible.
    expect(validatePersonalityPlasticityPolicy(base).ok).toBe(true);

    // max_step is a UnitInterval strictly inside (0, 1] — never a wider step.
    for (const maxStep of [0, -0.1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(validatePersonalityPlasticityPolicy({ ...base, max_step: maxStep }).ok, String(maxStep)).toBe(
        false
      );
    }

    // evidence_scale must be positive and finite — no sign tricks, no ±Inf.
    for (const evidenceScale of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(
        validatePersonalityPlasticityPolicy({ ...base, evidence_scale: evidenceScale }).ok,
        String(evidenceScale)
      ).toBe(false);
    }

    // No additional cross-domain channel can be smuggled into the policy.
    expect(
      validatePersonalityPlasticityPolicy({
        ...base,
        cross_domain_weight: 1,
        affect_coupling: 0.5
      } as unknown as PersonalityPlasticityPolicyV0).ok
    ).toBe(false);
  });

  it("3. the resulting movement is bounded by max_step and stays inside [0,1]", async () => {
    // Saturated evidence: the raw signal is 1.0, the step is still capped.
    const increased = await proposePersonalityPlasticityV0(
      producerCtx(0.5),
      SATURATED_EVIDENCE,
      { dimension_id: DIM, direction: "INCREASE" },
      ENGINEERING_REFERENCE_V0_PLASTICITY_POLICY
    );
    expect(increased.kind).toBe("PROPOSED");
    if (increased.kind !== "PROPOSED") return;
    expect(increased.step).toBe(RELATIONSHIP_PLASTICITY_MAX_SINGLE_STEP);
    expect(increased.step).toBeLessThanOrEqual(ENGINEERING_REFERENCE_V0_PLASTICITY_POLICY.max_step);
    expect(increased.proposal.updates).toHaveLength(1);
    expect(increased.proposal.updates[0]?.dimension_id).toBe(DIM);
    expect(increased.proposal.updates[0]?.next_value).toBeCloseTo(0.55, 6);

    // At the upper bound the movement saturates — no overshoot past 1.
    const atCeiling = await proposePersonalityPlasticityV0(
      producerCtx(1),
      SATURATED_EVIDENCE,
      { dimension_id: DIM, direction: "INCREASE" },
      ENGINEERING_REFERENCE_V0_PLASTICITY_POLICY
    );
    expect(atCeiling.kind).toBe("NO_CHANGE");

    // At the lower bound the movement saturates — no undershoot below 0.
    const atFloor = await proposePersonalityPlasticityV0(
      producerCtx(0),
      SATURATED_EVIDENCE,
      { dimension_id: DIM, direction: "DECREASE" },
      ENGINEERING_REFERENCE_V0_PLASTICITY_POLICY
    );
    expect(atFloor.kind).toBe("NO_CHANGE");

    // Even a caller-widened evidence_scale stays inside the max_step bound.
    const widened = await proposePersonalityPlasticityV0(
      producerCtx(0.5),
      SATURATED_EVIDENCE,
      { dimension_id: DIM, direction: "INCREASE" },
      { ...ENGINEERING_REFERENCE_V0_PLASTICITY_POLICY, evidence_scale: 1000 }
    );
    expect(widened.kind).toBe("PROPOSED");
    if (widened.kind !== "PROPOSED") return;
    expect(widened.step).toBeLessThanOrEqual(0.05);
    expect(widened.proposal.updates[0]?.next_value).toBeLessThanOrEqual(0.55);
  });

  it("4. the exemption grants NO general cross-domain authorization — every operation still DENIES", () => {
    const pairings: readonly (readonly [string, TendencyComparabilityParticipantV0, TendencyComparabilityParticipantV0])[] = [
      ["MEMORY × RELATIONSHIP", MEMORY_EVIDENCE, RELATIONSHIP_DOMAIN],
      ["MEMORY × PERSONALITY", MEMORY_EVIDENCE, PERSONALITY_DOMAIN],
      ["RELATIONSHIP × PERSONALITY", RELATIONSHIP_DOMAIN, PERSONALITY_DOMAIN]
    ];

    for (const [label, left, right] of pairings) {
      for (const operation of CROSS_DOMAIN_OPERATIONS_V0) {
        expect(queryCrossDomainOperationAuthorizationV0(operation, [left, right]), `${label} ${operation}`).toBe(
          "DENY"
        );
      }
      // Same-domain identity checks grant nothing either.
      for (const operation of CROSS_DOMAIN_OPERATIONS_V0) {
        expect(queryCrossDomainOperationAuthorizationV0(operation, [left, left])).toBe("DENY");
      }
    }

    expect(DEFAULT_CROSS_DOMAIN_COMPARABILITY_V0).toBe("DENY");
  });

  it("5. the transferred magnitude never becomes another domain's VALUE", async () => {
    const result = await proposePersonalityPlasticityV0(
      producerCtx(0.5),
      SATURATED_EVIDENCE,
      { dimension_id: DIM, direction: "INCREASE" },
      ENGINEERING_REFERENCE_V0_PLASTICITY_POLICY
    );
    expect(result.kind).toBe("PROPOSED");
    if (result.kind !== "PROPOSED") return;

    // The proposal carries a bounded next value for the target dimension ONLY —
    // the activation magnitude is not a field anywhere in the proposal.
    expect(Object.keys(result.proposal).sort()).toStrictEqual(
      ["evidence_binding", "expected_state_revision", "schema_version", "subject_id", "updates"].sort()
    );
    expect(Object.keys(result.proposal.updates[0] ?? {}).sort()).toStrictEqual(
      ["dimension_id", "next_value"].sort()
    );

    const serialized = JSON.stringify(result.proposal);
    expect(serialized).not.toContain("activation");
    expect(serialized).not.toContain("mean_activation");
    expect(serialized).not.toContain("evidence_scale");

    // The only cross-domain quantity that survives is the bounded STEP, and it
    // is derived, not copied: next_value = current ± step.
    expect(result.proposal.updates[0]?.next_value).toBeCloseTo(0.5 + result.step, 6);
    expect(result.step).toBe(0.05);
  });
});
