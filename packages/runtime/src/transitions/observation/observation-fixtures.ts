/**
 * P2.3.3.3 — shared Observation test fixtures (test-only helpers; NOT part of the
 * public runtime surface). Extracted so executor tests and conformance hardening
 * exercise exactly the same wiring.
 */

import {
  createCommitEngine,
  InMemoryAtomicCommitStore,
  type CommitEngine,
  type CommitTransitionInput,
  type CommitTransitionOutcome,
  type SubjectStateV0,
  type CanonicalRefV0,
  type RepositoryRevisionBindingV1
} from "@characteros-next/subject-core";
import {
  InMemoryMemoryRepository,
  InMemoryRetrievalService,
  type MemoryRetrievalQueryV0,
  type MemoryRetrievalResultV0,
  type PreparedRevisionV0
} from "@characteros-next/memory";
import { RuntimeCompositionRoot } from "../../composition/runtime-composition-root.js";
import type { SubjectCorePort } from "../../ports/subject-core-port.js";
import { ReferenceContextProducer } from "../../ports/context-producer-port.js";
import type { AffectProducerPort } from "../../ports/affect-producer-port.js";
import type { AppraisalPort } from "../../ports/appraisal-port.js";
import type { ContextProducerPort } from "../../ports/context-producer-port.js";
import type { InterpretationPort } from "../../ports/interpretation-port.js";
import type { RuntimeContext } from "../../types/runtime-context.js";
import type { TransitionSessionFacts } from "../time/time-transition-executor.js";
import { ObservationTransitionExecutor } from "./observation-transition-executor.js";
import type { ObservationInputV0 } from "./types.js";

export const HASH_V1_R0_REPOSITORY =
  "sha256:85755634de984070ca6c12d5dd01fb545e0efea635000e0e0044c589f3fcbb00";

export const R0_BINDINGS = [
  { repository_revision: "R0", repository_revision_hash: HASH_V1_R0_REPOSITORY }
] as unknown as RepositoryRevisionBindingV1[];

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

export class RealEngineCoreAdapter implements SubjectCorePort {
  readonly store: InMemoryAtomicCommitStore;
  private readonly engine: CommitEngine;
  private readonly initial: SubjectStateV0;

  constructor(initial: SubjectStateV0) {
    this.initial = initial;
    this.store = new InMemoryAtomicCommitStore();
    this.engine = createCommitEngine({ store: this.store });
  }

  async commit(input: CommitTransitionInput): Promise<CommitTransitionOutcome> {
    return this.engine.commitTransition(input);
  }

  async readCurrentSnapshot(subjectId: string): Promise<SubjectStateV0 | null> {
    const bundles = this.store.getCommittedBundles().filter((bundle) => bundle.subject_id === subjectId);
    const last = bundles[bundles.length - 1];
    return last !== undefined ? last.next_snapshot : this.initial;
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

export function fixedInterpretation(): InterpretationPort {
  return {
    interpret: async (view) =>
      ({
        interpretation_ref: `result:interp-${view.observation_id.replace(":", "-")}`
      }) as never
  };
}

export function fixedAppraisal(): AppraisalPort {
  return {
    appraise: async (view) =>
      ({
        appraisal_ref: `appraisal:ap-${view.observation_id.replace(":", "-")}`
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

/** Memory repository wrapped with write/read call counters (boundary proof). */
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

export function session(): TransitionSessionFacts {
  return {
    identity_record_version_before: 0,
    first_seen_sequence: 1,
    prior_attempts: [],
    previous_commit_ref: null,
    previous_record_checksum: null,
    prepared_result_ref: "workflow:w-obs-1" as CanonicalRefV0,
    repository_bindings: R0_BINDINGS,
    reference_validator: async () => true
  };
}

export interface ObservationHarnessOptions {
  readonly emptyRetrieval?: boolean;
  readonly failingRetrieval?: boolean;
  readonly failingInterpretation?: boolean;
  readonly failingAppraisal?: boolean;
  readonly failingAffect?: boolean;
  readonly failingContextDelta?: boolean;
  readonly memory?: SpyMemoryRepository;
  readonly contextProducer?: ContextProducerPort;
  readonly retrieval?: {
    retrieve: (query: MemoryRetrievalQueryV0) => Promise<MemoryRetrievalResultV0>;
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
    memoryRepository: memory,
    retrieval,
    interpretation:
      overrides.failingInterpretation === true
        ? {
            interpret: async () => {
              throw new Error("interpretation provider offline");
            }
          }
        : fixedInterpretation(),
    appraisal:
      overrides.failingAppraisal === true
        ? {
            appraise: async () => {
              throw new Error("appraisal provider offline");
            }
          }
        : fixedAppraisal(),
    affectProducer:
      overrides.failingAffect === true
        ? {
            produceAffectDelta: async () => {
              throw new Error("affect producer offline");
            }
          }
        : fixedAffectProducer(),
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
        : new ReferenceContextProducer())
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
