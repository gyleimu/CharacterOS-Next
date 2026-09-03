/**
 * Relationship Governed Feature Writer Authority V0 — runtime acceptance
 * suite (§47/§48/§49-§53/§55):
 *
 *   §47 registry counts asserted directly (writer schema 1, gates 1,
 *      policies 1, Relationship decision features: interaction familiarity)
 *   §48 root-export surface: NO authority issuer/verifier/registration
 *      surface is product-exposed
 *   §49 gate/policy/fingerprint injection rejected by the exact resolvers
 *   §50 ZERO-feature state: policy denies every reserved target, no product
 *      path emits non-null writer authority, reserved write fails closed
 *      through the REAL production facade
 *   §51 policy receipt determinism vectors + family payload evidence law
 *   §52 exactly-one governed target / removal rejection via the exact
 *      predecessor/candidate diff
 *   §53 trusted-history capability: clone rejected, invalid/truncated chains
 *      cannot mint, stale terminal head cannot mint, lookup skips unrelated
 *      commits, UPDATE requires a proven RESOLVED_VALID prior, unavailable
 *      history never proves absence
 *   §54 covered in historical-writer-authority-registry.test.ts (§34/§54)
 *   §55 ordinary production V2 byte regression: commit_ref / result_ref /
 *      record_checksum EXACT against the frozen pre-slice fixture
 *
 * Every V2 bundle from the production path comes from the REAL
 * facade/engine/store pipeline; governed historical fixtures are structural
 * (allowed by §53); the ONLY registered feature is interaction familiarity
 * (REGISTERED_RELATIONSHIP_DECISION_FEATURE_COUNT = 1). Fully OFFLINE.
 */

import { describe, expect, it } from "vitest";

import {
  createInMemorySubjectCoreFacade,
  createPersistenceEnvelope,
  type AtomicCommitBundleAnyVersion,
  type AtomicCommitBundleV2,
  type CanonicalTransitionProposalV1,
  type SubjectStateV0
} from "@characteros-next/subject-core";

import * as runtimeIndex from "../index.js";
import {
  GOVERNED_RELATIONSHIP_WRITE_POLICY_COUNT_V0,
  RELATIONSHIP_GOVERNED_FEATURE_AUTHORIZATION_GATE_ID_V0,
  RELATIONSHIP_GOVERNED_FEATURE_AUTHORIZATION_GATE_DESCRIPTOR_V0,
  RELATIONSHIP_GOVERNED_FEATURE_WRITE_POLICY_ID_V0,
  RELATIONSHIP_GOVERNED_FEATURE_WRITE_POLICY_DESCRIPTOR_V0,
  REGISTERED_AUTHORIZATION_GATE_IDS_V0,
  REGISTERED_GOVERNED_RELATIONSHIP_WRITE_POLICY_IDS_V0,
  RECOGNIZED_WRITER_SCHEMA_CONTRACT_IDS_V0,
  deriveRelationshipGovernedFeatureAuthorizationGateFingerprintV0,
  deriveRelationshipGovernedFeatureWritePolicyFingerprintV0,
  getRegisteredAuthorizationGatesV0,
  getRegisteredGovernedWritePoliciesV0,
  resolveAuthorizationGateV0,
  resolveGovernedWritePolicyV0
} from "./historical-writer-authority-registry.js";
import {
  deriveRelationshipGovernedWritePolicyReceiptRefV0,
  type RelationshipGovernedWritePolicyReceiptDescriptorV0
} from "./relationship-governed-write-policy-receipt.js";
import {
  mintRelationshipGovernedTrustedHistoryCapabilityV0,
  lookupLatestRelationshipGovernedAuthorityV0,
  isRelationshipGovernedTrustedHistoryCapabilityV0,
  type RelationshipGovernedTrustedHistoryCapabilityV0
} from "./relationship-governed-trusted-history.js";
import {
  classifyRelationshipGovernedOperationV0,
  deriveRelationshipGovernedTargetV0,
  evaluateRelationshipGovernedWriteV0
} from "../transitions/relationship/relationship-governed-write-authority-service.js";
import { mintTrustedCanonicalHistoryBoundaryV0 } from "./trusted-canonical-history-boundary.js";
import {
  validateRelationshipGovernedFeatureWriterAuthorityPayloadV0,
  type RelationshipGovernedFeaturePreviousValueV0
} from "../transitions/relationship/relationship-governed-writer-authority.js";

const R0_HASH = "sha256:4444444444444444444444444444444444444444444444444444444444444444";
const WRONG_HASH = "sha256:2222222222222222222222222222222222222222222222222222222222222222";

// ---- §55 frozen ordinary fixture (captured BEFORE the membrane slice) ------------------

const ORDINARY_V2_FROZEN_HASHES_V0 = {
  commit_ref: "commit:463f6dbc511ec3d123ed055cfc3bed387be085aeec443215bcedc57b0c72ad25",
  result_ref: "result:5a943d8e3cc55731cd6f4c848fab06d1a6a16d73758ed457666734dc7fca3f65",
  record_checksum: "sha256:1f84ae1442864f72c8d5eb0858188a373ce6673978626f1a7c32f4c03b1936dc",
  state_hash_after: "sha256:91cdfe4f085910be1600152581f033e177060414261b2c000f4db6fcbde122e9",
  snapshot_hash_after: "sha256:dd79aae49b629f461342772a2920f3fbcbcf3341c51618d25559ed33ceb9267a"
};

// ---- fixtures ---------------------------------------------------------------------------

function seedState(governedValue: number | null): SubjectStateV0 {
  const counterparts =
    governedValue === null
      ? []
      : [
          {
            counterpart_ref: "entity:alice-like",
            dimensions: [{ dimension_id: "relationship_core_facade_dim_v0", value: governedValue }]
          }
        ];
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
    relationships: { schema_version: "relationship-state-v0", counterparts },
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
  } as unknown as SubjectStateV0;
}

function relationshipsWith(entries: { dimension_id: string; value: number }[]): Record<string, unknown> {
  return {
    schema_version: "relationship-state-v0",
    counterparts: [
      {
        counterpart_ref: "entity:alice-like",
        dimensions: entries
      }
    ]
  };
}

function relationshipProposal(
  transitionId: string,
  expectedRevision: number,
  nextRelationships: Record<string, unknown>
): CanonicalTransitionProposalV1 {
  return {
    schema_version: "canonical-transition-proposal-v1",
    transition_id: transitionId,
    subject_id: "subject-s0",
    transition_type: "Relationship",
    expected_state_revision: expectedRevision,
    time_input: { kind: "OCCURRENCE", occurrence_logical_time: 0 },
    cause_refs: [],
    domain_deltas: [
      {
        producer: "relationship",
        domain: "relationship",
        expected_repository_revision: null,
        operations: [{ path: "/relationships", value: nextRelationships }],
        provenance_refs: []
      }
    ],
    external_refs: []
  } as unknown as CanonicalTransitionProposalV1;
}

type FacadeAssembly = ReturnType<typeof createInMemorySubjectCoreFacade>;

function newFacade(governedSeed: number | null): FacadeAssembly {
  return createInMemorySubjectCoreFacade({
    seedSnapshots: new Map([["subject-s0" as never, seedState(governedSeed)]]),
    preparedResultValidator: async () => true
  });
}

async function commitViaFacade(
  assembly: FacadeAssembly,
  proposal: CanonicalTransitionProposalV1
): Promise<{ readonly kind: string; readonly detail?: string; readonly bundle?: AtomicCommitBundleAnyVersion }> {
  const { facade, producerAuthorizationIssuer } = assembly;
  const reserved = await facade.reserveAndRoute(proposal);
  if (reserved.kind !== "CONTINUE") return { kind: reserved.kind };
  const committed = await facade.commitReserved({
    proposal,
    continuation: reserved.continuation,
    producerAuthorization: producerAuthorizationIssuer.issue([
      { producer: "relationship", domain: "relationship" }
    ]),
    preparedBinding: {
      transition_id: proposal.transition_id,
      subject_id: proposal.subject_id,
      transition_type: proposal.transition_type,
      payload_fingerprint: reserved.continuation.payload_fingerprint,
      prepared_result_ref: `workflow:w-${proposal.transition_id}` as never
    },
    repository_bindings: [{ repository_revision: "R0", repository_revision_hash: R0_HASH } as never]
  });
  if (committed.kind !== "COMMITTED") {
    const failure = (committed as { failure?: { detail?: string } }).failure;
    return failure?.detail !== undefined
      ? { kind: committed.kind, detail: failure.detail }
      : { kind: committed.kind };
  }
  return { kind: "COMMITTED", bundle: committed.bundle };
}

// ---- §47/§48 registry counts and public surface ------------------------------------------

describe("§47/§48 registry counts and public surface", () => {
  it("asserts the exact registry counts: schema 1, gates 1, policies 1, features 0", async () => {
    expect(RECOGNIZED_WRITER_SCHEMA_CONTRACT_IDS_V0).toHaveLength(1);
    expect(REGISTERED_AUTHORIZATION_GATE_IDS_V0).toStrictEqual([
      RELATIONSHIP_GOVERNED_FEATURE_AUTHORIZATION_GATE_ID_V0
    ]);
    expect(REGISTERED_GOVERNED_RELATIONSHIP_WRITE_POLICY_IDS_V0).toStrictEqual([
      RELATIONSHIP_GOVERNED_FEATURE_WRITE_POLICY_ID_V0
    ]);
    expect(GOVERNED_RELATIONSHIP_WRITE_POLICY_COUNT_V0).toBe(1);
    expect(await getRegisteredAuthorizationGatesV0()).toHaveLength(1);
    expect(await getRegisteredGovernedWritePoliciesV0()).toHaveLength(1);
    expect(Object.isFrozen(RELATIONSHIP_GOVERNED_FEATURE_AUTHORIZATION_GATE_DESCRIPTOR_V0)).toBe(true);
    expect(Object.isFrozen(RELATIONSHIP_GOVERNED_FEATURE_WRITE_POLICY_DESCRIPTOR_V0)).toBe(true);
    const indexKeys = Object.keys(runtimeIndex);
    expect(indexKeys.filter((name) => /^(mint|Mint)/.test(name))).toStrictEqual([]);
    expect(indexKeys.filter((name) => name.startsWith("register"))).toStrictEqual([]);
    expect(indexKeys).not.toContain("mintPreparedGovernedWriterAuthorityTokenV0");
    expect(indexKeys).not.toContain("evaluateRelationshipGovernedWriteV0");
  });

  it("§50 the governed write policy denies EVERY reserved target with feature count zero", async () => {
    const reservedTargets = [
      "relationship_core_trust_like_v0",
      "relationship_core_closeness_v0",
      "relationship_core_a"
    ];
    for (const dimensionId of reservedTargets) {
      const evaluation = await evaluateRelationshipGovernedWriteV0({
        proposal: {
          proposal_ref: "proposal:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as never,
          payload_fingerprint: WRONG_HASH as never,
          subject_id: "subject-s0" as never,
          expected_revision: 0 as never,
          transition_id: "t-gov-deny" as never,
          cause_refs: [],
          external_refs: [],
          relationship_delta_provenance_refs: []
        },
        target: {
          counterpart_ref: "entity:alice-like" as never,
          dimension_id: dimensionId as never,
          previous: { kind: "ABSENT" },
          next: { kind: "PRESENT", value: 0.5 }
        },
        feature: {
          feature_semantics_contract_id: "unadmitted-feature-v0" as never,
          feature_semantics_contract_fingerprint: WRONG_HASH as never
        },
        evidence_receipt_refs: [],
        history: { capability: {} as never, bundles: [] }
      });
      expect(evaluation.kind, dimensionId).toBe("DENIED");
      if (evaluation.kind === "DENIED") {
        expect(evaluation.code).toBe("FEATURE_NOT_ADMITTED");
      }
    }
  });
});

// ---- §49/§50/§55 production facade path ---------------------------------------------------

describe("§49/§50/§55 real production facade path", () => {
  it("§55 ordinary non-governed production V2 stays byte-identical with writer_authority null", async () => {
    const assembly = newFacade(null);
    const outcome = await commitViaFacade(
      assembly,
      relationshipProposal("t-ordinary-probe-1", 0, relationshipsWith([{ dimension_id: "arbitrary_host_dimension", value: 0.5 }]))
    );
    expect(outcome.kind).toBe("COMMITTED");
    const bundle = outcome.bundle as AtomicCommitBundleV2;
    expect(bundle.commit_version).toBe("atomic-commit-v2");
    expect(bundle.writer_authority).toBeNull();
    expect(bundle.commit_ref).toBe(ORDINARY_V2_FROZEN_HASHES_V0.commit_ref);
    expect(bundle.canonical_result.result_ref).toBe(ORDINARY_V2_FROZEN_HASHES_V0.result_ref);
    expect(bundle.record_checksum).toBe(ORDINARY_V2_FROZEN_HASHES_V0.record_checksum);
    expect(bundle.state_hash_after).toBe(ORDINARY_V2_FROZEN_HASHES_V0.state_hash_after);
    expect(bundle.snapshot_hash_after).toBe(ORDINARY_V2_FROZEN_HASHES_V0.snapshot_hash_after);
  });

  it("§50 a governed reserved write WITHOUT authority fails closed through the real product path", async () => {
    const assembly = newFacade(null);
    const outcome = await commitViaFacade(
      assembly,
      relationshipProposal("t-gov-facade-1", 0, relationshipsWith([{ dimension_id: "relationship_core_facade_dim_v0", value: 0.5 }]))
    );
    expect(outcome.kind).toBe("REJECTED");
    expect(outcome.detail).toContain("governed reserved write without writer authority");
  });

  it("§50 no real product path emits non-null writer authority; committed bundles stay null-authority", async () => {
    const assembly = newFacade(0.5);
    const outcome = await commitViaFacade(
      assembly,
      relationshipProposal("t-gov-facade-2", 0, relationshipsWith([
        { dimension_id: "arbitrary_host_dimension", value: 0.1 },
        { dimension_id: "relationship_core_facade_dim_v0", value: 0.8 }
      ]))
    );
    expect(outcome.kind).toBe("REJECTED");
    for (const bundle of assembly.storeRead.getCommittedBundles()) {
      expect((bundle as AtomicCommitBundleV2).writer_authority ?? null).toBeNull();
    }
  });
});

// ---- §51 receipt determinism + evidence binding ---------------------------------------------

async function receiptDescriptor(
  overrides: Partial<RelationshipGovernedWritePolicyReceiptDescriptorV0> = {}
): Promise<RelationshipGovernedWritePolicyReceiptDescriptorV0> {
  return {
    schema_version: "relationship-governed-write-policy-receipt-v0",
    transition_id: "t-receipt-1" as never,
    subject_id: "subject-s0" as never,
    expected_revision: 0 as never,
    counterpart_ref: "entity:alice-like" as never,
    dimension_id: "relationship_core_receipt_dim_v0" as never,
    operation_kind: "INITIALIZE",
    previous: { kind: "ABSENT" },
    next: { kind: "PRESENT", value: 0.5 },
    feature_semantics_contract_id: "unadmitted-feature-v0" as never,
    feature_semantics_contract_fingerprint: WRONG_HASH as never,
    authorization_gate_id: RELATIONSHIP_GOVERNED_FEATURE_AUTHORIZATION_GATE_ID_V0,
    authorization_gate_fingerprint: await deriveRelationshipGovernedFeatureAuthorizationGateFingerprintV0(),
    write_policy_id: RELATIONSHIP_GOVERNED_FEATURE_WRITE_POLICY_ID_V0,
    write_policy_fingerprint: await deriveRelationshipGovernedFeatureWritePolicyFingerprintV0(),
    evidence_receipt_refs: ["episode:3333333333333333333333333333333333333333333333333333333333333333" as never],
    previous_governed_authority: { kind: "NONE" },
    authority_epoch_start_transition_id: "t-receipt-1" as never,
    ...overrides
  };
}

describe("§51 policy receipt determinism and evidence binding", () => {
  it("same preimage → exact same ref; ANY binding change → different ref", async () => {
    const base = await receiptDescriptor();
    const refA = await deriveRelationshipGovernedWritePolicyReceiptRefV0(base);
    const refB = await deriveRelationshipGovernedWritePolicyReceiptRefV0(await receiptDescriptor());
    expect(refA).toBe(refB);
    expect(refA).toMatch(/^workflow:[0-9a-f]{64}$/);

    const changed: [string, RelationshipGovernedWritePolicyReceiptDescriptorV0][] = [
      ["revision", await receiptDescriptor({ expected_revision: 1 as never })],
      ["target", await receiptDescriptor({ dimension_id: "relationship_core_other_v0" as never })],
      ["operation", await receiptDescriptor({ operation_kind: "UPDATE", previous: { kind: "PRESENT", value: 0.2 } as never })],
      ["next", await receiptDescriptor({ next: { kind: "PRESENT", value: 0.6 } })],
      ["semantics", await receiptDescriptor({ feature_semantics_contract_id: "other-feature-v0" as never })],
      ["gate", await receiptDescriptor({ authorization_gate_fingerprint: WRONG_HASH as never })],
      ["policy", await receiptDescriptor({ write_policy_fingerprint: WRONG_HASH as never })],
      ["evidence", await receiptDescriptor({ evidence_receipt_refs: ["episode:4444444444444444444444444444444444444444444444444444444444444444" as never] })],
      ["prior", await receiptDescriptor({ previous_governed_authority: { kind: "PRIOR", commit_ref: "commit:5555555555555555555555555555555555555555555555555555555555555555" as never, authority_payload_hash: WRONG_HASH as never } })],
      ["epoch", await receiptDescriptor({ authority_epoch_start_transition_id: "t-epoch-0" as never })]
    ];
    for (const [name, descriptor] of changed) {
      const ref = await deriveRelationshipGovernedWritePolicyReceiptRefV0(descriptor);
      expect(ref, `changed ${name} must change the receipt ref`).not.toBe(refA);
    }
  });

  it("§12 the family payload validator enforces nonempty/unique/sorted evidence", () => {
    const evidence = ["episode:3333333333333333333333333333333333333333333333333333333333333333"];
    const basePayload = {
      schema_version: "relationship-governed-feature-writer-authority-payload-v0",
      operation_kind: "INITIALIZE",
      subject_id: "subject-s0",
      expected_revision: 0,
      counterpart_ref: "entity:alice-like",
      dimension_id: "relationship_core_fixture_dim_v0",
      previous: { kind: "ABSENT" },
      next: { kind: "PRESENT", value: 0.5 },
      relationship_state_schema_version: "relationship-state-v0",
      feature_semantics_contract_id: "unadmitted-feature-v0",
      feature_semantics_contract_fingerprint: WRONG_HASH,
      write_policy_id: RELATIONSHIP_GOVERNED_FEATURE_WRITE_POLICY_ID_V0,
      write_policy_fingerprint: WRONG_HASH,
      evidence_receipt_refs: evidence,
      write_policy_receipt_ref: "workflow:4444444444444444444444444444444444444444444444444444444444444444",
      authority_epoch_start_transition_id: "t-receipt-1",
      previous_governed_authority: { kind: "NONE" }
    };
    expect(validateRelationshipGovernedFeatureWriterAuthorityPayloadV0(basePayload).ok).toBe(true);
    expect(
      validateRelationshipGovernedFeatureWriterAuthorityPayloadV0({
        ...basePayload,
        evidence_receipt_refs: []
      }).ok
    ).toBe(false);
    expect(
      validateRelationshipGovernedFeatureWriterAuthorityPayloadV0({
        ...basePayload,
        evidence_receipt_refs: [evidence[0], evidence[0]]
      }).ok
    ).toBe(false);
    expect(
      validateRelationshipGovernedFeatureWriterAuthorityPayloadV0({
        ...basePayload,
        evidence_receipt_refs: ["episode:4444444444444444444444444444444444444444444444444444444444444444", evidence[0]]
      }).ok
    ).toBe(false);
  });
});

// ---- §52 target derivation -------------------------------------------------------------------

describe("§52 governed target derivation from the exact diff", () => {
  it("derives none/one and rejects removal; ordinary unchanged targets derive nothing", () => {
    const none = deriveRelationshipGovernedTargetV0({
      predecessor: seedState(null) as never,
      candidate: seedState(null) as never
    });
    expect(none.kind).toBe("NO_GOVERNED_TARGET");

    const one = deriveRelationshipGovernedTargetV0({
      predecessor: seedState(null) as never,
      candidate: seedState(0.5) as never
    });
    expect(one.kind).toBe("GOVERNED_TARGET");
    if (one.kind === "GOVERNED_TARGET") {
      expect(one.dimension_id).toBe("relationship_core_facade_dim_v0");
      expect(one.previous).toStrictEqual({ kind: "ABSENT" });
      expect(one.next).toStrictEqual({ kind: "PRESENT", value: 0.5 });
    }

    const removal = deriveRelationshipGovernedTargetV0({
      predecessor: seedState(0.5) as never,
      candidate: seedState(null) as never
    });
    expect(removal.kind).toBe("REJECTED");
    if (removal.kind === "REJECTED") expect(removal.code).toBe("REMOVAL_UNSUPPORTED");

    const unchangedValue = deriveRelationshipGovernedTargetV0({
      predecessor: seedState(0.5) as never,
      candidate: seedState(0.5) as never
    });
    expect(unchangedValue.kind).toBe("NO_GOVERNED_TARGET");

    const changed = deriveRelationshipGovernedTargetV0({
      predecessor: seedState(0.5) as never,
      candidate: seedState(0.8) as never
    });
    expect(changed.kind).toBe("GOVERNED_TARGET");
  });
});

// ---- §53 trusted history capability ----------------------------------------------------------

/** Narrowing helper: assert a classification REJECTED verdict with the exact code. */
function expectRejectedOperation(
  operation: ReturnType<typeof classifyRelationshipGovernedOperationV0>,
  code: string
): void {
  if (typeof operation === "string") {
    throw new Error(`expected REJECTED(${code}), got lawful ${operation}`);
  }
  expect(operation.kind).toBe("REJECTED");
  expect(operation.code, code).toBe(code);
}

function presentPrevious(value: number): RelationshipGovernedFeaturePreviousValueV0 {
  return { kind: "PRESENT", value } as unknown as RelationshipGovernedFeaturePreviousValueV0;
}

async function buildTwoCommitChain(): Promise<{
  readonly genesis: SubjectStateV0;
  readonly bundles: readonly AtomicCommitBundleAnyVersion[];
}> {
  const assembly = newFacade(null);
  const first = await commitViaFacade(
    assembly,
    relationshipProposal("t-chain-1", 0, relationshipsWith([{ dimension_id: "arbitrary_host_dimension", value: 0.5 }]))
  );
  expect(first.kind).toBe("COMMITTED");
  const second = await commitViaFacade(
    assembly,
    relationshipProposal("t-chain-2", 1, relationshipsWith([{ dimension_id: "arbitrary_host_dimension", value: 0.7 }]))
  );
  expect(second.kind).toBe("COMMITTED");
  return { genesis: seedState(null), bundles: assembly.storeRead.getCommittedBundles() };
}

async function mintBoundary(genesis: SubjectStateV0, terminal: AtomicCommitBundleAnyVersion) {
  const genesisResult = await createPersistenceEnvelope({
    snapshot: genesis,
    repository_bindings: [{ repository_revision: "R0", repository_revision_hash: R0_HASH } as never],
    commit_head: null
  });
  if (!genesisResult.ok) throw new Error("fixture genesis envelope failed");
  const boundaryMint = await mintTrustedCanonicalHistoryBoundaryV0({
    genesis: genesisResult.value,
    head: {
      schema_version: "trusted-canonical-head-v0",
      subject_id: terminal.subject_id,
      revision: terminal.next_revision,
      commit_ref: terminal.commit_ref,
      record_checksum: terminal.record_checksum,
      state_hash: terminal.state_hash_after,
      snapshot_hash: terminal.snapshot_hash_after
    } as never
  });
  if (boundaryMint.kind !== "MINTED") throw new Error("fixture boundary mint failed");
  return boundaryMint.receipt;
}

function headFacts(terminal: AtomicCommitBundleAnyVersion) {
  return {
    subject_id: terminal.subject_id as never,
    state_revision: terminal.next_revision as never,
    commit_ref: terminal.commit_ref,
    record_checksum: terminal.record_checksum,
    state_hash: terminal.state_hash_after,
    snapshot_hash: terminal.snapshot_hash_after
  };
}

describe("§53 trusted history capability", () => {
  it("mints only for a VALID chain whose terminal head EXACTLY equals the current head", async () => {
    const { genesis, bundles } = await buildTwoCommitChain();
    const terminal = bundles[bundles.length - 1] as AtomicCommitBundleAnyVersion;
    const mint = await mintRelationshipGovernedTrustedHistoryCapabilityV0({
      trusted_boundary: await mintBoundary(genesis, terminal),
      bundles,
      current_head: headFacts(terminal)
    });
    expect(mint.kind).toBe("MINTED");
    if (mint.kind !== "MINTED") return;
    expect(Object.isFrozen(mint.capability)).toBe(true);
    expect(isRelationshipGovernedTrustedHistoryCapabilityV0(mint.capability)).toBe(true);

    const clone = structuredClone(mint.capability) as unknown as RelationshipGovernedTrustedHistoryCapabilityV0;
    expect(isRelationshipGovernedTrustedHistoryCapabilityV0(clone)).toBe(false);
    const lookupClone = await lookupLatestRelationshipGovernedAuthorityV0({
      capability: clone,
      bundles,
      subject_id: "subject-s0" as never,
      counterpart_ref: "entity:alice-like" as never,
      dimension_id: "relationship_core_x_v0" as never
    });
    expect(lookupClone.kind).toBe("UNTRUSTED_CAPABILITY");
  });

  it("rejects a stale terminal head and a truncated chain", async () => {
    const { genesis, bundles } = await buildTwoCommitChain();
    const terminal = bundles[bundles.length - 1] as AtomicCommitBundleAnyVersion;
    const first = bundles[0] as AtomicCommitBundleAnyVersion;

    const staleMint = await mintRelationshipGovernedTrustedHistoryCapabilityV0({
      trusted_boundary: await mintBoundary(genesis, terminal),
      bundles,
      current_head: headFacts(first)
    });
    expect(staleMint.kind).toBe("REJECTED");
    if (staleMint.kind === "REJECTED") expect(staleMint.code).toBe("HEAD_MISMATCH");

    const truncatedMint = await mintRelationshipGovernedTrustedHistoryCapabilityV0({
      trusted_boundary: await mintBoundary(genesis, terminal),
      bundles: bundles.slice(0, 1),
      current_head: headFacts(terminal)
    });
    expect(truncatedMint.kind).toBe("REJECTED");
    if (truncatedMint.kind === "REJECTED") expect(truncatedMint.code).toBe("CHAIN_INVALID");
  });

  it("lookup skips unrelated commits; UPDATE requires a proven RESOLVED_VALID prior; unavailable history never proves absence", async () => {
    const { genesis, bundles } = await buildTwoCommitChain();
    const terminal = bundles[bundles.length - 1] as AtomicCommitBundleAnyVersion;
    const mint = await mintRelationshipGovernedTrustedHistoryCapabilityV0({
      trusted_boundary: await mintBoundary(genesis, terminal),
      bundles,
      current_head: headFacts(terminal)
    });
    if (mint.kind !== "MINTED") throw new Error("fixture capability mint failed");
    const capability = mint.capability;

    const noMatch = await lookupLatestRelationshipGovernedAuthorityV0({
      capability,
      bundles,
      subject_id: "subject-s0" as never,
      counterpart_ref: "entity:alice-like" as never,
      dimension_id: "relationship_core_never_written_v0" as never
    });
    expect(noMatch.kind).toBe("NO_MATCHING_AUTHORITY");

    const unresolvedPrior = classifyRelationshipGovernedOperationV0({
      target: {
        previous: presentPrevious(0.5),
        next: { kind: "PRESENT", value: 0.8 }
      },
      latest_lookup: {
        kind: "FOUND",
        payload: { next: { value: 0.5 } },
        status: "UNRESOLVED"
      }
    });
    expectRejectedOperation(unresolvedPrior, "PRIOR_NOT_RESOLVED_VALID");

    const unprovenPrior = classifyRelationshipGovernedOperationV0({
      target: {
        previous: presentPrevious(0.6),
        next: { kind: "PRESENT", value: 0.8 }
      },
      latest_lookup: {
        kind: "FOUND",
        payload: { next: { value: 0.5 } },
        status: "RESOLVED_VALID"
      }
    });
    expectRejectedOperation(unprovenPrior, "UPDATE_WITHOUT_PROVEN_PRIOR");

    const equalUpdate = classifyRelationshipGovernedOperationV0({
      target: {
        previous: presentPrevious(0.5),
        next: { kind: "PRESENT", value: 0.5 }
      },
      latest_lookup: { kind: "FOUND", payload: { next: { value: 0.5 } }, status: "RESOLVED_VALID" }
    });
    expectRejectedOperation(equalUpdate, "EQUAL_UPDATE_FORBIDDEN");

    const lawfulUpdate = classifyRelationshipGovernedOperationV0({
      target: {
        previous: presentPrevious(0.5),
        next: { kind: "PRESENT", value: 0.8 }
      },
      latest_lookup: { kind: "FOUND", payload: { next: { value: 0.5 } }, status: "RESOLVED_VALID" }
    });
    expect(lawfulUpdate).toBe("UPDATE");

    const unavailable = classifyRelationshipGovernedOperationV0({
      target: {
        previous: presentPrevious(0.5),
        next: { kind: "PRESENT", value: 0.8 }
      },
      latest_lookup: { kind: "UNTRUSTED_CAPABILITY", detail: "history unavailable" }
    });
    expectRejectedOperation(unavailable, "REINITIALIZE_WITH_UNRESOLVED_LINEAGE");

    const bootstrap = classifyRelationshipGovernedOperationV0({
      target: {
        previous: presentPrevious(0.5),
        next: { kind: "PRESENT", value: 0.8 }
      },
      latest_lookup: { kind: "NO_MATCHING_AUTHORITY" }
    });
    expect(bootstrap).toBe("REINITIALIZE");

    const contradiction = classifyRelationshipGovernedOperationV0({
      target: {
        previous: { kind: "ABSENT" },
        next: { kind: "PRESENT", value: 0.5 }
      },
      latest_lookup: { kind: "FOUND", payload: { next: { value: 0.4 } }, status: "RESOLVED_VALID" }
    });
    expectRejectedOperation(contradiction, "INITIALIZE_WITH_LINEAGE");
  });
});

// ---- §49 gate/policy injection rejection (registry-level, runtime side) ---------------------

describe("§49 gate/policy/fingerprint injection is rejected by the exact resolvers", () => {
  it("fails closed on unknown gate/policy ids and fingerprint mismatches", async () => {
    const gateFp = await deriveRelationshipGovernedFeatureAuthorizationGateFingerprintV0();
    const policyFp = await deriveRelationshipGovernedFeatureWritePolicyFingerprintV0();
    expect((await resolveAuthorizationGateV0({
      authorization_gate_id: "forged-gate-v0",
      authorization_gate_fingerprint: gateFp
    })).layer).toBe("UNKNOWN");
    expect((await resolveAuthorizationGateV0({
      authorization_gate_id: RELATIONSHIP_GOVERNED_FEATURE_AUTHORIZATION_GATE_ID_V0,
      authorization_gate_fingerprint: WRONG_HASH
    })).layer).toBe("INVALID");
    expect((await resolveGovernedWritePolicyV0({
      write_policy_id: "forged-policy-v0",
      write_policy_fingerprint: policyFp
    })).layer).toBe("UNKNOWN");
    expect((await resolveGovernedWritePolicyV0({
      write_policy_id: RELATIONSHIP_GOVERNED_FEATURE_WRITE_POLICY_ID_V0,
      write_policy_fingerprint: WRONG_HASH
    })).layer).toBe("INVALID");
  });
});
