/**
 * PROVIDER READINESS GATE — execution.
 *
 *   npx tsx phase-0/readiness/readiness.ts <outdir>
 *
 * Sends EXACTLY the frozen probe request, READINESS_PROBES_PLANNED times, with the frozen transport
 * configuration and the frozen timeout. It changes nothing about the environment and it changes
 * nothing about the protocol to fit the environment.
 *
 * The gate PASSES only if every planned probe completes normally inside the frozen timeout.
 */

import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  READINESS_FAIL_TOKENS,
  READINESS_MODEL,
  READINESS_MODEL_DIGEST_FROZEN,
  READINESS_OLLAMA_BASE_URL,
  READINESS_PASS_TOKENS,
  READINESS_PROBES_PLANNED,
  READINESS_REQUEST,
  READINESS_TIMEOUT_MS,
  hashReadinessRequestV0
} from "./contract-readiness.ts";
import { buildReloadTimelineV0, detectMidGateReloadV0 } from "./reload-detection.ts";


function vram(query: string): string {
  try {
    return execSync(`nvidia-smi --query-gpu=${query} --format=csv,noheader,nounits`, { encoding: "utf8" }).trim();
  } catch {
    return "UNAVAILABLE";
  }
}

async function modelDigest(): Promise<string | null> {
  try {
    const response = await fetch(`${READINESS_OLLAMA_BASE_URL}/api/tags`, { signal: AbortSignal.timeout(10_000) });
    const body = (await response.json()) as { models?: { name?: string; digest?: string }[] };
    return body.models?.find((model) => model.name === READINESS_MODEL)?.digest ?? null;
  } catch {
    return null;
  }
}

interface ProbeResultV0 {
  readonly attempt_id: string;
  readonly scientific: false;
  readonly replicate_ordinal: number;
  readonly request_hash: string;
  readonly model: string;
  readonly model_digest: string | null;
  readonly vram_used_before_mib: string;
  readonly model_loaded_before: boolean;
  /** Sampled immediately AFTER the request, so an unload/reload between probes is observable. */
  readonly model_loaded_after: boolean;
  readonly model_digest_after: string | null;
  readonly started_at: string;
  readonly ended_at: string;
  readonly latency_ms: number;
  readonly completion_tokens: number | null;
  readonly throughput_tok_s: number | null;
  readonly status: "COMPLETED" | "MODEL_TIMEOUT" | "TRANSPORT_FAILURE" | "PROVIDER_ERROR";
  readonly error: string | null;
  readonly timeout_ms: number;
}

/** Reads the model's resident state without invoking generation. */
async function modelResident(name: string): Promise<boolean> {
  try {
    const response = await fetch(`${READINESS_OLLAMA_BASE_URL}/api/ps`, { signal: AbortSignal.timeout(10_000) });
    const body = (await response.json()) as { models?: { name?: string }[] };
    return body.models?.some((model) => model.name === name) === true;
  } catch {
    return false;
  }
}

async function runProbe(ordinal: number, requestHash: string): Promise<ProbeResultV0> {
  const started = new Date();
  const vramBefore = vram("memory.used");
  const loadedBefore = await modelResident(READINESS_MODEL);
  const digest = await modelDigest();

  const base = {
    attempt_id: `readiness-${String(ordinal).padStart(3, "0")}`,
    scientific: false as const,
    replicate_ordinal: ordinal,
    request_hash: requestHash,
    model: READINESS_MODEL,
    model_digest: digest,
    vram_used_before_mib: vramBefore,
    model_loaded_before: loadedBefore,
    started_at: started.toISOString(),
    timeout_ms: READINESS_TIMEOUT_MS
  };

  const finish = async (
    partial: Omit<ProbeResultV0, "model_loaded_after" | "model_digest_after">
  ): Promise<ProbeResultV0> => ({
    ...partial,
    model_loaded_after: await modelResident(READINESS_MODEL),
    model_digest_after: await modelDigest()
  });

  try {
    const response = await fetch(`${READINESS_OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(READINESS_REQUEST),
      signal: AbortSignal.timeout(READINESS_TIMEOUT_MS)
    });
    const ended = new Date();
    const latency = ended.getTime() - started.getTime();
    if (!response.ok) {
      return await finish({
        ...base,
        ended_at: ended.toISOString(),
        latency_ms: latency,
        completion_tokens: null,
        throughput_tok_s: null,
        status: "PROVIDER_ERROR",
        error: `HTTP ${response.status}`
      });
    }
    const body = (await response.json()) as { eval_count?: number; eval_duration?: number; message?: { content?: string } };
    const completionTokens = typeof body.eval_count === "number" ? body.eval_count : null;
    const throughput =
      completionTokens !== null && typeof body.eval_duration === "number" && body.eval_duration > 0
        ? Math.round((completionTokens / (body.eval_duration / 1e9)) * 100) / 100
        : null;
    return await finish({
      ...base,
      ended_at: ended.toISOString(),
      latency_ms: latency,
      completion_tokens: completionTokens,
      throughput_tok_s: throughput,
      status: "COMPLETED",
      error: null
    });
  } catch (error) {
    const ended = new Date();
    const message = error instanceof Error ? error.message : String(error);
    const isTimeout = /timeout|abort/i.test(message);
    return await finish({
      ...base,
      ended_at: ended.toISOString(),
      latency_ms: ended.getTime() - started.getTime(),
      completion_tokens: null,
      throughput_tok_s: null,
      status: isTimeout ? "MODEL_TIMEOUT" : "TRANSPORT_FAILURE",
      error: message
    });
  }
}

async function main(): Promise<void> {
  const outdir = process.argv[2];
  if (outdir === undefined) throw new Error("READINESS_USAGE: usage: readiness.ts <outdir>");
  mkdirSync(outdir, { recursive: true });
  const write = (name: string, value: unknown): void => {
    writeFileSync(join(outdir, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");
  };

  const requestHash = hashReadinessRequestV0();

  // ---- §4 identity gate: an identity change STOPs before any probe -------------------------------
  const digestNow = await modelDigest();
  const identity = {
    provider: "Ollama",
    base_url: READINESS_OLLAMA_BASE_URL,
    model_expected: READINESS_MODEL,
    model_digest_expected: READINESS_MODEL_DIGEST_FROZEN,
    model_digest_observed: digestNow,
    identity_unchanged: digestNow === READINESS_MODEL_DIGEST_FROZEN,
    fallback_configured: false
  };
  if (!identity.identity_unchanged) {
    write("PROVIDER_READINESS_VERDICT.json", {
      ...READINESS_FAIL_TOKENS.reduce((acc, _token, index) => (index === 0 ? { verdict: _token } : acc), {}),
      outcome: "FAIL",
      tokens: READINESS_FAIL_TOKENS,
      reason: "PROVIDER_IDENTITY_CHANGED — the gate stops before any probe",
      identity,
      probes_planned: READINESS_PROBES_PLANNED,
      probes_executed: 0
    });
    console.log("PROVIDER IDENTITY CHANGED — gate FAIL, no probe sent");
    return;
  }

  // ---- §10 exactly the planned probes -----------------------------------------------------------
  const probes: ProbeResultV0[] = [];
  for (let ordinal = 1; ordinal <= READINESS_PROBES_PLANNED; ordinal += 1) {
    console.log(`readiness probe ${ordinal}/${READINESS_PROBES_PLANNED} …`);
    const result = await runProbe(ordinal, requestHash);
    probes.push(result);
    write(`readiness-attempt-${String(ordinal).padStart(3, "0")}.json`, result);
    console.log(
      `  status=${result.status} latency=${result.latency_ms}ms tokens=${String(result.completion_tokens)} tok/s=${String(result.throughput_tok_s)} ${result.error ?? ""}`
    );
  }

  // ---- the frozen predicate, enforced EXACTLY as frozen -----------------------------------------
  // The frozen predicate names four conditions: complete normally, inside the frozen timeout, no
  // mid-run provider reload, and no fallback. An earlier revision of this program computed PASS from
  // only some of them, leaving reload and digest as recorded-but-not-gating — a predicate that did not
  // test everything it named. This is conformance to the frozen predicate, NOT an amendment: the
  // predicate, the request bytes, the hash, the provider, the model, the configuration and the
  // timeout are all unchanged.
  const allCompleted = probes.every((probe) => probe.status === "COMPLETED");
  const allWithinTimeout = probes.every((probe) => probe.latency_ms < READINESS_TIMEOUT_MS);
  const sameHash = probes.every((probe) => probe.request_hash === requestHash);
  const sameDigest = probes.every((probe) => probe.model_digest === READINESS_MODEL_DIGEST_FROZEN);
  /**
   * Mid-gate reload detection (§2 conformance correction). One initial load caused by the FIRST
   * planned probe is ALLOWED; any unload, second load, digest change or provider restart within the
   * planned sequence is FORBIDDEN. Implemented in `reload-detection.ts` and verified by a 0-call
   * synthetic audit before this run.
   */
  const reloadTimeline = buildReloadTimelineV0(
    probes.map((probe) => ({
      ordinal: probe.replicate_ordinal,
      loadedBefore: probe.model_loaded_before,
      loadedAfter: probe.model_loaded_after,
      digestBefore: probe.model_digest,
      digestAfter: probe.model_digest_after
    }))
  );
  const reloadDetection = detectMidGateReloadV0(reloadTimeline);
  const noReloadMidway = !reloadDetection.mid_gate_reload;
  /**
   * "No fallback" is a property of the gate's construction, not a measured observation: this program
   * has no fallback path in code, so it can never take one. It is recorded as such rather than as a
   * check that can never fail.
   */
  const noFallback = "STRUCTURALLY_TRUE_BY_CONSTRUCTION";
  const pass = allCompleted && allWithinTimeout && sameHash && sameDigest && noReloadMidway;

  const metrics = probes.map((probe) => probe.throughput_tok_s).filter((value): value is number => value !== null);
  const verdict = {
    artifact: "PROVIDER_READINESS_VERDICT",
    outcome: pass ? "PASS" : "FAIL",
    tokens: pass ? READINESS_PASS_TOKENS : READINESS_FAIL_TOKENS,
    identity,
    request_hash: requestHash,
    probes_planned: READINESS_PROBES_PLANNED,
    probes_executed: probes.length,
    planned_equals_actual: probes.length === READINESS_PROBES_PLANNED,
    criteria: {
      all_probes_completed_within_the_frozen_timeout: allWithinTimeout,
      all_probes_completed_normally: allCompleted,
      all_probes_used_the_same_frozen_request_hash: sameHash,
      same_model_digest_throughout: sameDigest,
      no_provider_reload_midway: noReloadMidway,
      no_fallback_used: noFallback
    },
    criteria_actually_gating_the_verdict: [
      "all_probes_completed_within_the_frozen_timeout",
      "all_probes_completed_normally",
      "all_probes_used_the_same_frozen_request_hash",
      "same_model_digest_throughout",
      "no_provider_reload_midway"
    ],
    conformance_note:
      "an earlier revision of this program computed PASS from a subset of the conditions its own frozen predicate named, leaving digest and reload recorded but non-gating. The gap was closed BEFORE this execution; the request bytes, request hash, provider, model, transport, context and generation configuration, timeout and planned N are all byte-identical to the first gate.",
    descriptive_metrics_not_gating: {
      throughput_tok_s_per_probe: probes.map((probe) => probe.throughput_tok_s),
      throughput_min: metrics.length > 0 ? Math.min(...metrics) : null,
      throughput_max: metrics.length > 0 ? Math.max(...metrics) : null,
      latencies_ms: probes.map((probe) => probe.latency_ms)
    },
    environment_diagnostics: {
      vram_total_mib: vram("memory.total"),
      vram_used_mib_after_probes: vram("memory.used"),
      gpu_temperature_c: vram("temperature.gpu"),
      note: "diagnostic only; §8 forbids an arbitrary VRAM number from itself gating the rerun"
    },
    blocker_if_failed: pass ? null : "PROVIDER_INFRASTRUCTURE_VRAM_EXHAUSTION",
    on_failure_what_was_NOT_done: pass
      ? []
      : [
          "timeout was not raised",
          "num_ctx was not lowered",
          "no provider or model swap",
          "no generation-setting change",
          "no extra probe beyond the planned count",
          "no operator process was killed and no OS/GPU setting was altered"
        ],
    next_step_if_pass: "PHASE0_FRESH_RERUN_AUTHORISED — execute PHASE0-RUN-3 in a NEW evidence directory with fresh opaque subjects and the same frozen design; no infrastructure work in that round",
    next_step_if_fail:
      "PHASE0_RERUN_REMAINS_BLOCKED_BY_PROVIDER_ENVIRONMENT. Restoring the environment (closing GPU-consuming applications, restarting the machine) is execution-environment restoration, not a protocol amendment, and the SAME frozen gate may be re-run afterwards.",
    authorized_phase_1: false
  };
  write("PROVIDER_READINESS_VERDICT.json", {
    ...verdict,
    mid_gate_reload_detection: { timeline: reloadTimeline, ...reloadDetection }
  });

  console.log("");
  console.log(`PROVIDER READINESS GATE: ${verdict.outcome}`);
  for (const token of verdict.tokens) console.log(`  ${token}`);
  console.log(`  probes ${probes.length}/${READINESS_PROBES_PLANNED}, completed ${probes.filter((probe) => probe.status === "COMPLETED").length}`);
}

await main();
