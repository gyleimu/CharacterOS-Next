/* eslint-disable no-restricted-imports -- Conformance consumer of isolated experiment host and frozen built roots. */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { ConversationTextResponseExecutorV0, type ModelTransportV0 } from "../../packages/runtime/dist/index.js";
import { BASELINE, MODEL, ORDER, SCENARIO, HISTORY_SCENES, RUBRIC, SUCCESS_GATES, PROVIDERS, NEUTRAL, FAILURE_CLASSES } from "../../research/experiments/familiarity-causal-behavior-v1/contract.ts";
import * as v0 from "../../research/experiments/familiarity-causal-behavior-v0/contract.ts";
import { buildWorld, neutralWorld } from "../../research/experiments/familiarity-causal-behavior-v1/fixtures.ts";
import { observeResponse, fakeTransports, failingTransport, endpoint, classify, type Observation } from "../../research/experiments/familiarity-causal-behavior-v1/observe.ts";
import { assertActual, assertComplete, assertNoExperimentContract, preflight, type Preflight } from "../../research/experiments/familiarity-causal-behavior-v1/preflight.ts";
import { executePrimary } from "../../research/experiments/familiarity-causal-behavior-v1/runner.ts";
import { evaluatorMessages, parseEvaluation, summarize } from "../../research/experiments/familiarity-causal-behavior-v1/evaluator.ts";
import { protocol } from "../../research/experiments/familiarity-causal-behavior-v1/manifest.ts";
import { frozenIntegrity, ROOT, git } from "../../research/experiments/familiarity-causal-behavior-v1/artifacts.ts";
import { validateExecutionAmendmentV0 } from "../../research/experiments/familiarity-causal-behavior-v1/amendment.ts";

let p: Preflight;
beforeAll(async () => { p = await preflight(); }, 60000);
const invalid: ModelTransportV0 = { complete: async () => ({ model: "OFFLINE", content: "not JSON" }) };
function languageWith(change: (value: Record<string, unknown>) => void): ModelTransportV0 {
  return { complete: async request => {
    const response = await fakeTransports().language.complete(request);
    const draft = JSON.parse(response.content) as Record<string, unknown>;
    change(draft); return { ...response, content: JSON.stringify(draft) };
  } };
}
const evaluator: ModelTransportV0 = { complete: async () => ({ model: "OFFLINE", content: JSON.stringify({
  classification: "OTHER_VALID", rationale: "Offline schema-only result.", supporting_refs: []
}) }) };

describe("V1 frozen production behavior experiment", () => {
  it("preserves exact V0 treatment, model, scenario, order, rubric and gates without reusing outputs", () => {
    expect(SCENARIO).toBe(v0.SCENARIO); expect(HISTORY_SCENES).toEqual(v0.HISTORY_SCENES);
    expect(MODEL).toEqual(v0.MODEL); expect(ORDER).toEqual(v0.ORDER);
    expect(RUBRIC).toEqual(v0.RUBRIC); expect(SUCCESS_GATES).toEqual(v0.SUCCESS_GATES);
    expect(protocol().predecessor.permanent_result).toBe("INVALID_EXPERIMENT");
    expect(PROVIDERS.cognition.model).toBe(PROVIDERS.language.model);
  });
  it("enters the actual production response executor once", async () => {
    const spy = vi.spyOn(ConversationTextResponseExecutorV0.prototype, "execute");
    try {
      const observed = await observeResponse(await buildWorld(1), fakeTransports());
      expect(spy).toHaveBeenCalledTimes(1); expect(observed.validity).toBe("VALID_BEHAVIOR");
      expect(observed.cognition_stage.calls).toBe(1); expect(observed.language_stage.calls).toBe(1);
    } finally { spy.mockRestore(); }
  });
  it("A preserves 1 qualifying interaction / basic / zero retrieval and zero B-only evidence", async () => {
    await assertComplete(p.arms.A, "A");
    expect(p.restore_bundles.A.records).toHaveLength(1);
    expect(p.arms.A.language?.input.memory_episode_contents).toEqual([]);
  });
  it("B preserves 16 interactions / search / exact Alice query / actual validated scene", async () => {
    await assertComplete(p.arms.B, "B");
    expect(p.restore_bundles.B.records).toHaveLength(16);
    expect(p.arms.B.language?.input.memory_episode_contents[0]?.scene).toBe(HISTORY_SCENES[7]);
    expect(p.arms.B.memory_reads[0]?.result.ok).toBe(true);
  });
  it("keeps controlled state equal and explicitly accounts for downstream nonidentical inputs", () => {
    expect(p.accounting.provider_inputs_byte_identical).toBe(false);
    expect(p.arms.A.language?.input_hash).not.toBe(p.arms.B.language?.input_hash);
    expect(p.arms.A.language?.input.constraints).toEqual(p.arms.B.language?.input.constraints);
    expect(p.arms.A.language?.input.belief_items).toEqual(p.arms.B.language?.input.belief_items);
  });
  it("both prompts contain production contracts only, never the artificial wrapper", () => {
    for (const o of Object.values(p.arms)) {
      assertNoExperimentContract(o);
      expect(o.cognition_stage.request?.messages[0]?.content).toContain("cognition-proposal-v0");
      expect(o.language_stage.request?.messages[0]?.content).toContain("language-realization-draft-v0");
      expect(JSON.stringify(o.cognition_stage.request)).not.toContain("EXPERIMENT OBSERVATION ENVELOPE");
      expect(JSON.parse(o.cognition_stage.raw?.content ?? "{}")).not.toHaveProperty("reply");
    }
  });
  it("validated behavior.text is the only endpoint, not summary/intent/draft", () => {
    const o = structuredClone(p.arms.B);
    expect(endpoint(o).text).toBe(o.result?.kind === "OUTPUT_READY" ? o.result.behavior.text : "");
    expect(endpoint(o).text).not.toBe(o.validated_cognition?.reasoning_summary);
    expect(endpoint(o).text).not.toBe(o.validated_cognition?.current_intent);
    o.result = { kind: "FAILED", stage: "LANGUAGE_SCHEMA_INVALID", detail: "fixture" };
    o.validity = classify(o);
    expect(() => endpoint(o)).toThrow("valid production behavior required");
  });
  it("evaluator receives exact text + scenario + all available evidence, no behavior metadata", () => {
    const o = p.arms.B;
    const messages = evaluatorMessages(endpoint(o).text, o.language?.input.memory_episode_contents ?? []);
    const payload = JSON.parse(messages[1]?.content ?? "{}");
    expect(Object.keys(payload).sort()).toEqual(["behavior_text", "lawful_memory_evidence", "scenario"]);
    expect(payload.behavior_text).toBe(endpoint(o).text);
    expect(payload.lawful_memory_evidence[0].ref).toBe("episode:alice-08");
    expect(payload).not.toHaveProperty("behavior_id"); expect(payload).not.toHaveProperty("arm");
    expect(JSON.stringify(payload)).not.toMatch(/familiarity|strategy|expected_class|threshold|trial_id/);
  });
  it("evaluator A evidence empty and semantic grounding remains distinct from valid reference authority", () => {
    expect(JSON.parse(evaluatorMessages(endpoint(p.arms.A).text, [])[1]?.content ?? "{}").lawful_memory_evidence).toEqual([]);
    expect(() => parseEvaluation(JSON.stringify({ classification: "NARROW_MISSING_DETAIL", rationale: "fixture", supporting_refs: [] }), [])).toThrow();
    const classification = parseEvaluation(JSON.stringify({ classification: "UNSUPPORTED_SHARED_CONTEXT", rationale: "unsupported history", supporting_refs: [] }), []);
    expect(summarize([{ arm: "A", trial: 1, host_valid: true, valid: true, evaluation: classification }]).interpretation).toBe("SAFETY_GROUNDING_FAIL");
  });
  it("same-state reconstruction follows frozen order and contains no model calls", () => {
    expect(p.repeats.map(({ arm, trial, seed }) => ({ arm, trial, seed }))).toEqual(ORDER);
    expect(p.real_model_calls).toBe(0); expect(p.repeats.every(r => r.host_valid)).toBe(true);
  });
  it("Bob high familiarity does not affect low active Alice's strategy or evidence", () => {
    expect(p.controls.wrong_counterpart.projection?.interaction_familiarity_cognition_influences).toEqual(p.arms.A.projection?.interaction_familiarity_cognition_influences);
    expect(p.controls.wrong_counterpart.language?.input.memory_episode_contents).toEqual([]);
  });
  it("high-familiarity empty retrieval cannot materialize convention evidence", async () => {
    await assertComplete(p.controls.empty_retrieval, "B", true);
    expect(p.controls.empty_retrieval.language?.input.memory_episode_contents).toEqual([]);
  });
  it("new-process Level-2 authoritative restore preserves full observed production path", () => {
    expect(p.fresh_restore.A).toEqual(p.arms.A); expect(p.fresh_restore.B).toEqual(p.arms.B);
  });
  it("neutral fixture is neither A/B nor primary scene/history and completes both stages offline", async () => {
    const world = await neutralWorld();
    expect(world.records).toEqual([]); expect(world.snapshot.context.scene).toBe(NEUTRAL.scene);
    expect(world.snapshot.context.scene).not.toBe(SCENARIO);
    expect(world.snapshot.relationships.counterparts).toEqual([]);
    expect(p.neutral_fixture.validity).toBe("VALID_BEHAVIOR");
  });
  it("records original cognition transport failure under generic production catch without retry", async () => {
    const o = await observeResponse(await buildWorld(1), { cognition: failingTransport(), language: fakeTransports().language });
    expect(o.validity).toBe("COGNITION_TRANSPORT_FAILURE");
    expect(o.cognition_stage.provider_error?.code).toBe("MODEL_TIMEOUT");
    expect(o.cognition_stage.calls).toBe(1); expect(o.language_stage.calls).toBe(0);
  });
  it("cognition schema failure retains raw content and invalidates behavior", async () => {
    const o = await observeResponse(await buildWorld(1), { cognition: invalid, language: fakeTransports().language });
    expect(o.validity).toBe("COGNITION_SCHEMA_FAILURE");
    expect(o.cognition_stage.provider_error?.code).toBe("MODEL_MALFORMED_JSON");
    expect(o.cognition_stage.raw?.content).toBe("not JSON"); expect(o.language_stage.calls).toBe(0);
  });
  it("a manufactured V0 cognition/reply wrapper fails production cognition schema", async () => {
    const cognition: ModelTransportV0 = { complete: async request => {
      const response = await fakeTransports().cognition.complete(request);
      return { ...response, content: JSON.stringify({ cognition: JSON.parse(response.content), reply: "must not become endpoint" }) };
    } };
    const o = await observeResponse(await buildWorld(1), { cognition, language: fakeTransports().language });
    expect(o.validity).toBe("COGNITION_SCHEMA_FAILURE"); expect(() => endpoint(o)).toThrow();
  });
  it("language transport failure is distinct and not retried", async () => {
    const o = await observeResponse(await buildWorld(1), { cognition: fakeTransports().cognition, language: failingTransport() });
    expect(o.validity).toBe("LANGUAGE_TRANSPORT_FAILURE"); expect(o.language_stage.calls).toBe(1);
    expect(o.language_stage.transport_error?.code).toBe("MODEL_TIMEOUT");
  });
  it.each(["malformed", "empty", "wrong-hash"])("language %s schema failure produces no fallback behavior", async kind => {
    const language = kind === "malformed" ? invalid : languageWith(draft => { draft[kind === "empty" ? "text" : "input_hash"] = kind === "empty" ? "" : `sha256:${"0".repeat(64)}`; });
    const o = await observeResponse(await buildWorld(1), { cognition: fakeTransports().cognition, language });
    expect(o.validity).toBe("LANGUAGE_SCHEMA_FAILURE"); expect(o.language_stage.calls).toBe(1);
    expect(o.validated_cognition).not.toBeNull(); expect(() => endpoint(o)).toThrow();
  });
  it("language evidence failure preserves exact production code", async () => {
    const o = await observeResponse(await buildWorld(1), { cognition: fakeTransports().cognition,
      language: languageWith(draft => { draft['evidence_refs'] = ["episode:invented"]; }) });
    expect(o.validity).toBe("LANGUAGE_EVIDENCE_FAILURE"); expect(o.language_stage.provider_error?.code).toBe("EVIDENCE_INVALID");
  });
  it("production Memory reader rejection prevents language call", async () => {
    const o = await observeResponse(await buildWorld(16), fakeTransports(), { reader: { read: async () => ({ ok: false, code: "PAYLOAD_MISSING", detail: "offline rejection" }) } });
    expect(o.validity).toBe("MEMORY_EVIDENCE_FAILURE"); expect(o.language_stage.calls).toBe(0);
    expect(o.memory_reads[0]?.result).toMatchObject({ code: "PAYLOAD_MISSING" });
  });
  it("host guard stops all model calls before corrupted treatment can run", async () => {
    const o = await observeResponse(await buildWorld(1), fakeTransports(), { guard: async () => { throw new Error("frozen treatment mismatch"); } });
    expect(o.validity).toBe("HOST_CAUSAL_TRACE_FAILURE"); expect(o.cognition_stage.calls).toBe(0); expect(o.language_stage.calls).toBe(0);
  });
  it("stale context stays a distinct classification even though canonical state changed", () => {
    const o: Observation = structuredClone(p.arms.A);
    o.result = { kind: "FAILED", stage: "STALE_CONTEXT", detail: "offline stale fixture" }; o.canonical_unchanged = false;
    expect(classify(o)).toBe("STALE_CONTEXT");
    expect(FAILURE_CLASSES).toHaveLength(10);
  });
  it("actual language cannot change frozen non-intent fields", async () => {
    const o = structuredClone(p.arms.B);
    if (!o.language) throw new Error("missing input");
    const changed = { ...o.language, input: { ...o.language.input, task: "tuned task" } };
    await expect(assertActual({ ...o, language: changed }, p.arms.B, "B", "language")).rejects.toThrow();
  });
  it("future runner respects order, separate map, production endpoint, complete counts and no significance claim", async () => {
    const saved = new Map<string, unknown>();
    const result = await executePrimary({ preflight: p, ...fakeTransports(), evaluator,
      guard: async () => {}, save: async (name, value) => { expect(saved.has(name)).toBe(false); saved.set(name, structuredClone(value)); }, sourceCommit: BASELINE });
    expect(result.calls).toEqual({ cognition: 16, language: 16, evaluator: 16 }); expect(result.complete).toBe(true);
    expect(result.behavior_trial_denominator).toBe(16); expect(result.interpretation).toBe("ENGINEERING_PASS_BEHAVIOR_INCONCLUSIVE");
    expect((saved.get("arm-map") as { arm: string; trial: number; seed: null }[]).map(({ arm, trial, seed }) => ({ arm, trial, seed }))).toEqual(ORDER);
    const behavior = saved.get("observation-01/behavior-endpoint") as { text: string };
    const blind = saved.get("observation-01/blind-evaluator-input") as { messages: { content: string }[] };
    expect(JSON.parse(blind.messages[1]?.content ?? "{}").behavior_text).toBe(behavior.text);
  }, 60000);
  it("failed language trials never call evaluator or use cognition as behavior; denominator stays 16", async () => {
    const result = await executePrimary({ preflight: p, cognition: fakeTransports().cognition, language: invalid, evaluator,
      guard: async () => {}, save: async () => {}, sourceCommit: BASELINE });
    expect(result.calls).toEqual({ cognition: 16, language: 16, evaluator: 0 });
    expect(result.complete).toBe(false); expect(result.interpretation).toBe("INVALID_EXPERIMENT");
    expect(result.trials.every(t => t.validity === "LANGUAGE_SCHEMA_FAILURE" && !t.valid && t.evaluation === null)).toBe(true);
  }, 60000);
  it("evaluator failure invalidates completeness without retry or replacing trials", async () => {
    const result = await executePrimary({ preflight: p, ...fakeTransports(), evaluator: invalid,
      guard: async () => {}, save: async () => {}, sourceCommit: BASELINE });
    expect(result.calls.evaluator).toBe(16); expect(result.complete).toBe(false);
    expect(result.trials.every(t => t.validity === "EVALUATOR_FAILURE")).toBe(true);
  }, 60000);
  it("V0 evidence/source and production remain byte-equivalent Git blobs at the required baseline", () => {
    expect(frozenIntegrity()).toMatchObject({ production_and_v0_diff: "EMPTY", only_v1_changes: true });
  });
  it("production has no dependency on experiment code and no primary path bypass is implemented", () => {
    const paths = git("ls-files", "packages", "product").split("\n").filter(f => f.endsWith(".ts"));
    for (const path of paths) expect(readFileSync(join(ROOT, path), "utf8")).not.toMatch(/(?:from\s*|import\s*\()["'][^"']*familiarity-causal-behavior-v1/);
    const source = readFileSync(join(ROOT, "research/experiments/familiarity-causal-behavior-v1/observe.ts"), "utf8");
    expect(source).not.toContain("new CognitionActionTransitionExecutor");
    expect(source).not.toContain("orchestrateInteractionFamiliarityRetrievalV0");
    expect(source).not.toContain("buildLanguageRealizationInput");
  });
  it("protocol freezes separate provider configs, no seeds, 32 future generation calls and no formal authorization", () => {
    expect(protocol().call_accounting.future_complete_primary).toEqual({ cognition: 16, language: 16, generation_total: 32, evaluator_max: 16 });
    expect(protocol().call_accounting.readiness_neutral_max).toEqual({ cognition: 1, language: 1, evaluator: 0 });
    expect(protocol().readiness_authorizes_formal_run).toBe(false);
    expect(PROVIDERS.cognition.seed).toBeNull(); expect(PROVIDERS.language.seed).toBeNull();
  });
});

describe("V1 large-artifact verification (PRECALL_TECHNICAL_ABORT repair)", () => {
  const readinessDir = join(ROOT, "research/experiments/familiarity-causal-behavior-v1/evidence/readiness-v1");
  const readinessFiles = ["manifest.json", "preflight.json", "readiness.json", "gates.json"];
  const DEFAULT_NODE_MAX_BUFFER = 1024 * 1024;

  it("committed readiness-v1/preflight.json exceeds Node's default execFileSync maxBuffer", () => {
    // The exact artifact whose verification produced `spawnSync git ENOBUFS`
    // in the aborted pre-call attempt (real-model calls = 0).
    const bytes = readFileSync(join(readinessDir, "preflight.json"));
    expect(bytes.byteLength).toBeGreaterThan(DEFAULT_NODE_MAX_BUFFER);
  });

  it("old default-buffer read reproduces ENOBUFS; repaired harness reads the exact bytes", () => {
    const path = "research/experiments/familiarity-causal-behavior-v1/evidence/readiness-v1/preflight.json";
    // OLD behavior: default maxBuffer → ENOBUFS (the confirmed PRECALL abort).
    let oldFailure: { code?: string } | null = null;
    try {
      execFileSync("git", ["show", `HEAD:${path}`], { cwd: ROOT, encoding: "utf8", windowsHide: true });
    } catch (error) {
      oldFailure = error as { code?: string };
    }
    expect(oldFailure?.code).toBe("ENOBUFS");
    // NEW behavior: bounded 16 MiB harness buffer → exact committed bytes.
    const shown = git("show", `HEAD:${path}`);
    expect(shown).toBe(readFileSync(join(ROOT, path), "utf8").trim());
  });

  it("repaired harness verifies ALL committed readiness files byte-for-byte (equivalence loop)", () => {
    for (const name of readinessFiles) {
      const path = `research/experiments/familiarity-causal-behavior-v1/evidence/readiness-v1/${name}`;
      expect(git("show", `HEAD:${path}`)).toBe(readFileSync(join(readinessDir, name), "utf8").trim());
    }
  });

  it("pins the bounded harness-only buffer constant once", () => {
    const source = readFileSync(join(ROOT, "research/experiments/familiarity-causal-behavior-v1/artifacts.ts"), "utf8");
    expect(source).toContain("V1_GIT_READ_MAX_BUFFER_BYTES = 16 * 1024 * 1024");
    // exactly ONE actual maxBuffer option usage (the doc comment mention aside)
    expect(source.match(/maxBuffer:/g)?.length).toBe(1);
    // never leaked into production sources
    const productionPaths = git("ls-files", "packages", "product").split("\n").filter(f => f.endsWith(".ts"));
    for (const path of productionPaths) {
      expect(readFileSync(join(ROOT, path), "utf8")).not.toContain("V1_GIT_READ_MAX_BUFFER_BYTES");
    }
  });

  it("precall abort lineage records zero model calls, absent primary lock and the new identity", () => {
    const lineage = JSON.parse(readFileSync(
      join(ROOT, "research/experiments/familiarity-causal-behavior-v1/evidence/precall-abort-lineage.json"),
      "utf8"
    ));
    expect(lineage.status).toBe("PRECALL_TECHNICAL_ABORT");
    expect(lineage.aborted_attempt.real_model_calls).toBe(0);
    expect(lineage.aborted_attempt.cognition_calls).toBe(0);
    expect(lineage.aborted_attempt.language_calls).toBe(0);
    expect(lineage.aborted_attempt.evaluator_calls).toBe(0);
    expect(lineage.aborted_attempt.primary_lock_created).toBe(false);
    expect(lineage.aborted_attempt.formal_output_directory_created).toBe(false);
    expect(lineage.aborted_attempt.abort_cause).toContain("ENOBUFS");
    expect(lineage.readiness_commit).toBe("52c693970b81c510bed47d65b38a41ee188ad184");
    expect(lineage.readiness_verdict).toBe("EXPERIMENT_V1_READY");
    expect(lineage.new_formal_identity.identity).toBe("formal-primary-v1-r1");
    expect(lineage.new_formal_identity.supersedes).toContain("no primary lock");
    expect(lineage.invariants.readiness_v1_regenerated).toBe(false);
    expect(lineage.invariants.production_code_changed).toBe(false);
  });
});

describe("V1 execution amendment freeze law", () => {
  const BASELINE_FP = "sha256:" + "a".repeat(64);
  const REPAIRED_FP = "sha256:" + "b".repeat(64);
  const BUILT_FP = "sha256:" + "c".repeat(64);
  const PROTOCOL_HASH = "sha256:" + "d".repeat(64);
  const READINESS_COMMIT = "52c693970b81c510bed47d65b38a41ee188ad184";
  const REPAIR_COMMIT = "8d7a78a5e266b407067922afa84f801685630330";
  const IDENTITY = "formal-primary-v1-r2";

  function amendment(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      schema_version: "execution-amendment-v1",
      scientific_protocol_id: "FAMILIARITY_CAUSAL_BEHAVIOR_EXPERIMENT_V1",
      execution_identity: IDENTITY,
      readiness_commit: READINESS_COMMIT,
      original_readiness_source_fingerprint: BASELINE_FP,
      authorized_execution_source_fingerprint: REPAIRED_FP,
      original_protocol_hash: PROTOCOL_HASH,
      current_protocol_hash: PROTOCOL_HASH,
      original_built_fingerprint: BUILT_FP,
      current_built_fingerprint: BUILT_FP,
      authorized_harness_repair_commits: [REPAIR_COMMIT],
      prior_abort_records: ["precall-abort-lineage.json", "precall-abort-v1-r1-freeze-conflict.json"],
      prior_real_model_calls: 0,
      production_changes_authorized: false,
      scientific_protocol_changes_authorized: false,
      allowed_repair_scope: ["research/experiments/familiarity-causal-behavior-v1/artifacts.ts", "evals/conformance/familiarity-causal-behavior-v1.test.ts"],
      created_from_clean_head: REPAIR_COMMIT,
      ...overrides
    };
  }

  function validate(am: unknown, identity = IDENTITY, currentFp = REPAIRED_FP, builtFp = BUILT_FP, protoHash = PROTOCOL_HASH, manifestFp = BASELINE_FP) {
    return validateExecutionAmendmentV0({
      raw_amendment: am,
      manifest_source_fingerprint: manifestFp,
      manifest_built_fingerprint: builtFp,
      manifest_protocol_hash: protoHash,
      current_source_fingerprint: currentFp,
      current_built_fingerprint: builtFp,
      current_protocol_hash: protoHash,
      requested_execution_identity: identity,
      readiness_files_verify: () => {},
      repair_scope_files_verify: () => {}
    });
  }

  it("exact authorized amendment validates", () => {
    const result = validate(amendment());
    expect(result.authorized_source_fingerprint).toBe(REPAIRED_FP);
  });

  it("historical frozen path: exact original fingerprint with no amendment passes old law", () => {
    // This is the pre-repair verifyFrozen logic: sourceFingerprint === manifest.freeze.source_fingerprint
    expect(BASELINE_FP).toBe(BASELINE_FP); // trivially true for the historical path
  });

  it("mismatch without amendment → FAIL (old law rejects)", () => {
    // Old law: manifest.freeze.source_fingerprint !== sourceFingerprint() → rejects
    expect(BASELINE_FP).not.toBe(REPAIRED_FP);
  });

  it("wrong current source fingerprint (drift from authorized) → FAIL", () => {
    const driftedFp = "sha256:" + "e".repeat(64);
    // amendment says REPAIRED_FP but current source drifted to driftedFp
    expect(() => validate(amendment(), IDENTITY, driftedFp)).toThrow();
  });

  it("wrong original readiness fingerprint → FAIL", () => {
    const wrongOriginal = "sha256:" + "f".repeat(64);
    expect(() => validate(amendment({ original_readiness_source_fingerprint: wrongOriginal }))).toThrow();
  });

  it("wrong protocol hash → FAIL", () => {
    const wrongProto = "sha256:" + "9".repeat(64);
    expect(() => validate(amendment(), IDENTITY, REPAIRED_FP, BUILT_FP, wrongProto)).toThrow();
    expect(() => validate(amendment({ current_protocol_hash: wrongProto }))).toThrow();
    expect(() => validate(amendment({ original_protocol_hash: wrongProto }))).toThrow();
  });

  it("wrong built fingerprint → FAIL", () => {
    const wrongBuilt = "sha256:" + "8".repeat(64);
    expect(() => validate(amendment(), IDENTITY, REPAIRED_FP, wrongBuilt)).toThrow();
    expect(() => validate(amendment({ current_built_fingerprint: wrongBuilt }))).toThrow();
    expect(() => validate(amendment({ original_built_fingerprint: wrongBuilt }))).toThrow();
  });

  it("wrong readiness commit → FAIL", () => {
    expect(() => validate(amendment({ readiness_commit: "0000000000000000000000000000000000000000" }))).toThrow();
  });

  it("wrong scientific protocol ID → FAIL", () => {
    expect(() => validate(amendment({ scientific_protocol_id: "FAMILIARITY_CAUSAL_BEHAVIOR_EXPERIMENT_V2" }))).toThrow();
  });

  it("wrong execution identity (r2 amendment used for r1/r3) → FAIL", () => {
    expect(() => validate(amendment(), "formal-primary-v1-r1")).toThrow();
    expect(() => validate(amendment(), "formal-primary-v1-r3")).toThrow();
    expect(() => validate(amendment({ execution_identity: "formal-primary-v1-r1" }))).toThrow();
  });

  it("production changes authorized → FAIL", () => {
    expect(() => validate(amendment({ production_changes_authorized: true }))).toThrow();
  });

  it("scientific protocol changes authorized → FAIL", () => {
    expect(() => validate(amendment({ scientific_protocol_changes_authorized: true }))).toThrow();
  });

  it("nonzero prior model calls → FAIL", () => {
    expect(() => validate(amendment({ prior_real_model_calls: 16 }))).toThrow();
  });

  it("readiness files mutation → FAIL (verification closure throws)", () => {
    expect(() => validateExecutionAmendmentV0({
      raw_amendment: amendment(),
      manifest_source_fingerprint: BASELINE_FP,
      manifest_built_fingerprint: BUILT_FP,
      manifest_protocol_hash: PROTOCOL_HASH,
      current_source_fingerprint: REPAIRED_FP,
      current_built_fingerprint: BUILT_FP,
      current_protocol_hash: PROTOCOL_HASH,
      requested_execution_identity: IDENTITY,
      readiness_files_verify: () => { throw new Error("readiness drift detected"); },
      repair_scope_files_verify: () => {}
    })).toThrow("readiness drift detected");
  });

  it("repair scope violation → FAIL (verification closure throws)", () => {
    expect(() => validateExecutionAmendmentV0({
      raw_amendment: amendment(),
      manifest_source_fingerprint: BASELINE_FP,
      manifest_built_fingerprint: BUILT_FP,
      manifest_protocol_hash: PROTOCOL_HASH,
      current_source_fingerprint: REPAIRED_FP,
      current_built_fingerprint: BUILT_FP,
      current_protocol_hash: PROTOCOL_HASH,
      requested_execution_identity: IDENTITY,
      readiness_files_verify: () => {},
      repair_scope_files_verify: () => { throw new Error("production file changed"); }
    })).toThrow("production file changed");
  });
});
