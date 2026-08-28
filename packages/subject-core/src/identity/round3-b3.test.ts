/**
 * P2.3 Trust-Boundary Surgical Closure Round 3 — B3 honest-path journal import
 * semantics regressions (B3.4–B3.8).
 *
 * Complements journal.test.ts (forged-record rejection): every record under test
 * here is produced by ACTUAL supported runtime paths (reserveAndRoute →
 * commitReserved / terminalizeReservedNoOp), then exported and re-imported into a
 * fresh journal. Semantic validation must accept honest records byte-for-byte and
 * preserve replay / reuse-conflict routing after restart.
 */

import { describe, expect, it } from "vitest";

import type { CanonicalTransitionProposalV1 } from "../types/transition.js";
import type { PreparedLogicalResultBindingV1 } from "../types/result.js";
import type { SubjectStateV0 } from "../types/subject-state.js";
import type { CanonicalRefV0 } from "../types/ref.js";
import type { RepositoryRevisionBindingV1 } from "../types/persistence.js";
import type { IdentifierV0 } from "../types/scalars.js";
import { InMemoryAtomicCommitStore } from "../commit/store.js";
import { InMemoryTransitionIdentityJournal } from "./journal.js";
import { SubjectCoreFacade, type SubjectCoreFacadePorts } from "../commit/facade.js";
import {
  createProducerAuthorizationIssuer,
  type ProducerAuthorizationIssuer
} from "../commit/producer-authorization.js";

const HASH_V1_R0_REPOSITORY = "sha256:85755634de984070ca6c12d5dd01fb545e0efea635000e0e0044c589f3fcbb00";

const R0_BINDINGS = [
  { repository_revision: "R0", repository_revision_hash: HASH_V1_R0_REPOSITORY }
] as unknown as RepositoryRevisionBindingV1[];

function s0(): Record<string, unknown> {
  return {
    schema_version: "subject-state-v1",
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

function zeroProposal(transitionId: string): CanonicalTransitionProposalV1 {
  return {
    schema_version: "canonical-transition-proposal-v1",
    transition_id: transitionId,
    subject_id: "subject-s0",
    transition_type: "Time",
    expected_state_revision: 0,
    time_input: { kind: "ELAPSED", elapsed_time: { value: 0, unit: "tick" } },
    cause_refs: [],
    domain_deltas: [],
    external_refs: []
  } as unknown as CanonicalTransitionProposalV1;
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
    preparedResultValidator: async (binding) => binding.prepared_result_ref === "workflow:w-b3",
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

function bindingFor(
  transitionId: string,
  fingerprint: string,
  transitionType: string = "Time"
): PreparedLogicalResultBindingV1 {
  return {
    prepared_result_ref: "workflow:w-b3" as CanonicalRefV0,
    transition_id: transitionId as never,
    subject_id: "subject-s0" as never,
    transition_type: transitionType as never,
    payload_fingerprint: fingerprint as never
  };
}

/** Populates one journal with honest NO_OP + COMMITTED + OPEN records. */
async function seedHonestRecords(h: Harness): Promise<void> {
  // NO_OP FIRST (revision stays 0) — durable terminalization of a zero-delta
  // Time proposal.
  const noOp = zeroProposal("t-b3-honest-noop");
  const reservedNoOp = await h.facade.reserveAndRoute(noOp);
  expect(reservedNoOp.kind).toBe("CONTINUE");
  if (reservedNoOp.kind !== "CONTINUE") return;
  const noOpOutcome = await h.facade.terminalizeReservedNoOp({
    proposal: noOp,
    continuation: reservedNoOp.continuation,
    producerAuthorization: h.issuer.issue([]),
    preparedBinding: bindingFor("t-b3-honest-noop", reservedNoOp.continuation.payload_fingerprint)
  });
  expect(noOpOutcome.kind).toBe("NO_OP");

  // COMMITTED — real commit through the full two-call protocol (expected
  // revision is still 0: NO_OP never advances authority).
  const commitProposal = timeProposal("t-b3-honest-committed");
  const reservedCommit = await h.facade.reserveAndRoute(
    commitProposal as unknown as CanonicalTransitionProposalV1
  );
  expect(reservedCommit.kind).toBe("CONTINUE");
  if (reservedCommit.kind !== "CONTINUE") return;
  const committed = await h.facade.commitReserved({
    proposal: commitProposal as unknown as CanonicalTransitionProposalV1,
    continuation: reservedCommit.continuation,
    producerAuthorization: authorization(h.issuer),
    preparedBinding: bindingFor("t-b3-honest-committed", reservedCommit.continuation.payload_fingerprint),
    repository_bindings: R0_BINDINGS
  });
  expect(committed.kind).toBe("COMMITTED");

  // OPEN — reserved, then "process loss" before the second call.
  const open = await h.facade.reserveAndRoute(
    timeProposal("t-b3-honest-open") as unknown as CanonicalTransitionProposalV1
  );
  expect(open.kind).toBe("CONTINUE");
}

function importIntoFreshJournal(source: InMemoryTransitionIdentityJournal): InMemoryTransitionIdentityJournal {
  const fresh = new InMemoryTransitionIdentityJournal();
  fresh.importState(source.exportState());
  return fresh;
}

describe("round 3 — B3 honest journal import semantics", () => {
  it("B3.4: honest COMMITTED export/import is accepted byte-for-byte", async () => {
    const h = buildHarness();
    await seedHonestRecords(h);

    const fresh = importIntoFreshJournal(h.journal);
    const restored = await fresh.readRecord("t-b3-honest-committed" as never);
    const original = await h.journal.readRecord("t-b3-honest-committed" as never);
    expect(restored).not.toBeNull();
    expect(restored).toEqual(original);
    expect(restored?.terminal_status).toBe("COMMITTED");
    expect(restored?.attempts.length).toBeGreaterThan(0);
  });

  it("B3.5: honest NO_OP export/import is accepted with its own terminal semantics", async () => {
    const h = buildHarness();
    await seedHonestRecords(h);

    const fresh = importIntoFreshJournal(h.journal);
    const restored = await fresh.readRecord("t-b3-honest-noop" as never);
    expect(restored?.terminal_status).toBe("NO_OP");
    expect(restored?.attempts).toHaveLength(1);
    expect(restored?.attempts[0]?.status).toBe("NO_OP");
    expect(restored?.terminal_result_ref).toBe(restored?.attempts[0]?.result_ref);
  });

  it("B3.6: honest OPEN export/import keeps the reservation retryable", async () => {
    const h = buildHarness();
    await seedHonestRecords(h);

    const fresh = importIntoFreshJournal(h.journal);
    const restored = await fresh.readRecord("t-b3-honest-open" as never);
    expect(restored?.terminal_status).toBeNull();
    expect(restored?.terminal_result_ref).toBeNull();
    expect(restored?.attempts).toHaveLength(0);
  });

  it("B3.7: after honest import, same ID + same payload replay keeps committed truth", async () => {
    const h = buildHarness();
    await seedHonestRecords(h);
    const fresh = importIntoFreshJournal(h.journal);

    // Replay on a facade wired to the SAME store but the imported journal.
    const ports: SubjectCoreFacadePorts = {
      store: h.store,
      journal: fresh,
      producerAuthorizationVerifier: async (set) => h.issuer.verify(set),
      stateReader: {
        async readCurrentSnapshot(subjectId: IdentifierV0) {
          const bundle = h.store.readCurrentBundle(subjectId);
          return bundle !== null ? bundle.next_snapshot : h.initial;
        }
      },
      preparedResultValidator: async (binding) => binding.prepared_result_ref === "workflow:w-b3",
      referenceValidator: async () => true
    };
    const facade = new SubjectCoreFacade(ports);

    const replay = await facade.reserveAndRoute(
      timeProposal("t-b3-honest-committed") as unknown as CanonicalTransitionProposalV1
    );
    expect(replay.kind).toBe("ALREADY_COMMITTED");
    expect(h.store.getCommittedBundles()).toHaveLength(1);
  });

  it("B3.8: after honest import, same ID + changed payload keeps the durable reuse conflict", async () => {
    const h = buildHarness();
    await seedHonestRecords(h);
    const fresh = importIntoFreshJournal(h.journal);

    const ports: SubjectCoreFacadePorts = {
      store: h.store,
      journal: fresh,
      producerAuthorizationVerifier: async (set) => h.issuer.verify(set),
      stateReader: {
        async readCurrentSnapshot(subjectId: IdentifierV0) {
          const bundle = h.store.readCurrentBundle(subjectId);
          return bundle !== null ? bundle.next_snapshot : h.initial;
        }
      },
      preparedResultValidator: async (binding) => binding.prepared_result_ref === "workflow:w-b3",
      referenceValidator: async () => true
    };
    const facade = new SubjectCoreFacade(ports);

    const conflict = await facade.reserveAndRoute(
      timeProposal("t-b3-honest-committed", 99) as unknown as CanonicalTransitionProposalV1
    );
    expect(conflict.kind).toBe("REUSE_CONFLICT");
    if (conflict.kind === "REUSE_CONFLICT") {
      expect(conflict.error_code).toBe("TRANSITION_ID_REUSE");
      expect(conflict.reason).toBe("IDEM-REUSE-001");
    }
    const record = await fresh.readRecord("t-b3-honest-committed" as never);
    expect(record?.terminal_status).toBe("COMMITTED");
    expect(record?.reuse_conflicts).toHaveLength(1);
    expect(h.store.getCommittedBundles()).toHaveLength(1);
  });

  it("import restores the first-seen sequence after honest multi-record export", async () => {
    const h = buildHarness();
    await seedHonestRecords(h);
    const fresh = importIntoFreshJournal(h.journal);

    // New reservations continue the sequence, never colliding with pre-restart ids.
    await fresh.reserveIdentity({
      transition_id: "t-b3-post-restart" as never,
      subject_id: "subject-s0" as IdentifierV0,
      transition_type: "Time",
      proposal_ref: "proposal:p-post" as CanonicalRefV0,
      payload_fingerprint: (`sha256:${"7".repeat(64)}`) as never
    });
    const maxPreRestart = Math.max(
      ...h.journal.exportState().map((r) => r.first_seen_sequence as number)
    );
    const post = await fresh.readRecord("t-b3-post-restart" as never);
    expect((post?.first_seen_sequence as number) ?? 0).toBeGreaterThan(maxPreRestart);
  });
});
