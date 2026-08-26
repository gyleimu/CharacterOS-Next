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
import type { PipelineStageObserver } from "./engine.js";
import { createPersistenceEnvelope } from "../restore/envelope.js";
import { restoreFromEnvelope } from "../restore/restore.js";

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

const EXACT_RULE_IDS = [
  "HASH-DET-001",
  "SS-AUTH-001",
  "SS-IMMUTABLE-001",
  "SS-REVISION-001",
  "TR-ATOMIC-001",
  "TRACE-ATOMIC-001",
  "TRACE-CONTENT-001"
];

function traceEntry(seq: number): Record<string, unknown> {
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
    state_hash_before: `sha256:${"a".repeat(60)}0001`,
    state_hash_after: `sha256:${"a".repeat(60)}0002`,
    memory_revision_before: "R0",
    memory_revision_after: "R0",
    outcome: "COMMITTED"
  };
}

/** Structurally valid revision-1 snapshot (ATTACK E fixture body). */
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
    entries: [traceEntry(1)]
  };
  return s;
}

const FAKE_COMMIT_HEAD = {
  commit_ref: `commit:${"f".repeat(64)}`,
  record_checksum: `sha256:${"d".repeat(64)}`
} as never;

async function rev1EnvelopeWithFakeHead(): Promise<Record<string, unknown>> {
  const result = await createPersistenceEnvelope({
    snapshot: s1() as unknown as SubjectStateV0,
    repository_bindings: R0_BINDINGS,
    commit_head: FAKE_COMMIT_HEAD
  });
  if (!result.ok) throw new Error(`fixture envelope rejected: ${result.error.detail}`);
  return JSON.parse(JSON.stringify(result.value)) as Record<string, unknown>;
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

function preparedBinding(transitionId: string, transitionType: string = "Time"): PreparedLogicalResultBindingV1 {
  return {
    prepared_result_ref: "workflow:w-1" as CanonicalRefV0,
    transition_id: transitionId as never,
    subject_id: "subject-s0" as never,
    transition_type: transitionType as never,
    payload_fingerprint: "sha256:0000000000000000000000000000000000000000000000000000000000000000" as never
  };
}

/** Learning-typed proposal adopting `adoptedRevision` as the canonical memory revision. */
function learningProposal(transitionId: string, adoptedRevision: string): Record<string, unknown> {
  return {
    schema_version: "canonical-transition-proposal-v1",
    transition_id: transitionId,
    subject_id: "subject-s0",
    transition_type: "Learning",
    expected_state_revision: 0,
    time_input: { kind: "OCCURRENCE", occurrence_logical_time: 0 },
    cause_refs: [],
    domain_deltas: [
      {
        producer: "memory",
        domain: "memory-content",
        expected_repository_revision: adoptedRevision,
        operations: [{ path: "/memory_state/repository_revision", value: adoptedRevision }],
        provenance_refs: []
      }
    ],
    external_refs: []
  };
}

/** Sorted binding set covering current R0 plus an adopted revision with a FAKE hash. */
function adoptionBindings(adoptedRevision: string) {
  return [
    { repository_revision: "R0", repository_revision_hash: HASH_V1_R0_REPOSITORY },
    { repository_revision: adoptedRevision, repository_revision_hash: `sha256:${"9".repeat(64)}` }
  ] as unknown as RepositoryRevisionBindingV1[];
}

/**
 * ATTACK H fixture: every delta is individually schema-valid (layer 8 passes), but
 * the composed candidate violates a §6.2 cross-field invariant — mood.last_update
 * lies after the derived logical_time — so ONLY the whole-state gate (layer 10)
 * can catch it.
 */
function wholeStateViolationProposal(transitionId: string): Record<string, unknown> {
  const p = timeProposal(transitionId);
  const deltas = p["domain_deltas"] as Array<Record<string, unknown>>;
  const firstDelta = deltas[0];
  if (firstDelta === undefined) throw new Error("fixture invariant: first domain delta missing");
  const operations = firstDelta["operations"] as Array<Record<string, unknown>>;
  const moodOp = operations.find((op) => op["path"] === "/mood");
  if (moodOp === undefined) throw new Error("fixture invariant: /mood operation missing");
  (moodOp["value"] as Record<string, unknown>)["last_update"] = 9999;
  return p;
}

interface Harness {
  facade: SubjectCoreFacade;
  store: InMemoryAtomicCommitStore;
  journal: InMemoryTransitionIdentityJournal;
  initial: SubjectStateV0;
  issuer: ProducerAuthorizationIssuer;
}

function buildHarness(
  overrides: {
    memoryAdoptionValidator?: (adoption: {
      readonly subject_id: string;
      readonly current_repository_revision: string;
      readonly next_repository_revision: string;
      readonly candidate_memory_refs: readonly string[];
    }) => boolean | Promise<boolean>;
    referenceValidator?: (binding: RepositoryRevisionBindingV1) => boolean | Promise<boolean>;
    pipelineObserver?: PipelineStageObserver;
  } = {}
): Harness {
  const initial = s0() as unknown as SubjectStateV0;
  const store = new InMemoryAtomicCommitStore();
  const journal = new InMemoryTransitionIdentityJournal();
  const issuer = createProducerAuthorizationIssuer();
  const ports: SubjectCoreFacadePorts = {
    store,
    journal,
    producerAuthorizationVerifier: async (set) => issuer.verify(set),
    ...(overrides.memoryAdoptionValidator !== undefined
      ? { memoryAdoptionValidator: overrides.memoryAdoptionValidator as never }
      : {}),
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
    referenceValidator: overrides.referenceValidator ?? (async () => true),
    ...(overrides.pipelineObserver !== undefined
      ? { pipelineObserver: overrides.pipelineObserver }
      : {})
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

  it("E1: ATTACK E — revision>0 restore without chain proof is refused (fail-closed)", async () => {
    // Attacker persists a structurally valid revision-1 snapshot with a FAKE
    // commit head and self-consistent hashes. Without a commitChainVerifier the
    // old restore path succeeded (fail-open). It must now refuse: revision > 0
    // can only materialize with trusted commit-chain proof.
    const env = await rev1EnvelopeWithFakeHead();
    const r = await restoreFromEnvelope(env);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.failure.error_code).toBe("COMMIT_CHAIN_INTEGRITY_FAILURE");
      expect(r.failure.reason).toBe("SS-RESTORE-001");
    }
  });

  it("E2: ATTACK E — a denying chain verifier still rejects the forged head", async () => {
    const env = await rev1EnvelopeWithFakeHead();
    const r = await restoreFromEnvelope(JSON.parse(JSON.stringify(env)), {
      commitChainVerifier: async () => false
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.failure.error_code).toBe("COMMIT_CHAIN_INTEGRITY_FAILURE");
      expect(r.failure.reason).toBe("SS-RESTORE-001");
    }
  });

  it("E-happy: revision>0 restore succeeds when the chain verifier confirms", async () => {
    const env = await rev1EnvelopeWithFakeHead();
    const r = await restoreFromEnvelope(JSON.parse(JSON.stringify(env)), {
      commitChainVerifier: async (expected) =>
        expected.subject_id === "subject-s0" && expected.state_revision === 1
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.snapshot.runtime_metadata.state_revision).toBe(1);
  });

  it("E0: revision-0 genesis restore keeps working without chain proof (no over-blocking)", async () => {
    const result = await createPersistenceEnvelope({
      snapshot: s0() as unknown as SubjectStateV0,
      repository_bindings: R0_BINDINGS
    });
    if (!result.ok) throw new Error("fixture envelope rejected");
    const r = await restoreFromEnvelope(JSON.parse(JSON.stringify(result.value)));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.snapshot.runtime_metadata.state_revision).toBe(0);
  });

  it("H1: ATTACK F — memory adoption without a trusted validator is refused (fail-closed)", async () => {
    const h = buildHarness();
    const proposal = learningProposal("t-attack-h1", "R999");
    const reserved = await h.facade.reserveAndRoute(proposal as unknown as CanonicalTransitionProposalV1);
    expect(reserved.kind).toBe("CONTINUE");
    if (reserved.kind !== "CONTINUE") return;

    // Fake revision id + fake hashes, all schema-valid strings. No adoption
    // validator is wired, so the binding change MUST be refused fail-closed.
    const outcome = await h.facade.commitReserved({
      proposal: proposal as unknown as CanonicalTransitionProposalV1,
      continuation: reserved.continuation,
      producerAuthorization: h.issuer.issue([{ producer: "memory", domain: "memory-content" }]),
      preparedBinding: preparedBinding("t-attack-h1", "Learning"),
      repository_bindings: adoptionBindings("R999")
    });
    expect(outcome.kind).toBe("REJECTED");
    if (outcome.kind === "REJECTED") {
      expect(outcome.failure.error_code).toBe("INVALID_MEMORY_REVISION");
      expect(outcome.failure.reason).toBe("MEM-REV-001");
    }
    expect(h.store.getCommittedBundles()).toHaveLength(0);
  });

  it("H2: ATTACK F — a denying adoption validator rejects the forged revision", async () => {
    const h = buildHarness({ memoryAdoptionValidator: async () => false });
    const proposal = learningProposal("t-attack-h2", "R999");
    const reserved = await h.facade.reserveAndRoute(proposal as unknown as CanonicalTransitionProposalV1);
    expect(reserved.kind).toBe("CONTINUE");
    if (reserved.kind !== "CONTINUE") return;
    const outcome = await h.facade.commitReserved({
      proposal: proposal as unknown as CanonicalTransitionProposalV1,
      continuation: reserved.continuation,
      producerAuthorization: h.issuer.issue([{ producer: "memory", domain: "memory-content" }]),
      preparedBinding: preparedBinding("t-attack-h2", "Learning"),
      repository_bindings: adoptionBindings("R999")
    });
    expect(outcome.kind).toBe("REJECTED");
    if (outcome.kind === "REJECTED") {
      expect(outcome.failure.error_code).toBe("INVALID_MEMORY_REVISION");
      expect(outcome.failure.reason).toBe("MEM-REV-001");
    }
    expect(h.store.getCommittedBundles()).toHaveLength(0);
  });

  it("H-stale: ATTACK F — a stale adoption (parent drifted) is refused, never silently adopted", async () => {
    // The host validator models stale detection: it knows the adopted revision's
    // parent no longer equals the canonical current revision, so it denies.
    const seen: Array<{ current: string; next: string }> = [];
    const h = buildHarness({
      memoryAdoptionValidator: async (adoption) => {
        seen.push({
          current: adoption.current_repository_revision,
          next: adoption.next_repository_revision
        });
        return false; // R999 was prepared against a memory base that has since moved
      }
    });
    const proposal = learningProposal("t-attack-h-stale", "R999");
    const reserved = await h.facade.reserveAndRoute(proposal as unknown as CanonicalTransitionProposalV1);
    expect(reserved.kind).toBe("CONTINUE");
    if (reserved.kind !== "CONTINUE") return;
    const outcome = await h.facade.commitReserved({
      proposal: proposal as unknown as CanonicalTransitionProposalV1,
      continuation: reserved.continuation,
      producerAuthorization: h.issuer.issue([{ producer: "memory", domain: "memory-content" }]),
      preparedBinding: preparedBinding("t-attack-h-stale", "Learning"),
      repository_bindings: adoptionBindings("R999")
    });
    expect(outcome.kind).toBe("REJECTED");
    expect(seen).toEqual([{ current: "R0", next: "R999" }]);
    expect(h.store.getCommittedBundles()).toHaveLength(0);
  });

  it("H-happy: a validator-confirmed adoption commits (no over-blocking)", async () => {
    const h = buildHarness({
      memoryAdoptionValidator: async (adoption) =>
        adoption.current_repository_revision === "R0" && adoption.next_repository_revision === "R999"
    });
    const proposal = learningProposal("t-attack-h-honest", "R999");
    const reserved = await h.facade.reserveAndRoute(proposal as unknown as CanonicalTransitionProposalV1);
    expect(reserved.kind).toBe("CONTINUE");
    if (reserved.kind !== "CONTINUE") return;
    const outcome = await h.facade.commitReserved({
      proposal: proposal as unknown as CanonicalTransitionProposalV1,
      continuation: reserved.continuation,
      producerAuthorization: h.issuer.issue([{ producer: "memory", domain: "memory-content" }]),
      preparedBinding: preparedBinding("t-attack-h-honest", "Learning"),
      repository_bindings: adoptionBindings("R999")
    });
    expect(outcome.kind).toBe("COMMITTED");
    if (outcome.kind === "COMMITTED") {
      expect(outcome.bundle.next_snapshot.memory_state.repository_revision).toBe("R999");
    }
    expect(h.store.getCommittedBundles()).toHaveLength(1);
  });

  /**
   * ATTACK H instrumentation: records the exact stage order of the commit
   * pipeline so precedence regressions are observable, not merely inferred
   * from outcome codes.
   */
  function stageRecorder(): { events: string[]; observer: PipelineStageObserver } {
    const events: string[] = [];
    return {
      events,
      observer: {
        referenceValidation: () => events.push("reference-gate"),
        wholeStateValidation: () => events.push("whole-state"),
        authorityPreparation: () => events.push("authority")
      }
    };
  }

  it("J1: ATTACK H — multi-defect input reports the earliest failing layer (reference before whole-state)", async () => {
    // Double defect: the reference validator denies the binding (layer 9) AND
    // the composed candidate violates a §6.2 whole-state invariant (layer 10).
    // §13.4 frozen precedence requires the layer-9 failure to win; no
    // whole-state or authority work may happen after it.
    const recorder = stageRecorder();
    const h = buildHarness({
      referenceValidator: async () => false,
      pipelineObserver: recorder.observer
    });
    const outcome = await reserveAndCommitHarness(h, wholeStateViolationProposal("t-attack-j1"));
    expect(outcome.kind).toBe("REJECTED");
    if (outcome.kind === "REJECTED") {
      expect(outcome.failure.error_code).toBe("INVALID_MEMORY_REVISION");
      expect(outcome.failure.reason).toBe("MEM-REV-001");
    }
    expect(recorder.events).toEqual(["reference-gate"]);
    expect(h.store.getCommittedBundles()).toHaveLength(0);
  });

  it("J2: ATTACK H — a whole-state violation rejects before any canonical hash/trace/bundle work", async () => {
    const recorder = stageRecorder();
    const h = buildHarness({ pipelineObserver: recorder.observer });
    const outcome = await reserveAndCommitHarness(h, wholeStateViolationProposal("t-attack-j2"));
    expect(outcome.kind).toBe("REJECTED");
    if (outcome.kind === "REJECTED") {
      expect(outcome.failure.error_code).toBe("INVARIANT_VIOLATION");
      expect(outcome.failure.reason).toBe("SS-SCHEMA-001");
    }
    // Reference gate ran and passed, whole-state gate fired and rejected;
    // canonical authority preparation (hash/trace/bundle) never started.
    expect(recorder.events).toEqual(["reference-gate", "whole-state"]);
    expect(h.store.getCommittedBundles()).toHaveLength(0);
  });

  it("J-order: an honest commit runs reference → whole-state → authority in frozen order", async () => {
    const recorder = stageRecorder();
    const h = buildHarness({ pipelineObserver: recorder.observer });
    const outcome = await reserveAndCommitHarness(h, timeProposal("t-attack-j-order", 5));
    expect(outcome.kind).toBe("COMMITTED");
    expect(recorder.events).toEqual(["reference-gate", "whole-state", "authority"]);
    expect(h.store.getCommittedBundles()).toHaveLength(1);
  });

  /**
   * §16 restart: a fresh facade over the SAME authoritative store but a fresh
   * journal restored from the exported record set. Restart semantics must
   * preserve every durable identity fact.
   */
  function restartedHarness(h: Harness): Harness {
    const journal = new InMemoryTransitionIdentityJournal();
    journal.importState(h.journal.exportState());
    const ports: SubjectCoreFacadePorts = {
      store: h.store,
      journal,
      producerAuthorizationVerifier: async (set) => h.issuer.verify(set),
      stateReader: {
        async readCurrentSnapshot(subjectId: IdentifierV0) {
          const bundle = h.store.readCurrentBundle(subjectId);
          return bundle !== null ? bundle.next_snapshot : h.initial;
        }
      },
      preparedResultValidator: async (binding) => binding.prepared_result_ref === "workflow:w-1",
      referenceValidator: async () => true
    };
    return { facade: new SubjectCoreFacade(ports), store: h.store, journal, initial: h.initial, issuer: h.issuer };
  }

  it("A15: journal restart preserves COMMITTED identity (replay + reuse conflict)", async () => {
    const h = buildHarness();
    const committed = await reserveAndCommitHarness(h, timeProposal("t-attack-a15", 5));
    expect(committed.kind).toBe("COMMITTED");
    const r = restartedHarness(h);

    // Same ID + same payload after restart → the original committed truth.
    const replay = await r.facade.reserveAndRoute(
      timeProposal("t-attack-a15", 5) as unknown as CanonicalTransitionProposalV1
    );
    expect(replay.kind).toBe("ALREADY_COMMITTED");

    // Same ID + changed payload → durable reuse conflict, never re-committed.
    const conflict = await r.facade.reserveAndRoute(
      timeProposal("t-attack-a15", 99) as unknown as CanonicalTransitionProposalV1
    );
    expect(conflict.kind).toBe("REUSE_CONFLICT");
    if (conflict.kind === "REUSE_CONFLICT") {
      expect(conflict.error_code).toBe("TRANSITION_ID_REUSE");
      expect(conflict.reason).toBe("IDEM-REUSE-001");
    }
    const record = await r.journal.readRecord("t-attack-a15" as never);
    expect(record?.terminal_status).toBe("COMMITTED");
    expect(record?.reuse_conflicts).toHaveLength(1);
    expect(h.store.getCommittedBundles()).toHaveLength(1);
  });

  it("A15: journal restart preserves terminal NO_OP replay", async () => {
    const h = buildHarness();
    const zeroProposal = {
      schema_version: "canonical-transition-proposal-v1",
      transition_id: "t-attack-a15-noop",
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
    await h.facade.terminalizeReservedNoOp({
      proposal: zeroProposal,
      continuation: reserved.continuation,
      producerAuthorization: h.issuer.issue([]),
      preparedBinding: preparedBinding("t-attack-a15-noop")
    });

    const r = restartedHarness(h);
    const replay = await r.facade.reserveAndRoute(zeroProposal);
    expect(replay.kind).toBe("TERMINAL_NO_OP");
  });

  it("A15: journal restart preserves OPEN continuation integrity", async () => {
    const h = buildHarness();
    const proposal = timeProposal("t-attack-a15-open", 5);
    const reserved = await h.facade.reserveAndRoute(proposal as unknown as CanonicalTransitionProposalV1);
    expect(reserved.kind).toBe("CONTINUE");
    if (reserved.kind !== "CONTINUE") return;

    // "Process loss" before the second call: the restarted facade must accept
    // the original continuation and commit against the imported journal.
    const r = restartedHarness(h);
    const outcome = await r.facade.commitReserved({
      proposal: proposal as unknown as CanonicalTransitionProposalV1,
      continuation: reserved.continuation,
      producerAuthorization: authorization(h.issuer),
      preparedBinding: preparedBinding("t-attack-a15-open"),
      repository_bindings: R0_BINDINGS
    });
    expect(outcome.kind).toBe("COMMITTED");
    if (outcome.kind === "COMMITTED") {
      expect(outcome.bundle.next_revision).toBe(1);
    }
    expect(h.store.getCommittedBundles()).toHaveLength(1);
  });
});
