/**
 * P2.1.3 — canonical serialization/hash foundation tests.
 *
 * Every expected hash below is a frozen golden vector from
 * docs/implementation/p2-1-contract-freeze.md §9; the two long strings are the exact
 * §9.1/§9.2 hash-input envelopes. Passing proves the JCS serializer is byte-exact.
 */

import { describe, expect, it } from "vitest";

import type { SubjectStateV0 } from "../types/subject-state.js";
import type { CanonicalTransitionProposalV1 } from "../types/transition.js";
import { canonicalJsonString, NonCanonicalValueError } from "./json.js";
import { hashEnvelope, sha256HashV1 } from "./hash.js";
import {
  canonicalSnapshotHashInput,
  canonicalStateHashInput,
  fullSnapshotChecksum,
  proposalFingerprint,
  snapshotHash,
  stateHash,
  type SnapshotHashInput
} from "./projections.js";

/** Golden S0 exactly as frozen in §4.2. */
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

/** §9.4 S1 = S0 after the simple Observation context replacement at revision 1. */
function s1(): Record<string, unknown> {
  const s = s0();
  s["context"] = {
    scene: "lab",
    task: null,
    focus_refs: [],
    active_entity_refs: [],
    environment_refs: [],
    current_observation_ref: "observation:o1"
  };
  s["runtime_metadata"] = {
    subject_version: "subject-v0",
    state_revision: 1,
    logical_time: 0,
    last_transition_time: 0,
    last_transition_type: "Observation",
    created_at: 0,
    updated_at: 0
  };
  return s;
}

const HASH_V1_EMPTY = "sha256:44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a";
const HASH_V1_S0_FULL_CHECKSUM = "sha256:db0fa87d6c355b5cea2c0eb2348b73fdf4a97204ef157d4f81ab5a0fa227f8b5";
const HASH_V1_S0_STATE = "sha256:c644baa884f9911038575b4c1b7c9b60e1c79c00faf9e6b79b2af811c785d0d4";
const HASH_V1_S0_SNAPSHOT = "sha256:c00a471b35642d3b7e37a6026b36ffbc4a2a7b147b2f08066bdbe276483dbef6";
const HASH_V1_R0_REPOSITORY = "sha256:85755634de984070ca6c12d5dd01fb545e0efea635000e0e0044c589f3fcbb00";
const HASH_V1_SIMPLE_PROPOSAL = "sha256:7fbf85ce972c8a140af6432990a65584e7d246743a326427beb579e427b51911";
const HASH_V1_S1_STATE = "sha256:a907bca0ebf818f55c2e6a1dfeb0f754d9fdb889623ccb55d3108ad11cc82338";

/** Exact §9.1 S0 StateHash envelope (1474 UTF-8 bytes). */
const GOLDEN_S0_STATE_INPUT =
  '{"projection":"characteros-next/subject-state/state-hash/v1","value":{"affect":{"active_channels":[],"generated_under_profile":null,"updated_at":null},"beliefs":{"items":[],"schema_version":"belief-state-v0"},"context":{"active_entity_refs":[],"current_observation_ref":null,"environment_refs":[],"focus_refs":[],"scene":"idle","task":null},"identity":{"display_name":"","identity_anchors":[],"origin_metadata":{"creation_source":null,"seed_version":null},"self_schema_seed_refs":[],"subject_id":"subject-s0"},"mechanism_config":{"affect_profile":{"profile_id":"FAST_EMA_V0","timebase":"legacy_tick"},"feature_flags":{},"legacy_reference_defaults":{"alpha":0.06,"clamp":0.25,"tHold":60,"tau":150},"thresholds":{}},"memory_state":{"active_episode_refs":[],"autobiographical_index_revision":null,"consolidation_cursor":null,"last_retrieval_at":null,"lifecycle_metadata":{},"pending_encoding_refs":[],"recent_retrieval_trace":[],"repository_revision":"R0","retrieval_config":{"affect_congruence_enabled":false,"profile_id":"RETRIEVAL_V0","recent_trace_capacity":64},"working_refs":[]},"mood":{"baseline":0,"generated_under_profile":null,"last_update":null},"personality":{"dimensions":[],"schema_version":"personality-state-v0"},"regulation":{"arousal":0.5,"energy":1,"fatigue":0,"last_update":null,"stress":0},"relationships":{"counterparts":[],"schema_version":"relationship-state-v0"},"runtime_metadata":{"created_at":0,"last_transition_time":null,"last_transition_type":null,"logical_time":0,"state_revision":0,"subject_version":"subject-v0","updated_at":0},"schema_version":"subject-state-v3","traits_seed":{"dimensions":{}}}}';

/** Exact §9.2 S0 SnapshotHash envelope. */
const GOLDEN_S0_SNAPSHOT_INPUT =
  '{"last_trace_ref":null,"projection":"characteros-next/subject-state/snapshot-hash/v1","state_hash":"sha256:c644baa884f9911038575b4c1b7c9b60e1c79c00faf9e6b79b2af811c785d0d4","state_revision":0,"subject_id":"subject-s0","trace_cursor":{"last_history_sequence":0,"offloaded_through_sequence":0,"offloaded_through_trace_ref":null}}';

describe("canonicalJsonString — JCS mechanics", () => {
  it("serializes an empty object to {}", () => {
    expect(canonicalJsonString({})).toBe("{}");
  });

  it("sorts member names recursively by raw code units", () => {
    expect(canonicalJsonString({ b: 1, a: { d: 1, c: 2 } })).toBe('{"a":{"c":2,"d":1},"b":1}');
  });

  it("preserves admitted array order", () => {
    expect(canonicalJsonString({ list: [3, 1, 2] })).toBe('{"list":[3,1,2]}');
  });

  it("serializes -0 as 0 and keeps ECMAScript number forms", () => {
    expect(canonicalJsonString({ z: -0, f: 0.06, h: 0.25, i: 150 })).toBe(
      '{"f":0.06,"h":0.25,"i":150,"z":0}'
    );
  });

  it("fails closed on undefined members, NaN/Infinity, bigints, functions and exotic objects", () => {
    expect(() => canonicalJsonString({ a: undefined })).toThrow(NonCanonicalValueError);
    expect(() => canonicalJsonString({ a: Number.NaN })).toThrow(NonCanonicalValueError);
    expect(() => canonicalJsonString({ a: Number.POSITIVE_INFINITY })).toThrow(NonCanonicalValueError);
    expect(() => canonicalJsonString({ a: 1n })).toThrow(NonCanonicalValueError);
    expect(() => canonicalJsonString({ a: () => 1 })).toThrow(NonCanonicalValueError);
    expect(() => canonicalJsonString({ a: new Date(0) })).toThrow(NonCanonicalValueError);
    expect(() => canonicalJsonString({ a: "\ud800" })).toThrow(NonCanonicalValueError);
  });
});

describe("golden vectors (freeze §9)", () => {
  it("HASH-V1-EMPTY over {} bytes", async () => {
    await expect(sha256HashV1(canonicalJsonString({}))).resolves.toBe(HASH_V1_EMPTY);
  });

  it("S0 StateHash input is byte-exact against §9.1 and hashes to HASH-V1-S0-STATE", async () => {
    const snapshot = s0() as unknown as SubjectStateV0;
    expect(canonicalStateHashInput(snapshot)).toBe(GOLDEN_S0_STATE_INPUT);
    await expect(stateHash(snapshot)).resolves.toBe(HASH_V1_S0_STATE);
  });

  it("S0 SnapshotHash input is byte-exact against §9.2 and hashes to HASH-V1-S0-SNAPSHOT", async () => {
    const input = {
      state_hash: HASH_V1_S0_STATE,
      subject_id: "subject-s0",
      state_revision: 0,
      trace_cursor: {
        last_history_sequence: 0,
        offloaded_through_sequence: 0,
        offloaded_through_trace_ref: null
      },
      last_trace_ref: null
    } as unknown as SnapshotHashInput;
    expect(canonicalSnapshotHashInput(input)).toBe(GOLDEN_S0_SNAPSHOT_INPUT);
    await expect(snapshotHash(input)).resolves.toBe(HASH_V1_S0_SNAPSHOT);
  });

  it("HASH-V1-S0-FULL-CHECKSUM covers the complete snapshot including trace_window", async () => {
    const snapshot = s0() as unknown as SubjectStateV0;
    await expect(fullSnapshotChecksum(snapshot)).resolves.toBe(HASH_V1_S0_FULL_CHECKSUM);
  });

  it("HASH-V1-R0-REPOSITORY reproduces the R0 manifest envelope vector", async () => {
    const value = {
      schema_version: "repository-revision-manifest-v1",
      repository_revision: "R0",
      parent_revision: null,
      record_hashes: [],
      index_manifest_hash: null
    };
    await expect(
      hashEnvelope("characteros-next/memory/repository-revision-hash/v1", value)
    ).resolves.toBe(HASH_V1_R0_REPOSITORY);
  });

  it("HASH-V1-SIMPLE-PROPOSAL fingerprint excludes transition_id", async () => {
    const proposal = {
      schema_version: "canonical-transition-proposal-v1",
      transition_id: "t-arbitrary-id",
      subject_id: "subject-s0",
      transition_type: "Observation",
      expected_state_revision: 0,
      time_input: { kind: "OCCURRENCE", occurrence_logical_time: 0 },
      cause_refs: ["observation:o1"],
      domain_deltas: [
        {
          producer: "context",
          domain: "context",
          expected_repository_revision: null,
          operations: [
            { path: "/context", value: s1()["context"] }
          ],
          provenance_refs: ["observation:o1"]
        }
      ],
      external_refs: []
    } as unknown as CanonicalTransitionProposalV1;
    await expect(proposalFingerprint(proposal)).resolves.toBe(HASH_V1_SIMPLE_PROPOSAL);
  });

  it("S1 StateHash matches HASH-V1-SIMPLE-DELTA after the simple Observation commit", async () => {
    await expect(stateHash(s1() as unknown as SubjectStateV0)).resolves.toBe(HASH_V1_S1_STATE);
  });
});
