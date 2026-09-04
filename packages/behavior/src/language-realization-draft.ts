/**
 * LanguageRealizationDraftV0 — the ONLY model-produced language-stage structure
 * (PRODUCTION_LANGUAGE_BEHAVIOR_OUTPUT_V0).
 *
 * Closed 4-field schema. The provider must echo the host-computed input_hash
 * EXACTLY and may reference ONLY refs from the lawful evidence allowlist it was
 * given (membership enforcement happens at the trusted executor; this validator
 * enforces the structural law). Malformed output fails; nothing is repaired.
 */

import type { CanonicalRefV0, HashV1 } from "@characteros-next/subject-core";
import {
  fail,
  isRecord,
  ok,
  validateCanonicalText,
  validateHash,
  validateRefArray,
  type ValidationResult
} from "@characteros-next/subject-core";

export const LANGUAGE_REALIZATION_DRAFT_SCHEMA_VERSION_V0 =
  "language-realization-draft-v0" as const;

/** Exact production output bound: no silent trimming, no truncation, no repair. */
export const LANGUAGE_BEHAVIOR_MAX_TEXT_CODE_POINTS_V0 = 4096;

const DRAFT_KEYS: readonly string[] = ["schema_version", "input_hash", "text", "evidence_refs"];

/** Exact closed model-produced language draft. */
export interface LanguageRealizationDraftV0 {
  readonly schema_version: typeof LANGUAGE_REALIZATION_DRAFT_SCHEMA_VERSION_V0;
  readonly input_hash: HashV1;
  readonly text: string;
  readonly evidence_refs: readonly CanonicalRefV0[];
}

/**
 * Deterministic fail-closed validation of the model-produced language draft.
 * text must be canonical NFC text (repository canonical text/control-character
 * rule), non-empty after trim (checked, never repaired), at most
 * LANGUAGE_BEHAVIOR_MAX_TEXT_CODE_POINTS_V0 code points, and evidence_refs must
 * be canonical, unique and raw-ASCII sorted.
 */
export function validateLanguageRealizationDraftV0(v: unknown): ValidationResult<LanguageRealizationDraftV0> {
  if (!isRecord(v)) return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "draft: expected object");
  const keys = Object.keys(v).sort();
  const allowed = [...DRAFT_KEYS].sort();
  if (keys.length !== allowed.length || keys.some((key, index) => key !== allowed[index])) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", `draft: unexpected keys; expected exactly ${allowed.join(",")}`);
  }
  if (v["schema_version"] !== LANGUAGE_REALIZATION_DRAFT_SCHEMA_VERSION_V0) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "draft.schema_version: expected language-realization-draft-v0");
  }
  const inputHash = validateHash(v["input_hash"] as string, "draft.input_hash");
  if (!inputHash.ok) return inputHash;
  const text = v["text"];
  if (typeof text !== "string") {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "draft.text: expected string");
  }
  if (text.trim().length === 0) {
    return fail("INVALID_VALUE_RANGE", "SS-SCHEMA-001", "draft.text: must not be empty or whitespace-only");
  }
  const canonical = validateCanonicalText(text, "draft.text");
  if (!canonical.ok) return canonical;
  if ([...text].length > LANGUAGE_BEHAVIOR_MAX_TEXT_CODE_POINTS_V0) {
    return fail(
      "INVALID_VALUE_RANGE",
      "SS-SCHEMA-001",
      `draft.text: exceeds ${LANGUAGE_BEHAVIOR_MAX_TEXT_CODE_POINTS_V0} code points`
    );
  }
  const refsCheck = validateRefArray(v["evidence_refs"], "draft.evidence_refs", { sorted: true });
  if (!refsCheck.ok) return refsCheck;
  return ok({
    schema_version: LANGUAGE_REALIZATION_DRAFT_SCHEMA_VERSION_V0,
    input_hash: inputHash.value,
    text,
    evidence_refs: v["evidence_refs"] as readonly CanonicalRefV0[]
  });
}
