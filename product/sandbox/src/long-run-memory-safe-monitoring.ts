/**
 * LONG-RUN MEMORY-SAFE MONITORING — the OOM hardening for long-lived batch processes.
 *
 * Adjudicated cause of the Stage-A crash (`FATAL ERROR: Reached heap limit`): the
 * long-lived worker retained the runtime's object graph AND repeatedly materialized the
 * whole durable store inside the same process (a full-text scan of a ~200 MB snapshot
 * plus a full second materialization of it for the save-cost probe), so the Node heap was exhausted
 * between turns. That is a MONITORING/PROCESS problem — the durable store itself was
 * healthy (save ~3 s, restore 10–16 s) and nothing durable was lost.
 *
 * This module is the fix, and it is deliberately small:
 * - durable file SIZES come from filesystem metadata only (`stat`), and this module
 *   never opens or materializes a store file;
 * - heap telemetry is read from the process itself and mutates nothing;
 * - the soft tripwire stops the CHUNK (a clean process exit = a deliberate heap reset)
 *   long before the heap limit is reached.
 *
 * Deep JSON inspection (appraisal pressure, save-cost equivalence) is NOT done here: it
 * runs in a short-lived separate process (`scripts/long-run-inspect.mjs`) that exits
 * completely afterwards.
 */

import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

export interface DurableSizesV0 {
  readonly snapshot_bytes: number | null;
  readonly shared_subject_bytes: number | null;
}

/** Durable file sizes from filesystem metadata ONLY — no read, no parse. */
export function durableSizesV0(root: string): DurableSizesV0 {
  try {
    const names = readdirSync(root);
    const snapshot = names.find((name) => name.endsWith(".snapshot.json"));
    const shared = names.find((name) => name.endsWith(".shared-subject.json"));
    return {
      snapshot_bytes: snapshot === undefined ? null : statSync(join(root, snapshot)).size,
      shared_subject_bytes: shared === undefined ? null : statSync(join(root, shared)).size
    };
  } catch {
    return { snapshot_bytes: null, shared_subject_bytes: null };
  }
}

/**
 * Harness-owned heap budget for the soft tripwire — the engine's default max-old-space
 * limit, MEASURED in this environment with a standalone probe
 * (`node -e "require('v8').getHeapStatistics().heap_size_limit"` → 4288 MB on Node
 * v24.19.0), because the `v8` module is outside this workspace's import allowlist.
 * The soft tripwire ends a chunk at 78% of it (~3.35 GB), well before Node's own limit;
 * the budget is NOT raised to squeeze more turns into a process — short-lived chunks are
 * the fix (§8).
 */
export const HEAP_SOFT_BUDGET_BYTES_V0 = 4_288_000_000;

export interface HeapReadingV0 {
  readonly heap_used: number;
  readonly heap_total: number;
  readonly rss: number;
  readonly heap_size_limit: number | null;
  readonly heap_budget: number;
  readonly ratio: number;
}

/** Harness-only heap telemetry. Pure read of this process; no state of any kind. */
export function heapReadingV0(): HeapReadingV0 {
  const usage = process.memoryUsage();
  return {
    heap_used: usage.heapUsed,
    heap_total: usage.heapTotal,
    rss: usage.rss,
    heap_size_limit: null,
    heap_budget: HEAP_SOFT_BUDGET_BYTES_V0,
    ratio: Number((usage.heapUsed / HEAP_SOFT_BUDGET_BYTES_V0).toFixed(4))
  };
}

/** §6 SOFT TRIPWIRE: at or above this ratio the chunk must end and be restarted fresh. */
export const CHUNK_MEMORY_RESET_RATIO_V0 = 0.78;

/** True when the chunk must not start another turn (clean exit + fresh process). */
export function shouldResetChunkV0(
  reading: HeapReadingV0,
  threshold: number = CHUNK_MEMORY_RESET_RATIO_V0
): boolean {
  return reading.ratio >= threshold;
}
