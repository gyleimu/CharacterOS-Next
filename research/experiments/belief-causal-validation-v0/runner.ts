/**
 * BELIEF_CAUSAL_VALIDATION_V0 — phase runner, scoring and verdict.
 *
 * Every scene runs in a FRESH process (`scene-worker.ts`) over the frozen
 * durable history with the preregistered balanced schedule (A1 B1 C1 D1 …).
 * Scoring uses ONLY the preregistered gates in contract.ts; invalid scenes are
 * never deleted, they are recorded with their failure stage and reported in the
 * contrast denominators.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import {
  CELL_DEFINITION,
  CELL_IDS,
  GATES,
  MODEL,
  SCENES_PER_CELL,
  PILOT_SCENES_PER_CELL,
  modelConfigManifest,
  scheduledScenes,
  type CellId,
  type Phase
} from "./contract.ts";
import { check, hashJson, type HistoryBundle, type SceneObservation } from "./world.ts";

const here = dirname(fileURLToPath(import.meta.url));

export interface PhaseSummary {
  readonly phase: Phase;
  readonly scenes: number;
  readonly host_valid: number;
  readonly host_valid_rate: number;
  readonly verdict: Record<string, unknown>;
}

interface CollectedScene {
  readonly cell: CellId;
  readonly replicate: number;
  readonly observation: SceneObservation | null;
  readonly worker_failure: string | null;
}

function historyPath(evidenceRoot: string, condition: "LOW" | "HIGH"): string {
  return join(evidenceRoot, "precheck", `history-${condition.toLowerCase()}.json`);
}

function loadHistory(evidenceRoot: string, condition: "LOW" | "HIGH"): HistoryBundle {
  return JSON.parse(readFileSync(historyPath(evidenceRoot, condition), "utf8")) as HistoryBundle;
}

export async function runPhase(
  phase: Phase,
  evidenceRoot: string,
  env: Record<string, string | undefined>,
  log: (line: string) => void
): Promise<PhaseSummary> {
  if (env["MODEL_API_KEY"] === undefined || env["MODEL_API_KEY"]?.trim() === "") {
    throw new Error("BELIEF_CAUSAL: MODEL_API_KEY must be present in the environment (never in a file)");
  }
  if (phase !== "PILOT") {
    const { verifyFreezeManifest } = await import("./freeze.ts");
    verifyFreezeManifest(here, evidenceRoot);
  }
  const low = loadHistory(evidenceRoot, "LOW");
  const high = loadHistory(evidenceRoot, "HIGH");
  const highItem = { proposition_id: high.proposition.proposition_id, credence: high.final_credence };
  const replicateCount = phase === "PILOT" ? PILOT_SCENES_PER_CELL : SCENES_PER_CELL;
  const phaseDir = join(evidenceRoot, phase.toLowerCase());
  mkdirSync(phaseDir, { recursive: true });

  const schedule = scheduledScenes(phase, replicateCount);
  const collected: CollectedScene[] = [];
  const started = Date.now();
  for (const scheduled of schedule) {
    const definition = CELL_DEFINITION[scheduled.cell];
    const history = definition.durable === "LOW" ? low : high;
    const intervention =
      definition.intervention === "NONE"
        ? { kind: "NONE" as const, target_proposition_id: highItem.proposition_id, high_credence: null }
        : definition.intervention === "ABLATE_TARGET"
          ? { kind: "ABLATE_TARGET" as const, target_proposition_id: highItem.proposition_id, high_credence: null }
          : { kind: "EQUALIZE_TARGET_TO_HIGH" as const, target_proposition_id: highItem.proposition_id, high_credence: highItem.credence };
    const payload = {
      phase,
      cell: scheduled.cell,
      replicate: scheduled.replicate,
      history,
      intervention,
      target_label: high.proposition.canonical_label
    };
    const result = spawnSync(process.execPath, [join(here, "cli.ts"), "worker"], {
      input: JSON.stringify(payload),
      encoding: "utf8",
      timeout: 900000,
      maxBuffer: 256 * 1024 * 1024,
      env: { ...process.env, ...env }
    });
    type WorkerReply = { ok: boolean; observation: SceneObservation | null; failure: string | null };
    let parsed: WorkerReply | null;
    try {
      parsed = JSON.parse(result.stdout) as WorkerReply;
    } catch {
      parsed = null;
    }
    const workerFailure =
      parsed === null
        ? `worker produced no parsable output (status=${String(result.status)}): ${(result.stderr ?? "").slice(-600)}`
        : parsed.failure;
    collected.push({
      cell: scheduled.cell,
      replicate: scheduled.replicate,
      observation: parsed?.observation ?? null,
      worker_failure: workerFailure
    });
    const observation = parsed?.observation ?? null;
    log(
      `[${collected.length}/${schedule.length}] ${scheduled.cell} r${scheduled.replicate} ` +
        `${observation?.result_kind ?? "WORKER_FAILED"} directive=${observation?.directive_kind ?? "?"} ` +
        `credence=${String(observation?.belief_view.target_credence ?? "?")} ` +
        `proceed=${String(observation?.classification.proceeds_with_passage ?? "?")} ` +
        `verify=${String(observation?.classification.seeks_verification ?? "?")} ` +
        `(${Date.now() - started}ms)`
    );
    writeJson(join(phaseDir, "progress.json"), {
      schema_version: "belief-causal-progress-v0",
      phase,
      completed: collected.length,
      scheduled: schedule.length,
      scenes: collected
    });
  }

  const hostValid = collected.filter((entry) => entry.observation?.result_kind === "OUTPUT_READY").length;
  const hostValidRate = hostValid / collected.length;
  gateCheck(hostValidRate >= GATES.host_valid_rate_min, `host_valid_rate ${hostValidRate} < ${GATES.host_valid_rate_min}`);
  assertModelFacingEquality(collected);

  const scored = scorePhase(phase, collected);
  writeJson(join(phaseDir, "verdict.json"), scored);
  return {
    phase,
    scenes: collected.length,
    host_valid: hostValid,
    host_valid_rate: hostValidRate,
    verdict: scored
  };
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function gateCheck(ok: boolean, detail: string): void {
  if (!ok) throw new Error(`BELIEF_CAUSAL_HOST_VALIDITY_GATE_FAILED: ${detail}`);
}

/**
 * §42/§43 model-facing equality HARD GATE, verified on the REAL captured
 * requests of every replicate: B and D must be byte-identical; A and C must
 * differ from B exactly in the belief-mediated surface (belief section +
 * projection-hash token) and nowhere else.
 */
function assertModelFacingEquality(collected: readonly CollectedScene[]): void {
  const byKey = new Map(collected.map((entry) => [`${entry.cell}|${entry.replicate}`, entry.observation]));
  for (const entry of collected) {
    const b = byKey.get(`B_HIGH_BELIEF|${entry.replicate}`);
    const a = byKey.get(`A_LOW_BELIEF|${entry.replicate}`);
    const c = byKey.get(`C_HIGH_BELIEF_MEDIATOR_ABLATED|${entry.replicate}`);
    const d = byKey.get(`D_LOW_BELIEF_MEDIATOR_EQUALIZED|${entry.replicate}`);
    if (b === null || b === undefined) continue;
    if (d !== null && d !== undefined) {
      if (d.prompts.user_hash !== b.prompts.user_hash) {
        throw new Error(
          `BELIEF_MEDIATOR_EQUALIZATION_FAILED: B/D model-facing input differs (replicate ${entry.replicate}: ${b.prompts.user_hash} vs ${d.prompts.user_hash})`
        );
      }
    }
    for (const [label, other] of [["A", a], ["C", c]] as const) {
      if (other === null || other === undefined) continue;
      if (other.prompts.non_belief_user_hash !== b.prompts.non_belief_user_hash) {
        throw new Error(
          `BELIEF_CAUSAL: ${label}/B differ OUTSIDE the belief-mediated surface (replicate ${entry.replicate})`
        );
      }
    }
  }
}

/** Pre-registered primary outcome class of one scene. */
export function primaryClass(observation: SceneObservation): string {
  if (observation.result_kind !== "OUTPUT_READY") return "INVALID";
  return observation.directive_kind ?? "NO_DIRECTIVE";
}

function majority(classes: readonly string[]): { readonly majority: string | null; readonly count: number } {
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

export function scorePhase(phase: Phase, collected: readonly CollectedScene[]): Record<string, unknown> {
  const cells: Record<string, unknown> = {};
  for (const cell of CELL_IDS) {
    const scenes = collected.filter((entry) => entry.cell === cell);
    const valid = scenes.filter((entry) => entry.observation?.result_kind === "OUTPUT_READY");
    const classes = valid.map((entry) => primaryClass(entry.observation as SceneObservation));
    const scored = majority(classes);
    cells[cell] = {
      scheduled: scenes.length,
      host_valid: valid.length,
      classes,
      majority: scored.majority,
      majority_count: scored.count,
      stable: valid.length === scenes.length && scored.count >= GATES.cell_stability_min,
      proceeds_with_passage: valid.filter((entry) => entry.observation?.classification.proceeds_with_passage === true).length,
      proposes_alternative_route: valid.filter((entry) => entry.observation?.classification.proposes_alternative_route === true).length,
      seeks_verification: valid.filter((entry) => entry.observation?.classification.seeks_verification === true).length,
      asserts_current_truth: valid.filter((entry) => entry.observation?.classification.asserts_current_truth === true).length,
      objective_truth_conflation: valid.filter((entry) => entry.observation?.classification.objective_truth_conflation === true).length,
      cross_domain_inference: valid.filter((entry) => entry.observation?.classification.cross_domain_inference === true).length,
      target_visible: valid.filter((entry) => entry.observation?.belief_view.target_visible === true).length,
      belief_unchanged: valid.filter((entry) => entry.observation?.canonical.belief_unchanged === true).length,
      raw_history_leaks: valid.flatMap((entry) => entry.observation?.isolation.raw_history_refs_visible ?? []),
      retrieval_queries: valid.map((entry) => entry.observation?.isolation.retrieval_queries ?? -1),
      credences: valid.map((entry) => entry.observation?.belief_view.target_credence ?? null)
    };
  }

  const byKey = new Map(collected.map((entry) => [`${entry.cell}|${entry.replicate}`, entry]));
  const contrasts: Record<string, unknown> = {};
  for (const [left, right] of [
    ["A_LOW_BELIEF", "B_HIGH_BELIEF"],
    ["B_HIGH_BELIEF", "C_HIGH_BELIEF_MEDIATOR_ABLATED"],
    ["B_HIGH_BELIEF", "D_LOW_BELIEF_MEDIATOR_EQUALIZED"],
    ["A_LOW_BELIEF", "D_LOW_BELIEF_MEDIATOR_EQUALIZED"]
  ] as const) {
    let differing = 0;
    let paired = 0;
    const pairs: unknown[] = [];
    for (const entry of collected) {
      if (entry.cell !== left) continue;
      const counterpart = byKey.get(`${right}|${entry.replicate}`);
      if (counterpart === undefined) continue;
      if (entry.observation?.result_kind !== "OUTPUT_READY" || counterpart.observation?.result_kind !== "OUTPUT_READY") continue;
      paired += 1;
      const leftClass = primaryClass(entry.observation);
      const rightClass = primaryClass(counterpart.observation as SceneObservation);
      if (leftClass !== rightClass) differing += 1;
      pairs.push({ replicate: entry.replicate, [left]: leftClass, [right]: rightClass });
    }
    contrasts[`${left}_VS_${right}`] = {
      paired,
      differing,
      pairs,
      effect: differing >= GATES.paired_directional_min,
      null_result: differing <= GATES.null_difference_max
    };
  }

  const invalid = collected.filter((entry) => entry.observation?.result_kind !== "OUTPUT_READY");
  const invalidByCell = Object.fromEntries(CELL_IDS.map((cell) => [cell, invalid.filter((entry) => entry.cell === cell).length]));
  const conflation = Object.values(cells).reduce<number>(
    (total, cell) => total + (cell as { objective_truth_conflation: number }).objective_truth_conflation,
    0
  );
  const leaks = Object.values(cells).flatMap((cell) => (cell as { raw_history_leaks: readonly string[] }).raw_history_leaks);
  const notUnchanged = Object.values(cells).reduce<number>(
    (total, cell) => total + ((cell as { host_valid: number }).host_valid - (cell as { belief_unchanged: number }).belief_unchanged),
    0
  );

  return {
    schema_version: "belief-causal-verdict-v0",
    experiment_id: "BELIEF_CAUSAL_VALIDATION_V0",
    phase,
    model: MODEL.id,
    model_config: modelConfigManifest(),
    scheduled: collected.length,
    host_valid: collected.filter((entry) => entry.observation?.result_kind === "OUTPUT_READY").length,
    invalid_scenes: invalid.map((entry) => ({
      cell: entry.cell,
      replicate: entry.replicate,
      phase,
      failure_stage: entry.observation?.failure_stage ?? "WORKER",
      failure_reason: entry.observation?.failure_detail ?? entry.worker_failure
    })),
    invalid_by_cell: invalidByCell,
    cells,
    contrasts,
    objective_truth_conflation_count: conflation,
    raw_history_leakage: leaks,
    intervention_belief_stability_failures: notUnchanged,
    gates: GATES,
    verdict_hash: hashJson({ phase, cells, contrasts })
  };
}

export async function writeReport(evidenceRoot: string): Promise<Record<string, unknown>> {
  const phases: Phase[] = ["PILOT", "PRIMARY", "REPLICATION"];
  const verdicts: Record<string, unknown> = {};
  for (const phase of phases) {
    const path = join(evidenceRoot, phase.toLowerCase(), "verdict.json");
    try {
      verdicts[phase] = JSON.parse(readFileSync(path, "utf8")) as unknown;
    } catch {
      verdicts[phase] = null;
    }
  }
  const primary = verdicts["PRIMARY"] as { contrasts?: Record<string, { effect: boolean; null_result: boolean; paired: number; differing: number }>; cells?: Record<string, { stable: boolean }> } | null;
  const replication = verdicts["REPLICATION"] as typeof primary;
  const pilot = verdicts["PILOT"] as { host_valid?: number; scheduled?: number } | null;
  check(primary !== null, "primary verdict present");
  const contrasts = primary.contrasts ?? {};
  const c1 = contrasts["A_LOW_BELIEF_VS_B_HIGH_BELIEF"];
  const c2 = contrasts["B_HIGH_BELIEF_VS_C_HIGH_BELIEF_MEDIATOR_ABLATED"];
  const c3 = contrasts["B_HIGH_BELIEF_VS_D_LOW_BELIEF_MEDIATOR_EQUALIZED"];
  const c4 = contrasts["A_LOW_BELIEF_VS_D_LOW_BELIEF_MEDIATOR_EQUALIZED"];
  check(c1 !== undefined && c2 !== undefined && c3 !== undefined && c4 !== undefined, "four core contrasts present");
  const cellsStable = Object.values(primary.cells ?? {}).every((cell) => cell.stable);
  const invalidityBias = ok(invalidBias(primary));
  const c2r = replication?.contrasts?.["B_HIGH_BELIEF_VS_C_HIGH_BELIEF_MEDIATOR_ABLATED"];
  const c1r = replication?.contrasts?.["A_LOW_BELIEF_VS_B_HIGH_BELIEF"];
  const c3r = replication?.contrasts?.["B_HIGH_BELIEF_VS_D_LOW_BELIEF_MEDIATOR_EQUALIZED"];
  const c4r = replication?.contrasts?.["A_LOW_BELIEF_VS_D_LOW_BELIEF_MEDIATOR_EQUALIZED"];
  const replicationSameDirection =
    replication !== null &&
    c1r !== undefined && c2r !== undefined && c3r !== undefined && c4r !== undefined &&
    c1r.effect === c1.effect && c2r.effect === c2.effect && c3r.null_result === c3.null_result && c4r.effect === c4.effect;

  let verdict = "BELIEF_CAUSAL_RESULT_INCONCLUSIVE";
  if (!invalidityBias || !cellsStable) {
    verdict = "BELIEF_CAUSAL_RESULT_INCONCLUSIVE";
  } else if (c1.effect && c2.effect && c3.null_result && c4.effect) {
    verdict = replicationSameDirection ? "BELIEF_CAUSAL_INFLUENCE_REPLICATED" : "BELIEF_CAUSAL_RESULT_INCONCLUSIVE";
  } else if (!c1.effect && !c2.effect && !c4.effect) {
    verdict = "BELIEF_CAUSAL_INFLUENCE_NOT_REPLICATED";
  }

  const report = {
    schema_version: "belief-causal-report-v0",
    experiment_id: "BELIEF_CAUSAL_VALIDATION_V0",
    model: MODEL.id,
    pilot_host_validity: pilot === null || pilot.scheduled === undefined ? null : (pilot.host_valid ?? 0) / pilot.scheduled,
    primary: {
      A_VS_B: c1,
      B_VS_C: c2,
      B_VS_D: c3,
      A_VS_D: c4,
      cells_stable: cellsStable,
      invalid_by_cell: (primary as { invalid_by_cell?: unknown }).invalid_by_cell
    },
    replication: {
      A_VS_B: c1r ?? null,
      B_VS_C: c2r ?? null,
      B_VS_D: c3r ?? null,
      A_VS_D: c4r ?? null,
      same_direction: replicationSameDirection
    },
    verdict,
    verdicts,
    report_hash: hashJson({ verdict, primary, replication })
  };
  writeJson(join(evidenceRoot, "report.json"), report);
  return report;
}

function invalidBias(primary: { cells?: Record<string, { stable?: boolean; host_valid?: number; scheduled?: number }> | undefined }): string {
  const cells = Object.values(primary.cells ?? {});
  const valid = cells.every(
    (cell) => (cell.host_valid ?? 0) / (cell.scheduled ?? 1) >= GATES.host_valid_rate_min
  );
  return valid ? "OK" : "CELL_DEPENDENT";
}
function ok(value: string): boolean {
  return value === "OK";
}
