/**
 * Clarification Behavior V0 — host-owned deterministic clarification renderer
 * (STRUCTURED_COMMUNICATION_DIRECTIVE_V0).
 *
 * For validated CLARIFY_MISSING_CONTEXT: the host renders EXACTLY ONE fixed
 * template. No model generation, no user text, no scene interpolation, no
 * Memory interpolation, no stylistic addition, no second template. The
 * renderer owns the text; the caller cannot supply arbitrary clarification
 * text. evidence_refs is always [].
 */

import type { HashV1, IdentifierV0, StateRevisionV0 } from "@characteros-next/subject-core";
import { hashEnvelope, isRecord, validateIdentifier, validateStateRevision } from "@characteros-next/subject-core";
import type { CharacterLanguageBehaviorV0 } from "./character-language-behavior.js";
import { CHARACTER_LANGUAGE_BEHAVIOR_SCHEMA_VERSION_V0, CHARACTER_LANGUAGE_BEHAVIOR_ID_PROJECTION_V0 } from "./character-language-behavior.js";

export const CLARIFICATION_RENDERER_ID_V0 = "clarify-missing-context-en-v0" as const;
export const CLARIFICATION_TEXT_V0 = "Could you clarify what you mean?" as const;
export const CLARIFICATION_REALIZATION_INPUT_SCHEMA_VERSION_V0 = "clarification-realization-input-v0" as const;
export const CLARIFICATION_REALIZATION_INPUT_HASH_PROJECTION_V0 =
  "characteros-next/behavior/clarification-realization-input/v1" as const;

export interface ClarificationRealizationInputV0 {
  readonly schema_version: typeof CLARIFICATION_REALIZATION_INPUT_SCHEMA_VERSION_V0;
  readonly subject_id: IdentifierV0;
  readonly source_revision: StateRevisionV0;
  readonly response_request_id: IdentifierV0;
  readonly cognition_projection_hash: HashV1;
  readonly conversation_cognition_proposal_hash: HashV1;
  readonly communication_directive: { readonly kind: "CLARIFY_MISSING_CONTEXT" };
  readonly renderer_id: typeof CLARIFICATION_RENDERER_ID_V0;
}

export async function deriveClarificationRealizationInputHashV0(
  input: ClarificationRealizationInputV0
): Promise<HashV1> {
  return hashEnvelope(CLARIFICATION_REALIZATION_INPUT_HASH_PROJECTION_V0, input);
}

export async function buildClarificationBehaviorV0(input: {
  readonly subject_id: IdentifierV0;
  readonly source_revision: StateRevisionV0;
  readonly response_request_id: IdentifierV0;
  readonly cognition_projection_hash: HashV1;
  readonly conversation_cognition_proposal_hash: HashV1;
}): Promise<{ ok: true; behavior: CharacterLanguageBehaviorV0 } | { ok: false; detail: string }> {
  if (!isRecord(input)) return { ok: false, detail: "clarification input: expected object" };
  const sid = validateIdentifier(input["subject_id"] as string, "subject_id");
  if (!sid.ok) return { ok: false, detail: sid.error.detail };
  const rev = validateStateRevision(input["source_revision"] as number, "source_revision");
  if (!rev.ok) return { ok: false, detail: rev.error.detail };
  const rid = validateIdentifier(input["response_request_id"] as string, "response_request_id");
  if (!rid.ok) return { ok: false, detail: rid.error.detail };

  const clarificationInput: ClarificationRealizationInputV0 = {
    schema_version: CLARIFICATION_REALIZATION_INPUT_SCHEMA_VERSION_V0,
    subject_id: sid.value,
    source_revision: rev.value,
    response_request_id: rid.value,
    cognition_projection_hash: input.cognition_projection_hash,
    conversation_cognition_proposal_hash: input.conversation_cognition_proposal_hash,
    communication_directive: { kind: "CLARIFY_MISSING_CONTEXT" },
    renderer_id: CLARIFICATION_RENDERER_ID_V0
  };
  const inputHash = await hashEnvelope(CLARIFICATION_REALIZATION_INPUT_HASH_PROJECTION_V0, clarificationInput);
  const behavior: CharacterLanguageBehaviorV0 = Object.freeze({
    schema_version: CHARACTER_LANGUAGE_BEHAVIOR_SCHEMA_VERSION_V0,
    behavior_id: await hashEnvelope(CHARACTER_LANGUAGE_BEHAVIOR_ID_PROJECTION_V0, {
      schema_version: CHARACTER_LANGUAGE_BEHAVIOR_SCHEMA_VERSION_V0,
      input_hash: inputHash,
      text: CLARIFICATION_TEXT_V0,
      evidence_refs: []
    }),
    subject_id: sid.value,
    source_revision: rev.value,
    response_request_id: rid.value,
    input_hash: inputHash,
    text: CLARIFICATION_TEXT_V0,
    evidence_refs: []
  });
  return { ok: true, behavior };
}
