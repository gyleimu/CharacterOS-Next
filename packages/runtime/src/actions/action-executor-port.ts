/**
 * P2-next — ActionExecutorV0 port + execution ledger (transition-contracts
 * §16/§25; the V0 external-effect boundary).
 *
 * The port is deliberately narrow and vendor-neutral: an adapter later maps
 * intents to browser/shell/tool backends — V0 ships ONLY the deterministic
 * sandbox world. The executor receives a controlled execution context and
 * returns a factual OutcomeV0; it can never see or touch SubjectState.
 *
 * The execution ledger is the narrow crash/replay authority: execution_id →
 * recorded outcome + intent fingerprint. Same identity + same fingerprint ⇒
 * replay returns the recorded outcome WITHOUT re-invoking the executor (no
 * duplicate external effect). Same identity + different fingerprint fails
 * closed. Crash windows where the ledger is process-local are EXPLICITLY
 * bounded V0 behavior: cross-process exactly-once/outbox semantics remain
 * DEFERRED by frozen contract (transition-contracts §25).
 */

import type { ActionExecutionContextV0, ActionOutcomeV0 } from "./types.js";
import type { ActionIntentV0 } from "../transitions/cognition-action/types.js";

export interface ActionExecutorV0 {
  execute(
    actionIntent: ActionIntentV0,
    context: ActionExecutionContextV0
  ): Promise<ActionOutcomeV0>;
}

/** A recorded execution: outcome + the exact intent fingerprint that ran. */
export interface ActionExecutionRecordV0 {
  readonly execution_id: string;
  readonly intent_fingerprint: string;
  readonly outcome: ActionOutcomeV0;
}

export interface ActionExecutionLedgerV0 {
  /** The recorded execution for this identity, or null when never executed. */
  lookup(executionId: string): Promise<ActionExecutionRecordV0 | null>;
  /** Durable record of a completed execution (create-if-absent). */
  record(record: ActionExecutionRecordV0): Promise<void>;
}

/** In-process durable reference ledger. */
export class InMemoryActionExecutionLedger implements ActionExecutionLedgerV0 {
  private readonly records = new Map<string, ActionExecutionRecordV0>();

  async lookup(executionId: string): Promise<ActionExecutionRecordV0 | null> {
    return this.records.get(executionId) ?? null;
  }

  async record(record: ActionExecutionRecordV0): Promise<void> {
    const existing = this.records.get(record.execution_id);
    if (existing !== undefined) {
      if (existing.intent_fingerprint !== record.intent_fingerprint) {
        throw new Error(
          `execution ledger corruption: ${record.execution_id} already recorded with a different intent fingerprint`
        );
      }
      return;
    }
    this.records.set(record.execution_id, record);
  }
}
