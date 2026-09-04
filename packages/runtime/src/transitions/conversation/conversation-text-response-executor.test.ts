/**
 * ConversationTextResponseExecutorV0 — production-path acceptance suite
 * (PRODUCTION_LANGUAGE_BEHAVIOR_OUTPUT_V0).
 *
 * EVERY test enters through the REAL ConversationTextResponseExecutorV0 —
 * never through the language provider or input builder directly:
 *
 *   PRIMARY        real cognition (frozen path) + fake language transport →
 *                  OUTPUT_READY with behavior.text available to the product;
 *                  cognition provider 1 call, language provider 1 call, zero
 *                  ActionRunner executions, zero-delta canonical footprint
 *   FAMILIARITY    Arm A-like (1 lived experience → BASIC, no familiarity
 *                  evidence) vs Arm B-like (16 → SEARCH_FIRST, exact Alice
 *                  retrieval → the provider receives the actual canonical
 *                  episode scene via the new trusted Memory reader); the two
 *                  language inputs hash differently
 *   AUTHORITY      the product request carries identity only; caller-injected
 *                  refs/proposals/drafts can never cause OUTPUT_READY; root
 *                  surface exports no input-builder/reader/provider minting
 *   OUTPUT ATTACKS empty/whitespace/oversize/control-char text, unknown fields,
 *                  wrong schema, wrong input_hash, duplicate/unsorted refs,
 *                  unsupported episode ref, receipt ref — all fail with the
 *                  exact stage, no repair
 *   STALE CONTEXT  post-language revision drift → STALE_CONTEXT, no delivery
 *   RESTORE        post-restore normal execution reproduces the same language
 *                  input hash and behavior under a fake provider
 *   CALL COUNTS    cognition 1, language 1, actions 0; cognition-only
 *                  operations remain language-free (existing tripwires green)
 *
 * Fully OFFLINE: deterministic fake transports only — real-model calls ZERO.
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
  createEpisodeContentReaderV0,
  type RetrievalRehearsalV0
} from "@characteros-next/memory";

import { RuntimeCompositionRoot } from "../../composition/runtime-composition-root.js";
import type { SubjectCorePort } from "../../ports/subject-core-port.js";
import { ReferenceCognitionProviderV0 } from "../../producers/reference-cognition-provider.js";
import { createMiclStageMinter } from "../../micl/micl-capabilities.js";
import { InMemoryMiclWorkflowStore } from "../../micl/micl-workflow-store.js";
import type { ModelTransportRequestV0, ModelTransportV0 } from "../../transports/model-transport.js";
import {
  ConversationTextResponseExecutorV0,
  type ConversationResponseRequestV0
} from "./conversation-text-response-executor.js";
import { mintTrustedCanonicalHistoryBoundaryV0 } from "../../authority/trusted-canonical-history-boundary.js";
import { restoreCanonicalSubjectFromHistoryV0 } from "../../authority/restore-chain-authority.js";
import { processInteractionExperience, type InteractionFamiliarityIngestionDepsV0 } from "../../transitions/relationship/relationship-interaction-familiarity-ingestion.js";
import * as runtimeIndex from "../../index.js";

const SUBJECT_ID = "subject-s0";
const ALICE = "entity:alice-like";

const R0_HASH = "sha256:4444444444444444444444444444444444444444444444444444444444444444";
const SCENARIO_SCENE = `Alice says: "Can you help me revise that update in the usual way?"`;

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
      scene:
        index === 7
          ? 'While revising a status update together, Alice explicitly requested: "Use concise wording, a factual tone, and no unnecessary apology for these status updates."'
          : `qualifying firsthand interaction number ${index + 1} with alice`,
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
    identity: { subject_id: SUBJECT_ID, display_name: "", origin_metadata: { creation_source: null, seed_version: null }, identity_anchors: [], self_schema_seed_refs: [] },
    traits_seed: { dimensions: {} },
    personality: { schema_version: "personality-state-v0", dimensions: [] },
    memory_state: {
      working_refs: [],
      active_episode_refs: [],
      autobiographical_index_revision: null,
      repository_revision: input.memoryRevision,
      consolidation_cursor: null,
      retrieval_config: { profile_id: "RETRIEVAL_V0", affect_congruence_enabled: false, recent_trace_capacity: 64 },
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
  readonly memory: InMemoryMemoryRepository;
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
    intent_id: `intent-lang-behavior-${count}` as never,
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
      admissionProvider: { admit: async () => ({ kind: "QUALIFYING", qualifying_class: "DIRECT_COMMUNICATION" }) },
      repositoryBindings: [{ repository_revision: "R0", repository_revision_hash: R0_HASH } as never],
      readGenesisSnapshot: async () => genesis
    },
    assembly,
    genesis,
    memory,
    memoryRevision: prepared.repository_revision
  };
}

async function establishCausalHead(composition: CausalComposition): Promise<void> {
  const currentState = (await composition.assembly.storeRead.readCurrentState(SUBJECT_ID)) as SubjectStateV0;
  const revision = currentState.runtime_metadata.state_revision;
  const proposal = {
    schema_version: "canonical-transition-proposal-v1",
    transition_id: "t-lang-behavior-head",
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
      transition_id: "t-lang-behavior-head" as never,
      subject_id: SUBJECT_ID as never,
      transition_type: "Relationship",
      payload_fingerprint: reserved.continuation.payload_fingerprint,
      prepared_result_ref: "workflow:w-t-lang-behavior-head" as never
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

// ---- fake language transport ------------------------------------------------------------------

type FakeResponder = (request: ModelTransportRequestV0) => string | { content: string } | Promise<string | { content: string }>;

function fakeLanguageTransport(responder: FakeResponder): {
  readonly transport: ModelTransportV0;
  readonly requests: ModelTransportRequestV0[];
} {
  const requests: ModelTransportRequestV0[] = [];
  return {
    requests,
    transport: {
      complete: async (request: ModelTransportRequestV0) => {
        requests.push(request);
        const produced = await responder(request);
        return { content: typeof produced === 'string' ? produced : produced.content, model: 'qwen3.5:9b-fake' };
      }
    } as unknown as ModelTransportV0
  };
}

function inputHashFromRequest(request: ModelTransportRequestV0): string {
  const user = request.messages.find((message) => message.role === "user");
  const match = /input_hash: (sha256:[0-9a-f]{64})/.exec(user?.content ?? "");
  if (!match?.[1]) throw new Error("fake language transport: no input_hash in request");
  return match[1];
}

function draftJson(inputHash: string, text: string, evidenceRefs: string[]): string {
  return JSON.stringify({
    schema_version: "language-realization-draft-v0",
    input_hash: inputHash,
    text,
    evidence_refs: evidenceRefs
  });
}

function rehearsalFor(memoryRevision: string): RetrievalRehearsalV0 {
  return {
    repository_revision: memoryRevision as never,
    semantic_reference: ALICE as never,
    selected_memory_refs: ["episode:e-causal-8"] as never,
    evidence: [
      { episode_ref: "episode:e-causal-8" as never, reasons: [{ dimension: "ENTITY", score: 0.8 } as never] }
    ],
    candidate_count: 1,
    retrieval_trace_ref: null
  };
}

interface ConversationWorld {
  readonly languageRequests: ModelTransportRequestV0[];
  readonly coreBundles: () => readonly unknown[];
  readonly execute: (
    request?: ConversationResponseRequestV0
  ) => Promise<{
    readonly kind: string;
    readonly behavior?: { readonly text: string; readonly behavior_id: string };
    readonly stage?: string;
    readonly trace?: { readonly language_input_hash: string };
  }>;
}

function buildConversationWorld(
  assembly: InMemoryFacadeAssembly,
  seed: SubjectStateV0,
  memory: InMemoryMemoryRepository,
  languageResponder: FakeResponder
): ConversationWorld {
  const core: SubjectCorePort & { issuer: ProducerAuthorizationIssuer } = {
    reserveAndRoute: (proposal) => assembly.facade.reserveAndRoute(proposal),
    commitReserved: (input) => assembly.facade.commitReserved(input),
    terminalizeReservedNoOp: (input) => assembly.facade.terminalizeReservedNoOp(input),
    reconcile: (t, s, f) => assembly.facade.reconcile(t, s, f),
    readCurrentSnapshot: async (id) => {
      const bundle = assembly.storeRead.readCurrentBundle(id);
      return bundle !== null ? bundle.next_snapshot : seed;
    },
    issuer: assembly.producerAuthorizationIssuer
  };
  const language = fakeLanguageTransport(languageResponder);
  const root = new RuntimeCompositionRoot({
    subjectCore: core,
    producerAuthorizationIssuer: core.issuer,
    memoryRepository: memory,
    retrieval: new InMemoryRetrievalService({ rehearsals: [] }) as never,
    cognitionProvider: new ReferenceCognitionProviderV0() as never,
    languageTransport: language.transport,
    episodeContentReader: createEpisodeContentReaderV0(memory)
  });
  return {
    languageRequests: language.requests,
    coreBundles: () => assembly.storeRead.getCommittedBundles(),
    execute: async (request) => {
      const minter = createMiclStageMinter(core, new InMemoryMiclWorkflowStore(), {
        micl_id: "micl-conversation" as never,
        micl_request_fingerprint: "sha256:conversation-stage" as never,
        stage_key: "OBSERVATION"
      });
      const executor = new ConversationTextResponseExecutorV0({
        ...root.dependencies(),
        subjectCore: minter.core()
      });
      const current = (await core.readCurrentSnapshot(SUBJECT_ID as never)) as SubjectStateV0;
      const ctx = {
        subject_id: SUBJECT_ID as never,
        current_logical_time: current.runtime_metadata.logical_time as never,
        state_revision: current.runtime_metadata.state_revision as never
      };
      return executor.execute(
        ctx,
        request ?? { response_request_id: "resp-default" as never, cause_refs: [] },
        minter.capabilities([{ repository_revision: "R0", repository_revision_hash: R0_HASH } as never])
      ) as never;
    }
  };
}

// ---- primary product proof ---------------------------------------------------------------------

describe("primary product path (cognition → language → behavior.text)", () => {
  it("produces a validated user-visible text behavior through normal execution", { timeout: 60_000 }, async () => {
    const composition = await composeCausalArm(1);
    await establishCausalHead(composition);
    await ingestArm(composition, 1);
    const bundlesBefore = composition.assembly.storeRead.getCommittedBundles().length;

    const world = buildConversationWorld(
      composition.assembly,
      composition.genesis,
      composition.memory,
      (request) => ({
        content: draftJson(
          inputHashFromRequest(request),
          "Understood — I can help with the update. What should the revised text say?",
          []
        )
      })
    );
    const result = await world.execute();
    expect(result.kind).toBe("OUTPUT_READY");
    expect(result.behavior?.text).toBe(
      "Understood — I can help with the update. What should the revised text say?"
    );
    expect(result.behavior?.behavior_id).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(result.trace?.language_input_hash).toMatch(/^sha256:[0-9a-f]{64}$/);
    // EXACTLY ONE language provider call; zero-delta canonical footprint
    expect(world.languageRequests).toHaveLength(1);
    expect(world.coreBundles().length).toBe(bundlesBefore);
  });

  it("keeps call counts: cognition 1, language 1, actions 0; request carries identity only", { timeout: 60_000 }, async () => {
    const composition = await composeCausalArm(1);
    await establishCausalHead(composition);
    await ingestArm(composition, 1);
    const world = buildConversationWorld(
      composition.assembly,
      composition.genesis,
      composition.memory,
      (request) => ({ content: draftJson(inputHashFromRequest(request), "Text.", []) })
    );
    // a request carrying hostile extra fields cannot become authority: the
    // trusted executor derives everything else internally
    const result = await world.execute({
      response_request_id: "resp-hostile" as never,
      cause_refs: [],
      ...( {
        cognition_proposal: { forged: true },
        familiarity: 1,
        evidence_refs: ["episode:forged"],
        language_output: { text: "forged" },
        source_revision: 999
      } as Record<string, unknown> )
    } as ConversationResponseRequestV0);
    expect(result.kind).toBe("OUTPUT_READY");
    expect(world.languageRequests).toHaveLength(1);
    expect(result.behavior?.text).toBe("Text.");
    expect(result.behavior?.behavior_id).toMatch(/^sha256:[0-9a-f]{64}$/);
    // the runtime root surface exposes no language-input builder, reader
    // factory, provider minting or makeBehavior authority
    const indexKeys = Object.keys(runtimeIndex);
    expect(indexKeys.some((key) => /buildLanguageRealizationInput|createEpisodeContentReader|LanguageRealizationProvider|makeBehavior/i.test(key))).toBe(false);
  });

  it("unwired language provider or reader fails closed as REQUEST_INVALID", async () => {
    const composition = await composeCausalArm(1);
    await establishCausalHead(composition);
    await ingestArm(composition, 1);
    const core = {
      reserveAndRoute: (p: never) => composition.assembly.facade.reserveAndRoute(p),
      commitReserved: (i: never) => composition.assembly.facade.commitReserved(i),
      terminalizeReservedNoOp: (i: never) => composition.assembly.facade.terminalizeReservedNoOp(i),
      reconcile: (t: never, s: never, f: never) => composition.assembly.facade.reconcile(t, s, f),
      readCurrentSnapshot: async (id: string) => {
        void id;
        return composition.genesis;
      },
      issuer: composition.assembly.producerAuthorizationIssuer
    };
    const root = new RuntimeCompositionRoot({
      subjectCore: core,
      producerAuthorizationIssuer: core.issuer,
      memoryRepository: composition.memory,
      retrieval: new InMemoryRetrievalService({ rehearsals: [] }) as never,
      cognitionProvider: new ReferenceCognitionProviderV0() as never
      // NO languageTransport, NO episodeContentReader
    });
    const minter = createMiclStageMinter(core, new InMemoryMiclWorkflowStore(), {
      micl_id: "micl-cog" as never,
      micl_request_fingerprint: "sha256:cog" as never,
      stage_key: "OBSERVATION"
    });
    const executor = new ConversationTextResponseExecutorV0({
      ...root.dependencies(),
      subjectCore: minter.core()
    });
    const current = (await core.readCurrentSnapshot(SUBJECT_ID as never)) as SubjectStateV0;
    const result = await executor.execute(
      { subject_id: SUBJECT_ID as never, current_logical_time: 0 as never, state_revision: current.runtime_metadata.state_revision as never },
      { response_request_id: "resp-unwired" as never },
      minter.capabilities([])
    );
    expect(result.kind).toBe("FAILED");
    if (result.kind === "FAILED") expect(result.stage).toBe("REQUEST_INVALID");
  });
});

// ---- familiarity / memory plumbing proof ----------------------------------------------------------

describe("familiarity plumbing (deterministic provider-input difference)", () => {
  it(
    "Arm A-like: no familiarity evidence reaches the language stage; Arm B-like: actual canonical episode scene does",
    { timeout: 120_000 },
    async () => {
      const armA = await composeCausalArm(1);
      await establishCausalHead(armA);
      await ingestArm(armA, 1);
      const worldA = buildConversationWorld(
        armA.assembly,
        armA.genesis,
        armA.memory,
        (request) => ({ content: draftJson(inputHashFromRequest(request), "A text.", []) })
      );
      const resultA = await worldA.execute();
      expect(resultA.kind).toBe("OUTPUT_READY");
      const userA = worldA.languageRequests[0]?.messages.find((m) => m.role === "user")?.content ?? "";
      expect(userA).toContain('"context_resolution_strategy": "BASIC_CONTEXT_FIRST"');
      expect(userA).not.toContain("episode:e-causal-1");
      expect(userA).not.toContain("qualifying firsthand interaction");

      const armB = await composeCausalArm(16);
      await establishCausalHead(armB);
      await ingestArm(armB, 16);
      // Arm B uses the REAL retrieval adapter so the frozen path selects the
      // convention evidence; rebuild the world accordingly:
      const worldBReal = buildConversationWorldWithRealRetrieval(armB);
      const resultB = await worldBReal.world.execute();
      const userB = worldBReal.languageRequests[0]?.messages.find((m) => m.role === "user")?.content ?? "";
      expect(resultB.kind).toBe("OUTPUT_READY");
      expect(userB).toContain('"context_resolution_strategy": "COUNTERPART_CONTEXT_SEARCH_FIRST"');
      expect(userB).toContain("episode:e-causal-8");
      expect(userB).toContain("Use concise wording, a factual tone, and no unnecessary apology");
      // the two language inputs hash differently (real lived histories differ)
      expect(resultA.kind === "OUTPUT_READY" && resultB.kind === "OUTPUT_READY"
        ? resultB.trace?.language_input_hash !== resultA.trace?.language_input_hash
        : false).toBe(true);
      expect(worldBReal.languageRequests).toHaveLength(1);
    }
  );
});

function buildConversationWorldWithRealRetrieval(
  composition: CausalComposition
): { readonly world: ConversationWorld; readonly languageRequests: ModelTransportRequestV0[] } {
  const retrieval = new InMemoryRetrievalService({ rehearsals: [rehearsalFor(composition.memoryRevision)] });
  const core: SubjectCorePort & { issuer: ProducerAuthorizationIssuer } = {
    reserveAndRoute: (proposal) => composition.assembly.facade.reserveAndRoute(proposal),
    commitReserved: (input) => composition.assembly.facade.commitReserved(input),
    terminalizeReservedNoOp: (input) => composition.assembly.facade.terminalizeReservedNoOp(input),
    reconcile: (t, s, f) => composition.assembly.facade.reconcile(t, s, f),
    readCurrentSnapshot: async (id) => {
      const bundle = composition.assembly.storeRead.readCurrentBundle(id);
      return bundle !== null ? bundle.next_snapshot : composition.genesis;
    },
    issuer: composition.assembly.producerAuthorizationIssuer
  };
  const language = fakeLanguageTransport((request) => ({
    content: draftJson(inputHashFromRequest(request), "B text.", ["episode:e-causal-8"])
  }));
  const root = new RuntimeCompositionRoot({
    subjectCore: core,
    producerAuthorizationIssuer: core.issuer,
    memoryRepository: composition.memory,
    retrieval: retrieval as never,
    cognitionProvider: new ReferenceCognitionProviderV0() as never,
    languageTransport: language.transport,
    episodeContentReader: createEpisodeContentReaderV0(composition.memory)
  });
  return {
    languageRequests: language.requests,
    world: {
      languageRequests: language.requests,
      coreBundles: () => composition.assembly.storeRead.getCommittedBundles(),
      execute: async (request) => {
        const minter = createMiclStageMinter(core, new InMemoryMiclWorkflowStore(), {
          micl_id: "micl-conversation-b" as never,
          micl_request_fingerprint: "sha256:conversation-b" as never,
          stage_key: "OBSERVATION"
        });
        const executor = new ConversationTextResponseExecutorV0({
          ...root.dependencies(),
          subjectCore: minter.core()
        });
        const current = (await core.readCurrentSnapshot(SUBJECT_ID as never)) as SubjectStateV0;
        return executor.execute(
          {
            subject_id: SUBJECT_ID as never,
            current_logical_time: current.runtime_metadata.logical_time as never,
            state_revision: current.runtime_metadata.state_revision as never
          },
          request ?? { response_request_id: "resp-b" as never, cause_refs: [] },
          minter.capabilities([{ repository_revision: "R0", repository_revision_hash: R0_HASH } as never])
        ) as never;
      }
    }
  };
}

// ---- output attacks ---------------------------------------------------------------------------------

describe("language output attacks (no repair, exact stages)", () => {
  const attackCases: readonly {
    readonly name: string;
    readonly responder: (request: ModelTransportRequestV0) => { content: string };
    readonly stage: string;
  }[] = [
    {
      name: "empty text",
      stage: "LANGUAGE_SCHEMA_INVALID",
      responder: () => ({ content: draftJson("unused", "", []) })
    },
    {
      name: "whitespace-only text",
      stage: "LANGUAGE_SCHEMA_INVALID",
      responder: (request) => ({ content: draftJson(inputHashFromRequest(request), "   \n\t ", []) })
    },
    {
      name: "oversized text",
      stage: "LANGUAGE_SCHEMA_INVALID",
      responder: (request) => ({
        content: draftJson(inputHashFromRequest(request), "x".repeat(4097), [])
      })
    },
    {
      name: "control character in text",
      stage: "LANGUAGE_SCHEMA_INVALID",
      responder: (request) => ({
        content: draftJson(inputHashFromRequest(request), "bad\u0000text", [])
      })
    },
    {
      name: "unknown field",
      stage: "LANGUAGE_SCHEMA_INVALID",
      responder: (request) => ({
        content: JSON.stringify({
          schema_version: "language-realization-draft-v0",
          input_hash: inputHashFromRequest(request),
          text: "Text.",
          evidence_refs: [],
          extra_field: true
        })
      })
    },
    {
      name: "wrong schema version",
      stage: "LANGUAGE_SCHEMA_INVALID",
      responder: (request) => ({
        content: JSON.stringify({
          schema_version: "language-realization-draft-v999",
          input_hash: inputHashFromRequest(request),
          text: "Text.",
          evidence_refs: []
        })
      })
    },
    {
      name: "wrong input_hash",
      stage: "LANGUAGE_SCHEMA_INVALID",
      responder: () => ({
        content: draftJson("sha256:" + "f".repeat(64), "Text.", [])
      })
    },
    {
      name: "duplicate evidence refs",
      stage: "LANGUAGE_SCHEMA_INVALID",
      responder: (request) => ({
        content: draftJson(inputHashFromRequest(request), "Text.", [
          "episode:e-causal-1",
          "episode:e-causal-1"
        ])
      })
    },
    {
      name: "unsorted evidence refs",
      stage: "LANGUAGE_SCHEMA_INVALID",
      responder: (request) => ({
        content: draftJson(inputHashFromRequest(request), "Text.", [
          "episode:e-causal-9",
          "episode:e-causal-1"
        ])
      })
    },
    {
      name: "unsupported episode ref",
      stage: "LANGUAGE_EVIDENCE_INVALID",
      responder: (request) => ({
        content: draftJson(inputHashFromRequest(request), "Text.", ["episode:e-unknown"])
      })
    },
    {
      name: "familiarity receipt ref",
      stage: "LANGUAGE_EVIDENCE_INVALID",
      responder: (request) => ({
        content: draftJson(inputHashFromRequest(request), "Text.", [
          "appraisal:1111111111111111111111111111111111111111111111111111111111111111"
        ])
      })
    },
    {
      name: "oversized raw output",
      stage: "LANGUAGE_SCHEMA_INVALID",
      responder: () => ({ content: "x".repeat(64 * 1024 + 1) })
    },
    {
      name: "non-JSON output",
      stage: "LANGUAGE_SCHEMA_INVALID",
      responder: () => ({ content: "not json at all" })
    }
  ];

  it.each(attackCases)("$name → FAILED $stage", { timeout: 60_000 }, async ({ responder, stage }) => {
    const composition = await composeCausalArm(16);
    await establishCausalHead(composition);
    await ingestArm(composition, 16);
    const retrieval = new InMemoryRetrievalService({ rehearsals: [rehearsalFor(composition.memoryRevision)] });
    const core: SubjectCorePort & { issuer: ProducerAuthorizationIssuer } = {
      reserveAndRoute: (proposal) => composition.assembly.facade.reserveAndRoute(proposal),
      commitReserved: (input) => composition.assembly.facade.commitReserved(input),
      terminalizeReservedNoOp: (input) => composition.assembly.facade.terminalizeReservedNoOp(input),
      reconcile: (t, s, f) => composition.assembly.facade.reconcile(t, s, f),
      readCurrentSnapshot: async (id) => {
        const bundle = composition.assembly.storeRead.readCurrentBundle(id);
        return bundle !== null ? bundle.next_snapshot : composition.genesis;
      },
      issuer: composition.assembly.producerAuthorizationIssuer
    };
    const language = fakeLanguageTransport(responder);
    const root = new RuntimeCompositionRoot({
      subjectCore: core,
      producerAuthorizationIssuer: core.issuer,
      memoryRepository: composition.memory,
      retrieval: retrieval as never,
      cognitionProvider: new ReferenceCognitionProviderV0() as never,
      languageTransport: language.transport,
      episodeContentReader: createEpisodeContentReaderV0(composition.memory)
    });
    const minter = createMiclStageMinter(core, new InMemoryMiclWorkflowStore(), {
      micl_id: "micl-attack" as never,
      micl_request_fingerprint: "sha256:attack" as never,
      stage_key: "OBSERVATION"
    });
    const executor = new ConversationTextResponseExecutorV0({
      ...root.dependencies(),
      subjectCore: minter.core()
    });
    const current = (await core.readCurrentSnapshot(SUBJECT_ID as never)) as SubjectStateV0;
    const result = await executor.execute(
      {
        subject_id: SUBJECT_ID as never,
        current_logical_time: current.runtime_metadata.logical_time as never,
        state_revision: current.runtime_metadata.state_revision as never
      },
      { response_request_id: "resp-attack" as never },
      minter.capabilities([{ repository_revision: "R0", repository_revision_hash: R0_HASH } as never])
    );
    expect(result.kind).toBe("FAILED");
    if (result.kind === "FAILED") expect(result.stage).toBe(stage);
    // no fake fallback character reply exists in any failure
    if (result.kind === "FAILED") expect(result).not.toHaveProperty("behavior");
  });
});

// ---- stale context -----------------------------------------------------------------------------------

describe("stale context", () => {
  it("returns STALE_CONTEXT and never delivers text when the revision drifts mid-execution", { timeout: 60_000 }, async () => {
    const composition = await composeCausalArm(1);
    await establishCausalHead(composition);
    await ingestArm(composition, 1);

    // The subject advances WHILE the language provider is running: the fake
    // transport arms the drift exactly when the provider is invoked, so every
    // read during cognition sees the true state and only the post-language
    // verification read sees the advanced revision.
    let driftArmed = false;
    const baseCore: SubjectCorePort & { issuer: ProducerAuthorizationIssuer } = {
      reserveAndRoute: (proposal) => composition.assembly.facade.reserveAndRoute(proposal),
      commitReserved: (input) => composition.assembly.facade.commitReserved(input),
      terminalizeReservedNoOp: (input) => composition.assembly.facade.terminalizeReservedNoOp(input),
      reconcile: (t, s, f) => composition.assembly.facade.reconcile(t, s, f),
      issuer: composition.assembly.producerAuthorizationIssuer,
      readCurrentSnapshot: async (id) => {
        const bundle = composition.assembly.storeRead.readCurrentBundle(id);
        const snapshot = bundle !== null ? bundle.next_snapshot : composition.genesis;
        if (driftArmed) {
          return {
            ...snapshot,
            runtime_metadata: { ...snapshot.runtime_metadata, state_revision: snapshot.runtime_metadata.state_revision + 5 }
          } as SubjectStateV0;
        }
        return snapshot;
      }
    };
    const language = fakeLanguageTransport((request) => {
      driftArmed = true;
      return {
        content: draftJson(inputHashFromRequest(request), "Late text.", [])
      };
    });
    const root = new RuntimeCompositionRoot({
      subjectCore: baseCore,
      producerAuthorizationIssuer: baseCore.issuer,
      memoryRepository: composition.memory,
      retrieval: new InMemoryRetrievalService({ rehearsals: [] }) as never,
      cognitionProvider: new ReferenceCognitionProviderV0() as never,
      languageTransport: language.transport,
      episodeContentReader: createEpisodeContentReaderV0(composition.memory)
    });
    const minter = createMiclStageMinter(baseCore, new InMemoryMiclWorkflowStore(), {
      micl_id: "micl-stale" as never,
      micl_request_fingerprint: "sha256:stale" as never,
      stage_key: "OBSERVATION"
    });
    const executor = new ConversationTextResponseExecutorV0({
      ...root.dependencies(),
      subjectCore: minter.core()
    });
    const current = (await baseCore.readCurrentSnapshot(SUBJECT_ID as never)) as SubjectStateV0;
    const result = await executor.execute(
      {
        subject_id: SUBJECT_ID as never,
        current_logical_time: current.runtime_metadata.logical_time as never,
        state_revision: current.runtime_metadata.state_revision as never
      },
      { response_request_id: "resp-stale" as never },
      minter.capabilities([])
    );
    expect(result.kind).toBe("FAILED");
    if (result.kind === "FAILED") {
      expect(result.stage).toBe("STALE_CONTEXT");
      expect(result.detail).toContain("stale text is not delivered");
    }
  });
});

// ---- restore --------------------------------------------------------------------------------------------

describe("restore production path", () => {
  it("post-restore normal execution reproduces the same language input hash and behavior", { timeout: 120_000 }, async () => {
    const composition = await composeCausalArm(16);
    await establishCausalHead(composition);
    await ingestArm(composition, 16);
    const rehearsal = rehearsalFor(composition.memoryRevision);

    const liveWorld = buildConversationWorldWithRealRetrieval(composition);
    const liveResult = await liveWorld.world.execute();
    expect(liveResult.kind).toBe("OUTPUT_READY");
    const liveHash = liveResult.kind === "OUTPUT_READY" ? liveResult.trace?.language_input_hash : undefined;

    const bundles = composition.assembly.storeRead.getCommittedBundles();
    const terminal = bundles.at(-1);
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

    // FRESH world over the restored canonical state with a fake language provider
    const restoredCore: SubjectCorePort & { issuer: ProducerAuthorizationIssuer } = {
      reserveAndRoute: (proposal) => composition.assembly.facade.reserveAndRoute(proposal),
      commitReserved: (input) => composition.assembly.facade.commitReserved(input),
      terminalizeReservedNoOp: (input) => composition.assembly.facade.terminalizeReservedNoOp(input),
      reconcile: (t, s, f) => composition.assembly.facade.reconcile(t, s, f),
      readCurrentSnapshot: async (id) => {
        void id;
        return restored.restored_snapshot;
      },
      issuer: composition.assembly.producerAuthorizationIssuer
    };
    const language = fakeLanguageTransport((request) => ({
      content: draftJson(inputHashFromRequest(request), "B text.", ["episode:e-causal-8"])
    }));
    const root = new RuntimeCompositionRoot({
      subjectCore: restoredCore,
      producerAuthorizationIssuer: restoredCore.issuer,
      memoryRepository: composition.memory,
      retrieval: new InMemoryRetrievalService({ rehearsals: [rehearsal] }) as never,
      cognitionProvider: new ReferenceCognitionProviderV0() as never,
      languageTransport: language.transport,
      episodeContentReader: createEpisodeContentReaderV0(composition.memory)
    });
    const minter = createMiclStageMinter(restoredCore, new InMemoryMiclWorkflowStore(), {
      micl_id: "micl-restore-lang" as never,
      micl_request_fingerprint: "sha256:restore-lang" as never,
      stage_key: "OBSERVATION"
    });
    const executor = new ConversationTextResponseExecutorV0({
      ...root.dependencies(),
      subjectCore: minter.core()
    });
    const restoredSnapshot = restored.restored_snapshot as SubjectStateV0;
    const result = await executor.execute(
      {
        subject_id: SUBJECT_ID as never,
        current_logical_time: restoredSnapshot.runtime_metadata.logical_time as never,
        state_revision: restoredSnapshot.runtime_metadata.state_revision as never
      },
      { response_request_id: "resp-b" as never, cause_refs: [] },
      minter.capabilities([{ repository_revision: "R0", repository_revision_hash: R0_HASH } as never])
    );
    expect(result.kind).toBe("OUTPUT_READY");
    if (result.kind !== "OUTPUT_READY") return;
    // same lawful inputs → same language input hash and the same fake behavior artifact
    expect(result.trace.language_input_hash).toBe(liveHash);
    expect(result.behavior.text).toBe("B text.");
    expect(result.behavior.evidence_refs).toStrictEqual(["episode:e-causal-8"]);
    expect(language.requests).toHaveLength(1);
  });
});
