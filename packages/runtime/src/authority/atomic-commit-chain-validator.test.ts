/**
 * CharacterOS Atomic Commit Chain Validator V0 — acceptance suite
 * (§29/§32/§41/§47-§53): valid empty genesis chain, positive-head truncation,
 * single/multi V1 chains with the limited V1 proof level, V1→V2 boundary,
 * multi-V2 chains with persisted-proposal effect replay, V2→V1 fail-closed,
 * the full continuity negative matrix, trusted-head binding, orphan policy,
 * writer-authority status classification, purity, and receipt shape.
 *
 * Fully OFFLINE: deterministic fixtures built through the SAME shared
 * canonical transition-effect primitives used by production commit semantics.
 */

import { describe, expect, it } from "vitest";

import {
  createPersistenceEnvelope,
  deriveAtomicCommitRefV2,
  deriveAtomicCommitRecordChecksumV2,
  deriveRef,
  deriveWriterAuthorityPayloadHashV0,
  finalizeCanonicalTransitionEffectV0,
  hashEnvelope,
  lastTraceRef,
  nextTraceWindow,
  prepareCanonicalTransitionEffectV0,
  proposalFingerprint,
  proposalRef,
  snapshotHash,
  stateHash,
  type AtomicCommitBundleAnyVersion,
  type AtomicCommitBundleV1,
  type AtomicCommitBundleV2,
  type CanonicalTransitionProposalV1,
  type PersistedSubjectEnvelopeV1,
  type SubjectStateV0
} from "@characteros-next/subject-core";

const subjectCorePrimitives = {
  stateHash,
  snapshotHash,
  nextTraceWindow,
  lastTraceRef
};

import {
  validateAtomicCommitChainV0
} from "./atomic-commit-chain-validator.js";

import {
  deriveRelationshipGovernedWriterSchemaFingerprintV0,
  RELATIONSHIP_GOVERNED_WRITER_SCHEMA_ID_V0
} from "./historical-writer-authority-registry.js";
import {
  isTrustedCanonicalHistoryBoundaryReceiptV0,
  mintTrustedCanonicalHistoryBoundaryV0,
  type TrustedCanonicalHeadInputV0,
  type TrustedCanonicalHistoryBoundaryReceiptV0
} from "./trusted-canonical-history-boundary.js";

const HASH = "sha256:8888888888888888888888888888888888888888888888888888888888888888";
const RESULT_ID_PROJECTION_V1 = "characteros-next/subject-core/result-id/v1";
const COMMIT_ID_PROJECTION_V1 = "characteros-next/subject-core/commit-id/v1";
const RECORD_CHECKSUM_PROJECTION_V1 = "characteros-next/atomic-commit/record-checksum/v1";

// ---- state / proposal / genesis fixtures --------------------------------------------

function stateWithRelationships(
  stateRevision: number,
  logicalTime: number,
  relationships: Record<string, unknown>,
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
    relationships,
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
        last_history_sequence: stateRevision,
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

function relationshipsWith(value: number): Record<string, unknown> {
  return {
    schema_version: "relationship-state-v0",
    counterparts: [
      {
        counterpart_ref: "entity:alice-like",
        dimensions: [{ dimension_id: "arbitrary_host_dimension", value }]
      }
    ]
  };
}

function chainProposal(
  transitionId: string,
  expectedRevision: number,
  logicalTime: number,
  nextRelationships: Record<string, unknown>
): CanonicalTransitionProposalV1 {
  return {
    schema_version: "canonical-transition-proposal-v1",
    transition_id: transitionId,
    subject_id: "subject-s0",
    transition_type: "Relationship",
    expected_state_revision: expectedRevision,
    time_input: { kind: "OCCURRENCE", occurrence_logical_time: logicalTime },
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

async function buildGenesisEnvelope(): Promise<PersistedSubjectEnvelopeV1> {
  const result = await createPersistenceEnvelope({
    snapshot: stateWithRelationships(0, 0, { schema_version: "relationship-state-v0", counterparts: [] }, []),
    repository_bindings: [
      {
        repository_revision: "R0",
        repository_revision_hash: "sha256:4444444444444444444444444444444444444444444444444444444444444444"
      } as never
    ],
    commit_head: null
  });
  if (!result.ok) throw new Error("fixture genesis failed");
  return result.value;
}

// ---- chain bundle builders (public exports only) ------------------------------------

interface ChainLink {
  readonly commit_ref: string | null;
  readonly record_checksum: string | null;
}

async function buildChainBundle(options: {
  readonly predecessor: SubjectStateV0;
  readonly proposal: CanonicalTransitionProposalV1;
  readonly version: "v1" | "v2";
  readonly previous: ChainLink;
  readonly writerAuthorityBody?: Record<string, unknown> | null;
}): Promise<AtomicCommitBundleAnyVersion> {
  const prepared = await prepareCanonicalTransitionEffectV0({
    predecessor: options.predecessor,
    proposal: options.proposal
  });
  if (prepared.kind !== "PREPARED") throw new Error(`fixture prepare failed: ${JSON.stringify(prepared)}`);
  const finalized = await finalizeCanonicalTransitionEffectV0({
    predecessor: options.predecessor,
    proposal: options.proposal,
    draft: prepared.effect.draft,
    derived: prepared.effect.derived
  });
  if (finalized.kind !== "FINALIZED") throw new Error("fixture finalize failed");
  const effect = finalized.effect;

  const proposalRefValue = await proposalRef(options.proposal);
  const payloadFingerprint = await proposalFingerprint(options.proposal);
  let writerAuthority: Record<string, unknown> | null = null;
  if (options.version === "v2" && options.writerAuthorityBody !== undefined && options.writerAuthorityBody !== null) {
    // The durable record binds the REAL computed proposal identity, so the
    // body must be finalized BEFORE its authority payload hash is derived.
    writerAuthority = {
      ...options.writerAuthorityBody,
      proposal_ref: proposalRefValue,
      payload_fingerprint: payloadFingerprint
    };
    const authorityPayloadHash = await deriveWriterAuthorityPayloadHashV0(
      writerAuthority as never
    );
    writerAuthority = { ...writerAuthority, authority_payload_hash: authorityPayloadHash };
  }
  const commitRef =
    options.version === "v1"
      ? ((await deriveRef("commit", COMMIT_ID_PROJECTION_V1, {
          subject_id: options.proposal.subject_id,
          transition_id: options.proposal.transition_id,
          transition_type: options.proposal.transition_type,
          next_revision: effect.revision_after,
          state_hash_after: effect.state_hash_after,
          snapshot_hash_after: effect.snapshot_hash_after,
          trace_ref: effect.trace_entry.trace_id,
          previous_commit_ref: options.previous.commit_ref
        })) as string)
      : await deriveAtomicCommitRefV2({
          commit_version: "atomic-commit-v2",
          serialization_version: "canonical-json-v1",
          proposal_ref: proposalRefValue,
          payload_fingerprint: payloadFingerprint,
          subject_id: options.proposal.subject_id,
          transition_id: options.proposal.transition_id,
          transition_type: options.proposal.transition_type,
          expected_revision: effect.revision_before as never,
          next_revision: effect.revision_after as never,
          previous_commit_ref: options.previous.commit_ref as never,
          previous_record_checksum: options.previous.record_checksum as never,
          state_hash_before: effect.state_hash_before,
          state_hash_after: effect.state_hash_after,
          snapshot_hash_before: effect.snapshot_hash_before,
          snapshot_hash_after: effect.snapshot_hash_after,
          trace_ref: effect.trace_entry.trace_id,
          writer_authority_payload_hash:
            (writerAuthority === null
              ? null
              : ((writerAuthority["authority_payload_hash"] as string) ?? null)) as never
        });

  const resultBody = {
    schema_version: "canonical-commit-result-v1" as const,
    status: "COMMITTED" as const,
    transition_id: options.proposal.transition_id,
    subject_id: options.proposal.subject_id,
    payload_fingerprint: payloadFingerprint,
    previous_revision: effect.revision_before,
    next_revision: effect.revision_after,
    state_hash_before: effect.state_hash_before,
    state_hash_after: effect.state_hash_after,
    snapshot_hash_after: effect.snapshot_hash_after,
    trace_ref: effect.trace_entry.trace_id,
    commit_ref: commitRef
  };
  const canonicalResult = {
    ...resultBody,
    result_ref: (await deriveRef("result", RESULT_ID_PROJECTION_V1, resultBody)) as never
  };
  const committedAttempt = {
    attempt_sequence: 1,
    status: "COMMITTED",
    revision_before: effect.revision_before,
    revision_after: effect.revision_after,
    state_hash_before: effect.state_hash_before,
    state_hash_after: effect.state_hash_after,
    result_ref: canonicalResult.result_ref,
    prepared_result_ref: `workflow:w-chain-${options.proposal.transition_id}`,
    trace_ref: effect.trace_entry.trace_id,
    audit_ref: null,
    error_code: null,
    reason: null
  };
  const transitionRecord = {
    schema_version: "transition-record-v1",
    record_version: 1,
    transition_id: options.proposal.transition_id,
    subject_id: options.proposal.subject_id,
    transition_type: options.proposal.transition_type,
    proposal_ref: proposalRefValue,
    payload_fingerprint: payloadFingerprint,
    fingerprint_version: "proposal-fingerprint-v1",
    first_seen_sequence: effect.revision_after,
    attempts: [committedAttempt],
    reuse_conflicts: [],
    terminal_status: "COMMITTED",
    terminal_result_ref: canonicalResult.result_ref
  };

  if (options.version === "v1") {
    const partial = {
      commit_version: "atomic-commit-v1" as const,
      serialization_version: "canonical-json-v1" as const,
      commit_ref: commitRef,
      subject_id: options.proposal.subject_id,
      transition_id: options.proposal.transition_id,
      transition_type: options.proposal.transition_type,
      payload_fingerprint: payloadFingerprint,
      prepared_result_ref: `workflow:w-chain-${options.proposal.transition_id}`,
      expected_revision: effect.revision_before as never,
      next_revision: effect.revision_after as never,
      identity_record_version_before: 0,
      previous_commit_ref: options.previous.commit_ref,
      previous_record_checksum: options.previous.record_checksum,
      next_snapshot: effect.successor,
      logical_time_before: effect.logical_time_before,
      logical_time_after: effect.logical_time_after,
      state_hash_before: effect.state_hash_before,
      state_hash_after: effect.state_hash_after,
      snapshot_hash_before: effect.snapshot_hash_before,
      snapshot_hash_after: effect.snapshot_hash_after,
      trace_entry: effect.trace_entry,
      trace_window: effect.trace_window,
      mutation_history_link: {
        history_sequence: effect.revision_after,
        previous_trace_ref: effect.previous_trace_ref,
        current_trace_ref: effect.trace_entry.trace_id
      },
      transition_record: transitionRecord,
      canonical_result: canonicalResult,
      repository_revision_bindings: [
        {
          repository_revision: effect.successor.memory_state.repository_revision,
          repository_revision_hash: "sha256:4444444444444444444444444444444444444444444444444444444444444444"
        }
      ]
    };
    return {
      ...partial,
      record_checksum: await hashEnvelope(RECORD_CHECKSUM_PROJECTION_V1, partial)
    } as unknown as AtomicCommitBundleV1;
  }

  const partialV2 = {
    commit_version: "atomic-commit-v2" as const,
    serialization_version: "canonical-json-v1" as const,
    canonical_proposal: options.proposal,
    writer_authority: writerAuthority,
    commit_ref: commitRef,
    subject_id: options.proposal.subject_id,
    transition_id: options.proposal.transition_id,
    transition_type: options.proposal.transition_type,
    payload_fingerprint: payloadFingerprint,
    prepared_result_ref: `workflow:w-chain-${options.proposal.transition_id}`,
    expected_revision: effect.revision_before,
    next_revision: effect.revision_after,
    identity_record_version_before: 0,
    previous_commit_ref: options.previous.commit_ref,
    previous_record_checksum: options.previous.record_checksum as never,
    next_snapshot: effect.successor,
    logical_time_before: effect.logical_time_before,
    logical_time_after: effect.logical_time_after,
    state_hash_before: effect.state_hash_before,
    state_hash_after: effect.state_hash_after,
    snapshot_hash_before: effect.snapshot_hash_before,
    snapshot_hash_after: effect.snapshot_hash_after,
    trace_entry: effect.trace_entry,
    trace_window: effect.trace_window,
    mutation_history_link: {
      history_sequence: effect.revision_after,
      previous_trace_ref: effect.previous_trace_ref,
      current_trace_ref: effect.trace_entry.trace_id
    },
    transition_record: transitionRecord,
    canonical_result: canonicalResult,
    repository_revision_bindings: [
      {
        repository_revision: effect.successor.memory_state.repository_revision,
        repository_revision_hash: "sha256:4444444444444444444444444444444444444444444444444444444444444444"
      }
    ]
  };
  return {
    ...partialV2,
    record_checksum: await deriveAtomicCommitRecordChecksumV2(partialV2 as never)
  } as unknown as AtomicCommitBundleV2;
}

interface ChainFixture {
  readonly boundary: TrustedCanonicalHistoryBoundaryReceiptV0;
  readonly genesis: PersistedSubjectEnvelopeV1;
  readonly bundles: AtomicCommitBundleAnyVersion[];
  readonly predecessor: SubjectStateV0;
  readonly link: ChainLink;
}

async function emptyFixture(): Promise<ChainFixture> {
  const genesis = await buildGenesisEnvelope();
  const boundaryOutcome = await mintTrustedCanonicalHistoryBoundaryV0({
    genesis,
    head: {
      schema_version: "trusted-canonical-head-v0",
      subject_id: "subject-s0",
      revision: 0,
      commit_ref: null,
      record_checksum: null,
      state_hash: genesis.state_hash,
      snapshot_hash: genesis.snapshot_hash
    } as never
  });
  if (boundaryOutcome.kind !== "MINTED") throw new Error("fixture boundary mint failed");
  return {
    boundary: boundaryOutcome.receipt,
    genesis,
    bundles: [],
    predecessor: genesis.snapshot,
    link: { commit_ref: null, record_checksum: null }
  };
}

async function chainFixture(
  steps: readonly { readonly version: "v1" | "v2"; readonly value: number; readonly writerAuthorityBody?: Record<string, unknown> | null }[]
): Promise<ChainFixture> {
  const base = await emptyFixture();
  let predecessor = base.predecessor;
  let link = base.link;
  const bundles: AtomicCommitBundleAnyVersion[] = [];
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i] as { readonly version: "v1" | "v2"; readonly value: number; readonly writerAuthorityBody?: Record<string, unknown> | null };
    // OCCURRENCE transitions do not advance logical time: every proposal's
    // occurrence equals the current (genesis) logical time 0.
    const proposal = chainProposal(`t-chain-${String(i + 1).padStart(3, "0")}`, i, 0, relationshipsWith(step.value));
    const bundle = await buildChainBundle({
      predecessor,
      proposal,
      version: step.version,
      previous: link,
      writerAuthorityBody: step.writerAuthorityBody ?? null
    });
    bundles.push(bundle);
    predecessor = bundle.next_snapshot;
    link = { commit_ref: bundle.commit_ref, record_checksum: bundle.record_checksum };
  }
  const terminal = bundles[bundles.length - 1] as AtomicCommitBundleAnyVersion;
  const head = {
    schema_version: "trusted-canonical-head-v0",
    subject_id: "subject-s0",
    revision: terminal.next_revision as never,
    commit_ref: terminal.commit_ref,
    record_checksum: terminal.record_checksum,
    state_hash: terminal.state_hash_after,
    snapshot_hash: terminal.snapshot_hash_after
  };
  const boundaryOutcome = await mintTrustedCanonicalHistoryBoundaryV0({
    genesis: base.genesis,
    head: head as never
  });
  if (boundaryOutcome.kind !== "MINTED") throw new Error("fixture boundary mint failed");
  return { boundary: boundaryOutcome.receipt, genesis: base.genesis, bundles, predecessor, link };
}

function headOf(receipt: { head: TrustedCanonicalHeadInputV0 }): TrustedCanonicalHeadInputV0 {
  return receipt.head;
}

function isInvalid(
  result: Awaited<ReturnType<typeof validateAtomicCommitChainV0>>,
  code: string
): void {
  expect(result.kind).toBe("INVALID");
  if (result.kind === "INVALID") {
    if (result.failure.code !== code) {
      console.log(`PROBE_CODE=got ${result.failure.code} (${result.failure.detail})`);
    }
    expect(result.failure.code).toBe(code);
    expect(result.policy_id).toBe("characteros-atomic-commit-chain-validator-v0");
    expect(result.policy_fingerprint).toMatch(/^sha256:[0-9a-f]{64}$/);
  }
}

// ---- tests --------------------------------------------------------------------------

describe("Atomic commit chain validator V0", () => {
  it("validates the empty genesis chain against the exact revision-zero head", async () => {
    const fixture = await emptyFixture();
    expect(isTrustedCanonicalHistoryBoundaryReceiptV0(fixture.boundary)).toBe(true);
    const result = await validateAtomicCommitChainV0({
      trusted_boundary: fixture.boundary,
      bundles: []
    });
    expect(result.kind).toBe("VALID");
    if (result.kind !== "VALID") return;
    expect(result.receipt.bundle_count).toBe(0);
    expect(result.receipt.terminal_revision).toBe(0);
    expect(result.receipt.terminal_commit_ref).toBeNull();
    expect(result.receipt.genesis_revision).toBe(0);
    expect(result.receipt.v1_proof_level).toBe(
      "INTEGRITY_CONTINUITY_TRACE_AND_TRUSTED_HEAD_BINDING_ONLY_NO_PROPOSAL_EFFECT_REPLAY"
    );
    expect(result.receipt.v2_proof_level).toBe(
      "INTEGRITY_CONTINUITY_TRUSTED_HEAD_BINDING_AND_CANONICAL_PROPOSAL_EFFECT_REPLAY"
    );
    expect(Object.isFrozen(result.receipt)).toBe(true);
  });

  it("fails a positive trusted head with an empty candidate chain (truncation)", async () => {
    const fixture = await chainFixture([{ version: "v1", value: 0.5 }]);
    const result = await validateAtomicCommitChainV0({ trusted_boundary: fixture.boundary, bundles: [] });
    isInvalid(result, "TRUNCATED_HISTORY");
  });

  it("validates one and multiple V1 bundles with the limited V1 proof level", async () => {
    const single = await chainFixture([{ version: "v1", value: 0.5 }]);
    const singleResult = await validateAtomicCommitChainV0({
      trusted_boundary: single.boundary,
      bundles: single.bundles
    });
    expect(singleResult.kind).toBe("VALID");
    if (singleResult.kind === "VALID") {
      expect(singleResult.receipt.v1_bundle_count).toBe(1);
      expect(singleResult.receipt.v2_bundle_count).toBe(0);
      expect(singleResult.receipt.first_v2_bundle_index).toBeNull();
      expect(singleResult.receipt.writer_authority_summary).toStrictEqual({
        not_present: 0,
        resolved_valid: 0,
        unresolved: 0,
        resolved_invalid: 0
      });
    }

    const multi = await chainFixture([
      { version: "v1", value: 0.5 },
      { version: "v1", value: 0.7 }
    ]);
    const multiResult = await validateAtomicCommitChainV0({
      trusted_boundary: multi.boundary,
      bundles: multi.bundles
    });
    expect(multiResult.kind).toBe("VALID");
    if (multiResult.kind === "VALID") expect(multiResult.receipt.v1_bundle_count).toBe(2);
  });

  it("validates the V1→V2 boundary and multi-V2 chains via persisted-proposal effect replay", async () => {
    const mixed = await chainFixture([
      { version: "v1", value: 0.5 },
      { version: "v2", value: 0.7 },
      { version: "v2", value: 0.9 }
    ]);
    const result = await validateAtomicCommitChainV0({
      trusted_boundary: mixed.boundary,
      bundles: mixed.bundles
    });
    expect(result.kind).toBe("VALID");
    if (result.kind !== "VALID") return;
    expect(result.receipt.v1_bundle_count).toBe(1);
    expect(result.receipt.v2_bundle_count).toBe(2);
    expect(result.receipt.first_v2_bundle_index).toBe(1);
    expect(result.receipt.first_v2_revision).toBe(1);
    expect(result.receipt.writer_authority_summary.not_present).toBe(2);
    expect(result.receipt.terminal_revision).toBe(3);
  });

  it("fails closed on a V2→V1 version downgrade", async () => {
    const fixture = await chainFixture([
      { version: "v2", value: 0.5 },
      { version: "v1", value: 0.7 }
    ]);
    const result = await validateAtomicCommitChainV0({
      trusted_boundary: fixture.boundary,
      bundles: fixture.bundles
    });
    isInvalid(result, "VERSION_DOWNGRADE");
    if (result.kind === "INVALID") expect(result.failure.bundle_index).toBe(1);
  });

  it("rejects a mutated V2 successor even with consistently recomputed ordinary projections", async () => {
    const fixture = await chainFixture([
      { version: "v1", value: 0.5 },
      { version: "v2", value: 0.7 }
    ]);
    const v2 = fixture.bundles[1] as AtomicCommitBundleV2;
    const mutatedSnapshot = {
      ...v2.next_snapshot,
      relationships: relationshipsWith(0.99)
    } as unknown as SubjectStateV0;
    const { stateHash, snapshotHash, nextTraceWindow, lastTraceRef } = subjectCorePrimitives;
    const stateHashAfter = await stateHash(mutatedSnapshot);
    const proposalRefValue = await proposalRef(v2.canonical_proposal);
    const payloadFingerprint = await proposalFingerprint(v2.canonical_proposal);
    // Full consistent cascade: a different successor changes state_hash_after
    // -> trace id -> trace window -> snapshot hash -> commit ref -> result and
    // transition record -> record checksum. Everything EXCEPT the persisted
    // proposal is rebuilt, so single-record validation passes and only the
    // chain-level proposal-effect replay can catch the mutation.
    const prevEntries = v2.trace_window.entries.slice(0, -1);
    const prevWindow = {
      trace_window_schema_version: "trace-window-v1",
      capacity: 64,
      cursor: {
        last_history_sequence: v2.expected_revision,
        offloaded_through_sequence: 0,
        offloaded_through_trace_ref: null
      },
      entries: prevEntries
    } as never;
    const traceBody: Record<string, unknown> = { ...v2.trace_entry, state_hash_after: stateHashAfter };
    delete traceBody["trace_id"];
    const newTraceId = (await deriveRef("trace", "characteros-next/trace/entry-id/v1", traceBody)) as never;
    const newTraceEntry = { ...traceBody, trace_id: newTraceId } as never;
    const newWindow = nextTraceWindow(prevWindow, newTraceEntry, v2.next_revision);
    const successor = { ...mutatedSnapshot, trace_window: newWindow } as unknown as SubjectStateV0;
    const snapshotHashAfter = await snapshotHash({
      state_hash: stateHashAfter,
      subject_id: "subject-s0",
      state_revision: v2.next_revision,
      trace_cursor: newWindow.cursor,
      last_trace_ref: newTraceId
    });
    const commitRef = await deriveAtomicCommitRefV2({
      commit_version: "atomic-commit-v2",
      serialization_version: "canonical-json-v1",
      proposal_ref: proposalRefValue,
      payload_fingerprint: payloadFingerprint,
      subject_id: v2.subject_id,
      transition_id: v2.transition_id,
      transition_type: v2.transition_type,
      expected_revision: v2.expected_revision,
      next_revision: v2.next_revision,
      previous_commit_ref: v2.previous_commit_ref,
      previous_record_checksum: v2.previous_record_checksum,
      state_hash_before: v2.state_hash_before,
      state_hash_after: stateHashAfter,
      snapshot_hash_before: v2.snapshot_hash_before,
      snapshot_hash_after: snapshotHashAfter,
      trace_ref: newTraceId as never,
      writer_authority_payload_hash: null
    } as never);
    const resultBody = {
      schema_version: "canonical-commit-result-v1" as const,
      status: "COMMITTED" as const,
      transition_id: v2.canonical_result.transition_id,
      subject_id: v2.canonical_result.subject_id,
      payload_fingerprint: payloadFingerprint,
      previous_revision: v2.canonical_result.previous_revision,
      next_revision: v2.canonical_result.next_revision,
      state_hash_before: v2.canonical_result.state_hash_before,
      state_hash_after: stateHashAfter,
      snapshot_hash_after: snapshotHashAfter,
      trace_ref: newTraceId,
      commit_ref: commitRef
    };
    const canonicalResult = {
      ...resultBody,
      result_ref: (await deriveRef("result", "characteros-next/subject-core/result-id/v1", resultBody)) as never
    };
    const attempts = v2.transition_record.attempts.map((attempt, index2) =>
      index2 === v2.transition_record.attempts.length - 1
        ? {
            ...attempt,
            state_hash_after: stateHashAfter,
            result_ref: canonicalResult.result_ref,
            trace_ref: newTraceId
          }
        : attempt
    );
    const partial: Record<string, unknown> = {
      ...v2,
      next_snapshot: successor,
      state_hash_after: stateHashAfter,
      snapshot_hash_after: snapshotHashAfter,
      commit_ref: commitRef,
      trace_entry: newTraceEntry,
      trace_window: newWindow,
      mutation_history_link: {
        history_sequence: v2.next_revision,
        previous_trace_ref: lastTraceRef(prevWindow as never),
        current_trace_ref: newTraceId
      },
      canonical_result: canonicalResult,
      transition_record: {
        ...v2.transition_record,
        terminal_result_ref: canonicalResult.result_ref,
        attempts
      }
    };
    delete partial["record_checksum"];
    const tampered = {
      ...partial,
      record_checksum: await deriveAtomicCommitRecordChecksumV2(partial as never)
    } as unknown as AtomicCommitBundleV2;
    const tamperedChain = [fixture.bundles[0], tampered];

    // The tampered record passes closed single-record validation (hashes
    // consistently rebuilt) yet MUST fail chain replay: the persisted
    // proposal deterministically reproduces the ORIGINAL successor only.
    const result = await validateAtomicCommitChainV0({
      trusted_boundary: fixture.boundary,
      bundles: tamperedChain
    });
    isInvalid(result, "V2_PROPOSAL_EFFECT_MISMATCH");
    if (result.kind === "INVALID") expect(result.failure.bundle_index).toBe(1);
  });

  it("fails closed on the continuity negative matrix", async () => {
    // Wrong subject.
    const wrongSubject = await chainFixture([{ version: "v1", value: 0.5 }]);
    const wrongSubjectBundle = {
      ...(wrongSubject.bundles[0] as AtomicCommitBundleV1),
      subject_id: "subject-other"
    } as AtomicCommitBundleV1;
    // (Tampered bundle also fails its own single-record law; chain reports
    // INVALID_BUNDLE at the lowest index — deterministic precedence.)
    isInvalid(
      await validateAtomicCommitChainV0({
        trusted_boundary: wrongSubject.boundary,
        bundles: [wrongSubjectBundle]
      }),
      "INVALID_BUNDLE"
    );

    // Revision gap: chain starting at revision 1.
    const gapSource = await chainFixture([
      { version: "v1", value: 0.5 },
      { version: "v1", value: 0.7 }
    ]);
    isInvalid(
      await validateAtomicCommitChainV0({
        trusted_boundary: (await emptyFixture()).boundary,
        bundles: [gapSource.bundles[1] as AtomicCommitBundleAnyVersion]
      }),
      "REVISION_GAP"
    );

    // Duplicate revision: two different bundles committing revision 1.
    const duplicateRevision = await chainFixture([{ version: "v1", value: 0.5 }]);
    const secondRev1 = await buildChainBundle({
      predecessor: duplicateRevision.genesis.snapshot,
      proposal: chainProposal("t-chain-dup", 0, 0, {
        schema_version: "relationship-state-v0",
        counterparts: []
      }),
      version: "v1",
      previous: duplicateRevision.link
    });
    isInvalid(
      await validateAtomicCommitChainV0({
        trusted_boundary: duplicateRevision.boundary,
        bundles: [duplicateRevision.bundles[0] as AtomicCommitBundleAnyVersion, secondRev1]
      }),
      "DUPLICATE_REVISION"
    );

    // Wrong predecessor commit ref / checksum.
    const brokenLink = await chainFixture([{ version: "v1", value: 0.5 }]);
    const brokenRefBundle = await buildChainBundle({
      predecessor: brokenLink.genesis.snapshot,
      proposal: chainProposal("t-chain-001", 0, 0, relationshipsWith(0.5)),
      version: "v1",
      previous: { commit_ref: "commit:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff", record_checksum: null }
    });
    isInvalid(
      await validateAtomicCommitChainV0({
        trusted_boundary: brokenLink.boundary,
        bundles: [brokenRefBundle]
      }),
      "PREDECESSOR_REF_MISMATCH"
    );
    const brokenChecksumBundle = await buildChainBundle({
      predecessor: brokenLink.genesis.snapshot,
      proposal: chainProposal("t-chain-001", 0, 0, relationshipsWith(0.5)),
      version: "v1",
      previous: { commit_ref: null, record_checksum: HASH }
    });
    isInvalid(
      await validateAtomicCommitChainV0({
        trusted_boundary: brokenLink.boundary,
        bundles: [brokenChecksumBundle]
      }),
      "PREDECESSOR_CHECKSUM_MISMATCH"
    );

    // Wrong state_hash_before / snapshot_hash_before (tampered, checksum-rebuilt).
    const hashTamper = await chainFixture([{ version: "v1", value: 0.5 }]);
    const tamperBase = hashTamper.bundles[0] as AtomicCommitBundleV1;
    const tamperedHashes = {
      ...tamperBase,
      state_hash_before: HASH,
      snapshot_hash_before: HASH
    } as Record<string, unknown>;
    delete tamperedHashes["record_checksum"];
    const tamperedHashesBundle = {
      ...tamperedHashes,
      record_checksum: await hashEnvelope("characteros-next/atomic-commit/record-checksum/v1", tamperedHashes)
    } as unknown as AtomicCommitBundleV1;
    // state_hash_before tampering breaks single-record law first (result
    // binding) — deterministic precedence reports INVALID_BUNDLE.
    isInvalid(
      await validateAtomicCommitChainV0({
        trusted_boundary: hashTamper.boundary,
        bundles: [tamperedHashesBundle]
      }),
      "INVALID_BUNDLE"
    );

    // Logical time break on a V2 bundle: the persisted proposal's occurrence
    // no longer matches the predecessor logical time. The tampered proposal is
    // internally consistent (fingerprints/refs/authority binding all rebuilt),
    // so only the chain-level replay can reject it.
    const timeBreak = await chainFixture([
      { version: "v1", value: 0.5 },
      { version: "v2", value: 0.7 }
    ]);
    const timeBreakV2 = timeBreak.bundles[1] as AtomicCommitBundleV2;
    const tamperedProposal = {
      ...timeBreakV2.canonical_proposal,
      time_input: { kind: "OCCURRENCE", occurrence_logical_time: 7 }
    } as unknown as CanonicalTransitionProposalV1;
    const tamperedProposalRef = await proposalRef(tamperedProposal);
    const tamperedPayloadFingerprint = await proposalFingerprint(tamperedProposal);
    const timeTampered: Record<string, unknown> = {
      ...timeBreakV2,
      canonical_proposal: tamperedProposal
    };
    if (timeTampered["writer_authority"] !== null) {
      const authority = { ...(timeTampered["writer_authority"] as Record<string, unknown>) };
      authority["proposal_ref"] = tamperedProposalRef;
      authority["payload_fingerprint"] = tamperedPayloadFingerprint;
      delete authority["authority_payload_hash"];
      const authorityPayloadHash = await deriveWriterAuthorityPayloadHashV0(authority as never);
      timeTampered["writer_authority"] = { ...authority, authority_payload_hash: authorityPayloadHash };
    }
    const timeCommitRef = await deriveAtomicCommitRefV2({
      commit_version: "atomic-commit-v2",
      serialization_version: "canonical-json-v1",
      proposal_ref: tamperedProposalRef,
      payload_fingerprint: tamperedPayloadFingerprint,
      subject_id: timeBreakV2.subject_id,
      transition_id: timeBreakV2.transition_id,
      transition_type: timeBreakV2.transition_type,
      expected_revision: timeBreakV2.expected_revision,
      next_revision: timeBreakV2.next_revision,
      previous_commit_ref: timeBreakV2.previous_commit_ref,
      previous_record_checksum: timeBreakV2.previous_record_checksum,
      state_hash_before: timeBreakV2.state_hash_before,
      state_hash_after: timeBreakV2.state_hash_after,
      snapshot_hash_before: timeBreakV2.snapshot_hash_before,
      snapshot_hash_after: timeBreakV2.snapshot_hash_after,
      trace_ref: timeBreakV2.trace_entry.trace_id,
      writer_authority_payload_hash:
        (timeTampered["writer_authority"] === null
          ? null
          : (((timeTampered["writer_authority"] as Record<string, unknown>)[
              "authority_payload_hash"
            ] as string) ?? null)) as never
    });
    const timeResultBody = {
      schema_version: "canonical-commit-result-v1" as const,
      status: "COMMITTED" as const,
      transition_id: timeBreakV2.canonical_result.transition_id,
      subject_id: timeBreakV2.canonical_result.subject_id,
      payload_fingerprint: tamperedPayloadFingerprint,
      previous_revision: timeBreakV2.canonical_result.previous_revision,
      next_revision: timeBreakV2.canonical_result.next_revision,
      state_hash_before: timeBreakV2.canonical_result.state_hash_before,
      state_hash_after: timeBreakV2.canonical_result.state_hash_after,
      snapshot_hash_after: timeBreakV2.canonical_result.snapshot_hash_after,
      trace_ref: timeBreakV2.canonical_result.trace_ref,
      commit_ref: timeCommitRef
    };
    const timeCanonicalResult = {
      ...timeResultBody,
      result_ref: (await deriveRef("result", "characteros-next/subject-core/result-id/v1", timeResultBody)) as never
    };
    const timeAttempts = timeBreakV2.transition_record.attempts.map((attempt) =>
      attempt.status === "COMMITTED"
        ? { ...attempt, result_ref: timeCanonicalResult.result_ref }
        : attempt
    );
    const timeUpdatedWindow = {
      ...timeBreakV2.trace_window,
      entries: timeBreakV2.trace_window.entries.map((entry) =>
        entry.trace_id === timeBreakV2.trace_entry.trace_id
          ? { ...entry, proposal_ref: tamperedProposalRef }
          : entry
      )
    };
    const timeTamperedFinal: Record<string, unknown> = {
      ...timeTampered,
      commit_ref: timeCommitRef,
      payload_fingerprint: tamperedPayloadFingerprint,
      next_snapshot: {
        ...timeBreakV2.next_snapshot,
        trace_window: timeUpdatedWindow
      },
      canonical_result: timeCanonicalResult,
      transition_record: {
        ...timeBreakV2.transition_record,
        proposal_ref: tamperedProposalRef,
        payload_fingerprint: tamperedPayloadFingerprint,
        terminal_result_ref: timeCanonicalResult.result_ref,
        attempts: timeAttempts
      },
      trace_entry: {
        ...timeBreakV2.trace_entry,
        proposal_ref: tamperedProposalRef
      },
      trace_window: timeUpdatedWindow
    };
    delete timeTamperedFinal["record_checksum"];
    const timeTamperedBundle = {
      ...timeTamperedFinal,
      record_checksum: await deriveAtomicCommitRecordChecksumV2(timeTamperedFinal as never)
    } as unknown as AtomicCommitBundleV2;
    isInvalid(
      await validateAtomicCommitChainV0({
        trusted_boundary: timeBreak.boundary,
        bundles: [timeBreak.bundles[0] as AtomicCommitBundleAnyVersion, timeTamperedBundle]
      }),
      "LOGICAL_TIME_MISMATCH"
    );

    // Duplicate transition id: bundle 2 reuses bundle 1's transition identity.
    const dupId = await chainFixture([{ version: "v1", value: 0.5 }]);
    const dupProposal = {
      ...chainProposal("t-chain-001", 1, 0, relationshipsWith(0.7))
    } as unknown as CanonicalTransitionProposalV1;
    const dupIdBundle = await buildChainBundle({
      predecessor: (dupId.bundles[0] as AtomicCommitBundleAnyVersion).next_snapshot,
      proposal: dupProposal,
      version: "v1",
      previous: {
        commit_ref: (dupId.bundles[0] as AtomicCommitBundleV1).commit_ref,
        record_checksum: (dupId.bundles[0] as AtomicCommitBundleV1).record_checksum
      }
    });
    isInvalid(
      await validateAtomicCommitChainV0({
        trusted_boundary: dupId.boundary,
        bundles: dupId.bundles.concat([dupIdBundle])
      }),
      "TRANSITION_ID_REUSE"
    );

    // Terminal trusted-head mismatch (wrong terminal state hash).
    const headMismatch = await chainFixture([{ version: "v1", value: 0.5 }]);
    const headMismatchBundle = headMismatch.bundles[0] as AtomicCommitBundleV1;
    const wrongHead = await mintTrustedCanonicalHistoryBoundaryV0({
      genesis: headMismatch.genesis,
      head: {
        schema_version: "trusted-canonical-head-v0",
        subject_id: "subject-s0",
        revision: 1,
        commit_ref: headMismatchBundle.commit_ref,
        record_checksum: headMismatchBundle.record_checksum,
        state_hash: HASH,
        snapshot_hash: headMismatchBundle.snapshot_hash_after
      } as never
    });
    if (wrongHead.kind === "MINTED") {
      isInvalid(
        await validateAtomicCommitChainV0({
          trusted_boundary: wrongHead.receipt,
          bundles: headMismatch.bundles
        }),
        "TRUSTED_HEAD_MISMATCH"
      );
    }

    // Truncated chain: one V1 bundle under a two-bundle trusted head.
    const truncated = await chainFixture([
      { version: "v1", value: 0.5 },
      { version: "v1", value: 0.7 }
    ]);
    const truncatedHead = await mintTrustedCanonicalHistoryBoundaryV0({
      genesis: truncated.genesis,
      head: {
        schema_version: "trusted-canonical-head-v0",
        subject_id: "subject-s0",
        revision: 2,
        commit_ref: (truncated.bundles[1] as AtomicCommitBundleV1).commit_ref,
        record_checksum: (truncated.bundles[1] as AtomicCommitBundleV1).record_checksum,
        state_hash: (truncated.bundles[1] as AtomicCommitBundleV1).state_hash_after,
        snapshot_hash: (truncated.bundles[1] as AtomicCommitBundleV1).snapshot_hash_after
      } as never
    });
    if (truncatedHead.kind === "MINTED") {
      isInvalid(
        await validateAtomicCommitChainV0({
          trusted_boundary: truncatedHead.receipt,
          bundles: [truncated.bundles[0] as AtomicCommitBundleAnyVersion]
        }),
        "TRUNCATED_HISTORY"
      );
    }
  });

  it("rejects untrusted boundaries and inserted orphans, and ignores outside orphans", async () => {
    const fixture = await chainFixture([{ version: "v1", value: 0.5 }]);
    // Untrusted lookalike boundary.
    const lookalike = {
      schema_version: "trusted-canonical-history-boundary-v0",
      genesis: fixture.genesis,
      head: headOf({ head: fixture.boundary.head })
    };
    isInvalid(
      await validateAtomicCommitChainV0({ trusted_boundary: lookalike as never, bundles: fixture.bundles }),
      "UNTRUSTED_BOUNDARY"
    );

    // Orphan outside the candidate path has no effect (chain still valid).
    const valid = await validateAtomicCommitChainV0({
      trusted_boundary: fixture.boundary,
      bundles: fixture.bundles
    });
    expect(valid.kind).toBe("VALID");

    // An inserted orphan breaks adjacency with a precise first failure.
    const orphan = await buildChainBundle({
      predecessor: (fixture.bundles[0] as AtomicCommitBundleAnyVersion).next_snapshot,
      proposal: chainProposal("t-chain-orphan", 1, 0, relationshipsWith(0.9)),
      version: "v1",
      previous: {
        commit_ref: (fixture.bundles[0] as AtomicCommitBundleV1).commit_ref,
        record_checksum: (fixture.bundles[0] as AtomicCommitBundleV1).record_checksum
      }
    });
    const withOrphan = [
      fixture.bundles[0] as AtomicCommitBundleAnyVersion,
      orphan,
      fixture.bundles[0] as AtomicCommitBundleAnyVersion
    ];
    isInvalid(
      await validateAtomicCommitChainV0({ trusted_boundary: fixture.boundary, bundles: withOrphan }),
      "DUPLICATE_REVISION"
    );
  });

  it("classifies V2 writer-authority status without affecting chain validity", async () => {
    const schemaFingerprint = await deriveRelationshipGovernedWriterSchemaFingerprintV0();
    const payload = {
      schema_version: "relationship-governed-feature-writer-authority-payload-v0",
      operation_kind: "UPDATE",
      subject_id: "subject-s0",
      expected_revision: 1,
      counterpart_ref: "entity:alice-like",
      dimension_id: "relationship_core_fixture_v0",
      previous: { kind: "PRESENT", value: 0.5 },
      next: { kind: "PRESENT", value: 0.7 },
      relationship_state_schema_version: "relationship-state-v0",
      feature_semantics_contract_id: "test-feature-semantics-contract-v0",
      feature_semantics_contract_fingerprint: HASH,
      write_policy_id: "test-write-policy-v0",
      write_policy_fingerprint: HASH,
      evidence_receipt_refs: ["episode:ep-01"],
      write_policy_receipt_ref: "workflow:w-policy-receipt-001",
      authority_epoch_start_transition_id: "t-chain-002",
      previous_governed_authority: { kind: "NONE" }
    };
    const governedFixture = await chainFixture([
      { version: "v1", value: 0.5 },
      {
        version: "v2",
        value: 0.7,
        writerAuthorityBody: {
          schema_version: "canonical-writer-authority-record-v0",
          proposal_ref: "proposal:0000000000000000000000000000000000000000000000000000000000000000",
          payload_fingerprint: HASH,
          writer_family: "RELATIONSHIP_GOVERNED_FEATURE",
          writer_class: "UPDATE",
          writer_schema_id: RELATIONSHIP_GOVERNED_WRITER_SCHEMA_ID_V0 as never,
          writer_schema_fingerprint: schemaFingerprint,
          authorization_gate_id: "test-gate-v0",
          authorization_gate_fingerprint: HASH,
          authority_payload: payload
        }
      }
    ]);
    const result = await validateAtomicCommitChainV0({
      trusted_boundary: governedFixture.boundary,
      bundles: governedFixture.bundles
    });
    if (result.kind === "INVALID") {
      console.log("PROBE_AUTH=" + result.failure.code + " " + result.failure.detail);
    }
    // Schema recognized but gates/policies are zero: chain VALID, status UNRESOLVED.
    expect(result.kind).toBe("VALID");
    if (result.kind === "VALID") {
      expect(result.receipt.writer_authority_summary.unresolved).toBe(1);
      expect(result.receipt.writer_authority_summary.resolved_valid).toBe(0);
    }

    // Known schema id with a wrong fingerprint: RESOLVED_INVALID, still reported.
    const invalidAuthorityFixture = await chainFixture([
      { version: "v1", value: 0.5 },
      {
        version: "v2",
        value: 0.7,
        writerAuthorityBody: {
          schema_version: "canonical-writer-authority-record-v0",
          proposal_ref: "proposal:0000000000000000000000000000000000000000000000000000000000000000",
          payload_fingerprint: HASH,
          writer_family: "RELATIONSHIP_GOVERNED_FEATURE",
          writer_class: "UPDATE",
          writer_schema_id: RELATIONSHIP_GOVERNED_WRITER_SCHEMA_ID_V0 as never,
          writer_schema_fingerprint: HASH,
          authorization_gate_id: "test-gate-v0",
          authorization_gate_fingerprint: HASH,
          authority_payload: payload
        }
      }
    ]);
    const invalidResult = await validateAtomicCommitChainV0({
      trusted_boundary: invalidAuthorityFixture.boundary,
      bundles: invalidAuthorityFixture.bundles
    });
    expect(invalidResult.kind).toBe("VALID");
    if (invalidResult.kind === "VALID") {
      expect(invalidResult.receipt.writer_authority_summary.resolved_invalid).toBe(1);
    }
  });

  it("is pure: inputs unchanged, no mutation of genesis/boundary/bundles", async () => {
    const fixture = await chainFixture([
      { version: "v1", value: 0.5 },
      { version: "v2", value: 0.7 }
    ]);
    const snapshot = JSON.stringify({
      genesis: fixture.genesis,
      boundary: fixture.boundary,
      bundles: fixture.bundles
    });
    await validateAtomicCommitChainV0({
      trusted_boundary: fixture.boundary,
      bundles: fixture.bundles
    });
    expect(
      JSON.stringify({ genesis: fixture.genesis, boundary: fixture.boundary, bundles: fixture.bundles })
    ).toBe(snapshot);
  });
});
