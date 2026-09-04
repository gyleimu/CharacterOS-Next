/* eslint-disable no-restricted-imports -- Diagnostic runner only; built public transport seam. */

/**
 * OLLAMA_COGNITION_TRANSPORT_DIAGNOSTIC_V0 — neutral four-call reproduction runner.
 *
 * MANUAL DIAGNOSTIC TOOL — never part of gates, never run by CI, zero canonical
 * authority, zero experiment-protocol coupling. Run only when an operator
 * deliberately reproduces the local Ollama cognition transport behavior:
 *
 *   node research/diagnostics/ollama-cognition-transport-v0/runner.ts --model <tag> [--base-url http://127.0.0.1:11434] [--out <dir>]
 *
 * Protocol: health snapshot (START) → FOUR byte-identical neutral transport
 * calls, each fully traced by its own observer (health snapshot MIDWAY after
 * call 2) → health snapshot (FINAL). Artifacts land under
 * `<out>/call-0N/…` plus `snapshot-start|midway|final.json` and `summary.json`.
 * The runner records reality; it asserts nothing and repairs nothing.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  captureOllamaDiagnosticHealthSnapshotV0,
  OllamaNativeCognitionTransportV0
} from "../../../packages/runtime/dist/index.js";
import {
  DIAGNOSTIC_PROTOCOL_V0,
  collectDiagnosticCallV0,
  neutralRequest,
  summarizeCallV0
} from "./fixture.ts";

const DIAGNOSTIC_DIR = fileURLToPath(new URL(".", import.meta.url));
const DEFAULT_BASE_URL = "http://127.0.0.1:11434";
const CALL_COUNT = DIAGNOSTIC_PROTOCOL_V0.call_count;

interface Args {
  base_url: string;
  model: string;
  out: string | null;
}

function parseArgs(argv: readonly string[]): Args | null {
  const args: Args = { base_url: DEFAULT_BASE_URL, model: "", out: null };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === "--base-url" && typeof value === "string") { args.base_url = value; i++; }
    else if (flag === "--model" && typeof value === "string") { args.model = value; i++; }
    else if (flag === "--out" && typeof value === "string") { args.out = resolve(value); i++; }
    else return null;
  }
  return args.model.length > 0 ? args : null;
}

function saveJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args === null) {
    console.error("usage: runner.ts --model <tag> [--base-url http://127.0.0.1:11434] [--out <dir>]");
    process.exitCode = 2;
    return;
  }

  const runId = `diag-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const outDir = args.out ?? join(DIAGNOSTIC_DIR, "evidence", runId);
  mkdirSync(outDir, { recursive: true });
  console.log(`DIAGNOSTIC RUN ${runId} -> ${outDir}`);

  const request = neutralRequest();

  const snapshotStart = await captureOllamaDiagnosticHealthSnapshotV0({ base_url: args.base_url });
  saveJson(join(outDir, "snapshot-start.json"), snapshotStart);

  const summaries: ReturnType<typeof summarizeCallV0>[] = [];
  for (let callIndex = 1; callIndex <= CALL_COUNT; callIndex++) {
    const { recording, observer } = collectDiagnosticCallV0(callIndex);
    // One transport instance per call: trace_observer is per-instance config,
    // and the transport itself is stateless, so each call gets exactly its own
    // collector with identical fixed request policy.
    const transport = new OllamaNativeCognitionTransportV0({
      base_url: args.base_url,
      model: args.model,
      trace_observer: observer
    });
    const callDir = join(outDir, `call-0${callIndex}`);
    mkdirSync(callDir, { recursive: true });
    try {
      const response = await transport.complete(request);
      recording.finished_at = new Date().toISOString();
      console.log(`CALL_0${callIndex} OK model=${response.model} content=${JSON.stringify(response.content)}`);
    } catch (error) {
      recording.finished_at = new Date().toISOString();
      recording.error = {
        name: error instanceof Error ? error.name : "Unknown",
        message: (error instanceof Error ? error.message : String(error)).slice(0, 2048)
      };
      console.log(`CALL_0${callIndex} THREW ${recording.error.name}: ${recording.error.message}`);
    }
    // The observer recorded events/trace during the call; persist everything.
    saveJson(join(callDir, "events.json"), recording.events);
    saveJson(join(callDir, "trace.json"), recording.trace);
    saveJson(join(callDir, "error.json"), recording.error);
    saveJson(join(callDir, "recording.json"), {
      call_index: recording.call_index,
      started_at: recording.started_at,
      finished_at: recording.finished_at
    });
    summaries.push(summarizeCallV0(recording));

    if (callIndex === 2) {
      const snapshotMidway = await captureOllamaDiagnosticHealthSnapshotV0({ base_url: args.base_url });
      saveJson(join(outDir, "snapshot-midway.json"), snapshotMidway);
    }
  }

  const snapshotFinal = await captureOllamaDiagnosticHealthSnapshotV0({ base_url: args.base_url });
  saveJson(join(outDir, "snapshot-final.json"), snapshotFinal);

  const summary = {
    ...DIAGNOSTIC_PROTOCOL_V0,
    run_id: runId,
    started_at: snapshotStart.captured_at,
    finished_at: snapshotFinal.captured_at,
    config: { base_url: args.base_url, model: args.model, timeout_ms: 120000, num_predict: 2048 },
    notes: [
      "four byte-identical neutral requests; any request_hash variance across traces is itself diagnostic",
      "the timeout timer guards ONLY the fetch await (body-read gap is preserved, observable via body_ms on stall)",
      "runner asserts nothing; every value is observational"
    ],
    calls: summaries,
    snapshots: {
      start: "snapshot-start.json",
      midway: "snapshot-midway.json",
      final: "snapshot-final.json"
    }
  };
  saveJson(join(outDir, "summary.json"), summary);

  console.log("CALL  OUTCOME   STAGE                       FAIL            ELAPSED  FETCH   BODY    ABORT  EVAL");
  for (const row of summaries) {
    const line = [
      `0${row.call}`, row.outcome.padEnd(9), row.terminal_stage.padEnd(28),
      (row.failure_code ?? "-").padEnd(16), String(row.elapsed_ms ?? "-").padEnd(9),
      String(row.fetch_ms ?? "-").padEnd(8), String(row.body_ms ?? "-").padEnd(8),
      String(row.abort).padEnd(7), String(row.ollama_eval_count ?? "-")
    ].join(" ");
    console.log(line);
  }
  console.log(`DONE summary=${join(outDir, "summary.json")}`);
}

await main();
