/* eslint-disable no-restricted-imports -- Research harness: imports frozen built production roots by relative dist path. */
/**
 * BELIEF_CAUSAL_CONFIRMATORY_STOCHASTIC_V1 — execution-authority tests.
 *
 * T7–T11. Each case makes exactly ONE authority fact wrong and proves the runner
 * refuses BEFORE the first network call. The mock authority computes its own
 * facts; the runner accepts no caller-supplied boolean, so there is no way to
 * assert integrity it has not measured.
 */
import { describe, expect, it } from "vitest";

import { fileURLToPath } from "node:url";

import {
  CALIBRATION_REQUEST_FROZEN_HASH_MISMATCH,
  auditRuntimeV0Firewall,
  auditRuntimeWriteSurface,
  auditSecretSafety,
  readExecutionClosure,
  readExperimentSources,
  CALIBRATION_SCHEMA_HASH_DRIFT,
  CALIBRATION_TRACKED_TREE_DIRTY,
  SCIENTIFIC_CODE_STATE_MISMATCH,
  verifyCodeStateAuthority,
  verifyExecutionAuthority,
  verifyRequestBinding,
  verifyTrialPreCall,
  type DesignRederivation
} from "./calibration-authority.ts";
import { runCalibration } from "./calibration-runner.ts";
import { auditScanSurface } from "./scan-surface.ts";
import {
  ALL_MATCH_DESIGN,
  mockAuthority,
  mockTransport,
  realAuthoritativeRequest,
  realSchemaHash
} from "./test-support.ts";
import { hashJson } from "./histories.ts";
import { CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA } from "../../../packages/runtime/dist/index.js";

const SCAN_SURFACE = auditScanSurface(hashJson(CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA)).exact_scan_surface;
const HASH_A = `sha256:${"a".repeat(64)}`;
const HASH_B = `sha256:${"b".repeat(64)}`;

describe("AUTHORITY — T7 wrong approved preregistration SHA", () => {
  it("TEST_T7_WRONG_APPROVED_SHA: a mismatched external SHA refuses with 0 network calls", async () => {
    const authority = await mockAuthority({ approvedSha: "1".repeat(40), head: "2".repeat(40), manifestSha: "3".repeat(40) });
    const codeState = verifyCodeStateAuthority(authority);
    expect(codeState.ok).toBe(false);
    expect(codeState.failures.filter((failure) => failure.startsWith(SCIENTIFIC_CODE_STATE_MISMATCH)).length).toBe(3);
    const mock = mockTransport({ defaultOutcome: "VALID_REALIZE" });
    const run = await runCalibration({ transport: mock.transport, authority }, { scanSurface: SCAN_SURFACE });
    expect(mock.calls()).toBe(0);
    expect(run.trials.length).toBe(0);
    expect(run.decision.decision).toBe("EXECUTOR_CALIBRATION_STOP");
    expect(run.integrity.gates.PREREG_SHA_MATCH).toBe(false);
  });

  it("TEST_T7B: a two-way match that misses only the APPROVED value still refuses", async () => {
    const head = "4".repeat(40);
    const authority = await mockAuthority({ head, manifestSha: head, approvedSha: "5".repeat(40) });
    const codeState = verifyCodeStateAuthority(authority);
    expect(codeState.ok).toBe(false);
    expect(codeState.failures).toEqual([`${SCIENTIFIC_CODE_STATE_MISMATCH}:HEAD!=APPROVED_PREREG_SHA`, `${SCIENTIFIC_CODE_STATE_MISMATCH}:MANIFEST!=APPROVED_PREREG_SHA`]);
  });
});

describe("AUTHORITY — T8 manifest preregistration SHA mismatch", () => {
  it("TEST_T8_MANIFEST_SHA_MISMATCH: HEAD == approved but != manifest commits 0 calls", async () => {
    const head = "6".repeat(40);
    const authority = await mockAuthority({ head, approvedSha: head, manifestSha: "7".repeat(40) });
    const mock = mockTransport({ defaultOutcome: "VALID_REALIZE" });
    const run = await runCalibration({ transport: mock.transport, authority }, { scanSurface: SCAN_SURFACE });
    expect(mock.calls()).toBe(0);
    expect(run.decision.decision).toBe("EXECUTOR_CALIBRATION_STOP");
    expect(run.decision.failed_integrity_gates).toContain("PREREG_SHA_MATCH");
  });

  it("TEST_T8B: an invalid manifest blob verification refuses the run", async () => {
    const authority = await mockAuthority({
      manifestVerification: { ok: false, detail: "blob hash mismatch for contract.ts" }
    });
    const mock = mockTransport({ defaultOutcome: "VALID_REALIZE" });
    const run = await runCalibration({ transport: mock.transport, authority }, { scanSurface: SCAN_SURFACE });
    expect(mock.calls()).toBe(0);
    expect(run.integrity.gates.MANIFEST_VALID).toBe(false);
  });
});

describe("AUTHORITY — T9 dirty tracked tree", () => {
  it("TEST_T9_DIRTY_TREE: a modified tracked file refuses the run before any call", async () => {
    const authority = await mockAuthority({ treeClean: false });
    const codeState = verifyCodeStateAuthority(authority);
    expect(codeState.ok).toBe(false);
    expect(codeState.failures).toContain(CALIBRATION_TRACKED_TREE_DIRTY);
    const mock = mockTransport({ defaultOutcome: "VALID_REALIZE" });
    const run = await runCalibration({ transport: mock.transport, authority }, { scanSurface: SCAN_SURFACE });
    expect(mock.calls()).toBe(0);
    expect(run.integrity.gates.TRACKED_TREE_CLEAN).toBe(false);
  });
});

describe("AUTHORITY — T10 design tamper", () => {
  it("TEST_T10_DESIGN_TAMPER: one tampered design item refuses the run", async () => {
    for (const item of [
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
      "seed_belief_item_count"
    ]) {
      const tampered: DesignRederivation = {
        ...ALL_MATCH_DESIGN,
        matches: { ...ALL_MATCH_DESIGN.matches, [item]: false },
        all_match: false,
        mismatched: [item]
      };
      const authority = await mockAuthority({ design: tampered });
      const mock = mockTransport({ defaultOutcome: "VALID_REALIZE" });
      const run = await runCalibration({ transport: mock.transport, authority }, { scanSurface: SCAN_SURFACE });
      expect(mock.calls(), item).toBe(0);
      expect(run.integrity.gates.DESIGN_REDERIVATION, item).toBe(false);
      expect(run.decision.decision, item).toBe("EXECUTOR_CALIBRATION_STOP");
    }
  });

  it("TEST_T10B: the real re-derivation covers exactly the 12 required items plus the post-parity contract binding", () => {
    expect(Object.keys(ALL_MATCH_DESIGN.matches).sort()).toEqual(
      [
        "calibration_request_hash",
        "evaluator_hash",
        "high_history_hash",
        "intervention_law_hash",
        "low_history_hash",
        "model_config_hash",
        "proposition_identity",
        "scan_surface_hash",
        "scenario_hash",
        "seed_belief_item_count",
        "statistical_law_hash",
        "trial_schedule_hash",
        "contract_parity_hash"
      ].sort()
    );
  });
});

describe("AUTHORITY — T11 frozen request hash tamper", () => {
  it("TEST_T11_REQUEST_HASH_TAMPER: a drifted request hash refuses BEFORE the call", async () => {
    const base = await realAuthoritativeRequest();
    const authority = await mockAuthority({
      renderRequest: async () => ({ ...base, request_hash: HASH_A })
    });
    const binding = await verifyRequestBinding(authority);
    expect(binding.ok).toBe(false);
    expect(binding.failures).toContain(CALIBRATION_REQUEST_FROZEN_HASH_MISMATCH);
    const mock = mockTransport({ defaultOutcome: "VALID_REALIZE" });
    const run = await runCalibration({ transport: mock.transport, authority }, { scanSurface: SCAN_SURFACE });
    expect(mock.calls()).toBe(0);
    expect(run.integrity.gates.REQUEST_HASH_IDENTITY).toBe(false);
  });

  it("TEST_T11B: a tampered frozen binding (manifest side) refuses too", async () => {
    const base = await realAuthoritativeRequest();
    const authority = await mockAuthority();
    const tampered = {
      ...authority,
      frozenRequestBinding: () => ({ ...base.hashes, model_facing_request_hash: HASH_B })
    };
    const binding = await verifyRequestBinding(tampered);
    expect(binding.ok).toBe(false);
    expect(binding.failures).toContain(CALIBRATION_REQUEST_FROZEN_HASH_MISMATCH);
    const mock = mockTransport({ defaultOutcome: "VALID_REALIZE" });
    await runCalibration({ transport: mock.transport, authority: tampered }, { scanSurface: SCAN_SURFACE });
    expect(mock.calls()).toBe(0);
  });

  it("TEST_T11C: a tampered schema hash is detected as SCHEMA drift, not as a request mismatch", async () => {
    const authority = await mockAuthority({ schemaHash: () => HASH_A });
    const binding = await verifyRequestBinding(authority);
    expect(binding.ok).toBe(false);
    expect(binding.failures).toContain(CALIBRATION_SCHEMA_HASH_DRIFT);
    expect(binding.failures).not.toContain(CALIBRATION_REQUEST_FROZEN_HASH_MISMATCH);
  });
});

describe("AUTHORITY — the REAL tree (no mocks): the enumerated closure and the firewalls", () => {
  it("TEST_REAL_PATH_AUDITS: the real execution closure is enumerated and all three firewalls pass", async () => {
    // The directory is passed WITHOUT a trailing separator — the shape the CLI
    // actually uses — so a path-joining regression cannot hide behind a fixture.
    const experimentDir = fileURLToPath(new URL(".", import.meta.url)).replace(/[/\\]+$/, "");
    const closure = readExecutionClosure(experimentDir);
    const files = closure.map((entry) => entry.file);
    expect(files).toContain("calibration-authority.ts");
    expect(files).toContain("calibration-transport.ts");
    expect(files).toContain("cli.ts");
    expect(closure.every((entry) => !entry.file.endsWith(".test.ts"))).toBe(true);
    expect(closure.every((entry) => entry.code.length > 0)).toBe(true);

    const sources = readExperimentSources(experimentDir);
    expect(sources.length).toBeGreaterThan(closure.length);
    expect(sources.some((entry) => entry.file === "contract.ts")).toBe(true);

    // The three real firewalls, on the real sources of this tree.
    expect(auditSecretSafety(closure).failures).toEqual([]);
    expect(auditRuntimeV0Firewall(sources).passed).toBe(true);
    const writeSurface = await auditRuntimeWriteSurface(experimentDir, closure);
    expect(writeSurface.passed).toBe(true);
    expect(writeSurface.violations).toEqual([]);
    expect(writeSurface.missing_required_modules).toEqual([]);
    expect(writeSurface.durable_stable).toBe(true);
    expect(writeSurface.offline_formation_files).toContain("histories.ts");
  });
});

describe("AUTHORITY — per-trial pre-call gate", () => {
  it("TEST_PRECALL_GATE: the pre-call gate re-checks code state AND the request binding on every trial", async () => {
    const authority = await mockAuthority();
    let renders = 0;
    const counting = { ...authority, renderRequest: async () => (renders += 1, await authority.renderRequest()) };
    const preCall = await verifyTrialPreCall(counting);
    expect(preCall.ok).toBe(true);
    expect(renders).toBe(1);
    const preflight = await verifyExecutionAuthority(authority);
    expect(preflight.ok).toBe(true);
    expect(preflight.design_rederivation.all_match).toBe(true);
    expect(preflight.request_binding.request.request_hash).toBe(
      "sha256:79f1d679c6dcd9622f4f154055462ca540eed56680847499a3b4420971ac9c35"
    );
    expect(realSchemaHash()).toBe(preflight.request_binding.expected.schema_hash);
  });
});
