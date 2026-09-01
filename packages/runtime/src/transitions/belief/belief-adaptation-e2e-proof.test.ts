/**
 * Belief Offline Deterministic E2E Proof V0.
 *
 * ONE independent offline deterministic proof exercising the REAL frozen
 * production stack end to end:
 *
 *   verified episode
 *   → frozen Belief Semantic Target Resolution (EXISTING_PROPOSITION / CONTRADICTS)
 *   → frozen BeliefPlasticityProducer (0.60 → 0.5499999999999999)
 *   → frozen Belief Adaptation Workflow V0
 *   → frozen BeliefTransitionExecutor → SubjectCore canonical commit
 *
 * then replays the SAME completed workflow and proves canonical idempotence
 * (zero additional commits, zero additional traces, zero external provider
 * calls).
 *
 * TEST-ONLY: no production behavior is exercised or modified beyond the frozen
 * stack itself. All semantic providers are test-local deterministic — zero
 * real model calls, zero network. The durable workflow store is implemented
 * ONLY here as an in-memory BeliefAdaptationWorkflowStoreV0.
 */

import { beforeAll, describe, expect, it } from "vitest";
import {
  InMemoryMemoryRepository,
  EPISODIC_MEMORY_RECORD_SCHEMA_VERSION,
  SALIENCE_SOURCE_ENCODING_DECLARED,
  type EpisodicMemoryRecordV0
} from "@characteros-next/memory";
import {
  BELIEF_STATE_SCHEMA_VERSION,
  createInMemorySubjectCoreFacade,
  stateHash,
  type AtomicCommitBundleV1,
  type HashV1,
  type InMemoryFacadeAssembly,
  type SubjectStateV0,
  type UnitIntervalV0
} from "@characteros-next/subject-core";
import { s0 } from "../observation/observation-fixtures.js";
import type { SubjectCorePort } from "../../ports/subject-core-port.js";
import {
  BELIEF_SEMANTIC_PROVIDER_OUTPUT_SCHEMA_VERSION,
  type BeliefSemanticTargetResolutionProviderInputV0,
  type BeliefSemanticTargetResolutionProviderV0
} from "./belief-semantic-target-resolution.js";
import {
  BELIEF_ADAPTATION_REQUEST_SCHEMA_VERSION,
  deriveBeliefAdaptationWorkflowCheckpointFingerprint,
  runBeliefAdaptationWorkflowV0,
  type BeliefAdaptationTerminalV0,
  type BeliefAdaptationWorkflowDepsV0,
  type BeliefAdaptationWorkflowRecordV0,
  type BeliefAdaptationWorkflowStoreV0
} from "./belief-adaptation-workflow.js";

const SUBJECT_ID = "subject-s0";
const ALICE = "entity:alice-like";
const PROP_TARGET = "prop.alice-keeps-promises";
const PROP_TARGET_LABEL = "Alice keeps promises";
const PROP_OTHER = "prop.bob-helps";
const PROP_OTHER_LABEL = "Bob helps carry the boxes.";
const INITIAL_CREDENCE = 0.6;
const EPISODE_REF = "episode:ep-promise-broken";
const WORKFLOW_ID = "wf_belief_e2e_proof_1";
const BASE_LOGICAL_TIME = 10;

function unit(value: number): UnitIntervalV0 {
  if (!(value >= 0 && value <= 1)) throw new Error("fixture unit out of range");
  return value as UnitIntervalV0;
}

function identifier(raw: string): never {
  return raw as never;
}

function brokenPromiseEpisode(): EpisodicMemoryRecordV0 {
  return {
    schema_version: EPISODIC_MEMORY_RECORD_SCHEMA_VERSION,
    episode_ref: EPISODE_REF as EpisodicMemoryRecordV0["episode_ref"],
    occurrence_logical_time: 7 as EpisodicMemoryRecordV0["occurrence_logical_time"],
    recorded_at_logical_time: 8 as EpisodicMemoryRecordV0["recorded_at_logical_time"],
    provenance: {
      transition_id: identifier("learning_ep_promise_broken") as never,
      producer: "memory",
      cause_refs: []
    },
    references: [ALICE] as unknown as EpisodicMemoryRecordV0["references"],
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

function initialStateFixture(repositoryRevision: string): SubjectStateV0 {
  const base = s0() as unknown as SubjectStateV0;
  const state: unknown = {
    ...base,
    memory_state: { ...base.memory_state, repository_revision: repositoryRevision as never },
    beliefs: {
      schema_version: BELIEF_STATE_SCHEMA_VERSION,
      items: [
        {
          proposition_id: identifier(PROP_TARGET),
          proposition_label: PROP_TARGET_LABEL,
          credence: unit(INITIAL_CREDENCE)
        },
        {
          proposition_id: identifier(PROP_OTHER),
          proposition_label: PROP_OTHER_LABEL,
          credence: unit(0.4)
        }
      ]
    },
    runtime_metadata: {
      ...base.runtime_metadata,
      logical_time: BASE_LOGICAL_TIME,
      state_revision: 0,
      last_transition_time: null,
      last_transition_type: null,
      updated_at: BASE_LOGICAL_TIME
    },
    trace_window: {
      ...base.trace_window,
      cursor: { last_history_sequence: 0, offloaded_through_sequence: 0, offloaded_through_trace_ref: null },
      entries: []
    }
  };
  return state as unknown as SubjectStateV0;
}

/**
 * ONE test-local deterministic provider. Returns a lawful frozen provider
 * output that echoes the exact request/catalog fingerprints supplied by the
 * frozen runner and selects the real canonical proposition for CONTRADICTS.
 * Never returns numeric credence, delta, confidence, or reasoning authority.
 */
class DeterministicContradictionProvider implements BeliefSemanticTargetResolutionProviderV0 {
  calls = 0;
  lastInput: BeliefSemanticTargetResolutionProviderInputV0 | null = null;

  async propose(input: BeliefSemanticTargetResolutionProviderInputV0): Promise<unknown> {
    this.calls += 1;
    this.lastInput = input;
    return {
      schema_version: BELIEF_SEMANTIC_PROVIDER_OUTPUT_SCHEMA_VERSION,
      semantic_context_fingerprint: input.semantic_context_fingerprint,
      candidate_catalog_fingerprint: input.candidate_catalog_fingerprint,
      kind: "EXISTING_PROPOSITION",
      proposition_id: identifier(PROP_TARGET),
      relation: "CONTRADICTS"
    };
  }
}

/** Deterministic in-memory workflow store (test-only infrastructure). */
class InMemoryBeliefAdaptationWorkflowStoreV0 implements BeliefAdaptationWorkflowStoreV0 {
  readonly records = new Map<string, BeliefAdaptationWorkflowRecordV0>();

  private mutable(workflowId: string): BeliefAdaptationWorkflowRecordV0 {
    const record = this.records.get(workflowId);
    if (record === undefined) throw new Error("store misuse: record missing");
    return record;
  }

  private async write(workflowId: string, next: Omit<BeliefAdaptationWorkflowRecordV0, "checkpoint_fingerprint">): Promise<void> {
    const placeholder = {
      ...next,
      checkpoint_fingerprint: ("sha256:" + "0".repeat(64)) as HashV1
    } as BeliefAdaptationWorkflowRecordV0;
    const fingerprint = await deriveBeliefAdaptationWorkflowCheckpointFingerprint(placeholder);
    this.records.set(workflowId, { ...placeholder, checkpoint_fingerprint: fingerprint });
  }

  async load(workflow_id: string): Promise<BeliefAdaptationWorkflowRecordV0 | null> {
    return this.records.get(workflow_id) ?? null;
  }

  async createIfAbsent(record: BeliefAdaptationWorkflowRecordV0): Promise<"CREATED" | "EXISTING"> {
    if (this.records.has(record.workflow_id)) return "EXISTING";
    this.records.set(record.workflow_id, record);
    return "CREATED";
  }

  async claimProviderCall(workflow_id: string, request_fingerprint: string): Promise<"CLAIMED" | "ALREADY_CLAIMED"> {
    const record = this.mutable(workflow_id);
    if (record.request_fingerprint !== request_fingerprint) throw new Error("store misuse: fingerprint mismatch");
    if (record.external_provider_call_count === 1) return "ALREADY_CLAIMED";
    await this.write(workflow_id, { ...record, external_provider_call_count: 1, stage: "B2_SEMANTIC_PROVIDER_CALL" });
    return "CLAIMED";
  }

  async saveSemanticCandidate(
    workflow_id: string,
    request_fingerprint: string,
    candidate: BeliefAdaptationWorkflowRecordV0["semantic_candidate"],
    candidate_fingerprint: string
  ): Promise<"SAVED" | "CANDIDATE_CONFLICT"> {
    const record = this.mutable(workflow_id);
    if (record.request_fingerprint !== request_fingerprint) throw new Error("store misuse: fingerprint mismatch");
    if (record.semantic_candidate !== null) {
      return JSON.stringify(record.semantic_candidate) === JSON.stringify(candidate) ? "SAVED" : "CANDIDATE_CONFLICT";
    }
    await this.write(workflow_id, {
      ...record,
      semantic_candidate: candidate,
      semantic_candidate_fingerprint: candidate_fingerprint as HashV1,
      stage: "B3_SEMANTIC_CHECKPOINTED"
    });
    return "SAVED";
  }

  async savePlasticityReceipt(
    workflow_id: string,
    request_fingerprint: string,
    receipt: BeliefAdaptationWorkflowRecordV0["plasticity_receipt"]
  ): Promise<"SAVED" | "RECEIPT_CONFLICT"> {
    const record = this.mutable(workflow_id);
    if (record.request_fingerprint !== request_fingerprint) throw new Error("store misuse: fingerprint mismatch");
    if (record.plasticity_receipt !== null) {
      return JSON.stringify(record.plasticity_receipt) === JSON.stringify(receipt) ? "SAVED" : "RECEIPT_CONFLICT";
    }
    await this.write(workflow_id, { ...record, plasticity_receipt: receipt, stage: "B4_PLASTICITY_CHECKPOINTED" });
    return "SAVED";
  }

  async saveProposalCheckpoint(
    workflow_id: string,
    request_fingerprint: string,
    checkpoint: BeliefAdaptationWorkflowRecordV0["proposal_checkpoint"]
  ): Promise<"SAVED" | "CHECKPOINT_CONFLICT"> {
    const record = this.mutable(workflow_id);
    if (record.request_fingerprint !== request_fingerprint) throw new Error("store misuse: fingerprint mismatch");
    if (record.proposal_checkpoint !== null) {
      return JSON.stringify(record.proposal_checkpoint) === JSON.stringify(checkpoint) ? "SAVED" : "CHECKPOINT_CONFLICT";
    }
    await this.write(workflow_id, { ...record, proposal_checkpoint: checkpoint, stage: "B5_PROPOSAL_PREPARED" });
    return "SAVED";
  }

  async compareAndSetStage(
    workflow_id: string,
    request_fingerprint: string,
    from: BeliefAdaptationWorkflowRecordV0["stage"],
    to: BeliefAdaptationWorkflowRecordV0["stage"]
  ): Promise<"SET" | "STAGE_CONFLICT"> {
    const record = this.mutable(workflow_id);
    if (record.request_fingerprint !== request_fingerprint) throw new Error("store misuse: fingerprint mismatch");
    if (record.stage !== from) return "STAGE_CONFLICT";
    await this.write(workflow_id, { ...record, stage: to });
    return "SET";
  }

  async saveTerminalResult(
    workflow_id: string,
    request_fingerprint: string,
    terminal: BeliefAdaptationTerminalV0
  ): Promise<"SAVED" | "TERMINAL_CONFLICT"> {
    const record = this.mutable(workflow_id);
    if (record.request_fingerprint !== request_fingerprint) throw new Error("store misuse: fingerprint mismatch");
    if (record.terminal_result !== null) {
      return JSON.stringify(record.terminal_result) === JSON.stringify(terminal) ? "SAVED" : "TERMINAL_CONFLICT";
    }
    await this.write(workflow_id, { ...record, terminal_result: terminal, stage: "B7_COMPLETE" });
    return "SAVED";
  }
}

interface E2EWorld {
  readonly deps: BeliefAdaptationWorkflowDepsV0;
  readonly store: InMemoryBeliefAdaptationWorkflowStoreV0;
  readonly provider: DeterministicContradictionProvider;
  readonly initialState: SubjectStateV0;
  readonly episode: EpisodicMemoryRecordV0;
  readonly committedBundles: Map<string, AtomicCommitBundleV1>;
  readonly facade: InMemoryFacadeAssembly;
}

async function buildE2EWorld(): Promise<E2EWorld> {
  const repository = new InMemoryMemoryRepository();
  await repository.prepareRevision({ parent_revision: null, records: [] });
  const episode = brokenPromiseEpisode();
  const payloadHash = await repository.storePayload(episode.episode_ref, episode);
  await repository.prepareRevision({
    parent_revision: "R0" as never,
    records: [{ ref: episode.episode_ref, payload_hash: payloadHash } as never]
  });
  const initialState = initialStateFixture("R1");
  const facade = createInMemorySubjectCoreFacade({
    seedSnapshots: new Map([[SUBJECT_ID as never, initialState]]),
    preparedResultValidator: async (binding) => binding.prepared_result_ref.startsWith("workflow:"),
    referenceValidator: async () => true,
    memoryAdoptionValidator: async () => false
  });
  const committedBundles = new Map<string, AtomicCommitBundleV1>();
  const port: SubjectCorePort = {
    reserveAndRoute: (proposal) => facade.facade.reserveAndRoute(proposal),
    commitReserved: async (input) => {
      const bundle = await facade.facade.commitReserved(input);
      if (bundle.kind === "COMMITTED") {
        committedBundles.set(bundle.bundle.transition_id, bundle.bundle);
      }
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
  const provider = new DeterministicContradictionProvider();
  const store = new InMemoryBeliefAdaptationWorkflowStoreV0();
  const deps: BeliefAdaptationWorkflowDepsV0 = {
    subjectCore: port,
    memoryRepository: repository,
    producerAuthorizationIssuer: facade.producerAuthorizationIssuer,
    semanticProvider: provider,
    workflowStore: store,
    readCommittedBundle: async (transitionId) => committedBundles.get(transitionId) ?? null
  };
  return { deps, store, provider, initialState, episode, committedBundles, facade };
}

function canonicalE2ERequest(world: E2EWorld): Record<string, unknown> {
  return {
    schema_version: BELIEF_ADAPTATION_REQUEST_SCHEMA_VERSION,
    workflow_id: WORKFLOW_ID,
    subject_id: SUBJECT_ID,
    expected_initial_state_revision: 0,
    expected_repository_revision: "R1",
    proposition_candidate_ids: [PROP_TARGET, PROP_OTHER],
    selected_episodes: [world.episode]
  };
}

function committedSnapshot(world: E2EWorld): SubjectStateV0 {
  const bundle = world.facade.storeRead.readCurrentBundle(SUBJECT_ID as never);
  if (bundle === null) throw new Error("expected a committed bundle");
  return bundle.next_snapshot;
}

describe("Belief Offline Deterministic E2E Proof V0", () => {
  let world: E2EWorld;
  let request: Record<string, unknown>;
  let beforeHash: string;
  let firstTerminal: BeliefAdaptationTerminalV0;
  let afterFirst: SubjectStateV0;
  let afterFirstHash: string;

  beforeAll(async () => {
    world = await buildE2EWorld();
    request = canonicalE2ERequest(world);
    beforeHash = await stateHash(world.initialState);
    firstTerminal = await runBeliefAdaptationWorkflowV0(world.deps, request);
    afterFirst = committedSnapshot(world);
    afterFirstHash = await stateHash(afterFirst);
  });

  it("first run: verified episode → CONTRADICTS → frozen plasticity 0.60 → 0.5499999999999999 → exactly one canonical commit", async () => {
    // §9 semantic proof: the workflow itself owns the frozen semantic runner.
    expect(world.provider.calls).toBe(1);
    expect(world.provider.lastInput).not.toBeNull();
    expect(world.provider.lastInput?.semantic_context_fingerprint).toBeTruthy();
    expect(world.provider.lastInput?.candidate_catalog_fingerprint).toBeTruthy();
    const record = world.store.records.get(WORKFLOW_ID);
    expect(record?.stage).toBe("B7_COMPLETE");

    // §10 plasticity proof: the frozen PlasticityProducer is the ONLY numeric
    // authority. Exact JavaScript arithmetic — never rounded to 0.55.
    const receipt = record?.plasticity_receipt ?? null;
    expect(receipt).not.toBeNull();
    expect(receipt?.outcome).toEqual({ kind: "CREDENCE_CHANGE", next_credence: 0.5499999999999999 });

    // §11 canonical commit proof.
    expect(firstTerminal.kind).toBe("COMPLETE_COMMITTED");
    if (firstTerminal.kind !== "COMPLETE_COMMITTED") throw new Error("unreachable");
    expect(firstTerminal.canonical_commits).toBe(1);
    expect(world.committedBundles.size).toBe(1);
    expect(afterFirst.runtime_metadata.state_revision).toBe(world.initialState.runtime_metadata.state_revision + 1);
    expect(afterFirst.runtime_metadata.logical_time).toBe(BASE_LOGICAL_TIME);

    // Target Belief changed to the frozen plasticity value; nothing rounded.
    const target = afterFirst.beliefs.items.find((item) => item.proposition_id === PROP_TARGET);
    expect(target).toBeDefined();
    expect(target?.proposition_id).toBe(PROP_TARGET);
    expect(target?.proposition_label).toBe(PROP_TARGET_LABEL);
    expect(target?.credence).toBe(0.5499999999999999);
    expect(target?.credence).toBe(receipt?.outcome.kind === "CREDENCE_CHANGE" ? receipt.outcome.next_credence : NaN);

    // §12 target isolation: no cross-domain cascade.
    const other = afterFirst.beliefs.items.find((item) => item.proposition_id === PROP_OTHER);
    expect(other?.proposition_label).toBe(PROP_OTHER_LABEL);
    expect(other?.credence).toBe(0.4);
    expect(afterFirst.beliefs.items.length).toBe(2);
    expect(JSON.stringify(afterFirst.personality)).toBe(JSON.stringify(world.initialState.personality));
    expect(JSON.stringify(afterFirst.relationships)).toBe(JSON.stringify(world.initialState.relationships));
    expect(JSON.stringify(afterFirst.memory_state)).toBe(JSON.stringify(world.initialState.memory_state));

    // §13 trace proof: exactly one new Belief trace entry caused by the
    // exact verified episode; no model reasoning as canonical authority.
    expect(afterFirst.trace_window.entries.length).toBe(1);
    expect(afterFirst.trace_window.cursor.last_history_sequence).toBe(1);
    const trace = afterFirst.trace_window.entries[0];
    expect(trace?.transition_type).toBe("Belief");
    expect(trace?.cause_refs).toContain(world.episode.episode_ref);

    // §14 state hash proof: canonical credence + revision changed.
    expect(afterFirstHash).not.toBe(beforeHash);
    expect(firstTerminal.snapshot_hash).toBe(afterFirstHash);
  });

  it("completed replay: same terminal, zero additional commits, traces, and provider calls", async () => {
    const revisionAfterFirst = afterFirst.runtime_metadata.state_revision;
    const traceCountAfterFirst = afterFirst.trace_window.entries.length;
    const logicalTimeAfterFirst = afterFirst.runtime_metadata.logical_time;
    const providerCallsAfterFirst = world.provider.calls;
    const bundlesAfterFirst = world.committedBundles.size;
    expect(providerCallsAfterFirst).toBe(1);
    expect(bundlesAfterFirst).toBe(1);

    // §15: SAME workflow_id, SAME exact request, SAME durable store.
    const replay = await runBeliefAdaptationWorkflowV0(world.deps, request);
    expect(replay).toEqual(firstTerminal);

    // §17 provider call authority: a completed terminal replay performs no
    // external provider calls and no local replay-provider invocations.
    expect(world.provider.calls).toBe(providerCallsAfterFirst);
    expect(world.committedBundles.size).toBe(bundlesAfterFirst);

    // §16 replay state identity: observationally canonical-idempotent.
    const afterReplay = committedSnapshot(world);
    expect(afterReplay.runtime_metadata.state_revision).toBe(revisionAfterFirst);
    expect(afterReplay.trace_window.entries.length).toBe(traceCountAfterFirst);
    expect(afterReplay.runtime_metadata.logical_time).toBe(logicalTimeAfterFirst);
    const target = afterReplay.beliefs.items.find((item) => item.proposition_id === PROP_TARGET);
    expect(target?.credence).toBe(0.5499999999999999);
    expect(await stateHash(afterReplay)).toBe(afterFirstHash);
  });
});
