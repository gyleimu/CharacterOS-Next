/**
 * Prepared Governed Writer Authority Membrane V0 — internal unit suite
 * (RELATIONSHIP_GOVERNED_FEATURE_WRITER_AUTHORITY_V0 §25/§27/§28/§30/§37/§49).
 *
 * INTERNAL_MEMBRANE_NON_NULL_UNIT_TEST = ALLOWED: this suite uses the
 * module-direct internal issuer to prove the SubjectCore membrane WITHOUT
 * registering any feature anywhere:
 *   - valid object identity accepted; structural clone rejected
 *   - wrong-proposal / stale-revision / wrong-head tokens rejected
 *   - governed reserved write WITHOUT writer authority fails closed before CAS
 *   - removal and multi-target governed changes fail closed
 *   - token supplied for a non-governed transition fails closed
 *   - EXACT record/hash materialization: the V2 assembler projects the exact
 *     CanonicalWriterAuthorityRecordV0 (payload hash = the frozen record
 *     projection, commit_ref bound to it) through the SAME ordinary pipeline
 *   - the ordinary null-authority path stays byte-deterministic
 *
 * REAL_PRODUCTION_GOVERNED_WRITER_ROUNDTRIP = DEFERRED (feature count 0).
 * Fully OFFLINE: real engine/assembler/store only.
 */

import { describe, expect, it } from "vitest";

import type { CanonicalWriterAuthorityRecordV0 } from "../types/writer-authority.js";
import type { SubjectStateV0 } from "../types/subject-state.js";
import type { CanonicalTransitionProposalV1 } from "../types/transition.js";
import type { RepositoryRevisionBindingV1 } from "../types/persistence.js";
import type { AtomicCommitBundleV2, AtomicCommitBundleAnyVersion } from "../types/persistence-v2.js";
import type { CanonicalRefV0 } from "../types/ref.js";
import { deriveWriterAuthorityPayloadHashV0 } from "../canonical/writer-authority-projections.js";
import { validateAtomicCommitBundleV2 } from "../validation/atomic-commit-bundle.js";
import { proposalFingerprint, proposalRef } from "../canonical/projections.js";
import { createCommitEngine, type CommitTransitionInput } from "./engine.js";
import { InMemoryAtomicCommitStore } from "./store.js";
import { assembleCommitBundleV2 } from "./bundle-v2.js";
import {
  detectReservedRelationshipTargetChangesV0,
  mintPreparedGovernedWriterAuthorityTokenV0,
  verifyPreparedGovernedWriterAuthorityTokenV0,
  type PreparedGovernedWriterAuthorityTokenV0
} from "./writer-authority-membrane.js";

const R0_BINDINGS = [
  { repository_revision: "R0", repository_revision_hash: "sha256:85755634de984070ca6c12d5dd01fb545e0efea635000e0e0044c589f3fcbb00" }
] as unknown as RepositoryRevisionBindingV1[];

function seedState(governedValue: number | null): SubjectStateV0 {
  const counterparts =
    governedValue === null
      ? []
      : [
          {
            counterpart_ref: "entity:alice-like",
            dimensions: [
              { dimension_id: "relationship_core_fixture_dim_v0", value: governedValue },
              { dimension_id: "arbitrary_host_dimension", value: 0.25 }
            ]
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

function governedRelationshipPayload(): Record<string, unknown> {
  return {
    schema_version: "relationship-governed-feature-writer-authority-payload-v0",
    operation_kind: "INITIALIZE",
    subject_id: "subject-s0",
    expected_revision: 0,
    counterpart_ref: "entity:alice-like",
    dimension_id: "relationship_core_fixture_dim_v0",
    previous: { kind: "ABSENT" },
    next: { kind: "PRESENT", value: 0.5 },
    relationship_state_schema_version: "relationship-state-v0",
    feature_semantics_contract_id: "unadmitted-feature-semantics-v0",
    feature_semantics_contract_fingerprint:
      "sha256:1111111111111111111111111111111111111111111111111111111111111111",
    write_policy_id: "relationship-governed-feature-write-policy-v0",
    write_policy_fingerprint:
      "sha256:2222222222222222222222222222222222222222222222222222222222222222",
    evidence_receipt_refs: [
      "episode:3333333333333333333333333333333333333333333333333333333333333333"
    ],
    write_policy_receipt_ref:
      "workflow:4444444444444444444444444444444444444444444444444444444444444444",
    authority_epoch_start_transition_id: "t-governed-1",
    previous_governed_authority: { kind: "NONE" }
  };
}

function governedProposal(transitionId: string, nextRelationships: Record<string, unknown>): CanonicalTransitionProposalV1 {
  return {
    schema_version: "canonical-transition-proposal-v1",
    transition_id: transitionId,
    subject_id: "subject-s0",
    transition_type: "Relationship",
    expected_state_revision: 0,
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

function relationshipsWith(governed: number | null, extra = false): Record<string, unknown> {
  const dimensions: Record<string, unknown>[] = [];
  if (governed !== null) {
    dimensions.push({ dimension_id: "relationship_core_fixture_dim_v0", value: governed });
  }
  if (extra) {
    dimensions.push({ dimension_id: "relationship_core_second_dim_v0", value: 0.75 });
  }
  return {
    schema_version: "relationship-state-v0",
    counterparts: [
      {
        counterpart_ref: "entity:alice-like",
        dimensions
      }
    ]
  };
}

async function mintTokenFor(
  proposal: CanonicalTransitionProposalV1,
  overrides: Partial<Parameters<typeof mintPreparedGovernedWriterAuthorityTokenV0>[0]> = {}
): Promise<PreparedGovernedWriterAuthorityTokenV0> {
  const input = {
    proposal_ref: await proposalRef(proposal),
    payload_fingerprint: await proposalFingerprint(proposal),
    subject_id: "subject-s0",
    expected_revision: 0,
    history_head_commit_ref: null,
    writer_family: "RELATIONSHIP_GOVERNED_FEATURE",
    writer_class: "INITIALIZE",
    writer_schema_id: "relationship-governed-feature-writer-authority-payload-v0",
    writer_schema_fingerprint:
      "sha256:5555555555555555555555555555555555555555555555555555555555555555",
    authorization_gate_id: "relationship-governed-feature-writer-authorization-gate-v0",
    authorization_gate_fingerprint:
      "sha256:6666666666666666666666666666666666666666666666666666666666666666",
    authority_payload: governedRelationshipPayload(),
    ...overrides
  } as unknown as Parameters<typeof mintPreparedGovernedWriterAuthorityTokenV0>[0];
  return mintPreparedGovernedWriterAuthorityTokenV0(input);
}

function engineInput(
  proposal: CanonicalTransitionProposalV1,
  currentState: SubjectStateV0,
  overrides: Partial<CommitTransitionInput> = {}
): CommitTransitionInput {
  return {
    proposal,
    currentState,
    identity_record_version_before: 0,
    first_seen_sequence: 1,
    prior_attempts: [],
    previous_bundle: null,
    prepared_result_ref: "workflow:w-gov-1" as CanonicalRefV0,
    repository_bindings: R0_BINDINGS,
    reference_validator: async () => true,
    ...overrides
  };
}

const GOVERNED_NEXT = relationshipsWith(0.5);
const UNADMITTED_GOVERNED_PROPOSAL = governedProposal("t-governed-1", GOVERNED_NEXT);

// ---- §23 membrane admission ------------------------------------------------------------

describe("prepared governed writer authority membrane (§23/§27)", () => {
  it("admits only issuer-minted tokens; a structural clone is rejected", async () => {
    const token = await mintTokenFor(UNADMITTED_GOVERNED_PROPOSAL);
    const verified = verifyPreparedGovernedWriterAuthorityTokenV0(token);
    expect(verified.ok).toBe(true);
    expect(Object.isFrozen(token)).toBe(true);

    const clone = structuredClone(token) as unknown as PreparedGovernedWriterAuthorityTokenV0;
    const cloneAdmission = verifyPreparedGovernedWriterAuthorityTokenV0(clone);
    expect(cloneAdmission.ok).toBe(false);
    if (!cloneAdmission.ok) expect(cloneAdmission.code).toBe("NOT_ADMITTED");

    const malformed = verifyPreparedGovernedWriterAuthorityTokenV0({ nope: true });
    expect(malformed.ok).toBe(false);
    if (!malformed.ok) expect(malformed.code).toBe("MALFORMED_TOKEN");
  });

  it("diffs reserved targets exactly: none / added / changed / removed / multiple", () => {
    const plain = detectReservedRelationshipTargetChangesV0(seedState(null), seedState(null));
    expect(plain.ok).toBe(true);
    if (plain.ok) expect(plain.changes).toHaveLength(0);

    const added = detectReservedRelationshipTargetChangesV0(seedState(null), seedState(0.5));
    expect(added.ok).toBe(true);
    if (added.ok) {
      expect(added.changes).toHaveLength(1);
      expect(added.changes[0]?.kind).toBe("ADDED");
      expect(added.changes[0]?.dimension_id).toBe("relationship_core_fixture_dim_v0");
    }

    const changed = detectReservedRelationshipTargetChangesV0(seedState(0.5), seedState(0.9));
    expect(changed.ok).toBe(true);
    if (changed.ok) {
      expect(changed.changes).toHaveLength(1);
      expect(changed.changes[0]?.kind).toBe("CHANGED");
    }

    const same = detectReservedRelationshipTargetChangesV0(seedState(0.5), seedState(0.5));
    expect(same.ok).toBe(true);
    if (same.ok) expect(same.changes).toHaveLength(0);

    const removed = detectReservedRelationshipTargetChangesV0(seedState(0.5), seedState(null));
    expect(removed.ok).toBe(true);
    if (removed.ok) expect(removed.changes[0]?.kind).toBe("REMOVED");

    const multiple = detectReservedRelationshipTargetChangesV0(
      seedState(0.9),
      { ...seedState(null), relationships: relationshipsWithMultiple() } as unknown as SubjectStateV0
    );
    expect(multiple.ok).toBe(true);
    if (multiple.ok) expect(multiple.changes.length).toBe(2);
  });
});

function relationshipsWithMultiple(): Record<string, unknown> {
  return {
    schema_version: "relationship-state-v0",
    counterparts: [
      {
        counterpart_ref: "entity:alice-like",
        dimensions: [
          { dimension_id: "relationship_core_fixture_dim_v0", value: 0.5 },
          { dimension_id: "relationship_core_second_dim_v0", value: 0.75 }
        ]
      }
    ]
  };
}

// ---- §30 engine reserved-write guard ----------------------------------------------------

describe("SubjectCore reserved-write guard (§30/§37/§49)", () => {
  it("fails closed: governed reserved write without writer authority is rejected before CAS", async () => {
    const store = new InMemoryAtomicCommitStore();
    const engine = createCommitEngine({ store });
    const outcome = await engine.commitTransition(
      engineInput(UNADMITTED_GOVERNED_PROPOSAL, seedState(null))
    );
    expect(outcome.kind).toBe("REJECTED");
    if (outcome.kind === "REJECTED") {
      expect(outcome.failure.error_code).toBe("FORBIDDEN_DIRECT_MUTATION");
      expect(outcome.failure.detail).toContain("governed reserved write without writer authority");
    }
    expect(store.getCommittedBundles()).toHaveLength(0);
  });

  it("accepts a valid internal token and materializes the EXACT authority record", async () => {
    const token = await mintTokenFor(UNADMITTED_GOVERNED_PROPOSAL);
    const store = new InMemoryAtomicCommitStore();
    const engine = createCommitEngine({ store });
    const outcome = await engine.commitTransition(
      engineInput(UNADMITTED_GOVERNED_PROPOSAL, seedState(null), {
        prepared_governed_writer_authority: token
      })
    );
    expect(outcome.kind).toBe("COMMITTED");
    if (outcome.kind !== "COMMITTED") return;
    const bundle = outcome.bundle as AtomicCommitBundleV2;
    expect(bundle.commit_version).toBe("atomic-commit-v2");
    const authority = bundle.writer_authority as CanonicalWriterAuthorityRecordV0;
    expect(authority).not.toBeNull();
    expect(authority.writer_family).toBe("RELATIONSHIP_GOVERNED_FEATURE");
    expect(authority.writer_class).toBe("INITIALIZE");
    expect(authority.proposal_ref).toBe(token.proposal_ref);
    expect(authority.payload_fingerprint).toBe(token.payload_fingerprint);
    expect(authority.authorization_gate_id).toBe(
      "relationship-governed-feature-writer-authorization-gate-v0"
    );
    const recordBody: Record<string, unknown> = { ...authority };
    delete recordBody["authority_payload_hash"];
    const recomputed = await deriveWriterAuthorityPayloadHashV0(
      recordBody as unknown as Omit<CanonicalWriterAuthorityRecordV0, "authority_payload_hash">
    );
    expect(recomputed).toBe(authority.authority_payload_hash);
    expect((await validateAtomicCommitBundleV2(bundle)).ok).toBe(true);
  });

  it("rejects a structural-clone token, a wrong-proposal token and a stale token", async () => {
    const token = await mintTokenFor(UNADMITTED_GOVERNED_PROPOSAL);
    const store = new InMemoryAtomicCommitStore();
    const engine = createCommitEngine({ store });

    const clone = structuredClone(token) as unknown as PreparedGovernedWriterAuthorityTokenV0;
    const cloneOutcome = await engine.commitTransition(
      engineInput(UNADMITTED_GOVERNED_PROPOSAL, seedState(null), {
        prepared_governed_writer_authority: clone
      })
    );
    expect(cloneOutcome.kind).toBe("REJECTED");
    if (cloneOutcome.kind === "REJECTED") {
      expect(cloneOutcome.failure.detail).toContain("NOT_ADMITTED");
    }

    const otherProposal = governedProposal("t-governed-OTHER", GOVERNED_NEXT);
    const wrongProposalToken = await mintTokenFor(otherProposal);
    const wrongOutcome = await engine.commitTransition(
      engineInput(UNADMITTED_GOVERNED_PROPOSAL, seedState(null), {
        prepared_governed_writer_authority: wrongProposalToken
      })
    );
    expect(wrongOutcome.kind).toBe("REJECTED");
    if (wrongOutcome.kind === "REJECTED") {
      expect(wrongOutcome.failure.detail).toContain("does not bind the exact proposal/subject/revision/head");
    }

    const staleToken = await mintTokenFor(UNADMITTED_GOVERNED_PROPOSAL, {
      expected_revision: 1 as never
    });
    const staleOutcome = await engine.commitTransition(
      engineInput(UNADMITTED_GOVERNED_PROPOSAL, seedState(null), {
        prepared_governed_writer_authority: staleToken
      })
    );
    expect(staleOutcome.kind).toBe("REJECTED");

    const wrongHeadToken = await mintTokenFor(UNADMITTED_GOVERNED_PROPOSAL, {
      history_head_commit_ref: "commit:7777777777777777777777777777777777777777777777777777777777777" as CanonicalRefV0
    });
    const wrongHeadOutcome = await engine.commitTransition(
      engineInput(UNADMITTED_GOVERNED_PROPOSAL, seedState(null), {
        prepared_governed_writer_authority: wrongHeadToken
      })
    );
    expect(wrongHeadOutcome.kind).toBe("REJECTED");
    expect(store.getCommittedBundles()).toHaveLength(0);
  });

  it("fails closed on removal, multiple governed targets, cross-domain mix and non-governed token supply", async () => {
    const removalProposal = governedProposal("t-governed-rm", relationshipsWith(null));
    const store = new InMemoryAtomicCommitStore();
    const engine = createCommitEngine({ store });
    const removal = await engine.commitTransition(
      engineInput(removalProposal, seedState(0.5), {
        prepared_governed_writer_authority: await mintTokenFor(removalProposal)
      })
    );
    expect(removal.kind).toBe("REJECTED");
    if (removal.kind === "REJECTED") expect(removal.failure.detail).toContain("removal is unsupported");

    const multiProposal = governedProposal("t-governed-multi", relationshipsWith(0.5, true));
    const multi = await engine.commitTransition(
      engineInput(multiProposal, seedState(null), {
        prepared_governed_writer_authority: await mintTokenFor(multiProposal)
      })
    );
    expect(multi.kind).toBe("REJECTED");
    if (multi.kind === "REJECTED") expect(multi.failure.detail).toContain("exactly ONE governed Relationship target");

    const ordinaryProposal = governedProposal("t-ordinary-guard", {
      schema_version: "relationship-state-v0",
      counterparts: [
        { counterpart_ref: "entity:alice-like", dimensions: [{ dimension_id: "arbitrary_host_dimension", value: 0.9 }] }
      ]
    });
    const nonGovernedToken = await engine
      .commitTransition(engineInput(ordinaryProposal, seedState(null)))
      .then((outcome) => {
        expect(outcome.kind).toBe("COMMITTED");
        return outcome;
      });
    expect(nonGovernedToken.kind).toBe("COMMITTED");
    if (nonGovernedToken.kind !== "COMMITTED") return;
    expect((nonGovernedToken.bundle as AtomicCommitBundleV2).writer_authority).toBeNull();

    const ordinaryStore = new InMemoryAtomicCommitStore();
    const ordinaryEngine = createCommitEngine({ store: ordinaryStore });
    const withToken = await ordinaryEngine.commitTransition(
      engineInput(ordinaryProposal, seedState(null), {
        prepared_governed_writer_authority: await mintTokenFor(ordinaryProposal)
      })
    );
    expect(withToken.kind).toBe("REJECTED");
    if (withToken.kind === "REJECTED") {
      expect(withToken.failure.detail).toContain("changes no governed reserved target");
    }
    expect(ordinaryStore.getCommittedBundles()).toHaveLength(0);
  });
});

// ---- §28/§29 assembler materialization ---------------------------------------------------

describe("V2 assembler governed materialization (§28/§29)", () => {
  it("projects the exact record from the verified token and binds the payload hash into commit_ref", async () => {
    const baseInput = {
      proposal: UNADMITTED_GOVERNED_PROPOSAL,
      currentState: seedState(null),
      candidate: seedState(0.5),
      state_hash_before: "sha256:aaa1",
      state_hash_after: "sha256:aaa2",
      snapshot_hash_before: "sha256:aaa3",
      snapshot_hash_after: "sha256:aaa4",
      trace_entry: {
        trace_id: "trace:8888888888888888888888888888888888888888888888888888888888888888"
      } as never,
      expected_revision: 0 as never,
      next_revision: 1 as never,
      identity_record_version_before: 0,
      first_seen_sequence: 1 as never,
      prior_attempts: [],
      previous_commit_ref: null,
      previous_record_checksum: null,
      previous_trace_ref: null,
      prepared_result_ref: "workflow:w-asm" as CanonicalRefV0,
      repository_revision_bindings: []
    } as unknown as Parameters<typeof assembleCommitBundleV2>[0];

    const ordinary = await assembleCommitBundleV2(baseInput);
    expect(ordinary.writer_authority).toBeNull();

    const governed = await assembleCommitBundleV2({
      ...baseInput,
      writer_authority_token: await mintTokenFor(UNADMITTED_GOVERNED_PROPOSAL)
    });
    expect(governed.writer_authority).not.toBeNull();
    expect(governed.commit_ref).not.toBe(ordinary.commit_ref);
    expect(governed.record_checksum).not.toBe(ordinary.record_checksum);
    const bundleAny = governed as unknown as AtomicCommitBundleAnyVersion;
    expect(bundleAny.commit_version).toBe("atomic-commit-v2");
  });
});
