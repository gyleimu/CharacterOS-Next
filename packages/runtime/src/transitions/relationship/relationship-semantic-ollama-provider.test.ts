/**
 * Offline unit tests for the native Ollama Relationship semantic provider.
 *
 * NO real Ollama, NO network: the HTTP boundary is fully mocked via
 * `vi.stubGlobal("fetch", ...)`. The provider is verified to be a narrow wire
 * adapter only: exact frozen prompt passthrough, fixed Ollama request policy
 * (think=false, stream=false, temperature=0, num_predict=512), message.content
 * as the ONLY response authority, thinking-field ignorance, fail-closed error
 * mapping, single attempt (no retry), and no hidden Relationship policy
 * exposure. Semantic validation itself stays with the frozen runner (not
 * exercised here).
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  OllamaRelationshipSemanticChannelProviderV0,
  type OllamaRelationshipSemanticChannelProviderConfigV0
} from "./relationship-semantic-ollama-provider.js";
import { buildRelationshipSemanticChannelPromptMessages } from "./relationship-semantic-openai-provider.js";
import type { RelationshipSemanticChannelProviderInputV0 } from "./relationship-semantic-channel.js";

const BASE_URL = "http://127.0.0.1:11434";
const MODEL = "qwen3.5:9b";

function providerInput(): RelationshipSemanticChannelProviderInputV0 {
  return {
    semantic_context: { fixture: "semantic-context" },
    semantic_catalog: {
      catalog_id: "rel_catalog",
      channels: [
        {
          channel_id: "ch_test_consistent_assistance",
          criterion: "Evidence matches the synthetic adaptation test condition."
        }
      ]
    },
    semantic_context_fingerprint: "sha256:1111111111111111111111111111111111111111111111111111111111111111",
    catalog_fingerprint: "sha256:2222222222222222222222222222222222222222222222222222222222222222"
  } as unknown as RelationshipSemanticChannelProviderInputV0;
}

function config(overrides: Partial<OllamaRelationshipSemanticChannelProviderConfigV0> = {}): OllamaRelationshipSemanticChannelProviderConfigV0 {
  return { base_url: BASE_URL, model: MODEL, timeout_ms: 1_000, ...overrides };
}

function legalCandidate(): Record<string, unknown> {
  return {
    schema_version: "relationship-semantic-provider-output-v0",
    kind: "ABSTAIN",
    semantic_context_fingerprint: "sha256:1111111111111111111111111111111111111111111111111111111111111111",
    catalog_fingerprint: "sha256:2222222222222222222222222222222222222222222222222222222222222222"
  };
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
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body)
  });
}

function errorJson(status: number, body: unknown): Promise<unknown> {
  return Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve(body)
  });
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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("OllamaRelationshipSemanticChannelProviderV0 (offline, mocked HTTP)", () => {
  it("1. builds EXACT frozen Relationship prompt messages (no duplication, no mutation)", async () => {
    const { calls } = stubFetch(() => okJson(ollamaBody(JSON.stringify(legalCandidate()))));
    const input = providerInput();
    await new OllamaRelationshipSemanticChannelProviderV0(config()).propose(input);
    expect(calls).toHaveLength(1);
    const call = calls[0];
    if (call === undefined) throw new Error("expected one fetch call");
    const body = JSON.parse(String(call.init.body)) as { messages: unknown };
    expect(body.messages).toEqual(
      buildRelationshipSemanticChannelPromptMessages(input).map((m) => ({ role: m.role, content: m.content }))
    );
  });

  it("2-5. sends the fixed Ollama request policy: think=false, stream=false, temperature=0, num_predict=512", async () => {
    const { calls } = stubFetch(() => okJson(ollamaBody(JSON.stringify(legalCandidate()))));
    await new OllamaRelationshipSemanticChannelProviderV0(config()).propose(providerInput());
    const call = calls[0];
    if (call === undefined) throw new Error("expected one fetch call");
    const body = JSON.parse(String(call.init.body)) as {
      think: unknown;
      stream: unknown;
      options: { temperature: unknown; num_predict: unknown };
    };
    expect(body.think).toBe(false);
    expect(body.stream).toBe(false);
    expect(body.options).toEqual({ temperature: 0, num_predict: 512 });
  });

  it("6-7. uses the configured model and the configured base URL (/api/chat)", async () => {
    const { calls } = stubFetch(() => okJson(ollamaBody(JSON.stringify(legalCandidate()))));
    await new OllamaRelationshipSemanticChannelProviderV0(config({ base_url: "http://127.0.0.1:9999/" })).propose(
      providerInput()
    );
    const call = calls[0];
    if (call === undefined) throw new Error("expected one fetch call");
    const body = JSON.parse(String(call.init.body)) as { model: unknown };
    expect(call.url).toBe("http://127.0.0.1:9999/api/chat");
    expect(body.model).toBe(MODEL);
  });

  it("8. nonempty message.content returns the parsed provider candidate", async () => {
    stubFetch(() => okJson(ollamaBody(JSON.stringify(legalCandidate()))));
    const candidate = await new OllamaRelationshipSemanticChannelProviderV0(config()).propose(providerInput());
    expect(candidate).toEqual(legalCandidate());
  });

  it("9-10. missing and empty message.content fail closed with PROVIDER_TRANSPORT_FAILURE", async () => {
    const missing = stubFetch(() => okJson(ollamaBody(undefined)));
    await expect(
      new OllamaRelationshipSemanticChannelProviderV0(config()).propose(providerInput())
    ).rejects.toMatchObject({ code: "PROVIDER_TRANSPORT_FAILURE" });
    expect(missing.fetchMock).toHaveBeenCalledTimes(1);

    const empty = stubFetch(() => okJson(ollamaBody("")));
    await expect(
      new OllamaRelationshipSemanticChannelProviderV0(config()).propose(providerInput())
    ).rejects.toMatchObject({ code: "PROVIDER_TRANSPORT_FAILURE" });
    expect(empty.fetchMock).toHaveBeenCalledTimes(1);
  });

  it("11. malformed (non-JSON) HTTP response body fails closed", async () => {
    stubFetch(() =>
      Promise.resolve({ ok: true, status: 200, json: () => Promise.reject(new Error("invalid json")) })
    );
    await expect(
      new OllamaRelationshipSemanticChannelProviderV0(config()).propose(providerInput())
    ).rejects.toMatchObject({ code: "PROVIDER_TRANSPORT_FAILURE" });
  });

  it("12. non-2xx HTTP status fails closed", async () => {
    stubFetch(() => errorJson(500, { error: "boom" }));
    await expect(
      new OllamaRelationshipSemanticChannelProviderV0(config()).propose(providerInput())
    ).rejects.toMatchObject({ code: "PROVIDER_TRANSPORT_FAILURE" });
  });

  it("13. timeout fails closed with PROVIDER_TIMEOUT", async () => {
    const timeoutError = new Error("The operation was aborted due to timeout");
    (timeoutError as { name?: string }).name = "TimeoutError";
    stubFetch(() => Promise.reject(timeoutError));
    await expect(
      new OllamaRelationshipSemanticChannelProviderV0(config()).propose(providerInput())
    ).rejects.toMatchObject({ code: "PROVIDER_TIMEOUT" });
  });

  it("14. NO retry: exactly one fetch attempt even when it fails", async () => {
    const { fetchMock } = stubFetch(() => errorJson(500, { error: "boom" }));
    await expect(
      new OllamaRelationshipSemanticChannelProviderV0(config()).propose(providerInput())
    ).rejects.toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("15-16. thinking field is IGNORED: legal content + thinking succeeds; empty content + thinking FAILS closed", async () => {
    const withThinking = stubFetch(() => okJson(ollamaBody(JSON.stringify(legalCandidate()), "arbitrary hidden reasoning")));
    const candidate = await new OllamaRelationshipSemanticChannelProviderV0(config()).propose(providerInput());
    expect(candidate).toEqual(legalCandidate());
    expect(JSON.stringify(candidate)).not.toContain("arbitrary hidden reasoning");
    expect(withThinking.fetchMock).toHaveBeenCalledTimes(1);

    const thinkingOnly = stubFetch(() => okJson(ollamaBody("", "arbitrary hidden reasoning")));
    await expect(
      new OllamaRelationshipSemanticChannelProviderV0(config()).propose(providerInput())
    ).rejects.toMatchObject({ code: "PROVIDER_TRANSPORT_FAILURE" });
    expect(thinkingOnly.fetchMock).toHaveBeenCalledTimes(1);
  });

  it("17. no reasoning content reaches the semantic candidate (content only)", async () => {
    stubFetch(() =>
      okJson(ollamaBody(JSON.stringify({ ...legalCandidate(), extra: "must-not-exist" }), "reasoning text"))
    );
    const candidate = (await new OllamaRelationshipSemanticChannelProviderV0(config()).propose(providerInput())) as Record<
      string,
      unknown
    >;
    expect(candidate).toEqual({ ...legalCandidate(), extra: "must-not-exist" });
    expect(Object.keys(candidate)).toEqual(Object.keys(legalCandidate()).concat("extra"));
    expect(JSON.stringify(candidate)).not.toContain("reasoning text");
  });

  it("18. provider does not expose hidden Relationship policy/numeric state (closed request body)", async () => {
    const { calls } = stubFetch(() => okJson(ollamaBody(JSON.stringify(legalCandidate()))));
    await new OllamaRelationshipSemanticChannelProviderV0(config()).propose(providerInput());
    const call = calls[0];
    if (call === undefined) throw new Error("expected one fetch call");
    const body = JSON.parse(String(call.init.body)) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(["messages", "model", "options", "stream", "think"]);
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("relationship_test_dimension_v0");
    expect(serialized).not.toContain("INCREASE");
    expect(serialized).not.toContain("0.4");
    expect(serialized).not.toContain("0.05");
  });
});
