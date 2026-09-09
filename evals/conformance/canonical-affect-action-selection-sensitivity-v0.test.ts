/** Zero-real-call conformance gate for CANONICAL_AFFECT_ACTION_SELECTION_SENSITIVITY_EXPERIMENT_V0. */

import { describe, expect, it } from "vitest";
import {
  ABLATION_NEUTRAL_AFFECT,
  ACTION_ORDERS,
  ARMS,
  BALANCED_ARM_ORDER,
  MATCHED_FOUR_ARM_UNITS,
  PLANNED_REAL_CALLS,
  REFERENCE_MAGNITUDE,
  SCENARIOS,
  TRIALS_PER_ARM_SCENARIO_ORDER,
  actionTupleKey,
  actionsForOrder,
  scenarioManifest
} from "../../research/experiments/canonical-affect-action-selection-sensitivity-v0/contract.ts";
import {
  chooseVerdict,
  equal,
  firstPositionSelected,
  semanticSelection
} from "../../research/experiments/canonical-affect-action-selection-sensitivity-v0/metrics.ts";
import { executePhaseA } from "../../research/experiments/canonical-affect-action-selection-sensitivity-v0/phase-a.ts";
import { buildExecutionPlan } from "../../research/experiments/canonical-affect-action-selection-sensitivity-v0/real-runner.ts";

describe("CANONICAL_AFFECT_ACTION_SELECTION_SENSITIVITY_EXPERIMENT_V0", () => {
  it("freezes four balanced scenarios, two counterbalanced orders, and exactly 160 calls", () => {
    expect(SCENARIOS).toHaveLength(4);
    expect(new Set(SCENARIOS.map((scenario) => scenario.scenario_id)).size).toBe(4);
    expect(ACTION_ORDERS).toStrictEqual(["ORIGINAL", "REVERSED"]);
    expect(ARMS).toStrictEqual(["A", "B", "ABL_A", "ABL_B"]);
    expect(TRIALS_PER_ARM_SCENARIO_ORDER).toBe(5);
    expect(MATCHED_FOUR_ARM_UNITS).toBe(40);
    expect(PLANNED_REAL_CALLS).toBe(160);
    expect(BALANCED_ARM_ORDER).toStrictEqual([
      ["A", "B", "ABL_A", "ABL_B"],
      ["B", "A", "ABL_B", "ABL_A"],
      ["ABL_A", "ABL_B", "A", "B"],
      ["ABL_B", "ABL_A", "B", "A"]
    ]);

    const manifest = scenarioManifest();
    expect(manifest).toHaveLength(4);
    for (const scenario of SCENARIOS) {
      expect(scenario.balance_assertions).toHaveLength(5);
      expect(scenario.why_x_is_plausible.length).toBeGreaterThan(0);
      expect(scenario.why_y_is_plausible.length).toBeGreaterThan(0);
      expect(actionTupleKey(scenario.semantic_action_x)).not.toBe(
        actionTupleKey(scenario.semantic_action_y)
      );
      expect(actionsForOrder(scenario, "ORIGINAL")).toStrictEqual([
        scenario.semantic_action_x,
        scenario.semantic_action_y
      ]);
      expect(actionsForOrder(scenario, "REVERSED")).toStrictEqual([
        scenario.semantic_action_y,
        scenario.semantic_action_x
      ]);
    }

    const rendered = JSON.stringify(SCENARIOS).toLowerCase();
    for (const forbidden of [
      "happy",
      "sad",
      "angry",
      "anxious",
      "positive mood",
      "negative mood",
      "activated",
      "calm"
    ]) {
      expect(rendered).not.toContain(forbidden);
    }
  });

  it("passes history, isolation, order, ablation, restore, and plan gates with zero real calls", async () => {
    const result = await executePhaseA();
    expect(result.prepared).toHaveLength(8);
    expect(result.artifacts.phase_a["real_provider_calls"]).toBe(0);
    expect(result.artifacts.phase_a["all_pass"]).toBe(true);
    expect(result.artifacts.phase_a["planned_real_calls"]).toBe(160);
    expect(result.artifacts.phase_a["matched_four_arm_units"]).toBe(40);
    expect(result.artifacts.phase_a["projection_hash_await_regression"]).toBe("PASS");
    expect(result.artifacts.phase_a["scenario_balance_documentation"]).toBe("PASS");
    expect(result.artifacts.phase_a["action_order_reversal_only"]).toBe("PASS");

    const audits = result.artifacts.input_diff_audit["treatment_rows"] as readonly Record<string, unknown>[];
    expect(audits).toHaveLength(8);
    for (const audit of audits) {
      expect(audit["differing_fields"]).toStrictEqual([
        "canonical_affect",
        "projection_hash"
      ]);
      expect(audit["non_affect_provider_input_equal"]).toBe(true);
      expect(audit["activation_match"]).toBe(true);
      expect(audit["current_event_equal"]).toBe(true);
      expect(audit["current_appraisal_dimensions_equal"]).toBe(true);
      expect(audit["action_space_equal_across_all_arms"]).toBe(true);
      expect(audit["ablated_inputs_identical"]).toBe(true);
      expect(audit["ablation_projection_hash_resolved_string"]).toBe(true);
      expect(audit["ablation_projection_hash_matches_recomputation"]).toBe(true);
      expect(audit["promise_or_stringification_leak_absent"]).toBe(true);
      expect(audit["hidden_arm_labels_present"]).toStrictEqual([]);
      expect(equal(audit["provider_input_abl_a"], audit["provider_input_abl_b"])).toBe(true);
      expect(
        (audit["provider_input_abl_a"] as { canonical_affect: unknown }).canonical_affect
      ).toStrictEqual(ABLATION_NEUTRAL_AFFECT);
    }

    const orderRows = result.artifacts.input_diff_audit["order_reversal_rows"] as readonly Record<string, unknown>[];
    expect(orderRows).toHaveLength(4);
    expect(orderRows.every((row) => row["status"] === "PASS")).toBe(true);

    const histories = result.artifacts.history_construction["rows"] as readonly Record<string, unknown>[];
    expect(histories).toHaveLength(8);
    for (const row of histories) {
      const affect = row["final_canonical_affect"] as {
        readonly valence: number;
        readonly activation: number;
      };
      expect(Math.abs(affect.valence)).toBe(REFERENCE_MAGNITUDE.target_absolute_valence);
      expect(Number(affect.activation.toFixed(12))).toBe(
        REFERENCE_MAGNITUDE.expected_final_activation
      );
      expect(row["path"]).toStrictEqual([
        "factual event",
        "Observation",
        "canonical INITIAL Appraisal",
        "AffectApplication",
        "durable CanonicalAffectV0"
      ]);
    }

    const restoreRows = result.artifacts.restore_controls["rows"] as readonly Record<string, unknown>[];
    expect(restoreRows).toHaveLength(1);
    expect(restoreRows[0]?.["provider_facing_input_identical"]).toBe(true);

    const plan = buildExecutionPlan(result);
    expect(plan).toHaveLength(160);
    expect(plan.map((trial) => trial.execution_order)).toStrictEqual(
      Array.from({ length: 160 }, (_, index) => index + 1)
    );
    expect(plan.slice(0, 20).map((trial) => trial.arm)).toStrictEqual([
      "A", "B", "ABL_A", "ABL_B",
      "B", "A", "ABL_B", "ABL_A",
      "ABL_A", "ABL_B", "A", "B",
      "ABL_B", "ABL_A", "B", "A",
      "A", "B", "ABL_A", "ABL_B"
    ]);
    for (const scenario of SCENARIOS) {
      for (const order of ACTION_ORDERS) {
        const cell = plan.filter(
          (trial) =>
            trial.cell.scenario.scenario_id === scenario.scenario_id &&
            trial.cell.action_order_id === order
        );
        expect(cell).toHaveLength(20);
        for (const arm of ARMS) {
          expect(cell.filter((trial) => trial.arm === arm)).toHaveLength(5);
        }
      }
    }
  }, 30_000);

  it("keeps semantic labels position-independent and freezes verdict boundaries", () => {
    for (const scenario of SCENARIOS) {
      const original = actionsForOrder(scenario, "ORIGINAL");
      const reversed = actionsForOrder(scenario, "REVERSED");
      expect(semanticSelection(scenario.semantic_action_x, scenario)).toBe("X");
      expect(semanticSelection(scenario.semantic_action_y, scenario)).toBe("Y");
      expect(firstPositionSelected(scenario.semantic_action_x, original)).toBe(true);
      expect(firstPositionSelected(scenario.semantic_action_x, reversed)).toBe(false);
    }

    expect(
      chooseVerdict({
        common_full_valid_units: 40,
        treatment_minus_ablation_delta: 0.25,
        order_invariant_scenario_count: 3,
        severe_position_bias: false,
        scenario_balance_failure: false
      })
    ).toBe("ACTION_SELECTION_SENSITIVITY_SUPPORTED");
    expect(
      chooseVerdict({
        common_full_valid_units: 40,
        treatment_minus_ablation_delta: 0.1,
        order_invariant_scenario_count: 0,
        severe_position_bias: false,
        scenario_balance_failure: false
      })
    ).toBe("ACTION_SELECTION_SENSITIVITY_NOT_SUPPORTED");
    expect(
      chooseVerdict({
        common_full_valid_units: 40,
        treatment_minus_ablation_delta: 0.5,
        order_invariant_scenario_count: 4,
        severe_position_bias: true,
        scenario_balance_failure: false
      })
    ).toBe("ACTION_SELECTION_SENSITIVITY_INCONCLUSIVE");
  });
});
