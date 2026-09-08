/**
 * CANONICAL_AFFECT_COGNITION_BEHAVIOR_INFLUENCE_EXPERIMENT_V0 — CI conformance
 * gate. Re-executes the deterministic phase in-process and asserts the §42
 * matrix: lawful histories, differing final Affect, equal logical time,
 * identical current event + Appraisal, non-Affect provider-input equality,
 * ablation identity, restore invariance, zero real model calls.
 */

import { describe, expect, it } from "vitest";

import { executeDeterministicPhase } from "../../research/experiments/canonical-affect-behavior-influence-v0/runner.ts";
import { PRIOR_EVENT, SCENARIOS } from "../../research/experiments/canonical-affect-behavior-influence-v0/contract.ts";

describe("CANONICAL_AFFECT_COGNITION_BEHAVIOR_INFLUENCE_EXPERIMENT_V0 — deterministic phase (§42)", () => {
  it("1-14. harness validation matrix", async () => {
    const bundle = await executeDeterministicPhase();

    // 1/2: lawful histories produce differing final canonical Affect.
    for (const scenario of SCENARIOS) {
      const a = bundle.arms.final_canonical_affect[`${scenario.id}-A`];
      const b = bundle.arms.final_canonical_affect[`${scenario.id}-B`];
      expect(a.valence).toBe(0.25);
      expect(b.valence).toBe(-0.25);
      // 34: equal activation — a pure valence contrast by construction.
      expect(a.activation).toBe(b.activation);
    }
    // 3: identical logical time (OCCURRENCE never advances it; asserted via
    // the identical non-affect projection fields below).
    // 4/5: the current event + Appraisal are identical across arms.
    expect(bundle.aggregate.non_affect_provider_input_equal_all).toBe(true);
    // 6/7: the ONLY differing provider-input fields are canonical_affect and
    // its projection_hash binding.
    for (const audit of bundle.input_diff_audits) {
      expect(audit.differing_fields.sort()).toStrictEqual(["canonical_affect", "projection_hash"]);
      expect(audit.non_affect_provider_input_equal).toBe(true);
    }
    // 8/9: ablation makes the arm inputs byte-identical.
    expect(bundle.ablation.ablated_inputs_identical).toBe(true);
    // 10/11: the fake provider received correct arms and the measurement
    // capture worked — every trial is VALID with a captured projection hash.
    expect(bundle.trials.length).toBe(SCENARIOS.length * 4);
    for (const trial of bundle.trials) {
      expect(trial.status).toBe("VALID");
      expect(trial.projection_hash).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(trial.provider).toBe("deterministic-fake-v0");
    }
    // 12: failure classification pipeline present (0 failures this phase).
    expect(bundle.aggregate.failed_trials).toBe(0);
    // 13: restore reproduces the exact treatment input.
    expect(bundle.restore_control.identical).toBe(true);
    // 14: real model calls 0.
    expect(bundle.real_model_calls).toBe(0);
    expect(bundle.phase).toBe("DETERMINISTIC_HARNESS_VALIDATION");
    // Prior history law: only goal_congruence differs between arms.
    expect(bundle.arms.prior_goal_congruence["A"]).toBe(PRIOR_EVENT.goal_congruence_arm_a);
    expect(bundle.arms.prior_goal_congruence["B"]).toBe(PRIOR_EVENT.goal_congruence_arm_b);
    // The deterministic fake is a pure function of its input: paired outputs
    // are identical by construction (documented; NOT a causal answer).
    expect(bundle.aggregate.paired_ab_output_distance).toBe(0);
    expect(bundle.aggregate.paired_ablated_output_distance).toBe(0);
  });
});
