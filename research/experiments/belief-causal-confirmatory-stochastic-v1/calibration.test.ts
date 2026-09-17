/* eslint-disable no-restricted-imports -- Research harness: imports frozen built production roots by relative dist path. */
/**
 * BELIEF_CAUSAL_CONFIRMATORY_STOCHASTIC_V1 — calibration harness tests.
 *
 * ALL tests use MOCK transports and a MOCK authority: zero real network calls,
 * zero credentials, zero model calls. They pin the frozen calibration laws before
 * any scientific call: request determinism and byte identity, the RUN/STOP
 * boundaries, outcome-diversity freedom, the deterministic early stop, the
 * pre-call drift stops, the authority refusals, the transport failure
 * classification, the formal CLI and the absence of any primary-execution path.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA } from "../../../packages/runtime/dist/index.js";
import { auditScanSurface } from "./scan-surface.ts";
import {
  authoritativeRequestHash,
  buildCalibrationRequest,
  FROZEN_CALIBRATION_REQUEST_HASH,
  modelFacingRequestHash,
  serializeAuthoritativeRequest
} from "./calibration-request.ts";
import {
  CALIBRATION_MAXIMUM_NON_HOST_VALID_COUNT,
  CALIBRATION_MINIMUM_HOST_VALID_COUNT,
  CALIBRATION_SCHEDULED_LOGICAL_TRIALS,
  evaluateCalibrationLaw
} from "./calibration-law.ts";
import { runCalibration } from "./calibration-runner.ts";
import { hashJson, hashText } from "./histories.ts";
import { modelConfigManifest } from "./contract.ts";
import {
  mockAuthority,
  mockTransport,
  realAuthoritativeRequest,
  validProposalJson,
  type MockOutcome
} from "./test-support.ts";

const REPO_ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "..");
const EXPERIMENT_DIR = "research/experiments/belief-causal-confirmatory-stochastic-v1";
const SCAN_SURFACE = auditScanSurface(hashJson(CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA)).exact_scan_surface;

async function fixture(): Promise<{ readonly userText: string }> {
  const request = await realAuthoritativeRequest();
  return { userText: request.body.messages[1]?.content ?? "" };
}

describe("CALIBRATION — request determinism and byte identity", () => {
  it("TEST_REQUEST_DETERMINISM_100X: 100 consecutive builds share ONE model-facing request hash", async () => {
    const schemaHash = hashJson(CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA);
    const modelConfigHash = hashJson(modelConfigManifest());
    const hashes = new Set<string>();
    for (let index = 0; index < 100; index += 1) {
      const request = await buildCalibrationRequest({ schemaHash, modelConfigHash });
      hashes.add(request.hashes.model_facing_request_hash);
    }
    expect(hashes.size).toBe(1);
    // CONTRACT PARITY REMEDIATION: the model-facing contract (schema + system
    // prompt) now advertises the bounds the validator always enforced, so the
    // authoritative request hash moved. The CONSUMED calibration hash is
    // unchanged historical fact and is asserted separately below.
    expect([...hashes][0]).toBe("sha256:79f1d679c6dcd9622f4f154055462ca540eed56680847499a3b4420971ac9c35");
    expect([...hashes][0]).not.toBe("sha256:db8d8993c63e6de476c4ddb28dff5c55d5716f8f1fb3cc23ccfcd841bc31f509");
  });

  it("the request body contains no host identity and no secret", async () => {
    const request = await buildCalibrationRequest({
      schemaHash: hashJson(CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA),
      modelConfigHash: hashJson(modelConfigManifest())
    });
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
    const request = await buildCalibrationRequest({
      schemaHash: hashJson(CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA),
      modelConfigHash: hashJson(modelConfigManifest())
    });
    const bodyHash = request.hashes.model_facing_request_hash;
    const mutatedModel = modelFacingRequestHash({ ...request.body, model: "other-model" });
    const mutatedTemp = modelFacingRequestHash({ ...request.body, temperature: 0.5 });
    const mutatedUser = modelFacingRequestHash({
      ...request.body,
      messages: [request.body.messages[0], { role: "user", content: "x" }] as never
    });
    expect(bodyHash).not.toBe(mutatedModel);
    expect(bodyHash).not.toBe(mutatedTemp);
    expect(bodyHash).not.toBe(mutatedUser);
  });
});

describe("CALIBRATION — retry law and invalid trials", () => {
  it("TEST_TRANSPORT_FAILURE_IS_NON_HOST_VALID and never replaced", async () => {
    const { userText } = await fixture();
    const authority = await mockAuthority();
    const mock = mockTransport({ userText, script: ["TRANSPORT_FAIL", "VALID_REALIZE", "VALID_REALIZE", "VALID_REALIZE"] });
    const run = await runCalibration({ transport: mock.transport, authority, maxTrials: 4 }, { scanSurface: SCAN_SURFACE });
    expect(run.aggregates.transport_failures).toBe(1);
    expect(run.aggregates.planned).toBe(4);
    expect(run.aggregates.executed).toBe(4);
    expect(run.trials[0]?.transport_failure).toBe("TRANSPORT_NETWORK_ERROR");
    expect(run.trials[0]?.transport_failure_class).toBe("NETWORK_ERROR");
  });

  it("TEST_SCHEMA_INVALID_NO_RETRY: an invalid response consumes exactly ONE attempt and is never retried", async () => {
    const { userText } = await fixture();
    const authority = await mockAuthority();
    const mock = mockTransport({ userText, script: ["SCHEMA_INVALID", "VALID_REALIZE", "VALID_REALIZE", "VALID_REALIZE"] });
    const run = await runCalibration({ transport: mock.transport, authority, maxTrials: 4 }, { scanSurface: SCAN_SURFACE });
    expect(run.trials[0]?.host_valid).toBe(false);
    expect(run.trials[0]?.schema_valid).toBe(false);
    expect(run.trials[0]?.content_json_valid).toBe(false);
    expect(run.trials[0]?.raw_attempts).toBe(1);
    expect(run.aggregates.retries).toBe(0);
    expect(run.trials.filter((trial) => trial.host_valid).length).toBe(3);
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

  it("TEST_48_50_RUN_END_TO_END: a real 50-trial run with 2 invalid draws is RUN", async () => {
    const { userText } = await fixture();
    const authority = await mockAuthority();
    const script: MockOutcome[] = ["SCHEMA_INVALID", "VALID_REALIZE", "SCHEMA_INVALID", ...Array<MockOutcome>(47).fill("VALID_REALIZE")];
    const mock = mockTransport({ userText, script, defaultOutcome: "VALID_REALIZE" });
    const run = await runCalibration({ transport: mock.transport, authority }, { scanSurface: SCAN_SURFACE });
    expect(run.aggregates.host_valid).toBe(48);
    expect(run.aggregates.non_host_valid).toBe(2);
    expect(run.decision.decision).toBe("EXECUTOR_CALIBRATION_RUN");
  });

  it("TEST_47_50_LAW: the frozen law calls 47/50 a STOP, and a LIVE 47/50 can only end as the deterministic early stop", async () => {
    // The law itself (fixture-free, deterministic):
    const decision = evaluateCalibrationLaw({
      scheduled_trials: CALIBRATION_SCHEDULED_LOGICAL_TRIALS,
      executed_trials: CALIBRATION_SCHEDULED_LOGICAL_TRIALS,
      host_valid_count: 47,
      non_host_valid_count: 3,
      integrity_gates: { ALL: true },
      early_stopped: false
    });
    expect(decision.decision).toBe("EXECUTOR_CALIBRATION_STOP");
    // Live, the third invalid draw makes the 48/50 floor unreachable, so the run
    // stops at that draw: both paths refuse RUN.
    const { userText } = await fixture();
    const authority = await mockAuthority();
    const script: MockOutcome[] = ["SCHEMA_INVALID", "SCHEMA_INVALID", "SCHEMA_INVALID"];
    const mock = mockTransport({ userText, script, defaultOutcome: "VALID_REALIZE" });
    const run = await runCalibration({ transport: mock.transport, authority }, { scanSurface: SCAN_SURFACE });
    expect(run.aggregates.planned).toBe(50);
    expect(run.aggregates.executed).toBe(3);
    expect(run.decision.decision).toBe("EXECUTOR_CALIBRATION_STOP_EARLY");
    expect(run.decision.decision.startsWith("EXECUTOR_CALIBRATION_STOP")).toBe(true);
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
    const { userText } = await fixture();
    const authority = await mockAuthority();
    const mock = mockTransport({ userText, defaultOutcome: "VALID_REALIZE" });
    const run = await runCalibration({ transport: mock.transport, authority }, { scanSurface: SCAN_SURFACE });
    expect(run.aggregates.host_valid).toBe(50);
    expect(run.aggregates.realize_count).toBe(50);
    expect(run.decision.decision).toBe("EXECUTOR_CALIBRATION_RUN");
    expect(mock.calls()).toBe(50);
  });

  it("TEST_50_50_CLARIFY_RUN: 50 host-valid CLARIFY outcomes are RUN", async () => {
    const { userText } = await fixture();
    const authority = await mockAuthority();
    const mock = mockTransport({ userText, defaultOutcome: "VALID_CLARIFY" });
    const run = await runCalibration({ transport: mock.transport, authority }, { scanSurface: SCAN_SURFACE });
    expect(run.aggregates.host_valid).toBe(50);
    expect(run.aggregates.clarify_count).toBe(50);
    expect(run.decision.decision).toBe("EXECUTOR_CALIBRATION_RUN");
  });

  it("stochasticity and conflation flags are diagnostics only (no gate depends on them)", async () => {
    const { userText } = await fixture();
    const authority = await mockAuthority();
    const mock = mockTransport({ userText, defaultOutcome: "VALID_REALIZE" });
    const run = await runCalibration({ transport: mock.transport, authority, maxTrials: 5 }, { scanSurface: SCAN_SURFACE });
    const lawText = readFileSync(join(REPO_ROOT, EXPERIMENT_DIR, "calibration-law.ts"), "utf8");
    expect(lawText).toContain("outcome_diversity_gate: \"NONE\"");
    expect(lawText).toContain("stochasticity_role: \"DIAGNOSTIC_ONLY\"");
    expect(lawText).toContain("truth_conflation_role: \"DIAGNOSTIC_ONLY\"");
    expect(Object.keys(run.integrity.gates)).not.toContain("OUTCOME_DIVERSITY");
  });
});

describe("CALIBRATION — early stop and drift gates", () => {
  it("TEST_EARLY_STOP: the third non-host-valid stops the run deterministically and leaves the rest unexecuted", async () => {
    const { userText } = await fixture();
    const authority = await mockAuthority();
    const mock = mockTransport({ userText, script: ["SCHEMA_INVALID", "SCHEMA_INVALID", "SCHEMA_INVALID"] });
    const run = await runCalibration({ transport: mock.transport, authority }, { scanSurface: SCAN_SURFACE });
    expect(run.trials.length).toBe(3);
    expect(run.early_stopped).toBe(true);
    expect(run.decision.decision).toBe("EXECUTOR_CALIBRATION_STOP_EARLY");
    expect(mock.calls()).toBe(3);
    expect(run.aggregates.planned).toBe(50);
  });

  it("TEST_SCHEMA_DRIFT: schema drift detected before trial 25 stops the run at trial 24", async () => {
    const { userText } = await fixture();
    const state = { calls: 0 };
    const authority = await mockAuthority({
      schemaHash: () =>
        state.calls >= 24
          ? hashJson({ ...CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA, drifted: true })
          : hashJson(CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA)
    });
    const mock = mockTransport({ userText, defaultOutcome: "VALID_REALIZE", onCall: (call) => (state.calls = call) });
    const run = await runCalibration({ transport: mock.transport, authority }, { scanSurface: SCAN_SURFACE });
    expect(mock.calls()).toBe(24);
    expect(run.trials.length).toBe(24);
    expect(run.stopped_before_trial).toBe(25);
    expect(run.decision.decision).toBe("EXECUTOR_CALIBRATION_STOP");
    expect(run.integrity.gates.SCHEMA_HASH_IDENTITY).toBe(false);
    expect(run.stop_reason).toContain("CALIBRATION_SCHEMA_HASH_DRIFT");
  });

  it("TEST_CONFIG_DRIFT: a real config change (temperature) is detected pre-call", async () => {
    const { userText } = await fixture();
    const state = { calls: 0 };
    const authority = await mockAuthority({
      modelConfigHash: () => {
        const config = { ...modelConfigManifest() } as Record<string, unknown>;
        if (state.calls >= 3) config["temperature"] = 0.7;
        return hashJson(config);
      }
    });
    const mock = mockTransport({ userText, defaultOutcome: "VALID_REALIZE", onCall: (call) => (state.calls = call) });
    const run = await runCalibration({ transport: mock.transport, authority }, { scanSurface: SCAN_SURFACE });
    expect(mock.calls()).toBe(3);
    expect(run.stopped_before_trial).toBe(4);
    expect(run.stop_reason).toContain("CALIBRATION_MODEL_CONFIG_HASH_DRIFT");
    expect(run.integrity.gates.CONFIG_HASH_IDENTITY).toBe(false);
  });

  it("TEST_SYSTEM_DRIFT: real system bytes changing stops the run pre-call", async () => {
    const { userText } = await fixture();
    const base = await realAuthoritativeRequest();
    const state = { calls: 0 };
    const authority = await mockAuthority({
      renderRequest: async () => {
        const system = `${base.body.messages[0]?.content ?? ""}${state.calls >= 2 ? " " : ""}`;
        const body = {
          ...base.body,
          messages: [{ role: "system" as const, content: system }, base.body.messages[1] as { role: "user"; content: string }]
        };
        const serialized = serializeAuthoritativeRequest(body);
        return {
          body,
          serialized_body: serialized,
          request_hash: authoritativeRequestHash(serialized),
          hashes: { ...base.hashes, system_hash: hashText(system) }
        };
      }
    });
    const mock = mockTransport({ userText, defaultOutcome: "VALID_REALIZE", onCall: (call) => (state.calls = call) });
    const run = await runCalibration({ transport: mock.transport, authority }, { scanSurface: SCAN_SURFACE });
    expect(mock.calls()).toBe(2);
    expect(run.stopped_before_trial).toBe(3);
    expect(run.stop_reason).toContain("CALIBRATION_SYSTEM_HASH_DRIFT");
  });

  it("TEST_USER_DRIFT: one extra user character stops the run pre-call", async () => {
    const { userText } = await fixture();
    const base = await realAuthoritativeRequest();
    const state = { calls: 0 };
    const authority = await mockAuthority({
      renderRequest: async () => {
        const user = `${base.body.messages[1]?.content ?? ""}${state.calls >= 1 ? "x" : ""}`;
        const body = {
          ...base.body,
          messages: [base.body.messages[0] as { role: "system"; content: string }, { role: "user" as const, content: user }]
        };
        const serialized = serializeAuthoritativeRequest(body);
        return {
          body,
          serialized_body: serialized,
          request_hash: authoritativeRequestHash(serialized),
          hashes: { ...base.hashes, user_hash: hashText(user) }
        };
      }
    });
    const mock = mockTransport({ userText, defaultOutcome: "VALID_REALIZE", onCall: (call) => (state.calls = call) });
    const run = await runCalibration({ transport: mock.transport, authority }, { scanSurface: SCAN_SURFACE });
    expect(mock.calls()).toBe(1);
    expect(run.stopped_before_trial).toBe(2);
    expect(run.stop_reason).toContain("CALIBRATION_USER_HASH_DRIFT");
    expect(run.integrity.gates.USER_HASH_IDENTITY).toBe(false);
  });

  it("TEST_REQUEST_DRIFT: a changed authoritative byte stream is refused pre-call", async () => {
    const { userText } = await fixture();
    const base = await realAuthoritativeRequest();
    const authority = await mockAuthority({
      renderRequest: async () => {
        const body = { ...base.body, temperature: 0.25 };
        const serialized = serializeAuthoritativeRequest(body);
        return { body, serialized_body: serialized, request_hash: authoritativeRequestHash(serialized), hashes: { ...base.hashes } };
      }
    });
    const mock = mockTransport({ userText, defaultOutcome: "VALID_REALIZE" });
    const run = await runCalibration({ transport: mock.transport, authority }, { scanSurface: SCAN_SURFACE });
    expect(mock.calls()).toBe(0);
    expect(run.stopped_before_trial).toBe(1);
    expect(run.stop_reason).toContain("CALIBRATION_REQUEST_FROZEN_HASH_MISMATCH");
  });

  it("TEST_RESPONSE_MODEL_DRIFT: trial k completes and trial k+1 is NEVER sent", async () => {
    const { userText } = await fixture();
    const authority = await mockAuthority();
    const mock = mockTransport({
      userText,
      defaultOutcome: "VALID_REALIZE",
      modelIdForCall: (call) => (call === 3 ? "another-model" : "deepseek-flash")
    });
    const run = await runCalibration({ transport: mock.transport, authority }, { scanSurface: SCAN_SURFACE });
    expect(mock.calls()).toBe(3);
    expect(run.trials.length).toBe(3);
    expect(run.trials[2]?.model_reported).toBe("another-model");
    expect(run.stopped_before_trial).toBe(4);
    expect(run.aggregates.model_id_unique_count).toBe(2);
    expect(run.integrity.gates.MODEL_IDENTITY).toBe(false);
    expect(run.decision.decision).toBe("EXECUTOR_CALIBRATION_STOP");
  });

  it("TEST_CODE_STATE_DRIFT: a HEAD change during the run stops further authorization", async () => {
    const { userText } = await fixture();
    let reads = 0;
    const authority = await mockAuthority({
      head: "f".repeat(40)
    });
    const drifting = {
      ...authority,
      currentHead: () => {
        reads += 1;
        return reads <= 2 ? "f".repeat(40) : "e".repeat(40);
      },
      codeState: () => `${reads <= 2 ? "f".repeat(40) : "e".repeat(40)}:TRACKED_TREE_CLEAN`
    };
    const mock = mockTransport({ userText, defaultOutcome: "VALID_REALIZE" });
    const run = await runCalibration({ transport: mock.transport, authority: drifting }, { scanSurface: SCAN_SURFACE });
    expect(run.integrity.current_head_before).not.toBe(run.integrity.current_head_after);
    expect(run.decision.decision).toBe("EXECUTOR_CALIBRATION_STOP");
    expect(run.integrity.gates.TRACKED_TREE_CLEAN).toBe(false);
  });

  it("TEST_SECRET_SAFETY: the frozen body and evidence schema carry no credential surface", async () => {
    const request = await realAuthoritativeRequest();
    const blockComments = new RegExp("/\\*[\\s\\S]*?\\*/", "g");
    const lineComments = new RegExp("^\\s*//.*$", "gm");
    const stripComments = (source: string): string => source.replace(blockComments, "").replace(lineComments, "");
    const evidenceCode = stripComments(readFileSync(join(REPO_ROOT, EXPERIMENT_DIR, "calibration-evidence.ts"), "utf8"));
    const transportCode = stripComments(readFileSync(join(REPO_ROOT, EXPERIMENT_DIR, "calibration-transport.ts"), "utf8"));
    expect(request.serialized_body).not.toMatch(/authorization/i);
    // The credential appears in CODE only in the HTTP header construction.
    expect(transportCode).toContain("authorization: `Bearer ${apiKey}`");
    expect(evidenceCode).not.toMatch(/\bapiKey\b/i);
    expect(evidenceCode).not.toMatch(/\bsk-/);
    expect(evidenceCode).not.toContain("fetch(");
    expect(evidenceCode).not.toContain("process.env");
  });

  it("TEST_NO_PRIMARY_PATH: the calibration harness contains no primary execution path or cell identity", () => {
    // The schedule/label vocabulary is forbidden EVERYWHERE in the execution path.
    // Phase identities are forbidden as LITERALS (a quoted phase label); the
    // PRIMARY_AUTHORIZED / stopped_before_primary refusal markers are required and
    // are therefore not matched by these tokens.
    // Phase identities are forbidden as LITERALS (a quoted phase label);
    // the PRIMARY_AUTHORIZED / stopped_before_primary refusal markers are
    // required and are therefore not matched by these tokens.
    const forbiddenEverywhere = ["A_LOW", "B_HIGH", "C_HIGH_ABLATED", "D_LOW_EQUALIZED", "runScene", "restoreBranch", "buildBranch", '"PRIMARY"', '"REPLICATION"', "trialSchedule"];
    for (const file of [
      "calibration-cli.ts",
      "calibration-runner.ts",
      "calibration-request.ts",
      "calibration-law.ts",
      "calibration-transport.ts",
      "calibration-evidence.ts",
      "cli.ts"
    ]) {
      const source = readFileSync(join(REPO_ROOT, EXPERIMENT_DIR, file), "utf8");
      for (const forbidden of forbiddenEverywhere) {
        expect(source.includes(forbidden), `${file} must not reference ${forbidden}`).toBe(false);
      }
      expect(source).not.toMatch(/commitReserved|reserveAndRoute|BeliefTransitionExecutor|terminalizeReservedNoOp/);
    }
    // `calibration-authority.ts` is the DESIGN-BINDING module: it must re-derive
    // the frozen schedule hash and re-form the two research histories offline
    // (which is why it names `trialSchedule`, the phase labels and `buildBranch`).
    // What it must NEVER contain is a confirmatory trial identity, a scene
    // runner, a writer or any network surface.
    const authoritySource = readFileSync(join(REPO_ROOT, EXPERIMENT_DIR, "calibration-authority.ts"), "utf8");
    for (const forbidden of ["A_LOW", "B_HIGH", "C_HIGH_ABLATED", "D_LOW_EQUALIZED", "runScene"]) {
      expect(authoritySource.includes(forbidden), `calibration-authority.ts must not reference ${forbidden}`).toBe(false);
    }
    expect(authoritySource).toContain("trial_schedule_hash");
    // No network surface: the only `fetch(` in this module is the audit vocabulary string.
    expect(authoritySource).not.toMatch(/fetchImpl|globalThis\.fetch|await\s+fetch\(/);
    // No writer CALL: the module names writer tokens as STRINGS (it is the module
    // that detects them), so the assertion runs on the code with literals removed.
    const authorityCodeOnly = authoritySource.replace(/"[^"\n]*"|'[^'\n]*'/g, '""');
    expect(authorityCodeOnly).not.toMatch(/commitReserved|reserveAndRoute|BeliefTransitionExecutor|terminalizeReservedNoOp|writeBelief/);
  });

  it("TEST_NO_AUTO_PRIMARY: nothing in the calibration path can enter the primary phase", () => {
    for (const file of ["calibration-cli.ts", "cli.ts"]) {
      const source = readFileSync(join(REPO_ROOT, EXPERIMENT_DIR, file), "utf8");
      expect(source).toContain("primary_authorized");
      expect(source).not.toMatch(/runPrimary|PRIMARY_SCHEDULER|A_B_C_D|phase:\s*"PRIMARY"/);
    }
    const cliSource = readFileSync(join(REPO_ROOT, EXPERIMENT_DIR, "calibration-cli.ts"), "utf8");
    expect(cliSource).toContain("PRIMARY_AUTHORIZED = false");
  });
});

describe("CALIBRATION — T23/T24 executor-output classification at the runner", () => {
  it("TEST_T23_MODEL_CONTENT_INVALID: a valid HTTP envelope with malformed cognition content is ONE attempt", async () => {
    const { userText } = await fixture();
    const authority = await mockAuthority();
    const mock = mockTransport({ userText, script: ["SCHEMA_INVALID", "VALID_REALIZE"], defaultOutcome: "VALID_REALIZE" });
    const run = await runCalibration({ transport: mock.transport, authority, maxTrials: 2 }, { scanSurface: SCAN_SURFACE });
    const trial = run.trials[0];
    expect(trial?.raw_attempts).toBe(1);
    expect(trial?.content_json_valid).toBe(false);
    expect(trial?.schema_valid).toBe(false);
    expect(trial?.host_valid).toBe(false);
    expect(trial?.host_invalid_reason).toBe("MODEL_SCHEMA_INVALID");
    expect(run.aggregates.retries).toBe(0);
    // The transport itself only saw ONE HTTP-shaped call for that trial.
    expect(mock.attempts()).toBe(2);
  });

  it("TEST_T24_HOST_INVALID_AFTER_SCHEMA: a schema-valid but host-rejected response is ONE attempt", async () => {
    const { userText } = await fixture();
    const authority = await mockAuthority();
    const mock = mockTransport({ userText, script: ["HOST_INVALID", "VALID_REALIZE"], defaultOutcome: "VALID_REALIZE" });
    const run = await runCalibration({ transport: mock.transport, authority, maxTrials: 2 }, { scanSurface: SCAN_SURFACE });
    const trial = run.trials[0];
    expect(trial?.raw_attempts).toBe(1);
    expect(trial?.content_json_valid).toBe(true);
    expect(trial?.schema_valid).toBe(true);
    expect(trial?.host_valid).toBe(false);
    expect(trial?.host_invalid_reason).not.toBe("MODEL_SCHEMA_INVALID");
    expect(run.aggregates.retries).toBe(0);
    expect(run.aggregates.schema_invalid).toBe(0);
  });

  it("TEST_T24C_FACTUAL_AUTHORIZATION: the second schema-valid/host-invalid case is also ONE attempt", async () => {
    const { userText } = await fixture();
    const { handleForObservation, factualInvalidProposalJson } = await import("./test-support.ts");
    const handle = handleForObservation(userText) ?? "F1";
    const authority = await mockAuthority();
    const mock = mockTransport({ userText, contentFor: () => factualInvalidProposalJson(handle), defaultOutcome: "VALID_REALIZE" });
    const run = await runCalibration({ transport: mock.transport, authority, maxTrials: 1 }, { scanSurface: SCAN_SURFACE });
    const trial = run.trials[0];
    expect(trial?.raw_attempts).toBe(1);
    expect(trial?.content_json_valid).toBe(true);
    expect(trial?.schema_valid).toBe(true);
    expect(trial?.host_valid).toBe(false);
    expect(trial?.host_invalid_reason).toBe("FACTUAL_AUTHORIZATION_REJECTED");
  });

  it("TEST_T24B_SCHEMA_VALID_HOST_INVALID_EXISTS: the V8 enum boundary makes the DIRECTIVE atoms unreachable post-schema, and the host rejection is the reachable case", () => {
    // The directive enum is EXACTLY the two frozen atoms, so a schema-valid
    // response can never carry a third directive kind: the
    // `DIRECTIVE_NOT_IN_ALLOWED_ATOMS` branch is UNREACHABLE_AFTER_SCHEMA_VALIDATION.
    const kinds = (
      CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA as {
        properties: { communication_directive: { properties: { kind: { enum: readonly string[] } } } };
      }
    ).properties.communication_directive.properties.kind.enum;
    expect([...kinds].sort()).toEqual(["CLARIFY_MISSING_CONTEXT", "REALIZE_CURRENT_INTENT"]);
    // A schema-valid / host-invalid case DOES exist — it is the host authority
    // stage (factual authorization / response semantics), not the enum — and
    // TEST_T24_HOST_INVALID_AFTER_SCHEMA exercises it with exactly one attempt.
    expect(validProposalJson("REALIZE_CURRENT_INTENT").length).toBeGreaterThan(0);
  });
});

describe("CALIBRATION — the authoritative serialization", () => {
  it("the bytes the transport receives are the frozen canonical bytes (not a second serialization)", async () => {
    const { userText } = await fixture();
    const authority = await mockAuthority();
    const mock = mockTransport({ userText, defaultOutcome: "VALID_REALIZE" });
    const run = await runCalibration({ transport: mock.transport, authority, maxTrials: 3 }, { scanSurface: SCAN_SURFACE });
    const expected = (await realAuthoritativeRequest()).serialized_body;
    for (const body of mock.bodies()) {
      expect(body).toBe(expected);
      expect(hashText(body)).toBe("sha256:79f1d679c6dcd9622f4f154055462ca540eed56680847499a3b4420971ac9c35");
    }
    expect(run.aggregates.request_hash_unique_count).toBe(1);
    expect(run.integrity.runtime_request_hash).toBe(run.integrity.frozen_request_hash);
    for (const trial of run.trials) {
      expect(trial.request_hash).toBe("sha256:79f1d679c6dcd9622f4f154055462ca540eed56680847499a3b4420971ac9c35");
      expect(trial.serialized_body_bytes).toBe(Buffer.byteLength(expected, "utf8"));
    }
  });

  it("the unique counts are computed from executed trial records (never a constant 1)", async () => {
    const { userText } = await fixture();
    const authority = await mockAuthority();
    const mock = mockTransport({ userText, defaultOutcome: "VALID_REALIZE", modelIdForCall: (call) => (call === 2 ? "drifted" : "deepseek-flash") });
    const run = await runCalibration({ transport: mock.transport, authority }, { scanSurface: SCAN_SURFACE });
    expect(run.trials.length).toBe(2);
    expect(run.aggregates.request_hash_unique_count).toBe(1);
    expect(run.aggregates.system_hash_unique_count).toBe(1);
    expect(run.aggregates.user_hash_unique_count).toBe(1);
    expect(run.aggregates.schema_hash_unique_count).toBe(1);
    expect(run.aggregates.config_hash_unique_count).toBe(1);
    expect(run.aggregates.model_id_unique_count).toBe(2);
    // A run refused before its first call carries ZERO trials, and its counts are 0
    // — not a fabricated 1.
    const base = await realAuthoritativeRequest();
    const refusing = await mockAuthority({
      renderRequest: async () => ({ ...base, hashes: { ...base.hashes, user_hash: "sha256:" + "9".repeat(64) } })
    });
    const emptyMock = mockTransport({ userText, defaultOutcome: "VALID_REALIZE" });
    const zero = await runCalibration({ transport: emptyMock.transport, authority: refusing }, { scanSurface: SCAN_SURFACE });
    expect(zero.trials.length).toBe(0);
    expect(zero.aggregates.request_hash_unique_count).toBe(0);
    expect(zero.aggregates.system_hash_unique_count).toBe(0);
    expect(zero.aggregates.model_id_unique_count).toBe(0);
    expect(emptyMock.calls()).toBe(0);
  });
});

describe("CALIBRATION — the frozen request body is unchanged by the remediation", () => {
  it("the dead observation code did not change a single request byte", async () => {
    const request = await realAuthoritativeRequest();
    expect(request.request_hash).toBe("sha256:79f1d679c6dcd9622f4f154055462ca540eed56680847499a3b4420971ac9c35");
    expect(request.hashes.model_facing_request_hash).toBe("sha256:79f1d679c6dcd9622f4f154055462ca540eed56680847499a3b4420971ac9c35");
    expect(request.hashes.system_hash).toBe("sha256:044bfe7b7641cb9cadcf9f02005560fd6b9332576bcfb3c8a0cd40ae4a91f121");
    expect(request.hashes.user_hash).toBe("sha256:55d27d60fe3087537e66c1075dbe43677160ddbc0d8569207577b46962a219f3");
    expect(request.hashes.schema_hash).toBe("sha256:54ac7977f3b9e7f2e422fd6dc5f218fe34e82ffc368ebec68a58b4e634feec35");
    expect(request.hashes.model_config_hash).toBe("sha256:0ed9df37fb4b2981ae5ff69bbe37c0858ea82cec200bb87249f66478927810d5");
    expect(Buffer.byteLength(request.serialized_body, "utf8")).toBe(17381);
    // The CONSUMED calibration's request remains a recorded historical fact.
    expect(FROZEN_CALIBRATION_REQUEST_HASH).toBe("sha256:db8d8993c63e6de476c4ddb28dff5c55d5716f8f1fb3cc23ccfcd841bc31f509");
    expect(validProposalJson("REALIZE_CURRENT_INTENT")).toContain("communication_directive");
  });
});
