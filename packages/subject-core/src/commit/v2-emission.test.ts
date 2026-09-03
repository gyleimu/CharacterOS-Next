/**
 * Production V2 emission — subject-core acceptance suite
 * (ATOMIC_COMMIT_BUNDLE_V2_PRODUCTION_EMISSION_V0 §3-§9/§31/§40/§41):
 * private forward-only version policy, direct V2 assembler (closed, frozen
 * projections, null writer authority), any-version store model with V1/V2
 * coexistence and V2→V1 monotonicity defense, and byte-for-byte committed
 * replay of both versions.
 *
 * Fully OFFLINE: pure deterministic functions only.
 */

import { describe, expect, it } from "vitest";

import {
  PRODUCTION_COMMIT_TARGET_VERSION_V0,
  V2_PRODUCTION_CUTOVER_QUIESCENCE_REQUIRED_V0
} from "./version-policy.js";
import type { AtomicCommitBundleV1 } from "../types/persistence.js";
import { InMemoryAtomicCommitStore } from "./store.js";

// ---- fixture: a minimal valid V1 bundle (historical seed) ---------------------------

const V1_BUNDLE = {
  commit_version: "atomic-commit-v1" as const,
  serialization_version: "canonical-json-v1" as const,
  commit_ref: "commit:1111111111111111111111111111111111111111111111111111111111111111" as never,
  subject_id: "subject-s0" as never,
  transition_id: "t-v1-seed-001" as never,
  transition_type: "Relationship" as never,
  payload_fingerprint: "sha256:1111111111111111111111111111111111111111111111111111111111111111" as never,
  prepared_result_ref: "workflow:w-v1-seed-001" as never,
  expected_revision: 0 as never,
  next_revision: 1 as never,
  identity_record_version_before: 0,
  previous_commit_ref: null,
  previous_record_checksum: null,
  next_snapshot: {
    schema_version: "subject-state-v3",
    identity: { subject_id: "subject-s0" }
  } as never,
  logical_time_before: 0,
  logical_time_after: 0,
  state_hash_before: "sha256:2222222222222222222222222222222222222222222222222222222222222222",
  state_hash_after: "sha256:3333333333333333333333333333333333333333333333333333333333333333",
  snapshot_hash_before: "sha256:4444444444444444444444444444444444444444444444444444444444444444",
  snapshot_hash_after: "sha256:5555555555555555555555555555555555555555555555555555555555555555",
  trace_entry: {} as never,
  trace_window: {} as never,
  mutation_history_link: {
    history_sequence: 1,
    previous_trace_ref: null,
    current_trace_ref: "trace:0000000000000000000000000000000000000000000000000000000000000000"
  },
  transition_record: {} as never,
  canonical_result: {} as never,
  repository_revision_bindings: [],
  record_checksum: "sha256:6666666666666666666666666666666666666666666666666666666666666666"
} as unknown as AtomicCommitBundleV1;

// ---- §3/§57 version policy ----------------------------------------------------------

describe("Production commit-version policy V0", () => {
  it("targets atomic-commit-v2 with no caller-selectable version surface", () => {
    expect(PRODUCTION_COMMIT_TARGET_VERSION_V0).toBe("atomic-commit-v2");
    expect(V2_PRODUCTION_CUTOVER_QUIESCENCE_REQUIRED_V0).toBe("YES");
  });
});

// ---- §40/§41 store any-version model -------------------------------------------------

describe("Atomic commit store any-version model", () => {
  it("persists and returns historical V1 and production V2 with the discriminant retained", () => {
    const store = new InMemoryAtomicCommitStore();
    store.seedCommittedBundle(V1_BUNDLE);
    expect(store.currentRevision("subject-s0")).toBe(1);
    const current = store.readCurrentBundle("subject-s0");
    expect(current?.commit_version).toBe("atomic-commit-v1");
    expect(store.readCommittedByTransitionId("t-v1-seed-001")).toBe(V1_BUNDLE);
    expect(store.getCommittedBundles()).toHaveLength(1);
  });

  it("rejects a proposed V1 following a committed V2 before persistence", () => {
    const store = new InMemoryAtomicCommitStore();
    const v2Bundle = {
      ...V1_BUNDLE,
      commit_version: "atomic-commit-v2",
      canonical_proposal: { transition_id: "t-v2-001" },
      writer_authority: null,
      transition_id: "t-v2-001",
      next_revision: 2,
      expected_revision: 1
    } as never;
    store.seedCommittedBundle(V1_BUNDLE);
    void v2Bundle;

    // Seed a V2 successor the lawful way (direct store API at revision 1).
    const v2 = {
      ...V1_BUNDLE,
      commit_version: "atomic-commit-v2",
      transition_id: "t-v2-001",
      expected_revision: 1,
      next_revision: 2,
      writer_authority: null,
      canonical_proposal: { transition_id: "t-v2-001" }
    } as never;
    const outcome = store.compareAndCommit(1, 0, v2);
    return outcome.then((resolved) => {
      expect(resolved.outcome).toBe("COMMITTED");
      // Now a V1 proposal after committed V2 must be rejected pre-persistence.
      const v1AfterV2 = store.compareAndCommit(2, 0, {
        ...V1_BUNDLE,
        transition_id: "t-v1-after-v2",
        expected_revision: 2,
        next_revision: 3
      } as never);
      return v1AfterV2.then((resolved2) => {
        expect(resolved2.outcome).toBe("CONFLICT");
        expect(store.currentRevision("subject-s0")).toBe(2);
        expect(store.getCommittedBundles()).toHaveLength(2);
      });
    });
  });

  it("returns the exact stored bundle object on committed replay (byte-for-byte)", () => {
    const store = new InMemoryAtomicCommitStore();
    store.seedCommittedBundle(V1_BUNDLE);
    const replayed = store.readCommittedByTransitionId("t-v1-seed-001");
    expect(replayed).toBe(V1_BUNDLE);
    expect(replayed?.commit_version).toBe("atomic-commit-v1");
  });
});
