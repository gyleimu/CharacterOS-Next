/** Zero-real-call conformance gate for CANONICAL_AFFECT_BEHAVIOR_INFLUENCE_REPLICATION_V1. */

import { describe, expect, it } from "vitest";
import {
  ABLATION_NEUTRAL_AFFECT,
  BALANCED_ORDER,
  MAGNITUDES,
  PLANNED_PRIMARY_CALLS,
  PRIMARY_PROVIDER,
  SCENARIOS
} from "../../research/experiments/canonical-affect-behavior-influence-v1/contract.ts";
import { equal } from "../../research/experiments/canonical-affect-behavior-influence-v1/fixtures.ts";
import { executePhaseA } from "../../research/experiments/canonical-affect-behavior-influence-v1/phase-a.ts";
import {
  analyzeSubset,
  buildExecutionPlan,
  type TrialRecord
} from "../../research/experiments/canonical-affect-behavior-influence-v1/real-runner.ts";
import type { CognitionEndpoints } from "../../research/experiments/canonical-affect-behavior-influence-v1/metrics.ts";

describe("CANONICAL_AFFECT_BEHAVIOR_INFLUENCE_REPLICATION_V1", () => {
  it("freezes eight new neutral scenarios, two magnitudes, and the 320-call balanced primary plan", async () => {
    expect(SCENARIOS).toHaveLength(8);
    expect(new Set(SCENARIOS.map((scenario) => scenario.scenario_id)).size).toBe(8);
    expect(SCENARIOS.every((scenario) => scenario.scenario_id.startsWith("V1-"))).toBe(true);
    const rendered = JSON.stringify(SCENARIOS).toLowerCase();
    for (const forbidden of ["you feel happy", "you feel bad", "you are angry", "you are anxious", "you are excited"]) {
      expect(rendered).not.toContain(forbidden);
    }
    expect(MAGNITUDES.map((magnitude) => magnitude.target_absolute_valence)).toStrictEqual([0.125, 0.25]);
    expect(PLANNED_PRIMARY_CALLS).toBe(320);
    expect(BALANCED_ORDER).toStrictEqual([
      ["A", "B", "ABL_A", "ABL_B"],
      ["B", "A", "ABL_B", "ABL_A"],
      ["ABL_A", "ABL_B", "A", "B"],
      ["ABL_B", "ABL_A", "B", "A"]
    ]);

    const phaseA = await executePhaseA();
    const plan = buildExecutionPlan(phaseA, [PRIMARY_PROVIDER.model]);
    expect(plan).toHaveLength(320);
    expect(plan.slice(0, 20).map((trial) => trial.arm)).toStrictEqual([
      "A", "B", "ABL_A", "ABL_B",
      "B", "A", "ABL_B", "ABL_A",
      "ABL_A", "ABL_B", "A", "B",
      "ABL_B", "ABL_A", "B", "A",
      "A", "B", "ABL_A", "ABL_B"
    ]);
  }, 20_000);

  it("passes lawful history, activation, input isolation, ablation hash, and LOW/REFERENCE restore gates with zero real calls", async () => {
    const result = await executePhaseA();
    expect(result.prepared).toHaveLength(16);
    expect(result.artifacts.phase_a["real_provider_calls"]).toBe(0);
    expect(result.artifacts.phase_a["all_pass"]).toBe(true);
    expect(result.artifacts.phase_a["async_hash_regression"]).toBe("PASS");
    const audits = result.artifacts.input_diff_audit["rows"] as readonly Record<string, unknown>[];
    expect(audits).toHaveLength(16);
    for (const audit of audits) {
      expect(audit["differing_fields"]).toStrictEqual(["canonical_affect", "projection_hash"]);
      expect(audit["non_affect_provider_input_equal"]).toBe(true);
      expect(audit["activation_match"]).toBe(true);
      expect(audit["current_event_equal"]).toBe(true);
      expect(audit["current_appraisal_dimensions_equal"]).toBe(true);
      expect(typeof audit["current_appraisal_ref_a"]).toBe("string");
      expect(typeof audit["current_appraisal_ref_b"]).toBe("string");
      expect(audit["action_space_equal"]).toBe(true);
      expect(audit["ablated_inputs_identical"]).toBe(true);
      expect(audit["ablation_projection_hash_resolved_string"]).toBe(true);
      expect(audit["ablation_projection_hash_matches_recomputation"]).toBe(true);
      expect(audit["promise_or_stringification_leak_absent"]).toBe(true);
      expect(equal(audit["provider_input_abl_a"], audit["provider_input_abl_b"])).toBe(true);
      expect((audit["provider_input_abl_a"] as { canonical_affect: unknown }).canonical_affect).toStrictEqual(ABLATION_NEUTRAL_AFFECT);
    }
    const histories = result.artifacts.history_construction["rows"] as readonly Record<string, unknown>[];
    expect(histories).toHaveLength(32);
    for (const magnitude of MAGNITUDES) {
      const selected = histories.filter((row) => row["magnitude_id"] === magnitude.magnitude_id);
      expect(selected).toHaveLength(16);
      for (const row of selected) {
        const affect = row["final_canonical_affect"] as { valence: number; activation: number };
        expect(Math.abs(affect.valence)).toBe(magnitude.target_absolute_valence);
        expect(Number(affect.activation.toFixed(12))).toBe(magnitude.expected_final_activation);
        expect(row["path"]).toStrictEqual(["factual event", "Observation", "canonical INITIAL Appraisal", "AffectApplication", "durable CanonicalAffectV0"]);
      }
    }
    const restoreRows = result.artifacts.restore_controls["rows"] as readonly Record<string, unknown>[];
    expect(restoreRows.map((row) => row["magnitude_id"])).toStrictEqual(["LOW", "REFERENCE"]);
    expect(restoreRows.every((row) => row["provider_facing_input_identical"] === true)).toBe(true);
  }, 20_000);

  it("keeps structured, action, validity, and denominator calculations separate", () => {
    const same: CognitionEndpoints = { current_intent: "x", confidence: 0.5, uncertainty: 0.5, action_intent: "DO", reasoning_summary_length: 10 };
    const different: CognitionEndpoints = { ...same, current_intent: "y", confidence: 0.6 };
    const valid = (arm: TrialRecord["arm"], ordinal: number, endpoints: CognitionEndpoints): TrialRecord => ({
      arm,
      trial_ordinal: ordinal,
      model_id: "m",
      scenario_id: "s",
      magnitude_id: "LOW",
      status: "VALID",
      endpoints,
      validated_cognition_proposal: { action_intent: { action_type: "DO", target_ref: null } },
      provider_response_obtained: true,
      validation_subreason: null
    } as unknown as TrialRecord);
    const invalid = (arm: TrialRecord["arm"], ordinal: number): TrialRecord => ({
      arm,
      trial_ordinal: ordinal,
      model_id: "m",
      scenario_id: "s",
      magnitude_id: "LOW",
      status: "VALIDATION_REJECTED",
      endpoints: null,
      validated_cognition_proposal: null,
      provider_response_obtained: true,
      validation_subreason: "MODEL_ACTION_NOT_ALLOWED"
    } as unknown as TrialRecord);
    const trials = [
      valid("A", 1, same), valid("B", 1, different), valid("ABL_A", 1, same), valid("ABL_B", 1, same),
      valid("A", 2, same), invalid("B", 2), valid("ABL_A", 2, same), valid("ABL_B", 2, same)
    ];
    const analysis = analyzeSubset(trials, 2);
    expect(analysis.attempted_calls).toBe(8);
    expect(analysis.valid_calls).toBe(7);
    expect(analysis.treatment_valid_pairs).toBe(1);
    expect(analysis.ablation_valid_pairs).toBe(2);
    expect(analysis.full_four_arm_valid_units).toBe(1);
    expect(analysis.primary.treatment_rate_on_common_units).toBe(1);
    expect(analysis.primary.ablation_rate_on_common_units).toBe(0);
    expect(analysis.cognition_content.treatment_rate_on_common_units).toBe(1);
    expect(analysis.action_intent.treatment_rate_on_common_units).toBe(0);
    expect(analysis.action_validity_by_arm.B.model_action_not_allowed).toBe(1);
    expect(analysis.action_validity_by_arm.B.model_action_not_allowed_rate).toBe(0.5);
  });
});
