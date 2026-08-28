/**
 * EvidenceEligibilityPolicyV0 — explicit engineering thresholds for deciding
 * whether an evidence aggregate is usable by a downstream consumer.
 *
 * ENGINEERING_REFERENCE_V0: eligibility means ONLY "this evidence set satisfies
 * configured engineering thresholds". It is NOT a claim that any psychological
 * state change (personality/belief/relationship) is scientifically justified.
 * The aggregation layer stays domain-neutral: it does not know who consumes it.
 *
 * Only metrics computable from the frozen MemoryInfluenceProjectionV0 contract
 * are thresholdable: member count, total activation, logical span. No invented
 * signals (repetition, emotion intensity, semantic diversity, identity relevance).
 */

import { fail, ok, isRecord, type ValidationResult } from "@characteros-next/subject-core";

import type { InfluenceEvidenceAggregateV0 } from "./evidence-aggregate.js";

export interface EvidenceEligibilityPolicyV0 {
  /** Minimum member_count (nonnegative safe integer). */
  readonly minMemberCount: number;
  /** Minimum total_activation (nonnegative; raw accumulated evidence is NOT clamped to [0,1]). */
  readonly minTotalActivation: number;
  /** Minimum logical_span in logical ticks (nonnegative safe integer). */
  readonly minLogicalSpan: number;
}

export const ENGINEERING_REFERENCE_V0_ELIGIBILITY_POLICY: EvidenceEligibilityPolicyV0 =
  Object.freeze({
    minMemberCount: 3,
    minTotalActivation: 1.5,
    minLogicalSpan: 0
  });

const ELIGIBILITY_KEYS: readonly string[] = ["minMemberCount", "minTotalActivation", "minLogicalSpan"];

function isNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function isNonnegativeInt(v: number): boolean {
  return Number.isSafeInteger(v) && v >= 0;
}

/** Fail-closed policy validation: closed keys, explicit numeric bounds. */
export function validateEvidenceEligibilityPolicy(
  v: unknown
): ValidationResult<EvidenceEligibilityPolicyV0> {
  if (!isRecord(v)) return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "policy: expected object");
  for (const key of Object.keys(v)) {
    if (!ELIGIBILITY_KEYS.includes(key)) {
      return fail("INVALID_SCHEMA", "SS-SCHEMA-001", `policy.${key}: unknown key`);
    }
  }
  const minMemberCount = v["minMemberCount"];
  if (!isNumber(minMemberCount) || !isNonnegativeInt(minMemberCount)) {
    return fail("INVALID_VALUE_RANGE", "SS-SCHEMA-001", "policy.minMemberCount: nonnegative safe integer required");
  }
  const minTotalActivation = v["minTotalActivation"];
  if (!isNumber(minTotalActivation) || minTotalActivation < 0) {
    return fail("INVALID_VALUE_RANGE", "SS-SCHEMA-001", "policy.minTotalActivation: nonnegative finite number required");
  }
  const minLogicalSpan = v["minLogicalSpan"];
  if (!isNumber(minLogicalSpan) || !isNonnegativeInt(minLogicalSpan)) {
    return fail("INVALID_VALUE_RANGE", "SS-SCHEMA-001", "policy.minLogicalSpan: nonnegative safe integer required");
  }
  return ok({ minMemberCount, minTotalActivation, minLogicalSpan });
}

/** Deterministic typed failure reasons, always reported in this fixed order. */
export type EvidenceEligibilityReasonV0 =
  | "INSUFFICIENT_MEMBER_COUNT"
  | "INSUFFICIENT_TOTAL_ACTIVATION"
  | "INSUFFICIENT_LOGICAL_SPAN";

export interface EvidenceEligibilityResultV0 {
  readonly eligible: boolean;
  /** All failed thresholds, in the fixed reason order above; empty when eligible. */
  readonly reasons: readonly EvidenceEligibilityReasonV0[];
}

/**
 * Evaluate eligibility of an aggregate against explicit thresholds.
 * Pure function; all thresholds are evaluated (no short-circuit) so failure
 * reasons are fully deterministic.
 */
export function evaluateInfluenceEligibility(
  aggregate: InfluenceEvidenceAggregateV0,
  policy: EvidenceEligibilityPolicyV0
): EvidenceEligibilityResultV0 {
  const reasons: EvidenceEligibilityReasonV0[] = [];
  if (aggregate.member_count < policy.minMemberCount) {
    reasons.push("INSUFFICIENT_MEMBER_COUNT");
  }
  if (aggregate.total_activation < policy.minTotalActivation) {
    reasons.push("INSUFFICIENT_TOTAL_ACTIVATION");
  }
  if (aggregate.logical_span < policy.minLogicalSpan) {
    reasons.push("INSUFFICIENT_LOGICAL_SPAN");
  }
  return { eligible: reasons.length === 0, reasons };
}
