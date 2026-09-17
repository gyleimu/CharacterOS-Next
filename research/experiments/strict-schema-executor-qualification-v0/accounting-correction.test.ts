/**
 * STRICT_SCHEMA_EXECUTOR_QUALIFICATION_V0 — ACCOUNTING CORRECTION tests (0 model calls).
 *
 * These pin the corrected accounting: two local runs of 5 calls, 10 actual model
 * calls, 0 external calls, the first run's artifact honestly marked as overwritten,
 * one rubric hash across all three checkpoints, the full-V8 scope seal, and the fact
 * that this remediation made no model call and re-ran no gate.
 */
import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { MAX_CALLS_PER_CANDIDATE } from "./contract.ts";
import {
  canonicalJson,
  CORRECTION_MARKERS,
  deriveAccountingCorrection,
  extractLoggedCalls,
  groupRuns,
  hashAccountingCorrection,
  ORIGINAL_ARTIFACT_FILE_HASH,
  ORIGINAL_ARTIFACT_HASH,
  RUBRIC_HASH,
  type AccountingCorrection
} from "./accounting-correction.ts";

const REPO_ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "..");
const ORIGINAL_PATH = join(REPO_ROOT, "tmp/qualification/strict-schema-executor-qualification-v0.json");
const CORRECTION_PATH = join(REPO_ROOT, "tmp/qualification/strict-schema-executor-qualification-accounting-correction.json");
const LOG_PATH = join(REPO_ROOT, "tmp/ollama-serve-restart.log");
const SEAL_PATH = join(REPO_ROOT, "research/experiments/strict-schema-executor-qualification-v0/ACCOUNTING_CORRECTION.md");

/** A synthetic log fixture: exactly the shape the real server writes. */
const SYNTHETIC_LOG = [
  "[GIN] 2026/09/17 - 19:33:03 | 200 |   31.7439ms |    127.0.0.1 | GET      \"/api/tags\"",
  "[GIN] 2026/09/17 - 19:38:11 | 200 | 16.5786071s |    127.0.0.1 | POST     \"/api/chat\"",
  "[GIN] 2026/09/17 - 19:38:13 | 200 |  1.6258614s |    127.0.0.1 | POST     \"/api/chat\"",
  "[GIN] 2026/09/17 - 19:38:14 | 200 |  1.2976886s |    127.0.0.1 | POST     \"/api/chat\"",
  "[GIN] 2026/09/17 - 19:38:16 | 200 |  1.5286715s |    127.0.0.1 | POST     \"/api/chat\"",
  "[GIN] 2026/09/17 - 19:38:38 | 200 | 22.8473958s |    127.0.0.1 | POST     \"/api/chat\"",
  "[GIN] 2026/09/17 - 19:39:58 | 200 |  1.7861483s |    127.0.0.1 | POST     \"/api/chat\"",
  "[GIN] 2026/09/17 - 19:40:00 | 200 |  1.4204705s |    127.0.0.1 | POST     \"/api/chat\"",
  "[GIN] 2026/09/17 - 19:40:01 | 200 |   990.0188ms |    127.0.0.1 | POST     \"/api/chat\"",
  "[GIN] 2026/09/17 - 19:40:02 | 200 |  1.2723349s |    127.0.0.1 | POST     \"/api/chat\"",
  "[GIN] 2026/09/17 - 19:41:53 | 200 |       1m50s |    127.0.0.1 | POST     \"/api/chat\"",
  "[GIN] 2026/09/16 - 19:35:14 | 200 | 15.0186044s |    127.0.0.1 | POST     \"/api/chat\""
].join("\n");

function syntheticOriginal(recordedCalls: number): string {
  const core = {
    schema_version: "strict-schema-executor-qualification-v0",
    candidates: [{ candidate: { id: "ollama-local" }, calls: recordedCalls }],
    total_candidate_calls: recordedCalls
  };
  return JSON.stringify({ ...core, artifact_hash: hashAccountingCorrection(core as never) });
}

/* --- log extraction and grouping ------------------------------------------------------ */

describe("ACCOUNTING CORRECTION — forensic extraction", () => {
  it("TEST_LOG_EXTRACTION_IS_DATE_PINNED_AND_ANCHORED", () => {
    const calls = extractLoggedCalls({ logText: SYNTHETIC_LOG });
    expect(calls.length).toBe(11);
    expect(calls.filter((call) => call.path === "/api/chat").length).toBe(10);
    expect(calls.filter((call) => call.path === "/api/tags").length).toBe(1);
    // line numbers and byte offsets are recorded so the anchor survives log growth
    expect(calls[1]?.line).toBe(2);
    expect(calls[1]?.byte_offset).toBeGreaterThan(0);
    expect(calls[1]?.completed_at).toBe("19:38:11");
    expect(calls[1]?.duration).toBe("16.5786071s");
  });

  it("TEST_RUNS_GROUP_BY_THE_FROZEN_BUDGET", () => {
    const calls = extractLoggedCalls({ logText: SYNTHETIC_LOG });
    const runs = groupRuns(calls);
    expect(MAX_CALLS_PER_CANDIDATE).toBe(5);
    expect(runs.length).toBe(2);
    expect(runs[0]?.length).toBe(5);
    expect(runs[1]?.length).toBe(5);
    // the grouping is the budget's, not a timing heuristic
    expect(runs[0]?.map((call) => call.completed_at)).toEqual(["19:38:11", "19:38:13", "19:38:14", "19:38:16", "19:38:38"]);
    expect(runs[1]?.map((call) => call.completed_at)).toEqual(["19:39:58", "19:40:00", "19:40:01", "19:40:02", "19:41:53"]);
  });
});

/* --- the corrected ledger -------------------------------------------------------------- */

describe("ACCOUNTING CORRECTION — the true ledger", () => {
  const correction: AccountingCorrection = deriveAccountingCorrection({
    originalArtifactText: syntheticOriginal(5),
    logText: SYNTHETIC_LOG
  });

  it("TEST_LEDGER_TOTALS_ARE_TEN_WITH_ZERO_EXTERNAL", () => {
    expect(correction.execution_ledger.run_1.calls).toBe(5);
    expect(correction.execution_ledger.run_2.calls).toBe(5);
    expect(correction.execution_ledger.total_actual_model_calls).toBe(10);
    expect(correction.execution_ledger.total_local_ollama_calls).toBe(10);
    expect(correction.execution_ledger.external_provider_calls).toBe(0);
    expect(correction.execution_ledger.deepseek_calls).toBe(0);
    expect(correction.execution_ledger.openai_calls).toBe(0);
    expect(correction.execution_ledger.anthropic_calls).toBe(0);
    expect(correction.execution_ledger.gemini_calls).toBe(0);
  });

  it("TEST_RUN_STATUSES_AND_WINDOWS", () => {
    expect(correction.execution_ledger.run_1.status).toBe("SUPERSEDED");
    expect(correction.execution_ledger.run_1.artifact_status).toBe("OVERWRITTEN_NOT_PRESERVED");
    expect(correction.execution_ledger.run_1.window_local_completion).toContain("19:38:11–19:38:38");
    expect(correction.execution_ledger.run_2.status).toBe("AUTHORITATIVE_PRESERVED_ARTIFACT_RUN");
    expect(correction.execution_ledger.run_2.artifact_status).toBe("PRESERVED");
    expect(correction.execution_ledger.run_2.window_local_completion).toContain("19:39:58–19:41:53");
  });

  it("TEST_FIRST_RUN_ARTIFACT_HONESTLY_MARKED_AND_NOT_RECONSTRUCTED", () => {
    expect(correction.first_run_artifact_status).toBe("OVERWRITTEN_NOT_PRESERVED");
    expect(correction.first_run_raw_outputs_reconstructed).toBe(false);
    expect(correction.execution_ledger.run_1.raw_outputs_reconstructed).toBe(false);
    // no raw model output for the first run exists anywhere in the correction
    expect(JSON.stringify(correction)).not.toContain("communication_directive\":{\"kind");
    expect(correction.markers).toEqual(CORRECTION_MARKERS);
    expect(correction.model_calls_made_by_this_correction).toBe(0);
  });

  it("TEST_RUBRIC_HASH_IS_IDENTICAL_AT_ALL_THREE_CHECKPOINTS", () => {
    expect(correction.rubric_history.pre_first_call).toBe(RUBRIC_HASH);
    expect(correction.rubric_history.post_fix).toBe(RUBRIC_HASH);
    expect(correction.rubric_history.final).toBe(RUBRIC_HASH);
    expect(correction.rubric_history.rubric_changed_after_outcome).toBe(false);
  });

  it("TEST_FIX_IS_NOT_LOAD_BEARING_FOR_THE_LOGICAL_GATE", () => {
    expect(correction.fix_scope_history.post_outcome_fix_load_bearing_for_ollama_gate_s).toBe(false);
    expect(correction.fix_scope_history.pre_first_call_commit).toBe("378180b631bea452001e41cfb182fc22b832623f");
    expect(correction.fix_scope_history.post_fix_commit).toBe("ee724a11dea25dbe65be48ad09180ce6c311145d");
    expect(correction.fix_scope_history.fix_scope).toContain("negative-control");
  });

  it("TEST_FULL_V8_SCOPE_SEAL", () => {
    expect(correction.full_v8_scope_seal.FULL_V8_FORMAT_ACCEPTED).toBe(true);
    expect(correction.full_v8_scope_seal.FULL_V8_GENERATION_COMPLETED).toBe(false);
    expect(correction.full_v8_scope_seal.FULL_V8_SCHEMA_SHAPE_VALID).toBe("NOT_ESTABLISHED");
    expect(correction.full_v8_scope_seal.FULL_V8_PRODUCTION_CANONICALIZER_VALID).toBe("NOT_TESTED");
    expect(correction.full_v8_scope_seal.MAX_LENGTH_SEMANTICS).toBe("UNVERIFIED");
    expect(correction.full_v8_scope_seal.s6_criterion_redefined).toBe(false);
  });

  it("TEST_STRUCTURAL_WORDING_IS_NOT_UPGRADED_TO_COGNITION", () => {
    expect(correction.ollama_structural_gate_wording.wording).toBe(
      "OLLAMA_LOCAL_QWEN3_5_9B_STRUCTURAL_GATE_PASS_UNDER_FROZEN_RUBRIC"
    );
    expect(correction.ollama_structural_gate_wording.cognition_pass_claimed).toBe(false);
    expect(correction.ollama_structural_gate_wording.scope.join(" ")).toContain("NOT proven");
    expect(correction.ollama_structural_gate_wording.scope.join(" ")).toContain("UNVERIFIED");
  });

  it("TEST_EXISTING_COGNITION_EVIDENCE_IS_CONTEXT_NOT_A_VERDICT", () => {
    expect(correction.existing_cognition_evidence.familiarity_result).toBe("FAMILIARITY_EFFECT_INCONCLUSIVE");
    expect(correction.existing_cognition_evidence.host_complete).toBe(false);
    expect(correction.existing_cognition_evidence.is_a_gate_c_verdict).toBe(false);
    expect(correction.existing_cognition_evidence.status).toBe("WEAK_INCONCLUSIVE_FOR_QUALIFICATION_PURPOSES");
  });

  it("TEST_CANDIDATE_STATES_AND_BUDGET_DISCLOSURE", () => {
    const byId = new Map(correction.candidate_call_ledger.map((entry) => [entry.id, entry]));
    expect(byId.get("deepseek-api")?.state).toBe("STRICT_FEATURE_UNAVAILABLE");
    expect(byId.get("deepseek-api")?.calls_in_gate_s).toBe(0);
    for (const id of ["openai-strict", "anthropic-strict", "gemini-strict"]) {
      expect(byId.get(id)?.state, id).toBe("NOT_TESTED_NO_CREDENTIAL");
      expect(byId.get(id)?.calls_in_gate_s, id).toBe(0);
    }
    expect(correction.call_budget_disclosure.published_artifact_reported_calls).toBe(5);
    expect(correction.call_budget_disclosure.true_total_model_calls).toBe(10);
    expect(correction.call_budget_disclosure.local_runs).toBe(2);
    expect(correction.call_budget_disclosure.note).toContain("superseded");
    expect(correction.gate_c.executed).toBe(false);
    expect(correction.gate_c.calls).toBe(0);
    expect(correction.formal_executor_changed).toBe(false);
  });

  it("TEST_CORRECTION_IS_DETERMINISTIC", () => {
    const first = deriveAccountingCorrection({ originalArtifactText: syntheticOriginal(5), logText: SYNTHETIC_LOG });
    const second = deriveAccountingCorrection({ originalArtifactText: syntheticOriginal(5), logText: SYNTHETIC_LOG });
    expect(canonicalJson(first)).toBe(canonicalJson(second));
    expect(hashAccountingCorrection(first)).toBe(hashAccountingCorrection(second));
    // a log that does not contain two runs is refused rather than guessed
    expect(() => deriveAccountingCorrection({ originalArtifactText: syntheticOriginal(5), logText: "" })).toThrow(
      /ACCOUNTING_CORRECTION_EXPECTED_TWO_RUNS_IN_LOG/
    );
  });
});

/* --- the real artifacts (guarded: they are untracked scratch) --------------------------- */

describe("ACCOUNTING CORRECTION — the real evidence", () => {
  it("TEST_ORIGINAL_ARTIFACT_IS_UNCHANGED", () => {
    if (!existsSync(ORIGINAL_PATH)) return;
    const raw = readFileSync(ORIGINAL_PATH, "utf8");
    const parsed = JSON.parse(raw) as Record<string, unknown> & { artifact_hash: string };
    const { artifact_hash: recorded, ...core } = parsed;
    expect(`sha256:${createHash("sha256").update(canonicalJson(core), "utf8").digest("hex")}`).toBe(recorded);
    expect(recorded).toBe(ORIGINAL_ARTIFACT_HASH);
    expect(`sha256:${createHash("sha256").update(raw, "utf8").digest("hex")}`).toBe(ORIGINAL_ARTIFACT_FILE_HASH);
    expect(parsed["total_candidate_calls"]).toBe(5);
  });

  it("TEST_REAL_CORRECTION_DERIVES_FROM_THE_REAL_LOG", () => {
    if (!existsSync(ORIGINAL_PATH) || !existsSync(LOG_PATH)) return;
    const correction = deriveAccountingCorrection({
      originalArtifactText: readFileSync(ORIGINAL_PATH, "utf8"),
      logText: readFileSync(LOG_PATH, "utf8")
    });
    expect(correction.execution_ledger.total_actual_model_calls).toBe(10);
    expect(correction.execution_ledger.external_provider_calls).toBe(0);
    expect(correction.server_log_forensics.model_calls_on_run_day).toBe(10);
    expect(correction.server_log_forensics.task_ids_available).toBe(false);
    expect(correction.original_qualification_artifact.core_hash_verified).toBe(true);
    expect(correction.original_qualification_artifact.recorded_candidate_calls).toBe(5);
    if (existsSync(CORRECTION_PATH)) {
      const stored = JSON.parse(readFileSync(CORRECTION_PATH, "utf8")) as AccountingCorrection;
      expect(hashAccountingCorrection(stored)).toBe(stored.artifact_hash);
      expect(canonicalJson(stored)).toBe(canonicalJson({ ...correction, artifact_hash: stored.artifact_hash }));
    }
  });

  it("TEST_TRACKED_SEAL_RECORDS_THE_CORRECTION", () => {
    expect(existsSync(SEAL_PATH)).toBe(true);
    const seal = readFileSync(SEAL_PATH, "utf8");
    expect(seal).toContain("TOTAL_ACTUAL_MODEL_CALLS = 10");
    expect(seal).toContain("OVERWRITTEN_NOT_PRESERVED");
    expect(seal).toContain(ORIGINAL_ARTIFACT_HASH);
    expect(seal).toContain("RUBRIC_CHANGED_AFTER_OUTCOME = false");
    expect(seal).toContain("POST_OUTCOME_FIX_LOAD_BEARING_FOR_OLLAMA_GATE_S = false");
    expect(seal).toContain("FULL_V8_GENERATION_COMPLETED          = false");
    expect(seal).toContain("MAX_LENGTH_SEMANTICS                  = UNVERIFIED");
    expect(seal).toContain("NOT a cognition pass");
    expect(seal).toContain("FAMILIARITY_EFFECT_INCONCLUSIVE");
    expect(seal).toContain("PRIMARY_AUTHORIZED = FALSE");
  });

  it("TEST_REMEDIATION_MAKES_NO_MODEL_CALL_AND_TOUCHES_NO_OTHER_ARTIFACT", () => {
    for (const file of ["accounting-correction.ts", "cli.ts"]) {
      const source = readFileSync(join(REPO_ROOT, "research/experiments/strict-schema-executor-qualification-v0", file), "utf8");
      const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      // the correction path performs no network call and builds no transport
      if (file === "accounting-correction.ts") {
        expect(code).not.toMatch(/\bfetch\(|createOllamaGrammarTransport|createStrictOpenAiTransport/);
      }
      expect(code).not.toMatch(/writeCalibrationEvidence|calibration-evidence/);
    }
    // and the other historical artifacts are untouched by this slice
    const checks: readonly (readonly [string, string, string])[] = [
      ["tmp/bcv1/calibration-evidence-post-parity.json", "evidence_hash", "sha256:4903749a36df562f8793b1e352fb6f0cd624ec97ec9d6bbb90803f00415bd128"],
      ["tmp/bcv1/calibration-evidence-917d5d1.json", "evidence_hash", "sha256:a556a5193be0d9b5e147790a10e956f7e85faea99fbc50c7edc5d0624b92bf48"],
      ["tmp/probe/structured-output-capability-probe-v0.json", "artifact_hash", "sha256:b0e5c09cecf3e2fd1c9bd4eac9b286d7155ecb0b08707845465825f6ad659443"],
      ["tmp/diag/post-parity-schema-failure-diagnostic-v0.json", "artifact_hash", "sha256:25fd022ae8153675765ee264eabe9d1946a0d100eb67bbde82ff8093244c19a3"]
    ];
    for (const [path, field, expected] of checks) {
      const absolute = join(REPO_ROOT, path);
      if (!existsSync(absolute)) continue;
      const artifact = JSON.parse(readFileSync(absolute, "utf8")) as Record<string, unknown>;
      expect(artifact[field], path).toBe(expected);
    }
  });
});
