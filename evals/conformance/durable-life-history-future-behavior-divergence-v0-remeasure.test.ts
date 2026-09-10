/**
 * DURABLE_LIFE_HISTORY_FUTURE_BEHAVIOR_DIVERGENCE_V0_REMEASURE — CI conformance
 * gate (zero real model calls; persisted evidence + frozen built roots only).
 *
 * Proves the remeasurement is a REPAIRED MEASUREMENT of the frozen V0 design:
 *   - frozen design reuse and the untouched original V0 evidence;
 *   - Phase-A gates passed before any real future call (memory facts
 *     provider-visible, ablation clean, no request-diff confounds);
 *   - strict-prefix, balanced, fresh-restore collection with reproduced
 *     provider-request identities;
 *   - schema acceptance restored (0/20 invalid vs the original 13/20);
 *   - §29 denominators kept separate and consistent with the verdict;
 *   - the frozen verdict vocabulary is respected.
 */

/* eslint-disable @typescript-eslint/no-non-null-assertion -- Conformance assertions over a frozen 20-row evidence table: row order and per-arm membership are asserted immediately before each indexed read. */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REMEASURE_DIR = "research/experiments/durable-life-history-future-behavior-divergence-v0-remeasure";
const EVIDENCE = join(process.cwd(), REMEASURE_DIR, "evidence/run-1-real-provider");
const ORIGINAL_V0_SUMMARY = join(
  process.cwd(),
  "research/experiments/durable-life-history-future-behavior-divergence-v0/evidence/run-1-real-provider/summary.json"
);

const ARMS = ["MEM_A", "MEM_B", "MEM_ABL_A", "MEM_ABL_B"] as const;
const VERDICTS = [
  "DURABLE_LIFE_HISTORY_FUTURE_BEHAVIOR_DIVERGENCE_SUPPORTED",
  "DURABLE_HISTORY_FUTURE_COGNITION_EFFECT_ONLY",
  "FUTURE_BEHAVIOR_DIVERGENCE_INPUT_EFFECT_ONLY",
  "NO_MEASURABLE_DURABLE_HISTORY_FUTURE_EFFECT_UNDER_V0",
  "MEMORY_ABLATION_CONTROL_INVALID",
  "FUTURE_MEMORY_VISIBILITY_FAILURE",
  "CAUSAL_CHAIN_CONFOUND_DETECTED",
  "REAL_PROVIDER_UNAVAILABLE",
  "COLLECTION_VALIDITY_FAILURE"
];

interface TrialRow {
  readonly future_arm: string;
  readonly life_arm: string;
  readonly trial_ordinal: number;
  readonly execution_order: number;
  readonly within_unit_order: number;
  readonly trial_id: string;
  readonly provider_input_hash: string;
  readonly rendered_request_hash: string;
  readonly trace_request_hash: string | null;
  readonly request_identity_match: boolean;
  readonly memory_section_present: boolean;
  readonly status: string;
  readonly behavior_text: string;
  readonly cognition: { readonly status: string; readonly current_intent: string | null; readonly communication_directive: string | null };
  readonly failure_taxonomy: Record<string, unknown> | null;
}

function readJson(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(EVIDENCE, name), "utf8")) as Record<string, unknown>;
}

function readRows(): TrialRow[] {
  return readFileSync(join(EVIDENCE, "real-provider", "trials.jsonl"), "utf8")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as TrialRow);
}

describe("DURABLE_LIFE_HISTORY_FUTURE_BEHAVIOR_DIVERGENCE_V0_REMEASURE — conformance", () => {
  it("Phase A froze the remeasurement with zero real future calls and declared design reuse", () => {
    if (!existsSync(join(EVIDENCE, "phase-a-complete.json"))) {
      console.log("remeasurement evidence absent (pre-collection checkout); skipping");
      return;
    }
    const phaseA = readJson("phase-a-complete.json");
    expect(phaseA["all_pass"]).toBe(true);
    expect(phaseA["future_real_model_calls"]).toBe(0);
    const atPhaseA = readJson("phase-a.json");
    expect(atPhaseA["future_real_model_calls"]).toBe(0);
    expect(atPhaseA["original_v0_reused"]).toBe("PASS");
    expect(atPhaseA["sample_size_reused"]).toBe("PASS");
    const reference = readJson("original-v0-contract-reference.json") as {
      original_v0: { commit: string; evidence_dir: string; verdict_is_informative: boolean };
      reused_unchanged: { trials_per_arm: number; arms: string[] };
      original_evidence_untouched: boolean;
    };
    expect(reference.original_evidence_untouched).toBe(true);
    expect(reference.original_v0.verdict_is_informative).toBe(false);
    expect(reference.reused_unchanged.trials_per_arm).toBe(5);
    expect([...reference.reused_unchanged.arms].sort()).toEqual([...ARMS].sort());
    const repair = readJson("repair-baseline.json") as { repair: { commit: string; verdict: string } };
    expect(repair.repair.commit).toBe("e09d4b87e27c2935379da33a6e838592f0e00bcd");
    expect(repair.repair.verdict).toBe("DURABLE_MEMORY_COGNITION_PROVIDER_SURFACE_REPAIR_IMPLEMENTED_GREEN");
  });

  it("Phase-A gates prove provider-readable memory facts, clean ablation and no confounds (0 real future calls)", () => {
    if (!existsSync(join(EVIDENCE, "future-input-diff-audit.json"))) return;
    const audit = readJson("future-input-diff-audit.json") as {
      checks: Record<string, boolean>;
      treatment_request_diff: { classification_counts: Record<string, number>; unexpected_confound_count: number; structurally_equal: boolean; differing_lines: unknown[] };
      future_affect: { classification: string; residual_valence_delta: number };
    };
    expect(audit.checks["memory_factual_content_provider_visible"]).toBe(true);
    expect(audit.checks["memory_evidence_visible"]).toBe(true);
    expect(audit.checks["ablation_target_evidence_absent"]).toBe(true);
    expect(audit.checks["ablation_equivalence_A"]).toBe(true);
    expect(audit.checks["ablation_equivalence_B"]).toBe(true);
    expect(audit.checks["ablation_pair_body_equal_except_affect"]).toBe(true);
    expect(audit.checks["scenario_equality"]).toBe(true);
    expect(audit.checks["repair_regression_pass"]).toBe(true);
    expect(audit.treatment_request_diff.unexpected_confound_count).toBe(0);
    expect(audit.treatment_request_diff.structurally_equal).toBe(true);
    // The visible difference is real factual memory content, not just a hash.
    expect((audit.treatment_request_diff.classification_counts["EXPECTED_MEMORY_CONTENT"] ?? 0)).toBeGreaterThan(0);
    expect(audit.future_affect.residual_valence_delta).toBeLessThan(0.001);
    expect(audit.future_affect.classification).toBe("FUTURE_AFFECT_NEGLIGIBLE_BUT_NONZERO");

    const surface = readJson("provider-surface-audit.json") as {
      memory_factual_content_provider_visible: string;
      ablation_target_evidence_absent: string;
      memory_section_capture: Record<string, { present: boolean; section_hash: string; rendered_request_hash: string }>;
      checks: Record<string, boolean>;
    };
    expect(surface.memory_factual_content_provider_visible).toBe("PASS");
    expect(surface.ablation_target_evidence_absent).toBe("PASS");
    expect(surface.memory_section_capture["MEM_A"]!.present).toBe(true);
    expect(surface.memory_section_capture["MEM_B"]!.present).toBe(true);
    expect(surface.memory_section_capture["MEM_ABL_A"]!.present).toBe(false);
    expect(surface.memory_section_capture["MEM_ABL_B"]!.present).toBe(false);
    for (const key of ["memory_factual_rendering_active", "set_like_ref_canonicalization_active", "validator_duplicate_rejection_active", "unknown_ref_rejection_active"]) {
      expect(surface.checks[key]).toBe(true);
    }
  });

  it("collection is strict-prefix, balanced, fresh-restored, with reproduced provider-request identities", () => {
    if (!existsSync(join(EVIDENCE, "real-provider", "trials.jsonl"))) return;
    const rows = readRows();
    expect(rows).toHaveLength(20);
    const rotations = [0, 1, 2, 3, 4].map((k) => [0, 1, 2, 3].map((i) => ARMS[(i + k) % ARMS.length]));
    let index = 0;
    for (let ordinal = 1; ordinal <= 5; ordinal += 1) {
      const order = rotations[ordinal - 1]!;
      for (let within = 1; within <= 4; within += 1) {
        const row = rows[index]!;
        expect(row.execution_order).toBe(index + 1);
        expect(row.trial_ordinal).toBe(ordinal);
        expect(row.within_unit_order).toBe(within);
        expect(row.future_arm).toBe(order[within - 1]!);
        // The real provider request provably carried the rendered content.
        expect(row.request_identity_match).toBe(true);
        expect(row.trace_request_hash).toBe(row.rendered_request_hash);
        // Memory section exactly on the treatment arms.
        expect(row.memory_section_present).toBe(row.future_arm === "MEM_A" || row.future_arm === "MEM_B");
        index += 1;
      }
    }
    for (const arm of ARMS) {
      const armRows = rows.filter((row) => row.future_arm === arm);
      expect(armRows).toHaveLength(5);
      expect(new Set(armRows.map((row) => row.provider_input_hash)).size).toBe(1);
      for (const row of armRows) {
        expect(row.cognition.status).toBe("VALID");
        expect(row.behavior_text.length).toBeGreaterThan(0);
        expect(row.failure_taxonomy).toBeNull();
      }
    }
    const integrity = readJson(join("real-provider", "collection-integrity.json")) as {
      strict_prefix_verified: boolean; request_identity_match_all_trials: boolean; retries: number;
    };
    expect(integrity.strict_prefix_verified).toBe(true);
    expect(integrity.request_identity_match_all_trials).toBe(true);
    expect(integrity.retries).toBe(0);
    const completion = readJson(join("real-provider", "collection-complete.json")) as {
      cognition_calls: number; language_calls: number; no_further_generation: boolean;
    };
    expect(completion.cognition_calls).toBe(20);
    expect(completion.language_calls).toBeLessThanOrEqual(20);
    expect(completion.no_further_generation).toBe(true);
  });

  it("schema acceptance is restored and no ordering-related rejection recurs (§32)", () => {
    if (!existsSync(join(EVIDENCE, "failure-summary.json"))) return;
    const failures = readJson("failure-summary.json") as {
      invalid_trials: number;
      ordering_related_rejections: number;
      ordering_regression_detected: boolean;
      original_v0_comparison: { original_invalid_schema: number; remeasure_invalid: number };
      per_arm: Record<string, { valid: number; invalid: number }>;
    };
    expect(failures.invalid_trials).toBe(0);
    expect(failures.ordering_related_rejections).toBe(0);
    expect(failures.ordering_regression_detected).toBe(false);
    expect(failures.original_v0_comparison.original_invalid_schema).toBe(13);
    expect(failures.original_v0_comparison.remeasure_invalid).toBe(0);
    for (const arm of ARMS) {
      expect(failures.per_arm[arm]!.valid).toBe(5);
      expect(failures.per_arm[arm]!.invalid).toBe(0);
    }
  });

  it("§29 denominators stay separate and support the frozen verdict", () => {
    if (!existsSync(join(EVIDENCE, "summary.json"))) return;
    const summary = readJson("summary.json") as {
      verdict: string;
      informative: boolean;
      denominators: { complete_behavior_four_arm_units: number; complete_cognition_four_arm_units: number; stage_valid_pairs: Record<string, number[]> };
      metrics: {
        primary: Record<string, number | null>;
        behavior_delta: number;
        intent_delta: number;
        arm_failure_rate_range: number;
      };
      collection_validity_gate_pass: boolean;
      tokens: Record<string, unknown>;
      real_calls: { life_reconstruction: { cognition: number; language: number }; future_cognition: number; future_language: number };
    };
    expect(VERDICTS).toContain(summary.verdict);
    expect(summary.informative).toBe(true);
    expect(summary.collection_validity_gate_pass).toBe(true);
    expect(summary.denominators.complete_behavior_four_arm_units).toBe(5);
    expect(summary.denominators.complete_cognition_four_arm_units).toBe(5);
    for (const pair of Object.keys(summary.denominators.stage_valid_pairs)) {
      expect(summary.denominators.stage_valid_pairs[pair]).toEqual([1, 2, 3, 4, 5]);
    }
    expect(summary.metrics.arm_failure_rate_range).toBe(0);
    // Frozen thresholds: behavior clears the support bar; intent does not — the
    // preregistered rules therefore yield the input-effect-only verdict.
    expect(summary.metrics.behavior_delta).toBeCloseTo(0.8, 10);
    expect(summary.metrics.intent_delta).toBeCloseTo(0, 10);
    expect(summary.verdict).toBe("FUTURE_BEHAVIOR_DIVERGENCE_INPUT_EFFECT_ONLY");
    expect(summary.real_calls.future_cognition).toBe(20);
    expect(summary.real_calls.future_language).toBeLessThanOrEqual(20);
    expect(summary.tokens["external_api_cost"]).toBe("0 (local Ollama; no external API calls)");
  });

  it("the original V0 evidence is preserved unchanged (§3/§45)", () => {
    if (!existsSync(ORIGINAL_V0_SUMMARY)) return;
    const original = JSON.parse(readFileSync(ORIGINAL_V0_SUMMARY, "utf8")) as {
      verdict: string;
      verdict_is_informative: boolean;
      verdict_interpretation: string;
      collection_validity: { invalid_trials: number; complete_four_arm_units: number };
    };
    expect(original.verdict).toBe("NO_MEASURABLE_DURABLE_HISTORY_FUTURE_EFFECT_UNDER_V0");
    expect(original.verdict_is_informative).toBe(false);
    expect(original.verdict_interpretation).toBe("COLLECTION_VALIDITY_FAILURE_NOT_EVIDENCE_OF_ABSENCE_OF_EFFECT");
    expect(original.collection_validity.invalid_trials).toBe(13);
    expect(original.collection_validity.complete_four_arm_units).toBe(0);
  });
});
