/* eslint-disable no-restricted-imports -- Research harness: imports frozen production contracts and the frozen experiment by relative path. */
/**
 * POST_PARITY_SCHEMA_FAILURE_DIAGNOSTIC — Phase A tests (1–12).
 *
 * ZERO model calls, ZERO network calls: every case injects a mock fetch. These are
 * the Phase A gate — the bounded exploratory calls are lawful only once this file
 * passes AND the instrumentation is committed.
 */
import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { canonicalizeConversationCognitionModelOutputV8 } from "../../../packages/runtime/dist/index.js";

import { buildCalibrationProjection, buildCalibrationSubject } from "../belief-causal-confirmatory-stochastic-v1/calibration-request.ts";
import { modelConfigManifest } from "../belief-causal-confirmatory-stochastic-v1/contract.ts";
import { hashJson } from "../belief-causal-confirmatory-stochastic-v1/histories.ts";
import { classifyResponse } from "../executor-schema-failure-diagnostic-v0/taxonomy.ts";

import {
  DIAGNOSTIC_MARKERS,
  DIAGNOSTIC_NAMESPACE,
  DIAGNOSTIC_STOP_RULE,
  FAILURE_TAXONOMY_DECLARED_BEFORE_CALLS,
  MAX_CALLS,
  POST_PARITY_AUTHORITY,
  TARGET_SCHEMA_INVALID_EXAMPLES
} from "./contract.ts";
import { assertPostParityRequest, buildPostParityRequest, PostParityRequestMismatchError, runPostParityDiagnostic } from "./runner.ts";
import { diagnosticPreflight, diagnosticRun } from "./cli.ts";
import { createDiagnosticTransport, scanAndRedactCredentialPatterns } from "../executor-schema-failure-diagnostic-v0/diagnostic-transport.ts";

const REPO_ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "..");
const DIAGNOSTIC_DIR = "research/experiments/post-parity-schema-failure-diagnostic-v0";
const EXPERIMENT_DIR = "research/experiments/belief-causal-confirmatory-stochastic-v1";
const TEST_KEY = "sk-post-parity-diagnostic-test-key-0000";
const OLD_REQUEST_HASH = "sha256:db8d8993c63e6de476c4ddb28dff5c55d5716f8f1fb3cc23ccfcd841bc31f509";

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}

function validProposal(): Record<string, unknown> {
  return {
    schema_version: "conversation-cognition-proposal-v8",
    response_semantics: { kind: "PRIMARY_CONVERSATIONAL_ACT", act: "ACKNOWLEDGE" },
    factual_assessment: { claims: [] },
    cognition: {
      schema_version: "cognition-proposal-v0",
      reasoning_summary: "post-parity diagnostic fixture",
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

/** A CLARIFY proposal whose basis exceeds the advertised bound (the known rule). */
function overBoundProposal(): Record<string, unknown> {
  const proposal = validProposal();
  proposal["response_semantics"] = { kind: "PRIMARY_CLARIFICATION" };
  (proposal["cognition"] as Record<string, unknown>)["considered_handles"] = ["F1", "C1"];
  proposal["communication_directive"] = { kind: "CLARIFY_MISSING_CONTEXT" };
  proposal["clarification_basis"] = {
    current_observation_ref: "observation:o-source-event-bcv1-current-scene-1",
    missing_information: "x".repeat(273),
    needed_for: "planning"
  };
  return proposal;
}

interface MockHandle {
  readonly fetchImpl: typeof fetch;
  readonly bodies: string[];
  calls(): number;
}

function mockFetchFor(contents: readonly string[], options: { readonly model?: string } = {}): MockHandle {
  const bodies: string[] = [];
  let calls = 0;
  const fetchImpl = (async (_url: unknown, init: unknown) => {
    bodies.push(String((init as { body?: unknown }).body ?? ""));
    const content = contents[Math.min(calls, contents.length - 1)] ?? "";
    calls += 1;
    return new Response(
      JSON.stringify({
        model: options.model ?? "deepseek-flash",
        choices: [{ message: { content, reasoning_content: "internal reasoning that is never persisted" }, finish_reason: "stop" }],
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150, prompt_tokens_details: { cached_tokens: 20 }, completion_tokens_details: { reasoning_tokens: 7 } }
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  }) as unknown as typeof fetch;
  return { fetchImpl, bodies, calls: () => calls };
}

function transportFor(mock: MockHandle) {
  return createDiagnosticTransport(TEST_KEY, "https://api.example.invalid", {
    fetchImpl: mock.fetchImpl,
    backoffMs: [0, 0],
    sleepImpl: async () => undefined
  });
}

/* 1 / 2 — the new request authority -------------------------------------------------- */

describe("POST-PARITY DIAGNOSTIC — 1/2: the request is the post-parity calibration request", () => {
  it("TEST_1_REQUEST_HASH_IS_79F1D679", async () => {
    const binding = await buildPostParityRequest({
      schemaHash: hashJson((await import("../../../packages/runtime/dist/index.js")).CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA),
      modelConfigHash: hashJson(modelConfigManifest())
    });
    expect(binding.request_hash).toBe(POST_PARITY_AUTHORITY.request_hash);
    expect(binding.request_hash).toBe("sha256:79f1d679c6dcd9622f4f154055462ca540eed56680847499a3b4420971ac9c35");
    expect(binding.reconstructed_hashes.system_hash).toBe(POST_PARITY_AUTHORITY.system_hash);
    expect(binding.reconstructed_hashes.user_hash).toBe(POST_PARITY_AUTHORITY.user_hash);
    expect(binding.reconstructed_hashes.model_config_hash).toBe(POST_PARITY_AUTHORITY.model_config_hash);
    expect(binding.divergences).toEqual([]);
  });

  it("TEST_2_REQUEST_BYTES_ARE_17381", async () => {
    const binding = await buildPostParityRequest();
    expect(binding.body_bytes).toBe(17381);
    expect(binding.body_bytes).toBe(POST_PARITY_AUTHORITY.request_bytes);
  });

  it("TEST_1B_NO_DIAGNOSTIC_PROMPT_AUGMENTATION", async () => {
    const binding = await buildPostParityRequest();
    // byte-identity is the guard: no hint, few-shot, "stay below N" or repair text.
    expect(binding.request_hash).toBe(POST_PARITY_AUTHORITY.request_hash);
    expect(binding.serialized_body).not.toMatch(/few-?shot|stay below|debug/iu);
  });
});

/* 3 — the superseded request is refused ---------------------------------------------- */

describe("POST-PARITY DIAGNOSTIC — 3: the superseded request is rejected", () => {
  it("TEST_3_OLD_DB8D8993_IS_NOT_THE_BINDING", async () => {
    const binding = await buildPostParityRequest();
    expect(binding.request_hash).not.toBe(OLD_REQUEST_HASH);
    expect(binding.body_bytes).not.toBe(16085);
    expect(() =>
      assertPostParityRequest({ ...binding, request_hash: OLD_REQUEST_HASH, divergences: ["REQUEST_HASH_DIVERGENCE"] })
    ).toThrow(PostParityRequestMismatchError);
    // the old hash survives only as recorded history
    expect(POST_PARITY_AUTHORITY.post_parity_calibration_terminal_result).toBe("EXECUTOR_CALIBRATION_RESULT_APPROVED_STOP_EARLY");
    expect(POST_PARITY_AUTHORITY.formal_calibration_failure_exact_rule).toBe("UNKNOWN_OR_NOT_PERSISTED");
    expect(POST_PARITY_AUTHORITY.formal_calibration_root_cause).toBe("NOT_IDENTIFIED");
  });
});

/* 4 / 5 — raw capture and the exact validation trace ---------------------------------- */

describe("POST-PARITY DIAGNOSTIC — 4/5: raw capture and the production trace", () => {
  it("TEST_4_RAW_RESPONSE_IS_CAPTURED", async () => {
    const mock = mockFetchFor([JSON.stringify(validProposal())]);
    const outcome = await transportFor(mock).complete("{}");
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error("unreachable");
    expect(outcome.raw_envelope.length).toBeGreaterThan(0);
    expect(outcome.content).toContain("conversation-cognition-proposal-v8");
    expect(outcome.model).toBe("deepseek-flash");
    expect(outcome.finish_reason).toBe("stop");
    expect(outcome.reasoning_content_present).toBe(true);
    expect(outcome.usage.total_tokens).toBe(150);
    // the transport reports presence; the RUNNER strips the reasoning BODY from the
    // stored envelope, so the artifact can never carry it forward
    const result = await runPostParityDiagnostic({ transport: transportFor(mockFetchFor([JSON.stringify(validProposal())])), maxCalls: 1 });
    const record = result.responses[0];
    expect(record?.reasoning_content_present).toBe(true);
    expect(record?.reasoning_content_stripped_from_artifact).toBe(true);
    expect(record?.raw_envelope ?? "").not.toContain("internal reasoning that is never persisted");
    expect(record?.raw_envelope ?? "").toContain("<stripped:reasoning_content>");
  });

  it("TEST_5_EXACT_PRODUCTION_TRACE", async () => {
    const mock = mockFetchFor([JSON.stringify(overBoundProposal())]);
    const transport = transportFor(mock);
    const result = await runPostParityDiagnostic({ transport, maxCalls: 1 });
    const record = result.responses[0];
    expect(record.validation_trace.STAGE_A_TRANSPORT).toBe("PASS");
    expect(record.validation_trace.STAGE_B_ENVELOPE_JSON).toBe("PASS");
    expect(record.validation_trace.STAGE_C_CONTENT_JSON).toBe("PASS");
    expect(record.validation_trace.STAGE_D_PRODUCTION_SCHEMA).toBe("FAIL");
    expect(record.validation_trace.STAGE_E_PRODUCTION_HOST_AUTHORITY).toBe("NOT_REACHED");
    const detail = record.validation_trace.stage_details.production_schema.detail;
    expect(detail?.raw).toContain("exceeds 256 code points");
    expect(detail?.path_prefix).toBe("conversation proposal.clarification_basis.missing_information");
    expect(detail?.structured_fields).toBe("NOT_EXPOSED_BY_PRODUCTION_VALIDATOR");
    expect(record.validation_trace.production_pipeline_verdict.code).toBe("MODEL_SCHEMA_INVALID");
    expect(record.classification.taxonomy).toContain("LENGTH_BOUND_EXCEEDED");
  });
});

/* 6 — schema-invalid is never retried ------------------------------------------------ */

describe("POST-PARITY DIAGNOSTIC — 6: validation failures are never retried", () => {
  it("TEST_6_NO_RETRY_ON_SCHEMA_FAILURE", async () => {
    const mock = mockFetchFor([JSON.stringify(overBoundProposal())]);
    const result = await runPostParityDiagnostic({ transport: transportFor(mock), maxCalls: 3 });
    expect(result.summary.retries).toBe(0);
    expect(result.responses.every((record) => record.transport_status.raw_attempts === 1)).toBe(true);
    expect(mock.calls()).toBe(TARGET_SCHEMA_INVALID_EXAMPLES);
  });
});

/* 7 — the credential never reaches an artifact --------------------------------------- */

describe("POST-PARITY DIAGNOSTIC — 7: no credential is ever persisted", () => {
  it("TEST_7_SECRET_NEVER_PERSISTED", async () => {
    const mock = mockFetchFor([JSON.stringify(validProposal())]);
    const written: { path: string | null; text: string } = { path: null, text: "" };
    const report = await diagnosticRun(
      { artifactOut: "tmp/post-parity-diagnostic.json" },
      {
        apiKey: TEST_KEY,
        fetchImpl: mock.fetchImpl,
        maxCalls: 1,
        writeArtifact: (path: string, text: string) => {
          written.path = path;
          written.text = text;
        }
      }
    );
    expect(report.model_calls).toBe(1);
    expect(written.path).toBe("tmp/post-parity-diagnostic.json");
    expect(written.text).not.toContain(TEST_KEY);
    expect(written.text).not.toMatch(/"authorization"\s*:/i);
    expect(written.text).not.toMatch(/sk-[A-Za-z0-9]{16,}/);
    expect(written.text).not.toMatch(/Bearer\s+[A-Za-z0-9._-]{16,}/);
    expect(scanAndRedactCredentialPatterns(`Bearer ${TEST_KEY}`).hits).toBeGreaterThan(0);
  });
});

/* 8 — prior artifacts stay immutable -------------------------------------------------- */

describe("POST-PARITY DIAGNOSTIC — 8: prior results are untouched", () => {
  it("TEST_8_OLD_ARTIFACTS_IMMUTABLE", () => {
    const tracked = JSON.parse(
      readFileSync(join(REPO_ROOT, EXPERIMENT_DIR, "evidence/calibration-request.json"), "utf8")
    ) as { hashes: { model_facing_request_hash: string } };
    expect(tracked.hashes.model_facing_request_hash).toBe(OLD_REQUEST_HASH);

    const consumedEvidence = join(REPO_ROOT, "tmp/bcv1/calibration-evidence-917d5d1.json");
    if (existsSync(consumedEvidence)) {
      const evidence = JSON.parse(readFileSync(consumedEvidence, "utf8")) as { evidence_hash: string };
      expect(evidence.evidence_hash).toBe("sha256:a556a5193be0d9b5e147790a10e956f7e85faea99fbc50c7edc5d0624b92bf48");
    }
    const postParityEvidence = join(REPO_ROOT, "tmp/bcv1/calibration-evidence-post-parity.json");
    if (existsSync(postParityEvidence)) {
      const evidence = JSON.parse(readFileSync(postParityEvidence, "utf8")) as { evidence_hash: string };
      expect(evidence.evidence_hash).toBe("sha256:4903749a36df562f8793b1e352fb6f0cd624ec97ec9d6bbb90803f00415bd128");
    }
    const oldDiagnostic = join(REPO_ROOT, "tmp/diag/executor-schema-failure-diagnostic-v0.json");
    if (existsSync(oldDiagnostic)) {
      const artifact = JSON.parse(readFileSync(oldDiagnostic, "utf8")) as Record<string, unknown> & { artifact_hash: string };
      const { artifact_hash: recorded, ...core } = artifact;
      expect(`sha256:${createHash("sha256").update(canonicalJson(core), "utf8").digest("hex")}`).toBe(recorded);
      expect(recorded).toBe("sha256:4295cdc473128730c302055c84987527a70ea79ac5ba7432e95962ccd59a0da5");
    }
    // the new namespace is isolated from the old one
    expect(DIAGNOSTIC_NAMESPACE).toBe("POST_PARITY_SCHEMA_FAILURE_DIAGNOSTIC");
    const dir = join(REPO_ROOT, DIAGNOSTIC_DIR);
    for (const file of ["runner.ts", "cli.ts", "contract.ts"]) {
      expect(readFileSync(join(dir, file), "utf8")).not.toMatch(/writeCalibrationEvidence|calibration-evidence/);
    }
  });
});

/* 9 / 10 / 11 — the frozen stop rule -------------------------------------------------- */

describe("POST-PARITY DIAGNOSTIC — 9/10/11: the pre-written budget is enforced", () => {
  it("TEST_9_STOPS_AT_TWO_SCHEMA_INVALID_EXAMPLES", async () => {
    const mock = mockFetchFor([JSON.stringify(overBoundProposal())]);
    const result = await runPostParityDiagnostic({ transport: transportFor(mock), maxCalls: MAX_CALLS });
    expect(result.summary.schema_invalid).toBe(TARGET_SCHEMA_INVALID_EXAMPLES);
    expect(result.summary.model_calls).toBe(TARGET_SCHEMA_INVALID_EXAMPLES);
    expect(result.summary.stopped_by).toBe("TARGET_SCHEMA_INVALID_EXAMPLES_REACHED");
    expect(result.summary.taxonomy.categories_observed).toContain("LENGTH_BOUND_EXCEEDED");
  });

  it("TEST_10_STOPS_AT_THE_MAX_CALL_BUDGET", async () => {
    const mock = mockFetchFor([JSON.stringify(validProposal())]);
    const result = await runPostParityDiagnostic({ transport: transportFor(mock), maxCalls: 5 });
    expect(result.summary.model_calls).toBe(5);
    expect(result.summary.stopped_by).toBe("MAX_CALL_BUDGET_REACHED");
    expect(result.summary.schema_invalid).toBe(0);
    expect(result.summary.taxonomy.categories_observed).toEqual([]);
    expect(result.summary.taxonomy.categories_declared_but_unobserved.length).toBe(
      FAILURE_TAXONOMY_DECLARED_BEFORE_CALLS.length
    );
    // the seam can only tighten the frozen budget, never widen it
    const capped = await runPostParityDiagnostic({ transport: transportFor(mock), maxCalls: MAX_CALLS + 100 });
    expect(capped.summary.model_calls).toBeLessThanOrEqual(MAX_CALLS);
  });

  it("TEST_11_NO_TRIAL_BEYOND_THE_BUDGET_AND_NO_TRIAL_41", async () => {
    const mock = mockFetchFor([JSON.stringify(validProposal())]);
    const result = await runPostParityDiagnostic({ transport: transportFor(mock), maxCalls: MAX_CALLS });
    expect(result.responses.length).toBeLessThanOrEqual(MAX_CALLS);
    for (const record of result.responses) {
      const index = Number(record.trial_id.split("|")[1]);
      expect(index).toBeLessThanOrEqual(MAX_CALLS);
    }
    expect(mock.calls()).toBeLessThanOrEqual(MAX_CALLS);
    expect(DIAGNOSTIC_STOP_RULE.budget_may_be_widened_after_outcomes).toBe(false);
    expect(DIAGNOSTIC_STOP_RULE.estimates_failure_rate).toBe(false);
  });
});

/* 12 — zero production writes --------------------------------------------------------- */

describe("POST_PARITY DIAGNOSTIC — 12: no production write", () => {
  it("TEST_12_NO_PRODUCTION_WRITE_AND_NO_STATE_MUTATION", async () => {
    const source = ["runner.ts", "cli.ts", "contract.ts", "hash.ts"].map((file) =>
      readFileSync(join(REPO_ROOT, DIAGNOSTIC_DIR, file), "utf8")
    );
    for (const text of source) {
      expect(text).not.toMatch(/commitReserved|reserveAndRoute|writeBelief|BeliefTransitionExecutor|runForEpisodeRefs/);
      expect(text).not.toMatch(/writeFileSync\(\s*["'`](?!tmp|.*artifactOut)/);
    }
    // and the diagnostic itself performs no filesystem write outside the artifact path
    const mock = mockFetchFor([JSON.stringify(validProposal())]);
    const written: string[] = [];
    await diagnosticRun(
      { artifactOut: "tmp/x.json" },
      {
        apiKey: TEST_KEY,
        fetchImpl: mock.fetchImpl,
        maxCalls: 1,
        writeArtifact: (path: string) => {
          written.push(path);
        }
      }
    );
    expect(written).toEqual(["tmp/x.json"]);
  });

  it("TEST_12B_PREFLIGHT_IS_ZERO_CALL_AND_REFUSES_WITHOUT_CREDENTIAL", async () => {
    const mock = mockFetchFor([JSON.stringify(validProposal())]);
    const pass = await diagnosticPreflight({ apiKey: TEST_KEY, fetchImpl: mock.fetchImpl });
    expect(pass.verdict).toBe("DIAGNOSTIC_PREFLIGHT_PASS");
    expect(pass.model_calls).toBe(0);
    expect(pass.network_calls).toBe(0);
    expect(pass.transport_constructed).toBe(false);
    expect(mock.calls()).toBe(0);
    const stop = await diagnosticPreflight({ apiKey: "" });
    expect(stop.verdict).toBe("DIAGNOSTIC_PREFLIGHT_STOP");
    expect(stop.failures).toContain("MODEL_API_KEY_ENV_ABSENT");
    expect(mock.calls()).toBe(0);
    const refused = await diagnosticRun({ artifactOut: "never.json" }, { apiKey: "", fetchImpl: mock.fetchImpl });
    expect(refused.verdict).toBe("DIAGNOSTIC_PREFLIGHT_STOP");
    expect(refused.model_calls).toBe(0);
    expect(mock.calls()).toBe(0);
  });

  it("TEST_12C_MARKERS_AND_NO_CONFIRMATORY_VOCABULARY", async () => {
    const result = await runPostParityDiagnostic({
      transport: transportFor(mockFetchFor([JSON.stringify(validProposal())])),
      maxCalls: 1
    });
    expect(result.markers).toEqual(DIAGNOSTIC_MARKERS);
    expect(result.markers.NOT_CALIBRATION_RERUN).toBe(true);
    expect(result.markers.NOT_IN_CALIBRATION_DENOMINATOR).toBe(true);
    expect(result.markers.NOT_PRIMARY_AUTHORIZATION_EVIDENCE).toBe(true);
    expect("decision" in result).toBe(false);
    expect("verdict" in result).toBe(false);
    expect(JSON.stringify(result)).not.toMatch(/EXECUTOR_CALIBRATION_RUN|REPLICATED/);
    // the production validator is still the acceptance authority: 255/256 pass, 257 fails
    const subject = await buildCalibrationSubject();
    const projection = await buildCalibrationProjection(subject);
    const verdict = (missing: string): boolean => {
      const proposal = overBoundProposal() as { clarification_basis: { missing_information: string } };
      proposal.clarification_basis.missing_information = missing;
      const checked = canonicalizeConversationCognitionModelOutputV8(
        proposal as never,
        projection as never,
        (projection as { projection_hash: string }).projection_hash as never
      );
      return checked.ok;
    };
    expect(verdict("a".repeat(256))).toBe(true);
    expect(verdict("a".repeat(257))).toBe(false);
    void hashJson;
    void classifyResponse;
  });
});
