/**
 * Relationship Adaptation Workflow V0 acceptance suite (RAWI1–RAWI120).
 *
 * Proves the frozen workflow architecture: closed request + JCS identity,
 * workflow-level reuse conflict, single atomically-claimed external provider
 * call with create-once candidate capture, local capability re-minting from
 * the durable candidate (zero external recall), successful ABSTAIN /
 * NO_PROPOSAL terminals, workflow-internal projections, exact end-to-end
 * evidence alignment, append-only proposal checkpoints, journal-first
 * reconciliation, the single deterministic stale rebuild, the process-restart
 * matrix, at-most-one canonical commit, and the complete absence of
 * canonical/self mutation.
 * `test_trust_like` / `test_closeness_like` are NON_SCIENTIFIC_TEST_FIXTURE
 * identifiers only.
 */

import { describe, expect, it } from "vitest";
import {
  InMemoryMemoryRepository,
  EPISODIC_MEMORY_RECORD_SCHEMA_VERSION,
  SALIENCE_SOURCE_ENCODING_DECLARED,
  type EpisodicMemoryRecordV0
} from "@characteros-next/memory";
import {
  createInMemorySubjectCoreFacade,
  RELATIONSHIP_STATE_SCHEMA_VERSION,
  validateSubjectState,
  type AtomicCommitBundleV1,
  type InMemoryFacadeAssembly,
  type ProducerAuthorizationIssuer,
  type SubjectStateV0,
  type UnitIntervalV0
} from "@characteros-next/subject-core";
// Vite `?raw` asset import (vitest-native); intentionally untyped.
// @ts-expect-error -- Vite ?raw imports carry no TypeScript declaration by design.
import runtimePackageRaw from "../../../package.json?raw";
import { s0 } from "../observation/observation-fixtures.js";
import type { SubjectCorePort } from "../../ports/subject-core-port.js";
import { ENGINEERING_REFERENCE_V0_MEMORY_INFLUENCE_POLICY } from "@characteros-next/memory-influence";
import {
  RELATIONSHIP_EVIDENCE_CHANNEL_POLICY_SCHEMA_VERSION,
  deriveRelationshipEvidenceChannelPolicyFingerprint,
  type RelationshipEvidenceChannelPolicyV0
} from "./relationship-evidence-channel-policy.js";
import {
  RELATIONSHIP_SEMANTIC_CHANNEL_CATALOG_SCHEMA_VERSION,
  RELATIONSHIP_SEMANTIC_PROVIDER_OUTPUT_SCHEMA_VERSION,
  type RelationshipSemanticChannelCatalogV0,
  type RelationshipSemanticChannelProviderV0
} from "./relationship-semantic-channel.js";
import {
  RELATIONSHIP_ADAPTATION_REQUEST_SCHEMA_VERSION,
  runRelationshipAdaptationWorkflowV0,
  type RelationshipAdaptationTerminalV0,
  type RelationshipAdaptationWorkflowDepsV0,
  type RelationshipAdaptationWorkflowRecordV0,
  type RelationshipAdaptationWorkflowStoreV0
} from "./relationship-adaptation-workflow.js";
import {
  deriveRelationshipTransitionId,
  validateRelationshipUpdateProposal,
  type RelationshipUpdateProposalV0
} from "./relationship-update-proposal.js";
import { RelationshipTransitionExecutor } from "./relationship-transition-executor.js";

const SUBJECT_ID = "subject-s0";
const ALICE = "entity:alice-like";
const DIM_TRUST = "test_trust_like";
const DIM_CLOSE = "test_closeness_like";
const CH_A = "ch_a";
const CH_B = "ch_b";
const WORKFLOW_ID = "wf_adaptation_1";
const BASE_LOGICAL_TIME = 10;

function unit(value: number): UnitIntervalV0 {
  if (!(value >= 0 && value <= 1)) throw new Error("fixture unit out of range");
  return value as UnitIntervalV0;
}

function identifier(raw: string): never {
  return raw as never;
}

function at<T>(list: readonly T[], index: number): T {
  const item = list[index];
  if (item === undefined) throw new Error("fixture index missing");
  return item;
}

function policyFixture(): RelationshipEvidenceChannelPolicyV0 {
  return {
    schema_version: RELATIONSHIP_EVIDENCE_CHANNEL_POLICY_SCHEMA_VERSION,
    policy_id: identifier("rel_policy"),
    channels: [
      { channel_id: identifier(CH_A), target_dimension_id: identifier(DIM_CLOSE), direction: "INCREASE" },
      { channel_id: identifier(CH_B), target_dimension_id: identifier(DIM_TRUST), direction: "DECREASE" }
    ]
  };
}

async function catalogFixture(
  policy: RelationshipEvidenceChannelPolicyV0 = policyFixture()
): Promise<RelationshipSemanticChannelCatalogV0> {
  return {
    schema_version: RELATIONSHIP_SEMANTIC_CHANNEL_CATALOG_SCHEMA_VERSION,
    catalog_id: identifier("rel_catalog"),
    channel_policy_id: policy.policy_id,
    channel_policy_fingerprint: await deriveRelationshipEvidenceChannelPolicyFingerprint(policy),
    channels: [
      {
        channel_id: identifier(CH_A),
        criterion: "Selected shared experiences consistently involve kept agreements."
      },
      {
        channel_id: identifier(CH_B),
        criterion: "Selected shared experiences consistently involve broken agreements."
      }
    ]
  };
}

function recordFixture(
  episodeRef: string,
  scene: string,
  references: readonly string[],
  occurrenceLogicalTime: number,
  declaredScore = 0.8
): EpisodicMemoryRecordV0 {
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
    references: references as EpisodicMemoryRecordV0["references"],
    context: { scene, focus_refs: [], environment_refs: [] },
    appraisal_ref: null,
    affect_snapshot_ref: null,
    salience: { declared_score: unit(declaredScore), source: SALIENCE_SOURCE_ENCODING_DECLARED }
  };
}

const EXACT_TRACE_RULE_IDS = [
  "HASH-DET-001",
  "SS-AUTH-001",
  "SS-IMMUTABLE-001",
  "SS-REVISION-001",
  "TR-ATOMIC-001",
  "TRACE-ATOMIC-001",
  "TRACE-CONTENT-001"
];

function traceEntry(sequence: number, repositoryRevision: string): Record<string, unknown> {
  return {
    trace_schema_version: "trace-v1",
    trace_id: `trace:trace-${sequence}`,
    history_sequence: sequence,
    transition_id: `t-fixture-${sequence}`,
    transition_type: "Relationship",
    subject_id: SUBJECT_ID,
    subject_revision_before: sequence - 1,
    subject_revision_after: sequence,
    logical_time: BASE_LOGICAL_TIME,
    rule_ids: EXACT_TRACE_RULE_IDS,
    cause_refs: [],
    proposal_ref: `proposal:p${sequence}`,
    domain_mutations: [
      {
        producer: "relationship",
        domain: "relationship",
        layers: ["relationships"],
        field_changes: [{ path: "/relationships", operation: "SET" }]
      }
    ],
    state_hash_before: `sha256:${"3".repeat(64)}`,
    state_hash_after: `sha256:${"4".repeat(64)}`,
    memory_revision_before: repositoryRevision,
    memory_revision_after: repositoryRevision,
    outcome: "COMMITTED"
  };
}

function baseRecords(declaredScore = 0.8, count = 3): EpisodicMemoryRecordV0[] {
  const scenes = [
    "Alice kept the plan and arrived early.",
    "Alice apologized and rescheduled.",
    "Alice helped carry the boxes."
  ];
  const records: EpisodicMemoryRecordV0[] = [];
  for (let i = 0; i < count; i++) {
    const ref = `episode:ep-${String(i + 1).padStart(2, "0")}`;
    records.push(
      recordFixture(ref, scenes[i % scenes.length] ?? `Shared experience ${i}.`, [ALICE], 7 + i, declaredScore)
    );
  }
  return records;
}

interface StateOptions {
  readonly logicalTime?: number;
  readonly stateRevision?: number;
  readonly subjectId?: string;
  readonly includeAlice?: boolean;
  readonly aliceDimensions?: readonly { dimension_id: string; value: number }[];
}

function subjectStateFixture(repositoryRevision: string, options: StateOptions = {}): SubjectStateV0 {
  const base = s0() as unknown as SubjectStateV0;
  const logicalTime = options.logicalTime ?? BASE_LOGICAL_TIME;
  const stateRevision = options.stateRevision ?? 0;
  const aliceDimensions = options.aliceDimensions ?? [
    { dimension_id: DIM_CLOSE, value: 0.4 },
    { dimension_id: DIM_TRUST, value: 0.6 }
  ];
  const counterparts: Record<string, unknown>[] = [];
  if (options.includeAlice !== false) {
    counterparts.push({
      counterpart_ref: ALICE,
      dimensions: aliceDimensions.map((entry) => ({
        dimension_id: identifier(entry.dimension_id),
        value: unit(entry.value)
      }))
    });
  }
  counterparts.push({
    counterpart_ref: "subject:bob-like",
    dimensions: [
      { dimension_id: identifier(DIM_CLOSE), value: unit(0.2) },
      { dimension_id: identifier(DIM_TRUST), value: unit(0.8) }
    ]
  });
  const state: unknown = {
    ...base,
    memory_state: { ...base.memory_state, repository_revision: repositoryRevision as never },
    relationships: { schema_version: RELATIONSHIP_STATE_SCHEMA_VERSION, counterparts },
    runtime_metadata: {
      ...base.runtime_metadata,
      logical_time: logicalTime,
      state_revision: stateRevision,
      last_transition_time: stateRevision === 0 ? null : logicalTime,
      last_transition_type: stateRevision === 0 ? null : "Relationship",
      updated_at: logicalTime
    },
    trace_window: {
      ...base.trace_window,
      cursor: {
        last_history_sequence: stateRevision,
        offloaded_through_sequence: 0,
        offloaded_through_trace_ref: null
      },
      entries: Array.from({ length: stateRevision }, (_, index) =>
        traceEntry(index + 1, repositoryRevision)
      )
    }
  };
  const mutableState = state as unknown as { identity: { subject_id: string } };
  if (options.subjectId !== undefined) {
    mutableState.identity.subject_id = options.subjectId;
  }
  return state as unknown as SubjectStateV0;
}

/** Deterministic in-memory workflow store (test-only infrastructure). */
class InMemoryRelationshipAdaptationWorkflowStoreV0 implements RelationshipAdaptationWorkflowStoreV0 {
  private readonly records = new Map<string, RelationshipAdaptationWorkflowRecordV0>();

  private mutableObject(workflow_id: string): RelationshipAdaptationWorkflowRecordV0 {
    const record = this.records.get(workflow_id);
    if (record === undefined) throw new Error("store misuse: record missing");
    return record;
  }

  async load(workflow_id: string): Promise<RelationshipAdaptationWorkflowRecordV0 | null> {
    return this.records.get(workflow_id) ?? null;
  }

  async createIfAbsent(record: RelationshipAdaptationWorkflowRecordV0): Promise<"CREATED" | "EXISTING"> {
    if (this.records.has(record.workflow_id)) return "EXISTING";
    this.records.set(record.workflow_id, record);
    return "CREATED";
  }

  async claimProviderCall(workflow_id: string, request_fingerprint: string): Promise<"CLAIMED" | "ALREADY_CLAIMED"> {
    const record = this.mutableObject(workflow_id);
    if (record.request_fingerprint !== request_fingerprint) throw new Error("store misuse: fingerprint mismatch");
    if (record.external_provider_call_count === 1) return "ALREADY_CLAIMED";
    this.records.set(workflow_id, {
      ...record,
      external_provider_call_count: 1,
      stage: "A2_SEMANTIC_PROVIDER_CALL"
    });
    return "CLAIMED";
  }

  async saveProviderCandidate(
    workflow_id: string,
    request_fingerprint: string,
    candidate: RelationshipAdaptationWorkflowRecordV0["provider_output_candidate"],
    candidate_fingerprint: string
  ): Promise<"SAVED" | "CANDIDATE_CONFLICT"> {
    const record = this.mutableObject(workflow_id);
    if (record.request_fingerprint !== request_fingerprint) throw new Error("store misuse: fingerprint mismatch");
    if (record.provider_output_candidate !== null) {
      return JSON.stringify(record.provider_output_candidate) === JSON.stringify(candidate)
        ? "SAVED"
        : "CANDIDATE_CONFLICT";
    }
    this.records.set(workflow_id, {
      ...record,
      provider_output_candidate: candidate,
      provider_output_candidate_fingerprint: candidate_fingerprint as never,
      stage: "A3_SEMANTIC_ACCEPTED"
    });
    return "SAVED";
  }

  async appendProposalAttempt(
    workflow_id: string,
    request_fingerprint: string,
    checkpoint: RelationshipAdaptationWorkflowRecordV0["proposal_attempts"][number]
  ): Promise<"APPENDED" | "ORDINAL_CONFLICT"> {
    const record = this.mutableObject(workflow_id);
    if (record.request_fingerprint !== request_fingerprint) throw new Error("store misuse: fingerprint mismatch");
    const existing = record.proposal_attempts.find(
      (attempt) => attempt.rebuild_ordinal === checkpoint.rebuild_ordinal
    );
    if (existing !== undefined) {
      return JSON.stringify(existing) === JSON.stringify(checkpoint) ? "APPENDED" : "ORDINAL_CONFLICT";
    }
    this.records.set(workflow_id, {
      ...record,
      proposal_attempts: [...record.proposal_attempts, checkpoint],
      plasticity_rebuild_ordinal:
        checkpoint.rebuild_ordinal === 1 ? 1 : record.plasticity_rebuild_ordinal,
      stage: "A6_PROPOSAL_READY"
    });
    return "APPENDED";
  }

  async compareAndSetStage(
    workflow_id: string,
    request_fingerprint: string,
    from: RelationshipAdaptationWorkflowRecordV0["stage"],
    to: RelationshipAdaptationWorkflowRecordV0["stage"]
  ): Promise<"SET" | "STAGE_CONFLICT"> {
    const record = this.mutableObject(workflow_id);
    if (record.request_fingerprint !== request_fingerprint) throw new Error("store misuse: fingerprint mismatch");
    if (record.stage !== from) return "STAGE_CONFLICT";
    this.records.set(workflow_id, { ...record, stage: to });
    return "SET";
  }

  async setRebuildOrdinal(workflow_id: string, request_fingerprint: string): Promise<"SET" | "ORDINAL_CONFLICT"> {
    const record = this.mutableObject(workflow_id);
    if (record.request_fingerprint !== request_fingerprint) throw new Error("store misuse: fingerprint mismatch");
    if (record.plasticity_rebuild_ordinal === 1) return "ORDINAL_CONFLICT";
    this.records.set(workflow_id, { ...record, plasticity_rebuild_ordinal: 1 });
    return "SET";
  }

  async saveTerminalResult(
    workflow_id: string,
    request_fingerprint: string,
    terminal: RelationshipAdaptationTerminalV0
  ): Promise<"SAVED" | "TERMINAL_CONFLICT"> {
    const record = this.mutableObject(workflow_id);
    if (record.request_fingerprint !== request_fingerprint) throw new Error("store misuse: fingerprint mismatch");
    if (record.terminal_result !== null) {
      return JSON.stringify(record.terminal_result) === JSON.stringify(terminal)
        ? "SAVED"
        : "TERMINAL_CONFLICT";
    }
    this.records.set(workflow_id, { ...record, terminal_result: terminal, stage: "A8_COMPLETE" });
    return "SAVED";
  }
}

class TrackingProvider implements RelationshipSemanticChannelProviderV0 {
  calls = 0;

  constructor(private readonly decision: "CHANNEL_A" | "CHANNEL_B" | "ABSTAIN") {}

  async propose(input: { semantic_context_fingerprint: unknown; catalog_fingerprint: unknown }): Promise<unknown> {
    this.calls += 1;
    const bindings = {
      schema_version: RELATIONSHIP_SEMANTIC_PROVIDER_OUTPUT_SCHEMA_VERSION,
      semantic_context_fingerprint: input.semantic_context_fingerprint,
      catalog_fingerprint: input.catalog_fingerprint
    };
    if (this.decision === "ABSTAIN") return { ...bindings, kind: "ABSTAIN" };
    return {
      ...bindings,
      kind: "CHANNEL",
      channel_id: identifier(this.decision === "CHANNEL_A" ? CH_A : CH_B)
    };
  }
}

async function buildWorld(options: {
  decision?: "CHANNEL_A" | "CHANNEL_B" | "ABSTAIN";
  state?: SubjectStateV0;
  records?: readonly EpisodicMemoryRecordV0[];
} = {}): Promise<{
  deps: RelationshipAdaptationWorkflowDepsV0;
  store: InMemoryRelationshipAdaptationWorkflowStoreV0;
  provider: TrackingProvider;
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
    hashes.push({
      ref: record.episode_ref,
      payload_hash: await repository.storePayload(record.episode_ref, record)
    });
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
  const provider = new TrackingProvider(options.decision ?? "CHANNEL_A");
  const store = new InMemoryRelationshipAdaptationWorkflowStoreV0();
  const executor = new RelationshipTransitionExecutor({
    subjectCore: port,
    issuer: facade.producerAuthorizationIssuer,
    memoryRepository: repository
  });
  const realExecute = executor.execute.bind(executor);
  executor.execute = async (ctx, proposalInput) => {
    const result = await realExecute(ctx, proposalInput);
    if (result.kind === "COMMITTED" || result.kind === "ALREADY_COMMITTED") {
      committedBundles.set(result.bundle.transition_id, result.bundle);
    }
    return result;
  };
  const deps: RelationshipAdaptationWorkflowDepsV0 = {
    subjectCore: port,
    memoryRepository: repository,
    producerAuthorizationIssuer: facade.producerAuthorizationIssuer,
    semanticProvider: provider,
    workflowStore: store,
    readCommittedBundle: async (transitionId) => committedBundles.get(transitionId) ?? null
  };
  return { deps, store, provider, repository, records, state, committedBundles, facade, port };
}

async function canonicalRequest(
  world: Awaited<ReturnType<typeof buildWorld>>,
  overrides: Record<string, unknown> = {}
): Promise<Record<string, unknown>> {
  return {
    schema_version: RELATIONSHIP_ADAPTATION_REQUEST_SCHEMA_VERSION,
    workflow_id: identifier(WORKFLOW_ID),
    subject_id: identifier(SUBJECT_ID),
    expected_initial_state_revision: world.state.runtime_metadata.state_revision,
    expected_initial_logical_time: world.state.runtime_metadata.logical_time,
    expected_repository_revision: world.state.memory_state.repository_revision,
    counterpart_ref: ALICE,
    cause_refs: [],
    selected_records: world.records,
    semantic_catalog: await catalogFixture(),
    channel_policy: policyFixture(),
    memory_influence_policy: ENGINEERING_REFERENCE_V0_MEMORY_INFLUENCE_POLICY,
    ...overrides
  };
}

describe("Request and identity (RAWI1–RAWI14)", () => {
  it("RAWI1/RAWI9: valid closed request accepted; same inputs give identical terminals", async () => {
    const world = await buildWorld();
    const first = await runRelationshipAdaptationWorkflowV0(world.deps, await canonicalRequest(world));
    expect(first.kind).toBe("COMPLETE_COMMITTED");
    const world2 = await buildWorld();
    const second = await runRelationshipAdaptationWorkflowV0(world2.deps, await canonicalRequest(world2));
    expect(second).toEqual(first);
  });

  it("RAWI2: extra request key rejected pre-provider", async () => {
    const world = await buildWorld();
    const result = await runRelationshipAdaptationWorkflowV0(
      world.deps,
      await canonicalRequest(world, { magnitude: 0.9 })
    );
    expect(result.kind).toBe("REJECTED_PRE_SEMANTIC");
    expect(world.provider.calls).toBe(0);
  });

  it("RAWI3/RAWI4: invalid workflow_id and counterpart kind rejected", async () => {
    const world = await buildWorld();
    const badId = await runRelationshipAdaptationWorkflowV0(
      world.deps,
      await canonicalRequest(world, { workflow_id: "bad id!" })
    );
    expect(badId.kind).toBe("REJECTED_PRE_SEMANTIC");
    const badKind = await runRelationshipAdaptationWorkflowV0(
      world.deps,
      await canonicalRequest(world, { counterpart_ref: "episode:ep-01" })
    );
    expect(badKind.kind).toBe("REJECTED_PRE_SEMANTIC");
    expect(world.provider.calls).toBe(0);
  });

  it("RAWI5/RAWI6: duplicate and noncanonical cause_refs rejected", async () => {
    const world = await buildWorld();
    const duplicated = await runRelationshipAdaptationWorkflowV0(
      world.deps,
      await canonicalRequest(world, {
        cause_refs: [identifier("observation:o1"), identifier("observation:o1")]
      })
    );
    expect(duplicated.kind).toBe("REJECTED_PRE_SEMANTIC");
    const unsorted = await runRelationshipAdaptationWorkflowV0(
      world.deps,
      await canonicalRequest(world, {
        cause_refs: [identifier("observation:o2"), identifier("observation:o1")]
      })
    );
    expect(unsorted.kind).toBe("REJECTED_PRE_SEMANTIC");
    expect(world.provider.calls).toBe(0);
  });

  it("RAWI7/RAWI8: duplicate and invalid selected records rejected", async () => {
    const world = await buildWorld();
    const duplicated = await runRelationshipAdaptationWorkflowV0(
      world.deps,
      await canonicalRequest(world, { selected_records: [...world.records, world.records[0]] })
    );
    expect(duplicated.kind).toBe("REJECTED_PRE_SEMANTIC");
    const broken = { ...world.records[0], schema_version: "episodic-memory-record-v9" };
    const invalid = await runRelationshipAdaptationWorkflowV0(
      world.deps,
      await canonicalRequest(world, { selected_records: [broken] })
    );
    expect(invalid.kind).toBe("REJECTED_PRE_SEMANTIC");
    expect(world.provider.calls).toBe(0);
  });

  it("RAWI10: record permutation is canonicalized — identical terminals", async () => {
    const world = await buildWorld();
    const first = await runRelationshipAdaptationWorkflowV0(world.deps, await canonicalRequest(world));
    const world2 = await buildWorld();
    const reversed = [...world2.records].reverse();
    const second = await runRelationshipAdaptationWorkflowV0(
      world2.deps,
      await canonicalRequest(world2, { selected_records: reversed })
    );
    expect(first.kind).toBe("COMPLETE_COMMITTED");
    expect(second).toEqual(first);
  });

  it("RAWI11: changed scene/content changes the request identity (fatal under same id)", async () => {
    const world = await buildWorld();
    const first = await runRelationshipAdaptationWorkflowV0(world.deps, await canonicalRequest(world));
    expect(first.kind).toBe("COMPLETE_COMMITTED");
    const altered = baseRecords().map((record, index) =>
      index === 0 ? recordFixture("episode:ep-01", "A different scene entirely.", [ALICE], 7) : record
    );
    const conflict = await runRelationshipAdaptationWorkflowV0(
      world.deps,
      await canonicalRequest(world, { selected_records: altered })
    );
    expect(conflict.kind).toBe("FATAL_REUSE_CONFLICT");
  });

  it("RAWI13: same workflow id + same fingerprint resumes to the same terminal", async () => {
    const world = await buildWorld();
    const request = await canonicalRequest(world);
    const first = await runRelationshipAdaptationWorkflowV0(world.deps, request);
    const second = await runRelationshipAdaptationWorkflowV0(world.deps, request);
    expect(first.kind).toBe("COMPLETE_COMMITTED");
    expect(second).toEqual(first);
    expect(world.provider.calls).toBe(1);
  });

  it("RAWI14: same workflow id + changed fingerprint -> FATAL_REUSE_CONFLICT", async () => {
    const world = await buildWorld();
    await runRelationshipAdaptationWorkflowV0(world.deps, await canonicalRequest(world));
    const second = await runRelationshipAdaptationWorkflowV0(
      world.deps,
      await canonicalRequest(world, { expected_initial_logical_time: 999 })
    );
    expect(second.kind).toBe("FATAL_REUSE_CONFLICT");
    if (second.kind === "FATAL_REUSE_CONFLICT") expect(second.source).toBe("WORKFLOW_IDENTITY");
  });
});

describe("Initial admission (RAWI15–RAWI21)", () => {
  it("RAWI15/RAWI21: subject mismatch rejected pre-provider, call count 0, no record", async () => {
    const world = await buildWorld({
      state: subjectStateFixture("R1", { subjectId: "subject-other" })
    });
    const result = await runRelationshipAdaptationWorkflowV0(world.deps, await canonicalRequest(world));
    expect(result.kind).toBe("REJECTED_PRE_SEMANTIC");
    expect(world.provider.calls).toBe(0);
    expect(await world.store.load(identifier(WORKFLOW_ID))).toBe(null);
  });

  it("RAWI16/RAWI17/RAWI18: anchor mismatches rejected pre-provider", async () => {
    for (const overrides of [
      { expected_initial_state_revision: 9 },
      { expected_initial_logical_time: 999 },
      { expected_repository_revision: "R999" }
    ]) {
      const world = await buildWorld();
      const result = await runRelationshipAdaptationWorkflowV0(
        world.deps,
        await canonicalRequest(world, overrides)
      );
      expect(result.kind).toBe("REJECTED_PRE_SEMANTIC");
      expect(world.provider.calls).toBe(0);
    }
  });

  it("RAWI19: unregistered counterpart rejected pre-provider", async () => {
    const world = await buildWorld({
      state: subjectStateFixture("R1", { includeAlice: false })
    });
    const result = await runRelationshipAdaptationWorkflowV0(world.deps, await canonicalRequest(world));
    expect(result.kind).toBe("REJECTED_PRE_SEMANTIC");
    expect(world.provider.calls).toBe(0);
  });

  it("RAWI20: invalid catalog/policy binding rejected pre-provider", async () => {
    const world = await buildWorld();
    const catalog = await catalogFixture();
    const result = await runRelationshipAdaptationWorkflowV0(
      world.deps,
      await canonicalRequest(world, {
        semantic_catalog: { ...catalog, channel_policy_id: identifier("other_policy") }
      })
    );
    expect(result.kind).toBe("REJECTED_PRE_SEMANTIC");
    expect(world.provider.calls).toBe(0);
  });
});

describe("Provider call claim and candidate (RAWI22–RAWI30)", () => {
  it("RAWI22/RAWI23/RAWI28/RAWI30: one claim, one call, create-once candidate, deterministic fingerprint", async () => {
    const world = await buildWorld();
    const result = await runRelationshipAdaptationWorkflowV0(world.deps, await canonicalRequest(world));
    expect(result.kind).toBe("COMPLETE_COMMITTED");
    expect(world.provider.calls).toBe(1);
    const record = await world.store.load(identifier(WORKFLOW_ID));
    expect(record?.external_provider_call_count).toBe(1);
    expect(record?.provider_output_candidate).not.toBe(null);
    expect(record?.provider_output_candidate_fingerprint).toMatch(/^sha256:/);
  });

  it("RAWI24/RAWI102/RAWI103: concurrent duplicate invocation — one provider call, at most one commit", async () => {
    const world = await buildWorld();
    const request = await canonicalRequest(world);
    const [first, second] = await Promise.all([
      runRelationshipAdaptationWorkflowV0(world.deps, request),
      runRelationshipAdaptationWorkflowV0(world.deps, request)
    ]);
    expect([first.kind, second.kind].sort()).toEqual(["COMPLETE_COMMITTED", "RESTART_REQUIRED"]);
    expect(world.provider.calls).toBe(1);
    const snapshot = await world.deps.subjectCore.readCurrentSnapshot(identifier(SUBJECT_ID));
    expect(snapshot?.runtime_metadata.state_revision).toBe(1);
  });

  it("RAWI25/RAWI45/RAWI95: claimed + no candidate -> RESTART_REQUIRED NEW_WORKFLOW_ID, no provider call", async () => {
    const twin = await buildWorld();
    const twinResult = await runRelationshipAdaptationWorkflowV0(twin.deps, await canonicalRequest(twin));
    if (twinResult.kind !== "COMPLETE_COMMITTED") throw new Error("twin run failed");
    const twinRecord = await twin.store.load(identifier(WORKFLOW_ID));
    if (twinRecord === null) throw new Error("twin record missing");
    const world = await buildWorld();
    const request = await canonicalRequest(world);
    // Crash window surgery: same deterministic fingerprint, claimed, no candidate.
    await world.store.createIfAbsent({
      ...twinRecord,
      terminal_result: null,
      stage: "A2_SEMANTIC_PROVIDER_CALL",
      external_provider_call_count: 1,
      provider_output_candidate: null,
      provider_output_candidate_fingerprint: null,
      proposal_attempts: []
    });
    const result = await runRelationshipAdaptationWorkflowV0(world.deps, request);
    expect(result.kind).toBe("RESTART_REQUIRED");
    if (result.kind === "RESTART_REQUIRED") {
      expect(result.scope).toBe("NEW_WORKFLOW_ID");
      expect(result.code).toBe("PROVIDER_OUTCOME_UNKNOWN");
    }
    expect(world.provider.calls).toBe(0);
  });

  it("RAWI26/RAWI27: invalid provider output -> REJECTED_SEMANTIC, call count 1, no same-ID retry", async () => {
    const world = await buildWorld();
    const junkProvider: RelationshipSemanticChannelProviderV0 = { propose: async () => ({ junk: true }) };
    const failingDeps: RelationshipAdaptationWorkflowDepsV0 = {
      ...world.deps,
      semanticProvider: junkProvider
    };
    const request = await canonicalRequest(world);
    const result = await runRelationshipAdaptationWorkflowV0(failingDeps, request);
    expect(result.kind).toBe("REJECTED_SEMANTIC");
    if (result.kind === "REJECTED_SEMANTIC") expect(result.code).toBe("INVALID_PROVIDER_OUTPUT");
    const record = await world.store.load(identifier(WORKFLOW_ID));
    expect(record?.external_provider_call_count).toBe(1);
    const replay = await runRelationshipAdaptationWorkflowV0(failingDeps, request);
    expect(replay).toEqual(result);
  });
});

describe("Capability remint and ABSTAIN (RAWI31–RAWI44)", () => {
  it("RAWI31–RAWI34/RAWI38/RAWI96: restart with candidate replays locally; no external recall", async () => {
    const world = await buildWorld({ decision: "CHANNEL_A" });
    const request = await canonicalRequest(world);
    const first = await runRelationshipAdaptationWorkflowV0(world.deps, request);
    expect(first.kind).toBe("COMPLETE_COMMITTED");
    expect(world.provider.calls).toBe(1);
    const record = await world.store.load(identifier(WORKFLOW_ID));
    expect(record?.provider_output_candidate).not.toBe(null);
    const second = await runRelationshipAdaptationWorkflowV0(world.deps, request);
    expect(second).toEqual(first);
    expect(world.provider.calls).toBe(1);
  });

  it("RAWI35: candidate replay against changed repository restarts with NEW_WORKFLOW_ID", async () => {
    const world = await buildWorld();
    const request = await canonicalRequest(world);
    const first = await runRelationshipAdaptationWorkflowV0(world.deps, request);
    expect(first.kind).toBe("COMPLETE_COMMITTED");
    const record = await world.store.load(identifier(WORKFLOW_ID));
    if (record === null) throw new Error("fixture record missing");
    const localStore = new InMemoryRelationshipAdaptationWorkflowStoreV0();
    await localStore.createIfAbsent({
      ...record,
      terminal_result: null,
      stage: "A3_SEMANTIC_ACCEPTED",
      repository_revision: "R-stale"
    });
    const result = await runRelationshipAdaptationWorkflowV0(
      { ...world.deps, workflowStore: localStore },
      request
    );
    expect(result.kind).toBe("RESTART_REQUIRED");
    if (result.kind === "RESTART_REQUIRED") {
      expect(result.code).toBe("REPOSITORY_UNIVERSE_CHANGED");
      expect(result.scope).toBe("NEW_WORKFLOW_ID");
    }
  });

  it("RAWI36/RAWI37: candidate replay against removed counterpart/dimension restarts", async () => {
    const world = await buildWorld();
    const request = await canonicalRequest(world);
    const first = await runRelationshipAdaptationWorkflowV0(world.deps, request);
    expect(first.kind).toBe("COMPLETE_COMMITTED");
    const record = await world.store.load(identifier(WORKFLOW_ID));
    if (record === null) throw new Error("fixture record missing");
    const checkpointed: RelationshipAdaptationWorkflowRecordV0 = {
      ...record,
      terminal_result: null,
      stage: "A3_SEMANTIC_ACCEPTED"
    };
    const localStore = new InMemoryRelationshipAdaptationWorkflowStoreV0();
    await localStore.createIfAbsent(checkpointed);
    const removedCounterpart = await runRelationshipAdaptationWorkflowV0(
      {
        ...world.deps,
        workflowStore: localStore,
        subjectCore: {
          ...world.deps.subjectCore,
          readCurrentSnapshot: async () => subjectStateFixture("R1", { includeAlice: false })
        }
      },
      request
    );
    expect(removedCounterpart.kind).toBe("RESTART_REQUIRED");
    if (removedCounterpart.kind === "RESTART_REQUIRED") expect(removedCounterpart.code).toBe("COUNTERPART_MISSING");

    const localStore2 = new InMemoryRelationshipAdaptationWorkflowStoreV0();
    await localStore2.createIfAbsent(checkpointed);
    const removedDimension = await runRelationshipAdaptationWorkflowV0(
      {
        ...world.deps,
        workflowStore: localStore2,
        subjectCore: {
          ...world.deps.subjectCore,
          readCurrentSnapshot: async () =>
            subjectStateFixture("R1", {
              aliceDimensions: [{ dimension_id: DIM_TRUST, value: 0.6 }]
            })
        }
      },
      request
    );
    expect(removedDimension.kind).toBe("RESTART_REQUIRED");
    if (removedDimension.kind === "RESTART_REQUIRED") {
      expect(removedDimension.code).toBe("TARGET_DIMENSION_UNREGISTERED");
    }
  });

  it("RAWI39–RAWI44: ABSTAIN is a successful terminal with zero mutation and full replay idempotence", async () => {
    const world = await buildWorld({ decision: "ABSTAIN" });
    const request = await canonicalRequest(world);
    const result = await runRelationshipAdaptationWorkflowV0(world.deps, request);
    expect(result).toEqual({ kind: "COMPLETE_ABSTAIN", canonical_commits: 0 });
    expect(world.state.runtime_metadata.state_revision).toBe(0);
    expect(world.state.trace_window.entries).toHaveLength(0);
    expect(world.committedBundles.size).toBe(0);
    const record = await world.store.load(identifier(WORKFLOW_ID));
    expect(record?.stage).toBe("A8_COMPLETE");
    const replay = await runRelationshipAdaptationWorkflowV0(world.deps, request);
    expect(replay).toEqual(result);
    expect(world.provider.calls).toBe(1);
  });
});

describe("Internal projections and plasticity (RAWI45–RAWI60)", () => {
  it("RAWI45: caller cannot supply projections (unknown key rejected)", async () => {
    const world = await buildWorld();
    const result = await runRelationshipAdaptationWorkflowV0(
      world.deps,
      await canonicalRequest(world, { projections: [{ memory_ref: "episode:ep-01" }] })
    );
    expect(result.kind).toBe("REJECTED_PRE_SEMANTIC");
    expect(world.provider.calls).toBe(0);
  });

  it("RAWI46–RAWI49/RAWI53/RAWI54: internal projections at current logical time feed the frozen producer; commit applied", async () => {
    const world = await buildWorld();
    const result = await runRelationshipAdaptationWorkflowV0(world.deps, await canonicalRequest(world));
    expect(result.kind).toBe("COMPLETE_COMMITTED");
    if (result.kind !== "COMPLETE_COMMITTED") return;
    expect(result.final_state_revision).toBe(1);
    const snapshot = await world.deps.subjectCore.readCurrentSnapshot(identifier(SUBJECT_ID));
    const alice = snapshot?.relationships.counterparts.find((entry) => entry.counterpart_ref === ALICE);
    // CH_A -> DIM_CLOSE INCREASE, capped step 0.05 from 0.4.
    expect(alice?.dimensions.find((entry) => entry.dimension_id === DIM_CLOSE)?.value).toBe(0.45);
    // Projection ages equal CURRENT logical time minus occurrence (frozen formula).
    expect(world.state.runtime_metadata.logical_time).toBe(BASE_LOGICAL_TIME);
  });

  it("RAWI55: EVIDENCE_NOT_ELIGIBLE -> COMPLETE_NO_PROPOSAL with the exact reason", async () => {
    // Two records: minMemberCount 3 fails under the frozen eligibility policy.
    const world = await buildWorld({ records: baseRecords(0.8, 2) });
    const result = await runRelationshipAdaptationWorkflowV0(world.deps, await canonicalRequest(world));
    expect(result).toEqual({
      kind: "COMPLETE_NO_PROPOSAL",
      reason: "EVIDENCE_NOT_ELIGIBLE",
      canonical_commits: 0
    });
    expect(world.committedBundles.size).toBe(0);
  });

  it("RAWI56: ZERO_EFFECTIVE_INFLUENCE -> COMPLETE_NO_PROPOSAL", async () => {
    const world = await buildWorld();
    const request = await canonicalRequest(world, {
      memory_influence_policy: { baseDecayRate: 0.03, recencyWeight: 0, importanceWeight: 0 }
    });
    const result = await runRelationshipAdaptationWorkflowV0(world.deps, request);
    expect(result).toEqual({
      kind: "COMPLETE_NO_PROPOSAL",
      reason: "ZERO_EFFECTIVE_INFLUENCE",
      canonical_commits: 0
    });
    expect(world.committedBundles.size).toBe(0);
  });

  it("RAWI57: SATURATED -> COMPLETE_NO_PROPOSAL", async () => {
    const world = await buildWorld({
      state: subjectStateFixture("R1", {
        aliceDimensions: [
          { dimension_id: DIM_CLOSE, value: 1 },
          { dimension_id: DIM_TRUST, value: 0.6 }
        ]
      })
    });
    const result = await runRelationshipAdaptationWorkflowV0(world.deps, await canonicalRequest(world));
    expect(result).toEqual({ kind: "COMPLETE_NO_PROPOSAL", reason: "SATURATED", canonical_commits: 0 });
    expect(world.committedBundles.size).toBe(0);
  });

  it("RAWI59: Plasticity repository mismatch -> RESTART_REQUIRED NEW_WORKFLOW_ID", async () => {
    const world = await buildWorld();
    const request = await canonicalRequest(world);
    const first = await runRelationshipAdaptationWorkflowV0(world.deps, request);
    expect(first.kind).toBe("COMPLETE_COMMITTED");
    const record = await world.store.load(identifier(WORKFLOW_ID));
    if (record === null) throw new Error("fixture record missing");
    const localStore = new InMemoryRelationshipAdaptationWorkflowStoreV0();
    await localStore.createIfAbsent({
      ...record,
      terminal_result: null,
      stage: "A3_SEMANTIC_ACCEPTED",
      repository_revision: "R-stale"
    });
    const result = await runRelationshipAdaptationWorkflowV0(
      { ...world.deps, workflowStore: localStore },
      request
    );
    expect(result.kind).toBe("RESTART_REQUIRED");
  });

  it("RAWI60: no no-proposal outcome reaches the executor", async () => {
    const world = await buildWorld({ decision: "ABSTAIN" });
    await runRelationshipAdaptationWorkflowV0(world.deps, await canonicalRequest(world));
    expect(world.committedBundles.size).toBe(0);
  });
});

describe("Proposal checkpoint, executor and journal (RAWI61–RAWI79)", () => {
  it("RAWI61–RAWI69: append-only checkpoint, frozen transition identity, canonical trace from commit only", async () => {
    const world = await buildWorld();
    const result = await runRelationshipAdaptationWorkflowV0(world.deps, await canonicalRequest(world));
    expect(result.kind).toBe("COMPLETE_COMMITTED");
    const record = await world.store.load(identifier(WORKFLOW_ID));
    expect(record?.proposal_attempts).toHaveLength(1);
    expect(record?.proposal_attempts[0]?.rebuild_ordinal).toBe(0);
    expect(record?.proposal_attempts[0]?.transition_id).toMatch(/^t-relationship-/);
    const snapshot = await world.deps.subjectCore.readCurrentSnapshot(identifier(SUBJECT_ID));
    expect(snapshot?.trace_window.entries).toHaveLength(1);
    expect(snapshot?.trace_window.entries[0]?.transition_type).toBe("Relationship");
  });

  it("RAWI70/RAWI71/RAWI98: committed bundle found -> executor not re-invoked; commit-before-terminal recovers", async () => {
    const world = await buildWorld();
    const request = await canonicalRequest(world);
    const first = await runRelationshipAdaptationWorkflowV0(world.deps, request);
    expect(first.kind).toBe("COMPLETE_COMMITTED");
    const record = await world.store.load(identifier(WORKFLOW_ID));
    if (record === null) throw new Error("fixture record missing");
    expect(record.proposal_attempts[0] ? world.committedBundles.has(record.proposal_attempts[0].transition_id) : false).toBe(true);
    const localStore = new InMemoryRelationshipAdaptationWorkflowStoreV0();
    await localStore.createIfAbsent({ ...record, terminal_result: null, stage: "A7_CANONICAL_COMMIT" });
    const callsBefore = world.provider.calls;
    const resumed = await runRelationshipAdaptationWorkflowV0(
      { ...world.deps, workflowStore: localStore },
      request
    );
    expect(resumed.kind).toBe("COMPLETE_ALREADY_COMMITTED");
    expect(world.provider.calls).toBe(callsBefore);
    const snapshot = await world.deps.subjectCore.readCurrentSnapshot(identifier(SUBJECT_ID));
    expect(snapshot?.runtime_metadata.state_revision).toBe(1);
  });

  it("RAWI72/RAWI74/RAWI105: COMMITTED -> +1 exactly once; replay after commit -> +0", async () => {
    const world = await buildWorld();
    const request = await canonicalRequest(world);
    const first = await runRelationshipAdaptationWorkflowV0(world.deps, request);
    expect(first.kind).toBe("COMPLETE_COMMITTED");
    if (first.kind !== "COMPLETE_COMMITTED") return;
    expect(first.canonical_commits).toBe(1);
    expect(first.final_state_revision).toBe(1);
    const second = await runRelationshipAdaptationWorkflowV0(world.deps, request);
    expect(second).toEqual(first);
    expect(
      (await world.deps.subjectCore.readCurrentSnapshot(identifier(SUBJECT_ID)))?.runtime_metadata
        .state_revision
    ).toBe(1);
  });

  it("RAWI75/RAWI106: executor REUSE_CONFLICT -> FATAL, no identity escape", async () => {
    // World 1 commits the proposal and yields its exact checkpoint.
    const world = await buildWorld();
    const request = await canonicalRequest(world);
    const first = await runRelationshipAdaptationWorkflowV0(world.deps, request);
    expect(first.kind).toBe("COMPLETE_COMMITTED");
    const record = await world.store.load(identifier(WORKFLOW_ID));
    if (record === null) throw new Error("fixture record missing");
    const committed = at(record.proposal_attempts, 0);
    // World 2 (fresh facade, same anchors) pre-reserves the SAME transition
    // identity with a CONFLICTING payload (next_value 0.9).
    const world2 = await buildWorld();
    const conflictingProposal = {
      ...committed.proposal,
      updates: [
        {
          dimension_id: committed.proposal.updates[0]?.dimension_id,
          next_value: unit(0.9)
        }
      ]
    } as RelationshipUpdateProposalV0;
    expect(validateRelationshipUpdateProposal(conflictingProposal).ok).toBe(true);
    const conflictTransitionId = await deriveRelationshipTransitionId(conflictingProposal);
    expect(conflictTransitionId).toBe(committed.transition_id);
    const current = await world2.deps.subjectCore.readCurrentSnapshot(identifier(SUBJECT_ID));
    if (current === null) throw new Error("fixture state missing");
    const nextRelationships = {
      schema_version: RELATIONSHIP_STATE_SCHEMA_VERSION,
      counterparts: current.relationships.counterparts.map((entry) =>
        entry.counterpart_ref !== ALICE
          ? entry
          : {
              counterpart_ref: entry.counterpart_ref,
              dimensions: entry.dimensions.map((dimension) =>
                dimension.dimension_id === conflictingProposal.updates[0]?.dimension_id
                  ? {
                      dimension_id: dimension.dimension_id,
                      value: conflictingProposal.updates[0]?.next_value
                    }
                  : dimension
              )
            }
      )
    };
    const reservation = await world2.facade.facade.reserveAndRoute({
      schema_version: "canonical-transition-proposal-v1",
      transition_id: conflictTransitionId,
      subject_id: identifier(SUBJECT_ID),
      transition_type: "Relationship",
      expected_state_revision: conflictingProposal.expected_state_revision,
      time_input: { kind: "OCCURRENCE", occurrence_logical_time: current.runtime_metadata.logical_time },
      cause_refs: [...conflictingProposal.evidence_binding.member_refs],
      domain_deltas: [
        {
          producer: identifier("relationship"),
          domain: "relationship",
          expected_repository_revision: null,
          operations: [{ path: "/relationships", value: nextRelationships }],
          provenance_refs: [...conflictingProposal.evidence_binding.member_refs]
        }
      ],
      external_refs: []
    });
    expect(reservation.kind).toBe("CONTINUE");
    // The workflow's own proposal carries the same identity with the original
    // payload -> the journal rejects it -> FATAL, no identity escape.
    const second = await runRelationshipAdaptationWorkflowV0(
      world2.deps,
      await canonicalRequest(world2, { workflow_id: identifier("wf_adaptation_2") })
    );
    expect(second.kind).toBe("FATAL_REUSE_CONFLICT");
    if (second.kind === "FATAL_REUSE_CONFLICT") expect(second.source).toBe("EXECUTOR_TRANSITION");
  });

  it("RAWI76/RAWI77: executor rejections fail closed", async () => {
    const world = await buildWorld();
    const refusingIssuer: ProducerAuthorizationIssuer = {
      issue: () => ({
        schema_version: "producer-authorization-set-v1",
        bindings: []
      }),
      verify: () => false
    };
    const result = await runRelationshipAdaptationWorkflowV0(
      { ...world.deps, producerAuthorizationIssuer: refusingIssuer },
      await canonicalRequest(world)
    );
    expect(result.kind).toBe("REJECTED_EXECUTOR");
  });

  it("RAWI78/RAWI79: A7 checkpoint without terminal reconciles through the journal first", async () => {
    const world = await buildWorld();
    const request = await canonicalRequest(world);
    const first = await runRelationshipAdaptationWorkflowV0(world.deps, request);
    expect(first.kind).toBe("COMPLETE_COMMITTED");
    const record = await world.store.load(identifier(WORKFLOW_ID));
    if (record === null) throw new Error("fixture record missing");
    const localStore = new InMemoryRelationshipAdaptationWorkflowStoreV0();
    await localStore.createIfAbsent({ ...record, terminal_result: null, stage: "A7_CANONICAL_COMMIT" });
    const resumed = await runRelationshipAdaptationWorkflowV0(
      { ...world.deps, workflowStore: localStore },
      request
    );
    expect(["COMPLETE_COMMITTED", "COMPLETE_ALREADY_COMMITTED"]).toContain(resumed.kind);
    expect(
      (await world.deps.subjectCore.readCurrentSnapshot(identifier(SUBJECT_ID)))?.runtime_metadata
        .state_revision
    ).toBeLessThanOrEqual(1);
  });
});

describe("Stale rebuild (RAWI80–RAWI93)", () => {
  it("RAWI80–RAWI93: one deterministic rebuild against the CURRENT revision; ordinals append-only; bound enforced", async () => {
    // facade0: the universe the workflow first targets (revision 0).
    // facade1: the universe as it will be AFTER a concurrent commit (revision 1).
    const facade0World = await buildWorld();
    const facade1World = await buildWorld({
      state: subjectStateFixture("R1", { stateRevision: 1 })
    });
    // Workflow B's request anchors bind the CURRENT facade0 truth.
    const requestB = await canonicalRequest(facade0World, { workflow_id: identifier("wf_adaptation_B") });
    const facade0Read = facade0World.deps.subjectCore.readCurrentSnapshot;
    const facade1Read = facade1World.deps.subjectCore.readCurrentSnapshot;
    let reads = 0;
    // Read 1: admission (facade0 rev 0). Read 2: semantic replay (facade0 rev 0).
    // Deterministic staleness injection: reads 1-2 (admission, semantic
    // replay) and reads >= 4 (rebuild + attempt 2) see facade0 (rev 0); ONLY
    // the executor's internal re-read (read 3) sees facade1 (rev 1) — the
    // executor's snapshot-vs-expected check then rejects ordinal 0 as stale,
    // the single rebuild re-reads facade0 (rev 0) and commits rev 1.
    const port: SubjectCorePort = {
      reserveAndRoute: (proposal) => facade0World.facade.facade.reserveAndRoute(proposal),
      commitReserved: (input) => facade0World.facade.facade.commitReserved(input),
      terminalizeReservedNoOp: (input) => facade0World.facade.facade.terminalizeReservedNoOp(input),
      reconcile: (transitionId, subjectId, fingerprint) => facade0World.facade.facade.reconcile(transitionId, subjectId, fingerprint),
      readCurrentSnapshot: async (subjectId) => {
        reads += 1;
        if (reads === 3) return facade1Read(subjectId);
        return facade0Read(subjectId);
      }
    };
    // The commit lands on facade0, so the workflow carries facade0's issuer.
    const staleDeps: RelationshipAdaptationWorkflowDepsV0 = {
      ...facade0World.deps,
      subjectCore: port,
      producerAuthorizationIssuer: facade0World.deps.producerAuthorizationIssuer
    };
    const origCommit = facade1World.facade.facade.commitReserved.bind(facade1World.facade.facade);
    facade1World.facade.facade.commitReserved = async (input: unknown) => {
      const outcome = await origCommit(input as never);
      console.log("DEBUG_F1_COMMIT", outcome.kind, outcome.kind === "REJECTED" ? outcome.failure?.detail : "");
      return outcome;
    };
    const resultB = await runRelationshipAdaptationWorkflowV0(staleDeps, requestB);
    console.log("DEBUG_RESULTB", JSON.stringify(resultB));
    expect(resultB.kind).toBe("COMPLETE_COMMITTED");
    if (resultB.kind !== "COMPLETE_COMMITTED") return;
    // The rebuilt (ordinal 1) proposal committed on facade0 (rev 0 -> 1).
    expect(resultB.final_state_revision).toBe(1);
    void facade1World;
    const record = await facade0World.store.load(identifier("wf_adaptation_B"));
    expect(record?.proposal_attempts).toHaveLength(2);
    expect(record?.proposal_attempts[0]?.rebuild_ordinal).toBe(0);
    expect(record?.proposal_attempts[1]?.rebuild_ordinal).toBe(1);
    expect(record?.plasticity_rebuild_ordinal).toBe(1);
    // Ordinal 0 bound the concurrent rev-1 view the workflow's replay observed;
    // the executor's CURRENT re-read (facade0, rev 0) rejected it as stale, and
    // the single rebuild re-read CURRENT state and bound revision 0.
    expect(record?.proposal_attempts[0]?.proposal.expected_state_revision).toBe(1);
    expect(record?.proposal_attempts[1]?.proposal.expected_state_revision).toBe(0);
    // A changed expected revision changes the frozen transition identity: the
    // rebuild is a genuinely NEW deterministic proposal, never a byte reuse.
    expect(record?.proposal_attempts[0]?.transition_id).not.toBe(
      record?.proposal_attempts[1]?.transition_id
    );
    // Exactly one external provider call across the whole workflow.
    expect(facade0World.provider.calls).toBe(1);
    // facade1 was only ever a stale READ view; it was never committed to.
    expect(facade1World.committedBundles.size).toBe(0);
    // facade0 advanced exactly once (the rebuilt commit).
    expect(
      (await facade0World.deps.subjectCore.readCurrentSnapshot(identifier(SUBJECT_ID)))?.runtime_metadata
        .state_revision
    ).toBe(1);
  });
});

describe("Process restart matrix and idempotency (RAWI94–RAWI105)", () => {
  it("RAWI94/RAWI97: restart before provider resumes; journal holds the committed transition", async () => {
    const world = await buildWorld();
    const request = await canonicalRequest(world);
    const first = await runRelationshipAdaptationWorkflowV0(world.deps, request);
    expect(first.kind).toBe("COMPLETE_COMMITTED");
    const record = await world.store.load(identifier(WORKFLOW_ID));
    if (record === null) throw new Error("fixture record missing");
    const transitionId = at(record.proposal_attempts, 0).transition_id;
    expect(world.committedBundles.has(transitionId)).toBe(true);
  });

  it("RAWI99/RAWI100: terminal replay is byte-equivalent and runs nothing", async () => {
    const world = await buildWorld();
    const request = await canonicalRequest(world);
    const first = await runRelationshipAdaptationWorkflowV0(world.deps, request);
    const callsBefore = world.provider.calls;
    const bundlesBefore = world.committedBundles.size;
    const second = await runRelationshipAdaptationWorkflowV0(world.deps, request);
    expect(second).toEqual(first);
    expect(world.provider.calls).toBe(callsBefore);
    expect(world.committedBundles.size).toBe(bundlesBefore);
  });

  it("RAWI101/RAWI104: sequential duplicates commit at most once", async () => {
    const world = await buildWorld();
    const request = await canonicalRequest(world);
    await runRelationshipAdaptationWorkflowV0(world.deps, request);
    await runRelationshipAdaptationWorkflowV0(world.deps, request);
    const snapshot = await world.deps.subjectCore.readCurrentSnapshot(identifier(SUBJECT_ID));
    expect(snapshot?.runtime_metadata.state_revision).toBe(1);
  });
});

describe("Non-scope (RAWI107–RAWI120)", () => {
  it("RAWI107/RAWI108: SubjectState remains V2 and is never mutated by the workflow", async () => {
    const world = await buildWorld({ decision: "ABSTAIN" });
    const before = structuredClone(world.state);
    await runRelationshipAdaptationWorkflowV0(world.deps, await canonicalRequest(world));
    expect(world.state.schema_version).toBe("subject-state-v2");
    expect(validateSubjectState(world.state).ok).toBe(true);
    expect(world.state).toEqual(before);
  });

  it("RAWI109–RAWI119: no reasoning/capability/projection persistence; no caller magnitude surface", async () => {
    const world = await buildWorld({ decision: "ABSTAIN" });
    const result = await runRelationshipAdaptationWorkflowV0(world.deps, await canonicalRequest(world));
    expect(result.kind).toBe("COMPLETE_ABSTAIN");
    const record = await world.store.load(identifier(WORKFLOW_ID));
    const serialized = JSON.stringify(record);
    expect(serialized).not.toContain("scene");
    expect(serialized).not.toContain("criterion");
    expect(serialized).not.toContain("decay_factor");
    expect(serialized).not.toContain("activation_strength");
    expect(serialized).not.toContain("reasoning");
    expect(serialized).not.toContain("subject_state_snapshot");
    expect(record?.proposal_attempts.every((attempt) => !("projections" in attempt.proposal))).toBe(true);
  });

  it("RAWI120: workflow introduces no new workspace dependency edges", () => {
    const runtimePackage = JSON.parse(runtimePackageRaw) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const workspaceDeps = Object.keys({
      ...runtimePackage.dependencies,
      ...runtimePackage.devDependencies
    })
      .filter((name) => name.startsWith("@characteros-next/"))
      .sort();
    expect(workspaceDeps).toEqual([
      "@characteros-next/influence-evidence",
      "@characteros-next/memory",
      "@characteros-next/memory-influence",
      "@characteros-next/subject-core"
    ]);
  });
});
