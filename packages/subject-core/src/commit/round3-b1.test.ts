/**
 * P2.3 Trust-Boundary Surgical Closure Round 3 — B1 prepared-result fingerprint
 * binding regressions.
 *
 * Red-team finding (BLOCKER B1): the facade bound PreparedLogicalResultBindingV1
 * to the reserved (transition_id, subject_id, transition_type) triple but never
 * compared binding.payload_fingerprint against the authoritative reservation
 * fingerprint, so a binding with an all-zero or foreign fingerprint committed.
 * Frozen §7.6: "Subject-core compares only the binding's ref/identity/fingerprint
 * and carries the ref into the atomic bundle."
 *
 * Required invariant (SubjectCore-owned, never delegable to the host validator):
 *   reservedFingerprint == submittedProposalFingerprint == binding.payload_fingerprint
 */

import { describe, expect, it } from "vitest";

import type { CanonicalTransitionProposalV1 } from "../types/transition.js";
import type { PreparedLogicalResultBindingV1 } from "../types/result.js";
import type { SubjectStateV0 } from "../types/subject-state.js";
import type { CanonicalRefV0 } from "../types/ref.js";
import type { RepositoryRevisionBindingV1 } from "../types/persistence.js";
import type { IdentifierV0 } from "../types/scalars.js";
import { InMemoryAtomicCommitStore } from "./store.js";
import { InMemoryTransitionIdentityJournal } from "../identity/journal.js";
import { SubjectCoreFacade, type SubjectCoreFacadePorts } from "./facade.js";
import {
  createProducerAuthorizationIssuer,
  type ProducerAuthorizationIssuer
} from "./producer-authorization.js";

const HASH_V1_R0_REPOSITORY = "sha256:85755634de984070ca6c12d5dd01fb545e0efea635000e0e0044c589f3fcbb00";

const R0_BINDINGS = [
  { repository_revision: "R0", repository_revision_hash: HASH_V1_R0_REPOSITORY }
] as unknown as RepositoryRevisionBindingV1[];

const ALL_ZERO_FINGERPRINT = `sha256:${"0".repeat(64)}`;

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

function timeProposal(transitionId: string, ticks = 5, expectedRevision = 0): Record<string, unknown> {
  return {
    schema_version: "canonical-transition-proposal-v1",
    transition_id: transitionId,
    subject_id: "subject-s0",
    transition_type: "Time",
    expected_state_revision: expectedRevision,
    time_input: { kind: "ELAPSED", elapsed_time: { value: ticks, unit: "tick" } },
    cause_refs: [],
    domain_deltas: [
      {
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
      },
      {
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
      }
    ],
    external_refs: []
  };
}

interface Harness {
  facade: SubjectCoreFacade;
  store: InMemoryAtomicCommitStore;
  journal: InMemoryTransitionIdentityJournal;
  initial: SubjectStateV0;
  issuer: ProducerAuthorizationIssuer;
}

/**
 * The host validator is wired WIDE OPEN on purpose: every B1 regression proves
 * that the fingerprint equality is enforced by SubjectCore itself and can never
 * be overridden or weakened by a cooperating (or compromised) validator.
 */
function buildHarness(): Harness {
  const initial = s0() as unknown as SubjectStateV0;
  const store = new InMemoryAtomicCommitStore();
  const journal = new InMemoryTransitionIdentityJournal();
  const issuer = createProducerAuthorizationIssuer();
  const ports: SubjectCoreFacadePorts = {
    store,
    journal,
    producerAuthorizationVerifier: async (set) => issuer.verify(set),
    stateReader: {
      async readCurrentSnapshot(subjectId: IdentifierV0) {
        const bundle = store.readCurrentBundle(subjectId);
        return bundle !== null ? bundle.next_snapshot : initial;
      }
    },
    preparedResultValidator: async () => true,
    referenceValidator: async () => true
  };
  return { facade: new SubjectCoreFacade(ports), store, journal, initial, issuer };
}

function authorization(issuer: ProducerAuthorizationIssuer) {
  return issuer.issue([
    { producer: "affect", domain: "affect" },
    { producer: "regulation", domain: "regulation" }
  ]);
}

function binding(transitionId: string, fingerprint: string): PreparedLogicalResultBindingV1 {
  return {
    prepared_result_ref: "workflow:w-r3" as CanonicalRefV0,
    transition_id: transitionId as never,
    subject_id: "subject-s0" as never,
    transition_type: "Time" as never,
    payload_fingerprint: fingerprint as never
  };
}

describe("round 3 — B1 prepared-result fingerprint binding", () => {
  it("B1.1: the binding carrying the exact reserved fingerprint commits", async () => {
    const h = buildHarness();
    const proposal = timeProposal("t-r3-b1-correct", 5);
    const reserved = await h.facade.reserveAndRoute(proposal as unknown as CanonicalTransitionProposalV1);
    expect(reserved.kind).toBe("CONTINUE");
    if (reserved.kind !== "CONTINUE") return;

    const outcome = await h.facade.commitReserved({
      proposal: proposal as unknown as CanonicalTransitionProposalV1,
      continuation: reserved.continuation,
      producerAuthorization: authorization(h.issuer),
      preparedBinding: binding("t-r3-b1-correct", reserved.continuation.payload_fingerprint),
      repository_bindings: R0_BINDINGS
    });
    expect(outcome.kind).toBe("COMMITTED");
    if (outcome.kind === "COMMITTED") {
      expect(outcome.bundle.payload_fingerprint).toBe(reserved.continuation.payload_fingerprint);
    }
    expect(h.store.getCommittedBundles()).toHaveLength(1);
  });

  it("B1.2: an all-zero binding fingerprint is rejected even with a wide-open validator", async () => {
    const h = buildHarness();
    const proposal = timeProposal("t-r3-b1-zero", 5);
    const reserved = await h.facade.reserveAndRoute(proposal as unknown as CanonicalTransitionProposalV1);
    expect(reserved.kind).toBe("CONTINUE");
    if (reserved.kind !== "CONTINUE") return;
    expect(reserved.continuation.payload_fingerprint).not.toBe(ALL_ZERO_FINGERPRINT);

    await expect(
      h.facade.commitReserved({
        proposal: proposal as unknown as CanonicalTransitionProposalV1,
        continuation: reserved.continuation,
        producerAuthorization: authorization(h.issuer),
        preparedBinding: binding("t-r3-b1-zero", ALL_ZERO_FINGERPRINT),
        repository_bindings: R0_BINDINGS
      })
    ).rejects.toThrow(/COMMIT_CHAIN_INTEGRITY_FAILURE\/SS-RESTORE-001/);
    expect(h.store.getCommittedBundles()).toHaveLength(0);
    expect(h.store.currentRevision("subject-s0" as never)).toBeNull();
  });

  it("B1.3: a fingerprint minted for another proposal is rejected", async () => {
    const h = buildHarness();
    const proposalA = timeProposal("t-r3-b1-a", 5);
    const proposalB = timeProposal("t-r3-b1-b", 99);
    const reservedA = await h.facade.reserveAndRoute(proposalA as unknown as CanonicalTransitionProposalV1);
    const reservedB = await h.facade.reserveAndRoute(proposalB as unknown as CanonicalTransitionProposalV1);
    expect(reservedA.kind).toBe("CONTINUE");
    expect(reservedB.kind).toBe("CONTINUE");
    if (reservedA.kind !== "CONTINUE" || reservedB.kind !== "CONTINUE") return;

    await expect(
      h.facade.commitReserved({
        proposal: proposalA as unknown as CanonicalTransitionProposalV1,
        continuation: reservedA.continuation,
        producerAuthorization: authorization(h.issuer),
        preparedBinding: binding("t-r3-b1-a", reservedB.continuation.payload_fingerprint),
        repository_bindings: R0_BINDINGS
      })
    ).rejects.toThrow(/COMMIT_CHAIN_INTEGRITY_FAILURE\/SS-RESTORE-001/);
    expect(h.store.getCommittedBundles()).toHaveLength(0);
  });

  it("B1.4: correct identity tuple but wrong fingerprint is rejected before any authority work", async () => {
    const h = buildHarness();
    const proposal = timeProposal("t-r3-b1-wrongfp", 5);
    const reserved = await h.facade.reserveAndRoute(proposal as unknown as CanonicalTransitionProposalV1);
    expect(reserved.kind).toBe("CONTINUE");
    if (reserved.kind !== "CONTINUE") return;

    // Exactly the reserved transition_id/subject_id/transition_type — only the
    // fingerprint is forged. The identity triple alone must never suffice.
    await expect(
      h.facade.commitReserved({
        proposal: proposal as unknown as CanonicalTransitionProposalV1,
        continuation: reserved.continuation,
        producerAuthorization: authorization(h.issuer),
        preparedBinding: binding("t-r3-b1-wrongfp", `sha256:${"b".repeat(64)}`),
        repository_bindings: R0_BINDINGS
      })
    ).rejects.toThrow(/COMMIT_CHAIN_INTEGRITY_FAILURE\/SS-RESTORE-001/);
    expect(h.store.getCommittedBundles()).toHaveLength(0);
    const record = await h.journal.readRecord("t-r3-b1-wrongfp" as never);
    expect(record?.terminal_status).toBeNull();
    expect(record?.attempts).toHaveLength(0);
  });

  it("B1.5: NO_OP terminalization enforces the same fingerprint bind", async () => {
    const h = buildHarness();
    const zeroProposal = {
      schema_version: "canonical-transition-proposal-v1",
      transition_id: "t-r3-b1-noop",
      subject_id: "subject-s0",
      transition_type: "Time",
      expected_state_revision: 0,
      time_input: { kind: "ELAPSED", elapsed_time: { value: 0, unit: "tick" } },
      cause_refs: [],
      domain_deltas: [],
      external_refs: []
    } as unknown as CanonicalTransitionProposalV1;
    const reserved = await h.facade.reserveAndRoute(zeroProposal);
    expect(reserved.kind).toBe("CONTINUE");
    if (reserved.kind !== "CONTINUE") return;

    // Forged fingerprint → terminalization refused; the identity stays OPEN.
    await expect(
      h.facade.terminalizeReservedNoOp({
        proposal: zeroProposal,
        continuation: reserved.continuation,
        producerAuthorization: h.issuer.issue([]),
        preparedBinding: binding("t-r3-b1-noop", ALL_ZERO_FINGERPRINT)
      })
    ).rejects.toThrow(/COMMIT_CHAIN_INTEGRITY_FAILURE\/SS-RESTORE-001/);
    expect((await h.journal.readRecord("t-r3-b1-noop" as never))?.terminal_status).toBeNull();

    // Honest fingerprint → terminalizes to NO_OP.
    const outcome = await h.facade.terminalizeReservedNoOp({
      proposal: zeroProposal,
      continuation: reserved.continuation,
      producerAuthorization: h.issuer.issue([]),
      preparedBinding: binding("t-r3-b1-noop", reserved.continuation.payload_fingerprint)
    });
    expect(outcome.kind).toBe("NO_OP");
    expect(h.store.getCommittedBundles()).toHaveLength(0);
  });
});
