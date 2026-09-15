/**
 * CORE_INTEGRITY_AUDIT_V0 regression — a stale/rolled-back store must not be
 * accepted on restore.
 *
 * The checkpoint's durable identity records the authoritative head. Supplying a
 * newer durable state together with an OLDER store image is a silent canonical
 * rollback; restore must fail closed instead of returning an earlier revision.
 */

import { describe, expect, it } from "vitest";

import { type SubjectStateV0 } from "@characteros-next/subject-core";
import type { FactualEventAppraisalProviderV0 } from "@characteros-next/appraisal";
import type { ModelTransportRequestV0, ModelTransportResponseV0, ModelTransportV0 } from "../transports/model-transport.js";
import { InteractiveSubjectRuntimeV0, createInteractiveSubjectSeedV0 } from "./interactive-subject-runtime-v0.js";

const SUBJECT_ID = "rollback-subject";

/**
 * C4.4: the model selects advertised items by handle. This fixture resolves the
 * handle the prompt advertised for a canonical ref (FACTUAL SOURCE HANDLES /
 * CONTEXT HANDLES blocks), exactly as the host maps them.
 */
function handleForAdvertisedRef(userContent: string, ref: string): string {
  for (const line of userContent.split("\n")) {
    const match = /^-\s*([FC][0-9]+):\s*(\S+)\s*$/.exec(line.trim());
    if (match === null || match[2] !== ref) continue;
    const handle = match[1];
    if (handle !== undefined) return handle;
  }
  throw new Error(`no advertised handle for ${ref}`);
}

function appraisal(): FactualEventAppraisalProviderV0 {
  return {
    proposeFactualEventAppraisal: async (context: never) => {
      const ctx = context as unknown as { subject_id: string; factual_event_ref: string; context_projection_hash: string };
      return {
        schema_version: "factual-event-appraisal-proposal-v0",
        status: "APPRAISED",
        subject_id: ctx.subject_id,
        factual_event_ref: ctx.factual_event_ref,
        context_projection_hash: ctx.context_projection_hash,
        dimensions: { relevance: 0.6, goal_congruence: 0.6, attribution: "other", controllability: 0.5, uncertainty: 0.3, intensity: 0.5 },
        assessment_confidence: 0.8,
        evidence_refs: [ctx.factual_event_ref].sort()
      };
    }
  } as unknown as FactualEventAppraisalProviderV0;
}

const cognitionTransport: ModelTransportV0 = {
  complete: async (request: ModelTransportRequestV0): Promise<ModelTransportResponseV0> => {
    const user = request.messages.find((message) => message.role === "user")?.content ?? "";
    const observationRef = /^\[current observation\] (\S+)$/m.exec(user)?.[1] ?? "";
    return {
      content: JSON.stringify({
        response_semantics: { kind: "PRIMARY_CLARIFICATION" },
        schema_version: "conversation-cognition-proposal-v8",
          subjective_selection: { kind: "NO_SUBJECTIVE_SELECTION" },
        factual_assessment: { claims: [] },
        cognition: { schema_version: "cognition-proposal-v0",  reasoning_summary: "x", relevant_memory_handles: [], considered_handles: [handleForAdvertisedRef(user, observationRef)], current_intent: "respond", confidence: 0.7, uncertainty: 0.3, action_intent: null, evidence_handles: [] },
        communication_directive: { kind: "CLARIFY_MISSING_CONTEXT" }
      , clarification_basis: String("CLARIFY_MISSING_CONTEXT") === "CLARIFY_MISSING_CONTEXT" ? { current_observation_ref: (/^\[current observation\] (\S+)$/m.exec(user)?.[1] ?? ""), missing_information: "the specific unresolved detail", needed_for: "completing the current response" } : null }),
      model: "fake"
    } as ModelTransportResponseV0;
  }
} as ModelTransportV0;

const languageTransport = { complete: async (): Promise<ModelTransportResponseV0> => ({ content: "{}", model: "fake" }) as ModelTransportResponseV0 } as ModelTransportV0;

function options() {
  return {
    session_id: "sess-rollback",
    subject: { subject_id: SUBJECT_ID, display_name: "", identity_anchors: [] },
    v3_source: createInteractiveSubjectSeedV0(SUBJECT_ID) as SubjectStateV0,
    conversationCognitionTransport: cognitionTransport,
    languageTransport,
    factualEventAppraisalProvider: appraisal(),
    interval_ticks: 1,
    provider_identity: { model: "fake", num_predict: 2048 },
    clock: () => "2026-01-01T00:00:00.000Z"
  };
}

describe("restore rollback rejection", () => {
  it("accepts a faithful store and rejects a rolled-back store", async () => {
    const runtime = await InteractiveSubjectRuntimeV0.create(options());
    await runtime.submitUserText("first event");
    const older = await runtime.snapshot();
    await runtime.submitUserText("second event");
    const newer = await runtime.snapshot();
    expect(newer.durable.identity.state_revision).toBeGreaterThan(older.durable.identity.state_revision);

    // Faithful restore: durable and store from the same capture.
    const faithful = await InteractiveSubjectRuntimeV0.restore(options(), JSON.parse(JSON.stringify(newer)));
    expect((await faithful.status()).state_revision).toBe(newer.durable.identity.state_revision);

    // Rollback: newer durable + older store must fail closed.
    await expect(
      InteractiveSubjectRuntimeV0.restore(options(), { ...JSON.parse(JSON.stringify(newer)), store: older.store })
    ).rejects.toThrow(/does not match checkpoint identity/);
  });
});
