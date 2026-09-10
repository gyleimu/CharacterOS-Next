import { describe, expect, it } from "vitest";
import {
  ARMS,
  MAX_REAL_GENERATION_CALLS,
  PLANNED_COGNITION_CALLS,
  SCENARIOS,
  frozenConfig
} from "../../research/experiments/canonical-affect-downstream-language-behavior-causal-v0/contract.ts";
import {
  executePhaseA
} from "../../research/experiments/canonical-affect-downstream-language-behavior-causal-v0/harness.ts";
import {
  buildExecutionPlan
} from "../../research/experiments/canonical-affect-downstream-language-behavior-causal-v0/real-runner.ts";
import {
  exactContentHash,
  languageMetrics
} from "../../research/experiments/canonical-affect-downstream-language-behavior-causal-v0/metrics.ts";

describe("canonical affect downstream language behavior causal experiment v0", () => {
  it("freezes the bounded four-arm real-provider design before collection", () => {
    const config = frozenConfig();
    expect(SCENARIOS).toHaveLength(6);
    expect(ARMS).toEqual(["A", "B", "ABL_A", "ABL_B"]);
    expect(PLANNED_COGNITION_CALLS).toBe(120);
    expect(MAX_REAL_GENERATION_CALLS).toBe(240);
    expect(config).toMatchObject({
      design_frozen_before_real_provider_output: true,
      production_behavior_changing_diff: 0,
      llm_as_judge: false,
      action_execution: false,
      behavior_feedback: false
    });
  });

  it("passes scenario ingress, isolation, ablation, language binding, and restore gates with zero generation calls", async () => {
    const result = await executePhaseA();
    expect(result.artifacts.phase_a).toMatchObject({
      real_provider_generation_calls: 0,
      scenario_ingress: "PASS",
      non_affect_cognition_input_equality: "PASS",
      ablation_input_equality: "PASS",
      language_v2_intent_binding: "PASS",
      no_raw_affect_to_language: "PASS",
      no_reasoning_summary_to_language: "PASS",
      restore_control: "PASS",
      all_pass: true
    });
    expect(result.artifacts.scenario_ingress_audit).toMatchObject({
      all_scenarios_present: true,
      all_pass: true
    });
    expect(result.artifacts.language_binding_audit).toMatchObject({
      exact_intent_handoff_all_arms: true,
      real_provider_generation_calls: 0,
      all_pass: true
    });
    expect(result.prepared).toHaveLength(6);
    for (const cell of result.prepared) {
      expect(cell.provider_inputs.ABL_A).toEqual(cell.provider_inputs.ABL_B);
      expect(cell.provider_inputs.A.canonical_affect).toEqual({
        schema_version: "canonical-affect-cognition-projection-v0",
        valence: 0.25,
        activation: 0.34800000000000003
      });
      expect(cell.provider_inputs.B.canonical_affect).toEqual({
        schema_version: "canonical-affect-cognition-projection-v0",
        valence: -0.25,
        activation: 0.34800000000000003
      });
      expect(cell.provider_inputs.A.context.scene).toBe(cell.scenario.current_factual_event);
      expect(cell.provider_inputs.B.context.task).toBe(cell.scenario.current_task);
    }
  }, 30_000);

  it("builds a unique strict-prefix schedule and freezes deterministic text metrics", async () => {
    const result = await executePhaseA();
    const plan = buildExecutionPlan(result);
    expect(plan).toHaveLength(120);
    expect(new Set(plan.map((trial) => trial.trial_id)).size).toBe(120);
    expect(plan.map((trial) => trial.execution_order)).toEqual(
      Array.from({ length: 120 }, (_, index) => index + 1)
    );
    expect(languageMetrics("好。\nReally?")).toEqual({
      utf8_byte_length: 14,
      unicode_code_point_length: 10,
      sentence_count: 2,
      question_mark_count: 1,
      newline_count: 1,
      exact_content_hash: exactContentHash("好。\nReally?")
    });
  }, 30_000);
});
