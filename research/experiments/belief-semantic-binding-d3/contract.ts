/* eslint-disable no-restricted-imports -- Isolated research preregistration over frozen built production roots (repository convention); zero production code changes and no production import of this module. */
/**
 * D3 — BELIEF SEMANTIC BINDING LOCALIZATION. FROZEN PREREGISTRATION. NOT RUN. ZERO MODEL CALLS.
 *
 * D1 and D2 are frozen and are NOT modified, re-run or reinterpreted here. D2 stopped at A1:
 * A0 positive (structural readout), A1 a valid null (semantic uptake not established on the
 * preregistered paraphrase). D2-B is not authorised and is not executed.
 *
 * WHY THE DESIGN IN THE ROUND BRIEF COULD NOT BE ADOPTED AS WRITTEN
 *   The brief refined link 3B into three pieces and proposed a new stage D3-A to test 3B1 (canonical
 *   stance binding). A mechanical audit of the frozen D2-A0 instrument shows 3B1 was ALREADY tested
 *   and ALREADY positive:
 *
 *     - A0's contract question: "Which bucket describes the subject's stance on the proposition shown
 *       in the belief line?" — in the state experiment that proposition IS the canonical CAUTION
 *       proposition;
 *     - A0's anchors: ENDORSES_STRONGLY = "the subject treats the proposition as settled in its
 *       favour and would rely on it without reservation"; DOUBTS_STRONGLY = "the subject treats the
 *       proposition as settled against it and would rely on its denial without reservation";
 *     - A0's frozen directional requirement: "the HIGH modal bucket lies in the endorsing set AND the
 *       LOW modal bucket lies in the doubting set AND the two modal buckets differ";
 *     - A0's frozen outcome: HIGH 6/6 ENDORSES_STRONGLY, LOW 6/6 DOUBTS_STRONGLY.
 *
 *   That is 3B1's definition verbatim, met unanimously at twelve trials. D3-A as specified would
 *   re-measure a settled link with a coarser closed set and renamed tokens. See
 *   D3A_SUBSUMPTION_AUDIT below, which is produced from the frozen modules rather than asserted.
 *
 *   The verdict of the design round is therefore D3_DESIGN_BLOCKED — blocked specifically on the
 *   D3-A premise — while the remainder that IS informative (D3-B: paraphrase relation recognition) is
 *   fully frozen here and ready to execute.
 *
 * SCOPE OF THIS FILE: the D3 handoff, the refined graph, the 3B1 subsumption record, the fully frozen
 * D3-B instrument (fixtures, anchors, schema, contract text, transformer contract, invalid policy,
 * qualification rule, noise rule, measurement rule), the corrected localization matrix, the claim
 * boundaries, and the call budget. Nothing here authorises a call.
 */

import { hashEnvelope } from "../../../packages/subject-core/dist/index.js";
import type { HashV1 } from "../../../packages/subject-core/dist/index.js";

import {
  D2A0_ANCHORS,
  D2A0_PREDICTION,
  D2A0_TOKENS,
  D2_LOCALIZATION_MATRIX_REV1
} from "../belief-causal-path-d2/contract-rev1.ts";
import { D2A0_CONTRACT_TEXT } from "../belief-causal-path-d2/contract-rev1-1b-a0-fixtures.ts";
import { D1_PROPOSITION_LABEL } from "../belief-state-sensitivity-d1/contract.ts";

export const D3_VERSION = "belief-semantic-binding-localization-d3" as const;
export const D3_HASH_PROJECTION_V0 = "characteros-next/research/d3-belief-semantic-binding/v1" as const;

// =============================================================================================
// 1. FROZEN HANDOFF — carried forward as facts, never reopened
// =============================================================================================

export const D3_FROZEN_HANDOFF = Object.freeze({
  d1_verdict: "BELIEF_STATE_DECISION_SENSITIVITY_NOT_ESTABLISHED",
  d1_dataset_hash: "sha256:02bd7e315b434492b83663fa61d45b18f9332f8fd19f073c49663113602d5908",
  d2_a0_verdict: "CANONICAL_BELIEF_PROJECTION_STRUCTURALLY_LEGIBLE",
  d2_a0_magnitude: "STRUCTURAL_MAGNITUDE_CALIBRATED",
  d2_a0_dataset_hash: "sha256:eb8be177c7954147ef71a0b8b465a4551809d99ad2c7449a99e3b45c7bb17287",
  d2_a1_verdict: "BELIEF_PROJECTION_STRUCTURALLY_LEGIBLE_BUT_SEMANTIC_UPTAKE_NOT_ESTABLISHED",
  d2_a1_dataset_hash: "sha256:2cacbf0159af95d9693b8e1fbfd88f3cfa90a38e61ecb043638a28766e061446",
  d2_a1_counts: Object.freeze({
    HIGH_0_80: Object.freeze({ SUPPORTS_PARAPHRASED_PRINCIPLE: 6 }),
    LOW_0_20: Object.freeze({ SUPPORTS_PARAPHRASED_PRINCIPLE: 5, UNCERTAIN_ABOUT_PARAPHRASED_PRINCIPLE: 1 }),
    invalid: 0
  }),
  d2_b_status: "NOT AUTHORISED / NOT EXECUTED. D2 is permanently stopped at A1.",
  d1_d2_may_be_modified_rerun_or_reinterpreted: false,
  caution_proposition_modified: false,
  arm_credences_modified: false,
  a1_paraphrase_modified: false,
  prompt_strengthened: false,
  characteros_core_modified: false,
  proposition_swapped_to_obtain_a_positive: false
});

/** The frozen A1 paraphrase. D3 does NOT modify it and does NOT re-run A1. */
export const D3_A1_PARAPHRASE_FROZEN =
  "the view that a finding depending mainly on secondhand report is to be held with reserve" as const;

// =============================================================================================
// 2. THE REFINED CAUSAL GRAPH
// =============================================================================================

export const D3_REFINED_GRAPH = Object.freeze({
  chain: [
    "canonical_belief",
    "projection",
    "structural_readout",
    "canonical_stance_binding",
    "paraphrase_relation_recognition",
    "cross_wording_stance_transfer",
    "epistemic_appraisal",
    "structured_decision"
  ],
  links: [
    { link: "1_canonical_state", status: "ESTABLISHED_BY_D1_NO_MODEL_CALL", stage: null },
    { link: "2_projection", status: "ESTABLISHED_BY_D1_NO_MODEL_CALL", stage: null },
    { link: "3A_structural_readout", status: "ESTABLISHED", stage: "D2_A0" },
    {
      link: "3B1_canonical_stance_binding",
      status: "ESTABLISHED_BY_D2_A0_NOT_YET_RECOGNISED_AS_SUCH",
      stage: "D2_A0",
      note: "the round brief proposed a new stage D3-A for this link; the mechanical audit shows A0's frozen instrument already tested and met it"
    },
    { link: "3B2_paraphrase_relation_recognition", status: "UNLOCALISED", stage: "D3_B" },
    { link: "3B3_cross_wording_stance_transfer", status: "NOT_ESTABLISHED_VALID_NULL", stage: "D2_A1 (frozen, not re-run)" },
    { link: "4_epistemic_appraisal", status: "UNLOCALISED_NOT_AUTHORISED", stage: "D2_B" },
    { link: "5_structured_decision", status: "D1_NULL", stage: "D1 (frozen)" }
  ],
  law: "a successor stage may run only after its predecessor is qualified; D3 does not reopen any D1 or D2 result"
});

// =============================================================================================
// 3. THE 3B1 SUBSUMPTION AUDIT — sources recorded here, produced by the audit script
// =============================================================================================

/** The question A0's frozen contract actually asked. */
export const D3_A0_READOUT_QUESTION = Object.freeze({
  literal: "Which bucket describes the subject's stance on the proposition shown in the belief line?",
  source: "contract-rev1-1b-a0-fixtures.ts :: D2A0_CONTRACT_TEXT (last line before the end marker)",
  extracted_from_the_frozen_text: true
});

export const D3A_SUBSUMPTION_AUDIT = Object.freeze({
  proposed_stage: "D3_A",
  proposed_construct: "3B1 canonical stance binding",
  proposed_prediction: "HIGH 0.80 -> SUPPORTS_CANONICAL_PRINCIPLE; LOW 0.20 -> OPPOSES_CANONICAL_PRINCIPLE",
  already_tested_by: "D2_A0",
  a0_measurement_target_is_the_canonical_proposition: true,
  a0_bucket_meanings_are_stance_meanings: true,
  a0_acceptance_sets_are_the_3b1_prediction: true,
  a0_outcome_met: true,
  verdict: "D3_A_IS_SUBSUMED_BY_D2_A0",
  consequence:
    "designing D3-A as specified would spend a full qualification + pilot + treatment cycle re-measuring a link that A0 already established unanimously; the brief's own §7 forbids designing a stage that cannot say anything new, and this stage could not",
  what_is_NOT_claimed: "this finding does NOT say D3-A would return the same result if it were run; it says the result would not be new information"
});

// =============================================================================================
// 4. D3-B — STATE-BLIND SEMANTIC RELATION DIAGNOSTIC (fully frozen)
// =============================================================================================

export const D3B_TOKENS = Object.freeze([
  "SEMANTICALLY_ALIGNED",
  "SEMANTICALLY_UNRELATED",
  "SEMANTICALLY_OPPOSED"
] as const);
export type D3BToken = (typeof D3B_TOKENS)[number];

/**
 * Anchors. State-blind by construction: they define the three relations and never mention a subject,
 * a credence, an arm or the answer. They are about the RELATION BETWEEN TWO SENTENCES.
 */
export const D3B_ANCHORS = Object.freeze({
  SEMANTICALLY_ALIGNED:
    "the two statements express the same view, so accepting one gives reason to accept the other",
  SEMANTICALLY_UNRELATED:
    "the two statements are about different matters, so accepting one gives no reason either way about the other",
  SEMANTICALLY_OPPOSED:
    "the two statements express contrary views, so accepting one gives reason to reject the other"
});

export const D3B_READOUT_SCHEMA_VERSION = "d3-relation-readout-v0" as const;

/**
 * The two statements compared. The first is the canonical CAUTION proposition — a D3-B request is
 * ALWAYS allowed to contain it, because it is one of the two inputs to a relation question. The "do not
 * restate the canonical proposition" law that governed A0/A1 is therefore NOT applicable to D3-B, and
 * this field exists so that a future audit cannot mistake that for a leak.
 */
export const D3B_INPUTS_FROZEN = Object.freeze({
  statement_a: D1_PROPOSITION_LABEL,
  statement_b: D3_A1_PARAPHRASE_FROZEN,
  statement_a_source: "belief-state-sensitivity-d1/contract.ts :: D1_PROPOSITION_LABEL (frozen)",
  statement_b_source: "frozen A1 paraphrase (unchanged)",
  expected_relation: "SEMANTICALLY_ALIGNED",
  law_the_canonical_proposition_may_appear: true,
  law_why: "this is a relation question whose input IS the canonical proposition; forbidding it would forbid the instrument"
});

export const D3B_CONTRACT_TEXT: string = [
  "",
  "--- DECISION PROBE SEMANTIC RELATION CONTRACT (research instrument; binding for THIS invocation) ---",
  "The output-format rules above are SUPERSEDED for this invocation. Nothing else changes.",
  "Respond with EXACTLY ONE JSON object and nothing else. No prose, no code fences.",
  "TWO STATEMENTS are given. Report the relation between them, not the subject's stance on either.",
  "STATEMENT A:",
  `  ${D3B_INPUTS_FROZEN.statement_a}`,
  "STATEMENT B:",
  `  ${D3B_INPUTS_FROZEN.statement_b}`,
  "Required members:",
  '  "d3_relation_schema_version": "d3-relation-readout-v0"',
  '  "relation": one of "SEMANTICALLY_ALIGNED" | "SEMANTICALLY_UNRELATED" | "SEMANTICALLY_OPPOSED"',
  "Relation meanings (binding):",
  `  SEMANTICALLY_ALIGNED — ${D3B_ANCHORS.SEMANTICALLY_ALIGNED}`,
  `  SEMANTICALLY_UNRELATED — ${D3B_ANCHORS.SEMANTICALLY_UNRELATED}`,
  `  SEMANTICALLY_OPPOSED — ${D3B_ANCHORS.SEMANTICALLY_OPPOSED}`,
  "Which relation holds between STATEMENT A and STATEMENT B?",
  "--- END DECISION PROBE SEMANTIC RELATION CONTRACT ---"
].join("\n");

export const D3B_JSON_SCHEMA: Readonly<Record<string, unknown>> = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["d3_relation_schema_version", "relation"],
  properties: {
    d3_relation_schema_version: { const: D3B_READOUT_SCHEMA_VERSION },
    relation: { enum: [...D3B_TOKENS] },
    explanation: { type: "string", minLength: 1, maxLength: 240 }
  }
});

export interface D3BFixtureV0 {
  readonly fixture_id: string;
  readonly statement_a: string;
  readonly statement_b: string;
  readonly expected_relation: D3BToken;
}

/**
 * State-blind qualification fixtures. The topic is a synthetic workshop proposition unrelated to the
 * CAUTION disposition, so a pass cannot come from recognising CAUTION or its paraphrase. Each pair's
 * relation is unambiguous by construction, and each of the three tokens is expected exactly once.
 */
export const D3B_QUALIFICATION_FIXTURES: readonly D3BFixtureV0[] = Object.freeze([
  Object.freeze({
    fixture_id: "D3B-QF-A-ALIGNED",
    statement_a: "A clamp should always be used when gluing a joint.",
    statement_b: "Clamping a joint while the glue sets is always the right thing to do.",
    expected_relation: "SEMANTICALLY_ALIGNED"
  }),
  Object.freeze({
    fixture_id: "D3B-QF-B-UNRELATED",
    statement_a: "A clamp should always be used when gluing a joint.",
    statement_b: "The workshop's saw blade needs sharpening this month.",
    expected_relation: "SEMANTICALLY_UNRELATED"
  }),
  Object.freeze({
    fixture_id: "D3B-QF-C-OPPOSED",
    statement_a: "A clamp should always be used when gluing a joint.",
    statement_b: "Clamping a joint while the glue sets does more harm than good.",
    expected_relation: "SEMANTICALLY_OPPOSED"
  })
]);

export const D3B_EXPECTED_RELATION_MAP: Readonly<Record<string, D3BToken>> = Object.freeze(
  Object.fromEntries(D3B_QUALIFICATION_FIXTURES.map((f) => [f.fixture_id, f.expected_relation]))
) as Readonly<Record<string, D3BToken>>;

export const D3B_TRANSFORMER_CONTRACT = Object.freeze({
  name: "buildD3RelationReadoutRequestV0",
  input: "a pristine production V8 cognition request (production system prompt, production user content, V8 structured-output declaration)",
  substitution: "structured_output.schema is replaced by D3B_JSON_SCHEMA exactly once",
  append: "D3B_CONTRACT_TEXT is appended to the system message exactly once, the production content surviving as a byte-exact prefix",
  preserves_production_prefix_byte_for_byte: true,
  fails_on_already_transformed_request: true,
  transformer_on_transformer: false,
  must_reject_a_request_carrying: ["the A1 contract", "the A0 contract", "a B contract", "a DecisionProbeV2 contract"],
  contract_text_hash_projection: D3_HASH_PROJECTION_V0,
  implementation_status_at_freeze_time: "NOT YET IMPLEMENTED — the contract is frozen here; implementation and its offline conformance gate are the first steps of the execution round, before any call"
});

export const D3B_QUALIFICATION_RULE = Object.freeze({
  fixtures: 3,
  replicates_per_fixture: 3,
  planned_calls: 9,
  rule: "each fixture's modal relation must equal the fixture's pre-registered expected relation, exactly",
  invalid_rule: "any_invalid_qualification_trial_fails_that_instrument_qualification",
  counts_as_invalid: [
    "transport failure",
    "timeout classified as a failed provider attempt",
    "malformed output",
    "parser invalid",
    "relation token outside the frozen D3-B vocabulary"
  ],
  denominator: "always the full nine planned trials",
  retry_allowed: false,
  replacement_allowed: false,
  extra_call_allowed: false,
  invalid_may_be_deleted: false,
  verdict_if_met: "D3_B_INSTRUMENT_QUALIFIED",
  verdict_if_not: "D3_B_INSTRUMENT_UNQUALIFIED",
  tolerance_or_similarity_substitution: false
});

export const D3B_NOISE_RULE = Object.freeze({
  pilot_shape: "6 byte-identical calls of the frozen real diagnostic (statement A vs statement B)",
  planned_calls: 6,
  valid_required_for_noise_scoring: 6,
  invalid_is_not_a_relation_token: true,
  mapping: Object.freeze({ "0": "STOP", "1": "STOP", "2": "STOP", "3": "STOP", "4": "STOP", "5": 14, "6": 6 }),
  on_any_invalid: {
    verdict: "D3_B_INCONCLUSIVE_BY_PILOT_INVALID_OUTPUTS",
    r_confirm_computed: false,
    treatment_may_run: false
  },
  stop_verdict: "INCONCLUSIVE_BY_DECISION_NOISE"
});

export const D3B_MEASUREMENT_RULE = Object.freeze({
  shape: "r_confirm_B byte-identical calls of the frozen real diagnostic",
  positive_requires: "EVERY one of the r_confirm_B trials returns SEMANTICALLY_ALIGNED",
  why_unanimity: "a state-blind capability claim about a single fixed question has no between-arm contrast to absorb noise; a single dissenting trial means the capability is not reliable",
  any_invalid: "D3_B_INCONCLUSIVE_BY_STATE_EXPERIMENT_INVALID_OUTPUTS — never a null, never a positive",
  on_positive: "PARAPHRASE_RELATION_RECOGNITION_ESTABLISHED",
  on_failure_without_invalid: "PARAPHRASE_RELATION_RECOGNITION_NOT_ESTABLISHED",
  tie_semantics: "not applicable: unanimity leaves nothing tied",
  thresholds_added: false
});

// =============================================================================================
// 5. THE CORRECTED LOCALIZATION MATRIX
// =============================================================================================

export const D3_LOCALIZATION_MATRIX = Object.freeze({
  preface:
    "3B1 is established by D2-A0, so the D3 matrix has no D3-A row. The informative rows are the D3-B result crossed with the frozen A1 null.",
  rows: [
    {
      id: "B_null",
      condition: "the executor does not reliably recognise the canonical/paraphrase relation",
      verdict: "PARAPHRASE_RELATION_RECOGNITION_NOT_ESTABLISHED",
      breakpoint: "canonical proposition -> preregistered paraphrase relation",
      next: "the A1 null is at least partly attributable to a relation-recognition problem at the measurement layer; do NOT widen this to global semantic failure"
    },
    {
      id: "B_positive",
      condition: "the executor recognises the relation, and A1 was a valid null",
      verdict: "SEMANTIC_COMPONENTS_PRESENT_BUT_CROSS_WORDING_STANCE_INTEGRATION_FAILED",
      breakpoint: "semantic binding / integration across wordings",
      next:
        "the two components are separately available (stance binding per D2-A0, relation recognition per D3-B) yet the stance does not travel across the wording change; this localises the A1 null to integration rather than to numeric readability or basic language understanding"
    },
    {
      id: "B_inconclusive",
      condition: "collection integrity or invalid provider/parser data",
      verdict: "D3_B_INCONCLUSIVE_*",
      breakpoint: null,
      next: "no scientific verdict; inconclusive is not null"
    }
  ],
  forbidden_extrapolations: [
    "global semantic unreadability",
    "cognition use, appraisal or behaviour claims",
    "history internalization",
    "the term 'cognitively inert' (still requires A0+ / A1+ / B-null in the D2 sense, which D2 never reached)"
  ]
});

// =============================================================================================
// 6. CLAIM BOUNDARIES
// =============================================================================================

export const D3_CLAIM_BOUNDARIES = Object.freeze({
  d3_answers_at_most:
    "which of the candidate explanations of the frozen A1 null is better supported: a paraphrase-relation recognition problem at the measurement layer, or a cross-wording integration failure with both components separately present",
  d3_does_not_answer: [
    "cognition use",
    "appraisal",
    "behaviour",
    "history internalization",
    "autonomous belief formation"
  ],
  link_4_may_be_reconsidered_only_after: "link 3B is fully adjudicated, which D3 alone cannot do",
  d3b_is_not_characteros_causal_evidence: true,
  why:
    "D3-B is state-blind: it contains no subject state, no credence, no arm and no A1 output, so a pass is a statement about the executor's relation judgement, not about CharacterOS"
});

// =============================================================================================
// 7. DESIGN-INTEGRITY DECLARATION (the round brief's §7)
// =============================================================================================

export const D3_DESIGN_INTEGRITY = Object.freeze({
  design_triggered_by: "the fact that D2-A1 produced a valid null, and only that fact",
  design_triggered_by_the_specific_a1_count_pattern: false,
  a1_low_5_supports_1_uncertain_pattern_used_to_tune_anything: false,
  d3b_token_definitions_adjusted_for_the_a1_pattern: false,
  d3b_fixture_wording_chosen_with_reference_to_the_a1_pattern: false,
  thresholds_or_expected_directions_chosen_to_explain_the_a1_pattern: false,
  d3b_is_not_designed_to_explain_away_the_a1_null: true,
  note:
    "D3-B's fixtures are about a synthetic workshop proposition unrelated to CAUTION, and each pair's relation is unambiguous by construction; no element of D3-B was selected to produce, explain away, or be consistent with the specific 5+1 A1 outcome"
});

// =============================================================================================
// 8. CALL BUDGET
// =============================================================================================

export const D3_BUDGET = Object.freeze({
  d3b_qualification: 9,
  d3b_pilot: 6,
  d3b_formula: "r_confirm_B",
  r_candidates: Object.freeze({ "6": 6, "14": 14 }),
  authorised_total_max: 29,
  authorised_detail_max: "9 qualification + 6 pilot + 14 measurement",
  minimum_path: 9,
  minimum_detail: "D3-B qualification fails; nothing further runs",
  d3a_calls: 0,
  d3a_detail: "D3-A is not authorised: it is subsumed by D2-A0",
  if_a_human_were_to_insist_on_d3a_anyway: "9 + 6 + 2r, i.e. 27 to 55 further calls, for information D2-A0 already carries — recorded for completeness, NOT authorised",
  d1_or_d2_calls_reused: false,
  sequential_stopping_counted: true
});

// =============================================================================================
// 9. MECHANICAL SELF-CHECKS + MANIFEST
// =============================================================================================

const A1_TOKEN_VOCABULARY = ["SUPPORTS_PARAPHRASED_PRINCIPLE", "UNCERTAIN_ABOUT_PARAPHRASED_PRINCIPLE", "OPPOSES_PARAPHRASED_PRINCIPLE"];

export interface D3ManifestV0 {
  readonly version: typeof D3_VERSION;
  readonly handoff: typeof D3_FROZEN_HANDOFF;
  readonly graph: typeof D3_REFINED_GRAPH;
  readonly subsumption_audit: typeof D3A_SUBSUMPTION_AUDIT;
  readonly a0_readout_question: typeof D3_A0_READOUT_QUESTION;
  readonly d3b: Readonly<Record<string, unknown>>;
  readonly matrix: typeof D3_LOCALIZATION_MATRIX;
  readonly claim_boundaries: typeof D3_CLAIM_BOUNDARIES;
  readonly design_integrity: typeof D3_DESIGN_INTEGRITY;
  readonly budget: typeof D3_BUDGET;
  readonly tests: Readonly<Record<string, unknown>>;
  readonly manifest_hash: HashV1;
  readonly d3b_contract_text_hash: HashV1;
  readonly d3b_fixture_manifest_hash: HashV1;
  readonly d3b_anchors_hash: HashV1;
  readonly subsumption_body_hash: HashV1;
}

export async function deriveD3ManifestV0(): Promise<D3ManifestV0> {
  const problems: string[] = [];
  const check = (condition: boolean, message: string): void => {
    if (!condition) problems.push(message);
  };

  // The A0 instrument's own frozen text must support the subsumption finding.
  const a0QuestionInContract = D2A0_CONTRACT_TEXT.includes(D3_A0_READOUT_QUESTION.literal);
  check(a0QuestionInContract, "the A0 readout question is not present in the frozen A0 contract text");
  const endorsing = D2A0_PREDICTION.directional.endorsing_set as readonly string[];
  const doubting = D2A0_PREDICTION.directional.doubting_set as readonly string[];
  check(endorsing.includes("ENDORSES_STRONGLY") && doubting.includes("DOUBTS_STRONGLY"), "A0's acceptance sets changed");
  check(
    /settled in its favour/.test(D2A0_ANCHORS.ENDORSES_STRONGLY) && /settled against it/.test(D2A0_ANCHORS.DOUBTS_STRONGLY),
    "A0's stance anchors no longer read as support/oppose of the proposition"
  );
  check(D2A0_TOKENS.length === 5, "the A0 vocabulary changed");

  // D3-B internal consistency.
  check(D3B_QUALIFICATION_FIXTURES.length === 3, "D3-B does not have three qualification fixtures");
  check(new Set(D3B_QUALIFICATION_FIXTURES.map((f) => f.expected_relation)).size === D3B_TOKENS.length, "the three D3-B tokens are not each expected exactly once");
  check(
    D3B_QUALIFICATION_FIXTURES.every((f) => D3B_EXPECTED_RELATION_MAP[f.fixture_id] === f.expected_relation),
    "the D3-B expected-relation map disagrees with the fixtures"
  );
  const fixtureText = D3B_QUALIFICATION_FIXTURES.map((f) => `${f.statement_a} ${f.statement_b}`).join(" ");
  check(!fixtureText.includes(D1_PROPOSITION_LABEL), "a D3-B qualification fixture leaks the canonical proposition");
  check(!fixtureText.includes(D3_A1_PARAPHRASE_FROZEN), "a D3-B qualification fixture leaks the frozen paraphrase");
  check(!A1_TOKEN_VOCABULARY.some((t) => fixtureText.includes(t)), "a D3-B qualification fixture leaks an A1 token");
  check(!D3B_CONTRACT_TEXT.includes("credence"), "the D3-B contract mentions a credence");
  check(!/\b0\.\d/.test(D3B_CONTRACT_TEXT), "the D3-B contract contains a numeric value");
  check(
    !["HIGH", "LOW", "NEUTRAL"].some((w) => new RegExp(`\\b${w}\\b`).test(D3B_CONTRACT_TEXT)),
    "the D3-B contract contains an arm label"
  );
  check(D3B_CONTRACT_TEXT.includes(D3B_INPUTS_FROZEN.statement_a) && D3B_CONTRACT_TEXT.includes(D3B_INPUTS_FROZEN.statement_b), "the D3-B contract does not carry both frozen statements");
  check(D3B_MEASUREMENT_RULE.positive_requires.includes("EVERY"), "the D3-B measurement rule is not unanimous");
  check(D3B_NOISE_RULE.mapping["6"] === 6 && D3B_NOISE_RULE.mapping["5"] === 14, "the D3-B noise mapping changed");
  check(D3B_QUALIFICATION_RULE.retry_allowed === false && D3B_QUALIFICATION_RULE.replacement_allowed === false, "the D3-B qualification rule allows recovery");
  check(!D3_LOCALIZATION_MATRIX.rows.some((r) => r.id.startsWith("A")), "the matrix still contains a D3-A row");
  check(D3_BUDGET.d3a_calls === 0, "the budget authorises D3-A calls");
  check(D3_BUDGET.authorised_total_max === 29, "the authorised budget changed");
  check(D3_DESIGN_INTEGRITY.design_triggered_by_the_specific_a1_count_pattern === false, "the design claims to be tuned to the A1 count pattern");
  check(D3_FROZEN_HANDOFF.proposition_swapped_to_obtain_a_positive === false, "the handoff claims a proposition swap");
  if (problems.length > 0) throw new Error(`D3_PREREGISTRATION_NONCONFORMANT: ${problems.join(" ; ")}`);

  const tests = {
    a0_readout_question_found_in_the_frozen_contract_text: a0QuestionInContract,
    a0_acceptance_sets_are_endorses_strongly_and_doubts_strongly: true,
    a0_stance_anchors_read_as_support_and_oppose_of_the_proposition: true,
    d3b_fixtures: D3B_QUALIFICATION_FIXTURES.length,
    d3b_tokens_each_expected_exactly_once: true,
    d3b_fixture_text_contains_no_canonical_proposition_no_paraphrase_no_a1_token: true,
    d3b_contract_has_no_credence_no_number_no_arm_label: true,
    d3b_contract_carries_both_frozen_statements: true,
    d3b_measurement_requires_unanimity: true,
    matrix_has_no_d3a_row: true,
    budget_d3a_calls: D3_BUDGET.d3a_calls,
    budget_authorised_max: D3_BUDGET.authorised_total_max,
    verification_cost: 0
  };

  const d3b = {
    tokens: D3B_TOKENS,
    anchors: D3B_ANCHORS,
    schema: D3B_JSON_SCHEMA,
    schema_version: D3B_READOUT_SCHEMA_VERSION,
    contract_text: D3B_CONTRACT_TEXT,
    inputs: D3B_INPUTS_FROZEN,
    qualification_fixtures: D3B_QUALIFICATION_FIXTURES,
    expected_relation_map: D3B_EXPECTED_RELATION_MAP,
    transformer_contract: D3B_TRANSFORMER_CONTRACT,
    qualification_rule: D3B_QUALIFICATION_RULE,
    noise_rule: D3B_NOISE_RULE,
    measurement_rule: D3B_MEASUREMENT_RULE
  };

  const body = {
    version: D3_VERSION,
    handoff: D3_FROZEN_HANDOFF,
    graph: D3_REFINED_GRAPH,
    subsumption_audit: D3A_SUBSUMPTION_AUDIT,
    a0_readout_question: D3_A0_READOUT_QUESTION,
    d3b,
    matrix: D3_LOCALIZATION_MATRIX,
    claim_boundaries: D3_CLAIM_BOUNDARIES,
    design_integrity: D3_DESIGN_INTEGRITY,
    budget: D3_BUDGET,
    tests
  };
  return Object.freeze({
    ...body,
    manifest_hash: await hashEnvelope(D3_HASH_PROJECTION_V0, body),
    ...(await deriveSecondaryHashes(body))
  });
}

interface D3SecondaryHashesV0 {
  readonly d3b_contract_text_hash: HashV1;
  readonly d3b_fixture_manifest_hash: HashV1;
  readonly d3b_anchors_hash: HashV1;
  readonly subsumption_body_hash: HashV1;
}

async function deriveSecondaryHashes(body: unknown): Promise<D3SecondaryHashesV0> {
  return {
    d3b_contract_text_hash: await hashEnvelope(D3_HASH_PROJECTION_V0, { contract_text: D3B_CONTRACT_TEXT }),
    d3b_fixture_manifest_hash: await hashEnvelope(D3_HASH_PROJECTION_V0, { fixtures: D3B_QUALIFICATION_FIXTURES }),
    d3b_anchors_hash: await hashEnvelope(D3_HASH_PROJECTION_V0, { anchors: D3B_ANCHORS }),
    subsumption_body_hash: await hashEnvelope(D3_HASH_PROJECTION_V0, { body })
  };
}

/** The frozen D2 row this design must not contradict. */
export const D3_D2_A1_NULL_ROW = Object.freeze({
  verdict: D2_LOCALIZATION_MATRIX_REV1.A0_positive_A1_null.verdict,
  next: D2_LOCALIZATION_MATRIX_REV1.A0_positive_A1_null.next,
  unchanged: true
});
