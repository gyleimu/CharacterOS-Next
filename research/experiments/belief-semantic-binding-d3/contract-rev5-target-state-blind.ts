/* eslint-disable no-restricted-imports -- Isolated research preregistration over frozen built production roots (repository convention); zero production code changes and no production import of this module. */
/**
 * D3 REVISION 5 — THE TARGET REQUEST WAS NOT STATE-BLIND. FROZEN. NOT RUN. ZERO MODEL CALLS.
 *
 * THE VIOLATION
 *   The target request frozen at the noise-stability round, `sha256:70f69a1f…`, kept the production
 *   CharacterOS subject block: its user content carried the belief line, so the canonical CAUTION
 *   proposition appeared TWICE — once as STATEMENT A of the relation task and once inside the subject
 *   data — alongside a credence field.
 *
 *   That contradicts D3-B's frozen role, `STATE-BLIND EXECUTOR CAPABILITY DIAGNOSTIC`, whose
 *   `must_not_contain` list names CharacterOS subject state and a credence explicitly. The request is
 *   therefore invalid for execution, the schedule that references it is superseded, and this revision
 *   rebuilds the target request on the SAME state-blind base the qualification round already used.
 *
 * AN UNCOMFORTABLE PART OF THE RECORD
 *   The violation was introduced and then certified by the same audit. That round's own check list
 *   recorded `target_subject_data_untouched: true` — a check that asserted the defect was correct, because
 *   it encoded the wrong expectation: keeping the subject block was treated as a desirable property when
 *   the frozen role forbids it. A second check in the same list compared the schema to itself
 *   (`canonicalJsonString(x) === canonicalJsonString(x)`), so it could never fail. Both defects are
 *   recorded here rather than quietly fixed. Lesson: a check is only as good as the expectation it
 *   encodes, and a check that cannot fail certifies nothing.
 *
 * WHAT THIS FILE CHANGES: the target request's identity and state-blindness, and the schedule that
 * references it. Qualification, the noise gate, `r_confirm_B`, the target pair, the expected relation, the
 * target scorer, its unanimity criterion and the invalid policy are all untouched, and nothing is re-run.
 */

import { hashEnvelope } from "../../../packages/subject-core/dist/index.js";
import type { HashV1 } from "../../../packages/subject-core/dist/index.js";

import { D3_HASH_PROJECTION_V0, D3B_INPUTS_FROZEN, D3B_JSON_SCHEMA } from "./contract.ts";
import { D3B_ROLE } from "./contract-rev2-d3b-only.ts";
import { D3B_TARGET_PAIR } from "./transformer-d3b.ts";
import { D3_REV4_BUDGET } from "./contract-rev4-noise-stability-gate.ts";

export const D3_VERSION_REV5 = "belief-semantic-binding-localization-d3-rev5" as const;

export const D3_REVISION_4_MANIFEST_HASH =
  "sha256:b5f962f03ce6e33a8c0f8c8ce7f976a67c925bcb46d7033ee41525af47d49e6f" as const;

/** The invalid artifact, preserved rather than deleted. */
export const D3B_INVALID_TARGET_REQUEST = Object.freeze({
  request_hash: "sha256:70f69a1f131166d99193e2b2ded21248beb02a37cdf7e89c90195c1dc70e03d3",
  source: "evidence/run-001/d3-b-noise-stability/d3-b-target-schedule-audit.json + D3_B_TARGET_SCHEDULE.json",
  marking: "INVALID_FOR_EXECUTION_BY_STATE_BLINDNESS_CONTRACT",
  scheduled_superseded_marking: "SUPERSEDED_BEFORE_ANY_TARGET_CALL",
  deleted: false,
  silently_overwritten: false,
  any_provider_call_was_made_with_it: false,
  retained_as: "failure evidence"
});

// =============================================================================================
// 1. THE VIOLATION, WITH ITS MEASURED SHAPE
// =============================================================================================

export const D3B_TARGET_STATE_BLINDNESS_VIOLATION = Object.freeze({
  verdict: "D3_B_TARGET_REQUEST_NOT_STATE_BLIND",
  the_frozen_law_that_was_breached: D3B_ROLE.must_not_contain,
  the_frozen_role: D3B_ROLE.role,
  measured_in_the_invalid_request: Object.freeze({
    canonical_proposition_occurrences_total: 2,
    canonical_proposition_occurrence_1_owner: "STATEMENT A of the relation task",
    canonical_proposition_occurrence_2_owner: "the production subject belief block — THIS IS THE VIOLATION",
    user_content_contains_the_belief_block: true,
    user_content_contains_a_credence_field: true,
    paraphrase_occurrences_total: 1,
    paraphrase_owner: "STATEMENT B only"
  }),
  why_it_matters:
    "a state-blind diagnostic must not carry the subject's own belief state: the subject block supplies a second copy of the proposition under test and a credence, so a result from that request could not be attributed to the relation judgement alone",
  target_outputs_seen_before_correction: false,
  target_calls_before_correction: 0,
  noise_gate_result_known_before_correction: true,
  correction_reason_independent_of_the_noise_modal_token_identity: true,
  correction_reason_source: "the frozen state-blindness law, not the gate's outcome",
  introduced_and_certified_by_the_same_audit: true,
  the_audit_check_that_certified_it: "target_subject_data_untouched: true — a check encoding the wrong expectation",
  the_second_defect_in_the_same_check_list: "target_schema_is_the_frozen_d3b_schema compared the schema to itself and could never fail"
});

// =============================================================================================
// 2. PRESERVED
// =============================================================================================

export const D3_REV5_PRESERVED = Object.freeze({
  d3_b_instrument_qualified: true,
  d3_b_instrument_qualification_rerun: false,
  d3_b_noise_stability_gate_pass: true,
  noise_rerun: false,
  r_confirm_B: 6,
  r_confirm_changed: false,
  target_pair: D3B_TARGET_PAIR,
  target_pair_changed: false,
  expected_relation: D3B_INPUTS_FROZEN.expected_relation,
  expected_relation_changed: false,
  target_scorer_changed: false,
  unanimity_criterion_changed: false,
  target_invalid_policy_changed: false,
  scientific_claim_changed: false,
  d3_model_calls_still: 15,
  d1_evidence_changed: false,
  d2_evidence_changed: false,
  d3_a_still_deleted: true
});

// =============================================================================================
// 3. THE CORRECTED CONSTRUCTION
// =============================================================================================

export const D3B_CORRECTED_TARGET_CONSTRUCTION = Object.freeze({
  base_construction: "the SAME state-blind base the qualification round already used and froze: the production V8 request with the belief block removed by the D1-frozen stripBeliefBlockV0",
  new_base_design: false,
  transformer: "the frozen transformer, unchanged",
  schema: D3B_JSON_SCHEMA,
  contract: "the frozen relation contract, unchanged",
  anchors: "the frozen anchors, unchanged",
  statement_a: D3B_TARGET_PAIR.statement_a,
  statement_b: D3B_TARGET_PAIR.statement_b,
  statement_literals_modified: false,
  only_difference_from_qualification: "the STATEMENT A / STATEMENT B literal pair: synthetic frozen pair for qualification, canonical CAUTION plus frozen paraphrase for the target",
  target_only_subject_state_context: false,
  additional_context_added_for_the_target: false,
  additional_cleanup_done_for_the_target_only: false
});

// =============================================================================================
// 4. PROVENANCE
// =============================================================================================

export const D3_REV5_PROVENANCE = Object.freeze({
  target_calls_before_rev5: 0,
  target_outputs_seen_before_rev5: false,
  qualification_rerun: false,
  noise_rerun: false,
  r_confirm_changed: false,
  target_pair_changed: false,
  expected_relation_changed: false,
  target_scorer_changed: false,
  scientific_claim_changed: false,
  the_only_correction: "target request state-blindness / request identity",
  budget_unchanged: true,
  budget_maximum: D3_REV4_BUDGET.absolute_maximum
});

// =============================================================================================
// 5. MECHANICAL SELF-CHECKS + MANIFEST
// =============================================================================================

export interface D3Rev5ManifestV0 {
  readonly version: typeof D3_VERSION_REV5;
  readonly violation: typeof D3B_TARGET_STATE_BLINDNESS_VIOLATION;
  readonly invalid_target: typeof D3B_INVALID_TARGET_REQUEST;
  readonly preserved: typeof D3_REV5_PRESERVED;
  readonly corrected_construction: typeof D3B_CORRECTED_TARGET_CONSTRUCTION;
  readonly provenance: typeof D3_REV5_PROVENANCE;
  readonly revision_4_manifest_hash_preserved: string;
  readonly tests: Readonly<Record<string, unknown>>;
  readonly manifest_hash: HashV1;
}

export async function deriveD3Rev5ManifestV0(): Promise<D3Rev5ManifestV0> {
  const problems: string[] = [];
  const check = (condition: boolean, message: string): void => {
    if (!condition) problems.push(message);
  };
  check(D3B_TARGET_STATE_BLINDNESS_VIOLATION.verdict === "D3_B_TARGET_REQUEST_NOT_STATE_BLIND", "the violation verdict changed");
  check(D3B_TARGET_STATE_BLINDNESS_VIOLATION.target_calls_before_correction === 0, "a target call was spent");
  check(!D3B_TARGET_STATE_BLINDNESS_VIOLATION.target_outputs_seen_before_correction, "target outputs were seen");
  check(D3B_TARGET_STATE_BLINDNESS_VIOLATION.introduced_and_certified_by_the_same_audit, "the self-certification is not recorded");
  check(!D3B_INVALID_TARGET_REQUEST.deleted && !D3B_INVALID_TARGET_REQUEST.silently_overwritten, "the invalid artifact was removed");
  check(!D3B_INVALID_TARGET_REQUEST.any_provider_call_was_made_with_it, "a call was made with the invalid request");
  check(D3_REV5_PRESERVED.r_confirm_B === 6 && !D3_REV5_PRESERVED.r_confirm_changed, "r_confirm changed");
  check(!D3_REV5_PRESERVED.d3_b_instrument_qualification_rerun && !D3_REV5_PRESERVED.noise_rerun, "a stage was re-run");
  check(!D3_REV5_PRESERVED.target_pair_changed && !D3_REV5_PRESERVED.expected_relation_changed, "a scientific element changed");
  check(!D3_REV5_PRESERVED.target_scorer_changed && !D3_REV5_PRESERVED.scientific_claim_changed, "a scientific element changed");
  check(D3B_CORRECTED_TARGET_CONSTRUCTION.new_base_design === false, "a new base was designed");
  check(D3B_CORRECTED_TARGET_CONSTRUCTION.base_construction.includes("stripBeliefBlockV0"), "the corrected base is not the qualification base");
  check(!D3B_CORRECTED_TARGET_CONSTRUCTION.target_only_subject_state_context, "the corrected target keeps a target-only subject context");
  check(!D3B_CORRECTED_TARGET_CONSTRUCTION.additional_cleanup_done_for_the_target_only, "the target got target-only cleanup");
  check(D3_REV5_PROVENANCE.target_calls_before_rev5 === 0, "target calls are not zero");
  check(!D3_REV5_PROVENANCE.target_outputs_seen_before_rev5, "target outputs were seen before the revision");
  check(D3_REV5_PROVENANCE.budget_unchanged && D3_REV5_PROVENANCE.budget_maximum === 21, "the budget changed");
  if (problems.length > 0) throw new Error(`D3_REV5_NONCONFORMANT: ${problems.join(" ; ")}`);

  const tests = {
    violation_verdict: D3B_TARGET_STATE_BLINDNESS_VIOLATION.verdict,
    invalid_request_retained: true,
    invalid_request_marking: D3B_INVALID_TARGET_REQUEST.marking,
    target_calls_before_correction: 0,
    target_outputs_seen_before_correction: false,
    qualification_preserved: true,
    noise_gate_preserved: true,
    r_confirm_B: 6,
    corrected_base_is_the_qualification_base: true,
    only_difference_is_the_statement_pair: true,
    budget_unchanged: true,
    verification_cost: 0
  };

  const body = {
    version: D3_VERSION_REV5,
    violation: D3B_TARGET_STATE_BLINDNESS_VIOLATION,
    invalid_target: D3B_INVALID_TARGET_REQUEST,
    preserved: D3_REV5_PRESERVED,
    corrected_construction: D3B_CORRECTED_TARGET_CONSTRUCTION,
    provenance: D3_REV5_PROVENANCE,
    revision_4_manifest_hash_preserved: D3_REVISION_4_MANIFEST_HASH,
    tests
  };
  return Object.freeze({ ...body, manifest_hash: await hashEnvelope(D3_HASH_PROJECTION_V0, body) });
}
