/**
 * Product sandbox — THIN conversation text response adapter
 * (PRODUCTION_LANGUAGE_BEHAVIOR_OUTPUT_V0).
 *
 * The sandbox receives OUTPUT_READY.behavior.text through the normal production
 * executor. No experiment imports, no authority bypass, no extra surface: a
 * caller supplies only the trusted response request; everything authoritative
 * derives inside the runtime.
 */
import type {
  ConversationResponseRequestV0,
  ConversationTextResponseResultV0,
  RuntimeDependencyContainer
} from "@characteros-next/runtime";
import { ConversationTextResponseExecutorV0 } from "@characteros-next/runtime";
import type { TransitionCapabilities, RuntimeContext } from "@characteros-next/runtime";

export interface SandboxConversationTextReplyV0 {
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
  const executor = new ConversationTextResponseExecutorV0(container);
  const result: ConversationTextResponseResultV0 = await executor.execute(ctx, request, capabilities);
  if (result.kind === "OUTPUT_READY") {
    return { delivered: true, text: result.behavior.text, behavior_id: result.behavior.behavior_id };
  }
  return { delivered: false, failure_stage: result.stage, detail: result.detail };
}
