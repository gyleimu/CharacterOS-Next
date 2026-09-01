/**
 * Cognition Decision Arbitration Policy V0 — Belief-only UNIQUE_POSITIVE_MAX
 * arbitration slice (COGNITION_DECISION_ARBITRATION_POLICY_V0 ARCHITECTURE_APPROVED).
 *
 * Bounded chain owned here:
 *   authorized AcceptedCognitionProposalV1 (frozen capability)
 *   + current bound CognitiveContextProjectionV0 (integrity-verified)
 *   + exact host allowed action universe (frozen validator, revalidated)
 *   → frozen Belief tendency projection RE-DERIVED INTERNALLY via
 *     produceBeliefDecisionTendencyProjectionV0 (never caller-supplied)
 *   → deterministic UNIQUE_POSITIVE_MAX arbitration:
 *     eligible = aggregate_tendency > 0 (exact IEEE-754, +0 NOT eligible)
 *     no eligible → NO_SELECTION / NO_POSITIVE_TENDENCY
 *     exact IEEE-754 maximum; exactly one winner → SELECTED
 *     positive exact tie (===) → NO_SELECTION / POSITIVE_MAX_TIE
 *   → authorized BeliefDecisionSelectionV0 (deep-frozen, capability-minted)
 *
 * Authority boundaries:
 *   - The frozen tendency producer's capability chain remains the FIRST
 *     relation-authority gate; arbitration derives NO relation authority.
 *   - MODEL_NUMERIC_AUTHORITY = NONE: confidence, uncertainty,
 *     reasoning_summary, current_intent, belief labels and action_type
 *     semantics never enter arbitration.
 *   - NO epsilon, NO decision margin, NO lexical tie-break, NO action-position
 *     tie-break, NO random, NO model tie-break.
 *   - No action execution, no execution runner integration, no production switchover.
 *   - No cross-domain arithmetic, no Relationship/Personality/Affect/Memory.
 *   - Canonical authority: no SubjectCore mutation port is received.
 *     SUBJECT_STATE_REVISION_DELTA = TRACE_DELTA = LOGICAL_TIME_DELTA =
 *     BELIEF_DELTA = MEMORY_DELTA = RELATIONSHIP_DELTA =
 *     PERSONALITY_DELTA = 0.
 *
 * Failure policy: fail closed, no repair, no retry, no clamp. Stable codes via
 * BeliefDecisionArbitrationErrorV0; relation-authority / bound-context /
 * action-space failures pass through the frozen lower-layer error codes
 * (UNAUTHORIZED_ACCEPTED_COGNITION_PROPOSAL, BOUND_CONTEXT_MISMATCH,
 * ACTION_SPACE_MISMATCH, and integration policy codes).
 */

import type {
  HashV1,
  IdentifierV0,
  LogicalTimeV0,
  StateRevisionV0
} from "@characteros-next/subject-core";
import { hashEnvelope } from "@characteros-next/subject-core";

import type { ActionIntentV0, AllowedActionV0, CognitiveContextProjectionV0 } from "./types.js";
import type { AcceptedCognitionProposalV1 } from "./cognition-proposal-v1.js";
import {
  BELIEF_DECISION_INTEGRATION_POLICY_ID_V0,
  produceBeliefDecisionTendencyProjectionV0,
  type BeliefDecisionTendencyProjectionV0
} from "./belief-decision-integration-policy.js";

// ---- policy identity (§4/§5) ------------------------------------------------------

export const BELIEF_POSITIVE_MAX_ARBITRATION_POLICY_ID_V0 =
  "belief-positive-max-arbitration-policy-v0" as const;

export const BELIEF_DECISION_SELECTION_SCHEMA_VERSION =
  "belief-decision-selection-v0" as const;

/** Fingerprint namespace literals EXACT (single literal, no line break). */
export const BELIEF_POSITIVE_MAX_ARBITRATION_POLICY_FINGERPRINT_PROJECTION =
  "characteros-next/runtime/belief-positive-max-arbitration-policy/v1" as const;
export const BELIEF_DECISION_SELECTION_OUTPUT_FINGERPRINT_PROJECTION =
  "characteros-next/runtime/belief-decision-selection/v1" as const;

/**
 * The frozen V0 arbitration policy law as an explicit deterministic descriptor.
 * This IS the documented arbitration semantics (§5): BELIEF_ONLY domain scope,
 * domain-local alignment (not utility), exact tendency > 0 eligibility, unique
 * exact positive maximum winner, NO_SELECTION for all-nonpositive and positive
 * tie, exact IEEE-754 comparison with no epsilon, no decision margin, lawful
 * terminal NO_SELECTION, canonical order never used as tiebreaker, no randomness.
 * No runtime/environment fields.
 */
export interface BeliefPositiveMaxArbitrationPolicyDescriptorV0 {
  readonly policy_id: typeof BELIEF_POSITIVE_MAX_ARBITRATION_POLICY_ID_V0;
  readonly domain_scope: "BELIEF_ONLY";
  readonly input_semantics: "DOMAIN_LOCAL_ALIGNMENT_NOT_UTILITY";
  readonly eligibility: "EXACT_TENDENCY_GT_ZERO";
  readonly winner: "UNIQUE_EXACT_POSITIVE_MAXIMUM";
  readonly all_nonpositive: "NO_SELECTION";
  readonly positive_tie: "NO_SELECTION";
  readonly near_tie: "EXACT_IEEE_754_COMPARISON_NO_EPSILON";
  readonly decision_margin: "NONE";
  readonly no_selection: "LAWFUL_TERMINAL_RESULT";
  readonly canonical_order_as_tiebreaker: false;
  readonly randomness: "NONE";
}

export const BELIEF_POSITIVE_MAX_ARBITRATION_POLICY_DESCRIPTOR_V0: BeliefPositiveMaxArbitrationPolicyDescriptorV0 =
  {
    policy_id: BELIEF_POSITIVE_MAX_ARBITRATION_POLICY_ID_V0,
    domain_scope: "BELIEF_ONLY",
    input_semantics: "DOMAIN_LOCAL_ALIGNMENT_NOT_UTILITY",
    eligibility: "EXACT_TENDENCY_GT_ZERO",
    winner: "UNIQUE_EXACT_POSITIVE_MAXIMUM",
    all_nonpositive: "NO_SELECTION",
    positive_tie: "NO_SELECTION",
    near_tie: "EXACT_IEEE_754_COMPARISON_NO_EPSILON",
    decision_margin: "NONE",
    no_selection: "LAWFUL_TERMINAL_RESULT",
    canonical_order_as_tiebreaker: false,
    randomness: "NONE"
  };
deepFreeze(BELIEF_POSITIVE_MAX_ARBITRATION_POLICY_DESCRIPTOR_V0);

/**
 * Deterministic V0 arbitration policy fingerprint over the frozen descriptor via
 * repository hashEnvelope/JCS. Constant for this V0 law: deterministic,
 * environment-independent, model-independent, wall-clock-independent.
 * Confers NO capability authority.
 */
export async function deriveBeliefPositiveMaxArbitrationPolicyFingerprintV0(): Promise<HashV1> {
  if (
    BELIEF_POSITIVE_MAX_ARBITRATION_POLICY_DESCRIPTOR_V0.policy_id !==
    BELIEF_POSITIVE_MAX_ARBITRATION_POLICY_ID_V0
  ) {
    throw new BeliefDecisionArbitrationErrorV0(
      "ARBITRATION_POLICY_MISMATCH",
      "policy descriptor policy_id does not match BELIEF_POSITIVE_MAX_ARBITRATION_POLICY_ID_V0"
    );
  }
  return hashEnvelope(
    BELIEF_POSITIVE_MAX_ARBITRATION_POLICY_FINGERPRINT_PROJECTION,
    BELIEF_POSITIVE_MAX_ARBITRATION_POLICY_DESCRIPTOR_V0
  );
}

// ---- failure taxonomy (§47) ---------------------------------------------------------

/** Stable fail-closed codes owned by this arbitration slice (smallest stable set). */
export type BeliefDecisionArbitrationErrorCodeV0 =
  | "ARBITRATION_POLICY_MISMATCH"
  | "SOURCE_TENDENCY_FINGERPRINT_MISMATCH"
  | "NUMERIC_INVARIANT_VIOLATION"
  | "SELECTED_ACTION_NOT_ALLOWED";

export class BeliefDecisionArbitrationErrorV0 extends Error {
  readonly code: BeliefDecisionArbitrationErrorCodeV0;

  constructor(code: BeliefDecisionArbitrationErrorCodeV0, detail: string) {
    super(`BELIEF_DECISION_ARBITRATION_${code}: ${detail}`);
    this.name = "BeliefDecisionArbitrationErrorV0";
    this.code = code;
  }
}

// ---- output types (§12-§15) -------------------------------------------------------

/** No-selection reason literals (§14). */
export type BeliefDecisionNoSelectionReasonV0 =
  | "NO_POSITIVE_TENDENCY"
  | "POSITIVE_MAX_TIE";

/**
 * Result base fields (§13): 15 architecture-approved provenance/identity fields
 * shared by both SELECTED and NO_SELECTION outcomes.
 */
export interface BeliefDecisionSelectionBaseV0 {
  readonly schema_version: typeof BELIEF_DECISION_SELECTION_SCHEMA_VERSION;
  readonly policy_id: typeof BELIEF_POSITIVE_MAX_ARBITRATION_POLICY_ID_V0;
  readonly policy_fingerprint: HashV1;
  readonly domain_scope: "BELIEF_ONLY";
  readonly subject_id: IdentifierV0;
  readonly state_revision: StateRevisionV0;
  readonly current_logical_time: LogicalTimeV0;
  readonly projection_hash: HashV1;
  readonly action_space_fingerprint: HashV1;
  readonly source_accepted_proposal_fingerprint: HashV1;
  readonly source_relation_projection_fingerprint: HashV1;
  readonly source_belief_integration_policy_id: typeof BELIEF_DECISION_INTEGRATION_POLICY_ID_V0;
  readonly source_belief_integration_policy_fingerprint: HashV1;
  readonly source_belief_tendency_output_fingerprint: HashV1;
  readonly output_fingerprint: HashV1;
}

/**
 * SELECTED outcome: unique exact positive maximum winner (§14/§15).
 * selected_action is an ActionIntentV0 constructed by copying the exact winning
 * AllowedActionV0 tuple fields (action_type, target_ref). No third action shape.
 *
 * NO_SELECTION outcome: lawful terminal result (§14/§46). Not a failure.
 * Both outcomes receive decision capability (§77).
 */
export type BeliefDecisionSelectionV0 =
  | (BeliefDecisionSelectionBaseV0 & {
      readonly decision_kind: "SELECTED";
      readonly selected_action: ActionIntentV0;
      readonly no_selection_reason: null;
    })
  | (BeliefDecisionSelectionBaseV0 & {
      readonly decision_kind: "NO_SELECTION";
      readonly selected_action: null;
      readonly no_selection_reason: BeliefDecisionNoSelectionReasonV0;
    });

/**
 * Authority-safe producer input (§9): NO caller-supplied tendency projection,
 * relation projection, scores, winner, rank, margin or selected action is
 * accepted — the producer re-derives all of them internally from frozen
 * authorities.
 */
export interface BeliefDecisionArbitrationInputV0 {
  readonly current_projection: CognitiveContextProjectionV0;
  readonly allowed_actions: readonly AllowedActionV0[];
  readonly accepted_cognition_proposal: AcceptedCognitionProposalV1;
}

// ---- decision capability (§32-§34) ------------------------------------------------

/**
 * Module-private WeakSet capability (§32). NEVER exported. Both SELECTED and
 * NO_SELECTION results are minted (§77: NO_SELECTION is a lawful terminal
 * result and receives decision capability).
 */
const authorizedBeliefDecisionSelectionsV0 = new WeakSet<BeliefDecisionSelectionV0>();

/**
 * Minimum safe public read-only verifier (§34). Exported because §75 clone
 * tests require observing authorization state. Cannot mint, remint or alter
 * authorization — merely checks current in-process object identity.
 */
export function isAuthorizedBeliefDecisionSelectionV0(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    authorizedBeliefDecisionSelectionsV0.has(value as BeliefDecisionSelectionV0)
  );
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
 * §48 numeric invariant gate: every aggregate_tendency used in arbitration must
 * be a finite number within inclusive [-1,1] and not negative zero. Fail closed,
 * no clamp, no repair.
 */
function requireArbitrationNumeric(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new BeliefDecisionArbitrationErrorV0(
      "NUMERIC_INVARIANT_VIOLATION",
      `${label}: non-finite or non-number value (fail closed, no clamp)`
    );
  }
  if (value < -1 || value > 1) {
    throw new BeliefDecisionArbitrationErrorV0(
      "NUMERIC_INVARIANT_VIOLATION",
      `${label}: value ${value} outside inclusive [-1,1] (fail closed, no clamp)`
    );
  }
  if (Object.is(value, -0)) {
    throw new BeliefDecisionArbitrationErrorV0(
      "NUMERIC_INVARIANT_VIOLATION",
      `${label}: negative zero forbidden (frozen producer normalizes; fail closed)`
    );
  }
  return value;
}

/**
 * §16 EXACT_TUPLE membership: the selected (action_type, target_ref) must be an
 * exact member of the SAME canonical action universe. No action_type-only
 * matching, no null-target relaxation, no target repair, no case normalization,
 * no nearest action. Uses JSON tuple key for exact structural equality.
 */
function assertExactTupleMembership(
  selected: ActionIntentV0,
  canonicalActions: readonly AllowedActionV0[]
): void {
  const selectedKey = JSON.stringify([selected.action_type, selected.target_ref]);
  for (const action of canonicalActions) {
    if (JSON.stringify([action.action_type, action.target_ref]) === selectedKey) {
      return;
    }
  }
  throw new BeliefDecisionArbitrationErrorV0(
    "SELECTED_ACTION_NOT_ALLOWED",
    `selected action tuple is not an exact member of the canonical action universe: ${selectedKey}`
  );
}

// ---- producer -------------------------------------------------------------------------

/**
 * produceBeliefDecisionSelectionV0 — the ONE deterministic Belief-only
 * UNIQUE_POSITIVE_MAX arbitration producer of this slice.
 *
 * Gate order (deterministic first failure, fail closed):
 *   1. derive the constant arbitration policy fingerprint
 *      (ARBITRATION_POLICY_MISMATCH guard)
 *   2. internally re-derive the frozen Belief tendency projection via
 *      produceBeliefDecisionTendencyProjectionV0 — its capability chain is the
 *      first relation-authority gate; stale projection / changed universe /
 *      clones fail through frozen lower-layer codes (passthrough, no remap §47)
 *   3. defensive source-fingerprint coherence →
 *      SOURCE_TENDENCY_FINGERPRINT_MISMATCH
 *   4. §48 numeric invariant re-validation of every aggregate_tendency
 *   5. UNIQUE_POSITIVE_MAX arbitration (§20-§26):
 *      eligible = aggregate_tendency > 0 (exact IEEE-754, +0 NOT eligible)
 *      no eligible → NO_SELECTION / NO_POSITIVE_TENDENCY
 *      exact IEEE-754 maximum; === tie identity
 *      exactly one winner → SELECTED (§16 exact tuple membership)
 *      more than one → NO_SELECTION / POSITIVE_MAX_TIE
 *   6. output fingerprint (hashEnvelope/JCS over the full body excluding
 *      output_fingerprint), deep freeze, capability mint (§32/§37/§77).
 *
 * Zero model calls. Zero mutation authority. Recompute-only: no store, no
 * workflow, no checkpoint, no receipt system, no cache. No action execution.
 */
export async function produceBeliefDecisionSelectionV0(
  input: BeliefDecisionArbitrationInputV0
): Promise<BeliefDecisionSelectionV0> {
  const projection = input.current_projection;
  const accepted = input.accepted_cognition_proposal;

  // 1. Constant arbitration policy fingerprint (§6/§36).
  const policyFingerprint = await deriveBeliefPositiveMaxArbitrationPolicyFingerprintV0();

  // 2. Internal tendency re-derivation through the frozen producer (§10/§17).
  // The frozen producer's capability chain is the first relation-authority gate;
  // stale projection / changed universe / clones fail through frozen lower-layer
  // codes (UNAUTHORIZED_ACCEPTED_COGNITION_PROPOSAL, BOUND_CONTEXT_MISMATCH,
  // ACTION_SPACE_MISMATCH, integration policy codes) — passthrough, no remap (§47).
  const tendencyProjection: BeliefDecisionTendencyProjectionV0 =
    await produceBeliefDecisionTendencyProjectionV0({
      current_projection: projection,
      allowed_actions: input.allowed_actions,
      accepted_cognition_proposal: accepted
    });

  // 3. Defensive source-fingerprint coherence (internal invariant; unreachable
  // via the public API without a frozen-foundation defect — fail closed regardless).
  if (
    tendencyProjection.subject_id !== projection.subject_id ||
    tendencyProjection.state_revision !== projection.state_revision ||
    tendencyProjection.current_logical_time !== projection.current_logical_time ||
    tendencyProjection.projection_hash !== projection.projection_hash
  ) {
    throw new BeliefDecisionArbitrationErrorV0(
      "SOURCE_TENDENCY_FINGERPRINT_MISMATCH",
      "internally re-derived tendency projection is not bound to the current projection"
    );
  }

  // 4-5. §48 numeric re-validation + UNIQUE_POSITIVE_MAX arbitration (§20-§26).
  // eligible = aggregate_tendency > 0 (exact IEEE-754; +0 NOT eligible because
  // 0 > 0 is false). No epsilon, no margin, no lexical/position/random tie-break.
  // Canonical order is NEVER used to resolve a tie (§27).
  let maxValue = -Infinity;
  let winnerCount = 0;
  let winnerAction: AllowedActionV0 | null = null;

  for (const tendency of tendencyProjection.action_tendencies) {
    const aggregate = requireArbitrationNumeric(
      tendency.aggregate_tendency,
      `aggregate_tendency(${tendency.action.action_type})`
    );
    if (aggregate > 0) {
      if (aggregate > maxValue) {
        maxValue = aggregate;
        winnerCount = 1;
        winnerAction = tendency.action;
      } else if (aggregate === maxValue) {
        winnerCount += 1;
      }
    }
  }

  // Canonical action universe for §16 membership: the tendency producer already
  // validated and canonically sorted the action universe; action_tendencies
  // contains exactly one entry per canonical action.
  const canonicalActions = tendencyProjection.action_tendencies.map((t) => t.action);

  // Build base provenance fields (§13): 14 fields excluding output_fingerprint.
  const baseFields = {
    schema_version: BELIEF_DECISION_SELECTION_SCHEMA_VERSION,
    policy_id: BELIEF_POSITIVE_MAX_ARBITRATION_POLICY_ID_V0,
    policy_fingerprint: policyFingerprint,
    domain_scope: "BELIEF_ONLY" as const,
    subject_id: projection.subject_id,
    state_revision: projection.state_revision,
    current_logical_time: projection.current_logical_time,
    projection_hash: projection.projection_hash,
    action_space_fingerprint: tendencyProjection.action_space_fingerprint,
    source_accepted_proposal_fingerprint: accepted.accepted_proposal_fingerprint,
    source_relation_projection_fingerprint: tendencyProjection.source_relation_projection_fingerprint,
    source_belief_integration_policy_id: BELIEF_DECISION_INTEGRATION_POLICY_ID_V0,
    source_belief_integration_policy_fingerprint: tendencyProjection.policy_fingerprint,
    source_belief_tendency_output_fingerprint: tendencyProjection.output_fingerprint
  };

  // Determine outcome (§20-§26/§46): NO_SELECTION is lawful, not a failure.
  let outcomeFields:
    | { decision_kind: "SELECTED"; selected_action: ActionIntentV0; no_selection_reason: null }
    | {
        decision_kind: "NO_SELECTION";
        selected_action: null;
        no_selection_reason: BeliefDecisionNoSelectionReasonV0;
      };

  if (winnerCount === 0) {
    // §21/§22/§23: all nonpositive or empty universe → lawful NO_SELECTION.
    outcomeFields = {
      decision_kind: "NO_SELECTION",
      selected_action: null,
      no_selection_reason: "NO_POSITIVE_TENDENCY"
    };
  } else if (winnerCount === 1 && winnerAction !== null) {
    // §20/§24: exactly one unique positive maximum → SELECTED.
    // §15: construct ActionIntentV0 by copying exact winning tuple fields.
    const selectedAction: ActionIntentV0 = {
      action_type: winnerAction.action_type,
      target_ref: winnerAction.target_ref
    };
    // §16: EXACT_TUPLE membership check against the canonical action universe.
    assertExactTupleMembership(selectedAction, canonicalActions);
    outcomeFields = {
      decision_kind: "SELECTED",
      selected_action: selectedAction,
      no_selection_reason: null
    };
  } else {
    // §25/§27: positive exact tie → lawful NO_SELECTION. No first-element,
    // no lexical order, no canonical order tiebreaker, no random, no model.
    outcomeFields = {
      decision_kind: "NO_SELECTION",
      selected_action: null,
      no_selection_reason: "POSITIVE_MAX_TIE"
    };
  }

  // 6. Output body + fingerprint (§13/§35): hashEnvelope/JCS over the FULL
  // output excluding output_fingerprint. No wall clock, no random, no vendor,
  // no host action presentation order.
  const fullBody = { ...baseFields, ...outcomeFields };
  const outputFingerprint = await hashEnvelope(
    BELIEF_DECISION_SELECTION_OUTPUT_FINGERPRINT_PROJECTION,
    fullBody
  );

  const selection = {
    ...fullBody,
    output_fingerprint: outputFingerprint
  } as BeliefDecisionSelectionV0;

  // §37: deep-freeze the entire result graph (including selected ActionIntent).
  deepFreeze(selection);

  // §32/§77: mint capability for BOTH SELECTED and NO_SELECTION (lawful terminal).
  authorizedBeliefDecisionSelectionsV0.add(selection);

  return selection;
}
