/** Model-produced semantic content for the C2 language stage.
 * Integrity and request identity are deliberately absent: the host owns them.
 */

import type { CanonicalRefV0 } from "@characteros-next/subject-core";
import {
  fail,
  isRecord,
  ok,
  validateCanonicalText,
  validateRefArray,
  type ValidationResult
} from "@characteros-next/subject-core";
import { LANGUAGE_BEHAVIOR_MAX_TEXT_CODE_POINTS_V0 } from "./language-realization-draft.js";

export const LANGUAGE_REALIZATION_SEMANTIC_DRAFT_SCHEMA_VERSION_V1 =
  "language-realization-semantic-draft-v1" as const;

export interface LanguageRealizationSemanticDraftV1 {
  readonly schema_version: typeof LANGUAGE_REALIZATION_SEMANTIC_DRAFT_SCHEMA_VERSION_V1;
  readonly text: string;
  readonly evidence_refs: readonly CanonicalRefV0[];
}

const KEYS: readonly string[] = ["schema_version", "text", "evidence_refs"];

export function validateLanguageRealizationSemanticDraftV1(
  value: unknown
): ValidationResult<LanguageRealizationSemanticDraftV1> {
  if (!isRecord(value)) return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "semantic draft: expected object");
  const actual = Object.keys(value).sort();
  const expected = [...KEYS].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", `semantic draft: unexpected keys; expected exactly ${expected.join(",")}`);
  }
  if (value["schema_version"] !== LANGUAGE_REALIZATION_SEMANTIC_DRAFT_SCHEMA_VERSION_V1) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "semantic draft.schema_version mismatch");
  }
  const text = validateCanonicalText(value["text"], "semantic draft.text");
  if (!text.ok) return text;
  if (text.value.trim().length === 0) {
    return fail("INVALID_VALUE_RANGE", "SS-SCHEMA-001", "semantic draft.text: must not be empty");
  }
  if ([...text.value].length > LANGUAGE_BEHAVIOR_MAX_TEXT_CODE_POINTS_V0) {
    return fail(
      "INVALID_VALUE_RANGE",
      "SS-SCHEMA-001",
      `semantic draft.text: exceeds ${LANGUAGE_BEHAVIOR_MAX_TEXT_CODE_POINTS_V0} code points`
    );
  }
  const refs = validateRefArray(value["evidence_refs"], "semantic draft.evidence_refs", { sorted: true });
  if (!refs.ok) return refs;
  return ok({
    schema_version: LANGUAGE_REALIZATION_SEMANTIC_DRAFT_SCHEMA_VERSION_V1,
    text: text.value,
    evidence_refs: value["evidence_refs"] as readonly CanonicalRefV0[]
  });
}
