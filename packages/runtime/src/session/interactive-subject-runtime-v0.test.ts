/**
 * INTERACTIVE_PERSISTENT_SUBJECT_RUNTIME_V0 — deterministic offline acceptance.
 *
 * No real model calls: fake transports, fake appraisal provider. Covers the
 * turn lifecycle, deferred counterpart feedback, fail-closed provider handling,
 * and a REAL restart simulated by serializing the snapshot to JSON, destroying
 * every runtime object, and restoring a fresh runtime from the parsed image.
 */

import { describe, expect, it } from "vitest";

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
  type InteractiveSubjectRuntimeOptionsV0,
  type InteractiveSubjectSnapshotV0
} from "./interactive-subject-runtime-v0.js";

const SUBJECT_ID = "alice";
type Mode = "CLARIFY" | "REALIZE" | "FAIL";

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

/** Records every provider request so the no-transcript audit is observable. */
interface TransportRecorder {
  readonly requests: { readonly messages: readonly { readonly role: string; readonly content: string }[] }[];
}

function fakeCognitionTransport(mode: () => Mode, recorder: TransportRecorder): ModelTransportV0 {
  return {
    complete: async (request: ModelTransportRequestV0): Promise<ModelTransportResponseV0> => {
      recorder.requests.push({ messages: request.messages.map((m) => ({ role: m.role, content: m.content })) });
      const user = request.messages.find((message) => message.role === "user")?.content ?? "";
      const projectionHash = /\[projection_hash\]\s+(\S+)/.exec(user)?.[1] ?? "";
      const selected = mode();
      if (selected === "FAIL") {
        return { content: "{ not json", model: "fake" } as ModelTransportResponseV0;
      }
      return {
        content: JSON.stringify({
          schema_version: "conversation-cognition-proposal-v1",
          cognition: {
            schema_version: "cognition-proposal-v0",
            projection_hash: projectionHash,
            reasoning_summary: "offline test cognition",
            relevant_memory_refs: [],
            considered_context_refs: [],
            current_intent: "respond to the user",
            confidence: 0.7,
            uncertainty: 0.3,
            action_intent: null,
            evidence_refs: []
          },
          communication_directive: {
            kind: selected === "CLARIFY" ? "CLARIFY_MISSING_CONTEXT" : "REALIZE_CURRENT_INTENT"
          }
        }),
        model: "fake"
      } as ModelTransportResponseV0;
    }
  } as ModelTransportV0;
}

function fakeLanguageTransport(): ModelTransportV0 {
  return {
    complete: async (request: ModelTransportRequestV0): Promise<ModelTransportResponseV0> => {
      const user = request.messages.find((message) => message.role === "user")?.content ?? "";
      const inputHash = /input_hash:\s*(sha256:[0-9a-f]+)/.exec(user)?.[1] ?? "";
      return {
        content: JSON.stringify({
          schema_version: "language-realization-draft-v0",
          input_hash: inputHash,
          text: "LANGUAGE_REALIZATION_REPLY",
          evidence_refs: []
        }),
        model: "fake"
      } as ModelTransportResponseV0;
    }
  } as ModelTransportV0;
}

function options(input: { mode?: () => Mode; recorder?: TransportRecorder } = {}): InteractiveSubjectRuntimeOptionsV0 {
  const recorder = input.recorder ?? { requests: [] };
  return {
    session_id: "sess-interactive-test",
    subject: { subject_id: SUBJECT_ID, display_name: "", identity_anchors: [] },
    v3_source: createInteractiveSubjectSeedV0(SUBJECT_ID) as SubjectStateV0,
    conversationCognitionTransport: fakeCognitionTransport(input.mode ?? (() => "CLARIFY"), recorder),
    languageTransport: fakeLanguageTransport(),
    factualEventAppraisalProvider: fakeAppraisalProvider(),
    interval_ticks: 1,
    provider_identity: { model: "fake", num_predict: 2048 },
    clock: () => "2026-01-01T00:00:00.000Z"
  };
}

describe("INTERACTIVE_PERSISTENT_SUBJECT_RUNTIME_V0 — offline acceptance", () => {
  it("first launch creates a subject and one user turn delivers a reply with deferred outcome", async () => {
    const recorder = { requests: [] as { messages: readonly { role: string; content: string }[] }[] };
    const runtime = await InteractiveSubjectRuntimeV0.create(options({ recorder }));
    expect(runtime.originClass()).toBe("NEW_SUBJECT");
    const turn = await runtime.submitUserText("Hello there.");
    expect(turn.status).toBe("COMPLETE");
    expect(turn.subject_text.length).toBeGreaterThan(0);
    expect(turn.delivery_id).not.toBeNull();
    // The turn's own behavior outcome Experience is deferred to the next user message.
    expect(turn.completed_prior_outcome).toBeNull();
    expect(runtime.hasPendingBehaviorOutcome()).toBe(true);
    // Exactly ONE cognition call for one turn.
    expect(recorder.requests).toHaveLength(1);
  });

  it("the next user message lawfully commits the prior delivered behavior's Experience/Memory", async () => {
    const runtime = await InteractiveSubjectRuntimeV0.create(options());
    const first = await runtime.submitUserText("I usually drink coffee without sugar.");
    const second = await runtime.submitUserText("I'm getting coffee. How should I order it?");
    expect(second.status).toBe("COMPLETE");
    expect(first.completed_prior_outcome).toBeNull();
    expect(second.completed_prior_outcome).not.toBeNull();
    expect(second.completed_prior_outcome?.turn_index).toBe(0);
    expect(second.completed_prior_outcome?.experience_ref).toBeTruthy();
    expect(second.completed_prior_outcome?.episode_ref).toBeTruthy();
    expect(second.completed_prior_outcome?.memory_event_ref).toBeTruthy();
    // Durable state advanced across the turn.
    expect(second.repository_revision_after).not.toBe(second.repository_revision_before);
  });

  it("visible reply comes from LanguageRealization, not from reasoning/internal state", async () => {
    const runtime = await InteractiveSubjectRuntimeV0.create(options({ mode: () => "REALIZE" }));
    const turn = await runtime.submitUserText("Please report the status.");
    expect(turn.directive).toBe("REALIZE_CURRENT_INTENT");
    expect(turn.language_call_required).toBe(true);
    expect(turn.subject_text).toBe("LANGUAGE_REALIZATION_REPLY");
  });

  it("status is read-only and does not mutate subject state", async () => {
    const runtime = await InteractiveSubjectRuntimeV0.create(options());
    await runtime.submitUserText("Hello.");
    const before = await runtime.status();
    const after = await runtime.status();
    expect(after.state_revision).toBe(before.state_revision);
    expect(after.repository_revision).toBe(before.repository_revision);
    expect(after.turn_index).toBe(before.turn_index);
    expect(after.pending_lifecycle_work).toBe(0);
  });

  it("malformed provider cognition fails closed: no delivery, no index advance", async () => {
    const runtime = await InteractiveSubjectRuntimeV0.create(options({ mode: () => "FAIL" }));
    const turn = await runtime.submitUserText("Hello.");
    expect(turn.status).toBe("FAILED");
    expect(turn.failure).toContain("TURN_FAILED_CLOSED");
    expect(turn.subject_text).toBe("");
    expect(turn.delivery_id).toBeNull();
    expect(turn.completed_prior_outcome).toBeNull();
    const status = await runtime.status();
    expect(status.turn_index).toBe(0);
    expect(status.completed_turns).toBe(0);
    expect(runtime.hasPendingBehaviorOutcome()).toBe(false);
  });

  it("status projects no authority token or capability", async () => {
    const runtime = await InteractiveSubjectRuntimeV0.create(options());
    await runtime.submitUserText("Hello.");
    const status = (await runtime.status()) as unknown as Record<string, unknown>;
    const forbidden = /token|capability|issuer|ledger|manifest|binding|receipt|secret|private|ref$/i;
    for (const key of Object.keys(status)) {
      expect(forbidden.test(key)).toBe(false);
    }
  });

  it("naive JSON round-trip of the snapshot preserves the authoritative identity", async () => {
    const runtime = await InteractiveSubjectRuntimeV0.create(options());
    await runtime.submitUserText("First.");
    await runtime.submitUserText("Second.");
    const snapshot = await runtime.snapshot();
    const parsed = JSON.parse(JSON.stringify(snapshot)) as InteractiveSubjectSnapshotV0;
    expect(parsed.durable.identity.subject_state_hash).toBe(snapshot.durable.identity.subject_state_hash);
    expect(parsed.durable.identity.repository_revision).toBe(snapshot.durable.identity.repository_revision);
    const restored = await InteractiveSubjectRuntimeV0.restore(options(), parsed);
    const status = await restored.status();
    expect(status.origin).toBe("SUBJECT_RESTORED");
    expect(status.repository_revision).toBe(snapshot.durable.identity.repository_revision);
    expect(status.state_revision).toBe(snapshot.durable.identity.state_revision);
  });

  it("§43 real restart: fresh objects restore the same subject and pre-restart Memory is retrieved", async () => {
    const recorderA = { requests: [] as { messages: readonly { role: string; content: string }[] }[] };
    const runtimeA = await InteractiveSubjectRuntimeV0.create(options({ recorder: recorderA }));
    await runtimeA.submitUserText("I usually drink coffee without sugar.");
    await runtimeA.submitUserText("Thanks, noted.");
    const snapshot = await runtimeA.snapshot();
    const serialized = JSON.stringify(snapshot);
    const parsed = JSON.parse(serialized) as InteractiveSubjectSnapshotV0;

    // Destroy all runtime objects; restore into a completely fresh runtime.
    const recorderB = { requests: [] as { messages: readonly { role: string; content: string }[] }[] };
    const runtimeB = await InteractiveSubjectRuntimeV0.restore(options({ recorder: recorderB }), parsed);
    expect(runtimeB.originClass()).toBe("SUBJECT_RESTORED");
    expect(runtimeB.subjectId()).toBe(SUBJECT_ID);
    expect(runtimeB.currentTurnIndex()).toBe(2);
    expect(runtimeB.hasPendingBehaviorOutcome()).toBe(true);

    const turnB = await runtimeB.submitUserText("I'm getting coffee. How should I order it?");
    expect(turnB.status).toBe("COMPLETE");
    // Continuous revision: the restored repository is the pre-restart head, then advances.
    expect(turnB.repository_revision_before).toBe(snapshot.durable.identity.repository_revision);
    expect(turnB.repository_revision_after).not.toBe(turnB.repository_revision_before);
    // Pre-restart lived history is retrievable through production retrieval.
    expect(turnB.working_episode_refs.length).toBeGreaterThan(0);
    expect(turnB.provider_memory_section_present).toBe(true);
    // The prior turn's deferred behavior outcome is now committed post-restart.
    expect(turnB.completed_prior_outcome).not.toBeNull();

    // No transcript bypass: each provider call is exactly system+user, never a
    // rolled-up conversation history.
    for (const request of recorderB.requests) {
      expect(request.messages).toHaveLength(2);
      expect(request.messages[0]?.role).toBe("system");
      expect(request.messages[1]?.role).toBe("user");
      expect(request.messages[1]?.content ?? "").not.toContain("[CONVERSATION HISTORY]");
      expect(request.messages[1]?.content ?? "").not.toContain("[TRANSCRIPT]");
    }
  });

  it("restore failure does not silently create a new subject", async () => {
    const runtime = await InteractiveSubjectRuntimeV0.create(options());
    await runtime.submitUserText("First.");
    const snapshot = await runtime.snapshot();
    const corrupted = JSON.parse(JSON.stringify(snapshot)) as InteractiveSubjectSnapshotV0 & {
      store: { revisions: { repository_revision: string }[] };
    };
    corrupted.store.revisions = corrupted.store.revisions.filter((r) => r.repository_revision !== "R1");
    await expect(InteractiveSubjectRuntimeV0.restore(options(), corrupted)).rejects.toThrow();
  });

  it("restore fails closed on a subject-identity mismatch", async () => {
    const runtime = await InteractiveSubjectRuntimeV0.create(options());
    await runtime.submitUserText("First.");
    const snapshot = await runtime.snapshot();
    await expect(
      InteractiveSubjectRuntimeV0.restore(
        { ...options(), subject: { subject_id: "someone-else", display_name: "", identity_anchors: [] } },
        snapshot
      )
    ).rejects.toThrow(/configured subject/);
  });
});
