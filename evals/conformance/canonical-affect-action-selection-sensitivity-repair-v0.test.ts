/** Zero-generation conformance gate for CANONICAL_AFFECT_ACTION_SELECTION_SENSITIVITY_REPAIR_V0. */

import { describe, expect, it } from "vitest";
import {
  ABLATION_NEUTRAL_AFFECT,
  ACTION_ORDERS,
  ARMS,
  BALANCED_ARM_ORDER,
  MATCHED_FOUR_ARM_UNITS,
  PLANNED_REAL_CALLS,
  REFERENCE_MAGNITUDE,
  REPAIR_TYPE,
  SCENARIOS,
  TRIALS_PER_ARM_SCENARIO_ORDER,
  actionsForOrder
} from "../../research/experiments/canonical-affect-action-selection-sensitivity-repair-v0/contract.ts";
import { buildRepairAnalysis } from "../../research/experiments/canonical-affect-action-selection-sensitivity-repair-v0/forensics.ts";
import {
  chooseVerdict,
  equal,
  firstPositionSelected,
  semanticSelection
} from "../../research/experiments/canonical-affect-action-selection-sensitivity-repair-v0/metrics.ts";
import { executePhaseA } from "../../research/experiments/canonical-affect-action-selection-sensitivity-repair-v0/phase-a.ts";
import { buildExecutionPlan } from "../../research/experiments/canonical-affect-action-selection-sensitivity-repair-v0/real-runner.ts";

describe("CANONICAL_AFFECT_ACTION_SELECTION_SENSITIVITY_REPAIR_V0", () => {
  it("localizes all five frozen disagreements before choosing one repair", () => {
    const analysis = buildRepairAnalysis();
    expect(analysis["real_provider_generation_calls"]).toBe(0);
    const source = analysis["source"] as Record<string, unknown>;
    expect(source["attempted_calls"]).toBe(160);
    expect(source["valid_calls"]).toBe(160);
    expect(source["treatment_disagreement"]).toStrictEqual({
      count: 5,
      denominator: 40,
      rate: 0.125
    });
    expect(source["ablation_disagreement"]).toStrictEqual({
      count: 0,
      denominator: 40,
      rate: 0
    });
    expect(source["order_invariant_scenario_count"]).toBe(0);

    const rows = analysis["localized_treatment_disagreements"] as readonly Record<string, unknown>[];
    expect(rows).toHaveLength(5);
    expect(rows.map((row) => row["trial_ordinal"])).toStrictEqual([1, 2, 3, 4, 5]);
    for (const row of rows) {
      expect(row["scenario_id"]).toBe("ASV0-S4-balanced-additional-task");
      expect(row["action_order_id"]).toBe("REVERSED");
      expect(row["semantic_selections"]).toStrictEqual({
        A: "Y",
        B: "X",
        ABL_A: "Y",
        ABL_B: "Y"
      });
      expect(row["positions"]).toStrictEqual({
        A: "FIRST",
        B: "SECOND",
        ABL_A: "FIRST",
        ABL_B: "FIRST"
      });
    }

    const hypotheses = analysis["hypotheses"] as Record<string, Record<string, unknown>>;
    expect(hypotheses["R1_ACTION_LABEL_SEMANTIC_ASYMMETRY"]?.["status"]).toBe("SUPPORTED");
    expect(hypotheses["R2_FIRST_POSITION_BIAS"]?.["status"]).toBe("SUPPORTED");
    expect(hypotheses["R3_SCENARIO_SEMANTIC_IMBALANCE"]?.["status"]).toBe("SUPPORTED");
    expect(hypotheses["R4_TARGET_REF_ASYMMETRY"]?.["status"]).toBe("PRESENT_AS_UNRESOLVED_CONFOUND");
    expect(hypotheses["R5_PROMPT_PRESENTATION_ASYMMETRY"]?.["status"]).toBe("SUPPORTED");
    expect(hypotheses["R6_TRUE_WEAK_ACTION_EFFECT"]?.["status"]).toBe("NOT_ADJUDICABLE_BEFORE_REPAIR");
    expect(
      (analysis["repair_decision"] as Record<string, unknown>)["chosen_repair_type"]
    ).toBe(REPAIR_TYPE);
  });

  it("freezes neutral aliases, symmetric targets, Latin balance, and exactly 160 calls", () => {
    expect(SCENARIOS).toHaveLength(4);
    expect(ACTION_ORDERS).toStrictEqual(["ORDER_1", "ORDER_2"]);
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

    expect(SCENARIOS.filter((row) => row.semantic_action_x.action_type === "OPTION_A")).toHaveLength(2);
    expect(
      SCENARIOS.filter(
        (row) => row.description_order[0] === row.semantic_action_x.action_type
      )
    ).toHaveLength(2);
    expect(SCENARIOS.filter((row) => row.description_order[0] === "OPTION_A")).toHaveLength(2);
    for (const scenario of SCENARIOS) {
      const order1 = actionsForOrder(scenario, "ORDER_1");
      const order2 = actionsForOrder(scenario, "ORDER_2");
      expect([...order1].reverse()).toStrictEqual(order2);
      expect(order1.map((row) => row.action_type).sort()).toStrictEqual([
        "OPTION_A",
        "OPTION_B"
      ]);
      expect(order1.every((row) => row.target_ref === null)).toBe(true);
      expect(scenario.balance_assertions).toHaveLength(8);
      expect(scenario.why_x_is_plausible.length).toBeGreaterThan(0);
      expect(scenario.why_y_is_plausible.length).toBeGreaterThan(0);
    }
  });

  it("passes Phase A, input isolation, position controls, histories, restore, and execution plan", async () => {
    const result = await executePhaseA();
    expect(result.prepared).toHaveLength(8);
    expect(result.artifacts.phase_a["real_provider_calls"]).toBe(0);
    expect(result.artifacts.phase_a["all_pass"]).toBe(true);
    expect(result.artifacts.phase_a["planned_real_calls"]).toBe(160);
    expect(result.artifacts.phase_a["phase_r0_forensics"]).toBe("PASS");
    expect(result.artifacts.phase_a["neutral_action_aliases_machine_valid"]).toBe("PASS");
    expect(result.artifacts.phase_a["target_ref_symmetry"]).toBe("PASS");
    expect(result.artifacts.phase_a["cross_scenario_alias_balance"]).toBe("PASS");
    expect(result.artifacts.position_control_audit["all_pass"]).toBe(true);

    const audits = result.artifacts.input_diff_audit["treatment_rows"] as readonly Record<string, unknown>[];
    expect(audits).toHaveLength(8);
    for (const audit of audits) {
      expect(audit["differing_fields"]).toStrictEqual([
        "canonical_affect",
        "projection_hash"
      ]);
      expect(audit["non_affect_provider_input_equal"]).toBe(true);
      expect(audit["activation_match"]).toBe(true);
      expect(audit["action_space_equal_across_all_arms"]).toBe(true);
      expect(audit["ablated_inputs_identical"]).toBe(true);
      expect(equal(audit["provider_input_abl_a"], audit["provider_input_abl_b"])).toBe(true);
      expect(
        (audit["provider_input_abl_a"] as { canonical_affect: unknown }).canonical_affect
      ).toStrictEqual(ABLATION_NEUTRAL_AFFECT);
    }

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
    }
    expect(result.artifacts.restore_controls["all_pass"]).toBe(true);

    const plan = buildExecutionPlan(result);
    expect(plan).toHaveLength(160);
    expect(plan.map((trial) => trial.execution_order)).toStrictEqual(
      Array.from({ length: 160 }, (_, index) => index + 1)
    );
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

  it("keeps semantic labels independent of position and freezes every verdict boundary", () => {
    for (const scenario of SCENARIOS) {
      const order1 = actionsForOrder(scenario, "ORDER_1");
      const order2 = actionsForOrder(scenario, "ORDER_2");
      expect(semanticSelection(scenario.semantic_action_x, scenario)).toBe("X");
      expect(semanticSelection(scenario.semantic_action_y, scenario)).toBe("Y");
      expect(firstPositionSelected(scenario.semantic_action_x, order1)).toBe(true);
      expect(firstPositionSelected(scenario.semantic_action_x, order2)).toBe(false);
    }

    expect(
      chooseVerdict({
        repair_justified: true,
        common_full_valid_units: 40,
        treatment_minus_ablation_delta: 0.25,
        order_invariant_scenario_count: 3,
        residual_position_bias: false,
        experiment_confound: false
      })
    ).toBe("ACTION_SELECTION_SENSITIVITY_REPAIR_SUPPORTED");
    expect(
      chooseVerdict({
        repair_justified: true,
        common_full_valid_units: 40,
        treatment_minus_ablation_delta: 0.1,
        order_invariant_scenario_count: 0,
        residual_position_bias: false,
        experiment_confound: false
      })
    ).toBe("ACTION_SELECTION_SENSITIVITY_REPAIR_NOT_SUPPORTED");
    expect(
      chooseVerdict({
        repair_justified: true,
        common_full_valid_units: 40,
        treatment_minus_ablation_delta: 0.5,
        order_invariant_scenario_count: 4,
        residual_position_bias: true,
        experiment_confound: false
      })
    ).toBe("ACTION_SELECTION_SENSITIVITY_REPAIR_INCONCLUSIVE");
    expect(
      chooseVerdict({
        repair_justified: false,
        common_full_valid_units: 40,
        treatment_minus_ablation_delta: 0.5,
        order_invariant_scenario_count: 4,
        residual_position_bias: false,
        experiment_confound: false
      })
    ).toBe("EXPERIMENT_REPAIR_NOT_JUSTIFIED");
    expect(
      chooseVerdict({
        repair_justified: true,
        common_full_valid_units: 40,
        treatment_minus_ablation_delta: 0.5,
        order_invariant_scenario_count: 4,
        residual_position_bias: false,
        experiment_confound: true
      })
    ).toBe("EXPERIMENT_CONFOUND_DETECTED");
  });
});
