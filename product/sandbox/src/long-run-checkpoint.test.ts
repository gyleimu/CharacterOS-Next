/**
 * CORE_V1_LONG_RUN — LONG-RUNNING OPERATION HARNESS (monitoring infrastructure).
 *
 * The frozen Core V1 is exercised through the NORMAL product path (`createProductRuntimeV0`
 * with the real product provider bundle: the current executor configuration, no
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
 * DISABLED BY DEFAULT so the engineering gates stay at 0 model calls. To run a batch:
 *
 *   CHARACTEROS_LONG_RUN=1 CHARACTEROS_LONG_RUN_INTERACTIONS=20 \
 *     npx vitest run product/sandbox/src/long-run-checkpoint.test.ts
 *
 * Optional: CHARACTEROS_LONG_RUN_ROOT (data root), CHARACTEROS_LONG_RUN_SUBJECT,
 * CHARACTEROS_LONG_RUN_HEAD (provenance line for the artifact), CHARACTEROS_TIMEOUT_MS
 * (per-call timeout; recorded in the artifact).
 *
 * RESTART POLICY (monitoring infrastructure, mirrors an operator restarting the app):
 * a fresh restart every 10 interactions, and — because a failed turn leaves the
 * product runtime closed for further turns — ONE bounded recovery restart after a
 * FAILED/ABORTED interaction so the rest of the batch is still lived. Every restart
 * is recorded with its reason; nothing is repaired.
 *
 * ARTIFACTS (machine-local; summary only — no credentials, no prompts, no hidden
 * reasoning):
 *   tmp/long-run-progress-<N>.json   written after EVERY interaction (crash-safe)
 *   tmp/long-run-checkpoint-<N>.json written once at the end of the batch
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

const ENABLED = process.env["CHARACTEROS_LONG_RUN"] === "1";
const BATCH = (() => {
  const raw = Number.parseInt(process.env["CHARACTEROS_LONG_RUN_INTERACTIONS"] ?? "20", 10);
  return Number.isSafeInteger(raw) && raw > 0 && raw <= 200 ? raw : 20;
})();
const SUBJECT_ID = process.env["CHARACTEROS_LONG_RUN_SUBJECT"] ?? "alice-longrun";
const DATA_ROOT =
  process.env["CHARACTEROS_LONG_RUN_ROOT"] ?? join(PRODUCT_DEFAULT_DATA_ROOT_V0, "subjects", SUBJECT_ID);
const PROGRESS_PATH = join(process.cwd(), "tmp", `long-run-progress-${String(BATCH)}.json`);
const ARTIFACT_PATH = join(process.cwd(), "tmp", `long-run-checkpoint-${String(BATCH)}.json`);

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

interface IssueCandidate {
  issue_id: string;
  subject_id: string;
  turn_index: number;
  category: "CORE_INTEGRITY" | "BEHAVIORAL" | "PRODUCT";
  severity: "BLOCKER" | "MAJOR" | "MINOR";
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

describe.skipIf(!ENABLED)("CORE_V1_LONG_RUN", () => {
  it(`runs ${String(BATCH)} real interactions with fresh restarts and checkpoints`, async () => {
    mkdirSync(DATA_ROOT, { recursive: true });
    const issues: IssueCandidate[] = [];
    const problem = (issue: Omit<IssueCandidate, "issue_id" | "subject_id">): void => {
      issues.push({ issue_id: `LR-${String(issues.length + 1).padStart(3, "0")}`, subject_id: SUBJECT_ID, ...issue });
    };

    let runtime: ProductRuntimeV0 = await createProductRuntimeV0({
      data_root: DATA_ROOT,
      subject: { display_name: SUBJECT_ID },
      session_label: "core-v1-long-run"
    });
    const configuration = runtime.configView();
    const backend = `${configuration.executor.effective} / ${configuration.model.value} @ ${configuration.endpoint.value}`;

    const checkpoints: Record<string, unknown>[] = [];
    const turns: Record<string, unknown>[] = [];
    const restartsDetail: Record<string, unknown>[] = [];
    let restarts = 0;
    let degradations = 0;
    let nonCompletions = 0;
    let attempted = 0;
    let totalProviderMs = 0;
    const latencies: number[] = [];

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
      const sorted = [...latencies].sort((a, b) => a - b);
      return {
        schema_version: "core-v1-long-run-checkpoint-v0",
        generated_from_head: process.env["CHARACTEROS_LONG_RUN_HEAD"] ?? "(unavailable)",
        subject_id: SUBJECT_ID,
        data_root: DATA_ROOT,
        executor: {
          family: configuration.executor.effective,
          model: configuration.model.value,
          endpoint: configuration.endpoint.value,
          timeout_ms: configuration.timeout_ms.value,
          note: "current product executor configuration; no substitution, no benchmark"
        },
        batch: {
          requested: BATCH,
          attempted,
          completed: turns.filter((turn) => turn["status"] === "COMPLETE").length,
          failed: turns.filter((turn) => turn["status"] === "FAILED" || turn["status"] === "THREW").length,
          degraded: degradations,
          non_completions: nonCompletions
        },
        restarts,
        restarts_detail: restartsDetail,
        interactions: turns,
        checkpoints,
        state,
        latency_ms: {
          samples: latencies.length,
          min: sorted[0] ?? null,
          p50: sorted[Math.floor(sorted.length / 2)] ?? null,
          max: sorted.at(-1) ?? null,
          total: totalProviderMs
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
      writeFileSync(PROGRESS_PATH, `${JSON.stringify(await buildRecord(true, note), null, 2)}\n`, "utf8");
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
      if (mismatches.length > 0) {
        problem({
          turn_index: index,
          category: "CORE_INTEGRITY",
          severity: "BLOCKER",
          current_scene: `restart ${String(restarts)}`,
          relevant_durable_refs: [],
          state_snapshot_summary: { before, after } as unknown as Record<string, unknown>,
          retrieved_memory_refs: [],
          executor: backend,
          result: "restore mismatch",
          expected: "exact durable restore",
          observed: mismatches.join(" | "),
          reproducible: "YES"
        });
      }
      restartsDetail.push({
        restart: restarts,
        reason,
        interactions: index,
        restore: before === null ? "RESTORED_UNVERIFIED" : mismatches.length === 0 ? "EXACT" : "MISMATCH",
        mismatches,
        origin: after.origin
      });
      checkpoints.push({
        checkpoint: `restart_${String(restarts)}`,
        interactions: index,
        restarts,
        reason,
        restore: before === null ? "RESTORED_UNVERIFIED" : mismatches.length === 0 ? "EXACT" : "MISMATCH",
        mismatches
      });
      await persistProgress(`restart ${String(restarts)} (${reason})`);
      return true;
    };

    const interactions = plan(BATCH);
    await checkpoint("checkpoint_0", 0);
    for (const [index, text] of interactions.entries()) {
      const number = index + 1;
      attempted = number;
      let turn: ProductTurnResultV0;
      try {
        const result = await runtime.submitHumanText(text);
        turn = runtime.summarizeTurn(result);
      } catch (error) {
        nonCompletions += 1;
        const detail = error instanceof Error ? error.message.slice(0, 300) : String(error).slice(0, 300);
        turns.push({
          interaction: number,
          text,
          status: "THREW",
          elapsed_ms: null,
          state_revision_after: null,
          subject_turn_index: null,
          failure: detail
        });
        problem({
          turn_index: number,
          category: "PRODUCT",
          severity: "MAJOR",
          current_scene: text,
          relevant_durable_refs: [],
          state_snapshot_summary: {},
          retrieved_memory_refs: [],
          executor: backend,
          result: "turn threw instead of returning a result",
          expected: "a bounded failure summary",
          observed: detail,
          reproducible: "UNKNOWN"
        });
        await persistProgress(`interaction ${String(number)} threw`);
        if (!(await restart(number, "POST_FAILURE_RECOVERY"))) break;
        continue;
      }
      turns.push({
        interaction: number,
        text,
        status: turn.status,
        elapsed_ms: turn.elapsed_ms,
        state_revision_after: turn.state_revision_after,
        subject_turn_index: turn.turn_index,
        language_call_required: turn.language_call_required,
        failure: turn.failure_detail
      });
      if (turn.elapsed_ms !== null) {
        latencies.push(turn.elapsed_ms);
        totalProviderMs += turn.elapsed_ms;
      }
      if (turn.status === "DEGRADED") {
        degradations += 1;
        problem({
          turn_index: number,
          category: "PRODUCT",
          severity: "MINOR",
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
        const detail = turn.failure_detail ?? "no detail";
        const timeoutish = /MODEL_TIMEOUT|timed out/i.test(detail);
        problem({
          turn_index: number,
          category: "PRODUCT",
          severity: timeoutish ? "MAJOR" : "MINOR",
          current_scene: text,
          relevant_durable_refs: [],
          state_snapshot_summary: {},
          retrieved_memory_refs: [],
          executor: backend,
          result: timeoutish ? "executor timeout" : "turn failed closed",
          expected: "a completed turn",
          observed: detail.slice(0, 300),
          reproducible: "UNKNOWN"
        });
      }
      if (number % 10 === 0) await checkpoint(`checkpoint_${String(number)}`, number);
      await persistProgress(`interaction ${String(number)} ${turn.status}`);
      if (number === 10 || number === interactions.length) {
        if (!(await restart(number, "SCHEDULED"))) break;
      }
      if (turn.status === "FAILED") {
        // The product runtime stays closed after a failed turn (observed behaviour);
        // an operator restarts the app. One bounded recovery restart keeps the batch
        // lived; the failure itself is already recorded above.
        if (!(await restart(number, "POST_FAILURE_RECOVERY"))) break;
      }
    }

    const record = await buildRecord(false, "Operational observation only — no scientific verdict, no new core mechanism, no repair performed.");
    const serialized = `${JSON.stringify(record, null, 2)}\n`;
    writeFileSync(ARTIFACT_PATH, serialized, "utf8");
    const sha = createHash("sha256").update(serialized, "utf8").digest("hex");
    const batchInfo = record["batch"] as { completed: number };
    const stateInfo = record["state"] as DurableState | null;
    const summary = {
      interactions: `${String(batchInfo.completed)}/${String(BATCH)} COMPLETE`,
      attempted,
      restarts,
      restarts_detail: restartsDetail.map((entry) => `${String(entry["reason"])}@${String(entry["interactions"])}`),
      degradations,
      non_completions: nonCompletions,
      episodes: stateInfo?.episodes ?? null,
      affect: stateInfo?.affect ?? null,
      beliefs: stateInfo?.beliefs ?? null,
      latency_ms: record["latency_ms"],
      issues: issues.map((issue) => `${issue.issue_id} ${issue.severity} ${issue.category}: ${issue.result}`),
      artifact: ARTIFACT_PATH,
      sha256: sha
    };
    console.log("LONG_RUN_CHECKPOINT", JSON.stringify(summary, null, 2));
    // Configuration provenance for the record (no credentials are printed: /config
    // is an allow-list view and redacts endpoint credentials).
    console.log("LONG_RUN_CONFIG", JSON.stringify(configuration));
    // The harness never asserts a happy outcome: it records what happened. The only
    // hard expectation is that the batch ran to its end and the artifact exists.
    expect(attempted).toBe(BATCH);
    expect(restarts).toBeGreaterThanOrEqual(2);
    expect(readFileSync(ARTIFACT_PATH, "utf8").length).toBeGreaterThan(0);
  }, 28_800_000);
});
