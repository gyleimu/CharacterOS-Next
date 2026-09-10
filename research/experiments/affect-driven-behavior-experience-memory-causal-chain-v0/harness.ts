/* eslint-disable no-restricted-imports, @typescript-eslint/no-non-null-assertion -- Isolated causal-chain experiment harness over frozen built production roots; deterministic downstream lifecycle, bounded real generation. */

import type {
  AtomicCommitBundleAnyVersion,
  SubjectStateV4
} from "../../../packages/subject-core/dist/index.js";
import {
  proposalFingerprint
} from "../../../packages/subject-core/dist/index.js";
import {
  computeRepositoryRevisionHash,
  createEpisodeContentReaderV0,
  createMemoryPreparationAuthority,
  InMemoryMemoryRepository,
  RepositoryBackedMemoryRetrievalServiceV0,
  type MemoryRetrievalQueryV0
} from "../../../packages/memory/dist/index.js";
import {
  createSubjectStateV4AuthoritativeRestoreEnvelopeV0,
  restoreSubjectStateV4AuthoritativelyV0
} from "../../../packages/runtime/dist/authority/restore-chain-authority-v4.js";
import {
  mintTrustedCanonicalHistoryBoundaryV4V0
} from "../../../packages/runtime/dist/authority/trusted-canonical-history-boundary.js";
import {
  BoundedAffectTimeProducerV0
} from "../../../packages/runtime/dist/producers/bounded-affect-time-producer-v0.js";
import {
  ReferenceRegulationV0Producer
} from "../../../packages/runtime/dist/producers/reference-regulation-v0-producer.js";
import {
  buildV4TimeProposal
} from "../../../packages/runtime/dist/transitions/time/canonical-affect-v4-time-transition-executor-v0.js";
import {
  buildCognitiveContextProjectionV2ForExplicitV4,
  CognitionActionTransitionExecutor
} from "../../../packages/runtime/dist/transitions/cognition-action/cognition-action-transition-executor.js";
import { FactualMemoryEvidenceResolverV0 } from "../../../packages/runtime/dist/transitions/cognition-action/factual-memory-evidence.js";
import { LearningTransitionExecutor } from "../../../packages/runtime/dist/transitions/learning/learning-transition-executor.js";
import {
  createConversationDeliveryLedgerAuthorityV0
} from "../../../packages/runtime/dist/index.js";
import type {
  ConversationDeliveryLedgerAuthority
} from "../../../packages/runtime/dist/transitions/conversation/behavior-delivery-ledger.js";
import { createConversationIngressLedgerAuthorityV0 } from "../../../packages/runtime/dist/transitions/conversation/conversation-ingress-ledger.js";
import { observationInput, observationCauseRefOf } from "../../../packages/runtime/dist/transitions/observation/observation-fixtures.js";
import { buildContextDelta } from "../../../packages/runtime/dist/ports/context-producer-port.js";
import { buildObservationProposal } from "../../../packages/runtime/dist/transitions/observation/observation-transition-executor.js";
import {
  CURRENT_DIMENSIONS
} from "../canonical-affect-behavior-influence-v1/contract.ts";
import {
  admitEvent,
  appraiseAdmitted,
  applyAffect,
  buildWorld,
  currentBindings,
  readSnapshot,
  type World
} from "../canonical-affect-behavior-influence-v1/harness.ts";
import {
  canonicalJson,
  check,
  equal,
  hashJson,
  round
} from "./fixtures.ts";
import {
  COUNTERPART_POLICY,
  FUTURE_SCENARIO,
  SUBJECT,
  TIME_EQUALIZATION,
  type Arm,
  type ScenarioV0
} from "./contract.ts";

export { buildWorld, readSnapshot };

function ctxOf(snapshot: SubjectStateV4) {
  return {
    subject_id: SUBJECT as never,
    current_logical_time: snapshot.runtime_metadata.logical_time as never,
    state_revision: snapshot.runtime_metadata.state_revision as never
  };
}

/** §8/§10 — lawful current-scenario history on an explicit-v4 subject:
 * prior event (goal_congruence 1 vs 0 per arm) → AffectApplication; governed
 * scenario Context commit; current scenario event → identical Appraisal →
 * identical AffectApplication (u_v = 0 at goal_congruence 0.5). */
export async function constructArmHistory(world: World, arm: TreatmentArm, scenario: ScenarioV0): Promise<{
  readonly subject_state_hash: string;
  readonly current_event_ref: string;
  readonly current_appraisal_ref: string;
  readonly current_appraisal_dimensions: unknown;
  readonly history_proof: unknown;
}> {
  const prior = await admitEvent(world, "v1-prior-event", "Please revise the item once.");
  world.dimensionOverrides.set(prior.event_ref, {
    relevance: 1,
    goal_congruence: arm === "A" ? 1 : 0,
    intensity: 1
  });
  await appraiseAdmitted(world, "v1-prior-event", prior);
  await applyAffect(world, prior.event_ref);

  // Governed scenario Context commit (scene/task enter canonical state).
  const snapshot = await readSnapshot(world);
  const contextProposal = {
    schema_version: "canonical-transition-proposal-v1",
    transition_id: `t-context-${scenario.event_id}`,
    subject_id: snapshot.identity.subject_id,
    transition_type: "Observation",
    expected_state_revision: snapshot.runtime_metadata.state_revision,
    time_input: {
      kind: "OCCURRENCE",
      occurrence_logical_time: snapshot.runtime_metadata.logical_time
    },
    cause_refs: [],
    domain_deltas: [{
      producer: "context",
      domain: "context",
      expected_repository_revision: null,
      operations: [{
        path: "/context",
        value: {
          scene: scenario.current_factual_event,
          task: scenario.current_task,
          focus_refs: [...snapshot.context.focus_refs],
          active_entity_refs: [...snapshot.context.active_entity_refs],
          environment_refs: [...snapshot.context.environment_refs],
          current_observation_ref: snapshot.context.current_observation_ref
        }
      }],
      provenance_refs: []
    }],
    external_refs: []
  } as unknown as Parameters<World["assembly"]["facade"]["reserveAndRoute"]>[0];
  const reserved = await world.assembly.facade.reserveAndRoute(contextProposal);
  check(reserved.kind === "CONTINUE", `${scenario.scenario_id}: context reservation failed`);
  const committed = await world.assembly.facade.commitReserved({
    proposal: contextProposal,
    continuation: reserved.continuation,
    producerAuthorization: world.issuer.issue([{ producer: "context", domain: "context" }]) as never,
    preparedBinding: {
      prepared_result_ref: `workflow:w-context-${scenario.event_id}` as never,
      transition_id: contextProposal.transition_id,
      subject_id: contextProposal.subject_id,
      transition_type: contextProposal.transition_type,
      payload_fingerprint: await proposalFingerprint(contextProposal)
    },
    repository_bindings: await currentBindings(world.repo, snapshot) as never
  });
  check(committed.kind === "COMMITTED", `${scenario.scenario_id}: context commit failed`);

  const current = await admitEvent(world, scenario.event_id, scenario.current_factual_event);
  const currentAppraisalRef = await appraiseAdmitted(world, scenario.event_id, current);
  await applyAffect(world, current.event_ref);
  const finalSnapshot = await readSnapshot(world);
  return {
    subject_state_hash: hashJson(finalSnapshot),
    current_event_ref: current.event_ref,
    current_appraisal_ref: currentAppraisalRef,
    current_appraisal_dimensions: { ...CURRENT_DIMENSIONS },
    history_proof: {
      path: ["factual event", "Observation", "canonical INITIAL Appraisal", "AffectApplication", "durable CanonicalAffectV0"],
      prior_goal_congruence: arm === "A" ? 1 : 0,
      committed_bundle_count: world.assembly.storeRead.getCommittedBundles().length
    }
  };
}

/** §23/§24 — lawful Affect equalization: one v4 TimeTransition of 1500 ticks
 * (10 tau) drives both subjects' valence to ≈ ∓1.1e-5 and activation to
 ≈ 0.2000007 under the FROZEN dynamics. No manual patching. */
export async function equalizeAffect(world: World): Promise<{ readonly valence_before: number; readonly valence_after: number; readonly activation_after: number }> {
  const snapshot = await readSnapshot(world);
  const affectDelta = await new BoundedAffectTimeProducerV0().produceCanonicalAffectTimeDelta({
    current_affect: snapshot.affect,
    elapsed_ticks: TIME_EQUALIZATION.ticks
  });
  const regulationDelta = await new ReferenceRegulationV0Producer().produceRegulationDelta({
    context: ctxOf(snapshot),
    regulation: snapshot.regulation,
    elapsed_ticks: TIME_EQUALIZATION.ticks
  });
  const proposal = {
    schema_version: "canonical-transition-proposal-v1",
    transition_id: `t-time-equalize-r${snapshot.runtime_metadata.state_revision}-${TIME_EQUALIZATION.ticks}`,
    subject_id: snapshot.identity.subject_id,
    transition_type: "Time",
    expected_state_revision: snapshot.runtime_metadata.state_revision,
    time_input: {
      kind: "ELAPSED",
      elapsed_time: { value: TIME_EQUALIZATION.ticks, unit: "tick" }
    },
    cause_refs: [],
    domain_deltas: [affectDelta, regulationDelta],
    external_refs: []
  } as unknown as Parameters<World["assembly"]["facade"]["reserveAndRoute"]>[0];
  const reserved = await world.assembly.facade.reserveAndRoute(proposal);
  check(reserved.kind === "CONTINUE", `time reservation failed: ${reserved.kind}`);
  const outcome = await world.assembly.facade.commitReserved({
    proposal,
    continuation: reserved.continuation,
    producerAuthorization: world.issuer.issue([
      { producer: "affect", domain: "affect" },
      { producer: "regulation", domain: "regulation" }
    ]) as never,
    preparedBinding: {
      prepared_result_ref: `workflow:w-time-eq-r${snapshot.runtime_metadata.state_revision}` as never,
      transition_id: proposal.transition_id,
      subject_id: proposal.subject_id,
      transition_type: proposal.transition_type,
      payload_fingerprint: await proposalFingerprint(proposal)
    },
    repository_bindings: await currentBindings(world.repo, snapshot) as never
  });
  check(outcome.kind === "COMMITTED", `time must commit: ${outcome.kind}`);
  const after = (outcome.bundle.next_snapshot as SubjectStateV4).affect;
  return {
    valence_before: snapshot.affect.valence,
    valence_after: after.valence,
    activation_after: after.activation
  };
}

/** §34 — authoritative v4 restore of the whole life; returns fresh runtime. */
export async function restoreWorld(world: World): Promise<{
  readonly assembly: InMemoryFacadeAssembly<SubjectStateV4>;
  readonly repo: InMemoryMemoryRepository;
  readonly issuer: ProducerAuthorizationIssuer;
  readonly deliveryLedger: ConversationDeliveryLedgerAuthority;
  readonly ingressLedger: ReturnType<typeof createConversationIngressLedgerAuthorityV0>;
}> {
  const bundles = world.assembly.storeRead.getCommittedBundles()
    .filter((bundle) => bundle.subject_id === SUBJECT) as unknown as readonly AtomicCommitBundleAnyVersion[];
  const headBundle = bundles.at(-1);
  check(headBundle !== undefined, "restore head bundle missing");
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
      return manifest !== null &&
        (await computeRepositoryRevisionHash(manifest)) === binding.repository_revision_hash;
    }
  });
  check(minted.kind === "MINTED", `restore boundary failed: ${minted.kind}`);
  const headBinding = (await currentBindings(world.repo, headBundle.next_snapshot as unknown as SubjectStateV4))[0];
  check(headBinding !== undefined, "restore repository binding missing");
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
    check(manifest !== null, `restore manifest ${revision} missing`);
    const entries = [];
    for (const entry of manifest!.record_hashes) {
      const payload = world.repo.readStoredPayload(entry.ref as never);
      check(payload !== undefined, `restore payload ${entry.ref} missing`);
      entries.push({ ref: entry.ref, payload_hash: await freshRepo.storePayload(entry.ref as never, payload) });
    }
    await freshRepo.prepareRevision({
      parent_revision: manifest!.parent_revision as never,
      records: entries as never
    });
  }
  const restored = await restoreSubjectStateV4AuthoritativelyV0({
    envelope: envelope as never,
    trusted_boundary: minted.receipt,
    bundles,
    reference_validator: async (binding) => freshRepo.validateRevisionBinding(binding as never)
  });
  check(restored.kind === "RESTORED", `restore failed: ${restored.kind}`);
  const freshAssembly = (await import(
    "../../../packages/subject-core/dist/index.js"
  )).createInMemorySubjectCoreFacadeForExplicitV4V0({
    seedSnapshots: new Map([[SUBJECT as never, restored.snapshot as never]]),
    seedBundles: bundles as never,
    referenceValidator: async (binding) => freshRepo.validateRevisionBinding(binding as never),
    preparedResultValidator: async () => true,
    memoryAdoptionValidator: async () => true
  });
  const freshDeliveryLedger = createConversationDeliveryLedgerAuthorityV0();
  const freshIngressLedger = createConversationIngressLedgerAuthorityV0();
  const worldLedger = (world as { deliveryLedger?: ConversationDeliveryLedgerAuthority }).deliveryLedger;
  check(worldLedger !== undefined, "delivery ledger must exist on world");
  check((await freshDeliveryLedger.restoreState(worldLedger.exportState())).ok, "delivery ledger restore failed");
  check((await freshIngressLedger.restoreState(world.ingressLedger.exportState())).ok, "ingress ledger restore failed");
  return {
    assembly: freshAssembly,
    repo: freshRepo,
    issuer: freshAssembly.producerAuthorizationIssuer,
    deliveryLedger: freshDeliveryLedger,
    ingressLedger: freshIngressLedger
  };
}

/** §27 — future observation through the frozen repository-backed retrieval
 * service: the life's own feedback episode enters working refs via the SAME
 * retrieval path production uses (never a hand-pinned ref). */
export async function commitFutureObservation(
  restored: {
    readonly assembly: InMemoryFacadeAssembly<SubjectStateV4>;
    readonly repo: InMemoryMemoryRepository;
    readonly issuer: ProducerAuthorizationIssuer;
  },
  futureEventText: string,
  futureEventId: string
): Promise<{ readonly working_episode_refs: readonly string[] }> {
  const retrievalService = new RepositoryBackedMemoryRetrievalServiceV0(restored.repo);
  const snapshot = await readSnapshotV4(restored.assembly);
  const observation = observationInput({
    observation_id: `observation:o-${futureEventId}`,
    source_refs: ["source:s-3"],
    entity_refs: ["entity:alice", "subject:s0"],
    occurrence_logical_time: snapshot.runtime_metadata.logical_time
  });
  const contextDelta = await buildContextDelta(observation, snapshot as never);
  const revision = snapshot.memory_state.repository_revision as never;
  const query: MemoryRetrievalQueryV0 = {
    schema_version: "memory-retrieval-query-v0" as never,
    subject_id: SUBJECT as never,
    repository_revision: revision,
    semantic_reference: snapshot.context.current_observation_ref as never,
    temporal: { now_logical_time: snapshot.runtime_metadata.logical_time as never, window_start: null },
    entity_refs: [...snapshot.context.active_entity_refs].sort() as never,
    relationship_refs: [] as never,
    current_context_refs: [...snapshot.context.focus_refs].sort() as never,
    salience_constraints: { min_declared_score: null, max_candidates: 8 }
  };
  const retrievalResult = await retrievalService.retrieve(query);
  const selected = [...retrievalResult.selected_memory_refs];
  const traceRefs = retrievalResult.retrieval_trace_ref === null ? [] : [retrievalResult.retrieval_trace_ref as string];
  const lastRetrievalAt = snapshot.runtime_metadata.logical_time as never;
  const memoryDelta = {
    producer: "memory",
    domain: "memory-retrieval",
    expected_repository_revision: snapshot.memory_state.repository_revision,
    // set-like ops sorted by path (§5.1 rule); the trace ring carries
    // retrieval-trace refs while working_refs carries the selected episodes.
    operations: [
      { path: "/memory_state/last_retrieval_at", value: lastRetrievalAt },
      { path: "/memory_state/recent_retrieval_trace", value: traceRefs },
      { path: "/memory_state/working_refs", value: selected }
    ],
    provenance_refs: []
  };
  const proposal = await buildObservationProposal({
    subjectId: SUBJECT,
    stateRevision: snapshot.runtime_metadata.state_revision as number,
    observation,
    deltas: [contextDelta, memoryDelta]
  });
  const reserved = await restored.assembly.facade.reserveAndRoute(proposal);
  check(reserved.kind === "CONTINUE", `future observation reservation: ${reserved.kind}`);
  const outcome = await restored.assembly.facade.commitReserved({
    proposal,
    continuation: reserved.continuation,
    producerAuthorization: restored.issuer.issue([
      { producer: "context", domain: "context" },
      { producer: "memory", domain: "memory-retrieval" }
    ]) as never,
    preparedBinding: {
      prepared_result_ref: `workflow:w-future-obs-${futureEventId}` as never,
      transition_id: proposal.transition_id,
      subject_id: proposal.subject_id,
      transition_type: proposal.transition_type,
      payload_fingerprint: await proposalFingerprint(proposal)
    },
    repository_bindings: await currentBindings(restored.repo, snapshot) as never
  });
  check(outcome.kind === "COMMITTED", `future observation must commit: ${JSON.stringify(outcome).slice(0, 200)}`);
  void futureEventText;
  const workingEpisodeRefs = selected.filter((ref) => ref.startsWith("episode:"));
  return { working_episode_refs: workingEpisodeRefs };
}

async function readSnapshotV4(assembly: InMemoryFacadeAssembly<SubjectStateV4>): Promise<SubjectStateV4> {
  const snapshot = await assembly.facade.readCurrentSnapshot(SUBJECT as never);
  check(snapshot !== null, "snapshot must exist");
  return snapshot as SubjectStateV4;
}

/** §20/§25 — future cognition input through the frozen CognitionAction
 * executor with the PRODUCTION factual-evidence resolver wired; the provider
 * is a capturing fake (zero real future calls). */
export async function buildFutureCognitionInput(
  restored: {
    readonly assembly: InMemoryFacadeAssembly<SubjectStateV4>;
    readonly repo: InMemoryMemoryRepository;
    readonly issuer: ProducerAuthorizationIssuer;
    readonly deliveryLedger: ConversationDeliveryLedgerAuthority;
    readonly ingressLedger: ReturnType<typeof createConversationIngressLedgerAuthorityV0>;
  },
  captured: unknown[]
): Promise<unknown> {
  const resolver = new FactualMemoryEvidenceResolverV0({
    reader: (await import(
      "../../../packages/runtime/dist/transitions/conversation/experience-reader.js"
    )).createExperienceReaderV0({
      repository: restored.repo,
      deliveryLedger: restored.deliveryLedger
    }),
    episodeContentReader: createEpisodeContentReaderV0(restored.repo)
  } as never);
  const minter = (await import(
    "../../../packages/runtime/dist/micl/micl-capabilities.js"
  )).createMiclStageMinter(restored.assembly.facade as never, new (await import(
    "../../../packages/runtime/dist/micl/micl-workflow-store.js"
  )).InMemoryMiclWorkflowStore(), {
    micl_id: "micl-future-cog-chain" as never,
    micl_request_fingerprint: "sha256:affect-chain-future" as never,
    stage_key: "OBSERVATION" as never
  });
  const executor = new CognitionActionTransitionExecutor({
    cognitionProvider: {
      propose: async (projection: unknown) => {
        captured.push(projection);
        return {
          schema_version: "cognition-proposal-v0",
          projection_hash: (projection as { projection_hash: string }).projection_hash,
          reasoning_summary: "future cognition capture",
          relevant_memory_refs: [],
          considered_context_refs: [],
          current_intent: null,
          confidence: 0.5,
          uncertainty: 0.5,
          action_intent: null,
          evidence_refs: []
        };
      }
    },
    subjectCore: minter.core() as never,
    retrieval: {
      retrieve: async () => {
        throw new Error("EXPERIMENT: future cognition must not call retrieval again");
      }
    },
    factualEvidenceResolver: resolver as never,
    producerAuthorizationIssuer: restored.issuer
  } as never);
  const snapshot = await readSnapshotV4(restored.assembly);
  await executor.execute(
    ctxOf(snapshot),
    { cause_refs: [], allowed_actions: [] } as never,
    minter.capabilities(await currentBindings(restored.repo, snapshot)) as never
  );
  check(captured.length === 1, "future cognition provider input must be captured once");
  return captured[0];
}

/** §13-§17 — the full behavior-linked consequence chain on the SAME world:
 * delivery → counterpart reply (deterministic, treatment-blind) → linked
 * reply ingress → reply Observation → behavior-outcome feedback → Experience
 * → Learning → durable Memory commit. */
export async function runConsequenceChain(
  world: World,
  scenario: ScenarioV0,
  behaviorText: string,
  behavior: unknown
): Promise<{
  readonly delivery_id: string;
  readonly reply_text: string;
  readonly reply_event_ref: string;
  readonly reply_observation_ref: string;
  readonly experience_ref: string;
  readonly episode_ref: string;
  readonly event_ref: string;
  readonly revision_before: string;
  readonly revision_after: string;
}> {
  // One delivery ledger per world (host-owned delivery authority).
  const worldAny = world as { deliveryLedger?: ConversationDeliveryLedgerAuthority };
  if (worldAny.deliveryLedger === undefined) {
    worldAny.deliveryLedger = createConversationDeliveryLedgerAuthorityV0();
  }
  const deliveryLedger = worldAny.deliveryLedger;
  const container = buildFeedbackContainer(world);
  const ingressLedger = world.ingressLedger;

  // §16 — delivery through the frozen host delivery authority.
  const deliveryOutcome = await deliveryLedger.recordConversationDelivery({
    subject_id: SUBJECT,
    conversation_id: "conv-affect-chain-v0",
    behavior: behavior as never,
    delivered_logical_time: (await readSnapshot(world)).runtime_metadata.logical_time as never,
    status: "DELIVERED",
    host_adapter: "experiment-adapter"
  });
  check(deliveryOutcome.ok, `delivery must record: ${deliveryOutcome.ok ? "" : deliveryOutcome.detail}`);
  const deliveryId = deliveryOutcome.record.delivery_id;

  // §13/§15 — treatment-blind deterministic counterpart reply.
  const replyText = counterpartReply(behaviorText);

  // §17 — linked reply ingress (references the delivered behavior).
  const replyIngress = await ingressLedger.recordIngressEvent({
    schema_version: "conversation-ingress-input-v0",
    subject_id: SUBJECT,
    conversation_id: "conv-affect-chain-v0",
    actor_ref: "entity:alice",
    text: replyText,
    logical_time: (await readSnapshot(world)).runtime_metadata.logical_time as never,
    source_event_id: `${scenario.event_id}-reply`,
    in_reply_to_delivery_id: deliveryId,
    host_adapter: "experiment-adapter"
  });
  check(replyIngress.kind === "RECORDED", `reply ingress must record: ${replyIngress.kind}`);

  // Reply Observation commit (v4: context-only; no affect write).
  const snapshot = await readSnapshot(world);
  const observation = observationInput({
    observation_id: `observation:o-${scenario.event_id}-reply`,
    source_refs: [replyIngress.record.event_ref as string, "source:s-3"],
    entity_refs: ["entity:alice", "subject:s0"],
    occurrence_logical_time: snapshot.runtime_metadata.logical_time
  });
  const contextDelta = await buildContextDelta(observation, snapshot as never);
  const proposal = await buildObservationProposal({
    subjectId: SUBJECT,
    stateRevision: snapshot.runtime_metadata.state_revision as number,
    observation,
    deltas: [contextDelta]
  });
  const reserved = await world.assembly.facade.reserveAndRoute(proposal);
  check(reserved.kind === "CONTINUE", `reply observation reservation: ${reserved.kind}`);
  const replyOutcome = await world.assembly.facade.commitReserved({
    proposal,
    continuation: reserved.continuation,
    producerAuthorization: world.issuer.issue([{ producer: "context", domain: "context" }]) as never,
    preparedBinding: {
      prepared_result_ref: `workflow:w-reply-${scenario.event_id}` as never,
      transition_id: proposal.transition_id,
      subject_id: proposal.subject_id,
      transition_type: proposal.transition_type,
      payload_fingerprint: await proposalFingerprint(proposal)
    },
    repository_bindings: await currentBindings(world.repo, snapshot) as never
  });
  check(replyOutcome.kind === "COMMITTED", `reply observation must commit: ${JSON.stringify(replyOutcome).slice(0, 160)}`);

  // §18 — behavior-outcome feedback through the FROZEN authority.
  const revisionBefore = snapshot.memory_state.repository_revision as string;
  const feedbackExecutor = new LearningTransitionExecutor(container);
  const feedbackOutcome = await feedbackExecutor.executeBehaviorOutcomeFeedback(
    ctxOf(await readSnapshot(world)),
    {
      candidate: {
        subject_id: SUBJECT,
        conversation_id: "conv-affect-chain-v0",
        source_event_id: `${scenario.event_id}-reply`,
        observation_transition_id: replyOutcome.bundle.transition_id,
        observation_ref: observationCauseRefOf(replyOutcome.bundle),
        declared_salience: 0.5,
        host_adapter: "experiment-adapter"
      }
    } as never
  );
  check(feedbackOutcome.kind === "COMMITTED", `feedback must commit: ${JSON.stringify(feedbackOutcome).slice(0, 220)}`);
  const revisionAfter = (feedbackOutcome.bundle.next_snapshot.memory_state.repository_revision) as string;
  return {
    delivery_id: deliveryId,
    reply_text: replyText,
    reply_event_ref: replyIngress.record.event_ref as string,
    reply_observation_ref: observationCauseRefOf(replyOutcome.bundle),
    experience_ref: feedbackOutcome.refs.experience_ref,
    episode_ref: feedbackOutcome.refs.episode_ref,
    event_ref: feedbackOutcome.refs.event_ref,
    revision_before: revisionBefore,
    revision_after: revisionAfter
  };
}

function buildFeedbackContainer(world: World): Record<string, unknown> {
  const deliveryLedger = (world as { deliveryLedger?: ConversationDeliveryLedgerAuthority }).deliveryLedger!;
  return {
    subjectCore: world.assembly.facade,
    producerAuthorizationIssuer: world.issuer,
    memoryRepository: world.repo,
    memory: { repository: createMemoryPreparationAuthority(world.repo) },
    experiencePayloadRepository: world.repo,
    learningSourceAuthority: {
      readCommittedBundle: async (id: string) =>
        world.assembly.storeRead.readCommittedByTransitionId(id) as unknown as AtomicCommitBundleAnyVersion | null
    } as never,
    learningAdoptionAuthority: {
      markAdopted: (r: never) => void world.repo.markAdopted(r),
      isAdopted: (r: never) => world.repo.isAdopted(r)
    } as never,
    conversationDeliveryLedger: deliveryLedger,
    conversationIngressLedger: world.ingressLedger,
    retrieval: {
      retrieve: async () => {
        throw new Error("EXPERIMENT: feedback must not call retrieval");
      }
    }
  };
}

/** §14/§15 — frozen deterministic counterpart policy: acknowledges the
 * behavior's own first sentence and answers a question with the concrete
 * detail if one was asked. Treatment-blind: inputs = [behavior.text] only. */
export function counterpartReply(behaviorText: string): string {
  const trimmed = behaviorText.trim();
  check(trimmed.length > 0, "counterpart policy received an empty behavior");
  const firstSentence = trimmed.split(/(?<=[.!?。！？])\s/)[0] ?? trimmed;
  const topic = firstSentence.slice(0, 80).replace(/[.!?。！？]$/, "");
  const asks = trimmed.includes("?") || trimmed.includes("？");
  if (asks) {
    return COUNTERPART_POLICY.question_reply_template.replace("{topic}", topic);
  }
  return COUNTERPART_POLICY.statement_reply_template.replace("{topic}", topic);
}

/** §26 — semantic memory-content difference audit. */
export function experienceSemanticDiff(payloadA: unknown, payloadB: unknown): Record<string, unknown> {
  const a = payloadA as Record<string, unknown>;
  const b = payloadB as Record<string, unknown>;
  const differing: string[] = [];
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (canonicalJson(a[key]) !== canonicalJson(b[key])) differing.push(key);
  }
  return { differing_fields: differing.sort(), equal: differing.length === 0 };
}

/** Unused-import guards for composition helpers re-exported for tests. */
export { CURRENT_DIMENSIONS as CHAIN_CURRENT_DIMENSIONS, FUTURE_SCENARIO as CHAIN_FUTURE_SCENARIO };
