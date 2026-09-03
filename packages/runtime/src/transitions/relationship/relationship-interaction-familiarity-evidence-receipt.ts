/**
 * Relationship Interaction Familiarity Evidence Receipt V0 — the minimum
 * feature-specific durable evidence-admission receipt contract for the FIRST
 * admitted governed Relationship feature
 * (RELATIONSHIP_REGISTERED_FEATURE_ADMISSION_V1, INTERACTION_FAMILIARITY_ONLY).
 *
 * ARCHITECTURE CORRECTION (locked): a raw EpisodicMemoryRecordV0 ref proves
 * only that an episode exists — it does NOT prove the episode passed the
 * interaction-familiarity qualifying admission boundary. Therefore
 *
 *   FAMILIARITY_CREDIT_IDENTITY != RAW_EPISODE_REF
 *
 * and the receipt ref (NOT the raw episode ref) is what may appear in governed
 * evidence_receipt_refs / cause_refs / provenance_refs. The receipt
 * deterministically binds the qualifying evidence identity:
 *   - exact episode ref            - exact episode payload hash
 *   - exact subject id             - exact counterpart ref
 *   - qualifying class             - evidence-admission policy identity
 *
 * CLOSED MINIMUM CONTRACT: this slice deliberately does NOT implement the
 * production semantic classifier or the evidence-ingestion workflow, and this
 * is NOT a generic evidence framework — it is exactly what interaction
 * familiarity needs. The receipt is deterministic under identical canonical
 * inputs, structurally malformed receipts fail closed, caller prose is not
 * evidence, no model-confidence or arbitrary-magnitude field exists, and there
 * is NO mutable receipt store (the receipt is purely derivable from its
 * preimage; no persistence beyond the canonical records that carry its ref).
 *
 * The receipt REF kind is `appraisal` (the frozen deterministic
 * content-addressed admission-judgment family). A raw `episode:` ref alone can
 * never satisfy familiarity receipt-ref validation.
 */

import type { CanonicalRefV0, HashV1, IdentifierV0 } from "@characteros-next/subject-core";
import {
  deriveRef,
  fail,
  isRecord,
  ok,
  validateHash,
  validateIdentifier,
  validateRefElement,
  type ValidationResult
} from "@characteros-next/subject-core";

export const RELATIONSHIP_INTERACTION_FAMILIARITY_EVIDENCE_RECEIPT_SCHEMA_VERSION_V0 =
  "relationship-interaction-familiarity-evidence-receipt-v0" as const;

/** Exact familiarity evidence-admission policy identity (identity + V0 version). */
export const RELATIONSHIP_INTERACTION_FAMILIARITY_EVIDENCE_ADMISSION_POLICY_ID_V0 =
  "relationship-interaction-familiarity-evidence-admission-policy-v0" as const;

export const RELATIONSHIP_INTERACTION_FAMILIARITY_EVIDENCE_RECEIPT_PROJECTION =
  "characteros-next/runtime/relationship-interaction-familiarity-evidence-receipt/v1" as const;

/** Deterministic content-addressed receipt ref family (frozen REF_KINDS member). */
export const RELATIONSHIP_INTERACTION_FAMILIARITY_EVIDENCE_RECEIPT_REF_KIND_V0 =
  "appraisal" as const;

/** Closed qualifying-interaction classes for V0. No free-form class exists. */
export const RELATIONSHIP_INTERACTION_FAMILIARITY_QUALIFYING_CLASSES_V0 = Object.freeze([
  "DIRECT_COMMUNICATION",
  "SHARED_ACTIVITY",
  "DIRECTLY_OBSERVED_COUNTERPART_ACTION"
] as const);

export type RelationshipInteractionFamiliarityQualifyingClassV0 =
  (typeof RELATIONSHIP_INTERACTION_FAMILIARITY_QUALIFYING_CLASSES_V0)[number];

/** Exact closed 7-field familiarity evidence receipt. */
export interface RelationshipInteractionFamiliarityEvidenceReceiptV0 {
  readonly schema_version: typeof RELATIONSHIP_INTERACTION_FAMILIARITY_EVIDENCE_RECEIPT_SCHEMA_VERSION_V0;
  readonly subject_id: IdentifierV0;
  readonly counterpart_ref: CanonicalRefV0;
  readonly episode_ref: CanonicalRefV0;
  readonly episode_payload_hash: HashV1;
  readonly qualifying_class: RelationshipInteractionFamiliarityQualifyingClassV0;
  readonly evidence_admission_policy_id: typeof RELATIONSHIP_INTERACTION_FAMILIARITY_EVIDENCE_ADMISSION_POLICY_ID_V0;
}

const RECEIPT_KEYS: readonly string[] = [
  "schema_version",
  "subject_id",
  "counterpart_ref",
  "episode_ref",
  "episode_payload_hash",
  "qualifying_class",
  "evidence_admission_policy_id"
];

/**
 * Deterministic fail-closed closed-schema receipt validation. Caller prose is
 * not evidence; any structural deviation is rejected.
 */
export function validateRelationshipInteractionFamiliarityEvidenceReceiptV0(
  v: unknown
): ValidationResult<RelationshipInteractionFamiliarityEvidenceReceiptV0> {
  if (!isRecord(v)) return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "receipt: expected object");
  for (const key of Object.keys(v)) {
    if (!RECEIPT_KEYS.includes(key)) {
      return fail("INVALID_SCHEMA", "SS-SCHEMA-001", `receipt.${key}: unknown key`);
    }
  }
  for (const key of RECEIPT_KEYS) {
    if (!Object.keys(v).includes(key)) {
      return fail("INVALID_SCHEMA", "SS-SCHEMA-001", `receipt.${key}: missing key`);
    }
  }
  if (v["schema_version"] !== RELATIONSHIP_INTERACTION_FAMILIARITY_EVIDENCE_RECEIPT_SCHEMA_VERSION_V0) {
    return fail(
      "INVALID_SCHEMA",
      "SS-SCHEMA-001",
      "receipt.schema_version: expected relationship-interaction-familiarity-evidence-receipt-v0"
    );
  }
  const subject = validateIdentifier(v["subject_id"] as string, "receipt.subject_id");
  if (!subject.ok) return subject;
  const counterpart = validateRefElement(v["counterpart_ref"], "receipt.counterpart_ref", [
    "entity",
    "subject"
  ]);
  if (!counterpart.ok) return counterpart;
  const episode = validateRefElement(v["episode_ref"], "receipt.episode_ref", ["episode"]);
  if (!episode.ok) return episode;
  const episodeHash = validateHash(v["episode_payload_hash"] as string, "receipt.episode_payload_hash");
  if (!episodeHash.ok) return episodeHash;
  if (
    typeof v["qualifying_class"] !== "string" ||
    !(RELATIONSHIP_INTERACTION_FAMILIARITY_QUALIFYING_CLASSES_V0 as readonly string[]).includes(
      v["qualifying_class"]
    )
  ) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "receipt.qualifying_class: invalid enum");
  }
  if (v["evidence_admission_policy_id"] !== RELATIONSHIP_INTERACTION_FAMILIARITY_EVIDENCE_ADMISSION_POLICY_ID_V0) {
    return fail(
      "INVALID_SCHEMA",
      "SS-SCHEMA-001",
      "receipt.evidence_admission_policy_id: expected the frozen familiarity evidence-admission policy identity"
    );
  }
  return ok({
    schema_version: RELATIONSHIP_INTERACTION_FAMILIARITY_EVIDENCE_RECEIPT_SCHEMA_VERSION_V0,
    subject_id: subject.value,
    counterpart_ref: counterpart.value,
    episode_ref: episode.value,
    episode_payload_hash: episodeHash.value,
    qualifying_class: v["qualifying_class"] as RelationshipInteractionFamiliarityQualifyingClassV0,
    evidence_admission_policy_id: RELATIONSHIP_INTERACTION_FAMILIARITY_EVIDENCE_ADMISSION_POLICY_ID_V0
  });
}

/**
 * Deterministic receipt ref: `appraisal:<sha256-hex>` under the frozen receipt
 * projection. Pure — identical canonical inputs yield the EXACT same ref; any
 * change to the episode ref, episode payload hash, subject, counterpart,
 * qualifying class or policy identity changes the ref.
 */
export async function deriveRelationshipInteractionFamiliarityEvidenceReceiptRefV0(
  receipt: RelationshipInteractionFamiliarityEvidenceReceiptV0
): Promise<CanonicalRefV0> {
  const checked = validateRelationshipInteractionFamiliarityEvidenceReceiptV0(receipt);
  if (!checked.ok) {
    throw new Error(`relationship interaction familiarity evidence receipt: ${checked.error.detail}`);
  }
  return (await deriveRef(
    RELATIONSHIP_INTERACTION_FAMILIARITY_EVIDENCE_RECEIPT_REF_KIND_V0,
    RELATIONSHIP_INTERACTION_FAMILIARITY_EVIDENCE_RECEIPT_PROJECTION,
    checked.value
  )) as CanonicalRefV0;
}

/**
 * Structural receipt-ref-family check: true iff the value is an
 * `appraisal:`-family ref, the only family familiarity evidence receipt refs
 * live in. A raw `episode:` ref (or any other family) is never a receipt ref.
 * Full receipt validation requires the receipt preimage, which canonical
 * proposals do not carry — refs alone prove family membership, not admission.
 */
export function isRelationshipInteractionFamiliarityEvidenceReceiptRefV0(
  value: unknown
): value is CanonicalRefV0 {
  return (
    typeof value === "string" &&
    value.startsWith(`${RELATIONSHIP_INTERACTION_FAMILIARITY_EVIDENCE_RECEIPT_REF_KIND_V0}:`)
  );
}
