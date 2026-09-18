/**
 * LONG-RUN MONITORING OOM HARDENING — H1–H7 (0 model calls).
 *
 * H1 size monitoring is stat-only (a garbage file still yields its size) · H2 the live
 * worker no longer full-parses the store · H3 deep inspection runs in an isolated
 * short-lived process · H4 heap telemetry mutates nothing · H5 the soft tripwire ends
 * only the chunk · H6 no product/core/persistence semantic change · H7 the corrected
 * canonical membership checker is still the one in use.
 */

import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import {
  CHUNK_MEMORY_RESET_RATIO_V0,
  HEAP_SOFT_BUDGET_BYTES_V0,
  durableSizesV0,
  heapReadingV0,
  shouldResetChunkV0
} from "./long-run-memory-safe-monitoring.js";

const roots: string[] = [];
function tempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "characteros-h-"));
  roots.push(root);
  return root;
}
afterEach(() => {
  while (roots.length > 0) {
    const root = roots.pop();
    if (root !== undefined) rmSync(root, { recursive: true, force: true });
  }
});

const modulePath = fileURLToPath(new URL("./long-run-memory-safe-monitoring.ts", import.meta.url));
const harnessPath = fileURLToPath(new URL("./long-run-checkpoint.test.ts", import.meta.url));
const inspectorPath = fileURLToPath(new URL("../../../scripts/long-run-inspect.mjs", import.meta.url));

describe("H1: size monitoring is stat-only", () => {
  it("returns sizes for a file whose content is not even valid JSON", () => {
    const root = tempRoot();
    const payload = "x".repeat(5_000_000); // 5 MB of garbage: parsing would throw
    writeFileSync(join(root, "subject-x.snapshot.json"), payload, "utf8");
    writeFileSync(join(root, "subject-x.shared-subject.json"), "y", "utf8");
    const sizes = durableSizesV0(root);
    expect(sizes.snapshot_bytes).toBe(statSync(join(root, "subject-x.snapshot.json")).size);
    expect(sizes.shared_subject_bytes).toBe(1);
  });

  it("the module contains no file read and no JSON parse", () => {
    const source = readFileSync(modulePath, "utf8");
    for (const forbidden of ["readFileSync", "JSON.parse", "createReadStream"]) {
      expect(source).not.toContain(forbidden);
    }
  });
});

describe("H2: the live worker no longer materializes the store", () => {
  it("the harness has no pressure scan, no save probe and no store parse", () => {
    const source = readFileSync(harnessPath, "utf8");
    for (const forbidden of [
      "scanDurablePressureV0",
      "measureSaveCostV0",
      "JSON.parse(readFileSync",
      "summariseAppraisalPressureV0"
    ]) {
      expect(source).not.toContain(forbidden);
    }
    // ...and it does use the memory-safe helpers instead.
    expect(source).toContain("durableSizesV0(");
    expect(source).toContain("shouldResetChunkV0(");
  });
});


describe("H4/H5: heap telemetry and the soft tripwire are harness-only", () => {
  it("heap telemetry reads this process and mutates nothing", () => {
    const reading = heapReadingV0();
    expect(reading.heap_used).toBeGreaterThan(0);
    expect(reading.heap_total).toBeGreaterThan(0);
    expect(reading.rss).toBeGreaterThan(0);
    expect(reading.heap_budget).toBe(HEAP_SOFT_BUDGET_BYTES_V0);
    expect(reading.ratio).toBeGreaterThan(0);
    // No engine-limit dependency is claimed (the v8 module is outside the allowlist).
    expect(reading.heap_size_limit).toBeNull();
    const source = readFileSync(modulePath, "utf8");
    expect(source).not.toContain("@characteros-next");
  });

  it("the soft tripwire ends a chunk at 0.78 of the budget and nothing below it", () => {
    expect(CHUNK_MEMORY_RESET_RATIO_V0).toBe(0.78);
    const fake = (ratio: number) => ({
      heap_used: ratio * HEAP_SOFT_BUDGET_BYTES_V0,
      heap_total: HEAP_SOFT_BUDGET_BYTES_V0,
      rss: HEAP_SOFT_BUDGET_BYTES_V0,
      heap_size_limit: null,
      heap_budget: HEAP_SOFT_BUDGET_BYTES_V0,
      ratio
    });
    expect(shouldResetChunkV0(fake(0.9))).toBe(true);
    expect(shouldResetChunkV0(fake(0.78))).toBe(true);
    expect(shouldResetChunkV0(fake(0.5))).toBe(false);
  });
});

describe("H6/H7: no semantic change, corrected membership checker intact", () => {
  it("the hardening touches no product or core surface", () => {
    for (const path of [modulePath, inspectorPath]) {
      const source = readFileSync(path, "utf8");
      expect(source).not.toContain("@characteros-next");
    }
    // The inspector only reads the store, never writes subject state.
    const inspector = readFileSync(inspectorPath, "utf8");
    expect(inspector).not.toContain("writeJsonAtomicV0");
    expect(inspector).not.toContain(".snapshot.json\", JSON.stringify(value)");
  });

  it("the membership check still asks the production authority (no window)", () => {
    const source = readFileSync(harnessPath, "utf8");
    expect(source).toContain("evaluateBeliefEvidenceMembershipV0");
    expect(source).toContain("runtime.refsBelongToRevision(");
    expect(source).not.toContain("episodeRefs.includes(ref)");
  });
});
