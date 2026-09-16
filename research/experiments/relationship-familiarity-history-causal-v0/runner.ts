/**
 * RELATIONSHIP_FAMILIARITY_HISTORY_CAUSAL_EXPERIMENT_V0 — bounded execution + verdict.
 *
 * Every scheduled scene runs in a FRESH process (authoritative restore before the
 * matched current scene). Exactly one cognition call and at most one language call
 * per scene; no retries, no repair, no tuning.
 *
 * CONTRAST DECOMPOSITION (all at matched corpus; state_revision is a co-effect of
 * history length and is therefore reported per cell):
 *
 *   A_LOW  rev 3   text LOW  mediator absent   ← baseline
 *   B_HIGH rev 18  text HIGH mediator present  ← treatment
 *   C      rev 18  text HIGH mediator absent   ← isolates the DIRECT text channel
 *   D      rev 18  text LOW  mediator absent   ← effective familiarity == A at rev 18
 *   E      rev 3   text LOW  mediator present  ← mediator availability WITHOUT familiarity
 *
 *   A↔B  overall treatment contrast
 *   B↔C  mediator channel (matched familiarity text + revision)
 *   C↔D  direct familiarity-text channel (matched revision + availability)
 *   A↔D  revision-only effect at equalized effective familiarity
 *   A↔E  mediator availability without familiarity (confound probe)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  GATES,
  MODEL,
  REPLICATES,
  RESEARCH_INTERVENTIONS,
  SCENARIOS,
  controlCallMaximum,
  controlScenes,
  replicationCallMaximum,
  replicationScenes,
  scheduledCallMaximum,
  scheduledScenes,
  type ConditionId
} from "./contract.ts";
import type { SceneObservation } from "./scene.ts";
import { check, hashJson, type HistoryBundle } from "./world.ts";

export interface CellSummary {
  readonly classes: readonly string[];
  readonly majority: string | null;
  readonly majority_count: number;
  readonly host_valid: number;
  readonly total: number;
  readonly mediator_visible: number;
  readonly queries: readonly number[];
  readonly familiarity_lines: readonly (string | null)[];
  readonly revision_lines: readonly (string | null)[];
}

export interface ContrastResult {
  readonly left: string;
  readonly right: string;
  readonly scenario_id: string;
  readonly comparable_pairs: number;
  readonly directional: number;
  readonly left_only_classes: readonly string[];
  readonly right_only_classes: readonly string[];
  readonly detail: string;
}

export interface ExecutionVerdict {
  readonly schema_version: "familiarity-history-causal-verdict-v0";
  readonly experiment_id: "RELATIONSHIP_FAMILIARITY_HISTORY_CAUSAL_EXPERIMENT_V0";
  readonly phase: "primary" | "replication" | "control";
  readonly verdict: string;
  readonly principal_verdict: string;
  readonly causal_scope: "EXECUTOR_COMPOSITION";
  readonly host_complete: boolean;
  readonly seed_clean: boolean;
  readonly corpus_identical: boolean;
  readonly manipulation_ok: boolean;
  readonly language_authority_clean: boolean;
  readonly forbidden_vocabulary: readonly string[];
  readonly cells: Record<string, CellSummary>;
  readonly contrasts: readonly ContrastResult[];
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
  readonly mediation: {
    readonly treatment_effect: boolean;
    readonly mediator_channel_effect: boolean;
    readonly direct_text_channel_effect: boolean;
    readonly revision_only_effect: boolean;
    readonly availability_only_effect: boolean;
    readonly mediation_supported: boolean;
    readonly detail: string;
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
  C_MEDIATOR_ABLATED: false,
  D_FAMILIARITY_EQUALIZED: false,
  E_LOW_WITH_MEDIATOR: true,
  F_LOW_FULL_CORPUS: true
};

export async function runScenes(input: {
  readonly phase: "primary" | "replication" | "control";
  readonly bundles: Record<string, HistoryBundle>;
  readonly evidenceDir: string;
}): Promise<ExecutionVerdict> {
  mkdirSync(input.evidenceDir, { recursive: true });
  const worker = fileURLToPath(new URL("./scene-worker.ts", import.meta.url));
  const schedule = input.phase === "primary"
    ? scheduledScenes()
    : input.phase === "replication"
      ? replicationScenes()
      : controlScenes();
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
      phase: input.phase
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
      `${observations.map((entry) => `${entry.condition} ${entry.scenario_id} r${entry.replicate} ${entry.result_kind} ${entry.behavior_class} med=${String(entry.recognition.mediator_visible_in_prompt)} q=${entry.retrieval.queries} (${Date.now() - started}ms)`).join("\n")}\n`
    );
    process.stderr.write(
      `[${observations.length}/${schedule.length}] ${observation.condition} ${observation.scenario_id} r${observation.replicate} ${observation.result_kind} ${observation.behavior_class} mediator=${String(observation.recognition.mediator_visible_in_prompt)}\n`
    );
  }

  // ---- cells -----------------------------------------------------------------------
  const cells: Record<string, CellSummary> = {};
  const mutable: Record<string, {
    classes: string[]; host_valid: number; total: number; mediator_visible: number;
    queries: number[]; familiarity_lines: (string | null)[]; revision_lines: (string | null)[];
  }> = {};
  for (const observation of observations) {
    const cell = mutable[observation.condition]
      ?? (mutable[observation.condition] = { classes: [], host_valid: 0, total: 0, mediator_visible: 0, queries: [], familiarity_lines: [], revision_lines: [] });
    cell.classes.push(observation.behavior_class);
    cell.total += 1;
    cell.queries.push(observation.retrieval.queries);
    cell.familiarity_lines.push(observation.recognition.familiarity_entry_line);
    cell.revision_lines.push(revisionOf(observation));
    if (observation.result_kind === "OUTPUT_READY") cell.host_valid += 1;
    if (observation.recognition.mediator_visible_in_prompt) cell.mediator_visible += 1;
  }
  for (const [key, cell] of Object.entries(mutable)) {
    const scored = majorityOf(cell.classes);
    cells[key] = {
      classes: cell.classes,
      majority: scored.majority,
      majority_count: scored.count,
      host_valid: cell.host_valid,
      total: cell.total,
      mediator_visible: cell.mediator_visible,
      queries: cell.queries,
      familiarity_lines: cell.familiarity_lines,
      revision_lines: cell.revision_lines
    };
  }

  // ---- paired contrasts ------------------------------------------------------------
  const byKey = new Map(observations.map((entry) => [`${entry.condition}|${entry.scenario_id}|${entry.replicate}`, entry]));

  function contrast(left: ConditionId, right: ConditionId, scenarioId: string, detail: string): ContrastResult {
    let comparable = 0;
    let directional = 0;
    const leftOnly = new Set<string>();
    const rightOnly = new Set<string>();
    for (let replicate = 1; replicate <= REPLICATES; replicate += 1) {
      const a = byKey.get(`${left}|${scenarioId}|${replicate}`);
      const b = byKey.get(`${right}|${scenarioId}|${replicate}`);
      if (a === undefined || b === undefined) continue;
      if (a.result_kind !== "OUTPUT_READY" || b.result_kind !== "OUTPUT_READY") continue;
      comparable += 1;
      if (a.behavior_class !== b.behavior_class) {
        directional += 1;
        leftOnly.add(a.behavior_class);
        rightOnly.add(b.behavior_class);
      }
    }
    return {
      left, right, scenario_id: scenarioId, comparable_pairs: comparable, directional,
      left_only_classes: [...leftOnly].sort(),
      right_only_classes: [...rightOnly].sort(),
      detail
    };
  }

  const primaryScenario = SCENARIOS.find((entry) => entry.primary)?.id ?? (SCENARIOS[0] as { id: string }).id;
  const contrasts: ContrastResult[] = [];
  if (input.phase === "control") {
    // Focused adversarial-control contrasts, matched within ONE execution.
    for (const scenario of SCENARIOS) {
      contrasts.push(contrast("A_LOW", "B_HIGH", scenario.id, "treatment contrast (reference)"));
      contrasts.push(contrast("A_LOW", "F_LOW_FULL_CORPUS", scenario.id, "full-corpus availability WITHOUT familiarity"));
      contrasts.push(contrast("B_HIGH", "F_LOW_FULL_CORPUS", scenario.id, "treatment vs full-corpus availability WITHOUT familiarity"));
    }
  } else {
    for (const scenario of SCENARIOS) {
      contrasts.push(contrast("A_LOW", "B_HIGH", scenario.id, "overall treatment contrast"));
      contrasts.push(contrast("B_HIGH", "C_MEDIATOR_ABLATED", scenario.id, "mediator channel at matched familiarity text + revision"));
      contrasts.push(contrast("C_MEDIATOR_ABLATED", "D_FAMILIARITY_EQUALIZED", scenario.id, "direct familiarity-text channel at matched revision + availability"));
      contrasts.push(contrast("A_LOW", "D_FAMILIARITY_EQUALIZED", scenario.id, "revision-only effect at equalized effective familiarity"));
      contrasts.push(contrast("A_LOW", "E_LOW_WITH_MEDIATOR", scenario.id, "mediator availability WITHOUT familiarity (confound probe)"));
    }
  }

  function contrastAt(left: ConditionId, right: ConditionId, scenarioId: string): ContrastResult | undefined {
    return contrasts.find((entry) => entry.left === left && entry.right === right && entry.scenario_id === scenarioId);
  }

  // ---- gates ------------------------------------------------------------------------
  const hostComplete = observations.every((entry) => entry.result_kind === "OUTPUT_READY");
  const seedGateClean = Object.values(input.bundles).every((entry) => entry.seed_contamination.clean);
  const seedClean = seedGateClean
    && observations.every((entry) =>
      entry.condition !== "D_FAMILIARITY_EQUALIZED"
      || (entry.intervention.familiarity_representation_replaced && entry.intervention.only_familiarity_lines_changed)
    );
  const corpusIdentical = new Set(Object.values(input.bundles).map((entry) => entry.corpus_digest)).size === 1;

  const manipulationOk = observations.every((entry) => {
    if (entry.recognition.mediator_visible_in_prompt !== AVAILABILITY_EXPECTED[entry.condition]) return false;
    if (entry.recognition.condition_label_leak) return false;
    if (entry.condition === "A_LOW" || entry.condition === "E_LOW_WITH_MEDIATOR") {
      return entry.recognition.familiarity_entry_line?.includes("level=1/32") === true
        && entry.recognition.influence_entry_line?.includes("BASIC_CONTEXT_FIRST") === true
        && entry.retrieval.queries === 0;
    }
    if (entry.condition === "B_HIGH") {
      return entry.recognition.familiarity_entry_line?.includes("level=16/32") === true
        && entry.recognition.influence_entry_line?.includes("COUNTERPART_CONTEXT_SEARCH_FIRST") === true
        && entry.retrieval.queries === 1;
    }
    if (entry.condition === "C_MEDIATOR_ABLATED") {
      return entry.recognition.familiarity_entry_line?.includes("level=16/32") === true
        && entry.recognition.influence_entry_line?.includes("COUNTERPART_CONTEXT_SEARCH_FIRST") === true
        && entry.retrieval.queries === 1;
    }
    // D: HIGH history, LOW effective representation.
    return entry.recognition.familiarity_entry_line?.includes("level=1/32") === true
      && entry.recognition.influence_entry_line?.includes("BASIC_CONTEXT_FIRST") === true;
  });

  const forbidden = observations.flatMap((entry) => entry.forbidden_vocabulary);
  const languageClean = observations.every((entry) =>
    entry.result_kind === "OUTPUT_READY"
      ? entry.language.schema_version === "language-realization-input-v10" || entry.directive_kind === "CLARIFY_MISSING_CONTEXT"
      : true
  );

  const planned = schedule.map((entry) => `${entry.condition}|${entry.scenario.id}|${entry.replicate}`);
  const actual = observations.map((entry) => `${entry.condition}|${entry.scenario_id}|${entry.replicate}`);
  const uniqueActual = new Set(actual);
  const duplicateScenes = actual.length - uniqueActual.size;
  const missingScenes = planned.filter((key) => !uniqueActual.has(key)).length;
  const extraScenes = [...uniqueActual].filter((key) => !planned.includes(key)).length;

  // ---- decomposition + verdict ------------------------------------------------------
  const isControl = input.phase === "control";
  const controlTreatment = contrastAt("A_LOW", "B_HIGH", primaryScenario);
  const controlAvailability = contrastAt("A_LOW", "F_LOW_FULL_CORPUS", primaryScenario);
  const controlTreatmentVsAvailability = contrastAt("B_HIGH", "F_LOW_FULL_CORPUS", primaryScenario);
  const treatmentAB = isControl ? undefined : contrastAt("A_LOW", "B_HIGH", primaryScenario);
  const mediatorBC = contrastAt("B_HIGH", "C_MEDIATOR_ABLATED", primaryScenario);
  const directCD = contrastAt("C_MEDIATOR_ABLATED", "D_FAMILIARITY_EQUALIZED", primaryScenario);
  const revisionAD = contrastAt("A_LOW", "D_FAMILIARITY_EQUALIZED", primaryScenario);
  const availabilityAE = contrastAt("A_LOW", "E_LOW_WITH_MEDIATOR", primaryScenario);

  const atGate = (entry: ContrastResult | undefined) =>
    entry !== undefined
    && entry.comparable_pairs >= GATES.paired_directional_min
    && entry.directional >= GATES.paired_directional_min;

  const treatmentEffect = atGate(treatmentAB);
  const mediatorChannel = atGate(mediatorBC);
  const directTextChannel = atGate(directCD);
  const revisionOnly = atGate(revisionAD);
  const availabilityOnly = atGate(availabilityAE);

  // Adversarial control: does the FULL counterpart corpus, readable WITHOUT familiarity,
  // reproduce the treatment behaviour? If it does, the effect is availability-driven and
  // the familiarity-causal reading is refuted.
  const controlTreatmentHolds = atGate(controlTreatment);
  const controlAvailabilityReproduces = atGate(controlAvailability)
    && controlAvailability !== undefined
    && controlTreatmentVsAvailability !== undefined
    && controlTreatmentVsAvailability.directional < GATES.paired_directional_min;
  const controlAvailabilityInsufficient = controlTreatmentHolds && !controlAvailabilityReproduces;

  const mediationSupported = !isControl && treatmentEffect && !revisionOnly && (mediatorChannel || directTextChannel);

  let principal: string;
  let verdict: string;
  let detail: string;
  if (!seedGateClean) {
    principal = "EXPERIMENT_INVALID_SEED_CONTAMINATION";
    verdict = principal;
    detail = "the initialization seed gate failed: familiarity state was present in a seed";
  } else if (!corpusIdentical) {
    principal = "EXPERIMENT_INVALID";
    verdict = principal;
    detail = "the candidate corpora are not identical across conditions";
  } else if (!hostComplete) {
    principal = "FAMILIARITY_EFFECT_INCONCLUSIVE";
    verdict = principal;
    detail = "at least one scheduled scene was not host-valid (transport/schema failure); no behavioral claim is authorized";
  } else if (duplicateScenes > 0 || missingScenes > 0 || extraScenes > 0) {
    principal = "EXPERIMENT_INVALID";
    verdict = principal;
    detail = `schedule accounting failed: duplicates=${duplicateScenes} missing=${missingScenes} extra=${extraScenes}`;
  } else if (!manipulationOk) {
    principal = "EXPERIMENT_INVALID";
    verdict = principal;
    detail = "the preregistered manipulation check failed: a cell was not constructed as specified";
  } else if (!languageClean) {
    principal = "FAMILIARITY_EFFECT_INCONCLUSIVE";
    verdict = principal;
    detail = "a delivered behavior was realized outside the authorized V10/atom path";
  } else if (forbidden.length > 0) {
    principal = "FAMILIARITY_EFFECT_INCONCLUSIVE";
    verdict = "SEMANTIC_NON_CONFLATION_FAILED";
    detail = `delivered behavior contained unauthorized trust/affinity vocabulary: ${[...new Set(forbidden)].join(", ")}`;
  } else if (isControl) {
    // ADVERSARIAL CONTROL verdict (post-hoc-added control; can only weaken the finding).
    if (!controlTreatmentHolds) {
      principal = "FAMILIARITY_EFFECT_INCONCLUSIVE";
      verdict = "CONTROL_TREATMENT_NOT_REPRODUCED";
      detail = "the treatment contrast itself did not reproduce in this control execution, so the control question is not answerable here";
    } else if (controlAvailabilityReproduces) {
      principal = "FAMILIARITY_NO_DETECTABLE_CAUSAL_INFLUENCE";
      verdict = "FAMILIARITY_AVAILABILITY_CONFOUNDED";
      detail = "reading the FULL counterpart corpus WITHOUT familiarity reproduces the treatment behaviour: the effect is availability-driven, not familiarity-causal";
    } else if (controlAvailabilityInsufficient) {
      principal = "FAMILIARITY_CAUSAL_INFLUENCE_OBSERVED_NOT_REPLICATED";
      verdict = "AVAILABILITY_ALONE_INSUFFICIENT";
      detail = "reading the FULL counterpart corpus WITHOUT familiarity does NOT reproduce the treatment behaviour: mere readability is insufficient, so the effect requires the familiarity state rather than the raw context";
    } else {
      principal = "FAMILIARITY_EFFECT_INCONCLUSIVE";
      verdict = "CONTROL_INCONCLUSIVE";
      detail = "the adversarial control produced mixed contrasts; no availability claim is authorized";
    }
  } else if (!treatmentEffect) {
    principal = "FAMILIARITY_NO_DETECTABLE_CAUSAL_INFLUENCE";
    verdict = principal;
    detail = "every cell was constructed as preregistered and host-complete, and the preregistered endpoint did not differ between the baseline and the treatment";
  } else if (availabilityOnly && !revisionOnly && !mediatorChannel && !directTextChannel) {
    principal = "FAMILIARITY_NO_DETECTABLE_CAUSAL_INFLUENCE";
    verdict = "FAMILIARITY_AVAILABILITY_CONFOUNDED";
    detail = "the endpoint difference is reproduced by making the mediator available WITHOUT familiarity, so it is not attributable to familiarity";
  } else if (mediationSupported) {
    principal = input.phase === "primary"
      ? "FAMILIARITY_CAUSAL_INFLUENCE_OBSERVED_NOT_REPLICATED"
      : "FAMILIARITY_CAUSAL_INFLUENCE_REPLICATED";
    verdict = principal;
    detail = "the treatment effect is present, is NOT reproduced by the revision-only contrast, and the effective familiarity representation accounts for it";
  } else {
    principal = "FAMILIARITY_EFFECT_INCONCLUSIVE";
    verdict = principal;
    detail = "an endpoint difference was observed but no preregistered contrast identifies it as familiarity-mediated";
  }

  const result: ExecutionVerdict = {
    schema_version: "familiarity-history-causal-verdict-v0",
    experiment_id: "RELATIONSHIP_FAMILIARITY_HISTORY_CAUSAL_EXPERIMENT_V0",
    phase: input.phase,
    verdict,
    principal_verdict: principal,
    causal_scope: "EXECUTOR_COMPOSITION",
    host_complete: hostComplete,
    seed_clean: seedClean,
    corpus_identical: corpusIdentical,
    manipulation_ok: manipulationOk,
    language_authority_clean: languageClean,
    forbidden_vocabulary: [...new Set(forbidden)],
    cells,
    contrasts,
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
          : controlCallMaximum()
    },
    mediation: {
      treatment_effect: treatmentEffect,
      mediator_channel_effect: mediatorChannel,
      direct_text_channel_effect: directTextChannel,
      revision_only_effect: revisionOnly,
      availability_only_effect: availabilityOnly,
      mediation_supported: mediationSupported,
      detail: isControl
        ? [
            `A↔B treatment ${controlTreatment?.directional ?? 0}/${controlTreatment?.comparable_pairs ?? 0}`,
            `A↔F availability-only ${controlAvailability?.directional ?? 0}/${controlAvailability?.comparable_pairs ?? 0}`,
            `B↔F ${controlTreatmentVsAvailability?.directional ?? 0}/${controlTreatmentVsAvailability?.comparable_pairs ?? 0}`
          ].join("; ")
        : [
            `A↔B directional ${treatmentAB?.directional ?? 0}/${treatmentAB?.comparable_pairs ?? 0}`,
            `B↔C ${mediatorBC?.directional ?? 0}/${mediatorBC?.comparable_pairs ?? 0}`,
            `C↔D ${directCD?.directional ?? 0}/${directCD?.comparable_pairs ?? 0}`,
            `A↔D ${revisionAD?.directional ?? 0}/${revisionAD?.comparable_pairs ?? 0}`,
            `A↔E ${availabilityAE?.directional ?? 0}/${availabilityAE?.comparable_pairs ?? 0}`
          ].join("; ")
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
