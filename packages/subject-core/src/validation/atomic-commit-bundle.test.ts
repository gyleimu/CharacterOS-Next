/**
 * AtomicCommitBundle closed validators — acceptance suite
 * (ATOMIC_COMMIT_BUNDLE_V2_AUTHORITY_SCHEMA_FOUNDATION, §30-§37):
 * V1 preservation (existing frozen projection vectors), V2 top-level 29-key
 * contract, canonical-proposal recomputation, generic 11-field
 * writer-authority envelope, ordinary null-authority bundles, version
 * dispatch, and the pure version-step policy primitive.
 *
 * The fixture builds a REAL V1 bundle through the frozen assembler
 * (assembleCommitBundle) and then lifts it to V2 by adding the persisted
 * canonical proposal + recomputing the V2 commit ref / record checksum —
 * proving the V2 projections bind the same record content deterministically.
 *
 * Fully OFFLINE: pure deterministic functions only.
 */

import { beforeAll, describe, expect, it } from "vitest";

import { deriveRef } from "../canonical/hash.js";
import {
  assembleCommitBundle,
  type AssembleBundleInput
} from "../commit/bundle.js";
import { proposalFingerprint, proposalRef, snapshotHash, stateHash } from "../canonical/projections.js";
import {
  deriveAtomicCommitRecordChecksumV2,
  deriveAtomicCommitRefV2,
  deriveWriterAuthorityPayloadHashV0
} from "../canonical/writer-authority-projections.js";
import type { AtomicCommitBundleV1 } from "../types/persistence.js";
import type { AtomicCommitBundleV2 } from "../types/persistence-v2.js";
import type { CanonicalWriterAuthorityRecordV0 } from "../types/writer-authority.js";
import type { CanonicalTransitionProposalV1 } from "../types/transition.js";
import type { SubjectStateV0 } from "../types/subject-state.js";
import { lastTraceRef, TRACE_RULE_IDS } from "../trace/trace.js";
import {
  evaluateCommitBundleVersionStepV0,
  validateAtomicCommitBundleAnyVersion,
  validateAtomicCommitBundleV1,
  validateAtomicCommitBundleV2
} from "./atomic-commit-bundle.js";

// ---- deterministic fixtures ---------------------------------------------------------

const HASH_PLACEHOLDER = "sha256:1111111111111111111111111111111111111111111111111111111111111111";

function baseState(stateRevision: number, logicalTime: number, traceEntries: readonly unknown[]): SubjectStateV0 {
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

function baseProposal(): CanonicalTransitionProposalV1 {
  return {
    schema_version: "canonical-transition-proposal-v1",
    transition_id: "t-v2-fixture-001",
    subject_id: "subject-s0",
    transition_type: "Relationship",
    expected_state_revision: 0,
    time_input: { kind: "OCCURRENCE", occurrence_logical_time: 5 },
    cause_refs: [],
    domain_deltas: [
      {
        producer: "relationship",
        domain: "relationship",
        expected_repository_revision: null,
        operations: [
          {
            path: "/relationships",
            value: { schema_version: "relationship-state-v0", counterparts: [] }
          }
        ],
        provenance_refs: []
      }
    ],
    external_refs: []
  } as unknown as CanonicalTransitionProposalV1;
}

async function buildTraceEntry(
  proposal: CanonicalTransitionProposalV1,
  stateHashBefore: string,
  stateHashAfter: string
) {
  return {
    trace_schema_version: "trace-v1",
    trace_id: "trace:v2-fixture-000001",
    history_sequence: 1,
    transition_id: proposal.transition_id,
    transition_type: proposal.transition_type,
    subject_id: proposal.subject_id,
    subject_revision_before: proposal.expected_state_revision,
    subject_revision_after: 1,
    logical_time: 5,
    rule_ids: [...TRACE_RULE_IDS],
    cause_refs: [],
    proposal_ref: await proposalRef(proposal),
    domain_mutations: [
      {
        producer: "relationship",
        domain: "relationship",
        layers: ["relationships"],
        field_changes: [{ path: "/relationships", operation: "SET" }]
      }
    ],
    state_hash_before: stateHashBefore,
    state_hash_after: stateHashAfter,
    memory_revision_before: "R0",
    memory_revision_after: "R0",
    outcome: "COMMITTED"
  };
}

async function buildV1Bundle(): Promise<{ v1: AtomicCommitBundleV1; proposal: CanonicalTransitionProposalV1 }> {
  const proposal = baseProposal();
  const currentState = baseState(0, 0, []);
  const stateHashBefore = await stateHash(currentState);
  // StateHash excludes trace_window, so the trace entry's state_hash_after can
  // be computed over the candidate containing the entry without circularity.
  const traceEntry = await buildTraceEntry(proposal, stateHashBefore, HASH_PLACEHOLDER);
  const candidate = baseState(1, 5, [traceEntry]);
  const stateHashAfter = await stateHash(candidate);
  const finalTraceEntry = { ...traceEntry, state_hash_after: stateHashAfter };
  const finalCandidate = baseState(1, 5, [finalTraceEntry]);
  const finalStateHashAfter = await stateHash(finalCandidate);
  expect(finalStateHashAfter).toBe(stateHashAfter);
  const snapshotHashBefore = await snapshotHash({
    state_hash: stateHashBefore,
    subject_id: "subject-s0",
    state_revision: 0,
    trace_cursor: currentState.trace_window.cursor,
    last_trace_ref: null
  });
  const snapshotHashAfter = await snapshotHash({
    state_hash: finalStateHashAfter,
    subject_id: "subject-s0",
    state_revision: 1,
    trace_cursor: finalCandidate.trace_window.cursor,
    last_trace_ref: lastTraceRef(finalCandidate.trace_window)
  });
  const input = {
    proposal,
    currentState,
    candidate: finalCandidate,
    state_hash_before: stateHashBefore,
    state_hash_after: finalStateHashAfter,
    snapshot_hash_before: snapshotHashBefore,
    snapshot_hash_after: snapshotHashAfter,
    trace_entry: finalTraceEntry,
    expected_revision: 0,
    next_revision: 1,
    identity_record_version_before: 0,
    first_seen_sequence: 1,
    prior_attempts: [],
    previous_commit_ref: null,
    previous_record_checksum: null,
    prepared_result_ref: "workflow:w-v2-fixture-001",
    repository_revision_bindings: []
  } as unknown as AssembleBundleInput;
  const v1 = await assembleCommitBundle(input);
  return { v1, proposal };
}

async function liftToV2(
  v1: AtomicCommitBundleV1,
  proposal: CanonicalTransitionProposalV1,
  writerAuthorityBody: Record<string, unknown> | null
): Promise<AtomicCommitBundleV2> {
  const proposalRefValue = await proposalRef(proposal);
  const payloadFingerprint = await proposalFingerprint(proposal);
  let writerAuthority: Record<string, unknown> | null = null;
  let writerAuthorityPayloadHash: string | null = null;
  if (writerAuthorityBody !== null) {
    writerAuthorityPayloadHash = await deriveWriterAuthorityPayloadHashV0(
      writerAuthorityBody as unknown as Omit<CanonicalWriterAuthorityRecordV0, "authority_payload_hash">
    );
    writerAuthority = { ...writerAuthorityBody, authority_payload_hash: writerAuthorityPayloadHash };
  }
  const commitRef = await deriveAtomicCommitRefV2({
    commit_version: "atomic-commit-v2",
    serialization_version: "canonical-json-v1",
    proposal_ref: proposalRefValue,
    payload_fingerprint: payloadFingerprint,
    subject_id: v1.subject_id,
    transition_id: v1.transition_id,
    transition_type: v1.transition_type,
    expected_revision: v1.expected_revision,
    next_revision: v1.next_revision,
    previous_commit_ref: v1.previous_commit_ref,
    previous_record_checksum: v1.previous_record_checksum,
    state_hash_before: v1.state_hash_before,
    state_hash_after: v1.state_hash_after,
    snapshot_hash_before: v1.snapshot_hash_before,
    snapshot_hash_after: v1.snapshot_hash_after,
    trace_ref: v1.trace_entry.trace_id,
    writer_authority_payload_hash: writerAuthorityPayloadHash
  } as unknown as Parameters<typeof deriveAtomicCommitRefV2>[0]);
  // The V2 record rebinds the canonical result and transition record to the
  // V2 commit ref (same frozen result-id projection, new commit_ref input).
  const resultBody = {
    schema_version: "canonical-commit-result-v1" as const,
    status: "COMMITTED" as const,
    transition_id: v1.canonical_result.transition_id,
    subject_id: v1.canonical_result.subject_id,
    payload_fingerprint: payloadFingerprint,
    previous_revision: v1.canonical_result.previous_revision,
    next_revision: v1.canonical_result.next_revision,
    state_hash_before: v1.canonical_result.state_hash_before,
    state_hash_after: v1.canonical_result.state_hash_after,
    snapshot_hash_after: v1.canonical_result.snapshot_hash_after,
    trace_ref: v1.canonical_result.trace_ref,
    commit_ref: commitRef
  };
  const canonicalResult = {
    ...resultBody,
    result_ref: (await deriveRef("result", "characteros-next/subject-core/result-id/v1", resultBody)) as never
  };
  const attempts = v1.transition_record.attempts.map((attempt, index) =>
    index === v1.transition_record.attempts.length - 1
      ? { ...attempt, result_ref: canonicalResult.result_ref }
      : attempt
  );
  const transitionRecord = {
    ...v1.transition_record,
    proposal_ref: proposalRefValue,
    payload_fingerprint: payloadFingerprint,
    attempts,
    terminal_result_ref: canonicalResult.result_ref
  };
  const partial = {
    commit_version: "atomic-commit-v2" as const,
    serialization_version: "canonical-json-v1" as const,
    canonical_proposal: proposal,
    writer_authority: writerAuthority,
    commit_ref: commitRef,
    subject_id: v1.subject_id,
    transition_id: v1.transition_id,
    transition_type: v1.transition_type,
    payload_fingerprint: payloadFingerprint,
    prepared_result_ref: v1.prepared_result_ref,
    expected_revision: v1.expected_revision,
    next_revision: v1.next_revision,
    identity_record_version_before: v1.identity_record_version_before,
    previous_commit_ref: v1.previous_commit_ref,
    previous_record_checksum: v1.previous_record_checksum,
    next_snapshot: v1.next_snapshot,
    logical_time_before: v1.logical_time_before,
    logical_time_after: v1.logical_time_after,
    state_hash_before: v1.state_hash_before,
    state_hash_after: v1.state_hash_after,
    snapshot_hash_before: v1.snapshot_hash_before,
    snapshot_hash_after: v1.snapshot_hash_after,
    trace_entry: v1.trace_entry,
    trace_window: v1.trace_window,
    mutation_history_link: v1.mutation_history_link,
    transition_record: transitionRecord,
    canonical_result: canonicalResult,
    repository_revision_bindings: v1.repository_revision_bindings
  };
  return {
    ...partial,
    record_checksum: await deriveAtomicCommitRecordChecksumV2(partial as never)
  } as unknown as AtomicCommitBundleV2;
}

function authorityBody(proposalRefValue: string, payloadFingerprint: string): Record<string, unknown> {
  return {
    schema_version: "canonical-writer-authority-record-v0" as const,
    proposal_ref: proposalRefValue,
    payload_fingerprint: payloadFingerprint,
    writer_family: "RELATIONSHIP_GOVERNED_FEATURE" as const,
    writer_class: "UPDATE" as const,
    writer_schema_id: "relationship-governed-feature-writer-authority-payload-v0" as const,
    writer_schema_fingerprint: HASH_PLACEHOLDER,
    authorization_gate_id: "test-gate-v0" as const,
    authorization_gate_fingerprint: HASH_PLACEHOLDER,
    authority_payload: { operation_kind: "UPDATE", marker: "fixture" }
  };
}

// ---- §30 V1 preservation ------------------------------------------------------------

describe("AtomicCommitBundle closed validators", () => {
  let fixture: { v1: AtomicCommitBundleV1; proposal: CanonicalTransitionProposalV1 };

  beforeAll(async () => {
    fixture = await buildV1Bundle();
  });

  describe("§30 V1 preservation", () => {
    it("validates a REAL V1 bundle assembled by the frozen assembler", async () => {
      const result = await validateAtomicCommitBundleV1(fixture.v1);
      if (!result.ok) console.log("PROBE_ERR=" + result.error.reason + " " + result.error.detail);
      expect(result.ok).toBe(true);
    });

    it("keeps the exact frozen 27-key V1 field set", async () => {
      const result = await validateAtomicCommitBundleV1(fixture.v1);
      expect(result.ok).toBe(true);
      expect(Object.keys(fixture.v1)).toHaveLength(27);
    });

    it("keeps the frozen V1 commit-ref, record-checksum and proposal-fingerprint vectors", async () => {
      const { v1, proposal } = fixture;
      expect(v1.payload_fingerprint).toBe(await proposalFingerprint(proposal));
      expect(v1.transition_record.proposal_ref).toBe(await proposalRef(proposal));
      const result = await validateAtomicCommitBundleV1(v1);
      expect(result.ok).toBe(true);
    });

    it("rejects a V1 bundle carrying canonical_proposal or writer_authority as extra fields", async () => {
      const withProposal = { ...fixture.v1, canonical_proposal: fixture.proposal };
      const result = await validateAtomicCommitBundleV1(withProposal);
      expect(result.ok).toBe(false);
      const withAuthority = { ...fixture.v1, writer_authority: null };
      const result2 = await validateAtomicCommitBundleV1(withAuthority);
      expect(result2.ok).toBe(false);
    });

    it("rejects a tampered V1 record (payload mutation breaks the frozen checksum)", async () => {
      const tampered = {
        ...fixture.v1,
        next_snapshot: {
          ...fixture.v1.next_snapshot,
          runtime_metadata: {
            ...fixture.v1.next_snapshot.runtime_metadata,
            logical_time: 999
          }
        }
      };
      const result = await validateAtomicCommitBundleV1(tampered);
      expect(result.ok).toBe(false);
    });
  });

  // ---- §31/§35 V2 top-level + ordinary null authority -------------------------------

  describe("§31/§35 V2 top-level contract", () => {
    it("validates an ordinary V2 bundle with writer_authority null at stage 1", async () => {
      const v2 = await liftToV2(fixture.v1, fixture.proposal, null);
      const result = await validateAtomicCommitBundleV2(v2);
      expect(result.ok).toBe(true);
      expect(Object.keys(v2)).toHaveLength(29);
    });

    it("requires the exact 29-key set: extra field rejected", async () => {
      const v2 = await liftToV2(fixture.v1, fixture.proposal, null);
      const extra = { ...v2, extra_field: 1 };
      const result = await validateAtomicCommitBundleV2(extra);
      expect(result.ok).toBe(false);
    });

    it("requires exact commit_version and serialization literals", async () => {
      const v2 = await liftToV2(fixture.v1, fixture.proposal, null);
      const wrongVersion = { ...v2, commit_version: "atomic-commit-v1" };
      expect((await validateAtomicCommitBundleV2(wrongVersion)).ok).toBe(false);
      const wrongSerialization = { ...v2, serialization_version: "canonical-json-v2" };
      expect((await validateAtomicCommitBundleV2(wrongSerialization)).ok).toBe(false);
    });

    it("requires the full canonical proposal for every V2 record", async () => {
      const v2 = await liftToV2(fixture.v1, fixture.proposal, null);
      const withoutProposal = { ...v2 } as Record<string, unknown>;
      delete withoutProposal["canonical_proposal"];
      expect((await validateAtomicCommitBundleV2(withoutProposal)).ok).toBe(false);
    });
  });

  // ---- §32 proposal recomputation ---------------------------------------------------

  describe("§32 canonical proposal recomputation", () => {
    it("rejects a mutated proposal unless dependent projections are consistently changed", async () => {
      const v2 = await liftToV2(fixture.v1, fixture.proposal, null);
      const mutated = {
        ...v2,
        canonical_proposal: {
          ...v2.canonical_proposal,
          subject_id: "subject-other"
        }
      };
      const result = await validateAtomicCommitBundleV2(mutated);
      expect(result.ok).toBe(false);
    });

    it("recomputes proposal_ref and payload_fingerprint from the persisted proposal with no hidden bytes", async () => {
      const { proposal } = fixture;
      const recomputedRef = await proposalRef(proposal);
      const recomputedFingerprint = await proposalFingerprint(proposal);
      expect(fixture.v1.transition_record.proposal_ref).toBe(recomputedRef);
      expect(fixture.v1.payload_fingerprint).toBe(recomputedFingerprint);
      const v2 = await liftToV2(fixture.v1, proposal, null);
      expect((await validateAtomicCommitBundleV2(v2)).ok).toBe(true);
    });
  });

  // ---- §33 authority envelope ---------------------------------------------------------

  describe("§33 writer-authority envelope", () => {
    it("validates a V2 bundle carrying a consistent 11-field authority record", async () => {
      const proposalRefValue = await proposalRef(fixture.proposal);
      const payloadFingerprint = await proposalFingerprint(fixture.proposal);
      const v2 = await liftToV2(
        fixture.v1,
        fixture.proposal,
        authorityBody(proposalRefValue, payloadFingerprint)
      );
      const result = await validateAtomicCommitBundleV2(v2);
      expect(result.ok).toBe(true);
      expect(Object.keys(v2.writer_authority as unknown as Record<string, unknown>)).toHaveLength(11);
    });

    it("rejects envelope mutations: wrong proposal ref, wrong payload fingerprint, malformed payload, wrong hash", async () => {
      const proposalRefValue = await proposalRef(fixture.proposal);
      const payloadFingerprint = await proposalFingerprint(fixture.proposal);
      const body = authorityBody(proposalRefValue, payloadFingerprint);

      const wrongRef = await liftToV2(fixture.v1, fixture.proposal, {
        ...body,
        proposal_ref: "proposal:0000000000000000000000000000000000000000000000000000000000000000"
      });
      expect((await validateAtomicCommitBundleV2(wrongRef)).ok).toBe(false);

      const wrongFingerprint = await liftToV2(fixture.v1, fixture.proposal, {
        ...body,
        payload_fingerprint: HASH_PLACEHOLDER
      });
      expect((await validateAtomicCommitBundleV2(wrongFingerprint)).ok).toBe(false);

      const consistentAuthority = await liftToV2(
        fixture.v1,
        fixture.proposal,
        authorityBody(proposalRefValue, payloadFingerprint)
      );
      expect((await validateAtomicCommitBundleV2(consistentAuthority)).ok).toBe(true);
      // Tamper the payload AFTER the record hash was computed: the recorded
      // authority_payload_hash no longer matches the frozen projection.
      const wrongHash = {
        ...consistentAuthority,
        writer_authority: {
          ...(consistentAuthority.writer_authority as unknown as Record<string, unknown>),
          authority_payload: { operation_kind: "UPDATE", marker: "tampered" }
        }
      };
      expect((await validateAtomicCommitBundleV2(wrongHash)).ok).toBe(false);

      const unknownFamily = await liftToV2(fixture.v1, fixture.proposal, {
        ...body,
        writer_family: "MEMORY_GOVERNED_FEATURE" as never
      });
      expect((await validateAtomicCommitBundleV2(unknownFamily)).ok).toBe(false);

      const invalidClass = await liftToV2(fixture.v1, fixture.proposal, {
        ...body,
        writer_class: "REMOVE" as never
      });
      expect((await validateAtomicCommitBundleV2(invalidClass)).ok).toBe(false);
    });

    it("structural success mints NO authority capability", async () => {
      const proposalRefValue = await proposalRef(fixture.proposal);
      const payloadFingerprint = await proposalFingerprint(fixture.proposal);
      const v2 = await liftToV2(
        fixture.v1,
        fixture.proposal,
        authorityBody(proposalRefValue, payloadFingerprint)
      );
      const result = await validateAtomicCommitBundleV2(v2);
      expect(result.ok).toBe(true);
      expect("capability" in (result as unknown as Record<string, unknown>)).toBe(false);
      expect("authorized" in (result as unknown as Record<string, unknown>)).toBe(false);
    });
  });

  // ---- §36/§37 dispatch + version step ------------------------------------------------

  describe("§36 version dispatch", () => {
    it("dispatches valid V1 and V2 bundles", async () => {
      expect((await validateAtomicCommitBundleAnyVersion(fixture.v1)).ok).toBe(true);
      const v2 = await liftToV2(fixture.v1, fixture.proposal, null);
      expect((await validateAtomicCommitBundleAnyVersion(v2)).ok).toBe(true);
    });

    it("fails closed on missing version, unknown version and non-objects", async () => {
      const missing = { ...fixture.v1 } as Record<string, unknown>;
      delete missing["commit_version"];
      expect((await validateAtomicCommitBundleAnyVersion(missing)).ok).toBe(false);
      const unknownVersion = { ...fixture.v1, commit_version: "atomic-commit-v3" };
      expect((await validateAtomicCommitBundleAnyVersion(unknownVersion)).ok).toBe(false);
      for (const input of [null, 42, "bundle", []]) {
        expect((await validateAtomicCommitBundleAnyVersion(input)).ok).toBe(false);
      }
    });
  });

  describe("§37 version-step policy", () => {
    it("allows V1→V1, V1→V2, V2→V2 and forbids V2→V1 with no chain inspection", () => {
      expect(evaluateCommitBundleVersionStepV0("atomic-commit-v1", "atomic-commit-v1")).toBe("ALLOWED");
      expect(evaluateCommitBundleVersionStepV0("atomic-commit-v1", "atomic-commit-v2")).toBe("ALLOWED");
      expect(evaluateCommitBundleVersionStepV0("atomic-commit-v2", "atomic-commit-v2")).toBe("ALLOWED");
      expect(evaluateCommitBundleVersionStepV0("atomic-commit-v2", "atomic-commit-v1")).toBe(
        "DOWNGRADE_FORBIDDEN"
      );
    });
  });
});
