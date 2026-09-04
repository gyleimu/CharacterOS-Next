/**
 * ConversationCognitionProposalV1 — closed conversation-specific cognition
 * contract (STRUCTURED_COMMUNICATION_DIRECTIVE_V0).
 *
 * Wraps a validated CognitionProposalV0 with a structured CommunicationDirectiveV0
 * chosen by the model in the SAME cognition call. The nested cognition must
 * pass every existing CognitionProposalV0 validation rule. The action space
 * remains empty for the text-response path, so nested action_intent must be null.
 */

import type { CommunicationDirectiveV0 } from "@characteros-next/behavior";
import { validateCommunicationDirectiveV0 } from "@characteros-next/behavior";
import type { CognitiveContextProjectionV0, CognitionProposalV0 } from "../cognition-action/types.js";
import { validateCognitionProposal } from "../cognition-action/types.js";
import { isRecord } from "@characteros-next/subject-core";

export const CONVERSATION_COGNITION_PROPOSAL_SCHEMA_VERSION_V1 =
  "conversation-cognition-proposal-v1" as const;

const OUTER_KEYS: readonly string[] = ["schema_version", "cognition", "communication_directive"];

/** Exact closed conversation cognition proposal. */
export interface ConversationCognitionProposalV1 {
  readonly schema_version: typeof CONVERSATION_COGNITION_PROPOSAL_SCHEMA_VERSION_V1;
  readonly cognition: CognitionProposalV0;
  readonly communication_directive: CommunicationDirectiveV0;
}

/**
 * Strict validation of the model-produced conversation proposal:
 * outer closed schema + directive + full nested CognitionProposalV0 validation
 * (including projection binding, evidence grounding and action-space laws).
 */
export function validateConversationCognitionProposalV1(
  v: unknown,
  projection: CognitiveContextProjectionV0
): { ok: true; proposal: ConversationCognitionProposalV1 } | { ok: false; detail: string } {
  if (!isRecord(v)) return { ok: false, detail: "conversation proposal: expected object" };
  const keys = Object.keys(v).sort();
  const expected = [...OUTER_KEYS].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    return { ok: false, detail: `conversation proposal: unexpected keys; expected exactly ${expected.join(",")}` };
  }
  if (v["schema_version"] !== CONVERSATION_COGNITION_PROPOSAL_SCHEMA_VERSION_V1) {
    return { ok: false, detail: "conversation proposal.schema_version: expected conversation-cognition-proposal-v1" };
  }
  const directiveCheck = validateCommunicationDirectiveV0(v["communication_directive"]);
  if (!directiveCheck.ok) {
    return { ok: false, detail: `conversation proposal.communication_directive: ${directiveCheck.detail}` };
  }
  const cognitionCheck = validateCognitionProposal(v["cognition"]);
  if (!cognitionCheck.ok) {
    return { ok: false, detail: `conversation proposal.cognition: ${cognitionCheck.error.detail}` };
  }
  const cognition = cognitionCheck.value as CognitionProposalV0;
  if (cognition.projection_hash !== projection.projection_hash) {
    return { ok: false, detail: "conversation proposal.cognition.projection_hash: does not match projection" };
  }
  if (cognition.action_intent !== null) {
    return { ok: false, detail: "conversation proposal.cognition.action_intent: must be null for text-response path" };
  }
  return {
    ok: true,
    proposal: {
      schema_version: CONVERSATION_COGNITION_PROPOSAL_SCHEMA_VERSION_V1,
      cognition,
      communication_directive: directiveCheck.directive
    }
  };
}
