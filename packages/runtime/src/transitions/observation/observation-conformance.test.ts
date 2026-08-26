/**
 * P2.3.3.3 — Observation Transition Conformance Hardening (no new business
 * capability; conformance + boundary evidence only).
 *
 * Covers:
 * - A4  proposal generation: one canonical Observation proposal with deterministic
 *        identity/order, occurrence pinned to authority;
 * - A11 multi-domain atomicity: affect + context deltas land in EXACTLY ONE
 *        canonical commit (+1 revision, single trace, both summaries present);
 * - atomic failure matrix: affect/context/appraisal/retrieval failure ⇒ SubjectCore
 *        commit count = 0 (fail closed, nothing partial);
 * - determinism matrix: ≥3 isolated runs with identical input/deps/initial snapshot
 *        ⇒ identical transition_id / proposal fingerprint / result_ref / state_hash;
 * - boundary attacks: no direct SubjectState mutation, zero memory prepare/read,
 *        retrieval replays declared evidence without any algorithm.
 */

import { describe, expect, it } from "vitest";

import type { MemoryRetrievalQueryV0 } from "@characteros-next/memory";
import type { SubjectStateV0 } from "@characteros-next/subject-core";
import {
  buildObservationHarness,
  observationCapabilities,
  observationInput,
  retrievalService,
  s0,
  SpyMemoryRepository
} from "./observation-fixtures.js";
import { buildObservationRetrievalQuery } from "./observation-transition-executor.js";

describe("A4 — proposal generation conformance", () => {
  it("produces one Observation proposal pinned to the authoritative position", async () => {
    const { executor, ctx } = buildObservationHarness();
    const outcome = await executor.execute(ctx, observationInput(), await observationCapabilities());
    expect(outcome.kind).toBe("COMMITTED");
    if (outcome.kind !== "COMMITTED") return;
    const bundle = outcome.bundle;
    expect(bundle.transition_type).toBe("Observation");
    expect(bundle.expected_revision).toBe(0);
    expect(bundle.logical_time_before).toBe(0);
    expect(bundle.logical_time_after).toBe(0); // Observation never advances time
    // Round-3 B4: collision-safe identity — opaque hash suffix, frozen syntax.
    expect(bundle.transition_id).toMatch(/^t-obs-[0-9a-f]{64}$/);
    expect(bundle.trace_entry.transition_type).toBe("Observation");
    expect(bundle.trace_entry.cause_refs).toEqual(["observation:o-77"]);
  });
});

describe("A11 — multi-domain atomic commit", () => {
  it("commits affect + context in exactly ONE canonical commit with one trace", async () => {
    const { core, executor, ctx } = buildObservationHarness();
    const outcome = await executor.execute(ctx, observationInput(), await observationCapabilities());
    expect(outcome.kind).toBe("COMMITTED");
    const bundles = core.storeRead.getCommittedBundles();
    expect(bundles).toHaveLength(1);
    expect(core.storeRead.currentRevision("subject-s0")).toBe(1);

    const bundle = bundles[0] as NonNullable<(typeof bundles)[number]>;
    // Both domains are present in the single trace summary, sorted by (domain,producer).
    const summaries = bundle.trace_entry.domain_mutations;
    expect(summaries.map((summary: { domain: string }) => summary.domain)).toEqual([
      "affect",
      "context"
    ]);
    expect(summaries.map((summary: { producer: string }) => summary.producer)).toEqual([
      "affect",
      "context"
    ]);
    // Path summaries prove both partitions were applied atomically.
    const paths = summaries.flatMap(
      (summary: { field_changes: ReadonlyArray<{ path: string }> }) =>
        summary.field_changes.map((change) => change.path)
    );
    expect(paths).toContain("/affect");
    expect(paths).toContain("/mood");
    expect(paths).toContain("/context");
    expect(bundle.trace_window.entries).toHaveLength(1);
  });
});

describe("atomic failure matrix — SubjectCore commit count = 0", () => {
  const cases: Array<{ name: string; options: Parameters<typeof buildObservationHarness>[0] }> = [
    { name: "affect producer failure", options: { failingAffect: true } },
    { name: "context producer failure", options: { failingContextDelta: true } },
    { name: "appraisal failure", options: { failingAppraisal: true } },
    { name: "retrieval failure", options: { failingRetrieval: true } }
  ];

  for (const { name, options } of cases) {
    it(name, async () => {
      const { core, executor, ctx } = buildObservationHarness(options);
      await expect(executor.execute(ctx, observationInput(), await observationCapabilities())).rejects.toThrow();
      expect(core.storeRead.getCommittedBundles()).toHaveLength(0);
      expect(core.storeRead.currentRevision("subject-s0")).toBeNull();
    });
  }
});

describe("determinism matrix — ≥3 isolated runs, identical inputs", () => {
  it("yields identical transition_id, proposal fingerprint, result_ref, state_hash", async () => {
    const RUNS = 4;
    const outputs: Array<{
      transitionId: string;
      fingerprint: string;
      resultRef: string;
      stateHash: string;
    }> = [];

    for (let i = 0; i < RUNS; i++) {
      const harness = buildObservationHarness();
      const outcome = await harness.executor.execute(harness.ctx, observationInput(), await observationCapabilities());
      expect(outcome.kind).toBe("COMMITTED");
      if (outcome.kind !== "COMMITTED") return;
      outputs.push({
        transitionId: outcome.bundle.transition_id,
        fingerprint: outcome.bundle.payload_fingerprint,
        resultRef: outcome.bundle.canonical_result.result_ref,
        stateHash: outcome.bundle.state_hash_after
      });
    }

    const first = outputs[0] as (typeof outputs)[number];
    for (const output of outputs) {
      expect(output).toEqual(first);
    }
    // Sanity: the matrix is non-vacuous (hashes are real wire values).
    expect(first.stateHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(first.fingerprint).toMatch(/^sha256:[0-9a-f]{64}$/);
  });
});

describe("boundary attacks", () => {
  it("runtime never mutates the authoritative SubjectState", async () => {
    const harness = buildObservationHarness();
    const initialBytes = JSON.stringify(harness.initial);
    Object.freeze(harness.initial);
    const outcome = await harness.executor.execute(harness.ctx, observationInput(), await observationCapabilities());
    expect(outcome.kind).toBe("COMMITTED");
    expect(JSON.stringify(harness.initial)).toBe(initialBytes);
    expect(Object.isFrozen(harness.initial)).toBe(true);
    // Executor exposes no state-mutation surface beyond the injected ports.
    expect(Object.keys(harness.executor).sort()).toEqual(["deps"]);
  });

  it("memory capability sees zero prepare/read calls during the whole run", async () => {
    const memory = new SpyMemoryRepository();
    const { executor, ctx } = buildObservationHarness({ memory });
    const outcome = await executor.execute(ctx, observationInput(), await observationCapabilities());
    expect(outcome.kind).toBe("COMMITTED");
    expect(memory.prepareCalls).toBe(0);
    expect(memory.readCalls).toBe(0);
  });

  it("retrieval replays declared evidence verbatim — no ranking or search in the loop", async () => {
    let retrieveCalls = 0;
    const service = retrievalService();
    const counting = {
      retrieve: async (query: MemoryRetrievalQueryV0) => {
        retrieveCalls += 1;
        return service.retrieve(query);
      }
    };
    const { executor, ctx } = buildObservationHarness({ retrieval: counting });
    const outcome = await executor.execute(ctx, observationInput(), await observationCapabilities());
    expect(outcome.kind).toBe("COMMITTED");
    expect(retrieveCalls).toBe(1); // exactly one query per execution — no hidden search loops

    // The declarative adapter replays the declared rehearsal verbatim:
    const result = await service.retrieve(
      buildObservationRetrievalQuery(observationInput(), s0() as unknown as SubjectStateV0)
    );
    expect(result.selected_memory_refs).toEqual(["episode:e-9"]);
    expect(result.evidence[0]?.reasons).toEqual([{ dimension: "CONTEXT", score: 0.7 }]);
  });
});
