/**
 * NORMAL_EXECUTION_AUTO_INVOCATION — production-path integration suite
 * (RELATIONSHIP_FAMILIARY_RETRIEVAL_ORCHESTRATION_V0 integration repair).
 *
 * This suite proves that the familiarity-priority retrieval happens INSIDE
 * normal CharacterOS execution, not because a test calls the orchestrator:
 * the top-level action of every test below is the EXISTING
 * CognitionActionTransitionExecutor.execute — the normal product cognition
 * operation. The test body NEVER invokes
 * orchestrateInteractionFamiliarityRetrievalV0 and never supplies a
 * familiarity value, strategy, query or counterpart instruction.
 *
 *   ARM A (real ingestion: 1 qualifying Alice experience → 1/32):
 *     normal execution → BASIC_CONTEXT_FIRST → ZERO familiarity-priority
 *     retrieval calls; execution behavior unchanged.
 *   ARM B (real ingestion: 16 qualifying Alice experiences → 16/32):
 *     normal execution → COUNTERPART_CONTEXT_SEARCH_FIRST → EXACTLY ONE
 *     exact-Alice retrieval attempt through the existing Memory retrieval seam
 *     and validation law; deterministic trace on the execution result.
 *   EMPTY CONTROL: high familiarity + no usable counterpart evidence → valid
 *     execution, ATTEMPTED_EMPTY, no invention, zero-delta canonical footprint.
 *   ISOLATION CONTROL: Alice active/BASIC + inactive high-familiarity Bob →
 *     zero attempts, zero retrieval calls.
 *   RESTORE: post-authoritative-restore normal execution reproduces both arms.
 *
 * The retrieval seam is the EXISTING InMemoryRetrievalService behind a
 * test-only counting wrapper (proving no double retrieval); the provider is
 * the deterministic ReferenceCognitionProviderV0 — real-model calls ZERO.
 */

import { describe, expect, it } from "vitest";

import type {
  InMemoryFacadeAssembly,
  ProducerAuthorizationIssuer,
  SubjectStateV0
} from "@characteros-next/subject-core";
import { createInMemorySubjectCoreFacade, createPersistenceEnvelope } from "@characteros-next/subject-core";
import {
  InMemoryMemoryRepository,
  InMemoryRetrievalService,
  type EpisodicMemoryRecordV0,
  type MemoryPreparationAuthority,
  type MemoryRetrievalQueryV0,
  type MemoryRetrievalService,
  type RetrievalRehearsalV0
} from "@characteros-next/memory";

import { RuntimeCompositionRoot } from "../../composition/runtime-composition-root.js";
import type { SubjectCorePort } from "../../ports/subject-core-port.js";
import { ReferenceCognitionProviderV0 } from "../../producers/reference-cognition-provider.js";
import { createMiclStageMinter } from "../../micl/micl-capabilities.js";
import { InMemoryMiclWorkflowStore } from "../../micl/micl-workflow-store.js";
import { CognitionActionTransitionExecutor } from "../cognition-action/cognition-action-transition-executor.js";
import { restoreCanonicalSubjectFromHistoryV0 } from "../../authority/restore-chain-authority.js";
import { mintTrustedCanonicalHistoryBoundaryV0 } from "../../authority/trusted-canonical-history-boundary.js";
import {
  processInteractionExperience,
  type InteractionFamiliarityIngestionDepsV0
} from "./relationship-interaction-familiarity-ingestion.js";
import { INTERACTION_FAMILIARITY_DIMENSION_ID_V0 } from "./relationship-feature-decision-semantics.js";

const SUBJECT_ID = "subject-s0";
const ALICE = "entity:alice-like";
const FAMILIARITY = INTERACTION_FAMILIARITY_DIMENSION_ID_V0;
const R0_HASH = "sha256:4444444444444444444444444444444444444444444444444444444444444444";
const SCENARIO_SCENE = `Alice says: "Can you help me revise that update in the usual way?"`;

// ---- real-history ingestion fixtures (frozen path) -------------------------------------------

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

function seedState(input: {
  readonly memoryRevision: string;
  readonly counterparts: readonly {
    readonly counterpart_ref: string;
    readonly dimensions: readonly { dimension_id: string; value: number }[];
  }[];
  readonly activeEntityRefs?: readonly string[];
}): SubjectStateV0 {
  return {
    schema_version: "subject-state-v3",
    identity: {
      subject_id: SUBJECT_ID,
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

interface CausalComposition {
  readonly deps: InteractionFamiliarityIngestionDepsV0;
  readonly assembly: InMemoryFacadeAssembly;
  readonly genesis: SubjectStateV0;
  readonly memoryRevision: string;
}

async function composeCausalArm(
  count: number,
  counterpartOverrides?: {
    readonly counterparts: readonly {
      readonly counterpart_ref: string;
      readonly dimensions: readonly { dimension_id: string; value: number }[];
    }[];
  }
): Promise<CausalComposition> {
  const memory = new InMemoryMemoryRepository();
  const records: { ref: never; payload_hash: never }[] = [];
  for (let index = 0; index < count; index++) {
    const episode = causalEpisode(index);
    const storedHash = await memory.storePayload(episode.episode_ref as never, episode);
    records.push({ ref: episode.episode_ref as never, payload_hash: storedHash } as never);
  }
  records.sort((a, b) => (a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0));
  const prepared = await memory.prepareRevisionForIntent({
    intent_id: `intent-normal-path-${count}` as never,
    parent_revision: null,
    records
  });
  const genesis = seedState({
    memoryRevision: prepared.repository_revision,
    counterparts:
      counterpartOverrides?.counterparts ??
      [{ counterpart_ref: ALICE, dimensions: [{ dimension_id: "arbitrary_host_dimension", value: 0.25 }] }],
    activeEntityRefs: [ALICE]
  });
  const assembly = createInMemorySubjectCoreFacade({
    seedSnapshots: new Map([[SUBJECT_ID as never, genesis]]),
    preparedResultValidator: async (binding) => binding.prepared_result_ref.startsWith("workflow:")
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
  const currentState = (await composition.assembly.storeRead.readCurrentState(SUBJECT_ID)) as SubjectStateV0;
  const revision = currentState.runtime_metadata.state_revision;
  const proposal = {
    schema_version: "canonical-transition-proposal-v1",
    transition_id: "t-normal-path-head",
    subject_id: SUBJECT_ID,
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
              counterparts: currentState.relationships.counterparts
            }
          }
        ],
        provenance_refs: []
      }
    ],
    external_refs: []
  } as unknown as never;
  const reserved = await composition.assembly.facade.reserveAndRoute(proposal as never);
  if (reserved.kind !== "CONTINUE") throw new Error("fixture head reservation failed");
  const committed = await composition.assembly.facade.commitReserved({
    proposal: proposal as never,
    continuation: reserved.continuation,
    producerAuthorization: composition.assembly.producerAuthorizationIssuer.issue([
      { producer: "relationship", domain: "relationship" }
    ]),
    preparedBinding: {
      transition_id: "t-normal-path-head" as never,
      subject_id: SUBJECT_ID as never,
      transition_type: "Relationship",
      payload_fingerprint: reserved.continuation.payload_fingerprint,
      prepared_result_ref: "workflow:w-t-normal-path-head" as never
    },
    repository_bindings: [{ repository_revision: "R0", repository_revision_hash: R0_HASH } as never]
  });
  if (committed.kind !== "COMMITTED") throw new Error("fixture head commit failed");
}

async function ingestArm(composition: CausalComposition, count: number): Promise<SubjectStateV0> {
  for (let index = 0; index < count; index++) {
    const outcome = await processInteractionExperience(composition.deps, {
      subject_id: SUBJECT_ID as never,
      counterpart_ref: ALICE as never,
      episode: causalEpisode(index)
    });
    expect(outcome.kind, `episode ${index + 1}`).toBe("QUALIFIED_AND_COMMITTED");
  }
  return (await composition.assembly.storeRead.readCurrentState(SUBJECT_ID)) as SubjectStateV0;
}

// ---- the NORMAL product execution world --------------------------------------------------------

interface TestCore extends SubjectCorePort {
  readonly issuer: ProducerAuthorizationIssuer;
}

function createNormalPathCore(assembly: InMemoryFacadeAssembly, seed: SubjectStateV0): TestCore {
  const port: SubjectCorePort = {
    reserveAndRoute: (proposal) => assembly.facade.reserveAndRoute(proposal),
    commitReserved: (input) => assembly.facade.commitReserved(input),
    terminalizeReservedNoOp: (input) => assembly.facade.terminalizeReservedNoOp(input),
    reconcile: (t, s, f) => assembly.facade.reconcile(t, s, f),
    readCurrentSnapshot: async (id) => {
      const bundle = assembly.storeRead.readCurrentBundle(id);
      return bundle !== null ? bundle.next_snapshot : seed;
    }
  };
  return { ...port, issuer: assembly.producerAuthorizationIssuer };
}

function countingRetrieval(inner: MemoryRetrievalService): {
  readonly retrieval: MemoryRetrievalService;
  readonly queries: MemoryRetrievalQueryV0[];
} {
  const queries: MemoryRetrievalQueryV0[] = [];
  return {
    queries,
    retrieval: {
      retrieve: async (query: MemoryRetrievalQueryV0) => {
        queries.push(query);
        return inner.retrieve(query);
      }
    } as unknown as MemoryRetrievalService
  };
}

interface NormalExecutionWorld {
  /** Counting retrieval seam: proves exact familiarity-priority call counts. */
  readonly queries: MemoryRetrievalQueryV0[];
  readonly coreBundles: () => readonly unknown[];
  readonly execute: () => Promise<{
    readonly outcome: { readonly kind: string };
    readonly interaction_familiarity_retrieval?:
      | {
          readonly attempts: readonly {
            readonly counterpart_ref: string;
            readonly outcome: string;
            readonly selected_memory_refs: readonly string[];
            readonly query_fingerprint: string | null;
          }[];
          readonly attempted_count: number;
          readonly no_priority_request_count: number;
        };
    readonly projection: { readonly interaction_familiarity_cognition_influences: readonly unknown[] };
  }>;
}

function buildNormalExecutionWorld(
  assembly: InMemoryFacadeAssembly,
  seed: SubjectStateV0,
  retrieval: MemoryRetrievalService,
  memoryRepository: MemoryPreparationAuthority
): NormalExecutionWorld {
  const core = createNormalPathCore(assembly, seed);
  const counted = countingRetrieval(retrieval);
  const root = new RuntimeCompositionRoot({
    subjectCore: core,
    producerAuthorizationIssuer: core.issuer,
    memoryRepository,
    retrieval: counted.retrieval as never,
    cognitionProvider: new ReferenceCognitionProviderV0() as never
  });
  return {
    queries: counted.queries,
    coreBundles: () => assembly.storeRead.getCommittedBundles(),
    execute: async () => {
      const minter = createMiclStageMinter(core, new InMemoryMiclWorkflowStore(), {
        micl_id: "micl-cog-normal" as never,
        micl_request_fingerprint: "sha256:cog-normal-stage" as never,
        stage_key: "OBSERVATION"
      });
      const executor = new CognitionActionTransitionExecutor({
        ...root.dependencies(),
        subjectCore: minter.core()
      });
      // The CTX is anchored to the CURRENT authoritative snapshot, exactly as
      // normal execution anchors — no caller-supplied familiarity anything.
      const current = (await core.readCurrentSnapshot(SUBJECT_ID as never)) as SubjectStateV0;
      const ctx = {
        subject_id: SUBJECT_ID as never,
        current_logical_time: current.runtime_metadata.logical_time as never,
        state_revision: current.runtime_metadata.state_revision as never
      };
      return executor.execute(ctx, { cause_refs: [], allowed_actions: [] }, minter.capabilities([
        { repository_revision: "R0", repository_revision_hash: R0_HASH } as never
      ])) as never;
    }
  };
}

function rehearsalFor(memoryRevision: string, withAliceEvidence: boolean): RetrievalRehearsalV0 {
  if (!withAliceEvidence) {
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

// ---- NORMAL_EXECUTION_AUTO_INVOCATION -------------------------------------------------------------

describe("NORMAL_EXECUTION_AUTO_INVOCATION (production path, no direct orchestrator calls)", () => {
  it(
    "Arm A: real 1-experience history → BASIC → normal execution performs ZERO familiarity-priority retrievals",
    { timeout: 60_000 },
    async () => {
      const composition = await composeCausalArm(1);
      await establishCausalHead(composition);
      const state = await ingestArm(composition, 1);
      expect(
        state.relationships.counterparts[0]?.dimensions.find((d) => d.dimension_id === FAMILIARITY)?.value
      ).toBe(1 / 32);

      const world = buildNormalExecutionWorld(
        composition.assembly,
        composition.genesis,
        new InMemoryRetrievalService({ rehearsals: [rehearsalFor(composition.memoryRevision, true)] }),
        composition.deps.memory
      );
      const result = await world.execute();

      // the projection carried the frozen BASIC influence
      const influences = result.projection.interaction_familiarity_cognition_influences as {
        context_resolution_strategy: string;
      }[];
      expect(influences[0]?.context_resolution_strategy).toBe("BASIC_CONTEXT_FIRST");
      // zero familiarity-priority retrieval happened — even though usable Alice
      // evidence WAS available in the retrieval adapter
      expect(result.interaction_familiarity_retrieval?.attempts).toStrictEqual([]);
      expect(result.interaction_familiarity_retrieval?.no_priority_request_count).toBe(1);
      expect(world.queries).toHaveLength(0);
      // canonical footprint unchanged (zero-delta durable NO_OP)
      expect(result.outcome.kind).toBe("NO_OP");
      expect(world.coreBundles().length).toBe(2);
    }
  );

  it(
    "Arm B: real 16-experience history → SEARCH_FIRST → normal execution performs EXACTLY ONE exact-Alice retrieval",
    { timeout: 120_000 },
    async () => {
      const composition = await composeCausalArm(16);
      await establishCausalHead(composition);
      const state = await ingestArm(composition, 16);
      expect(
        state.relationships.counterparts[0]?.dimensions.find((d) => d.dimension_id === FAMILIARITY)?.value
      ).toBe(16 / 32);

      const world = buildNormalExecutionWorld(
        composition.assembly,
        composition.genesis,
        new InMemoryRetrievalService({ rehearsals: [rehearsalFor(composition.memoryRevision, true)] }),
        composition.deps.memory
      );
      const result = await world.execute();

      const influences = result.projection.interaction_familiarity_cognition_influences as {
        context_resolution_strategy: string;
      }[];
      expect(influences[0]?.context_resolution_strategy).toBe("COUNTERPART_CONTEXT_SEARCH_FIRST");

      // EXACTLY ONE familiarity-priority retrieval, target Alice exactly,
      // validated by the existing Memory law inside normal execution
      expect(result.interaction_familiarity_retrieval?.attempted_count).toBe(1);
      const attempt = result.interaction_familiarity_retrieval?.attempts[0];
      expect(attempt?.counterpart_ref).toBe(ALICE);
      expect(attempt?.outcome).toBe("ATTEMPTED_WITH_USABLE_EVIDENCE");
      expect(attempt?.selected_memory_refs).toStrictEqual(["episode:e-causal-1"]);
      expect(attempt?.query_fingerprint).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(world.queries).toHaveLength(1);
      expect(world.queries[0]?.semantic_reference).toBe(ALICE);
      expect(world.queries[0]?.entity_refs).toStrictEqual([ALICE]);
      // canonical footprint unchanged (zero-delta durable NO_OP)
      expect(result.outcome.kind).toBe("NO_OP");
      expect(world.coreBundles().length).toBe(17);
    }
  );

  it(
    "Empty control: high familiarity + no usable evidence → valid execution, ATTEMPTED_EMPTY, no invention",
    { timeout: 120_000 },
    async () => {
      const composition = await composeCausalArm(16);
      await establishCausalHead(composition);
      await ingestArm(composition, 16);
      const revisionBefore = (
        (await composition.assembly.storeRead.readCurrentState(SUBJECT_ID)) as SubjectStateV0
      ).runtime_metadata.state_revision;

      const world = buildNormalExecutionWorld(
        composition.assembly,
        composition.genesis,
        new InMemoryRetrievalService({ rehearsals: [rehearsalFor(composition.memoryRevision, false)] }),
        composition.deps.memory
      );
      const result = await world.execute();

      expect(result.interaction_familiarity_retrieval?.attempted_count).toBe(1);
      expect(result.interaction_familiarity_retrieval?.attempts[0]?.outcome).toBe("ATTEMPTED_EMPTY");
      expect(result.interaction_familiarity_retrieval?.attempts[0]?.selected_memory_refs).toStrictEqual([]);
      expect(world.queries).toHaveLength(1);
      // zero-delta canonical footprint; no familiarity mutation; no second attempt
      expect(result.outcome.kind).toBe("NO_OP");
      expect(world.coreBundles().length).toBe(17);
      const stateAfter = (await composition.assembly.storeRead.readCurrentState(SUBJECT_ID)) as SubjectStateV0;
      expect(stateAfter.runtime_metadata.state_revision).toBe(revisionBefore);
    }
  );

  it("Isolation control: inactive high-familiarity Bob never triggers retrieval", async () => {
    // Unit-negative isolation fixture (hand-built source state permitted):
    // Alice 1/32 active, Bob 16/32 registered but NOT active.
    const memory = new InMemoryMemoryRepository();
    void memory.prepareRevision({ parent_revision: null, records: [] });
    const seed = seedState({
      memoryRevision: "R0",
      counterparts: [
        { counterpart_ref: ALICE, dimensions: [{ dimension_id: FAMILIARITY, value: 1 / 32 }] },
        { counterpart_ref: "entity:bob-like", dimensions: [{ dimension_id: FAMILIARITY, value: 16 / 32 }] }
      ],
      activeEntityRefs: [ALICE]
    });
    const assembly = createInMemorySubjectCoreFacade({
      seedSnapshots: new Map([[SUBJECT_ID as never, seed]]),
      preparedResultValidator: async (binding) => binding.prepared_result_ref.startsWith("workflow:")
    });
    const world = buildNormalExecutionWorld(
      assembly,
      seed,
      new InMemoryRetrievalService({ rehearsals: [] }),
      memory
    );
    const result = await world.execute();

    const influences = result.projection.interaction_familiarity_cognition_influences as {
      counterpart_ref: string;
      context_resolution_strategy: string;
    }[];
    expect(influences).toHaveLength(1);
    expect(influences[0]?.counterpart_ref).toBe(ALICE);
    expect(influences[0]?.context_resolution_strategy).toBe("BASIC_CONTEXT_FIRST");
    expect(result.interaction_familiarity_retrieval?.attempts).toStrictEqual([]);
    expect(world.queries).toHaveLength(0);
  });

  it(
    "Restore: post-restore normal execution reproduces both arms without manual reconstruction",
    { timeout: 180_000 },
    async () => {
      for (const [count, expectedStrategy, expectedAttempts] of [
        [1, "BASIC_CONTEXT_FIRST", 0],
        [16, "COUNTERPART_CONTEXT_SEARCH_FIRST", 1]
      ] as const) {
        const composition = await composeCausalArm(count);
        await establishCausalHead(composition);
        await ingestArm(composition, count);

        const liveWorld = buildNormalExecutionWorld(
          composition.assembly,
          composition.genesis,
          new InMemoryRetrievalService({ rehearsals: [rehearsalFor(composition.memoryRevision, true)] }),
          composition.deps.memory
        );
        const before = await liveWorld.execute();
        expect(before.interaction_familiarity_retrieval?.attempts).toHaveLength(expectedAttempts);

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

        // FRESH normal-execution world over the restored canonical state
        const restoredAssembly = createInMemorySubjectCoreFacade({
          seedSnapshots: new Map([[SUBJECT_ID as never, restored.restored_snapshot as never]]),
          preparedResultValidator: async (binding) => binding.prepared_result_ref.startsWith("workflow:")
        });
        const restoredWorld = buildNormalExecutionWorld(
          restoredAssembly,
          restored.restored_snapshot as SubjectStateV0,
          new InMemoryRetrievalService({ rehearsals: [rehearsalFor(composition.memoryRevision, true)] }),
          composition.deps.memory
        );
        const after = await restoredWorld.execute();

        const influences = after.projection.interaction_familiarity_cognition_influences as {
          context_resolution_strategy: string;
        }[];
        expect(influences[0]?.context_resolution_strategy).toBe(expectedStrategy);
        expect(after.interaction_familiarity_retrieval?.attempted_count).toBe(expectedAttempts);
        expect(after.interaction_familiarity_retrieval?.attempts).toStrictEqual(
          before.interaction_familiarity_retrieval?.attempts
        );
        if (expectedAttempts === 1) {
          expect(after.interaction_familiarity_retrieval?.attempts[0]?.counterpart_ref).toBe(ALICE);
          expect(after.interaction_familiarity_retrieval?.attempts[0]?.query_fingerprint).toBe(
            before.interaction_familiarity_retrieval?.attempts[0]?.query_fingerprint
          );
        }
      }
    }
  );
});
