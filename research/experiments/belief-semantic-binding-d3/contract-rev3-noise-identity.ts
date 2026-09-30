/* eslint-disable no-restricted-imports -- Isolated research preregistration over frozen built production roots (repository convention); zero production code changes and no production import of this module. */
/**
 * D3 REVISION 3 — NOISE PILOT REQUEST IDENTITY. FROZEN. NOT RUN. ZERO MODEL CALLS.
 *
 * THE CONFLICT THIS FILE FIXES
 *   Revision 1/2 defined the D3-B noise pilot as "6 byte-identical calls of the frozen real
 *   diagnostic" — i.e. of the TARGET request, canonical CAUTION versus the frozen A1 paraphrase. That
 *   design is internally inconsistent in two independent ways:
 *
 *     (a) IDENTITY. The first "pilot" call would itself be target evidence, so
 *         "the target request has been called" and "D3_B_TARGET_NOT_EXECUTED" cannot both hold. The
 *         pilot would silently consume target trials and the target's own trial count would be wrong.
 *
 *     (b) THE UNANIMITY INTERACTION, which is the more damaging half. The frozen target scorer
 *         requires EVERY one of r_confirm_B trials to return the expected relation. If the six pilot
 *         calls on the target request come back five expected plus one dissent, then the unanimity
 *         positive is ALREADY IMPOSSIBLE before the target stage begins — and the mapping's
 *         `5 → r = 14` branch, which exists to buy more trials when the endpoint is noisy, cannot
 *         restore eligibility. It would buy fourteen more calls for a run that can no longer succeed.
 *         Under the old design the extension branch was not a remedy; it was a formality.
 *
 *   Discovered at `d3_b_target_calls_before_amendment = 0`.
 *   Verdict: `D3_B_TARGET_AND_NOISE_REQUEST_IDENTITY_CONFLICT`.
 *
 * WHAT THIS FILE CHANGES: the noise pilot's REQUEST IDENTITY, and nothing else. The target pair, the
 * expected target relation, the vocabulary, the anchors, the transformer, the qualification result, the
 * target scorer, the unanimity requirement, the modal-count mapping and all D1/D2 evidence are
 * untouched.
 */

import { hashEnvelope } from "../../../packages/subject-core/dist/index.js";
import type { HashV1 } from "../../../packages/subject-core/dist/index.js";

import {
  D3A_SUBSUMPTION_AUDIT,
  D3_BUDGET,
  D3_HASH_PROJECTION_V0,
  D3B_INPUTS_FROZEN,
  D3B_NOISE_RULE,
  D3B_QUALIFICATION_FIXTURES
} from "./contract.ts";
import { D3B_MODAL_COUNT_DEFINITION } from "./contract-rev2-d3b-only.ts";
import { D3B_TARGET_PAIR } from "./transformer-d3b.ts";

export const D3_VERSION_REV3 = "belief-semantic-binding-localization-d3-rev3" as const;

export const D3_REVISION_2_MANIFEST_HASH =
  "sha256:f860575614ce180c1ad51244b6013b1dbf677db5cd6589a06f6fb0922e06cd55" as const;

// =============================================================================================
// 1. THE CONFLICT
// =============================================================================================

export const D3B_NOISE_IDENTITY_CONFLICT = Object.freeze({
  verdict: "D3_B_TARGET_AND_NOISE_REQUEST_IDENTITY_CONFLICT",
  discovered_at_target_calls: 0 as const,
  discovered_at_qualification_calls: 9 as const,

  the_two_mutually_exclusive_facts: [
    "the target request has been called",
    "D3_B_TARGET_NOT_EXECUTED"
  ],

  half_a_identity:
    "a pilot on the target request is target evidence: the first call would already execute the target, so the target's trial count and the claim that it has not been run would both be false",

  half_b_unanimity_interaction:
    "the frozen target scorer requires unanimity over r_confirm_B trials. Six pilot calls on the target request returning five expected plus one dissent would make the unanimity positive impossible before the target stage starts, and the mapping's 5 -> r = 14 branch cannot restore eligibility — it would fund fourteen further calls for a run that can no longer succeed",

  consequence_of_half_b:
    "under the old design the extension branch was a formality rather than a remedy; the pilot's noise estimate could only ever disqualify the target, never repair it",

  resolution: "the noise pilot uses a NON-TARGET frozen request, chosen by a frozen outcome-blind rule",
  any_target_call_was_made_to_find_this: false,
  any_pilot_call_was_made_to_find_this: false
});

// =============================================================================================
// 2. PRESERVED ELEMENTS
// =============================================================================================

export const D3_REV3_PRESERVED = Object.freeze({
  target_pair: D3B_TARGET_PAIR,
  target_pair_changed: false,
  expected_target_relation: D3B_INPUTS_FROZEN.expected_relation,
  expected_relation_changed: false,
  vocabulary_changed: false,
  anchors_changed: false,
  transformer_changed: false,
  qualification_result_changed: false,
  target_scorer_changed: false,
  unanimity_requirement_changed: false,
  modal_count_mapping_changed: false,
  d1_evidence_changed: false,
  d2_evidence_changed: false,
  d3_a_still_deleted: true,
  only_thing_changed: "the noise pilot's request identity"
});

// =============================================================================================
// 3. THE FROZEN NOISE FIXTURE SELECTION — OUTCOME-BLIND
// =============================================================================================

/**
 * The selection rule is a pure function of the frozen fixture manifest. No fourth fixture is written.
 * Two admissible formulations were considered and they agree, which is recorded so neither can be
 * argued about later:
 *   - `qualification_fixture_manifest[0]`, the immutable frozen ordering;
 *   - the lexicographically smallest `fixture_id`.
 */
export function selectNoiseFixtureIdV0(): string {
  return D3B_QUALIFICATION_FIXTURES[0]?.fixture_id as string;
}

export function lexicographicallySmallestFixtureIdV0(): string {
  return [...D3B_QUALIFICATION_FIXTURES.map((f) => f.fixture_id)].sort()[0] as string;
}

export const D3B_NOISE_FIXTURE_SELECTION = Object.freeze({
  rule: "noise_fixture_id = qualification_fixture_manifest[0], equivalently the lexicographically smallest frozen fixture_id",
  no_fourth_fixture_was_written: true,
  selection_is_a_pure_function_of_the_frozen_manifest: true,
  reads_qualification_outputs: false,
  reads_modal_tokens: false,
  reads_correctness: false,
  reads_latency: false,
  reads_provider_metadata: false,
  reads_target_output: false,
  reads_scientific_outcome: false,
  selection_was_made_before_any_target_call: true,
  selection_was_made_before_any_pilot_call: true
});

// =============================================================================================
// 4. THE NOISE REQUEST IDENTITY
// =============================================================================================

export const D3B_NOISE_REQUEST_IDENTITY = Object.freeze({
  fixture_id: selectNoiseFixtureIdV0(),
  fixture_id_under_the_lexicographic_rule: lexicographicallySmallestFixtureIdV0(),
  the_two_rules_agree: selectNoiseFixtureIdV0() === lexicographicallySmallestFixtureIdV0(),
  request_bytes_source:
    "the exact model-facing request frozen during D3-B qualification for this fixture, reused verbatim",
  re_render_at_pilot_time: false,
  may_not_modify_the_statement_pair: true,
  must_not_contain_the_canonical_caution: true,
  must_not_contain_the_target_paraphrase: true,
  must_not_be_the_target_request: true,
  must_not_contain_any_characteros_state: true,
  hash_must_equal_the_qualification_request_hash_for_this_fixture: true,
  hash_source: "the D3-B qualification evidence's fixture request artifact"
});

// =============================================================================================
// 5. WHAT THE PILOT MEASURES
// =============================================================================================

export const D3B_NOISE_PILOT_MEANING = Object.freeze({
  measures: "instrument-level identical-request self-noise on one preregistered synthetic NON-TARGET relation request",
  does_not_measure: [
    "the canonical/paraphrase relation",
    "target-specific difficulty",
    "CharacterOS state or behaviour",
    "cross-wording stance transfer"
  ],
  sole_use: "to choose the target replicate count through the frozen modal-count mapping",
  residual_limitation:
    "the calibration is therefore instrument-level rather than target-specific: a target whose difficulty differs from the synthetic fixture could carry different noise. That limitation is accepted here because the alternative — calibrating on the target — would consume the target's own trials and could pre-empt its unanimity requirement. It is recorded rather than hidden.",
  calibration_still_meaningful_because:
    "the pilot and the target share the same executor, the same measurement contract, the same closed set of three relation tokens and the same request shape; what differs is which two statements are compared"
});

// =============================================================================================
// 6. THE NOISE RULE IS UNCHANGED
// =============================================================================================

export const D3B_NOISE_RULE_UNCHANGED = Object.freeze({
  planned_calls: D3B_NOISE_RULE.planned_calls,
  one_request_six_times: true,
  mapping: D3B_NOISE_RULE.mapping,
  mapping_changed: false,
  invalid_policy_unchanged: true,
  valid_required_for_noise_scoring: D3B_NOISE_RULE.valid_required_for_noise_scoring,
  unique_modal: D3B_MODAL_COUNT_DEFINITION.modal_token,
  modal_count: D3B_MODAL_COUNT_DEFINITION.counted_quantity,
  tie_verdict: D3B_MODAL_COUNT_DEFINITION.tie_at_the_top.verdict,
  invalid_verdict: D3B_NOISE_RULE.on_any_invalid.verdict,
  stop_verdict: D3B_NOISE_RULE.stop_verdict
});

// =============================================================================================
// 7. TARGET ISOLATION
// =============================================================================================

export const D3B_TARGET_ISOLATION = Object.freeze({
  target_calls_before_noise_pilot: 0,
  target_calls_after_noise_pilot_must_remain: 0,
  target_calls_after_noise_pilot_are_target_evidence: false,
  target_dataset_must_not_include_noise_trials: true,
  noise_trials_may_not_appear_in: [
    "the target counts",
    "the target unanimity scorer",
    "the target dataset hash",
    "the target scientific verdict"
  ],
  two_evidence_sets_fully_separated: true,
  target_is_the_only_source_of_target_evidence: true,
  d3_b_target_not_executed_remains_true: true
});

// =============================================================================================
// 8. BUDGET — WITH THE TARGET'S EXACT PLANNED CALL COUNT
// =============================================================================================

export const D3_REV3_BUDGET = Object.freeze({
  qualification_calls_completed: 9,
  noise_pilot_calls: 6,
  target_formula: "r_confirm_B",
  target_is_not_2r: true,
  why_not_2r: "D3-B has no HIGH/LOW arms: it is a single state-blind relation question, so the target run is r_confirm_B byte-identical calls and not 2 * r",
  target_planned_calls_after_noise: "r_confirm_B, i.e. exactly 6 or exactly 14",
  target_planned_calls_depends_on_the_noise_pilot: true,
  revision_1_already_used_r: true,
  revision_1_note: "the revision-1 budget already recorded d3b_formula = r_confirm_B and an authorised maximum of 29 = 9 + 6 + 14, so the budget is unchanged by this revision",
  minimum_path_total: 21,
  maximum_path_total: 29,
  d3a_calls: 0,
  d2b_calls: 0,
  authorised_total_max: D3_BUDGET.authorised_total_max,
  budget_changed_by_this_revision: false
});

// =============================================================================================
// 9. MECHANICAL SELF-CHECKS + MANIFEST
// =============================================================================================

export interface D3Rev3ManifestV0 {
  readonly version: typeof D3_VERSION_REV3;
  readonly conflict: typeof D3B_NOISE_IDENTITY_CONFLICT;
  readonly preserved: typeof D3_REV3_PRESERVED;
  readonly selection: typeof D3B_NOISE_FIXTURE_SELECTION;
  readonly noise_request_identity: typeof D3B_NOISE_REQUEST_IDENTITY;
  readonly pilot_meaning: typeof D3B_NOISE_PILOT_MEANING;
  readonly noise_rule: typeof D3B_NOISE_RULE_UNCHANGED;
  readonly target_isolation: typeof D3B_TARGET_ISOLATION;
  readonly budget: typeof D3_REV3_BUDGET;
  readonly subsumption_verdict_unchanged: string;
  readonly revision_2_manifest_hash_preserved: string;
  readonly tests: Readonly<Record<string, unknown>>;
  readonly manifest_hash: HashV1;
}

export async function deriveD3Rev3ManifestV0(): Promise<D3Rev3ManifestV0> {
  const problems: string[] = [];
  const check = (condition: boolean, message: string): void => {
    if (!condition) problems.push(message);
  };

  const selected = D3B_QUALIFICATION_FIXTURES.find((f) => f.fixture_id === selectNoiseFixtureIdV0());
  check(selected !== undefined, "the selection rule returned an id absent from the frozen manifest");
  check(selectNoiseFixtureIdV0() === lexicographicallySmallestFixtureIdV0(), "the two admissible selection rules disagree");
  check(D3B_QUALIFICATION_FIXTURES.length === 3, "the frozen fixture manifest no longer has three entries");
  if (selected !== undefined) {
    check(selected.statement_a !== D3B_TARGET_PAIR.statement_a, "the noise fixture's statement A is the canonical proposition");
    check(
      selected.statement_b !== D3B_TARGET_PAIR.statement_b && selected.statement_a !== D3B_TARGET_PAIR.statement_b,
      "the noise fixture's statements overlap the target pair"
    );
    check(!selected.statement_a.includes("secondhand") && !selected.statement_b.includes("secondhand"), "the noise fixture mentions the paraphrase's subject matter");
  }
  check(D3B_NOISE_RULE.mapping["6"] === 6 && D3B_NOISE_RULE.mapping["5"] === 14, "the noise mapping changed");
  check(D3B_MODAL_COUNT_DEFINITION.tie_at_the_top.verdict === "D3_B_INCONCLUSIVE_BY_MODAL_TIE_UNDEFINED", "the tie verdict changed");
  check(D3B_TARGET_ISOLATION.target_calls_before_noise_pilot === 0, "target calls are not zero");
  check(D3B_TARGET_ISOLATION.target_calls_after_noise_pilot_are_target_evidence === false, "the pilot would count as target evidence");
  check(D3B_TARGET_ISOLATION.target_dataset_must_not_include_noise_trials, "noise trials may enter the target dataset");
  check(D3_REV3_BUDGET.target_is_not_2r && D3_REV3_BUDGET.target_formula === "r_confirm_B", "the target formula is not r");
  check(D3_REV3_BUDGET.minimum_path_total === 9 + 6 + 6 && D3_REV3_BUDGET.maximum_path_total === 9 + 6 + 14, "the budget totals are wrong");
  check(D3_REV3_BUDGET.budget_changed_by_this_revision === false, "the budget claims to have changed");
  check(D3_REV3_BUDGET.d3a_calls === 0 && D3_REV3_BUDGET.d2b_calls === 0, "an unauthorised stage is funded");
  check(!D3_REV3_PRESERVED.target_pair_changed && !D3_REV3_PRESERVED.unanimity_requirement_changed, "a preserved element changed");
  check(D3B_NOISE_IDENTITY_CONFLICT.any_target_call_was_made_to_find_this === false, "the conflict was found by spending a target call");
  check(!D3B_NOISE_FIXTURE_SELECTION.reads_qualification_outputs && !D3B_NOISE_FIXTURE_SELECTION.reads_scientific_outcome, "the selection rule is not outcome-blind");
  check(D3A_SUBSUMPTION_AUDIT.verdict === "D3_A_IS_SUBSUMED_BY_D2_A0", "the D3-A subsumption verdict changed");
  if (problems.length > 0) throw new Error(`D3_REV3_NONCONFORMANT: ${problems.join(" ; ")}`);

  const tests = {
    selection_rule: D3B_NOISE_FIXTURE_SELECTION.rule,
    selected_fixture_id: selectNoiseFixtureIdV0(),
    lexicographic_rule_agrees: selectNoiseFixtureIdV0() === lexicographicallySmallestFixtureIdV0(),
    selected_is_not_the_target_pair: true,
    selection_reads_no_outputs: true,
    noise_mapping_unchanged: true,
    tie_verdict_unchanged: true,
    target_calls_before_noise_pilot: D3B_TARGET_ISOLATION.target_calls_before_noise_pilot,
    target_planned_calls_formula: D3_REV3_BUDGET.target_formula,
    target_is_not_2r: D3_REV3_BUDGET.target_is_not_2r,
    budget_unchanged: true,
    d3a_calls: 0,
    d2b_calls: 0,
    verification_cost: 0
  };

  const body = {
    version: D3_VERSION_REV3,
    conflict: D3B_NOISE_IDENTITY_CONFLICT,
    preserved: D3_REV3_PRESERVED,
    selection: D3B_NOISE_FIXTURE_SELECTION,
    noise_request_identity: D3B_NOISE_REQUEST_IDENTITY,
    pilot_meaning: D3B_NOISE_PILOT_MEANING,
    noise_rule: D3B_NOISE_RULE_UNCHANGED,
    target_isolation: D3B_TARGET_ISOLATION,
    budget: D3_REV3_BUDGET,
    subsumption_verdict_unchanged: D3A_SUBSUMPTION_AUDIT.verdict,
    revision_2_manifest_hash_preserved: D3_REVISION_2_MANIFEST_HASH,
    tests
  };
  return Object.freeze({ ...body, manifest_hash: await hashEnvelope(D3_HASH_PROJECTION_V0, body) });
}
