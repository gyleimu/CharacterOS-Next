/**
 * Product sandbox — THIN conversation text response adapter
 * (STRUCTURED_COMMUNICATION_DIRECTIVE_V0 + BEHAVIOR_EXPERIENCE_FEEDBACK_V0).
 *
 * The sandbox receives OUTPUT_READY.behavior.text through the V1 production
 * executor. No experiment imports, no authority bypass, no extra surface: a
 * caller supplies only the trusted response request; everything authoritative
 * derives inside the runtime.
 *
 * BEHAVIOR_EXPERIENCE_FEEDBACK_V0: delivery acknowledgment is a durable
 * composition-owned ledger receipt (SandboxConversationDeliveryReceiptV0) —
 * NOT the naked `delivered` boolean below, which remains a non-canonical
 * adapter return signal only. The feedback path (ingress with explicit parent
 * delivery id → Experience → episode → Learning commit) runs through the
 * runtime feedback authority via sandboxCommitBehaviorOutcomeFeedbackV0.
 */
import type {
  ConversationResponseRequestV0,
  RuntimeDependencyContainer,
  RuntimeContext,
  TransitionCapabilities,
  BehaviorOutcomeFeedbackExecutionResult
} from "@characteros-next/runtime";
import {
  ConversationTextResponseExecutorV1,
  LearningTransitionExecutor
} from "@characteros-next/runtime";

export interface SandboxConversationTextReplyV0 {
  /**
   * NON-canonical adapter return signal (was the only delivery signal before
   * BEHAVIOR_EXPERIENCE_FEEDBACK_V0). Canonical delivery authority is the
   * composition-owned ledger receipt — see
   * sandboxRecordConversationDeliveryV0.
   */
  readonly delivered: boolean;
  readonly text?: string;
  readonly behavior_id?: string;
  readonly failure_stage?: string;
  readonly detail?: string;
}

/** Thin product adapter: normal execution in, user-visible text (or explicit failure) out. */
export async function sandboxConversationTextResponse(
  container: RuntimeDependencyContainer,
  ctx: RuntimeContext,
  request: ConversationResponseRequestV0,
  capabilities: TransitionCapabilities
): Promise<SandboxConversationTextReplyV0> {
  const executor = new ConversationTextResponseExecutorV1(container);
  const result = await executor.execute(ctx, request, capabilities);
  if (result.kind === "OUTPUT_READY") {
    return { delivered: true, text: result.behavior.text, behavior_id: result.behavior.behavior_id };
  }
  return { delivered: false, failure_stage: result.stage, detail: result.detail };
}

// --- BEHAVIOR_EXPERIENCE_FEEDBACK_V0 — delivery acknowledgment + feedback path --------

export interface SandboxConversationDeliveryReceiptV0 {
  readonly ok: boolean;
  readonly delivery_id?: string;
  readonly status?: "DELIVERED" | "FAILED";
  readonly detail?: string;
}

/**
 * Records the ACTUAL delivery acknowledgment into the composition-owned ledger.
 * The host calls this when the behavior text truly reaches the user surface
 * (or with status FAILED when delivery failed). The returned receipt identity
 * is what a later user reply binds to via `in_reply_to_delivery_id`.
 */
export async function sandboxRecordConversationDeliveryV0(
  container: RuntimeDependencyContainer,
  input: unknown
): Promise<SandboxConversationDeliveryReceiptV0> {
  const ledger = container.conversationDeliveryLedger;
  if (ledger === null) {
    return { ok: false, detail: "conversation delivery ledger not wired" };
  }
  const recorded = await ledger.recordConversationDelivery(input);
  if (!recorded.ok) {
    return { ok: false, detail: `${recorded.code}: ${recorded.detail}` };
  }
  return { ok: true, delivery_id: recorded.record.delivery_id, status: recorded.record.status };
}

export interface SandboxConversationIngressReceiptV0 {
  readonly kind: "RECORDED" | "REPLAY" | "CONFLICT" | "REJECTED";
  readonly event_ref?: string;
  readonly detail?: string;
}

/**
 * Records one conversation ingress event (exact factual user text) into the
 * composition-owned ledger. `REPLAY` means the identical source event was
 * already recorded (+0); `CONFLICT` means the same source event identity came
 * back with changed factual content (fail closed).
 */
export async function sandboxRecordConversationIngressV0(
  container: RuntimeDependencyContainer,
  input: unknown
): Promise<SandboxConversationIngressReceiptV0> {
  const ledger = container.conversationIngressLedger;
  if (ledger === null) {
    return { kind: "REJECTED", detail: "conversation ingress ledger not wired" };
  }
  const outcome = await ledger.recordIngressEvent(input);
  if (outcome.kind === "RECORDED" || outcome.kind === "REPLAY") {
    return { kind: outcome.kind, event_ref: outcome.record.event_ref };
  }
  if (outcome.kind === "CONFLICT") {
    return { kind: "CONFLICT", detail: outcome.detail };
  }
  return { kind: "REJECTED", detail: outcome.detail };
}

/**
 * Runs the behavior→experience→memory feedback path through the runtime
 * Learning authority: verifies the linked lineage (ingress event + DELIVERED
 * parent + committed O2) and, on success, canonically commits exactly one
 * Experience + episode + Learning binding. Model proposals have zero authority
 * here — the candidate only names the lineage.
 */
export async function sandboxCommitBehaviorOutcomeFeedbackV0(
  container: RuntimeDependencyContainer,
  ctx: RuntimeContext,
  candidate: unknown
): Promise<BehaviorOutcomeFeedbackExecutionResult> {
  const executor = new LearningTransitionExecutor(container);
  return executor.executeBehaviorOutcomeFeedback(ctx, { candidate } as never);
}
