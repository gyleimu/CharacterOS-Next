/**
 * Prepared Governed Writer Authority Membrane V0
 * (RELATIONSHIP_GOVERNED_FEATURE_WRITER_AUTHORITY_V0, LEVEL_2).
 *
 * The NARROW generic private membrane through which SubjectCore's existing V2
 * production pipeline can lawfully consume an INTERNAL prepared governed
 * authority token:
 *
 *   ordinary path      → token absent  → writer_authority = null (unchanged)
 *   governed path      → ONLY a SubjectCore-issued, WeakSet-admitted,
 *                        deeply frozen prepared token → the assembler
 *                        materializes the EXACT CanonicalWriterAuthorityRecordV0
 *
 * EXECUTABLE DISTINCTIONS (frozen):
 *   structurally valid token    != minted token (object identity admission)
 *   minted token                != authorized governed write (the minting
 *                                 decision belongs to the producing runtime's
 *                                 CharacterOS-owned authority service; this
 *                                 membrane binds and verifies ONLY)
 *   serialized token            != authority (the token is never durable data;
 *                                 the durable record is projected from it)
 *
 * TRUST LEVEL (frozen): LEVEL_2 application composition authority. Deep-import
 * of this module is technically possible in TypeScript; no OS/security
 * isolation is claimed. The ISSUER and VERIFIER are deliberately NOT
 * root-exported — the public surface exposes only TYPES plus the generic
 * reserved-target boundary helper (§4 single source of truth).
 *
 * With the Relationship feature registry at ZERO entries no runtime path can
 * lawfully reach the issuer for a real production write, so every ordinary
 * production V2 record keeps writer_authority = null
 * (PRODUCTION_NON_NULL_GOVERNED_WRITER_AUTHORITY_WITH_FEATURE_COUNT_ZERO = ZERO).
 */

import type { CanonicalRefV0 } from "../types/ref.js";
import type { HashV1, IdentifierV0, StateRevisionV0 } from "../types/scalars.js";
import type { SubjectStateV0 } from "../types/subject-state.js";
import type {
  CanonicalWriterClassV0,
  CanonicalWriterFamilyV0
} from "../types/writer-authority.js";

// ---- §4 generic reserved-target boundary (single source of truth) -------------------

/**
 * The exact reserved prefix for CharacterOS-governed Relationship feature
 * dimension ids. ONE source of truth: the Runtime Relationship namespace
 * module re-exports this exact constant; no second independently-maintained
 * prefix literal exists.
 */
export const RELATIONSHIP_GOVERNED_DIMENSION_RESERVED_PREFIX_V0 = "relationship_core_" as const;

/**
 * Pure exact-prefix classifier (exact same behavior as the historical Runtime
 * helper): true iff the identifier's exact beginning is `relationship_core_`.
 * No fuzzy matching, no case folding, no regex guessing.
 */
export function isReservedRelationshipCoreDimensionIdV0(dimensionId: string): boolean {
  return dimensionId.startsWith(RELATIONSHIP_GOVERNED_DIMENSION_RESERVED_PREFIX_V0);
}

// ---- §30 reserved-target commit-law detection -----------------------------------------

/** One reserved-target occurrence diff between the predecessor and candidate. */
export interface ReservedRelationshipTargetChangeV0 {
  readonly counterpart_ref: string;
  readonly dimension_id: string;
  readonly kind: "CHANGED" | "ADDED" | "REMOVED";
  readonly previous_value: unknown;
  readonly next_value: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function valuesDiffer(a: unknown, b: unknown): boolean {
  if (a === b) return false;
  return JSON.stringify(a) !== JSON.stringify(b);
}

function readReservedOccurrences(
  state: SubjectStateV0,
  out: Map<string, { counterpart_ref: string; dimension_id: string; value: unknown }>
): { readonly ok: true } | { readonly ok: false; readonly detail: string } {
  const relationships = (state as unknown as Record<string, unknown>)["relationships"];
  if (relationships === undefined || relationships === null) return { ok: true };
  if (!isRecord(relationships)) {
    return { ok: false, detail: "relationships: expected object" };
  }
  const counterparts = relationships["counterparts"];
  if (counterparts === undefined) return { ok: true };
  if (!Array.isArray(counterparts)) {
    return { ok: false, detail: "relationships.counterparts: expected array" };
  }
  for (const counterpart of counterparts) {
    if (!isRecord(counterpart)) {
      return { ok: false, detail: "relationships.counterparts[i]: expected object" };
    }
    const counterpartRef = counterpart["counterpart_ref"];
    if (typeof counterpartRef !== "string") {
      return { ok: false, detail: "relationships.counterparts[i].counterpart_ref: expected string" };
    }
    const dimensions = counterpart["dimensions"];
    if (dimensions === undefined) continue;
    if (!Array.isArray(dimensions)) {
      return { ok: false, detail: "relationships.counterparts[i].dimensions: expected array" };
    }
    for (const dimension of dimensions) {
      if (!isRecord(dimension)) {
        return { ok: false, detail: "relationships.dimensions[j]: expected object" };
      }
      const dimensionId = dimension["dimension_id"];
      if (typeof dimensionId !== "string") {
        return { ok: false, detail: "relationships.dimensions[j].dimension_id: expected string" };
      }
      if (!isReservedRelationshipCoreDimensionIdV0(dimensionId)) continue;
      out.set(`${counterpartRef}\u0000${dimensionId}`, {
        counterpart_ref: counterpartRef,
        dimension_id: dimensionId,
        value: dimension["value"]
      });
    }
  }
  return { ok: true };
}

/**
 * §30 commit-law helper: detect EXACTLY which reserved `relationship_core_*`
 * target occurrences changed between the exact predecessor canonical state and
 * the exact prepared candidate state (no text parsing — structural diff of the
 * canonical Relationship projection). Unreadable Relationship blocks fail
 * closed so a governed change can never hide behind an unreadable shape.
 * Ordinary non-reserved dimensions never appear in the result.
 */
export function detectReservedRelationshipTargetChangesV0(
  predecessor: SubjectStateV0,
  candidate: SubjectStateV0
): { readonly ok: true; readonly changes: readonly ReservedRelationshipTargetChangeV0[] } | {
  readonly ok: false;
  readonly detail: string;
} {
  const before = new Map<string, { counterpart_ref: string; dimension_id: string; value: unknown }>();
  const after = new Map<string, { counterpart_ref: string; dimension_id: string; value: unknown }>();
  const beforeRead = readReservedOccurrences(predecessor, before);
  if (!beforeRead.ok) return { ok: false, detail: `predecessor ${beforeRead.detail}` };
  const afterRead = readReservedOccurrences(candidate, after);
  if (!afterRead.ok) return { ok: false, detail: `candidate ${afterRead.detail}` };

  const changes: ReservedRelationshipTargetChangeV0[] = [];
  for (const [key, prior] of before) {
    const next = after.get(key);
    if (next === undefined) {
      changes.push({
        counterpart_ref: prior.counterpart_ref,
        dimension_id: prior.dimension_id,
        kind: "REMOVED",
        previous_value: prior.value,
        next_value: null
      });
    } else if (valuesDiffer(prior.value, next.value)) {
      changes.push({
        counterpart_ref: prior.counterpart_ref,
        dimension_id: prior.dimension_id,
        kind: "CHANGED",
        previous_value: prior.value,
        next_value: next.value
      });
    }
  }
  for (const [key, next] of after) {
    if (!before.has(key)) {
      changes.push({
        counterpart_ref: next.counterpart_ref,
        dimension_id: next.dimension_id,
        kind: "ADDED",
        previous_value: null,
        next_value: next.value
      });
    }
  }
  return { ok: true, changes };
}

// ---- §23 prepared authority token ----------------------------------------------------

export const PREPARED_GOVERNED_WRITER_AUTHORITY_TOKEN_SCHEMA_VERSION_V0 =
  "prepared-governed-writer-authority-token-v0" as const;

/**
 * Opaque, deeply frozen, WeakSet-admitted prepared governed-authority token.
 * Exact 13-field closed shape. The generic membrane binds the commit-identity
 * facts it can verify against the live commit (proposal identity, revision,
 * head) plus the family/record identity fields the assembler materializes;
 * the family-specific bindings (counterpart, dimension, operation, previous/
 * next, feature semantics, policy, receipt, evidence refs, prior authority,
 * epoch) live inside the opaque family-validated authority_payload, whose
 * hash binds them immutably into the durable record.
 */
export interface PreparedGovernedWriterAuthorityTokenV0 {
  readonly membrane_schema_version: typeof PREPARED_GOVERNED_WRITER_AUTHORITY_TOKEN_SCHEMA_VERSION_V0;
  readonly proposal_ref: CanonicalRefV0;
  readonly payload_fingerprint: HashV1;
  readonly subject_id: IdentifierV0;
  readonly expected_revision: StateRevisionV0;
  /** commit_ref of the trusted canonical head the token was minted against; null at R0. */
  readonly history_head_commit_ref: CanonicalRefV0 | null;
  readonly writer_family: CanonicalWriterFamilyV0;
  readonly writer_class: CanonicalWriterClassV0;
  readonly writer_schema_id: IdentifierV0;
  readonly writer_schema_fingerprint: HashV1;
  readonly authorization_gate_id: IdentifierV0;
  readonly authorization_gate_fingerprint: HashV1;
  /** Opaque canonical JSON object; family-owned closed schema, never a capability. */
  readonly authority_payload: Record<string, unknown>;
}

const TOKEN_KEYS: readonly string[] = [
  "membrane_schema_version",
  "proposal_ref",
  "payload_fingerprint",
  "subject_id",
  "expected_revision",
  "history_head_commit_ref",
  "writer_family",
  "writer_class",
  "writer_schema_id",
  "writer_schema_fingerprint",
  "authorization_gate_id",
  "authorization_gate_fingerprint",
  "authority_payload"
];

const WRITER_FAMILIES: ReadonlySet<string> = new Set(["RELATIONSHIP_GOVERNED_FEATURE"]);
const WRITER_CLASSES: ReadonlySet<string> = new Set(["INITIALIZE", "UPDATE", "REINITIALIZE"]);

const trustedTokens = new WeakSet<object>();

export interface MintPreparedGovernedWriterAuthorityTokenInputV0 {
  readonly proposal_ref: CanonicalRefV0;
  readonly payload_fingerprint: HashV1;
  readonly subject_id: IdentifierV0;
  readonly expected_revision: StateRevisionV0;
  readonly history_head_commit_ref: CanonicalRefV0 | null;
  readonly writer_family: CanonicalWriterFamilyV0;
  readonly writer_class: CanonicalWriterClassV0;
  readonly writer_schema_id: IdentifierV0;
  readonly writer_schema_fingerprint: HashV1;
  readonly authorization_gate_id: IdentifierV0;
  readonly authorization_gate_fingerprint: HashV1;
  readonly authority_payload: Record<string, unknown>;
}

function structuralTokenCheck(v: unknown): v is PreparedGovernedWriterAuthorityTokenV0 {
  if (!isRecord(v)) return false;
  const keys = Object.keys(v).sort();
  const expected = [...TOKEN_KEYS].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    return false;
  }
  if (v["membrane_schema_version"] !== PREPARED_GOVERNED_WRITER_AUTHORITY_TOKEN_SCHEMA_VERSION_V0) {
    return false;
  }
  if (typeof v["proposal_ref"] !== "string" || !v["proposal_ref"].startsWith("proposal:")) {
    return false;
  }
  for (const hashField of ["payload_fingerprint", "writer_schema_fingerprint", "authorization_gate_fingerprint"]) {
    if (typeof v[hashField] !== "string" || !v[hashField].startsWith("sha256:")) return false;
  }
  if (typeof v["subject_id"] !== "string" || v["subject_id"].length === 0) return false;
  if (typeof v["expected_revision"] !== "number" || !Number.isSafeInteger(v["expected_revision"]) || v["expected_revision"] < 0) {
    return false;
  }
  const headRef = v["history_head_commit_ref"];
  if (headRef !== null && (typeof headRef !== "string" || !headRef.startsWith("commit:"))) return false;
  if (!WRITER_FAMILIES.has(v["writer_family"] as string)) return false;
  if (!WRITER_CLASSES.has(v["writer_class"] as string)) return false;
  for (const idField of ["writer_schema_id", "authorization_gate_id"]) {
    if (typeof v[idField] !== "string" || v[idField].length === 0) return false;
  }
  if (!isRecord(v["authority_payload"])) return false;
  return true;
}

function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  if (Object.isFrozen(value)) return;
  Object.freeze(value);
  for (const key of Object.keys(value as Record<string, unknown>)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
}

/**
 * INTERNAL prepared-token issuer. Deliberately NOT root-exported: only
 * trusted internal composition (and module-direct internal tests) may mint.
 * Minting a token binds it — it does NOT authorize anything by itself.
 */
export function mintPreparedGovernedWriterAuthorityTokenV0(
  input: MintPreparedGovernedWriterAuthorityTokenInputV0
): PreparedGovernedWriterAuthorityTokenV0 {
  const token: PreparedGovernedWriterAuthorityTokenV0 = {
    membrane_schema_version: PREPARED_GOVERNED_WRITER_AUTHORITY_TOKEN_SCHEMA_VERSION_V0,
    proposal_ref: input.proposal_ref,
    payload_fingerprint: input.payload_fingerprint,
    subject_id: input.subject_id,
    expected_revision: input.expected_revision,
    history_head_commit_ref: input.history_head_commit_ref,
    writer_family: input.writer_family,
    writer_class: input.writer_class,
    writer_schema_id: input.writer_schema_id,
    writer_schema_fingerprint: input.writer_schema_fingerprint,
    authorization_gate_id: input.authorization_gate_id,
    authorization_gate_fingerprint: input.authorization_gate_fingerprint,
    authority_payload: input.authority_payload
  };
  if (!structuralTokenCheck(token)) {
    throw new Error("prepared governed writer authority token: malformed mint input (fail closed)");
  }
  deepFreeze(token);
  trustedTokens.add(token);
  return token;
}

export type VerifyPreparedGovernedWriterAuthorityTokenFailureV0 =
  | "NOT_ADMITTED"
  | "MALFORMED_TOKEN";

/**
 * INTERNAL verifier (WeakSet admission + structural re-check). Deliberately
 * NOT root-exported. A structural clone of a minted token is rejected
 * (NOT_ADMITTED); a serialized token is never authority.
 */
export function verifyPreparedGovernedWriterAuthorityTokenV0(
  value: unknown
): { readonly ok: true; readonly token: PreparedGovernedWriterAuthorityTokenV0 } | {
  readonly ok: false;
  readonly code: VerifyPreparedGovernedWriterAuthorityTokenFailureV0;
} {
  if (!structuralTokenCheck(value)) return { ok: false, code: "MALFORMED_TOKEN" };
  if (!trustedTokens.has(value as object)) return { ok: false, code: "NOT_ADMITTED" };
  return { ok: true, token: value as PreparedGovernedWriterAuthorityTokenV0 };
}
