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

// --- CHARACTEROS_VISUAL_PRODUCT_LOCAL_WEB_V0 — reusable product services --------
// Additive public product boundary for local product surfaces (the CLI and the
// local web product). These are the SAME services the CLI uses; no canonical
// semantics, no authority, no raw mutation surface is exposed here.

export {
  ProductRuntimeV0,
  ProductEventHubV0,
  ProductRuntimeStartupErrorV0,
  createProductRuntimeV0
} from "./product-runtime.js";
export type {
  CreateProductRuntimeOptionsV0,
  ProductCanonicalTimeResultV0,
  ProductConfigValueViewV0,
  ProductConfigViewV0,
  ProductDiagnosticsViewV0,
  ProductEnvironmentOutcomeV0,
  ProductEnvironmentResultV0,
  ProductObservationOutcomeV0,
  ProductRuntimeBootstrapV0,
  ProductRuntimeDepsV0,
  ProductRuntimeIdentityV0,
  ProductRuntimeProviderV0,
  ProductRuntimeStartupCodeV0,
  ProductTurnResultV0
} from "./product-runtime.js";
export {
  AppraisalInferenceReuseV0,
  appraisalProviderFingerprintV0,
  appraisalRequestFingerprintV0,
  appraisalRequestIdentityV0,
  normalizedAppraisalValueV0
} from "./product-appraisal-reuse.js";
export type {
  AppraisalReuseCountersV0,
  AppraisalReuseScopeV0,
  ReusableAppraisalCandidateV0
} from "./product-appraisal-reuse.js";
export { buildStructuredObservationRequestV0 } from "./product-observation.js";
export type {
  ProductObservationFieldsV0,
  ProductObservationRequestResultV0
} from "./product-observation.js";
export { InteractiveSubjectHostV0 } from "./interactive-subject-host.js";
export { ProductLifeOperationsV0 } from "./product-life-operations.js";
export type { ProductLifeViewV0, ProductStateViewV0 } from "./product-life-operations.js";
export {
  buildTurnFailureSummaryV0,
  runInstrumentedProductTurnV0,
  suggestionForFailureV0
} from "./product-turn-execution.js";
export type { InstrumentedTurnResultV0, TurnFailureSummaryV0 } from "./product-turn-execution.js";
export { ProviderDiagnosticsV0, buildProductTurnPlanV0, formatLatencyV0 } from "./provider-diagnostics.js";
export type {
  ProductTurnPlanInputV0,
  ProductTurnPlanV0,
  ProviderDiagnosticsSnapshotV0,
  ProviderFailureCategoryV0,
  ProviderProgressEventV0,
  ProviderProgressEventTypeV0,
  ProviderProgressGroupV0,
  ProviderStageRecordV0,
  ProviderStageSampleV0WithStageV0,
  ProviderStageStatusV0,
  ProviderStageV0,
  ProviderTurnTimingV0
} from "./provider-diagnostics.js";
export {
  PRODUCT_DEFAULT_DATA_ROOT_ORIGIN_V0,
  PRODUCT_DEFAULT_DATA_ROOT_V0
} from "./product-paths.js";
// Read-only runtime projections the visual client renders (types only).
export type {
  InteractiveSubjectStateViewV0,
  InteractiveSubjectStatusV0,
  InteractiveTurnOutcomeV0,
  LivedMemoryEntryV0,
  LivedMemoryInspectionV0
} from "@characteros-next/runtime";
export { resolveProductConfigurationV0, formatConfigurationLinesV0 } from "./product-configuration.js";
export type { ProductConfigSourceV0, ProductConfigurationV0 } from "./product-configuration.js";
