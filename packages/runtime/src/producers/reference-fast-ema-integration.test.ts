/**
 * P2.3.4.1 — reference FAST+EMA producer integration through the FROZEN
 * executors (no executor rewrite): A6 Time NO_OP, A11 Observation single atomic
 * commit, A12 Time canonical commit, A13 zero memory/retrieval/clock calls.
 * Host capability minting mirrors the executor's exact proposal so the prepared
 * binding fingerprint stays authoritative (Round-3 B1 semantics).
 */

import { describe, expect, it } from "vitest";

import type { DomainDeltaV0, SubjectStateV0 } from "@characteros-next/subject-core";
import { proposalFingerprint } from "@characteros-next/subject-core";
import type { MemoryPreparationAuthority } from "@characteros-next/memory";
import type { RuntimeContext } from "../types/runtime-context.js";
import type { AffectProducerPort } from "../ports/affect-producer-port.js";
import type { AppraisalProposalDraftV0 } from "../ports/appraisal-port.js";
import { RuntimeCompositionRoot } from "../composition/runtime-composition-root.js";
import { buildContextDelta } from "../ports/context-producer-port.js";
import {
  RealEngineCoreAdapter,
  buildObservationHarness,
  capabilitiesFor,
  observationInput,
  s0
} from "../transitions/observation/observation-fixtures.js";
import {
  buildObservationProposal
} from "../transitions/observation/observation-transition-executor.js";
import {
  TimeTransitionExecutor,
  buildTimeNoOpProposal,
  buildTimeProposal
} from "../transitions/time/time-transition-executor.js";
import { ReferenceFastEmaAffectProducer } from "./reference-fast-ema-affect-producer.js";

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

function fixedRegulation(): DomainDeltaV0 {
  return {
    producer: "regulation",
    domain: "regulation",
    expected_repository_revision: null,
    operations: [
      {
        path: "/regulation",
        value: { energy: 1, stress: 0.2, arousal: 0.5, fatigue: 0, last_update: null }
      }
    ],
    provenance_refs: []
  } as unknown as DomainDeltaV0;
}

function ctxOf(initial: SubjectStateV0): RuntimeContext {
  return {
    subject_id: "subject-s0" as never,
    current_logical_time: initial.runtime_metadata.logical_time as never,
    state_revision: initial.runtime_metadata.state_revision as never
  };
}

describe("ReferenceFastEmaAffectProducer × TimeTransitionExecutor", () => {
  async function buildTimeHarness(affectProducer?: AffectProducerPort) {
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
      affectProducer: affectProducer ?? new ReferenceFastEmaAffectProducer(),
      regulationProducer: { produceRegulationDelta: async () => fixedRegulation() }
    });
    return {
      core,
      memory,
      initial,
      retrievalCalls: () => retrievalCalls,
      executor: new TimeTransitionExecutor(root.dependencies())
    };
  }

  it("A6: elapsed = 0 routes to durable NO_OP without ever invoking the producer", async () => {
    let affectCalls = 0;
    const inner = new ReferenceFastEmaAffectProducer();
    const wrapped: AffectProducerPort = {
      produceAffectDelta: async (input) => {
        affectCalls += 1;
        return inner.produceAffectDelta(input);
      }
    };
    const { core, initial, executor } = await buildTimeHarness(wrapped);
    const outcome = await executor.execute(
      ctxOf(initial),
      { elapsed_ticks: 0 },
      await capabilitiesFor(buildTimeNoOpProposal("subject-s0", 0))
    );
    expect(outcome.kind).toBe("NO_OP");
    expect(affectCalls).toBe(0);
    expect(core.storeRead.getCommittedBundles()).toHaveLength(0);
    expect(core.storeRead.currentRevision("subject-s0")).toBeNull();
  });

  it("A12/A13: elapsed > 0 commits exactly once with deterministic decay and zero memory/retrieval calls", async () => {
    const { core, memory, initial, retrievalCalls, executor } = await buildTimeHarness();
    const ticks = 75;
    const affectDelta = await new ReferenceFastEmaAffectProducer().produceAffectDelta({
      context: ctxOf(initial),
      snapshot: initial,
      transition_type: "Time",
      appraisal: null,
      elapsed_ticks: ticks
    });
    const outcome = await executor.execute(
      ctxOf(initial),
      { elapsed_ticks: ticks },
      await capabilitiesFor(buildTimeProposal("subject-s0", 0, ticks, affectDelta, fixedRegulation()))
    );
    expect(outcome.kind).toBe("COMMITTED");
    if (outcome.kind !== "COMMITTED") return;
    expect(outcome.bundle.next_revision).toBe(1);
    expect(outcome.bundle.logical_time_before).toBe(0);
    expect(outcome.bundle.logical_time_after).toBe(ticks);
    expect(core.storeRead.getCommittedBundles()).toHaveLength(1);
    // S0 has no active channels and mood 0: passive evolution stays identity and
    // the commit carries the byte-identical affect/mood block (no fabricated drift).
    const next = outcome.bundle.next_snapshot;
    expect(next.affect.active_channels).toEqual([]);
    expect(next.mood.baseline).toBe(0);
    expect(next.runtime_metadata.last_transition_type).toBe("Time");
    // A13 runtime evidence: no memory writes, no retrieval, canonical clock only.
    expect(memory.prepareCalls).toBe(0);
    expect(memory.storeCalls).toBe(0);
    expect(retrievalCalls()).toBe(0);
  });
});

describe("ReferenceFastEmaAffectProducer × ObservationTransitionExecutor", () => {
  /**
   * Exact replica of the fixed appraisal draft the executor will pass to the
   * producer (fixedAppraisal(0.9) over observation o-77 with one selected ref).
   */
  function referenceObservationRun() {
    const observation = observationInput();
    const appraisal = {
      schema_version: "appraisal-v0",
      appraisal_ref: "appraisal:ap-observation-o-77",
      evidence_refs: ["episode:e-9"],
      relevance: 0.9,
      goal_congruence: 0.9,
      attribution: "situation",
      controllability: 0.9,
      uncertainty: 0.9,
      intensity: 0.9
    } as unknown as AppraisalProposalDraftV0;
    return { observation, appraisal };
  }

  async function buildReferenceObservationRun(harness: { ctx: RuntimeContext; initial: SubjectStateV0 }) {
    const producer = new ReferenceFastEmaAffectProducer();
    const { observation, appraisal } = referenceObservationRun();
    const affectDelta = await producer.produceAffectDelta({
      context: harness.ctx,
      snapshot: harness.initial,
      transition_type: "Observation",
      appraisal,
      elapsed_ticks: null
    });
    const contextDelta = await buildContextDelta(observation, harness.initial);
    const proposal = await buildObservationProposal({
      subjectId: "subject-s0",
      stateRevision: 0,
      observation,
      deltas: [affectDelta, contextDelta]
    });
    return { observation, appraisal, affectDelta, contextDelta, proposal };
  }

  it("I1/A11/A13: real producer commits affect + context in exactly one atomic canonical commit", async () => {
    const referenceProducer = new ReferenceFastEmaAffectProducer();
    const harness = buildObservationHarness({ affectProducer: referenceProducer });
    const { observation, proposal } = await buildReferenceObservationRun(harness);
    const outcome = await harness.executor.execute(harness.ctx, observation, await capabilitiesFor(proposal));
    expect(outcome.kind).toBe("COMMITTED");
    if (outcome.kind !== "COMMITTED") return;

    // Exactly one atomic canonical commit: +1 revision, one bundle, one trace entry.
    expect(outcome.bundle.next_revision).toBe(1);
    expect(harness.core.storeRead.getCommittedBundles()).toHaveLength(1);
    const next = outcome.bundle.next_snapshot;
    expect(next.trace_window.entries).toHaveLength(1);
    const traceEntry = next.trace_window.entries[0];
    if (traceEntry === undefined) throw new Error("expected one trace entry");
    expect(traceEntry.domain_mutations.map((m) => m.domain)).toEqual(["affect", "context"]);

    // FAST+EMA event step: joy channel at strength 0.9*0.9, mood EMA-derived.
    expect(next.affect.generated_under_profile).toBe("FAST_EMA_V0");
    expect(next.affect.active_channels).toHaveLength(1);
    const channel = next.affect.active_channels[0];
    if (channel === undefined) throw new Error("expected one active channel");
    expect(channel.channel_id).toBe("joy");
    expect(channel.intensity).toBe(0.9 * 0.9);
    expect(channel.phase).toBe("ACTIVE");
    expect(channel.source_appraisal_ref).toBe("appraisal:ap-observation-o-77");
    expect(next.mood.baseline).toBe(0.06 * (0.9 * 0.9 - 0));
    expect(next.mood.generated_under_profile).toBe("FAST_EMA_V0");
    expect(next.context.current_observation_ref).toBe("observation:o-77");

    // A13 runtime evidence: memory write surface never reached during Observation.
    expect(harness.memory.prepareCalls).toBe(0);
  });

  it("I5: replay — isolated harnesses yield identical fingerprint, state bytes and trace hashes", async () => {
    async function isolatedRun() {
      const harness = buildObservationHarness({ affectProducer: new ReferenceFastEmaAffectProducer() });
      const { observation, proposal } = await buildReferenceObservationRun(harness);
      const outcome = await harness.executor.execute(harness.ctx, observation, await capabilitiesFor(proposal));
      if (outcome.kind !== "COMMITTED") throw new Error(`expected COMMITTED, got ${outcome.kind}`);
      return { proposal, outcome };
    }

    const a = await isolatedRun();
    const b = await isolatedRun();

    // Same canonical proposal ⇒ same fingerprint (HASH-DET-001).
    expect(await proposalFingerprint(a.proposal)).toBe(await proposalFingerprint(b.proposal));
    // Same authoritative successor state bytes ⇒ same state hash by construction.
    expect(JSON.stringify(a.outcome.bundle.next_snapshot)).toBe(JSON.stringify(b.outcome.bundle.next_snapshot));
    const entryA = a.outcome.bundle.next_snapshot.trace_window.entries[0];
    const entryB = b.outcome.bundle.next_snapshot.trace_window.entries[0];
    if (entryA === undefined || entryB === undefined) throw new Error("expected trace entries");
    expect(entryA.state_hash_after).toBe(entryB.state_hash_after);
    expect(entryA.transition_id).toBe(entryB.transition_id);
  });
});
