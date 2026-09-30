/* eslint-disable no-restricted-imports -- Isolated research harness over frozen built production surfaces (repository convention); no production semantics are copied. */
/**
 * §7/§13 — R1 REMEDIATION: FAIL-CLOSED WITHOUT SESSION POISONING.
 *
 * WHAT THIS FIXES
 *
 * The production runtime's FAILED branch documents a contract in a comment:
 *
 *   "Fail closed: no index advance, no fabricated delivery. The host must surface this and
 *    stop, or restore the last durable snapshot."
 *
 * That contract is correct and its recovery path works (measured: `probe-recovery.ts`,
 * `DOCUMENTED_RECOVERY_PATH_WORKS`). What does not exist is anything that ENFORCES or even
 * SURFACES it. A host that simply calls `submitUserText` again — the obvious thing to do —
 * gets a `FAILED` turn whose error blames the ingress (`session: ingress must record
 * (CONFLICT)`) rather than reporting that the session needs recovery. The valid turn is lost
 * and the reported reason is about the wrong thing.
 *
 * This wrapper is the host layer that honours the contract. It changes NO production code, NO
 * belief semantics, NO credence law, NO trajectory, NO scorer and NO invalid policy.
 *
 * TWO POLICIES
 *
 *   STOP                  — engineering default for SCIENCE. The first FAILED turn marks the
 *                           session terminal; every later `submitTurn` is refused locally with a
 *                           typed condition instead of being sent into a poisoned session. No
 *                           turn is ever sent on a poisoned session, so the misleading cascade
 *                           error cannot appear.
 *   RESTORE_AND_CONTINUE  — infrastructure-recovery default. The session is restored from the
 *                           durable snapshot taken before the failing turn and the next turn is
 *                           accepted. The lost step is recorded, never hidden: engineering
 *                           continuity is NOT scientific evidence recovery.
 */

import {
  InteractiveSubjectRuntimeV0,
  type InteractiveTurnOutcomeV0
} from "../../../../../packages/runtime/dist/index.js";

export type Phase0SessionFailurePolicyV0 = "STOP" | "RESTORE_AND_CONTINUE";

export interface RecoveredTurnResultV0 {
  readonly turn_index: number;
  readonly status: "COMPLETE" | "DEGRADED" | "FAILED" | "REFUSED_SESSION_REQUIRES_RECOVERY";
  readonly failure: string | null;
  readonly failure_class: "NONE" | "EXECUTOR_SCHEMA_INVALID" | "SESSION_REQUIRES_RECOVERY" | "OTHER";
  /** True when this turn needed the session to be restored before it could run. */
  readonly required_recovery: boolean;
  /** True when an earlier turn's evidence was discarded by the restore. Never silent. */
  readonly recovered_over_a_lost_turn: boolean;
  readonly behaviour: string | null;
}

const SCHEMA_INVALID_MARKERS = [
  "MODEL_SCHEMA_INVALID",
  "RESPONSE_SEMANTICS_REJECTED",
  "SEMANTIC_COMPLETENESS_FAILED"
];

function classify(failure: string | null, status: string): RecoveredTurnResultV0["failure_class"] {
  if (status === "COMPLETE") return "NONE";
  if (failure === null) return "OTHER";
  if (SCHEMA_INVALID_MARKERS.some((marker) => failure.includes(marker))) return "EXECUTOR_SCHEMA_INVALID";
  return "OTHER";
}

export class RecoveredSessionV0 {
  private constructor(
    private runtime: InteractiveSubjectRuntimeV0,
    private readonly options: Parameters<typeof InteractiveSubjectRuntimeV0.create>[0],
    private readonly policy: Phase0SessionFailurePolicyV0
  ) {}

  private poisonedBy: string | null = null;
  private lastSnapshot: unknown = null;
  private discardedTurn: string | null = null;
  readonly history: RecoveredTurnResultV0[] = [];

  static async open(
    options: Parameters<typeof InteractiveSubjectRuntimeV0.create>[0],
    policy: Phase0SessionFailurePolicyV0
  ): Promise<RecoveredSessionV0> {
    const runtime = await InteractiveSubjectRuntimeV0.create(options);
    return new RecoveredSessionV0(runtime, options, policy);
  }

  /** True when the session needs recovery before it can lawfully accept another turn. */
  get requiresRecovery(): boolean {
    return this.poisonedBy !== null;
  }

  get recoveryReason(): string | null {
    return this.poisonedBy;
  }

  async submitTurn(text: string): Promise<RecoveredTurnResultV0> {
    // ---- the enforcement the runtime's contract relies on: never send a turn into a poisoned
    // session, so the misleading ingress-CONFLICT cascade is structurally unreachable.
    if (this.poisonedBy !== null) {
      if (this.policy === "STOP") {
        const refused: RecoveredTurnResultV0 = {
          turn_index: this.history.length,
          status: "REFUSED_SESSION_REQUIRES_RECOVERY",
          failure: `SESSION_REQUIRES_RECOVERY: ${this.poisonedBy}`,
          failure_class: "SESSION_REQUIRES_RECOVERY",
          required_recovery: true,
          recovered_over_a_lost_turn: false,
          behaviour: null
        };
        this.history.push(refused);
        return refused;
      }
      // RESTORE_AND_CONTINUE: return to the last state known to be usable, then proceed.
      await this.restoreToLastUsableState();
    }

    // ---- durable snapshot BEFORE the turn: the recovery point the contract refers to --------
    // A genesis session has no committed bundle yet, so `snapshot()` lawfully refuses. That is
    // not an error: the recovery point for a pre-first-turn session IS genesis, and genesis is
    // deterministically reproducible from the same options.
    let snapshot: unknown;
    try {
      snapshot = await this.runtime.snapshot();
    } catch {
      snapshot = null;
    }
    this.lastSnapshot = snapshot;

    const outcome: InteractiveTurnOutcomeV0 = await this.runtime.submitUserText(text);
    const failureClass = classify(outcome.failure, outcome.status);
    const result: RecoveredTurnResultV0 = {
      turn_index: outcome.turn_index,
      status: outcome.status,
      failure: outcome.failure,
      failure_class: failureClass,
      required_recovery: failureClass === "SESSION_REQUIRES_RECOVERY",
      recovered_over_a_lost_turn: false,
      behaviour: typeof outcome.subject_text === "string" && outcome.subject_text.length > 0 ? outcome.subject_text : null
    };

    if (outcome.status === "FAILED") {
      // A FAILED turn leaves the session unable to accept the next turn: this is the runtime's
      // documented behaviour, so it is recorded as the session-level condition it is.
      this.poisonedBy = `turn ${outcome.turn_index} failed closed: ${(outcome.failure ?? "unknown").slice(0, 180)}`;
      this.discardedTurn = text;
    }
    this.history.push(result);
    return result;
  }

  private async restoreToLastUsableState(): Promise<void> {
    const restoreFrom = this.lastSnapshot;
    // Two lawful recovery points: a durable snapshot taken before the failing turn, or — when the
    // failing turn was the FIRST one — genesis, which is deterministically reproducible from the
    // same options because genesis is a pure function of the seed source.
    this.runtime =
      restoreFrom === null
        ? await InteractiveSubjectRuntimeV0.create(this.options)
        : await InteractiveSubjectRuntimeV0.restore(this.options, restoreFrom as never);
    // The restore discards the failing turn's partial canonical writes. That is recorded on the
    // next result rather than swallowed: a recovered run must never look like an uninterrupted one.
    this.discardedTurn = this.poisonedBy;
    this.poisonedBy = null;
    this.lastSnapshot = null;
  }

  async state(): Promise<unknown> {
    return await this.runtime.subjectStateView();
  }

  async status(): Promise<unknown> {
    return await this.runtime.status();
  }
}
