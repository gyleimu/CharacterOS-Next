/**
 * INTERACTIVE_SUBJECT_MEMORY_INSPECTION_V0 — product `/memory` command tests.
 *
 * Proves the command is read-only: it renders safe factual history, causes no
 * subject mutation, no ingestion, no Experience/Memory write and no provider
 * call, and fails safely.
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  ModelTransportRequestV0,
  ModelTransportResponseV0,
  ModelTransportV0
} from "@characteros-next/runtime";
import { InteractiveSubjectHostV0 } from "./interactive-subject-host.js";
import { createProductAppraisalProviderV0 } from "./product-appraisal-provider.js";
import { ProductCliSessionV0 } from "./product-cli-session.js";

interface TransportRecorder {
  readonly requests: { readonly messages: readonly { readonly role: string; readonly content: string }[] }[];
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
          text: "SUBJECT_REPLY_TEXT",
          evidence_refs: []
        }),
        model: "fake"
      } as ModelTransportResponseV0;
    }
  } as ModelTransportV0;
}

const tempDirs: string[] = [];
function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "characteros-memory-"));
  tempDirs.push(dir);
  return dir;
}
afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
  }
});

async function makeSession(recorder: TransportRecorder = { requests: [] }) {
  const dir = makeTempDir();
  const host = await InteractiveSubjectHostV0.open(
    {
      subject_id: "alice",
      display_name: "Alice",
      session_id: "sess-memory-cli",
      storage_root: dir,
      interval_ticks: 1
    },
    {
      conversationCognitionTransport: cognitionTransport(recorder),
      languageTransport: languageTransport(),
      appraisalProvider: createProductAppraisalProviderV0(),
      provider_identity: { model: "fake", num_predict: 2048 },
      clock: () => "2026-01-01T00:00:00.000Z"
    }
  );
  const lines: string[] = [];
  const session = new ProductCliSessionV0({
    host,
    subjectLabel: "Alice",
    model: "fake",
    providerLabel: "FAKE",
    contextWindowTokens: 8192,
    maxOutputTokens: 2048,
    debug: false,
    write: (line) => lines.push(line)
  });
  return { host, session, lines, recorder };
}

describe("INTERACTIVE_SUBJECT_MEMORY_INSPECTION_V0 — /memory command", () => {
  it("empty memory prints a safe empty message", async () => {
    const { session, lines } = await makeSession();
    await session.handleLine("/memory");
    expect(lines).toContain("Alice has no durable lived memories yet.");
  });

  it("renders observation and behavior-outcome memory without internal refs", async () => {
    const { session, lines } = await makeSession();
    await session.handleLine("My favorite color is teal.");
    await session.handleLine("That's good to know.");
    lines.length = 0;
    await session.handleLine("/memory");
    const output = lines.join("\n");
    expect(output).toContain("Alice remembers 2 lived episodes:");
    expect(output).toContain('The user says: "My favorite color is teal."');
    expect(output).toContain("Alice said:");
    expect(output).toContain("SUBJECT_REPLY_TEXT");
    expect(output).toContain("You replied:");
    expect(output).toContain('"That\'s good to know."');
    // Developer identifiers are not shown by default.
    expect(output).not.toMatch(/episode:|experience:|event:|dlv-/);
    expect(output).not.toMatch(/reward|sentiment|trust|success/i);
  });

  it("is read-only: no state mutation, no ingestion, no provider call", async () => {
    const recorder: TransportRecorder = { requests: [] };
    const { host, session, lines } = await makeSession(recorder);
    await session.handleLine("Remember this.");
    const before = await host.status();
    const callsBefore = recorder.requests.length;
    lines.length = 0;
    await session.handleLine("/memory");
    const after = await host.status();
    expect(recorder.requests.length).toBe(callsBefore);
    expect(after.repository_revision).toBe(before.repository_revision);
    expect(after.state_revision).toBe(before.state_revision);
    expect(after.turn_index).toBe(before.turn_index);
    expect(after.completed_turns).toBe(before.completed_turns);
    // Calling it twice yields the same factual output.
    const firstOutput = [...lines];
    lines.length = 0;
    await session.handleLine("/memory");
    expect(lines).toEqual(firstOutput);
  });

  it("supports a bounded count argument and rejects unsupported arguments safely", async () => {
    const { host, session, lines } = await makeSession();
    await session.handleLine("Observation one.");
    await session.handleLine("Outcome one.");
    const before = await host.status();
    lines.length = 0;
    await session.handleLine("/memory 1");
    expect(lines.join("\n")).toContain("Showing the 1 most recent:");
    for (const bad of ["/memory abc", "/memory 20 extra", "/memory -3", "/memory 0"]) {
      lines.length = 0;
      await session.handleLine(bad);
      expect(lines.join("\n")).toContain("Usage: /memory [count]");
    }
    const after = await host.status();
    expect(after.repository_revision).toBe(before.repository_revision);
    expect(after.turn_index).toBe(before.turn_index);
  });

  it("/help documents the /memory command", async () => {
    const { session, lines } = await makeSession();
    await session.handleLine("/help");
    expect(lines.some((line) => line.includes("/memory") && line.includes("read-only"))).toBe(true);
  });

  it("debug mode may show the durable episode ref", async () => {
    const dir = makeTempDir();
    const recorder: TransportRecorder = { requests: [] };
    const host = await InteractiveSubjectHostV0.open(
      { subject_id: "alice", display_name: "Alice", session_id: "sess-dbg", storage_root: dir, interval_ticks: 1 },
      {
        conversationCognitionTransport: cognitionTransport(recorder),
        languageTransport: languageTransport(),
        appraisalProvider: createProductAppraisalProviderV0(),
        provider_identity: { model: "fake", num_predict: 2048 },
        clock: () => "2026-01-01T00:00:00.000Z"
      }
    );
    const lines: string[] = [];
    const session = new ProductCliSessionV0({
      host,
      subjectLabel: "Alice",
      model: "fake",
      providerLabel: "FAKE",
      contextWindowTokens: 8192,
      maxOutputTokens: 2048,
      debug: true,
      write: (line) => lines.push(line)
    });
    await session.handleLine("Debug memory.");
    lines.length = 0;
    await session.handleLine("/memory");
    expect(lines.join("\n")).toMatch(/\[episode:/);
  });

  it("a read failure fails safely without mutating subject state", async () => {
    const { host, session, lines } = await makeSession();
    await session.handleLine("Some memory.");
    const before = await host.status();
    const spy = vi.spyOn(host, "livedMemory").mockRejectedValue(new Error("canonical memory unreadable"));
    lines.length = 0;
    await session.handleLine("/memory");
    expect(lines).toContain("Memory inspection failed.");
    const after = await host.status();
    expect(after.repository_revision).toBe(before.repository_revision);
    expect(after.turn_index).toBe(before.turn_index);
    spy.mockRestore();
  });
});
