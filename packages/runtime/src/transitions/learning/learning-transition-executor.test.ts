/**
 * P2.3.5.3c — Learning repository prepare + canonical adoption (happy path)
 * integration suite. Real 3a trusted-source validation, real ExperienceEncoderV0,
 * real InMemoryMemoryRepository (intent-driven prepare + idempotency), real
 * SubjectCore canonical path (two-call protocol + R2-H adoption gate).
 *
 * Proves: one trusted experience ⇒ one record ⇒ one prepare ⇒ ONE canonical
 * commit binding R1 (+1 revision, logical time unchanged, memory-content domain
 * only, all other state bytes unchanged); prepare-then-canonical-failure leaves
 * the prepared candidate as a non-canonical orphan with retrieval still on R0;
 * intent idempotency and prepare-conflict normalization; ownership attacks
 * cannot bypass canonical validation after a successful prepare.
 */

import { beforeAll, describe, expect, it } from "vitest";

import type {
  AtomicCommitBundleAnyVersion,
  CanonicalTransitionProposalV1,
  DomainDeltaV0,
  InMemoryFacadeAssembly,
  ProducerAuthorizationIssuer,
  SubjectStateV0
} from "@characteros-next/subject-core";
import { createInMemorySubjectCoreFacade, proposalFingerprint } from "@characteros-next/subject-core";
import {
  InMemoryMemoryRepository,
  computeRepositoryRevisionHash,
  retrievalQueryFingerprint,
  type MemoryPreparationAuthority,
  type MemoryRetrievalQueryV0,
  type MemoryRetrievalResultV0
} from "@characteros-next/memory";
import { buildContextDelta, ReferenceContextProducer } from "../../ports/context-producer-port.js";
import {
  buildObservationHarness,
  capabilitiesFor,
  fixedAppraisal,
  fixedInterpretation,
  observationInput
} from "../observation/observation-fixtures.js";
import {
  buildObservationProposal,
  ObservationTransitionExecutor
} from "../observation/observation-transition-executor.js";
import { ReferenceFastEmaAffectProducer } from "../../producers/reference-fast-ema-affect-producer.js";
import { RuntimeCompositionRoot } from "../../composition/runtime-composition-root.js";
import type { SubjectCorePort } from "../../ports/subject-core-port.js";
import {
  buildLearningProposal,
  LearningTransitionExecutor
} from "./learning-transition-executor.js";
import type { LearningAdoptionAuthority } from "./learning-adoption-authority.js";
import type { LearningSourceReadAuthority } from "./learning-source-authority.js";
import { TransitionStageFailure } from "../common.js";

const SUBJECT_ID = "subject-s0";
const OBSERVATION_ID = "observation:o-lc77";

interface TestCore extends SubjectCorePort {
  readonly storeRead: {
    readCurrentBundle(subjectId: string): AtomicCommitBundleAnyVersion | null;
    readCommittedByTransitionId(id: string): AtomicCommitBundleAnyVersion | null;
    getCommittedBundles(): readonly AtomicCommitBundleAnyVersion[];
    currentRevision(subjectId: string): number | null;
  };
  readonly issuer: ProducerAuthorizationIssuer;
}

/** In-memory subject-core facade seeded for one subject, with Learning gates wired. */
function createLearningTestCore(
  snapshot: SubjectStateV0,
  subjectId: string,
  memoryRepository: InMemoryMemoryRepository,
  adoptionGate: { open: boolean } = { open: true }
): TestCore {
  const assembly: InMemoryFacadeAssembly = createInMemorySubjectCoreFacade({
    seedSnapshots: new Map([[subjectId as never, snapshot]]),
    preparedResultValidator: async (binding) =>
      binding.prepared_result_ref.startsWith("workflow:w-learn-") ||
      // The concurrent-Observation injector uses the fixture's trusted ref.
      binding.prepared_result_ref === "workflow:w-obs-1",
    // R2-F: verdict-only repository binding proof delegated to the real repository.
    referenceValidator: async (binding) =>
      memoryRepository.validateRevisionBinding(
        binding as unknown as Parameters<MemoryPreparationAuthority["validateRevisionBinding"]>[0]
      ),
    // R2-H: verdict-only adoption proof — the candidate revision must exist in the
    // repository AND match its recorded content hash. `adoptionGate` models an
    // externally-driven adoption refusal for the §27 orphan scenario.
    memoryAdoptionValidator: async (adoption) => {
      if (!adoptionGate.open) return false;
      if (adoption.next_repository_revision_hash === null) return false;
      return memoryRepository.validateRevisionBinding({
        repository_revision: adoption.next_repository_revision,
        repository_revision_hash: adoption.next_repository_revision_hash
      } as unknown as Parameters<MemoryPreparationAuthority["validateRevisionBinding"]>[0]);
    }
  });
  const port: SubjectCorePort = {
    reserveAndRoute: (proposal) => assembly.facade.reserveAndRoute(proposal),
    commitReserved: (input) => assembly.facade.commitReserved(input),
    terminalizeReservedNoOp: (input) => assembly.facade.terminalizeReservedNoOp(input),
    reconcile: (transitionId, subjectId, fingerprint) =>
      assembly.facade.reconcile(transitionId, subjectId, fingerprint),
    readCurrentSnapshot: async (id) => {
      const bundle = assembly.storeRead.readCurrentBundle(id);
      return bundle !== null ? bundle.next_snapshot : snapshot;
    }
  };
  return {
    ...port,
    issuer: assembly.producerAuthorizationIssuer,
    storeRead: assembly.storeRead
  };
}

/**
 * Replay-modeling wrapper (time-executor frozenView pattern): the anchor view is
 * frozen at a fixed snapshot while reservation/commit/reconcile delegate to the
 * shared store + journal, so the identical proposal re-enters reserveAndRoute
 * and hits ALREADY_COMMITTED instead of re-committing.
 */
class FrozenViewCorePort implements SubjectCorePort {
  constructor(
    private readonly inner: SubjectCorePort,
    private readonly frozen: SubjectStateV0
  ) {}
  reserveAndRoute(proposal: Parameters<SubjectCorePort["reserveAndRoute"]>[0]) {
    return this.inner.reserveAndRoute(proposal);
  }
  commitReserved(input: Parameters<SubjectCorePort["commitReserved"]>[0]) {
    return this.inner.commitReserved(input);
  }
  terminalizeReservedNoOp(input: Parameters<SubjectCorePort["terminalizeReservedNoOp"]>[0]) {
    return this.inner.terminalizeReservedNoOp(input);
  }
  reconcile: SubjectCorePort["reconcile"] = (transitionId, subjectId, fingerprint) =>
    this.inner.reconcile(transitionId, subjectId, fingerprint);
  readCurrentSnapshot: SubjectCorePort["readCurrentSnapshot"] = async () => this.frozen;
}

/** Counting delegation wrapper over the REAL repository (zero-write evidence). */
class CountingMemoryAuthority implements MemoryPreparationAuthority {
  prepareCalls = 0;
  storeCalls = 0;
  lastPreparedRevision: string | null = null;
  constructor(private readonly inner: InMemoryMemoryRepository) {}
  async storePayload(ref: Parameters<MemoryPreparationAuthority["storePayload"]>[0], payload: unknown) {
    this.storeCalls += 1;
    return this.inner.storePayload(ref, payload);
  }
  async payloadHashOf(ref: Parameters<MemoryPreparationAuthority["payloadHashOf"]>[0]) {
    return this.inner.payloadHashOf(ref);
  }
  async prepareRevisionForIntent(intent: Parameters<MemoryPreparationAuthority["prepareRevisionForIntent"]>[0]) {
    this.prepareCalls += 1;
    const prepared = await this.inner.prepareRevisionForIntent(intent);
    this.lastPreparedRevision = prepared.repository_revision as string;
    this.preparedLog.push(prepared.repository_revision as string);
    return prepared;
  }
  /** Ordered log of every revision minted through this authority (3d evidence). */
  readonly preparedLog: string[] = [];
  async readManifest(revision: Parameters<MemoryPreparationAuthority["readManifest"]>[0]) {
    return this.inner.readManifest(revision);
  }
  async validateRevisionBinding(binding: Parameters<MemoryPreparationAuthority["validateRevisionBinding"]>[0]) {
    return this.inner.validateRevisionBinding(binding);
  }
  async validateRefsBelong(
    revision: Parameters<MemoryPreparationAuthority["validateRefsBelong"]>[0],
    refs: Parameters<MemoryPreparationAuthority["validateRefsBelong"]>[1]
  ) {
    return this.inner.validateRefsBelong(revision, refs);
  }
}

/** Counting wrapper over the real SubjectCorePort (zero-canonical-write evidence). */
class CountingCorePort implements SubjectCorePort {
  reserveCalls = 0;
  commitCalls = 0;
  constructor(private readonly inner: SubjectCorePort) {}
  async reserveAndRoute(proposal: Parameters<SubjectCorePort["reserveAndRoute"]>[0]) {
    this.reserveCalls += 1;
    return this.inner.reserveAndRoute(proposal);
  }
  async commitReserved(input: Parameters<SubjectCorePort["commitReserved"]>[0]) {
    this.commitCalls += 1;
    return this.inner.commitReserved(input);
  }
  async terminalizeReservedNoOp(input: Parameters<SubjectCorePort["terminalizeReservedNoOp"]>[0]) {
    return this.inner.terminalizeReservedNoOp(input);
  }
  reconcile: SubjectCorePort["reconcile"] = (transitionId, subjectId, fingerprint) =>
    this.inner.reconcile(transitionId, subjectId, fingerprint);
  readCurrentSnapshot: SubjectCorePort["readCurrentSnapshot"] = (subjectId) =>
    this.inner.readCurrentSnapshot(subjectId);
}

interface World {
  core: CountingCorePort;
  issuer: ProducerAuthorizationIssuer;
  memory: CountingMemoryAuthority;
  rawMemory: InMemoryMemoryRepository;
  storeRead: TestCore["storeRead"];
  sourceStoreRead: { readCommittedByTransitionId(id: string): AtomicCommitBundleAnyVersion | null };
  seedSnapshot: SubjectStateV0;
  adoptionGate: { open: boolean };
  learningExecutor: LearningTransitionExecutor;
  observationExecutor: ObservationTransitionExecutor;
  observationBundle: AtomicCommitBundleAnyVersion;
  observationSnapshot: SubjectStateV0;
}

const world = {} as World;

/** Host-minted narrow adoption projection over the concrete repository (§12). */
function adoptionSeam(raw: InMemoryMemoryRepository): LearningAdoptionAuthority {
  return {
    markAdopted: (r) => raw.markAdopted(r),
    isAdopted: (r) => raw.isAdopted(r)
  };
}

/**
 * Permissive LEGAL-EMPTY retrieval for the concurrent-Observation injector: the
 * observation runs against whichever revision is canonical at injection time,
 * which no fixed rehearsal table can enumerate. Deterministic, zero selections.
 */
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

/**
 * Composite read face over ALL committed stores — mirrors the production
 * single-store readCommittedByTransitionId scan so the durable Observation
 * source is FINDABLE regardless of which store holds it; the semantic checks
 * (not the lookup) do the rejecting.
 */
function chainedSourceAuthority(): LearningSourceReadAuthority {
  return {
    readCommittedBundle: async (id) =>
      world.storeRead.readCommittedByTransitionId(id) ??
      world.sourceStoreRead.readCommittedByTransitionId(id)
  };
}

function candidateFor(bundle: AtomicCommitBundleAnyVersion, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    subject_id: bundle.subject_id,
    source_transition_id: bundle.transition_id,
    observation_ref: bundle.trace_entry.cause_refs[0],
    entity_refs: ["entity:e-1", "subject:s0"],
    event_refs: ["event:v-2"],
    occurrence_logical_time: bundle.logical_time_after,
    appraisal_ref: null,
    scene: bundle.next_snapshot.context.scene,
    focus_refs: [...bundle.next_snapshot.context.focus_refs],
    environment_refs: [...bundle.next_snapshot.context.environment_refs],
    declared_salience: 0.42,
    ...overrides
  };
}

beforeAll(async () => {
  const rawMemory = new InMemoryMemoryRepository();
  // Genesis R0 is a host/infrastructure duty (raw surface, outside runtime).
  await rawMemory.prepareRevision({ parent_revision: null, records: [] });
  const memory = new CountingMemoryAuthority(rawMemory);

  // Committed Observation source (real affect producer ⇒ durable appraisal evidence).
  const observationHarness = buildObservationHarness({
    affectProducer: new ReferenceFastEmaAffectProducer()
  });
  const baseline = (await observationHarness.core.readCurrentSnapshot(SUBJECT_ID)) as SubjectStateV0;
  const observationCtx = {
    subject_id: SUBJECT_ID as never,
    current_logical_time: baseline.runtime_metadata.logical_time as never,
    state_revision: baseline.runtime_metadata.state_revision as never
  };
  const observation = observationInput({ observation_id: OBSERVATION_ID });
  const affectDelta = await new ReferenceFastEmaAffectProducer().produceAffectDelta({
    context: observationCtx,
    snapshot: baseline,
    transition_type: "Observation",
    appraisal: {
      schema_version: "appraisal-v0",
      appraisal_ref: `appraisal:ap-${OBSERVATION_ID.replace(":", "-")}`,
      evidence_refs: ["episode:e-9"],
      relevance: 0.9,
      goal_congruence: 0.9,
      attribution: "situation" as never,
      controllability: 0.9,
      uncertainty: 0.9,
      intensity: 0.9
    } as never,
    elapsed_ticks: null
  });
  const contextDelta = await buildContextDelta(observation, baseline);
  const observationProposal = await buildObservationProposal({
    subjectId: SUBJECT_ID,
    stateRevision: baseline.runtime_metadata.state_revision as number,
    observation,
    deltas: [affectDelta, contextDelta]
  });
  const observationOutcome = await observationHarness.executor.execute(
    observationCtx,
    observation,
    await capabilitiesFor(observationProposal)
  );
  if (observationOutcome.kind !== "COMMITTED") throw new Error("fixture invariant: source Observation must commit");
  const observationBundle = observationHarness.core.storeRead.readCommittedByTransitionId(
    observationOutcome.bundle.transition_id
  );
  if (observationBundle === null) throw new Error("fixture invariant: bundle must be readable");

  // Learning composition: real repository + Learning gates, anchored on the
  // pre-Observation baseline (revision 0 — this store's first canonical commit
  // is the Learning itself; the Observation is durable external evidence).
  const adoptionGate = { open: true };
  const core = createLearningTestCore(baseline, SUBJECT_ID, rawMemory, adoptionGate);
  const countingCore = new CountingCorePort(core);
  const root = new RuntimeCompositionRoot({
    subjectCore: countingCore,
    producerAuthorizationIssuer: core.issuer,
    memoryRepository: memory,
    retrieval: {
      retrieve: async () => {
        throw new Error("Learning never calls retrieval");
      }
    },
    learningSourceAuthority: chainedSourceAuthority(),
    // Narrow adoption seam over the concrete repository (host-minted projection).
    learningAdoptionAuthority: adoptionSeam(rawMemory)
  });
  const learningExecutor = new LearningTransitionExecutor(root.dependencies());

  world.core = countingCore;
  world.issuer = core.issuer;
  world.storeRead = core.storeRead;
  world.sourceStoreRead = observationHarness.core.storeRead;
  world.seedSnapshot = baseline;
  world.adoptionGate = adoptionGate;
  world.memory = memory;
  world.rawMemory = rawMemory;
  world.learningExecutor = learningExecutor;
  // Observation executor over the SAME world core — 3d concurrent-transition
  // injector for the stale scenarios where the repository binding stays put.
  const observationRoot = new RuntimeCompositionRoot({
    subjectCore: countingCore,
    producerAuthorizationIssuer: core.issuer,
    memoryRepository: rawMemory,
    retrieval: permissiveRetrieval,
    interpretation: fixedInterpretation(),
    appraisal: fixedAppraisal(0.9, undefined, "situation"),
    affectProducer: new ReferenceFastEmaAffectProducer(),
    contextProducer: new ReferenceContextProducer()
  });
  world.observationExecutor = new ObservationTransitionExecutor(observationRoot.dependencies());
  world.observationBundle = observationBundle;
  world.observationSnapshot = observationBundle.next_snapshot;
});

describe("P2.3.5.3c Learning prepare + canonical adoption", () => {
  it("§26 happy path: trusted experience ⇒ one prepare ⇒ ONE canonical adoption binding R1", async () => {
    const bundleA = world.observationBundle as AtomicCommitBundleAnyVersion;
    const preRevision = world.seedSnapshot.runtime_metadata.state_revision as number;
    const outcome = await (world.learningExecutor as LearningTransitionExecutor).execute(
      {
        subject_id: SUBJECT_ID as never,
        current_logical_time: world.seedSnapshot.runtime_metadata.logical_time as never,
        state_revision: preRevision as never
      },
      { candidate: candidateFor(bundleA) as never }
    );
    expect(outcome.kind, `HAPPY-PATH-FAILURE: ${JSON.stringify(outcome)}`).toBe("COMMITTED");
    if (outcome.kind !== "COMMITTED") return;

    // Exactly one canonical commit: +1 revision, logical time unchanged, and the
    // window gains exactly ONE Learning trace entry.
    expect(outcome.bundle.next_revision).toBe(preRevision + 1);
    expect(outcome.bundle.logical_time_before).toBe(0);
    expect(outcome.bundle.logical_time_after).toBe(0);
    expect(world.storeRead.getCommittedBundles()).toHaveLength(1);
    const next = outcome.bundle.next_snapshot;
    expect(next.trace_window.entries).toHaveLength(1);
    const traceEntry = next.trace_window.entries[0];
    if (traceEntry === undefined) throw new Error("expected trace entry");
    expect(traceEntry.domain_mutations.map((m) => m.domain)).toEqual(["memory-content"]);

    // R1 binding: new revision, != R0, bound by the next SubjectState.
    const boundRevision = next.memory_state.repository_revision;
    expect(boundRevision).toBe("R1");
    expect(boundRevision).not.toBe(world.seedSnapshot.memory_state.repository_revision);
    // All other memory-content paths remain UNCHANGED (V0 exactly-one adoption).
    expect(next.memory_state.active_episode_refs).toEqual(
      world.seedSnapshot.memory_state.active_episode_refs
    );
    expect(next.memory_state.autobiographical_index_revision).toBe(
      world.seedSnapshot.memory_state.autobiographical_index_revision
    );
    expect(next.memory_state.consolidation_cursor).toBe(
      world.seedSnapshot.memory_state.consolidation_cursor
    );
    expect(next.memory_state.pending_encoding_refs).toEqual(
      world.seedSnapshot.memory_state.pending_encoding_refs
    );
    expect(next.memory_state.lifecycle_metadata).toEqual(
      world.seedSnapshot.memory_state.lifecycle_metadata
    );

    // Everything outside the Learning-owned paths is byte-unchanged against the
    // pre-Learning canonical state.
    expect(JSON.stringify(next.affect)).toBe(JSON.stringify(world.seedSnapshot.affect));
    expect(JSON.stringify(next.mood)).toBe(JSON.stringify(world.seedSnapshot.mood));
    expect(JSON.stringify(next.context)).toBe(JSON.stringify(world.seedSnapshot.context));
    expect(JSON.stringify(next.regulation)).toBe(JSON.stringify(world.seedSnapshot.regulation));

    // Adoption validation surfaces: bundle carries the repository binding.
    const binding = outcome.bundle.repository_revision_bindings.find(
      (b) => b.repository_revision === boundRevision
    );
    expect(binding).toBeDefined();
    // §5 frozen lifecycle completion: the canonically bound candidate revision
    // is marked adopted in the repository AFTER the successful bind.
    expect(world.rawMemory.isAdopted(boundRevision as never)).toBe(true);
  });

  it("§26 cont.: second identical replay ⇒ ALREADY_COMMITTED, no second commit, same prepared revision", async () => {
    const bundleA = world.observationBundle as AtomicCommitBundleAnyVersion;
    // Replay observes the frozen pre-Learning anchor view (time-executor
    // frozenView pattern, shared store + journal): same anchored basis ⇒ same
    // deterministic identity ⇒ reserveAndRoute replays the committed bundle.
    const replayCore = new FrozenViewCorePort(world.core as CountingCorePort, world.seedSnapshot);
    const replayRoot = new RuntimeCompositionRoot({
      subjectCore: replayCore,
      producerAuthorizationIssuer: world.issuer,
      memoryRepository: world.memory as CountingMemoryAuthority,
      retrieval: {
        retrieve: async () => {
          throw new Error("Learning never calls retrieval");
        }
      },
      learningSourceAuthority: chainedSourceAuthority(),
      learningAdoptionAuthority: adoptionSeam(world.rawMemory as InMemoryMemoryRepository)
    });
    const replayExecutor = new LearningTransitionExecutor(replayRoot.dependencies());
    const bundlesBefore = world.storeRead.getCommittedBundles().length;
    const outcome = await replayExecutor.execute(
      {
        subject_id: SUBJECT_ID as never,
        current_logical_time: world.seedSnapshot.runtime_metadata.logical_time as never,
        state_revision: world.seedSnapshot.runtime_metadata.state_revision as never
      },
      { candidate: candidateFor(bundleA) as never }
    );
    expect(outcome.kind).toBe("COMMITTED");
    expect(world.storeRead.getCommittedBundles().length).toBe(bundlesBefore);
    // Same intent ⇒ idempotent prepare returns the SAME canonical revision.
    expect(world.memory.lastPreparedRevision).toBe("R1");
    expect(outcome.kind === "COMMITTED" && outcome.bundle.next_revision).toBe(
      (world.seedSnapshot.runtime_metadata.state_revision as number) + 1
    );
  });

  it("§28: same intent_id + different fingerprint ⇒ normalized prepare conflict (canonical +0)", async () => {
    const bundleA = world.observationBundle as AtomicCommitBundleAnyVersion;
    const bundlesBefore = world.storeRead.getCommittedBundles().length;
    // Same Learning basis (frozen pre-Learning anchor view ⇒ same intent_id and
    // same episode_ref); only declared_salience differs ⇒ payload bytes differ.
    const conflictCore = new FrozenViewCorePort(world.core as CountingCorePort, world.seedSnapshot);
    const conflictRoot = new RuntimeCompositionRoot({
      subjectCore: conflictCore,
      producerAuthorizationIssuer: world.issuer,
      memoryRepository: world.memory as CountingMemoryAuthority,
      retrieval: {
        retrieve: async () => {
          throw new Error("Learning never calls retrieval");
        }
      },
      learningSourceAuthority: chainedSourceAuthority(),
      learningAdoptionAuthority: adoptionSeam(world.rawMemory as InMemoryMemoryRepository)
    });
    const conflictExecutor = new LearningTransitionExecutor(conflictRoot.dependencies());
    const error: unknown = await conflictExecutor
      .execute(
        {
          subject_id: SUBJECT_ID as never,
          current_logical_time: world.seedSnapshot.runtime_metadata.logical_time as never,
          state_revision: world.seedSnapshot.runtime_metadata.state_revision as never
        },
        { candidate: candidateFor(bundleA, { declared_salience: 0.9 }) as never }
      )
      .then(() => null, (e) => e);
    expect(error).toBeInstanceOf(TransitionStageFailure);
    if (!(error instanceof TransitionStageFailure)) return;
    expect(error.stage).toBe("LEARNING");
    expect(error.error_code).toBe("SERVICE_UNAVAILABLE");
    expect(error.reason).toBe("FAIL-PREPARE-001");
    expect(world.storeRead.getCommittedBundles().length).toBe(bundlesBefore);
  });

  it("C1: untrusted candidate ⇒ typed rejection BEFORE any repository write", async () => {
    const bundleA = world.observationBundle as AtomicCommitBundleAnyVersion;
    const memory = world.memory as CountingMemoryAuthority;
    const prepareBefore = memory.prepareCalls;
    const storeBefore = memory.storeCalls;
    const bundlesBefore = world.storeRead.getCommittedBundles().length;
    const error: unknown = await (world.learningExecutor as LearningTransitionExecutor)
      .execute(
        { subject_id: SUBJECT_ID as never, current_logical_time: 0 as never, state_revision: 1 as never },
        {
          // Cross-subject borrowing: candidate claims a subject the runtime does not.
          candidate: candidateFor(bundleA, { subject_id: "subject-b" }) as never
        }
      )
      .then(() => null, (e) => e);
    expect(error).toBeInstanceOf(TransitionStageFailure);
    if (!(error instanceof TransitionStageFailure)) return;
    expect(error.error_code).toBe("UNKNOWN_SUBJECT");
    expect(error.reason).toBe("SS-AUTH-001");
    expect(memory.prepareCalls).toBe(prepareBefore);
    expect(memory.storeCalls).toBe(storeBefore);
    expect(world.storeRead.getCommittedBundles().length).toBe(bundlesBefore);
  });

  it("C3: repository prepare failure ⇒ ABORTED/FAIL-PREPARE-001, canonical +0, zero store writes", async () => {
    const bundleA = world.observationBundle as AtomicCommitBundleAnyVersion;
    const rawMemory = world.rawMemory as InMemoryMemoryRepository;
    // Failing authority delegates everything EXCEPT prepare, which throws.
    const failing: MemoryPreparationAuthority = {
      storePayload: (ref, payload) => rawMemory.storePayload(ref, payload),
      payloadHashOf: (ref) => rawMemory.payloadHashOf(ref),
      prepareRevisionForIntent: async () => {
        throw new Error("repository unavailable");
      },
      readManifest: (revision) => rawMemory.readManifest(revision),
      validateRevisionBinding: (binding) => rawMemory.validateRevisionBinding(binding),
      validateRefsBelong: (revision, refs) => rawMemory.validateRefsBelong(revision, refs)
    };
    const core = createLearningTestCore(bundleA.next_snapshot, SUBJECT_ID, rawMemory);
    const failingRoot = new RuntimeCompositionRoot({
      subjectCore: core,
      producerAuthorizationIssuer: core.issuer,
      memoryRepository: failing,
      retrieval: { retrieve: async () => { throw new Error("unused"); } },
      learningSourceAuthority: {
        readCommittedBundle: async (id) =>
          core.storeRead.readCommittedByTransitionId(id) ??
          world.sourceStoreRead.readCommittedByTransitionId(id)
      },
      learningAdoptionAuthority: adoptionSeam(rawMemory)
    });
    const failingExecutor = new LearningTransitionExecutor(failingRoot.dependencies());
    const error: unknown = await failingExecutor
      .execute(
        { subject_id: SUBJECT_ID as never, current_logical_time: 0 as never, state_revision: 1 as never },
        { candidate: candidateFor(bundleA) as never }
      )
      .then(() => null, (e) => e);
    expect(error).toBeInstanceOf(TransitionStageFailure);
    if (!(error instanceof TransitionStageFailure)) return;
    expect(error.error_code).toBe("SERVICE_UNAVAILABLE");
    expect(error.reason).toBe("FAIL-PREPARE-001");
    // The failing composition never committed anything anywhere.
    expect(core.storeRead.getCommittedBundles()).toHaveLength(0);
  });

  it("§27/G16: prepare success + canonical adoption rejection ⇒ non-canonical orphan, canonical stays bound", async () => {
    const bundleA = world.observationBundle as AtomicCommitBundleAnyVersion;
    const memory = world.memory as CountingMemoryAuthority;
    // Current canonical basis of the shared world (post happy path: revision 1, bound R1).
    const currentBundle = world.storeRead.readCurrentBundle(SUBJECT_ID);
    if (currentBundle === null) throw new Error("fixture invariant: canonical bundle must exist");
    const canonicalSnapshot = currentBundle.next_snapshot;
    // Close the R2-H adoption gate: canonical MUST reject although prepare
    // succeeds — CANONICAL_EXPOSURE_ATOMICITY_WITH_UNREACHABLE_PREPARES: the
    // prepared candidate revision must survive physically while canonical stays
    // bound. A distinct basis (revision 1) mints a fresh intent ⇒ fresh orphan.
    world.adoptionGate.open = false;
    const prepareCallsBefore = memory.prepareCalls;
    const bundlesBefore = world.storeRead.getCommittedBundles().length;
    let outcome: Awaited<ReturnType<LearningTransitionExecutor["execute"]>>;
    try {
      outcome = await (world.learningExecutor as LearningTransitionExecutor).execute(
        {
          subject_id: SUBJECT_ID as never,
          current_logical_time: canonicalSnapshot.runtime_metadata.logical_time as never,
          state_revision: canonicalSnapshot.runtime_metadata.state_revision as never
        },
        { candidate: candidateFor(bundleA) as never }
      );
    } finally {
      world.adoptionGate.open = true;
    }
    expect(outcome.kind).toBe("REJECTED");
    if (outcome.kind !== "REJECTED") return;
    expect(outcome.failure.error_code).toBe("INVALID_MEMORY_REVISION");
    expect(outcome.failure.reason).toBe("MEM-REV-001");

    // Canonical +0: no new bundle anywhere; the canonical binding is unchanged
    // (G17: retrieval authority follows the SubjectState binding, never the orphan).
    expect(world.storeRead.getCommittedBundles().length).toBe(bundlesBefore);
    const afterBundle = world.storeRead.readCurrentBundle(SUBJECT_ID);
    if (afterBundle === null) throw new Error("fixture invariant: canonical bundle must exist");
    expect(afterBundle.next_snapshot.memory_state.repository_revision).toBe(
      canonicalSnapshot.memory_state.repository_revision
    );

    // The prepare physically succeeded: the orphan candidate revision exists in
    // the repository but is NOT the canonical binding (unreachable from retrieval).
    expect(memory.prepareCalls).toBe(prepareCallsBefore + 1);
    const orphanRevision = memory.lastPreparedRevision;
    expect(orphanRevision).not.toBeNull();
    expect(orphanRevision).not.toBe(canonicalSnapshot.memory_state.repository_revision);
    const manifest = await (world.rawMemory as InMemoryMemoryRepository).readManifest(
      orphanRevision as never
    );
    expect(manifest).not.toBeNull();
    // §6: prepared ≠ adopted — a canonical refusal leaves the candidate
    // UNADOPTED (executable proof of prepared/adopted/canonically-exposed
    // being three distinct states).
    expect(world.rawMemory.isAdopted(orphanRevision as never)).toBe(false);
  });

  it("§29: ownership attack — memory-content delta writing /mood ⇒ rejected before reservation, canonical +0", async () => {
    const bundlesBefore = world.storeRead.getCommittedBundles().length;
    const currentBundle = world.storeRead.readCurrentBundle(SUBJECT_ID);
    if (currentBundle === null) throw new Error("fixture invariant: canonical bundle must exist");
    const canonicalSnapshot = currentBundle.next_snapshot;
    // Attack: a "memory"/"memory-content" delta reaching beyond the Learning-owned
    // binding path into affect-owned /mood. Canonical ownership validation must
    // reject the proposal BEFORE reservation; no executor pathway reaches commit.
    const attackDelta: DomainDeltaV0 = {
      producer: "memory",
      domain: "memory-content",
      expected_repository_revision: canonicalSnapshot.memory_state.repository_revision as never,
      operations: [
        { path: "/memory_state/repository_revision", value: "R-attack" as never },
        { path: "/mood", value: { baseline: 0.9, generated_under_profile: null, last_update: null } }
      ],
      provenance_refs: []
    } as unknown as DomainDeltaV0;
    const attackProposal = buildLearningProposal({
      learningTransitionId: "t-learn-attack-ownership-probe",
      subjectId: SUBJECT_ID,
      stateRevision: canonicalSnapshot.runtime_metadata.state_revision as number,
      occurrenceLogicalTime: canonicalSnapshot.runtime_metadata.logical_time as number,
      observationRef: "observation:o-lc77" as never,
      memoryDelta: attackDelta
    });
    const error: unknown = await (world.core as CountingCorePort)
      .reserveAndRoute(attackProposal)
      .then(() => null, (e) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain("INVALID_SCHEMA/SS-SCHEMA-001");
    // Canonical +0: the attack never reserved, never committed.
    expect(world.storeRead.getCommittedBundles().length).toBe(bundlesBefore);
  });
});

// ======================================================================================
// P2.3.5.3d — A12 crash/resume + A13 stale rebase hardening
// ======================================================================================

/**
 * Stale-injection wrapper (time-executor frozenView pattern): the anchor view is
 * frozen at the pre-attempt snapshot, and the FIRST commit attempt runs the
 * injector (a concurrent canonical transition) BEFORE delegating to the real
 * store — so the engine re-reads the advanced authority and rejects with
 * STALE_STATE_REVISION. After the first commit attempt the wrapper thaws: the
 * A13 reload (step 1) reads the REAL latest canonical state.
 */
class StaleInjectingCorePort implements SubjectCorePort {
  private thawed = false;
  constructor(
    private readonly inner: SubjectCorePort,
    private readonly frozen: SubjectStateV0,
    private readonly injectBeforeCommit: () => Promise<void>,
    private readonly everyCommit = false
  ) {}
  reserveAndRoute(proposal: Parameters<SubjectCorePort["reserveAndRoute"]>[0]) {
    return this.inner.reserveAndRoute(proposal);
  }
  async commitReserved(input: Parameters<SubjectCorePort["commitReserved"]>[0]) {
    if (!this.thawed || this.everyCommit) {
      this.thawed = true;
      await this.injectBeforeCommit();
    }
    return this.inner.commitReserved(input);
  }
  terminalizeReservedNoOp(input: Parameters<SubjectCorePort["terminalizeReservedNoOp"]>[0]) {
    return this.inner.terminalizeReservedNoOp(input);
  }
  reconcile: SubjectCorePort["reconcile"] = (transitionId, subjectId, fingerprint) =>
    this.inner.reconcile(transitionId, subjectId, fingerprint);
  readCurrentSnapshot: SubjectCorePort["readCurrentSnapshot"] = async () =>
    this.thawed ? this.inner.readCurrentSnapshot(SUBJECT_ID as never) : this.frozen;
}

/**
 * C2 wrapper: frozen anchor view for EVERY read (exact-replay model) and the
 * first commit attempt throws — simulating a process crash after prepare but
 * before the canonical commit. Retry runs with the same durable basis.
 */
class CrashOnceFrozenCorePort implements SubjectCorePort {
  private crashes = 0;
  constructor(
    private readonly inner: SubjectCorePort,
    private readonly frozen: SubjectStateV0
  ) {}
  reserveAndRoute(proposal: Parameters<SubjectCorePort["reserveAndRoute"]>[0]) {
    return this.inner.reserveAndRoute(proposal);
  }
  async commitReserved(input: Parameters<SubjectCorePort["commitReserved"]>[0]) {
    if (this.crashes === 0) {
      this.crashes += 1;
      throw new Error("simulated crash after prepare, before canonical commit");
    }
    return this.inner.commitReserved(input);
  }
  terminalizeReservedNoOp(input: Parameters<SubjectCorePort["terminalizeReservedNoOp"]>[0]) {
    return this.inner.terminalizeReservedNoOp(input);
  }
  reconcile: SubjectCorePort["reconcile"] = (transitionId, subjectId, fingerprint) =>
    this.inner.reconcile(transitionId, subjectId, fingerprint);
  readCurrentSnapshot: SubjectCorePort["readCurrentSnapshot"] = async () => this.frozen;
}

let concurrentLearningCounter = 0;

/**
 * Concurrent canonical Learning transition (raw host-level injection): prepares
 * an empty child of the CURRENTLY bound revision and commits it, advancing the
 * canonical memory binding — the stale scenario where the old prepared
 * revision's parent chain becomes incompatible (contract §16 example).
 */
async function injectConcurrentMemoryRevision(): Promise<string> {
  const current = world.storeRead.readCurrentBundle(SUBJECT_ID);
  const curSnapshot = current === null ? world.seedSnapshot : current.next_snapshot;
  const parent = curSnapshot.memory_state.repository_revision as string;
  const next = await (world.rawMemory as InMemoryMemoryRepository).prepareRevision({
    parent_revision: parent as never,
    records: []
  });
  concurrentLearningCounter += 1;
  const proposal = {
    schema_version: "canonical-transition-proposal-v1",
    transition_id: `t-learn-concurrent-${concurrentLearningCounter}`,
    subject_id: SUBJECT_ID,
    transition_type: "Learning",
    expected_state_revision: curSnapshot.runtime_metadata.state_revision,
    time_input: {
      kind: "OCCURRENCE",
      occurrence_logical_time: curSnapshot.runtime_metadata.logical_time
    },
    cause_refs: [world.observationBundle.trace_entry.cause_refs[0]],
    domain_deltas: [
      {
        producer: "memory",
        domain: "memory-content",
        expected_repository_revision: parent,
        operations: [
          { path: "/memory_state/repository_revision", value: next.repository_revision }
        ],
        provenance_refs: []
      }
    ],
    external_refs: []
  } as unknown as CanonicalTransitionProposalV1;
  const fingerprint = await proposalFingerprint(proposal);
  const reserved = await (world.core as CountingCorePort).reserveAndRoute(proposal);
  if (reserved.kind !== "CONTINUE") throw new Error(`concurrent reservation: ${reserved.kind}`);
  const parentManifest = await (world.rawMemory as InMemoryMemoryRepository).readManifest(parent as never);
  if (parentManifest === null) throw new Error("concurrent fixture: parent manifest missing");
  const outcome = await (world.core as CountingCorePort).commitReserved({
    proposal,
    continuation: reserved.continuation,
    producerAuthorization: world.issuer.issue([
      { producer: "memory", domain: "memory-content" }
    ]),
    preparedBinding: {
      prepared_result_ref: "workflow:w-learn-concurrent" as never,
      transition_id: proposal.transition_id,
      subject_id: proposal.subject_id,
      transition_type: proposal.transition_type,
      payload_fingerprint: fingerprint
    },
    repository_bindings: (
      await Promise.all(
        [...new Set([parent, next.repository_revision as string])]
          .sort()
          .map(async (revision) => ({
            repository_revision: revision as never,
            repository_revision_hash: await computeRepositoryRevisionHash(
              revision === parent
                ? (parentManifest as NonNullable<typeof parentManifest>)
                : next.manifest
            )
          }))
      )
    ) as never
  });
  if (outcome.kind !== "COMMITTED") throw new Error(`concurrent commit: ${JSON.stringify(outcome)}`);
  world.rawMemory.markAdopted(next.repository_revision);
  return next.repository_revision as string;
}

let concurrentObservationCounter = 0;

/**
 * Concurrent canonical Observation (via the real executor): advances the state
 * revision WITHOUT touching the memory binding — the stale scenario where the
 * old prepared revision remains attachable (contract §18).
 */
async function injectConcurrentObservation(): Promise<void> {
  concurrentObservationCounter += 1;
  const observationId = `observation:o-conc-${concurrentObservationCounter}`;
  const current = world.storeRead.readCurrentBundle(SUBJECT_ID);
  const curSnapshot = current === null ? world.seedSnapshot : current.next_snapshot;
  const ctx = {
    subject_id: SUBJECT_ID as never,
    current_logical_time: curSnapshot.runtime_metadata.logical_time as never,
    state_revision: curSnapshot.runtime_metadata.state_revision as never
  };
  const observation = observationInput({ observation_id: observationId });
  const affectDelta = await new ReferenceFastEmaAffectProducer().produceAffectDelta({
    context: ctx,
    snapshot: curSnapshot,
    transition_type: "Observation" as never,
    appraisal: {
      schema_version: "appraisal-v0",
      appraisal_ref: `appraisal:ap-${observationId.replace(":", "-")}`,
      evidence_refs: ["episode:e-9"],
      relevance: 0.9,
      goal_congruence: 0.9,
      attribution: "situation" as never,
      controllability: 0.9,
      uncertainty: 0.9,
      intensity: 0.9
    } as never,
    elapsed_ticks: null
  });
  const contextDelta = await buildContextDelta(observation, curSnapshot);
  const proposal = await buildObservationProposal({
    subjectId: SUBJECT_ID,
    stateRevision: curSnapshot.runtime_metadata.state_revision as number,
    observation,
    deltas: [affectDelta, contextDelta]
  });
  const caps = await capabilitiesFor(proposal);
  // The observation does not change the memory binding, but the engine still
  // requires the CURRENT bound revision to be covered by the binding set
  // (§15.2 equality 12) — capabilitiesFor's fixture R0 set does not apply.
  const currentBinding = curSnapshot.memory_state.repository_revision as string;
  const currentManifest = await (world.rawMemory as InMemoryMemoryRepository).readManifest(
    currentBinding as never
  );
  if (currentManifest === null) throw new Error("concurrent fixture: bound manifest missing");
  const outcome = await world.observationExecutor.execute(ctx, observation, {
    preparedBinding: caps.preparedBinding,
    repository_bindings: [
      {
        repository_revision: currentBinding as never,
        repository_revision_hash: await computeRepositoryRevisionHash(currentManifest)
      }
    ] as never
  });
  if (outcome.kind !== "COMMITTED")
    throw new Error(`concurrent observation: ${JSON.stringify(outcome)}`);
}

/** Fresh executor over a stale-injecting core with a counting source authority. */
function staleWorld(
  frozen: SubjectStateV0,
  inject: () => Promise<void>,
  sourceLookups: { count: number },
  sourceFailsOnLookup: number | null,
  everyCommit = false
): LearningTransitionExecutor {
  const wrapper = new StaleInjectingCorePort(world.core as CountingCorePort, frozen, inject, everyCommit);
  const root = new RuntimeCompositionRoot({
    subjectCore: wrapper,
    producerAuthorizationIssuer: world.issuer,
    memoryRepository: world.memory as CountingMemoryAuthority,
    retrieval: {
      retrieve: async () => {
        throw new Error("Learning never calls retrieval");
      }
    },
    learningSourceAuthority: {
      readCommittedBundle: async (id) => {
        sourceLookups.count += 1;
        if (sourceFailsOnLookup !== null && sourceLookups.count >= sourceFailsOnLookup) {
          return null;
        }
        return chainedSourceAuthority().readCommittedBundle(id);
      }
    },
    learningAdoptionAuthority: adoptionSeam(world.rawMemory as InMemoryMemoryRepository)
  });
  return new LearningTransitionExecutor(root.dependencies());
}

describe("P2.3.5.3d A12 crash/resume", () => {
  it("C1/§6: crash before prepare ⇒ retry revalidates, single canonical adoption, no orphan", async () => {
    const bundleA = world.observationBundle as AtomicCommitBundleAnyVersion;
    const preSnapshot = await world.core.readCurrentSnapshot(SUBJECT_ID as never);
    if (preSnapshot === null) throw new Error("fixture: pre snapshot");
    const preRevision = preSnapshot.runtime_metadata.state_revision as number;
    const memory = world.memory as CountingMemoryAuthority;
    const prepareBefore = memory.prepareCalls;
    const bundlesBefore = world.storeRead.getCommittedBundles().length;
    const ctx = {
      subject_id: SUBJECT_ID as never,
      current_logical_time: preSnapshot.runtime_metadata.logical_time as never,
      state_revision: preRevision as never
    };
    // First attempt "crashes" before any repository write: source lookup fails.
    const error: unknown = await staleWorld(preSnapshot, async () => undefined, { count: 0 }, 1)
      .execute(ctx, { candidate: candidateFor(bundleA) as never })
      .then(() => null, (e) => e);
    expect(error).toBeInstanceOf(TransitionStageFailure);
    expect((error as TransitionStageFailure).error_code).toBe("INVALID_STAGE_DEPENDENCY");
    // Zero repository writes before the trust gate: no prepare, no orphan.
    expect(memory.prepareCalls).toBe(prepareBefore);

    // Retry (host re-supplies the same candidate): clean success, one attempt.
    const outcome = await staleWorld(preSnapshot, async () => undefined, { count: 0 }, null).execute(
      ctx,
      { candidate: candidateFor(bundleA) as never }
    );
    expect(outcome.kind).toBe("COMMITTED");
    expect(world.storeRead.getCommittedBundles().length).toBe(bundlesBefore + 1);
    expect(memory.prepareCalls).toBe(prepareBefore + 1);
    if (outcome.kind === "COMMITTED") {
      const bound = outcome.bundle.next_snapshot.memory_state.repository_revision as string;
      expect(bound).toBe(memory.lastPreparedRevision);
      expect(world.rawMemory.isAdopted(bound as never)).toBe(true);
      expect(outcome.bundle.next_revision).toBe(preRevision + 1);
      expect(outcome.bundle.logical_time_after).toBe(outcome.bundle.logical_time_before);
    }
  });

  it("C2/§23: prepare succeeds, crash before commit ⇒ exact replay reuses the SAME prepared revision", async () => {
    const bundleA = world.observationBundle as AtomicCommitBundleAnyVersion;
    const preSnapshot = await world.core.readCurrentSnapshot(SUBJECT_ID as never);
    if (preSnapshot === null) throw new Error("fixture: pre snapshot");
    const preRevision = preSnapshot.runtime_metadata.state_revision as number;
    const memory = world.memory as CountingMemoryAuthority;
    const prepareBefore = memory.prepareCalls;
    const logBefore = memory.preparedLog.length;
    const bundlesBefore = world.storeRead.getCommittedBundles().length;
    const ctx = {
      subject_id: SUBJECT_ID as never,
      current_logical_time: preSnapshot.runtime_metadata.logical_time as never,
      state_revision: preRevision as never
    };
    const crashRoot = new RuntimeCompositionRoot({
      subjectCore: new CrashOnceFrozenCorePort(world.core as CountingCorePort, preSnapshot),
      producerAuthorizationIssuer: world.issuer,
      memoryRepository: memory,
      retrieval: {
        retrieve: async () => {
          throw new Error("Learning never calls retrieval");
        }
      },
      learningSourceAuthority: chainedSourceAuthority(),
      learningAdoptionAuthority: adoptionSeam(world.rawMemory as InMemoryMemoryRepository)
    });
    const crashingExecutor = new LearningTransitionExecutor(crashRoot.dependencies());
    const error: unknown = await crashingExecutor
      .execute(ctx, { candidate: candidateFor(bundleA) as never })
      .then(() => null, (e) => e);
    expect((error as Error).message).toContain("simulated crash");
    // The prepared candidate revision is durable BEFORE the crash (§11 C2).
    expect(memory.prepareCalls).toBe(prepareBefore + 1);
    const preparedRevision = memory.lastPreparedRevision;

    // Replay with the same durable basis: same intent ⇒ SAME revision, ONE commit.
    const outcome = await crashingExecutor.execute(ctx, { candidate: candidateFor(bundleA) as never });
    expect(outcome.kind).toBe("COMMITTED");
    expect(memory.prepareCalls).toBe(prepareBefore + 2); // idempotent replay call…
    expect(memory.lastPreparedRevision).toBe(preparedRevision); // …SAME revision
    expect(memory.preparedLog.slice(logBefore)).toEqual([preparedRevision, preparedRevision]);
    expect(world.storeRead.getCommittedBundles().length).toBe(bundlesBefore + 1);
    if (outcome.kind === "COMMITTED") {
      expect(
        world.rawMemory.isAdopted(
          outcome.bundle.next_snapshot.memory_state.repository_revision as never
        )
      ).toBe(true);
      expect(outcome.bundle.next_revision).toBe(preRevision + 1);
    }
  });

  it("C3/§22: full success then lost response ⇒ ALREADY_COMMITTED, +0 revision/trace/record", async () => {
    const bundleA = world.observationBundle as AtomicCommitBundleAnyVersion;
    const preSnapshot = await world.core.readCurrentSnapshot(SUBJECT_ID as never);
    if (preSnapshot === null) throw new Error("fixture: pre snapshot");
    const preRevision = preSnapshot.runtime_metadata.state_revision as number;
    const bundlesBefore = world.storeRead.getCommittedBundles().length;
    const ctx = {
      subject_id: SUBJECT_ID as never,
      current_logical_time: preSnapshot.runtime_metadata.logical_time as never,
      state_revision: preRevision as never
    };
    const first = await world.learningExecutor.execute(ctx, { candidate: candidateFor(bundleA) as never });
    expect(first.kind).toBe("COMMITTED");
    if (first.kind !== "COMMITTED") return;
    const firstBound = first.bundle.next_snapshot.memory_state.repository_revision as string;
    expect(world.rawMemory.isAdopted(firstBound as never)).toBe(true);

    const replay = await new LearningTransitionExecutor(
      new RuntimeCompositionRoot({
        subjectCore: new FrozenViewCorePort(world.core as CountingCorePort, preSnapshot),
        producerAuthorizationIssuer: world.issuer,
        memoryRepository: world.memory as CountingMemoryAuthority,
        retrieval: {
          retrieve: async () => {
            throw new Error("Learning never calls retrieval");
          }
        },
        learningSourceAuthority: chainedSourceAuthority(),
        learningAdoptionAuthority: adoptionSeam(world.rawMemory as InMemoryMemoryRepository)
      }).dependencies()
    ).execute(ctx, { candidate: candidateFor(bundleA) as never });
    expect(replay.kind).toBe("COMMITTED");
    if (replay.kind !== "COMMITTED") return;
    expect(replay.bundle.transition_id).toBe(first.bundle.transition_id);
    expect(replay.bundle.next_revision).toBe(first.bundle.next_revision);
    expect(replay.bundle.trace_window.entries).toHaveLength(first.bundle.trace_window.entries.length);
    expect(world.storeRead.getCommittedBundles().length).toBe(bundlesBefore + 1);
    expect(world.rawMemory.isAdopted(firstBound as never)).toBe(true);
  });

  it("C4/§9/§24: commit binds R1, markAdopted lost ⇒ replay reconciles adoption with canonical +0", async () => {
    const bundleA = world.observationBundle as AtomicCommitBundleAnyVersion;
    const preSnapshot = await world.core.readCurrentSnapshot(SUBJECT_ID as never);
    if (preSnapshot === null) throw new Error("fixture: pre snapshot");
    const preRevision = preSnapshot.runtime_metadata.state_revision as number;
    const bundlesBefore = world.storeRead.getCommittedBundles().length;
    const ctx = {
      subject_id: SUBJECT_ID as never,
      current_logical_time: preSnapshot.runtime_metadata.logical_time as never,
      state_revision: preRevision as never
    };
    // Successful Learning whose markAdopted is suppressed (exact 3c-deferred window).
    let suppressed = 0;
    const suppressingRoot = new RuntimeCompositionRoot({
      subjectCore: world.core as CountingCorePort,
      producerAuthorizationIssuer: world.issuer,
      memoryRepository: world.memory as CountingMemoryAuthority,
      retrieval: {
        retrieve: async () => {
          throw new Error("Learning never calls retrieval");
        }
      },
      learningSourceAuthority: chainedSourceAuthority(),
      learningAdoptionAuthority: {
        markAdopted: () => {
          suppressed += 1;
        },
        isAdopted: (r) => (world.rawMemory as InMemoryMemoryRepository).isAdopted(r)
      }
    });
    const first = await new LearningTransitionExecutor(suppressingRoot.dependencies()).execute(
      ctx,
      { candidate: candidateFor(bundleA) as never }
    );
    expect(first.kind).toBe("COMMITTED");
    if (first.kind !== "COMMITTED") return;
    const bound = first.bundle.next_snapshot.memory_state.repository_revision as string;
    expect(suppressed).toBe(1); // canonical commit SUCCEEDED; only the marker is missing
    expect(world.rawMemory.isAdopted(bound as never)).toBe(false);

    // Replay/restart: reconciliation from DURABLE canonical proof (§9).
    const replay = await new LearningTransitionExecutor(
      new RuntimeCompositionRoot({
        subjectCore: new FrozenViewCorePort(world.core as CountingCorePort, preSnapshot),
        producerAuthorizationIssuer: world.issuer,
        memoryRepository: world.memory as CountingMemoryAuthority,
        retrieval: {
          retrieve: async () => {
            throw new Error("Learning never calls retrieval");
          }
        },
        learningSourceAuthority: chainedSourceAuthority(),
        learningAdoptionAuthority: adoptionSeam(world.rawMemory as InMemoryMemoryRepository)
      }).dependencies()
    ).execute(ctx, { candidate: candidateFor(bundleA) as never });
    expect(replay.kind).toBe("COMMITTED");
    if (replay.kind !== "COMMITTED") return;
    expect(replay.bundle.transition_id).toBe(first.bundle.transition_id);
    expect(world.storeRead.getCommittedBundles().length).toBe(bundlesBefore + 1);
    expect(replay.bundle.next_revision).toBe(preRevision + 1);
    expect(world.rawMemory.isAdopted(bound as never)).toBe(true);
  });
});

describe("P2.3.5.3d A13 stale rebase", () => {
  it("§16/§26: incompatible new parent ⇒ old R1 NOT bound/unadopted, safe rebuild from R2 with NEW identity", async () => {
    const bundleA = world.observationBundle as AtomicCommitBundleAnyVersion;
    const preSnapshot = await world.core.readCurrentSnapshot(SUBJECT_ID as never);
    if (preSnapshot === null) throw new Error("fixture: pre snapshot");
    const preRevision = preSnapshot.runtime_metadata.state_revision as number;
    const preParent = preSnapshot.memory_state.repository_revision as string;
    const memory = world.memory as CountingMemoryAuthority;
    const prepareBefore = memory.prepareCalls;
    const logBefore = memory.preparedLog.length;
    const bundlesBefore = world.storeRead.getCommittedBundles().length;
    const sourceLookups = { count: 0 };
    let injectedRevision: string | null = null;
    const executor = staleWorld(
      preSnapshot,
      async () => {
        injectedRevision = await injectConcurrentMemoryRevision();
      },
      sourceLookups,
      null
    );
    const outcome = await executor.execute(
      {
        subject_id: SUBJECT_ID as never,
        current_logical_time: preSnapshot.runtime_metadata.logical_time as never,
        state_revision: preRevision as never
      },
      { candidate: candidateFor(bundleA) as never }
    );
    expect(sourceLookups.count).toBeGreaterThanOrEqual(2); // §13 fresh revalidation
    expect(outcome.kind).toBe("COMMITTED");
    if (outcome.kind !== "COMMITTED") return;
    // Exactly: stale initial (+0) + concurrent (+1) + rebuilt (+1).
    expect(outcome.bundle.next_revision).toBe(preRevision + 2);
    expect(outcome.bundle.logical_time_after).toBe(preSnapshot.runtime_metadata.logical_time);
    expect(world.storeRead.getCommittedBundles().length).toBe(bundlesBefore + 2);
    const attempts = memory.preparedLog.slice(logBefore);
    expect(attempts).toHaveLength(2);
    const oldOrphan = attempts[0];
    const rebuilt = attempts[1];
    // Old candidate: physically present, parent = the OLD basis, unadopted orphan.
    const oldManifest = await (world.rawMemory as InMemoryMemoryRepository).readManifest(oldOrphan as never);
    expect(oldManifest).not.toBeNull();
    expect((oldManifest as unknown as { parent_revision: string }).parent_revision).toBe(preParent);
    expect(world.rawMemory.isAdopted(oldOrphan as never)).toBe(false);
    expect(outcome.bundle.next_snapshot.memory_state.repository_revision).not.toBe(oldOrphan);
    // Rebuilt candidate: prepared FROM the concurrently bound revision (§17).
    const rebuiltManifest = await (world.rawMemory as InMemoryMemoryRepository).readManifest(rebuilt as never);
    expect((rebuiltManifest as unknown as { parent_revision: string }).parent_revision).toBe(injectedRevision);
    expect(outcome.bundle.next_snapshot.memory_state.repository_revision).toBe(rebuilt);
    expect(memory.prepareCalls).toBe(prepareBefore + 2);
    expect(world.rawMemory.isAdopted(rebuilt as never)).toBe(true);
  });

  it("§18: stale with unchanged repository binding ⇒ old prepared revision REUSED via attachability predicate", async () => {
    const bundleA = world.observationBundle as AtomicCommitBundleAnyVersion;
    const preSnapshot = await world.core.readCurrentSnapshot(SUBJECT_ID as never);
    if (preSnapshot === null) throw new Error("fixture: pre snapshot");
    const preRevision = preSnapshot.runtime_metadata.state_revision as number;
    const memory = world.memory as CountingMemoryAuthority;
    const prepareBefore = memory.prepareCalls;
    const logBefore = memory.preparedLog.length;
    const executor = staleWorld(preSnapshot, async () => {
      await injectConcurrentObservation();
    }, { count: 0 }, null);
    const outcome = await executor.execute(
      {
        subject_id: SUBJECT_ID as never,
        current_logical_time: preSnapshot.runtime_metadata.logical_time as never,
        state_revision: preRevision as never
      },
      { candidate: candidateFor(bundleA) as never }
    );
    expect(outcome.kind).toBe("COMMITTED");
    if (outcome.kind !== "COMMITTED") return;
    // Only ONE prepare: the old revision passed §12.1 and was reused.
    expect(memory.prepareCalls).toBe(prepareBefore + 1);
    const reused = memory.preparedLog[logBefore];
    expect(outcome.bundle.next_snapshot.memory_state.repository_revision).toBe(reused);
    expect(world.rawMemory.isAdopted(reused as never)).toBe(true);
    expect(outcome.bundle.next_revision).toBe(preRevision + 2);
  });

  it("§25: experience fails revalidation after stale ⇒ REBASE_REQUIRED (no rebuild prepare/bind)", async () => {
    const bundleA = world.observationBundle as AtomicCommitBundleAnyVersion;
    const preSnapshot = await world.core.readCurrentSnapshot(SUBJECT_ID as never);
    if (preSnapshot === null) throw new Error("fixture: pre snapshot");
    const preRevision = preSnapshot.runtime_metadata.state_revision as number;
    const memory = world.memory as CountingMemoryAuthority;
    const prepareBefore = memory.prepareCalls;
    const bundlesBefore = world.storeRead.getCommittedBundles().length;
    // The rebase-time (second) source lookup fails: trust cannot be reconstructed.
    const executor = staleWorld(preSnapshot, async () => {
      await injectConcurrentMemoryRevision();
    }, { count: 0 }, 2);
    const outcome = await executor.execute(
      {
        subject_id: SUBJECT_ID as never,
        current_logical_time: preSnapshot.runtime_metadata.logical_time as never,
        state_revision: preRevision as never
      },
      { candidate: candidateFor(bundleA) as never }
    );
    expect(outcome.kind).toBe("REBASE_REQUIRED");
    if (outcome.kind !== "REBASE_REQUIRED") return;
    expect(outcome.failure.error_code).toBe("STALE_STATE_REVISION");
    expect(outcome.failure.reason).toBe("REBASE-STALE-001");
    // No rebuild prepare, no canonical mutation by the executor.
    expect(memory.prepareCalls).toBe(prepareBefore + 1);
    expect(world.storeRead.getCommittedBundles().length).toBe(bundlesBefore + 1); // concurrent only
  });

  it("§20/§28: second stale after the single permitted rebuild ⇒ REBASE_REQUIRED, bounded", async () => {
    const bundleA = world.observationBundle as AtomicCommitBundleAnyVersion;
    const preSnapshot = await world.core.readCurrentSnapshot(SUBJECT_ID as never);
    if (preSnapshot === null) throw new Error("fixture: pre snapshot");
    const preRevision = preSnapshot.runtime_metadata.state_revision as number;
    const memory = world.memory as CountingMemoryAuthority;
    const prepareBefore = memory.prepareCalls;
    const bundlesBefore = world.storeRead.getCommittedBundles().length;
    let injections = 0;
    // EVERY commit attempt races a concurrent memory transition → both attempts stale.
    const executor = staleWorld(
      preSnapshot,
      async () => {
        injections += 1;
        await injectConcurrentMemoryRevision();
      },
      { count: 0 },
      null,
      true
    );
    const outcome = await executor.execute(
      {
        subject_id: SUBJECT_ID as never,
        current_logical_time: preSnapshot.runtime_metadata.logical_time as never,
        state_revision: preRevision as never
      },
      { candidate: candidateFor(bundleA) as never }
    );
    expect(outcome.kind).toBe("REBASE_REQUIRED");
    if (outcome.kind !== "REBASE_REQUIRED") return;
    expect(outcome.failure.error_code).toBe("STALE_STATE_REVISION");
    expect(outcome.failure.reason).toBe("REBASE-STALE-001");
    // FINITE: two injected races, two prepares, ZERO executor commits, no loop.
    expect(injections).toBe(2);
    expect(memory.prepareCalls).toBe(prepareBefore + 2);
    expect(world.storeRead.getCommittedBundles().length).toBe(bundlesBefore + 2);
  });
});
