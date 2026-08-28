/**
 * P2-next — ReferenceCognitionProviderV0 (ENGINEERING_REFERENCE_V0).
 *
 * A deterministic reference cognition provider sufficient to exercise the
 * CognitionActionTransition offline. It is NOT psychologically impressive and
 * NOT scientific truth — it exists to prove the frozen invariants:
 *
 *   same projection + same transition identity + same logical state
 *     ⇒ same proposal/result
 *
 * Policy (pure function of the projection, no wall clock / randomness):
 *  - relevant memory evidence   = the projection's memory refs verbatim
 *  - considered context refs    = the projection's context refs verbatim
 *  - current_intent             = deterministic label derived from scene/task
 *  - action_intent              = the first (raw-ASCII-sorted) allowed action
 *                                 WHEN the subject has a current observation,
 *                                 else null (legal NO_ACTION — A9 default)
 */

import type { CognitionProviderV0 } from "../ports/cognition-port.js";
import type {
  CognitiveContextProjectionV0,
  CognitionProposalV0
} from "../transitions/cognition-action/types.js";

function sortedUnique(refs: readonly string[]): string[] {
  return [...new Set(refs)].sort();
}

export class ReferenceCognitionProviderV0 implements CognitionProviderV0 {
  async propose(
    projection: CognitiveContextProjectionV0
  ): Promise<CognitionProposalV0> {
    const memoryRefs = sortedUnique(projection.memory_working_refs);
    const retrievalRefs = sortedUnique(projection.recent_retrieval_refs);
    const contextRefs = sortedUnique([
      ...projection.context.focus_refs,
      ...projection.context.active_entity_refs,
      ...projection.context.environment_refs,
      ...(projection.context.current_observation_ref !== null
        ? [projection.context.current_observation_ref]
        : [])
    ]);

    // Deterministic intent label: task-anchored, else observation-anchored,
    // else scene-anchored. Pure text derived from the projection.
    const currentIntent =
      projection.context.task !== null
        ? `pursue:${projection.context.task}`
        : projection.context.current_observation_ref !== null
          ? `interpret:${projection.context.scene}`
          : `settle:${projection.context.scene}`;

    // Deterministic confidence: slightly higher with active affect evidence,
    // uncertainty slightly higher with more memory evidence. Fixed arithmetic,
    // no randomness. ENGINEERING_REFERENCE_V0 — not scientific truth.
    const confidence = projection.affect_channels.length > 0 ? 0.6 : 0.5;
    const uncertainty = memoryRefs.length > 0 ? 0.4 : 0.5;

    // A9 default: NO_ACTION. An ActionIntent is proposed ONLY when the subject
    // has a current observation AND a non-empty allowed action space; the
    // intent is always the deterministic first entry of that supplied space.
    let actionIntent: { action_type: string; target_ref: string | null } | null = null;
    if (
      projection.context.current_observation_ref !== null &&
      projection.allowed_actions.length > 0
    ) {
      const sorted = [...projection.allowed_actions].sort((a, b) =>
        a.action_type < b.action_type ? -1 : a.action_type > b.action_type ? 1 : 0
      );
      const chosen = sorted[0];
      if (chosen !== undefined) {
        actionIntent = { action_type: chosen.action_type, target_ref: chosen.target_ref };
      }
    }

    return {
      schema_version: "cognition-proposal-v0",
      projection_hash: projection.projection_hash,
      reasoning_summary: `reference-cognition:${currentIntent}`,
      relevant_memory_refs: [...memoryRefs, ...retrievalRefs] as never,
      considered_context_refs: contextRefs as never,
      current_intent: currentIntent,
      confidence,
      uncertainty,
      action_intent: actionIntent as never,
      evidence_refs: sortedUnique([...memoryRefs, ...retrievalRefs, ...contextRefs]) as never
    };
  }
}
