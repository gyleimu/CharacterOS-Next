/**
 * CONTENT_SENSITIVE_APPRAISAL_PROVIDER_V0 — pipeline Level 2/3 proof.
 *
 * Uses a TEST-ONLY content-sensitive appraisal producer (no Ollama) to prove
 * the runtime pipeline carries different event content into different lawful
 * Appraisal proposals (Level 2) and — through the EXISTING canonical
 * AffectApplication equations — into different canonical Affect (Level 3).
 * Also proves exactly ONE provider call per factual event.
 */

import { describe, expect, it } from "vitest";

import type { SubjectStateV0 } from "@characteros-next/subject-core";
import type { FactualEventAppraisalContextProjectionV0, FactualEventAppraisalProviderV0 } from "@characteros-next/appraisal";
import type {
  ModelTransportRequestV0,
  ModelTransportResponseV0,
  ModelTransportV0
} from "../transports/model-transport.js";
import {
  InteractiveSubjectRuntimeV0,
  createInteractiveSubjectSeedV0,
  type InteractiveSubjectSnapshotV0
} from "./interactive-subject-runtime-v0.js";

const SUBJECT_ID = "alice";

/** TEST-ONLY content-sensitive producer: maps scene semantics to dimensions. */
function contentSensitiveTestProvider(counter: { calls: number }): FactualEventAppraisalProviderV0 {
  return {
    proposeFactualEventAppraisal: async (context: never) => {
      counter.calls += 1;
      const ctx = context as unknown as FactualEventAppraisalContextProjectionV0;
      const scene = ctx.current_observable_scene.toLowerCase();
      const incongruent = /worse|failed|didn't work|don't|stop|problem/.test(scene);
      const congruent = /worked|hoped|helped|useful|thanks|well/.test(scene);
      const goalCongruence = incongruent ? 0.05 : congruent ? 0.95 : 0.5;
      const intensity = incongruent ? 0.9 : congruent ? 0.7 : 0.4;
      return {
        schema_version: "factual-event-appraisal-proposal-v0",
        status: "APPRAISED",
        subject_id: ctx.subject_id,
        factual_event_ref: ctx.factual_event_ref,
        context_projection_hash: ctx.context_projection_hash,
        dimensions: {
          relevance: 0.8,
          goal_congruence: goalCongruence,
          attribution: "other",
          controllability: 0.3,
          uncertainty: 0.2,
          intensity
        },
        assessment_confidence: 0.8,
        evidence_refs: [ctx.factual_event_ref].sort()
      };
    }
  } as unknown as FactualEventAppraisalProviderV0;
}

function cognitionTransport(): ModelTransportV0 {
  return {
    complete: async (request: ModelTransportRequestV0): Promise<ModelTransportResponseV0> => {
      const user = request.messages.find((message) => message.role === "user")?.content ?? "";
      const projectionHash = /\[projection_hash\]\s+(\S+)/.exec(user)?.[1] ?? "";
      return {
        content: JSON.stringify({
          schema_version: "conversation-cognition-proposal-v1",
          cognition: {
            schema_version: "cognition-proposal-v0",
            projection_hash: projectionHash,
            reasoning_summary: "offline cognition",
            relevant_memory_refs: [],
            considered_context_refs: [],
            current_intent: "respond to the user",
            confidence: 0.7,
            uncertainty: 0.3,
            action_intent: null,
            evidence_refs: []
          },
          communication_directive: { kind: "CLARIFY_MISSING_CONTEXT" }
        }),
        model: "fake"
      } as ModelTransportResponseV0;
    }
  } as ModelTransportV0;
}

const languageTransport = {
  complete: async (): Promise<ModelTransportResponseV0> =>
    ({ content: "{}", model: "fake" }) as ModelTransportResponseV0
} as ModelTransportV0;

function options(provider: FactualEventAppraisalProviderV0) {
  return {
    session_id: "sess-content-sensitive",
    subject: { subject_id: SUBJECT_ID, display_name: "", identity_anchors: [] },
    v3_source: createInteractiveSubjectSeedV0(SUBJECT_ID) as SubjectStateV0,
    conversationCognitionTransport: cognitionTransport(),
    languageTransport,
    factualEventAppraisalProvider: provider,
    interval_ticks: 1,
    provider_identity: { model: "fake", num_predict: 2048 },
    clock: () => "2026-01-01T00:00:00.000Z"
  };
}

async function primaryAppraisalDimensions(
  runtime: InteractiveSubjectRuntimeV0
): Promise<Record<string, unknown>> {
  const snapshot = (await runtime.snapshot()) as InteractiveSubjectSnapshotV0;
  const records = snapshot.store.revisions
    .flatMap((revision) => revision.payloads)
    .filter((entry) => (entry.payload as { schema_version?: string }).schema_version === "factual-event-appraisal-record-v0");
  const primary = records[0];
  if (primary === undefined) throw new Error("no primary appraisal record found");
  return (primary.payload as { dimensions: Record<string, unknown> }).dimensions;
}

describe("CONTENT_SENSITIVE_APPRAISAL_PROVIDER_V0 — pipeline", () => {
  it("different event content yields a different lawful appraisal proposal (Level 2)", async () => {
    const counterA = { calls: 0 };
    const counterB = { calls: 0 };
    const runtimeA = await InteractiveSubjectRuntimeV0.create(options(contentSensitiveTestProvider(counterA)));
    const runtimeB = await InteractiveSubjectRuntimeV0.create(options(contentSensitiveTestProvider(counterB)));
    await runtimeA.submitUserText("That worked exactly as I hoped.");
    await runtimeB.submitUserText("That made the situation worse.");

    const dimsA = await primaryAppraisalDimensions(runtimeA);
    const dimsB = await primaryAppraisalDimensions(runtimeB);
    expect(dimsA["goal_congruence"]).not.toBe(dimsB["goal_congruence"]);
    expect(dimsA["intensity"]).not.toBe(dimsB["intensity"]);
    // Canonical record schema: no sentiment/emotion/reward surface.
    expect(Object.keys(dimsA).sort()).toEqual([
      "attribution",
      "controllability",
      "goal_congruence",
      "intensity",
      "relevance",
      "uncertainty"
    ]);
  });

  it("the different lawful appraisal propagates to canonical Affect (Level 3)", async () => {
    const runtimeA = await InteractiveSubjectRuntimeV0.create(options(contentSensitiveTestProvider({ calls: 0 })));
    const runtimeB = await InteractiveSubjectRuntimeV0.create(options(contentSensitiveTestProvider({ calls: 0 })));
    await runtimeA.submitUserText("That worked exactly as I hoped.");
    await runtimeB.submitUserText("That made the situation worse.");
    const affectA = (await runtimeA.status()).affect;
    const affectB = (await runtimeB.status()).affect;
    expect(affectA.valence).not.toBe(affectB.valence);
  });

  it("invokes the appraisal provider exactly once per factual event", async () => {
    const counter = { calls: 0 };
    const runtime = await InteractiveSubjectRuntimeV0.create(options(contentSensitiveTestProvider(counter)));
    await runtime.submitUserText("One event only.");
    expect(counter.calls).toBe(1);
  });

  it("a malformed appraisal proposal fails the interaction closed with no neutral substitution", async () => {
    const failing = {
      proposeFactualEventAppraisal: async (): Promise<unknown> => ({ status: "APPRAISED", dimensions: {} })
    } as unknown as FactualEventAppraisalProviderV0;
    const runtime = await InteractiveSubjectRuntimeV0.create(options(failing));
    const outcome = await runtime.submitUserText("Must fail closed.");
    expect(outcome.status).toBe("FAILED");
    const status = await runtime.status();
    expect(status.repository_revision).toBe("R0");
    expect(status.turn_index).toBe(0);
  });
});
