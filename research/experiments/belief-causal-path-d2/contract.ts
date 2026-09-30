/* eslint-disable no-restricted-imports -- Isolated research preregistration over frozen built production roots (repository convention); zero production code changes and no production import of this module. */
/**
 * D2 — BELIEF CAUSAL PATH LOCALIZATION. FROZEN PREREGISTRATION CONSTANTS. NOT RUN.
 *
 * D1 is frozen at `BELIEF_STATE_DECISION_SENSITIVITY_NOT_ESTABLISHED` and is NOT modified,
 * re-run, remediated or reinterpreted here. D2 is a separate line whose only purpose is to
 * localise the FIRST break in the chain
 *
 *   Canonical Belief -> Projection -> Semantic Uptake -> Appraisal/Cognition -> Structured Decision
 *
 * It is explicitly NOT an attempt to make belief "work".
 */

import { hashEnvelope } from "../../../packages/subject-core/dist/index.js";
import type { HashV1 } from "../../../packages/subject-core/dist/index.js";

export const D2_VERSION = "belief-causal-path-localization-d2" as const;
export const D2_HASH_PROJECTION_V0 = "characteros-next/research/d2-belief-causal-path/v1" as const;

/** D1's frozen result, carried forward as a fact and never reopened. */
export const D2_D1_HANDOFF = Object.freeze({
  d1_verdict: "BELIEF_STATE_DECISION_SENSITIVITY_NOT_ESTABLISHED",
  d1_dataset_hash: "sha256:02bd7e315b434492b83663fa61d45b18f9332f8fd19f073c49663113602d5908",
  d1_core_schedule_hash: "sha256:d1ee515fa295cf4290a0e68cd15128b58db01420fe06a6866bf50ab12da8e371",
  d1_model_calls: 66,
  d1_may_be_modified_rerun_or_reinterpreted: false,
  established_by_d1_without_any_model_call: [
    "LINK 1 (Canonical Belief): a lawful counterfactual credence 0.80 / 0.20 materialises through production genesis authoring and is the ONLY canonical state difference (isolation diff = ['/beliefs/items/0/credence'])",
    "LINK 2 (Projection): the production V2 projection carries the belief line, and the fully certified model-facing request contains it; request isolation is byte-exact after the two frozen normalisations"
  ],
  left_unlocalised_by_d1: [
    "LINK 3 (Semantic Uptake): whether the executor can recover the proposition's endorsement meaning from the projection at all",
    "LINK 4 (Appraisal/Cognition): whether a legible state is USED while processing the current observation",
    "LINK 5 (Structured Decision): whether a cognition-level difference survives into the decision"
  ],
  what_d1_did_show: "the structured decision did not move at all (delta_verify = delta_accept = 0.000 against a 0.3903 ceiling and a 0.50 floor), while the negative control proved the probe was valid (ACCEPT modal 6/6 in both arms) and the frame-minimal diagnostic was also null"
});

/** The causal graph D2 is designed to walk, one link at a time. */
export const D2_CAUSAL_GRAPH = Object.freeze({
  chain: ["canonical_belief", "projection", "semantic_uptake", "appraisal_cognition", "structured_decision"],
  links_1_2_status: "MECHANICALLY_ESTABLISHED_BY_D1_WITHOUT_MODEL_CALLS",
  links_3_4_5_status: "UNLOCALISED",
  d2_a_targets: "semantic_uptake",
  d2_b_targets: "appraisal_cognition",
  d2_c_combines: "d2_a + d2_b + the frozen d1 result into a localisation matrix",
  no_link_may_be_tested_before_its_predecessor_is_qualified: true
});

// =============================================================================================
// Stage D2-A — semantic readout (a research instrument, NOT a behaviour endpoint)
// =============================================================================================

/** Frozen closed set for the D2-A readout. Ordered from strongest endorsement to strongest doubt. */
export const D2A_READOUT_TOKENS = Object.freeze([
  "ENDORSES_STRONGLY",
  "ENDORSES_MILDLY",
  "UNDECIDED",
  "DOUBTS_MILDLY",
  "DOUBTS_STRONGLY"
] as const);
export type D2AReadoutToken = (typeof D2A_READOUT_TOKENS)[number];

/**
 * Frozen anchors. They define the SCALE ONLY: they say what each bucket means, never which bucket
 * corresponds to which credence, and never mention the subject's own state, high/low, or any arm.
 */
export const D2A_ANCHORS = Object.freeze({
  ENDORSES_STRONGLY:
    "the subject would treat the proposition as settled in its favour and would rely on it without reservation",
  ENDORSES_MILDLY:
    "the subject leans in favour of the proposition while still leaving room for doubt",
  UNDECIDED: "the subject holds no stance either way on the proposition",
  DOUBTS_MILDLY: "the subject leans against the proposition while still leaving room for doubt",
  DOUBTS_STRONGLY:
    "the subject would treat the proposition as settled against it and would rely on its denial without reservation"
});

/** Pre-registered direction. Written before any call. */
export const D2A_PREDICTION = Object.freeze({
  HIGH_0_80_expected_bucket: "ENDORSES_STRONGLY",
  LOW_0_20_expected_bucket: "DOUBTS_STRONGLY",
  /** Any bucket strictly on the endorsing side counts as "read as endorsing". */
  HIGH_acceptance_set: ["ENDORSES_STRONGLY", "ENDORSES_MILDLY"],
  LOW_acceptance_set: ["DOUBTS_STRONGLY", "DOUBTS_MILDLY"],
  primary_criterion: "the modal bucket for HIGH lies in HIGH_acceptance_set AND the modal bucket for LOW lies in LOW_acceptance_set AND the two modal buckets differ"
});

export const D2A_INSTRUMENT_LAWS = Object.freeze({
  state_blind: "the readout never names the subject's credence, an arm, a level, or a treatment",
  no_answer_in_task: "the question never states which bucket is correct for any state",
  no_arm_labels: "no HIGH / LOW / arm / treatment token may appear anywhere in the model-facing request",
  same_projection_path: "the stimulus is the unmodified production canonical projection; no hand-written subject data",
  no_action_token: "the readout contains no ACCEPT / VERIFY / REJECT and no action vocabulary",
  not_a_behaviour_endpoint: "a positive D2-A result licenses a SEMANTIC LEGIBILITY claim only, never behavioural causality"
});

export interface D2AManifestV0 {
  readonly readout_tokens: readonly string[];
  readonly anchors: typeof D2A_ANCHORS;
  readonly prediction: typeof D2A_PREDICTION;
  readonly laws: typeof D2A_INSTRUMENT_LAWS;
  readonly states: { readonly HIGH: number; readonly LOW: number };
  readonly replicates_per_state: number;
  readonly manifest_hash: HashV1;
}

export const D2A_STATES = Object.freeze({ HIGH: 0.8, LOW: 0.2 });

export async function deriveD2AManifestV0(replicatesPerState: number): Promise<D2AManifestV0> {
  const body = {
    readout_tokens: D2A_READOUT_TOKENS,
    anchors: D2A_ANCHORS,
    prediction: D2A_PREDICTION,
    laws: D2A_INSTRUMENT_LAWS,
    states: D2A_STATES,
    replicates_per_state: replicatesPerState
  };
  return Object.freeze({ ...body, manifest_hash: await hashEnvelope(D2_HASH_PROJECTION_V0, body) });
}

// =============================================================================================
// Stage D2-B — belief-relevant appraisal construct (designed, NOT authorised until D2-A passes)
// =============================================================================================

export const D2B_APPRAISAL_TOKENS = Object.freeze([
  "SUFFICIENT_TO_PROCEED",
  "NEEDS_MORE_EVIDENCE",
  "INSUFFICIENT_TO_PROCEED"
] as const);
export type D2BAppraisalToken = typeof D2B_APPRAISAL_TOKENS[number];

export const D2B_APPRAISAL_ANCHORS = Object.freeze({
  SUFFICIENT_TO_PROCEED: "the evidence available for the present question is enough to settle it",
  NEEDS_MORE_EVIDENCE: "the evidence available for the present question would have to be supplemented before it can settle anything",
  INSUFFICIENT_TO_PROCEED: "the evidence available for the present question is not merely incomplete but unusable for settling it"
});

export const D2B_LAWS = Object.freeze({
  probe_family: "the frozen D1 underdetermined P1 / P2 observations",
  same_observation_across_arms: true,
  belief_is_the_only_causally_relevant_state_difference: true,
  contains_no_final_action_token: "no ACCEPT / VERIFY / REJECT appears in the D2-B contract",
  does_not_ask_the_model_to_obey_the_belief: true,
  does_not_state_a_target_bucket_for_any_state: true,
  construct_definitions_are_state_blind: true,
  authorisation: "DESIGNED ONLY; D2-B may not be run until D2-A is qualified"
});

// =============================================================================================
// Stage D2-C — localisation matrix (the pre-registered interpretation)
// =============================================================================================

export const D2_LOCALIZATION_MATRIX = Object.freeze({
  A_null: {
    condition: "the semantic readout does not track the state",
    verdict: "BELIEF_PROJECTION_SEMANTIC_UPTAKE_NOT_ESTABLISHED",
    first_place_to_look: "representation / projection semantics",
    next_action: "audit the projection surface itself; do NOT proceed to D2-B"
  },
  A_positive_B_null: {
    condition: "the executor reads the state correctly but the appraisal construct does not follow it",
    verdict: "BELIEF_STATE_LEGIBLE_BUT_COGNITIVELY_INERT",
    significance: "an architectural diagnosis: the projection works and the state is readable, yet cognition does not consume it",
    next_action: "investigate the cognition-side consumption path, not the projection"
  },
  A_positive_B_positive_D1_null: {
    condition: "the state changes the appraisal construct but the frozen D1 decision does not move",
    verdict: "BELIEF_EFFECT_PRESENT_UPSTREAM_BUT_LOST_BEFORE_DECISION",
    significance: "the break is in the downstream decision/action mapping",
    next_action: "investigate the decision mapping, not the projection or cognition uptake"
  },
  both_positive_unexpected_for_d1: {
    condition: "A and B both positive AND a future decision endpoint moves",
    verdict: "CONSISTENT_WITH_D1_NULL_BEING_DECISION_BOUND",
    note: "only reachable if a later authorised round re-tests a decision endpoint; D2 itself does not re-run D1"
  }
});

// =============================================================================================
// Verdict vocabulary, budget, stopping rules
// =============================================================================================

export const D2_VERDICTS = Object.freeze([
  "D2_PREREGISTRATION_READY",
  "D2_DESIGN_BLOCKED",
  "D2A_INSTRUMENT_QUALIFIED",
  "D2A_INSTRUMENT_UNQUALIFIED",
  "CANONICAL_BELIEF_PROJECTION_SEMANTICALLY_LEGIBLE",
  "BELIEF_PROJECTION_SEMANTIC_UPTAKE_NOT_ESTABLISHED",
  "BELIEF_STATE_LEGIBLE_BUT_COGNITIVELY_INERT",
  "BELIEF_EFFECT_PRESENT_UPSTREAM_BUT_LOST_BEFORE_DECISION",
  "CONSISTENT_WITH_D1_NULL_BEING_DECISION_BOUND",
  "INCONCLUSIVE_BY_DECISION_NOISE",
  "INCONCLUSIVE_BY_INSUFFICIENT_STATE_SEPARATION",
  "D2_BLOCKED_BY_STATE_ISOLATION_FAILURE",
  "D2_BLOCKED_BY_LEAKAGE_AUDIT_FAILURE",
  "D2_B_NOT_AUTHORISED_BEFORE_D2_A_QUALIFIES"
] as const);

export const D2_BUDGET = Object.freeze({
  phase_0_offline: 0,
  /** D2-A: two states x r replicates. */
  d2a_formula: "2r",
  d2a_r_min: 6,
  d2a_r_max: 20,
  d2a_min: 12,
  d2a_max: 40,
  /** D2-B runs only if D2-A qualifies; same shape. */
  d2b_formula: "2r per probe family (P1 and P2)",
  d2b_min: 24,
  d2b_max: 80,
  total_min_if_both_run: 36,
  total_max_if_both_run: 120,
  no_model_call_before_offline_gates_pass: true,
  /** D1 already spent 66; D2 is a separate budget and does not reuse D1 calls. */
  d1_calls_are_not_reused_as_d2_evidence: true
});

export const D2_STOPPING_RULES = Object.freeze([
  "G1 state isolation: the HIGH/LOW canonical diff must remain exactly ['/beliefs/items/0/credence'] (or the Revision 4 four-path set, normalised back to credence-only) → else D2_BLOCKED_BY_STATE_ISOLATION_FAILURE, 0 calls",
  "G2 leakage: the readout request must contain no arm label, no credence value outside the production belief line, no answer hint, no action token → else D2_BLOCKED_BY_LEAKAGE_AUDIT_FAILURE, 0 calls",
  "G3 request certification: the D2-A request must pass the same byte-exact normalised H/L equivalence used in D1 → else stop, 0 calls",
  "G4 pilot: a 6-replicate same-request neutral pilot must give a usable modal resolution; no r <= 20 separates the effect from the observed noise → INCONCLUSIVE_BY_DECISION_NOISE",
  "G5 D2-A: if the readout does not track the state → BELIEF_PROJECTION_SEMANTIC_UPTAKE_NOT_ESTABLISHED and DO NOT run D2-B",
  "G6 D2-B: authorised only after D2-A qualifies; otherwise D2_B_NOT_AUTHORISED_BEFORE_D2_A_QUALIFIES"
]);

export const D2_PROHIBITIONS = Object.freeze([
  "modifying, re-running, remediating or reinterpreting D1",
  "strengthening the CAUTION credence",
  "using 0 or 1 extreme credences to hunt for an effect",
  "adding any 'you must follow this belief' instruction",
  "raising the belief's prompt priority",
  "swapping the proposition until something turns positive",
  "treating a positive semantic readout as behavioural causality",
  "using the model's own statement that it considered the belief as causal evidence",
  "using LLM explanation, chain-of-thought or self-report as causal evidence in any stage"
]);
