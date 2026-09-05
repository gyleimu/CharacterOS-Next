/* eslint-disable no-restricted-imports -- Manual natural-state diagnostic orchestrator only. */

import { execFileSync, spawn } from "node:child_process";
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
  FROZEN_REPRESENTATIVE_REQUEST_V0,
  HEALTHY_REPRESENTATIVE_V1_REFERENCE,
  NATURAL_CALL_IDS_V0,
  NATURAL_LOW_RESOURCE_PROTOCOL_V0,
  PROVIDER_LOCK_NATURAL_V0,
  R3_REFERENCE_V0,
  frozenRepresentativeFixtureV0,
  representativeFixtureMatchesFrozenV0
} from "./protocol.ts";

const DIAGNOSTIC_DIR = fileURLToPath(new URL(".", import.meta.url));
const REPOSITORY_ROOT = resolve(DIAGNOSTIC_DIR, "../../..");
const EXPECTED_STARTING_HEAD = "f515f599ae8c97391cb50480cce917399dc038b4";
const WINDOW_THRESHOLD_BYTES = NATURAL_LOW_RESOURCE_PROTOCOL_V0.natural_window_lost_threshold_bytes;
const MIB = 1024 * 1024;

interface Args {
  readonly inspect_only: boolean;
  readonly out: string | null;
}

interface ProviderLockRecord {
  readonly expected: typeof PROVIDER_LOCK_NATURAL_V0;
  readonly actual: { readonly version: string | null; readonly model: string; readonly digest: string | null };
  readonly version_match: boolean;
  readonly digest_match: boolean;
  readonly checked_at: string;
  readonly errors: readonly string[];
}

interface ProcessRecord {
  readonly pid: number | null;
  readonly process_name: string | null;
  readonly started_at: string | null;
  readonly working_set_bytes: number | null;
  readonly private_memory_bytes: number | null;
}

interface ResourceSnapshot {
  readonly schema_version: "ollama-natural-low-resource-snapshot-v0";
  readonly name: string;
  readonly call_id: string | null;
  readonly captured_at: string;
  readonly health: Awaited<ReturnType<typeof captureOllamaDiagnosticHealthSnapshotV0>>;
  readonly memory: {
    readonly node_available_bytes: number;
    readonly total_physical_bytes: number;
    readonly windows_free_physical_bytes: number | null;
    readonly windows_total_virtual_bytes: number | null;
    readonly windows_free_virtual_bytes: number | null;
    readonly committed_bytes: number | null;
    readonly commit_limit_bytes: number | null;
    readonly commit_peak_bytes: number | null;
    readonly pagefile_allocated_mib: number | null;
    readonly pagefile_current_usage_mib: number | null;
    readonly pagefile_peak_usage_mib: number | null;
    readonly pages_input_per_sec: number | null;
    readonly page_reads_per_sec: number | null;
    readonly pages_per_sec: number | null;
    readonly severe_paging_threshold_observed: boolean;
  };
  readonly processes: {
    readonly delta_force: readonly ProcessRecord[];
    readonly ollama: readonly ProcessRecord[];
  };
  readonly gpu: {
    readonly available: boolean;
    readonly name: string | null;
    readonly memory_used_mib: number | null;
    readonly memory_total_mib: number | null;
    readonly utilization_percent: number | null;
    readonly temperature_c: number | null;
  };
  readonly artificial_pressure_processes: readonly Record<string, unknown>[];
  readonly probe_errors: readonly string[];
}

interface RuntimeMonitor {
  readonly samples: number;
  readonly minimum_available_bytes: number;
  readonly maximum_event_loop_gap_ms: number;
}

interface CallRecord {
  readonly call_id: string;
  readonly started_at: string;
  finished_at: string | null;
  readonly initial_residency: "RESIDENT" | "NOT_RESIDENT";
  readonly pre_call_snapshot: string;
  post_call_snapshot: string | null;
  readonly events: ModelTransportTraceEventV0[];
  trace: ModelTransportTraceV0 | null;
  provider_result: CognitionProposalV0 | null;
  error: { readonly name: string; readonly message: string; readonly code: string | null } | null;
  runtime_monitor: RuntimeMonitor | null;
}

function parseArgs(argv: readonly string[]): Args | null {
  let inspectOnly = false;
  let out: string | null = null;
  for (let index = 0; index < argv.length; index++) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (flag === "--inspect-only") inspectOnly = true;
    else if (flag === "--out" && typeof value === "string") { out = resolve(value); index++; }
    else return null;
  }
  return { inspect_only: inspectOnly, out };
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
    const value = JSON.parse(raw) as unknown;
    return typeof value === "object" && value !== null && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function parseJsonRecords(raw: string | null): readonly Record<string, unknown>[] {
  if (raw === null || raw.length === 0) return [];
  try {
    const value = JSON.parse(raw) as unknown;
    return (Array.isArray(value) ? value : [value]).filter(
      (entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null
    );
  } catch {
    return [];
  }
}

function numeric(record: Record<string, unknown> | null, key: string): number | null {
  const value = record?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

async function fetchJson(url: string, timeoutMs = 5_000): Promise<{ body: unknown | null; error: string | null }> {
  try {
    const response = await fetch(url, { method: "GET", signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) return { body: null, error: `HTTP ${response.status}` };
    return { body: await response.json(), error: null };
  } catch (error) {
    return { body: null, error: error instanceof Error ? `${error.name}: ${error.message}` : String(error) };
  }
}

function serverLogPath(): string | null {
  const local = process.env["LOCALAPPDATA"];
  if (typeof local !== "string") return null;
  const path = join(local, "Ollama", "server.log");
  return existsSync(path) ? path : null;
}

async function ensureOllamaServer(): Promise<Record<string, unknown>> {
  const before = await fetchJson(`${PROVIDER_LOCK_NATURAL_V0.base_url}/api/version`, 2_000);
  if (before.error === null) {
    return { kind: "NONE", server_already_running: true, checked_at: new Date().toISOString() };
  }
  const local = process.env["LOCALAPPDATA"];
  const executable = typeof local === "string" ? join(local, "Programs", "Ollama", "ollama app.exe") : "";
  if (!existsSync(executable)) throw new Error("normal Ollama application executable unavailable");
  const requestedAt = new Date().toISOString();
  const child = spawn(executable, [], {
    cwd: REPOSITORY_ROOT,
    detached: true,
    windowsHide: true,
    stdio: "ignore"
  });
  child.on("error", () => undefined);
  const launcherPid = child.pid ?? null;
  child.unref();
  const deadline = Date.now() + 30_000;
  let lastError: string | null = before.error;
  while (Date.now() < deadline) {
    await new Promise<void>((resolveWait) => setTimeout(resolveWait, 500));
    const check = await fetchJson(`${PROVIDER_LOCK_NATURAL_V0.base_url}/api/version`, 2_000);
    if (check.error === null) {
      return {
        kind: "START_NORMAL_OLLAMA_APPLICATION",
        server_already_running: false,
        executable,
        requested_at: requestedAt,
        launcher_pid: launcherPid,
        server_ready_at: new Date().toISOString(),
        initial_error: before.error
      };
    }
    lastError = check.error;
  }
  throw new Error(`normal Ollama application did not become ready: ${lastError ?? "unknown"}`);
}

async function providerLock(): Promise<ProviderLockRecord> {
  const errors: string[] = [];
  const versionResult = await fetchJson(`${PROVIDER_LOCK_NATURAL_V0.base_url}/api/version`);
  const tagsResult = await fetchJson(`${PROVIDER_LOCK_NATURAL_V0.base_url}/api/tags`);
  if (versionResult.error !== null) errors.push(`GET /api/version: ${versionResult.error}`);
  if (tagsResult.error !== null) errors.push(`GET /api/tags: ${tagsResult.error}`);
  const versionValue = (versionResult.body as { version?: unknown } | null)?.version;
  const version = typeof versionValue === "string" ? versionValue : null;
  const modelEntries = (tagsResult.body as { models?: unknown } | null)?.models;
  const selected = (Array.isArray(modelEntries) ? modelEntries : []).find((entry) => {
    const item = entry as { name?: unknown; model?: unknown };
    return item.name === PROVIDER_LOCK_NATURAL_V0.model || item.model === PROVIDER_LOCK_NATURAL_V0.model;
  }) as { digest?: unknown } | undefined;
  const digest = typeof selected?.digest === "string" ? selected.digest : null;
  return {
    expected: PROVIDER_LOCK_NATURAL_V0,
    actual: { version, model: PROVIDER_LOCK_NATURAL_V0.model, digest },
    version_match: version === PROVIDER_LOCK_NATURAL_V0.version,
    digest_match: digest === PROVIDER_LOCK_NATURAL_V0.digest,
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
    "total_virtual_bytes=[double]$o.TotalVirtualMemorySize*1024;free_virtual_bytes=[double]$o.FreeVirtualMemory*1024;",
    "committed_bytes=[double]$m.CommittedBytes;commit_limit_bytes=[double]$m.CommitLimit;commit_peak_bytes=[double]$m.CommitPeak;",
    "pages_input_per_sec=[double]$m.PagesInputPerSec;page_reads_per_sec=[double]$m.PageReadsPerSec;pages_per_sec=[double]$m.PagesPerSec;",
    "pagefile_allocated_mib=[double](($p|Measure-Object AllocatedBaseSize -Sum).Sum);",
    "pagefile_current_usage_mib=[double](($p|Measure-Object CurrentUsage -Sum).Sum);",
    "pagefile_peak_usage_mib=[double](($p|Measure-Object PeakUsage -Sum).Sum)}|ConvertTo-Json -Compress"
  ].join("");
  return parseJsonRecord(optionalCommand("powershell.exe", ["-NoProfile", "-Command", script]));
}

function namedProcesses(names: readonly string[]): readonly ProcessRecord[] {
  const quoted = names.map((name) => `'${name.replaceAll("'", "''")}'`).join(",");
  const script = [
    `$p=Get-Process -Name ${quoted} -ErrorAction SilentlyContinue|`,
    "Select-Object @{n='pid';e={$_.Id}},@{n='process_name';e={$_.ProcessName}},",
    "@{n='started_at';e={$_.StartTime.ToString('o')}},@{n='working_set_bytes';e={[double]$_.WorkingSet64}},",
    "@{n='private_memory_bytes';e={[double]$_.PrivateMemorySize64}};@($p)|ConvertTo-Json -Compress"
  ].join("");
  return parseJsonRecords(optionalCommand("powershell.exe", ["-NoProfile", "-Command", script])).map((entry) => ({
    pid: numeric(entry, "pid"),
    process_name: typeof entry["process_name"] === "string" ? entry["process_name"] : null,
    started_at: typeof entry["started_at"] === "string" ? entry["started_at"] : null,
    working_set_bytes: numeric(entry, "working_set_bytes"),
    private_memory_bytes: numeric(entry, "private_memory_bytes")
  }));
}

function artificialPressureProcesses(): readonly Record<string, unknown>[] {
  const script = [
    "$p=Get-CimInstance Win32_Process|Where-Object {",
    "$_.Name -like 'node*' -and $_.CommandLine -like '*ollama-environment-resource-v0*pressure-helper.ts*'};",
    "@($p|Select-Object ProcessId,CommandLine)|ConvertTo-Json -Compress"
  ].join("");
  return parseJsonRecords(optionalCommand("powershell.exe", ["-NoProfile", "-Command", script]));
}

function gpuSnapshot(): ResourceSnapshot["gpu"] {
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

async function snapshot(name: string, callId: string | null): Promise<ResourceSnapshot> {
  const errors: string[] = [];
  const health = await captureOllamaDiagnosticHealthSnapshotV0({ base_url: PROVIDER_LOCK_NATURAL_V0.base_url });
  const win = windowsMemory();
  if (win === null) errors.push("Windows memory/pagefile counters unavailable");
  const deltaForce = namedProcesses(["DeltaForceClient-Win64-Shipping"]);
  const ollama = namedProcesses(["ollama", "ollama app"]);
  const pagesInput = numeric(win, "pages_input_per_sec");
  const pageReads = numeric(win, "page_reads_per_sec");
  return {
    schema_version: "ollama-natural-low-resource-snapshot-v0",
    name,
    call_id: callId,
    captured_at: new Date().toISOString(),
    health,
    memory: {
      node_available_bytes: freemem(),
      total_physical_bytes: totalmem(),
      windows_free_physical_bytes: numeric(win, "free_physical_bytes"),
      windows_total_virtual_bytes: numeric(win, "total_virtual_bytes"),
      windows_free_virtual_bytes: numeric(win, "free_virtual_bytes"),
      committed_bytes: numeric(win, "committed_bytes"),
      commit_limit_bytes: numeric(win, "commit_limit_bytes"),
      commit_peak_bytes: numeric(win, "commit_peak_bytes"),
      pagefile_allocated_mib: numeric(win, "pagefile_allocated_mib"),
      pagefile_current_usage_mib: numeric(win, "pagefile_current_usage_mib"),
      pagefile_peak_usage_mib: numeric(win, "pagefile_peak_usage_mib"),
      pages_input_per_sec: pagesInput,
      page_reads_per_sec: pageReads,
      pages_per_sec: numeric(win, "pages_per_sec"),
      severe_paging_threshold_observed:
        (pagesInput !== null && pagesInput >= 8192) || (pageReads !== null && pageReads >= 2048)
    },
    processes: { delta_force: deltaForce, ollama },
    gpu: gpuSnapshot(),
    artificial_pressure_processes: artificialPressureProcesses(),
    probe_errors: errors
  };
}

function residency(value: ResourceSnapshot): "RESIDENT" | "NOT_RESIDENT" {
  return value.health.server.loaded_models.some(
    (model) => model.name === PROVIDER_LOCK_NATURAL_V0.model || model.model === PROVIDER_LOCK_NATURAL_V0.model
  ) ? "RESIDENT" : "NOT_RESIDENT";
}

function boundedError(error: unknown): CallRecord["error"] {
  const value = error as { name?: unknown; message?: unknown; code?: unknown };
  return {
    name: typeof value?.name === "string" ? value.name : "Unknown",
    message: (typeof value?.message === "string" ? value.message : String(error)).slice(0, 2048),
    code: typeof value?.code === "string" ? value.code : null
  };
}

function startRuntimeMonitor(): { stop: () => RuntimeMonitor } {
  let samples = 1;
  let minimumAvailable = freemem();
  let previous = Date.now();
  let maximumGap = 0;
  const timer = setInterval(() => {
    const now = Date.now();
    maximumGap = Math.max(maximumGap, now - previous);
    previous = now;
    minimumAvailable = Math.min(minimumAvailable, freemem());
    samples++;
  }, 500);
  return {
    stop: () => {
      clearInterval(timer);
      const now = Date.now();
      maximumGap = Math.max(maximumGap, now - previous);
      minimumAvailable = Math.min(minimumAvailable, freemem());
      return {
        samples,
        minimum_available_bytes: minimumAvailable,
        maximum_event_loop_gap_ms: maximumGap
      };
    }
  };
}

function logWindow(path: string | null, startOffset: number): { metadata: Record<string, unknown>; text: string } {
  if (path === null || !existsSync(path)) {
    return { metadata: { available: false, path, reason: "server.log unavailable" }, text: "" };
  }
  const all = readFileSync(path);
  const start = all.length >= startOffset ? startOffset : 0;
  const data = all.subarray(start);
  return {
    metadata: {
      available: true,
      path,
      file_name: basename(path),
      start_offset: start,
      end_offset: all.length,
      bytes: data.length,
      rotated_or_truncated: start !== startOffset,
      captured_at: new Date().toISOString()
    },
    text: data.toString("utf8")
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
    runner_delay_events: count(text, /runner delay/gi),
    mmap_mentions: count(text, /mmap/gi),
    cuda_offload_events: count(text, /offloaded \d+\/\d+ layers to GPU/g),
    prompt_cache_update_ms: [...text.matchAll(/prompt cache update took ([0-9.]+) ms/g)].map((match) => Number(match[1])),
    runner_prompt_eval_ms: [...text.matchAll(/prompt eval time =\s+([0-9.]+) ms/g)].map((match) => Number(match[1])),
    runner_eval_ms: [...text.matchAll(/(?<!prompt )eval time =\s+([0-9.]+) ms/g)].map((match) => Number(match[1])),
    full_prompt_tokens: [...text.matchAll(/task\.n_tokens =\s+(\d+)/g)].map((match) => Number(match[1]))
  };
}

function warningEvents(text: string): readonly Record<string, unknown>[] {
  const signatures = [
    ["GPU_DISCOVERY_WATCHDOG", /GPU discovery watchdog timed out/],
    ["FREE_MEMORY_REFRESH", /unable to refresh free memory/],
    ["INSUFFICIENT_MEMORY", /insufficient memory/i],
    ["HTTP_500", /\| 500 \|/]
  ] as const;
  return text.split(/\r?\n/).flatMap((line) => {
    const signature = signatures.find((entry) => entry[1].test(line));
    if (signature === undefined) return [];
    const timestamp = line.match(/time=([^ ]+)/)?.[1] ?? null;
    return [{ signature: signature[0], timestamp, line: line.slice(0, 4096) }];
  });
}

function warningsForCall(events: readonly Record<string, unknown>[], call: CallRecord): readonly string[] {
  const start = Date.parse(call.started_at) - 2_000;
  const end = Date.parse(call.finished_at ?? call.started_at) + 2_000;
  return events.flatMap((event) => {
    const timestamp = event["timestamp"];
    const parsed = typeof timestamp === "string" ? Date.parse(timestamp) : Number.NaN;
    return Number.isFinite(parsed) && parsed >= start && parsed <= end ? [String(event["signature"])] : [];
  });
}

function sha256File(path: string): string {
  return `sha256:${createHash("sha256").update(readFileSync(path)).digest("hex")}`;
}

function gateAvailableBytes(value: ResourceSnapshot): number {
  return value.memory.windows_free_physical_bytes ?? value.memory.node_available_bytes;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args === null) {
    console.error("usage: runner.ts [--inspect-only] [--out <directory>]");
    process.exitCode = 2;
    return;
  }
  const fixture = await frozenRepresentativeFixtureV0();
  console.log(JSON.stringify({ frozen_request: fixture.shape, call_ids: NATURAL_CALL_IDS_V0 }, null, 2));
  if (!representativeFixtureMatchesFrozenV0(fixture.shape)) {
    console.error("REPRESENTATIVE_FIXTURE_DRIFT");
    process.exitCode = 3;
    return;
  }
  if (args.inspect_only) return;

  const startedAt = new Date().toISOString();
  const startingHead = command("git.exe", ["rev-parse", "HEAD"]);
  const originMain = command("git.exe", ["rev-parse", "origin/main"]);
  if (startingHead !== EXPECTED_STARTING_HEAD || originMain !== EXPECTED_STARTING_HEAD) {
    console.error("DIAGNOSTIC_BASELINE_DRIFT");
    process.exitCode = 4;
    return;
  }
  const protectedStatus = command("git.exe", [
    "status", "--short", "--untracked-files=all", "--",
    "packages/runtime", "research/experiments", "research/diagnostics/ollama-cognition-representative-load-v1"
  ]);
  if (protectedStatus.length > 0) {
    console.error(`DIAGNOSTIC_PRODUCTION_ISOLATION_FAILURE\n${protectedStatus}`);
    process.exitCode = 5;
    return;
  }

  const runId = `natural-low-resource-v0-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const outDir = args.out ?? join(DIAGNOSTIC_DIR, "evidence", runId);
  mkdirSync(outDir, { recursive: true });
  const logPath = serverLogPath();
  const logStartOffset = logPath === null ? 0 : statSync(logPath).size;
  const helperCountBefore = artificialPressureProcesses().length;
  if (helperCountBefore !== 0) {
    console.error("ARTIFICIAL_PRESSURE_PROCESS_PRESENT");
    process.exitCode = 6;
    return;
  }

  let serverIntervention: Record<string, unknown>;
  try {
    serverIntervention = await ensureOllamaServer();
  } catch (error) {
    console.error(`OLLAMA_SERVER_START_FAILURE\n${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 7;
    return;
  }
  const lock = await providerLock();
  saveJson(join(outDir, "provider-lock.json"), lock);
  saveJson(join(outDir, "request-identity.json"), {
    expected: FROZEN_REPRESENTATIVE_REQUEST_V0,
    actual: fixture.shape,
    match: true
  });
  saveJson(join(outDir, "server-intervention.json"), serverIntervention);
  if (!lock.version_match || !lock.digest_match || lock.errors.length > 0) {
    console.error(`DIAGNOSTIC_PROVIDER_DRIFT\n${JSON.stringify(lock, null, 2)}`);
    process.exitCode = 8;
    return;
  }

  const preRun = await snapshot("pre-run", null);
  saveJson(join(outDir, "snapshot-pre-run.json"), preRun);
  saveJson(join(outDir, "process-snapshot.json"), preRun.processes);
  const calls: CallRecord[] = [];
  const snapshots: ResourceSnapshot[] = [preRun];
  let stopReason: string | null = null;
  const preRunAvailable = gateAvailableBytes(preRun);
  const windowLost = preRunAvailable > WINDOW_THRESHOLD_BYTES;

  if (!windowLost) {
    let current = preRun;
    for (const callId of NATURAL_CALL_IDS_V0) {
      if (gateAvailableBytes(current) > WINDOW_THRESHOLD_BYTES) {
        stopReason = "NATURAL_LOW_RESOURCE_WINDOW_LOST_DURING_RUN";
        break;
      }
      const callDir = join(outDir, `call-${callId}`);
      mkdirSync(callDir, { recursive: true });
      const call: CallRecord = {
        call_id: callId,
        started_at: new Date().toISOString(),
        finished_at: null,
        initial_residency: residency(current),
        pre_call_snapshot: current.name,
        post_call_snapshot: null,
        events: [],
        trace: null,
        provider_result: null,
        error: null,
        runtime_monitor: null
      };
      const observer = (event: ModelTransportTraceEventV0 | ModelTransportTraceV0): void => {
        if ("stage" in event) call.events.push(event);
        else call.trace = event;
      };
      const transport = new OllamaNativeCognitionTransportV0({
        base_url: PROVIDER_LOCK_NATURAL_V0.base_url,
        model: PROVIDER_LOCK_NATURAL_V0.model,
        timeout_ms: PROVIDER_LOCK_NATURAL_V0.timeout_ms,
        num_predict: PROVIDER_LOCK_NATURAL_V0.num_predict,
        trace_observer: observer
      });
      const provider = new LlmCognitionProviderV0(transport, { temperature: 0 });
      const monitor = startRuntimeMonitor();
      try {
        call.provider_result = await provider.propose(fixture.projection);
      } catch (error) {
        call.error = boundedError(error);
      } finally {
        call.runtime_monitor = monitor.stop();
      }
      call.finished_at = new Date().toISOString();
      const post = await snapshot(`after-call-${callId}`, callId);
      call.post_call_snapshot = post.name;
      calls.push(call);
      snapshots.push(post);
      current = post;
      saveJson(join(callDir, "events.json"), call.events);
      saveJson(join(callDir, "trace.json"), call.trace);
      saveJson(join(callDir, "provider-result.json"), call.provider_result);
      saveJson(join(callDir, "error.json"), call.error);
      saveJson(join(callDir, "runtime-monitor.json"), call.runtime_monitor);
      saveJson(join(callDir, "recording.json"), {
        call_id: call.call_id,
        started_at: call.started_at,
        finished_at: call.finished_at,
        initial_residency: call.initial_residency,
        pre_call_snapshot: call.pre_call_snapshot,
        post_call_snapshot: call.post_call_snapshot
      });
      saveJson(join(outDir, `snapshot-after-call-${callId}.json`), post);
      console.log(
        `call-${callId} ${call.error === null ? "SUCCESS" : "ERROR"} ` +
        `RAM=${Math.round(gateAvailableBytes(post) / MIB)}MiB elapsed=${call.trace?.elapsed_ms ?? "null"}ms`
      );

      const traceDrift = call.trace !== null &&
        (call.trace.request_hash !== FROZEN_REPRESENTATIVE_REQUEST_V0.request_hash ||
          call.trace.request_bytes !== FROZEN_REPRESENTATIVE_REQUEST_V0.post_bytes);
      if (traceDrift || call.trace === null) {
        stopReason = traceDrift ? "REQUEST_IDENTITY_DRIFT" : "TRANSPORT_TRACE_UNAVAILABLE";
        break;
      }
      if (post.probe_errors.length > 0 || post.artificial_pressure_processes.length > 0) {
        stopReason = post.probe_errors.length > 0 ? "RESOURCE_PROBE_UNRELIABLE" : "ARTIFICIAL_PRESSURE_APPEARED";
        break;
      }
      if (post.memory.severe_paging_threshold_observed || (call.runtime_monitor?.maximum_event_loop_gap_ms ?? 0) >= 5_000) {
        stopReason = post.memory.severe_paging_threshold_observed
          ? "SEVERE_PAGING_THRESHOLD_OBSERVED"
          : "SYSTEM_RESPONSIVENESS_DEGRADED";
        break;
      }
      if (!post.health.server.reachable) {
        stopReason = "OLLAMA_SERVER_UNREACHABLE_AFTER_CALL";
        break;
      }
    }
  }

  const log = logWindow(logPath, logStartOffset);
  writeFileSync(join(outDir, "server-log-window.txt"), log.text, "utf8");
  const logAnalysis = analyzeLog(log.text);
  const warnings = warningEvents(log.text);
  saveJson(join(outDir, "server-log-window.json"), {
    ...log.metadata,
    slice_file: "server-log-window.txt",
    analysis: logAnalysis,
    warning_events: warnings
  });

  const traceIdentityOk = calls.every((call) =>
    call.trace?.request_hash === FROZEN_REPRESENTATIVE_REQUEST_V0.request_hash &&
    call.trace.request_bytes === FROZEN_REPRESENTATIVE_REQUEST_V0.post_bytes
  );
  const timeoutObserved = calls.some((call) => call.trace?.failure_code === "MODEL_TIMEOUT");
  const nonTimeoutFailure = calls.some((call) => call.error !== null && call.trace?.failure_code !== "MODEL_TIMEOUT");
  const cacheUpdates = logAnalysis["prompt_cache_update_ms"] as readonly number[];
  const slowCache = cacheUpdates.some((value) => value >= 5_000);
  const slowPrompt = calls.some((call) => (call.trace?.ollama.prompt_eval_duration ?? 0) >= 5_000_000_000);
  const residentSlowCount = calls.filter((call) =>
    call.initial_residency === "RESIDENT" && (call.trace?.elapsed_ms ?? 0) >= 15_000
  ).length;
  const warningCount = Number(logAnalysis["gpu_discovery_watchdog_warnings"]) +
    Number(logAnalysis["free_memory_refresh_warnings"]) + Number(logAnalysis["insufficient_memory_warnings"]);
  const materialDegradation = slowCache || slowPrompt || residentSlowCount >= 2 ||
    (warningCount > 0 && calls.some((call) => (call.trace?.elapsed_ms ?? 0) >= 40_000));
  const incomplete = !windowLost && calls.length < NATURAL_CALL_IDS_V0.length;
  const technicalFailure = nonTimeoutFailure || !traceIdentityOk || (incomplete && !timeoutObserved);
  const resultCategory = windowLost
    ? "NATURAL_LOW_RESOURCE_WINDOW_LOST"
    : technicalFailure
      ? "TECHNICAL_DIAGNOSTIC_FAILURE"
      : timeoutObserved
        ? "NATURAL_LOW_RESOURCE_TIMEOUT_REPRODUCED"
        : materialDegradation
          ? "NATURAL_LOW_RESOURCE_DEGRADATION_REPRODUCED"
          : "NATURAL_LOW_RESOURCE_NO_REPRODUCTION";

  let rootCauseCategory = "UNKNOWN_TRANSPORT_CAUSE";
  let rootCauseConfidence = "LOW";
  let nextSlice = "READY_FOR_ADDITIONAL_OBSERVATION";
  if (resultCategory === "NATURAL_LOW_RESOURCE_TIMEOUT_REPRODUCED") {
    rootCauseCategory = "ENVIRONMENTAL_RESOURCE_CONTENTION_SUSPECTED";
    rootCauseConfidence = "HIGH";
    nextSlice = "READY_FOR_ENVIRONMENT_STABILIZATION_DESIGN";
  } else if (resultCategory === "NATURAL_LOW_RESOURCE_DEGRADATION_REPRODUCED") {
    rootCauseCategory = Number(logAnalysis["gpu_discovery_watchdog_warnings"]) > 0
      ? "GPU_WDDM_CONTENTION_SUSPECTED"
      : "ENVIRONMENTAL_RESOURCE_CONTENTION_SUSPECTED";
    rootCauseConfidence = "MEDIUM";
    nextSlice = Number(logAnalysis["gpu_discovery_watchdog_warnings"]) > 0
      ? "READY_FOR_GPU_WDDM_DIAGNOSTIC"
      : "READY_FOR_ENVIRONMENT_STABILIZATION_DESIGN";
  } else if (resultCategory === "NATURAL_LOW_RESOURCE_NO_REPRODUCTION") {
    rootCauseCategory = "LOW_AVAILABLE_RAM_ALONE_INSUFFICIENT";
    rootCauseConfidence = "HIGH";
    nextSlice = "READY_FOR_OLLAMA_INTERNAL_STATE_DIAGNOSTIC";
  }

  const callRows = calls.map((call) => {
    const pre = snapshots.find((item) => item.name === call.pre_call_snapshot) ?? null;
    const deltaForce = pre?.processes.delta_force[0] ?? null;
    const ollama = pre?.processes.ollama ?? [];
    const trace = call.trace;
    return {
      call: call.call_id,
      available_ram_bytes: pre === null ? null : gateAvailableBytes(pre),
      node_available_ram_bytes: pre?.memory.node_available_bytes ?? null,
      delta_force_working_set_bytes: deltaForce?.working_set_bytes ?? null,
      delta_force_private_memory_bytes: deltaForce?.private_memory_bytes ?? null,
      ollama_processes: ollama,
      model_resident: call.initial_residency === "RESIDENT",
      gpu_memory_used_mib: pre?.gpu.memory_used_mib ?? null,
      gpu_memory_total_mib: pre?.gpu.memory_total_mib ?? null,
      gpu_utilization_percent: pre?.gpu.utilization_percent ?? null,
      gpu_temperature_c: pre?.gpu.temperature_c ?? null,
      pagefile_current_usage_mib: pre?.memory.pagefile_current_usage_mib ?? null,
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
      abort_elapsed_ms: trace?.abort_triggered_elapsed_ms ?? null,
      terminal_stage: trace?.terminal_stage ?? null,
      response_status: trace?.response_status ?? null,
      failure_code: trace?.failure_code ?? null,
      raw_error_name: trace?.raw_error_name ?? null,
      raw_error_message: trace?.raw_error_message ?? null,
      done_reason: trace?.ollama.done_reason ?? null,
      runtime_monitor: call.runtime_monitor,
      warnings: warningsForCall(warnings, call),
      outcome: call.error === null ? "SUCCESS" : call.trace?.failure_code ?? call.error.code ?? "FAILURE"
    };
  });

  const helperCountAfter = artificialPressureProcesses().length;
  const finishedAt = new Date().toISOString();
  const summary: Record<string, unknown> = {
    ...NATURAL_LOW_RESOURCE_PROTOCOL_V0,
    run_id: runId,
    evidence_path: outDir,
    started_at: startedAt,
    finished_at: finishedAt,
    starting_head: startingHead,
    origin_main_at_start: originMain,
    server_intervention: serverIntervention,
    provider_lock: lock,
    fixture: { expected: FROZEN_REPRESENTATIVE_REQUEST_V0, actual: fixture.shape, match: true },
    natural_window_gate: {
      threshold_bytes: WINDOW_THRESHOLD_BYTES,
      pre_run_available_bytes: preRunAvailable,
      passed: !windowLost
    },
    pre_run_snapshot: preRun,
    model_call_counts: { cognition: calls.length, language: 0, evaluator: 0 },
    calls: callRows,
    stop_reason: stopReason,
    server_log: { ...log.metadata, analysis: logAnalysis, warning_events: warnings },
    result_thresholds: {
      slow_prompt_ms: 5_000,
      slow_cache_update_ms: 5_000,
      resident_slow_ms: 15_000,
      resident_slow_count: 2
    },
    result_category: resultCategory,
    root_cause_category: rootCauseCategory,
    root_cause_confidence: rootCauseConfidence,
    next_slice: nextSlice,
    comparison: {
      r3: R3_REFERENCE_V0,
      healthy_representative_v1: HEALTHY_REPRESENTATIVE_V1_REFERENCE
    },
    integrity: {
      model_calls_at_most_four: calls.length <= 4,
      language_calls: 0,
      evaluator_calls: 0,
      exactly_one_request_hash: calls.length > 0 && new Set(calls.map((call) => call.trace?.request_hash)).size === 1,
      frozen_request_match: true,
      artificial_pressure_processes_before: helperCountBefore,
      artificial_pressure_processes_after: helperCountAfter,
      production_paths_changed_before_run: false,
      retries: 0,
      warm_up_calls: 0,
      timeout_ms: 120000,
      delta_force_mutations: 0,
      model_residency_mutations: 0
    }
  };
  saveJson(join(outDir, "summary.json"), summary);
  saveJson(join(outDir, "manifest.json"), {
    schema_version: "ollama-natural-low-resource-manifest-v0",
    run_id: runId,
    starting_head: startingHead,
    origin_main_at_start: originMain,
    protected_status_before_run: protectedStatus,
    server_log_start_offset: logStartOffset,
    protocol_sha256: sha256File(join(DIAGNOSTIC_DIR, "protocol.ts")),
    runner_sha256: sha256File(join(DIAGNOSTIC_DIR, "runner.ts")),
    frozen_fixture_sha256: sha256File(resolve(DIAGNOSTIC_DIR, "../ollama-cognition-representative-load-v1/fixture.ts")),
    diagnostic_only: true,
    artificial_pressure: false
  });
  console.log(`${resultCategory}\nsummary=${join(outDir, "summary.json")}`);
}

await main();
