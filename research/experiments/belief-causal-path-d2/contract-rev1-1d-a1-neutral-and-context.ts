/* eslint-disable no-restricted-imports -- Isolated research preregistration over frozen built production roots (repository convention); zero production code changes and no production import of this module. */
/**
 * D2 REVISION 1.1d — A1 NEUTRAL PILOT INVALID HANDLING + A1 PRODUCTION-CONTEXT BINDING.
 * FROZEN. ZERO MODEL CALLS.
 *
 * WHY THIS FILE EXISTS
 *   A 0-call audit of the A1 neutral pilot found that `D2_NOISE_RULE` specifies six byte-identical
 *   requests and the mapping 0..6 -> STOP/STOP/STOP/STOP/STOP/14/6, but never says WHAT is being
 *   counted, and never mentions invalid, malformed, transport, failure, retry or replacement. The
 *   only invalid rule in the contract set is REV1.1c's, scoped to instrument QUALIFICATION, whose
 *   verdict `D2_INSTRUMENT_UNQUALIFIED` is not definable for a pilot whose instrument is qualified.
 *
 *   The ambiguity was material, not pedantic: applying three admissible readings to the same observed
 *   pilot gave, for "five agree + one transport failure", 14 / 14 / STOP; and for "all six invalid",
 *   STOP / 6 / STOP — i.e. a completely failed pilot would authorise a twelve-call treatment run
 *   under one reading. The hole was widest exactly where a failed pilot would authorise an experiment.
 *
 *   The same audit found that A1's production context was bound only by inference: A0 had
 *   `D2A_INSTRUMENT_LAWS.same_projection_path`, A1 has no equivalent field.
 *
 *   This file closes both, and nothing else.
 *
 * SCOPE: exactly two things — the A1 neutral pilot's invalid handling, and an explicit A1
 * production-context binding. It does NOT change the A1 stimulus family: no observation wording
 * change, no probe swap, no new context, no proposition / paraphrase / token / anchor / schema /
 * transformer / prediction / noise-mapping change, and no change to A0, A1 qualification or D1.
 * Old revision hashes are preserved. Nothing here is applied retroactively.
 */

import { hashEnvelope } from "../../../packages/subject-core/dist/index.js";
import type { HashV1 } from "../../../packages/subject-core/dist/index.js";

import {
  D2_HASH_PROJECTION_V0,
  D2_NOISE_RULE,
  D2A1_PREDICTION,
  D2A1_TOKENS
} from "./contract-rev1.ts";
import { D1_P1, D1_PROPOSITION_LABEL, D1_STATE_LEVELS } from "../belief-state-sensitivity-d1/contract.ts";
import { D1_OBSERVATION_ID, D1_SUBJECT_ID } from "../belief-state-sensitivity-d1/world-a1.ts";

export const D2_VERSION_REV1_1D = "belief-causal-path-d2-rev1.1d" as const;

/** The direct predecessor, preserved. */
export const D2_REVISION_1_1C_MANIFEST_HASH =
  "sha256:170a97cea01727b5073ab9253b047f6e571c83638e031b6d4654d8a479f67efa" as const;

// =============================================================================================
// AMENDMENT 1 — A1 NEUTRAL PILOT INVALID POLICY
// =============================================================================================

/** The six planned trial identities, fixed before the first call. */
export const D2A1_NEUTRAL_TRIAL_IDS = Object.freeze([
  "d2-a1-neutral-001",
  "d2-a1-neutral-002",
  "d2-a1-neutral-003",
  "d2-a1-neutral-004",
  "d2-a1-neutral-005",
  "d2-a1-neutral-006"
] as const);

export const D2A1_NEUTRAL_PILOT_INVALID_POLICY = Object.freeze({
  scope: "A1 neutral pilot ONLY",
  planned_trials: 6,
  planned_denominator: 6,
  planned_trial_ids: D2A1_NEUTRAL_TRIAL_IDS,

  one_trial_is_one_attempt: true,
  max_provider_calls_per_scheduled_trial: 1,
  retry_forbidden: true,
  replacement_forbidden: true,
  deletion_forbidden: true,
  extra_replicate_forbidden: true,
  seventh_call_forbidden: true,
  executor_substitution_forbidden: true,

  counts_as_invalid: [
    "transport failure",
    "timeout classified as a failed provider attempt",
    "malformed output",
    "parser invalid",
    "token outside the frozen A1 vocabulary"
  ],
  invalid_trials_are_recorded: true,
  invalid_is_not_a_stance_token: true,
  multiple_invalids_may_not_be_grouped_as_one_modal_category: true,

  /**
   * The mapping is reachable ONLY on a pilot in which every one of the six planned trials produced a
   * legal A1 stance token. This is the sentence whose absence made r ambiguous.
   */
  noise_mapping_precondition: "all 6 scheduled trials produce legal A1 stance tokens",
  valid_required_for_noise_scoring: 6,
  mapping_source: "D2_NOISE_RULE.deterministic_mapping (unchanged)",
  mapping: D2_NOISE_RULE.deterministic_mapping,
  mapping_may_not_be_modified: true,

  on_zero_invalid: {
    compute: "legal token counts, then modal token and modal_count over the 6 valid trials",
    modal_count_6: "r_confirm_A1 = 6",
    modal_count_5: "r_confirm_A1 = 14",
    modal_count_at_most_4: D2_NOISE_RULE.stop_verdict
  },
  on_any_invalid: {
    minimum_invalid_trials_to_trigger: 1,
    verdict: "D2_A1_INCONCLUSIVE_BY_PILOT_INVALID_OUTPUTS",
    r_confirm_A1_computed: false,
    high_low_a1_experiment_may_run: false,
    reason: "the frozen mapping is defined over a complete, fully valid six-trial pilot; a pilot with any invalid trial has no defined modal_count"
  },

  must_guarantee: [
    "six invalid trials can never produce modal_count = 6",
    "a transport failure can never be silently dropped",
    "an invalid trial can never change the denominator",
    "six valid outputs can never be manufactured by re-running"
  ],
  applied_retroactively_to: [] as readonly string[],
  retroactivity: "NONE — A0 qualification, A0 pilot, A0 state experiment and A1 qualification are untouched",
  extends_to_d2b: false,
  d2b_rule_source: "D2-B must use its own authoritative preregistration when it is reached"
});

export type A1NeutralPilotOutcomeV0 =
  | {
      readonly pilot_verdict: "D2_A1_NEUTRAL_PILOT_QUALIFIED";
      readonly valid_count: 6;
      readonly invalid_count: 0;
      readonly counts: Readonly<Record<string, number>>;
      readonly modal_token: string;
      readonly modal_count: 5 | 6;
      readonly r_confirm_A1: 6 | 14;
      readonly noise_verdict: null;
    }
  | {
      readonly pilot_verdict: "D2_A1_NEUTRAL_PILOT_QUALIFIED";
      readonly valid_count: 6;
      readonly invalid_count: 0;
      readonly counts: Readonly<Record<string, number>>;
      readonly modal_token: string;
      readonly modal_count: number;
      readonly r_confirm_A1: null;
      readonly noise_verdict: "INCONCLUSIVE_BY_DECISION_NOISE";
    }
  | {
      readonly pilot_verdict: "D2_A1_INCONCLUSIVE_BY_PILOT_INVALID_OUTPUTS";
      readonly valid_count: number;
      readonly invalid_count: number;
      readonly counts: null;
      readonly modal_token: null;
      readonly modal_count: null;
      readonly r_confirm_A1: null;
      readonly noise_verdict: null;
    };

/**
 * THE frozen decision procedure. The audit calls THIS function on synthetic cases rather than
 * re-implementing it, so the audit cannot pass while the shipped rule disagrees.
 */
export function classifyA1NeutralPilotV0(
  trials: readonly { readonly trial_id: string; readonly parsed_token: string | null }[]
): A1NeutralPilotOutcomeV0 {
  if (trials.length !== D2A1_NEUTRAL_PILOT_INVALID_POLICY.planned_trials) {
    throw new Error(`D2_A1_NEUTRAL_PILOT_DENOMINATOR_VIOLATION: ${trials.length} trials, planned 6`);
  }
  const ids = new Set(trials.map((t) => t.trial_id));
  if (ids.size !== trials.length) throw new Error("D2_A1_NEUTRAL_PILOT_DUPLICATE_TRIAL_IDENTITY");
  const invalid = trials.filter(
    (t) => t.parsed_token === null || !(D2A1_TOKENS as readonly string[]).includes(t.parsed_token)
  );
  if (invalid.length > 0) {
    return {
      pilot_verdict: "D2_A1_INCONCLUSIVE_BY_PILOT_INVALID_OUTPUTS",
      valid_count: trials.length - invalid.length,
      invalid_count: invalid.length,
      counts: null,
      modal_token: null,
      modal_count: null,
      r_confirm_A1: null,
      noise_verdict: null
    };
  }
  const counts: Record<string, number> = {};
  for (const trial of trials) {
    const key = trial.parsed_token as string;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const top = ranked[0] as [string, number];
  const tie = ranked[1] !== undefined && ranked[1][1] === top[1];
  if (tie) throw new Error("D2_A1_NEUTRAL_PILOT_MODAL_TIE_UNDEFINED");
  const modalCount = top[1];
  const mapped = (D2_NOISE_RULE.deterministic_mapping as Record<string, number | string>)[String(modalCount)];
  if (typeof mapped === "number") {
    if (mapped !== 6 && mapped !== 14) throw new Error(`D2_A1_NEUTRAL_PILOT_MAPPING_OUT_OF_RANGE: ${mapped}`);
    return {
      pilot_verdict: "D2_A1_NEUTRAL_PILOT_QUALIFIED",
      valid_count: 6,
      invalid_count: 0,
      counts,
      modal_token: top[0],
      modal_count: modalCount as 5 | 6,
      r_confirm_A1: mapped,
      noise_verdict: null
    };
  }
  return {
    pilot_verdict: "D2_A1_NEUTRAL_PILOT_QUALIFIED",
    valid_count: 6,
    invalid_count: 0,
    counts,
    modal_token: top[0],
    modal_count: modalCount,
    r_confirm_A1: null,
    noise_verdict: "INCONCLUSIVE_BY_DECISION_NOISE"
  };
}

// =============================================================================================
// AMENDMENT 2 — EXPLICIT A1 PRODUCTION-CONTEXT BINDING
// =============================================================================================

/**
 * Every value below is READ from an artifact frozen before this round — the D1 contract, the D1 world
 * builder and the A0 freeze — never re-authored here. The audit re-derives each one and asserts
 * equality against both this binding and the live frozen source, so the binding cannot drift.
 */
export const D2A1_PRODUCTION_CONTEXT_BINDING = Object.freeze({
  binding_rule:
    "the A1 state experiment uses the SAME production context identity as the A0 structural-readout state experiment",

  identity: Object.freeze({
    path_in_state: "/identity/subject_id",
    exact_value: D1_SUBJECT_ID,
    source: "D1 world-a1.ts :: D1_SUBJECT_ID (the D1 controlled trajectory's subject)"
  }),

  observation: Object.freeze({
    probe_id: D1_P1.probe_id,
    exact_observation_id: D1_OBSERVATION_ID,
    exact_observation_bytes: D1_P1.observation_text,
    exact_scene_bytes: D1_P1.observation_text,
    scene_source: "the observation commit's own scene (D1 world-a1.ts:160)",
    committed_observation_identity: D1_OBSERVATION_ID,
    source: "D1 contract.ts :: D1_P1, and D1 world-a1.ts :: D1_OBSERVATION_ID"
  }),

  task: Object.freeze({
    exact_value: null,
    source: "D1 world-a1.ts:160 (the observation commit sets task: null)"
  }),

  environment_current_context: Object.freeze({
    rule: "byte-exact reuse of the A0-frozen production context; the A1 transformer appends a measurement contract and cannot introduce a context",
    verification: "the audit rebuilds the three states offline and asserts byte-identity of the normalised model-facing request against the A0-frozen pristine requests"
  }),

  state_construction: Object.freeze([
    "production genesis materialisation",
    "lawful belief materialisation",
    "production observation lifecycle",
    "production projection",
    "pristine V8 request"
  ]),
  hand_written_subject_data: false,

  experimental_variable: Object.freeze({
    only_scientific_state_variable: "/beliefs/items/0/credence",
    HIGH: D1_STATE_LEVELS.HIGH,
    NEUTRAL: D1_STATE_LEVELS.NEUTRAL_NOISE_CALIBRATION,
    LOW: D1_STATE_LEVELS.LOW,
    derived_bookkeeping_rule: "D1 REVISION 4 normalisation only",
    new_diff_classes_added: false
  }),

  canonical_proposition_label: D1_PROPOSITION_LABEL,

  provenance: Object.freeze({
    a0_results_known_before_context_binding: true,
    context_selection_depended_on_a0_token_pattern: false,
    a1_outputs_seen_before_context_binding: false,
    a1_neutral_calls_before_amendment: 0,
    a1_high_low_calls_before_amendment: 0,
    why_this_context: [
      "D1 P1 is the controlled underdetermined secondhand-information context",
      "A0 and A1 are consecutive links 3A / 3B on the same causal chain",
      "the A1 semantic-transfer construct targets the same CAUTION belief",
      "P1 directly instantiates the antecedent relevant to that proposition"
    ]
  }),

  stimulus_family_unchanged: true,
  observation_wording_changed: false,
  probe_swapped: false,
  new_context_added: false,
  proposition_changed: false,
  paraphrase_changed: false,
  high_low_prediction_changed: false
});

// =============================================================================================
// MECHANICAL SELF-CHECKS + MANIFEST
// =============================================================================================

export interface D2Rev11dManifestV0 {
  readonly version: typeof D2_VERSION_REV1_1D;
  readonly invalid_policy: typeof D2A1_NEUTRAL_PILOT_INVALID_POLICY;
  readonly context_binding: typeof D2A1_PRODUCTION_CONTEXT_BINDING;
  readonly supersedes_scope: readonly string[];
  readonly scientific_prediction_changed: false;
  readonly measurement_contract_changed: false;
  readonly a1_model_calls_before_amendment: 9;
  readonly a1_state_experiment_calls_before_amendment: 0;
  readonly a1_neutral_calls_before_amendment: 0;
  readonly revision_1_1c_manifest_hash_preserved: string;
  readonly tests: Readonly<Record<string, unknown>>;
  readonly manifest_hash: HashV1;
}

export async function deriveD2Rev11dManifestV0(): Promise<D2Rev11dManifestV0> {
  const policy = D2A1_NEUTRAL_PILOT_INVALID_POLICY;
  const problems: string[] = [];
  const check = (condition: boolean, message: string): void => {
    if (!condition) problems.push(message);
  };
  check(policy.planned_trials === 6 && policy.planned_denominator === 6, "planned denominator is not 6");
  check(policy.planned_trial_ids.length === 6, "planned trial identities are not six");
  check(new Set(policy.planned_trial_ids).size === 6, "planned trial identities contain a duplicate");
  check(policy.retry_forbidden && policy.replacement_forbidden && policy.deletion_forbidden, "recovery is not fully forbidden");
  check(policy.extra_replicate_forbidden && policy.seventh_call_forbidden, "recovery is not fully forbidden");
  check(policy.max_provider_calls_per_scheduled_trial === 1, "a scheduled trial may exceed one provider call");
  check(policy.invalid_is_not_a_stance_token, "an invalid trial is treated as a stance token");
  check(policy.valid_required_for_noise_scoring === 6, "the mapping precondition is not six valid trials");
  check(policy.on_any_invalid.r_confirm_A1_computed === false, "an invalid pilot may compute r");
  check(policy.on_any_invalid.high_low_a1_experiment_may_run === false, "an invalid pilot may run the treatment");
  check(policy.mapping["6"] === 6 && policy.mapping["5"] === 14, "the frozen mapping changed");
  check(policy.applied_retroactively_to.length === 0 && policy.extends_to_d2b === false, "the rule claims an out-of-scope application");

  // The procedure itself must refuse r under any invalid, including six invalids.
  const mk = (tokens: readonly (string | null)[]) =>
    tokens.map((t, i) => ({ trial_id: D2A1_NEUTRAL_TRIAL_IDS[i] as string, parsed_token: t }));
  const sixInvalid = classifyA1NeutralPilotV0(mk([null, null, null, null, null, null]));
  check(sixInvalid.r_confirm_A1 === null, "six invalid trials produced an r value");
  const oneInvalid = classifyA1NeutralPilotV0(mk(["UNCERTAIN_ABOUT_PARAPHRASED_PRINCIPLE", "UNCERTAIN_ABOUT_PARAPHRASED_PRINCIPLE", "UNCERTAIN_ABOUT_PARAPHRASED_PRINCIPLE", "UNCERTAIN_ABOUT_PARAPHRASED_PRINCIPLE", "UNCERTAIN_ABOUT_PARAPHRASED_PRINCIPLE", null]));
  check(oneInvalid.pilot_verdict === "D2_A1_INCONCLUSIVE_BY_PILOT_INVALID_OUTPUTS", "one invalid trial did not invalidate the pilot");
  const sixValid = classifyA1NeutralPilotV0(mk(Array.from({ length: 6 }, () => "UNCERTAIN_ABOUT_PARAPHRASED_PRINCIPLE")));
  check(sixValid.r_confirm_A1 === 6, "six identical valid trials did not map to r = 6");
  const outOfVocabulary = classifyA1NeutralPilotV0(mk(["ENDORSES_STRONGLY", "UNCERTAIN_ABOUT_PARAPHRASED_PRINCIPLE", "UNCERTAIN_ABOUT_PARAPHRASED_PRINCIPLE", "UNCERTAIN_ABOUT_PARAPHRASED_PRINCIPLE", "UNCERTAIN_ABOUT_PARAPHRASED_PRINCIPLE", "UNCERTAIN_ABOUT_PARAPHRASED_PRINCIPLE"]));
  check(outOfVocabulary.pilot_verdict === "D2_A1_INCONCLUSIVE_BY_PILOT_INVALID_OUTPUTS", "an out-of-vocabulary token was accepted as valid");
  const context = D2A1_PRODUCTION_CONTEXT_BINDING;
  check(context.observation.exact_observation_id === "observation:o-d1-p1-awaiting-inspection", "the observation id drifted");
  check(context.observation.exact_observation_bytes === D1_P1.observation_text, "the observation bytes drifted");
  check(context.task.exact_value === null, "the task is not null");
  check(context.identity.exact_value === D1_SUBJECT_ID, "the subject identity drifted");
  check(context.experimental_variable.HIGH === 0.8 && context.experimental_variable.LOW === 0.2 && context.experimental_variable.NEUTRAL === 0.5, "arm credences drifted");
  check(context.stimulus_family_unchanged && !context.paraphrase_changed && !context.high_low_prediction_changed, "the amendment claims a stimulus or prediction change");
  check(D2A1_PREDICTION.HIGH_0_80_expected === "SUPPORTS_PARAPHRASED_PRINCIPLE", "the A1 prediction drifted");
  if (problems.length > 0) throw new Error(`D2_REV1_1D_NONCONFORMANT: ${problems.join(" ; ")}`);

  const tests = {
    planned_denominator: policy.planned_denominator,
    trial_ids_fixed_before_the_first_call: policy.planned_trial_ids.length,
    retry_replacement_deletion_extra_all_forbidden: true,
    invalid_is_not_a_stance_token: true,
    six_invalid_yields_r: sixInvalid.r_confirm_A1,
    six_invalid_yielded_verdict: sixInvalid.pilot_verdict,
    one_invalid_yielded_verdict: oneInvalid.pilot_verdict,
    six_valid_yields_r: sixValid.r_confirm_A1,
    out_of_vocabulary_token_treated_as_invalid: outOfVocabulary.pilot_verdict === "D2_A1_INCONCLUSIVE_BY_PILOT_INVALID_OUTPUTS",
    observation_id_matches_frozen_source: true,
    observation_bytes_match_frozen_source: true,
    task_is_null: true,
    subject_identity_matches_frozen_source: true,
    verification_cost: 0
  };

  const body = {
    version: D2_VERSION_REV1_1D,
    invalid_policy: policy,
    context_binding: context,
    supersedes_scope: [
      "A1 neutral pilot invalid handling",
      "A1 production-context explicit binding"
    ] as const,
    scientific_prediction_changed: false as const,
    measurement_contract_changed: false as const,
    a1_model_calls_before_amendment: 9 as const,
    a1_state_experiment_calls_before_amendment: 0 as const,
    a1_neutral_calls_before_amendment: 0 as const,
    revision_1_1c_manifest_hash_preserved: D2_REVISION_1_1C_MANIFEST_HASH,
    tests
  };
  return Object.freeze({ ...body, manifest_hash: await hashEnvelope(D2_HASH_PROJECTION_V0, body) });
}
