/**
 * CHARACTEROS_PRODUCT_PROVIDER_RESILIENCE_AND_DIAGNOSTICS_V0 — product tests.
 *
 * Deterministic fakes only (0 real provider calls): stage progress + latency,
 * failure classification, canonical-safety reporting, post-failure operability,
 * provider-independent operations, no semantic fallback, and no core change.
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
import { InteractiveSubjectHostV0, type InteractiveSubjectHostConfigV0 } from "./interactive-subject-host.js";
import { InMemoryInteractiveSnapshotStoreV0 } from "./persistent-snapshot-store.js";
import { FileSharedSubjectSourceStoreV0 } from "./shared-subject-source.js";
import { ProductLifeOperationsV0 } from "./product-life-operations.js";
import { ProductCliSessionV0 } from "./product-cli-session.js";
import { createProductAppraisalProviderV0 } from "./product-appraisal-provider.js";
import { ProviderDiagnosticsV0, wrapTransportForStageV0 } from "./provider-diagnostics.js";

const SUBJECT_ID = "resilience-subject";

const tempDirs: string[] = [];
function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "characteros-resilience-"));
  tempDirs.push(dir);
  return dir;
}
afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
  }
});

type CognitionBehaviour = "OK" | "UNAVAILABLE" | "TIMEOUT" | "MALFORMED";

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

function cognitionTransport(behaviour: CognitionBehaviour): ModelTransportV0 {
  return {
    complete: async (request: ModelTransportRequestV0): Promise<ModelTransportResponseV0> => {
      if (behaviour === "UNAVAILABLE") {
        throw new ModelTransportErrorV0("MODEL_CONNECTION_FAILURE", null, "connect ECONNREFUSED 127.0.0.1:11434");
      }
      if (behaviour === "TIMEOUT") {
        throw new ModelTransportErrorV0("MODEL_TIMEOUT", null, "request exceeded 120000 ms");
      }
      if (behaviour === "MALFORMED") {
        return { content: "{ this is not json", model: "fake" } as ModelTransportResponseV0;
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
          text: "Noted.",
          evidence_refs: []
        }),
        model: "fake"
      } as ModelTransportResponseV0;
    }
  } as ModelTransportV0;
}

function hostConfig(dir: string): InteractiveSubjectHostConfigV0 {
  return { subject_id: SUBJECT_ID, display_name: "Res", session_id: "sess-res", storage_root: dir, interval_ticks: 1 };
}

interface Fixture {
  readonly host: InteractiveSubjectHostV0;
  readonly life: ProductLifeOperationsV0;
  readonly session: ProductCliSessionV0;
  readonly lines: string[];
  readonly diagnostics: ProviderDiagnosticsV0;
}

async function buildResilientProduct(
  dir: string,
  behaviour: CognitionBehaviour,
  snapshotStore: InMemoryInteractiveSnapshotStoreV0 = new InMemoryInteractiveSnapshotStoreV0()
): Promise<Fixture> {
  const lines: string[] = [];
  let clock = 0;
  const diagnostics = new ProviderDiagnosticsV0({
    write: (line) => lines.push(line),
    now: () => (clock += 100),
    model: "fake",
    timeout_ms: 120000,
    debug: false
  });
  const sharedSourceStore = new FileSharedSubjectSourceStoreV0(dir, SUBJECT_ID);
  const appraisalStage = wrapTransportForStageV0(appraisalTransport(), "APPRAISAL", diagnostics);
  const cognitionStage = wrapTransportForStageV0(cognitionTransport(behaviour), "COGNITION", diagnostics);
  const languageStage = wrapTransportForStageV0(languageTransport(), "LANGUAGE", diagnostics);
  const deps = {
    conversationCognitionTransport: cognitionStage,
    languageTransport: languageStage,
    appraisalProvider: createProductAppraisalProviderV0({ transport: appraisalStage }).provider,
    sharedSourceStore,
    snapshotStore,
    provider_identity: { model: "fake", num_predict: 2048 },
    clock: () => "2026-01-01T00:00:00.000Z"
  };
  const host = await InteractiveSubjectHostV0.open(hostConfig(dir), deps);
  const life = new ProductLifeOperationsV0(
    { storage_root: dir, subject: { subject_id: SUBJECT_ID, display_name: "Res", identity_anchors: [] }, interaction_interval_ticks: 1 },
    {
      host,
      sharedSourceStore,
      conversationCognitionTransport: deps.conversationCognitionTransport,
      languageTransport: deps.languageTransport,
      factualEventAppraisalProvider: deps.appraisalProvider,
      provider_identity: deps.provider_identity,
      clock: deps.clock
    }
  );
  const session = new ProductCliSessionV0({
    host,
    life,
    diagnostics,
    subjectLabel: "Res",
    model: "fake",
    providerLabel: "FAKE",
    contextWindowTokens: 8192,
    maxOutputTokens: 2048,
    debug: false,
    write: (line) => lines.push(line)
  });
  return { host, life, session, lines, diagnostics };
}

function output(lines: readonly string[]): string {
  return lines.join("\n");
}

describe("CHARACTEROS_PRODUCT_PROVIDER_RESILIENCE_AND_DIAGNOSTICS_V0", () => {
  it("D1+D2: stage progress and bounded latency are visible on a successful turn", async () => {
    const product = await buildResilientProduct(makeTempDir(), "OK");
    await product.session.handleLine("Hello there.");
    const text = output(product.lines);
    expect(text).toContain("[reply 1/3 appraisal] running...");
    expect(text).toContain("[reply 1/3 appraisal] done (100 ms)");
    expect(text).toContain("[reply 2/3 cognition] running...");
    expect(text).toContain("[reply 2/3 cognition] done (100 ms)");
    expect(text).toContain("[reply 3/3 language] running...");
    expect(text).toContain("[reply 3/3 language] done (100 ms)");
    expect(product.diagnostics.last("COGNITION").status).toBe("OK");
    expect(product.diagnostics.last("COGNITION").latency_ms).toBe(100);
    // Progress output does not include prompts or payloads.
    expect(text).not.toContain("[PRIOR FACTUAL MEMORY");
  });

  it("D3+D4: provider unavailable is classified with stage context and canonical safety", async () => {
    const product = await buildResilientProduct(makeTempDir(), "UNAVAILABLE");
    await product.session.handleLine("This will fail at cognition.");
    const text = output(product.lines);
    expect(text).toContain("[reply 2/3 cognition] failed");
    expect(text).toContain("Turn failed during: COGNITION");
    expect(text).toContain("PROVIDER_UNAVAILABLE");
    expect(text).toContain("Subject persistence:");
    expect(text).toContain("Canonical revision:");
    expect(text).toContain("Ollama is running");
    expect(product.diagnostics.last("APPRAISAL").status).toBe("OK");
    expect(product.diagnostics.last("COGNITION").status).toBe("FAILED");
  });

  it("D3: timeout is classified as PROVIDER_TIMEOUT with the configured timeout in /diagnostics", async () => {
    const product = await buildResilientProduct(makeTempDir(), "TIMEOUT");
    await product.session.handleLine("This will time out.");
    expect(output(product.lines)).toContain("PROVIDER_TIMEOUT");
    product.lines.length = 0;
    await product.session.handleLine("/diagnostics");
    const text = output(product.lines);
    expect(text).toContain("Configured timeout: 120000 ms");
    expect(text).toContain("COGNITION: FAILED");
    expect(text).toContain("PROVIDER_TIMEOUT");
    expect(text).toContain("No canonical subject state is written by provider diagnostics.");
  });

  it("D3: malformed provider output is classified, not repaired", async () => {
    const product = await buildResilientProduct(makeTempDir(), "MALFORMED");
    await product.session.handleLine("Malformed response.");
    const text = output(product.lines);
    expect(text).toContain("Turn failed during: COGNITION");
    expect(text).toMatch(/PROVIDER_MALFORMED_RESPONSE|PROVIDER_INTERNAL_ERROR/);
    // No fabricated reply text.
    expect(text).not.toContain("Res > Noted.");
  });

  it("D6+D4: a failed turn fabricates no Memory and reports partial canonical truthfully", async () => {
    const dir = makeTempDir();
    const product = await buildResilientProduct(dir, "UNAVAILABLE");
    const before = await product.host.status();
    const memoryBefore = await product.host.livedMemory({ limit: 100 });
    await product.session.handleLine("Fail closed.");
    const after = await product.host.status();
    const memoryAfter = await product.host.livedMemory({ limit: 100 });

    // The pre-cognition Appraisal commits canonically BEFORE cognition, so this
    // failed turn is truthfully PARTIAL — never presented as "nothing changed".
    expect(after.repository_revision).not.toBe(before.repository_revision);
    expect(output(product.lines)).toContain("Subject persistence: PARTIAL");
    // No fabricated Experience/Memory: lived episodes are unchanged.
    expect(memoryAfter.total_episode_count).toBe(memoryBefore.total_episode_count);
    // The partial turn is not persisted: a fresh host over the same store
    // resolves to the persisted boundary (nothing was committed durably here).
    const reopened = await buildResilientProduct(dir, "UNAVAILABLE");
    const reopenedStatus = await reopened.host.status();
    expect(reopenedStatus.repository_revision).toBe(before.repository_revision);
  });

  it("D5: inspection and exit remain available after provider failure", async () => {
    const product = await buildResilientProduct(makeTempDir(), "UNAVAILABLE");
    await product.session.handleLine("Fail.");
    for (const command of ["/status", "/state", "/life", "/memory", "/diagnostics"]) {
      product.lines.length = 0;
      const result = await product.session.handleLine(command);
      expect(result.kind).toBe("HANDLED");
      expect(product.lines.length).toBeGreaterThan(0);
    }
    product.lines.length = 0;
    const exit = await product.session.handleLine("/exit");
    expect(exit.kind).toBe("EXIT");
    expect(output(product.lines)).toContain("Goodbye.");
  });

  it("D7: provider-independent /time still works during a provider outage", async () => {
    const dir = makeTempDir();
    // Establish one shared canonical subject with a working provider, then reopen
    // the same store with a failing provider (a provider outage). The human-turn
    // sidecar is shared so the turn index continues (as the file-backed product
    // sidecar does across real restarts).
    const sidecar = new InMemoryInteractiveSnapshotStoreV0();
    const healthy = await buildResilientProduct(dir, "OK", sidecar);
    await healthy.session.handleLine("Establish the subject.");
    const before = await healthy.host.status();

    const outage = await buildResilientProduct(dir, "UNAVAILABLE", sidecar);
    expect(outage.host.resolution()).toBe("SUBJECT_RESTORED");
    const timeResult = await outage.life.time(5);
    expect(timeResult.no_op).toBe(false);
    expect(timeResult.logical_time_after).toBe(timeResult.logical_time_before + 5);
    const after = await outage.host.status();
    expect(after.logical_time).toBe(before.logical_time + 5);
    // Talk still fails closed during the outage.
    outage.lines.length = 0;
    await outage.session.handleLine("Talk during outage.");
    expect(output(outage.lines)).toContain("Turn failed during: COGNITION");
  });

  it("D8+adaptation: disabled optional adaptation providers are DISABLED, not broken", async () => {
    const product = await buildResilientProduct(makeTempDir(), "OK");
    await product.session.handleLine("A normal turn.");
    expect(product.diagnostics.last("BELIEF_ADAPTATION").status).toBe("DISABLED");
    expect(product.diagnostics.last("PERSONALITY_ADAPTATION").status).toBe("DISABLED");
    expect(product.diagnostics.last("RELATIONSHIP_ADAPTATION").status).toBe("DISABLED");
    product.lines.length = 0;
    await product.session.handleLine("/diagnostics");
    const text = output(product.lines);
    expect(text).toContain("BELIEF_ADAPTATION: DISABLED (not configured)");
    expect(text).toContain("RELATIONSHIP_ADAPTATION: DISABLED (not configured)");
    // Successful turn still succeeds (no fabricated adaptation).
    expect(text).toContain("Last turn: index=0 status=COMPLETE");
  });
});
