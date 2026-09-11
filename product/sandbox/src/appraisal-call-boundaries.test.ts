/**
 * CONTENT_SENSITIVE_APPRAISAL_PROVIDER_V0 — appraisal call boundaries.
 *
 * Proves the model-backed appraisal provider is invoked ONLY for factual
 * events: subject setup/configuration causes zero appraisal calls, `/memory`
 * causes zero appraisal calls, and a normal turn causes exactly one per
 * factual event (reply-event + primary event on a feedback turn).
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type {
  FactualEventAppraisalContextProjectionV0,
  FactualEventAppraisalProviderV0,
  ModelTransportRequestV0,
  ModelTransportResponseV0,
  ModelTransportV0
} from "@characteros-next/runtime";
import { InteractiveSubjectHostV0 } from "./interactive-subject-host.js";
import { ProductCliSessionV0 } from "./product-cli-session.js";

const tempDirs: string[] = [];
function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "characteros-appr-bound-"));
  tempDirs.push(dir);
  return dir;
}
afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
  }
});

/** Counting content-sensitive test provider (not the product model provider). */
function countingAppraisalProvider(counter: { calls: number }): FactualEventAppraisalProviderV0 {
  return {
    proposeFactualEventAppraisal: async (context: never) => {
      counter.calls += 1;
      const ctx = context as unknown as FactualEventAppraisalContextProjectionV0;
      return {
        schema_version: "factual-event-appraisal-proposal-v0",
        status: "APPRAISED",
        subject_id: ctx.subject_id,
        factual_event_ref: ctx.factual_event_ref,
        context_projection_hash: ctx.context_projection_hash,
        dimensions: {
          relevance: 0.6,
          goal_congruence: 0.5,
          attribution: "other",
          controllability: 0.5,
          uncertainty: 0.5,
          intensity: 0.4
        },
        assessment_confidence: 0.6,
        evidence_refs: [ctx.factual_event_ref].sort()
      };
    }
  } as unknown as FactualEventAppraisalProviderV0;
}

function cognitionTransport(): ModelTransportV0 {
  return {
    complete: async (request: ModelTransportRequestV0): Promise<ModelTransportResponseV0> => {
      const user = request.messages.find((message) => message.role === "user")?.content ?? "";
      const projectionHash = /\[projection_hash\]\s+(\S+)/.exec(user)?.[1] ?? "";
      return {
        content: JSON.stringify({
          schema_version: "conversation-cognition-proposal-v1",
          cognition: {
            schema_version: "cognition-proposal-v0",
            projection_hash: projectionHash,
            reasoning_summary: "offline cognition",
            relevant_memory_refs: [],
            considered_context_refs: [],
            current_intent: "respond",
            confidence: 0.7,
            uncertainty: 0.3,
            action_intent: null,
            evidence_refs: []
          },
          communication_directive: { kind: "CLARIFY_MISSING_CONTEXT" }
        }),
        model: "fake"
      } as ModelTransportResponseV0;
    }
  } as ModelTransportV0;
}

const languageTransport = {
  complete: async (): Promise<ModelTransportResponseV0> =>
    ({ content: "{}", model: "fake" }) as ModelTransportResponseV0
} as ModelTransportV0;

describe("CONTENT_SENSITIVE_APPRAISAL_PROVIDER_V0 — invocation boundaries", () => {
  it("setup causes zero appraisal calls; one turn causes one per factual event; /memory causes none", async () => {
    const counter = { calls: 0 };
    const host = await InteractiveSubjectHostV0.open(
      { subject_id: "alice", display_name: "Alice", session_id: "sess-appr-bound", storage_root: makeTempDir(), interval_ticks: 1 },
      {
        conversationCognitionTransport: cognitionTransport(),
        languageTransport,
        appraisalProvider: countingAppraisalProvider(counter),
        provider_identity: { model: "fake", num_predict: 2048 },
        clock: () => "2026-01-01T00:00:00.000Z"
      }
    );
    // Subject setup / genesis is not a lived factual event.
    expect(counter.calls).toBe(0);

    await host.send("First factual event.");
    expect(counter.calls).toBe(1);

    const lines: string[] = [];
    const session = new ProductCliSessionV0({
      host,
      subjectLabel: "Alice",
      model: "fake",
      providerLabel: "FAKE",
      contextWindowTokens: 8192,
      maxOutputTokens: 2048,
      debug: false,
      write: (line) => lines.push(line)
    });
    const before = counter.calls;
    await session.handleLine("/memory");
    expect(counter.calls).toBe(before);

    // A feedback turn appraises two factual events: the reply event and the new primary event.
    await host.send("Second factual event.");
    expect(counter.calls).toBe(before + 2);
  });
});
