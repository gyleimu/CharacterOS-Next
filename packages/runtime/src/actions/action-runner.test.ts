/**
 * P2-next — Action Execution / Outcome V0 acceptance suite (A1–A20).
 * Deterministic sandbox world only; fully offline; no real model.
 */

import { describe, expect, it } from "vitest";

import type { SubjectStateV0 } from "@characteros-next/subject-core";
import { s0 } from "../transitions/observation/observation-fixtures.js";
import { buildCognitiveContextProjection } from "../transitions/cognition-action/cognition-action-transition-executor.js";
import type { CognitionProposalV0 } from "../transitions/cognition-action/types.js";
import { InMemoryActionExecutionLedger } from "./action-executor-port.js";
import { ActionExecutionRunner } from "./action-runner.js";
import { DeterministicSandboxWorldV0 } from "./sandbox-world.js";
import { deriveExecutionId } from "./types.js";

const SUBJECT_ID = "subject-s0";
const COG_TRANSITION = "t-cog-test";
const INTENT = { action_type: "ACCEPT", target_ref: "entity:person-x" } as never;

/** Builds a validated cognition proposal carrying the given intent (or none). */
async function proposalWithIntent(
  intent: { action_type: string; target_ref: string | null } | null
): Promise<CognitionProposalV0> {
  const projection = await buildCognitiveContextProjection(
    s0() as unknown as SubjectStateV0
  );
  return {
    schema_version: "cognition-proposal-v0",
    projection_hash: projection.projection_hash,
    reasoning_summary: "test",
    relevant_memory_refs: [],
    considered_context_refs: [],
    current_intent: intent === null ? null : "test-intent",
    confidence: 0.5,
    uncertainty: 0.5,
    action_intent: intent as never,
    evidence_refs: []
  };
}

describe("P2-next Action Execution / Outcome V0", () => {
  it("A1/A4: valid allowed ActionIntent reaches executor and produces factual EXECUTED Outcome", async () => {
    const world = new DeterministicSandboxWorldV0();
    const ledger = new InMemoryActionExecutionLedger();
    const runner = new ActionExecutionRunner(world.executor(), ledger);
    const proposal = await proposalWithIntent(INTENT);
    const result = await runner.run({
      subjectId: SUBJECT_ID,
      cognitionTransitionId: COG_TRANSITION,
      proposal,
      logicalTime: 50 as never
    });
    expect(result.kind).toBe("EXECUTED");
    if (result.kind !== "EXECUTED") return;
    expect(result.replayed).toBe(false);
    expect(result.outcome.status).toBe("EXECUTED");
    expect(result.outcome.action_type).toBe("ACCEPT");
    expect(world.postureOf("entity:person-x").accepted).toBe(true);
    expect(result.outcome.effect_refs.length).toBe(1);
    expect(result.outcome.effect_refs[0]).toContain("world-effect:");
  });

  it("A2 (A9): NO_ACTION does not invoke the executor", async () => {
    const world = new DeterministicSandboxWorldV0();
    const ledger = new InMemoryActionExecutionLedger();
    let calls = 0;
    const counting = world.executor();
    const wrapped = {
      execute: async (...args: Parameters<typeof counting.execute>) => {
        calls += 1;
        return counting.execute(...args);
      }
    };
    const runner = new ActionExecutionRunner(wrapped, ledger);
    const proposal = await proposalWithIntent(null);
    const result = await runner.run({
      subjectId: SUBJECT_ID,
      cognitionTransitionId: COG_TRANSITION,
      proposal,
      logicalTime: 0 as never
    });
    expect(result.kind).toBe("NO_ACTION");
    expect(calls).toBe(0);
  });

  it("A3/A6 (C6 complement): unsupported action type is REJECTED by the sandbox, never executed", async () => {
    const world = new DeterministicSandboxWorldV0();
    const ledger = new InMemoryActionExecutionLedger();
    const runner = new ActionExecutionRunner(world.executor(), ledger);
    const proposal = await proposalWithIntent({
      action_type: "shell_exec",
      target_ref: null
    });
    const result = await runner.run({
      subjectId: SUBJECT_ID,
      cognitionTransitionId: COG_TRANSITION,
      proposal,
      logicalTime: 0 as never
    });
    if (result.kind !== "EXECUTED") throw new Error("expected factual outcome envelope");
    expect(result.outcome.status).toBe("REJECTED");
    expect(result.outcome.error?.code).toBe("ACTION_TYPE_NOT_IN_SANDBOX_WORLD");
    expect(world.producedEffects()).toHaveLength(0);
  });

  it("A5: executor-reported failure is a factual FAILED Outcome, not fabricated success", async () => {
    const failing = {
      execute: async () => ({
        schema_version: "action-outcome-v0",
        execution_id: "x-act-f",
        action_type: "ACCEPT",
        target_ref: null,
        status: "FAILED",
        effect_refs: [],
        world_observation_refs: [],
        error: { code: "WORLD_OFFLINE", detail: "sandbox world refused" },
        logical_time: 0 as never
      })
    };
    const runner = new ActionExecutionRunner(
      failing as never,
      new InMemoryActionExecutionLedger()
    );
    const result = await runner.run({
      subjectId: SUBJECT_ID,
      cognitionTransitionId: COG_TRANSITION,
      proposal: await proposalWithIntent(INTENT),
      logicalTime: 0 as never
    });
    if (result.kind !== "EXECUTED") throw new Error("expected factual envelope");
    expect(result.outcome.status).toBe("FAILED");
    expect(result.outcome.error?.code).toBe("WORLD_OFFLINE");
  });

  it("A11/A13: replay after recorded success reuses the ledger outcome (no duplicate effect)", async () => {
    const world = new DeterministicSandboxWorldV0();
    const ledger = new InMemoryActionExecutionLedger();
    let calls = 0;
    const inner = world.executor();
    const counting = {
      execute: async (
        intent: Parameters<typeof inner.execute>[0],
        context: Parameters<typeof inner.execute>[1]
      ) => {
        calls += 1;
        return inner.execute(intent, context);
      }
    };
    const runner = new ActionExecutionRunner(counting, ledger);
    const proposal = await proposalWithIntent(INTENT);
    const input = {
      subjectId: SUBJECT_ID,
      cognitionTransitionId: COG_TRANSITION,
      proposal,
      logicalTime: 50 as never
    };
    const first = await runner.run(input);
    const effectsAfterFirst = world.producedEffects().length;
    const second = await runner.run(input);
    expect(first.kind).toBe("EXECUTED");
    expect(second.kind).toBe("EXECUTED");
    if (second.kind === "EXECUTED") expect(second.replayed).toBe(true);
    expect(calls).toBe(1); // executor invoked exactly once across replay
    expect(world.producedEffects().length).toBe(effectsAfterFirst);
  });

  it("A12: same execution identity with changed fingerprint fails closed", async () => {
    const ledger = new InMemoryActionExecutionLedger();
    const runner = new ActionExecutionRunner(
      new DeterministicSandboxWorldV0().executor(),
      ledger
    );
    const executionId = await deriveExecutionId({
      subjectId: SUBJECT_ID,
      cognitionTransitionId: COG_TRANSITION,
      actionIntent: INTENT,
      executionOrdinal: 0
    });
    // A pre-existing record under this identity with a DIFFERENT intent
    // fingerprint (crash/replay corruption scenario): fail closed.
    await ledger.record({
      execution_id: executionId,
      intent_fingerprint: "fingerprint-of-a-different-intent",
      outcome: {
        schema_version: "action-outcome-v0",
        execution_id: executionId,
        action_type: "DECLINE",
        target_ref: null,
        status: "EXECUTED",
        effect_refs: [],
        world_observation_refs: [],
        error: null,
        logical_time: 0 as never
      }
    });
    const result = await runner.run({
      subjectId: SUBJECT_ID,
      cognitionTransitionId: COG_TRANSITION,
      proposal: await proposalWithIntent(INTENT),
      logicalTime: 0 as never
    });
    expect(result).toEqual({
      kind: "REJECTED_FAIL_CLOSED",
      reason: "EXECUTION_IDENTITY_CONFLICT"
    });
  });

  it("A7/A15: executor exception is thrown without fabricated Outcome; sandbox is repeatable", async () => {
    const crashing = {
      execute: async () => {
        throw new Error("executor crashed");
      }
    };
    const runner = new ActionExecutionRunner(
      crashing as never,
      new InMemoryActionExecutionLedger()
    );
    await expect(
      runner.run({
        subjectId: SUBJECT_ID,
        cognitionTransitionId: COG_TRANSITION,
        proposal: await proposalWithIntent(INTENT),
        logicalTime: 0 as never
      })
    ).rejects.toThrow("executor crashed");

    // A15: deterministic sandbox repeatability — two fresh worlds with the
    // same inputs produce identical effect refs.
    const w1 = new DeterministicSandboxWorldV0();
    const w2 = new DeterministicSandboxWorldV0();
    const o1 = await w1.executor().execute(INTENT, {
      execution_id: "x-act-same",
      subject_ref: null,
      logical_time: 0 as never
    });
    const o2 = await w2.executor().execute(INTENT, {
      execution_id: "x-act-same",
      subject_ref: null,
      logical_time: 0 as never
    });
    expect(o1.effect_refs).toEqual(o2.effect_refs);
    expect(w1.postureOf("entity:person-x")).toEqual(w2.postureOf("entity:person-x"));
  });

  it("A17: effect refs correspond only to real controlled world effects", async () => {
    const world = new DeterministicSandboxWorldV0();
    const outcome = await world.executor().execute(
      { action_type: "REQUEST_EVIDENCE", target_ref: "entity:person-x" } as never,
      { execution_id: "x-act-r", subject_ref: null, logical_time: 50 as never }
    );
    if (outcome.status !== "EXECUTED") throw new Error("expected EXECUTED");
    for (const ref of outcome.effect_refs) {
      expect(ref.startsWith("world-effect:x-act-r:")).toBe(true);
      expect(world.producedEffects()).toContain(ref);
    }
  });
});
