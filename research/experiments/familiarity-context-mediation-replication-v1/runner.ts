/**
 * FAMILIARITY_CONTEXT_MEDIATION_REPLICATION_V1 — bounded execution + verdict.
 *
 * Phases:
 *   pilot        HOST VALIDITY PILOT — model compliance only. NO scientific verdict,
 *                distinct identities, no gate and no metric is scored.
 *   primary      the preregistered scientific execution (4 cells × 2 scenarios × 4).
 *   replication  the independent re-execution under FROZEN code (replicates 5..8).
 *
 * Every scene runs in a FRESH process that performs a full authoritative v4 restore
 * (boundary mint → chain validation → exact terminal head) before the matched current
 * scene. Exactly one cognition call and at most one language call per scene; no retries.
 *
 * PREREGISTERED CONTRASTS (primary scenario gates):
 *   C1  A_LOW  vs B_HIGH                    treatment effect
 *   C2  B_HIGH vs C_HIGH_RETRIEVAL_ABLATED  retrieval-mediator effect (effect should vanish)
 *   C3  B_HIGH vs D_LOW_CONTEXT_EQUALIZED   familiarity scalar, context equalized (expect NONE)
 *   C4  A_LOW  vs D_LOW_CONTEXT_EQUALIZED   context reproduces treatment (expect YES)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  GATES,
  MODEL,
  RESEARCH_INTERVENTIONS,
  SCENARIOS,
  pilotScenes,
  replicationCallMaximum,
  replicationScenes,
  scheduledCallMaximum,
  scheduledScenes,
  type ConditionId
} from "./contract.ts";
import type { SceneObservation } from "./scene.ts";
import { check, hashJson, type HistoryBundle } from "./world.ts";

export type ExecutionPhase = "pilot" | "primary" | "replication";

export interface CellSummary {
  readonly classes: readonly string[];
  readonly majority: string | null;
  readonly majority_count: number;
  readonly host_valid: number;
  readonly total: number;
  readonly counterpart_context_visible: number;
  readonly counterpart_context_cited: number;
  readonly correct_counterpart_context_cited: number;
  readonly clarification_requested: number;
  readonly redundant_context_query: number;
  readonly unsupported_relationship_inference: number;
  readonly queries: readonly number[];
  readonly familiarity_lines: readonly (string | null)[];
  readonly revision_lines: readonly (string | null)[];
}

export interface ContrastResult {
  readonly id: string;
  readonly left: string;
  readonly right: string;
  readonly scenario_id: string;
  readonly question: string;
  readonly comparable_pairs: number;
  readonly directional: number;
  readonly left_only_classes: readonly string[];
  readonly right_only_classes: readonly string[];
}

export interface ExecutionVerdict {
  readonly schema_version: "familiarity-context-mediation-verdict-v1";
  readonly experiment_id: "FAMILIARITY_CONTEXT_MEDIATION_REPLICATION_V1";
  readonly phase: ExecutionPhase;
  readonly verdict: string;
  readonly principal_verdict: string;
  readonly causal_scope: "EXECUTOR_COMPOSITION";
  readonly scientific_verdict_authorized: boolean;
  readonly host_valid_rate: number;
  readonly host_complete: boolean;
  readonly seed_clean: boolean;
  readonly corpus_identical: boolean;
  readonly manipulation_ok: boolean;
  readonly semantic_non_conflation_pass: boolean;
  readonly language_authority_clean: boolean;
  readonly forbidden_vocabulary: readonly string[];
  readonly failure_classes: Readonly<Record<string, number>>;
  readonly cells: Record<string, CellSummary>;
  readonly contrasts: readonly ContrastResult[];
  readonly criteria: Readonly<Record<string, boolean>>;
  readonly call_accounting: {
    readonly planned_scenes: number;
    readonly actual_scenes: number;
    readonly duplicate_scenes: number;
    readonly missing_scenes: number;
    readonly extra_scenes: number;
    readonly cognition_calls: number;
    readonly language_calls: number;
    readonly total_calls: number;
    readonly scheduled_calls_maximum: number;
  };
  readonly model: unknown;
  readonly interventions: unknown;
  readonly detail: string;
}

function majorityOf(classes: readonly string[]): { majority: string | null; count: number } {
  const counts = new Map<string, number>();
  for (const entry of classes) counts.set(entry, (counts.get(entry) ?? 0) + 1);
  let best: string | null = null;
  let bestCount = 0;
  for (const [entry, count] of counts) {
    if (count > bestCount) {
      best = entry;
      bestCount = count;
    }
  }
  return { majority: best, count: bestCount };
}

function revisionOf(observation: SceneObservation): string | null {
  return /\[current state\] logical_time=\d+ state_revision=\d+/.exec(observation.cognition.user_content)?.[0] ?? null;
}

const AVAILABILITY_EXPECTED: Record<string, boolean> = {
  A_LOW: false,
  B_HIGH: true,
  C_HIGH_RETRIEVAL_ABLATED: false,
  D_LOW_CONTEXT_EQUALIZED: true
};

export async function runScenes(input: {
  readonly phase: ExecutionPhase;
  readonly bundles: Record<string, HistoryBundle>;
  readonly evidenceDir: string;
}): Promise<ExecutionVerdict> {
  mkdirSync(input.evidenceDir, { recursive: true });
  const worker = fileURLToPath(new URL("./scene-worker.ts", import.meta.url));
  const schedule = input.phase === "pilot"
    ? pilotScenes()
    : input.phase === "primary"
      ? scheduledScenes()
      : replicationScenes();
  const observations: SceneObservation[] = [];
  let cognitionCalls = 0;
  let languageCalls = 0;

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
    const started = Date.now();
    const result = spawnSync(process.execPath, [worker], {
      input: JSON.stringify(payload),
      encoding: "utf8",
      timeout: 900000,
      maxBuffer: 128 * 1024 * 1024
    });
    if (result.status !== 0 || String(result.stdout ?? "").trim().length === 0) {
      writeFileSync(
        join(input.evidenceDir, `worker-failure-${scene.condition}-${scene.scenario.id}-r${scene.replicate}.txt`),
        `${String(result.stdout ?? "")}\n${String(result.stderr ?? "")}\n`
      );
      check(false, `scene worker failed (${scene.condition}/${scene.scenario.id}/r${scene.replicate}): ${String(result.stderr ?? "").slice(0, 400)}`);
    }
    const observation = JSON.parse(String(result.stdout)) as SceneObservation;
    observations.push(observation);
    cognitionCalls += observation.cognition.calls;
    languageCalls += observation.language.calls;
    writeFileSync(
      join(input.evidenceDir, "progress.log"),
      `${observations.map((entry) => `${entry.condition} ${entry.scenario_id} r${entry.replicate} ${entry.result_kind} ${entry.behavior_class} ctx=${String(entry.recognition.counterpart_context_visible_in_prompt)} cited=${String(entry.outcomes.counterpart_context_cited)}`).join("\n")}\n`
    );
    process.stderr.write(
      `[${observations.length}/${schedule.length}] ${observation.condition} ${observation.scenario_id} r${observation.replicate} ${observation.result_kind} ${observation.behavior_class} ctx=${String(observation.recognition.counterpart_context_visible_in_prompt)} (${Date.now() - started}ms)\n`
    );
  }

  // ---- cells -----------------------------------------------------------------------
  const cells: Record<string, CellSummary> = {};
  const mutable: Record<string, {
    classes: string[]; host_valid: number; total: number; ctxVisible: number;
    cited: number; correct: number; clarify: number; redundant: number; unsupported: number;
    queries: number[]; familiarity_lines: (string | null)[]; revision_lines: (string | null)[];
  }> = {};
  for (const observation of observations) {
    const cell = mutable[observation.condition]
      ?? (mutable[observation.condition] = {
        classes: [], host_valid: 0, total: 0, ctxVisible: 0, cited: 0, correct: 0,
        clarify: 0, redundant: 0, unsupported: 0, queries: [], familiarity_lines: [], revision_lines: []
      });
    cell.classes.push(observation.behavior_class);
    cell.total += 1;
    cell.queries.push(observation.retrieval.queries);
    cell.familiarity_lines.push(observation.recognition.familiarity_entry_line);
    cell.revision_lines.push(revisionOf(observation));
    if (observation.outcomes.host_valid) cell.host_valid += 1;
    if (observation.recognition.counterpart_context_visible_in_prompt) cell.ctxVisible += 1;
    if (observation.outcomes.counterpart_context_cited) cell.cited += 1;
    if (observation.outcomes.correct_counterpart_context_cited) cell.correct += 1;
    if (observation.outcomes.clarification_requested) cell.clarify += 1;
    if (observation.outcomes.redundant_context_query) cell.redundant += 1;
    if (observation.outcomes.unsupported_relationship_inference) cell.unsupported += 1;
  }
  for (const [key, cell] of Object.entries(mutable)) {
    const scored = majorityOf(cell.classes);
    cells[key] = {
      classes: cell.classes,
      majority: scored.majority,
      majority_count: scored.count,
      host_valid: cell.host_valid,
      total: cell.total,
      counterpart_context_visible: cell.ctxVisible,
      counterpart_context_cited: cell.cited,
      correct_counterpart_context_cited: cell.correct,
      clarification_requested: cell.clarify,
      redundant_context_query: cell.redundant,
      unsupported_relationship_inference: cell.unsupported,
      queries: cell.queries,
      familiarity_lines: cell.familiarity_lines,
      revision_lines: cell.revision_lines
    };
  }

  // ---- contrasts ------------------------------------------------------------------
  const byKey = new Map(observations.map((entry) => [`${entry.condition}|${entry.scenario_id}|${entry.replicate}`, entry]));
  const replicates = [...new Set(observations.map((entry) => entry.replicate))];

  function contrast(
    id: string,
    left: ConditionId,
    right: ConditionId,
    scenarioId: string,
    question: string
  ): ContrastResult {
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
    return {
      id, left, right, scenario_id: scenarioId, question,
      comparable_pairs: comparable,
      directional,
      left_only_classes: [...leftOnly].sort(),
      right_only_classes: [...rightOnly].sort()
    };
  }

  const primaryScenario = SCENARIOS.find((entry) => entry.primary)?.id ?? (SCENARIOS[0] as { id: string }).id;
  const scenarioIds = SCENARIOS.map((entry) => entry.id);
  const contrasts: ContrastResult[] = [];
  for (const scenarioId of scenarioIds) {
    contrasts.push(contrast("C1", "A_LOW", "B_HIGH", scenarioId, "does real familiarity-triggered retrieval accompany a behavior difference?"));
    contrasts.push(contrast("C2", "B_HIGH", "C_HIGH_RETRIEVAL_ABLATED", scenarioId, "with familiarity held equal, does removing the retrieval mediator remove the effect?"));
    contrasts.push(contrast("C3", "B_HIGH", "D_LOW_CONTEXT_EQUALIZED", scenarioId, "with context equalized, does the familiarity scalar still have an effect?"));
    contrasts.push(contrast("C4", "A_LOW", "D_LOW_CONTEXT_EQUALIZED", scenarioId, "does providing the treatment context to a low-familiarity subject reproduce the treatment behavior?"));
  }
  const at = (id: string, scenarioId: string) =>
    contrasts.find((entry) => entry.id === id && entry.scenario_id === scenarioId);

  // ---- gates -----------------------------------------------------------------------
  const hostValidScenes = observations.filter((entry) => entry.outcomes.host_valid).length;
  const hostValidRate = observations.length === 0 ? 0 : hostValidScenes / observations.length;
  const hostComplete = observations.every((entry) => entry.outcomes.host_valid);
  const seedGateClean = Object.values(input.bundles).every((entry) => entry.seed_contamination.clean);
  const corpusIdentical = new Set(Object.values(input.bundles).map((entry) => entry.corpus_digest)).size === 1;
  const forbidden = observations.flatMap((entry) => entry.forbidden_vocabulary);
  const unsupportedInferences = observations.filter((entry) => entry.outcomes.unsupported_relationship_inference).length;
  const semanticNonConflationPass = forbidden.length === 0 && unsupportedInferences === 0;
  const languageClean = observations.every((entry) =>
    entry.outcomes.host_valid
      ? entry.language.schema_version === "language-realization-input-v10" || entry.directive_kind === "CLARIFY_MISSING_CONTEXT"
      : true
  );
  const manipulationOk = observations.every((entry) =>
    entry.recognition.counterpart_context_visible_in_prompt === AVAILABILITY_EXPECTED[entry.condition]
    && !entry.recognition.condition_label_leak
    && entry.recognition.familiarity_entry_line !== null
    && entry.recognition.influence_entry_line !== null
    && ((entry.condition === "B_HIGH" || entry.condition === "C_HIGH_RETRIEVAL_ABLATED")
      ? entry.retrieval.queries === 1
      : entry.retrieval.queries === 0)
  );

  const planned = schedule.map((entry) => `${entry.condition}|${entry.scenario.id}|${entry.replicate}`);
  const actual = observations.map((entry) => `${entry.condition}|${entry.scenario_id}|${entry.replicate}`);
  const uniqueActual = new Set(actual);
  const duplicateScenes = actual.length - uniqueActual.size;
  const missingScenes = planned.filter((key) => !uniqueActual.has(key)).length;
  const extraScenes = [...uniqueActual].filter((key) => !planned.includes(key)).length;
  const accountingExact = duplicateScenes === 0 && missingScenes === 0 && extraScenes === 0
    && observations.length === schedule.length;

  const failureClasses: Record<string, number> = {};
  for (const observation of observations) {
    if (observation.outcomes.host_valid) continue;
    const detail = observation.failure_detail ?? "UNKNOWN";
    const match = /(CONVERSATION_COGNITION_[A-Z_]+|MODEL_TRANSPORT_[A-Z_]+|SERVICE_UNAVAILABLE|[A-Z_]{8,})/.exec(detail);
    const key = match?.[0] ?? "UNCLASSIFIED_FAILURE";
    failureClasses[key] = (failureClasses[key] ?? 0) + 1;
  }

  // ---- preregistered criteria (§13) -------------------------------------------------
  const min = GATES.paired_directional_min;
  const c1 = at("C1", primaryScenario);
  const c2 = at("C2", primaryScenario);
  const c3 = at("C3", primaryScenario);
  const c4 = at("C4", primaryScenario);
  const criteria: Record<string, boolean> = {
    "1_A_vs_B_difference": c1 !== undefined && c1.comparable_pairs >= min && c1.directional >= min,
    "2_B_vs_C_mediator_removal": c2 !== undefined && c2.comparable_pairs >= min && c2.directional >= min,
    "3_B_vs_D_no_scalar_effect": c3 !== undefined && c3.comparable_pairs >= min && c3.directional < min,
    "4_A_vs_D_context_reproduces": c4 !== undefined && c4.comparable_pairs >= min && c4.directional >= min,
    "5_semantic_non_conflation": semanticNonConflationPass,
    "6_seed_contamination": seedGateClean,
    "7_host_valid_rate": hostValidRate >= GATES.host_valid_rate_min,
    "9_accounting_exact": accountingExact,
    "10_language_authority": languageClean
  };
  const coreSatisfied = Object.values(criteria).every(Boolean);

  let principal: string;
  let verdict: string;
  let detail: string;
  const verdictAuthorized = input.phase !== "pilot";
  if (input.phase === "pilot") {
    principal = "PILOT_NO_SCIENTIFIC_VERDICT";
    verdict = "PILOT_NO_SCIENTIFIC_VERDICT";
    detail = `host validity pilot: host-valid rate ${hostValidRate.toFixed(3)} (${hostValidScenes}/${observations.length}); model compliance measured only, no preregistered metric scored`;
  } else if (!seedGateClean) {
    principal = "EXPERIMENT_INVALID";
    verdict = principal;
    detail = "the initialization seed gate failed: familiarity state was present in a seed";
  } else if (!corpusIdentical) {
    principal = "EXPERIMENT_INVALID";
    verdict = principal;
    detail = "the candidate corpora are not identical across cells";
  } else if (!accountingExact) {
    principal = "EXPERIMENT_INVALID";
    verdict = principal;
    detail = `schedule accounting failed: duplicates=${duplicateScenes} missing=${missingScenes} extra=${extraScenes}`;
  } else if (!manipulationOk) {
    principal = "EXPERIMENT_INVALID";
    verdict = principal;
    detail = "the preregistered manipulation check failed: a cell was not constructed as specified";
  } else if (!criteria["7_host_valid_rate"] || !criteria["10_language_authority"]) {
    principal = "FAMILIARITY_CONTEXT_MEDIATION_INCONCLUSIVE";
    verdict = principal;
    detail = `host-valid rate ${hostValidRate.toFixed(3)} < ${GATES.host_valid_rate_min} or a behavior was realized outside the authorized V10/atom path; no behavioral claim is authorized`;
  } else if (!criteria["5_semantic_non_conflation"]) {
    principal = "FAMILIARITY_CONTEXT_MEDIATION_INCONCLUSIVE";
    verdict = "SEMANTIC_NON_CONFLATION_FAILED";
    detail = `unauthorized relationship vocabulary/inference appeared: ${[...new Set(forbidden)].join(", ") || "(structured inference flag)"}`;
  } else if (!criteria["1_A_vs_B_difference"]) {
    principal = "FAMILIARITY_CONTEXT_MEDIATION_NOT_DETECTED";
    verdict = principal;
    detail = "every cell was constructed as preregistered, manipulation and host validity hold, and the preregistered endpoint did not differ between A_LOW and B_HIGH";
  } else if (coreSatisfied) {
    principal = input.phase === "primary"
      ? "FAMILIARITY_CONTEXT_MEDIATION_OBSERVED_NOT_REPLICATED"
      : "FAMILIARITY_CONTEXT_MEDIATION_REPLICATED";
    verdict = principal;
    detail = "all preregistered criteria hold: retrieval mediates the effect, the familiarity scalar adds no independent effect once context is equalized, and equalized context reproduces the treatment behavior";
  } else {
    principal = "FAMILIARITY_CONTEXT_MEDIATION_INCONCLUSIVE";
    verdict = principal;
    detail = `a difference was observed but the mediation pattern is incomplete: ${Object.entries(criteria).filter(([, ok]) => !ok).map(([name]) => name).join(", ")}`;
  }

  const result: ExecutionVerdict = {
    schema_version: "familiarity-context-mediation-verdict-v1",
    experiment_id: "FAMILIARITY_CONTEXT_MEDIATION_REPLICATION_V1",
    phase: input.phase,
    verdict,
    principal_verdict: principal,
    causal_scope: "EXECUTOR_COMPOSITION",
    scientific_verdict_authorized: verdictAuthorized,
    host_valid_rate: hostValidRate,
    host_complete: hostComplete,
    seed_clean: seedGateClean,
    corpus_identical: corpusIdentical,
    manipulation_ok: manipulationOk,
    semantic_non_conflation_pass: semanticNonConflationPass,
    language_authority_clean: languageClean,
    forbidden_vocabulary: [...new Set(forbidden)],
    failure_classes: failureClasses,
    cells,
    contrasts,
    criteria,
    call_accounting: {
      planned_scenes: planned.length,
      actual_scenes: observations.length,
      duplicate_scenes: duplicateScenes,
      missing_scenes: missingScenes,
      extra_scenes: extraScenes,
      cognition_calls: cognitionCalls,
      language_calls: languageCalls,
      total_calls: cognitionCalls + languageCalls,
      scheduled_calls_maximum: input.phase === "primary"
        ? scheduledCallMaximum()
        : input.phase === "replication"
          ? replicationCallMaximum()
          : 12
    },
    model: MODEL,
    interventions: RESEARCH_INTERVENTIONS,
    detail
  };
  writeFileSync(
    join(input.evidenceDir, `verdict-${input.phase}.json`),
    `${JSON.stringify({ ...result, verdict_hash: hashJson(result) }, null, 2)}\n`
  );
  return result;
}
