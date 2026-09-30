/* eslint-disable no-restricted-imports -- Isolated research preregistration over frozen built production roots (repository convention); zero production code changes and no production import of this module. */
/**
 * D2 REVISION 1 — IDENTIFIABILITY FINALIZATION. FROZEN. NOT RUN. ZERO MODEL CALLS.
 *
 * The chain is refined into SIX links so that a null can be attributed to the right one:
 *
 *   canonical_belief -> projection -> STRUCTURAL_READOUT -> PROPOSITION_SEMANTIC_UPTAKE
 *                    -> EPISTEMIC_APPRAISAL -> STRUCTURED_DECISION
 *        LINK 1           LINK 2          LINK 3A                LINK 3B            LINK 4      LINK 5
 *
 * D1 is permanently frozen at `BELIEF_STATE_DECISION_SENSITIVITY_NOT_ESTABLISHED` with dataset hash
 * `sha256:02bd7e315b434492b83663fa61d45b18f9332f8fd19f073c49663113602d5908`. D1 is not modified,
 * re-run, remediated or reinterpreted here, and no successor stage may run before its predecessor
 * is qualified.
 *
 * DecisionProbeV2 is NOT reused and NOT modified: D2 uses three NEW research-only transformers with
 * their own contract hashes.
 */

import { hashEnvelope } from "../../../packages/subject-core/dist/index.js";
import type { HashV1 } from "../../../packages/subject-core/dist/index.js";

export const D2_VERSION = "belief-causal-path-localization-d2-rev1" as const;
export const D2_HASH_PROJECTION_V0 = "characteros-next/research/d2-belief-causal-path/v1" as const;

export const D2_REVISION_1_PROVENANCE = Object.freeze({
  supersedes_scope: "the causal graph, the A0/A1 split, the transformer identity and the call budget",
  model_calls_before_revision: 0,
  model_calls_after_revision: 0,
  d1_frozen_verdict: "BELIEF_STATE_DECISION_SENSITIVITY_NOT_ESTABLISHED",
  d1_dataset_hash: "sha256:02bd7e315b434492b83663fa61d45b18f9332f8fd19f073c49663113602d5908",
  d1_touched: false,
  decision_probe_v2_modified: false,
  build_v2_request_reused_as_a_d2_transformer: false
});

// =============================================================================================
// Refined causal graph
// =============================================================================================

export const D2_CAUSAL_GRAPH_REV1 = Object.freeze({
  chain: [
    "canonical_belief",
    "projection",
    "structural_readout",
    "proposition_semantic_uptake",
    "epistemic_appraisal",
    "structured_decision"
  ],
  links: [
    { link: "1_canonical_state", status: "ESTABLISHED_BY_D1_NO_MODEL_CALL", stage: null },
    { link: "2_projection", status: "ESTABLISHED_BY_D1_NO_MODEL_CALL", stage: null },
    { link: "3A_structural_readout", status: "UNLOCALISED", stage: "D2_A0" },
    { link: "3B_proposition_semantic_uptake", status: "UNLOCALISED", stage: "D2_A1" },
    { link: "4_epistemic_appraisal", status: "UNLOCALISED", stage: "D2_B" },
    { link: "5_structured_decision", status: "D1_NULL", stage: "D1 (frozen)" }
  ],
  law: "a successor stage may run only after its predecessor is qualified; A0 fail stops A1 and B; A1 fail stops B"
});

// =============================================================================================
// D2-A0 — STRUCTURAL / NUMERIC LEGIBILITY
// =============================================================================================

export const D2A0_TOKENS = Object.freeze([
  "ENDORSES_STRONGLY",
  "ENDORSES_MILDLY",
  "UNDECIDED",
  "DOUBTS_MILDLY",
  "DOUBTS_STRONGLY"
] as const);
export type D2A0Token = (typeof D2A0_TOKENS)[number];

/** Scale semantics only: never a state-to-bucket mapping, never the subject's own state. */
export const D2A0_ANCHORS = Object.freeze({
  ENDORSES_STRONGLY: "the subject treats the proposition as settled in its favour and would rely on it without reservation",
  ENDORSES_MILDLY: "the subject leans in favour of the proposition while still leaving room for doubt",
  UNDECIDED: "the subject holds no stance either way on the proposition",
  DOUBTS_MILDLY: "the subject leans against the proposition while still leaving room for doubt",
  DOUBTS_STRONGLY: "the subject treats the proposition as settled against it and would rely on its denial without reservation"
});

export const D2A0_ENDPOINT_NAME = "STRUCTURAL_OR_NUMERIC_LEGIBILITY" as const;

/**
 * FROZEN PREDICTION SEMANTICS. Two distinct verdicts; the qualification requirement is stated
 * explicitly so no later reading can pick whichever fits.
 */
export const D2A0_PREDICTION = Object.freeze({
  /** Directional criterion — the PRIMARY qualification requirement for D2-A0. */
  directional: {
    is_primary_qualification_requirement: true,
    requirement: "the HIGH modal bucket lies in the endorsing set AND the LOW modal bucket lies in the doubting set AND the two modal buckets differ",
    endorsing_set: ["ENDORSES_STRONGLY", "ENDORSES_MILDLY"],
    doubting_set: ["DOUBTS_STRONGLY", "DOUBTS_MILDLY"],
    verdict_if_met: "STRUCTURAL_DIRECTION_LEGIBLE"
  },
  /** Magnitude criterion — a STRICTER, separately reported calibration diagnostic. */
  magnitude: {
    is_primary_qualification_requirement: false,
    is_secondary_calibration_diagnostic: true,
    requirement: "HIGH modal = ENDORSES_STRONGLY AND LOW modal = DOUBTS_STRONGLY",
    verdict_if_met: "STRUCTURAL_MAGNITUDE_CALIBRATED"
  },
  /** Frozen unlock rule: A1 requires only the directional criterion. */
  unlocks_a1: "STRUCTURAL_DIRECTION_LEGIBLE",
  both_verdicts_reported_separately: true,
  post_hoc_choice_between_criteria: false
});

// =============================================================================================
// D2-A1 — PROPOSITION SEMANTIC UPTAKE (semantic paraphrase readout)
// =============================================================================================

export const D2A1_PARAPHRASE =
  "the view that a finding depending mainly on secondhand report is to be held with reserve" as const;

export const D2A1_TOKENS = Object.freeze([
  "SUPPORTS_PARAPHRASED_PRINCIPLE",
  "UNCERTAIN_ABOUT_PARAPHRASED_PRINCIPLE",
  "OPPOSES_PARAPHRASED_PRINCIPLE"
] as const);
export type D2A1Token = (typeof D2A1_TOKENS)[number];

export const D2A1_PREDICTION = Object.freeze({
  HIGH_0_80_expected: "SUPPORTS_PARAPHRASED_PRINCIPLE",
  LOW_0_20_expected: "OPPOSES_PARAPHRASED_PRINCIPLE",
  requirement: "the HIGH modal token is SUPPORTS and the LOW modal token is OPPOSES and the two differ",
  verdict_if_met: "CANONICAL_BELIEF_PROPOSITION_SEMANTICALLY_LEGIBLE",
  /** The target of the readout is the PARAPHRASE, which never appears in the projection. */
  why_this_is_not_a_lookup:
    "the paraphrased principle does not appear in the canonical state; the executor must transfer the canonical proposition's endorsement onto a differently-worded formulation",
  unlocks_b: "CANONICAL_BELIEF_PROPOSITION_SEMANTICALLY_LEGIBLE"
});

/** Frozen lexical laws for the A1 contract; audited mechanically before any call. */
export const D2A1_LEXICAL_LAWS = Object.freeze({
  contains_no_credence_number: true,
  contains_no_mapping_hint: "it never explains what 0.8 or 0.2 should map to",
  contains_high_low: false,
  contains_the_canonical_proposition: false,
  contains_action_tokens: false,
  contains_behavior_or_action_instruction: false,
  must_share_no_long_ngram_with_the_canonical_label: true,
  ngream_size: 4
});

// =============================================================================================
// D2-B — EPISTEMIC APPRAISAL (non-actional intermediate construct)
// =============================================================================================

/**
 * Choice frozen: `EPISTEMIC_CONFIDENCE` (not EPISTEMIC_RISK). Exactly one is used.
 * Deliberately NOT `SUFFICIENT_TO_PROCEED` / `NEEDS_MORE_EVIDENCE`, which sit too close to
 * ACCEPT / VERIFY and would smuggle the decision endpoint back in.
 */
export const D2B_CONSTRUCT_NAME = "EPISTEMIC_CONFIDENCE" as const;

export const D2B_TOKENS = Object.freeze(["HIGH_CONFIDENCE", "MODERATE_CONFIDENCE", "LOW_CONFIDENCE"] as const);
export type D2BToken = (typeof D2B_TOKENS)[number];

export const D2B_ANCHORS = Object.freeze({
  HIGH_CONFIDENCE:
    "the subject's confidence in the present unverified finding is high",
  MODERATE_CONFIDENCE:
    "the subject's confidence in the present unverified finding is moderate",
  LOW_CONFIDENCE:
    "the subject's confidence in the present unverified finding is low"
});

export const D2B_FORBIDDEN_CONSTRUCT_VOCABULARY = Object.freeze([
  "proceed",
  "act",
  "verify",
  "accept",
  "reject",
  "should",
  "choose"
]);

export const D2B_PREDICTION = Object.freeze({
  probe_family: "the frozen D1 underdetermined P1 / P2 observations",
  direction: "HIGH caution belief moves the appraisal toward LOWER confidence; LOW caution belief moves it toward HIGHER confidence",
  per_probe_requirement:
    "the HIGH modal confidence bucket is strictly lower than the LOW modal bucket on the frozen ordered scale HIGH > MODERATE > LOW",
  endpoint_frozen: "D2B_TOKENS",
  direction_frozen: true,
  scorer_frozen: "ordinal modal comparison on the three-bucket ordered scale, plus the frozen disagreement-rate rule",
  positive_threshold_frozen: "modal(HIGH) strictly lower than modal(LOW) AND the between-arm disagreement rate exceeds the endpoint's own frozen noise ceiling",
  subjective_trend_reading: false
});

// =============================================================================================
// Instrument qualification (state-blind fixtures, before any state experiment)
// =============================================================================================

export const D2_QUALIFICATION = Object.freeze({
  uses_characteros_canonical_state: false,
  contains_treatment: false,
  purpose:
    "only to check that the instrument can realise its own construct vocabulary; a positive qualification is NOT CharacterOS evidence",
  fixtures_per_instrument: 3,
  replicates_per_fixture: 3,
  instruments: {
    D2_A0: ["explicit strong endorsement", "explicit undecided", "explicit strong doubt"],
    D2_A1: ["obvious support of the paraphrased principle", "obvious uncertainty about it", "obvious opposition to it"],
    D2_B: ["obvious low epistemic risk", "obvious medium epistemic risk", "obvious high epistemic risk"]
  },
  rule_for_each:
    "each fixture's modal token must equal the fixture's pre-registered expected token; otherwise the instrument is NOT qualified and no state experiment may run",
  verdict_if_qualified: "D2_INSTRUMENT_QUALIFIED (per instrument)",
  verdict_if_not: "D2_INSTRUMENT_UNQUALIFIED (per instrument)",
  may_be_used_as_characteros_evidence: false
});

// =============================================================================================
// Noise rule — per endpoint, never shared
// =============================================================================================

export const D2_NOISE_RULE = Object.freeze({
  each_endpoint_has_its_own_neutral_pilot: true,
  pilots_may_not_be_shared_between_endpoints: true,
  d1_pilot_result_reused_as_d2_noise_evidence: false,
  pilot_shape: "6 byte-identical NEUTRAL requests through that endpoint's frozen transformer",
  deterministic_mapping: { 6: 6, 5: 14, 4: "STOP", 3: "STOP", 2: "STOP", 1: "STOP", 0: "STOP" },
  stop_verdict: "INCONCLUSIVE_BY_DECISION_NOISE",
  r_frozen_from_that_endpoints_own_pilot: true,
  r_may_be_chosen_after_seeing_treatment_output: false,
  reason_for_separate_pilots:
    "the three measurement contracts differ, so one endpoint's self-noise is not evidence about another's"
});

// =============================================================================================
// Localisation matrix (D2-C)
// =============================================================================================

export const D2_LOCALIZATION_MATRIX_REV1 = Object.freeze({
  A0_null: {
    condition: "the structural readout does not track the state directionally",
    verdict: "BELIEF_PROJECTION_STRUCTURAL_READOUT_NOT_ESTABLISHED",
    breakpoint: "projection -> structural readout",
    next: "stop; do NOT run A1 or B"
  },
  A0_positive_A1_null: {
    condition: "structurally legible but the paraphrase readout does not follow",
    verdict: "BELIEF_PROJECTION_STRUCTURALLY_LEGIBLE_BUT_SEMANTIC_UPTAKE_NOT_ESTABLISHED",
    breakpoint: "representation -> proposition semantics",
    next: "do NOT run B; do NOT call this cognitively inert"
  },
  A0_A1_positive_B_null: {
    condition: "legible at both levels but the epistemic appraisal does not follow",
    verdict: "BELIEF_STATE_SEMANTICALLY_LEGIBLE_BUT_COGNITIVELY_INERT",
    breakpoint: "semantic uptake -> appraisal use",
    next: "the term 'cognitively inert' is licensed ONLY at this row"
  },
  A0_A1_B_positive_D1_null: {
    condition: "the appraisal construct moves but the frozen D1 decision did not",
    verdict: "BELIEF_EFFECT_PRESENT_IN_APPRAISAL_BUT_LOST_BEFORE_STRUCTURED_DECISION",
    breakpoint: "appraisal -> structured decision mapping",
    next: "investigate the decision mapping"
  }
});

// =============================================================================================
// Verdict vocabulary
// =============================================================================================

export const D2_VERDICTS_REV1 = Object.freeze([
  "D2_PREREGISTRATION_READY",
  "D2_PREREGISTRATION_FINALIZED",
  "D2_DESIGN_BLOCKED",
  "D2_INSTRUMENT_QUALIFIED",
  "D2_INSTRUMENT_UNQUALIFIED",
  "STRUCTURAL_DIRECTION_LEGIBLE",
  "STRUCTURAL_MAGNITUDE_CALIBRATED",
  "STRUCTURAL_READOUT_NOT_ESTABLISHED",
  "CANONICAL_BELIEF_PROPOSITION_SEMANTICALLY_LEGIBLE",
  "BELIEF_PROJECTION_STRUCTURAL_READOUT_NOT_ESTABLISHED",
  "BELIEF_PROJECTION_STRUCTURALLY_LEGIBLE_BUT_SEMANTIC_UPTAKE_NOT_ESTABLISHED",
  "BELIEF_STATE_SEMANTICALLY_LEGIBLE_BUT_COGNITIVELY_INERT",
  "BELIEF_EFFECT_PRESENT_IN_APPRAISAL_BUT_LOST_BEFORE_STRUCTURED_DECISION",
  "INCONCLUSIVE_BY_DECISION_NOISE",
  "INCONCLUSIVE_BY_INSUFFICIENT_STATE_SEPARATION",
  "D2_BLOCKED_BY_STATE_ISOLATION_FAILURE",
  "D2_BLOCKED_BY_LEAKAGE_AUDIT_FAILURE",
  "D2_B_NOT_AUTHORISED_BEFORE_A0_AND_A1_QUALIFY"
] as const);

// =============================================================================================
// Call budget (recomputed for six links and three instruments)
// =============================================================================================

export const D2_BUDGET_REV1 = Object.freeze({
  instrument_qualification_calls: 3 * 3 * 3,
  instrument_qualification_detail: "3 instruments x 3 state-blind fixtures x 3 replicates",
  a0_pilot: 6,
  a1_pilot: 6,
  b_pilot: 6,
  d2a0_formula: "2r",
  d2a1_formula: "2r",
  d2b_formula: "4r (P1 and P2 x 2 arms)",
  r_candidates: { 6: 6, 14: 14, 20: 20 },
  minimum_path_a0_fails: 27,
  minimum_detail_a0_fails: "27 qualification + 6 A0 pilot + 12 A0 at r=6; A1 and B never run",
  expected_path_a0_a1_pass: 27 + 6 + 12 + 6 + 12,
  expected_detail_a0_a1_pass: "A0 and A1 run and qualify; B is not reached in this projection",
  maximum_path_all_stages: 27 + 6 + 40 + 6 + 40 + 6 + 80,
  maximum_detail_all_stages: "all three instruments qualified and all three state experiments run at r = 20",
  minimum: 45,
  expected: 63,
  maximum: 205,
  sequential_stopping_counted: true,
  d1_calls_reused: false
});

// =============================================================================================
// New research-only transformers (DecisionProbeV2 is NOT reused or modified)
// =============================================================================================

export const D2_TRANSFORMER_LAWS = Object.freeze({
  new_transformers: [
    "buildD2StructuralReadoutRequestV0",
    "buildD2SemanticReadoutRequestV0",
    "buildD2AppraisalRequestV0"
  ],
  each_requires_pristine_production_v8_input: true,
  each_substitutes_v8_structured_output_exactly_once: true,
  each_appends_its_own_measurement_contract_exactly_once: true,
  each_has_its_own_frozen_contract_hash: true,
  preserves_production_request_prefix_byte_for_byte: true,
  fails_on_an_already_transformed_request: true,
  transformer_on_transformer: false,
  decision_probe_v2_transformer_reused: false,
  decision_probe_v2_modified: false
});

export interface D2ManifestRev1V0 {
  readonly version: typeof D2_VERSION;
  readonly causal_graph: typeof D2_CAUSAL_GRAPH_REV1;
  readonly a0_tokens: readonly string[];
  readonly a1_paraphrase: string;
  readonly b_construct: string;
  readonly localization_matrix: typeof D2_LOCALIZATION_MATRIX_REV1;
  readonly verdicts: readonly string[];
  readonly budget: typeof D2_BUDGET_REV1;
  readonly manifest_hash: HashV1;
}


/** Canonical D2 revision-1 manifest; its hash is the preregistration identity for D2. */
export async function deriveD2ManifestRev1V0(): Promise<D2ManifestRev1V0> {
  const body = {
    version: D2_VERSION,
    causal_graph: D2_CAUSAL_GRAPH_REV1,
    a0_tokens: D2A0_TOKENS,
    a1_paraphrase: D2A1_PARAPHRASE,
    b_construct: D2B_CONSTRUCT_NAME,
    localization_matrix: D2_LOCALIZATION_MATRIX_REV1,
    verdicts: D2_VERDICTS_REV1,
    budget: D2_BUDGET_REV1
  };
  return Object.freeze({ ...body, manifest_hash: await hashEnvelope(D2_HASH_PROJECTION_V0, body) });
}

