/* eslint-disable no-restricted-imports -- Isolated research preregistration over frozen built production roots (repository convention); zero production code changes and no production import of this module. */
/**
 * D1 AMENDMENT — REVISION 2. Two components, both frozen before any treatment call:
 *
 *   FIX A  the exact CATEGORICAL EFFECT SCORER (no researcher discretion, one verdict path per
 *          count vector, no post-hoc choice between the VERIFY and ACCEPT contrasts)
 *   FIX B  the deterministic COUNTERBALANCED EXECUTION SCHEDULE (arm order must not be collinear
 *          with call time, and must not be influenced by any model output)
 *
 * Nothing else changes: the CAUTION proposition, HIGH/LOW, the frozen probe texts, DecisionProbeV2,
 * the frame-minimal text, the noise pilot, the deterministic `r_confirm` rule, the history-absence
 * contract and the state-reversal design all stand as frozen in REVISION 1.
 */

import { hashEnvelope } from "../../../packages/subject-core/dist/index.js";
import type { HashV1 } from "../../../packages/subject-core/dist/index.js";

import { DECISION_PROBE_DECISIONS } from "../decision-probe-v0/contract.ts";

export const D1_AMENDMENT_VERSION = "d1-belief-state-sensitivity-revision-2" as const;
export const D1_AMENDMENT_HASH_PROJECTION_V0 =
  "characteros-next/research/d1-belief-state-sensitivity/revision-2/v0" as const;

// =============================================================================================
// FIX A — the categorical effect scorer
// =============================================================================================

export type D1Construct = (typeof DECISION_PROBE_DECISIONS)[number];

/** One cell's raw tally over ALL its pre-registered trials. Nothing may be removed. */
export interface D1CellCountsV0 {
  readonly n: number;
  readonly ACCEPT: number;
  readonly VERIFY: number;
  readonly REJECT: number;
  /** Parser rejections + transport failures. Kept SEPARATE for reporting, still in `n`. */
  readonly invalid: number;
}

/** Frozen constants of the scorer. */
export const D1_SCORING_CONSTANTS = Object.freeze({
  delta_min: 0.5,
  /** A cell whose invalid fraction exceeds this yields no contrast at all. */
  invalid_fraction_max: 0.5,
  /** Denominators are ALWAYS the cell's full pre-registered trial count. */
  denominator: "ALL_PREREGISTERED_TRIALS_INCLUDING_INVALID_AND_TRANSPORT_FAILURES",
  transport_failure_policy:
    "a transport failure IS a pre-registered trial: it stays in the denominator and is also counted as invalid; it is never removed, retried or replaced",
  /** Modal tie never resolves silently; a tie is `null` and fails any modal requirement. */
  modal_tie_policy: "counts equal at the top -> modal is null (a tie never satisfies a modal requirement)"
});

function cellFraction(count: number, counts: D1CellCountsV0): number {
  if (counts.n <= 0) return 0;
  return count / counts.n;
}

export interface D1ContrastV0 {
  readonly p_H_VERIFY: number;
  readonly p_L_VERIFY: number;
  readonly p_H_ACCEPT: number;
  readonly p_L_ACCEPT: number;
  readonly delta_verify: number;
  readonly delta_accept: number;
  readonly modal_H: D1Construct | null;
  readonly modal_L: D1Construct | null;
  readonly invalid_fraction: number;
  readonly noise_ceiling: number | null;
}

function modalOf(counts: D1CellCountsV0): D1Construct | null {
  const entries: readonly (readonly [D1Construct, number])[] = DECISION_PROBE_DECISIONS.map(
    (token) => [token, counts[token]] as const
  );
  const sorted = [...entries].sort((a, b) => b[1] - a[1]);
  const top = sorted[0];
  const second = sorted[1];
  if (top === undefined || second === undefined) return null;
  if (top[1] === second[1]) return null; // tie
  if (top[1] === 0) return null; // no decision at all
  return top[0];
}

/** The one and only contrast computation. Full denominators; no removal; no discretion. */
export function computeContrastV0(input: {
  readonly high: D1CellCountsV0;
  readonly low: D1CellCountsV0;
  readonly noise_ceiling: number | null;
}): D1ContrastV0 {
  const pHV = cellFraction(input.high.VERIFY, input.high);
  const pLV = cellFraction(input.low.VERIFY, input.low);
  const pHA = cellFraction(input.high.ACCEPT, input.high);
  const pLA = cellFraction(input.low.ACCEPT, input.low);
  const nTotal = input.high.n + input.low.n;
  return Object.freeze({
    p_H_VERIFY: pHV,
    p_L_VERIFY: pLV,
    p_H_ACCEPT: pHA,
    p_L_ACCEPT: pLA,
    delta_verify: pHV - pLV,
    delta_accept: pLA - pHA,
    modal_H: modalOf(input.high),
    modal_L: modalOf(input.low),
    invalid_fraction: nTotal <= 0 ? 0 : (input.high.invalid + input.low.invalid) / nTotal,
    noise_ceiling: input.noise_ceiling
  });
}

export const D1_CONTRAST_VERDICTS = Object.freeze([
  "CONTRAST_POSITIVE",
  "CONTRAST_NO_MOVEMENT",
  "CONTRAST_AMBIGUOUS",
  "INCONCLUSIVE_BY_INVALID_OUTPUTS"
] as const);
export type D1ContrastVerdict = (typeof D1_CONTRAST_VERDICTS)[number];

/**
 * THE frozen categorical decision rule. One input -> exactly one verdict. Both contrasts must
 * clear the bar JOINTLY; there is no "take the better one".
 */
export function classifyContrastV0(contrast: D1ContrastV0): D1ContrastVerdict {
  if (contrast.invalid_fraction > D1_SCORING_CONSTANTS.invalid_fraction_max) {
    return "INCONCLUSIVE_BY_INVALID_OUTPUTS";
  }
  const ceiling = contrast.noise_ceiling ?? 0;
  const positive =
    contrast.modal_H === "VERIFY" &&
    contrast.modal_L === "ACCEPT" &&
    contrast.delta_verify >= D1_SCORING_CONSTANTS.delta_min &&
    contrast.delta_accept >= D1_SCORING_CONSTANTS.delta_min &&
    contrast.delta_verify > ceiling &&
    contrast.delta_accept > ceiling;
  if (positive) return "CONTRAST_POSITIVE";
  // "no movement" in the pre-registered direction: neither contrast moves the right way.
  if (contrast.delta_verify <= 0 && contrast.delta_accept <= 0) return "CONTRAST_NO_MOVEMENT";
  return "CONTRAST_AMBIGUOUS";
}

// ---------------------------------------------------------------------------------------------
// Negative control (P3): a distinct verdict path from "state effect not specific"
// ---------------------------------------------------------------------------------------------

export const D1_NEGATIVE_CONTROL_VERDICTS = Object.freeze([
  "NEGATIVE_CONTROL_HELD",
  "NEGATIVE_CONTROL_PROBE_INVALID",
  "STATE_EFFECT_NOT_SPECIFIC"
] as const);
export type D1NegativeControlVerdict = (typeof D1_NEGATIVE_CONTROL_VERDICTS)[number];

/**
 * P3 must first show its OWN pre-registered result (ACCEPT modal in both levels). If the probe
 * itself fails to produce that, the probe is invalid — that is NOT a specificity failure.
 */
export function classifyNegativeControlV0(contrast: D1ContrastV0): D1NegativeControlVerdict {
  if (contrast.modal_H !== "ACCEPT" || contrast.modal_L !== "ACCEPT") {
    return "NEGATIVE_CONTROL_PROBE_INVALID";
  }
  const ceiling = contrast.noise_ceiling ?? 0;
  if (Math.abs(contrast.delta_verify) > ceiling || Math.abs(contrast.delta_accept) > ceiling) {
    return "STATE_EFFECT_NOT_SPECIFIC";
  }
  return "NEGATIVE_CONTROL_HELD";
}

// ---------------------------------------------------------------------------------------------
// Frame table — Full and Minimal MUST use this same scorer and the same thresholds
// ---------------------------------------------------------------------------------------------

export function classifyFrameV0(input: {
  readonly full: D1ContrastVerdict;
  readonly minimal: D1ContrastVerdict;
}): string {
  const pos = (v: D1ContrastVerdict): boolean => v === "CONTRAST_POSITIVE";
  if (pos(input.full) && pos(input.minimal)) return "FRAME_ROBUST_STATE_SENSITIVITY";
  if (pos(input.full) && !pos(input.minimal)) return "STATE_EFFECT_FRAME_DEPENDENT";
  if (!pos(input.full) && pos(input.minimal)) return "MEASUREMENT_FRAME_SUPPRESSED_STATE_SENSITIVITY";
  return "BELIEF_STATE_DECISION_SENSITIVITY_NOT_ESTABLISHED";
}

// =============================================================================================
// FIX B — deterministic counterbalanced execution schedule
// =============================================================================================

export const D1_BLOCKS = Object.freeze([
  "P1_FULL",
  "P2_FULL",
  "P3_NEGATIVE_CONTROL",
  "P1_FRAME_MINIMAL",
  "STATE_REVERSAL",
  "RESTART_CONTRAST"
] as const);
export type D1BlockId = (typeof D1_BLOCKS)[number];

export interface D1ScheduledTrialV0 {
  readonly ordinal: number;
  readonly block: D1BlockId;
  readonly arm: "HIGH" | "LOW";
  readonly replicate_ordinal: number;
}

/** Deterministic 32-bit PRNG. Same seed -> same stream, in every process and every runtime. */
function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    // xorshift32
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 4294967296;
  };
}

function seedFromHash(hash: string): number {
  const hex = hash.replace(/^sha256:/, "").slice(0, 8);
  return Number.parseInt(hex, 16) >>> 0;
}

/**
 * One block's order: `r` PAIRS of (HIGH, LOW). Fisher-Yates permutes the pair order and a seeded
 * bit flips each pair internally. This guarantees (a) exact arm balance, (b) a maximum run length
 * of 2, so `all HIGH -> all LOW` is structurally impossible, and (c) full determinism.
 */
export function planBlockV0(block: D1BlockId, r: number, seed: number): readonly ("HIGH" | "LOW")[] {
  const rng = makeRng(seed);
  const pairs: ("HIGH" | "LOW")[][] = Array.from({ length: r }, () => ["HIGH", "LOW"]);
  // Fisher-Yates over pair positions
  for (let i = pairs.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const a = pairs[i];
    const b = pairs[j];
    if (a === undefined || b === undefined) continue;
    pairs[i] = b;
    pairs[j] = a;
  }
  const flat: ("HIGH" | "LOW")[] = [];
  for (const pair of pairs) {
    const flip = rng() < 0.5;
    const one = pair[0];
    const two = pair[1];
    if (one === undefined || two === undefined) continue;
    flat.push(flip ? two : one, flip ? one : two);
  }
  return flat;
}

export interface D1ScheduleV0 {
  readonly amendment_version: typeof D1_AMENDMENT_VERSION;
  readonly seed_source: string;
  readonly r_confirm: number;
  readonly blocks: readonly {
    readonly block: D1BlockId;
    readonly arms: readonly ("HIGH" | "LOW")[];
    readonly high_count: number;
    readonly low_count: number;
    readonly max_run_length: number;
  }[];
  readonly trials: readonly D1ScheduledTrialV0[];
  readonly outcome_blind: true;
  readonly replicate_ordinal_in_request_bytes: false;
  readonly schedule_hash: HashV1;
}

/** Pure function of (preregistration hash, r, block list). It takes NO trial output. */
export async function planScheduleV0(input: {
  readonly preregistration_hash: string;
  readonly r_confirm: number;
  readonly blocks: readonly D1BlockId[];
}): Promise<D1ScheduleV0> {
  const baseSeed = seedFromHash(input.preregistration_hash);
  const trials: D1ScheduledTrialV0[] = [];
  const blocks: { block: D1BlockId; arms: readonly ("HIGH" | "LOW")[]; high_count: number; low_count: number; max_run_length: number }[] = [];
  let ordinal = 0;
  for (const block of input.blocks) {
    const seed = (baseSeed ^ (block.length * 2654435761) ^ input.r_confirm) >>> 0;
    const arms = planBlockV0(block, input.r_confirm, seed);
    let high = 0;
    let low = 0;
    let run = 0;
    let maxRun = 0;
    let previous: string | null = null;
    for (const [index, arm] of arms.entries()) {
      if (arm === "HIGH") high += 1;
      else low += 1;
      run = arm === previous ? run + 1 : 1;
      maxRun = Math.max(maxRun, run);
      previous = arm;
      ordinal += 1;
      trials.push({ ordinal, block, arm, replicate_ordinal: index + 1 });
    }
    blocks.push({ block, arms, high_count: high, low_count: low, max_run_length: maxRun });
  }
  const body = {
    amendment_version: D1_AMENDMENT_VERSION,
    seed_source: input.preregistration_hash,
    r_confirm: input.r_confirm,
    blocks,
    trials,
    outcome_blind: true as const,
    replicate_ordinal_in_request_bytes: false as const
  };
  return Object.freeze({
    ...body,
    schedule_hash: await hashEnvelope(D1_AMENDMENT_HASH_PROJECTION_V0, body)
  });
}

export const D1_SCHEDULE_PROPERTIES = Object.freeze({
  determinism: "same preregistration hash and r_confirm -> byte-identical schedule",
  counterbalancing: "each block is r pairs of (HIGH, LOW); max run length is 2",
  forbidden_orders: "all HIGH then all LOW, and all LOW then all HIGH, are structurally impossible",
  outcome_blindness: "the generator takes no trial output; the schedule is complete before the block's first call",
  ordinal_handling: "replicate_ordinal is bookkeeping only and never enters the model-facing request bytes",
  pilot_separation: "the STATE_NEUTRAL noise pilot is separate; only its modal_count feeds r_confirm, and the treatment schedule is generated after r_confirm is frozen",
  temporal_drift_caveat:
    "counterbalancing does NOT prove provider drift is absent; it only prevents the treatment arm from being fully collinear with call time"
});
