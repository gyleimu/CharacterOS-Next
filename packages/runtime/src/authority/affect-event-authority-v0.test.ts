/**
 * CANONICAL_AFFECT_EVENT_AUTHORITY_SHADOW_V0 — AffectEventAuthorityV0 tests.
 *
 * Proves, over REAL committed Observation bundles (the legacy Affect writer):
 *
 *   §25/§26 LEGACY_ALREADY_APPLIED — verified event cause + Affect-domain write
 *   §31/§32 CANONICAL_PENDING — canonical INITIAL exists, nothing applied yet
 *   §29 shadow routing — legacy consumption wins; the canonical shadow query
 *     is read-only (Affect/Mood/Relationship/Belief/Personality untouched, no
 *     new bundle)
 *   §33 UNPROVEN_LEGACY_LINEAGE — affect-writing history without verified event
 *     lineage is quarantined (never CANONICAL_PENDING → no replay path)
 *   §23 dynamics-version independence — eligibility excludes dynamics; the
 *     execution-identity seam carries it
 *   §3/§4 different events / same text — distinct factual events, distinct
 *     eligibility identities
 *   §40 retry — duplicate submission after unrelated state advance re-derives
 *     consumed with exactly one legacy consumption and zero new application
 *   §45 concurrency — same-head race: exactly one event-level legacy
 *     consumption; the stale loser reconciles to consumed
 *   §50 restore — fresh runtime over the trusted complete bundle history still
 *     derives consumed (JOURNAL_DERIVED from committed history, not from any
 *     process-local transition journal)
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
import {
  createAffectEventAuthorityV0,
  deriveAffectEligibilityIdentityV0,
  deriveAffectExecutionIdentityV0
} from "./affect-event-authority-v0.js";

const SUBJECT_ID = "subject-s0";
const CONVERSATION_ID = "conv-affect";
const ALICE = "entity:alice";
const REPLY_TEXT = "谢谢你的说明。";

// ----------------------------------------------------------------------------------
// Harness: real facade + real Observation executor (the legacy Affect writer)
// ----------------------------------------------------------------------------------

interface TestCore extends SubjectCorePort {
  readonly issuer: ProducerAuthorizationIssuer;
  readonly storeRead: {
    readCurrentBundle(subjectId: string): AtomicCommitBundleAnyVersion | null;
    readCommittedByTransitionId(id: string): AtomicCommitBundleAnyVersion | null;
    getCommittedBundles(): readonly AtomicCommitBundleAnyVersion[];
  };
}

function createCore(
  snapshot: SubjectStateV0,
  seedBundles: readonly AtomicCommitBundleAnyVersion[] = []
): TestCore {
  const assembly: InMemoryFacadeAssembly = createInMemorySubjectCoreFacade({
    seedSnapshots: new Map([[SUBJECT_ID as never, snapshot]]),
    seedBundles: seedBundles as never,
    preparedResultValidator: async (binding) => binding.prepared_result_ref.startsWith("workflow:")
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

interface AffectWorld {
  readonly repo: InMemoryMemoryRepository;
  readonly core: TestCore;
  readonly container: ReturnType<RuntimeCompositionRoot["dependencies"]>;
  readonly observationExecutor: ObservationTransitionExecutor;
}

async function buildAffectWorld(): Promise<AffectWorld> {
  const repo = new InMemoryMemoryRepository();
  await repo.prepareRevision({ parent_revision: null, records: [] });
  const core = createCore(s0() as unknown as SubjectStateV0);
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
    contextProducer: new ReferenceContextProducer()
  });
  const container = root.dependencies();
  return {
    repo,
    core,
    container,
    observationExecutor: new ObservationTransitionExecutor(container)
  };
}

async function currentMemoryBindings(
  repo: InMemoryMemoryRepository,
  snapshot: SubjectStateV0
): Promise<TransitionCapabilities["repository_bindings"]> {
  const revision = snapshot.memory_state.repository_revision as string;
  const manifest = await repo.readManifest(revision as never);
  if (manifest === null) throw new Error("fixture invariant: manifest must exist");
  return [{
    repository_revision: revision as never,
    repository_revision_hash: await computeRepositoryRevisionHash(manifest)
  }] as never;
}

/** Records one conversation ingress event and returns its canonical event ref. */
async function recordIngress(
  world: AffectWorld,
  sourceEventId: string,
  text: string = REPLY_TEXT
): Promise<string> {
  const ledger = world.container.conversationIngressLedger;
  if (ledger === null) throw new Error("fixture invariant: ingress ledger wired");
  const outcome = await ledger.recordIngressEvent({
    schema_version: "conversation-ingress-input-v0",
    subject_id: SUBJECT_ID,
    conversation_id: CONVERSATION_ID,
    actor_ref: ALICE,
    text,
    logical_time: 0,
    source_event_id: sourceEventId,
    in_reply_to_delivery_id: null,
    host_adapter: "test-adapter"
  });
  if (outcome.kind !== "RECORDED") {
    throw new Error(`fixture invariant: ingress must record, got ${outcome.kind}`);
  }
  return outcome.record.event_ref as string;
}

/**
 * Commits one source Observation through the real executor. The executor
 * always assembles the affect + context deltas internally (the legacy Affect
 * writer path); `eventRef` puts the verified factual event into the committed
 * cause set (§8 full source lineage).
 */
async function commitSourceObservation(
  world: AffectWorld,
  options: {
    readonly observationId: string;
    readonly eventRef: string | null;
  }
): Promise<AtomicCommitBundleAnyVersion> {
  const snapshot = (await world.core.readCurrentSnapshot(SUBJECT_ID as never)) as SubjectStateV0;
  const ctx = {
    subject_id: SUBJECT_ID as never,
    current_logical_time: snapshot.runtime_metadata.logical_time as never,
    state_revision: snapshot.runtime_metadata.state_revision as never
  };
  const observation = observationInput({
    observation_id: options.observationId,
    source_refs: options.eventRef === null ? ["source:s-3"] : [options.eventRef, "source:s-3"],
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
      prepared_result_ref: "workflow:w-affect-authority" as never,
      transition_id: proposal.transition_id,
      subject_id: proposal.subject_id,
      transition_type: proposal.transition_type,
      payload_fingerprint: await proposalFingerprint(proposal)
    },
    repository_bindings: await currentMemoryBindings(world.repo, snapshot)
  } as TransitionCapabilities);
  if (outcome.kind !== "COMMITTED") {
    throw new Error(`fixture invariant: Observation must commit, got ${JSON.stringify(outcome).slice(0, 250)}`);
  }
  return outcome.bundle;
}

/** Trusted-history authority over the CURRENT committed bundle set (no journal). */
function authorityOf(core: TestCore) {
  return createAffectEventAuthorityV0({
    readCommittedBundlesForSubject: async (subjectId) =>
      core.storeRead.getCommittedBundles().filter((b) => b.subject_id === subjectId)
  });
}

/** Harness-built racing proposal for one event cause at an explicit head. */
async function buildRaceProposal(
  world: AffectWorld,
  eventRef: string,
  observationId: string,
  head: SubjectStateV0
) {
  const observation = observationInput({
    observation_id: observationId,
    source_refs: [eventRef, "source:s-3"],
    entity_refs: [ALICE, "subject:s0"]
  });
  const affectDelta = await fixedAffectProducer().produceAffectDelta({
    context: {
      subject_id: SUBJECT_ID as never,
      current_logical_time: head.runtime_metadata.logical_time as never,
      state_revision: head.runtime_metadata.state_revision as never
    },
    snapshot: head,
    transition_type: "Observation",
    appraisal: null,
    elapsed_ticks: null
  });
  const contextDelta = await buildContextDelta(observation, head);
  return buildObservationProposal({
    subjectId: SUBJECT_ID,
    stateRevision: head.runtime_metadata.state_revision as number,
    observation,
    deltas: [affectDelta, contextDelta]
  });
}

function stateSurfaceOf(snapshot: SubjectStateV0): Record<string, string> {
  return {
    affect: JSON.stringify(snapshot.affect),
    mood: JSON.stringify(snapshot.mood),
    relationships: JSON.stringify(snapshot.relationships),
    beliefs: JSON.stringify(snapshot.beliefs),
    personality: JSON.stringify(snapshot.personality)
  };
}

async function readSurface(core: TestCore): Promise<Record<string, string>> {
  return stateSurfaceOf((await core.readCurrentSnapshot(SUBJECT_ID as never)) as SubjectStateV0);
}

function bundlesConsumingEvent(
  bundles: readonly AtomicCommitBundleAnyVersion[],
  eventRef: string
): readonly AtomicCommitBundleAnyVersion[] {
  return bundles.filter(
    (b) =>
      b.transition_type === "Observation" &&
      (b.trace_entry.cause_refs as readonly string[]).includes(eventRef) &&
      b.trace_entry.domain_mutations.some((m) => m.domain === "affect")
  );
}

// ----------------------------------------------------------------------------------
// §10 — application statuses and identity laws
// ----------------------------------------------------------------------------------

describe("AFFECT_EVENT_AUTHORITY_V0 — application status derivation", () => {
  it("LEGACY_ALREADY_APPLIED: verified event cause + committed Affect-domain Observation write", async () => {
    const world = await buildAffectWorld();
    const eventRef = await recordIngress(world, "evt-legacy-1");
    const o2 = await commitSourceObservation(world, { observationId: "observation:o-legacy-1", eventRef });

    const before = await readSurface(world.core);
    const resolution = await authorityOf(world.core).resolveApplicationStatus({
      subject_id: SUBJECT_ID,
      factual_event_ref: eventRef as never,
      initial_appraisal_exists: false
    });
    // §21: the shadow status derivation is read-only with respect to SubjectState.
    expect(await readSurface(world.core)).toEqual(before);

    expect(resolution.status).toBe("LEGACY_ALREADY_APPLIED");
    expect(resolution.legacy_bundle_ref).toBe(o2.commit_ref);
    expect(resolution.detail).toContain("exactly-once");
  });

  it("CANONICAL_PENDING: canonical INITIAL appraisal exists, no trusted Affect application; no state write", async () => {
    const world = await buildAffectWorld();
    // Verified factual event, zero trusted Affect application in history.
    const eventRef = await recordIngress(world, "evt-pending-1");

    const before = await readSurface(world.core);
    const resolution = await authorityOf(world.core).resolveApplicationStatus({
      subject_id: SUBJECT_ID,
      factual_event_ref: eventRef as never,
      initial_appraisal_exists: true
    });
    expect(await readSurface(world.core)).toEqual(before);

    expect(resolution.status).toBe("CANONICAL_PENDING");
    expect(resolution.legacy_bundle_ref).toBeNull();

    // Without a canonical INITIAL appraisal the same history is NOT_ELIGIBLE.
    const ineligible = await authorityOf(world.core).resolveApplicationStatus({
      subject_id: SUBJECT_ID,
      factual_event_ref: eventRef as never,
      initial_appraisal_exists: false
    });
    expect(ineligible.status).toBe("NOT_ELIGIBLE");
  });

  it("SHADOW routing: legacy application first, canonical Appraisal second ⇒ LEGACY_ALREADY_APPLIED, read-only", async () => {
    const world = await buildAffectWorld();
    const eventRef = await recordIngress(world, "evt-shadow-1");
    const o2 = await commitSourceObservation(world, { observationId: "observation:o-shadow-1", eventRef });

    const bundleCountBefore = world.core.storeRead.getCommittedBundles().length;
    const before = await readSurface(world.core);
    const resolution = await authorityOf(world.core).resolveApplicationStatus({
      subject_id: SUBJECT_ID,
      factual_event_ref: eventRef as never,
      initial_appraisal_exists: true
    });

    // The canonical shadow query changed nothing: no new bundle, no state write.
    expect(world.core.storeRead.getCommittedBundles().length).toBe(bundleCountBefore);
    expect(await readSurface(world.core)).toEqual(before);

    expect(resolution.status).toBe("LEGACY_ALREADY_APPLIED");
    expect(resolution.legacy_bundle_ref).toBe(o2.commit_ref);
  });

  it("UNPROVEN_LEGACY_LINEAGE: affect-writing history without verified event lineage is quarantined", async () => {
    const world = await buildAffectWorld();
    // A committed affect-writing Observation whose cause set carries NO
    // event-kind ref: it cannot prove which factual events it consumed (§33).
    await commitSourceObservation(world, { observationId: "observation:o-unproven-1", eventRef: null });

    for (const initialAppraisalExists of [false, true]) {
      const resolution = await authorityOf(world.core).resolveApplicationStatus({
        subject_id: SUBJECT_ID,
        factual_event_ref: "event:" + "a".repeat(64) as never,
        initial_appraisal_exists: initialAppraisalExists
      });
      // Quarantine — never CANONICAL_PENDING (which would permit replay).
      expect(resolution.status).toBe("UNPROVEN_LEGACY_LINEAGE");
      expect(resolution.status).not.toBe("CANONICAL_PENDING");
      expect(resolution.legacy_bundle_ref).toBeNull();
    }
  });
});

describe("AFFECT_EVENT_AUTHORITY_V0 — eligibility identity laws", () => {
  it("dynamics-version independence: eligibility excludes dynamics; the execution seam carries it", async () => {
    const eventRef = "event:" + "b".repeat(64);
    const input = {
      subject_id: SUBJECT_ID,
      factual_event_ref: eventRef as never,
      semantic_appraisal_episode: "INITIAL" as const
    };
    const eligibility = await deriveAffectEligibilityIdentityV0(input);
    // Re-derivation — including under any future dynamics version — is identical.
    const eligibilityAgain = await deriveAffectEligibilityIdentityV0(input);
    expect(eligibilityAgain).toBe(eligibility);

    // The execution identity DOES carry the dynamics version and may differ.
    const executionV0 = await deriveAffectExecutionIdentityV0({
      eligibility_identity: eligibility,
      dynamics_version: "FAST_EMA_V0"
    });
    const executionV1 = await deriveAffectExecutionIdentityV0({
      eligibility_identity: eligibility,
      dynamics_version: "FAST_EMA_V1"
    });
    expect(executionV1).not.toBe(executionV0);

    // REAPPRAISAL is a different semantic episode (never reopens INITIAL).
    const reappraisal = await deriveAffectEligibilityIdentityV0({
      ...input,
      semantic_appraisal_episode: "REAPPRAISAL"
    });
    expect(reappraisal).not.toBe(eligibility);
  });

  it("different events / same text: distinct source_event_ids ⇒ distinct event refs and eligibility identities", async () => {
    const world = await buildAffectWorld();
    // Identical actor + text; only source_event_id differs.
    const eventX = await recordIngress(world, "evt-same-text-x");
    const eventY = await recordIngress(world, "evt-same-text-y");
    expect(eventX).not.toBe(eventY);

    const eligibilityX = await deriveAffectEligibilityIdentityV0({
      subject_id: SUBJECT_ID,
      factual_event_ref: eventX as never,
      semantic_appraisal_episode: "INITIAL"
    });
    const eligibilityY = await deriveAffectEligibilityIdentityV0({
      subject_id: SUBJECT_ID,
      factual_event_ref: eventY as never,
      semantic_appraisal_episode: "INITIAL"
    });
    expect(eligibilityX).not.toBe(eligibilityY);

    // Same source_event_id with identical facts re-derives the SAME event ref.
    const ledger = world.container.conversationIngressLedger;
    if (ledger === null) throw new Error("fixture invariant: ingress ledger wired");
    const replayOutcome = await ledger.recordIngressEvent({
      schema_version: "conversation-ingress-input-v0",
      subject_id: SUBJECT_ID,
      conversation_id: CONVERSATION_ID,
      actor_ref: ALICE,
      text: REPLY_TEXT,
      logical_time: 0,
      source_event_id: "evt-same-text-x",
      in_reply_to_delivery_id: null,
      host_adapter: "test-adapter"
    });
    expect(replayOutcome.kind).toBe("REPLAY");
    if (replayOutcome.kind === "REPLAY") {
      expect(replayOutcome.record.event_ref).toBe(eventX);
    }
  });
});

// ----------------------------------------------------------------------------------
// §11/§12/§13-16 — retry, concurrency, restore
// ----------------------------------------------------------------------------------

describe("AFFECT_EVENT_AUTHORITY_V0 — exactly-once proofs", () => {
  it("retry: duplicate submission after unrelated state advance re-derives consumed; no second application", async () => {
    const world = await buildAffectWorld();
    const eventRef = await recordIngress(world, "evt-retry-1");
    await commitSourceObservation(world, { observationId: "observation:o-retry-1", eventRef });

    // State revision advances for an UNRELATED reason (plain Observation, no event).
    await commitSourceObservation(world, { observationId: "observation:o-unrelated-1", eventRef: null });
    const revisionAfterAdvance = (await world.core.readCurrentSnapshot(SUBJECT_ID as never)) as SubjectStateV0;
    expect(revisionAfterAdvance.runtime_metadata.state_revision).toBeGreaterThan(0);

    // The same event X is submitted/reconciled again at the new head.
    const before = await readSurface(world.core);
    const resolution = await authorityOf(world.core).resolveApplicationStatus({
      subject_id: SUBJECT_ID,
      factual_event_ref: eventRef as never,
      initial_appraisal_exists: false
    });
    expect(resolution.status).toBe("LEGACY_ALREADY_APPLIED");

    // Exactly one event-level legacy consumption; no new Affect application.
    const consumption = bundlesConsumingEvent(world.core.storeRead.getCommittedBundles(), eventRef);
    expect(consumption).toHaveLength(1);
    expect(resolution.legacy_bundle_ref).toBe(consumption[0]?.commit_ref);

    // Affect/Mood unchanged from the duplicate attempt (no provider seam exists
    // on this derivation path at all — pure trusted-history read).
    expect(await readSurface(world.core)).toEqual(before);
  });

  it("concurrency: same-head race for the same event ⇒ exactly one legacy consumption; loser reconciles to consumed", async () => {
    const world = await buildAffectWorld();
    const eventRef = await recordIngress(world, "evt-race-1");
    const head = (await world.core.readCurrentSnapshot(SUBJECT_ID as never)) as SubjectStateV0;

    // Two racing attempts for the SAME verified event X, both built from the
    // same head with honest fingerprints (same-head race semantics).
    const buildAttempt = async (observationId: string) => {
      const proposal = await buildRaceProposal(world, eventRef, observationId, head);
      return {
        proposal,
        capabilities: {
          preparedBinding: {
            prepared_result_ref: "workflow:w-affect-race" as never,
            transition_id: proposal.transition_id,
            subject_id: proposal.subject_id,
            transition_type: proposal.transition_type,
            payload_fingerprint: await proposalFingerprint(proposal)
          },
          repository_bindings: await currentMemoryBindings(world.repo, head)
        } as TransitionCapabilities
      };
    };
    const winner = await buildAttempt("observation:o-race-a");
    const loser = await buildAttempt("observation:o-race-b");

    // The winner goes through the full lawful executor path and commits.
    const firstOutcome = await world.observationExecutor.execute(
      {
        subject_id: SUBJECT_ID as never,
        current_logical_time: head.runtime_metadata.logical_time as never,
        state_revision: head.runtime_metadata.state_revision as never
      },
      observationInput({
        observation_id: "observation:o-race-a",
        source_refs: [eventRef, "source:s-3"],
        entity_refs: [ALICE, "subject:s0"]
      }),
      winner.capabilities
    );
    expect(firstOutcome.kind).toBe("COMMITTED");

    // The stale loser is rejected by the existing CAS behavior (reserved from
    // the same head, committed against the advanced head) — no lock manager.
    const reserved = await world.core.reserveAndRoute(loser.proposal);
    expect(reserved.kind).toBe("CONTINUE");
    if (reserved.kind !== "CONTINUE") return;
    const loserOutcome = await world.core.commitReserved({
      proposal: loser.proposal,
      continuation: reserved.continuation,
      producerAuthorization: world.core.issuer.issue([
        { producer: "affect", domain: "affect" },
        { producer: "context", domain: "context" }
      ]),
      preparedBinding: loser.capabilities.preparedBinding,
      repository_bindings: loser.capabilities.repository_bindings as never
    });
    expect(loserOutcome.kind).toBe("REJECTED");
    if (loserOutcome.kind === "REJECTED") {
      expect(loserOutcome.failure.error_code).toBe("STALE_STATE_REVISION");
    }

    // The loser rescans current trusted history and reconciles to consumed.
    const consumption = bundlesConsumingEvent(world.core.storeRead.getCommittedBundles(), eventRef);
    expect(consumption).toHaveLength(1);
    const resolution = await authorityOf(world.core).resolveApplicationStatus({
      subject_id: SUBJECT_ID,
      factual_event_ref: eventRef as never,
      initial_appraisal_exists: false
    });
    expect(resolution.status).toBe("LEGACY_ALREADY_APPLIED");
    expect(resolution.legacy_bundle_ref).toBe(consumption[0]?.commit_ref);
  });

  it("restore: fresh runtime over the trusted complete bundle history still derives consumed", async () => {
    const world = await buildAffectWorld();
    const eventRef = await recordIngress(world, "evt-restore-1");
    const o2 = await commitSourceObservation(world, { observationId: "observation:o-restore-1", eventRef });

    const liveEligibility = await deriveAffectEligibilityIdentityV0({
      subject_id: SUBJECT_ID,
      factual_event_ref: eventRef as never,
      semantic_appraisal_episode: "INITIAL"
    });
    const liveResolution = await authorityOf(world.core).resolveApplicationStatus({
      subject_id: SUBJECT_ID,
      factual_event_ref: eventRef as never,
      initial_appraisal_exists: false
    });
    expect(liveResolution.status).toBe("LEGACY_ALREADY_APPLIED");

    // ---- serialize / rehydrate the supported canonical surface -----------------
    const committedBundles = world.core.storeRead.getCommittedBundles();
    const headBundle = committedBundles.at(-1);
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

    // ---- fresh runtime: trusted complete AtomicCommitBundleV2 history directly --
    const freshCore = createCore(restore.snapshot, committedBundles);
    const freshResolution = await authorityOf(freshCore).resolveApplicationStatus({
      subject_id: SUBJECT_ID,
      factual_event_ref: eventRef as never,
      initial_appraisal_exists: false
    });
    // Consumption derives from validated committed history + current-head
    // binding — never from a process-local transition journal.
    expect(freshResolution.status).toBe("LEGACY_ALREADY_APPLIED");
    expect(freshResolution.legacy_bundle_ref).toBe(o2.commit_ref);
    expect(freshResolution.eligibility_identity).toBe(liveEligibility);
  });
});

// §14/§15 note: the V0 authority consumes `readCommittedBundlesForSubject` over
// validated committed bundles only. RESTORED_TRANSITION_JOURNAL_REBUILD_GAP (the
// seeded facade does not rebuild the transition identity journal) does not affect
// this derivation path and remains a separate follow-up issue.
