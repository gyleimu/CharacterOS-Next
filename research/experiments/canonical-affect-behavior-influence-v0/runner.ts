/* eslint-disable no-restricted-imports, @typescript-eslint/no-non-null-assertion -- Isolated trusted experiment host over frozen built production roots; zero production code changes. */
/**
 * CANONICAL_AFFECT_COGNITION_BEHAVIOR_INFLUENCE_EXPERIMENT_V0 — trial runner.
 *
 * Executes the full deterministic phase: per scenario, two lawful explicit-v4
 * histories (arms A/B) differing ONLY in the prior event's goal_congruence;
 * identical current scenario event + identical Appraisal + identical
 * AffectApplication impulse; cognition through the frozen production
 * CognitionAction executor with the deterministic fake provider; paired
 * input audit; EXPERIMENTAL_ABLATION_ONLY contrast; and the restore control
 * for scenario S1 arm A.
 *
 * REAL MODEL CALLS: 0 (Phase 1). Phase 2 (OLLAMA_NATIVE qwen3.5:9b) requires a
 * reachable server and is executed separately when available.
 */

import type { AtomicCommitBundleAnyVersion, SubjectStateV4 } from "../../../packages/subject-core/dist/index.js";
import { InMemoryMemoryRepository } from "../../../packages/memory/dist/index.js";
import { computeRepositoryRevisionHash } from "../../../packages/memory/dist/index.js";
import {
  createSubjectStateV4AuthoritativeRestoreEnvelopeV0,
  restoreSubjectStateV4AuthoritativelyV0
} from "../../../packages/runtime/dist/authority/restore-chain-authority-v4.js";
import { mintTrustedCanonicalHistoryBoundaryV4V0 } from "../../../packages/runtime/dist/authority/trusted-canonical-history-boundary.js";
import { buildCognitiveContextProjectionV2ForExplicitV4 } from "../../../packages/runtime/dist/transitions/cognition-action/cognition-action-transition-executor.js";
import {
  ABLATION_NEUTRAL_AFFECT_SECTION,
  CURRENT_DIMENSIONS,
  PRIOR_EVENT,
  REAL_PROVIDER_CONFIG,
  SCENARIOS
} from "./contract.ts";
import { canonicalJson, check, equal, sha256 } from "./fixtures.ts";
import {
  ablatedInputsIdentical,
  ablationSection,
  auditProviderInputPair,
  cognitionEndpoints,
  outputDistance,
  providerInputHash,
  type CognitionOutputEndpoints
} from "./metrics.ts";
import {
  ablateProviderInput,
  buildWorld,
  constructArmHistory,
  readSnapshot,
  runCognitionTrial,
  type World
} from "./harness.ts";

export interface TrialRecord {
  readonly scenario_id: string;
  readonly condition: "A" | "B" | "ABLATED_A" | "ABLATED_B";
  readonly trial_id: string;
  readonly provider: string;
  readonly provider_parameters: Record<string, unknown>;
  readonly subject_state_hash: string;
  readonly canonical_affect: { readonly valence: number; readonly activation: number };
  readonly projection_hash: string;
  readonly current_appraisal_ref: string;
  readonly current_appraisal_dimensions: unknown;
  readonly provider_input_hash: string;
  readonly structured_output: Record<string, unknown>;
  readonly status: "VALID";
}

export interface InputDiffAudit {
  readonly scenario_id: string;
  readonly differing_fields: readonly string[];
  readonly non_affect_provider_input_equal: boolean;
  readonly provider_input_a: unknown;
  readonly provider_input_b: unknown;
}

export interface EvidenceBundle {
  readonly experiment_id: string;
  readonly baseline_commit: string;
  readonly phase: "DETERMINISTIC_HARNESS_VALIDATION";
  readonly real_model_calls: 0;
  readonly real_provider: { readonly config: typeof REAL_PROVIDER_CONFIG; readonly reachable: false; readonly reason: string };
  readonly scenarios: readonly string[];
  readonly arms: { readonly prior_goal_congruence: Record<string, number>; readonly final_canonical_affect: Record<string, { valence: number; activation: number }> };
  readonly trials: readonly TrialRecord[];
  readonly input_diff_audits: readonly InputDiffAudit[];
  readonly ablation: {
    readonly mechanism: "EXPERIMENTAL_ABLATION_ONLY";
    readonly neutral_section: unknown;
    readonly ablated_inputs_identical: boolean;
    readonly causal_signal: number;
    readonly ablation_signal: number;
  };
  readonly restore_control: {
    readonly scenario_id: string;
    readonly arm: "A";
    readonly input_before: unknown;
    readonly input_after: unknown;
    readonly identical: boolean;
  };
  readonly aggregate: {
    readonly scenarios: number;
    readonly conditions: number;
    readonly trials_per_condition: number;
    readonly total_trials: number;
    readonly valid_trials: number;
    readonly failed_trials: number;
    readonly paired_ab_output_distance: number;
    readonly paired_ablated_output_distance: number;
    readonly non_affect_provider_input_equal_all: boolean;
  };
}

async function currentBindings(repo: InMemoryMemoryRepository, snapshot: SubjectStateV4) {
  const revision = snapshot.memory_state.repository_revision as never;
  const manifest = await repo.readManifest(revision);
  check(manifest !== null, "manifest must exist");
  return [{
    repository_revision: revision,
    repository_revision_hash: await computeRepositoryRevisionHash(manifest!)
  }];
}

async function runArmTrial(world: World, scenario: { readonly id: string; readonly task: string; readonly text: string }, arm: "A" | "B"): Promise<{
  readonly trial: TrialRecord;
  readonly provider_input: unknown;
}> {
  const { current_appraisal_ref } = await constructArmHistory(world, arm, scenario);
  const captured: unknown[] = [];
  const trial = await runCognitionTrial(world, captured);
  const snapshot = await readSnapshot(world);
  const providerInput = captured[0];
  check(providerInput !== undefined, "provider input must be captured");
  const affect = (providerInput as { canonical_affect: { valence: number; activation: number } }).canonical_affect;
  return {
    trial: {
      scenario_id: scenario.id,
      condition: arm,
      trial_id: `${scenario.id}-${arm}-1`,
      provider: "deterministic-fake-v0",
      provider_parameters: { temperature: "N/A (deterministic fake)", seed: null },
      subject_state_hash: sha256(canonicalJson(snapshot)),
      canonical_affect: { valence: affect.valence, activation: affect.activation },
      projection_hash: (providerInput as { projection_hash: string }).projection_hash,
      current_appraisal_ref,
      current_appraisal_dimensions: { ...CURRENT_DIMENSIONS },
      provider_input_hash: providerInputHash(providerInput),
      structured_output: { ...trial.proposal },
      status: "VALID"
    },
    provider_input: providerInput
  };
}

/** §32 — restore control: rerun scenario S1 arm A after authoritative restore. */
async function runRestoreControl(scenario: { readonly id: string; readonly task: string; readonly text: string }): Promise<EvidenceBundle["restore_control"]> {
  const world = await buildWorld();
  await constructArmHistory(world, "A", scenario);
  const capturedBefore: unknown[] = [];
  await runCognitionTrial(world, capturedBefore);
  const inputBefore = capturedBefore[0];

  const bundles = world.assembly.storeRead.getCommittedBundles().filter((b) => b.subject_id === "subject-s0") as unknown as readonly AtomicCommitBundleAnyVersion[];
  const headBundle = bundles.at(-1);
  check(headBundle !== undefined, "head bundle must exist for restore control");
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
  check(minted.kind === "MINTED", `restore boundary mint: ${minted.kind}`);
  const headBinding = (await currentBindings(world.repo, headBundle.next_snapshot as unknown as SubjectStateV4))[0];
  const envelope = await createSubjectStateV4AuthoritativeRestoreEnvelopeV0({
    snapshot: headBundle.next_snapshot as unknown as SubjectStateV4,
    commit_head: head as never,
    repository_binding: headBinding as never
  });
  const freshRepo = new InMemoryMemoryRepository();
  await freshRepo.prepareRevision({ parent_revision: null as never, records: [] });
  for (const revision of world.repo.revisionIds()) {
    if (revision === "R0") continue;
    const manifest = await world.repo.readManifest(revision);
    check(manifest !== null, `manifest ${revision} must exist`);
    const entries = [];
    for (const entry of manifest!.record_hashes) {
      const payload = world.repo.readStoredPayload(entry.ref as never);
      check(payload !== undefined, "payload must exist");
      entries.push({ ref: entry.ref, payload_hash: await freshRepo.storePayload(entry.ref as never, payload) });
    }
    await freshRepo.prepareRevision({ parent_revision: manifest!.parent_revision as never, records: entries as never });
  }
  const restored = await restoreSubjectStateV4AuthoritativelyV0({
    envelope: envelope as never,
    trusted_boundary: minted.receipt,
    bundles,
    reference_validator: async (binding) => freshRepo.validateRevisionBinding(binding as never)
  });
  check(restored.kind === "RESTORED", `restore control failed: ${restored.kind}`);

  // The cognition input is a deterministic pure function of the restored
  // snapshot: rebuild it and compare with the pre-restore provider input.
  const projectionAfter = await buildCognitiveContextProjectionV2ForExplicitV4(restored.snapshot);
  const inputAfter = { ...projectionAfter, allowed_actions: [] } as unknown;
  return {
    scenario_id: scenario.id,
    arm: "A",
    input_before: inputBefore,
    input_after: inputAfter,
    identical: equal(inputBefore, inputAfter)
  };
}

/** The full deterministic phase. */
export async function executeDeterministicPhase(): Promise<EvidenceBundle> {
  const trials: TrialRecord[] = [];
  const audits: InputDiffAudit[] = [];
  const finalAffect: Record<string, { valence: number; activation: number }> = {};
  let ablatedIdenticalAll = true;

  for (const scenario of SCENARIOS) {
    const worldA = await buildWorld();
    const a = await runArmTrial(worldA, scenario, "A");
    const worldB = await buildWorld();
    const b = await runArmTrial(worldB, scenario, "B");
    trials.push(a.trial, b.trial);
    finalAffect[`${scenario.id}-A`] = { ...a.trial.canonical_affect };
    finalAffect[`${scenario.id}-B`] = { ...b.trial.canonical_affect };

    // §11/§26 — paired input audit: only canonical_affect (+ its hash
    // binding) may differ between arms.
    const audit = auditProviderInputPair(a.provider_input, b.provider_input);
    audits.push({
      scenario_id: scenario.id,
      differing_fields: audit.differing_fields,
      non_affect_provider_input_equal: audit.non_affect_provider_input_equal,
      provider_input_a: a.provider_input,
      provider_input_b: b.provider_input
    });

    // §12 — EXPERIMENTAL_ABLATION_ONLY contrast: neutralize the affect
    // section at the provider-input boundary; arms must become
    // byte-identical (the provider cannot distinguish them at all).
    const ablatedA = await ablateProviderInput(a.provider_input);
    const ablatedB = await ablateProviderInput(b.provider_input);
    const identical = ablatedInputsIdentical(ablatedA, ablatedB);
    ablatedIdenticalAll = ablatedIdenticalAll && identical;
    trials.push(
      {
        ...a.trial,
         condition: "ABLATED_A",
         trial_id: `${scenario.id}-ABL-A-1`,
         canonical_affect: { valence: ABLATION_NEUTRAL_AFFECT_SECTION.valence, activation: ABLATION_NEUTRAL_AFFECT_SECTION.activation },
         projection_hash: (ablatedA as { projection_hash: string }).projection_hash,
         provider_input_hash: sha256(canonicalJson(ablatedA)),
        structured_output: { ...a.trial.structured_output }
      },
      {
        ...b.trial,
         condition: "ABLATED_B",
         trial_id: `${scenario.id}-ABL-B-1`,
         canonical_affect: { valence: ABLATION_NEUTRAL_AFFECT_SECTION.valence, activation: ABLATION_NEUTRAL_AFFECT_SECTION.activation },
         projection_hash: (ablatedB as { projection_hash: string }).projection_hash,
         provider_input_hash: sha256(canonicalJson(ablatedB)),
        structured_output: { ...b.trial.structured_output }
      }
    );

    // §10 — the current-event Appraisal must be exactly equal across arms.
    check(equal(a.trial.current_appraisal_dimensions, b.trial.current_appraisal_dimensions), `${scenario.id}: current Appraisal must be equal across arms`);
  }

  // §45 — paired structured-output distances. With the deterministic fake
  // provider (a pure function of its input) both distances are 0 by
  // construction; the causal answer belongs to the real-provider phase.
  const causalSignal = pairedDistance(trials, "A", "B");
  const ablationSignal = pairedDistance(trials, "ABLATED_A", "ABLATED_B");

  const restoreControl = await runRestoreControl(SCENARIOS[0]!);

  const validTrials = trials.filter((t) => t.status === "VALID").length;
  return {
    experiment_id: "CANONICAL_AFFECT_COGNITION_BEHAVIOR_INFLUENCE_EXPERIMENT_V0",
    baseline_commit: "2e369c1ddfa961a5598594e8871893c6e7ab2924",
    phase: "DETERMINISTIC_HARNESS_VALIDATION",
    real_model_calls: 0,
    real_provider: {
      config: { ...REAL_PROVIDER_CONFIG },
      reachable: false,
      reason: "OLLAMA_NATIVE server at 127.0.0.1:11434 unreachable (connection refused) at experiment time; Phase 2 not executed and no Phase-2 numbers fabricated."
    },
    scenarios: SCENARIOS.map((s) => s.id),
    arms: {
      prior_goal_congruence: { A: PRIOR_EVENT.goal_congruence_arm_a, B: PRIOR_EVENT.goal_congruence_arm_b },
      final_canonical_affect: finalAffect
    },
    trials,
    input_diff_audits: audits,
    ablation: {
      mechanism: "EXPERIMENTAL_ABLATION_ONLY",
      neutral_section: ablationSection(),
      ablated_inputs_identical: ablatedIdenticalAll,
      causal_signal: causalSignal,
      ablation_signal: ablationSignal
    },
    restore_control: restoreControl,
    aggregate: {
      scenarios: SCENARIOS.length,
      conditions: 4,
      trials_per_condition: SCENARIOS.length,
      total_trials: trials.length,
      valid_trials: validTrials,
      failed_trials: trials.length - validTrials,
      paired_ab_output_distance: causalSignal,
      paired_ablated_output_distance: ablationSignal,
      non_affect_provider_input_equal_all: audits.every((a) => a.non_affect_provider_input_equal)
    }
  };
}

/** §46 — categorical paired distance over structured endpoints. */
function pairedDistance(trials: readonly TrialRecord[], armX: "A" | "ABLATED_A", armY: "B" | "ABLATED_B"): number {
  const byScenario = new Map<string, { x?: CognitionOutputEndpoints; y?: CognitionOutputEndpoints }>();
  for (const t of trials) {
    if (t.condition !== armX && t.condition !== armY) continue;
    const entry = byScenario.get(t.scenario_id) ?? {};
    const endpoints = cognitionEndpoints(t.structured_output);
    if (t.condition === armX) entry.x = endpoints;
    else entry.y = endpoints;
    byScenario.set(t.scenario_id, entry);
  }
  check(byScenario.size > 0, `paired endpoints missing for ${armX}/${armY}`);
  let differing = 0;
  for (const pair of byScenario.values()) {
    check(pair.x !== undefined && pair.y !== undefined, `paired endpoints missing for ${armX}/${armY}`);
    differing += outputDistance(pair.x!, pair.y!);
  }
  return differing > 0 ? 1 : 0;
}
