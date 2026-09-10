/* eslint-disable no-restricted-imports -- Isolated validation harness over the frozen built production session capability. */

/**
 * LONG_HORIZON_AUTONOMOUS_SUBJECT_SESSION_V0 — validation-only Alice environment.
 *
 * One continuing review-document task with Alice across 8 ordinary interactions
 * (frozen before any real call). The environment owns ONLY explicit external
 * state and reacts to observable behavior + that state. It never inspects
 * Affect, Memory, current_intent, cognition internals or authority tokens.
 */

import type { FactualEventAppraisalProviderV0 } from "../../../packages/appraisal/dist/index.js";
import type {
  EnvironmentConsequenceV0,
  EnvironmentInteractionV0,
  EnvironmentObservationInputV0,
  EnvironmentStateV0,
  SubjectEnvironmentV0
} from "../../../packages/runtime/dist/index.js";

/** Frozen interaction plan (scene/task only; appraisal dimensions are separate). */
export interface FrozenInteractionV0 {
  readonly index: number;
  readonly interaction_id: string;
  readonly scene: string;
  readonly task: string;
}

export const ALICE_CONVERSATION_ID = "conv-alice-review-session-v0";

export const INTERACTIONS: readonly FrozenInteractionV0[] = Object.freeze([
  Object.freeze({
    index: 0,
    interaction_id: "alice-1-organization",
    scene: "Alice asks how the review document should be organized: the implementation notes and the validation notes could stay separate, or be merged into one section.",
    task: "Decide how the review document should be organized and tell Alice."
  }),
  Object.freeze({
    index: 1,
    interaction_id: "alice-2-status",
    scene: "Alice asks where the review document stands now, some time after the organization question came up.",
    task: "Report the current status of the review document to Alice."
  }),
  Object.freeze({
    index: 2,
    interaction_id: "alice-3-external-reader",
    scene: "Alice says she has just learned the review document will be shared with an external reader, so completeness now matters more than brevity.",
    task: "Respond to Alice's new information about the external reader."
  }),
  Object.freeze({
    index: 3,
    interaction_id: "alice-4-next-step",
    scene: "Alice asks what the next concrete step for the review document should be.",
    task: "Tell Alice the next concrete step."
  }),
  Object.freeze({
    index: 4,
    interaction_id: "alice-5-earlier-decision",
    scene: "Alice asks whether the earlier organization decision still holds now that an external reader will see the document.",
    task: "Answer Alice about whether the earlier organization decision still holds."
  }),
  Object.freeze({
    index: 5,
    interaction_id: "alice-6-checklist-item",
    scene: "Alice asks for one small checklist item that should track the remaining work on the review document.",
    task: "Propose one checklist item for the remaining work."
  }),
  Object.freeze({
    index: 6,
    interaction_id: "alice-7-reconcile",
    scene: "Alice asks whether everything discussed so far is consistent, and whether anything agreed earlier is now missing.",
    task: "Reconcile the current work with what was agreed earlier."
  }),
  Object.freeze({
    index: 7,
    interaction_id: "alice-8-final",
    scene: "Alice asks for a final confirmation of the current state of the review document before the review.",
    task: "Give Alice a final confirmation of the current state."
  })
]);

/** Frozen minimal current-Appraisal dimensions per admission.
 * Indexed by the frozen `source_admission_history_sequence` (1-based):
 * interaction i's primary event is admission 2i+1, its counterpart reply 2i+2. */
export const PRIMARY_APPRAISAL_DIMENSIONS: readonly {
  readonly relevance: number;
  readonly goal_congruence: number;
  readonly intensity: number;
}[] = Object.freeze([
  Object.freeze({ relevance: 0.8, goal_congruence: 0.6, intensity: 0.6 }), // E1
  Object.freeze({ relevance: 0.7, goal_congruence: 0.7, intensity: 0.5 }), // E2
  Object.freeze({ relevance: 0.8, goal_congruence: 0.4, intensity: 0.6 }), // E3
  Object.freeze({ relevance: 0.7, goal_congruence: 0.7, intensity: 0.5 }), // E4
  Object.freeze({ relevance: 0.8, goal_congruence: 0.5, intensity: 0.6 }), // E5
  Object.freeze({ relevance: 0.6, goal_congruence: 0.7, intensity: 0.4 }), // E6
  Object.freeze({ relevance: 0.8, goal_congruence: 0.6, intensity: 0.6 }), // E7
  Object.freeze({ relevance: 0.7, goal_congruence: 0.7, intensity: 0.4 })  // E8
]);

/** Counterpart replies are ordinary factual events: minimal, neutral, identical
 * in kind across interactions (never a behavior script). */
export const REPLY_APPRAISAL_DIMENSIONS = Object.freeze({
  relevance: 0.5,
  goal_congruence: 0.6,
  intensity: 0.3
});

const ATTRIBUTION = "other" as const;
const CONTROLLABILITY = 0.6;
const UNCERTAINTY = 0.4;
const ASSESSMENT_CONFIDENCE = 0.8;

/** Deterministic appraisal provider over the frozen admission ordinal. */
export function aliceAppraisalProvider(): FactualEventAppraisalProviderV0 {
  return {
    proposeFactualEventAppraisal: async (context: never) => {
      const ctx = context as unknown as {
        subject_id: string;
        factual_event_ref: string;
        context_projection_hash: string;
        source_admission_history_sequence: number;
      };
      const sequence = ctx.source_admission_history_sequence;
      const isReply = sequence % 2 === 0;
      const interactionIndex = isReply ? Math.floor(sequence / 2) - 1 : Math.floor(sequence / 2);
      const dimensions = isReply
        ? REPLY_APPRAISAL_DIMENSIONS
        : (PRIMARY_APPRAISAL_DIMENSIONS[interactionIndex] ?? REPLY_APPRAISAL_DIMENSIONS);
      return {
        schema_version: "factual-event-appraisal-proposal-v0",
        status: "APPRAISED",
        subject_id: ctx.subject_id,
        factual_event_ref: ctx.factual_event_ref,
        context_projection_hash: ctx.context_projection_hash,
        dimensions: {
          relevance: dimensions.relevance,
          goal_congruence: dimensions.goal_congruence,
          attribution: ATTRIBUTION,
          controllability: CONTROLLABILITY,
          uncertainty: UNCERTAINTY,
          intensity: dimensions.intensity
        },
        assessment_confidence: ASSESSMENT_CONFIDENCE,
        evidence_refs: [ctx.factual_event_ref].sort()
      };
    }
  } as unknown as FactualEventAppraisalProviderV0;
}

/** Explicit external world state for the continuing review task. */
interface AliceWorldState {
  review_stage: string;
  organization_decision: string | null;
  external_reader_known: boolean;
  open_checklist_items: string[];
  exchange_count: number;
}

/** The bounded deterministic Alice environment (§11/§25/§26/§39). */
export class AliceReviewEnvironmentV0 implements SubjectEnvironmentV0 {
  readonly environment_id = "alice-review-environment-v0";
  readonly interaction_count = INTERACTIONS.length;
  private state: AliceWorldState = {
    review_stage: "DRAFTING",
    organization_decision: null,
    external_reader_known: false,
    open_checklist_items: [],
    exchange_count: 0
  };

  nextInteraction(index: number): EnvironmentInteractionV0 {
    const frozen = INTERACTIONS[index];
    if (frozen === undefined) throw new Error(`alice environment: no frozen interaction at index ${index}`);
    return { interaction_id: frozen.interaction_id, scene: frozen.scene, task: frozen.task };
  }

  /** Reacts ONLY to the delivered observable behavior + its own explicit state. */
  observeBehavior(input: EnvironmentObservationInputV0): EnvironmentConsequenceV0 {
    const behavior = input.delivered_behavior_text;
    const asks = behavior.includes("?") || behavior.includes("？");
    const isExternalReaderNotice = input.interaction_id === "alice-3-external-reader";

    const next: AliceWorldState = {
      ...this.state,
      external_reader_known: this.state.external_reader_known || isExternalReaderNotice,
      exchange_count: this.state.exchange_count + 1
    };
    if (!asks) {
      next.organization_decision = next.organization_decision ?? behavior.slice(0, 120);
      next.review_stage = next.review_stage === "DRAFTING" ? "UNDER_REVIEW" : next.review_stage;
    } else {
      const item = `clarification:${behavior.slice(0, 60)}`;
      next.open_checklist_items = [...new Set([...next.open_checklist_items, item])];
    }
    this.state = next;

    const reply = asks
      ? `Sure — about "${behavior.slice(0, 80)}": I have noted that open question on the shared checklist and will confirm it before the review.`
      : `Thanks — about "${behavior.slice(0, 80)}": I have recorded that on the shared checklist and updated the review stage.`;
    return { reply_text: reply, state: this.exportState() };
  }

  exportState(): EnvironmentStateV0 {
    const payload = JSON.parse(JSON.stringify(this.state)) as unknown as Record<string, unknown>;
    return {
      schema_version: "subject-environment-state-v0",
      state_hash: `environment-state:${stableJson(payload)}`,
      payload
    };
  }

  restoreState(state: EnvironmentStateV0): void {
    this.state = {
      review_stage: String(state.payload["review_stage"] ?? "DRAFTING"),
      organization_decision: (state.payload["organization_decision"] as string | null) ?? null,
      external_reader_known: state.payload["external_reader_known"] === true,
      open_checklist_items: Array.isArray(state.payload["open_checklist_items"])
        ? (state.payload["open_checklist_items"] as unknown[]).map((entry) => String(entry))
        : [],
      exchange_count: Number(state.payload["exchange_count"] ?? 0)
    };
  }

  stateHash(): string {
    return this.exportState().state_hash;
  }
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map((entry) => stableJson(entry)).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`).join(",")}}`;
}
