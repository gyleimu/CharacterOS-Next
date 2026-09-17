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
  ProviderProgressEventV0
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
