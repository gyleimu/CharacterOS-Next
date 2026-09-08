/* eslint-disable no-restricted-imports, @typescript-eslint/no-non-null-assertion -- Isolated experiment host over frozen built production roots. */
/** Lawful production-history construction and provider-input capture for V1. */

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
  buildContextDelta,
  InMemoryMiclWorkflowStore
} from "../../../packages/runtime/dist/index.js";
import { buildObservationProposal } from "../../../packages/runtime/dist/transitions/observation/observation-transition-executor.js";
import { InMemoryConversationFactualEventAuthorityV0 } from "../../../packages/runtime/dist/authority/conversation-factual-event-authority-v0.js";
import { InMemoryAffectEventAuthorityV0 } from "../../../packages/runtime/dist/authority/affect-event-authority-v0.js";
import { createCanonicalAffectApplicationV0ForExplicitV4 } from "../../../packages/runtime/dist/transitions/affect-application/affect-application-executor-v0.js";
import { CognitionActionTransitionExecutor } from "../../../packages/runtime/dist/transitions/cognition-action/cognition-action-transition-executor.js";
import { createMiclStageMinter } from "../../../packages/runtime/dist/micl/micl-capabilities.js";
import {
  COGNITIVE_CONTEXT_PROJECTION_V2_SCHEMA_VERSION,
  cognitiveProjectionHash
} from "../../../packages/runtime/dist/transitions/cognition-action/types.js";
import {
  projectCanonicalAffectForCognitionV0,
  type CanonicalAffectCognitionProjectionV0
} from "../../../packages/runtime/dist/transitions/cognition-action/canonical-affect-cognition-projection-v0.js";
import {
  observationInput,
  observationCauseRefOf,
  s0
} from "../../../packages/runtime/dist/transitions/observation/observation-fixtures.js";
import {
  ALICE,
  CURRENT_DIMENSIONS,
  PRIOR_EVENT,
  SUBJECT,
  type AllowedAction,
  type MagnitudeV1,
  type ScenarioV1,
  type TreatmentArm
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

function v3Seed(task: string): SubjectStateV0 {
  const initial = s0() as unknown as { context: Record<string, unknown> };
  const raw = {
    ...s0(),
    context: { ...initial.context, task },
    regulation: { energy: 1, stress: 0, arousal: 0.5, fatigue: 0, last_update: null }
  } as unknown as SubjectStateV0;
  const checked = validateSubjectState(raw);
  check(checked.ok, `v3 seed invariant: ${checked.ok ? "" : checked.error!.detail}`);
  return checked.value;
}

/** One explicit-v4 world using the scenario task in canonical context. */
export async function buildWorld(task: string): Promise<World> {
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
      v3_source: v3Seed(task),
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
      assembly.storeRead.getCommittedBundles().filter((bundle) => bundle.subject_id === subjectId) as unknown as readonly AtomicCommitBundleAnyVersion[]
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
      markAdopted: (record: never) => void repo.markAdopted(record),
      isAdopted: (record: never) => repo.isAdopted(record)
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

export function contextOf(snapshot: SubjectStateV4): {
  readonly subject_id: never;
  readonly current_logical_time: never;
  readonly state_revision: never;
} {
  return {
    subject_id: SUBJECT as never,
    current_logical_time: snapshot.runtime_metadata.logical_time as never,
    state_revision: snapshot.runtime_metadata.state_revision as never
  };
}

export async function currentBindings(repo: InMemoryMemoryRepository, snapshot: SubjectStateV4): Promise<readonly Record<string, unknown>[]> {
  const revision = snapshot.memory_state.repository_revision as never;
  const manifest = await repo.readManifest(revision);
  check(manifest !== null, "manifest must exist");
  return [{
    repository_revision: revision,
    repository_revision_hash: await computeRepositoryRevisionHash(manifest!)
  }];
}

export interface AdmittedEvent {
  readonly event_ref: string;
  readonly observation_transition_id: string;
  readonly observation_ref: string;
}

/** Ingress plus committed V4 Observation; no legacy Affect path. */
export async function admitEvent(world: World, sourceEventId: string, text: string): Promise<AdmittedEvent> {
  const outcome = await world.ingressLedger.recordIngressEvent({
    schema_version: "conversation-ingress-input-v0",
    subject_id: SUBJECT,
    conversation_id: "conv-affect-replication-v1",
    actor_ref: ALICE,
    text,
    logical_time: 0,
    source_event_id: sourceEventId,
    in_reply_to_delivery_id: null,
    host_adapter: "replication-v1-adapter"
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
  const committed = await world.assembly.facade.commitReserved({
    proposal,
    continuation: reserved.continuation,
    producerAuthorization: world.issuer.issue([{ producer: "context", domain: "context" }]) as never,
    preparedBinding: {
      prepared_result_ref: `workflow:w-v1-${sourceEventId}` as never,
      transition_id: proposal.transition_id,
      subject_id: proposal.subject_id,
      transition_type: proposal.transition_type,
      payload_fingerprint: await proposalFingerprint(proposal)
    },
    repository_bindings: await currentBindings(world.repo, snapshot) as never
  });
  check(committed.kind === "COMMITTED", `observation must commit: ${JSON.stringify(committed).slice(0, 160)}`);
  return {
    event_ref: eventRef,
    observation_transition_id: committed.bundle.transition_id as string,
    observation_ref: observationCauseRefOf(committed.bundle as never)
  };
}

export async function appraiseAdmitted(world: World, sourceEventId: string, admission: AdmittedEvent): Promise<string> {
  const outcome = await world.appraisalExecutor.appraiseIncomingEvent(contextOf(await readSnapshot(world)), {
    subject_id: SUBJECT as never,
    source_event_id: sourceEventId,
    observation_transition_id: admission.observation_transition_id as never,
    observation_ref: admission.observation_ref as never
  });
  check(outcome.kind === "COMMITTED", `appraisal must commit: ${outcome.kind}`);
  return outcome.appraisal_ref as string;
}

export async function applyAffect(world: World, eventRef: string): Promise<void> {
  const outcome = await world.writer.applyForEvent(contextOf(await readSnapshot(world)), { factual_event_ref: eventRef as never });
  check(outcome.kind === "COMMITTED", `AffectApplication must commit: ${outcome.kind}`);
}

export interface HistoryProof {
  readonly path: readonly ["factual event", "Observation", "canonical INITIAL Appraisal", "AffectApplication", "durable CanonicalAffectV0"];
  readonly prior_event_ref: string;
  readonly prior_observation_ref: string;
  readonly prior_appraisal_ref: string;
  readonly prior_dimensions: {
    readonly relevance: number;
    readonly goal_congruence: number;
    readonly intensity: number;
  };
  readonly current_event_ref: string;
  readonly current_observation_ref: string;
  readonly current_appraisal_ref: string;
  readonly current_dimensions: typeof CURRENT_DIMENSIONS;
  readonly committed_bundle_count: number;
}

/** Lawful two-event history: one magnitude event, then one identical current event. */
export async function constructArmHistory(
  world: World,
  arm: TreatmentArm,
  scenario: ScenarioV1,
  magnitude: MagnitudeV1
): Promise<HistoryProof> {
  const prior = await admitEvent(world, PRIOR_EVENT.source_event_id, PRIOR_EVENT.text);
  const goalCongruence = arm === "A" ? PRIOR_EVENT.goal_congruence_a : PRIOR_EVENT.goal_congruence_b;
  world.dimensionOverrides.set(prior.event_ref, {
    relevance: magnitude.prior_relevance,
    goal_congruence: goalCongruence,
    intensity: magnitude.prior_intensity
  });
  const priorAppraisalRef = await appraiseAdmitted(world, PRIOR_EVENT.source_event_id, prior);
  await applyAffect(world, prior.event_ref);

  const current = await admitEvent(world, scenario.event_id, scenario.current_factual_event);
  const currentAppraisalRef = await appraiseAdmitted(world, scenario.event_id, current);
  await applyAffect(world, current.event_ref);
  return {
    path: ["factual event", "Observation", "canonical INITIAL Appraisal", "AffectApplication", "durable CanonicalAffectV0"],
    prior_event_ref: prior.event_ref,
    prior_observation_ref: prior.observation_ref,
    prior_appraisal_ref: priorAppraisalRef,
    prior_dimensions: {
      relevance: magnitude.prior_relevance,
      goal_congruence: goalCongruence,
      intensity: magnitude.prior_intensity
    },
    current_event_ref: current.event_ref,
    current_observation_ref: current.observation_ref,
    current_appraisal_ref: currentAppraisalRef,
    current_dimensions: { ...CURRENT_DIMENSIONS },
    committed_bundle_count: world.assembly.storeRead.getCommittedBundles().length
  };
}

const FAKE_OUTPUT = Object.freeze({
  schema_version: "cognition-proposal-v0",
  reasoning_summary: "fixed deterministic replication harness output",
  relevant_memory_refs: [] as readonly string[],
  considered_context_refs: [] as readonly string[],
  current_intent: null as string | null,
  confidence: 0.5,
  uncertainty: 0.5,
  action_intent: null,
  evidence_refs: [] as readonly string[]
});

function createStageMinter(world: World): {
  core(): unknown;
  capabilities(bindings: unknown): unknown;
} {
  return createMiclStageMinter(
    world.assembly.facade as never,
    new InMemoryMiclWorkflowStore(),
    {
      micl_id: `micl-cog-replication-v1-${Math.floor(Math.random() * 1e9)}` as never,
      micl_request_fingerprint: "sha256:canonical-affect-behavior-influence-replication-v1" as never,
      stage_key: "OBSERVATION" as never
    }
  ) as unknown as { core(): unknown; capabilities(bindings: unknown): unknown };
}

/** Captures one production V2 provider input through the frozen executor. */
export async function runCognitionCapture(
  world: World,
  allowedActions: readonly AllowedAction[]
): Promise<{ readonly provider_input: unknown; readonly proposal: Record<string, unknown> }> {
  const captured: unknown[] = [];
  const minter = createStageMinter(world);
  const executor = new CognitionActionTransitionExecutor({
    cognitionProvider: {
      propose: async (projection: unknown) => {
        captured.push(structuredClone(projection));
        return { ...FAKE_OUTPUT, projection_hash: (projection as { projection_hash: string }).projection_hash };
      }
    },
    subjectCore: minter.core(),
    retrieval: { retrieve: async () => { throw new Error("REPLICATION_V1: cognition must not call retrieval"); } },
    factualEvidenceResolver: null,
    producerAuthorizationIssuer: world.issuer
  } as never);
  const snapshot = await readSnapshot(world);
  const result = await executor.execute(
    contextOf(snapshot),
    { cause_refs: [], allowed_actions: allowedActions } as never,
    minter.capabilities(await currentBindings(world.repo, snapshot)) as never
  );
  check(result.outcome.kind === "NO_OP" || result.outcome.kind === "COMMITTED", `cognition terminal outcome: ${result.outcome.kind}`);
  check(captured.length === 1, "exactly one provider input must be captured");
  return {
    provider_input: captured[0],
    proposal: result.cognition as unknown as Record<string, unknown>
  };
}

function projectionHashBody(providerInput: unknown, canonicalAffect: unknown): Record<string, unknown> {
  const projection = providerInput as Record<string, unknown>;
  const body: Record<string, unknown> = { ...projection };
  delete body["schema_version"];
  delete body["allowed_actions"];
  delete body["projection_hash"];
  body["canonical_affect"] = canonicalAffect;
  return body;
}

/** Pure EXPERIMENTAL_ABLATION_ONLY transform with the hash promise awaited. */
export async function ablateProviderInput(providerInput: unknown): Promise<unknown> {
  const projection = providerInput as Record<string, unknown>;
  check(projection["schema_version"] === COGNITIVE_CONTEXT_PROJECTION_V2_SCHEMA_VERSION, "ablation requires V2 projection");
  const neutral = projectCanonicalAffectForCognitionV0({
    schema_version: "canonical-affect-v0",
    valence: 0,
    activation: 0.2
  } as never) as CanonicalAffectCognitionProjectionV0;
  const body = projectionHashBody(providerInput, { ...neutral });
  const projectionHash = await cognitiveProjectionHash(body);
  check(typeof projectionHash === "string", "ablation projection hash must be a resolved string");
  return Object.freeze({
    ...body,
    schema_version: projection["schema_version"],
    allowed_actions: projection["allowed_actions"],
    projection_hash: projectionHash
  });
}

export async function recomputeProviderInputProjectionHash(providerInput: unknown): Promise<string> {
  const projection = providerInput as Record<string, unknown>;
  return cognitiveProjectionHash(projectionHashBody(providerInput, projection["canonical_affect"]));
}

export function containsPromiseLike(value: unknown): boolean {
  if (value !== null && typeof value === "object" && typeof (value as { then?: unknown }).then === "function") return true;
  if (typeof value === "string" && (value.includes("[object Promise]") || value.includes("Promise {"))) return true;
  if (Array.isArray(value)) return value.some(containsPromiseLike);
  if (value !== null && typeof value === "object") return Object.values(value as Record<string, unknown>).some(containsPromiseLike);
  return false;
}
