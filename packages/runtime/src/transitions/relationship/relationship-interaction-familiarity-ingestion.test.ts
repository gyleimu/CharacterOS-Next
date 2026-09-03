/**
 * Interaction Familiarity Experience Ingestion V0 — acceptance suite
 * (INTERACTION_FAMILIARITY_EXPERIENCE_INGESTION_V0):
 *
 *   VERIFICATION  canonical episode existence, authoritative payload hash,
 *                 subject memory-revision binding, counterpart reference and
 *                 registration; caller-supplied carriers are never authority
 *   ADMISSION     the three frozen qualifying classes qualify; ABSTAIN and
 *                 provider-invalid output mutate nothing; no magnitude input
 *   RECEIPT       deterministic frozen receipt refs derived only after
 *                 verification + admission; raw episode refs never substitute
 *   LIVED E2E     real canonical qualifying episode → receipt → INITIALIZE →
 *                 V2 commit → familiarity 1/32 → writer authority
 *                 RESOLVED_VALID; second unique episode → 2/32 with the exact
 *                 cumulative evidence lineage
 *   DUPLICATE     exact workflow retry replays (idempotent); no double credit
 *   COUNTERPARTS  per-counterpart lineages stay separate
 *   SATURATION    32 credits → 1; the 33rd qualifying episode produces
 *                 QUALIFIED_BUT_SATURATED with NO familiarity commit
 *   FROZEN        ordinary V2 commits keep writer_authority null; result
 *                 surface carries no authority handles
 *
 * Fully OFFLINE: deterministic admission providers only — real-model calls = 0.
 */

import { describe, expect, it } from "vitest";

import {
  createInMemorySubjectCoreFacade,
  type AtomicCommitBundleAnyVersion,
  type AtomicCommitBundleV2,
  type CanonicalTransitionProposalV1,
  type SubjectStateV0
} from "@characteros-next/subject-core";
import {
  computeMemoryRecordPayloadHash,
  InMemoryMemoryRepository,
  type EpisodicMemoryRecordV0
} from "@characteros-next/memory";

import {
  classifyHistoricalWriterAuthorityStatusV0
} from "../../authority/historical-writer-authority-registry.js";
import {
  deriveRelationshipInteractionFamiliarityEvidenceReceiptRefV0,
  RELATIONSHIP_INTERACTION_FAMILIARITY_EVIDENCE_ADMISSION_POLICY_ID_V0,
  RELATIONSHIP_INTERACTION_FAMILIARITY_EVIDENCE_RECEIPT_SCHEMA_VERSION_V0
} from "./relationship-interaction-familiarity-evidence-receipt.js";
import {
  processInteractionExperience,
  RELATIONSHIP_INTERACTION_QUALIFYING_ADMISSION_CLASSES_V0,
  type InteractionFamiliarityIngestionDepsV0,
  type ProcessInteractionExperienceRequestV0,
  type RelationshipInteractionQualifyingAdmissionProviderV0
} from "./relationship-interaction-familiarity-ingestion.js";
import { INTERACTION_FAMILIARITY_DIMENSION_ID_V0 } from "./relationship-feature-decision-semantics.js";

const R0_HASH = "sha256:4444444444444444444444444444444444444444444444444444444444444444";
const ALICE = "entity:alice-like";
const BOB = "entity:bob-like";
const FAMILIARITY = INTERACTION_FAMILIARITY_DIMENSION_ID_V0;

// ---- deterministic fixtures -------------------------------------------------------------

function episodeFixture(overrides: Partial<EpisodicMemoryRecordV0> = {}): EpisodicMemoryRecordV0 {
  return {
    schema_version: "episodic-memory-record-v0",
    episode_ref: "episode:e-pending" as never,
    occurrence_logical_time: 1 as never,
    recorded_at_logical_time: 1 as never,
    provenance: {
      transition_id: "t-encoding-1" as never,
      producer: "memory",
      cause_refs: []
    },
    references: [ALICE as never],
    context: {
      scene: "walked and talked with alice in the park",
      focus_refs: [ALICE as never],
      environment_refs: []
    },
    appraisal_ref: null,
    affect_snapshot_ref: null,
    salience: { declared_score: 0.5 as never, source: "ENCODING_DECLARED_V0" },
    ...overrides
  };
}

function seedState(input: {
  readonly memoryRevision: string;
  readonly counterparts?: readonly { counterpart_ref: string; dimension_id: string; value: number }[];
  readonly subjectId?: string;
}): SubjectStateV0 {
  const grouped = new Map<string, { dimension_id: string; value: number }[]>();
  for (const entry of input.counterparts ?? []) {
    const dimensions = grouped.get(entry.counterpart_ref) ?? [];
    dimensions.push({ dimension_id: entry.dimension_id, value: entry.value });
    grouped.set(entry.counterpart_ref, dimensions);
  }
  return {
    schema_version: "subject-state-v3",
    identity: {
      subject_id: input.subjectId ?? "subject-s0",
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
      repository_revision: input.memoryRevision,
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
    relationships: {
      schema_version: "relationship-state-v0",
      counterparts: [...grouped.entries()].map(([counterpart_ref, dimensions]) => ({
        counterpart_ref,
        dimensions
      }))
    },
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

function deterministicProvider(
  classByEpisode: ReadonlyMap<string, string> = new Map(),
  defaultClass: string = "DIRECT_COMMUNICATION"
): RelationshipInteractionQualifyingAdmissionProviderV0 {
  return {
    async admit(input) {
      const decided = classByEpisode.get(input.episode.episode_ref) ?? defaultClass;
      if (decided === "ABSTAIN") return { kind: "ABSTAIN" };
      return { kind: "QUALIFYING", qualifying_class: decided as never };
    }
  };
}

interface Composition {
  readonly deps: InteractionFamiliarityIngestionDepsV0;
  readonly memory: InMemoryMemoryRepository;
  readonly assembly: ReturnType<typeof createInMemorySubjectCoreFacade>;
  readonly genesis: SubjectStateV0;
}

async function compose(input: {
  readonly episodes: readonly EpisodicMemoryRecordV0[];
  readonly counterparts?: readonly { counterpart_ref: string; dimension_id: string; value: number }[];
  readonly subjectId?: string;
  readonly memoryRevisionOverride?: string;
  readonly provider?: RelationshipInteractionQualifyingAdmissionProviderV0;
  readonly extraSeedSubjects?: readonly SubjectStateV0[];
}): Promise<Composition> {
  const memory = new InMemoryMemoryRepository();
  const records: { ref: never; payload_hash: never }[] = [];
  for (const episode of input.episodes) {
    const hash = await memory.storePayload(episode.episode_ref as never, episode);
    records.push({ ref: episode.episode_ref as never, payload_hash: hash } as never);
  }
  records.sort((a, b) => (a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0));
  const prepared = await memory.prepareRevisionForIntent({
    intent_id: "intent-fam-ingestion-fixture" as never,
    parent_revision: null,
    records
  });
  const genesis = seedState({
    memoryRevision: input.memoryRevisionOverride ?? prepared.repository_revision,
    ...(input.counterparts !== undefined ? { counterparts: input.counterparts } : {}),
    ...(input.subjectId !== undefined ? { subjectId: input.subjectId } : {})
  });
  const assembly = createInMemorySubjectCoreFacade({
    seedSnapshots: new Map([
      [(input.subjectId ?? "subject-s0") as never, genesis],
      ...(input.extraSeedSubjects ?? []).map((extra) => [
        extra.identity.subject_id,
        extra
      ] as never)
    ]),
    preparedResultValidator: async () => true
  });
  return {
    deps: {
      memory,
      assembly,
      admissionProvider: input.provider ?? deterministicProvider(),
      repositoryBindings: [
        { repository_revision: "R0", repository_revision_hash: R0_HASH } as never
      ],
      readGenesisSnapshot: async (subjectId) =>
        subjectId === (input.subjectId ?? "subject-s0") ? genesis : null
    },
    memory,
    assembly,
    genesis
  };
}

async function establishHead(
  composition: Composition,
  transitionId: string
): Promise<void> {
  const { assembly } = composition;
  const currentState = (await assembly.storeRead.readCurrentState("subject-s0")) as SubjectStateV0;
  const revision = (currentState as unknown as { runtime_metadata: { state_revision: number } })
    .runtime_metadata.state_revision;
  const relationships = structuredClone(
    (currentState as unknown as Record<string, unknown>)["relationships"]
  ) as {
    counterparts: { counterpart_ref: string; dimensions: { dimension_id: string; value: number }[] }[];
  };
  const alice = relationships.counterparts.find((entry) => entry.counterpart_ref === ALICE);
  if (alice === undefined) throw new Error("fixture: alice missing from canonical relationships");
  const hostDimensions = alice.dimensions.filter(
    (dimension) => dimension.dimension_id !== "arbitrary_host_dimension"
  );
  hostDimensions.push({ dimension_id: "arbitrary_host_dimension", value: 0.25 });
  hostDimensions.sort((a, b) => (a.dimension_id < b.dimension_id ? -1 : a.dimension_id > b.dimension_id ? 1 : 0));
  alice.dimensions = hostDimensions;
  const proposal = {
    schema_version: "canonical-transition-proposal-v1",
    transition_id: transitionId,
    subject_id: "subject-s0",
    transition_type: "Relationship",
    expected_state_revision: revision,
    time_input: { kind: "OCCURRENCE", occurrence_logical_time: 0 },
    cause_refs: [],
    domain_deltas: [
      {
        producer: "relationship",
        domain: "relationship",
        expected_repository_revision: null,
        operations: [{ path: "/relationships", value: relationships }],
        provenance_refs: []
      }
    ],
    external_refs: []
  } as unknown as CanonicalTransitionProposalV1;
  const reserved = await assembly.facade.reserveAndRoute(proposal);
  if (reserved.kind !== "CONTINUE") throw new Error(`fixture head reservation failed: ${reserved.kind}`);
  const committed = await assembly.facade.commitReserved({
    proposal,
    continuation: reserved.continuation,
    producerAuthorization: assembly.producerAuthorizationIssuer.issue([
      { producer: "relationship", domain: "relationship" }
    ]),
    preparedBinding: {
      transition_id: transitionId as never,
      subject_id: "subject-s0" as never,
      transition_type: "Relationship",
      payload_fingerprint: reserved.continuation.payload_fingerprint,
      prepared_result_ref: `workflow:w-${transitionId}` as never
    },
    repository_bindings: [
      { repository_revision: "R0", repository_revision_hash: R0_HASH } as never
    ]
  });
  if (committed.kind !== "COMMITTED") throw new Error("fixture head commit failed");
}

function requestFor(
  episode: EpisodicMemoryRecordV0,
  counterpartRef: string = ALICE,
  subjectId: string = "subject-s0"
): ProcessInteractionExperienceRequestV0 {
  return {
    subject_id: subjectId as never,
    counterpart_ref: counterpartRef as never,
    episode
  };
}

async function expectedReceiptRef(
  episode: EpisodicMemoryRecordV0,
  qualifyingClass: string,
  payloadHash?: string
): Promise<string> {
  return deriveRelationshipInteractionFamiliarityEvidenceReceiptRefV0({
    schema_version: RELATIONSHIP_INTERACTION_FAMILIARITY_EVIDENCE_RECEIPT_SCHEMA_VERSION_V0,
    subject_id: "subject-s0" as never,
    counterpart_ref: ALICE as never,
    episode_ref: episode.episode_ref,
    episode_payload_hash: (payloadHash ?? (await computeMemoryRecordPayloadHash(episode))) as never,
    qualifying_class: qualifyingClass as never,
    evidence_admission_policy_id: RELATIONSHIP_INTERACTION_FAMILIARITY_EVIDENCE_ADMISSION_POLICY_ID_V0
  });
}

function familiarityOf(state: SubjectStateV0, counterpartRef: string): number | null {
  const counterparts = (state as unknown as Record<string, unknown>)["relationships"] as
    | { counterparts: readonly { counterpart_ref: string; dimensions: readonly { dimension_id: string; value: number }[] }[] }
    | undefined;
  const counterpart = counterparts?.counterparts.find((entry) => entry.counterpart_ref === counterpartRef);
  return counterpart?.dimensions.find((dimension) => dimension.dimension_id === FAMILIARITY)?.value ?? null;
}

// ---- canonical episode verification --------------------------------------------------------

describe("canonical episode verification", () => {
  it("rejects a nonexistent episode, a forged payload and an unbound subject memory", async () => {
    const episode1 = episodeFixture({ episode_ref: "episode:e-1" as never });
    const composition = await compose({ episodes: [episode1], counterparts: [{ counterpart_ref: ALICE, dimension_id: "arbitrary_host_dimension", value: 0.25 }] });
    await establishHead(composition, "t-head-1");

    // nonexistent episode
    const ghost = episodeFixture({ episode_ref: "episode:e-ghost" as never });
    expect(
      await processInteractionExperience(composition.deps, requestFor(ghost))
    ).toMatchObject({ kind: "REJECTED", code: "EPISODE_NOT_FOUND" });

    // forged/modified carrier: same episode_ref, different canonical content
    const forged = episodeFixture({
      episode_ref: "episode:e-1" as never,
      context: { ...episode1.context, scene: "totally different scene" }
    });
    expect(
      await processInteractionExperience(composition.deps, requestFor(forged))
    ).toMatchObject({ kind: "REJECTED", code: "EPISODE_PAYLOAD_HASH_MISMATCH" });

    // subject whose canonical memory revision does not bind the episode
    const otherSubject = seedState({ memoryRevision: "R-UNBOUND", counterparts: [{ counterpart_ref: ALICE, dimension_id: "arbitrary_host_dimension", value: 0.25 }], subjectId: "subject-s1" });
    const composition2 = await compose({
      episodes: [episode1],
      counterparts: [{ counterpart_ref: ALICE, dimension_id: "arbitrary_host_dimension", value: 0.25 }],
      extraSeedSubjects: [otherSubject]
    });
    await establishHead(composition2, "t-head-1");
    expect(
      await processInteractionExperience(composition2.deps, requestFor(episode1, ALICE, "subject-s1"))
    ).toMatchObject({ kind: "REJECTED", code: "EPISODE_NOT_BOUND_TO_SUBJECT_MEMORY" });
  });

  it("rejects an episode that does not reference the requested counterpart and an unregistered counterpart", async () => {
    const aliceEpisode = episodeFixture({ episode_ref: "episode:e-alice" as never });
    const bobEpisode = episodeFixture({
      episode_ref: "episode:e-bob" as never,
      references: [BOB as never],
      context: { scene: "met bob", focus_refs: [BOB as never], environment_refs: [] }
    });
    const composition = await compose({
      episodes: [aliceEpisode, bobEpisode],
      counterparts: [
        { counterpart_ref: ALICE, dimension_id: "arbitrary_host_dimension", value: 0.25 }
      ]
    });
    await establishHead(composition, "t-head-1");

    // bob is referenced by the episode but NOT canonically registered
    expect(
      await processInteractionExperience(composition.deps, requestFor(bobEpisode, BOB))
    ).toMatchObject({ kind: "REJECTED", code: "COUNTERPART_NOT_REGISTERED" });

    // alice IS registered but the episode does not reference her
    expect(
      await processInteractionExperience(composition.deps, requestFor(bobEpisode, ALICE))
    ).toMatchObject({ kind: "REJECTED", code: "EPISODE_DOES_NOT_REFERENCE_COUNTERPART" });
  });

  it("rejects a malformed candidate record", async () => {
    const composition = await compose({
      episodes: [],
      counterparts: [{ counterpart_ref: ALICE, dimension_id: "arbitrary_host_dimension", value: 0.25 }]
    });
    await establishHead(composition, "t-head-1");
    const malformed = { schema_version: "episodic-memory-record-v0", nonsense: true };
    expect(
      await processInteractionExperience(composition.deps, {
        subject_id: "subject-s0" as never,
        counterpart_ref: ALICE as never,
        episode: malformed as never
      })
    ).toMatchObject({ kind: "REJECTED", code: "EPISODE_MALFORMED" });
  });
});

// ---- semantic admission -------------------------------------------------------------------

describe("semantic admission boundary", () => {
  it("ABSTAIN produces no familiarity mutation and no commit", async () => {
    const episode = episodeFixture({ episode_ref: "episode:e-abstain" as never });
    const composition = await compose({
      episodes: [episode],
      counterparts: [{ counterpart_ref: ALICE, dimension_id: "arbitrary_host_dimension", value: 0.25 }],
      provider: deterministicProvider(new Map([[episode.episode_ref, "ABSTAIN"]]))
    });
    await establishHead(composition, "t-head-1");
    const before = composition.assembly.storeRead.getCommittedBundles().length;
    const outcome = await processInteractionExperience(composition.deps, requestFor(episode));
    expect(outcome).toMatchObject({ kind: "NOT_QUALIFIED_ABSTAINED" });
    expect(composition.assembly.storeRead.getCommittedBundles().length).toBe(before);
    expect(familiarityOf(await composition.assembly.storeRead.readCurrentState("subject-s0") as SubjectStateV0, ALICE)).toBeNull();
  });

  it("rejects provider outputs outside the closed vocabulary and magnitude-shaped extras", async () => {
    const episode = episodeFixture({ episode_ref: "episode:e-bad-provider" as never });
    const composition = await compose({
      episodes: [episode],
      counterparts: [{ counterpart_ref: ALICE, dimension_id: "arbitrary_host_dimension", value: 0.25 }]
    });
    await establishHead(composition, "t-head-1");
    const invalidProvider: RelationshipInteractionQualifyingAdmissionProviderV0 = {
      admit: async () => ({ kind: "QUALIFYING", qualifying_class: "SOME_NEW_CLASS" } as never)
    };
    expect(
      await processInteractionExperience({ ...composition.deps, admissionProvider: invalidProvider }, requestFor(episode))
    ).toMatchObject({ kind: "REJECTED", code: "ADMISSION_PROVIDER_INVALID_OUTPUT" });

    const magnitudeProvider: RelationshipInteractionQualifyingAdmissionProviderV0 = {
      admit: async () =>
        ({ kind: "QUALIFYING", qualifying_class: "DIRECT_COMMUNICATION", magnitude: 0.9 }) as never
    };
    expect(
      await processInteractionExperience({ ...composition.deps, admissionProvider: magnitudeProvider }, requestFor(episode))
    ).toMatchObject({ kind: "REJECTED", code: "ADMISSION_PROVIDER_INVALID_OUTPUT" });

    // the closed outcome vocabulary has exactly the three classes + ABSTAIN
    expect([...RELATIONSHIP_INTERACTION_QUALIFYING_ADMISSION_CLASSES_V0]).toStrictEqual([
      "DIRECT_COMMUNICATION",
      "SHARED_ACTIVITY",
      "DIRECTLY_OBSERVED_COUNTERPART_ACTION",
      "ABSTAIN"
    ]);
  });
});

// ---- lived E2E -----------------------------------------------------------------------------

describe("lived familiarity updates end-to-end", () => {
  it("first qualifying episode: receipt → INITIALIZE → V2 commit → 1/32 → RESOLVED_VALID", async () => {
    const episode1 = episodeFixture({ episode_ref: "episode:e-1" as never });
    const composition = await compose({
      episodes: [episode1],
      counterparts: [{ counterpart_ref: ALICE, dimension_id: "arbitrary_host_dimension", value: 0.25 }]
    });
    await establishHead(composition, "t-head-1");

    const outcome = await processInteractionExperience(composition.deps, requestFor(episode1));
    expect(outcome.kind).toBe("QUALIFIED_AND_COMMITTED");
    if (outcome.kind !== "QUALIFIED_AND_COMMITTED") return;
    expect(outcome.replayed).toBe(false);
    expect(outcome.qualifying_class).toBe("DIRECT_COMMUNICATION");
    expect(outcome.familiarity.previous).toStrictEqual({ kind: "ABSENT" });
    expect(outcome.familiarity.next).toBe(1 / 32);
    expect(outcome.evidence_receipt_refs).toHaveLength(1);
    // deterministic frozen receipt binding the verified episode
    expect(outcome.evidence_receipt_refs[0]).toBe(await expectedReceiptRef(episode1, "DIRECT_COMMUNICATION"));
    // the transition id is the deterministic experience identity
    expect(outcome.transition_id.startsWith("t-fam-ingest-")).toBe(true);

    // committed canonical state
    const state = await composition.assembly.storeRead.readCurrentState("subject-s0");
    expect(familiarityOf(state as SubjectStateV0, ALICE)).toBe(1 / 32);

    // the durable authority record resolves RESOLVED_VALID historically
    const bundle = composition.assembly.storeRead.readCommittedByTransitionId(outcome.transition_id) as AtomicCommitBundleV2;
    expect(bundle.commit_version).toBe("atomic-commit-v2");
    expect(bundle.writer_authority).not.toBeNull();
    const resolution = await classifyHistoricalWriterAuthorityStatusV0(
      bundle.writer_authority as never
    );
    expect(resolution.status).toBe("RESOLVED_VALID");
    expect(resolution.feature_layer).toBe("ADMITTED");
  });

  it("second unique episode: 2/32 with the exact cumulative evidence lineage", async () => {
    const episode1 = episodeFixture({ episode_ref: "episode:e-1" as never });
    const episode2 = episodeFixture({
      episode_ref: "episode:e-2" as never,
      context: { scene: "cooked dinner with alice", focus_refs: [ALICE as never], environment_refs: [] }
    });
    const composition = await compose({
      episodes: [episode1, episode2],
      counterparts: [{ counterpart_ref: ALICE, dimension_id: "arbitrary_host_dimension", value: 0.25 }]
    });
    await establishHead(composition, "t-head-1");

    const first = await processInteractionExperience(composition.deps, requestFor(episode1));
    expect(first).toMatchObject({ kind: "QUALIFIED_AND_COMMITTED", familiarity: { next: 1 / 32 } });
    const second = await processInteractionExperience(composition.deps, requestFor(episode2));
    expect(second.kind).toBe("QUALIFIED_AND_COMMITTED");
    if (second.kind !== "QUALIFIED_AND_COMMITTED") return;
    expect(second.familiarity.previous).toStrictEqual({ kind: "PRESENT", value: 1 / 32 });
    expect(second.familiarity.next).toBe(2 / 32);

    const r1 = await expectedReceiptRef(episode1, "DIRECT_COMMUNICATION");
    const r2 = await expectedReceiptRef(episode2, "DIRECT_COMMUNICATION");
    expect(second.evidence_receipt_refs).toStrictEqual([r1, r2]);

    const state = await composition.assembly.storeRead.readCurrentState("subject-s0");
    expect(familiarityOf(state as SubjectStateV0, ALICE)).toBe(2 / 32);
  });

  it("exact workflow retry replays idempotently and never double-credits", async () => {
    const episode1 = episodeFixture({ episode_ref: "episode:e-1" as never });
    const composition = await compose({
      episodes: [episode1],
      counterparts: [{ counterpart_ref: ALICE, dimension_id: "arbitrary_host_dimension", value: 0.25 }]
    });
    await establishHead(composition, "t-head-1");
    const first = await processInteractionExperience(composition.deps, requestFor(episode1));
    expect(first).toMatchObject({ kind: "QUALIFIED_AND_COMMITTED" });
    const bundlesAfterFirst = composition.assembly.storeRead.getCommittedBundles().length;

    const retry = await processInteractionExperience(composition.deps, requestFor(episode1));
    expect(retry.kind).toBe("QUALIFIED_AND_COMMITTED");
    if (first.kind !== "QUALIFIED_AND_COMMITTED" || retry.kind !== "QUALIFIED_AND_COMMITTED") return;
    expect(retry.replayed).toBe(true);
    expect(retry.commit_ref).toBe(first.commit_ref);
    expect(retry.familiarity.next).toBe(1 / 32);
    expect(composition.assembly.storeRead.getCommittedBundles().length).toBe(bundlesAfterFirst);
    const state = await composition.assembly.storeRead.readCurrentState("subject-s0");
    expect(familiarityOf(state as SubjectStateV0, ALICE)).toBe(1 / 32);
  });

  it("a qualifying interaction with Bob never increases familiarity(subject, Alice)", async () => {
    const bobEpisode = episodeFixture({
      episode_ref: "episode:e-bob-1" as never,
      references: [BOB as never],
      context: { scene: "joined bob for a run", focus_refs: [BOB as never], environment_refs: [] }
    });
    const composition = await compose({
      episodes: [bobEpisode],
      counterparts: [
        { counterpart_ref: ALICE, dimension_id: "arbitrary_host_dimension", value: 0.25 },
        { counterpart_ref: BOB, dimension_id: "arbitrary_host_dimension", value: 0.4 }
      ]
    });
    await establishHead(composition, "t-head-1");
    const outcome = await processInteractionExperience(composition.deps, requestFor(bobEpisode, BOB));
    expect(outcome).toMatchObject({ kind: "QUALIFIED_AND_COMMITTED", familiarity: { next: 1 / 32 } });
    const state = await composition.assembly.storeRead.readCurrentState("subject-s0") as SubjectStateV0;
    expect(familiarityOf(state, ALICE)).toBeNull();
    expect(familiarityOf(state, BOB)).toBe(1 / 32);
  });

  it("reports observation facts only — no authority handles in the result", async () => {
    const episode = episodeFixture({ episode_ref: "episode:e-surface" as never });
    const composition = await compose({
      episodes: [episode],
      counterparts: [{ counterpart_ref: ALICE, dimension_id: "arbitrary_host_dimension", value: 0.25 }]
    });
    await establishHead(composition, "t-head-1");
    const outcome = await processInteractionExperience(composition.deps, requestFor(episode));
    expect(outcome.kind).toBe("QUALIFIED_AND_COMMITTED");
    if (outcome.kind !== "QUALIFIED_AND_COMMITTED") return;
    expect(Object.keys(outcome).sort()).toStrictEqual(
      [
        "commit_ref",
        "evidence_receipt_refs",
        "familiarity",
        "kind",
        "qualifying_class",
        "replayed",
        "transition_id"
      ].sort()
    );
    const serialized = JSON.stringify(outcome);
    expect(serialized.includes("token")).toBe(false);
    expect(serialized.includes("capability")).toBe(false);
    expect(serialized.includes("writer_authority")).toBe(false);
  });
});

// ---- saturation -----------------------------------------------------------------------------

describe("saturation", () => {
  it("32 credits reach 1; the 33rd qualifying episode produces NO familiarity commit", { timeout: 60_000 }, async () => {
    const episodes = Array.from({ length: 33 }, (_, i) =>
      episodeFixture({
        episode_ref: `episode:e-sat-${i + 1}` as never,
        context: {
          scene: `saturation qualifying interaction number ${i + 1} with alice`,
          focus_refs: [ALICE as never],
          environment_refs: []
        }
      })
    );
    const composition = await compose({
      episodes,
      counterparts: [{ counterpart_ref: ALICE, dimension_id: "arbitrary_host_dimension", value: 0.25 }]
    });
    await establishHead(composition, "t-head-1");

    for (const [index, episode] of episodes.entries()) {
      const outcome = await processInteractionExperience(composition.deps, requestFor(episode));
      if (index < 32) {
        expect(outcome.kind, `episode ${index + 1}`).toBe("QUALIFIED_AND_COMMITTED");
      } else {
        expect(outcome).toMatchObject({
          kind: "QUALIFIED_BUT_SATURATED",
          familiarity_current: 1
        });
      }
    }
    const state = await composition.assembly.storeRead.readCurrentState("subject-s0") as SubjectStateV0;
    expect(familiarityOf(state, ALICE)).toBe(1);
    const bundles = composition.assembly.storeRead.getCommittedBundles();
    // head + 32 familiarity commits; the 33rd produced no governed commit
    expect(bundles.length).toBe(33);
    expect(bundles.filter((bundle) => (bundle as { writer_authority?: unknown }).writer_authority !== null)).toHaveLength(32);
  });
});

// ---- frozen regressions ---------------------------------------------------------------------

describe("frozen regressions with ingestion present", () => {
  it("an ordinary non-governed commit after ingestion keeps writer_authority null", async () => {
    const episode = episodeFixture({ episode_ref: "episode:e-ord" as never });
    const composition = await compose({
      episodes: [episode],
      counterparts: [{ counterpart_ref: ALICE, dimension_id: "arbitrary_host_dimension", value: 0.25 }]
    });
    await establishHead(composition, "t-head-1");
    expect(
      await processInteractionExperience(composition.deps, requestFor(episode))
    ).toMatchObject({ kind: "QUALIFIED_AND_COMMITTED" });

    await establishHead(composition, "t-head-after-ingest");
    const ordinary = composition.assembly.storeRead
      .getCommittedBundles()
      .find((bundle) => bundle.commit_ref !== undefined && (bundle as { transition_id?: string }).transition_id === "t-head-after-ingest") as AtomicCommitBundleAnyVersion | undefined;
    expect(ordinary).toBeDefined();
    if (ordinary === undefined) return;
    expect((ordinary as { writer_authority?: unknown }).writer_authority).toBeNull();
  });
});
