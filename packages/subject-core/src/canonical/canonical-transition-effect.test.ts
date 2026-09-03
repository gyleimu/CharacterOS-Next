/**
 * Shared canonical transition-effect primitives — regression suite
 * (CHARACTEROS_ATOMIC_COMMIT_CHAIN_VALIDATOR_V0 §9/§10/§46):
 * the extracted prepare/finalize primitives reproduce the production V1
 * engine's canonical effect EXACTLY (ONE_SHARED_IMPLEMENTATION), replay is
 * deterministic from the persisted proposal, NO_OP routing is preserved, and
 * guard rejections are unchanged.
 *
 * Fully OFFLINE: pure functions + a stub atomic store.
 */

import { describe, expect, it } from "vitest";

import {
  finalizeCanonicalTransitionEffectV0,
  prepareCanonicalTransitionEffectV0,
  replayCanonicalTransitionEffectV0
} from "./canonical-transition-effect.js";
import { createCommitEngine, type CommitEngine } from "../commit/engine.js";
import type { AtomicCommitBundleV1 } from "../types/persistence.js";
import type { AtomicCommitStorePort } from "../commit/store.js";
import type { CanonicalTransitionProposalV1 } from "../types/transition.js";
import type { SubjectStateV0 } from "../types/subject-state.js";

// ---- deterministic fixtures ---------------------------------------------------------

function baseState(stateRevision: number, logicalTime: number): SubjectStateV0 {
  return {
    schema_version: "subject-state-v3",
    identity: {
      subject_id: "subject-s0",
      display_name: "",
      origin_metadata: { creation_source: null, seed_version: null },
      identity_anchors: [],
      self_schema_seed_refs: []
    },
    traits_seed: { dimensions: {} },
    personality: { schema_version: "personality-state-v0", dimensions: [] },
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
    beliefs: { schema_version: "belief-state-v0", items: [] },
    relationships: { schema_version: "relationship-state-v0", counterparts: [] },
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
      cursor: {
        last_history_sequence: stateRevision,
        offloaded_through_sequence: 0,
        offloaded_through_trace_ref: null
      },
      entries: []
    },
    runtime_metadata: {
      subject_version: "subject-v0",
      state_revision: stateRevision,
      logical_time: logicalTime,
      last_transition_time: stateRevision === 0 ? null : logicalTime,
      last_transition_type: stateRevision === 0 ? null : "Relationship",
      created_at: 0,
      updated_at: logicalTime
    }
  } as unknown as SubjectStateV0;
}

function relationshipProposal(
  transitionId: string,
  expectedRevision: number,
  logicalTime: number,
  value: number
): CanonicalTransitionProposalV1 {
  return {
    schema_version: "canonical-transition-proposal-v1",
    transition_id: transitionId,
    subject_id: "subject-s0",
    transition_type: "Relationship",
    expected_state_revision: expectedRevision,
    time_input: { kind: "OCCURRENCE", occurrence_logical_time: logicalTime },
    cause_refs: [],
    domain_deltas: [
      {
        producer: "relationship",
        domain: "relationship",
        expected_repository_revision: null,
        operations: [
          {
            path: "/relationships",
            value: {
              schema_version: "relationship-state-v0",
              counterparts: [
                {
                  counterpart_ref: "entity:alice-like",
                  dimensions: [{ dimension_id: "arbitrary_host_dimension", value }]
                }
              ]
            }
          }
        ],
        provenance_refs: []
      }
    ],
    external_refs: []
  } as unknown as CanonicalTransitionProposalV1;
}

function stubStore(): { store: AtomicCommitStorePort; committed: AtomicCommitBundleV1[] } {
  const committed: AtomicCommitBundleV1[] = [];
  const store = {
    compareAndCommit: async (
      _revision: unknown,
      _identityVersion: unknown,
      bundle: AtomicCommitBundleV1
    ) => {
      committed.push(bundle);
      return { outcome: "COMMITTED", bundle } as const;
    }
  } as unknown as AtomicCommitStorePort;
  return { store, committed };
}

// ---- regression ---------------------------------------------------------------------

describe("Shared canonical transition-effect primitives", () => {
  it("reproduces the production engine's committed V2 effect EXACTLY (ONE_SHARED_IMPLEMENTATION)", async () => {
    const { store, committed } = stubStore();
    const engine: CommitEngine = createCommitEngine({ store });
    const predecessor = baseState(0, 0);
    const proposal = relationshipProposal("t-effect-001", 0, 0, 0.5);

    const outcome = await engine.commitTransition({
      proposal,
      currentState: predecessor,
      identity_record_version_before: 0,
      first_seen_sequence: 1,
      prior_attempts: [],
      previous_bundle: null,
      prepared_result_ref: "workflow:w-effect-001" as never,
      repository_bindings: [
        {
          repository_revision: "R0",
          repository_revision_hash: "sha256:4444444444444444444444444444444444444444444444444444444444444444"
        }
      ] as never
    });
    expect(outcome.kind).toBe("COMMITTED");
    if (outcome.kind !== "COMMITTED") return;
    const bundle = outcome.bundle;
    expect(committed).toHaveLength(1);
    expect(bundle.commit_version).toBe("atomic-commit-v2");

    // The SAME effect through the shared primitives:
    const prepared = await prepareCanonicalTransitionEffectV0({ predecessor, proposal });
    expect(prepared.kind).toBe("PREPARED");
    if (prepared.kind !== "PREPARED") return;
    const finalized = await finalizeCanonicalTransitionEffectV0({
      predecessor,
      proposal,
      draft: prepared.effect.draft,
      derived: prepared.effect.derived
    });
    expect(finalized.kind).toBe("FINALIZED");
    if (finalized.kind !== "FINALIZED") return;
    const effect = finalized.effect;

    expect(JSON.stringify(effect.successor)).toBe(JSON.stringify(bundle.next_snapshot));
    expect(effect.state_hash_before).toBe(bundle.state_hash_before);
    expect(effect.state_hash_after).toBe(bundle.state_hash_after);
    expect(effect.snapshot_hash_before).toBe(bundle.snapshot_hash_before);
    expect(effect.snapshot_hash_after).toBe(bundle.snapshot_hash_after);
    expect(JSON.stringify(effect.trace_entry)).toBe(JSON.stringify(bundle.trace_entry));
    expect(JSON.stringify(effect.trace_window)).toBe(JSON.stringify(bundle.trace_window));
    expect(effect.previous_trace_ref).toBe(bundle.mutation_history_link.previous_trace_ref);
    expect(effect.logical_time_before).toBe(bundle.logical_time_before);
    expect(effect.logical_time_after).toBe(bundle.logical_time_after);
    expect(effect.revision_after).toBe(bundle.next_revision);
  });

  it("replays the persisted proposal deterministically onto the predecessor", async () => {
    const predecessor = baseState(0, 0);
    const proposal = relationshipProposal("t-effect-002", 0, 0, 0.75);
    const prepared = await prepareCanonicalTransitionEffectV0({ predecessor, proposal });
    if (prepared.kind !== "PREPARED") throw new Error("fixture prepare failed");
    const finalized = await finalizeCanonicalTransitionEffectV0({
      predecessor,
      proposal,
      draft: prepared.effect.draft,
      derived: prepared.effect.derived
    });
    if (finalized.kind !== "FINALIZED") throw new Error("fixture finalize failed");

    const replay = await replayCanonicalTransitionEffectV0({ predecessor, proposal });
    expect(replay.kind).toBe("REPLAYED");
    if (replay.kind !== "REPLAYED") return;
    expect(JSON.stringify(replay.effect)).toBe(JSON.stringify(finalized.effect));

    // Second replay: identical result (pure, deterministic).
    const replay2 = await replayCanonicalTransitionEffectV0({ predecessor, proposal });
    if (replay2.kind !== "REPLAYED") throw new Error("fixture replay failed");
    expect(JSON.stringify(replay2.effect)).toBe(JSON.stringify(finalized.effect));
  });

  it("preserves NO_OP routing and guard rejections", async () => {
    const predecessor = baseState(0, 0);
    const noOpProposal = {
      ...relationshipProposal("t-effect-003", 0, 0, 0.5),
      transition_type: "Time",
      time_input: { kind: "ELAPSED", elapsed_time: { value: 0, unit: "tick" } },
      domain_deltas: []
    } as unknown as CanonicalTransitionProposalV1;
    const noOp = await prepareCanonicalTransitionEffectV0({ predecessor, proposal: noOpProposal });
    expect(noOp.kind).toBe("NO_OP");
    const noOpReplay = await replayCanonicalTransitionEffectV0({ predecessor, proposal: noOpProposal });
    expect(noOpReplay.kind).toBe("REJECTED");

    const wrongSubject = {
      ...relationshipProposal("t-effect-004", 0, 0, 0.5),
      subject_id: "subject-other"
    } as unknown as CanonicalTransitionProposalV1;
    expect(
      (await prepareCanonicalTransitionEffectV0({ predecessor, proposal: wrongSubject })).kind
    ).toBe("REJECTED");

    const stale = relationshipProposal("t-effect-005", 7, 0, 0.5);
    const staleResult = await prepareCanonicalTransitionEffectV0({ predecessor, proposal: stale });
    expect(staleResult.kind).toBe("REJECTED");
    if (staleResult.kind === "REJECTED") {
      expect(staleResult.failure.error_code).toBe("STALE_STATE_REVISION");
    }
  });

  it("leaves inputs untouched (pure prepare/finalize/replay)", async () => {
    const predecessor = baseState(0, 0);
    const proposal = relationshipProposal("t-effect-006", 0, 0, 0.5);
    const snapshot = JSON.stringify({ predecessor, proposal });
    await prepareCanonicalTransitionEffectV0({ predecessor, proposal });
    await replayCanonicalTransitionEffectV0({ predecessor, proposal });
    expect(JSON.stringify({ predecessor, proposal })).toBe(snapshot);
  });
});
