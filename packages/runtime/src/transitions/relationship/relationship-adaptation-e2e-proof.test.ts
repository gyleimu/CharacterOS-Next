/**
 * Relationship Adaptation — Offline Deterministic E2E Proof V0.
 *
 * NON_SCIENTIFIC_TEST_FIXTURE: identifiers, scenes, channels, and criteria here
 * are synthetic test scaffolding only; no production psychology is encoded.
 *
 * E2E_FAKE_BOUNDARY: SEMANTIC_PROVIDER_ONLY — the ONLY intentionally fake
 * component is the deterministic offline RelationshipSemanticChannelProviderV0.
 * The RelationshipPlasticityProducer, RelationshipTransitionExecutor, SubjectCore
 * canonical commit, MemoryInfluenceProjection, RelationshipUpdateProposal
 * validation, workflow identity, and workflow store semantics are the REAL
 * frozen production logic. No network, no real model, no real provider.
 *
 * The primary proof exercises the COMPLETE frozen chain:
 * episodic records → semantic routing → fake CHANNEL → host-minted capability
 * → workflow-internal projections → frozen Plasticity → proposal → workflow
 * → frozen executor → SubjectCore → canonical RelationshipState mutation,
 * then proves BEFORE/AFTER: revision +1, bounded value change (<= 0.05),
 * exactly one Relationship commit trace, logical time unchanged,
 * cross-domain isolation, and byte-equivalent replay with +0 commits.
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
  type SubjectStateV0,
  type UnitIntervalV0
} from "@characteros-next/subject-core";
import { ENGINEERING_REFERENCE_V0_MEMORY_INFLUENCE_POLICY } from "@characteros-next/memory-influence";
import { s0 } from "../observation/observation-fixtures.js";
import type { SubjectCorePort } from "../../ports/subject-core-port.js";
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

const SUBJECT_ID = "subject-s0";
const ALICE = "entity:alice";
const DIMENSION_ID = "relationship_test_dimension_v0";
const CHANNEL_ID = "ch_test_positive_event";
const WORKFLOW_ID = "wf_e2e_proof_1";
const BASE_LOGICAL_TIME = 10;
const INITIAL_DIMENSION_VALUE = 0.4;

function unit(value: number): UnitIntervalV0 {
  if (!(value >= 0 && value <= 1)) throw new Error("fixture unit out of range");
  return value as UnitIntervalV0;
}

function identifier(raw: string): never {
  return raw as never;
}

/** TEST-ONLY hidden policy: CHANNEL -> test dimension -> INCREASE. */
function policyFixture(): RelationshipEvidenceChannelPolicyV0 {
  return {
    schema_version: RELATIONSHIP_EVIDENCE_CHANNEL_POLICY_SCHEMA_VERSION,
    policy_id: identifier("e2e_proof_policy"),
    channels: [
      { channel_id: identifier(CHANNEL_ID), target_dimension_id: identifier(DIMENSION_ID), direction: "INCREASE" }
    ]
  };
}

async function catalogFixture(): Promise<RelationshipSemanticChannelCatalogV0> {
  const policy = policyFixture();
  return {
    schema_version: RELATIONSHIP_SEMANTIC_CHANNEL_CATALOG_SCHEMA_VERSION,
    catalog_id: identifier("e2e_proof_catalog"),
    channel_policy_id: policy.policy_id,
    channel_policy_fingerprint: await deriveRelationshipEvidenceChannelPolicyFingerprint(policy),
    channels: [
      {
        channel_id: identifier(CHANNEL_ID),
        criterion: "Evidence matches the synthetic adaptation test condition."
      }
    ]
  };
}

function recordFixture(
  episodeRef: string,
  scene: string,
  occurrenceLogicalTime: number,
  references: readonly string[] = [ALICE]
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
    salience: { declared_score: unit(0.8), source: SALIENCE_SOURCE_ENCODING_DECLARED }
  };
}

/** Three records satisfying the frozen eligibility thresholds (NON_SCIENTIFIC_TEST_FIXTURE). */
function proofRecords(): EpisodicMemoryRecordV0[] {
  return [
    recordFixture("episode:e2e-a", "Alice helped during task A.", 7),
    recordFixture("episode:e2e-b", "Alice helped during task B.", 8),
    recordFixture("episode:e2e-c", "Alice helped during task C.", 9)
  ];
}

function subjectStateFixture(repositoryRevision: string): SubjectStateV0 {
  const base = s0() as unknown as SubjectStateV0;
  const state: unknown = {
    ...base,
    memory_state: { ...base.memory_state, repository_revision: repositoryRevision as never },
    relationships: {
      schema_version: RELATIONSHIP_STATE_SCHEMA_VERSION,
      counterparts: [
        {
          counterpart_ref: ALICE,
          dimensions: [
            { dimension_id: identifier(DIMENSION_ID), value: unit(INITIAL_DIMENSION_VALUE) }
          ]
        }
      ]
    },
    runtime_metadata: {
      ...base.runtime_metadata,
      logical_time: BASE_LOGICAL_TIME,
      state_revision: 0
    }
  };
  return state as unknown as SubjectStateV0;
}

/** Deterministic in-memory workflow store (test-only infrastructure, atomic semantics preserved). */
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

/** The ONLY fake: deterministic offline semantic provider selecting CHANNEL (or ABSTAIN). */
class DeterministicOfflineSemanticProvider implements RelationshipSemanticChannelProviderV0 {
  calls = 0;

  constructor(private readonly decision: "CHANNEL" | "ABSTAIN") {}

  async propose(input: { semantic_context_fingerprint: unknown; catalog_fingerprint: unknown }): Promise<unknown> {
    this.calls += 1;
    const bindings = {
      schema_version: RELATIONSHIP_SEMANTIC_PROVIDER_OUTPUT_SCHEMA_VERSION,
      semantic_context_fingerprint: input.semantic_context_fingerprint,
      catalog_fingerprint: input.catalog_fingerprint
    };
    if (this.decision === "ABSTAIN") return { ...bindings, kind: "ABSTAIN" };
    return { ...bindings, kind: "CHANNEL", channel_id: identifier(CHANNEL_ID) };
  }
}

async function buildProofWorld(
  decision: "CHANNEL" | "ABSTAIN"
): Promise<{
  deps: RelationshipAdaptationWorkflowDepsV0;
  store: InMemoryRelationshipAdaptationWorkflowStoreV0;
  provider: DeterministicOfflineSemanticProvider;
  records: readonly EpisodicMemoryRecordV0[];
  state: SubjectStateV0;
  committedBundles: Map<string, AtomicCommitBundleV1>;
}> {
  const repository = new InMemoryMemoryRepository();
  await repository.prepareRevision({ parent_revision: null, records: [] });
  const records = proofRecords();
  const hashes = [];
  for (const record of records) {
    hashes.push({
      ref: record.episode_ref,
      payload_hash: await repository.storePayload(record.episode_ref, record)
    });
  }
  await repository.prepareRevision({ parent_revision: "R0" as never, records: hashes as never });
  const state = subjectStateFixture("R1");
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
  const provider = new DeterministicOfflineSemanticProvider(decision);
  const deps: RelationshipAdaptationWorkflowDepsV0 = {
    subjectCore: port,
    memoryRepository: repository,
    producerAuthorizationIssuer: facade.producerAuthorizationIssuer,
    semanticProvider: provider,
    workflowStore: new InMemoryRelationshipAdaptationWorkflowStoreV0(),
    readCommittedBundle: async (transitionId) => committedBundles.get(transitionId) ?? null
  };
  return { deps, store: deps.workflowStore as InMemoryRelationshipAdaptationWorkflowStoreV0, provider, records, state, committedBundles };
}

async function proofRequest(
  world: Awaited<ReturnType<typeof buildProofWorld>>
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
    memory_influence_policy: ENGINEERING_REFERENCE_V0_MEMORY_INFLUENCE_POLICY
  };
}

/** Frozen unrelated domains that must remain byte-identical across the adaptation. */
const FROZEN_DOMAIN_KEYS = [
  "identity",
  "traits_seed",
  "personality",
  "memory_state",
  "beliefs",
  "mood",
  "affect",
  "regulation",
  "context",
  "mechanism_config"
] as const;

function dimensionValue(snapshot: SubjectStateV0, counterpartRef: string): number | undefined {
  return snapshot.relationships.counterparts
    .find((entry) => entry.counterpart_ref === counterpartRef)
    ?.dimensions.find((entry) => entry.dimension_id === DIMENSION_ID)?.value;
}

describe("Relationship Adaptation Offline Deterministic E2E Proof V0", () => {
  it("offline deterministic full Relationship adaptation commits one bounded canonical relationship change end-to-end", async () => {
    const world = await buildProofWorld("CHANNEL");
    const request = await proofRequest(world);

    // ---- BEFORE snapshot (authoritative canonical read) ------------------------
    const before = await world.deps.subjectCore.readCurrentSnapshot(identifier(SUBJECT_ID));
    if (before === null) throw new Error("canonical before snapshot missing");
    expect(before.schema_version).toBe("subject-state-v2");
    expect(validateSubjectState(before).ok).toBe(true);
    const beforeRevision = before.runtime_metadata.state_revision;
    const beforeLogicalTime = before.runtime_metadata.logical_time;
    const beforeTraceCount = before.trace_window.entries.length;
    const beforeValue = dimensionValue(before, ALICE);
    if (beforeValue === undefined) throw new Error("target dimension missing before commit");
    expect(beforeValue).toBe(INITIAL_DIMENSION_VALUE);
    const beforeClone = structuredClone(before);

    // ---- RUN the REAL workflow (the workflow owns the full chain) --------------
    const result = await runRelationshipAdaptationWorkflowV0(world.deps, request);

    // ---- EXPECTED WORKFLOW RESULT ----------------------------------------------
    expect(result.kind).toBe("COMPLETE_COMMITTED");
    if (result.kind !== "COMPLETE_COMMITTED") return;
    expect(result.canonical_commits).toBe(1);
    expect(result.final_state_revision).toBe(beforeRevision + 1);

    // ---- AFTER snapshot ----------------------------------------------------------
    const after = await world.deps.subjectCore.readCurrentSnapshot(identifier(SUBJECT_ID));
    if (after === null) throw new Error("canonical after snapshot missing");
    const afterRevision = after.runtime_metadata.state_revision;
    const afterValue = dimensionValue(after, ALICE);
    if (afterValue === undefined) throw new Error("target dimension missing after commit");

    // E2E_CANONICAL_REVISION_DELTA: EXACTLY_ONE
    expect(afterRevision).toBe(beforeRevision + 1);

    // E2E_LOGICAL_TIME_DELTA: ZERO
    expect(after.runtime_metadata.logical_time).toBe(beforeLogicalTime);

    // target counterpart + dimension still registered; bounded INCREASE
    expect(after.relationships.counterparts.some((entry) => entry.counterpart_ref === ALICE)).toBe(true);
    expect(afterValue).not.toBe(beforeValue);
    expect(afterValue).toBeGreaterThan(beforeValue);
    expect(afterValue - beforeValue).toBeLessThanOrEqual(0.05);

    // E2E_VALUE_CAUSAL_CHAIN: canonical value == proposal next_value == before + frozen step
    const record = await world.store.load(identifier(WORKFLOW_ID));
    if (record === null) throw new Error("workflow record missing");
    expect(record.proposal_attempts).toHaveLength(1);
    const proposal = record.proposal_attempts[0]?.proposal;
    const proposalNextValue = proposal?.updates[0]?.next_value;
    expect(proposalNextValue).toBeDefined();
    expect(afterValue).toBe(proposalNextValue);
    // Exact deterministic frozen-plasticity outcome for this fixture (step cap 0.05 from 0.4).
    expect(afterValue).toBe(0.45);
    expect(attemptTransitionIdMatches(record, result)).toBe(true);

    // E2E_CANONICAL_TRACE_DELTA: EXACTLY_ONE_RELATIONSHIP_COMMIT_TRACE
    expect(after.trace_window.entries).toHaveLength(beforeTraceCount + 1);
    const newTrace = after.trace_window.entries[after.trace_window.entries.length - 1];
    expect(newTrace?.transition_type).toBe("Relationship");
    expect(newTrace?.transition_id).toBe(result.transition_id);
    const bundle = world.committedBundles.get(result.transition_id);
    expect(bundle).toBeDefined();
    expect(bundle?.commit_ref).toBe(result.commit_ref);

    // E2E_CROSS_DOMAIN_MUTATION: RELATIONSHIP_ONLY
    for (const key of FROZEN_DOMAIN_KEYS) {
      expect(after[key]).toEqual(beforeClone[key]);
    }

    // ---- EXACT REPLAY (same workflow id + request + deps) ----------------------
    const first = result;
    const second = await runRelationshipAdaptationWorkflowV0(world.deps, request);
    expect(second).toEqual(first);

    // E2E_REPLAY_NEW_CANONICAL_COMMITS: ZERO
    const afterReplay = await world.deps.subjectCore.readCurrentSnapshot(identifier(SUBJECT_ID));
    if (afterReplay === null) throw new Error("canonical replay snapshot missing");
    expect(afterReplay.runtime_metadata.state_revision).toBe(afterRevision);
    expect(dimensionValue(afterReplay, ALICE)).toBe(afterValue);
    expect(afterReplay.trace_window.entries).toHaveLength(beforeTraceCount + 1);

    // E2E_EXTERNAL_PROVIDER_CALLS: ONE_TOTAL
    expect(world.provider.calls).toBe(1);
  });

  it("ABSTAIN control: legal semantic abstain is a successful terminal with zero mutation", async () => {
    const world = await buildProofWorld("ABSTAIN");
    const request = await proofRequest(world);
    const before = await world.deps.subjectCore.readCurrentSnapshot(identifier(SUBJECT_ID));
    if (before === null) throw new Error("canonical before snapshot missing");

    const result = await runRelationshipAdaptationWorkflowV0(world.deps, request);
    expect(result).toEqual({ kind: "COMPLETE_ABSTAIN", canonical_commits: 0 });
    expect(world.provider.calls).toBe(1);

    const after = await world.deps.subjectCore.readCurrentSnapshot(identifier(SUBJECT_ID));
    if (after === null) throw new Error("canonical after snapshot missing");
    expect(after.runtime_metadata.state_revision).toBe(before.runtime_metadata.state_revision);
    expect(dimensionValue(after, ALICE)).toBe(INITIAL_DIMENSION_VALUE);
    expect(after.trace_window.entries).toHaveLength(before.trace_window.entries.length);
  });
});

function attemptTransitionIdMatches(
  record: RelationshipAdaptationWorkflowRecordV0,
  result: RelationshipAdaptationTerminalV0
): boolean {
  if (result.kind !== "COMPLETE_COMMITTED") return false;
  const attempt = record.proposal_attempts[0];
  return attempt !== undefined && attempt.transition_id === result.transition_id;
}
