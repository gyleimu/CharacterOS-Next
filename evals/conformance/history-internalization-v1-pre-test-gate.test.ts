/**
 * Conformance test for the HISTORY_INTERNALIZATION_V1 §7 pre-test state gate.
 *
 * Mandated by §15 of the design doc ("a conformance test under `evals/conformance/` that re-verifies the
 * deterministic and persisted-evidence invariants at zero model calls").
 *
 * It pins the RULES, not one observation. Every predicate is exercised with an input that must flip it,
 * because the repository's own law is that a check which cannot fail certifies nothing — and because a
 * gate's whole value is that it CAN stop a run.
 */

import { describe, expect, it } from "vitest";

import {
  affectGateReasonV0,
  affectNonDegenerateV0,
  beliefNonDegenerateV0,
  decidePreTestGateV0,
  relationshipCapSatisfiedV0,
  relationshipCarriesContrastV0,
  type DimensionReadingV0
} from "../../research/experiments/history-internalization-v1/pre-test-gate.ts";

const reading = (dimension: string, passes: boolean | null): DimensionReadingV0 => ({
  dimension,
  value: null,
  rule: "test",
  passes,
  note: "test"
});

describe("§7 affect — activation must not be pinned at 1.0", () => {
  it("FAILS at exactly 1.0 (the canonical subject's measured value) and at any value >= 1", () => {
    expect(affectNonDegenerateV0({ activation: 1, valence: 0.99 })).toBe(false);
    expect(affectNonDegenerateV0({ activation: 1.0000001, valence: 0 })).toBe(false);
  });

  it("PASSES away from the bound (the fresh subjects' measured values)", () => {
    expect(affectNonDegenerateV0({ activation: 0.4905778777901465, valence: 0.14528893889507324 })).toBe(true);
    expect(affectNonDegenerateV0({ activation: 0.5044848548777169, valence: -0.1767846399309277 })).toBe(true);
  });

  it("names the TWO distinct failure causes, so the reason never misreports the cause", () => {
    expect(affectGateReasonV0(1)).toContain("PINNED AT THE BOUND");
    expect(affectGateReasonV0(1.0000001)).toContain("OUT OF DOMAIN");
    expect(affectGateReasonV0(-0.01)).toContain("OUT OF DOMAIN");
    expect(affectGateReasonV0(0.49)).toContain("inside [0,1)");
  });

  it("is NULL — not true — when the input is unreadable", () => {
    expect(affectNonDegenerateV0({ activation: null, valence: 0 })).toBeNull();
    expect(affectNonDegenerateV0({ activation: "1", valence: 0 })).toBeNull();
  });
});

describe("§7 belief — 0 < credence < 1 for at least one item", () => {
  it("FAILS when there are no items, and when every item is at a bound", () => {
    expect(beliefNonDegenerateV0([])).toBe(false);
    expect(beliefNonDegenerateV0([{ credence: 1 }, { credence: 0 }])).toBe(false);
  });

  it("PASSES when at least one item is strictly inside (0,1)", () => {
    expect(beliefNonDegenerateV0([{ credence: 1 }, { credence: 0.4 }])).toBe(true);
    expect(beliefNonDegenerateV0([{ credence: 0.8000000000000003 }])).toBe(true);
  });

  it("is NULL when the block is unreadable", () => {
    expect(beliefNonDegenerateV0(null)).toBeNull();
  });
});

describe("§7 relationship — below the 32/32 cap", () => {
  it("an EMPTY set satisfies the cap VACUOUSLY but carries no contrast (the corrected reading)", () => {
    // The first implementation treated empty as a bound failure. §7 says "below the cap"; empty is below
    // the cap. Conflating "not at a bound" with "carries content" would have misreported a dimension that
    // is merely empty as a saturated one.
    expect(relationshipCapSatisfiedV0([])).toBe(true);
    expect(relationshipCarriesContrastV0([])).toBe(false);
  });

  it("FAILS at the cap and passes below it", () => {
    expect(relationshipCapSatisfiedV0([{ familiarity_credits: 32 }])).toBe(false);
    expect(relationshipCapSatisfiedV0([{ familiarity_credits: 31 }])).toBe(true);
    expect(relationshipCarriesContrastV0([{ familiarity_credits: 4 }])).toBe(true);
  });
});

describe("§7 gate — the conjunction, and its verdict vocabulary", () => {
  it("INCONCLUSIVE_BY_SATURATION whenever ANY dimension is at a bound", () => {
    const decision = decidePreTestGateV0({
      dimensions: [reading("affect", false), reading("belief", true)],
      delta_state: null,
      delta_min: null
    });
    expect(decision.outcome).toBe("INCONCLUSIVE_BY_SATURATION");
    expect(decision.reasons.join(" ")).toContain("affect IS AT A BOUND");
  });

  it("a bound dominates: it is reported even when other dimensions are merely unreadable", () => {
    const decision = decidePreTestGateV0({
      dimensions: [reading("affect", false), reading("belief", null)],
      delta_state: null,
      delta_min: null
    });
    expect(decision.outcome).toBe("INCONCLUSIVE_BY_SATURATION");
  });

  it("GATE_INCOMPLETE — never a pass — when a dimension is unreadable or δ is undeclared", () => {
    expect(
      decidePreTestGateV0({ dimensions: [reading("belief", null)], delta_state: null, delta_min: null }).outcome
    ).toBe("GATE_INCOMPLETE");
    expect(
      decidePreTestGateV0({ dimensions: [reading("belief", true)], delta_state: null, delta_min: null }).outcome
    ).toBe("GATE_INCOMPLETE");
    // An EMPTY dimension list must not pass either: a gate that inspected nothing is not a pass.
    expect(decidePreTestGateV0({ dimensions: [], delta_state: null, delta_min: null }).outcome).toBe("GATE_INCOMPLETE");
  });

  it("GATE_PASS only with every dimension readable and non-degenerate AND δ_state >= δ_min", () => {
    expect(
      decidePreTestGateV0({ dimensions: [reading("affect", true)], delta_state: 0.4, delta_min: 0.2 }).outcome
    ).toBe("GATE_PASS");
    expect(
      decidePreTestGateV0({ dimensions: [reading("affect", true)], delta_state: 0.2, delta_min: 0.2 }).outcome
    ).toBe("GATE_PASS");
  });

  it("δ_state BELOW δ_min FAILS the gate — it must never pass (a defect found by this suite)", () => {
    // The first version pushed the δ reason but still returned GATE_PASS, so a run whose state distance
    // was too small would have been allowed to proceed. §7's sentence is blanket — "If the gate fails,
    // the run is recorded as INCONCLUSIVE_BY_SATURATION" — so the verdict is that token, with the reason
    // naming δ rather than inventing a token the frozen text does not contain.
    const decision = decidePreTestGateV0({
      dimensions: [reading("affect", true), reading("belief", true), reading("relationship", true)],
      delta_state: 0.1,
      delta_min: 0.2
    });
    expect(decision.outcome).toBe("INCONCLUSIVE_BY_SATURATION");
    expect(decision.reasons.join(" ")).toContain("δ_state 0.1 < δ_min 0.2");
  });
});
