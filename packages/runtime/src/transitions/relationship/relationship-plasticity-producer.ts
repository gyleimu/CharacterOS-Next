/**
 * RelationshipPlasticityProducerV0 — deterministic host-minted semantic
 * capability + MemoryInfluence evidence → bounded RelationshipUpdateProposalV0.
 *
 * ARCHITECTURE (frozen):
 *   host-minted semantic capability (WeakSet-trusted ACCEPTED wrapper)
 *     ↓ THIS producer: trust → rebase revalidation → policy → evidence → kernel
 *   RelationshipUpdateProposalV0                     (frozen contract, DATA only)
 *   (host orchestration later feeds it to the frozen RelationshipTransitionExecutor;
 *    NO bridge exists in this slice)
 *
 * AUTHORITY BOUNDARY (frozen):
 * - RELATIONSHIP_PLASTICITY_CANONICAL_AUTHORITY = NONE. This module NEVER calls
 *   SubjectCore, the RelationshipTransitionExecutor, the counterpart
 *   registration executor, or any Memory write surface. It returns proposal
 *   DATA; the canonical commit remains a separate explicit host step.
 * - SEMANTIC_RESULT_TRUST = HOST_MINTED_CAPABILITY_ONLY. The FIRST validation
 *   is isHostMintedRelationshipSemanticResult over the WHOLE ACCEPTED wrapper.
 *   JSON clones, structuredClones and field-perfect reconstructions are
 *   rejected (UNTRUSTED_SEMANTIC_CAPABILITY). Capability durability is
 *   PROCESS_LOCAL_ONLY.
 * - DIMENSION/DIRECTION SELECTION = FROZEN_HOST_POLICY. The policy alone
 *   supplies target_dimension_id and direction for the semantic channel_id;
 *   no fuzzy matching, no criterion parsing, no caller override.
 * - CURRENT VALUE = CURRENT_CANONICAL_SUBJECT_STATE. The dimension value and
 *   the expected_state_revision are read from the CURRENT canonical state,
 *   never from semantic-time snapshots (CURRENT_REVALIDATED_REBASE_AT_N_PLUS_K:
 *   the capability survives N → N+k when subject, repository revision,
 *   counterpart, target dimension, policy identity and evidence alignment all
 *   still hold; a repository revision change always requires a fresh semantic
 *   run).
 * - EVIDENCE STRENGTH = MEMORY_INFLUENCE_PIPELINE. All temporal weighting lives
 *   inside the supplied MemoryInfluenceProjectionV0 entries; this module
 *   computes no second decay curve, half-life or recency formula. Projection
 *   ingress is HOST_TRUSTED / STRUCTURALLY_REVALIDATED (closed keys, branded
 *   refs, safe ages, UnitInterval fields) — no cryptographic provenance claim
 *   is made for field-perfect projections.
 * - AGGREGATE = PRODUCER_RECOMPUTED via the frozen
 *   aggregateInfluenceEvidence + ENGINEERING_REFERENCE_V0_ELIGIBILITY_POLICY.
 *   There is no caller-supplied aggregate field in the input contract.
 * - ZERO MAGNITUDE AUTHORITY FOR SEMANTIC TEXT: criterion text, scene text and
 *   channel identity contribute nothing to magnitude; the capability selects
 *   the CHANNEL only. No confidence/score/probability exists anywhere.
 * - ACCUMULATION = CANONICAL_STATE_SUCCESSIVE_UPDATES: no hidden state, no
 *   momentum, no homeostasis. LONG-TERM accumulation is the canonical dimension
 *   value moving through successive committed proposals.
 *
 * PLASTICITY KERNEL — ENGINEERING_BASELINE (frozen V0 constants, no caller or
 * model configuration; transparent engineering bounds, NOT psychology):
 *
 *   scaled     = round4(EVIDENCE_SCALE × aggregate.mean_activation)
 *   step       = min(MAX_SINGLE_STEP, scaled)
 *   raw_next   = current ± step   (policy direction; symmetric magnitude)
 *   next_value = clamp01(raw_next)          // NO final rounding pass
 *
 * The aggregate signal is mean_activation ONLY (total_activation participates
 * solely in the frozen eligibility thresholds). All arithmetic order follows
 * the frozen Personality V0 engineering kernel conceptually.
 */

import type { EpisodeRef } from "@characteros-next/memory";
import { parseEpisodeRef } from "@characteros-next/memory";
import type { MemoryInfluenceProjectionV0 } from "@characteros-next/memory-influence";
import {
  ENGINEERING_REFERENCE_V0_ELIGIBILITY_POLICY,
  aggregateInfluenceEvidence,
  evaluateInfluenceEligibility,
  type EvidenceEligibilityReasonV0,
  type InfluenceEvidenceAggregateV0
} from "@characteros-next/influence-evidence";
import {
  isRecord,
  validateSubjectState,
  validateUnitInterval,
  type SubjectStateV0,
  type UnitIntervalV0
} from "@characteros-next/subject-core";

import {
  deriveRelationshipEvidenceChannelPolicyFingerprint,
  resolveRelationshipEvidenceChannel,
  validateRelationshipEvidenceChannelPolicy
} from "./relationship-evidence-channel-policy.js";
import {
  isHostMintedRelationshipSemanticResult,
  type RelationshipSemanticChannelResultV0,
  type RelationshipSemanticContextProjectionV0
} from "./relationship-semantic-channel.js";
import {
  RELATIONSHIP_UPDATE_PROPOSAL_SCHEMA_VERSION,
  deriveRelationshipEvidenceMemberSetFingerprint,
  validateRelationshipUpdateProposal,
  type RelationshipUpdateProposalV0
} from "./relationship-update-proposal.js";

/** Frozen V0 constants — no caller configuration, no per-channel gain. */
export const RELATIONSHIP_PLASTICITY_EVIDENCE_SCALE = 1 as const;
export const RELATIONSHIP_PLASTICITY_MAX_SINGLE_STEP = 0.05 as const;

/** Explicit V0 admission bound; over-limit projection sets fail closed. */
export const RELATIONSHIP_PLASTICITY_MAX_PROJECTIONS = 32 as const;

export type RelationshipPlasticityRejectionCodeV0 =
  | "UNTRUSTED_SEMANTIC_CAPABILITY"
  | "INVALID_CURRENT_SUBJECT_STATE"
  | "SEMANTIC_SUBJECT_MISMATCH"
  | "SEMANTIC_REPOSITORY_REVISION_MISMATCH"
  | "INVALID_CHANNEL_POLICY"
  | "CHANNEL_POLICY_ID_MISMATCH"
  | "CHANNEL_POLICY_FINGERPRINT_MISMATCH"
  | "CHANNEL_NOT_IN_POLICY"
  | "CURRENT_COUNTERPART_MISSING"
  | "TARGET_DIMENSION_UNREGISTERED"
  | "INVALID_CURRENT_DIMENSION_VALUE"
  | "INVALID_PROJECTION_SET"
  | "INVALID_INFLUENCE_PROJECTION"
  | "DUPLICATE_PROJECTION_REF"
  | "PROJECTION_LOGICAL_TIME_MISMATCH"
  | "EVIDENCE_REF_MISMATCH"
  | "AGGREGATION_FAILED"
  | "AGGREGATE_EVIDENCE_MISMATCH"
  | "EVIDENCE_FINGERPRINT_FAILED"
  | "PROPOSAL_SCHEMA_FAILURE";

export type RelationshipPlasticityNoProposalReasonV0 =
  | "SEMANTIC_ABSTAIN"
  | "EVIDENCE_NOT_ELIGIBLE"
  | "ZERO_EFFECTIVE_INFLUENCE"
  | "SATURATED";

export type RelationshipPlasticityProducerResultV0 =
  | {
      readonly kind: "PROPOSAL";
      /** Self-validated against the frozen proposal contract before returning. */
      readonly proposal: RelationshipUpdateProposalV0;
      /** Deterministic provenance: the bounded ENGINEERING_BASELINE step applied. */
      readonly step: number;
    }
  | { readonly kind: "NO_PROPOSAL"; readonly reason: "SEMANTIC_ABSTAIN" }
  | {
      readonly kind: "NO_PROPOSAL";
      readonly reason: "EVIDENCE_NOT_ELIGIBLE";
      readonly eligibility_reasons: readonly EvidenceEligibilityReasonV0[];
    }
  | { readonly kind: "NO_PROPOSAL"; readonly reason: "ZERO_EFFECTIVE_INFLUENCE"; readonly step: 0 }
  | { readonly kind: "NO_PROPOSAL"; readonly reason: "SATURATED"; readonly step: number }
  | {
      readonly kind: "REJECTED";
      readonly code: RelationshipPlasticityRejectionCodeV0;
      readonly detail: string;
    };

export interface RelationshipPlasticityProducerInputV0 {
  /** CURRENT canonical SubjectState V2 (validated; never mutated). */
  readonly current_subject_state: SubjectStateV0;
  /**
   * The WHOLE ACCEPTED wrapper minted by the Relationship semantic runner.
   * Trust is checked on this wrapper, never on an inner field alone.
   */
  readonly semantic_capability: unknown;
  /** Frozen host routing policy; validated and fingerprint-recomputed here. */
  readonly channel_policy: unknown;
  /** Caller-selected exact MemoryInfluence evidence set; structurally revalidated. */
  readonly influence_projections: readonly unknown[];
}

const PROJECTION_KEYS: readonly string[] = [
  "memory_ref",
  "age_logical",
  "decay_factor",
  "activation_strength"
];

function round4(v: number): number {
  return Math.round(v * 10000) / 10000;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function rawAsciiCompare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const key of Object.keys(value as Record<string, unknown>)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
  return value;
}

function rejected(
  code: RelationshipPlasticityRejectionCodeV0,
  detail: string
): RelationshipPlasticityProducerResultV0 {
  return deepFreeze({ kind: "REJECTED", code, detail });
}

interface SemanticCapabilityView {
  readonly result: RelationshipSemanticChannelResultV0;
  readonly semantic_context: RelationshipSemanticContextProjectionV0;
}

/**
 * Closed structural revalidation of one MemoryInfluenceProjectionV0. This is
 * NOT a cryptographic provenance check: a field-perfect forged projection is
 * structurally indistinguishable (HOST_TRUSTED / STRUCTURALLY_REVALIDATED).
 */
function revalidateProjection(
  raw: unknown,
  index: number
): { readonly ok: true; readonly projection: MemoryInfluenceProjectionV0 } | { readonly ok: false; readonly detail: string } {
  const label = `influence_projections[${index}]`;
  if (!isRecord(raw) || Object.keys(raw).some((key) => !PROJECTION_KEYS.includes(key))) {
    return { ok: false, detail: `${label}: unknown or missing key` };
  }
  const refChecked = parseEpisodeRef(raw["memory_ref"], `${label}.memory_ref`);
  if (!refChecked.ok) return { ok: false, detail: refChecked.error.detail };
  const ageRaw = raw["age_logical"];
  if (typeof ageRaw !== "number" || !Number.isSafeInteger(ageRaw) || ageRaw < 0) {
    return {
      ok: false,
      detail: `${label}.age_logical: nonnegative safe integer required`
    };
  }
  const decayRaw = raw["decay_factor"];
  if (typeof decayRaw !== "number") {
    return { ok: false, detail: `${label}.decay_factor: number required` };
  }
  const decayChecked = validateUnitInterval(decayRaw, `${label}.decay_factor`);
  if (!decayChecked.ok) return { ok: false, detail: decayChecked.error.detail };
  const activationRaw = raw["activation_strength"];
  if (typeof activationRaw !== "number") {
    return { ok: false, detail: `${label}.activation_strength: number required` };
  }
  const activationChecked = validateUnitInterval(
    activationRaw,
    `${label}.activation_strength`
  );
  if (!activationChecked.ok) return { ok: false, detail: activationChecked.error.detail };
  return {
    ok: true,
    projection: {
      memory_ref: refChecked.value,
      age_logical: ageRaw,
      decay_factor: decayChecked.value,
      activation_strength: activationChecked.value
    }
  };
}

function sameRefs(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((ref, index) => ref === b[index]);
}

/**
 * Deterministically produce at most ONE bounded relationship dimension update
 * proposal from an authenticated semantic capability, the frozen host policy,
 * and the exact caller-selected MemoryInfluence evidence set. Pure: same
 * inputs ⇒ same result; no LLM, no provider, no network, no wall clock, no
 * randomness, no canonical mutation, no hidden state.
 */
export async function produceRelationshipPlasticityV0(
  input: RelationshipPlasticityProducerInputV0
): Promise<RelationshipPlasticityProducerResultV0> {
  // ---- FIRST: host-minted capability authority over the WHOLE wrapper --------
  if (!isHostMintedRelationshipSemanticResult(input.semantic_capability)) {
    return rejected(
      "UNTRUSTED_SEMANTIC_CAPABILITY",
      "semantic capability was not minted by the Relationship semantic runner (WeakSet authority)"
    );
  }
  const capability = input.semantic_capability as SemanticCapabilityView;

  // ---- ABSTAIN short-circuit: no projection processing, no proposal ---------
  if (capability.result.kind === "ABSTAIN") {
    return deepFreeze({ kind: "NO_PROPOSAL", reason: "SEMANTIC_ABSTAIN" });
  }
  const channelId = capability.result.channel_id;
  if (channelId === null) {
    return rejected("CHANNEL_NOT_IN_POLICY", "CHANNEL capability carries no channel_id");
  }

  // ---- CURRENT canonical state authority -------------------------------------
  const stateChecked = validateSubjectState(input.current_subject_state);
  if (!stateChecked.ok) {
    return rejected(
      "INVALID_CURRENT_SUBJECT_STATE",
      `current subject state invalid: ${stateChecked.error.detail}`
    );
  }
  const currentState = stateChecked.value;
  if (currentState.identity.subject_id !== capability.result.subject_id) {
    return rejected(
      "SEMANTIC_SUBJECT_MISMATCH",
      `semantic capability subject ${capability.result.subject_id} does not match current subject ${currentState.identity.subject_id}`
    );
  }
  if (
    currentState.memory_state.repository_revision !==
    capability.result.repository_revision
  ) {
    return rejected(
      "SEMANTIC_REPOSITORY_REVISION_MISMATCH",
      "repository revision changed after semantic routing; a fresh semantic run is required"
    );
  }

  // ---- frozen policy identity + resolution ------------------------------------
  const policyChecked = validateRelationshipEvidenceChannelPolicy(input.channel_policy);
  if (!policyChecked.ok) {
    return rejected("INVALID_CHANNEL_POLICY", policyChecked.error.detail);
  }
  const policy = policyChecked.value;
  if (policy.policy_id !== capability.result.channel_policy_id) {
    return rejected(
      "CHANNEL_POLICY_ID_MISMATCH",
      "channel policy identity differs from the semantic capability binding"
    );
  }
  const actualPolicyFingerprint = await deriveRelationshipEvidenceChannelPolicyFingerprint(policy);
  if (actualPolicyFingerprint !== capability.result.channel_policy_fingerprint) {
    return rejected(
      "CHANNEL_POLICY_FINGERPRINT_MISMATCH",
      "channel policy fingerprint differs from the semantic capability binding"
    );
  }
  const policyChannel = resolveRelationshipEvidenceChannel(policy, channelId);
  if (policyChannel === null) {
    return rejected(
      "CHANNEL_NOT_IN_POLICY",
      `semantic channel ${channelId} is absent from the frozen channel policy`
    );
  }

  // ---- CURRENT counterpart + dimension authority ------------------------------
  const counterpart = currentState.relationships.counterparts.find(
    (candidate) => candidate.counterpart_ref === capability.result.counterpart_ref
  );
  if (counterpart === undefined) {
    return rejected(
      "CURRENT_COUNTERPART_MISSING",
      `counterpart ${capability.result.counterpart_ref} is no longer registered in canonical RelationshipState`
    );
  }
  const currentDimension = counterpart.dimensions.find(
    (dimension) => dimension.dimension_id === policyChannel.target_dimension_id
  );
  if (currentDimension === undefined) {
    return rejected(
      "TARGET_DIMENSION_UNREGISTERED",
      `target dimension ${policyChannel.target_dimension_id} is not registered on ${capability.result.counterpart_ref}`
    );
  }
  const currentValueChecked = validateUnitInterval(
    currentDimension.value,
    "current relationship dimension value"
  );
  if (!currentValueChecked.ok) {
    return rejected("INVALID_CURRENT_DIMENSION_VALUE", currentValueChecked.error.detail);
  }
  const currentValue = currentValueChecked.value;

  // ---- projection cardinality + structural revalidation -----------------------
  const projectionsRaw = input.influence_projections;
  if (
    !Array.isArray(projectionsRaw) ||
    projectionsRaw.length === 0 ||
    projectionsRaw.length > RELATIONSHIP_PLASTICITY_MAX_PROJECTIONS
  ) {
    return rejected(
      "INVALID_PROJECTION_SET",
      `influence_projections: expected 1..${RELATIONSHIP_PLASTICITY_MAX_PROJECTIONS} entries`
    );
  }
  const projections: MemoryInfluenceProjectionV0[] = [];
  for (let i = 0; i < projectionsRaw.length; i++) {
    const checked = revalidateProjection(projectionsRaw[i], i);
    if (!checked.ok) return rejected("INVALID_INFLUENCE_PROJECTION", checked.detail);
    projections.push(checked.projection);
  }
  projections.sort((a, b) => rawAsciiCompare(a.memory_ref, b.memory_ref));
  let previousRef: string | undefined;
  for (const projection of projections) {
    if (projection.memory_ref === previousRef) {
      return rejected(
        "DUPLICATE_PROJECTION_REF",
        `memory_ref ${projection.memory_ref} appears more than once`
      );
    }
    previousRef = projection.memory_ref;
  }

  // ---- EXACT three-way evidence alignment --------------------------------------
  const capabilityRefs = [...capability.result.evidence_refs].sort(rawAsciiCompare);
  const contextRefs = capability.semantic_context.evidence
    .map((item) => item.episode_ref)
    .sort(rawAsciiCompare);
  const projectionRefs = projections.map((projection) => projection.memory_ref);
  if (
    !sameRefs(capabilityRefs, contextRefs) ||
    !sameRefs(capabilityRefs, projectionRefs)
  ) {
    return rejected(
      "EVIDENCE_REF_MISMATCH",
      "semantic result refs, semantic context refs and influence projection refs are not exactly equal"
    );
  }

  // ---- logical age revalidation against CURRENT logical time -------------------
  const occurrenceByRef = new Map(
    capability.semantic_context.evidence.map((item) => [item.episode_ref, item.occurrence_logical_time])
  );
  const currentLogicalTime = currentState.runtime_metadata.logical_time;
  for (const projection of projections) {
    const occurrence = occurrenceByRef.get(projection.memory_ref);
    if (occurrence === undefined) {
      return rejected(
        "PROJECTION_LOGICAL_TIME_MISMATCH",
        `memory_ref ${projection.memory_ref} has no semantic context occurrence`
      );
    }
    const expectedAge = currentLogicalTime - occurrence;
    if (
      !Number.isSafeInteger(expectedAge) ||
      expectedAge < 0 ||
      projection.age_logical !== expectedAge
    ) {
      return rejected(
        "PROJECTION_LOGICAL_TIME_MISMATCH",
        `memory_ref ${projection.memory_ref} age_logical ${projection.age_logical} does not equal current logical age ${expectedAge}`
      );
    }
  }

  // ---- producer-recomputed aggregate (no caller-supplied metrics exist) --------
  let aggregate: InfluenceEvidenceAggregateV0;
  try {
    aggregate = aggregateInfluenceEvidence(projections);
  } catch (error) {
    return rejected(
      "AGGREGATION_FAILED",
      `frozen aggregation failed: ${error instanceof Error ? error.message : "unknown failure"}`
    );
  }
  if (!sameRefs(aggregate.member_refs, capabilityRefs)) {
    return rejected(
      "AGGREGATE_EVIDENCE_MISMATCH",
      "recomputed aggregate member refs do not exactly equal the semantic evidence refs"
    );
  }

  // ---- zero effective influence BEFORE eligibility (frozen order) --------------
  if (aggregate.mean_activation === 0) {
    return deepFreeze({
      kind: "NO_PROPOSAL",
      reason: "ZERO_EFFECTIVE_INFLUENCE",
      step: 0
    });
  }

  // ---- frozen ENGINEERING_REFERENCE_V0 eligibility on the recomputed aggregate -
  const eligibility = evaluateInfluenceEligibility(
    aggregate,
    ENGINEERING_REFERENCE_V0_ELIGIBILITY_POLICY
  );
  if (!eligibility.eligible) {
    return deepFreeze({
      kind: "NO_PROPOSAL",
      reason: "EVIDENCE_NOT_ELIGIBLE",
      eligibility_reasons: eligibility.reasons
    });
  }

  // ---- ENGINEERING_BASELINE kernel (frozen constants; exact numeric order) ----
  const scaled = round4(RELATIONSHIP_PLASTICITY_EVIDENCE_SCALE * aggregate.mean_activation);
  const step = Math.min(RELATIONSHIP_PLASTICITY_MAX_SINGLE_STEP, scaled);
  if (step === 0) {
    return deepFreeze({
      kind: "NO_PROPOSAL",
      reason: "ZERO_EFFECTIVE_INFLUENCE",
      step: 0
    });
  }
  const rawNext =
    policyChannel.direction === "INCREASE"
      ? currentValue + step
      : currentValue - step;
  const nextValue = clamp01(rawNext);
  if (nextValue === currentValue) {
    return deepFreeze({
      kind: "NO_PROPOSAL",
      reason: "SATURATED",
      step
    });
  }
  const nextChecked = validateUnitInterval(nextValue, "relationship-plasticity.next_value");
  if (!nextChecked.ok) {
    return rejected("INVALID_CURRENT_DIMENSION_VALUE", nextChecked.error.detail);
  }

  // ---- frozen evidence member-set fingerprint over the EXACT semantic set ------
  let fingerprint;
  try {
    fingerprint = await deriveRelationshipEvidenceMemberSetFingerprint(capabilityRefs as EpisodeRef[]);
  } catch (error) {
    return rejected(
      "EVIDENCE_FINGERPRINT_FAILED",
      `evidence fingerprint derivation failed: ${error instanceof Error ? error.message : "unknown failure"}`
    );
  }

  // ---- exactly ONE dimension update (ZERO_OR_ONE_DIMENSION) ---------------------
  const proposal: RelationshipUpdateProposalV0 = {
    schema_version: RELATIONSHIP_UPDATE_PROPOSAL_SCHEMA_VERSION,
    subject_id: currentState.identity.subject_id,
    expected_state_revision: currentState.runtime_metadata.state_revision,
    counterpart_ref: capability.result.counterpart_ref,
    updates: [
      {
        dimension_id: policyChannel.target_dimension_id,
        next_value: nextChecked.value as UnitIntervalV0
      }
    ],
    evidence_binding: {
      member_refs: [...capabilityRefs] as EpisodeRef[],
      member_set_fingerprint: fingerprint
    }
  };
  const selfCheck = validateRelationshipUpdateProposal(proposal);
  if (!selfCheck.ok) {
    return rejected(
      "PROPOSAL_SCHEMA_FAILURE",
      `produced proposal rejected by the frozen validator: ${selfCheck.error.detail}`
    );
  }
  return deepFreeze({ kind: "PROPOSAL", proposal: selfCheck.value, step });
}
