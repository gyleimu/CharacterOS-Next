/**
 * P2.3.2 — TimeTransitionExecutor tests.
 * Wires the REAL subject-core engine + in-memory atomic store + real memory repository
 * behind SubjectCorePort, injects deterministic fake affect/regulation producers and
 * trusted session facts, and proves: normal elapsed commit, elapsed=0 NO_OP, logical
 * time anchoring (drift rejects), commit failure propagation (stale/CAS conflict), and
 * producer failure fail-closed with nothing committed.
 */

import { describe, expect, it } from "vitest";

import {
  createCommitEngine,
  InMemoryAtomicCommitStore,
  type AtomicCommitStorePort,
  type CommitEngine,
  type CommitTransitionInput,
  type CommitTransitionOutcome,
  type SubjectStateV0,
  type CanonicalRefV0,
  type RepositoryRevisionBindingV1,
  type HashV1
} from "@characteros-next/subject-core";
import { InMemoryMemoryRepository } from "@characteros-next/memory";
import { RuntimeCompositionRoot } from "../../composition/runtime-composition-root.js";
import type { SubjectCorePort } from "../../ports/subject-core-port.js";
import type { AffectProducerPort } from "../../ports/affect-producer-port.js";
import type { RegulationProducerPort } from "../../ports/regulation-producer-port.js";
import type { RuntimeContext } from "../../types/runtime-context.js";
import {
  TimeTransitionExecutor,
  type TransitionSessionFacts
} from "./time-transition-executor.js";

const HASH_V1_R0_REPOSITORY = "sha256:85755634de984070ca6c12d5dd01fb545e0efea635000e0e0044c589f3fcbb00";

const R0_BINDINGS = [
  { repository_revision: "R0", repository_revision_hash: HASH_V1_R0_REPOSITORY }
] as unknown as RepositoryRevisionBindingV1[];

function s0(): Record<string, unknown> {
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
      environment_refs: [],
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

/** Real engine + store behind the runtime SubjectCorePort seam. */
class RealEngineCoreAdapter implements SubjectCorePort {
  readonly store: InMemoryAtomicCommitStore;
  private readonly engine: CommitEngine;
  private readonly initial: SubjectStateV0;
  /** When true, readCurrentSnapshot keeps returning the initial view (stale scenario). */
  constructor(initial: SubjectStateV0, frozenView = false) {
    this.initial = initial;
    this.store = new InMemoryAtomicCommitStore();
    this.engine = createCommitEngine({ store: this.store });
    this.frozenView = frozenView;
  }

  private readonly frozenView: boolean;

  async commit(input: CommitTransitionInput): Promise<CommitTransitionOutcome> {
    return this.engine.commitTransition(input);
  }

  async readCurrentSnapshot(subjectId: string): Promise<SubjectStateV0 | null> {
    if (this.frozenView) return this.initial;
    const bundles = this.store.getCommittedBundles().filter((bundle) => bundle.subject_id === subjectId);
    const last = bundles[bundles.length - 1];
    return last !== undefined ? last.next_snapshot : this.initial;
  }
}

function fakeAffectProducer(): AffectProducerPort {
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
          { path: "/mood", value: { baseline: 0.05, generated_under_profile: null, last_update: null } }
        ],
        provenance_refs: []
      }) as never
  };
}

function fakeRegulationProducer(): RegulationProducerPort {
  return {
    produceRegulationDelta: async () =>
      ({
        producer: "regulation",
        domain: "regulation",
        expected_repository_revision: null,
        operations: [
          {
            path: "/regulation",
            value: { energy: 1, stress: 0.2, arousal: 0.5, fatigue: 0, last_update: null }
          }
        ],
        provenance_refs: []
      }) as never
  };
}

function session(overrides: Partial<TransitionSessionFacts> = {}): TransitionSessionFacts {
  return {
    identity_record_version_before: 0,
    first_seen_sequence: 1,
    prior_attempts: [],
    previous_commit_ref: null,
    previous_record_checksum: null,
    prepared_result_ref: "workflow:w-time-1" as CanonicalRefV0,
    repository_bindings: R0_BINDINGS,
    reference_validator: async () => true,
    ...overrides
  };
}

function ctxOf(snapshot: SubjectStateV0): RuntimeContext {
  return {
    subject_id: snapshot.identity.subject_id,
    current_logical_time: snapshot.runtime_metadata.logical_time,
    state_revision: snapshot.runtime_metadata.state_revision
  };
}

function buildExecutor(overrides: {
  frozenView?: boolean;
  affect?: AffectProducerPort;
  regulation?: RegulationProducerPort;
  repo?: InMemoryMemoryRepository;
} = {}) {
  const initial = s0() as unknown as SubjectStateV0;
  const core = new RealEngineCoreAdapter(initial, overrides.frozenView ?? false);
  const root = new RuntimeCompositionRoot({
    subjectCore: core,
    memoryRepository: overrides.repo ?? new InMemoryMemoryRepository(),
    retrieval: {
      retrieve: async () => {
        throw new Error("Time must never call retrieval");
      }
    },
    affectProducer: overrides.affect ?? fakeAffectProducer(),
    regulationProducer: overrides.regulation ?? fakeRegulationProducer()
  });
  return { core, executor: new TimeTransitionExecutor(root.dependencies()), initial };
}

const ELAPSED_FIVE: Parameters<TimeTransitionExecutor["execute"]>[1] = { elapsed_ticks: 5 };

describe("TimeTransitionExecutor", () => {
  it("commits a normal elapsed run: +1 revision, logical time advanced, trace present", async () => {
    const { core, executor, initial } = buildExecutor();
    const outcome = await executor.execute(ctxOf(initial), ELAPSED_FIVE, session());
    expect(outcome.kind).toBe("COMMITTED");
    if (outcome.kind !== "COMMITTED") return;
    expect(outcome.bundle.next_revision).toBe(1);
    expect(outcome.bundle.logical_time_after).toBe(5);
    expect(outcome.bundle.logical_time_before).toBe(0);
    expect(outcome.bundle.canonical_result.status).toBe("COMMITTED");
    expect(outcome.bundle.next_snapshot.runtime_metadata.last_transition_type).toBe("Time");
    expect(outcome.bundle.next_snapshot.runtime_metadata.created_at).toBe(0);
    expect(core.store.currentRevision("subject-s0")).toBe(1);
    expect(core.store.getCommittedBundles()).toHaveLength(1);
  });

  it("anchors derived times to the canonical clock, never caller wall values", async () => {
    const { executor, initial } = buildExecutor();
    const outcome = await executor.execute(ctxOf(initial), ELAPSED_FIVE, session());
    expect(outcome.kind).toBe("COMMITTED");
    if (outcome.kind === "COMMITTED") {
      expect(outcome.bundle.logical_time_after).toBe(5); // 0 + 5, not any wall clock
    }
  });

  it("rejects runtime context drift against the authoritative snapshot", async () => {
    const { core, executor, initial } = buildExecutor();
    const drifting = { ...ctxOf(initial), current_logical_time: 999 as never };
    await expect(executor.execute(drifting, ELAPSED_FIVE, session())).rejects.toThrow(/drift/);
    expect(core.store.getCommittedBundles()).toHaveLength(0);
  });

  it("routes elapsed=0 to NO_OP with zero deltas and zero commits", async () => {
    const { core, executor, initial } = buildExecutor();
    const outcome = await executor.execute(ctxOf(initial), { elapsed_ticks: 0 }, session());
    expect(outcome.kind).toBe("NO_OP");
    expect(core.store.getCommittedBundles()).toHaveLength(0);
    expect(core.store.currentRevision("subject-s0")).toBeNull();
  });

  it("routes elapsed=0 to NO_OP even after prior commits (fresh authority, no new commit)", async () => {
    const { core, executor, initial } = buildExecutor();
    await executor.execute(ctxOf(initial), ELAPSED_FIVE, session());
    const advanced = (await core.readCurrentSnapshot("subject-s0")) as SubjectStateV0;
    const outcome = await executor.execute(ctxOf(advanced), { elapsed_ticks: 0 }, session());
    expect(outcome.kind).toBe("NO_OP");
    expect(core.store.getCommittedBundles()).toHaveLength(1); // unchanged
  });

  it("propagates commit failures (CAS conflict via stale authority) verbatim", async () => {
    const { executor, initial } = buildExecutor({ frozenView: true });
    await executor.execute(ctxOf(initial), ELAPSED_FIVE, session());
    const second = await executor.execute(ctxOf(initial), ELAPSED_FIVE, session());
    expect(second.kind).toBe("REJECTED");
    if (second.kind === "REJECTED") {
      expect(second.failure.error_code).toBe("COMMIT_CONFLICT");
    }
  });

  it("fails closed when the affect producer fails (nothing committed)", async () => {
    const failing: AffectProducerPort = {
      produceAffectDelta: async () => {
        throw new Error("affect engine offline");
      }
    };
    const { core, executor, initial } = buildExecutor({ affect: failing });
    await expect(executor.execute(ctxOf(initial), ELAPSED_FIVE, session())).rejects.toThrow(
      /affect producer failed/
    );
    expect(core.store.getCommittedBundles()).toHaveLength(0);
  });

  it("fails closed when the regulation producer fails (nothing committed)", async () => {
    const failing: RegulationProducerPort = {
      produceRegulationDelta: async () => {
        throw new Error("regulation engine offline");
      }
    };
    const { core, executor, initial } = buildExecutor({ regulation: failing });
    await expect(executor.execute(ctxOf(initial), ELAPSED_FIVE, session())).rejects.toThrow(
      /regulation producer failed/
    );
    expect(core.store.getCommittedBundles()).toHaveLength(0);
  });

  it("admits raw elapsed ticks fail-closed before any commit attempt", async () => {
    const { core, executor, initial } = buildExecutor();
    await expect(
      executor.execute(ctxOf(initial), { elapsed_ticks: -1 }, session())
    ).rejects.toThrow(/INVALID_LOGICAL_TIME/);
    await expect(
      executor.execute(ctxOf(initial), { elapsed_ticks: 1.5 }, session())
    ).rejects.toThrow(/INVALID_SCHEMA/);
    await expect(
      executor.execute(ctxOf(initial), { elapsed_ticks: Number.MAX_SAFE_INTEGER + 1 }, session())
    ).rejects.toThrow(/INVALID_LOGICAL_TIME/);
    expect(core.store.getCommittedBundles()).toHaveLength(0);
  });

  it("never touches retrieval or memory capability on the commit path", async () => {
    const retrievalCalls: string[] = [];
    const initial = s0() as unknown as SubjectStateV0;
    const core = new RealEngineCoreAdapter(initial);
    const root = new RuntimeCompositionRoot({
      subjectCore: core,
      memoryRepository: new InMemoryMemoryRepository(),
      retrieval: {
        retrieve: async () => {
          retrievalCalls.push("retrieve");
          throw new Error("should never be reached");
        }
      },
      affectProducer: fakeAffectProducer(),
      regulationProducer: fakeRegulationProducer()
    });
    const executor = new TimeTransitionExecutor(root.dependencies());
    const outcome = await executor.execute(ctxOf(initial), ELAPSED_FIVE, session());
    expect(outcome.kind).toBe("COMMITTED");
    expect(retrievalCalls).toEqual([]);
  });
});
