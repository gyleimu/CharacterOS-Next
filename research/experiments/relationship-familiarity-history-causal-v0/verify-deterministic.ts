/**
 * RELATIONSHIP_FAMILIARITY_HISTORY_CAUSAL_EXPERIMENT_V0 — DETERMINISTIC phase.
 *
 * ZERO real model calls. Establishes, before any model spend:
 *
 *   PHASE 2/3  history formation: two (five) worlds built ONLY through real
 *              interaction experience → real ingestion → real governed writer;
 *              familiarity differences verified against the governed authority
 *              records actually present in the committed canonical history.
 *   PHASE 3    seed trust boundary: the required observer fields over the
 *              INITIALIZATION seeds (must be false / 0 / 0).
 *   PHASE 1/6  the production prompt/manipulation map for every cell: which
 *              familiarity representation the model receives, whether the frozen
 *              priority retrieval fires, and whether the counterpart mediator is
 *              actually reachable. This is the mediation PRE-CHECK: if the mediator
 *              is not reachable in the treatment cell, no model run can show the
 *              effect and the experiment must not spend calls.
 *
 * The scene probe uses a THROWING transport: the production executor still builds
 * the real prompt and runs the real retrieval orchestration, then the model call
 * fails closed at the transport boundary — so nothing is generated and nothing is
 * delivered, yet the full host-side mediation state is observed.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  ALICE,
  ALL_CELL_IDS,
  CONDITIONS,
  MEDIATOR_REF,
  MODEL,
  SCENARIOS,
  SUBJECT,
  type ConditionId
} from "./contract.ts";
import { runScene, type SceneObservation } from "./scene.ts";
import { buildHistory, familiarityOf, restoreHistory, type HistoryBundle } from "./world.ts";

const EVIDENCE_ROOT = fileURLToPath(new URL("./evidence/", import.meta.url));

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

/** A transport that records nothing and always fails closed: no generation happens. */
const DEAD_TRANSPORT = {
  complete: async () => {
    throw new Error("DETERMINISTIC_PHASE: no model call is permitted in this phase");
  }
};

export interface ConditionDeterministicCheck {
  readonly condition: ConditionId;
  readonly credits_expected: number;
  readonly familiarity_value: number | null;
  readonly familiarity_matches_credits: boolean;
  readonly governed_authority_records: number;
  readonly seed_contamination_clean: boolean;
  readonly seed_contains_governed_relationship_state: boolean;
  readonly seeded_bundles_with_writer_authority: number;
  readonly unreadable_seed_shapes: number;
  readonly restored_familiarity_equal: boolean;
  readonly scene: {
    readonly result_kind: string;
    readonly familiarity_entry_line: string | null;
    readonly influence_entry_line: string | null;
    readonly retrieval_queries: number;
    readonly mediator_visible_in_prompt: boolean;
    readonly mediator_in_allowed_refs: boolean;
    readonly behavior_class: string;
    readonly user_content_digest: string;
  };
  readonly intervention: SceneObservation["intervention"];
  readonly expected: {
    readonly level: number;
    readonly strategy: string;
    readonly mediator_available: boolean;
  };
  readonly matches_expected: boolean;
  readonly failures: readonly string[];
}

export interface DeterministicReport {
  readonly schema_version: "familiarity-history-causal-deterministic-v0";
  readonly experiment_id: "RELATIONSHIP_FAMILIARITY_HISTORY_CAUSAL_EXPERIMENT_V0";
  readonly real_model_calls: 0;
  readonly subject: string;
  readonly counterpart: string;
  readonly model: unknown;
  readonly cells: readonly ConditionDeterministicCheck[];
  readonly histories: readonly {
    readonly condition: ConditionId;
    readonly credits: number;
    readonly familiarity_value: number | null;
    readonly state_revision: number;
    readonly corpus_digest: string;
    readonly working_refs: readonly string[];
    readonly first_governed_record: HistoryBundle["governed_authority_records"][number] | null;
  }[];
  readonly corpus_identical: boolean;
  readonly corpus_digests: readonly string[];
  readonly prompt_diffs: readonly {
    readonly left: string;
    readonly right: string;
    readonly differing_lines: readonly string[];
  }[];
  readonly all_seed_clean: boolean;
  readonly all_manipulations_ok: boolean;
  readonly mediation_precheck_ok: boolean;
  readonly detail: string;
}

export async function runDeterministicPhase(): Promise<{
  readonly report: DeterministicReport;
  readonly bundles: Record<string, HistoryBundle>;
}> {
  mkdirSync(EVIDENCE_ROOT, { recursive: true });
  const cells: ConditionDeterministicCheck[] = [];
  const histories: DeterministicReport["histories"][number][] = [];
  const promptByCondition = new Map<ConditionId, string>();
  const bundles: Record<string, HistoryBundle> = {};

  for (const condition of ALL_CELL_IDS) {
    const expected = CONDITIONS[condition];
    const failures: string[] = [];

    // ---- PHASE 2/3: history formation through the REAL governed writer -------------
    const { runtime, bundle } = await buildHistory(condition);
    bundles[condition] = bundle;
    const familiarity = familiarityOf(
      (await runtime.assembly.facade.readCurrentSnapshot(SUBJECT as never)) as never
    );
    const creditsMatch = familiarity === expected.credits / 32;
    if (!creditsMatch) failures.push(`familiarity ${String(familiarity)} != ${expected.credits}/32`);
    if (!bundle.seed_contamination.clean) failures.push("seed contamination gate failed");
    if (bundle.governed_authority_records.length !== expected.credits) {
      failures.push(`governed records ${bundle.governed_authority_records.length} != ${expected.credits}`);
    }

    // ---- PHASE 9 precondition: fresh-process authoritative restore ------------------
    const restored = await restoreHistory(bundle);
    const restoredSnapshot = (await restored.assembly.facade.readCurrentSnapshot(SUBJECT as never)) as never;
    const restoredFamiliarity = familiarityOf(restoredSnapshot);
    const restoredEqual = restoredFamiliarity === familiarity;
    if (!restoredEqual) failures.push(`restored familiarity ${String(restoredFamiliarity)} != ${String(familiarity)}`);

    // ---- PHASE 1/6: production prompt + mediation state (0 model calls) -------------
    const scene = await runScene(restored, {
      condition,
      scenario: SCENARIOS[0] as (typeof SCENARIOS)[number],
      replicate: 1,
      suppress_mediator_contribution:
        condition === "C_MEDIATOR_ABLATED" || condition === "D_FAMILIARITY_EQUALIZED",
      equalize_familiarity_representation: condition === "D_FAMILIARITY_EQUALIZED",
      cognitionTransport: DEAD_TRANSPORT,
      languageTransport: DEAD_TRANSPORT
    });
    promptByCondition.set(condition, scene.cognition.user_content);

    const expectedFamiliarityLine = `- entity:alice: presence=PRESENT level=${expected.expected_level}/32`;
    const renderedFamiliarityLine = scene.recognition.familiarity_entry_line;
    if (renderedFamiliarityLine === null) {
      failures.push("no familiarity line in the model-visible prompt");
    } else if (!renderedFamiliarityLine.includes(`level=${expected.expected_level}/32`)) {
      failures.push(`familiarity line "${renderedFamiliarityLine}" != expected level ${expected.expected_level}/32`);
    }
    void expectedFamiliarityLine;
    if (scene.recognition.influence_entry_line === null) {
      failures.push("no influence line in the model-visible prompt");
    } else if (!scene.recognition.influence_entry_line.includes(expected.expected_strategy)) {
      failures.push(
        `influence line "${scene.recognition.influence_entry_line}" != ${expected.expected_strategy}`
      );
    }
    if (scene.recognition.mediator_visible_in_prompt !== expected.mediator_available) {
      failures.push(
        `mediator visible ${String(scene.recognition.mediator_visible_in_prompt)} != expected ${String(expected.mediator_available)}`
      );
    }
    if (scene.recognition.mediator_in_allowed_refs !== expected.mediator_available) {
      failures.push(
        `mediator in allowed refs ${String(scene.recognition.mediator_in_allowed_refs)} != expected ${String(expected.mediator_available)}`
      );
    }
    const expectedQueries = expected.expected_retrieval_queries;
    if (scene.retrieval.queries !== expectedQueries) {
      failures.push(`retrieval queries ${scene.retrieval.queries} != ${expectedQueries}`);
    }
    // The endpoint class must be UNCLASSIFIED here: the transport failed closed, so no
    // behavior was delivered. This proves the probe generated nothing.
    if (scene.result_kind !== "FAILED" || scene.behavior_class !== "UNCLASSIFIED") {
      failures.push(`probe was not generation-free (${scene.result_kind}/${scene.behavior_class})`);
    }
    if (scene.recognition.condition_label_leak) failures.push("condition label leaked into the prompt");

    cells.push({
      condition,
      credits_expected: expected.credits,
      familiarity_value: familiarity,
      familiarity_matches_credits: creditsMatch,
      governed_authority_records: bundle.governed_authority_records.length,
      seed_contamination_clean: bundle.seed_contamination.clean,
      seed_contains_governed_relationship_state: bundle.seed_contamination.seed_contains_governed_relationship_state,
      seeded_bundles_with_writer_authority: bundle.seed_contamination.seeded_bundles_with_writer_authority,
      unreadable_seed_shapes: bundle.seed_contamination.unreadable_seed_shapes,
      restored_familiarity_equal: restoredEqual,
      scene: {
        result_kind: scene.result_kind,
        familiarity_entry_line: scene.recognition.familiarity_entry_line,
        influence_entry_line: scene.recognition.influence_entry_line,
        retrieval_queries: scene.retrieval.queries,
        mediator_visible_in_prompt: scene.recognition.mediator_visible_in_prompt,
        mediator_in_allowed_refs: scene.recognition.mediator_in_allowed_refs,
        behavior_class: scene.behavior_class,
        user_content_digest: scene.cognition.material_digest
      },
      intervention: scene.intervention,
      expected: {
        level: expected.expected_level,
        strategy: expected.expected_strategy,
        mediator_available: expected.mediator_available
      },
      matches_expected: failures.length === 0,
      failures
    });

    histories.push({
      condition,
      credits: expected.credits,
      familiarity_value: familiarity,
      state_revision: bundle.state_revision,
      corpus_digest: bundle.corpus_digest,
      working_refs: bundle.working_refs,
      first_governed_record: bundle.governed_authority_records[0] ?? null
    });
  }

  // ---- prompt equality/diff evidence (PHASE 4 "same base prompt" claim) -------------
  function differingLines(left: string, right: string): readonly string[] {
    const a = left.split("\n");
    const b = right.split("\n");
    const diffs: string[] = [];
    const max = Math.max(a.length, b.length);
    for (let index = 0; index < max; index += 1) {
      if (a[index] !== b[index]) diffs.push(`${index}: ${JSON.stringify(a[index] ?? null)} != ${JSON.stringify(b[index] ?? null)}`);
    }
    return diffs;
  }

  const promptDiffs: { left: string; right: string; differing_lines: readonly string[] }[] = [];
  
  for (const [left, right] of [
    ["A_LOW", "B_HIGH"],
    ["A_LOW", "C_MEDIATOR_ABLATED"],
    ["A_LOW", "D_FAMILIARITY_EQUALIZED"],
    ["A_LOW", "E_LOW_WITH_MEDIATOR"],
    ["B_HIGH", "C_MEDIATOR_ABLATED"]
  ] as readonly (readonly [ConditionId, ConditionId])[]) {
    promptDiffs.push({
      left,
      right,
      differing_lines: differingLines(promptByCondition.get(left) as string, promptByCondition.get(right) as string)
    });
  }

  const corpusDigests = [...new Set(histories.map((entry) => entry.corpus_digest))];
  const corpusIdentical = corpusDigests.length === 1;
  const allSeedClean = cells.every((entry) => entry.seed_contamination_clean);
  const allManipulationsOk = cells.every((entry) => entry.matches_expected);
  // The mediation PRE-CHECK: the treatment must actually expose the counterpart
  // mediator, and the two ablations plus the availability control must be constructed
  // as preregistered. Without this, no model run could answer the question.
  const treatment = cells.find((entry) => entry.condition === "B_HIGH");
  const baseline = cells.find((entry) => entry.condition === "A_LOW");
  const mediationPrecheckOk = treatment !== undefined && baseline !== undefined
    && treatment.scene.mediator_visible_in_prompt
    && treatment.scene.mediator_in_allowed_refs
    && treatment.scene.retrieval_queries === 1
    && !baseline.scene.mediator_visible_in_prompt
    && baseline.scene.retrieval_queries === 0;

  const report: DeterministicReport = {
    schema_version: "familiarity-history-causal-deterministic-v0",
    experiment_id: "RELATIONSHIP_FAMILIARITY_HISTORY_CAUSAL_EXPERIMENT_V0",
    real_model_calls: 0,
    subject: SUBJECT,
    counterpart: ALICE,
    model: MODEL,
    cells,
    histories,
    corpus_identical: corpusIdentical,
    corpus_digests: corpusDigests,
    prompt_diffs: promptDiffs,
    all_seed_clean: allSeedClean,
    all_manipulations_ok: allManipulationsOk,
    mediation_precheck_ok: mediationPrecheckOk,
    detail: allSeedClean && allManipulationsOk && corpusIdentical && mediationPrecheckOk
      ? "deterministic phase complete: seeds clean, corpus identical, every cell matches its preregistered manipulation, and the treatment exposes the counterpart mediator"
      : "deterministic phase found a construction failure; no model run is authorized"
  };
  writeJson(join(EVIDENCE_ROOT, "deterministic.json"), report);
  // Prompt evidence is ALWAYS written: it is the "same model / same base prompt" proof
  // and the auditable record of the exact model-facing text per cell.
  writeJson(join(EVIDENCE_ROOT, "prompts.json"), Object.fromEntries(promptByCondition));
  void MEDIATOR_REF;
  return { report, bundles };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { report } = await runDeterministicPhase();
  process.stdout.write(`${JSON.stringify({
    all_seed_clean: report.all_seed_clean,
    all_manipulations_ok: report.all_manipulations_ok,
    corpus_identical: report.corpus_identical,
    mediation_precheck_ok: report.mediation_precheck_ok,
    cells: report.cells.map((entry) => ({
      condition: entry.condition,
      familiarity: entry.familiarity_value,
      governed_records: entry.governed_authority_records,
      familiarity_line: entry.scene.familiarity_entry_line,
      influence_line: entry.scene.influence_entry_line,
      queries: entry.scene.retrieval_queries,
      mediator: entry.scene.mediator_visible_in_prompt,
      failures: entry.failures
    })),
    prompt_diff_A_B: report.prompt_diffs.find((entry) => entry.left === "A_LOW" && entry.right === "B_HIGH")?.differing_lines
  }, null, 2)}\n`);
}
