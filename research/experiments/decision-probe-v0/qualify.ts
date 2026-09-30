/* eslint-disable no-restricted-imports -- Isolated research harness over frozen built production roots (repository convention); zero production code changes. */
/**
 * DecisionProbeV0 — Phase D0 driver. RESEARCH-ONLY.
 *
 *   node research/experiments/decision-probe-v0/qualify.ts <outdir>
 *
 * Phases (frozen):
 *   D0-S  local smoke: r = 1, PRIMARY mode only, 3 calls. Plumbing only; it never unlocks D1.
 *   D0-Q  formal qualification: r = r_pilot, BOTH modes, 3 fixtures x 2 modes x r calls.
 *
 * Environment:
 *   CHARACTEROS_DECISION_PROBE_PHASE     D0S | D0Q           (default D0Q)
 *   CHARACTEROS_DECISION_PROBE_EXECUTOR  ollama | openai     (default ollama)
 *   CHARACTEROS_DECISION_PROBE_R         integer             (default: frozen r_pilot = 3)
 *   CHARACTEROS_DECISION_PROBE_PRIMARY   1                   (declares this run uses the
 *                                                             project's PRIMARY executor;
 *                                                             absent = non-primary run)
 *   OLLAMA_BASE_URL, CHARACTEROS_MODEL                        (ollama family)
 *   MODEL_API_BASE_URL, MODEL_API_MODEL, MODEL_API_KEY        (openai family)
 *
 * Frozen generation settings are constants in this file and are recorded in the manifest.
 * Nothing here retries, repairs, re-prompts, changes a fixture, changes an expected token or
 * chooses a favourable mode. A failing fixture is reported as it is.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { hashEnvelope, canonicalJsonString } from "../../../packages/subject-core/dist/index.js";
import type { HashV1 } from "../../../packages/subject-core/dist/index.js";
import { OllamaNativeCognitionTransportV0 } from "../../../packages/runtime/dist/providers/cognition/ollama-native-cognition-transport.js";
import { OpenAiCompatibleTransportV0 } from "../../../packages/runtime/dist/transports/model-transport.js";
import type { ModelTransportV0 } from "../../../packages/runtime/dist/transports/model-transport.js";

import { captureProductionRequestForFixtureV0 } from "./binding.ts";
import { buildDecisionProbeRequestV0, DECISION_PROBE_DECISIONS } from "./contract.ts";
import {
  D0_FIXTURES,
  D0_PROTOCOL_V0,
  deriveD0FixtureSetHashV0
} from "./fixtures.ts";
import { runDecisionProbeV0 } from "./probe.ts";

/** Frozen generation settings for D0. Recorded in the executor manifest. */
const D0_GENERATION_V0 = Object.freeze({
  temperature: 0,
  cognition_num_predict: 256,
  context_window_tokens: 8192,
  ollama_think: false
});

interface ExecutorRecord {
  readonly family: "ollama" | "openai";
  readonly model: string;
  readonly endpoint: string;
  readonly model_digest: string | null;
  readonly generation: typeof D0_GENERATION_V0;
  readonly declares_primary_executor: boolean;
  readonly transport_class: string;
}

async function readOllamaDigest(baseUrl: string, model: string): Promise<string | null> {
  try {
    const response = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(6000) });
    const body = (await response.json()) as { models?: { name?: string; digest?: string }[] };
    return body.models?.find((entry) => entry.name === model)?.digest ?? null;
  } catch {
    return null;
  }
}

async function buildTransport(
  family: "ollama" | "openai",
  env: NodeJS.ProcessEnv
): Promise<{ transport: ModelTransportV0; record: ExecutorRecord }> {
  if (family === "ollama") {
    const baseUrl = env["OLLAMA_BASE_URL"] ?? "http://127.0.0.1:11434";
    const model = env["CHARACTEROS_MODEL"] ?? "qwen3.5:9b";
    const transport = new OllamaNativeCognitionTransportV0({
      base_url: baseUrl,
      model,
      timeout_ms: 120_000,
      num_predict: D0_GENERATION_V0.cognition_num_predict,
      context_window_tokens: D0_GENERATION_V0.context_window_tokens
    });
    return {
      transport: transport as unknown as ModelTransportV0,
      record: {
        family,
        model,
        endpoint: baseUrl,
        model_digest: await readOllamaDigest(baseUrl, model),
        generation: D0_GENERATION_V0,
        declares_primary_executor: env["CHARACTEROS_DECISION_PROBE_PRIMARY"] === "1",
        transport_class: "OllamaNativeCognitionTransportV0"
      }
    };
  }
  const baseUrl = env["MODEL_API_BASE_URL"] ?? "";
  const model = env["MODEL_API_MODEL"] ?? "";
  const apiKey = env["MODEL_API_KEY"] ?? null;
  const transport = new OpenAiCompatibleTransportV0({
    base_url: baseUrl,
    model,
    api_key: apiKey,
    timeout_ms: 120_000,
    temperature: D0_GENERATION_V0.temperature,
    max_output_tokens: D0_GENERATION_V0.cognition_num_predict,
    ...(env["CHARACTEROS_DEEPSEEK_THINKING"] === undefined
      ? {}
      : { provider_request_options: { thinking: { type: "disabled" } } })
  });
  return {
    transport: transport as unknown as ModelTransportV0,
    record: {
      family,
      model,
      endpoint: baseUrl,
      model_digest: null,
      generation: D0_GENERATION_V0,
      declares_primary_executor: env["CHARACTEROS_DECISION_PROBE_PRIMARY"] === "1",
      transport_class: "OpenAiCompatibleTransportV0"
    }
  };
}

interface TrialRow {
  readonly fixture_id: string;
  readonly mode: string;
  readonly replicate_ordinal: number;
  readonly outcome: string;
  readonly decision: string | null;
  readonly rejection_code: string | null;
  readonly transport_failure: string | null;
  readonly raw_output: string | null;
  readonly production_request_hash: string;
  readonly probe_request_hash: string;
  readonly record_hash: string;
  readonly elapsed_ms: number | null;
}

interface CellSummary {
  readonly fixture_id: string;
  readonly mode: string;
  readonly ACCEPT: number;
  readonly VERIFY: number;
  readonly REJECT: number;
  readonly rejected: number;
  readonly transport_failed: number;
  readonly valid: number;
  readonly modal: string | null;
  readonly agreement: number;
  readonly expected: string;
  readonly passes: boolean;
}

function summarizeCells(trials: readonly TrialRow[]): readonly CellSummary[] {
  const cells: CellSummary[] = [];
  for (const fixture of D0_FIXTURES) {
    for (const mode of [D0_PROTOCOL_V0.primary_mode, D0_PROTOCOL_V0.fidelity_control_mode]) {
      const rows = trials.filter((row) => row.fixture_id === fixture.fixture_id && row.mode === mode);
      const counts: Record<string, number> = { ACCEPT: 0, VERIFY: 0, REJECT: 0 };
      let rejected = 0;
      let failed = 0;
      for (const row of rows) {
        if (row.outcome === "DECIDED" && row.decision !== null) counts[row.decision] = (counts[row.decision] ?? 0) + 1;
        else if (row.outcome === "REJECTED") rejected += 1;
        else failed += 1;
      }
      const valid = rows.length - rejected - failed;
      const entries = DECISION_PROBE_DECISIONS.map((token) => [token, counts[token] ?? 0] as const);
      const top = [...entries].sort((a, b) => b[1] - a[1])[0] ?? ["", 0];
      const modal = valid > 0 && top[1] > 0 ? top[0] : null;
      const agreement = valid > 0 ? top[1] / valid : 0;
      cells.push({
        fixture_id: fixture.fixture_id,
        mode,
        ACCEPT: counts["ACCEPT"] ?? 0,
        VERIFY: counts["VERIFY"] ?? 0,
        REJECT: counts["REJECT"] ?? 0,
        rejected,
        transport_failed: failed,
        valid,
        modal,
        agreement,
        expected: fixture.expected_decision,
        passes: modal === fixture.expected_decision && agreement >= D0_PROTOCOL_V0.min_agreement_fraction
      });
    }
  }
  return cells;
}

function modeVerdict(cells: readonly CellSummary[], mode: string): string {
  const scoped = cells.filter((cell) => cell.mode === mode);
  const totalValid = scoped.reduce((sum, cell) => sum + cell.valid, 0);
  const totalRejected = scoped.reduce((sum, cell) => sum + cell.rejected, 0);
  const totalFailed = scoped.reduce((sum, cell) => sum + cell.transport_failed, 0);
  const totalCalls = totalValid + totalRejected + totalFailed;
  if (totalFailed > 0 && totalValid === 0) return "EXECUTOR_UNQUALIFIED_FOR_DECISION_PROBE";
  if (totalCalls > 0 && totalRejected / totalCalls > D0_PROTOCOL_V0.max_schema_rejection_rate) {
    return "EXECUTOR_UNQUALIFIED_FOR_DECISION_PROBE";
  }
  const contradictions = scoped.filter((cell) => cell.modal !== null && cell.modal !== cell.expected);
  if (contradictions.length > 0) return "DECISION_INSTRUMENT_UNQUALIFIED";
  const failing = scoped.filter((cell) => !cell.passes);
  if (failing.length > 0) return "INCONCLUSIVE_BY_DECISION_NOISE";
  return "DECISION_INSTRUMENT_QUALIFIED";
}

async function main(): Promise<void> {
  const outdir = process.argv[2];
  if (outdir === undefined) throw new Error("usage: node qualify.ts <outdir>");
  const env = process.env;
  const phase = env["CHARACTEROS_DECISION_PROBE_PHASE"] ?? "D0Q";
  const family = (env["CHARACTEROS_DECISION_PROBE_EXECUTOR"] ?? "ollama") as "ollama" | "openai";
  const rOverride = env["CHARACTEROS_DECISION_PROBE_R"];
  const isSmoke = phase === "D0S";
  const r = isSmoke
    ? 1
    : rOverride === undefined
      ? D0_PROTOCOL_V0.r_pilot
      : Number.parseInt(rOverride, 10);
  const modes = isSmoke
    ? [D0_PROTOCOL_V0.primary_mode]
    : [D0_PROTOCOL_V0.primary_mode, D0_PROTOCOL_V0.fidelity_control_mode];

  await mkdir(outdir, { recursive: true });
  const { transport, record } = await buildTransport(family, env);

  const fixtureSetHash = await deriveD0FixtureSetHashV0();
  const bindings = [];
  for (const fixture of D0_FIXTURES) {
    bindings.push(await captureProductionRequestForFixtureV0(fixture));
  }

  const probeRequests: Record<string, unknown>[] = [];
  const trials: TrialRow[] = [];
  let globalOrdinal = 0;

  for (const fixture of D0_FIXTURES) {
    const bound = bindings.find((entry) => entry.fixture_id === fixture.fixture_id);
    if (bound === undefined) throw new Error(`no binding for ${fixture.fixture_id}`);
    for (const mode of modes) {
      // Built ONCE per (fixture, mode): every replicate therefore carries identical bytes (B7).
      const built = await buildDecisionProbeRequestV0(bound.production_request, mode);
      probeRequests.push({
        fixture_id: fixture.fixture_id,
        mode,
        probe_request_hash: built.fidelity.probe_request_hash,
        production_request_hash: built.fidelity.production_request_hash,
        probe_schema_hash: built.fidelity.probe_schema_hash,
        override_block_hash: built.fidelity.override_block_hash,
        fidelity: built.fidelity
      });
      for (let ordinal = 1; ordinal <= r; ordinal += 1) {
        globalOrdinal += 1;
        process.stdout.write(
          `[${String(globalOrdinal)}] ${fixture.fixture_id} ${mode} r=${String(ordinal)}/${String(r)} ... `
        );
        const record0 = await runDecisionProbeV0({
          transport,
          production_request: bound.production_request,
          mode,
          fixture_id: fixture.fixture_id,
          replicate_ordinal: ordinal
        });
        trials.push({
          fixture_id: fixture.fixture_id,
          mode,
          replicate_ordinal: ordinal,
          outcome: record0.outcome,
          decision: record0.decision,
          rejection_code: record0.rejection_code,
          transport_failure: record0.transport_failure,
          raw_output: record0.raw_content ?? null,
          production_request_hash: record0.fidelity.production_request_hash,
          probe_request_hash: record0.fidelity.probe_request_hash,
          record_hash: record0.record_hash,
          elapsed_ms: record0.elapsed_ms
        });
        process.stdout.write(`${record0.outcome}${record0.decision === null ? "" : ` ${record0.decision}`}\n`);
      }
    }
  }

  const cells = summarizeCells(trials);
  const primaryVerdict = modeVerdict(cells, D0_PROTOCOL_V0.primary_mode);
  // A mode that did not run has NO verdict. Smoke runs only the primary mode, and reporting a
  // verdict for an unrun mode would be a fabricated result.
  const controlRan = modes.includes(D0_PROTOCOL_V0.fidelity_control_mode);
  const controlVerdict = controlRan
    ? modeVerdict(cells, D0_PROTOCOL_V0.fidelity_control_mode)
    : "NOT_RUN";
  const overall = isSmoke
    ? primaryVerdict
    : controlRan && primaryVerdict !== controlVerdict
      ? "INCONCLUSIVE_BY_MODE_DIVERGENCE"
      : primaryVerdict;

  const write = async (name: string, value: unknown): Promise<void> => {
    await writeFile(join(outdir, name), `${canonicalJsonString(value)}\n`, "utf8");
  };

  await write("fixture-manifest.json", { fixture_set_hash: fixtureSetHash, fixtures: D0_FIXTURES, protocol: D0_PROTOCOL_V0 });
  await write("executor-manifest.json", record);
  await write("binding-manifest.json", bindings.map((entry) => ({ fixture_id: entry.fixture_id, subject_id: entry.subject_id, provenance: entry.provenance, hashes: entry.hashes })));
  await write("probe-requests.json", probeRequests);
  await writeFile(join(outdir, "trials.jsonl"), trials.map((row) => canonicalJsonString(row)).join("\n") + "\n", "utf8");
  await write("verdict.json", {
    phase,
    is_smoke: isSmoke,
    r,
    modes,
    declares_primary_executor: record.declares_primary_executor,
    cells,
    primary_mode_verdict: primaryVerdict,
    fidelity_control_mode_verdict: controlVerdict,
    overall_verdict: overall,
    d1_unlock_eligible: overall === "DECISION_INSTRUMENT_QUALIFIED" && record.declares_primary_executor
  });

  const artifactNames = ["fixture-manifest.json", "executor-manifest.json", "binding-manifest.json", "probe-requests.json", "trials.jsonl", "verdict.json"];
  const artifactHashes: Record<string, HashV1> = {};
  for (const name of artifactNames) {
    artifactHashes[name] = await hashEnvelope("characteros-next/research/decision-probe/artifact/v0", {
      name,
      content: await readFile(join(outdir, name), "utf8")
    });
  }
  await write("RUN_MANIFEST.json", {
    artifact_hashes: artifactHashes,
    fixture_set_hash: fixtureSetHash,
    executor: record,
    phase,
    r,
    modes,
    overall_verdict: overall
  });

  process.stdout.write(`\noverall_verdict = ${overall}\n`);
  process.stdout.write(`primary_mode_verdict = ${primaryVerdict}\n`);
  process.stdout.write(`fidelity_control_mode_verdict = ${controlVerdict}\n`);
  process.stdout.write(`declares_primary_executor = ${String(record.declares_primary_executor)}\n`);
  process.stdout.write(`artifacts written to ${outdir}\n`);
}

await main();

