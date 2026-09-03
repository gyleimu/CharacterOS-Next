/**
 * Interaction Familiarity Governed Authority V1 — live + historical acceptance
 * (RELATIONSHIP_REGISTERED_FEATURE_ADMISSION_V1, INTERACTION_FAMILIARITY_ONLY):
 *
 *   LIVE       the internal governed-write evaluation PREPAREs the exact
 *              lawful INITIALIZE familiarity authority (one receipt → 1/32,
 *              derived epoch, cumulative receipt set) through the REAL
 *              trusted-history capability minted over a REAL committed chain,
 *              and DENIES arbitrary next values, raw episode evidence,
 *              duplicate evidence and unauthorized reinitialization
 *   HISTORICAL the static historical resolver classifies the EXACT lawful
 *              familiarity authority RESOLVED_VALID — and every wrong
 *              identity/fingerprint/lineage/grid/cardinality variant NOT valid
 *   FROZEN     generic reserved writes still fail closed through the real
 *              product facade; ordinary V2 commits keep writer_authority null
 *
 * There is NO product governed-write path: the evaluation surface used here is
 * internal (deep module import, mirroring the existing authority suites).
 * Fully OFFLINE: deterministic fixtures only — no model, no transport.
 */

import { describe, expect, it } from "vitest";

import {
  createInMemorySubjectCoreFacade,
  createPersistenceEnvelope,
  proposalFingerprint,
  proposalRef,
  type AtomicCommitBundleAnyVersion,
  type AtomicCommitBundleV2,
  type CanonicalTransitionProposalV1,
  type SubjectStateV0
} from "@characteros-next/subject-core";

import {
  deriveRelationshipGovernedFeatureAuthorizationGateFingerprintV0,
  deriveRelationshipGovernedFeatureWritePolicyFingerprintV0,
  deriveRelationshipGovernedWriterSchemaFingerprintV0,
  RELATIONSHIP_GOVERNED_FEATURE_AUTHORIZATION_GATE_ID_V0,
  RELATIONSHIP_GOVERNED_FEATURE_WRITE_POLICY_ID_V0,
  RELATIONSHIP_GOVERNED_WRITER_SCHEMA_ID_V0,
  classifyHistoricalWriterAuthorityStatusV0
} from "./historical-writer-authority-registry.js";
import {
  mintRelationshipGovernedTrustedHistoryCapabilityV0,
  type RelationshipGovernedTrustedHistoryCapabilityV0
} from "./relationship-governed-trusted-history.js";
import { mintTrustedCanonicalHistoryBoundaryV0 } from "./trusted-canonical-history-boundary.js";
import {
  evaluateRelationshipGovernedWriteV0,
  isRelationshipPreparedAuthorityCapabilityV0,
  classifyRelationshipGovernedOperationV0
} from "../transitions/relationship/relationship-governed-write-authority-service.js";
import {
  enforceInteractionFamiliarityLiveLawV0
} from "../transitions/relationship/relationship-interaction-familiarity-accrual-policy.js";
import {
  deriveRelationshipInteractionFamiliarityEvidenceReceiptRefV0,
  type RelationshipInteractionFamiliarityEvidenceReceiptV0
} from "../transitions/relationship/relationship-interaction-familiarity-evidence-receipt.js";
import {
  INTERACTION_FAMILIARITY_DIMENSION_ID_V0,
  INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_FINGERPRINT_V0,
  INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_ID_V0
} from "../transitions/relationship/relationship-feature-decision-semantics.js";
import {
  validateRelationshipGovernedFeatureWriterAuthorityPayloadV0
} from "../transitions/relationship/relationship-governed-writer-authority.js";

const R0_HASH = "sha256:4444444444444444444444444444444444444444444444444444444444444444";
const WRONG_HASH = "sha256:2222222222222222222222222222222222222222222222222222222222222222";
const FAMILIARITY = INTERACTION_FAMILIARITY_DIMENSION_ID_V0;

// ---- fixtures ---------------------------------------------------------------------------

function seedState(governedValue: number | null): SubjectStateV0 {
  const counterparts =
    governedValue === null
      ? []
      : [
          {
            counterpart_ref: "entity:alice-like",
            dimensions: [{ dimension_id: FAMILIARITY, value: governedValue }]
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

function familiarityRelationships(
  entries: { counterpart_ref: string; dimension_id: string; value: number }[]
): Record<string, unknown> {
  return {
    schema_version: "relationship-state-v0",
    counterparts: entries.map((entry) => ({
      counterpart_ref: entry.counterpart_ref,
      dimensions: [{ dimension_id: entry.dimension_id, value: entry.value }]
    }))
  };
}

function familiarityProposal(input: {
  readonly transitionId: string;
  readonly expectedRevision: number;
  readonly nextRelationships: Record<string, unknown>;
  readonly evidenceRefs: readonly string[];
}): CanonicalTransitionProposalV1 {
  return {
    schema_version: "canonical-transition-proposal-v1",
    transition_id: input.transitionId,
    subject_id: "subject-s0",
    transition_type: "Relationship",
    expected_state_revision: input.expectedRevision,
    time_input: { kind: "OCCURRENCE", occurrence_logical_time: 0 },
    cause_refs: input.evidenceRefs,
    domain_deltas: [
      {
        producer: "relationship",
        domain: "relationship",
        expected_repository_revision: null,
        operations: [{ path: "/relationships", value: input.nextRelationships }],
        provenance_refs: input.evidenceRefs
      }
    ],
    external_refs: []
  } as unknown as CanonicalTransitionProposalV1;
}

function hostRelationshipProposal(
  transitionId: string,
  expectedRevision: number,
  value: number
): CanonicalTransitionProposalV1 {
  return familiarityProposal({
    transitionId,
    expectedRevision,
    nextRelationships: familiarityRelationships([
      { counterpart_ref: "entity:alice-like", dimension_id: "arbitrary_host_dimension", value }
    ]),
    evidenceRefs: []
  });
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
): Promise<{ readonly kind: string; readonly bundle?: AtomicCommitBundleAnyVersion }> {
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
  if (committed.kind !== "COMMITTED") return { kind: committed.kind };
  return { kind: "COMMITTED", bundle: committed.bundle };
}

async function buildTwoCommitChain(): Promise<{
  readonly genesis: SubjectStateV0;
  readonly bundles: readonly AtomicCommitBundleAnyVersion[];
}> {
  const assembly = newFacade(null);
  const first = await commitViaFacade(assembly, hostRelationshipProposal("t-fam-chain-1", 0, 0.5));
  expect(first.kind).toBe("COMMITTED");
  const second = await commitViaFacade(assembly, hostRelationshipProposal("t-fam-chain-2", 1, 0.7));
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

function receiptFixture(
  overrides: Partial<RelationshipInteractionFamiliarityEvidenceReceiptV0> = {}
): RelationshipInteractionFamiliarityEvidenceReceiptV0 {
  return {
    schema_version: "relationship-interaction-familiarity-evidence-receipt-v0",
    subject_id: "subject-s0" as never,
    counterpart_ref: "entity:alice-like" as never,
    episode_ref: "episode:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as never,
    episode_payload_hash: WRONG_HASH as never,
    qualifying_class: "DIRECT_COMMUNICATION",
    evidence_admission_policy_id:
      "relationship-interaction-familiarity-evidence-admission-policy-v0",
    ...overrides
  };
}

async function governedHistory(): Promise<{
  readonly capability: RelationshipGovernedTrustedHistoryCapabilityV0;
  readonly bundles: readonly AtomicCommitBundleAnyVersion[];
}> {
  const { genesis, bundles } = await buildTwoCommitChain();
  const terminal = bundles[bundles.length - 1] as AtomicCommitBundleAnyVersion;
  const mint = await mintRelationshipGovernedTrustedHistoryCapabilityV0({
    trusted_boundary: await mintBoundary(genesis, terminal),
    bundles,
    current_head: {
      subject_id: terminal.subject_id as never,
      state_revision: terminal.next_revision as never,
      commit_ref: terminal.commit_ref,
      record_checksum: terminal.record_checksum,
      state_hash: terminal.state_hash_after,
      snapshot_hash: terminal.snapshot_hash_after
    }
  });
  if (mint.kind !== "MINTED") throw new Error("fixture capability mint failed");
  return { capability: mint.capability, bundles };
}

async function evaluateFamiliarity(input: {
  readonly capability: unknown;
  readonly bundles: readonly AtomicCommitBundleAnyVersion[];
  readonly proposal: CanonicalTransitionProposalV1;
  readonly next: number;
  readonly previous: { kind: "ABSENT" } | { kind: "PRESENT"; value: number };
  readonly evidenceRefs: readonly string[];
  readonly counterpartRef?: string;
}) {
  return evaluateRelationshipGovernedWriteV0({
    proposal: {
      proposal_ref: await proposalRef(input.proposal),
      payload_fingerprint: await proposalFingerprint(input.proposal),
      subject_id: "subject-s0" as never,
      expected_revision: input.proposal.expected_state_revision as never,
      transition_id: input.proposal.transition_id as never,
      cause_refs: input.evidenceRefs as never,
      external_refs: [],
      relationship_delta_provenance_refs: input.evidenceRefs as never
    },
    target: {
      counterpart_ref: (input.counterpartRef ?? "entity:alice-like") as never,
      dimension_id: FAMILIARITY,
      previous: input.previous as never,
      next: { kind: "PRESENT", value: input.next } as never
    },
    feature: {
      feature_semantics_contract_id: INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_ID_V0,
      feature_semantics_contract_fingerprint: INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_FINGERPRINT_V0
    },
    evidence_receipt_refs: input.evidenceRefs as never,
    history: { capability: input.capability as never, bundles: input.bundles as never }
  });
}

// ---- live governed familiarity authority -------------------------------------------------

describe("live governed interaction-familiarity authority", () => {
  it("PREPAREs the exact lawful INITIALIZE (one receipt → 1/32, derived epoch)", async () => {
    const { capability, bundles } = await governedHistory();
    const r1 = await deriveRelationshipInteractionFamiliarityEvidenceReceiptRefV0(
      receiptFixture({ episode_ref: "episode:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as never })
    );
    const proposal = familiarityProposal({
      transitionId: "t-fam-init-1",
      expectedRevision: 2,
      nextRelationships: familiarityRelationships([
        { counterpart_ref: "entity:alice-like", dimension_id: FAMILIARITY, value: 1 / 32 }
      ]),
      evidenceRefs: [r1]
    });
    const evaluation = await evaluateFamiliarity({
      capability,
      bundles,
      proposal,
      next: 1 / 32,
      previous: { kind: "ABSENT" },
      evidenceRefs: [r1]
    });
    expect(evaluation.kind).toBe("PREPARED");
    if (evaluation.kind !== "PREPARED") return;
    expect(evaluation.operation).toBe("INITIALIZE");
    expect(evaluation.authority_epoch_start_transition_id).toBe("t-fam-init-1");
    expect(evaluation.receipt_descriptor.evidence_receipt_refs).toStrictEqual([r1]);
    expect(evaluation.receipt_descriptor.previous_governed_authority).toStrictEqual({ kind: "NONE" });
    expect(Object.isFrozen(evaluation.capability)).toBe(true);
    expect(isRelationshipPreparedAuthorityCapabilityV0(evaluation.capability)).toBe(true);
    const clone = structuredClone(evaluation.capability);
    expect(isRelationshipPreparedAuthorityCapabilityV0(clone)).toBe(false);
  });

  it("DENIES an arbitrary caller-selected next value", async () => {
    const { capability, bundles } = await governedHistory();
    const r1 = await deriveRelationshipInteractionFamiliarityEvidenceReceiptRefV0(receiptFixture());
    const proposal = familiarityProposal({
      transitionId: "t-fam-init-bad",
      expectedRevision: 2,
      nextRelationships: familiarityRelationships([
        { counterpart_ref: "entity:alice-like", dimension_id: FAMILIARITY, value: 0.5 }
      ]),
      evidenceRefs: [r1]
    });
    const evaluation = await evaluateFamiliarity({
      capability,
      bundles,
      proposal,
      next: 0.5,
      previous: { kind: "ABSENT" },
      evidenceRefs: [r1]
    });
    expect(evaluation).toMatchObject({ kind: "DENIED", code: "FEATURE_LAW_REJECTED" });
  });

  it("DENIES raw episode refs used as familiarity evidence", async () => {
    const { capability, bundles } = await governedHistory();
    const proposal = familiarityProposal({
      transitionId: "t-fam-init-raw",
      expectedRevision: 2,
      nextRelationships: familiarityRelationships([
        { counterpart_ref: "entity:alice-like", dimension_id: FAMILIARITY, value: 1 / 32 }
      ]),
      evidenceRefs: ["episode:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"]
    });
    const evaluation = await evaluateFamiliarity({
      capability,
      bundles,
      proposal,
      next: 1 / 32,
      previous: { kind: "ABSENT" },
      evidenceRefs: ["episode:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"]
    });
    expect(evaluation).toMatchObject({ kind: "DENIED", code: "FEATURE_LAW_REJECTED" });
    if (evaluation.kind === "DENIED") {
      expect(evaluation.detail).toContain("FAMILIARITY_EVIDENCE_NOT_RECEIPT_REF");
    }
  });

  it("DENIES a familiarity reinitialization for a different counterpart (no proven prior)", async () => {
    const { capability, bundles } = await governedHistory();
    const r1 = await deriveRelationshipInteractionFamiliarityEvidenceReceiptRefV0(receiptFixture());
    const proposal = familiarityProposal({
      transitionId: "t-fam-bob",
      expectedRevision: 2,
      nextRelationships: familiarityRelationships([
        { counterpart_ref: "entity:alice-like", dimension_id: "arbitrary_host_dimension", value: 0.5 },
        { counterpart_ref: "entity:bob-like", dimension_id: FAMILIARITY, value: 1 / 32 }
      ]),
      evidenceRefs: [r1]
    });
    const evaluation = await evaluateFamiliarity({
      capability,
      bundles,
      proposal,
      next: 1 / 32,
      previous: { kind: "PRESENT", value: 1 / 32 },
      evidenceRefs: [r1],
      counterpartRef: "entity:bob-like"
    });
    // a present target whose history carries NO matching authority classifies
    // REINITIALIZE, which ordinary familiarity V0 never authorizes
    expect(evaluation).toMatchObject({ kind: "DENIED", code: "FEATURE_LAW_REJECTED" });
    if (evaluation.kind === "DENIED") {
      expect(evaluation.detail).toContain("FAMILIARITY_REINITIALIZE_UNSUPPORTED");
    }
  });

  it("DENIES an untrusted (cloned) history capability", async () => {
    const { capability, bundles } = await governedHistory();
    const clone = structuredClone(capability);
    const r1 = await deriveRelationshipInteractionFamiliarityEvidenceReceiptRefV0(receiptFixture());
    const proposal = familiarityProposal({
      transitionId: "t-fam-clone",
      expectedRevision: 2,
      nextRelationships: familiarityRelationships([
        { counterpart_ref: "entity:alice-like", dimension_id: FAMILIARITY, value: 1 / 32 }
      ]),
      evidenceRefs: [r1]
    });
    const evaluation = await evaluateFamiliarity({
      capability: clone,
      bundles,
      proposal,
      next: 1 / 32,
      previous: { kind: "ABSENT" },
      evidenceRefs: [r1]
    });
    expect(evaluation).toMatchObject({ kind: "DENIED", code: "UNTRUSTED_HISTORY" });
  });

  it("composes the frozen operation classification with the familiarity law for UPDATE", () => {
    const r1 = "appraisal:1111111111111111111111111111111111111111111111111111111111111111";
    const r2 = "appraisal:2222222222222222222222222222222222222222222222222222222222222222";
    const operation = classifyRelationshipGovernedOperationV0({
      target: {
        previous: { kind: "PRESENT", value: 1 / 32 } as never,
        next: { kind: "PRESENT", value: 2 / 32 }
      },
      latest_lookup: {
        kind: "FOUND",
        payload: { next: { value: 1 / 32 } },
        status: "RESOLVED_VALID"
      }
    });
    expect(operation).toBe("UPDATE");
    const law = enforceInteractionFamiliarityLiveLawV0({
      operation: "UPDATE",
      previous: { kind: "PRESENT", value: 1 / 32 },
      next: { kind: "PRESENT", value: 2 / 32 },
      proposed_receipt_refs: [r1 as never, r2 as never],
      prior: { kind: "PRIOR", receipt_refs: [r1 as never] }
    });
    expect(law).toMatchObject({ ok: true, k: 2 });
    // a duplicate second receipt derives no advancement
    const duplicate = enforceInteractionFamiliarityLiveLawV0({
      operation: "UPDATE",
      previous: { kind: "PRESENT", value: 1 / 32 },
      next: { kind: "PRESENT", value: 2 / 32 },
      proposed_receipt_refs: [r1 as never],
      prior: { kind: "PRIOR", receipt_refs: [r1 as never] }
    });
    expect(duplicate).toMatchObject({ ok: false, code: "FAMILIARITY_DUPLICATE_RECEIPT" });
  });
});

// ---- historical resolver -----------------------------------------------------------------

function governedAuthorityRecordFixture(input: {
  readonly payload: Record<string, unknown>;
  readonly writerClass: string;
}): Record<string, unknown> {
  return {
    proposal_ref: "proposal:5555555555555555555555555555555555555555555555555555555555555555",
    payload_fingerprint: WRONG_HASH,
    writer_family: "RELATIONSHIP_GOVERNED_FEATURE",
    writer_class: input.writerClass,
    writer_schema_id: RELATIONSHIP_GOVERNED_WRITER_SCHEMA_ID_V0,
    writer_schema_fingerprint: "", // filled by the test after async derivation
    authorization_gate_id: RELATIONSHIP_GOVERNED_FEATURE_AUTHORIZATION_GATE_ID_V0,
    authorization_gate_fingerprint: "", // filled by the test after async derivation
    authority_payload: input.payload
  };
}

async function familiarityRecordFixture(
  payloadOverrides: Record<string, unknown>,
  writerClass: string
): Promise<Record<string, unknown>> {
  const payload = {
    schema_version: "relationship-governed-feature-writer-authority-payload-v0",
    operation_kind: writerClass,
    subject_id: "subject-s0",
    expected_revision: 0,
    counterpart_ref: "entity:alice-like",
    dimension_id: FAMILIARITY,
    previous: { kind: "ABSENT" },
    next: { kind: "PRESENT", value: 1 / 32 },
    relationship_state_schema_version: "relationship-state-v0",
    feature_semantics_contract_id: INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_ID_V0,
    feature_semantics_contract_fingerprint: INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_FINGERPRINT_V0,
    write_policy_id: RELATIONSHIP_GOVERNED_FEATURE_WRITE_POLICY_ID_V0,
    write_policy_fingerprint: await deriveRelationshipGovernedFeatureWritePolicyFingerprintV0(),
    evidence_receipt_refs: [
      "appraisal:1111111111111111111111111111111111111111111111111111111111111111"
    ],
    write_policy_receipt_ref:
      "workflow:3333333333333333333333333333333333333333333333333333333333333333",
    authority_epoch_start_transition_id: "t-fam-epoch-1",
    previous_governed_authority: { kind: "NONE" },
    ...payloadOverrides
  };
  return {
    ...governedAuthorityRecordFixture({ payload, writerClass }),
    writer_schema_fingerprint: await deriveRelationshipGovernedWriterSchemaFingerprintV0(),
    authorization_gate_fingerprint: await deriveRelationshipGovernedFeatureAuthorizationGateFingerprintV0()
  };
}

describe("historical resolver admits the exact lawful familiarity authority", () => {
  it("classifies a lawful INITIALIZE familiarity authority RESOLVED_VALID", async () => {
    const record = await familiarityRecordFixture({}, "INITIALIZE");
    const resolution = await classifyHistoricalWriterAuthorityStatusV0(record as never);
    expect(resolution.status).toBe("RESOLVED_VALID");
    expect(resolution.schema_layer).toBe("RESOLVED");
    expect(resolution.gate_layer).toBe("RESOLVED");
    expect(resolution.policy_layer).toBe("RESOLVED");
    expect(resolution.feature_layer).toBe("ADMITTED");
  });

  it("classifies a lawful UPDATE familiarity authority RESOLVED_VALID", async () => {
    const record = await familiarityRecordFixture(
      {
        operation_kind: "UPDATE",
        expected_revision: 1,
        previous: { kind: "PRESENT", value: 1 / 32 },
        next: { kind: "PRESENT", value: 2 / 32 },
        evidence_receipt_refs: [
          "appraisal:1111111111111111111111111111111111111111111111111111111111111111",
          "appraisal:2222222222222222222222222222222222222222222222222222222222222222"
        ],
        authority_epoch_start_transition_id: "t-fam-epoch-0",
        previous_governed_authority: {
          kind: "PRIOR",
          commit_ref: "commit:4444444444444444444444444444444444444444444444444444444444444444",
          authority_payload_hash: WRONG_HASH
        }
      },
      "UPDATE"
    );
    const resolution = await classifyHistoricalWriterAuthorityStatusV0(record as never);
    expect(resolution.status).toBe("RESOLVED_VALID");
  });

  it("keeps wrong identity, fingerprint, lineage, grid, cardinality and operation INVALID/UNRESOLVED", async () => {
    // wrong feature semantics identity → UNADMITTED
    const wrongIdentity = await familiarityRecordFixture(
      { feature_semantics_contract_id: "relationship-trust-semantics-v0" },
      "INITIALIZE"
    );
    expect((await classifyHistoricalWriterAuthorityStatusV0(wrongIdentity as never)).status).toBe("UNRESOLVED");

    // wrong feature semantics fingerprint → UNADMITTED
    const wrongFingerprint = await familiarityRecordFixture(
      { feature_semantics_contract_fingerprint: WRONG_HASH },
      "INITIALIZE"
    );
    const wrongFingerprintResolution = await classifyHistoricalWriterAuthorityStatusV0(wrongFingerprint as never);
    expect(wrongFingerprintResolution.status).toBe("UNRESOLVED");
    expect(wrongFingerprintResolution.feature_layer).toBe("UNADMITTED");

    // unsorted/duplicate evidence → structurally invalid → RESOLVED_INVALID
    const unsorted = await familiarityRecordFixture(
      {
        evidence_receipt_refs: [
          "appraisal:2222222222222222222222222222222222222222222222222222222222222222",
          "appraisal:1111111111111111111111111111111111111111111111111111111111111111"
        ]
      },
      "INITIALIZE"
    );
    expect((await classifyHistoricalWriterAuthorityStatusV0(unsorted as never)).status).toBe("RESOLVED_INVALID");

    // off-grid next value → familiarity law violation → RESOLVED_INVALID
    const offGrid = await familiarityRecordFixture(
      { next: { kind: "PRESENT", value: 0.5 } },
      "INITIALIZE"
    );
    expect((await classifyHistoricalWriterAuthorityStatusV0(offGrid as never)).status).toBe("RESOLVED_INVALID");

    // INITIALIZE at 2/32 → law violation
    const wrongLevel = await familiarityRecordFixture(
      { next: { kind: "PRESENT", value: 2 / 32 } },
      "INITIALIZE"
    );
    expect((await classifyHistoricalWriterAuthorityStatusV0(wrongLevel as never)).status).toBe("RESOLVED_INVALID");

    // REINITIALIZE is never lawful for familiarity V0
    const reinit = await familiarityRecordFixture(
      {
        operation_kind: "REINITIALIZE",
        previous: { kind: "PRESENT", value: 1 / 32 }
      },
      "REINITIALIZE"
    );
    expect((await classifyHistoricalWriterAuthorityStatusV0(reinit as never)).status).toBe("RESOLVED_INVALID");

    // UPDATE without a PRIOR chain → law violation
    const updateNoPrior = await familiarityRecordFixture(
      {
        operation_kind: "UPDATE",
        expected_revision: 1,
        previous: { kind: "PRESENT", value: 1 / 32 },
        next: { kind: "PRESENT", value: 2 / 32 },
        evidence_receipt_refs: [
          "appraisal:1111111111111111111111111111111111111111111111111111111111111111",
          "appraisal:2222222222222222222222222222222222222222222222222222222222222222"
        ]
      },
      "UPDATE"
    );
    expect((await classifyHistoricalWriterAuthorityStatusV0(updateNoPrior as never)).status).toBe("RESOLVED_INVALID");
  });
});

// ---- frozen regressions through the real product facade -----------------------------------

describe("frozen regressions for the familiarity slice", () => {
  it("a reserved familiarity write WITHOUT authority fails closed through the real facade", async () => {
    const assembly = newFacade(null);
    const outcome = await commitViaFacade(
      assembly,
      familiarityProposal({
        transitionId: "t-fam-guard",
        expectedRevision: 0,
        nextRelationships: familiarityRelationships([
          { counterpart_ref: "entity:alice-like", dimension_id: FAMILIARITY, value: 1 / 32 }
        ]),
        evidenceRefs: []
      })
    );
    expect(outcome.kind).toBe("REJECTED");
  });

  it("an ordinary non-governed commit keeps writer_authority null", async () => {
    const assembly = newFacade(null);
    const outcome = await commitViaFacade(assembly, hostRelationshipProposal("t-fam-ordinary", 0, 0.5));
    expect(outcome.kind).toBe("COMMITTED");
    if (outcome.kind !== "COMMITTED" || !outcome.bundle) return;
    const bundle = outcome.bundle as AtomicCommitBundleV2;
    expect(bundle.commit_version).toBe("atomic-commit-v2");
    expect(bundle.writer_authority).toBeNull();
  });

  it("keeps the familiarity payload structurally valid under the frozen 17-field schema", () => {
    const checked = validateRelationshipGovernedFeatureWriterAuthorityPayloadV0({
      schema_version: "relationship-governed-feature-writer-authority-payload-v0",
      operation_kind: "INITIALIZE",
      subject_id: "subject-s0",
      expected_revision: 0,
      counterpart_ref: "entity:alice-like",
      dimension_id: FAMILIARITY,
      previous: { kind: "ABSENT" },
      next: { kind: "PRESENT", value: 1 / 32 },
      relationship_state_schema_version: "relationship-state-v0",
      feature_semantics_contract_id: INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_ID_V0,
      feature_semantics_contract_fingerprint: INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_FINGERPRINT_V0,
      write_policy_id: RELATIONSHIP_GOVERNED_FEATURE_WRITE_POLICY_ID_V0,
      write_policy_fingerprint: WRONG_HASH,
      evidence_receipt_refs: [
        "appraisal:1111111111111111111111111111111111111111111111111111111111111111"
      ],
      write_policy_receipt_ref:
        "workflow:3333333333333333333333333333333333333333333333333333333333333333",
      authority_epoch_start_transition_id: "t-fam-epoch-1",
      previous_governed_authority: { kind: "NONE" }
    });
    expect(checked.ok).toBe(true);
  });
});
