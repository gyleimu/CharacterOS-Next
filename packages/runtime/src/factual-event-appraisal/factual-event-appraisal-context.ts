/**
 * PRE_COGNITION_CANONICAL_APPRAISAL_V0 — context builder.
 *
 * Builds the frozen pre-cognition context projection from AUTHORITATIVE
 * inputs only: the verified factual-event resolution (Ingress ↔ committed
 * Observation ↔ event_ref through ConversationFactualEventAuthorityV0) and
 * the current canonical subject state. The provider never supplies any of
 * these fields.
 *
 * §17 NULL-TASK LAW: if the current subject context.task is null the context
 * is INSUFFICIENT_CONTEXT — no dimensions are fabricated, no neutral
 * Appraisal is created.
 */

import type { SubjectStateV0, HashV1 } from "@characteros-next/subject-core";
import { hashEnvelope } from "@characteros-next/subject-core";
import type { FactualEventAppraisalContextProjectionV0 } from "@characteros-next/appraisal";

export const FACTUAL_EVENT_APPRAISAL_CONTEXT_PROJECTION_VERSION =
  "factual-event-appraisal-context-v0" as const;

/** Verified factual-event grounding inputs (authority-derived, never raw). */
export interface FactualEventGroundingV0 {
  readonly subject_id: string;
  readonly factual_event_ref: string;
  readonly factual_event_payload_hash: string;
  readonly source_observation_ref: string;
  readonly source_observation_transition_id: string;
  readonly source_admission_history_sequence: number;
}

export type FactualEventAppraisalContextResultV0 =
  | {
      readonly ok: true;
      readonly context: FactualEventAppraisalContextProjectionV0;
    }
  | {
      readonly ok: false;
      readonly code: "INSUFFICIENT_CONTEXT";
      readonly detail: string;
    };

export class FactualEventAppraisalContextBuilderV0 {
  constructor(
    private readonly stateHashOf: (state: SubjectStateV0) => Promise<HashV1>
  ) {}


  async build(input: {
    readonly grounding: FactualEventGroundingV0;
    readonly snapshot: SubjectStateV0;
  }): Promise<FactualEventAppraisalContextResultV0> {
    const snapshot = input.snapshot;
    const subjectId = snapshot.identity.subject_id as string;
    if (subjectId !== input.grounding.subject_id) {
      throw new Error(`factual appraisal context: grounding subject ${input.grounding.subject_id} does not match canonical state subject ${subjectId}`);
    }
    const currentTask = (snapshot.context as unknown as { task: string | null }).task;
    if (currentTask === null || currentTask === undefined) {
      return {
        ok: false,
        code: "INSUFFICIENT_CONTEXT",
        detail: "current subject context.task is null: no lawful goal context for an INITIAL appraisal (no fabrication)"
      };
    }
    const stateHashValue = await this.stateHashOf(snapshot);
    const revision = (snapshot.memory_state as unknown as { repository_revision: string }).repository_revision as string;
    const observableScene = (snapshot.context as unknown as { scene: unknown }).scene;
    if (typeof observableScene !== "string") {
      throw new Error("factual appraisal context: committed context.scene must be a string");
    }
    const projectionWithoutHash = {
      schema_version: FACTUAL_EVENT_APPRAISAL_CONTEXT_PROJECTION_VERSION,
      subject_id: input.grounding.subject_id,
      factual_event_ref: input.grounding.factual_event_ref,
      factual_event_payload_hash: input.grounding.factual_event_payload_hash,
      source_observation_ref: input.grounding.source_observation_ref,
      source_observation_transition_id: input.grounding.source_observation_transition_id,
      source_admission_history_sequence: input.grounding.source_admission_history_sequence,
      state_revision: snapshot.runtime_metadata.state_revision as number,
      state_hash: stateHashValue,
      repository_revision: revision,
      logical_time: snapshot.runtime_metadata.logical_time as number,
      current_task: currentTask as string,
      // APPRAISAL_CONTENT_BOUNDARY_V0: the committed observable scene of the
      // CURRENT event — untrusted observable content, never an objective fact.
      current_observable_scene: observableScene
    };
    const contextHash = await hashEnvelope("characteros-next/runtime/factual-event-appraisal-context/v1", projectionWithoutHash);
    const context: FactualEventAppraisalContextProjectionV0 = {
      ...projectionWithoutHash,
      subject_id: projectionWithoutHash.subject_id as never,
      factual_event_ref: projectionWithoutHash.factual_event_ref as never,
      factual_event_payload_hash: projectionWithoutHash.factual_event_payload_hash as never,
      source_observation_ref: projectionWithoutHash.source_observation_ref as never,
      state_revision: projectionWithoutHash.state_revision as never,
      repository_revision: projectionWithoutHash.repository_revision as never,
      logical_time: projectionWithoutHash.logical_time as never,
      context_projection_hash: contextHash as HashV1
    };
    return { ok: true, context };
  }
}
