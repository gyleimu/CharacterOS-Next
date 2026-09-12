/**
 * CHARACTEROS_VISUAL_PRODUCT_LOCAL_WEB_V0 — product runtime facade tests.
 *
 * Deterministic: fake transports + an injected provider bundle + an injected
 * metadata probe. 0 real provider calls, no sleeps. Proves open/create, real
 * restart continuity over the file stores, structured progress events, truthful
 * failure summarization, serialized turns, and fail-closed startup.
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type {
  ModelTransportRequestV0,
  ModelTransportResponseV0,
  ModelTransportV0
} from "@characteros-next/runtime";
import { ModelTransportErrorV0 } from "@characteros-next/runtime";
import { createProductAppraisalProviderV0 } from "./product-appraisal-provider.js";
import { createProductRuntimeV0, ProductRuntimeStartupErrorV0, type ProductRuntimeV0 } from "./product-runtime.js";
import {
  ProviderDiagnosticsV0,
  wrapTransportForStageV0,
  type ProviderProgressEventV0
} from "./provider-diagnostics.js";
import type { ProductProviderBundleV0 } from "./product-provider-bundle.js";
import { environmentFromRecordV0 } from "./product-configuration.js";

const tempDirs: string[] = [];
function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "characteros-web-runtime-"));
  tempDirs.push(dir);
  return dir;
}
afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
  }
});

type CognitionMode = "OK" | "UNAVAILABLE";

function appraisalTransport(): ModelTransportV0 {
  return {
    complete: async (): Promise<ModelTransportResponseV0> =>
      ({
        content: JSON.stringify({
          relevance: 0.6,
          goal_congruence: 0.5,
          attribution: "other",
          controllability: 0.5,
          uncertainty: 0.5,
          intensity: 0.4,
          assessment_confidence: 0.6
        }),
        model: "fake"
      }) as ModelTransportResponseV0
  } as ModelTransportV0;
}

function cognitionTransport(mode: CognitionMode): ModelTransportV0 {
  return {
    complete: async (request: ModelTransportRequestV0): Promise<ModelTransportResponseV0> => {
      if (mode === "UNAVAILABLE") {
        throw new ModelTransportErrorV0("MODEL_CONNECTION_FAILURE", null, "connect ECONNREFUSED 127.0.0.1:11434");
      }
      const user = request.messages.find((message) => message.role === "user")?.content ?? "";
      const projectionHash = /\[projection_hash\]\s+(\S+)/.exec(user)?.[1] ?? "";
      return {
        content: JSON.stringify({
          schema_version: "conversation-cognition-proposal-v1",
          cognition: {
            schema_version: "cognition-proposal-v0",
            projection_hash: projectionHash,
            reasoning_summary: "offline",
            relevant_memory_refs: [],
            considered_context_refs: [],
            current_intent: "respond",
            confidence: 0.7,
            uncertainty: 0.3,
            action_intent: null,
            evidence_refs: []
          },
          communication_directive: { kind: "REALIZE_CURRENT_INTENT" }
        }),
        model: "fake"
      } as ModelTransportResponseV0;
    }
  } as ModelTransportV0;
}

function languageTransport(): ModelTransportV0 {
  return {
    complete: async (request: ModelTransportRequestV0): Promise<ModelTransportResponseV0> => {
      const user = request.messages.find((message) => message.role === "user")?.content ?? "";
      const inputHash = /input_hash:\s*(sha256:[0-9a-f]+)/.exec(user)?.[1] ?? "";
      return {
        content: JSON.stringify({
          schema_version: "language-realization-draft-v0",
          input_hash: inputHash,
          text: "Hello from the local visual product.",
          evidence_refs: []
        }),
        model: "fake"
      } as ModelTransportResponseV0;
    }
  } as ModelTransportV0;
}

interface BundleHarness {
  readonly bundle: ProductProviderBundleV0;
  readonly events: ProviderProgressEventV0[];
}

function fakeBundle(mode: CognitionMode = "OK"): BundleHarness {
  const events: ProviderProgressEventV0[] = [];
  let clock = 0;
  const diagnostics = new ProviderDiagnosticsV0({
    write: () => undefined,
    observer: (event) => events.push(event),
    now: () => (clock += 1000),
    model: "fake",
    timeout_ms: 120000,
    debug: false
  });
  const appraisalStage = wrapTransportForStageV0(appraisalTransport(), "APPRAISAL", diagnostics);
  const cognitionStage = wrapTransportForStageV0(cognitionTransport(mode), "COGNITION", diagnostics);
  const languageStage = wrapTransportForStageV0(languageTransport(), "LANGUAGE", diagnostics);
  const appraisal = createProductAppraisalProviderV0({ transport: appraisalStage });
  return {
    events,
    bundle: {
      diagnostics,
      transports: {
        cognition: cognitionStage,
        language: languageStage,
        appraisal: appraisalStage,
        relationship: appraisalStage,
        lastCognitionTrace: () => null,
        lastAppraisalTrace: () => null
      },
      appraisalProvider: appraisal.provider,
      appraisalCallCount: () => appraisal.stats.callCount(),
      beliefSemanticProvider: null,
      relationshipFamiliarityAdmissionProvider: null,
      turnPlan: {
        belief_adaptation_enabled: false,
        relationship_adaptation_enabled: false,
        personality_adaptation_enabled: false
      },
      model: "fake"
    }
  };
}

const READY_PROBE = async (): Promise<{
  reachable: boolean;
  version: string | null;
  digest: string | null;
  failure: string | null;
}> => ({ reachable: true, version: "fake", digest: "d", failure: null });

function openRuntime(
  dir: string,
  harness: BundleHarness,
  options: { readonly displayName?: string; readonly environment?: Record<string, string | undefined> } = {}
): Promise<ProductRuntimeV0> {
  return createProductRuntimeV0({
    data_root: dir,
    subject: { display_name: options.displayName ?? "Mira" },
    provider_bundle: harness.bundle,
    probe: READY_PROBE,
    environment: environmentFromRecordV0(options.environment ?? {}),
    clock: () => "2026-01-01T00:00:00.000Z"
  });
}

describe("CHARACTEROS_VISUAL_PRODUCT_LOCAL_WEB_V0 — product runtime facade", () => {
  it("W2: creates ONE subject on first start and reports NEW truthfully", async () => {
    const dir = makeTempDir();
    const harness = fakeBundle();
    const runtime = await openRuntime(dir, harness);
    const bootstrap = await runtime.bootstrap();
    expect(bootstrap.status).toBe("NEW");
    expect(bootstrap.created_this_start).toBe(true);
    expect(bootstrap.identity.display_name).toBe("Mira");
    expect(bootstrap.identity.subject_id).toMatch(/^mira-[0-9a-f]{8}$/);
    expect(bootstrap.identity.durable_state).toBe("NONE");
    expect(bootstrap.provider.ready).toBe(true);
    expect(bootstrap.provider.model).toBe("qwen3.5:9b");
    expect(bootstrap.recent_memory.total_episode_count).toBe(0);
    expect(bootstrap.state.beliefs).toEqual([]);
    await runtime.shutdown();
  });

  it("W3+W4: a talk turn completes, emits the plan/stage events, and updates life/state", async () => {
    const dir = makeTempDir();
    const harness = fakeBundle();
    const runtime = await openRuntime(dir, harness);
    expect(runtime.isQuiescent()).toBe(true);

    const result = await runtime.submitHumanText("Hello there.");
    const turn = runtime.summarizeTurn(result);
    expect(turn.status).toBe("COMPLETE");
    expect(turn.reply_text).toBe("Hello from the local visual product.");
    expect(turn.turn_index).toBe(0);
    expect(turn.failure).toBeNull();

    const types = harness.events.map((event) => event.type);
    expect(types[0]).toBe("TURN_PLAN");
    expect(types).toContain("STAGE_RUNNING");
    expect(types).toContain("STAGE_SUCCEEDED");
    expect(types).toContain("TURN_COMPLETED");
    // Events never carry user text or prompts.
    expect(JSON.stringify(harness.events)).not.toContain("Hello there.");
    // Reply path numbering is the same truth the CLI shows.
    const running = harness.events.filter((event) => event.type === "STAGE_RUNNING");
    expect(running[0]).toMatchObject({ stage: "APPRAISAL", group: "REPLY", index: 1, total: 3 });
    expect(running[1]).toMatchObject({ stage: "COGNITION", group: "REPLY", index: 2, total: 3 });

    const memory = await runtime.livedMemory(10);
    expect(memory.total_episode_count).toBe(1);
    const state = await runtime.stateView();
    expect(state.status.completed_turns).toBe(1);
    await runtime.shutdown();
  });

  it("W7: a fresh process over the same data root restores the SAME subject and life", async () => {
    const dir = makeTempDir();
    const first = await openRuntime(dir, fakeBundle());
    await first.submitHumanText("Remember this.");
    const before = await first.bootstrap();
    await first.shutdown();

    const second = await openRuntime(dir, fakeBundle());
    const after = await second.bootstrap();
    expect(after.status).toBe("RESTORED");
    expect(after.created_this_start).toBe(false);
    expect(after.identity.subject_id).toBe(before.identity.subject_id);
    expect(after.identity.durable_state).toBe("PRESENT");
    expect(after.logical_time).toBe(before.logical_time);
    expect(after.recent_memory.total_episode_count).toBe(before.recent_memory.total_episode_count);
    expect(after.revisions.state_revision).toBe(before.revisions.state_revision);
    await second.shutdown();
  });

  it("W3-failure: a failed turn returns the truthful summary and no reply", async () => {
    const dir = makeTempDir();
    const harness = fakeBundle("UNAVAILABLE");
    const runtime = await openRuntime(dir, harness);
    const result = await runtime.submitHumanText("This will fail.");
    const turn = runtime.summarizeTurn(result);
    expect(turn.status).toBe("FAILED");
    expect(turn.reply_text).toBeNull();
    expect(turn.failure).not.toBeNull();
    expect(turn.failure?.stage).toBe("COGNITION");
    expect(turn.failure?.category).toBe("PROVIDER_UNAVAILABLE");
    // The pre-cognition Appraisal committed canonically, so this is truthfully PARTIAL.
    expect(turn.failure?.persistence).toBe("PARTIAL");
    expect(turn.failure?.suggested_action.length).toBeGreaterThan(0);
    expect(harness.events.map((event) => event.type)).toContain("TURN_FAILED");
    await runtime.shutdown();
  });

  it("W3: concurrent submissions are serialized by the backend, never raced", async () => {
    const dir = makeTempDir();
    const harness = fakeBundle();
    const runtime = await openRuntime(dir, harness);
    const [a, b] = await Promise.all([
      runtime.submitHumanText("First."),
      runtime.submitHumanText("Second.")
    ]);
    expect(a.outcome.status).toBe("COMPLETE");
    expect(b.outcome.status).toBe("COMPLETE");
    expect(a.outcome.turn_index).toBe(0);
    expect(b.outcome.turn_index).toBe(1);
    const status = await runtime.status();
    expect(status.completed_turns).toBe(2);
    await runtime.shutdown();
  });

  it("W1/startup: provider, model and configuration failures fail closed with guidance", async () => {
    const dir = makeTempDir();
    const unavailable = await createProductRuntimeV0({
      data_root: dir,
      provider_bundle: fakeBundle().bundle,
      probe: async () => ({ reachable: false, version: null, digest: null, failure: "fetch failed" })
    }).catch((error: unknown) => error);
    expect(unavailable).toBeInstanceOf(ProductRuntimeStartupErrorV0);
    expect((unavailable as ProductRuntimeStartupErrorV0).code).toBe("PROVIDER_UNAVAILABLE");
    expect((unavailable as ProductRuntimeStartupErrorV0).guidance.join("\n")).toContain("Provider unavailable.");

    const missingModel = await createProductRuntimeV0({
      data_root: dir,
      provider_bundle: fakeBundle().bundle,
      probe: async () => ({ reachable: true, version: "fake", digest: null, failure: "model nope is not available" })
    }).catch((error: unknown) => error);
    expect((missingModel as ProductRuntimeStartupErrorV0).code).toBe("MODEL_UNAVAILABLE");
    expect((missingModel as ProductRuntimeStartupErrorV0).guidance.join("\n")).toContain("never downloads or installs models");

    const badConfig = await createProductRuntimeV0({
      data_root: dir,
      provider_bundle: fakeBundle().bundle,
      probe: READY_PROBE,
      environment: environmentFromRecordV0({ CHARACTEROS_TIMEOUT_MS: "abc" })
    }).catch((error: unknown) => error);
    expect((badConfig as ProductRuntimeStartupErrorV0).code).toBe("CONFIGURATION_INVALID");
    expect((badConfig as ProductRuntimeStartupErrorV0).guidance.join("\n")).toContain("CHARACTEROS_TIMEOUT_MS");
  });

  it("W10: the facade exposes no canonical mutation surface and no provider call of its own", async () => {
    const dir = makeTempDir();
    const harness = fakeBundle();
    const runtime = await openRuntime(dir, harness);
    const before = await runtime.status();
    await runtime.bootstrap();
    await runtime.stateView();
    await runtime.lifeView();
    await runtime.livedMemory(5);
    const after = await runtime.status();
    // Pure reads: no revision, turn or time change, and no provider call.
    expect(after.state_revision).toBe(before.state_revision);
    expect(after.turn_index).toBe(before.turn_index);
    expect(after.logical_time).toBe(before.logical_time);
    expect(harness.events.length).toBe(0);
    await runtime.shutdown();
  });
});
