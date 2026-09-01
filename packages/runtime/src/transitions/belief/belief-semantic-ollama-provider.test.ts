/**
 * Offline tests for the native Ollama Belief Semantic Provider V0.
 *
 * NO real Ollama, NO network: the HTTP boundary is fully mocked via
 * `vi.stubGlobal("fetch", ...)`. Covers the exact Ollama request envelope
 * (one call, /api/chat, stream/think false, temperature 0, num_predict 512,
 * configured model), deterministic prompt surface (evidence + catalog +
 * fingerprints visible; credence and cross-domain state NEVER visible),
 * frozen-runner integration for all three lawful decisions plus fail-closed
 * runner rejections (invented id, fingerprint mismatch, extra numeric
 * fields), message.content-only authority (thinking ignored; empty content
 * fails), fail-closed transport mapping with zero retry/repair/fallback,
 * input immutability, prompt determinism, and zero capability minting by the
 * provider. Final semantic validation authority stays with the frozen
 * runBeliefSemanticTargetResolutionV0 runner.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  InMemoryMemoryRepository,
  EPISODIC_MEMORY_RECORD_SCHEMA_VERSION,
  SALIENCE_SOURCE_ENCODING_DECLARED,
  type EpisodicMemoryRecordV0
} from "@characteros-next/memory";
import type { SubjectStateV0, UnitIntervalV0 } from "@characteros-next/subject-core";
import { s0 } from "../observation/observation-fixtures.js";
import {
  BELIEF_SEMANTIC_PROVIDER_OUTPUT_SCHEMA_VERSION,
  isAuthorizedBeliefSemanticTargetResolutionV0,
  runBeliefSemanticTargetResolutionV0,
  type BeliefSemanticTargetResolutionProviderInputV0,
  type BeliefSemanticTargetResolutionProviderV0
} from "./belief-semantic-target-resolution.js";
import {
  BeliefSemanticOllamaProviderErrorV0,
  OLLAMA_BELIEF_SEMANTIC_PROVIDER_NUM_PREDICT,
  OllamaBeliefSemanticProviderV0,
  buildBeliefSemanticOllamaPromptMessages,
  type OllamaBeliefSemanticProviderConfigV0
} from "./belief-semantic-ollama-provider.js";

const BASE_URL = "http://127.0.0.1:11434";
const MODEL = "qwen3.5:9b";
const ALICE = "entity:alice";
const EP_A = "episode:e-0001";
const PROPOSITION_ID_A = "belief-aaa";
const PROPOSITION_ID_B = "belief-bbb";
const PROPOSITION_LABEL_A = "Alice can be relied on for joint plans";
const PROPOSITION_LABEL_B = "Bob prefers written summaries";
/** Distinctive canonical credence fixture used to prove prompt leakage absence. */
const DISTINCTIVE_CREDENCE = 0.7319;

function unit(value: number): UnitIntervalV0 {
  if (!(value >= 0 && value <= 1)) throw new Error("fixture unit out of range");
  return value as UnitIntervalV0;
}

function identifier(raw: string): never {
  return raw as never;
}

function recordFixture(episodeRef: string, scene: string, occurrenceLogicalTime: number): EpisodicMemoryRecordV0 {
  return {
    schema_version: EPISODIC_MEMORY_RECORD_SCHEMA_VERSION,
    episode_ref: episodeRef as EpisodicMemoryRecordV0["episode_ref"],
    occurrence_logical_time: occurrenceLogicalTime as EpisodicMemoryRecordV0["occurrence_logical_time"],
    recorded_at_logical_time: (occurrenceLogicalTime + 1) as EpisodicMemoryRecordV0["recorded_at_logical_time"],
    provenance: {
      transition_id: identifier(`learning_${episodeRef.replace(/[^a-z0-9]/gi, "_")}`) as never,
      producer: "memory",
      cause_refs: []
    },
    references: [ALICE] as unknown as EpisodicMemoryRecordV0["references"],
    context: { scene, focus_refs: [], environment_refs: [] },
    appraisal_ref: null,
    affect_snapshot_ref: null,
    salience: { declared_score: unit(0.8), source: SALIENCE_SOURCE_ENCODING_DECLARED }
  };
}

/** TEST-LOCAL canonical snapshot with registered propositions + bound revision. */
async function fixtureWorld(): Promise<{
  repository: InMemoryMemoryRepository;
  records: EpisodicMemoryRecordV0[];
  state: SubjectStateV0;
}> {
  const repository = new InMemoryMemoryRepository();
  await repository.prepareRevision({ parent_revision: null, records: [] as never });
  const records = [recordFixture(EP_A, "Alice promised to arrive early, then deliberately broke the promise.", 3)];
  const hashes = [];
  for (const record of records) {
    hashes.push({ ref: record.episode_ref, payload_hash: await repository.storePayload(record.episode_ref, record) });
  }
  const prepared = await repository.prepareRevision({
    parent_revision: "R0" as never,
    records: hashes as never
  });
  const base = s0() as unknown as SubjectStateV0;
  const state: unknown = {
    ...base,
    memory_state: { ...base.memory_state, repository_revision: prepared.repository_revision },
    beliefs: {
      schema_version: "belief-state-v0",
      items: [
        { proposition_id: PROPOSITION_ID_A, proposition_label: PROPOSITION_LABEL_A, credence: DISTINCTIVE_CREDENCE },
        { proposition_id: PROPOSITION_ID_B, proposition_label: PROPOSITION_LABEL_B, credence: 0.2 }
      ]
    },
    runtime_metadata: { ...base.runtime_metadata, logical_time: 10, state_revision: 4 }
  };
  return { repository, records, state: state as SubjectStateV0 };
}

function config(overrides: Partial<OllamaBeliefSemanticProviderConfigV0> = {}): OllamaBeliefSemanticProviderConfigV0 {
  return { base_url: BASE_URL, model: MODEL, timeout_ms: 1_000, ...overrides };
}

type FetchCall = { url: string; init: RequestInit };

function stubFetch(handler: (url: string, init: RequestInit) => Promise<unknown>): {
  fetchMock: ReturnType<typeof vi.fn>;
  calls: FetchCall[];
} {
  const calls: FetchCall[] = [];
  const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
    const call = { url: String(url), init: (init ?? {}) as RequestInit };
    calls.push(call);
    return handler(call.url, call.init);
  });
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, calls };
}

function okJson(body: unknown): Promise<unknown> {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
}

function errorJson(status: number): Promise<unknown> {
  return Promise.resolve({ ok: false, status, json: () => Promise.resolve({}) });
}

function ollamaBody(content: string | undefined, thinking?: string): unknown {
  return {
    message: {
      ...(content !== undefined ? { content } : {}),
      ...(thinking !== undefined ? { thinking } : {})
    },
    done_reason: "stop",
    prompt_eval_count: 786,
    eval_count: 164
  };
}

function requestBody(calls: FetchCall[], index = 0): { model: string; messages: { role: string; content: string }[] } & Record<string, unknown> {
  const call = calls[index];
  if (call === undefined) throw new Error("expected a fetch call");
  return JSON.parse(String(call.init.body)) as { model: string; messages: { role: string; content: string }[] } & Record<string, unknown>;
}

function promptText(calls: FetchCall[], index = 0): string {
  return requestBody(calls, index).messages.map((m) => m.content).join("\n");
}

/** Spy wrapper capturing the exact frozen provider input. */
function capturing(
  inner: BeliefSemanticTargetResolutionProviderV0,
  captured: { input: BeliefSemanticTargetResolutionProviderInputV0 | null } = { input: null }
): { provider: BeliefSemanticTargetResolutionProviderV0; captured: typeof captured } {
  return {
    captured,
    provider: {
      async propose(input) {
        captured.input = input;
        return inner.propose(input);
      }
    }
  };
}

/** No-op capturing provider used to learn the runner-computed fingerprints. */
const noopCapture = () =>
  capturing({
    async propose(input) {
      return {
        schema_version: BELIEF_SEMANTIC_PROVIDER_OUTPUT_SCHEMA_VERSION,
        kind: "NO_BEARING",
        semantic_context_fingerprint: input.semantic_context_fingerprint,
        candidate_catalog_fingerprint: input.candidate_catalog_fingerprint
      };
    }
  });

async function runnerInput(
  world: Awaited<ReturnType<typeof fixtureWorld>>,
  provider: BeliefSemanticTargetResolutionProviderV0,
  propositionIds: readonly string[] = [PROPOSITION_ID_A, PROPOSITION_ID_B]
): Promise<Parameters<typeof runBeliefSemanticTargetResolutionV0>[1]> {
  return {
    subjectState: world.state,
    proposition_ids: propositionIds as never,
    selected_episodes: world.records,
    provider
  };
}

function legalOutput(
  input: BeliefSemanticTargetResolutionProviderInputV0,
  extra: Record<string, unknown>
): Record<string, unknown> {
  return {
    schema_version: BELIEF_SEMANTIC_PROVIDER_OUTPUT_SCHEMA_VERSION,
    semantic_context_fingerprint: input.semantic_context_fingerprint,
    candidate_catalog_fingerprint: input.candidate_catalog_fingerprint,
    ...extra
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("OllamaBeliefSemanticProviderV0 — Ollama request envelope (offline, mocked HTTP)", () => {
  it("sends exactly ONE POST to {base}/api/chat with the fixed request policy", async () => {
    const world = await fixtureWorld();
    const { calls } = stubFetch(() => okJson(ollamaBody(JSON.stringify({ kind: "NO_BEARING" }))));
    const provider = new OllamaBeliefSemanticProviderV0(config());
    const probe = noopCapture();
    await runBeliefSemanticTargetResolutionV0({ memoryRepository: world.repository }, await runnerInput(world, probe.provider));
    const frozenInput = probe.captured.input;
    expect(frozenInput).not.toBeNull();
    if (frozenInput === null) throw new Error("unreachable");

    await provider.propose(frozenInput);
    expect(calls).toHaveLength(1);
    const call = calls[0];
    if (call === undefined) throw new Error("expected one fetch call");
    expect(call.url).toBe(`${BASE_URL}/api/chat`);
    expect(call.init.method).toBe("POST");
    const body = requestBody(calls);
    expect(body.model).toBe(MODEL);
    expect(body["stream"]).toBe(false);
    expect(body["think"]).toBe(false);
    expect(body["options"]).toEqual({ temperature: 0, num_predict: OLLAMA_BELIEF_SEMANTIC_PROVIDER_NUM_PREDICT });
    expect(OLLAMA_BELIEF_SEMANTIC_PROVIDER_NUM_PREDICT).toBe(512);
    expect(Array.isArray(body.messages)).toBe(true);
  });

  it("normalizes the base URL without duplicating the /api/chat path", async () => {
    const world = await fixtureWorld();
    const { calls } = stubFetch(() => okJson(ollamaBody(JSON.stringify({ kind: "NO_BEARING" }))));
    const probe = noopCapture();
    await runBeliefSemanticTargetResolutionV0({ memoryRepository: world.repository }, await runnerInput(world, probe.provider));
    const frozenInput = probe.captured.input;
    if (frozenInput === null) throw new Error("unreachable");
    await new OllamaBeliefSemanticProviderV0(config({ base_url: `${BASE_URL}/` })).propose(frozenInput);
    expect(calls[0]?.url).toBe(`${BASE_URL}/api/chat`);
  });
});

describe("OllamaBeliefSemanticProviderV0 — deterministic prompt surface", () => {
  it("exposes evidence + catalog + fingerprints and NOTHING numeric or cross-domain", async () => {
    const world = await fixtureWorld();
    const { calls } = stubFetch(() => okJson(ollamaBody(JSON.stringify({ kind: "NO_BEARING" }))));
    const probe = noopCapture();
    await runBeliefSemanticTargetResolutionV0({ memoryRepository: world.repository }, await runnerInput(world, probe.provider));
    const frozenInput = probe.captured.input;
    if (frozenInput === null) throw new Error("unreachable");

    await new OllamaBeliefSemanticProviderV0(config()).propose(frozenInput);
    const prompt = promptText(calls);
    // Provider-visible evidence projection.
    expect(prompt).toContain(EP_A);
    expect(prompt).toContain("Alice promised to arrive early, then deliberately broke the promise.");
    expect(prompt).toContain("occurrence_logical_time: 3");
    // CharacterOS-built bounded catalog (ids + labels, NO credence).
    expect(prompt).toContain(PROPOSITION_ID_A);
    expect(prompt).toContain(PROPOSITION_ID_B);
    expect(prompt).toContain(PROPOSITION_LABEL_A);
    expect(prompt).toContain(PROPOSITION_LABEL_B);
    // Exact fingerprints to echo.
    expect(prompt).toContain(frozenInput.semantic_context_fingerprint);
    expect(prompt).toContain(frozenInput.candidate_catalog_fingerprint);
    // No canonical credence leakage (distinctive fixture value absent).
    expect(prompt).not.toContain("0.7319");
    expect(prompt).not.toContain("0.2");
    // No cross-domain state, no numeric/confidence requests.
    expect(prompt).not.toContain("personality");
    expect(prompt).not.toContain("relationship");
    expect(prompt).not.toContain("affect");
    expect(prompt).not.toContain("mood");
    expect(prompt).not.toContain("regulation");
    expect(prompt).not.toContain("cognition");
    // No model confidence request and no numeric mutation request.
    expect(prompt).not.toContain("return confidence");
    expect(prompt).not.toContain("confidence:");
    expect(prompt).not.toContain('"confidence"');
    expect(prompt).not.toContain('next_credence":');
  });

  it("is byte-deterministic for the same frozen request (two independent transports)", async () => {
    const world = await fixtureWorld();
    const first = stubFetch(() => okJson(ollamaBody(JSON.stringify({ kind: "NO_BEARING" }))));
    const probe = noopCapture();
    await runBeliefSemanticTargetResolutionV0({ memoryRepository: world.repository }, await runnerInput(world, probe.provider));
    const frozenInput = probe.captured.input;
    if (frozenInput === null) throw new Error("unreachable");

    await new OllamaBeliefSemanticProviderV0(config()).propose(frozenInput);
    const second = stubFetch(() => okJson(ollamaBody(JSON.stringify({ kind: "NO_BEARING" }))));
    await new OllamaBeliefSemanticProviderV0(config()).propose(frozenInput);
    expect(String(second.calls[0]?.init.body)).toBe(String(first.calls[0]?.init.body));
  });

  it("handles an empty catalog: EXISTING_PROPOSITION becomes impossible in the prompt", async () => {
    const world = await fixtureWorld();
    const { calls } = stubFetch(() => okJson(ollamaBody(JSON.stringify({ kind: "NO_BEARING" }))));
    const probe = noopCapture();
    await runBeliefSemanticTargetResolutionV0({ memoryRepository: world.repository }, await runnerInput(world, probe.provider, []));
    const frozenInput = probe.captured.input;
    if (frozenInput === null) throw new Error("unreachable");
    expect(frozenInput.catalog.propositions).toHaveLength(0);

    await new OllamaBeliefSemanticProviderV0(config()).propose(frozenInput);
    const prompt = promptText(calls);
    expect(prompt).toContain("EMPTY");
    expect(prompt).toContain("EXISTING_PROPOSITION is impossible");
  });
});

describe("OllamaBeliefSemanticProviderV0 — frozen runner integration (all lawful decisions)", () => {
  it("EXISTING_PROPOSITION + CONTRADICTS parsed by provider, ACCEPTED by the frozen runner", async () => {
    const world = await fixtureWorld();
    const probe = noopCapture();
    await runBeliefSemanticTargetResolutionV0({ memoryRepository: world.repository }, await runnerInput(world, probe.provider));
    const frozenInput = probe.captured.input;
    if (frozenInput === null) throw new Error("unreachable");
    const output = legalOutput(frozenInput, {
      kind: "EXISTING_PROPOSITION",
      proposition_id: PROPOSITION_ID_A,
      relation: "CONTRADICTS"
    });
    stubFetch(() => okJson(ollamaBody(JSON.stringify(output))));

    const provider = new OllamaBeliefSemanticProviderV0(config());
    const parsed = await provider.propose(frozenInput);
    expect(parsed).toEqual(output);
    const result = await runBeliefSemanticTargetResolutionV0(
      { memoryRepository: world.repository },
      await runnerInput(world, provider)
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.resolution.decision).toEqual({
      kind: "EXISTING_PROPOSITION",
      proposition_id: PROPOSITION_ID_A,
      relation: "CONTRADICTS"
    });
    expect(result.providerCalls).toBe(1);
  });

  it("EXISTING_PROPOSITION + SUPPORTS accepted; NO numeric field anywhere", async () => {
    const world = await fixtureWorld();
    const probe = noopCapture();
    await runBeliefSemanticTargetResolutionV0({ memoryRepository: world.repository }, await runnerInput(world, probe.provider));
    const frozenInput = probe.captured.input;
    if (frozenInput === null) throw new Error("unreachable");
    const output = legalOutput(frozenInput, {
      kind: "EXISTING_PROPOSITION",
      proposition_id: PROPOSITION_ID_B,
      relation: "SUPPORTS"
    });
    stubFetch(() => okJson(ollamaBody(JSON.stringify(output))));
    const provider = new OllamaBeliefSemanticProviderV0(config());
    const result = await runBeliefSemanticTargetResolutionV0(
      { memoryRepository: world.repository },
      await runnerInput(world, provider)
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.resolution.decision).toEqual({
      kind: "EXISTING_PROPOSITION",
      proposition_id: PROPOSITION_ID_B,
      relation: "SUPPORTS"
    });
    expect(JSON.stringify(result.resolution)).not.toContain("credence");
  });

  it("NO_BEARING accepted as a lawful model decision (not a fallback)", async () => {
    const world = await fixtureWorld();
    const probe = noopCapture();
    await runBeliefSemanticTargetResolutionV0({ memoryRepository: world.repository }, await runnerInput(world, probe.provider));
    const frozenInput = probe.captured.input;
    if (frozenInput === null) throw new Error("unreachable");
    stubFetch(() => okJson(ollamaBody(JSON.stringify(legalOutput(frozenInput, { kind: "NO_BEARING" })))));
    const provider = new OllamaBeliefSemanticProviderV0(config());
    const result = await runBeliefSemanticTargetResolutionV0(
      { memoryRepository: world.repository },
      await runnerInput(world, provider)
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.resolution.decision).toEqual({ kind: "NO_BEARING" });
  });

  it("NEW_PROPOSITION_CANDIDATE accepted with label-only authority", async () => {
    const world = await fixtureWorld();
    const probe = noopCapture();
    await runBeliefSemanticTargetResolutionV0({ memoryRepository: world.repository }, await runnerInput(world, probe.provider));
    const frozenInput = probe.captured.input;
    if (frozenInput === null) throw new Error("unreachable");
    const output = legalOutput(frozenInput, {
      kind: "NEW_PROPOSITION_CANDIDATE",
      proposed_label: "Alice tends to break explicit promises"
    });
    stubFetch(() => okJson(ollamaBody(JSON.stringify(output))));
    const provider = new OllamaBeliefSemanticProviderV0(config());
    const result = await runBeliefSemanticTargetResolutionV0(
      { memoryRepository: world.repository },
      await runnerInput(world, provider)
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.resolution.decision).toEqual({
      kind: "NEW_PROPOSITION_CANDIDATE",
      proposed_label: "Alice tends to break explicit promises"
    });
    // Label-only: no identity/numeric authority smuggled through.
    expect(JSON.stringify(result.resolution)).not.toContain("proposition_key");
    expect(JSON.stringify(result.resolution)).not.toContain("initial_credence");
  });

  it("empty catalog + lawful NO_BEARING accepted; invented EXISTING target rejected by the frozen runner", async () => {
    const world = await fixtureWorld();
    const probe = noopCapture();
    await runBeliefSemanticTargetResolutionV0({ memoryRepository: world.repository }, await runnerInput(world, probe.provider, []));
    const frozenInput = probe.captured.input;
    if (frozenInput === null) throw new Error("unreachable");

    stubFetch(() => okJson(ollamaBody(JSON.stringify(legalOutput(frozenInput, { kind: "NO_BEARING" })))));
    const okProvider = new OllamaBeliefSemanticProviderV0(config());
    const accepted = await runBeliefSemanticTargetResolutionV0(
      { memoryRepository: world.repository },
      await runnerInput(world, okProvider, [])
    );
    expect(accepted.ok).toBe(true);

    stubFetch(() =>
      okJson(ollamaBody(JSON.stringify(legalOutput(frozenInput, { kind: "EXISTING_PROPOSITION", proposition_id: "belief-ghost", relation: "SUPPORTS" }))))
    );
    const inventedProvider = new OllamaBeliefSemanticProviderV0(config());
    const rejected = await runBeliefSemanticTargetResolutionV0(
      { memoryRepository: world.repository },
      await runnerInput(world, inventedProvider, [])
    );
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) {
      expect(rejected.code).toBe("INVENTED_PROPOSITION_ID");
    }
  });
});

describe("OllamaBeliefSemanticProviderV0 — frozen runner fail-closed authority", () => {
  async function rejectionWorld(content: string): Promise<{ code: string }> {
    const world = await fixtureWorld();
    const probe = noopCapture();
    await runBeliefSemanticTargetResolutionV0({ memoryRepository: world.repository }, await runnerInput(world, probe.provider));
    const frozenInput = probe.captured.input;
    if (frozenInput === null) throw new Error("unreachable");
    stubFetch(() => okJson(ollamaBody(content)));
    const provider = new OllamaBeliefSemanticProviderV0(config());
    // Provider parses fine; semantic authority rejects.
    const parsed = await provider.propose(frozenInput);
    expect(parsed).toBeTruthy();
    const result = await runBeliefSemanticTargetResolutionV0(
      { memoryRepository: world.repository },
      await runnerInput(world, new OllamaBeliefSemanticProviderV0(config()))
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    return { code: result.code };
  }

  it("rejects an invented proposition_id outside the supplied catalog", async () => {
    const world = await fixtureWorld();
    const probe = noopCapture();
    await runBeliefSemanticTargetResolutionV0({ memoryRepository: world.repository }, await runnerInput(world, probe.provider));
    const frozenInput = probe.captured.input;
    if (frozenInput === null) throw new Error("unreachable");
    const { code } = await rejectionWorld(
      JSON.stringify(legalOutput(frozenInput, { kind: "EXISTING_PROPOSITION", proposition_id: "belief-ghost", relation: "CONTRADICTS" }))
    );
    expect(code).toBe("INVENTED_PROPOSITION_ID");
  });

  it("rejects a mismatched semantic_context_fingerprint without repair", async () => {
    const world = await fixtureWorld();
    const probe = noopCapture();
    await runBeliefSemanticTargetResolutionV0({ memoryRepository: world.repository }, await runnerInput(world, probe.provider));
    const frozenInput = probe.captured.input;
    if (frozenInput === null) throw new Error("unreachable");
    const tampered = legalOutput(frozenInput, { kind: "NO_BEARING" });
    tampered["semantic_context_fingerprint"] = "sha256:" + "9".repeat(64);
    const { code } = await rejectionWorld(JSON.stringify(tampered));
    expect(code).toBe("STALE_SEMANTIC_CONTEXT");
  });

  it("rejects a mismatched candidate_catalog_fingerprint without repair", async () => {
    const world = await fixtureWorld();
    const probe = noopCapture();
    await runBeliefSemanticTargetResolutionV0({ memoryRepository: world.repository }, await runnerInput(world, probe.provider));
    const frozenInput = probe.captured.input;
    if (frozenInput === null) throw new Error("unreachable");
    const tampered = legalOutput(frozenInput, { kind: "NO_BEARING" });
    tampered["candidate_catalog_fingerprint"] = "sha256:" + "8".repeat(64);
    const { code } = await rejectionWorld(JSON.stringify(tampered));
    expect(code).toBe("STALE_CANDIDATE_CATALOG");
  });

  it("rejects smuggled numeric/identity fields via the closed output schema", async () => {
    const world = await fixtureWorld();
    const probe = noopCapture();
    await runBeliefSemanticTargetResolutionV0({ memoryRepository: world.repository }, await runnerInput(world, probe.provider));
    const frozenInput = probe.captured.input;
    if (frozenInput === null) throw new Error("unreachable");
    const { code } = await rejectionWorld(
      JSON.stringify(
        legalOutput(frozenInput, {
          kind: "EXISTING_PROPOSITION",
          proposition_id: PROPOSITION_ID_A,
          relation: "CONTRADICTS",
          credence: 0.5,
          next_credence: 0.45,
          delta: -0.05,
          confidence: 0.9,
          weight: 1,
          proposition_key: "smuggled"
        })
      )
    );
    expect(code).toBe("INVALID_PROVIDER_OUTPUT");
  });
});

describe("OllamaBeliefSemanticProviderV0 — response authority and fail-closed mapping", () => {
  async function frozenInputFor(): Promise<{
    world: Awaited<ReturnType<typeof fixtureWorld>>;
    frozenInput: BeliefSemanticTargetResolutionProviderInputV0;
  }> {
    const world = await fixtureWorld();
    const probe = noopCapture();
    await runBeliefSemanticTargetResolutionV0({ memoryRepository: world.repository }, await runnerInput(world, probe.provider));
    const frozenInput = probe.captured.input;
    if (frozenInput === null) throw new Error("unreachable");
    return { world, frozenInput };
  }

  it("uses ONLY message.content; thinking is ignored and never leaks", async () => {
    const { frozenInput } = await frozenInputFor();
    const output = legalOutput(frozenInput, { kind: "NO_BEARING" });
    stubFetch(() => okJson(ollamaBody(JSON.stringify(output), "SECRET_HIDDEN_REASONING_TEXT")));
    const provider = new OllamaBeliefSemanticProviderV0(config());
    const result = await provider.propose(frozenInput);
    expect(result).toEqual(output);
    expect(JSON.stringify(result)).not.toContain("SECRET_HIDDEN_REASONING_TEXT");
  });

  it("fails closed when content is empty even if thinking is nonempty (no fallback)", async () => {
    const { frozenInput } = await frozenInputFor();
    const { calls } = stubFetch(() => okJson(ollamaBody("", "SECRET_HIDDEN_REASONING_TEXT")));
    const provider = new OllamaBeliefSemanticProviderV0(config());
    await expect(provider.propose(frozenInput)).rejects.toMatchObject({
      code: "PROVIDER_EMPTY_CONTENT"
    });
    expect(calls).toHaveLength(1);
  });

  it("fails closed on whitespace-only content", async () => {
    const { frozenInput } = await frozenInputFor();
    stubFetch(() => okJson(ollamaBody("   \n\t  ")));
    await expect(new OllamaBeliefSemanticProviderV0(config()).propose(frozenInput)).rejects.toMatchObject({
      code: "PROVIDER_EMPTY_CONTENT"
    });
  });

  it("fails closed on non-object JSON content", async () => {
    const { frozenInput } = await frozenInputFor();
    stubFetch(() => okJson(ollamaBody("[1,2,3]")));
    await expect(new OllamaBeliefSemanticProviderV0(config()).propose(frozenInput)).rejects.toMatchObject({
      code: "PROVIDER_MALFORMED_JSON"
    });
  });

  it("fails closed on non-JSON content with NO repair (prose / markdown fence / prefixed JSON)", async () => {
    const { frozenInput } = await frozenInputFor();
    const cases = [
      "Here is the JSON: {\"kind\":\"NO_BEARING\"}",
      "```json\n{\"kind\":\"NO_BEARING\"}\n```",
      "I think the evidence is inconclusive."
    ];
    for (const content of cases) {
      const { calls } = stubFetch(() => okJson(ollamaBody(content)));
      await expect(new OllamaBeliefSemanticProviderV0(config()).propose(frozenInput)).rejects.toBeInstanceOf(
        BeliefSemanticOllamaProviderErrorV0
      );
      expect(calls).toHaveLength(1); // one attempt, zero repair calls
    }
  });

  it("maps transport failures fail-closed with exactly one HTTP call and no retry", async () => {
    const { frozenInput } = await frozenInputFor();
    const provider = () => new OllamaBeliefSemanticProviderV0(config());

    // fetch throws → PROVIDER_TRANSPORT_FAILURE
    let harness = stubFetch(() => Promise.reject(new Error("ECONNREFUSED")));
    await expect(provider().propose(frozenInput)).rejects.toMatchObject({ code: "PROVIDER_TRANSPORT_FAILURE" });
    expect(harness.calls).toHaveLength(1);

    // non-2xx → PROVIDER_HTTP_FAILURE
    harness = stubFetch(() => errorJson(500));
    await expect(provider().propose(frozenInput)).rejects.toMatchObject({ code: "PROVIDER_HTTP_FAILURE" });
    expect(harness.calls).toHaveLength(1);

    // TimeoutError → PROVIDER_TIMEOUT
    harness = stubFetch(() => {
      const timeoutError = new Error("aborted");
      timeoutError.name = "TimeoutError";
      return Promise.reject(timeoutError);
    });
    await expect(provider().propose(frozenInput)).rejects.toMatchObject({ code: "PROVIDER_TIMEOUT" });
    expect(harness.calls).toHaveLength(1);

    // malformed envelope (no message) → PROVIDER_INVALID_ENVELOPE
    harness = stubFetch(() => okJson({ done_reason: "stop" }));
    await expect(provider().propose(frozenInput)).rejects.toMatchObject({ code: "PROVIDER_INVALID_ENVELOPE" });
    expect(harness.calls).toHaveLength(1);

    // non-JSON body → PROVIDER_INVALID_ENVELOPE
    harness = stubFetch(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.reject(new Error("bad json"))
      })
    );
    await expect(provider().propose(frozenInput)).rejects.toMatchObject({ code: "PROVIDER_INVALID_ENVELOPE" });
    expect(harness.calls).toHaveLength(1);
  });

  it("rejects invalid config at construction (fail closed, no ambient defaults)", async () => {
    expect(() => new OllamaBeliefSemanticProviderV0({ base_url: "", model: MODEL })).toThrow(
      BeliefSemanticOllamaProviderErrorV0
    );
    expect(() => new OllamaBeliefSemanticProviderV0({ base_url: BASE_URL, model: "" })).toThrow(
      BeliefSemanticOllamaProviderErrorV0
    );
    expect(() => new OllamaBeliefSemanticProviderV0({ base_url: BASE_URL, model: MODEL, timeout_ms: -1 })).toThrow(
      BeliefSemanticOllamaProviderErrorV0
    );
  });
});

describe("OllamaBeliefSemanticProviderV0 — purity and authority boundaries", () => {
  it("never mutates the frozen provider input (success or failure)", async () => {
    const world = await fixtureWorld();
    const probe = noopCapture();
    await runBeliefSemanticTargetResolutionV0({ memoryRepository: world.repository }, await runnerInput(world, probe.provider));
    const frozenInput = probe.captured.input;
    if (frozenInput === null) throw new Error("unreachable");
    const before = JSON.stringify(frozenInput);

    stubFetch(() => okJson(ollamaBody(JSON.stringify(legalOutput(frozenInput, { kind: "NO_BEARING" })))));
    await new OllamaBeliefSemanticProviderV0(config()).propose(frozenInput);
    expect(JSON.stringify(frozenInput)).toBe(before);

    stubFetch(() => Promise.reject(new Error("ECONNREFUSED")));
    await expect(new OllamaBeliefSemanticProviderV0(config()).propose(frozenInput)).rejects.toBeInstanceOf(
      BeliefSemanticOllamaProviderErrorV0
    );
    expect(JSON.stringify(frozenInput)).toBe(before);
  });

  it("mints NO semantic capability: parsed output is not authorized until the frozen runner accepts it", async () => {
    const world = await fixtureWorld();
    const probe = noopCapture();
    await runBeliefSemanticTargetResolutionV0({ memoryRepository: world.repository }, await runnerInput(world, probe.provider));
    const frozenInput = probe.captured.input;
    if (frozenInput === null) throw new Error("unreachable");
    stubFetch(() => okJson(ollamaBody(JSON.stringify(legalOutput(frozenInput, { kind: "NO_BEARING" })))));
    const provider = new OllamaBeliefSemanticProviderV0(config());
    const parsed = await provider.propose(frozenInput);
    // Provider output is untrusted data, never a minted resolution capability.
    expect(isAuthorizedBeliefSemanticTargetResolutionV0(parsed)).toBe(false);
  });

  it("prompt builder is a pure deterministic function of the frozen input", async () => {
    const world = await fixtureWorld();
    const probe = noopCapture();
    await runBeliefSemanticTargetResolutionV0({ memoryRepository: world.repository }, await runnerInput(world, probe.provider));
    const frozenInput = probe.captured.input;
    if (frozenInput === null) throw new Error("unreachable");
    const first = buildBeliefSemanticOllamaPromptMessages(frozenInput);
    const second = buildBeliefSemanticOllamaPromptMessages(frozenInput);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    expect(first.map((m) => m.role)).toEqual(["system", "user"]);
  });
});
