/* eslint-disable no-restricted-imports -- Research harness: imports frozen production contracts and the frozen protocol by relative path. */
/**
 * BELIEF_CAUSAL_CONFIRMATORY_STOCHASTIC_V1 — POST-PARITY AUTHORITY TESTS.
 *
 * ZERO model calls, ZERO network calls: every case injects a mock transport and a
 * mock authority. These tests pin the NEW preregistration authority: that the old
 * authority is rejected, that every tamper class yields 0 network calls, that the
 * calibration readiness law is unchanged, and that the model-visible contract
 * boundary is exactly the law the validator enforces.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  canonicalizeConversationCognitionModelOutputV8,
  CLARIFICATION_BASIS_TEXT_MAX_CODE_POINTS,
  CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA
} from "../../../packages/runtime/dist/index.js";
import {
  CONVERSATION_COGNITION_FIELD_BOUNDS_CLAUSE_V8,
  CONVERSATION_COGNITION_SYSTEM_PROMPT_V8,
  renderCognitionProposalContractV8
} from "../../../packages/runtime/dist/providers/behavior/conversation-cognition-provider-v8.js";

import {
  CALIBRATION_MAXIMUM_NON_HOST_VALID_COUNT,
  CALIBRATION_MINIMUM_HOST_VALID_COUNT,
  CALIBRATION_SCHEDULED_LOGICAL_TRIALS,
  evaluateCalibrationLaw
} from "./calibration-law.ts";
import { runCalibration } from "./calibration-runner.ts";
import {
  buildCalibrationProjection,
  buildCalibrationRequest,
  buildCalibrationSubject,
  FROZEN_CALIBRATION_REQUEST_HASH,
  serializeAuthoritativeRequest
} from "./calibration-request.ts";
import { buildPreregDesign } from "./manifest.ts";
import {
  AUTHORITY_EXECUTOR,
  AUTHORITY_LIMITATIONS,
  AUTHORITY_SCIENTIFIC_INVARIANTS,
  authorityBindingDivergences,
  CONTRACT_PARITY_REMEDIATION,
  contractParityBinding,
  PREREG_AUTHORITY_VERSION,
  SUPERSEDED_AUTHORITY
} from "./prereg-authority.ts";
import { modelConfigManifest } from "./contract.ts";
import { hashJson } from "./histories.ts";
import { auditScanSurface } from "./scan-surface.ts";
import { mockAuthority, mockTransport, realAuthoritativeRequest, type MockOutcome } from "./test-support.ts";

const REPO_ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "..");
const EXPERIMENT_DIR = "research/experiments/belief-causal-confirmatory-stochastic-v1";
const EVIDENCE_DIR = join(REPO_ROOT, EXPERIMENT_DIR, "evidence");
const SCAN_SURFACE = auditScanSurface(hashJson(CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA)).exact_scan_surface;

const OLD_REQUEST = SUPERSEDED_AUTHORITY.request_hash;
const OLD_SYSTEM = SUPERSEDED_AUTHORITY.system_hash;
const OLD_SCHEMA = SUPERSEDED_AUTHORITY.schema_hash;
const CONSUMED_USER_HASH = "sha256:55d27d60fe3087537e66c1075dbe43677160ddbc0d8569207577b46962a219f3";
const CONSUMED_CONFIG_HASH = "sha256:0ed9df37fb4b2981ae5ff69bbe37c0858ea82cec200bb87249f66478927810d5";

async function newContractRequest(): Promise<Awaited<ReturnType<typeof realAuthoritativeRequest>>> {
  return await realAuthoritativeRequest();
}

/* -------------------------------------------------------------------------- */
/* 1 — the authority's own binding                                             */
/* -------------------------------------------------------------------------- */

describe("POST-PARITY AUTHORITY — the frozen model-visible contract", () => {
  it("TEST_AUTHORITY_BINDING_IS_REPRODUCIBLE", async () => {
    const request = await newContractRequest();
    const binding = contractParityBinding({
      systemHash: request.hashes.system_hash,
      userHash: request.hashes.user_hash,
      schemaHash: request.hashes.schema_hash,
      modelConfigHash: request.hashes.model_config_hash,
      requestHash: request.request_hash,
      requestBodyBytes: Buffer.byteLength(request.serialized_body, "utf8")
    });
    expect(binding.authority_version).toBe("POST_PARITY_V1");
    expect(binding.serialization).toBe("canonicalJson");
    expect(binding.production_only_model_authored_constraints).toBe(0);
    expect(binding.request_body_bytes).toBe(17381);
    expect(binding.remediation_commit).toBe("452dc6852501c6958c0add78387a4aa6432942c1");
    expect(authorityBindingDivergences(binding)).toEqual([]);
    // the superseded authority's hashes are NOT the live ones
    expect(binding.request_hash).not.toBe(OLD_REQUEST);
    expect(binding.system_hash).not.toBe(OLD_SYSTEM);
    expect(binding.schema_hash).not.toBe(OLD_SCHEMA);
  });

  it("TEST_AUTHORITY_USER_AND_CONFIG_HASHES_ARE_UNCHANGED", async () => {
    const request = await newContractRequest();
    // The subject rendering and the executor configuration are untouched by the
    // contract remediation: recomputed independently, not assumed.
    expect(request.hashes.user_hash).toBe(CONSUMED_USER_HASH);
    expect(request.hashes.model_config_hash).toBe(CONSUMED_CONFIG_HASH);
    expect(request.hashes.model_config_hash).toBe(hashJson(modelConfigManifest()));
    expect(AUTHORITY_EXECUTOR.model).toBe("deepseek-flash");
    expect(AUTHORITY_EXECUTOR.temperature).toBe(0);
    expect(AUTHORITY_EXECUTOR.max_tokens).toBe(16384);
    expect(AUTHORITY_EXECUTOR.fallbacks).toEqual([]);
    expect(AUTHORITY_EXECUTOR.unchanged_from_superseded_authority).toBe(true);
  });

  it("TEST_AUTHORITY_SCIENTIFIC_INVARIANTS_ARE_UNCHANGED", () => {
    expect(AUTHORITY_SCIENTIFIC_INVARIANTS.experiment_id).toBe("BELIEF_CAUSAL_CONFIRMATORY_STOCHASTIC_V1");
    expect(AUTHORITY_SCIENTIFIC_INVARIANTS.changes_from_superseded_authority).toEqual([]);
    expect(AUTHORITY_SCIENTIFIC_INVARIANTS.delta_min).toBe(0.2);
    expect(AUTHORITY_SCIENTIFIC_INVARIANTS.epsilon).toBe(0.15);
    expect(AUTHORITY_SCIENTIFIC_INVARIANTS.n_per_cell_per_phase).toBe(200);
    expect(AUTHORITY_SCIENTIFIC_INVARIANTS.calibration_scheduled_draws).toBe(50);
    expect(AUTHORITY_SCIENTIFIC_INVARIANTS.minimum_host_valid).toBe(48);
    expect(AUTHORITY_SCIENTIFIC_INVARIANTS.maximum_non_host_valid).toBe(2);
    expect(AUTHORITY_SCIENTIFIC_INVARIANTS.outcome_diversity_gate).toBe("NONE");
    expect(AUTHORITY_SCIENTIFIC_INVARIANTS.cells).toEqual(["A_LOW", "B_HIGH", "C_HIGH_ABLATED", "D_LOW_EQUALIZED"]);
    expect(AUTHORITY_SCIENTIFIC_INVARIANTS.scenario_text_unchanged).toBe(true);
    expect(AUTHORITY_SCIENTIFIC_INVARIANTS.belief_decision_remains_dead).toBe(true);
    expect(CONTRACT_PARITY_REMEDIATION.production_accept_reject_semantics_changed).toBe(false);
    expect(SUPERSEDED_AUTHORITY.may_be_reissued).toBe(false);
    expect(SUPERSEDED_AUTHORITY.terminal_result).toBe("EXECUTOR_CALIBRATION_RESULT_APPROVED_STOP_EARLY");
    expect(SUPERSEDED_AUTHORITY.calibration_authorization).toBe("CONSUMED");
  });

  it("TEST_AUTHORITY_MAKES_NO_READINESS_CLAIM", () => {
    const text = AUTHORITY_LIMITATIONS.join(" ");
    expect(text).toContain("EMPTY genesis");
    expect(text).toContain("says nothing about whether the executor will comply");
    expect(PREREG_AUTHORITY_VERSION).toBe("POST_PARITY_V1");
    // the authority module itself must not claim the executor is now ready
    const source = readFileSync(join(REPO_ROOT, EXPERIMENT_DIR, "prereg-authority.ts"), "utf8");
    expect(source).not.toMatch(/READY_FOR_CALIBRATION|EXECUTOR_READY|SCHEMA_FAILURE_FIXED/);
  });

  it("TEST_MANIFEST_DESIGN_BINDS_THE_PARITY_AUTHORITY", () => {
    const design = buildPreregDesign(EVIDENCE_DIR) as Record<string, unknown>;
    const parity = design["contract_parity"] as Record<string, unknown>;
    expect(parity["authority_version"]).toBe("POST_PARITY_V1");
    expect(parity["remediation_commit"]).toBe(CONTRACT_PARITY_REMEDIATION.commit);
    expect(parity["production_only_model_authored_constraints"]).toBe(0);
    expect(parity["request_body_bytes"]).toBe(17381);
    expect(parity["serialization"]).toBe("canonicalJson");
    expect(typeof parity["parity_inventory_hash"]).toBe("string");
    expect(design["prereg_authority_version"]).toBe("POST_PARITY_V1");
  });

  it("TEST_TRACKED_PREcheck_RECORDS_THE_PARITY_BINDING", () => {
    const precheck = JSON.parse(readFileSync(join(EVIDENCE_DIR, "precheck.json"), "utf8")) as {
      readonly ok: boolean;
      readonly failed: readonly string[];
      readonly checks: Record<string, { readonly passed: boolean; readonly detail: Record<string, unknown> }>;
    };
    expect(precheck.ok).toBe(true);
    expect(precheck.failed).toEqual([]);
    const p25 = precheck.checks["P25_CONTRACT_PARITY_BINDING"];
    expect(p25?.passed).toBe(true);
    expect(p25?.detail["production_only_model_authored_constraints"]).toBe(0);
    expect((p25?.detail["contract"] as Record<string, unknown>)["request_hash"]).toBe(
      "sha256:79f1d679c6dcd9622f4f154055462ca540eed56680847499a3b4420971ac9c35"
    );
  });
});

/* -------------------------------------------------------------------------- */
/* 2 — the old authority is rejected (§18)                                     */
/* -------------------------------------------------------------------------- */

describe("POST-PARITY AUTHORITY — the superseded authority cannot be reused", () => {
  it("TEST_OLD_MANIFEST_UNDER_THE_NEW_APPROVED_SHA_IS_REJECTED_WITH_ZERO_CALLS", async () => {
    // HEAD is the old prereg, the manifest binds the old prereg, but the operator
    // approved the NEW prereg: the three-way law must refuse before any call.
    const base = await newContractRequest();
    const stale = await mockAuthority({
      head: SUPERSEDED_AUTHORITY.commit,
      manifestSha: SUPERSEDED_AUTHORITY.commit,
      approvedSha: "4".repeat(40),
      renderRequest: async () => ({
        ...base,
        request_hash: OLD_REQUEST,
        hashes: { ...base.hashes, system_hash: OLD_SYSTEM, schema_hash: OLD_SCHEMA, model_facing_request_hash: OLD_REQUEST }
      })
    });
    const mock = mockTransport({ defaultOutcome: "VALID_REALIZE" });
    const run = await runCalibration({ transport: mock.transport, authority: stale }, { scanSurface: SCAN_SURFACE });
    expect(mock.calls()).toBe(0);
    expect(run.trials).toHaveLength(0);
    expect(run.decision.decision).toBe("EXECUTOR_CALIBRATION_STOP");
    expect(run.integrity.gates.PREREG_SHA_MATCH).toBe(false);
  });

  it("TEST_OLD_REQUEST_BINDING_UNDER_A_CORRECT_PREREG_SHA_IS_REJECTED_WITH_ZERO_CALLS", async () => {
    // HEAD and the manifest agree on the NEW prereg, but the frozen request is the
    // OLD one: the request authority must refuse before any call.
    const base = await newContractRequest();
    const head = "9".repeat(40);
    const staleRequest = await mockAuthority({
      head,
      manifestSha: head,
      approvedSha: head,
      renderRequest: async () => ({
        ...base,
        request_hash: OLD_REQUEST,
        hashes: { ...base.hashes, model_facing_request_hash: OLD_REQUEST }
      })
    });
    const mock = mockTransport({ defaultOutcome: "VALID_REALIZE" });
    const run = await runCalibration({ transport: mock.transport, authority: staleRequest }, { scanSurface: SCAN_SURFACE });
    expect(mock.calls()).toBe(0);
    expect(run.decision.decision).toBe("EXECUTOR_CALIBRATION_STOP");
    expect(run.integrity.gates.REQUEST_HASH_IDENTITY).toBe(false);
  });

  it("TEST_OLD_HASHES_ARE_NOT_ACCEPTED_AS_THE_LIVE_CONTRACT", async () => {
    const request = await newContractRequest();
    expect(FROZEN_CALIBRATION_REQUEST_HASH).toBe(OLD_REQUEST); // the historical constant still names it
    expect(request.request_hash).not.toBe(OLD_REQUEST); // but it is never the live request
    expect(request.hashes.system_hash).not.toBe(OLD_SYSTEM);
    expect(request.hashes.schema_hash).not.toBe(OLD_SCHEMA);
  });
});

/* -------------------------------------------------------------------------- */
/* 3 — tamper classes yield 0 network calls (§19)                              */
/* -------------------------------------------------------------------------- */

describe("POST-PARITY AUTHORITY — every tamper class refuses with zero calls", () => {
  it("TEST_TAMPER_MATRIX", async () => {
    const base = await newContractRequest();
    const cases: readonly { readonly name: string; readonly authority: Awaited<ReturnType<typeof mockAuthority>> }[] = [
      { name: "WRONG_APPROVED_SHA", authority: await mockAuthority({ approvedSha: "1".repeat(40), head: "2".repeat(40), manifestSha: "3".repeat(40) }) },
      { name: "MANIFEST_SHA_MISMATCH", authority: await mockAuthority({ head: "5".repeat(40), manifestSha: "6".repeat(40), approvedSha: "5".repeat(40) }) },
      { name: "DIRTY_TREE", authority: await mockAuthority({ treeClean: false }) },
      { name: "SYSTEM_DRIFT", authority: await mockAuthority({ renderRequest: async () => ({ ...base, hashes: { ...base.hashes, system_hash: OLD_SYSTEM } }) }) },
      { name: "SCHEMA_DRIFT", authority: await mockAuthority({ schemaHash: () => OLD_SCHEMA }) },
      { name: "CONFIG_DRIFT", authority: await mockAuthority({ modelConfigHash: () => `sha256:${"7".repeat(64)}` }) },
      { name: "REQUEST_DRIFT", authority: await mockAuthority({ renderRequest: async () => ({ ...base, request_hash: `sha256:${"8".repeat(64)}` }) }) },
      {
        name: "DESIGN_TAMPER",
        authority: await mockAuthority({
          design: {
            matches: Object.fromEntries(
              [
                "scenario_hash",
                "intervention_law_hash",
                "scan_surface_hash",
                "evaluator_hash",
                "statistical_law_hash",
                "model_config_hash",
                "calibration_request_hash",
                "trial_schedule_hash",
                "low_history_hash",
                "high_history_hash",
                "proposition_identity",
                "seed_belief_item_count",
                "contract_parity_hash"
              ].map((item) => [item, item !== "contract_parity_hash"])
            ),
            expected: {},
            actual: {},
            additional: {},
            all_match: false,
            mismatched: ["contract_parity_hash"],
            formation_attestation: {}
          }
        })
      }
    ];
    for (const testCase of cases) {
      const mock = mockTransport({ defaultOutcome: "VALID_REALIZE" });
      const run = await runCalibration({ transport: mock.transport, authority: testCase.authority }, { scanSurface: SCAN_SURFACE });
      expect(mock.calls(), testCase.name).toBe(0);
      expect(run.trials, testCase.name).toHaveLength(0);
      expect(run.decision.decision, testCase.name).toBe("EXECUTOR_CALIBRATION_STOP");
    }
  });
});

/* -------------------------------------------------------------------------- */
/* 4 — the readiness law is unchanged (§20)                                    */
/* -------------------------------------------------------------------------- */

describe("POST-PARITY AUTHORITY — calibration readiness law unchanged", () => {
  it("TEST_48_OF_50_RUN", () => {
    expect(
      evaluateCalibrationLaw({
        scheduled_trials: CALIBRATION_SCHEDULED_LOGICAL_TRIALS,
        executed_trials: CALIBRATION_SCHEDULED_LOGICAL_TRIALS,
        host_valid_count: 48,
        non_host_valid_count: 2,
        integrity_gates: { ALL: true },
        early_stopped: false
      }).decision
    ).toBe("EXECUTOR_CALIBRATION_RUN");
    expect(CALIBRATION_MINIMUM_HOST_VALID_COUNT).toBe(48);
    expect(CALIBRATION_MAXIMUM_NON_HOST_VALID_COUNT).toBe(2);
  });

  it("TEST_47_OF_50_STOP", () => {
    expect(
      evaluateCalibrationLaw({
        scheduled_trials: CALIBRATION_SCHEDULED_LOGICAL_TRIALS,
        executed_trials: CALIBRATION_SCHEDULED_LOGICAL_TRIALS,
        host_valid_count: 47,
        non_host_valid_count: 3,
        integrity_gates: { ALL: true },
        early_stopped: false
      }).decision
    ).toBe("EXECUTOR_CALIBRATION_STOP");
  });

  it("TEST_THIRD_INVALID_EARLY_STOP_AND_50_REALIZE_AND_50_CLARIFY", async () => {
    const authority = await mockAuthority();
    // The V8 contract path cites ADVERTISED handles: the mock derives them from
    // the real rendered request, exactly as the real executor must.
    const userText = (await newContractRequest()).body.messages[1]?.content ?? "";
    const invalid: MockOutcome[] = ["SCHEMA_INVALID", "SCHEMA_INVALID", "SCHEMA_INVALID"];
    const earlyMock = mockTransport({ userText, script: invalid, defaultOutcome: "VALID_REALIZE" });
    const early = await runCalibration({ transport: earlyMock.transport, authority }, { scanSurface: SCAN_SURFACE });
    expect(early.trials).toHaveLength(3);
    expect(early.early_stopped).toBe(true);
    expect(early.aggregates.planned).toBe(50);
    expect(early.decision.decision).toBe("EXECUTOR_CALIBRATION_STOP_EARLY");

    const realizeMock = mockTransport({ userText, defaultOutcome: "VALID_REALIZE" });
    const realize = await runCalibration({ transport: realizeMock.transport, authority }, { scanSurface: SCAN_SURFACE });
    expect(realize.aggregates.realize_count).toBe(50);
    expect(realize.decision.decision).toBe("EXECUTOR_CALIBRATION_RUN");

    const clarifyMock = mockTransport({ userText, defaultOutcome: "VALID_CLARIFY" });
    const clarify = await runCalibration({ transport: clarifyMock.transport, authority }, { scanSurface: SCAN_SURFACE });
    expect(clarify.aggregates.clarify_count).toBe(50);
    expect(clarify.decision.decision).toBe("EXECUTOR_CALIBRATION_RUN");

    // invalid trials are never replaced and the denominator never grows
    for (const run of [early, realize, clarify]) {
      expect(run.trials.every((trial) => trial.logical_trial <= 50)).toBe(true);
      expect(run.aggregates.planned).toBe(50);
    }
  });

  it("TEST_RETRY_REUSES_THE_EXACT_SERIALIZED_BYTES", async () => {
    const authority = await mockAuthority();
    const base = await newContractRequest();
    let call = 0;
    const transport = {
      id: "MOCK_RETRY",
      async complete(serializedBody: string, bodyHash: string) {
        call += 1;
        const attempts =
          call === 1
            ? [
                { attempt: 1, http_status: 429, failure_class: "HTTP_429_RETRYABLE" as const, elapsed_ms: 1, body_hash: bodyHash },
                { attempt: 2, http_status: 200, failure_class: "NO_FAILURE" as const, elapsed_ms: 1, body_hash: bodyHash }
              ]
            : [{ attempt: 1, http_status: 200, failure_class: "NO_FAILURE" as const, elapsed_ms: 1, body_hash: bodyHash }];
        return {
          ok: true as const,
          content: JSON.stringify({
            schema_version: "conversation-cognition-proposal-v8",
            response_semantics: { kind: "PRIMARY_CONVERSATIONAL_ACT", act: "ACKNOWLEDGE" },
            factual_assessment: { claims: [] },
            cognition: {
              schema_version: "cognition-proposal-v0",
              reasoning_summary: "retry fixture",
              relevant_memory_handles: [],
              considered_handles: [],
              current_intent: "respond",
              confidence: 0.5,
              uncertainty: 0.5,
              action_intent: null,
              evidence_handles: []
            },
            subjective_selection: { kind: "NO_SUBJECTIVE_SELECTION" },
            communication_directive: { kind: "REALIZE_CURRENT_INTENT" },
            clarification_basis: null
          }),
          model: "deepseek-flash",
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, cached_tokens: 0, reasoning_tokens: 0 },
          attempts
        };
      }
    };
    const run = await runCalibration({ transport, authority, maxTrials: 1 }, { scanSurface: SCAN_SURFACE });
    expect(run.trials[0]?.raw_attempts).toBe(2);
    expect(run.integrity.retry_legality).toBe(true);
    expect(run.trials[0]?.request_hash).toBe(base.request_hash);
    expect(run.aggregates.request_hash_unique_count).toBe(1);
  });
});

/* -------------------------------------------------------------------------- */
/* 5 — the contract boundary is the validator's law (§21, offline)             */
/* -------------------------------------------------------------------------- */

describe("POST-PARITY AUTHORITY — the advertised bound is the enforced bound", () => {
  it("TEST_PROMPT_AND_SCHEMA_EXPOSE_THE_EXACT_256_LAW", () => {
    expect(CONVERSATION_COGNITION_SYSTEM_PROMPT_V8).toContain(
      "clarification_basis.missing_information must contain at least one character and at most 256 code points"
    );
    expect(CONVERSATION_COGNITION_FIELD_BOUNDS_CLAUSE_V8).toContain(String(CLARIFICATION_BASIS_TEXT_MAX_CODE_POINTS));
    expect(renderCognitionProposalContractV8(CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA)).toContain(
      "missing_information: string (at least one character, at most 256 code points)"
    );
    const node = (
      CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA as {
        properties: { clarification_basis: { anyOf: readonly { properties?: Record<string, Record<string, unknown>> }[] } };
      }
    ).properties.clarification_basis.anyOf[1].properties?.["missing_information"];
    expect(node?.["maxLength"]).toBe(256);
    expect(node?.["minLength"]).toBe(1);
  });

  it("TEST_PRODUCTION_STILL_ACCEPTS_255_AND_256_AND_REJECTS_257", async () => {
    const subject = await buildCalibrationSubject();
    const projection = await buildCalibrationProjection(subject);
    const verdict = (missing: string): { ok: boolean; detail: string | null } => {
      const checked = canonicalizeConversationCognitionModelOutputV8(
        {
          schema_version: "conversation-cognition-proposal-v8",
          response_semantics: { kind: "PRIMARY_CLARIFICATION" },
          factual_assessment: { claims: [] },
          cognition: {
            schema_version: "cognition-proposal-v0",
            reasoning_summary: "boundary fixture",
            relevant_memory_handles: [],
            considered_handles: ["F1", "C1"],
            current_intent: "respond",
            confidence: 0.5,
            uncertainty: 0.5,
            action_intent: null,
            evidence_handles: []
          },
          subjective_selection: { kind: "NO_SUBJECTIVE_SELECTION" },
          communication_directive: { kind: "CLARIFY_MISSING_CONTEXT" },
          clarification_basis: {
            current_observation_ref: "observation:o-source-event-bcv1-current-scene-1",
            missing_information: missing,
            needed_for: "planning"
          }
        } as never,
        projection as never,
        (projection as { projection_hash: string }).projection_hash as never
      );
      return checked.ok ? { ok: true, detail: null } : { ok: false, detail: checked.detail };
    };
    expect(verdict("a".repeat(255)).ok).toBe(true);
    expect(verdict("a".repeat(256)).ok).toBe(true);
    const over = verdict("a".repeat(257));
    expect(over.ok).toBe(false);
    expect(over.detail).toContain("exceeds 256 code points");
    // the metric is code points: 256 four-byte characters is lawful
    expect(verdict("𝔼".repeat(256)).ok).toBe(true);
    expect(verdict("𝔼".repeat(257)).ok).toBe(false);
  });

  it("TEST_THE_FROZEN_REQUEST_CARRIES_THE_NEW_CONTRACT", async () => {
    const request = await buildCalibrationRequest({
      schemaHash: hashJson(CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA),
      modelConfigHash: hashJson(modelConfigManifest())
    });
    const serialized = serializeAuthoritativeRequest(request.body);
    expect(request.body.messages[0]?.content).toContain("18. FIELD BOUNDS");
    expect(request.body.messages[0]?.content).toContain("at most 256 code points");
    expect(request.hashes.model_facing_request_hash).toBe(
      "sha256:79f1d679c6dcd9622f4f154055462ca540eed56680847499a3b4420971ac9c35"
    );
    expect(Buffer.byteLength(serialized, "utf8")).toBe(17381);
    // the body carries no host-side trial identity
    expect(serialized).not.toMatch(/trial|replicate|CALIBRATION\|/i);
  });
});
