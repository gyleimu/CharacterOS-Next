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
  ProductStateViewV0,
  ProductTurnResultV0,
  ProviderDiagnosticsSnapshotV0,
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
  diagnosticsView(): ProviderDiagnosticsSnapshotV0 | null;
}

export interface ProductWebServerOptionsV0 {
  readonly runtime: ProductWebRuntimePortV0;
  /** Static UI directory; defaults to the package's `public/`. */
  readonly static_root?: string;
  readonly host?: string;
  readonly port?: number;
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
  const runtime = options.runtime;
  const staticRoot = options.static_root ?? fileURLToPath(new URL("../public", import.meta.url));
  const sseClients = new Set<ServerResponse>();

  const unsubscribeProgress = runtime.subscribe((event: ProviderProgressEventV0) => {
    const frame = `data: ${JSON.stringify(event)}\n\n`;
    for (const client of [...sseClients]) {
      try {
        client.write(frame);
      } catch {
        sseClients.delete(client);
      }
    }
  });

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
      sendJsonV0(res, 200, { ok: true, bootstrap: await runtime.bootstrap() });
      return;
    }

    if (pathname === "/api/status") {
      if (method !== "GET") {
        sendErrorV0(res, 405, "METHOD_NOT_ALLOWED", "Status is read-only.");
        return;
      }
      sendJsonV0(res, 200, { ok: true, status: await runtime.status() });
      return;
    }

    if (pathname === "/api/state") {
      if (method !== "GET") {
        sendErrorV0(res, 405, "METHOD_NOT_ALLOWED", "State is read-only.");
        return;
      }
      sendJsonV0(res, 200, { ok: true, view: await runtime.stateView() });
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
      sendJsonV0(res, 200, { ok: true, memory: await runtime.livedMemory(limit) });
      return;
    }

    if (pathname === "/api/config") {
      if (method !== "GET") {
        sendErrorV0(res, 405, "METHOD_NOT_ALLOWED", "Configuration is read-only.");
        return;
      }
      sendJsonV0(res, 200, { ok: true, config: runtime.configView() });
      return;
    }

    if (pathname === "/api/diagnostics") {
      if (method !== "GET") {
        sendErrorV0(res, 405, "METHOD_NOT_ALLOWED", "Diagnostics are read-only.");
        return;
      }
      sendJsonV0(res, 200, { ok: true, diagnostics: runtime.diagnosticsView() });
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
        let outcome: ProductObservationOutcomeV0;
        try {
          outcome = await runtime.submitExternalObservation(fields.fields);
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
        let run: ProductEnvironmentResultV0;
        try {
          run = await runtime.runEnvironmentInteraction(count);
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
      let advanced: ProductCanonicalTimeResultV0;
      try {
        advanced = await runtime.advanceCanonicalTime(ticks);
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
        const result = await runtime.submitHumanText(text);
        sendJsonV0(res, 200, { ok: true, turn: runtime.summarizeTurn(result) });
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
