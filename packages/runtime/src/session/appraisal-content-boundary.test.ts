/**
 * INTERACTIVE_SUBJECT_APPRAISAL_CONTENT_BOUNDARY_V0 — content availability.
 *
 * Proves the appraisal provider input carries the CURRENT factual event's
 * committed observable content (Level 1 content availability), deterministically,
 * without transcript/Memory leakage, without host interpretation, and without
 * changing the canonical appraisal record schema.
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

interface Capture {
  readonly contexts: FactualEventAppraisalContextProjectionV0[];
}

/** Recording appraisal provider: valid APPRAISED proposal + captured context. */
function recordingAppraisalProvider(capture: Capture): FactualEventAppraisalProviderV0 {
  return {
    proposeFactualEventAppraisal: async (context: never) => {
      const ctx = context as unknown as FactualEventAppraisalContextProjectionV0;
      capture.contexts.push(structuredClone(ctx));
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
    session_id: "sess-appraisal-content",
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

const PROJECTION_KEYS = [
  "schema_version",
  "subject_id",
  "factual_event_ref",
  "factual_event_payload_hash",
  "source_observation_ref",
  "source_observation_transition_id",
  "source_admission_history_sequence",
  "state_revision",
  "state_hash",
  "repository_revision",
  "logical_time",
  "current_task",
  "current_observable_scene",
  "context_projection_hash"
].sort();

describe("INTERACTIVE_SUBJECT_APPRAISAL_CONTENT_BOUNDARY_V0", () => {
  it("current event content reaches the appraisal provider on the first turn", async () => {
    const capture: Capture = { contexts: [] };
    const runtime = await InteractiveSubjectRuntimeV0.create(options(recordingAppraisalProvider(capture)));
    await runtime.submitUserText("Thank you, that really helped.");
    expect(capture.contexts.length).toBeGreaterThan(0);
    const first = capture.contexts[0];
    expect(first?.current_observable_scene).toContain('The user says: "Thank you, that really helped."');
    // Epistemic framing: the subject sees what was said, not an objective fact.
    expect(first?.current_observable_scene).toContain("The user says:");
  });

  it("different content with identical structure changes the provider input identity", async () => {
    const captureA: Capture = { contexts: [] };
    const captureB: Capture = { contexts: [] };
    const runtimeA = await InteractiveSubjectRuntimeV0.create(options(recordingAppraisalProvider(captureA)));
    const runtimeB = await InteractiveSubjectRuntimeV0.create(options(recordingAppraisalProvider(captureB)));
    await runtimeA.submitUserText("Thank you, that really helped.");
    await runtimeB.submitUserText("Stop doing that. That made things worse.");

    const a = captureA.contexts[0];
    const b = captureB.contexts[0];
    expect(a?.current_observable_scene).not.toBe(b?.current_observable_scene);
    expect(a?.context_projection_hash).not.toBe(b?.context_projection_hash);
    // Structural fixture is otherwise identical (same seed, time, ordinal).
    expect(a?.source_admission_history_sequence).toBe(b?.source_admission_history_sequence);
    expect(a?.state_revision).toBe(b?.state_revision);
    expect(a?.current_task).toBe(b?.current_task);
  });

  it("identical content produces a deterministic provider input", async () => {
    const captureA: Capture = { contexts: [] };
    const captureB: Capture = { contexts: [] };
    const runtimeA = await InteractiveSubjectRuntimeV0.create(options(recordingAppraisalProvider(captureA)));
    const runtimeB = await InteractiveSubjectRuntimeV0.create(options(recordingAppraisalProvider(captureB)));
    await runtimeA.submitUserText("A fixed deterministic message.");
    await runtimeB.submitUserText("A fixed deterministic message.");
    expect(JSON.stringify(captureA.contexts[0])).toBe(JSON.stringify(captureB.contexts[0]));
  });

  it("provider input carries the current event only: no transcript, no Memory dump", async () => {
    const capture: Capture = { contexts: [] };
    const runtime = await InteractiveSubjectRuntimeV0.create(options(recordingAppraisalProvider(capture)));
    await runtime.submitUserText("First message content here.");
    await runtime.submitUserText("Second message content here.");

    // No hidden fields.
    expect(Object.keys(capture.contexts[0] ?? {}).sort()).toEqual(PROJECTION_KEYS);
    const serialized = JSON.stringify(capture.contexts);
    expect(serialized).not.toContain("[PRIOR FACTUAL MEMORY");
    expect(serialized).not.toContain("[CONVERSATION HISTORY]");
    expect(serialized).not.toContain("[TRANSCRIPT]");
    expect(serialized).not.toContain("messages");
    // The second-turn appraisals see the second event, not the first message.
    const laterContexts = capture.contexts.slice(1);
    expect(laterContexts.some((ctx) => ctx.current_observable_scene.includes("Second message content here."))).toBe(true);
    for (const ctx of laterContexts) {
      expect(ctx.current_observable_scene).not.toContain("First message content here.");
    }
  });

  it("counterpart-feedback content reaches appraisal factually (no host label)", async () => {
    const capture: Capture = { contexts: [] };
    const runtime = await InteractiveSubjectRuntimeV0.create(options(recordingAppraisalProvider(capture)));
    await runtime.submitUserText("Suggest something for my desk.");
    await runtime.submitUserText("That fixed it, thanks.");
    const replyContexts = capture.contexts.filter((ctx) => ctx.current_observable_scene.includes("That fixed it, thanks."));
    expect(replyContexts.length).toBeGreaterThan(0);
    for (const ctx of replyContexts) {
      // No host-authored sentiment/feedback classification.
      expect(JSON.stringify(ctx)).not.toMatch(/POSITIVE_FEEDBACK|NEGATIVE_FEEDBACK|sentiment|reward/i);
    }
  });

  it("after restart only the new current event reaches appraisal", async () => {
    const captureA: Capture = { contexts: [] };
    const runtimeA = await InteractiveSubjectRuntimeV0.create(options(recordingAppraisalProvider(captureA)));
    await runtimeA.submitUserText("Pre-restart event text.");
    const snapshot = await runtimeA.snapshot();

    const captureB: Capture = { contexts: [] };
    const runtimeB = await InteractiveSubjectRuntimeV0.restore(
      options(recordingAppraisalProvider(captureB)),
      JSON.parse(JSON.stringify(snapshot)) as InteractiveSubjectSnapshotV0
    );
    await runtimeB.submitUserText("Post-restart event text.");
    expect(captureB.contexts.length).toBeGreaterThan(0);
    expect(captureB.contexts.some((ctx) => ctx.current_observable_scene.includes("Post-restart event text."))).toBe(true);
    for (const ctx of captureB.contexts) {
      expect(ctx.current_observable_scene).not.toContain("Pre-restart event text.");
    }
  });

  it("subject setup is not appraised as a lived event", async () => {
    const capture: Capture = { contexts: [] };
    await InteractiveSubjectRuntimeV0.create(options(recordingAppraisalProvider(capture)));
    expect(capture.contexts).toHaveLength(0);
  });

  it("canonical appraisal record schema is unchanged (content is provider input only)", async () => {
    const capture: Capture = { contexts: [] };
    const runtime = await InteractiveSubjectRuntimeV0.create(options(recordingAppraisalProvider(capture)));
    await runtime.submitUserText("Content stays out of canonical state.");
    const snapshot = await runtime.snapshot();
    const records = snapshot.store.revisions
      .flatMap((revision) => revision.payloads)
      .filter((entry) => (entry.payload as { schema_version?: string }).schema_version === "factual-event-appraisal-record-v0");
    expect(records.length).toBeGreaterThan(0);
    for (const record of records) {
      const payload = record.payload as Record<string, unknown>;
      expect(Object.keys(payload)).not.toContain("current_observable_scene");
      expect((payload["subject_context"] as Record<string, unknown>)["current_task"]).toBeDefined();
    }
  });

  it("appraisal provider failure remains fail-closed (no neutral substitution)", async () => {
    const failing = {
      proposeFactualEventAppraisal: async (): Promise<unknown> => ({ not: "a proposal" })
    } as unknown as FactualEventAppraisalProviderV0;
    const runtime = await InteractiveSubjectRuntimeV0.create(options(failing));
    const outcome = await runtime.submitUserText("This must fail closed.");
    expect(outcome.status).toBe("FAILED");
    const status = await runtime.status();
    expect(status.repository_revision).toBe("R0");
    expect(status.turn_index).toBe(0);
  });
});
