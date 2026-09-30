/* eslint-disable no-restricted-imports -- Isolated research preregistration over frozen built production roots (repository convention); zero production code changes and no production import of this module. */
/**
 * D3 REVISION 4 — THE NOISE RULE AS A STABILITY GATE. FROZEN. NOT RUN. ZERO MODEL CALLS.
 *
 * THE INCOMPATIBILITY THIS FILE FIXES
 *   Revision 3 kept the noise pilot's r-extension mapping: six identical calls, then `6 -> r = 6`,
 *   `5 -> r = 14`, `<= 4 -> STOP`. Combined with the frozen target scorer, that rule is not merely
 *   useless — it is self-defeating.
 *
 *   The target's positive criterion is UNANIMITY: every one of the planned target trials must return the
 *   expected relation. Under unanimity, buying more trials does not absorb noise; it RAISES the bar. Five
 *   agreeing trials out of six is already a failed target run, and fourteen trials demanding fourteen
 *   agreements is strictly harder. So `5 -> r = 14` could never convert a noisy endpoint into a positive;
 *   it could only spend fourteen further calls to confirm a failure.
 *
 *   The mapping is not wrong in general: it suits a modal-based confirmation criterion, where extra
 *   trials can outvote noise. It is incompatible with THIS scorer. Found at
 *   `d3_b_noise_calls_before_amendment = 0` and `d3_b_target_calls_before_amendment = 0`.
 *
 *   Verdict: `D3_B_NOISE_EXTENSION_INCOMPATIBLE_WITH_UNANIMITY_SCORER`.
 *
 * WHAT THIS FILE CHANGES: the noise rule, from an r-extension mapping to a stability gate. The target
 * pair, the expected target relation, the target request, the target scorer and its unanimity criterion,
 * the vocabulary, the anchors, the transformer, the qualification result, the selected noise request and
 * all D1/D2 evidence are untouched. The superseded branch is retired prospectively and its history is
 * preserved.
 */

import { hashEnvelope } from "../../../packages/subject-core/dist/index.js";
import type { HashV1 } from "../../../packages/subject-core/dist/index.js";

import {
  D3_HASH_PROJECTION_V0,
  D3B_INPUTS_FROZEN,
  D3B_NOISE_RULE,
  D3B_QUALIFICATION_FIXTURES
} from "./contract.ts";
import { D3B_MODAL_COUNT_DEFINITION } from "./contract-rev2-d3b-only.ts";
import {
  D3B_NOISE_REQUEST_IDENTITY,
  D3_REV3_BUDGET,
  selectNoiseFixtureIdV0
} from "./contract-rev3-noise-identity.ts";
import { D3B_TARGET_PAIR } from "./transformer-d3b.ts";
import { classifyD3BNoiseStabilityV0 } from "./scorers-d3b.ts";

export const D3_VERSION_REV4 = "belief-semantic-binding-localization-d3-rev4" as const;

export const D3_REVISION_3_MANIFEST_HASH =
  "sha256:07e6a52a8eec4ec39f8bfd19008db49a791255463f96b499fbb0973a435dfad2" as const;

// =============================================================================================
// 1. THE INCOMPATIBILITY
// =============================================================================================

export const D3B_NOISE_UNANIMITY_INCOMPATIBILITY = Object.freeze({
  verdict: "D3_B_NOISE_EXTENSION_INCOMPATIBLE_WITH_UNANIMITY_SCORER",
  discovered_at_noise_calls: 0 as const,
  discovered_at_target_calls: 0 as const,

  the_two_rules_that_cannot_both_stand: [
    "noise modal_count 5 -> r_confirm_B = 14, i.e. buy more trials when the endpoint is noisy",
    "target positive requires every one of the r_confirm_B trials to return the expected relation"
  ],

  why_they_conflict:
    "under unanimity, increasing r does not absorb trial-level variability; it strictly increases the number of agreements required. The extension branch can never turn a noisy endpoint into a positive",

  worked_example:
    "six calls with five expected and one dissent already fail a six-trial unanimity target, and fourteen trials demanding fourteen agreements fail harder",

  classification: "scorer-compatibility correction",
  is_outcome_based_tuning: false,
  no_d3_b_noise_or_target_output_existed: true
});

// =============================================================================================
// 2. THE PRESERVED TARGET CRITERION
// =============================================================================================

export const D3_REV4_TARGET_PRESERVED = Object.freeze({
  target_pair: D3B_TARGET_PAIR,
  target_pair_changed: false,
  expected_target_relation: D3B_INPUTS_FROZEN.expected_relation,
  expected_relation_changed: false,
  target_request_changed: false,
  target_scorer_changed: false,
  unanimity_positive_criterion_unchanged: true,
  target_positive_requires: "planned target trials all legal AND every relation token equals the expected relation",
  any_legal_dissent_yields: "the frozen valid NULL",
  any_invalid_or_integrity_failure_yields: "the frozen INCONCLUSIVE",
  target_scientific_meaning_unchanged: true,
  vocabulary_changed: false,
  anchors_changed: false,
  transformer_changed: false,
  qualification_result_changed: false,
  d1_evidence_changed: false,
  d2_evidence_changed: false
});

// =============================================================================================
// 3. THE STABILITY GATE
// =============================================================================================

export const D3B_NOISE_STABILITY_GATE = Object.freeze({
  rule: "the noise pilot is a STABILITY GATE: it never enlarges the target sample",
  planned_calls: 6,
  one_request_six_times: true,

  pass: {
    condition: "all six trials legal AND the unique modal token's count equals 6 (all six agree with each other)",
    verdict: "D3_B_NOISE_STABILITY_GATE_PASS",
    r_confirm_B: 6,
    target_authorised: true
  },
  self_noise_inconclusive: {
    condition: "all six trials legal BUT the unique modal count is 5 or lower, including any unique-modal tie",
    verdict: "D3_B_INCONCLUSIVE_BY_INSTRUMENT_SELF_NOISE",
    r_confirm_B: null,
    target_authorised: false
  },
  invalid_inconclusive: {
    condition: "any invalid trial",
    verdict: "D3_B_INCONCLUSIVE_BY_NOISE_PILOT_INVALID_OUTPUTS",
    r_confirm_B: null,
    target_authorised: false,
    invalid_policy: "the frozen invalid policy applies unchanged"
  },

  the_gate_is_on_agreement_not_correctness: true,
  why:
    "the six calls must agree with EACH OTHER; the gate deliberately does NOT require the modal token to equal the fixture's pre-registered expected relation, because agreement is a property of the executor while correctness is a property of the fixture — the D2 neutral pilot established exactly this distinction",
  extra_pilot_replicates_allowed: false,
  conversion_to_r_14_allowed: false,
  r_values_reachable: [6],
  unique_modal_definition_unchanged: true,
  tie_semantics_unchanged: D3B_MODAL_COUNT_DEFINITION.tie_at_the_top.verdict
});

/** The superseded branch, retained for the historical record. */
export const D3B_SUPERSEDED_EXTENSION_BRANCH = Object.freeze({
  retired: true,
  retired_prospectively: true,
  retired_at: "SUPERSEDED_BEFORE_ANY_D3_B_NOISE_OR_TARGET_OUTPUT",
  rule: "modal_count 5 -> r_confirm_B = 14",
  source: D3B_NOISE_RULE.mapping,
  history_deleted: false,
  why_retired:
    "it suits a modal-based confirmation criterion, where extra trials can outvote noise, and is incompatible with the frozen unanimity target scorer",
  still_reachable_by_the_pilot: false,
  the_historical_classifier_is_retained_but_must_not_be_used: "classifyD3BNoisePilotV0",
  the_gate_classifier_is_the_authoritative_one: "classifyD3BNoiseStabilityV0"
});

// =============================================================================================
// 4. BUDGET
// =============================================================================================

export const D3_REV4_BUDGET = Object.freeze({
  qualification_completed: 9,
  noise_planned: 6,
  target_planned_if_the_gate_passes: 6,
  complete_success_path: 21,
  absolute_maximum: 21,
  if_the_gate_fails_total_stops_at: 15,
  target_calls_after_a_failed_gate: 0,
  superseded_maximum: 29,
  superseded_maximum_source: D3_REV3_BUDGET.authorised_total_max,
  superseded: true,
  d3a_calls: 0,
  d2b_calls: 0,
  old_29_was_superseded_by_revision_4: true
});

// =============================================================================================
// 5. THE NOISE REQUEST IS UNCHANGED
// =============================================================================================

export const D3_REV4_NOISE_REQUEST = Object.freeze({
  fixture_id: selectNoiseFixtureIdV0(),
  fixture_selection_changed: false,
  fixture_may_be_reselected: false,
  fixture_may_be_reselected_from_qualification_outputs: false,
  request_identity_unchanged_from_revision_3: true,
  request_identity: D3B_NOISE_REQUEST_IDENTITY,
  frozen_request_hash_source: "the D3-B qualification evidence's fixture request artifact",
  frozen_request_hash_must_equal: true
});

// =============================================================================================
// 6. THE PRIOR QUALIFICATION CALLS ON THE SAME REQUEST
// =============================================================================================

export const D3B_NOISE_REQUEST_PRIOR_EXPOSURE = Object.freeze({
  same_request_was_called_during_qualification: true,
  prior_call_count: 3,
  prior_calls_belong_exclusively_to: "D3-B qualification evidence",
  prior_calls_included_in_the_noise_pilot_dataset: false,
  prior_calls_influence_the_six_call_classification: false,
  prior_calls_are_target_evidence: false,
  prior_calls_occurred_before: "the revision 3 / revision 4 noise batch",
  the_new_six_calls_are: "a prospectively frozen independent calibration batch",
  limitation_stated_plainly:
    "the selected calibration request HAS already been observed during qualification; it must not be described as a never-before-seen calibration stimulus",
  what_this_does_not_undermine:
    "the gate reads agreement among the six new calls, and prior exposure cannot make six identical answers more or less agreeing than they are"
});

// =============================================================================================
// 7. MECHANICAL SELF-CHECKS + MANIFEST
// =============================================================================================

export interface D3Rev4ManifestV0 {
  readonly version: typeof D3_VERSION_REV4;
  readonly incompatibility: typeof D3B_NOISE_UNANIMITY_INCOMPATIBILITY;
  readonly target_preserved: typeof D3_REV4_TARGET_PRESERVED;
  readonly stability_gate: typeof D3B_NOISE_STABILITY_GATE;
  readonly superseded_branch: typeof D3B_SUPERSEDED_EXTENSION_BRANCH;
  readonly budget: typeof D3_REV4_BUDGET;
  readonly noise_request: typeof D3_REV4_NOISE_REQUEST;
  readonly prior_exposure: typeof D3B_NOISE_REQUEST_PRIOR_EXPOSURE;
  readonly target_not_executed: true;
  readonly target_calls: 0;
  readonly revision_3_manifest_hash_preserved: string;
  readonly tests: Readonly<Record<string, unknown>>;
  readonly manifest_hash: HashV1;
}

export async function deriveD3Rev4ManifestV0(): Promise<D3Rev4ManifestV0> {
  const problems: string[] = [];
  const check = (condition: boolean, message: string): void => {
    if (!condition) problems.push(message);
  };

  const S = "SEMANTICALLY_ALIGNED";
  const U = "SEMANTICALLY_UNRELATED";
  const O = "SEMANTICALLY_OPPOSED";
  const mk = (tokens: readonly (string | null)[]) =>
    tokens.map((relation, index) => ({ trial_id: `n${String(index)}`, relation, group: "D3B_NOISE" }));

  const cases = [
    { name: "six_identical", tokens: [S, S, S, S, S, S] as readonly (string | null)[] },
    { name: "five_plus_one_legal", tokens: [S, S, S, S, S, U] as readonly (string | null)[] },
    { name: "four_plus_two", tokens: [S, S, S, S, U, O] as readonly (string | null)[] },
    { name: "three_three_tie", tokens: [S, S, S, U, U, U] as readonly (string | null)[] },
    { name: "one_invalid", tokens: [S, S, S, S, S, null] as readonly (string | null)[] },
    { name: "six_invalid", tokens: [null, null, null, null, null, null] as readonly (string | null)[] }
  ];
  const outcomes = cases.map((c) => {
    const outcome = classifyD3BNoiseStabilityV0(mk(c.tokens));
    // widened to number | null so the "never 14" assertion can actually fail if the classifier changes
    const observedR: number | null = outcome.r_confirm_B;
    return { case: c.name, verdict: outcome.pilot_verdict, r_confirm_B: observedR, target_authorised: outcome.target_authorised, modal_count: outcome.modal_count };
  });
  const anyCaseYieldedFourteen = outcomes.some((o) => o.r_confirm_B === 14);
  const onlySixPasses = outcomes.filter((o) => o.target_authorised).every((o) => o.case === "six_identical");
  const sixIdenticalPasses = outcomes[0]?.target_authorised === true && outcomes[0]?.r_confirm_B === 6;
  const fivePlusOneIsInconclusive = outcomes[1]?.verdict === "D3_B_INCONCLUSIVE_BY_INSTRUMENT_SELF_NOISE";
  const tieIsInconclusive = outcomes[3]?.verdict === "D3_B_INCONCLUSIVE_BY_INSTRUMENT_SELF_NOISE";
  const anyInvalidIsInconclusive = outcomes[4]?.verdict === "D3_B_INCONCLUSIVE_BY_NOISE_PILOT_INVALID_OUTPUTS" && outcomes[5]?.verdict === "D3_B_INCONCLUSIVE_BY_NOISE_PILOT_INVALID_OUTPUTS";
  check(!anyCaseYieldedFourteen, "a path still yields r = 14");
  check(onlySixPasses, "a path other than six-identical authorises the target");
  check(sixIdenticalPasses, "six identical calls no longer pass the gate");
  check(fivePlusOneIsInconclusive, "five plus one is not inconclusive");
  check(tieIsInconclusive, "a tie is not inconclusive");
  check(anyInvalidIsInconclusive, "an invalid pilot is not invalid-inconclusive");
  check(D3B_NOISE_UNANIMITY_INCOMPATIBILITY.discovered_at_noise_calls === 0 && D3B_NOISE_UNANIMITY_INCOMPATIBILITY.discovered_at_target_calls === 0, "the conflict was found by spending calls");
  check(!D3B_NOISE_UNANIMITY_INCOMPATIBILITY.is_outcome_based_tuning, "the correction is described as outcome-based tuning");
  check(!D3_REV4_TARGET_PRESERVED.unanimity_positive_criterion_unchanged === false, "the unanimity criterion changed");
  check(!D3_REV4_TARGET_PRESERVED.target_scorer_changed && !D3_REV4_TARGET_PRESERVED.target_pair_changed, "a preserved target element changed");
  check(!D3B_SUPERSEDED_EXTENSION_BRANCH.still_reachable_by_the_pilot, "the superseded branch is still reachable");
  check(!D3B_SUPERSEDED_EXTENSION_BRANCH.history_deleted, "the superseded history was deleted");
  check(D3_REV4_BUDGET.absolute_maximum === 21 && D3_REV4_BUDGET.complete_success_path === 9 + 6 + 6, "the budget is not 21");
  check(D3_REV4_BUDGET.if_the_gate_fails_total_stops_at === 15 && D3_REV4_BUDGET.target_calls_after_a_failed_gate === 0, "a failed gate still funds target calls");
  check(D3_REV4_BUDGET.d3a_calls === 0 && D3_REV4_BUDGET.d2b_calls === 0, "an unauthorised stage is funded");
  check(D3_REV4_NOISE_REQUEST.fixture_id === "D3B-QF-A-ALIGNED" && !D3_REV4_NOISE_REQUEST.fixture_selection_changed, "the noise fixture changed");
  check(D3B_NOISE_REQUEST_PRIOR_EXPOSURE.prior_call_count === 3, "the prior qualification exposure is misrecorded");
  check(!D3B_NOISE_REQUEST_PRIOR_EXPOSURE.prior_calls_included_in_the_noise_pilot_dataset, "prior calls may enter the noise dataset");
  check(!D3B_NOISE_REQUEST_PRIOR_EXPOSURE.prior_calls_are_target_evidence, "prior calls are counted as target evidence");
  check(D3B_NOISE_STABILITY_GATE.r_values_reachable.length === 1 && D3B_NOISE_STABILITY_GATE.r_values_reachable[0] === 6, "an r other than 6 is reachable");
  check(D3B_QUALIFICATION_FIXTURES[0]?.fixture_id === selectNoiseFixtureIdV0(), "the fixture ordering changed");
  if (problems.length > 0) throw new Error(`D3_REV4_NONCONFORMANT: ${problems.join(" ; ")}`);

  const tests = {
    gate_cases: outcomes,
    any_path_yields_r_14: anyCaseYieldedFourteen,
    only_six_identical_authorises_the_target: onlySixPasses,
    five_plus_one_is_inconclusive: fivePlusOneIsInconclusive,
    tie_is_inconclusive: tieIsInconclusive,
    invalid_is_invalid_inconclusive: anyInvalidIsInconclusive,
    r_values_reachable: [6],
    target_unanimity_unchanged: true,
    superseded_branch_retired_prospectively: true,
    budget_absolute_maximum: D3_REV4_BUDGET.absolute_maximum,
    prior_qualification_calls_on_the_same_request: D3B_NOISE_REQUEST_PRIOR_EXPOSURE.prior_call_count,
    target_calls: 0,
    verification_cost: 0
  };

  const body = {
    version: D3_VERSION_REV4,
    incompatibility: D3B_NOISE_UNANIMITY_INCOMPATIBILITY,
    target_preserved: D3_REV4_TARGET_PRESERVED,
    stability_gate: D3B_NOISE_STABILITY_GATE,
    superseded_branch: D3B_SUPERSEDED_EXTENSION_BRANCH,
    budget: D3_REV4_BUDGET,
    noise_request: D3_REV4_NOISE_REQUEST,
    prior_exposure: D3B_NOISE_REQUEST_PRIOR_EXPOSURE,
    target_not_executed: true as const,
    target_calls: 0 as const,
    revision_3_manifest_hash_preserved: D3_REVISION_3_MANIFEST_HASH,
    tests
  };
  return Object.freeze({ ...body, manifest_hash: await hashEnvelope(D3_HASH_PROJECTION_V0, body) });
}
