/**
 * RELATIONSHIP_FAMILIARITY_CAUSAL_COMPLETION_V0 — bounded qualification runner.
 *
 * Every scheduled scene runs in a FRESH process that authoritatively restores the
 * persisted history before the matched current scenario. Exactly one cognition
 * call and at most one language call per scene; no retries, no repair, no prompt
 * tuning. Scoring uses ONLY the preregistered gates in contract.ts.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  ABLATED_CONDITION_ID,
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
  readonly schema_version: "familiarity-completion-verdict-v0";
  readonly verdict: string;
  readonly host_complete: boolean;
  readonly cells: Record<string, { readonly classes: readonly string[]; readonly majority: string | null; readonly majority_count: number; readonly host_valid: number }>;
  readonly paired_directional: number;
  readonly ablation_directional: number;
  readonly forbidden_vocabulary: readonly string[];
  readonly language_authority_clean: boolean;
  readonly material_causal_difference: boolean;
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
    const payload = {
      bundle: fixture.histories[condition],
      absent: ablation ? fixture.absent_rendering : null,
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
    writeFileSync(join(evidenceDir, "progress.log"), observations.map((entry) => `${entry.condition} ${entry.scenario_id} r${entry.replicate} ${entry.result_kind} ${entry.behavior_class} (${Date.now() - started}ms)`).join("\n") + "\n");
    process.stderr.write(`[${observations.length}/${scheduledScenes().length}] ${observation.condition} ${observation.scenario_id} r${observation.replicate} ${observation.result_kind} ${observation.behavior_class}\n`);
  }

  const cells: Record<string, { classes: string[]; majority: string | null; majority_count: number; host_valid: number }> = {};
  for (const observation of observations) {
    const key = `${observation.condition}`;
    const cell = cells[key] ?? (cells[key] = { classes: [], majority: null, majority_count: 0, host_valid: 0 });
    cell.classes.push(observation.behavior_class);
    if (observation.result_kind === "OUTPUT_READY") cell.host_valid += 1;
  }
  for (const cell of Object.values(cells)) {
    const scored = majority(cell.classes);
    cell.majority = scored.majority;
    cell.majority_count = scored.count;
  }

  const byKey = new Map(observations.map((entry) => [`${entry.condition}|${entry.scenario_id}|${entry.replicate}`, entry]));
  let pairedDirectional = 0;
  let ablationDirectional = 0;
  let pairedTotal = 0;
  let ablationTotal = 0;
  const primary = SCENARIOS.find((entry) => entry.primary)?.id ?? (SCENARIOS[0] as { id: string }).id;
  for (const observation of observations) {
    if (observation.scenario_id !== primary) continue;
    const low = byKey.get(`LOW|${primary}|${observation.replicate}`);
    const high = byKey.get(`HIGH|${primary}|${observation.replicate}`);
    const ablated = byKey.get(`${ABLATED_CONDITION_ID}|${primary}|${observation.replicate}`);
    if (low === undefined || high === undefined || ablated === undefined) continue;
    if (low.result_kind !== "OUTPUT_READY" || high.result_kind !== "OUTPUT_READY" || ablated.result_kind !== "OUTPUT_READY") continue;
    pairedTotal += 1;
    ablationTotal += 1;
    if (low.behavior_class !== high.behavior_class) pairedDirectional += 1;
    if (high.behavior_class !== ablated.behavior_class) ablationDirectional += 1;
  }

  const hostComplete = observations.every((entry) => entry.result_kind === "OUTPUT_READY");
  const forbidden = observations.flatMap((entry) => entry.forbidden_vocabulary);
  const languageClean = observations.every((entry) =>
    entry.result_kind === "OUTPUT_READY"
      ? entry.language.schema_version === "language-realization-input-v10" || entry.directive_kind === "CLARIFY_MISSING_CONTEXT"
      : true
  );
  const lowCell = cells["LOW"];
  const highCell = cells["HIGH"];
  const stable = (cell: typeof lowCell) => cell !== undefined && cell.host_valid === cell.classes.length && cell.majority_count >= GATES.cell_stability_min;
  const materialCausal = hostComplete && forbidden.length === 0 && languageClean
    && stable(lowCell) && stable(highCell)
    && pairedDirectional >= GATES.paired_directional_min
    && ablationDirectional >= GATES.ablation_directional_min;

  let verdict = "RELATIONSHIP_FAMILIARITY_REVALIDATION_INCONCLUSIVE";
  let detail = "host-incomplete run; no behavioral claim is authorized";
  if (!hostComplete) {
    verdict = "RELATIONSHIP_FAMILIARITY_REVALIDATION_INCONCLUSIVE";
    detail = "at least one scheduled scene was not host-valid (transport/schema failure); no behavioral claim is authorized";
  } else if (!languageClean) {
    verdict = "RELATIONSHIP_FAMILIARITY_LANGUAGE_AUTHORITY_FAILED";
    detail = "a delivered behavior was realized outside the authorized V10/atom path";
  } else if (forbidden.length > 0) {
    verdict = "RELATIONSHIP_FAMILIARITY_IMPLEMENTATION_FAILED";
    detail = `delivered behavior contained forbidden trust/affinity vocabulary: ${[...new Set(forbidden)].join(", ")}`;
  } else if (stable(lowCell) && stable(highCell) && pairedDirectional >= GATES.paired_directional_min && ablationDirectional < GATES.ablation_directional_min) {
    verdict = "RELATIONSHIP_FAMILIARITY_MEMORY_CONFOUNDED";
    detail = "LOW vs HIGH differs while the familiarity-material ablation does not: the difference tracks something other than the familiarity material";
  } else if (materialCausal) {
    verdict = "RELATIONSHIP_FAMILIARITY_VALIDATED";
    detail = "all preregistered gates passed: stable cells, paired directional difference, and the familiarity-material ablation carries the same difference";
  } else if (pairedDirectional < GATES.paired_directional_min) {
    verdict = "RELATIONSHIP_FAMILIARITY_BEHAVIORAL_CAUSALITY_NOT_ESTABLISHED";
    detail = "both cells are host-valid and internally stable but the preregistered endpoint does not differ directionally";
  }

  const result: QualificationVerdict = {
    schema_version: "familiarity-completion-verdict-v0",
    verdict,
    host_complete: hostComplete,
    cells,
    paired_directional: pairedDirectional,
    ablation_directional: ablationDirectional,
    forbidden_vocabulary: [...new Set(forbidden)],
    language_authority_clean: languageClean,
    material_causal_difference: materialCausal,
    calls: { cognition: cognitionCalls, language: languageCalls, total: cognitionCalls + languageCalls },
    scheduled_calls_maximum: scheduledCallMaximum(),
    observations: observations.length,
    model: MODEL,
    detail
  };
  check(pairedTotal === ablationTotal, "paired and ablation denominators agree");
  writeFileSync(join(evidenceDir, "verdict.json"), `${JSON.stringify({ ...result, paired_total: pairedTotal, ablation_total: ablationTotal, verdict_hash: hashJson(result) }, null, 2)}\n`);
  return result;
}
