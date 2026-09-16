/* eslint-disable no-restricted-imports -- Research harness: imports frozen built production roots by relative dist path. */
/**
 * BELIEF_CAUSAL_CONFIRMATORY_STOCHASTIC_V1 — calibration harness tests.
 *
 * ALL tests use MOCK transports: zero real network calls, zero credentials, zero
 * model calls. They pin the frozen calibration laws before any scientific call:
 * request determinism, retry byte identity, no-retry-on-schema-invalid, the
 * 48/50 RUN and 47/50 STOP boundaries, outcome-diversity freedom, deterministic
 * early stop, request/config/schema/code-state drift, secret safety and the
 * absence of any primary-execution path.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA } from "../../../packages/runtime/dist/index.js";
import { auditScanSurface } from "./scan-surface.ts";
import { buildCalibrationRequest, type CalibrationRequest } from "./calibration-request.ts";
import {
  CALIBRATION_MAXIMUM_NON_HOST_VALID_COUNT,
  CALIBRATION_MINIMUM_HOST_VALID_COUNT,
  CALIBRATION_SCHEDULED_LOGICAL_TRIALS,
  evaluateCalibrationLaw
} from "./calibration-law.ts";
import { runCalibration } from "./calibration-runner.ts";
import type { MinimalTransport, TransportResult } from "./calibration-transport.ts";
import { hashJson, hashText } from "./histories.ts";
import { modelConfigManifest } from "./contract.ts";

const REPO_ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "..");
const EXPERIMENT_DIR = "research/experiments/belief-causal-confirmatory-stochastic-v1";
const SCAN_SURFACE = auditScanSurface(hashJson(CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA)).exact_scan_surface;
const CODE_STATE = "sha256:" + "a".repeat(64);
/** Filled in by the first request fixture; the mock needs the advertised handles. */
let USER_TEXT = "";

/** The V8 path cites ADVERTISED HANDLES; the mock derives them from the rendered request. */
function handleForObservation(userText: string): string | null {
  const handlePattern = new RegExp("^-\\s*([FC][0-9]+):\\s*(\\S+)\\s*$");
  for (const line of userText.split("\n")) {
    const match = handlePattern.exec(line.trim());
    if (match !== null && (match[2] ?? "").startsWith("observation:")) return match[1] ?? null;
    if (match !== null && (match[2] ?? "").startsWith("source:")) return match[1] ?? null;
  }
  return null;
}

function validProposalJson(
  directive: "REALIZE_CURRENT_INTENT" | "CLARIFY_MISSING_CONTEXT" = "REALIZE_CURRENT_INTENT",
  observationHandle: string | null = null
): string {
  return JSON.stringify({
    schema_version: "conversation-cognition-proposal-v8",
    response_semantics:
      directive === "CLARIFY_MISSING_CONTEXT"
        ? { kind: "PRIMARY_CLARIFICATION" }
        : { kind: "PRIMARY_CONVERSATIONAL_ACT", act: "ACKNOWLEDGE" },
    factual_assessment: { claims: [] },
    cognition: {
      schema_version: "cognition-proposal-v0",
      reasoning_summary: "calibration mock cognition",
      relevant_memory_handles: [],
      considered_handles: directive === "CLARIFY_MISSING_CONTEXT" && observationHandle !== null ? [observationHandle] : [],
      current_intent: "respond to the user",
      confidence: 0.5,
      uncertainty: 0.5,
      action_intent: null,
      evidence_handles: []
    },
    subjective_selection: { kind: "NO_SUBJECTIVE_SELECTION" },
    communication_directive: { kind: directive },
    clarification_basis:
      directive === "CLARIFY_MISSING_CONTEXT"
        ? { current_observation_ref: "observation:o-source-event-bcv1-current-scene-1", missing_information: "the passage state", needed_for: "planning" }
        : null
  });
}

interface MockOptions {
  readonly script?: readonly ("VALID_REALIZE" | "VALID_CLARIFY" | "SCHEMA_INVALID" | "TRANSPORT_FAIL")[];
  readonly defaultOutcome?: "VALID_REALIZE" | "VALID_CLARIFY" | "SCHEMA_INVALID" | "TRANSPORT_FAIL";
  readonly modelId?: string;
  readonly extraAttemptsForFirstTrial?: number;
  /** The rendered user message, so the mock can cite the handles the prompt advertises. */
  readonly userText?: string;
}

function mockTransport(options: MockOptions = {}): { readonly transport: MinimalTransport; attempts(): number } {
  const observationHandle = options.userText === undefined ? null : handleForObservation(options.userText);
  let calls = 0;
  let attempts = 0;
  return {
    transport: {
      id: "MOCK",
      async complete(_body: unknown, bodyHash: string) {
        const index = calls;
        calls += 1;
        const outcome = options.script?.[index] ?? options.defaultOutcome ?? "VALID_REALIZE";
        const makeAttempt = (attempt: number, failure: string | null): { attempt: number; http_status: number | null; failure_class: string | null; elapsed_ms: number; body_hash: string } => ({
          attempt,
          http_status: failure === null ? 200 : null,
          failure_class: failure,
          elapsed_ms: 1,
          body_hash: bodyHash
        });
        const attemptList = [makeAttempt(1, null)];
        for (let extra = 0; extra < (options.extraAttemptsForFirstTrial ?? 0) && index === 0; extra += 1) {
          attemptList.unshift(makeAttempt(1, "TRANSPORT_RESET"));
        }
        attempts += attemptList.length;
        if (outcome === "TRANSPORT_FAIL") {
          return { ok: false, code: "TRANSPORT_RESET", detail: "mock transport failure", attempts: attemptList };
        }
        const content =
          outcome === "SCHEMA_INVALID"
            ? "{ not valid json"
            : validProposalJson(
                outcome === "VALID_CLARIFY" ? "CLARIFY_MISSING_CONTEXT" : "REALIZE_CURRENT_INTENT",
                observationHandle
              );
        const result: TransportResult = {
          ok: true,
          content,
          model: options.modelId ?? "deepseek-flash",
          usage: { prompt_tokens: 4400, completion_tokens: 3000, total_tokens: 7400, cached_tokens: 0, reasoning_tokens: 1200 },
          attempts: attemptList
        };
        return result;
      }
    },
    attempts: () => attempts
  };
}

const CLEAN_INTEGRITY = {
  prereg_sha_match: true,
  manifest_valid: true,
  design_rederivation: true,
  tracked_tree_clean: true,
  secret_safety_clean: true,
  no_production_write: true
} as const;

async function fixtureRequest(): Promise<CalibrationRequest> {
  const request = await buildCalibrationRequest({
    schemaHash: hashJson(CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA),
    modelConfigHash: hashJson(modelConfigManifest())
  });
  if (USER_TEXT.length === 0) USER_TEXT = request.body.messages[1]?.content ?? "";
  return request;
}

describe("CALIBRATION — request determinism and byte identity", () => {
  it("TEST_REQUEST_DETERMINISM: 100 consecutive builds share ONE model-facing request hash", async () => {
    const schemaHash = hashJson(CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA);
    const modelConfigHash = hashJson(modelConfigManifest());
    const hashes = new Set<string>();
    for (let index = 0; index < 100; index += 1) {
      const request = await buildCalibrationRequest({ schemaHash, modelConfigHash });
      hashes.add(request.hashes.model_facing_request_hash);
    }
    expect(hashes.size).toBe(1);
  });

  it("the request body contains no host identity and no secret", async () => {
    const request = await fixtureRequest();
    const serialized = JSON.stringify(request);
    const bodyText = JSON.stringify(request.body);
    for (const forbidden of ["trial", "timestamp", "nonce", "replicate", "run_id", "CALIBRATION|", "authorization", "sk-"]) {
      expect(bodyText.toLowerCase().includes(forbidden.toLowerCase()), forbidden).toBe(false);
    }
    expect(serialized).not.toMatch(/sk-[A-Za-z0-9]{8,}/);
    expect(Object.keys(request.body).sort()).toEqual(["max_tokens", "messages", "model", "response_format", "stream", "temperature"]);
    expect(request.body.model).toBe("deepseek-flash");
    expect(request.body.temperature).toBe(0);
    expect(request.body.stream).toBe(false);
    expect(request.body.response_format).toEqual({ type: "json_object" });
  });

  it("REQUEST_HASH_SCOPE covers every model-visible field and excludes host-only ones", async () => {
    const request = await fixtureRequest();
    const bodyHash = request.hashes.model_facing_request_hash;
    const mutatedModel = hashText(JSON.stringify({ ...request.body, model: "other-model" }));
    const mutatedTemp = hashText(JSON.stringify({ ...request.body, temperature: 0.5 }));
    const mutatedUser = hashText(JSON.stringify({ ...request.body, messages: [request.body.messages[0], { role: "user", content: "x" }] }));
    expect(bodyHash).not.toBe(mutatedModel);
    expect(bodyHash).not.toBe(mutatedTemp);
    expect(bodyHash).not.toBe(mutatedUser);
  });
});

describe("CALIBRATION — retry law and invalid trials", () => {
  it("TEST_RETRY_BYTE_IDENTITY: transport retries reuse the identical body", async () => {
    const request = await fixtureRequest();
    const mock = mockTransport({ userText: USER_TEXT, extraAttemptsForFirstTrial: 1, defaultOutcome: "VALID_REALIZE"  });
    const run = await runCalibration(
      { transport: mock.transport, request, readCodeState: () => CODE_STATE, integrity: CLEAN_INTEGRITY, maxTrials: 3 },
      { scanSurface: SCAN_SURFACE }
    );
    expect(run.aggregates.request_hash_unique_count).toBe(1);
    expect(run.integrity.retry_legality).toBe(true);
    expect(run.trials[0]?.raw_attempts).toBe(2);
    expect(run.aggregates.retries).toBe(1);
  });

  it("TEST_SCHEMA_INVALID_NO_RETRY: an invalid response consumes exactly ONE attempt and is never retried", async () => {
    const request = await fixtureRequest();
    const mock = mockTransport({ userText: USER_TEXT, script: ["SCHEMA_INVALID", "VALID_REALIZE", "VALID_REALIZE", "VALID_REALIZE"], defaultOutcome: "VALID_REALIZE"  });
    const run = await runCalibration(
      { transport: mock.transport, request, readCodeState: () => CODE_STATE, integrity: CLEAN_INTEGRITY, maxTrials: 4 },
      { scanSurface: SCAN_SURFACE }
    );
    expect(run.trials[0]?.host_valid).toBe(false);
    expect(run.trials[0]?.schema_valid).toBe(false);
    expect(run.trials[0]?.raw_attempts).toBe(1);
    expect(run.trials.filter((trial) => trial.host_valid).length).toBe(3);
  });

  it("TEST_TRANSPORT_FAILURE_IS_NON_HOST_VALID and never replaced", async () => {
    const request = await fixtureRequest();
    const mock = mockTransport({ userText: USER_TEXT, script: ["TRANSPORT_FAIL", "VALID_REALIZE", "VALID_REALIZE", "VALID_REALIZE"], defaultOutcome: "VALID_REALIZE"  });
    const run = await runCalibration(
      { transport: mock.transport, request, readCodeState: () => CODE_STATE, integrity: CLEAN_INTEGRITY, maxTrials: 4 },
      { scanSurface: SCAN_SURFACE }
    );
    expect(run.aggregates.transport_failures).toBe(1);
    expect(run.aggregates.planned).toBe(4);
    expect(run.aggregates.executed).toBe(4);
  });
});

describe("CALIBRATION — RUN/STOP law boundaries", () => {
  it("TEST_48_50_RUN: 48 host-valid of 50 scheduled is EXECUTOR_CALIBRATION_RUN", () => {
    const decision = evaluateCalibrationLaw({
      scheduled_trials: CALIBRATION_SCHEDULED_LOGICAL_TRIALS,
      executed_trials: CALIBRATION_SCHEDULED_LOGICAL_TRIALS,
      host_valid_count: 48,
      non_host_valid_count: 2,
      integrity_gates: { ALL: true },
      early_stopped: false
    });
    expect(decision.decision).toBe("EXECUTOR_CALIBRATION_RUN");
  });

  it("TEST_47_50_STOP: 47 host-valid of 50 is EXECUTOR_CALIBRATION_STOP", () => {
    const decision = evaluateCalibrationLaw({
      scheduled_trials: CALIBRATION_SCHEDULED_LOGICAL_TRIALS,
      executed_trials: CALIBRATION_SCHEDULED_LOGICAL_TRIALS,
      host_valid_count: 47,
      non_host_valid_count: 3,
      integrity_gates: { ALL: true },
      early_stopped: false
    });
    expect(decision.decision).toBe("EXECUTOR_CALIBRATION_STOP");
  });

  it("the 48/50 threshold is the frozen 0.95 floor discretized (not an invented number)", () => {
    expect(CALIBRATION_MINIMUM_HOST_VALID_COUNT).toBe(48);
    expect(CALIBRATION_MAXIMUM_NON_HOST_VALID_COUNT).toBe(2);
    expect(Math.ceil(50 * 0.95)).toBe(48);
    expect(47 / 50).toBeLessThan(0.95);
    expect(48 / 50).toBeGreaterThan(0.95);
  });

  it("any integrity-gate failure forces STOP regardless of host validity", () => {
    const decision = evaluateCalibrationLaw({
      scheduled_trials: 50,
      executed_trials: 50,
      host_valid_count: 50,
      non_host_valid_count: 0,
      integrity_gates: { REQUEST_HASH_IDENTITY: false },
      early_stopped: false
    });
    expect(decision.decision).toBe("EXECUTOR_CALIBRATION_STOP");
    expect(decision.failed_integrity_gates).toContain("REQUEST_HASH_IDENTITY");
  });
});

describe("CALIBRATION — no outcome-diversity gate", () => {
  it("TEST_50_50_REALIZE_RUN: 50 host-valid REALIZE outcomes are RUN", async () => {
    const request = await fixtureRequest();
    const mock = mockTransport({ userText: USER_TEXT, defaultOutcome: "VALID_REALIZE"  });
    const run = await runCalibration(
      { transport: mock.transport, request, readCodeState: () => CODE_STATE, integrity: CLEAN_INTEGRITY },
      { scanSurface: SCAN_SURFACE }
    );
    expect(run.aggregates.host_valid).toBe(50);
    expect(run.aggregates.realize_count).toBe(50);
    expect(run.decision.decision).toBe("EXECUTOR_CALIBRATION_RUN");
  });

  it("TEST_50_50_CLARIFY_RUN: 50 host-valid CLARIFY outcomes are RUN", async () => {
    const request = await fixtureRequest();
    const mock = mockTransport({ userText: USER_TEXT, defaultOutcome: "VALID_CLARIFY"  });
    const run = await runCalibration(
      { transport: mock.transport, request, readCodeState: () => CODE_STATE, integrity: CLEAN_INTEGRITY },
      { scanSurface: SCAN_SURFACE }
    );
    expect(run.aggregates.host_valid).toBe(50);
    expect(run.aggregates.clarify_count).toBe(50);
    expect(run.decision.decision).toBe("EXECUTOR_CALIBRATION_RUN");
  });

  it("stochasticity and conflation flags are diagnostics only (no gate depends on them)", async () => {
    const request = await fixtureRequest();
    const mock = mockTransport({ userText: USER_TEXT, defaultOutcome: "VALID_REALIZE"  });
    const run = await runCalibration(
      { transport: mock.transport, request, readCodeState: () => CODE_STATE, integrity: CLEAN_INTEGRITY, maxTrials: 5 },
      { scanSurface: SCAN_SURFACE }
    );
    const lawText = readFileSync(join(REPO_ROOT, EXPERIMENT_DIR, "calibration-law.ts"), "utf8");
    expect(lawText).toContain("outcome_diversity_gate: \"NONE\"");
    expect(lawText).toContain("stochasticity_role: \"DIAGNOSTIC_ONLY\"");
    expect(lawText).toContain("truth_conflation_role: \"DIAGNOSTIC_ONLY\"");
    expect(Object.keys(run.integrity.gates)).not.toContain("OUTCOME_DIVERSITY");
  });
});

describe("CALIBRATION — early stop and drift gates", () => {
  it("TEST_EARLY_STOP: the third non-host-valid stops the run deterministically and leaves the rest unexecuted", async () => {
    const request = await fixtureRequest();
    const mock = mockTransport({ userText: USER_TEXT, script: ["SCHEMA_INVALID", "SCHEMA_INVALID", "SCHEMA_INVALID"], defaultOutcome: "VALID_REALIZE"  });
    const run = await runCalibration(
      { transport: mock.transport, request, readCodeState: () => CODE_STATE, integrity: CLEAN_INTEGRITY },
      { scanSurface: SCAN_SURFACE }
    );
    expect(run.trials.length).toBe(3);
    expect(run.early_stopped).toBe(true);
    expect(run.decision.decision).toBe("EXECUTOR_CALIBRATION_STOP_EARLY");
    expect(mock.attempts()).toBe(3);
  });

  it("TEST_REQUEST_DRIFT: a different body hash across trials fails the identity gate", async () => {
    const request = await fixtureRequest();
    let calls = 0;
    const drifting: MinimalTransport = {
      id: "MOCK",
      async complete(_body: unknown, bodyHash: string) {
        calls += 1;
        const hash = calls === 2 ? hashText(`${bodyHash}-drift`) : bodyHash;
        return {
          ok: true,
          content: validProposalJson("REALIZE_CURRENT_INTENT"),
          model: "deepseek-flash",
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, cached_tokens: 0, reasoning_tokens: 0 },
          attempts: [{ attempt: 1, http_status: 200, failure_class: null, elapsed_ms: 1, body_hash: hash }]
        };
      }
    };
    const run = await runCalibration(
      { transport: drifting, request, readCodeState: () => CODE_STATE, integrity: CLEAN_INTEGRITY, maxTrials: 3 },
      { scanSurface: SCAN_SURFACE }
    );
    expect(run.integrity.request_hash_identity).toBe(false);
    expect(run.decision.decision).toBe("EXECUTOR_CALIBRATION_STOP");
    expect(run.decision.failed_integrity_gates).toContain("REQUEST_HASH_IDENTITY");
  });

  it("TEST_CONFIG_DRIFT: a mid-run model-id change fails the model identity gate", async () => {
    const request = await fixtureRequest();
    let calls = 0;
    const drifting: MinimalTransport = {
      id: "MOCK",
      async complete(_body: unknown, bodyHash: string) {
        calls += 1;
        return {
          ok: true,
          content: validProposalJson("REALIZE_CURRENT_INTENT"),
          model: calls === 3 ? "another-model" : "deepseek-flash",
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, cached_tokens: 0, reasoning_tokens: 0 },
          attempts: [{ attempt: 1, http_status: 200, failure_class: null, elapsed_ms: 1, body_hash: bodyHash }]
        };
      }
    };
    const run = await runCalibration(
      { transport: drifting, request, readCodeState: () => CODE_STATE, integrity: CLEAN_INTEGRITY, maxTrials: 4 },
      { scanSurface: SCAN_SURFACE }
    );
    expect(run.integrity.model_identity).toBe(false);
    expect(run.aggregates.model_id_unique_count).toBeGreaterThan(1);
    expect(run.decision.decision).toBe("EXECUTOR_CALIBRATION_STOP");
  });

  it("TEST_CODE_STATE_DRIFT: a HEAD/tree change during the run stops further authorization", async () => {
    const request = await fixtureRequest();
    const mock = mockTransport({ userText: USER_TEXT, defaultOutcome: "VALID_REALIZE"  });
    let reads = 0;
    const run = await runCalibration(
      {
        transport: mock.transport,
        request,
        readCodeState: () => {
          reads += 1;
          return reads <= 1 ? CODE_STATE : `${CODE_STATE}-mutated`;
        },
        integrity: CLEAN_INTEGRITY,
        maxTrials: 4
      },
      { scanSurface: SCAN_SURFACE }
    );
    expect(run.integrity.code_state_before).not.toBe(run.integrity.code_state_after);
    expect(run.decision.decision).toBe("EXECUTOR_CALIBRATION_STOP");
    expect(run.decision.failed_integrity_gates).toContain("TRACKED_TREE_CLEAN");
  });

  it("TEST_SECRET_SAFETY: the frozen body and evidence schema carry no credential surface", async () => {
    const request = await fixtureRequest();
    const blockComments = new RegExp("/\\*[\\s\\S]*?\\*/", "g");
    const lineComments = new RegExp("^\\s*//.*$", "gm");
    const stripComments = (source: string): string => source.replace(blockComments, "").replace(lineComments, "");
    const evidenceCode = stripComments(readFileSync(join(REPO_ROOT, EXPERIMENT_DIR, "calibration-evidence.ts"), "utf8"));
    const transportCode = stripComments(readFileSync(join(REPO_ROOT, EXPERIMENT_DIR, "calibration-transport.ts"), "utf8"));
    expect(JSON.stringify(request)).not.toMatch(/authorization/i);
    // The credential appears in CODE only in the HTTP header construction.
    expect(transportCode).toContain("authorization: `Bearer ${apiKey}`");
    expect(evidenceCode).not.toMatch(/apiKey|api_key|MODEL_API_KEY|authorization/i);
    expect(evidenceCode).not.toMatch(/sk-/);
    expect(evidenceCode).not.toMatch(new RegExp("fetch\\("));
  });

  it("TEST_NO_PRIMARY_PATH: the calibration harness contains no primary execution path or cell identity", () => {
    for (const file of ["calibration-runner.ts", "calibration-request.ts", "calibration-law.ts", "calibration-transport.ts", "calibration-evidence.ts"]) {
      const source = readFileSync(join(REPO_ROOT, EXPERIMENT_DIR, file), "utf8");
      for (const forbidden of ["A_LOW", "B_HIGH", "C_HIGH_ABLATED", "D_LOW_EQUALIZED", "trialSchedule", "runScene", "restoreBranch", "buildBranch", "PRIMARY", "REPLICATION"]) {
        expect(source.includes(forbidden), `${file} must not reference ${forbidden}`).toBe(false);
      }
      expect(source).not.toMatch(/commitReserved|reserveAndRoute|BeliefTransitionExecutor|terminalizeReservedNoOp/);
    }
  });
});
