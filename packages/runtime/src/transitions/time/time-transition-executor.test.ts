/**
 * P2.3.2 (P0-1/P0-6 remediated) — TimeTransitionExecutor tests.
 * Runs against the SANCTIONED in-memory facade assembly (no raw store imports).
 */

import { describe, expect, it } from "vitest";

import type { SubjectStateV0 } from "@characteros-next/subject-core";
import type { MemoryRepository } from "@characteros-next/memory";
import type { RuntimeContext } from "../../types/runtime-context.js";
import { RuntimeCompositionRoot } from "../../composition/runtime-composition-root.js";
import {
  RealEngineCoreAdapter,
  capabilitiesFor
} from "../observation/observation-fixtures.js";
import { TimeTransitionExecutor, type TimeTransitionInputV0 } from "./time-transition-executor.js";

function s0Subject(): { subjectId: string; initial: ConstructorParameters<typeof RealEngineCoreAdapter>[0] } {
  const fixture = JSON.parse(
    JSON.stringify({
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
    })
  ) as ConstructorParameters<typeof RealEngineCoreAdapter>[0];
  return { subjectId: "subject-s0", initial: fixture };
}

function ctxOf(initial: SubjectStateV0): RuntimeContext {
  return {
    subject_id: "subject-s0" as never,
    current_logical_time: initial.runtime_metadata.logical_time as never,
    state_revision: initial.runtime_metadata.state_revision as never
  };
}

const ELAPSED_FIVE: TimeTransitionInputV0 = { elapsed_ticks: 5 };

class MemoryRepositoryStub implements MemoryRepository {
  async prepareRevision(): Promise<never> {
    throw new Error("Time never prepares revisions");
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

function fixedAffect() {
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

function fixedRegulation() {
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

function buildExecutor(overrides: { frozenView?: boolean; failingAffect?: boolean } = {}) {
  const { initial } = s0Subject();
  const core = new RealEngineCoreAdapter(initial, { frozenView: overrides.frozenView ?? false });
  const root = new RuntimeCompositionRoot({
    subjectCore: core,
    memoryRepository: new MemoryRepositoryStub(),
    retrieval: {
      retrieve: async () => {
        throw new Error("Time must never call retrieval");
      }
    },
    affectProducer:
      overrides.failingAffect === true
        ? {
            produceAffectDelta: async () => {
              throw new Error("affect engine offline");
            }
          }
        : fixedAffect(),
    regulationProducer: fixedRegulation()
  });
  return { core, executor: new TimeTransitionExecutor(root.dependencies()), initial };
}

describe("TimeTransitionExecutor", () => {
  it("commits a normal elapsed run: +1 revision, logical time advanced, trace present", async () => {
    const { core, executor, initial } = buildExecutor();
    const outcome = await executor.execute(
      ctxOf(initial),
      ELAPSED_FIVE,
      capabilitiesFor("t-time-subject-s0-r0-e5")
    );
    expect(outcome.kind).toBe("COMMITTED");
    if (outcome.kind !== "COMMITTED") return;
    expect(outcome.bundle.next_revision).toBe(1);
    expect(outcome.bundle.logical_time_after).toBe(5);
    expect(outcome.bundle.logical_time_before).toBe(0);
    expect(outcome.bundle.canonical_result.status).toBe("COMMITTED");
    expect(outcome.bundle.next_snapshot.runtime_metadata.last_transition_type).toBe("Time");
    expect(outcome.bundle.next_snapshot.runtime_metadata.created_at).toBe(0);
    expect(core.storeRead.currentRevision("subject-s0")).toBe(1);
    expect(core.storeRead.getCommittedBundles()).toHaveLength(1);
  });

  it("anchors derived times to the canonical clock, never caller wall values", async () => {
    const { executor, initial } = buildExecutor();
    const outcome = await executor.execute(ctxOf(initial), ELAPSED_FIVE, capabilitiesFor("t-anchor"));
    if (outcome.kind !== "COMMITTED") throw new Error("expected COMMITTED");
    expect(outcome.bundle.logical_time_after).toBe(5); // 0 + 5, not any wall clock
  });

  it("rejects runtime context drift against the authoritative snapshot", async () => {
    const { core, executor, initial } = buildExecutor();
    const drifting = { ...ctxOf(initial), current_logical_time: 999 as never };
    await expect(executor.execute(drifting, ELAPSED_FIVE, capabilitiesFor("t-drift"))).rejects.toThrow(/drift/);
    expect(core.storeRead.getCommittedBundles()).toHaveLength(0);
  });

  it("routes elapsed=0 to NO_OP with zero commits", async () => {
    const { core, executor, initial } = buildExecutor();
    const outcome = await executor.execute(ctxOf(initial), { elapsed_ticks: 0 }, capabilitiesFor("t-zero"));
    expect(outcome.kind).toBe("NO_OP");
    expect(core.storeRead.getCommittedBundles()).toHaveLength(0);
    expect(core.storeRead.currentRevision("subject-s0")).toBeNull();
  });

  it("propagates authority-advance rejection verbatim when a NEW transition id races (stale at second call)", async () => {
    const { core, executor, initial } = buildExecutor({ frozenView: true });
    // Run A commits revision 1 (id ...e5).
    await executor.execute(ctxOf(initial), ELAPSED_FIVE, capabilitiesFor("t-cas-a"));
    // Run B proposes a DIFFERENT id (ticks 6) while still observing the frozen
    // revision-0 view. Subject-core RE-READS the latest authority on the second call
    // (expected 0 vs actual 1) → STALE_STATE_REVISION, propagated verbatim.
    const second = await executor.execute(ctxOf(initial), { elapsed_ticks: 6 }, capabilitiesFor("t-cas-b"));
    if (second.kind !== "REJECTED") throw new Error(`expected REJECTED, got ${second.kind}`);
    expect(second.failure.error_code).toBe("STALE_STATE_REVISION");
    expect(core.storeRead.getCommittedBundles()).toHaveLength(1);
  });

  it("same ID + same payload after commit replays ALREADY_COMMITTED without re-committing", async () => {
    const { core, executor, initial } = buildExecutor({ frozenView: true });
    await executor.execute(ctxOf(initial), ELAPSED_FIVE, capabilitiesFor("t-replay"));
    const replay = await executor.execute(ctxOf(initial), ELAPSED_FIVE, capabilitiesFor("t-replay"));
    expect(replay.kind).toBe("COMMITTED");
    expect(core.storeRead.getCommittedBundles()).toHaveLength(1);
    expect(core.storeRead.currentRevision("subject-s0")).toBe(1);
  });

  it("fails closed when the affect producer fails (nothing committed)", async () => {
    const { core, executor, initial } = buildExecutor({ failingAffect: true });
    await expect(executor.execute(ctxOf(initial), ELAPSED_FIVE, capabilitiesFor("t-fail"))).rejects.toThrow(
      /affect producer failed/
    );
    expect(core.storeRead.getCommittedBundles()).toHaveLength(0);
  });

  it("admits raw elapsed ticks fail-closed before any commit attempt", async () => {
    const { core, executor, initial } = buildExecutor();
    await expect(executor.execute(ctxOf(initial), { elapsed_ticks: -1 }, capabilitiesFor("t-neg"))).rejects.toThrow(
      /INVALID_LOGICAL_TIME/
    );
    await expect(executor.execute(ctxOf(initial), { elapsed_ticks: 1.5 }, capabilitiesFor("t-frac"))).rejects.toThrow(
      /INVALID_SCHEMA/
    );
    expect(core.storeRead.getCommittedBundles()).toHaveLength(0);
  });

  it("never touches retrieval on the commit path", async () => {
    let retrievalCalls = 0;
    const { initial } = s0Subject();
    const core = new RealEngineCoreAdapter(initial);
    const root = new RuntimeCompositionRoot({
      subjectCore: core,
      memoryRepository: new MemoryRepositoryStub(),
      retrieval: {
        retrieve: async () => {
          retrievalCalls += 1;
          throw new Error("should never be reached");
        }
      },
      affectProducer: fixedAffect(),
      regulationProducer: fixedRegulation()
    });
    const executor = new TimeTransitionExecutor(root.dependencies());
    const outcome = await executor.execute(ctxOf(initial), ELAPSED_FIVE, capabilitiesFor("t-noret"));
    if (outcome.kind !== "COMMITTED") throw new Error("expected COMMITTED");
    expect(retrievalCalls).toBe(0);
  });
});
