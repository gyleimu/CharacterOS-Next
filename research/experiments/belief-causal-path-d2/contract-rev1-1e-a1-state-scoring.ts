/* eslint-disable no-restricted-imports -- Isolated research preregistration over frozen built production roots (repository convention); zero production code changes and no production import of this module. */
/**
 * D2 REVISION 1.1e — A1 TREATMENT RECOVERY/INVALID POLICY + EXECUTABLE SCORER. FROZEN. 0 MODEL CALLS.
 *
 * WHY THIS FILE EXISTS
 *   The A1 state experiment stopped at its own gates. §0A passed — the scorer was already
 *   preregistered in `D2A1_PREDICTION` — but §0B failed: no rule anywhere covered the A1 HIGH/LOW
 *   treatment, because REV1.1c's invalid rule is qualification-scoped and REV1.1d's scope field reads
 *   "A1 neutral pilot ONLY". Rules covering the treatment: 0.
 *
 *   Two things are frozen here, and nothing else:
 *     1. the treatment's recovery and invalid policy;
 *     2. an EXECUTABLE pure-function form of the already-frozen scorer, so the next audit can call the
 *        frozen procedure instead of re-implementing it (the REV1.1d pattern).
 *
 *   No scientific quantity is touched: requests, schedule, prediction, paraphrase, tokens, anchors,
 *   transformer, r_confirm, the positive criterion and the null localisation row are all unchanged.
 *
 * THE ONE DISTINCTION THIS FILE EXISTS TO PROTECT
 *   NULL != INCONCLUSIVE. A provider or parser failure is not evidence about semantic transfer. If any
 *   scheduled trial is invalid, the experiment is INCONCLUSIVE and no scientific modal scoring happens
 *   at all — it may not be reported as a semantic-transfer null, and it may not be repaired by
 *   re-running anything.
 */

import { hashEnvelope } from "../../../packages/subject-core/dist/index.js";
import type { HashV1 } from "../../../packages/subject-core/dist/index.js";

import {
  D2_HASH_PROJECTION_V0,
  D2_LOCALIZATION_MATRIX_REV1,
  D2A1_PREDICTION,
  D2A1_TOKENS,
  type D2A1Token
} from "./contract-rev1.ts";

export const D2_VERSION_REV1_1E = "belief-causal-path-d2-rev1.1e" as const;

export const D2_REVISION_1_1D_MANIFEST_HASH =
  "sha256:24e5707ad31d7381e5db6c420f7607e80e3606c10c351560853a0cd5e0e4207b" as const;

// =============================================================================================
// AMENDMENT 1 — A1 TREATMENT RECOVERY / INVALID POLICY
// =============================================================================================

/**
 * The 12 scheduled identities, derived from the same outcome-blind rule the frozen schedule artifact
 * used (pairs alternate HIGH,LOW then LOW,HIGH; a pure function of r = 6 alone). The audit asserts
 * these equal the frozen schedule artifact byte-for-byte, so the contract cannot drift from it.
 */
export function a1StateArmForPositionV0(position: number): "HIGH" | "LOW" {
  const pairIndex = Math.floor((position - 1) / 2);
  const isFirstOfPair = (position - 1) % 2 === 0;
  const firstArm = pairIndex % 2 === 0 ? "HIGH" : "LOW";
  if (isFirstOfPair) return firstArm;
  return firstArm === "HIGH" ? "LOW" : "HIGH";
}

export const D2A1_STATE_SCHEDULE_IDENTITIES: readonly { readonly position: number; readonly trial_id: string; readonly arm: "HIGH" | "LOW" }[] =
  Object.freeze(
    Array.from({ length: 12 }, (_unused, index) => {
      const position = index + 1;
      return Object.freeze({
        position,
        trial_id: `d2-a1-state-${String(position).padStart(3, "0")}`,
        arm: a1StateArmForPositionV0(position)
      });
    })
  );

export const D2A1_TREATMENT_RECOVERY_POLICY = Object.freeze({
  scope: "A1 HIGH/LOW state experiment ONLY",
  planned_trials: 12,
  planned_denominator: 12,
  high_planned: 6,
  low_planned: 6,
  trial_identities_fixed_by: "the frozen A1 schedule artifact, mirrored by D2A1_STATE_SCHEDULE_IDENTITIES",

  one_trial_is_one_attempt: true,
  max_provider_attempts_per_scheduled_trial: 1,
  retry_forbidden: true,
  replacement_forbidden: true,
  deletion_forbidden: true,
  extra_replicate_forbidden: true,
  thirteenth_call_forbidden: true,
  executor_fallback_forbidden: true,
  moving_a_failed_trial_to_the_end_forbidden: true,
  replacing_an_invalid_output_with_a_later_valid_output_forbidden: true,
  denominator_comes_from_the_planned_sample: true,

  counts_as_invalid: [
    "transport failure",
    "timeout classified as a failed provider attempt",
    "malformed output",
    "parser invalid",
    "parsed token outside the frozen A1 stance vocabulary",
    "missing provider result for a scheduled attempted trial"
  ],
  invalid_is_not_a_stance_token: true,
  invalid_does_not_enter_the_modal_count: true,
  invalid_may_not_be_deleted_replaced_or_retried: true,

  on_any_invalid: {
    minimum_invalid_trials_to_trigger: 1,
    verdict: "D2_A1_INCONCLUSIVE_BY_STATE_EXPERIMENT_INVALID_OUTPUTS",
    outcome_class: "INCONCLUSIVE",
    scientific_positive: false,
    scientific_null: false,
    high_modal_scientific_scoring_executed: false,
    low_modal_scientific_scoring_executed: false,
    d2_b_authorised: false,
    replacement_calls: 0,
    rationale:
      "a provider or format failure is not evidence about semantic transfer; reporting it as a semantic-transfer null would be a category error"
  },
  on_zero_invalid: "all twelve trials transport-valid, parser-valid and token-legal — only then may the frozen scorer run",
  applied_retroactively_to: [] as readonly string[],
  reuse_from_the_pilot_policy: false,
  rationale_for_a_separate_rule:
    "REV1.1d scopes its policy to the neutral pilot, so the treatment needed its own; this is the rule that was missing"
});

// =============================================================================================
// AMENDMENT 2 — THE EXECUTABLE SCORER
// =============================================================================================

export interface A1StateRecordV0 {
  readonly trial_id: string;
  readonly arm: "HIGH" | "LOW";
  /** A frozen A1 stance token, or null for any invalid outcome. */
  readonly parsed_stance_token: string | null;
}

export type A1StateOutcomeClassV0 = "POSITIVE" | "NULL" | "INCONCLUSIVE";

export interface A1StateExperimentOutcomeV0 {
  readonly outcome_class: A1StateOutcomeClassV0;
  readonly collection_integrity: boolean;
  readonly collection_integrity_failures: readonly string[];
  readonly invalid_count: number;
  readonly scientific_scoring_executed: boolean;
  readonly high_counts: Readonly<Record<string, number>> | null;
  readonly low_counts: Readonly<Record<string, number>> | null;
  readonly high_unique_modal: string | null;
  readonly low_unique_modal: string | null;
  readonly high_modal_tie: boolean;
  readonly low_modal_tie: boolean;
  readonly positive_predicate: boolean | null;
  readonly verdict: string;
  readonly d2_b_authorised: boolean;
  readonly claim_scope_note: string;
}

const POSITIVE_VERDICT = "CANONICAL_BELIEF_PROPOSITION_SEMANTICALLY_LEGIBLE_ON_PREREGISTERED_PARAPHRASE";

/** Unique modal = the token with a STRICTLY highest count. A tie yields null, never "one of the tied". */
function uniqueModalOf(counts: Record<string, number>): { modal: string | null; tie: boolean } {
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const top = ranked[0];
  if (top === undefined) return { modal: null, tie: false };
  const tie = ranked.length > 1 && ranked[1] !== undefined && ranked[1][1] === top[1];
  return { modal: tie ? null : top[0], tie };
}

/**
 * THE frozen decision procedure for the A1 state experiment. The audit calls THIS function on
 * synthetic datasets, so the audit cannot pass while the shipped scorer disagrees.
 *
 * It reads only: the supplied records, the frozen A1 token vocabulary, the frozen A1 prediction, and
 * the frozen schedule identities. It never reads the clock, provider metadata, the A0 output pattern,
 * the neutral modal identity, human annotations, any threshold, or mutable global state.
 */
export function classifyA1StateExperimentV0(
  input: {
    readonly records: readonly A1StateRecordV0[];
    /** Optional: the frozen schedule. If supplied it must equal D2A1_STATE_SCHEDULE_IDENTITIES. */
    readonly schedule?: readonly { readonly position: number; readonly trial_id: string; readonly arm: "HIGH" | "LOW" }[];
  }
): A1StateExperimentOutcomeV0 {
  const failures: string[] = [];
  const records = input.records;

  if (input.schedule !== undefined) {
    const matches =
      input.schedule.length === D2A1_STATE_SCHEDULE_IDENTITIES.length &&
      input.schedule.every((entry, index) => {
        const frozen = D2A1_STATE_SCHEDULE_IDENTITIES[index];
        return frozen !== undefined && entry.position === frozen.position && entry.trial_id === frozen.trial_id && entry.arm === frozen.arm;
      });
    if (!matches) failures.push("the supplied schedule is not the frozen schedule");
  }
  if (records.length !== D2A1_TREATMENT_RECOVERY_POLICY.planned_trials) {
    failures.push(`records ${records.length} != planned 12`);
  }
  const ids = records.map((r) => r.trial_id);
  const duplicateCount = ids.length - new Set(ids).size;
  if (duplicateCount > 0) failures.push(`${duplicateCount} duplicate trial identity`);
  const expectedIds = new Set(D2A1_STATE_SCHEDULE_IDENTITIES.map((e) => e.trial_id));
  const actualIds = new Set(ids);
  const missing = [...expectedIds].filter((id) => !actualIds.has(id));
  const extra = [...actualIds].filter((id) => !expectedIds.has(id));
  if (missing.length > 0) failures.push(`missing trial identity: ${missing.join(",")}`);
  if (extra.length > 0) failures.push(`extra trial identity: ${extra.join(",")}`);
  for (const record of records) {
    const frozen = D2A1_STATE_SCHEDULE_IDENTITIES.find((e) => e.trial_id === record.trial_id);
    if (frozen !== undefined && frozen.arm !== record.arm) {
      failures.push(`arm mismatch for ${record.trial_id}: ${record.arm} != ${frozen.arm}`);
    }
  }
  const highCount = records.filter((r) => r.arm === "HIGH").length;
  const lowCount = records.filter((r) => r.arm === "LOW").length;
  if (highCount !== 6) failures.push(`HIGH records ${highCount} != 6`);
  if (lowCount !== 6) failures.push(`LOW records ${lowCount} != 6`);

  if (failures.length > 0) {
    return Object.freeze({
      outcome_class: "INCONCLUSIVE" as const,
      collection_integrity: false,
      collection_integrity_failures: Object.freeze(failures),
      invalid_count: records.filter((r) => !isLegalToken(r.parsed_stance_token)).length,
      scientific_scoring_executed: false,
      high_counts: null,
      low_counts: null,
      high_unique_modal: null,
      low_unique_modal: null,
      high_modal_tie: false,
      low_modal_tie: false,
      positive_predicate: null,
      verdict: "D2_A1_INCONCLUSIVE_BY_COLLECTION_INTEGRITY_FAILURE",
      d2_b_authorised: false,
      claim_scope_note: "no scientific scoring was performed"
    });
  }

  const invalid = records.filter((r) => !isLegalToken(r.parsed_stance_token));
  if (invalid.length > 0) {
    return Object.freeze({
      outcome_class: "INCONCLUSIVE" as const,
      collection_integrity: true,
      collection_integrity_failures: Object.freeze([]),
      invalid_count: invalid.length,
      scientific_scoring_executed: false,
      high_counts: null,
      low_counts: null,
      high_unique_modal: null,
      low_unique_modal: null,
      high_modal_tie: false,
      low_modal_tie: false,
      positive_predicate: null,
      verdict: "D2_A1_INCONCLUSIVE_BY_STATE_EXPERIMENT_INVALID_OUTPUTS",
      d2_b_authorised: false,
      claim_scope_note:
        "a provider or parser failure is not evidence about semantic transfer; the experiment is inconclusive, not null"
    });
  }

  const countsFor = (arm: "HIGH" | "LOW"): Record<string, number> => {
    const counts: Record<string, number> = {};
    for (const token of D2A1_TOKENS) counts[token] = 0;
    for (const record of records.filter((r) => r.arm === arm)) {
      const key = record.parsed_stance_token as string;
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  };
  const highCounts = countsFor("HIGH");
  const lowCounts = countsFor("LOW");
  const high = uniqueModalOf(highCounts);
  const low = uniqueModalOf(lowCounts);
  // Widened so all three frozen conjuncts can be evaluated, including the third one TS would
  // otherwise consider unreachable after the first two narrow the literal types.
  const highModal: string | null = high.modal;
  const lowModal: string | null = low.modal;
  // The frozen criterion is three conjuncts, so all three are evaluated. The third is computed as a
  // standalone boolean first: it is implied by the first two, but the frozen text states it and this
  // file encodes the frozen text rather than a shortened equivalent.
  const modalsDiffer = highModal !== lowModal;
  const positive =
    highModal === D2A1_PREDICTION.HIGH_0_80_expected &&
    lowModal === D2A1_PREDICTION.LOW_0_20_expected &&
    modalsDiffer;

  return Object.freeze({
    outcome_class: positive ? ("POSITIVE" as const) : ("NULL" as const),
    collection_integrity: true,
    collection_integrity_failures: Object.freeze([]),
    invalid_count: 0,
    scientific_scoring_executed: true,
    high_counts: Object.freeze(highCounts),
    low_counts: Object.freeze(lowCounts),
    high_unique_modal: high.modal,
    low_unique_modal: low.modal,
    high_modal_tie: high.tie,
    low_modal_tie: low.tie,
    positive_predicate: positive,
    verdict: positive ? POSITIVE_VERDICT : D2_LOCALIZATION_MATRIX_REV1.A0_positive_A1_null.verdict,
    d2_b_authorised: positive,
    claim_scope_note: positive
      ? "canonical belief stance survives a preregistered near-semantic paraphrase transformation at the measurement layer"
      : "semantic uptake was not established on the preregistered near-semantic-transfer paraphrase"
  });
}

function isLegalToken(token: string | null): token is D2A1Token {
  return token !== null && (D2A1_TOKENS as readonly string[]).includes(token);
}

// =============================================================================================
// MECHANICAL SELF-CHECKS + MANIFEST
// =============================================================================================

export interface D2Rev11eManifestV0 {
  readonly version: typeof D2_VERSION_REV1_1E;
  readonly recovery_policy: typeof D2A1_TREATMENT_RECOVERY_POLICY;
  readonly schedule_identities: typeof D2A1_STATE_SCHEDULE_IDENTITIES;
  readonly positive_verdict: string;
  readonly null_verdict: string;
  readonly inconclusive_verdicts: readonly string[];
  readonly supersedes_scope: readonly string[];
  readonly model_calls_before_amendment_for_a1_treatment: 0;
  readonly a1_state_outputs_seen_before_amendment: false;
  readonly a1_requests_modified: false;
  readonly a1_schedule_modified: false;
  readonly a1_prediction_modified: false;
  readonly scientific_positive_criterion_changed: false;
  readonly null_localization_changed: false;
  readonly revision_1_1d_manifest_hash_preserved: string;
  readonly tests: Readonly<Record<string, unknown>>;
  readonly manifest_hash: HashV1;
}

export async function deriveD2Rev11eManifestV0(): Promise<D2Rev11eManifestV0> {
  const problems: string[] = [];
  const check = (condition: boolean, message: string): void => {
    if (!condition) problems.push(message);
  };
  const policy = D2A1_TREATMENT_RECOVERY_POLICY;
  check(policy.planned_trials === 12 && policy.planned_denominator === 12, "planned denominator is not 12");
  check(policy.high_planned === 6 && policy.low_planned === 6, "the arm split is not 6/6");
  check(policy.max_provider_attempts_per_scheduled_trial === 1, "a scheduled trial may exceed one attempt");
  check(policy.retry_forbidden && policy.replacement_forbidden && policy.deletion_forbidden, "recovery is not fully forbidden");
  check(policy.thirteenth_call_forbidden && policy.executor_fallback_forbidden, "recovery is not fully forbidden");
  check(policy.invalid_is_not_a_stance_token && policy.invalid_does_not_enter_the_modal_count, "an invalid trial enters the modal count");
  check(policy.on_any_invalid.scientific_null === false && policy.on_any_invalid.scientific_positive === false, "an invalid run claims a scientific outcome");
  check(policy.on_any_invalid.d2_b_authorised === false, "an invalid run authorises B");
  check(policy.applied_retroactively_to.length === 0, "the rule claims retroactive application");
  check(D2A1_STATE_SCHEDULE_IDENTITIES.length === 12, "the frozen schedule identities are not twelve");
  check(new Set(D2A1_STATE_SCHEDULE_IDENTITIES.map((e) => e.trial_id)).size === 12, "the frozen schedule identities contain a duplicate");

  const mk = (high: readonly (string | null)[], low: readonly (string | null)[]): A1StateRecordV0[] => {
    const highIds = D2A1_STATE_SCHEDULE_IDENTITIES.filter((e) => e.arm === "HIGH");
    const lowIds = D2A1_STATE_SCHEDULE_IDENTITIES.filter((e) => e.arm === "LOW");
    return [
      ...high.map((token, index) => ({ trial_id: highIds[index]?.trial_id as string, arm: "HIGH" as const, parsed_stance_token: token })),
      ...low.map((token, index) => ({ trial_id: lowIds[index]?.trial_id as string, arm: "LOW" as const, parsed_stance_token: token }))
    ];
  };
  const S = "SUPPORTS_PARAPHRASED_PRINCIPLE";
  const U = "UNCERTAIN_ABOUT_PARAPHRASED_PRINCIPLE";
  const O = "OPPOSES_PARAPHRASED_PRINCIPLE";

  const perfect = classifyA1StateExperimentV0({ records: mk([S, S, S, S, S, S], [O, O, O, O, O, O]) });
  check(perfect.outcome_class === "POSITIVE" && perfect.d2_b_authorised, "the perfect predicted case is not positive");
  const sameToken = classifyA1StateExperimentV0({ records: mk([S, S, S, S, S, S], [S, S, S, S, S, S]) });
  check(sameToken.outcome_class === "NULL" && !sameToken.d2_b_authorised, "the same-token case is not a null");
  const reversed = classifyA1StateExperimentV0({ records: mk([O, O, O, O, O, O], [S, S, S, S, S, S]) });
  check(reversed.outcome_class === "NULL", "the reversed case is not a null");
  const tie = classifyA1StateExperimentV0({ records: mk([S, S, S, U, U, U], [O, O, O, O, O, O]) });
  check(tie.outcome_class === "NULL" && tie.high_unique_modal === null && tie.high_modal_tie, "the HIGH tie is not a valid null with a null modal");
  const oneInvalid = classifyA1StateExperimentV0({ records: mk([S, S, S, S, S, null], [O, O, O, O, O, O]) });
  check(oneInvalid.verdict === "D2_A1_INCONCLUSIVE_BY_STATE_EXPERIMENT_INVALID_OUTPUTS", "one invalid trial did not make the run inconclusive");
  check(oneInvalid.scientific_scoring_executed === false && oneInvalid.outcome_class === "INCONCLUSIVE", "an inconclusive run performed scientific scoring");
  const allInvalid = classifyA1StateExperimentV0({ records: mk([null, null, null, null, null, null], [null, null, null, null, null, null]) });
  check(allInvalid.verdict === "D2_A1_INCONCLUSIVE_BY_STATE_EXPERIMENT_INVALID_OUTPUTS", "an all-invalid run is not inconclusive");
  const duplicate = classifyA1StateExperimentV0({
    records: mk([S, S, S, S, S, S], [O, O, O, O, O, O]).map((r, i) => (i === 1 ? { ...r, trial_id: "d2-a1-state-001" } : r))
  });
  check(duplicate.verdict === "D2_A1_INCONCLUSIVE_BY_COLLECTION_INTEGRITY_FAILURE", "a duplicate identity was not caught");
  check(duplicate.outcome_class === "INCONCLUSIVE", "an integrity failure is not inconclusive");
  const missing = classifyA1StateExperimentV0({ records: mk([S, S, S, S, S, S], [O, O, O, O, O, O]).slice(0, 11) });
  check(missing.verdict === "D2_A1_INCONCLUSIVE_BY_COLLECTION_INTEGRITY_FAILURE", "a missing identity was not caught");
  const outOfVocabulary = classifyA1StateExperimentV0({ records: mk([S, S, S, S, S, "ENDORSES_STRONGLY"], [O, O, O, O, O, O]) });
  check(outOfVocabulary.verdict === "D2_A1_INCONCLUSIVE_BY_STATE_EXPERIMENT_INVALID_OUTPUTS", "an out-of-vocabulary token was treated as legal");
  const noThresholds = [perfect, sameToken, reversed, tie, oneInvalid, allInvalid, duplicate, missing, outOfVocabulary];
  check(noThresholds.every((o) => o.verdict !== undefined), "an outcome has no verdict");
  if (problems.length > 0) throw new Error(`D2_REV1_1E_NONCONFORMANT: ${problems.join(" ; ")}`);

  const tests = {
    planned_denominator: 12,
    arm_split: "6 HIGH / 6 LOW",
    perfect_predicted_case: perfect.outcome_class,
    perfect_predicted_case_b_authorised: perfect.d2_b_authorised,
    same_token_case: sameToken.outcome_class,
    reversed_case: reversed.outcome_class,
    high_tie_case: `${tie.outcome_class} (unique modal ${String(tie.high_unique_modal)})`,
    one_invalid_case: oneInvalid.verdict,
    six_invalid_case: allInvalid.verdict,
    duplicate_identity_case: duplicate.verdict,
    scheme_missing_identity_case: missing.verdict,
    out_of_vocabulary_case: outOfVocabulary.verdict,
    null_is_distinct_from_inconclusive: true,
    no_threshold_added: true,
    verification_cost: 0
  };

  const body = {
    version: D2_VERSION_REV1_1E,
    recovery_policy: policy,
    schedule_identities: D2A1_STATE_SCHEDULE_IDENTITIES,
    positive_verdict: POSITIVE_VERDICT,
    null_verdict: D2_LOCALIZATION_MATRIX_REV1.A0_positive_A1_null.verdict,
    inconclusive_verdicts: [
      "D2_A1_INCONCLUSIVE_BY_COLLECTION_INTEGRITY_FAILURE",
      "D2_A1_INCONCLUSIVE_BY_STATE_EXPERIMENT_INVALID_OUTPUTS"
    ] as const,
    supersedes_scope: [
      "A1 state-experiment invalid/recovery policy",
      "executable operationalization of existing A1 scorer"
    ] as const,
    model_calls_before_amendment_for_a1_treatment: 0 as const,
    a1_state_outputs_seen_before_amendment: false as const,
    a1_requests_modified: false as const,
    a1_schedule_modified: false as const,
    a1_prediction_modified: false as const,
    scientific_positive_criterion_changed: false as const,
    null_localization_changed: false as const,
    revision_1_1d_manifest_hash_preserved: D2_REVISION_1_1D_MANIFEST_HASH,
    tests
  };
  return Object.freeze({ ...body, manifest_hash: await hashEnvelope(D2_HASH_PROJECTION_V0, body) });
}
