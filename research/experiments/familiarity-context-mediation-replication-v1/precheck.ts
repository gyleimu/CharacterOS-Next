/**
 * FAMILIARITY_CONTEXT_MEDIATION_REPLICATION_V1 — DETERMINISTIC PRECHECK (§9).
 *
 * ZERO real model calls. Runs BEFORE any scientific execution and REFUSES to authorize
 * one unless every preregistered structural condition holds:
 *
 *   A familiarity  <  B familiarity
 *   B familiarity  == C familiarity           (same canonical history, byte-identical)
 *   A familiarity  == D familiarity
 *   B canonical history != D canonical history
 *   B model-facing counterpart context == D model-facing counterpart context
 *   A model-facing counterpart context != B model-facing counterpart context
 *   B vs C:  same familiarity representation, DIFFERENT counterpart availability
 *   B vs D:  different familiarity,           SAME counterpart availability
 *   seed contamination gate clean in every cell
 *   candidate corpus byte-identical in every cell
 *
 * It also DERIVES `D_LOW_CONTEXT_EQUALIZED`'s canonical working refs from the exact refs
 * `B_HIGH`'s own priority retrieval selects — the equalization is measured, not asserted.
 *
 * The scene probe uses a THROWING transport: the production executor still builds the real
 * prompt and runs the real retrieval orchestration, then the model call fails closed at the
 * transport boundary. Nothing is generated and nothing is delivered, yet the whole
 * host-side mediation state is observed.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  ALICE,
  CONDITIONS,
  CONDITION_IDS,
  GENERIC_REF,
  MODEL,
  SCENARIOS,
  SUBJECT,
  type ConditionId
} from "./contract.ts";
import { runScene, type SceneObservation } from "./scene.ts";
import { buildHistoryWithCredits, familiarityOf, restoreHistory, type HistoryBundle } from "./world.ts";

const EVIDENCE_ROOT = fileURLToPath(new URL("./evidence/", import.meta.url));

/** C shares B's canonical history BY CONSTRUCTION (same history label ⇒ same commits). */
export const HISTORY_LABEL: Record<ConditionId, string> = {
  A_LOW: "A_LOW",
  B_HIGH: "B_HIGH",
  C_HIGH_RETRIEVAL_ABLATED: "B_HIGH",
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

export interface CellProbe {
  readonly condition: ConditionId;
  readonly history_label: string;
  readonly familiarity_value: number | null;
  readonly state_revision: number;
  readonly working_refs: readonly string[];
  readonly seed_clean: boolean;
  readonly seed_contains_governed_relationship_state: boolean;
  readonly seeded_bundles_with_writer_authority: number;
  readonly unreadable_seed_shapes: number;
  readonly governed_authority_records: number;
  readonly corpus_digest: string;
  readonly restored_familiarity_equal: boolean;
  readonly familiarity_entry_line: string | null;
  readonly influence_entry_line: string | null;
  readonly retrieval_queries: number;
  readonly counterpart_context_visible: boolean;
  readonly counterpart_refs_in_allowed_refs: readonly string[];
  readonly generated_nothing: boolean;
  readonly bundles_digest: string;
}

export interface PrecheckReport {
  readonly schema_version: "familiarity-context-mediation-precheck-v1";
  readonly experiment_id: "FAMILIARITY_CONTEXT_MEDIATION_REPLICATION_V1";
  readonly real_model_calls: 0;
  readonly subject: string;
  readonly counterpart: string;
  readonly model: unknown;
  readonly b_retrieval_selected_refs: readonly string[];
  readonly d_working_refs: readonly string[];
  readonly cells: readonly CellProbe[];
  readonly checks: {
    readonly a_fam_lt_b_fam: boolean;
    readonly b_fam_eq_c_fam: boolean;
    readonly a_fam_eq_d_fam: boolean;
    readonly b_history_ne_d_history: boolean;
    readonly b_history_eq_c_history: boolean;
    readonly b_context_eq_d_context: boolean;
    readonly a_context_ne_b_context: boolean;
    readonly b_c_same_familiarity_diff_context: boolean;
    readonly b_d_diff_familiarity_same_context: boolean;
    readonly all_seed_clean: boolean;
    readonly corpus_identical: boolean;
    readonly no_generation_in_probe: boolean;
  };
  readonly checks_all_pass: boolean;
  readonly failures: readonly string[];
  readonly detail: string;
}

/** Build every cell; D's working refs are derived from B's own retrieval selection. */
export async function prepareCells(): Promise<{
  readonly bundles: Record<string, HistoryBundle>;
  readonly bSelection: readonly string[];
  readonly dWorkingRefs: readonly string[];
}> {
  const bundles: Record<string, HistoryBundle> = {};

  // A, B, C (C reuses B's history label so its canonical history is byte-identical).
  for (const condition of CONDITION_IDS) {
    if (condition === "D_LOW_CONTEXT_EQUALIZED") continue;
    const label = HISTORY_LABEL[condition];
    const { bundle } = await buildHistoryWithCredits(CONDITIONS[condition].credits, label, [GENERIC_REF]);
    bundles[condition] = bundle;
  }

  // Probe B to learn EXACTLY which counterpart refs its priority retrieval selects.
  const bRuntime = await restoreHistory(bundles.B_HIGH as HistoryBundle);
  const bProbe = await runScene(bRuntime, {
    condition: "B_HIGH",
    scenario: SCENARIOS[0] as (typeof SCENARIOS)[number],
    replicate: 1,
    suppress_mediator_contribution: false,
    cognitionTransport: DEAD_TRANSPORT,
    languageTransport: DEAD_TRANSPORT,
    identity_phase: "probe"
  });
  const bSelection = [...new Set(
    bProbe.retrieval.attempts.flatMap((attempt) => attempt.selected_refs)
  )].sort();

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
  restoredFamiliarityEqual: boolean,
  familiarityValue: number | null,
  stateRevision: number
): CellProbe {
  return {
    condition,
    history_label: HISTORY_LABEL[condition],
    familiarity_value: familiarityValue,
    state_revision: stateRevision,
    working_refs: bundle.working_refs,
    seed_clean: bundle.seed_contamination.clean,
    seed_contains_governed_relationship_state: bundle.seed_contamination.seed_contains_governed_relationship_state,
    seeded_bundles_with_writer_authority: bundle.seed_contamination.seeded_bundles_with_writer_authority,
    unreadable_seed_shapes: bundle.seed_contamination.unreadable_seed_shapes,
    governed_authority_records: bundle.governed_authority_records.length,
    corpus_digest: bundle.corpus_digest,
    restored_familiarity_equal: restoredFamiliarityEqual,
    familiarity_entry_line: scene.recognition.familiarity_entry_line,
    influence_entry_line: scene.recognition.influence_entry_line,
    retrieval_queries: scene.retrieval.queries,
    counterpart_context_visible: scene.recognition.counterpart_context_visible_in_prompt,
    counterpart_refs_in_allowed_refs: scene.recognition.counterpart_refs_in_allowed_refs,
    generated_nothing: scene.result_kind === "FAILED" && scene.behavior_class === "UNCLASSIFIED",
    bundles_digest: JSON.stringify(bundle.bundles).length === 0 ? "empty" : String(bundle.bundles.length)
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
      suppress_mediator_contribution: condition === "C_HIGH_RETRIEVAL_ABLATED",
      cognitionTransport: DEAD_TRANSPORT,
      languageTransport: DEAD_TRANSPORT,
      identity_phase: "probe"
    });
    const liveSnapshot = await runtime.assembly.facade.readCurrentSnapshot(SUBJECT as never);
    cells.push(
      probeCell(
        condition,
        bundle,
        scene,
        restoredFamiliarity === bundle.familiarity_value,
        bundle.familiarity_value,
        (liveSnapshot as unknown as { runtime_metadata: { state_revision: number } }).runtime_metadata.state_revision - 1
      )
    );
  }

  const cell = (id: ConditionId) => cells.find((entry) => entry.condition === id) as CellProbe;
  const a = cell("A_LOW");
  const b = cell("B_HIGH");
  const c = cell("C_HIGH_RETRIEVAL_ABLATED");
  const d = cell("D_LOW_CONTEXT_EQUALIZED");

  const sameRefSet = (left: readonly string[], right: readonly string[]) =>
    left.length === right.length && [...left].sort().join("|") === [...right].sort().join("|");

  const checks = {
    a_fam_lt_b_fam: (a.familiarity_value ?? 1) < (b.familiarity_value ?? 0),
    b_fam_eq_c_fam: b.familiarity_value === c.familiarity_value,
    a_fam_eq_d_fam: a.familiarity_value === d.familiarity_value,
    b_history_ne_d_history: JSON.stringify(bundles.B_HIGH.bundles) !== JSON.stringify(bundles.D_LOW_CONTEXT_EQUALIZED.bundles),
    b_history_eq_c_history: JSON.stringify(bundles.B_HIGH.bundles) === JSON.stringify(bundles.C_HIGH_RETRIEVAL_ABLATED.bundles),
    b_context_eq_d_context: sameRefSet(b.counterpart_refs_in_allowed_refs, d.counterpart_refs_in_allowed_refs),
    a_context_ne_b_context: !sameRefSet(a.counterpart_refs_in_allowed_refs, b.counterpart_refs_in_allowed_refs),
    b_c_same_familiarity_diff_context:
      b.familiarity_entry_line === c.familiarity_entry_line
      && b.influence_entry_line === c.influence_entry_line
      && c.counterpart_refs_in_allowed_refs.length === 0
      && b.counterpart_refs_in_allowed_refs.length > 0,
    b_d_diff_familiarity_same_context:
      b.familiarity_entry_line !== d.familiarity_entry_line
      && sameRefSet(b.counterpart_refs_in_allowed_refs, d.counterpart_refs_in_allowed_refs),
    all_seed_clean: cells.every((entry) => entry.seed_clean),
    corpus_identical: new Set(cells.map((entry) => entry.corpus_digest)).size === 1,
    no_generation_in_probe: cells.every((entry) => entry.generated_nothing)
  };

  const failures = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => name);

  const report: PrecheckReport = {
    schema_version: "familiarity-context-mediation-precheck-v1",
    experiment_id: "FAMILIARITY_CONTEXT_MEDIATION_REPLICATION_V1",
    real_model_calls: 0,
    subject: SUBJECT,
    counterpart: ALICE,
    model: MODEL,
    b_retrieval_selected_refs: bSelection,
    d_working_refs: dWorkingRefs,
    cells,
    checks,
    checks_all_pass: failures.length === 0,
    failures,
    detail: failures.length === 0
      ? "deterministic precheck complete: every preregistered structural condition holds; D's context equalization is measured against B's own retrieval selection"
      : `deterministic precheck FAILED: ${failures.join(", ")} — no model run is authorized`
  };
  writeJson(join(EVIDENCE_ROOT, "precheck.json"), report);
  return { report, bundles };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { report } = await runPrecheck();
  process.stdout.write(`${JSON.stringify({ checks: report.checks, failures: report.failures, bSelection: report.b_retrieval_selected_refs, dWorkingRefs: report.d_working_refs, cells: report.cells.map((entry) => ({ condition: entry.condition, fam: entry.familiarity_value, rev: entry.state_revision, queries: entry.retrieval_queries, counterpartVisible: entry.counterpart_context_visible, counterpartRefs: entry.counterpart_refs_in_allowed_refs, famLine: entry.familiarity_entry_line })) }, null, 2)}\n`);
}
