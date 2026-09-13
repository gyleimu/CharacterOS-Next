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
import type { CognitiveContextProjectionAnyVersion, CognitionProposalV0 } from "../cognition-action/types.js";
import { validateCognitionProposal } from "../cognition-action/types.js";
import type { CanonicalRefV0, HashV1 } from "@characteros-next/subject-core";
import { hashEnvelope, isRecord, validateCanonicalText, validateRefElement } from "@characteros-next/subject-core";

export const CONVERSATION_COGNITION_PROPOSAL_SCHEMA_VERSION_V1 =
  "conversation-cognition-proposal-v1" as const;

/**
 * AFFECT_COGNITION_AUTHORITY_CONTRACT_AND_REVALIDATION_V0 — conversation
 * proposal V2 (GPT-6 Family C).
 *
 * V2 adds a STRUCTURAL clarification basis so that CLARIFY can no longer be
 * used as a generic outlet for subjective reluctance or for "Memory has no
 * answer". CLARIFY requires a non-null basis naming the specific unresolved
 * information dependency and binding it to the CURRENT observation; REALIZE
 * requires exactly `clarification_basis: null`.
 *
 * The basis is a MODEL PROPOSAL, not truth: the host structurally verifies
 * schema, ref identity, subject/turn binding and field relationships only. It
 * does not and cannot prove arbitrary natural-language semantic necessity.
 */
export const CONVERSATION_COGNITION_PROPOSAL_SCHEMA_VERSION_V2 =
  "conversation-cognition-proposal-v2" as const;

/** GPT-6 frozen bound for each clarification-basis text field. */
export const CLARIFICATION_BASIS_TEXT_MAX_CODE_POINTS = 256 as const;

export const CONVERSATION_COGNITION_PROPOSAL_HASH_PROJECTION_V2 =
  "characteros-next/runtime/conversation-cognition-proposal/v2" as const;

/** Structural basis for a CLARIFY_MISSING_CONTEXT directive. */
export interface ClarificationBasisV0 {
  /** The CURRENT cognition projection's authoritative observation ref. */
  readonly current_observation_ref: CanonicalRefV0;
  /** The specific unresolved information dependency (bounded canonical text). */
  readonly missing_information: string;
  /** What completing the selected response needs it for. */
  readonly needed_for: string;
}

/** Closed V2 conversation cognition proposal. */
export interface ConversationCognitionProposalV2 {
  readonly schema_version: typeof CONVERSATION_COGNITION_PROPOSAL_SCHEMA_VERSION_V2;
  readonly cognition: CognitionProposalV0;
  readonly communication_directive: CommunicationDirectiveV0;
  readonly clarification_basis: ClarificationBasisV0 | null;
}

const OUTER_KEYS: readonly string[] = ["schema_version", "cognition", "communication_directive"];
const OUTER_KEYS_V2: readonly string[] = [
  "schema_version",
  "cognition",
  "communication_directive",
  "clarification_basis"
];
const BASIS_KEYS: readonly string[] = ["current_observation_ref", "missing_information", "needed_for"];

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
  projection: CognitiveContextProjectionAnyVersion
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

function validateBoundedCanonicalText(
  v: unknown,
  detail: string
): { ok: true; value: string } | { ok: false; detail: string } {
  const checked = validateCanonicalText(v, detail);
  if (!checked.ok) return { ok: false, detail: checked.error.detail };
  const codePoints = [...checked.value].length;
  if (codePoints === 0) return { ok: false, detail: `${detail}: must be non-empty` };
  if (codePoints > CLARIFICATION_BASIS_TEXT_MAX_CODE_POINTS) {
    return {
      ok: false,
      detail: `${detail}: exceeds ${CLARIFICATION_BASIS_TEXT_MAX_CODE_POINTS} code points`
    };
  }
  return { ok: true, value: checked.value };
}

/**
 * Structural validation of the clarification basis. The observation ref MUST
 * equal the current cognition projection's authoritative observation ref
 * (rejecting wrong-turn, cross-subject, stale-memory, relationship or arbitrary
 * refs); both text fields are bounded non-empty canonical text; unknown fields
 * fail closed.
 */
function validateClarificationBasisV0(
  v: unknown,
  projection: CognitiveContextProjectionAnyVersion
): { ok: true; basis: ClarificationBasisV0 } | { ok: false; detail: string } {
  const detail = "clarification_basis";
  if (!isRecord(v)) return { ok: false, detail: `${detail}: expected object` };
  const keys = Object.keys(v).sort();
  const expected = [...BASIS_KEYS].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    return { ok: false, detail: `${detail}: unexpected keys; expected exactly [${expected.join(",")}]` };
  }
  const ref = validateRefElement(v["current_observation_ref"], `${detail}.current_observation_ref`, [
    "observation"
  ]);
  if (!ref.ok) return { ok: false, detail: ref.error.detail };
  const authoritative = projection.context.current_observation_ref;
  if (authoritative === null) {
    return { ok: false, detail: `${detail}.current_observation_ref: projection has no current observation` };
  }
  if (ref.value !== authoritative) {
    return {
      ok: false,
      detail: `${detail}.current_observation_ref: does not equal the current projection observation ref`
    };
  }
  const missing = validateBoundedCanonicalText(v["missing_information"], `${detail}.missing_information`);
  if (!missing.ok) return { ok: false, detail: missing.detail };
  const neededFor = validateBoundedCanonicalText(v["needed_for"], `${detail}.needed_for`);
  if (!neededFor.ok) return { ok: false, detail: neededFor.detail };
  return {
    ok: true,
    basis: Object.freeze({
      current_observation_ref: ref.value,
      missing_information: missing.value,
      needed_for: neededFor.value
    })
  };
}

/**
 * Strict validation of the model-produced V2 conversation proposal:
 * outer closed schema + directive + full nested CognitionProposalV0 validation
 * + the CLARIFY/REALIZE clarification-basis structural contract.
 */
export function validateConversationCognitionProposalV2(
  v: unknown,
  projection: CognitiveContextProjectionAnyVersion
): { ok: true; proposal: ConversationCognitionProposalV2 } | { ok: false; detail: string } {
  if (!isRecord(v)) return { ok: false, detail: "conversation proposal: expected object" };
  const keys = Object.keys(v).sort();
  const expected = [...OUTER_KEYS_V2].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    return { ok: false, detail: `conversation proposal: unexpected keys; expected exactly ${expected.join(",")}` };
  }
  if (v["schema_version"] !== CONVERSATION_COGNITION_PROPOSAL_SCHEMA_VERSION_V2) {
    return { ok: false, detail: "conversation proposal.schema_version: expected conversation-cognition-proposal-v2" };
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
  const directive = directiveCheck.directive as CommunicationDirectiveV0;
  if (directive.kind === "CLARIFY_MISSING_CONTEXT") {
    if (v["clarification_basis"] === null || v["clarification_basis"] === undefined) {
      return { ok: false, detail: "conversation proposal.clarification_basis: CLARIFY requires a non-null basis" };
    }
    const basisCheck = validateClarificationBasisV0(v["clarification_basis"], projection);
    if (!basisCheck.ok) return { ok: false, detail: `conversation proposal.${basisCheck.detail}` };
    return {
      ok: true,
      proposal: Object.freeze({
        schema_version: CONVERSATION_COGNITION_PROPOSAL_SCHEMA_VERSION_V2,
        cognition,
        communication_directive: directive,
        clarification_basis: basisCheck.basis
      })
    };
  }
  if (v["clarification_basis"] !== null) {
    return { ok: false, detail: "conversation proposal.clarification_basis: REALIZE requires exactly null" };
  }
  return {
    ok: true,
    proposal: Object.freeze({
      schema_version: CONVERSATION_COGNITION_PROPOSAL_SCHEMA_VERSION_V2,
      cognition,
      communication_directive: directive,
      clarification_basis: null
    })
  };
}

/**
 * The ONE authoritative V2 proposal hash domain. It binds `clarification_basis`
 * explicitly — including `null` for REALIZE — so a V1 hash domain can never be
 * reused for V2 semantic bytes.
 */
export async function deriveConversationCognitionProposalHashV2(
  proposal: ConversationCognitionProposalV2
): Promise<HashV1> {
  return hashEnvelope(CONVERSATION_COGNITION_PROPOSAL_HASH_PROJECTION_V2, {
    schema_version: CONVERSATION_COGNITION_PROPOSAL_SCHEMA_VERSION_V2,
    cognition: proposal.cognition,
    communication_directive: proposal.communication_directive,
    clarification_basis: proposal.clarification_basis
  });
}
