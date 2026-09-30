/* eslint-disable no-restricted-imports -- Isolated harness over frozen built production surfaces (repository convention); no production semantics are copied. */
/**
 * §12/§14 REGRESSION — fail closed WITHOUT session poisoning.
 *
 *   npx vitest run research/north-star/history-internalization/phase-0/remediation
 *
 * 0 model calls. Stub transports only. No production change.
 *
 * The suite pins BOTH halves of the finding:
 *   (1) the baseline defect is real — an unwrapped session genuinely poisons itself, and the
 *       next VALID turn dies with a misleading ingress CONFLICT;
 *   (2) the wrapper fixes exactly that and nothing else — the invalid turn is STILL invalid,
 *       still fail-closed, and still recorded as a lost step.
 */

import { describe, expect, it } from "vitest";

import {
  InteractiveSubjectRuntimeV0,
  type ModelTransportResponseV0,
  type ModelTransportV0
} from "../../../../../packages/runtime/dist/index.js";

import { P0_SUBJECT_A_ID } from "../contract.ts";
import { buildPhase0SourceV0 } from "../fixtures.ts";
import type { Phase0AppraisalProviderV0 } from "../harness.ts";
import { RecoveredSessionV0 } from "./recovered-session.ts";

type ScriptedTurn = "VALID" | "INVALID_STANCE";

const VALID_TEXT = "a valid message";
const VALID_FOLLOW_UP = "a valid follow-up message";

function validProposal(): Record<string, unknown> {
  return {
    response_semantics: { kind: "PRIMARY_CONVERSATIONAL_ACT", act: "ACKNOWLEDGE" },
    schema_version: "conversation-cognition-proposal-v8",
    subjective_selection: { kind: "NO_SUBJECTIVE_SELECTION" },
    factual_assessment: { claims: [] },
    cognition: {
      schema_version: "cognition-proposal-v0",
      reasoning_summary: "offline stub cognition",
      relevant_memory_handles: [],
      considered_handles: [],
      current_intent: "respond to the user",
      confidence: 0.7,
      uncertainty: 0.3,
      action_intent: null,
      evidence_handles: []
    },
    communication_directive: { kind: "REALIZE_CURRENT_INTENT" },
    clarification_basis: null
  };
}

/** Structurally valid, semantically incomplete — the exact production rule at :1909. */
function invalidStanceProposal(): Record<string, unknown> {
  const proposal = validProposal();
  proposal["response_semantics"] = { kind: "PRIMARY_STANCE" };
  return proposal;
}

interface Harness {
  readonly transports: {
    cognition: ModelTransportV0;
    language: ModelTransportV0;
    appraisal: Phase0AppraisalProviderV0;
  };
  readonly services: {
    setScript: (script: readonly ScriptedTurn[]) => void;
    readonly calls: string[];
  };
}

/** One shared stub world per test: the script advances per COGNITION call. */
function harness(): { bundleFor: () => never; world: Harness } {
  let script: readonly ScriptedTurn[] = ["VALID"];
  let cursor = 0;
  const calls: string[] = [];

  const cognition: ModelTransportV0 = {
    complete: async (): Promise<ModelTransportResponseV0> => {
      calls.push("cognition");
      const scripted = script[cursor] ?? "VALID";
      cursor += 1;
      const body = scripted === "VALID" ? validProposal() : invalidStanceProposal();
      return { content: JSON.stringify(body), model: "stub" } as ModelTransportResponseV0;
    }
  };
  const language: ModelTransportV0 = {
    complete: async (): Promise<ModelTransportResponseV0> => {
      calls.push("language");
      return {
        content: JSON.stringify({ schema_version: "language-realization-semantic-draft-v1", text: "STUB_REPLY", evidence_refs: [] }),
        model: "stub"
      } as ModelTransportResponseV0;
    }
  };
  const appraisal = {
    proposeFactualEventAppraisal: async (context: never) => {
      const ctx = context as unknown as { subject_id: string; factual_event_ref: string; context_projection_hash: string };
      return {
        schema_version: "factual-event-appraisal-proposal-v0",
        status: "APPRAISED",
        subject_id: ctx.subject_id,
        factual_event_ref: ctx.factual_event_ref,
        context_projection_hash: ctx.context_projection_hash,
        dimensions: { relevance: 0.6, goal_congruence: 0.5, attribution: "other", controllability: 0.5, uncertainty: 0.5, intensity: 0.4 },
        assessment_confidence: 0.6,
        evidence_refs: [ctx.factual_event_ref].sort()
      };
    }
  } as unknown as Phase0AppraisalProviderV0;

  const world: Harness = {
    transports: { cognition, language, appraisal },
    services: {
      setScript: (next) => {
        script = next;
        cursor = 0;
      },
      calls
    }
  };
  return { bundleFor: () => ({}) as never, world };
}

function runtimeOptions(
  transports: Harness["transports"],
  sessionId: string
): Parameters<typeof InteractiveSubjectRuntimeV0.create>[0] {
  return {
    subject: { subject_id: P0_SUBJECT_A_ID, display_name: "Wren", identity_anchors: [] },
    v3_source: buildPhase0SourceV0(P0_SUBJECT_A_ID),
    conversationCognitionTransport: transports.cognition,
    languageTransport: transports.language,
    factualEventAppraisalProvider: transports.appraisal,
    session_id: sessionId
  } as Parameters<typeof InteractiveSubjectRuntimeV0.create>[0];
}

describe("PHASE0 fail-closed session poisoning", () => {
  it("BASELINE: an unwrapped session poisons itself, and the next VALID turn dies at ingress with a misleading error", async () => {
    const { world } = harness();
    world.services.setScript(["VALID", "INVALID_STANCE", "VALID"]);
    const runtime = await InteractiveSubjectRuntimeV0.create(runtimeOptions(world.transports, "session-baseline"));

    const turn0 = await runtime.submitUserText(VALID_TEXT);
    expect(turn0.status).toBe("COMPLETE");

    const turn1 = await runtime.submitUserText("a message whose response is semantically incomplete");
    expect(turn1.status).toBe("FAILED");
    expect(String(turn1.failure)).toContain("SEMANTIC_COMPLETENESS_FAILED");

    // The defect: an INDEPENDENT, valid turn is rejected, and blamed on the ingress.
    const turn2 = await runtime.submitUserText(VALID_FOLLOW_UP);
    expect(turn2.status).toBe("FAILED");
    expect(String(turn2.failure)).toContain("ingress must record (CONFLICT)");
  });

  it("FIXED (STOP): the invalid turn is still fail-closed, and no turn is ever sent into the poisoned session", async () => {
    const { world } = harness();
    world.services.setScript(["VALID", "INVALID_STANCE", "VALID"]);
    const session = await RecoveredSessionV0.open(runtimeOptions(world.transports, "session-stop"), "STOP");

    expect((await session.submitTurn(VALID_TEXT)).status).toBe("COMPLETE");

    const invalid = await session.submitTurn("a message whose response is semantically incomplete");
    // The fix does NOT turn the invalid turn into a success.
    expect(invalid.status).toBe("FAILED");
    expect(invalid.failure_class).toBe("EXECUTOR_SCHEMA_INVALID");
    expect(session.requiresRecovery).toBe(true);

    const after = await session.submitTurn(VALID_FOLLOW_UP);
    // The next turn is refused LOCALLY with a truthful condition, never sent to die at ingress.
    expect(after.status).toBe("REFUSED_SESSION_REQUIRES_RECOVERY");
    expect(after.failure_class).toBe("SESSION_REQUIRES_RECOVERY");
    expect(String(after.failure)).toContain("SESSION_REQUIRES_RECOVERY");
    expect(world.services.calls.filter((call) => call === "cognition").length).toBe(2);
  });

  it("FIXED (RESTORE_AND_CONTINUE): a valid turn after an invalid one reaches its normal execution path", async () => {
    const { world } = harness();
    world.services.setScript(["VALID", "INVALID_STANCE", "VALID"]);
    const session = await RecoveredSessionV0.open(runtimeOptions(world.transports, "session-recover"), "RESTORE_AND_CONTINUE");

    expect((await session.submitTurn(VALID_TEXT)).status).toBe("COMPLETE");

    const invalid = await session.submitTurn("a message whose response is semantically incomplete");
    expect(invalid.status).toBe("FAILED");
    expect(invalid.failure_class).toBe("EXECUTOR_SCHEMA_INVALID");
    expect(session.requiresRecovery).toBe(true);

    const recovered = await session.submitTurn(VALID_FOLLOW_UP);
    // §14: the THIRD turn must reach its normal validation/execution path.
    expect(recovered.status).toBe("COMPLETE");
    expect(recovered.failure_class).toBe("NONE");
    // …and the recovery must be visible, never silent.
    expect(session.requiresRecovery).toBe(false);
    // The invalid turn is still on the record as invalid.
    expect(session.history.map((entry) => entry.status)).toEqual(["COMPLETE", "FAILED", "COMPLETE"]);
  });

  it("the wrapper never invents semantics: the invalid turn's canonical writes are not upgraded into a commit", async () => {
    const { world } = harness();
    world.services.setScript(["VALID", "INVALID_STANCE"]);
    const session = await RecoveredSessionV0.open(runtimeOptions(world.transports, "session-nocoerce"), "STOP");

    await session.submitTurn(VALID_TEXT);
    const invalid = await session.submitTurn("a message whose response is semantically incomplete");

    expect(invalid.status).toBe("FAILED");
    // No fabricated behaviour text, no fabricated delivery: the wrapper exposes none.
    expect(invalid.behaviour).toBeNull();
    expect(invalid.recovered_over_a_lost_turn).toBe(false);
  });
});
