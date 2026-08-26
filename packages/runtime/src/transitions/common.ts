/**
 * P2.3 Pre-Learning P0-6 — shared transition-executor helpers (pure) + typed stage
 * failures (§23: stable structured failures; exception messages are never contract).
 */

import type { ErrorCode, RequirementId, SubjectStateV0 } from "@characteros-next/subject-core";
import type { RuntimeContext } from "../types/runtime-context.js";

export type TransitionStageName = "TIME" | "OBSERVATION" | "LEARNING";

/**
 * Stable typed transition failure: `error_code` + `reason` use frozen §13.2/§13.3
 * values; `stage` names the owning transition. `detail` is non-canonical diagnostics.
 * No new error codes are invented for ordinary failures.
 * `routing` carries an orchestrator-level routing signal (e.g. TIME_ADVANCE_REQUIRED)
 * that is NOT part of the canonical code namespace.
 */
export class TransitionStageFailure extends Error {
  readonly stage: TransitionStageName;
  readonly error_code: ErrorCode;
  readonly reason: RequirementId;
  readonly routing?: string | undefined;

  constructor(
    stage: TransitionStageName,
    error_code: ErrorCode,
    reason: RequirementId,
    detail: string,
    options?: { cause?: unknown; routing?: string | undefined }
  ) {
    super(`${error_code}/${reason}: ${detail}`, options);
    this.name = "TransitionStageFailure";
    this.stage = stage;
    this.error_code = error_code;
    this.reason = reason;
    this.routing = options?.routing;
  }
}

/** Factory for pre-proposal / orchestration-stage fail-closed errors. */
export function stageFailure(
  stage: TransitionStageName,
  error_code: ErrorCode,
  reason: RequirementId,
  detail: string
): TransitionStageFailure {
  return new TransitionStageFailure(stage, error_code, reason, detail);
}

/**
 * Anchors a RuntimeContext to authoritative snapshot truth; any drift rejects
 * fail-closed so executors can never operate on a stale authority view.
 */
export function anchorContext(
  ctx: RuntimeContext,
  snapshot: SubjectStateV0,
  stage: TransitionStageName
): RuntimeContext {
  const rm = snapshot.runtime_metadata;
  const anchored: RuntimeContext = {
    subject_id: snapshot.identity.subject_id,
    current_logical_time: rm.logical_time,
    state_revision: rm.state_revision
  };
  if (
    ctx.subject_id !== anchored.subject_id ||
    ctx.current_logical_time !== anchored.current_logical_time ||
    ctx.state_revision !== anchored.state_revision
  ) {
    throw stageFailure(
      stage,
      "INVARIANT_VIOLATION",
      "SS-SCHEMA-001",
      `runtime context drift: ctx(${ctx.subject_id},${ctx.current_logical_time},${ctx.state_revision}) vs authority(${anchored.subject_id},${anchored.current_logical_time},${anchored.state_revision})`
    );
  }
  return anchored;
}

/** Raw elapsed admission (freeze §7.1 pre-proposal rules). */
export function admitElapsedTicks(stage: TransitionStageName, elapsedTicks: number): void {
  if (typeof elapsedTicks !== "number" || !Number.isFinite(elapsedTicks) || !Number.isInteger(elapsedTicks)) {
    throw stageFailure(stage, "INVALID_SCHEMA", "SS-SCHEMA-001", "elapsed_ticks must be an integer");
  }
  if (elapsedTicks < 0) {
    throw stageFailure(stage, "INVALID_LOGICAL_TIME", "TIME-ADVANCE-001", "elapsed_ticks must be >= 0");
  }
  if (elapsedTicks > Number.MAX_SAFE_INTEGER) {
    throw stageFailure(
      stage,
      "INVALID_LOGICAL_TIME",
      "TIME-ADVANCE-001",
      "elapsed_ticks overflows safe integer domain"
    );
  }
}
