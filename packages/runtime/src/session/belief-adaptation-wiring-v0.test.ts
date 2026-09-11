/**
 * BELIEF_ADAPTATION_SESSION_WIRING_V0 — wiring-level deterministic acceptance.
 *
 * Covers the wiring's own duties beyond the frozen workflow suites:
 *   §64 — the SAME evidence can never open a second workflow identity, so a
 *         committed plasticity can never be applied twice;
 *   §32 — a checkpointed canonical Belief transition is never silently
 *         abandoned: resume of a proposal-checkpoint record commits exactly
 *         once through the frozen executor (zero external provider calls);
 *   §61/§62 — controlled two-history comparison: same initial canonical
 *         belief, only lived evidence differs ⇒ opposite lawful credence
 *         movements (supportive vs contradictory).
 *
 * Fully offline: scratch subject-core facades, in-memory repositories,
 * deterministic test-local semantic providers. Zero real model calls.
 */

import { describe, expect, it } from "vitest";
import {
  InMemoryMemoryRepository,
  EPISODIC_MEMORY_RECORD_SCHEMA_VERSION,
  SALIENCE_SOURCE_ENCODING_DECLARED,
  type EpisodicMemoryRecordV0
} from "@characteros-next/memory";
import {
  BELIEF_STATE_SCHEMA_VERSION,
  createInMemorySubjectCoreFacade,
  type AtomicCommitBundleAnyVersion,
  type SubjectStateV0,
  type UnitIntervalV0
} from "@characteros-next/subject-core";
import { s0 } from "../transitions/observation/observation-fixtures.js";
import type { SubjectCorePort } from "../ports/subject-core-port.js";
import {
  BELIEF_SEMANTIC_PROVIDER_OUTPUT_SCHEMA_VERSION,
  type BeliefSemanticTargetResolutionProviderV0
} from "../transitions/belief/belief-semantic-target-resolution.js";
import {
  runBeliefAdaptationWorkflowV0,
  deriveBeliefAdaptationWorkflowCheckpointFingerprint,
  type BeliefAdaptationWorkflowRecordV0
} from "../transitions/belief/belief-adaptation-workflow.js";
import { InMemoryBeliefAdaptationWorkflowStoreV0 } from "../transitions/belief/belief-adaptation-workflow-store.js";
import { BeliefAdaptationWiringV0 } from "./belief-adaptation-wiring-v0.js";

const SUBJECT_ID = "subject-s0";
const TARGET_PROP = "prop.alice-keeps-promises";
const TARGET_LABEL = "Alice keeps promises";
const INITIAL_CREDENCE = 0.6;
const EPISODE_REF = "episode:ep-wiring-proof";

function unit(value: number): UnitIntervalV0 {
  if (!(value >= 0 && value <= 1)) throw new Error("fixture unit out of range");
  return value as UnitIntervalV0;
}

function wiringEpisode(): EpisodicMemoryRecordV0 {
  return {
    schema_version: EPISODIC_MEMORY_RECORD_SCHEMA_VERSION,
    episode_ref: EPISODE_REF as EpisodicMemoryRecordV0["episode_ref"],
    occurrence_logical_time: 7 as EpisodicMemoryRecordV0["occurrence_logical_time"],
    recorded_at_logical_time: 8 as EpisodicMemoryRecordV0["occurrence_logical_time"],
    provenance: {
      transition_id: "learning_ep_wiring" as never,
      producer: "memory",
      cause_refs: []
    },
    references: ["entity:alice-like"] as unknown as EpisodicMemoryRecordV0["references"],
    context: {
      scene: "Alice explicitly promised to meet Bob at the library, then deliberately broke that promise.",
      focus_refs: [],
      environment_refs: []
    },
    appraisal_ref: null,
    affect_snapshot_ref: null,
    salience: { declared_score: unit(0.8), source: SALIENCE_SOURCE_ENCODING_DECLARED }
  };
}

function scratchState(repositoryRevision: string): SubjectStateV0 {
  const base = s0() as unknown as SubjectStateV0;
  return {
    ...base,
    memory_state: { ...base.memory_state, repository_revision: repositoryRevision as never },
    beliefs: {
      schema_version: BELIEF_STATE_SCHEMA_VERSION,
      items: [
        {
          proposition_id: TARGET_PROP as never,
          proposition_label: TARGET_LABEL,
          credence: unit(INITIAL_CREDENCE)
        }
      ]
    },
    runtime_metadata: {
      ...base.runtime_metadata,
      logical_time: 10 as never,
      state_revision: 0 as never,
      last_transition_time: null,
      last_transition_type: null,
      updated_at: 10 as never
    },
    trace_window: {
      ...base.trace_window,
      cursor: { last_history_sequence: 0, offloaded_through_sequence: 0, offloaded_through_trace_ref: null },
      entries: []
    }
  } as unknown as SubjectStateV0;
}

/** Deterministic scripted semantic provider: the assessor decides from content. */
class ScriptedProvider implements BeliefSemanticTargetResolutionProviderV0 {
  calls = 0;
  constructor(private readonly relation: "SUPPORTS" | "CONTRADICTS" | "NO_BEARING") {}
  async propose(input: Parameters<BeliefSemanticTargetResolutionProviderV0["propose"]>[0]): Promise<unknown> {
    this.calls += 1;
    if (this.relation === "NO_BEARING") {
      return {
        schema_version: BELIEF_SEMANTIC_PROVIDER_OUTPUT_SCHEMA_VERSION,
        kind: "NO_BEARING",
        semantic_context_fingerprint: input.semantic_context_fingerprint,
        candidate_catalog_fingerprint: input.candidate_catalog_fingerprint
      };
    }
    return {
      schema_version: BELIEF_SEMANTIC_PROVIDER_OUTPUT_SCHEMA_VERSION,
      kind: "EXISTING_PROPOSITION",
      proposition_id: TARGET_PROP,
      relation: this.relation,
      semantic_context_fingerprint: input.semantic_context_fingerprint,
      candidate_catalog_fingerprint: input.candidate_catalog_fingerprint
    };
  }
}

interface World {
  readonly core: SubjectCorePort;
  readonly repo: InMemoryMemoryRepository;
  readonly bundles: Map<string, AtomicCommitBundleAnyVersion>;
  readonly store: InMemoryBeliefAdaptationWorkflowStoreV0;
  readonly facade: ReturnType<typeof createInMemorySubjectCoreFacade>;
}

async function buildWorld(): Promise<World> {
  const repo = new InMemoryMemoryRepository();
  await repo.prepareRevision({ parent_revision: null as never, records: [] });
  const episode = wiringEpisode();
  const payloadHash = await repo.storePayload(episode.episode_ref, episode);
  await repo.prepareRevision({
    parent_revision: "R0" as never,
    records: [{ ref: episode.episode_ref, payload_hash: payloadHash } as never]
  });
  const initialState = scratchState("R1");
  const facade = createInMemorySubjectCoreFacade({
    seedSnapshots: new Map([[SUBJECT_ID as never, initialState]]),
    preparedResultValidator: async (binding) => binding.prepared_result_ref.startsWith("workflow:"),
    referenceValidator: async () => true,
    memoryAdoptionValidator: async () => false
  });
  const bundles = new Map<string, AtomicCommitBundleAnyVersion>();
  const core: SubjectCorePort = {
    reserveAndRoute: (proposal) => facade.facade.reserveAndRoute(proposal),
    commitReserved: async (input) => {
      const bundle = await facade.facade.commitReserved(input);
      if (bundle.kind === "COMMITTED") bundles.set(bundle.bundle.transition_id, bundle.bundle);
      return bundle;
    },
    terminalizeReservedNoOp: (input) => facade.facade.terminalizeReservedNoOp(input),
    reconcile: (transitionId, subjectId, fingerprint) =>
      facade.facade.reconcile(transitionId, subjectId, fingerprint),
    readCurrentSnapshot: async (subjectId) => {
      const bundle = facade.storeRead.readCurrentBundle(subjectId);
      return bundle === null ? initialState : bundle.next_snapshot;
    }
  };
  return { core, repo, bundles, store: new InMemoryBeliefAdaptationWorkflowStoreV0(), facade };
}

function wiringFor(world: World, provider: BeliefSemanticTargetResolutionProviderV0): BeliefAdaptationWiringV0 {
  return new BeliefAdaptationWiringV0({
    subjectCore: world.core,
    memoryRepository: world.repo as never,
    producerAuthorizationIssuer: world.facade.producerAuthorizationIssuer as never,
    semanticProvider: provider,
    workflowStore: world.store,
    readCommittedBundle: async (transitionId) => world.bundles.get(transitionId) ?? null,
    readEpisodePayload: async (ref) => world.repo.readStoredPayload(ref as never) ?? null
  });
}

async function credence(world: World): Promise<number> {
  const snapshot = (await world.core.readCurrentSnapshot(SUBJECT_ID as never)) as SubjectStateV0;
  const item = snapshot.beliefs.items.find((entry) => entry.proposition_id === TARGET_PROP);
  if (item === undefined) throw new Error("fixture: target proposition missing");
  return item.credence as number;
}

describe("BELIEF_ADAPTATION_SESSION_WIRING_V0 — wiring-level acceptance", () => {
  it("§61/§62 controlled two histories: same initial belief, only lived evidence differs ⇒ opposite lawful movements", async () => {
    const worldA = await buildWorld();
    const reportA = await wiringFor(worldA, new ScriptedProvider("SUPPORTS")).runForEpisodeRefs({
      subject_id: SUBJECT_ID,
      episode_refs: [EPISODE_REF]
    });
    expect(reportA.current?.terminal_kind).toBe("COMPLETE_COMMITTED");
    expect(reportA.current?.prior_credence).toBe(INITIAL_CREDENCE);
    expect(reportA.current?.next_credence).toBe(INITIAL_CREDENCE + 0.05);

    const worldB = await buildWorld();
    const reportB = await wiringFor(worldB, new ScriptedProvider("CONTRADICTS")).runForEpisodeRefs({
      subject_id: SUBJECT_ID,
      episode_refs: [EPISODE_REF]
    });
    expect(reportB.current?.terminal_kind).toBe("COMPLETE_COMMITTED");
    expect(reportB.current?.prior_credence).toBe(INITIAL_CREDENCE);
    expect(reportB.current?.next_credence).toBe(0.6 - 0.05);

    expect(await credence(worldA)).not.toBe(await credence(worldB));
  });

  it("§64 replay: re-offering the SAME evidence can never re-apply plasticity (frozen identity conflict, fail-closed)", async () => {
    const world = await buildWorld();
    const provider = new ScriptedProvider("SUPPORTS");
    const wiring = wiringFor(world, provider);
    const first = await wiring.runForEpisodeRefs({ subject_id: SUBJECT_ID, episode_refs: [EPISODE_REF] });
    expect(first.current?.terminal_kind).toBe("COMPLETE_COMMITTED");
    expect(first.current?.provider_calls).toBe(1);
    expect(await credence(world)).toBe(INITIAL_CREDENCE + 0.05);

    // Same evidence re-offered after the canonical state advanced: the frozen
    // workflow identity law rejects the drifted request under the SAME
    // deterministic workflow id — FATAL, fail-closed, NO second plasticity.
    const second = await wiring.runForEpisodeRefs({ subject_id: SUBJECT_ID, episode_refs: [EPISODE_REF] });
    expect(second.current?.terminal_kind).toBe("NOT_TERMINAL");
    expect(second.current?.detail).toContain("FATAL_REUSE_CONFLICT");
    expect(second.current?.provider_calls).toBe(0);
    expect(await credence(world)).toBe(INITIAL_CREDENCE + 0.05);
    expect(provider.calls).toBe(1);
  });

  it("§32 resume: a checkpointed never-committed workflow completes through the frozen executor with ZERO provider calls", async () => {
    // Build a completed record on a scratch core, then rewind it to the exact
    // post-checkpoint crash state on a FRESH core (transition never committed).
    const built = await buildWorld();
    const directDeps = {
      subjectCore: built.core,
      memoryRepository: built.repo as never,
      producerAuthorizationIssuer: built.facade.producerAuthorizationIssuer as never,
      semanticProvider: new ScriptedProvider("SUPPORTS"),
      workflowStore: built.store,
      readCommittedBundle: async () => null
    };
    const directRequest = {
      schema_version: "belief-adaptation-request-v0" as const,
      workflow_id: "wf-belief-adapt-resume-proof",
      subject_id: SUBJECT_ID,
      expected_initial_state_revision: 0,
      expected_repository_revision: "R1",
      proposition_candidate_ids: [TARGET_PROP],
      selected_episodes: [wiringEpisode()]
    };
    const direct = await runBeliefAdaptationWorkflowV0(directDeps, directRequest);
    expect(direct.kind).toBe("COMPLETE_COMMITTED");
    const completed = (await built.store.load("wf-belief-adapt-resume-proof" as never)) as BeliefAdaptationWorkflowRecordV0;
    expect(completed.proposal_checkpoint).not.toBeNull();

    // Fresh core: identical canonical binding, transition NOT committed.
    const world = await buildWorld();
    const crashed: BeliefAdaptationWorkflowRecordV0 = {
      ...completed,
      stage: "B6_CANONICAL_RECONCILIATION",
      terminal_result: null,
      checkpoint_fingerprint: await deriveBeliefAdaptationWorkflowCheckpointFingerprint({
        ...completed,
        stage: "B6_CANONICAL_RECONCILIATION",
        terminal_result: null,
        checkpoint_fingerprint: "sha256:" + "0".repeat(64)
      } as BeliefAdaptationWorkflowRecordV0)
    };
    await world.store.createIfAbsent(crashed);

    // The wiring's own provider answers only the CURRENT evidence offer; the
    // resumed workflow replays the durable semantic candidate with no provider.
    const provider = new ScriptedProvider("NO_BEARING");
    const report = await wiringFor(world, provider).runForEpisodeRefs({
      subject_id: SUBJECT_ID,
      episode_refs: [EPISODE_REF]
    });
    expect(report.resumed).toHaveLength(1);
    expect(report.resumed[0]?.terminal_kind).toBe("COMPLETE_COMMITTED");
    expect(report.resumed[0]?.provider_calls).toBe(0);
    expect(report.resumed[0]?.proposition_id).toBe(TARGET_PROP);
    expect(report.resumed[0]?.prior_credence).toBe(INITIAL_CREDENCE);
    expect(report.resumed[0]?.next_credence).toBe(INITIAL_CREDENCE + 0.05);
    expect(await credence(world)).toBe(INITIAL_CREDENCE + 0.05);
    // The current offer is its own lawful workflow (different identity): its
    // NO_BEARING disposition commits nothing.
    expect(report.current?.terminal_kind).toBe("COMPLETE_NO_BEARING");
    expect(provider.calls).toBe(1);
  });

  it("§32 stale resume: a non-terminal record whose binding drifted reports RESTART_REQUIRED with zero provider calls and zero commits", async () => {
    // A real B1 record (created by a real direct run, rewound before any
    // provider claim), bound to (revision 0, R1).
    const built = await buildWorld();
    const directDeps = {
      subjectCore: built.core,
      memoryRepository: built.repo as never,
      producerAuthorizationIssuer: built.facade.producerAuthorizationIssuer as never,
      semanticProvider: new ScriptedProvider("NO_BEARING"),
      workflowStore: built.store,
      readCommittedBundle: async () => null
    };
    const directRequest = {
      schema_version: "belief-adaptation-request-v0" as const,
      workflow_id: "wf-belief-adapt-stale-proof",
      subject_id: SUBJECT_ID,
      expected_initial_state_revision: 0,
      expected_repository_revision: "R1",
      proposition_candidate_ids: [TARGET_PROP],
      selected_episodes: [wiringEpisode()]
    };
    const direct = await runBeliefAdaptationWorkflowV0(directDeps, directRequest);
    expect(direct.kind).toBe("COMPLETE_NO_BEARING");
    const completed = (await built.store.load("wf-belief-adapt-stale-proof" as never)) as BeliefAdaptationWorkflowRecordV0;
    const rewound: BeliefAdaptationWorkflowRecordV0 = {
      ...completed,
      stage: "B1_SEMANTIC_PREPARE",
      external_provider_call_count: 0 as const,
      semantic_candidate: null,
      semantic_candidate_fingerprint: null,
      plasticity_receipt: null,
      proposal_checkpoint: null,
      terminal_result: null,
      checkpoint_fingerprint: await deriveBeliefAdaptationWorkflowCheckpointFingerprint({
        ...completed,
        stage: "B1_SEMANTIC_PREPARE",
        external_provider_call_count: 0,
        semantic_candidate: null,
        semantic_candidate_fingerprint: null,
        plasticity_receipt: null,
        proposal_checkpoint: null,
        terminal_result: null,
        checkpoint_fingerprint: "sha256:" + "0".repeat(64)
      } as BeliefAdaptationWorkflowRecordV0)
    };

    // Fresh world: first ADVANCE the canonical binding (a real Belief commit),
    // then seed the stale B1 record.
    const world = await buildWorld();
    const advanceDeps = {
      ...directDeps,
      subjectCore: world.core,
      memoryRepository: world.repo as never,
      producerAuthorizationIssuer: world.facade.producerAuthorizationIssuer as never,
      workflowStore: world.store,
      semanticProvider: new ScriptedProvider("SUPPORTS")
    };
    const advance = await runBeliefAdaptationWorkflowV0(advanceDeps, {
      ...directRequest,
      workflow_id: "wf-belief-adapt-advance-proof"
    });
    expect(advance.kind).toBe("COMPLETE_COMMITTED");
    await world.store.createIfAbsent(rewound);

    const provider = new ScriptedProvider("NO_BEARING");
    const report = await wiringFor(world, provider).runForEpisodeRefs({
      subject_id: SUBJECT_ID,
      episode_refs: [EPISODE_REF]
    });
    // Strict frozen stale policy (MAX_STALE_REBUILDS 0): RESTART_REQUIRED
    // before any provider claim — no rebuild, no rebase, no provider call.
    expect(report.resumed).toHaveLength(1);
    expect(report.resumed[0]?.terminal_kind).toBe("NOT_TERMINAL");
    expect(report.resumed[0]?.detail).toContain("RESTART_REQUIRED");
    expect(report.resumed[0]?.provider_calls).toBe(0);
    // The current offer runs its own lawful workflow (NO_BEARING, no commit).
    expect(report.current?.terminal_kind).toBe("COMPLETE_NO_BEARING");
    expect(provider.calls).toBe(1);
    expect(world.bundles.size).toBe(1); // only the advance commit; no double plasticity
  });
});
