/**
 * APPRAISAL_EXACT_INPUT_REUSE_PRODUCTION_V0 — production acceptance P1–P8.
 *
 * Deterministic: fake transports (0 real provider calls), fixed clock, real
 * runtime/host/provider/lifecycle. Verifies exact-request-only reuse, one
 * inference for two semantic Appraisals, independent event authority, scope
 * firewalls, failure truth, canonical equivalence OFF vs ON, observability and
 * rollback configuration.
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type {
  FactualEventAppraisalContextProjectionV0,
  ModelTransportRequestV0,
  ModelTransportResponseV0,
  ModelTransportV0
} from "@characteros-next/runtime";
import { ModelTransportErrorV0 } from "@characteros-next/runtime";
import { InteractiveSubjectHostV0, type InteractiveSubjectHostConfigV0 } from "./interactive-subject-host.js";
import { ProductCliSessionV0 } from "./product-cli-session.js";
import { createProductAppraisalProviderV0 } from "./product-appraisal-provider.js";
import {
  AppraisalInferenceReuseV0,
  appraisalProviderFingerprintV0,
  appraisalRequestIdentityV0,
  normalizedAppraisalValueV0
} from "./product-appraisal-reuse.js";
import { ProviderDiagnosticsV0, wrapTransportForStageV0 } from "./provider-diagnostics.js";
import { environmentFromRecordV0, resolveProductConfigurationV0 } from "./product-configuration.js";
import { createProductProviderBundleV0 } from "./product-provider-bundle.js";

const SUBJECT_ID = "reuse-subject";
const FIXED_CANDIDATE = {
  relevance: 0.6,
  goal_congruence: 0.5,
  attribution: "other",
  controllability: 0.5,
  uncertainty: 0.5,
  intensity: 0.4,
  assessment_confidence: 0.6
} as const;

const tempDirs: string[] = [];
function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "characteros-reuse-"));
  tempDirs.push(dir);
  return dir;
}
afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
  }
});

/** Minimal trusted appraisal context projection for provider-level tests. */
function appraisalContext(eventRef: string, scene: string): FactualEventAppraisalContextProjectionV0 {
  return {
    subject_id: SUBJECT_ID,
    factual_event_ref: eventRef,
    context_projection_hash: `sha256:${eventRef.length.toString(16).padStart(4, "0")}`,
    current_task: "Respond to the user's latest message.",
    current_observable_scene: scene
  } as unknown as FactualEventAppraisalContextProjectionV0;
}

function recordingAppraisalTransport(
  requests: ModelTransportRequestV0[],
  behaviour: "VALID" | "MALFORMED" | "THROW" | "NO_CONTENT" = "VALID"
): ModelTransportV0 {
  return {
    complete: async (request: ModelTransportRequestV0): Promise<ModelTransportResponseV0> => {
      requests.push(request);
      if (behaviour === "THROW") {
        throw new ModelTransportErrorV0("MODEL_CONNECTION_FAILURE", null, "connect ECONNREFUSED 127.0.0.1:11434");
      }
      if (behaviour === "NO_CONTENT") return { model: "fake" } as unknown as ModelTransportResponseV0;
      if (behaviour === "MALFORMED") {
        return { content: '{"relevance":0.5,"goal_conuence":0.4}', model: "fake" } as ModelTransportResponseV0;
      }
      return { content: JSON.stringify(FIXED_CANDIDATE), model: "fake" } as ModelTransportResponseV0;
    }
  } as ModelTransportV0;
}

// --- P1 / P3 / P4 / P5: provider-level reuse port -----------------------------

describe("APPRAISAL_EXACT_INPUT_REUSE_PRODUCTION_V0 — exact request identity", () => {
  function providerWithReuse(requests: ModelTransportRequestV0[], enabled = true) {
    const reuse = new AppraisalInferenceReuseV0(enabled, "fixture-fingerprint");
    const provider = createProductAppraisalProviderV0({
      transport: recordingAppraisalTransport(requests),
      reuse
    }).provider;
    return { reuse, provider };
  }

  it("P1+P2: an identical request reuses the candidate; a different request does not", async () => {
    const requests: ModelTransportRequestV0[] = [];
    const { reuse, provider } = providerWithReuse(requests);
    reuse.beginTurn({ subject_id: SUBJECT_ID, turn_index: 1 });

    const eventA = appraisalContext("event:aaa", 'The user says: "hello there"');
    const eventB = appraisalContext("event:bbb", 'The user says: "hello there"');
    const eventC = appraisalContext("event:ccc", 'The user says: "something else"');

    await provider.proposeFactualEventAppraisal(eventA as never);
    await provider.proposeFactualEventAppraisal(eventB as never);
    // Not identical (different observable scene) → a real second inference.
    await provider.proposeFactualEventAppraisal(eventC as never);

    // Only two real inferences were issued: event A and the DIFFERENT event C.
    // Event B produced no request because its complete request was identical to A.
    expect(requests.length).toBe(2);
    expect(normalizedAppraisalValueV0(requests[0]?.messages)).not.toBe(
      normalizedAppraisalValueV0(requests[1]?.messages)
    );
    const counters = reuse.counters();
    expect(counters.semantic_invocations).toBe(3);
    expect(counters.real_inferences).toBe(2);
    expect(counters.reuse_hits).toBe(1);
    expect(counters.reuse_misses).toBe(1);
    reuse.endTurn();
  });

  it("P3: every authority field of a reused proposal is rebuilt from event B", async () => {
    const requests: ModelTransportRequestV0[] = [];
    const { reuse, provider } = providerWithReuse(requests);
    reuse.beginTurn({ subject_id: SUBJECT_ID, turn_index: 1 });
    const eventA = appraisalContext("event:aaa", 'The user says: "same scene"');
    const eventB = appraisalContext("event:bbb", 'The user says: "same scene"');
    const first = (await provider.proposeFactualEventAppraisal(eventA as never)) as Record<string, unknown>;
    const second = (await provider.proposeFactualEventAppraisal(eventB as never)) as Record<string, unknown>;
    expect(requests.length).toBe(1);
    expect(first["factual_event_ref"]).toBe("event:aaa");
    expect(first["context_projection_hash"]).toBe(eventA.context_projection_hash);
    // B keeps its OWN event identity, context hash and evidence refs.
    expect(second["factual_event_ref"]).toBe("event:bbb");
    expect(second["context_projection_hash"]).toBe(eventB.context_projection_hash);
    expect(second["evidence_refs"]).toEqual(["event:bbb"]);
    expect(second["subject_id"]).toBe(SUBJECT_ID);
    expect(second["dimensions"]).toEqual(first["dimensions"]);
    reuse.endTurn();
  });

  it("P4: reuse is impossible across turns, outside a scope, or with a mismatched provider identity", async () => {
    const requests: ModelTransportRequestV0[] = [];
    const { reuse, provider } = providerWithReuse(requests);
    const eventA = appraisalContext("event:aaa", 'The user says: "same scene"');
    const eventB = appraisalContext("event:bbb", 'The user says: "same scene"');

    // Outside any turn scope: no reuse at all.
    await provider.proposeFactualEventAppraisal(eventA as never);
    await provider.proposeFactualEventAppraisal(eventB as never);
    expect(requests.length).toBe(2);
    expect(reuse.counters().reuse_hits).toBe(0);
    expect(reuse.counters().reuse_unavailable).toBe(2);

    // A later turn never inherits the previous turn's candidate.
    reuse.beginTurn({ subject_id: SUBJECT_ID, turn_index: 1 });
    await provider.proposeFactualEventAppraisal(eventA as never);
    reuse.endTurn();
    reuse.beginTurn({ subject_id: SUBJECT_ID, turn_index: 2 });
    await provider.proposeFactualEventAppraisal(eventB as never);
    expect(requests.length).toBe(4);
    expect(reuse.counters().reuse_hits).toBe(0);
    reuse.endTurn();

    // A different provider identity (and a fresh port) shares nothing.
    const otherRequests: ModelTransportRequestV0[] = [];
    const other = providerWithReuse(otherRequests);
    other.reuse.beginTurn({ subject_id: SUBJECT_ID, turn_index: 1 });
    await other.provider.proposeFactualEventAppraisal(eventA as never);
    await other.provider.proposeFactualEventAppraisal(eventB as never);
    expect(otherRequests.length).toBe(1);
    expect(reuse.counters().reuse_hits).toBe(0);
    expect(appraisalProviderFingerprintV0({
      endpoint: "http://127.0.0.1:11434",
      model: "a",
      timeout_ms: 1,
      num_predict: 1,
      context_window_tokens: 1,
      system_prompt: "p"
    })).not.toBe(appraisalProviderFingerprintV0({
      endpoint: "http://127.0.0.1:11434",
      model: "b",
      timeout_ms: 1,
      num_predict: 1,
      context_window_tokens: 1,
      system_prompt: "p"
    }));
    other.reuse.endTurn();
  });

  it("P1: request identity covers model-facing content, order and every option that would change inference", () => {
    const identity = appraisalRequestIdentityV0([
      { role: "system", content: "s" },
      { role: "user", content: "u" }
    ]);
    expect(appraisalRequestIdentityV0([
      { role: "system", content: "s" },
      { role: "user", content: "u" }
    ])).toBe(identity);
    // Message order and content are part of the identity.
    expect(appraisalRequestIdentityV0([
      { role: "user", content: "u" },
      { role: "system", content: "s" }
    ])).not.toBe(identity);
    expect(appraisalRequestIdentityV0([
      { role: "system", content: "s" },
      { role: "user", content: "u " }
    ])).not.toBe(identity);
  });

  it("P5: failed, malformed or contentless first inferences never populate reuse state", async () => {
    for (const behaviour of ["MALFORMED", "THROW", "NO_CONTENT"] as const) {
      const requests: ModelTransportRequestV0[] = [];
      const reuse = new AppraisalInferenceReuseV0(true, "fixture-fingerprint");
      const provider = createProductAppraisalProviderV0({
        transport: recordingAppraisalTransport(requests, behaviour),
        reuse
      }).provider;
      reuse.beginTurn({ subject_id: SUBJECT_ID, turn_index: 1 });
      await expect(
        provider.proposeFactualEventAppraisal(appraisalContext("event:aaa", 'The user says: "x"') as never)
      ).rejects.toThrow();
      const counters = reuse.counters();
      expect(counters.candidates_stored).toBe(0);
      expect(counters.reuse_hits).toBe(0);
      // The next identical event must still perform its own inference.
      await expect(
        provider.proposeFactualEventAppraisal(appraisalContext("event:bbb", 'The user says: "x"') as never)
      ).rejects.toThrow();
      expect(reuse.counters().reuse_hits).toBe(0);
      expect(requests.length).toBe(2);
      reuse.endTurn();
    }
  });

  it("P8: a disabled port performs the original independent-inference path", async () => {
    const requests: ModelTransportRequestV0[] = [];
    const { reuse, provider } = providerWithReuse(requests, false);
    reuse.beginTurn({ subject_id: SUBJECT_ID, turn_index: 1 });
    const scene = 'The user says: "same scene"';
    await provider.proposeFactualEventAppraisal(appraisalContext("event:aaa", scene) as never);
    await provider.proposeFactualEventAppraisal(appraisalContext("event:bbb", scene) as never);
    expect(requests.length).toBe(2);
    expect(reuse.counters().reuse_hits).toBe(0);
    reuse.endTurn();
  });
});

// --- P2 / P6 / P7: real turn lifecycle ----------------------------------------

type CognitionMode = "REALIZE" | "CLARIFY";

function cognitionTransport(mode: CognitionMode): ModelTransportV0 {
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
            reasoning_summary: "offline",
            relevant_memory_refs: [],
            considered_context_refs: [],
            current_intent: "respond",
            confidence: 0.7,
            uncertainty: 0.3,
            action_intent: null,
            evidence_refs: []
          },
          communication_directive: { kind: mode === "CLARIFY" ? "CLARIFY_MISSING_CONTEXT" : "REALIZE_CURRENT_INTENT" }
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

interface TurnHarness {
  readonly host: InteractiveSubjectHostV0;
  readonly session: ProductCliSessionV0;
  readonly reuse: AppraisalInferenceReuseV0;
  readonly requests: ModelTransportRequestV0[];
  readonly lines: string[];
  readonly diagnostics: ProviderDiagnosticsV0;
}

async function buildTurnHarness(
  dir: string,
  input: { readonly enabled: boolean; readonly cognition?: CognitionMode; readonly sessionLabel?: string }
): Promise<TurnHarness> {
  const requests: ModelTransportRequestV0[] = [];
  const lines: string[] = [];
  let clock = 0;
  const diagnostics = new ProviderDiagnosticsV0({
    write: (line) => lines.push(line),
    now: () => (clock += 1000),
    model: "fake",
    timeout_ms: 120000,
    debug: false
  });
  const reuse = new AppraisalInferenceReuseV0(
    input.enabled,
    "fixture-fingerprint",
    () => diagnostics.noteReused("APPRAISAL")
  );
  const appraisal = createProductAppraisalProviderV0({
    transport: wrapTransportForStageV0(recordingAppraisalTransport(requests), "APPRAISAL", diagnostics),
    reuse
  });
  const hostConfig: InteractiveSubjectHostConfigV0 = {
    subject_id: SUBJECT_ID,
    display_name: "Reuse",
    session_id: input.sessionLabel ?? "sess-reuse",
    storage_root: dir,
    interval_ticks: 1
  };
  const host = await InteractiveSubjectHostV0.open(hostConfig, {
    conversationCognitionTransport: wrapTransportForStageV0(cognitionTransport(input.cognition ?? "REALIZE"), "COGNITION", diagnostics),
    languageTransport: wrapTransportForStageV0(languageTransport(), "LANGUAGE", diagnostics),
    appraisalProvider: appraisal.provider,
    provider_identity: { model: "fake", num_predict: 256 },
    clock: () => "2026-01-01T00:00:00.000Z"
  });
  const session = new ProductCliSessionV0({
    host,
    diagnostics,
    appraisalReuse: reuse,
    turnPlan: {
      belief_adaptation_enabled: false,
      relationship_adaptation_enabled: false,
      personality_adaptation_enabled: false
    },
    subjectLabel: "Reuse",
    model: "fake",
    providerLabel: "FAKE",
    contextWindowTokens: 8192,
    maxOutputTokens: 2048,
    debug: false,
    write: (line) => lines.push(line)
  });
  return { host, session, reuse, requests, lines, diagnostics };
}

describe("APPRAISAL_EXACT_INPUT_REUSE_PRODUCTION_V0 — real turn lifecycle", () => {
  it("P2: an eligible later turn performs 2 semantic Appraisals with 1 real inference", async () => {
    const harness = await buildTurnHarness(makeTempDir(), { enabled: true });
    await harness.session.handleLine("First message.");
    const afterFirst = harness.reuse.counters();
    // Turn 1 has a single primary event: no reuse opportunity.
    expect(afterFirst.semantic_invocations).toBe(1);
    expect(afterFirst.real_inferences).toBe(1);
    expect(afterFirst.reuse_hits).toBe(0);

    const beforeSecondTurn = harness.requests.length;
    await harness.session.handleLine("Second message closes the previous reply.");
    const counters = harness.reuse.counters();
    // Turn 2: current-primary Appraisal + prior-reply Appraisal.
    expect(counters.semantic_invocations - afterFirst.semantic_invocations).toBe(2);
    expect(counters.real_inferences - afterFirst.real_inferences).toBe(1);
    expect(counters.reuse_hits).toBe(1);
    expect(harness.requests.length - beforeSecondTurn).toBe(1);
    // Both events still get their own semantic invocation, and the reused one is
    // labelled truthfully instead of faking a transport call.
    const text = harness.lines.join("\n");
    expect(text).toContain("inference reused (no model call)");
    expect(harness.diagnostics.last("APPRAISAL").status).toBe("REUSED");
    expect(harness.diagnostics.formatLines().join("\n")).toContain("APPRAISAL: REUSED (identical request; no model inference)");
    await harness.session.handleLine("/exit");
  });

  it("P2/P8: with reuse disabled both semantic Appraisals infer independently", async () => {
    const harness = await buildTurnHarness(makeTempDir(), { enabled: false });
    await harness.session.handleLine("First message.");
    const before = harness.requests.length;
    await harness.session.handleLine("Second message closes the previous reply.");
    expect(harness.requests.length - before).toBe(2);
    expect(harness.reuse.counters().reuse_hits).toBe(0);
    expect(harness.lines.join("\n")).not.toContain("inference reused");
    await harness.session.handleLine("/exit");
  });

  it("P6/§47/§48: canonical state, Memory and adaptation are equivalent OFF vs ON (REALIZE and CLARIFY)", async () => {
    for (const cognition of ["REALIZE", "CLARIFY"] as const) {
      const off = await buildTurnHarness(makeTempDir(), { enabled: false, cognition });
      const on = await buildTurnHarness(makeTempDir(), { enabled: true, cognition });
      for (const message of ["First message.", "Second message."]) {
        await off.session.handleLine(message);
        await on.session.handleLine(message);
      }
      const [offStatus, onStatus] = [await off.host.status(), await on.host.status()];
      expect(onStatus.state_revision).toBe(offStatus.state_revision);
      expect(onStatus.repository_revision).toBe(offStatus.repository_revision);
      expect(onStatus.logical_time).toBe(offStatus.logical_time);
      expect(onStatus.completed_turns).toBe(offStatus.completed_turns);
      expect(onStatus.affect).toEqual(offStatus.affect);
      const [offMemory, onMemory] = [await off.host.livedMemory({ limit: 50 }), await on.host.livedMemory({ limit: 50 })];
      expect(onMemory.total_episode_count).toBe(offMemory.total_episode_count);
      expect(JSON.stringify(onMemory.entries)).toBe(JSON.stringify(offMemory.entries));
      // Faithful replay: identical snapshots except the deliberate reuse label.
      const offSnapshot = await off.host.durableSnapshot();
      const onSnapshot = await on.host.durableSnapshot();
      expect(JSON.stringify(onSnapshot)).toBe(JSON.stringify(offSnapshot));
      // Reuse happened (ON) or not (OFF) without changing anything else.
      expect(on.reuse.counters().reuse_hits).toBe(1);
      expect(off.reuse.counters().reuse_hits).toBe(0);
      expect(on.requests.length).toBe(off.requests.length - 1);
      await off.session.handleLine("/exit");
      await on.session.handleLine("/exit");
    }
  });

  it("P7: /diagnostics separates semantic invocations, real inferences and reuse", async () => {
    const harness = await buildTurnHarness(makeTempDir(), { enabled: true });
    await harness.session.handleLine("First message.");
    await harness.session.handleLine("Second message.");
    harness.lines.length = 0;
    await harness.session.handleLine("/diagnostics");
    const text = harness.lines.join("\n");
    expect(text).toContain("Appraisal inference: reuse ON");
    expect(text).toContain("semantic invocations=3");
    expect(text).toContain("real inferences=2");
    expect(text).toContain("reuse hits=1");
    await harness.session.handleLine("/exit");
  });
});

// --- P8: rollout configuration ------------------------------------------------

describe("APPRAISAL_EXACT_INPUT_REUSE_PRODUCTION_V0 — rollout configuration", () => {
  it("P8: the switch is strictly validated, visible with its source, and defaults OFF", () => {
    const base = { environment: environmentFromRecordV0({}), default_data_root: "D:\\data" };
    const off = resolveProductConfigurationV0(base);
    expect(off.appraisal_exact_input_reuse.value).toBe(false);
    expect(off.appraisal_exact_input_reuse.source).toBe("DEFAULT");

    const on = resolveProductConfigurationV0({
      ...base,
      environment: environmentFromRecordV0({ CHARACTEROS_APPRAISAL_EXACT_INPUT_REUSE: "1" })
    });
    expect(on.appraisal_exact_input_reuse.value).toBe(true);
    expect(on.appraisal_exact_input_reuse.source).toBe("ENVIRONMENT");
    expect(on.appraisal_exact_input_reuse.origin).toBe("CHARACTEROS_APPRAISAL_EXACT_INPUT_REUSE");

    const explicitOff = resolveProductConfigurationV0({
      ...base,
      environment: environmentFromRecordV0({ CHARACTEROS_APPRAISAL_EXACT_INPUT_REUSE: "0" })
    });
    expect(explicitOff.appraisal_exact_input_reuse.value).toBe(false);
    expect(explicitOff.appraisal_exact_input_reuse.source).toBe("ENVIRONMENT");

    expect(() =>
      resolveProductConfigurationV0({
        ...base,
        environment: environmentFromRecordV0({ CHARACTEROS_APPRAISAL_EXACT_INPUT_REUSE: "true" })
      })
    ).toThrow(/CHARACTEROS_APPRAISAL_EXACT_INPUT_REUSE/);
    expect(() =>
      resolveProductConfigurationV0({
        ...base,
        environment: environmentFromRecordV0({ CHARACTEROS_APPRAISAL_EXACT_INPUT_REUSE: "2" })
      })
    ).toThrow(/0 or 1/);
  });

  it("P8: the provider bundle reflects the product switch and is inert when off", () => {
    const offBundle = createProductProviderBundleV0({
      configuration: resolveProductConfigurationV0({ environment: environmentFromRecordV0({}), default_data_root: "D:\\data" }),
      write: () => undefined
    });
    expect(offBundle.appraisalReuse.enabled).toBe(false);
    const onBundle = createProductProviderBundleV0({
      configuration: resolveProductConfigurationV0({
        environment: environmentFromRecordV0({ CHARACTEROS_APPRAISAL_EXACT_INPUT_REUSE: "1" }),
        default_data_root: "D:\\data"
      }),
      write: () => undefined
    });
    expect(onBundle.appraisalReuse.enabled).toBe(true);
    // Distinct bundles never share a port (cross-subject isolation by construction).
    expect(onBundle.appraisalReuse).not.toBe(offBundle.appraisalReuse);
  });
});
