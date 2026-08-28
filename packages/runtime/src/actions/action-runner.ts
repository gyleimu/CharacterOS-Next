/**
 * P2-next — ActionExecutionRunner: the narrow orchestration between a
 * validated CognitionProposalV0 and the ActionExecutorV0 boundary
 * (transition-contracts §16/§20/§25; A9; task §11/§13/§14).
 *
 * Dispatch rules:
 *  - NO_ACTION (action_intent null) ⇒ the executor is NEVER invoked — a valid
 *    lifecycle result (A9);
 *  - execution identity is derived deterministically (subject + cognition
 *    transition + intent + ordinal) — NEVER the canonical transition identity;
 *  - ledger hit with matching intent fingerprint ⇒ replay returns the
 *    recorded outcome WITHOUT re-invoking the executor (no duplicate external
 *    effect);
 *  - ledger hit with a DIFFERENT fingerprint ⇒ fail closed;
 *  - executor-reported FAILED/REJECTED outcomes are recorded FACTUALLY as
 *    outcomes (the contract treats a failure record as factual), while an
 *    executor EXCEPTION (crash) is thrown — no fabricated success, no
 *    fabricated Outcome;
 *  - the runner holds NO canonical write authority of any kind.
 */

import type { CanonicalRefV0, LogicalTimeV0 } from "@characteros-next/subject-core";
import { hashEnvelope } from "@characteros-next/subject-core";
import type { CognitionProposalV0 } from "../transitions/cognition-action/types.js";
import type { ActionExecutorV0 } from "./action-executor-port.js";
import type { ActionExecutionLedgerV0 } from "./action-executor-port.js";
import {
  deriveExecutionId,
  type ActionExecutionContextV0,
  type ActionOutcomeV0
} from "./types.js";

export interface ActionRunnerInputV0 {
  /** The subject's identifier (for execution identity derivation only). */
  readonly subjectId: string;
  /** The cognition transition that produced this proposal (identity basis). */
  readonly cognitionTransitionId: string;
  /** The validated cognition proposal whose action_intent will dispatch. */
  readonly proposal: CognitionProposalV0;
  /** Controlled logical time carried into the execution context (not advanced). */
  readonly logicalTime: LogicalTimeV0;
}

export type ActionRunnerResultV0 =
  | {
      readonly kind: "NO_ACTION";
      /** Proof that the executor was never invoked. */
      readonly outcome: null;
    }
  | {
      readonly kind: "EXECUTED";
      readonly outcome: ActionOutcomeV0;
      /** True when served from the ledger (replay) instead of a new execution. */
      readonly replayed: boolean;
    }
  | {
      readonly kind: "REJECTED_FAIL_CLOSED";
      readonly reason: "EXECUTION_IDENTITY_CONFLICT";
    };

async function intentFingerprint(
  subjectId: string,
  cognitionTransitionId: string,
  intent: NonNullable<CognitionProposalV0["action_intent"]>
): Promise<string> {
  return hashEnvelope("characteros-next/actions/intent-fingerprint/v1", {
    subject_id: subjectId,
    cognition_transition_id: cognitionTransitionId,
    action_type: intent.action_type,
    target_ref: intent.target_ref
  });
}

export class ActionExecutionRunner {
  constructor(
    private readonly executor: ActionExecutorV0,
    private readonly ledger: ActionExecutionLedgerV0
  ) {}

  async run(input: ActionRunnerInputV0): Promise<ActionRunnerResultV0> {
    // ---- A9: NO_ACTION never reaches the executor --------------------------------
    const intent = input.proposal.action_intent;
    if (intent === null) {
      return { kind: "NO_ACTION", outcome: null };
    }

    // ---- deterministic execution identity (never the canonical transition id) ----
    const executionId = await deriveExecutionId({
      subjectId: input.subjectId,
      cognitionTransitionId: input.cognitionTransitionId,
      actionIntent: intent,
      executionOrdinal: 0
    });
    const fingerprint = await intentFingerprint(
      input.subjectId,
      input.cognitionTransitionId,
      intent
    );

    // ---- crash/replay boundary: ledger hit with SAME fingerprint ⇒ replay -------
    const recorded = await this.ledger.lookup(executionId);
    if (recorded !== null) {
      if (recorded.intent_fingerprint !== fingerprint) {
        // Same identity, changed payload ⇒ fail closed (A12).
        return { kind: "REJECTED_FAIL_CLOSED", reason: "EXECUTION_IDENTITY_CONFLICT" };
      }
      return { kind: "EXECUTED", outcome: recorded.outcome, replayed: true };
    }

    // ---- factual execution in the controlled world --------------------------------
    const context: ActionExecutionContextV0 = {
      execution_id: executionId,
      subject_ref: `subject:${input.subjectId}` as CanonicalRefV0,
      logical_time: input.logicalTime
    };
    const outcome = await this.executor.execute(intent, context);

    await this.ledger.record({ execution_id: executionId, intent_fingerprint: fingerprint, outcome });
    return { kind: "EXECUTED", outcome, replayed: false };
  }
}
