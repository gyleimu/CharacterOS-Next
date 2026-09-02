/**
 * Restore Chain Authority Integration V0 — acceptance suite
 * (§32-§42): exact R0 restore, boundary clone rejection, R0 mismatches,
 * positive-head truncation, one/multi-V1 restore, V1→V2 + multi-V2 restore,
 * envelope/terminal negatives (commit ref/checksum/state/snapshot/snapshot
 * JCS/subject/revision), repository binding projection, host-boolean and
 * structural-receipt attacks, TOCTOU snapshot, purity, and the closed export
 * surface.
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
  finalizeCanonicalTransitionEffectV0,
  hashEnvelope,
  prepareCanonicalTransitionEffectV0,
  proposalFingerprint,
  proposalRef,
  restoreFromEnvelope,
  type AtomicCommitBundleAnyVersion,
  type AtomicCommitBundleV1,
  type CanonicalTransitionProposalV1,
  type PersistedSubjectEnvelopeV1,
  type SubjectStateV0
} from "@characteros-next/subject-core";

import {
  mintTrustedCanonicalHistoryBoundaryV0,
  type TrustedCanonicalHeadInputV0,
  type TrustedCanonicalHistoryBoundaryReceiptV0
} from "./trusted-canonical-history-boundary.js";
import {
  restoreCanonicalSubjectFromHistoryV0,
  type RestoreChainAuthorityResultV0
} from "./restore-chain-authority.js";
import * as runtimeIndex from "../index.js";

const RESULT_ID_PROJECTION_V1 = "characteros-next/subject-core/result-id/v1";
const COMMIT_ID_PROJECTION_V1 = "characteros-next/subject-core/commit-id/v1";
const RECORD_CHECKSUM_PROJECTION_V1 = "characteros-next/atomic-commit/record-checksum/v1";
const R0_HASH = "sha256:4444444444444444444444444444444444444444444444444444444444444444";

// ---- state / proposal fixtures ------------------------------------------------------

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

// ---- genesis envelope / chain bundle builders ---------------------------------------

async function buildGenesisEnvelope(): Promise<PersistedSubjectEnvelopeV1> {
  const result = await createPersistenceEnvelope({
    snapshot: stateWithRelationships(0, 0, { schema_version: "relationship-state-v0", counterparts: [] }, []),
    repository_bindings: [{ repository_revision: "R0", repository_revision_hash: R0_HASH } as never],
    commit_head: null
  });
  if (!result.ok) throw new Error("fixture genesis failed");
  return result.value;
}

async function buildChainBundle(options: {
  readonly predecessor: SubjectStateV0;
  readonly proposal: CanonicalTransitionProposalV1;
  readonly version: "v1" | "v2";
  readonly previous: { readonly commit_ref: string | null; readonly record_checksum: string | null };
  readonly extraBindings?: readonly { repository_revision: string; repository_revision_hash: string }[];
}): Promise<AtomicCommitBundleAnyVersion> {
  const prepared = await prepareCanonicalTransitionEffectV0({
    predecessor: options.predecessor,
    proposal: options.proposal
  });
  if (prepared.kind !== "PREPARED") throw new Error("fixture prepare failed");
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
  const bindings = [
    {
      repository_revision: effect.successor.memory_state.repository_revision,
      repository_revision_hash: R0_HASH
    },
    ...(options.extraBindings ?? [])
  ];
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
          writer_authority_payload_hash: null
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
  const partial: Record<string, unknown> = {
    commit_version: options.version === "v1" ? "atomic-commit-v1" : "atomic-commit-v2",
    serialization_version: "canonical-json-v1",
    ...(options.version === "v2" ? { canonical_proposal: options.proposal, writer_authority: null } : {}),
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
    repository_revision_bindings: bindings
  };
  const recordChecksum =
    options.version === "v1"
      ? await hashEnvelope(RECORD_CHECKSUM_PROJECTION_V1, partial)
      : await deriveAtomicCommitRecordChecksumV2(partial as never);
  return { ...partial, record_checksum: recordChecksum } as unknown as AtomicCommitBundleAnyVersion;
}

interface RestoreChainFixture {
  readonly genesis: PersistedSubjectEnvelopeV1;
  readonly boundary: Awaited<ReturnType<typeof mintBoundaryFor>>;
  readonly bundles: AtomicCommitBundleAnyVersion[];
  readonly head: TrustedCanonicalHeadInputV0;
  readonly terminalEnvelope: PersistedSubjectEnvelopeV1;
}

async function mintBoundaryFor(
  genesis: PersistedSubjectEnvelopeV1,
  head: TrustedCanonicalHeadInputV0
): Promise<TrustedCanonicalHistoryBoundaryReceiptV0> {
  const outcome = await mintTrustedCanonicalHistoryBoundaryV0({ genesis, head });
  if (outcome.kind !== "MINTED") throw new Error("fixture boundary mint failed");
  return outcome.receipt;
}

/**
 * Builds a full chain fixture: genesis envelope + bundles + trusted boundary
 * + the independently minted terminal persisted envelope (created through
 * createPersistenceEnvelope over the terminal snapshot with the terminal
 * commit head — exactly what a real persistence layer would persist).
 */
async function buildRestoreFixture(
  steps: readonly {
    readonly version: "v1" | "v2";
    readonly value: number;
    readonly extraBindings?: readonly { repository_revision: string; repository_revision_hash: string }[];
  }[],
  envelopeMutator?: (envelope: PersistedSubjectEnvelopeV1, terminal: AtomicCommitBundleAnyVersion) => PersistedSubjectEnvelopeV1
): Promise<RestoreChainFixture> {
  const genesis = await buildGenesisEnvelope();
  let predecessor = genesis.snapshot;
  let link: { commit_ref: string | null; record_checksum: string | null } = { commit_ref: null, record_checksum: null };
  const bundles: AtomicCommitBundleAnyVersion[] = [];
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i] as {
      readonly version: "v1" | "v2";
      readonly value: number;
      readonly extraBindings?: readonly { repository_revision: string; repository_revision_hash: string }[];
    };
    const bundle = await buildChainBundle({
      predecessor,
      proposal: chainProposal(`t-restore-${String(i + 1).padStart(3, "0")}`, i, relationshipsWith(step.value)),
      version: step.version,
      previous: link,
      ...(step.extraBindings !== undefined ? { extraBindings: step.extraBindings } : {})
    });
    bundles.push(bundle);
    predecessor = bundle.next_snapshot;
    link = { commit_ref: bundle.commit_ref, record_checksum: bundle.record_checksum };
  }
  const terminal = bundles[bundles.length - 1] as AtomicCommitBundleAnyVersion;
  const head = {
    schema_version: "trusted-canonical-head-v0",
    subject_id: "subject-s0",
    revision: terminal.next_revision,
    commit_ref: terminal.commit_ref,
    record_checksum: terminal.record_checksum,
    state_hash: terminal.state_hash_after,
    snapshot_hash: terminal.snapshot_hash_after
  } as never;
  const boundary = await mintBoundaryFor(genesis, head);
  const envelopeResult = await createPersistenceEnvelope({
    snapshot: terminal.next_snapshot,
    repository_bindings: terminal.repository_revision_bindings.filter(
      (binding) => binding.repository_revision === terminal.next_snapshot.memory_state.repository_revision
    ) as never,
    commit_head: { commit_ref: terminal.commit_ref, record_checksum: terminal.record_checksum } as never
  });
  if (!envelopeResult.ok) throw new Error("fixture terminal envelope failed");
  const terminalEnvelope = envelopeMutator ? envelopeMutator(envelopeResult.value, terminal) : envelopeResult.value;
  return { genesis, boundary, bundles, head, terminalEnvelope };
}

// ---- tests --------------------------------------------------------------------------

describe("Restore chain authority integration V0", () => {
  it("restores a valid exact R0 subject (empty chain, genesis head)", async () => {
    const genesis = await buildGenesisEnvelope();
    const boundary = await mintBoundaryFor(genesis, {
      schema_version: "trusted-canonical-head-v0",
      subject_id: "subject-s0",
      revision: 0,
      commit_ref: null,
      record_checksum: null,
      state_hash: genesis.state_hash,
      snapshot_hash: genesis.snapshot_hash
    } as never);
    const result = await restoreCanonicalSubjectFromHistoryV0({
      persisted_envelope: genesis,
      trusted_boundary: boundary,
      bundles: []
    });
    expect(result.kind).toBe("RESTORED");
    if (result.kind !== "RESTORED") return;
    expect(result.restored_snapshot.runtime_metadata.state_revision).toBe(0);
    expect(Object.isFrozen(result.restored_snapshot)).toBe(true);
    const receipt = result.chain_receipt as { terminal_revision: number; v1_proof_level: string };
    expect(receipt.terminal_revision).toBe(0);
    expect(receipt.v1_proof_level).toBe(
      "INTEGRITY_CONTINUITY_TRACE_AND_TRUSTED_HEAD_BINDING_ONLY_NO_PROPOSAL_EFFECT_REPLAY"
    );
  });

  it("rejects a structural trusted-boundary clone with UNTRUSTED_HISTORY_BOUNDARY", async () => {
    const genesis = await buildGenesisEnvelope();
    const boundary = await mintBoundaryFor(genesis, {
      schema_version: "trusted-canonical-head-v0",
      subject_id: "subject-s0",
      revision: 0,
      commit_ref: null,
      record_checksum: null,
      state_hash: genesis.state_hash,
      snapshot_hash: genesis.snapshot_hash
    } as never);
    const result = await restoreCanonicalSubjectFromHistoryV0({
      persisted_envelope: genesis,
      trusted_boundary: { ...boundary },
      bundles: []
    });
    expect(result.kind).toBe("REJECTED");
    if (result.kind === "REJECTED") expect(result.failure.code).toBe("UNTRUSTED_HISTORY_BOUNDARY");
  });

  it("fails an R0 envelope whose snapshot differs from the trusted genesis", async () => {
    const genesis = await buildGenesisEnvelope();
    const boundary = await mintBoundaryFor(genesis, {
      schema_version: "trusted-canonical-head-v0",
      subject_id: "subject-s0",
      revision: 0,
      commit_ref: null,
      record_checksum: null,
      state_hash: genesis.state_hash,
      snapshot_hash: genesis.snapshot_hash
    } as never);
    const differentEnvelope = await createPersistenceEnvelope({
      snapshot: stateWithRelationships(0, 0, relationshipsWith(0.9), []),
      repository_bindings: [{ repository_revision: "R0", repository_revision_hash: R0_HASH } as never],
      commit_head: null
    });
    if (!differentEnvelope.ok) throw new Error("fixture failed");
    const result = await restoreCanonicalSubjectFromHistoryV0({
      persisted_envelope: differentEnvelope.value,
      trusted_boundary: boundary,
      bundles: []
    });
    expect(result.kind).toBe("REJECTED");
    if (result.kind === "REJECTED") expect(result.failure.code).toBe("ENVELOPE_CHAIN_MISMATCH");
  });

  it("fails an R0 envelope with corrupted integrity hashes via the chain validator", async () => {
    const genesis = await buildGenesisEnvelope();
    const boundary = await mintBoundaryFor(genesis, {
      schema_version: "trusted-canonical-head-v0",
      subject_id: "subject-s0",
      revision: 0,
      commit_ref: null,
      record_checksum: null,
      state_hash: genesis.state_hash,
      snapshot_hash: genesis.snapshot_hash
    } as never);
    const corrupted = {
      ...genesis,
      state_hash: "sha256:9999999999999999999999999999999999999999999999999999999999999999"
    } as PersistedSubjectEnvelopeV1;
    const result = await restoreCanonicalSubjectFromHistoryV0({
      persisted_envelope: corrupted,
      trusted_boundary: boundary,
      bundles: []
    });
    expect(result.kind).toBe("REJECTED");
    if (result.kind === "REJECTED") expect(result.failure.code).toBe("ENVELOPE_CHAIN_MISMATCH");
  });

  it("fails a positive-head trusted boundary with an empty candidate chain", async () => {
    const fixture = await buildRestoreFixture([{ version: "v1", value: 0.5 }]);
    const result = await restoreCanonicalSubjectFromHistoryV0({
      persisted_envelope: fixture.terminalEnvelope,
      trusted_boundary: fixture.boundary,
      bundles: []
    });
    expect(result.kind).toBe("REJECTED");
    if (result.kind === "REJECTED") {
      expect(result.failure.code).toBe("INVALID_CHAIN");
      expect(result.failure.chain_failure?.code).toBe("TRUNCATED_HISTORY");
    }
  });

  it("restores one and multiple V1 bundles with the limited V1 proof level", async () => {
    for (const steps of [[{ version: "v1" as const, value: 0.5 }], [
      { version: "v1" as const, value: 0.5 },
      { version: "v1" as const, value: 0.7 }
    ]]) {
      const fixture = await buildRestoreFixture(steps);
      const result = await restoreCanonicalSubjectFromHistoryV0({
        persisted_envelope: fixture.terminalEnvelope,
        trusted_boundary: fixture.boundary,
        bundles: fixture.bundles
      });
      expect(result.kind).toBe("RESTORED");
      if (result.kind !== "RESTORED") continue;
      const receipt = result.chain_receipt as { v1_bundle_count: number; v2_bundle_count: number };
      expect(receipt.v1_bundle_count).toBe(steps.length);
      expect(receipt.v2_bundle_count).toBe(0);
      expect(result.restored_snapshot).toStrictEqual((fixture.bundles[fixture.bundles.length - 1] as AtomicCommitBundleV1).next_snapshot);
    }
  });

  it("restores V1→V2 and multi-V2 chains with no duplicated V2 replay law", async () => {
    const fixture = await buildRestoreFixture([
      { version: "v1", value: 0.5 },
      { version: "v2", value: 0.7 },
      { version: "v2", value: 0.9 }
    ]);
    const result = await restoreCanonicalSubjectFromHistoryV0({
      persisted_envelope: fixture.terminalEnvelope,
      trusted_boundary: fixture.boundary,
      bundles: fixture.bundles
    });
    expect(result.kind).toBe("RESTORED");
    if (result.kind !== "RESTORED") return;
    const receipt = result.chain_receipt as { v1_bundle_count: number; v2_bundle_count: number };
    expect(receipt.v1_bundle_count).toBe(1);
    expect(receipt.v2_bundle_count).toBe(2);
  });

  it("fails closed on every envelope/terminal negative independently", async () => {
    const base = await buildRestoreFixture([{ version: "v1", value: 0.5 }]);
    const run = async (mutator: (envelope: PersistedSubjectEnvelopeV1) => PersistedSubjectEnvelopeV1): Promise<RestoreChainAuthorityResultV0> =>
      restoreCanonicalSubjectFromHistoryV0({
        persisted_envelope: mutator(base.terminalEnvelope),
        trusted_boundary: base.boundary,
        bundles: base.bundles
      });

    // Wrong commit_ref (envelope head mutated; hashes untouched so only the
    // runtime head binding can catch it).
    const wrongRef = await run((envelope) => ({
      ...envelope,
      commit_head: {
        ...(envelope.commit_head as unknown as Record<string, unknown>),
        commit_ref: "commit:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
      } as never
    }));
    expect(wrongRef.kind).toBe("REJECTED");
    if (wrongRef.kind === "REJECTED") expect(wrongRef.failure.code).toBe("ENVELOPE_CHAIN_MISMATCH");

    // Wrong record_checksum.
    const wrongChecksum = await run((envelope) => ({
      ...envelope,
      commit_head: {
        ...(envelope.commit_head as unknown as Record<string, unknown>),
        record_checksum: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      } as never
    }));
    expect(wrongChecksum.kind).toBe("REJECTED");

    // Wrong state_hash: runtime head/hash binding fires (the low-level
    // hash recomputation would also reject — the coordinator binds first).
    const wrongStateHash = await run((envelope) => ({
      ...envelope,
      state_hash: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as never
    }));
    expect(wrongStateHash.kind).toBe("REJECTED");
    if (wrongStateHash.kind === "REJECTED") expect(wrongStateHash.failure.code).toBe("ENVELOPE_CHAIN_MISMATCH");

    // Wrong snapshot_hash.
    const wrongSnapshotHash = await run((envelope) => ({
      ...envelope,
      snapshot_hash: "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc" as never
    }));
    expect(wrongSnapshotHash.kind).toBe("REJECTED");

    // Envelope snapshot JCS differs from the terminal snapshot (content only —
    // hashes stay stale, so the coordinator's exact-equality gate fires).
    const differentSnapshot = await run((envelope) => ({
      ...envelope,
      snapshot: { ...envelope.snapshot, identity: { ...envelope.snapshot.identity, display_name: "x" } } as never
    }));
    expect(differentSnapshot.kind).toBe("REJECTED");
    if (differentSnapshot.kind === "REJECTED") expect(differentSnapshot.failure.code).toBe("ENVELOPE_CHAIN_MISMATCH");

    // A different independently valid envelope (R0) paired with this chain.
    const otherEnvelope = await createPersistenceEnvelope({
      snapshot: stateWithRelationships(0, 0, relationshipsWith(0.9), []),
      repository_bindings: [{ repository_revision: "R0", repository_revision_hash: R0_HASH } as never],
      commit_head: null
    });
    if (!otherEnvelope.ok) throw new Error("fixture failed");
    const differentValid = await restoreCanonicalSubjectFromHistoryV0({
      persisted_envelope: otherEnvelope.value,
      trusted_boundary: base.boundary,
      bundles: base.bundles
    });
    expect(differentValid.kind).toBe("REJECTED");
    if (differentValid.kind === "REJECTED") expect(differentValid.failure.code).toBe("ENVELOPE_CHAIN_MISMATCH");

    // Exact subject mismatch.
    const wrongSubject = await run((envelope) => ({
      ...envelope,
      snapshot: {
        ...envelope.snapshot,
        identity: { ...envelope.snapshot.identity, subject_id: "subject-other" }
      } as never
    }));
    expect(wrongSubject.kind).toBe("REJECTED");
    if (wrongSubject.kind === "REJECTED") expect(wrongSubject.failure.code).toBe("ENVELOPE_CHAIN_MISMATCH");

    // Exact revision mismatch.
    const wrongRevision = await run((envelope) => ({
      ...envelope,
      snapshot: {
        ...envelope.snapshot,
        runtime_metadata: { ...envelope.snapshot.runtime_metadata, state_revision: 9 }
      } as never
    }));
    expect(wrongRevision.kind).toBe("REJECTED");
    if (wrongRevision.kind === "REJECTED") expect(wrongRevision.failure.code).toBe("ENVELOPE_CHAIN_MISMATCH");
  });

  it("enforces the repository binding terminal projection", async () => {
    const base = await buildRestoreFixture([{ version: "v1", value: 0.5 }]);
    const probe = async (
      bindings: readonly { repository_revision: string; repository_revision_hash: string }[]
    ): Promise<RestoreChainAuthorityResultV0> =>
      restoreCanonicalSubjectFromHistoryV0({
        persisted_envelope: { ...base.terminalEnvelope, repository_bindings: bindings as never } as never,
        trusted_boundary: base.boundary,
        bundles: base.bundles
      });
    const wrongHashResult = await probe([
      { repository_revision: "R0", repository_revision_hash: "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd" }
    ]);
    if (wrongHashResult.kind === "REJECTED") {
      console.log("PROBE_WH=" + wrongHashResult.failure.code + " " + JSON.stringify(wrongHashResult.failure.restore_failure ?? {}));
    }
    expect(wrongHashResult.kind).toBe("REJECTED");
    if (wrongHashResult.kind === "REJECTED") expect(wrongHashResult.failure.code).toBe("REPOSITORY_BINDING_MISMATCH");

    // Missing terminal-snapshot revision.
    const missing = await restoreCanonicalSubjectFromHistoryV0({
      persisted_envelope: { ...base.terminalEnvelope, repository_bindings: [] } as never,
      trusted_boundary: base.boundary,
      bundles: base.bundles
    });
    expect(missing.kind).toBe("REJECTED");
    if (missing.kind === "REJECTED") expect(missing.failure.code).toBe("REPOSITORY_BINDING_MISMATCH");

    // Extra envelope revision.
    const extra = await restoreCanonicalSubjectFromHistoryV0({
      persisted_envelope: {
        ...base.terminalEnvelope,
        repository_bindings: [
          { repository_revision: "R0", repository_revision_hash: R0_HASH } as never,
          { repository_revision: "R9", repository_revision_hash: R0_HASH } as never
        ]
      } as never,
      trusted_boundary: base.boundary,
      bundles: base.bundles
    });
    expect(extra.kind).toBe("REJECTED");
    if (extra.kind === "REJECTED") expect(extra.failure.code).toBe("REPOSITORY_BINDING_MISMATCH");

    // History-only extra binding on the TERMINAL bundle remains allowed: the
    // bundle is part of the chain itself (head binds its checksum) while the
    // envelope's binding projection only covers the snapshot revisions.
    const withExtra = await buildRestoreFixture([
      { version: "v1", value: 0.5, extraBindings: [{ repository_revision: "R7", repository_revision_hash: R0_HASH }] }
    ]);
    const result = await restoreCanonicalSubjectFromHistoryV0({
      persisted_envelope: withExtra.terminalEnvelope,
      trusted_boundary: withExtra.boundary,
      bundles: withExtra.bundles
    });
    expect(result.kind).toBe("RESTORED");
  });

  it("rejects host-boolean and structural-receipt attacks as INVALID_INPUT", async () => {
    const fixture = await buildRestoreFixture([{ version: "v1", value: 0.5 }]);
    // Extra commitChainVerifier key — must be rejected, never inspected/called.
    let called = false;
    const hostBoolean = await restoreCanonicalSubjectFromHistoryV0({
      persisted_envelope: fixture.terminalEnvelope,
      trusted_boundary: fixture.boundary,
      bundles: fixture.bundles,
      commitChainVerifier: () => {
        called = true;
        return true;
      }
    });
    expect(hostBoolean.kind).toBe("REJECTED");
    if (hostBoolean.kind === "REJECTED") expect(hostBoolean.failure.code).toBe("INVALID_INPUT");
    expect(called).toBe(false);

    // Structural fake chain result in an extra field — zero authority.
    const fakeReceipt = await restoreCanonicalSubjectFromHistoryV0({
      persisted_envelope: fixture.terminalEnvelope,
      trusted_boundary: fixture.boundary,
      bundles: fixture.bundles,
      chain_result: { kind: "VALID", receipt: { terminal_revision: 1 } }
    });
    expect(fakeReceipt.kind).toBe("REJECTED");
    if (fakeReceipt.kind === "REJECTED") expect(fakeReceipt.failure.code).toBe("INVALID_INPUT");
  });

  it("TOCTOU: mutating caller-owned objects after invocation cannot change the result", async () => {
    const fixture = await buildRestoreFixture([{ version: "v1", value: 0.5 }]);
    const callerEnvelope = structuredClone(fixture.terminalEnvelope) as PersistedSubjectEnvelopeV1;
    const callerBundles = structuredClone(fixture.bundles) as AtomicCommitBundleAnyVersion[];
    const pending = restoreCanonicalSubjectFromHistoryV0({
      persisted_envelope: callerEnvelope,
      trusted_boundary: fixture.boundary,
      bundles: callerBundles
    });
    // Mutate the caller-owned objects during the first async opportunity.
    callerBundles.length = 0;
    (callerEnvelope.snapshot as unknown as Record<string, unknown>)["relationships"] = "mutated";
    const result = await pending;
    expect(result.kind).toBe("RESTORED");
    if (result.kind === "RESTORED") {
      expect(result.restored_snapshot).toStrictEqual((fixture.bundles[0] as AtomicCommitBundleV1).next_snapshot);
    }
    // The coordinator never writes to caller objects (mutation above is ours).
    expect(callerBundles).toHaveLength(0);
  });

  it("is pure and deterministic: repeated restores are equivalent", async () => {
    const fixture = await buildRestoreFixture([
      { version: "v1", value: 0.5 },
      { version: "v2", value: 0.7 }
    ]);
    const first = await restoreCanonicalSubjectFromHistoryV0({
      persisted_envelope: fixture.terminalEnvelope,
      trusted_boundary: fixture.boundary,
      bundles: fixture.bundles
    });
    const second = await restoreCanonicalSubjectFromHistoryV0({
      persisted_envelope: fixture.terminalEnvelope,
      trusted_boundary: fixture.boundary,
      bundles: fixture.bundles
    });
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it("exposes the closed product surface with no bridge/issuer/bypass/factory exports", () => {
    const surface = Object.keys(runtimeIndex);
    expect(surface).toContain("restoreCanonicalSubjectFromHistoryV0");
    // RESTORE_AUTHORITY_FACTORY_SURFACE = TRUSTED_COMPOSITION_ONLY: the
    // reference-validator-capable factory is NOT root-exported.
    expect(surface).not.toContain("createRestoreChainAuthorityV0");
    expect(surface).not.toContain("RestoreChainAuthorityCompositionV0");
    expect(surface).not.toContain("buildInternalCommitChainBridgeV0");
    expect(surface).not.toContain("mintTrustedCanonicalHistoryBoundaryV0");
    const legacy = restoreFromEnvelope;
    expect(typeof legacy).toBe("function");
  });

  it("keeps the legacy low-level restore behavior unchanged", async () => {
    // Positive revision through the LOW-LEVEL API without a verifier: still
    // fail-closed (unchanged legacy semantics).
    const fixture = await buildRestoreFixture([{ version: "v1", value: 0.5 }]);
    const legacyResult = await restoreFromEnvelope(fixture.terminalEnvelope, {});
    expect(legacyResult.ok).toBe(false);
    if (!legacyResult.ok) {
      expect(legacyResult.failure.error_code).toBe("COMMIT_CHAIN_INTEGRITY_FAILURE");
    }
  });
});
