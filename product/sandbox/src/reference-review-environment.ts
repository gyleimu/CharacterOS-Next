/**
 * SUBJECT_ENVIRONMENT_PRODUCT_CONTINUITY_V0 — the ONE deterministic product
 * reference environment.
 *
 * Small, stateful, fully inspectable, offline, zero model calls. It exercises
 * the ALREADY-FROZEN `SubjectEnvironmentV0` contract: it produces observable
 * interactions and reacts to the observable delivered behavior using only its
 * own explicit external state. It never sees Affect, Memory, intent, cognition
 * internals or authority tokens.
 *
 * State semantics are deliberately trivial: `exchange_count` plus the last
 * acknowledged decision text. The reply depends on that state, so the external
 * world visibly changes over time and survives restart through
 * `EnvironmentStateV0`.
 */

import type {
  EnvironmentConsequenceV0,
  EnvironmentInteractionV0,
  EnvironmentObservationInputV0,
  EnvironmentStateV0,
  SubjectEnvironmentV0
} from "@characteros-next/runtime";

const SCENES: readonly string[] = Object.freeze([
  "Alice asks how the quarterly review document should be organized.",
  "Alice asks for the current status of the review document.",
  "Alice asks whether the outstanding checklist item can be closed.",
  "Alice asks for a final confirmation before the review is submitted.",
  "Alice asks what changed since the previous review.",
  "Alice asks whether anything still blocks the review."
]);

export interface ReferenceReviewEnvironmentOptionsV0 {
  readonly environment_id?: string;
  readonly interaction_count?: number;
}

export class ReferenceReviewEnvironmentV0 implements SubjectEnvironmentV0 {
  readonly environment_id: string;
  readonly interaction_count: number;
  private state: { exchange_count: number; last_decision: string | null };

  constructor(options: ReferenceReviewEnvironmentOptionsV0 = {}) {
    this.environment_id = options.environment_id ?? "product-review-environment-v0";
    this.interaction_count = options.interaction_count ?? SCENES.length;
    this.state = { exchange_count: 0, last_decision: null };
  }

  nextInteraction(index: number): EnvironmentInteractionV0 {
    return {
      interaction_id: `review-${index}`,
      scene: SCENES[index] ?? `review interaction ${index}`,
      task: "respond to Alice"
    };
  }

  observeBehavior(input: EnvironmentObservationInputV0): EnvironmentConsequenceV0 {
    const askedQuestion = input.delivered_behavior_text.includes("?");
    this.state = {
      exchange_count: this.state.exchange_count + 1,
      // The environment records the subject's concrete commitment only when the
      // subject did NOT merely ask for clarification.
      last_decision: askedQuestion
        ? this.state.last_decision
        : input.delivered_behavior_text.slice(0, 80)
    };
    const reply =
      this.state.last_decision === null
        ? "I still do not have a concrete decision from you on the review, so let us keep this open."
        : `Acknowledged for exchange ${this.state.exchange_count}: ${this.state.last_decision}`;
    return { reply_text: reply, state: this.exportState() };
  }

  exportState(): EnvironmentStateV0 {
    const payload: Record<string, unknown> = {
      exchange_count: this.state.exchange_count,
      last_decision: this.state.last_decision
    };
    return {
      schema_version: "subject-environment-state-v0",
      state_hash: `hash:${JSON.stringify(payload)}`,
      payload
    };
  }

  restoreState(state: EnvironmentStateV0): void {
    const payload = state.payload;
    this.state = {
      exchange_count: Number(payload["exchange_count"] ?? 0),
      last_decision: (payload["last_decision"] as string | null) ?? null
    };
  }

  stateHash(): string {
    return this.exportState().state_hash;
  }
}
