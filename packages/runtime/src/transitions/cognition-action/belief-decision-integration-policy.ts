/**
 * Belief Decision Integration Policy V0 — deterministic numeric tendency slice
 * (BELIEF_DECISION_INTEGRATION_POLICY_V0 ARCHITECTURE_APPROVED).
 *
 * Bounded chain owned here:
 *   authorized AcceptedCognitionProposalV1 (frozen capability)
 *   + current bound CognitiveContextProjectionV0 (integrity-verified)
 *   + exact host allowed action universe (frozen validator, revalidated)
 *   → frozen relation projection RE-DERIVED INTERNALLY via
 *     produceBeliefDecisionInfluenceRelationProjectionV0 (never caller-supplied)
 *   → canonical Belief credence lookup (exact projected credence is the ONLY
 *     numeric authority — never caller/model supplied)
 *   → stance(c) = 2*c - 1 (CENTERED_LINEAR_2C_MINUS_1, neutral point 0.5,
 *     bipolar [-1,1]; NEGATIVE_STANCE_RELATION_INVERSION is intentional:
 *     low credence in a SUPPORTS belief opposes the action)
 *   → relation polarity SUPPORTS=+1 / OPPOSES=-1 / IRRELEVANT=0
 *   → per-relation signed contribution = polarity * stance
 *   → per-action DIRECTIONAL_ARITHMETIC_MEAN_EXCLUDING_IRRELEVANT_EMPTY_ZERO
 *     (sequential IEEE-754 sum in FROZEN CANONICAL RELATION ORDER, single
 *     divide, NO round, NO epsilon, NO clamp, negative zero normalized)
 *   → BeliefDecisionTendencyProjectionV0 (relation-only numeric derivation;
 *     derived NONCANONICAL state — recompute only, no store, no workflow).
 *
 * Authority boundaries:
 *   - The frozen producer's module-private WeakSet capability check remains
 *     the FIRST relation-authority gate; binding-consistency checks over the
 *     CURRENT projection run before it but derive NO relation authority.
 *   - MODEL_NUMERIC_AUTHORITY = NONE: confidence, uncertainty,
 *     reasoning_summary, current_intent, belief labels and action_type
 *     semantics never enter arithmetic.
 *   - No final action selection, no ranking, no winner, no NO_ACTION, no
 *     arbitration, no execution. No cross-action normalization.
 *   - Canonical authority: no SubjectCore mutation port is received.
 *     SUBJECT_STATE_REVISION_DELTA = TRACE_DELTA = LOGICAL_TIME_DELTA =
 *     BELIEF_DELTA = MEMORY_DELTA = RELATIONSHIP_DELTA =
 *     PERSONALITY_DELTA = 0.
 *
 * Failure policy: fail closed, no repair, no retry, no clamp. Stable codes via
 * BeliefDecisionIntegrationPolicyErrorV0; relation-authority / bound-context
 * failures pass through the frozen CognitionRelationRejectionErrorV1 codes
 * (UNAUTHORIZED_ACCEPTED_COGNITION_PROPOSAL = UNAUTHORIZED_RELATION_AUTHORITY,
 * BOUND_CONTEXT_MISMATCH covers stale projection rebase attempts).
 */

import type {
  Brand,
  HashV1,
  IdentifierV0,
  LogicalTimeV0,
  StateRevisionV0,
  UnitIntervalV0
} from "@characteros-next/subject-core";
import { hashEnvelope, validateUnitInterval } from "@characteros-next/subject-core";

import type { AllowedActionV0, CognitiveContextProjectionV0 } from "./types.js";
import {
  CognitionRelationRejectionErrorV1,
  deriveCognitionActionSpaceFingerprintV1,
  validateAllowedActionSpaceV1,
  type AcceptedCognitionProposalV1,
  type BeliefStateActionRelationKindV0,
  type BeliefStateLocatorV0
} from "./cognition-proposal-v1.js";
import {
  produceBeliefDecisionInfluenceRelationProjectionV0,
  verifyCognitiveProjectionIntegrityV1,
  type CognitionRelationHostBindingV1
} from "./belief-decision-influence-relation.js";

// ---- policy identity (§4/§5) ------------------------------------------------------

export const BELIEF_DECISION_INTEGRATION_POLICY_ID_V0 =
  "belief-decision-integration-policy-v0" as const;

export const BELIEF_DECISION_TENDENCY_PROJECTION_SCHEMA_VERSION =
  "belief-decision-tendency-projection-v0" as const;

/** Fingerprint namespace literals EXACT (single literal, no line break). */
export const BELIEF_DECISION_INTEGRATION_POLICY_FINGERPRINT_PROJECTION =
  "characteros-next/runtime/belief-decision-integration-policy/v1" as const;
export const BELIEF_DECISION_TENDENCY_OUTPUT_FINGERPRINT_PROJECTION =
  "characteros-next/runtime/belief-decision-tendency-projection/v1" as const;

/**
 * The frozen V0 policy law as an explicit deterministic descriptor. This IS
 * the documented formula semantics (§4): bipolar credence axis, centered
 * linear stance transform, signed relation polarity with intentional negative
 * stance inversion, directional arithmetic mean excluding IRRELEVANT (empty
 * directional set aggregates to +0), exact IEEE-754 sequential arithmetic with
 * a single divide and normalized negative zero. No runtime/environment fields.
 */
export interface BeliefDecisionIntegrationPolicyDescriptorV0 {
  readonly policy_id: typeof BELIEF_DECISION_INTEGRATION_POLICY_ID_V0;
  readonly credence_semantics: "SUBJECTIVE_ENDORSEMENT_BIPOLAR_AXIS";
  readonly neutral_point: 0.5;
  readonly stance_transform: "CENTERED_LINEAR_2C_MINUS_1";
  readonly stance_range: { readonly minimum: -1; readonly maximum: 1 };
  readonly relation_polarity: { readonly SUPPORTS: 1; readonly OPPOSES: -1; readonly IRRELEVANT: 0 };
  readonly negative_stance_relation_inversion: true;
  readonly aggregation: "DIRECTIONAL_ARITHMETIC_MEAN_EXCLUDING_IRRELEVANT_EMPTY_ZERO";
  readonly arithmetic: "IEEE_754_CANONICAL_SEQUENTIAL_SUM_SINGLE_DIVIDE_NO_ROUND_NO_EPSILON_NO_CLAMP_NORMALIZE_NEGATIVE_ZERO_VALIDATE_JCS";
}

export const BELIEF_DECISION_INTEGRATION_POLICY_DESCRIPTOR_V0: BeliefDecisionIntegrationPolicyDescriptorV0 =
  {
    policy_id: BELIEF_DECISION_INTEGRATION_POLICY_ID_V0,
    credence_semantics: "SUBJECTIVE_ENDORSEMENT_BIPOLAR_AXIS",
    neutral_point: 0.5,
    stance_transform: "CENTERED_LINEAR_2C_MINUS_1",
    stance_range: { minimum: -1, maximum: 1 },
    relation_polarity: { SUPPORTS: 1, OPPOSES: -1, IRRELEVANT: 0 },
    negative_stance_relation_inversion: true,
    aggregation: "DIRECTIONAL_ARITHMETIC_MEAN_EXCLUDING_IRRELEVANT_EMPTY_ZERO",
    arithmetic:
      "IEEE_754_CANONICAL_SEQUENTIAL_SUM_SINGLE_DIVIDE_NO_ROUND_NO_EPSILON_NO_CLAMP_NORMALIZE_NEGATIVE_ZERO_VALIDATE_JCS"
  };
deepFreeze(BELIEF_DECISION_INTEGRATION_POLICY_DESCRIPTOR_V0);

/**
 * Deterministic V0 policy fingerprint over the frozen descriptor via
 * repository hashEnvelope/JCS. Constant for this V0 law: deterministic,
 * environment-independent, model-independent, wall-clock-independent.
 * Confers NO capability authority.
 */
export async function deriveBeliefDecisionIntegrationPolicyFingerprintV0(): Promise<HashV1> {
  if (BELIEF_DECISION_INTEGRATION_POLICY_DESCRIPTOR_V0.policy_id !== BELIEF_DECISION_INTEGRATION_POLICY_ID_V0) {
    throw new BeliefDecisionIntegrationPolicyErrorV0(
      "POLICY_VERSION_MISMATCH",
      "policy descriptor policy_id does not match BELIEF_DECISION_INTEGRATION_POLICY_ID_V0"
    );
  }
  return hashEnvelope(
    BELIEF_DECISION_INTEGRATION_POLICY_FINGERPRINT_PROJECTION,
    BELIEF_DECISION_INTEGRATION_POLICY_DESCRIPTOR_V0
  );
}

// ---- numeric semantic types (§6) ---------------------------------------------------

/**
 * Runtime-local signed numeric brands: finite IEEE-754 binary64 in inclusive
 * [-1,1], negative zero forbidden (normalized to +0). NOT UnitIntervalV0 —
 * these values are signed. subject-core is never modified.
 */
export type BeliefStanceV0 = Brand<number, "BeliefStanceV0">;
export type BeliefDecisionContributionV0 = Brand<number, "BeliefDecisionContributionV0">;
export type BeliefDecisionTendencyV0 = Brand<number, "BeliefDecisionTendencyV0">;

// ---- failure taxonomy (§37) ---------------------------------------------------------

/** Stable fail-closed codes owned by this slice (smallest stable set). */
export type BeliefDecisionIntegrationPolicyErrorCodeV0 =
  | "SOURCE_RELATION_FINGERPRINT_MISMATCH"
  | "UNKNOWN_PROPOSITION"
  | "ACTION_SPACE_MISMATCH"
  | "INVALID_CANONICAL_CREDENCE"
  | "NON_FINITE_ARITHMETIC"
  | "NUMERIC_INVARIANT_VIOLATION"
  | "POLICY_VERSION_MISMATCH";

export class BeliefDecisionIntegrationPolicyErrorV0 extends Error {
  readonly code: BeliefDecisionIntegrationPolicyErrorCodeV0;

  constructor(code: BeliefDecisionIntegrationPolicyErrorCodeV0, detail: string) {
    super(`BELIEF_DECISION_INTEGRATION_${code}: ${detail}`);
    this.name = "BeliefDecisionIntegrationPolicyErrorV0";
    this.code = code;
  }
}

// ---- output types (§11-§13, §15) -------------------------------------------------------

/** One per-relation numeric ledger entry (IRRELEVANT preserved; UNASSERTED absent). */
export interface BeliefDecisionRelationContributionV0 {
  readonly state_locator: BeliefStateLocatorV0;
  readonly action: AllowedActionV0;
  readonly relation: BeliefStateActionRelationKindV0;
  readonly canonical_credence: UnitIntervalV0;
  readonly stance: BeliefStanceV0;
  readonly signed_contribution: BeliefDecisionContributionV0;
}

/** Per-action tendency: every canonical allowed action appears exactly once. */
export interface BeliefActionTendencyV0 {
  readonly action: AllowedActionV0;
  readonly contribution_ledger: readonly BeliefDecisionRelationContributionV0[];
  readonly aggregate_tendency: BeliefDecisionTendencyV0;
}

/**
 * Derived NONCANONICAL numeric projection. Contains relation-derived numeric
 * tendencies ONLY — no winner, no rank, no selected action, no action_intent,
 * no NO_ACTION, no abstain, no decision margin, no utility, no model
 * confidence adjustment, no context/cross-domain score.
 */
export interface BeliefDecisionTendencyProjectionV0 {
  readonly schema_version: typeof BELIEF_DECISION_TENDENCY_PROJECTION_SCHEMA_VERSION;
  readonly policy_id: typeof BELIEF_DECISION_INTEGRATION_POLICY_ID_V0;
  readonly policy_fingerprint: HashV1;
  readonly subject_id: IdentifierV0;
  readonly state_revision: StateRevisionV0;
  readonly current_logical_time: LogicalTimeV0;
  readonly projection_hash: HashV1;
  readonly action_space_fingerprint: HashV1;
  readonly source_relation_projection_fingerprint: HashV1;
  readonly action_tendencies: readonly BeliefActionTendencyV0[];
  readonly output_fingerprint: HashV1;
}

/**
 * Authority-safe producer input (§15): NO caller-supplied relation projection,
 * credence, stance, contribution, aggregate or polarity is accepted — the
 * producer re-derives all of them internally from frozen authorities.
 */
export interface BeliefDecisionTendencyProducerInputV0 {
  readonly current_projection: CognitiveContextProjectionV0;
  readonly allowed_actions: readonly AllowedActionV0[];
  readonly accepted_cognition_proposal: AcceptedCognitionProposalV1;
}

// ---- local helpers ------------------------------------------------------------------

/** Recursive structural freeze (local helper; repository convention). */
function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  if (Object.isFrozen(value)) return;
  Object.freeze(value);
  for (const key of Object.keys(value as Record<string, unknown>)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
}

/**
 * The ONE narrow negative-zero normalizer (§7): -0 → +0 so no produced stance,
 * signed contribution or aggregate ever serializes as -0. No epsilon.
 */
function normalizeNegativeZero(value: number): number {
  return value === 0 ? 0 : value;
}

/** Post-step numeric invariant gate (§21): finite + inclusive [-1,1], fail closed. */
function requireSignedUnit(value: number, label: string): number {
  if (!Number.isFinite(value)) {
    throw new BeliefDecisionIntegrationPolicyErrorV0(
      "NON_FINITE_ARITHMETIC",
      `${label}: non-finite IEEE-754 value (NaN/Infinity are impossible-arithmetic failures)`
    );
  }
  if (value < -1 || value > 1) {
    throw new BeliefDecisionIntegrationPolicyErrorV0(
      "NUMERIC_INVARIANT_VIOLATION",
      `${label}: value ${value} outside inclusive [-1,1] (no clamp, fail closed)`
    );
  }
  return value;
}

/** Frozen relation polarity law (§9): SUPPORTS=+1, OPPOSES=-1, IRRELEVANT=0. */
const RELATION_POLARITY_V0: Readonly<Record<BeliefStateActionRelationKindV0, 1 | -1 | 0>> = {
  SUPPORTS: 1,
  OPPOSES: -1,
  IRRELEVANT: 0
};

function actionTupleKey(action: AllowedActionV0): string {
  return JSON.stringify([action.action_type, action.target_ref]);
}

// ---- producer -------------------------------------------------------------------------

/**
 * produceBeliefDecisionTendencyProjectionV0 — the ONE deterministic numeric
 * integration producer of this slice.
 *
 * Gate order (deterministic first failure, fail closed):
 *   1. revalidate the host action universe with the FROZEN validator (no
 *      second comparator, no order sensitivity) → ACTION_SPACE_MISMATCH
 *   2. recompute the frozen action-space fingerprint
 *   3. verify CURRENT projection body/hash integrity →
 *      BOUND_CONTEXT_MISMATCH (frozen code passthrough)
 *   4. derive the constant policy fingerprint (POLICY_VERSION_MISMATCH guard)
 *   5. re-derive the relation projection INTERNALLY through the frozen
 *      produceBeliefDecisionInfluenceRelationProjectionV0 — its WeakSet
 *      capability check is the first relation-authority gate; stale
 *      projection / changed universe fail BOUND_CONTEXT_MISMATCH there
 *      (STALE_RELATION_REBASE FORBIDDEN), clones fail
 *      UNAUTHORIZED_ACCEPTED_COGNITION_PROPOSAL
 *   6. defensive source-fingerprint coherence → SOURCE_RELATION_FINGERPRINT_MISMATCH
 *   7. canonical credence lookup by EXACT proposition_id (never label/text)
 *      → UNKNOWN_PROPOSITION / INVALID_CANONICAL_CREDENCE
 *   8. stance → contribution → ledger → per-action directional mean with
 *      sequential IEEE-754 arithmetic in frozen canonical relation order
 *   9. output fingerprint (hashEnvelope/JCS over the full body excluding
 *      output_fingerprint), deep freeze.
 *
 * Zero model calls. Zero mutation authority. Recompute-only: no store, no
 * workflow, no checkpoint, no receipt system, no cache.
 */
export async function produceBeliefDecisionTendencyProjectionV0(
  input: BeliefDecisionTendencyProducerInputV0
): Promise<BeliefDecisionTendencyProjectionV0> {
  const projection = input.current_projection;
  const accepted = input.accepted_cognition_proposal;

  // 1-2. Frozen action-space revalidation + fingerprint recomputation (§18).
  const space = validateAllowedActionSpaceV1(input.allowed_actions);
  if (!space.ok) {
    throw new BeliefDecisionIntegrationPolicyErrorV0(
      "ACTION_SPACE_MISMATCH",
      `allowed action space validation failure: ${space.error.detail}`
    );
  }
  const canonicalActions = space.value;
  const actionSpaceFingerprint = await deriveCognitionActionSpaceFingerprintV1(canonicalActions);

  // 3. Current projection integrity (§17): body/hash must be self-consistent.
  const integrity = await verifyCognitiveProjectionIntegrityV1(projection);
  if (!integrity.ok) {
    throw new CognitionRelationRejectionErrorV1(
      "BOUND_CONTEXT_MISMATCH",
      `projection integrity failure: ${integrity.error.detail}`
    );
  }

  // 4. Constant policy fingerprint (§5/§32).
  const policyFingerprint = await deriveBeliefDecisionIntegrationPolicyFingerprintV0();

  // 5. Internal relation re-derivation through the frozen producer (§16/§19).
  // The binding is built from the CURRENT projection + recomputed fingerprint,
  // so the frozen producer's binding gate rejects stale proposals and changed
  // action universes; its capability gate rejects clones/lookalikes FIRST.
  const binding: CognitionRelationHostBindingV1 = {
    subject_id: projection.subject_id,
    state_revision: projection.state_revision,
    current_logical_time: projection.current_logical_time,
    projection_hash: projection.projection_hash,
    action_space_fingerprint: actionSpaceFingerprint
  };
  const relationProjection = await produceBeliefDecisionInfluenceRelationProjectionV0(accepted, binding);

  // 6. Defensive source coherence (internal invariant; unreachable via the
  // public API without a frozen-foundation defect — fail closed regardless).
  if (
    relationProjection.subject_id !== projection.subject_id ||
    relationProjection.state_revision !== projection.state_revision ||
    relationProjection.current_logical_time !== projection.current_logical_time ||
    relationProjection.projection_hash !== projection.projection_hash ||
    relationProjection.action_space_fingerprint !== actionSpaceFingerprint
  ) {
    throw new BeliefDecisionIntegrationPolicyErrorV0(
      "SOURCE_RELATION_FINGERPRINT_MISMATCH",
      "internally re-derived relation projection is not bound to the current projection/action space"
    );
  }
  const sourceRelationProjectionFingerprint = relationProjection.output_fingerprint;

  // 7-8. Canonical credence lookup + stance/contribution ledger in FROZEN
  // CANONICAL RELATION ORDER (relationProjection.relations order; no resort).
  const credenceByProposition = new Map<string, UnitIntervalV0>();
  for (const item of projection.belief_items) {
    credenceByProposition.set(item.proposition_id as string, item.credence);
  }
  const ledgerByAction = new Map<string, BeliefDecisionRelationContributionV0[]>();
  const canonicalTupleKeys = new Set<string>(canonicalActions.map(actionTupleKey));

  for (const relation of relationProjection.relations) {
    const tupleKey = actionTupleKey(relation.action);
    if (!canonicalTupleKeys.has(tupleKey)) {
      throw new BeliefDecisionIntegrationPolicyErrorV0(
        "SOURCE_RELATION_FINGERPRINT_MISMATCH",
        `relation action tuple is not a member of the recomputed canonical action universe: ${tupleKey}`
      );
    }
    const credence = credenceByProposition.get(relation.state_locator.proposition_id as string);
    if (credence === undefined) {
      throw new BeliefDecisionIntegrationPolicyErrorV0(
        "UNKNOWN_PROPOSITION",
        `relation state locator proposition_id is not an exact member of the bound belief projection: ${relation.state_locator.proposition_id}`
      );
    }
    const validatedCredence = validateUnitInterval(
      credence as number,
      `belief_items[${relation.state_locator.proposition_id}].credence`
    );
    if (!validatedCredence.ok) {
      throw new BeliefDecisionIntegrationPolicyErrorV0(
        "INVALID_CANONICAL_CREDENCE",
        validatedCredence.error.detail
      );
    }

    // stance(c) = 2*c - 1 — exact IEEE-754, NO round/toFixed/quantization (§8).
    const stance = normalizeNegativeZero(2 * (validatedCredence.value as number) - 1);
    requireSignedUnit(stance, `stance(${relation.state_locator.proposition_id})`);

    // signed contribution = polarity * stance (§9); IRRELEVANT → exactly +0.
    const polarity = RELATION_POLARITY_V0[relation.relation];
    const contribution = normalizeNegativeZero(polarity * stance);
    requireSignedUnit(contribution, `signed_contribution(${relation.state_locator.proposition_id})`);

    const entry: BeliefDecisionRelationContributionV0 = {
      state_locator: {
        domain: "BELIEF",
        proposition_id: relation.state_locator.proposition_id
      },
      action: { action_type: relation.action.action_type, target_ref: relation.action.target_ref },
      relation: relation.relation,
      canonical_credence: validatedCredence.value,
      stance: stance as BeliefStanceV0,
      signed_contribution: contribution as BeliefDecisionContributionV0
    };
    const ledger = ledgerByAction.get(tupleKey);
    if (ledger === undefined) {
      ledgerByAction.set(tupleKey, [entry]);
    } else {
      ledger.push(entry);
    }
  }

  // 9. Per-action directional mean (§22/§23/§24): IRRELEVANT entries stay in
  // the ledger but never enter numerator or denominator; empty directional set
  // → +0; sequential sum in frozen canonical relation order, single divide,
  // NO clamp, NO rounding, NO cross-action normalization (§28/§29).
  const actionTendencies: BeliefActionTendencyV0[] = canonicalActions.map((action) => {
    const ledger = ledgerByAction.get(actionTupleKey(action)) ?? [];
    const directional = ledger.filter((entry) => entry.relation !== "IRRELEVANT");
    let aggregate: number;
    if (directional.length === 0) {
      aggregate = normalizeNegativeZero(0);
    } else {
      let sum = 0;
      for (const entry of directional) {
        sum += entry.signed_contribution as number;
      }
      aggregate = normalizeNegativeZero(sum / directional.length);
    }
    requireSignedUnit(aggregate, `aggregate_tendency(${action.action_type})`);
    return {
      action: { action_type: action.action_type, target_ref: action.target_ref },
      contribution_ledger: ledger,
      aggregate_tendency: aggregate as BeliefDecisionTendencyV0
    };
  });

  // 10. Output body + fingerprint (§13/§33): hashEnvelope/JCS over the FULL
  // output excluding output_fingerprint. No wall clock, no random, no vendor.
  const body = {
    schema_version: BELIEF_DECISION_TENDENCY_PROJECTION_SCHEMA_VERSION,
    policy_id: BELIEF_DECISION_INTEGRATION_POLICY_ID_V0,
    policy_fingerprint: policyFingerprint,
    subject_id: projection.subject_id,
    state_revision: projection.state_revision,
    current_logical_time: projection.current_logical_time,
    projection_hash: projection.projection_hash,
    action_space_fingerprint: actionSpaceFingerprint,
    source_relation_projection_fingerprint: sourceRelationProjectionFingerprint,
    action_tendencies: actionTendencies
  };
  const outputFingerprint = await hashEnvelope(
    BELIEF_DECISION_TENDENCY_OUTPUT_FINGERPRINT_PROJECTION,
    body
  );
  const tendencyProjection: BeliefDecisionTendencyProjectionV0 = {
    ...body,
    output_fingerprint: outputFingerprint
  };
  deepFreeze(tendencyProjection);
  return tendencyProjection;
}
