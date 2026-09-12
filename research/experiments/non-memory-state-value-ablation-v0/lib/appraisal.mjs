/**
 * Deterministic content-sensitive appraisal provider (research harness).
 *
 * It is a lawful FactualEventAppraisalProviderV0: the REAL production
 * Appraisal → AffectApplication authority consumes its proposal and writes
 * canonical Affect. No canonical state is host-written, and affect values are
 * never set directly. This removes appraisal-model noise from the ablation so
 * the only compared variable is the cognition projection.
 */

export function contentSensitiveAppraisalProvider() {
  return {
    proposeFactualEventAppraisal: async (context) => {
      const scene = String(context.current_observable_scene ?? '').toLowerCase();
      const incongruent = /worse|didn't work|don't|stop|problem|harder|failed|not again/.test(scene);
      const congruent = /worked|hoped|helped|useful|thanks|well|relieved/.test(scene);
      const goalCongruence = incongruent ? 0.05 : congruent ? 0.95 : 0.5;
      const intensity = incongruent ? 0.9 : congruent ? 0.7 : 0.4;
      return {
        schema_version: 'factual-event-appraisal-proposal-v0',
        status: 'APPRAISED',
        subject_id: context.subject_id,
        factual_event_ref: context.factual_event_ref,
        context_projection_hash: context.context_projection_hash,
        dimensions: {
          relevance: 0.8,
          goal_congruence: goalCongruence,
          attribution: 'other',
          controllability: 0.3,
          uncertainty: 0.2,
          intensity
        },
        assessment_confidence: 0.8,
        evidence_refs: [context.factual_event_ref].sort()
      };
    }
  };
}
