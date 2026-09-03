/**
 * Closed Loop Memory Continuity V0 — persisted regression proof.
 *
 * Deterministic offline lifecycle: initial SubjectState → ObservationTransition →
 * deterministic ActionIntent → ActionExecutionRunner → authoritative Outcome →
 * OutcomeReintegrationRunnerV0 (frozen Observation + Learning) → one episodic
 * record → Cycle 2 Observation/Retrieval returns the Cycle 1 episode through the
 * normal frozen retrieval path. No manual working_ref injection, no direct memory
 * insertion, no LLM.
 *
 * Retrieval positioning: InMemoryRetrievalService is the frozen rehearsal-style
 * (revision + semantic_reference keyed) V0 adapter. This test proves canonical
 * memory continuity, repository binding continuity, and frozen retrieval-path
 * visibility across cycles — NOT general semantic retrieval quality.
 */

import { describe, expect, it } from "vitest";

import type {
  AtomicCommitBundleAnyVersion,
  InMemoryFacadeAssembly,
  ProducerAuthorizationIssuer,
  SubjectStateV0
} from "@characteros-next/subject-core";
import { createInMemorySubjectCoreFacade } from "@characteros-next/subject-core";
import {
  computeRepositoryRevisionHash,
  InMemoryMemoryRepository,
  InMemoryRetrievalService,
  type MemoryPreparationAuthority
} from "@characteros-next/memory";

import { RuntimeCompositionRoot } from "../composition/runtime-composition-root.js";
import type { SubjectCorePort } from "../ports/subject-core-port.js";
import { ReferenceContextProducer } from "../ports/context-producer-port.js";
import { ReferenceRetrievalMetadataProducer } from "../ports/retrieval-metadata-producer-port.js";
import { ReferenceFastEmaAffectProducer } from "../producers/reference-fast-ema-affect-producer.js";
import { ReferenceRegulationV0Producer } from "../producers/reference-regulation-v0-producer.js";
import {
  fixedAppraisal,
  fixedInterpretation,
  s0
} from "../transitions/observation/observation-fixtures.js";
import { ObservationTransitionExecutor } from "../transitions/observation/observation-transition-executor.js";
import { InMemoryMiclWorkflowStore } from "../micl/micl-workflow-store.js";
import { createMiclStageMinter, miclWorkflowBinding } from "../micl/micl-capabilities.js";
import { InMemoryActionExecutionLedger } from "./action-executor-port.js";
import { ActionExecutionRunner } from "./action-runner.js";
import { DeterministicSandboxWorldV0 } from "./sandbox-world.js";
import { OutcomeReintegrationRunnerV0 } from "./outcome-reintegration-runner.js";

const SUBJECT_ID = "subject-s0";
const CYCLE1_OBSERVATION_ID = "observation:o-cycle1-person-x-asks-to-accept";
const CYCLE2_OBSERVATION_ID = "observation:o-cycle2-person-x-asks-again";

interface TestCore extends SubjectCorePort {
  readonly issuer: ProducerAuthorizationIssuer;
  readonly storeRead: {
    readCurrentBundle(subjectId: string): AtomicCommitBundleAnyVersion | null;
    readCommittedByTransitionId(id: string): AtomicCommitBundleAnyVersion | null;
    getCommittedBundles(): readonly AtomicCommitBundleAnyVersion[];
  };
}

function createTestCore(snapshot: SubjectStateV0, memory: InMemoryMemoryRepository): TestCore {
  const assembly: InMemoryFacadeAssembly = createInMemorySubjectCoreFacade({
    seedSnapshots: new Map([[SUBJECT_ID as never, snapshot]]),
    preparedResultValidator: async (binding) =>
      binding.prepared_result_ref.startsWith("workflow:"),
    referenceValidator: async (binding) =>
      memory.validateRevisionBinding(
        binding as unknown as Parameters<MemoryPreparationAuthority["validateRevisionBinding"]>[0]
      ),
    memoryAdoptionValidator: async (adoption) => {
      if (adoption.next_repository_revision_hash === null) return false;
      return memory.validateRevisionBinding({
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

function buildRoot(
  memory: InMemoryMemoryRepository,
  core: TestCore,
  retrievalService: InMemoryRetrievalService
): RuntimeCompositionRoot {
  return new RuntimeCompositionRoot({
    subjectCore: core,
    producerAuthorizationIssuer: core.issuer,
    memoryRepository: memory,
    retrieval: { retrieve: (query) => retrievalService.retrieve(query as never) },
    interpretation: fixedInterpretation(),
    appraisal: fixedAppraisal(0.9),
    affectProducer: new ReferenceFastEmaAffectProducer(),
    regulationProducer: new ReferenceRegulationV0Producer(),
    contextProducer: new ReferenceContextProducer(),
    retrievalMetadataProducer: new ReferenceRetrievalMetadataProducer(),
    learningSourceAuthority: {
      readCommittedBundle: async (id) => core.storeRead.readCommittedByTransitionId(id)
    },
    learningAdoptionAuthority: {
      markAdopted: (r) => memory.markAdopted(r),
      isAdopted: (r) => memory.isAdopted(r)
    }
  });
}

/** Commits one observation through the frozen executor against the given
 * rehearsal service (per-cycle retrieval declarations live with the caller). */
async function runObservation(
  root: RuntimeCompositionRoot,
  memory: InMemoryMemoryRepository,
  retrievalService: InMemoryRetrievalService,
  observationId: string
): Promise<AtomicCommitBundleAnyVersion> {
  const deps = root.dependencies();
  const snapshot = (await deps.subjectCore.readCurrentSnapshot(SUBJECT_ID as never)) as SubjectStateV0;
  const anchored = {
    subject_id: SUBJECT_ID as never,
    current_logical_time: snapshot.runtime_metadata.logical_time,
    state_revision: snapshot.runtime_metadata.state_revision
  } as never;
  const input = {
    schema_version: "observation-input-v0",
    subject_id: SUBJECT_ID as never,
    observation_id: observationId as never,
    occurrence_logical_time: snapshot.runtime_metadata.logical_time as never,
    source_refs: [`source:s-${observationId.replace(/^observation:o-/, "")}`] as never,
    entity_refs: ["entity:person-x"] as never
  };
  const revision = snapshot.memory_state.repository_revision as string;
  const manifest = await memory.readManifest(revision as never);
  if (manifest === null) throw new Error(`missing manifest for ${revision}`);
  const minter = createMiclStageMinter(
    deps.subjectCore,
    new InMemoryMiclWorkflowStore(),
    miclWorkflowBinding(`continuity-${observationId}` as never, "sha256:continuity" as never, "OBSERVATION")
  );
  const executor = new ObservationTransitionExecutor({
    ...deps,
    subjectCore: minter.core(),
    retrieval: { retrieve: (query) => retrievalService.retrieve(query as never) }
  });
  const outcome = await executor.execute(anchored, input as never, minter.capabilities([
    {
      repository_revision: revision,
      repository_revision_hash: await computeRepositoryRevisionHash(manifest)
    }
  ]));
  if (outcome.kind !== "COMMITTED") {
    throw new Error(`observation ${observationId} did not commit: ${outcome.kind}`);
  }
  return outcome.bundle;
}

/** Produces an AUTHORITATIVE outcome through the frozen action runner + sandbox. */
async function executeAction(
  ledger: InMemoryActionExecutionLedger,
  cognitionTransitionId: string
) {
  const sandbox = new DeterministicSandboxWorldV0();
  const runner = new ActionExecutionRunner(sandbox.executor(), ledger);
  const proposal = {
    schema_version: "cognition-proposal-v0",
    projection_hash: "sha256:continuity",
    reasoning_summary: "accept the request",
    relevant_memory_refs: [],
    considered_context_refs: ["entity:person-x"],
    current_intent: "accept request from person-x",
    confidence: 0.8,
    uncertainty: 0.2,
    action_intent: { action_type: "ACCEPT", target_ref: "entity:person-x" } as never,
    evidence_refs: ["entity:person-x"]
  } as unknown as Parameters<ActionExecutionRunner["run"]>[0]["proposal"];
  const result = await runner.run({
    subjectId: SUBJECT_ID,
    cognitionTransitionId,
    proposal,
    logicalTime: 0 as never
  });
  if (result.kind !== "EXECUTED") throw new Error(`expected EXECUTED, got ${result.kind}`);
  return result.outcome;
}

describe("Closed Loop Memory Continuity V0", () => {
  it("Cycle 1 (Action → Outcome → Observation → Learning → episode) is retrieval-visible in Cycle 2; replay adds +0", async () => {
    const memory = new InMemoryMemoryRepository();
    void memory.prepareRevision({ parent_revision: null, records: [] });
    const core = createTestCore(s0() as unknown as SubjectStateV0, memory);

    // Initial episodic count = 0 (empty genesis repository).
    const genesisManifest = await memory.readManifest("R0" as never);
    expect(genesisManifest?.record_hashes ?? []).toHaveLength(0);

    // ---- CYCLE 1: initial controlled observation (empty retrieval rehearsal) ----
    const emptyRetrieval = new InMemoryRetrievalService({
      rehearsals: [{
        repository_revision: "R0" as never,
        semantic_reference: CYCLE1_OBSERVATION_ID as never,
        selected_memory_refs: [] as never,
        evidence: [] as never,
        candidate_count: 0,
        retrieval_trace_ref: null as never
      }] as never
    });
    const root1 = buildRoot(memory, core, emptyRetrieval);
    await runObservation(root1, memory, emptyRetrieval, CYCLE1_OBSERVATION_ID);

    // ---- CYCLE 1: deterministic cognition → ActionIntent → execution ------------
    const executionLedger = new InMemoryActionExecutionLedger();
    const outcome = await executeAction(executionLedger, "t-cog-continuity-1");

    // ---- CYCLE 1: outcome reintegration (frozen Observation + Learning) ----------
    const reintegration = new OutcomeReintegrationRunnerV0(
      root1.dependencies(),
      new InMemoryMiclWorkflowStore(),
      executionLedger
    );
    const reintegrationResult = await reintegration.run({
      execution_id: outcome.execution_id,
      subject_id: SUBJECT_ID,
      cognition_transition_id: "t-cog-continuity-1",
      declared_salience: 0.5
    });
    expect(reintegrationResult.kind).toBe("REINTEGRATED");
    if (reintegrationResult.kind !== "REINTEGRATED") return;

    const learningBundle = core.storeRead.readCommittedByTransitionId(
      reintegrationResult.learning_transition_id
    );
    expect(learningBundle).not.toBeNull();
    if (learningBundle === null) throw new Error("learning bundle missing");
    const boundRevision = learningBundle.next_snapshot.memory_state
      .repository_revision as string;
    const manifest = await memory.readManifest(boundRevision as never);
    const episodeRefs = (manifest?.record_hashes ?? []).map((r) => r.ref as string);
    expect(episodeRefs).toHaveLength(1);
    const episodeRef = episodeRefs[0];
    if (episodeRef === undefined) throw new Error("episode ref missing");

    // ---- CYCLE 2: retrieval continuity through the frozen path -------------------
    // Rehearsal selections declare the ACTUAL Cycle 1 episode read from the R1
    // manifest — never a hard-coded id. No manual working_ref injection anywhere.
    const cycle2Retrieval = new InMemoryRetrievalService({
      rehearsals: [{
        repository_revision: boundRevision as never,
        semantic_reference: CYCLE2_OBSERVATION_ID as never,
        selected_memory_refs: [episodeRef as never],
        evidence: [
          {
            episode_ref: episodeRef as never,
            reasons: [{ dimension: "SEMANTIC", score: 0.9 } as never]
          } as never
        ] as never,
        candidate_count: 1,
        retrieval_trace_ref: "retrieval-trace:rt-cycle2" as never
      }] as never
    });
    const cycle2StartBundle = core.storeRead.readCurrentBundle(SUBJECT_ID);
    if (cycle2StartBundle === null) throw new Error("no pre-cycle-2 bundle");
    const root2 = buildRoot(memory, core, cycle2Retrieval);
    const cycle2Bundle = await runObservation(
      root2,
      memory,
      cycle2Retrieval,
      CYCLE2_OBSERVATION_ID
    );

    // Cycle 2 starts from Cycle 1 final canonical state (no rebuilt genesis).
    expect(cycle2StartBundle.next_snapshot).toBe(learningBundle.next_snapshot);
    // Retrieval reads the post-Learning bound repository revision.
    expect(cycle2StartBundle.next_snapshot.memory_state.repository_revision).toBe(boundRevision);
    // The Cycle 1 episode appears exactly once in the retrieval result.
    const workingRefs = cycle2Bundle.next_snapshot.memory_state.working_refs as unknown as string[];
    expect(workingRefs.filter((r) => r === episodeRef)).toHaveLength(1);

    // ---- Replay: reintegration replay adds +0 across every axis -------------------
    const bundlesBeforeReplay = core.storeRead.getCommittedBundles().length;
    const revisionBeforeReplay = core.storeRead.readCurrentBundle(SUBJECT_ID)?.next_revision;
    const replay = await reintegration.run({
      execution_id: outcome.execution_id,
      subject_id: SUBJECT_ID,
      cognition_transition_id: "t-cog-continuity-1",
      declared_salience: 0.5
    });
    expect(replay.kind).toBe("REINTEGRATED");
    expect(core.storeRead.getCommittedBundles().length).toBe(bundlesBeforeReplay);
    expect(core.storeRead.readCurrentBundle(SUBJECT_ID)?.next_revision).toBe(
      revisionBeforeReplay
    );
    const manifestAfterReplay = await memory.readManifest(boundRevision as never);
    expect((manifestAfterReplay?.record_hashes ?? []).map((r) => r.ref as string)).toEqual([
      episodeRef
    ]);

    // ---- Accounting: canonical traces and frozen logical-time semantics ----------
    const bundleTypes = core.storeRead.getCommittedBundles().map((b) => b.transition_type).sort();
    expect(bundleTypes).toEqual([
      "Learning",
      "Observation",
      "Observation",
      "Observation"
    ]);
    for (const bundle of core.storeRead.getCommittedBundles()) {
      // Only TimeTransition advances logical time; none ran in this lifecycle.
      expect(bundle.next_snapshot.runtime_metadata.logical_time).toBe(0);
      const traceTypes = bundle.next_snapshot.trace_window.entries.map(
        (e) => (e as { transition_type?: string }).transition_type
      );
      // No fake canonical ActionExecution/OutcomeReintegration trace entries.
      expect(traceTypes.filter((t) => t !== "Observation" && t !== "Learning")).toHaveLength(0);
    }
  });
});
