/**
 * P2.3.4.2b — REGULATION_V0 × FROZEN TimeTransitionExecutor integration:
 * R4 durable NO_OP, R12 single atomic affect+mood+regulation commit,
 * R13 regulation-failure atomicity (Affect+Mood+Regulation all +0),
 * R14 replay determinism, and the dedicated OVERBROAD_PORT_SURFACE closure
 * regression (runtime-captured producer intake proves no full SubjectState).
 *
 * Contract: docs/implementation/p2-3-4-regulation-v0-reference-contract.md (69505fa).
 */

import { describe, expect, it } from "vitest";

import type { DomainDeltaV0, SubjectStateV0 } from "@characteros-next/subject-core";
import { proposalFingerprint } from "@characteros-next/subject-core";
import type { MemoryPreparationAuthority } from "@characteros-next/memory";
import type { RuntimeContext } from "../types/runtime-context.js";
import type { AffectProducerPort } from "../ports/affect-producer-port.js";
import type { RegulationProducerInputV0, RegulationProducerPort } from "../ports/regulation-producer-port.js";
import { RuntimeCompositionRoot } from "../composition/runtime-composition-root.js";
import {
  RealEngineCoreAdapter,
  capabilitiesFor,
  s0
} from "../transitions/observation/observation-fixtures.js";
import {
  TimeTransitionExecutor,
  buildTimeNoOpProposal,
  buildTimeProposal
} from "../transitions/time/time-transition-executor.js";
import { TransitionStageFailure } from "../transitions/common.js";
import { ReferenceFastEmaAffectProducer } from "./reference-fast-ema-affect-producer.js";
import { ReferenceRegulationV0Producer } from "./reference-regulation-v0-producer.js";

class MemoryRepositoryStub implements MemoryPreparationAuthority {
  prepareCalls = 0;
  storeCalls = 0;
  async storePayload(): Promise<never> {
    this.storeCalls += 1;
    throw new Error("Time never stores payloads");
  }
  async payloadHashOf(): Promise<null> {
    return null;
  }
  async prepareRevisionForIntent(): Promise<never> {
    this.prepareCalls += 1;
    throw new Error("Time never prepares revisions");
  }
  async readManifest(): Promise<null> {
    return null;
  }
  async validateRevisionBinding(): Promise<boolean> {
    return true;
  }
  async validateRefsBelong(): Promise<boolean> {
    return true;
  }
  readonly repository = Object.freeze({});
}

function ctxOf(initial: SubjectStateV0): RuntimeContext {
  return {
    subject_id: "subject-s0" as never,
    current_logical_time: initial.runtime_metadata.logical_time as never,
    state_revision: initial.runtime_metadata.state_revision as never
  };
}

/** Invocation-counting/capturing wrapper around any inner regulation port. */
class CapturingRegulationProducer implements RegulationProducerPort {
  calls = 0;
  inputs: RegulationProducerInputV0[] = [];
  constructor(
    private readonly mode:
      | { kind: "real"; inner?: RegulationProducerPort }
      | { kind: "throw" }
      | { kind: "invalid-delta" }
  ) {}
  async produceRegulationDelta(input: RegulationProducerInputV0): Promise<DomainDeltaV0> {
    this.calls += 1;
    this.inputs.push(input);
    switch (this.mode.kind) {
      case "real":
        return await (this.mode.inner ?? new ReferenceRegulationV0Producer()).produceRegulationDelta(input);
      case "throw":
        throw new Error("regulation engine offline");
      case "invalid-delta": {
        // Passes TS by `as unknown as DomainDeltaV0`; violates canonical ownership:
        // a "regulation"-producer delta targeting the affect-owned /mood path.
        return {
          producer: "regulation",
          domain: "regulation",
          expected_repository_revision: null,
          operations: [
            { path: "/mood", value: { baseline: 0.9, generated_under_profile: null, last_update: null } }
          ],
          provenance_refs: []
        } as unknown as DomainDeltaV0;
      }
    }
  }
}

interface HarnessOptions {
  readonly affectProducer?: AffectProducerPort;
  readonly regulationProducer?: RegulationProducerPort;
}

async function buildTimeHarness(options: HarnessOptions = {}) {
  const initial = s0() as unknown as SubjectStateV0;
  const core = new RealEngineCoreAdapter(initial);
  const memory = new MemoryRepositoryStub();
  let retrievalCalls = 0;
  const root = new RuntimeCompositionRoot({
    subjectCore: core,
    producerAuthorizationIssuer: core.producerAuthorizationIssuer,
    memoryRepository: memory,
    retrieval: {
      retrieve: async () => {
        retrievalCalls += 1;
        throw new Error("Time must never call retrieval");
      }
    },
    affectProducer: options.affectProducer ?? new ReferenceFastEmaAffectProducer(),
    regulationProducer: options.regulationProducer ?? new ReferenceRegulationV0Producer()
  });
  return {
    core,
    memory,
    initial,
    retrievalCalls: () => retrievalCalls,
    executor: new TimeTransitionExecutor(root.dependencies())
  };
}

/** Mint host capabilities against the exact deltas the run will produce. */
async function timeCapabilities(
  initial: SubjectStateV0,
  ticks: number,
  regulationProducer: RegulationProducerPort = new ReferenceRegulationV0Producer()
) {
  if (ticks === 0) {
    return capabilitiesFor(buildTimeNoOpProposal("subject-s0", 0));
  }
  const affectDelta = await new ReferenceFastEmaAffectProducer().produceAffectDelta({
    context: ctxOf(initial),
    snapshot: initial,
    transition_type: "Time",
    appraisal: null,
    elapsed_ticks: ticks
  });
  const regulationDelta = await regulationProducer.produceRegulationDelta({
    context: ctxOf(initial),
    regulation: initial.regulation,
    elapsed_ticks: ticks
  });
  return capabilitiesFor(buildTimeProposal("subject-s0", 0, ticks, affectDelta, regulationDelta));
}

/** No-mutation invariant assertion shared by every failure-path test (R13).
 * A non-frozenView adapter starts at revision 0 over the exact initial snapshot;
 * zero committed bundles means canonical state bytes remain byte-identical. */
function expectZeroCanonicalMutation(
  harness: Awaited<ReturnType<typeof buildTimeHarness>>
): void {
  expect(harness.core.storeRead.getCommittedBundles()).toHaveLength(0);
  expect(harness.core.storeRead.currentRevision("subject-s0")).toBeNull();
  expect(harness.core.storeRead.readCurrentBundle("subject-s0")).toBeNull();
  expect(harness.memory.prepareCalls).toBe(0);
  expect(harness.memory.storeCalls).toBe(0);
  expect(harness.retrievalCalls()).toBe(0);
}

describe("ReferenceRegulationV0Producer × TimeTransitionExecutor", () => {
  it("R4: elapsed = 0 routes to durable NO_OP — both producers invoked 0 times", async () => {
    let affectCalls = 0;
    const innerAffect = new ReferenceFastEmaAffectProducer();
    const wrappedAffect: AffectProducerPort = {
      produceAffectDelta: async (input) => {
        affectCalls += 1;
        return innerAffect.produceAffectDelta(input);
      }
    };
    const regulation = new CapturingRegulationProducer({ kind: "real" });
    const harness = await buildTimeHarness({ affectProducer: wrappedAffect, regulationProducer: regulation });
    const outcome = await harness.executor.execute(
      ctxOf(harness.initial),
      { elapsed_ticks: 0 },
      await capabilitiesFor(buildTimeNoOpProposal("subject-s0", 0))
    );
    expect(outcome.kind).toBe("NO_OP");
    expect(affectCalls).toBe(0);
    expect(regulation.calls).toBe(0);
    await expectZeroCanonicalMutation(harness);
  });

  it("R12: real FAST_EMA_V0 + real REGULATION_V0 ⇒ exactly one atomic canonical commit", async () => {
    const regulation = new CapturingRegulationProducer({ kind: "real" });
    const harness = await buildTimeHarness({ regulationProducer: regulation });
    const ticks = 75;
    const outcome = await harness.executor.execute(
      ctxOf(harness.initial),
      { elapsed_ticks: ticks },
      await timeCapabilities(harness.initial, ticks)
    );
    expect(outcome.kind).toBe("COMMITTED");
    if (outcome.kind !== "COMMITTED") return;

    // Exactly one canonical commit: one bundle, +1 revision, one trace entry.
    expect(harness.core.storeRead.getCommittedBundles()).toHaveLength(1);
    expect(outcome.bundle.next_revision).toBe(1);
    expect(outcome.bundle.logical_time_before).toBe(0);
    expect(outcome.bundle.logical_time_after).toBe(ticks);
    const next = outcome.bundle.next_snapshot;
    expect(next.trace_window.entries).toHaveLength(1);
    const traceEntry = next.trace_window.entries[0];
    if (traceEntry === undefined) throw new Error("expected one trace entry");
    expect(traceEntry.domain_mutations.map((m) => m.domain)).toEqual(["affect", "regulation"]);

    // REGULATION_V0 identity output: four scalars preserved byte-exactly.
    expect(next.regulation.energy).toBe(harness.initial.regulation.energy);
    expect(next.regulation.stress).toBe(harness.initial.regulation.stress);
    expect(next.regulation.arousal).toBe(harness.initial.regulation.arousal);
    expect(next.regulation.fatigue).toBe(harness.initial.regulation.fatigue);

    // Executable authority-equality evidence (task §4): the producer-derived
    // last_update agrees EXACTLY with the Time proposal's logical_time_after.
    expect(next.regulation.last_update).toBe(outcome.bundle.logical_time_after);
    expect(next.regulation.last_update).toBe(0 + ticks);
  });

  it("§14 OVERBROAD_PORT_SURFACE regression: runtime capture shows closed narrow intake", async () => {
    const regulation = new CapturingRegulationProducer({ kind: "real" });
    const harness = await buildTimeHarness({ regulationProducer: regulation });
    const ticks = 7;
    const outcome = await harness.executor.execute(
      ctxOf(harness.initial),
      { elapsed_ticks: ticks },
      await timeCapabilities(harness.initial, ticks)
    );
    expect(outcome.kind).toBe("COMMITTED");
    expect(regulation.calls).toBe(1);
    const captured = regulation.inputs[0];
    if (captured === undefined) throw new Error("expected one captured invocation");
    // The actual JS object passed across the port carries ONLY narrow keys.
    expect(Object.keys(captured).sort()).toEqual(["context", "elapsed_ticks", "regulation"]);
    for (const forbidden of ["snapshot", "affect", "mood", "memory", "transition_type"]) {
      expect(forbidden in captured).toBe(false);
    }
    // The context projection itself exposes no canonical state surface.
    expect(Object.keys(captured.context).sort()).toEqual([
      "current_logical_time",
      "state_revision",
      "subject_id"
    ]);
    // And the carried values are exactly the authoritative pre-state truth.
    expect(captured.regulation).toBe(harness.initial.regulation);
    expect(captured.elapsed_ticks).toBe(ticks);
    expect(captured.context.current_logical_time).toBe(
      harness.initial.runtime_metadata.logical_time
    );
  });

  it("R13(a): regulation producer THROWS after a succeeding affect producer ⇒ total +0", async () => {
    const regulation = new CapturingRegulationProducer({ kind: "throw" });
    const harness = await buildTimeHarness({ regulationProducer: regulation });
    const error: unknown = await harness.executor
      .execute(
        ctxOf(harness.initial),
        { elapsed_ticks: 5 },
        await timeCapabilities(harness.initial, 5)
      )
      .then(() => null, (e) => e);
    expect(error).toBeInstanceOf(TransitionStageFailure);
    if (!(error instanceof TransitionStageFailure)) throw new Error("expected typed stage failure");
    expect(error.stage).toBe("TIME");
    expect(error.error_code).toBe("SERVICE_UNAVAILABLE");
    expect(error.reason).toBe("FAIL-SERVICE-001");
    await expectZeroCanonicalMutation(harness);
  });

  it("R13(b): regulation producer returns an INVALID delta ⇒ fail closed, total +0", async () => {
    const regulation = new CapturingRegulationProducer({ kind: "invalid-delta" });
    const harness = await buildTimeHarness({ regulationProducer: regulation });
    const outcomeOrError: unknown = await harness.executor
      .execute(
        ctxOf(harness.initial),
        { elapsed_ticks: 5 },
        await timeCapabilities(harness.initial, 5)
      )
      .then((result) => result, (e) => e);
    // Whatever rejection mechanism fires, NO canonical mutation may survive.
    if (outcomeOrError !== null && typeof outcomeOrError === "object" && "kind" in outcomeOrError) {
      expect(outcomeOrError.kind).not.toBe("COMMITTED");
    }
    expect(regulation.calls).toBe(1);
    await expectZeroCanonicalMutation(harness);
  });

  it("R14: replay — isolated harnesses give identical fingerprint, state bytes and trace hashes", async () => {
    async function isolatedRun(ticks: number) {
      const harness = await buildTimeHarness();
      // Deterministically rebuild the equivalent proposal from the same real
      // producers before executing (the executor builds a byte-equal one).
      const affectDelta = await new ReferenceFastEmaAffectProducer().produceAffectDelta({
        context: ctxOf(harness.initial),
        snapshot: harness.initial,
        transition_type: "Time",
        appraisal: null,
        elapsed_ticks: ticks
      });
      const regulationDelta = await new ReferenceRegulationV0Producer().produceRegulationDelta({
        context: ctxOf(harness.initial),
        regulation: harness.initial.regulation,
        elapsed_ticks: ticks
      });
      const proposal = buildTimeProposal("subject-s0", 0, ticks, affectDelta, regulationDelta);
      const outcome = await harness.executor.execute(
        ctxOf(harness.initial),
        { elapsed_ticks: ticks },
        await capabilitiesFor(proposal)
      );
      if (outcome.kind !== "COMMITTED") throw new Error(`expected COMMITTED, got ${outcome.kind}`);
      return { outcome, proposal };
    }

    const a = await isolatedRun(100);
    const b = await isolatedRun(100);
    // Same canonical proposal ⇒ same fingerprint (HASH-DET-001).
    expect(await proposalFingerprint(a.proposal)).toBe(await proposalFingerprint(b.proposal));
    // Same successor state bytes ⇒ identical trace identities.
    expect(JSON.stringify(a.outcome.bundle.next_snapshot)).toBe(
      JSON.stringify(b.outcome.bundle.next_snapshot)
    );
    const entryA = a.outcome.bundle.next_snapshot.trace_window.entries[0];
    const entryB = b.outcome.bundle.next_snapshot.trace_window.entries[0];
    if (entryA === undefined || entryB === undefined) throw new Error("expected trace entries");
    expect(entryA.state_hash_after).toBe(entryB.state_hash_after);
    expect(entryA.transition_id).toBe(entryB.transition_id);
  });
});
