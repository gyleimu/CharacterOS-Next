/**
 * P2-next — Action Execution / Outcome V0 types
 * (transition-contracts §16 pipeline tail, §20 composition, §25 external
 * side-effects boundary).
 *
 * ACTION EXECUTION = a factual, external-to-SubjectState step:
 *
 *   ActionIntentV0 (declaration, already validated against AllowedActionV0)
 *     → ActionExecutorV0 (narrow vendor-neutral port)
 *       → controlled World adapter (deterministic sandbox in V0)
 *         → OutcomeV0 (what ACTUALLY happened — never fabricated by an LLM)
 *
 * AUTHORITY:
 *  - the executor/world can NEVER mutate SubjectState, memory, affect, mood,
 *    personality, beliefs, relationships, trace, revision or logical time —
 *    it receives a controlled execution context only;
 *  - Outcome is a factual record of the controlled world, kept SEPARATE from
 *    canonical state; future subjective effects re-enter only through
 *    authorized transitions (Outcome → Experience → LearningTransition);
 *  - NO_ACTION (absence of an ActionIntent) never reaches the executor.
 */

import type { CanonicalRefV0, LogicalTimeV0 } from "@characteros-next/subject-core";
import {
  fail,
  hashEnvelope,
  isRecord,
  isString,
  ok,
  type ValidationResult
} from "@characteros-next/subject-core";
import type { ActionIntentV0 } from "../transitions/cognition-action/types.js";

export const ACTION_OUTCOME_SCHEMA_VERSION = "action-outcome-v0" as const;
export const ACTION_EXECUTION_ID_PROJECTION =
  "characteros-next/actions/execution-id/v1" as const;

/** Factual execution statuses (executor-reported; never LLM-fabricated). */
export type ActionOutcomeStatusV0 = "EXECUTED" | "FAILED" | "REJECTED";

/**
 * §8 — the minimum factual record of what actually happened in the
 * controlled world. Produced ONLY by an ActionExecutorV0 / world adapter.
 */
export interface ActionOutcomeV0 {
  readonly schema_version: typeof ACTION_OUTCOME_SCHEMA_VERSION;
  readonly execution_id: string;
  readonly action_type: string;
  readonly target_ref: CanonicalRefV0 | null;
  readonly status: ActionOutcomeStatusV0;
  /** Real controlled-world effects produced by THIS execution. */
  readonly effect_refs: readonly CanonicalRefV0[];
  /** World observation refs produced by THIS execution. */
  readonly world_observation_refs: readonly CanonicalRefV0[];
  /** Factual failure metadata when status != EXECUTED. */
  readonly error: { readonly code: string; readonly detail: string } | null;
  /** Logical time of the controlled execution context (not a time advance). */
  readonly logical_time: LogicalTimeV0;
}

const OUTCOME_KEYS: readonly string[] = [
  "schema_version",
  "execution_id",
  "action_type",
  "target_ref",
  "status",
  "effect_refs",
  "world_observation_refs",
  "error",
  "logical_time"
];

/** Closed-shape validation of an executor-produced outcome. */
export function validateActionOutcome(v: unknown): ValidationResult<ActionOutcomeV0> {
  if (!isRecord(v)) return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "action outcome: expected object");
  for (const key of Object.keys(v)) {
    if (!OUTCOME_KEYS.includes(key)) {
      return fail("INVALID_SCHEMA", "SS-SCHEMA-001", `action outcome.${key}: unknown key (closed shape)`);
    }
  }
  if (v["schema_version"] !== ACTION_OUTCOME_SCHEMA_VERSION) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "action outcome.schema_version");
  }
  if (!isString(v["execution_id"]) || v["execution_id"].length === 0) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "action outcome.execution_id: nonempty string");
  }
  if (!isString(v["action_type"]) || v["action_type"].length === 0) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "action outcome.action_type: nonempty string");
  }
  if (v["status"] !== "EXECUTED" && v["status"] !== "FAILED" && v["status"] !== "REJECTED") {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "action outcome.status: EXECUTED|FAILED|REJECTED");
  }
  if (!Array.isArray(v["effect_refs"]) || !Array.isArray(v["world_observation_refs"])) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "action outcome refs: arrays required");
  }
  if (v["status"] === "EXECUTED" && v["error"] !== null) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "action outcome: EXECUTED must not carry error");
  }
  if (v["status"] !== "EXECUTED" && !isRecord(v["error"])) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "action outcome: non-EXECUTED requires factual error");
  }
  return ok(v as unknown as ActionOutcomeV0);
}

/**
 * Controlled execution context handed to the executor. Deliberately tiny —
 * NO SubjectState, NO memory, NO journal, NO canonical anything.
 */
export interface ActionExecutionContextV0 {
  readonly execution_id: string;
  readonly subject_ref: CanonicalRefV0 | null;
  readonly logical_time: LogicalTimeV0;
}

/**
 * Deterministic execution identity (§11): derived from the subject, the exact
 * validated intent and the cognition transition that produced it. A changed
 * payload ⇒ a different identity; replay of the same identity hits the ledger.
 */
export async function deriveExecutionId(params: {
  readonly subjectId: string;
  readonly cognitionTransitionId: string;
  readonly actionIntent: ActionIntentV0;
  readonly executionOrdinal: number;
}): Promise<string> {
  const digest = await hashEnvelope(ACTION_EXECUTION_ID_PROJECTION, {
    subject_id: params.subjectId,
    cognition_transition_id: params.cognitionTransitionId,
    action_type: params.actionIntent.action_type,
    target_ref: params.actionIntent.target_ref,
    execution_ordinal: params.executionOrdinal
  });
  return `x-act-${digest.replace(/^sha256:/, "")}`;
}
