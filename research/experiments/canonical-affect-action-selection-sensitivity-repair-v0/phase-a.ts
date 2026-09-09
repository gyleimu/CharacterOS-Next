/* eslint-disable no-restricted-imports, @typescript-eslint/no-non-null-assertion -- Isolated zero-call experiment harness over frozen built production roots. */

import type {
  AtomicCommitBundleAnyVersion,
  SubjectStateV4
} from "../../../packages/subject-core/dist/index.js";
import {
  InMemoryMemoryRepository,
  computeRepositoryRevisionHash
} from "../../../packages/memory/dist/index.js";
import {
  createSubjectStateV4AuthoritativeRestoreEnvelopeV0,
  restoreSubjectStateV4AuthoritativelyV0
} from "../../../packages/runtime/dist/authority/restore-chain-authority-v4.js";
import {
  mintTrustedCanonicalHistoryBoundaryV4V0
} from "../../../packages/runtime/dist/authority/trusted-canonical-history-boundary.js";
import {
  buildCognitiveContextProjectionV2ForExplicitV4
} from "../../../packages/runtime/dist/transitions/cognition-action/cognition-action-transition-executor.js";
import {
  validateAllowedActionSpaceV1
} from "../../../packages/runtime/dist/transitions/cognition-action/cognition-proposal-v1.js";
import { CURRENT_DIMENSIONS } from "../canonical-affect-behavior-influence-v1/contract.ts";
import {
  ablateProviderInput,
  buildWorld,
  constructArmHistory,
  containsPromiseLike,
  currentBindings,
  readSnapshot,
  recomputeProviderInputProjectionHash,
  runCognitionCapture,
  type HistoryProof,
  type World
} from "../canonical-affect-behavior-influence-v1/harness.ts";
import {
  canonicalJson,
  check,
  equal,
  hashJson,
  round
} from "../canonical-affect-behavior-influence-v1/fixtures.ts";
import {
  ABLATION_NEUTRAL_AFFECT,
  ACTION_ORDERS,
  ARMS,
  BASELINE_COMMIT,
  EXPERIMENT_VERSION,
  MATCHED_FOUR_ARM_UNITS,
  PLANNED_REAL_CALLS,
  REFERENCE_MAGNITUDE,
  REPAIR_TYPE,
  SCENARIOS,
  TRIALS_PER_ARM_SCENARIO_ORDER,
  actionsForOrder,
  frozenConfig,
  scenarioManifest,
  semanticActionLabels,
  type ActionOrderId,
  type Arm,
  type ScenarioRepairV0,
  type TreatmentArm
} from "./contract.ts";
import { buildRepairAnalysis } from "./forensics.ts";
import {
  auditOrderReversal,
  auditTreatmentPair,
  chooseVerdict
} from "./metrics.ts";

export interface ArmMetadata {
  readonly subject_state_hash: string;
  readonly current_event_ref: string;
  readonly current_appraisal_ref: string;
  readonly current_appraisal_dimensions: typeof CURRENT_DIMENSIONS;
  readonly history_proof: HistoryProof;
}

export interface PreparedCell {
  readonly scenario: ScenarioRepairV0;
  readonly action_order_id: ActionOrderId;
  readonly magnitude: typeof REFERENCE_MAGNITUDE;
  readonly allowed_actions: ReturnType<typeof actionsForOrder>;
  readonly semantic_action_labels: ReturnType<typeof semanticActionLabels>;
  readonly provider_inputs: Readonly<Record<Arm, unknown>>;
  readonly metadata: Readonly<Record<Arm, ArmMetadata>>;
}

interface BuiltTreatmentArm {
  readonly provider_inputs: Readonly<Record<ActionOrderId, unknown>>;
  readonly metadata: ArmMetadata;
  readonly canonical_affect: {
    readonly schema_version: string;
    readonly valence: number;
    readonly activation: number;
  };
}

export interface PhaseAArtifacts {
  readonly repair_analysis: Record<string, unknown>;
  readonly scenario_manifest: readonly Record<string, unknown>[];
  readonly config: Record<string, unknown>;
  readonly input_diff_audit: Record<string, unknown>;
  readonly position_control_audit: Record<string, unknown>;
  readonly history_construction: Record<string, unknown>;
  readonly restore_controls: Record<string, unknown>;
  readonly phase_a: Record<string, unknown>;
}

export interface PhaseAResult {
  readonly prepared: readonly PreparedCell[];
  readonly artifacts: PhaseAArtifacts;
}

const FORBIDDEN_SCENARIO_TERMS = Object.freeze([
  "happy",
  "sad",
  "angry",
  "anxious",
  "positive mood",
  "negative mood",
  "activated",
  "calm"
] as const);

const FORBIDDEN_ARM_MARKERS = Object.freeze([
  "condition=a",
  "condition=b",
  "abl_a",
  "abl_b",
  "treatment arm",
  "positive-valence arm",
  "negative-valence arm"
] as const);

function stringsIn(value: unknown): readonly string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(stringsIn);
  if (value !== null && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap(stringsIn);
  }
  return [];
}

function matchingMarkers(value: unknown, markers: readonly string[]): readonly string[] {
  const strings = stringsIn(value).map((item) => item.toLowerCase());
  return markers.filter((marker) => strings.some((item) => item.includes(marker))).sort();
}

function scenarioBalanceAudit(scenario: ScenarioRepairV0): Record<string, unknown> {
  const scenarioText = [scenario.current_factual_event, scenario.current_task];
  const forbiddenTerms = matchingMarkers(scenarioText, FORBIDDEN_SCENARIO_TERMS);
  const original = actionsForOrder(scenario, "ORDER_1");
  const reversed = actionsForOrder(scenario, "ORDER_2");
  const documented =
    scenario.why_x_is_plausible.trim().length > 0 &&
    scenario.why_y_is_plausible.trim().length > 0 &&
    scenario.balance_assertions.length === 8;
  const exactReversal = equal([...original].reverse(), reversed);
  return {
    scenario_id: scenario.scenario_id,
    why_x_is_plausible: scenario.why_x_is_plausible,
    why_y_is_plausible: scenario.why_y_is_plausible,
    balance_assertions: [...scenario.balance_assertions],
    balance_documented: documented,
    forbidden_affect_terms: forbiddenTerms,
    action_pair_distinct:
      !equal(scenario.semantic_action_x, scenario.semantic_action_y),
    exact_order_reversal: exactReversal,
    status:
      documented &&
      forbiddenTerms.length === 0 &&
      !equal(scenario.semantic_action_x, scenario.semantic_action_y) &&
      exactReversal
        ? "PASS"
        : "SCENARIO_BALANCE_FAILURE"
  };
}

function positionControlAudit(): Record<string, unknown> {
  const rows = SCENARIOS.map((scenario) => {
    const order1 = actionsForOrder(scenario, "ORDER_1");
    const order2 = actionsForOrder(scenario, "ORDER_2");
    const validated = validateAllowedActionSpaceV1(order1);
    const optionAIndex = scenario.current_factual_event.indexOf("OPTION_A");
    const optionBIndex = scenario.current_factual_event.indexOf("OPTION_B");
    const observedDescriptionOrder =
      optionAIndex < optionBIndex
        ? ["OPTION_A", "OPTION_B"]
        : ["OPTION_B", "OPTION_A"];
    const descriptionLengthDelta = Math.abs(
      scenario.option_a_description.length - scenario.option_b_description.length
    );
    const pass =
      validated.ok &&
      equal([...order1].reverse(), order2) &&
      equal(
        [...order1].map(canonicalJson).sort(),
        [...order2].map(canonicalJson).sort()
      ) &&
      equal(observedDescriptionOrder, scenario.description_order) &&
      descriptionLengthDelta <= 15 &&
      order1.every((entry) => entry.target_ref === null) &&
      scenario.semantic_action_x.action_type.length ===
        scenario.semantic_action_y.action_type.length;
    return {
      scenario_id: scenario.scenario_id,
      order_1: order1,
      order_2: order2,
      semantic_set_equal: equal(
        [...order1].map(canonicalJson).sort(),
        [...order2].map(canonicalJson).sort()
      ),
      exact_reverse: equal([...order1].reverse(), order2),
      machine_valid_aliases: validated.ok,
      neutral_aliases: order1.map((entry) => entry.action_type).sort(),
      equal_alias_length:
        scenario.semantic_action_x.action_type.length ===
        scenario.semantic_action_y.action_type.length,
      all_target_refs_null: order1.every((entry) => entry.target_ref === null),
      semantic_x_alias: scenario.semantic_action_x.action_type,
      semantic_x_described_first:
        scenario.description_order[0] === scenario.semantic_action_x.action_type,
      description_order: scenario.description_order,
      observed_description_order: observedDescriptionOrder,
      option_a_description_length: scenario.option_a_description.length,
      option_b_description_length: scenario.option_b_description.length,
      description_length_delta: descriptionLengthDelta,
      maximum_description_length_delta: 15,
      status: pass ? "PASS" : "FAIL"
    };
  });
  const semanticXAliasACount = SCENARIOS.filter(
    (scenario) => scenario.semantic_action_x.action_type === "OPTION_A"
  ).length;
  const semanticXDescribedFirstCount = SCENARIOS.filter(
    (scenario) =>
      scenario.description_order[0] === scenario.semantic_action_x.action_type
  ).length;
  const optionADescribedFirstCount = SCENARIOS.filter(
    (scenario) => scenario.description_order[0] === "OPTION_A"
  ).length;
  const crossScenarioPass =
    semanticXAliasACount === 2 &&
    semanticXDescribedFirstCount === 2 &&
    optionADescribedFirstCount === 2;
  return {
    schema_version:
      "canonical-affect-action-selection-sensitivity-repair-position-control-audit-v0",
    repair_type: REPAIR_TYPE,
    real_provider_generation_calls: 0,
    rows,
    cross_scenario_balance: {
      semantic_x_mapped_to_option_a: semanticXAliasACount,
      semantic_x_mapped_to_option_b: SCENARIOS.length - semanticXAliasACount,
      semantic_x_described_first: semanticXDescribedFirstCount,
      semantic_x_described_second:
        SCENARIOS.length - semanticXDescribedFirstCount,
      option_a_described_first: optionADescribedFirstCount,
      option_b_described_first: SCENARIOS.length - optionADescribedFirstCount,
      status: crossScenarioPass ? "PASS" : "FAIL"
    },
    all_pass:
      crossScenarioPass && rows.every((row) => row["status"] === "PASS")
  };
}

async function buildTreatmentArm(
  scenario: ScenarioRepairV0,
  arm: TreatmentArm
): Promise<BuiltTreatmentArm> {
  const world = await buildWorld(scenario.current_task);
  const history = await constructArmHistory(
    world,
    arm,
    scenario,
    REFERENCE_MAGNITUDE
  );
  const captures = {} as Record<ActionOrderId, unknown>;
  for (const actionOrderId of ACTION_ORDERS) {
    const allowedActions = actionsForOrder(scenario, actionOrderId);
    const capture = await runCognitionCapture(world, allowedActions);
    const projection = capture.provider_input as {
      readonly canonical_affect: BuiltTreatmentArm["canonical_affect"];
      readonly context: {
        readonly task: string | null;
        readonly current_observation_ref: string | null;
      };
      readonly allowed_actions: unknown;
      readonly projection_hash: string;
    };
    check(
      projection.context.task === scenario.current_task,
      `${scenario.scenario_id}/${actionOrderId}/${arm}: task not projected`
    );
    check(
      projection.context.current_observation_ref === history.current_observation_ref,
      `${scenario.scenario_id}/${actionOrderId}/${arm}: current observation mismatch`
    );
    check(
      equal(projection.allowed_actions, allowedActions),
      `${scenario.scenario_id}/${actionOrderId}/${arm}: action order mismatch`
    );
    check(
      !containsPromiseLike(projection),
      `${scenario.scenario_id}/${actionOrderId}/${arm}: Promise leaked into provider input`
    );
    captures[actionOrderId] = capture.provider_input;
  }
  const snapshot = await readSnapshot(world);
  const rebuilt = await buildCognitiveContextProjectionV2ForExplicitV4(snapshot);
  const original = captures.ORDER_1 as {
    readonly canonical_affect: BuiltTreatmentArm["canonical_affect"];
    readonly projection_hash: string;
  };
  check(
    original.projection_hash === rebuilt.projection_hash,
    `${scenario.scenario_id}/${arm}: projection hash differs from production builder`
  );
  return {
    provider_inputs: captures,
    metadata: {
      subject_state_hash: hashJson(snapshot),
      current_event_ref: history.current_event_ref,
      current_appraisal_ref: history.current_appraisal_ref,
      current_appraisal_dimensions: { ...CURRENT_DIMENSIONS },
      history_proof: history
    },
    canonical_affect: { ...original.canonical_affect }
  };
}

function affectMatches(
  affect: BuiltTreatmentArm["canonical_affect"],
  arm: TreatmentArm
): boolean {
  const expectedValence =
    arm === "A"
      ? REFERENCE_MAGNITUDE.target_absolute_valence
      : -REFERENCE_MAGNITUDE.target_absolute_valence;
  return (
    round(affect.valence) === expectedValence &&
    round(affect.activation) === REFERENCE_MAGNITUDE.expected_final_activation
  );
}

async function cloneRepository(world: World): Promise<InMemoryMemoryRepository> {
  const fresh = new InMemoryMemoryRepository();
  await fresh.prepareRevision({ parent_revision: null as never, records: [] });
  for (const revision of world.repo.revisionIds()) {
    if (revision === "R0") continue;
    const manifest = await world.repo.readManifest(revision);
    check(manifest !== null, `manifest ${revision} missing during restore clone`);
    const records = [];
    for (const entry of manifest!.record_hashes) {
      const payload = world.repo.readStoredPayload(entry.ref as never);
      check(payload !== undefined, `${entry.ref}: payload missing during restore clone`);
      records.push({
        ref: entry.ref,
        payload_hash: await fresh.storePayload(entry.ref as never, payload)
      });
    }
    await fresh.prepareRevision({
      parent_revision: manifest!.parent_revision as never,
      records: records as never
    });
  }
  return fresh;
}

/** One treatment-arm provider-input equality proof across authoritative restore. */
async function restoreControl(): Promise<Record<string, unknown>> {
  const scenario = SCENARIOS[0]!;
  const allowedActions = actionsForOrder(scenario, "ORDER_1");
  const world = await buildWorld(scenario.current_task);
  const history = await constructArmHistory(
    world,
    "A",
    scenario,
    REFERENCE_MAGNITUDE
  );
  const before = (await runCognitionCapture(world, allowedActions)).provider_input;
  const bundles = world.assembly.storeRead
    .getCommittedBundles()
    .filter((bundle) => bundle.subject_id === "subject-s0") as unknown as readonly AtomicCommitBundleAnyVersion[];
  const headBundle = bundles.at(-1);
  check(headBundle !== undefined, "restore head bundle must exist");
  const head = {
    schema_version: "trusted-canonical-head-v0",
    subject_id: headBundle.subject_id,
    revision: headBundle.next_revision,
    commit_ref: headBundle.commit_ref,
    record_checksum: headBundle.record_checksum,
    state_hash: headBundle.state_hash_after,
    snapshot_hash: headBundle.snapshot_hash_after
  };
  const minted = await mintTrustedCanonicalHistoryBoundaryV4V0({
    genesis: world.genesis.envelope,
    head: head as never,
    reference_validator: async (binding) => {
      const manifest = await world.repo.readManifest(binding.repository_revision);
      return (
        manifest !== null &&
        (await computeRepositoryRevisionHash(manifest)) ===
          binding.repository_revision_hash
      );
    }
  });
  check(minted.kind === "MINTED", `restore boundary mint failed: ${minted.kind}`);
  const headBinding = (
    await currentBindings(
      world.repo,
      headBundle.next_snapshot as unknown as SubjectStateV4
    )
  )[0];
  check(headBinding !== undefined, "restore repository binding missing");
  const envelope = await createSubjectStateV4AuthoritativeRestoreEnvelopeV0({
    snapshot: headBundle.next_snapshot as unknown as SubjectStateV4,
    commit_head: head as never,
    repository_binding: headBinding as never
  });
  const freshRepo = await cloneRepository(world);
  const restored = await restoreSubjectStateV4AuthoritativelyV0({
    envelope: envelope as never,
    trusted_boundary: minted.receipt,
    bundles,
    reference_validator: async (binding) =>
      freshRepo.validateRevisionBinding(binding as never)
  });
  check(restored.kind === "RESTORED", `restore failed: ${restored.kind}`);
  const baseProjection = await buildCognitiveContextProjectionV2ForExplicitV4(
    restored.snapshot
  );
  const after = { ...baseProjection, allowed_actions: allowedActions };
  const identical = equal(before, after);
  check(identical, "pre/post authoritative restore provider input differs");
  return {
    scenario_id: scenario.scenario_id,
    action_order_id: "ORDER_1",
    arm: "A",
    current_event_ref: history.current_event_ref,
    input_before_hash: hashJson(before),
    input_after_hash: hashJson(after),
    provider_facing_input_identical: identical,
    input_before: before,
    input_after: after
  };
}

/** Runs all Phase-A gates with exactly zero real-provider calls. */
export async function executePhaseA(): Promise<PhaseAResult> {
  const repairAnalysis = buildRepairAnalysis();
  check(
    (repairAnalysis["repair_decision"] as Record<string, unknown>)[
      "chosen_repair_type"
    ] === REPAIR_TYPE,
    "Phase R0 repair decision mismatch"
  );
  const balanceRows = SCENARIOS.map(scenarioBalanceAudit);
  check(
    balanceRows.every((row) => row["status"] === "PASS"),
    "SCENARIO_BALANCE_FAILURE"
  );

  const prepared: PreparedCell[] = [];
  const auditRows: Record<string, unknown>[] = [];
  const orderRows: Record<string, unknown>[] = [];
  const historyRows: Record<string, unknown>[] = [];
  let asyncHashRegressionPass = true;

  for (const scenario of SCENARIOS) {
    const a = await buildTreatmentArm(scenario, "A");
    const b = await buildTreatmentArm(scenario, "B");
    check(
      affectMatches(a.canonical_affect, "A"),
      `${scenario.scenario_id}: arm A lawful VA mismatch ${canonicalJson(a.canonical_affect)}`
    );
    check(
      affectMatches(b.canonical_affect, "B"),
      `${scenario.scenario_id}: arm B lawful VA mismatch ${canonicalJson(b.canonical_affect)}`
    );
    check(
      round(a.canonical_affect.activation) === round(b.canonical_affect.activation),
      `${scenario.scenario_id}: treatment activation mismatch`
    );
    check(
      a.metadata.current_event_ref === b.metadata.current_event_ref,
      `${scenario.scenario_id}: current event differs`
    );
    check(
      equal(
        a.metadata.current_appraisal_dimensions,
        b.metadata.current_appraisal_dimensions
      ),
      `${scenario.scenario_id}: current Appraisal dimensions differ`
    );

    const orderAudits = {
      A: auditOrderReversal(a.provider_inputs.ORDER_1, a.provider_inputs.ORDER_2),
      B: auditOrderReversal(b.provider_inputs.ORDER_1, b.provider_inputs.ORDER_2)
    };
    check(
      orderAudits.A.reversal_only && orderAudits.B.reversal_only,
      `${scenario.scenario_id}: order reversal changed more than allowed_actions order`
    );
    orderRows.push({
      scenario_id: scenario.scenario_id,
      treatment_arm_a: orderAudits.A,
      treatment_arm_b: orderAudits.B,
      status: "PASS"
    });

    for (const actionOrderId of ACTION_ORDERS) {
      const allowedActions = actionsForOrder(scenario, actionOrderId);
      const inputA = a.provider_inputs[actionOrderId];
      const inputB = b.provider_inputs[actionOrderId];
      const treatmentAudit = auditTreatmentPair(inputA, inputB);
      check(
        treatmentAudit.non_affect_provider_input_equal,
        `${scenario.scenario_id}/${actionOrderId}: EXPERIMENT_CONFOUND_DETECTED: ${treatmentAudit.differing_fields.join(", ")}`
      );
      const ablA = await ablateProviderInput(inputA);
      const ablB = await ablateProviderInput(inputB);
      check(
        equal(ablA, ablB),
        `${scenario.scenario_id}/${actionOrderId}: ablated provider inputs differ`
      );
      const ablatedHash = (ablA as { readonly projection_hash: unknown })
        .projection_hash;
      const resolvedHash =
        typeof ablatedHash === "string" && /^sha256:[0-9a-f]{64}$/.test(ablatedHash);
      const hashMatches =
        ablatedHash === (await recomputeProviderInputProjectionHash(ablA));
      const promiseLeakAbsent =
        !containsPromiseLike(ablA) && !containsPromiseLike(ablB);
      asyncHashRegressionPass =
        asyncHashRegressionPass && resolvedHash && hashMatches && promiseLeakAbsent;
      check(
        resolvedHash && hashMatches && promiseLeakAbsent,
        `${scenario.scenario_id}/${actionOrderId}: projection-hash await regression`
      );
      const markers = [
        ...new Set([
          ...matchingMarkers(inputA, FORBIDDEN_ARM_MARKERS),
          ...matchingMarkers(inputB, FORBIDDEN_ARM_MARKERS),
          ...matchingMarkers(ablA, FORBIDDEN_ARM_MARKERS),
          ...matchingMarkers(ablB, FORBIDDEN_ARM_MARKERS)
        ])
      ].sort();
      check(
        markers.length === 0,
        `${scenario.scenario_id}/${actionOrderId}: hidden arm marker leaked`
      );
      const projectedActionSpaces = [inputA, inputB, ablA, ablB].map(
        (input) => (input as Record<string, unknown>)["allowed_actions"]
      );
      check(
        projectedActionSpaces.every((space) => equal(space, allowedActions)),
        `${scenario.scenario_id}/${actionOrderId}: action-space equality failed`
      );

      const metadata: Record<Arm, ArmMetadata> = {
        A: a.metadata,
        B: b.metadata,
        ABL_A: a.metadata,
        ABL_B: b.metadata
      };
      prepared.push({
        scenario,
        action_order_id: actionOrderId,
        magnitude: REFERENCE_MAGNITUDE,
        allowed_actions: allowedActions,
        semantic_action_labels: semanticActionLabels(scenario),
        provider_inputs: {
          A: inputA,
          B: inputB,
          ABL_A: ablA,
          ABL_B: ablB
        },
        metadata
      });
      auditRows.push({
        scenario_id: scenario.scenario_id,
        action_order_id: actionOrderId,
        differing_fields: treatmentAudit.differing_fields,
        non_affect_provider_input_equal: true,
        activation_match: true,
        current_event_equal: true,
        current_appraisal_dimensions_equal: true,
        current_appraisal_refs_equal:
          a.metadata.current_appraisal_ref === b.metadata.current_appraisal_ref,
        current_appraisal_ref_note:
          "Appraisal dimensions and current factual event are identical; content-addressed refs may differ because prior lawful history differs and refs are not provider-facing.",
        current_appraisal_ref_a: a.metadata.current_appraisal_ref,
        current_appraisal_ref_b: b.metadata.current_appraisal_ref,
        action_space_equal_across_all_arms: true,
        action_space: allowedActions,
        ablated_inputs_identical: true,
        ablation_projection_hash_resolved_string: resolvedHash,
        ablation_projection_hash_matches_recomputation: hashMatches,
        promise_or_stringification_leak_absent: promiseLeakAbsent,
        hidden_arm_labels_present: markers,
        provider_input_a: inputA,
        provider_input_b: inputB,
        provider_input_abl_a: ablA,
        provider_input_abl_b: ablB
      });
    }

    historyRows.push(
      {
        scenario_id: scenario.scenario_id,
        magnitude_id: REFERENCE_MAGNITUDE.magnitude_id,
        arm: "A",
        final_canonical_affect: a.canonical_affect,
        subject_state_hash: a.metadata.subject_state_hash,
        ...a.metadata.history_proof
      },
      {
        scenario_id: scenario.scenario_id,
        magnitude_id: REFERENCE_MAGNITUDE.magnitude_id,
        arm: "B",
        final_canonical_affect: b.canonical_affect,
        subject_state_hash: b.metadata.subject_state_hash,
        ...b.metadata.history_proof
      }
    );
  }

  const restoreRow = await restoreControl();
  const positionAudit = positionControlAudit();
  check(positionAudit["all_pass"] === true, "position-control audit failed");
  const metricSelfTest = {
    supported:
      chooseVerdict({
        repair_justified: true,
        common_full_valid_units: 40,
        treatment_minus_ablation_delta: 0.25,
        order_invariant_scenario_count: 3,
        residual_position_bias: false,
        experiment_confound: false
      }) === "ACTION_SELECTION_SENSITIVITY_REPAIR_SUPPORTED",
    not_supported:
      chooseVerdict({
        repair_justified: true,
        common_full_valid_units: 40,
        treatment_minus_ablation_delta: 0.1,
        order_invariant_scenario_count: 0,
        residual_position_bias: false,
        experiment_confound: false
      }) === "ACTION_SELECTION_SENSITIVITY_REPAIR_NOT_SUPPORTED",
    inconclusive:
      chooseVerdict({
        repair_justified: true,
        common_full_valid_units: 35,
        treatment_minus_ablation_delta: 0.5,
        order_invariant_scenario_count: 4,
        residual_position_bias: false,
        experiment_confound: false
      }) === "ACTION_SELECTION_SENSITIVITY_REPAIR_INCONCLUSIVE",
    no_repair:
      chooseVerdict({
        repair_justified: false,
        common_full_valid_units: 40,
        treatment_minus_ablation_delta: 0,
        order_invariant_scenario_count: 0,
        residual_position_bias: false,
        experiment_confound: false
      }) === "EXPERIMENT_REPAIR_NOT_JUSTIFIED",
    confound:
      chooseVerdict({
        repair_justified: true,
        common_full_valid_units: 40,
        treatment_minus_ablation_delta: 0,
        order_invariant_scenario_count: 0,
        residual_position_bias: false,
        experiment_confound: true
      }) === "EXPERIMENT_CONFOUND_DETECTED"
  };
  check(
    Object.values(metricSelfTest).every(Boolean),
    "metric/verdict implementation self-test failed"
  );
  check(
    prepared.length === SCENARIOS.length * ACTION_ORDERS.length,
    "prepared cell count mismatch"
  );
  check(PLANNED_REAL_CALLS === 160, "planned real call count must remain 160");
  check(MATCHED_FOUR_ARM_UNITS === 40, "matched unit count must remain 40");

  const artifacts: PhaseAArtifacts = {
    repair_analysis: repairAnalysis,
    scenario_manifest: scenarioManifest(),
    config: frozenConfig(),
    input_diff_audit: {
      schema_version: "canonical-affect-action-selection-sensitivity-repair-input-audit-v0",
      experiment_version: EXPERIMENT_VERSION,
      treatment_rows: auditRows,
      order_reversal_rows: orderRows,
      all_pass: true
    },
    position_control_audit: positionAudit,
    history_construction: {
      schema_version: "canonical-affect-action-selection-sensitivity-repair-history-proof-v0",
      experiment_version: EXPERIMENT_VERSION,
      production_path_only: true,
      direct_state_assignment: false,
      rows: historyRows
    },
    restore_controls: {
      schema_version: "canonical-affect-action-selection-sensitivity-repair-restore-controls-v0",
      rows: [restoreRow],
      all_pass: restoreRow["provider_facing_input_identical"] === true
    },
    phase_a: {
      schema_version: "canonical-affect-action-selection-sensitivity-repair-phase-a-v0",
      experiment_version: EXPERIMENT_VERSION,
      baseline_commit: BASELINE_COMMIT,
      repair_type: REPAIR_TYPE,
      real_provider_calls: 0,
      scenario_count: SCENARIOS.length,
      action_order_count: ACTION_ORDERS.length,
      arm_count: ARMS.length,
      trials_per_arm_scenario_order: TRIALS_PER_ARM_SCENARIO_ORDER,
      prepared_four_arm_cells: prepared.length,
      matched_four_arm_units: MATCHED_FOUR_ARM_UNITS,
      planned_real_calls: PLANNED_REAL_CALLS,
      lawful_affect_construction: "PASS",
      activation_equality: "PASS",
      current_event_equality: "PASS",
      current_appraisal_equality: "PASS",
      non_affect_provider_input_equality: "PASS",
      ablation_equality: "PASS",
      action_space_equality: "PASS",
      action_order_reversal_only: "PASS",
      neutral_action_aliases_machine_valid: "PASS",
      target_ref_symmetry: "PASS",
      cross_scenario_alias_balance: "PASS",
      cross_scenario_description_order_balance: "PASS",
      phase_r0_forensics: "PASS",
      scenario_balance_documentation: "PASS",
      projection_hash_await_regression:
        asyncHashRegressionPass ? "PASS" : "FAIL",
      restore_control:
        restoreRow["provider_facing_input_identical"] === true ? "PASS" : "FAIL",
      metric_and_verdict_implementation: Object.values(metricSelfTest).every(Boolean)
        ? "PASS"
        : "FAIL",
      metric_self_test: metricSelfTest,
      scenario_balance_audit: balanceRows,
      arms: [...ARMS],
      neutral_affect: { ...ABLATION_NEUTRAL_AFFECT },
      all_pass:
        asyncHashRegressionPass &&
        restoreRow["provider_facing_input_identical"] === true &&
        positionAudit["all_pass"] === true &&
        Object.values(metricSelfTest).every(Boolean) &&
        balanceRows.every((row) => row["status"] === "PASS")
    }
  };
  check(artifacts.phase_a["all_pass"] === true, "Phase A failed");
  return { prepared, artifacts };
}
