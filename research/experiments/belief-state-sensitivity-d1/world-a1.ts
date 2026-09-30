/* eslint-disable no-restricted-imports -- Isolated research harness COMPOSING frozen production seams (repository convention); it copies no production semantics and changes no production package. */
/**
 * D1 Phase A1 — production world per arm + real observation commit. RESEARCH-ONLY.
 * ZERO model calls. It composes production exports; it does not reimplement any of them.
 *
 * Sequence per arm (identical for HIGH / LOW / NEUTRAL, independent instances):
 *   fresh InMemoryMemoryRepository (R0)
 *     -> materializeSubjectStateV4V0 with the arm's belief credence
 *     -> fresh facade + issuer + micl minter
 *     -> observationInput -> buildContextDelta -> buildObservationProposal
 *     -> facade.reserveAndRoute -> facade.commitReserved
 *     -> post-observation canonical snapshot from the commit bundle
 */

import {
  createInMemorySubjectCoreFacadeForExplicitV4V0,
  materializeSubjectStateV4V0,
  proposalFingerprint,
  BELIEF_STATE_SCHEMA_VERSION,
  deriveBeliefPropositionId,
  type SubjectStateV0,
  type SubjectStateV4
} from "../../../packages/subject-core/dist/index.js";
import {
  InMemoryMemoryRepository,
  computeRepositoryRevisionHash
} from "../../../packages/memory/dist/index.js";
import { createInteractiveSubjectSeedV0 } from "../../../packages/runtime/dist/index.js";
import { deriveBeliefPropositionKeyV0 } from "../../../packages/runtime/dist/transitions/belief/belief-proposition-admission.js";
import { createMiclStageMinter } from "../../../packages/runtime/dist/micl/micl-capabilities.js";
import { InMemoryMiclWorkflowStore } from "../../../packages/runtime/dist/index.js";
import { observationInput } from "../../../packages/runtime/dist/transitions/observation/observation-fixtures.js";
import { buildObservationProposal } from "../../../packages/runtime/dist/transitions/observation/observation-transition-executor.js";
import { buildContextDelta } from "../../../packages/runtime/dist/ports/context-producer-port.js";
import { currentBindings } from "../canonical-affect-behavior-influence-v1/harness.ts";

import { D1_P1, D1_PROPOSITION_LABEL, D1_STATE_LEVELS } from "./contract.ts";

export const D1_SUBJECT_ID = "d1-belief-sensitivity-subject" as const;
/** Arm-blind observation identity: identical in all three worlds, and free of arm metadata. */
export const D1_OBSERVATION_ID = "observation:o-d1-p1-awaiting-inspection" as const;

export const D1_LEVEL_CREDENCE = Object.freeze({
  HIGH: D1_STATE_LEVELS.HIGH,
  LOW: D1_STATE_LEVELS.LOW,
  NEUTRAL: D1_STATE_LEVELS.NEUTRAL_NOISE_CALIBRATION
});

export interface D1ArmWorldV0 {
  readonly level: "HIGH" | "LOW" | "NEUTRAL";
  readonly credence: number;
  readonly proposition_id: string;
  readonly pre_observation_state: SubjectStateV4;
  readonly observation_id: string;
  readonly observation_ref: string;
  readonly post_observation_state: SubjectStateV4;
  readonly commit_transition_id: string;
  readonly repository_revision_pre: string;
  readonly repository_revision_post: string;
  readonly event_count: number;
}

/** Builds ONE completely independent production world for one arm and commits the frozen P1. */
export async function buildArmWorldV0(level: "HIGH" | "LOW" | "NEUTRAL"): Promise<D1ArmWorldV0> {
  const credence = D1_LEVEL_CREDENCE[level];

  // 1. fresh repository (independent per arm)
  const repo = new InMemoryMemoryRepository();
  await repo.prepareRevision({ parent_revision: null as never, records: [] });
  const r0Manifest = await repo.readManifest("R0" as never);
  if (r0Manifest === null) throw new Error("D1_A1: R0 manifest missing");
  const r0Binding = {
    repository_revision: "R0" as never,
    repository_revision_hash: (await computeRepositoryRevisionHash(r0Manifest)) as never
  };

  // 2. the product's own subject seed, with ONLY the belief container authored
  const productionSeed = createInteractiveSubjectSeedV0(
    D1_SUBJECT_ID,
    "D1 Subject",
    ["characteros-next", "d1-preregistration"]
  );
  const propositionKey = await deriveBeliefPropositionKeyV0(D1_PROPOSITION_LABEL);
  const propositionId = await deriveBeliefPropositionId(D1_SUBJECT_ID as never, propositionKey);
  const authored: SubjectStateV0 = {
    ...productionSeed,
    beliefs: {
      schema_version: BELIEF_STATE_SCHEMA_VERSION,
      items: [
        {
          proposition_id: propositionId,
          proposition_label: D1_PROPOSITION_LABEL,
          credence: credence as never
        }
      ]
    }
  } as unknown as SubjectStateV0;

  // 3. production genesis materialization
  const genesis = await materializeSubjectStateV4V0({
    mode: "EXPLICIT_V4_FOUNDATION_V0" as never,
    seed: {
      schema_version: "subject-state-v4-genesis-seed-v0",
      subject: {
        subject_id: D1_SUBJECT_ID,
        display_name: "D1 Subject",
        identity_anchors: ["characteros-next", "d1-preregistration"]
      },
      v3_source: authored,
      r0_binding: r0Binding
    },
    r0_binding: r0Binding,
    reference_validator: async (binding: unknown) =>
      JSON.stringify(binding) === JSON.stringify(r0Binding)
  } as never);
  if (!genesis.ok) {
    throw new Error(`D1_A1_MATERIALIZATION_FAILED: ${genesis.code}: ${genesis.detail}`);
  }
  const preState = genesis.state;

  // 4. fresh facade + issuer + minter per arm
  const assembly = createInMemorySubjectCoreFacadeForExplicitV4V0({
    seedSnapshots: new Map([[D1_SUBJECT_ID as never, preState as never]]),
    seedBundles: [],
    referenceValidator: async (binding: never) => repo.validateRevisionBinding(binding as never),
    preparedResultValidator: async () => true,
    memoryAdoptionValidator: async () => true
  } as never);
  const issuer = assembly.producerAuthorizationIssuer;
  const minter = createMiclStageMinter(assembly.facade as never, new InMemoryMiclWorkflowStore(), {
    micl_id: `micl-d1-a1-${level}` as never,
    micl_request_fingerprint: "sha256:d1-a1-observation" as never,
    stage_key: "OBSERVATION" as never
  }) as unknown as { capabilities(bindings: unknown): unknown };
  // Constructed for CONFIGURATION PARITY with the production world builder (identical minter
  // configuration in every arm). The observation commit used here goes through the facade
  // directly, so this handle is not otherwise called; it is asserted to exist below.
  if (minter === undefined) throw new Error("D1_A1: micl minter missing");

  // 5. the frozen P1 observation, arm-blind identity
  const observation = observationInput({
    subject_id: D1_SUBJECT_ID,
    observation_id: D1_OBSERVATION_ID,
    occurrence_logical_time: preState.runtime_metadata.logical_time,
    source_refs: ["source:s-3"],
    entity_refs: ["entity:alice", `subject:${D1_SUBJECT_ID}`]
  });

  // 6. production context delta, with ONLY scene (P1) and task (null) overridden — no duplication
  const baseDelta = await buildContextDelta(observation, preState as never);
  const baseOperation = baseDelta.operations[0] as { path: string; value: Record<string, unknown> };
  if (baseOperation.path !== "/context") {
    throw new Error(`D1_A1_UNEXPECTED_DELTA_PATH: ${baseOperation.path}`);
  }
  const contextDelta = {
    ...baseDelta,
    operations: [
      {
        ...baseOperation,
        value: { ...baseOperation.value, scene: D1_P1.observation_text, task: null }
      }
    ]
  } as typeof baseDelta;

  // 7. production proposal -> reserve -> commit
  const proposal = await buildObservationProposal({
    subjectId: D1_SUBJECT_ID,
    stateRevision: preState.runtime_metadata.state_revision as number,
    observation,
    deltas: [contextDelta]
  } as never);
  const reserved = await assembly.facade.reserveAndRoute(proposal as never);
  if ((reserved as { kind: string }).kind !== "CONTINUE") {
    throw new Error(`D1_A1_RESERVATION_FAILED: ${(reserved as { kind: string }).kind}`);
  }
  const outcome = await assembly.facade.commitReserved({
    proposal,
    continuation: (reserved as { continuation: unknown }).continuation,
    producerAuthorization: issuer.issue([{ producer: "context", domain: "context" }] as never) as never,
    preparedBinding: {
      prepared_result_ref: `workflow:w-d1-a1-${level}` as never,
      transition_id: (proposal as { transition_id: string }).transition_id,
      subject_id: (proposal as { subject_id: string }).subject_id,
      transition_type: (proposal as { transition_type: string }).transition_type,
      payload_fingerprint: await proposalFingerprint(proposal as never)
    },
    repository_bindings: (await currentBindings(repo, preState)) as never
  } as never);
  if ((outcome as { kind: string }).kind !== "COMMITTED") {
    throw new Error(
      `D1_A1_COMMIT_FAILED: ${JSON.stringify(outcome).slice(0, 240)}`
    );
  }
  const committed = (outcome as unknown as { bundle: { next_snapshot: SubjectStateV4 } }).bundle
    .next_snapshot;

  return Object.freeze({
    level,
    credence,
    proposition_id: propositionId,
    pre_observation_state: preState,
    observation_id: observation.observation_id,
    observation_ref: observation.observation_id,
    post_observation_state: committed,
    commit_transition_id: (proposal as { transition_id: string }).transition_id,
    repository_revision_pre: preState.memory_state.repository_revision,
    repository_revision_post: committed.memory_state.repository_revision,
    event_count: 1
  });
}

/** Recursively collects differing leaf paths between two canonical states. */
export function diffPathsOf(a: unknown, b: unknown, path = ""): readonly string[] {
  if (a === b) return [];
  if (typeof a !== typeof b || a === null || b === null || typeof a !== "object") {
    return [path === "" ? "/" : path];
  }
  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  const keys = [...new Set([...Object.keys(aObj), ...Object.keys(bObj)])].sort();
  const out: string[] = [];
  for (const key of keys) out.push(...diffPathsOf(aObj[key], bObj[key], `${path}/${key}`));
  return out;
}
