/**
 * BEHAVIOR_EXPERIENCE_FEEDBACK_V0 — behavior→experience→memory feedback suite.
 *
 * Real composition: real InMemoryMemoryRepository (intent prepare + idempotency),
 * real SubjectCore two-call canonical path (R2-F/R2-H gates), real observation
 * executor for the source O2, real composition-owned delivery/ingress ledgers,
 * real feedback source authority/encoder. No real model: the behavior artifact
 * is host-constructed via the frozen buildCharacterLanguageBehaviorV0.
 *
 * Proves the full vertical slice: delivered behavior → explicit linked user
 * reply → ONE Experience + ONE episode + ONE Learning commit; delivery
 * authority law (§5/§6); parent binding (§8); factual-only outcome (§9/§14);
 * idempotency (§18); temporal law (§19); hostile-model rejection (§20);
 * tamper-evident reader (§26); restore survival (§24); state isolation (§28).
 */

import { describe, expect, it } from "vitest";

import type {
  AtomicCommitBundleAnyVersion,
  CanonicalRefV0,
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
  validateExperienceRecord,
  retrievalQueryFingerprint,
  type MemoryPreparationAuthority,
  type MemoryRetrievalQueryV0,
  type MemoryRetrievalResultV0
} from "@characteros-next/memory";
import type { CharacterLanguageBehaviorV0 } from "@characteros-next/behavior";
import { buildCharacterLanguageBehaviorV0 } from "@characteros-next/behavior";
import { buildContextDelta, ReferenceContextProducer } from "../../ports/context-producer-port.js";
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
import type { TransitionCapabilities } from "../../ports/subject-core-port.js";
import { LearningTransitionExecutor } from "./learning-transition-executor.js";
import type { LearningAdoptionAuthority } from "./learning-adoption-authority.js";
import type { LearningSourceReadAuthority } from "./learning-source-authority.js";
import {
  createConversationDeliveryLedgerAuthorityV0,
  type ConversationDeliveryLedgerAuthority
} from "../conversation/behavior-delivery-ledger.js";
import { createConversationIngressLedgerAuthorityV0 } from "../conversation/conversation-ingress-ledger.js";
import {
  createExperienceReaderV0,
  type ExperienceReaderV0
} from "../conversation/experience-reader.js";
import { deriveBehaviorOutcomeExperienceRef } from "../conversation/conversation-feedback-identity.js";

const SUBJECT_ID = "subject-s0";
const CONVERSATION_ID = "conv-1";
const SOURCE_EVENT_ID = "evt-001";
const POSITIVE_REPLY = "对，就是这样。";
const NEGATIVE_REPLY = "不对，请重做。";

interface TestCore extends SubjectCorePort {
  readonly issuer: ProducerAuthorizationIssuer;
  readonly storeRead: {
    readCurrentBundle(subjectId: string): AtomicCommitBundleAnyVersion | null;
    readCommittedByTransitionId(id: string): AtomicCommitBundleAnyVersion | null;
    getCommittedBundles(): readonly AtomicCommitBundleAnyVersion[];
  };
}

function createFeedbackTestCore(
  snapshot: SubjectStateV0,
  rawMemory: InMemoryMemoryRepository,
  adoptionGate: { open: boolean } = { open: true }
): TestCore {
  const assembly: InMemoryFacadeAssembly = createInMemorySubjectCoreFacade({
    seedSnapshots: new Map([[SUBJECT_ID as never, snapshot]]),
    preparedResultValidator: async (binding) =>
      binding.prepared_result_ref.startsWith("workflow:w-learn-") ||
      binding.prepared_result_ref.startsWith("workflow:w-obs-"),
    referenceValidator: async (binding) =>
      rawMemory.validateRevisionBinding(
        binding as unknown as Parameters<MemoryPreparationAuthority["validateRevisionBinding"]>[0]
      ),
    memoryAdoptionValidator: async (adoption) => {
      if (!adoptionGate.open) return false;
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

const permissiveRetrieval = {
  retrieve: async (query: MemoryRetrievalQueryV0): Promise<MemoryRetrievalResultV0> => ({
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

interface World {
  rawMemory: InMemoryMemoryRepository;
  core: TestCore;
  feedbackExecutor: LearningTransitionExecutor;
  observationExecutor: ObservationTransitionExecutor;
  container: ReturnType<RuntimeCompositionRoot["dependencies"]>;
  baseline: SubjectStateV0;
}

/** Fresh single-store world: O2 and the feedback Learning share one canonical store. */
function buildWorld(): World {
  const rawMemory = new InMemoryMemoryRepository();
  void rawMemory.prepareRevision({ parent_revision: null, records: [] });
  const baseline = s0() as unknown as SubjectStateV0;
  const core = createFeedbackTestCore(baseline, rawMemory);

  const observationRoot = new RuntimeCompositionRoot({
    subjectCore: core,
    producerAuthorizationIssuer: core.issuer,
    memoryRepository: rawMemory,
    retrieval: permissiveRetrieval,
    interpretation: fixedInterpretation(),
    appraisal: fixedAppraisal(0.9, undefined, "situation"),
    affectProducer: fixedAffectProducer(),
    contextProducer: new ReferenceContextProducer()
  });
  const observationExecutor = new ObservationTransitionExecutor(observationRoot.dependencies());

  const sourceAuthority: LearningSourceReadAuthority = {
    readCommittedBundle: async (id) => core.storeRead.readCommittedByTransitionId(id)
  };
  const adoptionSeam: LearningAdoptionAuthority = {
    markAdopted: (r) => rawMemory.markAdopted(r),
    isAdopted: (r) => rawMemory.isAdopted(r)
  };
  const root = new RuntimeCompositionRoot({
    subjectCore: core,
    producerAuthorizationIssuer: core.issuer,
    memoryRepository: rawMemory,
    retrieval: {
      retrieve: async () => {
        throw new Error("feedback Learning never calls retrieval");
      }
    },
    learningSourceAuthority: sourceAuthority,
    learningAdoptionAuthority: adoptionSeam
  });

  return {
    rawMemory,
    core,
    feedbackExecutor: new LearningTransitionExecutor(root.dependencies()),
    observationExecutor,
    container: root.dependencies(),
    baseline
  };
}

let observationSequence = 0;

/** Commits one lawful source Observation (O2) in the world's canonical store. */
async function commitObservation(
  world: World,
  observationId: string
): Promise<AtomicCommitBundleAnyVersion> {
  const snapshot = (await world.core.readCurrentSnapshot(SUBJECT_ID as never)) as SubjectStateV0;
  const ctx = {
    subject_id: SUBJECT_ID as never,
    current_logical_time: snapshot.runtime_metadata.logical_time as never,
    state_revision: snapshot.runtime_metadata.state_revision as never
  };
  const observation = observationInput({ observation_id: observationId });
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
  // The observation's repository bindings must cover the CURRENTLY bound memory
  // revision (the fixture's static R0 bindings only fit a pristine world).
  const boundRevision = snapshot.memory_state.repository_revision as string;
  const boundManifest = await world.rawMemory.readManifest(boundRevision as never);
  if (boundManifest === null) throw new Error(`fixture invariant: manifest for ${boundRevision} must exist`);
  const capabilities: TransitionCapabilities = {
    preparedBinding: {
      prepared_result_ref: `workflow:w-obs-${++observationSequence}` as CanonicalRefV0,
      transition_id: proposal.transition_id,
      subject_id: proposal.subject_id,
      transition_type: proposal.transition_type,
      payload_fingerprint: await proposalFingerprint(proposal)
    },
    repository_bindings: [
      {
        repository_revision: boundRevision as never,
        repository_revision_hash: await computeRepositoryRevisionHash(boundManifest)
      }
    ] as never
  };
  const outcome = await world.observationExecutor.execute(ctx, observation, capabilities);
  if (outcome.kind !== "COMMITTED") {
    throw new Error(`fixture invariant: O2 must commit, got ${JSON.stringify(outcome).slice(0, 400)}`);
  }
  return outcome.bundle;
}

let behaviorSequence = 0;

async function makeBehavior(text: string, sourceRevision = 0): Promise<CharacterLanguageBehaviorV0> {
  behaviorSequence += 1;
  const draft = {
    schema_version: "language-realization-draft-v0",
    text,
    input_hash: `sha256:${"a".repeat(64)}`,
    evidence_refs: []
  };
  const built = await buildCharacterLanguageBehaviorV0({
    subject_id: SUBJECT_ID as never,
    source_revision: sourceRevision as never,
    response_request_id: `resp-${behaviorSequence}` as never,
    draft: draft as never
  });
  if (!built.ok) throw new Error(`fixture invariant: behavior must build (${built.detail})`);
  return built.behavior;
}

interface DeliveryOptions {
  readonly conversationId?: string;
  readonly status?: "DELIVERED" | "FAILED";
  readonly deliveredLogicalTime?: number;
  readonly behavior?: CharacterLanguageBehaviorV0;
  readonly withLineage?: boolean;
}

async function deliver(
  world: World,
  options: DeliveryOptions = {}
): Promise<{ delivery_id: string; status: string }> {
  const behavior = options.behavior ?? (await makeBehavior("这是给你的说明。"));
  const recorded = await deliveryLedgerOf(world).recordConversationDelivery({
    subject_id: SUBJECT_ID,
    conversation_id: options.conversationId ?? CONVERSATION_ID,
    behavior,
    delivered_logical_time: options.deliveredLogicalTime ?? 0,
    status: options.status ?? "DELIVERED",
    host_adapter: "test-adapter",
    ...(options.withLineage === true
      ? {
          cognition_projection_hash: `sha256:${"b".repeat(64)}`,
          conversation_cognition_proposal_hash: `sha256:${"c".repeat(64)}`,
          realization_input_hash: `sha256:${"d".repeat(64)}`
        }
      : {})
  });
  if (!recorded.ok) throw new Error(`fixture invariant: delivery must record (${recorded.detail})`);
  return { delivery_id: recorded.record.delivery_id, status: recorded.record.status };
}

async function ingress(
  world: World,
  overrides: Record<string, unknown> = {}
): Promise<{ kind: string; event_ref: string; delivery_id: string | null }> {
  const outcome = await ingressLedgerOf(world).recordIngressEvent({
    schema_version: "conversation-ingress-input-v0",
    subject_id: SUBJECT_ID,
    conversation_id: CONVERSATION_ID,
    actor_ref: "entity:e-1",
    text: POSITIVE_REPLY,
    logical_time: 0,
    source_event_id: SOURCE_EVENT_ID,
    in_reply_to_delivery_id: null,
    host_adapter: "test-adapter",
    ...overrides
  });
  if (outcome.kind === "RECORDED" || outcome.kind === "REPLAY") {
    return {
      kind: outcome.kind,
      event_ref: outcome.record.event_ref,
      delivery_id: outcome.record.in_reply_to_delivery_id
    };
  }
  throw new Error(`fixture invariant: ingress must record, got ${outcome.kind}`);
}

async function runFeedback(
  world: World,
  candidate: Record<string, unknown>
): Promise<Awaited<ReturnType<LearningTransitionExecutor["executeBehaviorOutcomeFeedback"]>>> {
  const snapshot = (await world.core.readCurrentSnapshot(SUBJECT_ID as never)) as SubjectStateV0;
  return world.feedbackExecutor.executeBehaviorOutcomeFeedback(
    {
      subject_id: SUBJECT_ID as never,
      current_logical_time: snapshot.runtime_metadata.logical_time as never,
      state_revision: snapshot.runtime_metadata.state_revision as never
    },
    { candidate } as never
  );
}

/** Canonical happy-path setup: O2 + delivered behavior + linked ingress. */
async function setupLinkedFeedback(
  world: World,
  options: {
    observationId?: string;
    replyText?: string;
    deliveryOptions?: DeliveryOptions;
    sourceEventId?: string;
  } = {}
): Promise<{
  delivery_id: string;
  event_ref: string;
  observationBundle: AtomicCommitBundleAnyVersion;
  preFeedbackSnapshot: SubjectStateV0;
}> {
  const observationBundle = await commitObservation(world, options.observationId ?? "observation:o-reply-1");
  const delivery = await deliver(world, options.deliveryOptions);
  const event = await ingress(world, {
    text: options.replyText ?? POSITIVE_REPLY,
    source_event_id: options.sourceEventId ?? SOURCE_EVENT_ID,
    in_reply_to_delivery_id: delivery.delivery_id
  });
  const preFeedbackSnapshot = (await world.core.readCurrentSnapshot(SUBJECT_ID as never)) as SubjectStateV0;
  return { delivery_id: delivery.delivery_id, event_ref: event.event_ref, observationBundle, preFeedbackSnapshot };
}

function candidateFor(
  observationBundle: AtomicCommitBundleAnyVersion,
  deliveryId: string,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    subject_id: SUBJECT_ID,
    conversation_id: CONVERSATION_ID,
    source_event_id: SOURCE_EVENT_ID,
    observation_transition_id: observationBundle.transition_id,
    observation_ref: observationBundle.trace_entry.cause_refs[0],
    declared_salience: 0.5,
    host_adapter: "test-adapter",
    ...overrides
  };
}

function deliveryLedgerOf(world: World): ConversationDeliveryLedgerAuthority {
  const ledger = world.container.conversationDeliveryLedger;
  if (ledger === null) throw new Error("fixture invariant: delivery ledger wired");
  return ledger;
}

function ingressLedgerOf(world: World) {
  const ledger = world.container.conversationIngressLedger;
  if (ledger === null) throw new Error("fixture invariant: ingress ledger wired");
  return ledger;
}

async function manifestOf(world: World, revision: string) {
  const manifest = await world.rawMemory.readManifest(revision as never);
  if (manifest === null) throw new Error(`fixture invariant: manifest for ${revision} must exist`);
  return manifest;
}

// ============================================================================
// Delivery authority law (§5/§6/§23) + parent binding (§8)
// ============================================================================

describe("delivery authority law", () => {
  it("1/2. generated != delivered: a fabricated receipt cannot create lived history", async () => {
    const world = buildWorld();
    const bundle = await commitObservation(world, "observation:o-reply-1");
    // A behavior artifact EXISTS (generated) but was NEVER delivered; the
    // ingress claims a fabricated parent delivery id that no ledger holds.
    await makeBehavior("我成功完成了。");
    await ingress(world, { in_reply_to_delivery_id: "dlv-forged" });
    await expect(runFeedback(world, candidateFor(bundle, "dlv-forged"))).rejects.toThrow(
      /no stored delivery record/
    );
    const experienceRefs = (await manifestOf(world, "R0")).record_hashes.filter((r) => r.ref.startsWith("experience:"));
    expect(experienceRefs).toHaveLength(0);
  });

  it("3. FAILED delivery cannot become the parent of a reply outcome", async () => {
    const world = buildWorld();
    const bundle = await commitObservation(world, "observation:o-reply-1");
    const delivery = await deliver(world, { status: "FAILED" });
    await ingress(world, { in_reply_to_delivery_id: delivery.delivery_id });
    await expect(runFeedback(world, candidateFor(bundle, delivery.delivery_id))).rejects.toThrow(
      /a failed delivery cannot become the parent/
    );
  });

  it("5. cross-subject parent delivery is rejected", async () => {
    const world = buildWorld();
    const bundle = await commitObservation(world, "observation:o-reply-1");
    const otherSubjectDelivery = await deliveryLedgerOf(world).recordConversationDelivery({
      subject_id: "subject-other",
      conversation_id: CONVERSATION_ID,
      behavior: await makeBehavior("其他主体的行为。"),
      delivered_logical_time: 0,
      status: "DELIVERED",
      host_adapter: "test-adapter"
    });
    if (!otherSubjectDelivery.ok) throw new Error("fixture invariant: other-subject delivery must record");
    await ingress(world, { in_reply_to_delivery_id: otherSubjectDelivery.record.delivery_id });
    await expect(
      runFeedback(world, candidateFor(bundle, otherSubjectDelivery.record.delivery_id))
    ).rejects.toThrow(/parent delivery belongs to a different subject/);
  });

  it("6. cross-conversation parent delivery is rejected", async () => {
    const world = buildWorld();
    const bundle = await commitObservation(world, "observation:o-reply-1");
    const delivery = await deliver(world, { conversationId: CONVERSATION_ID });
    await ingress(world, {
      conversation_id: "conv-other",
      in_reply_to_delivery_id: delivery.delivery_id
    });
    await expect(
      runFeedback(world, candidateFor(bundle, delivery.delivery_id, { conversation_id: "conv-other" }))
    ).rejects.toThrow(/parent delivery belongs to a different conversation/);
  });

  it("7. temporal violation: reply before delivery is rejected", async () => {
    const world = buildWorld();
    const bundle = await commitObservation(world, "observation:o-reply-1");
    const delivery = await deliver(world, { deliveredLogicalTime: 5 });
    await ingress(world, { in_reply_to_delivery_id: delivery.delivery_id, logical_time: 0 });
    await expect(runFeedback(world, candidateFor(bundle, delivery.delivery_id))).rejects.toThrow(
      /precedes the delivered parent/
    );
  });

  it("18. unlinked ingress (no parent) ⇒ Observation only, zero Experience", async () => {
    const world = buildWorld();
    const bundle = await commitObservation(world, "observation:o-reply-1");
    await deliver(world);
    await ingress(world, { in_reply_to_delivery_id: null });
    await expect(runFeedback(world, candidateFor(bundle, "dlv-unused"))).rejects.toThrow(
      /no explicit reply parent/
    );
    const manifest = await manifestOf(world, "R0");
    expect(manifest.record_hashes.filter((r) => r.ref.startsWith("experience:"))).toHaveLength(0);
  });
});

// ============================================================================
// Canonical feedback commit (§10/§13/§16/§17)
// ============================================================================

describe("canonical feedback commit", () => {
  it("8/9/10. valid linked reply ⇒ exactly ONE Experience + ONE episode + ONE Learning commit", async () => {
    const world = buildWorld();
    const setup = await setupLinkedFeedback(world, { deliveryOptions: { withLineage: true } });
    const outcome = await runFeedback(world, candidateFor(setup.observationBundle, setup.delivery_id));
    expect(outcome.kind).toBe("COMMITTED");
    if (outcome.kind !== "COMMITTED") return;
    const manifest = await manifestOf(world, outcome.bundle.next_snapshot.memory_state.repository_revision as string);
    const experienceRecords = manifest.record_hashes.filter((r) => r.ref.startsWith("experience:"));
    const episodeRecords = manifest.record_hashes.filter((r) => r.ref.startsWith("episode:"));
    const eventRecords = manifest.record_hashes.filter((r) => r.ref.startsWith("event:"));
    expect(experienceRecords).toHaveLength(1);
    expect(episodeRecords).toHaveLength(1);
    expect(eventRecords).toHaveLength(1);
    expect(manifest.record_hashes).toHaveLength(3); // §16: exactly three new records
    expect(world.core.storeRead.getCommittedBundles()).toHaveLength(2); // O2 + feedback
    expect(outcome.bundle.transition_type).toBe("Learning");
    expect(outcome.refs.experience_ref).toBe(experienceRecords[0]?.ref);
    expect(outcome.refs.episode_ref).toBe(episodeRecords[0]?.ref);
    expect(outcome.refs.event_ref).toBe(eventRecords[0]?.ref);
  });

  it("11. exact positive reply text preserved (对，就是这样。)", async () => {
    const world = buildWorld();
    const setup = await setupLinkedFeedback(world);
    const outcome = await runFeedback(world, candidateFor(setup.observationBundle, setup.delivery_id));
    if (outcome.kind !== "COMMITTED") throw new Error("expected COMMITTED");
    const payload = world.rawMemory.readStoredPayload(outcome.refs.experience_ref as never) as Record<string, unknown>;
    expect((payload["outcome"] as Record<string, unknown>)["text"]).toBe(POSITIVE_REPLY);
    const eventPayload = world.rawMemory.readStoredPayload(outcome.refs.event_ref as never) as Record<string, unknown>;
    expect(eventPayload["text"]).toBe(POSITIVE_REPLY);
  });

  it("12. exact negative reply text preserved without any semantic delta", async () => {
    const world = buildWorld();
    const setup = await setupLinkedFeedback(world, {
      observationId: "observation:o-reply-neg",
      replyText: NEGATIVE_REPLY,
      sourceEventId: "evt-002",
      deliveryOptions: { behavior: await makeBehavior("重新做一次的说明。") }
    });
    const outcome = await runFeedback(
      world,
      candidateFor(setup.observationBundle, setup.delivery_id, { source_event_id: "evt-002" })
    );
    if (outcome.kind !== "COMMITTED") throw new Error("expected COMMITTED");
    const payload = world.rawMemory.readStoredPayload(outcome.refs.experience_ref as never) as Record<string, unknown>;
    expect((payload["outcome"] as Record<string, unknown>)["text"]).toBe(NEGATIVE_REPLY);
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain("reward");
    expect(serialized).not.toContain("approved");
    expect(serialized).not.toContain("positive");
    expect(serialized).not.toContain("trust");
  });

  it("13. closed schema: approval/reward/trust surfaces are structurally impossible", () => {
    const forged = {
      schema_version: "experience-record-v0",
      experience_kind: "BEHAVIOR_OUTCOME",
      experience_ref: "experience:x",
      subject_id: SUBJECT_ID,
      conversation_id: CONVERSATION_ID,
      source_observation_ref: "observation:o-1",
      observation_transition_id: "t-obs-1",
      behavior_delivery_id: "dlv-1",
      behavior_payload_hash: `sha256:${"a".repeat(64)}`,
      behavior_artifact: {},
      cognition_lineage: null,
      event_ref: "event:e-1",
      outcome: {
        outcome_kind: "CONVERSATION_REPLY",
        outcome_ref: "outcome:o-1",
        actor_ref: "entity:e-1",
        text: "对",
        logical_time: 1,
        source_event_id: "evt-1"
      },
      delivered_logical_time: 0,
      outcome_logical_time: 1,
      host_adapter: "test",
      provenance_refs: [],
      approved: true,
      reward: 1.0
    };
    const checked = validateExperienceRecord(forged);
    expect(checked.ok).toBe(false);
    if (!checked.ok) expect(checked.error.detail).toContain("unknown key");
  });

  it("16. same source event replay ⇒ ALREADY_COMPLETED (+0 commit, +0 revision)", async () => {
    const world = buildWorld();
    const setup = await setupLinkedFeedback(world);
    const first = await runFeedback(world, candidateFor(setup.observationBundle, setup.delivery_id));
    if (first.kind !== "COMMITTED") throw new Error("expected first COMMITTED");
    const second = await runFeedback(world, candidateFor(setup.observationBundle, setup.delivery_id));
    expect(second.kind).toBe("ALREADY_COMPLETED");
    if (second.kind !== "ALREADY_COMPLETED") return;
    expect(second.experience_ref).toBe(first.refs.experience_ref);
    expect(second.repository_revision).toBe(first.bundle.next_snapshot.memory_state.repository_revision);
    expect(world.core.storeRead.getCommittedBundles()).toHaveLength(2); // O2 + feedback only
  });

  it("8b. crash window C2: replay over a frozen pre-commit anchor ⇒ same prepared revision, journal ALREADY_COMMITTED, +0", async () => {
    const world = buildWorld();
    const setup = await setupLinkedFeedback(world);
    const preCommitSnapshot = setup.preFeedbackSnapshot;
    const first = await runFeedback(world, candidateFor(setup.observationBundle, setup.delivery_id));
    if (first.kind !== "COMMITTED") throw new Error("expected first COMMITTED");
    const revision = first.bundle.next_snapshot.memory_state.repository_revision as string;

    // Crash-window replay: the anchor view is frozen at the PRE-commit snapshot
    // (prepare visible, canonical commit not yet observed) — the exact C2 model.
    // The SAME composition-owned ledgers stay wired (container spread).
    const frozenCore: SubjectCorePort = {
      reserveAndRoute: (p) => world.core.reserveAndRoute(p),
      commitReserved: (i) => world.core.commitReserved(i),
      terminalizeReservedNoOp: (i) => world.core.terminalizeReservedNoOp(i),
      reconcile: (t, s, f) => world.core.reconcile(t, s, f),
      readCurrentSnapshot: async () => preCommitSnapshot
    };
    const replayExecutor = new LearningTransitionExecutor({
      ...world.container,
      subjectCore: frozenCore
    });
    const replay = await replayExecutor.executeBehaviorOutcomeFeedback(
      {
        subject_id: SUBJECT_ID as never,
        current_logical_time: preCommitSnapshot.runtime_metadata.logical_time as never,
        state_revision: preCommitSnapshot.runtime_metadata.state_revision as never
      },
      { candidate: candidateFor(setup.observationBundle, setup.delivery_id) } as never
    );
    expect(replay.kind).toBe("COMMITTED");
    if (replay.kind !== "COMMITTED") return;
    // +0: the SAME prepared revision is reused, no second canonical commit.
    expect(replay.refs.experience_ref).toBe(first.refs.experience_ref);
    expect(world.core.storeRead.getCommittedBundles()).toHaveLength(2); // O2 + feedback only
    expect(world.rawMemory.isAdopted(revision as never)).toBe(true);
  });

  it("17. same source event id with changed text ⇒ SOURCE_EVENT_CONFLICT (ledger law)", async () => {
    const world = buildWorld();
    await deliver(world);
    await ingress(world);
    const second = await ingressLedgerOf(world).recordIngressEvent({
      schema_version: "conversation-ingress-input-v0",
      subject_id: SUBJECT_ID,
      conversation_id: CONVERSATION_ID,
      actor_ref: "entity:e-1",
      text: "改变了的文本。",
      logical_time: 0,
      source_event_id: SOURCE_EVENT_ID,
      in_reply_to_delivery_id: null,
      host_adapter: "test-adapter"
    });
    expect(second.kind).toBe("CONFLICT");
  });

  it("19. parent Memory records retained: feedback revision chains onto the parent manifest", async () => {
    const world = buildWorld();
    // A prior ordinary Learning episode occupies R1.
    const learningBundle = await commitObservation(world, "observation:o-prior-1");
    const learningOutcome = await world.feedbackExecutor.execute(
      {
        subject_id: SUBJECT_ID as never,
        current_logical_time: 0 as never,
        state_revision: 1 as never
      },
      {
        candidate: {
          subject_id: SUBJECT_ID,
          source_transition_id: learningBundle.transition_id,
          observation_ref: learningBundle.trace_entry.cause_refs[0],
          entity_refs: ["entity:e-1", "subject:s0"],
          event_refs: ["event:v-2"],
          occurrence_logical_time: learningBundle.logical_time_after,
          appraisal_ref: null,
          scene: learningBundle.next_snapshot.context.scene,
          focus_refs: [...learningBundle.next_snapshot.context.focus_refs],
          environment_refs: [...learningBundle.next_snapshot.context.environment_refs],
          declared_salience: 0.4
        } as never
      }
    );
    if (learningOutcome.kind !== "COMMITTED") {
      throw new Error(`prior Learning must commit, got ${JSON.stringify(learningOutcome).slice(0, 300)}`);
    }
    const priorRevision = learningOutcome.bundle.next_snapshot.memory_state.repository_revision as string;
    const priorManifest = await manifestOf(world, priorRevision);
    const priorEpisodeRefs = priorManifest.record_hashes
      .filter((r) => r.ref.startsWith("episode:"))
      .map((r) => r.ref);

    // Feedback now chains onto the prior revision.
    const setup = await setupLinkedFeedback(world);
    const outcome = await runFeedback(world, candidateFor(setup.observationBundle, setup.delivery_id));
    if (outcome.kind !== "COMMITTED") throw new Error(`expected COMMITTED, got ${JSON.stringify(outcome)}`);
    const feedbackRevision = outcome.bundle.next_snapshot.memory_state.repository_revision as string;
    const manifest = await manifestOf(world, feedbackRevision);
    expect(manifest.parent_revision).toBe(priorRevision);
    for (const ref of priorEpisodeRefs) {
      expect(await world.rawMemory.payloadHashOf(ref as never)).not.toBeNull();
    }
    expect(outcome.bundle.next_snapshot.memory_state.active_episode_refs).toEqual(
      learningOutcome.bundle.next_snapshot.memory_state.active_episode_refs
    );
  });
});

// ============================================================================
// Hostile model proofs (§20) + reader (§26) + delivery-boundary tamper (§11)
// ============================================================================

describe("hostile model proofs and authoritative reader", () => {
  it("14. model self-certification ('我成功完成了。') creates no Experience without an authoritative receipt", async () => {
    const world = buildWorld();
    await commitObservation(world, "observation:o-reply-1");
    // The behavior CLAIMS success; no linked user ingress exists at all.
    await makeBehavior("我成功完成了。");
    const experienceCount = (await manifestOf(world, "R0")).record_hashes.filter((r) =>
      r.ref.startsWith("experience:")
    ).length;
    expect(experienceCount).toBe(0);
  });

  it("20/21. experience reader succeeds on canonical data and fails closed on tampering", async () => {
    const world = buildWorld();
    const setup = await setupLinkedFeedback(world, { deliveryOptions: { withLineage: true } });
    const outcome = await runFeedback(world, candidateFor(setup.observationBundle, setup.delivery_id));
    if (outcome.kind !== "COMMITTED") throw new Error("expected COMMITTED");
    const revision = outcome.bundle.next_snapshot.memory_state.repository_revision as string;

    const reader: ExperienceReaderV0 = createExperienceReaderV0({
      repository: world.rawMemory,
      deliveryLedger: deliveryLedgerOf(world)
    });
    const good = await reader.read({ repository_revision: revision, episode_ref: outcome.refs.episode_ref });
    expect(good.ok).toBe(true);
    if (good.ok) {
      expect(good.experience.outcome.text).toBe(POSITIVE_REPLY);
      expect((good.behavior as { text: string }).text).toBe("这是给你的说明。");
      expect(good.behavior_delivery.delivery_id).toBe(setup.delivery_id);
      expect(good.experience.cognition_lineage).not.toBeNull();
    }

    // ---- tamper fixture: fresh repo replaying CLONED payloads, one mutated --------
    const buildTamperedReader = async (
      mutate: (records: {
        episode: Record<string, unknown>;
        experience: Record<string, unknown>;
        event: Record<string, unknown>;
      }) => void
    ): Promise<{ reader: ExperienceReaderV0; revision: string; episodeRef: string }> => {
      const fresh = new InMemoryMemoryRepository();
      await fresh.prepareRevision({ parent_revision: null, records: [] });
      const clone = (ref: string): Record<string, unknown> => {
        const stored = world.rawMemory.readStoredPayload(ref as never);
        if (stored === undefined) throw new Error("fixture invariant: payload must exist");
        return JSON.parse(JSON.stringify(stored)) as Record<string, unknown>;
      };
      const records = {
        episode: clone(outcome.refs.episode_ref),
        experience: clone(outcome.refs.experience_ref),
        event: clone(outcome.refs.event_ref)
      };
      mutate(records);
      const entries = [];
      for (const [ref, payload] of [
        [outcome.refs.event_ref, records.event],
        [outcome.refs.experience_ref, records.experience],
        [outcome.refs.episode_ref, records.episode]
      ] as const) {
        const hash = await fresh.storePayload(ref as never, payload);
        entries.push({ ref, payload_hash: hash });
      }
      entries.sort((a, b) => (a.ref < b.ref ? -1 : 1));
      await fresh.prepareRevision({ parent_revision: "R0" as never, records: entries as never });
      return {
        reader: createExperienceReaderV0({
          repository: fresh,
          deliveryLedger: deliveryLedgerOf(world)
        }),
        revision: "R1",
        episodeRef: outcome.refs.episode_ref
      };
    };

    // (a) tampered experience↔event exact-text consistency
    const tamperedText = await buildTamperedReader((r) => {
      (r.experience["outcome"] as Record<string, unknown>)["text"] = "被篡改的确认。";
    });
    const textResult = await tamperedText.reader.read({ repository_revision: tamperedText.revision, episode_ref: tamperedText.episodeRef });
    expect(textResult.ok).toBe(false);
    if (!textResult.ok) expect(textResult.code).toBe("EVENT_LINKAGE_INVALID");

    // (b) tampered behavior artifact (text edited after delivery)
    const tamperedArtifact = await buildTamperedReader((r) => {
      r.experience["behavior_artifact"] = {
        ...(r.experience["behavior_artifact"] as Record<string, unknown>),
        text: "交付后被编辑的文本。"
      };
    });
    const artifactResult = await tamperedArtifact.reader.read({ repository_revision: tamperedArtifact.revision, episode_ref: tamperedArtifact.episodeRef });
    expect(artifactResult.ok).toBe(false);
    if (!artifactResult.ok) expect(["PAYLOAD_SCHEMA_INVALID", "PAYLOAD_HASH_MISMATCH"]).toContain(artifactResult.code);

    // (c) tampered event text (event ref no longer re-derives)
    const tamperedEvent = await buildTamperedReader((r) => {
      r.event["text"] = "被篡改的事件文本。";
    });
    const eventResult = await tamperedEvent.reader.read({ repository_revision: tamperedEvent.revision, episode_ref: tamperedEvent.episodeRef });
    expect(eventResult.ok).toBe(false);
    if (!eventResult.ok) expect(eventResult.code).toBe("EVENT_LINKAGE_INVALID");

    // (d) experience identity tamper (delivery binding changed)
    const tamperedIdentity = await buildTamperedReader((r) => {
      r.experience["behavior_delivery_id"] = "dlv-tampered";
    });
    const identityResult = await tamperedIdentity.reader.read({ repository_revision: tamperedIdentity.revision, episode_ref: tamperedIdentity.episodeRef });
    expect(identityResult.ok).toBe(false);
    if (!identityResult.ok) expect(identityResult.code).toBe("EXPERIENCE_LINKAGE_INVALID");

    // (e) delivery record missing from the reader's ledger
    const orphanReader = createExperienceReaderV0({
      repository: world.rawMemory,
      deliveryLedger: createConversationDeliveryLedgerAuthorityV0()
    });
    const orphanResult = await orphanReader.read({ repository_revision: revision, episode_ref: outcome.refs.episode_ref });
    expect(orphanResult.ok).toBe(false);
    if (!orphanResult.ok) expect(orphanResult.code).toBe("DELIVERY_LINKAGE_INVALID");
  });

  it("15. full behavior payload tamper at the delivery boundary is rejected", async () => {
    const world = buildWorld();
    const behavior = await makeBehavior("原始交付文本。");
    const forged = {
      ...behavior,
      text: "交付前被替换的文本。"
    };
    const recorded = await deliveryLedgerOf(world).recordConversationDelivery({
      subject_id: SUBJECT_ID,
      conversation_id: CONVERSATION_ID,
      behavior: forged,
      delivered_logical_time: 0,
      status: "DELIVERED",
      host_adapter: "test-adapter"
    });
    expect(recorded.ok).toBe(false);
    if (!recorded.ok) expect(recorded.code).toBe("DELIVERY_BEHAVIOR_INVALID");
  });
});

// ============================================================================
// State isolation (§28) + restore survival (§24)
// ============================================================================

describe("state isolation and restore survival", () => {
  it("23/24/25. feedback commit leaves Relationship/Belief/Personality/Affect/Mood untouched", async () => {
    const world = buildWorld();
    const setup = await setupLinkedFeedback(world);
    const preFeedback = setup.preFeedbackSnapshot;
    const outcome = await runFeedback(world, candidateFor(setup.observationBundle, setup.delivery_id));
    if (outcome.kind !== "COMMITTED") throw new Error("expected COMMITTED");
    const next = outcome.bundle.next_snapshot;
    expect(JSON.stringify(next.relationships)).toBe(JSON.stringify(preFeedback.relationships));
    expect(JSON.stringify(next.beliefs)).toBe(JSON.stringify(preFeedback.beliefs));
    expect(JSON.stringify(next.personality)).toBe(JSON.stringify(preFeedback.personality));
    expect(JSON.stringify(next.affect)).toBe(JSON.stringify(preFeedback.affect));
    expect(JSON.stringify(next.mood)).toBe(JSON.stringify(preFeedback.mood));
    expect(JSON.stringify(next.regulation)).toBe(JSON.stringify(preFeedback.regulation));
    expect(JSON.stringify(next.context)).toBe(JSON.stringify(preFeedback.context));
    expect(next.runtime_metadata.state_revision).toBe(preFeedback.runtime_metadata.state_revision + 1);
  });

  it("22. restore preserves refs/hashes/text: fresh runtime + restored ledgers + repository replay", async () => {
    const world = buildWorld();
    const setup = await setupLinkedFeedback(world, { deliveryOptions: { withLineage: true } });
    const outcome = await runFeedback(world, candidateFor(setup.observationBundle, setup.delivery_id));
    if (outcome.kind !== "COMMITTED") throw new Error("expected COMMITTED");
    const revision = outcome.bundle.next_snapshot.memory_state.repository_revision as string;
    const postSnapshot = outcome.bundle.next_snapshot;
    const preRestoreExperience = world.rawMemory.readStoredPayload(outcome.refs.experience_ref as never) as Record<string, unknown>;

    // ---- persist: envelope + memory payloads + ledger exports --------------------
    const envelopeResult = await createPersistenceEnvelope({
      snapshot: postSnapshot,
      repository_bindings: outcome.bundle.repository_revision_bindings.filter(
        (b) => b.repository_revision === revision
      ),
      commit_head: {
        commit_ref: outcome.bundle.commit_ref,
        record_checksum: outcome.bundle.record_checksum as never
      }
    });
    if (!envelopeResult.ok) throw new Error(`envelope must build: ${envelopeResult.error.detail}`);
    const persistedPayloads = {
      episode: world.rawMemory.readStoredPayload(outcome.refs.episode_ref as never),
      experience: world.rawMemory.readStoredPayload(outcome.refs.experience_ref as never),
      event: world.rawMemory.readStoredPayload(outcome.refs.event_ref as never)
    };
    const persistedDeliveries = deliveryLedgerOf(world).exportState();
    const persistedIngress = ingressLedgerOf(world).exportState();

    // ---- fresh runtime/repositories/ledgers; restore through existing authority ---
    const freshMemory = new InMemoryMemoryRepository();
    await freshMemory.prepareRevision({ parent_revision: null, records: [] });
    const entries = [];
    for (const [ref, payload] of [
      [outcome.refs.event_ref, persistedPayloads.event],
      [outcome.refs.experience_ref, persistedPayloads.experience],
      [outcome.refs.episode_ref, persistedPayloads.episode]
    ] as const) {
      if (payload === undefined) throw new Error("fixture invariant: persisted payload must exist");
      const hash = await freshMemory.storePayload(ref as never, payload);
      entries.push({ ref, payload_hash: hash });
    }
    entries.sort((a, b) => (a.ref < b.ref ? -1 : 1));
    await freshMemory.prepareRevision({ parent_revision: "R0" as never, records: entries as never });
    const freshDeliveryLedger: ConversationDeliveryLedgerAuthority = createConversationDeliveryLedgerAuthorityV0();
    const freshIngressLedger = createConversationIngressLedgerAuthorityV0();
    const restoredDeliveries = await freshDeliveryLedger.restoreState(persistedDeliveries);
    expect(restoredDeliveries.ok).toBe(true);
    const restoredIngress = await freshIngressLedger.restoreState(persistedIngress);
    expect(restoredIngress.ok).toBe(true);

    const bundleForChain = outcome.bundle;
    const restore = await restoreFromEnvelope(envelopeResult.value, {
      referenceValidator: async (binding) =>
        freshMemory.validateRevisionBinding(
          binding as unknown as Parameters<MemoryPreparationAuthority["validateRevisionBinding"]>[0]
        ),
      commitChainVerifier: async (expected) =>
        bundleForChain.commit_ref === expected.commit_ref &&
        bundleForChain.record_checksum === expected.record_checksum &&
        bundleForChain.snapshot_hash_after === expected.snapshot_hash
    });
    expect(restore.ok).toBe(true);
    if (!restore.ok) return;
    expect(restore.snapshot.runtime_metadata.state_revision).toBe(postSnapshot.runtime_metadata.state_revision);
    expect(restore.snapshot.memory_state.repository_revision).toBe(revision);
    expect(JSON.stringify(restore.snapshot)).toBe(JSON.stringify(postSnapshot));

    // ---- the same experience/event/episode lineage is recoverable after restart ---
    const reader = createExperienceReaderV0({ repository: freshMemory, deliveryLedger: freshDeliveryLedger });
    const read = await reader.read({ repository_revision: revision, episode_ref: outcome.refs.episode_ref });
    expect(read.ok).toBe(true);
    if (read.ok) {
      expect(read.experience.experience_ref).toBe(outcome.refs.experience_ref);
      expect(read.event.event_ref).toBe(outcome.refs.event_ref);
      expect(read.experience.outcome.text).toBe(POSITIVE_REPLY);
      expect(read.experience.behavior_payload_hash).toBe(preRestoreExperience["behavior_payload_hash"]);
      expect((read.behavior as { text: string }).text).toBe("这是给你的说明。");
    }
    const reDerived = await deriveBehaviorOutcomeExperienceRef({
      subject_id: SUBJECT_ID as never,
      source_event_id: SOURCE_EVENT_ID as never,
      behavior_delivery_id: setup.delivery_id as never
    });
    expect(reDerived).toBe(outcome.refs.experience_ref);
  });
});
