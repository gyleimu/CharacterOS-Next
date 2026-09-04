/**
 * CharacterLanguageBehaviorV0 — the closed HOST-GENERATED production artifact
 * (PRODUCTION_LANGUAGE_BEHAVIOR_OUTPUT_V0).
 *
 * The provider chooses ONLY the validated draft content (text + evidence refs
 * + echoed input_hash). subject_id, source_revision, response_request_id and
 * behavior_id are host-owned: no provider, no product caller and no draft can
 * mint the final behavior artifact. Only trusted internal execution (the
 * conversation response executor) constructs it from an already-validated
 * draft.
 *
 * behavior_id is deterministic artifact identity under the existing
 * canonical/hashEnvelope convention — NOT proof of delivery, NOT state
 * authority, NOT Memory authority, and no second identity framework.
 *
 * This artifact is NOT canonical subject state: production of a behavior
 * mutates nothing.
 */

import type { CanonicalRefV0, HashV1, IdentifierV0, StateRevisionV0 } from "@characteros-next/subject-core";
import { hashEnvelope, isRecord, validateIdentifier, validateStateRevision } from "@characteros-next/subject-core";

import {
  LANGUAGE_BEHAVIOR_MAX_TEXT_CODE_POINTS_V0,
  type LanguageRealizationDraftV0
} from "./language-realization-draft.js";

export const CHARACTER_LANGUAGE_BEHAVIOR_SCHEMA_VERSION_V0 =
  "character-language-behavior-v0" as const;

export const CHARACTER_LANGUAGE_BEHAVIOR_ID_PROJECTION_V0 =
  "characteros-next/behavior/character-language-behavior/v1" as const;

/** Exact closed host-generated production behavior artifact. */
export interface CharacterLanguageBehaviorV0 {
  readonly schema_version: typeof CHARACTER_LANGUAGE_BEHAVIOR_SCHEMA_VERSION_V0;
  readonly behavior_id: HashV1;
  readonly subject_id: IdentifierV0;
  readonly source_revision: StateRevisionV0;
  readonly response_request_id: IdentifierV0;
  readonly input_hash: HashV1;
  readonly text: string;
  readonly evidence_refs: readonly CanonicalRefV0[];
}

export type CharacterLanguageBehaviorConstructionInputV0 = {
  readonly subject_id: IdentifierV0;
  readonly source_revision: StateRevisionV0;
  readonly response_request_id: IdentifierV0;
  /** The already-validated model draft (schema + binding + evidence checked). */
  readonly draft: LanguageRealizationDraftV0;
};

/**
 * Deterministic host-owned construction of the final production behavior from
 * an ALREADY-VALIDATED draft. Fails closed on any malformed host binding field
 * or a draft violating the frozen text bound. Deep-freezes the artifact.
 */
export async function buildCharacterLanguageBehaviorV0(
  input: unknown
): Promise<{ ok: true; behavior: CharacterLanguageBehaviorV0 } | { ok: false; detail: string }> {
  if (!isRecord(input)) {
    return { ok: false, detail: "behavior construction input: expected object" };
  }
  const subjectId = validateIdentifier(input["subject_id"] as string, "behavior.subject_id");
  if (!subjectId.ok) return { ok: false, detail: subjectId.error.detail };
  const revision = validateStateRevision(
    input["source_revision"] as number,
    "behavior.source_revision"
  );
  if (!revision.ok) return { ok: false, detail: revision.error.detail };
  const requestId = validateIdentifier(
    input["response_request_id"] as string,
    "behavior.response_request_id"
  );
  if (!requestId.ok) return { ok: false, detail: requestId.error.detail };
  const draft = input["draft"] as LanguageRealizationDraftV0 | undefined;
  if (
    draft === undefined ||
    typeof draft !== "object" ||
    draft.schema_version !== "language-realization-draft-v0" ||
    typeof draft.text !== "string" ||
    typeof draft.input_hash !== "string" ||
    !Array.isArray(draft.evidence_refs)
  ) {
    return { ok: false, detail: "behavior construction requires a validated language draft" };
  }
  if ([...draft.text].length > LANGUAGE_BEHAVIOR_MAX_TEXT_CODE_POINTS_V0) {
    return { ok: false, detail: "draft.text exceeds the frozen code-point bound" };
  }
  const behavior: CharacterLanguageBehaviorV0 = {
    schema_version: CHARACTER_LANGUAGE_BEHAVIOR_SCHEMA_VERSION_V0,
    behavior_id: await hashEnvelope(CHARACTER_LANGUAGE_BEHAVIOR_ID_PROJECTION_V0, {
      schema_version: CHARACTER_LANGUAGE_BEHAVIOR_SCHEMA_VERSION_V0,
      input_hash: draft.input_hash,
      text: draft.text,
      evidence_refs: draft.evidence_refs
    }),
    subject_id: subjectId.value,
    source_revision: revision.value,
    response_request_id: requestId.value,
    input_hash: draft.input_hash,
    text: draft.text,
    evidence_refs: draft.evidence_refs
  };
  return { ok: true, behavior: Object.freeze(behavior) };
}
