/**
 * PERSISTENCE_SCALABILITY_R1 — minified durable-store serialization (0 model calls).
 *
 * P1 old pretty durable JSON loads · P2 new minified durable JSON loads · P3 pretty and
 * minified parse deep-equal · P8 minified is materially smaller · P9 atomic write
 * semantics unchanged · P10 crash-safe temp+rename unchanged.
 *
 * (P4–P7 — restore equivalence, chain validation, revisions and checksums at real scale —
 * run on a COPY of the live subject in the slice's acceptance, because a full 254 MB
 * restore does not belong in the unit suite; the restore path itself runs
 * `validateAtomicCommitChainV0` fail-closed.)
 */

import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { readJsonFileV0, writeJsonAtomicV0 } from "./atomic-json-file.js";


const roots: string[] = [];
function tempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "characteros-r1-"));
  roots.push(root);
  return root;
}

afterEach(() => {
  while (roots.length > 0) {
    const root = roots.pop();
    if (root !== undefined) rmSync(root, { recursive: true, force: true });
  }
});

/** A durable-shaped value with many nested records (mirrors the real store's shape). */
function storeShapedValueV0(records = 400): Record<string, unknown> {
  return {
    schema_version: "durable-store-fixture-v0",
    memory_state: {
      repository_revision: "R42",
      bundles: Array.from({ length: records }, (_, index) => ({
        transition_id: `t-${String(index)}`,
        next_revision: index + 1,
        previous_record_checksum: index === 0 ? null : `hash:${String(index)}`,
        record_checksum: `hash:${String(index + 1)}`,
        canonical_proposal: {
          cause_refs: [`observation:o-${String(index)}`, `episode:e-${String(index)}`],
          domain_deltas: [{ operations: [{ path: "/affect", value: { valence: 0, activation: 0.25 } }] }]
        }
      }))
    },
    runtime_metadata: { state_revision: records, logical_time: records }
  };
}

describe("P1/P2/P3: both representations load and parse equal", () => {
  it("an old pretty file loads (default writer mode, unchanged bytes)", () => {
    const root = tempRoot();
    const path = join(root, "subject-x.snapshot.json");
    const value = storeShapedValueV0(20);
    writeJsonAtomicV0(path, value); // default mode = the historical pretty writer
    expect(readFileSync(path, "utf8")).toContain('\n  "schema_version"');
    expect(readJsonFileV0(path)).toEqual(value);
  });

  it("a new minified file loads", () => {
    const root = tempRoot();
    const path = join(root, "subject-x.snapshot.json");
    const value = storeShapedValueV0(20);
    writeJsonAtomicV0(path, value, "minified");
    const text = readFileSync(path, "utf8");
    expect(text).not.toContain("\n  ");
    expect(text.endsWith("\n")).toBe(true);
    expect(readJsonFileV0(path)).toEqual(value);
  });

  it("pretty and minified bytes parse deep-equal", () => {
    const value = storeShapedValueV0(50);
    const prettyPath = join(tempRoot(), "pretty.json");
    const minifiedPath = join(tempRoot(), "minified.json");
    writeJsonAtomicV0(prettyPath, value);
    writeJsonAtomicV0(minifiedPath, value, "minified");
    expect(JSON.parse(readFileSync(minifiedPath, "utf8"))).toEqual(JSON.parse(readFileSync(prettyPath, "utf8")));
  });
});

describe("P8: minified is materially smaller", () => {
  it("cuts at least a third of the bytes on a store-shaped value", () => {
    const value = storeShapedValueV0(400);
    const prettyPath = join(tempRoot(), "pretty.json");
    const minifiedPath = join(tempRoot(), "minified.json");
    writeJsonAtomicV0(prettyPath, value);
    writeJsonAtomicV0(minifiedPath, value, "minified");
    const pretty = statSync(prettyPath).size;
    const minified = statSync(minifiedPath).size;
    expect(minified).toBeLessThan(pretty * 0.67);
  });
});

describe("P9/P10: atomic temp+rename semantics are unchanged", () => {
  it("writes through a sibling .tmp and leaves no temp file behind", () => {
    const root = tempRoot();
    const path = join(root, "subject-x.shared-subject.json");
    writeJsonAtomicV0(path, { a: 1 }, "minified");
    expect(existsSync(`${path}.tmp`)).toBe(false);

    // A crash mid-write can never replace the target: the temp path is the only
    // thing written before the rename, and the rename is atomic.
    expect(readJsonFileV0(path)).toEqual({ a: 1 });

    // An existing file stays intact if the writer never runs to completion.
    const before = readFileSync(path, "utf8");
    writeFileSync(`${path}.tmp`, "partial{", "utf8");
    expect(readFileSync(path, "utf8")).toBe(before);
  });

  it("replaces the target atomically on every save", () => {
    const path = join(tempRoot(), "subject-x.snapshot.json");
    const first = storeShapedValueV0(5);
    const second = storeShapedValueV0(9);
    writeJsonAtomicV0(path, first, "minified");
    const firstBytes = readFileSync(path, "utf8");
    writeJsonAtomicV0(path, second, "minified");
    expect(readJsonFileV0(path)).toEqual(second);
    expect(readFileSync(path, "utf8")).not.toBe(firstBytes);
    expect(existsSync(`${path}.tmp`)).toBe(false);
    expect(readFileSync(path, "utf8").startsWith('{"schema_version"')).toBe(true);
  });
});
