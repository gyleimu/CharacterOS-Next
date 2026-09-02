/**
 * Trusted Canonical History Boundary V0 — acceptance suite (§3-§5/§50):
 * genesis law verification (zero revision/time, empty trace, null head,
 * binding contract, hash recomputation), opaque WeakSet-admitted receipts,
 * structural-clone/lookalike rejection, deep freeze, head structural law,
 * and the NO-ROOT-EXPORT constraint on the internal issuer.
 *
 * Fully OFFLINE: pure deterministic functions only.
 */

import { describe, expect, it } from "vitest";

import {
  createPersistenceEnvelope,
  type PersistedSubjectEnvelopeV1
} from "@characteros-next/subject-core";

import * as runtimeIndex from "../index.js";
import * as boundaryModule from "./trusted-canonical-history-boundary.js";
import {
  isTrustedCanonicalHistoryBoundaryReceiptV0,
  mintTrustedCanonicalHistoryBoundaryV0,
  validateTrustedCanonicalHeadInputV0,
  verifyGenesisEnvelopeV0,
  type TrustedCanonicalHeadInputV0
} from "./trusted-canonical-history-boundary.js";

// ---- deterministic fixtures ---------------------------------------------------------

function genesisState(): Record<string, unknown> {
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

async function genesisEnvelope(): Promise<PersistedSubjectEnvelopeV1> {
  const result = await createPersistenceEnvelope({
    snapshot: genesisState() as never,
    repository_bindings: [
      {
        repository_revision: "R0",
        repository_revision_hash: "sha256:4444444444444444444444444444444444444444444444444444444444444444"
      } as never
    ],
    commit_head: null
  });
  if (!result.ok) throw new Error("fixture genesis envelope failed");
  return result.value;
}

function trustedHead(overrides?: Partial<Record<string, unknown>>): TrustedCanonicalHeadInputV0 {
  return {
    schema_version: "trusted-canonical-head-v0",
    subject_id: "subject-s0",
    revision: 0,
    commit_ref: null,
    record_checksum: null,
    state_hash: "sha256:5555555555555555555555555555555555555555555555555555555555555555",
    snapshot_hash: "sha256:6666666666666666666666666666666666666666666666666666666666666666",
    ...overrides
  } as unknown as TrustedCanonicalHeadInputV0;
}

// ---- tests --------------------------------------------------------------------------

describe("Trusted canonical history boundary V0", () => {
  it("verifies a valid genesis envelope and mints an opaque deeply-frozen receipt", async () => {
    const envelope = await genesisEnvelope();
    expect((await verifyGenesisEnvelopeV0(envelope)).ok).toBe(true);
    const outcome = await mintTrustedCanonicalHistoryBoundaryV0({
      genesis: envelope,
      head: trustedHead()
    });
    expect(outcome.kind).toBe("MINTED");
    if (outcome.kind !== "MINTED") return;
    expect(Object.isFrozen(outcome.receipt)).toBe(true);
    expect(Object.isFrozen(outcome.receipt.genesis)).toBe(true);
    expect(outcome.receipt.head.revision).toBe(0);
  });

  it("rejects genesis violations: nonzero revision, tampered integrity hashes", async () => {
    const envelope = await genesisEnvelope();
    const badRevision = await verifyGenesisEnvelopeV0({
      ...envelope,
      snapshot: {
        ...envelope.snapshot,
        runtime_metadata: { ...envelope.snapshot.runtime_metadata, state_revision: 2 }
      } as never
    });
    expect(badRevision.ok).toBe(false);
    const badChecksum = await verifyGenesisEnvelopeV0({
      ...envelope,
      full_snapshot_checksum: "sha256:7777777777777777777777777777777777777777777777777777777777777777" as never
    });
    expect(badChecksum.ok).toBe(false);
    const mintOutcome = await mintTrustedCanonicalHistoryBoundaryV0({
      genesis: { ...envelope, commit_head: { commit_ref: "commit:abc" as never, record_checksum: envelope.state_hash } },
      head: trustedHead()
    });
    expect(mintOutcome.kind).toBe("REJECTED");
    if (mintOutcome.kind === "REJECTED") expect(mintOutcome.code).toBe("INVALID_GENESIS");
  });

  it("enforces the head structural law (revision ↔ head-field coherence, closed shape)", () => {
    expect(validateTrustedCanonicalHeadInputV0(trustedHead()).ok).toBe(true);
    expect(
      validateTrustedCanonicalHeadInputV0(trustedHead({ commit_ref: "commit:abc" as never })).ok
    ).toBe(false);
    expect(
      validateTrustedCanonicalHeadInputV0(
        trustedHead({
          revision: 3,
          commit_ref: "commit:abc" as never,
          record_checksum: null
        })
      ).ok
    ).toBe(false);
    expect(validateTrustedCanonicalHeadInputV0({ schema_version: "trusted-canonical-head-v0" }).ok).toBe(
      false
    );
  });

  it("admits only issuer-minted receipts: structural clones and lookalikes rejected", async () => {
    const envelope = await genesisEnvelope();
    const outcome = await mintTrustedCanonicalHistoryBoundaryV0({
      genesis: envelope,
      head: trustedHead()
    });
    if (outcome.kind !== "MINTED") throw new Error("fixture mint failed");
    const receipt = outcome.receipt;
    expect(isTrustedCanonicalHistoryBoundaryReceiptV0(receipt)).toBe(true);
    expect(isTrustedCanonicalHistoryBoundaryReceiptV0(structuredClone(receipt))).toBe(false);
    expect(isTrustedCanonicalHistoryBoundaryReceiptV0({ ...receipt })).toBe(false);
    expect(
      isTrustedCanonicalHistoryBoundaryReceiptV0({
        schema_version: "trusted-canonical-history-boundary-v0",
        genesis: envelope,
        head: trustedHead()
      })
    ).toBe(false);
    expect(isTrustedCanonicalHistoryBoundaryReceiptV0(null)).toBe(false);
  });

  it("deep-freezes the receipt so post-mint mutation is ineffective", async () => {
    const envelope = await genesisEnvelope();
    const outcome = await mintTrustedCanonicalHistoryBoundaryV0({
      genesis: envelope,
      head: trustedHead()
    });
    if (outcome.kind !== "MINTED") throw new Error("fixture mint failed");
    expect(() => {
      (outcome.receipt as unknown as Record<string, unknown>)["schema_version"] = "forged";
    }).toThrow(TypeError);
  });

  it("does NOT root-export the internal trusted-boundary issuer", () => {
    expect(Object.keys(runtimeIndex)).not.toContain("mintTrustedCanonicalHistoryBoundaryV0");
    expect(Object.keys(runtimeIndex)).not.toContain("createTrustedBoundary");
    expect(Object.keys(boundaryModule)).toContain("mintTrustedCanonicalHistoryBoundaryV0");
    // Public surface still exposes the types + read-only verification helpers.
    expect(Object.keys(runtimeIndex)).toContain("isTrustedCanonicalHistoryBoundaryReceiptV0");
    expect(Object.keys(runtimeIndex)).toContain("verifyGenesisEnvelopeV0");
  });
});
