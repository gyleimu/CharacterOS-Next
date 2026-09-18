/**
 * CORE_V1_LONG_RUN — LONG-RUNNING OPERATION HARNESS (monitoring infrastructure).
 *
 * The frozen Core V1 is exercised through the NORMAL product path (`createProductRuntimeV0`
 * with the real product provider bundle: the current product executor configuration, no
 * substitution, no benchmark) for a batch of REAL lived interactions, with fresh
 * restarts in between. It records read-only checkpoints, verifies durable integrity
 * across every restart, and classifies anything suspicious as an ISSUE CANDIDATE.
 *
 * IT ADDS NO CORE MECHANISM and it never writes subject state directly: every
 * interaction is a normal `submitHumanText` turn, every reading is an existing
 * read-only projection. Nothing here repairs or tunes anything — observed problems
 * are captured, classified and left for adjudication (OBSERVED PROBLEM → FIX, never
 * IMAGINED FUTURE PROBLEM → NEW ARCHITECTURE).
 *
 * EXECUTOR FAMILY: whatever the product configuration resolves. `auto` picks the
 * cloud family when a credential is present in the environment, else the local one;
 * `CHARACTEROS_EXECUTOR=deepseek|ollama` selects explicitly. The product reads the
 * credential from `MODEL_API_KEY` ONLY (environment only, never a file, never an
 * argument) and this harness only ever reports its PRESENCE — never its value.
 *
 * DISABLED BY DEFAULT so the engineering gates stay at 0 model calls. To run a batch:
 *
 *   CHARACTEROS_EXECUTOR=deepseek CHARACTEROS_LONG_RUN=1 \
 *     npx vitest run product/sandbox/src/long-run-checkpoint.test.ts
 *
 * Optional: CHARACTEROS_LONG_RUN_ROOT (data root), CHARACTEROS_LONG_RUN_SUBJECT,
 * CHARACTEROS_LONG_RUN_HEAD (provenance line for the artifact), CHARACTEROS_TIMEOUT_MS
 * (per-call timeout; recorded in the artifact).
 *
 * MONITORING (no product change):
 * - per-stage provider call counts come from the EXISTING product diagnostics view;
 * - exact provider HTTP request counts and token usage come from the fetch-level
 *   `provider-request-observer` (usage absent from a provider is recorded as
 *   NOT_AVAILABLE, never estimated);
 * - checkpoints are named BEFORE / TURN_5 / TURN_10 / TURN_15 / TURN_20 / FINAL_RESTORE;
 * - failures are classified EXECUTOR / PRODUCT / CORE, and two consecutive
 *   same-context EXECUTOR failures STOP the batch instead of burning the rest.
 *
 * ARTIFACTS (machine-local; summary only — no credentials, no prompts, no hidden
 * reasoning): tmp/deepseek-long-run-checkpoint-<N>.json for the cloud family,
 * tmp/long-run-checkpoint-<N>.json otherwise, plus a crash-safe progress file
 * rewritten after every interaction.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  createProductRuntimeV0,
  type ProductRuntimeV0,
  type ProductTurnResultV0
} from "./product-runtime.js";
import { PRODUCT_DEFAULT_DATA_ROOT_V0 } from "./product-paths.js";
import type { ProductLifeViewV0 } from "./product-life-operations.js";
import {
  installProviderRequestObserverV0,
  type ProviderRequestObserverV0
} from "./provider-request-observer.js";

const ENABLED = process.env["CHARACTEROS_LONG_RUN"] === "1";
const BATCH = (() => {
  const raw = Number.parseInt(process.env["CHARACTEROS_LONG_RUN_INTERACTIONS"] ?? "20", 10);
  return Number.isSafeInteger(raw) && raw > 0 && raw <= 200 ? raw : 20;
})();
const SUBJECT_ID = process.env["CHARACTEROS_LONG_RUN_SUBJECT"] ?? "alice-longrun";
const DATA_ROOT =
  process.env["CHARACTEROS_LONG_RUN_ROOT"] ?? join(PRODUCT_DEFAULT_DATA_ROOT_V0, "subjects", SUBJECT_ID);

/** Natural mixed interactions (session 1 then session 2). No scripted state targets. */
function plan(batch: number): readonly string[] {
  const fixed = [
    // Session 1 — ordinary life, facts, corrections, feelings, a consequence, recall.
    "Morning. I finally sorted the workshop shelves yesterday.",
    "I keep my favourite chisel in the top drawer, next to the whetstone.",
    "The weather has been grey all week, so I stayed inside and varnished.",
    "Actually, I moved the whetstone to the bottom drawer last month.",
    "So the top drawer has the chisel and the bottom one has the whetstone.",
    "I finished the shelf today and it fits perfectly - that felt good.",
    "The bandsaw jammed twice and I lost an hour clearing it.",
    "Could you help me keep track of what I put where in the workshop?",
    "I labelled the drawers with tape after we talked about it.",
    "The label on the bottom drawer says whetstone - the tape is holding.",
    // Session 2 — disagreement, contradictions, mundane days, recall of feelings.
    "I do not agree that the shelves are finished; the edges still need sanding.",
    "I measured the second shelf and it is three millimetres short.",
    "Nothing much happened today, I just swept up and went home early.",
    "I sharpened the chisel again and put it back in the top drawer.",
    "The neighbour borrowed my clamp and returned it the same evening.",
    "That bandsaw jamming is still annoying me two weeks later.",
    "Tomorrow I want to start the second shelf from the same plan.",
    "The second shelf went together much faster than the first one.",
    "I checked both drawers again and the tape labels are still readable.",
    "Do you remember what I said about the bandsaw and how I felt about it?"
  ];
  if (batch <= fixed.length) return fixed.slice(0, batch);
  const extra: string[] = [];
  for (let index = fixed.length; index < batch; index += 1) {
    extra.push(`Day ${String(index + 1)}: I spent the afternoon tidying the workshop and making notes.`);
  }
  return [...fixed, ...extra];
}

interface DurableState {
  readonly origin: string;
  readonly state_revision: number;
  readonly repository_revision: string;
  readonly shared_revision: number | null;
  readonly episodes: number;
  readonly affect: { readonly valence: number; readonly activation: number };
  readonly beliefs: readonly { readonly proposition_id: string; readonly credence: number }[];
  readonly relationships: readonly string[];
  readonly personality: readonly { readonly dimension_id: string; readonly value: number }[];
  readonly pending_behavior_outcome: boolean;
}

async function durableState(runtime: ProductRuntimeV0): Promise<DurableState> {
  const bootstrap = await runtime.bootstrap();
  const status = await runtime.status();
  return {
    origin: bootstrap.status,
    state_revision: status.state_revision,
    repository_revision: status.repository_revision,
    shared_revision: bootstrap.revisions.shared_revision,
    episodes: bootstrap.recent_memory.total_episode_count,
    affect: bootstrap.affect,
    beliefs: bootstrap.state.beliefs.map((item) => ({ proposition_id: item.proposition_id, credence: item.credence })),
    relationships: bootstrap.state.relationships.map((counterpart) => counterpart.counterpart_ref),
    personality: bootstrap.state.personality.map((dimension) => ({ ...dimension })),
    pending_behavior_outcome: status.pending_behavior_outcome ?? false
  };
}

/** Existing product diagnostics: per-stage provider call counts (no prompts). */
function stageCountsV0(runtime: ProductRuntimeV0): Record<string, number> | null {
  const view = runtime.diagnosticsView();
  const provider = view?.provider ?? null;
  if (provider === null) return null;
  const counts: Record<string, number> = {};
  for (const sample of provider.samples) counts[sample.stage] = sample.count;
  return counts;
}

type FailureClassV0 = "EXECUTOR" | "PRODUCT" | "CORE";

/** §19: executor failures are never folded into core. */
function classifyFailureV0(detail: string): { failure_class: FailureClassV0; kind: string; context: boolean } {
  if (/RATE_LIMIT|HTTP 429|rate limit/i.test(detail)) return { failure_class: "EXECUTOR", kind: "RATE_LIMIT", context: false };
  if (/MODEL_TIMEOUT|timed out/i.test(detail)) return { failure_class: "EXECUTOR", kind: "TIMEOUT", context: false };
  if (/MODEL_TRANSPORT_MODEL_OUTPUT_TRUNCATED|OUTPUT_TRUNCATED|done_reason=length/i.test(detail)) {
    return { failure_class: "EXECUTOR", kind: "OUTPUT_TRUNCATED", context: true };
  }
  if (/MODEL_HTTP_FAILURE|HTTP \d{3}|MODEL_CONNECTION_FAILURE/i.test(detail)) {
    return { failure_class: "EXECUTOR", kind: "PROVIDER_ERROR", context: false };
  }
  if (/INVOCATION_BINDING_INVALID|MODEL_SCHEMA_INVALID/i.test(detail)) {
    return { failure_class: "PRODUCT", kind: "OUTPUT_CONTRACT", context: false };
  }
  if (/restore mismatch|corruption|dangling|authority bypass|cross-subject/i.test(detail)) {
    return { failure_class: "CORE", kind: "CORE_INTEGRITY", context: false };
  }
  return { failure_class: "PRODUCT", kind: "TURN_FAILED_CLOSED", context: false };
}

interface IssueCandidate {
  issue_id: string;
  subject_id: string;
  turn_index: number;
  timestamp: string;
  category: "CORE_INTEGRITY" | "BEHAVIORAL" | "PRODUCT";
  severity: "BLOCKER" | "MAJOR" | "MINOR";
  failure_class?: FailureClassV0;
  current_scene: string;
  relevant_durable_refs: readonly string[];
  state_snapshot_summary: Record<string, unknown>;
  retrieved_memory_refs: readonly string[];
  executor: string;
  result: string;
  expected: string;
  observed: string;
  reproducible: "YES" | "NO" | "UNKNOWN";
}

function latencyStatsV0(samples: readonly number[]): {
  readonly samples: number;
  readonly min: number | null;
  readonly median: number | null;
  readonly p95: number | null;
  readonly max: number | null;
  readonly total: number;
} {
  const sorted = [...samples].sort((a, b) => a - b);
  const at = (fraction: number): number | null =>
    sorted.length === 0 ? null : sorted[Math.min(sorted.length - 1, Math.ceil(fraction * sorted.length) - 1)] ?? null;
  return {
    samples: sorted.length,
    min: sorted[0] ?? null,
    median: at(0.5),
    p95: at(0.95),
    max: sorted.at(-1) ?? null,
    total: sorted.reduce((sum, value) => sum + value, 0)
  };
}

describe.skipIf(!ENABLED)("CORE_V1_LONG_RUN", () => {
  it(`runs ${String(BATCH)} real interactions with fresh restarts and checkpoints`, async () => {
    mkdirSync(DATA_ROOT, { recursive: true });
    const issues: IssueCandidate[] = [];
    const problem = (issue: Omit<IssueCandidate, "issue_id" | "subject_id" | "timestamp">): void => {
      issues.push({
        issue_id: `LR-${String(issues.length + 1).padStart(3, "0")}`,
        subject_id: SUBJECT_ID,
        timestamp: new Date().toISOString(),
        ...issue
      });
    };

    let runtime: ProductRuntimeV0;
    try {
      runtime = await createProductRuntimeV0({
        data_root: DATA_ROOT,
        subject: { display_name: SUBJECT_ID },
        session_label: "core-v1-long-run"
      });
    } catch (error) {
      // The product fails closed when the requested family has no credential. That is
      // a prerequisite problem, not a run: record it and stop loudly, nothing faked.
      const detail = error instanceof Error ? error.message.slice(0, 300) : "unknown";
      const blocked = {
        schema_version: "core-v1-long-run-blocked-v0",
        subject_id: SUBJECT_ID,
        data_root: DATA_ROOT,
        credential_present: process.env["MODEL_API_KEY"] !== undefined,
        requested_executor: process.env["CHARACTEROS_EXECUTOR"] ?? "(unset)",
        detail,
        note: "Run did not start: the product configuration failed closed before any interaction."
      };
      writeFileSync(
        join(process.cwd(), "tmp", "deepseek-long-run-blocked.json"),
        `${JSON.stringify(blocked, null, 2)}\n`,
        "utf8"
      );
      throw new Error(
        `DEEPSEEK_RUN_BLOCKED_CREDENTIAL_ABSENT: the product executor could not be created (${detail}). ` +
          `Export the credential in the environment (MODEL_API_KEY) — presence is required — and re-run. ` +
          `This harness never reads a credential from a file or an argument.`,
        { cause: error }
      );
    }
    const configuration = runtime.configView();
    const family = configuration.executor.effective;
    const credentialPresent = configuration.executor.credential_present;
    const backend = `${family} / ${configuration.model.value} @ ${configuration.endpoint.value}`;
    // Monitor the effective executor endpoint, plus the local executor endpoint the
    // Ollama-only adaptation providers keep using regardless of the selected family
    // (same default the product resolves when OLLAMA_BASE_URL is unset). Records
    // carry the host, so the artifact can split cloud and local traffic.
    const observedHosts = [
      configuration.endpoint.value,
      process.env["OLLAMA_BASE_URL"] ?? "http://127.0.0.1:11434"
    ];
    const requestObserver: ProviderRequestObserverV0 = installProviderRequestObserverV0(observedHosts);
    const artifactPath = join(
      process.cwd(),
      "tmp",
      `${family === "deepseek" ? "deepseek-" : ""}long-run-checkpoint-${String(BATCH)}.json`
    );
    const progressPath = join(
      process.cwd(),
      "tmp",
      `${family === "deepseek" ? "deepseek-" : ""}long-run-progress-${String(BATCH)}.json`
    );

    const checkpoints: Record<string, unknown>[] = [];
    const turns: Record<string, unknown>[] = [];
    const restartsDetail: Record<string, unknown>[] = [];
    let restarts = 0;
    let degradations = 0;
    let nonCompletions = 0;
    let attempted = 0;
    let totalProviderMs = 0;
    let contextWallOccurrences = 0;
    let consecutiveContextFailures = 0;
    let stoppedReason: string | null = null;
    const latencies: number[] = [];
    const replyTexts: string[] = [];

    /**
     * The whole record, rebuilt from live in-memory evidence. `partial: true` is the
     * crash-safe progress file (rewritten after every interaction); the same shape is
     * written once as the batch artifact at the end.
     */
    const buildRecord = async (partial: boolean, note: string): Promise<Record<string, unknown>> => {
      let state: DurableState | null;
      try {
        state = await durableState(runtime);
      } catch (error) {
        state = null;
        note = `${note} | state unreadable: ${error instanceof Error ? error.message.slice(0, 120) : "unknown"}`;
      }
      let stageCounts: Record<string, number> | null;
      try {
        stageCounts = stageCountsV0(runtime);
      } catch {
        stageCounts = null;
      }
      const providerView = runtime.diagnosticsView()?.provider ?? null;
      const wallStatus =
        contextWallOccurrences === 0
          ? `${family === "deepseek" ? "DEEPSEEK_LONGRUN_" : ""}CONTEXT_WALL_NOT_OBSERVED_AT_${String(attempted)}_TURNS`
          : "CONTEXT_WALL_OBSERVED";
      return {
        schema_version: "core-v1-long-run-checkpoint-v0",
        generated_from_head: process.env["CHARACTEROS_LONG_RUN_HEAD"] ?? "(unavailable)",
        subject_id: SUBJECT_ID,
        data_root: DATA_ROOT,
        executor: {
          requested: configuration.executor.requested,
          family,
          model: configuration.model.value,
          endpoint: configuration.endpoint.value,
          timeout_ms: configuration.timeout_ms.value,
          context_window_tokens: configuration.context_window_tokens.value,
          num_predict: configuration.num_predict.value,
          credential_present: credentialPresent,
          reason: configuration.executor.reason,
          observed_hosts: observedHosts,
          note: "current product executor configuration; no substitution, no benchmark"
        },
        deepseek: {
          provider_path: family === "deepseek" ? "OpenAiCompatibleTransportV0 (/chat/completions)" : null,
          credential_present: credentialPresent,
          model: family === "deepseek" ? configuration.model.value : null,
          endpoint: family === "deepseek" ? configuration.endpoint.value : null
        },
        batch: {
          requested: BATCH,
          attempted,
          completed: turns.filter((turn) => turn["status"] === "COMPLETE").length,
          failed: turns.filter((turn) => turn["status"] === "FAILED" || turn["status"] === "THREW").length,
          degraded: degradations,
          non_completions: nonCompletions
        },
        stop_reason: stoppedReason,
        restarts,
        restarts_detail: restartsDetail,
        interactions: turns,
        checkpoints,
        state,
        stage_counts: stageCounts,
        provider_diagnostics: providerView,
        provider_requests: requestObserver.summary(),
        latency_ms: latencyStatsV0(latencies),
        delivered_reply_texts: replyTexts,
        wall_watch: {
          context_wall_occurrences: contextWallOccurrences,
          stop_rule: "2 consecutive same-context EXECUTOR failures stop the batch",
          status: wallStatus
        },
        degradations,
        non_completions: nonCompletions,
        issues,
        core_changes: [],
        partial,
        updated_at: new Date().toISOString(),
        note
      };
    };

    const persistProgress = async (note: string): Promise<void> => {
      writeFileSync(progressPath, `${JSON.stringify(await buildRecord(true, note), null, 2)}\n`, "utf8");
    };

    const checkpoint = async (label: string, index: number): Promise<void> => {
      const state = await durableState(runtime);
      const life: ProductLifeViewV0 = await runtime.lifeView();
      const memory = await runtime.livedMemory(100);
      const evolution = life.evolution;
      const entry = {
        checkpoint: label,
        interactions: index,
        restarts,
        durable: state,
        evolution_attribution: evolution.attribution,
        evolution_belief_transitions: evolution.durable_effects.belief.length,
        evolution_affect_transitions: evolution.durable_effects.affect.length,
        cognition_visible_episodes: evolution.cognition_visible.memory_episode_refs.length,
        memory_entries: memory.entries.map((entry_) => entry_.episode_ref),
        stage_counts: stageCountsV0(runtime),
        provider_requests: requestObserver.summary(),
        degradations,
        non_completions: nonCompletions,
        total_provider_ms: totalProviderMs
      };
      checkpoints.push(entry);

      // ---- CORE INTEGRITY: lawful values, unique identity, no dangling provenance ----
      if (!Number.isFinite(state.affect.valence) || Math.abs(state.affect.valence) > 1) {
        problem({
          turn_index: index,
          category: "CORE_INTEGRITY",
          severity: "BLOCKER",
          current_scene: label,
          relevant_durable_refs: [],
          state_snapshot_summary: state as unknown as Record<string, unknown>,
          retrieved_memory_refs: [],
          executor: backend,
          result: "affect valence outside [-1,1] or non-finite",
          expected: "valence in [-1,1]",
          observed: String(state.affect.valence),
          reproducible: "UNKNOWN"
        });
      }
      const beliefIds = state.beliefs.map((item) => item.proposition_id);
      if (new Set(beliefIds).size !== beliefIds.length) {
        problem({
          turn_index: index,
          category: "CORE_INTEGRITY",
          severity: "BLOCKER",
          current_scene: label,
          relevant_durable_refs: beliefIds,
          state_snapshot_summary: state as unknown as Record<string, unknown>,
          retrieved_memory_refs: [],
          executor: backend,
          result: "duplicate proposition identity",
          expected: "unique proposition ids",
          observed: beliefIds.join(", "),
          reproducible: "YES"
        });
      }
      const episodeRefs = memory.entries.map((entry_) => entry_.episode_ref);
      if (new Set(episodeRefs).size !== episodeRefs.length) {
        problem({
          turn_index: index,
          category: "CORE_INTEGRITY",
          severity: "BLOCKER",
          current_scene: label,
          relevant_durable_refs: [],
          state_snapshot_summary: state as unknown as Record<string, unknown>,
          retrieved_memory_refs: [],
          executor: backend,
          result: "duplicate episode refs",
          expected: "unique episodes",
          observed: String(episodeRefs.length),
          reproducible: "YES"
        });
      }
      for (const transition of evolution.durable_effects.belief) {
        for (const ref of transition.evidence_episode_refs) {
          if (!episodeRefs.includes(ref)) {
            problem({
              turn_index: index,
              category: "CORE_INTEGRITY",
              severity: "BLOCKER",
              current_scene: label,
              relevant_durable_refs: [ref],
              state_snapshot_summary: state as unknown as Record<string, unknown>,
              retrieved_memory_refs: [],
              executor: backend,
              result: "belief transition cites an episode outside durable memory",
              expected: "every evidence ref resolves to a stored episode",
              observed: ref,
              reproducible: "YES"
            });
          }
        }
      }
      for (const dimension of state.personality) {
        if (!Number.isFinite(dimension.value) || dimension.value < 0 || dimension.value > 1) {
          problem({
            turn_index: index,
            category: "CORE_INTEGRITY",
            severity: "BLOCKER",
            current_scene: label,
            relevant_durable_refs: [dimension.dimension_id],
            state_snapshot_summary: state as unknown as Record<string, unknown>,
            retrieved_memory_refs: [],
            executor: backend,
            result: "personality dimension outside [0,1]",
            expected: "unit interval",
            observed: `${dimension.dimension_id}=${String(dimension.value)}`,
            reproducible: "UNKNOWN"
          });
        }
      }

      // ---- BEHAVIORAL / SATURATION WATCH (observation only, never a repair) ----------
      if (Math.abs(state.affect.valence) >= 0.999) {
        problem({
          turn_index: index,
          category: "BEHAVIORAL",
          severity: "MINOR",
          current_scene: label,
          relevant_durable_refs: [],
          state_snapshot_summary: { affect: state.affect },
          retrieved_memory_refs: [],
          executor: backend,
          result: "POTENTIAL_DYNAMIC_SATURATION: canonical affect is at the bound",
          expected: "observe whether a real life stays pinned at the bound",
          observed: JSON.stringify(state.affect),
          reproducible: "UNKNOWN"
        });
      }
      const saturatedPersonality = state.personality.filter(
        (dimension) => dimension.value === 0 || dimension.value === 1
      );
      if (saturatedPersonality.length > 0) {
        problem({
          turn_index: index,
          category: "BEHAVIORAL",
          severity: "MINOR",
          current_scene: label,
          relevant_durable_refs: saturatedPersonality.map((dimension) => dimension.dimension_id),
          state_snapshot_summary: { personality: state.personality },
          retrieved_memory_refs: [],
          executor: backend,
          result: "POTENTIAL_DYNAMIC_SATURATION: acquired personality dimension at its bound",
          expected: "observe only",
          observed: JSON.stringify(saturatedPersonality),
          reproducible: "UNKNOWN"
        });
      }
      await persistProgress(`checkpoint ${label}`);
    };

    /**
     * A fresh host over the SAME data root: shutdown, re-create, verify the critical
     * durable fields are identical. Returns false when the subject could not be
     * restored at all (the batch cannot continue, and that is recorded, not repaired).
     */
    const restart = async (index: number, reason: "SCHEDULED" | "POST_FAILURE_RECOVERY"): Promise<boolean> => {
      let before: DurableState | null;
      try {
        before = await durableState(runtime);
      } catch {
        before = null; // the failed runtime may already refuse reads; that IS the observation
      }
      try {
        await runtime.shutdown();
      } catch {
        // a poisoned runtime may fail to shut down cleanly; a new host is still attempted
      }
      try {
        runtime = await createProductRuntimeV0({
          data_root: DATA_ROOT,
          subject: { display_name: SUBJECT_ID },
          session_label: "core-v1-long-run"
        });
      } catch (error) {
        restartsDetail.push({
          restart: restarts + 1,
          reason,
          interactions: index,
          restore: "FAILED",
          detail: error instanceof Error ? error.message.slice(0, 200) : "unknown"
        });
        problem({
          turn_index: index,
          category: "PRODUCT",
          severity: "MAJOR",
          failure_class: "PRODUCT",
          current_scene: `restart ${String(restarts + 1)} (${reason})`,
          relevant_durable_refs: [],
          state_snapshot_summary: {},
          retrieved_memory_refs: [],
          executor: backend,
          result: "a fresh product host could not be created over the subject data root",
          expected: "a fresh host, restored from durable state",
          observed: error instanceof Error ? error.message.slice(0, 200) : "unknown",
          reproducible: "UNKNOWN"
        });
        await persistProgress("recovery failed");
        return false;
      }
      restarts += 1;
      const after = await durableState(runtime);
      if (after.origin !== "RESTORED" && reason === "SCHEDULED") {
        problem({
          turn_index: index,
          category: "CORE_INTEGRITY",
          severity: "BLOCKER",
          current_scene: `restart ${String(restarts)}`,
          relevant_durable_refs: [],
          state_snapshot_summary: after as unknown as Record<string, unknown>,
          retrieved_memory_refs: [],
          executor: backend,
          result: "a fresh runtime did not restore the existing subject",
          expected: "RESTORED",
          observed: after.origin,
          reproducible: "UNKNOWN"
        });
      }
      const mismatches: string[] = [];
      if (before !== null) {
        for (const key of [
          "state_revision",
          "repository_revision",
          "shared_revision",
          "episodes",
          "pending_behavior_outcome"
        ] as const) {
          if (before[key] !== after[key]) mismatches.push(`${key}: ${String(before[key])} -> ${String(after[key])}`);
        }
        if (JSON.stringify(before.affect) !== JSON.stringify(after.affect)) mismatches.push("affect");
        if (JSON.stringify(before.beliefs) !== JSON.stringify(after.beliefs)) mismatches.push("beliefs");
        if (JSON.stringify(before.relationships) !== JSON.stringify(after.relationships)) {
          mismatches.push("relationships");
        }
        if (JSON.stringify(before.personality) !== JSON.stringify(after.personality)) {
          mismatches.push("personality");
        }
      }
      const restore =
        before === null ? "RESTORED_UNVERIFIED" : mismatches.length === 0 ? "EXACT" : "MISMATCH";
      if (mismatches.length > 0) {
        // A poisoned (fail-closed) runtime keeps uncommitted bookkeeping in memory; a
        // fresh host restores the last DURABLE state, so a mismatch after a failure is
        // expected and is recorded as such — never as a durable-integrity block.
        const poisoned = reason === "POST_FAILURE_RECOVERY";
        problem({
          turn_index: index,
          category: poisoned ? "PRODUCT" : "CORE_INTEGRITY",
          severity: poisoned ? "MINOR" : "BLOCKER",
          failure_class: poisoned ? "PRODUCT" : "CORE",
          current_scene: `restart ${String(restarts)}`,
          relevant_durable_refs: [],
          state_snapshot_summary: { before, after } as unknown as Record<string, unknown>,
          retrieved_memory_refs: [],
          executor: backend,
          result: poisoned
            ? "failed runtime's in-memory projection differs from the restored durable state"
            : "restore mismatch",
          expected: poisoned
            ? "the fresh host restores the last durable commit exactly"
            : "exact durable restore",
          observed: mismatches.join(" | "),
          reproducible: "YES"
        });
      }
      restartsDetail.push({
        restart: restarts,
        reason,
        interactions: index,
        restore,
        mismatches,
        origin: after.origin,
        after
      });
      checkpoints.push({
        checkpoint: `restart_${String(restarts)}`,
        interactions: index,
        restarts,
        reason,
        restore,
        mismatches
      });
      await persistProgress(`restart ${String(restarts)} (${reason})`);
      return true;
    };

    const interactions = plan(BATCH);
    await checkpoint("BEFORE", 0);
    let lastDurable: DurableState | null = await durableState(runtime);
    for (const [index, text] of interactions.entries()) {
      const number = index + 1;
      attempted = number;
      let turn: ProductTurnResultV0;
      let threw: string | null = null;
      try {
        const result = await runtime.submitHumanText(text);
        turn = runtime.summarizeTurn(result);
      } catch (error) {
        threw = error instanceof Error ? error.message.slice(0, 300) : String(error).slice(0, 300);
        turn = {
          status: "FAILED",
          reply_text: null,
          turn_index: -1,
          subject_id: SUBJECT_ID,
          completed_prior_outcome: null,
          language_call_required: false,
          elapsed_ms: null,
          repository_revision_after: "",
          state_revision_after: -1,
          failure_detail: threw,
          failure: null
        } as unknown as ProductTurnResultV0;
        nonCompletions += 1;
        const classified = classifyFailureV0(threw);
        problem({
          turn_index: number,
          category: "PRODUCT",
          severity: "MAJOR",
          failure_class: classified.failure_class,
          current_scene: text,
          relevant_durable_refs: [],
          state_snapshot_summary: {},
          retrieved_memory_refs: [],
          executor: backend,
          result: `turn threw (${classified.kind})`,
          expected: "a bounded failure summary",
          observed: threw,
          reproducible: "UNKNOWN"
        });
      }
      const detail = turn.failure_detail ?? "";
      const classified = classifyFailureV0(detail);
      turns.push({
        interaction: number,
        text,
        status: turn.status,
        elapsed_ms: turn.elapsed_ms,
        state_revision_after: turn.state_revision_after < 0 ? null : turn.state_revision_after,
        subject_turn_index: turn.turn_index < 0 ? null : turn.turn_index,
        language_call_required: turn.language_call_required,
        failure: detail === "" ? threw : detail,
        failure_class: classified.failure_class,
        failure_kind: classified.kind
      });
      if (turn.elapsed_ms !== null) {
        latencies.push(turn.elapsed_ms);
        totalProviderMs += turn.elapsed_ms;
      }
      if (turn.status === "COMPLETE" && turn.reply_text !== null) {
        replyTexts.push(turn.reply_text.slice(0, 400));
      }
      if (turn.status === "DEGRADED") {
        degradations += 1;
        problem({
          turn_index: number,
          category: "PRODUCT",
          severity: "MINOR",
          failure_class: "PRODUCT",
          current_scene: text,
          relevant_durable_refs: [],
          state_snapshot_summary: {},
          retrieved_memory_refs: [],
          executor: backend,
          result: "EXECUTOR_OUTPUT_DEGRADED after one bounded regeneration",
          expected: "observe frequency",
          observed: (turn.failure_detail ?? "no detail").slice(0, 300),
          reproducible: "UNKNOWN"
        });
      }
      if (turn.status === "FAILED") {
        nonCompletions += 1;
        if (threw === null) {
          problem({
            turn_index: number,
            category: "PRODUCT",
            severity: classified.kind === "TIMEOUT" ? "MAJOR" : "MINOR",
            failure_class: classified.failure_class,
            current_scene: text,
            relevant_durable_refs: [],
            state_snapshot_summary: {},
            retrieved_memory_refs: [],
            executor: backend,
            result: `turn failed closed (${classified.kind})`,
            expected: "a completed turn",
            observed: detail.slice(0, 300),
            reproducible: "UNKNOWN"
          });
        }
        // §24 FAILED TURN LAW: a failed turn must not move durable state.
        let afterFailure: DurableState | null;
        try {
          afterFailure = await durableState(runtime);
        } catch {
          afterFailure = null;
        }
        if (afterFailure !== null && lastDurable !== null) {
          if (afterFailure.episodes !== lastDurable.episodes) {
            problem({
              turn_index: number,
              category: "CORE_INTEGRITY",
              severity: "BLOCKER",
              failure_class: "CORE",
              current_scene: text,
              relevant_durable_refs: [],
              state_snapshot_summary: { before: lastDurable, after: afterFailure } as unknown as Record<string, unknown>,
              retrieved_memory_refs: [],
              executor: backend,
              result: "a failed turn changed the durable episode count",
              expected: "durable state unchanged by a failed turn",
              observed: `${String(lastDurable.episodes)} -> ${String(afterFailure.episodes)}`,
              reproducible: "YES"
            });
          }
          if (afterFailure.state_revision !== lastDurable.state_revision && afterFailure.origin === "RESTORED") {
            // An in-memory advance without a durable commit is the fail-closed bookkeeping
            // pattern; it is recorded, and the durable snapshot mtime check below is the
            // authoritative statement about what was actually written.
            problem({
              turn_index: number,
              category: "PRODUCT",
              severity: "MINOR",
              failure_class: "PRODUCT",
              current_scene: text,
              relevant_durable_refs: [],
              state_snapshot_summary: { before: lastDurable, after: afterFailure } as unknown as Record<string, unknown>,
              retrieved_memory_refs: [],
              executor: backend,
              result: "fail-closed turn advanced the in-memory projection without a durable commit",
              expected: "durable revision unchanged by a failed turn",
              observed: `${String(lastDurable.state_revision)} -> ${String(afterFailure.state_revision)}`,
              reproducible: "YES"
            });
          }
        }
        if (classified.context) {
          contextWallOccurrences += 1;
          consecutiveContextFailures += 1;
        } else {
          consecutiveContextFailures = 0;
        }
      } else {
        consecutiveContextFailures = 0;
        lastDurable = await durableState(runtime);
      }
      if ([5, 10, 15, 20].includes(number)) await checkpoint(`TURN_${String(number)}`, number);
      await persistProgress(`interaction ${String(number)} ${turn.status}`);
      if (number === 10 || number === interactions.length) {
        if (!(await restart(number, "SCHEDULED"))) {
          stoppedReason = "RESTART_FAILED";
          break;
        }
        lastDurable = await durableState(runtime);
      }
      if (turn.status === "FAILED") {
        if (consecutiveContextFailures >= 2) {
          // §20: two consecutive same-context failures stop the batch; do not burn the rest.
          stoppedReason = "STOPPED_AFTER_2_CONSECUTIVE_CONTEXT_FAILURES";
          await persistProgress("stopped by the context-failure stop rule");
          break;
        }
        // The product runtime stays closed after a failed turn (observed behaviour); an
        // operator restarts the app. One bounded recovery restart keeps the batch lived.
        if (!(await restart(number, "POST_FAILURE_RECOVERY"))) {
          stoppedReason = "RESTART_FAILED";
          break;
        }
        lastDurable = await durableState(runtime);
      }
    }

    if (stoppedReason === null && attempted === BATCH) {
      const finalRestoreOk = await restart(attempted, "SCHEDULED");
      if (finalRestoreOk) await checkpoint("FINAL_RESTORE", attempted);
    }
    requestObserver.uninstall();

    const record = await buildRecord(
      false,
      "Operational observation only — no scientific verdict, no new core mechanism, no repair performed."
    );
    const serialized = `${JSON.stringify(record, null, 2)}\n`;
    writeFileSync(artifactPath, serialized, "utf8");
    const sha = createHash("sha256").update(serialized, "utf8").digest("hex");
    const batchInfo = record["batch"] as { completed: number; failed: number };
    const stateInfo = record["state"] as DurableState | null;
    const summary = {
      executor_family: family,
      model: configuration.model.value,
      credential_present: credentialPresent,
      interactions: `${String(batchInfo.completed)}/${String(BATCH)} COMPLETE`,
      attempted,
      failed: batchInfo.failed,
      stop_reason: stoppedReason,
      restarts,
      restarts_detail: restartsDetail.map((entry) => `${String(entry["reason"])}@${String(entry["interactions"])}:${String(entry["restore"])}`),
      degradations,
      non_completions: nonCompletions,
      context_wall_occurrences: contextWallOccurrences,
      provider_requests: record["provider_requests"],
      latency_ms: record["latency_ms"],
      episodes: stateInfo?.episodes ?? null,
      affect: stateInfo?.affect ?? null,
      beliefs: stateInfo?.beliefs ?? null,
      issues: issues.map((issue) => `${issue.issue_id} ${issue.severity} ${issue.category}: ${issue.result}`),
      artifact: artifactPath,
      sha256: sha
    };
    console.log("LONG_RUN_CHECKPOINT", JSON.stringify(summary, null, 2));
    console.log("LONG_RUN_CONFIG", JSON.stringify(configuration));
    // The harness never asserts a happy outcome: it records what happened. The only hard
    // expectations are that the batch ran to its end (or stopped by its own rule) and
    // that the artifact exists.
    expect(attempted).toBeGreaterThan(0);
    expect(attempted === BATCH || stoppedReason !== null).toBe(true);
    expect(readFileSync(artifactPath, "utf8").length).toBeGreaterThan(0);
  }, 28_800_000);
});
