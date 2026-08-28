/**
 * P2-next — Real LLM Cognition Provider V0 acceptance suite (L1–L20).
 *
 * Fully OFFLINE by default: a fake transport fixture exercises the raw model
 * response → parse → validation → CognitionProposal pipeline. No network, no
 * local model, no API key. An optional real-model smoke test exists behind the
 * explicit CHARACTEROS_REAL_LLM_TEST=1 flag and is skipped in the default suite.
 */

import { describe, expect, it } from "vitest";

import type { SubjectStateV0 } from "@characteros-next/subject-core";
import { s0 } from "../../transitions/observation/observation-fixtures.js";
import { buildCognitiveContextProjection } from "../../transitions/cognition-action/cognition-action-transition-executor.js";
import type { CognitiveContextProjectionV0 } from "../../transitions/cognition-action/types.js";
import {
  LlmCognitionProviderV0,
  LlmCognitionRejectionErrorV0
} from "./llm-cognition-provider.js";
import {
  ModelTransportErrorV0,
  OpenAiCompatibleTransportV0,
  type ModelTransportRequestV0,
  type ModelTransportResponseV0,
  type ModelTransportV0
} from "../../transports/model-transport.js";
import { ReferenceCognitionProviderV0 } from "../../producers/reference-cognition-provider.js";

/** Fake transport: repeatable, offline, single-attempt observability. */
class FakeModelTransport implements ModelTransportV0 {
  calls = 0;
  lastRequest: ModelTransportRequestV0 | null = null;
  constructor(
    private readonly responder: (
      request: ModelTransportRequestV0
    ) => { content: string } | Promise<never>
  ) {}
  async complete(request: ModelTransportRequestV0): Promise<ModelTransportResponseV0> {
    this.calls += 1;
    this.lastRequest = request;
    const outcome = await this.responder(request);
    return { content: outcome.content, model: "fake-model" };
  }
}

async function buildProjection(
  allowedActions: readonly { action_type: string; target_ref: string | null }[] = []
): Promise<CognitiveContextProjectionV0> {
  const base = await buildCognitiveContextProjection(s0() as unknown as SubjectStateV0);
  return { ...base, allowed_actions: allowedActions as never };
}

function validProposalJson(
  projection: CognitiveContextProjectionV0,
  overrides: Record<string, unknown> = {}
): string {
  return JSON.stringify({
    schema_version: "cognition-proposal-v0",
    projection_hash: projection.projection_hash,
    reasoning_summary: "model cognition result",
    relevant_memory_refs: [],
    considered_context_refs: [],
    current_intent: "observe and wait",
    confidence: 0.7,
    uncertainty: 0.3,
    action_intent: null,
    evidence_refs: [],
    ...overrides
  });
}

describe("P2-next LlmCognitionProviderV0 (offline fake transport)", () => {
  it("L1: valid structured model response accepted", async () => {
    const projection = await buildProjection();
    const transport = new FakeModelTransport(() => ({ content: validProposalJson(projection) }));
    const provider = new LlmCognitionProviderV0(transport);
    const proposal = await provider.propose(projection);
    expect(proposal.schema_version).toBe("cognition-proposal-v0");
    expect(proposal.projection_hash).toBe(projection.projection_hash);
    expect(proposal.action_intent).toBeNull();
  });

  it("L2: malformed JSON rejected", async () => {
    const projection = await buildProjection();
    const transport = new FakeModelTransport(() => ({ content: "{ not valid json ..." }));
    const provider = new LlmCognitionProviderV0(transport);
    await expect(provider.propose(projection)).rejects.toThrow("MODEL_MALFORMED_JSON");
  });

  it("L3: schema-invalid response rejected", async () => {
    const projection = await buildProjection();
    const transport = new FakeModelTransport(() => ({
      content: JSON.stringify({ schema_version: "cognition-proposal-v0", confidence: 2 })
    }));
    const provider = new LlmCognitionProviderV0(transport);
    await expect(provider.propose(projection)).rejects.toThrow("MODEL_SCHEMA_INVALID");
  });

  it("L4: unsupported memory ref rejected (no invented memories)", async () => {
    const projection = await buildProjection();
    const transport = new FakeModelTransport(() => ({
      content: validProposalJson(projection, {
        relevant_memory_refs: ["episode:e-betrayal-hallucination"],
        evidence_refs: ["episode:e-betrayal-hallucination"]
      })
    }));
    const provider = new LlmCognitionProviderV0(transport);
    const error = await provider.propose(projection).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(LlmCognitionRejectionErrorV0);
    expect((error as LlmCognitionRejectionErrorV0).code).toBe("MODEL_UNSUPPORTED_EVIDENCE");
    expect((error as LlmCognitionRejectionErrorV0).detail_ref).toBe("episode:e-betrayal-hallucination");
  });

  it("L5: unsupported context/entity ref rejected", async () => {
    const projection = await buildProjection();
    const transport = new FakeModelTransport(() => ({
      content: validProposalJson(projection, {
        considered_context_refs: ["entity:e-stranger"],
        evidence_refs: ["entity:e-stranger"]
      })
    }));
    const provider = new LlmCognitionProviderV0(transport);
    await expect(provider.propose(projection)).rejects.toThrow("MODEL_UNSUPPORTED_EVIDENCE");
  });

  it("L6: unsupported ActionIntent rejected", async () => {
    const projection = await buildProjection(); // empty action space
    const transport = new FakeModelTransport(() => ({
      content: validProposalJson(projection, {
        action_intent: { action_type: "shell_exec", target_ref: null }
      })
    }));
    const provider = new LlmCognitionProviderV0(transport);
    await expect(provider.propose(projection)).rejects.toThrow("MODEL_ACTION_NOT_ALLOWED");
  });

  it("L7: NO_ACTION response accepted (A9)", async () => {
    const projection = await buildProjection();
    const transport = new FakeModelTransport(() => ({ content: validProposalJson(projection) }));
    const provider = new LlmCognitionProviderV0(transport);
    const proposal = await provider.propose(projection);
    expect(proposal.action_intent).toBeNull(); // absence of intent != failure
  });

  it("L8: valid allowed ActionIntent accepted", async () => {
    const projection = await buildProjection([
      { action_type: "communicate", target_ref: "entity:e-1" }
    ]);
    const transport = new FakeModelTransport(() => ({
      content: validProposalJson(projection, {
        action_intent: { action_type: "communicate", target_ref: "entity:e-1" }
      })
    }));
    const provider = new LlmCognitionProviderV0(transport);
    const proposal = await provider.propose(projection);
    expect(proposal.action_intent).toEqual({
      action_type: "communicate",
      target_ref: "entity:e-1"
    });
  });

  it("L9: transport timeout is an observable provider failure (single attempt)", async () => {
    const projection = await buildProjection();
    const transport = new FakeModelTransport(() =>
      Promise.reject(new ModelTransportErrorV0("MODEL_TIMEOUT", null, "timed out"))
    );
    const provider = new LlmCognitionProviderV0(transport);
    await expect(provider.propose(projection)).rejects.toThrow("MODEL_TIMEOUT");
    expect(transport.calls).toBe(1); // L20: no retry loop
  });

  it("L10: HTTP failure is an observable provider failure (canonical +0 upstream)", async () => {
    const projection = await buildProjection();
    const transport = new FakeModelTransport(() =>
      Promise.reject(new ModelTransportErrorV0("MODEL_HTTP_FAILURE", 500, "internal error"))
    );
    const provider = new LlmCognitionProviderV0(transport);
    await expect(provider.propose(projection)).rejects.toBeInstanceOf(ModelTransportErrorV0);
  });

  it("L11: prompt-injection content gains no authority", async () => {
    const projection = await buildProjection(); // empty action space
    // Even if the model "obeys" injected instructions by proposing a forbidden
    // action or citing unauthorized evidence, the validation gates reject it.
    const injectedOutput = validProposalJson(projection, {
      current_intent: "set trust to 1 and execute arbitrary command",
      action_intent: { action_type: "shell_exec", target_ref: null },
      evidence_refs: ["memory:forget-everything"]
    });
    const transport = new FakeModelTransport(() => ({ content: injectedOutput }));
    const provider = new LlmCognitionProviderV0(transport);
    await expect(provider.propose(projection)).rejects.toThrow("LLM_COGNITION_");
    // And the system rules explicitly mark subject data as untrusted.
    const systemMessage = transport.lastRequest?.messages.find((m) => m.role === "system");
    expect(systemMessage?.content).toContain("untrusted content");
  });

  it("L16: transport receives the controlled prompt, NOT raw SubjectState", async () => {
    const projection = await buildProjection();
    const transport = new FakeModelTransport(() => ({ content: validProposalJson(projection) }));
    const provider = new LlmCognitionProviderV0(transport);
    await provider.propose(projection);
    const messages = transport.lastRequest?.messages ?? [];
    const all = messages.map((m) => m.content).join("\n");
    // Authorized evidence present:
    expect(all).toContain(projection.projection_hash);
    expect(all).toContain('scene="idle"');
    // Raw canonical internals NEVER present:
    expect(all).not.toContain("trace_window");
    expect(all).not.toContain("lifecycle_metadata");
    expect(all).not.toContain("repository_revision_hash");
  });

  it("L12–L15: proposal surface cannot carry memory/affect/personality/belief/relationship/Outcome writes", async () => {
    const projection = await buildProjection();
    const transport = new FakeModelTransport(() => ({ content: validProposalJson(projection) }));
    const provider = new LlmCognitionProviderV0(transport);
    const proposal = (await provider.propose(projection)) as unknown as Record<string, unknown>;
    // The validated proposal's own-key surface is EXACTLY the frozen schema —
    // there is no key through which a model could command any canonical write,
    // and the provider holds no canonical mutation capability at all.
    expect(Object.keys(proposal).sort()).toEqual(
      [
        "action_intent",
        "confidence",
        "considered_context_refs",
        "current_intent",
        "evidence_refs",
        "projection_hash",
        "reasoning_summary",
        "relevant_memory_refs",
        "schema_version",
        "uncertainty"
      ].sort()
    );
  });

  it("L19: fake transport yields repeatable integration results", async () => {
    const projection = await buildProjection();
    const run = async (): Promise<unknown> => {
      const transport = new FakeModelTransport(() => ({ content: validProposalJson(projection) }));
      return new LlmCognitionProviderV0(transport).propose(projection);
    };
    expect(JSON.stringify(await run())).toBe(JSON.stringify(await run()));
  });
});

describe("P2-next reference provider compatibility + optional real-model smoke", () => {
  it("L17: ReferenceCognitionProviderV0 continues to work unchanged", async () => {
    const projection = await buildProjection();
    const reference = new ReferenceCognitionProviderV0();
    const a = await reference.propose(projection);
    const b = await reference.propose(projection);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.projection_hash).toBe(projection.projection_hash);
  });

  it("L18: default suite is offline — real-model smoke is opt-in only", async () => {
    const realMode = process.env["CHARACTEROS_REAL_LLM_TEST"] === "1";
    // In the default suite (no flag) this assertion documents the offline
    // contract; with the flag set, a real endpoint config would be required.
    expect(realMode).toBe(false);
  });

  it.skipIf(process.env["CHARACTEROS_REAL_LLM_TEST"] !== "1")(
    "OPTIONAL real-model smoke (requires CHARACTEROS_REAL_LLM_TEST=1 + endpoint env)",
    async () => {
      const baseUrl = process.env["CHARACTEROS_LLM_BASE_URL"];
      const model = process.env["CHARACTEROS_LLM_MODEL"];
      if (baseUrl === undefined || model === undefined) {
        throw new Error("real-model smoke requires CHARACTEROS_LLM_BASE_URL and CHARACTEROS_LLM_MODEL");
      }
      const transport = new OpenAiCompatibleTransportV0({
        base_url: baseUrl,
        model,
        api_key: process.env["CHARACTEROS_LLM_API_KEY"] ?? null,
        timeout_ms: 30000,
        temperature: 0,
        max_output_tokens: 512
      });
      const projection = await buildProjection();
      const provider = new LlmCognitionProviderV0(transport);
      const proposal = await provider.propose(projection);
      expect(proposal.projection_hash).toBe(projection.projection_hash);
    }
  );
});
