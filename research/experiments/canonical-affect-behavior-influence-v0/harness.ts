/* eslint-disable no-restricted-imports, @typescript-eslint/no-non-null-assertion -- Isolated trusted experiment host over frozen built production roots; zero production code changes. */
/**
 * CANONICAL_AFFECT_COGNITION_BEHAVIOR_INFLUENCE_EXPERIMENT_V0 — isolated
 * trusted experiment host over FROZEN built production roots. Zero production
 * code changes: every executor/authority/gate here is the committed
 * production build imported as-is (deep dist imports follow the
 * familiarity-causal-behavior-v1 convention for symbols kept out of the
 * runtime barrel by the isolation guards).
 */

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
} from "../../../packages/subject-core/dist/index.js";
import { computeRepositoryRevisionHash, InMemoryMemoryRepository } from "../../../packages/memory/dist/index.js";
import {
  createConversationIngressLedgerAuthorityV0,
  FactualEventAppraisalExecutorV0,
  buildContextDelta
} from "../../../packages/runtime/dist/index.js";
import { buildObservationProposal } from "../../../packages/runtime/dist/transitions/observation/observation-transition-executor.js";
import { InMemoryConversationFactualEventAuthorityV0 } from "../../../packages/runtime/dist/authority/conversation-factual-event-authority-v0.js";
import { InMemoryAffectEventAuthorityV0 } from "../../../packages/runtime/dist/authority/affect-event-authority-v0.js";
import { createCanonicalAffectApplicationV0ForExplicitV4 } from "../../../packages/runtime/dist/transitions/affect-application/affect-application-executor-v0.js";
import { CognitionActionTransitionExecutor } from "../../../packages/runtime/dist/transitions/cognition-action/cognition-action-transition-executor.js";
import { createMiclStageMinter } from "../../../packages/runtime/dist/micl/micl-capabilities.js";
import { InMemoryMiclWorkflowStore } from "../../../packages/runtime/dist/index.js";
import { COGNITIVE_CONTEXT_PROJECTION_V2_SCHEMA_VERSION, cognitiveProjectionHash } from "../../../packages/runtime/dist/transitions/cognition-action/types.js";
import {
  projectCanonicalAffectForCognitionV0,
  type CanonicalAffectCognitionProjectionV0
} from "../../../packages/runtime/dist/transitions/cognition-action/canonical-affect-cognition-projection-v0.js";
import { observationInput, observationCauseRefOf, s0 } from "../../../packages/runtime/dist/transitions/observation/observation-fixtures.js";
import {
  ALICE,
  CURRENT_DIMENSIONS,
  FAKE_PROVIDER_OUTPUT,
  PRIOR_EVENT,
  SUBJECT,
  TASK,
  type Arm
} from "./contract.ts";
import { check } from "./fixtures.ts";

export interface World {
  readonly repo: InMemoryMemoryRepository;
  readonly assembly: InMemoryFacadeAssembly<SubjectStateV4>;
  readonly issuer: ProducerAuthorizationIssuer;
  readonly ingressLedger: ReturnType<typeof createConversationIngressLedgerAuthorityV0>;
  readonly factualEventAuthority: InMemoryConversationFactualEventAuthorityV0;
  readonly appraisalExecutor: FactualEventAppraisalExecutorV0;
  readonly writer: ReturnType<typeof createCanonicalAffectApplicationV0ForExplicitV4>;
  readonly dimensionOverrides: Map<string, Partial<{ relevance: number; goal_congruence: number; intensity: number }>>;
  readonly genesis: { readonly state: SubjectStateV4; readonly envelope: V4PersistenceEnvelopeV0 };
}

function v3Seed(): SubjectStateV0 {
  const base = s0() as unknown as { context: Record<string, unknown> };
  const raw = {
    ...s0(),
    context: { ...base.context, task: TASK },
    regulation: { energy: 1, stress: 0, arousal: 0.5, fatigue: 0, last_update: null }
  } as unknown as SubjectStateV0;
  const checked = validateSubjectState(raw);
  check(checked.ok, `v3 seed invariant: ${checked.ok ? "" : checked.error!.detail}`);
  return checked.value;
}

/** One explicit-v4 subject world over frozen production genesis. */
export async function buildWorld(): Promise<World> {
  const repo = new InMemoryMemoryRepository();
  await repo.prepareRevision({ parent_revision: null as never, records: [] });
  const r0Manifest = await repo.readManifest("R0" as never);
  check(r0Manifest !== null, "R0 manifest must exist");
  const r0Binding = {
    repository_revision: "R0" as never,
    repository_revision_hash: await computeRepositoryRevisionHash(r0Manifest!)
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
  check(genesisResult.ok, `genesis failed: ${genesisResult.ok ? "" : `${genesisResult.code}: ${genesisResult.detail}`}`);

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
        const override = worldRef?.dimensionOverrides.get(ctx.factual_event_ref) ?? {};
        return {
          schema_version: "factual-event-appraisal-proposal-v0",
          status: "APPRAISED",
          subject_id: ctx.subject_id,
          factual_event_ref: ctx.factual_event_ref,
          context_projection_hash: ctx.context_projection_hash,
          dimensions: {
            relevance: override.relevance ?? CURRENT_DIMENSIONS.relevance,
            goal_congruence: override.goal_congruence ?? CURRENT_DIMENSIONS.goal_congruence,
            attribution: CURRENT_DIMENSIONS.attribution as never,
            controllability: CURRENT_DIMENSIONS.controllability,
            uncertainty: CURRENT_DIMENSIONS.uncertainty,
            intensity: override.intensity ?? CURRENT_DIMENSIONS.intensity
          },
          assessment_confidence: CURRENT_DIMENSIONS.assessment_confidence,
          evidence_refs: [ctx.factual_event_ref].sort()
        };
      }
    }
  } as never);
  const writer = createCanonicalAffectApplicationV0ForExplicitV4({
    subjectCore: assembly.facade,
    producerAuthorizationIssuer: issuer,
    repository: repo,
    factualEventAuthority,
    learningSourceAuthority,
    affectAuthority: new InMemoryAffectEventAuthorityV0(trustedHistory),
    trustedHistory
  });
  const world: World = {
    repo,
    assembly,
    issuer: issuer as never,
    ingressLedger,
    factualEventAuthority,
    appraisalExecutor,
    writer,
    dimensionOverrides: new Map(),
    genesis: { state: genesisResult.state, envelope: genesisResult.envelope }
  };
  worldRef = world;
  return world;
}

export async function readSnapshot(world: World): Promise<SubjectStateV4> {
  const snapshot = await world.assembly.facade.readCurrentSnapshot(SUBJECT as never);
  check(snapshot !== null, "snapshot must exist");
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
export async function admitEvent(world: World, sourceEventId: string, text: string): Promise<{
  eventRef: string;
  observationTransitionId: string;
  observationRef: string;
}> {
  const outcome = await world.ingressLedger.recordIngressEvent({
    schema_version: "conversation-ingress-input-v0",
    subject_id: SUBJECT,
    conversation_id: "conv-affect-experiment",
    actor_ref: ALICE,
    text,
    logical_time: 0,
    source_event_id: sourceEventId,
    in_reply_to_delivery_id: null,
    host_adapter: "experiment-adapter"
  });
  check(outcome.kind === "RECORDED", `ingress must record: ${outcome.kind}`);
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
  check(reserved.kind === "CONTINUE", `observation reservation: ${reserved.kind}`);
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
  check(commitOutcome.kind === "COMMITTED", `observation must commit: ${JSON.stringify(commitOutcome).slice(0, 160)}`);
  return {
    eventRef,
    observationTransitionId: commitOutcome.bundle.transition_id as string,
    observationRef: observationCauseRefOf(commitOutcome.bundle as never)
  };
}

export async function appraiseAdmitted(world: World, sourceEventId: string, admission: { observationTransitionId: string; observationRef: string }): Promise<string> {
  const outcome = await world.appraisalExecutor.appraiseIncomingEvent(ctxOf(await readSnapshot(world)), {
    subject_id: SUBJECT as never,
    source_event_id: sourceEventId,
    observation_transition_id: admission.observationTransitionId as never,
    observation_ref: admission.observationRef as never
  });
  check(outcome.kind === "COMMITTED", `appraisal must commit: ${outcome.kind}`);
  return outcome.appraisal_ref as string;
}

export async function applyAffect(world: World, eventRef: string): Promise<void> {
  const outcome = await world.writer.applyForEvent(ctxOf(await readSnapshot(world)), { factual_event_ref: eventRef as never });
  check(outcome.kind === "COMMITTED", `AffectApplication must commit: ${outcome.kind}`);
}

async function currentBindings(repo: InMemoryMemoryRepository, snapshot: SubjectStateV4) {
  const revision = snapshot.memory_state.repository_revision as never;
  const manifest = await repo.readManifest(revision);
  check(manifest !== null, "manifest must exist");
  return [{
    repository_revision: revision,
    repository_revision_hash: await computeRepositoryRevisionHash(manifest!)
  }];
}

export interface CognitionTrial {
  readonly provider_input: unknown;
  readonly proposal: {
    readonly schema_version: string;
    readonly projection_hash: string;
    readonly reasoning_summary: string;
    readonly relevant_memory_refs: readonly string[];
    readonly considered_context_refs: readonly string[];
    readonly current_intent: string | null;
    readonly confidence: number;
    readonly uncertainty: number;
    readonly action_intent: unknown;
    readonly evidence_refs: readonly string[];
  };
}

/**
 * Runs ONE cognition trial through the frozen production CognitionAction
 * executor with the deterministic fake provider (fixed valid output echoing
 * the received projection hash — arm-unaware). The provider-facing projection
 * is captured for the audit.
 */
export async function runCognitionTrial(world: World, captured: unknown[]): Promise<CognitionTrial> {
  const minter = createStageMinter(world);
  const executor = new CognitionActionTransitionExecutor({
    cognitionProvider: {
      propose: async (projection: unknown) => {
        captured.push(projection);
        return {
          ...FAKE_PROVIDER_OUTPUT,
          projection_hash: (projection as { projection_hash: string }).projection_hash
        };
      }
    },
    subjectCore: minter.core(),
    retrieval: {
      retrieve: async () => {
        throw new Error("EXPERIMENT: cognition must not call retrieval");
      }
    },
    factualEvidenceResolver: null,
    producerAuthorizationIssuer: world.issuer
  } as never);
  const snapshot = await readSnapshot(world);
  const result = await executor.execute(
    ctxOf(snapshot),
    { cause_refs: [], allowed_actions: [] } as never,
    minter.capabilities(await currentBindings(world.repo, snapshot)) as never
  );
  check(result.outcome.kind === "NO_OP" || result.outcome.kind === "COMMITTED", `cognition NO_OP terminalized: ${result.outcome.kind}`);
  check(captured.length === 1, "exactly one provider input captured");
  return { provider_input: captured[0], proposal: result.cognition as CognitionTrial["proposal"] };
}

function createStageMinter(world: World): {
  core(): unknown;
  capabilities(bindings: unknown): unknown;
} {
  // The MICL stage minter is the frozen capability minting path used by every
  // governed cognition execution (deep dist import: kept out of the barrel by
  // the isolation guards).
  return createMiclStageMinter(
    world.assembly.facade as never,
    new InMemoryMiclWorkflowStore(),
    {
      micl_id: `micl-cog-experiment-${Math.floor(Math.random() * 1e9)}` as never,
      micl_request_fingerprint: "sha256:canonical-affect-behavior-influence-v0" as never,
      stage_key: "OBSERVATION" as never
    }
  ) as unknown as { core(): unknown; capabilities(bindings: unknown): unknown };
}

/**
 * §8 — the lawful two-event history per arm: prior event (goal_congruence 1
 * for A, 0 for B) → canonical Appraisal → AffectApplication; then the current
 * scenario event (IDENTICAL across arms) → identical Appraisal → identical
 * AffectApplication impulse on the arm-specific prior Affect.
 */
export async function constructArmHistory(world: World, arm: Arm, scenario: { readonly id: string; readonly task: string; readonly text: string }): Promise<{
  readonly prior_affect_ref: string;
  readonly current_event_ref: string;
  readonly current_appraisal_ref: string;
}> {
  // --- prior event: identical wording across arms; only goal_congruence differs
  const prior = await admitEvent(world, PRIOR_EVENT.source_event_id, PRIOR_EVENT.text);
  world.dimensionOverrides.set(prior.eventRef, {
    relevance: PRIOR_EVENT.dimensions_base.relevance,
    goal_congruence: arm === "A" ? PRIOR_EVENT.goal_congruence_arm_a : PRIOR_EVENT.goal_congruence_arm_b,
    intensity: PRIOR_EVENT.dimensions_base.intensity
  });
  await appraiseAdmitted(world, PRIOR_EVENT.source_event_id, prior);
  await applyAffect(world, prior.eventRef);
  const priorSnapshot = await readSnapshot(world);
  const priorAffectRefs = (await world.repo.readVisibleRecordHashes(priorSnapshot.memory_state.repository_revision as never))
    .filter((e) => e.ref.startsWith("appraisal:"));
  check(priorAffectRefs.length >= 1, "prior appraisal record must be visible");

  // --- current scenario event: IDENTICAL across arms
  const current = await admitEvent(world, `evt-${scenario.id}`, scenario.text);
  const currentAppraisalRef = await appraiseAdmitted(world, `evt-${scenario.id}`, current);
  await applyAffect(world, current.eventRef);
  return {
    prior_affect_ref: priorAffectRefs[0]?.ref ?? "",
    current_event_ref: current.eventRef,
    current_appraisal_ref: currentAppraisalRef
  };
}

/** §12 — EXPERIMENTAL_ABLATION_ONLY: replaces the canonical_affect section
 * with the neutral baseline AND recomputes the projection hash over the
 * ablated body, so arm-ablated inputs become byte-identical (the provider
 * cannot distinguish arms by any field, including the hash). Pure transform
 * over the captured provider input; production projection code untouched. */
export function ablateProviderInput(providerInput: unknown): unknown {
  const projection = providerInput as Record<string, unknown>;
  check(projection["schema_version"] === COGNITIVE_CONTEXT_PROJECTION_V2_SCHEMA_VERSION, "ablation requires a V2 projection");
  const neutralSection = projectCanonicalAffectForCognitionV0({
    schema_version: "canonical-affect-v0",
    valence: 0,
    activation: 0.2
  } as never) as CanonicalAffectCognitionProjectionV0;
  const body: Record<string, unknown> = { ...projection };
  delete body["schema_version"];
  delete body["allowed_actions"];
  delete body["projection_hash"];
  body["canonical_affect"] = { ...neutralSection };
  const ablatedHash = cognitiveProjectionHash(body);
  return Object.freeze({
    ...body,
    schema_version: projection["schema_version"],
    allowed_actions: projection["allowed_actions"],
    projection_hash: ablatedHash
  });
}
