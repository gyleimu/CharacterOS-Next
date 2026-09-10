/**
 * INTERACTIVE_SUBJECT_MEMORY_INSPECTION_V0 — read-only lived-memory projection.
 *
 * Proves the projection is canonical-derived, chronological, safe (no authority
 * leak, no objective-truth rewrite), immutable, non-mutating and provider-free.
 */

import { describe, expect, it, vi } from "vitest";

import type { SubjectStateV0 } from "@characteros-next/subject-core";
import type { FactualEventAppraisalProviderV0 } from "@characteros-next/appraisal";
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
const REALIZED_REPLY = "PRODUCT_REALIZATION_REPLY";

interface TransportRecorder {
  readonly requests: { readonly messages: readonly { readonly role: string; readonly content: string }[] }[];
}

function fakeAppraisalProvider(): FactualEventAppraisalProviderV0 {
  return {
    proposeFactualEventAppraisal: async (context: never) => {
      const ctx = context as unknown as { subject_id: string; factual_event_ref: string; context_projection_hash: string };
      return {
        schema_version: "factual-event-appraisal-proposal-v0",
        status: "APPRAISED",
        subject_id: ctx.subject_id,
        factual_event_ref: ctx.factual_event_ref,
        context_projection_hash: ctx.context_projection_hash,
        dimensions: {
          relevance: 0.6,
          goal_congruence: 0.5,
          attribution: "other",
          controllability: 0.5,
          uncertainty: 0.5,
          intensity: 0.4
        },
        assessment_confidence: 0.6,
        evidence_refs: [ctx.factual_event_ref].sort()
      };
    }
  } as unknown as FactualEventAppraisalProviderV0;
}

function cognitionTransport(recorder: TransportRecorder): ModelTransportV0 {
  return {
    complete: async (request: ModelTransportRequestV0): Promise<ModelTransportResponseV0> => {
      recorder.requests.push({ messages: request.messages.map((m) => ({ role: m.role, content: m.content })) });
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
          communication_directive: { kind: "REALIZE_CURRENT_INTENT" }
        }),
        model: "fake"
      } as ModelTransportResponseV0;
    }
  } as ModelTransportV0;
}

function languageTransport(): ModelTransportV0 {
  return {
    complete: async (request: ModelTransportRequestV0): Promise<ModelTransportResponseV0> => {
      const user = request.messages.find((message) => message.role === "user")?.content ?? "";
      const inputHash = /input_hash:\s*(sha256:[0-9a-f]+)/.exec(user)?.[1] ?? "";
      return {
        content: JSON.stringify({
          schema_version: "language-realization-draft-v0",
          input_hash: inputHash,
          text: REALIZED_REPLY,
          evidence_refs: []
        }),
        model: "fake"
      } as ModelTransportResponseV0;
    }
  } as ModelTransportV0;
}

function options(recorder: TransportRecorder) {
  return {
    session_id: "sess-memory-inspection",
    subject: { subject_id: SUBJECT_ID, display_name: "Alice", identity_anchors: [] },
    v3_source: createInteractiveSubjectSeedV0(SUBJECT_ID, "Alice") as SubjectStateV0,
    conversationCognitionTransport: cognitionTransport(recorder),
    languageTransport: languageTransport(),
    factualEventAppraisalProvider: fakeAppraisalProvider(),
    interval_ticks: 1,
    provider_identity: { model: "fake", num_predict: 2048 },
    clock: () => "2026-01-01T00:00:00.000Z"
  };
}

describe("INTERACTIVE_SUBJECT_MEMORY_INSPECTION_V0 — read-only lived memory", () => {
  it("empty memory yields a safe empty projection", async () => {
    const runtime = await InteractiveSubjectRuntimeV0.create(options({ requests: [] }));
    const inspection = await runtime.livedMemory();
    expect(inspection.total_episode_count).toBe(0);
    expect(inspection.displayed_count).toBe(0);
    expect(inspection.entries).toEqual([]);
    expect(inspection.repository_revision).toBe("R0");
  });

  it("observation episode renders the exact recorded counterpart statement", async () => {
    const runtime = await InteractiveSubjectRuntimeV0.create(options({ requests: [] }));
    await runtime.submitUserText("My favorite color is teal.");
    const inspection = await runtime.livedMemory();
    expect(inspection.total_episode_count).toBe(1);
    const entry = inspection.entries[0];
    expect(entry?.kind).toBe("OBSERVATION");
    if (entry?.kind === "OBSERVATION") {
      expect(entry.scene).toContain('The user says: "My favorite color is teal."');
      // Epistemic boundary: stored as a stated utterance, never an objective fact.
      expect(entry.scene).not.toMatch(/objectively|is true/i);
    }
  });

  it("behavior-outcome episode renders both the delivered behavior and the exact reply", async () => {
    const runtime = await InteractiveSubjectRuntimeV0.create(options({ requests: [] }));
    const first = await runtime.submitUserText("How should I organize my desk?");
    await runtime.submitUserText("That was helpful.");
    const inspection = await runtime.livedMemory();
    expect(inspection.total_episode_count).toBe(2);
    const outcome = inspection.entries.find((entry) => entry.kind === "BEHAVIOR_OUTCOME");
    expect(outcome).toBeDefined();
    if (outcome?.kind === "BEHAVIOR_OUTCOME") {
      expect(outcome.delivered_behavior_text).toBe(first.subject_text);
      expect(outcome.outcome_reply_text).toBe("That was helpful.");
      expect(JSON.stringify(outcome)).not.toMatch(/reward|sentiment|trust|success/i);
    }
  });

  it("mixed history preserves deterministic chronological order", async () => {
    const runtime = await InteractiveSubjectRuntimeV0.create(options({ requests: [] }));
    await runtime.submitUserText("First observation.");
    await runtime.submitUserText("First outcome reply.");
    await runtime.submitUserText("Second outcome reply.");
    const inspection = await runtime.livedMemory();
    expect(inspection.total_episode_count).toBe(3);
    expect(inspection.entries.map((entry) => entry.kind)).toEqual([
      "OBSERVATION",
      "BEHAVIOR_OUTCOME",
      "BEHAVIOR_OUTCOME"
    ]);
    const times = inspection.entries.map((entry) => entry.occurrence_logical_time);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it("display limit keeps the most recent window without deleting anything", async () => {
    const runtime = await InteractiveSubjectRuntimeV0.create(options({ requests: [] }));
    await runtime.submitUserText("Observation one.");
    await runtime.submitUserText("Outcome reply one.");
    await runtime.submitUserText("Outcome reply two.");
    const limited = await runtime.livedMemory({ limit: 2 });
    expect(limited.total_episode_count).toBe(3);
    expect(limited.displayed_count).toBe(2);
    expect(limited.entries.map((entry) => entry.kind)).toEqual(["BEHAVIOR_OUTCOME", "BEHAVIOR_OUTCOME"]);
    // Full history is untouched and still inspectable.
    const full = await runtime.livedMemory({ limit: 10 });
    expect(full.displayed_count).toBe(3);
  });

  it("inspection causes no subject mutation, no revision/index change and no provider call", async () => {
    const recorder: TransportRecorder = { requests: [] };
    const runtime = await InteractiveSubjectRuntimeV0.create(options(recorder));
    await runtime.submitUserText("Remember this.");
    const before = await runtime.status();
    const callsBefore = recorder.requests.length;
    const inspection = await runtime.livedMemory();
    const after = await runtime.status();
    expect(recorder.requests.length).toBe(callsBefore);
    expect(after.repository_revision).toBe(before.repository_revision);
    expect(after.state_revision).toBe(before.state_revision);
    expect(after.turn_index).toBe(before.turn_index);
    expect(after.pending_behavior_outcome).toBe(before.pending_behavior_outcome);
    expect(inspection.repository_revision).toBe(before.repository_revision);
  });

  it("returned projection is immutable and detached from canonical state", async () => {
    const runtime = await InteractiveSubjectRuntimeV0.create(options({ requests: [] }));
    await runtime.submitUserText("Immutable?");
    const inspection = await runtime.livedMemory();
    expect(Object.isFrozen(inspection)).toBe(true);
    expect(Object.isFrozen(inspection.entries)).toBe(true);
    expect(Object.isFrozen(inspection.entries[0])).toBe(true);
    const entry = inspection.entries[0] as { scene: string };
    expect(() => {
      entry.scene = "tampered";
    }).toThrow();
    const again = await runtime.livedMemory();
    expect(JSON.stringify(again)).toBe(JSON.stringify(inspection));
  });

  it("restart produces the same durable projection", async () => {
    const runtimeA = await InteractiveSubjectRuntimeV0.create(options({ requests: [] }));
    await runtimeA.submitUserText("My favorite color is teal.");
    await runtimeA.submitUserText("That's good to know.");
    const snapshot = await runtimeA.snapshot();
    const projectionA = await runtimeA.livedMemory();

    const restored = await InteractiveSubjectRuntimeV0.restore(
      options({ requests: [] }),
      JSON.parse(JSON.stringify(snapshot)) as InteractiveSubjectSnapshotV0
    );
    const projectionB = await restored.livedMemory();
    expect(JSON.stringify(projectionB)).toBe(JSON.stringify(projectionA));
  });

  it("a resolution failure fails closed instead of skipping records", async () => {
    const runtime = await InteractiveSubjectRuntimeV0.create(options({ requests: [] }));
    await runtime.submitUserText("Anything.");
    const authority = (runtime as unknown as { authority: { readLivedMemoryV0: () => Promise<unknown> } }).authority;
    const spy = vi
      .spyOn(authority, "readLivedMemoryV0")
      .mockRejectedValue(new Error("resolver failure"));
    await expect(runtime.livedMemory()).rejects.toThrow("resolver failure");
    spy.mockRestore();
  });
});
