/**
 * Interaction Familiarity Retrieval Orchestration V0 — Layer-B acceptance suite
 * (RELATIONSHIP_FAMILIARITY_RETRIEVAL_ORCHESTRATION_V0):
 *
 *   TRIGGER       the frozen influence artifact is the ONLY trigger source:
 *                 BASIC_CONTEXT_FIRST / no influence → ZERO familiarity-priority
 *                 retrieval; COUNTERPART_CONTEXT_SEARCH_FIRST → EXACTLY ONE
 *                 exact-counterpart attempt
 *   BINDING       Alice influence → exact Alice query (semantic_reference and
 *                 sole entity_ref); Bob familiarity never redirects an Alice
 *                 query; no alias/fuzzy matching
 *   QUERY         host-owned deterministic construction over the current
 *                 canonical snapshot; existing fingerprint validation passes
 *   RESULT        valid results accepted through the EXISTING validation law;
 *                 empty results are successful outcomes with no invented
 *                 context; tampered/throwing retrievals are RETRIEVAL_FAILED,
 *                 never silent "no memory exists"
 *   POLICY BAND   1/32 → zero attempts; 2/32, 16/32, 32/32 → exactly one
 *                 attempt; 2/32 and 16/32 retrieve IDENTICALLY (categorical)
 *   LAYER B       real lived histories through the frozen ingestion path:
 *                 Arm A (1 experience → 1/32 → BASIC → 0 attempts) vs Arm B
 *                 (16 experiences → 16/32 → SEARCH_FIRST → exactly 1 Alice
 *                 attempt) — real-model calls ZERO
 *   RESTORE       strategy and retrieval behavior survive authoritative restore;
 *                 identical canonical inputs → identical query fingerprints
 *
 * The retrieval engine is the EXISTING InMemoryRetrievalService (the reference
 * Memory retrieval adapter with its declared-rehearsal contract); the test's
 * counting wrapper is test-only instrumentation. Fully OFFLINE.
 */

import { describe, expect, it } from "vitest";

import {
  createInMemorySubjectCoreFacade,
  createPersistenceEnvelope,
  type SubjectStateV0
} from "@characteros-next/subject-core";
import {
  InMemoryMemoryRepository,
  InMemoryRetrievalService,
  validateMemoryRetrievalResult,
  type EpisodicMemoryRecordV0,
  type MemoryRetrievalQueryV0,
  type MemoryRetrievalService,
  type MemoryRetrievalResultV0,
  type RetrievalRehearsalV0
} from "@characteros-next/memory";

import { buildCognitiveContextProjection } from "../cognition-action/cognition-action-transition-executor.js";
import {
  orchestrateInteractionFamiliarityRetrievalV0,
  buildInteractionFamiliarityCounterpartQueryV0,
  RELATIONSHIP_FAMILIARITY_RETRIEVAL_ORCHESTRATION_SCHEMA_VERSION_V0
} from "./relationship-interaction-familiarity-retrieval-orchestration.js";
import { restoreCanonicalSubjectFromHistoryV0 } from "../../authority/restore-chain-authority.js";
import { mintTrustedCanonicalHistoryBoundaryV0 } from "../../authority/trusted-canonical-history-boundary.js";
import {
  processInteractionExperience,
  type InteractionFamiliarityIngestionDepsV0
} from "./relationship-interaction-familiarity-ingestion.js";
import { INTERACTION_FAMILIARITY_DIMENSION_ID_V0 } from "./relationship-feature-decision-semantics.js";

const ALICE = "entity:alice-like";
const BOB = "entity:bob-like";
const FAMILIARITY = INTERACTION_FAMILIARITY_DIMENSION_ID_V0;
const R0_HASH = "sha256:4444444444444444444444444444444444444444444444444444444444444444";
const SCENARIO_SCENE = `Alice says: "Can you help me revise that update in the usual way?"`;

// ---- causal-arm fixtures (real frozen ingestion path) --------------------------------------

function subjectState(input: {
  readonly counterparts: readonly {
    readonly counterpart_ref: string;
    readonly dimensions: readonly { dimension_id: string; value: number }[];
  }[];
  readonly activeEntityRefs?: readonly string[];
}): SubjectStateV0 {
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
    relationships: {
      schema_version: "relationship-state-v0",
      counterparts: input.counterparts.map((entry) => ({
        counterpart_ref: entry.counterpart_ref,
        dimensions: [...entry.dimensions]
      }))
    },
    mood: { baseline: 0, generated_under_profile: null, last_update: null },
    affect: { active_channels: [], generated_under_profile: null, updated_at: null },
    regulation: { energy: 1, stress: 0, arousal: 0.5, fatigue: 0, last_update: null },
    context: {
      scene: SCENARIO_SCENE,
      task: "revise the update",
      focus_refs: [],
      active_entity_refs: (input.activeEntityRefs ?? []) as never,
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

function causalEpisode(index: number): EpisodicMemoryRecordV0 {
  return {
    schema_version: "episodic-memory-record-v0",
    episode_ref: `episode:e-causal-${index + 1}` as never,
    occurrence_logical_time: 1 as never,
    recorded_at_logical_time: 1 as never,
    provenance: { transition_id: `t-enc-${index + 1}` as never, producer: "memory", cause_refs: [] },
    references: [ALICE as never],
    context: {
      scene: `qualifying firsthand interaction number ${index + 1} with alice`,
      focus_refs: [ALICE as never],
      environment_refs: []
    },
    appraisal_ref: null,
    affect_snapshot_ref: null,
    salience: { declared_score: 0.5 as never, source: "ENCODING_DECLARED_V0" }
  };
}

interface CausalComposition {
  readonly deps: InteractionFamiliarityIngestionDepsV0;
  readonly assembly: ReturnType<typeof createInMemorySubjectCoreFacade>;
  readonly genesis: SubjectStateV0;
  readonly memoryRevision: string;
}

async function composeCausalArm(count: number): Promise<CausalComposition> {
  const memory = new InMemoryMemoryRepository();
  const records: { ref: never; payload_hash: never }[] = [];
  for (let index = 0; index < count; index++) {
    const episode = causalEpisode(index);
    const storedHash = await memory.storePayload(episode.episode_ref as never, episode);
    records.push({ ref: episode.episode_ref as never, payload_hash: storedHash } as never);
  }
  records.sort((a, b) => (a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0));
  const prepared = await memory.prepareRevisionForIntent({
    intent_id: `intent-layerb-${count}` as never,
    parent_revision: null,
    records
  });
  const genesis = subjectState({
    counterparts: [{ counterpart_ref: ALICE, dimensions: [{ dimension_id: "arbitrary_host_dimension", value: 0.25 }] }],
    activeEntityRefs: [ALICE]
  });
  (genesis as unknown as Record<string, unknown>)["memory_state"] = {
    ...((genesis as unknown as Record<string, unknown>)["memory_state"] as Record<string, unknown>),
    repository_revision: prepared.repository_revision
  };
  const assembly = createInMemorySubjectCoreFacade({
    seedSnapshots: new Map([["subject-s0" as never, genesis]]),
    preparedResultValidator: async () => true
  });
  return {
    deps: {
      memory,
      assembly,
      admissionProvider: {
        admit: async () => ({ kind: "QUALIFYING", qualifying_class: "DIRECT_COMMUNICATION" })
      },
      repositoryBindings: [{ repository_revision: "R0", repository_revision_hash: R0_HASH } as never],
      readGenesisSnapshot: async () => genesis
    },
    assembly,
    genesis,
    memoryRevision: prepared.repository_revision
  };
}

async function establishCausalHead(composition: CausalComposition): Promise<void> {
  const { assembly } = composition;
  const currentState = (await assembly.storeRead.readCurrentState("subject-s0")) as SubjectStateV0;
  const revision = (currentState as unknown as { runtime_metadata: { state_revision: number } })
    .runtime_metadata.state_revision;
  const proposal = {
    schema_version: "canonical-transition-proposal-v1",
    transition_id: "t-layerb-head",
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
        operations: [
          {
            path: "/relationships",
            value: {
              schema_version: "relationship-state-v0",
              counterparts: [
                { counterpart_ref: ALICE, dimensions: [{ dimension_id: "arbitrary_host_dimension", value: 0.25 }] }
              ]
            }
          }
        ],
        provenance_refs: []
      }
    ],
    external_refs: []
  } as unknown as never;
  const reserved = await assembly.facade.reserveAndRoute(proposal as never);
  if (reserved.kind !== "CONTINUE") throw new Error("fixture head reservation failed");
  const committed = await assembly.facade.commitReserved({
    proposal: proposal as never,
    continuation: reserved.continuation,
    producerAuthorization: assembly.producerAuthorizationIssuer.issue([
      { producer: "relationship", domain: "relationship" }
    ]),
    preparedBinding: {
      transition_id: "t-layerb-head" as never,
      subject_id: "subject-s0" as never,
      transition_type: "Relationship",
      payload_fingerprint: reserved.continuation.payload_fingerprint,
      prepared_result_ref: "workflow:w-t-layerb-head" as never
    },
    repository_bindings: [{ repository_revision: "R0", repository_revision_hash: R0_HASH } as never]
  });
  if (committed.kind !== "COMMITTED") throw new Error("fixture head commit failed");
}

async function ingestArm(composition: CausalComposition, count: number): Promise<SubjectStateV0> {
  for (let index = 0; index < count; index++) {
    const outcome = await processInteractionExperience(composition.deps, {
      subject_id: "subject-s0" as never,
      counterpart_ref: ALICE as never,
      episode: causalEpisode(index)
    });
    expect(outcome.kind, `episode ${index + 1}`).toBe("QUALIFIED_AND_COMMITTED");
  }
  return (await composition.assembly.storeRead.readCurrentState("subject-s0")) as SubjectStateV0;
}

// ---- retrieval instrumentation (test-only counting wrapper) -----------------------------------

function countingRetrievalService(inner: MemoryRetrievalService): {
  readonly service: MemoryRetrievalService;
  readonly queries: MemoryRetrievalQueryV0[];
} {
  const queries: MemoryRetrievalQueryV0[] = [];
  return {
    queries,
    service: {
      retrieve: async (query) => {
        queries.push(query);
        return inner.retrieve(query);
      }
    }
  };
}

function rehearsalFor(memoryRevision: string, withAliceEvidence: boolean): RetrievalRehearsalV0 {
  if (!withAliceEvidence) {
    // revision-known but no Alice anchor → LEGAL EMPTY retrieval
    return {
      repository_revision: memoryRevision as never,
      semantic_reference: null,
      selected_memory_refs: [],
      evidence: [],
      candidate_count: 0,
      retrieval_trace_ref: null
    };
  }
  return {
    repository_revision: memoryRevision as never,
    semantic_reference: ALICE as never,
    selected_memory_refs: ["episode:e-causal-1" as never],
    evidence: [
      {
        episode_ref: "episode:e-causal-1" as never,
        reasons: [{ dimension: "ENTITY", score: 0.8 } as never]
      }
    ],
    candidate_count: 1,
    retrieval_trace_ref: null
  };
}

// ---- trigger law -------------------------------------------------------------------------------

describe("trigger law", () => {
  it("BASIC_CONTEXT_FIRST (1/32) issues ZERO familiarity-priority retrievals", { timeout: 60_000 }, async () => {
    const composition = await composeCausalArm(1);
    await establishCausalHead(composition);
    const state = await ingestArm(composition, 1);
    const projection = await buildCognitiveContextProjection(state);
    expect(projection.interaction_familiarity_cognition_influences[0]?.context_resolution_strategy).toBe(
      "BASIC_CONTEXT_FIRST"
    );

    const { service, queries } = countingRetrievalService(
      new InMemoryRetrievalService({ rehearsals: [rehearsalFor(composition.memoryRevision, true)] })
    );
    const orchestration = await orchestrateInteractionFamiliarityRetrievalV0({
      influences: projection.interaction_familiarity_cognition_influences,
      retrieval: service,
      buildCounterpartQuery: (ref) => buildInteractionFamiliarityCounterpartQueryV0(state, ref)
    });
    expect(orchestration.schema_version).toBe(RELATIONSHIP_FAMILIARITY_RETRIEVAL_ORCHESTRATION_SCHEMA_VERSION_V0);
    expect(orchestration.attempts).toStrictEqual([]);
    expect(orchestration.no_priority_request_count).toBe(1);
    expect(orchestration.attempted_count).toBe(0);
    expect(queries).toHaveLength(0);
  });

  it("no influence at all requests no priority retrieval", async () => {
    const { service, queries } = countingRetrievalService(
      new InMemoryRetrievalService({ rehearsals: [] })
    );
    const orchestration = await orchestrateInteractionFamiliarityRetrievalV0({
      influences: [],
      retrieval: service,
      buildCounterpartQuery: (ref) => buildInteractionFamiliarityCounterpartQueryV0({} as never, ref)
    });
    expect(orchestration.attempts).toStrictEqual([]);
    expect(orchestration.no_priority_request_count).toBe(0);
    expect(queries).toHaveLength(0);
  });
});

// ---- Layer-B causal proof ------------------------------------------------------------------------

describe("Layer-B deterministic causal proof (real lived histories)", () => {
  it(
    "Arm B: 16 real experiences → 16/32 → SEARCH_FIRST → EXACTLY ONE exact-Alice retrieval with validated evidence",
    { timeout: 120_000 },
    async () => {
      const composition = await composeCausalArm(16);
      await establishCausalHead(composition);
      const state = await ingestArm(composition, 16);
      const projection = await buildCognitiveContextProjection(state);
      expect(projection.interaction_familiarity_cognition_influences[0]?.context_resolution_strategy).toBe(
        "COUNTERPART_CONTEXT_SEARCH_FIRST"
      );

      const { service, queries } = countingRetrievalService(
        new InMemoryRetrievalService({ rehearsals: [rehearsalFor(composition.memoryRevision, true)] })
      );
      const orchestration = await orchestrateInteractionFamiliarityRetrievalV0({
        influences: projection.interaction_familiarity_cognition_influences,
        retrieval: service,
        buildCounterpartQuery: (ref) => buildInteractionFamiliarityCounterpartQueryV0(state, ref)
      });

      expect(orchestration.attempted_count).toBe(1);
      expect(orchestration.attempted_with_usable_evidence_count).toBe(1);
      expect(orchestration.retrieval_failed_count).toBe(0);
      expect(queries).toHaveLength(1);
      const attempt = orchestration.attempts[0];
      expect(attempt?.counterpart_ref).toBe(ALICE);
      expect(attempt?.triggering_strategy).toBe("COUNTERPART_CONTEXT_SEARCH_FIRST");
      expect(attempt?.outcome).toBe("ATTEMPTED_WITH_USABLE_EVIDENCE");
      expect(attempt?.selected_memory_refs).toStrictEqual(["episode:e-causal-1"]);
      expect(attempt?.candidate_count).toBe(1);
      expect(attempt?.query_fingerprint).toMatch(/^sha256:[0-9a-f]{64}$/);

      // exact query binding: the executed query carries the exact canonical
      // Alice counterpart, the current revision, and passes existing validation
      const executed = queries[0] as MemoryRetrievalQueryV0;
      expect(executed.semantic_reference).toBe(ALICE);
      expect(executed.entity_refs).toStrictEqual([ALICE]);
      expect(executed.subject_id).toBe("subject-s0");
      expect(executed.repository_revision).toBe(composition.memoryRevision);
      const queryCheck = await validateMemoryRetrievalResult(
        {
          schema_version: "memory-retrieval-result-v0",
          subject_id: executed.subject_id,
          selected_memory_refs: ["episode:e-causal-1"],
          evidence: [{ episode_ref: "episode:e-causal-1", reasons: [{ dimension: "ENTITY", score: 0.8 }] }],
          retrieval_trace_ref: null,
          deterministic_metadata: {
            repository_revision: executed.repository_revision,
            candidate_count: 1,
            computed_under_config: "MEMORY_RETRIEVAL_V0",
            query_fingerprint: attempt?.query_fingerprint
          }
        },
        executed
      );
      expect(queryCheck.ok).toBe(true);
    }
  );
});

// ---- query binding + isolation ----------------------------------------------------------------------

describe("exact binding and counterpart isolation", () => {
  it("Bob familiarity never redirects an Alice-bound retrieval", { timeout: 120_000 }, async () => {
    // Unit-negative isolation control (hand-built source state is permitted
    // here): Alice 1/32 active; Bob registered with 16/32 but NOT active.
    // The primary causal proofs below use only real ingestion arms.
    const composition = await composeCausalArm(16);
    // isolate: Bob registered but INACTIVE with high familiarity; Alice 1/32 active
    const isolatedState = subjectState({
      counterparts: [
        { counterpart_ref: ALICE, dimensions: [{ dimension_id: FAMILIARITY, value: 1 / 32 }] },
        { counterpart_ref: BOB, dimensions: [{ dimension_id: FAMILIARITY, value: 16 / 32 }] }
      ],
      activeEntityRefs: [ALICE]
    });
    const projection = await buildCognitiveContextProjection(isolatedState);
    const aliceInfluence = projection.interaction_familiarity_cognition_influences.find(
      (influence) => influence.counterpart_ref === ALICE
    );
    expect(aliceInfluence?.context_resolution_strategy).toBe("BASIC_CONTEXT_FIRST");
    expect(
      projection.interaction_familiarity_cognition_influences.find(
        (influence) => influence.counterpart_ref === BOB
      )
    ).toBeUndefined();

    const { service, queries } = countingRetrievalService(
      new InMemoryRetrievalService({ rehearsals: [rehearsalFor(composition.memoryRevision, true)] })
    );
    const orchestration = await orchestrateInteractionFamiliarityRetrievalV0({
      influences: projection.interaction_familiarity_cognition_influences,
      retrieval: service,
      buildCounterpartQuery: (ref) => buildInteractionFamiliarityCounterpartQueryV0(isolatedState, ref)
    });
    expect(orchestration.attempted_count).toBe(0);
    expect(queries).toHaveLength(0);

    // unit-level: a SEARCH_FIRST Bob influence builds ONLY a Bob query — the
    // orchestrator binds the exact counterpart of each influence, no aliases
    const bobOnly = await orchestrateInteractionFamiliarityRetrievalV0({
      influences: [
        {
          schema_version: "relationship-interaction-familiarity-cognition-influence-v0",
          counterpart_ref: BOB as never,
          context_resolution_strategy: "COUNTERPART_CONTEXT_SEARCH_FIRST"
        }
      ],
      retrieval: service,
      buildCounterpartQuery: (ref) => buildInteractionFamiliarityCounterpartQueryV0(isolatedState, ref)
    });
    expect(bobOnly.attempts[0]?.counterpart_ref).toBe(BOB);
    expect(queries.every((query) => query.semantic_reference === BOB)).toBe(true);
    expect(queries.every((query) => query.entity_refs.length === 1 && query.entity_refs[0] === BOB)).toBe(true);
  });

  it("empty results are successful outcomes with no invented context and no familiarity mutation", { timeout: 120_000 }, async () => {
    const composition = await composeCausalArm(16);
    await establishCausalHead(composition);
    const state = await ingestArm(composition, 16);
    const projection = await buildCognitiveContextProjection(state);
    const revisionBefore = (state as unknown as { runtime_metadata: { state_revision: number } }).runtime_metadata
      .state_revision;

    // revision known, no Alice rehearsal → LEGAL EMPTY retrieval
    const { service, queries } = countingRetrievalService(
      new InMemoryRetrievalService({ rehearsals: [rehearsalFor(composition.memoryRevision, false)] })
    );
    const orchestration = await orchestrateInteractionFamiliarityRetrievalV0({
      influences: projection.interaction_familiarity_cognition_influences,
      retrieval: service,
      buildCounterpartQuery: (ref) => buildInteractionFamiliarityCounterpartQueryV0(state, ref)
    });
    expect(orchestration.attempted_count).toBe(1);
    expect(orchestration.attempted_empty_count).toBe(1);
    expect(orchestration.attempted_with_usable_evidence_count).toBe(0);
    expect(orchestration.attempts[0]?.selected_memory_refs).toStrictEqual([]);
    expect(queries).toHaveLength(1);
    // no familiarity mutation occurred
    const stateAfter = (await composition.assembly.storeRead.readCurrentState("subject-s0")) as SubjectStateV0;
    expect(
      (stateAfter as unknown as { runtime_metadata: { state_revision: number } }).runtime_metadata.state_revision
    ).toBe(revisionBefore);
  });
});

// ---- policy band + result validation -----------------------------------------------------------------

describe("policy band and result validation", () => {
  it("2/32 and 16/32 retrieve IDENTICALLY — one attempt, same categorical artifact", { timeout: 120_000 }, async () => {
    for (const [count, expectedOrdinal] of [
      [2, 2],
      [16, 16]
    ] as const) {
      const composition = await composeCausalArm(count);
      await establishCausalHead(composition);
      const state = await ingestArm(composition, count);
      const projection = await buildCognitiveContextProjection(state);
      const readSource = projection.interaction_familiarity.find(
        (entry) => entry.counterpart_ref === ALICE
      );
      expect(readSource?.ordinal_level).toBe(expectedOrdinal);
      expect(projection.interaction_familiarity_cognition_influences[0]?.context_resolution_strategy).toBe(
        "COUNTERPART_CONTEXT_SEARCH_FIRST"
      );

      const { service, queries } = countingRetrievalService(
        new InMemoryRetrievalService({ rehearsals: [rehearsalFor(composition.memoryRevision, true)] })
      );
      const orchestration = await orchestrateInteractionFamiliarityRetrievalV0({
        influences: projection.interaction_familiarity_cognition_influences,
        retrieval: service,
        buildCounterpartQuery: (ref) => buildInteractionFamiliarityCounterpartQueryV0(state, ref)
      });
      expect(orchestration.attempted_count).toBe(1);
      expect(orchestration.attempts[0]?.outcome).toBe("ATTEMPTED_WITH_USABLE_EVIDENCE");
      expect(orchestration.attempts[0]?.selected_memory_refs).toStrictEqual(["episode:e-causal-1"]);
      expect(queries).toHaveLength(1);
    }
  });

  it("a tampered result or a throwing engine is RETRIEVAL_FAILED — never silent emptiness", async () => {
    const influences = [
      {
        schema_version: "relationship-interaction-familiarity-cognition-influence-v0",
        counterpart_ref: ALICE as never,
        context_resolution_strategy: "COUNTERPART_CONTEXT_SEARCH_FIRST" as const
      }
    ] as never;
    const query = buildInteractionFamiliarityCounterpartQueryV0(
      subjectState({
        counterparts: [{ counterpart_ref: ALICE, dimensions: [{ dimension_id: FAMILIARITY, value: 16 / 32 }] }],
        activeEntityRefs: [ALICE]
      }),
      ALICE as never
    );

    // tampered fingerprint: existing validation law rejects it
    const tampered: MemoryRetrievalResultV0 = {
      schema_version: "memory-retrieval-result-v0",
      subject_id: "subject-s0" as never,
      selected_memory_refs: ["episode:e-forged" as never],
      evidence: [],
      retrieval_trace_ref: null,
      deterministic_metadata: {
        repository_revision: "R0" as never,
        candidate_count: 1,
        computed_under_config: "MEMORY_RETRIEVAL_V0",
        query_fingerprint: ("sha256:" + "0".repeat(64)) as never
      }
    };
    const tamperedOrchestration = await orchestrateInteractionFamiliarityRetrievalV0({
      influences,
      retrieval: { retrieve: async () => tampered },
      buildCounterpartQuery: () => query
    });
    expect(tamperedOrchestration.retrieval_failed_count).toBe(1);
    expect(tamperedOrchestration.attempts[0]?.outcome).toBe("RETRIEVAL_FAILED");
    expect(tamperedOrchestration.attempts[0]?.selected_memory_refs).toStrictEqual([]);

    // technical failure: marked RETRIEVAL_FAILED, never "no memory exists"
    const throwingOrchestration = await orchestrateInteractionFamiliarityRetrievalV0({
      influences,
      retrieval: {
        retrieve: async () => {
          throw new Error("retrieval backend unavailable");
        }
      },
      buildCounterpartQuery: () => query
    });
    expect(throwingOrchestration.retrieval_failed_count).toBe(1);
    expect(throwingOrchestration.attempts[0]?.outcome).toBe("RETRIEVAL_FAILED");
  });
});

// ---- restore proof --------------------------------------------------------------------------------------

describe("restore proof", () => {
  it(
    "strategy and retrieval behavior survive authoritative restore for both arms",
    { timeout: 180_000 },
    async () => {
      for (const [count, expectedStrategy, expectedAttempts] of [
        [1, "BASIC_CONTEXT_FIRST", 0],
        [16, "COUNTERPART_CONTEXT_SEARCH_FIRST", 1]
      ] as const) {
        const composition = await composeCausalArm(count);
        await establishCausalHead(composition);
        await ingestArm(composition, count);

        const liveState = (await composition.assembly.storeRead.readCurrentState("subject-s0")) as SubjectStateV0;
        const before = await buildCognitiveContextProjection(liveState);
        expect(before.interaction_familiarity_cognition_influences[0]?.context_resolution_strategy).toBe(
          expectedStrategy
        );

        // authoritative restore over the exact committed chain
        const bundles = composition.assembly.storeRead.getCommittedBundles();
        const terminal = bundles[bundles.length - 1];
        if (!terminal) throw new Error("fixture terminal bundle missing");
        const genesisEnvelope = await createPersistenceEnvelope({
          snapshot: composition.genesis,
          repository_bindings: [{ repository_revision: "R0", repository_revision_hash: R0_HASH } as never],
          commit_head: null
        });
        if (!genesisEnvelope.ok) throw new Error("fixture genesis envelope failed");
        const boundary = await mintTrustedCanonicalHistoryBoundaryV0({
          genesis: genesisEnvelope.value,
          head: {
            schema_version: "trusted-canonical-head-v0",
            subject_id: terminal.subject_id,
            revision: terminal.next_revision,
            commit_ref: terminal.commit_ref,
            record_checksum: terminal.record_checksum,
            state_hash: terminal.state_hash_after,
            snapshot_hash: terminal.snapshot_hash_after
          } as never
        });
        if (boundary.kind !== "MINTED") throw new Error("fixture boundary mint failed");
        const terminalEnvelope = await createPersistenceEnvelope({
          snapshot: terminal.next_snapshot,
          repository_bindings: [{ repository_revision: "R0", repository_revision_hash: R0_HASH } as never],
          commit_head: { commit_ref: terminal.commit_ref, record_checksum: terminal.record_checksum } as never
        });
        if (!terminalEnvelope.ok) throw new Error("fixture terminal envelope failed");
        const restored = await restoreCanonicalSubjectFromHistoryV0({
          persisted_envelope: terminalEnvelope.value,
          trusted_boundary: boundary.receipt,
          bundles
        });
        expect(restored.kind).toBe("RESTORED");
        if (restored.kind !== "RESTORED") continue;

        const after = await buildCognitiveContextProjection(restored.restored_snapshot as SubjectStateV0);
        expect(after.interaction_familiarity_cognition_influences).toStrictEqual(
          before.interaction_familiarity_cognition_influences
        );

        // identical canonical inputs → identical query fingerprints pre/post restore
        const { service: beforeService, queries: beforeQueries } = countingRetrievalService(
          new InMemoryRetrievalService({ rehearsals: [rehearsalFor(composition.memoryRevision, true)] })
        );
        const beforeOrchestration = await orchestrateInteractionFamiliarityRetrievalV0({
          influences: before.interaction_familiarity_cognition_influences,
          retrieval: beforeService,
          buildCounterpartQuery: (ref) => buildInteractionFamiliarityCounterpartQueryV0(liveState, ref)
        });
        const { service: afterService, queries: afterQueries } = countingRetrievalService(
          new InMemoryRetrievalService({ rehearsals: [rehearsalFor(composition.memoryRevision, true)] })
        );
        const afterOrchestration = await orchestrateInteractionFamiliarityRetrievalV0({
          influences: after.interaction_familiarity_cognition_influences,
          retrieval: afterService,
          buildCounterpartQuery: (ref) =>
            buildInteractionFamiliarityCounterpartQueryV0(restored.restored_snapshot as SubjectStateV0, ref)
        });
        expect(afterOrchestration.attempted_count).toBe(expectedAttempts);
        expect(afterOrchestration.attempted_count).toBe(beforeOrchestration.attempted_count);
        expect(afterOrchestration.attempts[0]?.outcome).toBe(beforeOrchestration.attempts[0]?.outcome);
        expect(afterOrchestration.attempts[0]?.selected_memory_refs).toStrictEqual(
          beforeOrchestration.attempts[0]?.selected_memory_refs
        );
        if (expectedAttempts === 1) {
          expect(afterQueries[0]?.repository_revision).toBe(beforeQueries[0]?.repository_revision);
          expect(afterOrchestration.attempts[0]?.query_fingerprint).toBe(
            beforeOrchestration.attempts[0]?.query_fingerprint
          );
        }
      }
    }
  );
});
