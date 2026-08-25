/**
 * P2.3.3.2 — ObservationTransitionExecutor tests (fixtures shared via
 * observation-fixtures.ts). Wires the REAL subject-core engine + store, real
 * ReferenceContextProducer, fixed-provider fakes and real retrieval adapter.
 */

import { describe, expect, it } from "vitest";

import type { SubjectStateV0 } from "@characteros-next/subject-core";
import {
  SpyMemoryRepository,
  buildObservationHarness,
  observationInput,
  s0,
  session
} from "./observation-fixtures.js";
import { buildObservationRetrievalQuery } from "./observation-transition-executor.js";

describe("ObservationTransitionExecutor", () => {
  it("runs the full pipeline and commits: +1 revision, Observation type, single authority", async () => {
    const { core, executor, ctx } = buildObservationHarness();
    const outcome = await executor.execute(ctx, observationInput(), session());
    expect(outcome.kind).toBe("COMMITTED");
    if (outcome.kind !== "COMMITTED") return;
    expect(outcome.bundle.next_revision).toBe(1);
    expect(outcome.bundle.next_snapshot.runtime_metadata.last_transition_type).toBe("Observation");
    expect(outcome.bundle.next_snapshot.context.current_observation_ref).toBe("observation:o-77");
    expect(outcome.bundle.next_snapshot.context.focus_refs).toEqual(["entity:e-1", "subject:s0"]);
    expect(core.store.getCommittedBundles()).toHaveLength(1);
    expect(core.store.currentRevision("subject-s0")).toBe(1);
  });

  it("accepts LEGAL EMPTY retrieval without failing the pipeline", async () => {
    const { core, executor, ctx } = buildObservationHarness({ emptyRetrieval: true });
    const outcome = await executor.execute(ctx, observationInput(), session());
    expect(outcome.kind).toBe("COMMITTED");
    expect(core.store.getCommittedBundles()).toHaveLength(1);
  });

  it("fails closed on retrieval failure with zero commits", async () => {
    const { core, executor, ctx } = buildObservationHarness({ failingRetrieval: true });
    await expect(executor.execute(ctx, observationInput(), session())).rejects.toThrow(
      /retrieval engine offline/
    );
    expect(core.store.getCommittedBundles()).toHaveLength(0);
  });

  it("fails closed on any provider failure (interpretation / affect) with zero commits", async () => {
    const a = buildObservationHarness({ failingInterpretation: true });
    await expect(a.executor.execute(a.ctx, observationInput(), session())).rejects.toThrow(
      /interpretation provider offline/
    );
    expect(a.core.store.getCommittedBundles()).toHaveLength(0);

    const b = buildObservationHarness({ failingAffect: true });
    await expect(b.executor.execute(b.ctx, observationInput(), session())).rejects.toThrow(
      /affect producer offline/
    );
    expect(b.core.store.getCommittedBundles()).toHaveLength(0);
  });

  it("is deterministic: same input ⇒ identical proposal/refs/hashes/results", async () => {
    const a = buildObservationHarness();
    const b = buildObservationHarness();
    const oa = await a.executor.execute(a.ctx, observationInput(), session());
    const ob = await b.executor.execute(b.ctx, observationInput(), session());
    expect(oa.kind).toBe("COMMITTED");
    expect(ob.kind).toBe("COMMITTED");
    if (oa.kind !== "COMMITTED" || ob.kind !== "COMMITTED") return;
    expect(oa.bundle.transition_id).toBe(ob.bundle.transition_id);
    expect(oa.bundle.canonical_result.result_ref).toBe(ob.bundle.canonical_result.result_ref);
    expect(oa.bundle.state_hash_after).toBe(ob.bundle.state_hash_after);
    expect(oa.bundle.record_checksum).toBe(ob.bundle.record_checksum);
  });

  it("rejects occurrence drift and context drift before any producer work", async () => {
    const { core, executor, ctx } = buildObservationHarness();
    await expect(
      executor.execute(ctx, observationInput({ occurrence_logical_time: 5 }), session())
    ).rejects.toThrow(/INVALID_LOGICAL_TIME/);

    const drifting = { ...ctx, current_logical_time: 99 as never };
    await expect(executor.execute(drifting, observationInput(), session())).rejects.toThrow(/drift/);
    expect(core.store.getCommittedBundles()).toHaveLength(0);
  });

  it("boundary: never writes memory, never reaches external state, no LLM surface", async () => {
    const memory = new SpyMemoryRepository();
    const { core, executor, ctx } = buildObservationHarness({ memory });
    const outcome = await executor.execute(ctx, observationInput(), session());
    expect(outcome.kind).toBe("COMMITTED");
    expect(memory.prepareCalls).toBe(0); // zero memory writes
    expect(outcome.kind === "COMMITTED" ? outcome.bundle.transition_id : "").toMatch(
      /^t-obs-subject-s0-r0-oobservation-o-77$/
    );
    expect(core.store.getCommittedBundles()).toHaveLength(1);
  });

  it("builds the retrieval query deterministically from input + read-only snapshot", () => {
    const q = buildObservationRetrievalQuery(observationInput(), s0() as unknown as SubjectStateV0);
    expect(q.semantic_reference).toBe("observation:o-77");
    expect(q.repository_revision).toBe("R0");
    expect(q.temporal.now_logical_time).toBe(0);
    expect(q.current_context_refs).toEqual(["environment:room-1"]);
    expect(q.salience_constraints.max_candidates).toBe(16);
  });
});
