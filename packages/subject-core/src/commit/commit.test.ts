/**
 * P2.1.3 — commit engine unit tests (pure; in-memory store only).
 * Covers: immutable candidate construction, §6.2 metadata derivation, §7.2
 * composition, bundle cross-field equalities incl. record-checksum recomputation,
 * CAS outcomes (COMMITTED/CONFLICT/faults), NO_OP routing, stale/time guards,
 * chained authority, and Producer!=Mutator (state never mutated in place).
 */

import { describe, expect, it } from "vitest";

import type { RuntimeMetadataV0, SubjectStateV0 } from "../types/subject-state.js";
import type { CanonicalRefV0 } from "../types/ref.js";
import type { CanonicalTransitionProposalV1 } from "../types/transition.js";
import type { AtomicCommitBundleV1, RepositoryRevisionBindingV1 } from "../types/persistence.js";
import { canonicalJsonString } from "../canonical/json.js";
import { hashEnvelope } from "../canonical/hash.js";
import { stateHash, snapshotHash } from "../canonical/projections.js";
import {
  applyDeltaOperations,
  cloneStateForCandidate,
  deriveRuntimeMetadata,
  freezeCandidate
} from "../candidate/candidate.js";
import { validateProposalComposition } from "./composition.js";
import { createCommitEngine, type CommitTransitionInput } from "./engine.js";
import { InMemoryAtomicCommitStore } from "./store.js";

const HASH_V1_R0_REPOSITORY = "sha256:85755634de984070ca6c12d5dd01fb545e0efea635000e0e0044c589f3fcbb00";

/** Golden S0 exactly as frozen in §4.2 (same fixture proven against §9 vectors). */
function s0(): Record<string, unknown> {
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

function moodValue(baseline: number): Record<string, unknown> {
  return { baseline, generated_under_profile: null, last_update: null };
}

function affectValue(intensity: number): Record<string, unknown> {
  return {
    active_channels: [
      {
        channel_id: "joy",
        intensity,
        phase: "ACTIVE",
        started_at: 0,
        source_appraisal_ref: "appraisal:a1"
      }
    ],
    generated_under_profile: null,
    updated_at: null
  };
}

function regulationValue(stress: number): Record<string, unknown> {
  return { energy: 1, stress, arousal: 0.5, fatigue: 0, last_update: null };
}

function contextDelta(scene: string): Record<string, unknown> {
  return {
    producer: "context",
    domain: "context",
    expected_repository_revision: null,
    operations: [
      {
        path: "/context",
        value: {
          scene,
          task: null,
          focus_refs: [],
          active_entity_refs: [],
          environment_refs: [],
          current_observation_ref: null
        }
      }
    ],
    provenance_refs: []
  };
}

/** Complete Observation composition: affect(/mood+/affect) + context(/context). */
function observationProposal(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema_version: "canonical-transition-proposal-v1",
    transition_id: "t-obs-0001",
    subject_id: "subject-s0",
    transition_type: "Observation",
    expected_state_revision: 0,
    time_input: { kind: "OCCURRENCE", occurrence_logical_time: 0 },
    cause_refs: [],
    domain_deltas: [
      {
        producer: "affect",
        domain: "affect",
        expected_repository_revision: null,
        operations: [
          // Sorted by raw ASCII path: /affect < /mood.
          { path: "/affect", value: affectValue(0.4) },
          { path: "/mood", value: moodValue(0.1) }
        ],
        provenance_refs: []
      },
      contextDelta("lab")
    ],
    external_refs: [],
    ...overrides
  };
}

/** Complete Time composition: affect(/mood+/affect) + regulation(/regulation). */
function timeProposal(ticks: number, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema_version: "canonical-transition-proposal-v1",
    transition_id: `t-time-${String(ticks).padStart(4, "0")}`,
    subject_id: "subject-s0",
    transition_type: "Time",
    expected_state_revision: 0,
    time_input: { kind: "ELAPSED", elapsed_time: { value: ticks, unit: "tick" } },
    cause_refs: [],
    domain_deltas: [
      {
        producer: "affect",
        domain: "affect",
        expected_repository_revision: null,
        operations: [
          { path: "/affect", value: affectValue(0.2) },
          { path: "/mood", value: moodValue(0.05) }
        ],
        provenance_refs: []
      },
      {
        producer: "regulation",
        domain: "regulation",
        expected_repository_revision: null,
        operations: [{ path: "/regulation", value: regulationValue(0.3) }],
        provenance_refs: []
      }
    ],
    external_refs: [],
    ...overrides
  };
}

function learningProposal(nextRevision: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema_version: "canonical-transition-proposal-v1",
    transition_id: "t-learn-0001",
    subject_id: "subject-s0",
    transition_type: "Learning",
    expected_state_revision: 0,
    time_input: { kind: "OCCURRENCE", occurrence_logical_time: 0 },
    cause_refs: [],
    domain_deltas: [
      {
        producer: "memory",
        domain: "memory-content",
        expected_repository_revision: "R0",
        operations: [{ path: "/memory_state/repository_revision", value: nextRevision }],
        provenance_refs: []
      }
    ],
    external_refs: [],
    ...overrides
  };
}

const R0_BINDINGS = [
  { repository_revision: "R0", repository_revision_hash: HASH_V1_R0_REPOSITORY }
] as unknown as RepositoryRevisionBindingV1[];

function baseEngineInput(
  proposal: Record<string, unknown>,
  overrides: Partial<CommitTransitionInput> = {}
): CommitTransitionInput {
  return {
    proposal: proposal as unknown as CanonicalTransitionProposalV1,
    currentState: s0() as unknown as SubjectStateV0,
    identity_record_version_before: 0,
    first_seen_sequence: 1,
    prior_attempts: [],
    previous_commit_ref: null,
    previous_record_checksum: null,
    prepared_result_ref: "workflow:w-0001" as CanonicalRefV0,
    repository_bindings: R0_BINDINGS,
    reference_validator: async () => true,
    ...overrides
  };
}

describe("candidate construction", () => {
  it("never mutates the authoritative snapshot and freezes the candidate", () => {
    const current = s0();
    const snapshotBefore = JSON.stringify(current);
    const draft = cloneStateForCandidate(current as unknown as SubjectStateV0);
    const proposal = observationProposal() as unknown as CanonicalTransitionProposalV1;
    applyDeltaOperations(draft, proposal);
    draft["runtime_metadata"] = {
      ...(draft["runtime_metadata"] as Record<string, unknown>),
      state_revision: 1
    };
    const candidate = freezeCandidate(draft);
    expect(JSON.stringify(current)).toBe(snapshotBefore);
    expect(Object.isFrozen(candidate)).toBe(true);
    expect(Object.isFrozen((candidate["context"] as unknown as Record<string, unknown>))).toBe(true);
  });

  it("derives runtime metadata per the §6.2 transition table (Observation)", () => {
    const rm = s0()["runtime_metadata"] as unknown as RuntimeMetadataV0;
    const derived = deriveRuntimeMetadata(rm, "Observation", { kind: "OCCURRENCE", occurrence: 0 });
    expect(derived.ok).toBe(true);
    if (derived.ok) {
      expect(derived.value.state_revision).toBe(1);
      expect(derived.value.logical_time).toBe(0);
      expect(derived.value.last_transition_time).toBe(0);
      expect(derived.value.last_transition_type).toBe("Observation");
      expect(derived.value.updated_at).toBe(0);
    }
  });

  it("rejects an Observation whose occurrence differs from current logical time", () => {
    const rm = s0()["runtime_metadata"] as unknown as RuntimeMetadataV0;
    const derived = deriveRuntimeMetadata(rm, "Observation", { kind: "OCCURRENCE", occurrence: 5 });
    expect(derived.ok).toBe(false);
    if (!derived.ok) expect(derived.error.error_code).toBe("INVALID_LOGICAL_TIME");
  });

  it("advances logical time for committed Time and rejects safe-integer overflow", () => {
    const rm = s0()["runtime_metadata"] as unknown as RuntimeMetadataV0;
    const advanced = deriveRuntimeMetadata(rm, "Time", { kind: "ELAPSED", ticks: 7 });
    expect(advanced.ok).toBe(true);
    if (advanced.ok) {
      expect(advanced.value.logical_time).toBe(7);
      expect(advanced.value.last_transition_type).toBe("Time");
    }
    const maxed = {
      ...rm,
      logical_time: Number.MAX_SAFE_INTEGER
    } as unknown as RuntimeMetadataV0;
    const overflow = deriveRuntimeMetadata(maxed, "Time", { kind: "ELAPSED", ticks: 1 });
    expect(overflow.ok).toBe(false);
    if (!overflow.ok) expect(overflow.error.error_code).toBe("INVALID_LOGICAL_TIME");
  });
});

describe("proposal composition (§7.2)", () => {
  it("accepts the complete Observation set", () => {
    const r = validateProposalComposition(observationProposal() as unknown as CanonicalTransitionProposalV1);
    expect(r.ok).toBe(true);
  });

  it("rejects Observation missing the required affect domain", () => {
    const partial = observationProposal();
    partial["domain_deltas"] = [contextDelta("lab")];
    const r = validateProposalComposition(partial as unknown as CanonicalTransitionProposalV1);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.error_code).toBe("MISSING_REQUIRED_DELTA");
  });

  it("rejects partial optional memory-retrieval sets", () => {
    const partial = observationProposal();
    partial["domain_deltas"] = [
      ...(partial["domain_deltas"] as unknown[]),
      {
        producer: "memory",
        domain: "memory-retrieval",
        expected_repository_revision: "R0",
        operations: [{ path: "/memory_state/working_refs", value: [] }],
        provenance_refs: []
      }
    ];
    const r = validateProposalComposition(partial as unknown as CanonicalTransitionProposalV1);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.error_code).toBe("INVALID_TRANSITION_COMPOSITION");
  });

  it("rejects Time elapsed=0 carrying a nonempty delta set", () => {
    const zero = timeProposal(0);
    const r = validateProposalComposition(zero as unknown as CanonicalTransitionProposalV1);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.error_code).toBe("INVALID_TRANSITION_COMPOSITION");
  });

  it("rejects Learning without the repository_revision delta", () => {
    const bad = learningProposal("R1");
    const deltas = bad["domain_deltas"] as Array<Record<string, unknown>>;
    (deltas[0] as Record<string, unknown>)["operations"] = [
      { path: "/memory_state/lifecycle_metadata", value: {} }
    ];
    const r = validateProposalComposition(bad as unknown as CanonicalTransitionProposalV1);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.error_code).toBe("MISSING_REQUIRED_DELTA");
  });
});

async function commitOnce(
  proposal: Record<string, unknown>,
  overrides: Partial<CommitTransitionInput> = {},
  fault?: () => "DEFINITE_NOT_COMMITTED" | "OUTCOME_UNKNOWN" | undefined
) {
  const store = new InMemoryAtomicCommitStore(fault ? { nextFault: fault } : {});
  const engine = createCommitEngine({ store });
  const outcome = await engine.commitTransition(baseEngineInput(proposal, overrides));
  return { store, engine, outcome };
}

describe("commit engine end-to-end", () => {
  it("commits a complete Observation: +1 revision, verifiable hashes/checksum, frozen evidence", async () => {
    const { outcome } = await commitOnce(observationProposal());
    expect(outcome.kind).toBe("COMMITTED");
    if (outcome.kind !== "COMMITTED") return;
    const bundle: AtomicCommitBundleV1 = outcome.bundle;

    expect(bundle.expected_revision).toBe(0);
    expect(bundle.next_revision).toBe(1);
    expect(bundle.subject_id).toBe("subject-s0");

    // StateHash/SnapshotHash recomputation binds bundle to snapshots.
    await expect(stateHash(bundle.next_snapshot)).resolves.toBe(bundle.state_hash_after);
    await expect(
      snapshotHash({
        state_hash: bundle.state_hash_after,
        subject_id: bundle.subject_id,
        state_revision: bundle.next_revision,
        trace_cursor: bundle.next_snapshot.trace_window.cursor,
        last_trace_ref: bundle.trace_entry.trace_id
      })
    ).resolves.toBe(bundle.snapshot_hash_after);

    // §15.2 equality 6: window bytes equal next_snapshot.trace_window; final entry is THE entry.
    expect(bundle.trace_window).toBe(bundle.next_snapshot.trace_window);
    expect(bundle.trace_window.entries[bundle.trace_window.entries.length - 1]).toBe(bundle.trace_entry);
    expect(bundle.mutation_history_link.current_trace_ref).toBe(bundle.trace_entry.trace_id);
    expect(bundle.transition_record.terminal_status).toBe("COMMITTED");
    expect(bundle.canonical_result.result_ref).toBe(bundle.transition_record.terminal_result_ref);

    // record_checksum recomputes over BUNDLE_WITHOUT_RECORD_CHECKSUM.
    const copy = { ...bundle } as unknown as Record<string, unknown>;
    delete copy["record_checksum"];
    await expect(hashEnvelope("characteros-next/atomic-commit/record-checksum/v1", copy)).resolves.toBe(
      bundle.record_checksum
    );

    // Canonical JSON round-trip stays stable (deterministic serialization).
    expect(canonicalJsonString(bundle)).toContain('"commit_version":"atomic-commit-v1"');
  });

  it("is deterministic: two isolated runs produce byte-identical refs and hashes", async () => {
    const a = await commitOnce(observationProposal());
    const b = await commitOnce(observationProposal());
    if (a.outcome.kind !== "COMMITTED" || b.outcome.kind !== "COMMITTED") {
      throw new Error("expected both commits to succeed");
    }
    expect(a.outcome.result.result_ref).toBe(b.outcome.result.result_ref);
    expect(a.outcome.bundle.record_checksum).toBe(b.outcome.bundle.record_checksum);
    expect(a.outcome.bundle.state_hash_after).toBe(b.outcome.bundle.state_hash_after);
  });

  it("routes Time elapsed=0 with zero deltas to NO_OP without touching the store", async () => {
    const zeroDeltaTime = {
      schema_version: "canonical-transition-proposal-v1",
      transition_id: "t-time-zero",
      subject_id: "subject-s0",
      transition_type: "Time",
      expected_state_revision: 0,
      time_input: { kind: "ELAPSED", elapsed_time: { value: 0, unit: "tick" } },
      cause_refs: [],
      domain_deltas: [],
      external_refs: []
    };
    const { store, outcome } = await commitOnce(zeroDeltaTime);
    expect(outcome.kind).toBe("NO_OP");
    expect(store.getCommittedBundles()).toHaveLength(0);
  });

  it("chains authority across two commits with previous refs/checksums and CAS versions", async () => {
    const store = new InMemoryAtomicCommitStore();
    const engine = createCommitEngine({ store });

    const first = await engine.commitTransition(baseEngineInput(observationProposal()));
    if (first.kind !== "COMMITTED") throw new Error("first commit failed");
    const b1 = first.bundle;

    const advancedState = b1.next_snapshot;
    const secondProposal = timeProposal(5, { expected_state_revision: 1 });
    const second = await engine.commitTransition({
      ...baseEngineInput(secondProposal),
      proposal: secondProposal as unknown as CanonicalTransitionProposalV1,
      currentState: advancedState,
      identity_record_version_before: b1.transition_record.record_version,
      first_seen_sequence: 2,
      previous_commit_ref: b1.commit_ref,
      previous_record_checksum: b1.record_checksum,
      prepared_result_ref: "workflow:w-0002" as CanonicalRefV0
    });
    expect(second.kind).toBe("COMMITTED");
    if (second.kind !== "COMMITTED") return;
    const b2 = second.bundle;
    expect(b2.previous_commit_ref).toBe(b1.commit_ref);
    expect(b2.previous_record_checksum).toBe(b1.record_checksum);
    expect(b2.next_revision).toBe(2);
    expect(b2.logical_time_after).toBe(5);
    expect(store.currentRevision("subject-s0")).toBe(2);
    expect(store.getCommittedBundles()).toHaveLength(2);
  });

  it("rejects stale expected revisions before any mutation", async () => {
    const stale = observationProposal({ expected_state_revision: 5 });
    const { store, outcome } = await commitOnce(stale);
    expect(outcome.kind).toBe("REJECTED");
    if (outcome.kind !== "REJECTED") return;
    expect(outcome.failure.error_code).toBe("STALE_STATE_REVISION");
    expect(store.getCommittedBundles()).toHaveLength(0);
  });

  it("rejects a subject mismatch with UNKNOWN_SUBJECT", async () => {
    const other = observationProposal({ subject_id: "subject-other" });
    const { outcome } = await commitOnce(other);
    expect(outcome.kind).toBe("REJECTED");
    if (outcome.kind !== "REJECTED") return;
    expect(outcome.failure.error_code).toBe("UNKNOWN_SUBJECT");
  });

  it("maps store faults: DEFINITE_NOT_COMMITTED aborts, OUTCOME_UNKNOWN stays unresolved", async () => {
    const aborted = await commitOnce(observationProposal(), {}, () => "DEFINITE_NOT_COMMITTED");
    expect(aborted.outcome.kind).toBe("ABORTED");
    if (aborted.outcome.kind === "ABORTED") {
      expect(aborted.outcome.failure.error_code).toBe("SERVICE_UNAVAILABLE");
    }
    const unresolved = await commitOnce(observationProposal(), {}, () => "OUTCOME_UNKNOWN");
    expect(unresolved.outcome.kind).toBe("UNRESOLVED");
  });

  it("rejects Learning adopting an unchanged repository revision", async () => {
    const sameRevision = learningProposal("R0");
    const { outcome } = await commitOnce(sameRevision);
    expect(outcome.kind).toBe("REJECTED");
    if (outcome.kind !== "REJECTED") return;
    expect(outcome.failure.error_code).toBe("INVALID_MEMORY_REVISION");
  });

  it("fails closed when the verdict-only reference validator rejects a binding", async () => {
    const denying = async () => false;
    const { outcome } = await commitOnce(observationProposal(), { reference_validator: denying });
    expect(outcome.kind).toBe("REJECTED");
    if (outcome.kind !== "REJECTED") return;
    expect(outcome.failure.error_code).toBe("INVALID_MEMORY_REVISION");
  });
});

describe("in-memory AtomicCommitStore CAS", () => {
  it("conflicts on a wrong identity record version and never overwrites the winner", async () => {
    const store = new InMemoryAtomicCommitStore();
    const engine = createCommitEngine({ store });
    const first = await engine.commitTransition(baseEngineInput(observationProposal()));
    if (first.kind !== "COMMITTED") throw new Error("seed commit failed");

    const forged = JSON.parse(JSON.stringify(first.bundle)) as AtomicCommitBundleV1;
    // Same expected revision, wrong journal version -> CAS mismatch.
    const outcome = await store.compareAndCommit(0, 0, forged);
    expect(outcome.outcome).toBe("CONFLICT");
    expect(store.getCommittedBundles()).toHaveLength(1);
    expect(store.currentRevision("subject-s0")).toBe(1);
  });
});

describe("P0-3 — full candidate validation before commit", () => {
  it("7: individually valid deltas composing into a whole-state violation commit nothing", async () => {
    // mood.last_update=10 is shape-valid in isolation, but the composed candidate puts
    // it AFTER logical_time=0 → whole-state INVARIANT_VIOLATION (never hashed/committed).
    const badMood = {
      producer: "affect",
      domain: "affect",
      expected_repository_revision: null,
      operations: [
        {
          path: "/affect",
          value: { active_channels: [], generated_under_profile: null, updated_at: null }
        },
        { path: "/mood", value: { baseline: 0.1, generated_under_profile: null, last_update: 10 } }
      ],
      provenance_refs: []
    };
    const p = timeProposal(5, {
      domain_deltas: [badMood, regulationDeltaFixture()]
    });
    const { store, outcome } = await commitOnce(p);
    expect(outcome.kind).toBe("REJECTED");
    if (outcome.kind !== "REJECTED") return;
    expect(outcome.failure.error_code).toBe("INVARIANT_VIOLATION");
    expect(store.getCommittedBundles()).toHaveLength(0);
    expect(store.currentRevision("subject-s0")).toBeNull();
  });
});

function regulationDeltaFixture(): Record<string, unknown> {
  return {
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
  };
}
