/* eslint-disable no-restricted-imports -- Isolated research harness over frozen built production surfaces (repository convention); no production semantics are copied. */
/**
 * §11 R1 PROBE — is the documented recovery path actually available?
 *
 *   npx tsx phase-0/remediation/reprobe-recovery.ts [outdir]
 *
 * The runtime's own FAILED branch documents the contract:
 *
 *   "Fail closed: no index advance, no fabricated delivery. The host must surface this and
 *    stop, or restore the last durable snapshot."
 *
 * This program tests whether that documented branch is REAL — i.e. whether restoring the last
 * durable snapshot actually returns the session to a state that accepts a valid turn. 0 model
 * calls, stub transports, no production change.
 *
 * If the documented recovery works, the remedy is host-side and needs no production change.
 * If it does not, the runtime has no working recovery path and the defect is architectural.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  InteractiveSubjectRuntimeV0,
  type ModelTransportResponseV0,
  type ModelTransportV0
} from "../../../../../packages/runtime/dist/index.js";

import { P0_SUBJECT_A_ID } from "../contract.ts";
import { buildPhase0SourceV0 } from "../fixtures.ts";
import type { Phase0AppraisalProviderV0 } from "../harness.ts";

let stubTurnIndex = 0;
const SCRIPT = ["VALID", "INVALID_STANCE", "VALID"] as const;

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

function cognition(): ModelTransportV0 {
  return {
    complete: async (): Promise<ModelTransportResponseV0> => {
      const scripted = SCRIPT[stubTurnIndex] ?? "VALID";
      const body = validProposal();
      if (scripted === "INVALID_STANCE") body["response_semantics"] = { kind: "PRIMARY_STANCE" };
      return { content: JSON.stringify(body), model: "stub" } as ModelTransportResponseV0;
    }
  } as ModelTransportV0;
}

function language(): ModelTransportV0 {
  return {
    complete: async (): Promise<ModelTransportResponseV0> =>
      ({
        content: JSON.stringify({ schema_version: "language-realization-semantic-draft-v1", text: "STUB_REPLY", evidence_refs: [] }),
        model: "stub"
      }) as ModelTransportResponseV0
  } as ModelTransportV0;
}

function appraisal(): Phase0AppraisalProviderV0 {
  return {
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
}

function options(sessionId: string): Parameters<typeof InteractiveSubjectRuntimeV0.create>[0] {
  return {
    subject: { subject_id: P0_SUBJECT_A_ID, display_name: "Wren", identity_anchors: [] },
    v3_source: buildPhase0SourceV0(P0_SUBJECT_A_ID),
    conversationCognitionTransport: cognition(),
    languageTransport: language(),
    factualEventAppraisalProvider: appraisal(),
    session_id: sessionId
  } as Parameters<typeof InteractiveSubjectRuntimeV0.create>[0];
}

async function main(): Promise<void> {
  const outdir = process.argv[2] ?? join(import.meta.dirname ?? ".", "evidence");
  mkdirSync(outdir, { recursive: true });
  const steps: Record<string, unknown>[] = [];

  const runtime = await InteractiveSubjectRuntimeV0.create(options("session-recovery-probe-0001"));

  // ---- establish a durable state so a snapshot can exist at all -------------------------------
  stubTurnIndex = 0;
  const turn0 = await runtime.submitUserText("opening message");
  const statusAfterTurn0 = await runtime.status();
  steps.push({ step: "turn_0_valid", status: turn0.status, turn_index: statusAfterTurn0.turn_index, state_revision: statusAfterTurn0.state_revision });

  // ---- capture the durable snapshot BEFORE the failing turn -----------------------------------
  let snapshotTaken = false;
  let snapshotNote = "";
  let snapshot: unknown = null;
  try {
    snapshot = await runtime.snapshot();
    snapshotTaken = true;
  } catch (error) {
    snapshotNote = error instanceof Error ? error.message : String(error);
  }
  steps.push({ step: "snapshot_before_failing_turn", taken: snapshotTaken, note: snapshotNote });

  // ---- the failing turn ----------------------------------------------------------------------
  stubTurnIndex = 1;
  const turn1 = await runtime.submitUserText("message whose executor response is semantically incomplete");
  const statusAfterTurn1 = await runtime.status();
  steps.push({
    step: "turn_1_invalid",
    status: turn1.status,
    failure: turn1.failure?.slice(0, 200) ?? null,
    turn_index: statusAfterTurn1.turn_index,
    state_revision: statusAfterTurn1.state_revision
  });

  // ---- PATH A: keep using the poisoned session (the run-1 behaviour) --------------------------
  stubTurnIndex = 2;
  const turn2 = await runtime.submitUserText("valid follow-up message");
  steps.push({
    step: "path_A_valid_turn_on_poisoned_session",
    status: turn2.status,
    failure: turn2.failure?.slice(0, 200) ?? null,
    completed: turn2.status === "COMPLETE"
  });

  // ---- PATH B: the DOCUMENTED recovery — restore the snapshot taken before the failing turn ----
  let pathB: Record<string, unknown> = { step: "path_B_restore_then_valid_turn", attempted: false };
  if (snapshotTaken) {
    try {
      const restored = await InteractiveSubjectRuntimeV0.restore(
        options("session-recovery-probe-0001"),
        snapshot as never
      );
      const restoredStatus = await restored.status();
      stubTurnIndex = 2;
      const turn2b = await restored.submitUserText("valid follow-up message");
      pathB = {
        step: "path_B_restore_then_valid_turn",
        attempted: true,
        restore_threw: false,
        restored_turn_index: restoredStatus.turn_index,
        restored_state_revision: restoredStatus.state_revision,
        valid_turn_status: turn2b.status,
        valid_turn_failure: turn2b.failure?.slice(0, 200) ?? null,
        completed: turn2b.status === "COMPLETE"
      };
    } catch (error) {
      pathB = {
        step: "path_B_restore_then_valid_turn",
        attempted: true,
        restore_threw: true,
        restore_error: error instanceof Error ? error.message.slice(0, 300) : String(error),
        completed: false
      };
    }
  }
  steps.push(pathB);

  const observations = {
    valid_turn_after_failure_on_poisoned_session_is_rejected: steps[3]?.["status"] === "FAILED",
    documented_recovery_available: pathB["attempted"] === true && pathB["restore_threw"] === false,
    documented_recovery_restores_a_usable_session: pathB["completed"] === true
  };
  const artifact = {
    scope: "0 model calls, stub transports, no production change",
    documented_contract:
      "interactive-subject-runtime-v0.ts FAILED branch: 'The host must surface this and stop, or restore the last durable snapshot.'",
    steps,
    observations,
    verdict: observations["documented_recovery_restores_a_usable_session"]
      ? "DOCUMENTED_RECOVERY_PATH_WORKS"
      : observations["documented_recovery_available"]
        ? "DOCUMENTED_RECOVERY_PATH_EXISTS_BUT_DOES_NOT_CLEAR_THE_POISONING"
        : "DOCUMENTED_RECOVERY_PATH_UNAVAILABLE"
  };
  writeFileSync(join(outdir, "PHASE0_RECOVERY_PROBE.json"), `${JSON.stringify(artifact, null, 2)}\n`, "utf8");

  console.log(`VERDICT: ${artifact.verdict}`);
  for (const step of steps) {
    const label = String(step["step"]);
    const note =
      step["completed"] !== undefined
        ? `completed=${String(step["completed"])}`
        : step["status"] !== undefined
          ? `status=${String(step["status"])}`
          : JSON.stringify(step).slice(0, 120);
    console.log(`  ${label}: ${note}`);
  }
  for (const [name, value] of Object.entries(observations)) console.log(`  ${value ? "yes" : "NO "}  ${name}`);
}

await main();
