/* eslint-disable no-restricted-imports -- Isolated research preregistration over frozen built production roots (repository convention); zero production code changes and no production import of this module. */
/**
 * D4-C0a REVISION 1 — DIRECTIONAL MAJORITY. FROZEN. NOT RUN. ZERO MODEL CALLS.
 *
 * THE MISMATCH THIS FIXES
 *   Revision 0's written rationale said r = 6 was chosen because "the criterion tolerates up to TWO
 *   deviating trials without losing modal uniqueness". Its executable scorer required only that the
 *   predicted token be the UNIQUE MODAL. Those are different acceptance regions:
 *
 *     6-0-0 -> predicted unique modal, 0 non-predicted  -> eligible (both readings agree)
 *     5-1-0 -> 1 non-predicted                          -> eligible (both agree)
 *     4-2-0 -> 2 non-predicted                          -> eligible (both agree)
 *     3-2-1 -> 3 non-predicted, predicted STILL unique  -> eligible under the scorer, NOT under the rationale
 *
 *   So the executable rule admitted a pattern with THREE non-predicted outputs, which the written
 *   rationale said it did not. Both are defensible designs; having one in prose and the other in code is
 *   not. This revision makes the code say what the rationale said.
 *
 *   Found at: qualification outputs seen = false, target outputs seen = false. No output of any kind
 *   existed when this was corrected, so nothing is being tuned to a result.
 *
 * WHAT THIS FILE CHANGES: the acceptance region of the per-arm criterion, and the wording of the claims
 * that depended on it. It changes nothing else — the A/B literals, the explicit alignment relation, the
 * SUPPORT/OPPOSE arms, the state-blind construct, the qualification fixtures, the executor and all
 * D1/D2/D3 evidence are untouched, and CharacterOS is not touched at all.
 */

import { hashEnvelope } from "../../../packages/subject-core/dist/index.js";
import type { HashV1 } from "../../../packages/subject-core/dist/index.js";

import {
  D4C0A_SCORER,
  D4C0A_TOKENS,
  D4_HASH_PROJECTION_V0,
  type D4C0AArmV0,
  type D4C0ATrialRecordV0
} from "./contract.ts";

export const D4_VERSION_REV1 = "belief-cross-expression-composition-d4-rev1" as const;

export const D4_REVISION_0_MANIFEST_HASH =
  "sha256:5bac6aa45dc5c3c9f4e3daf57aa98aac5d39ed04bb54897893a477551fe3ea01" as const;

// =============================================================================================
// 1. THE MISMATCH, AS A FROZEN FINDING
// =============================================================================================

export const D4_C0A_SCORER_RATIONALE_MISMATCH = Object.freeze({
  verdict: "D4_C0A_SCORER_RATIONALE_MISMATCH",
  characterisation: "textual_noise_tolerance_rationale_vs_executable_unique_modal_scorer",
  written_rationale: "at most two non-predicted outputs per arm",
  executable_region_before_this_revision: "the predicted token is the unique modal, with no bound on how many non-predicted outputs it takes to get there",
  demonstrated_disagreement:
    "the SUPPORT-arm pattern 3-2-1 (three non-predicted outputs) was eligible because the predicted token was still the unique modal",
  why_it_matters:
    "an acceptance region wider than its written justification is a preregistration defect: the design document and the code would license different results, and the difference is exactly the kind of thing that gets settled after seeing data",
  qualification_outputs_seen_before_amendment: false,
  target_outputs_seen_before_amendment: false,
  any_output_of_any_kind_existed: false,
  is_outcome_based_tuning: false,
  resolution: "the executable scorer is narrowed to the written requirement, not the other way round"
});

// =============================================================================================
// 2. THE AMENDED PER-ARM REQUIREMENT
// =============================================================================================

/** The written rationale, made executable: at most two non-predicted outputs per arm. */
export const D4C0A_MAX_NON_PREDICTED_PER_ARM = 2 as const;

export const D4C0A_REV1_PER_ARM_REQUIREMENT = Object.freeze({
  name: "PRE_REGISTERED_DIRECTIONAL_MAJORITY",
  for_each_target_arm: [
    "planned records complete",
    "invalid_count = 0",
    "the predicted token is the unique modal",
    "the predicted token's count is at least r_per_arm - 2"
  ],
  max_non_predicted_per_arm: D4C0A_MAX_NON_PREDICTED_PER_ARM,
  at_r_6: { support_arm: "SUPPORTS_B >= 4 of 6 AND unique modal", oppose_arm: "OPPOSES_B >= 4 of 6 AND unique modal" },
  thresholds_added: [],
  confidence_interval_added: false,
  effect_size_threshold_added: false,
  margin_threshold_added: false,
  significance_test_added: false,
  why_no_statistical_threshold_is_added:
    "this amendment only makes the executable rule agree with a tolerance that was already written down; it does not introduce a new inferential standard"
});

export const D4C0A_REV1_POSITIVE = Object.freeze({
  requires_all_of: [
    "ARM_SUPPORT: predicted count >= 4 AND unique modal == SUPPORTS_B",
    "ARM_OPPOSE: predicted count >= 4 AND unique modal == OPPOSES_B",
    "the two arm modals differ"
  ],
  verdict: "EXECUTOR_STATE_BLIND_CROSS_EXPRESSION_STANCE_COMPOSITION_ESTABLISHED"
});

export const D4C0A_REV1_NULL = Object.freeze({
  condition: "collection integrity PASS AND invalid_count = 0 AND the positive predicate is false",
  verdict: "EXECUTOR_STATE_BLIND_CROSS_EXPRESSION_STANCE_COMPOSITION_NOT_ESTABLISHED",
  explicitly_includes: [
    "a 3-2-1 arm in which the predicted token is the unique modal but the directional majority is not met",
    "a constant answer across both arms",
    "the reversed direction",
    "a tie in either arm",
    "only one arm meeting the requirement",
    "the predicted token losing the modal",
    "UNCERTAIN_B dominating"
  ],
  a_3_2_1_arm_may_not_be_reinterpreted_as_a_weak_positive: true
});

export const D4C0A_REV1_INCONCLUSIVE = Object.freeze({
  conditions: ["any invalid output preventing legal scoring", "a collection integrity failure"],
  verdicts: [D4C0A_SCORER.invalid_verdict, D4C0A_SCORER.integrity_verdict],
  null_is_not_inconclusive: true
});

// =============================================================================================
// 3. THE AMENDED SCORER
// =============================================================================================

export interface D4C0ARev1OutcomeV0 {
  readonly outcome_class: "POSITIVE" | "NULL" | "INCONCLUSIVE";
  readonly collection_integrity: boolean;
  readonly collection_integrity_failures: readonly string[];
  readonly invalid_count: number;
  readonly scientific_scoring_executed: boolean;
  readonly arm_counts: Readonly<Record<string, Record<string, number>>> | null;
  readonly arm_unique_modals: Readonly<Record<string, string | null>> | null;
  readonly arm_modal_ties: Readonly<Record<string, boolean>> | null;
  readonly arm_predicted_counts: Readonly<Record<string, number>> | null;
  readonly arm_meets_directional_majority: Readonly<Record<string, boolean>> | null;
  readonly contrast_holds: boolean | null;
  readonly verdict: string;
  readonly forbidden_interpretations: readonly string[];
}

function uniqueModal(counts: Record<string, number>): { modal: string | null; count: number; tie: boolean } {
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const top = ranked[0];
  if (top === undefined || top[1] === 0) return { modal: null, count: 0, tie: false };
  const tie = ranked[1] !== undefined && ranked[1][1] === top[1];
  return { modal: tie ? null : top[0], count: top[1], tie };
}

const PREDICTED: Readonly<Record<D4C0AArmV0, string>> = Object.freeze({
  ARM_SUPPORT: "SUPPORTS_B",
  ARM_OPPOSE: "OPPOSES_B"
});

/**
 * THE amended decision procedure. An audit calls THIS function on synthetic datasets rather than
 * re-implementing it, so the audit cannot pass while the shipped scorer disagrees.
 */
export function scoreD4C0ARev1V0(input: {
  readonly trials: readonly D4C0ATrialRecordV0[];
  readonly r_per_arm: number;
}): D4C0ARev1OutcomeV0 {
  const failures: string[] = [];
  const ids = input.trials.map((t) => t.trial_id);
  if (ids.length - new Set(ids).size > 0) failures.push("duplicate trial identity");
  for (const arm of ["ARM_SUPPORT", "ARM_OPPOSE"] as const) {
    const rows = input.trials.filter((t) => t.arm === arm);
    if (rows.length !== input.r_per_arm) failures.push(`${arm} records ${rows.length} != planned ${input.r_per_arm}`);
  }
  const unknownArms = input.trials.filter((t) => t.arm !== "ARM_SUPPORT" && t.arm !== "ARM_OPPOSE").length;
  if (unknownArms > 0) failures.push(`${unknownArms} records with an unknown arm`);
  const invalid = input.trials.filter(
    (t) => t.parsed_token === null || !(D4C0A_TOKENS as readonly string[]).includes(t.parsed_token)
  ).length;
  const forbidden = Object.freeze([
    "the relation between A and B",
    "the truth of B",
    "the model's own opinion",
    "the model's confidence in the relation"
  ]);
  const inconclusive = (
    outcomeFailures: readonly string[],
    integrity: boolean,
    verdict: string
  ): D4C0ARev1OutcomeV0 =>
    Object.freeze({
      outcome_class: "INCONCLUSIVE" as const,
      collection_integrity: integrity,
      collection_integrity_failures: Object.freeze([...outcomeFailures]),
      invalid_count: invalid,
      scientific_scoring_executed: false,
      arm_counts: null,
      arm_unique_modals: null,
      arm_modal_ties: null,
      arm_predicted_counts: null,
      arm_meets_directional_majority: null,
      contrast_holds: null,
      verdict,
      forbidden_interpretations: forbidden
    });

  if (failures.length > 0) return inconclusive(failures, false, D4C0A_SCORER.integrity_verdict);
  if (invalid > 0) return inconclusive([], true, D4C0A_SCORER.invalid_verdict);

  const countsFor = (arm: D4C0AArmV0): Record<string, number> => {
    const counts: Record<string, number> = {};
    for (const token of D4C0A_TOKENS) counts[token] = 0;
    for (const row of input.trials.filter((t) => t.arm === arm)) {
      const key = row.parsed_token as string;
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  };
  const supportCounts = countsFor("ARM_SUPPORT");
  const opposeCounts = countsFor("ARM_OPPOSE");
  const support = uniqueModal(supportCounts);
  const oppose = uniqueModal(opposeCounts);
  const required = input.r_per_arm - D4C0A_MAX_NON_PREDICTED_PER_ARM;
  const supportPredicted = supportCounts[PREDICTED.ARM_SUPPORT] ?? 0;
  const opposePredicted = opposeCounts[PREDICTED.ARM_OPPOSE] ?? 0;
  const meets: Record<string, boolean> = {
    ARM_SUPPORT: support.modal === PREDICTED.ARM_SUPPORT && supportPredicted >= required,
    ARM_OPPOSE: oppose.modal === PREDICTED.ARM_OPPOSE && opposePredicted >= required
  };
  const contrast = support.modal !== null && oppose.modal !== null && support.modal !== oppose.modal;
  const positive = meets["ARM_SUPPORT"] === true && meets["ARM_OPPOSE"] === true && contrast;

  return Object.freeze({
    outcome_class: positive ? ("POSITIVE" as const) : ("NULL" as const),
    collection_integrity: true,
    collection_integrity_failures: Object.freeze([]),
    invalid_count: 0,
    scientific_scoring_executed: true,
    arm_counts: Object.freeze({ ARM_SUPPORT: Object.freeze(supportCounts), ARM_OPPOSE: Object.freeze(opposeCounts) }),
    arm_unique_modals: Object.freeze({ ARM_SUPPORT: support.modal, ARM_OPPOSE: oppose.modal }),
    arm_modal_ties: Object.freeze({ ARM_SUPPORT: support.tie, ARM_OPPOSE: oppose.tie }),
    arm_predicted_counts: Object.freeze({ ARM_SUPPORT: supportPredicted, ARM_OPPOSE: opposePredicted }),
    arm_meets_directional_majority: Object.freeze(meets),
    contrast_holds: contrast,
    verdict: positive ? D4C0A_REV1_POSITIVE.verdict : D4C0A_REV1_NULL.verdict,
    forbidden_interpretations: forbidden
  });
}

// =============================================================================================
// 4. THE r = 6 RE-AUDIT
// =============================================================================================

export const D4C0A_REV1_R6_TABLE = Object.freeze({
  eligibility_rule: "predicted token is the unique modal AND its count is at least r - 2",
  rows: [
    { pattern: "6-0-0", non_predicted: 0, eligible: true },
    { pattern: "5-1-0", non_predicted: 1, eligible: true },
    { pattern: "4-2-0", non_predicted: 2, eligible: true },
    { pattern: "3-3-0", non_predicted: 3, eligible: false, why: "no unique modal" },
    { pattern: "3-2-1", non_predicted: 3, eligible: false, why: "the predicted token is the unique modal but the directional majority is not met" }
  ],
  statement: "at most two non-predicted outputs per arm",
  acceptance_region_now_matches_the_written_rationale: true,
  target_calls: { arms: 2, per_arm: 6, total: 12 },
  total_budget: 27,
  budget_breakdown: { qualification: 9, stability_gate: 6, target: 12 },
  budget_unchanged_by_this_revision: true
});

// =============================================================================================
// 5. THE NOISE GATE AND THE TARGET SCORER DO DIFFERENT JOBS
// =============================================================================================

export const D4C0A_REV1_NOISE_DIVISION_OF_LABOUR = Object.freeze({
  noise_gate_task: "checks that the measurement path is self-consistent on one byte-identical non-target request",
  target_scorer_task: "checks treatment-sensitive directional composition across the two stance arms",
  the_gate_certifies_the_path_not_the_criterion: true,
  why_the_target_allows_two_deviations_when_the_gate_demands_six_agreeing_calls:
    "the gate can only certify determinism on ONE fixed input; the target's tolerance is about variation across the two TREATMENT arms, which the gate cannot observe at all. They answer different questions, so their thresholds are not in tension.",
  may_not_derive_the_target_answer_from_the_gate_modal_identity: true,
  may_not_change_r_dynamically: true,
  reachable_r_values: [6],
  sample_size_branches: [],
  unchanged_from_revision_0: true
});

// =============================================================================================
// 6. THE SCOPED POSITIVE CLAIM
// =============================================================================================

export const D4C0A_REV1_CLAIM_SCOPE = Object.freeze({
  covered_by_the_target_arms: ["SUPPORT", "OPPOSE"],
  canonical_interpretation: "PREREGISTERED POLAR STANCE COMPOSITION",
  permitted_verdict_string: "EXECUTOR_STATE_BLIND_CROSS_EXPRESSION_STANCE_COMPOSITION_ESTABLISHED",
  authoritative_expansion:
    "Under the frozen state-blind explicit-relation task, the executor transferred preregistered SUPPORT and OPPOSE stances from proposition A to semantically aligned proposition B with the required directional-majority criterion.",
  may_not_claim: [
    "arbitrary stance transfer",
    "UNCERTAIN transfer established",
    "spontaneous composition",
    "implicit semantic composition",
    "CharacterOS causal capability"
  ],
  why_uncertain_is_excluded:
    "no target arm supplies an UNCERTAIN stance, so the design has no evidence about transferring it; UNCERTAIN_B appears only as an output token and in the qualification negative control"
});

// =============================================================================================
// 7. THE STRENGTHENED ARCHITECTURE GATE
// =============================================================================================

export const D4_REV1_ARCHITECTURE_GATE = Object.freeze({
  c0a_positive_alone_authorises_nothing: true,
  characteros_belief_architecture_may_not_be_modified: true,
  a_future_comparator_must_hold_all_of_these_equal: [
    "the same executor",
    "the same A literal",
    "the same B literal",
    "the same stance value",
    "the same supplied semantic relation information",
    "the same measurement question",
    "the same anchors",
    "the same output vocabulary",
    "the same surrounding research framing",
    "the same generation settings"
  ],
  must_mechanically_enumerate_all_model_facing_byte_differences: true,
  the_only_permitted_scientific_difference:
    "the source / representation of the stance information — for example an explicit state-blind stance representation versus the CharacterOS production belief representation",
  if_relation_explicitness_instruction_framing_or_measurement_semantics_also_change:
    "the result may not be attributed to the CharacterOS representation",
  purpose: "to keep H1/H4 (representation binding), H5 (executor composition) and H6 (measurement framing) separately identifiable",
  until_then: "semantic IDs, embeddings, proposition graphs, relation propagation, extra model passes, prompt rescues and projection rewrites remain candidates only"
});

// =============================================================================================
// 8. MECHANICAL SELF-CHECKS + MANIFEST
// =============================================================================================

export interface D4Rev1ManifestV0 {
  readonly version: typeof D4_VERSION_REV1;
  readonly mismatch: typeof D4_C0A_SCORER_RATIONALE_MISMATCH;
  readonly per_arm_requirement: typeof D4C0A_REV1_PER_ARM_REQUIREMENT;
  readonly positive: typeof D4C0A_REV1_POSITIVE;
  readonly null_rule: typeof D4C0A_REV1_NULL;
  readonly inconclusive: typeof D4C0A_REV1_INCONCLUSIVE;
  readonly r6_table: typeof D4C0A_REV1_R6_TABLE;
  readonly noise_division: typeof D4C0A_REV1_NOISE_DIVISION_OF_LABOUR;
  readonly claim_scope: typeof D4C0A_REV1_CLAIM_SCOPE;
  readonly architecture_gate: typeof D4_REV1_ARCHITECTURE_GATE;
  readonly supersedes_scope: readonly string[];
  readonly maximum_non_predicted_per_arm: 2;
  readonly revision_0_manifest_hash_preserved: string;
  readonly preserved_elements_changed: false;
  readonly c0b_still_not_preregistered: true;
  readonly link_4_reopened: false;
  readonly tests: Readonly<Record<string, unknown>>;
  readonly manifest_hash: HashV1;
}

export async function deriveD4Rev1ManifestV0(): Promise<D4Rev1ManifestV0> {
  const problems: string[] = [];
  const check = (condition: boolean, message: string): void => {
    if (!condition) problems.push(message);
  };
  const six = (token: string) => Array.from({ length: 6 }, () => token);
  const mk = (support: readonly (string | null)[], oppose: readonly (string | null)[]) => [
    ...support.map((token, i) => ({ trial_id: `S${String(i)}`, arm: "ARM_SUPPORT" as D4C0AArmV0, parsed_token: token })),
    ...oppose.map((token, i) => ({ trial_id: `O${String(i)}`, arm: "ARM_OPPOSE" as D4C0AArmV0, parsed_token: token }))
  ];
  const run = (support: readonly (string | null)[], oppose: readonly (string | null)[]) =>
    scoreD4C0ARev1V0({ trials: mk(support, oppose), r_per_arm: 6 });

  const perfect = run(six("SUPPORTS_B"), six("OPPOSES_B"));
  const five = run(["SUPPORTS_B", "SUPPORTS_B", "SUPPORTS_B", "SUPPORTS_B", "SUPPORTS_B", "UNCERTAIN_B"], ["OPPOSES_B", "OPPOSES_B", "OPPOSES_B", "OPPOSES_B", "OPPOSES_B", "UNCERTAIN_B"]);
  const four = run(["SUPPORTS_B", "SUPPORTS_B", "SUPPORTS_B", "SUPPORTS_B", "UNCERTAIN_B", "OPPOSES_B"], ["OPPOSES_B", "OPPOSES_B", "OPPOSES_B", "OPPOSES_B", "UNCERTAIN_B", "SUPPORTS_B"]);
  const threeTwoOne = run(["SUPPORTS_B", "SUPPORTS_B", "SUPPORTS_B", "UNCERTAIN_B", "UNCERTAIN_B", "OPPOSES_B"], six("OPPOSES_B"));
  const tie = run(["SUPPORTS_B", "SUPPORTS_B", "SUPPORTS_B", "UNCERTAIN_B", "UNCERTAIN_B", "UNCERTAIN_B"], six("OPPOSES_B"));
  const constantSupport = run(six("SUPPORTS_B"), six("SUPPORTS_B"));
  const constantOppose = run(six("OPPOSES_B"), six("OPPOSES_B"));
  const reversed = run(six("OPPOSES_B"), six("SUPPORTS_B"));
  const oneInvalid = run([...six("SUPPORTS_B").slice(0, 5), null], six("OPPOSES_B"));
  const integrity = scoreD4C0ARev1V0({ trials: mk(six("SUPPORTS_B"), six("OPPOSES_B").slice(0, 5)), r_per_arm: 6 });
  const uncertainDominates = run(six("UNCERTAIN_B"), six("OPPOSES_B"));

  check(perfect.outcome_class === "POSITIVE", "6-0-0 is not positive");
  check(five.outcome_class === "POSITIVE", "5-1-0 is not positive");
  check(four.outcome_class === "POSITIVE", "4-2-0 is not positive");
  check(threeTwoOne.outcome_class === "NULL", "3-2-1 is not a null under the amended scorer");
  check(threeTwoOne.arm_unique_modals?.["ARM_SUPPORT"] === "SUPPORTS_B", "the 3-2-1 arm does not have the predicted token as its unique modal (so the test is not exercising what it claims)");
  check(threeTwoOne.arm_meets_directional_majority?.["ARM_SUPPORT"] === false, "3-2-1 spuriously meets the directional majority");
  check(tie.outcome_class === "NULL", "a tie is not a null");
  check(constantSupport.outcome_class === "NULL" && constantOppose.outcome_class === "NULL", "a constant answer is not a null");
  check(reversed.outcome_class === "NULL", "the reversed direction is not a null");
  check(oneInvalid.outcome_class === "INCONCLUSIVE" && oneInvalid.scientific_scoring_executed === false, "an invalid run performed scientific scoring");
  check(integrity.outcome_class === "INCONCLUSIVE" && integrity.collection_integrity === false, "an integrity failure is not inconclusive");
  check(uncertainDominates.outcome_class === "NULL", "an UNCERTAIN-dominant arm is not a null");
  check(D4C0A_REV1_R6_TABLE.total_budget === 27, "the budget changed");
  check(D4C0A_MAX_NON_PREDICTED_PER_ARM === 2, "the tolerance changed");
  check(D4C0A_REV1_NOISE_DIVISION_OF_LABOUR.reachable_r_values.length === 1, "the gate can reach more than one r");
  check(D4_C0A_SCORER_RATIONALE_MISMATCH.qualification_outputs_seen_before_amendment === false, "outputs existed before the amendment");
  check(D4_REV1_ARCHITECTURE_GATE.characteros_belief_architecture_may_not_be_modified, "the architecture gate is open");
  check(D4_REV1_ARCHITECTURE_GATE.a_future_comparator_must_hold_all_of_these_equal.length === 10, "the comparator equality list is incomplete");
  if (problems.length > 0) throw new Error(`D4_C0A_REV1_NONCONFORMANT: ${problems.join(" ; ")}`);

  const tests = {
    amended_6_0_0: perfect.outcome_class,
    amended_5_1_0: five.outcome_class,
    amended_4_2_0: four.outcome_class,
    amended_3_2_1: threeTwoOne.outcome_class,
    amended_3_3_tie: tie.outcome_class,
    amended_constant_support: constantSupport.outcome_class,
    amended_constant_oppose: constantOppose.outcome_class,
    amended_reversed: reversed.outcome_class,
    amended_uncertain_dominates: uncertainDominates.outcome_class,
    amended_one_invalid: oneInvalid.outcome_class,
    amended_integrity_failure: integrity.outcome_class,
    three_two_one_arm_modal_is_still_the_predicted_token: true,
    three_two_one_fails_on_the_directional_majority: true,
    acceptance_region_matches_the_written_rationale: true,
    budget: D4C0A_REV1_R6_TABLE.total_budget,
    verification_cost: 0
  };

  const body = {
    version: D4_VERSION_REV1,
    mismatch: D4_C0A_SCORER_RATIONALE_MISMATCH,
    per_arm_requirement: D4C0A_REV1_PER_ARM_REQUIREMENT,
    positive: D4C0A_REV1_POSITIVE,
    null_rule: D4C0A_REV1_NULL,
    inconclusive: D4C0A_REV1_INCONCLUSIVE,
    r6_table: D4C0A_REV1_R6_TABLE,
    noise_division: D4C0A_REV1_NOISE_DIVISION_OF_LABOUR,
    claim_scope: D4C0A_REV1_CLAIM_SCOPE,
    architecture_gate: D4_REV1_ARCHITECTURE_GATE,
    supersedes_scope: [
      "the acceptance region of the per-arm criterion (narrowed to the written tolerance)",
      "the wording of the positive claim (scoped to polar stances)",
      "the architecture-gate conditions (equality list and required enumeration)"
    ] as const,
    maximum_non_predicted_per_arm: D4C0A_MAX_NON_PREDICTED_PER_ARM,
    revision_0_manifest_hash_preserved: D4_REVISION_0_MANIFEST_HASH,
    preserved_elements_changed: false as const,
    c0b_still_not_preregistered: true as const,
    link_4_reopened: false as const,
    tests
  };
  return Object.freeze({ ...body, manifest_hash: await hashEnvelope(D4_HASH_PROJECTION_V0, body) });
}
