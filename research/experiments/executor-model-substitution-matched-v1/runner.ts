/**
 * EXECUTOR_MODEL_SUBSTITUTION_MATCHED_V1 — execution + per-executor and cross-executor verdicts.
 *
 * EXECUTION ORDER (§18): paired interleaved — for each (cell, replicate) the LOCAL scene runs and
 * then the API scene, back to back, so provider/time drift cannot favour one executor. A
 * deterministic balanced schedule manifest is written before the first call. Executor A's output
 * never enters executor B: every scene is a fresh process with its own restore and its own model
 * call, and no state is shared between executors.
 *
 * Per-executor verdicts and the success pattern are the frozen V2 law; thresholds are untouched.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  GATES,
  type ConditionId
} from "../relationship-familiarity-context-mediation-final-replication-v2/contract.ts";
import type { SceneObservation } from "../relationship-familiarity-context-mediation-final-replication-v2/scene.ts";
import { check, hashJson, type HistoryBundle } from "../relationship-familiarity-context-mediation-final-replication-v2/world.ts";

import {
  EXECUTOR_IDS,
  EXPERIMENT_ID,
  INTERLEAVE_ORDER,
  executorConfig,
  primarySchedule,
  replicationSchedule,
  pilotSchedule,
  trialId,
  type ExecutorId
} from "./contract.ts";

export type ExecutionPhase = "pilot" | "primary" | "replication";

interface SceneAccounting {
  readonly executor: ExecutorId;
  readonly config: {
    readonly model: string;
    readonly provider: string;
    readonly base_url: string;
    readonly temperature: number;
    readonly top_p: number | null;
    readonly max_tokens: number;
    readonly timeout_ms: number;
    readonly seed_support: string;
    readonly schema_enforcement_mode: string;
  };
  readonly key_fingerprint: string | null;
  readonly usage: {
    readonly requests: number;
    readonly prompt_tokens: number;
    readonly completion_tokens: number;
    readonly total_tokens: number;
    readonly cached_tokens: number;
    readonly reasoning_tokens: number;
  };
  readonly attempts: readonly { readonly attempt: number; readonly http_status: number | null; readonly failure_class: string | null; readonly elapsed_ms: number }[];
  readonly captured_requests: readonly { readonly system: string; readonly user: string }[];
}

export interface ContrastResult {
  readonly id: string;
  readonly left: string;
  readonly right: string;
  readonly expected: "DIFFERENCE" | "NO_MEANINGFUL_DIFFERENCE";
  readonly comparable_pairs: number;
  readonly directional: number;
  readonly left_only_classes: readonly string[];
  readonly right_only_classes: readonly string[];
}

export interface ExecutorVerdict {
  readonly executor: ExecutorId;
  readonly phase: ExecutionPhase;
  readonly phase_verdict: string;
  readonly scientific_verdict: string | null;
  readonly executor_config: unknown;
  readonly key_fingerprint: string | null;
  readonly host_valid_scenes: number;
  readonly total_scenes: number;
  readonly host_valid_rate: number;
  readonly host_valid_gate_pass: boolean;
  readonly schema_failures: number;
  readonly schema_failure_rate: number;
  readonly factual_authority_failures: number;
  readonly source_binding_failures: number;
  readonly source_binding_failure_rate: number;
  readonly transport_failures: number;
  readonly retry_count: number;
  readonly seed_clean: boolean;
  readonly corpus_identical: boolean;
  readonly manipulation_ok: boolean;
  readonly semantic_non_conflation_pass: boolean;
  readonly forbidden_vocabulary: readonly string[];
  readonly failure_classes: Readonly<Record<string, number>>;
  readonly cells: Readonly<Record<string, unknown>>;
  readonly contrasts: readonly ContrastResult[];
  readonly criteria: Readonly<Record<string, boolean>>;
  readonly criteria_all_pass: boolean;
  readonly accounting: {
    readonly planned_scenes: number;
    readonly actual_scenes: number;
    readonly unique_scenes: number;
    readonly duplicate_scenes: number;
    readonly missing_scenes: number;
    readonly extra_scenes: number;
    readonly requests: number;
    readonly prompt_tokens: number;
    readonly completion_tokens: number;
    readonly total_tokens: number;
    readonly cached_tokens: number;
    readonly reasoning_tokens: number;
    readonly api_cost: string;
  };
  readonly detail: string;
}

export interface CrossExecutorVerdict {
  readonly local_verdict: string | null;
  readonly api_verdict: string | null;
  readonly cross_verdict: string;
  readonly detail: string;
}

export interface PhaseResult {
  readonly phase: ExecutionPhase;
  readonly verdicts: Readonly<Record<ExecutorId, ExecutorVerdict>>;
  readonly cross: CrossExecutorVerdict | null;
  readonly schedule_manifest: readonly string[];
}

const AVAILABILITY_EXPECTED: Record<string, boolean> = {
  A_LOW_NO_CONTEXT: false,
  B_HIGH_CONTEXT: true,
  C_HIGH_CONTEXT_ABLATED: false,
  D_LOW_CONTEXT_EQUALIZED: true
};

function scheduleFor(phase: ExecutionPhase): readonly { readonly condition: ConditionId; readonly replicate: number }[] {
  return phase === "pilot" ? pilotSchedule() : phase === "primary" ? primarySchedule() : replicationSchedule();
}

export async function runPhase(input: {
  readonly phase: ExecutionPhase;
  readonly bundles: Record<string, HistoryBundle>;
  readonly evidenceDir: string;
  readonly priorPrimary?: PhaseResult | undefined;
}): Promise<PhaseResult> {
  mkdirSync(input.evidenceDir, { recursive: true });
  const worker = fileURLToPath(new URL("./scene-worker.ts", import.meta.url));
  const base = scheduleFor(input.phase);
  const pairs = base.map((entry) => ({ condition: entry.condition, replicate: entry.replicate }));

  // Deterministic balanced schedule manifest, written BEFORE the first model call.
  const scheduleManifest = pairs.flatMap((entry) =>
    INTERLEAVE_ORDER.map((executor) => trialId(executor, input.phase, entry.condition, entry.replicate))
  );
  writeFileSync(join(input.evidenceDir, "execution_schedule_manifest.json"), `${JSON.stringify({
    schema_version: "executor-matched-schedule-v1",
    experiment_id: EXPERIMENT_ID,
    phase: input.phase,
    interleave_order: INTERLEAVE_ORDER,
    planned_trials: scheduleManifest.length,
    trials: scheduleManifest
  }, null, 2)}\n`);

  const observations: Record<ExecutorId, SceneObservation[]> = { LOCAL_QWEN: [], API_DEEPSEEK: [] };
  const accountings: Record<ExecutorId, SceneAccounting[]> = { LOCAL_QWEN: [], API_DEEPSEEK: [] };
  const seen = new Set<string>();

  for (const entry of pairs) {
    for (const executor of INTERLEAVE_ORDER) {
      const bundle = input.bundles[entry.condition];
      check(bundle !== undefined, `history bundle for ${entry.condition}`);
      const identity = trialId(executor, input.phase, entry.condition, entry.replicate);
      check(!seen.has(identity), `duplicate trial identity ${identity}`);
      seen.add(identity);
      const payload = {
        bundle,
        condition: entry.condition,
        scenario_index: 0,
        replicate: entry.replicate,
        evidence_dir: input.evidenceDir,
        identity_phase: input.phase,
        executor
      };
      const started = Date.now();
      const result = spawnSync(process.execPath, [worker], {
        input: JSON.stringify(payload),
        encoding: "utf8",
        timeout: 1800000,
        maxBuffer: 256 * 1024 * 1024
      });
      if (result.status !== 0 || String(result.stdout ?? "").trim().length === 0) {
        writeFileSync(
          join(input.evidenceDir, `worker-failure-${executor}-${entry.condition}-r${entry.replicate}.txt`),
          `${String(result.stdout ?? "")}\n${String(result.stderr ?? "")}\n`
        );
        check(false, `scene worker failed (${identity}): ${String(result.stderr ?? "").slice(0, 400)}`);
      }
      const parsed = JSON.parse(String(result.stdout)) as SceneObservation & { __accounting: SceneAccounting };
      const { __accounting: accounting, ...observation } = parsed;
      observations[executor].push(observation as SceneObservation);
      accountings[executor].push(accounting);
      writeFileSync(
        join(input.evidenceDir, `${executor.toLowerCase()}-progress.log`),
        `${observations[executor].map((obs) => `${obs.condition} r${obs.replicate} ${obs.result_kind} ${obs.behavior_class} ctx=${String(obs.recognition.counterpart_context_visible_in_prompt)} cited=${String(obs.outcomes.counterpart_context_cited)}`).join("\n")}\n`
      );
      process.stderr.write(
        `[${executor} ${observations[executor].length}/${pairs.length}] ${observation.condition} r${observation.replicate} ${(observation as SceneObservation).result_kind} ${(observation as SceneObservation).behavior_class} (${Date.now() - started}ms)\n`
      );
    }
  }

  const verdicts = {} as Record<ExecutorId, ExecutorVerdict>;
  for (const executor of EXECUTOR_IDS) {
    verdicts[executor] = buildExecutorVerdict({
      executor,
      phase: input.phase,
      observations: observations[executor],
      accountings: accountings[executor],
      bundles: input.bundles,
      planned: pairs.map((entry) => `${entry.condition}|${entry.replicate}`),
      priorPrimary: input.priorPrimary
    });
  }

  const cross = input.phase === "replication" ? crossVerdict(verdicts) : null;
  const result: PhaseResult = { phase: input.phase, verdicts, cross, schedule_manifest: scheduleManifest };
  writeFileSync(
    join(input.evidenceDir, `verdict-${input.phase}.json`),
    `${JSON.stringify({ ...result, verdict_hash: hashJson(result) }, null, 2)}\n`
  );
  return result;
}

function buildExecutorVerdict(input: {
  readonly executor: ExecutorId;
  readonly phase: ExecutionPhase;
  readonly observations: readonly SceneObservation[];
  readonly accountings: readonly SceneAccounting[];
  readonly bundles: Record<string, HistoryBundle>;
  readonly planned: readonly string[];
  readonly priorPrimary?: PhaseResult | undefined;
}): ExecutorVerdict {
  const observations = input.observations;
  const config = executorConfig(input.executor);
  const first = input.accountings[0];

  const cells: Record<string, unknown> = {};
  const mutable: Record<string, {
    classes: string[]; valid: number; total: number; ctx: number; cited: number; correct: number;
    continuation: number; generic: number; clarify: number; unsupported: number; forbidden: number;
  }> = {};
  for (const observation of observations) {
    const cell = mutable[observation.condition]
      ?? (mutable[observation.condition] = {
        classes: [], valid: 0, total: 0, ctx: 0, cited: 0, correct: 0,
        continuation: 0, generic: 0, clarify: 0, unsupported: 0, forbidden: 0
      });
    cell.classes.push(observation.behavior_class);
    cell.total += 1;
    if (observation.outcomes.host_valid) cell.valid += 1;
    if (observation.recognition.counterpart_context_visible_in_prompt) cell.ctx += 1;
    if (observation.outcomes.counterpart_context_cited) cell.cited += 1;
    if (observation.outcomes.correct_counterpart_context_cited) cell.correct += 1;
    if (observation.outcomes.continuation_success) cell.continuation += 1;
    if (observation.outcomes.generic_only) cell.generic += 1;
    if (observation.outcomes.clarification_requested) cell.clarify += 1;
    if (observation.outcomes.unsupported_context_claim) cell.unsupported += 1;
    if (observation.outcomes.forbidden_relationship_inference) cell.forbidden += 1;
  }
  for (const [key, cell] of Object.entries(mutable)) {
    cells[key] = {
      classes: cell.classes,
      valid: cell.valid,
      total: cell.total,
      counterpart_context_visible: cell.ctx,
      counterpart_context_cited: cell.cited,
      correct_counterpart_context_cited: cell.correct,
      continuation_success: cell.continuation,
      generic_only: cell.generic,
      clarification_requested: cell.clarify,
      unsupported_context_claim: cell.unsupported,
      forbidden_relationship_inference: cell.forbidden
    };
  }

  const byKey = new Map(observations.map((entry) => [`${entry.condition}|${entry.replicate}`, entry]));
  const replicates = [...new Set(observations.map((entry) => entry.replicate))];
  const contrast = (id: string, left: ConditionId, right: ConditionId, expected: ContrastResult["expected"]): ContrastResult => {
    let comparable = 0;
    let directional = 0;
    const leftOnly = new Set<string>();
    const rightOnly = new Set<string>();
    for (const replicate of replicates) {
      const a = byKey.get(`${left}|${replicate}`);
      const b = byKey.get(`${right}|${replicate}`);
      if (a === undefined || b === undefined) continue;
      if (!a.outcomes.host_valid || !b.outcomes.host_valid) continue;
      comparable += 1;
      if (a.behavior_class !== b.behavior_class) {
        directional += 1;
        leftOnly.add(a.behavior_class);
        rightOnly.add(b.behavior_class);
      }
    }
    return { id, left, right, expected, comparable_pairs: comparable, directional, left_only_classes: [...leftOnly].sort(), right_only_classes: [...rightOnly].sort() };
  };

  const contrasts: ContrastResult[] = [
    contrast("C1", "A_LOW_NO_CONTEXT", "B_HIGH_CONTEXT", "DIFFERENCE"),
    contrast("C2", "B_HIGH_CONTEXT", "C_HIGH_CONTEXT_ABLATED", "DIFFERENCE"),
    contrast("C3", "B_HIGH_CONTEXT", "D_LOW_CONTEXT_EQUALIZED", "NO_MEANINGFUL_DIFFERENCE"),
    contrast("C4", "A_LOW_NO_CONTEXT", "D_LOW_CONTEXT_EQUALIZED", "DIFFERENCE")
  ];
  const at = (id: string) => contrasts.find((entry) => entry.id === id);

  const hostValidScenes = observations.filter((entry) => entry.outcomes.host_valid).length;
  const hostValidRate = observations.length === 0 ? 0 : hostValidScenes / observations.length;
  const seedGateClean = Object.values(input.bundles).every((entry) => entry.seed_contamination.clean);
  const corpusIdentical = new Set(Object.values(input.bundles).map((entry) => entry.corpus_digest)).size === 1;
  const forbidden = observations.flatMap((entry) => entry.forbidden_vocabulary);
  const semanticNonConflationPass = forbidden.length === 0
    && observations.every((entry) => !entry.outcomes.forbidden_relationship_inference);
  const manipulationOk = observations.every((entry) =>
    entry.recognition.counterpart_context_visible_in_prompt === AVAILABILITY_EXPECTED[entry.condition]
    && !entry.recognition.condition_label_leak
    && entry.recognition.familiarity_entry_line !== null
    && entry.recognition.influence_entry_line !== null
    && ((entry.condition === "B_HIGH_CONTEXT" || entry.condition === "C_HIGH_CONTEXT_ABLATED")
      ? entry.retrieval.queries === 1
      : entry.retrieval.queries === 0)
  );

  const actual = observations.map((entry) => `${entry.condition}|${entry.replicate}`);
  const uniqueActual = new Set(actual);
  const duplicateScenes = actual.length - uniqueActual.size;
  const missingScenes = input.planned.filter((key) => !uniqueActual.has(key)).length;
  const extraScenes = [...uniqueActual].filter((key) => !input.planned.includes(key)).length;
  const accountingExact = duplicateScenes === 0 && missingScenes === 0 && extraScenes === 0
    && observations.length === input.planned.length;

  const failureClasses: Record<string, number> = {};
  for (const observation of observations) {
    if (observation.outcomes.host_valid) continue;
    const detail = observation.failure_detail ?? "UNKNOWN";
    const match = /(CONVERSATION_COGNITION_[A-Z_]+|MODEL_TRANSPORT_[A-Z_]+|LANGUAGE_REALIZATION_[A-Z_]+|SERVICE_UNAVAILABLE)/.exec(detail);
    const key = match?.[0] ?? "UNCLASSIFIED_FAILURE";
    failureClasses[key] = (failureClasses[key] ?? 0) + 1;
  }
  const failures = observations.filter((entry) => !entry.outcomes.host_valid);
  const schemaFailures = (failureClasses.CONVERSATION_COGNITION_MODEL_SCHEMA_INVALID ?? 0)
    + (failureClasses.LANGUAGE_REALIZATION_MODEL_SCHEMA_INVALID ?? 0);
  const sourceBindingFailures = failures.filter((entry) => /source_refs|source_handles|not bound|SOURCE_BINDING/.test(entry.failure_detail ?? "")).length;
  const transportFailures = Object.entries(failureClasses)
    .filter(([key]) => key.startsWith("MODEL_TRANSPORT_"))
    .reduce((sum, [, count]) => sum + count, 0);
  const retryCount = input.accountings.reduce((sum, entry) => sum + Math.max(0, entry.attempts.length - entry.usage.requests), 0);

  const min = GATES.paired_directional_min;
  const differenceMet = (entry: ContrastResult | undefined) => entry !== undefined && entry.comparable_pairs >= min && entry.directional >= min;
  const noDifferenceMet = (entry: ContrastResult | undefined) => entry !== undefined && entry.comparable_pairs >= min && entry.directional < min;
  const criteria: Record<string, boolean> = {
    "1_A_vs_B_effect": differenceMet(at("C1")),
    "2_B_vs_C_effect": differenceMet(at("C2")),
    "3_B_vs_D_no_effect": noDifferenceMet(at("C3")),
    "4_A_vs_D_effect": differenceMet(at("C4")),
    "5_semantic_non_conflation": semanticNonConflationPass,
    "6_seed_contamination": seedGateClean,
    "7_host_valid_rate": hostValidRate >= GATES.host_valid_rate_min,
    "9_accounting_exact": accountingExact,
    "10_language_authority": observations.every((entry) =>
      entry.outcomes.host_valid
        ? entry.language.schema_version === "language-realization-input-v10" || entry.directive_kind === "CLARIFY_MISSING_CONTEXT"
        : true)
  };
  const criteriaAllPass = Object.values(criteria).every(Boolean);
  const hardInvalid = !seedGateClean || !corpusIdentical || !accountingExact || !manipulationOk;

  let replicationAgrees = true;
  if (input.phase === "replication" && input.priorPrimary !== undefined) {
    const prior = input.priorPrimary.verdicts[input.executor];
    for (const id of ["C1", "C2", "C3", "C4"]) {
      const before = prior.contrasts.find((entry) => entry.id === id);
      const now = at(id);
      if (before === undefined || now === undefined) { replicationAgrees = false; continue; }
      const beforeMet = before.expected === "DIFFERENCE" ? before.directional >= min : before.directional < min;
      const nowMet = now.expected === "DIFFERENCE" ? now.directional >= min : now.directional < min;
      if (beforeMet !== nowMet) replicationAgrees = false;
    }
  }

  const usage = input.accountings.reduce((sum, entry) => ({
    requests: sum.requests + entry.usage.requests,
    prompt_tokens: sum.prompt_tokens + entry.usage.prompt_tokens,
    completion_tokens: sum.completion_tokens + entry.usage.completion_tokens,
    total_tokens: sum.total_tokens + entry.usage.total_tokens,
    cached_tokens: sum.cached_tokens + entry.usage.cached_tokens,
    reasoning_tokens: sum.reasoning_tokens + entry.usage.reasoning_tokens
  }), { requests: 0, prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, cached_tokens: 0, reasoning_tokens: 0 });

  const prefix = input.executor === "LOCAL_QWEN" ? "LOCAL" : "API";
  let phaseVerdict: string;
  let scientificVerdict: string | null = null;
  let detail: string;
  if (input.phase === "pilot") {
    const pilotGate = hostValidScenes >= 20 && hostValidRate >= GATES.host_valid_rate_min;
    phaseVerdict = pilotGate ? `${prefix}_HOST_VALIDITY_PILOT_PASS` : "EXECUTOR_HOST_VALIDITY_FAILURE";
    detail = `${prefix} host validity pilot: ${hostValidScenes}/${observations.length} = ${hostValidRate.toFixed(3)} (requires >= 20 valid AND >= ${GATES.host_valid_rate_min}); no scientific metric is scored`;
  } else if (hardInvalid) {
    phaseVerdict = `${prefix}_EXPERIMENT_INVALID`;
    scientificVerdict = input.phase === "replication" ? `${prefix}_EXPERIMENT_INVALID` : null;
    detail = `hard invalidity: ${!seedGateClean ? "seed contamination; " : ""}${!corpusIdentical ? "corpus mismatch; " : ""}${!accountingExact ? "accounting; " : ""}${!manipulationOk ? "manipulation check failed" : ""}`;
  } else if (input.phase === "primary") {
    phaseVerdict = criteriaAllPass ? `${prefix}_PRIMARY_AWAITING_REPLICATION` : `${prefix}_PRIMARY_CRITERIA_NOT_MET`;
    detail = criteriaAllPass
      ? `all preregistered criteria met for ${input.executor}; the scientific verdict awaits replication`
      : `preregistered criteria not met for ${input.executor}: ${Object.entries(criteria).filter(([, ok]) => !ok).map(([name]) => name).join(", ")}`;
  } else {
    if (!criteriaAllPass || !replicationAgrees) {
      scientificVerdict = `${prefix}_CONTEXT_MEDIATION_NOT_REPLICATED`;
      detail = !replicationAgrees
        ? `${prefix}: the replication did not reproduce the same direction on every contrast`
        : `${prefix}: preregistered criteria not met: ${Object.entries(criteria).filter(([, ok]) => !ok).map(([name]) => name).join(", ")}`;
    } else {
      scientificVerdict = `${prefix}_CONTEXT_MEDIATION_REPLICATED`;
      detail = `${prefix}: all preregistered criteria met in both phases and the replication reproduced the same direction`;
    }
    phaseVerdict = scientificVerdict;
  }

  return {
    executor: input.executor,
    phase: input.phase,
    phase_verdict: phaseVerdict,
    scientific_verdict: scientificVerdict,
    executor_config: first?.config ?? config,
    key_fingerprint: first?.key_fingerprint ?? null,
    host_valid_scenes: hostValidScenes,
    total_scenes: observations.length,
    host_valid_rate: hostValidRate,
    host_valid_gate_pass: hostValidRate >= GATES.host_valid_rate_min,
    schema_failures: schemaFailures,
    schema_failure_rate: observations.length === 0 ? 0 : schemaFailures / observations.length,
    factual_authority_failures: failureClasses.CONVERSATION_COGNITION_FACTUAL_AUTHORIZATION_REJECTED ?? 0,
    source_binding_failures: sourceBindingFailures,
    source_binding_failure_rate: observations.length === 0 ? 0 : sourceBindingFailures / observations.length,
    transport_failures: transportFailures,
    retry_count: retryCount,
    seed_clean: seedGateClean,
    corpus_identical: corpusIdentical,
    manipulation_ok: manipulationOk,
    semantic_non_conflation_pass: semanticNonConflationPass,
    forbidden_vocabulary: [...new Set(forbidden)],
    failure_classes: failureClasses,
    cells,
    contrasts,
    criteria,
    criteria_all_pass: criteriaAllPass,
    accounting: {
      planned_scenes: input.planned.length,
      actual_scenes: observations.length,
      unique_scenes: uniqueActual.size,
      duplicate_scenes: duplicateScenes,
      missing_scenes: missingScenes,
      extra_scenes: extraScenes,
      requests: usage.requests,
      prompt_tokens: usage.prompt_tokens,
      completion_tokens: usage.completion_tokens,
      total_tokens: usage.total_tokens,
      cached_tokens: usage.cached_tokens,
      reasoning_tokens: usage.reasoning_tokens,
      api_cost: input.executor === "API_DEEPSEEK" ? "NOT_REPORTED_BY_PROVIDER" : "NOT_APPLICABLE_LOCAL_EXECUTOR"
    },
    detail
  };
}

function crossVerdict(verdicts: Readonly<Record<ExecutorId, ExecutorVerdict>>): CrossExecutorVerdict {
  const local = verdicts.LOCAL_QWEN.scientific_verdict;
  const api = verdicts.API_DEEPSEEK.scientific_verdict;
  const comparable = verdicts.LOCAL_QWEN.host_valid_gate_pass && verdicts.API_DEEPSEEK.host_valid_gate_pass;
  let cross: string;
  let detail: string;
  if (local === "LOCAL_EXPERIMENT_INVALID" || api === "API_EXPERIMENT_INVALID") {
    cross = "EXPERIMENT_INVALID";
    detail = "at least one executor produced an invalid experiment; no comparison is authorized";
  } else if (!comparable) {
    cross = "EXECUTOR_COMPARISON_INCONCLUSIVE";
    detail = "host validity or compliance made the two executors non-comparable under the frozen thresholds";
  } else if (local === "LOCAL_CONTEXT_MEDIATION_NOT_REPLICATED" && api === "API_CONTEXT_MEDIATION_NOT_REPLICATED") {
    cross = "NO_EXECUTOR_MEDIATED_EFFECT_DETECTED";
    detail = "neither executor produced a reproducible context-mediation effect under the identical protocol";
  } else if (local === "LOCAL_CONTEXT_MEDIATION_NOT_REPLICATED" && api === "API_CONTEXT_MEDIATION_REPLICATED") {
    cross = "EXECUTOR_CAPABILITY_DEPENDENCE_OBSERVED";
    detail = "CharacterOS familiarity lawfully changes context access, and the stronger API executor can use the retrieved context to produce a reproducible cognition/behavior difference, while the local executor does not under the same protocol";
  } else if (local === "LOCAL_CONTEXT_MEDIATION_REPLICATED" && api === "API_CONTEXT_MEDIATION_REPLICATED") {
    cross = "CONTEXT_MEDIATION_EXECUTOR_ROBUST";
    detail = "the context-mediation effect reproduced with both executors under the identical protocol";
  } else {
    cross = "EXECUTOR_COMPARISON_INCONCLUSIVE";
    detail = `mixed outcome (local ${String(local)}, api ${String(api)}) without a clean capability-dependence signature`;
  }
  return { local_verdict: local, api_verdict: api, cross_verdict: cross, detail };
}

export function readPhase(path: string): PhaseResult | undefined {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as PhaseResult;
  } catch {
    return undefined;
  }
}
