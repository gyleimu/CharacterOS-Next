/**
 * P2.3 Trust-Boundary Surgical Closure Round 3 — B5 Observation A11 complete
 * atomicity regression (evidence gap closure).
 *
 * Independent re-audit finding: the committed suite never executed a COMPLETE
 * multi-domain Observation proposal with a valid affect delta and an INVALID
 * ContextDelta that ACTUALLY ENTERS the assembled proposal, and the fixture
 * declared a `contextProducer` override that buildObservationHarness did not
 * honor. Round-3 fixes the fixture (override now takes precedence) and proves:
 *
 *   invalid ContextDelta inside an otherwise complete proposal
 *     → canonical admission rejects the proposal
 *     → bundle count 0 / revision unchanged / state bytes unchanged
 *     → no trace append, no partial affect/mood/context/retrieval-metadata
 *
 * plus the inverse control: the identical fixture with a VALID context delta
 * commits exactly one canonical atomic transition.
 */

import { describe, expect, it } from "vitest";

import type { DomainDeltaV0, SubjectStateV0 } from "@characteros-next/subject-core";
import {
  buildObservationHarness,
  capabilitiesFor,
  fixedAffectProducer,
  observationInput,
  s0
} from "./observation-fixtures.js";
import { buildObservationProposal } from "./observation-transition-executor.js";
import {
  ReferenceContextProducer,
  buildContextDelta,
  type ContextProducerPort
} from "../../ports/context-producer-port.js";

/** The reference projection half (interpretation/appraisal still run honestly). */
function projectionHalf(
  producer: ReferenceContextProducer
): Pick<ContextProducerPort, "produceControlledProjection"> {
  return {
    produceControlledProjection: (input, assembly) =>
      producer.produceControlledProjection(input, assembly)
  };
}

async function honestAffectDelta(): Promise<DomainDeltaV0> {
  return fixedAffectProducer().produceAffectDelta({
    context: { subject_id: "subject-s0", current_logical_time: 0, state_revision: 0 } as never,
    snapshot: s0() as unknown as SubjectStateV0,
    transition_type: "Observation",
    appraisal: null,
    elapsed_ticks: null
  });
}

/**
 * Structurally assembled but canonically INVALID context delta: producer/domain
 * identity is right, but the operation targets a path outside the context
 * partition — only canonical admission can catch it (the producer did NOT throw).
 */
function invalidContextDelta(): DomainDeltaV0 {
  return {
    producer: "context",
    domain: "context",
    expected_repository_revision: null,
    operations: [
      {
        path: "/affect", // ← wrong partition: context delta may only touch /context
        value: { scene: "smuggled", task: null, focus_refs: [] }
      }
    ],
    provenance_refs: []
  } as unknown as DomainDeltaV0;
}

describe("round 3 — B5 Observation A11 complete atomicity", () => {
  it("invalid ContextDelta inside an otherwise complete proposal → zero commit, zero partial state", async () => {
    let contextDeltaCalls = 0;
    const reference = new ReferenceContextProducer();
    const harness = buildObservationHarness({
      // Round-3 B5: the override is ACTUALLY honored — it returns the invalid
      // delta instead of throwing, so the delta really enters the proposal.
      contextProducer: {
        ...projectionHalf(reference),
        produceContextDelta: async (input, snapshot) => {
          contextDeltaCalls += 1;
          void input;
          void snapshot;
          return invalidContextDelta();
        }
      }
    });

    const initialBytes = JSON.stringify(harness.initial);
    Object.freeze(harness.initial);

    // Capabilities minted for the EXACT proposal the executor assembles
    // (valid affect delta + the invalid context delta) — host-side honesty.
    const observation = observationInput();
    const proposal = await buildObservationProposal({
      subjectId: "subject-s0",
      stateRevision: 0,
      observation,
      deltas: [await honestAffectDelta(), invalidContextDelta()]
    });
    const capabilities = await capabilitiesFor(proposal);

    // Canonical admission rejects the complete proposal carrying the invalid delta.
    await expect(
      harness.executor.execute(harness.ctx, observation, capabilities)
    ).rejects.toThrow(/INVALID_SCHEMA\/SS-SCHEMA-001/);

    // The invalid delta really entered assembly (producer ran and returned it —
    // this is NOT satisfied by an early producer throw).
    expect(contextDeltaCalls).toBe(1);

    // Zero commit, revision unchanged, state byte-identical.
    expect(harness.core.storeRead.getCommittedBundles()).toHaveLength(0);
    expect(harness.core.storeRead.currentRevision("subject-s0")).toBeNull();
    expect(JSON.stringify(harness.initial)).toBe(initialBytes);
    expect(Object.isFrozen(harness.initial)).toBe(true);

    // No successful canonical trace append (nothing ever reached authority).
    expect(harness.initial.trace_window.entries).toHaveLength(0);

    // No partial affect/mood mutation, no partial context mutation, zero memory
    // writes, no retrieval-metadata mutation — the store is empty and the
    // snapshot bytes above already prove affect/mood/context untouched.
    expect(harness.memory.prepareCalls).toBe(0);
    expect(harness.memory.readCalls).toBe(0);
  });

  it("inverse control: the identical fixture with a VALID context delta commits exactly once", async () => {
    const reference = new ReferenceContextProducer();
    const harness = buildObservationHarness({
      contextProducer: {
        ...projectionHalf(reference),
        produceContextDelta: (input, snapshot) => buildContextDelta(input, snapshot)
      }
    });

    const observation = observationInput();
    const proposal = await buildObservationProposal({
      subjectId: "subject-s0",
      stateRevision: 0,
      observation,
      deltas: [await honestAffectDelta(), await buildContextDelta(observation, harness.initial)]
    });
    const capabilities = await capabilitiesFor(proposal);

    const outcome = await harness.executor.execute(harness.ctx, observation, capabilities);
    expect(outcome.kind).toBe("COMMITTED");
    expect(harness.core.storeRead.getCommittedBundles()).toHaveLength(1);
    expect(harness.core.storeRead.currentRevision("subject-s0")).toBe(1);
    if (outcome.kind === "COMMITTED") {
      // Exactly one canonical atomic commit: one trace entry, both domains atomic.
      expect(outcome.bundle.trace_window.entries).toHaveLength(1);
      expect(
        outcome.bundle.trace_entry.domain_mutations.map((m: { domain: string }) => m.domain)
      ).toEqual(["affect", "context"]);
    }
  });
});
