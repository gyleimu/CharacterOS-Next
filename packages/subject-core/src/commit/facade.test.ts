/**
 * P2.3 Pre-Learning P0-1 — SubjectCoreFacade regression tests (two-call protocol).
 * Regression matrix items: 1 same-ID+same-fingerprint replay, 2 same-ID+changed-payload
 * reuse conflict, 3 durable terminal NO_OP, 4 OUTCOME_UNKNOWN reconciliation before
 * retry, 5 fake producer string without capability, 20 restart/replay identity
 * semantics (journal rebuilt from authoritative bundles).
 */

import { describe, expect, it } from "vitest";

import type {
  CanonicalTransitionProposalV1,
  ProducerAuthorizationSetV1
} from "../types/transition.js";
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

function timeProposal(transitionId: string, ticks = 5): Record<string, unknown> {
  return {
    schema_version: "canonical-transition-proposal-v1",
    transition_id: transitionId,
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

function authorization(issuer: ProducerAuthorizationIssuer): ProducerAuthorizationSetV1 {
  return issuer.issue([
    { producer: "affect", domain: "affect" },
    { producer: "regulation", domain: "regulation" }
  ]);
}

function preparedBinding(
  transitionId: string,
  payloadFingerprint: string = "sha256:0000000000000000000000000000000000000000000000000000000000000000"
): PreparedLogicalResultBindingV1 {
  return {
    prepared_result_ref: "workflow:w-1" as CanonicalRefV0,
    transition_id: transitionId as never,
    subject_id: "subject-s0" as never,
    transition_type: "Time" as never,
    payload_fingerprint: payloadFingerprint as never
  };
}

interface Harness {
  facade: SubjectCoreFacade;
  store: InMemoryAtomicCommitStore;
  journal: InMemoryTransitionIdentityJournal;
  initial: SubjectStateV0;
  issuer: ProducerAuthorizationIssuer;
}

function buildHarness(overrides: { nextFault?: () => "OUTCOME_UNKNOWN" | undefined } = {}): Harness {
  const initial = s0() as unknown as SubjectStateV0;
  const store = new InMemoryAtomicCommitStore(overrides.nextFault ? { nextFault: overrides.nextFault } : {});
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
    preparedResultValidator: async (binding) =>
      binding.prepared_result_ref === "workflow:w-1" &&
      binding.transition_id === (store.readCommittedByTransitionId(binding.transition_id)?.transition_id ?? binding.transition_id),
    referenceValidator: async () => true
  };
  return { facade: new SubjectCoreFacade(ports), store, journal, initial, issuer };
}

async function reserveAndCommit(
  harness: Harness,
  proposal: Record<string, unknown>
): Promise<Awaited<ReturnType<SubjectCoreFacade["commitReserved"]>>> {
  const reserved = await harness.facade.reserveAndRoute(proposal as unknown as CanonicalTransitionProposalV1);
  expect(reserved.kind).toBe("CONTINUE");
  if (reserved.kind !== "CONTINUE") throw new Error("expected continuation");
  return harness.facade.commitReserved({
    proposal: proposal as unknown as CanonicalTransitionProposalV1,
    continuation: reserved.continuation,
    producerAuthorization: authorization(harness.issuer),
    preparedBinding: preparedBinding(proposal["transition_id"] as string, reserved.continuation.payload_fingerprint),
    repository_bindings: R0_BINDINGS
  });
}

describe("two-call protocol — idempotency and identity", () => {
  it("1: same ID + same fingerprint replay returns the original authoritative outcome", async () => {
    const h = buildHarness();
    const first = await reserveAndCommit(h, timeProposal("t-replay-1"));
    expect(first.kind).toBe("COMMITTED");

    const replay = await h.facade.reserveAndRoute(
      timeProposal("t-replay-1") as unknown as CanonicalTransitionProposalV1
    );
    expect(replay.kind).toBe("ALREADY_COMMITTED");
    if (replay.kind === "ALREADY_COMMITTED") {
      expect(replay.bundle.transition_id).toBe("t-replay-1");
      expect(h.store.getCommittedBundles()).toHaveLength(1);
      expect(h.store.currentRevision("subject-s0")).toBe(1);
    }
  });

  it("2: same ID + changed payload records a durable reuse conflict", async () => {
    const h = buildHarness();
    await reserveAndCommit(h, timeProposal("t-reuse-1", 5));

    const changed = await h.facade.reserveAndRoute(
      timeProposal("t-reuse-1", 7) as unknown as CanonicalTransitionProposalV1
    );
    expect(changed.kind).toBe("REUSE_CONFLICT");
    if (changed.kind !== "REUSE_CONFLICT") return;
    expect(changed.error_code).toBe("TRANSITION_ID_REUSE");
    // Durable conflict record in the journal (restart-rebuildable via export).
    const record = await h.journal.readRecord("t-reuse-1" as never);
    expect(record?.reuse_conflicts).toHaveLength(1);
    expect(record?.reuse_conflicts[0]?.error_code).toBe("TRANSITION_ID_REUSE");
    expect(h.store.getCommittedBundles()).toHaveLength(1);
  });

  it("3: terminalizeReservedNoOp stores a durable terminal NO_OP record", async () => {
    const h = buildHarness();
    const proposal = {
      schema_version: "canonical-transition-proposal-v1",
      transition_id: "t-noop-1",
      subject_id: "subject-s0",
      transition_type: "Time",
      expected_state_revision: 0,
      time_input: { kind: "ELAPSED", elapsed_time: { value: 0, unit: "tick" } },
      cause_refs: [],
      domain_deltas: [],
      external_refs: []
    } as unknown as CanonicalTransitionProposalV1;
    const reserved = await h.facade.reserveAndRoute(proposal);
    expect(reserved.kind).toBe("CONTINUE");
    if (reserved.kind !== "CONTINUE") return;
    const outcome = await h.facade.terminalizeReservedNoOp({
      proposal,
      continuation: reserved.continuation,
      producerAuthorization: h.issuer.issue([]),
      preparedBinding: preparedBinding("t-noop-1", reserved.continuation.payload_fingerprint)
    });
    expect(outcome.kind).toBe("NO_OP");
    const record = await h.journal.readRecord("t-noop-1" as never);
    expect(record?.terminal_status).toBe("NO_OP");
    expect(record?.terminal_result_ref).not.toBeNull();
    expect(record?.attempts).toHaveLength(1);
    expect(record?.attempts[0]?.status).toBe("NO_OP");
    expect(h.store.getCommittedBundles()).toHaveLength(0); // NO_OP never touches the store

    // Replay routes the durable terminal.
    const replay = await h.facade.reserveAndRoute(proposal);
    expect(replay.kind).toBe("TERMINAL_NO_OP");
  });

  it("4: OUTCOME_UNKNOWN requires reconcile before retry; mutation runs exactly once", async () => {
    let faultCount = 0;
    const h = buildHarness({
      nextFault: () => (faultCount++ === 0 ? "OUTCOME_UNKNOWN" : undefined)
    });
    const proposal = timeProposal("t-unknown-1");
    const reserved = await h.facade.reserveAndRoute(proposal as unknown as CanonicalTransitionProposalV1);
    expect(reserved.kind).toBe("CONTINUE");
    if (reserved.kind !== "CONTINUE") return;

    const first = await h.facade.commitReserved({
      proposal: proposal as unknown as CanonicalTransitionProposalV1,
      continuation: reserved.continuation,
      producerAuthorization: authorization(h.issuer),
      preparedBinding: preparedBinding("t-unknown-1", reserved.continuation.payload_fingerprint),
      repository_bindings: R0_BINDINGS
    });
    expect(first.kind).toBe("UNRESOLVED");

    // Reconcile first: nothing committed ⇒ safe retry.
    const reconciled = await h.facade.reconcile(
      "t-unknown-1" as never,
      "subject-s0" as never,
      "sha256:0".repeat(64) as never
    );
    expect(reconciled.kind).toBe("NOT_COMMITTED");

    const second = await h.facade.commitReserved({
      proposal: proposal as unknown as CanonicalTransitionProposalV1,
      continuation: reserved.continuation,
      producerAuthorization: authorization(h.issuer),
      preparedBinding: preparedBinding("t-unknown-1", reserved.continuation.payload_fingerprint),
      repository_bindings: R0_BINDINGS
    });
    expect(second.kind).toBe("COMMITTED");
    expect(h.store.getCommittedBundles()).toHaveLength(1); // mutation ran exactly once
  });

  it("5: self-declared producer string without the capability is rejected", async () => {
    const h = buildHarness();
    const proposal = timeProposal("t-forged-1");
    const reserved = await h.facade.reserveAndRoute(proposal as unknown as CanonicalTransitionProposalV1);
    expect(reserved.kind).toBe("CONTINUE");
    if (reserved.kind !== "CONTINUE") return;

    // Attacker claims affect/regulation pairs WITHOUT the authorization capability.
    const forged = await h.facade.commitReserved({
      proposal: proposal as unknown as CanonicalTransitionProposalV1,
      continuation: reserved.continuation,
      producerAuthorization: {
        schema_version: "producer-authorization-set-v1",
        bindings: [{ producer: "memory", domain: "memory-content" }]
      },
      preparedBinding: preparedBinding("t-forged-1"),
      repository_bindings: R0_BINDINGS
    });
    expect(forged.kind).toBe("REJECTED");
    if (forged.kind === "REJECTED") {
      expect(forged.failure.error_code).toBe("UNAUTHORIZED_PRODUCER");
    }
    expect(h.store.getCommittedBundles()).toHaveLength(0);
  });

  it("5b: a forged memory producer claim dies at the earliest gate (admission ownership)", async () => {
    const h = buildHarness();
    const forgedProposal = {
      schema_version: "canonical-transition-proposal-v1",
      transition_id: "t-forged-mem-1",
      subject_id: "subject-s0",
      transition_type: "Time",
      expected_state_revision: 0,
      time_input: { kind: "ELAPSED", elapsed_time: { value: 5, unit: "tick" } },
      cause_refs: [],
      domain_deltas: [
        {
          producer: "memory",
          domain: "memory-content",
          expected_repository_revision: "R0",
          operations: [{ path: "/memory_state/repository_revision", value: "R1" }],
          provenance_refs: []
        }
      ],
      external_refs: []
    };
    // Memory paths are never writable by Time: the forged claim is blocked during
    // reserveAndRoute admission (ownership gate) — before any commit path exists.
    await expect(
      h.facade.reserveAndRoute(forgedProposal as unknown as CanonicalTransitionProposalV1)
    ).rejects.toThrow(/not writable by transition Time/);
    expect(h.store.getCommittedBundles()).toHaveLength(0);
    // Admission rejection happens BEFORE any journal reservation exists.
    await expect(h.journal.readRecord("t-forged-mem-1" as never)).resolves.toBeNull();
  });

  it("20: restart replay preserves identity semantics via bundle-rebuilt journal", async () => {
    const h = buildHarness();
    await reserveAndCommit(h, timeProposal("t-restart-1", 3));

    // "Restart": fresh journal + fresh facade over the SAME authoritative store.
    const freshJournal = new InMemoryTransitionIdentityJournal();
    freshJournal.rebuildFromCommittedBundles(h.store.getCommittedBundles());
    const restartedIssuer = createProducerAuthorizationIssuer();
    const ports: SubjectCoreFacadePorts = {
      store: h.store,
      journal: freshJournal,
      producerAuthorizationVerifier: async (set) => restartedIssuer.verify(set),
      stateReader: {
        async readCurrentSnapshot(subjectId: IdentifierV0) {
          const bundle = h.store.readCurrentBundle(subjectId);
          return bundle !== null ? bundle.next_snapshot : h.initial;
        }
      },
      preparedResultValidator: async () => true,
      referenceValidator: async () => true
    };
    const restarted = new SubjectCoreFacade(ports);

    // Same ID + same payload → original committed truth (no double mutation).
    const replay = await restarted.reserveAndRoute(
      timeProposal("t-restart-1", 3) as unknown as CanonicalTransitionProposalV1
    );
    expect(replay.kind).toBe("ALREADY_COMMITTED");

    // Same ID + changed payload → still detected after restart.
    const changed = await restarted.reserveAndRoute(
      timeProposal("t-restart-1", 9) as unknown as CanonicalTransitionProposalV1
    );
    expect(changed.kind).toBe("REUSE_CONFLICT");
    expect(h.store.getCommittedBundles()).toHaveLength(1);
  });
});
