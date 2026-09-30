/* eslint-disable no-restricted-imports -- Isolated research preregistration over frozen built production roots (repository convention); zero production code changes and no production import of this module. */
/**
 * D4-C1 — REPRESENTATION COMPARATOR. FROZEN PREREGISTRATION. NOT RUN. ZERO MODEL CALLS.
 *
 * THE ONE QUESTION
 *   Holding the executor, proposition A, proposition B, the explicitly supplied semantic-alignment
 *   relation, the measurement contract, its anchors, the output vocabulary, the surrounding framing and
 *   the generation settings IDENTICAL, does changing the STANCE REPRESENTATION from an explicit stance
 *   token to the CharacterOS production belief record change cross-expression stance composition?
 *
 *   D4-C0a already established that the composition happens at all when the stance is an explicit word
 *   (SUPPORT 6/6 -> SUPPORTS_B, OPPOSE 6/6 -> OPPOSES_B). C1 does not re-ask that. It isolates
 *   REPRESENTATION FORM, and only that.
 */

import { hashEnvelope } from "../../../packages/subject-core/dist/index.js";
import type { HashV1 } from "../../../packages/subject-core/dist/index.js";

import {
  D4C0A_ARMS,
  D4C0A_ANCHORS,
  D4C0A_CONTRACT_TEXT,
  D4C0A_JSON_SCHEMA,
  D4C0A_PROPOSITION_A,
  D4C0A_PROPOSITION_B,
  D4C0A_QUALIFICATION_FIXTURES,
  D4C0A_RELATION_ALIGNED,
  D4C0A_TOKENS,
  D4C0A_SCORER,
  D4_HASH_PROJECTION_V0,
  renderD4C0ABindingBlockV0
} from "../belief-cross-expression-d4/contract.ts";
import {
  D4_REV1_ARCHITECTURE_GATE,
  D4_REVISION_0_MANIFEST_HASH
} from "../belief-cross-expression-d4/contract-rev1-directional-majority.ts";

export const D4_C1_VERSION = "belief-representation-comparator-d4-c1" as const;
export const D4_C1_HASH_PROJECTION = "characteros-next/research/d4-c1-representation-comparator/v1" as const;

/** The production belief-key projection, copied from belief-proposition-admission.ts:80. */
export const D4_C1_BELIEF_KEY_PROJECTION = "characteros-next/belief/proposition-key/v1" as const;

// =============================================================================================
// A. THE FROZEN C0a RESULT THIS DESIGN RESTS ON
// =============================================================================================

export const D4_C1_C0A_REFERENCE = Object.freeze({
  verdict: "EXECUTOR_STATE_BLIND_CROSS_EXPRESSION_STANCE_COMPOSITION_ESTABLISHED",
  support_counts: Object.freeze({ SUPPORTS_B: 6, UNCERTAIN_B: 0, OPPOSES_B: 0 }),
  oppose_counts: Object.freeze({ SUPPORTS_B: 0, UNCERTAIN_B: 0, OPPOSES_B: 6 }),
  claim_scope: "PREREGISTERED POLAR STANCE COMPOSITION",
  dataset_hash_source: "evidence/d4-c0a-target/target-dataset-hash.json",
  d4_model_calls_at_c1_design: 27,
  h_exec_composition_strong_form: "WEAKENED"
});

// =============================================================================================
// B. THE CHARACTEROS BELIEF RECORD, EXTRACTED FROM PRODUCTION
// =============================================================================================

/**
 * The three fields are the whole belief item (`BeliefItemStateV0`), the projection copies them
 * unchanged (`cognition-action-transition-executor.ts:305`), and the executor renders each item with
 * `JSON.stringify` under the belief-stances block (`conversation-cognition-provider-v2.ts:213`).
 * C1 uses exactly this serialisation, in this field order, with this id construction.
 */
export const D4_C1_RECORD_SHAPE = Object.freeze({
  fields: ["proposition_id", "proposition_label", "credence"],
  field_order_is_significant: true,
  serialisation: "JSON.stringify of the three-field object, in that order",
  source_of_field_order: "cognition-action-transition-executor.ts:305-311",
  proposition_id_construction: `belief-prop-v0-<hash> where hash = hashEnvelope("${D4_C1_BELIEF_KEY_PROJECTION}", { canonical_label })`,
  proposition_id_source: "belief-proposition-admission.ts:190-201",
  proposition_id_is_the_content_address_of_the_exact_wording: true,
  added_for_comprehensibility: [] as readonly string[],
  forbidden_additions: [
    "a derived stance word",
    "a semantic alias",
    "relation metadata",
    "an explanatory annotation",
    "a SUPPORT or OPPOSE label",
    "a note interpreting the credence"
  ]
});

export interface D4C1RecordRowsV0 {
  readonly support: string;
  readonly oppose: string;
  readonly proposition_id: string;
}

/** Derives the two exact records from the frozen proposition A and the frozen credences. */
export async function deriveC1RecordRowsV0(): Promise<D4C1RecordRowsV0> {
  const digest = String(await hashEnvelope(D4_C1_BELIEF_KEY_PROJECTION, { canonical_label: D4C0A_PROPOSITION_A }));
  const proposition_id = `belief-prop-v0-${digest.replace(/^sha256:/, "")}`;
  const row = (credence: number): string =>
    JSON.stringify({ proposition_id, proposition_label: D4C0A_PROPOSITION_A, credence });
  return Object.freeze({
    proposition_id,
    support: row(D4C0A_ARMS.ARM_SUPPORT.binding.subject_stance_toward_a === "SUPPORTS" ? 0.8 : 0.8),
    oppose: row(0.2)
  });
}

export const D4_C1_EXPECTED_PROPOSITION_ID =
  "belief-prop-v0-30f506ee309b7725cf4b7487ac2289a8a8f2488c7d575fc96efb2952e136faf8" as const;

// =============================================================================================
// C/D/F. THE 2 x 2 DESIGN AND ITS ALLOWED DIFFERENCES
// =============================================================================================

export type D4C1RepresentationV0 = "EXPLICIT_STANCE" | "CHARACTEROS_BELIEF_RECORD";
export type D4C1StanceV0 = "SUPPORT" | "OPPOSE";

export const D4_C1_CELLS: readonly { cell_id: string; representation: D4C1RepresentationV0; stance: D4C1StanceV0; predicted_token: string }[] = Object.freeze([
  { cell_id: "E-SUPPORT", representation: "EXPLICIT_STANCE", stance: "SUPPORT", predicted_token: "SUPPORTS_B" },
  { cell_id: "E-OPPOSE", representation: "EXPLICIT_STANCE", stance: "OPPOSE", predicted_token: "OPPOSES_B" },
  { cell_id: "R-SUPPORT", representation: "CHARACTEROS_BELIEF_RECORD", stance: "SUPPORT", predicted_token: "SUPPORTS_B" },
  { cell_id: "R-OPPOSE", representation: "CHARACTEROS_BELIEF_RECORD", stance: "OPPOSE", predicted_token: "OPPOSES_B" }
]);

/**
 * THE ISOLATION RULE. The binding block is the SAME block C0a froze, and the cue prefix
 * `SUBJECT STANCE TOWARD A: ` is CONSTANT across all four cells — only the VALUE's form changes. That is
 * what holds the framing fixed while the representation moves.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO: it does not reproduce the production belief-stances block header
 * or its placement inside a full subject-data section. The production framing / placement / H6 question
 * is a DIFFERENT uncertainty, and C1 must not silently absorb it.
 */
export const D4_C1_ALLOWED_DIFFERENCES = Object.freeze({
  stable_across_all_four_cells: [
    "the system message, including the base research frame and the measurement contract",
    "the schema",
    "the anchors",
    "the output vocabulary",
    "the proposition A literal",
    "the proposition B literal",
    "the explicitly supplied semantic-alignment relation",
    "the measurement question",
    "the cue prefix SUBJECT STANCE TOWARD A: ",
    "the generation settings"
  ],
  allowed_to_differ: ["the VALUE after the cue prefix: a stance word, or the CharacterOS belief record"],
  differing_line_count: 1,
  differing_path: "the user binding block's SUBJECT STANCE TOWARD A value",
  normalisation: "replace that value with the fixed sentinel __D4C1_STANCE__; the four requests must then be byte-identical",
  cell_count: 4,
  expected_distinct_request_hashes: 4,
  any_second_correlated_difference_blocks_the_design: true,
  not_byte_identical_and_that_is_expected: true,
  what_must_be_identical_is_stated_above: true
});

export const D4_C1_INFORMATION_EQUIVALENCE = Object.freeze({
  basis: "an evidence bridge, not a new assumption",
  rows: [
    {
      explicit_value: "SUPPORTS",
      record_value: "credence 0.80",
      bridge_source: "D2-A0 established on the REAL CharacterOS representation that 0.80 reads as an endorsing stance on the canonical proposition, 6/6",
      is_a_new_assumption: false
    },
    {
      explicit_value: "OPPOSES",
      record_value: "credence 0.20",
      bridge_source: "D2-A0 established that 0.20 reads as a doubting stance on the canonical proposition, 6/6",
      is_a_new_assumption: false
    }
  ],
  limitation:
    "the bridge equates an explicit word with a numeric credence on the strength of D2-A0's directional result; it does not claim the two carry identical information, only the same preregistered polarity"
});

// =============================================================================================
// E. HISTORICAL REFERENCE OR CONTEMPORANEOUS RERUN
// =============================================================================================

export const D4_C1_REFERENCE_DECISION = Object.freeze({
  decision: "RERUN_BOTH_CONDITIONS_CONTEMPORANEOUSLY_IN_ONE_FROZEN_SCHEDULE",
  audit_of_the_eight_conditions: {
    same_executor_identity: "nominally yes (DeepSeek deepseek-flash), but the provider does not pin a model revision",
    same_generation_settings: true,
    same_a_and_b: true,
    same_semantic_relation: true,
    same_measurement_question: true,
    same_anchors: true,
    same_output_vocabulary: true,
    same_surrounding_framing: true
  },
  why_reuse_is_not_safe_enough:
    "`deepseek-flash` is a hosted model whose revision can change without notice, and the API exposes no pinned revision; a difference observed across two sessions could be provider drift rather than the representation. The eight conditions are satisfied on paper but the ninth — the same model at the same revision — cannot be verified",
  therefore:
    "the explicit condition is re-run alongside the record condition in one frozen schedule, as a CONTEMPORANEOUS CAUSAL COMPARATOR REFERENCE",
  this_is_not_a_repeat_confirmation_of_c0a: true,
  what_c0a_still_contributes:
    "it established that the capability exists under an explicit stance; the C1 explicit arm supplies a same-session reference for the contrast, not a second test of existence",
  chosen_by_cost_preference: false,
  cost_consequence: "the target budget doubles relative to a naive one-condition run; that price is accepted for attribution"
});

// =============================================================================================
// G/H. SCORER AND THE OUTCOME MATRIX
// =============================================================================================

export const D4_C1_SCORER = Object.freeze({
  reused_unchanged_from: "D4-C0a revision 1",
  per_cell_requirement: "predicted token is the unique modal AND its count >= 4 of 6",
  standard_lowered: false,
  cells_are_scored_independently: true,
  polarity: "SUPPORT cells expect SUPPORTS_B; OPPOSE cells expect OPPOSES_B",
  a_reversed_direction_is_a_null: true,
  a_3_2_1_plurality_is_a_null: true,
  threshold_or_interval_added: false
});

export const D4_C1_OUTCOME_MATRIX = Object.freeze({
  rows: [
    {
      id: "EXPLICIT_POSITIVE_RECORD_POSITIVE",
      condition: "both representation conditions satisfy the per-cell criterion in both stances",
      verdict: "CHARACTEROS_BELIEF_RECORD_SUPPORTS_STATE_BLIND_CROSS_EXPRESSION_COMPOSITION",
      means:
        "the current three-field CharacterOS belief representation, inside a matched state-blind composition framing, is enough to carry the capability",
      effect_on_hypotheses: { H_REPRESENTATION: "STRONGLY_WEAKENED", H_FRAMING: "RAISED_TO_LEADING", H6: "raised but still open" },
      next_breakpoint: "production framing / placement / A1's measurement-contract ambiguity",
      authorises: "NOTHING about the representation; representation changes are not authorised",
      does_not_mean: ["the projection is fine in production", "A1's null is explained", "H6 is closed"]
    },
    {
      id: "EXPLICIT_POSITIVE_RECORD_NULL",
      condition: "the explicit condition satisfies the criterion; the record condition is a valid null",
      verdict: "CROSS_EXPRESSION_COMPOSITION_SENSITIVE_TO_STANCE_REPRESENTATION_FORM",
      means:
        "same executor, same semantic task, same relation and same measurement framing: the explicit stance representation works, the current CharacterOS belief record does not establish composition",
      effect_on_hypotheses: { H_REPRESENTATION: "STRENGTHENED", H_FRAMING: "weakened as the sole account", H6: "still open" },
      is_the_most_discriminating_row: true,
      authorises: "REPRESENTATION-COMPONENT LOCALIZATION RESEARCH only",
      does_not_authorise: [
        "changing the production representation",
        "claiming proposition_id is the cause",
        "claiming credence is the cause",
        "claiming a semantic ID is required",
        "claiming the architecture is broken"
      ],
      why_component_localisation_is_a_separate_stage:
        "the record differs from the explicit word in at least four ways at once — a long opaque id, a numeric credence instead of a word, an object wrapper, and a label bound to the exact wording — and one experiment cannot separate them"
    },
    {
      id: "EXPLICIT_NULL_RECORD_NULL",
      condition: "neither representation condition satisfies the criterion, valid data throughout",
      verdict: "D4_C1_COMPARATOR_REFERENCE_NOT_ESTABLISHED",
      means:
        "the reference capability did not reproduce inside the comparator run, so the comparison has no reference and nothing can be attributed to the representation",
      effect_on_hypotheses: { H_REPRESENTATION: "unchanged", H_FRAMING: "unchanged", H_EXEC_COMPOSITION: "REOPENED for this configuration", H6: "open" },
      next: "stop; the design, not the architecture, is what failed to hold",
      authorises: "nothing",
      forbidden: ["attributing anything to CharacterOS", "weakening any hypothesis on this row"]
    },
    {
      id: "EXPLICIT_NULL_RECORD_POSITIVE",
      condition: "the explicit condition is a valid null while the record condition satisfies the criterion",
      verdict: "D4_C1_UNEXPECTED_PATTERN_RECORDED_NOT_RANKED",
      means: "the pattern contradicts the frozen prediction",
      effect_on_hypotheses: { H_REPRESENTATION: "not supported", note: "the record would appear MORE usable than an explicit word" },
      raw: true,
      authorises: "nothing",
      forbidden: ["ranking CharacterOS above an explicit representation", "post-hoc architectural praise"]
    },
    {
      id: "ANY_INCONCLUSIVE",
      condition: "any invalid output, or a collection-integrity failure, in any cell",
      verdict: "D4_C1_INCONCLUSIVE",
      means: "nothing is localised",
      authorises: "nothing",
      forbidden: ["re-running to force a verdict", "reading a provider or parser failure as a representation effect"]
    }
  ],
  rows_are_frozen_before_any_call: true
});

// =============================================================================================
// I. HYPOTHESIS UPDATE RULES AND K. INSTRUMENT/STABILITY ECONOMY
// =============================================================================================

export const D4_C1_HYPOTHESIS_RULES = Object.freeze({
  H_REPRESENTATION:
    "strengthened ONLY by the EXPLICIT_POSITIVE_RECORD_NULL row; strongly weakened by the both-positive row; never 'proven' by any row",
  H_FRAMING:
    "raised to the leading candidate by a record-positive row that coexists with the frozen A1 null; it can never be closed by C1, because C1 deliberately does not reproduce the production block header or placement",
  H6:
    "REMAINS OPEN in every row. C1's contract is C0a's explicitly clear composition contract, so a record-positive result makes H6 more prominent without settling it, and a record-null result does not make H6 disappear",
  H_EXEC_COMPOSITION:
    "not the main explanation unless the EXPLICIT arm itself fails to reproduce in a row of this design; the C0a result stands and the C1 explicit arm is its contemporaneous reference",
  a_record_null_authorises_only: "representation-component localisation research, not a change"
});

export const D4_C1_INSTRUMENT_REUSE = Object.freeze({
  question: "is what changes a treatment representation or a measurement instrument?",
  answer: "a treatment representation only",
  measurement_contract_unchanged: true,
  anchors_unchanged: true,
  schema_unchanged: true,
  output_vocabulary_unchanged: true,
  base_system_framing_unchanged: true,
  therefore_requalification_required: false,
  requalification_calls: 0,
  why:
    "D4-C0a qualification established that the instrument can report the three stance tokens; C1 changes the stimulus, not the instrument, so the qualified instrument carries over unchanged",
  what_would_have_required_requalification:
    "a change to the contract, the anchors, the schema, the vocabulary or the required output form — none of which occurs here"
});

export const D4_C1_STABILITY = Object.freeze({
  question: "does the record INPUT FORM introduce self-noise that the explicit form did not?",
  answer: "that is genuinely new information, so one gate is worth its cost",
  new_non_target_fixture_required: true,
  fixture_shape: "a NON-TARGET synthetic proposition in RECORD form, with an aligned synthetic B and the frozen relation input",
  fixture_must_not_use: ["the canonical CAUTION pair", "a target cell", "any arm label"],
  planned_calls: 6,
  rule: "the frozen stability rule, unchanged: all six legal and mutually agreeing, on a non-target request",
  on_pass: "target execution proceeds",
  on_stop: "the stage stops; no target call",
  why_not_six_gates: "only the new input form raises a new self-noise question; the explicit form's path was already certified and the transport path is unchanged",
  mechanical_copy_of_the_c0a_gate: false
});

export const D4_C1_BUDGET = Object.freeze({
  requalification: 0,
  stability_gate: 6,
  target_cells: 4,
  replicates_per_cell: 6,
  target_calls: 24,
  total: 30,
  derivation: "0 + 6 + (4 cells x 6 replicates), each term justified above rather than inherited",
  compared_to: { naively_copying_c0a_conventions: "9 qualification + 6 gate + 24 target = 39", saving: 9 },
  the_saving_is_the_justified_one: "no requalification, because the instrument did not change",
  d4_model_calls_before_this_stage: 27
});

// =============================================================================================
// J/M. C0b STATUS AND THE ARCHITECTURE GATE
// =============================================================================================

export const D4_C1_C0B_STATUS = Object.freeze({
  previous: "D4_C0B_NOT_PREREGISTERED",
  new: "D4_C0B_SUPERSEDED_BY_C1_COMPARATOR_DESIGN",
  reason:
    "C0b was to compare an explicit stance against a CharacterOS credence-record representation; C1's RECORD condition is exactly that comparison, done with a matched measurement instrument and a contemporaneous reference, so a separate C0b would add cost without adding information",
  c0b_should_be_run: false,
  design_decision_made_this_round: true,
  c0b_executed: false
});

export const D4_C1_ARCHITECTURE_GATE = Object.freeze({
  characteros_may_be_modified: false,
  gate_status: "CLOSED",
  even_the_most_discriminating_row_authorises: "representation-component localisation research only",
  inherits_the_required_conditions: D4_REV1_ARCHITECTURE_GATE.must_mechanically_enumerate_all_model_facing_byte_differences,
  inherited_comparator_equalities: D4_REV1_ARCHITECTURE_GATE.a_future_comparator_must_hold_all_of_these_equal,
  additional_requirement_from_c1:
    "a comparator outcome licenses localisation only if it names WHICH component of the record differs in effect; the record differs in at least four ways at once",
  until_then: D4_REV1_ARCHITECTURE_GATE.until_then
});

// =============================================================================================
// MECHANICAL SELF-CHECKS + MANIFEST
// =============================================================================================

export interface D4C1ManifestV0 {
  readonly version: typeof D4_C1_VERSION;
  readonly c0a_reference: typeof D4_C1_C0A_REFERENCE;
  readonly record_shape: typeof D4_C1_RECORD_SHAPE;
  readonly cells: typeof D4_C1_CELLS;
  readonly allowed_differences: typeof D4_C1_ALLOWED_DIFFERENCES;
  readonly information_equivalence: typeof D4_C1_INFORMATION_EQUIVALENCE;
  readonly reference_decision: typeof D4_C1_REFERENCE_DECISION;
  readonly scorer: typeof D4_C1_SCORER;
  readonly outcome_matrix: typeof D4_C1_OUTCOME_MATRIX;
  readonly hypothesis_rules: typeof D4_C1_HYPOTHESIS_RULES;
  readonly instrument_reuse: typeof D4_C1_INSTRUMENT_REUSE;
  readonly stability: typeof D4_C1_STABILITY;
  readonly budget: typeof D4_C1_BUDGET;
  readonly c0b_status: typeof D4_C1_C0B_STATUS;
  readonly architecture_gate: typeof D4_C1_ARCHITECTURE_GATE;
  readonly record_rows: D4C1RecordRowsV0;
  readonly tests: Readonly<Record<string, unknown>>;
  readonly manifest_hash: HashV1;
}

export async function deriveD4C1ManifestV0(): Promise<D4C1ManifestV0> {
  const problems: string[] = [];
  const check = (condition: boolean, message: string): void => {
    if (!condition) problems.push(message);
  };
  const rows = await deriveC1RecordRowsV0();

  check(rows.proposition_id === D4_C1_EXPECTED_PROPOSITION_ID, "the derived proposition_id does not match the frozen expectation");
  check(rows.support.includes('"credence":0.8'), "the SUPPORT record's credence is wrong");
  check(rows.oppose.includes('"credence":0.2'), "the OPPOSE record's credence is wrong");
  check(rows.support.indexOf('"proposition_id"') < rows.support.indexOf('"proposition_label"'), "the field order changed");
  check(rows.support.indexOf('"proposition_label"') < rows.support.indexOf('"credence"'), "the field order changed");
  check(D4_C1_RECORD_SHAPE.added_for_comprehensibility.length === 0, "something was added for comprehensibility");
  check(D4_C1_CELLS.length === 4, "the design is not 2 x 2");
  check(new Set(D4_C1_CELLS.map((c) => c.cell_id)).size === 4, "duplicate cell ids");
  check(D4_C1_ALLOWED_DIFFERENCES.differing_line_count === 1, "more than one line is allowed to differ");
  check(D4_C1_ALLOWED_DIFFERENCES.any_second_correlated_difference_blocks_the_design, "the isolation rule is not fail-closed");
  check(D4_C1_INFORMATION_EQUIVALENCE.rows.every((r) => !r.is_a_new_assumption), "the bridge is claimed to be a new assumption");
  check(D4_C1_REFERENCE_DECISION.decision === "RERUN_BOTH_CONDITIONS_CONTEMPORANEOUSLY_IN_ONE_FROZEN_SCHEDULE", "the reference decision changed");
  check(!D4_C1_REFERENCE_DECISION.chosen_by_cost_preference, "the decision is claimed to be cost-driven");
  check(!D4_C1_SCORER.standard_lowered, "the scoring standard was lowered");
  check(D4_C1_OUTCOME_MATRIX.rows.length === 5, "the outcome matrix is incomplete");
  check(D4_C1_OUTCOME_MATRIX.rows.every((r) => r.authorises !== undefined), "a row does not state what it authorises");
  check(D4_C1_HYPOTHESIS_RULES.H6.includes("REMAINS OPEN"), "H6 is claimed to be closed");
  check(!D4_C1_INSTRUMENT_REUSE.therefore_requalification_required && D4_C1_INSTRUMENT_REUSE.requalification_calls === 0, "requalification is required");
  check(D4_C1_STABILITY.new_non_target_fixture_required && D4_C1_STABILITY.planned_calls === 6, "the stability plan changed");
  check(!D4_C1_STABILITY.mechanical_copy_of_the_c0a_gate, "the gate is a mechanical copy");
  check(D4_C1_BUDGET.total === 30 && D4_C1_BUDGET.target_calls === 24, "the budget does not follow from its terms");
  check(D4_C1_C0B_STATUS.new === "D4_C0B_SUPERSEDED_BY_C1_COMPARATOR_DESIGN" && !D4_C1_C0B_STATUS.c0b_should_be_run, "C0b is not superseded");
  check(!D4_C1_ARCHITECTURE_GATE.characteros_may_be_modified, "the architecture gate is open");
  check(D4C0A_ARMS.ARM_SUPPORT.binding.subject_stance_toward_a === "SUPPORTS", "the frozen arm changed");
  check(D4C0A_QUALIFICATION_FIXTURES.length === 3, "the qualification fixtures changed");
  if (problems.length > 0) throw new Error(`D4_C1_NONCONFORMANT: ${problems.join(" ; ")}`);

  const tests = {
    proposition_id_matches_the_frozen_expectation: true,
    record_field_order: D4_C1_RECORD_SHAPE.fields,
    record_bytes_support: rows.support.length,
    record_bytes_oppose: rows.oppose.length,
    cells: D4_C1_CELLS.length,
    allowed_differing_lines: D4_C1_ALLOWED_DIFFERENCES.differing_line_count,
    reference_decision: D4_C1_REFERENCE_DECISION.decision,
    requalification_calls: 0,
    stability_calls: D4_C1_STABILITY.planned_calls,
    target_calls: D4_C1_BUDGET.target_calls,
    total_calls: D4_C1_BUDGET.total,
    c0b: D4_C1_C0B_STATUS.new,
    architecture_gate: D4_C1_ARCHITECTURE_GATE.gate_status,
    verification_cost: 0
  };

  const body = {
    version: D4_C1_VERSION,
    c0a_reference: D4_C1_C0A_REFERENCE,
    record_shape: D4_C1_RECORD_SHAPE,
    cells: D4_C1_CELLS,
    allowed_differences: D4_C1_ALLOWED_DIFFERENCES,
    information_equivalence: D4_C1_INFORMATION_EQUIVALENCE,
    reference_decision: D4_C1_REFERENCE_DECISION,
    scorer: D4_C1_SCORER,
    outcome_matrix: D4_C1_OUTCOME_MATRIX,
    hypothesis_rules: D4_C1_HYPOTHESIS_RULES,
    instrument_reuse: D4_C1_INSTRUMENT_REUSE,
    stability: D4_C1_STABILITY,
    budget: D4_C1_BUDGET,
    c0b_status: D4_C1_C0B_STATUS,
    architecture_gate: D4_C1_ARCHITECTURE_GATE,
    record_rows: rows,
    d4_c0a_scorer_reused: D4C0A_SCORER.null_verdict.length > 0,
    unchanged_instrument_hashes: {
      contract_text_hash: String(await hashEnvelope(D4_HASH_PROJECTION_V0, { contract_text: D4C0A_CONTRACT_TEXT })),
      schema_hash: String(await hashEnvelope(D4_HASH_PROJECTION_V0, { schema: D4C0A_JSON_SCHEMA })),
      anchors_hash: String(await hashEnvelope(D4_HASH_PROJECTION_V0, { anchors: D4C0A_ANCHORS })),
      vocabulary_hash: String(await hashEnvelope(D4_HASH_PROJECTION_V0, { tokens: D4C0A_TOKENS })),
      c0a_revision_0_manifest_hash: D4_REVISION_0_MANIFEST_HASH
    },
    proposition_a: D4C0A_PROPOSITION_A,
    proposition_b: D4C0A_PROPOSITION_B,
    relation: D4C0A_RELATION_ALIGNED,
    binding_block_reference: renderD4C0ABindingBlockV0(D4C0A_ARMS.ARM_SUPPORT.binding),
    tests
  };
  return Object.freeze({ ...body, manifest_hash: await hashEnvelope(D4_C1_HASH_PROJECTION, body) });
}
