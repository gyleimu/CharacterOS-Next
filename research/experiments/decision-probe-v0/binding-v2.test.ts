/* eslint-disable no-restricted-imports -- Isolated research instrument over frozen built production roots (the repository's established research-harness convention); zero production code changes and no production import of this module. */
/**
 * DecisionProbeV0 — observation-binding verification V2 (O1–O7). ZERO model calls.
 *
 * O1 the fixture observation really appears in `[current observation]` (a REF, per production
 *    semantics) instead of `(none)`
 * O2 each fixture's committed scene is byte-equivalent to its frozen `observation_text`
 * O3 different fixtures produce different observation refs AND different scenes
 * O4 the observation is NOT duplicated into task / system prompt / history / retrieval / summary
 * O5 the production-equivalent provider and the capture path remain byte-identical
 * O6 the DecisionProbe transformation still changes only the frozen declared surface
 * O7 the only scientific request difference vs RUN_001 is the observation binding (generated
 *    separately into the run directory by `run-diff.ts`)
 */

import { describe, expect, it } from "vitest";

import { canonicalJsonString } from "../../../packages/subject-core/dist/index.js";
import {
  CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA,
  ConversationCognitionProviderV8
} from "../../../packages/runtime/dist/providers/behavior/conversation-cognition-provider-v8.js";
import type {
  ModelTransportRequestV0,
  ModelTransportResponseV0,
  ModelTransportV0
} from "../../../packages/runtime/dist/transports/model-transport.js";

import { runCognitionCapture } from "../canonical-affect-behavior-influence-v1/harness.ts";

import { captureProductionRequestForFixtureV0 } from "./binding.js";
import {
  buildDecisionProbeRequestV0,
  DECISION_PROBE_JSON_SCHEMA,
  DECISION_PROBE_OVERRIDE_BLOCK_V0
} from "./contract.js";
import { D0_FIXTURES, type DecisionProbeD0FixtureV0 } from "./fixtures.js";
import { buildFixtureWorldWithObservationV0 } from "./observation-binding.js";

function userContentOf(request: ModelTransportRequestV0): string {
  return request.messages.find((message) => message.role === "user")?.content ?? "";
}

function observationLineOf(request: ModelTransportRequestV0): string {
  const match = /^\[current observation\] (.*)$/m.exec(userContentOf(request));
  return match?.[1] ?? "(absent)";
}

function sceneOf(request: ModelTransportRequestV0): string {
  // The production conversation renderer interpolates the scene with JSON.stringify
  // (conversation-cognition-provider-v2.ts:259), so the rendered token is a JSON string
  // literal and must be decoded before comparison.
  const match = /^\[context\] scene=("(?:[^"\\]|\\.)*") task=/m.exec(userContentOf(request));
  if (match?.[1] === undefined) return "(absent)";
  return JSON.parse(match[1]) as string;
}

/** The escaped form of the fixture text exactly as the production renderer writes it. */
function escapedFixtureText(text: string): string {
  return JSON.stringify(text).slice(1, -1);
}

describe("Observation binding V2 — O1 the observation appears in [current observation]", () => {
  it("renders a real observation ref, not (none), for every fixture", async () => {
    for (const fixture of D0_FIXTURES) {
      const bound = await captureProductionRequestForFixtureV0(fixture);
      const line = observationLineOf(bound.production_request);
      expect(line).not.toBe("(none)");
      expect(line).not.toBe("(absent)");
      expect(line).toBe(bound.observation.observation_ref);
      expect(line.startsWith("observation:o-")).toBe(true);
    }
  });

  it("the ref is derived from the fixture id, not fabricated", async () => {
    for (const fixture of D0_FIXTURES) {
      const bound = await captureProductionRequestForFixtureV0(fixture);
      expect(bound.observation.observation_ref).toBe(
        `observation:o-${fixture.fixture_id.toLowerCase()}`
      );
    }
  });
});

describe("Observation binding V2 — O2 scene is byte-equivalent to the frozen fixture text", () => {
  it("the committed scene equals the fixture's observation_text exactly", async () => {
    for (const fixture of D0_FIXTURES) {
      const bound = await captureProductionRequestForFixtureV0(fixture);
      expect(bound.observation.scene).toBe(fixture.observation_text);
      expect(sceneOf(bound.production_request)).toBe(fixture.observation_text);
    }
  });

  it("the projection agrees with the committed state", async () => {
    const fixture = D0_FIXTURES[0] as DecisionProbeD0FixtureV0;
    const { world, scene } = await buildFixtureWorldWithObservationV0(fixture);
    const capture = await runCognitionCapture(world, []);
    const projection = capture.provider_input as {
      context: { scene: string; task: string | null; current_observation_ref: string | null };
    };
    expect(projection.context.scene).toBe(fixture.observation_text);
    expect(projection.context.scene).toBe(scene);
  });
});

describe("Observation binding V2 — O3 different fixtures differ", () => {
  it("distinct observation refs and distinct scenes", async () => {
    const bound = await Promise.all(
      D0_FIXTURES.map((fixture) => captureProductionRequestForFixtureV0(fixture))
    );
    expect(new Set(bound.map((entry) => entry.observation.observation_ref)).size).toBe(
      D0_FIXTURES.length
    );
    expect(new Set(bound.map((entry) => entry.observation.scene)).size).toBe(D0_FIXTURES.length);
  });
});

describe("Observation binding V2 — O4 the observation is not duplicated", () => {
  it("task is null: the observation is not also the task", async () => {
    for (const fixture of D0_FIXTURES) {
      const bound = await captureProductionRequestForFixtureV0(fixture);
      expect(bound.observation.task).toBeNull();
      expect(/^\[context\] scene="[\s\S]*?" task=\(none\)$/m.test(userContentOf(bound.production_request))).toBe(true);
    }
  });

  it("the fixture text appears exactly once in the SUBJECT DATA", async () => {
    for (const fixture of D0_FIXTURES) {
      const user = userContentOf((await captureProductionRequestForFixtureV0(fixture)).production_request);
      const escaped = escapedFixtureText(fixture.observation_text);
      expect(user.split(escaped).length - 1).toBe(1);
      // The decoded scene is the single carrier of the observation.
      expect(sceneOf((await captureProductionRequestForFixtureV0(fixture)).production_request)).toBe(
        fixture.observation_text
      );
    }
  });

  it("no history, retrieval, summary or transcript section is introduced into SUBJECT DATA", async () => {
    // Scope: the USER message carries SUBJECT DATA, which is where a leaked summary, history or
    // retrieval block would appear. The SYSTEM message is the frozen production law prompt and
    // is not the subject-data surface.
    for (const fixture of D0_FIXTURES) {
      const bound = await captureProductionRequestForFixtureV0(fixture);
      const user = userContentOf(bound.production_request);
      for (const forbidden of [
        "[PRIOR FACTUAL MEMORY",
        "[CONVERSATION HISTORY]",
        "[TRANSCRIPT]",
        "episode:",
        "summary of",
        "provenance"
      ]) {
        expect(user.includes(forbidden)).toBe(false);
      }
    }
  });
});

describe("Observation binding V2 — O5 the capture path still equals the production provider", () => {
  it("byte-identical messages and schema for the repaired request", async () => {
    const fixture = D0_FIXTURES[1] as DecisionProbeD0FixtureV0;
    const { world } = await buildFixtureWorldWithObservationV0(fixture);
    const capture = await runCognitionCapture(world, []);
    const emitted: ModelTransportRequestV0[] = [];
    const capturingTransport: ModelTransportV0 = {
      complete: async (request: ModelTransportRequestV0): Promise<ModelTransportResponseV0> => {
        emitted.push(request);
        return { content: "{}", model: "capturing-stub" };
      }
    };
    await new ConversationCognitionProviderV8(capturingTransport as never)
      .propose(capture.provider_input as never)
      .catch(() => undefined);

    const bound = await captureProductionRequestForFixtureV0(fixture);
    expect(emitted).toHaveLength(1);
    expect(canonicalJsonString(bound.production_request.messages)).toBe(
      canonicalJsonString((emitted[0] as ModelTransportRequestV0).messages)
    );
    expect((emitted[0] as ModelTransportRequestV0).structured_output?.schema).toBe(
      CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA
    );
  });
});

describe("Observation binding V2 — O6 the probe transformation is still the frozen surface", () => {
  it("only structured_output.schema (+ the frozen override block in override mode) changes", async () => {
    for (const fixture of D0_FIXTURES) {
      const bound = await captureProductionRequestForFixtureV0(fixture);
      for (const mode of ["PURE_SUBSTITUTION", "SUBSTITUTION_WITH_OVERRIDE"] as const) {
        const built = await buildDecisionProbeRequestV0(bound.production_request, mode);
        expect(built.fidelity.chain_of_custody_ok).toBe(true);
        expect(built.request.structured_output?.schema).toBe(DECISION_PROBE_JSON_SCHEMA);
        expect(built.request.messages.find((m) => m.role === "user")?.content).toBe(
          userContentOf(bound.production_request)
        );
        if (mode === "SUBSTITUTION_WITH_OVERRIDE") {
          const before = bound.production_request.messages.find((m) => m.role === "system")?.content ?? "";
          const after = built.request.messages.find((m) => m.role === "system")?.content ?? "";
          expect(after.slice(before.length)).toBe(DECISION_PROBE_OVERRIDE_BLOCK_V0);
        } else {
          expect(built.fidelity.messages_preserved).toBe(true);
        }
      }
    }
  });
});
