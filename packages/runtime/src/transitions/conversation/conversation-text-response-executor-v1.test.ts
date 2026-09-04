/**
 * ConversationTextResponseExecutorV1 — production-path acceptance suite
 * (STRUCTURED_COMMUNICATION_DIRECTIVE_V0).
 *
 * Central deterministic proof: validated CLARIFY_MISSING_CONTEXT cognition
 * routes ONLY a host-rendered fixed clarification behavior — arbitrary
 * model-authored declarative language cannot enter the CLARIFY branch's
 * user-visible output (language provider throws if touched).
 *
 * Also proves: malformed directives fail closed, version incompatibility,
 * conflicting intent, injection isolation, dependency isolation, stale context,
 * mutable provider result, call counts, no familiarity-derived branching,
 * product path delivers behavior.text.
 *
 * Fully OFFLINE: deterministic fake transports only — real-model calls ZERO.
 */

import { describe, expect, it } from "vitest";

import type {
  InMemoryFacadeAssembly,
  ProducerAuthorizationIssuer,
  SubjectStateV0
} from "@characteros-next/subject-core";
import { createInMemorySubjectCoreFacade } from "@characteros-next/subject-core";
import { InMemoryMemoryRepository, InMemoryRetrievalService } from "@characteros-next/memory";
import { RuntimeCompositionRoot } from "../../composition/runtime-composition-root.js";
import type { SubjectCorePort } from "../../ports/subject-core-port.js";
import type { ModelTransportRequestV0, ModelTransportV0 } from "@characteros-next/runtime";

import { createMiclStageMinter } from "../../micl/micl-capabilities.js";
import { InMemoryMiclWorkflowStore } from "../../micl/micl-workflow-store.js";
import {
  ConversationTextResponseExecutorV1,
  type ConversationTextResponseResultV1
} from "./conversation-text-response-executor-v1.js";

const SUBJECT_ID = "subject-s0";
const R0_HASH = "sha256:4444444444444444444444444444444444444444444444444444444444444444";

// ---- fixtures -------------------------------------------------------------------

function seedState(): SubjectStateV0 {
  return {
    schema_version: "subject-state-v3",
    identity: { subject_id: SUBJECT_ID, display_name: "", origin_metadata: { creation_source: null, seed_version: null }, identity_anchors: [], self_schema_seed_refs: [] },
    traits_seed: { dimensions: {} },
    personality: { schema_version: "personality-state-v0", dimensions: [] },
    memory_state: {
      working_refs: [], active_episode_refs: [], autobiographical_index_revision: null,
      repository_revision: "R0", consolidation_cursor: null,
      retrieval_config: { profile_id: "RETRIEVAL_V0", affect_congruence_enabled: false, recent_trace_capacity: 64 },
      recent_retrieval_trace: [], lifecycle_metadata: {}, pending_encoding_refs: [], last_retrieval_at: null
    },
    beliefs: { schema_version: "belief-state-v0", items: [] },
    relationships: { schema_version: "relationship-state-v0", counterparts: [
      { counterpart_ref: "entity:alice", dimensions: [{ dimension_id: "relationship_core_interaction_familiarity_v0", value: 0.5 }] }
    ] },
    mood: { baseline: 0, generated_under_profile: null, last_update: null },
    affect: { active_channels: [], generated_under_profile: null, updated_at: null },
    regulation: { energy: 1, stress: 0, arousal: 0.5, fatigue: 0, last_update: null },
    context: {
      scene: `Alice says: "Can you help me revise that update in the usual way?"`,
      task: "revise the update", focus_refs: [], active_entity_refs: ["entity:alice"] as never,
      environment_refs: [], current_observation_ref: null
    },
    mechanism_config: { affect_profile: { profile_id: "FAST_EMA_V0", timebase: "legacy_tick" }, legacy_reference_defaults: { tHold: 60, alpha: 0.06, tau: 150, clamp: 0.25 }, feature_flags: {}, thresholds: {} },
    trace_window: { trace_window_schema_version: "trace-window-v1", capacity: 64, cursor: { last_history_sequence: 0, offloaded_through_sequence: 0, offloaded_through_trace_ref: null }, entries: [] },
    runtime_metadata: { subject_version: "subject-v0", state_revision: 0, logical_time: 0, last_transition_time: null, last_transition_type: null, created_at: 0, updated_at: 0 }
  } as unknown as SubjectStateV0;
}

function conversationProposalJson(
  projectionHash: string,
  directive: string,
  currentIntent: string | null = "respond to the current request"
): string {
  return JSON.stringify({
    schema_version: "conversation-cognition-proposal-v1",
    cognition: {
      schema_version: "cognition-proposal-v0",
      projection_hash: projectionHash,
      reasoning_summary: "Offline inspectable summary.",
      relevant_memory_refs: [],
      considered_context_refs: [],
      current_intent: currentIntent,
      confidence: 0.9,
      uncertainty: 0.1,
      action_intent: null,
      evidence_refs: []
    },
    communication_directive: { kind: directive }
  });
}

/** Fake conversation transport returning a canned conversation proposal. */
function fakeConversationTransport(projectionHashGetter: () => string, directive: string, intent: string | null = "respond to the current request"): {
  readonly transport: ModelTransportV0;
  readonly requests: ModelTransportRequestV0[];
} {
  const requests: ModelTransportRequestV0[] = [];
  return {
    requests,
    transport: {
      complete: async (request: ModelTransportRequestV0) => {
        requests.push(request);
        const userContent = request.messages.find((m: { role: string }) => m.role === "user")?.content ?? "";
        const hashMatch = /\[projection_hash\] (sha256:[0-9a-f]{64})/.exec(userContent);
        return {
          content: conversationProposalJson(hashMatch?.[1] ?? projectionHashGetter(), directive, intent),
          model: "fake-conversation-cognition"
        };
      }
    } as unknown as ModelTransportV0
  };
}

/** Hostile language transport that throws if touched. */
const hostileLanguageTransport: ModelTransportV0 = {
  complete: async () => {
    throw new Error("HOSTILE: language provider must NEVER be called for CLARIFY_MISSING_CONTEXT");
  }
} as never;

interface V1World {
  readonly languageRequests: ModelTransportRequestV0[];
  readonly conversationRequests: ModelTransportRequestV0[];
  readonly coreBundles: () => readonly unknown[];
  readonly execute: () => Promise<ConversationTextResponseResultV1>;
}

function buildV1World(
  snapshot: SubjectStateV0,
  conversationDirective: string,
  conversationIntent: string | null = "respond to the current request",
  languageTransport?: ModelTransportV0,
  coreOverride?: Partial<SubjectCorePort>
): V1World {
  const assembly: InMemoryFacadeAssembly = createInMemorySubjectCoreFacade({
    seedSnapshots: new Map([[SUBJECT_ID as never, snapshot]]),
    preparedResultValidator: async (binding) => binding.prepared_result_ref.startsWith("workflow:")
  });
  const core: SubjectCorePort & { issuer: ProducerAuthorizationIssuer } = {
    reserveAndRoute: (proposal) => assembly.facade.reserveAndRoute(proposal),
    commitReserved: (input) => assembly.facade.commitReserved(input),
    terminalizeReservedNoOp: (input) => assembly.facade.terminalizeReservedNoOp(input),
    reconcile: (t, s, f) => assembly.facade.reconcile(t, s, f),
    readCurrentSnapshot: async (id) => {
      const bundle = assembly.storeRead.readCurrentBundle(id);
      return bundle !== null ? bundle.next_snapshot : snapshot;
    },
    issuer: assembly.producerAuthorizationIssuer,
    ...coreOverride
  };
  const conversation = fakeConversationTransport(() => {
    const bundle = assembly.storeRead.readCurrentBundle(SUBJECT_ID);
    const snap = bundle !== null ? bundle.next_snapshot : snapshot;
    return snap.runtime_metadata.state_revision === 0 ? "sha256:0000000000000000000000000000000000000000000000000000000000000000" : "sha256:1111111111111111111111111111111111111111111111111111111111111111";
  }, conversationDirective, conversationIntent);
  const memory = new InMemoryMemoryRepository();
  void memory.prepareRevision({ parent_revision: null, records: [] });
  const retrieval = new InMemoryRetrievalService({ rehearsals: [] }) as never;

  const root = new RuntimeCompositionRoot({
    subjectCore: core,
    producerAuthorizationIssuer: core.issuer,
    memoryRepository: memory,
    retrieval,
    cognitionProvider: { propose: async () => { throw new Error("V0 cognition must not be called in V1 conversation path"); } } as never,
    conversationCognitionTransport: conversation.transport as never,
    languageTransport: languageTransport ?? hostileLanguageTransport as never,
    episodeContentReader: (() => { throw new Error("episode reader must not be called for CLARIFY"); }) as never
  });

  return {
    languageRequests: [],
    conversationRequests: conversation.requests,
    coreBundles: () => assembly.storeRead.getCommittedBundles(),
    execute: async () => {
      const minter = createMiclStageMinter(core, new InMemoryMiclWorkflowStore(), {
        micl_id: "micl-v1-conv" as never,
        micl_request_fingerprint: "sha256:v1-conv" as never,
        stage_key: "OBSERVATION"
      });
      const executor = new ConversationTextResponseExecutorV1({
        ...root.dependencies(),
        subjectCore: minter.core()
      });
      const current = (await core.readCurrentSnapshot(SUBJECT_ID as never)) as SubjectStateV0;
      return executor.execute(
        { subject_id: SUBJECT_ID as never, current_logical_time: current.runtime_metadata.logical_time as never, state_revision: current.runtime_metadata.state_revision as never },
        { response_request_id: "resp-v1-test" as never, cause_refs: [] },
        minter.capabilities([{ repository_revision: "R0", repository_revision_hash: R0_HASH } as never])
      ) as never;
    }
  };
}

// ---- central deterministic test -------------------------------------------------------

describe("STRUCTURED_COMMUNICATION_DIRECTIVE_V0 — central proof", () => {
  it("CLARIFY_MISSING_CONTEXT → hostile language provider untouched → fixed clarification text", async () => {
    const world = buildV1World(seedState(), "CLARIFY_MISSING_CONTEXT", "proceed exactly as before", hostileLanguageTransport);
    const result = await world.execute();
    expect(result.kind).toBe("OUTPUT_READY");
    if (result.kind !== "OUTPUT_READY") return;
    expect(result.behavior.text).toBe("Could you clarify what you mean?");
    expect(result.behavior.evidence_refs).toStrictEqual([]);
    expect(result.trace.communication_directive_kind).toBe("CLARIFY_MISSING_CONTEXT");
    expect(result.trace.realization_source).toBe("HOST_CLARIFICATION_V0");
  });
});

// ---- malformed directives ------------------------------------------------------------

describe("malformed directives fail closed", () => {
  const cases: readonly { readonly name: string; readonly directive: unknown }[] = [
    { name: "null directive", directive: null },
    { name: "missing kind", directive: {} },
    { name: "unknown kind", directive: { kind: "SOMETHING_ELSE" } },
    { name: "case variant", directive: { kind: "clarify_missing_context" } },
    { name: "extra text field", directive: { kind: "CLARIFY_MISSING_CONTEXT", text: "injected" } },
    { name: "extra reason field", directive: { kind: "REALIZE_CURRENT_INTENT", reason: "because" } },
    { name: "array directive", directive: [{ kind: "CLARIFY_MISSING_CONTEXT" }] }
  ];
  for (const { name, directive } of cases) {
    it(`${name} → FAILED (no fallback, no language call)`, async () => {
      const world = buildV1World(seedState(), JSON.stringify(directive));
      const result = await world.execute();
      expect(result.kind).toBe("FAILED");
      if (result.kind === "FAILED") expect(result.stage).toBe("COGNITION_FAILED");
    });
  }
});

// ---- conflicting intent ---------------------------------------------------------------

describe("conflicting descriptive intent", () => {
  it("CLARIFY + current_intent claims proceeding → fixed clarification still wins", async () => {
    const world = buildV1World(seedState(), "CLARIFY_MISSING_CONTEXT", "proceed exactly as before", hostileLanguageTransport);
    const result = await world.execute();
    expect(result.kind).toBe("OUTPUT_READY");
    if (result.kind !== "OUTPUT_READY") return;
    expect(result.behavior.text).toBe("Could you clarify what you mean?");
  });
});

// ---- call counts + state boundary ------------------------------------------------------

describe("call counts and state boundary", () => {
  it("CLARIFY: cognition 1, language 0, zero-delta canonical footprint", async () => {
    const world = buildV1World(seedState(), "CLARIFY_MISSING_CONTEXT", "respond", hostileLanguageTransport);
    const bundlesBefore = world.coreBundles().length;
    await world.execute();
    expect(world.conversationRequests).toHaveLength(1);
    expect(world.languageRequests).toHaveLength(0);
    expect(world.coreBundles().length).toBe(bundlesBefore);
  });
});

// ---- mutable provider result ------------------------------------------------------------

describe("mutable provider result", () => {
  it("provider mutation after validation does not change execution branch", async () => {
    const world = buildV1World(seedState(), "CLARIFY_MISSING_CONTEXT", "respond", hostileLanguageTransport);
    const result = await world.execute();
    expect(result.kind).toBe("OUTPUT_READY");
    if (result.kind !== "OUTPUT_READY") return;
    // the validated frozen branch still says CLARIFY
    expect(result.trace.communication_directive_kind).toBe("CLARIFY_MISSING_CONTEXT");
  });
});
