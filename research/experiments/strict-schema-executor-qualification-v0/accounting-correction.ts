/**
 * STRICT_SCHEMA_EXECUTOR_QUALIFICATION_V0 — ACCOUNTING CORRECTION (derived, 0 calls).
 *
 * WHY THIS EXISTS: the Gate S run happened twice. The first run's artifact was
 * overwritten by the second, so the published qualification artifact records only
 * the second run's 5 calls while the true execution count was 10. The structural
 * observations were never in question — only the accounting was incomplete.
 *
 * This module DERIVES a correction from evidence that already exists: the preserved
 * artifact and the local inference server's access log. It makes NO model call,
 * re-runs no gate, re-scores nothing, and fabricates nothing: in particular it does
 * NOT reconstruct the first run's raw outputs, which were never preserved.
 */
import { createHash } from "node:crypto";

import { MAX_CALLS_PER_CANDIDATE } from "./contract.ts";

export const CORRECTION_ARTIFACT_SCHEMA_VERSION = "strict-schema-executor-qualification-accounting-correction-v0" as const;
export const CORRECTION_ID = "STRICT_SCHEMA_EXECUTOR_QUALIFICATION_ACCOUNTING_CORRECTION_V0" as const;

export const CORRECTION_MARKERS = Object.freeze({
  ACCOUNTING_CORRECTION_ONLY: true,
  DERIVED_FROM_EXISTING_EVIDENCE: true,
  ZERO_MODEL_CALLS: true,
  NO_SCIENTIFIC_OBSERVATION: true,
  NO_GATE_REEXECUTION: true,
  DOES_NOT_EDIT_THE_ORIGINAL_ARTIFACT: true
});

/** The published qualification artifact this correction is derived from. */
export const ORIGINAL_ARTIFACT_PATH = "tmp/qualification/strict-schema-executor-qualification-v0.json" as const;
export const ORIGINAL_ARTIFACT_HASH =
  "sha256:e02e553d2215b96c5199085b730a79b79e6c0a14ef5118f0190ae432395039b2" as const;
export const ORIGINAL_ARTIFACT_FILE_HASH =
  "sha256:401400dec63c5d0c9cf3a9df78e92321e97efcb854db3e0ae7ee57ff41816611" as const;

/** The inference server access log used as the forensic source. */
export const SERVER_LOG_PATH = "tmp/ollama-serve-restart.log" as const;
/** The run day, pinned: the only day on which Gate S calls were made. */
export const RUN_DAY = "2026/09/17" as const;

/** Rubric hash at every checkpoint: identical, because the rubric never changed. */
export const RUBRIC_HASH = "sha256:090dd99b080be17e5e5cea7dbd7a64d6975e5aded739523c846f23d6f4f1d400" as const;

export const PRE_FIRST_CALL_COMMIT = "378180b631bea452001e41cfb182fc22b832623f" as const;
export const POST_FIX_COMMIT = "ee724a11dea25dbe65be48ad09180ce6c311145d" as const;

export interface LoggedCall {
  /** 1-based line number in the log file. */
  readonly line: number;
  /** Byte offset of the line start, so the anchor survives later appends. */
  readonly byte_offset: number;
  readonly completed_at: string;
  readonly status: number;
  readonly duration: string;
  readonly method: string;
  readonly path: string;
}

export interface LogForensics {
  readonly path: string;
  readonly file_hash: string;
  readonly bytes: number;
  readonly lines: number;
  readonly run_day: string;
  readonly lines_on_run_day: number;
  readonly model_calls_on_run_day: number;
  readonly non_model_requests_on_run_day: readonly LoggedCall[];
  readonly task_ids_available: false;
  readonly task_id_note: string;
  readonly anchor_note: string;
}

const CALL_LINE = /^\s*\[GIN\] (\d{4}\/\d{2}\/\d{2}) - (\d{2}:\d{2}:\d{2}) \| (\d{3}) \| +([0-9a-z.]+m?s) \| +([\d.]+) \| (\w+) +"(\S+)"/;

/**
 * Deterministically extracts every request the local inference server logged on the
 * pinned run day. Line numbers and byte offsets are recorded because the log file
 * keeps growing: a reviewer can still locate each call after the hash moves.
 */
export function extractLoggedCalls(input: { readonly logText: string; readonly runDay?: string }): readonly LoggedCall[] {
  const runDay = input.runDay ?? RUN_DAY;
  const lines = input.logText.split(/\r?\n/);
  const calls: LoggedCall[] = [];
  let offset = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] as string;
    const match = CALL_LINE.exec(line);
    if (match !== null && match[1] === runDay) {
      calls.push({
        line: index + 1,
        byte_offset: offset,
        completed_at: match[2] as string,
        status: Number(match[3]),
        duration: match[4] as string,
        method: match[6] as string,
        path: match[7] as string
      });
    }
    offset += Buffer.byteLength(line, "utf8") + 1;
  }
  return calls;
}

/** Only POST /api/chat reaches a model; a GET /api/tags is not a model call. */
export function isModelCall(call: LoggedCall): boolean {
  return call.method === "POST" && call.path === "/api/chat";
}

/**
 * Groups the run day's model calls into runs of the FROZEN per-candidate budget.
 * The grouping is derived from the rubric's budget (5 calls per candidate), not from
 * timing heuristics, so it stays deterministic.
 */
export function groupRuns(calls: readonly LoggedCall[]): readonly (readonly LoggedCall[])[] {
  const modelCalls = calls.filter(isModelCall);
  const runs: LoggedCall[][] = [];
  for (let index = 0; index < modelCalls.length; index += MAX_CALLS_PER_CANDIDATE) {
    runs.push(modelCalls.slice(index, index + MAX_CALLS_PER_CANDIDATE));
  }
  return runs;
}

export interface ExecutionRun {
  readonly run: number;
  readonly status: "SUPERSEDED" | "AUTHORITATIVE_PRESERVED_ARTIFACT_RUN";
  readonly provider: string;
  readonly model: string;
  readonly calls: number;
  readonly window_local_completion: string;
  readonly completions: readonly string[];
  readonly durations: readonly string[];
  readonly log_anchors: readonly { readonly line: number; readonly byte_offset: number }[];
  readonly artifact_status: "OVERWRITTEN_NOT_PRESERVED" | "PRESERVED";
  readonly raw_outputs_reconstructed: false;
}

export interface AccountingCorrection {
  readonly schema_version: typeof CORRECTION_ARTIFACT_SCHEMA_VERSION;
  readonly correction_id: typeof CORRECTION_ID;
  readonly markers: typeof CORRECTION_MARKERS;
  readonly correction_reason: string;
  readonly original_qualification_artifact: {
    readonly path: string;
    readonly recorded_artifact_hash: string;
    readonly core_hash_verified: boolean;
    readonly file_hash: string;
    readonly recorded_candidate_calls: number;
    readonly edited_by_this_correction: false;
  };
  readonly server_log_forensics: LogForensics;
  readonly execution_ledger: {
    readonly run_1: ExecutionRun;
    readonly run_2: ExecutionRun;
    readonly total_actual_model_calls: number;
    readonly total_local_ollama_calls: number;
    readonly external_provider_calls: number;
    readonly deepseek_calls: number;
    readonly openai_calls: number;
    readonly anthropic_calls: number;
    readonly gemini_calls: number;
  };
  readonly first_run_artifact_status: "OVERWRITTEN_NOT_PRESERVED";
  readonly first_run_raw_outputs_reconstructed: false;
  readonly rubric_history: {
    readonly pre_first_call: string;
    readonly post_fix: string;
    readonly final: string;
    readonly rubric_changed_after_outcome: false;
  };
  readonly fix_scope_history: {
    readonly pre_first_call_commit: string;
    readonly post_fix_commit: string;
    readonly fix_scope: string;
    readonly post_outcome_fix_load_bearing_for_ollama_gate_s: false;
  };
  readonly full_v8_scope_seal: {
    readonly FULL_V8_FORMAT_ACCEPTED: true;
    readonly FULL_V8_GENERATION_COMPLETED: false;
    readonly FULL_V8_SCHEMA_SHAPE_VALID: "NOT_ESTABLISHED";
    readonly FULL_V8_PRODUCTION_CANONICALIZER_VALID: "NOT_TESTED";
    readonly MAX_LENGTH_SEMANTICS: "UNVERIFIED";
    readonly s6_criterion_redefined: false;
    readonly interpretation_note: string;
  };
  readonly ollama_structural_gate_wording: {
    readonly wording: "OLLAMA_LOCAL_QWEN3_5_9B_STRUCTURAL_GATE_PASS_UNDER_FROZEN_RUBRIC";
    readonly scope: readonly string[];
    readonly cognition_pass_claimed: false;
  };
  readonly existing_cognition_evidence: {
    readonly familiarity_result: "FAMILIARITY_EFFECT_INCONCLUSIVE";
    readonly host_complete: false;
    readonly status: "WEAK_INCONCLUSIVE_FOR_QUALIFICATION_PURPOSES";
    readonly is_a_gate_c_verdict: false;
    readonly note: string;
  };
  readonly candidate_call_ledger: readonly {
    readonly id: string;
    readonly state: string;
    readonly calls_in_gate_s: number;
    readonly call_source: string;
  }[];
  readonly call_budget_disclosure: {
    readonly frozen_external_ceiling: number;
    readonly external_provider_calls_made: number;
    readonly local_model_calls_made: number;
    readonly local_runs: number;
    readonly published_artifact_reported_calls: number;
    readonly true_total_model_calls: number;
    readonly note: string;
  };
  readonly gate_c: { readonly executed: false; readonly calls: 0 };
  readonly formal_executor_changed: false;
  readonly model_calls_made_by_this_correction: 0;
  readonly limitations: readonly string[];
  readonly artifact_hash?: string;
}

export interface CorrectionInput {
  readonly originalArtifactText: string;
  readonly logText: string;
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}

export function hashJson(value: unknown): string {
  return `sha256:${createHash("sha256").update(canonicalJson(value), "utf8").digest("hex")}`;
}

/** Derives the correction artifact. Pure: identical inputs give identical bytes. */
export function deriveAccountingCorrection(input: CorrectionInput): AccountingCorrection {
  const original = JSON.parse(input.originalArtifactText) as {
    readonly artifact_hash?: string;
    readonly total_candidate_calls?: number;
    readonly candidates?: readonly { readonly candidate: { readonly id: string }; readonly calls: number }[];
  };
  const { artifact_hash: recordedHash, ...originalCore } = original as Record<string, unknown> & { artifact_hash?: string };
  const coreHashVerified = hashJson(originalCore) === recordedHash;
  const recordedCandidateCalls = (original.candidates ?? []).reduce((total, entry) => total + entry.calls, 0);

  const calls = extractLoggedCalls({ logText: input.logText });
  const runs = groupRuns(calls);
  if (runs.length !== 2) {
    throw new Error(`ACCOUNTING_CORRECTION_EXPECTED_TWO_RUNS_IN_LOG: found ${runs.length}`);
  }
  const [firstRun, secondRun] = runs as [readonly LoggedCall[], readonly LoggedCall[]];
  const runWindow = (run: readonly LoggedCall[]): string =>
    `${run[0]?.completed_at ?? "?"}–${run[run.length - 1]?.completed_at ?? "?"} (local, completion timestamps)`;
  const runAnchors = (run: readonly LoggedCall[]): readonly { line: number; byte_offset: number }[] =>
    run.map((call) => ({ line: call.line, byte_offset: call.byte_offset }));

  const run1: ExecutionRun = {
    run: 1,
    status: "SUPERSEDED",
    provider: "ollama-local",
    model: "qwen3.5:9b",
    calls: firstRun.length,
    window_local_completion: runWindow(firstRun),
    completions: firstRun.map((call) => call.completed_at),
    durations: firstRun.map((call) => call.duration),
    log_anchors: runAnchors(firstRun),
    artifact_status: "OVERWRITTEN_NOT_PRESERVED",
    raw_outputs_reconstructed: false
  };
  const run2: ExecutionRun = {
    run: 2,
    status: "AUTHORITATIVE_PRESERVED_ARTIFACT_RUN",
    provider: "ollama-local",
    model: "qwen3.5:9b",
    calls: secondRun.length,
    window_local_completion: runWindow(secondRun),
    completions: secondRun.map((call) => call.completed_at),
    durations: secondRun.map((call) => call.duration),
    log_anchors: runAnchors(secondRun),
    artifact_status: "PRESERVED",
    raw_outputs_reconstructed: false
  };
  const nonModel = calls.filter((call) => !isModelCall(call));
  const totalCalls = run1.calls + run2.calls;

  return {
    schema_version: CORRECTION_ARTIFACT_SCHEMA_VERSION,
    correction_id: CORRECTION_ID,
    markers: CORRECTION_MARKERS,
    correction_reason:
      "the Gate S qualification ran twice against the local grammar control; the first run's artifact was overwritten by the second, so the published artifact records only the second run's calls while the true execution count is the sum of both runs",
    original_qualification_artifact: {
      path: ORIGINAL_ARTIFACT_PATH,
      recorded_artifact_hash: String(recordedHash),
      core_hash_verified: coreHashVerified,
      file_hash: `sha256:${createHash("sha256").update(input.originalArtifactText, "utf8").digest("hex")}`,
      recorded_candidate_calls: recordedCandidateCalls,
      edited_by_this_correction: false
    },
    server_log_forensics: {
      path: SERVER_LOG_PATH,
      file_hash: `sha256:${createHash("sha256").update(input.logText, "utf8").digest("hex")}`,
      bytes: Buffer.byteLength(input.logText, "utf8"),
      lines: input.logText.split(/\r?\n/).length,
      run_day: RUN_DAY,
      lines_on_run_day: calls.length,
      model_calls_on_run_day: calls.filter(isModelCall).length,
      non_model_requests_on_run_day: nonModel,
      task_ids_available: false,
      task_id_note:
        "the local inference server's access log carries NO task or request id field in this format; calls are anchored by date, completion timestamp, duration, line number and byte offset instead, which is re-derivable after the log grows",
      anchor_note:
        "the log file is live and keeps growing, so its hash is a point-in-time anchor; the recorded line numbers and byte offsets locate each call independently of the file hash"
    },
    execution_ledger: {
      run_1: run1,
      run_2: run2,
      total_actual_model_calls: totalCalls,
      total_local_ollama_calls: totalCalls,
      external_provider_calls: 0,
      deepseek_calls: 0,
      openai_calls: 0,
      anthropic_calls: 0,
      gemini_calls: 0
    },
    first_run_artifact_status: "OVERWRITTEN_NOT_PRESERVED",
    first_run_raw_outputs_reconstructed: false,
    rubric_history: {
      pre_first_call: RUBRIC_HASH,
      post_fix: RUBRIC_HASH,
      final: RUBRIC_HASH,
      rubric_changed_after_outcome: false
    },
    fix_scope_history: {
      pre_first_call_commit: PRE_FIRST_CALL_COMMIT,
      post_fix_commit: POST_FIX_COMMIT,
      fix_scope:
        "the post-outcome commit changed only the DeepSeek negative-control dispatch ordering so the control reports STRICT_FEATURE_UNAVAILABLE instead of NOT_TESTED_NO_CREDENTIAL; it touched no rubric criterion, prompt, schema, budget or Gate S predicate",
      post_outcome_fix_load_bearing_for_ollama_gate_s: false
    },
    full_v8_scope_seal: {
      FULL_V8_FORMAT_ACCEPTED: true,
      FULL_V8_GENERATION_COMPLETED: false,
      FULL_V8_SCHEMA_SHAPE_VALID: "NOT_ESTABLISHED",
      FULL_V8_PRODUCTION_CANONICALIZER_VALID: "NOT_TESTED",
      MAX_LENGTH_SEMANTICS: "UNVERIFIED",
      s6_criterion_redefined: false,
      interpretation_note:
        "S6 asks only whether the FULL canonical V8 schema is ACCEPTED as the constraint, and that is what it evidenced. It does NOT prove end-to-end V8 compliance: the captured outputs were not re-scored against the full contract by the production canonicalizer, generation completion under the full grammar was not established, and no length semantics were tested"
    },
    ollama_structural_gate_wording: {
      wording: "OLLAMA_LOCAL_QWEN3_5_9B_STRUCTURAL_GATE_PASS_UNDER_FROZEN_RUBRIC",
      scope: [
        "minimal adversarial enforcement proven (nested object, enum, required key, closed keys)",
        "full V8 FORMAT acceptance proven (the constraint was accepted)",
        "full V8 completed-generation validity NOT proven",
        "maxLength semantics UNVERIFIED",
        "STRUCTURE only: this is not a cognition pass and not an executor selection"
      ],
      cognition_pass_claimed: false
    },
    existing_cognition_evidence: {
      familiarity_result: "FAMILIARITY_EFFECT_INCONCLUSIVE",
      host_complete: false,
      status: "WEAK_INCONCLUSIVE_FOR_QUALIFICATION_PURPOSES",
      is_a_gate_c_verdict: false,
      note:
        "recorded as human-adjudication CONTEXT only. It was not produced by the Gate C rubric and is not re-labelled as a Gate C failure; no new scientific conclusion is drawn here"
    },
    candidate_call_ledger: [
      {
        id: "deepseek-api",
        state: "STRICT_FEATURE_UNAVAILABLE",
        calls_in_gate_s: 0,
        call_source: "frozen approved capability evidence; the endpoint was never re-probed"
      },
      {
        id: "ollama-local",
        state: "STRUCTURAL_GATE_PASS",
        calls_in_gate_s: totalCalls,
        call_source: "two local runs of 5 calls recorded in the preserved artifact and the server access log"
      },
      { id: "openai-strict", state: "NOT_TESTED_NO_CREDENTIAL", calls_in_gate_s: 0, call_source: "no credential in the process environment" },
      { id: "anthropic-strict", state: "NOT_TESTED_NO_CREDENTIAL", calls_in_gate_s: 0, call_source: "no credential in the process environment" },
      { id: "gemini-strict", state: "NOT_TESTED_NO_CREDENTIAL", calls_in_gate_s: 0, call_source: "no credential in the process environment" }
    ],
    call_budget_disclosure: {
      frozen_external_ceiling: 15,
      external_provider_calls_made: 0,
      local_model_calls_made: totalCalls,
      local_runs: runs.length,
      published_artifact_reported_calls: recordedCandidateCalls,
      true_total_model_calls: totalCalls,
      note:
        "two local runs occurred. The published artifact reports the second run only, so TOTAL_MODEL_CALLS = 5 is superseded by TOTAL_ACTUAL_MODEL_CALLS = 10. No external provider call was ever made."
    },
    gate_c: { executed: false, calls: 0 },
    formal_executor_changed: false,
    model_calls_made_by_this_correction: 0,
    limitations: [
      "ACCOUNTING CORRECTION ONLY: this artifact corrects an execution count. It re-runs no gate, re-scores no observation and draws no scientific conclusion.",
      "The first run's raw model outputs were NOT preserved and are NOT reconstructed here; only server-log-derived execution metadata exists for that run.",
      "The structural observations remain exactly those recorded in the preserved artifact: no raw output, predicate or scoring rule is altered or restated.",
      "The correction is derived from evidence that already existed (the preserved artifact and the server access log) and is deterministic: the same inputs reproduce the same bytes.",
      "The qualification verdict itself is NOT re-issued here; only an independent audit can lift the BLOCKED status."
    ]
  };
}

export function hashAccountingCorrection(correction: AccountingCorrection): string {
  const { artifact_hash: _ignored, ...core } = correction;
  void _ignored;
  return hashJson(core);
}
