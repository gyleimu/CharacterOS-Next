/**
 * REAL_COUNTERPART_FEEDBACK_INGESTION_V0 — sealed semantics tests.
 *
 * Proves that explicit real-user feedback ("That fixed it, thanks.", "That
 * didn't solve it.", "No, I meant the blue one.") is ALREADY represented
 * lawfully by the frozen BehaviorOutcomeFeedback path as FACTUAL EVIDENCE:
 * the delivered behavior + the exact counterpart reply + delivery/time
 * provenance — with no reward, sentiment, trust or Affect shortcut.
 *
 * No production semantics were changed; these tests seal the existing contract.
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
    session_id: "sess-counterpart-feedback",
    subject: { subject_id: SUBJECT_ID, display_name: "", identity_anchors: [] },
    v3_source: createInteractiveSubjectSeedV0(SUBJECT_ID) as SubjectStateV0,
    conversationCognitionTransport: cognitionTransport(recorder),
    languageTransport: languageTransport(),
    factualEventAppraisalProvider: fakeAppraisalProvider(),
    interval_ticks: 1,
    provider_identity: { model: "fake", num_predict: 2048 },
    clock: () => "2026-01-01T00:00:00.000Z"
  };
}

interface StoredPayload {
  readonly ref: string;
  readonly payload: Record<string, unknown>;
}

function payloadsOf(snapshot: InteractiveSubjectSnapshotV0): StoredPayload[] {
  return snapshot.store.revisions.flatMap((revision) =>
    revision.payloads.map((entry) => ({ ref: entry.ref, payload: entry.payload as Record<string, unknown> }))
  );
}

interface FeedbackRecords {
  readonly experience: Record<string, unknown>;
  readonly episode: Record<string, unknown>;
  readonly event: Record<string, unknown>;
}

function feedbackRecordsOf(snapshot: InteractiveSubjectSnapshotV0): FeedbackRecords[] {
  const payloads = payloadsOf(snapshot);
  const experiences = payloads.filter((entry) => entry.payload["schema_version"] === "experience-record-v0");
  return experiences.map((entry) => {
    const eventRef = entry.payload["event_ref"] as string;
    const episode = payloads.find(
      (candidate) =>
        candidate.ref.startsWith("episode:") &&
        ((candidate.payload["provenance"] as { cause_refs?: readonly string[] } | undefined)?.cause_refs ?? []).includes(eventRef)
    );
    const event = payloads.find((candidate) => candidate.ref === eventRef);
    if (episode === undefined || event === undefined) {
      throw new Error(`feedback records incomplete for ${String(entry.ref)}`);
    }
    return { experience: entry.payload, episode: episode.payload, event: event.payload };
  });
}

function deliveriesOf(snapshot: InteractiveSubjectSnapshotV0): readonly Record<string, unknown>[] {
  return snapshot.durable.delivery_ledger_state as readonly Record<string, unknown>[];
}

const FORBIDDEN_SEMANTICS = /reward|score|sentiment|trust|punish|approval|rejection|success|confidence|valence|activation/i;

function feedbackAt(records: readonly FeedbackRecords[], index: number): FeedbackRecords {
  const entry = records[index];
  if (entry === undefined) throw new Error(`missing feedback record at index ${index}`);
  return entry;
}

function expectNoSemanticScalars(record: Record<string, unknown>): void {
  for (const key of Object.keys(record)) {
    expect(FORBIDDEN_SEMANTICS.test(key)).toBe(false);
  }
}

describe("REAL_COUNTERPART_FEEDBACK_INGESTION_V0 — factual evidence semantics", () => {
  it("A. helpful wording: delivery-bound factual outcome, no numeric reward", async () => {
    const recorder: TransportRecorder = { requests: [] };
    const runtime = await InteractiveSubjectRuntimeV0.create(options(recorder));
    const first = await runtime.submitUserText("Can you suggest a simple way to organize my desk?");
    const feedback = await runtime.submitUserText("That fixed it, thanks.");

    expect(feedback.completed_prior_outcome).not.toBeNull();
    expect(feedback.observational_experience_ref).toBeNull();

    const snapshot = await runtime.snapshot();
    const records = feedbackRecordsOf(snapshot);
    expect(records).toHaveLength(1);
    const { experience, episode } = feedbackAt(records, 0);
    const behavior = experience["behavior_artifact"] as { readonly text: string };
    expect(behavior.text).toBe(first.subject_text);
    expect((experience["outcome"] as { readonly text: string }).text).toBe("That fixed it, thanks.");
    expect((experience["outcome"] as { readonly outcome_kind: string }).outcome_kind).toBe("CONVERSATION_REPLY");
    const deliveryId = experience["behavior_delivery_id"] as string;
    const delivery = deliveriesOf(snapshot).find((entry) => entry["delivery_id"] === deliveryId);
    expect(delivery).toBeDefined();
    expect(delivery?.["status"]).toBe("DELIVERED");
    expect(experience["delivered_logical_time"] as number).toBeLessThanOrEqual(experience["outcome_logical_time"] as number);
    expect((episode["provenance"] as { cause_refs: readonly string[] }).cause_refs).toContain(experience["experience_ref"]);
    expectNoSemanticScalars(experience);
    expectNoSemanticScalars(experience["outcome"] as Record<string, unknown>);
    expect(JSON.stringify(experience)).not.toMatch(FORBIDDEN_SEMANTICS);
  });

  it("B. unhelpful wording: same factual preservation, no punishment scalar", async () => {
    const runtime = await InteractiveSubjectRuntimeV0.create(options({ requests: [] }));
    await runtime.submitUserText("How should I organize my desk?");
    const feedback = await runtime.submitUserText("That didn't solve it.");
    expect(feedback.completed_prior_outcome).not.toBeNull();
    const records = feedbackRecordsOf(await runtime.snapshot());
    expect(records).toHaveLength(1);
    expect((feedbackAt(records, 0).experience["outcome"] as { readonly text: string }).text).toBe("That didn't solve it.");
    expect(JSON.stringify(feedbackAt(records, 0).experience)).not.toMatch(FORBIDDEN_SEMANTICS);
  });

  it("C. correction is new factual evidence and never rewrites historical Memory", async () => {
    const runtime = await InteractiveSubjectRuntimeV0.create(options({ requests: [] }));
    await runtime.submitUserText("Which notebook should I use?");
    await runtime.submitUserText("No, I meant the blue one.");
    const firstSnapshot = await runtime.snapshot();
    const firstFeedback = feedbackAt(feedbackRecordsOf(firstSnapshot), 0).experience;
    const firstRef = firstFeedback["experience_ref"] as string;

    await runtime.submitUserText("Got it, that works.");
    const later = feedbackRecordsOf(await runtime.snapshot());
    expect(later).toHaveLength(2);
    expect((feedbackAt(later, 0).experience["outcome"] as { readonly text: string }).text).toBe("No, I meant the blue one.");
    expect((feedbackAt(later, 1).experience["outcome"] as { readonly text: string }).text).toBe("Got it, that works.");
    // The earlier experience payload is unchanged (immutable durable history).
    const unchanged = later.find((entry) => entry.experience["experience_ref"] === firstRef)?.experience;
    expect(unchanged).toEqual(firstFeedback);
  });

  it("D. no prior delivered behavior ⇒ no fabricated BehaviorOutcome Experience", async () => {
    const runtime = await InteractiveSubjectRuntimeV0.create(options({ requests: [] }));
    const first = await runtime.submitUserText("That was helpful.");
    expect(first.completed_prior_outcome).toBeNull();
    expect(first.observational_experience_ref).toMatch(/^episode:/);
    const payloads = payloadsOf(await runtime.snapshot());
    expect(payloads.filter((entry) => entry.payload["schema_version"] === "experience-record-v0")).toHaveLength(0);
  });

  it("E. exactly one durable episode per linked user reply (no double role)", async () => {
    const runtime = await InteractiveSubjectRuntimeV0.create(options({ requests: [] }));
    await runtime.submitUserText("Suggest an approach.");
    await runtime.submitUserText("That fixed it, thanks.");
    const payloads = payloadsOf(await runtime.snapshot());
    expect(payloads.filter((entry) => entry.ref.startsWith("episode:"))).toHaveLength(2);
    expect(payloads.filter((entry) => entry.payload["schema_version"] === "experience-record-v0")).toHaveLength(1);
  });

  it("F. same-turn isolation: the current reply is not retrieved as its own past Memory", async () => {
    const recorder: TransportRecorder = { requests: [] };
    const runtime = await InteractiveSubjectRuntimeV0.create(options(recorder));
    await runtime.submitUserText("How should I organize my desk?");
    const feedbackTurn = await runtime.submitUserText("That fixed it, thanks.");
    expect(feedbackTurn.provider_memory_section_present).toBe(true); // prior observational episode, not this reply
    const turn2Prompt = recorder.requests[1]?.messages[1]?.content ?? "";
    expect(turn2Prompt).not.toContain("delivered_behavior_text");
    expect(turn2Prompt).not.toContain("outcome_reply_text");

    const next = await runtime.submitUserText("Anything else I should try?");
    expect(next.provider_memory_section_present).toBe(true);
  });

  it("G. restart: retrieval exposes the delivered behavior + exact user response", async () => {
    const runtimeA = await InteractiveSubjectRuntimeV0.create(options({ requests: [] }));
    const first = await runtimeA.submitUserText("Can you suggest a simple way to organize my desk?");
    await runtimeA.submitUserText("That was helpful; keeping only today's items on the desk works for me.");
    const serialized = JSON.parse(JSON.stringify(await runtimeA.snapshot())) as InteractiveSubjectSnapshotV0;

    const recorderB: TransportRecorder = { requests: [] };
    const runtimeB = await InteractiveSubjectRuntimeV0.restore(options(recorderB), serialized);
    const turn = await runtimeB.submitUserText("I'm about to tidy up — anything to keep in mind?");
    expect(turn.status).toBe("COMPLETE");
    expect(turn.provider_memory_section_present).toBe(true);
    const prompt = recorderB.requests[0]?.messages[1]?.content ?? "";
    expect(prompt).toContain("delivered_behavior_text:");
    expect(prompt).toContain(first.subject_text);
    expect(prompt).toContain("outcome_reply_text:");
    expect(prompt).toContain("That was helpful; keeping only today's items on the desk works for me.");
  });

  it("H. domain isolation: no host-facing mutators for Affect/Belief/Relationship/Personality", () => {
    const surface = new Set<string>();
    let proto: object | null = Object.getPrototypeOf(InteractiveSubjectRuntimeV0) as object | null;
    while (proto !== null && proto !== Object.prototype && proto !== Function.prototype) {
      for (const name of Object.getOwnPropertyNames(proto)) surface.add(name);
      proto = Object.getPrototypeOf(proto) as object | null;
    }
    for (const name of surface) {
      expect(/set(belief|relationship|affect|personality|mood)|reward|sentiment/i.test(name)).toBe(false);
    }
  });
});
