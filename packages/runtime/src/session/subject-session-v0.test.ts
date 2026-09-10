/**
 * LONG_HORIZON_AUTONOMOUS_SUBJECT_SESSION_V0 — deterministic session orchestrator
 * acceptance suite (§51). Fully OFFLINE: fake transports, fake appraisal
 * provider, deterministic environment. Zero real model calls.
 */

import { describe, expect, it } from "vitest";

import { s0 } from "../transitions/observation/observation-fixtures.js";
import type { SubjectStateV0 } from "@characteros-next/subject-core";
import type { FactualEventAppraisalProviderV0 } from "@characteros-next/appraisal";
import type {
  ModelTransportRequestV0,
  ModelTransportResponseV0,
  ModelTransportV0
} from "../transports/model-transport.js";
import type {
  EnvironmentConsequenceV0,
  EnvironmentInteractionV0,
  EnvironmentObservationInputV0,
  EnvironmentStateV0,
  SubjectEnvironmentV0
} from "./session-contracts-v0.js";
import { createLongHorizonSubjectSessionV0, type LongHorizonSubjectSessionOptionsV0 } from "./subject-session-v0.js";

const SUBJECT_ID = "subject-s0";

/** Deterministic bounded environment with explicit external state only. */
class TestEnvironment implements SubjectEnvironmentV0 {
  readonly environment_id = "test-review-environment-v0";
  readonly interaction_count = 4;
  private state = { exchange_count: 0, decision: null as string | null };

  nextInteraction(index: number): EnvironmentInteractionV0 {
    const scenes = [
      "Alice asks how the review document should be organized.",
      "Alice asks for the current status of the review document.",
      "Alice asks whether the outstanding checklist item can be closed.",
      "Alice asks for a final confirmation before the review."
    ];
    return { interaction_id: `t${index}`, scene: scenes[index] ?? `scene ${index}`, task: "respond to Alice" };
  }

  observeBehavior(input: EnvironmentObservationInputV0): EnvironmentConsequenceV0 {
    const asks = input.delivered_behavior_text.includes("?");
    this.state = {
      exchange_count: this.state.exchange_count + 1,
      decision: asks ? this.state.decision : input.delivered_behavior_text.slice(0, 60)
    };
    const reply = asks
      ? "Sure — I have noted the open item on the shared checklist."
      : "Thanks — I have recorded that on the shared checklist.";
    return { reply_text: reply, state: this.exportState() };
  }

  exportState(): EnvironmentStateV0 {
    const payload = { ...this.state } as Record<string, unknown>;
    return { schema_version: "subject-environment-state-v0", state_hash: `hash:${JSON.stringify(payload)}`, payload };
  }

  restoreState(state: EnvironmentStateV0): void {
    this.state = { exchange_count: Number(state.payload["exchange_count"] ?? 0), decision: (state.payload["decision"] as string | null) ?? null };
  }

  stateHash(): string {
    return this.exportState().state_hash;
  }
}

/** Fake appraisal provider: always a terminal APPRAISED disposition. */
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
          relevance: 0.7,
          goal_congruence: 0.6,
          attribution: "other",
          controllability: 0.5,
          uncertainty: 0.4,
          intensity: 0.5
        },
        assessment_confidence: 0.8,
        evidence_refs: [ctx.factual_event_ref].sort()
      };
    }
  } as unknown as FactualEventAppraisalProviderV0;
}

type Mode = "CLARIFY" | "REALIZE" | "FAIL";

/** Fake conversation-cognition transport: echoes the projection hash it was given. */
function fakeCognitionTransport(mode: () => Mode, intents: string[]): ModelTransportV0 {
  let call = 0;
  return {
    complete: async (request: ModelTransportRequestV0): Promise<ModelTransportResponseV0> => {
      const user = request.messages.find((message) => message.role === "user")?.content ?? "";
      const projectionHash = /\[projection_hash\]\s+(\S+)/.exec(user)?.[1] ?? "";
      const selected = mode();
      if (selected === "FAIL") {
        return { content: "{ not json", model: "fake" } as ModelTransportResponseV0;
      }
      const intent = intents[Math.min(call, intents.length - 1)] ?? "respond to Alice";
      call += 1;
      return {
        content: JSON.stringify({
          schema_version: "conversation-cognition-proposal-v1",
          cognition: {
            schema_version: "cognition-proposal-v0",
            projection_hash: projectionHash,
            reasoning_summary: "offline test cognition",
            relevant_memory_refs: [],
            considered_context_refs: [],
            current_intent: intent,
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

/** Fake language transport: echoes the input hash from the rendered input. */
function fakeLanguageTransport(): ModelTransportV0 {
  return {
    complete: async (request: ModelTransportRequestV0): Promise<ModelTransportResponseV0> => {
      const user = request.messages.find((message) => message.role === "user")?.content ?? "";
      const inputHash = /input_hash:\s*(sha256:[0-9a-f]+)/.exec(user)?.[1] ?? "";
      return {
        content: JSON.stringify({
          schema_version: "language-realization-draft-v0",
          input_hash: inputHash,
          text: "Yes, the review document is on track and the outstanding item is noted.",
          evidence_refs: []
        }),
        model: "fake"
      } as ModelTransportResponseV0;
    }
  } as ModelTransportV0;
}

function sessionOptions(input: {
  mode?: () => Mode;
  intents?: string[];
  environment?: SubjectEnvironmentV0;
} = {}): LongHorizonSubjectSessionOptionsV0 {
  const mode = input.mode ?? (() => "CLARIFY" as Mode);
  return {
    session_id: "sess-test-1",
    subject: { subject_id: SUBJECT_ID, display_name: "", identity_anchors: [] },
    v3_source: s0() as unknown as SubjectStateV0,
    conversationCognitionTransport: fakeCognitionTransport(mode, input.intents ?? ["respond to Alice"]),
    languageTransport: fakeLanguageTransport(),
    factualEventAppraisalProvider: fakeAppraisalProvider(),
    environment: input.environment ?? new TestEnvironment(),
    interaction_interval_ticks: 300,
    provider_identity: { model: "fake", num_predict: 2048 },
    clock: () => "2026-01-01T00:00:00.000Z"
  };
}

describe("LONG_HORIZON_AUTONOMOUS_SUBJECT_SESSION_V0 — orchestrator (offline)", () => {
  it("§51.1 one interaction automatically sequences end to end and commits Experience/Memory", async () => {
    const session = await createLongHorizonSubjectSessionV0(sessionOptions());
    const outcome = await session.processInteraction();
    expect(outcome.status).toBe("COMPLETE");
    expect(outcome.behavior_text.length).toBeGreaterThan(0);
    expect(outcome.counterpart_reply.length).toBeGreaterThan(0);
    // §51.3 lawful Experience/Memory commit.
    expect(outcome.experience_ref).not.toBeNull();
    expect(outcome.episode_ref).not.toBeNull();
    expect(outcome.memory_event_ref).not.toBeNull();
    expect(outcome.repository_revision_after).not.toBe(outcome.repository_revision_before);
    // §51.4 index advanced exactly once, after completion.
    expect(outcome.interaction_index).toBe(0);
    const status = await session.status();
    expect(status.interaction_index).toBe(1);
    expect(status.completed_interactions).toBe(1);
  });

  it("§51.2 mandatory pending lifecycle work cannot be skipped", async () => {
    const session = await createLongHorizonSubjectSessionV0(sessionOptions());
    const outcome = await session.processInteraction();
    // Both the primary event and the counterpart reply reached a terminal
    // disposition: the queue is empty and both appraisal refs exist.
    expect(session.pendingWork()).toHaveLength(0);
    expect(outcome.appraisal_ref).toBeTruthy();
    expect(outcome.reply_appraisal_ref).toBeTruthy();
  });

  it("§51.5 a partial failure does not claim step completion and does not advance the index", async () => {
    const session = await createLongHorizonSubjectSessionV0(sessionOptions({ mode: () => "FAIL" }));
    const outcome = await session.processInteraction();
    expect(outcome.status).toBe("FAILED");
    expect(outcome.failure).toContain("PARTIAL_INTERACTION_REQUIRES_OPERATOR_RECOVERY");
    expect(outcome.experience_ref).toBeNull();
    const status = await session.status();
    expect(status.interaction_index).toBe(0);
    expect(status.completed_interactions).toBe(0);
  });

  it("§51.6/§51.7 checkpoint captures operational state and restore rebuilds a fresh valid runtime", async () => {
    const environment = new TestEnvironment();
    const session = await createLongHorizonSubjectSessionV0(sessionOptions({ environment }));
    await session.processInteraction();
    await session.processInteraction();
    const checkpoint = await session.checkpoint();
    expect(checkpoint.next_interaction_index).toBe(2);
    expect(checkpoint.durable.identity.repository_revision).toBeTruthy();
    expect(checkpoint.environment_state.state_hash).toBe(environment.stateHash());

    const restore = await session.restore(checkpoint);
    expect(restore.kind).toBe("RESTORED");
    expect(["EXACT", "EXPECTED_RECONSTRUCTED_IDENTITY"]).toContain(restore.identity_classification);
    expect(restore.next_interaction_index).toBe(2);
    expect(restore.post.repository_revision).toBe(checkpoint.durable.identity.repository_revision);
    expect(restore.environment_state_hash_post).toBe(checkpoint.environment_state.state_hash);
    const status = await session.status();
    expect(status.interaction_index).toBe(2);
    expect(status.restore_generation).toBe(1);
  });

  it("§51.8 Memory retrieval still works after restore", async () => {
    const session = await createLongHorizonSubjectSessionV0(sessionOptions());
    await session.processInteraction();
    await session.processInteraction();
    const checkpoint = await session.checkpoint();
    await session.restore(checkpoint);
    const outcome = await session.processInteraction();
    expect(outcome.status).toBe("COMPLETE");
    // The restored life is retrievable: prior episodes surface as working refs.
    expect(outcome.working_episode_refs.length).toBeGreaterThan(0);
    expect(outcome.provider_memory_section_present).toBe(true);
  });

  it("§51.9 environment state restores independently from subject state", async () => {
    const environment = new TestEnvironment();
    const session = await createLongHorizonSubjectSessionV0(sessionOptions({ environment }));
    await session.processInteraction();
    const checkpoint = await session.checkpoint();
    // Mutate the live environment AFTER the checkpoint: restore must overwrite it.
    environment.observeBehavior({ interaction_index: 0, interaction_id: "local", delivered_behavior_text: "local mutation" });
    expect(environment.stateHash()).not.toBe(checkpoint.environment_state.state_hash);
    await session.restore(checkpoint);
    expect(environment.stateHash()).toBe(checkpoint.environment_state.state_hash);
  });

  it("§51.10 status projection exposes no authority token or capability", async () => {
    const session = await createLongHorizonSubjectSessionV0(sessionOptions());
    await session.processInteraction();
    const status = (await session.status()) as unknown as Record<string, unknown>;
    const forbidden = /token|capability|issuer|ledger|manifest|repository_binding|receipt|secret|private/i;
    for (const key of Object.keys(status)) {
      expect(forbidden.test(key)).toBe(false);
    }
    // Only ids/hashes/values are exposed.
    expect(Object.keys(status).sort()).toEqual([
      "affect", "checkpoint_count", "completed_interactions", "environment_id",
      "interaction_count", "interaction_index", "last_checkpoint_ref",
      "last_restore_identity_classification", "latest_behavior", "latest_current_intent",
      "latest_directive", "latest_provider_request_identity_match",
      "latest_retrieved_memory_refs", "logical_time", "pending_lifecycle_work",
      "repository_revision", "restore_generation", "schema_version", "session_id",
      "state_revision", "subject_id", "subject_state_hash"
    ].sort());
  });

  it("§51.11 the session API cannot express manual Memory ref or intent injection", async () => {
    const session = await createLongHorizonSubjectSessionV0(sessionOptions());
    const surface = new Set<string>();
    let proto: object | null = Object.getPrototypeOf(session) as object | null;
    while (proto !== null && proto !== Object.prototype) {
      for (const name of Object.getOwnPropertyNames(proto)) surface.add(name);
      proto = Object.getPrototypeOf(proto) as object | null;
    }
    // The documented surface exists …
    for (const name of ["processInteraction", "checkpoint", "restore", "status", "ledger", "pendingWork", "restoreOutcomes"]) {
      expect(surface.has(name)).toBe(true);
    }
    // … and NO method can express injection of memory, intent, directive or behavior.
    for (const name of surface) {
      expect(/inject|patch|force|set_intent|setIntent|setMemory|manual|override/i.test(name)).toBe(false);
    }
    // No method accepts a memory ref, intent, directive or behavior.
    for (const name of ["processInteraction", "checkpoint", "status", "ledger"]) {
      const method = (session as unknown as Record<string, (...args: unknown[]) => unknown>)[name];
      const arity = method === undefined ? -1 : method.length;
      expect(arity).toBe(0);
    }
    // Only restore takes an argument, and it is a checkpoint (no refs).
    expect((session.restore as unknown as (...args: unknown[]) => unknown).length).toBe(1);
  });

  it("§51.12 a REALIZE interaction runs the real language path and cites the memory surface", async () => {
    const session = await createLongHorizonSubjectSessionV0(sessionOptions({
      mode: () => "REALIZE",
      intents: ["report the current status"]
    }));
    await session.processInteraction();
    const second = await session.processInteraction();
    expect(second.status).toBe("COMPLETE");
    expect(second.directive).toBe("REALIZE_CURRENT_INTENT");
    expect(second.language_call_required).toBe(true);
    expect(second.language_input_hash).toBeTruthy();
    expect(second.raw_language_response).not.toBeNull();
    // The provider request identity is reproduced from the actual messages.
    expect(second.provider_request_hash).toMatch(/^sha256:/);
  });
});
