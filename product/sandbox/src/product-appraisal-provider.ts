/**
 * INTERACTIVE_PERSISTENT_SUBJECT_RUNTIME_V0 — product appraisal provider.
 *
 * The frozen pre-cognition Appraisal port is HOST-SUPPLIED by design: the host
 * proposes only subjective appraisal content; every authority field (subject,
 * event, observation grounding, times, revisions) is owned by the runtime.
 *
 * PRODUCT V0 LIMITATION (disclosed, not hidden): this provider applies the SAME
 * minimal "ordinary conversational factual event" profile to every admitted
 * event. It is not content-conditional and it is NOT a user reaction, sentiment,
 * or feedback model — the user's actual next message remains separate factual
 * evidence. Affect therefore moves through the canonical AffectApplication and
 * Time dynamics, not through per-content appraisal.
 */

import type { FactualEventAppraisalProviderV0 } from "@characteros-next/runtime";

const ORDINARY_CONVERSATION_APPRAISAL = Object.freeze({
  relevance: 0.6,
  goal_congruence: 0.5,
  attribution: "other" as const,
  controllability: 0.5,
  uncertainty: 0.5,
  intensity: 0.4
});

export function createProductAppraisalProviderV0(): FactualEventAppraisalProviderV0 {
  return {
    proposeFactualEventAppraisal: async (context: never) => {
      const ctx = context as unknown as {
        subject_id: string;
        factual_event_ref: string;
        context_projection_hash: string;
      };
      return {
        schema_version: "factual-event-appraisal-proposal-v0",
        status: "APPRAISED",
        subject_id: ctx.subject_id,
        factual_event_ref: ctx.factual_event_ref,
        context_projection_hash: ctx.context_projection_hash,
        dimensions: { ...ORDINARY_CONVERSATION_APPRAISAL },
        assessment_confidence: 0.6,
        evidence_refs: [ctx.factual_event_ref].sort()
      };
    }
  } as unknown as FactualEventAppraisalProviderV0;
}
