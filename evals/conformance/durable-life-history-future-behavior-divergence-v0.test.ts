/* eslint-disable @typescript-eslint/no-non-null-assertion -- Conformance assertions over a frozen 20-row evidence table: row order and per-arm membership are asserted immediately before each indexed read. */

/**
 * DURABLE_LIFE_HISTORY_FUTURE_BEHAVIOR_DIVERGENCE_V0 — CI conformance gate.
 * Verifies the persisted evidence bundle against the preregistered
 * requirements using ONLY stored evidence (zero provider calls): frozen
 * preregistration, lawful life chain with A/B behavior divergence, §21
 * memory-visibility and ablation-control gates, fresh-restore-per-trial
 * collection with balanced rotation and deterministic provider inputs, the
 * frozen verdict vocabulary, and honest collection-validity reporting.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const experimentDir = "research/experiments/durable-life-history-future-behavior-divergence-v0";
const evidenceDir = join(process.cwd(), experimentDir, "evidence/run-1-real-provider");

const FUTURE_ARMS = ["MEM_A", "MEM_B", "MEM_ABL_A", "MEM_ABL_B"] as const;
const TRIALS_PER_ARM = 5;
const VERDICTS = [
  "DURABLE_LIFE_HISTORY_FUTURE_BEHAVIOR_DIVERGENCE_SUPPORTED",
  "DURABLE_HISTORY_FUTURE_COGNITION_EFFECT_ONLY",
  "NO_MEASURABLE_DURABLE_HISTORY_FUTURE_EFFECT_UNDER_V0",
  "FUTURE_BEHAVIOR_DIVERGENCE_INPUT_EFFECT_ONLY",
  "MEMORY_ABLATION_CONTROL_INVALID",
  "FUTURE_MEMORY_VISIBILITY_FAILURE",
  "CAUSAL_CHAIN_CONFOUND_DETECTED",
  "REAL_PROVIDER_UNAVAILABLE"
];

interface TrialRow {
  readonly future_arm: string;
  readonly life_arm: string;
  readonly trial_ordinal: number;
  readonly execution_order: number;
  readonly within_unit_order: number;
  readonly trial_id: string;
  readonly provider_input_hash: string;
  readonly projection_hash: string;
  readonly factual_evidence_present: boolean;
  readonly status: string;
  readonly behavior_text: string;
  readonly cognition: { readonly current_intent: string | null; readonly communication_directive: string | null };
  readonly language: { readonly call_required: boolean; readonly status: string };
}

function readJson(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(evidenceDir, name), "utf8")) as Record<string, unknown>;
}

function readRows(): TrialRow[] {
  return readFileSync(join(evidenceDir, "real-provider", "trials.jsonl"), "utf8")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as TrialRow);
}

describe("DURABLE_LIFE_HISTORY_FUTURE_BEHAVIOR_DIVERGENCE_V0 — persisted evidence conformance", () => {
  it("frozen preregistration exists with zero real calls at Phase A", () => {
    if (!existsSync(join(evidenceDir, "phase-a-complete.json"))) {
      console.log("evidence/run-1-real-provider not present (pre-collection checkout); skipping");
      return;
    }
    const phaseA = readJson("phase-a-complete.json");
    expect(phaseA["all_pass"]).toBe(true);
    expect(phaseA["real_future_calls"]).toBe(0);
    const config = readJson("config.json");
    expect(config["experiment_version"]).toBe("DURABLE_LIFE_HISTORY_FUTURE_BEHAVIOR_DIVERGENCE_V0");
    expect(config["trials_per_arm"]).toBe(TRIALS_PER_ARM);
    expect(config["planned_future_cognition_calls"]).toBe(20);
    expect(config["max_future_real_calls"]).toBe(40);
    expect(config["n_adaptation_after_output"]).toBe("PROHIBITED");
    const verdictContract = readJson("verdict-contract.json");
    expect(verdictContract["frozen_before_real_provider_output"]).toBe(true);
    expect(verdictContract["verdicts"]).toEqual(VERDICTS);
  });

  it("life chain is lawful: behaviors diverged, memory committed, counterpart treatment-blind", () => {
    if (!existsSync(join(evidenceDir, "source-chain-audit.json"))) return;
    const audit = readJson("source-chain-audit.json") as {
      behavior_divergence: { diverged: boolean; behavior_a: string; behavior_b: string };
      counterpart: { treatment_blind: boolean; policy_inputs: Record<string, string> };
      experience_memory: { memory_committed: boolean; A: Record<string, string>; B: Record<string, string> };
      real_calls: { cognition: number; language: number };
    };
    expect(audit.behavior_divergence.diverged).toBe(true);
    expect(audit.behavior_divergence.behavior_a).not.toBe(audit.behavior_divergence.behavior_b);
    expect(audit.counterpart.treatment_blind).toBe(true);
    expect(audit.counterpart.policy_inputs["A"]).toBe(audit.behavior_divergence.behavior_a);
    expect(audit.counterpart.policy_inputs["B"]).toBe(audit.behavior_divergence.behavior_b);
    expect(audit.experience_memory.memory_committed).toBe(true);
    expect(audit.experience_memory.A["revision_after"]).not.toBe(audit.experience_memory.A["revision_before"]);
    expect(audit.experience_memory.B["revision_after"]).not.toBe(audit.experience_memory.B["revision_before"]);
    expect(audit.real_calls.cognition).toBeLessThanOrEqual(4);
    expect(audit.real_calls.language).toBeLessThanOrEqual(4);
  });

  it("§21 memory-visibility gate and ablation-control gate passed, with equal future scenario", () => {
    if (!existsSync(join(evidenceDir, "future-input-diff-audit.json"))) return;
    const audit = readJson("future-input-diff-audit.json") as {
      checks: Record<string, boolean>;
      future_affect: { classification: string; residual_valence_delta: number };
      evidence_entry_diff: { outcome_texts_equal: boolean; delivered_behavior_texts_equal: boolean; differing_fields: string[] };
      projections: Record<string, Record<string, unknown>>;
      production_evidence_bundles: Record<string, { entries: { kind: string }[] }>;
    };
    expect(audit.checks["memory_evidence_visible"]).toBe(true);
    expect(audit.checks["ablation_equivalence_A"]).toBe(true);
    expect(audit.checks["ablation_equivalence_B"]).toBe(true);
    expect(audit.checks["ablation_pair_equalized"]).toBe(true);
    expect(audit.checks["scenario_equality"]).toBe(true);
    expect(["EFFECTIVELY_EQUAL", "NEGLIGIBLE_BUT_NONZERO"]).toContain(audit.future_affect.classification);
    expect(audit.future_affect.residual_valence_delta).toBeLessThan(0.001);
    // Treatment arms carry factual evidence; ablated arms do not.
    expect(audit.projections["MEM_A"]!["factual_memory_evidence"]).toBeDefined();
    expect(audit.projections["MEM_B"]!["factual_memory_evidence"]).toBeDefined();
    expect(audit.projections["MEM_ABL_A"]!["factual_memory_evidence"]).toBeUndefined();
    expect(audit.projections["MEM_ABL_B"]!["factual_memory_evidence"]).toBeUndefined();
    // The durable difference is machine-proven at entry level.
    expect(audit.evidence_entry_diff.differing_fields.length).toBeGreaterThan(0);
    expect(audit.production_evidence_bundles["MEM_A"]!.entries.map((entry) => entry.kind)).toEqual(["BEHAVIOR_OUTCOME"]);
    expect(audit.production_evidence_bundles["MEM_ABL_A"]!.entries.map((entry) => entry.kind)).toEqual(["BEHAVIOR_OUTCOME"]);
  });

  it("collection is strict-prefix ordered, balanced, deterministic per arm, within budget", () => {
    if (!existsSync(join(evidenceDir, "real-provider", "trials.jsonl"))) return;
    const rows = readRows();
    expect(rows).toHaveLength(20);
    const rotations = [0, 1, 2, 3, 4].map((k) => [0, 1, 2, 3].map((i) => FUTURE_ARMS[(i + k) % FUTURE_ARMS.length]));
    let index = 0;
    for (let ordinal = 1; ordinal <= TRIALS_PER_ARM; ordinal += 1) {
      const order = rotations[ordinal - 1]!;
      for (let within = 1; within <= order.length; within += 1) {
        const row = rows[index]!;
        expect(row.execution_order).toBe(index + 1);
        expect(row.trial_ordinal).toBe(ordinal);
        expect(row.within_unit_order).toBe(within);
        expect(row.future_arm).toBe(order[within - 1]!);
        expect(row.trial_id).toBe(`DURABLE_LIFE_HISTORY_FUTURE_BEHAVIOR_DIVERGENCE_V0/DLFV0-F1-review-readiness/${ordinal}/${row.future_arm}`);
        // Fresh restore per trial with a deterministic provider-facing input.
        expect(row.provider_input_hash.startsWith("sha256:")).toBe(true);
        index += 1;
      }
    }
    for (const arm of FUTURE_ARMS) {
      const armRows = rows.filter((row) => row.future_arm === arm);
      expect(armRows).toHaveLength(TRIALS_PER_ARM);
      expect(new Set(armRows.map((row) => row.provider_input_hash)).size).toBe(1);
      const isAblated = arm.startsWith("MEM_ABL");
      for (const row of armRows) {
        expect(row.factual_evidence_present).toBe(!isAblated);
        expect(row.life_arm).toBe(arm === "MEM_A" || arm === "MEM_ABL_A" ? "A" : "B");
        if (["VALID", "DIRECTIVE_CLARIFY"].includes(row.status)) {
          expect(row.behavior_text.length).toBeGreaterThan(0);
        } else {
          expect(row.behavior_text).toBe("");
        }
      }
    }
    const completion = readJson(join("real-provider", "collection-complete.json")) as { cognition_calls: number; language_calls: number; no_further_generation: boolean };
    expect(completion.cognition_calls).toBe(20);
    expect(completion.language_calls).toBeLessThanOrEqual(20);
    expect(completion.no_further_generation).toBe(true);
  });

  it("verdict is from the frozen vocabulary and collection validity is reported honestly", () => {
    if (!existsSync(join(evidenceDir, "summary.json"))) return;
    const summary = readJson("summary.json") as {
      verdict: string;
      verdict_is_informative: boolean;
      verdict_interpretation: string;
      collection_validity: { valid_trials: number; invalid_trials: number; complete_four_arm_units: number; treatment_contrast_formable: boolean; retries: number };
      metrics: { complete_units: number };
      real_calls: { future_cognition: number; future_language: number };
    };
    expect(VERDICTS).toContain(summary.verdict);
    expect(summary.collection_validity.valid_trials + summary.collection_validity.invalid_trials).toBe(20);
    expect(summary.collection_validity.retries).toBe(0);
    expect(summary.metrics.complete_units).toBe(summary.collection_validity.complete_four_arm_units);
    expect(summary.verdict_is_informative).toBe(
      summary.collection_validity.invalid_trials === 0 && summary.collection_validity.treatment_contrast_formable
    );
    if (!summary.verdict_is_informative) {
      expect(summary.verdict_interpretation).toBe("COLLECTION_VALIDITY_FAILURE_NOT_EVIDENCE_OF_ABSENCE_OF_EFFECT");
    }
    expect(summary.real_calls.future_cognition).toBe(20);
    expect(summary.real_calls.future_language).toBeLessThanOrEqual(20);

    const gates = readJson("quality-gates.json") as Record<string, unknown>;
    expect(gates["all_pass"]).toBe(
      gates["collection_valid"] === true &&
      gates["memory_ablation_control_valid"] === true &&
      gates["scenario_equality"] === true
    );
    expect(gates["manual_injection_absent"]).toBe(true);
    expect(gates["manual_affect_patch"]).toBe(false);
    expect(gates["manual_memory_write"]).toBe(false);
    expect(gates["manual_memory_ref_injection"]).toBe(false);
    expect(gates["production_behavior_changing_diff"]).toBe(0);
    expect(gates["provider_input_deterministic_within_arm"]).toBe(true);
  });
});
