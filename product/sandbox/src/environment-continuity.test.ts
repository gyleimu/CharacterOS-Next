/**
 * SUBJECT_ENVIRONMENT_PRODUCT_CONTINUITY_V0 — product acceptance.
 *
 * Offline (deterministic fake transports + deterministic appraisal): a real
 * product environment host runs the frozen long-horizon environment session so
 * that environment interactions become canonical Experience/Memory, subject AND
 * environment survive a destroy/reopen restart through ONE authoritative
 * checkpoint bundle, and later cognition observes the environment-originated
 * history through the normal Memory path.
 */

import { describe, expect, it } from "vitest";
import type {
  EnvironmentConsequenceV0,
  EnvironmentInteractionV0,
  EnvironmentObservationInputV0,
  EnvironmentStateV0,
  ModelTransportRequestV0,
  ModelTransportResponseV0,
  ModelTransportV0,
  SubjectEnvironmentV0
} from "@characteros-next/runtime";

import {
  EnvironmentSubjectHostV0,
  type EnvironmentSubjectHostConfigV0,
  type EnvironmentSubjectHostDepsV0
} from "./environment-subject-host.js";
import {
  CorruptEnvironmentCheckpointStoreV0,
  InMemoryEnvironmentCheckpointStoreV0
} from "./environment-checkpoint-store.js";
import { createConstantAppraisalProviderV0 } from "./product-appraisal-provider.js";

const SUBJECT_ID = "env-subject";
const SESSION_ID = "environment-env-subject";

function config(subjectId = SUBJECT_ID): EnvironmentSubjectHostConfigV0 {
  return {
    subject_id: subjectId,
    display_name: "Environment Subject",
    session_id: SESSION_ID,
    storage_root: "unused",
    interaction_interval_ticks: 1
  };
}

function cognitionTransport(recorder: { requests: string[] }): ModelTransportV0 {
  return {
    complete: async (request: ModelTransportRequestV0): Promise<ModelTransportResponseV0> => {
      const user = request.messages.find((message) => message.role === "user")?.content ?? "";
      recorder.requests.push(user);
      const projectionHash = /\[projection_hash\]\s+(\S+)/.exec(user)?.[1] ?? "";
      return {
        content: JSON.stringify({
          schema_version: "conversation-cognition-proposal-v1",
          cognition: {
            schema_version: "cognition-proposal-v0",
            projection_hash: projectionHash,
            reasoning_summary: "offline environment cognition",
            relevant_memory_refs: [],
            considered_context_refs: [],
            current_intent: "answer Alice's review question",
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
          text: "The review document is organized by decision, and the outstanding checklist item is noted as closed.",
          evidence_refs: []
        }),
        model: "fake"
      } as ModelTransportResponseV0;
    }
  } as ModelTransportV0;
}

function deps(
  store: InMemoryEnvironmentCheckpointStoreV0 | CorruptEnvironmentCheckpointStoreV0,
  recorder: { requests: string[] },
  environment?: SubjectEnvironmentV0
): EnvironmentSubjectHostDepsV0 {
  return {
    conversationCognitionTransport: cognitionTransport(recorder),
    languageTransport: languageTransport(),
    factualEventAppraisalProvider: createConstantAppraisalProviderV0(),
    checkpointStore: store,
    clock: () => "2026-01-01T00:00:00.000Z",
    ...(environment === undefined ? {} : { environment })
  };
}

/** A test-only bounded environment whose scenes can be shifted. */
class ShiftedEnvironmentV0 implements SubjectEnvironmentV0 {
  readonly environment_id = "shifted-environment-v0";
  readonly interaction_count: number;
  private state = { exchange_count: 0, last_decision: null as string | null };
  constructor(private readonly scenes: readonly string[]) {
    this.interaction_count = scenes.length;
  }
  nextInteraction(index: number): EnvironmentInteractionV0 {
    return { interaction_id: `shifted-${index}`, scene: this.scenes[index] ?? `scene ${index}`, task: "respond to Alice" };
  }
  observeBehavior(input: EnvironmentObservationInputV0): EnvironmentConsequenceV0 {
    this.state = {
      exchange_count: this.state.exchange_count + 1,
      last_decision: input.delivered_behavior_text.includes("?") ? this.state.last_decision : input.delivered_behavior_text.slice(0, 60)
    };
    return { reply_text: `Shifted acknowledgement ${this.state.exchange_count}.`, state: this.exportState() };
  }
  exportState(): EnvironmentStateV0 {
    const payload: Record<string, unknown> = { ...this.state };
    return { schema_version: "subject-environment-state-v0", state_hash: `hash:${JSON.stringify(payload)}`, payload };
  }
  restoreState(state: EnvironmentStateV0): void {
    this.state = {
      exchange_count: Number(state.payload["exchange_count"] ?? 0),
      last_decision: (state.payload["last_decision"] as string | null) ?? null
    };
  }
  stateHash(): string {
    return this.exportState().state_hash;
  }
}

function earlierEpisodeRefs(requests: string[]): string[] {
  const found = new Set<string>();
  for (const request of requests) {
    for (const match of request.matchAll(/episode:[0-9a-f]{16,}/g)) found.add(match[0]);
  }
  return [...found].sort();
}

describe("SUBJECT_ENVIRONMENT_PRODUCT_CONTINUITY_V0 — product environment continuity", () => {
  it("LEVEL 1+2: a real environment interaction becomes canonical Experience and persistent Memory", async () => {
    const store = new InMemoryEnvironmentCheckpointStoreV0();
    const recorder = { requests: [] as string[] };
    const host = await EnvironmentSubjectHostV0.open(config(), deps(store, recorder));
    expect(host.resolution()).toBe("NEW_ENVIRONMENT_SUBJECT");

    const first = await host.processNextInteraction();
    expect(first.status, JSON.stringify(first).slice(0, 300)).toBe("COMPLETE");
    expect(first.behavior_text.length).toBeGreaterThan(0);
    expect(first.counterpart_reply.length).toBeGreaterThan(0);
    // LEVEL 1 — canonical Observation/Experience committed through the product host.
    expect(first.factual_event_ref).not.toBeNull();
    expect(first.experience_ref).not.toBeNull();
    expect(first.episode_ref).not.toBeNull();
    expect(first.memory_event_ref).not.toBeNull();
    expect(first.repository_revision_after).not.toBe(first.repository_revision_before);

    // LEVEL 2 — the environment-originated experience is lawful persistent Memory:
    // it appears in the durable checkpoint's canonical identity AND the persisted
    // store image carries its immutable payload.
    const checkpoint = host.lastCheckpoint();
    expect(checkpoint.durable.identity.episode_refs).toContain(first.episode_ref as string);
    const loaded = await store.load();
    if (loaded.kind !== "DOCUMENT") throw new Error("expected a persisted checkpoint document");
    expect(loaded.document.store.committed_bundles.length).toBeGreaterThan(0);
    const persistedEpisodeRefs = loaded.document.store.revisions.flatMap((revision) =>
      revision.payloads.map((entry) => entry.ref)
    );
    expect(persistedEpisodeRefs).toContain(first.episode_ref as string);

    // Environment state advanced and is inspectable.
    expect(host.environmentState().payload["exchange_count"]).toBe(1);
  }, 60000);

  it("LEVEL 3: subject and environment both survive a destroy/reopen restart", async () => {
    const store = new InMemoryEnvironmentCheckpointStoreV0();
    const recorderA = { requests: [] as string[] };
    const hostA = await EnvironmentSubjectHostV0.open(config(), deps(store, recorderA));
    await hostA.processNextInteraction();
    await hostA.processNextInteraction();
    const statusBefore = await hostA.status();
    const envBefore = hostA.environmentState();
    expect(statusBefore.interaction_index).toBe(2);
    expect(envBefore.payload["exchange_count"]).toBe(2);

    // Destroy the host and reopen a FRESH one (new runtime) from the same store,
    // with a FRESH environment instance whose state must be overwritten.
    const recorderB = { requests: [] as string[] };
    const reopened = await EnvironmentSubjectHostV0.open(config(), deps(store, recorderB));
    expect(reopened.resolution()).toBe("ENVIRONMENT_SUBJECT_RESTORED");
    const statusAfter = await reopened.status();
    expect(statusAfter.interaction_index).toBe(2);
    expect(statusAfter.completed_interactions).toBe(2);
    expect(statusAfter.state_revision).toBe(statusBefore.state_revision);
    expect(statusAfter.repository_revision).toBe(statusBefore.repository_revision);
    expect(statusAfter.subject_state_hash).toBe(statusBefore.subject_state_hash);
    // Environment continuity: same external state (not reset to genesis).
    expect(reopened.environmentState().state_hash).toBe(envBefore.state_hash);
    expect(reopened.environmentState().payload["exchange_count"]).toBe(2);
  }, 60000);

  it("LEVEL 4: later cognition observes the environment-originated history through normal Memory", async () => {
    const store = new InMemoryEnvironmentCheckpointStoreV0();
    const recorder = { requests: [] as string[] };
    const host = await EnvironmentSubjectHostV0.open(config(), deps(store, recorder));
    await host.processNextInteraction();
    const third = await host.processNextInteraction();
    expect(third.status).toBe("COMPLETE");
    // Normal Memory path: the later cognition request carries earlier canonical
    // environment episodes and no special environment prompt block is added.
    const later = recorder.requests.at(-1) as string;
    expect(third.working_episode_refs.length).toBeGreaterThan(0);
    expect(third.provider_memory_section_present).toBe(true);
    expect(later).toContain("episode:");
    expect(later).not.toContain("[environment memory]");
    // At least one cited episode is one of the earlier environment experiences.
    const checkpoint = host.lastCheckpoint();
    const earlier = checkpoint.durable.identity.episode_refs.filter((ref) => ref !== third.episode_ref);
    expect(earlier.length).toBeGreaterThan(0);
    expect(earlier.some((ref) => later.includes(ref) || third.working_episode_refs.includes(ref))).toBe(true);
  }, 60000);

  it("LEVEL 5: the SAME later scene produces different cognition input because of earlier environment history", async () => {
    // Run A — two earlier environment interactions, then the third scene.
    const storeA = new InMemoryEnvironmentCheckpointStoreV0();
    const recorderA = { requests: [] as string[] };
    const hostA = await EnvironmentSubjectHostV0.open(config(), deps(storeA, recorderA));
    await hostA.processNextInteraction();
    await hostA.processNextInteraction();
    const third = await hostA.processNextInteraction();
    expect(third.status).toBe("COMPLETE");
    const requestA = recorderA.requests.at(-1) as string;
    const sceneA = third.scene;

    // Run B — the SAME current scene as its FIRST interaction, no earlier history.
    const storeB = new InMemoryEnvironmentCheckpointStoreV0();
    const recorderB = { requests: [] as string[] };
    const hostB = await EnvironmentSubjectHostV0.open(
      config(),
      deps(storeB, recorderB, new ShiftedEnvironmentV0([sceneA]))
    );
    const first = await hostB.processNextInteraction();
    expect(first.status).toBe("COMPLETE");
    const requestB = recorderB.requests.at(-1) as string;
    expect(first.scene).toBe(sceneA);

    // The current scene is held constant; the inputs differ because Run A's
    // earlier canonical environment experience reaches the normal Memory path.
    expect(requestA).not.toBe(requestB);
    expect(earlierEpisodeRefs([requestA]).length).toBeGreaterThan(0);
    const earlierInB = earlierEpisodeRefs([requestB]).filter((ref) => requestA.includes(ref));
    expect(earlierInB).toEqual([]);
  }, 60000);

  it("fails closed on a corrupt checkpoint document and never starts a new subject", async () => {
    const recorder = { requests: [] as string[] };
    await expect(
      EnvironmentSubjectHostV0.open(config(), deps(new CorruptEnvironmentCheckpointStoreV0(), recorder))
    ).rejects.toThrow(/restore failed/i);
  }, 60000);

  it("fails closed when a persisted checkpoint belongs to a different subject identity", async () => {
    const store = new InMemoryEnvironmentCheckpointStoreV0();
    const recorderA = { requests: [] as string[] };
    const hostA = await EnvironmentSubjectHostV0.open(config("subject-a"), deps(store, recorderA));
    await hostA.processNextInteraction();

    // Same persisted bundle, different configured subject identity.
    const recorderB = { requests: [] as string[] };
    await expect(
      EnvironmentSubjectHostV0.open(config("subject-b"), deps(store, recorderB))
    ).rejects.toThrow(/restore failed/i);
  }, 60000);

  it("does not leak environment/ActionIntent into the conversation product (allowed_actions stays [])", async () => {
    const store = new InMemoryEnvironmentCheckpointStoreV0();
    const recorder = { requests: [] as string[] };
    const host = await EnvironmentSubjectHostV0.open(config(), deps(store, recorder));
    await host.processNextInteraction();
    // The frozen conversation cognition configuration remains action-free: no
    // action-intent vocabulary or non-empty allowed action space appears.
    const request = recorder.requests[0] as string;
    expect(request).toContain("(no external actions allowed this cycle");
    expect(request).not.toContain("COUNTERPART_CONTEXT_SEARCH_FIRST");
  }, 60000);
});
