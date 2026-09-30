/* eslint-disable no-restricted-imports -- Isolated research preregistration over frozen built production roots (repository convention); zero production code changes and no production import of this module. */
/**
 * D1 preregistration — offline audits. ZERO model calls.
 *
 * Verifies the four fixes before any real call can be made:
 *   FIX 1 deterministic r_confirm, no discretion, honest STOP
 *   FIX 2 literal probe bytes frozen and hashed; P3 maps onto the closed set with a frozen
 *         expected decision and is not a bare arithmetic question
 *   FIX 3 FRAME_MINIMAL mandatory, byte-diff audited, keeps anchors/vocabulary/scoring surface
 *   FIX 4 STATE_REVERSAL is within-identity; no second identity is created
 * plus the state-line lexical audit that protects the CAUTION proposition.
 */

import { describe, expect, it } from "vitest";

import { canonicalJsonString } from "../../../packages/subject-core/dist/index.js";
import { DECISION_PROBE_DECISIONS } from "../decision-probe-v0/contract.ts";
import { V2_PRIMARY_SEMANTIC_CONTRACT } from "../decision-probe-v2/contract.ts";
import {
  D1_CALL_BUDGET,
  D1_DELTA_MIN,
  D1_FRAME_INTERPRETATION,
  D1_FRAME_MINIMAL_CONTRACT,
  D1_P1,
  D1_P2,
  D1_P3,
  D1_PROPOSITION_LABEL,
  D1_PROBES,
  D1_R_CONFIRM_TABLE,
  D1_REVERSAL_SEMANTICS,
  D1_SEPARATION_GATE,
  D1_STATE_LEVELS,
  D1_VERDICTS,
  deriveD1ManifestV0,
  deriveRConfirmV0,
  d1PositiveCriterionV0,
  wilsonUpper95
} from "./contract.ts";

describe("D1 FIX 1 — deterministic r_confirm, no researcher discretion", () => {
  it("maps the pilot mechanically and uniquely", () => {
    expect(deriveRConfirmV0(6).r_confirm).toBe(6);
    expect(deriveRConfirmV0(5).r_confirm).toBe(14);
    expect(deriveRConfirmV0(6).r_confirm).toBe(deriveRConfirmV0(6).r_confirm);
    for (const k of [4, 3, 2, 1, 0]) {
      expect(deriveRConfirmV0(k).verdict).toBe("INCONCLUSIVE_BY_DECISION_NOISE");
      expect(deriveRConfirmV0(k).r_confirm).toBeNull();
    }
  });

  it("never exceeds 20 and never goes below 6", () => {
    for (const value of Object.values(D1_R_CONFIRM_TABLE)) {
      if (value === "STOP") continue;
      expect(value).toBeGreaterThanOrEqual(6);
      expect(value).toBeLessThanOrEqual(20);
    }
  });

  it("the frozen table is exactly what the Wilson rule computes", () => {
    for (const [key, mapped] of Object.entries(D1_R_CONFIRM_TABLE)) {
      const k = Number(key);
      if (mapped === "STOP") continue;
      const pHat = (6 - k) / 6;
      expect(wilsonUpper95(Math.round(pHat * mapped), mapped)).toBeLessThanOrEqual(0.4);
      // and no smaller r in range would have satisfied it
      for (let smaller = 6; smaller < mapped; smaller += 1) {
        expect(wilsonUpper95(Math.round(pHat * smaller), smaller)).toBeGreaterThan(0.4);
      }
    }
  });

  it("the positive criterion requires beating BOTH the noise ceiling and DELTA_MIN", () => {
    const decision = deriveRConfirmV0(6);
    expect(decision.noise_ceiling).not.toBeNull();
    const ceiling = decision.noise_ceiling ?? 0;
    expect(d1PositiveCriterionV0(decision, ceiling - 0.01)).toBe(false);
    expect(d1PositiveCriterionV0(decision, D1_DELTA_MIN)).toBe(true);
    expect(d1PositiveCriterionV0(decision, D1_DELTA_MIN - 0.01)).toBe(false);
    expect(d1PositiveCriterionV0(deriveRConfirmV0(2), 1)).toBe(false);
  });

  it("STATE_NEUTRAL is noise-calibration only and never a treatment level", () => {
    expect(D1_STATE_LEVELS.NEUTRAL_NOISE_CALIBRATION).toBe(0.5);
    const levels = Object.keys(D1_STATE_LEVELS).filter((k) => k !== "NEUTRAL_NOISE_CALIBRATION");
    expect(levels.sort()).toEqual(["HIGH", "LOW"]);
    expect(D1_STATE_LEVELS.HIGH).toBe(0.8);
    expect(D1_STATE_LEVELS.LOW).toBe(0.2);
    expect(D1_STATE_LEVELS.HIGH - D1_STATE_LEVELS.LOW).toBeGreaterThanOrEqual(D1_SEPARATION_GATE.min_separation);
    for (const level of [D1_STATE_LEVELS.HIGH, D1_STATE_LEVELS.LOW]) {
      expect(level).toBeGreaterThanOrEqual(D1_SEPARATION_GATE.bound_margin);
      expect(level).toBeLessThanOrEqual(1 - D1_SEPARATION_GATE.bound_margin);
    }
  });
});

describe("D1 FIX 2 — literal probe bytes are frozen", () => {
  it("three probes, distinct ids, distinct texts, frozen", () => {
    expect(D1_PROBES).toHaveLength(3);
    expect(new Set(D1_PROBES.map((p) => p.probe_id)).size).toBe(3);
    expect(new Set(D1_PROBES.map((p) => p.observation_text)).size).toBe(3);
    for (const probe of D1_PROBES) expect(Object.isFrozen(probe)).toBe(true);
  });

  it("P1 and P2 are underdetermined: no source endorsement, no cheap-check statement, no contradiction", () => {
    for (const probe of [D1_P1, D1_P2]) {
      const text = probe.observation_text.toLowerCase();
      for (const forcing of ["reliable", "always right", "definitely", "is correct", "is wrong", "quick and easy", "one minute"]) {
        expect(text).not.toContain(forcing);
      }
      expect(probe.underdetermination.length).toBeGreaterThan(40);
    }
  });

  it("no probe contains a decision token or an anchor phrase", () => {
    const anchors = ["checked against an independent source", "before it is acted on", "should not be accepted"];
    for (const probe of D1_PROBES) {
      for (const token of DECISION_PROBE_DECISIONS) {
        expect(probe.observation_text.toLowerCase()).not.toContain(token.toLowerCase());
      }
      for (const anchor of anchors) {
        expect(probe.observation_text.toLowerCase()).not.toContain(anchor);
      }
    }
  });

  it("P3 is a negative control that still maps onto the closed set and is not a bare arithmetic question", () => {
    expect(D1_P3.family).toBe("NEGATIVE_CONTROL");
    expect(D1_P3.expected_direction).toContain("ACCEPT");
    expect(D1_P3.observation_text).toContain("remarke".replace("remarke", "remar"));
    // it is a claim/action situation, not a bare sum
    expect(D1_P3.observation_text.toLowerCase()).not.toContain("what is 17");
    expect(D1_P3.observation_text.toLowerCase()).not.toContain("equals");
    expect(D1_P3.observation_text.toLowerCase()).toContain("what should be done");
    // and the CAUTION belief's antecedent is FALSE for it: the information was seen first-hand
    expect(D1_P3.underdetermination).toContain("first-hand");
  });

  it("the probe manifest hash is deterministic and reflected in the preregistration hash", async () => {
    const first = await deriveD1ManifestV0();
    const second = await deriveD1ManifestV0();
    expect(first.probe_manifest_hash).toBe(second.probe_manifest_hash);
    expect(first.preregistration_hash).toBe(second.preregistration_hash);
    expect(first.probe_manifest_hash).toMatch(/^sha256:[0-9a-f]{64}$/);
  });
});

describe("D1 FIX 3 — FRAME_MINIMAL is mandatory and byte-diffable", () => {
  it("drops exactly three non-essential measurement prose lines", () => {
    const base = V2_PRIMARY_SEMANTIC_CONTRACT.split("\n");
    const minimal = D1_FRAME_MINIMAL_CONTRACT.split("\n");
    expect(minimal).toHaveLength(base.length - 3);
    const removed = base.filter((line) => !minimal.includes(line));
    expect(removed).toHaveLength(3);
    expect(removed.some((l) => l.startsWith("--- DECISION PROBE OUTPUT CONTRACT"))).toBe(true);
    expect(removed.some((l) => l.startsWith("--- END DECISION PROBE OUTPUT CONTRACT"))).toBe(true);
    expect(removed.some((l) => l.startsWith("Choose exactly one decision"))).toBe(true);
  });

  it("keeps the anchors, the vocabulary, the output object and the law-preservation clause", () => {
    expect(D1_FRAME_MINIMAL_CONTRACT).toContain("Decision meanings (binding):");
    for (const token of DECISION_PROBE_DECISIONS) {
      expect(D1_FRAME_MINIMAL_CONTRACT).toContain(`  ${token} —`);
      expect(D1_FRAME_MINIMAL_CONTRACT).toContain(`"${token}"`);
    }
    expect(D1_FRAME_MINIMAL_CONTRACT).toContain("decision_probe_schema_version");
    expect(D1_FRAME_MINIMAL_CONTRACT).toContain("SUPERSEDED for this invocation");
    expect(D1_FRAME_MINIMAL_CONTRACT).toContain("still binds");
    expect(D1_FRAME_MINIMAL_CONTRACT).toContain("EXACTLY ONE JSON object");
  });

  it("is strictly smaller than the primary contract and hash-distinct from it", async () => {
    expect(D1_FRAME_MINIMAL_CONTRACT.length).toBeLessThan(V2_PRIMARY_SEMANTIC_CONTRACT.length);
    const manifest = await deriveD1ManifestV0();
    expect(manifest.frame_minimal_contract_hash).not.toBe(manifest.primary_contract_hash);
    expect(manifest.primary_contract_hash).toBe(
      "sha256:c484554db987d36687a46683653e882ea3580c3eac45e15cb93fa08264330c53"
    );
  });

  it("declares all five frame interpretations and their precedence", () => {
    const fi = D1_FRAME_INTERPRETATION;
    expect(fi.full_positive_minimal_positive_same_direction).toBe("FRAME_ROBUST_STATE_SENSITIVITY");
    expect(fi.full_positive_minimal_null).toBe("STATE_EFFECT_FRAME_DEPENDENT");
    expect(fi.full_null_minimal_positive).toBe("MEASUREMENT_FRAME_SUPPRESSED_STATE_SENSITIVITY");
    expect(fi.opposite_directions).toBe("INCONCLUSIVE_BY_FRAME_INTERACTION");
    expect(fi.full_null_minimal_null).toBe("BELIEF_STATE_DECISION_SENSITIVITY_NOT_ESTABLISHED");
    expect(fi.precedence).toContain("FRAME_ROBUST_STATE_SENSITIVITY is required");
    expect(Object.isFrozen(fi)).toBe(true);
  });
});

describe("D1 FIX 4 — STATE_REVERSAL is within-identity", () => {
  it("uses one identity and explicitly disclaims cross-identity mediation", () => {
    expect(D1_REVERSAL_SEMANTICS.identities).toBe(1);
    expect(D1_REVERSAL_SEMANTICS.proves).toContain("within-identity");
    expect(D1_REVERSAL_SEMANTICS.does_not_prove).toContain("cross-identity");
    expect(D1_REVERSAL_SEMANTICS.two_identity_policy).toContain("separate preregistration");
  });

  it("no cross-identity swap verdict remains in the vocabulary", () => {
    expect([...D1_VERDICTS]).not.toContain("STATE_MEDIATION_NOT_SUPPORTED");
    expect([...D1_VERDICTS]).toContain("STATE_REVERSAL_DOES_NOT_TRACK_BELIEF");
    expect([...D1_VERDICTS]).not.toContain("STATE_SWAP");
  });
});

describe("D1 — state-line lexical audit (protects the CAUTION proposition)", () => {
  it("the belief label shares no 6-gram with the measurement contract", () => {
    const labelWords = D1_PROPOSITION_LABEL.toLowerCase().split(/\s+/);
    const contractLower = V2_PRIMARY_SEMANTIC_CONTRACT.toLowerCase();
    for (let i = 0; i + 6 <= labelWords.length; i += 1) {
      expect(contractLower).not.toContain(labelWords.slice(i, i + 6).join(" "));
    }
  });

  it("the belief label shares no 6-gram with any probe and contains no decision token", () => {
    const labelWords = D1_PROPOSITION_LABEL.toLowerCase().split(/\s+/);
    for (const probe of D1_PROBES) {
      const text = probe.observation_text.toLowerCase();
      const probeWords = text.split(/\s+/);
      for (let i = 0; i + 6 <= labelWords.length; i += 1) {
        expect(text).not.toContain(labelWords.slice(i, i + 6).join(" "));
      }
      for (let i = 0; i + 6 <= probeWords.length; i += 1) {
        expect(D1_PROPOSITION_LABEL.toLowerCase()).not.toContain(probeWords.slice(i, i + 6).join(" "));
      }
    }
    for (const token of DECISION_PROBE_DECISIONS) {
      expect(D1_PROPOSITION_LABEL.toLowerCase()).not.toContain(token.toLowerCase());
    }
    for (const anchorWord of ["checked", "independent source", "acted on", "verifying"]) {
      expect(D1_PROPOSITION_LABEL.toLowerCase()).not.toContain(anchorWord);
    }
  });
});

describe("D1 — budget and vocabulary are frozen", () => {
  it("budget arithmetic is explicit and FRAME_MINIMAL is included", () => {
    expect(D1_CALL_BUDGET.phase_b_noise_pilot).toBe(6);
    expect(D1_CALL_BUDGET.minimum_r6).toBe(66);
    expect(D1_CALL_BUDGET.expected_r14).toBe(146);
    expect(D1_CALL_BUDGET.maximum_r20).toBe(206);
    expect(D1_CALL_BUDGET.restart_addon_per_r).toBe(2);
  });

  it("the verdict vocabulary is frozen and complete", () => {
    expect(Object.isFrozen(D1_VERDICTS)).toBe(true);
    for (const required of [
      "BELIEF_STATE_DECISION_SENSITIVITY_SUPPORTED",
      "FRAME_ROBUST_STATE_SENSITIVITY",
      "STATE_EFFECT_FRAME_DEPENDENT",
      "MEASUREMENT_FRAME_SUPPRESSED_STATE_SENSITIVITY",
      "INCONCLUSIVE_BY_FRAME_INTERACTION",
      "BELIEF_STATE_DECISION_SENSITIVITY_NOT_ESTABLISHED",
      "STATE_EFFECT_NOT_SPECIFIC",
      "INCONCLUSIVE_BY_INSUFFICIENT_STATE_SEPARATION",
      "INCONCLUSIVE_BY_DECISION_NOISE"
    ]) {
      expect([...D1_VERDICTS]).toContain(required);
    }
  });

  it("the manifest canonicalises deterministically", async () => {
    const manifest = await deriveD1ManifestV0();
    expect(canonicalJsonString(manifest.probes)).toBe(canonicalJsonString(D1_PROBES));
    expect(manifest.preregistration_version).toBe("d1-belief-state-sensitivity-v1");
  });
});
