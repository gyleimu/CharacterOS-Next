/**
 * VOICE_PRODUCT_SESSION_INTEGRATION — product acceptance (V1–V10).
 *
 * Voice is an INPUT/OUTPUT MODALITY: audio becomes text (STT), the text goes
 * through the SAME `submitHumanText` path a typed message uses, and the subject's
 * FINAL delivered text is what gets spoken (TTS). Nothing here is voice-specific
 * state, memory or authority.
 *
 * 0 model calls and 0 real audio: the speech ports are deterministic doubles and the
 * runtimes are deterministic; V4 additionally uses the REAL product runtime over a
 * real data root to prove the voice-lived history survives a restart.
 */

import { mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  AppraisalInferenceReuseV0,
  ProviderDiagnosticsV0,
  createProductRuntimeV0,
  type ProductProviderBundleV0,
  type ProductVoicePortsV0,
  type SpeechToTextPortV0,
  type SpeechToTextResultV0,
  type TextToSpeechPortV0,
  type TextToSpeechResultV0
} from "@characteros-next/sandbox";
import { createProductWebServerV0, type ProductWebServerHandleV0 } from "./server.js";
import { ProductWebSessionsV0, type ProductWebSubjectRuntimeV0 } from "./sessions.js";

const tempDirs: string[] = [];
function makeTempDir(): string {
  const base = join(process.cwd(), "tmp", "voice-acceptance");
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

/** Deterministic STT: a fixed transcript, or a bounded failure on demand. */
function fakeStt(options: { readonly transcript?: string; readonly fail?: boolean } = {}): SpeechToTextPortV0 & {
  calls: number;
} {
  const port = {
    calls: 0,
    available: true,
    transcribe: async (): Promise<SpeechToTextResultV0> => {
      port.calls += 1;
      if (options.fail === true) {
        return { kind: "FAILED", code: "STT_FAILED", detail: "deterministic STT failure" };
      }
      return { kind: "TEXT", text: options.transcript ?? "Where do I keep my notebook?" };
    }
  };
  return port as SpeechToTextPortV0 & { calls: number };
}

/** Deterministic TTS: fixed bytes, or a bounded failure on demand. */
function fakeTts(options: { readonly fail?: boolean } = {}): TextToSpeechPortV0 & {
  readonly spoken: string[];
} {
  const spoken: string[] = [];
  const port = {
    spoken,
    available: true,
    synthesize: async (input: { readonly text: string }): Promise<TextToSpeechResultV0> => {
      spoken.push(input.text);
      if (options.fail === true) {
        return { kind: "FAILED", code: "TTS_FAILED", detail: "deterministic TTS failure" };
      }
      return { kind: "AUDIO", audio: new Uint8Array([1, 2, 3, 4]), content_type: "audio/wav" };
    }
  };
  return port as TextToSpeechPortV0 & { readonly spoken: string[] };
}

const AUDIO_BASE64 = Buffer.from([9, 9, 9, 9]).toString("base64");

interface FakeRuntimeV0 extends ProductWebSubjectRuntimeV0 {
  readonly turns: { readonly text: string; readonly mode: string }[];
}

/** Minimal durable-looking runtime double that records every turn it is asked for. */
function fakeRuntime(subjectId: string, options: { readonly degraded?: boolean } = {}): FakeRuntimeV0 {
  const turns: { text: string; mode: string }[] = [];
  const bootstrap = () => ({
    identity: { subject_id: subjectId, display_name: subjectId, identity_anchors: [] },
    status: "RESTORED" as const,
    created_this_start: false,
    provider: { ready: true, model: "fake", endpoint: "http://127.0.0.1:11434", timeout_ms: 120000 },
    logical_time: turns.length,
    affect: { valence: 0, activation: 0.5 },
    revisions: { state_revision: turns.length + 1, repository_revision: `R${turns.length}`, shared_revision: 1 },
    state: {
      schema_version: "interactive-subject-state-view-v0",
      identity: { subject_id: subjectId, display_name: subjectId, identity_anchors: [] },
      logical_time: turns.length,
      state_revision: turns.length + 1,
      repository_revision: `R${turns.length}`,
      affect: { valence: 0, activation: 0.5 },
      regulation: { energy: 1, stress: 0, arousal: 0.5, fatigue: 0 },
      personality: [],
      traits_seed: {},
      beliefs: [],
      relationships: []
    },
    recent_memory: {
      schema_version: "lived-memory-inspection-v0",
      repository_revision: `R${turns.length}`,
      total_episode_count: turns.length,
      displayed_count: turns.length,
      entries: []
    }
  });
  const runtime = {
    turns,
    bootstrap: async () => bootstrap() as never,
    status: async () =>
      ({
        subject_id: subjectId,
        origin: "SUBJECT_RESTORED",
        logical_time: turns.length,
        state_revision: turns.length + 1,
        repository_revision: `R${turns.length}`,
        turn_index: turns.length
      }) as never,
    stateView: async () => ({ status: {}, state: bootstrap().state, shared_revision: 1 }) as never,
    lifeView: async () =>
      ({
        subject_id: subjectId,
        display_name: subjectId,
        origin: "SUBJECT_RESTORED",
        logical_time: turns.length,
        state_revision: turns.length + 1,
        repository_revision: `R${turns.length}`,
        shared_revision: 1,
        affect: { valence: 0, activation: 0.5 },
        regulation: { energy: 1, stress: 0, arousal: 0.5, fatigue: 0 },
        personality: [],
        beliefs: [],
        relationships: [],
        recent_memory: bootstrap().recent_memory,
        evolution: {
          schema_version: "subject-evolution-view-v0",
          subject: { subject_id: subjectId, state_revision: turns.length + 1, logical_time: turns.length, repository_revision: `R${turns.length}` },
          recent_lived_events: [],
          durable_effects: { affect: [], belief: [] },
          current: {
            affect: { valence: 0, activation: 0.5 },
            regulation: { energy: 1, stress: 0, arousal: 0.5, fatigue: 0 },
            beliefs: [],
            relationships: [],
            personality: [],
            memory: { total_episode_count: turns.length, repository_revision: `R${turns.length}` }
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
      turns.push({ text, mode: "turn" });
      const degraded = options.degraded === true;
      return {
        outcome: {
          status: degraded ? "DEGRADED" : "COMPLETE",
          subject_text: degraded ? "" : `reply to: ${text}`,
          turn_index: turns.length - 1,
          subject_id: subjectId,
          repository_revision_after: `R${turns.length}`,
          state_revision_after: turns.length + 1,
          failure: degraded ? "EXECUTOR_OUTPUT_DEGRADED: contract invalid" : null
        },
        elapsed_ms: 4
      } as never;
    },
    summarizeTurn: () => ({
      status: options.degraded === true ? ("DEGRADED" as const) : ("COMPLETE" as const),
      reply_text: options.degraded === true ? null : `reply to: ${turns[turns.length - 1]?.text ?? ""}`,
      turn_index: turns.length - 1,
      subject_id: subjectId,
      completed_prior_outcome: null,
      language_call_required: true,
      elapsed_ms: 4,
      repository_revision_after: `R${turns.length}`,
      state_revision_after: turns.length + 1,
      failure_detail: options.degraded === true ? "EXECUTOR_OUTPUT_DEGRADED: contract invalid" : null,
      failure: null
    }),
    subscribe: () => () => undefined,
    submitExternalObservation: async () => ({ kind: "FIRST", observation_ref: "observation:x", episode_ref: "episode:x", base_revision: 0 }) as never,
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
  };
  return runtime as unknown as FakeRuntimeV0;
}

async function startServer(input: {
  readonly subjectsRoot: string;
  readonly voice?: ProductVoicePortsV0;
  readonly runtime?: (subjectId: string) => ProductWebSubjectRuntimeV0;
}): Promise<{ handle: ProductWebServerHandleV0; sessions: ProductWebSessionsV0 }> {
  const sessions = new ProductWebSessionsV0({
    subjects_root: input.subjectsRoot,
    open_runtime: async ({ subject_id }) => (input.runtime ?? ((id: string) => fakeRuntime(id)))(subject_id)
  });
  const server = createProductWebServerV0({
    sessions,
    ...(input.voice === undefined ? {} : { voice: input.voice }),
    host: "127.0.0.1",
    port: 0
  });
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

describe("VOICE_PRODUCT_SESSION_INTEGRATION", () => {
  it("V1/V2/V3: a voice turn uses the SAME subject, transcript and revision lineage, in order", async () => {
    const root = makeTempDir();
    const stt = fakeStt({ transcript: "Where do I keep my notebook?" });
    const { handle } = await startServer({ subjectsRoot: root, voice: { stt, tts: fakeTts() } });
    try {
      await postJson(handle.url, "/api/subjects/create", { display_name: "Voiced" });
      // typed → voice → typed
      const typed1 = await postJson(handle.url, "/api/talk", { text: "I keep a red notebook on the desk." });
      expect(typed1.status).toBe(200);
      const voiceTurn = await postJson(handle.url, "/api/voice/turn", {
        audio_base64: AUDIO_BASE64,
        content_type: "audio/webm"
      });
      expect(voiceTurn.status).toBe(200);
      expect(voiceTurn.body["ok"]).toBe(true);
      expect(voiceTurn.body["transcription"]).toBe("Where do I keep my notebook?");
      const typed2 = await postJson(handle.url, "/api/talk", { text: "Thanks." });
      expect(typed2.status).toBe(200);

      // V2/V3: ONE transcript, correct order, modality recorded, one subject.
      const transcript = await getJson(handle.url, "/api/transcript?limit=20");
      const turns = transcript.body["turns"] as {
        user_text: string;
        subject_id: string;
        input_mode: string;
        turn_index: number;
      }[];
      expect(turns.map((turn) => turn.user_text)).toEqual([
        "I keep a red notebook on the desk.",
        "Where do I keep my notebook?",
        "Thanks."
      ]);
      expect(turns.map((turn) => turn.input_mode)).toEqual(["typed", "voice", "typed"]);
      expect(turns.map((turn) => turn.turn_index)).toEqual([0, 1, 2]);
      expect(new Set(turns.map((turn) => turn.subject_id)).size).toBe(1);
      // The voice turn reached the SAME runtime, once, with the transcription as text.
      expect((voiceTurn.body["turn"] as { status: string }).status).toBe("COMPLETE");
    } finally {
      await handle.close();
    }
  }, 120_000);

  it("V5: an STT failure asks nothing of the subject (0 mutation)", async () => {
    const root = makeTempDir();
    const { handle } = await startServer({
      subjectsRoot: root,
      voice: { stt: fakeStt({ fail: true }), tts: fakeTts() }
    });
    try {
      await postJson(handle.url, "/api/subjects/create", { display_name: "Failing STT" });
      const before = await getJson(handle.url, "/api/status");
      const beforeTranscript = await getJson(handle.url, "/api/transcript?limit=10");
      const failed = await postJson(handle.url, "/api/voice/turn", {
        audio_base64: AUDIO_BASE64,
        content_type: "audio/webm"
      });
      expect(failed.status).toBe(200);
      expect(failed.body["ok"]).toBe(false);
      expect(failed.body["code"]).toBe("STT_FAILED");
      expect(failed.body["turn"]).toBeNull();
      const after = await getJson(handle.url, "/api/status");
      const afterTranscript = await getJson(handle.url, "/api/transcript?limit=10");
      expect(JSON.stringify(after.body)).toBe(JSON.stringify(before.body));
      expect(JSON.stringify(afterTranscript.body)).toBe(JSON.stringify(beforeTranscript.body));
    } finally {
      await handle.close();
    }
  }, 120_000);

  it("V6/V7: a TTS failure keeps the committed turn; a degraded turn speaks only the safe line", async () => {
    const root = makeTempDir();
    const tts = fakeTts({ fail: true });
    const { handle } = await startServer({ subjectsRoot: root, voice: { stt: fakeStt(), tts } });
    try {
      await postJson(handle.url, "/api/subjects/create", { display_name: "Muted" });
      const voiceTurn = await postJson(handle.url, "/api/voice/turn", {
        audio_base64: AUDIO_BASE64,
        content_type: "audio/webm"
      });
      expect(voiceTurn.body["ok"]).toBe(true);
      const turn = voiceTurn.body["turn"] as { status: string; reply_text: string };
      expect(turn.status).toBe("COMPLETE");
      // The reply is the TTS input, and a failing synthesis changes nothing durable.
      expect(voiceTurn.body["speak_text"]).toBe(turn.reply_text);
      const spoken = await postJson(handle.url, "/api/voice/speak", { text: turn.reply_text });
      expect(spoken.body["ok"]).toBe(false);
      expect(spoken.body["code"]).toBe("TTS_FAILED");
      const transcript = await getJson(handle.url, "/api/transcript?limit=10");
      expect((transcript.body["turns"] as unknown[]).length).toBe(1);
    } finally {
      await handle.close();
    }

    // V7: a DEGRADED turn is spoken as the host's fixed safe line, never model output.
    const degradedRoot = makeTempDir();
    const degradedTts = fakeTts();
    const degraded = await startServer({
      subjectsRoot: degradedRoot,
      voice: { stt: fakeStt(), tts: degradedTts },
      runtime: () => fakeRuntime("degraded-subject", { degraded: true })
    });
    try {
      await postJson(degraded.handle.url, "/api/subjects/create", { display_name: "Degraded" });
      const turn = await postJson(degraded.handle.url, "/api/voice/turn", {
        audio_base64: AUDIO_BASE64,
        content_type: "audio/webm"
      });
      expect((turn.body["turn"] as { status: string }).status).toBe("DEGRADED");
      expect(typeof turn.body["speak_text"]).toBe("string");
      expect(turn.body["speak_text"]).toContain("could not form a reliable reply");
      // What is SPOKEN never carries the internal failure class or any model text;
      // the product may still report the truthful reason as a diagnostic field.
      expect(String(turn.body["speak_text"])).not.toContain("EXECUTOR_OUTPUT_DEGRADED");
      expect(String(turn.body["speak_text"])).not.toContain("contract invalid");
    } finally {
      await degraded.handle.close();
    }
  }, 120_000);

  it("V8/V9/V10: voice input lands on the ACTIVE subject only, and no secret leaks", async () => {
    const root = makeTempDir();
    const stt = fakeStt({ transcript: "voice message for whoever is active" });
    const { handle } = await startServer({ subjectsRoot: root, voice: { stt, tts: fakeTts() } });
    try {
      const first = await postJson(handle.url, "/api/subjects/create", { display_name: "First" });
      const firstId = (first.body["subject"] as { subject_id: string }).subject_id;
      const second = await postJson(handle.url, "/api/subjects/create", { display_name: "Second" });
      const secondId = (second.body["subject"] as { subject_id: string }).subject_id;
      // Voice input now belongs to the ACTIVE subject (Second), never the previous one.
      const voiceTurn = await postJson(handle.url, "/api/voice/turn", {
        audio_base64: AUDIO_BASE64,
        content_type: "audio/webm"
      });
      expect(voiceTurn.body["ok"]).toBe(true);
      const transcript = await getJson(handle.url, "/api/transcript?limit=10");
      const turns = transcript.body["turns"] as { subject_id: string; input_mode: string }[];
      expect(turns.every((turn) => turn.subject_id === secondId)).toBe(true);
      expect(turns.every((turn) => turn.subject_id !== firstId)).toBe(true);

      // Switching back keeps each lineage separate.
      await postJson(handle.url, "/api/subjects/open", { subject_id: firstId });
      const firstTranscript = await getJson(handle.url, "/api/transcript?limit=10");
      expect((firstTranscript.body["turns"] as unknown[]).length).toBe(0);

      // V10: no credential, prompt or raw audio anywhere in the payloads.
      const payloads = JSON.stringify([
        await getJson(handle.url, "/api/voice/status"),
        voiceTurn.body,
        await getJson(handle.url, "/api/config"),
        transcript.body
      ]);
      expect(payloads).not.toMatch(/api[_-]?key|bearer|authorization/i);
      expect(payloads).not.toContain(AUDIO_BASE64);
    } finally {
      await handle.close();
    }
  }, 120_000);

  it("voice status reports capability honestly and text-only keeps working", async () => {
    const root = makeTempDir();
    // Shipped default: no speech adapter at all.
    const { handle } = await startServer({ subjectsRoot: root });
    try {
      const status = await getJson(handle.url, "/api/voice/status");
      expect(status.body).toMatchObject({
        ok: true,
        stt: { available: false },
        tts: { available: false },
        persistence: "RAW_AUDIO_NOT_PERSISTED"
      });
      await postJson(handle.url, "/api/subjects/create", { display_name: "Text Only" });
      const refused = await postJson(handle.url, "/api/voice/turn", {
        audio_base64: AUDIO_BASE64,
        content_type: "audio/webm"
      });
      expect(refused.body["ok"]).toBe(false);
      expect(refused.body["code"]).toBe("STT_UNAVAILABLE");
      // Typed turns are unaffected.
      const typed = await postJson(handle.url, "/api/talk", { text: "typed still works" });
      expect(typed.status).toBe(200);
      expect((typed.body["turn"] as { status: string }).status).toBe("COMPLETE");
    } finally {
      await handle.close();
    }
  }, 120_000);
});

/* -------------------------------------------------------------------------- */
/* V4: the REAL runtime — voice-lived history survives a restart.              */
/* -------------------------------------------------------------------------- */

function deterministicBundle(): ProductProviderBundleV0 {
  const response = (content: string) => ({ complete: async () => ({ content, model: "deterministic-voice" }) });
  const proposal = JSON.stringify({
    response_semantics: { kind: "PRIMARY_CONVERSATIONAL_ACT", act: "ACKNOWLEDGE" },
    schema_version: "conversation-cognition-proposal-v8",
    subjective_selection: { kind: "NO_SUBJECTIVE_SELECTION" },
    factual_assessment: { claims: [] },
    cognition: {
      schema_version: "cognition-proposal-v0",
      reasoning_summary: "deterministic voice acceptance",
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
    text: "I remember what you said.",
    evidence_refs: []
  });
  return {
    diagnostics: new ProviderDiagnosticsV0({
      write: () => undefined,
      model: "deterministic-voice",
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
    model: "deterministic-voice",
    context_window_tokens: 8192,
    appraisal_num_predict: 256,
    appraisalReuse: new AppraisalInferenceReuseV0(false, "deterministic-voice")
  } as unknown as ProductProviderBundleV0;
}

describe("VOICE_PRODUCT_SESSION_INTEGRATION — real runtime restart", () => {
  it("V4: a voice turn becomes durable lived history and survives a fresh runtime", async () => {
    const subjectsRoot = makeTempDir();
    // Resolved in the create step; the post-restart assertions read them.
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
      voice: { stt: fakeStt({ transcript: "I keep a blue notebook in the kitchen." }), tts: fakeTts() },
      host: "127.0.0.1",
      port: 0
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const bound = server.address();
    const port = typeof bound === "object" && bound !== null ? bound.port : 0;
    const base = `http://127.0.0.1:${String(port)}`;
    try {
      const createResponse = await postJson(base, "/api/subjects/create", { display_name: "Voice Alice" });
      created.subject_id = (createResponse.body["subject"] as { subject_id: string }).subject_id;
      created.data_root = join(subjectsRoot, created.subject_id);
      const typed = await postJson(base, "/api/talk", { text: "I keep a red notebook on the desk." });
      expect((typed.body["turn"] as { status: string }).status).toBe("COMPLETE");
      const voiced = await postJson(base, "/api/voice/turn", {
        audio_base64: AUDIO_BASE64,
        content_type: "audio/webm"
      });
      expect(voiced.body["ok"]).toBe(true);
      expect((voiced.body["turn"] as { status: string }).status).toBe("COMPLETE");
      const life = await getJson(base, "/api/life");
      expect((life.body["life"] as { recent_memory: { total_episode_count: number } }).recent_memory.total_episode_count).toBeGreaterThan(0);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await sessions.close();
    }

    // The voice transcript is durable, and it says which modality produced it.
    const log = readFileSync(join(created.data_root, `subject-${created.subject_id}.interactions.jsonl`), "utf8");
    expect(log).toContain("I keep a blue notebook in the kitchen.");
    expect(log).toContain("\"input_mode\":\"voice\"");

    // A FRESH process restores the SAME subject and can be continued by typing.
    const restarted = openSessions();
    const server2 = createProductWebServerV0({ sessions: restarted, voice: { stt: fakeStt(), tts: fakeTts() }, host: "127.0.0.1", port: 0 });
    await new Promise<void>((resolve) => server2.listen(0, "127.0.0.1", resolve));
    const bound2 = server2.address();
    const port2 = typeof bound2 === "object" && bound2 !== null ? bound2.port : 0;
    const base2 = `http://127.0.0.1:${String(port2)}`;
    try {
      const opened = await postJson(base2, "/api/subjects/open", { subject_id: created.subject_id });
      expect((opened.body["bootstrap"] as { status: string }).status).toBe("RESTORED");
      const transcript = await getJson(base2, "/api/transcript?limit=10");
      const turns = transcript.body["turns"] as { user_text: string; input_mode: string }[];
      expect(turns.map((turn) => turn.user_text)).toEqual([
        "I keep a red notebook on the desk.",
        "I keep a blue notebook in the kitchen."
      ]);
      expect(turns[1]?.input_mode).toBe("voice");
      const followUp = await postJson(base2, "/api/talk", { text: "Where do I keep my notebook?" });
      expect((followUp.body["turn"] as { status: string }).status).toBe("COMPLETE");
      const life = await getJson(base2, "/api/life");
      expect((life.body["life"] as { recent_memory: { total_episode_count: number } }).recent_memory.total_episode_count).toBeGreaterThan(1);
    } finally {
      await new Promise<void>((resolve) => server2.close(() => resolve()));
      await restarted.close();
    }
  }, 300_000);
});
