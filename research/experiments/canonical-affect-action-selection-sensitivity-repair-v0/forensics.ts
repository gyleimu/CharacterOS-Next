/** Deterministic, zero-provider Phase-R0 audit of the frozen valid sensitivity run. */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  PRIOR_MANIFEST_SHA256,
  PRIOR_TRIALS_SHA256,
  PRIOR_VALID_RUN,
  REPAIR_TYPE
} from "./contract.ts";

interface PriorAction {
  readonly action_type: string;
  readonly target_ref: string | null;
}

interface PriorTrial {
  readonly scenario_id: string;
  readonly action_order_id: string;
  readonly arm: "A" | "B" | "ABL_A" | "ABL_B";
  readonly trial_id: string;
  readonly trial_ordinal: number;
  readonly allowed_actions: readonly PriorAction[];
  readonly semantic_action_labels: Readonly<Record<"X" | "Y", string>>;
  readonly action_intent: PriorAction | null;
  readonly semantic_selection: "X" | "Y" | "NO_ACTION" | "OTHER" | null;
  readonly first_position_selected: boolean | null;
  readonly current_intent: string | null;
  readonly provider_input_hash: string;
  readonly status: string;
}

type CountMap = Record<"X" | "Y" | "NO_ACTION" | "OTHER", number>;

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`REPAIR_R0: ${message}`);
}

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

function readTrials(path: string): readonly PriorTrial[] {
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as PriorTrial);
}

function actionKey(action: PriorAction | null): string {
  if (action === null) return "NO_ACTION";
  return `${action.action_type}@${action.target_ref ?? "null"}`;
}

function selectionCounts(trials: readonly PriorTrial[]): CountMap {
  const counts: CountMap = { X: 0, Y: 0, NO_ACTION: 0, OTHER: 0 };
  for (const trial of trials) {
    const key = trial.semantic_selection ?? "OTHER";
    counts[key] += 1;
  }
  return counts;
}

function rate(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator;
}

function positionCounts(trials: readonly PriorTrial[]): Record<string, unknown> {
  const eligible = trials.filter((trial) => trial.first_position_selected !== null);
  const first = eligible.filter((trial) => trial.first_position_selected === true).length;
  const second = eligible.filter((trial) => trial.first_position_selected === false).length;
  return {
    eligible: eligible.length,
    first_listed_selected: first,
    first_listed_selection_rate: rate(first, eligible.length),
    second_listed_selected: second,
    second_listed_selection_rate: rate(second, eligible.length)
  };
}

function unitKey(trial: PriorTrial): string {
  return `${trial.scenario_id}\u0000${trial.action_order_id}\u0000${trial.trial_ordinal}`;
}

export function buildRepairAnalysis(): Record<string, unknown> {
  const root = resolve(PRIOR_VALID_RUN);
  const trialsPath = resolve(root, "trials.jsonl");
  const manifestPath = resolve(root, "scenario-manifest.json");
  check(sha256(trialsPath) === PRIOR_TRIALS_SHA256, "frozen prior trials hash mismatch");
  check(sha256(manifestPath) === PRIOR_MANIFEST_SHA256, "frozen prior manifest hash mismatch");
  const trials = readTrials(trialsPath);
  const manifest = readJson(manifestPath) as readonly Record<string, unknown>[];
  check(trials.length === 160, "prior valid run must contain 160 trials");
  check(trials.every((trial) => trial.status === "VALID"), "prior run contains invalid trial");

  const scenarioOrderRows: Record<string, unknown>[] = [];
  for (const scenario of manifest) {
    const scenarioId = String(scenario["scenario_id"]);
    for (const order of ["ORIGINAL", "REVERSED"] as const) {
      const subset = trials.filter(
        (trial) =>
          trial.scenario_id === scenarioId && trial.action_order_id === order
      );
      check(subset.length === 20, `${scenarioId}/${order}: expected 20 trials`);
      const byArm = Object.fromEntries(
        (["A", "B", "ABL_A", "ABL_B"] as const).map((arm) => {
          const armTrials = subset.filter((trial) => trial.arm === arm);
          return [
            arm,
            {
              semantic_selection: selectionCounts(armTrials),
              position_selection: positionCounts(armTrials),
              exact_actions: Object.fromEntries(
                [...new Set(armTrials.map((trial) => actionKey(trial.action_intent)))]
                  .sort()
                  .map((key) => [
                    key,
                    armTrials.filter((trial) => actionKey(trial.action_intent) === key)
                      .length
                  ])
              )
            }
          ];
        })
      );
      scenarioOrderRows.push({
        scenario_id: scenarioId,
        action_order_id: order,
        semantic_action_x: scenario["semantic_action_x"],
        semantic_action_y: scenario["semantic_action_y"],
        semantic_action_labels: subset[0]?.semantic_action_labels,
        exact_action_labels: subset[0]?.allowed_actions.map((entry) => entry.action_type),
        target_refs: subset[0]?.allowed_actions.map((entry) => entry.target_ref),
        current_factual_event: scenario["fact_text"],
        current_task: scenario["current_task"],
        allowed_action_serialization: subset[0]?.allowed_actions,
        by_arm: byArm,
        aggregate_position_selection: positionCounts(subset)
      });
    }
  }

  const groups = new Map<string, PriorTrial[]>();
  for (const trial of trials) {
    const key = unitKey(trial);
    groups.set(key, [...(groups.get(key) ?? []), trial]);
  }
  const disagreements: Record<string, unknown>[] = [];
  for (const rows of groups.values()) {
    const a = rows.find((trial) => trial.arm === "A");
    const b = rows.find((trial) => trial.arm === "B");
    const ablA = rows.find((trial) => trial.arm === "ABL_A");
    const ablB = rows.find((trial) => trial.arm === "ABL_B");
    check(a !== undefined && b !== undefined && ablA !== undefined && ablB !== undefined, "incomplete prior four-arm unit");
    if (actionKey(a.action_intent) === actionKey(b.action_intent)) continue;
    disagreements.push({
      scenario_id: a.scenario_id,
      action_order_id: a.action_order_id,
      trial_ordinal: a.trial_ordinal,
      matched_trial_ids: {
        A: a.trial_id,
        B: b.trial_id,
        ABL_A: ablA.trial_id,
        ABL_B: ablB.trial_id
      },
      actions: {
        A: actionKey(a.action_intent),
        B: actionKey(b.action_intent),
        ABL_A: actionKey(ablA.action_intent),
        ABL_B: actionKey(ablB.action_intent)
      },
      semantic_selections: {
        A: a.semantic_selection,
        B: b.semantic_selection,
        ABL_A: ablA.semantic_selection,
        ABL_B: ablB.semantic_selection
      },
      positions: {
        A: a.first_position_selected === true ? "FIRST" : "SECOND",
        B: b.first_position_selected === true ? "FIRST" : "SECOND",
        ABL_A: ablA.first_position_selected === true ? "FIRST" : "SECOND",
        ABL_B: ablB.first_position_selected === true ? "FIRST" : "SECOND"
      },
      current_intent: { A: a.current_intent, B: b.current_intent },
      provider_input_hashes: {
        A: a.provider_input_hash,
        B: b.provider_input_hash,
        ABL_A: ablA.provider_input_hash,
        ABL_B: ablB.provider_input_hash
      }
    });
  }
  check(disagreements.length === 5, "prior treatment disagreement count must be 5");

  const original = trials.filter((trial) => trial.action_order_id === "ORIGINAL");
  const reversed = trials.filter((trial) => trial.action_order_id === "REVERSED");
  const concentration = {
    disagreement_count: disagreements.length,
    all_in_one_scenario:
      new Set(disagreements.map((row) => row["scenario_id"])).size === 1,
    scenario_ids: [...new Set(disagreements.map((row) => String(row["scenario_id"])))],
    all_in_one_action_order:
      new Set(disagreements.map((row) => row["action_order_id"])).size === 1,
    action_order_ids: [
      ...new Set(disagreements.map((row) => String(row["action_order_id"])))
    ],
    all_trials_of_that_scenario_order: disagreements.length === 5,
    common_direction: "A=semantic Y/first listed; B=semantic X/second listed",
    ablation_background: "ABL_A=ABL_B=semantic Y/first listed in all five units"
  };

  return {
    schema_version: "canonical-affect-action-selection-sensitivity-repair-analysis-v0",
    real_provider_generation_calls: 0,
    source: {
      directory: PRIOR_VALID_RUN,
      trials_sha256: PRIOR_TRIALS_SHA256,
      scenario_manifest_sha256: PRIOR_MANIFEST_SHA256,
      attempted_calls: 160,
      valid_calls: 160,
      full_four_arm_units: 40,
      frozen_principal_verdict: "ACTION_SELECTION_SENSITIVITY_INCONCLUSIVE",
      treatment_disagreement: { count: 5, denominator: 40, rate: 0.125 },
      ablation_disagreement: { count: 0, denominator: 40, rate: 0 },
      delta: 0.125,
      order_invariant_scenario_count: 0
    },
    per_scenario_order: scenarioOrderRows,
    aggregate_position: {
      original_order: positionCounts(original),
      reversed_order: positionCounts(reversed),
      all_trials: positionCounts(trials)
    },
    localized_treatment_disagreements: disagreements,
    disagreement_concentration: concentration,
    hypotheses: {
      R1_ACTION_LABEL_SEMANTIC_ASYMMETRY: {
        status: "SUPPORTED",
        evidence:
          "Semantically loaded action_type verbs remained visible; S1 and S3 selected semantic X in all 40/40 calls per scenario across both orders and all arms."
      },
      R2_FIRST_POSITION_BIAS: {
        status: "SUPPORTED",
        evidence:
          "First-listed selection was 70/80 (87.5%) in ORIGINAL versus 35/80 (43.75%) in REVERSED; order changed ablation semantic choice in S2 and S4."
      },
      R3_SCENARIO_SEMANTIC_IMBALANCE: {
        status: "SUPPORTED",
        evidence:
          "Three scenarios produced order/arm-invariant or near-invariant semantic choices, while all five treatment disagreements concentrated in only S4/REVERSED."
      },
      R4_TARGET_REF_ASYMMETRY: {
        status: "PRESENT_AS_UNRESOLVED_CONFOUND",
        evidence:
          "S1 and S3 contrasted an entity:alice target with null; its isolated contribution cannot be separated from action-label semantics in the frozen run."
      },
      R5_PROMPT_PRESENTATION_ASYMMETRY: {
        status: "SUPPORTED",
        evidence:
          "The action serialization exposed unequal semantic verbs and, in two scenarios, unequal target forms; only list order was counterbalanced."
      },
      R6_TRUE_WEAK_ACTION_EFFECT: {
        status: "NOT_ADJUDICABLE_BEFORE_REPAIR",
        evidence:
          "The 12.5pp signal cannot be cleanly assigned to a weak effect while R1-R5 remain executable confounds."
      }
    },
    repair_decision: {
      chosen_repair_type: REPAIR_TYPE,
      alternatives_rejected: {
        SEMANTIC_BALANCE_REPAIR: "insufficient because list-position effects are material",
        POSITION_CONTROL_REPAIR: "insufficient because action labels, targets, and scenario semantics are asymmetric",
        NO_IDENTIFIABILITY_REPAIR_JUSTIFIED: "rejected because concrete executable R1-R5 confounds exist"
      },
      action:
        "Use machine-valid experiment-local OPTION_A/OPTION_B aliases, equal null targets, symmetric benefit/cost wording, two list orders, and Latin-style cross-scenario alias/description balance."
    }
  };
}
