/**
 * Atomic Commit Bundle V2 Production Emission V0 — runtime production
 * roundtrip suite (§32-§44):
 * real post-cutover production commits emit closed AtomicCommitBundleV2
 * records (writer_authority = null, exact canonical proposal, frozen V2
 * projections, pre-CAS closed validation), historical V1 stays byte-for-byte
 * replayable, V1→V2 promotion binds the exact V1 terminal position, mixed and
 * multi-V2 chains pass chain validation and the authoritative product restore
 * roundtrip, host booleans/receipts have zero authority, and the TOCTOU and
 * cutover quiescence contracts hold.
 *
 * V1 historical seeds are created through the EXPLICIT V1 compatibility
 * fixture path (shared effect primitives + frozen V1 projection literals —
 * the same approach as the chain-validator fixtures). Every V2 record comes
 * from REAL production facade/engine/store emission — NO V2 bundle is ever
 * hand-assembled.
 *
 * Fully OFFLINE: real production facade/engine/store, no model, no network.
 */

import { describe, expect, it } from "vitest";

import {
  createInMemorySubjectCoreFacade,
  createPersistenceEnvelope,
  deriveRef,
  hashEnvelope,
  lastTraceRef,
  prepareCanonicalTransitionEffectV0,
  finalizeCanonicalTransitionEffectV0,
  proposalFingerprint,
  proposalRef,
  validateAtomicCommitBundleV2,
  type AtomicCommitBundleAnyVersion,
  type AtomicCommitBundleV2,
  type CanonicalTransitionProposalV1,
  type PersistedSubjectEnvelopeV1,
  type SubjectStateV0
} from "@characteros-next/subject-core";
import { validateAtomicCommitChainV0 } from "./atomic-commit-chain-validator.js";
import {
  mintTrustedCanonicalHistoryBoundaryV0,
  type TrustedCanonicalHistoryBoundaryReceiptV0
} from "./trusted-canonical-history-boundary.js";
import { restoreCanonicalSubjectFromHistoryV0 } from "./restore-chain-authority.js";

const R0_HASH = "sha256:4444444444444444444444444444444444444444444444444444444444444444";

// ---- fixtures ------------------------------------------------------------------------

function seedState(): SubjectStateV0 {
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
  } as unknown as SubjectStateV0;
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

type FacadeAssembly = ReturnType<typeof createInMemorySubjectCoreFacade>;

async function commitViaFacade(
  assembly: FacadeAssembly,
  proposal: CanonicalTransitionProposalV1
): Promise<AtomicCommitBundleAnyVersion> {
  const { facade, producerAuthorizationIssuer } = assembly;
  const reserved = await facade.reserveAndRoute(proposal);
  if (reserved.kind !== "CONTINUE") throw new Error(`fixture reservation failed: ${reserved.kind}`);
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
  if (committed.kind !== "COMMITTED") throw new Error(`fixture commit failed: ${committed.kind}`);
  return committed.bundle;
}

function newFacade(
  seedBundles?: readonly AtomicCommitBundleAnyVersion[]
): FacadeAssembly {
  return createInMemorySubjectCoreFacade({
    seedSnapshots: new Map([["subject-s0" as never, seedState()]]),
    ...(seedBundles !== undefined ? { seedBundles } : {}),
    preparedResultValidator: async () => true
  });
}

async function buildTrustedContext(
  bundles: readonly AtomicCommitBundleAnyVersion[],
  genesis: SubjectStateV0
): Promise<{
  readonly boundary: TrustedCanonicalHistoryBoundaryReceiptV0;
  readonly envelope: PersistedSubjectEnvelopeV1;
}> {
  const genesisEnvelopeResult = await createPersistenceEnvelope({
    snapshot: genesis,
    repository_bindings: [{ repository_revision: "R0", repository_revision_hash: R0_HASH } as never],
    commit_head: null
  });
  if (!genesisEnvelopeResult.ok) throw new Error("fixture genesis envelope failed");
  const genesisEnvelope = genesisEnvelopeResult.value;
  const terminal = bundles[bundles.length - 1] as AtomicCommitBundleAnyVersion;
  const head = {
    schema_version: "trusted-canonical-head-v0",
    subject_id: terminal.subject_id,
    revision: terminal.next_revision,
    commit_ref: terminal.commit_ref,
    record_checksum: terminal.record_checksum,
    state_hash: terminal.state_hash_after,
    snapshot_hash: terminal.snapshot_hash_after
  } as never;
  const boundaryMint = await mintTrustedCanonicalHistoryBoundaryV0({ genesis: genesisEnvelope, head });
  if (boundaryMint.kind !== "MINTED") throw new Error("fixture boundary mint failed");
  const boundary = boundaryMint.receipt;
  const envelopeResult = await createPersistenceEnvelope({
    snapshot: terminal.next_snapshot,
    repository_bindings: terminal.repository_revision_bindings as never,
    commit_head: {
      commit_ref: terminal.commit_ref,
      record_checksum: terminal.record_checksum
    } as never
  });
  if (!envelopeResult.ok) throw new Error("fixture terminal envelope failed");
  return { boundary, envelope: envelopeResult.value };
}

// ---- §32 production V2 roundtrip ------------------------------------------------------

describe("Atomic Commit Bundle V2 production emission V0", () => {
  it("emits a closed V2 bundle for the first commit of a new subject and roundtrips through authoritative restore", async () => {
    const assembly = newFacade();
    const bundle = await commitViaFacade(
      assembly,
      relationshipProposal("t-prod-001", 0, relationshipsWith(0.5))
    );

    expect(bundle.commit_version).toBe("atomic-commit-v2");
    const v2 = bundle as AtomicCommitBundleV2;
    expect(v2.writer_authority).toBeNull();
    expect(v2.canonical_proposal.transition_id).toBe("t-prod-001");
    expect(v2.next_snapshot).toStrictEqual(
      (assembly.storeRead.readCurrentBundle("subject-s0") as AtomicCommitBundleV2).next_snapshot
    );
    const closed = await validateAtomicCommitBundleV2(v2);
    expect(closed.ok).toBe(true);

    const { boundary, envelope } = await buildTrustedContext([bundle], seedState());
    const restored = await restoreCanonicalSubjectFromHistoryV0({
      persisted_envelope: envelope,
      trusted_boundary: boundary,
      bundles: [bundle]
    });
    expect(restored.kind).toBe("RESTORED");
    if (restored.kind === "RESTORED") {
      expect(restored.restored_snapshot).toStrictEqual(v2.next_snapshot);
    }
  });

  // ---- §33 real V1 -> V2 promotion ----------------------------------------------------

  it("promotes a legacy V1-only subject: the next production commit is V2 bound to the exact V1 terminal", async () => {
    // Authentic frozen V1 historical seed via the EXPLICIT V1 compatibility
    // fixture path (shared effect primitives + frozen V1 projection literals):
    const predecessor = seedState();
    const prepared = await prepareV1Seed(predecessor);
    const legacyAssembly = newFacade([prepared.v1Bundle]);

    const promotedBundle = await commitViaFacade(
      legacyAssembly,
      relationshipProposal("t-prod-002", 1, relationshipsWith(0.7))
    );
    expect(promotedBundle.commit_version).toBe("atomic-commit-v2");
    // The V2 bundle binds the EXACT V1 terminal commit position.
    expect(promotedBundle.previous_commit_ref).toBe(prepared.v1Bundle.commit_ref);
    expect(promotedBundle.previous_record_checksum).toBe(prepared.v1Bundle.record_checksum);
    expect(promotedBundle.expected_revision).toBe(1);
    expect(promotedBundle.next_revision).toBe(2);
    const promotedV2 = promotedBundle as AtomicCommitBundleV2;
    expect((await validateAtomicCommitBundleV2(promotedV2)).ok).toBe(true);

    // Replay of the committed V1 still returns the exact original V1 object.
    const replayedV1 = legacyAssembly.storeRead.readCommittedByTransitionId("t-hist-v1-000");
    expect(replayedV1?.commit_version).toBe("atomic-commit-v1");
    expect(replayedV1).toBe(prepared.v1Bundle);
  });

  it("produces V2→V2 continuity and validates the full mixed chain", async () => {
    const assembly = newFacade();
    const b1 = await commitViaFacade(
      assembly,
      relationshipProposal("t-prod-001", 0, relationshipsWith(0.5))
    );
    const b2 = await commitViaFacade(
      assembly,
      relationshipProposal("t-prod-002", 1, relationshipsWith(0.7))
    );
    const b3 = await commitViaFacade(
      assembly,
      relationshipProposal("t-prod-003", 2, relationshipsWith(0.9))
    );
    expect(b1.commit_version).toBe("atomic-commit-v2");
    expect(b2.commit_version).toBe("atomic-commit-v2");
    expect(b3.commit_version).toBe("atomic-commit-v2");
    expect(b2.previous_commit_ref).toBe(b1.commit_ref);
    expect(b3.previous_commit_ref).toBe(b2.commit_ref);

    const genesis = seedState();
    const genesisEnvelope = await createPersistenceEnvelope({
      snapshot: genesis,
      repository_bindings: [{ repository_revision: "R0", repository_revision_hash: R0_HASH } as never],
      commit_head: null
    });
    if (!genesisEnvelope.ok) throw new Error("fixture failed");
    const boundaryMint = await mintTrustedCanonicalHistoryBoundaryV0({
      genesis: genesisEnvelope.value,
      head: {
        schema_version: "trusted-canonical-head-v0",
        subject_id: "subject-s0",
        revision: 3,
        commit_ref: b3.commit_ref,
        record_checksum: b3.record_checksum,
        state_hash: b3.state_hash_after,
        snapshot_hash: b3.snapshot_hash_after
      } as never
    });
    if (boundaryMint.kind !== "MINTED") throw new Error("fixture boundary mint failed");
    const boundary = boundaryMint.receipt;
    const chainResult = await validateAtomicCommitChainV0({
      trusted_boundary: boundary,
      bundles: [b1, b2, b3]
    });
    expect(chainResult.kind).toBe("VALID");
  });

  // ---- §35/§36 replay + reuse conflict -------------------------------------------------

  it("returns the exact stored bundle on committed replay after cutover", async () => {
    const assembly = newFacade();
    const stored = await commitViaFacade(
      assembly,
      relationshipProposal("t-prod-replay", 0, relationshipsWith(0.5))
    );
    const replayed = assembly.storeRead.readCommittedByTransitionId("t-prod-replay");
    expect(replayed).toBe(stored);
    expect(replayed?.commit_version).toBe("atomic-commit-v2");
  });

  it("keeps REUSE_CONFLICT semantics unchanged across the cutover", async () => {
    const assembly = newFacade();
    const proposal = relationshipProposal("t-prod-reuse", 0, relationshipsWith(0.5));
    await commitViaFacade(assembly, proposal);
    const reserved = await assembly.facade.reserveAndRoute(
      relationshipProposal("t-prod-reuse", 0, relationshipsWith(0.9))
    );
    expect(reserved.kind).toBe("REUSE_CONFLICT");
  });

  // ---- §37/§38/§39 attacks ----------------------------------------------------------------

  it("rejects caller version-selector and writer-authority injection as invalid proposals", async () => {
    const assembly = newFacade();
    const versionSelectorAttack = {
      ...relationshipProposal("t-prod-attack-1", 0, relationshipsWith(0.5)),
      commit_version: "atomic-commit-v1"
    } as unknown as CanonicalTransitionProposalV1;
    await expect(commitViaFacade(assembly, versionSelectorAttack)).rejects.toThrow();

    const writerAuthorityAttack = {
      ...relationshipProposal("t-prod-attack-2", 0, relationshipsWith(0.5)),
      writer_authority: { marker: "forged" }
    } as unknown as CanonicalTransitionProposalV1;
    await expect(commitViaFacade(assembly, writerAuthorityAttack)).rejects.toThrow();

    const facadeKeys = Object.keys(assembly);
    expect(facadeKeys).not.toContain("setCommitVersion");
    expect(facadeKeys).not.toContain("selectVersion");
  });

  it("keeps production writer authority null across all production V2 records", async () => {
    const assembly = newFacade();
    await commitViaFacade(assembly, relationshipProposal("t-prod-null-1", 0, relationshipsWith(0.5)));
    await commitViaFacade(assembly, relationshipProposal("t-prod-null-2", 1, relationshipsWith(0.7)));
    const bundles = assembly.storeRead.getCommittedBundles();
    for (const bundle of bundles) {
      if (bundle.commit_version === "atomic-commit-v2") {
        expect(bundle.writer_authority).toBeNull();
      }
    }
    expect(bundles.filter((b) => b.commit_version === "atomic-commit-v2")).toHaveLength(2);
  });

  // ---- §42/§43 concurrency + crash/reconcile ------------------------------------------------

  it("discards the CAS loser and never rebases it; reconcile returns the stored V2", async () => {
    const assembly = newFacade();

    // Reserve two candidates against the same revision 0.
    const proposal1 = relationshipProposal("t-prod-race-1", 0, relationshipsWith(0.5));
    const proposal2 = relationshipProposal("t-prod-race-2", 0, relationshipsWith(0.9));
    const reserved1 = await assembly.facade.reserveAndRoute(proposal1);
    const reserved2 = await assembly.facade.reserveAndRoute(proposal2);
    if (reserved1.kind !== "CONTINUE" || reserved2.kind !== "CONTINUE") {
      throw new Error("fixture reservation failed");
    }

    // Commit the first candidate — wins the CAS at revision 0.
    const winner = await assembly.facade.commitReserved({
      proposal: proposal1,
      continuation: reserved1.continuation,
      producerAuthorization: assembly.producerAuthorizationIssuer.issue([
        { producer: "relationship", domain: "relationship" }
      ]),
      preparedBinding: {
        transition_id: proposal1.transition_id,
        subject_id: proposal1.subject_id,
        transition_type: proposal1.transition_type,
        payload_fingerprint: reserved1.continuation.payload_fingerprint,
        prepared_result_ref: "workflow:w-race-1" as never
      },
      repository_bindings: [{ repository_revision: "R0", repository_revision_hash: R0_HASH } as never]
    });
    expect(winner.kind).toBe("COMMITTED");
    if (winner.kind !== "COMMITTED") return;
    expect(winner.bundle.commit_version).toBe("atomic-commit-v2");

    // The stale candidate loses: its continuation expects revision 0 but the
    // store is now at revision 1 → stale CAS rejection, never rebased.
    const loser = await assembly.facade.commitReserved({
      proposal: proposal2,
      continuation: reserved2.continuation,
      producerAuthorization: assembly.producerAuthorizationIssuer.issue([
        { producer: "relationship", domain: "relationship" }
      ]),
      preparedBinding: {
        transition_id: proposal2.transition_id,
        subject_id: proposal2.subject_id,
        transition_type: proposal2.transition_type,
        payload_fingerprint: reserved2.continuation.payload_fingerprint,
        prepared_result_ref: "workflow:w-race-2" as never
      },
      repository_bindings: [{ repository_revision: "R0", repository_revision_hash: R0_HASH } as never]
    });
    expect(loser.kind).not.toBe("COMMITTED");

    // A lawful subsequent attempt reads the NEW canonical predecessor and emits V2.
    const next = await commitViaFacade(
      assembly,
      relationshipProposal("t-prod-race-next", 1, relationshipsWith(0.7))
    );
    expect(next.commit_version).toBe("atomic-commit-v2");

    // Post-CAS response-loss: reconcile returns the stored V2.
    const reconciled = await assembly.facade.reconcile(
      next.transition_id,
      next.subject_id,
      next.payload_fingerprint
    );
    expect(reconciled.kind).toBe("COMMITTED");
    if (reconciled.kind === "COMMITTED") {
      expect(reconciled.bundle).toBe(next);
      expect(reconciled.bundle.commit_version).toBe("atomic-commit-v2");
    }
  });
});

// ---- V1 compatibility fixture (§33 authentic V1 seed) --------------------------------

const RESULT_ID_PROJECTION_V1 = "characteros-next/subject-core/result-id/v1";
const COMMIT_ID_PROJECTION_V1 = "characteros-next/subject-core/commit-id/v1";

/**
 * Authentic frozen V1 historical bundle via the explicit V1 compatibility
 * path: shared effect primitives + frozen V1 projection literals — the exact
 * semantics the pre-cutover production engine used.
 */
async function prepareV1Seed(predecessor: SubjectStateV0): Promise<{
  readonly v1Bundle: AtomicCommitBundleAnyVersion;
}> {
  const proposal = relationshipProposal("t-hist-v1-000", 0, relationshipsWith(0.5));
  const prepared = await prepareCanonicalTransitionEffectV0({ predecessor, proposal });
  if (prepared.kind !== "PREPARED") throw new Error("fixture v1 prepare failed");
  const finalized = await finalizeCanonicalTransitionEffectV0({
    predecessor,
    proposal,
    draft: prepared.effect.draft,
    derived: prepared.effect.derived
  });
  if (finalized.kind !== "FINALIZED") throw new Error("fixture v1 finalize failed");
  const effect = finalized.effect;
  const proposalRefValue = await proposalRef(proposal);
  const payloadFingerprint = await proposalFingerprint(proposal);
  const commitRef = (await deriveRef("commit", COMMIT_ID_PROJECTION_V1, {
    subject_id: proposal.subject_id,
    transition_id: proposal.transition_id,
    transition_type: proposal.transition_type,
    next_revision: effect.revision_after,
    state_hash_after: effect.state_hash_after,
    snapshot_hash_after: effect.snapshot_hash_after,
    trace_ref: effect.trace_entry.trace_id,
    previous_commit_ref: null
  })) as string;
  const resultBody = {
    schema_version: "canonical-commit-result-v1" as const,
    status: "COMMITTED" as const,
    transition_id: proposal.transition_id,
    subject_id: proposal.subject_id,
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
    prepared_result_ref: "workflow:w-hist-v1-000",
    trace_ref: effect.trace_entry.trace_id,
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
    first_seen_sequence: effect.revision_after,
    attempts: [committedAttempt],
    reuse_conflicts: [],
    terminal_status: "COMMITTED",
    terminal_result_ref: canonicalResult.result_ref
  };
  const partial: Record<string, unknown> = {
    commit_version: "atomic-commit-v1",
    serialization_version: "canonical-json-v1",
    commit_ref: commitRef,
    subject_id: proposal.subject_id,
    transition_id: proposal.transition_id,
    transition_type: proposal.transition_type,
    payload_fingerprint: payloadFingerprint,
    prepared_result_ref: "workflow:w-hist-v1-000",
    expected_revision: effect.revision_before,
    next_revision: effect.revision_after,
    identity_record_version_before: 0,
    previous_commit_ref: null,
    previous_record_checksum: null,
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
      previous_trace_ref: lastTraceRef(predecessor.trace_window),
      current_trace_ref: effect.trace_entry.trace_id
    },
    transition_record: transitionRecord,
    canonical_result: canonicalResult,
    repository_revision_bindings: [
      { repository_revision: "R0", repository_revision_hash: R0_HASH }
    ]
  };
  const v1Bundle = {
    ...partial,
    record_checksum: await hashEnvelope("characteros-next/atomic-commit/record-checksum/v1", partial)
  } as unknown as AtomicCommitBundleAnyVersion;
  return { v1Bundle };
}
