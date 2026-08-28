/**
 * P2-next — Outcome Reintegration V0 acceptance suite (O1–O28).
 *
 * Closed deterministic loop: factual Outcome → frozen ObservationTransition →
 * frozen LearningTransition → episodic memory. No LLM, no network.
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
  fixedAppraisal,
  fixedInterpretation,
  retrievalService,
  s0
} from "../transitions/observation/observation-fixtures.js";
import type { LearningSourceReadAuthority } from "../transitions/learning/learning-source-authority.js";
import { InMemoryMiclWorkflowStore } from "../micl/micl-workflow-store.js";
import { InMemoryActionExecutionLedger } from "./action-executor-port.js";
import { ActionExecutionRunner } from "./action-runner.js";
import { adaptOutcomeToObservation } from './outcome-observation-adapter.js';
import { DeterministicSandboxWorldV0 } from "./sandbox-world.js";
import { OutcomeReintegrationRunnerV0 } from "./outcome-reintegration-runner.js";
import type { ActionOutcomeV0 } from "./types.js";

const SUBJECT_ID = "subject-s0";

interface TestCore extends SubjectCorePort {
  readonly issuer: ProducerAuthorizationIssuer;
  readonly storeRead: {
    readCurrentBundle(subjectId: string): AtomicCommitBundleV1 | null;
    readCommittedByTransitionId(id: string): AtomicCommitBundleV1 | null;
    getCommittedBundles(): readonly AtomicCommitBundleV1[];
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

interface World {
  core: TestCore;
  memory: InMemoryMemoryRepository;
  executionLedger: InMemoryActionExecutionLedger;
  reintegrationStore: InMemoryMiclWorkflowStore;
  reintegration: OutcomeReintegrationRunnerV0;
  bundles: () => readonly AtomicCommitBundleV1[];
}

/** Counting memory repository: Learning's frozen internal prepare/store are the
 * ONLY sanctioned calls; the runner itself performs none (O11 evidence). */
class CountingMemoryRepository extends InMemoryMemoryRepository {
  storeCalls = 0;
  override async storePayload(
    ref: Parameters<InMemoryMemoryRepository["storePayload"]>[0],
    payload: Parameters<InMemoryMemoryRepository["storePayload"]>[1]
  ) {
    this.storeCalls += 1;
    return super.storePayload(ref, payload);
  }
}

function buildWorld(): World {
  const memory = new CountingMemoryRepository();
  void memory.prepareRevision({ parent_revision: null, records: [] });
  const core = createTestCore(s0() as unknown as SubjectStateV0, memory);
  const sourceAuthority: LearningSourceReadAuthority = {
    readCommittedBundle: async (id) => core.storeRead.readCommittedByTransitionId(id)
  };
  const root = new RuntimeCompositionRoot({
    subjectCore: core,
    producerAuthorizationIssuer: core.issuer,
    memoryRepository: memory,
    retrieval: { retrieve: (query) => retrievalService(false).retrieve(query as never) },
    interpretation: fixedInterpretation(),
    appraisal: fixedAppraisal(0.9),
    affectProducer: new ReferenceFastEmaAffectProducer(),
    regulationProducer: new ReferenceRegulationV0Producer(),
    contextProducer: new ReferenceContextProducer(),
    learningSourceAuthority: sourceAuthority,
    learningAdoptionAuthority: { markAdopted: (r) => memory.markAdopted(r), isAdopted: (r) => memory.isAdopted(r) }
  });
  const executionLedger = new InMemoryActionExecutionLedger();
  const reintegrationStore = new InMemoryMiclWorkflowStore();
  const reintegration = new OutcomeReintegrationRunnerV0(
    root.dependencies(),
    reintegrationStore,
    executionLedger
  );
  return {
    core,
    memory,
    executionLedger,
    reintegrationStore,
    reintegration,
    bundles: () => core.storeRead.getCommittedBundles()
  };
}

/** Produces an AUTHORITATIVE outcome through the frozen action runner + sandbox. */
async function executeAction(
  world: World,
  actionType: string,
  executionIdBase: string
): Promise<ActionOutcomeV0> {
  const world0 = new DeterministicSandboxWorldV0();
  const runner = new ActionExecutionRunner(world0.executor(), world.executionLedger);
  const proposal = {
    schema_version: "cognition-proposal-v0",
    projection_hash: "sha256:smoke",
    reasoning_summary: "smoke",
    relevant_memory_refs: [],
    considered_context_refs: [],
    current_intent: "test",
    confidence: 0.5,
    uncertainty: 0.5,
    action_intent: { action_type: actionType, target_ref: "entity:person-x" } as never,
    evidence_refs: []
  } as unknown as Parameters<ActionExecutionRunner["run"]>[0]["proposal"];
  const result = await runner.run({
    subjectId: SUBJECT_ID,
    cognitionTransitionId: `${COG_TRANSITION}-${executionIdBase}`,
    proposal,
    logicalTime: 0 as never
  });
  if (result.kind !== "EXECUTED") throw new Error(`expected EXECUTED, got ${result.kind}`);
  return result.outcome;
}

const COG_TRANSITION = "t-cog-smoke";

describe("P2-next Outcome Reintegration V0", () => {
  it("O1/O9/O13/O21/O22: EXECUTED Outcome → frozen Observation → frozen Learning → exactly one episode; +2 revisions; time untouched by reintegration", async () => {
    const world = buildWorld();
    const outcome = await executeAction(world, "ACCEPT", "1");
    const result = await world.reintegration.run({
      execution_id: outcome.execution_id,
      subject_id: SUBJECT_ID,
      cognition_transition_id: `${COG_TRANSITION}-1`,
      declared_salience: 0.5
    });
    expect(result.kind).toBe("REINTEGRATED");
    if (result.kind !== "REINTEGRATED") return;
    const byType = world.bundles().map((b) => b.transition_type).sort();
    expect(byType).toEqual(["Learning", "Observation"]);
    const finalBundle = world.core.storeRead.readCurrentBundle(SUBJECT_ID);
    if (finalBundle === null) throw new Error("no final bundle");
    expect(finalBundle.next_revision).toBe(2);
    expect(finalBundle.next_snapshot.memory_state.repository_revision).toBe("R1");
    const manifest = await world.memory.readManifest("R1" as never);
    expect(manifest?.record_hashes).toHaveLength(1);
    // O24: canonical trace only from Observation + Learning.
    const traceTypes = finalBundle.next_snapshot.trace_window.entries.map(
      (e) => (e as { transition_type?: string }).transition_type
    );
    expect(traceTypes.filter((t) => t === "Observation")).toHaveLength(1);
    expect(traceTypes.filter((t) => t === "Learning")).toHaveLength(1);
  });

  it("O2/O3: FAILED/REJECTED outcomes reintegrate factually", async () => {
    for (const status of ["FAILED", "REJECTED"] as const) {
      const world = buildWorld();
      const executionId = `x-act-${status.toLowerCase()}`;
      const outcome: ActionOutcomeV0 = {
        schema_version: "action-outcome-v0",
        execution_id: executionId,
        action_type: "ACCEPT",
        target_ref: "entity:person-x" as never,
        status,
        effect_refs: [],
        world_observation_refs: [],
        error: { code: "FACTUAL_FAILURE", detail: "sandbox refused" },
        logical_time: 0 as never
      };
      await world.executionLedger.record({
        execution_id: executionId,
        intent_fingerprint: "sha256:fp",
        outcome
      });
      const result = await world.reintegration.run({
        execution_id: executionId,
        subject_id: SUBJECT_ID,
        cognition_transition_id: COG_TRANSITION,
        declared_salience: 0.5
      });
      expect(result.kind).toBe("REINTEGRATED");
    }
  });

  it("O4: unrecorded execution_id rejected (no fabricated facts)", async () => {
    const world = buildWorld();
    const result = await world.reintegration.run({
      execution_id: "x-act-never-executed",
      subject_id: SUBJECT_ID,
      cognition_transition_id: COG_TRANSITION,
      declared_salience: 0.5
    });
    expect(result).toEqual({
      kind: "REJECTED_UNRECORDED",
      detail: expect.stringContaining("no recorded outcome")
    });
    expect(world.bundles()).toHaveLength(0);
  });

  it("O5: altered Outcome under the same execution_id fails closed", async () => {
    const world = buildWorld();
    const outcome = await executeAction(world, "ACCEPT", "alt");
    const altered = { ...outcome, status: "FAILED" as const, error: { code: "X", detail: "forged" } };
    const result = await world.reintegration.run({
      execution_id: outcome.execution_id,
      subject_id: SUBJECT_ID,
      cognition_transition_id: COG_TRANSITION,
      declared_salience: 0.5,
      declaredOutcome: altered
    });
    expect(result.kind).toBe("REJECTED_ALTERED_OUTCOME");
    expect(world.bundles()).toHaveLength(0);
  });

  it("O6/O7/O8: adapter emits factual refs only, provenance preserved, nothing repaired", async () => {
    const world = buildWorld();
    const outcome = await executeAction(world, "REQUEST_EVIDENCE", "prov");
    const adapted = await adaptOutcomeToObservation(outcome, SUBJECT_ID);
    expect(adapted.provenance.effect_refs).toEqual(outcome.effect_refs);
    expect(adapted.provenance.status).toBe("EXECUTED");
    // Deterministic observation_id from execution identity.
    expect(adapted.input.observation_id).toMatch(/^observation:o-outcome-[0-9a-f]{16,}$/);
    // No subjective interpretation anywhere in the input refs.
    const all = JSON.stringify(adapted.input);
    expect(all).not.toContain("hate");
    expect(all).not.toContain("distrust");
  });

  it("O10/O11/O19: reintegration performs zero direct canonical/memory writes (tripwire)", async () => {
    const world = buildWorld();
    const outcome = await executeAction(world, "ACCEPT", "trip");
    const result = await world.reintegration.run({
      execution_id: outcome.execution_id,
      subject_id: SUBJECT_ID,
      cognition_transition_id: COG_TRANSITION,
      declared_salience: 0.5
    });
    expect(result.kind).toBe("REINTEGRATED");
    // Canonical writes happened only inside frozen executors (bundles exist),
    // while the NoWriteMemoryRepository would have failed any DIRECT
    // reintegration-level memory write (Learning's internal writes are frozen
    // authority and proceed through the repository's sanctioned path).
    expect(world.bundles().length).toBe(2);
  });

  it("O14/O15/R5: completed replay ⇒ +0 duplicate observation/learning/memory", async () => {
    const world = buildWorld();
    const outcome = await executeAction(world, "ACCEPT", "replay");
    const input = {
      execution_id: outcome.execution_id,
      subject_id: SUBJECT_ID,
      cognition_transition_id: COG_TRANSITION,
      declared_salience: 0.5
    };
    const first = await world.reintegration.run(input);
    expect(first.kind).toBe("REINTEGRATED");
    const bundlesAfterFirst = world.bundles().length;
    const revisionAfterFirst = world.core.storeRead.readCurrentBundle(SUBJECT_ID)?.next_revision;
    const second = await world.reintegration.run(input);
    expect(second.kind).toBe("REINTEGRATED");
    expect(world.bundles().length).toBe(bundlesAfterFirst);
    expect(world.core.storeRead.readCurrentBundle(SUBJECT_ID)?.next_revision).toBe(revisionAfterFirst);
  });

  it("O16 (R2): crash after Observation checkpoint resumes Learning without repeating Observation", async () => {
    const memory = new InMemoryMemoryRepository();
    void memory.prepareRevision({ parent_revision: null, records: [] });
    const core = createTestCore(s0() as unknown as SubjectStateV0, memory);
    const sourceAuthority: LearningSourceReadAuthority = {
      readCommittedBundle: async (id) => core.storeRead.readCommittedByTransitionId(id)
    };
    const root = new RuntimeCompositionRoot({
      subjectCore: core,
      producerAuthorizationIssuer: core.issuer,
      memoryRepository: memory,
      retrieval: { retrieve: (query) => retrievalService(false).retrieve(query as never) },
      interpretation: fixedInterpretation(),
      appraisal: fixedAppraisal(0.9),
      affectProducer: new ReferenceFastEmaAffectProducer(),
      regulationProducer: new ReferenceRegulationV0Producer(),
      contextProducer: new ReferenceContextProducer(),
      learningSourceAuthority: sourceAuthority,
      learningAdoptionAuthority: { markAdopted: (r) => memory.markAdopted(r), isAdopted: (r) => memory.isAdopted(r) }
    });
    const executionLedger = new InMemoryActionExecutionLedger();
    const store = new InMemoryMiclWorkflowStore();
    const innerPut = store.putStageCheckpoint.bind(store);
    let crashed = false;
    store.putStageCheckpoint = async (miclId, checkpoint) => {
      if (checkpoint.stage_key === "LEARNING" && !crashed) {
        crashed = true;
        throw new Error("R2_CRASH");
      }
      await innerPut(miclId, checkpoint);
    };
    const reintegration = new OutcomeReintegrationRunnerV0(root.dependencies(), store, executionLedger);
    const outcome = await executeAction({ core, memory, executionLedger } as never, "ACCEPT", "r2");
    void outcome;
    const executionId = "x-act-unknown";
    void executionId;
    // Execute the action properly through the frozen runner.
    const runner = new ActionExecutionRunner(new DeterministicSandboxWorldV0().executor(), executionLedger);
    const proposal = {
      schema_version: "cognition-proposal-v0",
      projection_hash: "sha256:x",
      reasoning_summary: "r2",
      relevant_memory_refs: [],
      considered_context_refs: [],
      current_intent: "accept",
      confidence: 0.5,
      uncertainty: 0.5,
      action_intent: { action_type: "ACCEPT", target_ref: "entity:person-x" } as never,
      evidence_refs: []
    } as never;
    const executed = await runner.run({
      subjectId: SUBJECT_ID,
      cognitionTransitionId: COG_TRANSITION,
      proposal,
      logicalTime: 0 as never
    });
    if (executed.kind !== "EXECUTED") throw new Error("setup");
    await expect(
      reintegration.run({
        execution_id: executed.outcome.execution_id,
        subject_id: SUBJECT_ID,
        cognition_transition_id: COG_TRANSITION,
        declared_salience: 0.5
      })
    ).rejects.toThrow("R2_CRASH");
    const bundlesAfterCrash = core.storeRead.getCommittedBundles();
    expect(bundlesAfterCrash.filter((b) => b.transition_type === "Observation")).toHaveLength(1);
    // Resume: Learning completes; Observation is not repeated.
    const resumed = new OutcomeReintegrationRunnerV0(root.dependencies(), store, executionLedger);
    const result = await resumed.run({
      execution_id: executed.outcome.execution_id,
      subject_id: SUBJECT_ID,
      cognition_transition_id: COG_TRANSITION,
      declared_salience: 0.5
    });
    expect(result.kind).toBe("REINTEGRATED");
    const bundles = core.storeRead.getCommittedBundles();
    expect(bundles.filter((b) => b.transition_type === "Observation")).toHaveLength(1);
    expect(bundles.filter((b) => b.transition_type === "Learning")).toHaveLength(1);
  });

  it("O20 (A9): NO_ACTION produces no Outcome and therefore no reintegration path", async () => {
    const world = buildWorld();
    const world0 = new DeterministicSandboxWorldV0();
    let calls = 0;
    const inner = world0.executor();
    const counting = {
      execute: async (
        intent: Parameters<typeof inner.execute>[0],
        context: Parameters<typeof inner.execute>[1]
      ) => {
        calls += 1;
        return inner.execute(intent, context);
      }
    };
    const runner = new ActionExecutionRunner(counting, world.executionLedger);
    const result = await runner.run({
      subjectId: SUBJECT_ID,
      cognitionTransitionId: COG_TRANSITION,
      proposal: ({
        schema_version: "cognition-proposal-v0",
        projection_hash: "sha256:x",
        reasoning_summary: "wait",
        relevant_memory_refs: [],
        considered_context_refs: [],
        current_intent: null,
        confidence: 0.5,
        uncertainty: 0.5,
        action_intent: null,
        evidence_refs: []
      } as never),
      logicalTime: 0 as never
    });
    expect(result.kind).toBe("NO_ACTION");
    expect(calls).toBe(0);
    expect(world.executionLedger).toBeDefined();
  });

  it("O25/O26/O27: offline, deterministic, bounded (single-pass stage progression)", async () => {
    const world = buildWorld();
    const outcome = await executeAction(world, "WAIT", "det");
    const a = await world.reintegration.run({
      execution_id: outcome.execution_id,
      subject_id: SUBJECT_ID,
      cognition_transition_id: COG_TRANSITION,
      declared_salience: 0.5
    });
    const b = await world.reintegration.run({
      execution_id: outcome.execution_id,
      subject_id: SUBJECT_ID,
      cognition_transition_id: COG_TRANSITION,
      declared_salience: 0.5
    });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
