/**
 * P2.3.3.2 — shared transition-executor helpers (pure).
 */

import type { SubjectStateV0 } from "@characteros-next/subject-core";
import type { RuntimeContext } from "../types/runtime-context.js";

/** Pre-proposal fail-closed error carrying the frozen code/reason contract text. */
export function preProposalError(code: string, reason: string, detail: string): Error {
  return new Error(`${code}/${reason}: ${detail}`);
}

/**
 * Anchors a RuntimeContext to authoritative snapshot truth; any drift rejects
 * fail-closed so executors can never operate on a stale authority view.
 */
export function anchorContext(ctx: RuntimeContext, snapshot: SubjectStateV0): RuntimeContext {
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
    throw preProposalError(
      "INVARIANT_VIOLATION",
      "SS-SCHEMA-001",
      `runtime context drift: ctx(${ctx.subject_id},${ctx.current_logical_time},${ctx.state_revision}) vs authority(${anchored.subject_id},${anchored.current_logical_time},${anchored.state_revision})`
    );
  }
  return anchored;
}
