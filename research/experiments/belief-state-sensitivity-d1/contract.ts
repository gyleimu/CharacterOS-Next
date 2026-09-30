/* eslint-disable no-restricted-imports -- Isolated research preregistration over frozen built production roots (repository convention); zero production code changes and no production import of this module. */
/**
 * D1 — BELIEF STATE SENSITIVITY: frozen preregistration constants. RESEARCH-ONLY. NOT RUN.
 *
 * This module is the machine-readable half of `PREREG.md`. Everything here is frozen BEFORE the
 * first model call: the literal probe texts, the state levels, the deterministic `r_confirm`
 * rule, the frame-minimal contract, the verdict vocabulary and the call budget.
 *
 * Nothing here changes: CharacterOS Core, the Belief mechanism, DecisionProbeV2, the production V8
 * contract, the D1 scientific claim, or the HIGH/LOW state semantics.
 */

import { hashEnvelope } from "../../../packages/subject-core/dist/index.js";
import type { HashV1 } from "../../../packages/subject-core/dist/index.js";

import { V2_PRIMARY_SEMANTIC_CONTRACT } from "../decision-probe-v2/contract.ts";

export const D1_PREREGISTRATION_VERSION = "d1-belief-state-sensitivity-v1" as const;

export const D1_HASH_PROJECTION_V0 = "characteros-next/research/d1-belief-state-sensitivity/v1" as const;

// ---------------------------------------------------------------------------------------------
// FIX 2 — literal probe bytes
// ---------------------------------------------------------------------------------------------

export interface D1ProbeV0 {
  readonly probe_id: string;
  readonly family: "PRIMARY" | "NEAR_TRANSFER" | "NEGATIVE_CONTROL";
  readonly observation_text: string;
  /** Pre-registered expectation, written before any call. */
  readonly expected_direction: string;
  /** Why the observation alone does NOT determine the decision (primary/near-transfer only). */
  readonly underdetermination: string;
}

/**
 * P1 — primary. Underdetermined even GIVEN the anchors: the observation does not state that a
 * check is cheap (which would force VERIFY from the anchors alone), does not vouch for the source
 * (which would force ACCEPT), and contains no contradiction (which would force REJECT).
 * Contains no decision token and no anchor phrase.
 */
export const D1_P1: D1ProbeV0 = Object.freeze({
  probe_id: "D1-P1-AWAITING-INSPECTION",
  family: "PRIMARY",
  observation_text:
    "Workshop note. A colleague remarks that the shared thicknesser's feed rollers are worn and " +
    "that they ought to be replaced before the next job. You have not had the machine in front of " +
    "you since it was last serviced, and you have no note about the rollers either way. There is a " +
    "chance to look at it before the job starts, but stopping to do that would push the job " +
    "further behind. What should be done about the colleague's remark?",
  expected_direction:
    "HIGH -> VERIFY more often than LOW; LOW -> ACCEPT more often than HIGH",
  underdetermination:
    "the observation neither vouches for the source (would force ACCEPT), nor states that looking is cheap (would force VERIFY), nor contradicts the remark (would force REJECT)"
});

/** P2 — near transfer: the same disposition, a different surface and domain. Not a rewording. */
export const D1_P2: D1ProbeV0 = Object.freeze({
  probe_id: "D1-P2-BOOKING-CHANGE",
  family: "NEAR_TRANSFER",
  observation_text:
    "A colleague sends a message saying the Thursday delivery slot has been moved to Friday. You " +
    "have not seen the booking system and you have no other message about it. You could ask the " +
    "person who runs the bookings before telling anyone else, but they are usually busy and it " +
    "would take a while. What should be done about the message?",
  expected_direction: "same direction as P1",
  underdetermination:
    "same structure as P1 in a different domain: no source endorsement, no statement that asking is cheap, no contradiction"
});

/**
 * P3 — negative control. Unrelated to the CAUTION disposition (its antecedent is FALSE: the
 * information HAS been seen first-hand), and the observation alone determines the disposition.
 * It still maps naturally onto the frozen closed set, and the expected decision is frozen here.
 */
export const D1_P3: D1ProbeV0 = Object.freeze({
  probe_id: "D1-P3-DIRECT-COUNT",
  family: "NEGATIVE_CONTROL",
  observation_text:
    "A colleague says there are four clamps left in the drawer. You have the drawer open in front " +
    "of you and you can count four clamps. What should be done about the colleague's remark?",
  expected_direction: "HIGH == LOW; expected decision ACCEPT in both",
  underdetermination:
    "not underdetermined by design: the observation settles it; the CAUTION belief's antecedent (information not seen first-hand) is false"
});

export const D1_PROBES: readonly D1ProbeV0[] = Object.freeze([D1_P1, D1_P2, D1_P3]);

// ---------------------------------------------------------------------------------------------
// State levels (unchanged from the reviewed design)
// ---------------------------------------------------------------------------------------------

export const D1_PROPOSITION_LABEL =
  "Caution is warranted when the conclusion rests on information I have not seen myself.";

export const D1_STATE_LEVELS = Object.freeze({
  HIGH: 0.8,
  LOW: 0.2,
  /** FIX 1: noise calibration ONLY. Never a treatment arm, never in the primary estimand. */
  NEUTRAL_NOISE_CALIBRATION: 0.5
});

export const D1_SEPARATION_GATE = Object.freeze({
  min_separation: 0.4,
  bound_margin: 0.05
});

// ---------------------------------------------------------------------------------------------
// FIX 1 — deterministic R_CONFIRM rule (no researcher discretion)
// ---------------------------------------------------------------------------------------------

/** Wilson score interval upper bound, 95 %, z = 1.959963984540054. */
export function wilsonUpper95(x: number, n: number): number {
  const z = 1.959963984540054;
  if (n <= 0) return 1;
  const denom = 1 + (z * z) / n;
  const center = (x / n + (z * z) / (2 * n)) / denom;
  const half =
    (z * Math.sqrt((x / n) * (1 - x / n) / n + (z * z) / (4 * n * n))) / denom;
  return center + half;
}

/** Frozen planning target: the confirmatory noise ceiling must not exceed this. */
export const D1_NOISE_CEILING_TARGET = 0.4;

/** Frozen minimum decisionally-meaningful between-level disagreement. */
export const D1_DELTA_MIN = 0.5;

/**
 * DETERMINISTIC MAPPING — `pilot results -> r_confirm`.
 *
 * Input: `modal_count` = how many of the 6 byte-identical pilot replicates chose the same decision
 * (the modal decision). There is no other input and no discretion: the same pilot always yields
 * the same `r_confirm`.
 *
 *   k = 6  -> r_confirm = 6
 *   k = 5  -> r_confirm = 14
 *   k <= 4 -> STOP: INCONCLUSIVE_BY_DECISION_NOISE (no r <= 20 can resolve the effect)
 *
 * The table was computed mechanically: for each k, r_confirm is the smallest r in [6, 20] whose
 * Wilson-95 upper bound on the pilot's point-estimate disagreement rate is <= 0.40.
 */
export const D1_R_CONFIRM_TABLE: Readonly<Record<number, number | "STOP">> = Object.freeze({
  6: 6,
  5: 14,
  4: "STOP",
  3: "STOP",
  2: "STOP",
  1: "STOP",
  0: "STOP"
});

export interface D1RConfirmDecisionV0 {
  readonly modal_count: number;
  readonly p_hat: number;
  readonly r_confirm: number | null;
  readonly noise_ceiling: number | null;
  readonly verdict: "R_CONFIRM_FROZEN" | "INCONCLUSIVE_BY_DECISION_NOISE";
}

export function deriveRConfirmV0(modalCount: number): D1RConfirmDecisionV0 {
  if (!Number.isInteger(modalCount) || modalCount < 0 || modalCount > 6) {
    throw new Error(`D1: modal_count must be an integer in [0,6], got ${String(modalCount)}`);
  }
  const mapped = D1_R_CONFIRM_TABLE[modalCount];
  const pHat = (6 - modalCount) / 6;
  if (mapped === undefined || mapped === "STOP") {
    return {
      modal_count: modalCount,
      p_hat: pHat,
      r_confirm: null,
      noise_ceiling: null,
      verdict: "INCONCLUSIVE_BY_DECISION_NOISE"
    };
  }
  const ceiling = wilsonUpper95(Math.round(pHat * mapped), mapped);
  return {
    modal_count: modalCount,
    p_hat: pHat,
    r_confirm: mapped,
    noise_ceiling: Number(ceiling.toFixed(4)),
    verdict: "R_CONFIRM_FROZEN"
  };
}

/**
 * The confirmatory positive rule, frozen:
 * between-level disagreement `d` must exceed the noise ceiling AND reach `D1_DELTA_MIN`.
 */
export function d1PositiveCriterionV0(decision: D1RConfirmDecisionV0, betweenLevelDisagreement: number): boolean {
  if (decision.r_confirm === null || decision.noise_ceiling === null) return false;
  return betweenLevelDisagreement > decision.noise_ceiling && betweenLevelDisagreement >= D1_DELTA_MIN;
}

// ---------------------------------------------------------------------------------------------
// FIX 3 — FRAME_MINIMAL is MANDATORY (not conditional)
// ---------------------------------------------------------------------------------------------

/**
 * FRAME_MINIMAL = the frozen primary contract with exactly THREE lines removed: the opening
 * banner, the closing banner, and the imperative measurement instruction
 * ("Choose exactly one decision for the claim presented in the observation.").
 *
 * It KEEPS: the supersede clause, the SUBJECT DATA law-preservation clause, the one-JSON-object
 * rule, the required/optional members, and all three construct anchors — so the decision
 * vocabulary, the anchors, the scoring, the state, the observation and the endpoint are unchanged.
 * It removes only non-essential measurement prose, including the instruction to *make* a decision.
 */
export function buildFrameMinimalContractV0(): string {
  const lines = V2_PRIMARY_SEMANTIC_CONTRACT.split("\n");
  const dropped = new Set<number>();
  for (const [index, line] of lines.entries()) {
    if (line.startsWith("--- DECISION PROBE OUTPUT CONTRACT")) dropped.add(index);
    else if (line.startsWith("--- END DECISION PROBE OUTPUT CONTRACT")) dropped.add(index);
    else if (line.startsWith("Choose exactly one decision")) dropped.add(index);
  }
  if (dropped.size !== 3) {
    throw new Error(`D1: FRAME_MINIMAL expected to drop exactly 3 lines, dropped ${String(dropped.size)}`);
  }
  return lines.filter((_line, index) => !dropped.has(index)).join("\n");
}

export const D1_FRAME_MINIMAL_CONTRACT: string = buildFrameMinimalContractV0();

/** Frozen four-way + null interpretation of Full vs Minimal. */
export const D1_FRAME_INTERPRETATION = Object.freeze({
  full_positive_minimal_positive_same_direction: "FRAME_ROBUST_STATE_SENSITIVITY",
  full_positive_minimal_null: "STATE_EFFECT_FRAME_DEPENDENT",
  full_null_minimal_positive: "MEASUREMENT_FRAME_SUPPRESSED_STATE_SENSITIVITY",
  opposite_directions: "INCONCLUSIVE_BY_FRAME_INTERACTION",
  full_null_minimal_null: "BELIEF_STATE_DECISION_SENSITIVITY_NOT_ESTABLISHED",
  precedence:
    "the frame verdicts cap the claim: FRAME_ROBUST_STATE_SENSITIVITY is required for the strongest claim; STATE_EFFECT_FRAME_DEPENDENT and MEASUREMENT_FRAME_SUPPRESSED_STATE_SENSITIVITY are weaker"
});

// ---------------------------------------------------------------------------------------------
// FIX 4 — STATE_REVERSAL (within-identity crossover). NOT a cross-identity swap.
// ---------------------------------------------------------------------------------------------

export const D1_REVERSAL_SEMANTICS = Object.freeze({
  name: "STATE_REVERSAL_WITHIN_IDENTITY_CROSSOVER",
  identities: 1,
  construction:
    "one canonical identity; HIGH and LOW materialised lawfully under byte-identical other fields; the direction is re-tested on an INDEPENDENT fresh construction of the same two states",
  proves:
    "within-identity canonical belief intervention — the decision follows the credence value, not a single artifact instance",
  does_not_prove: "cross-identity mediation (no second identity is created)",
  two_identity_policy:
    "a second identity requires its own separate preregistration arguing a necessary identification gain that does not introduce a new identity confound; the default and the only design in this round is one identity"
});

// ---------------------------------------------------------------------------------------------
// Verdict vocabulary
// ---------------------------------------------------------------------------------------------

export const D1_VERDICTS = Object.freeze([
  "BELIEF_STATE_DECISION_SENSITIVITY_SUPPORTED",
  "FRAME_ROBUST_STATE_SENSITIVITY",
  "STATE_EFFECT_FRAME_DEPENDENT",
  "MEASUREMENT_FRAME_SUPPRESSED_STATE_SENSITIVITY",
  "INCONCLUSIVE_BY_FRAME_INTERACTION",
  "BELIEF_STATE_DECISION_SENSITIVITY_NOT_ESTABLISHED",
  "STATE_EFFECT_NOT_SPECIFIC",
  "SCENARIO_BOUND",
  "STATE_REVERSAL_DOES_NOT_TRACK_BELIEF",
  "LANGUAGE_ONLY_EFFECT",
  "INCONCLUSIVE_BY_INSUFFICIENT_STATE_SEPARATION",
  "INCONCLUSIVE_BY_DECISION_NOISE",
  "D1_BLOCKED_BY_STATE_ISOLATION_FAILURE",
  "D1_HISTORY_ABSENCE_VIOLATED",
  "D1_BLOCKED_BY_INSTRUMENT_MISMATCH",
  "RESTART_EFFECT_RETAINED",
  "RESTART_EFFECT_LOST",
  "RESTORE_NOT_EXACT",
  // REVISION 2 (amendment): the categorical scorer and the negative-control path
  "CONTRAST_POSITIVE",
  "CONTRAST_NO_MOVEMENT",
  "CONTRAST_AMBIGUOUS",
  "INCONCLUSIVE_BY_INVALID_OUTPUTS",
  "NEGATIVE_CONTROL_HELD",
  "NEGATIVE_CONTROL_PROBE_INVALID"
] as const);

// ---------------------------------------------------------------------------------------------
// Call budget (FRAME_MINIMAL now mandatory)
// ---------------------------------------------------------------------------------------------

export const D1_CALL_BUDGET = Object.freeze({
  phase_a_offline: 0,
  phase_b_noise_pilot: 6,
  /** C = P1 + P2 x 2 levels x r ; D = P3 x 2 levels x r ; E = P1 frame-minimal x 2 levels x r ; F = reversal replication x 2 x r */
  formula: "6 + (4r + 2r + 2r + 2r) = 6 + 10r",
  minimum_r6: 6 + 10 * 6,
  expected_r14: 6 + 10 * 14,
  maximum_r20: 6 + 10 * 20,
  restart_addon_per_r: 2,
  conditional: ["restart (only after a positive direct state effect)"]
});

export interface D1ManifestV0 {
  readonly preregistration_version: typeof D1_PREREGISTRATION_VERSION;
  readonly proposition_label: string;
  readonly state_levels: typeof D1_STATE_LEVELS;
  readonly separation_gate: typeof D1_SEPARATION_GATE;
  readonly probes: readonly D1ProbeV0[];
  readonly r_confirm_table: Readonly<Record<number, number | "STOP">>;
  readonly noise_ceiling_target: number;
  readonly delta_min: number;
  readonly frame_minimal_contract: string;
  readonly frame_interpretation: typeof D1_FRAME_INTERPRETATION;
  readonly reversal_semantics: typeof D1_REVERSAL_SEMANTICS;
  readonly verdicts: readonly string[];
  readonly call_budget: typeof D1_CALL_BUDGET;
  readonly primary_contract_hash: HashV1;
  readonly frame_minimal_contract_hash: HashV1;
  readonly probe_manifest_hash: HashV1;
  readonly preregistration_hash: HashV1;
}

export async function deriveD1ManifestV0(): Promise<D1ManifestV0> {
  const probeManifestHash = await hashEnvelope(D1_HASH_PROJECTION_V0, { probes: D1_PROBES });
  const primaryHash = await hashEnvelope(
    "characteros-next/research/decision-probe-v1/c3-paraphrase-manifest/v0",
    { applied_override_block: V2_PRIMARY_SEMANTIC_CONTRACT }
  );
  const frameMinimalHash = await hashEnvelope(D1_HASH_PROJECTION_V0, {
    frame_minimal_contract: D1_FRAME_MINIMAL_CONTRACT
  });
  const body = {
    preregistration_version: D1_PREREGISTRATION_VERSION,
    proposition_label: D1_PROPOSITION_LABEL,
    state_levels: D1_STATE_LEVELS,
    separation_gate: D1_SEPARATION_GATE,
    probes: D1_PROBES,
    r_confirm_table: D1_R_CONFIRM_TABLE,
    noise_ceiling_target: D1_NOISE_CEILING_TARGET,
    delta_min: D1_DELTA_MIN,
    frame_minimal_contract: D1_FRAME_MINIMAL_CONTRACT,
    frame_interpretation: D1_FRAME_INTERPRETATION,
    reversal_semantics: D1_REVERSAL_SEMANTICS,
    verdicts: D1_VERDICTS,
    call_budget: D1_CALL_BUDGET,
    primary_contract_hash: primaryHash,
    frame_minimal_contract_hash: frameMinimalHash,
    probe_manifest_hash: probeManifestHash
  };
  return Object.freeze({
    ...body,
    preregistration_hash: await hashEnvelope(D1_HASH_PROJECTION_V0, body)
  });
}
