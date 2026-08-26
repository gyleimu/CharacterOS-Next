/**
 * P2.3 Trust-Boundary Closure Round 2 — adversarial regression suite (§17).
 * Each test reproduces one red-team attack (ATTACK A–I) and pins the closed
 * boundary. During a fix slice a test goes red against the vulnerable code and
 * green once the boundary is closed; in a closed tree all tests stay green.
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
import { createInMemorySubjectCoreFacade } from "./reference.js";
import {
  createProducerAuthorizationIssuer,
  type ProducerAuthorizationIssuer
} from "./producer-authorization.js";

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

function authorization(issuer: ProducerAuthorizationIssuer) {
  return issuer.issue([
    { producer: "affect", domain: "affect" },
    { producer: "regulation", domain: "regulation" }
  ]);
}

function preparedBinding(transitionId: string): PreparedLogicalResultBindingV1 {
  return {
    prepared_result_ref: "workflow:w-1" as CanonicalRefV0,
    transition_id: transitionId as never,
    subject_id: "subject-s0" as never,
    transition_type: "Time" as never,
    payload_fingerprint: "sha256:0000000000000000000000000000000000000000000000000000000000000000" as never
  };
}

interface Harness {
  facade: SubjectCoreFacade;
  store: InMemoryAtomicCommitStore;
  journal: InMemoryTransitionIdentityJournal;
  initial: SubjectStateV0;
  issuer: ProducerAuthorizationIssuer;
}

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
    // Verdict over the trusted record itself; the identity-tuple bind
    // (transition_id/subject_id/transition_type/payload_fingerprint) is
    // enforced by the facade against the journal record, never trusted here.
    preparedResultValidator: async (binding) => binding.prepared_result_ref === "workflow:w-1",
    referenceValidator: async () => true
  };
  return { facade: new SubjectCoreFacade(ports), store, journal, initial, issuer };
}

async function reserveAndCommitHarness(
  h: Harness,
  proposal: Record<string, unknown>
): Promise<Awaited<ReturnType<SubjectCoreFacade["commitReserved"]>>> {
  const reserved = await h.facade.reserveAndRoute(proposal as unknown as CanonicalTransitionProposalV1);
  expect(reserved.kind).toBe("CONTINUE");
  if (reserved.kind !== "CONTINUE") throw new Error("expected continuation");
  return h.facade.commitReserved({
    proposal: proposal as unknown as CanonicalTransitionProposalV1,
    continuation: reserved.continuation,
    producerAuthorization: authorization(h.issuer),
    preparedBinding: preparedBinding(proposal["transition_id"] as string),
    repository_bindings: R0_BINDINGS
  });
}

describe("adversarial regression — trust-boundary closure round 2", () => {
  it("A1: ATTACK A — commitReserved cannot commit a different proposal under a reserved continuation", async () => {
    const h = buildHarness();
    const proposalA = timeProposal("t-attack-a", 5);
    const reserved = await h.facade.reserveAndRoute(proposalA as unknown as CanonicalTransitionProposalV1);
    expect(reserved.kind).toBe("CONTINUE");
    if (reserved.kind !== "CONTINUE") return;

    // Attacker swaps the payload (ticks 5 → 99) but keeps continuation A.
    const proposalB = timeProposal("t-attack-a", 99);
    await expect(
      h.facade.commitReserved({
        proposal: proposalB as unknown as CanonicalTransitionProposalV1,
        continuation: reserved.continuation,
        producerAuthorization: authorization(h.issuer),
        preparedBinding: preparedBinding("t-attack-a"),
        repository_bindings: R0_BINDINGS
      })
    ).rejects.toThrow(/COMMIT_CHAIN_INTEGRITY_FAILURE\/SS-RESTORE-001/);
    expect(h.store.getCommittedBundles()).toHaveLength(0);
  });

  it("A1b: ATTACK A — NO_OP terminalization is equally bound to the reserved proposal", async () => {
    const h = buildHarness();
    const zeroProposal = {
      schema_version: "canonical-transition-proposal-v1",
      transition_id: "t-attack-a-noop",
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

    // Attacker terminalizes NO_OP with a mutated (still syntax-valid) proposal:
    // same zero elapsed, but a smuggled external ref changes the fingerprint.
    const mutated = {
      ...zeroProposal,
      external_refs: ["workflow:smuggled"]
    } as unknown as CanonicalTransitionProposalV1;
    await expect(
      h.facade.terminalizeReservedNoOp({
        proposal: mutated,
        continuation: reserved.continuation,
        producerAuthorization: h.issuer.issue([]),
        preparedBinding: preparedBinding("t-attack-a-noop")
      })
    ).rejects.toThrow(/COMMIT_CHAIN_INTEGRITY_FAILURE\/SS-RESTORE-001/);
    const record = await h.journal.readRecord("t-attack-a-noop" as never);
    expect(record?.terminal_status).toBeNull();
  });

  it("C1: ATTACK C — prepared binding must bind the reserved identity tuple", async () => {
    const h = buildHarness();
    const proposal = timeProposal("t-attack-c", 5);
    const reserved = await h.facade.reserveAndRoute(proposal as unknown as CanonicalTransitionProposalV1);
    expect(reserved.kind).toBe("CONTINUE");
    if (reserved.kind !== "CONTINUE") return;

    // Binding was minted for a DIFFERENT transition id: identity tuple mismatch.
    const foreignBinding = preparedBinding("t-some-other-transition");
    await expect(
      h.facade.commitReserved({
        proposal: proposal as unknown as CanonicalTransitionProposalV1,
        continuation: reserved.continuation,
        producerAuthorization: authorization(h.issuer),
        preparedBinding: foreignBinding,
        repository_bindings: R0_BINDINGS
      })
    ).rejects.toThrow(/COMMIT_CHAIN_INTEGRITY_FAILURE\/SS-RESTORE-001/);
    expect(h.store.getCommittedBundles()).toHaveLength(0);
  });

  it("C2: ATTACK C — missing prepared validator is fail-closed, never fail-open", () => {
    // The sanctioned reference assembly must refuse to mint a facade whose
    // prepared-result gate would silently accept every binding. The omission is
    // both a TYPE error (options are required) and a runtime throw (defense in
    // depth for untyped callers).
    expect(() => createInMemorySubjectCoreFacade({} as never)).toThrow(/preparedResultValidator/);
  });

  it("A-happy: an honest continuation still commits (no over-blocking)", async () => {
    const h = buildHarness();
    const proposal = timeProposal("t-attack-a-honest", 5);
    const reserved = await h.facade.reserveAndRoute(proposal as unknown as CanonicalTransitionProposalV1);
    expect(reserved.kind).toBe("CONTINUE");
    if (reserved.kind !== "CONTINUE") return;
    const outcome = await h.facade.commitReserved({
      proposal: proposal as unknown as CanonicalTransitionProposalV1,
      continuation: reserved.continuation,
      producerAuthorization: authorization(h.issuer),
      preparedBinding: preparedBinding("t-attack-a-honest"),
      repository_bindings: R0_BINDINGS
    });
    expect(outcome.kind).toBe("COMMITTED");
  });

  it("B1: ATTACK B — store CAS keys on state revision, never the per-transition identity version", async () => {
    const h = buildHarness();
    // First honest transition commits revision 1 (its journal record ends at
    // record_version > 1 after the committed attempt is appended).
    const first = await reserveAndCommitHarness(h, timeProposal("t-attack-b-first", 3));
    expect(first.kind).toBe("COMMITTED");

    // A NEW transition identity arrives with its own record_version = 1. A store
    // CAS that conflates subject-head revision with the previous transition's
    // identity record version rejects this honest successor with COMMIT_CONFLICT.
    const reserved = await h.facade.reserveAndRoute(
      timeProposal("t-attack-b-second", 4, 1) as unknown as CanonicalTransitionProposalV1
    );
    expect(reserved.kind).toBe("CONTINUE");
    if (reserved.kind !== "CONTINUE") return;
    const second = await h.facade.commitReserved({
      proposal: timeProposal("t-attack-b-second", 4, 1) as unknown as CanonicalTransitionProposalV1,
      continuation: reserved.continuation,
      producerAuthorization: authorization(h.issuer),
      preparedBinding: preparedBinding("t-attack-b-second"),
      repository_bindings: R0_BINDINGS
    });
    expect(second.kind).toBe("COMMITTED");
    if (second.kind !== "COMMITTED") return;
    expect(second.bundle.next_revision).toBe(2);
    expect(h.store.currentRevision("subject-s0")).toBe(2);
    expect(h.store.getCommittedBundles()).toHaveLength(2);
  });

  it("A-reconcile: reconcile binds committed truth to subject and fingerprint claims", async () => {
    const h = buildHarness();
    const proposal = timeProposal("t-attack-a-recon", 5);
    const reserved = await h.facade.reserveAndRoute(proposal as unknown as CanonicalTransitionProposalV1);
    expect(reserved.kind).toBe("CONTINUE");
    if (reserved.kind !== "CONTINUE") return;
    const outcome = await h.facade.commitReserved({
      proposal: proposal as unknown as CanonicalTransitionProposalV1,
      continuation: reserved.continuation,
      producerAuthorization: authorization(h.issuer),
      preparedBinding: preparedBinding("t-attack-a-recon"),
      repository_bindings: R0_BINDINGS
    });
    expect(outcome.kind).toBe("COMMITTED");
    if (outcome.kind !== "COMMITTED") return;
    const committedFingerprint = outcome.bundle.payload_fingerprint;

    // Matching claim → original committed truth.
    const matched = await h.facade.reconcile(
      "t-attack-a-recon" as never,
      "subject-s0" as never,
      committedFingerprint
    );
    expect(matched.kind).toBe("COMMITTED");

    // A different fingerprint claim under the same id is a durable conflict.
    const mismatched = await h.facade.reconcile(
      "t-attack-a-recon" as never,
      "subject-s0" as never,
      ("sha256:" + "f".repeat(64)) as never
    );
    expect(mismatched.kind).toBe("COMMIT_CONFLICT");
  });

  it("D1: ATTACK D — a structurally identical forged authorization set is refused", async () => {
    const h = buildHarness();
    const proposal = timeProposal("t-attack-d", 5);
    const reserved = await h.facade.reserveAndRoute(proposal as unknown as CanonicalTransitionProposalV1);
    expect(reserved.kind).toBe("CONTINUE");
    if (reserved.kind !== "CONTINUE") return;

    // The attacker constructs a set with the EXACT same shape and bindings as a
    // legitimately minted one. It never passed through the issuer, so the
    // capability gate must refuse it even though it is structurally valid.
    const forged = {
      schema_version: "producer-authorization-set-v1",
      bindings: [
        { producer: "affect", domain: "affect" },
        { producer: "regulation", domain: "regulation" }
      ]
    } as never;
    const outcome = await h.facade.commitReserved({
      proposal: proposal as unknown as CanonicalTransitionProposalV1,
      continuation: reserved.continuation,
      producerAuthorization: forged,
      preparedBinding: preparedBinding("t-attack-d"),
      repository_bindings: R0_BINDINGS
    });
    expect(outcome.kind).toBe("REJECTED");
    if (outcome.kind === "REJECTED") {
      expect(outcome.failure.error_code).toBe("UNAUTHORIZED_PRODUCER");
    }
    expect(h.store.getCommittedBundles()).toHaveLength(0);
  });
});
