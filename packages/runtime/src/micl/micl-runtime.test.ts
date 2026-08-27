/**
 * P2.4 — MICL V0 runtime integration acceptance suite (p2-runtime-plan §11 P2.4;
 * micl-design §31–§33; the 17 required acceptance tests of the MICL task §18).
 *
 * Real stacks end-to-end: real SubjectCore canonical path (two-call protocol),
 * real InMemoryMemoryRepository (intent prepare + adoption), real FAST+EMA /
 * REGULATION / Context producers, real Learning trusted-source validation +
 * ExperienceEncoderV0 + A12/A13. Only interpretation/appraisal are fixed
 * deterministic reference providers (§17: no LLM anywhere).
 */

import { describe, expect, it } from "vitest";

import type {
  AtomicCommitBundleV1,
  InMemoryFacadeAssembly,
  ProducerAuthorizationIssuer,
  SubjectStateV0
} from "@characteros-next/subject-core";
import { createInMemorySubjectCoreFacade } from "@characteros-next/subject-core";
import { InMemoryMemoryRepository, type MemoryPreparationAuthority } from "@characteros-next/memory";

import { RuntimeCompositionRoot } from "../composition/runtime-composition-root.js";
import type { SubjectCorePort } from "../ports/subject-core-port.js";
import { ReferenceContextProducer } from "../ports/context-producer-port.js";
import { ReferenceFastEmaAffectProducer } from "../producers/reference-fast-ema-affect-producer.js";
import { ReferenceRegulationV0Producer } from "../producers/reference-regulation-v0-producer.js";
import {
  ObservationTransitionExecutor
} from "../transitions/observation/observation-transition-executor.js";
import {
  fixedAppraisal,
  fixedInterpretation,
  observationInput,
  retrievalService,
  s0
} from "../transitions/observation/observation-fixtures.js";
import type { LearningSourceReadAuthority } from "../transitions/learning/learning-source-authority.js";
import { InMemoryMiclWorkflowStore } from "./micl-workflow-store.js";
import { MiclRuntime } from "./micl-runtime.js";
import { createMiclStageMinter } from "./micl-capabilities.js";
import { miclRequest } from "./micl-fixtures.js";
import type { MiclResultV0 } from "./micl-types.js";

const SUBJECT_ID = "subject-s0";

interface TestCore extends SubjectCorePort {
  readonly issuer: ProducerAuthorizationIssuer;
  readonly storeRead: {
    readCurrentBundle(subjectId: string): AtomicCommitBundleV1 | null;
    readCommittedByTransitionId(id: string): AtomicCommitBundleV1 | null;
    getCommittedBundles(): readonly AtomicCommitBundleV1[];
  };
}

function createMiclTestCore(
  snapshot: SubjectStateV0,
  memoryRepository: InMemoryMemoryRepository
): TestCore {
  const assembly: InMemoryFacadeAssembly = createInMemorySubjectCoreFacade({
    seedSnapshots: new Map([[SUBJECT_ID as never, snapshot]]),
    preparedResultValidator: async (binding) =>
      binding.prepared_result_ref.startsWith("workflow:"),
    referenceValidator: async (binding) =>
      memoryRepository.validateRevisionBinding(
        binding as unknown as Parameters<MemoryPreparationAuthority["validateRevisionBinding"]>[0]
      ),
    memoryAdoptionValidator: async (adoption) => {
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
  return { ...port, issuer: assembly.producerAuthorizationIssuer, storeRead: assembly.storeRead };
}

// ---- world assembly ----------------------------------------------------------

interface WorldComponents {
  readonly rawMemory: InMemoryMemoryRepository;
  readonly core: TestCore;
}

interface World {
  readonly rawCore: TestCore;
  readonly memory: InMemoryMemoryRepository;
  readonly store: InMemoryMiclWorkflowStore;
  readonly runtime: MiclRuntime;
  readonly sourceAuthority: LearningSourceReadAuthority;
  readonly bundles: () => readonly AtomicCommitBundleV1[];
}

function buildComponents(): WorldComponents {
  const rawMemory = new InMemoryMemoryRepository();
  void rawMemory.prepareRevision({ parent_revision: null, records: [] });
  const core = createMiclTestCore(s0() as unknown as SubjectStateV0, rawMemory);
  return { rawMemory, core };
}

function sourceAuthorityFor(core: TestCore): LearningSourceReadAuthority {
  return { readCommittedBundle: async (id) => core.storeRead.readCommittedByTransitionId(id) };
}

function assembleRuntime(
  components: WorldComponents,
  options: {
    store?: InMemoryMiclWorkflowStore;
    corePort?: SubjectCorePort;
    learningSourceAuthority?: LearningSourceReadAuthority;
  } = {}
): { runtime: MiclRuntime; store: InMemoryMiclWorkflowStore; sourceAuthority: LearningSourceReadAuthority } {
  const store = options.store ?? new InMemoryMiclWorkflowStore();
  const sourceAuthority = options.learningSourceAuthority ?? sourceAuthorityFor(components.core);
  const root = new RuntimeCompositionRoot({
    subjectCore: options.corePort ?? components.core,
    producerAuthorizationIssuer: components.core.issuer,
    memoryRepository: components.rawMemory,
    retrieval: {
      retrieve: (query) => retrievalService(false).retrieve(query as never)
    },
    interpretation: fixedInterpretation(),
    appraisal: fixedAppraisal(0.9),
    affectProducer: new ReferenceFastEmaAffectProducer(),
    regulationProducer: new ReferenceRegulationV0Producer(),
    contextProducer: new ReferenceContextProducer(),
    learningSourceAuthority: sourceAuthority,
    learningAdoptionAuthority: {
      markAdopted: (r) => components.rawMemory.markAdopted(r),
      isAdopted: (r) => components.rawMemory.isAdopted(r)
    }
  });
  return { runtime: new MiclRuntime(root.dependencies(), store), store, sourceAuthority };
}

function buildWorld(
  options: { store?: InMemoryMiclWorkflowStore; components?: WorldComponents } = {}
): World {
  const components = options.components ?? buildComponents();
  const assembled = assembleRuntime(
    components,
    options.store === undefined ? {} : { store: options.store }
  );
  return {
    rawCore: components.core,
    memory: components.rawMemory,
    store: assembled.store,
    runtime: assembled.runtime,
    sourceAuthority: assembled.sourceAuthority,
    bundles: () => components.core.storeRead.getCommittedBundles()
  };
}

// ---- observation wrappers ------------------------------------------------------

/** Counting wrapper: proves a committed stage is never re-run on resume. */
class CountingCore implements SubjectCorePort {
  private countedCommits = 0;
  constructor(private readonly inner: SubjectCorePort) {}
  reserveAndRoute: SubjectCorePort["reserveAndRoute"] = (proposal) =>
    this.inner.reserveAndRoute(proposal);
  async commitReserved(input: Parameters<SubjectCorePort["commitReserved"]>[0]) {
    this.countedCommits += 1;
    return this.inner.commitReserved(input);
  }
  terminalizeReservedNoOp: SubjectCorePort["terminalizeReservedNoOp"] = (input) =>
    this.inner.terminalizeReservedNoOp(input);
  reconcile: SubjectCorePort["reconcile"] = (t, s, f) => this.inner.reconcile(t, s, f);
  readCurrentSnapshot: SubjectCorePort["readCurrentSnapshot"] = (id) =>
    this.inner.readCurrentSnapshot(id);
  get commitCalls(): number {
    return this.countedCommits;
  }
}

/**
 * Stale-injection wrapper: advances the canonical revision with a concurrent
 * Observation (memory binding untouched) immediately before a Learning commit,
 * forcing the frozen A13 stale path. `injectionCount` = how many Learning
 * commits get an injection (1 ⇒ safe rebuild; 2 ⇒ frozen REBASE_REQUIRED).
 */
class InjectingCore implements SubjectCorePort {
  private fired = 0;
  constructor(
    private readonly inner: SubjectCorePort,
    private readonly innerDeps: { subjectCore: SubjectCorePort; producerAuthorizationIssuer: ProducerAuthorizationIssuer; memoryRepository: InMemoryMemoryRepository; learningSourceAuthority: LearningSourceReadAuthority },
    private readonly injectionCount: number
  ) {}
  reserveAndRoute: SubjectCorePort["reserveAndRoute"] = (proposal) =>
    this.inner.reserveAndRoute(proposal);
  async commitReserved(input: Parameters<SubjectCorePort["commitReserved"]>[0]) {
    if (
      this.fired < this.injectionCount &&
      (input.proposal as { transition_type?: string }).transition_type === "Learning"
    ) {
      this.fired += 1;
      await runConcurrentObservation(this.innerDeps);
    }
    return this.inner.commitReserved(input);
  }
  terminalizeReservedNoOp: SubjectCorePort["terminalizeReservedNoOp"] = (input) =>
    this.inner.terminalizeReservedNoOp(input);
  reconcile: SubjectCorePort["reconcile"] = (t, s, f) => this.inner.reconcile(t, s, f);
  readCurrentSnapshot: SubjectCorePort["readCurrentSnapshot"] = (id) =>
    this.inner.readCurrentSnapshot(id);
}

/** Concurrent Observation: +1 state revision, memory binding untouched. */
async function runConcurrentObservation(deps: {
  subjectCore: SubjectCorePort;
  producerAuthorizationIssuer: ProducerAuthorizationIssuer;
  memoryRepository: InMemoryMemoryRepository;
  learningSourceAuthority: LearningSourceReadAuthority;
}): Promise<void> {
  const snapshot = (await deps.subjectCore.readCurrentSnapshot(SUBJECT_ID as never)) as SubjectStateV0;
  const ctx = {
    subject_id: SUBJECT_ID as never,
    current_logical_time: snapshot.runtime_metadata.logical_time,
    state_revision: snapshot.runtime_metadata.state_revision
  } as never;
  const observation = observationInput({
    observation_id: "observation:o-inject",
    occurrence_logical_time: snapshot.runtime_metadata.logical_time as never
  });
  const root = new RuntimeCompositionRoot({
    subjectCore: deps.subjectCore,
    producerAuthorizationIssuer: deps.producerAuthorizationIssuer,
    memoryRepository: deps.memoryRepository,
    retrieval: { retrieve: (query) => retrievalService(false).retrieve(query as never) },
    interpretation: fixedInterpretation(),
    appraisal: fixedAppraisal(0.5),
    affectProducer: new ReferenceFastEmaAffectProducer(),
    regulationProducer: new ReferenceRegulationV0Producer(),
    contextProducer: new ReferenceContextProducer(),
    learningSourceAuthority: deps.learningSourceAuthority,
    learningAdoptionAuthority: {
      markAdopted: (r) => deps.memoryRepository.markAdopted(r),
      isAdopted: (r) => deps.memoryRepository.isAdopted(r)
    }
  });
  // Minter-based capabilities: the binding is minted from the executor's own
  // authoritative proposal bytes (same mechanism as the MICL stage minter).
  const minter = createMiclStageMinter(deps.subjectCore, new InMemoryMiclWorkflowStore(), {
    micl_id: "micl-injection" as never,
    micl_request_fingerprint: "sha256:injection" as never,
    stage_key: "OBSERVATION"
  });
  const executor = new ObservationTransitionExecutor({
    ...root.dependencies(),
    subjectCore: minter.core()
  });
  const outcome = await executor.execute(
    ctx,
    observation,
    minter.capabilities([
      {
        repository_revision: "R0",
        repository_revision_hash:
          "sha256:85755634de984070ca6c12d5dd01fb545e0efea635000e0e0044c589f3fcbb00"
      }
    ])
  );
  if (outcome.kind !== "COMMITTED") {
    throw new Error("injection invariant: concurrent Observation must commit");
  }
}

/** Crash simulation: throw once on the named stage checkpoint, then recover. */
function crashStoreAfter(
  stageKey: "TIME" | "OBSERVATION" | "LEARNING",
  beforeWrite = false
): InMemoryMiclWorkflowStore {
  const store = new InMemoryMiclWorkflowStore();
  const original = store.putStageCheckpoint.bind(store);
  let crashed = false;
  store.putStageCheckpoint = async (miclId, checkpoint) => {
    if (checkpoint.stage_key === stageKey && !crashed) {
      crashed = true;
      if (beforeWrite) throw new Error("MICL_CRASH_BEFORE_CHECKPOINT");
    }
    await original(miclId, checkpoint);
    if (checkpoint.stage_key === stageKey && crashed && !beforeWrite) {
      throw new Error("MICL_CRASH_AFTER_CHECKPOINT");
    }
  };
  return store;
}

function expectCompleted(result: unknown): MiclResultV0 {
  expect(isMiclResult(result)).toBe(true);
  if (!isMiclResult(result) || result.status !== "COMPLETED") {
    throw new Error(`expected COMPLETED, got ${JSON.stringify(result)}`);
  }
  return result;
}

function isMiclResult(r: unknown): r is MiclResultV0 {
  return typeof r === "object" && r !== null && "status" in r && "failure_stage" in r;
}

// ===========================================================================
// Required acceptance tests (MICL task §18)
// ===========================================================================

describe("P2.4 MICL V0 — clean full workflow", () => {
  it("§18.1/§14: Time→Observation→Learning COMPLETED; logical time advances only through Time", async () => {
    const world = buildWorld();
    const result = expectCompleted(await world.runtime.run(miclRequest({})));
    // rev0 --Time(50)--> rev1 --Observation--> rev2 --Learning--> rev3
    expect(result.final_state_revision).toBe(3);
    expect(result.initial_state_revision).toBe(0);
    expect(result.initial_logical_time).toBe(0);
    expect(result.final_logical_time).toBe(50);
    expect(result.time_transition_ref).toMatch(/^t-time-/);
    expect(result.observation_transition_ref).toMatch(/^t-obs-/);
    expect(result.learning_transition_ref).toMatch(/^t-learn-/);
    expect(result.failure_stage).toBeNull();
    expect(result.failure_reason).toBeNull();
    expect(result.audit_refs).toEqual([]);
    // Each stage keeps its own canonical commit boundary — never one giant
    // atomic MICL commit (§3/§6): exactly one commit per transition type.
    const byType = world.bundles().map((b) => b.transition_type).sort();
    expect(byType).toEqual(["Learning", "Observation", "Time"]);
  });

  it("§18.2: Time NO_OP (elapsed=0) → Observation → Learning still COMPLETED", async () => {
    const world = buildWorld();
    const result = expectCompleted(
      await world.runtime.run(
        miclRequest({
          observation: observationInput({ occurrence_logical_time: 0, observation_id: "observation:o-noop" })
        })
      )
    );
    // Time NO_OP (+0 rev, logical time unchanged) → Observation rev1 → Learning rev2.
    expect(result.final_state_revision).toBe(2);
    expect(result.final_logical_time).toBe(0);
  });

  it("§18.3/§18.5: memory visible only via canonical binding; exactly one episodic memory", async () => {
    const world = buildWorld();
    expectCompleted(await world.runtime.run(miclRequest({})));
    const finalBundle = world.rawCore.storeRead.readCurrentBundle(SUBJECT_ID);
    if (finalBundle === null) throw new Error("no final bundle");
    const bound = finalBundle.next_snapshot.memory_state.repository_revision as string;
    // Learning bound EXACTLY ONE new repository revision (R0 → R1).
    expect(bound).toBe("R1");
    const manifest = await world.memory.readManifest(bound as never);
    if (manifest === null) throw new Error("bound manifest missing");
    expect(manifest.parent_revision).toBe("R0");
    expect(manifest.record_hashes).toHaveLength(1);
    // Retrieval authority follows the SubjectState-bound revision only (§7).
    const bindings = finalBundle.repository_revision_bindings.map((b) => b.repository_revision);
    expect(bindings).toContain(bound);
  });

  it("§18.4: final SubjectState includes exactly one Observation effect", async () => {
    const world = buildWorld();
    expectCompleted(await world.runtime.run(miclRequest({})));
    const observationBundles = world.bundles().filter((b) => b.transition_type === "Observation");
    expect(observationBundles).toHaveLength(1);
    const finalBundle = world.rawCore.storeRead.readCurrentBundle(SUBJECT_ID);
    if (finalBundle === null) throw new Error("no final bundle");
    const observationEntries = finalBundle.next_snapshot.trace_window.entries.filter(
      (e) => (e as { transition_id?: string }).transition_id === observationBundles[0]?.transition_id
    );
    expect(observationEntries).toHaveLength(1);
  });

  it("§18.6 (M7): same micl_id replay ⇒ byte-identical result, +0 revision/trace/memory", async () => {
    const components = buildComponents();
    const world = buildWorld({ components });
    const counting = new CountingCore(components.core);
    const resumed = assembleRuntime(components, { corePort: counting, store: world.store });
    const request = miclRequest({});
    const first = expectCompleted(await world.runtime.run(request));
    const bundlesAfterFirst = world.bundles().length;
    const second = await resumed.runtime.run(request);
    expect(second).toEqual(first);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    // +0: no new canonical commit of any type (A12 workflow-level idempotency).
    expect(world.bundles().length).toBe(bundlesAfterFirst);
    expect(counting.commitCalls).toBe(0);
  });

  it("§18.7 (M2): crash after Time resumes Observation without re-running Time", async () => {
    const store = crashStoreAfter("TIME");
    const components = buildComponents();
    const world = buildWorld({ store, components });
    const request = miclRequest({});
    await expect(world.runtime.run(request)).rejects.toThrow("MICL_CRASH_AFTER_CHECKPOINT");
    const resumed = expectCompleted(await buildWorld({ store, components }).runtime.run(request));
    const bundles = world.bundles();
    expect(bundles.filter((b) => b.transition_type === "Time")).toHaveLength(1);
    expect(resumed.final_state_revision).toBe(3);
    expect(resumed.time_transition_ref).toMatch(/^t-time-/);
  });

  it("§18.8 (M4): crash after Observation resumes Learning only", async () => {
    const store = crashStoreAfter("OBSERVATION");
    const components = buildComponents();
    const world = buildWorld({ store, components });
    const request = miclRequest({});
    await expect(world.runtime.run(request)).rejects.toThrow("MICL_CRASH_AFTER_CHECKPOINT");
    const resumed = expectCompleted(await buildWorld({ store, components }).runtime.run(request));
    const bundles = world.bundles();
    expect(bundles.filter((b) => b.transition_type === "Time")).toHaveLength(1);
    expect(bundles.filter((b) => b.transition_type === "Observation")).toHaveLength(1);
    expect(bundles.filter((b) => b.transition_type === "Learning")).toHaveLength(1);
    expect(resumed.final_state_revision).toBe(3);
  });

  it("§18.9 (M5/M6): crash during Learning uses frozen A12 + prepared-record reconciliation", async () => {
    // M6: Learning canonical commit succeeded, stage checkpoint lost before write.
    const store = crashStoreAfter("LEARNING", true);
    const components = buildComponents();
    const world = buildWorld({ store, components });
    const request = miclRequest({});
    await expect(world.runtime.run(request)).rejects.toThrow("MICL_CRASH_BEFORE_CHECKPOINT");
    const learningBundle = world
      .bundles()
      .find((b) => b.transition_type === "Learning") as AtomicCommitBundleV1;
    expect(learningBundle).toBeDefined();
    // Resume: the committed stage result is REBUILT from the durable prepared
    // record + authoritative bundle — no second canonical commit (§32).
    const resumed = expectCompleted(await buildWorld({ store, components }).runtime.run(request));
    expect(world.bundles().filter((b) => b.transition_type === "Learning")).toHaveLength(1);
    expect(resumed.final_state_revision).toBe(learningBundle.next_revision);
  });

  it("§18.10: Learning stale safe rebuild completes MICL correctly", async () => {
    const components = buildComponents();
    const injecting = new InjectingCore(
      components.core,
      {
        subjectCore: components.core,
        producerAuthorizationIssuer: components.core.issuer,
        memoryRepository: components.rawMemory,
        learningSourceAuthority: sourceAuthorityFor(components.core)
      },
      1
    );
    const world = buildWorld({ components });
    const { runtime } = assembleRuntime(components, { corePort: injecting });
    const result = expectCompleted(await runtime.run(miclRequest({})));
    // Time(1) + Observation(2) + injected Observation(3) + Learning rebuild(4).
    expect(result.final_state_revision).toBe(4);
    // SAFE REUSE: exactly ONE Learning canonical commit (the rebuild reused the
    // still-attachable prepared revision; no second repository candidate).
    expect(world.bundles().filter((b) => b.transition_type === "Learning")).toHaveLength(1);
  });

  it("§18.11 (M9): Learning REBASE_REQUIRED terminates MICL without rerunning prior stages", async () => {
    const components = buildComponents();
    const injecting = new InjectingCore(
      components.core,
      {
        subjectCore: components.core,
        producerAuthorizationIssuer: components.core.issuer,
        memoryRepository: components.rawMemory,
        learningSourceAuthority: sourceAuthorityFor(components.core)
      },
      2
    );
    const world = buildWorld({ components });
    const { runtime } = assembleRuntime(components, { corePort: injecting });
    const result = await runtime.run(miclRequest({}));
    expect(isMiclResult(result)).toBe(true);
    if (!isMiclResult(result)) throw new Error("unreachable");
    expect(result.status).toBe("FAILED_AFTER_OBSERVATION");
    expect(result.failure_stage).toBe("LEARNING");
    expect(result.failure_reason).toBe("REBASE_REQUIRED");
    // Prior stages stand; Time/Observation were never re-run; no Learning commit.
    const bundles = world.bundles();
    expect(bundles.filter((b) => b.transition_type === "Time")).toHaveLength(1);
    // One workflow Observation + TWO injected concurrent Observations (one per
    // forced stale attempt), each a distinct canonical commit — never re-runs.
    expect(bundles.filter((b) => b.transition_type === "Observation")).toHaveLength(3);
    expect(bundles.filter((b) => b.transition_type === "Learning")).toHaveLength(0);
  });

  it("§18.12 (M8): changed request under same micl_id fails closed with MICL_ID_REUSE", async () => {
    const world = buildWorld();
    const request = miclRequest({});
    await world.runtime.run(request);
    const revisionBefore = world.rawCore.storeRead.readCurrentBundle(SUBJECT_ID)?.next_revision;
    const rejected = await world.runtime.run(miclRequest({ declared_salience: 0.7 }));
    expect(isMiclResult(rejected)).toBe(false);
    if (isMiclResult(rejected)) throw new Error("must be the separate admission error");
    expect(rejected.schema_version).toBe("micl-admission-error-result-v1");
    expect(rejected.status).toBe("REJECTED");
    expect(rejected.error_code).toBe("MICL_ID_REUSE");
    expect(rejected.reason).toBe("MICL-RESUME-001");
    expect(rejected.audit_refs).toEqual([]);
    expect(world.rawCore.storeRead.readCurrentBundle(SUBJECT_ID)?.next_revision).toBe(revisionBefore);
  });

  it("§18.13 (M10): failure after Observation preserves Observation state", async () => {
    const components = buildComponents();
    const world = buildWorld({ components });
    // Sever the durable Observation source for the Learning face: its trusted-
    // source validation fails closed (INVALID_STAGE_DEPENDENCY) while the
    // Observation canonical commit stands (workflow failure ≠ history rollback).
    const severedAuthority: LearningSourceReadAuthority = {
      readCommittedBundle: async (id) => {
        const bundle = await sourceAuthorityFor(components.core).readCommittedBundle(id);
        if (bundle !== null && bundle.transition_type === "Observation") return null;
        return bundle;
      }
    };
    const severed = assembleRuntime(components, {
      store: world.store,
      learningSourceAuthority: severedAuthority
    });
    // Time/Observation commit normally (they never read the source authority);
    // Learning then fails closed on the missing source evidence.
    const result = await severed.runtime.run(miclRequest({}));
    expect(isMiclResult(result)).toBe(true);
    if (!isMiclResult(result)) throw new Error("unreachable");
    expect(result.status).toBe("FAILED_AFTER_OBSERVATION");
    expect(result.failure_stage).toBe("LEARNING");
    expect(result.failure_reason).toBe("INVALID_STAGE_DEPENDENCY");
    // Final canonical revision remains the post-Observation rev102 equivalent.
    expect(result.final_state_revision).toBe(2);
    expect(result.observation_transition_ref).toMatch(/^t-obs-/);
    const bundles = world.bundles();
    expect(bundles.filter((b) => b.transition_type === "Observation")).toHaveLength(1);
    expect(bundles.filter((b) => b.transition_type === "Learning")).toHaveLength(0);
  });

  it("§18.15/§18.16: deterministic replay with reference providers — no LLM required", async () => {
    const run = async (): Promise<unknown> => {
      const world = buildWorld();
      return expectCompleted(
        await world.runtime.run(miclRequest({ micl_id: "micl-det", declared_salience: 0.42 }))
      );
    };
    const a = await run();
    const b = await run();
    expect(a).not.toBeNull();
    // Same state + same request + deterministic providers ⇒ identical result
    // (final hashes and all stage refs byte-equal).
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });

  it("§19/§18.17: boundedness — second stale is the frozen terminal, no workflow retry loop", async () => {
    // Behavioral proof (M9 above): exactly ONE rebuild after the first stale,
    // and the second stale terminates REBASE_REQUIRED with no additional
    // canonical attempt — the workflow adds no retry layer over Learning's
    // frozen MAX_AUTOMATIC_REBUILD=1, and no stage was re-run (bundle counts).
    // The frozen Learning executor owns the no-loop invariant structurally.
    const components = buildComponents();
    const injecting = new InjectingCore(
      components.core,
      {
        subjectCore: components.core,
        producerAuthorizationIssuer: components.core.issuer,
        memoryRepository: components.rawMemory,
        learningSourceAuthority: sourceAuthorityFor(components.core)
      },
      5 // even with ample injection capacity, no third attempt ever occurs
    );
    const world = buildWorld({ components });
    const { runtime } = assembleRuntime(components, { corePort: injecting });
    const result = await runtime.run(miclRequest({}));
    if (!isMiclResult(result)) throw new Error("expected MICLResult");
    expect(result.status).toBe("FAILED_AFTER_OBSERVATION");
    expect(result.failure_reason).toBe("REBASE_REQUIRED");
    // Two injections consumed (two stale attempts); no further stage re-runs.
    expect(world.bundles().filter((b) => b.transition_type === "Observation")).toHaveLength(3);
    expect(world.bundles().filter((b) => b.transition_type === "Learning")).toHaveLength(0);
  });
});
