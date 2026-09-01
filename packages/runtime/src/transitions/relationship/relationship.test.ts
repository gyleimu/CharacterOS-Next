/**
 * RelationshipState V0 Foundation acceptance suite (RF1–RF60).
 *
 * `test_trust_like` and `test_closeness_like` are NON_SCIENTIFIC_TEST_FIXTURE
 * identifiers only. No production dimension catalog or update psychology exists.
 */

import { describe, expect, it } from "vitest";
import {
  createInMemorySubjectCoreFacade,
  createPersistenceEnvelope,
  restoreFromEnvelope,
  stateHash,
  validateIdentifier,
  validateLogicalTime,
  validateRelationshipState,
  validateStateRevision,
  validateSubjectState,
  type InMemoryFacadeAssembly,
  type ProducerAuthorizationIssuer,
  type SubjectStateV0,
  type ValidationResult
} from "@characteros-next/subject-core";
import {
  InMemoryMemoryRepository,
  parseEpisodeRef,
  type EpisodeRef,
  type MemoryPreparationAuthority
} from "@characteros-next/memory";
import type { SubjectCorePort } from "../../ports/subject-core-port.js";
import type { RuntimeContext } from "../../types/runtime-context.js";
import { s0 } from "../observation/observation-fixtures.js";
import {
  initializeEmptyRelationshipState,
  initializeRelationshipState
} from "./relationship-init.js";
import {
  deriveRelationshipEvidenceMemberSetFingerprint,
  deriveRelationshipTransitionId,
  validateRelationshipUpdateProposal,
  type RelationshipUpdateProposalV0
} from "./relationship-update-proposal.js";
import { RelationshipTransitionExecutor } from "./relationship-transition-executor.js";

const SUBJECT_ID = "subject-s0";
const ALICE = "entity:alice-like";
const BOB = "subject:bob-like";
const CHARLIE = "entity:charlie-like";
const EPISODE_A = "episode:evidence-a";
const EPISODE_B = "episode:evidence-b";
const EPISODE_C = "episode:evidence-c";
const EPISODE_NEWER = "episode:evidence-newer";
const EPISODE_MISSING = "episode:evidence-missing";

function requireOk<T>(result: ValidationResult<T>): T {
  if (!result.ok) throw new Error(result.error.detail);
  return result.value;
}

function episodeRef(raw: string): EpisodeRef {
  return requireOk(parseEpisodeRef(raw, "fixture.episode_ref"));
}

function relationshipContext(stateRevision = 0): RuntimeContext {
  return {
    subject_id: requireOk(validateIdentifier(SUBJECT_ID, "ctx.subject_id")),
    current_logical_time: requireOk(validateLogicalTime(0, "ctx.current_logical_time")),
    state_revision: requireOk(validateStateRevision(stateRevision, "ctx.state_revision"))
  };
}

interface TestCore extends SubjectCorePort {
  readonly issuer: ProducerAuthorizationIssuer;
  readonly storeRead: {
    readCurrentBundle(subjectId: string): { next_snapshot: SubjectStateV0 } | null;
    getCommittedBundles(): readonly {
      next_snapshot: SubjectStateV0;
      transition_type: string;
    }[];
  };
}

function createTestCore(
  snapshot: SubjectStateV0,
  memory: InMemoryMemoryRepository
): TestCore {
  const assembly: InMemoryFacadeAssembly = createInMemorySubjectCoreFacade({
    seedSnapshots: new Map([[SUBJECT_ID as never, snapshot]]),
    preparedResultValidator: async (binding) =>
      binding.prepared_result_ref.startsWith("workflow:"),
    referenceValidator: async (binding) =>
      memory.validateRevisionBinding(
        binding as unknown as Parameters<
          MemoryPreparationAuthority["validateRevisionBinding"]
        >[0]
      ),
    memoryAdoptionValidator: async (adoption) => {
      if (adoption.next_repository_revision_hash === null) return false;
      return memory.validateRevisionBinding({
        repository_revision: adoption.next_repository_revision,
        repository_revision_hash: adoption.next_repository_revision_hash
      } as unknown as Parameters<MemoryPreparationAuthority["validateRevisionBinding"]>[0]);
    }
  });
  const port: SubjectCorePort = {
    reserveAndRoute: (proposal) => assembly.facade.reserveAndRoute(proposal),
    commitReserved: (input) => assembly.facade.commitReserved(input),
    terminalizeReservedNoOp: (input) => assembly.facade.terminalizeReservedNoOp(input),
    reconcile: (transitionId, subjectId, fingerprint) =>
      assembly.facade.reconcile(transitionId, subjectId, fingerprint),
    readCurrentSnapshot: async (subjectId) => {
      const bundle = assembly.storeRead.readCurrentBundle(subjectId);
      return bundle === null ? snapshot : bundle.next_snapshot;
    }
  };
  return {
    ...port,
    issuer: assembly.producerAuthorizationIssuer,
    storeRead: assembly.storeRead
  };
}

function fixtureState(): SubjectStateV0 {
  const base = s0() as unknown as SubjectStateV0;
  return {
    ...base,
    memory_state: { ...base.memory_state, repository_revision: "R1" as never },
    relationships: initializeRelationshipState([
      {
        counterpart_ref: ALICE as never,
        dimensions: [
          { dimension_id: "test_closeness_like" as never, value: 0.4 as never },
          { dimension_id: "test_trust_like" as never, value: 0.6 as never }
        ]
      },
      {
        counterpart_ref: BOB as never,
        dimensions: [
          { dimension_id: "test_trust_like" as never, value: 0.8 as never }
        ]
      }
    ])
  };
}

function buildWorld() {
  const memory = new InMemoryMemoryRepository();
  void memory.prepareRevision({ parent_revision: null, records: [] });
  void memory.prepareRevision({
    parent_revision: "R0" as never,
    records: [EPISODE_A, EPISODE_B, EPISODE_C].map((ref, index) => ({
      ref,
      payload_hash: `sha256:${String(index + 1).repeat(64)}`
    })) as never
  });
  void memory.prepareRevision({
    parent_revision: "R1" as never,
    records: [
      {
        ref: EPISODE_NEWER,
        payload_hash: `sha256:${"f".repeat(64)}`
      }
    ] as never
  });
  const initial = fixtureState();
  const core = createTestCore(initial, memory);
  const executor = new RelationshipTransitionExecutor({
    subjectCore: core,
    issuer: core.issuer,
    memoryRepository: memory
  });
  return { initial, memory, core, executor };
}

interface ProposalOverrides {
  readonly member_refs?: readonly string[];
  readonly fingerprint_override?: string;
  readonly [key: string]: unknown;
}

async function makeProposal(overrides: ProposalOverrides = {}): Promise<Record<string, unknown>> {
  const memberRefs = overrides.member_refs ?? [EPISODE_A, EPISODE_B, EPISODE_C];
  const fingerprint =
    overrides.fingerprint_override ??
    (await deriveRelationshipEvidenceMemberSetFingerprint(memberRefs.map(episodeRef)));
  const { member_refs: _memberRefs, fingerprint_override: _fingerprint, ...rest } = overrides;
  void _memberRefs;
  void _fingerprint;
  return {
    schema_version: "relationship-update-proposal-v0",
    subject_id: SUBJECT_ID,
    expected_state_revision: 0,
    counterpart_ref: ALICE,
    updates: [{ dimension_id: "test_trust_like", next_value: 0.5 }],
    evidence_binding: {
      member_refs: memberRefs,
      member_set_fingerprint: fingerprint
    },
    ...rest
  };
}

async function validProposal(
  overrides: ProposalOverrides = {}
): Promise<RelationshipUpdateProposalV0> {
  const checked = validateRelationshipUpdateProposal(await makeProposal(overrides));
  if (!checked.ok) throw new Error(checked.error.detail);
  return checked.value;
}

describe("RelationshipState V0 schema within explicit SubjectState V3", () => {
  it("RF1–RF6/RF13–RF16: generic closed state, empty state, allowed refs and deterministic explicit initialization", () => {
    const empty = initializeEmptyRelationshipState();
    expect(empty).toEqual({
      schema_version: "relationship-state-v0",
      counterparts: []
    });
    expect(validateRelationshipState(empty, "relationships").ok).toBe(true);

    const initialized = initializeRelationshipState([
      {
        counterpart_ref: BOB as never,
        dimensions: [{ dimension_id: "test_trust_like" as never, value: 0.8 as never }]
      },
      {
        counterpart_ref: ALICE as never,
        dimensions: [
          { dimension_id: "test_trust_like" as never, value: 0.6 as never },
          { dimension_id: "test_closeness_like" as never, value: 0.4 as never }
        ]
      }
    ]);
    expect(initialized.counterparts.map((entry) => entry.counterpart_ref)).toEqual([
      ALICE,
      BOB
    ]);
    expect(initialized.counterparts[0]?.dimensions.map((entry) => entry.dimension_id)).toEqual([
      "test_closeness_like",
      "test_trust_like"
    ]);
    expect(validateRelationshipState(initialized, "relationships").ok).toBe(true);
    expect(
      validateRelationshipState(
        {
          schema_version: "relationship-state-v0",
          counterparts: [{ counterpart_ref: "episode:not-counterpart", dimensions: [] }]
        },
        "relationships"
      ).ok
    ).toBe(false);
    expect(JSON.stringify(initialized)).not.toContain("traits_seed");
  });

  it("RF2/RF7–RF12: closed keys, canonical ordering, uniqueness and UnitInterval bounds fail closed", () => {
    const cases: unknown[] = [
      { schema_version: "relationship-state-v0", counterparts: [], extra: true },
      {
        schema_version: "relationship-state-v0",
        counterparts: [
          { counterpart_ref: ALICE, dimensions: [] },
          { counterpart_ref: ALICE, dimensions: [] }
        ]
      },
      {
        schema_version: "relationship-state-v0",
        counterparts: [
          { counterpart_ref: BOB, dimensions: [] },
          { counterpart_ref: ALICE, dimensions: [] }
        ]
      },
      {
        schema_version: "relationship-state-v0",
        counterparts: [
          {
            counterpart_ref: ALICE,
            dimensions: [
              { dimension_id: "zeta", value: 0.5 },
              { dimension_id: "alpha", value: 0.5 }
            ]
          }
        ]
      },
      {
        schema_version: "relationship-state-v0",
        counterparts: [
          {
            counterpart_ref: ALICE,
            dimensions: [
              { dimension_id: "alpha", value: 0.5 },
              { dimension_id: "alpha", value: 0.6 }
            ]
          }
        ]
      }
    ];
    for (const value of [Number.NaN, Infinity, -Infinity, -0.1, 1.1]) {
      cases.push({
        schema_version: "relationship-state-v0",
        counterparts: [
          {
            counterpart_ref: ALICE,
            dimensions: [{ dimension_id: "test_value", value }]
          }
        ]
      });
    }
    for (const candidate of cases) {
      expect(validateRelationshipState(candidate, "relationships").ok).toBe(false);
    }
  });

  it("RF44/V1→V2 proofs A–D: V2 validates and every mixed/legacy V1 shape rejects", () => {
    const v2 = fixtureState();
    expect(validateSubjectState(v2).ok).toBe(true);

    const oldV1 = {
      ...structuredClone(v2),
      schema_version: "subject-state-v1",
      relationships: { models: [] }
    };
    expect(validateSubjectState(oldV1).ok).toBe(false);
    expect(
      validateSubjectState({ ...structuredClone(v2), schema_version: "subject-state-v1" }).ok
    ).toBe(false);
    expect(
      validateSubjectState({ ...structuredClone(v2), relationships: { models: [] } }).ok
    ).toBe(false);
    expect(validateSubjectState({ schema_version: "subject-state-v1" }).ok).toBe(false);
  });
});

describe("RelationshipUpdateProposal V0", () => {
  it("RF17–RF19/RF22/RF23: closed one-counterpart proposal, ordered unique updates/evidence and truthful fingerprint", async () => {
    expect(validateRelationshipUpdateProposal(await makeProposal()).ok).toBe(true);
    expect(validateRelationshipUpdateProposal(await makeProposal({ extra: true })).ok).toBe(false);
    expect(validateRelationshipUpdateProposal(await makeProposal({ updates: [] })).ok).toBe(false);
    expect(
      validateRelationshipUpdateProposal(
        await makeProposal({ counterpart_ref: [ALICE, BOB] })
      ).ok
    ).toBe(false);
    expect(
      validateRelationshipUpdateProposal(
        await makeProposal({
          updates: [
            { dimension_id: "zeta", next_value: 0.4 },
            { dimension_id: "alpha", next_value: 0.5 }
          ]
        })
      ).ok
    ).toBe(false);
    expect(
      validateRelationshipUpdateProposal(
        await makeProposal({
          updates: [
            { dimension_id: "alpha", next_value: 0.4 },
            { dimension_id: "alpha", next_value: 0.5 }
          ]
        })
      ).ok
    ).toBe(false);
    expect(
      validateRelationshipUpdateProposal(
        await makeProposal({ member_refs: [EPISODE_B, EPISODE_A] })
      ).ok
    ).toBe(false);
    expect(
      validateRelationshipUpdateProposal(
        await makeProposal({ member_refs: [EPISODE_A, EPISODE_A] })
      ).ok
    ).toBe(false);
    const a = await deriveRelationshipEvidenceMemberSetFingerprint([
      episodeRef(EPISODE_A),
      episodeRef(EPISODE_B)
    ]);
    const b = await deriveRelationshipEvidenceMemberSetFingerprint([
      episodeRef(EPISODE_B),
      episodeRef(EPISODE_A)
    ]);
    expect(a).toBe(b);
  });

  it("RF11/RF12: proposal next values reject NaN, Infinity and out-of-range values", async () => {
    for (const nextValue of [Number.NaN, Infinity, -Infinity, -0.1, 1.1]) {
      const checked = validateRelationshipUpdateProposal(
        await makeProposal({
          updates: [{ dimension_id: "test_trust_like", next_value: nextValue }]
        })
      );
      expect(checked.ok).toBe(false);
    }
  });
});

describe("RelationshipTransitionExecutor canonical authority", () => {
  it("RF28–RF43/RF45/RF46: first canonical proof, isolation, one trace, +1 revision, unchanged logical time/domains, hash and exact restore", async () => {
    const world = buildWorld();
    const before = structuredClone(world.initial);
    const beforeHash = await stateHash(world.initial);
    const relationshipOnly: SubjectStateV0 = {
      ...world.initial,
      relationships: initializeRelationshipState(
        world.initial.relationships.counterparts.map((counterpart) => ({
          counterpart_ref: counterpart.counterpart_ref,
          dimensions: counterpart.dimensions.map((dimension) =>
            counterpart.counterpart_ref === ALICE &&
            dimension.dimension_id === "test_trust_like"
              ? { dimension_id: dimension.dimension_id, value: 0.5 as never }
              : dimension
          )
        }))
      )
    };
    expect(relationshipOnly.runtime_metadata).toEqual(world.initial.runtime_metadata);
    expect(await stateHash(relationshipOnly)).not.toBe(beforeHash);

    const result = await world.executor.execute(relationshipContext(), await makeProposal());
    expect(result.kind, "detail" in result ? result.detail : "").toBe("COMMITTED");
    if (result.kind !== "COMMITTED") return;

    const after = result.bundle.next_snapshot;
    const alice = after.relationships.counterparts.find(
      (entry) => entry.counterpart_ref === ALICE
    );
    const bob = after.relationships.counterparts.find(
      (entry) => entry.counterpart_ref === BOB
    );
    expect(alice?.dimensions.find((entry) => entry.dimension_id === "test_trust_like")?.value).toBe(0.5);
    expect(alice?.dimensions.find((entry) => entry.dimension_id === "test_closeness_like")?.value).toBe(0.4);
    expect(bob).toEqual(before.relationships.counterparts[1]);
    expect(after.runtime_metadata.state_revision).toBe(1);
    expect(after.runtime_metadata.logical_time).toBe(before.runtime_metadata.logical_time);
    expect(after.personality).toEqual(before.personality);
    expect(after.beliefs).toEqual(before.beliefs);
    expect(after.memory_state).toEqual(before.memory_state);
    expect(after.traits_seed).toEqual(before.traits_seed);
    expect(after.affect).toEqual(before.affect);
    expect(after.regulation).toEqual(before.regulation);
    expect(result.bundle.transition_type).toBe("Relationship");
    expect(after.trace_window.entries).toHaveLength(1);
    expect(after.trace_window.entries[0]?.transition_type).toBe("Relationship");
    expect(after.trace_window.entries[0]?.domain_mutations).toEqual([
      {
        producer: "relationship",
        domain: "relationship",
        layers: ["relationships"],
        field_changes: [{ path: "/relationships", operation: "SET" }]
      }
    ]);
    expect(await stateHash(after)).not.toBe(beforeHash);

    const envelope = await createPersistenceEnvelope({
      snapshot: after,
      repository_bindings: result.bundle.repository_revision_bindings,
      commit_head: {
        commit_ref: result.bundle.commit_ref,
        record_checksum: result.bundle.record_checksum
      }
    });
    expect(envelope.ok).toBe(true);
    if (!envelope.ok) return;
    const restored = await restoreFromEnvelope(envelope.value, {
      referenceValidator: async () => true,
      commitChainVerifier: async () => true
    });
    expect(restored.ok).toBe(true);
    if (restored.ok) {
      expect(restored.snapshot.relationships).toEqual(after.relationships);
      expect(restored.snapshot).toEqual(after);
    }

    const legacyEnvelope = structuredClone(envelope.value) as unknown as Record<
      string,
      unknown
    >;
    const legacySnapshot = legacyEnvelope["snapshot"] as Record<string, unknown>;
    legacySnapshot["schema_version"] = "subject-state-v1";
    legacySnapshot["relationships"] = { models: [] };
    const legacyRestore = await restoreFromEnvelope(legacyEnvelope);
    expect(legacyRestore.ok).toBe(false);
    if (!legacyRestore.ok) {
      expect(legacyRestore.failure.error_code).toBe("INVALID_SCHEMA");
      expect(legacyRestore.failure.detail).toContain("subjectState.schema_version");
    }
  });

  it("RF20/RF21/RF28/RF29/RF31: unknown registered membership fails with zero commit and zero trace", async () => {
    for (const overrides of [
      { counterpart_ref: CHARLIE },
      { updates: [{ dimension_id: "test_unknown_like", next_value: 0.5 }] }
    ]) {
      const world = buildWorld();
      const result = await world.executor.execute(
        relationshipContext(),
        await makeProposal(overrides)
      );
      expect(["REJECTED_UNKNOWN_COUNTERPART", "REJECTED_UNKNOWN_DIMENSION"]).toContain(
        result.kind
      );
      expect(world.core.storeRead.getCommittedBundles()).toHaveLength(0);
      const current = await world.core.readCurrentSnapshot(SUBJECT_ID as never);
      expect(current?.relationships).toEqual(world.initial.relationships);
      expect(current?.trace_window.entries).toHaveLength(0);
    }
  });

  it("RF24–RF27/RF31: forged, missing, newer-unbound and stale evidence/revision fail closed", async () => {
    const cases: readonly {
      readonly proposal: ProposalOverrides;
      readonly expected: string;
    }[] = [
      {
        proposal: { fingerprint_override: `sha256:${"f".repeat(64)}` },
        expected: "REJECTED_FORGED_EVIDENCE_FINGERPRINT"
      },
      {
        proposal: { member_refs: [EPISODE_MISSING] },
        expected: "REJECTED_UNVERIFIED_EVIDENCE_MEMBER"
      },
      {
        proposal: { member_refs: [EPISODE_NEWER] },
        expected: "REJECTED_UNVERIFIED_EVIDENCE_MEMBER"
      },
      {
        proposal: { expected_state_revision: 9 },
        expected: "REJECTED_STALE_REVISION"
      }
    ];
    for (const testCase of cases) {
      const world = buildWorld();
      const result = await world.executor.execute(
        relationshipContext(),
        await makeProposal(testCase.proposal)
      );
      expect(result.kind).toBe(testCase.expected);
      expect(world.core.storeRead.getCommittedBundles()).toHaveLength(0);
      expect((await world.core.readCurrentSnapshot(SUBJECT_ID as never))?.trace_window.entries).toHaveLength(0);
    }
  });

  it("RF32/RF33: exact replay is +0; same journal identity with changed payload is REUSE_CONFLICT", async () => {
    const world = buildWorld();
    const firstProposal = await makeProposal();
    const first = await world.executor.execute(relationshipContext(), firstProposal);
    expect(first.kind, "detail" in first ? first.detail : "").toBe("COMMITTED");
    const count = world.core.storeRead.getCommittedBundles().length;
    const replay = await world.executor.execute(relationshipContext(), firstProposal);
    expect(replay.kind).toBe("ALREADY_COMMITTED");
    expect(world.core.storeRead.getCommittedBundles()).toHaveLength(count);

    const changed = await makeProposal({
      updates: [{ dimension_id: "test_trust_like", next_value: 0.55 }]
    });
    const originalId = await deriveRelationshipTransitionId(await validProposal());
    const changedId = await deriveRelationshipTransitionId(
      await validProposal({
        updates: [{ dimension_id: "test_trust_like", next_value: 0.55 }]
      })
    );
    expect(changedId).toBe(originalId);
    const conflict = await world.executor.execute(relationshipContext(), changed);
    expect(conflict.kind).toBe("REUSE_CONFLICT");
    expect(world.core.storeRead.getCommittedBundles()).toHaveLength(count);
  });

  it("RF30/RF34/RF35: multi-dimension updates are one-commit atomic and one invalid value changes nothing", async () => {
    const world = buildWorld();
    const valid = await world.executor.execute(
      relationshipContext(),
      await makeProposal({
        updates: [
          { dimension_id: "test_closeness_like", next_value: 0.45 },
          { dimension_id: "test_trust_like", next_value: 0.55 }
        ]
      })
    );
    expect(valid.kind, "detail" in valid ? valid.detail : "").toBe("COMMITTED");
    expect(world.core.storeRead.getCommittedBundles()).toHaveLength(1);
    if (valid.kind === "COMMITTED") {
      const alice = valid.bundle.next_snapshot.relationships.counterparts[0];
      expect(alice?.dimensions.map((entry) => entry.value)).toEqual([0.45, 0.55]);
      expect(valid.bundle.next_revision).toBe(1);
    }

    const invalidWorld = buildWorld();
    const invalid = await invalidWorld.executor.execute(
      relationshipContext(),
      await makeProposal({
        updates: [
          { dimension_id: "test_closeness_like", next_value: 0.45 },
          { dimension_id: "test_trust_like", next_value: Number.NaN }
        ]
      })
    );
    expect(invalid.kind).toBe("REJECTED_INVALID_PROPOSAL");
    expect(invalidWorld.core.storeRead.getCommittedBundles()).toHaveLength(0);
    expect((await invalidWorld.core.readCurrentSnapshot(SUBJECT_ID as never))?.relationships).toEqual(
      invalidWorld.initial.relationships
    );
  });
});
