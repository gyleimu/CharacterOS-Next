import { beforeAll, describe, expect, it } from "vitest";

import {
  TRANSITION_TYPES,
  canonicalJsonString,
  createInMemorySubjectCoreFacade,
  createInMemorySubjectCoreFacadeForExplicitV4V0,
  createPersistenceEnvelope,
  fullSnapshotChecksumAnyVersion,
  materializeSubjectStateV4V0,
  prepareCanonicalTransitionEffectV0,
  proposalFingerprint,
  stateHash,
  stateHashAnyVersion,
  validateAtomicCommitBundleV2AnyStateV0,
  validateOrdinaryStateSchemaContinuityV0,
  validateProposal,
  validateSubjectState,
  validateSubjectStateAnyVersionV0,
  validateSubjectStateV4,
  type AtomicCommitBundleAnyVersion,
  type AtomicCommitBundleV4V0,
  type CanonicalRefV0,
  type HashV1,
  type IdentifierV0,
  type InMemoryFacadeAssembly,
  type PreparedLogicalResultBindingV1,
  type RepositoryRevisionBindingV1,
  type RepositoryRevisionIdV0,
  type SubjectStateV0,
  type SubjectStateV4,
  type TransitionIdV0,
  type V4PersistenceEnvelopeV0
} from "@characteros-next/subject-core";
import type { SubjectCorePort } from "../ports/subject-core-port.js";
import * as runtimeIndex from "../index.js";
import { BoundedAffectTimeProducerV0 } from "../producers/bounded-affect-time-producer-v0.js";
import { ReferenceRegulationV0Producer } from "../producers/reference-regulation-v0-producer.js";
import {
  CanonicalAffectV4TimeTransitionExecutorV0,
  buildV4TimeNoOpProposal,
  buildV4TimeProposal,
  type CanonicalAffectV4TimeTransitionCapabilitiesV0
} from "../transitions/time/canonical-affect-v4-time-transition-executor-v0.js";
import {
  mintTrustedCanonicalHistoryBoundaryV0,
  mintTrustedCanonicalHistoryBoundaryV4V0,
  type TrustedCanonicalHeadInputV0,
  type TrustedCanonicalHistoryBoundaryReceiptV0
} from "./trusted-canonical-history-boundary.js";
import { validateAtomicCommitChainV0 } from "./atomic-commit-chain-validator.js";
import {
  createSubjectStateV4AuthoritativeRestoreEnvelopeV0,
  restoreSubjectStateV4AuthoritativelyV0,
  type SubjectStateV4AuthoritativeRestoreEnvelopeV0
} from "./restore-chain-authority-v4.js";

const R0_BINDING: RepositoryRevisionBindingV1 = {
  repository_revision: "R0" as RepositoryRevisionIdV0,
  repository_revision_hash:
    "sha256:85755634de984070ca6c12d5dd01fb545e0efea635000e0e0044c589f3fcbb00" as HashV1
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function record(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error("expected record fixture");
  }
  return value;
}

function v3Seed(): SubjectStateV0 {
  const raw = {
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
      cursor: {
        last_history_sequence: 0,
        offloaded_through_sequence: 0,
        offloaded_through_trace_ref: null
      },
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
  const checked = validateSubjectState(raw);
  if (!checked.ok) throw new Error(checked.error.detail);
  return checked.value;
}

async function v4Genesis(): Promise<{
  readonly state: SubjectStateV4;
  readonly envelope: V4PersistenceEnvelopeV0;
}> {
  const result = await materializeSubjectStateV4V0({
    mode: "EXPLICIT_V4_FOUNDATION_V0",
    seed: {
      schema_version: "subject-state-v4-genesis-seed-v0",
      subject: { subject_id: "subject-s0", display_name: "", identity_anchors: [] },
      v3_source: v3Seed(),
      r0_binding: R0_BINDING
    },
    r0_binding: R0_BINDING,
    reference_validator: async (binding) => canonicalJsonString(binding) === canonicalJsonString(R0_BINDING)
  });
  if (!result.ok) throw new Error(`${result.code}: ${result.detail}`);
  return result;
}

function headFromBundle(bundle: AtomicCommitBundleV4V0): TrustedCanonicalHeadInputV0 {
  return {
    schema_version: "trusted-canonical-head-v0",
    subject_id: bundle.subject_id,
    revision: bundle.next_revision,
    commit_ref: bundle.commit_ref,
    record_checksum: bundle.record_checksum,
    state_hash: bundle.state_hash_after,
    snapshot_hash: bundle.snapshot_hash_after
  };
}

async function capabilitiesFor(
  snapshot: SubjectStateV4,
  ticks: number
): Promise<CanonicalAffectV4TimeTransitionCapabilitiesV0> {
  const context = {
    subject_id: snapshot.identity.subject_id,
    current_logical_time: snapshot.runtime_metadata.logical_time,
    state_revision: snapshot.runtime_metadata.state_revision
  };
  const affectDelta = await new BoundedAffectTimeProducerV0().produceCanonicalAffectTimeDelta({
    current_affect: snapshot.affect,
    elapsed_ticks: ticks
  });
  const regulationDelta = await new ReferenceRegulationV0Producer().produceRegulationDelta({
    context,
    regulation: snapshot.regulation,
    elapsed_ticks: ticks
  });
  const proposal = buildV4TimeProposal(
    snapshot.identity.subject_id,
    snapshot.runtime_metadata.state_revision,
    ticks,
    affectDelta,
    regulationDelta
  );
  const preparedBinding: PreparedLogicalResultBindingV1 = {
    transition_id: proposal.transition_id,
    subject_id: proposal.subject_id,
    transition_type: proposal.transition_type,
    payload_fingerprint: await proposalFingerprint(proposal),
    prepared_result_ref: `workflow:v4-r${snapshot.runtime_metadata.state_revision}-e${ticks}` as CanonicalRefV0
  };
  return { preparedBinding, repository_bindings: [R0_BINDING] };
}

async function noOpCapabilitiesFor(
  snapshot: SubjectStateV4
): Promise<CanonicalAffectV4TimeTransitionCapabilitiesV0> {
  const proposal = buildV4TimeNoOpProposal(
    snapshot.identity.subject_id,
    snapshot.runtime_metadata.state_revision
  );
  return {
    preparedBinding: {
      transition_id: proposal.transition_id,
      subject_id: proposal.subject_id,
      transition_type: proposal.transition_type,
      payload_fingerprint: await proposalFingerprint(proposal),
      prepared_result_ref: "workflow:v4-no-op" as CanonicalRefV0
    },
    repository_bindings: [R0_BINDING]
  };
}

async function executeV4Time(
  assembly: InMemoryFacadeAssembly<SubjectStateV4>,
  ticks: number,
  callCounts?: { affect: number; regulation: number }
): Promise<AtomicCommitBundleV4V0> {
  const snapshot = await assembly.facade.readCurrentSnapshot("subject-s0" as IdentifierV0);
  if (snapshot === null) throw new Error("missing v4 snapshot");
  const capabilities = await capabilitiesFor(snapshot, ticks);
  const affectProducer = new BoundedAffectTimeProducerV0();
  const regulationProducer = new ReferenceRegulationV0Producer();
  const executor = new CanonicalAffectV4TimeTransitionExecutorV0(
    {
      subjectCore: assembly.facade,
      producerAuthorizationIssuer: assembly.producerAuthorizationIssuer,
      canonicalAffectTimeProducer: {
        async produceCanonicalAffectTimeDelta(input) {
          if (callCounts !== undefined) callCounts.affect += 1;
          return affectProducer.produceCanonicalAffectTimeDelta(input);
        }
      },
      regulationProducer: {
        async produceRegulationDelta(input) {
          if (callCounts !== undefined) callCounts.regulation += 1;
          return regulationProducer.produceRegulationDelta(input);
        }
      }
    },
    "EXPLICIT_V4_FOUNDATION_V0"
  );
  const result = await executor.execute(
    {
      subject_id: snapshot.identity.subject_id,
      current_logical_time: snapshot.runtime_metadata.logical_time,
      state_revision: snapshot.runtime_metadata.state_revision
    },
    { elapsed_ticks: ticks },
    capabilities
  );
  if (result.kind !== "COMMITTED" || result.bundle.commit_version !== "atomic-commit-v2") {
    throw new Error(`v4 Time did not commit: ${result.kind}`);
  }
  if (result.bundle.next_snapshot.schema_version !== "subject-state-v4") {
    throw new Error("v4 Time emitted a non-v4 successor");
  }
  return result.bundle;
}

async function createV4Assembly(
  state: SubjectStateV4,
  bundles: readonly AtomicCommitBundleV4V0[] = []
): Promise<InMemoryFacadeAssembly<SubjectStateV4>> {
  return createInMemorySubjectCoreFacadeForExplicitV4V0({
    seedSnapshots: new Map([[state.identity.subject_id, state]]),
    seedBundles: bundles,
    referenceValidator: async (binding) => canonicalJsonString(binding) === canonicalJsonString(R0_BINDING),
    preparedResultValidator: async () => true
  });
}

async function commitV3Relationship(): Promise<AtomicCommitBundleAnyVersion> {
  const seed = v3Seed();
  const assembly = createInMemorySubjectCoreFacade({
    seedSnapshots: new Map([[seed.identity.subject_id, seed]]),
    referenceValidator: async () => true,
    preparedResultValidator: async () => true
  });
  const rawProposal = {
    schema_version: "canonical-transition-proposal-v1",
    transition_id: "t-v3-relationship-proof" as TransitionIdV0,
    subject_id: seed.identity.subject_id,
    transition_type: "Relationship",
    expected_state_revision: seed.runtime_metadata.state_revision,
    time_input: { kind: "OCCURRENCE", occurrence_logical_time: seed.runtime_metadata.logical_time },
    cause_refs: [],
    domain_deltas: [{
      producer: "relationship",
      domain: "relationship",
      expected_repository_revision: null,
      operations: [{ path: "/relationships", value: seed.relationships }],
      provenance_refs: []
    }],
    external_refs: []
  };
  const proposalCheck = validateProposal(rawProposal);
  if (!proposalCheck.ok) throw new Error(proposalCheck.error.detail);
  const proposal = proposalCheck.value;
  const reserved = await assembly.facade.reserveAndRoute(proposal);
  if (reserved.kind !== "CONTINUE") throw new Error(`v3 reserve: ${reserved.kind}`);
  const outcome = await assembly.facade.commitReserved({
    proposal,
    continuation: reserved.continuation,
    producerAuthorization: assembly.producerAuthorizationIssuer.issue([
      { producer: "relationship", domain: "relationship" }
    ]),
    preparedBinding: {
      transition_id: proposal.transition_id,
      subject_id: proposal.subject_id,
      transition_type: proposal.transition_type,
      payload_fingerprint: await proposalFingerprint(proposal),
      prepared_result_ref: "workflow:v3-proof" as CanonicalRefV0
    },
    repository_bindings: [R0_BINDING]
  });
  if (outcome.kind !== "COMMITTED") throw new Error(`v3 commit: ${outcome.kind}`);
  return outcome.bundle;
}

interface AuthorityFixture {
  readonly genesis: Awaited<ReturnType<typeof v4Genesis>>;
  readonly assembly: InMemoryFacadeAssembly<SubjectStateV4>;
  readonly bundles: readonly [AtomicCommitBundleV4V0, AtomicCommitBundleV4V0];
  readonly boundary: TrustedCanonicalHistoryBoundaryReceiptV0<V4PersistenceEnvelopeV0>;
  readonly envelope: SubjectStateV4AuthoritativeRestoreEnvelopeV0;
  readonly calls: { affect: number; regulation: number };
}

let fixture: AuthorityFixture;

beforeAll(async () => {
  const genesis = await v4Genesis();
  const assembly = await createV4Assembly(genesis.state);
  const calls = { affect: 0, regulation: 0 };
  const first = await executeV4Time(assembly, 5, calls);
  const second = await executeV4Time(assembly, 7, calls);
  const head = headFromBundle(second);
  const minted = await mintTrustedCanonicalHistoryBoundaryV4V0({
    genesis: genesis.envelope,
    head,
    reference_validator: async (binding) => canonicalJsonString(binding) === canonicalJsonString(R0_BINDING)
  });
  if (minted.kind !== "MINTED") throw new Error(minted.detail);
  const envelope = await createSubjectStateV4AuthoritativeRestoreEnvelopeV0({
    snapshot: second.next_snapshot,
    commit_head: head,
    repository_binding: R0_BINDING
  });
  fixture = { genesis, assembly, bundles: [first, second], boundary: minted.receipt, envelope, calls };
});

describe("SUBJECT_STATE_V4_ATOMIC_COMMIT — version dispatch (1-11)", () => {
  it("1-4 dispatches literal v3/v4 schemas and fails closed for missing/unknown", async () => {
    const genesis = await v4Genesis();
    expect(validateSubjectStateAnyVersionV0(v3Seed()).ok).toBe(true);
    expect(validateSubjectStateAnyVersionV0(genesis.state).ok).toBe(true);
    expect(validateSubjectStateAnyVersionV0({}).ok).toBe(false);
    expect(validateSubjectStateAnyVersionV0({ schema_version: "subject-state-v9" }).ok).toBe(false);
  });

  it("5-6 forbids ordinary v3/v4 schema crossing in both directions", async () => {
    const genesis = await v4Genesis();
    expect(validateOrdinaryStateSchemaContinuityV0(v3Seed(), genesis.state).ok).toBe(false);
    expect(validateOrdinaryStateSchemaContinuityV0(genesis.state, v3Seed()).ok).toBe(false);
  });

  it("7-8 shape admission does not grant cross-version Affect authority", async () => {
    const genesis = await v4Genesis();
    const regulationDelta = await new ReferenceRegulationV0Producer().produceRegulationDelta({
      context: {
        subject_id: genesis.state.identity.subject_id,
        current_logical_time: genesis.state.runtime_metadata.logical_time,
        state_revision: genesis.state.runtime_metadata.state_revision
      },
      regulation: genesis.state.regulation,
      elapsed_ticks: 1
    });
    const canonicalDelta = await new BoundedAffectTimeProducerV0().produceCanonicalAffectTimeDelta({
      current_affect: genesis.state.affect,
      elapsed_ticks: 1
    });
    const canonicalProposal = buildV4TimeProposal("subject-s0", 0, 1, canonicalDelta, regulationDelta);
    expect(validateProposal(canonicalProposal).ok).toBe(true);
    expect((await prepareCanonicalTransitionEffectV0({ predecessor: v3Seed(), proposal: canonicalProposal })).kind)
      .toBe("REJECTED");

    const legacyRaw = structuredClone(canonicalProposal);
    const deltas = legacyRaw.domain_deltas;
    const affectOperation = deltas[0]?.operations[0];
    if (affectOperation === undefined) throw new Error("missing affect operation");
    record(affectOperation)["value"] = {
      active_channels: [],
      generated_under_profile: null,
      updated_at: null
    };
    const legacyCheck = validateProposal(legacyRaw);
    expect(legacyCheck.ok).toBe(true);
    if (legacyCheck.ok) {
      expect((await prepareCanonicalTransitionEffectV0({ predecessor: genesis.state, proposal: legacyCheck.value })).kind)
        .toBe("REJECTED");
    }
  });

  it("9-11 accepts exact profile pairings and rejects cross-profile states", async () => {
    const genesis = await v4Genesis();
    expect(validateSubjectState(v3Seed()).ok).toBe(true);
    expect(validateSubjectStateV4(genesis.state).ok).toBe(true);
    const v4WithLegacyProfile = structuredClone(genesis.state);
    record(v4WithLegacyProfile)["mechanism_config"] = v3Seed().mechanism_config;
    expect(validateSubjectStateV4(v4WithLegacyProfile).ok).toBe(false);
    const v3WithBoundedProfile = structuredClone(v3Seed());
    record(v3WithBoundedProfile)["mechanism_config"] = genesis.state.mechanism_config;
    expect(validateSubjectState(v3WithBoundedProfile).ok).toBe(false);
  });
});

describe("SUBJECT_STATE_V4_ATOMIC_COMMIT — real core and V2 bundle (21-44)", () => {
  it("21-33 traverses real reserve, candidate, CAS, trace, and V2 emission with zero model calls", () => {
    const [first, second] = fixture.bundles;
    expect(fixture.assembly.storeRead.getCommittedBundles()).toStrictEqual([first, second]);
    expect(first.next_snapshot.schema_version).toBe("subject-state-v4");
    expect("mood" in first.next_snapshot).toBe(false);
    expect(first.next_snapshot.affect.schema_version).toBe("canonical-affect-v0");
    expect(first.next_snapshot.runtime_metadata.state_revision).toBe(1);
    expect(first.next_snapshot.runtime_metadata.logical_time).toBe(5);
    expect(second.next_snapshot.runtime_metadata.state_revision).toBe(2);
    expect(second.next_snapshot.runtime_metadata.logical_time).toBe(12);
    expect(second.trace_window.entries).toHaveLength(2);
    expect(second.commit_version).toBe("atomic-commit-v2");
    expect(first.canonical_proposal.domain_deltas.map((delta) => delta.domain)).toStrictEqual([
      "affect",
      "regulation"
    ]);
    expect(first.canonical_proposal.domain_deltas.flatMap((delta) => delta.operations.map((operation) => operation.path)))
      .toStrictEqual(["/affect", "/regulation"]);
    expect(fixture.calls).toStrictEqual({ affect: 2, regulation: 2 });
  });

  it("preserves durable v4 elapsed=0 NO_OP without a CAS bundle", async () => {
    const genesis = await v4Genesis();
    const assembly = await createV4Assembly(genesis.state);
    const executor = new CanonicalAffectV4TimeTransitionExecutorV0(
      {
        subjectCore: assembly.facade,
        producerAuthorizationIssuer: assembly.producerAuthorizationIssuer,
        canonicalAffectTimeProducer: {
          async produceCanonicalAffectTimeDelta() {
            throw new Error("zero tick must not call Affect dynamics");
          }
        },
        regulationProducer: {
          async produceRegulationDelta() {
            throw new Error("zero tick must not call Regulation");
          }
        }
      },
      "EXPLICIT_V4_FOUNDATION_V0"
    );
    const result = await executor.execute(
      {
        subject_id: genesis.state.identity.subject_id,
        current_logical_time: genesis.state.runtime_metadata.logical_time,
        state_revision: genesis.state.runtime_metadata.state_revision
      },
      { elapsed_ticks: 0 },
      await noOpCapabilitiesFor(genesis.state)
    );
    expect(result.kind).toBe("NO_OP");
    expect(assembly.storeRead.getCommittedBundles()).toHaveLength(0);
  });

  it("34-40 accepts a closed self-validating v4 V2 and full replay requires same schema", async () => {
    const checked = await validateAtomicCommitBundleV2AnyStateV0(fixture.bundles[1]);
    expect(checked.ok).toBe(true);
    expect(await fullSnapshotChecksumAnyVersion(fixture.bundles[1].next_snapshot))
      .toBe(fixture.envelope.full_snapshot_checksum);
    const chain = await validateAtomicCommitChainV0({
      trusted_boundary: fixture.boundary,
      bundles: fixture.bundles
    });
    expect(chain.kind).toBe("VALID");
    if (chain.kind === "VALID") {
      expect(chain.receipt.v1_bundle_count).toBe(0);
      expect(chain.receipt.v2_bundle_count).toBe(2);
      expect(chain.receipt.terminal_state_hash).toBe(fixture.bundles[1].state_hash_after);
      expect(chain.receipt.terminal_snapshot_hash).toBe(fixture.bundles[1].snapshot_hash_after);
    }
  });

  it("41-44 rejects wrong state hash, snapshot hash, checksum, and successor Affect", async () => {
    const cases: Record<string, unknown>[] = [];
    for (const field of ["state_hash_after", "snapshot_hash_after", "record_checksum"] as const) {
      const clone = record(structuredClone(fixture.bundles[1]));
      clone[field] = "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
      cases.push(clone);
    }
    const affectClone = record(structuredClone(fixture.bundles[1]));
    const snapshot = record(affectClone["next_snapshot"]);
    const affect = record(snapshot["affect"]);
    affect["valence"] = 0.25;
    cases.push(affectClone);
    for (const tampered of cases) {
      expect((await validateAtomicCommitBundleV2AnyStateV0(tampered)).ok).toBe(false);
    }
  });
});

describe("SUBJECT_STATE_V4_ATOMIC_COMMIT — trusted chain tamper matrix (45-56)", () => {
  it("45-47 recognizes explicit v4 R0 and validates one/multiple real Time bundles", async () => {
    const oneHead = headFromBundle(fixture.bundles[0]);
    const oneBoundary = await mintTrustedCanonicalHistoryBoundaryV4V0({
      genesis: fixture.genesis.envelope,
      head: oneHead,
      reference_validator: async () => true
    });
    expect(oneBoundary.kind).toBe("MINTED");
    if (oneBoundary.kind === "MINTED") {
      expect((await validateAtomicCommitChainV0({ trusted_boundary: oneBoundary.receipt, bundles: [fixture.bundles[0]] })).kind)
        .toBe("VALID");
    }
    expect((await validateAtomicCommitChainV0({ trusted_boundary: fixture.boundary, bundles: fixture.bundles })).kind)
      .toBe("VALID");
  });

  it("48-51 rejects missing, reordered, broken-link, and duplicate-revision histories", async () => {
    const missing = await validateAtomicCommitChainV0({
      trusted_boundary: fixture.boundary,
      bundles: [fixture.bundles[1]]
    });
    const reordered = await validateAtomicCommitChainV0({
      trusted_boundary: fixture.boundary,
      bundles: [fixture.bundles[1], fixture.bundles[0]]
    });
    const broken = record(structuredClone(fixture.bundles[1]));
    broken["previous_commit_ref"] = null;
    const brokenResult = await validateAtomicCommitChainV0({
      trusted_boundary: fixture.boundary,
      bundles: [fixture.bundles[0], broken]
    });
    const duplicate = record(structuredClone(fixture.bundles[1]));
    duplicate["next_revision"] = 1;
    const duplicateResult = await validateAtomicCommitChainV0({
      trusted_boundary: fixture.boundary,
      bundles: [fixture.bundles[0], duplicate]
    });
    expect([missing, reordered, brokenResult, duplicateResult].every((result) => result.kind === "INVALID"))
      .toBe(true);
  });

  it("52-54 rejects v3/v4 chain insertion, unknown state schema, and wrong genesis", async () => {
    const v3Bundle = await commitV3Relationship();
    expect((await validateAtomicCommitChainV0({
      trusted_boundary: fixture.boundary,
      bundles: [v3Bundle]
    })).kind).toBe("INVALID");

    const v3Envelope = await createPersistenceEnvelope({
      snapshot: v3Seed(),
      repository_bindings: [R0_BINDING],
      commit_head: null
    });
    if (!v3Envelope.ok) throw new Error(v3Envelope.error.detail);
    const v3Boundary = await mintTrustedCanonicalHistoryBoundaryV0({
      genesis: v3Envelope.value,
      head: headFromBundle(fixture.bundles[0])
    });
    if (v3Boundary.kind !== "MINTED") throw new Error(v3Boundary.detail);
    expect((await validateAtomicCommitChainV0({
      trusted_boundary: v3Boundary.receipt,
      bundles: [fixture.bundles[0]]
    })).kind).toBe("INVALID");

    const unknown = record(structuredClone(fixture.bundles[0]));
    record(unknown["next_snapshot"])["schema_version"] = "subject-state-v9";
    expect((await validateAtomicCommitChainV0({
      trusted_boundary: fixture.boundary,
      bundles: [unknown]
    })).kind).toBe("INVALID");

    const wrongGenesis = record(structuredClone(fixture.genesis.envelope));
    record(wrongGenesis["snapshot"])["schema_version"] = "subject-state-v3";
    const wrongMint = await mintTrustedCanonicalHistoryBoundaryV4V0({
      genesis: wrongGenesis as unknown as V4PersistenceEnvelopeV0,
      head: headFromBundle(fixture.bundles[1]),
      reference_validator: async () => true
    });
    expect(wrongMint.kind).toBe("REJECTED");
  });

  it("55-56 rejects tampered proposal and persisted successor", async () => {
    const proposalTamper = record(structuredClone(fixture.bundles[0]));
    const proposal = record(proposalTamper["canonical_proposal"]);
    proposal["transition_id"] = "t-tampered";
    const elapsedTamper = record(structuredClone(fixture.bundles[0]));
    const elapsedProposal = record(elapsedTamper["canonical_proposal"]);
    record(record(elapsedProposal["time_input"])["elapsed_time"])["value"] = 99;
    const transitionIdTamper = record(structuredClone(fixture.bundles[0]));
    transitionIdTamper["transition_id"] = "t-tampered-bundle";
    const successorTamper = record(structuredClone(fixture.bundles[0]));
    record(record(successorTamper["next_snapshot"])["regulation"])["stress"] = 0.75;
    for (const bundle of [proposalTamper, elapsedTamper, transitionIdTamper, successorTamper]) {
      expect((await validateAtomicCommitChainV0({
        trusted_boundary: fixture.boundary,
        bundles: [bundle, fixture.bundles[1]]
      })).kind).toBe("INVALID");
    }
  });
});

describe("SUBJECT_STATE_V4_ATOMIC_COMMIT — authoritative restore/continuation (57-76)", () => {
  it("57-68 requires full chain, restores exact values/binding, and runs no dynamics/providers", async () => {
    const countsBefore = { ...fixture.calls };
    const headOnly = await restoreSubjectStateV4AuthoritativelyV0({
      envelope: fixture.envelope,
      trusted_boundary: fixture.boundary,
      bundles: [],
      reference_validator: async () => true
    });
    expect(headOnly.kind).toBe("REJECTED");

    const restored = await restoreSubjectStateV4AuthoritativelyV0({
      envelope: fixture.envelope,
      trusted_boundary: fixture.boundary,
      bundles: fixture.bundles,
      reference_validator: async (binding) => canonicalJsonString(binding) === canonicalJsonString(R0_BINDING)
    });
    expect(restored.kind).toBe("RESTORED");
    if (restored.kind !== "RESTORED") return;
    expect(canonicalJsonString(restored.snapshot)).toBe(canonicalJsonString(fixture.bundles[1].next_snapshot));
    expect(restored.snapshot.runtime_metadata.logical_time).toBe(12);
    expect(restored.snapshot.affect).toStrictEqual(fixture.bundles[1].next_snapshot.affect);
    expect(restored.snapshot.regulation).toStrictEqual(fixture.bundles[1].next_snapshot.regulation);
    expect(restored.snapshot.memory_state.repository_revision).toBe("R0");
    expect(fixture.calls).toStrictEqual(countsBefore);

    const tampered = record(structuredClone(fixture.bundles[0]));
    tampered["record_checksum"] = "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
    expect((await restoreSubjectStateV4AuthoritativelyV0({
      envelope: fixture.envelope,
      trusted_boundary: fixture.boundary,
      bundles: [tampered, fixture.bundles[1]],
      reference_validator: async () => true
    })).kind).toBe("REJECTED");

    const v3Envelope = await createPersistenceEnvelope({
      snapshot: v3Seed(),
      repository_bindings: [R0_BINDING],
      commit_head: null
    });
    if (!v3Envelope.ok) throw new Error(v3Envelope.error.detail);
    const wrongGenesis = await mintTrustedCanonicalHistoryBoundaryV0({
      genesis: v3Envelope.value,
      head: {
        schema_version: "trusted-canonical-head-v0",
        subject_id: v3Envelope.value.snapshot.identity.subject_id,
        revision: v3Envelope.value.snapshot.runtime_metadata.state_revision,
        commit_ref: null,
        record_checksum: null,
        state_hash: v3Envelope.value.state_hash,
        snapshot_hash: v3Envelope.value.snapshot_hash
      }
    });
    if (wrongGenesis.kind !== "MINTED") throw new Error(wrongGenesis.detail);
    const wrongGenesisRestore = await restoreSubjectStateV4AuthoritativelyV0({
      envelope: fixture.envelope,
      trusted_boundary: wrongGenesis.receipt as unknown as TrustedCanonicalHistoryBoundaryReceiptV0<V4PersistenceEnvelopeV0>,
      bundles: fixture.bundles,
      reference_validator: async () => true
    });
    expect(wrongGenesisRestore).toMatchObject({ kind: "REJECTED", code: "UNTRUSTED_BOUNDARY" });
  });

  it("69-76 restore then Time+K equals uninterrupted N+M+K without catch-up/double recovery", async () => {
    const uninterruptedGenesis = await v4Genesis();
    const uninterrupted = await createV4Assembly(uninterruptedGenesis.state);
    await executeV4Time(uninterrupted, 5);
    await executeV4Time(uninterrupted, 7);
    const uninterruptedFinalBundle = await executeV4Time(uninterrupted, 11);

    const restored = await restoreSubjectStateV4AuthoritativelyV0({
      envelope: fixture.envelope,
      trusted_boundary: fixture.boundary,
      bundles: fixture.bundles,
      reference_validator: async () => true
    });
    if (restored.kind !== "RESTORED") throw new Error(restored.detail);
    const resumed = await createV4Assembly(restored.snapshot, fixture.bundles);
    const resumedFinalBundle = await executeV4Time(resumed, 11);

    expect(resumedFinalBundle.next_snapshot.affect).toStrictEqual(uninterruptedFinalBundle.next_snapshot.affect);
    expect(resumedFinalBundle.next_snapshot.regulation).toStrictEqual(uninterruptedFinalBundle.next_snapshot.regulation);
    expect(resumedFinalBundle.next_snapshot.runtime_metadata.logical_time).toBe(23);
    expect(resumedFinalBundle.next_snapshot.runtime_metadata.logical_time)
      .toBe(uninterruptedFinalBundle.next_snapshot.runtime_metadata.logical_time);
    expect(canonicalJsonString(resumedFinalBundle.next_snapshot))
      .toBe(canonicalJsonString(uninterruptedFinalBundle.next_snapshot));
    expect(await stateHashAnyVersion(resumedFinalBundle.next_snapshot))
      .toBe(await stateHashAnyVersion(uninterruptedFinalBundle.next_snapshot));
  });
});

describe("SUBJECT_STATE_V4_ATOMIC_COMMIT — v3 goldens and isolation (12-20, 77-89)", () => {
  it("12 preserves the exact v3 S0 StateHash golden", async () => {
    expect(await stateHash(v3Seed())).toBe(
      "sha256:c644baa884f9911038575b4c1b7c9b60e1c79c00faf9e6b79b2af811c785d0d4"
    );
  });

  it("77-89 keeps migration/Mood/cognition/default product out of this slice; AffectApplication is the one lawful v4 writer addition", () => {
    // CANONICAL_AFFECT_APPLICATION_V0: AffectApplication is now a registered
    // transition type (the explicit-v4 impulse writer). Migration, Mood and
    // the default v3 product remain out.
    expect(TRANSITION_TYPES).toContain("AffectApplication");
    expect(TRANSITION_TYPES).not.toContain("Mood");
    expect(TRANSITION_TYPES).not.toContain("Migration");
    type DefaultSubjectCoreSnapshot = Awaited<ReturnType<SubjectCorePort["readCurrentSnapshot"]>>;
    const defaultPortRemainsV3: DefaultSubjectCoreSnapshot extends SubjectStateV0 | null ? true : false = true;
    expect(defaultPortRemainsV3).toBe(true);
    expect("CanonicalAffectV4TimeTransitionExecutorV0" in runtimeIndex).toBe(false);
    expect("CanonicalAffectApplicationExecutorV0" in runtimeIndex).toBe(false);
    expect("createInMemorySubjectCoreFacadeForExplicitV4V0" in runtimeIndex).toBe(false);
  });
});
