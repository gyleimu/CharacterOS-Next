/**
 * MEMORY_REVISION_LONG_TERM_VISIBILITY_V0 — multi-revision integration proof.
 *
 * Real deterministic chain through the lawful writers only:
 *   R1 = real BEHAVIOR_EXPERIENCE_FEEDBACK_V0 (V1/E1/P1, outcome text
 *        以后项目进度说明保持这个格式。)
 *   R2 = real ordinary Learning (P2)
 *   R3 = real feedback again (V3/E3/P3, different conversation event)
 *   R4 = real ordinary Learning (P4)
 *
 * Proves: manifests remain deltas; V(R4) contains every ancestor record with
 * stable refs/hashes; natural repository-backed retrieval at R4 selects P1
 * WITHOUT any manual history injection; ExperienceReader resolves the R1
 * lineage at R4; cognition receives the exact E1 factual text; fresh-restore
 * preserves the whole behavior.
 */

import { describe, expect, it } from "vitest";

import type {
  AtomicCommitBundleAnyVersion,
  InMemoryFacadeAssembly,
  ProducerAuthorizationIssuer,
  SubjectStateV0
} from "@characteros-next/subject-core";
import {
  createInMemorySubjectCoreFacade,
  createPersistenceEnvelope,
  restoreFromEnvelope
} from "@characteros-next/subject-core";
import {
  InMemoryMemoryRepository,
  RepositoryBackedMemoryRetrievalServiceV0,
  retrievalQueryFingerprint,
  computeRepositoryRevisionHash,
  createEpisodeContentReaderV0,
  type MemoryPreparationAuthority,
  type MemoryRetrievalQueryV0,
  type MemoryRetrievalResultV0
} from "@characteros-next/memory";
import type { CharacterLanguageBehaviorV0 } from "@characteros-next/behavior";
import { buildCharacterLanguageBehaviorV0 } from "@characteros-next/behavior";
import { buildContextDelta, ReferenceContextProducer } from "../../ports/context-producer-port.js";
import { ReferenceRetrievalMetadataProducer } from "../../ports/retrieval-metadata-producer-port.js";
import {
  fixedAppraisal,
  fixedAffectProducer,
  fixedInterpretation,
  observationInput,
  s0
} from "../observation/observation-fixtures.js";
import {
  buildObservationProposal,
  ObservationTransitionExecutor
} from "../observation/observation-transition-executor.js";
import { RuntimeCompositionRoot } from "../../composition/runtime-composition-root.js";
import type { SubjectCorePort } from "../../ports/subject-core-port.js";
import { createMiclStageMinter } from "../../micl/micl-capabilities.js";
import { InMemoryMiclWorkflowStore } from "../../micl/micl-workflow-store.js";
import { CognitionActionTransitionExecutor } from "../cognition-action/cognition-action-transition-executor.js";
import type { CognitionProviderV0 } from "../../ports/cognition-port.js";
import { LearningTransitionExecutor } from "../learning/learning-transition-executor.js";
import type { LearningAdoptionAuthority } from "../learning/learning-adoption-authority.js";
import type { LearningSourceReadAuthority } from "../learning/learning-source-authority.js";
import { createConversationDeliveryLedgerAuthorityV0 } from "../conversation/behavior-delivery-ledger.js";
import { createConversationIngressLedgerAuthorityV0 } from "../conversation/conversation-ingress-ledger.js";

const SUBJECT_ID = "subject-s0";
const CONVERSATION_ID = "conv-main";
const ALICE = "entity:alice";
const BEHAVIOR_TEXT = "这是给你的说明。";
const E1_TEXT = "以后项目进度说明保持这个格式。";
const E3_TEXT = "另一种情况下请直接列出要点。";

interface TestCore extends SubjectCorePort {
  readonly issuer: ProducerAuthorizationIssuer;
  readonly storeRead: {
    readCurrentBundle(subjectId: string): AtomicCommitBundleAnyVersion | null;
    readCommittedByTransitionId(id: string): AtomicCommitBundleAnyVersion | null;
    getCommittedBundles(): readonly AtomicCommitBundleAnyVersion[];
  };
}

function createIntegrationCore(
  snapshot: SubjectStateV0,
  rawMemory: InMemoryMemoryRepository,
  seedBundles: readonly AtomicCommitBundleAnyVersion[] = []
): TestCore {
  const assembly: InMemoryFacadeAssembly = createInMemorySubjectCoreFacade({
    seedSnapshots: new Map([[SUBJECT_ID as never, snapshot]]),
    seedBundles: seedBundles as never,
    preparedResultValidator: async (binding) => binding.prepared_result_ref.startsWith("workflow:"),
    referenceValidator: async (binding) =>
      rawMemory.validateRevisionBinding(
        binding as unknown as Parameters<MemoryPreparationAuthority["validateRevisionBinding"]>[0]
      ),
    memoryAdoptionValidator: async (adoption) => {
      if (adoption.next_repository_revision_hash === null) return false;
      return rawMemory.validateRevisionBinding({
        repository_revision: adoption.next_repository_revision,
        repository_revision_hash: adoption.next_repository_revision_hash
      } as unknown as Parameters<MemoryPreparationAuthority["validateRevisionBinding"]>[0]);
    }
  });
  const port: SubjectCorePort = {
    reserveAndRoute: (proposal) => assembly.facade.reserveAndRoute(proposal),
    commitReserved: (input) => assembly.facade.commitReserved(input),
    terminalizeReservedNoOp: (input) => assembly.facade.terminalizeReservedNoOp(input),
    reconcile: (t, s, f) => assembly.facade.reconcile(t, s, f),
    readCurrentSnapshot: async (id) => {
      const bundle = assembly.storeRead.readCurrentBundle(id);
      return bundle !== null ? bundle.next_snapshot : snapshot;
    }
  };
  return { ...port, issuer: assembly.producerAuthorizationIssuer, storeRead: assembly.storeRead };
}

async function makeBehavior(): Promise<CharacterLanguageBehaviorV0> {
  const built = await buildCharacterLanguageBehaviorV0({
    subject_id: SUBJECT_ID as never,
    source_revision: 0 as never,
    response_request_id: "resp-1" as never,
    draft: {
      schema_version: "language-realization-draft-v0",
      text: BEHAVIOR_TEXT,
      input_hash: `sha256:${"a".repeat(64)}`,
      evidence_refs: []
    } as never
  });
  if (!built.ok) throw new Error(`fixture invariant: behavior must build (${built.detail})`);
  return built.behavior;
}

interface ChainWorld {
  repo: InMemoryMemoryRepository;
  core: TestCore;
  feedbackExecutor: LearningTransitionExecutor;
  observationExecutor: ObservationTransitionExecutor;
  observationRootDeps: ReturnType<RuntimeCompositionRoot["dependencies"]>;
  futureObservationRootDeps: ReturnType<RuntimeCompositionRoot["dependencies"]>;
  container: ReturnType<RuntimeCompositionRoot["dependencies"]>;
}

function buildWorld(): ChainWorld {
  const repo = new InMemoryMemoryRepository();
  void repo.prepareRevision({ parent_revision: null, records: [] });
  const core = createIntegrationCore(s0() as unknown as SubjectStateV0, repo);
  const observationRoot = new RuntimeCompositionRoot({
    subjectCore: core,
    producerAuthorizationIssuer: core.issuer,
    memoryRepository: repo,
    retrieval: permissiveEmptyRetrieval(),
    interpretation: fixedInterpretation(),
    appraisal: fixedAppraisal(0.9, undefined, "situation"),
    affectProducer: fixedAffectProducer(),
    contextProducer: new ReferenceContextProducer()
  });
  const feedbackRoot = new RuntimeCompositionRoot({
    subjectCore: core,
    producerAuthorizationIssuer: core.issuer,
    memoryRepository: repo,
    retrieval: permissiveEmptyRetrieval(),
    learningSourceAuthority: {
      readCommittedBundle: async (id) => core.storeRead.readCommittedByTransitionId(id)
    } as LearningSourceReadAuthority,
    learningAdoptionAuthority: {
      markAdopted: (r) => repo.markAdopted(r),
      isAdopted: (r) => repo.isAdopted(r)
    } as LearningAdoptionAuthority,
    experiencePayloadRepository: repo
  });
  // Future observations run through the REAL repository-backed retrieval with
  // the retrieval-metadata producer (working_refs/recent_retrieval_trace law).
  const futureObservationRoot = new RuntimeCompositionRoot({
    subjectCore: core,
    producerAuthorizationIssuer: core.issuer,
    memoryRepository: repo,
    retrieval: new RepositoryBackedMemoryRetrievalServiceV0(repo),
    retrievalMetadataProducer: new ReferenceRetrievalMetadataProducer(),
    interpretation: fixedInterpretation(),
    appraisal: fixedAppraisal(0.9, undefined, "situation"),
    affectProducer: fixedAffectProducer(),
    contextProducer: new ReferenceContextProducer()
  });
  return {
    repo,
    core,
    feedbackExecutor: new LearningTransitionExecutor(feedbackRoot.dependencies()),
    observationExecutor: new ObservationTransitionExecutor(observationRoot.dependencies()),
    observationRootDeps: observationRoot.dependencies(),
    futureObservationRootDeps: futureObservationRoot.dependencies(),
    container: feedbackRoot.dependencies()
  };
}

function permissiveEmptyRetrieval(): {
  retrieve: (query: MemoryRetrievalQueryV0) => Promise<MemoryRetrievalResultV0>;
} {
  return {
    retrieve: async (query) => ({
      schema_version: "memory-retrieval-result-v0",
      subject_id: query.subject_id,
      selected_memory_refs: [],
      evidence: [],
      retrieval_trace_ref: null,
      deterministic_metadata: {
        repository_revision: query.repository_revision,
        candidate_count: 0,
        computed_under_config: "MEMORY_RETRIEVAL_V0",
        query_fingerprint: await retrievalQueryFingerprint(query)
      }
    })
  };
}

/** Commits one lawful Observation through the minter pattern. */
async function commitObservation(
  world: ChainWorld,
  observationId: string
): Promise<AtomicCommitBundleAnyVersion> {
  const snapshot = (await world.core.readCurrentSnapshot(SUBJECT_ID as never)) as SubjectStateV0;
  const ctx = {
    subject_id: SUBJECT_ID as never,
    current_logical_time: snapshot.runtime_metadata.logical_time as never,
    state_revision: snapshot.runtime_metadata.state_revision as never
  };
  const observation = observationInput({
    observation_id: observationId,
    entity_refs: [ALICE, "subject:s0"],
    source_refs: ["source:s-3"]
  });
  const affectDelta = await fixedAffectProducer().produceAffectDelta({
    context: ctx,
    snapshot,
    transition_type: "Observation",
    appraisal: null,
    elapsed_ticks: null
  });
  const contextDelta = await buildContextDelta(observation, snapshot);
  const proposal = await buildObservationProposal({
    subjectId: SUBJECT_ID,
    stateRevision: snapshot.runtime_metadata.state_revision as number,
    observation,
    deltas: [affectDelta, contextDelta]
  });
  const minter = createMiclStageMinter(world.core, new InMemoryMiclWorkflowStore(), {
    micl_id: `micl-${observationId}` as never,
    micl_request_fingerprint: `sha256:${proposal.transition_id.replace(/[^0-9a-f]/g, "").padEnd(64, "0").slice(0, 64)}` as never,
    stage_key: "OBSERVATION"
  });
  const mintedExecutor = new ObservationTransitionExecutor({
    ...world.observationRootDeps,
    subjectCore: minter.core()
  });
  const outcome = await mintedExecutor.execute(ctx, observation, minter.capabilities(await currentMemoryBindings(world.repo, snapshot)));
  if (outcome.kind !== "COMMITTED") {
    throw new Error(`fixture invariant: ${observationId} must commit, got ${JSON.stringify(outcome).slice(0, 250)}`);
  }
  return outcome.bundle;
}

async function currentMemoryBindings(
  repo: InMemoryMemoryRepository,
  snapshot: SubjectStateV0
): Promise<readonly { repository_revision: string; repository_revision_hash: string }[]> {
  const revision = snapshot.memory_state.repository_revision as string;
  const manifest = await repo.readManifest(revision as never);
  if (manifest === null) throw new Error("fixture invariant: manifest must exist");
  return [
    { repository_revision: revision as never, repository_revision_hash: await computeRepositoryRevisionHash(manifest) }
  ] as never;
}

async function recordDelivery(world: ChainWorld): Promise<string> {
  const behavior = await makeBehavior();
  const ledger = world.container.conversationDeliveryLedger;
  if (ledger === null) throw new Error("fixture invariant: delivery ledger wired");
  const recorded = await ledger.recordConversationDelivery({
    subject_id: SUBJECT_ID,
    conversation_id: CONVERSATION_ID,
    behavior,
    delivered_logical_time: 0,
    status: "DELIVERED",
    host_adapter: "test-adapter"
  });
  if (!recorded.ok) throw new Error(`fixture invariant: delivery must record (${recorded.detail})`);
  return recorded.record.delivery_id;
}

async function runFeedback(
  world: ChainWorld,
  sourceEventId: string,
  replyText: string,
  observationId: string
): Promise<{ experienceRef: string; episodeRef: string; eventRef: string; memoryRevision: string; payloadHashes: Record<string, string> }> {
  const o2 = await commitObservation(world, observationId);
  const deliveryId = await recordDelivery(world);
  const ingressLedger = world.container.conversationIngressLedger;
  if (ingressLedger === null) throw new Error("fixture invariant: ingress ledger wired");
  const ingressOutcome = await ingressLedger.recordIngressEvent({
    schema_version: "conversation-ingress-input-v0",
    subject_id: SUBJECT_ID,
    conversation_id: CONVERSATION_ID,
    actor_ref: ALICE,
    text: replyText,
    logical_time: 0,
    source_event_id: sourceEventId,
    in_reply_to_delivery_id: deliveryId,
    host_adapter: "test-adapter"
  });
  if (ingressOutcome.kind !== "RECORDED") throw new Error("fixture invariant: ingress must record");
  const snapshot = (await world.core.readCurrentSnapshot(SUBJECT_ID as never)) as SubjectStateV0;
  const outcome = await world.feedbackExecutor.executeBehaviorOutcomeFeedback(
    {
      subject_id: SUBJECT_ID as never,
      current_logical_time: snapshot.runtime_metadata.logical_time as never,
      state_revision: snapshot.runtime_metadata.state_revision as never
    },
    {
      candidate: {
        subject_id: SUBJECT_ID,
        conversation_id: CONVERSATION_ID,
        source_event_id: sourceEventId,
        observation_transition_id: o2.transition_id,
        observation_ref: o2.trace_entry.cause_refs[0],
        declared_salience: 0.5,
        host_adapter: "test-adapter"
      }
    } as never
  );
  if (outcome.kind !== "COMMITTED") {
    throw new Error(`fixture invariant: feedback must commit, got ${JSON.stringify(outcome).slice(0, 250)}`);
  }
  const payloadHashes: Record<string, string> = {};
  for (const ref of [outcome.refs.episode_ref, outcome.refs.experience_ref, outcome.refs.event_ref]) {
    const hash = await world.repo.payloadHashOf(ref as never);
    if (hash === null) throw new Error("fixture invariant: payload hash must exist");
    payloadHashes[ref] = hash;
  }
  return {
    experienceRef: outcome.refs.experience_ref,
    episodeRef: outcome.refs.episode_ref,
    eventRef: outcome.refs.event_ref,
    memoryRevision: outcome.bundle.next_snapshot.memory_state.repository_revision as string,
    payloadHashes
  };
}

async function runOrdinaryLearning(
  world: ChainWorld,
  sourceBundle: AtomicCommitBundleAnyVersion,
  scene: string
): Promise<{ episodeRef: string; memoryRevision: string }> {
  const snapshot = (await world.core.readCurrentSnapshot(SUBJECT_ID as never)) as SubjectStateV0;
  const outcome = await world.feedbackExecutor.execute(
    {
      subject_id: SUBJECT_ID as never,
      current_logical_time: snapshot.runtime_metadata.logical_time as never,
      state_revision: snapshot.runtime_metadata.state_revision as never
    },
    {
      candidate: {
        subject_id: SUBJECT_ID,
        source_transition_id: sourceBundle.transition_id,
        observation_ref: sourceBundle.trace_entry.cause_refs[0],
        entity_refs: [ALICE, "subject:s0"],
        event_refs: [],
        occurrence_logical_time: sourceBundle.logical_time_after,
        appraisal_ref: null,
        scene: sourceBundle.next_snapshot.context.scene,
        focus_refs: [...sourceBundle.next_snapshot.context.focus_refs],
        environment_refs: [...sourceBundle.next_snapshot.context.environment_refs],
        declared_salience: 0.4
      }
    } as never
  );
  if (outcome.kind !== "COMMITTED") {
    throw new Error(`fixture invariant: ordinary Learning must commit, got ${JSON.stringify(outcome).slice(0, 250)}`);
  }
  const manifest = await world.repo.readManifest(
    outcome.bundle.next_snapshot.memory_state.repository_revision as never
  );
  if (manifest === null) throw new Error("fixture invariant: manifest must exist");
  const episodeRef = manifest.record_hashes.find((r) => r.ref.startsWith("episode:"))?.ref as string;
  void scene;
  return {
    episodeRef,
    memoryRevision: outcome.bundle.next_snapshot.memory_state.repository_revision as string
  };
}

describe("MEMORY_REVISION_LONG_TERM_VISIBILITY_V0 — R1→R4 multi-revision proof", () => {
  it("21-27. real chain keeps V1/E1/P1 lawfully visible at R4 through ancestry", async () => {
    const world = buildWorld();

    // ---- R1: real feedback (V1/E1/P1) -------------------------------------------
    const r1 = await runFeedback(world, "evt-r1", E1_TEXT, "observation:o-r1");

    // ---- R2: real ordinary Learning (P2) -----------------------------------------
    // The O2 observation for R1 feedback is the store's FIRST committed bundle
    // (the only commit preceding the first feedback commit).
    const o2Bundle = world.core.storeRead.getCommittedBundles()[0];
    if (o2Bundle === undefined) throw new Error("fixture invariant: R1 source bundle must exist");
    const r2 = await runOrdinaryLearning(world, o2Bundle, "r2-scene");

    // ---- R3: real feedback again (V3/E3/P3, different conversation event) --------
    const r3 = await runFeedback(world, "evt-r3", E3_TEXT, "observation:o-r3");

    // ---- R4: real ordinary Learning (P4) ------------------------------------------
    // The O2 observation for R3 feedback: the observation committed immediately
    // before the R3 feedback (second Observation in the chain).
    const observations = world.core.storeRead.getCommittedBundles().filter((b) => b.transition_type === "Observation");
    const o3Bundle = observations[1];
    if (o3Bundle === undefined) throw new Error("fixture invariant: R3 source bundle must exist");
    const r4 = await runOrdinaryLearning(world, o3Bundle, "r4-scene");

    const r4Revision = r4.memoryRevision as never;

    // ---- 1/22. direct manifests remain deltas --------------------------------------
    const r4Manifest = await world.repo.readManifest(r4Revision);
    if (r4Manifest === null) throw new Error("fixture invariant: R4 manifest must exist");
    const r4Direct = r4Manifest.record_hashes.map((r) => r.ref);
    expect(r4Direct).toEqual([r4.episodeRef]);
    expect(r4Direct).not.toContain(r1.episodeRef);
    expect(r4Direct).not.toContain(r1.experienceRef);

    // ---- 2/3. V(R4) contains every ancestor record ----------------------------------
    const visible = await world.repo.readVisibleRecordHashes(r4Revision);
    const visibleRefs = visible.map((r) => r.ref);
    expect(visibleRefs).toContain(r1.episodeRef);
    expect(visibleRefs).toContain(r1.experienceRef);
    expect(visibleRefs).toContain(r1.eventRef);
    expect(visibleRefs).toContain(r2.episodeRef);
    expect(visibleRefs).toContain(r3.episodeRef);
    expect(visibleRefs).toContain(r3.experienceRef);
    expect(visibleRefs).toContain(r3.eventRef);
    expect(visibleRefs).toContain(r4.episodeRef);

    // ---- 23. E1/P1 refs and payload hashes unchanged at R4 ---------------------------
    expect(await world.repo.payloadHashOf(r1.experienceRef as never)).toBe(r1.payloadHashes[r1.experienceRef]);
    expect(await world.repo.payloadHashOf(r1.episodeRef as never)).toBe(r1.payloadHashes[r1.episodeRef]);
    expect(await world.repo.payloadHashOf(r1.eventRef as never)).toBe(r1.payloadHashes[r1.eventRef]);

    // ---- 24 (production path): the future Observation commits through the REAL
    // repository-backed retrieval; its metadata producer records the naturally
    // selected episode refs into working_refs/recent_retrieval_trace. NO manual
    // P1/E1/V1/text injection anywhere.
    const futureMinter = createMiclStageMinter(world.core, new InMemoryMiclWorkflowStore(), {
      micl_id: "micl-r4-future" as never,
      micl_request_fingerprint: `sha256:${"5".repeat(64)}` as never,
      stage_key: "OBSERVATION"
    });
    const mintedFutureExecutor = new ObservationTransitionExecutor({
      ...world.futureObservationRootDeps,
      subjectCore: futureMinter.core()
    });
    const preFutureSnapshot = (await world.core.readCurrentSnapshot(SUBJECT_ID as never)) as SubjectStateV0;
    const futureObservation = observationInput({
      observation_id: "observation:o-future",
      occurrence_logical_time: preFutureSnapshot.runtime_metadata.logical_time as never,
      entity_refs: [ALICE, "subject:s0"],
      source_refs: ["source:s-3"]
    });
    const futureOutcome = await mintedFutureExecutor.execute(
      {
        subject_id: SUBJECT_ID as never,
        current_logical_time: preFutureSnapshot.runtime_metadata.logical_time as never,
        state_revision: preFutureSnapshot.runtime_metadata.state_revision as never
      },
      futureObservation,
      futureMinter.capabilities(await currentMemoryBindings(world.repo, preFutureSnapshot))
    );
    if (futureOutcome.kind !== "COMMITTED") {
      throw new Error(`future observation must commit, got ${JSON.stringify(futureOutcome).slice(0, 250)}`);
    }
    const postFutureSnapshot = futureOutcome.bundle.next_snapshot;

    // ---- 24. natural repository-backed retrieval at R4 selects P1 --------------------
    // The fresh observation goes through the production query builder only; P1 is
    // selected solely because ancestry makes it a verified candidate.
    const retrieval = new RepositoryBackedMemoryRetrievalServiceV0(world.repo);
    const snapshot = (await world.core.readCurrentSnapshot(SUBJECT_ID as never)) as SubjectStateV0;
    void snapshot;
    const query = {
      schema_version: "memory-retrieval-query-v0",
      subject_id: SUBJECT_ID,
      repository_revision: postFutureSnapshot.memory_state.repository_revision,
      semantic_reference: "observation:o-future" as never,
      temporal: { now_logical_time: postFutureSnapshot.runtime_metadata.logical_time, window_start: null },
      entity_refs: [ALICE, "subject:s0"],
      relationship_refs: [],
      current_context_refs: [ALICE],
      salience_constraints: { min_declared_score: null, max_candidates: 16 }
    } as never;
    const retrievalResult = await retrieval.retrieve(query);
    expect(retrievalResult.selected_memory_refs).toContain(r1.episodeRef);
    expect(await world.repo.validateRefsBelong(postFutureSnapshot.memory_state.repository_revision, [r1.episodeRef as never])).toBe(true);

    // ---- 25. ExperienceReader resolves the R1 lineage at R4 ---------------------------
    const reader = createEpisodeContentReaderV0(world.repo);
    const content = await reader.read({
      repository_revision: postFutureSnapshot.memory_state.repository_revision,
      refs: [r1.episodeRef as never]
    });
    expect(content.ok).toBe(true);
    void r2;
    void r3;


    // ---- 26. cognition receives the exact E1 factual text ------------------------------
    const captured: Record<string, unknown>[] = [];
    const captureProvider: CognitionProviderV0 = {
      propose: async (projection) => {
        captured.push(JSON.parse(JSON.stringify(projection)) as Record<string, unknown>);
        return {
          schema_version: "cognition-proposal-v0",
          projection_hash: projection.projection_hash,
          reasoning_summary: "capture",
          relevant_memory_refs: [r1.episodeRef],
          considered_context_refs: [],
          current_intent: null,
          confidence: 0.5,
          uncertainty: 0.5,
          action_intent: null,
          evidence_refs: [r1.episodeRef]
        } as never;
      }
    };
    const cognitionRoot = new RuntimeCompositionRoot({
      subjectCore: world.core,
      producerAuthorizationIssuer: world.core.issuer,
      memoryRepository: world.repo,
      retrieval: permissiveEmptyRetrieval(),
      experiencePayloadRepository: world.repo,
      episodeContentReader: createEpisodeContentReaderV0(world.repo),
      ...(world.container.conversationDeliveryLedger !== null ? { deliveryLedger: world.container.conversationDeliveryLedger } : {}),
      ...(world.container.conversationIngressLedger !== null ? { ingressLedger: world.container.conversationIngressLedger } : {}),
      cognitionProvider: captureProvider
    });
    const cogMinter = createMiclStageMinter(world.core, new InMemoryMiclWorkflowStore(), {
      micl_id: "micl-r4-cognition" as never,
      micl_request_fingerprint: `sha256:${"6".repeat(64)}` as never,
      stage_key: "OBSERVATION"
    });
    const cognitionExecutor = new CognitionActionTransitionExecutor({
      ...cognitionRoot.dependencies(),
      subjectCore: cogMinter.core()
    });
    const cognitionOutcome = await cognitionExecutor.execute(
      {
        subject_id: SUBJECT_ID as never,
        current_logical_time: postFutureSnapshot.runtime_metadata.logical_time as never,
        state_revision: postFutureSnapshot.runtime_metadata.state_revision as never
      },
      { cause_refs: [], allowed_actions: [] },
      cogMinter.capabilities(await currentMemoryBindings(world.repo, postFutureSnapshot))
    );
    if (cognitionOutcome.outcome.kind !== "COMMITTED" && cognitionOutcome.outcome.kind !== "NO_OP") {
      throw new Error(`cognition must succeed, got ${JSON.stringify(cognitionOutcome.outcome).slice(0, 200)}`);
    }
    expect(captured).toHaveLength(1);
    const projectionJson = JSON.stringify(captured[0]);
    expect(captured[0]?.["schema_version"]).toBe("cognitive-context-projection-v1");
    // Both lawful lived outcomes of THIS life are visible through ancestry and
    // arrive as separate factual evidence entries with their exact texts.
    const evidenceBundle = captured[0]?.["factual_memory_evidence"] as { entries: { kind: string; exact_outcome_text: string; experience_ref: string }[] };
    const e1Entry = evidenceBundle.entries.find((e) => e.experience_ref === r1.experienceRef);
    const e3Entry = evidenceBundle.entries.find((e) => e.experience_ref === r3.experienceRef);
    if (e1Entry === undefined || e3Entry === undefined) throw new Error("expected both Experience evidence entries");
    expect(e1Entry.exact_outcome_text).toBe(E1_TEXT);
    expect(e3Entry.exact_outcome_text).toBe(E3_TEXT);
    expect(projectionJson).toContain(E1_TEXT);
    expect(projectionJson).toContain(E3_TEXT);
    // 27. no manual historical injection anywhere in the inputs above.

    // ---- 35. fresh-restore proof: manifests+payloads replay, cognition still works ----
    const freshRepo = new InMemoryMemoryRepository();
    await freshRepo.prepareRevision({ parent_revision: null, records: [] });
    // Replay every revision (payload + direct delta) in parent-topological order.
    const allRevisions = world.repo.revisionIds();
    for (const revision of allRevisions) {
      const manifest = await world.repo.readManifest(revision);
      if (manifest === null) continue;
      const entries = [];
      for (const entry of manifest.record_hashes) {
        const payload = world.repo.readStoredPayload(entry.ref as never);
        if (payload === undefined) throw new Error("fixture invariant: payload must exist");
        const hash = await freshRepo.storePayload(entry.ref as never, payload);
        if (hash !== entry.payload_hash) throw new Error("fixture invariant: replayed hash must match");
        entries.push({ ref: entry.ref, payload_hash: hash });
      }
      if (revision === "R0") continue; // genesis already prepared
      await freshRepo.prepareRevision({
        parent_revision: manifest.parent_revision,
        records: entries as never
      });
    }
    // Restore the composition-owned ledgers through their validating faces.
    const liveDeliveryLedger = world.container.conversationDeliveryLedger;
    const liveIngressLedger = world.container.conversationIngressLedger;
    if (liveDeliveryLedger === null || liveIngressLedger === null) throw new Error("fixture invariant: ledgers wired");
    const persistedDeliveries = liveDeliveryLedger.exportState();
    const persistedIngress = liveIngressLedger.exportState();
    const freshDeliveryLedger = createConversationDeliveryLedgerAuthorityV0();
    const freshIngressLedger = createConversationIngressLedgerAuthorityV0();
    expect((await freshDeliveryLedger.restoreState(persistedDeliveries)).ok).toBe(true);
    expect((await freshIngressLedger.restoreState(persistedIngress)).ok).toBe(true);

    // Restore revisions 1:1.
    const freshVisible = await freshRepo.readVisibleRecordHashes(r4Revision);
    expect(freshVisible.map((r) => r.ref)).toEqual(visibleRefs);
    // Authoritative commit head: persist + restore through existing authority.
    const headBundle = world.core.storeRead.getCommittedBundles().at(-1);
    if (headBundle === undefined) throw new Error("fixture invariant: head bundle must exist");
    const envelopeResult = await createPersistenceEnvelope({
      snapshot: headBundle.next_snapshot,
      repository_bindings: headBundle.repository_revision_bindings.filter(
        (b) => b.repository_revision === headBundle.next_snapshot.memory_state.repository_revision
      ),
      commit_head: {
        commit_ref: headBundle.commit_ref,
        record_checksum: headBundle.record_checksum as never
      }
    });
    if (!envelopeResult.ok) throw new Error(`envelope must build: ${envelopeResult.error.detail}`);
    const freshCore = createIntegrationCore(
      s0() as unknown as SubjectStateV0,
      freshRepo,
      [headBundle]
    );
    const restore = await restoreFromEnvelope(envelopeResult.value, {
      referenceValidator: async (binding) =>
        freshRepo.validateRevisionBinding(
          binding as unknown as Parameters<MemoryPreparationAuthority["validateRevisionBinding"]>[0]
        ),
      commitChainVerifier: async (expected) =>
        headBundle.commit_ref === expected.commit_ref &&
        headBundle.record_checksum === expected.record_checksum &&
        headBundle.snapshot_hash_after === expected.snapshot_hash
    });
    if (!restore.ok) throw new Error(`restore must succeed: ${restore.failure.detail}`);
    expect(restore.snapshot.memory_state.repository_revision).toBe(headBundle.next_snapshot.memory_state.repository_revision);

    // Future observation + retrieval + reader + cognition on the fresh runtime.
    const freshRepositoryRetrieval = new RepositoryBackedMemoryRetrievalServiceV0(freshRepo);
    const freshObservationRoot = new RuntimeCompositionRoot({
      subjectCore: freshCore,
      producerAuthorizationIssuer: freshCore.issuer,
      memoryRepository: freshRepo,
      retrieval: freshRepositoryRetrieval,
      retrievalMetadataProducer: new ReferenceRetrievalMetadataProducer(),
      interpretation: fixedInterpretation(),
      appraisal: fixedAppraisal(0.9, undefined, "situation"),
      affectProducer: fixedAffectProducer(),
      contextProducer: new ReferenceContextProducer()
    });
      const restoredPre = (await freshCore.readCurrentSnapshot(SUBJECT_ID as never)) as SubjectStateV0;
    const restoredFutureObservation = observationInput({
      observation_id: "observation:o-future",
      occurrence_logical_time: restoredPre.runtime_metadata.logical_time as never,
      entity_refs: [ALICE, "subject:s0"],
      source_refs: ["source:s-3"]
    });
    const restoredFutureMinter = createMiclStageMinter(freshCore, new InMemoryMiclWorkflowStore(), {
      micl_id: "micl-r4-future" as never,
      micl_request_fingerprint: `sha256:${"5".repeat(64)}` as never,
      stage_key: "OBSERVATION"
    });
    const restoredFutureExecutor = new ObservationTransitionExecutor({
      ...freshObservationRoot.dependencies(),
      subjectCore: restoredFutureMinter.core()
    });
    const restoredFutureOutcome = await restoredFutureExecutor.execute(
      {
        subject_id: SUBJECT_ID as never,
        current_logical_time: restoredPre.runtime_metadata.logical_time as never,
        state_revision: restoredPre.runtime_metadata.state_revision as never
      },
      restoredFutureObservation,
      futureMinter.capabilities(await currentMemoryBindings(freshRepo, restoredPre))
    );
    if (restoredFutureOutcome.kind !== "COMMITTED") {
      throw new Error(`future observation must commit, got ${JSON.stringify(futureOutcome).slice(0, 250)}`);
    }
    const postFuture = restoredFutureOutcome.bundle.next_snapshot;
    const freshSelected = [
      ...(postFuture.memory_state.working_refs as readonly string[]),
      ...(postFuture.memory_state.recent_retrieval_trace as readonly string[])
    ].filter((ref) => ref.startsWith("episode:"));
    expect(freshSelected).toContain(r1.episodeRef);

    const freshCognitionCaptured: Record<string, unknown>[] = [];
    const freshCaptureProvider: CognitionProviderV0 = {
      propose: async (projection) => {
        freshCognitionCaptured.push(JSON.parse(JSON.stringify(projection)) as Record<string, unknown>);
        return {
          schema_version: "cognition-proposal-v0",
          projection_hash: projection.projection_hash,
          reasoning_summary: "capture",
          relevant_memory_refs: [],
          considered_context_refs: [],
          current_intent: null,
          confidence: 0.5,
          uncertainty: 0.5,
          action_intent: null,
          evidence_refs: []
        } as never;
      }
    };
    const freshCognitionRoot = new RuntimeCompositionRoot({
      subjectCore: freshCore,
      producerAuthorizationIssuer: freshCore.issuer,
      memoryRepository: freshRepo,
      retrieval: freshRepositoryRetrieval,
      experiencePayloadRepository: freshRepo,
      episodeContentReader: createEpisodeContentReaderV0(freshRepo),
      deliveryLedger: freshDeliveryLedger,
      ingressLedger: freshIngressLedger,
      cognitionProvider: freshCaptureProvider
    });
    const freshCogMinter = createMiclStageMinter(freshCore, new InMemoryMiclWorkflowStore(), {
      micl_id: "micl-r4-fresh-cognition" as never,
      micl_request_fingerprint: `sha256:${"4".repeat(64)}` as never,
      stage_key: "OBSERVATION"
    });
    const freshCognitionExecutor = new CognitionActionTransitionExecutor({
      ...freshCognitionRoot.dependencies(),
      subjectCore: freshCogMinter.core()
    });
    const freshCognitionOutcome = await freshCognitionExecutor.execute(
      {
        subject_id: SUBJECT_ID as never,
        current_logical_time: postFuture.runtime_metadata.logical_time as never,
        state_revision: postFuture.runtime_metadata.state_revision as never
      },
      { cause_refs: [], allowed_actions: [] },
      freshCogMinter.capabilities(await currentMemoryBindings(freshRepo, postFuture))
    );
    if (freshCognitionOutcome.outcome.kind !== "COMMITTED" && freshCognitionOutcome.outcome.kind !== "NO_OP") {
      throw new Error(`fresh cognition must succeed, got ${JSON.stringify(freshCognitionOutcome.outcome).slice(0, 200)}`);
    }
    const freshJson = JSON.stringify(freshCognitionCaptured[0]);
    expect(freshCognitionCaptured[0]?.["schema_version"]).toBe("cognitive-context-projection-v1");
    expect(freshJson).toContain(E1_TEXT);
    expect(freshJson).toContain(E3_TEXT);
  });
});
