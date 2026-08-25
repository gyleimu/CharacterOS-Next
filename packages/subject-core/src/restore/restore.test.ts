/**
 * P2.1.4 — restore envelope tests (pure; in-memory only).
 * Covers: valid snapshot restore, three hash-mismatch rejects, invalid revision
 * rejects, corrupted-trace reject, deterministic roundtrip, exact reconstruction
 * (no reset), immutability, and S0 golden-vector parity (freeze §9/§11).
 */

import { describe, expect, it } from "vitest";

import type {
  PersistedSubjectEnvelopeV1,
  RepositoryRevisionBindingV1
} from "../types/persistence.js";
import type { SubjectStateV0 } from "../types/subject-state.js";
import type { CanonicalTransitionProposalV1 } from "../types/transition.js";
import { canonicalJsonString } from "../canonical/json.js";
import {
  fullSnapshotChecksum,
  snapshotHash,
  stateHash
} from "../canonical/projections.js";
import { lastTraceRef } from "../trace/trace.js";
import { createCommitEngine, type CommitTransitionInput } from "../commit/engine.js";
import { InMemoryAtomicCommitStore } from "../commit/store.js";
import { validateSubjectState } from "../validation/subject-state.js";
import {
  createPersistenceEnvelope,
  type CreatePersistenceEnvelopeInput
} from "./envelope.js";
import { restoreFromEnvelope } from "./restore.js";

const HASH_V1_R0_REPOSITORY = "sha256:85755634de984070ca6c12d5dd01fb545e0efea635000e0e0044c589f3fcbb00";
const HASH_V1_S0_FULL_CHECKSUM = "sha256:247d069c04ade99cf8ece4c1d3dd314e534cbde43e1fec76de1101bf87241146";
const HASH_V1_S0_STATE = "sha256:ee565db175773cc61024096afbbe42bbb5379a136842c583e869e085384693a5";
const HASH_V1_S0_SNAPSHOT = "sha256:46edf45e84a38631748b034f625a7a772f9d20349b9680ad914918f7f53a7c37";

const EXACT_RULE_IDS = [
  "HASH-DET-001",
  "SS-AUTH-001",
  "SS-IMMUTABLE-001",
  "SS-REVISION-001",
  "TR-ATOMIC-001",
  "TRACE-ATOMIC-001",
  "TRACE-CONTENT-001"
];

let hexCounter = 0;

/** Deterministic well-formed HashV1 fixture value (unique per call). */
function hashHex(seed: string): string {
  void seed;
  const suffix = (hexCounter++).toString(16).padStart(4, "0");
  return `sha256:${"a".repeat(60)}${suffix}`;
}

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

function entry(seq: number): Record<string, unknown> {
  return {
    trace_schema_version: "trace-v1",
    trace_id: `trace:t${seq}`,
    history_sequence: seq,
    transition_id: `t-${seq}`,
    transition_type: "Observation",
    subject_id: "subject-s0",
    subject_revision_before: seq - 1,
    subject_revision_after: seq,
    logical_time: seq,
    rule_ids: [...EXACT_RULE_IDS],
    cause_refs: [],
    proposal_ref: `proposal:p${seq}`,
    domain_mutations: [
      {
        producer: "context",
        domain: "context",
        layers: ["context"],
        field_changes: [{ path: "/context", operation: "SET" }]
      }
    ],
    state_hash_before: hashHex(`b${seq}`),
    state_hash_after: hashHex(`a${seq}`),
    memory_revision_before: "R0",
    memory_revision_after: "R0",
    outcome: "COMMITTED"
  };
}

/** Valid revision-1 state produced by one Observation commit at logical time 3. */
function s1(): Record<string, unknown> {
  const s = s0();
  s["runtime_metadata"] = {
    subject_version: "subject-v0",
    state_revision: 1,
    logical_time: 3,
    last_transition_time: 3,
    last_transition_type: "Observation",
    created_at: 0,
    updated_at: 3
  };
  s["trace_window"] = {
    trace_window_schema_version: "trace-window-v1",
    capacity: 64,
    cursor: { last_history_sequence: 1, offloaded_through_sequence: 0, offloaded_through_trace_ref: null },
    entries: [entry(1)]
  };
  return s;
}

const R0_BINDINGS = [
  { repository_revision: "R0", repository_revision_hash: HASH_V1_R0_REPOSITORY }
] as unknown as RepositoryRevisionBindingV1[];

async function makeEnvelope(
  snapshot: Record<string, unknown>,
  overrides: Partial<CreatePersistenceEnvelopeInput> = {}
): Promise<PersistedSubjectEnvelopeV1> {
  const result = await createPersistenceEnvelope({
    snapshot: snapshot as unknown as SubjectStateV0,
    repository_bindings: R0_BINDINGS,
    ...overrides
  });
  if (!result.ok) throw new Error(`fixture envelope rejected: ${result.error.detail}`);
  return result.value;
}

/** Commits a real Observation against S0 to obtain an authentic revision-1 snapshot. */
async function realRevisionOne(): Promise<SubjectStateV0> {
  const store = new InMemoryAtomicCommitStore();
  const engine = createCommitEngine({ store });
  const proposal = {
    schema_version: "canonical-transition-proposal-v1",
    transition_id: "t-obs-r1",
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
          {
            path: "/affect",
            value: {
              active_channels: [
                { channel_id: "joy", intensity: 0.4, phase: "ACTIVE", started_at: 0, source_appraisal_ref: "appraisal:a1" }
              ],
              generated_under_profile: null,
              updated_at: null
            }
          },
          { path: "/mood", value: { baseline: 0.1, generated_under_profile: null, last_update: null } }
        ],
        provenance_refs: []
      },
      {
        producer: "context",
        domain: "context",
        expected_repository_revision: null,
        operations: [
          {
            path: "/context",
            value: { scene: "lab", task: null, focus_refs: [], active_entity_refs: [], environment_refs: [], current_observation_ref: null }
          }
        ],
        provenance_refs: []
      }
    ],
    external_refs: []
  } as unknown as CanonicalTransitionProposalV1;
  const input: CommitTransitionInput = {
    proposal,
    currentState: s0() as unknown as SubjectStateV0,
    identity_record_version_before: 0,
    first_seen_sequence: 1,
    prior_attempts: [],
    previous_commit_ref: null,
    previous_record_checksum: null,
    prepared_result_ref: "workflow:w-r1" as never,
    repository_bindings: R0_BINDINGS
  };
  const outcome = await engine.commitTransition(input);
  if (outcome.kind !== "COMMITTED") throw new Error("fixture commit failed");
  return outcome.bundle.next_snapshot;
}

/**
 * Raw envelope assembly for ATTACKER-CONSISTENT negative fixtures: computes honest
 * hashes over a (possibly doctored) snapshot WITHOUT the creation-side validation,
 * exactly what a hostile writer could produce. Restore must still reject these.
 */
async function rawEnvelope(
  snapshot: Record<string, unknown>,
  opts: { bindings?: unknown[]; commitHead?: unknown } = {}
): Promise<Record<string, unknown>> {
  const snap = snapshot as unknown as SubjectStateV0;
  const stateHashValue = await stateHash(snap);
  return {
    schema_version: "subject-persistence-envelope-v1",
    serialization_version: "canonical-json-v1",
    snapshot,
    full_snapshot_checksum: await fullSnapshotChecksum(snap),
    state_hash: stateHashValue,
    snapshot_hash: await snapshotHash({
      state_hash: stateHashValue,
      subject_id: snap.identity.subject_id,
      state_revision: snap.runtime_metadata.state_revision,
      trace_cursor: snap.trace_window.cursor,
      last_trace_ref: lastTraceRef(snap.trace_window)
    }),
    repository_bindings: opts.bindings ?? R0_BINDINGS,
    commit_head: opts.commitHead ?? null
  };
}

describe("createPersistenceEnvelope — golden parity and rules", () => {
  it("reproduces the frozen S0 hashes exactly (§9/§11)", async () => {
    const env = await makeEnvelope(s0());
    expect(env.schema_version).toBe("subject-persistence-envelope-v1");
    expect(env.serialization_version).toBe("canonical-json-v1");
    expect(env.full_snapshot_checksum).toBe(HASH_V1_S0_FULL_CHECKSUM);
    expect(env.state_hash).toBe(HASH_V1_S0_STATE);
    expect(env.snapshot_hash).toBe(HASH_V1_S0_SNAPSHOT);
    expect(env.commit_head).toBeNull();
    expect(Object.isFrozen(env)).toBe(true);
  });

  it("rejects unrelated or missing repository bindings at creation", async () => {
    const bad = await createPersistenceEnvelope({
      snapshot: s0() as unknown as SubjectStateV0,
      repository_bindings: [
        { repository_revision: "R999", repository_revision_hash: hashHex("x") } as unknown as RepositoryRevisionBindingV1
      ]
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.error_code).toBe("INVALID_MEMORY_REVISION");

    const empty = await createPersistenceEnvelope({
      snapshot: s0() as unknown as SubjectStateV0,
      repository_bindings: []
    });
    expect(empty.ok).toBe(false);
  });

  it("rejects a commit_head on a revision-0 snapshot", async () => {
    const bad = await createPersistenceEnvelope({
      snapshot: s0() as unknown as SubjectStateV0,
      repository_bindings: R0_BINDINGS,
      commit_head: { commit_ref: "commit:c1", record_checksum: hashHex("k") } as never
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.error_code).toBe("COMMIT_CHAIN_INTEGRITY_FAILURE");
  });
});

describe("restoreFromEnvelope — valid restores", () => {
  it("restores the S0 envelope into an immutable exact copy", async () => {
    const env = await makeEnvelope(s0());
    const wire = JSON.parse(JSON.stringify(env));
    const restored = await restoreFromEnvelope(wire);
    expect(restored.ok).toBe(true);
    if (!restored.ok) return;
    expect(restored.snapshot).toEqual(s0() as unknown as SubjectStateV0);
    expect(restored.snapshot.runtime_metadata.state_revision).toBe(0);
    expect(Object.isFrozen(restored.snapshot)).toBe(true);
    expect(Object.isFrozen((restored.snapshot as unknown as Record<string, unknown>)["trace_window"])).toBe(true);
  });

  it("performs deterministic roundtrips: create → restore → create is byte-stable", async () => {
    const first = await makeEnvelope(s0());
    const restored = await restoreFromEnvelope(JSON.parse(JSON.stringify(first)));
    if (!restored.ok) throw new Error("restore failed");
    const second = await createPersistenceEnvelope({
      snapshot: restored.snapshot,
      repository_bindings: R0_BINDINGS
    });
    if (!second.ok) throw new Error("second creation failed");
    expect(canonicalJsonString(second.value)).toBe(canonicalJsonString(first));
  });

  it("restores non-default context exactly (no reset semantics)", async () => {
    const authentic = await realRevisionOne();
    // Sanity: the committed snapshot passes the schema layer itself.
    expect(validateSubjectState(authentic).ok).toBe(true);
    const env = await makeEnvelope(authentic as unknown as Record<string, unknown>, {
      commit_head: { commit_ref: "commit:" + "c".repeat(64), record_checksum: hashHex("r1") } as never
    });
    const restored = await restoreFromEnvelope(JSON.parse(JSON.stringify(env)));
    expect(restored.ok).toBe(true);
    if (!restored.ok) return;
    expect((restored.snapshot["context"] as unknown as Record<string, unknown>)["scene"]).toBe("lab");
    expect(restored.snapshot.runtime_metadata.state_revision).toBe(1);
    expect(JSON.stringify(restored.snapshot)).toBe(JSON.stringify(authentic));
  });

  it("accepts a verdict-only reference validator when provided", async () => {
    const env = await makeEnvelope(s0());
    const allowing = async () => true;
    const okResult = await restoreFromEnvelope(JSON.parse(JSON.stringify(env)), { referenceValidator: allowing });
    expect(okResult.ok).toBe(true);
    const denying = async () => false;
    const denied = await restoreFromEnvelope(JSON.parse(JSON.stringify(env)), { referenceValidator: denying });
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.failure.error_code).toBe("INVALID_MEMORY_REVISION");
  });
});

describe("restoreFromEnvelope — hash verification rejects", () => {
  function tampered(env: PersistedSubjectEnvelopeV1, field: string, value: string): unknown {
    const copy = JSON.parse(JSON.stringify(env)) as Record<string, unknown>;
    copy[field] = value;
    return copy;
  }

  it("rejects a corrupted full_snapshot_checksum", async () => {
    const env = await makeEnvelope(s0());
    const r = await restoreFromEnvelope(tampered(env, "full_snapshot_checksum", hashHex("ff")));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.failure.error_code).toBe("FULL_SNAPSHOT_CHECKSUM_MISMATCH");
      expect(r.failure.reason).toBe("SS-RESTORE-001");
    }
  });

  it("rejects a corrupted state_hash", async () => {
    const env = await makeEnvelope(s0());
    const r = await restoreFromEnvelope(tampered(env, "state_hash", hashHex("ee")));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.failure.error_code).toBe("STATE_HASH_MISMATCH");
      expect(r.failure.reason).toBe("HASH-PROJ-001");
    }
  });

  it("rejects a corrupted snapshot_hash", async () => {
    const env = await makeEnvelope(s0());
    const r = await restoreFromEnvelope(tampered(env, "snapshot_hash", hashHex("dd")));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.failure.error_code).toBe("SNAPSHOT_HASH_MISMATCH");
      expect(r.failure.reason).toBe("HASH-SNAPSHOT-001");
    }
  });
});

describe("restoreFromEnvelope — revision and linkage rejects", () => {
  it("rejects bindings missing the snapshot's revision (invalid revision)", async () => {
    const env = await rawEnvelope(s0(), {
      bindings: [
        { repository_revision: "R1", repository_revision_hash: hashHex("z") } as unknown as RepositoryRevisionBindingV1
      ]
    });
    const r = await restoreFromEnvelope(env);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.failure.error_code).toBe("INVALID_MEMORY_REVISION");
  });

  it("rejects an inconsistent cross-field revision with self-consistent hashes", async () => {
    // Doctor the snapshot so revision metadata violates §6.2 but recompute all hashes:
    // the defect must still reject (schema stage) rather than silently restore.
    const doctored = s1();
    (doctored["runtime_metadata"] as Record<string, unknown>)["last_transition_time"] = null;
    const env = await rawEnvelope(doctored);
    const r = await restoreFromEnvelope(env);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.failure.error_code).toBe("INVARIANT_VIOLATION");
  });

  it("defers corrupted trace linkage to the trace stage (TRACE_INTEGRITY_FAILURE)", async () => {
    // Break window contiguity but keep stored hashes self-consistent with the body:
    // restoration must fail closed at stage 7, not pass because hashes match.
    const doctored = s1();
    const tw = doctored["trace_window"] as Record<string, unknown>;
    tw["entries"] = [];
    const env = await rawEnvelope(doctored);
    const r = await restoreFromEnvelope(env);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.failure.error_code).toBe("TRACE_INTEGRITY_FAILURE");
      expect(r.failure.reason).toBe("TRACE-CONTENT-001");
    }
  });

  it("rejects a commit_head present at revision 0 and absent after revision 0", async () => {
    const zeroWithHead = await rawEnvelope(s0(), {
      commitHead: { commit_ref: "commit:" + "c".repeat(64), record_checksum: hashHex("h") }
    });
    const r0 = await restoreFromEnvelope(zeroWithHead);
    expect(r0.ok).toBe(false);
    if (!r0.ok) expect(r0.failure.error_code).toBe("COMMIT_CHAIN_INTEGRITY_FAILURE");

    const rev1WithoutHead = await rawEnvelope(s1());
    const r1 = await restoreFromEnvelope(rev1WithoutHead);
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.failure.error_code).toBe("COMMIT_CHAIN_INTEGRITY_FAILURE");
  });
});

describe("restoreFromEnvelope — shell rejects", () => {
  it("rejects unknown keys and wrong literals before hashing", async () => {
    const extra = JSON.parse(JSON.stringify(await makeEnvelope(s0()))) as Record<string, unknown>;
    extra["provider_state"] = {};
    const r1 = await restoreFromEnvelope(extra);
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.failure.error_code).toBe("INVALID_SCHEMA");

    const wrongVersion = JSON.parse(JSON.stringify(await makeEnvelope(s0()))) as Record<string, unknown>;
    wrongVersion["schema_version"] = "subject-persistence-envelope-v2";
    const r2 = await restoreFromEnvelope(wrongVersion);
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.failure.error_code).toBe("INVALID_SCHEMA");
  });

  it("rejects non-object input", async () => {
    const r = await restoreFromEnvelope("not-an-envelope");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.failure.error_code).toBe("INVALID_SCHEMA");
  });
});
