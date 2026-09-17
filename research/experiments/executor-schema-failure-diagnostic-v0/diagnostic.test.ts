/* eslint-disable no-restricted-imports -- Research harness: imports frozen production roots and the frozen experiment by relative path. */
/**
 * EXPLORATORY_EXECUTOR_SCHEMA_FAILURE_DIAGNOSTIC_V0 — Phase A tests (A–J).
 *
 * ZERO model calls and ZERO network calls: every case injects a mock fetch. These
 * tests are the Phase A gate — the exploratory diagnostic calls are only lawful
 * once this file passes.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildConversationSubjectDataV4 } from "../../../packages/runtime/dist/providers/behavior/conversation-cognition-provider-v6.js";

import { buildCalibrationProjection, buildCalibrationSubject } from "../belief-causal-confirmatory-stochastic-v1/calibration-request.ts";

import {
  CONSUMED_CALIBRATION_REQUEST_HASH,
  DIAGNOSTIC_ARTIFACT_SCHEMA_VERSION,
  DIAGNOSTIC_MARKERS,
  DIAGNOSTIC_MAX_MODEL_CALLS,
  DIAGNOSTIC_TARGET_SCHEMA_INVALID_EXAMPLES,
  FAILURE_TAXONOMY_IDS,
  FROZEN_MODEL_FACING_REQUEST_BYTES,
  FROZEN_MODEL_FACING_REQUEST_HASH
} from "./contract.ts";
import { assertFrozenRequest, buildDiagnosticRequest, DiagnosticRequestMismatchError } from "./frozen-request.ts";
import { createDiagnosticTransport, scanAndRedactCredentialPatterns } from "./diagnostic-transport.ts";
import { buildValidationTrace, type ValidationTrace } from "./validation-trace.ts";
import { classifyResponse } from "./taxonomy.ts";
import { runDiagnostic } from "./diagnostic-runner.ts";
import { diagnosticPreflight, diagnosticRun, reclassifyArtifact } from "./cli.ts";

const REPO_ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "..");
const DIAGNOSTIC_DIR = "research/experiments/executor-schema-failure-diagnostic-v0";
const CALIBRATION_DIR = "research/experiments/belief-causal-confirmatory-stochastic-v1";
const TEST_KEY = "sk-diagnostic-test-key-000000000000";
const HASH_A = `sha256:${"a".repeat(64)}`;

/* -------------------------------------------------------------------------- */
/* fixtures                                                                    */
/* -------------------------------------------------------------------------- */

function validProposal(): Record<string, unknown> {
  return {
    schema_version: "conversation-cognition-proposal-v8",
    response_semantics: { kind: "PRIMARY_CONVERSATIONAL_ACT", act: "ACKNOWLEDGE" },
    factual_assessment: { claims: [] },
    cognition: {
      schema_version: "cognition-proposal-v0",
      reasoning_summary: "diagnostic fixture",
      relevant_memory_handles: [],
      considered_handles: [],
      current_intent: "respond to the user",
      confidence: 0.5,
      uncertainty: 0.5,
      action_intent: null,
      evidence_handles: []
    },
    subjective_selection: { kind: "NO_SUBJECTIVE_SELECTION" },
    communication_directive: { kind: "REALIZE_CURRENT_INTENT" },
    clarification_basis: null
  };
}

interface MockFetchHandle {
  readonly fetchImpl: typeof fetch;
  readonly bodies: readonly string[];
  readonly calls: number;
}

function mockEnvelopeFetch(contents: readonly string[], options: { readonly model?: string; readonly reasoning?: boolean } = {}): MockFetchHandle {
  const bodies: string[] = [];
  let calls = 0;
  const fetchImpl = (async (_url: unknown, init: unknown) => {
    const body = String((init as { body?: unknown }).body ?? "");
    bodies.push(body);
    const content = contents[Math.min(calls, contents.length - 1)] ?? "";
    calls += 1;
    const message: Record<string, unknown> = { content };
    if (options.reasoning === true) message["reasoning_content"] = "internal reasoning that must not leak";
    return new Response(
      JSON.stringify({
        model: options.model ?? "deepseek-flash",
        choices: [{ message, finish_reason: "stop" }],
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150, prompt_tokens_details: { cached_tokens: 20 }, completion_tokens_details: { reasoning_tokens: 7 } }
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  }) as unknown as typeof fetch;
  return {
    fetchImpl,
    get bodies() {
      return bodies;
    },
    get calls() {
      return calls;
    }
  };
}

async function traceFor(content: string | null, envelope: { valid?: boolean } = {}): Promise<ValidationTrace> {
  const subject = await buildCalibrationSubject();
  const projection = await buildCalibrationProjection(subject);
  return await buildValidationTrace({
    transportStage: "PASS",
    transportDetail: { ok: true, model: "deepseek-flash" },
    envelopeJsonValid: envelope.valid ?? true,
    envelopeJsonError: envelope.valid === false ? "unexpected token" : null,
    envelopeKeys: ["choices", "model", "usage"],
    content,
    projection
  });
}

/* -------------------------------------------------------------------------- */
/* A — a valid response produces a full PASS trace                             */
/* -------------------------------------------------------------------------- */

describe("DIAGNOSTIC PHASE A — A: valid response passes every stage", () => {
  it("TEST_A_VALID_RESPONSE_FULL_TRACE", async () => {
    const trace = await traceFor(JSON.stringify(validProposal()));
    for (const stage of ["STAGE_A_TRANSPORT", "STAGE_B_ENVELOPE_JSON", "STAGE_C_CONTENT_JSON", "STAGE_D_PRODUCTION_SCHEMA", "STAGE_E_PRODUCTION_HOST_AUTHORITY"] as const) {
      expect(trace[stage], stage).toBe("PASS");
    }
    expect(trace.production_pipeline_verdict.threw).toBe(false);
    expect(trace.production_pipeline_verdict.directive).toBe("REALIZE_CURRENT_INTENT");
    expect(classifyResponse(trace).classification).toBe("PASS");
    expect(trace.stage_details.production_schema.detail).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/* B — malformed content JSON fails at STAGE C                                 */
/* -------------------------------------------------------------------------- */

describe("DIAGNOSTIC PHASE A — B: malformed content JSON is a STAGE C failure", () => {
  it("TEST_B_CONTENT_JSON_INVALID", async () => {
    const trace = await traceFor("{ not json at all");
    expect(trace.STAGE_C_CONTENT_JSON).toBe("FAIL");
    expect(trace.STAGE_D_PRODUCTION_SCHEMA).toBe("NOT_REACHED");
    expect(trace.STAGE_E_PRODUCTION_HOST_AUTHORITY).toBe("NOT_REACHED");
    expect(trace.stage_details.content_json.error).not.toBeNull();
    expect(trace.production_pipeline_verdict.code).toBe("MODEL_SCHEMA_INVALID");
    const classification = classifyResponse(trace);
    expect(classification.classification).toBe("JSON_SYNTAX_INVALID");
    expect(classification.taxonomy).toContain("JSON_SYNTAX_INVALID");
  });
});

/* -------------------------------------------------------------------------- */
/* C — a missing required property surfaces as the production closed-key error  */
/* -------------------------------------------------------------------------- */

describe("DIAGNOSTIC PHASE A — C: missing required property carries an exact production path", () => {
  it("TEST_C_MISSING_REQUIRED_PROPERTY_EXACT_PATH", async () => {
    const proposal = validProposal();
    delete proposal["communication_directive"];
    const trace = await traceFor(JSON.stringify(proposal));
    expect(trace.STAGE_D_PRODUCTION_SCHEMA).toBe("FAIL");
    const detail = trace.stage_details.production_schema.detail;
    expect(detail).not.toBeNull();
    // The RAW production string is the authority and is stored verbatim.
    expect(detail?.raw.length ?? 0).toBeGreaterThan(0);
    expect(detail?.extraction).toBe("MECHANICAL_SLICE_OF_PRODUCTION_STRING");
    expect(detail?.structured_fields).toBe("NOT_EXPOSED_BY_PRODUCTION_VALIDATOR");
    // Production reports a missing key through its closed-key-set rule; the
    // diagnostic records exactly that and does NOT invent "missing field".
    expect(detail?.raw).toMatch(/expected exactly \[/);
    const classification = classifyResponse(trace);
    expect(classification.classification).toBe("SCHEMA_CONTRACT_VIOLATION");
    expect(classification.taxonomy).toContain("CLOSED_KEY_SET_VIOLATION");
    expect(classification.taxonomy).not.toContain("REQUIRED_FIELD_MISSING");
    expect(trace.production_pipeline_verdict.code).toBe("MODEL_SCHEMA_INVALID");
  });
});

/* -------------------------------------------------------------------------- */
/* D — invalid enum / version value fails at STAGE D with its path              */
/* -------------------------------------------------------------------------- */

describe("DIAGNOSTIC PHASE A — D: an invalid closed enum value fails at STAGE D", () => {
  it("TEST_D_INVALID_ENUM_EXACT_PATH", async () => {
    const proposal = validProposal();
    proposal["schema_version"] = "conversation-cognition-proposal-v9";
    const trace = await traceFor(JSON.stringify(proposal));
    expect(trace.STAGE_D_PRODUCTION_SCHEMA).toBe("FAIL");
    const detail = trace.stage_details.production_schema.detail;
    expect(detail?.path_prefix).toBe("conversation proposal.schema_version");
    expect(detail?.raw).toMatch(/expected conversation-cognition-proposal-v8/);
    const classification = classifyResponse(trace);
    expect(classification.classification).toBe("SCHEMA_CONTRACT_VIOLATION");
    expect(classification.taxonomy).toContain("SCHEMA_VERSION_INVALID");
  });
});

/* -------------------------------------------------------------------------- */
/* E — source-handle authority: unknown handle vs unbound citation             */
/* -------------------------------------------------------------------------- */

describe("DIAGNOSTIC PHASE A — E: source-handle failures land on their real production stage", () => {
  it("TEST_E1_UNKNOWN_HANDLE_IS_A_SCHEMA_STAGE_FAILURE", async () => {
    const proposal = validProposal();
    proposal["factual_assessment"] = {
      claims: [{ kind: "SOURCE_QUOTE", text: "an unsupported assertion", source_handles: ["F999"] }]
    };
    const trace = await traceFor(JSON.stringify(proposal));
    expect(trace.STAGE_D_PRODUCTION_SCHEMA).toBe("FAIL");
    expect(trace.stage_details.production_schema.detail?.raw).toMatch(/UNKNOWN_SOURCE_HANDLE/);
    const classification = classifyResponse(trace);
    expect(classification.taxonomy).toContain("SOURCE_HANDLE_INVALID");
    expect(trace.production_pipeline_verdict.code).toBe("MODEL_SCHEMA_INVALID");
  });

  it("TEST_E2_ADVERTISED_HANDLE_WITH_UNBOUND_CITATION_IS_A_HOST_REJECTION", async () => {
    const subject = await buildCalibrationSubject();
    const projection = await buildCalibrationProjection(subject);
    const userData = buildConversationSubjectDataV4(projection as never);
    const advertised = /^-\s*([FC][0-9]+):\s*(observation:\S+)\s*$/m.exec(userData)?.[1] ?? "F1";
    const proposal = validProposal();
    proposal["factual_assessment"] = {
      claims: [{ kind: "SOURCE_QUOTE", text: "a sentence that appears in no source at all", source_handles: [advertised] }]
    };
    proposal["response_semantics"] = { kind: "PRIMARY_FACT", claim_index: 0 };
    const trace = await buildValidationTrace({
      transportStage: "PASS",
      transportDetail: { ok: true, model: "deepseek-flash" },
      envelopeJsonValid: true,
      envelopeJsonError: null,
      envelopeKeys: ["choices", "model", "usage"],
      content: JSON.stringify(proposal),
      projection
    });
    expect(trace.STAGE_D_PRODUCTION_SCHEMA).toBe("PASS");
    expect(trace.STAGE_E_PRODUCTION_HOST_AUTHORITY).toBe("FAIL");
    expect(trace.production_pipeline_verdict.code).toBe("FACTUAL_AUTHORIZATION_REJECTED");
    const codes = trace.stage_details.production_host_authority.factual_rejection_codes;
    expect(codes.length).toBeGreaterThan(0);
    expect(trace.production_pipeline_verdict.factual_authorization_trace.length).toBeGreaterThan(0);
    const classification = classifyResponse(trace);
    expect(classification.classification).toBe("HOST_AUTHORITY_REJECTED");
    expect(classification.taxonomy).toContain("HOST_AUTHORITY_INVALID");
  });
});

/* -------------------------------------------------------------------------- */
/* F — incomplete response semantics                                           */
/* -------------------------------------------------------------------------- */

describe("DIAGNOSTIC PHASE A — F: incomplete response semantics is a STAGE E failure", () => {
  it("TEST_F_RESPONSE_SEMANTICS_INCOMPLETE", async () => {
    const proposal = validProposal();
    proposal["response_semantics"] = { kind: "PRIMARY_STANCE" };
    const trace = await traceFor(JSON.stringify(proposal));
    expect(trace.STAGE_E_PRODUCTION_HOST_AUTHORITY).toBe("FAIL");
    expect(trace.stage_details.production_host_authority.response_semantics_rejected).toBe(true);
    expect(trace.stage_details.production_host_authority.detail?.semantic_completeness_marker).toBe(true);
    expect(trace.production_pipeline_verdict.code).toBe("RESPONSE_SEMANTICS_REJECTED");
    const classification = classifyResponse(trace);
    expect(classification.classification).toBe("RESPONSE_SEMANTICS_REJECTED");
    expect(classification.taxonomy).toContain("RESPONSE_SEMANTICS_INCOMPLETE");
  });
});

/* -------------------------------------------------------------------------- */
/* G — raw content is captured, credentials are never captured                 */
/* -------------------------------------------------------------------------- */

describe("DIAGNOSTIC PHASE A — G: raw content is saved, credential patterns are not", () => {
  it("TEST_G_RAW_CONTENT_SAVED_SECRETS_REJECTED", async () => {
    const rawWithKey = JSON.stringify({ ...validProposal(), cognition: { ...validProposal()["cognition"] as Record<string, unknown>, reasoning_summary: `leaked sk-abcdefgh12345678 and Bearer abcdefgh12345678` } });
    const scanned = scanAndRedactCredentialPatterns(rawWithKey);
    expect(scanned.hits).toBeGreaterThan(0);
    expect(scanned.text).not.toContain("sk-abcdefgh12345678");
    expect(scanned.text).not.toContain("Bearer abcdefgh12345678");
    expect(scanned.text).toContain("<redacted>");

    const mock = mockEnvelopeFetch([rawWithKey]);
    const transport = createDiagnosticTransport(TEST_KEY, "https://api.example.invalid", { fetchImpl: mock.fetchImpl, backoffMs: [0, 0], sleepImpl: async () => undefined });
    const outcome = await transport.complete("{}");
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error("unreachable");
    // The raw envelope is kept for offline analysis, with the key-shaped text removed.
    expect(outcome.raw_envelope.length).toBeGreaterThan(0);
    expect(outcome.raw_envelope).not.toMatch(/sk-[A-Za-z0-9]{8,}/);
    expect(outcome.raw_envelope).not.toMatch(/Bearer\s+[A-Za-z0-9._-]{8,}/);
    expect(outcome.content).toBeTruthy();
  });

  it("TEST_G2_ARTIFACT_HAS_NO_CREDENTIAL_FIELD", async () => {
    const mock = mockEnvelopeFetch([JSON.stringify(validProposal())], { reasoning: true });
    const artifact = { written: "" };
    const report = await diagnosticRun(
      { artifactOut: "ignored.json" },
      {
        apiKey: TEST_KEY,
        fetchImpl: mock.fetchImpl,
        maxCalls: 1,
        writeArtifact: (_path: string, text: string) => {
          artifact.written = text;
        }
      } as never
    );
    expect(report.model_calls).toBeGreaterThan(0);
    expect(artifact.written).not.toContain(TEST_KEY);
    expect(artifact.written).not.toMatch(/Bearer\s+[A-Za-z0-9._-]{8,}/);
    // "authorization" also names the production FACTUAL authorization trace, so the
    // assertion targets the HTTP-header form and key-shaped values specifically.
    expect(artifact.written).not.toMatch(/"authorization"s*:/i);
    expect(artifact.written).not.toMatch(/sk-[A-Za-z0-9]{8,}/);
  });
});

/* -------------------------------------------------------------------------- */
/* H — no retry on any validation failure                                      */
/* -------------------------------------------------------------------------- */

describe("DIAGNOSTIC PHASE A — H: validation failures are never retried", () => {
  it("TEST_H_NO_RETRY_ON_SCHEMA_OR_SEMANTICS_FAILURE", async () => {
    const cases: readonly string[] = [
      "{ not json",                                                                   // STAGE C
      JSON.stringify({ ...validProposal(), schema_version: "wrong" }),                // STAGE D
      JSON.stringify({ ...validProposal(), response_semantics: { kind: "PRIMARY_STANCE" } })  // STAGE E
    ];
    for (const content of cases) {
      const mock = mockEnvelopeFetch([content]);
      const transport = createDiagnosticTransport(TEST_KEY, "https://api.example.invalid", {
        fetchImpl: mock.fetchImpl,
        backoffMs: [0, 0],
        sleepImpl: async () => undefined
      });
      const outcome = await transport.complete("{}");
      expect(outcome.ok, "transport returns the envelope").toBe(true);
      expect(outcome.attempts.length, `${content.slice(0, 24)}`).toBe(1);
      expect(mock.calls, `${content.slice(0, 24)}`).toBe(1);
    }
  });

  it("TEST_H2_RETRY_LAW_IS_THE_FROZEN_ONE", async () => {
    // A retryable transport failure still retries (the frozen law is intact) …
    let calls = 0;
    const flaky = (async () => {
      calls += 1;
      if (calls === 1) throw new TypeError("fetch failed: ECONNRESET");
      return new Response(JSON.stringify({ model: "deepseek-flash", choices: [{ message: { content: "{}" }, finish_reason: "stop" }] }), { status: 200 });
    }) as unknown as typeof fetch;
    const transport = createDiagnosticTransport(TEST_KEY, "https://api.example.invalid", { fetchImpl: flaky, backoffMs: [0, 0], sleepImpl: async () => undefined });
    const outcome = await transport.complete("{}");
    expect(outcome.ok).toBe(true);
    expect(outcome.attempts.length).toBe(2);
    expect(outcome.attempts[0]?.failure_class).toBe("NETWORK_ERROR");
  });
});

/* -------------------------------------------------------------------------- */
/* I — the request bytes stay frozen                                           */
/* -------------------------------------------------------------------------- */

describe("DIAGNOSTIC PHASE A — I: the request stays byte-identical to the calibration", () => {
  it("TEST_I_FIXED_REQUEST_BYTES", async () => {
    const binding = await buildDiagnosticRequest();
    expect(binding.request_hash).toBe(FROZEN_MODEL_FACING_REQUEST_HASH);
    expect(binding.body_bytes).toBe(FROZEN_MODEL_FACING_REQUEST_BYTES);
    // The CONSUMED calibration request stays recorded as historical fact.
    expect(CONSUMED_CALIBRATION_REQUEST_HASH).toBe(
      "sha256:db8d8993c63e6de476c4ddb28dff5c55d5716f8f1fb3cc23ccfcd841bc31f509"
    );
    expect(binding.request_hash).not.toBe(CONSUMED_CALIBRATION_REQUEST_HASH);
    expect(binding.byte_identical_to_calibration).toBe(true);
    expect(binding.reconstructed_hashes.model_config_hash).toBe("sha256:0ed9df37fb4b2981ae5ff69bbe37c0858ea82cec200bb87249f66478927810d5");
    assertFrozenRequest(binding);

    const mock = mockEnvelopeFetch([JSON.stringify(validProposal())]);
    const transport = createDiagnosticTransport(TEST_KEY, "https://api.example.invalid", { fetchImpl: mock.fetchImpl, backoffMs: [0, 0], sleepImpl: async () => undefined });
    const result = await runDiagnostic({ transport, maxCalls: 2 });
    expect(result.summary.request_hash_unique_count).toBe(1);
    expect(new Set(mock.bodies).size).toBe(1);
    expect(mock.bodies[0]).toBe(binding.serialized_body);
    for (const body of mock.bodies) expect(body).toBe(binding.serialized_body);
  });

  it("TEST_I2_REQUEST_DRIFT_FAILS_CLOSED", () => {
    expect(() =>
      assertFrozenRequest({
        serialized_body: "{}",
        request_hash: HASH_A,
        body: { model: "x", messages: [], temperature: 0, max_tokens: 1, stream: false, response_format: { type: "json_object" } },
        body_bytes: 2,
        subject: {} as never,
        projection: {},
        reconstructed_hashes: {
          system_hash: HASH_A,
          user_hash: HASH_A,
          schema_hash: HASH_A,
          model_config_hash: HASH_A,
          model_facing_request_hash: HASH_A
        },
        byte_identical_to_calibration: false,
        expected_hash: FROZEN_MODEL_FACING_REQUEST_HASH,
        expected_bytes: FROZEN_MODEL_FACING_REQUEST_BYTES
      })
    ).toThrow(DiagnosticRequestMismatchError);
  });
});

/* -------------------------------------------------------------------------- */
/* J — artifact isolation from the consumed calibration                        */
/* -------------------------------------------------------------------------- */

describe("DIAGNOSTIC PHASE A — J: the diagnostic is isolated from the calibration evidence", () => {
  it("TEST_J_ARTIFACT_ISOLATION_AND_MARKERS", async () => {
    const calibrationEvidence = readFileSync(join(REPO_ROOT, CALIBRATION_DIR, "evidence/calibration-request.json"), "utf8");
    const written: { path: string | null; text: string } = { path: null, text: "" };
    const mock = mockEnvelopeFetch([JSON.stringify(validProposal())]);
    const report = await diagnosticRun(
      { artifactOut: "tmp/diagnostic-out.json" },
      {
        apiKey: TEST_KEY,
        fetchImpl: mock.fetchImpl,
        writeArtifact: (path: string, text: string) => {
          written.path = path;
          written.text = text;
        }
      } as never
    );
    // The diagnostic wrote exactly where it was told to, and nowhere else.
    expect(written.path).toBe("tmp/diagnostic-out.json");
    expect(written.text.length).toBeGreaterThan(0);
    // The consumed calibration evidence is untouched.
    expect(readFileSync(join(REPO_ROOT, CALIBRATION_DIR, "evidence/calibration-request.json"), "utf8")).toBe(calibrationEvidence);
    // Every artifact carries the non-confirmatory markers.
    const artifact = JSON.parse(written.text) as Record<string, unknown>;
    expect(artifact["markers"]).toEqual(DIAGNOSTIC_MARKERS);
    expect(artifact["schema_version"]).toBe(DIAGNOSTIC_ARTIFACT_SCHEMA_VERSION);
    expect((artifact["calibration_reference"] as Record<string, unknown>)["this_artifact_enters_prior_denominator"]).toBe(false);
    expect((artifact["calibration_reference"] as Record<string, unknown>)["prior_authorization"]).toBe("CONSUMED");
    expect(report.primary_authorized).toBe(false);
  });

  it("TEST_J2_DIAGNOSTIC_CODE_NEVER_WRITES_CALIBRATION_EVIDENCE", () => {
    for (const file of ["cli.ts", "diagnostic-runner.ts", "diagnostic-transport.ts", "validation-trace.ts", "taxonomy.ts", "frozen-request.ts", "contract.ts"]) {
      const source = readFileSync(join(REPO_ROOT, DIAGNOSTIC_DIR, file), "utf8");
      expect(source, file).not.toMatch(/calibration-evidence/);
      expect(source, file).not.toMatch(/writeCalibrationEvidence/);
      expect(source, file).not.toContain("belief-causal-confirmatory-stochastic-v1/evidence/");
      expect(source, file).not.toMatch(/EXECUTOR_CALIBRATION_RUN|EXECUTOR_CALIBRATION_STOP(?!_EARLY)/);
    }
  });

  it("TEST_J3_STOP_RULE_AND_BUDGET_ARE_PREWRITTEN", async () => {
    const result = await runDiagnostic({ transport: { id: "unused", complete: async () => ({ ok: false, code: "X", failure_class: "ATTEMPTS_EXHAUSTED" as never, detail: "unused", attempts: [] }) }, maxCalls: 0 });
    expect(result.stop_rule.frozen_before_first_call).toBe(true);
    expect(result.stop_rule.budget_may_be_widened_after_outcomes).toBe(false);
    expect(result.stop_rule.max_model_calls).toBe(DIAGNOSTIC_MAX_MODEL_CALLS);
    expect(result.stop_rule.stop_when_schema_invalid_examples_reach).toBe(DIAGNOSTIC_TARGET_SCHEMA_INVALID_EXAMPLES);
    expect(result.stop_rule.uses_run_stop_law).toBe(false);
    expect(result.stop_rule.uses_delta_min_or_epsilon).toBe(false);
    expect(result.stop_rule.contributes_to_any_denominator).toBe(false);
    expect(result.summary.model_calls).toBe(0);
    // The artifact carries no decision/verdict field at all: no confirmatory
    // outcome vocabulary is reachable from the diagnostic.
    expect("decision" in result).toBe(false);
    expect("verdict" in result).toBe(false);
    expect(JSON.stringify(result)).not.toMatch(/EXECUTOR_CALIBRATION_RUN/);
  });

  it("TEST_J4_PREFLIGHT_IS_ZERO_CALL_AND_REFUSES_WITHOUT_CREDENTIAL", async () => {
    const mock = mockEnvelopeFetch([JSON.stringify(validProposal())]);
    const pass = await diagnosticPreflight({ apiKey: TEST_KEY, fetchImpl: mock.fetchImpl });
    expect(pass.verdict).toBe("DIAGNOSTIC_PREFLIGHT_PASS");
    expect(pass.model_calls).toBe(0);
    expect(pass.network_calls).toBe(0);
    expect(pass.transport_constructed).toBe(false);
    expect(mock.calls).toBe(0);
    const stop = await diagnosticPreflight({ apiKey: "" });
    expect(stop.verdict).toBe("DIAGNOSTIC_PREFLIGHT_STOP");
    expect(stop.failures).toContain("MODEL_API_KEY_ENV_ABSENT");
    expect(mock.calls).toBe(0);
    const refused = await diagnosticRun({ artifactOut: "never.json" }, { apiKey: "", fetchImpl: mock.fetchImpl });
    expect(refused.verdict).toBe("DIAGNOSTIC_PREFLIGHT_STOP");
    expect(refused.model_calls).toBe(0);
    expect(mock.calls).toBe(0);
  });

  it("TEST_J5_BUDGET_AND_TARGET_STOP_ARE_ENFORCED", async () => {
    // Three schema-invalid responses reach the target and stop before the budget.
    const invalid = JSON.stringify({ ...validProposal(), schema_version: "wrong" });
    const mock = mockEnvelopeFetch([invalid, invalid, invalid, invalid, invalid]);
    const transport = createDiagnosticTransport(TEST_KEY, "https://api.example.invalid", { fetchImpl: mock.fetchImpl, backoffMs: [0, 0], sleepImpl: async () => undefined });
    const stopped = await runDiagnostic({ transport, maxCalls: 30 });
    expect(stopped.summary.model_calls).toBe(DIAGNOSTIC_TARGET_SCHEMA_INVALID_EXAMPLES);
    expect(stopped.summary.stopped_by).toBe("TARGET_SCHEMA_INVALID_EXAMPLES_REACHED");
    expect(stopped.summary.taxonomy.categories_observed).toContain("SCHEMA_VERSION_INVALID");

    // With only valid responses the budget bounds the run.
    const validMock = mockEnvelopeFetch([JSON.stringify(validProposal())]);
    const validTransport = createDiagnosticTransport(TEST_KEY, "https://api.example.invalid", { fetchImpl: validMock.fetchImpl, backoffMs: [0, 0], sleepImpl: async () => undefined });
    const bounded = await runDiagnostic({ transport: validTransport, maxCalls: 4 });
    expect(bounded.summary.model_calls).toBe(4);
    expect(bounded.summary.stopped_by).toBe("BUDGET_EXHAUSTED");
    expect(bounded.summary.taxonomy.categories_observed).toEqual([]);
    expect(bounded.summary.taxonomy.categories_declared_but_unobserved).toEqual([...FAILURE_TAXONOMY_IDS].sort());
  });

  it("TEST_K_LENGTH_BOUND_RULE_IS_EVIDENCE_MAPPED", async () => {
    // A model-authored free-text field over an UNPUBLISHED host bound: the
    // production validator reports the bound, and the taxonomy names it instead
    // of burying it in OTHER_SCHEMA_FAILURE.
    const proposal = validProposal();
    proposal["communication_directive"] = { kind: "CLARIFY_MISSING_CONTEXT" };
    proposal["response_semantics"] = { kind: "PRIMARY_CLARIFICATION" };
    // The advertised handles must be cited, exactly as the real failing responses
    // did, so the fixture reaches the LENGTH rule rather than an earlier one.
    (proposal["cognition"] as Record<string, unknown>)["considered_handles"] = ["F1", "C1"];
    proposal["clarification_basis"] = {
      current_observation_ref: "observation:o-source-event-bcv1-current-scene-1",
      missing_information: "x".repeat(300),
      needed_for: "planning"
    };
    const trace = await traceFor(JSON.stringify(proposal));
    expect(trace.STAGE_D_PRODUCTION_SCHEMA).toBe("FAIL");
    expect(trace.stage_details.production_schema.detail?.raw).toMatch(/exceeds \d+ code points/);
    expect(trace.stage_details.production_schema.detail?.path_prefix).toBe(
      "conversation proposal.clarification_basis.missing_information"
    );
    const classification = classifyResponse(trace);
    expect(classification.classification).toBe("SCHEMA_CONTRACT_VIOLATION");
    expect(classification.taxonomy).toContain("LENGTH_BOUND_EXCEEDED");
  });

  it("TEST_K2_RECLASSIFY_IS_OFFLINE_AND_NON_DESTRUCTIVE", () => {
    const stored = {
      schema_version: "executor-schema-failure-diagnostic-v0",
      diagnostic_id: "EXPLORATORY_EXECUTOR_SCHEMA_FAILURE_DIAGNOSTIC_V0",
      namespace: "EXECUTOR_SCHEMA_DIAGNOSTIC",
      markers: {},
      calibration_reference: {},
      stop_rule: {},
      model: {},
      request_binding: {},
      responses: [
        {
          validation_trace: {
            stage_details: {
              production_schema: { detail: { raw: "conversation proposal.clarification_basis.missing_information: exceeds 256 code points" } },
              production_host_authority: { detail: null, factual_rejection_codes: [], response_semantics_rejected: false },
              directive_admissibility: { directive: null, allowed_atoms: [], admissible: false }
            },
            STAGE_A_TRANSPORT: "PASS",
            STAGE_B_ENVELOPE_JSON: "PASS",
            STAGE_C_CONTENT_JSON: "PASS",
            STAGE_E_PRODUCTION_HOST_AUTHORITY: "NOT_REACHED",
            STAGE_F_DIRECTIVE_ADMISSIBILITY: "NOT_REACHED",
            production_pipeline_verdict: { threw: true, code: "MODEL_SCHEMA_INVALID", message: "x", factual_authorization_trace: [], directive: null }
          },
          classification: { classification: "SCHEMA_CONTRACT_VIOLATION", taxonomy: ["OTHER_SCHEMA_FAILURE"], evidence: [] }
        }
      ],
      summary: { taxonomy: { categories_observed: ["OTHER_SCHEMA_FAILURE"], counts: {}, classifications: {}, examples_by_category: {}, categories_declared_but_unobserved: [] } },
      artifact_hash: "sha256:stored"
    };
    const derived = reclassifyArtifact({ artifact: stored as never }) as Record<string, unknown>;
    const reclassification = derived["reclassification"] as Record<string, unknown>;
    expect(reclassification["makes_model_calls"]).toBe(false);
    expect(reclassification["original_artifact_left_unmodified"]).toBe(true);
    expect(reclassification["vocabulary_added_after_run"]).toEqual(["LENGTH_BOUND_EXCEEDED"]);
    // The STORED artifact object is not mutated: the original category survives.
    expect((stored.responses[0] as { classification: { taxonomy: string[] } }).classification.taxonomy).toEqual(["OTHER_SCHEMA_FAILURE"]);
    const summary = derived["summary"] as { taxonomy: { categories_observed: string[] } };
    expect(summary.taxonomy.categories_observed).toContain("LENGTH_BOUND_EXCEEDED");
  });

  it("TEST_J6_TAXONOMY_VOCABULARY_IS_NOT_A_HYPOTHESIS", () => {
    expect(FAILURE_TAXONOMY_IDS.length).toBeGreaterThan(0);
    expect(FAILURE_TAXONOMY_IDS).toContain("OTHER_SCHEMA_FAILURE");
    expect(FAILURE_TAXONOMY_IDS).not.toContain("ROOT_CAUSE");
  });
});
