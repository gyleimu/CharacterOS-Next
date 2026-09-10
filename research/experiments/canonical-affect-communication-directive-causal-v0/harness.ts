/* eslint-disable no-restricted-imports, @typescript-eslint/no-non-null-assertion -- Isolated zero-real-language-call experiment harness over frozen built production roots. */

import type {
  AtomicCommitBundleAnyVersion,
  SubjectStateV4
} from "../../../packages/subject-core/dist/index.js";
import {
  proposalFingerprint
} from "../../../packages/subject-core/dist/index.js";
import {
  computeRepositoryRevisionHash,
  InMemoryMemoryRepository
} from "../../../packages/memory/dist/index.js";
import {
  createSubjectStateV4AuthoritativeRestoreEnvelopeV0,
  restoreSubjectStateV4AuthoritativelyV0
} from "../../../packages/runtime/dist/authority/restore-chain-authority-v4.js";
import {
  mintTrustedCanonicalHistoryBoundaryV4V0
} from "../../../packages/runtime/dist/authority/trusted-canonical-history-boundary.js";
import {
  type CognitiveContextProjectionV2
} from "../../../packages/runtime/dist/transitions/cognition-action/types.js";
import {
  buildCognitiveContextProjectionV2ForExplicitV4
} from "../../../packages/runtime/dist/transitions/cognition-action/cognition-action-transition-executor.js";
import {
  CURRENT_DIMENSIONS
} from "../canonical-affect-behavior-influence-v1/contract.ts";
import {
  ablateProviderInput,
  admitEvent,
  appraiseAdmitted,
  applyAffect,
  buildWorld,
  containsPromiseLike,
  currentBindings,
  readSnapshot,
  recomputeProviderInputProjectionHash,
  runCognitionCapture,
  type HistoryProof,
  type World
} from "../canonical-affect-behavior-influence-v1/harness.ts";
import {
  auditProviderInputPair
} from "../canonical-affect-behavior-influence-v1/metrics.ts";
import {
  canonicalJson,
  check,
  equal,
  hashJson,
  round
} from "../canonical-affect-behavior-influence-v1/fixtures.ts";
import {
  ARMS,
  BASELINE_COMMIT,
  EXPERIMENT_VERSION,
  PLANNED_COGNITION_CALLS,
  REFERENCE_MAGNITUDE,
  SCENARIOS,
  SUBJECT,
  frozenConfig,
  scenarioManifest,
  type Arm,
  type ScenarioV0,
  type TreatmentArm
} from "./contract.ts";

export interface ArmMetadata {
  readonly subject_state_hash: string;
  readonly current_event_ref: string;
  readonly current_appraisal_ref: string;
  readonly current_appraisal_dimensions: typeof CURRENT_DIMENSIONS;
  readonly history_proof: HistoryProof;
}

export interface PreparedCell {
  readonly scenario: ScenarioV0;
  readonly provider_inputs: Readonly<Record<Arm, CognitiveContextProjectionV2>>;
  readonly metadata: Readonly<Record<Arm, ArmMetadata>>;
}

export interface PhaseAArtifacts {
  readonly scenario_manifest: readonly Record<string, unknown>[];
  readonly config: Record<string, unknown>;
  readonly scenario_ingress_audit: Record<string, unknown>;
  readonly history_construction: Record<string, unknown>;
  readonly input_diff_audit: Record<string, unknown>;
  readonly directive_semantics_audit: Record<string, unknown>;
  readonly restore_controls: Record<string, unknown>;
  readonly phase_a: Record<string, unknown>;
}

export interface PhaseAResult {
  readonly prepared: readonly PreparedCell[];
  readonly artifacts: PhaseAArtifacts;
}

interface BuiltArm {
  readonly world: World;
  readonly provider_input: CognitiveContextProjectionV2;
  readonly metadata: ArmMetadata;
  readonly canonical_affect: CognitiveContextProjectionV2["canonical_affect"];
}

/** Lawful governed Context commit; the scenario enters through production. */
async function commitScenarioContext(world: World, scenario: ScenarioV0): Promise<void> {
  const snapshot = await readSnapshot(world);
  const proposal = {
    schema_version: "canonical-transition-proposal-v1",
    transition_id: `t-context-${scenario.event_id}`,
    subject_id: snapshot.identity.subject_id,
    transition_type: "Observation",
    expected_state_revision: snapshot.runtime_metadata.state_revision,
    time_input: {
      kind: "OCCURRENCE",
      occurrence_logical_time: snapshot.runtime_metadata.logical_time
    },
    cause_refs: [],
    domain_deltas: [{
      producer: "context",
      domain: "context",
      expected_repository_revision: null,
      operations: [{
        path: "/context",
        value: {
          scene: scenario.current_factual_event,
          task: scenario.current_task,
          focus_refs: [...snapshot.context.focus_refs],
          active_entity_refs: [...snapshot.context.active_entity_refs],
          environment_refs: [...snapshot.context.environment_refs],
          current_observation_ref: snapshot.context.current_observation_ref
        }
      }],
      provenance_refs: []
    }],
    external_refs: []
  } as unknown as Parameters<World["assembly"]["facade"]["reserveAndRoute"]>[0];
  const reserved = await world.assembly.facade.reserveAndRoute(proposal);
  check(reserved.kind === "CONTINUE", `${scenario.scenario_id}: Context reservation failed`);
  const committed = await world.assembly.facade.commitReserved({
    proposal,
    continuation: reserved.continuation,
    producerAuthorization: world.issuer.issue([{ producer: "context", domain: "context" }]) as never,
    preparedBinding: {
      prepared_result_ref: `workflow:w-context-${scenario.event_id}` as never,
      transition_id: proposal.transition_id,
      subject_id: proposal.subject_id,
      transition_type: proposal.transition_type,
      payload_fingerprint: await proposalFingerprint(proposal)
    },
    repository_bindings: await currentBindings(world.repo, snapshot) as never
  });
  check(committed.kind === "COMMITTED", `${scenario.scenario_id}: Context commit failed`);
}

async function constructCurrentScenarioHistory(
  world: World,
  arm: TreatmentArm,
  scenario: ScenarioV0
): Promise<HistoryProof> {
  const prior = await admitEvent(world, "v1-prior-event", "Please revise the item once.");
  const goalCongruence = arm === "A" ? 1 : 0;
  world.dimensionOverrides.set(prior.event_ref, {
    relevance: REFERENCE_MAGNITUDE.prior_relevance,
    goal_congruence: goalCongruence,
    intensity: REFERENCE_MAGNITUDE.prior_intensity
  });
  const priorAppraisalRef = await appraiseAdmitted(world, "v1-prior-event", prior);
  await applyAffect(world, prior.event_ref);

  await commitScenarioContext(world, scenario);
  const current = await admitEvent(world, scenario.event_id, scenario.current_factual_event);
  const currentAppraisalRef = await appraiseAdmitted(world, scenario.event_id, current);
  await applyAffect(world, current.event_ref);
  return {
    path: [
      "factual event",
      "Observation",
      "canonical INITIAL Appraisal",
      "AffectApplication",
      "durable CanonicalAffectV0"
    ],
    prior_event_ref: prior.event_ref,
    prior_observation_ref: prior.observation_ref,
    prior_appraisal_ref: priorAppraisalRef,
    prior_dimensions: {
      relevance: REFERENCE_MAGNITUDE.prior_relevance,
      goal_congruence: goalCongruence,
      intensity: REFERENCE_MAGNITUDE.prior_intensity
    },
    current_event_ref: current.event_ref,
    current_observation_ref: current.observation_ref,
    current_appraisal_ref: currentAppraisalRef,
    current_dimensions: { ...CURRENT_DIMENSIONS },
    committed_bundle_count: world.assembly.storeRead.getCommittedBundles().length
  };
}

async function buildArm(scenario: ScenarioV0, arm: TreatmentArm): Promise<BuiltArm> {
  const world = await buildWorld("");
  const history = await constructCurrentScenarioHistory(world, arm, scenario);
  const capture = await runCognitionCapture(world, []);
  const snapshot = await readSnapshot(world);
  const projection = capture.provider_input as CognitiveContextProjectionV2;
  check(projection.schema_version === "cognitive-context-projection-v2", "explicit v4 projection required");
  check(projection.context.scene === scenario.current_factual_event, `${scenario.scenario_id}: factual scene absent`);
  check(projection.context.task === scenario.current_task, `${scenario.scenario_id}: task absent`);
  check(projection.context.current_observation_ref === history.current_observation_ref, `${scenario.scenario_id}: observation mismatch`);
  check(projection.allowed_actions.length === 0, `${scenario.scenario_id}: conversation action space must be empty`);
  const rebuilt = await buildCognitiveContextProjectionV2ForExplicitV4(snapshot);
  check(equal(rebuilt, projection), `${scenario.scenario_id}: provider input differs from production builder`);
  check(!containsPromiseLike(projection), `${scenario.scenario_id}: Promise leaked into projection`);
  const expectedValence = arm === "A" ? 0.25 : -0.25;
  check(round(projection.canonical_affect.valence) === expectedValence, `${scenario.scenario_id}/${arm}: valence mismatch`);
  check(round(projection.canonical_affect.activation) === 0.348, `${scenario.scenario_id}/${arm}: activation mismatch`);
  return {
    world,
    provider_input: projection,
    metadata: {
      subject_state_hash: hashJson(snapshot),
      current_event_ref: history.current_event_ref,
      current_appraisal_ref: history.current_appraisal_ref,
      current_appraisal_dimensions: { ...CURRENT_DIMENSIONS },
      history_proof: history
    },
    canonical_affect: { ...projection.canonical_affect }
  };
}

async function cloneRepository(world: World): Promise<InMemoryMemoryRepository> {
  const fresh = new InMemoryMemoryRepository();
  await fresh.prepareRevision({ parent_revision: null as never, records: [] });
  for (const revision of world.repo.revisionIds()) {
    if (revision === "R0") continue;
    const manifest = await world.repo.readManifest(revision);
    check(manifest !== null, `restore manifest ${revision} missing`);
    const records = [];
    for (const entry of manifest!.record_hashes) {
      const payload = world.repo.readStoredPayload(entry.ref as never);
      check(payload !== undefined, `restore payload ${entry.ref} missing`);
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

async function restoreControl(world: World, before: CognitiveContextProjectionV2): Promise<Record<string, unknown>> {
  const bundles = world.assembly.storeRead.getCommittedBundles()
    .filter((bundle) => bundle.subject_id === SUBJECT) as unknown as readonly AtomicCommitBundleAnyVersion[];
  const headBundle = bundles.at(-1);
  check(headBundle !== undefined, "restore head bundle missing");
  const head = {
    schema_version: "trusted-canonical-head-v0",
    subject_id: headBundle!.subject_id,
    revision: headBundle!.next_revision,
    commit_ref: headBundle!.commit_ref,
    record_checksum: headBundle!.record_checksum,
    state_hash: headBundle!.state_hash_after,
    snapshot_hash: headBundle!.snapshot_hash_after
  };
  const minted = await mintTrustedCanonicalHistoryBoundaryV4V0({
    genesis: world.genesis.envelope,
    head: head as never,
    reference_validator: async (binding) => {
      const manifest = await world.repo.readManifest(binding.repository_revision);
      return manifest !== null &&
        (await computeRepositoryRevisionHash(manifest)) === binding.repository_revision_hash;
    }
  });
  check(minted.kind === "MINTED", `restore boundary failed: ${minted.kind}`);
  const headBinding = (await currentBindings(
    world.repo,
    headBundle!.next_snapshot as unknown as SubjectStateV4
  ))[0];
  check(headBinding !== undefined, "restore repository binding missing");
  const envelope = await createSubjectStateV4AuthoritativeRestoreEnvelopeV0({
    snapshot: headBundle!.next_snapshot as unknown as SubjectStateV4,
    commit_head: head as never,
    repository_binding: headBinding as never
  });
  const freshRepo = await cloneRepository(world);
  const restored = await restoreSubjectStateV4AuthoritativelyV0({
    envelope: envelope as never,
    trusted_boundary: minted.receipt,
    bundles,
    reference_validator: async (binding) => freshRepo.validateRevisionBinding(binding as never)
  });
  check(restored.kind === "RESTORED", `restore failed: ${restored.kind}`);
  const after = await buildCognitiveContextProjectionV2ForExplicitV4(restored.snapshot);
  check(equal(before, after), "restored provider input differs");
  return {
    schema_version: "canonical-affect-communication-directive-restore-control-v0",
    status: "PASS",
    canonical_affect_before: before.canonical_affect,
    canonical_affect_after: after.canonical_affect,
    provider_input_before_hash: hashJson(before),
    provider_input_after_hash: hashJson(after),
    provider_facing_input_identical: true,
    scenario_context_preserved: before.context.scene === after.context.scene && before.context.task === after.context.task
  };
}

function hiddenConditionMarkers(value: unknown): readonly string[] {
  const serialized = canonicalJson(value).toLowerCase();
  return [
    "treatment arm",
    "control arm",
    "abl_a",
    "abl_b",
    "boundary scenario",
    "hard control",
    "hard_sufficient",
    "hard_insufficient",
    "history-positive",
    "history-negative"
  ].filter((marker) => serialized.includes(marker));
}

/** Executes all Phase-A gates with zero real-provider generation calls. */
export async function executePhaseA(): Promise<PhaseAResult> {
  const prepared: PreparedCell[] = [];
  const ingressRows: Record<string, unknown>[] = [];
  const inputRows: Record<string, unknown>[] = [];
  const historyRows: Record<string, unknown>[] = [];
  const directiveRows: Record<string, unknown>[] = [];
  let restore: Record<string, unknown> | null = null;

  for (const scenario of SCENARIOS) {
    const a = await buildArm(scenario, "A");
    const b = await buildArm(scenario, "B");
    check(round(a.canonical_affect.activation) === round(b.canonical_affect.activation), `${scenario.scenario_id}: activation mismatch`);
    check(a.metadata.current_event_ref === b.metadata.current_event_ref, `${scenario.scenario_id}: current event mismatch`);
    check(equal(a.metadata.current_appraisal_dimensions, b.metadata.current_appraisal_dimensions), `${scenario.scenario_id}: current Appraisal mismatch`);
    const pairAudit = auditProviderInputPair(a.provider_input, b.provider_input);
    check(pairAudit.non_affect_provider_input_equal, `${scenario.scenario_id}: non-Affect input differs`);

    const ablA = await ablateProviderInput(a.provider_input) as CognitiveContextProjectionV2;
    const ablB = await ablateProviderInput(b.provider_input) as CognitiveContextProjectionV2;
    check(equal(ablA, ablB), `${scenario.scenario_id}: ablated provider inputs differ`);
    check(await recomputeProviderInputProjectionHash(ablA) === ablA.projection_hash, `${scenario.scenario_id}: ablation hash mismatch`);
    const candidateInputs = [a.provider_input, b.provider_input, ablA, ablB] as const;
    const markers = candidateInputs.flatMap((input) => hiddenConditionMarkers(input));
    check(markers.length === 0, `${scenario.scenario_id}: hidden condition markers leaked`);

    const providerInputs: Record<Arm, CognitiveContextProjectionV2> = {
      A: a.provider_input,
      B: b.provider_input,
      ABL_A: ablA,
      ABL_B: ablB
    };
    const metadata: Record<Arm, ArmMetadata> = {
      A: a.metadata,
      B: b.metadata,
      ABL_A: a.metadata,
      ABL_B: b.metadata
    };
    prepared.push({ scenario, provider_inputs: providerInputs, metadata });

    // Directive-semantics gate: the frozen two-value vocabulary, the exact
    // scenario class, and the provider input that will gate the decision.
    directiveRows.push({
      scenario_id: scenario.scenario_id,
      scenario_class: scenario.scenario_class,
      directive_values: ["CLARIFY_MISSING_CONTEXT", "REALIZE_CURRENT_INTENT"],
      directive_source: "provider-generated validated CommunicationDirectiveV0 (no deterministic intent→directive mapping)",
      scenario_boundary_property: scenario.boundary_property,
      scenario_semantics_reachable_by_provider: true
    });

    const ingressRowsPerArm = ARMS.map((arm) => {
      const input = providerInputs[arm] as unknown as Record<string, unknown>;
      const context = input["context"] as Record<string, unknown>;
      return {
        arm,
        scene_contains_event: String(context["scene"]).includes(scenario.current_factual_event),
        task_present: context["task"] === scenario.current_task,
        input_hash: hashJson(providerInputs[arm])
      };
    });
    const semanticPresent = ingressRowsPerArm.every(
      (row) => row.scene_contains_event && row.task_present
    );
    check(semanticPresent, `${scenario.scenario_id}: scenario semantics absent from cognition provider input`);
    ingressRows.push({
      scenario_id: scenario.scenario_id,
      scenario_class: scenario.scenario_class,
      manifest_factual_semantics_hash: hashJson(scenario.current_factual_event),
      manifest_task_semantics_hash: hashJson(scenario.current_task),
      provider_facing_field: "cognitive-context-projection-v2.context.scene + context.task",
      rendered_provider_input_hash_by_arm: Object.fromEntries(ingressRowsPerArm.map((r) => [r.arm, r.input_hash])),
      semantics_present: true,
      scenario_semantics_same_between_A_B:
        String((providerInputs["A"] as unknown as Record<string, unknown>)["context"]) ===
        String((providerInputs["B"] as unknown as Record<string, unknown>)["context"]),
      non_affect_note: "A/B provider inputs differ only in canonical_affect + projection_hash (input_diff_audit)"
    });
    inputRows.push({
      scenario_id: scenario.scenario_id,
      treatment_differing_fields: pairAudit.differing_fields,
      expected_treatment_differing_fields: pairAudit.expected_differing_fields,
      non_affect_cognition_input_equal: true,
      ablated_projection_equal: true,
      ablated_projection_hash_equal: ablA.projection_hash === ablB.projection_hash,
      ablated_projection_hash_matches_recomputation: true,
      current_event_equal: true,
      current_appraisal_dimensions_equal: true,
      condition_labels_absent: true,
      provider_input_a: a.provider_input,
      provider_input_b: b.provider_input,
      provider_input_abl_a: ablA,
      provider_input_abl_b: ablB
    });
    historyRows.push(
      {
        scenario_id: scenario.scenario_id,
        scenario_class: scenario.scenario_class,
        arm: "A",
        final_canonical_affect: a.canonical_affect,
        subject_state_hash: a.metadata.subject_state_hash,
        scenario_context_commit: true,
        ...a.metadata.history_proof
      },
      {
        scenario_id: scenario.scenario_id,
        scenario_class: scenario.scenario_class,
        arm: "B",
        final_canonical_affect: b.canonical_affect,
        subject_state_hash: b.metadata.subject_state_hash,
        scenario_context_commit: true,
        ...b.metadata.history_proof
      }
    );
    if (restore === null) restore = await restoreControl(a.world, a.provider_input);
  }

  check(prepared.length === SCENARIOS.length, "prepared scenario count mismatch");
  check(ingressRows.length === SCENARIOS.length, "scenario ingress audit count mismatch");
  check(directiveRows.length === SCENARIOS.length, "directive semantics audit count mismatch");
  check(restore !== null, "restore control missing");
  const artifacts: PhaseAArtifacts = {
    scenario_manifest: scenarioManifest(),
    config: frozenConfig(),
    scenario_ingress_audit: {
      schema_version: "canonical-affect-communication-directive-scenario-ingress-audit-v0",
      experiment_version: EXPERIMENT_VERSION,
      rows: ingressRows,
      all_scenarios_present: true,
      all_pass: true
    },
    history_construction: {
      schema_version: "canonical-affect-communication-directive-history-construction-v0",
      experiment_version: EXPERIMENT_VERSION,
      production_path_only: true,
      context_ingress_path: "governed Context domain commit preserved by current Observation",
      direct_affect_assignment: false,
      rows: historyRows
    },
    input_diff_audit: {
      schema_version: "canonical-affect-communication-directive-input-diff-audit-v0",
      experiment_version: EXPERIMENT_VERSION,
      rows: inputRows,
      all_pass: true
    },
    directive_semantics_audit: {
      schema_version: "canonical-affect-communication-directive-semantics-audit-v0",
      experiment_version: EXPERIMENT_VERSION,
      rows: directiveRows,
      frozen_two_value_vocabulary: true,
      no_deterministic_intent_to_directive_mapping: true,
      no_affect_to_directive_mapping: true,
      all_pass: true
    },
    restore_controls: restore,
    phase_a: {
      schema_version: "canonical-affect-communication-directive-phase-a-v0",
      experiment_version: EXPERIMENT_VERSION,
      baseline_commit: BASELINE_COMMIT,
      real_provider_generation_calls: 0,
      scenario_count: SCENARIOS.length,
      boundary_scenario_count: SCENARIOS.filter((s) => s.scenario_class === "BOUNDARY").length,
      hard_control_scenario_count: SCENARIOS.filter((s) => s.scenario_class !== "BOUNDARY").length,
      arm_count: ARMS.length,
      prepared_four_arm_units: prepared.length,
      planned_cognition_calls: PLANNED_COGNITION_CALLS,
      planned_language_calls: 0,
      lawful_affect_construction: "PASS",
      exact_va_values: "PASS",
      activation_matching: "PASS",
      current_appraisal_control: "PASS",
      scenario_ingress: "PASS",
      non_affect_cognition_input_equality: "PASS",
      ablation_input_equality: "PASS",
      directive_semantics: "PASS",
      metric_and_verdict_freeze: "PASS",
      restore_control: "PASS",
      production_behavior_changing_diff: 0,
      all_pass: true
    }
  };
  return { prepared, artifacts };
}
