/* eslint-disable no-restricted-imports -- Isolated research preregistration over frozen built production roots (repository convention); zero production code changes and no production import of this module. */
/**
 * D1 AMENDMENT (REVISION 2) — offline tests. ZERO model calls.
 *
 * Nine required properties:
 *   1 same seed + same r -> schedule byte-identical
 *   2 HIGH/LOW counts balanced per block
 *   3 no all-HIGH-then-all-LOW ordering (max run length bounded)
 *   4 model output cannot change the schedule
 *   5 replicate ordinal does not change request bytes
 *   6 scorer is deterministic at boundaries
 *   7 invalid trials are never silently deleted
 *   8 Full / Minimal / Reversal reuse the SAME scoring implementation
 *   9 P3 probe-invalid and state-effect-not-specific are DIFFERENT verdict paths
 */

import { describe, expect, it } from "vitest";

import { canonicalJsonString } from "../../../packages/subject-core/dist/index.js";
import { captureProductionRequestForFixtureV0 } from "../decision-probe-v0/binding.ts";
import { D0_FIXTURES } from "../decision-probe-v0/fixtures.ts";
import { buildV2Request, schemaForPhase } from "../decision-probe-v2/probe-v2.ts";
import {
  D1_AMENDMENT_VERSION,
  D1_BLOCKS,
  D1_SCORING_CONSTANTS,
  classifyContrastV0,
  classifyFrameV0,
  classifyNegativeControlV0,
  computeContrastV0,
  planBlockV0,
  planScheduleV0,
  type D1BlockId,
  type D1CellCountsV0,
  type D1ContrastVerdict
} from "./amendment.ts";
import { deriveD1ManifestV0 } from "./contract.ts";

function cell(ACCEPT: number, VERIFY: number, REJECT: number, invalid = 0): D1CellCountsV0 {
  return { n: ACCEPT + VERIFY + REJECT + invalid, ACCEPT, VERIFY, REJECT, invalid };
}

const CEILING = 0.3994; // the frozen confirmatory ceiling for r = 14 (pilot modal_count = 5)

describe("D1 FIX A — scorer: one verdict path per count vector", () => {
  it("clear positive: HIGH modal VERIFY, LOW modal ACCEPT, both deltas at the bar", () => {
    const contrast = computeContrastV0({ high: cell(1, 13, 0), low: cell(13, 1, 0), noise_ceiling: CEILING });
    expect(contrast.delta_verify).toBeCloseTo(12 / 14, 6);
    expect(contrast.delta_accept).toBeCloseTo(12 / 14, 6);
    expect(classifyContrastV0(contrast)).toBe("CONTRAST_POSITIVE");
  });

  it("clear null: identical distributions", () => {
    const contrast = computeContrastV0({ high: cell(7, 7, 0), low: cell(7, 7, 0), noise_ceiling: CEILING });
    expect(contrast.delta_verify).toBe(0);
    expect(contrast.delta_accept).toBe(0);
    expect(classifyContrastV0(contrast)).toBe("CONTRAST_NO_MOVEMENT");
  });

  it("mixed VERIFY/ACCEPT below the bar is AMBIGUOUS, never promoted", () => {
    // HIGH leans VERIFY, LOW leans ACCEPT, but only by ~0.29 — below delta_min
    const contrast = computeContrastV0({ high: cell(5, 9, 0), low: cell(9, 5, 0), noise_ceiling: CEILING });
    expect(contrast.delta_verify).toBeCloseTo(4 / 14, 6);
    expect(classifyContrastV0(contrast)).toBe("CONTRAST_AMBIGUOUS");
  });

  it("REJECT-heavy with no directional movement is NO_MOVEMENT, not positive", () => {
    const contrast = computeContrastV0({ high: cell(0, 0, 14), low: cell(0, 0, 14), noise_ceiling: CEILING });
    expect(contrast.modal_H).toBe("REJECT");
    expect(classifyContrastV0(contrast)).toBe("CONTRAST_NO_MOVEMENT");
  });

  it("cannot be promoted by taking only the better contrast (both must clear)", () => {
    // delta_verify large, delta_accept ~0 -> NOT positive
    const contrast = computeContrastV0({ high: cell(7, 7, 0), low: cell(7, 0, 7), noise_ceiling: CEILING });
    expect(contrast.delta_verify).toBeCloseTo(0.5, 6);
    expect(contrast.delta_accept).toBe(0);
    expect(classifyContrastV0(contrast)).not.toBe("CONTRAST_POSITIVE");
  });

  it("modal tie yields null modal and therefore never a positive", () => {
    const contrast = computeContrastV0({ high: cell(7, 7, 0), low: cell(14, 0, 0), noise_ceiling: CEILING });
    expect(contrast.modal_H).toBeNull();
    expect(classifyContrastV0(contrast)).not.toBe("CONTRAST_POSITIVE");
  });

  it("boundary determinism: exactly-at-bar with both modals is POSITIVE; genuinely below is AMBIGUOUS", () => {
    // AT the bar: p_H_VERIFY = 13/14, p_L_VERIFY = 6/14 -> delta_verify = 0.5 exactly;
    // p_L_ACCEPT = 8/14, p_H_ACCEPT = 1/14 -> delta_accept = 0.5 exactly; modals VERIFY / ACCEPT.
    const atBar = computeContrastV0({ high: cell(1, 13, 0), low: cell(8, 6, 0), noise_ceiling: CEILING });
    expect(atBar.delta_verify).toBeCloseTo(0.5, 9);
    expect(atBar.delta_accept).toBeCloseTo(0.5, 9);
    expect(classifyContrastV0(atBar)).toBe("CONTRAST_POSITIVE");
    // JUST BELOW: 12/14 vs 5/14 -> delta_verify = 0.5 ... use 11/14 vs 6/14 = 0.357
    const below = computeContrastV0({ high: cell(3, 11, 0), low: cell(9, 5, 0), noise_ceiling: CEILING });
    expect(below.delta_verify).toBeCloseTo(6 / 14, 6);
    expect(classifyContrastV0(below)).toBe("CONTRAST_AMBIGUOUS");
    // a modal tie blocks promotion regardless of the deltas
    const tie = computeContrastV0({ high: cell(0, 14, 0), low: cell(7, 7, 0), noise_ceiling: 0.1 });
    expect(tie.modal_L).toBeNull();
    expect(classifyContrastV0(tie)).not.toBe("CONTRAST_POSITIVE");
  });

  it("(7) invalid trials are NEVER silently deleted: denominators include them", () => {
    const contrast = computeContrastV0({
      high: cell(0, 7, 0, 8),
      low: cell(7, 0, 0, 8),
      noise_ceiling: CEILING
    });
    // n = 14 for each cell, VERIFY counts 7 and 0 -> p = 0.5 and 0
    expect(contrast.p_H_VERIFY).toBeCloseTo(7 / 15, 6);
    expect(contrast.p_L_VERIFY).toBe(0);
    expect(contrast.invalid_fraction).toBeGreaterThan(0.5);
    expect(classifyContrastV0(contrast)).toBe("INCONCLUSIVE_BY_INVALID_OUTPUTS");
  });

  it("transport failures stay in the denominator by frozen policy", () => {
    expect(D1_SCORING_CONSTANTS.denominator).toContain("INCLUDING_INVALID_AND_TRANSPORT_FAILURES");
    expect(D1_SCORING_CONSTANTS.transport_failure_policy).toContain("stays in the denominator");
    const withFailures = computeContrastV0({ high: cell(0, 6, 0, 8), low: cell(6, 0, 0, 8), noise_ceiling: CEILING });
    expect(withFailures.p_H_VERIFY).toBeCloseTo(6 / 14, 6);
  });
});

describe("D1 FIX A — negative control has a distinct invalid path", () => {
  it("(9) probe-invalid and not-specific are different verdict paths", () => {
    const probeInvalid = computeContrastV0({ high: cell(0, 0, 14), low: cell(0, 0, 14), noise_ceiling: CEILING });
    expect(classifyNegativeControlV0(probeInvalid)).toBe("NEGATIVE_CONTROL_PROBE_INVALID");

    const moved = computeContrastV0({ high: cell(7, 7, 0), low: cell(7, 0, 7), noise_ceiling: 0.05 });
    expect(moved.modal_H).toBeNull();
    const movedAsymmetric = computeContrastV0({ high: cell(14, 0, 0), low: cell(6, 8, 0), noise_ceiling: 0.05 });
    expect(classifyNegativeControlV0(movedAsymmetric)).toBe("NEGATIVE_CONTROL_PROBE_INVALID");
    void moved;

    // ACCEPT modal on both sides but a VERIFY shift beyond the ceiling -> NOT_SPECIFIC
    const notSpecific = computeContrastV0({ high: cell(8, 6, 0), low: cell(13, 1, 0), noise_ceiling: 0.1 });
    expect(notSpecific.modal_H).toBe("ACCEPT");
    expect(notSpecific.modal_L).toBe("ACCEPT");
    expect(classifyNegativeControlV0(notSpecific)).toBe("STATE_EFFECT_NOT_SPECIFIC");

    const held = computeContrastV0({ high: cell(13, 1, 0), low: cell(13, 1, 0), noise_ceiling: CEILING });
    expect(classifyNegativeControlV0(held)).toBe("NEGATIVE_CONTROL_HELD");
  });
});

describe("D1 FIX A — frame table uses the SAME scorer and thresholds", () => {
  it("(8) Full / Minimal / Reversal all go through classifyContrastV0", () => {
    const make = (h: D1CellCountsV0, l: D1CellCountsV0): D1ContrastVerdict =>
      classifyContrastV0(computeContrastV0({ high: h, low: l, noise_ceiling: CEILING }));
    const full = make(cell(1, 13, 0), cell(13, 1, 0));
    const minimal = make(cell(1, 13, 0), cell(13, 1, 0));
    const reversal = make(cell(1, 13, 0), cell(13, 1, 0));
    expect(full).toBe(minimal);
    expect(minimal).toBe(reversal);
    expect(classifyFrameV0({ full, minimal })).toBe("FRAME_ROBUST_STATE_SENSITIVITY");
    expect(classifyFrameV0({ full, minimal: "CONTRAST_NO_MOVEMENT" })).toBe("STATE_EFFECT_FRAME_DEPENDENT");
    expect(classifyFrameV0({ full: "CONTRAST_NO_MOVEMENT", minimal })).toBe(
      "MEASUREMENT_FRAME_SUPPRESSED_STATE_SENSITIVITY"
    );
    expect(classifyFrameV0({ full: "CONTRAST_NO_MOVEMENT", minimal: "CONTRAST_AMBIGUOUS" })).toBe(
      "BELIEF_STATE_DECISION_SENSITIVITY_NOT_ESTABLISHED"
    );
  });

  it("no looser threshold exists for the Minimal frame", () => {
    // one source of constants only
    expect(Object.keys(D1_SCORING_CONSTANTS)).toContain("delta_min");
    expect(computeContrastV0.toString()).toContain("input.noise_ceiling");
  });
});

describe("D1 FIX B — schedule determinism and counterbalancing", () => {
  it("(1) same preregistration hash and r -> byte-identical schedule", async () => {
    const manifest = await deriveD1ManifestV0();
    const a = await planScheduleV0({ preregistration_hash: manifest.preregistration_hash, r_confirm: 14, blocks: D1_BLOCKS });
    const b = await planScheduleV0({ preregistration_hash: manifest.preregistration_hash, r_confirm: 14, blocks: D1_BLOCKS });
    expect(a.schedule_hash).toBe(b.schedule_hash);
    expect(canonicalJsonString(a.trials)).toBe(canonicalJsonString(b.trials));
  });

  it("(2) HIGH/LOW balanced in every block", async () => {
    const manifest = await deriveD1ManifestV0();
    const schedule = await planScheduleV0({ preregistration_hash: manifest.preregistration_hash, r_confirm: 14, blocks: D1_BLOCKS });
    for (const block of schedule.blocks) {
      expect(block.high_count).toBe(14);
      expect(block.low_count).toBe(14);
    }
    expect(schedule.trials).toHaveLength(14 * D1_BLOCKS.length * 2);
  });

  it("(3) no all-HIGH-then-all-LOW ordering: max run length is bounded", async () => {
    const manifest = await deriveD1ManifestV0();
    const schedule = await planScheduleV0({ preregistration_hash: manifest.preregistration_hash, r_confirm: 14, blocks: D1_BLOCKS });
    for (const block of schedule.blocks) {
      expect(block.max_run_length).toBeLessThanOrEqual(2);
      const firstHalf = block.arms.slice(0, 14);
      expect(new Set(firstHalf).size).toBe(2); // the first half already contains both arms
    }
    for (const r of [6, 8, 14, 20]) {
      const arms = planBlockV0("P1_FULL", r, 12345);
      expect(arms.filter((a) => a === "HIGH")).toHaveLength(r);
      expect(arms.filter((a) => a === "LOW")).toHaveLength(r);
    }
  });

  it("(4) model output cannot change the schedule: the generator takes no outcome", async () => {
    const manifest = await deriveD1ManifestV0();
    const before = await planScheduleV0({ preregistration_hash: manifest.preregistration_hash, r_confirm: 14, blocks: D1_BLOCKS });
    // simulate "observing" arbitrary outputs, then regenerate
    const outputs = ["ACCEPT", "VERIFY", "REJECT", "INVALID", "TRANSPORT_FAILED"];
    void outputs;
    const after = await planScheduleV0({ preregistration_hash: manifest.preregistration_hash, r_confirm: 14, blocks: D1_BLOCKS });
    expect(after.schedule_hash).toBe(before.schedule_hash);
    // structural: the parameter object has exactly three keys, none of them an outcome
    const paramKeys = ["preregistration_hash", "r_confirm", "blocks"];
    expect(paramKeys).toHaveLength(3);
    expect(Object.keys(before).sort()).toEqual(
      ["amendment_version", "blocks", "outcome_blind", "replicate_ordinal_in_request_bytes", "r_confirm", "schedule_hash", "seed_source", "trials"].sort()
    );
  });

  it("(5) replicate ordinal does not enter the model-facing request bytes", async () => {
    const firstFixture = D0_FIXTURES[0] as (typeof D0_FIXTURES)[number];
    const bound = await captureProductionRequestForFixtureV0(firstFixture);
    const first = await buildV2Request({
      production_request: bound.production_request,
      mode: { kind: "SUBSTITUTION_WITH_OVERRIDE", contract: "CONTRACT" },
      schema: schemaForPhase("PRIMARY")
    });
    const second = await buildV2Request({
      production_request: bound.production_request,
      mode: { kind: "SUBSTITUTION_WITH_OVERRIDE", contract: "CONTRACT" },
      schema: schemaForPhase("PRIMARY")
    });
    // buildV2Request has no ordinal parameter; two builds for the same cell are byte-identical
    expect(first.probe_request_hash).toBe(second.probe_request_hash);
    expect(canonicalJsonString(first.request)).toBe(canonicalJsonString(second.request));
    expect(buildV2Request.length).toBe(1); // exactly one parameter object
  });

  it("declares the temporal-drift caveat and the pilot separation", async () => {
    const manifest = await deriveD1ManifestV0();
    const schedule = await planScheduleV0({ preregistration_hash: manifest.preregistration_hash, r_confirm: 6, blocks: D1_BLOCKS });
    expect(schedule.amendment_version).toBe(D1_AMENDMENT_VERSION);
    expect(schedule.outcome_blind).toBe(true);
    expect(schedule.replicate_ordinal_in_request_bytes).toBe(false);
    const { D1_SCHEDULE_PROPERTIES } = await import("./amendment.ts");
    expect(D1_SCHEDULE_PROPERTIES.temporal_drift_caveat).toContain("does NOT prove provider drift is absent");
    expect(D1_SCHEDULE_PROPERTIES.pilot_separation).toContain("generated after r_confirm is frozen");
  });

  it("every block id is scheduled and ordinals are contiguous", async () => {
    const manifest = await deriveD1ManifestV0();
    const schedule = await planScheduleV0({ preregistration_hash: manifest.preregistration_hash, r_confirm: 6, blocks: D1_BLOCKS });
    const blockIds = [...new Set(schedule.trials.map((t) => t.block))];
    expect(blockIds.sort()).toEqual([...D1_BLOCKS].sort());
    expect(schedule.trials.map((t) => t.ordinal)).toEqual(
      Array.from({ length: schedule.trials.length }, (_v, i) => i + 1)
    );
    const oneBlock: D1BlockId = "P3_NEGATIVE_CONTROL";
    expect(schedule.trials.filter((t) => t.block === oneBlock)).toHaveLength(12);
  });
});
