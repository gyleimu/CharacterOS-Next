/**
 * P2.3.5.3a — Trusted Learning input attack matrix (T1–T18 + cross-source
 * mixing). Proves that a Learning candidate becomes trusted ONLY when its
 * claimed semantic provenance revalidates against durable evidence of the SAME
 * committed Observation — never because its type is correct, its refs parse,
 * or the caller says so. Also proves the slice performs ZERO memory writes and
 * ZERO canonical mutation.
 */

import { beforeAll, describe, expect, it } from "vitest";

import type { AtomicCommitBundleV1, CanonicalRefV0, InMemoryFacadeAssembly, SubjectStateV0 } from "@characteros-next/subject-core";
import { createInMemorySubjectCoreFacade } from "@characteros-next/subject-core";
import type { MemoryPreparationAuthority } from "@characteros-next/memory";
import type { RuntimeContext } from "../../types/runtime-context.js";
import type { SubjectCorePort } from "../../ports/subject-core-port.js";
import type { AppraisalProposalDraftV0 } from "../../ports/appraisal-port.js";
import { buildContextDelta } from "../../ports/context-producer-port.js";
import { RuntimeCompositionRoot } from "../../composition/runtime-composition-root.js";
import {
  RealEngineCoreAdapter,
  buildObservationHarness,
  capabilitiesFor,
  fixedAffectProducer,
  fixedAppraisal,
  fixedInterpretation,
  observationInput,
  retrievalService,
  s0
} from "../observation/observation-fixtures.js";
import {
  buildObservationProposal,
  ObservationTransitionExecutor
} from "../observation/observation-transition-executor.js";
import { ReferenceFastEmaAffectProducer } from "../../producers/reference-fast-ema-affect-producer.js";
import { ReferenceContextProducer } from "../../ports/context-producer-port.js";
import {
  TimeTransitionExecutor,
  buildTimeProposal
} from "../time/time-transition-executor.js";
import {
  validateTrustedLearningExperience,
  isTrustedLearningExperience,
  type LearningSourceReadAuthority,
  type TrustedLearningExperienceV0
} from "./learning-source-authority.js";

// ---------------------------------------------------------------------------------
// Infrastructure fixtures
// ---------------------------------------------------------------------------------

class MemoryRepositoryStub implements MemoryPreparationAuthority {
  prepareCalls = 0;
  storeCalls = 0;
  async storePayload(): Promise<never> {
    this.storeCalls += 1;
    throw new Error("P2.3.5.3a must never store payloads");
  }
  async payloadHashOf(): Promise<null> {
    return null;
  }
  async prepareRevisionForIntent(): Promise<never> {
    this.prepareCalls += 1;
    throw new Error("P2.3.5.3a must never prepare revisions");
  }
  async readManifest(): Promise<null> {
    return null;
  }
  async validateRevisionBinding(): Promise<boolean> {
    return true;
  }
  async validateRefsBelong(): Promise<boolean> {
    return true;
  }
  readonly repository = Object.freeze({});
}

/** Subject-core adapter seeded for an arbitrary subject (cross-subject fixture). */
class SeededCoreAdapter implements SubjectCorePort {
  readonly assembly: InMemoryFacadeAssembly;
  constructor(private readonly initial: SubjectStateV0, subjectId: string) {
    this.assembly = createInMemorySubjectCoreFacade({
      seedSnapshots: new Map([[subjectId as never, initial]]),
      preparedResultValidator: async (binding) =>
        binding.prepared_result_ref === "workflow:w-obs-1"
    });
  }
  get producerAuthorizationIssuer() {
    return this.assembly.producerAuthorizationIssuer;
  }
  get storeRead() {
    return this.assembly.storeRead;
  }
  reserveAndRoute(proposal: Parameters<SubjectCorePort["reserveAndRoute"]>[0]) {
    return this.assembly.facade.reserveAndRoute(proposal);
  }
  commitReserved(input: Parameters<SubjectCorePort["commitReserved"]>[0]) {
    return this.assembly.facade.commitReserved(input);
  }
  terminalizeReservedNoOp(input: Parameters<SubjectCorePort["terminalizeReservedNoOp"]>[0]) {
    return this.assembly.facade.terminalizeReservedNoOp(input);
  }
  reconcile(
    transitionId: Parameters<SubjectCorePort["reconcile"]>[0],
    subjectId: Parameters<SubjectCorePort["reconcile"]>[1],
    fingerprint: Parameters<SubjectCorePort["reconcile"]>[2]
  ) {
    return this.assembly.facade.reconcile(transitionId, subjectId, fingerprint);
  }
  async readCurrentSnapshot(subjectId: string): Promise<SubjectStateV0 | null> {
    const bundle = this.assembly.storeRead.readCurrentBundle(subjectId);
    return bundle !== null ? bundle.next_snapshot : this.initial;
  }
}

function ctxOf(subjectId: string, snapshot: SubjectStateV0): RuntimeContext {
  return {
    subject_id: subjectId as never,
    current_logical_time: snapshot.runtime_metadata.logical_time as never,
    state_revision: snapshot.runtime_metadata.state_revision as never
  };
}

/** The fixed appraisal draft the default harness provider returns for one observation. */
function appraisalDraftFor(observationId: string): AppraisalProposalDraftV0 {
  return {
    schema_version: "appraisal-v0",
    appraisal_ref: `appraisal:ap-${observationId.replace(":", "-")}`,
    evidence_refs: ["episode:e-9"],
    relevance: 0.9,
    goal_congruence: 0.9,
    attribution: "situation",
    controllability: 0.9,
    uncertainty: 0.9,
    intensity: 0.9
  } as unknown as AppraisalProposalDraftV0;
}

// ---------------------------------------------------------------------------------
// Committed-source world: Observation A (o-77) + Observation B (o-78) on
// subject-s0 with the REAL affect producer (committed channels durably carry
// source_appraisal_ref), plus a committed Time bundle and a committed
// Observation on a DIFFERENT subject (borrowing attack surface).
// ---------------------------------------------------------------------------------

interface World {
  core: RealEngineCoreAdapter;
  foreignCore: SeededCoreAdapter;
  timeCore: SeededCoreAdapter;
  memory: { prepareCalls: number; storeCalls?: number; readCalls?: number };
  ctx: RuntimeContext;
  bundleA: AtomicCommitBundleV1;
  bundleB: AtomicCommitBundleV1;
  timeBundle: AtomicCommitBundleV1;
  foreignBundle: AtomicCommitBundleV1;
  executor: ObservationTransitionExecutor;
}

const world: Partial<World> = {};

async function commitObservation(harness: {
  core: RealEngineCoreAdapter;
  ctx: RuntimeContext;
  executor: ObservationTransitionExecutor;
}, observationId: string): Promise<AtomicCommitBundleV1> {
  const current = harness.core.storeRead.readCurrentBundle("subject-s0");
  const snapshot = current === null
    ? (s0() as unknown as SubjectStateV0)
    : current.next_snapshot;
  const revision = snapshot.runtime_metadata.state_revision as number;
  const ctx = ctxOf("subject-s0", snapshot);
  const observation = observationInput({ observation_id: observationId });
  const affectDelta = await new ReferenceFastEmaAffectProducer().produceAffectDelta({
    context: ctx,
    snapshot,
    transition_type: "Observation",
    appraisal: appraisalDraftFor(observationId),
    elapsed_ticks: null
  });
  const contextDelta = await buildContextDelta(observation, snapshot);
  const proposal = await buildObservationProposal({
    subjectId: "subject-s0",
    stateRevision: revision,
    observation,
    deltas: [affectDelta, contextDelta]
  });
  const outcome = await harness.executor.execute(ctx, observation, await capabilitiesFor(proposal));
  if (outcome.kind !== "COMMITTED") throw new Error(`expected COMMITTED, got ${outcome.kind}`);
  const bundle = harness.core.storeRead.readCommittedByTransitionId(outcome.bundle.transition_id);
  if (bundle === null) throw new Error("committed bundle must be readable by transition id");
  return bundle;
}

beforeAll(async () => {
  // Observation source world (real affect producer ⇒ durable appraisal evidence).
  const harness = buildObservationHarness({
    affectProducer: new ReferenceFastEmaAffectProducer()
  });
  const bundleA = await commitObservation(harness, "observation:o-77");
  const bundleB = await commitObservation(harness, "observation:o-78");

  // Committed Time bundle (wrong-type source attack surface).
  const timeInitial = s0() as unknown as SubjectStateV0;
  const timeCore = new SeededCoreAdapter(timeInitial, "subject-s0");
  const timeMemory = new MemoryRepositoryStub();
  const fixedRegulation = {
    producer: "regulation",
    domain: "regulation",
    expected_repository_revision: null,
    operations: [
      {
        path: "/regulation",
        value: { energy: 1, stress: 0, arousal: 0.5, fatigue: 0, last_update: 5 }
      }
    ],
    provenance_refs: []
  };
  const timeRoot = new RuntimeCompositionRoot({
    subjectCore: timeCore,
    producerAuthorizationIssuer: timeCore.producerAuthorizationIssuer,
    memoryRepository: timeMemory,
    retrieval: {
      retrieve: async () => {
        throw new Error("Time never calls retrieval");
      }
    },
    affectProducer: fixedAffectProducer(),
    regulationProducer: { produceRegulationDelta: async () => fixedRegulation as never }
  });
  const timeExecutor = new TimeTransitionExecutor(timeRoot.dependencies());
  const affectDelta = await fixedAffectProducer().produceAffectDelta({
    context: ctxOf("subject-s0", timeInitial),
    snapshot: timeInitial,
    transition_type: "Observation",
    appraisal: null,
    elapsed_ticks: null
  });
  const timeOutcome = await timeExecutor.execute(
    ctxOf("subject-s0", timeInitial),
    { elapsed_ticks: 5 },
    await capabilitiesFor(buildTimeProposal("subject-s0", 0, 5, affectDelta, fixedRegulation as never))
  );
  if (timeOutcome.kind !== "COMMITTED") throw new Error("expected COMMITTED Time bundle");
  const timeBundle = timeCore.storeRead.readCommittedByTransitionId(timeOutcome.bundle.transition_id);
  if (timeBundle === null) throw new Error("time bundle must be readable");

  // Committed Observation on a DIFFERENT subject (cross-subject borrowing).
  const foreignInitial = structuredClone(s0()) as Record<string, unknown>;
  (foreignInitial["identity"] as Record<string, unknown>)["subject_id"] = "subject-b";
  const foreignSnapshot = foreignInitial as unknown as SubjectStateV0;
  const foreignCore = new SeededCoreAdapter(foreignSnapshot, "subject-b");
  const foreignRoot = new RuntimeCompositionRoot({
    subjectCore: foreignCore,
    producerAuthorizationIssuer: foreignCore.producerAuthorizationIssuer,
    memoryRepository: new MemoryRepositoryStub(),
    retrieval: retrievalService(true),
    interpretation: fixedInterpretation(),
    appraisal: fixedAppraisal(0.9),
    affectProducer: fixedAffectProducer(),
    contextProducer: new ReferenceContextProducer()
  });
  const foreignExecutor = new ObservationTransitionExecutor(foreignRoot.dependencies());
  const foreignCtx = ctxOf("subject-b", foreignSnapshot);
  const foreignObservation = observationInput({ subject_id: "subject-b", observation_id: "observation:o-b1" });
  const foreignAffect = await fixedAffectProducer().produceAffectDelta({
    context: foreignCtx,
    snapshot: foreignSnapshot,
    transition_type: "Observation",
    appraisal: null,
    elapsed_ticks: null
  });
  const foreignContext = await buildContextDelta(foreignObservation, foreignSnapshot);
  const foreignProposal = await buildObservationProposal({
    subjectId: "subject-b",
    stateRevision: 0,
    observation: foreignObservation,
    deltas: [foreignAffect, foreignContext]
  });
  const foreignOutcome = await foreignExecutor.execute(
    foreignCtx,
    foreignObservation,
    await capabilitiesFor(foreignProposal)
  );
  if (foreignOutcome.kind !== "COMMITTED") {
    throw new Error(`expected COMMITTED foreign bundle, got ${JSON.stringify(foreignOutcome)}`);
  }
  const foreignBundle = foreignCore.storeRead.readCommittedByTransitionId(foreignOutcome.bundle.transition_id);
  if (foreignBundle === null) throw new Error("foreign bundle must be readable");

  world.core = harness.core;
  world.foreignCore = foreignCore;
  world.timeCore = timeCore;
  world.memory = harness.memory;
  world.ctx = harness.ctx;
  world.bundleA = bundleA;
  world.bundleB = bundleB;
  world.timeBundle = timeBundle;
  world.foreignBundle = foreignBundle;
  world.executor = harness.executor;
});

function readAuthority(): LearningSourceReadAuthority & { lookups: number } {
  const store = world.core as RealEngineCoreAdapter;
  const authority = {
    lookups: 0,
    readCommittedBundle: async (transitionId: string) => {
      authority.lookups += 1;
      return store.storeRead.readCommittedByTransitionId(transitionId);
    }
  };
  return authority;
}

/**
 * Composite read face over ALL committed stores — mirrors the production
 * single-store readCommittedByTransitionId scan so foreign-subject and
 * wrong-type bundles are FINDABLE and the semantic checks (not the lookup)
 * reject them.
 */
function sharedReadAuthority(): LearningSourceReadAuthority {
  return {
    readCommittedBundle: async (transitionId: string) => {
      const own = (world.core as RealEngineCoreAdapter).storeRead.readCommittedByTransitionId(transitionId);
      if (own !== null) return own;
      const time = (world.timeCore as SeededCoreAdapter).storeRead.readCommittedByTransitionId(transitionId);
      if (time !== null) return time;
      return (world.foreignCore as SeededCoreAdapter).storeRead.readCommittedByTransitionId(transitionId);
    }
  };
}

/** Well-formed candidate bound to one committed source bundle. */
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
    declared_salience: 0.7,
    ...overrides
  };
}

function appraisalEvidenceOf(bundle: AtomicCommitBundleV1): CanonicalRefV0 {
  const channel = bundle.next_snapshot.affect.active_channels[0];
  if (channel === undefined) throw new Error("fixture invariant: expected one committed channel");
  return channel.source_appraisal_ref;
}

// ---------------------------------------------------------------------------------
// T1–T18 attack matrix
// ---------------------------------------------------------------------------------

describe("P2.3.5.3a trusted Learning input attack matrix", () => {
  it("T1: valid trusted candidate succeeds (null + evidenced appraisal variants)", async () => {
    const bundleA = world.bundleA as AtomicCommitBundleV1;
    const plain = await validateTrustedLearningExperience(
      readAuthority(),
      world.ctx as RuntimeContext,
      candidateFor(bundleA)
    );
    expect(plain.ok).toBe(true);
    if (!plain.ok) return;
    expect(plain.value.source_transition_id).toBe(bundleA.transition_id);
    expect(Object.isFrozen(plain.value)).toBe(true);

    const evidenced = await validateTrustedLearningExperience(
      readAuthority(),
      world.ctx as RuntimeContext,
      candidateFor(bundleA, { appraisal_ref: appraisalEvidenceOf(bundleA) })
    );
    expect(evidenced.ok).toBe(true);
  });

  it("T2: unknown source_transition_id rejected (grammar-valid but uncommitted)", async () => {
    const checked = await validateTrustedLearningExperience(
      readAuthority(),
      world.ctx as RuntimeContext,
      candidateFor(world.bundleA as AtomicCommitBundleV1, {
        source_transition_id: "t-obs-ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
      })
    );
    expect(checked.ok).toBe(false);
    if (!checked.ok) {
      expect(checked.error.error_code).toBe("INVALID_STAGE_DEPENDENCY");
      expect(checked.error.reason).toBe("MICL-STAGE-001");
    }
  });

  it("T3: source bundle belonging to another subject rejected (cross-subject borrowing)", async () => {
    const foreign = world.foreignBundle as AtomicCommitBundleV1;
    const checked = await validateTrustedLearningExperience(
      sharedReadAuthority(),
      world.ctx as RuntimeContext,
      candidateFor(foreign)
    );
    expect(checked.ok).toBe(false);
    if (!checked.ok) {
      expect(checked.error.error_code).toBe("UNKNOWN_SUBJECT");
      expect(checked.error.reason).toBe("SS-AUTH-001");
    }
  });

  it("T4: committed Time transition used as source rejected", async () => {
    const checked = await validateTrustedLearningExperience(
      sharedReadAuthority(),
      world.ctx as RuntimeContext,
      candidateFor(world.timeBundle as AtomicCommitBundleV1, {
        observation_ref: "observation:o-source"
      })
    );
    expect(checked.ok).toBe(false);
    if (!checked.ok) {
      expect(checked.error.error_code).toBe("INVALID_STAGE_DEPENDENCY");
      expect(checked.error.reason).toBe("MICL-STAGE-001");
      expect(checked.error.detail).toContain("Observation");
    }
  });

  it("T5: fabricated appraisal_ref rejected (valid grammar, no source evidence)", async () => {
    const checked = await validateTrustedLearningExperience(
      readAuthority(),
      world.ctx as RuntimeContext,
      candidateFor(world.bundleA as AtomicCommitBundleV1, {
        appraisal_ref: "appraisal:ap-fabricated-1"
      })
    );
    expect(checked.ok).toBe(false);
    if (!checked.ok) {
      expect(checked.error.error_code).toBe("UNSUPPORTED_EVIDENCE_REF");
      expect(checked.error.reason).toBe("LLM-EVID-001");
    }
  });

  it("T6: appraisal_ref from a DIFFERENT committed Observation rejected", async () => {
    const bundleB = world.bundleB as AtomicCommitBundleV1;
    const checked = await validateTrustedLearningExperience(
      readAuthority(),
      world.ctx as RuntimeContext,
      candidateFor(world.bundleA as AtomicCommitBundleV1, {
        appraisal_ref: appraisalEvidenceOf(bundleB)
      })
    );
    expect(checked.ok).toBe(false);
    if (!checked.ok) {
      expect(checked.error.error_code).toBe("UNSUPPORTED_EVIDENCE_REF");
    }
  });

  it("T7: fabricated scene rejected", async () => {
    const checked = await validateTrustedLearningExperience(
      readAuthority(),
      world.ctx as RuntimeContext,
      candidateFor(world.bundleA as AtomicCommitBundleV1, { scene: "fabricated-lab" })
    );
    expect(checked.ok).toBe(false);
    if (!checked.ok) expect(checked.error.error_code).toBe("UNSUPPORTED_EVIDENCE_REF");
  });

  it("T8: fabricated focus ref rejected", async () => {
    const checked = await validateTrustedLearningExperience(
      readAuthority(),
      world.ctx as RuntimeContext,
      candidateFor(world.bundleA as AtomicCommitBundleV1, { focus_refs: ["entity:e-999"] })
    );
    expect(checked.ok).toBe(false);
    if (!checked.ok) expect(checked.error.error_code).toBe("UNSUPPORTED_EVIDENCE_REF");
  });

  it("T9: fabricated environment ref rejected", async () => {
    const checked = await validateTrustedLearningExperience(
      readAuthority(),
      world.ctx as RuntimeContext,
      candidateFor(world.bundleA as AtomicCommitBundleV1, {
        environment_refs: ["environment:room-999"]
      })
    );
    expect(checked.ok).toBe(false);
    if (!checked.ok) expect(checked.error.error_code).toBe("UNSUPPORTED_EVIDENCE_REF");
  });

  it("T10: occurrence logical time mismatch rejected (no caller-selected alternative)", async () => {
    const checked = await validateTrustedLearningExperience(
      readAuthority(),
      world.ctx as RuntimeContext,
      candidateFor(world.bundleA as AtomicCommitBundleV1, {
        occurrence_logical_time:
          ((world.bundleA as AtomicCommitBundleV1).logical_time_after as number) + 1
      })
    );
    expect(checked.ok).toBe(false);
    if (!checked.ok) {
      expect(checked.error.error_code).toBe("INVALID_LOGICAL_TIME");
      expect(checked.error.reason).toBe("TIME-OCCURRENCE-001");
    }
  });

  it("T11: syntactically valid observation_ref without semantic source evidence rejected", async () => {
    const checked = await validateTrustedLearningExperience(
      readAuthority(),
      world.ctx as RuntimeContext,
      candidateFor(world.bundleA as AtomicCommitBundleV1, {
        observation_ref: "observation:o-999"
      })
    );
    expect(checked.ok).toBe(false);
    if (!checked.ok) expect(checked.error.error_code).toBe("UNSUPPORTED_EVIDENCE_REF");
  });

  it("T12: malformed candidate shapes rejected fail-closed", async () => {
    const base = candidateFor(world.bundleA as AtomicCommitBundleV1);
    const missingSubject = { ...base };
    delete missingSubject["subject_id"];
    const variants: unknown[] = [
      missingSubject,
      { ...base, occurrence_logical_time: "0" },
      { ...base, occurrence_logical_time: Number.NaN },
      { ...base, appraisal_ref: "episode:e-1" },
      { ...base, observation_ref: "memory:m-1" },
      { ...base, scene: "" },
      { ...base, entity_refs: ["subject:s0", "entity:e-1"] }, // not lexicographically sorted
      "not-an-object",
      null
    ];
    for (const bad of variants) {
      const checked = await validateTrustedLearningExperience(readAuthority(), world.ctx as RuntimeContext, bad);
      expect(checked.ok).toBe(false);
      if (!checked.ok) expect(checked.error.error_code).toBe("INVALID_SCHEMA");
    }
    // Range violations surface through the existing frozen UnitInterval family.
    const rangeChecked = await validateTrustedLearningExperience(
      readAuthority(),
      world.ctx as RuntimeContext,
      candidateFor(world.bundleA as AtomicCommitBundleV1, { declared_salience: 1.5 })
    );
    expect(rangeChecked.ok).toBe(false);
    if (!rangeChecked.ok) expect(rangeChecked.error.error_code).toBe("INVALID_VALUE_RANGE");
  });

  it("T13: unexpected extra field rejected (closed shape is normative)", async () => {
    const checked = await validateTrustedLearningExperience(
      readAuthority(),
      world.ctx as RuntimeContext,
      candidateFor(world.bundleA as AtomicCommitBundleV1, { smuggled_payload: "x" })
    );
    expect(checked.ok).toBe(false);
    if (!checked.ok) {
      expect(checked.error.error_code).toBe("INVALID_SCHEMA");
      expect(checked.error.detail).toContain("unknown key");
    }
  });

  it("T14: repeated validation is deterministic (byte-equivalent trusted output)", async () => {
    const candidate = candidateFor(world.bundleA as AtomicCommitBundleV1, {
      appraisal_ref: appraisalEvidenceOf(world.bundleA as AtomicCommitBundleV1)
    });
    const first = await validateTrustedLearningExperience(readAuthority(), world.ctx as RuntimeContext, candidate);
    const second = await validateTrustedLearningExperience(readAuthority(), world.ctx as RuntimeContext, candidate);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(JSON.stringify(first.value)).toBe(JSON.stringify(second.value));
  });

  it("T15: host resupply after fresh authority reconstruction produces equivalent result", async () => {
    const candidate = JSON.parse(
      JSON.stringify(candidateFor(world.bundleA as AtomicCommitBundleV1))
    ) as Record<string, unknown>;
    const resupplied = JSON.parse(JSON.stringify(candidate)) as Record<string, unknown>;
    const first = await validateTrustedLearningExperience(readAuthority(), world.ctx as RuntimeContext, candidate);
    const second = await validateTrustedLearningExperience(readAuthority(), world.ctx as RuntimeContext, resupplied);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(JSON.stringify(first.value)).toBe(JSON.stringify(second.value));
  });

  it("T16: validation performs zero memory prepare/write", async () => {
    const memory = world.memory as { prepareCalls: number; storeCalls?: number; readCalls?: number };
    const prepareBefore = memory.prepareCalls;
    const storeBefore = memory.storeCalls ?? 0;
    const bundlesBefore = (world.core as RealEngineCoreAdapter).storeRead.getCommittedBundles().length;
    const checked = await validateTrustedLearningExperience(
      readAuthority(),
      world.ctx as RuntimeContext,
      candidateFor(world.bundleA as AtomicCommitBundleV1)
    );
    expect(checked.ok).toBe(true);
    expect(memory.prepareCalls).toBe(prepareBefore);
    expect(memory.storeCalls ?? 0).toBe(storeBefore);
    expect((world.core as RealEngineCoreAdapter).storeRead.getCommittedBundles().length).toBe(bundlesBefore);
  });

  it("T17: validation performs zero SubjectCore canonical commit", async () => {
    const before = (world.core as RealEngineCoreAdapter).storeRead.getCommittedBundles().length;
    const revisions = ["subject-s0"].map((id) => (world.core as RealEngineCoreAdapter).storeRead.currentRevision(id));
    for (const candidate of [
      candidateFor(world.bundleA as AtomicCommitBundleV1),
      candidateFor(world.bundleA as AtomicCommitBundleV1, { appraisal_ref: "appraisal:ap-fabricated-2" })
    ]) {
      await validateTrustedLearningExperience(readAuthority(), world.ctx as RuntimeContext, candidate);
    }
    expect((world.core as RealEngineCoreAdapter).storeRead.getCommittedBundles().length).toBe(before);
    expect(
      ["subject-s0"].map((id) => (world.core as RealEngineCoreAdapter).storeRead.currentRevision(id))
    ).toEqual(revisions);
  });

  it("T18: candidate input is never mutated (deep-frozen input survives byte-identically)", async () => {
    const candidate = candidateFor(world.bundleA as AtomicCommitBundleV1);
    const bytesBefore = JSON.stringify(candidate);
    const frozen = JSON.parse(bytesBefore) as Record<string, unknown>;
    const freeze = (value: unknown): void => {
      if (value === null || typeof value !== "object") return;
      Object.freeze(value);
      for (const key of Object.keys(value as Record<string, unknown>)) {
        freeze((value as Record<string, unknown>)[key]);
      }
    };
    freeze(frozen);
    const checked = await validateTrustedLearningExperience(readAuthority(), world.ctx as RuntimeContext, frozen);
    expect(checked.ok).toBe(true);
    expect(JSON.stringify(frozen)).toBe(bytesBefore);
  });

  it("§18 cross-source mixing: source from A + appraisal evidence from B rejected", async () => {
    const bundleA = world.bundleA as AtomicCommitBundleV1;
    const bundleB = world.bundleB as AtomicCommitBundleV1;
    const mixed = await validateTrustedLearningExperience(
      readAuthority(),
      world.ctx as RuntimeContext,
      candidateFor(bundleA, { appraisal_ref: appraisalEvidenceOf(bundleB) })
    );
    expect(mixed.ok).toBe(false);
    const mixedObservation = await validateTrustedLearningExperience(
      readAuthority(),
      world.ctx as RuntimeContext,
      candidateFor(bundleA, { observation_ref: bundleB.trace_entry.cause_refs[0] })
    );
    expect(mixedObservation.ok).toBe(false);
  });

  it("surface B wiring: prepared domain_result_refs of the SAME transition extend appraisal authority", async () => {
    const bundleA = world.bundleA as AtomicCommitBundleV1;
    const preparedRef = "appraisal:prepared-appraisal-evidence" as CanonicalRefV0;
    const authoritySame: LearningSourceReadAuthority = {
      readCommittedBundle: async (id) =>
        (world.core as RealEngineCoreAdapter).storeRead.readCommittedByTransitionId(id),
      readPreparedDomainResultRefs: async (id) =>
        id === bundleA.transition_id ? [preparedRef] : null
    };
    const evidenced = await validateTrustedLearningExperience(
      authoritySame,
      world.ctx as RuntimeContext,
      candidateFor(bundleA, { appraisal_ref: preparedRef })
    );
    expect(evidenced.ok).toBe(true);
    // A prepared record of ANOTHER transition never extends authority (§19).
    const authorityOther: LearningSourceReadAuthority = {
      readCommittedBundle: async (id) =>
        (world.core as RealEngineCoreAdapter).storeRead.readCommittedByTransitionId(id),
      readPreparedDomainResultRefs: async (id) =>
        id === (world.bundleB as AtomicCommitBundleV1).transition_id ? [preparedRef] : null
    };
    const unsupported = await validateTrustedLearningExperience(
      authorityOther,
      world.ctx as RuntimeContext,
      candidateFor(bundleA, { appraisal_ref: preparedRef })
    );
    expect(unsupported.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------------
// Forgeability regression (§2–§5 of the final trust check): a TypeScript shape
// is NOT a trust capability. Trust is a runtime authority marker attached only
// by validateTrustedLearningExperience; plain/JSON/cloned objects with identical
// visible fields are rejected by the trusted boundary.
// ---------------------------------------------------------------------------------

describe("P2.3.5.3a trusted-representation forgeability regression", () => {
  it("authority-validated output carries runtime trust; plain identical objects do not", async () => {
    const bundleA = world.bundleA as AtomicCommitBundleV1;
    const checked = await validateTrustedLearningExperience(
      readAuthority(),
      world.ctx as RuntimeContext,
      candidateFor(bundleA)
    );
    expect(checked.ok).toBe(true);
    if (!checked.ok) return;
    expect(isTrustedLearningExperience(checked.value)).toBe(true);

    // A caller-fabricated plain object with the exact same visible fields is NOT trusted.
    const forged = JSON.parse(JSON.stringify(checked.value)) as Record<string, unknown>;
    expect(isTrustedLearningExperience(forged)).toBe(false);

    // structuredClone (deep copy) of a genuine trusted object loses trust.
    const cloned = structuredClone(checked.value);
    expect(isTrustedLearningExperience(cloned)).toBe(false);

    // Reconstructed-from-JSON object is not trusted either.
    const fromJson = JSON.parse(JSON.stringify(checked.value));
    expect(isTrustedLearningExperience(fromJson)).toBe(false);

    // Non-objects / null are never trusted.
    expect(isTrustedLearningExperience(null)).toBe(false);
    expect(isTrustedLearningExperience("trusted")).toBe(false);
    expect(isTrustedLearningExperience(42)).toBe(false);
  });

  it("the authority marker is invisible to canonical bytes and enumeration (determinism preserved)", async () => {
    const bundleA = world.bundleA as AtomicCommitBundleV1;
    const checked = await validateTrustedLearningExperience(
      readAuthority(),
      world.ctx as RuntimeContext,
      candidateFor(bundleA)
    );
    expect(checked.ok).toBe(true);
    if (!checked.ok) return;
    const trusted = checked.value;
    // Exactly the 11 frozen candidate fields are enumerable — nothing else.
    expect(Object.keys(trusted).sort()).toEqual([
      "appraisal_ref",
      "declared_salience",
      "entity_refs",
      "environment_refs",
      "event_refs",
      "focus_refs",
      "observation_ref",
      "occurrence_logical_time",
      "scene",
      "source_transition_id",
      "subject_id"
    ]);
    // JSON serialization is byte-identical to a plain clone (marker invisible).
    const plain = JSON.parse(JSON.stringify(trusted)) as Record<string, unknown>;
    expect(JSON.stringify(trusted)).toBe(JSON.stringify(plain));
  });

  it("future trusted-consumer boundary rejects forged input (supported runtime path)", async () => {
    const bundleA = world.bundleA as AtomicCommitBundleV1;
    // The exact gate a future trusted consumer (e.g. ExperienceEncoderV0) applies.
    function requireTrusted(value: unknown): TrustedLearningExperienceV0 {
      if (!isTrustedLearningExperience(value)) {
        throw new Error("trusted boundary: value did not pass durable source-authority validation");
      }
      return value;
    }

    const checked = await validateTrustedLearningExperience(
      readAuthority(),
      world.ctx as RuntimeContext,
      candidateFor(bundleA)
    );
    expect(checked.ok).toBe(true);
    if (!checked.ok) return;
    // Genuine authority output passes the boundary.
    expect(() => requireTrusted(checked.value)).not.toThrow();

    // Caller-created plain data with identical fields CANNOT skip validation.
    const forged = JSON.parse(JSON.stringify(checked.value));
    expect(() => requireTrusted(forged)).toThrow(/trusted boundary/);

    // No public entrypoint constructs trusted objects from arbitrary data:
    // the only exported producers are the read-only candidate validator and the
    // authority validator itself (both verified above to fail closed).
  });
});
