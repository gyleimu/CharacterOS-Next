/* eslint-disable no-restricted-imports -- Isolated research preregistration over frozen built production roots (repository convention); zero production code changes and no production import of this module. */
/**
 * D4-C1 REVISION 1 — TEMPORAL COMPARATOR CONTROLS. FROZEN. ZERO MODEL CALLS.
 *
 * Two controls are frozen here, before any C1 stability or target output exists:
 *   1. the EXPLICIT reference's byte identity with the frozen D4-C0a target requests;
 *   2. the 24-call target's temporal structure — six four-trial blocks, each holding exactly one of each
 *      cell, in a deterministic outcome-blind order.
 *
 * Nothing scientific changes: the record bytes, the 0.80 / 0.20 values, the A/B literals, the explicit
 * relation, the measurement contract, its anchors, the vocabulary, the scorer and the C0a historical
 * result are all untouched, and CharacterOS production code is not touched at all.
 */

import { hashEnvelope } from "../../../packages/subject-core/dist/index.js";
import type { HashV1 } from "../../../packages/subject-core/dist/index.js";

import { D4C0A_ARMS, D4_HASH_PROJECTION_V0 } from "../belief-cross-expression-d4/contract.ts";
import { D4_C1_CELLS, D4_C1_VERSION, type D4C1RepresentationV0, type D4C1StanceV0 } from "./contract.ts";

export const D4_C1_VERSION_REV1 = "belief-representation-comparator-d4-c1-rev1" as const;

export const D4_C1_REVISION_0_MANIFEST_HASH =
  "sha256:0e115f94c79b8eb8ce40357a18c9cf5904d189b747a88d8a1ae2fe99bac5b2a2" as const;

// =============================================================================================
// 1. THE EXPLICIT REFERENCE'S BYTE IDENTITY WITH C0a
// =============================================================================================

export const D4_C1_FROZEN_C0A_TARGET_HASHES = Object.freeze({
  support: "sha256:0bad19fc3cd612db457615127ff79074f0e49c3f4bceab1b4b38d53b9d61549a",
  oppose: "sha256:bd195ef5ac12da286b0e7e8d401dc05a4ea7965506f52b41e00fea350d2dafb5"
});

/**
 * C0a's target request BYTES were never written to disk — only their hashes were frozen in its schedule.
 * They are therefore reconstructed from the frozen pieces (base text, contract, schema, binding renderer,
 * arm bindings) and verified against the frozen hashes, and this round persists them as an artifact so
 * the identity is durable for every later round.
 */
export const D4_C1_REFERENCE_REQUIREMENT = Object.freeze({
  requirement:
    "the C1 EXPLICIT cells must be BYTE-IDENTICAL to the frozen D4-C0a target requests, and their hashes must match exactly",
  on_failure: "STOP; 'semantically the same' is not sufficient to call it a contemporaneous reference, and the byte differences must be reported",
  reconstructed_from: "the frozen D4-C0a base text, contract, schema, binding renderer and arm bindings",
  bytes_persisted_this_round: true,
  semantic_equivalence_is_not_sufficient: true
});

// =============================================================================================
// 4. THE CLAIM BOUNDARY FOR THE RECORD CONDITION
// =============================================================================================

export const D4_C1_RECORD_CONDITION_WORDING = Object.freeze({
  permitted_description: "CURRENT CHARACTEROS BELIEF-RECORD REPRESENTATION IN A MATCHED STATE-BLIND RESEARCH FRAME",
  forbidden_description: ["the production CharacterOS condition", "the production belief condition", "CharacterOS in production"],
  why:
    "production placement is removed, the full subject state is removed, and the production framing is removed — deliberately, so that C1 measures representation-form usability rather than production-context usability",
  this_is_intended_design: true,
  c1_does_not_measure: "production-context usability"
});

// =============================================================================================
// 5/6/7/8. THE 24-CALL BLOCKED TEMPORAL DESIGN
// =============================================================================================

export const D4_C1_TEMPORAL_PRINCIPLE = Object.freeze({
  reason: "the executor is a hosted model whose provider revision cannot be pinned",
  consequence: "no historical C0a evidence serves as the C1 causal comparator reference; ALL FOUR CELLS ARE EXECUTED CONTEMPORANEOUSLY IN ONE PRE-REGISTERED SCHEDULE",
  is_a_cost_decision: false,
  is_a_provider_drift_control: true
});

/** The balanced Latin square for four conditions: row k is a cyclic construction that balances carryover. */
const LATIN_SQUARE_4: readonly (readonly number[])[] = Object.freeze([
  Object.freeze([0, 1, 3, 2]),
  Object.freeze([1, 2, 0, 3]),
  Object.freeze([2, 3, 1, 0]),
  Object.freeze([3, 0, 2, 1])
]);

const CELL_ORDER: readonly string[] = Object.freeze(D4_C1_CELLS.map((c) => c.cell_id));

/**
 * The frozen ordering rule: block k (0-based) uses Latin-square row (k mod 4). Deterministic, outcome
 * blind, independent of latency, timestamps, qualification/stability token identities and human choice.
 */
export function frozenC1OrderV0(blockIndex: number): string[] {
  const row = LATIN_SQUARE_4[blockIndex % 4] as readonly number[];
  return row.map((index) => CELL_ORDER[index] as string);
}

export interface D4C1ScheduleEntryV0 {
  readonly position: number;
  readonly block: number;
  readonly cell_id: string;
  readonly representation: D4C1RepresentationV0;
  readonly stance: D4C1StanceV0;
}

export function deriveC1ScheduleV0(): readonly D4C1ScheduleEntryV0[] {
  const out: D4C1ScheduleEntryV0[] = [];
  for (let block = 0; block < 6; block += 1) {
    for (const [offset, cellId] of frozenC1OrderV0(block).entries()) {
      const cell = D4_C1_CELLS.find((c) => c.cell_id === cellId) as (typeof D4_C1_CELLS)[number];
      out.push({
        position: block * 4 + offset + 1,
        block: block + 1,
        cell_id: cellId,
        representation: cell.representation,
        stance: cell.stance
      });
    }
  }
  return Object.freeze(out.map((e) => Object.freeze(e)));
}

export const D4_C1_TARGET_STRUCTURE = Object.freeze({
  blocks: 6,
  cells_per_block: 4,
  each_block_contains_each_cell_exactly_once: true,
  target_calls: 24,
  replicates_per_cell: 6,
  forbidden_structures: [
    "12 explicit cells followed by 12 record cells",
    "12 SUPPORT cells followed by 12 OPPOSE cells",
    "any part of the comparator run without the others"
  ],
  ordering_rule: "block k uses balanced-Latin-square row (k mod 4) over the four cells",
  ordering_is_deterministic: true,
  ordering_is_outcome_blind: true,
  ordering_depends_on: ["the block index and the frozen cell list, and nothing else"],
  ordering_does_not_depend_on: [
    "runtime latency",
    "timestamps",
    "qualification or stability token identities",
    "the C0a result pattern",
    "human choice after execution starts"
  ]
});

export const D4_C1_TEMPORAL_BALANCE_CLAIM = Object.freeze({
  permitted_claim: "the design reduces systematic collinearity between representation and execution-time ordering",
  forbidden_claim: "this eliminates all provider drift",
  forbidden_claim_reason: "no within-session design can eliminate drift; it can only stop the drift from being systematically aligned with a condition"
});

// =============================================================================================
// 10/11/12. THE RECORD-FORM STABILITY FIXTURE
// =============================================================================================

/** A frozen NON-TARGET synthetic proposition, unrelated to the canonical CAUTION pair. */
export const D4_C1_STABILITY_FIXTURE_PROPOSITION = "A clamp should always be used when gluing a joint." as const;
export const D4_C1_STABILITY_FIXTURE_CREDENCE = 0.95 as const;
export const D4_C1_STABILITY_FIXTURE_B = "Clamping a joint while the glue sets is always the right thing to do." as const;

export const D4_C1_STABILITY_FIXTURE = Object.freeze({
  kind: "NON_TARGET RECORD-FORM INSTRUMENT / INPUT-FORM STABILITY FIXTURE",
  proposition: D4_C1_STABILITY_FIXTURE_PROPOSITION,
  credence: D4_C1_STABILITY_FIXTURE_CREDENCE,
  proposition_b: D4_C1_STABILITY_FIXTURE_B,
  relation: "A and B express the same underlying view.",
  record_form: "the same three production fields, in the same order, with the proposition_id derived by the PRODUCTION derivation and never hand-written",
  proposition_id_must_be_derived_not_written: true,
  must_not_use: ["the C1 canonical A/B target pair", "a scientific target cell", "any arm label"],
  credence_is_not_an_experimental_value: true,
  measured: "identical-request self-consistency of the measurement path on the RECORD input form",
  separate_from_the_target: true,
  stability_outputs_enter_the_comparator_dataset: false,
  the_24_target_trials_are_not_used_as_a_stability_pilot: true
});

export const D4_C1_STABILITY_CORRECTNESS_SEPARATION = Object.freeze({
  pass_condition: "all six trials legal and mutually agreeing on one token",
  correctness_required: false,
  six_of_six_agreement_passes_even_when_the_token_is_not_the_fixtures_expected_one: true,
  why: "qualification owns correctness; this gate owns stability",
  contrary_rule_frozen_anywhere: false
});

// =============================================================================================
// 13/14/15/16/17. PRESERVED DECISIONS AND THE NEXT-ROUND BOUNDARY
// =============================================================================================

export const D4_C1_REV1_PRESERVED = Object.freeze({
  record_bytes_changed: false,
  credences_changed: false,
  a_and_b_literals_changed: false,
  explicit_relation_changed: false,
  measurement_contract_changed: false,
  anchors_changed: false,
  vocabulary_changed: false,
  scorer_changed: false,
  c0a_historical_result_changed: false,
  characteros_production_code_changed: false,
  requalification_calls: 0,
  requalification_reason: "the measurement instrument is unchanged; the new variable is the stance representation",
  scorer_acceptance_region_changed: false,
  per_cell_requirement: "predicted token is the unique modal AND its count >= 4 of 6",
  c1_stability_is_separate_from_the_target: true,
  architecture_gate: "CLOSED",
  link_4: "REMAINS_LOCKED",
  characteros: "UNMODIFIED"
});

export const D4_C1_NEXT_ROUND_BOUNDARY = Object.freeze({
  may_only: [
    "implement the frozen record-cell renderer",
    "implement the frozen non-target record stability fixture",
    "pass a zero-call offline conformance gate",
    "freeze the implementation hashes",
    "execute only the six record-form stability calls",
    "freeze that dataset",
    "classify it and stop"
  ],
  may_not: [
    "execute the 24-call target in the same round as the stability gate",
    "modify CharacterOS",
    "change the record bytes or the credences",
    "change the measurement contract, anchors, schema or vocabulary",
    "lower the per-cell scoring standard",
    "treat the stability gate's token identity as a correctness condition"
  ],
  target_after_stability_pass: "a separate round",
  must_stop_after_stability_pass: true
});

// =============================================================================================
// MECHANICAL SELF-CHECKS + MANIFEST
// =============================================================================================

export interface D4C1Rev1ManifestV0 {
  readonly version: typeof D4_C1_VERSION_REV1;
  readonly reference_requirement: typeof D4_C1_REFERENCE_REQUIREMENT;
  readonly frozen_c0a_target_hashes: typeof D4_C1_FROZEN_C0A_TARGET_HASHES;
  readonly record_condition_wording: typeof D4_C1_RECORD_CONDITION_WORDING;
  readonly temporal_principle: typeof D4_C1_TEMPORAL_PRINCIPLE;
  readonly target_structure: typeof D4_C1_TARGET_STRUCTURE;
  readonly temporal_balance_claim: typeof D4_C1_TEMPORAL_BALANCE_CLAIM;
  readonly stability_fixture: typeof D4_C1_STABILITY_FIXTURE;
  readonly stability_correctness_separation: typeof D4_C1_STABILITY_CORRECTNESS_SEPARATION;
  readonly preserved: typeof D4_C1_REV1_PRESERVED;
  readonly next_round_boundary: typeof D4_C1_NEXT_ROUND_BOUNDARY;
  readonly schedule: readonly D4C1ScheduleEntryV0[];
  readonly supersedes_scope: readonly string[];
  readonly revision_0_manifest_hash_preserved: string;
  readonly scientific_content_changed: false;
  readonly tests: Readonly<Record<string, unknown>>;
  readonly manifest_hash: HashV1;
}

export async function deriveD4C1Rev1ManifestV0(): Promise<D4C1Rev1ManifestV0> {
  const problems: string[] = [];
  const check = (condition: boolean, message: string): void => {
    if (!condition) problems.push(message);
  };
  const schedule = deriveC1ScheduleV0();

  check(schedule.length === 24, "the schedule is not 24 entries");
  for (let block = 1; block <= 6; block += 1) {
    const cells = schedule.filter((e) => e.block === block).map((e) => e.cell_id);
    check(cells.length === 4 && new Set(cells).size === 4, `block ${String(block)} does not contain each cell exactly once`);
  }
  for (const cell of D4_C1_CELLS) {
    check(schedule.filter((e) => e.cell_id === cell.cell_id).length === 6, `cell ${cell.cell_id} does not appear six times`);
  }
  check(D4_C1_TARGET_STRUCTURE.target_calls === 24, "the target call count changed");
  check(!D4_C1_REFERENCE_REQUIREMENT.semantic_equivalence_is_not_sufficient === false, "semantic equivalence was accepted as sufficient");
  check(D4_C1_REFERENCE_REQUIREMENT.on_failure.startsWith("STOP"), "the failure path is not a stop");
  check(D4_C1_RECORD_CONDITION_WORDING.forbidden_description.length === 3, "the forbidden wording list changed");
  check(!D4_C1_TEMPORAL_PRINCIPLE.is_a_cost_decision && D4_C1_TEMPORAL_PRINCIPLE.is_a_provider_drift_control, "the temporal principle is misstated");
  check(D4_C1_TEMPORAL_BALANCE_CLAIM.forbidden_claim.includes("eliminates all provider drift"), "the forbidden balance claim changed");
  check(D4_C1_STABILITY_FIXTURE.proposition_id_must_be_derived_not_written, "the fixture id may be hand-written");
  check(!D4_C1_STABILITY_FIXTURE.stability_outputs_enter_the_comparator_dataset, "stability outputs may enter the comparator dataset");
  check(!D4_C1_STABILITY_CORRECTNESS_SEPARATION.correctness_required, "the stability gate requires correctness");
  check(!D4_C1_STABILITY_CORRECTNESS_SEPARATION.contrary_rule_frozen_anywhere, "a contrary rule is claimed to be frozen");
  check(D4_C1_REV1_PRESERVED.requalification_calls === 0, "requalification calls are not zero");
  check(!D4_C1_REV1_PRESERVED.scorer_acceptance_region_changed, "the acceptance region changed");
  check(D4_C1_REV1_PRESERVED.architecture_gate === "CLOSED", "the architecture gate is open");
  check(D4_C1_NEXT_ROUND_BOUNDARY.must_stop_after_stability_pass, "the next round may continue past the stability gate");
  check(!D4_C1_REV1_PRESERVED.characteros_production_code_changed, "production code is claimed to have changed");
  if (problems.length > 0) throw new Error(`D4_C1_REV1_NONCONFORMANT: ${problems.join(" ; ")}`);

  const tests = {
    schedule_entries: schedule.length,
    blocks: D4_C1_TARGET_STRUCTURE.blocks,
    each_block_has_each_cell_once: true,
    each_cell_appears_six_times: true,
    target_calls: D4_C1_TARGET_STRUCTURE.target_calls,
    reference_must_be_byte_identical: true,
    requalification_calls: 0,
    stability_calls: 6,
    total_c1_budget: 6 + 24,
    scientific_content_changed: false,
    verification_cost: 0
  };

  const body = {
    version: D4_C1_VERSION_REV1,
    reference_requirement: D4_C1_REFERENCE_REQUIREMENT,
    frozen_c0a_target_hashes: D4_C1_FROZEN_C0A_TARGET_HASHES,
    record_condition_wording: D4_C1_RECORD_CONDITION_WORDING,
    temporal_principle: D4_C1_TEMPORAL_PRINCIPLE,
    target_structure: D4_C1_TARGET_STRUCTURE,
    temporal_balance_claim: D4_C1_TEMPORAL_BALANCE_CLAIM,
    stability_fixture: D4_C1_STABILITY_FIXTURE,
    stability_correctness_separation: D4_C1_STABILITY_CORRECTNESS_SEPARATION,
    preserved: D4_C1_REV1_PRESERVED,
    next_round_boundary: D4_C1_NEXT_ROUND_BOUNDARY,
    schedule,
    supersedes_scope: [
      "the EXPLICIT reference's byte-identity requirement against the frozen C0a target requests",
      "the 24-call target temporal structure (six four-trial blocks) and its frozen ordering"
    ] as const,
    revision_0_manifest_hash_preserved: D4_C1_REVISION_0_MANIFEST_HASH,
    scientific_content_changed: false as const,
    tests
  };
  return Object.freeze({ ...body, manifest_hash: await hashEnvelope(D4_HASH_PROJECTION_V0, body) });
}

/** Exposed so the audit can show the arms the reference is built from. */
export const D4_C1_REFERENCE_ARMS = Object.freeze({
  support_binding: D4C0A_ARMS.ARM_SUPPORT.binding,
  oppose_binding: D4C0A_ARMS.ARM_OPPOSE.binding,
  source_contract: D4_C1_VERSION
});
