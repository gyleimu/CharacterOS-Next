/**
 * LONG_HORIZON_AUTONOMOUS_SUBJECT_SESSION_V0 — reusable explicit-v4 session authority.
 *
 * The production-side composition previous research harnesses performed by hand.
 * It wires ONLY frozen authorities and exposes lawful lifecycle steps:
 *
 *   advanceTime → admitFactualEvent → commitObservableContext (context + production
 *   retrieval) → respond (production ConversationTextResponseExecutorV1: pre-cognition
 *   Appraisal → cognition → directive → language/clarification) → completePending
 *   LifecycleWork (AffectApplication) → recordDelivery → recordReply (ingress + reply
 *   Observation) → recordBehaviorOutcomeFeedback → completePendingLifecycleWork
 *   (counterpart-reply Appraisal + Affect).
 *
 * It composes; it never bypasses. It owns no Memory/Affect/Belief/Relationship
 * semantics and implements no psychology.
 */

import type {
  AtomicCommitBundleAnyVersion,
  ProducerAuthorizationIssuer,
  SubjectStateV0,
  SubjectStateV4
} from "@characteros-next/subject-core";
import {
  createInMemorySubjectCoreFacadeForExplicitV4V0,
  hashEnvelope,
  materializeSubjectStateV4V0,
  proposalFingerprint
} from "@characteros-next/subject-core";
import type { InMemoryMemoryRepository as MemoryRepository } from "@characteros-next/memory";
import {
  computeRepositoryRevisionHash,
  createEpisodeContentReaderV0,
  InMemoryMemoryRepository,
  RepositoryBackedMemoryRetrievalServiceV0
} from "@characteros-next/memory";
import type { FactualEventAppraisalProviderV0 } from "@characteros-next/appraisal";
import type { CharacterLanguageBehaviorV0 } from "@characteros-next/behavior";
import { RuntimeCompositionRoot } from "../composition/runtime-composition-root.js";
import type { RuntimeDependencyContainer } from "../types/runtime-dependency-container.js";
import type { RuntimeContext } from "../types/runtime-context.js";
import { InMemoryConversationDeliveryLedger, type ConversationDeliveryLedgerAuthority } from "../transitions/conversation/behavior-delivery-ledger.js";
import { InMemoryConversationIngressLedger, type ConversationIngressLedgerAuthority } from "../transitions/conversation/conversation-ingress-ledger.js";
import { ConversationTextResponseExecutorV1, type ConversationResponseTraceV1 } from "../transitions/conversation/conversation-text-response-executor-v1.js";
import { FactualEventAppraisalExecutorV0 } from "../factual-event-appraisal/factual-event-appraisal-executor.js";
import { createCanonicalAffectApplicationV0ForExplicitV4 } from "../transitions/affect-application/affect-application-executor-v0.js";
import { InMemoryAffectEventAuthorityV0 } from "../authority/affect-event-authority-v0.js";
import { LearningTransitionExecutor } from "../transitions/learning/learning-transition-executor.js";
import { observationInput, observationCauseRefOf } from "../transitions/observation/observation-fixtures.js";
import { buildObservationProposal } from "../transitions/observation/observation-transition-executor.js";
import { buildContextDelta } from "../ports/context-producer-port.js";
import { BoundedAffectTimeProducerV0 } from "../producers/bounded-affect-time-producer-v0.js";
import { ReferenceRegulationV0Producer } from "../producers/reference-regulation-v0-producer.js";
import { createMiclStageMinter } from "../micl/micl-capabilities.js";
import { InMemoryMiclWorkflowStore } from "../micl/micl-workflow-store.js";
import { createSubjectStateV4AuthoritativeRestoreEnvelopeV0, restoreSubjectStateV4AuthoritativelyV0 } from "../authority/restore-chain-authority-v4.js";
import { mintTrustedCanonicalHistoryBoundaryV4V0 } from "../authority/trusted-canonical-history-boundary.js";
import type { ModelTransportV0 } from "../transports/model-transport.js";
import type { PendingLifecycleWorkV0, SessionDurableStateV0 } from "./session-contracts-v0.js";

export interface ExplicitV4SessionAuthorityOptionsV0 {
  readonly subject: { readonly subject_id: string; readonly display_name: string; readonly identity_anchors: readonly string[] };
  /** Full v3 source state used by explicit-v4 genesis (host-supplied). */
  readonly v3_source: SubjectStateV0;
  readonly conversationCognitionTransport: ModelTransportV0;
  readonly languageTransport: ModelTransportV0;
  readonly factualEventAppraisalProvider: FactualEventAppraisalProviderV0;
  /** Durable ledgers to adopt (checkpoint restore); omit for a fresh session. */
  readonly deliveryLedger?: ConversationDeliveryLedgerAuthority;
  readonly ingressLedger?: ConversationIngressLedgerAuthority;
}

/** Host-visible facts about one conversation response (no authority tokens). */
export interface SessionResponseResultV0 {
  readonly kind: "OUTPUT_READY" | "FAILED";
  readonly behavior: CharacterLanguageBehaviorV0 | null;
  readonly directive: string | null;
  readonly cognitionTrace: ConversationResponseTraceV1 | null;
  readonly validationStage: string | null;
  readonly validationDetail: string | null;
}

/** One completed unit of mandatory prior-event lifecycle work. */
export interface CompletedLifecycleWorkV0 {
  readonly event_ref: string;
  readonly appraisal_ref: string;
}

type Assembly = ReturnType<typeof createInMemorySubjectCoreFacadeForExplicitV4V0>;

function ctxOf(snapshot: SubjectStateV4): RuntimeContext {
  return {
    subject_id: snapshot.identity.subject_id,
    current_logical_time: snapshot.runtime_metadata.logical_time,
    state_revision: snapshot.runtime_metadata.state_revision
  } as unknown as RuntimeContext;
}

export class ExplicitV4SessionAuthorityV0 {
  private readonly repo: MemoryRepository;
  private readonly assembly: Assembly;
  private readonly issuer: ProducerAuthorizationIssuer;
  private readonly ingressLedger: ConversationIngressLedgerAuthority;
  private readonly deliveryLedger: ConversationDeliveryLedgerAuthority;
  private readonly container: RuntimeDependencyContainer;
  private readonly conversationId: string;
  private readonly genesisEnvelope: unknown;
  private readonly retrieval: RepositoryBackedMemoryRetrievalServiceV0;
  private readonly appraisalExecutor: FactualEventAppraisalExecutorV0;
  private readonly affectWriter: ReturnType<typeof createCanonicalAffectApplicationV0ForExplicitV4>;
  private pending: PendingLifecycleWorkV0[] = [];
  private subjectIdValue: string;

  private constructor(input: {
    repo: MemoryRepository;
    assembly: Assembly;
    issuer: ProducerAuthorizationIssuer;
    ingressLedger: ConversationIngressLedgerAuthority;
    deliveryLedger: ConversationDeliveryLedgerAuthority;
    container: RuntimeDependencyContainer;
    conversationId: string;
    subjectId: string;
    genesisEnvelope: unknown;
  }) {
    this.repo = input.repo;
    this.assembly = input.assembly;
    this.issuer = input.issuer;
    this.ingressLedger = input.ingressLedger;
    this.deliveryLedger = input.deliveryLedger;
    this.container = input.container;
    this.conversationId = input.conversationId;
    this.genesisEnvelope = input.genesisEnvelope;
    this.subjectIdValue = input.subjectId;
    this.retrieval = new RepositoryBackedMemoryRetrievalServiceV0(this.repo as never);
    this.appraisalExecutor = new FactualEventAppraisalExecutorV0(this.container);
    const trustedHistory = {
      readCommittedBundlesForSubject: async (subjectId: string) =>
        this.assembly.storeRead.getCommittedBundles().filter((bundle) => bundle.subject_id === subjectId) as unknown as readonly AtomicCommitBundleAnyVersion[]
    };
    this.affectWriter = createCanonicalAffectApplicationV0ForExplicitV4({
      subjectCore: this.assembly.facade as never,
      producerAuthorizationIssuer: this.issuer,
      repository: this.repo as never,
      factualEventAuthority: this.container.factualEventAuthority as never,
      learningSourceAuthority: this.container.learningSourceAuthority as never,
      affectAuthority: new InMemoryAffectEventAuthorityV0(trustedHistory),
      trustedHistory
    });
  }

  subjectId(): string {
    return this.subjectIdValue;
  }

  setSubjectId(subjectId: string): void {
    this.subjectIdValue = subjectId;
  }

  /** Fresh explicit-v4 session authority from a genesis seed. */
  static async createFresh(options: ExplicitV4SessionAuthorityOptionsV0): Promise<ExplicitV4SessionAuthorityV0> {
    const repo = new InMemoryMemoryRepository();
    await repo.prepareRevision({ parent_revision: null as never, records: [] });
    const r0Manifest = await repo.readManifest("R0" as never);
    if (r0Manifest === null) throw new Error("session authority: R0 manifest must exist after revision preparation");
    const r0Binding = {
      repository_revision: "R0",
      repository_revision_hash: await computeRepositoryRevisionHash(r0Manifest)
    };
    const genesis = await materializeSubjectStateV4V0({
      mode: "EXPLICIT_V4_FOUNDATION_V0" as never,
      seed: {
        schema_version: "subject-state-v4-genesis-seed-v0",
        subject: {
          subject_id: options.subject.subject_id,
          display_name: options.subject.display_name,
          identity_anchors: [...options.subject.identity_anchors]
        },
        v3_source: options.v3_source,
        r0_binding: r0Binding
      },
      r0_binding: r0Binding,
      reference_validator: async (binding: unknown) => (binding as { repository_revision?: string }).repository_revision === "R0"
    } as never);
    if (!genesis.ok) throw new Error(`session authority: genesis failed (${genesis.code}: ${genesis.detail})`);
    const assembly = createInMemorySubjectCoreFacadeForExplicitV4V0({
      seedSnapshots: new Map([[options.subject.subject_id as never, genesis.state as never]]),
      seedBundles: [],
      referenceValidator: async (binding) => repo.validateRevisionBinding(binding as never),
      preparedResultValidator: async () => true,
      memoryAdoptionValidator: async () => true
    });
    return ExplicitV4SessionAuthorityV0.assemble({
      repo,
      assembly,
      issuer: assembly.producerAuthorizationIssuer,
      options,
      genesisEnvelope: genesis.envelope
    });
  }

  /** Fresh authority rebuilt from a checkpoint's durable state (no live-object reuse). */
  static async restoreFromDurableState(
    options: ExplicitV4SessionAuthorityOptionsV0,
    durable: SessionDurableStateV0,
    source: { readonly repo: MemoryRepository; readonly bundles: readonly AtomicCommitBundleAnyVersion[] }
  ): Promise<{ readonly authority: ExplicitV4SessionAuthorityV0; readonly detail: string | null }> {
    const headBundle = source.bundles.at(-1);
    if (headBundle === undefined) throw new Error("session restore: no committed head bundle");
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
      genesis: durable.genesis_envelope as never,
      head: head as never,
      reference_validator: async (binding: { repository_revision: string; repository_revision_hash: string }) => {
        const manifest = await source.repo.readManifest(binding.repository_revision as never);
        return manifest !== null && (await computeRepositoryRevisionHash(manifest)) === binding.repository_revision_hash;
      }
    } as never);
    if (minted.kind !== "MINTED") {
      throw new Error(`session restore: boundary minting failed (${minted.kind})`);
    }
    const headSnapshot = headBundle.next_snapshot as unknown as SubjectStateV4;
    const headManifest = await source.repo.readManifest(headSnapshot.memory_state.repository_revision as never);
    if (headManifest === null) throw new Error("session restore: head repository manifest missing");
    const envelope = await createSubjectStateV4AuthoritativeRestoreEnvelopeV0({
      snapshot: headSnapshot,
      commit_head: head as never,
      repository_binding: {
        repository_revision: headSnapshot.memory_state.repository_revision,
        repository_revision_hash: await computeRepositoryRevisionHash(headManifest)
      } as never
    } as never);
    const freshRepo = new InMemoryMemoryRepository();
    await freshRepo.prepareRevision({ parent_revision: null as never, records: [] });
    for (const revision of (source.repo as unknown as { revisionIds(): readonly string[] }).revisionIds()) {
      if (revision === "R0") continue;
      const manifest = await source.repo.readManifest(revision as never);
      if (manifest === null) throw new Error(`session restore: manifest ${revision} missing`);
      const entries: { ref: string; payload_hash: string }[] = [];
      for (const entry of manifest.record_hashes as readonly { ref: string }[]) {
        const payload = source.repo.readStoredPayload(entry.ref as never);
        if (payload === undefined) throw new Error(`session restore: payload ${entry.ref} missing`);
        entries.push({ ref: entry.ref, payload_hash: await freshRepo.storePayload(entry.ref as never, payload) });
      }
      await freshRepo.prepareRevision({ parent_revision: manifest.parent_revision as never, records: entries as never });
    }
    const restored = await restoreSubjectStateV4AuthoritativelyV0({
      envelope: envelope as never,
      trusted_boundary: minted.receipt,
      bundles: source.bundles,
      reference_validator: async (binding: unknown) => freshRepo.validateRevisionBinding(binding as never)
    } as never);
    if (restored.kind !== "RESTORED") throw new Error(`session restore: restore failed (${restored.kind})`);
    const assembly = createInMemorySubjectCoreFacadeForExplicitV4V0({
      seedSnapshots: new Map([[options.subject.subject_id as never, restored.snapshot as never]]),
      seedBundles: source.bundles as never,
      referenceValidator: async (binding) => freshRepo.validateRevisionBinding(binding as never),
      preparedResultValidator: async () => true,
      memoryAdoptionValidator: async () => true
    });
    const authority = await ExplicitV4SessionAuthorityV0.assemble({
      repo: freshRepo,
      assembly,
      issuer: assembly.producerAuthorizationIssuer,
      options,
      genesisEnvelope: durable.genesis_envelope
    });
    return { authority, detail: null };
  }

  private static async assemble(input: {
    repo: MemoryRepository;
    assembly: Assembly;
    issuer: ProducerAuthorizationIssuer;
    options: ExplicitV4SessionAuthorityOptionsV0;
    genesisEnvelope: unknown;
  }): Promise<ExplicitV4SessionAuthorityV0> {
    const deliveryLedger = input.options.deliveryLedger ?? new InMemoryConversationDeliveryLedger();
    const ingressLedger = input.options.ingressLedger ?? new InMemoryConversationIngressLedger();
    const root = new RuntimeCompositionRoot({
      subjectCore: input.assembly.facade as never,
      producerAuthorizationIssuer: input.issuer,
      memoryRepository: input.repo as never,
      experiencePayloadRepository: input.repo as never,
      deliveryLedger,
      ingressLedger,
      factualEventAppraisalProvider: input.options.factualEventAppraisalProvider,
      retrieval: { retrieve: async () => { throw new Error("session: retrieval is performed by the session authority"); } } as never,
      learningSourceAuthority: {
        readCommittedBundle: async (id: string) => input.assembly.storeRead.readCommittedByTransitionId(id) as unknown as AtomicCommitBundleAnyVersion | null
      } as never,
      learningAdoptionAuthority: {
        markAdopted: (ref: never) => void (input.repo as unknown as { markAdopted: (r: never) => void }).markAdopted(ref),
        isAdopted: (ref: never) => (input.repo as unknown as { isAdopted: (r: never) => boolean }).isAdopted(ref)
      } as never,
      languageTransport: input.options.languageTransport,
      episodeContentReader: createEpisodeContentReaderV0(input.repo as never),
      conversationCognitionTransport: input.options.conversationCognitionTransport
    });
    return new ExplicitV4SessionAuthorityV0({
      repo: input.repo,
      assembly: input.assembly,
      issuer: input.issuer,
      ingressLedger,
      deliveryLedger,
      container: root.dependencies(),
      conversationId: `conv-${input.options.subject.subject_id}`,
      subjectId: input.options.subject.subject_id,
      genesisEnvelope: input.genesisEnvelope
    });
  }

  readSnapshot(): Promise<SubjectStateV4> {
    return this.assembly.facade.readCurrentSnapshot(this.subjectIdValue as never) as Promise<SubjectStateV4>;
  }

  pendingWork(): readonly PendingLifecycleWorkV0[] {
    return this.pending;
  }

  /** §15 — record a newly admitted event as outstanding lifecycle work. */
  enqueuePending(work: PendingLifecycleWorkV0): void {
    this.pending = [...this.pending, work];
  }

  /** §16 — drive all mandatory prior-event work to its lawful terminal state. */
  async completePendingLifecycleWork(): Promise<readonly CompletedLifecycleWorkV0[]> {
    const completed: CompletedLifecycleWorkV0[] = [];
    for (const work of this.pending) {
      const snapshot = await this.readSnapshot();
      const appraisal = await this.appraisalExecutor.appraiseIncomingEvent(ctxOf(snapshot), {
        subject_id: this.subjectIdValue as never,
        source_event_id: work.source_event_id,
        observation_transition_id: work.observation_transition_id as never,
        observation_ref: work.observation_ref as never
      } as never);
      if ((appraisal as { kind: string }).kind === "REJECTED") {
        throw new Error(`session lifecycle work: Appraisal rejected for ${work.event_ref}`);
      }
      const appraisalRef = (appraisal as unknown as { appraisal_ref?: string }).appraisal_ref ?? "";
      const outcome = await this.affectWriter.applyForEvent(ctxOf(await this.readSnapshot()), {
        factual_event_ref: work.event_ref as never
      });
      if (outcome.kind !== "COMMITTED") {
        throw new Error(`session lifecycle work: AffectApplication must commit for ${work.event_ref} (${outcome.kind})`);
      }
      completed.push({ event_ref: work.event_ref, appraisal_ref: appraisalRef });
    }
    this.pending = [];
    return completed;
  }

  /** §24 — lawful interval through the frozen v4 Time transition. */
  async advanceTime(ticks: number, tag: string): Promise<{ readonly valence_before: number; readonly valence_after: number; readonly activation_after: number; readonly logical_time_after: number }> {
    const snapshot = await this.readSnapshot();
    if (ticks === 0) {
      return {
        valence_before: snapshot.affect.valence,
        valence_after: snapshot.affect.valence,
        activation_after: snapshot.affect.activation,
        logical_time_after: snapshot.runtime_metadata.logical_time as number
      };
    }
    const affectDelta = await new BoundedAffectTimeProducerV0().produceCanonicalAffectTimeDelta({
      current_affect: snapshot.affect,
      elapsed_ticks: ticks
    });
    const regulationDelta = await new ReferenceRegulationV0Producer().produceRegulationDelta({
      context: ctxOf(snapshot),
      regulation: snapshot.regulation,
      elapsed_ticks: ticks
    });
    const proposal = {
      schema_version: "canonical-transition-proposal-v1",
      transition_id: `t-session-interval-${tag}-r${snapshot.runtime_metadata.state_revision}`,
      subject_id: snapshot.identity.subject_id,
      transition_type: "Time",
      expected_state_revision: snapshot.runtime_metadata.state_revision,
      time_input: { kind: "ELAPSED", elapsed_time: { value: ticks, unit: "tick" } },
      cause_refs: [],
      domain_deltas: [affectDelta, regulationDelta],
      external_refs: []
    } as unknown as Parameters<Assembly["facade"]["reserveAndRoute"]>[0];
    const reserved = await this.assembly.facade.reserveAndRoute(proposal);
    if (reserved.kind !== "CONTINUE") throw new Error(`session interval reservation failed: ${reserved.kind}`);
    const outcome = await this.assembly.facade.commitReserved({
      proposal,
      continuation: reserved.continuation,
      producerAuthorization: this.issuer.issue([
        { producer: "affect", domain: "affect" },
        { producer: "regulation", domain: "regulation" }
      ]) as never,
      preparedBinding: {
        prepared_result_ref: `workflow:w-session-interval-${tag}` as never,
        transition_id: proposal.transition_id,
        subject_id: proposal.subject_id,
        transition_type: proposal.transition_type,
        payload_fingerprint: await proposalFingerprint(proposal)
      },
      repository_bindings: await this.repositoryBindings(snapshot) as never
    });
    if (outcome.kind !== "COMMITTED") throw new Error(`session interval must commit: ${outcome.kind}`);
    const after = outcome.bundle.next_snapshot as SubjectStateV4;
    return {
      valence_before: snapshot.affect.valence,
      valence_after: after.affect.valence,
      activation_after: after.affect.activation,
      logical_time_after: after.runtime_metadata.logical_time as number
    };
  }

  private async repositoryBindings(snapshot: SubjectStateV4): Promise<readonly { repository_revision: string; repository_revision_hash: string }[]> {
    const revision = snapshot.memory_state.repository_revision as string;
    const manifest = await this.repo.readManifest(revision as never);
    if (manifest === null) throw new Error(`session: repository manifest ${revision} missing`);
    return [{ repository_revision: revision, repository_revision_hash: await computeRepositoryRevisionHash(manifest) }];
  }

  /** Admit an observable factual event (ingress → Observation). */
  async admitFactualEvent(sourceEventId: string, text: string, interactionIndex: number): Promise<{ readonly event_ref: string; readonly observation_transition_id: string; readonly observation_ref: string }> {
    const recorded = await this.ingressLedger.recordIngressEvent({
      schema_version: "conversation-ingress-input-v0",
      subject_id: this.subjectIdValue as never,
      conversation_id: this.conversationId,
      actor_ref: "entity:alice",
      text,
      logical_time: (await this.readSnapshot()).runtime_metadata.logical_time as never,
      source_event_id: sourceEventId,
      in_reply_to_delivery_id: null,
      host_adapter: "subject-session-v0"
    } as never);
    if (recorded.kind !== "RECORDED") throw new Error(`session: ingress must record (${recorded.kind})`);
    const eventRef = (recorded as unknown as { record: { event_ref: string } }).record.event_ref;
    const snapshot = await this.readSnapshot();
    const observation = observationInput({
      observation_id: `observation:o-${sourceEventId}-i${interactionIndex}`,
      source_refs: [eventRef, "source:s-3"],
      entity_refs: ["entity:alice", `subject:${this.subjectIdValue}`],
      occurrence_logical_time: snapshot.runtime_metadata.logical_time
    });
    const contextDelta = await buildContextDelta(observation, snapshot as never);
    const proposal = await buildObservationProposal({
      subjectId: this.subjectIdValue as never,
      stateRevision: snapshot.runtime_metadata.state_revision as number,
      observation,
      deltas: [contextDelta]
    });
    const reserved = await this.assembly.facade.reserveAndRoute(proposal);
    if (reserved.kind !== "CONTINUE") throw new Error(`session admission observation reservation failed: ${reserved.kind}`);
    const committed = await this.assembly.facade.commitReserved({
      proposal,
      continuation: reserved.continuation,
      producerAuthorization: this.issuer.issue([{ producer: "context", domain: "context" }]) as never,
      preparedBinding: {
        prepared_result_ref: `workflow:w-session-admit-${sourceEventId}` as never,
        transition_id: proposal.transition_id,
        subject_id: proposal.subject_id,
        transition_type: proposal.transition_type,
        payload_fingerprint: await proposalFingerprint(proposal)
      },
      repository_bindings: await this.repositoryBindings(snapshot) as never
    });
    if (committed.kind !== "COMMITTED") throw new Error(`session admission observation must commit: ${committed.kind}`);
    return {
      event_ref: eventRef,
      observation_transition_id: committed.bundle.transition_id as string,
      observation_ref: observationCauseRefOf(committed.bundle as never)
    };
  }

  /** Governed observable context + production retrieval in ONE Observation commit. */
  async commitObservableContext(input: {
    readonly scene: string;
    readonly task: string | null;
    readonly tag: string;
  }): Promise<{ readonly selected_refs: readonly string[]; readonly working_episode_refs: readonly string[]; readonly context_hash: string; readonly observation_ref: string }> {
    const snapshot = await this.readSnapshot();
    const observation = observationInput({
      observation_id: `observation:o-session-${input.tag}`,
      source_refs: ["source:s-3"],
      entity_refs: ["entity:alice", `subject:${this.subjectIdValue}`],
      occurrence_logical_time: snapshot.runtime_metadata.logical_time
    });
    const baseContextDelta = await buildContextDelta(observation, snapshot as never);
    const baseOp = baseContextDelta.operations[0] as { path: string; value: Record<string, unknown> };
    const contextDelta = {
      ...baseContextDelta,
      operations: [{ ...baseOp, value: { ...baseOp.value, scene: input.scene, task: input.task } }]
    } as typeof baseContextDelta;
    const retrievalResult = await this.retrieval.retrieve({
      schema_version: "memory-retrieval-query-v0" as never,
      subject_id: this.subjectIdValue as never,
      repository_revision: snapshot.memory_state.repository_revision as never,
      semantic_reference: snapshot.context.current_observation_ref as never,
      temporal: { now_logical_time: snapshot.runtime_metadata.logical_time as never, window_start: null },
      entity_refs: [...snapshot.context.active_entity_refs].sort() as never,
      relationship_refs: [] as never,
      current_context_refs: [...snapshot.context.focus_refs].sort() as never,
      salience_constraints: { min_declared_score: null, max_candidates: 8 }
    } as never);
    const selected = [...((retrievalResult as { selected_memory_refs: readonly string[] }).selected_memory_refs)];
    const traceRef = (retrievalResult as { retrieval_trace_ref: string | null }).retrieval_trace_ref;
    const memoryDelta = {
      producer: "memory",
      domain: "memory-retrieval",
      expected_repository_revision: snapshot.memory_state.repository_revision,
      operations: [
        { path: "/memory_state/last_retrieval_at", value: snapshot.runtime_metadata.logical_time as never },
        { path: "/memory_state/recent_retrieval_trace", value: traceRef === null ? [] : [traceRef] },
        { path: "/memory_state/working_refs", value: selected }
      ],
      provenance_refs: []
    } as never;
    const proposal = await buildObservationProposal({
      subjectId: this.subjectIdValue as never,
      stateRevision: snapshot.runtime_metadata.state_revision as number,
      observation,
      deltas: [contextDelta, memoryDelta]
    });
    const reserved = await this.assembly.facade.reserveAndRoute(proposal);
    if (reserved.kind !== "CONTINUE") throw new Error(`session context reservation failed: ${reserved.kind}`);
    const committed = await this.assembly.facade.commitReserved({
      proposal,
      continuation: reserved.continuation,
      producerAuthorization: this.issuer.issue([
        { producer: "context", domain: "context" },
        { producer: "memory", domain: "memory-retrieval" }
      ]) as never,
      preparedBinding: {
        prepared_result_ref: `workflow:w-session-context-${input.tag}` as never,
        transition_id: proposal.transition_id,
        subject_id: proposal.subject_id,
        transition_type: proposal.transition_type,
        payload_fingerprint: await proposalFingerprint(proposal)
      },
      repository_bindings: await this.repositoryBindings(snapshot) as never
    });
    if (committed.kind !== "COMMITTED") throw new Error(`session context must commit: ${committed.kind}`);
    const after = committed.bundle.next_snapshot as SubjectStateV4;
    return {
      selected_refs: selected,
      working_episode_refs: selected.filter((ref) => ref.startsWith("episode:")),
      context_hash: JSON.stringify([after.context.scene, after.context.task]),
      observation_ref: observation.observation_id
    };
  }

  /** Read-only audit of the production factual evidence resolved for the current
   * working set (same resolver the cognition executor uses; zero model calls). */
  async resolveWorkingEvidence(): Promise<{ readonly entry_count: number; readonly bundle: unknown }> {
    const snapshot = await this.readSnapshot();
    const refs = [...new Set<string>([
      ...(snapshot.memory_state.working_refs as readonly string[]),
      ...(snapshot.memory_state.recent_retrieval_trace as readonly string[])
    ])].filter((ref) => ref.startsWith("episode:")).sort();
    const resolver = this.container.factualEvidenceResolver;
    if (resolver === null || refs.length === 0) {
      return { entry_count: 0, bundle: { reason: resolver === null ? "resolver not wired" : "no episode refs in working set", refs } };
    }
    try {
      const bundle = await resolver.resolve({
        repository_revision: snapshot.memory_state.repository_revision,
        episode_refs: refs
      } as never);
      return { entry_count: (bundle as { entries: readonly unknown[] }).entries.length, bundle };
    } catch (error) {
      return { entry_count: 0, bundle: { resolve_error: (error instanceof Error ? error.message : String(error)).slice(0, 300), refs } };
    }
  }

  /** The frozen production conversation path: appraisal → cognition → directive → behavior. */
  async respond(input: {
    readonly responseRequestId: string;
    readonly factualEvent: { readonly source_event_id: string; readonly observation_transition_id: string; readonly observation_ref: string };
  }): Promise<SessionResponseResultV0> {
    const snapshot = await this.readSnapshot();
    const manifest = await this.repo.readManifest(snapshot.memory_state.repository_revision as never);
    if (manifest === null) throw new Error("session respond: repository manifest missing");
    const minter = createMiclStageMinter(this.assembly.facade as never, new InMemoryMiclWorkflowStore(), {
      micl_id: `micl-session-${input.responseRequestId}` as never,
      micl_request_fingerprint: (await hashEnvelope("characteros-next/runtime/session-interaction-micl/v1", {
        response_request_id: input.responseRequestId,
        state_revision: snapshot.runtime_metadata.state_revision
      })) as never,
      stage_key: "OBSERVATION" as never
    });
    const capabilities = minter.capabilities([
      {
        repository_revision: snapshot.memory_state.repository_revision,
        repository_revision_hash: await computeRepositoryRevisionHash(manifest)
      }
    ] as never);
    const executor = new ConversationTextResponseExecutorV1({ ...this.container, subjectCore: minter.core() } as never);
    const result = await executor.execute(
      ctxOf(snapshot),
      {
        response_request_id: input.responseRequestId as never,
        cause_refs: [],
        factual_event: input.factualEvent
      },
      capabilities as never
    );
    if (result.kind !== "OUTPUT_READY") {
      return { kind: "FAILED", behavior: null, directive: null, cognitionTrace: null, validationStage: result.stage, validationDetail: result.detail };
    }
    return {
      kind: "OUTPUT_READY",
      behavior: result.behavior,
      directive: result.trace.communication_directive_kind,
      cognitionTrace: result.trace,
      validationStage: null,
      validationDetail: null
    };
  }

  async recordDelivery(behavior: CharacterLanguageBehaviorV0): Promise<string> {
    const outcome = await this.deliveryLedger.recordConversationDelivery({
      subject_id: this.subjectIdValue as never,
      conversation_id: this.conversationId,
      behavior: behavior as never,
      delivered_logical_time: (await this.readSnapshot()).runtime_metadata.logical_time as never,
      status: "DELIVERED",
      host_adapter: "subject-session-v0"
    } as never);
    if (!outcome.ok) throw new Error(`session delivery must record: ${outcome.detail}`);
    return outcome.record.delivery_id as string;
  }

  async recordReply(text: string, deliveryId: string, sourceEventId: string, interactionIndex: number): Promise<{ readonly event_ref: string; readonly observation_transition_id: string; readonly observation_ref: string }> {
    const snapshot = await this.readSnapshot();
    const recorded = await this.ingressLedger.recordIngressEvent({
      schema_version: "conversation-ingress-input-v0",
      subject_id: this.subjectIdValue as never,
      conversation_id: this.conversationId,
      actor_ref: "entity:alice",
      text,
      logical_time: snapshot.runtime_metadata.logical_time as never,
      source_event_id: sourceEventId,
      in_reply_to_delivery_id: deliveryId,
      host_adapter: "subject-session-v0"
    } as never);
    if (recorded.kind !== "RECORDED") throw new Error(`session reply ingress must record (${recorded.kind})`);
    const eventRef = (recorded as unknown as { record: { event_ref: string } }).record.event_ref;
    const fresh = await this.readSnapshot();
    const observation = observationInput({
      observation_id: `observation:o-${sourceEventId}-reply-i${interactionIndex}`,
      source_refs: [eventRef, "source:s-3"],
      entity_refs: ["entity:alice", `subject:${this.subjectIdValue}`],
      occurrence_logical_time: fresh.runtime_metadata.logical_time
    });
    const contextDelta = await buildContextDelta(observation, fresh as never);
    const proposal = await buildObservationProposal({
      subjectId: this.subjectIdValue as never,
      stateRevision: fresh.runtime_metadata.state_revision as number,
      observation,
      deltas: [contextDelta]
    });
    const reserved = await this.assembly.facade.reserveAndRoute(proposal);
    if (reserved.kind !== "CONTINUE") throw new Error(`session reply observation reservation failed: ${reserved.kind}`);
    const committed = await this.assembly.facade.commitReserved({
      proposal,
      continuation: reserved.continuation,
      producerAuthorization: this.issuer.issue([{ producer: "context", domain: "context" }]) as never,
      preparedBinding: {
        prepared_result_ref: `workflow:w-session-reply-${sourceEventId}` as never,
        transition_id: proposal.transition_id,
        subject_id: proposal.subject_id,
        transition_type: proposal.transition_type,
        payload_fingerprint: await proposalFingerprint(proposal)
      },
      repository_bindings: await this.repositoryBindings(fresh) as never
    });
    if (committed.kind !== "COMMITTED") throw new Error(`session reply observation must commit: ${committed.kind}`);
    return {
      event_ref: eventRef,
      observation_transition_id: committed.bundle.transition_id as string,
      observation_ref: observationCauseRefOf(committed.bundle as never)
    };
  }

  /** Experience → Learning → durable Memory through the frozen feedback authority. */
  async recordBehaviorOutcomeFeedback(input: {
    readonly sourceEventId: string;
    readonly observationTransitionId: string;
    readonly observationRef: string;
  }): Promise<{ readonly experience_ref: string; readonly episode_ref: string; readonly event_ref: string }> {
    const snapshot = await this.readSnapshot();
    const executor = new LearningTransitionExecutor({
      subjectCore: this.assembly.facade,
      producerAuthorizationIssuer: this.issuer,
      memoryRepository: this.repo,
      memory: this.container.memory,
      experiencePayloadRepository: this.repo,
      learningSourceAuthority: this.container.learningSourceAuthority,
      learningAdoptionAuthority: this.container.learningAdoptionAuthority,
      conversationDeliveryLedger: this.deliveryLedger,
      conversationIngressLedger: this.ingressLedger,
      retrieval: { retrieve: async () => { throw new Error("session: feedback must not call retrieval"); } }
    } as never);
    const outcome = await executor.executeBehaviorOutcomeFeedback(ctxOf(snapshot), {
      candidate: {
        subject_id: this.subjectIdValue,
        conversation_id: this.conversationId,
        source_event_id: input.sourceEventId,
        observation_transition_id: input.observationTransitionId,
        observation_ref: input.observationRef,
        declared_salience: 0.5,
        host_adapter: "subject-session-v0"
      }
    } as never);
    if (outcome.kind !== "COMMITTED") throw new Error(`session feedback must commit: ${JSON.stringify(outcome).slice(0, 200)}`);
    return {
      experience_ref: outcome.refs.experience_ref,
      episode_ref: outcome.refs.episode_ref,
      event_ref: outcome.refs.event_ref
    };
  }

  /** Capture the authoritative durable identity + host payloads for a checkpoint. */
  async captureDurableState(episodeRefs: readonly string[]): Promise<SessionDurableStateV0> {
    const snapshot = await this.readSnapshot();
    const bundles = this.assembly.storeRead.getCommittedBundles().filter((bundle) => bundle.subject_id === this.subjectIdValue);
    const head = bundles.at(-1);
    if (head === undefined) throw new Error("session checkpoint: no committed head bundle");
    return {
      schema_version: "subject-session-durable-state-v0",
      identity: {
        subject_state_hash: await hashEnvelope("characteros-next/runtime/session-subject-state-hash/v1", snapshot as never),
        state_revision: snapshot.runtime_metadata.state_revision as number,
        logical_time: snapshot.runtime_metadata.logical_time as number,
        repository_revision: snapshot.memory_state.repository_revision as string,
        subject_head: {
          revision: head.next_revision as number,
          commit_ref: head.commit_ref as string,
          record_checksum: head.record_checksum as string,
          state_hash: head.state_hash_after as string,
          snapshot_hash: head.snapshot_hash_after as string
        },
        affect: { valence: snapshot.affect.valence, activation: snapshot.affect.activation },
        episode_refs: [...episodeRefs]
      },
      genesis_envelope: this.genesisEnvelope,
      delivery_ledger_state: (this.deliveryLedger as unknown as { exportState(): unknown }).exportState(),
      ingress_ledger_state: (this.ingressLedger as unknown as { exportState(): unknown }).exportState()
    };
  }

  /** The concrete durable store face needed to rebuild a fresh authority. */
  durableSource(): { readonly repo: MemoryRepository; readonly bundles: readonly AtomicCommitBundleAnyVersion[] } {
    return {
      repo: this.repo,
      bundles: this.assembly.storeRead.getCommittedBundles().filter((bundle) => bundle.subject_id === this.subjectIdValue) as unknown as readonly AtomicCommitBundleAnyVersion[]
    };
  }
}
