/**
 * Belief Adaptation Workflow V0 — durable runtime tests.
 *
 * All semantic providers are test-local deterministic (zero real model calls,
 * zero network). The durable workflow store is implemented ONLY here (§53):
 * create-once / claim-once / CAS / write-once semantics plus optional crash
 * injection points used to simulate exact crash windows.
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
  isAuthorizedBeliefSemanticTargetResolutionV0,
  type BeliefSemanticTargetResolutionProviderInputV0,
  type BeliefSemanticTargetResolutionProviderV0
} from "./belief-semantic-target-resolution.js";
import { isAuthorizedBeliefPlasticityResultV0 } from "./belief-plasticity-producer.js";
import {
  BELIEF_MUTATION_PROPOSAL_SCHEMA_VERSION,
  deriveBeliefEvidenceMemberSetFingerprint,
  deriveBeliefTransitionId,
  type BeliefMutationProposalV0
} from "./belief-mutation-proposal.js";
import { BeliefTransitionExecutor } from "./belief-transition-executor.js";
import {
  BELIEF_ADAPTATION_REQUEST_SCHEMA_VERSION,
  BELIEF_WORKFLOW_MAX_EXTERNAL_SEMANTIC_CALLS,
  BELIEF_WORKFLOW_MAX_STALE_REBUILDS,
  deriveBeliefAdaptationWorkflowCheckpointFingerprint,
  runBeliefAdaptationWorkflowV0,
  type BeliefAdaptationTerminalV0,
  type BeliefAdaptationWorkflowDepsV0,
  type BeliefAdaptationWorkflowRecordV0,
  type BeliefAdaptationWorkflowStoreV0
} from "./belief-adaptation-workflow.js";

const SUBJECT_ID = "subject-s0";
const ALICE = "entity:alice-like";
const PROP_A = "prop.alice-keeps-plans";
const PROP_B = "prop.bob-helps";
const WORKFLOW_ID = "wf_belief_adaptation_1";
const BASE_LOGICAL_TIME = 10;
const SECRET_LABEL = "SOME_UNIQUE_SECRET_LABEL_12345";

function unit(value: number): UnitIntervalV0 {
  if (!(value >= 0 && value <= 1)) throw new Error("fixture unit out of range");
  return value as UnitIntervalV0;
}

function identifier(raw: string): never {
  return raw as never;
}

function recordFixture(episodeRef: string, scene: string, occurrenceLogicalTime: number): EpisodicMemoryRecordV0 {
  return {
    schema_version: EPISODIC_MEMORY_RECORD_SCHEMA_VERSION,
    episode_ref: episodeRef as EpisodicMemoryRecordV0["episode_ref"],
    occurrence_logical_time: occurrenceLogicalTime as EpisodicMemoryRecordV0["occurrence_logical_time"],
    recorded_at_logical_time: (occurrenceLogicalTime + 1) as EpisodicMemoryRecordV0["recorded_at_logical_time"],
    provenance: {
      transition_id: identifier(`learning_${episodeRef.replace(/[^a-z0-9]/gi, "_")}`) as never,
      producer: "memory",
      cause_refs: []
    },
    references: [ALICE] as unknown as EpisodicMemoryRecordV0["references"],
    context: { scene, focus_refs: [], environment_refs: [] },
    appraisal_ref: null,
    affect_snapshot_ref: null,
    salience: { declared_score: unit(0.8), source: SALIENCE_SOURCE_ENCODING_DECLARED }
  };
}

function baseRecords(): EpisodicMemoryRecordV0[] {
  const scenes = [
    "Alice kept the plan and arrived early.",
    "Alice apologized and rescheduled.",
    "Alice confirmed the plan again the next day."
  ];
  const records: EpisodicMemoryRecordV0[] = [];
  for (let i = 0; i < 3; i++) {
    records.push(recordFixture(`episode:ep-${String(i + 1).padStart(2, "0")}`, scenes[i] ?? `Shared experience ${i}.`, 7 + i));
  }
  return records;
}

interface BeliefItemFixture {
  readonly proposition_id: string;
  readonly proposition_label: string;
  readonly credence: number;
}

function defaultBeliefItems(): BeliefItemFixture[] {
  return [
    { proposition_id: PROP_A, proposition_label: "Alice keeps her plans.", credence: 0.6 },
    { proposition_id: PROP_B, proposition_label: "Bob helps carry the boxes.", credence: 0.4 }
  ];
}

interface StateOptions {
  readonly beliefItems?: readonly BeliefItemFixture[];
  readonly logicalTime?: number;
}

function subjectStateFixture(repositoryRevision: string, options: StateOptions = {}): SubjectStateV0 {
  const base = s0() as unknown as SubjectStateV0;
  const logicalTime = options.logicalTime ?? BASE_LOGICAL_TIME;
  const items = options.beliefItems ?? defaultBeliefItems();
  const state: unknown = {
    ...base,
    memory_state: { ...base.memory_state, repository_revision: repositoryRevision as never },
    beliefs: {
      schema_version: BELIEF_STATE_SCHEMA_VERSION,
      items: items.map((item) => ({
        proposition_id: identifier(item.proposition_id),
        proposition_label: item.proposition_label,
        credence: unit(item.credence)
      }))
    },
    runtime_metadata: {
      ...base.runtime_metadata,
      logical_time: logicalTime,
      state_revision: 0,
      last_transition_time: null,
      last_transition_type: null,
      updated_at: logicalTime
    },
    trace_window: {
      ...base.trace_window,
      cursor: { last_history_sequence: 0, offloaded_through_sequence: 0, offloaded_through_trace_ref: null },
      entries: []
    }
  };
  return state as unknown as SubjectStateV0;
}

type ProviderMode = "SUPPORTS" | "CONTRADICTS" | "NO_BEARING" | "NEW" | "THROW" | "INVALID" | "INVENTED_ID";

class TrackingBeliefProvider implements BeliefSemanticTargetResolutionProviderV0 {
  calls = 0;

  constructor(
    private readonly mode: ProviderMode,
    private readonly targetId: string = PROP_A,
    private readonly newLabel: string = SECRET_LABEL
  ) {}

  async propose(input: BeliefSemanticTargetResolutionProviderInputV0): Promise<unknown> {
    this.calls += 1;
    if (this.mode === "THROW") throw new Error("semantic provider offline");
    const bindings = {
      schema_version: BELIEF_SEMANTIC_PROVIDER_OUTPUT_SCHEMA_VERSION,
      semantic_context_fingerprint: input.semantic_context_fingerprint,
      candidate_catalog_fingerprint: input.candidate_catalog_fingerprint
    };
    if (this.mode === "INVALID") return { schema_version: "wrong-schema", kind: "NO_BEARING" };
    if (this.mode === "NO_BEARING") return { ...bindings, kind: "NO_BEARING" };
    if (this.mode === "NEW") return { ...bindings, kind: "NEW_PROPOSITION_CANDIDATE", proposed_label: this.newLabel };
    return {
      ...bindings,
      kind: "EXISTING_PROPOSITION",
      proposition_id: identifier(this.mode === "INVENTED_ID" ? "prop.invented" : this.targetId),
      relation: this.mode === "CONTRADICTS" ? "CONTRADICTS" : "SUPPORTS"
    };
  }
}

/** Deterministic in-memory workflow store (test-only infrastructure, §53). */
class InMemoryBeliefAdaptationWorkflowStoreV0 implements BeliefAdaptationWorkflowStoreV0 {
  readonly records = new Map<string, BeliefAdaptationWorkflowRecordV0>();
  crashAfterClaim = false;
  crashAfterSemanticCandidate = false;
  crashAfterPlasticityReceipt = false;
  crashAfterProposalCheckpoint = false;
  crashOnSaveTerminal = false;

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
    if (this.crashAfterClaim) throw new Error("simulated crash after provider claim");
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
    if (this.crashAfterSemanticCandidate) throw new Error("simulated crash after semantic candidate checkpoint");
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
    if (this.crashAfterPlasticityReceipt) throw new Error("simulated crash after plasticity receipt");
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
    if (this.crashAfterProposalCheckpoint) throw new Error("simulated crash after proposal checkpoint");
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
    if (this.crashOnSaveTerminal) throw new Error("simulated crash before terminal persistence");
    const record = this.mutable(workflow_id);
    if (record.request_fingerprint !== request_fingerprint) throw new Error("store misuse: fingerprint mismatch");
    if (record.terminal_result !== null) {
      return JSON.stringify(record.terminal_result) === JSON.stringify(terminal) ? "SAVED" : "TERMINAL_CONFLICT";
    }
    await this.write(workflow_id, { ...record, terminal_result: terminal, stage: "B7_COMPLETE" });
    return "SAVED";
  }
}

interface WorldOptions {
  readonly decision?: ProviderMode;
  readonly state?: SubjectStateV0;
  readonly records?: readonly EpisodicMemoryRecordV0[];
  readonly nullBundleLookup?: boolean;
  readonly newLabel?: string;
}

async function buildWorld(options: WorldOptions = {}): Promise<{
  deps: BeliefAdaptationWorkflowDepsV0;
  store: InMemoryBeliefAdaptationWorkflowStoreV0;
  provider: TrackingBeliefProvider;
  repository: InMemoryMemoryRepository;
  records: readonly EpisodicMemoryRecordV0[];
  state: SubjectStateV0;
  committedBundles: Map<string, AtomicCommitBundleV1>;
  facade: InMemoryFacadeAssembly;
  port: SubjectCorePort;
}> {
  const repository = new InMemoryMemoryRepository();
  await repository.prepareRevision({ parent_revision: null, records: [] });
  const records = options.records ?? baseRecords();
  const hashes = [];
  for (const record of records) {
    hashes.push({ ref: record.episode_ref, payload_hash: await repository.storePayload(record.episode_ref, record) });
  }
  await repository.prepareRevision({ parent_revision: "R0" as never, records: hashes as never });
  const state = options.state ?? subjectStateFixture("R1");
  const facade = createInMemorySubjectCoreFacade({
    seedSnapshots: new Map([[SUBJECT_ID as never, state]]),
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
      return bundle === null ? state : bundle.next_snapshot;
    }
  };
  const provider = new TrackingBeliefProvider(options.decision ?? "SUPPORTS", PROP_A, options.newLabel ?? SECRET_LABEL);
  const store = new InMemoryBeliefAdaptationWorkflowStoreV0();
  const deps: BeliefAdaptationWorkflowDepsV0 = {
    subjectCore: port,
    memoryRepository: repository,
    producerAuthorizationIssuer: facade.producerAuthorizationIssuer,
    semanticProvider: provider,
    workflowStore: store,
    readCommittedBundle:
      options.nullBundleLookup === true
        ? async () => null
        : async (transitionId) => committedBundles.get(transitionId) ?? null
  };
  return { deps, store, provider, repository, records, state, committedBundles, facade, port };
}

function canonicalRequest(
  world: Awaited<ReturnType<typeof buildWorld>>,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    schema_version: BELIEF_ADAPTATION_REQUEST_SCHEMA_VERSION,
    workflow_id: WORKFLOW_ID,
    subject_id: SUBJECT_ID,
    expected_initial_state_revision: 0,
    expected_repository_revision: "R1",
    proposition_candidate_ids: [PROP_A, PROP_B],
    selected_episodes: world.records,
    ...overrides
  };
}

function committedSnapshot(world: Awaited<ReturnType<typeof buildWorld>>): SubjectStateV0 {
  const bundle = world.facade.storeRead.readCurrentBundle(SUBJECT_ID);
  if (bundle === null) throw new Error("expected a committed bundle");
  return bundle.next_snapshot;
}

function expectedNextCredence(current: number, relation: "SUPPORTS" | "CONTRADICTS"): number {
  const step = relation === "SUPPORTS" ? 0.05 : -0.05;
  return Math.max(0, Math.min(1, current + step));
}

async function tamperRecord(
  world: Awaited<ReturnType<typeof buildWorld>>,
  mutate: (record: BeliefAdaptationWorkflowRecordV0) => BeliefAdaptationWorkflowRecordV0,
  options: { recomputeFingerprint?: boolean } = {}
): Promise<void> {
  const record = world.store.records.get(WORKFLOW_ID);
  if (record === undefined) throw new Error("tamper target missing");
  const mutated = mutate(JSON.parse(JSON.stringify(record)) as BeliefAdaptationWorkflowRecordV0);
  if (options.recomputeFingerprint !== false) {
    const fingerprint = await deriveBeliefAdaptationWorkflowCheckpointFingerprint(mutated);
    world.store.records.set(WORKFLOW_ID, { ...mutated, checkpoint_fingerprint: fingerprint });
  } else {
    world.store.records.set(WORKFLOW_ID, mutated);
  }
}

describe("Belief Adaptation Workflow V0 — normal success (§56)", () => {
  it("commits a SUPPORTS UPDATE with all canonical success invariants", async () => {
    const world = await buildWorld();
    const terminal = await runBeliefAdaptationWorkflowV0(world.deps, canonicalRequest(world));
    expect(terminal.kind).toBe("COMPLETE_COMMITTED");
    if (terminal.kind !== "COMPLETE_COMMITTED") throw new Error("unreachable");
    expect(terminal.canonical_commits).toBe(1);
    expect(world.provider.calls).toBe(BELIEF_WORKFLOW_MAX_EXTERNAL_SEMANTIC_CALLS);
    expect(world.committedBundles.size).toBe(1);

    const after = committedSnapshot(world);
    expect(after.runtime_metadata.state_revision).toBe(1);
    expect(after.runtime_metadata.logical_time).toBe(BASE_LOGICAL_TIME);
    expect(after.trace_window.cursor.last_history_sequence).toBe(1);
    expect(after.trace_window.entries.length).toBe(1);

    const target = after.beliefs.items.find((item) => item.proposition_id === PROP_A);
    const other = after.beliefs.items.find((item) => item.proposition_id === PROP_B);
    expect(target?.credence).toBe(expectedNextCredence(0.6, "SUPPORTS"));
    expect(other?.credence).toBe(0.4);
    expect(JSON.stringify(after.personality)).toBe(JSON.stringify(world.state.personality));
    expect(JSON.stringify(after.relationships)).toBe(JSON.stringify(world.state.relationships));
    expect(JSON.stringify(after.memory_state)).toBe(JSON.stringify(world.state.memory_state));

    // next_credence authority comes ONLY from the frozen PlasticityProducer law.
    const record = world.store.records.get(WORKFLOW_ID);
    expect(record?.stage).toBe("B7_COMPLETE");
    const checkpoint = record?.proposal_checkpoint;
    expect(checkpoint?.proposal.mutation).toEqual({
      kind: "UPDATE",
      proposition_id: PROP_A,
      next_credence: expectedNextCredence(0.6, "SUPPORTS")
    });
    expect(checkpoint?.plasticity_output_fingerprint).toBe(record?.plasticity_receipt?.output_fingerprint);
  });

  it("commits a CONTRADICTS UPDATE from the frozen plasticity law", async () => {
    const world = await buildWorld({ decision: "CONTRADICTS" });
    const terminal = await runBeliefAdaptationWorkflowV0(world.deps, canonicalRequest(world));
    expect(terminal.kind).toBe("COMPLETE_COMMITTED");
    const after = committedSnapshot(world);
    const target = after.beliefs.items.find((item) => item.proposition_id === PROP_A);
    expect(target?.credence).toBe(expectedNextCredence(0.6, "CONTRADICTS"));
    expect(world.committedBundles.size).toBe(1);
  });
});

describe("Belief Adaptation Workflow V0 — no-commit terminals (§57)", () => {
  it("NO_BEARING terminalizes with zero plasticity and zero commit", async () => {
    const world = await buildWorld({ decision: "NO_BEARING" });
    const terminal = await runBeliefAdaptationWorkflowV0(world.deps, canonicalRequest(world));
    expect(terminal).toMatchObject({ kind: "COMPLETE_NO_BEARING", canonical_commits: 0 });
    expect(world.committedBundles.size).toBe(0);
    const record = world.store.records.get(WORKFLOW_ID);
    expect(record?.plasticity_receipt).toBeNull();
    expect(record?.proposal_checkpoint).toBeNull();
    expect(record?.semantic_candidate?.kind).toBe("NO_BEARING");
  });

  it("NEW candidate terminalizes generically and never persists the label (§69)", async () => {
    const world = await buildWorld({ decision: "NEW" });
    const terminal = await runBeliefAdaptationWorkflowV0(world.deps, canonicalRequest(world));
    expect(terminal).toMatchObject({
      kind: "COMPLETE_NEW_PROPOSITION_CANDIDATE_OBSERVED",
      canonical_commits: 0
    });
    expect(world.committedBundles.size).toBe(0);
    const record = world.store.records.get(WORKFLOW_ID);
    expect(record?.semantic_candidate).toBeNull();
    expect(JSON.stringify(record)).not.toContain(SECRET_LABEL);
    const current = await world.deps.subjectCore.readCurrentSnapshot(SUBJECT_ID as never);
    if (current === null) throw new Error("expected a current snapshot");
    expect(JSON.stringify(current)).not.toContain(SECRET_LABEL);
    expect(JSON.stringify(current.beliefs)).toBe(JSON.stringify(world.state.beliefs));
  });

  it("SATURATED terminalizes COMPLETE_NO_CHANGE with zero proposal and zero executor commit", async () => {
    const world = await buildWorld({
      state: subjectStateFixture("R1", {
        beliefItems: [
          { proposition_id: PROP_A, proposition_label: "Alice keeps her plans.", credence: 1 },
          { proposition_id: PROP_B, proposition_label: "Bob helps carry the boxes.", credence: 0.4 }
        ]
      })
    });
    const terminal = await runBeliefAdaptationWorkflowV0(world.deps, canonicalRequest(world));
    expect(terminal).toMatchObject({ kind: "COMPLETE_NO_CHANGE", reason: "SATURATED", canonical_commits: 0 });
    expect(world.committedBundles.size).toBe(0);
    const record = world.store.records.get(WORKFLOW_ID);
    expect(record?.proposal_checkpoint).toBeNull();
    expect(record?.plasticity_receipt?.outcome).toEqual({ kind: "NO_CHANGE", reason: "SATURATED" });
  });

  it("terminal replay returns the byte-equivalent terminal with zero additional commits (§44/§64)", async () => {
    const world = await buildWorld();
    const first = await runBeliefAdaptationWorkflowV0(world.deps, canonicalRequest(world));
    expect(first.kind).toBe("COMPLETE_COMMITTED");
    const bundlesAfterFirst = world.committedBundles.size;
    const providerCallsAfterFirst = world.provider.calls;
    const replay = await runBeliefAdaptationWorkflowV0(world.deps, canonicalRequest(world));
    expect(replay).toEqual(first);
    expect(world.committedBundles.size).toBe(bundlesAfterFirst);
    expect(world.provider.calls).toBe(providerCallsAfterFirst);
    expect(committedSnapshot(world).runtime_metadata.state_revision).toBe(1);
  });
});

describe("Belief Adaptation Workflow V0 — capability restore (§58)", () => {
  it("serialized semantic/plasticity objects are never authorized; resume remints through the frozen runner", async () => {
    const world = await buildWorld();
    const terminal = await runBeliefAdaptationWorkflowV0(world.deps, canonicalRequest(world));
    expect(terminal.kind).toBe("COMPLETE_COMMITTED");
    const record = world.store.records.get(WORKFLOW_ID);
    const receipt = record?.plasticity_receipt ?? null;
    const checkpoint = record?.proposal_checkpoint ?? null;
    expect(receipt !== null && checkpoint !== null).toBe(true);
    if (receipt === null || checkpoint === null) throw new Error("unreachable");

    // A structurally identical JSON reconstruction FAILS both capability checks.
    const receiptClone = JSON.parse(JSON.stringify(receipt));
    expect(isAuthorizedBeliefPlasticityResultV0(receiptClone)).toBe(false);
    const clonedResolution = {
      schema_version: "belief-semantic-target-resolution-v0",
      subject_id: SUBJECT_ID,
      state_revision: 0,
      repository_revision: "R1",
      semantic_context_fingerprint: receipt.semantic_context_fingerprint,
      candidate_catalog_fingerprint: receipt.candidate_catalog_fingerprint,
      evidence_binding: receipt.evidence_binding,
      decision: { kind: "EXISTING_PROPOSITION", proposition_id: PROP_A, relation: "SUPPORTS" }
    };
    expect(isAuthorizedBeliefSemanticTargetResolutionV0(clonedResolution)).toBe(false);
  });
});

describe("Belief Adaptation Workflow V0 — crash/resume (§59-§63)", () => {
  it("crash after semantic checkpoint: external calls stay 1, replay remints, commit exactly once", async () => {
    const world = await buildWorld();
    world.store.crashAfterSemanticCandidate = true;
    await expect(runBeliefAdaptationWorkflowV0(world.deps, canonicalRequest(world))).rejects.toThrow(
      "simulated crash after semantic candidate checkpoint"
    );
    expect(world.provider.calls).toBe(1);
    expect(world.committedBundles.size).toBe(0);

    world.store.crashAfterSemanticCandidate = false;
    const terminal = await runBeliefAdaptationWorkflowV0(world.deps, canonicalRequest(world));
    expect(terminal.kind).toBe("COMPLETE_COMMITTED");
    expect(world.provider.calls).toBe(1);
    expect(world.committedBundles.size).toBe(1);
  });

  it("crash after plasticity receipt: recompute matches the receipt fingerprint, commit once", async () => {
    const world = await buildWorld();
    world.store.crashAfterPlasticityReceipt = true;
    await expect(runBeliefAdaptationWorkflowV0(world.deps, canonicalRequest(world))).rejects.toThrow(
      "simulated crash after plasticity receipt"
    );
    expect(world.provider.calls).toBe(1);

    world.store.crashAfterPlasticityReceipt = false;
    const terminal = await runBeliefAdaptationWorkflowV0(world.deps, canonicalRequest(world));
    expect(terminal.kind).toBe("COMPLETE_COMMITTED");
    expect(world.provider.calls).toBe(1);
    expect(world.committedBundles.size).toBe(1);
    expect(committedSnapshot(world).runtime_metadata.state_revision).toBe(1);
  });

  it("proposal-before-executor crash: exact proposal replay commits exactly once (§61/§34)", async () => {
    const world = await buildWorld();
    world.store.crashAfterProposalCheckpoint = true;
    await expect(runBeliefAdaptationWorkflowV0(world.deps, canonicalRequest(world))).rejects.toThrow(
      "simulated crash after proposal checkpoint"
    );
    expect(world.committedBundles.size).toBe(0);
    expect(world.provider.calls).toBe(1);

    world.store.crashAfterProposalCheckpoint = false;
    const checkpointBefore = world.store.records.get(WORKFLOW_ID)?.proposal_checkpoint;
    expect(checkpointBefore).not.toBeNull();
    const expectedTransitionId = checkpointBefore?.transition_id;

    const terminal = await runBeliefAdaptationWorkflowV0(world.deps, canonicalRequest(world));
    expect(terminal.kind).toBe("COMPLETE_COMMITTED");
    if (terminal.kind !== "COMPLETE_COMMITTED") throw new Error("unreachable");
    expect(terminal.transition_id).toBe(expectedTransitionId);
    expect(world.provider.calls).toBe(1);
    expect(world.committedBundles.size).toBe(1);
    expect(committedSnapshot(world).runtime_metadata.state_revision).toBe(1);
  });

  it("commit-before-terminal crash: journal reconciliation terminalizes without a second revision (§62 path A)", async () => {
    const world = await buildWorld();
    world.store.crashOnSaveTerminal = true;
    await expect(runBeliefAdaptationWorkflowV0(world.deps, canonicalRequest(world))).rejects.toThrow(
      "simulated crash before terminal persistence"
    );
    expect(world.committedBundles.size).toBe(1);
    expect(committedSnapshot(world).runtime_metadata.state_revision).toBe(1);
    expect(world.store.records.get(WORKFLOW_ID)?.terminal_result).toBeNull();

    world.store.crashOnSaveTerminal = false;
    const terminal = await runBeliefAdaptationWorkflowV0(world.deps, canonicalRequest(world));
    expect(terminal.kind).toBe("COMPLETE_ALREADY_COMMITTED");
    if (terminal.kind !== "COMPLETE_ALREADY_COMMITTED") throw new Error("unreachable");
    expect(terminal.canonical_commits).toBe(0);
    expect(terminal.final_state_revision).toBe(1);
    expect(world.committedBundles.size).toBe(1);
    expect(committedSnapshot(world).runtime_metadata.state_revision).toBe(1);
    expect(committedSnapshot(world).trace_window.entries.length).toBe(1);
  });

  it("commit-before-terminal crash without bundle lookup: exact executor replay returns ALREADY_COMMITTED (§35 path B)", async () => {
    const world = await buildWorld({ nullBundleLookup: true });
    world.store.crashOnSaveTerminal = true;
    await expect(runBeliefAdaptationWorkflowV0(world.deps, canonicalRequest(world))).rejects.toThrow(
      "simulated crash before terminal persistence"
    );
    expect(committedSnapshot(world).runtime_metadata.state_revision).toBe(1);

    world.store.crashOnSaveTerminal = false;
    const terminal = await runBeliefAdaptationWorkflowV0(world.deps, canonicalRequest(world));
    expect(terminal.kind).toBe("COMPLETE_ALREADY_COMMITTED");
    expect(world.committedBundles.size).toBe(1);
    expect(committedSnapshot(world).runtime_metadata.state_revision).toBe(1);
    expect(committedSnapshot(world).trace_window.entries.length).toBe(1);
  });

  it("provider claim gap: PROVIDER_OUTCOME_UNKNOWN without provider recall (§63)", async () => {
    const world = await buildWorld();
    world.store.crashAfterClaim = true;
    await expect(runBeliefAdaptationWorkflowV0(world.deps, canonicalRequest(world))).rejects.toThrow(
      "simulated crash after provider claim"
    );
    // The claim is persisted BEFORE the external call: the crash window leaves
    // the claim durable while the provider was never invoked.
    expect(world.provider.calls).toBe(0);

    world.store.crashAfterClaim = false;
    const terminal = await runBeliefAdaptationWorkflowV0(world.deps, canonicalRequest(world));
    expect(terminal).toMatchObject({
      kind: "RESTART_REQUIRED",
      scope: "NEW_WORKFLOW_ID",
      code: "PROVIDER_OUTCOME_UNKNOWN",
      canonical_commits: 0
    });
    expect(world.provider.calls).toBe(0);
    expect(world.committedBundles.size).toBe(0);
  });
});

describe("Belief Adaptation Workflow V0 — identity and reuse (§64)", () => {
  it("changed evidence / candidate ids / subject under one workflow_id are fatal identity conflicts", async () => {
    const world = await buildWorld();
    const completed = await runBeliefAdaptationWorkflowV0(world.deps, canonicalRequest(world));
    expect(completed.kind).toBe("COMPLETE_COMMITTED");

    const changedEvidence = await runBeliefAdaptationWorkflowV0(
      world.deps,
      canonicalRequest(world, { selected_episodes: [world.records[0]] })
    );
    expect(changedEvidence).toMatchObject({ kind: "FATAL_REUSE_CONFLICT", source: "WORKFLOW_IDENTITY" });

    const changedIds = await runBeliefAdaptationWorkflowV0(
      world.deps,
      canonicalRequest(world, { proposition_candidate_ids: [PROP_A] })
    );
    expect(changedIds).toMatchObject({ kind: "FATAL_REUSE_CONFLICT", source: "WORKFLOW_IDENTITY" });

    const changedSubject = await runBeliefAdaptationWorkflowV0(
      world.deps,
      canonicalRequest(world, { subject_id: "subject-other" })
    );
    expect(changedSubject).toMatchObject({ kind: "FATAL_REUSE_CONFLICT", source: "WORKFLOW_IDENTITY" });
  });

  it("same proposal rederives the same transition identity; changed payload under the same intent is REUSE_CONFLICT", async () => {
    const world = await buildWorld({ nullBundleLookup: true });
    world.store.crashAfterProposalCheckpoint = true;
    await expect(runBeliefAdaptationWorkflowV0(world.deps, canonicalRequest(world))).rejects.toThrow();
    world.store.crashAfterProposalCheckpoint = false;
    const checkpoint = world.store.records.get(WORKFLOW_ID)?.proposal_checkpoint;
    if (checkpoint === undefined || checkpoint === null) throw new Error("checkpoint missing");
    expect(await deriveBeliefTransitionId(checkpoint.proposal)).toBe(checkpoint.transition_id);

    // Commit a FOREIGN payload under the identical frozen intent identity.
    const memberSetFingerprint = await deriveBeliefEvidenceMemberSetFingerprint(
      checkpoint.proposal.evidence_binding.member_refs
    );
    const foreignProposal: BeliefMutationProposalV0 = {
      schema_version: BELIEF_MUTATION_PROPOSAL_SCHEMA_VERSION,
      subject_id: identifier(SUBJECT_ID),
      expected_state_revision: checkpoint.proposal.expected_state_revision,
      mutation: { kind: "UPDATE", proposition_id: identifier(PROP_A), next_credence: unit(0.9) },
      evidence_binding: {
        member_refs: checkpoint.proposal.evidence_binding.member_refs,
        member_set_fingerprint: memberSetFingerprint
      }
    };
    expect(await deriveBeliefTransitionId(foreignProposal)).toBe(checkpoint.transition_id);
    const executor = new BeliefTransitionExecutor({
      subjectCore: world.port,
      issuer: world.facade.producerAuthorizationIssuer,
      memoryRepository: world.repository
    });
    const foreignOutcome = await executor.execute(
      { subject_id: identifier(SUBJECT_ID), current_logical_time: 0 as never, state_revision: 0 as never },
      foreignProposal
    );
    expect(foreignOutcome.kind).toBe("COMMITTED");

    const terminal = await runBeliefAdaptationWorkflowV0(world.deps, canonicalRequest(world));
    expect(terminal).toMatchObject({ kind: "FATAL_REUSE_CONFLICT", source: "EXECUTOR_TRANSITION" });
  });
});

describe("Belief Adaptation Workflow V0 — strict stale policy (§65)", () => {
  it("new workflow under stale state/repository revision restarts with zero provider calls", async () => {
    const world = await buildWorld();
    const staleState = await runBeliefAdaptationWorkflowV0(
      world.deps,
      canonicalRequest(world, { expected_initial_state_revision: 3 })
    );
    expect(staleState).toMatchObject({ kind: "RESTART_REQUIRED", scope: "NEW_WORKFLOW_ID", code: "STALE_STATE_REVISION" });
    const staleRepository = await runBeliefAdaptationWorkflowV0(
      world.deps,
      canonicalRequest(world, { expected_repository_revision: "R9" })
    );
    expect(staleRepository).toMatchObject({
      kind: "RESTART_REQUIRED",
      scope: "NEW_WORKFLOW_ID",
      code: "STALE_REPOSITORY_REVISION"
    });
    expect(world.provider.calls).toBe(0);
    expect(world.committedBundles.size).toBe(0);
    expect(world.store.records.size).toBe(0);
  });

  it("state revision drift before prepared proposal restarts without rebuild or provider recall", async () => {
    expect(BELIEF_WORKFLOW_MAX_STALE_REBUILDS).toBe(0);
    const world = await buildWorld();
    world.store.crashAfterSemanticCandidate = true;
    await expect(runBeliefAdaptationWorkflowV0(world.deps, canonicalRequest(world))).rejects.toThrow();
    world.store.crashAfterSemanticCandidate = false;

    // External canonical advance through a second, lawful workflow identity.
    const otherStore = new InMemoryBeliefAdaptationWorkflowStoreV0();
    const otherTerminal = await runBeliefAdaptationWorkflowV0(
      { ...world.deps, workflowStore: otherStore },
      canonicalRequest(world, { workflow_id: "wf_belief_other" })
    );
    expect(otherTerminal.kind).toBe("COMPLETE_COMMITTED");
    expect(committedSnapshot(world).runtime_metadata.state_revision).toBe(1);

    const terminal = await runBeliefAdaptationWorkflowV0(world.deps, canonicalRequest(world));
    expect(terminal).toMatchObject({
      kind: "RESTART_REQUIRED",
      scope: "NEW_WORKFLOW_ID",
      code: "STALE_STATE_REVISION",
      canonical_commits: 0
    });
    // One call for this workflow + one for the other identity; the resumed
    // workflow itself made ZERO additional provider calls.
    expect(world.provider.calls).toBe(2);
    expect(world.committedBundles.size).toBe(1);
  });

  it("repository universe drift before prepared proposal restarts with zero rebuild", async () => {
    const world = await buildWorld();
    world.store.crashAfterSemanticCandidate = true;
    await expect(runBeliefAdaptationWorkflowV0(world.deps, canonicalRequest(world))).rejects.toThrow();
    world.store.crashAfterSemanticCandidate = false;
    await tamperRecord(world, (record) => ({ ...record, repository_revision: "R2" as never }));

    const terminal = await runBeliefAdaptationWorkflowV0(world.deps, canonicalRequest(world));
    expect(terminal).toMatchObject({
      kind: "RESTART_REQUIRED",
      scope: "NEW_WORKFLOW_ID",
      code: "STALE_REPOSITORY_REVISION",
      canonical_commits: 0
    });
    expect(world.provider.calls).toBe(1);
    expect(world.committedBundles.size).toBe(0);
  });
});

describe("Belief Adaptation Workflow V0 — failure closure (§66)", () => {
  it("provider throw remains failure (no fallback, no retry); resume replays the terminal", async () => {
    const world = await buildWorld({ decision: "THROW" });
    const terminal = await runBeliefAdaptationWorkflowV0(world.deps, canonicalRequest(world));
    expect(terminal).toMatchObject({ kind: "REJECTED_SEMANTIC", code: "PROVIDER_FAILURE", canonical_commits: 0 });
    expect(terminal.kind).not.toBe("COMPLETE_NO_BEARING");
    expect(world.provider.calls).toBe(1);
    expect(world.committedBundles.size).toBe(0);

    const replay = await runBeliefAdaptationWorkflowV0(world.deps, canonicalRequest(world));
    expect(replay).toEqual(terminal);
    expect(world.provider.calls).toBe(1);
  });

  it("invalid provider output remains rejection (no repair/coercion)", async () => {
    const world = await buildWorld({ decision: "INVALID" });
    const terminal = await runBeliefAdaptationWorkflowV0(world.deps, canonicalRequest(world));
    expect(terminal).toMatchObject({ kind: "REJECTED_SEMANTIC", code: "INVALID_PROVIDER_OUTPUT", canonical_commits: 0 });
    expect(world.provider.calls).toBe(1);
    expect(world.committedBundles.size).toBe(0);

    const replay = await runBeliefAdaptationWorkflowV0(world.deps, canonicalRequest(world));
    expect(replay).toEqual(terminal);
    expect(world.provider.calls).toBe(1);
  });

  it("invented proposition id remains rejection", async () => {
    const world = await buildWorld({ decision: "INVENTED_ID" });
    const terminal = await runBeliefAdaptationWorkflowV0(world.deps, canonicalRequest(world));
    expect(terminal).toMatchObject({ kind: "REJECTED_SEMANTIC", code: "INVENTED_PROPOSITION_ID", canonical_commits: 0 });
    expect(world.committedBundles.size).toBe(0);
  });
});

describe("Belief Adaptation Workflow V0 — historical evidence policy (§67)", () => {
  it("same historical evidence under a different workflow id is not rejected for reuse", async () => {
    const world = await buildWorld();
    const first = await runBeliefAdaptationWorkflowV0(world.deps, canonicalRequest(world));
    expect(first.kind).toBe("COMPLETE_COMMITTED");

    // NO_GLOBAL_HISTORY_DEDUP_POLICY: the second workflow fails (if at all)
    // ONLY because the canonical state revision advanced (strict binding sees
    // revision 1 while the request still anchors revision 0) — never because
    // the episode refs were already used by another workflow identity.
    const second = await runBeliefAdaptationWorkflowV0(
      world.deps,
      canonicalRequest(world, { workflow_id: "wf_belief_repeat" })
    );
    expect(second.kind).not.toBe("FATAL_REUSE_CONFLICT");
    expect(JSON.stringify(second)).not.toContain("evidence reuse");
    expect(second).toMatchObject({ kind: "RESTART_REQUIRED", code: "STALE_STATE_REVISION" });
  });
});

describe("Belief Adaptation Workflow V0 — checkpoint integrity (§68)", () => {
  async function runToCheckpoint(): Promise<Awaited<ReturnType<typeof buildWorld>>> {
    const world = await buildWorld();
    world.store.crashAfterProposalCheckpoint = true;
    await expect(runBeliefAdaptationWorkflowV0(world.deps, canonicalRequest(world))).rejects.toThrow();
    world.store.crashAfterProposalCheckpoint = false;
    return world;
  }

  it("tampered workflow record checkpoint fingerprint fails closed", async () => {
    const world = await buildWorld();
    await expect(runBeliefAdaptationWorkflowV0(world.deps, canonicalRequest(world))).resolves.toMatchObject({
      kind: "COMPLETE_COMMITTED"
    });
    await tamperRecord(world, (record) => ({ ...record, initial_state_revision: 9 as never }), {
      recomputeFingerprint: false
    });
    const terminal = await runBeliefAdaptationWorkflowV0(world.deps, canonicalRequest(world));
    expect(terminal).toMatchObject({ kind: "FATAL_REUSE_CONFLICT", source: "WORKFLOW_CHECKPOINT" });
  });

  it("tampered request fingerprint under the same workflow id fails closed as identity conflict", async () => {
    const world = await runToCheckpoint();
    await tamperRecord(world, (record) => ({
      ...record,
      request_fingerprint: ("sha256:" + "a".repeat(64)) as HashV1
    }));
    const terminal = await runBeliefAdaptationWorkflowV0(world.deps, canonicalRequest(world));
    expect(terminal).toMatchObject({ kind: "FATAL_REUSE_CONFLICT", source: "WORKFLOW_IDENTITY" });
  });

  it("tampered semantic candidate (content or fingerprint) fails closed", async () => {
    const world = await runToCheckpoint();
    await tamperRecord(world, (record) => ({
      ...record,
      semantic_candidate:
        record.semantic_candidate === null
          ? null
          : { ...record.semantic_candidate, relation: "CONTRADICTS" } as never
    }));
    const terminal = await runBeliefAdaptationWorkflowV0(world.deps, canonicalRequest(world));
    expect(terminal).toMatchObject({ kind: "FATAL_REUSE_CONFLICT", source: "SEMANTIC_CANDIDATE" });

    const world2 = await runToCheckpoint();
    await tamperRecord(world2, (record) => ({
      ...record,
      semantic_candidate_fingerprint: ("sha256:" + "b".repeat(64)) as HashV1
    }));
    const terminal2 = await runBeliefAdaptationWorkflowV0(world2.deps, canonicalRequest(world2));
    expect(terminal2).toMatchObject({ kind: "FATAL_REUSE_CONFLICT", source: "SEMANTIC_CANDIDATE" });
  });

  it("tampered plasticity receipt (serialized next_credence) cannot authorize a proposal", async () => {
    const world = await runToCheckpoint();
    await tamperRecord(world, (record) => ({
      ...record,
      plasticity_receipt:
        record.plasticity_receipt === null
          ? null
          : {
              ...record.plasticity_receipt,
              outcome: { kind: "CREDENCE_CHANGE", next_credence: 0.99 }
            } as never
    }));
    const terminal = await runBeliefAdaptationWorkflowV0(world.deps, canonicalRequest(world));
    expect(terminal).toMatchObject({ kind: "FATAL_REUSE_CONFLICT", source: "PLASTICITY_RECEIPT" });
    expect(world.committedBundles.size).toBe(0);
  });

  it("tampered proposal / transition id / checkpoint fingerprint fails closed", async () => {
    const world = await runToCheckpoint();
    await tamperRecord(world, (record) => ({
      ...record,
      proposal_checkpoint:
        record.proposal_checkpoint === null
          ? null
          : {
              ...record.proposal_checkpoint,
              proposal: {
                ...record.proposal_checkpoint.proposal,
                mutation: { kind: "UPDATE", proposition_id: PROP_A, next_credence: 0.9 }
              }
            } as never
    }));
    expect(await runBeliefAdaptationWorkflowV0(world.deps, canonicalRequest(world))).toMatchObject({
      kind: "FATAL_REUSE_CONFLICT",
      source: "PROPOSAL_CHECKPOINT"
    });

    const world2 = await runToCheckpoint();
    await tamperRecord(world2, (record) => ({
      ...record,
      proposal_checkpoint:
        record.proposal_checkpoint === null
          ? null
          : { ...record.proposal_checkpoint, transition_id: ("t-belief-forged" + "0".repeat(52)) as never }
    }));
    expect(await runBeliefAdaptationWorkflowV0(world2.deps, canonicalRequest(world2))).toMatchObject({
      kind: "FATAL_REUSE_CONFLICT",
      source: "PROPOSAL_CHECKPOINT"
    });

    const world3 = await runToCheckpoint();
    await tamperRecord(world3, (record) => ({
      ...record,
      proposal_checkpoint:
        record.proposal_checkpoint === null
          ? null
          : { ...record.proposal_checkpoint, proposal_checkpoint_fingerprint: ("sha256:" + "c".repeat(64)) as HashV1 }
    }));
    expect(await runBeliefAdaptationWorkflowV0(world3.deps, canonicalRequest(world3))).toMatchObject({
      kind: "FATAL_REUSE_CONFLICT",
      source: "PROPOSAL_CHECKPOINT"
    });
  });

  it("unknown stage / unsupported schema / unknown key / illegal combination fail closed", async () => {
    const world = await runToCheckpoint();
    await tamperRecord(world, (record) => ({ ...record, stage: "B9_UNKNOWN" as never }));
    expect(await runBeliefAdaptationWorkflowV0(world.deps, canonicalRequest(world))).toMatchObject({
      kind: "FATAL_REUSE_CONFLICT",
      source: "WORKFLOW_CHECKPOINT"
    });

    const world2 = await runToCheckpoint();
    await tamperRecord(world2, (record) => ({ ...record, schema_version: "belief-adaptation-workflow-record-v9" as never }));
    expect(await runBeliefAdaptationWorkflowV0(world2.deps, canonicalRequest(world2))).toMatchObject({
      kind: "FATAL_REUSE_CONFLICT",
      source: "WORKFLOW_CHECKPOINT"
    });

    const world3 = await runToCheckpoint();
    await tamperRecord(world3, (record) => ({ ...record, smuggled_key: true } as never));
    expect(await runBeliefAdaptationWorkflowV0(world3.deps, canonicalRequest(world3))).toMatchObject({
      kind: "FATAL_REUSE_CONFLICT",
      source: "WORKFLOW_CHECKPOINT"
    });

    const world4 = await runToCheckpoint();
    await tamperRecord(world4, (record) => ({
      ...record,
      plasticity_receipt: null,
      proposal_checkpoint: record.proposal_checkpoint
    }));
    expect(await runBeliefAdaptationWorkflowV0(world4.deps, canonicalRequest(world4))).toMatchObject({
      kind: "FATAL_REUSE_CONFLICT",
      source: "WORKFLOW_CHECKPOINT"
    });
  });
});

describe("Belief Adaptation Workflow V0 — closed request admission (§6/§7)", () => {
  it("unknown keys and caller numeric authority keys reject before any durable write", async () => {
    const world = await buildWorld();
    const unknownKey = await runBeliefAdaptationWorkflowV0(
      world.deps,
      canonicalRequest(world, { smuggled: true })
    );
    expect(unknownKey).toMatchObject({ kind: "REJECTED_SEMANTIC", code: "INVALID_REQUEST" });
    for (const numericKey of [
      "current_credence",
      "next_credence",
      "initial_credence",
      "delta",
      "step",
      "confidence",
      "score",
      "weight"
    ]) {
      const terminal = await runBeliefAdaptationWorkflowV0(
        world.deps,
        canonicalRequest(world, { [numericKey]: 0.5 })
      );
      expect(terminal).toMatchObject({ kind: "REJECTED_SEMANTIC", code: "INVALID_REQUEST", canonical_commits: 0 });
    }
    expect(world.store.records.size).toBe(0);
    expect(world.provider.calls).toBe(0);
    expect(world.committedBundles.size).toBe(0);
  });

  it("candidate ids and episodes enforce closed cardinality/uniqueness rules", async () => {
    const world = await buildWorld();
    const tooManyIds = await runBeliefAdaptationWorkflowV0(
      world.deps,
      canonicalRequest(world, {
        proposition_candidate_ids: Array.from({ length: 65 }, (_, i) => `prop.p${String(i).padStart(3, "0")}`)
      })
    );
    expect(tooManyIds).toMatchObject({ kind: "REJECTED_SEMANTIC", code: "INVALID_REQUEST" });

    const duplicateIds = await runBeliefAdaptationWorkflowV0(
      world.deps,
      canonicalRequest(world, { proposition_candidate_ids: [PROP_A, PROP_A] })
    );
    expect(duplicateIds).toMatchObject({ kind: "REJECTED_SEMANTIC", code: "INVALID_REQUEST" });

    const duplicateEpisodes = await runBeliefAdaptationWorkflowV0(
      world.deps,
      canonicalRequest(world, { selected_episodes: [world.records[0], world.records[0]] })
    );
    expect(duplicateEpisodes).toMatchObject({ kind: "REJECTED_SEMANTIC", code: "INVALID_REQUEST" });

    const emptyEpisodes = await runBeliefAdaptationWorkflowV0(
      world.deps,
      canonicalRequest(world, { selected_episodes: [] })
    );
    expect(emptyEpisodes).toMatchObject({ kind: "REJECTED_SEMANTIC", code: "INVALID_REQUEST" });
    expect(world.store.records.size).toBe(0);
  });
});
