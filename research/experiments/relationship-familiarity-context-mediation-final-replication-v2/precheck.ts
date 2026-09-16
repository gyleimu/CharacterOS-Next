/**
 * RELATIONSHIP_FAMILIARITY_CONTEXT_MEDIATION_FINAL_REPLICATION_V2 — DETERMINISTIC PRECHECK.
 *
 * ZERO real model calls. Protocol §4: the model table below must hold EXACTLY before any
 * model call, otherwise the experiment is `EXPERIMENT_INVALID` and no model is invoked.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  ALICE,
  CONDITIONS,
  CONDITION_IDS,
  COUNTERPART_EPISODES,
  GENERIC_REF,
  MODEL,
  SCENARIOS,
  SUBJECT,
  TASK_CONTEXT_REF,
  type ConditionId
} from "./contract.ts";
import { runScene, type SceneObservation } from "./scene.ts";
import { buildHistoryWithCredits, familiarityOf, restoreHistory, type HistoryBundle } from "./world.ts";

const EVIDENCE_ROOT = fileURLToPath(new URL("./evidence/", import.meta.url));

/** C shares B's canonical history BY CONSTRUCTION (same history label => same commits). */
export const HISTORY_LABEL: Record<ConditionId, string> = {
  A_LOW_NO_CONTEXT: "A_LOW_NO_CONTEXT",
  B_HIGH_CONTEXT: "B_HIGH_CONTEXT",
  C_HIGH_CONTEXT_ABLATED: "B_HIGH_CONTEXT",
  D_LOW_CONTEXT_EQUALIZED: "D_LOW_CONTEXT_EQUALIZED"
};

const DEAD_TRANSPORT = {
  complete: async () => {
    throw new Error("DETERMINISTIC_PRECHECK: no model call is permitted in this phase");
  }
};

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

const COUNTERPART_SET = new Set(COUNTERPART_EPISODES.map((entry) => entry.ref));

/** Ordered model-facing source IDs, read from the rendered prompt. */
function factualSourceRefs(userContent: string): readonly string[] {
  const section = /FACTUAL SOURCE REFS[^\n]*\n([\s\S]*?)(?:\n[A-Z][A-Z ]+\(|\nFACTUAL SOURCE HANDLES|\n\[)/.exec(userContent)?.[1] ?? "";
  return section.split("\n")
    .map((line) => line.replace(/^\s*-\s*/, "").trim())
    .filter((line) => line.length > 0);
}

/** Ordered rendered episode records (the readable source TEXT), from the prompt. */
function sourceRecords(userContent: string): readonly string[] {
  return userContent.split("\n").filter((line) => line.startsWith("- Past episode record (scene:"));
}

export interface CellProbe {
  readonly condition: ConditionId;
  readonly history_label: string;
  readonly familiarity_value: number | null;
  readonly governed_authority_records: number;
  readonly credits_expected: number;
  readonly seed_clean: boolean;
  readonly seed_contains_governed_relationship_state: boolean;
  readonly seeded_bundles_with_writer_authority: number;
  readonly unreadable_seed_shapes: number;
  readonly corpus_digest: string;
  readonly working_refs: readonly string[];
  readonly restored_familiarity_equal: boolean;
  readonly familiarity_entry_line: string | null;
  readonly influence_entry_line: string | null;
  readonly retrieval_queries: number;
  readonly factual_source_refs: readonly string[];
  readonly counterpart_source_refs: readonly string[];
  readonly source_records: readonly string[];
  readonly generated_nothing: boolean;
  readonly bundles_json_length: number;
}

export interface PrecheckReport {
  readonly schema_version: "familiarity-final-replication-precheck-v2";
  readonly experiment_id: "RELATIONSHIP_FAMILIARITY_CONTEXT_MEDIATION_FINAL_REPLICATION_V2";
  readonly real_model_calls: 0;
  readonly subject: string;
  readonly counterpart: string;
  readonly task_context_ref: string;
  readonly model: unknown;
  readonly b_retrieval_selected_refs: readonly string[];
  readonly d_working_refs: readonly string[];
  readonly cells: readonly CellProbe[];
  readonly checks: Readonly<Record<string, boolean>>;
  readonly checks_all_pass: boolean;
  readonly failures: readonly string[];
  readonly source_equality: {
    readonly b_ids: readonly string[];
    readonly d_ids: readonly string[];
    readonly b_records: readonly string[];
    readonly d_records: readonly string[];
  };
  readonly detail: string;
}

export async function prepareCells(): Promise<{
  readonly bundles: Record<string, HistoryBundle>;
  readonly bSelection: readonly string[];
  readonly dWorkingRefs: readonly string[];
}> {
  const bundles: Record<string, HistoryBundle> = {};
  for (const condition of CONDITION_IDS) {
    if (condition === "D_LOW_CONTEXT_EQUALIZED") continue;
    const label = HISTORY_LABEL[condition];
    const { bundle } = await buildHistoryWithCredits(CONDITIONS[condition].credits, label, [GENERIC_REF]);
    bundles[condition] = bundle;
  }

  // Probe B to learn EXACTLY which refs its priority retrieval selects.
  const bRuntime = await restoreHistory(bundles.B_HIGH_CONTEXT as HistoryBundle);
  const bProbe = await runScene(bRuntime, {
    condition: "B_HIGH_CONTEXT",
    scenario: SCENARIOS[0] as (typeof SCENARIOS)[number],
    replicate: 1,
    suppress_mediator_contribution: false,
    cognitionTransport: DEAD_TRANSPORT,
    languageTransport: DEAD_TRANSPORT,
    identity_phase: "probe"
  });
  const bSelection = [...new Set(bProbe.retrieval.attempts.flatMap((attempt) => attempt.selected_refs))].sort();

  // D: LOW familiarity, but B_HIGH's exact retrieved counterpart set made readable.
  const dWorkingRefs = [...new Set([GENERIC_REF, ...bSelection])].sort();
  const dBuilt = await buildHistoryWithCredits(
    CONDITIONS.D_LOW_CONTEXT_EQUALIZED.credits,
    HISTORY_LABEL.D_LOW_CONTEXT_EQUALIZED,
    dWorkingRefs
  );
  bundles.D_LOW_CONTEXT_EQUALIZED = dBuilt.bundle;

  return { bundles, bSelection, dWorkingRefs };
}

function probeCell(
  condition: ConditionId,
  bundle: HistoryBundle,
  scene: SceneObservation,
  restoredFamiliarityEqual: boolean
): CellProbe {
  const refs = factualSourceRefs(scene.cognition.user_content);
  return {
    condition,
    history_label: HISTORY_LABEL[condition],
    familiarity_value: bundle.familiarity_value,
    governed_authority_records: bundle.governed_authority_records.length,
    credits_expected: CONDITIONS[condition].credits,
    seed_clean: bundle.seed_contamination.clean,
    seed_contains_governed_relationship_state: bundle.seed_contamination.seed_contains_governed_relationship_state,
    seeded_bundles_with_writer_authority: bundle.seed_contamination.seeded_bundles_with_writer_authority,
    unreadable_seed_shapes: bundle.seed_contamination.unreadable_seed_shapes,
    corpus_digest: bundle.corpus_digest,
    working_refs: bundle.working_refs,
    restored_familiarity_equal: restoredFamiliarityEqual,
    familiarity_entry_line: scene.recognition.familiarity_entry_line,
    influence_entry_line: scene.recognition.influence_entry_line,
    retrieval_queries: scene.retrieval.queries,
    factual_source_refs: refs,
    counterpart_source_refs: refs.filter((ref) => COUNTERPART_SET.has(ref)),
    source_records: sourceRecords(scene.cognition.user_content),
    generated_nothing: scene.result_kind === "FAILED" && scene.behavior_class === "UNCLASSIFIED",
    bundles_json_length: JSON.stringify(bundle.bundles).length
  };
}

export async function runPrecheck(): Promise<{
  readonly report: PrecheckReport;
  readonly bundles: Record<string, HistoryBundle>;
}> {
  mkdirSync(EVIDENCE_ROOT, { recursive: true });
  const { bundles, bSelection, dWorkingRefs } = await prepareCells();

  const cells: CellProbe[] = [];
  for (const condition of CONDITION_IDS) {
    const bundle = bundles[condition] as HistoryBundle;
    const runtime = await restoreHistory(bundle);
    const restoredSnapshot = await runtime.assembly.facade.readCurrentSnapshot(SUBJECT as never);
    const restoredFamiliarity = familiarityOf(restoredSnapshot as never);
    const scene = await runScene(runtime, {
      condition,
      scenario: SCENARIOS[0] as (typeof SCENARIOS)[number],
      replicate: 1,
      suppress_mediator_contribution: condition === "C_HIGH_CONTEXT_ABLATED",
      cognitionTransport: DEAD_TRANSPORT,
      languageTransport: DEAD_TRANSPORT,
      identity_phase: "probe"
    });
    cells.push(probeCell(condition, bundle, scene, restoredFamiliarity === bundle.familiarity_value));
  }

  const cell = (id: ConditionId) => cells.find((entry) => entry.condition === id) as CellProbe;
  const a = cell("A_LOW_NO_CONTEXT");
  const b = cell("B_HIGH_CONTEXT");
  const c = cell("C_HIGH_CONTEXT_ABLATED");
  const d = cell("D_LOW_CONTEXT_EQUALIZED");

  const sameOrdered = (left: readonly string[], right: readonly string[]) =>
    left.length === right.length && left.every((entry, index) => entry === right[index]);

  const checks: Record<string, boolean> = {
    a_familiarity_lt_b: (a.familiarity_value ?? 1) < (b.familiarity_value ?? 0),
    b_familiarity_eq_c: b.familiarity_value === c.familiarity_value,
    a_familiarity_eq_d: a.familiarity_value === d.familiarity_value,
    a_counterpart_context_count_zero: a.counterpart_source_refs.length === 0,
    c_counterpart_context_count_zero: c.counterpart_source_refs.length === 0,
    b_counterpart_context_set_eq_d: sameOrdered(b.counterpart_source_refs, d.counterpart_source_refs),
    b_source_ids_eq_d: sameOrdered(b.factual_source_refs, d.factual_source_refs),
    b_source_ordering_eq_d: sameOrdered(b.factual_source_refs, d.factual_source_refs),
    b_source_text_eq_d: sameOrdered(b.source_records, d.source_records),
    b_source_count_gt_zero: b.counterpart_source_refs.length > 0,
    task_context_exposed_in_b: b.counterpart_source_refs.includes(TASK_CONTEXT_REF),
    task_context_exposed_in_d: d.counterpart_source_refs.includes(TASK_CONTEXT_REF),
    all_seed_gates_clean: cells.every((entry) => entry.seed_clean
      && entry.seed_contains_governed_relationship_state === false
      && entry.seeded_bundles_with_writer_authority === 0
      && entry.unreadable_seed_shapes === 0),
    familiarity_from_real_governed_history: cells.every((entry) => entry.governed_authority_records === entry.credits_expected),
    corpus_identical: new Set(cells.map((entry) => entry.corpus_digest)).size === 1,
    b_history_eq_c_history: b.bundles_json_length === c.bundles_json_length,
    b_history_ne_d_history: b.bundles_json_length !== d.bundles_json_length,
    restored_familiarity_exact: cells.every((entry) => entry.restored_familiarity_equal),
    manipulation_shape_ok:
      a.retrieval_queries === 0 && b.retrieval_queries === 1 && c.retrieval_queries === 1 && d.retrieval_queries === 0
      && a.influence_entry_line?.includes("BASIC_CONTEXT_FIRST") === true
      && b.influence_entry_line?.includes("COUNTERPART_CONTEXT_SEARCH_FIRST") === true
      && d.influence_entry_line?.includes("BASIC_CONTEXT_FIRST") === true,
    no_generation_in_probe: cells.every((entry) => entry.generated_nothing)
  };

  const failures = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);

  const report: PrecheckReport = {
    schema_version: "familiarity-final-replication-precheck-v2",
    experiment_id: "RELATIONSHIP_FAMILIARITY_CONTEXT_MEDIATION_FINAL_REPLICATION_V2",
    real_model_calls: 0,
    subject: SUBJECT,
    counterpart: ALICE,
    task_context_ref: TASK_CONTEXT_REF,
    model: MODEL,
    b_retrieval_selected_refs: bSelection,
    d_working_refs: dWorkingRefs,
    cells,
    checks,
    checks_all_pass: failures.length === 0,
    failures,
    source_equality: {
      b_ids: b.factual_source_refs,
      d_ids: d.factual_source_refs,
      b_records: b.source_records,
      d_records: d.source_records
    },
    detail: failures.length === 0
      ? `deterministic precheck complete: all ${Object.keys(checks).length} protocol §4 conditions hold; B and D expose IDENTICAL model-facing sources (same ids, order, text, count)`
      : `deterministic precheck FAILED: ${failures.join(", ")} — EXPERIMENT_INVALID, no model run authorized`
  };
  writeJson(join(EVIDENCE_ROOT, "precheck.json"), report);
  return { report, bundles };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { report } = await runPrecheck();
  process.stdout.write(`${JSON.stringify({
    checks_all_pass: report.checks_all_pass,
    failures: report.failures,
    b_retrieval_selected_refs: report.b_retrieval_selected_refs,
    d_working_refs: report.d_working_refs,
    source_equality: report.source_equality,
    cells: report.cells.map((entry) => ({
      condition: entry.condition,
      fam: entry.familiarity_value,
      governed: entry.governed_authority_records,
      queries: entry.retrieval_queries,
      sources: entry.factual_source_refs,
      counterpart: entry.counterpart_source_refs,
      famLine: entry.familiarity_entry_line
    }))
  }, null, 2)}\n`);
}
