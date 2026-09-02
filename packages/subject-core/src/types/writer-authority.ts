/**
 * CanonicalWriterAuthorityRecordV0 — SubjectCore-owned generic writer-authority
 * envelope for AtomicCommitBundleV2
 * (ATOMIC_COMMIT_BUNDLE_V2_AUTHORITY_SCHEMA_FOUNDATION, LEVEL_2 durable store
 * trust contract).
 *
 * EXECUTABLE DISTINCTION (frozen):
 *   a structurally valid authority record
 *     != an authorized governed write
 *
 * This envelope is DURABLE, PERSISTED DATA only. It deliberately contains NO
 * runtime capability / WeakSet material — process-local capability authority is
 * a separate, non-persisted concern owned by the producing runtime module.
 *
 * authority_payload is an opaque canonical JSON object at this layer; the
 * per-family payload schema (e.g. the Relationship governed feature payload)
 * is validated by the family-owned closed validator in its owning package.
 */

import type { CanonicalRefV0 } from "./ref.js";
import type { HashV1, IdentifierV0 } from "./scalars.js";

/** Exact schema version literal for the generic writer-authority envelope. */
export const CANONICAL_WRITER_AUTHORITY_RECORD_SCHEMA_VERSION =
  "canonical-writer-authority-record-v0" as const;

/** Frozen writer-family vocabulary. One family exists in V0. */
export const CANONICAL_WRITER_FAMILIES_V0 = Object.freeze([
  "RELATIONSHIP_GOVERNED_FEATURE"
] as const);

export type CanonicalWriterFamilyV0 = (typeof CANONICAL_WRITER_FAMILIES_V0)[number];

/**
 * Frozen writer-class vocabulary. Classes are valid only inside their family;
 * RELATIONSHIP_GOVERNED_FEATURE admits exactly INITIALIZE / UPDATE /
 * REINITIALIZE. Removal of a governed dimension is unsupported.
 */
export const CANONICAL_WRITER_CLASSES_V0 = Object.freeze([
  "INITIALIZE",
  "UPDATE",
  "REINITIALIZE"
] as const);

export type CanonicalWriterClassV0 = (typeof CANONICAL_WRITER_CLASSES_V0)[number];

/**
 * Family-scoped class admission. Kept explicit so the validator can reject a
 * structurally well-spelled class that the family does not admit.
 */
export const CANONICAL_WRITER_FAMILY_CLASSES_V0: Readonly<
  Record<CanonicalWriterFamilyV0, readonly CanonicalWriterClassV0[]>
> = Object.freeze({
  RELATIONSHIP_GOVERNED_FEATURE: Object.freeze([
    "INITIALIZE",
    "UPDATE",
    "REINITIALIZE"
  ] as const)
});

/**
 * The generic durable writer-authority envelope. Exact 11 top-level fields,
 * all required, no optional fields.
 */
export interface CanonicalWriterAuthorityRecordV0 {
  readonly schema_version: typeof CANONICAL_WRITER_AUTHORITY_RECORD_SCHEMA_VERSION;
  readonly proposal_ref: CanonicalRefV0;
  readonly payload_fingerprint: HashV1;

  readonly writer_family: CanonicalWriterFamilyV0;
  readonly writer_class: CanonicalWriterClassV0;

  readonly writer_schema_id: IdentifierV0;
  readonly writer_schema_fingerprint: HashV1;

  readonly authorization_gate_id: IdentifierV0;
  readonly authorization_gate_fingerprint: HashV1;

  /** Opaque canonical JSON object; family-owned schema, never a capability. */
  readonly authority_payload: Record<string, unknown>;
  readonly authority_payload_hash: HashV1;
}
