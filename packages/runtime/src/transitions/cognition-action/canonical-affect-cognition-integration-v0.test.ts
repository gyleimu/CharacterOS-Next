/**
 * CANONICAL_AFFECT_COGNITION_INTEGRATION_V0 — explicit-v4 integration matrix.
 *
 * Proves on EXPLICIT v4 subjects:
 *   - cognition consumes the exact committed CanonicalAffectV0 raw values
 *     (RAW_CANONICAL_VA) through CognitiveContextProjectionV2;
 *   - the canonical footprint stays a zero-delta durable NO_OP (no /affect,
 *     no /mood, no bundle, no state change; stale fails closed);
 *   - Time interaction reads the current snapshot only (no recovery);
 *   - authoritative restore yields the identical cognition input;
 *   - NORTH STAR: two subjects identical in every cognition-visible field
 *     except lawful prior Affect history produce cognition inputs differing
 *     ONLY in canonical_affect (+ its hash binding).
 *
 * The v3 legacy path (V0/V1, affect_channels + mood_baseline, rendered
 * [mood] line) is asserted unchanged. Deterministic fake providers only —
 * real model calls 0.
 */

import { describe, expect, it } from "vitest";

import {
  canonicalJsonString,
  createInMemorySubjectCoreFacadeForExplicitV4V0,
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
} from "../affect-application/affect-application-executor-v0.js";
import { createMiclStageMinter } from "../../micl/micl-capabilities.js";
import { InMemoryMiclWorkflowStore } from "../../micl/micl-workflow-store.js";
import {
  CognitionActionTransitionExecutor,
  buildCognitiveContextProjection,
  buildCognitiveContextProjectionV2ForExplicitV4
} from "./cognition-action-transition-executor.js";
import { renderCognitiveSubjectData } from "../../providers/cognition/cognitive-prompt-projection.js";
import { createSubjectStateV4AuthoritativeRestoreEnvelopeV0, restoreSubjectStateV4AuthoritativelyV0 } from "../../authority/restore-chain-authority-v4.js";
import { mintTrustedCanonicalHistoryBoundaryV4V0, type TrustedCanonicalHeadInputV0 } from "../../authority/trusted-canonical-history-boundary.js";

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

/** Cognition executor over an explicit-v4 subject with a capturing provider. */
interface CognitionRig {
  readonly captured: unknown[];
  execute: (snapshot: SubjectStateV4) => Promise<{ readonly outcome: { readonly kind: string; readonly failure?: { readonly error_code: string } } }>;
}

function buildCognitionRig(world: World, port?: {
  terminalizeReservedNoOp(input: never): Promise<unknown>;
  reserveAndRoute(proposal: never): Promise<unknown>;
}): CognitionRig {
  const captured: unknown[] = [];
  const provider = {
    propose: async (projection: unknown) => {
      captured.push(projection);
      return {
        schema_version: "cognition-proposal-v0",
        projection_hash: (projection as { projection_hash: string }).projection_hash,
        reasoning_summary: "fixed deterministic summary",
        relevant_memory_refs: [],
        considered_context_refs: [],
        current_intent: null,
        confidence: 0.5,
        uncertainty: 0.5,
        action_intent: null,
        evidence_refs: []
      };
    }
  };
  const minter = createMiclStageMinter(
    (port ?? world.assembly.facade) as never,
    new InMemoryMiclWorkflowStore(),
    {
      micl_id: `micl-cog-${Math.random().toString(36).slice(2, 8)}` as never,
      micl_request_fingerprint: "sha256:cog-v4" as never,
      stage_key: "OBSERVATION"
    }
  );
  const executor = new CognitionActionTransitionExecutor({
    cognitionProvider: provider,
    subjectCore: minter.core(),
    retrieval: {
      retrieve: async () => {
        throw new Error("cognition must not call retrieval in this harness");
      }
    },
    factualEvidenceResolver: null,
    producerAuthorizationIssuer: world.issuer
  } as never);
  return {
    captured,
    execute: async (snapshot: SubjectStateV4) => {
      const outcome = await executor.execute(
        {
          subject_id: SUBJECT as never,
          current_logical_time: snapshot.runtime_metadata.logical_time as never,
          state_revision: snapshot.runtime_metadata.state_revision as never
        },
        { cause_refs: [], allowed_actions: [] } as never,
        minter.capabilities(await currentBindings(world.repo, snapshot)) as never
      );
      return { outcome: outcome.outcome as unknown as { kind: string; failure?: { error_code: string } } };
    }
  };
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
        return {
          schema_version: "factual-event-appraisal-proposal-v0",
          status: "APPRAISED",
          subject_id: ctx.subject_id,
          factual_event_ref: ctx.factual_event_ref,
          context_projection_hash: ctx.context_projection_hash,
          dimensions: {
            relevance: override.relevance ?? 0.8,
            goal_congruence: override.goal_congruence ?? 0.3,
            attribution: "other" as const,
            controllability: 0.4,
            uncertainty: 0.5,
            intensity: override.intensity ?? 0.6
          },
          assessment_confidence: 0.7,
          evidence_refs: [ctx.factual_event_ref].sort()
        };
      }
    }
  } as never);

  const writerDeps: CanonicalAffectApplicationExecutorDepsV0 = {
    subjectCore: assembly.facade,
    producerAuthorizationIssuer: issuer,
    repository: repo,
    factualEventAuthority,
    learningSourceAuthority,
    affectAuthority: new InMemoryAffectEventAuthorityV0(trustedHistory),
    trustedHistory
  };

  const world: World = {
    repo,
    assembly,
    issuer: issuer as never,
    ingressLedger,
    factualEventAuthority,
    appraisalExecutor,
    writer: createCanonicalAffectApplicationV0ForExplicitV4(writerDeps),
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

async function admitEvent(world: World, sourceEventId: string, text: string): Promise<{
  eventRef: string;
  observationTransitionId: string;
  observationRef: string;
}> {
  const outcome = await world.ingressLedger.recordIngressEvent({
    schema_version: "conversation-ingress-input-v0",
    subject_id: SUBJECT,
    conversation_id: "conv-v4-cog",
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

async function appraiseAdmitted(world: World, sourceEventId: string, admission: { observationTransitionId: string; observationRef: string }): Promise<boolean> {
  const outcome = await world.appraisalExecutor.appraiseIncomingEvent(ctxOf(await readSnapshot(world)), {
    subject_id: SUBJECT as never,
    source_event_id: sourceEventId,
    observation_transition_id: admission.observationTransitionId as never,
    observation_ref: admission.observationRef as never
  });
  return outcome.kind === "COMMITTED";
}

async function admitAppraiseApply(world: World, sourceEventId: string, text: string): Promise<string> {
  const admission = await admitEvent(world, sourceEventId, text);
  if (!await appraiseAdmitted(world, sourceEventId, admission)) throw new Error("appraisal must commit");
  const outcome = await world.writer.applyForEvent(ctxOf(await readSnapshot(world)), { factual_event_ref: admission.eventRef });
  if (outcome.kind !== "COMMITTED") throw new Error(`application must commit: ${outcome.kind}`);
  return admission.eventRef;
}

async function executeV4Time(world: World, ticks: number): Promise<void> {
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
}

/** Strips the two lawfully-differing fields for the north-star comparison. */
function withoutAffectAndHash(projection: unknown): unknown {
  const { canonical_affect, projection_hash, ...rest } = projection as Record<string, unknown>;
  void canonical_affect;
  void projection_hash;
  return rest;
}

// ----------------------------------------------------------------------------------
// NO_OP + write isolation (§48)
// ----------------------------------------------------------------------------------

describe("CANONICAL_AFFECT_COGNITION_INTEGRATION_V0 — v4 NO_OP and write isolation (§48)", () => {
  it("44/48-51. v4 CognitionAction zero-delta NO_OP succeeds; no bundle; Affect unchanged", async () => {
    const world = await buildWorld();
    await admitAppraiseApply(world, "evt-x", "重做一下。");
    const before = await readSnapshot(world);
    const rig = buildCognitionRig(world);
    const bundlesBefore = world.assembly.storeRead.getCommittedBundles().length;
    const { outcome } = await rig.execute(before);
    // The zero-delta CognitionAction NO_OP terminalizes durably (journal-only).
    expect(["NO_OP", "COMMITTED"]).toContain(outcome.kind);
    // No new AtomicCommitBundle: the NO_OP terminal is not a state commit.
    expect(world.assembly.storeRead.getCommittedBundles().length).toBe(bundlesBefore);
    // Affect and state byte-unchanged.
    const after = await readSnapshot(world);
    expect(canonicalJsonString(after.affect)).toBe(canonicalJsonString(before.affect));
    expect(after.runtime_metadata.state_revision).toBe(before.runtime_metadata.state_revision);
    expect(after.runtime_metadata.logical_time).toBe(before.runtime_metadata.logical_time);
  });

  it("45-47. delta-carrying v4 CognitionAction NO_OP rejected (hard zero-delta law)", async () => {
    const world = await buildWorld();
    // A /affect delta can never ride a CognitionAction NO_OP terminal.
    const bogusProposal = {
      schema_version: "canonical-transition-proposal-v1",
      transition_id: "t-cog-bogus-delta",
      subject_id: SUBJECT,
      transition_type: "CognitionAction",
      expected_state_revision: (await readSnapshot(world)).runtime_metadata.state_revision,
      time_input: { kind: "OCCURRENCE", occurrence_logical_time: (await readSnapshot(world)).runtime_metadata.logical_time },
      cause_refs: [],
      domain_deltas: [{
        producer: "affect",
        domain: "affect",
        expected_repository_revision: null,
        operations: [{ path: "/affect", value: { schema_version: "canonical-affect-v0", valence: 0.9, activation: 0.9 } }],
        provenance_refs: []
      }],
      external_refs: []
    };
    // The ownership matrix rejects the /affect delta at proposal admission —
    // the hard machine law that CognitionAction can never carry an affect write.
    await expect(
      world.assembly.facade.reserveAndRoute(bogusProposal as never)
    ).rejects.toThrow("/affect not writable by transition CognitionAction");
  });
});

// ----------------------------------------------------------------------------------
// Provider input + rendering (§46/§47) + V3 goldens (§45)
// ----------------------------------------------------------------------------------

describe("CANONICAL_AFFECT_COGNITION_INTEGRATION_V0 — provider input and rendering (§46/§47)", () => {
  it("38-43. fake provider receives V2 with exact VA; hash bound; output validation unchanged", async () => {
    const world = await buildWorld();
    await admitAppraiseApply(world, "evt-x", "重做一下。");
    const snapshot = await readSnapshot(world);
    const rig = buildCognitionRig(world);
    await rig.execute(snapshot);
    expect(rig.captured).toHaveLength(1);
    const projection = rig.captured[0] as Record<string, unknown>;
    expect(projection["schema_version"]).toBe("cognitive-context-projection-v2");
    const affect = projection["canonical_affect"] as { valence: number; activation: number };
    expect(affect.valence).toBe(snapshot.affect.valence);
    expect(affect.activation).toBe(snapshot.affect.activation);
    expect(projection["projection_hash"]).toBeDefined();
    // The rendered prompt carries the canonical line and no legacy lines.
    const rendered = renderCognitiveSubjectData(projection as never);
    expect(rendered).toContain(`[affect (canonical)] valence=${snapshot.affect.valence} activation=${snapshot.affect.activation}`);
    expect(rendered).not.toContain("[mood]");
    expect(rendered).not.toContain("[affect] ");
    expect(rendered).not.toContain("You feel");
    expect(rendered).not.toContain("angry");
    // Same snapshot → identical captured input.
    const rig2 = buildCognitionRig(world);
    await rig2.execute(snapshot);
    expect(canonicalJsonString(rig2.captured[0])).toBe(canonicalJsonString(rig.captured[0]));
  });

  it("24-28/31/37. v3 goldens: V0/V1 projection and rendering unchanged; V2 has no legacy lines", async () => {
    // v3 golden: the legacy projection still carries channels + mood.
    const v3Projection = await buildCognitiveContextProjection(s0() as unknown as SubjectStateV0);
    expect(v3Projection.schema_version).toBe("cognitive-context-projection-v0");
    expect(Array.isArray(v3Projection.affect_channels)).toBe(true);
    expect(v3Projection.mood_baseline).toBe(0);
    const v3Rendered = renderCognitiveSubjectData(v3Projection);
    expect(v3Rendered).toContain("[affect] (no active affect channels)");
    expect(v3Rendered).toContain("[mood] baseline=0");
    // The shared renderer rejects unknown schema versions fail closed.
    expect(() => renderCognitiveSubjectData({ schema_version: "cognitive-context-projection-v9" } as never)).toThrow(/unsupported projection schema/);
  });
});

// ----------------------------------------------------------------------------------
// Time interaction (§49) + stale (§53)
// ----------------------------------------------------------------------------------

describe("CANONICAL_AFFECT_COGNITION_INTEGRATION_V0 — time and stale (§49/§53)", () => {
  it("53-58. Time before cognition: cognition sees recovered A2; no recovery inside cognition", async () => {
    const world = await buildWorld();
    const eventRef = await admitAppraiseApply(world, "evt-x", "重做一下。");
    void eventRef;
    const a1 = (await readSnapshot(world)).affect;
    await executeV4Time(world, 300);
    const a2 = (await readSnapshot(world)).affect;
    expect(canonicalJsonString(a2)).not.toBe(canonicalJsonString(a1));
    const rig = buildCognitionRig(world);
    await rig.execute(await readSnapshot(world));
    const projection = rig.captured[0] as { canonical_affect: { valence: number } };
    expect(projection.canonical_affect.valence).toBe(a2.valence);
  });

  it("89-94. stale head before terminalization fails closed under existing law", async () => {
    const world = await buildWorld();
    await admitAppraiseApply(world, "evt-x", "重做一下。");
    const snapshot = await readSnapshot(world);
    // A Time commit wins BETWEEN the cognition projection and the NO_OP
    // terminalization: the facade's authority re-read rejects stale.
    const inner = createMiclStageMinter(
      world.assembly.facade as never,
      new InMemoryMiclWorkflowStore(),
      { micl_id: "micl-cog-stale" as never, micl_request_fingerprint: "sha256:cog-stale" as never, stage_key: "OBSERVATION" }
    );
    const stalePort = {
      reserveAndRoute: inner.core().reserveAndRoute,
      commitReserved: inner.core().commitReserved,
      terminalizeReservedNoOp: async (input: never) => {
        await executeV4Time(world, 5);
        return inner.core().terminalizeReservedNoOp(input);
      },
      reconcile: inner.core().reconcile,
      readCurrentSnapshot: inner.core().readCurrentSnapshot
    };
    const executor = new CognitionActionTransitionExecutor({
      cognitionProvider: {
        propose: async (projection: unknown) => ({
          schema_version: "cognition-proposal-v0",
          projection_hash: (projection as { projection_hash: string }).projection_hash,
          reasoning_summary: "stale test",
          relevant_memory_refs: [],
          considered_context_refs: [],
          current_intent: null,
          confidence: 0.5,
          uncertainty: 0.5,
          action_intent: null,
          evidence_refs: []
        })
      },
      subjectCore: stalePort as never,
      retrieval: {
        retrieve: async () => {
          throw new Error("no retrieval");
        }
      },
      factualEvidenceResolver: null,
      producerAuthorizationIssuer: world.issuer
    } as never);
    const result = await executor.execute(
      ctxOf(snapshot),
      { cause_refs: [], allowed_actions: [] } as never,
      inner.capabilities(await currentBindings(world.repo, snapshot)) as never
    );
    expect(result.outcome.kind).toBe("REJECTED");
    // No Affect mutation from cognition: the only head movement is the Time commit.
    expect(world.assembly.storeRead.getCommittedBundles().at(-1)?.transition_type).toBe("Time");
  });
});

// ----------------------------------------------------------------------------------
// Restore invariance (§51)
// ----------------------------------------------------------------------------------

describe("CANONICAL_AFFECT_COGNITION_INTEGRATION_V0 — restore invariance (§51)", () => {
  it("66-74. authoritative restore yields the identical V2 cognition input", async () => {
    const world = await buildWorld();
    await admitAppraiseApply(world, "evt-x", "重做一下。");
    const before = await readSnapshot(world);
    const projectionBefore = await buildCognitiveContextProjectionV2ForExplicitV4(before);

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

    const projectionAfter = await buildCognitiveContextProjectionV2ForExplicitV4(restored.snapshot);
    expect(canonicalJsonString(projectionAfter)).toBe(canonicalJsonString(projectionBefore));
    expect(projectionAfter.projection_hash).toBe(projectionBefore.projection_hash);
    expect(projectionAfter.canonical_affect).toStrictEqual(projectionBefore.canonical_affect);
  });
});

// ----------------------------------------------------------------------------------
// North-star two-subject proof (§52)
// ----------------------------------------------------------------------------------

describe("CANONICAL_AFFECT_COGNITION_INTEGRATION_V0 — north-star two-subject proof (§52)", () => {
  it("75-88. different lawful prior Affect histories → cognition inputs differ ONLY in canonical_affect", async () => {
    // Subject A: prior event appraised with goal_congruence 1 → valence +0.25.
    const worldA = await buildWorld();
    const aPrior = await admitEvent(worldA, "evt-prior", "重做一下。");
    worldA.dimensionOverrides.set(aPrior.eventRef, { relevance: 1, goal_congruence: 1, intensity: 1 });
    const aOk = await appraiseAdmitted(worldA, "evt-prior", aPrior);
    expect(aOk).toBe(true);
    expect((await worldA.writer.applyForEvent(ctxOf(await readSnapshot(worldA)), { factual_event_ref: aPrior.eventRef })).kind).toBe("COMMITTED");

    // Subject B: identical shape, but goal_congruence 0 → valence -0.25.
    const worldB = await buildWorld();
    const bPrior = await admitEvent(worldB, "evt-prior", "重做一下。");
    worldB.dimensionOverrides.set(bPrior.eventRef, { relevance: 1, goal_congruence: 0, intensity: 1 });
    expect(await appraiseAdmitted(worldB, "evt-prior", bPrior)).toBe(true);
    expect((await worldB.writer.applyForEvent(ctxOf(await readSnapshot(worldB)), { factual_event_ref: bPrior.eventRef })).kind).toBe("COMMITTED");

    // 82/83: the lawful histories produced different current canonical Affect.
    const affectA = (await readSnapshot(worldA)).affect;
    const affectB = (await readSnapshot(worldB)).affect;
    // 82/83 asserted on the PRIOR histories: different valence, same activation.
    expect(affectA.valence).not.toBe(affectB.valence);
    expect(affectA.activation).toBe(affectB.activation);

    // The SAME current event (identical text/source id) for both subjects.
    const currentA = await admitAppraiseApply(worldA, "evt-current", "现在感觉怎么样？");
    const currentB = await admitAppraiseApply(worldB, "evt-current", "现在感觉怎么样？");
    void currentA;
    void currentB;

    // Cognition via the capturing fake provider for both subjects.
    const rigA = buildCognitionRig(worldA);
    await rigA.execute(await readSnapshot(worldA));
    const rigB = buildCognitionRig(worldB);
    await rigB.execute(await readSnapshot(worldB));
    const projectionA = rigA.captured[0] as Record<string, unknown>;
    const projectionB = rigB.captured[0] as Record<string, unknown>;

    // 84: the V2 projections differ.
    expect(canonicalJsonString(projectionA)).not.toBe(canonicalJsonString(projectionB));
    // 85: the ONLY semantically differing section is canonical_affect
    // (+ its projection-hash binding).
    expect(canonicalJsonString(withoutAffectAndHash(projectionA))).toBe(canonicalJsonString(withoutAffectAndHash(projectionB)));
    const affectSectionA = projectionA["canonical_affect"] as { valence: number; activation: number };
    const affectSectionB = projectionB["canonical_affect"] as { valence: number; activation: number };
    expect(affectSectionA.valence).not.toBe(affectSectionB.valence);
    expect(affectSectionA.activation).toBe(affectSectionB.activation);
    // 86: the fake providers captured the exact differing VA.
    // The provider captured the CURRENT committed VA (post-application).
    expect(affectSectionA.valence).toBe((await readSnapshot(worldA)).affect.valence);
    expect(affectSectionB.valence).toBe((await readSnapshot(worldB)).affect.valence);
    // 87: fixed provider output — no requirement of different output.
    // 88: real model calls 0 (all providers deterministic fakes).
  });
});
