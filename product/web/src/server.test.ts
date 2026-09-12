/**
 * CHARACTEROS_VISUAL_PRODUCT_LOCAL_WEB_V0 — local product server tests.
 *
 * Deterministic: a fake product runtime port (0 real provider calls, no sleeps).
 * Covers startup/serving, NEW/RESTORED bootstrap, the talk loop, structured SSE
 * progress, memory/state refresh, validation, body limit, static allowlist,
 * localhost-only default binding, and no-CORS-by-default.
 */

import { afterEach, describe, expect, it } from "vitest";
import type {
  InstrumentedTurnResultV0,
  InteractiveSubjectStateViewV0,
  InteractiveSubjectStatusV0,
  LivedMemoryInspectionV0,
  ProductLifeViewV0,
  ProductRuntimeBootstrapV0,
  ProductStateViewV0,
  ProductTurnResultV0,
  ProviderProgressEventV0
} from "@characteros-next/sandbox";
import {
  createProductWebServerV0,
  startProductWebServerV0,
  WEB_DEFAULT_HOST_V0,
  WEB_MAX_BODY_BYTES_V0,
  WEB_MAX_MEMORY_LIMIT_V0,
  WEB_MAX_TEXT_LENGTH_V0,
  type ProductWebRuntimePortV0,
  type ProductWebServerHandleV0
} from "./server.js";

const handles: ProductWebServerHandleV0[] = [];
afterEach(async () => {
  while (handles.length > 0) {
    const handle = handles.pop();
    if (handle !== undefined) await handle.close();
  }
});

// --- fake product runtime port (test double; no provider calls) ----------------

interface FakeRuntimeV0 extends ProductWebRuntimePortV0 {
  readonly emitted: ProviderProgressEventV0[];
  setTalkResult(result: ProductTurnResultV0): void;
  emit(event: ProviderProgressEventV0): void;
  talkCount(): number;
  episodeCount(): number;
}

function stateViewShape(): InteractiveSubjectStateViewV0 {
  return {
    schema_version: "interactive-subject-state-view-v0",
    identity: { subject_id: "mira-14aa8fc5", display_name: "Mira", identity_anchors: [] },
    logical_time: 3,
    state_revision: 4,
    repository_revision: "R4",
    affect: { valence: 0.12, activation: 0.4 },
    regulation: { energy: 0.9, stress: 0.1, arousal: 0.3, fatigue: 0.05 },
    personality: [],
    traits_seed: {},
    beliefs: [],
    relationships: []
  };
}

function statusShape(origin: "NEW_SUBJECT" | "SUBJECT_RESTORED", turns: number): InteractiveSubjectStatusV0 {
  return {
    schema_version: "interactive-subject-status-v0",
    session_id: "sess-test",
    subject_id: "mira-14aa8fc5",
    origin,
    turn_index: turns,
    completed_turns: turns,
    pending_behavior_outcome: false,
    logical_time: 3,
    state_revision: 4 + turns,
    repository_revision: `R${4 + turns}`,
    affect: { valence: 0.12, activation: 0.4 },
    pending_lifecycle_work: 0
  };
}

function completeTurnResult(reply: string): ProductTurnResultV0 {
  return {
    status: "COMPLETE",
    reply_text: reply,
    turn_index: 1,
    subject_id: "mira-14aa8fc5",
    completed_prior_outcome: null,
    language_call_required: true,
    elapsed_ms: 2500,
    repository_revision_after: "R5",
    state_revision_after: 5,
    failure_detail: null,
    failure: null
  };
}

function failedTurnResult(): ProductTurnResultV0 {
  return {
    status: "FAILED",
    reply_text: null,
    turn_index: 1,
    subject_id: "mira-14aa8fc5",
    completed_prior_outcome: null,
    language_call_required: false,
    elapsed_ms: 1200,
    repository_revision_after: "R5",
    state_revision_after: 5,
    failure_detail: "cognition/language path failed (APPRAISAL_FAILED): provider unreachable",
    failure: {
      stage: "COGNITION",
      persistence: "PARTIAL",
      repository_revision_before: "R4",
      repository_revision_after: "R5",
      state_revision_before: 4,
      state_revision_after: 5,
      pending_lifecycle_work: 1,
      category: "PROVIDER_UNAVAILABLE",
      detail: "connect ECONNREFUSED 127.0.0.1:11434",
      suggested_action: "Check that Ollama is running and the configured model is installed, then relaunch."
    }
  };
}

function fakeRuntime(origin: "NEW_SUBJECT" | "SUBJECT_RESTORED"): FakeRuntimeV0 {
  const listeners = new Set<(event: ProviderProgressEventV0) => void>();
  const emitted: ProviderProgressEventV0[] = [];
  let turns = origin === "SUBJECT_RESTORED" ? 2 : 0;
  let episodes = origin === "SUBJECT_RESTORED" ? 2 : 0;
  let talkResult = completeTurnResult("Hello from the subject.");
  return {
    emitted,
    setTalkResult: (result): void => {
      talkResult = result;
    },
    emit: (event): void => {
      emitted.push(event);
      for (const listener of [...listeners]) listener(event);
    },
    talkCount: () => turns,
    episodeCount: () => episodes,
    bootstrap: async (): Promise<ProductRuntimeBootstrapV0> => ({
      identity: {
        subject_id: "mira-14aa8fc5",
        display_name: "Mira",
        identity_anchors: [],
        identity_source: "PERSISTED_PRODUCT_CONFIG",
        identity_origin: "subject-config.json",
        durable_state: origin === "SUBJECT_RESTORED" ? "PRESENT" : "NONE"
      },
      status: origin === "SUBJECT_RESTORED" ? "RESTORED" : "NEW",
      created_this_start: false,
      provider: { ready: true, model: "qwen3.5:9b", endpoint: "http://127.0.0.1:11434", timeout_ms: 120000 },
      logical_time: 3,
      affect: { valence: 0.12, activation: 0.4 },
      revisions: { state_revision: 4 + turns, repository_revision: `R${4 + turns}`, shared_revision: 7 },
      state: stateViewShape(),
      recent_memory: memoryShape(episodes)
    }),
    status: async (): Promise<InteractiveSubjectStatusV0> => statusShape(origin, turns),
    stateView: async (): Promise<ProductStateViewV0> => ({
      status: statusShape(origin, turns),
      state: stateViewShape(),
      shared_revision: 7
    }),
    lifeView: async (): Promise<ProductLifeViewV0> => ({
      subject_id: "mira-14aa8fc5",
      display_name: "Mira",
      origin,
      logical_time: 3,
      state_revision: 4 + turns,
      repository_revision: `R${4 + turns}`,
      shared_revision: 7,
      affect: { valence: 0.12, activation: 0.4 },
      regulation: stateViewShape().regulation,
      personality: [],
      beliefs: [],
      relationships: [],
      recent_memory: memoryShape(episodes)
    }),
    livedMemory: async (limit?: number): Promise<LivedMemoryInspectionV0> => memoryShape(episodes, limit ?? 10),
    submitHumanText: async (): Promise<InstrumentedTurnResultV0> => {
      turns += 1;
      if (talkResult.status === "COMPLETE") episodes += 1;
      return { outcome: { turn_index: turns - 1 }, elapsed_ms: talkResult.elapsed_ms } as unknown as InstrumentedTurnResultV0;
    },
    summarizeTurn: (): ProductTurnResultV0 => talkResult,
    subscribe: (listener: (event: ProviderProgressEventV0) => void): (() => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }
  };
}

function memoryShape(total: number, displayed = Math.min(total, 5)): LivedMemoryInspectionV0 {
  const entries = Array.from({ length: Math.min(total, displayed) }, (_unused, index) => ({
    kind: "OBSERVATION" as const,
    occurrence_logical_time: index + 1,
    scene: `Episode ${index + 1}`,
    episode_ref: `episode:${index + 1}`
  }));
  return {
    schema_version: "lived-memory-inspection-v0",
    repository_revision: "R4",
    total_episode_count: total,
    displayed_count: entries.length,
    entries
  };
}

async function startFakeServer(
  origin: "NEW_SUBJECT" | "SUBJECT_RESTORED" = "NEW_SUBJECT"
): Promise<{ readonly handle: ProductWebServerHandleV0; readonly runtime: FakeRuntimeV0 }> {
  const runtime = fakeRuntime(origin);
  const handle = await startProductWebServerV0({ runtime, port: 0 });
  handles.push(handle);
  return { handle, runtime };
}

function apiUrl(handle: ProductWebServerHandleV0, path: string): string {
  return new URL(path, handle.url).toString();
}

describe("CHARACTEROS_VISUAL_PRODUCT_LOCAL_WEB_V0 — local product server", () => {
  it("W1: starts locally, reports health, and defaults to 127.0.0.1", async () => {
    const { handle } = await startFakeServer();
    expect(WEB_DEFAULT_HOST_V0).toBe("127.0.0.1");
    expect(handle.host).toBe("127.0.0.1");
    expect(handle.port).toBeGreaterThan(0);
    const response = await fetch(apiUrl(handle, "/api/health"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, status: "ok" });
  });

  it("W2: bootstrap reports NEW and RESTORED truthfully", async () => {
    const fresh = await startFakeServer("NEW_SUBJECT");
    const freshBody = (await (await fetch(apiUrl(fresh.handle, "/api/bootstrap"))).json()) as {
      ok: boolean;
      bootstrap: ProductRuntimeBootstrapV0;
    };
    expect(freshBody.ok).toBe(true);
    expect(freshBody.bootstrap.status).toBe("NEW");
    expect(freshBody.bootstrap.identity.display_name).toBe("Mira");
    expect(freshBody.bootstrap.provider.ready).toBe(true);

    const restored = await startFakeServer("SUBJECT_RESTORED");
    const restoredBody = (await (await fetch(apiUrl(restored.handle, "/api/bootstrap"))).json()) as {
      bootstrap: ProductRuntimeBootstrapV0;
    };
    expect(restoredBody.bootstrap.status).toBe("RESTORED");
    expect(restoredBody.bootstrap.identity.durable_state).toBe("PRESENT");
    expect(restoredBody.bootstrap.recent_memory.total_episode_count).toBe(2);
    expect(restoredBody.bootstrap.revisions.shared_revision).toBe(7);
  });

  it("W3: POST /api/talk returns the structured reply and refreshes life/state", async () => {
    const { handle } = await startFakeServer("NEW_SUBJECT");
    const before = (await (await fetch(apiUrl(handle, "/api/memory?limit=10"))).json()) as {
      memory: LivedMemoryInspectionV0;
    };
    expect(before.memory.total_episode_count).toBe(0);

    const response = await fetch(apiUrl(handle, "/api/talk"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Hello." })
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { ok: boolean; turn: ProductTurnResultV0 };
    expect(body.turn.status).toBe("COMPLETE");
    expect(body.turn.reply_text).toBe("Hello from the subject.");

    const after = (await (await fetch(apiUrl(handle, "/api/memory?limit=10"))).json()) as {
      memory: LivedMemoryInspectionV0;
    };
    expect(after.memory.total_episode_count).toBe(1);
    const state = (await (await fetch(apiUrl(handle, "/api/state"))).json()) as { view: ProductStateViewV0 };
    expect(state.view.status.completed_turns).toBe(1);
    expect(state.view.state.affect.valence).toBe(0.12);
  });

  it("W3-failure: a failed turn returns the truthful failure summary, never a fake reply", async () => {
    const { handle, runtime } = await startFakeServer("SUBJECT_RESTORED");
    runtime.setTalkResult(failedTurnResult());
    const response = await fetch(apiUrl(handle, "/api/talk"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "This will fail." })
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { turn: ProductTurnResultV0 };
    expect(body.turn.status).toBe("FAILED");
    expect(body.turn.reply_text).toBeNull();
    expect(body.turn.failure?.stage).toBe("COGNITION");
    expect(body.turn.failure?.persistence).toBe("PARTIAL");
    expect(body.turn.failure?.category).toBe("PROVIDER_UNAVAILABLE");
    expect(body.turn.failure?.suggested_action).toContain("Ollama");
  });

  it("W4: GET /api/events streams the SAME structured progress events", async () => {
    const { handle, runtime } = await startFakeServer();
    const response = await fetch(apiUrl(handle, "/api/events"));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    // No broad CORS: same-origin product.
    expect(response.headers.get("access-control-allow-origin")).toBeNull();

    const reader = response.body?.getReader();
    expect(reader).toBeDefined();
    if (reader === undefined) return;
    runtime.emit({ type: "TURN_PLAN", reply_estimate_ms: 1500 });
    runtime.emit({ type: "STAGE_RUNNING", stage: "COGNITION", group: "REPLY", index: 2, total: 3, status: "RUNNING" });
    runtime.emit({ type: "STAGE_SUCCEEDED", stage: "COGNITION", group: "REPLY", index: 2, total: 3, status: "OK", latency_ms: 2100 });

    const decoder = new TextDecoder();
    let text = "";
    for (let attempt = 0; attempt < 6 && !text.includes("STAGE_SUCCEEDED"); attempt += 1) {
      const chunk = await reader.read();
      if (chunk.done) break;
      text += decoder.decode(chunk.value, { stream: true });
    }
    expect(text).toContain("TURN_PLAN");
    expect(text).toContain('"stage":"COGNITION"');
    expect(text).toContain('"latency_ms":2100');
    await reader.cancel();
  });

  it("W5: memory is bounded and state exposes only lawful fields", async () => {
    const { handle } = await startFakeServer();
    const ok = await fetch(apiUrl(handle, "/api/memory?limit=2"));
    expect(ok.status).toBe(200);
    const body = (await ok.json()) as { memory: LivedMemoryInspectionV0 };
    expect(body.memory.entries.length).toBeLessThanOrEqual(2);

    const state = (await (await fetch(apiUrl(handle, "/api/state"))).json()) as { view: ProductStateViewV0 };
    const serialized = JSON.stringify(state.view);
    // No prompts, hashes-as-content, authority tokens or mutation surfaces.
    expect(serialized).not.toContain("prompt");
    expect(serialized).not.toContain("authority");
    expect(serialized).not.toContain("commit_ref");
    expect(state.view.state.beliefs).toEqual([]);
    expect(state.view.state.personality).toEqual([]);
  });

  it("W1: serves the static UI with correct content types from an allowlist only", async () => {
    const { handle } = await startFakeServer();
    const index = await fetch(handle.url);
    expect(index.status).toBe(200);
    expect(index.headers.get("content-type")).toContain("text/html");
    expect(await index.text()).toContain("CharacterOS");

    const app = await fetch(apiUrl(handle, "/app.js"));
    expect(app.headers.get("content-type")).toContain("text/javascript");
    const styles = await fetch(apiUrl(handle, "/styles.css"));
    expect(styles.headers.get("content-type")).toContain("text/css");

    // No request path is ever used as a filesystem path.
    for (const path of ["/../package.json", "/index.html/../package.json", "/%2e%2e/package.json"]) {
      const response = await fetch(apiUrl(handle, path));
      expect(response.status).toBe(404);
    }
  });

  it("validation: bounded text, JSON shape, memory limit, unknown routes, methods", async () => {
    const { handle } = await startFakeServer();
    const post = (body: string): Promise<Response> =>
      fetch(apiUrl(handle, "/api/talk"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body
      });

    expect((await post(JSON.stringify({ text: "" }))).status).toBe(400);
    expect((await post("not json")).status).toBe(400);
    expect((await post(JSON.stringify({ text: "x".repeat(WEB_MAX_TEXT_LENGTH_V0 + 1) }))).status).toBe(400);
    expect((await post(JSON.stringify({ text: "ok" }))).status).toBe(200);

    expect((await fetch(apiUrl(handle, "/api/memory?limit=0"))).status).toBe(400);
    expect((await fetch(apiUrl(handle, `/api/memory?limit=${WEB_MAX_MEMORY_LIMIT_V0 + 1}`))).status).toBe(400);
    expect((await fetch(apiUrl(handle, "/api/memory?limit=abc"))).status).toBe(400);
    expect((await fetch(apiUrl(handle, "/api/does-not-exist"))).status).toBe(404);
    expect((await fetch(apiUrl(handle, "/api/talk"))).status).toBe(405);
    expect((await fetch(apiUrl(handle, "/api/health"), { method: "POST" })).status).toBe(405);
  });

  it("validation+§58: an oversized talk body is rejected with 413", async () => {
    const { handle } = await startFakeServer();
    const response = await fetch(apiUrl(handle, "/api/talk"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "x".repeat(WEB_MAX_BODY_BYTES_V0 + 1024) })
    });
    expect(response.status).toBe(413);
    const body = (await response.json()) as { ok: boolean; code: string };
    expect(body.ok).toBe(false);
    expect(body.code).toBe("BODY_TOO_LARGE");
  });

  it("W6: a browser reload re-fetches backend truth and creates no new subject", async () => {
    const { handle, runtime } = await startFakeServer("SUBJECT_RESTORED");
    const first = (await (await fetch(apiUrl(handle, "/api/bootstrap"))).json()) as {
      bootstrap: ProductRuntimeBootstrapV0;
    };
    const second = (await (await fetch(apiUrl(handle, "/api/bootstrap"))).json()) as {
      bootstrap: ProductRuntimeBootstrapV0;
    };
    expect(second.bootstrap.identity.subject_id).toBe(first.bootstrap.identity.subject_id);
    expect(second.bootstrap.status).toBe("RESTORED");
    expect(runtime.talkCount()).toBe(2);
    expect(runtime.episodeCount()).toBe(2);
  });

  it("W1: createProductWebServerV0 also binds 127.0.0.1 by default", async () => {
    const runtime = fakeRuntime("NEW_SUBJECT");
    const server = createProductWebServerV0({ runtime });
    const handle: ProductWebServerHandleV0 = {
      server,
      host: WEB_DEFAULT_HOST_V0,
      port: 0,
      url: `http://${WEB_DEFAULT_HOST_V0}:0/`,
      close: async (): Promise<void> => {
        await new Promise<void>((resolvePromise) => server.close(() => resolvePromise()));
      }
    };
    handles.push(handle);
    await new Promise<void>((resolvePromise) => server.listen(0, WEB_DEFAULT_HOST_V0, () => resolvePromise()));
    const address = server.address();
    const port = typeof address === "object" && address !== null ? address.port : 0;
    const response = await fetch(`http://${WEB_DEFAULT_HOST_V0}:${port}/api/health`);
    expect(response.status).toBe(200);
  });
});
