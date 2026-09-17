/**
 * CHARACTEROS_VISUAL_PRODUCT_LOCAL_WEB_V0 — local HTTP product API + static UI.
 *
 * A bounded, local-only Node server over the sandbox public product boundary:
 *   GET  /api/bootstrap   minimum initial view (identity, continuity, provider, life/state)
 *   GET  /api/status      structured product status
 *   GET  /api/state       read-only canonical state projection
 *   GET  /api/memory      recent lived Memory (bounded limit)
 *   POST /api/talk        one serialized human turn (structured result)
 *   GET  /api/events      SSE provider/turn progress (same diagnostics truth)
 *   GET  /api/health      liveness only (never a model call)
 *   GET  /, /app.js, /styles.css  the framework-free browser UI
 *
 * The server exposes NO commit internals, authority/capability tokens, raw
 * SubjectState mutators, provider prompts, Memory payloads, or filesystem
 * access. It binds to 127.0.0.1 by default and serves only an allowlist of
 * static files. It is a consumer of frozen product services, not an authority.
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  InteractiveSubjectStatusV0,
  InstrumentedTurnResultV0,
  LivedMemoryInspectionV0,
  ProductCanonicalTimeResultV0,
  ProductConfigViewV0,
  ProductEnvironmentResultV0,
  ProductLifeViewV0,
  ProductObservationFieldsV0,
  ProductObservationOutcomeV0,
  ProductRuntimeBootstrapV0,
  ProductDiagnosticsViewV0,
  ProductStateViewV0,
  ProductTurnResultV0,
  ProductTurnTranscriptRowV0,
  ProductVoicePortsV0,
  ProviderProgressEventV0,
  VisualPerceptionPortV0
} from "@characteros-next/sandbox";
import {
  PRODUCT_VISION_NEUTRAL_ENTITY_V0,
  PRODUCT_VOICE_MAX_SPEAK_CHARS_V0,
  deriveVisionCaptureEventIdV0,
  unavailableVisualPerceptionPortV0,
  unavailableVoicePortsV0
} from "@characteros-next/sandbox";

export const WEB_DEFAULT_HOST_V0 = "127.0.0.1";
export const WEB_DEFAULT_PORT_V0 = 4173;
export const WEB_MAX_BODY_BYTES_V0 = 64 * 1024;
export const WEB_MAX_TEXT_LENGTH_V0 = 8000;
export const WEB_DEFAULT_MEMORY_LIMIT_V0 = 10;
export const WEB_MAX_MEMORY_LIMIT_V0 = 100;
export const WEB_MAX_ENVIRONMENT_INTERACTIONS_V0 = 100;
export const WEB_MAX_CANONICAL_TICKS_V0 = 1_000_000;
export const WEB_MAX_OBSERVATION_FIELD_V0 = 200;
export const WEB_MAX_OBSERVATION_SCENE_V0 = 2000;
/**
 * What a DEGRADED turn may be spoken as: the host's ONE fixed safe line. Never
 * the model's rejected output, never a retry attempt, never internal detail.
 */
export const DEGRADED_SPEAK_TEXT_V0 =
  "I could not form a reliable reply to that just now. Nothing about our conversation was changed - please say it again.";
/** Voice requests carry base64 audio inside the JSON body; bound it explicitly. */
export const WEB_MAX_VOICE_BODY_BYTES_V0 = 12 * 1024 * 1024;

/** The narrow product surface the visual client needs (satisfied by ProductRuntimeV0). */
export interface ProductWebRuntimePortV0 {
  bootstrap(): Promise<ProductRuntimeBootstrapV0>;
  status(): Promise<InteractiveSubjectStatusV0>;
  stateView(): Promise<ProductStateViewV0>;
  lifeView(): Promise<ProductLifeViewV0>;
  livedMemory(limit?: number): Promise<LivedMemoryInspectionV0>;
  submitHumanText(text: string): Promise<InstrumentedTurnResultV0>;
  summarizeTurn(result: InstrumentedTurnResultV0): ProductTurnResultV0;
  subscribe(listener: (event: ProviderProgressEventV0) => void): () => void;
  // CHARACTEROS_VISUAL_PRODUCT_WORLD_AND_DIAGNOSTICS_DRAWER_V0 — bounded World /
  // Settings read-and-act operations over already-frozen product services.
  submitExternalObservation(fields: ProductObservationFieldsV0): Promise<ProductObservationOutcomeV0>;
  runEnvironmentInteraction(count: number): Promise<ProductEnvironmentResultV0>;
  advanceCanonicalTime(ticks: number): Promise<ProductCanonicalTimeResultV0>;
  configView(): ProductConfigViewV0;
  diagnosticsView(): ProductDiagnosticsViewV0 | null;
}

export interface ProductWebServerOptionsV0 {
  /** A single fixed subject (legacy single-runtime launch and existing tests). */
  readonly runtime?: ProductWebRuntimePortV0;
  /**
   * PERSISTENT_LIVING_SUBJECT_PRODUCT_EXPERIENCE_V0 — the multi-subject session port
   * the visual product uses. Exactly one of `runtime` / `sessions` is required; a
   * fixed runtime is adapted to the same port, so request handling has ONE path.
   */
  readonly sessions?: ProductWebSessionsPortV0;
  /**
   * VOICE MODALITY: injected speech ports. Omitted ⇒ the shipped default
   * (unavailable): voice input reports a bounded error and text keeps working.
   */
  readonly voice?: ProductVoicePortsV0;
  /**
   * VISION MODALITY: an injected visual perception port. Omitted ⇒ the shipped
   * default (unavailable): camera capture reports a bounded error and nothing else
   * changes. Raw frames are never persisted.
   */
  readonly vision?: VisualPerceptionPortV0;
  /** Static UI directory; defaults to the package's `public/`. */
  readonly static_root?: string;
  readonly host?: string;
  readonly port?: number;
}

export interface ProductWebSubjectSummaryViewV0 {
  readonly subject_id: string;
  readonly display_name: string;
  readonly durable_state: "NONE" | "PRESENT" | "UNKNOWN";
  readonly active: boolean;
  readonly openable: boolean;
}

/**
 * The subject-session port the server talks to. `ProductWebSessionsV0` implements it
 * over real product runtimes; a single fixed runtime is adapted with
 * `fixedProductWebSessionsV0`.
 */
export interface ProductWebSessionsPortV0 {
  /** True when a runtime is bound to an OPEN subject (never throws). */
  hasActive(): boolean;
  list(): readonly ProductWebSubjectSummaryViewV0[];
  activeSummary(): ProductWebSubjectSummaryViewV0 | null;
  current(): ProductWebRuntimePortV0;
  open(subjectId: string): Promise<ProductWebSubjectSummaryViewV0>;
  create(displayName: string): Promise<ProductWebSubjectSummaryViewV0>;
  transcript(limit?: number): readonly ProductTurnTranscriptRowV0[];
  recordTurn(
    subjectId: string,
    turn: {
      readonly turn_index: number;
      readonly status: "COMPLETE" | "FAILED" | "DEGRADED";
      readonly user_text: string;
      readonly subject_text: string;
      readonly failure_detail: string | null;
      readonly input_mode?: "typed" | "voice" | undefined;
      readonly state_revision_after: number;
      readonly repository_revision_after: string;
    }
  ): void;
}

/** Adapts ONE runtime to the session port: create/open report the fixed subject. */
export function fixedProductWebSessionsV0(fixed: ProductWebRuntimePortV0): ProductWebSessionsPortV0 {
  let summary: ProductWebSubjectSummaryViewV0 | null = null;
  const ensure = async (): Promise<ProductWebSubjectSummaryViewV0> => {
    if (summary === null) {
      const bootstrap = await fixed.bootstrap();
      summary = {
        subject_id: bootstrap.identity.subject_id,
        display_name: bootstrap.identity.display_name,
        durable_state: bootstrap.status === "RESTORED" ? "PRESENT" : "NONE",
        active: true,
        openable: false
      };
    }
    return { ...summary, active: true };
  };
  return {
    hasActive: () => true,
    list: () => (summary === null ? [] : [summary]),
    activeSummary: () => summary,
    current: () => fixed,
    open: async () => ensure(),
    create: async () => ensure(),
    transcript: () => [],
    recordTurn: () => undefined
  };
}

export interface ProductWebServerHandleV0 {
  readonly server: Server;
  readonly host: string;
  readonly port: number;
  readonly url: string;
  close(): Promise<void>;
}

interface StaticFileV0 {
  readonly file: string;
  readonly content_type: string;
}

/** Explicit static allowlist: no request path is ever used as a filesystem path. */
const STATIC_FILES_V0: ReadonlyMap<string, StaticFileV0> = new Map([
  ["/", { file: "index.html", content_type: "text/html; charset=utf-8" }],
  ["/index.html", { file: "index.html", content_type: "text/html; charset=utf-8" }],
  ["/app.js", { file: "app.js", content_type: "text/javascript; charset=utf-8" }],
  ["/styles.css", { file: "styles.css", content_type: "text/css; charset=utf-8" }]
]);

function sendJsonV0(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    "cache-control": "no-store"
  });
  res.end(payload);
}

function sendErrorV0(res: ServerResponse, status: number, code: string, message: string, detail?: string): void {
  sendJsonV0(res, status, {
    ok: false,
    code,
    message,
    ...(detail === undefined ? {} : { detail })
  });
}

async function readBoundedBodyV0(
  req: IncomingMessage,
  maxBytes: number
): Promise<{ readonly kind: "BODY"; readonly text: string } | { readonly kind: "TOO_LARGE" }> {
  return await new Promise((resolvePromise, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let tooLarge = false;
    req.on("data", (chunk: Buffer) => {
      // Bound memory: once over the limit, discard the rest instead of buffering
      // or destroying the socket, so the client can still read the 413 response.
      if (tooLarge) return;
      size += chunk.length;
      if (size > maxBytes) {
        tooLarge = true;
        chunks.length = 0;
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (tooLarge) resolvePromise({ kind: "TOO_LARGE" });
      else resolvePromise({ kind: "BODY", text: Buffer.concat(chunks).toString("utf8") });
    });
    req.on("error", reject);
  });
}

/** Reads the bounded structured-observation form fields (types/lengths only). */
function readObservationFieldsV0(
  record: Record<string, unknown>
): { readonly ok: true; readonly fields: ProductObservationFieldsV0 } | { readonly ok: false; readonly detail: string } {
  const keys = ["source", "event", "entities", "scene", "task", "focus", "environment"] as const;
  const fields: Record<string, string | undefined> = {};
  for (const key of keys) {
    const value = record[key];
    if (value === undefined || value === null) continue;
    if (typeof value !== "string") {
      return { ok: false, detail: `${key} must be a string.` };
    }
    const max = key === "scene" ? WEB_MAX_OBSERVATION_SCENE_V0 : WEB_MAX_OBSERVATION_FIELD_V0;
    if (value.length > max) {
      return { ok: false, detail: `${key} must be at most ${max} characters.` };
    }
    fields[key] = value;
  }
  return { ok: true, fields };
}

/**
 * Maps a thrown product-authority error onto the bounded API error shape.
 * No stack traces, no internal transition detail.
 */
function sendProductErrorV0(res: ServerResponse, error: unknown, fallbackMessage: string): void {
  const code = (error as { code?: unknown } | null)?.code;
  const detail = error instanceof Error ? error.message : String(error);
  if (typeof code === "string" && code.includes("NO_SUBJECT")) {
    sendErrorV0(
      res,
      409,
      "NO_SUBJECT",
      "This subject has no durable life yet — send it one message first.",
      detail
    );
    return;
  }
  if (typeof code === "string" && code.includes("INVALID")) {
    sendErrorV0(res, 400, "INVALID_INPUT", "The product refused this request as invalid.", detail);
    return;
  }
  sendErrorV0(res, 503, "RUNTIME_UNAVAILABLE", fallbackMessage, detail);
}

function parseMemoryLimitV0(raw: string | null): number | null {
  if (raw === null) return WEB_DEFAULT_MEMORY_LIMIT_V0;
  if (!/^[0-9]+$/.test(raw)) return null;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > WEB_MAX_MEMORY_LIMIT_V0) return null;
  return parsed;
}

/**
 * Builds (but does not listen on) the local product server. Tests start it on an
 * ephemeral port; `launch.ts` starts it on the bounded default.
 */
export function createProductWebServerV0(options: ProductWebServerOptionsV0): Server {
  if (options.sessions === undefined && options.runtime === undefined) {
    throw new Error("createProductWebServerV0 requires either a runtime or a sessions port");
  }
  const sessions: ProductWebSessionsPortV0 =
    options.sessions ?? fixedProductWebSessionsV0(options.runtime as ProductWebRuntimePortV0);
  // VOICE MODALITY: ports only. Never a startup blocker, never subject state.
  const voice: ProductVoicePortsV0 = options.voice ?? unavailableVoicePortsV0();
  // VISION MODALITY: ports only. A perception is a candidate that enters the SAME
  // structured-observation ingress the World panel uses; the provider is never an
  // authority and raw frames are never persisted.
  const vision: VisualPerceptionPortV0 = options.vision ?? unavailableVisualPerceptionPortV0();
  const runtime = (): ProductWebRuntimePortV0 => sessions.current();
  const staticRoot = options.static_root ?? fileURLToPath(new URL("../public", import.meta.url));
  const sseClients = new Set<ServerResponse>();

  // The progress stream follows the ACTIVE subject: opening another subject
  // re-subscribes, so a client never sees another subject's stages.
  let unsubscribeProgress: () => void = () => undefined;
  const subscribeActive = (): void => {
    unsubscribeProgress();
    if (!sessions.hasActive()) return;
    unsubscribeProgress = runtime().subscribe((event: ProviderProgressEventV0) => {
      const frame = `data: ${JSON.stringify(event)}\n\n`;
      for (const client of [...sseClients]) {
        try {
          client.write(frame);
        } catch {
          sseClients.delete(client);
        }
      }
    });
  };
  subscribeActive();

  /** Every subject-scoped route requires an OPEN subject; none yields a bounded 409. */
  const requireRuntimeV0 = (res: ServerResponse): ProductWebRuntimePortV0 | null => {
    if (!sessions.hasActive()) {
      sendErrorV0(res, 409, "NO_SUBJECT_OPEN", "No subject is open yet — create one or open an existing one first.");
      return null;
    }
    return runtime();
  };

  const server = createServer((req, res) => {
    res.on("close", () => {
      sseClients.delete(res);
    });
    void handleRequestV0(req, res).catch((error: unknown) => {
      if (res.headersSent) {
        res.end();
        return;
      }
      sendErrorV0(
        res,
        500,
        "INTERNAL",
        "The local product failed to handle the request.",
        error instanceof Error ? error.message : undefined
      );
    });
  });

  server.on("close", () => {
    unsubscribeProgress();
    for (const client of [...sseClients]) {
      try {
        client.end();
      } catch {
        // Closing an already-broken client is not an error.
      }
    }
    sseClients.clear();
  });

  async function handleRequestV0(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const method = req.method ?? "GET";
    const url = new URL(req.url ?? "/", `http://${options.host ?? WEB_DEFAULT_HOST_V0}`);
    const pathname = url.pathname;

    // ---- static UI (allowlist; no traversal surface exists) --------------------
    if (!pathname.startsWith("/api/")) {
      if (method !== "GET" && method !== "HEAD") {
        sendErrorV0(res, 405, "METHOD_NOT_ALLOWED", `${method} is not allowed for ${pathname}.`);
        return;
      }
      const entry = STATIC_FILES_V0.get(pathname);
      if (entry === undefined) {
        sendErrorV0(res, 404, "NOT_FOUND", `No local product asset at ${pathname}.`);
        return;
      }
      let content: Buffer;
      try {
        content = await readFile(join(staticRoot, entry.file));
      } catch {
        sendErrorV0(res, 500, "STATIC_UNAVAILABLE", `The local product asset ${entry.file} is missing.`);
        return;
      }
      res.writeHead(200, {
        "content-type": entry.content_type,
        "content-length": content.length,
        "cache-control": "no-store"
      });
      if (method === "HEAD") res.end();
      else res.end(content);
      return;
    }

    if (method !== "GET" && method !== "POST") {
      sendErrorV0(res, 405, "METHOD_NOT_ALLOWED", `${method} is not allowed for ${pathname}.`);
      return;
    }

    if (pathname === "/api/health") {
      if (method !== "GET") {
        sendErrorV0(res, 405, "METHOD_NOT_ALLOWED", "Health is read-only.");
        return;
      }
      sendJsonV0(res, 200, { ok: true, status: "ok" });
      return;
    }

    if (pathname === "/api/events") {
      if (method !== "GET") {
        sendErrorV0(res, 405, "METHOD_NOT_ALLOWED", "The progress stream is read-only.");
        return;
      }
      res.writeHead(200, {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-store",
        connection: "keep-alive"
      });
      res.write(": connected\n\n");
      sseClients.add(res);
      return;
    }

    if (pathname === "/api/bootstrap") {
      if (method !== "GET") {
        sendErrorV0(res, 405, "METHOD_NOT_ALLOWED", "Bootstrap is read-only.");
        return;
      }
      const bootstrapRuntime = requireRuntimeV0(res);
      if (bootstrapRuntime === null) return;
      sendJsonV0(res, 200, { ok: true, bootstrap: await bootstrapRuntime.bootstrap() });
      return;
    }

    if (pathname === "/api/subjects") {
      if (method !== "GET") {
        sendErrorV0(res, 405, "METHOD_NOT_ALLOWED", "The subject list is read-only.");
        return;
      }
      // The LIST works with no subject open (that is the create-first UX). When a
      // subject IS open, its truth comes from the running runtime, never from the
      // directory scan alone.
      if (!sessions.hasActive()) {
        sendJsonV0(res, 200, { ok: true, subjects: sessions.list(), active_subject_id: null });
        return;
      }
      const activeRuntime = runtime();
      const activeBootstrap = await activeRuntime.bootstrap();
      const activeId = activeBootstrap.identity.subject_id;
      const subjects = sessions.list().map((summary) =>
        summary.subject_id === activeId ? { ...summary, active: true } : summary
      );
      const known = subjects.some((summary) => summary.subject_id === activeId);
      sendJsonV0(res, 200, {
        ok: true,
        subjects: known
          ? subjects
          : [...subjects, { subject_id: activeId, display_name: activeBootstrap.identity.display_name, durable_state: activeBootstrap.status === "RESTORED" ? "PRESENT" : "NONE", active: true, openable: false }],
        active_subject_id: activeId
      });
      return;
    }

    if (pathname === "/api/subjects/create" || pathname === "/api/subjects/open") {
      if (method !== "POST") {
        sendErrorV0(res, 405, "METHOD_NOT_ALLOWED", "Subject management requires POST.");
        return;
      }
      const body = await readBoundedBodyV0(req, WEB_MAX_BODY_BYTES_V0);
      if (body.kind === "TOO_LARGE") {
        sendErrorV0(res, 413, "BODY_TOO_LARGE", `Request body exceeds ${WEB_MAX_BODY_BYTES_V0} bytes.`);
        return;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(body.text);
      } catch {
        sendErrorV0(res, 400, "INVALID_JSON", "Request body must be a JSON object.");
        return;
      }
      const field = pathname === "/api/subjects/create" ? "display_name" : "subject_id";
      const raw = typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>)[field] : null;
      if (typeof raw !== "string" || raw.trim().length === 0) {
        sendErrorV0(res, 400, "INVALID_INPUT", `A non-empty ${field} is required.`);
        return;
      }
      try {
        const summary = pathname === "/api/subjects/create" ? await sessions.create(raw) : await sessions.open(raw);
        subscribeActive();
        const switchedRuntime = requireRuntimeV0(res);
        if (switchedRuntime === null) return;
        sendJsonV0(res, 200, { ok: true, subject: summary, bootstrap: await switchedRuntime.bootstrap() });
      } catch (error) {
        sendProductErrorV0(res, error, "The subject could not be opened.");
      }
      return;
    }

    if (pathname === "/api/life") {
      if (method !== "GET") {
        sendErrorV0(res, 405, "METHOD_NOT_ALLOWED", "The life view is read-only.");
        return;
      }
      const lifeRuntime = requireRuntimeV0(res);
      if (lifeRuntime === null) return;
      sendJsonV0(res, 200, { ok: true, life: await lifeRuntime.lifeView() });
      return;
    }

    if (pathname === "/api/transcript") {
      if (method !== "GET") {
        sendErrorV0(res, 405, "METHOD_NOT_ALLOWED", "The transcript is read-only.");
        return;
      }
      const transcriptLimit = parseMemoryLimitV0(url.searchParams.get("limit"));
      if (transcriptLimit === null) {
        sendErrorV0(res, 400, "INVALID_LIMIT", `limit must be an integer between 1 and ${WEB_MAX_MEMORY_LIMIT_V0}.`);
        return;
      }
      const transcriptRuntime = requireRuntimeV0(res);
      if (transcriptRuntime === null) return;
      sendJsonV0(res, 200, { ok: true, turns: sessions.transcript(transcriptLimit) });
      return;
    }

    /* ------------------------------------------------------------------ */
    /* VISION MODALITY (input only; never subject state)                   */
    /* ------------------------------------------------------------------ */

    if (pathname === "/api/vision/status") {
      if (method !== "GET") {
        sendErrorV0(res, 405, "METHOD_NOT_ALLOWED", "Vision status is read-only.");
        return;
      }
      sendJsonV0(res, 200, {
        ok: true,
        vision: { available: vision.available, source_types: vision.source_types },
        capture_mode: "ON_DEMAND",
        persistence: "RAW_IMAGE_NOT_PERSISTED"
      });
      return;
    }

    if (pathname === "/api/vision/capture") {
      if (method !== "POST") {
        sendErrorV0(res, 405, "METHOD_NOT_ALLOWED", "A capture requires POST.");
        return;
      }
      const visionRuntime = requireRuntimeV0(res);
      if (visionRuntime === null) return;
      const body = await readBoundedBodyV0(req, WEB_MAX_VOICE_BODY_BYTES_V0);
      if (body.kind === "TOO_LARGE") {
        sendErrorV0(res, 413, "BODY_TOO_LARGE", `Request body exceeds ${WEB_MAX_VOICE_BODY_BYTES_V0} bytes.`);
        return;
      }
      let payload: unknown;
      try {
        payload = JSON.parse(body.text);
      } catch {
        sendErrorV0(res, 400, "INVALID_JSON", "Request body must be a JSON object.");
        return;
      }
      const imageBase64 =
        typeof payload === "object" && payload !== null && typeof (payload as { image_base64?: unknown }).image_base64 === "string"
          ? ((payload as { image_base64: string }).image_base64 as string)
          : null;
      const rawSource =
        typeof payload === "object" && payload !== null && typeof (payload as { source_type?: unknown }).source_type === "string"
          ? ((payload as { source_type: string }).source_type as string).toUpperCase()
          : "CAMERA";
      const contentType =
        typeof payload === "object" && payload !== null && typeof (payload as { content_type?: unknown }).content_type === "string"
          ? ((payload as { content_type: string }).content_type as string)
          : "image/jpeg";
      if (imageBase64 === null || imageBase64.length === 0) {
        sendErrorV0(res, 400, "INVALID_INPUT", "A non-empty image_base64 field is required.");
        return;
      }
      if (rawSource !== "CAMERA" && rawSource !== "SCREEN") {
        sendErrorV0(res, 400, "INVALID_INPUT", "source_type must be CAMERA (SCREEN is not implemented).");
        return;
      }
      if (!vision.source_types.includes(rawSource)) {
        sendJsonV0(res, 200, {
          ok: false,
          code: "VISION_UNAVAILABLE",
          message: `${rawSource} perception is not implemented in this product build.`,
          detail: null,
          perception: null,
          observation: null
        });
        return;
      }
      let image: Uint8Array;
      try {
        image = new Uint8Array(Buffer.from(imageBase64, "base64"));
      } catch {
        sendErrorV0(res, 400, "INVALID_INPUT", "image_base64 could not be decoded.");
        return;
      }
      // A perception candidate, not truth: a failure here mutates NOTHING.
      const perceived = await vision.perceive({ image, content_type: contentType, source_type: rawSource });
      if (perceived.kind === "FAILED") {
        sendJsonV0(res, 200, {
          ok: false,
          code: perceived.code,
          message: "This frame was not perceived; the subject was not shown anything.",
          detail: perceived.detail,
          perception: null,
          observation: null
        });
        return;
      }
      const scene = perceived.perception.scene.slice(0, WEB_MAX_OBSERVATION_SCENE_V0);
      const focus = perceived.perception.objects.concat(perceived.perception.visible_text).join(", ");
      // The EXISTING product observation boundary builds and validates the request;
      // the runtime fails closed on anything unlawful, so nothing is bypassed here.
      const fields = {
        source: rawSource === "CAMERA" ? "camera" : "screen",
        // Content-derived: the SAME frame is the SAME event, so the existing ingress
        // answers REPLAY instead of duplicating lived history.
        event: deriveVisionCaptureEventIdV0(image),
        // NO identity inference: the scene itself is the only entity this slice names.
        entities: PRODUCT_VISION_NEUTRAL_ENTITY_V0,
        scene,
        task: "Observe the current situation.",
        ...(focus.trim().length === 0 ? {} : { focus: focus.slice(0, WEB_MAX_OBSERVATION_SCENE_V0) })
      };
      try {
        const observation = await visionRuntime.submitExternalObservation(fields);
        sendJsonV0(res, 200, { ok: true, perception: perceived.perception, observation });
      } catch (error) {
        sendProductErrorV0(res, error, "The perception could not be recorded as an observation.");
      }
      return;
    }

    /* ------------------------------------------------------------------ */
    /* VOICE MODALITY (input/output only; never subject state)             */
    /* ------------------------------------------------------------------ */

    if (pathname === "/api/voice/status") {
      if (method !== "GET") {
        sendErrorV0(res, 405, "METHOD_NOT_ALLOWED", "Voice status is read-only.");
        return;
      }
      sendJsonV0(res, 200, {
        ok: true,
        stt: { available: voice.stt.available },
        tts: { available: voice.tts.available },
        persistence: "RAW_AUDIO_NOT_PERSISTED"
      });
      return;
    }

    if (pathname === "/api/voice/turn") {
      if (method !== "POST") {
        sendErrorV0(res, 405, "METHOD_NOT_ALLOWED", "A voice turn requires POST.");
        return;
      }
      const voiceRuntime = requireRuntimeV0(res);
      if (voiceRuntime === null) return;
      const body = await readBoundedBodyV0(req, WEB_MAX_VOICE_BODY_BYTES_V0);
      if (body.kind === "TOO_LARGE") {
        sendErrorV0(res, 413, "BODY_TOO_LARGE", `Request body exceeds ${WEB_MAX_BODY_BYTES_V0} bytes.`);
        return;
      }
      let payload: unknown;
      try {
        payload = JSON.parse(body.text);
      } catch {
        sendErrorV0(res, 400, "INVALID_JSON", "Request body must be a JSON object.");
        return;
      }
      const audioBase64 =
        typeof payload === "object" && payload !== null && typeof (payload as { audio_base64?: unknown }).audio_base64 === "string"
          ? ((payload as { audio_base64: string }).audio_base64 as string)
          : null;
      const contentType =
        typeof payload === "object" && payload !== null && typeof (payload as { content_type?: unknown }).content_type === "string"
          ? ((payload as { content_type: string }).content_type as string)
          : "audio/webm";
      if (audioBase64 === null || audioBase64.length === 0) {
        sendErrorV0(res, 400, "INVALID_INPUT", "A non-empty audio_base64 field is required.");
        return;
      }
      let audio: Uint8Array;
      try {
        audio = new Uint8Array(Buffer.from(audioBase64, "base64"));
      } catch {
        sendErrorV0(res, 400, "INVALID_INPUT", "audio_base64 could not be decoded.");
        return;
      }
      // STT is a user-input CANDIDATE: a failure here mutates NOTHING.
      const transcribed = await voice.stt.transcribe({ audio, content_type: contentType });
      if (transcribed.kind === "FAILED") {
        sendJsonV0(res, 200, {
          ok: false,
          code: transcribed.code,
          message: "The recording could not be transcribed; the subject was not asked anything.",
          detail: transcribed.detail,
          turn: null,
          transcription: null
        });
        return;
      }
      const text = transcribed.text.trim();
      if (text.length === 0 || text.length > WEB_MAX_TEXT_LENGTH_V0) {
        sendJsonV0(res, 200, {
          ok: false,
          code: "STT_EMPTY",
          message: "The transcription was empty; the subject was not asked anything.",
          detail: null,
          turn: null,
          transcription: null
        });
        return;
      }
      try {
        // The SAME typed path: one subject, one life, one transcript.
        const result = await voiceRuntime.submitHumanText(text);
        const turn = voiceRuntime.summarizeTurn(result);
        sessions.recordTurn(turn.subject_id, {
          turn_index: turn.turn_index,
          status: turn.status,
          user_text: text,
          subject_text: turn.reply_text ?? "",
          failure_detail: turn.failure_detail,
          input_mode: "voice",
          state_revision_after: turn.state_revision_after,
          repository_revision_after: turn.repository_revision_after
        });
        // TTS input is ALWAYS the final delivered text (or the fixed safe line).
        const speakText =
          turn.status === "COMPLETE" && typeof turn.reply_text === "string" && turn.reply_text.length > 0
            ? turn.reply_text
            : turn.status === "DEGRADED"
              ? DEGRADED_SPEAK_TEXT_V0
              : null;
        sendJsonV0(res, 200, { ok: true, transcription: text, turn, speak_text: speakText });
      } catch (error) {
        sendErrorV0(
          res,
          503,
          "RUNTIME_UNAVAILABLE",
          "The subject runtime cannot accept a new turn.",
          error instanceof Error ? error.message : undefined
        );
      }
      return;
    }

    if (pathname === "/api/voice/speak") {
      if (method !== "POST") {
        sendErrorV0(res, 405, "METHOD_NOT_ALLOWED", "Speech synthesis requires POST.");
        return;
      }
      const speakRuntime = requireRuntimeV0(res);
      if (speakRuntime === null) return;
      const body = await readBoundedBodyV0(req, WEB_MAX_VOICE_BODY_BYTES_V0);
      if (body.kind === "TOO_LARGE") {
        sendErrorV0(res, 413, "BODY_TOO_LARGE", `Request body exceeds ${WEB_MAX_BODY_BYTES_V0} bytes.`);
        return;
      }
      let payload: unknown;
      try {
        payload = JSON.parse(body.text);
      } catch {
        sendErrorV0(res, 400, "INVALID_JSON", "Request body must be a JSON object.");
        return;
      }
      const text =
        typeof payload === "object" && payload !== null && typeof (payload as { text?: unknown }).text === "string"
          ? ((payload as { text: string }).text as string)
          : null;
      if (text === null || text.trim().length === 0) {
        sendErrorV0(res, 400, "INVALID_INPUT", "A non-empty text field is required.");
        return;
      }
      const spoken = await voice.tts.synthesize({ text: text.slice(0, PRODUCT_VOICE_MAX_SPEAK_CHARS_V0) });
      if (spoken.kind === "FAILED") {
        sendJsonV0(res, 200, {
          ok: false,
          code: spoken.code,
          message: "This reply could not be spoken; the reply itself is unchanged.",
          detail: spoken.detail
        });
        return;
      }
      sendJsonV0(res, 200, {
        ok: true,
        audio_base64: Buffer.from(spoken.audio).toString("base64"),
        content_type: spoken.content_type
      });
      return;
    }

    if (pathname === "/api/status") {
      if (method !== "GET") {
        sendErrorV0(res, 405, "METHOD_NOT_ALLOWED", "Status is read-only.");
        return;
      }
      const statusRuntime = requireRuntimeV0(res);
      if (statusRuntime === null) return;
      sendJsonV0(res, 200, { ok: true, status: await statusRuntime.status() });
      return;
    }

    if (pathname === "/api/state") {
      if (method !== "GET") {
        sendErrorV0(res, 405, "METHOD_NOT_ALLOWED", "State is read-only.");
        return;
      }
      const stateRuntime = requireRuntimeV0(res);
      if (stateRuntime === null) return;
      sendJsonV0(res, 200, { ok: true, view: await stateRuntime.stateView() });
      return;
    }

    if (pathname === "/api/memory") {
      if (method !== "GET") {
        sendErrorV0(res, 405, "METHOD_NOT_ALLOWED", "Memory is read-only.");
        return;
      }
      const limit = parseMemoryLimitV0(url.searchParams.get("limit"));
      if (limit === null) {
        sendErrorV0(
          res,
          400,
          "INVALID_LIMIT",
          `limit must be an integer between 1 and ${WEB_MAX_MEMORY_LIMIT_V0}.`
        );
        return;
      }
      const memoryRuntime = requireRuntimeV0(res);
      if (memoryRuntime === null) return;
      sendJsonV0(res, 200, { ok: true, memory: await memoryRuntime.livedMemory(limit) });
      return;
    }

    if (pathname === "/api/config") {
      if (method !== "GET") {
        sendErrorV0(res, 405, "METHOD_NOT_ALLOWED", "Configuration is read-only.");
        return;
      }
      const configRuntime = requireRuntimeV0(res);
      if (configRuntime === null) return;
      sendJsonV0(res, 200, { ok: true, config: configRuntime.configView() });
      return;
    }

    if (pathname === "/api/diagnostics") {
      if (method !== "GET") {
        sendErrorV0(res, 405, "METHOD_NOT_ALLOWED", "Diagnostics are read-only.");
        return;
      }
      const diagnosticsRuntime = requireRuntimeV0(res);
      if (diagnosticsRuntime === null) return;
      sendJsonV0(res, 200, { ok: true, diagnostics: diagnosticsRuntime.diagnosticsView() });
      return;
    }

    if (pathname === "/api/observation" || pathname === "/api/environment" || pathname === "/api/time") {
      if (method !== "POST") {
        sendErrorV0(res, 405, "METHOD_NOT_ALLOWED", `${pathname} requires POST.`);
        return;
      }
      const body = await readBoundedBodyV0(req, WEB_MAX_BODY_BYTES_V0);
      if (body.kind === "TOO_LARGE") {
        sendErrorV0(res, 413, "BODY_TOO_LARGE", `Request body exceeds ${WEB_MAX_BODY_BYTES_V0} bytes.`);
        return;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(body.text);
      } catch {
        sendErrorV0(res, 400, "INVALID_JSON", "Request body must be a JSON object.");
        return;
      }
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        sendErrorV0(res, 400, "INVALID_JSON", "Request body must be a JSON object.");
        return;
      }
      const record = parsed as Record<string, unknown>;

      if (pathname === "/api/observation") {
        const fields = readObservationFieldsV0(record);
        if (!fields.ok) {
          sendErrorV0(res, 400, "INVALID_INPUT", fields.detail);
          return;
        }
        const observationRuntime = requireRuntimeV0(res);
        if (observationRuntime === null) return;
        let outcome: ProductObservationOutcomeV0;
        try {
          outcome = await observationRuntime.submitExternalObservation(fields.fields);
        } catch (error) {
          sendProductErrorV0(res, error, "The external observation could not be recorded.");
          return;
        }
        if (outcome.kind === "INVALID") {
          sendErrorV0(res, 400, "INVALID_INPUT", outcome.detail);
          return;
        }
        sendJsonV0(res, 200, { ok: true, outcome });
        return;
      }

      if (pathname === "/api/environment") {
        const count = record["count"];
        if (
          typeof count !== "number" ||
          !Number.isSafeInteger(count) ||
          count < 1 ||
          count > WEB_MAX_ENVIRONMENT_INTERACTIONS_V0
        ) {
          sendErrorV0(res, 400, "INVALID_COUNT", `count must be an integer between 1 and ${WEB_MAX_ENVIRONMENT_INTERACTIONS_V0}.`);
          return;
        }
        const environmentRuntime = requireRuntimeV0(res);
        if (environmentRuntime === null) return;
        let run: ProductEnvironmentResultV0;
        try {
          run = await environmentRuntime.runEnvironmentInteraction(count);
        } catch (error) {
          sendProductErrorV0(res, error, "The environment interaction could not run.");
          return;
        }
        sendJsonV0(res, 200, { ok: true, environment: run });
        return;
      }

      const ticks = record["ticks"];
      if (
        typeof ticks !== "number" ||
        !Number.isSafeInteger(ticks) ||
        ticks < 0 ||
        ticks > WEB_MAX_CANONICAL_TICKS_V0
      ) {
        sendErrorV0(
          res,
          400,
          "INVALID_TICKS",
          `ticks must be a non-negative integer (canonical ticks) up to ${WEB_MAX_CANONICAL_TICKS_V0}.`
        );
        return;
      }
      const timeRuntime = requireRuntimeV0(res);
      if (timeRuntime === null) return;
      let advanced: ProductCanonicalTimeResultV0;
      try {
        advanced = await timeRuntime.advanceCanonicalTime(ticks);
      } catch (error) {
        sendProductErrorV0(res, error, "Canonical time could not be advanced.");
        return;
      }
      sendJsonV0(res, 200, { ok: true, time: advanced });
      return;
    }

    if (pathname === "/api/talk") {
      if (method !== "POST") {
        sendErrorV0(res, 405, "METHOD_NOT_ALLOWED", "Talk requires POST.");
        return;
      }
      const body = await readBoundedBodyV0(req, WEB_MAX_BODY_BYTES_V0);
      if (body.kind === "TOO_LARGE") {
        sendErrorV0(res, 413, "BODY_TOO_LARGE", `Request body exceeds ${WEB_MAX_BODY_BYTES_V0} bytes.`);
        return;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(body.text);
      } catch {
        sendErrorV0(res, 400, "INVALID_JSON", "Request body must be a JSON object.");
        return;
      }
      const text =
        typeof parsed === "object" && parsed !== null && typeof (parsed as { text?: unknown }).text === "string"
          ? ((parsed as { text: string }).text as string)
          : null;
      if (text === null || text.trim().length === 0) {
        sendErrorV0(res, 400, "INVALID_INPUT", "A non-empty text field is required.");
        return;
      }
      if (text.length > WEB_MAX_TEXT_LENGTH_V0) {
        sendErrorV0(res, 400, "INVALID_INPUT", `Text must be at most ${WEB_MAX_TEXT_LENGTH_V0} characters.`);
        return;
      }
      try {
        const talkRuntime = requireRuntimeV0(res);
        if (talkRuntime === null) return;
        const result = await talkRuntime.submitHumanText(text);
        const turn = talkRuntime.summarizeTurn(result);
        // Thin product transcript: the conversation VIEW only, appended for the
        // subject that produced this turn. Never identity or state authority.
        sessions.recordTurn(turn.subject_id, {
          turn_index: turn.turn_index,
          status: turn.status,
          user_text: text,
          subject_text: turn.reply_text ?? "",
          failure_detail: turn.failure_detail,
          state_revision_after: turn.state_revision_after,
          repository_revision_after: turn.repository_revision_after
        });
        sendJsonV0(res, 200, { ok: true, turn });
      } catch (error) {
        sendErrorV0(
          res,
          503,
          "RUNTIME_UNAVAILABLE",
          "The subject runtime cannot accept a new turn.",
          error instanceof Error ? error.message : undefined
        );
      }
      return;
    }

    sendErrorV0(res, 404, "NOT_FOUND", `No product API route at ${pathname}.`);
  }

  return server;
}

/** Starts the local product server on 127.0.0.1 (bounded default port). */
export async function startProductWebServerV0(
  options: ProductWebServerOptionsV0
): Promise<ProductWebServerHandleV0> {
  const host = options.host ?? WEB_DEFAULT_HOST_V0;
  const port = options.port ?? WEB_DEFAULT_PORT_V0;
  const server = createProductWebServerV0({ ...options, host, port });
  await new Promise<void>((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.removeListener("error", reject);
      resolvePromise();
    });
  });
  const address = server.address();
  const actualPort = typeof address === "object" && address !== null ? address.port : port;
  return {
    server,
    host,
    port: actualPort,
    url: `http://${host}:${actualPort}/`,
    close: async (): Promise<void> => {
      await new Promise<void>((resolvePromise) => {
        server.close(() => resolvePromise());
      });
    }
  };
}
