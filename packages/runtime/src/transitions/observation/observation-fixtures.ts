/**
 * P2.3.3.3 — shared Observation test fixtures (test-only helpers; NOT part of the
 * public runtime surface). All stacks run against the SANCTIONED in-memory facade
 * assembly — the raw store/journal are never imported here (P0-2 boundary).
 */

import {
  createInMemorySubjectCoreFacade,
  proposalFingerprint,
  type CanonicalTransitionProposalV1,
  type InMemoryFacadeAssembly,
  type ProducerAuthorizationIssuer,
  type ReadOnlyStoreHandle,
  type SubjectStateV0,
  type CanonicalRefV0
} from "@characteros-next/subject-core";
import {
  InMemoryMemoryRepository,
  InMemoryRetrievalService,
  type MemoryRetrievalQueryV0,
  type MemoryRetrievalResultV0,
  type PreparedRevisionV0
} from "@characteros-next/memory";
import { RuntimeCompositionRoot } from "../../composition/runtime-composition-root.js";
import { ReferenceContextProducer, buildContextDelta } from "../../ports/context-producer-port.js";
import type { AffectProducerPort } from "../../ports/affect-producer-port.js";
import type { AppraisalPort } from "../../ports/appraisal-port.js";
import type { ContextProducerPort } from "../../ports/context-producer-port.js";
import type { InterpretationPort } from "../../ports/interpretation-port.js";
import type { RetrievalMetadataProducerPort } from "../../ports/retrieval-metadata-producer-port.js";
import type { SubjectCorePort } from "../../ports/subject-core-port.js";
import type { RuntimeContext } from "../../types/runtime-context.js";
import type { TransitionCapabilities } from "../time/time-transition-executor.js";
import { ObservationTransitionExecutor, buildObservationProposal } from "./observation-transition-executor.js";
import type { ObservationInputV0 } from "./types.js";

export const HASH_V1_R0_REPOSITORY =
  "sha256:85755634de984070ca6c12d5dd01fb545e0efea635000e0e0044c589f3fcbb00";

export const R0_BINDINGS: ReadonlyArray<{
  repository_revision: string;
  repository_revision_hash: string;
}> = [
  { repository_revision: "R0", repository_revision_hash: HASH_V1_R0_REPOSITORY }
];

export function s0(): Record<string, unknown> {
  return {
    schema_version: "subject-state-v0",
    identity: {
      subject_id: "subject-s0",
      display_name: "",
      origin_metadata: { creation_source: null, seed_version: null },
      identity_anchors: [],
      self_schema_seed_refs: []
    },
    traits_seed: { dimensions: {} },
    memory_state: {
      working_refs: [],
      active_episode_refs: [],
      autobiographical_index_revision: null,
      repository_revision: "R0",
      consolidation_cursor: null,
      retrieval_config: {
        profile_id: "RETRIEVAL_V0",
        affect_congruence_enabled: false,
        recent_trace_capacity: 64
      },
      recent_retrieval_trace: [],
      lifecycle_metadata: {},
      pending_encoding_refs: [],
      last_retrieval_at: null
    },
    beliefs: { items: [] },
    relationships: { models: [] },
    mood: { baseline: 0, generated_under_profile: null, last_update: null },
    affect: { active_channels: [], generated_under_profile: null, updated_at: null },
    regulation: { energy: 1, stress: 0, arousal: 0.5, fatigue: 0, last_update: null },
    context: {
      scene: "idle",
      task: null,
      focus_refs: [],
      active_entity_refs: [],
      environment_refs: ["environment:room-1"],
      current_observation_ref: null
    },
    mechanism_config: {
      affect_profile: { profile_id: "FAST_EMA_V0", timebase: "legacy_tick" },
      legacy_reference_defaults: { tHold: 60, alpha: 0.06, tau: 150, clamp: 0.25 },
      feature_flags: {},
      thresholds: {}
    },
    trace_window: {
      trace_window_schema_version: "trace-window-v1",
      capacity: 64,
      cursor: { last_history_sequence: 0, offloaded_through_sequence: 0, offloaded_through_trace_ref: null },
      entries: []
    },
    runtime_metadata: {
      subject_version: "subject-v0",
      state_revision: 0,
      logical_time: 0,
      last_transition_time: null,
      last_transition_type: null,
      created_at: 0,
      updated_at: 0
    }
  };
}

/** Facade-backed SubjectCorePort + read-only store handle for assertions. */
export interface FacadeSubjectCore extends SubjectCorePort {
  readonly storeRead: ReadOnlyStoreHandle;
}

export class RealEngineCoreAdapter implements FacadeSubjectCore {
  readonly storeRead: ReadOnlyStoreHandle;
  /** Trusted issuer wired into the facade verifier (ATTACK D closure). */
  readonly producerAuthorizationIssuer: ProducerAuthorizationIssuer;
  private readonly assembly: InMemoryFacadeAssembly;
  private readonly initial: SubjectStateV0;
  private readonly frozenView: boolean;

  constructor(initial: SubjectStateV0, options: { frozenView?: boolean } = {}) {
    this.initial = initial;
    this.frozenView = options.frozenView ?? false;
    this.assembly = createInMemorySubjectCoreFacade({
      seedSnapshots: new Map([["subject-s0" as never, initial]]),
      // Explicit prepared-record gate (fail closed): only the fixture's trusted ref.
      preparedResultValidator: async (binding) =>
        binding.prepared_result_ref === "workflow:w-obs-1"
    });
    this.storeRead = this.assembly.storeRead;
    this.producerAuthorizationIssuer = this.assembly.producerAuthorizationIssuer;
  }

  async reserveAndRoute(
    proposal: Parameters<SubjectCorePort["reserveAndRoute"]>[0]
  ): Promise<Awaited<ReturnType<SubjectCorePort["reserveAndRoute"]>>> {
    return this.assembly.facade.reserveAndRoute(proposal);
  }

  async commitReserved(
    input: Parameters<SubjectCorePort["commitReserved"]>[0]
  ): Promise<Awaited<ReturnType<SubjectCorePort["commitReserved"]>>> {
    return this.assembly.facade.commitReserved(input);
  }

  async terminalizeReservedNoOp(
    input: Parameters<SubjectCorePort["terminalizeReservedNoOp"]>[0]
  ): Promise<Awaited<ReturnType<SubjectCorePort["terminalizeReservedNoOp"]>>> {
    return this.assembly.facade.terminalizeReservedNoOp(input);
  }

  async reconcile(
    transitionId: Parameters<SubjectCorePort["reconcile"]>[0],
    subjectId: Parameters<SubjectCorePort["reconcile"]>[1],
    fingerprint: Parameters<SubjectCorePort["reconcile"]>[2]
  ): Promise<Awaited<ReturnType<SubjectCorePort["reconcile"]>>> {
    return this.assembly.facade.reconcile(transitionId, subjectId, fingerprint);
  }

  async readCurrentSnapshot(
    subjectId: string
  ): Promise<SubjectStateV0 | null> {
    if (this.frozenView) return this.initial;
    const bundle = this.storeRead.readCurrentBundle(subjectId);
    return bundle !== null ? bundle.next_snapshot : this.initial;
  }
}

export function observationInput(overrides: Record<string, unknown> = {}): ObservationInputV0 {
  return {
    schema_version: "observation-input-v0",
    subject_id: "subject-s0",
    observation_id: "observation:o-77",
    occurrence_logical_time: 0,
    source_refs: ["event:v-2", "source:s-3"],
    entity_refs: ["entity:e-1", "subject:s0"],
    ...overrides
  } as unknown as ObservationInputV0;
}

export function fixedInterpretation(evidenceRefs?: readonly string[]): InterpretationPort {
  return {
    interpret: async (view) =>
      ({
        schema_version: "interpretation-proposal-v0",
        interpretation_ref: `result:interp-${view.observation_id.replace(":", "-")}`,
        projection_hash: view.projection_hash,
        evidence_refs:
          evidenceRefs ??
          view.retrieval_result?.selected_memory_refs ??
          ([] as readonly CanonicalRefV0[])
      }) as never
  };
}

export function fixedAppraisal(score: number, evidenceRefs?: readonly string[]): AppraisalPort {
  return {
    appraise: async (view) =>
      ({
        schema_version: "appraisal-v0",
        appraisal_ref: `appraisal:ap-${view.observation_id.replace(":", "-")}`,
        evidence_refs: evidenceRefs ?? view.retrieval_result?.selected_memory_refs ?? [],
        relevance: score,
        goal_congruence: score,
        attribution: score,
        controllability: score,
        uncertainty: score,
        intensity: score
      }) as never
  };
}

export function fixedAffectProducer(): AffectProducerPort {
  return {
    produceAffectDelta: async () =>
      ({
        producer: "affect",
        domain: "affect",
        expected_repository_revision: null,
        operations: [
          {
            path: "/affect",
            value: { active_channels: [], generated_under_profile: null, updated_at: null }
          },
          { path: "/mood", value: { baseline: 0.1, generated_under_profile: null, last_update: null } }
        ],
        provenance_refs: []
      }) as never
  };
}

export function retrievalService(empty = false): InMemoryRetrievalService {
  return new InMemoryRetrievalService({
    rehearsals: empty
      ? [
          {
            repository_revision: "R0" as never,
            semantic_reference: "observation:o-unmatched" as never,
            selected_memory_refs: [] as never,
            evidence: [] as never,
            candidate_count: 0,
            retrieval_trace_ref: null
          }
        ]
      : [
          {
            repository_revision: "R0" as never,
            semantic_reference: "observation:o-77" as never,
            selected_memory_refs: ["episode:e-9"] as never,
            evidence: [
              { episode_ref: "episode:e-9", reasons: [{ dimension: "CONTEXT", score: 0.7 }] }
            ] as never,
            candidate_count: 1,
            retrieval_trace_ref: "retrieval-trace:rt-77" as never
          }
        ]
  });
}

export class SpyMemoryRepository extends InMemoryMemoryRepository {
  prepareCalls = 0;
  readCalls = 0;
  override async prepareRevision(): Promise<PreparedRevisionV0> {
    this.prepareCalls += 1;
    throw new Error("memory write must never happen during Observation");
  }

  override async readManifest(): Promise<never> {
    this.readCalls += 1;
    throw new Error("memory reads must never happen during Observation");
  }
}

/**
 * Host-side capability minting (Round-3 B1 closure): the prepared binding must
 * carry the AUTHORITATIVE payload fingerprint recomputed from the exact proposal
 * the executor will submit — SubjectCore compares it against the reservation and
 * rejects all-zero or foreign fingerprints fail-closed.
 */
export async function capabilitiesFor(
  proposal: CanonicalTransitionProposalV1
): Promise<TransitionCapabilities> {
  return {
    preparedBinding: {
      prepared_result_ref: "workflow:w-obs-1" as CanonicalRefV0,
      transition_id: proposal.transition_id,
      subject_id: proposal.subject_id,
      transition_type: proposal.transition_type,
      payload_fingerprint: await proposalFingerprint(proposal)
    },
    repository_bindings: R0_BINDINGS as never
  };
}

/**
 * Honest capabilities for the DEFAULT observation harness (s0 snapshot +
 * observationInput + fixed affect producer + reference context delta) — mirrors
 * exactly what the executor assembles, byte for byte.
 */
export async function observationCapabilities(): Promise<TransitionCapabilities> {
  const snapshot = s0() as unknown as SubjectStateV0;
  const observation = observationInput();
  const affectDelta = await fixedAffectProducer().produceAffectDelta({
    context: { subject_id: "subject-s0", current_logical_time: 0, state_revision: 0 } as never,
    snapshot,
    transition_type: "Observation",
    appraisal: null,
    elapsed_ticks: null
  });
  const contextDelta = await buildContextDelta(observation, snapshot);
  return capabilitiesFor(
    await buildObservationProposal({
      subjectId: "subject-s0",
      stateRevision: 0,
      observation,
      deltas: [affectDelta, contextDelta]
    })
  );
}

export interface ObservationHarnessOptions {
  readonly emptyRetrieval?: boolean;
  readonly failingRetrieval?: boolean;
  readonly failingInterpretation?: boolean;
  readonly failingAppraisal?: boolean;
  readonly failingAffect?: boolean;
  readonly failingContextDelta?: boolean;
  readonly memory?: SpyMemoryRepository;
  /** Explicit affect producer override (P2.3.4.1: real reference producer wiring). */
  readonly affectProducer?: AffectProducerPort;
  /**
   * Explicit context producer override (Round-3 B5: actually honored now —
   * takes precedence over failingContextDelta and the reference default).
   */
  readonly contextProducer?: ContextProducerPort;
  readonly retrievalMetadataProducer?: RetrievalMetadataProducerPort | null;
  readonly interpretationEvidence?: readonly string[];
  /** Explicit interpretation port (overrides failingInterpretation/interpretationEvidence). */
  readonly interpretation?: InterpretationPort;
  readonly appraisalScore?: number;
  readonly appraisalEvidence?: readonly string[];
  readonly retrieval?: {
    retrieve(query: MemoryRetrievalQueryV0): Promise<MemoryRetrievalResultV0>;
  };
}

export interface ObservationHarness {
  readonly core: RealEngineCoreAdapter;
  readonly memory: SpyMemoryRepository;
  readonly root: RuntimeCompositionRoot;
  readonly ctx: RuntimeContext;
  readonly executor: ObservationTransitionExecutor;
  readonly initial: SubjectStateV0;
}

export function buildObservationHarness(
  overrides: ObservationHarnessOptions = {}
): ObservationHarness {
  const initial = s0() as unknown as SubjectStateV0;
  const core = new RealEngineCoreAdapter(initial);
  const memory = overrides.memory ?? new SpyMemoryRepository();
  const retrieval =
    overrides.retrieval ??
    (overrides.failingRetrieval === true
      ? {
          retrieve: async () => {
            throw new Error("retrieval engine offline");
          }
        }
      : retrievalService(overrides.emptyRetrieval ?? false));
  const root = new RuntimeCompositionRoot({
    subjectCore: core,
    producerAuthorizationIssuer: core.producerAuthorizationIssuer,
    memoryRepository: memory,
    retrieval,
    interpretation:
      overrides.interpretation ??
      (overrides.failingInterpretation === true
        ? {
            interpret: async () => {
              throw new Error("interpretation provider offline");
            }
          }
        : fixedInterpretation(overrides.interpretationEvidence)),
    appraisal:
      overrides.failingAppraisal === true
        ? {
            appraise: async () => {
              throw new Error("appraisal provider offline");
            }
          }
        : fixedAppraisal(overrides.appraisalScore ?? 0.9, overrides.appraisalEvidence),
    affectProducer:
      overrides.affectProducer ??
      (overrides.failingAffect === true
        ? {
            produceAffectDelta: async () => {
              throw new Error("affect producer offline");
            }
          }
        : fixedAffectProducer()),
    contextProducer:
      overrides.contextProducer ??
      (overrides.failingContextDelta === true
        ? {
            produceControlledProjection: async (input, assembly) =>
              new ReferenceContextProducer().produceControlledProjection(input, assembly),
            produceContextDelta: async () => {
              throw new Error("context producer offline");
            }
          }
        : new ReferenceContextProducer()),
    ...(overrides.retrievalMetadataProducer !== null &&
    overrides.retrievalMetadataProducer !== undefined
      ? { retrievalMetadataProducer: overrides.retrievalMetadataProducer }
      : {})
  });
  const ctx: RuntimeContext = {
    subject_id: "subject-s0" as never,
    current_logical_time: 0 as never,
    state_revision: 0 as never
  };
  return {
    core,
    memory,
    root,
    ctx,
    executor: new ObservationTransitionExecutor(root.dependencies()),
    initial
  };
}
