/**
 * CANONICAL_AFFECT_APPLICATION_V0 — implementation matrix.
 *
 * Proves the end-to-end law on an EXPLICIT v4 subject:
 *   admitted factual event → canonical INITIAL Appraisal → CANONICAL_PENDING
 *   → exactly one AffectApplication → durable CanonicalAffectV0 successor
 *   → trusted V2 receipt → restore/retry +0.
 *
 * Covered: exact frozen impulse law (additive/clamped/zero/saturation),
 * domain isolation, journal-derived eligibility + receipt recognition,
 * ordering gate (admission sequence; abstained passes, pending blocks,
 * applied resolves), stale rebuild on the newest Affect, same-event
 * concurrency, crash-before-commit, authoritative restore retry, history
 * validator fail-closed matrix and v3 rejection. Real model calls 0.
 */

import { describe, expect, it } from "vitest";

import {
  canonicalJsonString,
  createInMemorySubjectCoreFacadeForExplicitV4V0,
  createInMemorySubjectCoreFacade,
  materializeSubjectStateV4V0,
  proposalFingerprint,
  validateSubjectState,
  type AtomicCommitBundleAnyVersion,
  type InMemoryFacadeAssembly,
  type ProducerAuthorizationIssuer,
  type SubjectStateV0,
  type SubjectStateV4,
  type V4PersistenceEnvelopeV0
} from "@characteros-next/subject-core";
import { computeRepositoryRevisionHash, InMemoryMemoryRepository } from "@characteros-next/memory";
import { applyAffectImpulseV0, deriveAffectImpulseV0 } from "@characteros-next/affect";
import { observationInput, observationCauseRefOf, s0 } from "../observation/observation-fixtures.js";
import { buildContextDelta } from "../../ports/context-producer-port.js";
import { buildObservationProposal } from "../observation/observation-transition-executor.js";
import { createConversationIngressLedgerAuthorityV0 } from "../conversation/conversation-ingress-ledger.js";
import { InMemoryConversationFactualEventAuthorityV0 } from "../../authority/conversation-factual-event-authority-v0.js";
import { InMemoryAffectEventAuthorityV0 } from "../../authority/affect-event-authority-v0.js";
import { FactualEventAppraisalExecutorV0 } from "../../factual-event-appraisal/factual-event-appraisal-executor.js";
import { BoundedAffectTimeProducerV0 } from "../../producers/bounded-affect-time-producer-v0.js";
import { ReferenceRegulationV0Producer } from "../../producers/reference-regulation-v0-producer.js";
import { buildV4TimeProposal } from "../time/canonical-affect-v4-time-transition-executor-v0.js";
import {
  createCanonicalAffectApplicationV0ForExplicitV4,
  type CanonicalAffectApplicationExecutorDepsV0
} from "./affect-application-executor-v0.js";
import { validateAffectApplicationReceiptV0 } from "../../authority/affect-application-history-validator-v0.js";
import { mintTrustedCanonicalHistoryBoundaryV4V0, type TrustedCanonicalHeadInputV0 } from "../../authority/trusted-canonical-history-boundary.js";
import { createSubjectStateV4AuthoritativeRestoreEnvelopeV0, restoreSubjectStateV4AuthoritativelyV0 } from "../../authority/restore-chain-authority-v4.js";

const SUBJECT = "subject-s0";
const ALICE = "entity:alice";
const TASK = "revise the update";

interface DimensionOverride {
  readonly relevance: number;
  readonly goal_congruence: number;
  readonly intensity: number;
}

interface World {
  readonly repo: InMemoryMemoryRepository;
  readonly assembly: InMemoryFacadeAssembly<SubjectStateV4>;
  readonly issuer: ProducerAuthorizationIssuer;
  readonly ingressLedger: ReturnType<typeof createConversationIngressLedgerAuthorityV0>;
  readonly factualEventAuthority: InMemoryConversationFactualEventAuthorityV0;
  readonly appraisalExecutor: FactualEventAppraisalExecutorV0;
  readonly writer: ReturnType<typeof createCanonicalAffectApplicationV0ForExplicitV4>;
  readonly trustedHistory: { readCommittedBundlesForSubject(subjectId: string): Promise<readonly AtomicCommitBundleAnyVersion[]> };
  readonly dimensionOverrides: Map<string, Partial<DimensionOverride>>;
  readonly abstainFor: Set<string>;
  readonly genesis: { readonly state: SubjectStateV4; readonly envelope: V4PersistenceEnvelopeV0 };
}

function v3Seed(): SubjectStateV0 {
  const raw = {
    ...s0(),
    context: { ...(s0() as unknown as { context: Record<string, unknown> }).context, task: TASK },
    regulation: { energy: 1, stress: 0, arousal: 0.5, fatigue: 0, last_update: null }
  } as unknown as SubjectStateV0;
  const checked = validateSubjectState(raw);
  if (!checked.ok) throw new Error(`seed invariant: ${checked.error.detail}`);
  return checked.value;
}

async function currentBindings(repo: InMemoryMemoryRepository, snapshot: SubjectStateV4) {
  const revision = snapshot.memory_state.repository_revision as never;
  const manifest = await repo.readManifest(revision);
  if (manifest === null) throw new Error("manifest must exist");
  return [{
    repository_revision: revision,
    repository_revision_hash: await computeRepositoryRevisionHash(manifest)
  }];
}

async function buildWorld(): Promise<World> {
  const repo = new InMemoryMemoryRepository();
  await repo.prepareRevision({ parent_revision: null as never, records: [] });
  const r0Manifest = await repo.readManifest("R0" as never);
  if (r0Manifest === null) throw new Error("R0 must exist");
  const r0Binding = {
    repository_revision: "R0" as never,
    repository_revision_hash: await computeRepositoryRevisionHash(r0Manifest)
  };

  const genesisResult = await materializeSubjectStateV4V0({
    mode: "EXPLICIT_V4_FOUNDATION_V0" as never,
    seed: {
      schema_version: "subject-state-v4-genesis-seed-v0",
      subject: { subject_id: SUBJECT, display_name: "", identity_anchors: [] },
      v3_source: v3Seed(),
      r0_binding: r0Binding
    },
    r0_binding: r0Binding,
    reference_validator: async (binding) => canonicalJsonString(binding) === canonicalJsonString(r0Binding)
  });
  if (!genesisResult.ok) throw new Error(`${genesisResult.code}: ${genesisResult.detail}`);

  const assembly = createInMemorySubjectCoreFacadeForExplicitV4V0({
    seedSnapshots: new Map([[SUBJECT as never, genesisResult.state as never]]),
    seedBundles: [],
    referenceValidator: async (binding) => repo.validateRevisionBinding(binding as never),
    preparedResultValidator: async () => true,
    memoryAdoptionValidator: async () => true
  });
  const issuer = assembly.producerAuthorizationIssuer;
  const ingressLedger = createConversationIngressLedgerAuthorityV0();
  let worldRef: World | null = null;
  const trustedHistory = {
    readCommittedBundlesForSubject: async (subjectId: string) =>
      assembly.storeRead.getCommittedBundles().filter((b) => b.subject_id === subjectId) as unknown as readonly AtomicCommitBundleAnyVersion[]
  };
  const factualEventAuthority = new InMemoryConversationFactualEventAuthorityV0(
    ingressLedger,
    { readCommittedBundle: async (id) => assembly.storeRead.readCommittedByTransitionId(id) as unknown as AtomicCommitBundleAnyVersion | null },
    {} as never,
    {} as never
  );
  const learningSourceAuthority = {
    readCommittedBundle: async (id: string) => assembly.storeRead.readCommittedByTransitionId(id) as unknown as AtomicCommitBundleAnyVersion | null
  };
  const appraisalExecutor = new FactualEventAppraisalExecutorV0({
    subjectCore: assembly.facade,
    producerAuthorizationIssuer: issuer,
    experienceAppraisalStore: repo,
    learningAdoptionAuthority: {
      markAdopted: (r: never) => void repo.markAdopted(r),
      isAdopted: (r: never) => repo.isAdopted(r)
    },
    learningSourceAuthority,
    factualEventAuthority,
    factualEventAppraisalProvider: {
      proposeFactualEventAppraisal: async (context: never) => {
        const ctx = context as unknown as { subject_id: string; factual_event_ref: string; context_projection_hash: string };
        if (worldRef?.abstainFor.has(ctx.factual_event_ref)) {
          return {
            schema_version: "factual-event-appraisal-proposal-v0",
            status: "INSUFFICIENT_CONTEXT",
            subject_id: ctx.subject_id,
            factual_event_ref: ctx.factual_event_ref,
            context_projection_hash: ctx.context_projection_hash,
            missing_inputs: ["CURRENT_TASK"]
          };
        }
        const override = worldRef?.dimensionOverrides.get(ctx.factual_event_ref) ?? {};
        const dimensions = {
          relevance: override.relevance ?? 0.8,
          goal_congruence: override.goal_congruence ?? 0.3,
          attribution: "other" as const,
          controllability: 0.4,
          uncertainty: 0.5,
          intensity: override.intensity ?? 0.6
        };
        return {
          schema_version: "factual-event-appraisal-proposal-v0",
          status: "APPRAISED",
          subject_id: ctx.subject_id,
          factual_event_ref: ctx.factual_event_ref,
          context_projection_hash: ctx.context_projection_hash,
          dimensions,
          assessment_confidence: 0.7,
          evidence_refs: [ctx.factual_event_ref].sort()
        };
      }
    }
  } as never);

  const deps: CanonicalAffectApplicationExecutorDepsV0 = {
    subjectCore: assembly.facade,
    producerAuthorizationIssuer: issuer,
    repository: repo,
    factualEventAuthority,
    learningSourceAuthority,
    affectAuthority: new InMemoryAffectEventAuthorityV0(trustedHistory),
    trustedHistory
  };
  const writer = createCanonicalAffectApplicationV0ForExplicitV4(deps);

  const world: World = {
    repo,
    assembly,
    issuer: issuer as never,
    ingressLedger,
    factualEventAuthority,
    appraisalExecutor,
    writer,
    trustedHistory,
    dimensionOverrides: new Map(),
    abstainFor: new Set(),
    genesis: { state: genesisResult.state, envelope: genesisResult.envelope }
  };
  worldRef = world;
  return world;
}

async function readSnapshot(world: World): Promise<SubjectStateV4> {
  const snapshot = await world.assembly.facade.readCurrentSnapshot(SUBJECT as never);
  if (snapshot === null) throw new Error("snapshot must exist");
  return snapshot as SubjectStateV4;
}

function ctxOf(snapshot: SubjectStateV4) {
  return {
    subject_id: SUBJECT as never,
    current_logical_time: snapshot.runtime_metadata.logical_time as never,
    state_revision: snapshot.runtime_metadata.state_revision as never
  };
}

/** Ingress + committed v4 Observation (context-only; no legacy affect). */
async function admitEvent(world: World, sourceEventId: string, text: string): Promise<{
  eventRef: string;
  observationTransitionId: string;
  observationRef: string;
}> {
  const outcome = await world.ingressLedger.recordIngressEvent({
    schema_version: "conversation-ingress-input-v0",
    subject_id: SUBJECT,
    conversation_id: "conv-v4-affect",
    actor_ref: ALICE,
    text,
    logical_time: 0,
    source_event_id: sourceEventId,
    in_reply_to_delivery_id: null,
    host_adapter: "test-adapter"
  });
  if (outcome.kind !== "RECORDED" && outcome.kind !== "REPLAY") throw new Error(`ingress must record: ${outcome.kind}`);
  if (outcome.kind === "REPLAY") throw new Error("fixture invariant: replayed admission");
  const eventRef = outcome.record.event_ref as string;
  const snapshot = await readSnapshot(world);
  const observation = observationInput({
    observation_id: `observation:o-${sourceEventId}`,
    source_refs: [eventRef, "source:s-3"],
    entity_refs: [ALICE, "subject:s0"],
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
  if (reserved.kind !== "CONTINUE") throw new Error(`observation reservation: ${reserved.kind}`);
  const commitOutcome = await world.assembly.facade.commitReserved({
    proposal,
    continuation: reserved.continuation,
    producerAuthorization: world.issuer.issue([{ producer: "context", domain: "context" }]) as never,
    preparedBinding: {
      prepared_result_ref: `workflow:w-v4obs-${sourceEventId}` as never,
      transition_id: proposal.transition_id,
      subject_id: proposal.subject_id,
      transition_type: proposal.transition_type,
      payload_fingerprint: await proposalFingerprint(proposal)
    },
    repository_bindings: await currentBindings(world.repo, snapshot) as never
  });
  if (commitOutcome.kind !== "COMMITTED") throw new Error(`observation must commit: ${JSON.stringify(commitOutcome).slice(0, 160)}`);
  return {
    eventRef,
    observationTransitionId: commitOutcome.bundle.transition_id as string,
    observationRef: observationCauseRefOf(commitOutcome.bundle as never)
  };
}

/** Appraise an already-admitted event; returns true when a canonical INITIAL committed. */
async function appraiseAdmitted(world: World, sourceEventId: string, admission: { observationTransitionId: string; observationRef: string }): Promise<boolean> {
  const outcome = await world.appraisalExecutor.appraiseIncomingEvent(ctxOf(await readSnapshot(world)), {
    subject_id: SUBJECT as never,
    source_event_id: sourceEventId,
    observation_transition_id: admission.observationTransitionId as never,
    observation_ref: admission.observationRef as never
  });
  return outcome.kind === "COMMITTED";
}

/** Admit + canonical INITIAL Appraisal for one event. */
async function admitAndAppraise(world: World, sourceEventId: string, text: string): Promise<string> {
  const { eventRef, observationTransitionId, observationRef } = await admitEvent(world, sourceEventId, text);
  const committed = await appraiseAdmitted(world, sourceEventId, { observationTransitionId, observationRef });
  if (!committed) throw new Error("appraisal must commit");
  return eventRef;
}

async function executeV4Time(world: World, ticks: number): Promise<AtomicCommitBundleAnyVersion> {
  const snapshot = await readSnapshot(world);
  const affectDelta = await new BoundedAffectTimeProducerV0().produceCanonicalAffectTimeDelta({
    current_affect: snapshot.affect,
    elapsed_ticks: ticks
  });
  const regulationDelta = await new ReferenceRegulationV0Producer().produceRegulationDelta({
    context: ctxOf(snapshot),
    regulation: snapshot.regulation,
    elapsed_ticks: ticks
  });
  const proposal = buildV4TimeProposal(SUBJECT, snapshot.runtime_metadata.state_revision as number, ticks, affectDelta, regulationDelta);
  const reserved = await world.assembly.facade.reserveAndRoute(proposal);
  if (reserved.kind !== "CONTINUE") throw new Error(`time reservation: ${reserved.kind}`);
  const outcome = await world.assembly.facade.commitReserved({
    proposal,
    continuation: reserved.continuation,
    producerAuthorization: world.issuer.issue([
      { producer: "affect", domain: "affect" },
      { producer: "regulation", domain: "regulation" }
    ]) as never,
    preparedBinding: {
      prepared_result_ref: `workflow:v4-r${snapshot.runtime_metadata.state_revision}-e${ticks}` as never,
      transition_id: proposal.transition_id,
      subject_id: proposal.subject_id,
      transition_type: proposal.transition_type,
      payload_fingerprint: await proposalFingerprint(proposal)
    },
    repository_bindings: await currentBindings(world.repo, snapshot) as never
  });
  if (outcome.kind !== "COMMITTED") throw new Error(`time must commit: ${outcome.kind}`);
  return outcome.bundle as unknown as AtomicCommitBundleAnyVersion;
}

function affectApplicationBundles(world: World): readonly AtomicCommitBundleAnyVersion[] {
  return world.assembly.storeRead.getCommittedBundles().filter((b) => b.transition_type === "AffectApplication") as unknown as readonly AtomicCommitBundleAnyVersion[];
}

// ----------------------------------------------------------------------------------
// Basic application + exact dynamics (§66)
// ----------------------------------------------------------------------------------

describe("CANONICAL_AFFECT_APPLICATION_V0 — basic application (§66)", () => {
  it("1/5/8-12. commits exactly one atomic /affect application; only affect changes; V2 receipt", async () => {
    const world = await buildWorld();
    const eventRef = await admitAndAppraise(world, "evt-x", "重做一下。");
    const before = await readSnapshot(world);
    const outcome = await world.writer.applyForEvent(ctxOf(before), { factual_event_ref: eventRef });
    expect(outcome.kind).toBe("COMMITTED");
    if (outcome.kind !== "COMMITTED") return;
    const bundle = outcome.bundle;
    expect(bundle.transition_type).toBe("AffectApplication");
    expect(bundle.commit_version).toBe("atomic-commit-v2");
    const after = await readSnapshot(world);
    expect(after.runtime_metadata.state_revision).toBe(before.runtime_metadata.state_revision + 1);
    expect(after.runtime_metadata.logical_time).toBe(before.runtime_metadata.logical_time);
    // Exact frozen impulse law, additive from the current Affect.
    const impulse = deriveAffectImpulseV0({ relevance: 0.8 as never, goal_congruence: 0.3 as never, intensity: 0.6 as never });
    expect(impulse.q).toBeCloseTo(0.8 * 0.6, 15);
    expect(impulse.u_v).toBe(0.25 * impulse.q * (2 * 0.3 - 1));
    expect(impulse.u_a).toBe(0.1 * impulse.q);
    const expectedAffect = applyAffectImpulseV0(before.affect, impulse);
    expect(canonicalJsonString(after.affect)).toBe(canonicalJsonString(expectedAffect));
    const beforeAny = before as unknown as Record<string, unknown>;
    const afterAny = after as unknown as Record<string, unknown>;
    for (const field of Object.keys(beforeAny)) {
      if (field === "affect" || field === "runtime_metadata" || field === "trace_window") continue;
      expect(canonicalJsonString(afterAny[field])).toBe(canonicalJsonString(beforeAny[field]));
    }
    expect(affectApplicationBundles(world)).toHaveLength(1);
  });

  it("6/7. clamped impulses stay within bounds", async () => {
    const world = await buildWorld();
    // Four maximal positive events drive valence to exactly 1.0 (0.25 each).
    for (let i = 0; i < 4; i++) {
      const admission = await admitEvent(world, `evt-${i}`, "重做一下。");
      world.dimensionOverrides.set(admission.eventRef, { relevance: 1, goal_congruence: 1, intensity: 1 });
      expect(await appraiseAdmitted(world, `evt-${i}`, admission)).toBe(true);
      const outcome = await world.writer.applyForEvent(ctxOf(await readSnapshot(world)), { factual_event_ref: admission.eventRef });
      expect(outcome.kind).toBe("COMMITTED");
    }
    const after = await readSnapshot(world);
    expect(after.affect.valence).toBe(1);
    expect(after.affect.activation).toBeCloseTo(0.2 + 4 * 0.1, 15);
  });
});

// ----------------------------------------------------------------------------------
// Zero impulse + saturation identity receipts (§67)
// ----------------------------------------------------------------------------------

describe("CANONICAL_AFFECT_APPLICATION_V0 — zero impulse and saturation (§67)", () => {
  it("13-15. zero impulse commits an identity-valued receipt; retry +0", async () => {
    const world = await buildWorld();
    const admission = await admitEvent(world, "evt-x", "重做一下。");
    world.dimensionOverrides.set(admission.eventRef, { relevance: 0 });
    expect(await appraiseAdmitted(world, "evt-x", admission)).toBe(true);
    const eventRef = admission.eventRef;
    const before = await readSnapshot(world);
    const outcome = await world.writer.applyForEvent(ctxOf(before), { factual_event_ref: eventRef });
    expect(outcome.kind).toBe("COMMITTED");
    if (outcome.kind !== "COMMITTED") return;
    expect(canonicalJsonString(outcome.bundle.next_snapshot.affect)).toBe(canonicalJsonString(before.affect));
    expect(affectApplicationBundles(world)).toHaveLength(1);
    const commitsBefore = world.assembly.storeRead.getCommittedBundles().length;
    const replay = await world.writer.applyForEvent(ctxOf(await readSnapshot(world)), { factual_event_ref: eventRef });
    expect(replay.kind).toBe("ALREADY_APPLIED");
    if (replay.kind === "ALREADY_APPLIED") expect(replay.via).toBe("CANONICAL");
    expect(world.assembly.storeRead.getCommittedBundles().length).toBe(commitsBefore);
  });

  it("16-18. saturation clamps to an identity commit and is recognized as applied", async () => {
    const world = await buildWorld();
    for (let i = 0; i < 4; i++) {
      const admission = await admitEvent(world, `evt-${i}`, "重做一下。");
      world.dimensionOverrides.set(admission.eventRef, { relevance: 1, goal_congruence: 1, intensity: 1 });
      expect(await appraiseAdmitted(world, `evt-${i}`, admission)).toBe(true);
      const outcome = await world.writer.applyForEvent(ctxOf(await readSnapshot(world)), { factual_event_ref: admission.eventRef });
      expect(outcome.kind).toBe("COMMITTED");
    }
    const satAdmission = await admitEvent(world, "evt-sat", "重做一下。");
    world.dimensionOverrides.set(satAdmission.eventRef, { relevance: 1, goal_congruence: 1, intensity: 1 });
    expect(await appraiseAdmitted(world, "evt-sat", satAdmission)).toBe(true);
    const eventRef = satAdmission.eventRef;
    const before = await readSnapshot(world);
    const outcome = await world.writer.applyForEvent(ctxOf(before), { factual_event_ref: eventRef });
    expect(outcome.kind).toBe("COMMITTED");
    if (outcome.kind !== "COMMITTED") return;
    const appliedAffect = (outcome.bundle.next_snapshot as unknown as SubjectStateV4).affect;
    expect(appliedAffect.valence).toBe(before.affect.valence);
    expect(appliedAffect.valence).toBe(1);
    const replay = await world.writer.applyForEvent(ctxOf(await readSnapshot(world)), { factual_event_ref: eventRef });
    expect(replay).toMatchObject({ kind: "ALREADY_APPLIED", via: "CANONICAL" });
  });
});

// ----------------------------------------------------------------------------------
// Eligibility + disposition gate (§55/§56/§68)
// ----------------------------------------------------------------------------------

describe("CANONICAL_AFFECT_APPLICATION_V0 — eligibility and disposition gate (§68)", () => {
  it("19. durably abstained target → NOT_ELIGIBLE with zero commits", async () => {
    const world = await buildWorld();
    const admission = await admitEvent(world, "evt-x", "重做一下。");
    world.abstainFor.add(admission.eventRef);
    const xAppraisal = await world.appraisalExecutor.appraiseIncomingEvent(ctxOf(await readSnapshot(world)), {
      subject_id: SUBJECT as never,
      source_event_id: "evt-x",
      observation_transition_id: admission.observationTransitionId as never,
      observation_ref: admission.observationRef as never
    });
    expect(xAppraisal.kind).toBe("INSUFFICIENT_CONTEXT");
    const before = await readSnapshot(world);
    const outcome = await world.writer.applyForEvent(ctxOf(before), { factual_event_ref: admission.eventRef });
    expect(outcome.kind).toBe("NOT_ELIGIBLE");
    expect(affectApplicationBundles(world)).toHaveLength(0);
    expect((await readSnapshot(world)).runtime_metadata.state_revision).toBe(before.runtime_metadata.state_revision);
  });

  it("20. pending target → TARGET_NOT_READY with zero dynamics/commit", async () => {
    const world = await buildWorld();
    const { eventRef } = await admitEvent(world, "evt-x", "重做一下。");
    const before = await readSnapshot(world);
    const outcome = await world.writer.applyForEvent(ctxOf(before), { factual_event_ref: eventRef });
    expect(outcome.kind).toBe("TARGET_NOT_READY");
    expect(affectApplicationBundles(world)).toHaveLength(0);
    const after = await readSnapshot(world);
    expect(after.runtime_metadata.state_revision).toBe(before.runtime_metadata.state_revision);
  });

  it("22. canonical applied → ALREADY_APPLIED/CANONICAL with zero commits", async () => {
    const world = await buildWorld();
    const eventRef = await admitAndAppraise(world, "evt-x", "重做一下。");
    const first = await world.writer.applyForEvent(ctxOf(await readSnapshot(world)), { factual_event_ref: eventRef });
    expect(first.kind).toBe("COMMITTED");
    const commitsBefore = world.assembly.storeRead.getCommittedBundles().length;
    const replay = await world.writer.applyForEvent(ctxOf(await readSnapshot(world)), { factual_event_ref: eventRef });
    expect(replay).toMatchObject({ kind: "ALREADY_APPLIED", via: "CANONICAL" });
    expect(world.assembly.storeRead.getCommittedBundles().length).toBe(commitsBefore);
  });
});

// ----------------------------------------------------------------------------------
// Ordering gate (§49-§53/§73)
// ----------------------------------------------------------------------------------

describe("CANONICAL_AFFECT_APPLICATION_V0 — ordering gate (§73)", () => {
  it("55-57. Y invoked before earlier unresolved X blocks; X applies; Y retry succeeds", async () => {
    const world = await buildWorld();
    const xRef = await admitAndAppraise(world, "evt-x", "重做一下。");
    const yRef = await admitAndAppraise(world, "evt-y", "还是不对。");
    const yFirst = await world.writer.applyForEvent(ctxOf(await readSnapshot(world)), { factual_event_ref: yRef });
    expect(yFirst.kind).toBe("PRIOR_AFFECT_WORK_PENDING");
    expect(affectApplicationBundles(world)).toHaveLength(0);
    const xOutcome = await world.writer.applyForEvent(ctxOf(await readSnapshot(world)), { factual_event_ref: xRef });
    expect(xOutcome.kind).toBe("COMMITTED");
    const yRetry = await world.writer.applyForEvent(ctxOf(await readSnapshot(world)), { factual_event_ref: yRef });
    expect(yRetry.kind).toBe("COMMITTED");
  });

  it("58. earlier durably ABSTAINED event does not block", async () => {
    const world = await buildWorld();
    const xAdmission = await admitEvent(world, "evt-x", "重做一下。");
    world.abstainFor.add(xAdmission.eventRef);
    const xAppraisal = await world.appraisalExecutor.appraiseIncomingEvent(ctxOf(await readSnapshot(world)), {
      subject_id: SUBJECT as never,
      source_event_id: "evt-x",
      observation_transition_id: xAdmission.observationTransitionId as never,
      observation_ref: xAdmission.observationRef as never
    });
    expect(xAppraisal.kind).toBe("INSUFFICIENT_CONTEXT");
    const yRef = await admitAndAppraise(world, "evt-y", "还是不对。");
    const yOutcome = await world.writer.applyForEvent(ctxOf(await readSnapshot(world)), { factual_event_ref: yRef });
    expect(yOutcome.kind).toBe("COMMITTED");
  });

  it("59. earlier PENDING event blocks", async () => {
    const world = await buildWorld();
    await admitEvent(world, "evt-x", "重做一下。");
    const yRef = await admitAndAppraise(world, "evt-y", "还是不对。");
    const yOutcome = await world.writer.applyForEvent(ctxOf(await readSnapshot(world)), { factual_event_ref: yRef });
    expect(yOutcome.kind).toBe("PRIOR_AFFECT_WORK_PENDING");
  });

  it("61. earlier CANONICAL_APPLIED event resolves", async () => {
    const world = await buildWorld();
    const xRef = await admitAndAppraise(world, "evt-x", "重做一下。");
    const xOutcome = await world.writer.applyForEvent(ctxOf(await readSnapshot(world)), { factual_event_ref: xRef });
    expect(xOutcome.kind).toBe("COMMITTED");
    const yRef = await admitAndAppraise(world, "evt-y", "还是不对。");
    const yOutcome = await world.writer.applyForEvent(ctxOf(await readSnapshot(world)), { factual_event_ref: yRef });
    expect(yOutcome.kind).toBe("COMMITTED");
  });
});

// ----------------------------------------------------------------------------------
// Stale / crash / concurrency (§70-§72)
// ----------------------------------------------------------------------------------

describe("CANONICAL_AFFECT_APPLICATION_V0 — stale, crash, concurrency (§70-§72)", () => {
  it("41-44. unrelated Time winner causes stale; rebuild uses the newest recovered Affect", async () => {
    const world = await buildWorld();
    const eventRef = await admitAndAppraise(world, "evt-x", "重做一下。");
    const originalCommit = world.assembly.facade.commitReserved.bind(world.assembly.facade);
    let advanced = false;
    const wrappedFacade = Object.create(world.assembly.facade) as InMemoryFacadeAssembly<SubjectStateV4>["facade"];
    wrappedFacade.commitReserved = async (input: never) => {
      if (!advanced) {
        advanced = true;
        await executeV4Time(world, 10);
      }
      return originalCommit(input);
    };
    const staleWriter = createCanonicalAffectApplicationV0ForExplicitV4({
      subjectCore: wrappedFacade,
      producerAuthorizationIssuer: world.issuer as never,
      repository: world.repo,
      factualEventAuthority: world.factualEventAuthority,
      learningSourceAuthority: { readCommittedBundle: async (id) => world.assembly.storeRead.readCommittedByTransitionId(id) as unknown as AtomicCommitBundleAnyVersion | null },
      affectAuthority: new InMemoryAffectEventAuthorityV0(world.trustedHistory),
      trustedHistory: world.trustedHistory
    });
    const outcome = await staleWriter.applyForEvent(ctxOf(await readSnapshot(world)), { factual_event_ref: eventRef });
    expect(outcome.kind).toBe("COMMITTED");
    if (outcome.kind !== "COMMITTED") return;
    const bundles = affectApplicationBundles(world);
    expect(bundles).toHaveLength(1);
    const receipt = bundles[0] as AtomicCommitBundleAnyVersion;
    const validated = await validateAffectApplicationReceiptV0({
      bundle: receipt,
      bundles: world.assembly.storeRead.getCommittedBundles().filter((b) => b.subject_id === SUBJECT) as unknown as readonly AtomicCommitBundleAnyVersion[],
      subject_id: SUBJECT,
      repository: world.repo,
      repository_revision: (await readSnapshot(world)).memory_state.repository_revision as never
    });
    expect(validated.ok).toBe(true);
  });

  it("47. second stale → REBASE_REQUIRED with no receipt", async () => {
    const world = await buildWorld();
    const eventRef = await admitAndAppraise(world, "evt-x", "重做一下。");
    const originalCommit = world.assembly.facade.commitReserved.bind(world.assembly.facade);
    let advances = 0;
    const wrappedFacade = Object.create(world.assembly.facade) as InMemoryFacadeAssembly<SubjectStateV4>["facade"];
    wrappedFacade.commitReserved = async (input: never) => {
      if (advances < 2) {
        advances += 1;
        await executeV4Time(world, 3);
      }
      return originalCommit(input);
    };
    const staleWriter = createCanonicalAffectApplicationV0ForExplicitV4({
      subjectCore: wrappedFacade,
      producerAuthorizationIssuer: world.issuer as never,
      repository: world.repo,
      factualEventAuthority: world.factualEventAuthority,
      learningSourceAuthority: { readCommittedBundle: async (id) => world.assembly.storeRead.readCommittedByTransitionId(id) as unknown as AtomicCommitBundleAnyVersion | null },
      affectAuthority: new InMemoryAffectEventAuthorityV0(world.trustedHistory),
      trustedHistory: world.trustedHistory
    });
    const outcome = await staleWriter.applyForEvent(ctxOf(await readSnapshot(world)), { factual_event_ref: eventRef });
    expect(outcome.kind).toBe("REBASE_REQUIRED");
    expect(affectApplicationBundles(world)).toHaveLength(0);
  });

  it("35-36. crash before CAS leaves state unchanged and eligibility pending", async () => {
    const world = await buildWorld();
    const eventRef = await admitAndAppraise(world, "evt-x", "重做一下。");
    const wrappedFacade = Object.create(world.assembly.facade) as InMemoryFacadeAssembly<SubjectStateV4>["facade"];
    wrappedFacade.commitReserved = async () => {
      throw new Error("crash before CAS");
    };
    const crashingWriter = createCanonicalAffectApplicationV0ForExplicitV4({
      subjectCore: wrappedFacade,
      producerAuthorizationIssuer: world.issuer as never,
      repository: world.repo,
      factualEventAuthority: world.factualEventAuthority,
      learningSourceAuthority: { readCommittedBundle: async (id) => world.assembly.storeRead.readCommittedByTransitionId(id) as unknown as AtomicCommitBundleAnyVersion | null },
      affectAuthority: new InMemoryAffectEventAuthorityV0(world.trustedHistory),
      trustedHistory: world.trustedHistory
    });
    await expect(
      crashingWriter.applyForEvent(ctxOf(await readSnapshot(world)), { factual_event_ref: eventRef })
    ).rejects.toThrow(/crash before CAS/);
    expect(affectApplicationBundles(world)).toHaveLength(0);
    const outcome = await world.writer.applyForEvent(ctxOf(await readSnapshot(world)), { factual_event_ref: eventRef });
    expect(outcome.kind).toBe("COMMITTED");
    expect(affectApplicationBundles(world)).toHaveLength(1);
  });

  it("49-53. same-event concurrency yields exactly one receipt; follow-up retry +0", async () => {
    const world = await buildWorld();
    const eventRef = await admitAndAppraise(world, "evt-x", "重做一下。");
    const ctx = ctxOf(await readSnapshot(world));
    const [a, b] = await Promise.all([
      world.writer.applyForEvent(ctx, { factual_event_ref: eventRef }),
      world.writer.applyForEvent(ctx, { factual_event_ref: eventRef })
    ]);
    const kinds = [a.kind, b.kind];
    expect(kinds).toContain("COMMITTED");
    expect(affectApplicationBundles(world)).toHaveLength(1);
    for (const kind of kinds) {
      expect(["COMMITTED", "ALREADY_APPLIED", "REBASE_REQUIRED"]).toContain(kind);
    }
    const retry = await world.writer.applyForEvent(ctxOf(await readSnapshot(world)), { factual_event_ref: eventRef });
    expect(retry).toMatchObject({ kind: "ALREADY_APPLIED", via: "CANONICAL" });
  });
});

// ----------------------------------------------------------------------------------
// Restore (§69.30-34) + history validator (§75) + v3 rejection (§77.97)
// ----------------------------------------------------------------------------------

describe("CANONICAL_AFFECT_APPLICATION_V0 — restore, history validator, v3 (§69/§75/§77)", () => {
  it("30-34. fresh authoritative v4 restore recognizes the receipt; retry +0", async () => {
    const world = await buildWorld();
    const eventRef = await admitAndAppraise(world, "evt-x", "重做一下。");
    const first = await world.writer.applyForEvent(ctxOf(await readSnapshot(world)), { factual_event_ref: eventRef });
    expect(first.kind).toBe("COMMITTED");

    const bundles = world.assembly.storeRead.getCommittedBundles().filter((b) => b.subject_id === SUBJECT) as unknown as readonly AtomicCommitBundleAnyVersion[];
    const headBundle = bundles.at(-1);
    if (headBundle === undefined) throw new Error("head bundle must exist");
    const head: TrustedCanonicalHeadInputV0 = {
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
      head,
      reference_validator: async (binding) => {
        const manifest = await world.repo.readManifest(binding.repository_revision);
        return manifest !== null && (await computeRepositoryRevisionHash(manifest)) === binding.repository_revision_hash;
      }
    });
    if (minted.kind !== "MINTED") throw new Error(minted.detail);
    const headBinding = (await currentBindings(world.repo, headBundle.next_snapshot as unknown as SubjectStateV4))[0];
    const envelope = await createSubjectStateV4AuthoritativeRestoreEnvelopeV0({
      snapshot: headBundle.next_snapshot as unknown as SubjectStateV4,
      commit_head: head,
      repository_binding: headBinding as never
    });

    const freshRepo = new InMemoryMemoryRepository();
    await freshRepo.prepareRevision({ parent_revision: null as never, records: [] });
    for (const revision of world.repo.revisionIds()) {
      if (revision === "R0") continue;
      const manifest = await world.repo.readManifest(revision);
      if (manifest === null) continue;
      const entries = [];
      for (const entry of manifest.record_hashes) {
        const payload = world.repo.readStoredPayload(entry.ref as never);
        if (payload === undefined) throw new Error("payload must exist");
        entries.push({ ref: entry.ref, payload_hash: await freshRepo.storePayload(entry.ref as never, payload) });
      }
      await freshRepo.prepareRevision({ parent_revision: manifest.parent_revision as never, records: entries as never });
    }
    const restored = await restoreSubjectStateV4AuthoritativelyV0({
      envelope: envelope as never,
      trusted_boundary: minted.receipt,
      bundles,
      reference_validator: async (binding) => freshRepo.validateRevisionBinding(binding as never)
    });
    if (restored.kind !== "RESTORED") throw new Error(`restore failed: ${restored.kind}`);
    const freshAssembly = createInMemorySubjectCoreFacadeForExplicitV4V0({
      seedSnapshots: new Map([[SUBJECT as never, restored.snapshot as never]]),
      seedBundles: bundles as never,
      referenceValidator: async (binding) => freshRepo.validateRevisionBinding(binding as never),
      preparedResultValidator: async () => true
    });
    const freshTrustedHistory = {
      readCommittedBundlesForSubject: async (subjectId: string) =>
        freshAssembly.storeRead.getCommittedBundles().filter((b) => b.subject_id === subjectId) as unknown as readonly AtomicCommitBundleAnyVersion[]
    };
    const freshWriter = createCanonicalAffectApplicationV0ForExplicitV4({
      subjectCore: freshAssembly.facade,
      producerAuthorizationIssuer: freshAssembly.producerAuthorizationIssuer,
      repository: freshRepo,
      factualEventAuthority: world.factualEventAuthority,
      learningSourceAuthority: { readCommittedBundle: async (id) => freshAssembly.storeRead.readCommittedByTransitionId(id) as unknown as AtomicCommitBundleAnyVersion | null },
      affectAuthority: new InMemoryAffectEventAuthorityV0(freshTrustedHistory),
      trustedHistory: freshTrustedHistory
    });
    const commitsBefore = freshAssembly.storeRead.getCommittedBundles().length;
    const replay = await freshWriter.applyForEvent(
      ctxOf(restored.snapshot),
      { factual_event_ref: eventRef }
    );
    expect(replay).toMatchObject({ kind: "ALREADY_APPLIED", via: "CANONICAL" });
    expect(freshAssembly.storeRead.getCommittedBundles().length).toBe(commitsBefore);
  });

  it("73-82. history validator recomputes exactly and fails closed on tampering", async () => {
    const world = await buildWorld();
    const eventRef = await admitAndAppraise(world, "evt-x", "重做一下。");
    const outcome = await world.writer.applyForEvent(ctxOf(await readSnapshot(world)), { factual_event_ref: eventRef });
    expect(outcome.kind).toBe("COMMITTED");
    if (outcome.kind !== "COMMITTED") return;
    const bundles = world.assembly.storeRead.getCommittedBundles().filter((b) => b.subject_id === SUBJECT) as unknown as readonly AtomicCommitBundleAnyVersion[];
    const revision = (await readSnapshot(world)).memory_state.repository_revision;
    const base = {
      bundle: outcome.bundle as unknown as AtomicCommitBundleAnyVersion,
      bundles,
      subject_id: SUBJECT,
      repository: world.repo,
      repository_revision: revision
    };
    // The honest receipt validates.
    expect((await validateAffectApplicationReceiptV0(base)).ok).toBe(true);
    // Wrong transition type rejected.
    const wrongType = structuredClone(outcome.bundle) as unknown as Record<string, unknown>;
    wrongType["transition_type"] = "Learning";
    expect((await validateAffectApplicationReceiptV0({ ...base, bundle: wrongType as never })).ok).toBe(false);
    // Wrong /affect post-state rejected (recomputation is exact).
    const tamperedAffect = structuredClone(outcome.bundle) as unknown as Record<string, unknown>;
    const snapshotRecord = tamperedAffect["next_snapshot"] as Record<string, unknown>;
    snapshotRecord["affect"] = { schema_version: "canonical-affect-v0", valence: 0.99, activation: 0.2 };
    expect((await validateAffectApplicationReceiptV0({ ...base, bundle: tamperedAffect as never })).ok).toBe(false);
    // Extra domain write rejected.
    const extraDelta = structuredClone(outcome.bundle) as unknown as Record<string, unknown>;
    const proposalRecord = extraDelta["canonical_proposal"] as Record<string, unknown>;
    proposalRecord["domain_deltas"] = [
      (proposalRecord["domain_deltas"] as unknown[])[0],
      { producer: "regulation", domain: "regulation", expected_repository_revision: null, operations: [{ path: "/regulation", value: { energy: 1, stress: 0, arousal: 0.5, fatigue: 0, last_update: 0 } }] }
    ];
    expect((await validateAffectApplicationReceiptV0({ ...base, bundle: extraDelta as never })).ok).toBe(false);
    // Wrong eligibility ref rejected.
    const wrongExternal = structuredClone(outcome.bundle) as unknown as Record<string, unknown>;
    const wrongProposal = wrongExternal["canonical_proposal"] as Record<string, unknown>;
    wrongProposal["external_refs"] = [
      "source:affect-eligibility-v0-" + "0".repeat(64),
      "source:bounded-affect-dynamics-v0",
      "workflow:affect-execution-v0-" + "0".repeat(64)
    ];
    expect((await validateAffectApplicationReceiptV0({ ...base, bundle: wrongExternal as never })).ok).toBe(false);
  });

  it("84. duplicate valid receipts for one eligibility → INTEGRITY_CONFLICT", async () => {
    const world = await buildWorld();
    const eventRef = await admitAndAppraise(world, "evt-x", "重做一下。");
    const outcome = await world.writer.applyForEvent(ctxOf(await readSnapshot(world)), { factual_event_ref: eventRef });
    expect(outcome.kind).toBe("COMMITTED");
    if (outcome.kind !== "COMMITTED") return;
    const receipt = outcome.bundle;
    const duplicateTrustedHistory = {
      readCommittedBundlesForSubject: async (subjectId: string) =>
        world.trustedHistory.readCommittedBundlesForSubject(subjectId).then((list) => [...list, receipt]) as unknown as readonly AtomicCommitBundleAnyVersion[]
    };
    const conflictAuthority = new InMemoryAffectEventAuthorityV0(duplicateTrustedHistory);
    const resolution = await conflictAuthority.resolveApplicationStatus({
      subject_id: SUBJECT,
      factual_event_ref: eventRef as never,
      initial_appraisal_exists: true,
      receipt_validation: { repository: world.repo, repository_revision: (await readSnapshot(world)).memory_state.repository_revision as never }
    });
    expect(resolution.status).toBe("INTEGRITY_CONFLICT");
  });

  it("97. v3 predecessor rejected before any dynamics", async () => {
    const world = await buildWorld();
    const v3Assembly = createInMemorySubjectCoreFacade({
      seedSnapshots: new Map([[SUBJECT as never, v3Seed() as never]]),
      referenceValidator: async () => true,
      preparedResultValidator: async () => true
    });
    const v3Writer = createCanonicalAffectApplicationV0ForExplicitV4({
      subjectCore: v3Assembly.facade as never,
      producerAuthorizationIssuer: v3Assembly.producerAuthorizationIssuer,
      repository: world.repo,
      factualEventAuthority: world.factualEventAuthority,
      learningSourceAuthority: { readCommittedBundle: async () => null },
      affectAuthority: new InMemoryAffectEventAuthorityV0(world.trustedHistory),
      trustedHistory: world.trustedHistory
    });
    await expect(
      v3Writer.applyForEvent(ctxOf(await readSnapshot(world)), { factual_event_ref: "event:" + "f".repeat(64) })
    ).rejects.toThrow(/subject-state-v4 predecessor/);
  });

  it("69/72. Time after application recovers; application itself performs no decay", async () => {
    const world = await buildWorld();
    const eventRef = await admitAndAppraise(world, "evt-x", "重做一下。");
    const before = await readSnapshot(world);
    const outcome = await world.writer.applyForEvent(ctxOf(before), { factual_event_ref: eventRef });
    expect(outcome.kind).toBe("COMMITTED");
    if (outcome.kind !== "COMMITTED") return;
    // No decay inside application: the successor is EXACTLY before+impulse.
    const impulse = deriveAffectImpulseV0({ relevance: 0.8 as never, goal_congruence: 0.3 as never, intensity: 0.6 as never });
    expect(canonicalJsonString(outcome.bundle.next_snapshot.affect))
      .toBe(canonicalJsonString(applyAffectImpulseV0(before.affect, impulse)));
    // Time after application recovers toward baseline.
    const bundle = await executeV4Time(world, 300);
    expect(((bundle.next_snapshot as unknown as SubjectStateV4).affect).valence).toBeGreaterThan(before.affect.valence + impulse.u_v);
    expect(((bundle.next_snapshot as unknown as SubjectStateV4).affect).valence).toBeLessThan(0);
  });
});
