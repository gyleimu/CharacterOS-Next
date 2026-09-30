/* eslint-disable no-restricted-imports -- Isolated research preregistration over frozen built production roots (repository convention); zero production code changes and no production import of this module. */
/**
 * D4-C0a — STATE-BLIND EXPLICIT-STANCE COMPOSITION BASELINE. FROZEN PREREGISTRATION. NOT RUN.
 * ZERO MODEL CALLS. ZERO PRODUCTION CHANGES.
 *
 * THE ONE QUESTION
 *   With CharacterOS entirely absent, and with proposition A, a semantically aligned proposition B, the
 *   relation between them, and the subject's stance toward A all supplied EXPLICITLY, can the frozen
 *   executor project that stance onto B?
 *
 *       stance(A) + aligned(A,B) -> stance(B)
 *
 *   This is EXECUTOR_STATE_BLIND_CAPABILITY. It is not CharacterOS causal evidence, and no result of it
 *   can be read as a statement about CharacterOS.
 *
 * WHY IT IS THE RIGHT NEXT CALL
 *   D2-A0 established credence -> canonical proposition stance. D3-B established canonical/paraphrase
 *   relation recognition. D2-A1's cross-wording transfer is a valid null. What no existing evidence
 *   answers is whether this executor can perform the composition AT ALL when everything it needs is
 *   handed to it. If it cannot, the A1 null is at least largely an executor-level limitation and
 *   CharacterOS representation must not be blamed — so this experiment exists mainly to test whether
 *   H_EXEC_COMPOSITION alone explains the A1 null.
 *
 * WHAT IS DELIBERATELY NOT HERE: C0b is NOT preregistered (see D4_C0B_NOT_PREREGISTERED below).
 */

import { hashEnvelope } from "../../../packages/subject-core/dist/index.js";
import type { HashV1 } from "../../../packages/subject-core/dist/index.js";

export const D4_VERSION = "belief-cross-expression-composition-d4" as const;
export const D4_HASH_PROJECTION_V0 = "characteros-next/research/d4-cross-expression-composition/v1" as const;

// =============================================================================================
// 1. FROZEN INPUTS CARRIED FORWARD
// =============================================================================================

export const D4_FROZEN_HANDOFF = Object.freeze({
  d1_d2_d3_closure: "BELIEF_CAUSAL_PATH_D1_D2_D3_EVIDENCE_FROZEN",
  link_3b_localization: "LINK_3B_LOCALIZATION_COMPLETE",
  link_4: "LINK_4_REMAINS_LOCKED",
  d2_a0: "CANONICAL_PROPOSITION_STANCE_BINDING_ESTABLISHED",
  d3_b: "PREREGISTERED_PARAPHRASE_RELATION_RECOGNIZED",
  d2_a1: "CROSS_WORDING_STANCE_TRANSFER_NOT_ESTABLISHED_ON_PREREGISTERED_PARAPHRASE",
  characteros_causal_evidence_from_d4_c0a: false,
  link_4_reopened_by_this_line: false,
  characteros_modified: false
});

/** The frozen pair, reused to minimise new stimulus freedom. The relation is an INPUT, not a task. */
export const D4C0A_PROPOSITION_A =
  "Caution is warranted when the conclusion rests on information I have not seen myself." as const;
export const D4C0A_PROPOSITION_B =
  "the view that a finding depending mainly on secondhand report is to be held with reserve" as const;

// =============================================================================================
// 2. COMPETING EXPLANATIONS
// =============================================================================================

export const D4_COMPETING_EXPLANATIONS = Object.freeze({
  retained: [
    {
      id: "H_CHAR_BINDING",
      claim: "CharacterOS's state/proposition representation or executor-facing binding prevents the stance from being usable across a wording change",
      status_after_c0a: "not decided by C0a; C0a can only remove it from being the SOLE explanation"
    },
    {
      id: "H_EXEC_COMPOSITION",
      claim: "the executor does not stably perform stance(A) + aligned(A,B) -> stance(B) even when every required fact is supplied explicitly",
      status_after_c0a: "this is what C0a primarily tests"
    },
    {
      id: "H_MEASUREMENT_FRAME",
      claim: "the frozen A1 measurement framing induced a lexical / local-wording interpretation of the task",
      status_after_c0a: "partially separable: C0a removes the A1 framing entirely, so a C0a positive makes a framing-only account of A1 less sufficient on its own"
    }
  ],
  c0a_primary_target: "H_EXEC_COMPOSITION",
  projection_information_loss_wording_allowed: "projection information-loss hypothesis strongly weakened",
  projection_information_loss_wording_forbidden: [
    "projection/interface hypothesis eliminated",
    "projection is not the problem"
  ],
  why_not_eliminated:
    "the production projection copies the three belief fields unchanged, which weakens the information-loss account; but executor-facing framing, placement and surrounding instructions remain an open interface hypothesis that C0a does not touch"
});

// =============================================================================================
// 3. THE REQUEST — STATE-BLIND BY CONSTRUCTION
// =============================================================================================

/**
 * THE BASE IS A DELIBERATE DEPARTURE FROM THE D2/D3 CONVENTION, AND IT IS FROZEN HERE.
 * D2/D3 transformers took a pristine PRODUCTION request because those instruments measured production
 * reading. C0a's construct requires the production frame to be ABSENT, so its base is a frozen minimal
 * research frame carrying no CharacterOS material of any kind.
 */
export const D4C0A_BASE_SYSTEM_TEXT: string = [
  "[D4-C0A MEASUREMENT TASK — research instrument; this is not a production conversation]",
  "You are answering a measurement question about a SUBJECT's epistemic stance.",
  "The user message states: proposition A, proposition B, the relation between A and B, and the subject's",
  "stance toward A. Report the subject's stance toward proposition B.",
  "Output EXACTLY ONE JSON object and nothing else. No prose, no code fences."
].join("\n");

export const D4C0A_FORBIDDEN_IN_THE_REQUEST: readonly string[] = Object.freeze([
  "the string CharacterOS",
  "any canonical state",
  "the belief block header",
  "proposition_id",
  "a credence value",
  "production system state",
  "an observation",
  "the D1 or A1 task text",
  "HIGH or LOW",
  "any A1 output",
  "any D2 or D3 verdict"
]);

export const D4C0A_FORBIDDEN_SUBSTRINGS: readonly string[] = Object.freeze([
  "CharacterOS",
  "characteros",
  "[SUBJECTIVE BELIEF STANCES",
  "proposition_id",
  "credence",
  "projection_hash",
  "belief-prop-v0-",
  "HIGH",
  "LOW",
  "ENDORSES_",
  "DOUBTS_",
  "SUPPORTS_PARAPHRASED",
  "OPPOSES_PARAPHRASED",
  "UNCERTAIN_ABOUT_PARAPHRASED"
]);

// =============================================================================================
// 4. OUTPUT VOCABULARY AND THE CONTRACT
// =============================================================================================

export const D4C0A_TOKENS = Object.freeze(["SUPPORTS_B", "UNCERTAIN_B", "OPPOSES_B"] as const);
export type D4C0AToken = (typeof D4C0A_TOKENS)[number];

/**
 * Anchors. Each defines the token as the SUBJECT's stance toward B, and explicitly excludes the four
 * things it is not: the relation between A and B, the truth of B, the model's own opinion, and
 * confidence in the relation.
 */
export const D4C0A_ANCHORS = Object.freeze({
  SUPPORTS_B: "the subject treats proposition B as correct and would rely on it",
  UNCERTAIN_B: "the subject holds no settled position on proposition B",
  OPPOSES_B: "the subject treats proposition B as incorrect and would rely on its denial"
});

export const D4C0A_READOUT_SCHEMA_VERSION = "d4-c0a-stance-transfer-readout-v0" as const;

/**
 * The measurement contract. It removes A1's two competing framings: it never says the stance belongs to
 * a particular wording, and it never says the stance should be copied. It states only where the stance
 * belongs (the underlying view A expresses), what the relation input means, and what to report.
 */
export const D4C0A_CONTRACT_TEXT: string = [
  "",
  "--- D4-C0A STANCE TRANSFER CONTRACT (research instrument; binding for THIS invocation) ---",
  "The output-format rules above are SUPERSEDED for this invocation. Nothing else changes.",
  "Respond with EXACTLY ONE JSON object and nothing else. No prose, no code fences.",
  "READ CAREFULLY:",
  "  - the subject's stated stance belongs to the UNDERLYING VIEW that proposition A expresses;",
  "  - the RELATION line states how proposition B stands to that view. When it says the two express the",
  "    same view, B expresses that same underlying view;",
  "  - report the SUBJECT's stance toward proposition B.",
  "Report the SUBJECT's stance toward B — not the relation between A and B, not whether B is true, not",
  "your own opinion, and not your confidence in the relation.",
  "Required members:",
  `  "d4_c0a_schema_version": "${D4C0A_READOUT_SCHEMA_VERSION}"`,
  '  "stance_toward_b": one of "SUPPORTS_B" | "UNCERTAIN_B" | "OPPOSES_B"',
  "Token meanings (binding):",
  `  SUPPORTS_B — ${D4C0A_ANCHORS.SUPPORTS_B}`,
  `  UNCERTAIN_B — ${D4C0A_ANCHORS.UNCERTAIN_B}`,
  `  OPPOSES_B — ${D4C0A_ANCHORS.OPPOSES_B}`,
  "--- END D4-C0A STANCE TRANSFER CONTRACT ---"
].join("\n");

export const D4C0A_JSON_SCHEMA: Readonly<Record<string, unknown>> = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["d4_c0a_schema_version", "stance_toward_b"],
  properties: {
    d4_c0a_schema_version: { const: D4C0A_READOUT_SCHEMA_VERSION },
    stance_toward_b: { enum: [...D4C0A_TOKENS] },
    explanation: { type: "string", minLength: 1, maxLength: 240 }
  }
});

/** The contract must not contain the forbidden framings, and must not state any expected token. */
export const D4C0A_CONTRACT_LAWS = Object.freeze({
  must_not_contain: [
    "may be worded differently",
    "may word the same idea differently",
    "toward THIS wording",
    "therefore copy",
    "same stance token",
    "do not change the token"
  ],
  must_contain_exactly_one_of_each: [
    "the subject's stated stance belongs to the UNDERLYING VIEW that proposition A expresses",
    "report the SUBJECT's stance toward proposition B"
  ],
  expected_token_written_into_the_contract: false,
  arm_label_in_the_contract: false
});

/**
 * A DELIBERATE CALIBRATION, RECORDED SO ITS CONSEQUENCE IS NOT DISCOVERED LATER.
 * The contract spells out the structure of the task — where the stance belongs, what the relation line
 * means, and what to report — without ever stating the mapping or the expected token. That makes the two
 * outcomes deliberately ASYMMETRIC:
 *   - a NULL is very strong: if the executor cannot carry the stance across even when the structure is
 *     laid out this explicitly, the composition failure is decisive;
 *   - a POSITIVE is deliberately WEAK: it shows the executor CAN compose when told, not that it composes
 *     spontaneously. A C0a positive may therefore never be reported as evidence that the executor
 *     performs cross-expression stance composition unaided.
 * This asymmetry is the right one for a baseline whose job is to rule out the simplest executor-level
 * explanation of the A1 null.
 */
export const D4C0A_CALIBRATION = Object.freeze({
  contract_states_the_task_structure: true,
  contract_states_the_mapping: false,
  contract_states_the_expected_token: false,
  a_null_is_strong: true,
  a_positive_proves_only_that_the_executor_can_compose_when_told: true,
  a_positive_may_never_be_reported_as_spontaneous_composition: true,
  is_a_prompt_rescue_of_the_characteros_request: false,
  why_not_a_rescue:
    "a prompt rescue modifies the CharacterOS request to make it succeed; C0a is a different, state-blind task whose purpose is to measure the capability with maximum clarity, and it modifies no CharacterOS artifact"
});

// =============================================================================================
// 5. THE TWO TREATMENT ARMS
// =============================================================================================

export type D4C0AArmV0 = "ARM_SUPPORT" | "ARM_OPPOSE";

export interface D4C0ABindingV0 {
  readonly proposition_a: string;
  readonly proposition_b: string;
  readonly relation: string;
  readonly subject_stance_toward_a: string;
}

export const D4C0A_RELATION_ALIGNED = "A and B express the same underlying view." as const;
export const D4C0A_STANCE_SUPPORT = "SUPPORTS" as const;
export const D4C0A_STANCE_OPPOSE = "OPPOSES" as const;

export const D4C0A_ARMS: Readonly<Record<D4C0AArmV0, { readonly binding: D4C0ABindingV0; readonly predicted_token: D4C0AToken }>> =
  Object.freeze({
    ARM_SUPPORT: Object.freeze({
      binding: Object.freeze({
        proposition_a: D4C0A_PROPOSITION_A,
        proposition_b: D4C0A_PROPOSITION_B,
        relation: D4C0A_RELATION_ALIGNED,
        subject_stance_toward_a: D4C0A_STANCE_SUPPORT
      }),
      predicted_token: "SUPPORTS_B" as D4C0AToken
    }),
    ARM_OPPOSE: Object.freeze({
      binding: Object.freeze({
        proposition_a: D4C0A_PROPOSITION_A,
        proposition_b: D4C0A_PROPOSITION_B,
        relation: D4C0A_RELATION_ALIGNED,
        subject_stance_toward_a: D4C0A_STANCE_OPPOSE
      }),
      predicted_token: "OPPOSES_B" as D4C0AToken
    })
  });

export const D4C0A_BOTH_ARMS_REQUIRED = Object.freeze({
  single_arm_positive_is_insufficient: true,
  why: "one arm alone cannot show that the output is sensitive to the stance intervention; a constant answer would look positive in whichever arm matched it",
  arms_required: ["ARM_SUPPORT", "ARM_OPPOSE"]
});

/**
 * The frozen normalisation for treatment isolation. Exactly ONE class is admissible: the value of the
 * stance field in the user binding block. If any other byte differs, the arms are not isolated and the
 * run must stop before a call.
 */
export const D4C0A_NORMALISATION = Object.freeze({
  class_count: 1,
  admissible_classes: ["the subject's stated stance toward A in the binding block"],
  rule: "replace the stance value with the fixed sentinel __D4C0A_STANCE__ and require byte-identical model-facing requests",
  sentinel: "__D4C0A_STANCE__",
  frozen_before_any_output: true,
  any_other_difference_fails_closed: true,
  forbidden_in_model_facing_bytes: [
    "an arm label",
    "a request hash",
    "the expected token",
    "a replicate ordinal",
    "any schedule information"
  ]
});

/**
 * Renders the binding block. This is the ONLY place the arm's stance value enters the request, by
 * construction — the normalisation class is therefore provably single.
 */
export function renderD4C0ABindingBlockV0(binding: D4C0ABindingV0): string {
  return [
    "[BINDING]",
    `PROPOSITION A: ${binding.proposition_a}`,
    `PROPOSITION B: ${binding.proposition_b}`,
    `RELATION(A,B): ${binding.relation}`,
    `SUBJECT STANCE TOWARD A: ${binding.subject_stance_toward_a}`,
    "Which stance does the subject hold toward proposition B?"
  ].join("\n");
}

export function normaliseD4C0ARequestV0(userContent: string): { normalised: string; replacements: number } {
  const marker = "SUBJECT STANCE TOWARD A: ";
  const lines = userContent.split("\n");
  let replacements = 0;
  const out = lines.map((line) => {
    if (line.startsWith(marker)) {
      replacements += 1;
      return `${marker}${D4C0A_NORMALISATION.sentinel}`;
    }
    return line;
  });
  return { normalised: out.join("\n"), replacements };
}

// =============================================================================================
// 6. INSTRUMENT QUALIFICATION
// =============================================================================================

export interface D4C0AQualificationFixtureV0 {
  readonly fixture_id: string;
  readonly binding: D4C0ABindingV0;
  readonly expected_token: D4C0AToken;
  readonly kind: string;
}

/**
 * State-blind synthetic qualification fixtures. They use a synthetic topic unrelated to CAUTION, never
 * the frozen A/B target pair, and never CharacterOS. The third fixture is an internal negative control:
 * with no relation, no transfer is defined, so the instrument must be able to express UNCERTAIN_B.
 */
export const D4C0A_QUALIFICATION_FIXTURES: readonly D4C0AQualificationFixtureV0[] = Object.freeze([
  Object.freeze({
    fixture_id: "D4C0A-QF-A-SUPPORT-TRANSFER",
    kind: "aligned pair, subject supports A",
    binding: Object.freeze({
      proposition_a: "A clamp should always be used when gluing a joint.",
      proposition_b: "Clamping a joint while the glue sets is always the right thing to do.",
      relation: "A and B express the same underlying view.",
      subject_stance_toward_a: "SUPPORTS"
    }),
    expected_token: "SUPPORTS_B"
  }),
  Object.freeze({
    fixture_id: "D4C0A-QF-B-OPPOSE-TRANSFER",
    kind: "aligned pair, subject opposes A",
    binding: Object.freeze({
      proposition_a: "A clamp should always be used when gluing a joint.",
      proposition_b: "Clamping a joint while the glue sets is always the right thing to do.",
      relation: "A and B express the same underlying view.",
      subject_stance_toward_a: "OPPOSES"
    }),
    expected_token: "OPPOSES_B"
  }),
  Object.freeze({
    fixture_id: "D4C0A-QF-C-NO-TRANSFER",
    kind: "unrelated pair, subject supports A — no transfer is defined",
    binding: Object.freeze({
      proposition_a: "A clamp should always be used when gluing a joint.",
      proposition_b: "The workshop's saw blade needs sharpening this month.",
      relation: "A and B are about different matters and do not express the same view.",
      subject_stance_toward_a: "SUPPORTS"
    }),
    expected_token: "UNCERTAIN_B"
  })
]);

export const D4C0A_EXPECTED_TOKEN_MAP: Readonly<Record<string, D4C0AToken>> = Object.freeze(
  Object.fromEntries(D4C0A_QUALIFICATION_FIXTURES.map((f) => [f.fixture_id, f.expected_token]))
) as Readonly<Record<string, D4C0AToken>>;

export const D4C0A_QUALIFICATION_RULE = Object.freeze({
  fixtures: 3,
  replicates_per_fixture: 3,
  planned_calls: 9,
  rule: "each fixture's modal token must equal its pre-registered expected token, exactly",
  invalid_rule: "any_invalid_qualification_trial_fails_that_instrument_qualification",
  counts_as_invalid: [
    "transport failure",
    "timeout classified as a failed provider attempt",
    "malformed output",
    "parser invalid",
    "a token outside the frozen D4-C0a vocabulary"
  ],
  denominator: "always the full nine planned trials",
  retry_allowed: false,
  replacement_allowed: false,
  extra_call_allowed: false,
  tolerance_or_similarity_substitution: false,
  what_it_proves:
    "only that the measurement instrument can express the three stance tokens on state-blind synthetic fixtures",
  what_it_does_not_prove: "composition ability; qualification is not composition evidence"
});

// =============================================================================================
// 7. NOISE / STABILITY — DERIVED FROM THE SCORER, WITH A PROVABLE COMPATIBILITY ARGUMENT
// =============================================================================================

/**
 * The scorer below is MODAL-BASED PER ARM plus a BETWEEN-ARM CONTRAST. That is neither a proportion
 * endpoint (D1) nor a unanimity endpoint (D2-A1 / D3-B), so neither of those noise designs transfers.
 *
 * THE COMPATIBILITY ARGUMENT, STATED SO IT CAN BE CHECKED. The noise rule has exactly two reachable
 * outcomes — PASS and STOP — and NO BRANCH THAT SETS A SAMPLE SIZE. There is therefore no function from
 * the noise result to r: r is a frozen constant, identical on every path. The D2/D3 failure mode (a
 * `5 -> r = 14` branch paired with a unanimity scorer, so that buying trials raised the bar) cannot arise
 * here, because buying trials is not something this design can do.
 */
export const D4C0A_NOISE_GATE = Object.freeze({
  purpose: "a determinism precondition on a NON-TARGET request, not a sample-size rule",
  shape: "6 byte-identical calls of one frozen non-target qualification fixture, reusing its frozen bytes",
  non_target_request_source:
    "D4C0A-QF-A-SUPPORT-TRANSFER's frozen model-facing request — a synthetic qualification fixture, chosen by the frozen manifest order, never the treatment request",
  planned_calls: 6,
  pass_condition: "all six trials legal AND the unique modal token's count equals 6",
  pass_verdict: "D4C0A_STABILITY_GATE_PASS",
  self_noise_verdict: "D4C0A_INCONCLUSIVE_BY_INSTRUMENT_SELF_NOISE",
  invalid_verdict: "D4C0A_INCONCLUSIVE_BY_STABILITY_GATE_INVALID_OUTPUTS",
  reachable_outcomes: ["PASS", "STOP"],
  reachable_r_values: [6],
  sample_size_branches: [],
  r_is_a_frozen_constant: true,
  compatibility_argument:
    "the noise rule cannot set r, and the scorer receives 2r trials regardless of the gate's value; there is no path on which the gate changes the scorer's sample size, so the two rules cannot conflict mathematically",
  the_gate_is_on_agreement_not_correctness: true,
  why:
    "the gate asks whether the six calls agree with EACH OTHER; it does not require the modal token to match the fixture's expected token, because agreement is a property of the executor while correctness belongs to qualification",
  rejections_recorded: [
    "no r-extension branch, because at r = 6 the scorer needs only a UNIQUE modal and two deviating trials still leave one",
    "no unanimity requirement on the target, because the target criterion is a per-arm unique modal plus a between-arm contrast"
  ]
});

// =============================================================================================
// 8. THE SCIENTIFIC SCORER
// =============================================================================================

export interface D4C0ATrialRecordV0 {
  readonly trial_id: string;
  readonly arm: D4C0AArmV0;
  readonly parsed_token: string | null;
}

export interface D4C0AScoreOutcomeV0 {
  readonly outcome_class: "POSITIVE" | "NULL" | "INCONCLUSIVE";
  readonly collection_integrity: boolean;
  readonly collection_integrity_failures: readonly string[];
  readonly invalid_count: number;
  readonly scientific_scoring_executed: boolean;
  readonly arm_counts: Readonly<Record<string, Record<string, number>>> | null;
  readonly arm_unique_modals: Readonly<Record<string, string | null>> | null;
  readonly arm_modal_ties: Readonly<Record<string, boolean>> | null;
  readonly contrast_holds: boolean | null;
  readonly verdict: string;
  readonly forbidden_interpretations: readonly string[];
}

export const D4C0A_SCORER = Object.freeze({
  kind: "per-arm unique modal + between-arm contrast",
  positive_requires: [
    "ARM_SUPPORT unique modal == SUPPORTS_B",
    "ARM_OPPOSE unique modal == OPPOSES_B",
    "the two arm modals differ"
  ],
  tie_handling: "a tie at the top of an arm means there is no unique modal; the criterion fails closed to NULL",
  is_not_positive: [
    "ARM_SUPPORT -> SUPPORTS_B and ARM_OPPOSE -> SUPPORTS_B (no sensitivity to the intervention)",
    "ARM_SUPPORT -> OPPOSES_B and ARM_OPPOSE -> SUPPORTS_B (reversed direction is NOT an effect of interest)"
  ],
  reversed_direction_may_not_be_repackaged_as_an_effect: true,
  thresholds_added: [],
  null_verdict: "EXECUTOR_STATE_BLIND_CROSS_EXPRESSION_STANCE_COMPOSITION_NOT_ESTABLISHED",
  positive_verdict: "EXECUTOR_STATE_BLIND_CROSS_EXPRESSION_STANCE_COMPOSITION_ESTABLISHED",
  integrity_verdict: "D4C0A_INCONCLUSIVE_BY_COLLECTION_INTEGRITY_FAILURE",
  invalid_verdict: "D4C0A_INCONCLUSIVE_BY_STATE_EXPERIMENT_INVALID_OUTPUTS"
});

function uniqueModalOf(counts: Record<string, number>): { modal: string | null; count: number; tie: boolean } {
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const top = ranked[0];
  if (top === undefined || top[1] === 0) return { modal: null, count: 0, tie: false };
  const tie = ranked[1] !== undefined && ranked[1][1] === top[1];
  return { modal: tie ? null : top[0], count: top[1], tie };
}

/**
 * THE frozen decision procedure. An audit calls THIS function on synthetic datasets rather than
 * re-implementing it, so the audit cannot pass while the shipped scorer disagrees.
 */
export function scoreD4C0AV0(input: {
  readonly trials: readonly D4C0ATrialRecordV0[];
  readonly r_per_arm: number;
}): D4C0AScoreOutcomeV0 {
  const failures: string[] = [];
  const ids = input.trials.map((t) => t.trial_id);
  if (ids.length - new Set(ids).size > 0) failures.push("duplicate trial identity");
  for (const arm of ["ARM_SUPPORT", "ARM_OPPOSE"] as const) {
    const rows = input.trials.filter((t) => t.arm === arm);
    if (rows.length !== input.r_per_arm) failures.push(`${arm} records ${rows.length} != planned ${input.r_per_arm}`);
  }
  const unknownArms = input.trials.filter((t) => t.arm !== "ARM_SUPPORT" && t.arm !== "ARM_OPPOSE").length;
  if (unknownArms > 0) failures.push(`${unknownArms} records with an unknown arm`);
  const invalid = input.trials.filter((t) => t.parsed_token === null || !(D4C0A_TOKENS as readonly string[]).includes(t.parsed_token)).length;
  const forbidden = Object.freeze([
    "the relation between A and B",
    "the truth of B",
    "the model's own opinion",
    "the model's confidence in the relation"
  ]);

  if (failures.length > 0) {
    return Object.freeze({
      outcome_class: "INCONCLUSIVE" as const,
      collection_integrity: false,
      collection_integrity_failures: Object.freeze(failures),
      invalid_count: invalid,
      scientific_scoring_executed: false,
      arm_counts: null,
      arm_unique_modals: null,
      arm_modal_ties: null,
      contrast_holds: null,
      verdict: D4C0A_SCORER.integrity_verdict,
      forbidden_interpretations: forbidden
    });
  }
  if (invalid > 0) {
    return Object.freeze({
      outcome_class: "INCONCLUSIVE" as const,
      collection_integrity: true,
      collection_integrity_failures: Object.freeze([]),
      invalid_count: invalid,
      scientific_scoring_executed: false,
      arm_counts: null,
      arm_unique_modals: null,
      arm_modal_ties: null,
      contrast_holds: null,
      verdict: D4C0A_SCORER.invalid_verdict,
      forbidden_interpretations: forbidden
    });
  }
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
  const support = uniqueModalOf(supportCounts);
  const oppose = uniqueModalOf(opposeCounts);
  const contrast = support.modal !== null && oppose.modal !== null && support.modal !== oppose.modal;
  const positive = support.modal === "SUPPORTS_B" && oppose.modal === "OPPOSES_B" && contrast;
  return Object.freeze({
    outcome_class: positive ? ("POSITIVE" as const) : ("NULL" as const),
    collection_integrity: true,
    collection_integrity_failures: Object.freeze([]),
    invalid_count: 0,
    scientific_scoring_executed: true,
    arm_counts: Object.freeze({ ARM_SUPPORT: Object.freeze(supportCounts), ARM_OPPOSE: Object.freeze(opposeCounts) }),
    arm_unique_modals: Object.freeze({ ARM_SUPPORT: support.modal, ARM_OPPOSE: oppose.modal }),
    arm_modal_ties: Object.freeze({ ARM_SUPPORT: support.tie, ARM_OPPOSE: oppose.tie }),
    contrast_holds: contrast,
    verdict: positive ? D4C0A_SCORER.positive_verdict : D4C0A_SCORER.null_verdict,
    forbidden_interpretations: forbidden
  });
}

// =============================================================================================
// 9. REPLICATION COUNT — DERIVED, NOT INHERITED
// =============================================================================================

export const D4C0A_REPLICATION_DERIVATION = Object.freeze({
  derived_from: "the frozen scorer's shape, not from any previous line's budget",
  step_1: "the criterion is a per-arm unique modal plus a between-arm contrast, so the target needs BOTH arms measured",
  step_2: "therefore target total = 2r, with r replicates per arm; r is not the total",
  step_3:
    "r = 6 per arm, because at r = 6 the criterion tolerates up to TWO deviating trials without losing modal uniqueness (6-0, 5-1 and 4-2 all leave a unique modal; only 3-3 ties)",
  step_4:
    "no r-extension branch exists, so the derivation stops at the smallest r that keeps the modal unique under a two-trial deviation",
  r_per_arm: 6,
  target_total: 12,
  target_is_2r: true,
  not_inherited_from_d2_or_d3: true,
  qualification: 9,
  stability_gate: 6,
  total_budget: 27,
  budget_note:
    "27 is a CONSEQUENCE of the frozen scorer, the frozen qualification rule and the frozen gate shape; it was not assumed and then justified"
});

// =============================================================================================
// 10. CLAIM BOUNDARIES, THE ARCHITECTURE GATE, AND C0b
// =============================================================================================

export const D4C0A_CLAIM_BOUNDARIES = Object.freeze({
  evidence_class: "EXECUTOR_STATE_BLIND_CAPABILITY",
  is_characteros_causal_evidence: false,
  on_positive:
    "an explicit-stance, explicit-relation state-blind setting does not by itself prevent the executor from carrying a stance onto an aligned re-wording",
  on_positive_does_not_mean: ["CharacterOS is at fault", "the projection is wrong", "the prompt is wrong"],
  on_null:
    "even with CharacterOS removed and with the relation and the stance supplied explicitly, the executor did not stably complete the composition in the preregistered direction",
  on_null_consequence: "CharacterOS architecture modification NOT AUTHORISED BY THIS LINE",
  on_null_forbidden_response: ["strengthening the prompt to rescue it", "re-running with friendlier wording"],
  on_inconclusive: "nothing is localized; no CharacterOS change; no re-run to force a result",
  link_4_touched: false
});

export const D4_ARCHITECTURE_GATE = Object.freeze({
  characteros_belief_architecture_may_not_be_modified: true,
  required_before_any_such_study: [
    "D4-C0a positive",
    "a later comparator shows the SAME executor, the SAME proposition pair and equivalent stance information is positive on a state-blind representation",
    "the CharacterOS-representation counterpart remains a valid null",
    "the information difference between the two requests is enumerated item by item"
  ],
  until_then_candidates_only: [
    "semantic ID",
    "embedding",
    "proposition graph",
    "relation propagation",
    "an additional model pass",
    "prompt rescue",
    "a projection rewrite"
  ],
  these_are: "HYPOTHESES / CANDIDATES ONLY"
});

export const D4_C0B_DEFERRAL = Object.freeze({
  verdict: "D4_C0B_NOT_PREREGISTERED",
  reason:
    "D2-A0 already established credence -> canonical proposition stance binding on the real production representation; introducing a new synthetic credence representation before the C0a result is known would add a second possible source of measurement ambiguity",
  reconsideration_condition: "only after a C0a positive is whether C0b still offers independent information gain",
  designed_this_round: false,
  may_not_be_run_this_line: true
});

// =============================================================================================
// 11. MECHANICAL SELF-CHECKS + MANIFEST
// =============================================================================================

export interface D4ManifestV0 {
  readonly version: typeof D4_VERSION;
  readonly handoff: typeof D4_FROZEN_HANDOFF;
  readonly explanations: typeof D4_COMPETING_EXPLANATIONS;
  readonly base_system_text: string;
  readonly contract_text: string;
  readonly schema: Readonly<Record<string, unknown>>;
  readonly tokens: readonly string[];
  readonly anchors: typeof D4C0A_ANCHORS;
  readonly arms: typeof D4C0A_ARMS;
  readonly normalisation: typeof D4C0A_NORMALISATION;
  readonly qualification_fixtures: readonly D4C0AQualificationFixtureV0[];
  readonly expected_token_map: Readonly<Record<string, D4C0AToken>>;
  readonly qualification_rule: typeof D4C0A_QUALIFICATION_RULE;
  readonly noise_gate: typeof D4C0A_NOISE_GATE;
  readonly scorer_spec: typeof D4C0A_SCORER;
  readonly replication: typeof D4C0A_REPLICATION_DERIVATION;
  readonly claim_boundaries: typeof D4C0A_CLAIM_BOUNDARIES;
  readonly architecture_gate: typeof D4_ARCHITECTURE_GATE;
  readonly c0b: typeof D4_C0B_DEFERRAL;
  readonly calibration: typeof D4C0A_CALIBRATION;
  readonly tests: Readonly<Record<string, unknown>>;
  readonly manifest_hash: HashV1;
  readonly contract_text_hash: HashV1;
  readonly fixture_manifest_hash: HashV1;
  readonly arms_hash: HashV1;
}

export async function deriveD4ManifestV0(): Promise<D4ManifestV0> {
  const problems: string[] = [];
  const check = (condition: boolean, message: string): void => {
    if (!condition) problems.push(message);
  };

  // the contract must not carry A1's competing framing and must not answer the question
  for (const banned of D4C0A_CONTRACT_LAWS.must_not_contain) {
    check(!D4C0A_CONTRACT_TEXT.includes(banned), `the contract contains a forbidden framing: ${banned}`);
  }
  check(D4C0A_CONTRACT_TEXT.includes("UNDERLYING VIEW that proposition A expresses"), "the contract does not state where the stance belongs");
  check(D4C0A_CONTRACT_TEXT.includes("report the SUBJECT's stance toward proposition B"), "the contract does not state what to report");
  check(!D4C0A_CONTRACT_TEXT.includes("SUPPORTS_B — the subject treats proposition B as correct") === false, "the anchor line is missing");
  check(!/support the subject should|the answer is/i.test(D4C0A_CONTRACT_TEXT), "the contract hints at the answer");

  // state-blindness of the request material
  const requestMaterial = `${D4C0A_BASE_SYSTEM_TEXT}\n${D4C0A_CONTRACT_TEXT}\n${renderD4C0ABindingBlockV0(D4C0A_ARMS.ARM_SUPPORT.binding)}`;
  for (const banned of D4C0A_FORBIDDEN_SUBSTRINGS) {
    check(!requestMaterial.includes(banned), `the request material contains a forbidden substring: ${banned}`);
  }
  check(!requestMaterial.includes("belief"), "the request material mentions a belief");

  // the frozen pair is used only in the treatment arms, never in the fixtures
  const fixtureText = D4C0A_QUALIFICATION_FIXTURES.map((f) => renderD4C0ABindingBlockV0(f.binding)).join("\n");
  check(!fixtureText.includes(D4C0A_PROPOSITION_A), "a qualification fixture uses the frozen proposition A");
  check(!fixtureText.includes(D4C0A_PROPOSITION_B), "a qualification fixture uses the frozen proposition B");
  check(!/Caution is warranted|secondhand report/.test(fixtureText), "a qualification fixture uses the CAUTION wording");
  check(new Set(D4C0A_QUALIFICATION_FIXTURES.map((f) => f.expected_token)).size === D4C0A_TOKENS.length, "the three tokens are not each expected exactly once");
  check(D4C0A_QUALIFICATION_FIXTURES.every((f) => D4C0A_EXPECTED_TOKEN_MAP[f.fixture_id] === f.expected_token), "the expected-token map disagrees with the fixtures");

  // treatment isolation: exactly one admissible normalisation class, and it is the only difference
  const supportBlock = renderD4C0ABindingBlockV0(D4C0A_ARMS.ARM_SUPPORT.binding);
  const opposeBlock = renderD4C0ABindingBlockV0(D4C0A_ARMS.ARM_OPPOSE.binding);
  const supportNorm = normaliseD4C0ARequestV0(supportBlock);
  const opposeNorm = normaliseD4C0ARequestV0(opposeBlock);
  check(supportNorm.normalised === opposeNorm.normalised, "the two arms are not byte-identical after the frozen normalisation");
  check(supportNorm.replacements === 1 && opposeNorm.replacements === 1, "the normalisation replaced something other than exactly one stance value");
  const rawLines = supportBlock.split("\n").filter((line, index) => line !== opposeBlock.split("\n")[index]);
  check(rawLines.length === 1, `the arms differ on ${rawLines.length} lines, expected 1`);
  check(!requestMaterial.includes("SUPPORTS_B") === false, "the contract must define the token names");

  // the scorer: the frozen procedure must reject the forbidden patterns
  const mk = (support: readonly (string | null)[], oppose: readonly (string | null)[]) => [
    ...support.map((token, i) => ({ trial_id: `S${String(i)}`, arm: "ARM_SUPPORT" as const, parsed_token: token })),
    ...oppose.map((token, i) => ({ trial_id: `O${String(i)}`, arm: "ARM_OPPOSE" as const, parsed_token: token }))
  ];
  const six = (token: string) => Array.from({ length: 6 }, () => token);
  const perfect = scoreD4C0AV0({ trials: mk(six("SUPPORTS_B"), six("OPPOSES_B")), r_per_arm: 6 });
  const constant = scoreD4C0AV0({ trials: mk(six("SUPPORTS_B"), six("SUPPORTS_B")), r_per_arm: 6 });
  const reversed = scoreD4C0AV0({ trials: mk(six("OPPOSES_B"), six("SUPPORTS_B")), r_per_arm: 6 });
  const tie = scoreD4C0AV0({ trials: mk(["SUPPORTS_B", "SUPPORTS_B", "SUPPORTS_B", "UNCERTAIN_B", "UNCERTAIN_B", "UNCERTAIN_B"], six("OPPOSES_B")), r_per_arm: 6 });
  const oneInvalid = scoreD4C0AV0({ trials: mk([...six("SUPPORTS_B").slice(0, 5), null], six("OPPOSES_B")), r_per_arm: 6 });
  const integrity = scoreD4C0AV0({ trials: mk(six("SUPPORTS_B"), six("OPPOSES_B").slice(0, 5)), r_per_arm: 6 });
  const twoDeviationsStillUnique = scoreD4C0AV0({ trials: mk(["SUPPORTS_B", "SUPPORTS_B", "SUPPORTS_B", "SUPPORTS_B", "UNCERTAIN_B", "OPPOSES_B"], six("OPPOSES_B")), r_per_arm: 6 });
  check(perfect.outcome_class === "POSITIVE", "the perfect pattern is not positive");
  check(constant.outcome_class === "NULL", "a constant answer is not a null");
  check(reversed.outcome_class === "NULL", "the reversed direction is not a null");
  check(tie.outcome_class === "NULL" && tie.arm_modal_ties?.["ARM_SUPPORT"] === true, "a tie is not a null with a tie recorded");
  check(oneInvalid.outcome_class === "INCONCLUSIVE" && oneInvalid.scientific_scoring_executed === false, "an invalid run performed scientific scoring");
  check(integrity.outcome_class === "INCONCLUSIVE" && integrity.collection_integrity === false, "an integrity failure is not inconclusive");
  check(twoDeviationsStillUnique.arm_unique_modals?.["ARM_SUPPORT"] === "SUPPORTS_B", "two deviations lost modal uniqueness at r = 6");

  // the noise rule cannot set r
  check(D4C0A_NOISE_GATE.sample_size_branches.length === 0, "the noise gate has a sample-size branch");
  check(D4C0A_NOISE_GATE.reachable_r_values.length === 1 && D4C0A_NOISE_GATE.reachable_r_values[0] === 6, "the noise gate can reach an r other than 6");
  check(D4C0A_NOISE_GATE.reachable_outcomes.length === 2, "the noise gate has more than pass/stop");

  // the budget is a consequence
  check(D4C0A_REPLICATION_DERIVATION.target_total === 2 * D4C0A_REPLICATION_DERIVATION.r_per_arm, "the target total is not 2r");
  check(D4C0A_REPLICATION_DERIVATION.total_budget === 9 + 6 + 12, "the budget does not follow from its parts");
  check(D4C0A_CLAIM_BOUNDARIES.is_characteros_causal_evidence === false, "C0a claims to be CharacterOS causal evidence");
  check(D4_ARCHITECTURE_GATE.characteros_belief_architecture_may_not_be_modified, "the architecture gate is open");
  check(D4_C0B_DEFERRAL.verdict === "D4_C0B_NOT_PREREGISTERED" && !D4_C0B_DEFERRAL.designed_this_round, "C0b was designed");
  check(!D4_FROZEN_HANDOFF.link_4_reopened_by_this_line, "this line reopens link 4");
  if (problems.length > 0) throw new Error(`D4_C0A_NONCONFORMANT: ${problems.join(" ; ")}`);

  const tests = {
    contract_has_no_competing_framing: true,
    contract_does_not_state_the_answer: true,
    request_material_is_state_blind: true,
    fixtures_avoid_caution_and_the_frozen_pair: true,
    fixture_expectations_cover_all_three_tokens: true,
    arms_differ_on_exactly_one_line: rawLines.length,
    arms_byte_identical_after_the_frozen_normalisation: true,
    scorer_perfect_is_positive: perfect.outcome_class,
    scorer_constant_is_null: constant.outcome_class,
    scorer_reversed_is_null: reversed.outcome_class,
    scorer_tie_is_null: tie.outcome_class,
    scorer_one_invalid_is_inconclusive: oneInvalid.outcome_class,
    scorer_integrity_failure_is_inconclusive: integrity.outcome_class,
    modal_uniqueness_survives_two_deviations_at_r6: true,
    noise_gate_sample_size_branches: 0,
    noise_gate_reachable_r_values: [6],
    budget: D4C0A_REPLICATION_DERIVATION.total_budget,
    verification_cost: 0
  };

  const body = {
    version: D4_VERSION,
    handoff: D4_FROZEN_HANDOFF,
    explanations: D4_COMPETING_EXPLANATIONS,
    base_system_text: D4C0A_BASE_SYSTEM_TEXT,
    contract_text: D4C0A_CONTRACT_TEXT,
    schema: D4C0A_JSON_SCHEMA,
    tokens: D4C0A_TOKENS,
    anchors: D4C0A_ANCHORS,
    arms: D4C0A_ARMS,
    normalisation: D4C0A_NORMALISATION,
    qualification_fixtures: D4C0A_QUALIFICATION_FIXTURES,
    expected_token_map: D4C0A_EXPECTED_TOKEN_MAP,
    qualification_rule: D4C0A_QUALIFICATION_RULE,
    noise_gate: D4C0A_NOISE_GATE,
    scorer_spec: D4C0A_SCORER,
    replication: D4C0A_REPLICATION_DERIVATION,
    claim_boundaries: D4C0A_CLAIM_BOUNDARIES,
    architecture_gate: D4_ARCHITECTURE_GATE,
    c0b: D4_C0B_DEFERRAL,
    calibration: D4C0A_CALIBRATION,
    tests
  };
  return Object.freeze({
    ...body,
    contract_text_hash: await hashEnvelope(D4_HASH_PROJECTION_V0, { contract_text: D4C0A_CONTRACT_TEXT }),
    fixture_manifest_hash: await hashEnvelope(D4_HASH_PROJECTION_V0, { fixtures: D4C0A_QUALIFICATION_FIXTURES }),
    arms_hash: await hashEnvelope(D4_HASH_PROJECTION_V0, { arms: D4C0A_ARMS }),
    manifest_hash: await hashEnvelope(D4_HASH_PROJECTION_V0, body)
  });
}
