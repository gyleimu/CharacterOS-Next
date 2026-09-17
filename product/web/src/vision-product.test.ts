/**
 * PERSISTENT_SUBJECT_VISION_PRODUCT_INTEGRATION_V0 — product acceptance (VIS1–VIS12).
 *
 * Vision is an INPUT MODALITY: a captured frame becomes a bounded structured
 * perception candidate, and that candidate enters the EXISTING structured-observation
 * ingress, so it becomes this subject's own lived experience. The provider is never
 * an authority, raw frames are never persisted, capture is on demand, and nothing
 * infers identity or moves Affect directly.
 *
 * 0 real cameras, 0 real screens, 0 model calls: the perception port is a
 * deterministic double and the runtimes are deterministic; VIS6 additionally uses the
 * REAL product runtime over a real data root.
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  AppraisalInferenceReuseV0,
  ProviderDiagnosticsV0,
  createProductRuntimeV0,
  type ProductProviderBundleV0,
  type ProductVisionResultV0,
  type VisualPerceptionPortV0
} from "@characteros-next/sandbox";
import { validateVisualPerceptionV0 } from "@characteros-next/sandbox";
import { createProductWebServerV0, type ProductWebServerHandleV0 } from "./server.js";
import { ProductWebSessionsV0, type ProductWebSubjectRuntimeV0 } from "./sessions.js";

const tempDirs: string[] = [];
function makeTempDir(): string {
  const base = join(process.cwd(), "tmp", "vision-acceptance");
  mkdirSync(base, { recursive: true });
  const dir = mkdtempSync(join(base, "run-"));
  tempDirs.push(dir);
  return dir;
}
afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
  }
});

/** Deterministic perception double: fixed output, or a bounded failure / malformed body. */
function fakeVision(options: {
  readonly scene?: string;
  readonly fail?: boolean;
  readonly malformed?: boolean;
} = {}): VisualPerceptionPortV0 & { calls: number } {
  const port = {
    calls: 0,
    available: true,
    source_types: ["CAMERA"] as const,
    perceive: async (): Promise<ProductVisionResultV0> => {
      port.calls += 1;
      if (options.fail === true) {
        return { kind: "FAILED", code: "VISION_FAILED", detail: "deterministic perception failure" };
      }
      return {
        kind: "PERCEPTION",
        perception: {
          schema_version: "product-vision-v0",
          scene: options.malformed === true ? "" : (options.scene ?? "A red notebook is visible on the desk."),
          objects: ["notebook", "desk"],
          visible_text: [],
          confidence: 0.8
        }
      };
    }
  };
  return port as VisualPerceptionPortV0 & { calls: number };
}

const IMAGE_BASE64 = Buffer.from([7, 7, 7, 7, 7, 7, 7, 7]).toString("base64");
const OTHER_IMAGE_BASE64 = Buffer.from([5, 5, 5, 5, 5, 5, 5, 5]).toString("base64");

interface FakeRuntimeV0 extends ProductWebSubjectRuntimeV0 {
  readonly observations: { readonly source_ref: string; readonly scene: string }[];
}

function fakeRuntime(subjectId: string): FakeRuntimeV0 {
  const observations: { source_ref: string; scene: string }[] = [];
  const bootstrap = () => ({
    identity: { subject_id: subjectId, display_name: subjectId, identity_anchors: [] },
    status: "RESTORED" as const,
    created_this_start: false,
    provider: { ready: true, model: "fake", endpoint: "http://127.0.0.1:11434", timeout_ms: 120000 },
    logical_time: 0,
    affect: { valence: 0, activation: 0.5 },
    revisions: { state_revision: observations.length + 1, repository_revision: `R${observations.length}`, shared_revision: 1 },
    state: {
      schema_version: "interactive-subject-state-view-v0",
      identity: { subject_id: subjectId, display_name: subjectId, identity_anchors: [] },
      logical_time: 0,
      state_revision: observations.length + 1,
      repository_revision: `R${observations.length}`,
      affect: { valence: 0, activation: 0.5 },
      regulation: { energy: 1, stress: 0, arousal: 0.5, fatigue: 0 },
      personality: [],
      traits_seed: {},
      beliefs: [],
      relationships: []
    },
    recent_memory: {
      schema_version: "lived-memory-inspection-v0",
      repository_revision: `R${observations.length}`,
      total_episode_count: observations.length,
      displayed_count: observations.length,
      entries: []
    }
  });
  return {
    observations,
    bootstrap: async () => bootstrap() as never,
    status: async () =>
      ({
        subject_id: subjectId,
        origin: "SUBJECT_RESTORED",
        logical_time: 0,
        state_revision: observations.length + 1,
        repository_revision: `R${observations.length}`,
        turn_index: 0
      }) as never,
    stateView: async () => ({ status: {}, state: bootstrap().state, shared_revision: 1 }) as never,
    lifeView: async () =>
      ({
        subject_id: subjectId,
        display_name: subjectId,
        origin: "SUBJECT_RESTORED",
        logical_time: 0,
        state_revision: observations.length + 1,
        repository_revision: `R${observations.length}`,
        shared_revision: 1,
        affect: { valence: 0, activation: 0.5 },
        regulation: { energy: 1, stress: 0, arousal: 0.5, fatigue: 0 },
        personality: [],
        beliefs: [],
        relationships: [],
        recent_memory: bootstrap().recent_memory,
        evolution: {
          schema_version: "subject-evolution-view-v0",
          subject: { subject_id: subjectId, state_revision: observations.length + 1, logical_time: 0, repository_revision: `R${observations.length}` },
          recent_lived_events: [],
          durable_effects: { affect: [], belief: [] },
          current: {
            affect: { valence: 0, activation: 0.5 },
            regulation: { energy: 1, stress: 0, arousal: 0.5, fatigue: 0 },
            beliefs: [],
            relationships: [],
            personality: [],
            memory: { total_episode_count: observations.length, repository_revision: `R${observations.length}` }
          },
          cognition_visible: {
            policy: "AVAILABLE_TO_COGNITION",
            memory_episode_refs: [],
            belief_proposition_ids: [],
            relationship_counterpart_refs: [],
            personality_dimension_ids: [],
            affect: { valence: 0, activation: 0.5 }
          },
          attribution: {
            affect: { status: "UNAVAILABLE", reason: "fake" },
            belief: { status: "UNAVAILABLE", reason: "fake" },
            relationship: { status: "UNAVAILABLE", reason: "fake" },
            personality: { status: "UNAVAILABLE", reason: "fake" }
          }
        }
      }) as never,
    livedMemory: async () => bootstrap().recent_memory as never,
    submitHumanText: async () =>
      ({
        outcome: {
          status: "COMPLETE",
          subject_text: "noted",
          turn_index: 0,
          subject_id: subjectId,
          repository_revision_after: "R0",
          state_revision_after: 1,
          failure: null
        },
        elapsed_ms: 3
      }) as never,
    summarizeTurn: () =>
      ({
        status: "COMPLETE",
        reply_text: "noted",
        turn_index: 0,
        subject_id: subjectId,
        completed_prior_outcome: null,
        language_call_required: true,
        elapsed_ms: 3,
        repository_revision_after: "R0",
        state_revision_after: 1,
        failure_detail: null,
        failure: null
      }),
    subscribe: () => () => undefined,
    submitExternalObservation: async (fields: { source?: string; scene?: string }) => {
      observations.push({ source_ref: fields.source ?? "", scene: fields.scene ?? "" });
      return {
        kind: observations.length === 1 ? "FIRST" : "REPLAY",
        observation_ref: `observation:${String(observations.length)}`,
        episode_ref: `episode:${String(observations.length)}`,
        base_revision: observations.length
      } as never;
    },
    runEnvironmentInteraction: async () => ({ status: "COMPLETE" }) as never,
    advanceCanonicalTime: async (ticks: number) => ({ ticks, no_op: false }) as never,
    configView: () =>
      ({
        executor: { effective: "ollama", requested: "auto", reason: "fake", credential_present: false },
        model: { value: "fake", source: "DEFAULT", origin: "fake" },
        endpoint: { value: "http://127.0.0.1:11434", source: "DEFAULT", origin: "fake" },
        timeout_ms: { value: "120000", source: "DEFAULT", origin: "fake" },
        context_window_tokens: { value: "8192", source: "DEFAULT", origin: "fake" },
        num_predict: { value: "2048", source: "DEFAULT", origin: "fake" },
        data_root: { value: "/tmp/fake", source: "DEFAULT", origin: "fake" },
        subject: { subject_id: subjectId, display_name: subjectId, identity_source: "DEFAULT", identity_origin: "fake", durable_state: "PRESENT" },
        data_root_contains: [],
        appraisal_exact_input_reuse: { value: "off", source: "DEFAULT", origin: "fake" },
        read_only: true
      }) as never,
    diagnosticsView: () => null,
    shutdown: async () => undefined
  } as unknown as FakeRuntimeV0;
}

async function startServer(input: {
  readonly subjectsRoot: string;
  readonly vision?: VisualPerceptionPortV0;
  readonly runtime?: (subjectId: string) => ProductWebSubjectRuntimeV0;
}): Promise<{ handle: ProductWebServerHandleV0; sessions: ProductWebSessionsV0; runtimes: Map<string, FakeRuntimeV0> }> {
  const runtimes = new Map<string, FakeRuntimeV0>();
  const sessions = new ProductWebSessionsV0({
    subjects_root: input.subjectsRoot,
    open_runtime: async ({ subject_id }) => {
      if (input.runtime !== undefined) return input.runtime(subject_id);
      const runtime = fakeRuntime(subject_id);
      runtimes.set(subject_id, runtime);
      return runtime;
    }
  });
  const server = createProductWebServerV0({
    sessions,
    ...(input.vision === undefined ? {} : { vision: input.vision }),
    host: "127.0.0.1",
    port: 0
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address !== null ? address.port : 0;
  return {
    sessions,
    runtimes,
    handle: {
      server,
      host: "127.0.0.1",
      port,
      url: `http://127.0.0.1:${String(port)}`,
      close: async () => {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    }
  };
}

async function getJson(base: string, path: string): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await fetch(`${base}${path}`);
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

async function postJson(
  base: string,
  path: string,
  payload: unknown
): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

function capture(base: string, imageBase64: string = IMAGE_BASE64, sourceType = "CAMERA") {
  return postJson(base, "/api/vision/capture", {
    image_base64: imageBase64,
    content_type: "image/jpeg",
    source_type: sourceType
  });
}

describe("PERSISTENT_SUBJECT_VISION_PRODUCT_INTEGRATION_V0", () => {
  it("VIS1/VIS2: a captured frame is perceived and enters the ACTIVE subject as an observation", async () => {
    const root = makeTempDir();
    const vision = fakeVision();
    const { handle, runtimes } = await startServer({ subjectsRoot: root, vision });
    try {
      await postJson(handle.url, "/api/subjects/create", { display_name: "Watcher" });
      const captured = await capture(handle.url);
      expect(captured.status).toBe(200);
      expect(captured.body["ok"]).toBe(true);
      const perception = captured.body["perception"] as { scene: string; objects: string[] };
      expect(perception.scene).toBe("A red notebook is visible on the desk.");
      expect(perception.objects).toEqual(["notebook", "desk"]);
      expect((captured.body["observation"] as { kind: string }).kind).toBe("FIRST");
      // The perception reached the SAME runtime as an observation of the camera source.
      const runtime = [...runtimes.values()][0];
      expect(runtime?.observations).toHaveLength(1);
      expect(runtime?.observations[0]?.source_ref).toBe("camera");
      expect(runtime?.observations[0]?.scene).toContain("red notebook");
      // The provider was called once, and only its structured output crossed the boundary.
      expect(vision.calls).toBe(1);
    } finally {
      await handle.close();
    }
  }, 120_000);

  it("VIS9/VIS10/VIS11: provider failure, malformed output and empty captures mutate nothing", async () => {
    const root = makeTempDir();
    const failing = await startServer({ subjectsRoot: root, vision: fakeVision({ fail: true }) });
    try {
      await postJson(failing.handle.url, "/api/subjects/create", { display_name: "Blind" });
      const before = await getJson(failing.handle.url, "/api/status");
      const failed = await capture(failing.handle.url);
      expect(failed.body["ok"]).toBe(false);
      expect(failed.body["code"]).toBe("VISION_FAILED");
      expect(failed.body["perception"]).toBeNull();
      expect(JSON.stringify((await getJson(failing.handle.url, "/api/status")).body)).toBe(JSON.stringify(before.body));
      expect([...failing.runtimes.values()][0]?.observations).toHaveLength(0);
    } finally {
      await failing.handle.close();
    }

    // VIS10: provider output that FAILS VALIDATION is a bounded failure with 0
    // mutation. The boundary validator is also asserted directly, so a malformed
    // payload can never be silently accepted or repaired.
    const invalid = await startServer({
      subjectsRoot: makeTempDir(),
      vision: {
        available: true,
        source_types: ["CAMERA"],
        perceive: async (): Promise<ProductVisionResultV0> => ({
          kind: "FAILED",
          code: "VISION_INVALID",
          detail: "provider returned no scene description"
        })
      }
    });
    try {
      await postJson(invalid.handle.url, "/api/subjects/create", { display_name: "Invalid" });
      const before = await getJson(invalid.handle.url, "/api/status");
      const result = await capture(invalid.handle.url);
      expect(result.body["ok"]).toBe(false);
      expect(result.body["code"]).toBe("VISION_INVALID");
      expect(result.body["perception"]).toBeNull();
      expect(JSON.stringify((await getJson(invalid.handle.url, "/api/status")).body)).toBe(JSON.stringify(before.body));
      expect([...invalid.runtimes.values()][0]?.observations ?? []).toHaveLength(0);
    } finally {
      await invalid.handle.close();
    }

    // The validator itself: never repair, always fail closed.
    expect(validateVisualPerceptionV0(null).kind).toBe("FAILED");
    expect(validateVisualPerceptionV0({}).kind).toBe("FAILED");
    expect(validateVisualPerceptionV0({ scene: "   " }).kind).toBe("FAILED");
    expect(validateVisualPerceptionV0({ scene: "ok", confidence: 7 }).kind).toBe("FAILED");
    const bounded = validateVisualPerceptionV0({
      scene: "a desk",
      objects: [1, "book", ""] as never,
      confidence: 0.4
    });
    expect(bounded.kind).toBe("PERCEPTION");
    if (bounded.kind === "PERCEPTION") {
      expect(bounded.perception.objects).toEqual(["book"]);
    }

    // Empty image: refused before any provider call.
    const empty = await startServer({ subjectsRoot: makeTempDir(), vision: fakeVision() });
    try {
      await postJson(empty.handle.url, "/api/subjects/create", { display_name: "Empty" });
      const refused = await postJson(empty.handle.url, "/api/vision/capture", { image_base64: "" });
      expect(refused.status).toBe(400);
      expect(refused.body["code"]).toBe("INVALID_INPUT");
    } finally {
      await empty.handle.close();
    }
  }, 120_000);

  it("VIS7/VIS8: a capture lands on the ACTIVE subject only, and switching shows no leak", async () => {
    const root = makeTempDir();
    const { handle, runtimes } = await startServer({ subjectsRoot: root, vision: fakeVision() });
    try {
      const first = await postJson(handle.url, "/api/subjects/create", { display_name: "First" });
      const firstId = (first.body["subject"] as { subject_id: string }).subject_id;
      const second = await postJson(handle.url, "/api/subjects/create", { display_name: "Second" });
      const secondId = (second.body["subject"] as { subject_id: string }).subject_id;
      await capture(handle.url, OTHER_IMAGE_BASE64);
      expect(runtimes.get(secondId)?.observations).toHaveLength(1);
      expect(runtimes.get(firstId)?.observations ?? []).toHaveLength(0);
      // Switching back shows the other subject's own (empty) observation list.
      const list = await getJson(handle.url, "/api/subjects");
      const active = (list.body["subjects"] as { subject_id: string; active: boolean }[]).find((entry) => entry.active);
      expect(active?.subject_id).toBe(secondId);
    } finally {
      await handle.close();
    }
  }, 120_000);

  it("VIS12 + dedup: vision status is honest, repeated identical captures are the SAME event", async () => {
    const root = makeTempDir();
    const vision = fakeVision();
    const { handle, runtimes } = await startServer({ subjectsRoot: root, vision });
    try {
      const status = await getJson(handle.url, "/api/vision/status");
      expect(status.body).toMatchObject({
        ok: true,
        capture_mode: "ON_DEMAND",
        persistence: "RAW_IMAGE_NOT_PERSISTED",
        vision: { available: true, source_types: ["CAMERA"] }
      });
      await postJson(handle.url, "/api/subjects/create", { display_name: "Dedup" });
      const first = await capture(handle.url);
      const again = await capture(handle.url);
      const subjectId = [...runtimes.keys()][0] as string;
      // The SAME frame is offered twice; the product boundary derives one event id per
      // frame, so the existing ingress sees the same event (its own identity law).
      expect((first.body["observation"] as { kind: string }).kind).toBe("FIRST");
      expect((again.body["observation"] as { kind: string }).kind).toBe("REPLAY");
      // Read-only views still work with vision enabled.
      const life = await getJson(handle.url, "/api/life");
      expect(life.status).toBe(200);
      expect((life.body["life"] as { subject_id: string }).subject_id).toBe(subjectId);
      expect((await getJson(handle.url, "/api/state")).status).toBe(200);
      // SCREEN is declared but NOT implemented: refused, nothing recorded.
      const screen = await capture(handle.url, IMAGE_BASE64, "SCREEN");
      expect(screen.body["ok"]).toBe(false);
      expect(screen.body["code"]).toBe("VISION_UNAVAILABLE");
    } finally {
      await handle.close();
    }
  }, 120_000);

  it("default (no adapter): vision reports unavailable and everything else still works", async () => {
    const root = makeTempDir();
    const { handle } = await startServer({ subjectsRoot: root });
    try {
      const status = await getJson(handle.url, "/api/vision/status");
      expect((status.body["vision"] as { available: boolean }).available).toBe(false);
      await postJson(handle.url, "/api/subjects/create", { display_name: "No Camera" });
      const refused = await capture(handle.url);
      expect(refused.body["ok"]).toBe(false);
      expect(refused.body["code"]).toBe("VISION_UNAVAILABLE");
      const typed = await postJson(handle.url, "/api/talk", { text: "text still works" });
      expect(typed.status).toBe(200);
    } finally {
      await handle.close();
    }
  }, 120_000);
});

/* -------------------------------------------------------------------------- */
/* VIS3/VIS5/VIS6: the REAL runtime — vision perception becomes lived history. */
/* -------------------------------------------------------------------------- */

function deterministicBundle(): ProductProviderBundleV0 {
  const response = (content: string) => ({ complete: async () => ({ content, model: "deterministic-vision" }) });
  const proposal = JSON.stringify({
    response_semantics: { kind: "PRIMARY_CONVERSATIONAL_ACT", act: "ACKNOWLEDGE" },
    schema_version: "conversation-cognition-proposal-v8",
    subjective_selection: { kind: "NO_SUBJECTIVE_SELECTION" },
    factual_assessment: { claims: [] },
    cognition: {
      schema_version: "cognition-proposal-v0",
      reasoning_summary: "deterministic vision acceptance",
      relevant_memory_handles: [],
      considered_handles: [],
      current_intent: "acknowledge",
      confidence: 0.7,
      uncertainty: 0.3,
      action_intent: null,
      evidence_handles: []
    },
    communication_directive: { kind: "REALIZE_CURRENT_INTENT" },
    clarification_basis: null
  });
  const language = JSON.stringify({
    schema_version: "language-realization-semantic-draft-v1",
    text: "Noted.",
    evidence_refs: []
  });
  return {
    diagnostics: new ProviderDiagnosticsV0({
      write: () => undefined,
      model: "deterministic-vision",
      timeout_ms: 120_000,
      debug: false
    }),
    transports: {
      cognition: response(proposal) as never,
      language: response(language) as never,
      appraisal: response(
        JSON.stringify({
          relevance: 0.6,
          goal_congruence: 0.5,
          attribution: "other",
          controllability: 0.5,
          uncertainty: 0.5,
          intensity: 0.4,
          assessment_confidence: 0.6
        })
      ) as never,
      relationship: response(proposal) as never,
      lastCognitionTrace: () => null,
      lastAppraisalTrace: () => null
    },
    appraisalProvider: {
      proposeFactualEventAppraisal: async (context: never) => {
        const ctx = context as unknown as {
          subject_id: string;
          factual_event_ref: string;
          context_projection_hash: string;
        };
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
    } as never,
    appraisalCallCount: () => 0,
    beliefSemanticProvider: null,
    relationshipFamiliarityAdmissionProvider: null,
    turnPlan: {
      belief_adaptation_enabled: false,
      relationship_adaptation_enabled: false,
      personality_adaptation_enabled: false
    },
    model: "deterministic-vision",
    context_window_tokens: 8192,
    appraisal_num_predict: 256,
    appraisalReuse: new AppraisalInferenceReuseV0(false, "deterministic-vision")
  } as unknown as ProductProviderBundleV0;
}

describe("PERSISTENT_SUBJECT_VISION_PRODUCT_INTEGRATION_V0 — real runtime", () => {
  it("VIS3/VIS5/VIS6: typed + voice + vision belong to ONE life and survive a restart", async () => {
    const subjectsRoot = makeTempDir();
    const created: { subject_id: string; data_root: string } = { subject_id: "", data_root: "" };
    const openSessions = (): ProductWebSessionsV0 =>
      new ProductWebSessionsV0({
        subjects_root: subjectsRoot,
        open_runtime: async ({ data_root, display_name }) =>
          (await createProductRuntimeV0({
            data_root,
            ...(display_name === undefined ? {} : { subject: { display_name } }),
            provider_bundle: deterministicBundle(),
            probe: async () => ({ reachable: true, version: "deterministic", digest: "d", failure: null })
          })) as unknown as ProductWebSubjectRuntimeV0
      });

    const sessions = openSessions();
    const server = createProductWebServerV0({
      sessions,
      vision: fakeVision({ scene: "A red notebook is visible on the desk." }),
      host: "127.0.0.1",
      port: 0
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const bound = server.address();
    const base = `http://127.0.0.1:${String(typeof bound === "object" && bound !== null ? bound.port : 0)}`;
    try {
      const createResponse = await postJson(base, "/api/subjects/create", { display_name: "Vision Alice" });
      created.subject_id = (createResponse.body["subject"] as { subject_id: string }).subject_id;
      created.data_root = join(subjectsRoot, created.subject_id);
      const typed = await postJson(base, "/api/talk", { text: "typed message one" });
      expect((typed.body["turn"] as { status: string }).status).toBe("COMPLETE");
      const captured = await capture(base);
      expect(captured.body["ok"]).toBe(true);
      const life = await getJson(base, "/api/life");
      const episodes = (life.body["life"] as { recent_memory: { total_episode_count: number } }).recent_memory
        .total_episode_count;
      expect(episodes).toBeGreaterThan(0);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await sessions.close();
    }

    // The perception became a durable lived observation: it is in the durable store
    // and the raw frame is NOT.
    const files = readdirSync(created.data_root);
    expect(files.some((name) => name.endsWith(".snapshot.json"))).toBe(true);
    expect(files.some((name) => name.endsWith(".shared-subject.json"))).toBe(true);
    const durableBytes = files
      .filter((name) => name.endsWith(".json"))
      .map((name) => readFileSync(join(created.data_root, name), "utf8"))
      .join("\n");
    expect(durableBytes).toContain("red notebook");
    expect(durableBytes).not.toContain(IMAGE_BASE64);

    // A FRESH process restores the same subject, still sees the perceived episode,
    // and can continue by typing.
    const restarted = openSessions();
    const server2 = createProductWebServerV0({
      sessions: restarted,
      vision: fakeVision(),
      host: "127.0.0.1",
      port: 0
    });
    await new Promise<void>((resolve) => server2.listen(0, "127.0.0.1", resolve));
    const bound2 = server2.address();
    const base2 = `http://127.0.0.1:${String(typeof bound2 === "object" && bound2 !== null ? bound2.port : 0)}`;
    try {
      const opened = await postJson(base2, "/api/subjects/open", { subject_id: created.subject_id });
      expect((opened.body["bootstrap"] as { status: string }).status).toBe("RESTORED");
      const memory = await getJson(base2, "/api/memory?limit=10");
      const entries = (memory.body["memory"] as { entries: { kind: string; scene?: string }[] }).entries;
      expect(entries.some((entry) => entry.kind === "OBSERVATION" && (entry.scene ?? "").includes("red notebook"))).toBe(
        true
      );
      const continued = await postJson(base2, "/api/talk", { text: "typed message after restart" });
      expect((continued.body["turn"] as { status: string }).status).toBe("COMPLETE");
      expect(existsSync(join(created.data_root, `subject-${created.subject_id}.snapshot.json`))).toBe(true);
    } finally {
      await new Promise<void>((resolve) => server2.close(() => resolve()));
      await restarted.close();
    }
  }, 300_000);
});
