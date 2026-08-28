/**
 * @characteros-next/influence-evidence — domain-neutral evidence accumulation
 * over frozen MemoryInfluenceProjectionV0 records. Pure producer/read model:
 * no grouping semantics, no canonical writes, no LLM, no wall clock.
 */

export {
  InfluenceEvidenceErrorV0,
  aggregateInfluenceEvidence,
  type InfluenceEvidenceAggregateV0
} from "./evidence-aggregate.js";

export {
  ENGINEERING_REFERENCE_V0_ELIGIBILITY_POLICY,
  evaluateInfluenceEligibility,
  validateEvidenceEligibilityPolicy,
  type EvidenceEligibilityPolicyV0,
  type EvidenceEligibilityReasonV0,
  type EvidenceEligibilityResultV0
} from "./eligibility.js";
