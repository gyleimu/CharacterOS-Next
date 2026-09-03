/**
 * Retrieved-Evidence Cognition Integration V0 — acceptance suite
 * (RELATIONSHIP_FAMILIARY_RETRIEVED_EVIDENCE_COGNITION_INTEGRATION_V0).
 *
 * Proves, entering ONLY through the normal CognitionActionTransitionExecutor:
 *
 *   Arm A (real ingestion: 1 Alice experience → 1/32 → BASIC_CONTEXT_FIRST):
 *     the provider's factual Memory context is unchanged — no
 *     familiarity-added evidence, zero retrieval calls.
 *   Arm B (real ingestion: 16 Alice experiences → 16/32 → SEARCH_FIRST):
 *     the EXACT validated selected Alice episode ref from the automatic
 *     retrieval appears in the SAME provider input's recent-retrieval
 *     evidence context (deduplicated, raw-ASCII sorted), citeable only
 *     because it is validated Memory evidence; no receipt/authority refs.
 *   CITATION LAW: citing the retrieved ref is lawful; citing a familiarity
 *     receipt ref is rejected by the UNCHANGED grounding validation.
 *   EMPTY: SEARCH_FIRST + empty retrieval → no new evidence, strategy visible.
 *   TAMPERED: an invalid retrieval result never enters provider evidence.
 *   DEDUP: a ref already in the recent-retrieval context is not duplicated.
 *   RESTORE: post-restore normal execution yields the same evidence context.
 *
 * Provider capture is a deterministic wrapper around the reference provider —
 * real-model calls ZERO.
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
const ALICE_EPISODE_1 = "episode:e-causal-1";

// ---- real-history ingestion fixtures (frozen path) -------------------------------------------

function causalEpisode(index: number): Record<string, unknown> {
  return {
    schema_version: "episodic-memory-record-v0",
    episode_ref: `episode:e-causal-${index + 1}`,
    occurrence_logical_time: 1,
    recorded_at_logical_time: 1,
    provenance: { transition_id: `t-enc-${index + 1}`, producer: "memory", cause_refs: [] },
    references: [ALICE],
    context: {
      scene: `qualifying firsthand interaction number ${index + 1} with alice`,
      focus_refs: [ALICE],
      environment_refs: []
    },
    appraisal_ref: null,
    affect_snapshot_ref: null,
    salience: { declared_score: 0.5, source: "ENCODING_DECLARED_V0" }
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
      scene: `Alice says: "Can you help me revise that update in the usual way?"`,
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

async function composeCausalArm(count: number): Promise<CausalComposition> {
  const memory = new InMemoryMemoryRepository();
  const records: { ref: never; payload_hash: never }[] = [];
  for (let index = 0; index < count; index++) {
    const episode = causalEpisode(index);
    const storedHash = await memory.storePayload(episode["episode_ref"] as never, episode);
    records.push({ ref: episode["episode_ref"] as never, payload_hash: storedHash } as never);
  }
  records.sort((a, b) => (a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0));
  const prepared = await memory.prepareRevisionForIntent({
    intent_id: `intent-evidence-integration-${count}` as never,
    parent_revision: null,
    records
  });
  const genesis = seedState({
    memoryRevision: prepared.repository_revision,
    counterparts: [{ counterpart_ref: ALICE, dimensions: [{ dimension_id: "arbitrary_host_dimension", value: 0.25 }] }],
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
    transition_id: "t-evidence-head",
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
      transition_id: "t-evidence-head" as never,
      subject_id: SUBJECT_ID as never,
      transition_type: "Relationship",
      payload_fingerprint: reserved.continuation.payload_fingerprint,
      prepared_result_ref: "workflow:w-t-evidence-head" as never
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
      episode: causalEpisode(index) as never
    });
    expect(outcome.kind, `episode ${index + 1}`).toBe("QUALIFIED_AND_COMMITTED");
  }
  return (await composition.assembly.storeRead.readCurrentState(SUBJECT_ID)) as SubjectStateV0;
}

// ---- capture-provider normal execution world ---------------------------------------------------

function captureProvider(): {
  readonly provider: unknown;
  readonly captured: { readonly recent_retrieval_refs: readonly string[] }[];
} {
  const captured: { readonly recent_retrieval_refs: readonly string[] }[] = [];
  const inner = new ReferenceCognitionProviderV0() as unknown as {
    propose(input: unknown): Promise<unknown>;
  };
  return {
    captured,
    provider: {
      propose: async (input: unknown) => {
        const projection = input as { recent_retrieval_refs: readonly string[] };
        captured.push({ recent_retrieval_refs: [...projection.recent_retrieval_refs] });
        return inner.propose(input);
      }
    }
  };
}

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

interface EvidenceWorld {
  readonly queries: MemoryRetrievalQueryV0[];
  readonly captured: { readonly recent_retrieval_refs: readonly string[] }[];
  readonly coreBundles: () => readonly unknown[];
  readonly execute: () => Promise<{ readonly outcome: { readonly kind: string } }>;
}

function buildEvidenceWorld(
  assembly: InMemoryFacadeAssembly,
  seed: SubjectStateV0,
  retrieval: MemoryRetrievalService,
  memoryRepository: MemoryPreparationAuthority,
  provider: unknown
): EvidenceWorld {
  const core = createNormalPathCore(assembly, seed);
  const queries: MemoryRetrievalQueryV0[] = [];
  const countingRetrieval: MemoryRetrievalService = {
    retrieve: async (query: MemoryRetrievalQueryV0) => {
      queries.push(query);
      return retrieval.retrieve(query);
    }
  } as unknown as MemoryRetrievalService;
  const root = new RuntimeCompositionRoot({
    subjectCore: core,
    producerAuthorizationIssuer: core.issuer,
    memoryRepository,
    retrieval: countingRetrieval as never,
    cognitionProvider: provider as never
  });
  return {
    queries,
    captured: [],
    coreBundles: () => assembly.storeRead.getCommittedBundles(),
    execute: async () => {
      const minter = createMiclStageMinter(core, new InMemoryMiclWorkflowStore(), {
        micl_id: "micl-cog-evidence" as never,
        micl_request_fingerprint: "sha256:cog-evidence-stage" as never,
        stage_key: "OBSERVATION"
      });
      const executor = new CognitionActionTransitionExecutor({
        ...root.dependencies(),
        subjectCore: minter.core()
      });
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
    selected_memory_refs: [ALICE_EPISODE_1 as never],
    evidence: [
      {
        episode_ref: ALICE_EPISODE_1 as never,
        reasons: [{ dimension: "ENTITY", score: 0.8 } as never]
      }
    ],
    candidate_count: 1,
    retrieval_trace_ref: null
  };
}

// ---- the integration proofs -----------------------------------------------------------------

describe("retrieved evidence reaches the SAME cognition provider context", () => {
  it(
    "Arm A: BASIC_CONTEXT_FIRST → provider Memory context unchanged, zero retrieval",
    { timeout: 60_000 },
    async () => {
      const composition = await composeCausalArm(1);
      await establishCausalHead(composition);
      await ingestArm(composition, 1);
      const provider = captureProvider();
      const world = buildEvidenceWorld(
        composition.assembly,
        composition.genesis,
        new InMemoryRetrievalService({ rehearsals: [rehearsalFor(composition.memoryRevision, true)] }),
        composition.deps.memory,
        provider.provider
      );
      const result = await world.execute();
      expect(result.outcome.kind).toBe("NO_OP");
      expect(provider.captured).toHaveLength(1);
      // no familiarity-added evidence; ordinary context unchanged
      expect(provider.captured[0]?.recent_retrieval_refs).toStrictEqual([]);
      expect(world.queries).toHaveLength(0);
    }
  );

  it(
    "Arm B: SEARCH_FIRST → the exact validated Alice episode ref is in the SAME provider input",
    { timeout: 120_000 },
    async () => {
      const composition = await composeCausalArm(16);
      await establishCausalHead(composition);
      const state = await ingestArm(composition, 16);
      expect(
        state.relationships.counterparts[0]?.dimensions.find((d) => d.dimension_id === FAMILIARITY)?.value
      ).toBe(16 / 32);

      const provider = captureProvider();
      const world = buildEvidenceWorld(
        composition.assembly,
        composition.genesis,
        new InMemoryRetrievalService({ rehearsals: [rehearsalFor(composition.memoryRevision, true)] }),
        composition.deps.memory,
        provider.provider
      );
      const result = await world.execute();
      expect(result.outcome.kind).toBe("NO_OP");
      expect(provider.captured).toHaveLength(1);
      // the EXACT validated selected Alice evidence, in the SAME provider input
      expect(provider.captured[0]?.recent_retrieval_refs).toStrictEqual([ALICE_EPISODE_1]);
      expect(world.queries).toHaveLength(1);
      expect(world.queries[0]?.semantic_reference).toBe(ALICE);
      // no familiarity receipt/authority refs became factual evidence
      const serialized = JSON.stringify(provider.captured[0]);
      expect(serialized.includes("appraisal:")).toBe(false);
      expect(serialized.includes("commit:")).toBe(false);
      expect(serialized.includes("workflow:")).toBe(false);
    }
  );

  it(
    "Citation law: citing the retrieved ref is lawful; citing a familiarity receipt ref is rejected",
    { timeout: 120_000 },
    async () => {
      const composition = await composeCausalArm(16);
      await establishCausalHead(composition);
      await ingestArm(composition, 16);

      // POSITIVE: the reference provider now MAY cite the retrieved ref — the
      // grounding validation passes because it is lawful Memory evidence.
      const positiveProvider = captureProvider();
      const positiveWorld = buildEvidenceWorld(
        composition.assembly,
        composition.genesis,
        new InMemoryRetrievalService({ rehearsals: [rehearsalFor(composition.memoryRevision, true)] }),
        composition.deps.memory,
        positiveProvider.provider
      );
      await expect(positiveWorld.execute()).resolves.toBeDefined();

      // NEGATIVE: a provider citing a familiarity RECEIPT ref (never factual
      // evidence) is rejected by the UNCHANGED grounding validation.
      const receiptRef = "appraisal:1111111111111111111111111111111111111111111111111111111111111111";
      const inner = new ReferenceCognitionProviderV0() as unknown as {
        propose(input: unknown): Promise<unknown>;
      };
      const receiptProvider = {
        propose: async (input: unknown) => {
          const base = (await inner.propose(input)) as { evidence_refs?: string[] };
          return { ...base, evidence_refs: [receiptRef] };
        }
      };
      const negativeWorld = buildEvidenceWorld(
        composition.assembly,
        composition.genesis,
        new InMemoryRetrievalService({ rehearsals: [rehearsalFor(composition.memoryRevision, true)] }),
        composition.deps.memory,
        receiptProvider
      );
      await expect(negativeWorld.execute()).rejects.toThrow(/UNSUPPORTED_EVIDENCE_REF/);
    }
  );

  it(
    "Empty control: SEARCH_FIRST + empty retrieval → strategy visible, no new evidence",
    { timeout: 120_000 },
    async () => {
      const composition = await composeCausalArm(16);
      await establishCausalHead(composition);
      await ingestArm(composition, 16);
      const provider = captureProvider();
      const world = buildEvidenceWorld(
        composition.assembly,
        composition.genesis,
        new InMemoryRetrievalService({ rehearsals: [rehearsalFor(composition.memoryRevision, false)] }),
        composition.deps.memory,
        provider.provider
      );
      const result = await world.execute();
      expect(result.outcome.kind).toBe("NO_OP");
      expect(provider.captured).toHaveLength(1);
      // SEARCH_FIRST was the strategy (visible through the influence surface)
      const influences = (
        result as unknown as {
          projection: { interaction_familiarity_cognition_influences: { context_resolution_strategy: string }[] };
        }
      ).projection.interaction_familiarity_cognition_influences;
      expect(influences[0]?.context_resolution_strategy).toBe("COUNTERPART_CONTEXT_SEARCH_FIRST");
      // zero newly added factual evidence; no invented shared context
      expect(provider.captured[0]?.recent_retrieval_refs).toStrictEqual([]);
      expect(world.queries).toHaveLength(1);
    }
  );

  it(
    "Tampered retrieval result never enters provider evidence context",
    { timeout: 120_000 },
    async () => {
      const composition = await composeCausalArm(16);
      await establishCausalHead(composition);
      await ingestArm(composition, 16);
      const provider = captureProvider();
      const forgedRetrieval: MemoryRetrievalService = {
        retrieve: async () => ({
          schema_version: "memory-retrieval-result-v0",
          subject_id: SUBJECT_ID,
          selected_memory_refs: ["episode:e-forged"],
          evidence: [],
          retrieval_trace_ref: null,
          deterministic_metadata: {
            repository_revision: composition.memoryRevision as never,
            candidate_count: 1,
            computed_under_config: "MEMORY_RETRIEVAL_V0",
            query_fingerprint: ("sha256:" + "0".repeat(64)) as never
          }
        }) as never
      };
      const world = buildEvidenceWorld(
        composition.assembly,
        composition.genesis,
        forgedRetrieval,
        composition.deps.memory,
        provider.provider
      );
      const result = await world.execute();
      expect(result.outcome.kind).toBe("NO_OP");
      // the invalid result contributed NOTHING to the provider evidence context
      expect(provider.captured[0]?.recent_retrieval_refs).toStrictEqual([]);
      expect(provider.captured[0]?.recent_retrieval_refs.join(" ")).not.toContain("e-forged");
    }
  );

  it(
    "Dedup control: a selected ref already in the recent-retrieval context is not duplicated",
    async () => {
      // Unit-negative fixture (hand-built source state permitted): the subject's
      // recent-retrieval ring already carries the episode; the familiarity
      // retrieval selects the SAME ref.
      const memory = new InMemoryMemoryRepository();
      void memory.prepareRevision({ parent_revision: null, records: [] });
      const seed = seedState({ memoryRevision: "R0", counterparts: [{ counterpart_ref: ALICE, dimensions: [{ dimension_id: FAMILIARITY, value: 16 / 32 }] }], activeEntityRefs: [ALICE] });
      (seed as unknown as Record<string, unknown>)["memory_state"] = {
        ...((seed as unknown as Record<string, unknown>)["memory_state"] as Record<string, unknown>),
        recent_retrieval_trace: [ALICE_EPISODE_1]
      };
      const assembly = createInMemorySubjectCoreFacade({
        seedSnapshots: new Map([[SUBJECT_ID as never, seed]]),
        preparedResultValidator: async (binding) => binding.prepared_result_ref.startsWith("workflow:")
      });
      const provider = captureProvider();
      const world = buildEvidenceWorld(
        assembly,
        seed,
        new InMemoryRetrievalService({
          rehearsals: [rehearsalFor("R0", true)]
        }),
        memory,
        provider.provider
      );
      await world.execute();
      const refs = provider.captured[0]?.recent_retrieval_refs ?? [];
      expect(refs.filter((ref) => ref === ALICE_EPISODE_1)).toHaveLength(1);
      expect(refs).toStrictEqual([...refs].sort());
    }
  );

  it(
    "Restore: post-restore normal execution yields the same evidence context under the same revision",
    { timeout: 180_000 },
    async () => {
      const composition = await composeCausalArm(16);
      await establishCausalHead(composition);
      await ingestArm(composition, 16);

      const liveProvider = captureProvider();
      const liveWorld = buildEvidenceWorld(
        composition.assembly,
        composition.genesis,
        new InMemoryRetrievalService({ rehearsals: [rehearsalFor(composition.memoryRevision, true)] }),
        composition.deps.memory,
        liveProvider.provider
      );
      await liveWorld.execute();

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
      if (restored.kind !== "RESTORED") return;

      const restoredProvider = captureProvider();
      const restoredWorld = buildEvidenceWorld(
        createInMemorySubjectCoreFacade({
          seedSnapshots: new Map([[SUBJECT_ID as never, restored.restored_snapshot as never]]),
          preparedResultValidator: async (binding) => binding.prepared_result_ref.startsWith("workflow:")
        }),
        restored.restored_snapshot as SubjectStateV0,
        new InMemoryRetrievalService({ rehearsals: [rehearsalFor(composition.memoryRevision, true)] }),
        composition.deps.memory,
        restoredProvider.provider
      );
      await restoredWorld.execute();
      // same lawful provider evidence refs under the identical Memory revision
      expect(restoredProvider.captured[0]?.recent_retrieval_refs).toStrictEqual(
        liveProvider.captured[0]?.recent_retrieval_refs
      );
      expect(restoredProvider.captured[0]?.recent_retrieval_refs).toStrictEqual([ALICE_EPISODE_1]);
    }
  );
});
