/* eslint-disable no-restricted-imports -- Manual bounded local diagnostic orchestrator only. */

import { execFileSync, spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync
} from "node:fs";
import { freemem, totalmem } from "node:os";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  LlmCognitionProviderV0,
  OllamaNativeCognitionTransportV0,
  captureOllamaDiagnosticHealthSnapshotV0,
  type CognitionProposalV0,
  type ModelTransportTraceEventV0,
  type ModelTransportTraceV0
} from "../../../packages/runtime/dist/index.js";
import {
  ENVIRONMENT_RESOURCE_DIAGNOSTIC_PROTOCOL_V0,
  FROZEN_REPRESENTATIVE_REQUEST_V0,
  PRESSURE_LEVELS_V0,
  PROVIDER_LOCK_ENVIRONMENT_V0,
  frozenRepresentativeFixtureV0,
  representativeFixtureMatchesFrozenV0
} from "./protocol.ts";

const DIAGNOSTIC_DIR = fileURLToPath(new URL(".", import.meta.url));
const REPOSITORY_ROOT = resolve(DIAGNOSTIC_DIR, "../../..");
const PRESSURE_HELPER = join(DIAGNOSTIC_DIR, "pressure-helper.ts");
const EXPECTED_STARTING_HEAD = "157d9ebf84e971ee5a0dd1d93c5ee577611f0044";
const MIB = 1024 * 1024;
const FLOOR_BYTES = ENVIRONMENT_RESOURCE_DIAGNOSTIC_PROTOCOL_V0.safety_floor_mib * MIB;

interface Args {
  inspect_only: boolean;
  out: string | null;
}

interface ProviderLockRecord {
  readonly expected: typeof PROVIDER_LOCK_ENVIRONMENT_V0;
  readonly actual: { readonly version: string | null; readonly model: string; readonly digest: string | null };
  readonly version_match: boolean;
  readonly digest_match: boolean;
  readonly checked_at: string;
  readonly errors: readonly string[];
}

interface HelperEvent {
  readonly kind: string;
  readonly payload: Record<string, unknown>;
}

interface PressureSession {
  readonly child: ChildProcessWithoutNullStreams;
  readonly pid: number;
  readonly requested_mib: number;
  readonly started_at: string;
  actual_allocated_mib: number;
  readonly events: HelperEvent[];
  parent_release_reason: string | null;
  release_requested: boolean;
  exit_code: number | null;
  exit_signal: NodeJS.Signals | null;
  ended_at: string | null;
}

interface PressureIdentity {
  readonly requested_mib: number;
  readonly actual_allocated_mib: number;
  readonly pid: number | null;
  readonly alive: boolean;
}

interface SnapshotV0 {
  readonly schema_version: "ollama-environment-resource-snapshot-v0";
  readonly name: string;
  readonly level: number;
  readonly call_id: string | null;
  readonly captured_at: string;
  readonly health: Awaited<ReturnType<typeof captureOllamaDiagnosticHealthSnapshotV0>>;
  readonly memory: {
    readonly node_available_bytes: number;
    readonly total_physical_bytes: number;
    readonly windows_free_physical_bytes: number | null;
    readonly windows_total_virtual_bytes: number | null;
    readonly windows_free_virtual_bytes: number | null;
    readonly pagefile_allocated_mib: number | null;
    readonly pagefile_current_usage_mib: number | null;
    readonly pagefile_peak_usage_mib: number | null;
    readonly pages_input_per_sec: number | null;
    readonly page_reads_per_sec: number | null;
    readonly pages_per_sec: number | null;
    readonly severe_paging_threshold_observed: boolean;
  };
  readonly gpu: {
    readonly available: boolean;
    readonly name: string | null;
    readonly memory_used_mib: number | null;
    readonly memory_total_mib: number | null;
    readonly utilization_percent: number | null;
    readonly temperature_c: number | null;
  };
  readonly ollama_processes: readonly Record<string, unknown>[];
  readonly pressure: PressureIdentity;
  readonly probe_errors: readonly string[];
}

interface CallRecord {
  readonly ordinal: number;
  readonly level: number;
  readonly call_id: string;
  readonly started_at: string;
  finished_at: string | null;
  initial_residency: "RESIDENT" | "NOT_RESIDENT";
  pre_call_snapshot: string;
  post_call_snapshot: string | null;
  events: ModelTransportTraceEventV0[];
  trace: ModelTransportTraceV0 | null;
  provider_result: CognitionProposalV0 | null;
  error: { readonly name: string; readonly message: string; readonly code: string | null } | null;
}

function parseArgs(argv: readonly string[]): Args | null {
  const result: Args = { inspect_only: false, out: null };
  for (let index = 0; index < argv.length; index++) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (flag === "--inspect-only") result.inspect_only = true;
    else if (flag === "--out" && typeof value === "string") { result.out = resolve(value); index++; }
    else return null;
  }
  return result;
}

function saveJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function command(executable: string, args: readonly string[], timeout = 15_000): string {
  return execFileSync(executable, args, {
    cwd: REPOSITORY_ROOT,
    encoding: "utf8",
    windowsHide: true,
    timeout
  }).trim();
}

function optionalCommand(executable: string, args: readonly string[]): string | null {
  try {
    return command(executable, args);
  } catch {
    return null;
  }
}

function parseJsonRecord(raw: string | null): Record<string, unknown> | null {
  if (raw === null || raw.length === 0) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function numeric(record: Record<string, unknown> | null, key: string): number | null {
  const value = record?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

async function fetchJson(url: string): Promise<{ body: unknown | null; error: string | null }> {
  try {
    const response = await fetch(url, { method: "GET", signal: AbortSignal.timeout(5_000) });
    if (!response.ok) return { body: null, error: `HTTP ${response.status}` };
    return { body: await response.json(), error: null };
  } catch (error) {
    return { body: null, error: error instanceof Error ? `${error.name}: ${error.message}` : String(error) };
  }
}

async function providerLock(): Promise<ProviderLockRecord> {
  const errors: string[] = [];
  const versionResult = await fetchJson(`${PROVIDER_LOCK_ENVIRONMENT_V0.base_url}/api/version`);
  const tagsResult = await fetchJson(`${PROVIDER_LOCK_ENVIRONMENT_V0.base_url}/api/tags`);
  if (versionResult.error !== null) errors.push(`GET /api/version: ${versionResult.error}`);
  if (tagsResult.error !== null) errors.push(`GET /api/tags: ${tagsResult.error}`);
  const versionValue = (versionResult.body as { version?: unknown } | null)?.version;
  const version = typeof versionValue === "string" ? versionValue : null;
  const modelEntries = (tagsResult.body as { models?: unknown } | null)?.models;
  const selected = (Array.isArray(modelEntries) ? modelEntries : []).find((entry) => {
    const item = entry as { name?: unknown; model?: unknown };
    return item.name === PROVIDER_LOCK_ENVIRONMENT_V0.model || item.model === PROVIDER_LOCK_ENVIRONMENT_V0.model;
  }) as { digest?: unknown } | undefined;
  const digest = typeof selected?.digest === "string" ? selected.digest : null;
  return {
    expected: PROVIDER_LOCK_ENVIRONMENT_V0,
    actual: { version, model: PROVIDER_LOCK_ENVIRONMENT_V0.model, digest },
    version_match: version === PROVIDER_LOCK_ENVIRONMENT_V0.version,
    digest_match: digest === PROVIDER_LOCK_ENVIRONMENT_V0.digest,
    checked_at: new Date().toISOString(),
    errors
  };
}

function windowsMemory(): Record<string, unknown> | null {
  const script = [
    "$o=Get-CimInstance Win32_OperatingSystem;",
    "$m=Get-CimInstance Win32_PerfFormattedData_PerfOS_Memory;",
    "$p=Get-CimInstance Win32_PageFileUsage;",
    "[pscustomobject]@{free_physical_bytes=[double]$o.FreePhysicalMemory*1024;",
    "total_virtual_bytes=[double]$o.TotalVirtualMemorySize*1024;",
    "free_virtual_bytes=[double]$o.FreeVirtualMemory*1024;",
    "pages_input_per_sec=[double]$m.PagesInputPerSec;page_reads_per_sec=[double]$m.PageReadsPerSec;",
    "pages_per_sec=[double]$m.PagesPerSec;pagefile_allocated_mib=[double](($p|Measure-Object AllocatedBaseSize -Sum).Sum);",
    "pagefile_current_usage_mib=[double](($p|Measure-Object CurrentUsage -Sum).Sum);",
    "pagefile_peak_usage_mib=[double](($p|Measure-Object PeakUsage -Sum).Sum)}|ConvertTo-Json -Compress"
  ].join("");
  return parseJsonRecord(optionalCommand("powershell.exe", ["-NoProfile", "-Command", script]));
}

function ollamaProcesses(): readonly Record<string, unknown>[] {
  const script = [
    "$p=Get-Process -Name ollama,'ollama app' -ErrorAction SilentlyContinue|",
    "Select-Object @{n='pid';e={$_.Id}},@{n='process_name';e={$_.ProcessName}},",
    "@{n='started_at';e={$_.StartTime.ToString('o')}},@{n='working_set_bytes';e={$_.WorkingSet64}};",
    "@($p)|ConvertTo-Json -Compress"
  ].join("");
  const raw = optionalCommand("powershell.exe", ["-NoProfile", "-Command", script]);
  if (raw === null || raw.length === 0) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return (Array.isArray(parsed) ? parsed : [parsed]).filter(
      (entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null
    );
  } catch {
    return [];
  }
}

function gpuSnapshot(): SnapshotV0["gpu"] {
  const raw = optionalCommand("nvidia-smi.exe", [
    "--query-gpu=name,memory.used,memory.total,utilization.gpu,temperature.gpu",
    "--format=csv,noheader,nounits"
  ]);
  if (raw === null) {
    return {
      available: false, name: null, memory_used_mib: null, memory_total_mib: null,
      utilization_percent: null, temperature_c: null
    };
  }
  const cells = raw.split(/\r?\n/, 1)[0]?.split(",").map((cell) => cell.trim()) ?? [];
  const at = (index: number): number | null => {
    const value = Number(cells[index]);
    return Number.isFinite(value) ? value : null;
  };
  return {
    available: true,
    name: cells[0] ?? null,
    memory_used_mib: at(1),
    memory_total_mib: at(2),
    utilization_percent: at(3),
    temperature_c: at(4)
  };
}

function pressureIdentity(session: PressureSession | null, requestedMib: number): PressureIdentity {
  return {
    requested_mib: requestedMib,
    actual_allocated_mib: session?.actual_allocated_mib ?? 0,
    pid: session?.pid ?? null,
    alive: session !== null && session.exit_code === null && session.exit_signal === null
  };
}

async function snapshot(
  name: string,
  level: number,
  callId: string | null,
  session: PressureSession | null,
  requestedMib: number
): Promise<SnapshotV0> {
  const errors: string[] = [];
  const health = await captureOllamaDiagnosticHealthSnapshotV0({ base_url: PROVIDER_LOCK_ENVIRONMENT_V0.base_url });
  errors.push(...health.probe_errors);
  const win = windowsMemory();
  if (win === null) errors.push("Windows memory/pagefile counters unavailable");
  const processes = ollamaProcesses();
  if (processes.length === 0) errors.push("Ollama process identity unavailable");
  const pagesInput = numeric(win, "pages_input_per_sec");
  const pageReads = numeric(win, "page_reads_per_sec");
  const severePaging = (pagesInput !== null && pagesInput >= 8192) ||
    (pageReads !== null && pageReads >= 2048);
  return {
    schema_version: "ollama-environment-resource-snapshot-v0",
    name,
    level,
    call_id: callId,
    captured_at: new Date().toISOString(),
    health,
    memory: {
      node_available_bytes: freemem(),
      total_physical_bytes: totalmem(),
      windows_free_physical_bytes: numeric(win, "free_physical_bytes"),
      windows_total_virtual_bytes: numeric(win, "total_virtual_bytes"),
      windows_free_virtual_bytes: numeric(win, "free_virtual_bytes"),
      pagefile_allocated_mib: numeric(win, "pagefile_allocated_mib"),
      pagefile_current_usage_mib: numeric(win, "pagefile_current_usage_mib"),
      pagefile_peak_usage_mib: numeric(win, "pagefile_peak_usage_mib"),
      pages_input_per_sec: pagesInput,
      page_reads_per_sec: pageReads,
      pages_per_sec: numeric(win, "pages_per_sec"),
      severe_paging_threshold_observed: severePaging
    },
    gpu: gpuSnapshot(),
    ollama_processes: processes,
    pressure: pressureIdentity(session, requestedMib),
    probe_errors: errors
  };
}

function parseHelperLines(session: PressureSession, state: { buffered: string }, chunk: Buffer): void {
  state.buffered += chunk.toString("utf8");
  const lines = state.buffered.split(/\r?\n/);
  state.buffered = lines.pop() ?? "";
  for (const line of lines) {
    const split = line.indexOf(" ");
    if (split < 0) continue;
    try {
      const payload = JSON.parse(line.slice(split + 1)) as Record<string, unknown>;
      const event = { kind: line.slice(0, split), payload };
      session.events.push(event);
      if (event.kind === "READY" && typeof payload["actual_allocated_mib"] === "number") {
        session.actual_allocated_mib = payload["actual_allocated_mib"];
      }
    } catch {
      session.events.push({ kind: "UNPARSEABLE", payload: { line: line.slice(0, 2048) } });
    }
  }
}

async function startPressure(requestedMib: number): Promise<PressureSession> {
  const child = spawn(process.execPath, [
    PRESSURE_HELPER,
    "--mib", String(requestedMib),
    "--safety-floor-mib", String(ENVIRONMENT_RESOURCE_DIAGNOSTIC_PROTOCOL_V0.safety_floor_mib),
    "--chunk-mib", String(ENVIRONMENT_RESOURCE_DIAGNOSTIC_PROTOCOL_V0.pressure_chunk_mib),
    "--max-lifetime-ms", String(ENVIRONMENT_RESOURCE_DIAGNOSTIC_PROTOCOL_V0.pressure_helper_max_lifetime_ms)
  ], { cwd: REPOSITORY_ROOT, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
  if (child.pid === undefined) throw new Error("pressure helper PID unavailable");
  const session: PressureSession = {
    child,
    pid: child.pid,
    requested_mib: requestedMib,
    started_at: new Date().toISOString(),
    actual_allocated_mib: 0,
    events: [],
    parent_release_reason: null,
    release_requested: false,
    exit_code: null,
    exit_signal: null,
    ended_at: null
  };
  const stdoutState = { buffered: "" };
  child.stdout.on("data", (chunk: Buffer) => parseHelperLines(session, stdoutState, chunk));
  child.stderr.on("data", (chunk: Buffer) => {
    session.events.push({ kind: "STDERR", payload: { text: chunk.toString("utf8").slice(0, 2048) } });
  });
  child.on("exit", (code, signal) => {
    session.exit_code = code;
    session.exit_signal = signal;
    session.ended_at = new Date().toISOString();
  });
  try {
    await new Promise<void>((resolveReady, rejectReady) => {
      const deadline = setTimeout(() => rejectReady(new Error("pressure helper READY timeout")), 120_000);
      const poll = setInterval(() => {
        if (session.events.some((event) => event.kind === "READY")) {
          clearTimeout(deadline);
          clearInterval(poll);
          resolveReady();
        } else if (session.exit_code !== null || session.exit_signal !== null) {
          clearTimeout(deadline);
          clearInterval(poll);
          rejectReady(new Error("pressure helper exited before READY"));
        }
      }, 25);
    });
  } catch (error) {
    child.kill("SIGTERM");
    throw error;
  }
  return session;
}

function requestPressureRelease(session: PressureSession, reason: string): void {
  if (session.release_requested || session.exit_code !== null || session.exit_signal !== null) return;
  session.release_requested = true;
  session.parent_release_reason = reason;
  session.child.stdin.write("release\n");
}

async function finishPressure(session: PressureSession, reason: string): Promise<void> {
  requestPressureRelease(session, reason);
  if (session.exit_code !== null || session.exit_signal !== null) return;
  const waitForExit = (timeoutMs: number): Promise<boolean> => new Promise((resolveExit) => {
    if (session.exit_code !== null || session.exit_signal !== null) {
      resolveExit(true);
      return;
    }
    const deadline = setTimeout(() => resolveExit(false), timeoutMs);
    session.child.once("exit", () => {
      clearTimeout(deadline);
      resolveExit(true);
    });
  });
  if (await waitForExit(5_000)) return;
  session.child.kill("SIGTERM");
  if (!await waitForExit(5_000)) throw new Error(`pressure helper ${session.pid} did not terminate`);
}

function helperEvidence(session: PressureSession): Record<string, unknown> {
  return {
    helper_source: "research/diagnostics/ollama-environment-resource-v0/pressure-helper.ts",
    pid: session.pid,
    requested_mib: session.requested_mib,
    actual_allocated_mib: session.actual_allocated_mib,
    started_at: session.started_at,
    ended_at: session.ended_at,
    parent_release_reason: session.parent_release_reason,
    release_requested: session.release_requested,
    exit_code: session.exit_code,
    exit_signal: session.exit_signal,
    clean_termination: session.exit_code === 0 && session.exit_signal === null,
    events: session.events
  };
}

function serverLogPath(): string | null {
  const local = process.env["LOCALAPPDATA"];
  if (typeof local !== "string") return null;
  const path = join(local, "Ollama", "server.log");
  return existsSync(path) ? path : null;
}

function logWindow(path: string | null, startOffset: number): { metadata: Record<string, unknown>; text: string } {
  if (path === null || !existsSync(path)) {
    return { metadata: { available: false, path, reason: "server.log unavailable" }, text: "" };
  }
  const all = readFileSync(path);
  const start = all.length >= startOffset ? startOffset : 0;
  const slice = all.subarray(start);
  return {
    metadata: {
      available: true,
      path,
      file_name: basename(path),
      start_offset: start,
      end_offset: all.length,
      bytes: slice.length,
      rotated_or_truncated: start !== startOffset,
      captured_at: new Date().toISOString()
    },
    text: slice.toString("utf8")
  };
}

function count(text: string, pattern: RegExp): number {
  return [...text.matchAll(pattern)].length;
}

function analyzeLog(text: string): Record<string, unknown> {
  return {
    api_chat_requests: count(text, /POST\s+"\/api\/chat"/g),
    http_500: count(text, /\| 500 \|/g),
    gpu_discovery_watchdog_warnings: count(text, /GPU discovery watchdog timed out/g),
    free_memory_refresh_warnings: count(text, /unable to refresh free memory/g),
    insufficient_memory_warnings: count(text, /insufficient memory/gi),
    model_load_events: count(text, /loading model via llama-server/g),
    model_unload_events: count(text, /unloaded model|unloading model/gi),
    cancel_events: count(text, /cancel task/g),
    release_events: count(text, /slot\s+release:/g),
    prompt_cache_update_ms: [...text.matchAll(/prompt cache update took ([0-9.]+) ms/g)].map((m) => Number(m[1])),
    full_prompt_tokens: [...text.matchAll(/task\.n_tokens =\s+(\d+)/g)].map((m) => Number(m[1]))
  };
}

function boundedError(error: unknown): CallRecord["error"] {
  const record = error as { name?: unknown; message?: unknown; code?: unknown };
  return {
    name: typeof record?.name === "string" ? record.name : "Unknown",
    message: (typeof record?.message === "string" ? record.message : String(error)).slice(0, 2048),
    code: typeof record?.code === "string" ? record.code : null
  };
}

function resident(snapshotValue: SnapshotV0): "RESIDENT" | "NOT_RESIDENT" {
  return snapshotValue.health.server.loaded_models.some(
    (model) => model.name === PROVIDER_LOCK_ENVIRONMENT_V0.model || model.model === PROVIDER_LOCK_ENVIRONMENT_V0.model
  ) ? "RESIDENT" : "NOT_RESIDENT";
}

function mean(values: readonly number[]): number | null {
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function levelTrend(calls: readonly CallRecord[], level: number): Record<string, unknown> {
  const selected = calls.filter((call) => call.level === level && call.trace !== null);
  const traces = selected.map((call) => call.trace as ModelTransportTraceV0);
  const evalRates = traces.flatMap((trace) =>
    trace.ollama.eval_count !== null && trace.ollama.eval_duration !== null && trace.ollama.eval_duration > 0
      ? [trace.ollama.eval_count * 1_000_000_000 / trace.ollama.eval_duration]
      : []
  );
  return {
    level,
    calls: selected.map((call) => call.call_id),
    mean_total_ms: mean(traces.flatMap((trace) => trace.elapsed_ms === null ? [] : [trace.elapsed_ms])),
    mean_load_ms: mean(traces.flatMap((trace) => trace.ollama.load_duration === null ? [] : [trace.ollama.load_duration / 1_000_000])),
    mean_prompt_eval_ms: mean(traces.flatMap((trace) => trace.ollama.prompt_eval_duration === null ? [] : [trace.ollama.prompt_eval_duration / 1_000_000])),
    mean_eval_ms: mean(traces.flatMap((trace) => trace.ollama.eval_duration === null ? [] : [trace.ollama.eval_duration / 1_000_000])),
    mean_eval_tokens_per_second: mean(evalRates)
  };
}

function sha256File(path: string): string {
  return `sha256:${createHash("sha256").update(readFileSync(path)).digest("hex")}`;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args === null) {
    console.error("usage: runner.ts [--inspect-only] [--out <directory>]");
    process.exitCode = 2;
    return;
  }
  const fixture = await frozenRepresentativeFixtureV0();
  console.log(JSON.stringify({ frozen_request: fixture.shape, levels: PRESSURE_LEVELS_V0 }, null, 2));
  if (!representativeFixtureMatchesFrozenV0(fixture.shape)) {
    console.error("REPRESENTATIVE_FIXTURE_DRIFT");
    process.exitCode = 3;
    return;
  }
  if (args.inspect_only) return;

  const startingHead = command("git.exe", ["rev-parse", "HEAD"]);
  const originMain = command("git.exe", ["rev-parse", "origin/main"]);
  if (startingHead !== EXPECTED_STARTING_HEAD || originMain !== EXPECTED_STARTING_HEAD) {
    console.error("DIAGNOSTIC_BASELINE_DRIFT");
    process.exitCode = 4;
    return;
  }
  const productionDiff = command("git.exe", ["diff", "--name-only", "--", "packages/runtime", "research/experiments"]);
  if (productionDiff.length > 0) {
    console.error(`DIAGNOSTIC_PRODUCTION_ISOLATION_FAILURE\n${productionDiff}`);
    process.exitCode = 5;
    return;
  }

  const logPath = serverLogPath();
  const logStartOffset = logPath === null ? 0 : statSync(logPath).size;
  const lock = await providerLock();
  if (!lock.version_match || !lock.digest_match || lock.errors.length > 0) {
    console.error(`DIAGNOSTIC_PROVIDER_DRIFT\n${JSON.stringify(lock, null, 2)}`);
    process.exitCode = 6;
    return;
  }

  const runId = `environment-resource-v0-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const outDir = args.out ?? join(DIAGNOSTIC_DIR, "evidence", runId);
  mkdirSync(outDir, { recursive: true });
  saveJson(join(outDir, "provider-lock.json"), lock);
  saveJson(join(outDir, "frozen-request-identity.json"), {
    expected: FROZEN_REPRESENTATIVE_REQUEST_V0,
    actual: fixture.shape,
    match: true
  });
  saveJson(join(outDir, "pressure-stage-definitions.json"), PRESSURE_LEVELS_V0);

  const calls: CallRecord[] = [];
  const snapshots: SnapshotV0[] = [];
  const helperRecords: Record<string, unknown>[] = [];
  let ordinal = 0;
  let safetyStop = false;
  let safetyStopReason: string | null = null;
  let timeoutStop = false;

  for (const level of PRESSURE_LEVELS_V0) {
    const stageDir = join(outDir, level.id.toLowerCase().replace("_", "-"));
    mkdirSync(stageDir, { recursive: true });
    let session: PressureSession | null = null;
    const pre = await snapshot(`${level.id}-pre-stage`, level.level, null, null, level.requested_mib);
    snapshots.push(pre);
    saveJson(join(stageDir, "snapshot-pre-stage.json"), pre);
    let current = pre;

    if (level.requested_mib > 0) {
      try {
        session = await startPressure(level.requested_mib);
      } catch (error) {
        safetyStop = true;
        safetyStopReason = `pressure helper failed: ${error instanceof Error ? error.message : String(error)}`;
        break;
      }
      current = await snapshot(`${level.id}-pressure-ready`, level.level, null, session, level.requested_mib);
      snapshots.push(current);
      saveJson(join(stageDir, "snapshot-pressure-ready.json"), current);
      const unsafeFloor = current.memory.node_available_bytes <= FLOOR_BYTES;
      const bounded = session.actual_allocated_mib <= level.requested_mib;
      const reliable = current.probe_errors.length === 0;
      const helperStoppedAllocation = session.events.some((event) => event.kind === "ALLOCATION_STOPPED");
      const helperExited = session.exit_code !== null || session.exit_signal !== null;
      if (unsafeFloor || !bounded || !reliable || current.memory.severe_paging_threshold_observed || helperStoppedAllocation || helperExited) {
        safetyStop = true;
        safetyStopReason = unsafeFloor
          ? "available RAM reached safety floor"
          : !bounded
            ? "pressure helper exceeded declared allocation"
            : !reliable
              ? "resource probe became unreliable"
              : current.memory.severe_paging_threshold_observed
                ? "severe paging threshold observed before inference"
                : helperStoppedAllocation
                  ? "pressure allocation stopped at safety guard"
                  : "pressure helper exited before inference";
        await finishPressure(session, "PRE_CALL_SAFETY_STOP");
        helperRecords.push({ level: level.level, ...helperEvidence(session) });
        saveJson(join(stageDir, "pressure-helper.json"), helperEvidence(session));
        break;
      }
    }

    for (const callId of level.call_ids) {
      ordinal += 1;
      const callDir = join(stageDir, `call-${callId.toLowerCase()}`);
      mkdirSync(callDir, { recursive: true });
      const call: CallRecord = {
        ordinal,
        level: level.level,
        call_id: callId,
        started_at: new Date().toISOString(),
        finished_at: null,
        initial_residency: resident(current),
        pre_call_snapshot: current.name,
        post_call_snapshot: null,
        events: [],
        trace: null,
        provider_result: null,
        error: null
      };
      const observer = (event: ModelTransportTraceEventV0 | ModelTransportTraceV0): void => {
        if ("stage" in event) call.events.push(event);
        else call.trace = event;
      };
      const transport = new OllamaNativeCognitionTransportV0({
        base_url: PROVIDER_LOCK_ENVIRONMENT_V0.base_url,
        model: PROVIDER_LOCK_ENVIRONMENT_V0.model,
        timeout_ms: PROVIDER_LOCK_ENVIRONMENT_V0.timeout_ms,
        num_predict: PROVIDER_LOCK_ENVIRONMENT_V0.num_predict,
        trace_observer: observer
      });
      const provider = new LlmCognitionProviderV0(transport, { temperature: 0 });
      let floorMonitor: NodeJS.Timeout | null = null;
      if (session !== null) {
        floorMonitor = setInterval(() => {
          if (freemem() <= FLOOR_BYTES && session !== null) {
            requestPressureRelease(session, "RUNNER_SAFETY_FLOOR_REACHED");
          }
        }, 100);
      }
      try {
        call.provider_result = await provider.propose(fixture.projection);
      } catch (error) {
        call.error = boundedError(error);
      } finally {
        if (floorMonitor !== null) clearInterval(floorMonitor);
      }
      call.finished_at = new Date().toISOString();
      const post = await snapshot(`${level.id}-after-${callId}`, level.level, callId, session, level.requested_mib);
      snapshots.push(post);
      current = post;
      call.post_call_snapshot = post.name;
      calls.push(call);
      saveJson(join(callDir, "events.json"), call.events);
      saveJson(join(callDir, "trace.json"), call.trace);
      saveJson(join(callDir, "provider-result.json"), call.provider_result);
      saveJson(join(callDir, "error.json"), call.error);
      saveJson(join(callDir, "recording.json"), {
        ordinal: call.ordinal,
        level: call.level,
        call_id: call.call_id,
        started_at: call.started_at,
        finished_at: call.finished_at,
        initial_residency: call.initial_residency,
        pre_call_snapshot: call.pre_call_snapshot,
        post_call_snapshot: call.post_call_snapshot
      });
      saveJson(join(stageDir, `snapshot-after-${callId.toLowerCase()}.json`), post);
      console.log(
        `${callId} ${call.error === null ? "SUCCESS" : "ERROR"} ` +
        `RAM=${Math.round(post.memory.node_available_bytes / MIB)}MiB ` +
        `elapsed=${call.trace?.elapsed_ms ?? "null"}ms`
      );

      const traceHashDrift = call.trace !== null &&
        (call.trace.request_hash !== FROZEN_REPRESENTATIVE_REQUEST_V0.request_hash ||
          call.trace.request_bytes !== FROZEN_REPRESENTATIVE_REQUEST_V0.post_bytes);
      if (traceHashDrift || call.trace === null || post.probe_errors.length > 0) {
        safetyStop = true;
        safetyStopReason = traceHashDrift
          ? "request identity drift"
          : call.trace === null
            ? "transport trace unavailable"
            : "resource probe became unreliable";
      }
      if (post.memory.node_available_bytes <= FLOOR_BYTES || post.memory.severe_paging_threshold_observed) {
        safetyStop = true;
        safetyStopReason = post.memory.node_available_bytes <= FLOOR_BYTES
          ? "available RAM reached safety floor"
          : "severe paging threshold observed";
      }
      if (session?.release_requested === true && !safetyStop) {
        safetyStop = true;
        safetyStopReason = session.parent_release_reason ?? "pressure helper released during call";
      }
      if (call.trace?.failure_code === "MODEL_TIMEOUT") {
        timeoutStop = true;
        safetyStopReason = "MODEL_TIMEOUT observed; escalation stopped";
      }
      if (safetyStop || timeoutStop) break;
    }

    if (session !== null) {
      await finishPressure(session, safetyStop || timeoutStop ? "STOP_CONDITION" : "STAGE_COMPLETE");
      const helper = { level: level.level, ...helperEvidence(session) };
      helperRecords.push(helper);
      saveJson(join(stageDir, "pressure-helper.json"), helper);
      await new Promise<void>((resolveWait) => setTimeout(resolveWait, 500));
      const released = await snapshot(`${level.id}-after-release`, level.level, null, null, level.requested_mib);
      snapshots.push(released);
      saveJson(join(stageDir, "snapshot-after-release.json"), released);
    }
    if (safetyStop || timeoutStop) break;
  }

  const log = logWindow(logPath, logStartOffset);
  writeFileSync(join(outDir, "server-log-window.txt"), log.text, "utf8");
  const logAnalysis = analyzeLog(log.text);
  saveJson(join(outDir, "server-log-window.json"), {
    ...log.metadata,
    slice_file: "server-log-window.txt",
    analysis: logAnalysis
  });

  const traces = calls.map((call) => call.trace);
  const technicalFailure = calls.length === 0 || traces.some((trace) => trace === null) ||
    calls.some((call) => call.error !== null && call.trace?.failure_code !== "MODEL_TIMEOUT") ||
    traces.some((trace) => trace !== null &&
      (trace.request_hash !== FROZEN_REPRESENTATIVE_REQUEST_V0.request_hash ||
        trace.request_bytes !== FROZEN_REPRESENTATIVE_REQUEST_V0.post_bytes));
  const trends = [0, 1, 2].map((level) => levelTrend(calls, level));
  const baselineWarm = calls.find((call) => call.call_id === "0B")?.trace;
  const pressureCalls = calls.filter((call) => call.level > 0 && call.trace !== null);
  const baselineTotal = baselineWarm?.elapsed_ms ?? null;
  const pressureTotals = pressureCalls.flatMap((call) => call.trace?.elapsed_ms === null ? [] : [call.trace?.elapsed_ms ?? 0]);
  const repeatedTotalDegradation = baselineTotal !== null &&
    pressureTotals.filter((value) => value >= baselineTotal * 1.5).length >= 2;
  const warningCount = Number(logAnalysis["gpu_discovery_watchdog_warnings"]) +
    Number(logAnalysis["free_memory_refresh_warnings"]) + Number(logAnalysis["insufficient_memory_warnings"]);
  const timeoutObserved = traces.some((trace) => trace?.failure_code === "MODEL_TIMEOUT");
  const suggested = repeatedTotalDegradation || warningCount > 0 || pressureCalls.some((call) => {
    const duration = call.trace?.ollama.prompt_eval_duration;
    const baselineDuration = baselineWarm?.ollama.prompt_eval_duration;
    return duration !== null && duration !== undefined && baselineDuration !== null && baselineDuration !== undefined &&
      duration >= baselineDuration * 1.5;
  });

  const resultCategory = technicalFailure
    ? "TECHNICAL_DIAGNOSTIC_FAILURE"
    : safetyStop && calls.length < 6
      ? "RESOURCE_DIAGNOSTIC_SAFETY_STOP"
      : timeoutObserved || (repeatedTotalDegradation && warningCount > 0)
        ? "RESOURCE_PRESSURE_EFFECT_REPRODUCED"
        : suggested
          ? "RESOURCE_PRESSURE_EFFECT_SUGGESTED"
          : "RESOURCE_PRESSURE_EFFECT_NOT_OBSERVED";

  let rootCauseCategory = "ENVIRONMENTAL_RESOURCE_CONTENTION_SUSPECTED";
  let rootCauseConfidence = "LOW";
  let nextSlice = "READY_FOR_ADDITIONAL_OBSERVATION";
  if (resultCategory === "RESOURCE_PRESSURE_EFFECT_REPRODUCED") {
    rootCauseCategory = warningCount > 0
      ? "PROMPT_PROCESSING_UNDER_RESOURCE_PRESSURE_SUSPECTED"
      : "ENVIRONMENTAL_RESOURCE_CONTENTION_SUSPECTED";
    rootCauseConfidence = "HIGH";
    nextSlice = warningCount > 0
      ? "READY_FOR_OLLAMA_RESOURCE_PATH_DIAGNOSTIC"
      : "READY_FOR_ENVIRONMENT_STABILIZATION_DESIGN";
  } else if (resultCategory === "RESOURCE_PRESSURE_EFFECT_SUGGESTED") {
    rootCauseConfidence = "MEDIUM";
    nextSlice = "READY_FOR_ENVIRONMENT_STABILIZATION_DESIGN";
  } else if (resultCategory === "RESOURCE_DIAGNOSTIC_SAFETY_STOP" || resultCategory === "TECHNICAL_DIAGNOSTIC_FAILURE") {
    rootCauseCategory = "UNKNOWN_TRANSPORT_CAUSE";
  }

  const callRows = calls.map((call) => {
    const pre = snapshots.find((item) => item.name === call.pre_call_snapshot) ?? null;
    const trace = call.trace;
    return {
      level: call.level,
      call: call.call_id,
      available_ram_bytes: pre?.memory.node_available_bytes ?? null,
      windows_free_physical_bytes: pre?.memory.windows_free_physical_bytes ?? null,
      pressure_requested_mib: pre?.pressure.requested_mib ?? null,
      pressure_actual_mib: pre?.pressure.actual_allocated_mib ?? null,
      pressure_pid: pre?.pressure.pid ?? null,
      model_resident: call.initial_residency === "RESIDENT",
      gpu_memory_used_mib: pre?.gpu.memory_used_mib ?? null,
      load_duration_ns: trace?.ollama.load_duration ?? null,
      prompt_eval_count: trace?.ollama.prompt_eval_count ?? null,
      prompt_eval_duration_ns: trace?.ollama.prompt_eval_duration ?? null,
      eval_count: trace?.ollama.eval_count ?? null,
      eval_duration_ns: trace?.ollama.eval_duration ?? null,
      eval_tokens_per_second:
        trace?.ollama.eval_count !== null && trace?.ollama.eval_count !== undefined &&
        trace.ollama.eval_duration !== null && trace.ollama.eval_duration > 0
          ? trace.ollama.eval_count * 1_000_000_000 / trace.ollama.eval_duration
          : null,
      total_elapsed_ms: trace?.elapsed_ms ?? null,
      fetch_elapsed_ms: trace?.fetch_response_elapsed_ms ?? null,
      body_elapsed_ms: trace?.body_read_elapsed_ms ?? null,
      abort: trace?.abort_triggered ?? null,
      terminal_stage: trace?.terminal_stage ?? null,
      response_status: trace?.response_status ?? null,
      warnings: warningCount === 0 ? [] : ["SEE_SERVER_LOG_WINDOW"],
      outcome: call.error === null ? "SUCCESS" : call.error.code ?? "FAILURE"
    };
  });

  const activeHelpers = optionalCommand("powershell.exe", [
    "-NoProfile", "-Command",
    `$p=Get-CimInstance Win32_Process|Where-Object {$_.Name -like 'node*' -and $_.CommandLine -like '*ollama-environment-resource-v0*pressure-helper.ts*'};@($p|Select-Object ProcessId,CommandLine)|ConvertTo-Json -Compress`
  ]);
  const finalSummary: Record<string, unknown> = {
    ...ENVIRONMENT_RESOURCE_DIAGNOSTIC_PROTOCOL_V0,
    run_id: runId,
    evidence_path: outDir,
    starting_head: startingHead,
    origin_main_at_start: originMain,
    provider_lock: lock,
    fixture: { expected: FROZEN_REPRESENTATIVE_REQUEST_V0, actual: fixture.shape, match: true },
    model_call_counts: { cognition: calls.length, language: 0, evaluator: 0 },
    pressure_levels: PRESSURE_LEVELS_V0,
    helpers: helperRecords,
    calls: callRows,
    trends,
    server_log: { ...log.metadata, analysis: logAnalysis },
    stop: { safety_stop: safetyStop, timeout_stop: timeoutStop, reason: safetyStopReason },
    result_category: resultCategory,
    root_cause_category: rootCauseCategory,
    root_cause_confidence: rootCauseConfidence,
    next_slice: nextSlice,
    final_helper_process_query: activeHelpers,
    integrity: {
      model_calls_at_most_six: calls.length <= 6,
      language_calls: 0,
      evaluator_calls: 0,
      exactly_one_request_hash: new Set(traces.map((trace) => trace?.request_hash)).size === 1,
      frozen_request_match: true,
      production_paths_changed_before_run: false,
      all_started_helpers_terminated: helperRecords.every((helper) => helper["clean_termination"] === true),
      retries: 0,
      warm_up_calls: 0,
      timeout_ms: 120000
    }
  };
  saveJson(join(outDir, "summary.json"), finalSummary);
  saveJson(join(outDir, "manifest.json"), {
    schema_version: "ollama-environment-resource-manifest-v0",
    run_id: runId,
    starting_head: startingHead,
    origin_main_at_start: originMain,
    production_diff_before_run: productionDiff,
    protocol_sha256: sha256File(join(DIAGNOSTIC_DIR, "protocol.ts")),
    runner_sha256: sha256File(join(DIAGNOSTIC_DIR, "runner.ts")),
    helper_sha256: sha256File(PRESSURE_HELPER),
    frozen_fixture_sha256: sha256File(resolve(DIAGNOSTIC_DIR, "../ollama-cognition-representative-load-v1/fixture.ts")),
    diagnostic_only: true
  });
  console.log(`${resultCategory}\nsummary=${join(outDir, "summary.json")}`);
}

await main();
