/**
 * CORE_INTEGRITY_AUDIT_V0 regression — lawful appraisal abstention must not
 * crash mandatory lifecycle work.
 *
 * A provider that lawfully abstains (INSUFFICIENT_CONTEXT) is TERMINAL for the
 * INITIAL appraisal: no record dimensions, no Affect eligibility, cognition
 * proceeds (documented abstention contract). The pre-cognition path already
 * accepts this; the post-cognition pending lifecycle work must treat the
 * resulting AffectApplication NOT_ELIGIBLE as the same terminal no-Affect
 * outcome instead of throwing.
 */

import { describe, expect, it } from "vitest";

import { type SubjectStateV0 } from "@characteros-next/subject-core";
import type { FactualEventAppraisalProviderV0 } from "@characteros-next/appraisal";
import type { ModelTransportRequestV0, ModelTransportResponseV0, ModelTransportV0 } from "../transports/model-transport.js";
import { InteractiveSubjectRuntimeV0, createInteractiveSubjectSeedV0 } from "./interactive-subject-runtime-v0.js";

const SUBJECT_ID = "abstention-subject";

function abstainingProvider(): FactualEventAppraisalProviderV0 {
  return {
    proposeFactualEventAppraisal: async (context: never) => {
      const ctx = context as unknown as {
        subject_id: string;
        factual_event_ref: string;
        context_projection_hash: string;
      };
      return {
        schema_version: "factual-event-appraisal-proposal-v0",
        status: "INSUFFICIENT_CONTEXT",
        subject_id: ctx.subject_id,
        factual_event_ref: ctx.factual_event_ref,
        context_projection_hash: ctx.context_projection_hash,
        missing_inputs: ["CURRENT_TASK"]
      };
    }
  } as unknown as FactualEventAppraisalProviderV0;
}

const cognitionTransport: ModelTransportV0 = {
  complete: async (request: ModelTransportRequestV0): Promise<ModelTransportResponseV0> => {
    const user = request.messages.find((message) => message.role === "user")?.content ?? "";
    const projectionHash = /\[projection_hash\]\s+(\S+)/.exec(user)?.[1] ?? "";
    return {
      content: JSON.stringify({
        schema_version: "conversation-cognition-proposal-v1",
        cognition: {
          schema_version: "cognition-proposal-v0",
          projection_hash: projectionHash,
          reasoning_summary: "abstention regression",
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

const languageTransport = {
  complete: async (): Promise<ModelTransportResponseV0> => ({ content: "{}", model: "fake" }) as ModelTransportResponseV0
} as ModelTransportV0;

function options() {
  return {
    session_id: "sess-abstention",
    subject: { subject_id: SUBJECT_ID, display_name: "", identity_anchors: [] },
    v3_source: createInteractiveSubjectSeedV0(SUBJECT_ID) as SubjectStateV0,
    conversationCognitionTransport: cognitionTransport,
    languageTransport,
    factualEventAppraisalProvider: abstainingProvider(),
    interval_ticks: 1,
    provider_identity: { model: "fake", num_predict: 2048 },
    clock: () => "2026-01-01T00:00:00.000Z"
  };
}

describe("appraisal abstention lifecycle", () => {
  it("a lawfully abstained event completes the turn instead of throwing in pending lifecycle work", async () => {
    const runtime = await InteractiveSubjectRuntimeV0.create(options());
    const outcome = await runtime.submitUserText("An event the appraisal provider cannot appraise.");
    expect(outcome.status).toBe("COMPLETE");
    expect(outcome.failure).toBeNull();
    // Abstention means no Affect delta was applied for this event.
    expect(outcome.affect_before).toBe(0);
    expect(outcome.affect_after).toBe(0);
  });

  it("a second abstained turn also completes (durable disposition is terminal, not fatal)", async () => {
    const runtime = await InteractiveSubjectRuntimeV0.create(options());
    expect((await runtime.submitUserText("first unappraisable event")).status).toBe("COMPLETE");
    expect((await runtime.submitUserText("second unappraisable event")).status).toBe("COMPLETE");
  });
});
