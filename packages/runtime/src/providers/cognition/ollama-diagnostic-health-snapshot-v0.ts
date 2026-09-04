/**
 * Ollama Diagnostic Health Snapshot V0 — diagnostic-only local state probe
 * (OLLAMA_COGNITION_TRANSPORT_INSTRUMENTATION_V0).
 *
 * Captures the LOCAL side of a diagnostic reproduction WITHOUT any inference
 * call: the Ollama server's own state endpoints (`GET /api/version`,
 * `GET /api/ps`) plus the host Node process's resource state. Strictly
 * diagnostic metadata — never canonical state, never cognition proposal, never
 * behavior evidence, never persistence authority, never experiment protocol.
 *
 * Never throws: every probe failure is recorded inside the snapshot
 * (`probe_errors`, bounded copy) so a broken local Ollama is itself diagnostic
 * signal. Each probe is independently timeout-bounded. No prompt, no model
 * call, no mutation: pure GET observation.
 */

export const OLLAMA_DIAGNOSTIC_HEALTH_SNAPSHOT_SCHEMA_VERSION_V0 =
  "ollama-diagnostic-health-snapshot-v0" as const;

/** Default per-probe timeout for the two state GETs (ms). */
export const OLLAMA_DIAGNOSTIC_HEALTH_PROBE_TIMEOUT_MS = 5_000;

/** One loaded-model entry from Ollama's `GET /api/ps` (bounded field read). */
export interface OllamaDiagnosticLoadedModelV0 {
  readonly name: string | null;
  readonly model: string | null;
  readonly size_bytes: number | null;
  readonly size_vram_bytes: number | null;
}

/** Ollama server-side state (version + currently loaded models). */
export interface OllamaDiagnosticServerStateV0 {
  readonly reachable: boolean;
  readonly version: string | null;
  readonly loaded_models: readonly OllamaDiagnosticLoadedModelV0[];
}

/** Host Node process resource state at capture time. */
export interface OllamaDiagnosticProcessStateV0 {
  readonly platform: string;
  readonly node_version: string;
  readonly process_rss_bytes: number;
  readonly heap_used_bytes: number;
  readonly heap_total_bytes: number;
  readonly uptime_seconds: number;
}

/** Complete local diagnostic snapshot for one reproduction run moment. */
export interface OllamaDiagnosticHealthSnapshotV0 {
  readonly schema_version: typeof OLLAMA_DIAGNOSTIC_HEALTH_SNAPSHOT_SCHEMA_VERSION_V0;
  readonly captured_at: string;
  readonly base_url: string;
  readonly server: OllamaDiagnosticServerStateV0;
  readonly process: OllamaDiagnosticProcessStateV0;
  readonly probe_errors: readonly string[];
}

/** Explicit host-owned probe configuration. No ambient defaults, no env magic. */
export interface OllamaDiagnosticHealthSnapshotConfigV0 {
  /** Ollama-native base URL, e.g. "http://127.0.0.1:11434". */
  readonly base_url: string;
  /** Per-probe GET timeout in ms (both probes share it). */
  readonly probe_timeout_ms?: number;
}

const MAX_PROBE_ERRORS = 16;

function boundedErrorCopy(error: unknown): string {
  const raw = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return raw.slice(0, 512);
}

async function getJson(
  url: string,
  timeoutMs: number
): Promise<{ ok: true; body: unknown } | { ok: false; error: unknown; status: number | null }> {
  try {
    const response = await fetch(url, { method: "GET", signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) return { ok: false, error: new Error(`HTTP ${response.status}`), status: response.status };
    return { ok: true, body: await response.json() };
  } catch (error) {
    return { ok: false, error, status: null };
  }
}

function readLoadedModels(body: unknown): readonly OllamaDiagnosticLoadedModelV0[] {
  if (body === null || typeof body !== "object") return [];
  const models = (body as { models?: unknown }).models;
  if (!Array.isArray(models)) return [];
  return models.map((entry) => {
    const record = (entry ?? {}) as {
      name?: unknown;
      model?: unknown;
      size?: unknown;
      size_vram?: unknown;
    };
    return {
      name: typeof record.name === "string" ? record.name : null,
      model: typeof record.model === "string" ? record.model : null,
      size_bytes: typeof record.size === "number" ? record.size : null,
      size_vram_bytes: typeof record.size_vram === "number" ? record.size_vram : null
    };
  });
}

/**
 * Capture one local diagnostic health snapshot. Never throws; probes are
 * independent and each failure degrades that probe only. No inference call is
 * ever made and nothing outside this process/server is observed.
 */
export async function captureOllamaDiagnosticHealthSnapshotV0(
  config: OllamaDiagnosticHealthSnapshotConfigV0
): Promise<OllamaDiagnosticHealthSnapshotV0> {
  const probeTimeoutMs = config.probe_timeout_ms ?? OLLAMA_DIAGNOSTIC_HEALTH_PROBE_TIMEOUT_MS;
  const base = config.base_url.replace(/\/$/, "");
  const probeErrors: string[] = [];

  const version = await getJson(`${base}/api/version`, probeTimeoutMs);
  let serverVersion: string | null = null;
  if (version.ok) {
    const candidate = (version.body as { version?: unknown } | null)?.version;
    serverVersion = typeof candidate === "string" ? candidate : null;
  } else {
    probeErrors.push(`GET /api/version: ${boundedErrorCopy(version.error)}`);
  }

  const ps = await getJson(`${base}/api/ps`, probeTimeoutMs);
  let loadedModels: readonly OllamaDiagnosticLoadedModelV0[] = [];
  if (ps.ok) {
    loadedModels = readLoadedModels(ps.body);
  } else {
    probeErrors.push(`GET /api/ps: ${boundedErrorCopy(ps.error)}`);
  }

  const memory = process.memoryUsage();
  const snapshot: OllamaDiagnosticHealthSnapshotV0 = {
    schema_version: OLLAMA_DIAGNOSTIC_HEALTH_SNAPSHOT_SCHEMA_VERSION_V0,
    captured_at: new Date().toISOString(),
    base_url: config.base_url,
    server: {
      reachable: version.ok && ps.ok,
      version: serverVersion,
      loaded_models: loadedModels
    },
    process: {
      platform: process.platform,
      node_version: process.version,
      process_rss_bytes: memory.rss,
      heap_used_bytes: memory.heapUsed,
      heap_total_bytes: memory.heapTotal,
      uptime_seconds: process.uptime()
    },
    probe_errors: Object.freeze(probeErrors.slice(0, MAX_PROBE_ERRORS))
  };
  return Object.freeze(snapshot);
}
