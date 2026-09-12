/**
 * CHARACTEROS_PRODUCT_TURN_BUDGET_AND_LATENCY_EXPECTATION_V0 — deterministic tests.
 *
 * 0 real provider calls and no real sleeps: an injectable monotonic clock advances
 * ONLY when a fake transport does work, so every stage latency and every estimate
 * is exactly deterministic. Covers turn plan, step numbering, conditional
 * language, disabled/skipped stages, failure stop, /diagnostics timing, restart
 * reset, and the §48 success-semantics regression (same provider order and same
 * canonical commits with and without progress observability).
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
import {
  ModelRelationshipFamiliarityQualifyingAdmissionProviderV0,
  ModelTransportErrorV0,
  RELATIONSHIP_FAMILIARITY_QUALIFYING_ADMISSION_OUTPUT_SCHEMA_VERSION
} from "@characteros-next/runtime";
import { InteractiveSubjectHostV0, type InteractiveSubjectHostConfigV0 } from "./interactive-subject-host.js";
import { ProductCliSessionV0 } from "./product-cli-session.js";
import { createProductAppraisalProviderV0 } from "./product-appraisal-provider.js";
import { FileSharedSubjectSourceStoreV0 } from "./shared-subject-source.js";
import {
  ProviderDiagnosticsV0,
  buildProductTurnPlanV0,
  formatTurnCompletionLineV0,
  formatTurnExpectationLineV0,
  wrapTransportForStageV0,
  type ProductTurnPlanInputV0
} from "./provider-diagnostics.js";
import { createProductProviderBundleV0 } from "./product-provider-bundle.js";
import { environmentFromRecordV0, resolveProductConfigurationV0 } from "./product-configuration.js";

const SUBJECT_ID = "progress-subject";
const APPRAISAL_MS = 1000;
const COGNITION_MS = 2000;
const LANGUAGE_MS = 500;
const RELATIONSHIP_MS = 300;

const tempDirs: string[] = [];
function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "characteros-progress-"));
  tempDirs.push(dir);
  return dir;
}
afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
  }
});

interface Clock {
  value: number;
}

type CognitionMode = "REALIZE" | "CLARIFY" | "TIMEOUT" | "UNAVAILABLE" | "MALFORMED";

interface Recorder {
  readonly order: string[];
}

function appraisalTransport(clock: Clock, recorder: Recorder): ModelTransportV0 {
  return {
    complete: async (): Promise<ModelTransportResponseV0> => {
      recorder.order.push("appraisal");
      clock.value += APPRAISAL_MS;
      return {
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
      } as ModelTransportResponseV0;
    }
  } as ModelTransportV0;
}

function cognitionTransport(clock: Clock, recorder: Recorder, mode: CognitionMode): ModelTransportV0 {
  return {
    complete: async (request: ModelTransportRequestV0): Promise<ModelTransportResponseV0> => {
      recorder.order.push("cognition");
      clock.value += COGNITION_MS;
      if (mode === "UNAVAILABLE") {
        throw new ModelTransportErrorV0("MODEL_CONNECTION_FAILURE", null, "connect ECONNREFUSED 127.0.0.1:11434");
      }
      if (mode === "TIMEOUT") {
        throw new ModelTransportErrorV0("MODEL_TIMEOUT", null, "request exceeded 120000 ms");
      }
      if (mode === "MALFORMED") {
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
          communication_directive: {
            kind: mode === "CLARIFY" ? "CLARIFY_MISSING_CONTEXT" : "REALIZE_CURRENT_INTENT"
          }
        }),
        model: "fake"
      } as ModelTransportResponseV0;
    }
  } as ModelTransportV0;
}

function languageTransport(clock: Clock, recorder: Recorder): ModelTransportV0 {
  return {
    complete: async (request: ModelTransportRequestV0): Promise<ModelTransportResponseV0> => {
      recorder.order.push("language");
      clock.value += LANGUAGE_MS;
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

function relationshipTransport(clock: Clock, recorder: Recorder): ModelTransportV0 {
  return {
    complete: async (): Promise<ModelTransportResponseV0> => {
      recorder.order.push("relationship");
      clock.value += RELATIONSHIP_MS;
      return {
        content: JSON.stringify({
          schema_version: RELATIONSHIP_FAMILIARITY_QUALIFYING_ADMISSION_OUTPUT_SCHEMA_VERSION,
          kind: "QUALIFYING",
          qualifying_class: "DIRECT_COMMUNICATION"
        }),
        model: "fake"
      } as ModelTransportResponseV0;
    }
  } as ModelTransportV0;
}

interface Harness {
  readonly host: InteractiveSubjectHostV0;
  readonly session: ProductCliSessionV0;
  readonly lines: string[];
  readonly diagnostics: ProviderDiagnosticsV0;
  readonly clock: Clock;
  readonly order: string[];
}

interface HarnessOptions {
  readonly cognition?: CognitionMode;
  readonly relationship?: boolean;
  readonly withDiagnostics?: boolean;
  readonly turnPlan?: ProductTurnPlanInputV0;
  readonly debug?: boolean;
}

function hostConfig(dir: string): InteractiveSubjectHostConfigV0 {
  return { subject_id: SUBJECT_ID, display_name: "Prog", session_id: "sess-progress", storage_root: dir, interval_ticks: 1 };
}

async function buildHarness(dir: string, options: HarnessOptions = {}): Promise<Harness> {
  const clock: Clock = { value: 0 };
  const recorder: Recorder = { order: [] };
  const lines: string[] = [];
  const withDiagnostics = options.withDiagnostics !== false;
  const diagnostics = new ProviderDiagnosticsV0({
    write: (line) => lines.push(line),
    now: () => clock.value,
    model: "fake",
    timeout_ms: 120000,
    debug: options.debug === true
  });
  const sharedSourceStore = new FileSharedSubjectSourceStoreV0(dir, SUBJECT_ID);
  const appraisalStage = wrapTransportForStageV0(appraisalTransport(clock, recorder), "APPRAISAL", diagnostics);
  const cognitionStage = wrapTransportForStageV0(
    cognitionTransport(clock, recorder, options.cognition ?? "REALIZE"),
    "COGNITION",
    diagnostics
  );
  const languageStage = wrapTransportForStageV0(languageTransport(clock, recorder), "LANGUAGE", diagnostics);
  const relationshipStage = wrapTransportForStageV0(relationshipTransport(clock, recorder), "RELATIONSHIP_ADAPTATION", diagnostics);
  const host = await InteractiveSubjectHostV0.open(hostConfig(dir), {
    conversationCognitionTransport: cognitionStage,
    languageTransport: languageStage,
    appraisalProvider: createProductAppraisalProviderV0({ transport: appraisalStage }).provider,
    ...(options.relationship === true
      ? { relationshipFamiliarityAdmissionProvider: new ModelRelationshipFamiliarityQualifyingAdmissionProviderV0({ transport: relationshipStage } as never) }
      : {}),
    sharedSourceStore,
    provider_identity: { model: "fake", num_predict: 2048 },
    clock: () => "2026-01-01T00:00:00.000Z"
  });
  const session = new ProductCliSessionV0({
    host,
    ...(withDiagnostics ? { diagnostics } : {}),
    turnPlan: options.turnPlan ?? {
      belief_adaptation_enabled: false,
      relationship_adaptation_enabled: options.relationship === true,
      personality_adaptation_enabled: false
    },
    subjectLabel: "Prog",
    model: "fake",
    providerLabel: "FAKE",
    contextWindowTokens: 8192,
    maxOutputTokens: 2048,
    debug: options.debug === true,
    write: (line) => lines.push(line)
  });
  return { host, session, lines, diagnostics, clock, order: recorder.order };
}

function output(lines: readonly string[]): string {
  return lines.join("\n");
}

describe("CHARACTEROS_PRODUCT_TURN_BUDGET_AND_LATENCY_EXPECTATION_V0 — plan and formatting", () => {
  it("T1+T3: the expected plan counts only enabled stages and marks language conditional", () => {
    const replyOnly = buildProductTurnPlanV0({
      belief_adaptation_enabled: false,
      relationship_adaptation_enabled: false,
      personality_adaptation_enabled: false
    });
    expect(replyOnly.reply_stages).toEqual(["APPRAISAL", "COGNITION", "LANGUAGE"]);
    expect(replyOnly.adaptation_stages).toEqual([]);
    expect(replyOnly.prior_reply_stages).toEqual([]);
    expect(replyOnly.language_conditional).toBe(true);

    const full = buildProductTurnPlanV0({
      belief_adaptation_enabled: true,
      relationship_adaptation_enabled: true,
      personality_adaptation_enabled: false
    });
    // Personality is disabled: never counted as pending work.
    expect(full.adaptation_stages).toEqual(["RELATIONSHIP_ADAPTATION"]);
    expect(full.untimed_adaptation_stages).toEqual(["BELIEF_ADAPTATION"]);

    // From turn 2 on the runtime also appraises the previous delivered reply.
    const closing = buildProductTurnPlanV0({
      belief_adaptation_enabled: false,
      relationship_adaptation_enabled: false,
      personality_adaptation_enabled: false,
      closing_prior_outcome: true
    });
    expect(closing.prior_reply_stages).toEqual(["APPRAISAL"]);
    expect(closing.reply_stages).toEqual(["APPRAISAL", "COGNITION", "LANGUAGE"]);
  });

  it("T4+T16: no samples means an honest 'unavailable' estimate, never the timeout", () => {
    const plan = buildProductTurnPlanV0({
      belief_adaptation_enabled: true,
      relationship_adaptation_enabled: true,
      personality_adaptation_enabled: false
    });
    const line = formatTurnExpectationLineV0(plan, () => null);
    expect(line).toContain("up to 3 reply stages");
    expect(line).toContain("language skipped when cognition clarifies");
    expect(line).toContain("+ optional adaptation");
    expect(line).toContain("reply estimate unavailable (no successful local sample yet)");
    // Timeout is a bound, never presented as an expected duration.
    expect(line).not.toContain("120");
  });

  it("T4: partial and full local samples produce bounded rough estimates", () => {
    const plan = buildProductTurnPlanV0({
      belief_adaptation_enabled: false,
      relationship_adaptation_enabled: false,
      personality_adaptation_enabled: false
    });
    const partial = formatTurnExpectationLineV0(plan, (stage) => (stage === "COGNITION" ? 2000 : null));
    expect(partial).toContain("reply estimate ~2.0 s + 2 unsampled stage(s) (recent local calls)");
    const full = formatTurnExpectationLineV0(plan, () => 1000);
    expect(full).toContain("reply estimate ~3.0 s (recent local calls)");
  });

  it("T5+T22: completion line separates total wall time from provider/reply/adaptation time", () => {
    const line = formatTurnCompletionLineV0({
      status: "COMPLETE",
      total_ms: 3800,
      provider_ms: 3800,
      reply_ms: 3500,
      prior_reply_ms: 0,
      adaptation_ms: 300,
      skipped: ["LANGUAGE"]
    });
    expect(line).toBe(
      "Turn completed in 3.8 s (provider time 3.8 s: reply 3.5 s, adaptation 300 ms; skipped: LANGUAGE)"
    );
  });

  it("T2: bounded numbering groups reply and adaptation stages; no plan falls back to plain labels", () => {
    const lines: string[] = [];
    const diagnostics = new ProviderDiagnosticsV0({
      write: (line) => lines.push(line),
      now: () => 0,
      model: "fake",
      timeout_ms: 120000,
      debug: false
    });
    const plan = buildProductTurnPlanV0({
      belief_adaptation_enabled: false,
      relationship_adaptation_enabled: true,
      personality_adaptation_enabled: false,
      closing_prior_outcome: true
    });
    // A prior turn established a cognition sample; the running hint shows the
    // stage's OWN recent latency (not another stage's).
    diagnostics.beginTurn(plan);
    diagnostics.noteSucceeded("COGNITION", 2000);
    diagnostics.endTurn({ status: "COMPLETE", total_ms: 2000 });
    lines.length = 0;

    diagnostics.beginTurn(plan);
    diagnostics.noteRunning("APPRAISAL");
    diagnostics.noteSucceeded("APPRAISAL", 1000);
    diagnostics.noteRunning("COGNITION");
    diagnostics.noteSucceeded("COGNITION", 2000);
    diagnostics.noteSucceeded("LANGUAGE", 500);
    // Second APPRAISAL occurrence in the turn = closing the previous reply.
    diagnostics.noteRunning("APPRAISAL");
    diagnostics.noteSucceeded("APPRAISAL", 1000);
    diagnostics.noteRunning("RELATIONSHIP_ADAPTATION");
    diagnostics.noteSucceeded("RELATIONSHIP_ADAPTATION", 300);
    const text = output(lines);
    expect(text).toContain("[reply 1/3 appraisal] running...");
    expect(text).toContain("[reply 2/3 cognition] running... (~2.0 s recent)");
    expect(text).toContain("[reply 3/3 language] done (500 ms)");
    expect(text).toContain("[prior-reply 1/1 appraisal] running...");
    expect(text).toContain("[adaptation 1/1 relationship_adaptation] running...");
    expect(text).toContain("[adaptation 1/1 relationship_adaptation] done (300 ms)");
    // Outside a turn plan the plain label is preserved (observe/time/environment).
    diagnostics.endTurn({ status: "COMPLETE", total_ms: 0 });
    lines.length = 0;
    diagnostics.noteRunning("APPRAISAL");
    expect(output(lines)).toContain("[appraisal] running...");
  });

  it("T3: skipped stages are recorded, optionally unannounced, and listed in the summary", () => {
    const lines: string[] = [];
    const diagnostics = new ProviderDiagnosticsV0({
      write: (line) => lines.push(line),
      now: () => 0,
      model: "fake",
      timeout_ms: 120000,
      debug: false
    });
    diagnostics.beginTurn(
      buildProductTurnPlanV0({ belief_adaptation_enabled: false, relationship_adaptation_enabled: false, personality_adaptation_enabled: false })
    );
    diagnostics.noteSkipped("LANGUAGE", "no language call (NOT_REQUIRED_CLARIFY)", false);
    expect(output(lines)).not.toContain("SKIPPED");
    expect(diagnostics.last("LANGUAGE").status).toBe("SKIPPED");
    diagnostics.endTurn({ status: "COMPLETE", total_ms: 1000 });
    expect(output(lines)).toContain("skipped: LANGUAGE");
    // DISABLED stages are never pending work.
    diagnostics.noteReported("PERSONALITY_ADAPTATION", "DISABLED", "not configured");
    expect(diagnostics.last("PERSONALITY_ADAPTATION").status).toBe("DISABLED");
  });

  it("D7: a configured product bundle marks wired stages CONFIGURED, never DISABLED", () => {
    const configuration = resolveProductConfigurationV0({
      environment: environmentFromRecordV0({}),
      default_data_root: "D:\\data"
    });
    const bundle = createProductProviderBundleV0({ configuration, write: () => undefined });
    const statusOf = (stage: string): string | undefined =>
      bundle.diagnostics.snapshot().stages.find((record) => record.stage === stage)?.status;
    // Wired but not yet called in this process:
    expect(statusOf("APPRAISAL")).toBe("CONFIGURED");
    expect(statusOf("COGNITION")).toBe("CONFIGURED");
    expect(statusOf("LANGUAGE")).toBe("CONFIGURED");
    expect(statusOf("RELATIONSHIP_ADAPTATION")).toBe("CONFIGURED");
    expect(statusOf("BELIEF_ADAPTATION")).toBe("CONFIGURED");
    // Genuinely not part of this product configuration:
    expect(statusOf("PERSONALITY_ADAPTATION")).toBe("DISABLED");
    expect(bundle.diagnostics.formatLines().join("\n")).toContain("APPRAISAL: CONFIGURED (not yet called)");
    expect(bundle.turnPlan.relationship_adaptation_enabled).toBe(true);
  });

  it("T4: latency samples and last-turn timing are process-local and reset on restart", () => {
    const first = new ProviderDiagnosticsV0({ write: () => undefined, now: () => 0, model: "fake", timeout_ms: 120000, debug: false });
    first.beginTurn(buildProductTurnPlanV0({ belief_adaptation_enabled: false, relationship_adaptation_enabled: false, personality_adaptation_enabled: false }));
    first.noteSucceeded("COGNITION", 2000);
    first.endTurn({ status: "COMPLETE", total_ms: 2000 });
    expect(first.lastSuccessMs("COGNITION")).toBe(2000);
    expect(first.sampleCount("COGNITION")).toBe(1);
    expect(output(first.formatLines())).toContain("COGNITION: last 2.0 s (1 sample(s))");
    expect(output(first.formatLines())).toContain("Last turn timing: status=COMPLETE total=2.0 s provider=2.0 s reply=2.0 s adaptation=0 ms skipped=(none)");

    // A new process-local instance has no history (restart resets estimates).
    const restarted = new ProviderDiagnosticsV0({ write: () => undefined, now: () => 0, model: "fake", timeout_ms: 120000, debug: false });
    expect(restarted.lastSuccessMs("COGNITION")).toBeNull();
    expect(restarted.lastTurnTiming()).toBeNull();
    expect(output(restarted.formatLines())).toContain("none yet (no successful local call in this process)");
  });
});

describe("CHARACTEROS_PRODUCT_TURN_BUDGET_AND_LATENCY_EXPECTATION_V0 — live product turn", () => {
  it("T1+T2+T4: first turn shows an honest expectation, numbered stages, and records samples", async () => {
    const harness = await buildHarness(makeTempDir(), { relationship: true });
    await harness.session.handleLine("Hello there.");
    const text = output(harness.lines);
    expect(text).toContain("Turn: up to 3 reply stages (language skipped when cognition clarifies) + optional adaptation");
    expect(text).toContain("reply estimate unavailable (no successful local sample yet)");
    // First turn: no stage has a prior local sample, so no stage shows a hint.
    expect(text).toContain("[reply 1/3 appraisal] running...");
    expect(text).toContain("[reply 1/3 appraisal] done (1.0 s)");
    expect(text).toContain("[reply 2/3 cognition] running...\n");
    expect(text).toContain("[reply 3/3 language] running...\n");
    expect(text).toContain("[adaptation 1/1 relationship_adaptation] running...\n");
    expect(text).toContain("Turn completed in 3.8 s (provider time 3.8 s: reply 3.5 s, adaptation 300 ms)");
    expect(text).toContain("Prog > ");
    expect(harness.diagnostics.lastSuccessMs("APPRAISAL")).toBe(1000);
    expect(harness.diagnostics.sampleCount("COGNITION")).toBe(1);
    // Frozen order: reply path first, adaptation last.
    expect(harness.order).toEqual(["appraisal", "cognition", "language", "relationship"]);
  });

  it("T4: the second turn shows a rough expectation derived from prior local calls", async () => {
    const harness = await buildHarness(makeTempDir(), { relationship: true });
    await harness.session.handleLine("First message.");
    harness.lines.length = 0;
    await harness.session.handleLine("Second message.");
    const text = output(harness.lines);
    expect(text).toContain(
      "Turn: up to 3 reply stages (language skipped when cognition clarifies) + 1 prior-reply stage + optional adaptation"
    );
    expect(text).toContain("reply estimate ~3.5 s (recent local calls)");
    expect(text).toContain("[reply 2/3 cognition] running... (~2.0 s recent)");
    // The previous turn's delivered reply is appraised AFTER this turn's response
    // and is labeled as such — never as a second reply slot.
    expect(text).toContain("[prior-reply 1/1 appraisal] running... (~1.0 s recent)");
    expect(text).toContain(
      "Turn completed in 4.8 s (provider time 4.8 s: reply 3.5 s, prior-reply 1.0 s, adaptation 300 ms)"
    );
    // Provider policy is unchanged: exactly one call per stage per occurrence.
    expect(harness.order).toEqual([
      "appraisal",
      "cognition",
      "language",
      "relationship",
      "appraisal",
      "cognition",
      "language",
      "appraisal",
      "relationship"
    ]);
  });

  it("T3+T34: a CLARIFY turn skips language truthfully and never pre-promises it", async () => {
    const harness = await buildHarness(makeTempDir(), { cognition: "CLARIFY", relationship: true });
    await harness.session.handleLine("Ambiguous message.");
    const text = output(harness.lines);
    expect(text).toContain("up to 3 reply stages");
    expect(text).not.toContain("[reply 3/3 language] running...");
    expect(text).not.toContain("Noted.");
    expect(harness.order).toEqual(["appraisal", "cognition", "relationship"]);
    expect(text).toContain("skipped: LANGUAGE");
    expect(text).toContain("Prog > ");
    harness.lines.length = 0;
    await harness.session.handleLine("/diagnostics");
    const diagnosticsText = output(harness.lines);
    expect(diagnosticsText).toContain("LANGUAGE: SKIPPED latency=n/a — no language call (NOT_REQUIRED_CLARIFY)");
    expect(diagnosticsText).toContain("skipped=LANGUAGE");
  });

  it("T6: a timeout halts progress at the failed stage and preserves the failure summary", async () => {
    const harness = await buildHarness(makeTempDir(), { cognition: "TIMEOUT", relationship: true });
    await harness.session.handleLine("This will time out.");
    const text = output(harness.lines);
    expect(text).toContain("[reply 2/3 cognition] failed (2.0 s): PROVIDER_TIMEOUT");
    // No nonexistent later steps are displayed.
    expect(text).not.toContain("[reply 3/3 language]");
    expect(text).not.toContain("[adaptation");
    expect(text).not.toContain("Noted.");
    expect(text).not.toContain("Turn completed in");
    expect(text).toContain("Turn failed during: COGNITION");
    expect(text).toContain("PROVIDER_TIMEOUT");
    expect(text).toContain("Subject persistence:");
    expect(harness.order).toEqual(["appraisal", "cognition"]);
    // Post-failure progress state is clean and still truthful in /diagnostics.
    harness.lines.length = 0;
    await harness.session.handleLine("/diagnostics");
    expect(output(harness.lines)).toContain("Last turn timing: status=FAILED");
    expect(output(harness.lines)).toContain("COGNITION: FAILED");
    // A hard provider failure marks the runtime failed: a new message is refused
    // (relaunch required), so no misleading new turn progress is shown.
    harness.lines.length = 0;
    await harness.session.handleLine("Retry the message.");
    expect(output(harness.lines)).toContain("The runtime is in a failed state");
    expect(output(harness.lines)).not.toContain("Turn: up to 3 reply stages");
  });

  it("T6: provider unavailable and malformed output also stop at cognition", async () => {
    const unavailable = await buildHarness(makeTempDir(), { cognition: "UNAVAILABLE" });
    await unavailable.session.handleLine("Fail.");
    expect(output(unavailable.lines)).toContain("[reply 2/3 cognition] failed (2.0 s): PROVIDER_UNAVAILABLE");
    expect(output(unavailable.lines)).toContain("Turn failed during: COGNITION");

    const malformed = await buildHarness(makeTempDir(), { cognition: "MALFORMED" });
    await malformed.session.handleLine("Fail.");
    expect(output(malformed.lines)).toContain("Turn failed during: COGNITION");
    expect(output(malformed.lines)).not.toContain("Turn completed in");
  });

  it("T3: disabled optional stages are DISABLED, excluded from the plan, and never false pending work", async () => {
    const harness = await buildHarness(makeTempDir());
    await harness.session.handleLine("A normal turn.");
    const text = output(harness.lines);
    expect(text).toContain("Turn: up to 3 reply stages (language skipped when cognition clarifies) |");
    expect(text).not.toContain("+ optional adaptation");
    expect(text).not.toContain("[adaptation");
    harness.lines.length = 0;
    await harness.session.handleLine("/diagnostics");
    const diagnosticsText = output(harness.lines);
    expect(diagnosticsText).toContain("PERSONALITY_ADAPTATION: DISABLED (not configured)");
    expect(diagnosticsText).toContain("RELATIONSHIP_ADAPTATION: DISABLED (not configured)");
    expect(diagnosticsText).not.toContain("PERSONALITY_ADAPTATION: last");
  });

  it("T23: debug mode adds the plan/model/timeout without any prompt or Memory payload", async () => {
    const harness = await buildHarness(makeTempDir(), { debug: true });
    await harness.session.handleLine("Secret user text should not appear in debug progress.");
    const text = output(harness.lines);
    expect(text).toContain("[debug] turn plan reply=APPRAISAL,COGNITION,LANGUAGE");
    expect(text).toContain("[debug] model=fake timeout=120000 ms provider=OLLAMA_NATIVE");
    expect(text).not.toContain("Secret user text should not appear");
  });

  it("T7+T8/§48: provider order and canonical outcome are identical with and without progress observability", async () => {
    const withDiagnostics = await buildHarness(makeTempDir(), { relationship: true });
    const withoutDiagnostics = await buildHarness(makeTempDir(), { relationship: true, withDiagnostics: false });
    const a = await withDiagnostics.session.handleLine("Identical message.");
    const b = await withoutDiagnostics.session.handleLine("Identical message.");
    expect(a.kind).toBe("HANDLED");
    expect(b.kind).toBe("HANDLED");

    const outcomeA = await withDiagnostics.host.status();
    const outcomeB = await withoutDiagnostics.host.status();
    expect(outcomeA.state_revision).toBe(outcomeB.state_revision);
    expect(outcomeA.repository_revision).toBe(outcomeB.repository_revision);
    expect(outcomeA.logical_time).toBe(outcomeB.logical_time);
    expect(outcomeA.completed_turns).toBe(outcomeB.completed_turns);
    // Same calls, same order, no retries; adaptation behavior identical.
    expect(withDiagnostics.order).toEqual(withoutDiagnostics.order);
    expect(withDiagnostics.order).toEqual(["appraisal", "cognition", "language", "relationship"]);
    expect(withDiagnostics.diagnostics.last("RELATIONSHIP_ADAPTATION").status).toBe("OK");

    const memoryA = await withDiagnostics.host.livedMemory({ limit: 100 });
    const memoryB = await withoutDiagnostics.host.livedMemory({ limit: 100 });
    expect(memoryA.total_episode_count).toBe(memoryB.total_episode_count);
    expect(memoryA.entries.length).toBe(memoryB.entries.length);
    // Only product output differs: the progress lines exist only with diagnostics.
    expect(output(withDiagnostics.lines)).toContain("Turn: up to 3 reply stages");
    expect(output(withoutDiagnostics.lines)).not.toContain("Turn: up to 3 reply stages");
  });
});
