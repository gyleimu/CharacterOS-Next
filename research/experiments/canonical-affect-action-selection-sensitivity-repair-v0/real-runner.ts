import {
  executeOneRealTrial as executeFrozenV1Trial,
  probeProviderEnvironment as probeFrozenV1Provider,
  type LocalModelProbe,
  type TrialStatus
} from "../canonical-affect-behavior-influence-v1/real-runner.ts";
import { check } from "../canonical-affect-behavior-influence-v1/fixtures.ts";
import {
  ACTION_ORDERS,
  ARMS,
  BALANCED_ARM_ORDER,
  EXPERIMENT_VERSION,
  MATCHED_FOUR_ARM_UNITS,
  PLANNED_REAL_CALLS,
  PRIMARY_PROVIDER,
  REFERENCE_MAGNITUDE,
  REPAIR_TYPE,
  SCENARIOS,
  TRIALS_PER_ARM_SCENARIO_ORDER,
  VERDICT_RULE,
  actionTupleKey,
  actionsForOrder,
  semanticActionLabels,
  type ActionOrderId,
  type AllowedAction,
  type Arm,
  type ScenarioRepairV0
} from "./contract.ts";
import {
  actionIntentDistance,
  actionIntentLabel,
  absoluteFirstPositionDeviation,
  chooseVerdict,
  cognitionEndpoints,
  firstPositionSelected,
  rate,
  semanticSelection,
  semanticShiftDirection,
  type CognitionEndpoints,
  type SemanticSelection,
  type SemanticShiftDirection
} from "./metrics.ts";
import type { PhaseAResult, PreparedCell } from "./phase-a.ts";

export type { TrialStatus };

export interface ProviderPreflight {
  readonly schema_version: "canonical-affect-action-selection-sensitivity-repair-provider-preflight-v0";
  readonly endpoint: string;
  readonly checked_at: string;
  readonly reachable: boolean;
  readonly ollama_version: string | null;
  readonly primary_model: LocalModelProbe | null;
  readonly primary_model_available: boolean;
  readonly primary_digest_matches_frozen: boolean;
  readonly selected_model: string | null;
  readonly settings: Record<string, unknown>;
  readonly health_check_count: number;
  readonly health_checks: readonly Record<string, unknown>[];
  readonly provider_health_stable: boolean;
  readonly generation_calls: 0;
  readonly failure: string | null;
}

export interface TrialFailure {
  readonly name: string;
  readonly code: string | null;
  readonly http_status: number | null;
  readonly detail_ref: string | null;
  readonly message: string;
}

export interface TrialRecord {
  readonly experiment_version: typeof EXPERIMENT_VERSION;
  readonly scenario_id: string;
  readonly action_order_id: ActionOrderId;
  readonly magnitude_id: "REFERENCE";
  readonly model_id: string;
  readonly arm: Arm;
  readonly trial_id: string;
  readonly trial_ordinal: number;
  readonly execution_order: number;
  readonly within_unit_order: number;
  readonly allowed_actions: readonly AllowedAction[];
  readonly semantic_action_labels: Readonly<Record<"X" | "Y", string>>;
  readonly canonical_affect: {
    readonly schema_version: string;
    readonly valence: number;
    readonly activation: number;
  };
  readonly projection_hash: string;
  readonly provider_input_hash: string;
  readonly current_event_ref: string;
  readonly current_appraisal_ref: string;
  readonly subject_state_hash: string;
  readonly provider_settings: Record<string, unknown>;
  readonly raw_provider_response: {
    readonly content: string;
    readonly content_hash: string;
    readonly bytes: number;
    readonly response_model: string;
  } | null;
  readonly validated_cognition_proposal: Record<string, unknown> | null;
  readonly action_intent: AllowedAction | null;
  readonly current_intent: string | null;
  readonly endpoints: CognitionEndpoints | null;
  readonly semantic_selection: SemanticSelection | null;
  readonly first_position_selected: boolean | null;
  readonly second_position_selected: boolean | null;
  readonly status: TrialStatus;
  readonly validation_reason: string | null;
  readonly provider_response_obtained: boolean;
  readonly failure: TrialFailure | null;
  readonly latency_ms: number;
  readonly token_counts: {
    readonly prompt_tokens: number | null;
    readonly completion_tokens: number | null;
    readonly total_tokens: number | null;
  };
  readonly transport_trace: unknown;
}

export interface PlannedTrial {
  readonly cell: PreparedCell;
  readonly model_id: string;
  readonly arm: Arm;
  readonly trial_ordinal: number;
  readonly execution_order: number;
  readonly within_unit_order: number;
  readonly trial_id: string;
}

export interface CollectionArtifacts {
  readonly summary: Record<string, unknown>;
  readonly scenario_summary: readonly Record<string, unknown>[];
  readonly order_summary: readonly Record<string, unknown>[];
  readonly position_summary: Record<string, unknown>;
  readonly failure_summary: Record<string, unknown>;
}

interface UnitRows {
  readonly A?: TrialRecord;
  readonly B?: TrialRecord;
  readonly ABL_A?: TrialRecord;
  readonly ABL_B?: TrialRecord;
}

function providerSettings(): Record<string, unknown> {
  return {
    provider: PRIMARY_PROVIDER.provider,
    model: PRIMARY_PROVIDER.model,
    temperature: PRIMARY_PROVIDER.temperature,
    seed: PRIMARY_PROVIDER.seed,
    seed_policy: PRIMARY_PROVIDER.seed_policy,
    think: PRIMARY_PROVIDER.think,
    stream: PRIMARY_PROVIDER.stream,
    format: PRIMARY_PROVIDER.format,
    num_predict: PRIMARY_PROVIDER.num_predict,
    timeout_ms: PRIMARY_PROVIDER.timeout_ms,
    retries: PRIMARY_PROVIDER.retries
  };
}

/** Three spaced metadata-only checks; never consumes a generation call. */
export async function probeProviderEnvironment(): Promise<ProviderPreflight> {
  const checks: Awaited<ReturnType<typeof probeFrozenV1Provider>>[] = [];
  for (let index = 0; index < PRIMARY_PROVIDER.metadata_health_checks; index += 1) {
    checks.push(await probeFrozenV1Provider());
    if (index + 1 < PRIMARY_PROVIDER.metadata_health_checks) {
      await new Promise<void>((resolveDelay) => {
        setTimeout(resolveDelay, PRIMARY_PROVIDER.metadata_health_check_interval_ms);
      });
    }
  }
  const frozen = checks.at(-1);
  check(frozen !== undefined, "provider health preflight produced no checks");
  const first = checks[0];
  check(first !== undefined, "provider health preflight produced no first check");
  const primary = frozen.primary_model;
  const identity = (row: (typeof checks)[number]): string =>
    JSON.stringify({
      endpoint: row.endpoint,
      reachable: row.reachable,
      server_version: row.server_version,
      model: row.primary_model?.name ?? null,
      digest: row.primary_model?.digest ?? null,
      quantization: row.primary_model?.quantization_level ?? null
    });
  const providerHealthStable =
    checks.every(
      (row) =>
        row.reachable &&
        row.primary_model_available &&
        row.primary_model?.digest === PRIMARY_PROVIDER.v0_digest
    ) && checks.every((row) => identity(row) === identity(first));
  return {
    schema_version: "canonical-affect-action-selection-sensitivity-repair-provider-preflight-v0",
    endpoint: frozen.endpoint,
    checked_at: frozen.checked_at,
    reachable: frozen.reachable,
    ollama_version: frozen.server_version,
    primary_model: primary,
    primary_model_available: frozen.primary_model_available,
    primary_digest_matches_frozen:
      primary?.digest === PRIMARY_PROVIDER.v0_digest,
    selected_model:
      frozen.primary_model_available && primary !== null ? primary.name : null,
    settings: providerSettings(),
    health_check_count: checks.length,
    health_checks: checks.map((row, index) => ({
      ordinal: index + 1,
      checked_at: row.checked_at,
      reachable: row.reachable,
      ollama_version: row.server_version,
      model: row.primary_model?.name ?? null,
      digest: row.primary_model?.digest ?? null,
      quantization: row.primary_model?.quantization_level ?? null,
      failure: row.failure
    })),
    provider_health_stable: providerHealthStable,
    generation_calls: 0,
    failure: providerHealthStable
      ? null
      : checks.map((row) => row.failure).find((value) => value !== null) ??
        "provider metadata identity was not stable"
  };
}

export function buildExecutionPlan(phaseA: PhaseAResult): readonly PlannedTrial[] {
  const plan: PlannedTrial[] = [];
  let executionOrder = 0;
  for (const scenario of SCENARIOS) {
    for (const actionOrderId of ACTION_ORDERS) {
      const cell = phaseA.prepared.find(
        (candidate) =>
          candidate.scenario.scenario_id === scenario.scenario_id &&
          candidate.action_order_id === actionOrderId
      );
      check(
        cell !== undefined,
        `${scenario.scenario_id}/${actionOrderId}: prepared cell missing`
      );
      for (
        let ordinal = 1;
        ordinal <= TRIALS_PER_ARM_SCENARIO_ORDER;
        ordinal += 1
      ) {
        const armOrder = BALANCED_ARM_ORDER[(ordinal - 1) % BALANCED_ARM_ORDER.length];
        check(armOrder !== undefined, `trial ${ordinal}: arm rotation missing`);
        for (let within = 0; within < armOrder.length; within += 1) {
          const arm = armOrder[within];
          check(arm !== undefined, "balanced arm entry missing");
          executionOrder += 1;
          plan.push({
            cell,
            model_id: PRIMARY_PROVIDER.model,
            arm,
            trial_ordinal: ordinal,
            execution_order: executionOrder,
            within_unit_order: within + 1,
            trial_id: `${PRIMARY_PROVIDER.model}/${scenario.scenario_id}/${actionOrderId}/${ordinal}/${arm}`
          });
        }
      }
    }
  }
  check(plan.length === PLANNED_REAL_CALLS, "execution plan must contain 160 calls");
  return plan;
}

/** One provider call. It validates a proposal but never invokes ActionExecutionRunner. */
export async function executeOneRealTrial(item: PlannedTrial): Promise<TrialRecord> {
  const frozen = await executeFrozenV1Trial({
    cell: item.cell as never,
    model_id: item.model_id,
    arm: item.arm,
    trial_ordinal: item.trial_ordinal,
    execution_order: item.execution_order,
    within_unit_order: item.within_unit_order,
    trial_id: item.trial_id
  });
  const proposal = frozen.validated_cognition_proposal;
  const endpoints = proposal === null ? null : cognitionEndpoints(proposal);
  const selected =
    endpoints === null
      ? null
      : semanticSelection(endpoints.action_intent, item.cell.scenario);
  return {
    experiment_version: EXPERIMENT_VERSION,
    scenario_id: item.cell.scenario.scenario_id,
    action_order_id: item.cell.action_order_id,
    magnitude_id: "REFERENCE",
    model_id: item.model_id,
    arm: item.arm,
    trial_id: item.trial_id,
    trial_ordinal: item.trial_ordinal,
    execution_order: item.execution_order,
    within_unit_order: item.within_unit_order,
    allowed_actions: item.cell.allowed_actions.map((entry) => ({ ...entry })),
    semantic_action_labels: { ...item.cell.semantic_action_labels },
    canonical_affect: { ...frozen.canonical_affect },
    projection_hash: frozen.projection_hash,
    provider_input_hash: frozen.provider_input_hash,
    current_event_ref: frozen.current_event_ref,
    current_appraisal_ref: frozen.current_appraisal_ref,
    subject_state_hash: frozen.subject_state_hash,
    provider_settings: { ...frozen.provider_settings },
    raw_provider_response:
      frozen.raw_final_response === null
        ? null
        : { ...frozen.raw_final_response },
    validated_cognition_proposal: proposal,
    action_intent: endpoints?.action_intent ?? null,
    current_intent: endpoints?.current_intent ?? null,
    endpoints,
    semantic_selection: selected,
    first_position_selected:
      endpoints === null
        ? null
        : firstPositionSelected(endpoints.action_intent, item.cell.allowed_actions),
    second_position_selected:
      endpoints === null || endpoints.action_intent === null
        ? null
        : !firstPositionSelected(endpoints.action_intent, item.cell.allowed_actions),
    status: frozen.status,
    validation_reason: frozen.validation_subreason,
    provider_response_obtained: frozen.provider_response_obtained,
    failure: frozen.failure,
    latency_ms: frozen.latency_ms,
    token_counts: { ...frozen.token_counts },
    transport_trace: frozen.transport_trace
  };
}

function unitKey(trial: TrialRecord): string {
  return `${trial.scenario_id}\u0000${trial.action_order_id}\u0000${trial.trial_ordinal}`;
}

function groupedUnits(trials: readonly TrialRecord[]): Map<string, UnitRows> {
  const units = new Map<string, UnitRows>();
  for (const trial of trials) {
    const key = unitKey(trial);
    const existing = units.get(key) ?? {};
    units.set(key, { ...existing, [trial.arm]: trial });
  }
  return units;
}

function validPair(
  rows: UnitRows,
  left: "A" | "ABL_A",
  right: "B" | "ABL_B"
): readonly [TrialRecord, TrialRecord] | null {
  const a = rows[left];
  const b = rows[right];
  return a?.status === "VALID" && b?.status === "VALID" ? [a, b] : null;
}

function semanticDistribution(
  trials: readonly TrialRecord[],
  arm: Arm
): Record<SemanticSelection, number> {
  const result: Record<SemanticSelection, number> = {
    X: 0,
    Y: 0,
    NO_ACTION: 0,
    OTHER: 0
  };
  for (const trial of trials) {
    if (trial.arm === arm && trial.status === "VALID" && trial.semantic_selection !== null) {
      result[trial.semantic_selection] += 1;
    }
  }
  return result;
}

function actionDistribution(
  trials: readonly TrialRecord[],
  arm: Arm
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const trial of trials) {
    if (trial.arm !== arm || trial.status !== "VALID") continue;
    const label = actionIntentLabel(trial.action_intent);
    result[label] = (result[label] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b)));
}

function positionMetric(
  trials: readonly TrialRecord[],
  arm?: Arm
): {
  readonly eligible: number;
  readonly first_listed_selected: number;
  readonly first_listed_selection_rate: number | null;
  readonly second_listed_selected: number;
  readonly second_listed_selection_rate: number | null;
  readonly absolute_first_position_deviation: number | null;
} {
  const eligible = trials.filter(
    (trial) =>
      trial.status === "VALID" &&
      trial.first_position_selected !== null &&
      (arm === undefined || trial.arm === arm)
  );
  const first = eligible.filter((trial) => trial.first_position_selected === true).length;
  const second = eligible.filter((trial) => trial.first_position_selected === false).length;
  const firstRate = rate(first, eligible.length);
  return {
    eligible: eligible.length,
    first_listed_selected: first,
    first_listed_selection_rate: firstRate,
    second_listed_selected: second,
    second_listed_selection_rate: rate(second, eligible.length),
    absolute_first_position_deviation: absoluteFirstPositionDeviation(firstRate)
  };
}

function pairMetric(
  trials: readonly TrialRecord[],
  treatment: boolean
): { readonly valid_pairs: number; readonly disagreements: number; readonly rate: number | null } {
  const units = groupedUnits(trials);
  let validPairs = 0;
  let disagreements = 0;
  for (const rows of units.values()) {
    const pair = treatment
      ? validPair(rows, "A", "B")
      : validPair(rows, "ABL_A", "ABL_B");
    if (pair === null) continue;
    validPairs += 1;
    if (
      actionIntentDistance(
        pair[0].endpoints as CognitionEndpoints,
        pair[1].endpoints as CognitionEndpoints
      ) === 1
    ) {
      disagreements += 1;
    }
  }
  return { valid_pairs: validPairs, disagreements, rate: rate(disagreements, validPairs) };
}

function endpointDisagreement(
  trials: readonly TrialRecord[],
  endpoint: "current_intent" | "confidence" | "uncertainty" | "reasoning_summary_length",
  treatment: boolean
): { readonly valid_pairs: number; readonly disagreements: number; readonly rate: number | null } {
  const units = groupedUnits(trials);
  let validPairs = 0;
  let disagreements = 0;
  for (const rows of units.values()) {
    const pair = treatment
      ? validPair(rows, "A", "B")
      : validPair(rows, "ABL_A", "ABL_B");
    if (pair === null || pair[0].endpoints === null || pair[1].endpoints === null) continue;
    validPairs += 1;
    if (pair[0].endpoints[endpoint] !== pair[1].endpoints[endpoint]) disagreements += 1;
  }
  return { valid_pairs: validPairs, disagreements, rate: rate(disagreements, validPairs) };
}

function xSelectionRate(trials: readonly TrialRecord[], arm: Arm): number | null {
  const selected = trials.filter(
    (trial) => trial.arm === arm && trial.status === "VALID"
  );
  return rate(
    selected.filter((trial) => trial.semantic_selection === "X").length,
    selected.length
  );
}

function orderCellSummary(
  trials: readonly TrialRecord[],
  scenario: ScenarioRepairV0,
  actionOrderId: ActionOrderId
): Record<string, unknown> & { readonly semantic_shift_direction: SemanticShiftDirection } {
  const subset = trials.filter(
    (trial) =>
      trial.scenario_id === scenario.scenario_id &&
      trial.action_order_id === actionOrderId
  );
  const treatment = pairMetric(subset, true);
  const ablation = pairMetric(subset, false);
  const aXRate = xSelectionRate(subset, "A");
  const bXRate = xSelectionRate(subset, "B");
  return {
    scenario_id: scenario.scenario_id,
    action_order_id: actionOrderId,
    allowed_actions: actionsForOrder(scenario, actionOrderId),
    semantic_action_labels: semanticActionLabels(scenario),
    attempted_calls: subset.length,
    valid_calls: subset.filter((trial) => trial.status === "VALID").length,
    treatment_action_disagreement: treatment,
    ablation_action_disagreement: ablation,
    semantic_selection_distribution_by_arm: Object.fromEntries(
      ARMS.map((arm) => [arm, semanticDistribution(subset, arm)])
    ),
    exact_action_distribution_by_arm: Object.fromEntries(
      ARMS.map((arm) => [arm, actionDistribution(subset, arm)])
    ),
    semantic_action_x_rate_a: aXRate,
    semantic_action_x_rate_b: bXRate,
    semantic_shift_direction: semanticShiftDirection(aXRate, bXRate),
    position_selection_by_arm: Object.fromEntries(
      ARMS.map((arm) => [arm, positionMetric(subset, arm)])
    ),
    position_selection_aggregate: positionMetric(subset)
  };
}

function armValidity(trials: readonly TrialRecord[], arm: Arm): Record<string, unknown> {
  const subset = trials.filter((trial) => trial.arm === arm);
  const statuses = [
    "VALID",
    "PROVIDER_ERROR",
    "TIMEOUT",
    "INVALID_SCHEMA",
    "VALIDATION_REJECTED",
    "STALE",
    "OTHER_RUNTIME_FAILURE"
  ] as const;
  const byStatus = Object.fromEntries(
    statuses.map((status) => [status, subset.filter((trial) => trial.status === status).length])
  );
  return {
    attempted: subset.length,
    provider_responses: subset.filter((trial) => trial.provider_response_obtained).length,
    valid: subset.filter((trial) => trial.status === "VALID").length,
    failed: subset.filter((trial) => trial.status !== "VALID").length,
    null_action_intent: subset.filter(
      (trial) => trial.status === "VALID" && trial.action_intent === null
    ).length,
    model_action_not_allowed: subset.filter(
      (trial) => trial.failure?.code === "MODEL_ACTION_NOT_ALLOWED"
    ).length,
    by_status: byStatus
  };
}

function numericTotal(
  trials: readonly TrialRecord[],
  field: "prompt_tokens" | "completion_tokens" | "total_tokens"
): number | null {
  const values = trials.map((trial) => trial.token_counts[field]);
  return values.some((value) => value === null)
    ? null
    : (values as readonly number[]).reduce((sum, value) => sum + value, 0);
}

export function summarizeCollection(
  trials: readonly TrialRecord[],
  phaseA: PhaseAResult,
  preflight: ProviderPreflight
): CollectionArtifacts {
  const units = groupedUnits(trials);
  let commonFullValidUnits = 0;
  let treatmentDisagreements = 0;
  let ablationDisagreements = 0;
  const fullUnitsByScenario: Record<string, number> = Object.fromEntries(
    SCENARIOS.map((scenario) => [scenario.scenario_id, 0])
  );
  const fullUnitsByActionOrder: Record<ActionOrderId, number> = {
    ORDER_1: 0,
    ORDER_2: 0
  };
  for (const rows of units.values()) {
    const a = rows.A;
    const b = rows.B;
    const ablA = rows.ABL_A;
    const ablB = rows.ABL_B;
    if (
      a?.status !== "VALID" ||
      b?.status !== "VALID" ||
      ablA?.status !== "VALID" ||
      ablB?.status !== "VALID"
    ) {
      continue;
    }
    const first = a;
    commonFullValidUnits += 1;
    fullUnitsByScenario[first.scenario_id] =
      (fullUnitsByScenario[first.scenario_id] ?? 0) + 1;
    fullUnitsByActionOrder[first.action_order_id] += 1;
    treatmentDisagreements += actionIntentDistance(
      a.endpoints as CognitionEndpoints,
      b.endpoints as CognitionEndpoints
    );
    ablationDisagreements += actionIntentDistance(
      ablA.endpoints as CognitionEndpoints,
      ablB.endpoints as CognitionEndpoints
    );
  }
  const treatmentRate = rate(treatmentDisagreements, commonFullValidUnits);
  const ablationRate = rate(ablationDisagreements, commonFullValidUnits);
  const delta =
    treatmentRate === null || ablationRate === null
      ? null
      : treatmentRate - ablationRate;

  const scenarioSummary = SCENARIOS.map((scenario) => {
    const order1 = orderCellSummary(trials, scenario, "ORDER_1");
    const order2 = orderCellSummary(trials, scenario, "ORDER_2");
    const order1Direction = order1.semantic_shift_direction;
    const order2Direction = order2.semantic_shift_direction;
    const orderInvariant =
      order1Direction !== "NONE" && order1Direction === order2Direction;
    return {
      scenario_id: scenario.scenario_id,
      semantic_action_x: actionTupleKey(scenario.semantic_action_x),
      semantic_action_y: actionTupleKey(scenario.semantic_action_y),
      semantic_meaning_x: scenario.semantic_meaning_x,
      semantic_meaning_y: scenario.semantic_meaning_y,
      order_1: order1,
      order_2: order2,
      order_invariant_semantic_effect: orderInvariant ? "YES" : "NO",
      order_invariant_direction: orderInvariant ? order1Direction : "NONE"
    };
  });
  const orderInvariantScenarioCount = scenarioSummary.filter(
    (row) => row.order_invariant_semantic_effect === "YES"
  ).length;
  const aggregatePosition = positionMetric(trials);
  const positionByArm = Object.fromEntries(
    ARMS.map((arm) => [arm, positionMetric(trials, arm)])
  );
  const armDeviations = ARMS.map((arm) =>
    Number(
      (positionByArm[arm] as Record<string, unknown>)[
        "absolute_first_position_deviation"
      ] ?? 0
    )
  );
  const maximumObservedPositionDeviation = Math.max(
    Number(aggregatePosition.absolute_first_position_deviation ?? 0),
    ...armDeviations
  );
  const residualPositionBias =
    maximumObservedPositionDeviation >
    VERDICT_RULE.maximum_absolute_first_position_deviation;
  const experimentConfound =
    phaseA.artifacts.phase_a["scenario_balance_documentation"] !== "PASS" ||
    phaseA.artifacts.position_control_audit["all_pass"] !== true;
  const verdict = chooseVerdict({
    repair_justified: true,
    common_full_valid_units: commonFullValidUnits,
    treatment_minus_ablation_delta: delta,
    order_invariant_scenario_count: orderInvariantScenarioCount,
    residual_position_bias: residualPositionBias,
    experiment_confound: experimentConfound
  });

  const treatmentPairAll = pairMetric(trials, true);
  const ablationPairAll = pairMetric(trials, false);
  const actionValidity = Object.fromEntries(
    ARMS.map((arm) => [arm, armValidity(trials, arm)])
  );
  const orderSummary = ACTION_ORDERS.map((actionOrderId) => {
    const subset = trials.filter((trial) => trial.action_order_id === actionOrderId);
    return {
      action_order_id: actionOrderId,
      attempted_calls: subset.length,
      valid_calls: subset.filter((trial) => trial.status === "VALID").length,
      treatment_action_disagreement: pairMetric(subset, true),
      ablation_action_disagreement: pairMetric(subset, false),
      position_selection_aggregate: positionMetric(subset),
      position_selection_by_arm: Object.fromEntries(
        ARMS.map((arm) => [arm, positionMetric(subset, arm)])
      ),
      semantic_selection_distribution_by_arm: Object.fromEntries(
        ARMS.map((arm) => [arm, semanticDistribution(subset, arm)])
      )
    };
  });

  const positionSummary: Record<string, unknown> = {
    schema_version:
      "canonical-affect-action-selection-sensitivity-repair-position-summary-v0",
    aggregate: aggregatePosition,
    by_arm: positionByArm,
    by_scenario: Object.fromEntries(
      SCENARIOS.map((scenario) => [
        scenario.scenario_id,
        positionMetric(
          trials.filter((trial) => trial.scenario_id === scenario.scenario_id)
        )
      ])
    ),
    by_scenario_order_arm: Object.fromEntries(
      SCENARIOS.flatMap((scenario) =>
        ACTION_ORDERS.map((actionOrderId) => {
          const subset = trials.filter(
            (trial) =>
              trial.scenario_id === scenario.scenario_id &&
              trial.action_order_id === actionOrderId
          );
          return [
            `${scenario.scenario_id}/${actionOrderId}`,
            Object.fromEntries(
              ARMS.map((arm) => [arm, positionMetric(subset, arm)])
            )
          ];
        })
      )
    ),
    maximum_observed_absolute_deviation: maximumObservedPositionDeviation,
    maximum_allowed_absolute_deviation:
      VERDICT_RULE.maximum_absolute_first_position_deviation,
    residual_position_bias: residualPositionBias
  };

  const summary: Record<string, unknown> = {
    schema_version: "canonical-affect-action-selection-sensitivity-repair-summary-v0",
    experiment_version: EXPERIMENT_VERSION,
    verdict,
    repair_type: REPAIR_TYPE,
    scientific_question:
      "After neutralizing action labels, targets, scenario tradeoffs, and presentation balance, does canonical valence causally alter exact semantic action selection independent of list position?",
    provider: preflight,
    design: {
      scenarios: SCENARIOS.length,
      action_orders: ACTION_ORDERS.length,
      arms: ARMS.length,
      trials_per_arm_scenario_order: TRIALS_PER_ARM_SCENARIO_ORDER,
      planned_calls: PLANNED_REAL_CALLS,
      planned_matched_four_arm_units: MATCHED_FOUR_ARM_UNITS,
      magnitude: { ...REFERENCE_MAGNITUDE }
    },
    sample_size: {
      planned_calls: PLANNED_REAL_CALLS,
      attempted_calls: trials.length,
      valid_calls: trials.filter((trial) => trial.status === "VALID").length,
      failed_calls: trials.filter((trial) => trial.status !== "VALID").length,
      treatment_valid_pairs: treatmentPairAll.valid_pairs,
      ablation_valid_pairs: ablationPairAll.valid_pairs,
      common_full_valid_units: commonFullValidUnits,
      full_units_by_scenario: fullUnitsByScenario,
      full_units_by_action_order: fullUnitsByActionOrder
    },
    primary_semantic_action_disagreement: {
      treatment_disagreements: treatmentDisagreements,
      treatment_rate: treatmentRate,
      ablation_disagreements: ablationDisagreements,
      ablation_rate: ablationRate,
      treatment_minus_ablation_delta: delta,
      denominator_common_full_valid_units: commonFullValidUnits
    },
    semantic_action_shift: {
      order_invariant_scenario_count: orderInvariantScenarioCount,
      required_for_support: VERDICT_RULE.supported_minimum_order_invariant_scenarios,
      scenario_count: SCENARIOS.length
    },
    position_bias: positionSummary,
    action_validity: actionValidity,
    action_validity_differential: {
      model_action_not_allowed_a_minus_b:
        Number((actionValidity["A"] as Record<string, unknown>)["model_action_not_allowed"]) -
        Number((actionValidity["B"] as Record<string, unknown>)["model_action_not_allowed"]),
      model_action_not_allowed_negative_minus_ablated_background:
        Number((actionValidity["B"] as Record<string, unknown>)["model_action_not_allowed"]) -
        (Number((actionValidity["ABL_A"] as Record<string, unknown>)["model_action_not_allowed"]) +
          Number((actionValidity["ABL_B"] as Record<string, unknown>)["model_action_not_allowed"])) /
          2
    },
    current_intent_secondary: {
      treatment: endpointDisagreement(trials, "current_intent", true),
      ablation: endpointDisagreement(trials, "current_intent", false)
    },
    other_cognition_secondary: {
      confidence: {
        treatment: endpointDisagreement(trials, "confidence", true),
        ablation: endpointDisagreement(trials, "confidence", false)
      },
      uncertainty: {
        treatment: endpointDisagreement(trials, "uncertainty", true),
        ablation: endpointDisagreement(trials, "uncertainty", false)
      },
      reasoning_summary_length: {
        treatment: endpointDisagreement(trials, "reasoning_summary_length", true),
        ablation: endpointDisagreement(trials, "reasoning_summary_length", false)
      }
    },
    token_runtime_cost: {
      prompt_tokens: numericTotal(trials, "prompt_tokens"),
      completion_tokens: numericTotal(trials, "completion_tokens"),
      total_tokens: numericTotal(trials, "total_tokens"),
      total_latency_ms: trials.reduce((sum, trial) => sum + trial.latency_ms, 0),
      wall_clock_provider_cost_usd: null,
      cost_note: "Local Ollama execution; no priced remote API was used."
    },
    execution_boundaries: {
      real_cognition_calls: trials.length,
      real_language_calls: 0,
      evaluator_calls: 0,
      action_execution_calls: 0,
      condition_specific_retries: 0
    },
    verdict_rule: { ...VERDICT_RULE },
    claim_boundary: {
      canonical_affect_to_cognition: "ALREADY_REPLICATED_V0_V1",
      canonical_affect_to_structured_action_selection:
        "THIS_REPAIRED_EXPERIMENT_ONLY",
      activation_action_effect: "NOT_TESTED",
      model_generalization: "NOT_TESTED"
    }
  };

  const failures = trials.filter((trial) => trial.status !== "VALID");
  const failureSummary: Record<string, unknown> = {
    schema_version: "canonical-affect-action-selection-sensitivity-repair-failure-summary-v0",
    attempted_calls: trials.length,
    failed_calls: failures.length,
    by_status: Object.fromEntries(
      [
        "PROVIDER_ERROR",
        "TIMEOUT",
        "INVALID_SCHEMA",
        "VALIDATION_REJECTED",
        "STALE",
        "OTHER_RUNTIME_FAILURE"
      ].map((status) => [status, failures.filter((trial) => trial.status === status).length])
    ),
    model_action_not_allowed: failures.filter(
      (trial) => trial.failure?.code === "MODEL_ACTION_NOT_ALLOWED"
    ).length,
    failures: failures.map((trial) => ({
      trial_id: trial.trial_id,
      status: trial.status,
      validation_reason: trial.validation_reason,
      failure: trial.failure
    }))
  };
  return {
    summary,
    scenario_summary: scenarioSummary,
    order_summary: orderSummary,
    position_summary: positionSummary,
    failure_summary: failureSummary
  };
}
