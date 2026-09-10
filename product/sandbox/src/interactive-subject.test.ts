/**
 * INTERACTIVE_PERSISTENT_SUBJECT_RUNTIME_V0 — product host + CLI session tests.
 *
 * Fully offline: fake transports, deterministic providers. The restart test
 * uses a REAL temporary directory and constructs a brand-new host object graph,
 * so it is equivalent to a process restart (no live runtime objects are reused).
 */

import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type {
  ModelTransportRequestV0,
  ModelTransportResponseV0,
  ModelTransportV0
} from "@characteros-next/runtime";
import { InteractiveSubjectHostV0, type InteractiveSubjectHostConfigV0 } from "./interactive-subject-host.js";
import { createProductAppraisalProviderV0 } from "./product-appraisal-provider.js";
import { ProductCliSessionV0 } from "./product-cli-session.js";
import { SerialTaskQueueV0 } from "./serial-task-queue.js";
import { InMemoryInteractiveSnapshotStoreV0, InteractiveSnapshotCorruptErrorV0 } from "./persistent-snapshot-store.js";

const SUBJECT_ID = "alice";

type Mode = "CLARIFY" | "REALIZE" | "MALFORMED" | "TRUNCATED";

interface TransportRecorder {
  readonly requests: { readonly messages: readonly { readonly role: string; readonly content: string }[] }[];
}

function cognitionTransport(mode: () => Mode, recorder: TransportRecorder): ModelTransportV0 {
  return {
    complete: async (request: ModelTransportRequestV0): Promise<ModelTransportResponseV0> => {
      recorder.requests.push({ messages: request.messages.map((m) => ({ role: m.role, content: m.content })) });
      const user = request.messages.find((m) => m.role === "user")?.content ?? "";
      const projectionHash = /\[projection_hash\]\s+(\S+)/.exec(user)?.[1] ?? "";
      const selected = mode();
      if (selected === "MALFORMED") return { content: "{ not json", model: "fake" } as ModelTransportResponseV0;
      if (selected === "TRUNCATED") {
        return {
          content: '{"schema_version":"conversation-cognition-proposal-v1","cognition":{"schema_version":"cognition-proposal-v0"',
          model: "fake"
        } as ModelTransportResponseV0;
      }
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
          communication_directive: {
            kind: selected === "CLARIFY" ? "CLARIFY_MISSING_CONTEXT" : "REALIZE_CURRENT_INTENT"
          }
        }),
        model: "fake"
      } as ModelTransportResponseV0;
    }
  } as ModelTransportV0;
}

function languageTransport(): ModelTransportV0 {
  return {
    complete: async (request: ModelTransportRequestV0): Promise<ModelTransportResponseV0> => {
      const user = request.messages.find((m) => m.role === "user")?.content ?? "";
      const inputHash = /input_hash:\s*(sha256:[0-9a-f]+)/.exec(user)?.[1] ?? "";
      return {
        content: JSON.stringify({
          schema_version: "language-realization-draft-v0",
          input_hash: inputHash,
          text: "PRODUCT_REALIZATION_REPLY",
          evidence_refs: []
        }),
        model: "fake"
      } as ModelTransportResponseV0;
    }
  } as ModelTransportV0;
}

function hostDeps(mode: () => Mode, recorder: TransportRecorder, snapshotStore?: InMemoryInteractiveSnapshotStoreV0) {
  return {
    conversationCognitionTransport: cognitionTransport(mode, recorder),
    languageTransport: languageTransport(),
    appraisalProvider: createProductAppraisalProviderV0(),
    provider_identity: { model: "fake", num_predict: 2048 },
    clock: () => "2026-01-01T00:00:00.000Z",
    ...(snapshotStore === undefined ? {} : { snapshotStore })
  };
}

function config(storageRoot: string): InteractiveSubjectHostConfigV0 {
  return { subject_id: SUBJECT_ID, session_id: "sess-product-test", storage_root: storageRoot, interval_ticks: 1 };
}

const tempDirs: string[] = [];
function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "characteros-interactive-"));
  tempDirs.push(dir);
  return dir;
}
afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
  }
});

describe("INTERACTIVE_PERSISTENT_SUBJECT_RUNTIME_V0 — product host (offline)", () => {
  it("first launch resolves NEW_SUBJECT_CREATED and one turn completes + persists", async () => {
    const store = new InMemoryInteractiveSnapshotStoreV0();
    const host = await InteractiveSubjectHostV0.open(config("unused"), hostDeps(() => "CLARIFY", { requests: [] }, store));
    expect(host.resolution()).toBe("NEW_SUBJECT_CREATED");
    const outcome = await host.send("Hello there.");
    expect(outcome.status).toBe("COMPLETE");
    expect(outcome.delivery_id).not.toBeNull();
    expect(host.pendingLifecycleWork()).toBe(0);
    const saved = await store.load();
    expect(saved.kind).toBe("SNAPSHOT");
  });

  it("refuses a second concurrent turn (strict serialization)", async () => {
    const host = await InteractiveSubjectHostV0.open(
      config("unused"),
      hostDeps(() => "CLARIFY", { requests: [] }, new InMemoryInteractiveSnapshotStoreV0())
    );
    const first = host.send("one");
    await expect(host.send("two")).rejects.toThrow();
    await first;
  });

  it("serial queue runs every submitted line exactly once, in order, never concurrently", async () => {
    const order: string[] = [];
    let active = 0;
    let maxActive = 0;
    const queue = new SerialTaskQueueV0();
    for (const label of ["a", "b", "c"]) {
      queue.enqueue(async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        order.push(label);
        active -= 1;
      });
    }
    await queue.drain();
    expect(order).toEqual(["a", "b", "c"]);
    expect(maxActive).toBe(1);
  });

  it("malformed provider cognition fails closed and blocks further messages", async () => {
    const host = await InteractiveSubjectHostV0.open(
      config("unused"),
      hostDeps(() => "MALFORMED", { requests: [] }, new InMemoryInteractiveSnapshotStoreV0())
    );
    const outcome = await host.send("Hello.");
    expect(outcome.status).toBe("FAILED");
    expect(host.isFailed()).toBe(true);
    await expect(host.send("Again?")).rejects.toThrow(/failed state/);
  });

  it("provider truncation fails closed", async () => {
    const host = await InteractiveSubjectHostV0.open(
      config("unused"),
      hostDeps(() => "TRUNCATED", { requests: [] }, new InMemoryInteractiveSnapshotStoreV0())
    );
    const outcome = await host.send("Hello.");
    expect(outcome.status).toBe("FAILED");
    expect(outcome.failure).toContain("TURN_FAILED_CLOSED");
  });

  it("a corrupt durable snapshot fails closed instead of creating a new subject", async () => {
    const dir = makeTempDir();
    const first = await InteractiveSubjectHostV0.open(config(dir), hostDeps(() => "CLARIFY", { requests: [] }));
    await first.send("First.");
    const snapshotPath = join(dir, `subject-${SUBJECT_ID}.snapshot.json`);
    writeFileSync(snapshotPath, "{ this is not valid json", "utf8");
    await expect(InteractiveSubjectHostV0.open(config(dir), hostDeps(() => "CLARIFY", { requests: [] }))).rejects.toBeInstanceOf(
      InteractiveSnapshotCorruptErrorV0
    );
  });

  it("§43-equivalent file restart: new host restores same subject and retrieves pre-restart Memory", async () => {
    const dir = makeTempDir();
    const recorderA: TransportRecorder = { requests: [] };
    const hostA = await InteractiveSubjectHostV0.open(config(dir), hostDeps(() => "CLARIFY", recorderA));
    expect(hostA.resolution()).toBe("NEW_SUBJECT_CREATED");
    await hostA.send("I usually drink coffee without sugar.");
    await hostA.send("Thanks, noted.");
    const statusA = await hostA.status();
    const snapshotA = JSON.parse(readFileSync(join(dir, `subject-${SUBJECT_ID}.snapshot.json`), "utf8")) as {
      durable: { identity: { repository_revision: string } };
    };
    expect(snapshotA.durable.identity.repository_revision).toBe(statusA.repository_revision);

    // Destroy hostA entirely; construct a brand-new object graph in the same dir.
    const recorderB: TransportRecorder = { requests: [] };
    const hostB = await InteractiveSubjectHostV0.open(config(dir), hostDeps(() => "CLARIFY", recorderB));
    expect(hostB.resolution()).toBe("SUBJECT_RESTORED");
    expect(hostB.subjectId()).toBe(SUBJECT_ID);

    const statusB = await hostB.status();
    expect(statusB.repository_revision).toBe(statusA.repository_revision);
    expect(statusB.turn_index).toBe(2);

    const turn = await hostB.send("I'm getting coffee. How should I order it?");
    expect(turn.status).toBe("COMPLETE");
    expect(turn.repository_revision_before).toBe(statusA.repository_revision);
    expect(turn.repository_revision_after).not.toBe(turn.repository_revision_before);
    // Pre-restart lived history is retrieved through production retrieval.
    expect(turn.working_episode_refs.length).toBeGreaterThan(0);
    expect(turn.provider_memory_section_present).toBe(true);
    // The prior turn's deferred behavior outcome is committed post-restart.
    expect(turn.completed_prior_outcome).not.toBeNull();
    // No transcript bypass: every provider call is exactly system+user.
    for (const request of recorderB.requests) {
      expect(request.messages).toHaveLength(2);
      expect(request.messages[1]?.content ?? "").not.toContain("[CONVERSATION HISTORY]");
      expect(request.messages[1]?.content ?? "").not.toContain("[TRANSCRIPT]");
    }
  });
});

describe("INTERACTIVE_PERSISTENT_SUBJECT_RUNTIME_V0 — CLI session (offline)", () => {
  function makeSession(mode: () => Mode = () => "CLARIFY") {
    const lines: string[] = [];
    const store = new InMemoryInteractiveSnapshotStoreV0();
    return InteractiveSubjectHostV0.open(config("unused"), hostDeps(mode, { requests: [] }, store)).then((host) => {
      const session = new ProductCliSessionV0({
        host,
        model: "fake",
        providerLabel: "FAKE",
        contextWindowTokens: 8192,
        maxOutputTokens: 2048,
        debug: false,
        write: (line) => lines.push(line)
      });
      return { host, session, lines };
    });
  }

  it("/status does not mutate subject state", async () => {
    const { host, session, lines } = await makeSession();
    await session.handleLine("Hello.");
    const before = await host.status();
    await session.handleLine("/status");
    await session.handleLine("/status");
    const after = await host.status();
    expect(after.repository_revision).toBe(before.repository_revision);
    expect(after.state_revision).toBe(before.state_revision);
    expect(after.turn_index).toBe(before.turn_index);
    expect(lines.some((line) => line.startsWith("Subject: "))).toBe(true);
  });

  it("/exit creates no interaction and ends the session", async () => {
    const { host, session, lines } = await makeSession();
    await session.handleLine("Hello.");
    const before = await host.status();
    const result = await session.handleLine("/exit");
    expect(result.kind).toBe("EXIT");
    expect(session.isExiting()).toBe(true);
    const after = await host.status();
    expect(after.turn_index).toBe(before.turn_index);
    expect(after.completed_turns).toBe(before.completed_turns);
    expect(lines).toContain("Goodbye.");
  });

  it("one submitted line invokes exactly one turn", async () => {
    const recorder: TransportRecorder = { requests: [] };
    const store = new InMemoryInteractiveSnapshotStoreV0();
    const host = await InteractiveSubjectHostV0.open(config("unused"), hostDeps(() => "CLARIFY", recorder, store));
    const lines: string[] = [];
    const session = new ProductCliSessionV0({
      host,
      model: "fake",
      providerLabel: "FAKE",
      contextWindowTokens: 8192,
      maxOutputTokens: 2048,
      debug: false,
      write: (line) => lines.push(line)
    });
    await session.handleLine("One message.");
    expect(recorder.requests).toHaveLength(1);
    const status = await host.status();
    expect(status.turn_index).toBe(1);
  });

  it("a failed provider turn reports a concise failure and no fake reply", async () => {
    const { session, lines } = await makeSession(() => "MALFORMED");
    await session.handleLine("Hello.");
    expect(lines.some((line) => line.includes("did not commit"))).toBe(true);
    expect(lines.some((line) => line.startsWith("Subject > "))).toBe(false);
  });

  it("unknown commands are rejected without reaching the subject", async () => {
    const { host, session, lines } = await makeSession();
    await session.handleLine("/nope");
    expect(lines.some((line) => line.includes("Unknown command"))).toBe(true);
    const status = await host.status();
    expect(status.turn_index).toBe(0);
  });
});

describe("INTERACTIVE_SUBJECT_FIRST_TURN_MEMORY_BOUNDARY_V0 — product first-turn memory", () => {
  it("a first-turn fact survives a real file restart after only ONE interaction", async () => {
    const dir = makeTempDir();
    const hostA = await InteractiveSubjectHostV0.open(config(dir), hostDeps(() => "CLARIFY", { requests: [] }));
    const outcomeA = await hostA.send("My favorite color is teal.");
    expect(outcomeA.status).toBe("COMPLETE");
    expect(outcomeA.observational_experience_ref).toMatch(/^episode:/);

    const recorderB: TransportRecorder = { requests: [] };
    const hostB = await InteractiveSubjectHostV0.open(config(dir), hostDeps(() => "CLARIFY", recorderB));
    expect(hostB.resolution()).toBe("SUBJECT_RESTORED");
    const outcomeB = await hostB.send("I'm buying a notebook. Any color suggestions?");
    expect(outcomeB.status).toBe("COMPLETE");
    expect(outcomeB.provider_memory_section_present).toBe(true);
    expect(outcomeB.working_episode_refs.length).toBeGreaterThan(0);
    expect(recorderB.requests[0]?.messages[1]?.content ?? "").toContain("teal");
  });
});
