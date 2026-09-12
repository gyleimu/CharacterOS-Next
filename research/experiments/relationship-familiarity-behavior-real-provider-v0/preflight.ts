/* eslint-disable no-restricted-imports -- Research harness over frozen built roots. */
/**
 * Deterministic preflight (0 real calls) for
 * RELATIONSHIP_FAMILIARITY_BEHAVIORAL_DIFFERENTIATION_REAL_PROVIDER_V0.
 *
 * Proves, BEFORE any model call:
 *   - the two arms' canonical states are identical except the familiarity value;
 *   - the two arms share the SAME Memory binding/records;
 *   - the rendered production cognition input differs ONLY on lines attributable
 *     to canonical familiarity (the derived context-resolution influence line and
 *     the derived projection-hash line);
 *   - HIGH triggers exactly one familiarity-priority retrieval attempt and LOW none.
 */

import { canonicalJsonString } from "../../../packages/subject-core/dist/index.js";
import { HIGH, LOW, SCENARIOS } from "./contract.ts";
import { buildArm, check, equal, type World } from "./fixtures.ts";
import { fakeTransports, observeArm, objectHash } from "./observe.ts";

export interface ArmProbe {
  readonly arm: "LOW" | "HIGH";
  readonly state_hash: string;
  readonly memory_binding_hash: string;
  readonly projection_hash: string;
  readonly influence_strategy: string | null;
  readonly evidence_refs: readonly string[];
  readonly retrieval_attempts: number;
  readonly cognition_request_hash: string;
  readonly user_content: string;
  /** Model-visible projection material EXCEPT familiarity-derived fields/hash. */
  readonly projection_material: string;
}

const FAMILIARITY_DERIVED_KEYS = ["interaction_familiarity", "interaction_familiarity_cognition_influences", "projection_hash"];

export interface ScenarioReport {
  readonly scenario_id: string;
  readonly low: ArmProbe;
  readonly high: ArmProbe;
  readonly differing_lines: readonly string[];
  readonly low_only_lines: readonly string[];
  readonly high_only_lines: readonly string[];
  readonly approved_diff: boolean;
}

export interface PreflightReport {
  readonly schema_version: "relationship-familiarity-behavior-preflight-v0";
  readonly low_value: number;
  readonly high_value: number;
  readonly scenarios: readonly ScenarioReport[];
  readonly verdict: "STRICT_FAMILIARITY_ONLY_INPUT_ISOLATION_PASS" | "STRICT_FAMILIARITY_ONLY_INPUT_ISOLATION_FAIL";
  readonly failures: readonly string[];
}

function userContentOf(observation: Awaited<ReturnType<typeof observeArm>>): string {
  const request = observation.cognition_stage.request;
  if (request === null) throw new Error("preflight: cognition request missing");
  return request.messages.find((message) => message.role === "user")?.content ?? "";
}

async function probeArm(world: World, save?: (name: string, value: unknown) => Promise<void>): Promise<ArmProbe> {
  const sink: { low: string | null; high: string | null } = { low: null, high: null };
  const observation = await observeArm(
    world,
    fakeTransports(),
    save === undefined
      ? { requestId: "response-request-preflight" }
      : {
          requestId: "response-request-preflight",
          save: async (name, value) => {
            if (name === "cognition-request") await save(`${world.arm.toLowerCase()}-${name}`, value);
            if (name === "cognition-projection") await save(`${world.arm.toLowerCase()}-${name}`, value);
          }
        }
  );
  if (world.arm === "LOW") sink.low = userContentOf(observation);
  else sink.high = userContentOf(observation);
  const projection = observation.projection;
  check(projection !== null, "projection captured");
  const influence = projection.interaction_familiarity_cognition_influences[0]?.context_resolution_strategy ?? null;
  return {
    arm: world.arm,
    state_hash: objectHash(world.snapshot),
    memory_binding_hash: objectHash(world.binding),
    projection_hash: projection.projection_hash as string,
    influence_strategy: influence,
    evidence_refs: [
      ...new Set<string>([
        ...(projection.memory_working_refs as readonly string[]),
        ...(projection.recent_retrieval_refs as readonly string[])
      ])
    ].sort(),
    retrieval_attempts: observation.retrieval_trace.queries.length,
    cognition_request_hash: observation.cognition_stage.request_hash as string,
    user_content: userContentOf(observation),
    projection_material: canonicalJsonString(
      Object.fromEntries(
        Object.entries(projection as unknown as Record<string, unknown>).filter(
          ([key]) => !FAMILIARITY_DERIVED_KEYS.includes(key)
        )
      )
    )
  };
}

/** Lines whose difference is lawfully attributable to canonical familiarity. */
function approvedLine(line: string): boolean {
  return line.includes("context_resolution_strategy=") || line.startsWith("[projection_hash]");
}

export async function runPreflight(
  save?: (name: string, value: unknown) => Promise<void>
): Promise<PreflightReport> {
  const failures: string[] = [];
  const scenarios: ScenarioReport[] = [];
  for (const scenario of SCENARIOS) {
    const lowWorld = await buildArm({ scenario, arm: "LOW", familiarity: LOW.value });
    const highWorld = await buildArm({ scenario, arm: "HIGH", familiarity: HIGH.value });

    // Strict canonical-state equality except the familiarity dimension.
    if (!equal(lowWorld.binding, highWorld.binding)) failures.push(`${scenario.scenario_id}: memory binding differs`);
    check(equal(lowWorld.records, highWorld.records), "shared Memory records identical");

    const low = await probeArm(lowWorld, save);
    const high = await probeArm(highWorld, save);

    // Every model-visible projection field EXCEPT familiarity-derived
    // material must be identical (internal commit-provenance refs derived from
    // the familiarity-bearing proposal are not model-visible).
    if (low.projection_material !== high.projection_material) {
      failures.push(`${scenario.scenario_id}: model-visible projection material differs beyond familiarity`);
    }

    if (low.influence_strategy !== LOW.strategy) failures.push(`${scenario.scenario_id}: LOW influence ${low.influence_strategy}`);
    if (high.influence_strategy !== HIGH.strategy) failures.push(`${scenario.scenario_id}: HIGH influence ${high.influence_strategy}`);
    if (!equal(low.evidence_refs, high.evidence_refs)) failures.push(`${scenario.scenario_id}: evidence refs differ`);
    if (low.retrieval_attempts !== 0) failures.push(`${scenario.scenario_id}: LOW made ${low.retrieval_attempts} priority attempts`);
    if (high.retrieval_attempts !== 1) failures.push(`${scenario.scenario_id}: HIGH made ${high.retrieval_attempts} priority attempts`);

    const before = low.user_content.split("\n");
    const after = high.user_content.split("\n");
    if (before.length !== after.length) failures.push(`${scenario.scenario_id}: cognition input line count differs`);
    const differing = before.filter((line, index) => line !== after[index]);
    const lowOnly = before.filter((line, index) => line !== after[index]);
    const highOnly = after.filter((line, index) => line !== before[index]);
    const approved = differing.every(approvedLine);
    if (!approved) failures.push(`${scenario.scenario_id}: unapproved differing lines ${JSON.stringify(differing)}`);
    if (!differing.some((line) => line.includes("context_resolution_strategy="))) {
      failures.push(`${scenario.scenario_id}: no influence-line difference`);
    }
    scenarios.push({
      scenario_id: scenario.scenario_id,
      low,
      high,
      differing_lines: differing,
      low_only_lines: lowOnly,
      high_only_lines: highOnly,
      approved_diff: approved
    });
  }
  return {
    schema_version: "relationship-familiarity-behavior-preflight-v0",
    low_value: LOW.value,
    high_value: HIGH.value,
    scenarios,
    verdict: failures.length === 0
      ? "STRICT_FAMILIARITY_ONLY_INPUT_ISOLATION_PASS"
      : "STRICT_FAMILIARITY_ONLY_INPUT_ISOLATION_FAIL",
    failures
  };
}
