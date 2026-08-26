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
  observationCapabilities,
  fixedInterpretation,
  observationInput,
  retrievalService,
  s0,
} from "./observation-fixtures.js";
import { buildObservationRetrievalQuery } from "./observation-transition-executor.js";
import { TransitionStageFailure } from "../common.js";

/**
 * R2-I (ATTACK G): a rogue retrieval port that first fetches a legitimate result
 * from the reference service, then corrupts it — runtime must reject the contract
 * violation itself; TypeScript types never protect a trust boundary.
 */
function mutatedRetrieval(
  mutate: (result: Record<string, unknown>) => void
): { retrieve(query: never): Promise<never> } {
  const real = retrievalService(false);
  return {
    retrieve: async (query) => {
      const good = await real.retrieve(query as never);
      const copy = JSON.parse(JSON.stringify(good)) as Record<string, unknown>;
      mutate(copy);
      return copy as never;
    }
  };
}

function alignedEvidenceEntry(episodeRef: string): Record<string, unknown> {
  return { episode_ref: episodeRef, reasons: [{ dimension: "CONTEXT", score: 0.7 }] };
}

async function expectStageFailure(promise: Promise<unknown>): Promise<TransitionStageFailure> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(TransitionStageFailure);
    return error as TransitionStageFailure;
  }
  throw new Error("expected the executor to reject");
}

describe("ObservationTransitionExecutor", () => {
  it("runs the full pipeline and commits: +1 revision, Observation type, single authority", async () => {
    const { core, executor, ctx } = buildObservationHarness();
    const outcome = await executor.execute(ctx, observationInput(), await observationCapabilities());
    expect(outcome.kind).toBe("COMMITTED");
    if (outcome.kind !== "COMMITTED") return;
    expect(outcome.bundle.next_revision).toBe(1);
    expect(outcome.bundle.next_snapshot.runtime_metadata.last_transition_type).toBe("Observation");
    expect(outcome.bundle.next_snapshot.context.current_observation_ref).toBe("observation:o-77");
    expect(outcome.bundle.next_snapshot.context.focus_refs).toEqual(["entity:e-1", "subject:s0"]);
    expect(core.storeRead.getCommittedBundles()).toHaveLength(1);
    expect(core.storeRead.currentRevision("subject-s0")).toBe(1);
  });

  it("accepts LEGAL EMPTY retrieval without failing the pipeline", async () => {
    const { core, executor, ctx } = buildObservationHarness({ emptyRetrieval: true });
    const outcome = await executor.execute(ctx, observationInput(), await observationCapabilities());
    expect(outcome.kind).toBe("COMMITTED");
    expect(core.storeRead.getCommittedBundles()).toHaveLength(1);
  });

  it("maps retrieval provider failure to canonical SERVICE_UNAVAILABLE (not raw messages)", async () => {
    const { core, executor, ctx } = buildObservationHarness({ failingRetrieval: true });
    const failure = await expectStageFailure(executor.execute(ctx, observationInput(), await observationCapabilities()));
    expect(failure.stage).toBe("OBSERVATION");
    expect(failure.error_code).toBe("SERVICE_UNAVAILABLE");
    expect(failure.reason).toBe("FAIL-SERVICE-001");
    expect(core.storeRead.getCommittedBundles()).toHaveLength(0);
  });

  it("keeps canonical failure classification stable across arbitrary provider messages", async () => {
    const a = buildObservationHarness({ failingInterpretation: true });
    const fa = await expectStageFailure(a.executor.execute(a.ctx, observationInput(), await observationCapabilities()));
    expect(fa.stage).toBe("OBSERVATION");
    expect(fa.error_code).toBe("SERVICE_UNAVAILABLE");
    expect(fa.reason).toBe("FAIL-SERVICE-001");
    expect(a.core.storeRead.getCommittedBundles()).toHaveLength(0);

    const b = buildObservationHarness({ failingAffect: true });
    const fb = await expectStageFailure(b.executor.execute(b.ctx, observationInput(), await observationCapabilities()));
    expect(fb.stage).toBe("OBSERVATION");
    expect(fb.error_code).toBe("SERVICE_UNAVAILABLE");
    expect(fb.reason).toBe("FAIL-SERVICE-001");
    expect(b.core.storeRead.getCommittedBundles()).toHaveLength(0);
  });

  it.each([
    ["missing schema version", (r: Record<string, unknown>) => { delete r["schema_version"]; }],
    ["missing evidence", (r: Record<string, unknown>) => { delete r["evidence"]; }],
    ["selected/evidence length mismatch", (r: Record<string, unknown>) => { (r["evidence"] as unknown[]).pop(); }],
    ["invalid selected ref kind", (r: Record<string, unknown>) => { (r["selected_memory_refs"] as unknown[])[0] = "bogus:not-an-episode"; }],
    [
      "duplicates",
      (r: Record<string, unknown>) => {
        (r["selected_memory_refs"] as unknown[]).push("episode:e-9");
        (r["evidence"] as unknown[]).push(alignedEvidenceEntry("episode:e-9"));
      }
    ],
    [
      "unsorted refs",
      (r: Record<string, unknown>) => {
        (r["selected_memory_refs"] as unknown[]).unshift("episode:e-0");
        (r["evidence"] as unknown[]).unshift(alignedEvidenceEntry("episode:e-0"));
        const sel = r["selected_memory_refs"] as unknown[];
        const ev = r["evidence"] as unknown[];
        // swap first two (raw-ASCII "episode:e-0" < "episode:e-9") keeping alignment
        [sel[0], sel[1]] = [sel[1], sel[0]];
        [ev[0], ev[1]] = [ev[1], ev[0]];
      }
    ],
    [
      "invalid metadata",
      (r: Record<string, unknown>) => {
        (r["deterministic_metadata"] as Record<string, unknown>)["candidate_count"] = -3;
      }
    ]
  ])("rejects malformed retrieval result before interpretation: %s", async (_name, mutate) => {
    let interpretationCalls = 0;
    const { core, executor, ctx } = buildObservationHarness({
      retrieval: mutatedRetrieval(mutate),
      interpretation: {
        interpret: async (view) => {
          interpretationCalls += 1;
          return fixedInterpretation().interpret(view);
        }
      }
    });
    const failure = await expectStageFailure(executor.execute(ctx, observationInput(), await observationCapabilities()));
    expect(failure.error_code).toBe("INVALID_SCHEMA");
    expect(failure.reason).toBe("SS-SCHEMA-001");
    expect(interpretationCalls).toBe(0); // rejected BEFORE any interpretation use
    expect(core.storeRead.getCommittedBundles()).toHaveLength(0);
  });

  it("rejects retrieval result answering a different subject or revision", async () => {
    const wrongRevision = buildObservationHarness({
      retrieval: mutatedRetrieval((r) => {
        (r["deterministic_metadata"] as Record<string, unknown>)["repository_revision"] = "R999";
      })
    });
    const failure = await expectStageFailure(
      wrongRevision.executor.execute(wrongRevision.ctx, observationInput(), await observationCapabilities())
    );
    expect(failure.error_code).toBe("INVALID_MEMORY_REVISION");
    expect(failure.reason).toBe("MEM-REV-001");
    expect(wrongRevision.core.storeRead.getCommittedBundles()).toHaveLength(0);

    const wrongSubject = buildObservationHarness({
      retrieval: mutatedRetrieval((r) => {
        r["subject_id"] = "subject-other";
      })
    });
    const subjectFailure = await expectStageFailure(
      wrongSubject.executor.execute(wrongSubject.ctx, observationInput(), await observationCapabilities())
    );
    expect(subjectFailure.error_code).toBe("INVALID_SCHEMA");
    expect(wrongSubject.core.storeRead.getCommittedBundles()).toHaveLength(0);
  });

  it("is deterministic: same input ⇒ identical proposal/refs/hashes/results", async () => {
    const a = buildObservationHarness();
    const b = buildObservationHarness();
    const oa = await a.executor.execute(a.ctx, observationInput(), await observationCapabilities());
    const ob = await b.executor.execute(b.ctx, observationInput(), await observationCapabilities());
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
      executor.execute(ctx, observationInput({ occurrence_logical_time: 5 }), await observationCapabilities())
    ).rejects.toThrow(/INVALID_LOGICAL_TIME/);

    const drifting = { ...ctx, current_logical_time: 99 as never };
    await expect(executor.execute(drifting, observationInput(), await observationCapabilities())).rejects.toThrow(/drift/);
    expect(core.storeRead.getCommittedBundles()).toHaveLength(0);
  });

  it("boundary: never writes memory, never reaches external state, no LLM surface", async () => {
    const memory = new SpyMemoryRepository();
    const { core, executor, ctx } = buildObservationHarness({ memory });
    const outcome = await executor.execute(ctx, observationInput(), await observationCapabilities());
    expect(outcome.kind).toBe("COMMITTED");
    expect(memory.prepareCalls).toBe(0); // zero memory writes
    // Round-3 B4: collision-safe identity — opaque hash suffix, frozen syntax.
    expect(outcome.kind === "COMMITTED" ? outcome.bundle.transition_id : "").toMatch(
      /^t-obs-[0-9a-f]{64}$/
    );
    expect(core.storeRead.getCommittedBundles()).toHaveLength(1);
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
