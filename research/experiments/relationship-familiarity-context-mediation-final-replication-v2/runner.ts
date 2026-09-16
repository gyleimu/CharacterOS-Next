/**
 * RELATIONSHIP_FAMILIARITY_CONTEXT_MEDIATION_FINAL_REPLICATION_V2 — execution + verdict.
 *
 * Phases:
 *   pilot        HOST_VALIDITY_PILOT_V2 — model compliance only. NO scientific verdict.
 *                Must reach >= 0.95 host-valid with >= 20 valid scenes before the primary.
 *   primary      the preregistered scientific execution (4 cells × 10 replicates).
 *   replication  the independent re-execution under FROZEN code (replicates 11..20).
 *
 * Every scene runs in a FRESH process performing a full authoritative v4 restore
 * (boundary mint → chain validation → exact terminal head) before the matched scene.
 * One cognition call and at most one language call per scene; no retries, no repair.
 *
 * PREREGISTERED CONTRASTS (protocol §7):
 *   C1 A_LOW_NO_CONTEXT  ↔ B_HIGH_CONTEXT           familiarity → retrieval → context
 *   C2 B_HIGH_CONTEXT    ↔ C_HIGH_CONTEXT_ABLATED   mediator necessity
 *   C3 B_HIGH_CONTEXT    ↔ D_LOW_CONTEXT_EQUALIZED  direct scalar effect (expect NONE)
 *   C4 A_LOW_NO_CONTEXT  ↔ D_LOW_CONTEXT_EQUALIZED  context sufficiency
 *
 * FINAL VERDICT SPACE IS EXACTLY THREE VALUES (protocol §15):
 *   FAMILIARITY_CONTEXT_MEDIATION_REPLICATED / _NOT_REPLICATED / EXPERIMENT_INVALID
 * There is no INCONCLUSIVE outcome: this slice exists to remove the host-validity problem,
 * so an unmet host-validity gate is reported as NOT_REPLICATED.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
  readonly continuation_success: number;
  readonly clarification_requested: number;
  readonly unsupported_context_claim: number;
  readonly forbidden_relationship_inference: number;
  readonly queries: readonly number[];
  readonly familiarity_lines: readonly (string | null)[];
}

export interface ContrastResult {
  readonly id: string;
  readonly left: string;
  readonly right: string;
  readonly scenario_id: string;
  readonly question: string;
  readonly expected: "DIFFERENCE" | "NO_MEANINGFUL_DIFFERENCE";
  readonly comparable_pairs: number;
  readonly directional: number;
  readonly left_only_classes: readonly string[];
  readonly right_only_classes: readonly string[];
}

export interface ExecutionVerdict {
  readonly schema_version: "familiarity-final-replication-verdict-v2";
  readonly experiment_id: "RELATIONSHIP_FAMILIARITY_CONTEXT_MEDIATION_FINAL_REPLICATION_V2";
  readonly phase: ExecutionPhase;
  readonly phase_verdict: string;
  readonly scientific_verdict: string | null;
  readonly causal_scope: "EXECUTOR_COMPOSITION";
  readonly host_valid_scenes: number;
  readonly host_valid_rate: number;
  readonly host_valid_gate_pass: boolean;
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
  readonly criteria_all_pass: boolean;
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

const AVAILABILITY_EXPECTED: Record<string, boolean> = {
  A_LOW_NO_CONTEXT: false,
  B_HIGH_CONTEXT: true,
  C_HIGH_CONTEXT_ABLATED: false,
  D_LOW_CONTEXT_EQUALIZED: true
};

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

export async function runScenes(input: {
  readonly phase: ExecutionPhase;
  readonly bundles: Record<string, HistoryBundle>;
  readonly evidenceDir: string;
  readonly primaryVerdict?: ExecutionVerdict | undefined;
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
        join(input.evidenceDir, `worker-failure-${scene.condition}-r${scene.replicate}.txt`),
        `${String(result.stdout ?? "")}\n${String(result.stderr ?? "")}\n`
      );
      check(false, `scene worker failed (${scene.condition}/r${scene.replicate}): ${String(result.stderr ?? "").slice(0, 400)}`);
    }
    const observation = JSON.parse(String(result.stdout)) as SceneObservation;
    observations.push(observation);
    cognitionCalls += observation.cognition.calls;
    languageCalls += observation.language.calls;
    writeFileSync(
      join(input.evidenceDir, "progress.log"),
      `${observations.map((entry) => `${entry.condition} r${entry.replicate} ${entry.result_kind} ${entry.behavior_class} ctx=${String(entry.recognition.counterpart_context_visible_in_prompt)} cited=${String(entry.outcomes.counterpart_context_cited)}`).join("\n")}\n`
    );
    process.stderr.write(
      `[${observations.length}/${schedule.length}] ${observation.condition} r${observation.replicate} ${observation.result_kind} ${observation.behavior_class} ctx=${String(observation.recognition.counterpart_context_visible_in_prompt)} (${Date.now() - started}ms)\n`
    );
  }

  // ---- cells -----------------------------------------------------------------------
  const cells: Record<string, CellSummary> = {};
  const mutable: Record<string, {
    classes: string[]; host_valid: number; total: number; ctxVisible: number; cited: number;
    correct: number; continuation: number; clarify: number; unsupported: number; forbidden: number;
    queries: number[]; familiarity_lines: (string | null)[];
  }> = {};
  for (const observation of observations) {
    const cell = mutable[observation.condition]
      ?? (mutable[observation.condition] = {
        classes: [], host_valid: 0, total: 0, ctxVisible: 0, cited: 0, correct: 0,
        continuation: 0, clarify: 0, unsupported: 0, forbidden: 0, queries: [], familiarity_lines: []
      });
    cell.classes.push(observation.behavior_class);
    cell.total += 1;
    cell.queries.push(observation.retrieval.queries);
    cell.familiarity_lines.push(observation.recognition.familiarity_entry_line);
    if (observation.outcomes.host_valid) cell.host_valid += 1;
    if (observation.recognition.counterpart_context_visible_in_prompt) cell.ctxVisible += 1;
    if (observation.outcomes.counterpart_context_cited) cell.cited += 1;
    if (observation.outcomes.correct_counterpart_context_cited) cell.correct += 1;
    if (observation.outcomes.continuation_success) cell.continuation += 1;
    if (observation.outcomes.clarification_requested) cell.clarify += 1;
    if (observation.outcomes.unsupported_context_claim) cell.unsupported += 1;
    if (observation.outcomes.forbidden_relationship_inference) cell.forbidden += 1;
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
      continuation_success: cell.continuation,
      clarification_requested: cell.clarify,
      unsupported_context_claim: cell.unsupported,
      forbidden_relationship_inference: cell.forbidden,
      queries: cell.queries,
      familiarity_lines: cell.familiarity_lines
    };
  }

  // ---- contrasts ------------------------------------------------------------------
  const byKey = new Map(observations.map((entry) => [`${entry.condition}|${entry.scenario_id}|${entry.replicate}`, entry]));
  const replicates = [...new Set(observations.map((entry) => entry.replicate))];

  function contrast(
    id: string,
    left: ConditionId,
    right: ConditionId,
    question: string,
    expected: ContrastResult["expected"]
  ): ContrastResult {
    const scenarioId = SCENARIOS[0]?.id ?? "S1";
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
      id, left, right, scenario_id: scenarioId, question, expected,
      comparable_pairs: comparable,
      directional,
      left_only_classes: [...leftOnly].sort(),
      right_only_classes: [...rightOnly].sort()
    };
  }

  const contrasts: ContrastResult[] = [
    contrast("C1", "A_LOW_NO_CONTEXT", "B_HIGH_CONTEXT", "does familiarity -> retrieval -> context accompany a behavior difference?", "DIFFERENCE"),
    contrast("C2", "B_HIGH_CONTEXT", "C_HIGH_CONTEXT_ABLATED", "with familiarity held equal, does removing the retrieved context remove the effect?", "DIFFERENCE"),
    contrast("C3", "B_HIGH_CONTEXT", "D_LOW_CONTEXT_EQUALIZED", "with context EXACTLY equalized, does the familiarity scalar still have an effect?", "NO_MEANINGFUL_DIFFERENCE"),
    contrast("C4", "A_LOW_NO_CONTEXT", "D_LOW_CONTEXT_EQUALIZED", "does the treatment context reproduce the treatment behavior at LOW familiarity?", "DIFFERENCE")
  ];
  const at = (id: string) => contrasts.find((entry) => entry.id === id);

  // ---- gates -----------------------------------------------------------------------
  const hostValidScenes = observations.filter((entry) => entry.outcomes.host_valid).length;
  const hostValidRate = observations.length === 0 ? 0 : hostValidScenes / observations.length;
  const seedGateClean = Object.values(input.bundles).every((entry) => entry.seed_contamination.clean);
  const corpusIdentical = new Set(Object.values(input.bundles).map((entry) => entry.corpus_digest)).size === 1;
  const forbidden = observations.flatMap((entry) => entry.forbidden_vocabulary);
  const forbiddenInferences = observations.filter((entry) => entry.outcomes.forbidden_relationship_inference).length;
  const semanticNonConflationPass = forbidden.length === 0 && forbiddenInferences === 0;
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
  for (const observation of observations) {
    if (observation.outcomes.host_valid) continue;
    const detail = observation.failure_detail ?? "UNKNOWN";
    const match = /(CONVERSATION_COGNITION_[A-Z_]+|MODEL_TRANSPORT_[A-Z_]+|SERVICE_UNAVAILABLE|[A-Z_]{8,})/.exec(detail);
    const key = match?.[0] ?? "UNCLASSIFIED_FAILURE";
    failureClasses[key] = (failureClasses[key] ?? 0) + 1;
  }

  // ---- preregistered criteria (protocol §8) ----------------------------------------
  const min = GATES.paired_directional_min;
  const c1 = at("C1");
  const c2 = at("C2");
  const c3 = at("C3");
  const c4 = at("C4");
  const differenceMet = (entry: ContrastResult | undefined) =>
    entry !== undefined && entry.comparable_pairs >= min && entry.directional >= min;
  const noDifferenceMet = (entry: ContrastResult | undefined) =>
    entry !== undefined && entry.comparable_pairs >= min && entry.directional < min;

  const criteria: Record<string, boolean> = {
    "1_A_vs_B_effect": differenceMet(c1),
    "2_B_vs_C_effect": differenceMet(c2),
    "3_B_vs_D_no_effect": noDifferenceMet(c3),
    "4_A_vs_D_effect": differenceMet(c4),
    "5_semantic_non_conflation": semanticNonConflationPass,
    "6_seed_contamination": seedGateClean,
    "7_host_valid_rate": hostValidRate >= GATES.host_valid_rate_min,
    "9_accounting_exact": accountingExact,
    "10_language_authority": languageClean
  };
  const criteriaAllPass = Object.values(criteria).every(Boolean);
  const hardInvalid = !seedGateClean || !corpusIdentical || !accountingExact || !manipulationOk;

  // Independent replication must reproduce the SAME DIRECTION on every contrast.
  let replicationAgrees = true;
  if (input.phase === "replication" && input.primaryVerdict !== undefined) {
    for (const id of ["C1", "C2", "C3", "C4"]) {
      const primary = input.primaryVerdict.contrasts.find((entry) => entry.id === id);
      const mine = at(id);
      if (primary === undefined || mine === undefined) {
        replicationAgrees = false;
        continue;
      }
      const primaryMet = primary.expected === "DIFFERENCE"
        ? primary.directional >= min
        : primary.directional < min;
      const mineMet = mine.expected === "DIFFERENCE" ? mine.directional >= min : mine.directional < min;
      if (primaryMet !== mineMet) replicationAgrees = false;
    }
  }

  let phaseVerdict: string;
  let scientificVerdict: string | null = null;
  let detail: string;
  if (input.phase === "pilot") {
    const pilotGate = hostValidScenes >= 20 && hostValidRate >= GATES.host_valid_rate_min;
    phaseVerdict = pilotGate ? "HOST_VALIDITY_PILOT_V2_PASS" : "HOST_VALIDITY_PILOT_V2_FAIL";
    detail = `host validity pilot: ${hostValidScenes}/${observations.length} valid = ${hostValidRate.toFixed(3)}`
      + ` (requires >= 20 valid AND >= ${GATES.host_valid_rate_min}); no scientific metric is scored`;
  } else if (hardInvalid) {
    phaseVerdict = "EXPERIMENT_INVALID";
    scientificVerdict = "EXPERIMENT_INVALID";
    detail = `hard invalidity: ${!seedGateClean ? "seed contamination; " : ""}${!corpusIdentical ? "corpus mismatch; " : ""}`
      + `${!accountingExact ? `accounting (dup=${duplicateScenes} missing=${missingScenes} extra=${extraScenes}); ` : ""}`
      + `${!manipulationOk ? "manipulation check failed" : ""}`;
  } else if (input.phase === "primary") {
    phaseVerdict = criteriaAllPass ? "PRIMARY_AWAITING_INDEPENDENT_REPLICATION" : "PRIMARY_CRITERIA_NOT_MET";
    detail = criteriaAllPass
      ? "all preregistered criteria met in the primary; the scientific verdict awaits the independent replication"
      : `preregistered criteria not met: ${Object.entries(criteria).filter(([, ok]) => !ok).map(([name]) => name).join(", ")}`;
  } else {
    // Replication phase: emits the FINAL scientific verdict.
    if (!criteriaAllPass || !replicationAgrees) {
      scientificVerdict = "FAMILIARITY_CONTEXT_MEDIATION_NOT_REPLICATED";
      detail = !replicationAgrees
        ? "the independent replication did not reproduce the same direction on every contrast"
        : `preregistered criteria not met in the replication: ${Object.entries(criteria).filter(([, ok]) => !ok).map(([name]) => name).join(", ")}`;
    } else {
      scientificVerdict = "FAMILIARITY_CONTEXT_MEDIATION_REPLICATED";
      detail = "all preregistered criteria met in both executions and the independent replication reproduced the same direction on every contrast";
    }
    phaseVerdict = scientificVerdict;
  }

  const result: ExecutionVerdict = {
    schema_version: "familiarity-final-replication-verdict-v2",
    experiment_id: "RELATIONSHIP_FAMILIARITY_CONTEXT_MEDIATION_FINAL_REPLICATION_V2",
    phase: input.phase,
    phase_verdict: phaseVerdict,
    scientific_verdict: scientificVerdict,
    causal_scope: "EXECUTOR_COMPOSITION",
    host_valid_scenes: hostValidScenes,
    host_valid_rate: hostValidRate,
    host_valid_gate_pass: hostValidRate >= GATES.host_valid_rate_min,
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
    criteria_all_pass: criteriaAllPass,
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
          : 50
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

export function readVerdict(path: string): ExecutionVerdict | undefined {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as ExecutionVerdict;
  } catch {
    return undefined;
  }
}
