/**
 * Relationship Counterpart Registration V0 acceptance suite (CR1–CR50).
 *
 * Proves EXPLICIT_ONLY runtime registration of one NEW counterpart into
 * canonical RelationshipStateV0 through SubjectCore. `test_trust_like` and
 * `test_closeness_like` are NON_SCIENTIFIC_TEST_FIXTURE identifiers only.
 * No production dimension catalog, psychology, semantic routing, or automatic
 * detection exists.
 */

import { describe, expect, it } from "vitest";
import {
  createInMemorySubjectCoreFacade,
  createPersistenceEnvelope,
  RELATIONSHIP_STATE_SCHEMA_VERSION,
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
  type MemoryPreparationAuthority,
  type MemoryRetrievalResultV0
} from "@characteros-next/memory";
import type { SubjectCorePort } from "../../ports/subject-core-port.js";
import type { RuntimeContext } from "../../types/runtime-context.js";
import { s0 } from "../observation/observation-fixtures.js";
import { RuntimeCompositionRoot } from "../../composition/runtime-composition-root.js";
// Vite `?raw` asset import (vitest-native); intentionally untyped.
// @ts-expect-error -- Vite ?raw imports carry no TypeScript declaration by design.
import runtimePackageRaw from "../../../package.json?raw";
import {
  deriveRelationshipEvidenceMemberSetFingerprint,
  RELATIONSHIP_UPDATE_PROPOSAL_SCHEMA_VERSION
} from "./relationship-update-proposal.js";
import { RelationshipTransitionExecutor as RelationshipUpdateExecutor } from "./relationship-transition-executor.js";
import {
  RelationshipCounterpartRegistrationExecutor
} from "./relationship-counterpart-registration-executor.js";
import * as registrationProposalModule from "./relationship-counterpart-registration-proposal.js";
import {
  RELATIONSHIP_COUNTERPART_REGISTRATION_PROPOSAL_SCHEMA_VERSION,
  deriveCounterpartRegistrationEvidenceMemberSetFingerprint,
  deriveRelationshipCounterpartRegistrationTransitionId,
  validateRelationshipCounterpartRegistrationProposal,
  type RelationshipCounterpartRegistrationProposalV0
} from "./relationship-counterpart-registration-proposal.js";

const SUBJECT_ID = "subject-s0";
const ALICE = "entity:alice-like";
const BOB = "subject:bob-like";
const MID = "entity:mid-like";
const ZOE = "subject:zoe-like";
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

function registrationContext(stateRevision = 0): RuntimeContext {
  return {
    subject_id: requireOk(validateIdentifier(SUBJECT_ID, "ctx.subject_id")),
    current_logical_time: requireOk(validateLogicalTime(0, "ctx.current_logical_time")),
    state_revision: requireOk(validateStateRevision(stateRevision, "ctx.state_revision"))
  };
}

interface TestCore extends SubjectCorePort {
  readonly issuer: ProducerAuthorizationIssuer;
  readonly journal: InMemoryFacadeAssembly["journal"];
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
      } as unknown as Parameters<
        MemoryPreparationAuthority["validateRevisionBinding"]
      >[0]);
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
    journal: assembly.journal,
    storeRead: assembly.storeRead
  };
}

/**
 * Item 26 initial world: canonical RelationshipState contains Bob ONLY.
 * Alice does not exist. Bound memory revision R1 carries valid episodic
 * evidence; R2 holds a newer unbound episode.
 */
function fixtureState(): SubjectStateV0 {
  const base = s0() as unknown as SubjectStateV0;
  return {
    ...base,
    memory_state: { ...base.memory_state, repository_revision: "R1" as never },
    relationships: {
      schema_version: RELATIONSHIP_STATE_SCHEMA_VERSION,
      counterparts: [
        {
          counterpart_ref: BOB as never,
          dimensions: [{ dimension_id: "test_trust_like" as never, value: 0.8 as never }]
        }
      ]
    }
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
  const executor = new RelationshipCounterpartRegistrationExecutor({
    subjectCore: core,
    issuer: core.issuer,
    memoryRepository: memory
  });
  const updateExecutor = new RelationshipUpdateExecutor({
    subjectCore: core,
    issuer: core.issuer,
    memoryRepository: memory
  });
  return { initial, memory, core, executor, updateExecutor };
}

interface RegistrationOverrides {
  readonly member_refs?: readonly string[];
  readonly fingerprint_override?: string;
  readonly [key: string]: unknown;
}

async function deriveEvidenceFingerprint(
  memberRefs: readonly string[]
): Promise<string> {
  return deriveCounterpartRegistrationEvidenceMemberSetFingerprint(
    memberRefs.map(episodeRef)
  );
}

async function makeRegistrationProposal(
  overrides: RegistrationOverrides = {}
): Promise<Record<string, unknown>> {
  const memberRefs = overrides.member_refs ?? [EPISODE_A, EPISODE_B, EPISODE_C];
  const fingerprint =
    overrides.fingerprint_override ?? (await deriveEvidenceFingerprint(memberRefs));
  const { member_refs: _memberRefs, fingerprint_override: _fingerprint, ...rest } = overrides;
  void _memberRefs;
  void _fingerprint;
  return {
    schema_version: RELATIONSHIP_COUNTERPART_REGISTRATION_PROPOSAL_SCHEMA_VERSION,
    subject_id: SUBJECT_ID,
    expected_state_revision: 0,
    counterpart_ref: ALICE,
    dimensions: [
      { dimension_id: "test_closeness_like", value: 0.3 },
      { dimension_id: "test_trust_like", value: 0.6 }
    ],
    evidence_binding: {
      member_refs: memberRefs,
      member_set_fingerprint: fingerprint
    },
    ...rest
  };
}

async function validRegistrationProposal(
  overrides: RegistrationOverrides = {}
): Promise<RelationshipCounterpartRegistrationProposalV0> {
  const checked = validateRelationshipCounterpartRegistrationProposal(
    await makeRegistrationProposal(overrides)
  );
  if (!checked.ok) throw new Error(checked.error.detail);
  return checked.value;
}

async function makeUpdateProposal(
  overrides: RegistrationOverrides = {}
): Promise<Record<string, unknown>> {
  const memberRefs = overrides.member_refs ?? [EPISODE_A, EPISODE_B, EPISODE_C];
  const fingerprint =
    overrides.fingerprint_override ?? (await deriveEvidenceFingerprint(memberRefs));
  const { member_refs: _memberRefs, fingerprint_override: _fingerprint, ...rest } = overrides;
  void _memberRefs;
  void _fingerprint;
  return {
    schema_version: RELATIONSHIP_UPDATE_PROPOSAL_SCHEMA_VERSION,
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

async function commitCount(world: ReturnType<typeof buildWorld>): Promise<number> {
  return world.core.storeRead.getCommittedBundles().length;
}

async function currentTraceLength(world: ReturnType<typeof buildWorld>): Promise<number> {
  const snapshot = await world.core.readCurrentSnapshot(SUBJECT_ID as never);
  return snapshot?.trace_window.entries.length ?? -1;
}

/**
 * Executable source of the registration slice (proposal module functions +
 * executor class), obtained without filesystem access. Used to prove the
 * absence of unauthorized executable paths in the changed production code.
 */
function registrationExecutableSource(): string {
  const parts: string[] = [
    validateRelationshipCounterpartRegistrationProposal.toString(),
    deriveCounterpartRegistrationEvidenceMemberSetFingerprint.toString(),
    deriveRelationshipCounterpartRegistrationTransitionId.toString(),
    RelationshipCounterpartRegistrationExecutor.toString()
  ];
  for (const value of Object.values(registrationProposalModule)) {
    if (typeof value === "function") parts.push(value.toString());
  }
  return parts.join("\n");
}

describe("RelationshipCounterpartRegistrationProposal V0 (CR1–CR13)", () => {
  it("CR1/CR3/CR7: schema validates for an explicit entity counterpart with explicit dimensions", async () => {
    expect(validateRelationshipCounterpartRegistrationProposal(await makeRegistrationProposal()).ok).toBe(true);
  });

  it("CR2: closed keys reject unknown fields at every level", async () => {
    expect(
      validateRelationshipCounterpartRegistrationProposal(
        await makeRegistrationProposal({ extra: true })
      ).ok
    ).toBe(false);
    expect(
      validateRelationshipCounterpartRegistrationProposal(
        await makeRegistrationProposal({
          dimensions: [{ dimension_id: "test_trust_like", value: 0.5, weight: 1 }]
        })
      ).ok
    ).toBe(false);
    expect(
      validateRelationshipCounterpartRegistrationProposal(
        await makeRegistrationProposal({
          evidence_binding: {
            member_refs: [EPISODE_A],
            member_set_fingerprint: `sha256:${"a".repeat(64)}`,
            source: "somewhere"
          }
        })
      ).ok
    ).toBe(false);
  });

  it("CR4: explicit subject counterpart is accepted", async () => {
    expect(
      validateRelationshipCounterpartRegistrationProposal(
        await makeRegistrationProposal({ counterpart_ref: ZOE })
      ).ok
    ).toBe(true);
  });

  it("CR5: unrelated ref kinds are rejected (CanonicalRefV0 entity/subject only)", async () => {
    for (const counterpartRef of ["episode:evidence-a", "proposal:p1", "workflow:w-1"]) {
      expect(
        validateRelationshipCounterpartRegistrationProposal(
          await makeRegistrationProposal({ counterpart_ref: counterpartRef })
        ).ok
      ).toBe(false);
    }
  });

  it("CR6: exactly ONE counterpart per proposal (no array, no batch)", async () => {
    expect(
      validateRelationshipCounterpartRegistrationProposal(
        await makeRegistrationProposal({ counterpart_ref: [ALICE, BOB] })
      ).ok
    ).toBe(false);
    expect(
      validateRelationshipCounterpartRegistrationProposal(
        await makeRegistrationProposal({ counterpart_ref: null })
      ).ok
    ).toBe(false);
  });

  it("CR8: initial dimensions must arrive raw-ASCII-sorted (canonical input, no normalization)", async () => {
    expect(
      validateRelationshipCounterpartRegistrationProposal(
        await makeRegistrationProposal({
          dimensions: [
            { dimension_id: "test_trust_like", value: 0.6 },
            { dimension_id: "test_closeness_like", value: 0.3 }
          ]
        })
      ).ok
    ).toBe(false);
  });

  it("CR9: duplicate initial dimensions are rejected", async () => {
    expect(
      validateRelationshipCounterpartRegistrationProposal(
        await makeRegistrationProposal({
          dimensions: [
            { dimension_id: "test_trust_like", value: 0.5 },
            { dimension_id: "test_trust_like", value: 0.6 }
          ]
        })
      ).ok
    ).toBe(false);
  });

  it("CR10: invalid UnitInterval initial values are rejected", async () => {
    for (const value of [Number.NaN, Infinity, -Infinity, -0.1, 1.1]) {
      expect(
        validateRelationshipCounterpartRegistrationProposal(
          await makeRegistrationProposal({
            dimensions: [{ dimension_id: "test_trust_like", value }]
          })
        ).ok
      ).toBe(false);
    }
  });

  it("CR11: zero-evidence registration is rejected (ONE_OR_MORE)", async () => {
    expect(
      validateRelationshipCounterpartRegistrationProposal(
        await makeRegistrationProposal({ member_refs: [] })
      ).ok
    ).toBe(false);
  });

  it("CR12: evidence refs must be canonical, unique and deterministically ordered", async () => {
    expect(
      validateRelationshipCounterpartRegistrationProposal(
        await makeRegistrationProposal({ member_refs: [EPISODE_B, EPISODE_A] })
      ).ok
    ).toBe(false);
    expect(
      validateRelationshipCounterpartRegistrationProposal(
        await makeRegistrationProposal({ member_refs: [EPISODE_A, EPISODE_A] })
      ).ok
    ).toBe(false);
  });

  it("CR13: member-set fingerprint is derived truthfully, order-independently, via the frozen authority", async () => {
    const a = await deriveCounterpartRegistrationEvidenceMemberSetFingerprint([
      episodeRef(EPISODE_A),
      episodeRef(EPISODE_B)
    ]);
    const b = await deriveCounterpartRegistrationEvidenceMemberSetFingerprint([
      episodeRef(EPISODE_B),
      episodeRef(EPISODE_A)
    ]);
    expect(a).toBe(b);
    expect(a).toBe(
      await deriveRelationshipEvidenceMemberSetFingerprint([
        episodeRef(EPISODE_A),
        episodeRef(EPISODE_B)
      ])
    );
  });
});

describe("RelationshipCounterpartRegistrationExecutor canonical authority (CR14–CR30)", () => {
  it("CR14: forged fingerprint fails closed with zero commit and zero trace", async () => {
    const world = buildWorld();
    const result = await world.executor.execute(
      registrationContext(),
      await makeRegistrationProposal({ fingerprint_override: `sha256:${"f".repeat(64)}` })
    );
    expect(result.kind).toBe("REJECTED_FORGED_EVIDENCE_FINGERPRINT");
    expect(await commitCount(world)).toBe(0);
    expect(await currentTraceLength(world)).toBe(0);
  });

  it("CR15/CR16: nonexistent and newer-unbound evidence are rejected against the bound revision", async () => {
    for (const evidenceRefs of [[EPISODE_MISSING], [EPISODE_NEWER]]) {
      const world = buildWorld();
      const result = await world.executor.execute(
        registrationContext(),
        await makeRegistrationProposal({ member_refs: evidenceRefs })
      );
      expect(result.kind).toBe("REJECTED_UNVERIFIED_EVIDENCE_MEMBER");
      expect(await commitCount(world)).toBe(0);
      expect(await currentTraceLength(world)).toBe(0);
    }
  });

  it("CR17: stale expected_state_revision is rejected, never auto-rebased", async () => {
    const world = buildWorld();
    const result = await world.executor.execute(
      registrationContext(),
      await makeRegistrationProposal({ expected_state_revision: 9 })
    );
    expect(result.kind).toBe("REJECTED_STALE_REVISION");
    expect(await commitCount(world)).toBe(0);
    expect(await currentTraceLength(world)).toBe(0);
    const snapshot = await world.core.readCurrentSnapshot(SUBJECT_ID as never);
    expect(snapshot?.runtime_metadata.state_revision).toBe(0);
  });

  it("CR19/CR20/CR21/CR25/CR41: first runtime registration proof — one atomic multi-dimension commit, +1 revision, unchanged logical time, one relationship trace, changed hash", async () => {
    const world = buildWorld();
    const before = structuredClone(world.initial);
    const beforeHash = await stateHash(world.initial);

    const result = await world.executor.execute(
      registrationContext(),
      await makeRegistrationProposal()
    );
    expect(result.kind, "detail" in result ? result.detail : "").toBe("COMMITTED");
    if (result.kind !== "COMMITTED") return;

    const after = result.bundle.next_snapshot;
    expect(after.relationships.counterparts.map((entry) => entry.counterpart_ref)).toEqual([
      ALICE,
      BOB
    ]);
    const alice = after.relationships.counterparts[0];
    expect(alice?.dimensions.map((entry) => entry.dimension_id)).toEqual([
      "test_closeness_like",
      "test_trust_like"
    ]);
    expect(alice?.dimensions.map((entry) => entry.value)).toEqual([0.3, 0.6]);
    expect(after.runtime_metadata.state_revision).toBe(1);
    expect(result.bundle.next_revision).toBe(1);
    expect(after.runtime_metadata.logical_time).toBe(before.runtime_metadata.logical_time);
    expect(await stateHash(after)).not.toBe(beforeHash);
    expect(await commitCount(world)).toBe(1);
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
  });

  it("CR22/CR30: every evidence/identity failure adds nothing — counterpart absent, revision +0, trace +0", async () => {
    const failureCases: readonly {
      readonly proposal: RegistrationOverrides;
      readonly expected: string;
    }[] = [
      {
        proposal: { fingerprint_override: `sha256:${"f".repeat(64)}` },
        expected: "REJECTED_FORGED_EVIDENCE_FINGERPRINT"
      },
      { proposal: { member_refs: [EPISODE_MISSING] }, expected: "REJECTED_UNVERIFIED_EVIDENCE_MEMBER" },
      { proposal: { member_refs: [EPISODE_NEWER] }, expected: "REJECTED_UNVERIFIED_EVIDENCE_MEMBER" },
      { proposal: { member_refs: [] }, expected: "REJECTED_INVALID_PROPOSAL" },
      { proposal: { expected_state_revision: 9 }, expected: "REJECTED_STALE_REVISION" },
      {
        proposal: {
          dimensions: [
            { dimension_id: "test_trust_like", value: 0.6 },
            { dimension_id: "test_trust_like", value: 0.7 }
          ]
        },
        expected: "REJECTED_INVALID_PROPOSAL"
      }
    ];
    for (const failure of failureCases) {
      const world = buildWorld();
      const result = await world.executor.execute(
        registrationContext(),
        await makeRegistrationProposal(failure.proposal)
      );
      expect(result.kind, `${JSON.stringify(failure.proposal)}`).toBe(failure.expected);
      expect(await commitCount(world)).toBe(0);
      expect(await currentTraceLength(world)).toBe(0);
      const snapshot = await world.core.readCurrentSnapshot(SUBJECT_ID as never);
      expect(
        snapshot?.relationships.counterparts.some((entry) => entry.counterpart_ref === ALICE)
      ).toBe(false);
    }
  });

  it("CR23: exact replay of the committed registration is ALREADY_COMMITTED with +0 duplicate effect", async () => {
    const world = buildWorld();
    const proposal = await makeRegistrationProposal();
    const first = await world.executor.execute(registrationContext(), proposal);
    expect(first.kind, "detail" in first ? first.detail : "").toBe("COMMITTED");
    const count = await commitCount(world);

    const replay = await world.executor.execute(registrationContext(), proposal);
    expect(replay.kind).toBe("ALREADY_COMMITTED");
    expect(await commitCount(world)).toBe(count);
    const snapshot = await world.core.readCurrentSnapshot(SUBJECT_ID as never);
    expect(
      snapshot?.relationships.counterparts.filter((entry) => entry.counterpart_ref === ALICE)
    ).toHaveLength(1);
  });

  it("CR24: same journal identity with a changed dimension payload is REUSE_CONFLICT", async () => {
    const world = buildWorld();
    const first = await world.executor.execute(
      registrationContext(),
      await makeRegistrationProposal()
    );
    expect(first.kind, "detail" in first ? first.detail : "").toBe("COMMITTED");
    const count = await commitCount(world);

    const originalId = await deriveRelationshipCounterpartRegistrationTransitionId(
      await validRegistrationProposal()
    );
    const changedId = await deriveRelationshipCounterpartRegistrationTransitionId(
      await validRegistrationProposal({
        dimensions: [{ dimension_id: "test_trust_like", value: 0.65 }]
      })
    );
    expect(changedId).toBe(originalId);

    const conflict = await world.executor.execute(
      registrationContext(),
      await makeRegistrationProposal({
        dimensions: [{ dimension_id: "test_trust_like", value: 0.65 }]
      })
    );
    expect(conflict.kind).toBe("REUSE_CONFLICT");
    expect(await commitCount(world)).toBe(count);
  });

  it("CR18/CR28: duplicate registration under a NEW identity is rejected; canonical ordering holds before/between/after", async () => {
    const world = buildWorld();
    const first = await world.executor.execute(
      registrationContext(),
      await makeRegistrationProposal()
    );
    expect(first.kind, "detail" in first ? first.detail : "").toBe("COMMITTED");
    const count = await commitCount(world);
    const tracesAfterFirst = await currentTraceLength(world);

    // New transition identity (different evidence set) for the SAME counterpart.
    const duplicate = await world.executor.execute(
      registrationContext(1),
      await makeRegistrationProposal({ member_refs: [EPISODE_A], expected_state_revision: 1 })
    );
    expect(duplicate.kind).toBe("REJECTED_ALREADY_REGISTERED");
    expect(await commitCount(world)).toBe(count);
    expect(await currentTraceLength(world)).toBe(tracesAfterFirst);
    const afterDuplicate = await world.core.readCurrentSnapshot(SUBJECT_ID as never);
    expect(afterDuplicate?.runtime_metadata.state_revision).toBe(1);
    expect(
      afterDuplicate?.relationships.counterparts.filter((entry) => entry.counterpart_ref === ALICE)
    ).toHaveLength(1);

    // Ordering proof: MID belongs between ALICE and BOB; ZOE belongs after BOB.
    const second = await world.executor.execute(
      registrationContext(1),
      await makeRegistrationProposal({
        counterpart_ref: MID,
        dimensions: [{ dimension_id: "test_trust_like", value: 0.5 }],
        expected_state_revision: 1
      })
    );
    expect(second.kind, "detail" in second ? second.detail : "").toBe("COMMITTED");
    const third = await world.executor.execute(
      registrationContext(2),
      await makeRegistrationProposal({
        counterpart_ref: ZOE,
        dimensions: [{ dimension_id: "test_trust_like", value: 0.4 }],
        expected_state_revision: 2
      })
    );
    expect(third.kind, "detail" in third ? third.detail : "").toBe("COMMITTED");
    if (third.kind !== "COMMITTED") return;
    expect(
      third.bundle.next_snapshot.relationships.counterparts.map((entry) => entry.counterpart_ref)
    ).toEqual([ALICE, MID, BOB, ZOE]);
    expect(
      validateRelationshipState(third.bundle.next_snapshot.relationships, "relationships").ok
    ).toBe(true);
  });

  it("CR26/CR29–CR34: invalid one-of-many dimensions reject the entire registration; success leaves every other domain untouched", async () => {
    const world = buildWorld();
    const before = structuredClone(world.initial);

    const invalid = await world.executor.execute(
      registrationContext(),
      await makeRegistrationProposal({
        dimensions: [
          { dimension_id: "test_closeness_like", value: 0.3 },
          { dimension_id: "test_trust_like", value: Number.NaN }
        ]
      })
    );
    expect(invalid.kind).toBe("REJECTED_INVALID_PROPOSAL");
    expect(await commitCount(world)).toBe(0);
    const untouched = await world.core.readCurrentSnapshot(SUBJECT_ID as never);
    expect(untouched?.relationships).toEqual(before.relationships);

    const valid = await world.executor.execute(
      registrationContext(),
      await makeRegistrationProposal()
    );
    expect(valid.kind, "detail" in valid ? valid.detail : "").toBe("COMMITTED");
    if (valid.kind !== "COMMITTED") return;
    const after = valid.bundle.next_snapshot;
    expect(after.personality).toEqual(before.personality);
    expect(after.beliefs).toEqual(before.beliefs);
    expect(after.memory_state).toEqual(before.memory_state);
    expect(after.traits_seed).toEqual(before.traits_seed);
    expect(after.affect).toEqual(before.affect);
    expect(after.regulation).toEqual(before.regulation);
  });

  it("CR27: Bob is unchanged when Alice is registered", async () => {
    const world = buildWorld();
    const before = structuredClone(world.initial);
    const result = await world.executor.execute(
      registrationContext(),
      await makeRegistrationProposal()
    );
    expect(result.kind, "detail" in result ? result.detail : "").toBe("COMMITTED");
    if (result.kind !== "COMMITTED") return;
    const bobAfter = result.bundle.next_snapshot.relationships.counterparts.find(
      (entry) => entry.counterpart_ref === BOB
    );
    const bobBefore = before.relationships.counterparts.find(
      (entry) => entry.counterpart_ref === BOB
    );
    expect(bobAfter).toEqual(bobBefore);
  });
});

describe("Frozen foundation invariants (CR35–CR43)", () => {
  it("CR35: RelationshipUpdate remains REGISTERED_ONLY after registration", async () => {
    const world = buildWorld();
    const registered = await world.executor.execute(
      registrationContext(),
      await makeRegistrationProposal()
    );
    expect(registered.kind, "detail" in registered ? registered.detail : "").toBe("COMMITTED");
    const count = await commitCount(world);

    // Unknown future dimension on the newly registered counterpart is still rejected.
    const unknownDimension = await world.updateExecutor.execute(
      registrationContext(1),
      await makeUpdateProposal({ expected_state_revision: 1, updates: [{ dimension_id: "test_unknown_like", next_value: 0.5 }] })
    );
    expect(unknownDimension.kind).toBe("REJECTED_UNKNOWN_DIMENSION");

    // Never-registered counterpart is still not updateable.
    const unknownCounterpart = await world.updateExecutor.execute(
      registrationContext(1),
      await makeUpdateProposal({
        expected_state_revision: 1,
        counterpart_ref: CHARLIE,
        updates: [{ dimension_id: "test_trust_like", next_value: 0.5 }]
      })
    );
    expect(unknownCounterpart.kind).toBe("REJECTED_UNKNOWN_COUNTERPART");
    expect(await commitCount(world)).toBe(count);
  });

  it("CR35b: zero-dimension registration preserves the frozen empty-set contract and stays non-updateable", async () => {
    const world = buildWorld();
    const result = await world.executor.execute(
      registrationContext(),
      await makeRegistrationProposal({ dimensions: [] })
    );
    expect(result.kind, "detail" in result ? result.detail : "").toBe("COMMITTED");
    if (result.kind !== "COMMITTED") return;
    const alice = result.bundle.next_snapshot.relationships.counterparts.find(
      (entry) => entry.counterpart_ref === ALICE
    );
    expect(alice?.dimensions).toEqual([]);

    const update = await world.updateExecutor.execute(
      registrationContext(1),
      await makeUpdateProposal({ expected_state_revision: 1 })
    );
    expect(update.kind).toBe("REJECTED_UNKNOWN_DIMENSION");
  });

  it("CR36: no automatic Observation → registration wiring exists", () => {
    // The composition root composes NO transition executor at all — executors
    // arrive host-side through explicit construction. The dependency container
    // exposes no registration seam and no executor seam.
    const assembly = createInMemorySubjectCoreFacade({
      preparedResultValidator: async () => true
    });
    const retrieval = {
      retrieve: async (): Promise<MemoryRetrievalResultV0> =>
        ({
          schema_version: "memory-retrieval-result-v0",
          subject_id: SUBJECT_ID,
          selected_memory_refs: [],
          evidence: [],
          retrieval_trace_ref: null,
          deterministic_metadata: {
            repository_revision: "R0",
            candidate_count: 0,
            computed_under_config: "MEMORY_RETRIEVAL_V0",
            query_fingerprint: `sha256:${"0".repeat(64)}`
          }
        }) as unknown as MemoryRetrievalResultV0
    };
    const root = new RuntimeCompositionRoot({
      subjectCore: assembly.facade,
      producerAuthorizationIssuer: assembly.producerAuthorizationIssuer,
      memoryRepository: {
        storePayload: async () => {
          throw new Error("not used");
        },
        payloadHashOf: async () => null,
        prepareRevisionForIntent: async () => {
          throw new Error("not used");
        },
        readManifest: async () => null,
        validateRevisionBinding: async () => true,
        validateRefsBelong: async () => true
      },
      retrieval
    });
    for (const key of Object.keys(root.dependencies())) {
      expect(key.toLowerCase()).not.toContain("registration");
      expect(key.toLowerCase()).not.toContain("executor");
    }
    // The registration executor exists only as an explicitly constructible class.
    expect(typeof RelationshipCounterpartRegistrationExecutor).toBe("function");
  });

  it("CR37/CR39: no semantic routing and no hard-coded relationship psychology in registration executable code", () => {
    const source = registrationExecutableSource();
    for (const forbidden of [
      "classif",
      "embedding",
      "SemanticRouting",
      "relationshipChannel",
      "trustProducer",
      "closenessProducer",
      "attachmentProducer"
    ]) {
      expect(source).not.toContain(forbidden);
    }
    for (const psychology of [
      "trust",
      "closeness",
      "attachment",
      "love",
      "hostility",
      "dominance",
      "familiarity"
    ]) {
      expect(source.toLowerCase()).not.toContain(psychology);
    }
  });

  it("CR38: no LLM, network, clock, randomness or dynamic execution in registration executable code", () => {
    const source = registrationExecutableSource();
    for (const forbidden of [
      "Date.now",
      "new Date",
      "Math.random",
      "randomUUID",
      "fetch(",
      "XMLHttpRequest",
      "WebSocket",
      "https://",
      "http://",
      "eval(",
      "Function(",
      "child_process",
      "require(",
      "import("
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it("CR40: SubjectState V3 fixture remains valid and registration carries no legacy V2 literal", async () => {
    const world = buildWorld();
    expect((await world.core.readCurrentSnapshot(SUBJECT_ID as never))?.schema_version).toBe(
      "subject-state-v3"
    );
    expect(validateSubjectState(world.initial).ok).toBe(true);
    expect(RELATIONSHIP_COUNTERPART_REGISTRATION_PROPOSAL_SCHEMA_VERSION).toBe(
      "relationship-counterpart-registration-proposal-v0"
    );
    expect(registrationExecutableSource()).not.toContain("subject-state-v2");
  });

  it("CR42: snapshot/restore preserves the registered counterpart exactly", async () => {
    const world = buildWorld();
    const result = await world.executor.execute(
      registrationContext(),
      await makeRegistrationProposal()
    );
    expect(result.kind, "detail" in result ? result.detail : "").toBe("COMMITTED");
    if (result.kind !== "COMMITTED") return;
    const envelope = await createPersistenceEnvelope({
      snapshot: result.bundle.next_snapshot,
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
      expect(restored.snapshot.relationships).toEqual(result.bundle.next_snapshot.relationships);
      expect(restored.snapshot).toEqual(result.bundle.next_snapshot);
    }
  });

  it("CR43: journal export/import preserves the registration identity record; same-host replay routes ALREADY_COMMITTED", async () => {
    const worldA = buildWorld();
    const proposal = await makeRegistrationProposal();
    const first = await worldA.executor.execute(registrationContext(), proposal);
    expect(first.kind, "detail" in first ? first.detail : "").toBe("COMMITTED");

    // The registration commits under the journal model's "Relationship"
    // transition type — the type the existing journal round-trip supports.
    const registrationId = await deriveRelationshipCounterpartRegistrationTransitionId(
      await validRegistrationProposal()
    );
    const exported = worldA.core.journal.exportState();
    const exportedRecord = exported.find((record) => record.transition_id === registrationId);
    expect(exportedRecord?.transition_type).toBe("Relationship");
    expect(exported.some((record) => record.transition_type === "Relationship")).toBe(true);

    // Host B: importing the journal state preserves the registration identity
    // record byte-for-byte (id, type, payload fingerprint, sequence).
    const worldB = buildWorld();
    worldB.core.journal.importState(structuredClone(exported));
    const importedRecord = await worldB.core.journal.readRecord(registrationId);
    expect(importedRecord?.transition_type).toBe("Relationship");
    expect(importedRecord?.payload_fingerprint).toBe(exportedRecord?.payload_fingerprint);
    expect(importedRecord?.first_seen_sequence).toBe(exportedRecord?.first_seen_sequence);
    // Host B's store has no committed bundle, so no canonical effect is replayed.
    expect(await commitCount(worldB)).toBe(0);
    const snapshotB = await worldB.core.readCurrentSnapshot(SUBJECT_ID as never);
    expect(
      snapshotB?.relationships.counterparts.some((entry) => entry.counterpart_ref === ALICE)
    ).toBe(false);

    // Same-host replay of the committed identity routes ALREADY_COMMITTED (+0).
    const replay = await worldA.executor.execute(registrationContext(), proposal);
    expect(replay.kind).toBe("ALREADY_COMMITTED");
    expect(await commitCount(worldA)).toBe(1);

    // Registration identity is deterministic and disjoint from the update projection.
    const idFirst = await deriveRelationshipCounterpartRegistrationTransitionId(
      await validRegistrationProposal()
    );
    const idAgain = await deriveRelationshipCounterpartRegistrationTransitionId(
      await validRegistrationProposal()
    );
    expect(idAgain).toBe(idFirst);
    expect(idFirst.startsWith("t-relationship-registration-")).toBe(true);
    expect(validateIdentifier(idFirst, "cr43").ok).toBe(true);
  });
});

describe("Suite-level graph invariants (CR50)", () => {
  it("CR50: dependency edges remain exactly the lawful workspace set (graph stays acyclic)", () => {
    const runtimePackage = JSON.parse(runtimePackageRaw) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const workspaceDeps = Object.keys({
      ...runtimePackage.dependencies,
      ...runtimePackage.devDependencies
    }).filter((name) => name.startsWith("@characteros-next/"));
    // Updated by RelationshipPlasticityProducer V0 (STRATEGY_A): runtime now
    // lawfully consumes memory-influence and influence-evidence as well.
    expect(workspaceDeps.sort()).toEqual([
      "@characteros-next/influence-evidence",
      "@characteros-next/memory",
      "@characteros-next/memory-influence",
      "@characteros-next/subject-core"
    ]);
  });
});
