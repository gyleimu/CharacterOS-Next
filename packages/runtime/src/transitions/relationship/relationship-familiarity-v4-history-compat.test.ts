/**
 * RELATIONSHIP_LIVED_DEVELOPMENT_AUTHORITY_SEAL_V0 — Seal B.
 *
 * The familiarity ingestion's trusted-history boundary must accept a
 * subject-state-v4 genesis envelope (the production session's representation)
 * while keeping GENESIS (revision 0) and CURRENT HEAD authority strictly
 * distinct. These regressions pin:
 *
 *   - the v4 genesis path mints and commits while genesis revision != head revision;
 *   - a canonical CURRENT head is NOT accepted as genesis;
 *   - a genesis envelope for a different subject is rejected;
 *   - the minted boundary receipt is issuer-identity-scoped (structural clone
 *     gains no authority).
 *
 * Fully offline: deterministic admission provider only — real-model calls = 0.
 */

import { describe, expect, it } from "vitest";

import {
  createInMemorySubjectCoreFacadeForExplicitV4V0,
  materializeSubjectStateV4V0,
  proposalFingerprint,
  validateProposal,
  type SubjectStateV0
} from "@characteros-next/subject-core";
import {
  computeMemoryRecordPayloadHash,
  computeRepositoryRevisionHash,
  InMemoryMemoryRepository,
  type EpisodicMemoryRecordV0
} from "@characteros-next/memory";

import {
  isTrustedCanonicalHistoryBoundaryReceiptV0,
  mintTrustedCanonicalHistoryBoundaryV4V0
} from "../../authority/trusted-canonical-history-boundary.js";
import { s0 } from "../observation/observation-fixtures.js";
import {
  processInteractionExperience,
  type InteractionFamiliarityIngestionDepsV0,
  type ProcessInteractionExperienceRequestV0,
  type RelationshipInteractionQualifyingAdmissionProviderV0
} from "./relationship-interaction-familiarity-ingestion.js";

const SUBJECT_ID = "subject-v4-hist";
const OTHER_SUBJECT_ID = "subject-v4-other";
const ALICE = "entity:alice-hist";
const R1 = "R1";

function episodeFixture(): EpisodicMemoryRecordV0 {
  return {
    schema_version: "episodic-memory-record-v0",
    episode_ref: "episode:v4-hist-1" as never,
    occurrence_logical_time: 1 as never,
    recorded_at_logical_time: 1 as never,
    provenance: { transition_id: "t-enc-v4-hist" as never, producer: "memory", cause_refs: [] },
    references: [ALICE as never],
    context: { scene: "shared an activity with alice", focus_refs: [ALICE as never], environment_refs: [] },
    appraisal_ref: null,
    affect_snapshot_ref: null,
    salience: { declared_score: 0.5 as never, source: "ENCODING_DECLARED_V0" }
  };
}

function v3Source(subjectId: string, memoryRevision: string): SubjectStateV0 {
  const base = s0() as unknown as Record<string, unknown>;
  return {
    ...base,
    identity: { ...(base["identity"] as Record<string, unknown>), subject_id: subjectId },
    memory_state: { ...(base["memory_state"] as Record<string, unknown>), repository_revision: memoryRevision },
    relationships: {
      schema_version: "relationship-state-v0",
      counterparts: [
        { counterpart_ref: ALICE, dimensions: [{ dimension_id: "arbitrary_host_dimension", value: 0.5 }] }
      ]
    }
  } as unknown as SubjectStateV0;
}

function deterministicProvider(): RelationshipInteractionQualifyingAdmissionProviderV0 {
  return { async admit() { return { kind: "QUALIFYING", qualifying_class: "SHARED_ACTIVITY" }; } };
}

async function materialize(subjectId: string, binding: { repository_revision: string; repository_revision_hash: string }) {
  const result = await materializeSubjectStateV4V0({
    mode: "EXPLICIT_V4_FOUNDATION_V0",
    seed: {
      schema_version: "subject-state-v4-genesis-seed-v0",
      subject: { subject_id: subjectId, display_name: "", identity_anchors: [] },
      v3_source: v3Source(subjectId, binding.repository_revision),
      r0_binding: binding
    },
    r0_binding: binding,
    reference_validator: async () => true
  } as never);
  if (!result.ok) throw new Error(`v4 genesis failed: ${result.code} ${result.detail}`);
  return result;
}

async function bindingFor(memory: InMemoryMemoryRepository, revision: string) {
  const manifest = await memory.readManifest(revision as never);
  if (manifest === null) throw new Error(`fixture: manifest ${revision} missing`);
  return { repository_revision: revision, repository_revision_hash: await computeRepositoryRevisionHash(manifest) };
}

/**
 * A lawful v4 history with REAL historical separation:
 *
 *   GENESIS (revision 0): memory R0, counterpart registered, no familiarity.
 *   → one real committed v4 Learning transition adopting memory R1
 *   → CURRENT HEAD (revision 1): memory R1, where the lived episode lives.
 *
 * Genesis binding (R0) therefore differs from the current head binding (R1),
 * and the episode is verifiable only against the current revision.
 */
async function buildV4History() {
  const memory = new InMemoryMemoryRepository();
  await memory.prepareRevision({ parent_revision: null as never, records: [] }); // R0
  const episode = episodeFixture();
  const episodeHash = await memory.storePayload(episode.episode_ref as never, episode);
  await memory.prepareRevision({
    parent_revision: "R0" as never,
    records: [{ ref: episode.episode_ref, payload_hash: episodeHash }] as never
  }); // R1
  const r0Binding = await bindingFor(memory, "R0");
  const r1Binding = await bindingFor(memory, R1);

  const genesis = await materialize(SUBJECT_ID, r0Binding);
  const assembly = createInMemorySubjectCoreFacadeForExplicitV4V0({
    seedSnapshots: new Map([[SUBJECT_ID as never, genesis.state as never]]),
    seedBundles: [],
    referenceValidator: async (candidate) => memory.validateRevisionBinding(candidate as never),
    preparedResultValidator: async () => true,
    memoryAdoptionValidator: async () => true
  });

  // The real v4 history step: adopt memory R1 (the episode revision).
  const rawProposal = {
    schema_version: "canonical-transition-proposal-v1",
    transition_id: "t-v4-hist-learning" as never,
    subject_id: SUBJECT_ID,
    transition_type: "Learning",
    expected_state_revision: 0,
    time_input: { kind: "OCCURRENCE", occurrence_logical_time: 0 },
    cause_refs: [],
    domain_deltas: [
      {
        producer: "memory",
        domain: "memory-content",
        expected_repository_revision: R1,
        operations: [{ path: "/memory_state/repository_revision", value: R1 }],
        provenance_refs: []
      }
    ],
    external_refs: []
  };
  const checked = validateProposal(rawProposal);
  if (!checked.ok) throw new Error(`fixture proposal invalid: ${checked.error.detail}`);
  const proposal = checked.value;
  const reserved = await assembly.facade.reserveAndRoute(proposal);
  if (reserved.kind !== "CONTINUE") throw new Error(`fixture reserve: ${reserved.kind}`);
  const committed = await assembly.facade.commitReserved({
    proposal,
    continuation: reserved.continuation,
    producerAuthorization: assembly.producerAuthorizationIssuer.issue([
      { producer: "memory", domain: "memory-content" }
    ]),
    preparedBinding: {
      transition_id: proposal.transition_id,
      subject_id: proposal.subject_id,
      transition_type: proposal.transition_type,
      payload_fingerprint: await proposalFingerprint(proposal),
      prepared_result_ref: "workflow:v4-hist-learning" as never
    },
    repository_bindings: [r0Binding as never, r1Binding as never]
  });
  if (committed.kind !== "COMMITTED") {
    throw new Error(`fixture head commit failed: ${JSON.stringify(committed).slice(0, 300)}`);
  }
  return { memory, assembly, genesis, episode, r0Binding, r1Binding, headBundle: committed.bundle };
}

type World = Awaited<ReturnType<typeof buildV4History>>;

function depsFor(
  world: World,
  overrideGenesisEnvelope?: unknown
): InteractionFamiliarityIngestionDepsV0 {
  return {
    memory: world.memory as never,
    assembly: world.assembly as never,
    admissionProvider: deterministicProvider(),
    repositoryBindings: [world.r1Binding as never],
    readGenesisSnapshot: async () => null,
    readGenesisEnvelope: async (subjectId) =>
      subjectId === SUBJECT_ID ? ((overrideGenesisEnvelope ?? world.genesis.envelope) as never) : null,
    genesisReferenceValidator: async (candidate) => world.memory.validateRevisionBinding(candidate as never)
  };
}

function requestFor(world: World): ProcessInteractionExperienceRequestV0 {
  return { subject_id: SUBJECT_ID as never, counterpart_ref: ALICE as never, episode: world.episode };
}

describe("RELATIONSHIP_LIVED_DEVELOPMENT_AUTHORITY_SEAL_V0 — V4 trusted-history compatibility", () => {
  it("mints the v4 boundary and commits familiarity while genesis revision != current head revision", async () => {
    const world = await buildV4History();
    // GENESIS authority: revision 0 bound to memory R0.
    expect(world.genesis.envelope.snapshot.runtime_metadata.state_revision).toBe(0);
    expect(world.genesis.envelope.repository_binding.repository_revision).toBe("R0");
    // CURRENT HEAD authority: revision 1 bound to memory R1.
    const headSnapshot = await world.assembly.facade.readCurrentSnapshot(SUBJECT_ID as never);
    expect(headSnapshot?.runtime_metadata.state_revision).toBe(1);
    expect(headSnapshot?.memory_state.repository_revision).toBe(R1);
    // Real historical separation: neither state revision nor memory binding is shared.
    expect(world.genesis.envelope.snapshot.runtime_metadata.state_revision).not.toBe(
      headSnapshot?.runtime_metadata.state_revision
    );
    expect(world.genesis.envelope.repository_binding.repository_revision).not.toBe(
      headSnapshot?.memory_state.repository_revision
    );
    // The verified carrier is byte-identical to the repository-owned payload.
    expect(await computeMemoryRecordPayloadHash(world.episode)).toBe(
      await world.memory.payloadHashOf(world.episode.episode_ref as never)
    );

    const outcome = await processInteractionExperience(depsFor(world), requestFor(world));
    expect(outcome.kind, JSON.stringify(outcome)).toBe("QUALIFIED_AND_COMMITTED");
    if (outcome.kind !== "QUALIFIED_AND_COMMITTED") return;
    expect(outcome.familiarity.previous.kind).toBe("ABSENT");
    expect(outcome.familiarity.next).toBeCloseTo(1 / 32, 6);
  });

  it("requires the v4 genesis envelope: the v3 snapshot fallback cannot represent this subject's genesis", async () => {
    const world = await buildV4History();
    const deps = {
      ...depsFor(world),
      readGenesisEnvelope: undefined
    } as unknown as InteractionFamiliarityIngestionDepsV0;
    const outcome = await processInteractionExperience(deps, requestFor(world));
    expect(outcome.kind).toBe("REJECTED");
    if (outcome.kind !== "REJECTED") return;
    expect(outcome.code).toBe("CANONICAL_HISTORY_UNAVAILABLE");
  });

  it("rejects a genesis envelope for a different subject (no capability minted)", async () => {
    const world = await buildV4History();
    const other = await materialize(OTHER_SUBJECT_ID, world.r0Binding);
    const outcome = await processInteractionExperience(
      depsFor(world, other.envelope),
      requestFor(world)
    );
    expect(outcome.kind).toBe("REJECTED");
    if (outcome.kind !== "REJECTED") return;
    expect(outcome.code).toBe("CANONICAL_HISTORY_UNAVAILABLE");
  });

  it("rejects a canonical CURRENT head supplied as genesis", async () => {
    const world = await buildV4History();
    const headSnapshot = await world.assembly.facade.readCurrentSnapshot(SUBJECT_ID as never);
    // A structurally valid v4 envelope whose snapshot is the CANONICAL CURRENT
    // head (revision 1) must never satisfy the revision-zero genesis law.
    const lookalike = structuredClone(world.genesis.envelope) as unknown as {
      snapshot: { runtime_metadata: { state_revision: number } };
    };
    lookalike.snapshot = { runtime_metadata: { state_revision: headSnapshot?.runtime_metadata.state_revision as number } };
    const outcome = await processInteractionExperience(depsFor(world, lookalike), requestFor(world));
    expect(outcome.kind).toBe("REJECTED");
    if (outcome.kind !== "REJECTED") return;
    expect(outcome.code).toBe("CANONICAL_HISTORY_UNAVAILABLE");
  });

  it("replays idempotently across a restart of the durable history (same episode, no second credit)", async () => {
    const world = await buildV4History();
    const first = await processInteractionExperience(depsFor(world), requestFor(world));
    expect(first.kind).toBe("QUALIFIED_AND_COMMITTED");
    if (first.kind !== "QUALIFIED_AND_COMMITTED") return;
    expect(first.familiarity.next).toBeCloseTo(1 / 32, 6);
    expect(first.replayed).toBe(false);

    // REAL restart: rebuild a fresh assembly from the SAME durable history
    // (canonical head snapshot + committed bundles), as session restore does.
    const head = await world.assembly.facade.readCurrentSnapshot(SUBJECT_ID as never);
    const restarted = createInMemorySubjectCoreFacadeForExplicitV4V0({
      seedSnapshots: new Map([[SUBJECT_ID as never, head as never]]),
      seedBundles: world.assembly.storeRead.getCommittedBundles() as never,
      referenceValidator: async (candidate) => world.memory.validateRevisionBinding(candidate as never),
      preparedResultValidator: async () => true,
      memoryAdoptionValidator: async () => true
    });
    const replay = await processInteractionExperience(
      { ...depsFor(world), assembly: restarted as never },
      requestFor(world)
    );
    expect(replay.kind).toBe("QUALIFIED_AND_COMMITTED");
    if (replay.kind !== "QUALIFIED_AND_COMMITTED") return;
    expect(replay.replayed).toBe(true);
    expect(replay.familiarity.next).toBeCloseTo(1 / 32, 6);
  });

  it("scopes boundary authority by issuer identity: a structural clone gains none", async () => {
    const world = await buildV4History();
    const minted = await mintTrustedCanonicalHistoryBoundaryV4V0({
      genesis: world.genesis.envelope as never,
      head: {
        schema_version: "trusted-canonical-head-v0",
        subject_id: SUBJECT_ID,
        revision: 1,
        commit_ref: world.headBundle.commit_ref,
        record_checksum: world.headBundle.record_checksum,
        state_hash: world.headBundle.state_hash_after,
        snapshot_hash: world.headBundle.snapshot_hash_after
      } as never,
      reference_validator: async (candidate) => world.memory.validateRevisionBinding(candidate as never)
    });
    expect(minted.kind).toBe("MINTED");
    if (minted.kind !== "MINTED") return;
    expect(isTrustedCanonicalHistoryBoundaryReceiptV0(minted.receipt)).toBe(true);
    expect(isTrustedCanonicalHistoryBoundaryReceiptV0(structuredClone(minted.receipt))).toBe(false);
  });
});
