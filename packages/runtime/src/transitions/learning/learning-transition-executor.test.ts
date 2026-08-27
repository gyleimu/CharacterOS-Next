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
  AtomicCommitBundleV1,
  DomainDeltaV0,
  InMemoryFacadeAssembly,
  ProducerAuthorizationIssuer,
  SubjectStateV0
} from "@characteros-next/subject-core";
import { createInMemorySubjectCoreFacade } from "@characteros-next/subject-core";
import { InMemoryMemoryRepository, type MemoryPreparationAuthority } from "@characteros-next/memory";
import { buildContextDelta } from "../../ports/context-producer-port.js";
import {
  buildObservationHarness,
  capabilitiesFor,
  observationInput
} from "../observation/observation-fixtures.js";
import { buildObservationProposal } from "../observation/observation-transition-executor.js";
import { ReferenceFastEmaAffectProducer } from "../../producers/reference-fast-ema-affect-producer.js";
import { RuntimeCompositionRoot } from "../../composition/runtime-composition-root.js";
import type { SubjectCorePort } from "../../ports/subject-core-port.js";
import {
  buildLearningProposal,
  LearningTransitionExecutor
} from "./learning-transition-executor.js";
import type { LearningSourceReadAuthority } from "./learning-source-authority.js";
import { TransitionStageFailure } from "../common.js";

const SUBJECT_ID = "subject-s0";
const OBSERVATION_ID = "observation:o-lc77";

interface TestCore extends SubjectCorePort {
  readonly storeRead: {
    readCurrentBundle(subjectId: string): AtomicCommitBundleV1 | null;
    readCommittedByTransitionId(id: string): AtomicCommitBundleV1 | null;
    getCommittedBundles(): readonly AtomicCommitBundleV1[];
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
      binding.prepared_result_ref.startsWith("workflow:w-learn-"),
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
    return prepared;
  }
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
  sourceStoreRead: { readCommittedByTransitionId(id: string): AtomicCommitBundleV1 | null };
  seedSnapshot: SubjectStateV0;
  adoptionGate: { open: boolean };
  learningExecutor: LearningTransitionExecutor;
  observationBundle: AtomicCommitBundleV1;
  observationSnapshot: SubjectStateV0;
}

const world = {} as World;

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

function candidateFor(bundle: AtomicCommitBundleV1, overrides: Record<string, unknown> = {}): Record<string, unknown> {
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
    learningAdoptionAuthority: { markAdopted: (r) => rawMemory.markAdopted(r) }
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
  world.observationBundle = observationBundle;
  world.observationSnapshot = observationBundle.next_snapshot;
});

describe("P2.3.5.3c Learning prepare + canonical adoption", () => {
  it("§26 happy path: trusted experience ⇒ one prepare ⇒ ONE canonical adoption binding R1", async () => {
    const bundleA = world.observationBundle as AtomicCommitBundleV1;
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
    const bundleA = world.observationBundle as AtomicCommitBundleV1;
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
      learningAdoptionAuthority: { markAdopted: (r) => (world.rawMemory as InMemoryMemoryRepository).markAdopted(r) }
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
    const bundleA = world.observationBundle as AtomicCommitBundleV1;
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
      learningAdoptionAuthority: { markAdopted: (r) => (world.rawMemory as InMemoryMemoryRepository).markAdopted(r) }
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
    const bundleA = world.observationBundle as AtomicCommitBundleV1;
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
    const bundleA = world.observationBundle as AtomicCommitBundleV1;
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
      learningAdoptionAuthority: { markAdopted: (r) => rawMemory.markAdopted(r) }
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
    const bundleA = world.observationBundle as AtomicCommitBundleV1;
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
