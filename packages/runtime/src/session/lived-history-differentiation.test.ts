/**
 * PERSISTENT_SUBJECT_LIVED_HISTORY_BEHAVIOR_DIFFERENTIATION_V0 — offline causal proof.
 *
 * Two controlled counterfactual histories of the SAME initial subject condition
 * (same genesis, identity, model/config, task structure) are grown with
 * different lived events, persisted, and authoritatively restored into fresh
 * runtimes. Under the SAME common current event, the test proves:
 *
 *   Level 1: the histories persist and remain different after restart;
 *   Level 2: the persistent difference reaches cognition (different request);
 *   Level 4: at least one NON-Memory persistent state (canonical Affect)
 *            contributes to that request difference.
 *
 * Providers are deterministic fakes (no Ollama); this proves the ARCHITECTURE
 * transmits history into cognition, not real semantic intelligence.
 */

import { describe, expect, it } from "vitest";

import { sha256HashV1, type SubjectStateV0 } from "@characteros-next/subject-core";
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
const COMMON_EVENT = "I'm considering using that kind of approach again. What do you think I should do?";

interface TransportRecorder {
  readonly requests: { readonly messages: readonly { readonly role: string; readonly content: string }[] }[];
}

/** TEST-ONLY content-sensitive producer: maps event semantics to dimensions. */
function contentSensitiveTestProvider(): FactualEventAppraisalProviderV0 {
  return {
    proposeFactualEventAppraisal: async (context: never) => {
      const ctx = context as unknown as FactualEventAppraisalContextProjectionV0;
      const scene = ctx.current_observable_scene.toLowerCase();
      const incongruent = /worse|didn't work|don't|stop|problem|harder/.test(scene);
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

function options(recorder: TransportRecorder) {
  return {
    session_id: "sess-lived-history",
    subject: { subject_id: SUBJECT_ID, display_name: "", identity_anchors: [] },
    v3_source: createInteractiveSubjectSeedV0(SUBJECT_ID) as SubjectStateV0,
    conversationCognitionTransport: cognitionTransport(recorder),
    languageTransport,
    factualEventAppraisalProvider: contentSensitiveTestProvider(),
    interval_ticks: 1,
    provider_identity: { model: "fake", num_predict: 2048 },
    clock: () => "2026-01-01T00:00:00.000Z"
  };
}

interface Branch {
  readonly runtime: InteractiveSubjectRuntimeV0;
  readonly recorder: TransportRecorder;
  readonly snapshot: InteractiveSubjectSnapshotV0;
}

async function growHistory(history: readonly string[]): Promise<Branch> {
  const recorder: TransportRecorder = { requests: [] };
  const runtime = await InteractiveSubjectRuntimeV0.create(options(recorder));
  for (const message of history) {
    const outcome = await runtime.submitUserText(message);
    expect(outcome.status).toBe("COMPLETE");
  }
  const snapshot = JSON.parse(JSON.stringify(await runtime.snapshot())) as InteractiveSubjectSnapshotV0;
  return { runtime, recorder, snapshot };
}

async function restoreFresh(snapshot: InteractiveSubjectSnapshotV0): Promise<Branch> {
  const recorder: TransportRecorder = { requests: [] };
  const runtime = await InteractiveSubjectRuntimeV0.restore(options(recorder), snapshot);
  return { runtime, recorder, snapshot };
}

function lastUserContent(recorder: TransportRecorder): string {
  const last = recorder.requests.at(-1);
  return last?.messages.find((message) => message.role === "user")?.content ?? "";
}

function affectLine(prompt: string): string {
  return /\[affect \(canonical\)\][^\n]*/.exec(prompt)?.[0] ?? "(no affect line)";
}

function memorySection(prompt: string): string {
  const start = prompt.indexOf("[PRIOR FACTUAL MEMORY");
  if (start < 0) return "(no memory section)";
  const end = prompt.indexOf("[END HISTORICAL FACTUAL CONTENT]", start);
  return end < 0 ? prompt.slice(start) : prompt.slice(start, end);
}

const HISTORY_A = Object.freeze([
  "That worked exactly as I hoped. Thank you.",
  "That approach was useful again and helped me finish."
]);
const HISTORY_B = Object.freeze([
  "That made the situation worse.",
  "Please don't do that again; it caused a problem."
]);

describe("PERSISTENT_SUBJECT_LIVED_HISTORY_BEHAVIOR_DIFFERENTIATION_V0 — offline causal proof", () => {
  it("Level 1: different histories persist and stay different after authoritative restore", async () => {
    const branchA = await growHistory(HISTORY_A);
    const branchB = await growHistory(HISTORY_B);

    // Same initial condition: same identity and same transition/revision SHAPE.
    expect(branchA.snapshot.subject_id).toBe(branchB.snapshot.subject_id);
    expect(branchA.snapshot.durable.identity.state_revision).toBe(branchB.snapshot.durable.identity.state_revision);
    // Persisted CONTENT differs (content-addressed state hash).
    expect(branchA.snapshot.durable.identity.subject_state_hash).not.toBe(
      branchB.snapshot.durable.identity.subject_state_hash
    );

    const restoredA = await restoreFresh(branchA.snapshot);
    const restoredB = await restoreFresh(branchB.snapshot);
    const statusA = await restoredA.runtime.status();
    const statusB = await restoredB.runtime.status();

    expect(statusA.origin).toBe("SUBJECT_RESTORED");
    expect(statusB.origin).toBe("SUBJECT_RESTORED");
    expect(statusA.repository_revision).toBe(branchA.snapshot.durable.identity.repository_revision);
    expect(statusB.repository_revision).toBe(branchB.snapshot.durable.identity.repository_revision);

    // Persistent canonical Affect differs after restore.
    expect(statusA.affect.valence).not.toBe(statusB.affect.valence);

    // Cross-branch isolation by CONTENT: distinctive lived wording never crosses.
    // (Episode/experience refs are lineage-addressed, so two counterfactual copies
    // with identical structural ids may share a ref; the durable payload differs.)
    const payloadsA = JSON.stringify(branchA.snapshot.store.revisions);
    const payloadsB = JSON.stringify(branchB.snapshot.store.revisions);
    expect(payloadsA).toContain("hoped");
    expect(payloadsA).not.toContain("worse");
    expect(payloadsB).toContain("worse");
    expect(payloadsB).not.toContain("hoped");
  });

  it("Level 2 + Level 4: the restored difference reaches cognition, including non-Memory Affect", async () => {
    const branchA = await restoreFresh((await growHistory(HISTORY_A)).snapshot);
    const branchB = await restoreFresh((await growHistory(HISTORY_B)).snapshot);

    const affectBeforeA = (await branchA.runtime.status()).affect;
    const affectBeforeB = (await branchB.runtime.status()).affect;
    expect(affectBeforeA.valence).not.toBe(affectBeforeB.valence);

    await branchA.runtime.submitUserText(COMMON_EVENT);
    await branchB.runtime.submitUserText(COMMON_EVENT);
    const promptA = lastUserContent(branchA.recorder);
    const promptB = lastUserContent(branchB.recorder);

    // Same current event bytes.
    expect(promptA).toContain(COMMON_EVENT);
    expect(promptB).toContain(COMMON_EVENT);

    // Level 2: the cognition request differs because of persistent history.
    expect(promptA).not.toBe(promptB);
    expect(await sha256HashV1(promptA)).not.toBe(await sha256HashV1(promptB));

    // Level 4: the canonical Affect line itself differs (non-Memory contribution).
    const affectA = affectLine(promptA);
    const affectB = affectLine(promptB);
    expect(affectA).toMatch(/^\[affect \(canonical\)\] valence=/);
    expect(affectA).not.toBe(affectB);

    // Memory evidence also differs (the other lawful history source).
    expect(memorySection(promptA)).not.toBe(memorySection(promptB));

    // The static/system and identity parts are identical.
    expect(promptA.split("\n")[0]).toBe(promptB.split("\n")[0]);
    expect(promptA).toContain(`[identity] subject_id="${SUBJECT_ID}"`);
    expect(promptB).toContain(`[identity] subject_id="${SUBJECT_ID}"`);
  });

  it("same-history control: two identical histories produce identical cognition requests", async () => {
    const branchA1 = await restoreFresh((await growHistory(HISTORY_A)).snapshot);
    const branchA2 = await restoreFresh((await growHistory(HISTORY_A)).snapshot);
    await branchA1.runtime.submitUserText(COMMON_EVENT);
    await branchA2.runtime.submitUserText(COMMON_EVENT);
    expect(lastUserContent(branchA1.recorder)).toBe(lastUserContent(branchA2.recorder));
  });

  it("no transcript bypass, no branch label, no manual memory/intent injection", async () => {
    const branchA = await restoreFresh((await growHistory(HISTORY_A)).snapshot);
    const branchB = await restoreFresh((await growHistory(HISTORY_B)).snapshot);
    await branchA.runtime.submitUserText(COMMON_EVENT);
    await branchB.runtime.submitUserText(COMMON_EVENT);
    for (const branch of [branchA, branchB]) {
      const request = branch.recorder.requests.at(-1);
      expect(request?.messages).toHaveLength(2);
      const prompt = request?.messages[1]?.content ?? "";
      expect(prompt).not.toMatch(/HISTORY_A|HISTORY_B/);
      expect(prompt).not.toContain("[CONVERSATION HISTORY]");
      expect(prompt).not.toContain("[TRANSCRIPT]");
    }
  });
});
