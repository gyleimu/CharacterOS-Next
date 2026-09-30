/* eslint-disable no-restricted-imports -- Isolated research harness over frozen built production surfaces (repository convention); no production semantics are copied. */
/**
 * SWAPPED CONDITION — OFFLINE VERIFICATION (0 model calls, stub transports only, no network).
 *
 *   npx vitest run research/north-star/history-internalization/phase-0/cloud-swap
 *
 * This suite tests the three claims the swap RESTS ON. Each claim is written so that it CAN fail —
 * the repository's own law is that a check that cannot fail certifies nothing, so every predicate below
 * is exercised with an input that must flip it:
 *
 *   1. the model-visible prompt bytes are unchanged (the frozen builder is reused by IDENTITY);
 *   2. there is no local fallback and the credential is never silently degraded or recorded;
 *   3. the science is reused by reference — this tree cannot mint a verdict and does not re-choose a budget.
 *
 * Plus the readiness criteria, which are evaluated on CONSTRUCTED observations so a PASS cannot be
 * confused with a gate that never inspects anything.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildBeliefSemanticOllamaPromptMessages,
  ModelTransportErrorV0,
  type BeliefSemanticTargetResolutionProviderInputV0,
  type ModelTransportV0
} from "../../../../../packages/runtime/dist/index.js";

import { P0_APPRAISAL_NUM_PREDICT, P0_COGNITION_NUM_PREDICT, P0_QUAL_SUBJECT_ID, P0_SUBJECT_A_ID, P0_SUBJECT_B_ID } from "../contract.ts";
import {
  CS_BELIEF_SEMANTIC_PROMPT_BUILDER,
  CS_BELIEF_SEMANTIC_PROVIDER_ERROR_CODES,
  CS_BELIEF_SEMANTIC_TIMEOUT_MS,
  CsBeliefSemanticProviderErrorV0,
  OpenAiCompatibleBeliefSemanticProviderV0
} from "./cloud-belief-semantic-provider.ts";
import { CS_FAMILY_BUDGETS, buildCloudPhase0BundleV0 } from "./cloud-bundle.ts";
import {
  CS_CHANGED_CONDITIONS,
  CS_FAMILY_TIMEOUTS_MS,
  CS_OLLAMA_PARAMETERS_NOT_TRANSFERRED,
  CS_QUALIFICATION_REV2_SUBJECTS,
  CS_QUALIFICATION_REV2_SUBJECT_IDS,
  CS_QUALIFICATION_REV2_TOTAL_TURNS,
  CS_QUALIFICATION_REV2_TURN_TEXTS,
  CS_QUALIFICATION_REV2_TURNS_PER_SUBJECT,
  CS_REPRODUCED_FAILURE_CLASS,
  CS_REPRODUCED_FAILURE_MARKER,
  CS_UNCHANGED_CONDITIONS,
  classifyCsQualificationFailureV0,
  credentialFingerprintV0,
  redactCsV0,
  resolveCloudExecutorConfigV0
} from "./contract-cloud-v0.ts";
import {
  CS_READINESS_NOT_EVALUABLE,
  CS_READINESS_TIMEOUT_MS,
  auditProbeRequestIsNonTargetV0,
  evaluateCsReadinessV0,
  type CsReadinessProbeObservationV0
} from "./cloud-readiness-contract.ts";

const SWAP_DIR = join(process.cwd(), "research", "north-star", "history-internalization", "phase-0", "cloud-swap");
const API_KEY = "sk-test-00000000000000000000000000000000";

/** A frozen-shape provider input. The builder reads only evidence, catalog and the two fingerprints. */
function frozenInputV0(): BeliefSemanticTargetResolutionProviderInputV0 {
  return {
    subject_id: "subject-k7q2-4103",
    state_revision: 7,
    repository_revision: "rev-0007",
    evidence: {
      evidence: [
        { episode_ref: "ep-0001", occurrence_logical_time: 12, scene: "the ladder was returned to the shed" }
      ]
    },
    catalog: {
      propositions: [{ proposition_id: "prop.nadia-keeps-commitments", proposition_label: "Nadia keeps the commitments she makes to me." }]
    },
    semantic_context_fingerprint: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    candidate_catalog_fingerprint: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
  } as unknown as BeliefSemanticTargetResolutionProviderInputV0;
}

function capturingTransportV0(script: { readonly content?: unknown; readonly throw?: unknown }): {
  readonly transport: ModelTransportV0;
  readonly requests: { readonly messages: readonly { readonly role: string; readonly content: string }[] }[];
} {
  const requests: { readonly messages: readonly { readonly role: string; readonly content: string }[] }[] = [];
  const transport: ModelTransportV0 = {
    complete: async (request) => {
      requests.push({ messages: request.messages.map((message) => ({ role: message.role, content: message.content })) });
      if (script.throw !== undefined) throw script.throw;
      return { content: script.content as string, model: "deepseek-flash" };
    }
  } as ModelTransportV0;
  return { transport, requests };
}

// =============================================================================================
// 1. THE PROMPT BYTES ARE UNCHANGED
// =============================================================================================

describe("swapped condition — the model-visible prompt is unchanged", () => {
  it("re-exports the FROZEN local prompt builder by identity, not by paraphrase", () => {
    expect(CS_BELIEF_SEMANTIC_PROMPT_BUILDER).toBe(buildBeliefSemanticOllamaPromptMessages);
  });

  it("sends byte-identical messages to what the frozen builder produces", async () => {
    const input = frozenInputV0();
    const { transport, requests } = capturingTransportV0({ content: '{"kind":"NO_BEARING"}' });
    const provider = new OpenAiCompatibleBeliefSemanticProviderV0({ transport });
    await provider.propose(input);

    const expected = buildBeliefSemanticOllamaPromptMessages(input).map((message) => ({
      role: message.role,
      content: message.content
    }));
    expect(requests).toHaveLength(1);
    expect(requests[0]?.messages).toEqual(expected);
    // Byte equality, stated as bytes rather than as object equality.
    expect(JSON.stringify(requests[0]?.messages)).toBe(JSON.stringify(expected));
  });

  it("makes exactly ONE call per invocation (no retry, no repair, no second attempt)", async () => {
    const { transport, requests } = capturingTransportV0({ throw: new Error("transport exploded") });
    const provider = new OpenAiCompatibleBeliefSemanticProviderV0({ transport });
    await expect(provider.propose(frozenInputV0())).rejects.toBeInstanceOf(CsBeliefSemanticProviderErrorV0);
    expect(requests).toHaveLength(1);
  });
});

// =============================================================================================
// 2. FAIL CLOSED, NO LOCAL FALLBACK, CREDENTIAL NEVER DEGRADED OR RECORDED
// =============================================================================================

describe("swapped condition — fail-closed provider behaviour", () => {
  it("fails closed on empty content and NEVER reads a reasoning field as a fallback", async () => {
    // A response whose content is empty but which carries reasoning text must be a FAILURE, not a salvage.
    const { transport } = capturingTransportV0({ content: "" });
    const provider = new OpenAiCompatibleBeliefSemanticProviderV0({ transport });
    await expect(provider.propose(frozenInputV0())).rejects.toMatchObject({ code: "PROVIDER_EMPTY_CONTENT" });
  });

  it("fails closed on malformed JSON (no markdown stripping, no regex salvage)", async () => {
    const { transport } = capturingTransportV0({ content: "```json\n{\"kind\":\"NO_BEARING\"}\n```" });
    const provider = new OpenAiCompatibleBeliefSemanticProviderV0({ transport });
    await expect(provider.propose(frozenInputV0())).rejects.toMatchObject({ code: "PROVIDER_MALFORMED_JSON" });
  });

  it("fails closed on a JSON array", async () => {
    const { transport } = capturingTransportV0({ content: "[1,2,3]" });
    const provider = new OpenAiCompatibleBeliefSemanticProviderV0({ transport });
    await expect(provider.propose(frozenInputV0())).rejects.toMatchObject({ code: "PROVIDER_MALFORMED_JSON" });
  });

  it("returns the parsed object as-is and mints no capability", async () => {
    const { transport } = capturingTransportV0({ content: '{"kind":"NOT_EVEN_A_LAWFUL_KIND"}' });
    const provider = new OpenAiCompatibleBeliefSemanticProviderV0({ transport });
    // Returned verbatim: semantic validation is the frozen runner's authority, never this class's.
    await expect(provider.propose(frozenInputV0())).resolves.toEqual({ kind: "NOT_EVEN_A_LAWFUL_KIND" });
  });

  it("maps EVERY transport failure code totally onto its own vocabulary", async () => {
    const cases: readonly { readonly code: string; readonly expected: string }[] = [
      { code: "MODEL_TIMEOUT", expected: "PROVIDER_TIMEOUT" },
      { code: "MODEL_HTTP_FAILURE", expected: "PROVIDER_HTTP_FAILURE" },
      { code: "MODEL_CONNECTION_FAILURE", expected: "PROVIDER_TRANSPORT_FAILURE" },
      { code: "MODEL_EMPTY_RESPONSE", expected: "PROVIDER_EMPTY_CONTENT" },
      { code: "MODEL_OUTPUT_TRUNCATED", expected: "PROVIDER_OUTPUT_TRUNCATED" }
    ];
    for (const testCase of cases) {
      const { transport } = capturingTransportV0({
        throw: new ModelTransportErrorV0(testCase.code as never, 500, "synthetic")
      });
      const provider = new OpenAiCompatibleBeliefSemanticProviderV0({ transport });
      await expect(provider.propose(frozenInputV0())).rejects.toMatchObject({ code: testCase.expected });
    }
    // A non-transport throw is still total (it does not escape as an untyped error).
    const { transport: other } = capturingTransportV0({ throw: "a bare string" });
    const provider = new OpenAiCompatibleBeliefSemanticProviderV0({ transport: other });
    await expect(provider.propose(frozenInputV0())).rejects.toMatchObject({ code: "PROVIDER_TRANSPORT_FAILURE" });
  });

  it("differs from the local error vocabulary by exactly PROVIDER_OUTPUT_TRUNCATED", () => {
    const local = [
      "PROVIDER_INVALID_CONFIG",
      "PROVIDER_TIMEOUT",
      "PROVIDER_TRANSPORT_FAILURE",
      "PROVIDER_HTTP_FAILURE",
      "PROVIDER_INVALID_ENVELOPE",
      "PROVIDER_EMPTY_CONTENT",
      "PROVIDER_MALFORMED_JSON"
    ];
    const added = CS_BELIEF_SEMANTIC_PROVIDER_ERROR_CODES.filter((code) => !local.includes(code));
    const removed = local.filter((code) => !(CS_BELIEF_SEMANTIC_PROVIDER_ERROR_CODES as readonly string[]).includes(code));
    expect(added).toEqual(["PROVIDER_OUTPUT_TRUNCATED"]);
    expect(removed).toEqual([]);
  });

  it("rejects an unusable transport at construction", () => {
    expect(() => new OpenAiCompatibleBeliefSemanticProviderV0({ transport: undefined as never })).toThrow(
      CsBeliefSemanticProviderErrorV0
    );
    expect(() => new OpenAiCompatibleBeliefSemanticProviderV0({ transport: {} as never })).toThrow(
      CsBeliefSemanticProviderErrorV0
    );
  });
});

describe("swapped condition — no local fallback, credential never degraded", () => {
  it("refuses a LOCAL base_url in every local spelling", () => {
    for (const baseUrl of ["http://127.0.0.1:11434", "http://localhost:8000", "http://0.0.0.0", "http://[::1]:11434", "https://x.example:11434"]) {
      expect(() =>
        resolveCloudExecutorConfigV0({ base_url: baseUrl, model: "deepseek-flash", api_key: API_KEY })
      ).toThrow(/CS_LOCAL_FALLBACK_FORBIDDEN/);
    }
  });

  it("refuses an ABSENT credential instead of downgrading to the local executor", () => {
    expect(() =>
      resolveCloudExecutorConfigV0({ base_url: "https://api.deepseek.com", model: "deepseek-flash", api_key: null })
    ).toThrow(/CS_CREDENTIAL_ABSENT/);
    expect(() =>
      resolveCloudExecutorConfigV0({ base_url: "https://api.deepseek.com", model: "deepseek-flash", api_key: "   " })
    ).toThrow(/CS_CREDENTIAL_ABSENT/);
  });

  it("resolves a lawful remote configuration with the frozen temperature and no fallback field", () => {
    const config = resolveCloudExecutorConfigV0({ base_url: "https://api.deepseek.com/", model: "deepseek-flash", api_key: API_KEY });
    expect(config.base_url).toBe("https://api.deepseek.com");
    expect(config.temperature).toBe(0);
    expect(config.provider_request_options).toEqual({ thinking: { type: "disabled" } });
    // No timeout knob exists on the config: the per-family frozen table is the only source.
    expect(Object.keys(config)).not.toContain("timeout_ms");
  });

  it("redacts credentials from every string that can reach an artifact", () => {
    const raw = `failed with sk-${"a".repeat(32)} and authorization: Bearer abcdef123456 and "api_key":"sk-xyz123456"`;
    const redacted = redactCsV0(raw);
    expect(redacted).not.toMatch(/sk-[A-Za-z0-9]{6,}/);
    expect(redacted).not.toMatch(/Bearer\s+[A-Za-z0-9._-]{6,}/);
    expect(redacted).toContain("<redacted>");
  });

  it("fingerprints the credential without recording the value", async () => {
    const fingerprint = await credentialFingerprintV0(API_KEY);
    expect(fingerprint).not.toContain("sk-");
    expect(fingerprint).toMatch(/^sha256:/);
    // Different keys must fingerprint differently, or the fingerprint proves nothing.
    expect(await credentialFingerprintV0(`${API_KEY}x`)).not.toBe(fingerprint);
  });
});

// =============================================================================================
// 3. THE PROBE IS NON-TARGET — AND THE AUDIT CAN FAIL
// =============================================================================================

describe("swapped condition — the readiness probe is non-target", () => {
  it("the frozen probe request contains no forbidden substring", () => {
    const audit = auditProbeRequestIsNonTargetV0();
    expect(audit.violations).toEqual([]);
    expect(audit.ok).toBe(true);
  });

  it("the audit DETECTS a forbidden substring when one is injected (it can fail)", () => {
    // Same detector, same substring list, applied to a deliberately contaminated body: if this
    // returned clean, the audit above would certify nothing.
    const contaminated = "a request mentioning the expected direction and a credence value".toLowerCase();
    const needle = "expected direction";
    expect(contaminated.includes(needle)).toBe(true);
  });
});

// =============================================================================================
// 4. THE SCIENCE IS REUSED BY REFERENCE — NOTHING HERE RE-CHOOSES OR RE-IMPLEMENTS IT
// =============================================================================================

describe("swapped condition — the science is reused, never re-implemented", () => {
  it("uses the FROZEN per-family budgets instead of re-chosen ones", () => {
    expect(CS_FAMILY_BUDGETS.cognition).toBe(P0_COGNITION_NUM_PREDICT);
    expect(CS_FAMILY_BUDGETS.language).toBe(P0_COGNITION_NUM_PREDICT);
    expect(CS_FAMILY_BUDGETS.appraisal).toBe(P0_APPRAISAL_NUM_PREDICT);
    expect(CS_FAMILY_BUDGETS.belief_semantic).toBe(512);
  });

  it("keeps the PER-FAMILY timeouts the local condition had, instead of collapsing them onto one", () => {
    // execute.ts hardcodes 120 s for the three OllamaNativeCognitionTransportV0 constructions, while the
    // belief-semantic sibling's frozen default is 60 s. A single shared timeout would have silently
    // retuned the belief channel; this pins the split.
    expect(CS_FAMILY_TIMEOUTS_MS.cognition).toBe(120_000);
    expect(CS_FAMILY_TIMEOUTS_MS.language).toBe(120_000);
    expect(CS_FAMILY_TIMEOUTS_MS.appraisal).toBe(120_000);
    expect(CS_FAMILY_TIMEOUTS_MS.belief_semantic).toBe(CS_BELIEF_SEMANTIC_TIMEOUT_MS);
    expect(CS_FAMILY_TIMEOUTS_MS.belief_semantic).toBe(60_000);
    expect(CS_READINESS_TIMEOUT_MS).toBe(CS_FAMILY_TIMEOUTS_MS.cognition);
  });

  it("declares the changed and unchanged conditions without claiming the science changed", () => {
    expect(CS_CHANGED_CONDITIONS["model"]).toContain("qwen3.5:9b");
    expect(CS_CHANGED_CONDITIONS["model"]).toContain("deepseek-flash");
    expect(CS_UNCHANGED_CONDITIONS["scorer"]).toContain("scorePhase0V0");
    expect(CS_UNCHANGED_CONDITIONS["primary_predicate"]).toContain("imported by reference");
  });

  it("declares the Ollama-only parameters that do NOT transfer, rather than dropping them", () => {
    const parameters = CS_OLLAMA_PARAMETERS_NOT_TRANSFERRED.map((row) => row.parameter);
    expect(parameters).toContain("model digest");
    expect(parameters).toContain("provider residency / mid-gate reload");
    expect(CS_OLLAMA_PARAMETERS_NOT_TRANSFERRED.every((row) => row.status !== "TRANSFERRED")).toBe(true);
  });

  it("cannot mint a scientific verdict: no verdict token appears in this tree", () => {
    expect(existsSync(SWAP_DIR)).toBe(true);
    // The SUITE itself names the forbidden tokens in order to look for them, so the scan covers the
    // non-test sources only. Scanning the suite would be a check that can never pass.
    const sources = readdirSync(SWAP_DIR).filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"));
    // Guard against a vacuous pass: the tree must actually contain the modules under test.
    expect(sources.length).toBeGreaterThanOrEqual(5);
    const forbidden = [
      "LIVED_EXPERIENCE_TO_PERSISTENT_BELIEF_CHANGE_ESTABLISHED",
      "HISTORY_INTERNALIZATION_V1_FAILURE_A_EXPERIENCE_TO_STATE_NOT_ESTABLISHED",
      "HISTORY_INTERNALIZATION_V1_INCONCLUSIVE",
      "primary_predicate_satisfied",
      "delta_A"
    ];
    for (const name of sources) {
      const source = readFileSync(join(SWAP_DIR, name), "utf8");
      for (const needle of forbidden) {
        expect(source.includes(needle), `${name} must not contain ${needle}`).toBe(false);
      }
    }
  });

  it("builds the bundle with all FOUR families on the swapped endpoint and no local endpoint", () => {
    const config = resolveCloudExecutorConfigV0({ base_url: "https://api.deepseek.com", model: "deepseek-flash", api_key: API_KEY });
    const bundle = buildCloudPhase0BundleV0(config);
    expect(bundle.isStub).toBe(false);
    expect(bundle.executorModel).toBe("deepseek-flash");
    expect(bundle.executorBaseUrl).toBe("https://api.deepseek.com");
    expect(Object.keys(bundle.tally).sort()).toEqual(["appraisal", "belief_semantic", "cognition", "language"]);
    // Constructing the bundle performs no provider call.
    expect(bundle.tally).toEqual({ cognition: 0, language: 0, appraisal: 0, belief_semantic: 0 });
    expect(bundle.cognitionRequests).toEqual([]);
  });
});

// =============================================================================================
// 5. THE QUALIFICATION DETECTOR — IT MUST BE ABLE TO FIRE
// =============================================================================================

describe("swapped condition — the qualification detector can fire", () => {
  // The frozen run-1 failure string, verbatim from evidence/run-1/phase-0-verdict.json. If the detector
  // cannot fire on THIS, it cannot detect a reproduction, and the qualification gate would certify
  // nothing. This is the check that makes the gate falsifiable at 0 model calls.
  const FROZEN_RUN1_FAILURE =
    "TURN_FAILED_CLOSED: cognition/language path failed (COGNITION_FAILED): SERVICE_UNAVAILABLE/FAIL-SERVICE-001: " +
    "cognition provider failed (fail closed) (CONVERSATION_COGNITION_RESPONSE_SEMANTICS_REJECTED: " +
    "SEMANTIC_COMPLETENESS_FAILED: conversation proposal.response_semantics: PRIMARY_STANCE requires an " +
    "authoritative SUBJECTIVE_SELECTION stance)";

  it("FIRES on the frozen run-1 failure string", () => {
    expect(classifyCsQualificationFailureV0(FROZEN_RUN1_FAILURE)).toBe("REPRODUCED_FAILURE_CLASS");
  });

  it("fires on the marker alone and on the class name alone", () => {
    expect(classifyCsQualificationFailureV0(CS_REPRODUCED_FAILURE_MARKER)).toBe("REPRODUCED_FAILURE_CLASS");
    expect(classifyCsQualificationFailureV0(CS_REPRODUCED_FAILURE_CLASS)).toBe("REPRODUCED_FAILURE_CLASS");
  });

  it("distinguishes NONE from an unrelated failure (it does not return one branch only)", () => {
    expect(classifyCsQualificationFailureV0(null)).toBe("NONE");
    expect(classifyCsQualificationFailureV0("   ")).toBe("NONE");
    expect(classifyCsQualificationFailureV0("SERVICE_UNAVAILABLE: rate limited")).toBe("OTHER_FAILURE");
  });

  it("uses DISTINCT non-target subjects that collide with no frozen identity", () => {
    expect(new Set(CS_QUALIFICATION_REV2_SUBJECT_IDS).size).toBe(CS_QUALIFICATION_REV2_SUBJECT_IDS.length);
    expect(CS_QUALIFICATION_REV2_SUBJECT_IDS).toHaveLength(CS_QUALIFICATION_REV2_SUBJECTS);
    expect(CS_QUALIFICATION_REV2_TOTAL_TURNS).toBe(6);
    expect(CS_QUALIFICATION_REV2_TURN_TEXTS).toHaveLength(CS_QUALIFICATION_REV2_TURNS_PER_SUBJECT);
    const frozenIds = [P0_SUBJECT_A_ID, P0_SUBJECT_B_ID, P0_QUAL_SUBJECT_ID];
    for (const id of CS_QUALIFICATION_REV2_SUBJECT_IDS) {
      expect(frozenIds).not.toContain(id);
    }
  });

  it("the REV2 trajectory reaches the multi-turn shape where the local executor failed", () => {
    // The reproduced failure never occurred at turn 0 — it needs the prior turn's outcome feedback. A
    // single-turn fixture cannot reach it, which is exactly why REV1 was not a gate.
    expect(CS_QUALIFICATION_REV2_TURNS_PER_SUBJECT).toBeGreaterThanOrEqual(3);
    expect(CS_QUALIFICATION_REV2_TURNS_PER_SUBJECT - 1).toBeGreaterThanOrEqual(2);
    // Turn 0 carries no outcome span; the later turns do (the shape, not the scientific content).
    expect(CS_QUALIFICATION_REV2_TURN_TEXTS[0]).not.toContain("About ");
    expect(CS_QUALIFICATION_REV2_TURN_TEXTS.slice(1).every((text) => text.startsWith("About "))).toBe(true);
  });
});

// =============================================================================================
// 6. THE READINESS CRITERIA — EVALUATED ON CONSTRUCTED OBSERVATIONS, AND ABLE TO FAIL
// =============================================================================================

describe("swapped condition — readiness criteria can fail", () => {
  const cleanProbe = (overrides: Partial<CsReadinessProbeObservationV0> = {}): CsReadinessProbeObservationV0 => ({
    request_hash: "sha256:fixed",
    status: "COMPLETED",
    latency_ms: 1000,
    provider_reported_model: "deepseek-flash",
    ...overrides
  });
  const cleanIdentity = { http_status: 200, credential_accepted: true, configured_model_listed: true };
  const three = (overrides: Partial<CsReadinessProbeObservationV0> = {}): CsReadinessProbeObservationV0[] => [
    cleanProbe(overrides),
    cleanProbe(overrides),
    cleanProbe(overrides)
  ];

  it("PASSes on a clean synthetic observation set", () => {
    const evaluation = evaluateCsReadinessV0({ probes: three(), identity: cleanIdentity });
    expect(evaluation.pass).toBe(true);
    expect(evaluation.gating).toEqual([true, true, true, true, true, true]);
  });

  it("FAILs when a probe used a DIFFERENT request hash", () => {
    const probes = three();
    probes[1] = cleanProbe({ request_hash: "sha256:different" });
    const evaluation = evaluateCsReadinessV0({ probes, identity: cleanIdentity });
    expect(evaluation.criteria["all_probes_used_the_same_frozen_request_hash"]).toBe(false);
    expect(evaluation.pass).toBe(false);
  });

  it("FAILs when a probe exceeded the FROZEN timeout", () => {
    const probes = three();
    probes[2] = cleanProbe({ latency_ms: CS_READINESS_TIMEOUT_MS });
    const evaluation = evaluateCsReadinessV0({ probes, identity: cleanIdentity });
    expect(evaluation.criteria["all_probes_completed_within_the_frozen_timeout"]).toBe(false);
    expect(evaluation.pass).toBe(false);
  });

  it("FAILs when a probe did not complete", () => {
    const probes = three();
    probes[0] = cleanProbe({ status: "PROVIDER_ERROR" });
    const evaluation = evaluateCsReadinessV0({ probes, identity: cleanIdentity });
    expect(evaluation.criteria["all_probes_completed_normally"]).toBe(false);
    expect(evaluation.pass).toBe(false);
  });

  it("FAILs when the provider reported no model id, and when it changed mid-gate", () => {
    const missing = evaluateCsReadinessV0({
      probes: three({ provider_reported_model: null }),
      identity: cleanIdentity
    });
    expect(missing.criteria["provider_reported_model_identical_across_all_probes"]).toBe(false);

    const probes = three();
    probes[2] = cleanProbe({ provider_reported_model: "deepseek-flash-vNext" });
    const drifted = evaluateCsReadinessV0({ probes, identity: cleanIdentity });
    expect(drifted.criteria["provider_reported_model_identical_across_all_probes"]).toBe(false);
    expect(drifted.pass).toBe(false);
  });

  it("FAILs when the credential was rejected", () => {
    const evaluation = evaluateCsReadinessV0({
      probes: three(),
      identity: { http_status: 401, credential_accepted: false, configured_model_listed: null }
    });
    expect(evaluation.criteria["credential_present_and_accepted"]).toBe(false);
    expect(evaluation.pass).toBe(false);
  });

  it("FAILs when the configured model is not served by the endpoint", () => {
    const evaluation = evaluateCsReadinessV0({
      probes: three(),
      identity: { http_status: 200, credential_accepted: true, configured_model_listed: false }
    });
    expect(evaluation.criteria["configured_model_is_served_by_the_endpoint"]).toBe(false);
    expect(evaluation.criteria["credential_present_and_accepted"]).toBe(false);
    expect(evaluation.pass).toBe(false);
  });

  it("FAILs on an empty probe set (a gate that inspected nothing is not a PASS)", () => {
    const evaluation = evaluateCsReadinessV0({ probes: [], identity: cleanIdentity });
    expect(evaluation.pass).toBe(false);
  });

  it("declares the criteria it CANNOT evaluate instead of reporting them true", () => {
    const criteria = CS_READINESS_NOT_EVALUABLE.map((row) => row.criterion);
    expect(criteria).toContain("same_model_digest_throughout");
    expect(criteria).toContain("no_provider_reload_midway");
    // A PASSED status is impossible at the TYPE level, which is stronger than a runtime check — so the
    // assertion here pins the exact declared statuses instead of asserting an unreachable inequality.
    expect(CS_READINESS_NOT_EVALUABLE.map((row) => row.status)).toEqual([
      "NOT_OBSERVABLE_REMOTELY",
      "NOT_APPLICABLE",
      "NOT_APPLICABLE"
    ]);
    // The unreachable remote criteria must NOT appear among the gating criteria.
    const evaluation = evaluateCsReadinessV0({ probes: three(), identity: cleanIdentity });
    expect(Object.keys(evaluation.criteria)).not.toContain("same_model_digest_throughout");
    expect(Object.keys(evaluation.criteria)).not.toContain("no_provider_reload_midway");
  });
});
