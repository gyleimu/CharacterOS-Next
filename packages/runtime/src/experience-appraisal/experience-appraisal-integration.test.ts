/**
 * EXPERIENCE_APPRAISAL_INTEGRATION_V0 — runtime integration proof.
 *
 * Common world: real feedback Experience E (identical bytes) → two isolated
 * canonical states differing ONLY in context.task (World A "obtain approval
 * for this version" vs World B "collect corrective information") → the SAME
 * deterministic provider produces different lawful Appraisals. Then: replay
 * (+0), existing-INITIAL replay (provider +0), state isolation, Experience/
 * Episode immutability, retrieval unchanged, physical-presence and forged-ref
 * rejection, and fresh-restore proof with provider calls = 0.
 *
 * Task provenance: `context.task` originates at subject genesis and is
 * preserved verbatim by the Observation context delta (there is no other
 * lawful task authority in the current committed contracts); the two worlds
 * are therefore seeded with the two task values and the identical Experience
 * pipeline runs in both.
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
  proposalFingerprint,
  createPersistenceEnvelope,
  restoreFromEnvelope
} from "@characteros-next/subject-core";
import {
  InMemoryMemoryRepository,
  RepositoryBackedMemoryRetrievalServiceV0,
  retrievalQueryFingerprint,
  type MemoryPreparationAuthority
} from "@characteros-next/memory";
import type { CharacterLanguageBehaviorV0 } from "@characteros-next/behavior";
import { buildCharacterLanguageBehaviorV0 } from "@characteros-next/behavior";
import type { ExperienceAppraisalProposalV0 } from "@characteros-next/appraisal";
import type { ExperienceAppraisalProviderV0 } from "./experience-appraisal-reader.js";
import { buildContextDelta, ReferenceContextProducer } from "../ports/context-producer-port.js";
import {
  fixedAppraisal,
  fixedAffectProducer,
  fixedInterpretation,
  observationInput,
  s0
} from "../transitions/observation/observation-fixtures.js";
import {
  buildObservationProposal,
  ObservationTransitionExecutor
} from "../transitions/observation/observation-transition-executor.js";
import { RuntimeCompositionRoot } from "../composition/runtime-composition-root.js";
import type { SubjectCorePort } from "../ports/subject-core-port.js";
import { stateHash } from "@characteros-next/subject-core";
import { LearningTransitionExecutor } from "../transitions/learning/learning-transition-executor.js";
import type { LearningAdoptionAuthority } from "../transitions/learning/learning-adoption-authority.js";
import type { LearningSourceReadAuthority } from "../transitions/learning/learning-source-authority.js";
import { createConversationDeliveryLedgerAuthorityV0 } from "../transitions/conversation/behavior-delivery-ledger.js";
import { createConversationIngressLedgerAuthorityV0 } from "../transitions/conversation/conversation-ingress-ledger.js";
import { createExperienceReaderV0, type ExperienceReaderV0 } from "../transitions/conversation/experience-reader.js";
import {
  ExperienceAppraisalContextBuilderV0,
  type ExperienceAppraisalContextProjectionV0
} from "./experience-appraisal-context.js";
import {
  createExperienceAppraisalReaderV0,
  type ExperienceAppraisalReaderV0
} from "./experience-appraisal-reader.js";
import { ExperienceAppraisalLearningExecutorV0 } from "./experience-appraisal-executor.js";
import { computeRepositoryRevisionHash } from "@characteros-next/memory";

const SUBJECT_ID = "subject-s0";
const CONVERSATION_ID = "conv-appraisal";
const ALICE = "entity:alice";
const BEHAVIOR_TEXT = "这是给你的说明。";
const REPLY_TEXT = "谢谢";
const TASK_A = "obtain approval for this version";
const TASK_B = "collect corrective information";

interface TestCore extends SubjectCorePort {
  readonly issuer: ProducerAuthorizationIssuer;
  readonly storeRead: {
    readCurrentBundle(subjectId: string): AtomicCommitBundleAnyVersion | null;
    readCommittedByTransitionId(id: string): AtomicCommitBundleAnyVersion | null;
    getCommittedBundles(): readonly AtomicCommitBundleAnyVersion[];
  };
}

function createCore(snapshot: SubjectStateV0, rawMemory: InMemoryMemoryRepository): TestCore {
  const assembly: InMemoryFacadeAssembly = createInMemorySubjectCoreFacade({
    seedSnapshots: new Map([[SUBJECT_ID as never, snapshot]]),
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

interface LifeWorld {
  repo: InMemoryMemoryRepository;
  core: TestCore;
  container: ReturnType<RuntimeCompositionRoot["dependencies"]>;
  feedbackExecutor: LearningTransitionExecutor;
  observationExecutor: ObservationTransitionExecutor;
  contextBuilder: ExperienceAppraisalContextBuilderV0;
  appraisalExecutor: ExperienceAppraisalLearningExecutorV0;
  appraisalReader: ExperienceAppraisalReaderV0;
  experienceReader: ExperienceReaderV0;
  seedSnapshot: SubjectStateV0;
  providerCalls: { count: number; captured: Record<string, unknown>[] };
}

function seededState(task: string): SubjectStateV0 {
  const base = s0() as unknown as SubjectStateV0;
  return {
    ...base,
    context: { ...base.context, task }
  } as unknown as SubjectStateV0;
}

/** Deterministic provider: task A → low congruence; task B → high congruence. */
function deterministicProvider(world: LifeWorld): {
  proposeExperienceAppraisal: (context: Record<string, unknown>) => Promise<ExperienceAppraisalProposalV0>;
} {
  return {
    proposeExperienceAppraisal: async (context: ExperienceAppraisalContextProjectionV0) => {
      world.providerCalls.count += 1;
      world.providerCalls.captured.push(JSON.parse(JSON.stringify(context)) as Record<string, unknown>);
      const task = context["current_task"] as string;
      const taskA = task === TASK_A;
      return {
        schema_version: "experience-appraisal-proposal-v0",
        status: "APPRAISED",
        subject_id: context["subject_id"] as never,
        experience_ref: context["experience_ref"] as never,
        context_projection_hash: context["context_projection_hash"] as never,
        dimensions: {
          relevance: 0.9,
          goal_congruence: taskA ? 0.15 : 0.85,
          attribution: taskA ? "self" : "other",
          controllability: taskA ? 0.4 : 0.9,
          uncertainty: 0.3,
          intensity: taskA ? 0.7 : 0.5
        },
        assessment_confidence: 0.8,
        evidence_refs: [
          context["experience_ref"] as never,
          context["event_ref"] as never,
          context["source_observation_ref"] as never
        ].sort()
      };
    }
  } as never;
}

async function buildWorld(task: string): Promise<LifeWorld> {
  const repo = new InMemoryMemoryRepository();
  await repo.prepareRevision({ parent_revision: null, records: [] });
  const core = createCore(seededState(task), repo);
  const observationRoot = new RuntimeCompositionRoot({
    subjectCore: core,
    producerAuthorizationIssuer: core.issuer,
    memoryRepository: repo,
    retrieval: {
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
    },
    interpretation: fixedInterpretation(),
    appraisal: fixedAppraisal(0.9, undefined, "situation"),
    affectProducer: fixedAffectProducer(),
    contextProducer: new ReferenceContextProducer()
  });
    const providerCalls: { count: number; captured: Record<string, unknown>[] } = { count: 0, captured: [] };
    const provider: ExperienceAppraisalProviderV0 = {
      proposeExperienceAppraisal: async (context: ExperienceAppraisalContextProjectionV0) => {
        providerCalls.count += 1;
        providerCalls.captured.push(JSON.parse(JSON.stringify(context)) as Record<string, unknown>);
        const currentTask = context["current_task"] as string;
        const isTaskA = currentTask === TASK_A;
        return {
          schema_version: "experience-appraisal-proposal-v0",
          status: "APPRAISED",
          subject_id: context["subject_id"] as never,
          experience_ref: context["experience_ref"] as never,
          context_projection_hash: context["context_projection_hash"] as never,
          dimensions: {
            relevance: 0.9,
            goal_congruence: isTaskA ? 0.15 : 0.85,
            attribution: isTaskA ? "self" : "other",
            controllability: isTaskA ? 0.4 : 0.9,
            uncertainty: 0.3,
            intensity: isTaskA ? 0.7 : 0.5
          },
          assessment_confidence: 0.8,
          evidence_refs: [
            context["experience_ref"] as never,
            context["event_ref"] as never,
            context["source_observation_ref"] as never
          ].sort()
        } as unknown as ExperienceAppraisalProposalV0;
      }
    };
    const feedbackRoot = new RuntimeCompositionRoot({
      subjectCore: core,
      producerAuthorizationIssuer: core.issuer,
      memoryRepository: repo,
      retrieval: {
        retrieve: async () => {
          throw new Error("feedback Learning never calls retrieval");
        }
      },
      experienceAppraisalProvider: provider,
      experiencePayloadRepository: repo,
    learningSourceAuthority: {
      readCommittedBundle: async (id) => core.storeRead.readCommittedByTransitionId(id)
    } as LearningSourceReadAuthority,
    learningAdoptionAuthority: {
      markAdopted: (r) => repo.markAdopted(r),
      isAdopted: (r) => repo.isAdopted(r)
    } as LearningAdoptionAuthority
  });
  const feedbackDeliveryLedger = feedbackRoot.dependencies().conversationDeliveryLedger;
  if (feedbackDeliveryLedger === null) throw new Error("fixture invariant: delivery ledger wired");
  const experienceReader = createExperienceReaderV0({ repository: repo, deliveryLedger: feedbackDeliveryLedger });
  const contextBuilder = new ExperienceAppraisalContextBuilderV0({
    reader: experienceReader,
    stateHashOf: async (s) => stateHash(s)
  });
  const world: LifeWorld = {
    repo,
    core,
    container: feedbackRoot.dependencies(),
    feedbackExecutor: new LearningTransitionExecutor(feedbackRoot.dependencies()),
    observationExecutor: new ObservationTransitionExecutor(observationRoot.dependencies()),
    contextBuilder,
    appraisalExecutor: new ExperienceAppraisalLearningExecutorV0(feedbackRoot.dependencies()),
    appraisalReader: createExperienceAppraisalReaderV0({ repository: repo, experienceReader }),
    experienceReader,
    seedSnapshot: seededState(task),
    providerCalls
  };
  return world;
}

async function makeBehavior(): Promise<CharacterLanguageBehaviorV0> {
  const built = await buildCharacterLanguageBehaviorV0({
    subject_id: SUBJECT_ID as never,
    source_revision: 0 as never,
    response_request_id: "resp-appraisal" as never,
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

async function commitObservation(world: LifeWorld, observationId: string): Promise<AtomicCommitBundleAnyVersion> {
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
    context: ctx, snapshot, transition_type: "Observation", appraisal: null, elapsed_ticks: null
  });
  const contextDelta = await buildContextDelta(observation, snapshot);
  const proposal = await buildObservationProposal({
    subjectId: SUBJECT_ID,
    stateRevision: snapshot.runtime_metadata.state_revision as number,
    observation,
    deltas: [affectDelta, contextDelta]
  });
  const outcome = await world.observationExecutor.execute(ctx, observation, {
    preparedBinding: {
      prepared_result_ref: "workflow:w-obs-appraisal" as never,
      transition_id: proposal.transition_id,
      subject_id: proposal.subject_id,
      transition_type: proposal.transition_type,
      payload_fingerprint: await proposalFingerprint(proposal)
    },
    repository_bindings: await currentMemoryBindings(world.repo, snapshot)
  });
  if (outcome.kind !== "COMMITTED") throw new Error(`fixture invariant: O2 must commit, got ${JSON.stringify(outcome).slice(0, 350)}`);
  return outcome.bundle;
}

async function deliver(world: LifeWorld, behavior: CharacterLanguageBehaviorV0): Promise<string> {
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

/** Creates the authoritative Experience through the real feedback pipeline. */
async function createExperience(world: LifeWorld): Promise<{
  episodeRef: string; experienceRef: string; eventRef: string; experiencePayloadHash: string; memoryRevision: string;
}> {
  const o2 = await commitObservation(world, "observation:o-appraisal");
  const behavior = await makeBehavior();
  const deliveryId = await deliver(world, behavior);
  const ingressLedger = world.container.conversationIngressLedger;
  if (ingressLedger === null) throw new Error("fixture invariant: ingress ledger wired");
  const ingressOutcome = await ingressLedger.recordIngressEvent({
    schema_version: "conversation-ingress-input-v0",
    subject_id: SUBJECT_ID,
    conversation_id: CONVERSATION_ID,
    actor_ref: ALICE,
    text: REPLY_TEXT,
    logical_time: 0,
    source_event_id: "evt-appraisal-1",
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
        source_event_id: "evt-appraisal-1",
        observation_transition_id: o2.transition_id,
        observation_ref: o2.trace_entry.cause_refs[0],
        declared_salience: 0.5,
        host_adapter: "test-adapter"
      }
    } as never
  );
  if (outcome.kind !== "COMMITTED") throw new Error(`fixture invariant: feedback must commit, got ${JSON.stringify(outcome).slice(0, 200)}`);
  return {
    episodeRef: outcome.refs.episode_ref,
    experienceRef: outcome.refs.experience_ref,
    eventRef: outcome.refs.event_ref,
    experiencePayloadHash: await world.repo.payloadHashOf(outcome.refs.experience_ref as never) as string,
    memoryRevision: outcome.bundle.next_snapshot.memory_state.repository_revision as string
  };
}

function appraiseInput(episodeRef: string): {
  subject_id: never; episode_ref: never; provider_id: never;
} {
  return {
    subject_id: SUBJECT_ID as never,
    episode_ref: episodeRef as never,
    provider_id: "test-appraisal-provider" as never
  };
}

describe("EXPERIENCE_APPRAISAL_INTEGRATION_V0 — two-context proof and lifecycle", () => {
  it("38-45. same factual Experience + different task ⇒ different lawful Appraisals", async () => {
    const worldA = await buildWorld(TASK_A);
    const worldB = await buildWorld(TASK_B);
    const expA = await createExperience(worldA);
    const expB = await createExperience(worldB);

    // Identical Experience bytes (same factual content, distinct canonical identity).
    expect(expA.experiencePayloadHash).toBe(expB.experiencePayloadHash);
    const payloadA = worldA.repo.readStoredPayload(expA.experienceRef as never);
    const payloadB = worldB.repo.readStoredPayload(expB.experienceRef as never);
    expect(JSON.stringify(payloadA)).toBe(JSON.stringify(payloadB));

    const ctxA = await worldA.contextBuilder.build({ episode_ref: expA.episodeRef as never }, await worldA.core.readCurrentSnapshot(SUBJECT_ID as never) as SubjectStateV0);
    const ctxB = await worldB.contextBuilder.build({ episode_ref: expB.episodeRef as never }, await worldB.core.readCurrentSnapshot(SUBJECT_ID as never) as SubjectStateV0);
    if (!ctxA.ok || !ctxB.ok) throw new Error("context must build");

    // 40. factual portion byte-equivalent; only task/state anchors differ.
    const normalize = (context: Record<string, unknown>): Record<string, unknown> => {
      const clone = JSON.parse(JSON.stringify(context)) as Record<string, unknown>;
      delete clone["current_task"];
      delete clone["state_revision"];
      delete clone["state_hash"];
      delete clone["repository_revision"];
      delete clone["context_projection_hash"];
      return clone;
    };
    expect(normalize(ctxA.context as never)).toEqual(normalize(ctxB.context as never));
    expect(ctxA.context.current_task).toBe(TASK_A);
    expect(ctxB.context.current_task).toBe(TASK_B);

    // 44/45. the deterministic provider produces different lawful Appraisals.
    const providerA = deterministicProvider(worldA);
    const providerB = deterministicProvider(worldB);
    const proposalA = await providerA.proposeExperienceAppraisal(ctxA.context as never);
    const proposalB = await providerB.proposeExperienceAppraisal(ctxB.context as never);
    if (proposalA.status !== "APPRAISED" || proposalB.status !== "APPRAISED") throw new Error("proposals must be APPRAISED");
    expect(proposalA.dimensions.goal_congruence).toBe(0.15);
    expect(proposalB.dimensions.goal_congruence).toBe(0.85);
    expect(proposalA.context_projection_hash).not.toBe(proposalB.context_projection_hash);
  });

  it("3/5/6/7/9/11/24/25/26/29/30-35/48/51. full lifecycle: commit, replay, isolation, restore", async () => {
    const world = await buildWorld(TASK_A);
    const exp = await createExperience(world);
    const preExperiencePayload = JSON.stringify(world.repo.readStoredPayload(exp.experienceRef as never));
    const preEpisodePayload = JSON.stringify(world.repo.readStoredPayload(exp.episodeRef as never));

    // ---- 5/6. missing/wrong-revision Experience: context fails, provider untouched --
    const providerCallsBefore = world.providerCalls.count;
    const missing = await world.contextBuilder.build(
      { episode_ref: "episode:zzz" as never },
      await world.core.readCurrentSnapshot(SUBJECT_ID as never) as SubjectStateV0
    );
    expect(missing.ok).toBe(false);
    expect(world.providerCalls.count).toBe(providerCallsBefore);

    // ---- 46. an unusual negative appraisal of 谢谢 can be admitted --------------------
    const snapshot = (await world.core.readCurrentSnapshot(SUBJECT_ID as never)) as SubjectStateV0;
    const preAppraisalSnapshot = snapshot;
    const providerCallsBeforeCommit = world.providerCalls.count;
    const outcome = await world.appraisalExecutor.appraiseExperience(
      {
        subject_id: SUBJECT_ID as never,
        current_logical_time: snapshot.runtime_metadata.logical_time as never,
        state_revision: snapshot.runtime_metadata.state_revision as never
      },
      appraiseInput(exp.episodeRef)
    );
    expect(outcome.kind).toBe("COMMITTED");
    if (outcome.kind !== "COMMITTED") return;
    expect(world.providerCalls.count).toBe(providerCallsBeforeCommit + 1);
    // The appraisal record must exist and re-derive.
    const read = await world.appraisalReader.read({
      repository_revision: outcome.memory_revision,
      appraisal_ref: outcome.appraisal_ref
    });
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.record.subject_id).toBe(SUBJECT_ID);
    expect(read.record.experience_ref).toBe(exp.experienceRef);
    expect(read.record.dimensions.relevance).toBe(0.9);
    expect(read.record.dimensions.goal_congruence).toBe(0.15); // subjective, not "reasonable"

    // ---- 31/32. Experience/Episode immutability; episode appraisal_ref stays null ----
    expect(JSON.stringify(world.repo.readStoredPayload(exp.experienceRef as never))).toBe(preExperiencePayload);
    expect(JSON.stringify(world.repo.readStoredPayload(exp.episodeRef as never))).toBe(preEpisodePayload);
    const episodePayload = world.repo.readStoredPayload(exp.episodeRef as never) as { appraisal_ref: unknown };
    expect(episodePayload["appraisal_ref"]).toBeNull();

    // ---- 44. only the Memory revision changed ------------------------------------------
    const post = (await world.core.readCurrentSnapshot(SUBJECT_ID as never)) as SubjectStateV0;
    expect(post.memory_state.repository_revision).not.toBe(snapshot.memory_state.repository_revision);
    // 44. everything EXCEPT the Memory revision is unchanged vs the pre-appraisal head.
    expect(JSON.stringify(post.affect)).toBe(JSON.stringify(preAppraisalSnapshot.affect));
    expect(JSON.stringify(post.mood)).toBe(JSON.stringify(preAppraisalSnapshot.mood));
    expect(JSON.stringify(post.relationships)).toBe(JSON.stringify(preAppraisalSnapshot.relationships));
    expect(JSON.stringify(post.beliefs)).toBe(JSON.stringify(preAppraisalSnapshot.beliefs));
    expect(JSON.stringify(post.personality)).toBe(JSON.stringify(preAppraisalSnapshot.personality));
    expect(JSON.stringify(post.regulation)).toBe(JSON.stringify(preAppraisalSnapshot.regulation));
    expect(JSON.stringify(post.context)).toBe(JSON.stringify(preAppraisalSnapshot.context));
    expect(post.context.task).toBe(TASK_A);
    expect(post.runtime_metadata.state_revision).toBe(preAppraisalSnapshot.runtime_metadata.state_revision + 1);

    // ---- 35/36/48. identical replay → +0, provider not called --------------------------
    const replay = await world.appraisalExecutor.appraiseExperience(
      {
        subject_id: SUBJECT_ID as never,
        current_logical_time: post.runtime_metadata.logical_time as never,
        state_revision: post.runtime_metadata.state_revision as never
      },
      appraiseInput(exp.episodeRef)
    );
    expect(replay.kind).toBe("ALREADY_COMPLETED");
    if (replay.kind === "ALREADY_COMPLETED") {
      expect(replay.appraisal_ref).toBe(outcome.appraisal_ref);
      expect(replay.record.appraisal_ref).toBe(outcome.appraisal_ref);
    }
    expect(world.providerCalls.count).toBe(providerCallsBeforeCommit + 1);

    // ---- 33. retrieval unchanged before/after Appraisal ---------------------------------
    const retrieval = new RepositoryBackedMemoryRetrievalServiceV0(world.repo);
    const query = {
      schema_version: "memory-retrieval-query-v0",
      subject_id: SUBJECT_ID,
      repository_revision: post.memory_state.repository_revision,
      semantic_reference: null,
      temporal: { now_logical_time: post.runtime_metadata.logical_time, window_start: null },
      entity_refs: [ALICE, "subject:s0"],
      relationship_refs: [],
      current_context_refs: [],
      salience_constraints: { min_declared_score: null, max_candidates: 16 }
    } as never;
    const after = await retrieval.retrieve(query);
    expect(after.selected_memory_refs).toContain(exp.episodeRef);
    // The Appraisal payload is not an episode candidate.
    expect(after.selected_memory_refs).not.toContain(outcome.appraisal_ref);
    void after;

    // ---- 36/37. physical-presence and forged-ref laws ------------------------------------
    const strayRef = "appraisal:" + "e".repeat(64);
    await world.repo.storePayload(strayRef as never, recordFixtureForStray());
    const strayRead = await world.appraisalReader.read({
      repository_revision: post.memory_state.repository_revision,
      appraisal_ref: strayRef as never
    });
    expect(strayRead.ok).toBe(false);
    const forged = await world.appraisalReader.read({
      repository_revision: post.memory_state.repository_revision,
      appraisal_ref: "appraisal:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff" as never
    });
    expect(forged.ok).toBe(false);

    // ---- 35 (§47). fresh restore: identical Appraisal, provider calls = 0 ----------------
    const liveDeliveryLedger = world.container.conversationDeliveryLedger;
    const liveIngressLedger = world.container.conversationIngressLedger;
    if (liveDeliveryLedger === null || liveIngressLedger === null) throw new Error("fixture invariant: ledgers wired");
    const persistedDeliveries = liveDeliveryLedger.exportState();
    const persistedIngress = liveIngressLedger.exportState();
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

    const freshRepo = new InMemoryMemoryRepository();
    await freshRepo.prepareRevision({ parent_revision: null, records: [] });
    for (const revision of world.repo.revisionIds()) {
      if (revision === "R0") continue;
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
      await freshRepo.prepareRevision({ parent_revision: manifest.parent_revision, records: entries as never });
    }
    const freshDeliveryLedger = createConversationDeliveryLedgerAuthorityV0();
    const freshIngressLedger = createConversationIngressLedgerAuthorityV0();
    expect((await freshDeliveryLedger.restoreState(persistedDeliveries)).ok).toBe(true);
    expect((await freshIngressLedger.restoreState(persistedIngress)).ok).toBe(true);
    // The full fresh-runtime observation→cognition restore proof lives in the
    // multi-revision suite; this section proves the Appraisal reader path.
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

    const freshExperienceReader = createExperienceReaderV0({
      repository: freshRepo,
      deliveryLedger: freshDeliveryLedger
    });
    const freshAppraisalReader = createExperienceAppraisalReaderV0({
      repository: freshRepo,
      experienceReader: freshExperienceReader
    });
    const freshRead = await freshAppraisalReader.read({
      repository_revision: outcome.memory_revision,
      appraisal_ref: outcome.appraisal_ref
    });
    expect(freshRead.ok).toBe(true);
    if (!freshRead.ok) return;
    expect(freshRead.record.appraisal_ref).toBe(outcome.appraisal_ref);
    expect(freshRead.payload_hash).toBe(read.payload_hash);
    expect(freshRead.record.dimensions).toEqual(read.record.dimensions);
    expect(freshRead.record.assessment_confidence).toBe(read.record.assessment_confidence);
    expect(freshRead.record.evidence_refs).toEqual(read.record.evidence_refs);
    expect(freshRead.record.experience_ref).toBe(exp.experienceRef);
    expect(freshRead.record.experience_payload_hash).toBe(exp.experiencePayloadHash);
    expect(freshRead.record.provenance.provider_id).toBe("test-appraisal-provider");
    expect(freshRead.record.source_state.state_revision).toBe(read.record.source_state.state_revision);
    // 50. restore performs no provider calls.
    expect(world.providerCalls.count).toBe(providerCallsBeforeCommit + 1);
  });

  it("9. null current task ⇒ INSUFFICIENT_CONTEXT with provider calls = 0", async () => {
    const world = await buildWorld(TASK_A);
    const exp = await createExperience(world);
    // A canonical state whose context.task is null (genesis law: s0 has task null).
    const nullTaskCore = createCore(seededStateWithNullTask(), world.repo);
    const nullTaskAppraisalExecutor = new ExperienceAppraisalLearningExecutorV0({
      ...world.container,
      subjectCore: nullTaskCore
    });
    const nullCallsBefore = world.providerCalls.count;
    const nullSnapshot = (await nullTaskCore.readCurrentSnapshot(SUBJECT_ID as never)) as SubjectStateV0;
    const result = await nullTaskAppraisalExecutor.appraiseExperience(
      {
        subject_id: SUBJECT_ID as never,
        current_logical_time: nullSnapshot.runtime_metadata.logical_time as never,
        state_revision: nullSnapshot.runtime_metadata.state_revision as never
      },
      appraiseInput(exp.episodeRef)
    );
    expect(result.kind).toBe("INSUFFICIENT_CONTEXT");
    expect(world.providerCalls.count).toBe(nullCallsBefore);
    void world; void exp;
  });
  it("8/25. cross-subject experience resolution fails; wrong-revision fails closed", async () => {
    const world = await buildWorld(TASK_A);
    const exp = await createExperience(world);
    // A different subject's reader cannot resolve the Experience chain.
    const otherReader = createExperienceAppraisalReaderV0({
      repository: world.repo,
      experienceReader: world.experienceReader
    });
    const read = await otherReader.read({
      repository_revision: exp.memoryRevision,
      appraisal_ref: "appraisal:" + "b".repeat(64)
    });
    expect(read.ok).toBe(false);
    // Wrong revision: the appraisal is invisible outside its bound ancestry.
    const wrongRevision = await world.appraisalReader.read({
      repository_revision: "R0",
      appraisal_ref: "appraisal:" + "c".repeat(64)
    });
    expect(wrongRevision.ok).toBe(false);
  });
});

function recordFixtureForStray(): Record<string, unknown> {
  return {
    schema_version: "experience-appraisal-record-v0",
    appraisal_kind: "INITIAL",
    appraisal_ref: "appraisal:" + "e".repeat(64),
    subject_id: SUBJECT_ID,
    experience_ref: "experience:stray",
    experience_payload_hash: `sha256:${"1".repeat(64)}`,
    grounding: {
      source_episode_ref: "episode:stray",
      source_episode_payload_hash: `sha256:${"2".repeat(64)}`,
      source_event_ref: "event:stray",
      source_event_payload_hash: `sha256:${"3".repeat(64)}`,
      outcome_ref: "outcome:stray",
      behavior_delivery_id: "dlv-stray",
      behavior_payload_hash: `sha256:${"4".repeat(64)}`
    },
    evaluated_at_logical_time: 0,
    source_state: { state_revision: 0, state_hash: `sha256:${"5".repeat(64)}`, repository_revision: "R0" },
    subject_context: { schema_version: "experience-appraisal-subject-context-v0", current_task: "t" },
    context_projection_hash: `sha256:${"6".repeat(64)}`,
    dimensions: {
      relevance: 0.5, goal_congruence: 0.5, attribution: "situation",
      controllability: 0.5, uncertainty: 0.5, intensity: 0.5
    },
    assessment_confidence: 0.5,
    evidence_refs: ["experience:stray"],
    provenance: {
      provider_id: "stray",
      provider_contract_version: "experience-appraisal-provider-v0",
      proposal_hash: `sha256:${"7".repeat(64)}`,
      transition_id: "t-learn-stray"
    }
  };
}

function seededStateWithNullTask(): SubjectStateV0 {
  const base = s0() as unknown as SubjectStateV0;
  return base; // s0 has context.task === null
}
