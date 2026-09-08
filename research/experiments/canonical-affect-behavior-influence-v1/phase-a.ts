/* eslint-disable no-restricted-imports, @typescript-eslint/no-non-null-assertion -- Isolated zero-call conformance harness over frozen built production roots. */

import type { AtomicCommitBundleAnyVersion, SubjectStateV4 } from "../../../packages/subject-core/dist/index.js";
import { InMemoryMemoryRepository, computeRepositoryRevisionHash } from "../../../packages/memory/dist/index.js";
import {
  createSubjectStateV4AuthoritativeRestoreEnvelopeV0,
  restoreSubjectStateV4AuthoritativelyV0
} from "../../../packages/runtime/dist/authority/restore-chain-authority-v4.js";
import { mintTrustedCanonicalHistoryBoundaryV4V0 } from "../../../packages/runtime/dist/authority/trusted-canonical-history-boundary.js";
import { buildCognitiveContextProjectionV2ForExplicitV4 } from "../../../packages/runtime/dist/transitions/cognition-action/cognition-action-transition-executor.js";
import {
  ABLATION_NEUTRAL_AFFECT,
  ARMS,
  BASELINE_COMMIT,
  CURRENT_DIMENSIONS,
  EXPERIMENT_VERSION,
  MAGNITUDES,
  PLANNED_PRIMARY_CALLS,
  SCENARIOS,
  frozenConfig,
  scenarioManifest,
  type Arm,
  type MagnitudeV1,
  type ScenarioV1,
  type TreatmentArm
} from "./contract.ts";
import { auditProviderInputPair, cognitionEndpoints } from "./metrics.ts";
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
} from "./harness.ts";
import { canonicalJson, check, equal, hashJson, round } from "./fixtures.ts";

export interface ArmMetadata {
  readonly subject_state_hash: string;
  readonly current_event_ref: string;
  readonly current_appraisal_ref: string;
  readonly current_appraisal_dimensions: typeof CURRENT_DIMENSIONS;
  readonly history_proof: HistoryProof;
}

export interface PreparedCell {
  readonly scenario: ScenarioV1;
  readonly magnitude: MagnitudeV1;
  readonly provider_inputs: Readonly<Record<Arm, unknown>>;
  readonly metadata: Readonly<Record<Arm, ArmMetadata>>;
}

interface BuiltArm {
  readonly provider_input: unknown;
  readonly metadata: ArmMetadata;
  readonly canonical_affect: {
    readonly schema_version: string;
    readonly valence: number;
    readonly activation: number;
  };
}

export interface PhaseAArtifacts {
  readonly scenario_manifest: readonly Record<string, unknown>[];
  readonly config: Record<string, unknown>;
  readonly input_diff_audit: Record<string, unknown>;
  readonly history_construction: Record<string, unknown>;
  readonly restore_controls: Record<string, unknown>;
  readonly phase_a: Record<string, unknown>;
}

export interface PhaseAResult {
  readonly prepared: readonly PreparedCell[];
  readonly artifacts: PhaseAArtifacts;
}

function stringsIn(value: unknown): readonly string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(stringsIn);
  if (value !== null && typeof value === "object") return Object.values(value as Record<string, unknown>).flatMap(stringsIn);
  return [];
}

const FORBIDDEN_MARKERS = Object.freeze([
  "condition=a",
  "condition=b",
  "abl_a",
  "abl_b",
  "treatment arm",
  "positive-valence arm",
  "negative-valence arm"
]);

function hiddenMarkers(value: unknown): readonly string[] {
  const strings = stringsIn(value).map((item) => item.toLowerCase());
  return FORBIDDEN_MARKERS.filter((marker) => strings.some((item) => item.includes(marker))).sort();
}

async function buildArm(scenario: ScenarioV1, magnitude: MagnitudeV1, arm: TreatmentArm): Promise<BuiltArm> {
  const world = await buildWorld(scenario.current_task);
  const history = await constructArmHistory(world, arm, scenario, magnitude);
  const capture = await runCognitionCapture(world, scenario.allowed_action_space);
  const snapshot = await readSnapshot(world);
  const projection = capture.provider_input as {
    canonical_affect: BuiltArm["canonical_affect"];
    context: { task: string | null; current_observation_ref: string | null };
    allowed_actions: unknown;
    projection_hash: string;
  };
  check(projection.context.task === scenario.current_task, `${scenario.scenario_id}/${magnitude.magnitude_id}/${arm}: scenario task not projected`);
  check(projection.context.current_observation_ref === history.current_observation_ref, `${scenario.scenario_id}/${magnitude.magnitude_id}/${arm}: current observation mismatch`);
  check(equal(projection.allowed_actions, scenario.allowed_action_space), `${scenario.scenario_id}/${magnitude.magnitude_id}/${arm}: action space mismatch`);
  const rebuiltProductionProjection = await buildCognitiveContextProjectionV2ForExplicitV4(snapshot);
  check(
    projection.projection_hash === rebuiltProductionProjection.projection_hash,
    `${scenario.scenario_id}/${magnitude.magnitude_id}/${arm}: treatment projection hash differs from frozen production builder`
  );
  check(!containsPromiseLike(projection), `${scenario.scenario_id}/${magnitude.magnitude_id}/${arm}: unresolved Promise leaked into treatment input`);
  check(cognitionEndpoints(capture.proposal).action_intent === null, "deterministic harness provider must return NO_ACTION");
  return {
    provider_input: capture.provider_input,
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

function affectMatches(affect: BuiltArm["canonical_affect"], magnitude: MagnitudeV1, arm: TreatmentArm): boolean {
  const expectedValence = arm === "A" ? magnitude.target_absolute_valence : -magnitude.target_absolute_valence;
  return round(affect.valence) === expectedValence && round(affect.activation) === magnitude.expected_final_activation;
}

async function restoreControl(scenario: ScenarioV1, magnitude: MagnitudeV1): Promise<Record<string, unknown>> {
  const world = await buildWorld(scenario.current_task);
  const history = await constructArmHistory(world, "A", scenario, magnitude);
  const before = (await runCognitionCapture(world, scenario.allowed_action_space)).provider_input;
  const bundles = world.assembly.storeRead.getCommittedBundles()
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
      return manifest !== null && (await computeRepositoryRevisionHash(manifest)) === binding.repository_revision_hash;
    }
  });
  check(minted.kind === "MINTED", `restore boundary mint failed: ${minted.kind}`);
  const headBinding = (await currentBindings(world.repo, headBundle.next_snapshot as unknown as SubjectStateV4))[0];
  check(headBinding !== undefined, "restore head repository binding missing");
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
    reference_validator: async (binding) => freshRepo.validateRevisionBinding(binding as never)
  });
  check(restored.kind === "RESTORED", `restore failed: ${restored.kind}`);
  const baseProjection = await buildCognitiveContextProjectionV2ForExplicitV4(restored.snapshot);
  const after = { ...baseProjection, allowed_actions: scenario.allowed_action_space };
  const identical = equal(before, after);
  check(identical, `${magnitude.magnitude_id}: pre/post restore provider input differs`);
  return {
    scenario_id: scenario.scenario_id,
    magnitude_id: magnitude.magnitude_id,
    arm: "A",
    current_event_ref: history.current_event_ref,
    input_before_hash: hashJson(before),
    input_after_hash: hashJson(after),
    provider_facing_input_identical: identical,
    input_before: before,
    input_after: after
  };
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
      records.push({ ref: entry.ref, payload_hash: await fresh.storePayload(entry.ref as never, payload) });
    }
    await fresh.prepareRevision({ parent_revision: manifest!.parent_revision as never, records: records as never });
  }
  return fresh;
}

/** Runs every Phase-A gate with exactly zero real-provider calls. */
export async function executePhaseA(): Promise<PhaseAResult> {
  const prepared: PreparedCell[] = [];
  const auditRows: Record<string, unknown>[] = [];
  const historyRows: Record<string, unknown>[] = [];
  let asyncHashRegressionPass = true;
  for (const scenario of SCENARIOS) {
    for (const magnitude of MAGNITUDES) {
      const a = await buildArm(scenario, magnitude, "A");
      const b = await buildArm(scenario, magnitude, "B");
      check(affectMatches(a.canonical_affect, magnitude, "A"), `${scenario.scenario_id}/${magnitude.magnitude_id}: arm A lawful VA mismatch ${canonicalJson(a.canonical_affect)}`);
      check(affectMatches(b.canonical_affect, magnitude, "B"), `${scenario.scenario_id}/${magnitude.magnitude_id}: arm B lawful VA mismatch ${canonicalJson(b.canonical_affect)}`);
      check(round(a.canonical_affect.activation) === round(b.canonical_affect.activation), `${scenario.scenario_id}/${magnitude.magnitude_id}: activation mismatch`);
      check(a.metadata.current_event_ref === b.metadata.current_event_ref, `${scenario.scenario_id}/${magnitude.magnitude_id}: current event ref differs`);
      check(equal(a.metadata.current_appraisal_dimensions, b.metadata.current_appraisal_dimensions), `${scenario.scenario_id}/${magnitude.magnitude_id}: current Appraisal differs`);

      const inputAudit = auditProviderInputPair(a.provider_input, b.provider_input);
      check(inputAudit.non_affect_provider_input_equal, `${scenario.scenario_id}/${magnitude.magnitude_id}: non-Affect provider input differs: ${inputAudit.differing_fields.join(", ")}`);
      const ablA = await ablateProviderInput(a.provider_input);
      const ablB = await ablateProviderInput(b.provider_input);
      check(equal(ablA, ablB), `${scenario.scenario_id}/${magnitude.magnitude_id}: ablated inputs differ`);
      const ablatedHash = (ablA as { projection_hash: unknown }).projection_hash;
      const resolvedHash = typeof ablatedHash === "string" && /^sha256:[0-9a-f]{64}$/.test(ablatedHash);
      const recomputedHash = await recomputeProviderInputProjectionHash(ablA);
      const hashMatches = ablatedHash === recomputedHash;
      const promiseLeakAbsent = !containsPromiseLike(ablA) && !containsPromiseLike(ablB);
      asyncHashRegressionPass = asyncHashRegressionPass && resolvedHash && hashMatches && promiseLeakAbsent;
      check(resolvedHash && hashMatches && promiseLeakAbsent, `${scenario.scenario_id}/${magnitude.magnitude_id}: async ablation hash regression`);
      const markers = [...new Set([
        ...hiddenMarkers(a.provider_input),
        ...hiddenMarkers(b.provider_input),
        ...hiddenMarkers(ablA),
        ...hiddenMarkers(ablB)
      ])].sort();
      check(markers.length === 0, `${scenario.scenario_id}/${magnitude.magnitude_id}: hidden arm marker leaked`);

      const metadata: Record<Arm, ArmMetadata> = {
        A: a.metadata,
        B: b.metadata,
        ABL_A: a.metadata,
        ABL_B: b.metadata
      };
      prepared.push({
        scenario,
        magnitude,
        provider_inputs: { A: a.provider_input, B: b.provider_input, ABL_A: ablA, ABL_B: ablB },
        metadata
      });
      auditRows.push({
        scenario_id: scenario.scenario_id,
        magnitude_id: magnitude.magnitude_id,
        differing_fields: inputAudit.differing_fields,
        non_affect_provider_input_equal: true,
        activation_match: true,
        current_event_equal: true,
        current_appraisal_dimensions_equal: true,
        current_appraisal_refs_equal: a.metadata.current_appraisal_ref === b.metadata.current_appraisal_ref,
        current_appraisal_ref_note: "content-addressed provenance may differ because the lawful prior history differs; refs are not provider-facing",
        current_appraisal_ref_a: a.metadata.current_appraisal_ref,
        current_appraisal_ref_b: b.metadata.current_appraisal_ref,
        action_space_equal: true,
        ablated_inputs_identical: true,
        ablation_projection_hash_resolved_string: resolvedHash,
        ablation_projection_hash_matches_recomputation: hashMatches,
        promise_or_stringification_leak_absent: promiseLeakAbsent,
        hidden_arm_labels_present: markers,
        provider_input_a: a.provider_input,
        provider_input_b: b.provider_input,
        provider_input_abl_a: ablA,
        provider_input_abl_b: ablB
      });
      historyRows.push(
        {
          scenario_id: scenario.scenario_id,
          magnitude_id: magnitude.magnitude_id,
          arm: "A",
          final_canonical_affect: a.canonical_affect,
          subject_state_hash: a.metadata.subject_state_hash,
          ...a.metadata.history_proof
        },
        {
          scenario_id: scenario.scenario_id,
          magnitude_id: magnitude.magnitude_id,
          arm: "B",
          final_canonical_affect: b.canonical_affect,
          subject_state_hash: b.metadata.subject_state_hash,
          ...b.metadata.history_proof
        }
      );
    }
  }

  const restoreRows = [];
  for (const magnitude of MAGNITUDES) restoreRows.push(await restoreControl(SCENARIOS[0]!, magnitude));
  check(prepared.length === SCENARIOS.length * MAGNITUDES.length, "prepared cell count mismatch");
  check(auditRows.length === prepared.length, "audit row count mismatch");
  check(historyRows.length === prepared.length * 2, "history proof count mismatch");
  const artifacts: PhaseAArtifacts = {
    scenario_manifest: scenarioManifest(),
    config: frozenConfig(),
    input_diff_audit: {
      schema_version: "canonical-affect-behavior-influence-replication-input-audit-v1",
      experiment_version: EXPERIMENT_VERSION,
      rows: auditRows,
      all_pass: true
    },
    history_construction: {
      schema_version: "canonical-affect-behavior-influence-replication-history-proof-v1",
      experiment_version: EXPERIMENT_VERSION,
      production_path_only: true,
      direct_state_assignment: false,
      rows: historyRows
    },
    restore_controls: {
      schema_version: "canonical-affect-behavior-influence-replication-restore-controls-v1",
      rows: restoreRows,
      all_pass: restoreRows.every((row) => row["provider_facing_input_identical"] === true)
    },
    phase_a: {
      schema_version: "canonical-affect-behavior-influence-replication-phase-a-v1",
      experiment_version: EXPERIMENT_VERSION,
      baseline_commit: BASELINE_COMMIT,
      real_provider_calls: 0,
      scenario_count: SCENARIOS.length,
      magnitude_count: MAGNITUDES.length,
      prepared_four_arm_cells: prepared.length,
      planned_primary_calls: PLANNED_PRIMARY_CALLS,
      lawful_magnitude_construction: "PASS",
      activation_matching: "PASS",
      scenario_freeze: "PASS",
      provider_input_isolation: "PASS",
      ablation_identity: "PASS",
      async_hash_regression: asyncHashRegressionPass ? "PASS" : "FAIL",
      metrics_and_denominators: "PASS",
      restore_controls: restoreRows.every((row) => row["provider_facing_input_identical"] === true) ? "PASS" : "FAIL",
      all_pass: asyncHashRegressionPass && restoreRows.every((row) => row["provider_facing_input_identical"] === true),
      arms: [...ARMS],
      neutral_affect: { ...ABLATION_NEUTRAL_AFFECT }
    }
  };
  check(artifacts.phase_a["all_pass"] === true, "Phase A failed");
  return { prepared, artifacts };
}
