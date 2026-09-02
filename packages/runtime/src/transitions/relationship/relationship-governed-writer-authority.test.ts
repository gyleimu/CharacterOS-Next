/**
 * RelationshipGovernedFeatureWriterAuthorityPayloadV0 — acceptance suite
 * (§34/§23/§39): exact 17-field closed contract, all three operation kinds,
 * reserved-dimension requirement, evidence nonempty/unique/sorted, tagged
 * previous/next unions, operation cross-rules, removal impossibility, and the
 * single-record RELATIONSHIP_GOVERNED_FEATURE cross-binding over a fully
 * self-consistent deterministic V2 bundle fixture.
 *
 * A structurally valid governed payload NEVER creates a production writer:
 * the frozen feature-semantics registry remains zero-entry throughout.
 *
 * Fully OFFLINE: pure deterministic functions only.
 */

import { describe, expect, it } from "vitest";

import {
  deriveRef,
  lastTraceRef,
  proposalFingerprint,
  proposalRef,
  snapshotHash,
  stateHash,
  TRACE_RULE_IDS,
  validateAtomicCommitBundleV2,
  type AtomicCommitBundleV2,
  type CanonicalTransitionProposalV1,
  type CanonicalWriterAuthorityRecordV0,
  type SubjectStateV0
} from "@characteros-next/subject-core";
import {
  deriveAtomicCommitRecordChecksumV2,
  deriveAtomicCommitRefV2,
  deriveWriterAuthorityPayloadHashV0
} from "@characteros-next/subject-core";

import {
  RELATIONSHIP_GOVERNED_FEATURE_WRITER_AUTHORITY_PAYLOAD_SCHEMA_VERSION,
  validateRelationshipGovernedFeatureWriterAuthorityPayloadV0,
  validateRelationshipGovernedFeatureAuthorityBindingV0
} from "./relationship-governed-writer-authority.js";
import { REGISTERED_RELATIONSHIP_DECISION_FEATURE_IDS_V0 } from "./relationship-feature-decision-semantics.js";
import * as payloadModule from "./relationship-governed-writer-authority.js";

// ---- deterministic fixtures ---------------------------------------------------------

const HASH = "sha256:3333333333333333333333333333333333333333333333333333333333333333";
const RESULT_ID_PROJECTION_V1 = "characteros-next/subject-core/result-id/v1";
const RESERVED_ID = "relationship_core_fixture_dimension_v0";
const OPAQUE_ID = "arbitrary_host_dimension";
const ALICE = "entity:alice-like";
const EVIDENCE = ["episode:ep-01"];
const RECEIPT = "workflow:w-policy-receipt-001";

function relationshipState(value: number): Record<string, unknown> {
  return {
    schema_version: "relationship-state-v0",
    counterparts: [
      {
        counterpart_ref: ALICE,
        dimensions: [{ dimension_id: RESERVED_ID, value }]
      }
    ]
  };
}

function governedPayloadFixture(
  overrides?: Partial<Record<string, unknown>>
): Record<string, unknown> {
  return {
    schema_version: RELATIONSHIP_GOVERNED_FEATURE_WRITER_AUTHORITY_PAYLOAD_SCHEMA_VERSION,
    operation_kind: "UPDATE",
    subject_id: "subject-s0",
    expected_revision: 0,
    counterpart_ref: ALICE,
    dimension_id: RESERVED_ID,
    previous: { kind: "PRESENT", value: 0.4 },
    next: { kind: "PRESENT", value: 0.6 },
    relationship_state_schema_version: "relationship-state-v0",
    feature_semantics_contract_id: "test-feature-semantics-contract-v0",
    feature_semantics_contract_fingerprint: HASH,
    write_policy_id: "test-write-policy-v0",
    write_policy_fingerprint: HASH,
    evidence_receipt_refs: EVIDENCE,
    write_policy_receipt_ref: RECEIPT,
    authority_epoch_start_transition_id: "t-v2-fixture-001",
    previous_governed_authority: { kind: "NONE" },
    ...overrides
  };
}

function baseState(
  relationshipsValue: Record<string, unknown>,
  stateRevision: number,
  logicalTime: number,
  traceEntries: readonly unknown[]
): SubjectStateV0 {
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
    relationships: relationshipsValue,
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
        last_history_sequence: traceEntries.length,
        offloaded_through_sequence: 0,
        offloaded_through_trace_ref: null
      },
      entries: [...traceEntries] as never
    },
    runtime_metadata: {
      subject_version: "subject-v0",
      state_revision: stateRevision,
      logical_time: logicalTime,
      last_transition_time: stateRevision === 0 ? null : logicalTime,
      last_transition_type: stateRevision === 0 ? null : "Relationship",
      created_at: 0,
      updated_at: logicalTime
    }
  } as unknown as SubjectStateV0;
}

function governedProposal(nextValue: number): CanonicalTransitionProposalV1 {
  return {
    schema_version: "canonical-transition-proposal-v1",
    transition_id: "t-v2-fixture-001",
    subject_id: "subject-s0",
    transition_type: "Relationship",
    expected_state_revision: 0,
    time_input: { kind: "OCCURRENCE", occurrence_logical_time: 5 },
    cause_refs: [...EVIDENCE],
    domain_deltas: [
      {
        producer: "relationship",
        domain: "relationship",
        expected_repository_revision: null,
        operations: [{ path: "/relationships", value: relationshipState(nextValue) }],
        provenance_refs: [...EVIDENCE]
      }
    ],
    external_refs: [RECEIPT]
  } as unknown as CanonicalTransitionProposalV1;
}

/** Builds a fully self-consistent V2 bundle carrying the governed authority. */
async function buildGovernedV2Bundle(
  payloadOverrides?: Partial<Record<string, unknown>>
): Promise<{ bundle: AtomicCommitBundleV2; payload: Record<string, unknown> }> {
  const payload = governedPayloadFixture(payloadOverrides);
  const currentState = baseState(relationshipState(0.4), 0, 0, []);
  const stateHashBefore = await stateHash(currentState);
  const proposal = governedProposal(0.6);
  const proposalRefValue = await proposalRef(proposal);
  const payloadFingerprint = await proposalFingerprint(proposal);
  const traceEntry = {
    trace_schema_version: "trace-v1",
    trace_id: "trace:v2-fixture-000001",
    history_sequence: 1,
    transition_id: proposal.transition_id,
    transition_type: proposal.transition_type,
    subject_id: proposal.subject_id,
    subject_revision_before: 0,
    subject_revision_after: 1,
    logical_time: 5,
    rule_ids: [...TRACE_RULE_IDS],
    cause_refs: [...EVIDENCE],
    proposal_ref: proposalRefValue,
    domain_mutations: [
      {
        producer: "relationship",
        domain: "relationship",
        layers: ["relationships"],
        field_changes: [{ path: "/relationships", operation: "SET" }]
      }
    ],
    state_hash_before: stateHashBefore,
    state_hash_after: HASH,
    memory_revision_before: "R0",
    memory_revision_after: "R0",
    outcome: "COMMITTED"
  };
  // StateHash excludes trace_window: embed the entry, then bind its
  // state_hash_after to the hash of the state containing it.
  const candidate = baseState(relationshipState(0.6), 1, 5, [traceEntry]);
  const stateHashAfter = await stateHash(candidate);
  const finalTraceEntry = { ...traceEntry, state_hash_after: stateHashAfter };
  const finalCandidate = baseState(relationshipState(0.6), 1, 5, [finalTraceEntry]);
  const traceWindow = finalCandidate.trace_window;
  const snapshotHashBefore = await snapshotHash({
    state_hash: stateHashBefore,
    subject_id: "subject-s0",
    state_revision: 0,
    trace_cursor: currentState.trace_window.cursor,
    last_trace_ref: null
  });
  const snapshotHashAfter = await snapshotHash({
    state_hash: stateHashAfter,
    subject_id: "subject-s0",
    state_revision: 1,
    trace_cursor: finalCandidate.trace_window.cursor,
    last_trace_ref: lastTraceRef(finalCandidate.trace_window)
  });

  const authorityBody = {
    schema_version: "canonical-writer-authority-record-v0" as const,
    proposal_ref: proposalRefValue,
    payload_fingerprint: payloadFingerprint,
    writer_family: "RELATIONSHIP_GOVERNED_FEATURE" as const,
    writer_class: "UPDATE" as const,
    writer_schema_id: "relationship-governed-feature-writer-authority-payload-v0",
    writer_schema_fingerprint: HASH,
    authorization_gate_id: "test-gate-v0",
    authorization_gate_fingerprint: HASH,
    authority_payload: payload
  };
  const authorityPayloadHash = await deriveWriterAuthorityPayloadHashV0(authorityBody as never);
  const writerAuthority = { ...authorityBody, authority_payload_hash: authorityPayloadHash };

  const commitRef = await deriveAtomicCommitRefV2({
    commit_version: "atomic-commit-v2",
    serialization_version: "canonical-json-v1",
    proposal_ref: proposalRefValue,
    payload_fingerprint: payloadFingerprint,
    subject_id: "subject-s0",
    transition_id: proposal.transition_id,
    transition_type: proposal.transition_type,
    expected_revision: 0,
    next_revision: 1,
    previous_commit_ref: null,
    previous_record_checksum: null,
    state_hash_before: stateHashBefore,
    state_hash_after: stateHashAfter,
    snapshot_hash_before: snapshotHashBefore,
    snapshot_hash_after: snapshotHashAfter,
    trace_ref: traceEntry.trace_id,
    writer_authority_payload_hash: authorityPayloadHash
  } as never);
  const resultBody = {
    schema_version: "canonical-commit-result-v1" as const,
    status: "COMMITTED" as const,
    transition_id: proposal.transition_id,
    subject_id: proposal.subject_id,
    payload_fingerprint: payloadFingerprint,
    previous_revision: 0,
    next_revision: 1,
    state_hash_before: stateHashBefore,
    state_hash_after: stateHashAfter,
    snapshot_hash_after: snapshotHashAfter,
    trace_ref: traceEntry.trace_id,
    commit_ref: commitRef
  };
  const canonicalResult = {
    ...resultBody,
    result_ref: (await deriveRef("result", RESULT_ID_PROJECTION_V1, resultBody)) as never
  };
  const committedAttempt = {
    attempt_sequence: 1,
    status: "COMMITTED",
    revision_before: 0,
    revision_after: 1,
    state_hash_before: stateHashBefore,
    state_hash_after: stateHashAfter,
    result_ref: canonicalResult.result_ref,
    prepared_result_ref: "workflow:w-v2-fixture-001",
    trace_ref: traceEntry.trace_id,
    audit_ref: null,
    error_code: null,
    reason: null
  };
  const transitionRecord = {
    schema_version: "transition-record-v1",
    record_version: 1,
    transition_id: proposal.transition_id,
    subject_id: proposal.subject_id,
    transition_type: proposal.transition_type,
    proposal_ref: proposalRefValue,
    payload_fingerprint: payloadFingerprint,
    fingerprint_version: "proposal-fingerprint-v1",
    first_seen_sequence: 1,
    attempts: [committedAttempt],
    reuse_conflicts: [],
    terminal_status: "COMMITTED",
    terminal_result_ref: canonicalResult.result_ref
  };
  const partial = {
    commit_version: "atomic-commit-v2" as const,
    serialization_version: "canonical-json-v1" as const,
    canonical_proposal: proposal,
    writer_authority: writerAuthority as unknown as CanonicalWriterAuthorityRecordV0,
    commit_ref: commitRef,
    subject_id: "subject-s0",
    transition_id: proposal.transition_id,
    transition_type: proposal.transition_type,
    payload_fingerprint: payloadFingerprint,
    prepared_result_ref: "workflow:w-v2-fixture-001",
    expected_revision: 0,
    next_revision: 1,
    identity_record_version_before: 0,
    previous_commit_ref: null,
    previous_record_checksum: null,
    next_snapshot: finalCandidate,
    logical_time_before: 0,
    logical_time_after: 5,
    state_hash_before: stateHashBefore,
    state_hash_after: stateHashAfter,
    snapshot_hash_before: snapshotHashBefore,
    snapshot_hash_after: snapshotHashAfter,
    trace_entry: finalTraceEntry,
    trace_window: traceWindow,
    mutation_history_link: {
      history_sequence: 1,
      previous_trace_ref: null,
      current_trace_ref: traceEntry.trace_id
    },
    transition_record: transitionRecord,
    canonical_result: canonicalResult,
    repository_revision_bindings: []
  };
  const bundle = {
    ...partial,
    record_checksum: await deriveAtomicCommitRecordChecksumV2(partial as never)
  } as unknown as AtomicCommitBundleV2;
  return { bundle, payload };
}

async function expectPayloadRejection(value: unknown, detailPattern: RegExp): Promise<void> {
  const result = validateRelationshipGovernedFeatureWriterAuthorityPayloadV0(value);
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.error.detail).toMatch(detailPattern);
  }
}

// ---- §34 payload contract -----------------------------------------------------------

describe("Relationship governed writer authority payload contract", () => {
  describe("§34 closed payload shape", () => {
    it("validates the exact 17-field payload for all three operation kinds", () => {
      expect(Object.keys(governedPayloadFixture())).toHaveLength(17);
      expect(
        validateRelationshipGovernedFeatureWriterAuthorityPayloadV0(governedPayloadFixture()).ok
      ).toBe(true);
      expect(
        validateRelationshipGovernedFeatureWriterAuthorityPayloadV0(
          governedPayloadFixture({
            operation_kind: "INITIALIZE",
            previous: { kind: "ABSENT" }
          })
        ).ok
      ).toBe(true);
      expect(
        validateRelationshipGovernedFeatureWriterAuthorityPayloadV0(
          governedPayloadFixture({ operation_kind: "REINITIALIZE", next: { kind: "PRESENT", value: 0.4 } })
        ).ok
      ).toBe(true);
    });

    it("requires a reserved relationship_core_* dimension and rejects ordinary opaque ids", () => {
      expectPayloadRejection(
        governedPayloadFixture({ dimension_id: OPAQUE_ID }),
        /reserved relationship_core_\* dimension/
      );
    });

    it("requires nonempty, unique, raw-sorted evidence refs", () => {
      expectPayloadRejection(
        governedPayloadFixture({ evidence_receipt_refs: [] }),
        /nonempty array required/
      );
      expectPayloadRejection(
        governedPayloadFixture({ evidence_receipt_refs: ["episode:ep-01", "episode:ep-01"] }),
        /duplicate/
      );
      expectPayloadRejection(
        governedPayloadFixture({ evidence_receipt_refs: ["episode:ep-02", "episode:ep-01"] }),
        /not raw-ASCII-sorted/
      );
    });

    it("enforces the operation × previous cross-rules", () => {
      expectPayloadRejection(
        governedPayloadFixture({ operation_kind: "UPDATE", previous: { kind: "ABSENT" } }),
        /UPDATE requires previous\.kind PRESENT/
      );
      expectPayloadRejection(
        governedPayloadFixture({ operation_kind: "REINITIALIZE", previous: { kind: "ABSENT" } }),
        /REINITIALIZE requires previous\.kind PRESENT/
      );
      expectPayloadRejection(
        governedPayloadFixture({ operation_kind: "INITIALIZE", previous: { kind: "PRESENT", value: 0.4 } }),
        /INITIALIZE requires previous\.kind ABSENT/
      );
    });

    it("makes removal impossible by schema and rejects malformed unions, keys and values", () => {
      expectPayloadRejection(
        governedPayloadFixture({ next: { kind: "ABSENT" } }),
        /removal is unsupported/
      );
      expectPayloadRejection(
        governedPayloadFixture({ next: { kind: "PRESENT", value: 1.5 } }),
        /payload\.next\.value/
      );
      expectPayloadRejection(
        governedPayloadFixture({ previous: { kind: "PRESENT", value: Number.NaN } }),
        /payload\.previous\.value/
      );
      expectPayloadRejection(
        governedPayloadFixture({ extra_field: 1 }),
        /payload\.extra_field: unknown key/
      );
      const missing = { ...governedPayloadFixture() } as Record<string, unknown>;
      delete missing["write_policy_id"];
      expectPayloadRejection(missing, /payload\.write_policy_id: missing key/);
      expectPayloadRejection(
        governedPayloadFixture({ write_policy_fingerprint: "deadbeef" }),
        /payload\.write_policy_fingerprint/
      );
    });
  });

  // ---- §23 single-record cross-binding over a full V2 fixture -----------------------

  describe("§23 governed authority cross-binding (single-record)", () => {
    it("produces a structurally valid V2 bundle whose binding validates", async () => {
      const { bundle, payload } = await buildGovernedV2Bundle();
      const structural = await validateAtomicCommitBundleV2(bundle);
      if (!structural.ok) {
        console.log("PROBE_STRUCT=" + structural.error.reason + " " + structural.error.detail);
      }
      expect(structural.ok).toBe(true);
      const binding = validateRelationshipGovernedFeatureAuthorityBindingV0({
        bundle,
        authority_payload: payload
      });
      expect(binding.ok).toBe(true);
    });

    it("fails closed when writer_class and payload.operation_kind disagree", async () => {
      const { bundle, payload } = await buildGovernedV2Bundle();
      const mismatched = {
        ...bundle,
        writer_authority: {
          ...(bundle.writer_authority as unknown as Record<string, unknown>),
          writer_class: "INITIALIZE"
        }
      } as AtomicCommitBundleV2;
      const binding = validateRelationshipGovernedFeatureAuthorityBindingV0({
        bundle: mismatched,
        authority_payload: payload
      });
      expect(binding.ok).toBe(false);
    });

    it("fails closed when proposal cause refs, delta provenance or external refs diverge", async () => {
      const tamperedEvidence = await buildGovernedV2Bundle({
        evidence_receipt_refs: ["episode:ep-02"]
      });
      expect(
        validateRelationshipGovernedFeatureAuthorityBindingV0({
          bundle: tamperedEvidence.bundle,
          authority_payload: tamperedEvidence.payload
        }).ok
      ).toBe(false);

      const { bundle } = await buildGovernedV2Bundle();
      const tamperedExternal = {
        ...bundle,
        canonical_proposal: {
          ...bundle.canonical_proposal,
          external_refs: ["workflow:w-other-receipt-001"]
        }
      } as unknown as AtomicCommitBundleV2;
      const payload = governedPayloadFixture();
      expect(
        validateRelationshipGovernedFeatureAuthorityBindingV0({
          bundle: tamperedExternal,
          authority_payload: payload
        }).ok
      ).toBe(false);
    });

    it("fails closed when the canonical replacement value diverges from payload.next", async () => {
      const { bundle, payload } = await buildGovernedV2Bundle();
      const tamperedNext = await buildGovernedV2Bundle({ next: { kind: "PRESENT", value: 0.9 } });
      void tamperedNext;
      const binding = validateRelationshipGovernedFeatureAuthorityBindingV0({
        bundle,
        authority_payload: { ...payload, next: { kind: "PRESENT", value: 0.9 } }
      });
      expect(binding.ok).toBe(false);
    });
  });

  // ---- §39 no downstream authority + frozen registry boundary ------------------------

  describe("§39 no downstream authority", () => {
    it("mints no capability and registers no feature", () => {
      const surface = Object.keys(payloadModule).sort();
      const forbidden = /(AcceptRelationship|AcceptedRelationship|Admitted|Capability|Provenance|register)/i;
      expect(surface.filter((name) => forbidden.test(name))).toStrictEqual([]);
      expect(REGISTERED_RELATIONSHIP_DECISION_FEATURE_IDS_V0).toHaveLength(0);
    });

    it("exposes exactly the approved contract surface", () => {
      expect(Object.keys(payloadModule).sort()).toStrictEqual(
        [
          "RELATIONSHIP_GOVERNED_FEATURE_WRITER_AUTHORITY_PAYLOAD_PROJECTION",
          "RELATIONSHIP_GOVERNED_FEATURE_WRITER_AUTHORITY_PAYLOAD_SCHEMA_VERSION",
          "RELATIONSHIP_GOVERNED_WRITER_OPERATION_KINDS_V0",
          "deriveRelationshipGovernedFeatureWriterAuthorityPayloadFingerprintV0",
          "validateRelationshipGovernedFeatureAuthorityBindingV0",
          "validateRelationshipGovernedFeatureWriterAuthorityPayloadV0"
        ].sort()
      );
    });
  });
});
