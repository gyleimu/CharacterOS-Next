/**
 * PERSISTENT_LIVING_SUBJECT_PRODUCT_EXPERIENCE_V0 — product acceptance (P1–P10).
 *
 * Drives the REAL local product stack: subject sessions over per-subject data roots,
 * the HTTP product server, the durable operational transcript, and — for the restart
 * case — an actual runtime built by `createProductRuntimeV0` over the same root.
 *
 * 0 model calls: the deterministic turn cases use a durable fake runtime; the
 * restart case uses the real runtime with injected deterministic transports.
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  AppraisalInferenceReuseV0,
  ProviderDiagnosticsV0,
  createProductRuntimeV0,
  type ProductProviderBundleV0
} from "@characteros-next/sandbox";
import { createProductWebServerV0, type ProductWebServerHandleV0 } from "./server.js";
import { ProductWebSessionsV0, type ProductWebSubjectRuntimeV0 } from "./sessions.js";

const tempDirs: string[] = [];
function makeTempDir(): string {
  // A bounded local base (no node:os import needed; the product-web import
  // allowlist covers node:fs/path only).
  const base = join(process.cwd(), "tmp", "web-product-acceptance");
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

/** Minimal durable-ish fake runtime: records turns, keeps canonical-looking views. */
function fakeRuntime(subjectId: string, root: string): ProductWebSubjectRuntimeV0 & { turns: number } {
  let turns = 0;
  let restored = existsSync(join(root, `subject-${subjectId}.snapshot.json`));
  const state: Record<string, unknown> = { turns };
  const bootstrap = () => ({
    identity: { subject_id: subjectId, display_name: subjectId, identity_anchors: [] },
    status: restored ? "RESTORED" : "NEW",
    created_this_start: !restored,
    provider: { ready: true, model: "fake", endpoint: "http://127.0.0.1:11434", timeout_ms: 120000 },
    logical_time: turns,
    affect: { valence: 0, activation: 0.5 },
    revisions: { state_revision: turns + 1, repository_revision: `R${turns}`, shared_revision: turns + 1 },
    state: {
      schema_version: "interactive-subject-state-view-v0",
      identity: { subject_id: subjectId, display_name: subjectId, identity_anchors: [] },
      logical_time: turns,
      state_revision: turns + 1,
      repository_revision: `R${turns}`,
      affect: { valence: 0, activation: 0.5 },
      regulation: { energy: 1, stress: 0, arousal: 0.5, fatigue: 0 },
      personality: [],
      traits_seed: {},
      beliefs: [],
      relationships: []
    },
    recent_memory: {
      schema_version: "lived-memory-inspection-v0",
      repository_revision: `R${turns}`,
      total_episode_count: turns,
      displayed_count: turns,
      entries: []
    }
  });
  void state;
  return {
    turns: 0,
    bootstrap: async () => bootstrap() as never,
    status: async () =>
      ({
        subject_id: subjectId,
        origin: restored ? "SUBJECT_RESTORED" : "NEW_SUBJECT_CREATED",
        logical_time: turns,
        state_revision: turns + 1,
        repository_revision: `R${turns}`,
        turn_index: turns
      }) as never,
    stateView: async () => ({ status: {}, state: bootstrap().state, shared_revision: turns + 1 }) as never,
    lifeView: async () =>
      ({
        subject_id: subjectId,
        display_name: subjectId,
        origin: restored ? "SUBJECT_RESTORED" : "NEW_SUBJECT",
        logical_time: turns,
        state_revision: turns + 1,
        repository_revision: `R${turns}`,
        shared_revision: turns + 1,
        affect: { valence: 0, activation: 0.5 },
        regulation: { energy: 1, stress: 0, arousal: 0.5, fatigue: 0 },
        personality: [],
        beliefs: [],
        relationships: [],
        recent_memory: bootstrap().recent_memory,
        evolution: {
          schema_version: "subject-evolution-view-v0",
          subject: { subject_id: subjectId, state_revision: turns + 1, logical_time: turns, repository_revision: `R${turns}` },
          recent_lived_events: [],
          durable_effects: { affect: [], belief: [] },
          current: {
            affect: { valence: 0, activation: 0.5 },
            regulation: { energy: 1, stress: 0, arousal: 0.5, fatigue: 0 },
            beliefs: [],
            relationships: [],
            personality: [],
            memory: { total_episode_count: turns, repository_revision: `R${turns}` }
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
    submitHumanText: async (text: string) => {
      turns += 1;
      restored = true;
      return {
        outcome: {
          status: "COMPLETE",
          subject_text: `reply ${turns} to: ${text}`,
          turn_index: turns - 1,
          subject_id: subjectId,
          user_text: text,
          repository_revision_after: `R${turns}`,
          state_revision_after: turns + 1,
          failure: null
        },
        elapsed_ms: 5
      } as never;
    },
    summarizeTurn: (result: { outcome: { subject_text: string; turn_index: number } }) => ({
      status: "COMPLETE",
      reply_text: result.outcome.subject_text,
      turn_index: result.outcome.turn_index,
      subject_id: subjectId,
      completed_prior_outcome: null,
      language_call_required: true,
      elapsed_ms: 5,
      repository_revision_after: `R${turns}`,
      state_revision_after: turns + 1,
      failure_detail: null,
      failure: null
    }),
    subscribe: () => () => undefined,
    submitExternalObservation: async () => ({ kind: "FIRST", observation_ref: "observation:x", episode_ref: "episode:x", base_revision: turns }) as never,
    runEnvironmentInteraction: async () => ({ status: "COMPLETE" }) as never,
    advanceCanonicalTime: async (ticks: number) => ({ ticks, no_op: false }) as never,
    configView: () => ({ executor: { effective: "ollama", requested: "auto", reason: "fake", credential_present: false }, model: { value: "fake", source: "DEFAULT", origin: "fake" }, endpoint: { value: "http://127.0.0.1:11434", source: "DEFAULT", origin: "fake" }, timeout_ms: { value: "120000", source: "DEFAULT", origin: "fake" }, context_window_tokens: { value: "8192", source: "DEFAULT", origin: "fake" }, num_predict: { value: "2048", source: "DEFAULT", origin: "fake" }, data_root: { value: root, source: "DEFAULT", origin: "fake" }, subject: { subject_id: subjectId, display_name: subjectId, identity_source: "DEFAULT", identity_origin: "fake", durable_state: "UNKNOWN" }, data_root_contains: [], appraisal_exact_input_reuse: { value: "off", source: "DEFAULT", origin: "fake" }, read_only: true }) as never,
    diagnosticsView: () => null,
    shutdown: async () => undefined
  } as unknown as ProductWebSubjectRuntimeV0 & { turns: number };
}

async function startFakeProductServer(subjectsRoot: string): Promise<{ handle: ProductWebServerHandleV0; sessions: ProductWebSessionsV0 }> {
  const sessions = new ProductWebSessionsV0({
    subjects_root: subjectsRoot,
    open_runtime: async ({ subject_id, data_root }) => fakeRuntime(subject_id, data_root)
  });
  const server = createProductWebServerV0({ sessions, host: "127.0.0.1", port: 0 });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address !== null ? address.port : 0;
  return {
    sessions,
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

async function postJson(base: string, path: string, payload: unknown): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

describe("PERSISTENT_LIVING_SUBJECT_PRODUCT_EXPERIENCE_V0", () => {
  it("P1/P2: subjects can be created, listed and opened; a new subject takes turns", async () => {
    const root = makeTempDir();
    const { handle } = await startFakeProductServer(root);
    try {
      // P1: create two subjects through the product API.
      const created = await postJson(handle.url, "/api/subjects/create", { display_name: "Mira" });
      expect(created.status).toBe(200);
      const mira = (created.body["subject"] as { subject_id: string; display_name: string }).subject_id;
      expect(mira.length).toBeGreaterThan(0);
      const second = await postJson(handle.url, "/api/subjects/create", { display_name: "Kestrel" });
      expect(second.status).toBe(200);
      const kestrel = (second.body["subject"] as { subject_id: string }).subject_id;
      expect(kestrel).not.toBe(mira);

      const listed = await getJson(handle.url, "/api/subjects");
      const subjects = listed.body["subjects"] as { subject_id: string; active: boolean }[];
      expect(subjects.map((entry) => entry.subject_id).sort()).toEqual([kestrel, mira].sort());
      expect(subjects.filter((entry) => entry.active)).toHaveLength(1);

      // P2: talking works on the ACTIVE subject only.
      const talk = await postJson(handle.url, "/api/talk", { text: "hello there" });
      expect(talk.status).toBe(200);
      expect((talk.body["turn"] as { status: string }).status).toBe("COMPLETE");

      // Opening the other subject switches the active one.
      const opened = await postJson(handle.url, "/api/subjects/open", { subject_id: mira });
      expect(opened.status).toBe(200);
      const relisted = await getJson(handle.url, "/api/subjects");
      const activeAfter = (relisted.body["subjects"] as { subject_id: string; active: boolean }[]).find(
        (entry) => entry.active
      );
      expect(activeAfter?.subject_id).toBe(mira);
    } finally {
      await handle.close();
    }
  }, 120_000);

  it("P3/P4/P7: state and life panels read the ACTIVE subject and never leak across subjects", async () => {
    const root = makeTempDir();
    const { handle } = await startFakeProductServer(root);
    try {
      const first = await postJson(handle.url, "/api/subjects/create", { display_name: "Alpha" });
      const alpha = (first.body["subject"] as { subject_id: string }).subject_id;
      await postJson(handle.url, "/api/talk", { text: "alpha message" });

      const life = await getJson(handle.url, "/api/life");
      expect(life.status).toBe(200);
      const lifeView = life.body["life"] as { subject_id: string; evolution: { subject: { subject_id: string } } };
      expect(lifeView.subject_id).toBe(alpha);
      expect(lifeView.evolution.subject.subject_id).toBe(alpha);

      const second = await postJson(handle.url, "/api/subjects/create", { display_name: "Beta" });
      const beta = (second.body["subject"] as { subject_id: string }).subject_id;
      await postJson(handle.url, "/api/talk", { text: "beta message" });

      // P7: after switching, the transcript and life view belong to Beta only.
      const transcript = await getJson(handle.url, "/api/transcript?limit=10");
      const turns = transcript.body["turns"] as { subject_id: string; user_text: string }[];
      expect(turns.length).toBeGreaterThan(0);
      expect(turns.every((turn) => turn.subject_id === beta)).toBe(true);
      expect(JSON.stringify(turns)).not.toContain("alpha message");
      const lifeBeta = await getJson(handle.url, "/api/life");
      expect((lifeBeta.body["life"] as { subject_id: string }).subject_id).toBe(beta);
    } finally {
      await handle.close();
    }
  }, 120_000);

  it("P5/P6/P8/P10: restart preserves the same subject and its transcript; failures stay safe", async () => {
    const root = makeTempDir();
    const first = await startFakeProductServer(root);
    let subjectId = "";
    try {
      const created = await postJson(first.handle.url, "/api/subjects/create", { display_name: "Continuity" });
      subjectId = (created.body["subject"] as { subject_id: string }).subject_id;
      await postJson(first.handle.url, "/api/talk", { text: "first lived message" });
      await postJson(first.handle.url, "/api/talk", { text: "second lived message" });
      const before = await getJson(first.handle.url, "/api/transcript?limit=10");
      expect((before.body["turns"] as unknown[]).length).toBe(2);
    } finally {
      await first.handle.close();
      await first.sessions.close();
    }

    // A FRESH server over the same subjects root: the subject is listed and the
    // conversation comes back from the durable operational log.
    const second = await startFakeProductServer(root);
    try {
      const listed = await getJson(second.handle.url, "/api/subjects");
      const subjects = listed.body["subjects"] as { subject_id: string }[];
      expect(subjects.map((entry) => entry.subject_id)).toContain(subjectId);
      const opened = await postJson(second.handle.url, "/api/subjects/open", { subject_id: subjectId });
      expect(opened.status).toBe(200);
      const after = await getJson(second.handle.url, "/api/transcript?limit=10");
      const turns = after.body["turns"] as { subject_id: string; user_text: string; subject_text: string }[];
      expect(turns.map((turn) => turn.user_text)).toEqual(["first lived message", "second lived message"]);
      expect(turns.every((turn) => turn.subject_id === subjectId)).toBe(true);

      // P8: a rejected turn produces a bounded error, not a crash or a fake reply.
      const empty = await postJson(second.handle.url, "/api/talk", { text: "   " });
      expect(empty.status).toBe(400);
      // P10: no secrets or prompt internals anywhere in the product payloads.
      const payloads = JSON.stringify([
        await getJson(second.handle.url, "/api/config"),
        await getJson(second.handle.url, "/api/status"),
        await getJson(second.handle.url, "/api/life"),
        after.body
      ]);
      expect(payloads).not.toMatch(/api[_-]?key|bearer|sk-[A-Za-z0-9]{8,}/i);
    } finally {
      await second.handle.close();
      await second.sessions.close();
    }
  }, 120_000);

  it("P9: reading the product views never mutates the subject", async () => {
    const root = makeTempDir();
    const { handle } = await startFakeProductServer(root);
    try {
      await postJson(handle.url, "/api/subjects/create", { display_name: "Reader" });
      await postJson(handle.url, "/api/talk", { text: "a message" });
      const beforeStatus = await getJson(handle.url, "/api/status");
      const beforeTranscript = await getJson(handle.url, "/api/transcript?limit=10");
      // Read everything twice.
      await getJson(handle.url, "/api/state");
      await getJson(handle.url, "/api/life");
      await getJson(handle.url, "/api/subjects");
      await getJson(handle.url, "/api/config");
      const afterStatus = await getJson(handle.url, "/api/status");
      const afterTranscript = await getJson(handle.url, "/api/transcript?limit=10");
      expect(JSON.stringify(afterStatus.body)).toBe(JSON.stringify(beforeStatus.body));
      expect(JSON.stringify(afterTranscript.body)).toBe(JSON.stringify(beforeTranscript.body));
    } finally {
      await handle.close();
    }
  }, 120_000);
});

/* -------------------------------------------------------------------------- */
/* The REAL runtime: one restart, with injected deterministic transports.      */
/* -------------------------------------------------------------------------- */

function deterministicBundle(): ProductProviderBundleV0 {
  const response = (content: string) => ({
    complete: async () => ({ content, model: "deterministic-product" })
  });
  const proposal = JSON.stringify({
    response_semantics: { kind: "PRIMARY_CONVERSATIONAL_ACT", act: "ACKNOWLEDGE" },
    schema_version: "conversation-cognition-proposal-v8",
    subjective_selection: { kind: "NO_SUBJECTIVE_SELECTION" },
    factual_assessment: { claims: [] },
    cognition: {
      schema_version: "cognition-proposal-v0",
      reasoning_summary: "deterministic product acceptance",
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
    text: "I remember what you told me.",
    evidence_refs: []
  });
  return {
    // The REAL diagnostics object: the product turn path uses its full surface.
    diagnostics: new ProviderDiagnosticsV0({
      write: () => undefined,
      model: "deterministic-product",
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
    model: "deterministic-product",
    context_window_tokens: 8192,
    appraisal_num_predict: 256,
    // The REAL reuse port, disabled: the frozen independent-inference path.
    appraisalReuse: new AppraisalInferenceReuseV0(false, "deterministic-product")
  } as unknown as ProductProviderBundleV0;
}

describe("PERSISTENT_LIVING_SUBJECT_PRODUCT_EXPERIENCE_V0 — real runtime restart", () => {
  it("P5/P6: the same subject is restored by a FRESH runtime and continues its life", async () => {
    const subjectsRoot = makeTempDir();
    // The subject id is DERIVED from the display name (slug + hash), so the data
    // root is resolved AFTER creation — never assumed.
    let openedId = "";
    // Resolved inside the create step; the assertions after the restart read it.
    const dataRootRef: { value: string | null } = { value: null };
    const sessions = new ProductWebSessionsV0({
      subjects_root: subjectsRoot,
      open_runtime: async ({ data_root, display_name }) =>
        (await createProductRuntimeV0({
          data_root,
          ...(display_name === undefined ? {} : { subject: { display_name } }),
          provider_bundle: deterministicBundle(),
          probe: async () => ({ reachable: true, version: "deterministic", digest: "d", failure: null })
        })) as unknown as ProductWebSubjectRuntimeV0
    });
    const server = createProductWebServerV0({ sessions, host: "127.0.0.1", port: 0 });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const boundAddress = server.address();
    const port = typeof boundAddress === "object" && boundAddress !== null ? boundAddress.port : 0;
    const base = `http://127.0.0.1:${String(port)}`;

    try {
      // ---- NEW SUBJECT, first turns ---------------------------------------
      const created = await postJson(base, "/api/subjects/create", { display_name: "Alice Product" });
      expect(created.status).toBe(200);
      openedId = (created.body["subject"] as { subject_id: string }).subject_id;
      dataRootRef.value = join(subjectsRoot, openedId);
      expect(existsSync(dataRootRef.value)).toBe(true);

      const talk1 = await postJson(base, "/api/talk", { text: "I keep a red notebook on the desk." });
      expect(talk1.status).toBe(200);
      expect((talk1.body["turn"] as { status: string }).status).toBe("COMPLETE");
      const talk2 = await postJson(base, "/api/talk", { text: "Thanks for noting that." });
      expect((talk2.body["turn"] as { status: string }).status).toBe("COMPLETE");

      const beforeState = await getJson(base, "/api/state");
      const beforeLife = await getJson(base, "/api/life");
      const beforeStatus = beforeState.body["view"] as { state: { state_revision: number } };
      expect(beforeStatus.state.state_revision).toBeGreaterThan(0);
      const lifeBefore = beforeLife.body["life"] as { recent_memory: { total_episode_count: number } };
      expect(lifeBefore.recent_memory.total_episode_count).toBeGreaterThan(0);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await sessions.close();
    }

    // ---- the durable artifacts really exist on disk -----------------------
    const dataRoot = dataRootRef.value;
    if (dataRoot === null) throw new Error("the subject data root was never resolved");
    expect(existsSync(join(dataRoot, `subject-${openedId}.snapshot.json`))).toBe(true);
    expect(readFileSync(join(dataRoot, `subject-${openedId}.interactions.jsonl`), "utf8")).toContain(
      "red notebook"
    );

    // ---- FRESH process over the same root --------------------------------
    const restarted = new ProductWebSessionsV0({
      subjects_root: subjectsRoot,
      open_runtime: async ({ data_root, display_name }) =>
        (await createProductRuntimeV0({
          data_root,
          ...(display_name === undefined ? {} : { subject: { display_name } }),
          provider_bundle: deterministicBundle(),
          probe: async () => ({ reachable: true, version: "deterministic", digest: "d", failure: null })
        })) as unknown as ProductWebSubjectRuntimeV0
    });
    const server2 = createProductWebServerV0({ sessions: restarted, host: "127.0.0.1", port: 0 });
    await new Promise<void>((resolve) => server2.listen(0, "127.0.0.1", resolve));
    const boundAddress2 = server2.address();
    const port2 = typeof boundAddress2 === "object" && boundAddress2 !== null ? boundAddress2.port : 0;
    const base2 = `http://127.0.0.1:${String(port2)}`;
    try {
      const listed = await getJson(base2, "/api/subjects");
      const entries = listed.body["subjects"] as { subject_id: string; durable_state: string }[];
      expect(entries.some((entry) => entry.subject_id === openedId && entry.durable_state === "PRESENT")).toBe(true);

      const opened = await postJson(base2, "/api/subjects/open", { subject_id: openedId });
      expect(opened.status).toBe(200);
      const bootstrap = opened.body["bootstrap"] as {
        status: string;
        identity: { subject_id: string };
        recent_memory: { total_episode_count: number };
      };
      expect(bootstrap.status).toBe("RESTORED");
      expect(bootstrap.identity.subject_id).toBe(openedId);
      expect(bootstrap.recent_memory.total_episode_count).toBeGreaterThan(0);

      // The conversation that really happened comes back from the durable log.
      const transcript = await getJson(base2, "/api/transcript?limit=10");
      const turns = transcript.body["turns"] as { user_text: string; subject_text: string }[];
      expect(turns.map((turn) => turn.user_text)).toEqual([
        "I keep a red notebook on the desk.",
        "Thanks for noting that."
      ]);
      expect(turns.every((turn) => turn.subject_text.length > 0)).toBe(true);

      // And the subject continues: a further turn advances the same lineage.
      const continued = await postJson(base2, "/api/talk", { text: "Where do I keep my notebook?" });
      expect(continued.status).toBe(200);
      expect((continued.body["turn"] as { status: string }).status).toBe("COMPLETE");
      const liveAfter = await getJson(base2, "/api/life");
      const lifeAfter = liveAfter.body["life"] as { recent_memory: { total_episode_count: number } };
      expect(lifeAfter.recent_memory.total_episode_count).toBeGreaterThan(
        (await getJson(base2, "/api/transcript?limit=1")).body["turns"] === undefined
          ? 0
          : bootstrap.recent_memory.total_episode_count
      );
    } finally {
      await new Promise<void>((resolve) => server2.close(() => resolve()));
      await restarted.close();
    }
  }, 300_000);
});
