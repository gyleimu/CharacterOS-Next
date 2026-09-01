/**
 * Ollama Native Cognition Provider V0 — offline acceptance suite.
 *
 * NO real model, NO network, NO Ollama: the HTTP boundary is fully mocked via
 * `vi.stubGlobal("fetch", ...)`. The suite proves the transport-adapter
 * composition: the EXISTING frozen LlmCognitionProviderV0 + the NEW native
 * transport (POST /api/chat, stream:false, think:false, temperature 0,
 * num_predict output budget, ONE request, no retry/repair/fallback).
 *
 * Authority boundaries proven here: message.content ONLY (thinking/reasoning
 * ignored, thinking-only fails closed), final validation stays with the frozen
 * provider gates (schema, projection binding, evidence, action space), zero
 * canonical authority, zero input mutation, deterministic request bytes, and
 * the frozen Belief → Cognition prompt surface reaching the native endpoint
 * unchanged. NO OpenAI-compatible endpoint is ever requested.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  InMemoryFacadeAssembly,
  ProducerAuthorizationIssuer,
  SubjectStateV0
} from "@characteros-next/subject-core";
import { createInMemorySubjectCoreFacade } from "@characteros-next/subject-core";
import { InMemoryMemoryRepository } from "@characteros-next/memory";

import { RuntimeCompositionRoot } from "../../composition/runtime-composition-root.js";
import type { SubjectCorePort } from "../../ports/subject-core-port.js";
import { ReferenceContextProducer } from "../../ports/context-producer-port.js";
import { createMiclStageMinter } from "../../micl/micl-capabilities.js";
import { InMemoryMiclWorkflowStore } from "../../micl/micl-workflow-store.js";
import { HASH_V1_R0_REPOSITORY, s0 } from "../../transitions/observation/observation-fixtures.js";
import {
  buildCognitiveContextProjection,
  CognitionActionTransitionExecutor
} from "../../transitions/cognition-action/cognition-action-transition-executor.js";
import type {
  AllowedActionV0,
  CognitiveContextProjectionV0
} from "../../transitions/cognition-action/types.js";
import { buildCognitivePromptMessages } from "./cognitive-prompt-projection.js";
import { LlmCognitionProviderV0 } from "./llm-cognition-provider.js";
import {
  OLLAMA_NATIVE_COGNITION_TRANSPORT_NUM_PREDICT,
  OLLAMA_NATIVE_COGNITION_TRANSPORT_TIMEOUT_MS,
  OllamaNativeCognitionTransportV0,
  type OllamaNativeCognitionTransportConfigV0
} from "./ollama-native-cognition-transport.js";

const BASE_URL = "http://127.0.0.1:11434";
const MODEL = "qwen3.5:9b";

function config(overrides: Partial<OllamaNativeCognitionTransportConfigV0> = {}): OllamaNativeCognitionTransportConfigV0 {
  return { base_url: BASE_URL, model: MODEL, ...overrides };
}

interface FetchCall {
  url: string;
  init: RequestInit | undefined;
}

/** Fetch stub with call capture (every test asserts ONE attempt). */
function stubFetch(respond: (call: FetchCall) => Response | Promise<Response>): { calls: FetchCall[] } {
  const calls: FetchCall[] = [];
  vi.stubGlobal("fetch", async (input: unknown, init?: RequestInit) => {
    const call: FetchCall = { url: typeof input === "string" ? input : String((input as { url?: string })?.url ?? input), init };
    calls.push(call);
    return respond(call);
  });
  return { calls };
}

function okJson(body: string): Response {
  return new Response(body, { status: 200, headers: { "content-type": "application/json" } });
}

/** Native envelope carrying final content and (optionally) vendor reasoning. */
function ollamaBody(content: string, thinking: string | null = null): string {
  const message: Record<string, unknown> = { role: "assistant", content };
  if (thinking !== null) {
    message["thinking"] = thinking;
    message["reasoning"] = thinking;
    message["reasoning_content"] = thinking;
  }
  return JSON.stringify({ model: MODEL, message });
}

function bodyOf(calls: FetchCall[]): Record<string, unknown> {
  const call = calls[0];
  if (call === undefined) throw new Error("expected one fetch call");
  return JSON.parse(String(call.init?.body)) as Record<string, unknown>;
}

async function buildProjection(
  allowedActions: readonly AllowedActionV0[] = []
): Promise<CognitiveContextProjectionV0> {
  const base = await buildCognitiveContextProjection(s0() as unknown as SubjectStateV0);
  return { ...base, allowed_actions: allowedActions as never } as CognitiveContextProjectionV0;
}

/** Projection built from a canonical snapshot carrying ONE Belief stance. */
async function buildProjectionWithBelief(): Promise<CognitiveContextProjectionV0> {
  const base = s0() as unknown as SubjectStateV0;
  const snapshot = {
    ...base,
    beliefs: {
      schema_version: "belief-state-v0",
      items: [{ proposition_id: "prop.bob-trustworthy", proposition_label: "Bob is trustworthy", credence: 0.9 }]
    }
  } as unknown as SubjectStateV0;
  return buildCognitiveContextProjection(snapshot);
}

function validProposalJson(projection: CognitiveContextProjectionV0, overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    schema_version: "cognition-proposal-v0",
    projection_hash: projection.projection_hash,
    reasoning_summary: "native-path check",
    relevant_memory_refs: [],
    considered_context_refs: [],
    current_intent: "native:cognition",
    confidence: 0.5,
    uncertainty: 0.5,
    action_intent: null,
    evidence_refs: [],
    ...overrides
  });
}

function nativeProvider(overrides: Partial<OllamaNativeCognitionTransportConfigV0> = {}): LlmCognitionProviderV0 {
  return new LlmCognitionProviderV0(new OllamaNativeCognitionTransportV0(config(overrides)));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

// ============================================================================
// §20/§21/§6 — request envelope and endpoint identity
// ============================================================================

describe("OllamaNativeCognitionTransportV0 — native request envelope", () => {
  it("issues exactly ONE POST to /api/chat with stream/think false and temperature 0", async () => {
    const projection = await buildProjection();
    const { calls } = stubFetch(() => okJson(ollamaBody(validProposalJson(projection))));
    await nativeProvider().propose(projection);
    expect(calls).toHaveLength(1);
    const call = calls[0];
    if (call === undefined) throw new Error("unreachable");
    expect(call.url).toBe(`${BASE_URL}/api/chat`);
    expect(call.init?.method).toBe("POST");
    const body = bodyOf(calls);
    expect(body["stream"]).toBe(false);
    expect(body["think"]).toBe(false);
    expect(body["options"]).toEqual({ temperature: 0, num_predict: OLLAMA_NATIVE_COGNITION_TRANSPORT_NUM_PREDICT });
  });

  it("never requests the OpenAI-compatible endpoint", async () => {
    const projection = await buildProjection();
    const { calls } = stubFetch(() => okJson(ollamaBody(validProposalJson(projection))));
    await nativeProvider().propose(projection);
    for (const call of calls) {
      expect(call.url).not.toContain("/v1/chat/completions");
      expect(call.url.endsWith("/api/chat")).toBe(true);
    }
  });

  it("normalizes the base URL without duplicating the /api/chat path and sends no Authorization header", async () => {
    const projection = await buildProjection();
    const { calls } = stubFetch(() => okJson(ollamaBody(validProposalJson(projection))));
    await nativeProvider({ base_url: `${BASE_URL}/` }).propose(projection);
    const call = calls[0];
    if (call === undefined) throw new Error("unreachable");
    expect(call.url).toBe(`${BASE_URL}/api/chat`);
    const headers = (call.init?.headers ?? {}) as Record<string, string>;
    expect(headers["authorization"]).toBeUndefined();
  });

  it("sends the EXISTING cognition prompt messages (system rules + subject data) verbatim", async () => {
    const projection = await buildProjection();
    const { calls } = stubFetch(() => okJson(ollamaBody(validProposalJson(projection))));
    await nativeProvider().propose(projection);
    const expected = buildCognitivePromptMessages(projection).map((m) => ({ role: m.role, content: m.content }));
    expect(bodyOf(calls)["messages"]).toEqual(expected);
  });

  it("maps an explicit num_predict override into options.num_predict (existing output-budget semantics)", async () => {
    const projection = await buildProjection();
    const { calls } = stubFetch(() => okJson(ollamaBody(validProposalJson(projection))));
    await nativeProvider({ num_predict: 4096 }).propose(projection);
    expect(bodyOf(calls)["options"]).toEqual({ temperature: 0, num_predict: 4096 });
  });

  it("exposes explicit defaults: num_predict 2048, timeout 120000 ms", () => {
    expect(OLLAMA_NATIVE_COGNITION_TRANSPORT_NUM_PREDICT).toBe(2048);
    expect(OLLAMA_NATIVE_COGNITION_TRANSPORT_TIMEOUT_MS).toBe(120000);
  });

  it("rejects invalid configuration fail-closed (no ambient fallback)", () => {
    expect(() => new OllamaNativeCognitionTransportV0(config({ base_url: "  " }))).toThrow("MODEL_TRANSPORT_");
    expect(() => new OllamaNativeCognitionTransportV0(config({ model: "" }))).toThrow("MODEL_TRANSPORT_");
    expect(() => new OllamaNativeCognitionTransportV0(config({ timeout_ms: 0 }))).toThrow("MODEL_TRANSPORT_");
    expect(() => new OllamaNativeCognitionTransportV0(config({ num_predict: -1 }))).toThrow("MODEL_TRANSPORT_");
  });
});

// ============================================================================
// §9/§10 — response authority: message.content ONLY
// ============================================================================

describe("OllamaNativeCognitionTransportV0 — response authority", () => {
  it("uses message.content ONLY when thinking/reasoning fields are also present", async () => {
    const projection = await buildProjection();
    const marker = validProposalJson(projection, { reasoning_summary: "content-only-authority" });
    stubFetch(() => okJson(ollamaBody(marker, "very long hidden reasoning that must never matter")));
    const proposal = await nativeProvider().propose(projection);
    expect(proposal.reasoning_summary).toBe("content-only-authority");
  });

  it("fails closed on a thinking-only response (empty content; no recovery from reasoning)", async () => {
    const projection = await buildProjection();
    const { calls } = stubFetch(() => okJson(ollamaBody("", "hours of hidden chain-of-thought")));
    await expect(nativeProvider().propose(projection)).rejects.toMatchObject({ code: "MODEL_EMPTY_RESPONSE" });
    expect(calls).toHaveLength(1); // no retry after the failure
  });

  it("fails closed on missing message, whitespace-only content, and non-object envelopes", async () => {
    const projection = await buildProjection();
    const cases = [
      JSON.stringify({ model: MODEL }),
      ollamaBody("   \n\t "),
      JSON.stringify("just a string")
    ];
    for (const body of cases) {
      const { calls } = stubFetch(() => okJson(body));
      await expect(nativeProvider().propose(projection)).rejects.toMatchObject({ code: "MODEL_EMPTY_RESPONSE" });
      expect(calls).toHaveLength(1);
    }
  });
});

// ============================================================================
// §24-§27 — final validation authority stays with the frozen cognition gates
// ============================================================================

describe("OllamaNativeCognitionTransportV0 — frozen validation authority", () => {
  it("a lawful proposal parses through the EXISTING contract with projection binding intact", async () => {
    const projection = await buildProjection();
    stubFetch(() => okJson(ollamaBody(validProposalJson(projection))));
    const proposal = await nativeProvider().propose(projection);
    expect(proposal.projection_hash).toBe(projection.projection_hash);
    expect(proposal.schema_version).toBe("cognition-proposal-v0");
    expect(proposal.action_intent).toBeNull();
  });

  it("wrong projection_hash: parsed as untrusted, rejected by frozen binding (never rewritten)", async () => {
    const projection = await buildProjection();
    stubFetch(() => okJson(ollamaBody(validProposalJson(projection, { projection_hash: "sha256:foreign" }))));
    await expect(nativeProvider().propose(projection)).rejects.toThrow("MODEL_PROJECTION_MISMATCH");
  });

  it("illegal evidence ref: rejected by frozen grounding (never stripped by the provider)", async () => {
    const projection = await buildProjection();
    stubFetch(() =>
      okJson(ollamaBody(validProposalJson(projection, { evidence_refs: ["belief:prop.bob-trustworthy"] })))
    );
    // V0 has no belief ref kind: the closed grammar rejects before grounding —
    // fail closed either way, nothing repaired.
    await expect(nativeProvider().propose(projection)).rejects.toThrow("LLM_COGNITION_");
  });

  it("action outside the allowed space: rejected by frozen action-space validation (no substitution)", async () => {
    const projection = await buildProjection([{ action_type: "TRUST_BOB", target_ref: "entity:bob" } as never]);
    stubFetch(() =>
      okJson(
        ollamaBody(
          validProposalJson(projection, { action_intent: { action_type: "VERIFY_BOB", target_ref: "entity:bob" } })
        )
      )
    );
    await expect(nativeProvider().propose(projection)).rejects.toThrow("MODEL_ACTION_NOT_ALLOWED");
  });

  it("a lawful action intent within the supplied space passes the frozen gates", async () => {
    const projection = await buildProjection([{ action_type: "TRUST_BOB", target_ref: "entity:bob" } as never]);
    stubFetch(() =>
      okJson(
        ollamaBody(
          validProposalJson(projection, { action_intent: { action_type: "TRUST_BOB", target_ref: "entity:bob" } })
        )
      )
    );
    const proposal = await nativeProvider().propose(projection);
    expect(proposal.action_intent).toEqual({ action_type: "TRUST_BOB", target_ref: "entity:bob" });
  });
});

// ============================================================================
// §28 — malformed final content follows the EXISTING direct parsing contract
// ============================================================================

describe("OllamaNativeCognitionTransportV0 — malformed content policy", () => {
  it("invalid JSON fails closed (MODEL_MALFORMED_JSON, one attempt)", async () => {
    const projection = await buildProjection();
    const { calls } = stubFetch(() => okJson(ollamaBody("{ broken")));
    await expect(nativeProvider().propose(projection)).rejects.toThrow("MODEL_MALFORMED_JSON");
    expect(calls).toHaveLength(1);
  });

  it("JSON plus commentary fails closed (no trailing-text salvage)", async () => {
    const projection = await buildProjection();
    stubFetch(() => okJson(ollamaBody(`${validProposalJson(projection)}\nHope this helps!`)));
    await expect(nativeProvider().propose(projection)).rejects.toThrow("MODEL_MALFORMED_JSON");
  });

  it("markdown-fenced JSON follows the EXISTING frozen parser contract (LIVE-SMOKE tolerance, not new salvage)", async () => {
    // The frozen LlmCognitionProviderV0 parser (unchanged by this slice) already
    // tolerates one markdown fence; the native adapter adds NO salvage of its
    // own. All substantive gates still run afterwards on the parsed object.
    const projection = await buildProjection();
    stubFetch(() => okJson(ollamaBody(`\`\`\`json\n${validProposalJson(projection)}\n\`\`\``)));
    const proposal = await nativeProvider().propose(projection);
    expect(proposal.projection_hash).toBe(projection.projection_hash);
  });
});

// ============================================================================
// §29 — transport failures: one attempt, fail closed, no retry
// ============================================================================

describe("OllamaNativeCognitionTransportV0 — transport failures", () => {
  it("fetch throw surfaces as MODEL_CONNECTION_FAILURE after exactly one attempt", async () => {
    const projection = await buildProjection();
    const { calls } = stubFetch(() => {
      throw new Error("connection refused");
    });
    await expect(nativeProvider().propose(projection)).rejects.toMatchObject({ code: "MODEL_CONNECTION_FAILURE" });
    expect(calls).toHaveLength(1);
  });

  it("timeout aborts via AbortSignal as MODEL_TIMEOUT after exactly one attempt", async () => {
    const projection = await buildProjection();
    const { calls } = stubFetch((_call) => new Promise((resolve, reject) => {
      // Respect the transport's abort signal; never resolve on our own.
      const abort = (_call.init?.signal as AbortSignal | undefined) ?? null;
      abort?.addEventListener("abort", () => reject(new Error("aborted")));
    }));
    await expect(nativeProvider({ timeout_ms: 20 }).propose(projection)).rejects.toMatchObject({ code: "MODEL_TIMEOUT" });
    expect(calls).toHaveLength(1);
  });

  it("non-2xx responses fail closed with the HTTP status preserved", async () => {
    const projection = await buildProjection();
    for (const status of [400, 500]) {
      const { calls } = stubFetch(() => new Response("nope", { status }));
      await expect(nativeProvider().propose(projection)).rejects.toMatchObject({
        code: "MODEL_HTTP_FAILURE",
        http_status: status
      });
      expect(calls).toHaveLength(1);
    }
  });

  it("a non-JSON envelope body fails closed after exactly one attempt", async () => {
    const projection = await buildProjection();
    const { calls } = stubFetch(() => new Response("<html>not json</html>", { status: 200 }));
    await expect(nativeProvider().propose(projection)).rejects.toMatchObject({ code: "MODEL_HTTP_FAILURE" });
    expect(calls).toHaveLength(1);
  });
});

// ============================================================================
// §19/§30/§31 — determinism and input immutability
// ============================================================================

describe("OllamaNativeCognitionTransportV0 — determinism and immutability", () => {
  it("identical input twice yields byte-identical requests (stream/think/temperature/model/messages/num_predict stable)", async () => {
    const projection = await buildProjection();
    const { calls } = stubFetch(() => okJson(ollamaBody(validProposalJson(projection))));
    const provider = nativeProvider();
    await provider.propose(projection);
    await provider.propose(projection);
    expect(calls).toHaveLength(2);
    const [first, second] = calls;
    if (first === undefined || second === undefined) throw new Error("expected two fetch calls");
    expect(second.url).toBe(first.url);
    expect(String(second.init?.body)).toBe(String(first.init?.body));
    const body = bodyOf([first]);
    expect(body["stream"]).toBe(false);
    expect(body["think"]).toBe(false);
    expect(body["model"]).toBe(MODEL);
    expect(body["options"]).toEqual({ temperature: 0, num_predict: OLLAMA_NATIVE_COGNITION_TRANSPORT_NUM_PREDICT });
  });

  it("deep-frozen projection input survives the invocation unchanged", async () => {
    const projection = await buildProjectionWithBelief();
    const frozen = Object.freeze(JSON.parse(JSON.stringify(projection))) as CognitiveContextProjectionV0;
    const before = JSON.stringify(frozen);
    stubFetch(() => okJson(ollamaBody(validProposalJson(projection))));
    await nativeProvider().propose(frozen);
    expect(JSON.stringify(frozen)).toBe(before);
  });
});

// ============================================================================
// §32 — Belief projection regression: frozen prompt surface reaches the native
// endpoint unchanged (no second Belief renderer)
// ============================================================================

describe("OllamaNativeCognitionTransportV0 — frozen Belief projection on the wire", () => {
  it("the native request carries the existing prompt with the frozen Belief stance intact", async () => {
    const projection = await buildProjectionWithBelief();
    const { calls } = stubFetch(() => okJson(ollamaBody(validProposalJson(projection))));
    await nativeProvider().propose(projection);
    const messages = bodyOf(calls)["messages"] as { role: string; content: string }[];
    const subjectData = messages.find((m) => m.role === "user");
    const systemRules = messages.find((m) => m.role === "system");
    if (subjectData === undefined || systemRules === undefined) throw new Error("prompt messages missing");
    expect(subjectData.content).toContain("SUBJECTIVE BELIEF STANCES");
    expect(subjectData.content).toContain('"proposition_id":"prop.bob-trustworthy"');
    expect(subjectData.content).toContain('"credence":0.9');
    expect(subjectData.content).toContain(`[projection_hash] ${projection.projection_hash}`);
    // Rule 5 of the frozen system rules: belief stance values are visible but
    // never citeable — the STATE_VISIBLE_NOT_CITEABLE contract on the wire.
    expect(systemRules.content).toContain(
      "Do not cite a proposition_id or belief label merely because it appears under Subjective Belief Stances."
    );
    expect(subjectData.content).toBe(buildCognitivePromptMessages(projection)[1]?.content);
  });
});

// ============================================================================
// §24 — one lawful proposal continues through the existing executor gates
// (practical integration, no executor-suite duplication)
// ============================================================================

interface TestCore extends SubjectCorePort {
  readonly issuer: ProducerAuthorizationIssuer;
  readonly storeRead: {
    readCurrentBundle(subjectId: string): { next_snapshot: SubjectStateV0 } | null;
    getCommittedBundles(): readonly unknown[];
  };
}

function createExecutorTestCore(snapshot: SubjectStateV0): TestCore {
  const assembly: InMemoryFacadeAssembly = createInMemorySubjectCoreFacade({
    seedSnapshots: new Map([["subject-s0" as never, snapshot]]),
    preparedResultValidator: async (binding) => binding.prepared_result_ref.startsWith("workflow:")
  });
  const port: SubjectCorePort = {
    reserveAndRoute: (proposal) => assembly.facade.reserveAndRoute(proposal),
    commitReserved: (input) => assembly.facade.commitReserved(input),
    terminalizeReservedNoOp: (input) => assembly.facade.terminalizeReservedNoOp(input),
    reconcile: (t, s, f) => assembly.facade.reconcile(t, s, f),
    readCurrentSnapshot: async (id) => {
      const bundle = assembly.storeRead.readCurrentBundle(id);
      return bundle !== null ? bundle.next_snapshot : snapshot;
    }
  };
  return { ...port, issuer: assembly.producerAuthorizationIssuer, storeRead: assembly.storeRead };
}

describe("OllamaNativeCognitionTransportV0 — executor round trip (mocked HTTP)", () => {
  it("a lawful native proposal completes the frozen CognitionAction zero-delta NO_OP", async () => {
    const snapshot = {
      ...(s0() as unknown as SubjectStateV0),
      context: {
        scene: "idle",
        task: null,
        focus_refs: [],
        active_entity_refs: ["entity:bob"],
        environment_refs: ["environment:route-junction"],
        current_observation_ref: "observation:o-77"
      }
    } as unknown as SubjectStateV0;
    const actions: AllowedActionV0[] = [{ action_type: "TRUST_BOB", target_ref: "entity:bob" } as never];
    const projection = await buildCognitiveContextProjection(snapshot);
    const proposalJson = validProposalJson(projection, {
      action_intent: { action_type: "TRUST_BOB", target_ref: "entity:bob" },
      considered_context_refs: ["entity:bob"],
      evidence_refs: ["entity:bob"]
    });
    const { calls } = stubFetch(() => okJson(ollamaBody(proposalJson)));

    const core = createExecutorTestCore(snapshot);
    const memory = new InMemoryMemoryRepository();
    void memory.prepareRevision({ parent_revision: null, records: [] });
    const root = new RuntimeCompositionRoot({
      subjectCore: core,
      producerAuthorizationIssuer: core.issuer,
      memoryRepository: memory,
      retrieval: { retrieve: async () => { throw new Error("CognitionAction never calls retrieval"); } },
      contextProducer: new ReferenceContextProducer(),
      cognitionProvider: nativeProvider()
    });
    const minter = createMiclStageMinter(core, new InMemoryMiclWorkflowStore(), {
      micl_id: "micl-native-cog" as never,
      micl_request_fingerprint: "sha256:native-cog-stage" as never,
      stage_key: "OBSERVATION"
    });
    const executor = new CognitionActionTransitionExecutor({ ...root.dependencies(), subjectCore: minter.core() });
    const result = await executor.execute(
      { subject_id: "subject-s0" as never, current_logical_time: 0 as never, state_revision: 0 as never },
      { cause_refs: [], allowed_actions: actions },
      minter.capabilities([{ repository_revision: "R0", repository_revision_hash: HASH_V1_R0_REPOSITORY }])
    );
    expect(result.outcome.kind).toBe("NO_OP");
    expect(result.cognition.action_intent).toEqual({ action_type: "TRUST_BOB", target_ref: "entity:bob" });
    expect(core.storeRead.getCommittedBundles()).toHaveLength(0); // zero canonical delta
    expect(calls).toHaveLength(1);
  });
});
