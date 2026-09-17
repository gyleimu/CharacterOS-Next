/**
 * BELIEF_CAUSAL_CONFIRMATORY_STOCHASTIC_V1 — formal CLI tests.
 *
 * T25–T27. The CLI is exercised through its dependency seams: a mock authority
 * (no git, no manifest file) and a MOCK FETCH. Zero real network calls, zero
 * credentials (the fixture key never leaves the mock) and zero model calls.
 *
 * T27 exists to prove that the tracked CLI really drives `createDeepSeekTransport`
 * + `runCalibration`: it injects ONLY a fetch implementation, so the transport
 * constructor and the runner under test are the REAL tracked ones.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

import { calibrationPreflight, calibrationRun, MODEL_API_KEY_ENV, PRIMARY_AUTHORIZED } from "./calibration-cli.ts";
import type { CalibrationAuthority } from "./calibration-authority.ts";
import {
  ALL_MATCH_DESIGN,
  mockAuthority,
  PASSED_V0_FIREWALL,
  PASSED_WRITE_SURFACE,
  realAuthoritativeRequest,
  validProposalJson,
  type MockAuthorityOptions
} from "./test-support.ts";
import type { CalibrationEvidence } from "./calibration-evidence.ts";

const REPO_ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "..");
const EXPERIMENT_DIR = join(REPO_ROOT, "research/experiments/belief-causal-confirmatory-stochastic-v1");
const TEST_KEY = "sk-test-key-not-a-credential-000000";
const MANIFEST_PATH = join(tmpdir(), "bcv1-test-manifest.json");

interface FetchTrace {
  readonly urls: string[];
  readonly bodies: string[];
}

function mockFetch(content: string = validProposalJson("REALIZE_CURRENT_INTENT")): { readonly fetchImpl: typeof fetch; readonly trace: FetchTrace } {
  const trace: FetchTrace = { urls: [], bodies: [] };
  const fetchImpl = (async (url: unknown, init: unknown) => {
    const options = (init ?? {}) as { body?: string };
    trace.urls.push(String(url));
    trace.bodies.push(String(options.body ?? ""));
    return new Response(
      JSON.stringify({
        model: "deepseek-flash",
        choices: [{ message: { content }, finish_reason: "stop" }],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  }) as unknown as typeof fetch;
  return { fetchImpl, trace };
}

async function cliDeps(
  options: MockAuthorityOptions = {},
  fetchImpl?: typeof fetch,
  apiKey: string | undefined = TEST_KEY,
  capture?: { evidence: CalibrationEvidence | null; path: string | null }
): Promise<{ readonly deps: Parameters<typeof calibrationPreflight>[1]; readonly authority: CalibrationAuthority }> {
  const authority = await mockAuthority(options);
  const deps: Parameters<typeof calibrationPreflight>[1] = {
    repoDir: REPO_ROOT,
    experimentDir: EXPERIMENT_DIR,
    apiKey,
    authority,
    fetchImpl,
    writeEvidence: (path, evidence) => {
      if (capture !== undefined) {
        capture.path = path;
        capture.evidence = evidence;
      }
      return "sha256:test-evidence-hash";
    }
  };
  return { deps, authority };
}

describe("FORMAL CLI — T25 calibration-preflight PASS", () => {
  it("TEST_T25_PREFLIGHT_PASS: every authority step passes with ZERO network calls", async () => {
    const fetch = mockFetch();
    const { deps, authority } = await cliDeps({}, fetch.fetchImpl);
    const { report, preflight } = await calibrationPreflight(
      { approvedPreregSha: authority.approved_prereg_sha, manifestPath: MANIFEST_PATH },
      deps
    );
    expect(report.verdict).toBe("CALIBRATION_PREFLIGHT_PASS");
    expect(report.model_calls).toBe(0);
    expect(report.network_calls).toBe(0);
    expect(report.transport_constructed).toBe(false);
    expect(report.primary_authorized).toBe(false);
    expect(report.api_key_source).toBe(MODEL_API_KEY_ENV);
    expect(report.api_key_present).toBe(true);
    expect(report.three_way_equal).toBe(true);
    expect(report.runtime_request_hash).toBe(report.frozen_request_hash);
    expect(report.design_rederivation_matches).toEqual(ALL_MATCH_DESIGN.matches);
    expect(report.steps.map((step) => step.step)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(report.steps.every((step) => step.ok)).toBe(true);
    expect(preflight.ok).toBe(true);
    expect(fetch.trace.urls).toHaveLength(0);
  });

  it("TEST_T25B: preflight without a credential refuses but still makes no call", async () => {
    const fetch = mockFetch();
    // An EMPTY value is what "no credential" looks like: the CLI reads the env var.
    const { deps, authority } = await cliDeps({}, fetch.fetchImpl, "");
    const { report } = await calibrationPreflight({ approvedPreregSha: authority.approved_prereg_sha, manifestPath: MANIFEST_PATH }, deps);
    expect(report.verdict).toBe("CALIBRATION_PREFLIGHT_STOP");
    expect(report.failures).toContain("MODEL_API_KEY_ENV_ABSENT");
    expect(report.api_key_present).toBe(false);
    expect(fetch.trace.urls).toHaveLength(0);
  });
});

describe("FORMAL CLI — T26 calibration-preflight FAIL cases keep the network at zero", () => {
  it("TEST_T26_PREFLIGHT_FAILURES: SHA, dirty tree, manifest, design, request, schema and config each block with 0 calls", async () => {
    const base = await realAuthoritativeRequest();
    const cases: readonly { readonly name: string; readonly options: MockAuthorityOptions; readonly failure: string }[] = [
      { name: "APPROVED_SHA", options: { approvedSha: "1".repeat(40) }, failure: "SCIENTIFIC_CODE_STATE_MISMATCH" },
      { name: "DIRTY_TREE", options: { treeClean: false }, failure: "CALIBRATION_TRACKED_TREE_DIRTY" },
      { name: "MANIFEST", options: { manifestVerification: { ok: false, detail: "blob mismatch" } }, failure: "CALIBRATION_MANIFEST_INVALID" },
      {
        name: "DESIGN",
        options: { design: { ...ALL_MATCH_DESIGN, matches: { ...ALL_MATCH_DESIGN.matches, scenario_hash: false }, all_match: false, mismatched: ["scenario_hash"] } },
        failure: "CALIBRATION_DESIGN_REDERIVATION_MISMATCH"
      },
      { name: "REQUEST", options: { renderRequest: async () => ({ ...base, request_hash: `sha256:${"9".repeat(64)}` }) }, failure: "CALIBRATION_REQUEST_FROZEN_HASH_MISMATCH" },
      { name: "SCHEMA", options: { schemaHash: () => `sha256:${"8".repeat(64)}` }, failure: "CALIBRATION_SCHEMA_HASH_DRIFT" },
      { name: "CONFIG", options: { modelConfigHash: () => `sha256:${"7".repeat(64)}` }, failure: "CALIBRATION_MODEL_CONFIG_HASH_DRIFT" },
      { name: "P17", options: { writeSurface: { ...PASSED_WRITE_SURFACE, passed: false } }, failure: "CALIBRATION_P17_WRITE_SURFACE_VIOLATION" },
      { name: "P22", options: { v0Firewall: { ...PASSED_V0_FIREWALL, passed: false } }, failure: "CALIBRATION_P22_V0_FIREWALL_VIOLATION" },
      { name: "SECRET", options: { secretSafety: { ok: false, failures: ["EVIDENCE_CREDENTIAL_SURFACE"], detail: "fixture" } }, failure: "CALIBRATION_SECRET_SAFETY_VIOLATION" }
    ];
    for (const testCase of cases) {
      const fetch = mockFetch();
      const { deps, authority } = await cliDeps(testCase.options, fetch.fetchImpl);
      const { report } = await calibrationPreflight({ approvedPreregSha: authority.approved_prereg_sha, manifestPath: MANIFEST_PATH }, deps);
      expect(report.verdict, testCase.name).toBe("CALIBRATION_PREFLIGHT_STOP");
      expect(
        report.failures.some((failure) => failure.startsWith(testCase.failure)),
        `${testCase.name}: ${report.failures.join(",")}`
      ).toBe(true);
      expect(report.network_calls, testCase.name).toBe(0);
      expect(fetch.trace.urls, testCase.name).toHaveLength(0);
    }
  });

  it("TEST_T26B: calibration-run refuses a failed preflight with 0 network calls and no evidence write", async () => {
    const fetch = mockFetch();
    const capture = { evidence: null as CalibrationEvidence | null, path: null as string | null };
    const { deps, authority } = await cliDeps({ treeClean: false }, fetch.fetchImpl, TEST_KEY, capture);
    const report = await calibrationRun(
      { approvedPreregSha: authority.approved_prereg_sha, manifestPath: MANIFEST_PATH, evidenceOut: "ignored.json" },
      deps
    );
    expect(report.verdict).toBe("EXECUTOR_CALIBRATION_STOP");
    expect(report.model_calls).toBe(0);
    expect(report.network_calls).toBe(0);
    expect(report.stopped_before_primary).toBe(true);
    expect(report.primary_authorized).toBe(false);
    expect(fetch.trace.urls).toHaveLength(0);
    expect(capture.evidence).toBeNull();
  });
});

describe("FORMAL CLI — T27 the tracked real execution path", () => {
  it("TEST_T27_TRACKED_REAL_PATH: injecting ONLY a fetch drives the REAL transport and the REAL runner", async () => {
    const fetch = mockFetch();
    const capture = { evidence: null as CalibrationEvidence | null, path: null as string | null };
    const { deps, authority } = await cliDeps({}, fetch.fetchImpl, TEST_KEY, capture);
    const report = await calibrationRun(
      {
        approvedPreregSha: authority.approved_prereg_sha,
        manifestPath: MANIFEST_PATH,
        evidenceOut: join(tmpdir(), "bcv1-test-evidence.json")
      },
      deps
    );
    expect(report.verdict).toBe("EXECUTOR_CALIBRATION_RUN");
    expect(report.model_calls).toBe(50);
    expect(report.network_calls).toBe(50);
    expect(report.run.trials).toHaveLength(50);
    expect(report.run.aggregates.host_valid).toBe(50);
    expect(report.run.pre_call_verifications).toBe(50);
    expect(report.stopped_before_primary).toBe(true);
    expect(report.primary_authorized).toBe(PRIMARY_AUTHORIZED);
    // The transport under test is the real one: it posted to the frozen endpoint
    // with the frozen body, 50 times, byte-identically.
    expect(fetch.trace.urls).toHaveLength(50);
    expect(new Set(fetch.trace.urls).size).toBe(1);
    expect(fetch.trace.urls[0]).toBe("https://api.deepseek.com/chat/completions");
    const expectedBody = (await realAuthoritativeRequest()).serialized_body;
    expect(new Set(fetch.trace.bodies).size).toBe(1);
    expect(fetch.trace.bodies[0]).toBe(expectedBody);
    // The evidence handed to the writer carries the authority attestation.
    expect(capture.evidence).not.toBeNull();
    const evidence = capture.evidence as CalibrationEvidence;
    expect(evidence.integrity.approved_prereg_sha).toBe(authority.approved_prereg_sha);
    expect(evidence.code_state_attestation.three_way_equal).toBe(true);
    expect(evidence.request.runtime_request_hash).toBe(evidence.request.model_facing_request_hash);
    expect(evidence.api_key_source).toBe("MODEL_API_KEY_ENVIRONMENT");
    expect(evidence.primary_authorized).toBe(false);
    expect(JSON.stringify(evidence)).not.toContain(TEST_KEY);
    expect(JSON.stringify(report)).not.toContain(TEST_KEY);
  });

  it("TEST_T27B: the CLI source proves the tracked wiring and the absence of an untracked driver", () => {
    const cliSource = readFileSync(join(EXPERIMENT_DIR, "cli.ts"), "utf8");
    const cliModule = readFileSync(join(EXPERIMENT_DIR, "calibration-cli.ts"), "utf8");
    expect(cliSource).toContain("calibration-preflight");
    expect(cliSource).toContain("calibration-run");
    expect(cliSource).toContain("--approved-prereg-sha");
    expect(cliSource).toContain("--manifest");
    expect(cliSource).toContain("--evidence-out");
    expect(cliSource).toContain("process.env.MODEL_API_KEY");
    expect(cliSource).not.toMatch(/node -e|createRequire|eval\(/);
    expect(cliModule).toContain("createDeepSeekTransport");
    expect(cliModule).toContain("runCalibration");
    expect(cliModule).toContain("PRIMARY_AUTHORIZED = false");
    // No command may accept a secret as a CLI parameter.
    expect(cliSource).not.toMatch(/--api-key|--token|--secret/);
  });
});
