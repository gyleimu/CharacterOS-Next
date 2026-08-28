/**
 * PersonalityPlasticityProducerV0 — deterministic evidence → bounded proposal.
 *
 * ARCHITECTURE (frozen inputs, additive slice):
 *   MemoryInfluenceProjectionV0[]                    (caller-selected, explicit)
 *     ↓ aggregateInfluenceEvidence(...)              (frozen, recomputed HERE)
 *     ↓ evaluateInfluenceEligibility(...)            (frozen, recomputed HERE)
 *   PersonalityPlasticityProducerV0                  (THIS module, pure)
 *     → PersonalityUpdateProposalV0                  (frozen contract)
 *     → PersonalityTransitionExecutor                (frozen, canonical authority)
 *     → SubjectCore                                  (sole canonical mutator)
 *
 * AUTHORITY BOUNDARY (frozen):
 * - PRODUCER_IS_MUTATOR = NO. This module NEVER calls SubjectCore commit, the
 *   PersonalityTransitionExecutor, or any MemoryRepository write surface. It
 *   reads a narrow read-only personality context and returns proposal DATA.
 * - CALLER_SUPPLIED_AGGREGATE_METRICS = NOT_TRUSTED. The input contract carries
 *   projections ONLY — there is no field through which member_count,
 *   total_activation, mean_activation, logical_span, eligibility, or a
 *   member_set_fingerprint could be supplied. The producer invokes the frozen
 *   aggregation and eligibility evaluation ITSELF, on the exact supplied set.
 * - AUTOMATIC_EVIDENCE_SELECTION = ABSENT. The caller supplies the exact
 *   projection set; this module never decides which memories "mean" anything.
 * - AUTOMATIC_SEMANTIC_DIRECTION = ABSENT. Direction is an explicit closed
 *   INCREASE | DECREASE engineering intent; this module never infers direction
 *   from memory semantics ("rejection ⇒ decrease agreeableness" belongs to a
 *   future domain selector, not here).
 * - TARGET_DIMENSION_CARDINALITY = ONE. One evidence set → one explicit
 *   registered target dimension → one bounded proposal per invocation. The
 *   producer verifies the dimension exists in the current canonical
 *   PersonalityStateV0 and never registers dimensions dynamically.
 *
 * PLASTICITY POLICY — ENGINEERING_REFERENCE_V0: the parameters below are
 * transparent ENGINEERING bounds that make proposals safe and auditable. They
 * are NOT a validated model of human personality plasticity and carry no
 * psychological truth claim. Magnitude formula (simple, auditable, bounded,
 * deterministic):
 *
 *   step = min(max_step, round4(evidence_scale × mean_activation))
 *   next = clamp(current ± step, 0, 1)
 *
 * total_activation intentionally does NOT contribute to magnitude (no raw-total
 * explosion): total may exceed 1 by frozen contract, so the bounded signal is
 * the already-normalized mean_activation. Ages/span do not contribute either —
 * recency is already inside activation_strength via the frozen projection.
 * Bounded movement is an engineering safety bound for slow state, NOT a
 * biological or psychological correctness claim.
 */

import type {
  IdentifierV0,
  PersonalityStateV0,
  StateRevisionV0,
  UnitIntervalV0
} from "@characteros-next/subject-core";
import {
  fail,
  isRecord,
  ok,
  validateIdentifier,
  validateUnitInterval,
  type ValidationResult
} from "@characteros-next/subject-core";
import type { MemoryInfluenceProjectionV0 } from "@characteros-next/memory-influence";
import {
  aggregateInfluenceEvidence,
  evaluateInfluenceEligibility,
  validateEvidenceEligibilityPolicy,
  type EvidenceEligibilityPolicyV0,
  type EvidenceEligibilityReasonV0
} from "@characteros-next/influence-evidence";
import {
  PERSONALITY_UPDATE_PROPOSAL_SCHEMA_VERSION,
  deriveEvidenceMemberSetFingerprint,
  validatePersonalityUpdateProposal,
  type PersonalityDimensionUpdateV0,
  type PersonalityUpdateProposalV0
} from "@characteros-next/runtime";

/** Explicit closed directional engineering intent — no semantic inference. */
export type PersonalityPlasticityDirectionV0 = "INCREASE" | "DECREASE";

/**
 * Explicit engineering plasticity policy — transparent bounds only.
 * ENGINEERING_REFERENCE_V0: no validated psychological science is claimed.
 */
export interface PersonalityPlasticityPolicyV0 {
  /** Frozen eligibility thresholds applied to the RECOMPUTED aggregate. */
  readonly eligibility_policy: EvidenceEligibilityPolicyV0;
  /** Hard per-proposal movement bound, (0, 1]. */
  readonly max_step: UnitIntervalV0;
  /** Dimensionless mean-activation → movement conversion factor, finite > 0. */
  readonly evidence_scale: number;
}

const DEFAULT_MAX_STEP: UnitIntervalV0 = (() => {
  const checked = validateUnitInterval(0.05, "personality-plasticity.default_max_step");
  if (!checked.ok) {
    throw new Error(`PERSONALITY_PLASTICITY_DEFAULT: ${checked.error.detail}`);
  }
  return checked.value;
})();

/**
 * ENGINEERING_REFERENCE_V0 default policy — intentionally small movement.
 * Reuses the frozen engineering-reference eligibility thresholds. NOT
 * psychological truth; every value is a transparent engineering parameter.
 */
export const ENGINEERING_REFERENCE_V0_PLASTICITY_POLICY: PersonalityPlasticityPolicyV0 =
  Object.freeze({
    eligibility_policy: { minMemberCount: 3, minTotalActivation: 1.5, minLogicalSpan: 0 },
    max_step: DEFAULT_MAX_STEP,
    evidence_scale: 1
  });

const POLICY_KEYS: readonly string[] = ["eligibility_policy", "max_step", "evidence_scale"];

/** Fail-closed policy admission: closed keys, explicit numeric bounds. */
export function validatePersonalityPlasticityPolicy(
  v: unknown
): ValidationResult<PersonalityPlasticityPolicyV0> {
  if (!isRecord(v)) return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "policy: expected object");
  for (const key of Object.keys(v)) {
    if (!POLICY_KEYS.includes(key)) {
      return fail("INVALID_SCHEMA", "SS-SCHEMA-001", `policy.${key}: unknown key`);
    }
  }
  const eligibility = validateEvidenceEligibilityPolicy(v["eligibility_policy"]);
  if (!eligibility.ok) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", `policy.eligibility_policy: ${eligibility.error.detail}`);
  }
  const maxStepRaw = v["max_step"];
  if (typeof maxStepRaw !== "number") {
    return fail("INVALID_VALUE_RANGE", "SS-SCHEMA-001", "policy.max_step: number in (0,1] required");
  }
  const maxStep = validateUnitInterval(maxStepRaw, "policy.max_step");
  if (!maxStep.ok) return maxStep;
  if (maxStep.value <= 0) {
    return fail("INVALID_VALUE_RANGE", "SS-SCHEMA-001", "policy.max_step: positive movement bound required");
  }
  const scaleRaw = v["evidence_scale"];
  if (typeof scaleRaw !== "number" || !Number.isFinite(scaleRaw) || scaleRaw <= 0) {
    return fail("INVALID_VALUE_RANGE", "SS-SCHEMA-001", "policy.evidence_scale: positive finite number required");
  }
  return ok({
    eligibility_policy: eligibility.value,
    max_step: maxStep.value,
    evidence_scale: scaleRaw
  });
}

/**
 * Narrow read-only personality context — canonical branded types only. The
 * producer sees registered dimension membership, the current dimension value,
 * the expected canonical state revision, and subject identity. NO SubjectCore
 * mutation surface is exposed here.
 */
export interface PersonalityPlasticityContextV0 {
  readonly subject_id: IdentifierV0;
  readonly expected_state_revision: StateRevisionV0;
  /** Read-only current canonical PersonalityStateV0 (never mutated). */
  readonly current_personality: PersonalityStateV0;
}

/** Explicit target: one registered dimension + one explicit direction. */
export interface PersonalityPlasticityTargetV0 {
  /** Must already be registered in the canonical personality state. */
  readonly dimension_id: string;
  readonly direction: PersonalityPlasticityDirectionV0;
}

export type PersonalityPlasticityResultV0 =
  | {
      readonly kind: "PROPOSED";
      /** Validated against the frozen proposal contract before leaving the producer. */
      readonly proposal: PersonalityUpdateProposalV0;
      /** Deterministic provenance: the bounded step that was applied. */
      readonly step: number;
    }
  | { readonly kind: "NOT_ELIGIBLE"; readonly reasons: readonly EvidenceEligibilityReasonV0[] }
  | { readonly kind: "UNKNOWN_DIMENSION"; readonly detail: string }
  | { readonly kind: "NO_CHANGE"; readonly detail: string }
  | { readonly kind: "INVALID_POLICY"; readonly detail: string }
  | { readonly kind: "INVALID_TARGET"; readonly detail: string };

function round4(v: number): number {
  return Math.round(v * 10000) / 10000;
}

/**
 * Produce a bounded PersonalityUpdateProposalV0 from an explicitly selected
 * evidence set, an explicit registered target, and an explicit engineering
 * policy. Pure and deterministic: same inputs ⇒ same result; shuffled
 * equivalent projection sets ⇒ equivalent results. No LLM, no embedding, no
 * network, no wall clock, no randomness, no Galaxy mechanics, no canonical
 * mutation of any kind.
 *
 * Duplicate memory refs fail closed through the frozen aggregation
 * (InfluenceEvidenceErrorV0 DUPLICATE_MEMORY_REF) — duplicates are never
 * silently deduped. Empty evidence is a legal zero aggregate and therefore
 * ineligible under any positive thresholds.
 */
export async function proposePersonalityPlasticityV0(
  ctx: PersonalityPlasticityContextV0,
  evidence: readonly MemoryInfluenceProjectionV0[],
  target: PersonalityPlasticityTargetV0,
  policy: PersonalityPlasticityPolicyV0
): Promise<PersonalityPlasticityResultV0> {
  // ---- fail-closed policy admission -----------------------------------------
  const policyChecked = validatePersonalityPlasticityPolicy(policy);
  if (!policyChecked.ok) {
    return { kind: "INVALID_POLICY", detail: policyChecked.error.detail };
  }
  const activePolicy = policyChecked.value;

  // ---- fail-closed explicit target identity ----------------------------------
  if (target === null || typeof target !== "object") {
    return { kind: "INVALID_TARGET", detail: "target: expected object" };
  }
  if (!("dimension_id" in target)) {
    return { kind: "INVALID_TARGET", detail: "target.dimension_id: missing" };
  }
  const dimensionIdRaw: unknown = target["dimension_id"];
  if (typeof dimensionIdRaw !== "string") {
    return { kind: "INVALID_TARGET", detail: "target.dimension_id: expected identifier string" };
  }
  const targetIdChecked = validateIdentifier(dimensionIdRaw, "target.dimension_id");
  if (!targetIdChecked.ok) {
    return { kind: "INVALID_TARGET", detail: targetIdChecked.error.detail };
  }
  const targetId = targetIdChecked.value;
  if (!("direction" in target)) {
    return { kind: "INVALID_TARGET", detail: "target.direction: missing" };
  }
  const directionRaw: unknown = target["direction"];
  if (directionRaw !== "INCREASE" && directionRaw !== "DECREASE") {
    return { kind: "INVALID_TARGET", detail: "target.direction: INCREASE or DECREASE required" };
  }
  const direction = directionRaw;

  // ---- registered-dimension membership (GENERIC_REGISTERED_CONTAINER) --------
  const dimension = ctx.current_personality.dimensions.find(
    (d) => d.dimension_id === targetId
  );
  if (dimension === undefined) {
    return {
      kind: "UNKNOWN_DIMENSION",
      detail: `dimension_id ${targetId} is not registered in the canonical personality state`
    };
  }
  const currentValue = dimension.value;

  // ---- frozen aggregation over the EXACT supplied set (metrics recomputed) ----
  const aggregate = aggregateInfluenceEvidence(evidence);

  // ---- frozen eligibility evaluation (never caller-claimed) -------------------
  const eligibility = evaluateInfluenceEligibility(aggregate, activePolicy.eligibility_policy);
  if (!eligibility.eligible) {
    return { kind: "NOT_ELIGIBLE", reasons: eligibility.reasons };
  }

  // ---- bounded magnitude (ENGINEERING_REFERENCE_V0; see module doc) ----------
  const step = Math.min(activePolicy.max_step, round4(activePolicy.evidence_scale * aggregate.mean_activation));

  // ---- direction + [0,1] bounds (no overshoot) --------------------------------
  const rawNext =
    direction === "INCREASE" ? currentValue + step : currentValue - step;
  const boundedNext = Math.max(0, Math.min(1, rawNext));

  // ---- zero-movement semantics: never create a pointless canonical proposal ---
  if (boundedNext === currentValue) {
    return {
      kind: "NO_CHANGE",
      detail: `bounded movement for dimension ${targetId} is zero (direction ${direction}, step ${String(step)})`
    };
  }

  const nextChecked = validateUnitInterval(boundedNext, "personality-plasticity.next_value");
  if (!nextChecked.ok) {
    // Unreachable by construction (clamp over validated [0,1] inputs); fails closed.
    throw new Error(`PERSONALITY_PLASTICITY_INVARIANT: ${nextChecked.error.detail}`);
  }
  const nextValue = nextChecked.value;

  // ---- member-set fingerprint derived from ACTUAL evidence membership ---------
  // member_refs are canonically re-sorted exactly like the frozen aggregate, so
  // the proposal members and the aggregate members are the same set by
  // construction. No caller-supplied fingerprint exists in the input contract.
  const memberRefs = evidence
    .map((p) => p.memory_ref)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const fingerprint = await deriveEvidenceMemberSetFingerprint(memberRefs);

  // ---- one bounded proposal for ONE registered target dimension ---------------
  const updates: readonly PersonalityDimensionUpdateV0[] = [
    { dimension_id: targetId, next_value: nextValue }
  ];
  const proposal: PersonalityUpdateProposalV0 = {
    schema_version: PERSONALITY_UPDATE_PROPOSAL_SCHEMA_VERSION,
    subject_id: ctx.subject_id,
    expected_state_revision: ctx.expected_state_revision,
    updates,
    evidence_binding: {
      member_refs: memberRefs,
      member_set_fingerprint: fingerprint
    }
  };

  // ---- frozen validator self-check (internal invariant; fails closed) ---------
  const selfCheck = validatePersonalityUpdateProposal(proposal);
  if (!selfCheck.ok) {
    throw new Error(
      `PERSONALITY_PLASTICITY_INVARIANT: produced proposal rejected by the frozen validator: ${selfCheck.error.detail}`
    );
  }
  return { kind: "PROPOSED", proposal: selfCheck.value, step };
}
