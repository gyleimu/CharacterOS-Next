/**
 * RELATIONSHIP_FAMILIARITY_SEARCH_FIRST_CAUSAL_EXPERIMENT_V0 — bounded qualification.
 *
 * Every scheduled scene runs in a FRESH process (authoritative restore before the
 * matched current scene). Exactly one cognition call and at most one language call
 * per scene; no retries, no repair, no tuning. Scoring uses ONLY the preregistered
 * gates in contract.ts, plus the mandatory manipulation check (§22) and the
 * same-corpus proof (§23).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  ABLATED_CONDITION_ID,
  DISTRACTOR_REF,
  GATES,
  MODEL,
  SCENARIOS,
  scheduledCallMaximum,
  scheduledScenes,
  type ConditionId
} from "./contract.ts";
import type { FrozenFixture } from "./preflight.ts";
import type { SceneObservation } from "./scene.ts";
import { check, hashJson } from "./world.ts";

export interface QualificationVerdict {
  readonly schema_version: "familiarity-search-first-verdict-v0";
  readonly verdict: string;
  readonly causal_scope: "EXECUTOR_COMPOSITION";
  readonly host_complete: boolean;
  readonly manipulation_ok: boolean;
  readonly same_corpus_ok: boolean;
  readonly cells: Record<string, { readonly classes: readonly string[]; readonly majority: string | null; readonly majority_count: number; readonly host_valid: number; readonly mediator_visible: number; readonly queries: readonly number[] }>;
  readonly paired_directional: number;
  readonly paired_total: number;
  readonly ablation_returns_toward_low: number;
  readonly forbidden_vocabulary: readonly string[];
  readonly language_authority_clean: boolean;
  readonly retrieval_context_differs: boolean;
  readonly behavioral_difference: boolean;
  readonly calls: { readonly cognition: number; readonly language: number; readonly total: number };
  readonly scheduled_calls_maximum: number;
  readonly observations: number;
  readonly model: unknown;
  readonly detail: string;
}

function majority(classes: readonly string[]): { majority: string | null; count: number } {
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

export async function runQualification(fixture: FrozenFixture, evidenceDir: string): Promise<QualificationVerdict> {
  mkdirSync(evidenceDir, { recursive: true });
  const worker = fileURLToPath(new URL("./scene-worker.ts", import.meta.url));
  const observations: SceneObservation[] = [];
  let cognitionCalls = 0;
  let languageCalls = 0;

  for (const scene of scheduledScenes()) {
    const ablation = scene.condition === ABLATED_CONDITION_ID;
    const condition: ConditionId = ablation ? "HIGH" : scene.condition as ConditionId;
    const history = fixture.histories[condition];
    check(history !== undefined, `frozen history for ${condition}`);
    const payload = {
      bundle: history,
      condition,
      scenario_index: SCENARIOS.findIndex((entry) => entry.id === scene.scenario.id),
      replicate: scene.replicate,
      ablation,
      evidence_dir: evidenceDir,
      role: "scene"
    };
    const started = Date.now();
    const result = spawnSync(process.execPath, [worker], { input: JSON.stringify(payload), encoding: "utf8", timeout: 600000, maxBuffer: 64 * 1024 * 1024 });
    if (result.status !== 0 || result.stdout.trim().length === 0) {
      writeFileSync(join(evidenceDir, `worker-failure-${scene.condition}-${scene.scenario.id}-r${scene.replicate}.txt`), `${result.stdout}\n${result.stderr}\n`);
      check(false, `scene worker failed (${scene.condition}/${scene.scenario.id}/r${scene.replicate}): ${(result.stderr || "").slice(0, 400)}`);
    }
    const observation = JSON.parse(result.stdout) as SceneObservation;
    observations.push(observation);
    cognitionCalls += observation.cognition.calls;
    languageCalls += observation.language.calls;
    writeFileSync(join(evidenceDir, "progress.log"), observations.map((entry) => `${entry.condition} ${entry.scenario_id} r${entry.replicate} ${entry.result_kind} ${entry.behavior_class} med=${String(entry.retrieval.mediator_visible)} q=${entry.retrieval.queries} (${Date.now() - started}ms)`).join("\n") + "\n");
    process.stderr.write(`[${observations.length}/${scheduledScenes().length}] ${observation.condition} ${observation.scenario_id} r${observation.replicate} ${observation.result_kind} ${observation.behavior_class} mediator=${String(observation.retrieval.mediator_visible)}\n`);
  }

  const mutableCells: Record<string, { classes: string[]; majority: string | null; majority_count: number; host_valid: number; mediator_visible: number; queries: number[] }> = {};
  for (const observation of observations) {
    const key = observation.condition;
    const cell = mutableCells[key] ?? (mutableCells[key] = { classes: [], majority: null, majority_count: 0, host_valid: 0, mediator_visible: 0, queries: [] });
    cell.classes.push(observation.behavior_class);
    cell.queries.push(observation.retrieval.queries);
    if (observation.result_kind === "OUTPUT_READY") cell.host_valid += 1;
    if (observation.retrieval.mediator_visible) cell.mediator_visible += 1;
  }
  for (const cell of Object.values(mutableCells)) {
    const scored = majority(cell.classes);
    cell.majority = scored.majority;
    cell.majority_count = scored.count;
  }
  const cells: QualificationVerdict["cells"] = mutableCells;

  const byKey = new Map(observations.map((entry) => [`${entry.condition}|${entry.scenario_id}|${entry.replicate}`, entry]));
  const primary = SCENARIOS.find((entry) => entry.primary)?.id ?? (SCENARIOS[0] as { id: string }).id;
  let pairedDirectional = 0;
  let pairedTotal = 0;
  let ablationTowardLow = 0;
  let retrievalDiffers = 0;
  for (const observation of observations) {
    if (observation.scenario_id !== primary || observation.condition !== "LOW") continue;
    const high = byKey.get(`HIGH|${primary}|${observation.replicate}`);
    const ablated = byKey.get(`${ABLATED_CONDITION_ID}|${primary}|${observation.replicate}`);
    if (high === undefined || ablated === undefined) continue;
    if (high.result_kind !== "OUTPUT_READY" || ablated.result_kind !== "OUTPUT_READY" || observation.result_kind !== "OUTPUT_READY") continue;
    pairedTotal += 1;
    if (observation.behavior_class !== high.behavior_class) {
      pairedDirectional += 1;
      if (ablated.behavior_class === observation.behavior_class) ablationTowardLow += 1;
    }
    if (high.retrieval.mediator_visible !== observation.retrieval.mediator_visible) retrievalDiffers += 1;
  }

  const hostComplete = observations.every((entry) => entry.result_kind === "OUTPUT_READY");
  // §22 manipulation check: LOW 0 queries and no mediator; HIGH/ABLATED 1 query and
  // HIGH mediator visible, ABLATED mediator absent, familiarity still HIGH.
  const manipulationOk = observations.every((entry) => {
    if (entry.condition === "LOW") return entry.retrieval.queries === 0 && !entry.retrieval.mediator_visible && entry.cognition.familiarity_entry_line === "- entity:alice: presence=PRESENT level=1/32";
    if (entry.condition === "HIGH") return entry.retrieval.queries === 1 && entry.retrieval.mediator_visible && entry.cognition.familiarity_entry_line === "- entity:alice: presence=PRESENT level=16/32";
    return entry.retrieval.queries === 1 && !entry.retrieval.mediator_visible && entry.cognition.familiarity_entry_line === "- entity:alice: presence=PRESENT level=16/32";
  });
  const sameCorpusOk = fixture.histories.LOW.corpus_digest === fixture.histories.HIGH.corpus_digest
    && fixture.histories.LOW.corpus_refs.includes(DISTRACTOR_REF);
  const forbidden = observations.flatMap((entry) => entry.forbidden_vocabulary);
  const languageClean = observations.every((entry) =>
    entry.result_kind === "OUTPUT_READY"
      ? entry.language.schema_version === "language-realization-input-v10" || entry.directive_kind === "CLARIFY_MISSING_CONTEXT"
      : true
  );
  const lowCell = cells["LOW"];
  const highCell = cells["HIGH"];
  const ablatedCell = cells[ABLATED_CONDITION_ID];
  const stable = (cell: typeof lowCell) => cell !== undefined && cell.host_valid === cell.classes.length && cell.majority_count >= GATES.cell_stability_min;
  const behavioralDifference = pairedDirectional >= GATES.paired_directional_min;
  const retrievalMediated = hostComplete && manipulationOk && sameCorpusOk && forbidden.length === 0 && languageClean
    && stable(lowCell) && stable(highCell) && behavioralDifference
    && ablationTowardLow >= GATES.ablation_returns_toward_low_min
    && retrievalDiffers >= GATES.paired_directional_min;

  let verdict = "RELATIONSHIP_FAMILIARITY_REVALIDATION_INCONCLUSIVE";
  let detail = "host-incomplete run; no behavioral claim is authorized";
  if (!sameCorpusOk) {
    verdict = "RELATIONSHIP_FAMILIARITY_MEMORY_CONFOUNDED";
    detail = "the candidate corpora are not identical across conditions";
  } else if (!hostComplete) {
    verdict = "RELATIONSHIP_FAMILIARITY_REVALIDATION_INCONCLUSIVE";
    detail = "at least one scheduled scene was not host-valid (transport/schema failure); no behavioral claim is authorized";
  } else if (!manipulationOk) {
    verdict = "RELATIONSHIP_FAMILIARITY_SEARCH_FIRST_MECHANISM_FAILED";
    detail = "the preregistered manipulation check failed: the frozen priority-retrieval behaviour did not occur as specified (not a behavioral-negative result)";
  } else if (!languageClean) {
    verdict = "RELATIONSHIP_FAMILIARITY_LANGUAGE_AUTHORITY_FAILED";
    detail = "a delivered behavior was realized outside the authorized V10/atom path";
  } else if (forbidden.length > 0) {
    verdict = "RELATIONSHIP_FAMILIARITY_IMPLEMENTATION_FAILED";
    detail = `delivered behavior contained forbidden trust/affinity vocabulary: ${[...new Set(forbidden)].join(", ")}`;
  } else if (stable(lowCell) && stable(highCell) && behavioralDifference && ablationTowardLow < GATES.ablation_returns_toward_low_min) {
    verdict = "RELATIONSHIP_FAMILIARITY_MEMORY_CONFOUNDED";
    detail = "LOW vs HIGH differ while the retrieval-mediator ablation does not return toward LOW: the difference is not mediated by the ablated contribution";
  } else if (retrievalMediated) {
    verdict = "RELATIONSHIP_FAMILIARITY_RETRIEVAL_MEDIATED_CAUSALITY_ESTABLISHED";
    detail = "all preregistered gates passed: stable cells, LOW vs HIGH differ, and the retrieval-mediator ablation returns toward LOW";
  } else if (!behavioralDifference) {
    verdict = "RELATIONSHIP_FAMILIARITY_BEHAVIORAL_CAUSALITY_NOT_ESTABLISHED";
    detail = "the search-first retrieval was exercised correctly (context differs, retrieval service clean) but the preregistered endpoint does not differ";
  }

  const result: QualificationVerdict = {
    schema_version: "familiarity-search-first-verdict-v0",
    verdict,
    causal_scope: "EXECUTOR_COMPOSITION",
    host_complete: hostComplete,
    manipulation_ok: manipulationOk,
    same_corpus_ok: sameCorpusOk,
    cells,
    paired_directional: pairedDirectional,
    paired_total: pairedTotal,
    ablation_returns_toward_low: ablationTowardLow,
    forbidden_vocabulary: [...new Set(forbidden)],
    language_authority_clean: languageClean,
    retrieval_context_differs: retrievalDiffers > 0,
    behavioral_difference: behavioralDifference,
    calls: { cognition: cognitionCalls, language: languageCalls, total: cognitionCalls + languageCalls },
    scheduled_calls_maximum: scheduledCallMaximum(),
    observations: observations.length,
    model: MODEL,
    detail
  };
  writeFileSync(join(evidenceDir, "verdict.json"), `${JSON.stringify({ ...result, verdict_hash: hashJson(result) }, null, 2)}\n`);
  void ablatedCell;
  return result;
}
