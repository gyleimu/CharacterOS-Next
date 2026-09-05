/* eslint-disable no-restricted-imports -- Manual local diagnostic orchestrator only. */

import { execFileSync } from "node:child_process";
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
  type ModelTransportTraceV0
} from "../../../packages/runtime/dist/index.js";
import {
  DIAGNOSTIC_PROTOCOL_V1,
  PROVIDER_LOCK_V1,
  captureRepresentativeRequestV1,
  collectRepresentativeCallV1,
  measureRepresentativeRequestV1,
  representativeFixtureAchievedV1,
  representativeProjectionV1,
  type RepresentativeCallRecordingV1
} from "./fixture.ts";

const DIAGNOSTIC_DIR = fileURLToPath(new URL(".", import.meta.url));
const REPOSITORY_ROOT = resolve(DIAGNOSTIC_DIR, "../../..");
const EXPECTED_STARTING_HEAD = "982397aee7442af9d990c0e5b4bd454f277398db";
const SLOW_THRESHOLD_MS = 50_000;

interface Args {
  inspect_only: boolean;
  out: string | null;
  server_intervention: string;
}

interface ProviderLockRecord {
  readonly expected: typeof PROVIDER_LOCK_V1;
  readonly actual: { readonly version: string | null; readonly model: string; readonly digest: string | null };
  readonly version_match: boolean;
  readonly digest_match: boolean;
  readonly checked_at: string;
  readonly errors: readonly string[];
}

interface SystemSnapshotV1 {
  readonly schema_version: "ollama-cognition-representative-load-snapshot-v1";
  readonly name: string;
  readonly captured_at: string;
  readonly health: Awaited<ReturnType<typeof captureOllamaDiagnosticHealthSnapshotV0>>;
  readonly system_memory: { readonly total_bytes: number; readonly free_bytes: number };
  readonly gpu: {
    readonly available: boolean;
    readonly name: string | null;
    readonly memory_used_mib: number | null;
    readonly memory_total_mib: number | null;
    readonly utilization_percent: number | null;
    readonly temperature_c: number | null;
  };
  readonly ollama_processes: readonly {
    readonly pid: number | null;
    readonly process_name: string | null;
    readonly started_at: string | null;
    readonly working_set_bytes: number | null;
  }[];
  readonly probe_errors: readonly string[];
}

function parseArgs(argv: readonly string[]): Args | null {
  const parsed: Args = { inspect_only: false, out: null, server_intervention: "none" };
  for (let index = 0; index < argv.length; index++) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (flag === "--inspect-only") parsed.inspect_only = true;
    else if (flag === "--out" && typeof value === "string") { parsed.out = resolve(value); index++; }
    else if (flag === "--server-intervention" && typeof value === "string") {
      parsed.server_intervention = value;
      index++;
    } else return null;
  }
  return parsed;
}

function saveJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function textCommand(executable: string, args: readonly string[], timeout = 10_000): string {
  return execFileSync(executable, args, {
    cwd: REPOSITORY_ROOT,
    encoding: "utf8",
    windowsHide: true,
    timeout
  }).trim();
}

function optionalCommand(executable: string, args: readonly string[]): string | null {
  try {
    return textCommand(executable, args);
  } catch {
    return null;
  }
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
  const versionResult = await fetchJson(`${PROVIDER_LOCK_V1.base_url}/api/version`);
  const tagsResult = await fetchJson(`${PROVIDER_LOCK_V1.base_url}/api/tags`);
  if (versionResult.error !== null) errors.push(`GET /api/version: ${versionResult.error}`);
  if (tagsResult.error !== null) errors.push(`GET /api/tags: ${tagsResult.error}`);
  const versionCandidate = (versionResult.body as { version?: unknown } | null)?.version;
  const version = typeof versionCandidate === "string" ? versionCandidate : null;
  const modelsCandidate = (tagsResult.body as { models?: unknown } | null)?.models;
  const models = Array.isArray(modelsCandidate) ? modelsCandidate : [];
  const selected = models.find((entry) => {
    const record = entry as { name?: unknown; model?: unknown };
    return record.name === PROVIDER_LOCK_V1.model || record.model === PROVIDER_LOCK_V1.model;
  }) as { digest?: unknown } | undefined;
  const digest = typeof selected?.digest === "string" ? selected.digest : null;
  return {
    expected: PROVIDER_LOCK_V1,
    actual: { version, model: PROVIDER_LOCK_V1.model, digest },
    version_match: version === PROVIDER_LOCK_V1.version,
    digest_match: digest === PROVIDER_LOCK_V1.digest,
    checked_at: new Date().toISOString(),
    errors
  };
}

function gpuSnapshot(): SystemSnapshotV1["gpu"] {
  const raw = optionalCommand("nvidia-smi.exe", [
    "--query-gpu=name,memory.used,memory.total,utilization.gpu,temperature.gpu",
    "--format=csv,noheader,nounits"
  ]);
  if (raw === null) {
    return {
      available: false,
      name: null,
      memory_used_mib: null,
      memory_total_mib: null,
      utilization_percent: null,
      temperature_c: null
    };
  }
  const row = raw.split(/\r?\n/, 1)[0]?.split(",").map((value) => value.trim()) ?? [];
  const numberAt = (index: number): number | null => {
    const value = Number(row[index]);
    return Number.isFinite(value) ? value : null;
  };
  return {
    available: true,
    name: row[0] ?? null,
    memory_used_mib: numberAt(1),
    memory_total_mib: numberAt(2),
    utilization_percent: numberAt(3),
    temperature_c: numberAt(4)
  };
}

function ollamaProcesses(): SystemSnapshotV1["ollama_processes"] {
  const script = [
    "$p=Get-Process -Name ollama,'ollama app' -ErrorAction SilentlyContinue |",
    "Select-Object @{n='pid';e={$_.Id}},@{n='process_name';e={$_.ProcessName}},",
    "@{n='started_at';e={$_.StartTime.ToString('o')}},@{n='working_set_bytes';e={$_.WorkingSet64}};",
    "@($p) | ConvertTo-Json -Compress"
  ].join(" ");
  const raw = optionalCommand("powershell.exe", ["-NoProfile", "-Command", script]);
  if (raw === null || raw.length === 0) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    const rows = Array.isArray(parsed) ? parsed : [parsed];
    return rows.map((entry) => {
      const record = entry as Record<string, unknown>;
      return {
        pid: typeof record["pid"] === "number" ? record["pid"] : null,
        process_name: typeof record["process_name"] === "string" ? record["process_name"] : null,
        started_at: typeof record["started_at"] === "string" ? record["started_at"] : null,
        working_set_bytes:
          typeof record["working_set_bytes"] === "number" ? record["working_set_bytes"] : null
      };
    });
  } catch {
    return [];
  }
}

async function captureSnapshot(name: string): Promise<SystemSnapshotV1> {
  const errors: string[] = [];
  const health = await captureOllamaDiagnosticHealthSnapshotV0({ base_url: PROVIDER_LOCK_V1.base_url });
  if (health.probe_errors.length > 0) errors.push(...health.probe_errors);
  const processes = ollamaProcesses();
  if (processes.length === 0) errors.push("Ollama process identity unavailable");
  const snapshot: SystemSnapshotV1 = {
    schema_version: "ollama-cognition-representative-load-snapshot-v1",
    name,
    captured_at: new Date().toISOString(),
    health,
    system_memory: { total_bytes: totalmem(), free_bytes: freemem() },
    gpu: gpuSnapshot(),
    ollama_processes: processes,
    probe_errors: errors
  };
  return snapshot;
}

function serverLogPath(): string | null {
  const localAppData = process.env["LOCALAPPDATA"];
  if (typeof localAppData !== "string") return null;
  const candidate = join(localAppData, "Ollama", "server.log");
  return existsSync(candidate) ? candidate : null;
}

function captureLogWindow(path: string | null, startOffset: number): {
  metadata: Record<string, unknown>;
  text: string;
} {
  if (path === null || !existsSync(path)) {
    return { metadata: { available: false, path, reason: "server.log unavailable" }, text: "" };
  }
  const all = readFileSync(path);
  const effectiveStart = all.length >= startOffset ? startOffset : 0;
  const slice = all.subarray(effectiveStart);
  return {
    metadata: {
      available: true,
      path,
      file_name: basename(path),
      start_offset: effectiveStart,
      end_offset: all.length,
      bytes: slice.length,
      rotated_or_truncated: effectiveStart !== startOffset,
      captured_at: new Date().toISOString()
    },
    text: slice.toString("utf8")
  };
}

function sha256File(path: string): string {
  return `sha256:${createHash("sha256").update(readFileSync(path)).digest("hex")}`;
}

function boundedError(error: unknown): RepresentativeCallRecordingV1["error"] {
  const record = error as { name?: unknown; message?: unknown; code?: unknown };
  return {
    name: typeof record?.name === "string" ? record.name : "Unknown",
    message: (typeof record?.message === "string" ? record.message : String(error)).slice(0, 2048),
    code: typeof record?.code === "string" ? record.code : null
  };
}

function analyzeLog(text: string): Record<string, unknown> {
  const count = (pattern: RegExp): number => [...text.matchAll(pattern)].length;
  const promptTokens = [...text.matchAll(/task\.n_tokens =\s+(\d+)/g)].map((match) => Number(match[1]));
  const cacheUpdateMs = [...text.matchAll(/prompt cache update took ([0-9.]+) ms/g)].map((match) => Number(match[1]));
  return {
    api_chat_requests: count(/POST\s+"\/api\/chat"/g),
    gpu_discovery_watchdog_warnings: count(/GPU discovery watchdog timed out/g),
    free_memory_refresh_warnings: count(/unable to refresh free memory/g),
    model_load_events: count(/loading model via llama-server/g),
    model_unload_events: count(/unload|unloaded model/gi),
    cancel_events: count(/cancel task/g),
    release_events: count(/slot\s+release:/g),
    prompt_cache_update_ms: cacheUpdateMs,
    full_prompt_tokens: promptTokens,
    unique_full_prompt_tokens: [...new Set(promptTokens)]
  };
}

function toMs(value: number | null): number | null {
  return value === null ? null : Math.round(value / 1_000_000 * 100) / 100;
}

function markdownReport(summary: Record<string, unknown>): string {
  const calls = summary["calls"] as readonly Record<string, unknown>[];
  const shape = summary["request_shape"] as Record<string, unknown>;
  const lock = summary["provider_lock"] as ProviderLockRecord;
  const rows = calls.map((call) => {
    const trace = call["trace"] as ModelTransportTraceV0;
    return `| ${call["call"]} | ${call["initial_residency"]} | ${trace.elapsed_ms} | ${trace.fetch_response_elapsed_ms} | ${trace.body_read_elapsed_ms} | ${trace.abort_triggered} | ${trace.terminal_stage} | ${call["provider_outcome"]} | ${toMs(trace.ollama.load_duration)} / ${toMs(trace.ollama.prompt_eval_duration)} / ${toMs(trace.ollama.eval_duration)} | ${trace.ollama.prompt_eval_count} / ${trace.ollama.eval_count} |`;
  }).join("\n");
  return `# OLLAMA_COGNITION_REPRESENTATIVE_LOAD_DIAGNOSTIC_V1\n\n` +
    `Run id: \`${summary["run_id"]}\`  \n` +
    `Result: **${summary["result_category"]}**  \n` +
    `Root cause: **${summary["root_cause_category"]} / ${summary["root_cause_confidence"]}**  \n` +
    `Next slice: **${summary["next_slice"]}**\n\n` +
    `## Request shape\n\n` +
    `- POST bytes: ${shape["post_bytes"]}\n- Messages: ${shape["message_count"]}\n` +
    `- System/user bytes: ${shape["system_content_bytes"]} / ${shape["user_content_bytes"]}\n` +
    `- Pre-run token estimate: ${shape["approximate_prompt_tokens"]} (${shape["token_estimate_method"]})\n` +
    `- Request hash: \`${shape["request_hash"]}\`\n\n` +
    `## Provider lock\n\nOllama ${lock.actual.version}; ${lock.actual.model}; digest \`${lock.actual.digest}\`; exact lock match.\n\n` +
    `## Calls\n\n| Call | Initial residency | Total ms | Fetch ms | Body ms | Abort | Stage | Provider | Load/prompt/eval ms | Prompt/eval tokens |\n` +
    `|---:|---|---:|---:|---:|---|---|---|---|---|\n${rows}\n\n` +
    `Exactly four cognition calls; zero language calls; zero evaluator calls; no retry or warm-up.\n\n` +
    `## Boundaries\n\nThis is diagnostic evidence only. It creates no canonical state and supports no scientific or behavioral causal claim.\n`;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args === null) {
    console.error("usage: runner.ts [--inspect-only] [--out <dir>] [--server-intervention <note>]");
    process.exitCode = 2;
    return;
  }

  const projection = await representativeProjectionV1();
  const request = await captureRepresentativeRequestV1(projection);
  const requestShape = measureRepresentativeRequestV1(projection, request);
  console.log(JSON.stringify({ offline_request_shape: requestShape }, null, 2));
  if (!representativeFixtureAchievedV1(requestShape)) {
    console.error("REPRESENTATIVE_FIXTURE_NOT_ACHIEVED");
    process.exitCode = 4;
    return;
  }
  if (args.inspect_only) return;

  const startingHead = textCommand("git.exe", ["rev-parse", "HEAD"]);
  const originMain = textCommand("git.exe", ["rev-parse", "origin/main"]);
  if (startingHead !== EXPECTED_STARTING_HEAD || originMain !== EXPECTED_STARTING_HEAD) {
    console.error("DIAGNOSTIC_BASELINE_DRIFT");
    process.exitCode = 5;
    return;
  }
  const productionDiff = textCommand("git.exe", [
    "diff", "--name-only", "--", "packages/runtime", "research/experiments"
  ]);
  if (productionDiff.length > 0) {
    console.error(`DIAGNOSTIC_PRODUCTION_ISOLATION_FAILURE\n${productionDiff}`);
    process.exitCode = 6;
    return;
  }

  const logPath = serverLogPath();
  const logStartOffset = logPath === null ? 0 : statSync(logPath).size;
  const lock = await providerLock();
  if (!lock.version_match || !lock.digest_match || lock.errors.length > 0) {
    console.error(`DIAGNOSTIC_PROVIDER_DRIFT\n${JSON.stringify(lock, null, 2)}`);
    process.exitCode = 7;
    return;
  }
  const snapshotPrerun = await captureSnapshot("snapshot-prerun");

  const runId = `representative-v1-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const outDir = args.out ?? join(DIAGNOSTIC_DIR, "evidence", runId);
  mkdirSync(outDir, { recursive: true });
  saveJson(join(outDir, "provider-lock.json"), lock);
  saveJson(join(outDir, "request-shape.json"), requestShape);
  saveJson(join(outDir, "projection.json"), projection);
  saveJson(join(outDir, "snapshot-prerun.json"), snapshotPrerun);

  const recordings: RepresentativeCallRecordingV1[] = [];
  const snapshots: SystemSnapshotV1[] = [snapshotPrerun];
  for (let callIndex = 1; callIndex <= DIAGNOSTIC_PROTOCOL_V1.call_count; callIndex++) {
    const callDir = join(outDir, `call-0${callIndex}`);
    mkdirSync(callDir, { recursive: true });
    const { recording, observer } = collectRepresentativeCallV1(callIndex);
    saveJson(join(callDir, "recording-start.json"), {
      call_index: callIndex,
      started_at: recording.started_at
    });
    const transport = new OllamaNativeCognitionTransportV0({
      base_url: PROVIDER_LOCK_V1.base_url,
      model: PROVIDER_LOCK_V1.model,
      timeout_ms: PROVIDER_LOCK_V1.timeout_ms,
      num_predict: PROVIDER_LOCK_V1.num_predict,
      trace_observer: observer
    });
    const provider = new LlmCognitionProviderV0(transport, { temperature: 0 });
    try {
      recording.provider_result = await provider.propose(projection);
    } catch (error) {
      recording.error = boundedError(error);
    }
    recording.finished_at = new Date().toISOString();
    saveJson(join(callDir, "events.json"), recording.events);
    saveJson(join(callDir, "trace.json"), recording.trace);
    saveJson(join(callDir, "provider-result.json"), recording.provider_result);
    saveJson(join(callDir, "error.json"), recording.error);
    saveJson(join(callDir, "recording.json"), {
      call_index: recording.call_index,
      started_at: recording.started_at,
      finished_at: recording.finished_at
    });
    recordings.push(recording);

    const snapshot = await captureSnapshot(`snapshot-after-call-${callIndex}`);
    snapshots.push(snapshot);
    saveJson(join(outDir, `snapshot-after-call-${callIndex}.json`), snapshot);
    console.log(
      `CALL_0${callIndex} ${recording.error === null ? "SUCCESS" : "ERROR"} ` +
      `elapsed=${recording.trace?.elapsed_ms ?? "null"} stage=${recording.trace?.terminal_stage ?? "null"}`
    );
  }

  const logWindow = captureLogWindow(logPath, logStartOffset);
  writeFileSync(join(outDir, "server-log-window.txt"), logWindow.text, "utf8");
  const logAnalysis = analyzeLog(logWindow.text);
  saveJson(join(outDir, "server-log-window.json"), {
    ...logWindow.metadata,
    slice_file: "server-log-window.txt",
    analysis: logAnalysis
  });

  const traces = recordings.map((recording) => recording.trace);
  const missingTrace = traces.some((trace) => trace === null);
  const traceMismatch = traces.some(
    (trace) => trace !== null &&
      (trace.request_hash !== requestShape.request_hash || trace.request_bytes !== requestShape.post_bytes)
  );
  const providerErrors = recordings.some((recording) => recording.error !== null);
  const nonTimeoutFailure = traces.some(
    (trace) => trace !== null && trace.outcome === "FAILURE" && trace.failure_code !== "MODEL_TIMEOUT"
  );
  const timeout = traces.some((trace) => trace?.failure_code === "MODEL_TIMEOUT");
  const maxElapsed = Math.max(...traces.map((trace) => trace?.elapsed_ms ?? 0));
  const technicalFailure = missingTrace || traceMismatch || providerErrors || nonTimeoutFailure;
  const resultCategory = timeout
    ? "REPRESENTATIVE_DIAGNOSTIC_REPRODUCED_TIMEOUT"
    : technicalFailure
      ? "TECHNICAL_DIAGNOSTIC_FAILURE"
      : maxElapsed >= SLOW_THRESHOLD_MS
        ? "REPRESENTATIVE_DIAGNOSTIC_SLOW_NO_TIMEOUT"
        : "REPRESENTATIVE_DIAGNOSTIC_NORMAL";

  const warningCount = Number(logAnalysis["gpu_discovery_watchdog_warnings"]) +
    Number(logAnalysis["free_memory_refresh_warnings"]);
  const lowRam = snapshots.some((snapshot) => snapshot.system_memory.free_bytes < 1_073_741_824);
  const promptDurations = traces
    .map((trace) => trace?.ollama.prompt_eval_duration ?? 0)
    .filter((value) => value > 0);
  const maxPromptMs = promptDurations.length === 0 ? 0 : Math.max(...promptDurations) / 1_000_000;

  let rootCauseCategory = "UNKNOWN_TRANSPORT_CAUSE";
  let rootCauseConfidence = "LOW";
  let nextSlice = "READY_FOR_ADDITIONAL_OBSERVATION";
  if (resultCategory === "REPRESENTATIVE_DIAGNOSTIC_NORMAL") {
    rootCauseCategory = "ENVIRONMENTAL_RESOURCE_CONTENTION_SUSPECTED";
    rootCauseConfidence = "MEDIUM";
    nextSlice = "READY_FOR_ENVIRONMENT_RESOURCE_DIAGNOSTIC";
  } else if (resultCategory === "REPRESENTATIVE_DIAGNOSTIC_SLOW_NO_TIMEOUT" && maxPromptMs >= 50_000) {
    rootCauseCategory = "PROMPT_PROCESSING_UNDER_RESOURCE_PRESSURE_SUSPECTED";
    rootCauseConfidence = warningCount > 0 || lowRam ? "HIGH" : "MEDIUM";
    nextSlice = "READY_FOR_PROMPT_PROCESSING_DIAGNOSTIC";
  } else if (resultCategory === "REPRESENTATIVE_DIAGNOSTIC_SLOW_NO_TIMEOUT") {
    rootCauseCategory = "PROVIDER_CAPACITY_OR_QUEUE_SUSPECTED";
    rootCauseConfidence = "MEDIUM";
    nextSlice = "READY_FOR_PROMPT_PROCESSING_DIAGNOSTIC";
  } else if (timeout && (warningCount > 0 || lowRam)) {
    rootCauseCategory = "PROMPT_PROCESSING_UNDER_RESOURCE_PRESSURE_SUSPECTED";
    rootCauseConfidence = "HIGH";
    nextSlice = "READY_FOR_ENVIRONMENT_RESOURCE_DIAGNOSTIC";
  }

  const callRows = recordings.map((recording, index) => ({
    call: recording.call_index,
    initial_residency: snapshots[index]?.health.server.loaded_models.some(
      (model) => model.name === PROVIDER_LOCK_V1.model || model.model === PROVIDER_LOCK_V1.model
    ) ? "RESIDENT" : "NOT_RESIDENT",
    pre_call_snapshot: snapshots[index]?.name ?? null,
    post_call_snapshot: snapshots[index + 1]?.name ?? null,
    provider_outcome: recording.error === null ? "SUCCESS" : "FAILURE",
    provider_error: recording.error,
    trace: recording.trace
  }));
  const summary: Record<string, unknown> = {
    ...DIAGNOSTIC_PROTOCOL_V1,
    run_id: runId,
    evidence_path: outDir,
    started_at: snapshotPrerun.captured_at,
    finished_at: snapshots.at(-1)?.captured_at ?? null,
    starting_head: startingHead,
    origin_main_at_start: originMain,
    server_intervention: args.server_intervention,
    request_shape: requestShape,
    provider_lock: lock,
    model_call_counts: { cognition: 4, language: 0, evaluator: 0 },
    calls: callRows,
    server_log: { ...logWindow.metadata, analysis: logAnalysis },
    result_category: resultCategory,
    result_thresholds: { slow_elapsed_ms: SLOW_THRESHOLD_MS },
    root_cause_category: rootCauseCategory,
    root_cause_confidence: rootCauseConfidence,
    next_slice: nextSlice,
    cross_diagnostic_reference: {
      r3: { post_bytes: [4234, 4280], prompt_tokens: [980, 997], initial_timeouts: 9 },
      v0_run_1: { post_bytes: 229, cold_elapsed_ms: 23663, warm_elapsed_ms: [121, 120, 115] },
      v0_run_2: { post_bytes: 229, cold_elapsed_ms: 8152, warm_elapsed_ms: [172, 110, 112] }
    },
    integrity: {
      exactly_four_traces: traces.length === 4 && !missingTrace,
      exactly_one_request_hash: new Set(traces.map((trace) => trace?.request_hash)).size === 1,
      request_hash_matches_offline: !traceMismatch,
      production_paths_changed_before_run: false,
      retries: 0,
      warm_up_calls: 0
    }
  };
  saveJson(join(outDir, "summary.json"), summary);
  writeFileSync(join(outDir, "SUMMARY.md"), markdownReport(summary), "utf8");
  saveJson(join(outDir, "manifest.json"), {
    schema_version: "ollama-cognition-representative-load-manifest-v1",
    run_id: runId,
    starting_head: startingHead,
    origin_main_at_start: originMain,
    fixture_file: "research/diagnostics/ollama-cognition-representative-load-v1/fixture.ts",
    fixture_sha256: sha256File(join(DIAGNOSTIC_DIR, "fixture.ts")),
    runner_file: "research/diagnostics/ollama-cognition-representative-load-v1/runner.ts",
    runner_sha256: sha256File(join(DIAGNOSTIC_DIR, "runner.ts")),
    production_diff_before_run: productionDiff,
    diagnostic_only: true
  });
  console.log(`${resultCategory}\nsummary=${join(outDir, "summary.json")}`);
}

await main();
