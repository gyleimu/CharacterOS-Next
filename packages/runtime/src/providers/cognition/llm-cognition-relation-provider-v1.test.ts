/**
 * Belief Decision Influence Relation Foundation V0 — LlmCognitionRelationProviderV1
 * acceptance suite (§17, §86): at most ONE transport call per invocation,
 * direct JSON.parse with NO Markdown stripping / repair / retry, stable
 * MODEL_MALFORMED_JSON on unparseable content, untouched propagation of
 * transport failures, and deep-frozen provider input.
 *
 * Fully OFFLINE by default: a fake transport fixture exercises raw content →
 * parse. No network, no local model, no API key (REAL_MODEL_CALLS_IMPLEMENTATION=ZERO).
 */

import { describe, expect, it } from "vitest";

import type { SubjectStateV0 } from "@characteros-next/subject-core";
import { s0 } from "../../transitions/observation/observation-fixtures.js";
import { buildCognitiveContextProjection } from "../../transitions/cognition-action/cognition-action-transition-executor.js";
import {
  CognitionRelationRejectionErrorV1,
  deriveCognitionActionSpaceFingerprintV1,
  validateAllowedActionSpaceV1
} from "../../transitions/cognition-action/cognition-proposal-v1.js";
import { buildCognitionRelationProviderInputV1 } from "../../transitions/cognition-action/belief-decision-influence-relation.js";
import type { CognitionRelationProviderInputV1 } from "../../ports/cognition-relation-port.js";
import {
  ModelTransportErrorV0,
  type ModelTransportRequestV0,
  type ModelTransportResponseV0,
  type ModelTransportV0
} from "../../transports/model-transport.js";
import {
  COGNITION_V1_MAX_MODEL_CALLS_PER_INVOCATION,
  LlmCognitionRelationProviderV1
} from "./llm-cognition-relation-provider-v1.js";

/** Fake transport: repeatable, offline, single-attempt observability. */
class FakeRelationTransport implements ModelTransportV0 {
  calls = 0;
  lastRequest: ModelTransportRequestV0 | null = null;
  constructor(
    private readonly responder: (request: ModelTransportRequestV0) => { content: string } | Promise<never>
  ) {}
  async complete(request: ModelTransportRequestV0): Promise<ModelTransportResponseV0> {
    this.calls += 1;
    this.lastRequest = request;
    const outcome = await this.responder(request);
    return { content: outcome.content, model: "fake-relation-model" };
  }
}

const BELIEFS = [
  { proposition_id: "prop.bob-trustworthy", proposition_label: "Bob is trustworthy", credence: 0.9 }
];

async function buildInput(): Promise<CognitionRelationProviderInputV1> {
  const base = s0() as unknown as SubjectStateV0;
  const snapshot = {
    ...base,
    beliefs: { schema_version: "belief-state-v0", items: BELIEFS },
    memory_state: {
      ...(base.memory_state as unknown as Record<string, unknown>),
      working_refs: ["episode:e1"]
    }
  } as unknown as SubjectStateV0;
  const projection = await buildCognitiveContextProjection(snapshot);
  const space = validateAllowedActionSpaceV1([{ action_type: "TRY_EAST_ENTRANCE", target_ref: null }]);
  if (!space.ok) throw new Error(`fixture action space invalid: ${space.error.detail}`);
  const fingerprint = await deriveCognitionActionSpaceFingerprintV1(space.value);
  return buildCognitionRelationProviderInputV1(projection, space.value, fingerprint);
}

describe("Relation Foundation V0 — LlmCognitionRelationProviderV1 (offline fake transport)", () => {
  it("valid JSON content parses through direct JSON.parse with exactly ONE transport call", async () => {
    expect(COGNITION_V1_MAX_MODEL_CALLS_PER_INVOCATION).toBe(1);
    const input = await buildInput();
    const transport = new FakeRelationTransport(() => ({
      content: JSON.stringify({ schema_version: "cognition-proposal-v1", state_action_relations: [] })
    }));
    const provider = new LlmCognitionRelationProviderV1({ transport });
    const parsed = await provider.propose(input);
    expect(transport.calls).toBe(1);
    expect(transport.lastRequest).not.toBeNull();
    expect(transport.lastRequest?.messages).toHaveLength(2);
    expect(transport.lastRequest?.messages.map((m) => m.role)).toEqual(["system", "user"]);
    expect(parsed).toEqual({ schema_version: "cognition-proposal-v1", state_action_relations: [] });
  });

  it("malformed content yields stable MODEL_MALFORMED_JSON with no retry (still exactly one call)", async () => {
    const input = await buildInput();
    const transport = new FakeRelationTransport(() => ({ content: "{ not valid json ..." }));
    const provider = new LlmCognitionRelationProviderV1({ transport });
    const error = await provider.propose(input).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CognitionRelationRejectionErrorV1);
    expect((error as CognitionRelationRejectionErrorV1).code).toBe("MODEL_MALFORMED_JSON");
    expect(transport.calls).toBe(1);
  });

  it("performs NO Markdown fence stripping: fenced valid JSON is still MODEL_MALFORMED_JSON", async () => {
    const input = await buildInput();
    const inner = JSON.stringify({ schema_version: "cognition-proposal-v1" });
    const transport = new FakeRelationTransport(() => ({ content: "```json\n" + inner + "\n```" }));
    const provider = new LlmCognitionRelationProviderV1({ transport });
    const error = await provider.propose(input).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CognitionRelationRejectionErrorV1);
    expect((error as CognitionRelationRejectionErrorV1).code).toBe("MODEL_MALFORMED_JSON");
    expect(transport.calls).toBe(1);
  });

  it("performs NO JSON repair: trailing comma content is still MODEL_MALFORMED_JSON", async () => {
    const input = await buildInput();
    const transport = new FakeRelationTransport(() => ({
      content: '{"schema_version":"cognition-proposal-v1",}'
    }));
    const provider = new LlmCognitionRelationProviderV1({ transport });
    const error = await provider.propose(input).catch((e: unknown) => e);
    expect((error as CognitionRelationRejectionErrorV1).code).toBe("MODEL_MALFORMED_JSON");
    expect(transport.calls).toBe(1);
  });

  it("propagates transport failures untouched (no fallback, no second attempt)", async () => {
    const input = await buildInput();
    const failure = new ModelTransportErrorV0("MODEL_CONNECTION_FAILURE", null, "offline");
    const transport = new FakeRelationTransport(() => Promise.reject(failure));
    const provider = new LlmCognitionRelationProviderV1({ transport });
    const error = await provider.propose(input).catch((e: unknown) => e);
    expect(error).toBe(failure);
    expect(transport.calls).toBe(1);
  });

  it("receives a deep-frozen provider input that survives the call unchanged", async () => {
    const input = await buildInput();
    const snapshot = JSON.stringify(input);
    const transport = new FakeRelationTransport(() => ({ content: "{}" }));
    const provider = new LlmCognitionRelationProviderV1({ transport });
    expect(Object.isFrozen(input)).toBe(true);
    expect(Object.isFrozen(input.projection)).toBe(true);
    expect(Object.isFrozen(input.canonical_actions)).toBe(true);
    await provider.propose(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});
