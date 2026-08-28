/**
 * P2-next — DeterministicSandboxWorldV0: the controlled in-memory world and
 * its executor adapter (transition-contracts §16 external execution tail;
 * task §6/§7/§15).
 *
 * The world is a plain map of typed entity postures, fully separate from
 * SubjectState. The executor applies ONLY typed allowed intents (WAIT /
 * ACCEPT / DECLINE / REQUEST_EVIDENCE in V0) with pure deterministic rules —
 * no shell, no browser, no network, no eval, no child_process, no clock.
 *
 * Same world state + same intent ⇒ same outcome (A15): effects are named
 * deterministically from the execution identity.
 */

import type { CanonicalRefV0, LogicalTimeV0 } from "@characteros-next/subject-core";
import type {
  ActionExecutionContextV0,
  ActionOutcomeV0
} from "./types.js";
import type { ActionExecutorV0 } from "./action-executor-port.js";
import type { ActionIntentV0 } from "../transitions/cognition-action/types.js";

/** The four V0 sandbox intents (task §6). */
export type SandboxActionTypeV0 = "WAIT" | "ACCEPT" | "DECLINE" | "REQUEST_EVIDENCE";

/** Controlled world posture of one external entity. Subject-independent. */
export interface SandboxEntityPostureV0 {
  readonly accepted: boolean;
  readonly declined: boolean;
  readonly evidence_requested: boolean;
}

/** Minimal controlled world: entity postures + produced effect refs. */
export class DeterministicSandboxWorldV0 {
  private readonly postures = new Map<string, SandboxEntityPostureV0>();
  private readonly effects: string[] = [];

  /** Read-only world observation (never SubjectState). */
  postureOf(targetRef: string): SandboxEntityPostureV0 {
    return (
      this.postures.get(targetRef) ?? {
        accepted: false,
        declined: false,
        evidence_requested: false
      }
    );
  }

  /** Effect refs produced so far (factual world artifacts). */
  producedEffects(): readonly string[] {
    return [...this.effects];
  }

  /** The sandbox executor adapter over this world. */
  executor(): ActionExecutorV0 {
    const postures = this.postures;
    const effects = this.effects;
    return {
      async execute(
        actionIntent: ActionIntentV0,
        context: ActionExecutionContextV0
      ): Promise<ActionOutcomeV0> {
        const target = actionIntent.target_ref ?? "world:none";
        const existing = postures.get(target);
        const posture = {
          accepted: existing?.accepted ?? false,
          declined: existing?.declined ?? false,
          evidence_requested: existing?.evidence_requested ?? false
        };
        const effectRefs: string[] = [];
        const type = actionIntent.action_type as SandboxActionTypeV0;
        switch (type) {
          case "WAIT":
            effectRefs.push(`world-effect:${context.execution_id}:wait`);
            break;
          case "ACCEPT":
            posture.accepted = true;
            postures.set(target, posture);
            effectRefs.push(`world-effect:${context.execution_id}:accepted:${target}`);
            break;
          case "DECLINE":
            posture.declined = true;
            postures.set(target, posture);
            effectRefs.push(`world-effect:${context.execution_id}:declined:${target}`);
            break;
          case "REQUEST_EVIDENCE":
            posture.evidence_requested = true;
            postures.set(target, posture);
            effectRefs.push(`world-effect:${context.execution_id}:evidence-requested:${target}`);
            break;
          default:
            return {
              schema_version: "action-outcome-v0",
              execution_id: context.execution_id,
              action_type: actionIntent.action_type,
              target_ref: actionIntent.target_ref,
              status: "REJECTED",
              effect_refs: [],
              world_observation_refs: [],
              error: {
                code: "ACTION_TYPE_NOT_IN_SANDBOX_WORLD",
                detail: `sandbox world does not model action type "${actionIntent.action_type}"`
              },
              logical_time: context.logical_time as LogicalTimeV0
            };
        }
        effects.push(...effectRefs);
        return {
          schema_version: "action-outcome-v0",
          execution_id: context.execution_id,
          action_type: actionIntent.action_type,
          target_ref: actionIntent.target_ref,
          status: "EXECUTED",
          effect_refs: effectRefs as never,
          world_observation_refs: ([] as never),
          error: null,
          logical_time: context.logical_time as LogicalTimeV0
        };
      }
    };
  }
}

/** Renders a sandbox posture ref for outcome observation fields. */
export function sandboxObservationRef(
  targetRef: string,
  logicalTime: LogicalTimeV0
): CanonicalRefV0 {
  return `world-observation:${targetRef.replace(/^[a-z]+:/, "")}@t${logicalTime}` as CanonicalRefV0;
}
