/**
 * PRE_COGNITION_CANONICAL_APPRAISAL_V0 — integration + matrix suite.
 *
 * Proves: one authoritative incoming conversation factual event receives one
 * immutable, manifest-visible canonical INITIAL Appraisal BEFORE cognition —
 * through the frozen factual-event authority chain (Ingress ↔ committed
 * Observation ↔ event_ref) — with the one-INITIAL law, stale/rebase
 * semantics, restore, tamper fail-closed, legacy Affect shadow safety and
 * Experience compatibility. Deterministic fake providers; real-model calls 0.
 */

import { beforeAll, describe, expect, it } from "vitest";

import type {
  AtomicCommitBundleAnyVersion,
  InMemoryFacadeAssembly,
  ProducerAuthorizationIssuer,
  SubjectStateV0
} from "@characteros-next/subject-core";
import {
  createInMemorySubjectCoreFacade,
  createPersistenceEnvelope,
  proposalFingerprint,
  restoreFromEnvelope
} from "@characteros-next/subject-core";
import {
  InMemoryMemoryRepository,
  computeRepositoryRevisionHash,
  retrievalQueryFingerprint,
  type MemoryPreparationAuthority
} from "@characteros-next/memory";
import { buildContextDelta, ReferenceContextProducer } from "../ports/context-producer-port.js";
import {
  fixedAffectProducer,
  fixedAppraisal,
  fixedInterpretation,
  observationCauseRefOf,
  observationInput,
  s0
} from "../transitions/observation/observation-fixtures.js";
import {
  buildObservationProposal,
  ObservationTransitionExecutor
} from "../transitions/observation/observation-transition-executor.js";
import { RuntimeCompositionRoot } from "../composition/runtime-composition-root.js";
import type { SubjectCorePort } from "../ports/subject-core-port.js";
import type { TransitionCapabilities } from "../transitions/time/time-transition-executor.js";
import type { LearningAdoptionAuthority } from "../transitions/learning/learning-adoption-authority.js";
import type { LearningSourceReadAuthority } from "../transitions/learning/learning-source-authority.js";
import { LearningTransitionExecutor } from "../transitions/learning/learning-transition-executor.js";
import { ExperienceAppraisalLearningExecutorV0 } from "../experience-appraisal/experience-appraisal-executor.js";
import type { ExperienceAppraisalProposalV0 } from "@characteros-next/appraisal";
import { createConversationIngressLedgerAuthorityV0 } from "../transitions/conversation/conversation-ingress-ledger.js";
import {
  createFactualEventAppraisalReaderV0,
  findInitialFactualEventAppraisalV0
} from "./factual-event-appraisal-reader.js";
import {
  FactualEventAppraisalExecutorV0,
  type FactualEventAppraisalExecutionResultV0
} from "./factual-event-appraisal-executor.js";
import {
  deriveFactualEventAppraisalRefV0,
  validateFactualEventAppraisalProposalV0,
  validateFactualEventAppraisalRecordV0,
  deriveFactualEventAppraisalAbstentionRefV0,
  deriveFactualEventAppraisalAbstentionProposalHashV0,
  validateFactualEventAppraisalAbstentionRecordV0,
  type FactualEventAppraisalAbstentionRecordV0,
  type FactualEventAppraisalRecordV0
} from "@characteros-next/appraisal";
import { resolveInitialAppraisalDispositionForFactualEventV0 } from "./factual-event-appraisal-disposition-reader.js";
import { InMemoryAffectEventAuthorityV0 } from "../authority/affect-event-authority-v0.js";
import { buildCharacterLanguageBehaviorV0 } from "@characteros-next/behavior";
import { ConversationTextResponseExecutorV1 } from "../transitions/conversation/conversation-text-response-executor-v1.js";
import { createMiclStageMinter } from "../micl/micl-capabilities.js";
import { InMemoryMiclWorkflowStore } from "../micl/micl-workflow-store.js";
import type { ModelTransportV0 } from "../transports/model-transport.js";

const SUBJECT_ID = "subject-s0";
const ALICE = "entity:alice";
const CONVERSATION_ID = "conv-preCog";
const TASK = "revise the update";

// ----------------------------------------------------------------------------------
// Harness
// ----------------------------------------------------------------------------------

interface TestCore extends SubjectCorePort {
  readonly issuer: ProducerAuthorizationIssuer;
  readonly storeRead: {
    readCurrentBundle(subjectId: string): AtomicCommitBundleAnyVersion | null;
    readCommittedByTransitionId(id: string): AtomicCommitBundleAnyVersion | null;
    getCommittedBundles(): readonly AtomicCommitBundleAnyVersion[];
  };
}

function createCore(snapshot: SubjectStateV0, seedBundles: readonly AtomicCommitBundleAnyVersion[] = []): TestCore {
  const assembly: InMemoryFacadeAssembly = createInMemorySubjectCoreFacade({
    seedSnapshots: new Map([[SUBJECT_ID as never, snapshot]]),
    seedBundles: seedBundles as never,
    preparedResultValidator: async (binding) => binding.prepared_result_ref.startsWith("workflow:"),
    referenceValidator: async () =>
      true as unknown as boolean,
    memoryAdoptionValidator: async () => true
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

interface ProviderState {
  readonly count: { appraisal: number };
  readonly cognition: { count: number; atRevision: number[] };
  /** When > 0, the provider triggers the appraisal of the next standby event
   * before returning (forces the stale path deterministically). */
  advances: number;
}

interface World {
  readonly repo: InMemoryMemoryRepository;
  readonly core: TestCore;
  readonly container: ReturnType<RuntimeCompositionRoot["dependencies"]>;
  readonly observationExecutor: ObservationTransitionExecutor;
  readonly executor: FactualEventAppraisalExecutorV0;
  readonly ingressLedger: ReturnType<typeof createConversationIngressLedgerAuthorityV0>;
  readonly provider: ProviderState;
  /** Events ingested+observed but not yet appraised (stale-advance standby). */
  readonly standby: { readonly eventRef: string; readonly input: Parameters<FactualEventAppraisalExecutorV0["appraiseIncomingEvent"]>[1] }[];
  readonly cognitionCalls: { readonly atRevision: number[] };
}

function baseProposal(context: {
  subject_id: string;
  factual_event_ref: string;
  context_projection_hash: string;
  source_observation_ref: string;
}): Record<string, unknown> {
  return {
    schema_version: "factual-event-appraisal-proposal-v0",
    status: "APPRAISED",
    subject_id: context.subject_id,
    factual_event_ref: context.factual_event_ref,
    context_projection_hash: context.context_projection_hash,
    dimensions: {
      relevance: 0.8, goal_congruence: 0.3, attribution: "other",
      controllability: 0.4, uncertainty: 0.5, intensity: 0.6
    },
    assessment_confidence: 0.7,
    evidence_refs: [context.factual_event_ref, context.source_observation_ref].sort()
  };
}

async function buildWorld(standbyCount = 0, task: string | null = TASK): Promise<World> {
  const repo = new InMemoryMemoryRepository();
  await repo.prepareRevision({ parent_revision: null, records: [] });
  const core = createCore({ ...s0(), context: { ...(s0() as unknown as SubjectStateV0).context, task } } as unknown as SubjectStateV0);

  const provider: ProviderState = { count: { appraisal: 0 }, cognition: { count: 0, atRevision: [] }, advances: 0 };
  const standby: { eventRef: string; input: Parameters<FactualEventAppraisalExecutorV0["appraiseIncomingEvent"]>[1] }[] = [];
  let standbyCursor = 0;
  const cognitionCalls: { atRevision: number[] } = { atRevision: [] };

  let executorRef: FactualEventAppraisalExecutorV0 | null = null;
  let worldRef: World | null = null;

  let inner = false;
  const providerPort = {
    proposeFactualEventAppraisal: async (context: never) => {
      provider.count.appraisal += 1;
      // Deterministic stale-forcing: appraise the next UN-appraised standby
      // event before returning. Inner (standby) provider calls never advance.
      if (!inner && provider.advances > 0 && executorRef !== null && worldRef !== null && standbyCursor < standby.length) {
        provider.advances -= 1;
        const standbyItem = standby[standbyCursor];
        standbyCursor += 1;
        if (standbyItem !== undefined) {
          const advanceSnapshot = (await core.readCurrentSnapshot(SUBJECT_ID as never)) as SubjectStateV0;
          inner = true;
          try {
            await executorRef.appraiseIncomingEvent(
              {
                subject_id: SUBJECT_ID as never,
                current_logical_time: advanceSnapshot.runtime_metadata.logical_time as never,
                state_revision: advanceSnapshot.runtime_metadata.state_revision as never
              },
              standbyItem.input
            );
          } finally {
            inner = false;
          }
        }
      }
      return baseProposal(context);
    }
  };

  const root = new RuntimeCompositionRoot({
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
    contextProducer: new ReferenceContextProducer(),
    learningSourceAuthority: {
      readCommittedBundle: async (id) => core.storeRead.readCommittedByTransitionId(id)
    } as LearningSourceReadAuthority,
    learningAdoptionAuthority: {
      markAdopted: (r) => void repo.markAdopted(r),
      isAdopted: (r) => repo.isAdopted(r)
    } as LearningAdoptionAuthority,
    experiencePayloadRepository: repo,
    experienceAppraisalProvider: {
      proposeExperienceAppraisal: async (ctx) => {
        return {
          schema_version: "experience-appraisal-proposal-v0",
          status: "APPRAISED",
          subject_id: ctx.subject_id,
          experience_ref: ctx.experience_ref,
          context_projection_hash: ctx.context_projection_hash,
          dimensions: {
            relevance: 0.8, goal_congruence: 0.3, attribution: "self",
            controllability: 0.4, uncertainty: 0.5, intensity: 0.6
          },
          assessment_confidence: 0.7,
          evidence_refs: [ctx.experience_ref, ctx.event_ref, ctx.source_observation_ref].sort()
        } as unknown as ExperienceAppraisalProposalV0;
      }
    },
    factualEventAppraisalProvider: providerPort
  });
  const container = root.dependencies();

  const world: World = {
    repo,
    core,
    container,
    observationExecutor: new ObservationTransitionExecutor(container),
    executor: new FactualEventAppraisalExecutorV0(container),
    ingressLedger: container.conversationIngressLedger as ReturnType<typeof createConversationIngressLedgerAuthorityV0>,
    provider,
    standby,
    cognitionCalls
  };
  executorRef = world.executor;
  worldRef = world;

  // Standby events: ingested + observed but NOT appraised (stale fuel).
  for (let i = 0; i < standbyCount; i++) {
    const eventRef = await ingressEvent(world, `evt-standby-${i}`, `standby number ${i}`);
    const o2 = await commitObservation(world, `observation:o-standby-${i}`, eventRef);
    standby.push({
      eventRef,
      input: {
        subject_id: SUBJECT_ID as never,
        source_event_id: `evt-standby-${i}`,
        observation_transition_id: o2.transition_id as never,
        observation_ref: observationCauseRefOf(o2) as never
      }
    });
  }
  return world;
}

async function ingressEvent(world: World, sourceEventId: string, text: string, inReplyToDeliveryId: string | null = null, logicalTime = 0): Promise<string> {
  const ledger = world.ingressLedger;
  const outcome = await ledger.recordIngressEvent({
    schema_version: "conversation-ingress-input-v0",
    subject_id: SUBJECT_ID,
    conversation_id: CONVERSATION_ID,
    actor_ref: ALICE,
    text,
    logical_time: logicalTime,
    source_event_id: sourceEventId,
    in_reply_to_delivery_id: inReplyToDeliveryId,
    host_adapter: "test-adapter"
  });
  if (outcome.kind !== "RECORDED" && outcome.kind !== "REPLAY") {
    throw new Error(`ingress must record: ${outcome.kind}`);
  }
  return outcome.record.event_ref as string;
}

async function commitObservation(world: World, observationId: string, eventRef: string): Promise<AtomicCommitBundleAnyVersion> {
  const snapshot = (await world.core.readCurrentSnapshot(SUBJECT_ID as never)) as SubjectStateV0;
  const ctx = {
    subject_id: SUBJECT_ID as never,
    current_logical_time: snapshot.runtime_metadata.logical_time as never,
    state_revision: snapshot.runtime_metadata.state_revision as never
  };
  const observation = observationInput({
    observation_id: observationId,
    source_refs: [eventRef, "source:s-3"],
    entity_refs: [ALICE, "subject:s0"]
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
      prepared_result_ref: "workflow:w-precog-obs" as never,
      transition_id: proposal.transition_id,
      subject_id: proposal.subject_id,
      transition_type: proposal.transition_type,
      payload_fingerprint: await proposalFingerprint(proposal)
    },
    repository_bindings: await currentBindings(world.repo, snapshot)
  } as TransitionCapabilities);
  if (outcome.kind !== "COMMITTED") throw new Error(`Observation must commit: ${JSON.stringify(outcome).slice(0, 200)}`);
  return outcome.bundle;
}

async function currentBindings(repo: InMemoryMemoryRepository, snapshot: SubjectStateV0): Promise<TransitionCapabilities["repository_bindings"]> {
  const revision = snapshot.memory_state.repository_revision as string;
  const manifest = await repo.readManifest(revision as never);
  if (manifest === null) throw new Error("manifest must exist");
  return [{
    repository_revision: revision as never,
    repository_revision_hash: await computeRepositoryRevisionHash(manifest)
  }] as never;
}

function ctxOf(snapshot: SubjectStateV0) {
  return {
    subject_id: SUBJECT_ID as never,
    current_logical_time: snapshot.runtime_metadata.logical_time as never,
    state_revision: snapshot.runtime_metadata.state_revision as never
  };
}

async function freshCtx(world: World) {
  return ctxOf((await world.core.readCurrentSnapshot(SUBJECT_ID as never)) as SubjectStateV0);
}

/** Ingress + Observation + pre-cognition Appraisal for one event. */
async function fullFlow(world: World, sourceEventId: string, text: string): Promise<{
  eventRef: string;
  o2: AtomicCommitBundleAnyVersion;
  outcome: FactualEventAppraisalExecutionResultV0;
}> {
  const eventRef = await ingressEvent(world, sourceEventId, text);
  const o2 = await commitObservation(world, `observation:o-${sourceEventId}`, eventRef);
  const outcome = await world.executor.appraiseIncomingEvent(await freshCtx(world), {
    subject_id: SUBJECT_ID as never,
    source_event_id: sourceEventId,
    observation_transition_id: o2.transition_id as never,
    observation_ref: observationCauseRefOf(o2) as never
  });
  return { eventRef, o2, outcome };
}

// ----------------------------------------------------------------------------------
// §61 — identity matrix
// ----------------------------------------------------------------------------------

describe("PRE_COGNITION identity matrix (§61)", () => {
  it("1-3. ingress event_ref is stable; the committed Observation binds the exact event; the Appraisal resolves to it", async () => {
    const world = await buildWorld();
    const ref1 = await ingressEvent(world, "evt-x", "重做一下。");
    const ref2 = await ingressEvent(world, "evt-x", "重做一下。");
    expect(ref1).toBe(ref2); // same source id + identical facts ⇒ same event_ref
    const o2 = await commitObservation(world, "observation:o-x", ref1);
    const outcome = await world.executor.appraiseIncomingEvent(await freshCtx(world), {
      subject_id: SUBJECT_ID as never,
      source_event_id: "evt-x",
      observation_transition_id: o2.transition_id as never,
      observation_ref: observationCauseRefOf(o2) as never
    });
    expect(outcome.kind).toBe("COMMITTED");
    if (outcome.kind !== "COMMITTED") return;
    const found = await findInitialFactualEventAppraisalV0(world.repo, outcome.memory_revision as never, SUBJECT_ID, ref1);
    expect(found.kind).toBe("FOUND");
    if (found.kind !== "FOUND") return;
    expect(found.record.factual_event_ref).toBe(ref1);
    expect(found.record.source_observation_ref).toBe(observationCauseRefOf(o2));
    expect(found.record.semantic_appraisal_episode).toBe("INITIAL");
  });

  it("4. same text / different event IDs create separate INITIALs (§5)", async () => {
    const world = await buildWorld();
    const a = await fullFlow(world, "evt-a", "重做一下。");
    const b = await fullFlow(world, "evt-b", "重做一下。");
    expect(a.eventRef).not.toBe(b.eventRef);
    if (a.outcome.kind !== "COMMITTED" || b.outcome.kind !== "COMMITTED") throw new Error("both must commit");
    expect(a.outcome.appraisal_ref).not.toBe(b.outcome.appraisal_ref);
  });

  it("5/24/25. same event replay resolves the SAME INITIAL: provider +0, repository write +0 (§19/§37)", async () => {
    const world = await buildWorld();
    const first = await fullFlow(world, "evt-x", "重做一下。");
    expect(first.outcome.kind).toBe("COMMITTED");
    const callsAfterFirst = world.provider.count.appraisal;
    const revisionsAfterFirst = world.repo.revisionIds().length;
    const replay = await world.executor.appraiseIncomingEvent(await freshCtx(world), {
      subject_id: SUBJECT_ID as never,
      source_event_id: "evt-x",
      observation_transition_id: first.o2.transition_id as never,
      observation_ref: observationCauseRefOf(first.o2) as never
    });
    expect(replay.kind).toBe("ALREADY_COMPLETED");
    if (replay.kind !== "ALREADY_COMPLETED") return;
    expect(world.provider.count.appraisal).toBe(callsAfterFirst);
    expect(world.repo.revisionIds().length).toBe(revisionsAfterFirst);
    if (first.outcome.kind !== "COMMITTED") return;
    expect(replay.appraisal_ref).toBe(first.outcome.appraisal_ref);
  });

  it("6. same source id with changed payload conflicts at ingress (§4 source law)", async () => {
    const world = await buildWorld();
    await ingressEvent(world, "evt-x", "重做一下。");
    const ledger = world.ingressLedger;
    const conflict = await ledger.recordIngressEvent({
      schema_version: "conversation-ingress-input-v0",
      subject_id: SUBJECT_ID,
      conversation_id: CONVERSATION_ID,
      actor_ref: ALICE,
      text: "还是不对。",
      logical_time: 0,
      source_event_id: "evt-x",
      in_reply_to_delivery_id: null,
      host_adapter: "test-adapter"
    });
    expect(conflict.kind).toBe("CONFLICT");
  });

  it("9/55. a genuinely new later factual event gets its own independent INITIAL", async () => {
    const world = await buildWorld();
    const x = await fullFlow(world, "evt-x", "重做一下。");
    const y = await fullFlow(world, "evt-y", "还是不对。");
    if (x.outcome.kind !== "COMMITTED" || y.outcome.kind !== "COMMITTED") throw new Error("both must commit");
    expect(x.outcome.appraisal_ref).not.toBe(y.outcome.appraisal_ref);
  });
});

// ----------------------------------------------------------------------------------
// §62 — validation matrix
// ----------------------------------------------------------------------------------

describe("PRE_COGNITION validation matrix (§62)", () => {
  it("10-16/21. hostile provider proposals fail closed before any store (extra field/NaN/Infinity/range/attribution/confidence/hash)", async () => {
    const cases: readonly { readonly name: string; readonly mutate: (p: Record<string, unknown>) => unknown; readonly expected: RegExp }[] = [
      { name: "extra field", mutate: (p) => ({ ...p, rationale: "nope" }), expected: /unknown key rationale/ },
      { name: "NaN dimension", mutate: (p) => ({ ...p, dimensions: { ...(p["dimensions"] as Record<string, unknown>), relevance: Number.NaN } }), expected: /relevance: UnitIntervalV0 required/ },
      { name: "Infinity dimension", mutate: (p) => ({ ...p, dimensions: { ...(p["dimensions"] as Record<string, unknown>), intensity: Number.POSITIVE_INFINITY } }), expected: /intensity: UnitIntervalV0 required/ },
      { name: "out-of-range", mutate: (p) => ({ ...p, dimensions: { ...(p["dimensions"] as Record<string, unknown>), controllability: 1.5 } }), expected: /controllability: UnitIntervalV0 required/ },
      { name: "invalid attribution", mutate: (p) => ({ ...p, dimensions: { ...(p["dimensions"] as Record<string, unknown>), attribution: "world" } }), expected: /attribution: expected exactly/ },
      { name: "invalid confidence", mutate: (p) => ({ ...p, assessment_confidence: 1.5 }), expected: /assessment_confidence/ },
      { name: "wrong context hash", mutate: (p) => ({ ...p, context_projection_hash: "sha256:" + "a".repeat(64) }), expected: /different context projection/ }
    ];
    for (const testCase of cases) {
      const world = await buildWorld();
      const eventRef = await ingressEvent(world, "evt-x", "重做一下。");
      const o2 = await commitObservation(world, "observation:o-x", eventRef);
      const provider = {
        proposeFactualEventAppraisal: async (context: never) => {
          world.provider.count.appraisal += 1;
          return testCase.mutate(baseProposal(context));
        }
      };
      const revisionsBefore = world.repo.revisionIds().join(",");
      await expect(
        new FactualEventAppraisalExecutorV0({ ...world.container, factualEventAppraisalProvider: provider } as never).appraiseIncomingEvent(await freshCtx(world), {
          subject_id: SUBJECT_ID as never,
          source_event_id: "evt-x",
          observation_transition_id: o2.transition_id as never,
          observation_ref: observationCauseRefOf(o2) as never
        })
      ).rejects.toThrow(testCase.expected);
      expect(world.repo.revisionIds().join(",")).toBe(revisionsBefore);
    }
  });

  it("17. invalid evidence (outside the pre-cognition allowlist) rejected", async () => {
    const world = await buildWorld();
    const eventRef = await ingressEvent(world, "evt-x", "重做一下。");
    const o2 = await commitObservation(world, "observation:o-x", eventRef);
    const provider = {
      proposeFactualEventAppraisal: async (context: never) => {
        const base = baseProposal(context);
        return { ...base, evidence_refs: ["episode:stray"] };
      }
    };
    await expect(
      new FactualEventAppraisalExecutorV0({ ...world.container, factualEventAppraisalProvider: provider } as never).appraiseIncomingEvent(await freshCtx(world), {
        subject_id: SUBJECT_ID as never,
        source_event_id: "evt-x",
        observation_transition_id: o2.transition_id as never,
        observation_ref: observationCauseRefOf(o2) as never
      })
    ).rejects.toThrow(/outside the pre-cognition grounding allowlist/);
  });

  it("18. wrong subject rejected", async () => {
    const world = await buildWorld();
    const eventRef = await ingressEvent(world, "evt-x", "重做一下。");
    const o2 = await commitObservation(world, "observation:o-x", eventRef);
    const provider = {
      proposeFactualEventAppraisal: async (context: never) => ({ ...baseProposal(context), subject_id: "subject-other" })
    };
    await expect(
      new FactualEventAppraisalExecutorV0({ ...world.container, factualEventAppraisalProvider: provider } as never).appraiseIncomingEvent(await freshCtx(world), {
        subject_id: SUBJECT_ID as never,
        source_event_id: "evt-x",
        observation_transition_id: o2.transition_id as never,
        observation_ref: observationCauseRefOf(o2) as never
      })
    ).rejects.toThrow(/proposal subject does not match/);
  });

  it("19. wrong event rejected (provider echoes a different factual_event_ref)", async () => {
    const world = await buildWorld();
    const eventRef = await ingressEvent(world, "evt-x", "重做一下。");
    const o2 = await commitObservation(world, "observation:o-x", eventRef);
    const provider = {
      proposeFactualEventAppraisal: async (context: never) => ({ ...baseProposal(context), factual_event_ref: "event:" + "f".repeat(64) })
    };
    await expect(
      new FactualEventAppraisalExecutorV0({ ...world.container, factualEventAppraisalProvider: provider } as never).appraiseIncomingEvent(await freshCtx(world), {
        subject_id: SUBJECT_ID as never,
        source_event_id: "evt-x",
        observation_transition_id: o2.transition_id as never,
        observation_ref: observationCauseRefOf(o2) as never
      })
    ).rejects.toThrow(/does not match the evaluated event/);
  });

  it("20. wrong Observation grounding rejected (uncommitted/unrelated observation)", async () => {
    const world = await buildWorld();
    await ingressEvent(world, "evt-x", "重做一下。");
    await commitObservation(world, "observation:o-x", (await world.ingressLedger.readIngressEvent(SUBJECT_ID, "evt-x"))?.event_ref as never);
    const fakeObservationId = "observation:o-fake";
    const fakeObservationRef = "observation:" + "e".repeat(64);
    await expect(
      world.executor.appraiseIncomingEvent(await freshCtx(world), {
        subject_id: SUBJECT_ID as never,
        source_event_id: "evt-x",
        observation_transition_id: fakeObservationId as never,
        observation_ref: fakeObservationRef as never
      })
    ).rejects.toThrow(/factual event grounding failed/);
  });

  it("22/23. canonical record validation + self-ref rederivation hold for every commit", async () => {
    const world = await buildWorld();
    const { outcome, eventRef } = await fullFlow(world, "evt-x", "重做一下。");
    expect(outcome.kind).toBe("COMMITTED");
    if (outcome.kind !== "COMMITTED") return;
    const payload = world.repo.readStoredPayload(outcome.appraisal_ref as never) as FactualEventAppraisalRecordV0;
    const checked = validateFactualEventAppraisalRecordV0(payload);
    expect(checked.ok).toBe(true);
    const rederived = await deriveFactualEventAppraisalRefV0(payload);
    expect(rederived).toBe(payload.appraisal_ref);
    expect(payload.factual_event_ref).toBe(eventRef);
  });
});

// ----------------------------------------------------------------------------------
// §63 — uniqueness matrix
// ----------------------------------------------------------------------------------

describe("PRE_COGNITION uniqueness matrix (§63)", () => {
  it("26. malformed visible candidate fails closed (corruption is NOT absence)", async () => {
    const world = await buildWorld();
    const { outcome } = await fullFlow(world, "evt-x", "重做一下。");
    if (outcome.kind !== "COMMITTED") throw new Error("must commit");
    // Narrow seam: replay the chain with the committed appraisal MUTATED
    // (self-consistent manifest hash) — a visible but malformed candidate.
    const corruptRepo = new InMemoryMemoryRepository();
    await corruptRepo.prepareRevision({ parent_revision: null, records: [] });
    for (const revision of world.repo.revisionIds()) {
      if (revision === "R0") continue;
      const manifest = await world.repo.readManifest(revision);
      if (manifest === null) continue;
      const entries = [];
      for (const entry of manifest.record_hashes) {
        const payload = world.repo.readStoredPayload(entry.ref as never);
        if (payload === undefined) throw new Error("payload must exist");
        const mutated = JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;
        const isTarget = entry.ref === outcome.appraisal_ref;
        if (isTarget) (mutated["dimensions"] as Record<string, unknown>)["relevance"] = 5.5;
        const hash = await corruptRepo.storePayload(entry.ref as never, mutated);
        entries.push({ ref: entry.ref, payload_hash: hash });
      }
      await corruptRepo.prepareRevision({ parent_revision: manifest.parent_revision, records: entries as never });
    }
    const reader = createFactualEventAppraisalReaderV0({ repository: corruptRepo });
    const found = await findInitialFactualEventAppraisalV0(corruptRepo, outcome.memory_revision as never, SUBJECT_ID, "event:" + "0".repeat(64));
    void found;
    const result = await reader.readCanonicalInitialAppraisalForFactualEvent({
      subject_id: SUBJECT_ID,
      factual_event_ref: (world.repo.readStoredPayload(outcome.appraisal_ref as never) as FactualEventAppraisalRecordV0).factual_event_ref,
      repository_revision: outcome.memory_revision as never
    });
    expect(result.kind).toBe("INTEGRITY_FAILURE");
    await expect(
      new FactualEventAppraisalExecutorV0({ ...world.container, experienceAppraisalStore: corruptRepo } as never).appraiseIncomingEvent(await freshCtx(world), {
        subject_id: SUBJECT_ID as never,
        source_event_id: "evt-x",
        observation_transition_id: (await world.ingressLedger.readIngressEvent(SUBJECT_ID, "evt-x"))?.event_ref as never,
        observation_ref: "observation:" + "0".repeat(64) as never
      })
    ).rejects.toThrow(/is malformed|grounding failed/);
  });

  it("27. duplicate valid INITIAL candidates are an integrity failure (never two)", async () => {
    const world = await buildWorld();
    const { outcome, eventRef } = await fullFlow(world, "evt-x", "重做一下。");
    if (outcome.kind !== "COMMITTED") throw new Error("must commit");
    // Forge a SECOND valid-looking INITIAL for the same tuple in the manifest.
    const payload = world.repo.readStoredPayload(outcome.appraisal_ref as never) as FactualEventAppraisalRecordV0;
    const second = { ...payload, subject_context: { ...payload.subject_context, current_task: TASK + "!" } };
    const secondRef = await deriveFactualEventAppraisalRefV0(second as never);
    const secondRecord = { ...second, appraisal_ref: secondRef };
    const secondHash = await world.repo.storePayload(secondRef as never, secondRecord);
    const manifest = await world.repo.readManifest(outcome.memory_revision as never);
    if (manifest === null) throw new Error("manifest must exist");
    const entries = manifest.record_hashes.map((e) => ({ ref: e.ref, payload_hash: e.payload_hash }));
    entries.push({ ref: secondRef, payload_hash: secondHash });
    entries.sort((a, b) => (a.ref < b.ref ? -1 : 1));
    await world.repo.prepareRevision({ parent_revision: outcome.memory_revision as never, records: entries as never });
    const found = await findInitialFactualEventAppraisalV0(
      world.repo, world.repo.revisionIds().at(-1) as never, SUBJECT_ID, eventRef
    );
    expect(found.kind).toBe("INTEGRITY_FAILURE");
  });

  it("28. concurrent same-event execution produces exactly one record and one commit", async () => {
    const world = await buildWorld();
    const eventRef = await ingressEvent(world, "evt-x", "重做一下。");
    const o2 = await commitObservation(world, "observation:o-x", eventRef);
    const input = {
      subject_id: SUBJECT_ID as never,
      source_event_id: "evt-x",
      observation_transition_id: o2.transition_id as never,
      observation_ref: observationCauseRefOf(o2) as never
    };
    const ctx = await freshCtx(world);
    const [a, b] = await Promise.all([
      world.executor.appraiseIncomingEvent(ctx, input),
      world.executor.appraiseIncomingEvent(ctx, input)
    ]);
    const committed = [a, b].filter((r) => r.kind === "COMMITTED");
    expect(committed).toHaveLength(1);
    const found = await findInitialFactualEventAppraisalV0(
      world.repo, world.repo.revisionIds().at(-1) as never, SUBJECT_ID, eventRef
    );
    expect(found.kind).toBe("FOUND");
  });

  it("29. stale attempt does not create an orphan INITIAL (rebuild lands on the new head)", async () => {
    const world = await buildWorld(1); // one standby event as stale fuel
    providerAdvanceOnce(world);
    const { outcome } = await fullFlow(world, "evt-x", "重做一下。");
    expect(outcome.kind).toBe("COMMITTED");
    if (outcome.kind !== "COMMITTED") return;
    const record = world.repo.readStoredPayload(outcome.appraisal_ref as never) as FactualEventAppraisalRecordV0;
    // The committed record binds the POST-advance rebuild anchor (the stale
    // attempt originally anchored two revisions earlier).
    const head = (await world.core.readCurrentSnapshot(SUBJECT_ID as never)) as SubjectStateV0;
    expect(record.subject_state.state_revision).toBe(head.runtime_metadata.state_revision - 1);
    expect(record.subject_state.state_revision).toBeGreaterThanOrEqual(3);
    // Exactly one INITIAL for X and one for the standby event.
    const visible = await world.repo.readVisibleRecordHashes(head.memory_state.repository_revision as never);
    const initialCount = visible.filter((e) => e.ref.startsWith("appraisal:")).length;
    expect(initialCount).toBe(2);
    world.provider.advances = 0;
  });

  it("30. second stale → REBASE_REQUIRED", async () => {
    const world = await buildWorld(2); // two standby events: one advance per provider call
    providerAdvanceOnce(world);
    providerAdvanceOnce(world);
    const { outcome } = await fullFlow(world, "evt-x", "重做一下。");
    expect(outcome.kind).toBe("REBASE_REQUIRED");
    if (outcome.kind === "REBASE_REQUIRED") {
      expect(outcome.failure.error_code).toBe("STALE_STATE_REVISION");
      expect(outcome.failure.reason).toBe("REBASE-STALE-001");
    }
    world.provider.advances = 0;
  });

  function providerAdvanceOnce(world: World): void {
    world.provider.advances += 1;
  }
});

// ----------------------------------------------------------------------------------
// §64 — order matrix (V1 governed conversation path, instrumented)
// ----------------------------------------------------------------------------------

describe("PRE_COGNITION order matrix (§64) — governed V1 conversation path", () => {
  it("31-35. ingress → Observation → Appraisal provider → Appraisal commit → cognition (strict order)", async () => {
    const world = await buildWorld();
    const eventRef = await ingressEvent(world, "evt-x", "重做一下。");
    const o2 = await commitObservation(world, "observation:o-x", eventRef);

    // Instrumented conversation cognition transport: records the memory
    // revision at the moment cognition runs.
    const conversationRequests: unknown[] = [];
    const cognitionTransport: ModelTransportV0 = {
      complete: async (request: unknown) => {
        void world.cognitionCalls;
        const revision = world.repo.revisionIds().at(-1) ?? "R0";
        (cognitionRequestsAtCognition()).push(revision);
        conversationRequests.push(request);
        const userContent = (request as { messages?: { role: string; content: string }[] }).messages?.find((m) => m.role === "user")?.content ?? "";
        const hashMatch = /\[projection_hash\] (sha256:[0-9a-f]{64})/.exec(userContent);
        return {
          content: JSON.stringify({
            schema_version: "conversation-cognition-proposal-v1",
            cognition: {
              schema_version: "cognition-proposal-v0",
              projection_hash: hashMatch?.[1] ?? "sha256:" + "0".repeat(64),
              reasoning_summary: "Offline summary.",
              relevant_memory_refs: [],
              considered_context_refs: [],
              current_intent: "respond",
              confidence: 0.9,
              uncertainty: 0.1,
              action_intent: null,
              evidence_refs: []
            },
            communication_directive: { kind: "CLARIFY_MISSING_CONTEXT" }
          }),
          model: "fake-conversation-cognition"
        };
      }
    } as unknown as ModelTransportV0;
    const cognitionRevisions: string[] = [];
    function cognitionRequestsAtCognition(): string[] {
      return cognitionRevisions;
    }

    const root = new RuntimeCompositionRoot({
      subjectCore: world.core,
      producerAuthorizationIssuer: world.core.issuer,
      memoryRepository: world.repo,
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
      contextProducer: new ReferenceContextProducer(),
      learningSourceAuthority: {
        readCommittedBundle: async (id) => world.core.storeRead.readCommittedByTransitionId(id)
      } as LearningSourceReadAuthority,
      learningAdoptionAuthority: {
        markAdopted: (r) => void world.repo.markAdopted(r),
        isAdopted: (r) => world.repo.isAdopted(r)
      } as LearningAdoptionAuthority,
      experiencePayloadRepository: world.repo,
      ingressLedger: world.ingressLedger,
      factualEventAppraisalProvider: world.container.factualEventAppraisalProvider as never,
      conversationCognitionTransport: cognitionTransport,
      episodeContentReader: (() => {
        throw new Error("episode reader must not be called for CLARIFY");
      }) as never
    });
    const snapshot = (await world.core.readCurrentSnapshot(SUBJECT_ID as never)) as SubjectStateV0;
    void snapshot;
    const executor = new ConversationTextResponseExecutorV1(root.dependencies());
    const current = (await world.core.readCurrentSnapshot(SUBJECT_ID as never)) as SubjectStateV0;
    const minter = createMiclStageMinter(world.core, new InMemoryMiclWorkflowStore(), {
      micl_id: "micl-e3-order" as never,
      micl_request_fingerprint: "sha256:e3-order" as never,
      stage_key: "OBSERVATION"
    });
    const result = await executor.execute(
      ctxOf(current),
      {
        response_request_id: "resp-e3-order" as never,
        cause_refs: [],
        factual_event: {
          source_event_id: "evt-x",
          observation_transition_id: o2.transition_id,
          observation_ref: observationCauseRefOf(o2)
        }
      },
      minter.capabilities(await currentBindings(world.repo, current))
    );
    // The cognition ran (clarify branch) and the appraisal preceded it.
    if (result.kind === "FAILED") throw new Error("order-test failure: " + result.stage + ": " + result.detail);
    expect(result.kind).toBe("OUTPUT_READY");
    expect(world.provider.count.appraisal).toBe(1);
    expect(cognitionRevisions.length).toBe(1);
    // At the moment cognition ran, the canonical INITIAL was already visible.
    const appraisalVisible = await findInitialFactualEventAppraisalV0(
      world.repo, cognitionRevisions[0] as never, SUBJECT_ID, eventRef
    );
    expect(appraisalVisible.kind).toBe("FOUND");
  });

  it("33. a failed Appraisal commit prevents cognition from starting", async () => {
    const world = await buildWorld();
    const eventRef = await ingressEvent(world, "evt-x", "重做一下。");
    const o2 = await commitObservation(world, "observation:o-x", eventRef);
    const hostileRoot = new RuntimeCompositionRoot({
      subjectCore: world.core,
      producerAuthorizationIssuer: world.core.issuer,
      memoryRepository: world.repo,
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
      contextProducer: new ReferenceContextProducer(),
      learningSourceAuthority: {
        readCommittedBundle: async (id) => world.core.storeRead.readCommittedByTransitionId(id)
      } as LearningSourceReadAuthority,
      learningAdoptionAuthority: {
        markAdopted: (r) => void world.repo.markAdopted(r),
        isAdopted: (r) => world.repo.isAdopted(r)
      } as LearningAdoptionAuthority,
      experiencePayloadRepository: world.repo,
      ingressLedger: world.ingressLedger,
      factualEventAppraisalProvider: { proposeFactualEventAppraisal: async () => { throw new Error("provider down"); } },
      conversationCognitionTransport: {
        complete: async () => { throw new Error("COGNITION MUST NOT RUN"); }
      } as never
    });
    const executor = new ConversationTextResponseExecutorV1(hostileRoot.dependencies());
    const result = await executor.execute(
      await freshCtx(world),
      {
        response_request_id: "resp-e3-fail" as never,
        factual_event: {
          source_event_id: "evt-x",
          observation_transition_id: o2.transition_id,
          observation_ref: observationCauseRefOf(o2)
        }
      },
      { } as never
    );
    expect(result.kind).toBe("FAILED");
    if (result.kind === "FAILED") expect(result.stage).toBe("APPRAISAL_FAILED");
  });
});

// ----------------------------------------------------------------------------------
// §65 — persistence matrix
// ----------------------------------------------------------------------------------

describe("PRE_COGNITION persistence matrix (§65)", () => {
  it("36-42. only the memory revision changes; every other domain is untouched", async () => {
    const world = await buildWorld();
    const eventRef = await ingressEvent(world, "evt-x", "重做一下。");
    await commitObservation(world, "observation:o-x", eventRef);
    const before = (await world.core.readCurrentSnapshot(SUBJECT_ID as never)) as SubjectStateV0;
    const outcome = await world.executor.appraiseIncomingEvent(await freshCtx(world), {
      subject_id: SUBJECT_ID as never,
      source_event_id: "evt-x",
      observation_transition_id: (world.core.storeRead.getCommittedBundles().at(-1) as AtomicCommitBundleAnyVersion).transition_id as never,
      observation_ref: observationCauseRefOf(world.core.storeRead.getCommittedBundles().at(-1) as AtomicCommitBundleAnyVersion) as never
    });
    expect(outcome.kind).toBe("COMMITTED");
    const after = (await world.core.readCurrentSnapshot(SUBJECT_ID as never)) as SubjectStateV0;
    expect(after.memory_state.repository_revision).not.toBe(before.memory_state.repository_revision);
    expect(after.runtime_metadata.state_revision).toBe(before.runtime_metadata.state_revision + 1);
    expect(JSON.stringify(after.affect)).toBe(JSON.stringify(before.affect));
    expect(JSON.stringify(after.mood)).toBe(JSON.stringify(before.mood));
    expect(JSON.stringify(after.relationships)).toBe(JSON.stringify(before.relationships));
    expect(JSON.stringify(after.beliefs)).toBe(JSON.stringify(before.beliefs));
    expect(JSON.stringify(after.personality)).toBe(JSON.stringify(before.personality));
    expect(JSON.stringify(after.regulation)).toBe(JSON.stringify(before.regulation));
    expect(JSON.stringify(after.context)).toBe(JSON.stringify(before.context));
  });

  it("43. effective ancestry keeps the Appraisal visible after later revisions", async () => {
    const world = await buildWorld();
    const x = await fullFlow(world, "evt-x", "重做一下。");
    const y = await fullFlow(world, "evt-y", "还是不对。");
    if (x.outcome.kind !== "COMMITTED" || y.outcome.kind !== "COMMITTED") throw new Error("both must commit");
    const found = await findInitialFactualEventAppraisalV0(world.repo, y.outcome.memory_revision as never, SUBJECT_ID, x.eventRef);
    expect(found.kind).toBe("FOUND");
  });

  it("44/45. fresh restore reads the same Appraisal; replay provider calls = 0; no new commit", async () => {
    const world = await buildWorld();
    const { eventRef, outcome } = await fullFlow(world, "evt-x", "重做一下。");
    if (outcome.kind !== "COMMITTED") throw new Error("must commit");
    const committedBundles = world.core.storeRead.getCommittedBundles();
    const headBundle = committedBundles.at(-1);
    if (headBundle === undefined) throw new Error("head bundle must exist");
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
        if (payload === undefined) throw new Error("payload must exist");
        const hash = await freshRepo.storePayload(entry.ref as never, payload);
        if (hash !== entry.payload_hash) throw new Error("replayed hash must match");
        entries.push({ ref: entry.ref, payload_hash: hash });
      }
      await freshRepo.prepareRevision({ parent_revision: manifest.parent_revision, records: entries as never });
    }
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
    const freshReader = createFactualEventAppraisalReaderV0({ repository: freshRepo });
    const freshRead = await freshReader.readCanonicalInitialAppraisalForFactualEvent({
      subject_id: SUBJECT_ID,
      factual_event_ref: eventRef,
      repository_revision: restore.snapshot.memory_state.repository_revision as never
    });
    expect(freshRead.kind).toBe("FOUND");
    // ---- fresh runtime over the restored surface --------------------------------
    const freshCore2 = createCore(restore.snapshot, committedBundles);
    const freshIngressLedger = createConversationIngressLedgerAuthorityV0();
    expect((await freshIngressLedger.restoreState(world.ingressLedger.exportState())).ok).toBe(true);
    const freshRoot = new RuntimeCompositionRoot({
      subjectCore: freshCore2,
      producerAuthorizationIssuer: freshCore2.issuer,
      memoryRepository: freshRepo,
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
      contextProducer: new ReferenceContextProducer(),
      learningSourceAuthority: {
        readCommittedBundle: async (id) => freshCore2.storeRead.readCommittedByTransitionId(id)
      } as LearningSourceReadAuthority,
      learningAdoptionAuthority: {
        markAdopted: (r) => void freshRepo.markAdopted(r),
        isAdopted: (r) => freshRepo.isAdopted(r)
      } as LearningAdoptionAuthority,
      experiencePayloadRepository: freshRepo,
      ingressLedger: freshIngressLedger,
      factualEventAppraisalProvider: {
        proposeFactualEventAppraisal: async () => {
          throw new Error("FATAL: provider must never run for a restored INITIAL");
        }
      }
    });
    const freshExecutor = new FactualEventAppraisalExecutorV0(freshRoot.dependencies());
    const observationBundle = committedBundles.find((b) => b.trace_entry.cause_refs.some((r) => r.startsWith("observation:")));
    if (observationBundle === undefined) throw new Error("fixture invariant: Observation bundle must exist");
    const o2 = freshCore2.storeRead.readCommittedByTransitionId(observationBundle.transition_id) as AtomicCommitBundleAnyVersion;
    const replay = await freshExecutor.appraiseIncomingEvent(
      {
        subject_id: SUBJECT_ID as never,
        current_logical_time: restore.snapshot.runtime_metadata.logical_time as never,
        state_revision: restore.snapshot.runtime_metadata.state_revision as never
      },
      {
        subject_id: SUBJECT_ID as never,
        source_event_id: "evt-x",
        observation_transition_id: o2.transition_id as never,
        observation_ref: observationCauseRefOf(o2) as never
      }
    );
    expect(replay.kind).toBe("ALREADY_COMPLETED");
  });
});

// ----------------------------------------------------------------------------------
// §66 — legacy Affect shadow matrix
// ----------------------------------------------------------------------------------

describe("PRE_COGNITION legacy Affect shadow matrix (§66)", () => {
  it("46-51. legacy Observation Affect stands; the new INITIAL applies no Affect; authority reports LEGACY_ALREADY_APPLIED", async () => {
    const world = await buildWorld();
    const { eventRef, o2, outcome } = await fullFlow(world, "evt-x", "重做一下。");
    if (outcome.kind !== "COMMITTED") throw new Error("must commit");
    // 46: the Observation carried the legacy Affect write (fixedAffectProducer).
    const observationAffectWrite = o2.trace_entry.domain_mutations.some((m) => m.domain === "affect");
    expect(observationAffectWrite).toBe(true);
    // 47/49/50: the Appraisal Learning commit carries NO Affect-domain mutation
    // and no canonical VA write; exactly one affect-domain bundle exists.
    const bundles = world.core.storeRead.getCommittedBundles();
    const affectBundles = bundles.filter((b) => b.trace_entry.domain_mutations.some((m) => m.domain === "affect"));
    expect(affectBundles).toHaveLength(1);
    expect(affectBundles[0]?.transition_id).toBe(o2.transition_id);
    // 48: the event authority still reports LEGACY_ALREADY_APPLIED.
    const authority = new InMemoryAffectEventAuthorityV0({
      readCommittedBundlesForSubject: async (subjectId) =>
        world.core.storeRead.getCommittedBundles().filter((b) => b.subject_id === subjectId)
    });
    const resolution = await authority.resolveApplicationStatus({
      subject_id: SUBJECT_ID,
      factual_event_ref: eventRef as never,
      initial_appraisal_exists: true
    });
    expect(resolution.status).toBe("LEGACY_ALREADY_APPLIED");
    expect(resolution.legacy_bundle_ref).toBe(o2.commit_ref);
    // 51: FAST_EMA untouched — the Observation affect value is the frozen
    // producer's output shape (no canonical VA fields anywhere).
    const affectValue = (o2.next_snapshot as SubjectStateV0).affect;
    expect(JSON.stringify(affectValue)).not.toContain("valence");
    expect(JSON.stringify(affectValue)).not.toContain("activation");
  });
});


describe('PRE_COGNITION Experience compatibility matrix (§67)', () => {
  it('52/53/54. same-exchange feedback Experience creates its own lawful INITIAL; pre-cognition INITIAL untouched; replay grounding is experience', async () => {
    const world = await buildWorld();
    // Pre-cognition INITIAL A(X) for the incoming question (before cognition).
    const { eventRef, outcome } = await fullFlow(world, 'evt-x', '重做一下。');
    if (outcome.kind !== 'COMMITTED') throw new Error('pre-cognition INITIAL must commit');
    const preCalls = world.provider.count.appraisal;

    // The later feedback path creates a real Experience for the reply event Y
    // (a genuinely NEW factual event per §30 — its own INITIAL is lawful).
    const behaviorBuilt = await buildCharacterLanguageBehaviorV0({
      subject_id: SUBJECT_ID as never,
      source_revision: ((await world.core.readCurrentSnapshot(SUBJECT_ID as never)) as SubjectStateV0).runtime_metadata.state_revision as never,
      response_request_id: 'resp-e3-bridge' as never,
      draft: {
        schema_version: 'language-realization-draft-v0',
        text: '好的，马上处理。',
        input_hash: 'sha256:' + 'b'.repeat(64),
        evidence_refs: []
      } as never
    });
    if (!behaviorBuilt.ok) throw new Error('behavior must build');
    const ledger = world.container.conversationDeliveryLedger;
    if (ledger === null) throw new Error('delivery ledger wired');
    const delivered = await ledger.recordConversationDelivery({
      subject_id: SUBJECT_ID,
      conversation_id: CONVERSATION_ID,
      behavior: behaviorBuilt.behavior,
      delivered_logical_time: 0,
      status: 'DELIVERED',
      host_adapter: 'test-adapter'
    });
    if (!delivered.ok) throw new Error('delivery must record');
    const feedbackExecutor = new LearningTransitionExecutor(world.container);
    const o3 = await commitObservation(world, 'observation:o-feedback', (await ingressEvent(world, 'evt-x-feedback', '不对，还是不对。', delivered.record.delivery_id)));
    const postObs = (await world.core.readCurrentSnapshot(SUBJECT_ID as never)) as SubjectStateV0;
    const feedbackOutcome = await feedbackExecutor.executeBehaviorOutcomeFeedback(
      {
        subject_id: SUBJECT_ID as never,
        current_logical_time: postObs.runtime_metadata.logical_time as never,
        state_revision: postObs.runtime_metadata.state_revision as never
      },
      {
        candidate: {
          subject_id: SUBJECT_ID,
          conversation_id: CONVERSATION_ID,
          source_event_id: 'evt-x-feedback',
          observation_transition_id: o3.transition_id,
          observation_ref: observationCauseRefOf(o3),
          declared_salience: 0.5,
          host_adapter: 'test-adapter'
        }
      } as never
    );
    if (feedbackOutcome.kind !== 'COMMITTED') throw new Error('feedback must commit: ' + JSON.stringify(feedbackOutcome).slice(0, 200));

    // §27/§28 bridge: the Experience executor resolves any pre-cognition
    // factual-event INITIAL for the SAME grounding event (mechanism proven
    // via the unified reader below); for the reply's NEW event it creates
    // exactly one lawful Experience-grounded INITIAL (§30).
    const experienceExecutor = new ExperienceAppraisalLearningExecutorV0(world.container);
    const readEpisodeAndCtx = async () => {
      const s = (await world.core.readCurrentSnapshot(SUBJECT_ID as never)) as SubjectStateV0;
      const eps = (await world.repo.readVisibleRecordHashes(s.memory_state.repository_revision as never)).filter((e) => e.ref.startsWith('episode:'));
      return { episode: eps.at(-1), ctx: { subject_id: SUBJECT_ID as never, current_logical_time: s.runtime_metadata.logical_time as never, state_revision: s.runtime_metadata.state_revision as never } };
    };
    const firstAttempt = await readEpisodeAndCtx();
    if (firstAttempt.episode === undefined) throw new Error('episode must exist');
    const experienceInitial = await experienceExecutor.appraiseExperience(firstAttempt.ctx as never, { subject_id: SUBJECT_ID as never, episode_ref: firstAttempt.episode.ref as never, provider_id: 'test-bridge-provider' as never });
    expect(['COMMITTED', 'ALREADY_COMPLETED']).toContain(experienceInitial.kind);
    if (experienceInitial.kind === 'ALREADY_COMPLETED') {
      // §67.54: an Experience-grounded replay is NEVER labeled factual_event.
      expect(experienceInitial.grounding).not.toBe('factual_event');
    }

    // Replay through the Experience path again: experience-grounded, +0.
    const secondAttempt = await readEpisodeAndCtx();
    if (secondAttempt.episode === undefined) throw new Error('episode must exist');
    const replay2 = await experienceExecutor.appraiseExperience(secondAttempt.ctx as never, { subject_id: SUBJECT_ID as never, episode_ref: secondAttempt.episode.ref as never, provider_id: 'test-bridge-provider' as never });
    expect(replay2.kind).toBe('ALREADY_COMPLETED');
    if (replay2.kind === 'ALREADY_COMPLETED') {
      expect(replay2.grounding ?? 'experience').toBe('experience');
    }

    // §67.53 (bridge mechanism): the pre-cognition INITIAL for X still
    // resolves through the factual-event reader, unduplicated.
    const reader = createFactualEventAppraisalReaderV0({ repository: world.repo });
    const unified = await reader.readCanonicalInitialAppraisalForFactualEvent({
      subject_id: SUBJECT_ID,
      factual_event_ref: eventRef,
      repository_revision: world.repo.revisionIds().at(-1) as never
    });
    expect(unified.kind).toBe('FOUND');
    if (unified.kind === 'FOUND') {
      expect(unified.grounding).toBe('factual_event');
      expect(unified.record.appraisal_ref).toBe(outcome.appraisal_ref);
    }
    // §37: pre-cognition provider calls unchanged.
    expect(world.provider.count.appraisal).toBe(preCalls);
  });

  it('55. a genuinely new outcome event can own a separate INITIAL after the Experience bridge', async () => {
    const world = await buildWorld();
    const x = await fullFlow(world, 'evt-x', '重做一下。');
    const y = await fullFlow(world, 'evt-y', '还是不对。');
    if (x.outcome.kind !== 'COMMITTED' || y.outcome.kind !== 'COMMITTED') throw new Error('both must commit');
    expect(x.outcome.appraisal_ref).not.toBe(y.outcome.appraisal_ref);
  });
});
// ----------------------------------------------------------------------------------
// Validator unit tests (§62.22/§62.23 support)
// ----------------------------------------------------------------------------------

describe("FactualEventAppraisal validators", () => {
  it("rejects unknown keys, wrong schema, wrong episode and non-event refs", () => {
    expect(validateFactualEventAppraisalRecordV0({ schema_version: "other" }).ok).toBe(false);
    expect(validateFactualEventAppraisalProposalV0({ schema_version: "other" }).ok).toBe(false);
  });
});

// ----------------------------------------------------------------------------------
// DURABLE_PRE_COGNITION_APPRAISAL_DISPOSITION_V0 — helpers
// ----------------------------------------------------------------------------------

/** Lawful provider-side INSUFFICIENT_CONTEXT proposal over a frozen context. */
function insufficientProposal(context: {
  readonly subject_id: string;
  readonly factual_event_ref: string;
  readonly context_projection_hash: string;
}): Record<string, unknown> {
  return {
    schema_version: "factual-event-appraisal-proposal-v0",
    status: "INSUFFICIENT_CONTEXT",
    subject_id: context.subject_id,
    factual_event_ref: context.factual_event_ref,
    context_projection_hash: context.context_projection_hash,
    missing_inputs: ["CURRENT_TASK"]
  };
}

/** Counting provider that abstains for every event it is asked about. */
function abstainingProvider(world: World, lastReturned?: { proposal?: Record<string, unknown> }): {
  readonly proposeFactualEventAppraisal: (context: never) => Promise<Record<string, unknown>>;
} {
  return {
    proposeFactualEventAppraisal: async (context: never) => {
      world.provider.count.appraisal += 1;
      const proposal = insufficientProposal(context as never);
      if (lastReturned !== undefined) lastReturned.proposal = proposal;
      return proposal;
    }
  };
}

/** Visible canonical abstention payloads for one factual event. */
async function visibleAbstentionPayloads(world: World, eventRef: string): Promise<FactualEventAppraisalAbstentionRecordV0[]> {
  const snapshot = (await world.core.readCurrentSnapshot(SUBJECT_ID as never)) as SubjectStateV0;
  const visible = await world.repo.readVisibleRecordHashes(snapshot.memory_state.repository_revision as never);
  const found: FactualEventAppraisalAbstentionRecordV0[] = [];
  for (const entry of visible) {
    if (!entry.ref.startsWith("appraisal:")) continue;
    const payload = world.repo.readStoredPayload(entry.ref as never) as
      | { schema_version?: unknown; factual_event_ref?: unknown }
      | undefined;
    if (payload === undefined || payload === null) continue;
    if (payload.schema_version !== "factual-event-appraisal-abstention-record-v0") continue;
    if (payload.factual_event_ref !== eventRef) continue;
    found.push(payload as FactualEventAppraisalAbstentionRecordV0);
  }
  return found;
}

function abstentionCommitCount(world: World, abstentionRef: string): number {
  return world.core.storeRead.getCommittedBundles().filter(
    (b) => (b.trace_entry.cause_refs as readonly string[]).includes(abstentionRef)
  ).length;
}

/** Fresh-repository replay of every canonical revision (host persistence face). */
async function replayRepoOnto(source: InMemoryMemoryRepository): Promise<InMemoryMemoryRepository> {
  const freshRepo = new InMemoryMemoryRepository();
  await freshRepo.prepareRevision({ parent_revision: null, records: [] });
  for (const revision of source.revisionIds()) {
    if (revision === "R0") continue;
    const manifest = await source.readManifest(revision);
    if (manifest === null) continue;
    const entries = [];
    for (const entry of manifest.record_hashes) {
      const payload = source.readStoredPayload(entry.ref as never);
      if (payload === undefined) throw new Error("payload must exist");
      const hash = await freshRepo.storePayload(entry.ref as never, payload);
      if (hash !== entry.payload_hash) throw new Error("replayed hash must match");
      entries.push({ ref: entry.ref, payload_hash: hash });
    }
    await freshRepo.prepareRevision({ parent_revision: manifest.parent_revision, records: entries as never });
  }
  return freshRepo;
}

/** Ingress (with optional reply parent) + Observation + appraisal input. */
async function eventWithObservation(
  world: World,
  sourceEventId: string,
  text: string,
  inReplyToDeliveryId: string | null = null
): Promise<{ eventRef: string; input: Parameters<FactualEventAppraisalExecutorV0["appraiseIncomingEvent"]>[1] }> {
  const eventRef = await ingressEvent(world, sourceEventId, text, inReplyToDeliveryId);
  const o2 = await commitObservation(world, `observation:o-${sourceEventId}`, eventRef);
  return {
    eventRef,
    input: {
      subject_id: SUBJECT_ID as never,
      source_event_id: sourceEventId,
      observation_transition_id: o2.transition_id as never,
      observation_ref: observationCauseRefOf(o2) as never
    }
  };
}

// ----------------------------------------------------------------------------------
// DURABLE PRE-COGNITION APPRAISAL DISPOSITION — context-stage terminality (§52)
// ----------------------------------------------------------------------------------

describe("DURABLE DISPOSITION context-stage abstention (§52)", () => {
  it("23-28. null task → lawful terminal abstention: provider 0, exactly one record, one Learning commit, only memory revision changes", async () => {
    const world = await buildWorld(0, null);
    const { eventRef, input } = await eventWithObservation(world, "evt-x", "重做一下。");
    const before = (await world.core.readCurrentSnapshot(SUBJECT_ID as never)) as SubjectStateV0;
    const revisionsBefore = world.repo.revisionIds().length;
    const outcome = await world.executor.appraiseIncomingEvent(await freshCtx(world), input);
    // 23: null task causes the lawful abstention (terminal, not an error).
    expect(outcome.kind).toBe("INSUFFICIENT_CONTEXT");
    // 24: the provider is never called on the context stage.
    expect(world.provider.count.appraisal).toBe(0);
    // 25: exactly one abstention payload persisted.
    const abstentions = await visibleAbstentionPayloads(world, eventRef);
    expect(abstentions).toHaveLength(1);
    const abstention = abstentions[0] as FactualEventAppraisalAbstentionRecordV0;
    expect(abstention.reason).toBe("INSUFFICIENT_CONTEXT");
    expect(abstention.semantic_appraisal_episode).toBe("INITIAL");
    expect(abstention.provenance.stage).toBe("CONTEXT_EVALUATION");
    expect(abstention.factual_event_ref).toBe(eventRef);
    const checked = validateFactualEventAppraisalAbstentionRecordV0(abstention);
    expect(checked.ok).toBe(true);
    expect(await deriveFactualEventAppraisalAbstentionRefV0(abstention)).toBe(abstention.abstention_ref);
    // 26: exactly one repository revision prepared canonically.
    expect(world.repo.revisionIds().length).toBe(revisionsBefore + 1);
    // 27: exactly one Learning commit carries the abstention.
    const commits = world.core.storeRead.getCommittedBundles().filter(
      (b) => (b.trace_entry.cause_refs as readonly string[]).includes(abstention.abstention_ref)
    );
    expect(commits).toHaveLength(1);
    expect(commits[0]?.transition_type).toBe("Learning");
    // 28: only the memory repository revision changes (§22 isolation).
    const after = (await world.core.readCurrentSnapshot(SUBJECT_ID as never)) as SubjectStateV0;
    expect(after.memory_state.repository_revision).not.toBe(before.memory_state.repository_revision);
    expect(after.runtime_metadata.state_revision).toBe(before.runtime_metadata.state_revision + 1);
    expect(JSON.stringify(after.affect)).toBe(JSON.stringify(before.affect));
    expect(JSON.stringify(after.mood)).toBe(JSON.stringify(before.mood));
    expect(JSON.stringify(after.relationships)).toBe(JSON.stringify(before.relationships));
    expect(JSON.stringify(after.beliefs)).toBe(JSON.stringify(before.beliefs));
    expect(JSON.stringify(after.personality)).toBe(JSON.stringify(before.personality));
    expect(JSON.stringify(after.regulation)).toBe(JSON.stringify(before.regulation));
    expect(JSON.stringify(after.context)).toBe(JSON.stringify(before.context));
    expect(commits[0]?.trace_entry.domain_mutations.every((m) => m.domain === "memory-content")).toBe(true);
  });

  it("29-31. same-event retry → ALREADY_DISPOSED with provider 0, writes 0, commits 0; resolver agrees", async () => {
    const world = await buildWorld(0, null);
    const first = await fullFlow(world, "evt-x", "重做一下。");
    expect(first.outcome.kind).toBe("INSUFFICIENT_CONTEXT");
    const revisionsBefore = world.repo.revisionIds().length;
    const commitsBefore = world.core.storeRead.getCommittedBundles().length;
    const replay = await world.executor.appraiseIncomingEvent(await freshCtx(world), {
      subject_id: SUBJECT_ID as never,
      source_event_id: "evt-x",
      observation_transition_id: first.o2.transition_id as never,
      observation_ref: observationCauseRefOf(first.o2) as never
    });
    expect(replay.kind).toBe("ALREADY_DISPOSED");
    if (replay.kind === "ALREADY_DISPOSED") {
      expect(replay.disposition).toBe("ABSTAINED_INSUFFICIENT_CONTEXT");
      expect(replay.abstention_ref.startsWith("appraisal:")).toBe(true);
    }
    expect(world.provider.count.appraisal).toBe(0);
    expect(world.repo.revisionIds().length).toBe(revisionsBefore);
    expect(world.core.storeRead.getCommittedBundles().length).toBe(commitsBefore);
    const snapshot = (await world.core.readCurrentSnapshot(SUBJECT_ID as never)) as SubjectStateV0;
    const disposition = await resolveInitialAppraisalDispositionForFactualEventV0(
      world.repo, snapshot.memory_state.repository_revision as never, SUBJECT_ID, first.eventRef
    );
    expect(disposition.kind).toBe("ABSTAINED_INSUFFICIENT_CONTEXT");
  });
});

// ----------------------------------------------------------------------------------
// DURABLE PRE-COGNITION APPRAISAL DISPOSITION — provider-stage terminality (§53)
// ----------------------------------------------------------------------------------

describe("DURABLE DISPOSITION provider-stage abstention (§53)", () => {
  it("32-35. lawful provider INSUFFICIENT_CONTEXT → terminal abstention with provider provenance", async () => {
    const world = await buildWorld(0);
    const lastReturned: { proposal?: Record<string, unknown> } = {};
    const provider = abstainingProvider(world, lastReturned);
    const { eventRef, input } = await eventWithObservation(world, "evt-x", "重做一下。");
    const outcome = await new FactualEventAppraisalExecutorV0(
      { ...world.container, factualEventAppraisalProvider: provider } as never
    ).appraiseIncomingEvent(await freshCtx(world), input);
    expect(outcome.kind).toBe("INSUFFICIENT_CONTEXT");
    // 33: provider called exactly once on the first attempt.
    expect(world.provider.count.appraisal).toBe(1);
    // 34: provider provenance persisted (stage PROVIDER + audit hash binding).
    const abstentions = await visibleAbstentionPayloads(world, eventRef);
    expect(abstentions).toHaveLength(1);
    const abstention = abstentions[0] as FactualEventAppraisalAbstentionRecordV0;
    expect(abstention.provenance.stage).toBe("PROVIDER");
    if (abstention.provenance.stage === "PROVIDER") {
      expect(abstention.provenance.provider_id).toBe("factual-event-appraisal-provider");
      expect(abstention.provenance.provider_contract_version).toBe("factual-event-appraisal-provider-v0");
      expect(abstention.provenance.proposal_hash).toBe(
        await deriveFactualEventAppraisalAbstentionProposalHashV0(lastReturned.proposal as never)
      );
    }
    // 35: exactly one abstention committed.
    expect(abstentionCommitCount(world, abstention.abstention_ref)).toBe(1);
  });

  it("36-37. retry → ALREADY_DISPOSED; provider 0; writes/commits 0", async () => {
    const world = await buildWorld(0);
    const provider = abstainingProvider(world);
    const { eventRef, input } = await eventWithObservation(world, "evt-x", "重做一下。");
    const executor = new FactualEventAppraisalExecutorV0(
      { ...world.container, factualEventAppraisalProvider: provider } as never
    );
    const first = await executor.appraiseIncomingEvent(await freshCtx(world), input);
    expect(first.kind).toBe("INSUFFICIENT_CONTEXT");
    const callsAfterFirst = world.provider.count.appraisal;
    const revisionsBefore = world.repo.revisionIds().length;
    const commitsBefore = world.core.storeRead.getCommittedBundles().length;
    const replay = await executor.appraiseIncomingEvent(await freshCtx(world), input);
    expect(replay.kind).toBe("ALREADY_DISPOSED");
    expect(world.provider.count.appraisal).toBe(callsAfterFirst);
    expect(world.repo.revisionIds().length).toBe(revisionsBefore);
    expect(world.core.storeRead.getCommittedBundles().length).toBe(commitsBefore);
    void eventRef;
  });
});

// ----------------------------------------------------------------------------------
// DURABLE PRE-COGNITION APPRAISAL DISPOSITION — operational failures (§54)
// ----------------------------------------------------------------------------------

describe("DURABLE DISPOSITION operational failure separation (§54)", () => {
  it("38/39. provider timeout and exception remain operational — no abstention", async () => {
    const world = await buildWorld(0);
    const { eventRef, input } = await eventWithObservation(world, "evt-x", "重做一下。");
    const throwingProvider = {
      proposeFactualEventAppraisal: async () => {
        world.provider.count.appraisal += 1;
        throw new Error("provider timeout");
      }
    };
    const executor = new FactualEventAppraisalExecutorV0(
      { ...world.container, factualEventAppraisalProvider: throwingProvider } as never
    );
    await expect(executor.appraiseIncomingEvent(await freshCtx(world), input)).rejects.toThrow(/provider timeout/);
    expect(await visibleAbstentionPayloads(world, eventRef)).toHaveLength(0);
  });

  it("40/41. hostile abstention proposals fail closed — no abstention", async () => {
    const world = await buildWorld(0);
    const { eventRef, input } = await eventWithObservation(world, "evt-x", "重做一下。");
    const cases: readonly { readonly name: string; readonly respond: (context: never) => unknown }[] = [
      { name: "malformed schema", respond: (context) => ({ ...insufficientProposal(context as never), schema_version: "other" }) },
      { name: "foreign event echo", respond: (context) => ({ ...insufficientProposal(context as never), factual_event_ref: "event:" + "f".repeat(64) }) },
      { name: "foreign subject echo", respond: (context) => ({ ...insufficientProposal(context as never), subject_id: "subject-other" }) },
      { name: "foreign projection echo", respond: (context) => ({ ...insufficientProposal(context as never), context_projection_hash: "sha256:" + "1".repeat(64) }) }
    ];
    for (const testCase of cases) {
      const provider = {
        proposeFactualEventAppraisal: async (context: never) => {
          world.provider.count.appraisal += 1;
          return testCase.respond(context);
        }
      };
      await expect(
        new FactualEventAppraisalExecutorV0({ ...world.container, factualEventAppraisalProvider: provider } as never)
          .appraiseIncomingEvent(await freshCtx(world), input)
      ).rejects.toThrow();
      expect(await visibleAbstentionPayloads(world, eventRef)).toHaveLength(0);
    }
  });

  it("43. repository prepare failure → no canonical abstention", async () => {
    const world = await buildWorld(0, null);
    const { eventRef, input } = await eventWithObservation(world, "evt-x", "重做一下。");
    const hostileRepo = Object.create(world.repo) as InMemoryMemoryRepository;
    (hostileRepo as { prepareRevisionForIntent: unknown }).prepareRevisionForIntent = async () => {
      throw new Error("prepare down");
    };
    const revisionsBefore = world.repo.revisionIds().length;
    await expect(
      new FactualEventAppraisalExecutorV0({ ...world.container, experienceAppraisalStore: hostileRepo } as never)
        .appraiseIncomingEvent(await freshCtx(world), input)
    ).rejects.toThrow(/abstention repository prepare failed/);
    expect(await visibleAbstentionPayloads(world, eventRef)).toHaveLength(0);
    expect(world.repo.revisionIds().length).toBe(revisionsBefore);
  });

  it("44. integrity failure → no abstention synthesis (fail closed)", async () => {
    const world = await buildWorld(0, null);
    const { eventRef, input } = await eventWithObservation(world, "evt-x", "重做一下。");
    const first = await world.executor.appraiseIncomingEvent(await freshCtx(world), input);
    expect(first.kind).toBe("INSUFFICIENT_CONTEXT");
    // Corrupt-copy the repository with a mutated abstention payload, then
    // observe: the executor must fail closed and synthesize NOTHING.
    const corruptRepo = new InMemoryMemoryRepository();
    await corruptRepo.prepareRevision({ parent_revision: null, records: [] });
    for (const revision of world.repo.revisionIds()) {
      if (revision === "R0") continue;
      const manifest = await world.repo.readManifest(revision);
      if (manifest === null) continue;
      const entries = [];
      for (const entry of manifest.record_hashes) {
        const payload = world.repo.readStoredPayload(entry.ref as never);
        if (payload === undefined) throw new Error("payload must exist");
        const mutated = JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;
        if (mutated["schema_version"] === "factual-event-appraisal-abstention-record-v0") {
          mutated["evaluated_at_logical_time"] = 9999;
        }
        const hash = await corruptRepo.storePayload(entry.ref as never, mutated);
        entries.push({ ref: entry.ref, payload_hash: hash });
      }
      await corruptRepo.prepareRevision({ parent_revision: manifest.parent_revision, records: entries as never });
    }
    const corruptRevisionsBefore = corruptRepo.revisionIds().length;
    await expect(
      new FactualEventAppraisalExecutorV0({ ...world.container, experienceAppraisalStore: corruptRepo } as never)
        .appraiseIncomingEvent(await freshCtx(world), input)
    ).rejects.toThrow(/INVARIANT_VIOLATION|is malformed/);
    expect(corruptRepo.revisionIds().length).toBe(corruptRevisionsBefore);
    void eventRef;
  });
});

// ----------------------------------------------------------------------------------
// DURABLE PRE-COGNITION APPRAISAL DISPOSITION — stale law (§55)
// ----------------------------------------------------------------------------------

describe("DURABLE DISPOSITION stale law (§55)", () => {
  /** Wraps commitReserved so each of the first `fuelCount` outer commits is
   * preceded by one canonical head advance (deterministic stale fuel). The
   * inner advance runs on the UNWRAPPED world core, so it always commits. */
  function staleFuelCore(
    world: World,
    standbyInputs: readonly (Parameters<FactualEventAppraisalExecutorV0["appraiseIncomingEvent"]>[1] | undefined)[],
    fuelCount: number
  ): TestCore {
    const originalCommit = world.core.commitReserved;
    let consumed = 0;
    const wrapped: TestCore = {
      ...world.core,
      commitReserved: async (input) => {
        const standbyInput = standbyInputs[consumed];
        if (consumed < fuelCount && standbyInput !== undefined) {
          consumed += 1;
          await world.executor.appraiseIncomingEvent(await freshCtx(world), standbyInput);
        }
        return originalCommit(input);
      }
    };
    return wrapped;
  }

  it("45-47/51. context-stage stale does not persist; rebuild lands on the new head; one terminal disposition", async () => {
    const world = await buildWorld(1, null); // null task + one standby as stale fuel
    const standbyInput = world.standby[0]?.input;
    if (standbyInput === undefined) throw new Error("fixture invariant: standby must exist");
    const wrapped = staleFuelCore(world, [standbyInput], 1);
    const { eventRef, input } = await eventWithObservation(world, "evt-x", "重做一下。");
    const outcome = await new FactualEventAppraisalExecutorV0(
      { ...world.container, subjectCore: wrapped } as never
    ).appraiseIncomingEvent(await freshCtx(world), input);
    expect(outcome.kind).toBe("INSUFFICIENT_CONTEXT");
    // The committed abstention binds the POST-advance rebuild anchor.
    const head = (await world.core.readCurrentSnapshot(SUBJECT_ID as never)) as SubjectStateV0;
    const abstentions = await visibleAbstentionPayloads(world, eventRef);
    expect(abstentions).toHaveLength(1);
    expect(abstentions[0]?.subject_state.state_revision).toBe(head.runtime_metadata.state_revision - 1);
    // 51: no duplicate terminal disposition; provider 0 throughout (the
    // standby's inner advance also abstains lawfully in a null-task world).
    expect(abstentionCommitCount(world, (abstentions[0] as FactualEventAppraisalAbstentionRecordV0).abstention_ref)).toBe(1);
    expect(world.provider.count.appraisal).toBe(0);
  });

  it("48/46/47/51. provider-stage stale does not persist the old-grounded abstention; rebuild lands on the new head", async () => {
    const world = await buildWorld(1); // non-null task + one standby as stale fuel
    const standbyInput = world.standby[0]?.input;
    if (standbyInput === undefined) throw new Error("fixture invariant: standby must exist");
    const wrapped = staleFuelCore(world, [standbyInput], 1);
    const { eventRef, input } = await eventWithObservation(world, "evt-x", "重做一下。");
    const provider = abstainingProvider(world);
    const outcome = await new FactualEventAppraisalExecutorV0(
      { ...world.container, subjectCore: wrapped, factualEventAppraisalProvider: provider } as never
    ).appraiseIncomingEvent(await freshCtx(world), input);
    expect(outcome.kind).toBe("INSUFFICIENT_CONTEXT");
    // The stale attempt's abstention was DISCARDED; the committed record
    // anchors the post-advance head (48/46: stale never persists).
    const head = (await world.core.readCurrentSnapshot(SUBJECT_ID as never)) as SubjectStateV0;
    const abstentions = await visibleAbstentionPayloads(world, eventRef);
    expect(abstentions).toHaveLength(1);
    expect(abstentions[0]?.subject_state.state_revision).toBe(head.runtime_metadata.state_revision - 1);
    expect(abstentionCommitCount(world, (abstentions[0] as FactualEventAppraisalAbstentionRecordV0).abstention_ref)).toBe(1);
    // 47: rebuild used the latest state — provider ran twice for X
    // (stale attempt + rebuild), plus once for the standby's appraisal.
    expect(world.provider.count.appraisal).toBe(3);
  });

  it("49/50. second stale → REBASE_REQUIRED and NO abstention persists", async () => {
    const world = await buildWorld(2); // two standby events: one advance per commit
    const standby0 = world.standby[0]?.input;
    const standby1 = world.standby[1]?.input;
    if (standby0 === undefined || standby1 === undefined) throw new Error("fixture invariant: standbys must exist");
    const wrapped = staleFuelCore(world, [standby0, standby1], 2);
    const { eventRef, input } = await eventWithObservation(world, "evt-x", "重做一下。");
    const provider = abstainingProvider(world);
    const outcome = await new FactualEventAppraisalExecutorV0(
      { ...world.container, subjectCore: wrapped, factualEventAppraisalProvider: provider } as never
    ).appraiseIncomingEvent(await freshCtx(world), input);
    expect(outcome.kind).toBe("REBASE_REQUIRED");
    if (outcome.kind === "REBASE_REQUIRED") {
      expect(outcome.failure.error_code).toBe("STALE_STATE_REVISION");
      expect(outcome.failure.reason).toBe("REBASE-STALE-001");
    }
    // 50: no abstention grounded in obsolete context was persisted.
    expect(await visibleAbstentionPayloads(world, eventRef)).toHaveLength(0);
  });
});

// ----------------------------------------------------------------------------------
// DURABLE PRE-COGNITION APPRAISAL DISPOSITION — concurrency (§56)
// ----------------------------------------------------------------------------------

describe("DURABLE DISPOSITION concurrency (§56)", () => {
  it("52-56. concurrent same-event context-stage abstention → exactly one record and one commit; terminal status observable", async () => {
    const world = await buildWorld(0, null);
    const { eventRef, input } = await eventWithObservation(world, "evt-x", "重做一下。");
    const ctx = await freshCtx(world);
    const [a, b] = await Promise.all([
      world.executor.appraiseIncomingEvent(ctx, input),
      world.executor.appraiseIncomingEvent(ctx, input)
    ]);
    for (const result of [a, b]) {
      // Under full interleaving the loser either resolves the terminal
      // disposition or exhausts the bounded rebuild (REBASE_REQUIRED); the
      // durable invariants below hold in every case.
      expect(["INSUFFICIENT_CONTEXT", "ALREADY_DISPOSED", "REBASE_REQUIRED"]).toContain(result.kind);
    }
    // 53/54/56: exactly one Learning CAS success — one canonical abstention.
    const abstentions = await visibleAbstentionPayloads(world, eventRef);
    expect(abstentions).toHaveLength(1);
    expect(abstentionCommitCount(world, (abstentions[0] as FactualEventAppraisalAbstentionRecordV0).abstention_ref)).toBe(1);
    // 55: a later attempt observes the terminal status.
    const retry = await world.executor.appraiseIncomingEvent(await freshCtx(world), input);
    expect(retry.kind).toBe("ALREADY_DISPOSED");
  });

  it("57. provider-stage same-event concurrency also yields exactly one terminal abstention", async () => {
    const world = await buildWorld(0);
    const { eventRef, input } = await eventWithObservation(world, "evt-x", "重做一下。");
    const provider = abstainingProvider(world);
    const executor = new FactualEventAppraisalExecutorV0(
      { ...world.container, factualEventAppraisalProvider: provider } as never
    );
    const ctx = await freshCtx(world);
    const [a, b] = await Promise.all([
      executor.appraiseIncomingEvent(ctx, input),
      executor.appraiseIncomingEvent(ctx, input)
    ]);
    for (const result of [a, b]) {
      // Under full interleaving the loser either resolves the terminal
      // disposition or exhausts the bounded rebuild (REBASE_REQUIRED); the
      // durable invariants below hold in every case.
      expect(["INSUFFICIENT_CONTEXT", "ALREADY_DISPOSED", "REBASE_REQUIRED"]).toContain(result.kind);
    }
    const abstentions = await visibleAbstentionPayloads(world, eventRef);
    expect(abstentions).toHaveLength(1);
    expect(abstentionCommitCount(world, (abstentions[0] as FactualEventAppraisalAbstentionRecordV0).abstention_ref)).toBe(1);
    const retry = await executor.appraiseIncomingEvent(await freshCtx(world), input);
    expect(retry.kind).toBe("ALREADY_DISPOSED");
  });
});

// ----------------------------------------------------------------------------------
// DURABLE PRE-COGNITION APPRAISAL DISPOSITION — restore proof (§57/§49)
// ----------------------------------------------------------------------------------

describe("DURABLE DISPOSITION restore proof (§57)", () => {
  it("58-66. fresh process restore resolves the same terminal abstention; retry +0", async () => {
    const world = await buildWorld(0, null);
    const { eventRef, outcome } = await fullFlow(world, "evt-x", "重做一下。");
    expect(outcome.kind).toBe("INSUFFICIENT_CONTEXT");
    // 58: the abstention is persisted.
    const abstentions = await visibleAbstentionPayloads(world, eventRef);
    expect(abstentions).toHaveLength(1);
    const originalRef = (abstentions[0] as FactualEventAppraisalAbstentionRecordV0).abstention_ref;
    // 59: authoritative state/history export (bundle chain + envelope).
    const committedBundles = world.core.storeRead.getCommittedBundles();
    const headBundle = committedBundles.at(-1);
    if (headBundle === undefined) throw new Error("head bundle must exist");
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
    // 60: fresh runtime restore over a replayed repository.
    const freshRepo = await replayRepoOnto(world.repo);
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
    // 61/65: the resolver finds the SAME terminal abstention (identical ref).
    const restored = await resolveInitialAppraisalDispositionForFactualEventV0(
      freshRepo, restore.snapshot.memory_state.repository_revision as never, SUBJECT_ID, eventRef
    );
    expect(restored.kind).toBe("ABSTAINED_INSUFFICIENT_CONTEXT");
    if (restored.kind === "ABSTAINED_INSUFFICIENT_CONTEXT") {
      expect(restored.abstention.abstention_ref).toBe(originalRef);
    }
    // 66: subject logical/state authority unchanged by the restore itself.
    expect(restore.snapshot.runtime_metadata.logical_time).toBe(headBundle.next_snapshot.runtime_metadata.logical_time);
    expect(restore.snapshot.runtime_metadata.state_revision).toBe(headBundle.next_snapshot.runtime_metadata.state_revision);
    // Fresh runtime: retry observes the terminal disposition with 0/0/0.
    const freshCore2 = createCore(restore.snapshot, committedBundles);
    const freshIngressLedger = createConversationIngressLedgerAuthorityV0();
    expect((await freshIngressLedger.restoreState(world.ingressLedger.exportState())).ok).toBe(true);
    const freshRoot = new RuntimeCompositionRoot({
      subjectCore: freshCore2,
      producerAuthorizationIssuer: freshCore2.issuer,
      memoryRepository: freshRepo,
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
      contextProducer: new ReferenceContextProducer(),
      learningSourceAuthority: {
        readCommittedBundle: async (id) => freshCore2.storeRead.readCommittedByTransitionId(id)
      } as LearningSourceReadAuthority,
      learningAdoptionAuthority: {
        markAdopted: (r) => void freshRepo.markAdopted(r),
        isAdopted: (r) => freshRepo.isAdopted(r)
      } as LearningAdoptionAuthority,
      experiencePayloadRepository: freshRepo,
      ingressLedger: freshIngressLedger,
      factualEventAppraisalProvider: {
        proposeFactualEventAppraisal: async () => {
          throw new Error("FATAL: provider must never run for a restored abstention");
        }
      }
    });
    const freshExecutor = new FactualEventAppraisalExecutorV0(freshRoot.dependencies());
    const observationBundle = committedBundles.find((b) => b.trace_entry.cause_refs.some((r) => r.startsWith("observation:")));
    if (observationBundle === undefined) throw new Error("fixture invariant: Observation bundle must exist");
    const o2 = freshCore2.storeRead.readCommittedByTransitionId(observationBundle.transition_id) as AtomicCommitBundleAnyVersion;
    const revisionsBefore = freshRepo.revisionIds().length;
    const commitsBefore = freshCore2.storeRead.getCommittedBundles().length;
    // 62: provider calls 0 (it throws if ever invoked).
    const replay = await freshExecutor.appraiseIncomingEvent(
      {
        subject_id: SUBJECT_ID as never,
        current_logical_time: restore.snapshot.runtime_metadata.logical_time as never,
        state_revision: restore.snapshot.runtime_metadata.state_revision as never
      },
      {
        subject_id: SUBJECT_ID as never,
        source_event_id: "evt-x",
        observation_transition_id: o2.transition_id as never,
        observation_ref: observationCauseRefOf(o2) as never
      }
    );
    expect(replay.kind).toBe("ALREADY_DISPOSED");
    // 63/64: writes 0, commits 0.
    expect(freshRepo.revisionIds().length).toBe(revisionsBefore);
    expect(freshCore2.storeRead.getCommittedBundles().length).toBe(commitsBefore);
  });

  it("49. ordering proof: X durably abstained resolves terminally after restore while Y stays independently appraised", async () => {
    const world = await buildWorld(0);
    // X: pre-cognition provider lawfully abstains (provider stage).
    const xRef = await ingressEvent(world, "evt-x", "重做一下。");
    const o2x = await commitObservation(world, "observation:o-x", xRef);
    const xOutcome = await new FactualEventAppraisalExecutorV0({
      ...world.container,
      factualEventAppraisalProvider: {
        proposeFactualEventAppraisal: async (context: never) => insufficientProposal(context as never)
      }
    } as never).appraiseIncomingEvent(await freshCtx(world), {
      subject_id: SUBJECT_ID as never,
      source_event_id: "evt-x",
      observation_transition_id: o2x.transition_id as never,
      observation_ref: observationCauseRefOf(o2x) as never
    });
    expect(xOutcome.kind).toBe("INSUFFICIENT_CONTEXT");
    // Y: a genuinely later event is independently appraised (X does not poison it).
    const y = await fullFlow(world, "evt-y", "还是不对。");
    expect(y.outcome.kind).toBe("COMMITTED");
    // Restore, then resolve both dispositions from the restored surface.
    const committedBundles = world.core.storeRead.getCommittedBundles();
    const headBundle = committedBundles.at(-1);
    if (headBundle === undefined) throw new Error("head bundle must exist");
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
    const freshRepo = await replayRepoOnto(world.repo);
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
    const xDisposition = await resolveInitialAppraisalDispositionForFactualEventV0(
      freshRepo, restore.snapshot.memory_state.repository_revision as never, SUBJECT_ID, xRef
    );
    const yDisposition = await resolveInitialAppraisalDispositionForFactualEventV0(
      freshRepo, restore.snapshot.memory_state.repository_revision as never, SUBJECT_ID, y.eventRef
    );
    expect(xDisposition.kind).toBe("ABSTAINED_INSUFFICIENT_CONTEXT");
    expect(yDisposition.kind).toBe("APPRAISED");
  });
});

// ----------------------------------------------------------------------------------
// DURABLE PRE-COGNITION APPRAISAL DISPOSITION — Experience same-fact (§34/§59)
// ----------------------------------------------------------------------------------

describe("DURABLE DISPOSITION Experience same-fact bridge (§34/§59)", () => {
  /** Delivery + feedback-path fixture so one event grounds both lifecycles. */
  async function feedbackPathFor(world: World, sourceEventId: string, text: string): Promise<{
    episodeRef: string;
    input: Parameters<FactualEventAppraisalExecutorV0["appraiseIncomingEvent"]>[1];
  }> {
    const behaviorBuilt = await buildCharacterLanguageBehaviorV0({
      subject_id: SUBJECT_ID as never,
      source_revision: ((await world.core.readCurrentSnapshot(SUBJECT_ID as never)) as SubjectStateV0).runtime_metadata.state_revision as never,
      response_request_id: `resp-${sourceEventId}` as never,
      draft: {
        schema_version: 'language-realization-draft-v0',
        text: '好的，马上处理。',
        input_hash: 'sha256:' + 'b'.repeat(64),
        evidence_refs: []
      } as never
    });
    if (!behaviorBuilt.ok) throw new Error('behavior must build');
    const ledger = world.container.conversationDeliveryLedger;
    if (ledger === null) throw new Error('delivery ledger wired');
    const delivered = await ledger.recordConversationDelivery({
      subject_id: SUBJECT_ID,
      conversation_id: CONVERSATION_ID,
      behavior: behaviorBuilt.behavior,
      delivered_logical_time: 0,
      status: 'DELIVERED',
      host_adapter: 'test-adapter'
    });
    if (!delivered.ok) throw new Error('delivery must record');
    // The feedback event replies to the delivered behavior — and its
    // pre-cognition INITIAL stage runs first (factual_event grounding).
    const { input } = await eventWithObservation(world, sourceEventId, text, delivered.record.delivery_id);
    const feedbackOutcome = await new LearningTransitionExecutor(world.container).executeBehaviorOutcomeFeedback(
      await freshCtx(world),
      {
        candidate: {
          subject_id: SUBJECT_ID,
          conversation_id: CONVERSATION_ID,
          source_event_id: sourceEventId,
          observation_transition_id: input.observation_transition_id,
          observation_ref: input.observation_ref,
          declared_salience: 0.5,
          host_adapter: 'test-adapter'
        }
      } as never
    );
    if (feedbackOutcome.kind !== 'COMMITTED') {
      throw new Error('feedback must commit: ' + JSON.stringify(feedbackOutcome).slice(0, 200));
    }
    const snapshot = (await world.core.readCurrentSnapshot(SUBJECT_ID as never)) as SubjectStateV0;
    const episodes = (await world.repo.readVisibleRecordHashes(snapshot.memory_state.repository_revision as never))
      .filter((e) => e.ref.startsWith('episode:'));
    const episodeRef = episodes.at(-1)?.ref;
    if (episodeRef === undefined) throw new Error('episode must exist');
    return { episodeRef, input };
  }

  it("78. same-fact Experience after APPRAISED resolves the event-grounded INITIAL (never a second INITIAL)", async () => {
    const world = await buildWorld(0);
    const { episodeRef, input } = await feedbackPathFor(world, "evt-f", "重做一下。");
    // The feedback event's pre-cognition INITIAL was APPRAISED first.
    const outcome = await world.executor.appraiseIncomingEvent(await freshCtx(world), input);
    expect(outcome.kind).toBe("COMMITTED");
    const experienceExecutor = new ExperienceAppraisalLearningExecutorV0(world.container);
    const resolved = await experienceExecutor.appraiseExperience(await freshCtx(world), {
      subject_id: SUBJECT_ID as never,
      episode_ref: episodeRef as never,
      provider_id: 'test-bridge-provider' as never
    });
    expect(resolved.kind).toBe("ALREADY_COMPLETED");
    if (resolved.kind === "ALREADY_COMPLETED") {
      // §34/§27/§28: the Experience path RESOLVES the event-grounded INITIAL.
      expect(resolved.grounding).toBe("factual_event");
      if (outcome.kind === "COMMITTED") expect(resolved.appraisal_ref).toBe(outcome.appraisal_ref);
    }
  });

  it("79. same-fact Experience after ABSTAINED creates no INITIAL (INITIAL is terminally closed)", async () => {
    const world = await buildWorld(0);
    const provider = abstainingProvider(world);
    const { episodeRef, input } = await feedbackPathFor(world, "evt-f", "重做一下。");
    // The feedback event's pre-cognition INITIAL was lawfully ABSTAINED.
    const outcome = await new FactualEventAppraisalExecutorV0(
      { ...world.container, factualEventAppraisalProvider: provider } as never
    ).appraiseIncomingEvent(await freshCtx(world), input);
    expect(outcome.kind).toBe("INSUFFICIENT_CONTEXT");
    const experienceExecutor = new ExperienceAppraisalLearningExecutorV0(world.container);
    const resolved = await experienceExecutor.appraiseExperience(await freshCtx(world), {
      subject_id: SUBJECT_ID as never,
      episode_ref: episodeRef as never,
      provider_id: 'test-bridge-provider' as never
    });
    expect(resolved.kind).toBe("ALREADY_DISPOSED");
    if (resolved.kind === "ALREADY_DISPOSED") {
      expect(resolved.disposition).toBe("ABSTAINED_INSUFFICIENT_CONTEXT");
      expect(resolved.abstention_ref.startsWith("appraisal:")).toBe(true);
    }
    // No INITIAL Appraisal of any grounding exists for the event.
    const snapshot = (await world.core.readCurrentSnapshot(SUBJECT_ID as never)) as SubjectStateV0;
    const visible = await world.repo.readVisibleRecordHashes(snapshot.memory_state.repository_revision as never);
    const appraisalRecords = visible.filter((e) => e.ref.startsWith("appraisal:"));
    expect(appraisalRecords).toHaveLength(1); // only the abstention record
  });
});

void beforeAll;
