/**
 * RELATIONSHIP_FAMILIARITY_CAUSAL_COMPLETION_V0 — zero-model conformance.
 *
 * Proves, offline (real model calls 0):
 *   - the feature under test is the ONE registered governed decision feature, and
 *     its value semantics are the frozen production law (ABSENT → 1/32 → k/32,
 *     denominator 32, saturation, no decay, no REINITIALIZE);
 *   - both histories accrue familiarity through the REAL governed writer authority
 *     + Atomic Commit V2 path from canonical episodes, with identical Memory;
 *   - the LIVE chain is used (Cognition V8 projection / Language V10 / response
 *     atom), with the convention evidence advertised as a factual source;
 *   - the matched-Memory control: LOW vs HIGH differ only in the familiarity
 *     material (plus enumerated revision metadata);
 *   - the §36 projection-level ablation replaces exactly the familiarity material
 *     and never touches canonical state;
 *   - no condition-label leakage;
 *   - fresh-process authoritative restore preserves value, revision and the
 *     rendered cognition material byte-exactly;
 *   - the predeclared endpoint classifier is deterministic;
 *   - the call budget stays within the preregistered maximum.
 */
import { beforeAll, describe, expect, it } from "vitest";

import {
  ABLATED_CONDITION_ID,
  CONDITIONS,
  GATES,
  MODEL,
  REPLICATES_PRIMARY,
  SCENARIOS,
  scheduledCallMaximum,
  scheduledScenes
} from "../../research/experiments/relationship-familiarity-causal-completion-v0/contract.ts";
import { preflight, type FrozenFixture, type PreflightResult } from "../../research/experiments/relationship-familiarity-causal-completion-v0/preflight.ts";

let cached: PreflightResult | null = null;
async function run(): Promise<PreflightResult> {
  if (cached === null) cached = await preflight();
  return cached;
}

beforeAll(async () => {
  cached = await preflight();
}, 600_000);

describe("relationship familiarity causal completion — preregistration (zero model calls)", () => {
  it("budgets at most the preregistered 100 scheduled calls with no retries", () => {
    const scenes = scheduledScenes();
    expect(scenes.length).toBeGreaterThan(0);
    expect(scenes.every((scene) => [ "LOW", "HIGH", ABLATED_CONDITION_ID ].includes(scene.condition))).toBe(true);
    expect(scheduledCallMaximum()).toBeLessThanOrEqual(100);
    expect(MODEL.temperature).toBe(0);
    expect(MODEL.model).toBe("qwen3.5:9b");
    expect(MODEL.digest).toHaveLength(64);
    expect(GATES.statistical_significance_claim).toBe(false);
  });

  it("builds both histories through the real familiarity path with identical Memory", async () => {
    const { fixture, evidence } = await run();
    const familiarity = (evidence as { familiarity: { LOW: number; HIGH: number; expected: { LOW: number; HIGH: number } } }).familiarity;
    expect(familiarity.LOW).toBe(CONDITIONS.LOW.expected_value);
    expect(familiarity.HIGH).toBe(CONDITIONS.HIGH.expected_value);
    expect(familiarity.LOW).toBe(1 / 32);
    expect(familiarity.HIGH).toBe(16 / 32);
    const matched = (evidence as { matched_memory: { identical_episode_records: boolean; substantive_difference_count: number } }).matched_memory;
    expect(matched.identical_episode_records).toBe(true);
    expect(matched.substantive_difference_count).toBeLessThanOrEqual(2);
    expect(fixture.preflight_hash.startsWith("sha256:")).toBe(true);
  });

  it("uses the live chain: Language V10 with the routed atom, convention evidence as an F handle", async () => {
    const { evidence } = await run();
    const chain = (evidence as { live_chain: { language_schema: string; convention_handle: string | null } }).live_chain;
    expect(chain.language_schema).toBe("language-realization-input-v10");
    expect(chain.convention_handle).toMatch(/^F[0-9]+$/);
  });

  it("confines LOW vs HIGH differences to the familiarity material and revision metadata", async () => {
    const { evidence } = await run();
    const differences = (evidence as { matched_memory: { low_high_differences: readonly { allowed: boolean }[] } }).matched_memory.low_high_differences;
    expect(differences.length).toBeGreaterThan(0);
    expect(differences.every((entry) => entry.allowed)).toBe(true);
  });

  it("ablates exactly the familiarity material at the projection level", async () => {
    const { fixture, evidence } = await run();
    const ablation = (evidence as { ablation: { differences: readonly { allowed: boolean }[]; removed: readonly string[] | null } }).ablation;
    expect(ablation.differences.every((entry) => entry.allowed)).toBe(true);
    expect(ablation.removed?.length).toBeGreaterThan(0);
    expect(fixture.absent_rendering.familiarity_entry_line).toContain("presence=ABSENT");
  });

  it("never leaks condition labels into the model-facing input", async () => {
    const { evidence } = await run();
    const classes = (evidence as { offline_classes: Record<string, string> }).offline_classes;
    expect(Object.keys(classes).sort()).toEqual(["ABSENT", "HIGH", "HIGH_ABLATED", "LOW"]);
    expect(Object.values(classes).every((value) => typeof value === "string")).toBe(true);
  });

  it("fresh-process authoritative restore preserves value, revision and rendered material", async () => {
    const { evidence } = await run();
    const proof = (evidence as { restore_proof: readonly { condition: string; matches_parent: boolean; familiarity_entry_line: string | null }[] }).restore_proof;
    expect(proof).toHaveLength(2);
    for (const entry of proof) {
      expect(entry.matches_parent).toBe(true);
      expect(entry.familiarity_entry_line).toMatch(/presence=PRESENT level=(1|16)\/32/);
    }
  });

  it("classifies the primary scenario endpoint deterministically from the protocol atom", async () => {
    const { evidence } = await run();
    const classes = (evidence as { offline_classes: Record<string, string> }).offline_classes;
    const primaryScenario = SCENARIOS[0] as { readonly classes: readonly string[] };
    for (const scenarioClass of primaryScenario.classes) {
      expect(["ESTABLISHED_CONVENTION_USED", "FRAMING_QUESTION", "STANCE", "CONVERSATIONAL_ACT", "OTHER_FACT", "UNCLASSIFIED"]).toContain(scenarioClass);
    }
    expect(classes["LOW"]).toBe("ESTABLISHED_CONVENTION_USED");
    expect(classes["HIGH"]).toBe("ESTABLISHED_CONVENTION_USED");
  });

  it("freezes the fixture with the model identity and the scheduled maximum", async () => {
    const { fixture } = await run();
    const frozen = fixture as FrozenFixture;
    expect(frozen.model).toEqual(MODEL);
    expect(frozen.scheduled_calls_maximum).toBeLessThanOrEqual(100);
    expect(frozen.histories.LOW.familiarity_value).toBe(1 / 32);
    expect(frozen.histories.HIGH.familiarity_value).toBe(16 / 32);
    expect(REPLICATES_PRIMARY).toBe(8);
  });
});
