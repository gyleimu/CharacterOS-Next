import {
  VERDICT_RULE,
  actionTupleKey,
  type AllowedAction,
  type ScenarioRepairV0,
  type SemanticActionId
} from "./contract.ts";
import {
  canonicalJson,
  equal,
  hashJson
} from "../canonical-affect-behavior-influence-v1/fixtures.ts";

export { canonicalJson, equal, hashJson };

export const EXPECTED_TREATMENT_DIFFERING_FIELDS = Object.freeze([
  "canonical_affect",
  "projection_hash"
] as const);

export interface CognitionEndpoints {
  readonly current_intent: string | null;
  readonly confidence: number;
  readonly uncertainty: number;
  readonly action_intent: AllowedAction | null;
  readonly reasoning_summary_length: number;
}

export type SemanticSelection = SemanticActionId | "NO_ACTION" | "OTHER";
export type SemanticShiftDirection = "X_HIGHER_IN_A" | "X_HIGHER_IN_B" | "NONE";
export type PrincipalVerdict =
  | "ACTION_SELECTION_SENSITIVITY_REPAIR_SUPPORTED"
  | "ACTION_SELECTION_SENSITIVITY_REPAIR_NOT_SUPPORTED"
  | "ACTION_SELECTION_SENSITIVITY_REPAIR_INCONCLUSIVE"
  | "EXPERIMENT_REPAIR_NOT_JUSTIFIED"
  | "EXPERIMENT_CONFOUND_DETECTED";

export function auditTreatmentPair(inputA: unknown, inputB: unknown): {
  readonly non_affect_provider_input_equal: boolean;
  readonly differing_fields: readonly string[];
  readonly expected_differing_fields: readonly string[];
} {
  const a = inputA as Record<string, unknown>;
  const b = inputB as Record<string, unknown>;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const differing = [...keys].filter((key) => !equal(a[key], b[key])).sort();
  const expected = [...EXPECTED_TREATMENT_DIFFERING_FIELDS].sort();
  return {
    non_affect_provider_input_equal: equal(differing, expected),
    differing_fields: differing,
    expected_differing_fields: expected
  };
}

export function auditOrderReversal(original: unknown, reversed: unknown): {
  readonly reversal_only: boolean;
  readonly differing_fields: readonly string[];
  readonly exact_reverse: boolean;
  readonly semantic_set_equal: boolean;
} {
  const a = original as Record<string, unknown>;
  const b = reversed as Record<string, unknown>;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const differing = [...keys].filter((key) => !equal(a[key], b[key])).sort();
  const originalActions = a["allowed_actions"] as readonly unknown[];
  const reversedActions = b["allowed_actions"] as readonly unknown[];
  const exactReverse =
    Array.isArray(originalActions) &&
    Array.isArray(reversedActions) &&
    equal([...originalActions].reverse(), reversedActions);
  const semanticSetEqual =
    Array.isArray(originalActions) &&
    Array.isArray(reversedActions) &&
    equal(
      [...originalActions].map(canonicalJson).sort(),
      [...reversedActions].map(canonicalJson).sort()
    );
  return {
    reversal_only:
      equal(differing, ["allowed_actions"]) && exactReverse && semanticSetEqual,
    differing_fields: differing,
    exact_reverse: exactReverse,
    semantic_set_equal: semanticSetEqual
  };
}

export function cognitionEndpoints(proposal: unknown): CognitionEndpoints {
  const row = proposal as Record<string, unknown>;
  const rawAction = row["action_intent"];
  const actionIntent =
    rawAction !== null && typeof rawAction === "object" && !Array.isArray(rawAction)
      ? {
          action_type: String(
            (rawAction as Record<string, unknown>)["action_type"]
          ) as AllowedAction["action_type"],
          target_ref: null
        }
      : null;
  return {
    current_intent:
      typeof row["current_intent"] === "string" ? row["current_intent"] : null,
    confidence: Number(row["confidence"]),
    uncertainty: Number(row["uncertainty"]),
    action_intent: actionIntent,
    reasoning_summary_length: String(row["reasoning_summary"] ?? "").length
  };
}

export function actionIntentLabel(value: AllowedAction | null): string {
  return actionTupleKey(value);
}

export function actionIntentDistance(
  a: CognitionEndpoints,
  b: CognitionEndpoints
): 0 | 1 {
  return actionIntentLabel(a.action_intent) === actionIntentLabel(b.action_intent)
    ? 0
    : 1;
}

export function semanticSelection(
  actionValue: AllowedAction | null,
  scenario: ScenarioRepairV0
): SemanticSelection {
  const label = actionIntentLabel(actionValue);
  if (label === actionTupleKey(scenario.semantic_action_x)) return "X";
  if (label === actionTupleKey(scenario.semantic_action_y)) return "Y";
  if (actionValue === null) return "NO_ACTION";
  return "OTHER";
}

export function firstPositionSelected(
  actionValue: AllowedAction | null,
  allowedActions: readonly AllowedAction[]
): boolean | null {
  if (actionValue === null || allowedActions.length !== 2) return null;
  return actionIntentLabel(actionValue) === actionTupleKey(allowedActions[0] ?? null);
}

export function semanticShiftDirection(
  aXRate: number | null,
  bXRate: number | null
): SemanticShiftDirection {
  if (aXRate === null || bXRate === null || aXRate === bXRate) return "NONE";
  return aXRate > bXRate ? "X_HIGHER_IN_A" : "X_HIGHER_IN_B";
}

export function rate(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator;
}

export function absoluteFirstPositionDeviation(firstRate: number | null): number | null {
  return firstRate === null ? null : Math.abs(firstRate - 0.5);
}

export function chooseVerdict(input: {
  readonly repair_justified: boolean;
  readonly common_full_valid_units: number;
  readonly treatment_minus_ablation_delta: number | null;
  readonly order_invariant_scenario_count: number;
  readonly residual_position_bias: boolean;
  readonly experiment_confound: boolean;
}): PrincipalVerdict {
  if (!input.repair_justified) return "EXPERIMENT_REPAIR_NOT_JUSTIFIED";
  if (input.experiment_confound) return "EXPERIMENT_CONFOUND_DETECTED";
  const validityPass =
    input.common_full_valid_units >= VERDICT_RULE.minimum_common_full_valid_units;
  if (
    !validityPass ||
    input.residual_position_bias ||
    input.treatment_minus_ablation_delta === null
  ) {
    return "ACTION_SELECTION_SENSITIVITY_REPAIR_INCONCLUSIVE";
  }
  if (
    input.treatment_minus_ablation_delta >= VERDICT_RULE.supported_minimum_delta &&
    input.order_invariant_scenario_count >=
      VERDICT_RULE.supported_minimum_order_invariant_scenarios
  ) {
    return "ACTION_SELECTION_SENSITIVITY_REPAIR_SUPPORTED";
  }
  if (
    input.treatment_minus_ablation_delta <= VERDICT_RULE.not_supported_maximum_delta &&
    input.order_invariant_scenario_count === 0
  ) {
    return "ACTION_SELECTION_SENSITIVITY_REPAIR_NOT_SUPPORTED";
  }
  return "ACTION_SELECTION_SENSITIVITY_REPAIR_INCONCLUSIVE";
}
