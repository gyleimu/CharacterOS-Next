/**
 * EXECUTOR_MODEL_SUBSTITUTION_EXPERIMENT_V0 — execution + verdict.
 *
 * The scientific law (cells, contrasts, thresholds, endpoint, structured outcomes) is V2's,
 * imported unchanged. The only substituted variable is the executor model.
 *
 * Verdict space (frozen):
 *   FAMILIARITY_CONTEXT_MEDIATION_REPLICATED_WITH_STRONGER_EXECUTOR
 *   FAMILIARITY_CONTEXT_MEDIATION_NOT_REPLICATED_WITH_API_EXECUTOR
 *   MODEL_SUBSTITUTION_NOT_ISOLATED
 *   EXPERIMENT_INVALID
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  GATES,
  REPLICATES,
  SCENARIOS,
  pilotScenes,
  replicationScenes,
  scheduledScenes,
  type ConditionId
} from "../relationship-familiarity-context-mediation-final-replication-v2/contract.ts";
import type { SceneObservation } from "../relationship-familiarity-context-mediation-final-replication-v2/scene.ts";
import { check, hashJson, type HistoryBundle } from "../relationship-familiarity-context-mediation-final-replication-v2/world.ts";

import { EXPERIMENT_ID, LOCAL_BASELINE, RETRY_POLICY } from "./contract.ts";

export type ExecutionPhase = "pilot" | "primary" | "replication";

interface ApiAccounting {
  readonly usage: { readonly prompt_tokens: number; readonly completion_tokens: number; readonly total_tokens: number; readonly requests: number };
  readonly attempts: readonly { readonly attempt: number; readonly http_status: number | null; readonly failure_class: string | null; readonly elapsed_ms: number }[];
  readonly key_fingerprint: string;
  readonly model: string;
  readonly base_url: string;
  readonly seed_support: string;
}

export interface ContrastResult {
  readonly id: string;
  readonly left: string;
  readonly right: string;
  readonly scenario_id: string;
  readonly expected: "DIFFERENCE" | "NO_MEANINGFUL_DIFFERENCE";
  readonly comparable_pairs: number;
  readonly directional: number;
  readonly left_only_classes: readonly string[];
  readonly right_only_classes: readonly string[];
}

export interface SubstitutionVerdict {
  readonly schema_version: "executor-substitution-verdict-v0";
  readonly experiment_id: typeof EXPERIMENT_ID;
  readonly phase: ExecutionPhase;
  readonly phase_verdict: string;
  readonly scientific_verdict: string | null;
  readonly executor: {
    readonly kind: "API_OPENAI_COMPATIBLE";
    readonly base_url: string;
    readonly model: string;
    readonly key_fingerprint: string;
    readonly seed_support: string;
    readonly local_fallback: "FORBIDDEN";
    readonly retry_policy: unknown;
  };
  readonly local_baseline: unknown;
  readonly host_valid_scenes: number;
  readonly host_valid_rate: number;
  readonly host_valid_gate_pass: boolean;
  readonly schema_failures: number;
  readonly factual_authority_failures: number;
  readonly source_binding_failures: number;
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
    readonly duplicate_scenes: number;
    readonly missing_scenes: number;
    readonly extra_scenes: number;
    readonly requests: number;
    readonly prompt_tokens: number;
    readonly completion_tokens: number;
    readonly total_tokens: number;
    readonly api_cost: "NOT_REPORTED_BY_PROVIDER" | string;
  };
  readonly detail: string;
}

const AVAILABILITY_EXPECTED: Record<string, boolean> = {
  A_LOW_NO_CONTEXT: false,
  B_HIGH_CONTEXT: true,
  C_HIGH_CONTEXT_ABLATED: false,
  D_LOW_CONTEXT_EQUALIZED: true
};

export async function runScenes(input: {
  readonly phase: ExecutionPhase;
  readonly bundles: Record<string, HistoryBundle>;
  readonly evidenceDir: string;
  readonly primaryVerdict?: SubstitutionVerdict | undefined;
}): Promise<SubstitutionVerdict> {
  mkdirSync(input.evidenceDir, { recursive: true });
  const worker = fileURLToPath(new URL("./scene-worker-api.ts", import.meta.url));
  const schedule = input.phase === "pilot"
    ? pilotScenes()
    : input.phase === "primary"
      ? scheduledScenes()
      : replicationScenes();
  const observations: SceneObservation[] = [];
  const accountings: ApiAccounting[] = [];
  const failures: { condition: string; replicate: number; detail: string }[] = [];

  for (const scene of schedule) {
    const bundle = input.bundles[scene.condition];
    check(bundle !== undefined, `history bundle for ${scene.condition}`);
    const payload = {
      bundle,
      condition: scene.condition,
      scenario_index: SCENARIOS.findIndex((entry) => entry.id === scene.scenario.id),
      replicate: scene.replicate,
      evidence_dir: input.evidenceDir,
      identity_phase: input.phase
    };
    const result = spawnSync(process.execPath, [worker], {
      input: JSON.stringify(payload),
      encoding: "utf8",
      timeout: 1800000,
      maxBuffer: 256 * 1024 * 1024
    });
    if (result.status !== 0 || String(result.stdout ?? "").trim().length === 0) {
      writeFileSync(
        join(input.evidenceDir, `worker-failure-${scene.condition}-r${scene.replicate}.txt`),
        `${String(result.stdout ?? "")}\n${String(result.stderr ?? "")}\n`
      );
      check(false, `scene worker failed (${scene.condition}/r${scene.replicate}): ${String(result.stderr ?? "").slice(0, 400)}`);
    }
    const parsed = JSON.parse(String(result.stdout)) as SceneObservation & { __api_accounting: ApiAccounting };
    const { __api_accounting: accounting, ...observation } = parsed;
    observations.push(observation as SceneObservation);
    accountings.push(accounting);
    if (!(observation as SceneObservation).outcomes.host_valid) {
      failures.push({
        condition: scene.condition,
        replicate: scene.replicate,
        detail: String((observation as SceneObservation).failure_detail ?? "")
      });
    }
    writeFileSync(
      join(input.evidenceDir, "progress.log"),
      `${observations.map((entry) => `${entry.condition} r${entry.replicate} ${entry.result_kind} ${entry.behavior_class} ctx=${String(entry.recognition.counterpart_context_visible_in_prompt)} cited=${String(entry.outcomes.counterpart_context_cited)}`).join("\n")}\n`
    );
    process.stderr.write(
      `[${observations.length}/${schedule.length}] ${observation.condition} r${observation.replicate} ${(observation as SceneObservation).result_kind} ${(observation as SceneObservation).behavior_class} ctx=${String((observation as SceneObservation).recognition.counterpart_context_visible_in_prompt)}\n`
    );
  }

  // ---- cells -----------------------------------------------------------------------
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

  // ---- contrasts (V2's frozen law) --------------------------------------------------
  const byKey = new Map(observations.map((entry) => [`${entry.condition}|${entry.scenario_id}|${entry.replicate}`, entry]));
  const replicates = [...new Set(observations.map((entry) => entry.replicate))];
  const scenarioId = SCENARIOS[0]?.id ?? "S1";

  function contrast(id: string, left: ConditionId, right: ConditionId, expected: ContrastResult["expected"]): ContrastResult {
    let comparable = 0;
    let directional = 0;
    const leftOnly = new Set<string>();
    const rightOnly = new Set<string>();
    for (const replicate of replicates) {
      const a = byKey.get(`${left}|${scenarioId}|${replicate}`);
      const b = byKey.get(`${right}|${scenarioId}|${replicate}`);
      if (a === undefined || b === undefined) continue;
      if (!a.outcomes.host_valid || !b.outcomes.host_valid) continue;
      comparable += 1;
      if (a.behavior_class !== b.behavior_class) {
        directional += 1;
        leftOnly.add(a.behavior_class);
        rightOnly.add(b.behavior_class);
      }
    }
    return { id, left, right, scenario_id: scenarioId, expected, comparable_pairs: comparable, directional, left_only_classes: [...leftOnly].sort(), right_only_classes: [...rightOnly].sort() };
  }

  const contrasts: ContrastResult[] = [
    contrast("C1", "A_LOW_NO_CONTEXT", "B_HIGH_CONTEXT", "DIFFERENCE"),
    contrast("C2", "B_HIGH_CONTEXT", "C_HIGH_CONTEXT_ABLATED", "DIFFERENCE"),
    contrast("C3", "B_HIGH_CONTEXT", "D_LOW_CONTEXT_EQUALIZED", "NO_MEANINGFUL_DIFFERENCE"),
    contrast("C4", "A_LOW_NO_CONTEXT", "D_LOW_CONTEXT_EQUALIZED", "DIFFERENCE")
  ];
  const at = (id: string) => contrasts.find((entry) => entry.id === id);

  // ---- gates -----------------------------------------------------------------------
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

  const planned = schedule.map((entry) => `${entry.condition}|${entry.replicate}`);
  const actual = observations.map((entry) => `${entry.condition}|${entry.replicate}`);
  const uniqueActual = new Set(actual);
  const duplicateScenes = actual.length - uniqueActual.size;
  const missingScenes = planned.filter((key) => !uniqueActual.has(key)).length;
  const extraScenes = [...uniqueActual].filter((key) => !planned.includes(key)).length;
  const accountingExact = duplicateScenes === 0 && missingScenes === 0 && extraScenes === 0
    && observations.length === schedule.length;

  const failureClasses: Record<string, number> = {};
  for (const failure of failures) {
    const match = /(CONVERSATION_COGNITION_[A-Z_]+|MODEL_TRANSPORT_[A-Z_]+|LANGUAGE_REALIZATION_[A-Z_]+|SERVICE_UNAVAILABLE)/.exec(failure.detail);
    const key = match?.[0] ?? "UNCLASSIFIED_FAILURE";
    failureClasses[key] = (failureClasses[key] ?? 0) + 1;
  }
  const schemaFailures = (failureClasses.CONVERSATION_COGNITION_MODEL_SCHEMA_INVALID ?? 0)
    + (failureClasses.LANGUAGE_REALIZATION_MODEL_SCHEMA_INVALID ?? 0);
  const factualAuthorityFailures = failureClasses.CONVERSATION_COGNITION_FACTUAL_AUTHORIZATION_REJECTED ?? 0;
  const sourceBindingFailures = failures.filter((failure) => /source_refs|source_handles|not bound|SOURCE_BINDING/.test(failure.detail)).length;
  const transportFailures = Object.entries(failureClasses)
    .filter(([key]) => key.startsWith("MODEL_TRANSPORT_"))
    .reduce((sum, [, count]) => sum + count, 0);
  const retryCount = accountings.reduce((sum, entry) => sum + Math.max(0, entry.attempts.length - entry.usage.requests), 0);

  const min = GATES.paired_directional_min;
  const differenceMet = (entry: ContrastResult | undefined) =>
    entry !== undefined && entry.comparable_pairs >= min && entry.directional >= min;
  const noDifferenceMet = (entry: ContrastResult | undefined) =>
    entry !== undefined && entry.comparable_pairs >= min && entry.directional < min;
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
  if (input.phase === "replication" && input.primaryVerdict !== undefined) {
    for (const id of ["C1", "C2", "C3", "C4"]) {
      const primary = input.primaryVerdict.contrasts.find((entry) => entry.id === id);
      const mine = at(id);
      if (primary === undefined || mine === undefined) { replicationAgrees = false; continue; }
      const primaryMet = primary.expected === "DIFFERENCE" ? primary.directional >= min : primary.directional < min;
      const mineMet = mine.expected === "DIFFERENCE" ? mine.directional >= min : mine.directional < min;
      if (primaryMet !== mineMet) replicationAgrees = false;
    }
  }

  const totalUsage = accountings.reduce((sum, entry) => ({
    prompt_tokens: sum.prompt_tokens + entry.usage.prompt_tokens,
    completion_tokens: sum.completion_tokens + entry.usage.completion_tokens,
    total_tokens: sum.total_tokens + entry.usage.total_tokens,
    requests: sum.requests + entry.usage.requests
  }), { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, requests: 0 });
  const firstAccounting = accountings[0];

  let phaseVerdict: string;
  let scientificVerdict: string | null = null;
  let detail: string;
  if (input.phase === "pilot") {
    const pilotGate = hostValidScenes >= 20 && hostValidRate >= GATES.host_valid_rate_min;
    phaseVerdict = pilotGate ? "API_HOST_VALIDITY_PILOT_PASS" : "API_HOST_VALIDITY_PILOT_FAIL";
    detail = `API host validity pilot: ${hostValidScenes}/${observations.length} = ${hostValidRate.toFixed(3)} (requires >= 20 valid AND >= ${GATES.host_valid_rate_min}); no scientific metric is scored`;
  } else if (hardInvalid) {
    phaseVerdict = "EXPERIMENT_INVALID";
    scientificVerdict = input.phase === "replication" ? "EXPERIMENT_INVALID" : null;
    detail = `hard invalidity: ${!seedGateClean ? "seed contamination; " : ""}${!corpusIdentical ? "corpus mismatch; " : ""}${!accountingExact ? "accounting; " : ""}${!manipulationOk ? "manipulation check failed" : ""}`;
  } else if (input.phase === "primary") {
    phaseVerdict = criteriaAllPass ? "PRIMARY_AWAITING_INDEPENDENT_REPLICATION" : "PRIMARY_CRITERIA_NOT_MET";
    detail = criteriaAllPass
      ? "all preregistered criteria met with the API executor; the scientific verdict awaits the independent replication"
      : `preregistered criteria not met: ${Object.entries(criteria).filter(([, ok]) => !ok).map(([name]) => name).join(", ")}`;
  } else {
    if (!criteriaAllPass || !replicationAgrees) {
      scientificVerdict = "FAMILIARITY_CONTEXT_MEDIATION_NOT_REPLICATED_WITH_API_EXECUTOR";
      detail = !replicationAgrees
        ? "the independent replication did not reproduce the same direction on every contrast"
        : `preregistered criteria not met with the API executor: ${Object.entries(criteria).filter(([, ok]) => !ok).map(([name]) => name).join(", ")}`;
    } else {
      scientificVerdict = "FAMILIARITY_CONTEXT_MEDIATION_REPLICATED_WITH_STRONGER_EXECUTOR";
      detail = "all preregistered criteria met with the API executor in both executions, and the independent replication reproduced the same direction on every contrast: familiarity controls context ACCESS, and this executor USES the retrieved context to change cognition/behavior";
    }
    phaseVerdict = scientificVerdict;
  }

  const verdict: SubstitutionVerdict = {
    schema_version: "executor-substitution-verdict-v0",
    experiment_id: EXPERIMENT_ID,
    phase: input.phase,
    phase_verdict: phaseVerdict,
    scientific_verdict: scientificVerdict,
    executor: {
      kind: "API_OPENAI_COMPATIBLE",
      base_url: firstAccounting?.base_url ?? "unknown",
      model: firstAccounting?.model ?? "unknown",
      key_fingerprint: firstAccounting?.key_fingerprint ?? "unknown",
      seed_support: firstAccounting?.seed_support ?? "unknown",
      local_fallback: "FORBIDDEN",
      retry_policy: RETRY_POLICY
    },
    local_baseline: LOCAL_BASELINE,
    host_valid_scenes: hostValidScenes,
    host_valid_rate: hostValidRate,
    host_valid_gate_pass: hostValidRate >= GATES.host_valid_rate_min,
    schema_failures: schemaFailures,
    factual_authority_failures: factualAuthorityFailures,
    source_binding_failures: sourceBindingFailures,
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
      planned_scenes: planned.length,
      actual_scenes: observations.length,
      duplicate_scenes: duplicateScenes,
      missing_scenes: missingScenes,
      extra_scenes: extraScenes,
      requests: totalUsage.requests,
      prompt_tokens: totalUsage.prompt_tokens,
      completion_tokens: totalUsage.completion_tokens,
      total_tokens: totalUsage.total_tokens,
      api_cost: "NOT_REPORTED_BY_PROVIDER"
    },
    detail
  };
  writeFileSync(join(input.evidenceDir, `verdict-${input.phase}.json`), `${JSON.stringify({ ...verdict, verdict_hash: hashJson(verdict) }, null, 2)}\n`);
  return verdict;
}

export function readVerdict(path: string): SubstitutionVerdict | undefined {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as SubstitutionVerdict;
  } catch {
    return undefined;
  }
}

export const REPLICATE_COUNT = REPLICATES;
