/**
 * RELATIONSHIP_FAMILIARITY_BEHAVIORAL_DIFFERENTIATION_REAL_PROVIDER_V0 — offline conformance.
 *
 * Deterministic, 0 real provider calls: arm construction, strict isolation of
 * the production cognition input, frozen pair order/manifest, and serialization.
 * The formal real-provider run is a separate, explicitly-invoked CLI command.
 */

import { describe, expect, it } from "vitest";
import {
  HIGH,
  LOW,
  PAIRS,
  RUBRIC_CLASSES,
  SCENARIOS,
  THRESHOLD
} from "../../research/experiments/relationship-familiarity-behavior-real-provider-v0/contract.ts";
import { buildArm } from "../../research/experiments/relationship-familiarity-behavior-real-provider-v0/fixtures.ts";
import { runPreflight } from "../../research/experiments/relationship-familiarity-behavior-real-provider-v0/preflight.ts";
import { endpoint, fakeTransports, observeArm } from "../../research/experiments/relationship-familiarity-behavior-real-provider-v0/observe.ts";

describe("RELATIONSHIP_FAMILIARITY_BEHAVIORAL_DIFFERENTIATION_REAL_PROVIDER_V0 — frozen harness", () => {
  it("constructs both arms as canonical states whose model-visible projection differs only by familiarity", async () => {
    const report = await runPreflight();
    expect(report.failures).toEqual([]);
    expect(report.verdict).toBe("STRICT_FAMILIARITY_ONLY_INPUT_ISOLATION_PASS");
    expect(report.scenarios).toHaveLength(SCENARIOS.length);
    for (const scenario of report.scenarios) {
      expect(scenario.low.influence_strategy).toBe(LOW.strategy);
      expect(scenario.high.influence_strategy).toBe(HIGH.strategy);
      // No Memory evidence ref may differ.
      expect(scenario.high.evidence_refs).toEqual(scenario.low.evidence_refs);
      expect(scenario.low.evidence_refs).toEqual(["episode:alice-08"]);
      // HIGH triggers exactly one familiarity-priority attempt; LOW none.
      expect(scenario.low.retrieval_attempts).toBe(0);
      expect(scenario.high.retrieval_attempts).toBe(1);
      // Every differing line is familiarity-derived.
      expect(scenario.approved_diff).toBe(true);
      expect(scenario.differing_lines.length).toBe(2);
      expect(scenario.differing_lines.some((line) => line.includes("context_resolution_strategy="))).toBe(true);
      expect(scenario.differing_lines.some((line) => line.startsWith("[projection_hash]"))).toBe(true);
      // Internal commit provenance is not model-visible, but canonical Memory
      // binding/records are shared byte-for-byte.
      expect(scenario.low.memory_binding_hash).toBe(scenario.high.memory_binding_hash);
    }
  }, 60000);

  it("freezes the pair plan: 4 scenarios x 2 counterbalanced repetitions", () => {
    expect(SCENARIOS).toHaveLength(4);
    expect(PAIRS).toHaveLength(8);
    expect(PAIRS.filter((pair) => pair.order === "LOW_FIRST")).toHaveLength(4);
    expect(PAIRS.filter((pair) => pair.order === "HIGH_FIRST")).toHaveLength(4);
    for (const scenario of SCENARIOS) {
      const rows = PAIRS.filter((pair) => pair.scenario_id === scenario.scenario_id);
      expect(rows).toHaveLength(2);
      expect(new Set(rows.map((row) => row.order)).size).toBe(2);
    }
  });

  it("freezes the rubric and threshold", () => {
    expect(RUBRIC_CLASSES).toEqual([
      "COUNTERPART_CONTEXT_USED",
      "BASIC_CONTEXT_USED",
      "CLARIFICATION_REQUESTED",
      "UNSUPPORTED_CONTEXT_ASSUMPTION",
      "NO_CLEAR_DIFFERENCE"
    ]);
    expect(THRESHOLD.complete_run).toBe(true);
    expect(THRESHOLD.min_familiarity_consistent_pairs).toBe(6);
    expect(THRESHOLD.max_reverse_pairs).toBe(0);
    expect(LOW.value).toBeCloseTo(1 / 32, 10);
    expect(HIGH.value).toBeCloseTo(2 / 32, 10);
  });

  it("runs only offline fake transports before the formal run (0 real calls)", async () => {
    const scenario = SCENARIOS[0] as (typeof SCENARIOS)[number];
    const world = await buildArm({ scenario, arm: "HIGH", familiarity: HIGH.value });
    const observation = await observeArm(world, fakeTransports(), { requestId: "response-request-conformance" });
    expect(observation.validity).toBe("VALID_BEHAVIOR");
    expect(observation.cognition_stage.raw?.model).toBe("OFFLINE_SCHEMA_FIXTURE");
    expect(observation.language_stage.raw?.model).toBe("OFFLINE_SCHEMA_FIXTURE");
    expect(observation.cognition_stage.calls).toBe(1);
    expect(observation.language_stage.calls).toBe(1);
    // Deterministic endpoint serialization is stable.
    const first = endpoint(observation);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
  }, 60000);
});
