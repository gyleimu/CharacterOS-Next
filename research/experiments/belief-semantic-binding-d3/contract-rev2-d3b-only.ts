/* eslint-disable no-restricted-imports -- Isolated research preregistration over frozen built production roots (repository convention); zero production code changes and no production import of this module. */
/**
 * D3 REVISION 2 — D3-A REMOVED; D3-B-ONLY DESIGN FROZEN. NOT RUN. ZERO MODEL CALLS.
 *
 * WHY THIS FILE EXISTS
 *   REVISION 1 was blocked: the proposed stage D3-A (canonical proposition stance binding, link 3B1)
 *   is redundant with the frozen D2-A0 instrument, whose contract question was "the subject's stance
 *   on the proposition shown in the belief line", whose anchors define the buckets as the proposition
 *   being settled in its favour / against it, and whose frozen primary criterion is exactly 3B1's
 *   predicate — already met, 6/6 versus 6/6, at twelve trials.
 *
 *   This revision records that finding as a machine-readable verdict, deletes the D3-A execution path,
 *   and freezes the D3-B-only design. It supersedes exactly three things:
 *
 *     1. the D3-A execution path (removed as redundant);
 *     2. the D3-B interpretation matrix's verdict wording (the integration reading is demoted from an
 *        observational verdict to a labelled architectural hypothesis);
 *     3. the definition of what the D3-B pilot's mapping counts — REVISION 1 stated the mapping and the
 *        six-valid precondition but never said in so many words that the counted quantity is the
 *        number of trials carrying the most frequent relation token. That omission is the same class of
 *        gap that stopped the D2 A1 pilot, so it is closed here, at zero calls.
 *
 *   Nothing about D1, D2, the CAUTION proposition, the arm credences, the A1 paraphrase, the prompt or
 *   the product is modified. D2-B remains locked.
 */

import { hashEnvelope } from "../../../packages/subject-core/dist/index.js";
import type { HashV1 } from "../../../packages/subject-core/dist/index.js";

import { D2_LOCALIZATION_MATRIX_REV1 } from "../belief-causal-path-d2/contract-rev1.ts";
import {
  D3_BUDGET,
  D3_HASH_PROJECTION_V0,
  D3_A1_PARAPHRASE_FROZEN,
  D3B_ANCHORS,
  D3B_CONTRACT_TEXT,
  D3B_EXPECTED_RELATION_MAP,
  D3B_INPUTS_FROZEN,
  D3B_NOISE_RULE,
  D3B_QUALIFICATION_FIXTURES,
  D3B_QUALIFICATION_RULE,
  D3B_TOKENS,
  deriveD3ManifestV0
} from "./contract.ts";
import {
  D2A0_ANCHORS,
  D2A0_PREDICTION,
  D2A0_TOKENS
} from "../belief-causal-path-d2/contract-rev1.ts";
import { D2A0_CONTRACT_TEXT } from "../belief-causal-path-d2/contract-rev1-1b-a0-fixtures.ts";
import { D1_PROPOSITION_LABEL } from "../belief-state-sensitivity-d1/contract.ts";

export const D3_VERSION_REV2 = "belief-semantic-binding-localization-d3-rev2" as const;

export const D3_REVISION_1_MANIFEST_HASH =
  "sha256:adcb3212726a972383b72d826c522b074bab9fbe0396df0f6d9844961df78d8a" as const;

// =============================================================================================
// 1. THE D3-A REDUNDANCY FINDING, AS A MACHINE-READABLE VERDICT
// =============================================================================================

export const D3_A_REDUNDANCY_VERDICT = Object.freeze({
  verdict: "D3_A_REDUNDANT_WITH_D2_A0",
  proposed_stage: "D3_A",
  proposed_link: "3B1 canonical proposition stance binding",
  subsuming_stage: "D2_A0",
  measured_object_compared: "the subject's stance on the canonical proposition",

  d2_a0_measurement_target: "the subject's stance on the proposition shown in the belief line",
  d2_a0_measurement_target_source: "contract-rev1-1b-a0-fixtures.ts :: D2A0_CONTRACT_TEXT",
  d2_a0_anchor_favourable: D2A0_ANCHORS.ENDORSES_STRONGLY,
  d2_a0_anchor_unsettled: D2A0_ANCHORS.UNDECIDED,
  d2_a0_anchor_against: D2A0_ANCHORS.DOUBTS_STRONGLY,
  d2_a0_primary_criterion: D2A0_PREDICTION.directional.requirement,
  d2_a0_acceptance_sets: Object.freeze({
    endorsing: D2A0_PREDICTION.directional.endorsing_set,
    doubting: D2A0_PREDICTION.directional.doubting_set
  }),
  d2_a0_observed: Object.freeze({ HIGH_0_80: "ENDORSES_STRONGLY 6/6", LOW_0_20: "DOUBTS_STRONGLY 6/6" }),
  d2_a0_dataset_hash: "sha256:eb8be177c7954147ef71a0b8b465a4551809d99ad2c7449a99e3b45c7bb17287",

  conclusion:
    "canonical credence -> canonical proposition stance binding is ALREADY ESTABLISHED by D2-A0; a D3-A that differs only by using three buckets instead of five is not a new measurement",
  therefore: "the D3-A execution path is deleted; no D3-A call may be made in any future round",
  what_this_does_not_say:
    "this is not a claim about what a D3-A run would return; it is a claim that the result would not be new information",
  outcome_based: false,
  removed_because: "redundant with an already-frozen positive result, not because of any D3 outcome"
});

// =============================================================================================
// 2. THE CORRECTED CAUSAL GRAPH
// =============================================================================================

export const D3_REV2_GRAPH = Object.freeze({
  chain: [
    "canonical_belief",
    "production_projection",
    "canonical_proposition_stance_binding",
    "canonical_paraphrase_relation_recognition",
    "cross_wording_stance_transfer",
    "epistemic_appraisal",
    "structured_decision"
  ],
  links: [
    { link: "1_canonical_state", status: "ESTABLISHED_BY_D1_OFFLINE_PRODUCTION_STATE_EVIDENCE", stage: "D1" },
    { link: "2_production_projection", status: "ESTABLISHED_BY_D1_PRODUCTION_PROJECTION_EVIDENCE", stage: "D1" },
    { link: "3B1_canonical_proposition_stance_binding", status: "ESTABLISHED_BY_D2_A0_DO_NOT_RETEST", stage: "D2_A0" },
    { link: "3B2_canonical_paraphrase_relation_recognition", status: "UNTESTED", stage: "D3_B" },
    { link: "3B3_cross_wording_stance_transfer", status: "NOT_ESTABLISHED_BY_FROZEN_D2_A1_VALID_NULL", stage: "D2_A1_DO_NOT_RERUN" },
    { link: "4_epistemic_appraisal", status: "NOT_AUTHORISED", stage: "D2_B_LOCKED" },
    { link: "5_structured_decision", status: "D1_STRUCTURED_DECISION_NULL_REMAINS_FROZEN", stage: "D1" }
  ],
  law: "no link may be re-tested once established or once adjudicated; D3 tests exactly one link, 3B2"
});

// =============================================================================================
// 3. D3-B SCIENTIFIC ROLE AND FROZEN VOCABULARY
// =============================================================================================

export const D3B_ROLE = Object.freeze({
  role: "STATE-BLIND EXECUTOR CAPABILITY DIAGNOSTIC",
  inputs_are_only_two_frozen_expressions: true,
  input_a: D1_PROPOSITION_LABEL,
  input_b: D3_A1_PARAPHRASE_FROZEN,
  must_not_contain: [
    "CharacterOS subject state",
    "a credence",
    "HIGH / LOW / NEUTRAL",
    "A1 outputs",
    "D1 outputs",
    "a behaviour or action endpoint"
  ],
  is_characteros_causal_evidence: false,
  what_it_checks:
    "whether the executor can identify the semantic relation between these two literal texts in a direct relation task",
  target_pair_frozen: true,
  target_pair_modified_after_a1: false,
  new_paraphrase_added: false,
  design_used_the_specific_a1_low_count_pattern: false,
  target_prediction: D3B_INPUTS_FROZEN.expected_relation,
  vocabulary: D3B_TOKENS
});

// =============================================================================================
// 4. THE D3-B PILOT MAPPING, NOW WITH AN EXPLICIT COUNTED QUANTITY
// =============================================================================================

/**
 * The sentence REVISION 1 omitted. Without it, "modal_count" is a number whose definition the same
 * rule never supplies — the exact class of gap that stopped the D2 A1 pilot.
 */
export const D3B_MODAL_COUNT_DEFINITION = Object.freeze({
  counted_quantity: "the number of the six valid pilot trials carrying the single most frequent relation token",
  modal_token: "the relation token with a strictly highest count among the six valid trials",
  tie_at_the_top: {
    consequence: "there is no unique modal token, so the mapping has no defined input",
    verdict: "D3_B_INCONCLUSIVE_BY_MODAL_TIE_UNDEFINED",
    rationale:
      "the frozen mapping keys are bare counts; without a unique modal there is nothing to look up, and a tie may not be resolved permissively"
  },
  mapping_reachable_only_when: "every one of the six planned trials carries a legal relation token",
  invalid_trials_never_contribute_to_the_count: true,
  six_invalid_trials_can_never_yield_modal_count_six: true,
  mapping: D3B_NOISE_RULE.mapping,
  mapping_unchanged_from_revision_1: true
});

// =============================================================================================
// 5. THE D3-B INTERPRETATION MATRIX
// =============================================================================================

export const D3B_INTERPRETATION_MATRIX = Object.freeze({
  positive: {
    condition: "the frozen relation diagnostic returns its preregistered positive",
    verdict: "PREREGISTERED_PARAPHRASE_RELATION_RECOGNIZED",
    combined_with_existing_evidence: Object.freeze({
      d2_a0: "canonical stance binding established",
      d3_b: "canonical/paraphrase relation recognition established in a direct diagnostic",
      d2_a1: "cross-wording stance transfer not established"
    }),
    frozen_combined_statement: "SEMANTIC_COMPONENT_CAPABILITIES_SEPARATELY_PRESENT_BUT_CROSS_WORDING_STANCE_TRANSFER_NOT_ESTABLISHED",
    forbidden_unconditional_mechanism_verdict: "SEMANTIC_COMPONENTS_PRESENT_BUT_CROSS_WORDING_STANCE_INTEGRATION_FAILED",
    why_forbidden:
      "an integration failure is one explanation of the pattern, not an observation; issuing it as a verdict would state a mechanism the design cannot observe",
    permitted_discussion_form:
      "the pattern is consistent with a failure of compositional / integrative use — to be labelled a hypothesis or architectural interpretation, never an observational verdict",
    may_not_reopen_link_4: true
  },
  null: {
    condition: "the frozen relation diagnostic returns a valid null",
    verdict: "PREREGISTERED_PARAPHRASE_RELATION_RECOGNITION_NOT_ESTABLISHED",
    consequence: "the A1 null may NOT be further attributed to cross-wording integration",
    strongest_permitted_conclusion:
      "canonical proposition stance binding is established, relation recognition for the preregistered paraphrase was not established in the direct diagnostic, and A1 cross-wording stance transfer was also not established"
  },
  inconclusive: {
    condition: "collection integrity failure or invalid provider/parser data",
    produces_a_new_localization_verdict: false,
    retained: "the D2-A1 valid null, unchanged",
    recorded_as: "D3-B diagnostic inconclusive"
  },
  link_4_reopened_by_any_row: false
});

// =============================================================================================
// 6. D2-B REMAINS LOCKED
// =============================================================================================

export const D3_D2B_LOCK = Object.freeze({
  d2_b_authorised: false,
  d2_b_executed: false,
  even_if_d3_b_is_positive: true,
  why:
    "D2's frozen sequential rule authorises B only after an A1 POSITIVE; the frozen A1 result is a valid null, and a D3-B positive cannot substitute for it",
  d3_b_may_not_substitute_for_a1_positive: true,
  link_4_reopened: false,
  any_result_of_d3_reopens_link_4: false,
  d2_remains_permanently_stopped_at_a1: true
});

// =============================================================================================
// 7. EXECUTABILITY AUDIT — decision frozen vs executable form present
// =============================================================================================

export interface D3BRuleExecutabilityRowV0 {
  readonly rule_id: string;
  readonly decision_frozen: boolean;
  readonly executable_form_present: boolean;
  readonly closing_step: string;
  readonly blocks_the_round_before_calls: boolean;
}

/**
 * Every rule the D3-B execution needs, classified by whether the DECISION is frozen and whether an
 * EXECUTABLE form exists. A frozen decision with a pending implementation is next round's first
 * offline step; a missing decision would block. None is missing.
 */
export const D3B_EXECUTABILITY_AUDIT: readonly D3BRuleExecutabilityRowV0[] = Object.freeze([
  {
    rule_id: "qualification_fixtures_and_expected_relation_map",
    decision_frozen: true,
    executable_form_present: true,
    closing_step: "already executable: literal bytes and an explicit map",
    blocks_the_round_before_calls: false
  },
  {
    rule_id: "qualification_rule_and_invalid_policy",
    decision_frozen: true,
    executable_form_present: false,
    closing_step: "implement the qualification scorer as a callable pure function in the next round's offline step",
    blocks_the_round_before_calls: false
  },
  {
    rule_id: "transformer_contract",
    decision_frozen: true,
    executable_form_present: false,
    closing_step: "implement the frozen transformer name and pass its offline conformance gate at zero calls",
    blocks_the_round_before_calls: false
  },
  {
    rule_id: "pilot_noise_mapping_and_modal_count_definition",
    decision_frozen: true,
    executable_form_present: false,
    closing_step: "implement the pilot classifier as a callable pure function, including the tie verdict",
    blocks_the_round_before_calls: false
  },
  {
    rule_id: "measurement_rule_unanimity_and_invalid_handling",
    decision_frozen: true,
    executable_form_present: false,
    closing_step: "implement the measurement scorer as a callable pure function",
    blocks_the_round_before_calls: false
  },
  {
    rule_id: "call_budget",
    decision_frozen: true,
    executable_form_present: true,
    closing_step: "already executable: frozen integers",
    blocks_the_round_before_calls: false
  }
]);

export const D3B_EXECUTABILITY_SUMMARY = Object.freeze({
  rules_audited: D3B_EXECUTABILITY_AUDIT.length,
  decisions_missing: D3B_EXECUTABILITY_AUDIT.filter((r) => !r.decision_frozen).length,
  executable_forms_missing: D3B_EXECUTABILITY_AUDIT.filter((r) => !r.executable_form_present).length,
  blocking_gaps: D3B_EXECUTABILITY_AUDIT.filter((r) => r.blocks_the_round_before_calls).length,
  distinction:
    "a frozen decision whose implementation is pending is closed by the next round's offline step; a missing decision would be a preregistration gap and would stop that round before any call",
  verdict: "D3_B_ALL_DECISIONS_FROZEN_IMPLEMENTATIONS_PENDING"
});

// =============================================================================================
// 8. DESIGN INTEGRITY
// =============================================================================================

export const D3_REV2_DESIGN_INTEGRITY = Object.freeze({
  d3_a_removed_because_redundant: true,
  d3_a_removed_due_to_outcome: false,
  d3_b_design_used_specific_a1_low_count_pattern: false,
  d3_b_target_pair_changed_after_a1: false,
  d3_b_expected_relation_changed_after_a1: false,
  d3_b_contract_text_changed_from_revision_1: false,
  d3_b_fixtures_changed_from_revision_1: false,
  d1_modified: false,
  d2_modified: false,
  caution_modified: false,
  arm_credences_modified: false,
  a1_paraphrase_modified: false
});

// =============================================================================================
// 9. MECHANICAL SELF-CHECKS + MANIFEST
// =============================================================================================

export interface D3Rev2ManifestV0 {
  readonly version: typeof D3_VERSION_REV2;
  readonly redundancy_verdict: typeof D3_A_REDUNDANCY_VERDICT;
  readonly graph: typeof D3_REV2_GRAPH;
  readonly role: typeof D3B_ROLE;
  readonly modal_count_definition: typeof D3B_MODAL_COUNT_DEFINITION;
  readonly matrix: typeof D3B_INTERPRETATION_MATRIX;
  readonly d2b_lock: typeof D3_D2B_LOCK;
  readonly executability_audit: readonly D3BRuleExecutabilityRowV0[];
  readonly executability_summary: typeof D3B_EXECUTABILITY_SUMMARY;
  readonly design_integrity: typeof D3_REV2_DESIGN_INTEGRITY;
  readonly budget: typeof D3_BUDGET;
  readonly d2_a1_null_verdict_unchanged: string;
  readonly revision_1_manifest_hash_preserved: string;
  readonly tests: Readonly<Record<string, unknown>>;
  readonly manifest_hash: HashV1;
}

export async function deriveD3Rev2ManifestV0(): Promise<D3Rev2ManifestV0> {
  const problems: string[] = [];
  const check = (condition: boolean, message: string): void => {
    if (!condition) problems.push(message);
  };

  // The redundancy finding must still be supported by the frozen D2 modules.
  check(D2A0_CONTRACT_TEXT.includes("the proposition shown in the belief line"), "A0's contract no longer asks about the proposition's stance");
  check(/settled in its favour/.test(D2A0_ANCHORS.ENDORSES_STRONGLY), "A0's favourable anchor changed");
  check(/settled against it/.test(D2A0_ANCHORS.DOUBTS_STRONGLY), "A0's opposing anchor changed");
  const endorsing = D2A0_PREDICTION.directional.endorsing_set as readonly string[];
  const doubting = D2A0_PREDICTION.directional.doubting_set as readonly string[];
  check(endorsing.length > 0 && doubting.length > 0, "A0's acceptance sets are empty");
  check(D2A0_TOKENS.length === 5, "A0's vocabulary changed");

  // The D3-B design must be unchanged from revision 1.
  const rev1 = await deriveD3ManifestV0();
  check(D3B_TOKENS.length === 3, "the D3-B vocabulary changed");
  check(D3B_QUALIFICATION_FIXTURES.length === 3, "the D3-B fixtures changed");
  check(new Set(D3B_QUALIFICATION_FIXTURES.map((f) => f.expected_relation)).size === 3, "the three D3-B tokens are no longer each expected once");
  check(D3B_QUALIFICATION_FIXTURES.every((f) => D3B_EXPECTED_RELATION_MAP[f.fixture_id] === f.expected_relation), "the D3-B expected map drifted");
  check(!D3B_CONTRACT_TEXT.includes("credence") && !/\b0\.\d/.test(D3B_CONTRACT_TEXT), "the D3-B contract gained a credence or a number");
  check(["HIGH", "LOW", "NEUTRAL"].every((w) => !new RegExp(`\\b${w}\\b`).test(D3B_CONTRACT_TEXT)), "the D3-B contract gained an arm label");
  check(D3B_CONTRACT_TEXT.includes(D1_PROPOSITION_LABEL) && D3B_CONTRACT_TEXT.includes(D3_A1_PARAPHRASE_FROZEN), "the D3-B contract lost one of its two frozen inputs");
  check(Object.values(D3B_ANCHORS).every((a) => D3B_CONTRACT_TEXT.includes(a)), "the D3-B anchors are no longer all present");
  check(D3B_QUALIFICATION_RULE.retry_allowed === false && D3B_QUALIFICATION_RULE.replacement_allowed === false, "a D3-B recovery is allowed");
  check(D3B_QUALIFICATION_RULE.tolerance_or_similarity_substitution === false, "the D3-B qualification rule gained a tolerance");
  check(rev1.d3b_contract_text_hash === "sha256:b2bbeb6a28ae6a4f3fde3f42109d821067135878d774410d03c9eb73a0a8c792", "the revision-1 D3-B contract hash changed");

  // The new definitions and locks.
  check(D3B_MODAL_COUNT_DEFINITION.mapping["6"] === 6 && D3B_MODAL_COUNT_DEFINITION.mapping["5"] === 14, "the D3-B mapping changed");
  check(D3B_MODAL_COUNT_DEFINITION.six_invalid_trials_can_never_yield_modal_count_six, "six invalid trials could yield modal_count 6");
  check(D3B_INTERPRETATION_MATRIX.positive.forbidden_unconditional_mechanism_verdict.includes("INTEGRATION_FAILED"), "the forbidden mechanism verdict was not recorded");
  check(D3B_INTERPRETATION_MATRIX.positive.frozen_combined_statement.includes("TRANSFER_NOT_ESTABLISHED"), "the frozen combined statement is not the transfer-not-established form");
  check(D3B_INTERPRETATION_MATRIX.positive.may_not_reopen_link_4, "the matrix may reopen link 4");
  check(D3_D2B_LOCK.d2_b_authorised === false && D3_D2B_LOCK.even_if_d3_b_is_positive, "the D2-B lock is not absolute");
  check(D3_D2B_LOCK.d2_remains_permanently_stopped_at_a1, "D2 is no longer stopped at A1");
  check(rev1.d3b_contract_text_hash.length > 0, "revision 1 produced no contract hash");
  check(D3B_EXECUTABILITY_SUMMARY.decisions_missing === 0, "a D3-B decision is missing");
  check(D3B_EXECUTABILITY_SUMMARY.blocking_gaps === 0, "a D3-B rule blocks the round before calls");
  check(D3B_EXECUTABILITY_SUMMARY.rules_audited === 6, "the executability audit is incomplete");
  check(D3_REV2_DESIGN_INTEGRITY.d3_a_removed_because_redundant && !D3_REV2_DESIGN_INTEGRITY.d3_a_removed_due_to_outcome, "the removal reason is misstated");
  check(!D3_REV2_DESIGN_INTEGRITY.d3_b_target_pair_changed_after_a1 && !D3_REV2_DESIGN_INTEGRITY.d3_b_expected_relation_changed_after_a1, "a D3-B element changed after A1");
  check(D3_BUDGET.d3a_calls === 0, "the budget still authorises D3-A calls");
  if (problems.length > 0) throw new Error(`D3_REV2_NONCONFORMANT: ${problems.join(" ; ")}`);

  const tests = {
    a0_still_targets_the_proposition_stance: true,
    a0_acceptance_sets_present: true,
    d3b_vocabulary_unchanged: true,
    d3b_fixtures_unchanged: true,
    d3b_contract_hash_unchanged: rev1.d3b_contract_text_hash,
    d3b_contract_still_carries_both_frozen_inputs: true,
    d3b_modal_count_now_explicitly_defined: true,
    six_invalid_cannot_yield_modal_count_six: true,
    mechanism_verdict_demoted_to_hypothesis: true,
    d2b_locked_absolutely: true,
    executability_rules_audited: D3B_EXECUTABILITY_AUDIT.length,
    executability_decisions_missing: D3B_EXECUTABILITY_SUMMARY.decisions_missing,
    executability_blocking_gaps: D3B_EXECUTABILITY_SUMMARY.blocking_gaps,
    d3a_calls_authorised: D3_BUDGET.d3a_calls,
    verification_cost: 0
  };

  const body = {
    version: D3_VERSION_REV2,
    redundancy_verdict: D3_A_REDUNDANCY_VERDICT,
    graph: D3_REV2_GRAPH,
    role: D3B_ROLE,
    modal_count_definition: D3B_MODAL_COUNT_DEFINITION,
    matrix: D3B_INTERPRETATION_MATRIX,
    d2b_lock: D3_D2B_LOCK,
    executability_audit: D3B_EXECUTABILITY_AUDIT,
    executability_summary: D3B_EXECUTABILITY_SUMMARY,
    design_integrity: D3_REV2_DESIGN_INTEGRITY,
    budget: D3_BUDGET,
    d2_a1_null_verdict_unchanged: D2_LOCALIZATION_MATRIX_REV1.A0_positive_A1_null.verdict,
    revision_1_manifest_hash_preserved: D3_REVISION_1_MANIFEST_HASH,
    tests
  };
  return Object.freeze({ ...body, manifest_hash: await hashEnvelope(D3_HASH_PROJECTION_V0, body) });
}
