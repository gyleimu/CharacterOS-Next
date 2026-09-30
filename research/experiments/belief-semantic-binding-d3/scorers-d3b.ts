/**
 * D3-B — THE THREE FROZEN SCORERS, AS CALLABLE PURE FUNCTIONS.
 *
 * Revision 2 froze every DECISION but left four implementations pending; this file closes three of
 * them (the qualification scorer, the pilot noise classifier, and the target scorer — the fourth, the
 * transformer, lives in transformer-d3b.ts). Each function implements exactly the frozen decision and
 * reads nothing else: no clock, no provider metadata, no D1/D2 output, no human annotation, no
 * threshold that was not frozen.
 *
 * The distinction the D2 experience bought: a scrub of the frozen rules produced 0 missing decisions
 * and 4 pending implementations, and this is where the pending ones are closed — before any call.
 */

import {
  D3B_QUALIFICATION_FIXTURES,
  D3B_QUALIFICATION_RULE,
  D3B_NOISE_RULE,
  D3B_TOKENS,
  D3B_MEASUREMENT_RULE,
  D3B_INPUTS_FROZEN
} from "./contract.ts";
import { D3B_MODAL_COUNT_DEFINITION } from "./contract-rev2-d3b-only.ts";

export interface D3BTrialRecordV0 {
  readonly trial_id: string;
  /** A frozen D3-B relation token, or null for any invalid outcome. */
  readonly relation: string | null;
  /** Which qualification fixture or target call this trial belongs to. */
  readonly group: string;
}

function isLegalRelation(token: string | null): boolean {
  return token !== null && (D3B_TOKENS as readonly string[]).includes(token);
}

/** Counts by relation token, over legal trials only; invalid trials never contribute. */
function countsOf(trials: readonly D3BTrialRecordV0[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const token of D3B_TOKENS) counts[token] = 0;
  for (const trial of trials) {
    if (isLegalRelation(trial.relation)) {
      const key = trial.relation as string;
      counts[key] = (counts[key] ?? 0) + 1;
    }
  }
  return counts;
}

/**
 * The unique modal: the token with a STRICTLY highest count. A tie yields null — never "one of the
 * tied", which is the permissive reading revision 2 forbids.
 */
export function uniqueModalOfV0(counts: Record<string, number>): { modal: string | null; modal_count: number; tie: boolean } {
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const top = ranked[0];
  if (top === undefined || top[1] === 0) return { modal: null, modal_count: 0, tie: false };
  const tie = ranked[1] !== undefined && ranked[1][1] === top[1];
  return { modal: tie ? null : top[0], modal_count: top[1], tie };
}

// =============================================================================================
// 1. THE QUALIFICATION SCORER
// =============================================================================================

export interface D3BQualificationOutcomeV0 {
  readonly instrument_verdict: "D3_B_INSTRUMENT_QUALIFIED" | "D3_B_INSTRUMENT_UNQUALIFIED";
  readonly per_fixture: Readonly<Record<string, { readonly counts: Record<string, number>; readonly modal: string | null; readonly tie: boolean; readonly expected: string; readonly pass: boolean }>>;
  readonly invalid_trials: number;
  readonly invalid_rule_triggered: boolean;
  readonly denominator: number;
  readonly exact_token_match_required: true;
  readonly tolerance_or_similarity_substitution: false;
}

/**
 * Frozen rule: each fixture's modal relation must equal its pre-registered expected relation, exactly,
 * over `replicates_per_fixture` trials; ANY invalid qualification trial fails the instrument.
 */
export function scoreD3BQualificationV0(trials: readonly D3BTrialRecordV0[]): D3BQualificationOutcomeV0 {
  const expectedMap = new Map(D3B_QUALIFICATION_FIXTURES.map((f) => [f.fixture_id, f.expected_relation]));
  const replicates = D3B_QUALIFICATION_RULE.replicates_per_fixture;
  const perFixture: Record<string, { counts: Record<string, number>; modal: string | null; tie: boolean; expected: string; pass: boolean }> = {};
  let invalid = 0;
  let allPass = true;
  for (const fixture of D3B_QUALIFICATION_FIXTURES) {
    const rows = trials.filter((t) => t.group === fixture.fixture_id);
    invalid += rows.filter((t) => !isLegalRelation(t.relation)).length;
    const counts = countsOf(rows);
    const { modal, tie } = uniqueModalOfV0(counts);
    const expected = expectedMap.get(fixture.fixture_id) as string;
    const pass = rows.length === replicates && modal === expected;
    if (!pass) allPass = false;
    perFixture[fixture.fixture_id] = { counts, modal, tie, expected, pass };
  }
  const invalidRuleTriggered = invalid > 0;
  return Object.freeze({
    instrument_verdict: allPass && !invalidRuleTriggered ? "D3_B_INSTRUMENT_QUALIFIED" : "D3_B_INSTRUMENT_UNQUALIFIED",
    per_fixture: Object.freeze(perFixture),
    invalid_trials: invalid,
    invalid_rule_triggered: invalidRuleTriggered,
    denominator: D3B_QUALIFICATION_FIXTURES.length * replicates,
    exact_token_match_required: true as const,
    tolerance_or_similarity_substitution: false as const
  });
}

// =============================================================================================
// 2. THE NOISE CLASSIFIER (implemented and audited now; the pilot is NOT run this round)
// =============================================================================================

export type D3BNoiseOutcomeV0 =
  | { readonly pilot_verdict: "D3_B_NEUTRAL_PILOT_QUALIFIED"; readonly r_confirm_B: 6 | 14; readonly modal: string; readonly modal_count: number; readonly invalid_count: 0 }
  | { readonly pilot_verdict: "D3_B_NEUTRAL_PILOT_QUALIFIED"; readonly r_confirm_B: null; readonly modal: string; readonly modal_count: number; readonly invalid_count: 0; readonly stop_verdict: "INCONCLUSIVE_BY_DECISION_NOISE" }
  | { readonly pilot_verdict: "D3_B_INCONCLUSIVE_BY_PILOT_INVALID_OUTPUTS"; readonly r_confirm_B: null; readonly modal: null; readonly modal_count: null; readonly invalid_count: number }
  | { readonly pilot_verdict: "D3_B_INCONCLUSIVE_BY_MODAL_TIE_UNDEFINED"; readonly r_confirm_B: null; readonly modal: null; readonly modal_count: number; readonly invalid_count: 0 };

export function classifyD3BNoisePilotV0(trials: readonly D3BTrialRecordV0[]): D3BNoiseOutcomeV0 {
  if (trials.length !== D3B_NOISE_RULE.planned_calls) {
    throw new Error(`D3_B_PILOT_DENOMINATOR_VIOLATION: ${trials.length} trials, planned ${D3B_NOISE_RULE.planned_calls}`);
  }
  const invalid = trials.filter((t) => !isLegalRelation(t.relation)).length;
  if (invalid > 0) {
    return Object.freeze({
      pilot_verdict: "D3_B_INCONCLUSIVE_BY_PILOT_INVALID_OUTPUTS" as const,
      r_confirm_B: null,
      modal: null,
      modal_count: null,
      invalid_count: invalid
    });
  }
  const counts = countsOf(trials);
  const { modal, modal_count: modalCount, tie } = uniqueModalOfV0(counts);
  if (tie || modal === null) {
    return Object.freeze({
      pilot_verdict: "D3_B_INCONCLUSIVE_BY_MODAL_TIE_UNDEFINED" as const,
      r_confirm_B: null,
      modal: null,
      modal_count: modalCount,
      invalid_count: 0
    });
  }
  const mapped = (D3B_NOISE_RULE.mapping as Record<string, number | string>)[String(modalCount)];
  if (typeof mapped === "number") {
    if (mapped !== 6 && mapped !== 14) throw new Error(`D3_B_MAPPING_OUT_OF_RANGE: ${mapped}`);
    return Object.freeze({ pilot_verdict: "D3_B_NEUTRAL_PILOT_QUALIFIED" as const, r_confirm_B: mapped, modal, modal_count: modalCount, invalid_count: 0 });
  }
  return Object.freeze({
    pilot_verdict: "D3_B_NEUTRAL_PILOT_QUALIFIED" as const,
    r_confirm_B: null,
    modal,
    modal_count: modalCount,
    invalid_count: 0,
    stop_verdict: "INCONCLUSIVE_BY_DECISION_NOISE" as const
  });
}

// =============================================================================================
// 3. THE TARGET SCORER (implemented and audited now; the target is NOT run this round)
// =============================================================================================

export interface D3BTargetOutcomeV0 {
  readonly outcome_class: "POSITIVE" | "NULL" | "INCONCLUSIVE";
  readonly collection_integrity: boolean;
  readonly collection_integrity_failures: readonly string[];
  readonly invalid_count: number;
  readonly scientific_scoring_executed: boolean;
  readonly counts: Readonly<Record<string, number>> | null;
  readonly verdict: string;
  readonly frozen_combined_statement_if_positive: string | null;
  readonly may_not_reopen_link_4: true;
}

/**
 * Frozen measurement rule: `r_confirm_B` byte-identical target calls; positive requires EVERY trial to
 * return the expected relation. Any invalid → inconclusive, never a null. An integrity failure →
 * inconclusive. A valid non-positive result → the frozen not-established verdict.
 */
export function scoreD3BTargetV0(input: {
  readonly trials: readonly D3BTrialRecordV0[];
  readonly r_confirm_B: number;
}): D3BTargetOutcomeV0 {
  const failures: string[] = [];
  if (input.trials.length !== input.r_confirm_B) failures.push(`records ${input.trials.length} != planned ${input.r_confirm_B}`);
  const ids = input.trials.map((t) => t.trial_id);
  if (ids.length - new Set(ids).size > 0) failures.push("duplicate trial identity");
  if (input.trials.some((t) => t.group !== "D3B_TARGET")) failures.push("a record does not belong to the target group");
  if (failures.length > 0) {
    return Object.freeze({
      outcome_class: "INCONCLUSIVE" as const,
      collection_integrity: false,
      collection_integrity_failures: Object.freeze(failures),
      invalid_count: input.trials.filter((t) => !isLegalRelation(t.relation)).length,
      scientific_scoring_executed: false,
      counts: null,
      verdict: "D3_B_INCONCLUSIVE_BY_COLLECTION_INTEGRITY_FAILURE",
      frozen_combined_statement_if_positive: null,
      may_not_reopen_link_4: true as const
    });
  }
  const invalid = input.trials.filter((t) => !isLegalRelation(t.relation)).length;
  if (invalid > 0) {
    return Object.freeze({
      outcome_class: "INCONCLUSIVE" as const,
      collection_integrity: true,
      collection_integrity_failures: Object.freeze([]),
      invalid_count: invalid,
      scientific_scoring_executed: false,
      counts: null,
      verdict: "D3_B_INCONCLUSIVE_BY_STATE_EXPERIMENT_INVALID_OUTPUTS",
      frozen_combined_statement_if_positive: null,
      may_not_reopen_link_4: true as const
    });
  }
  const counts = countsOf(input.trials);
  const allAligned = input.trials.every((t) => t.relation === D3B_INPUTS_FROZEN.expected_relation);
  const positive = allAligned && input.trials.length === input.r_confirm_B;
  return Object.freeze({
    outcome_class: positive ? ("POSITIVE" as const) : ("NULL" as const),
    collection_integrity: true,
    collection_integrity_failures: Object.freeze([]),
    invalid_count: 0,
    scientific_scoring_executed: true,
    counts: Object.freeze(counts),
    verdict: positive
      ? "PREREGISTERED_PARAPHRASE_RELATION_RECOGNIZED"
      : "PREREGISTERED_PARAPHRASE_RELATION_RECOGNITION_NOT_ESTABLISHED",
    frozen_combined_statement_if_positive: positive
      ? "SEMANTIC_COMPONENT_CAPABILITIES_SEPARATELY_PRESENT_BUT_CROSS_WORDING_STANCE_TRANSFER_NOT_ESTABLISHED"
      : null,
    may_not_reopen_link_4: true as const
  });
}

// =============================================================================================
// 2b. THE STABILITY GATE (REVISION 4 — supersedes the modal_count -> r extension above)
// =============================================================================================

/**
 * REVISION 4 replaces the noise pilot's r-extension rule with a STABILITY GATE.
 *
 * WHY. The superseded rule read `5 -> r_confirm_B = 14`, on the assumption that a noisy endpoint can be
 * handled by buying more trials. That assumption holds for a modal-based confirmation criterion, where
 * extra trials can outvote noise. It does NOT hold for D3-B, whose frozen target scorer requires
 * UNANIMITY over all planned trials: raising r does not absorb noise, it raises the bar. Five agreeing
 * trials out of six is already a failed target run, and fourteen trials demanding fourteen agreements is
 * strictly worse. The old branch was therefore self-defeating, not merely useless.
 *
 * Verdict of the conflict: `D3_B_NOISE_EXTENSION_INCOMPATIBLE_WITH_UNANIMITY_SCORER`.
 *
 * The gate is on STABILITY — whether the six calls agree with EACH OTHER — and deliberately not on the
 * token matching the fixture's pre-registered expected relation. That distinction is the one the D2
 * neutral pilot established: agreement is a property of the executor, correctness is a property of the
 * fixture, and only the former belongs in a noise calibration.
 *
 * `classifyD3BNoisePilotV0` above is retained unchanged as the historical contract; it is SUPERSEDED and
 * must not be used for the noise pilot.
 */
export type D3BNoiseStabilityOutcomeV0 =
  | {
      readonly pilot_verdict: "D3_B_NOISE_STABILITY_GATE_PASS";
      readonly r_confirm_B: 6;
      readonly modal_token: string;
      readonly modal_count: 6;
      readonly unique_modal_tie: false;
      readonly invalid_count: 0;
      readonly target_authorised: true;
    }
  | {
      readonly pilot_verdict: "D3_B_INCONCLUSIVE_BY_INSTRUMENT_SELF_NOISE";
      readonly r_confirm_B: null;
      readonly modal_token: string | null;
      readonly modal_count: number;
      readonly unique_modal_tie: boolean;
      readonly invalid_count: 0;
      readonly target_authorised: false;
    }
  | {
      readonly pilot_verdict: "D3_B_INCONCLUSIVE_BY_NOISE_PILOT_INVALID_OUTPUTS";
      readonly r_confirm_B: null;
      readonly modal_token: null;
      readonly modal_count: null;
      readonly unique_modal_tie: false;
      readonly invalid_count: number;
      readonly target_authorised: false;
    };

export function classifyD3BNoiseStabilityV0(trials: readonly D3BTrialRecordV0[]): D3BNoiseStabilityOutcomeV0 {
  if (trials.length !== D3B_NOISE_RULE.planned_calls) {
    throw new Error(`D3_B_NOISE_DENOMINATOR_VIOLATION: ${trials.length} trials, planned ${D3B_NOISE_RULE.planned_calls}`);
  }
  const invalid = trials.filter((t) => !isLegalRelation(t.relation)).length;
  if (invalid > 0) {
    return Object.freeze({
      pilot_verdict: "D3_B_INCONCLUSIVE_BY_NOISE_PILOT_INVALID_OUTPUTS" as const,
      r_confirm_B: null,
      modal_token: null,
      modal_count: null,
      unique_modal_tie: false,
      invalid_count: invalid,
      target_authorised: false
    });
  }
  const counts = countsOf(trials);
  const { modal, modal_count: modalCount, tie } = uniqueModalOfV0(counts);
  if (modal === null || tie || modalCount !== D3B_NOISE_RULE.planned_calls) {
    return Object.freeze({
      pilot_verdict: "D3_B_INCONCLUSIVE_BY_INSTRUMENT_SELF_NOISE" as const,
      r_confirm_B: null,
      modal_token: modal,
      modal_count: modalCount,
      unique_modal_tie: tie,
      invalid_count: 0,
      target_authorised: false
    });
  }
  return Object.freeze({
    pilot_verdict: "D3_B_NOISE_STABILITY_GATE_PASS" as const,
    r_confirm_B: 6 as const,
    modal_token: modal,
    modal_count: 6 as const,
    unique_modal_tie: false as const,
    invalid_count: 0 as const,
    target_authorised: true as const
  });
}

/** Exposed so an audit can show the frozen rules the scorers implement. */
export const D3B_SCORER_FROZEN_RULES = Object.freeze({
  qualification: D3B_QUALIFICATION_RULE,
  noise: D3B_NOISE_RULE,
  measurement: D3B_MEASUREMENT_RULE,
  modal_count_definition: D3B_MODAL_COUNT_DEFINITION.counted_quantity,
  tie_semantics: D3B_MODAL_COUNT_DEFINITION.tie_at_the_top.verdict
});
