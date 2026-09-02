/**
 * RelationshipGovernedFeatureWriterAuthorityPayloadV0 — the family-owned
 * durable authority payload for RELATIONSHIP_GOVERNED_FEATURE writer records
 * (ATOMIC_COMMIT_BUNDLE_V2_AUTHORITY_SCHEMA_FOUNDATION, LEVEL_2).
 *
 * TYPE / CLOSED VALIDATOR CONTRACT ONLY. Validating this payload structurally
 * DOES NOT mean the write is authorized — no current feature registry lookup,
 * no write-policy execution, no predecessor snapshot diff, and no current
 * provenance verification happens here. Those are later validation stages.
 *
 * Field semantics (exact 17 fields, no optional fields):
 *   - dimension_id MUST be inside the CharacterOS reserved namespace
 *     relationship_core_* (an ordinary opaque dimension can never be the
 *     target of a governed writer record).
 *   - previous/next use exact tagged unions; removal is unsupported by schema.
 *   - previous_governed_authority chains the prior durable authority record
 *     (NONE at epoch start).
 *   - evidence_receipt_refs are nonempty, unique, raw-ASCII sorted; a later
 *     stage binds them to the canonical proposal cause refs.
 */

import type { HashV1, IdentifierV0, StateRevisionV0, UnitIntervalV0 } from "@characteros-next/subject-core";
import {
  fail,
  hashEnvelope,
  isRecord,
  isString,
  ok,
  validateHash,
  validateIdentifier,
  validateRefElement,
  validateRelationshipState,
  validateStateRevision,
  validateUnitInterval,
  type CanonicalRefV0,
  type ValidationResult
} from "@characteros-next/subject-core";

import type { AtomicCommitBundleV2 } from "@characteros-next/subject-core";
import { isReservedRelationshipCoreDimensionIdV0 } from "./relationship-governed-dimension-namespace.js";

export const RELATIONSHIP_GOVERNED_FEATURE_WRITER_AUTHORITY_PAYLOAD_SCHEMA_VERSION =
  "relationship-governed-feature-writer-authority-payload-v0" as const;

export const RELATIONSHIP_GOVERNED_FEATURE_WRITER_AUTHORITY_PAYLOAD_PROJECTION =
  "characteros-next/runtime/relationship-governed-writer-authority-payload/v1" as const;

export const RELATIONSHIP_GOVERNED_WRITER_OPERATION_KINDS_V0 = Object.freeze([
  "INITIALIZE",
  "UPDATE",
  "REINITIALIZE"
] as const);

export type RelationshipGovernedWriterOperationKindV0 =
  (typeof RELATIONSHIP_GOVERNED_WRITER_OPERATION_KINDS_V0)[number];

/** Exact tagged previous-value union. */
export type RelationshipGovernedFeaturePreviousValueV0 =
  | { readonly kind: "ABSENT" }
  | { readonly kind: "PRESENT"; readonly value: UnitIntervalV0 };

/** Exact tagged next-value union (removal unsupported). */
export type RelationshipGovernedFeatureNextValueV0 = {
  readonly kind: "PRESENT";
  readonly value: UnitIntervalV0;
};

/** Exact tagged prior-authority chain union. */
export type RelationshipGovernedFeaturePreviousGovernedAuthorityV0 =
  | { readonly kind: "NONE" }
  | {
      readonly kind: "PRIOR";
      readonly commit_ref: CanonicalRefV0;
      readonly authority_payload_hash: HashV1;
    };

/** Exact 17-field durable Relationship governed writer authority payload. */
export interface RelationshipGovernedFeatureWriterAuthorityPayloadV0 {
  readonly schema_version: typeof RELATIONSHIP_GOVERNED_FEATURE_WRITER_AUTHORITY_PAYLOAD_SCHEMA_VERSION;
  readonly operation_kind: RelationshipGovernedWriterOperationKindV0;

  readonly subject_id: IdentifierV0;
  readonly expected_revision: StateRevisionV0;

  readonly counterpart_ref: CanonicalRefV0;
  readonly dimension_id: IdentifierV0;

  readonly previous: RelationshipGovernedFeaturePreviousValueV0;
  readonly next: RelationshipGovernedFeatureNextValueV0;

  readonly relationship_state_schema_version: "relationship-state-v0";

  readonly feature_semantics_contract_id: IdentifierV0;
  readonly feature_semantics_contract_fingerprint: HashV1;

  readonly write_policy_id: IdentifierV0;
  readonly write_policy_fingerprint: HashV1;

  readonly evidence_receipt_refs: readonly CanonicalRefV0[];
  readonly write_policy_receipt_ref: CanonicalRefV0;

  readonly authority_epoch_start_transition_id: IdentifierV0;
  readonly previous_governed_authority: RelationshipGovernedFeaturePreviousGovernedAuthorityV0;
}

const PAYLOAD_KEYS: readonly string[] = [
  "schema_version",
  "operation_kind",
  "subject_id",
  "expected_revision",
  "counterpart_ref",
  "dimension_id",
  "previous",
  "next",
  "relationship_state_schema_version",
  "feature_semantics_contract_id",
  "feature_semantics_contract_fingerprint",
  "write_policy_id",
  "write_policy_fingerprint",
  "evidence_receipt_refs",
  "write_policy_receipt_ref",
  "authority_epoch_start_transition_id",
  "previous_governed_authority"
];

const PREVIOUS_VALUE_KEYS: readonly string[] = ["kind", "value"];
const PRIOR_AUTHORITY_KEYS: readonly string[] = ["kind", "commit_ref", "authority_payload_hash"];

function rawAsciiCompare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Deterministic fail-closed closed-schema validation of the Relationship
 * governed writer authority payload. Structural validity here does NOT
 * authorize anything.
 */
export function validateRelationshipGovernedFeatureWriterAuthorityPayloadV0(
  v: unknown
): ValidationResult<RelationshipGovernedFeatureWriterAuthorityPayloadV0> {
  if (!isRecord(v)) return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "payload: expected object");
  for (const key of Object.keys(v)) {
    if (!PAYLOAD_KEYS.includes(key)) {
      return fail("INVALID_SCHEMA", "SS-SCHEMA-001", `payload.${key}: unknown key`);
    }
  }
  for (const key of PAYLOAD_KEYS) {
    if (!Object.keys(v).includes(key)) {
      return fail("INVALID_SCHEMA", "SS-SCHEMA-001", `payload.${key}: missing key`);
    }
  }

  if (
    v["schema_version"] !== RELATIONSHIP_GOVERNED_FEATURE_WRITER_AUTHORITY_PAYLOAD_SCHEMA_VERSION
  ) {
    return fail(
      "INVALID_SCHEMA",
      "SS-SCHEMA-001",
      "payload.schema_version: expected relationship-governed-feature-writer-authority-payload-v0"
    );
  }

  if (
    !isString(v["operation_kind"]) ||
    !(RELATIONSHIP_GOVERNED_WRITER_OPERATION_KINDS_V0 as readonly string[]).includes(v["operation_kind"])
  ) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "payload.operation_kind: invalid enum");
  }
  const operationKind = v["operation_kind"] as RelationshipGovernedWriterOperationKindV0;

  const subject = validateIdentifier(v["subject_id"] as string, "payload.subject_id");
  if (!subject.ok) return subject;
  const revision = validateStateRevision(v["expected_revision"] as number, "payload.expected_revision");
  if (!revision.ok) return revision;
  const counterpart = validateRefElement(v["counterpart_ref"], "payload.counterpart_ref", [
    "entity",
    "subject"
  ]);
  if (!counterpart.ok) return counterpart;
  const dimension = validateIdentifier(v["dimension_id"] as string, "payload.dimension_id");
  if (!dimension.ok) return dimension;
  // Reserved-namespace requirement: a governed writer record can only target
  // a relationship_core_* dimension; ordinary opaque dimensions are rejected.
  if (!isReservedRelationshipCoreDimensionIdV0(dimension.value)) {
    return fail(
      "INVALID_SCHEMA",
      "SS-SCHEMA-001",
      "payload.dimension_id: governed writer records require a reserved relationship_core_* dimension"
    );
  }

  const previous = v["previous"];
  if (!isRecord(previous)) return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "payload.previous: expected object");
  const previousKind = previous["kind"];
  if (previousKind === "ABSENT") {
    if (Object.keys(previous).length !== 1) {
      return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "payload.previous: ABSENT must have exactly {kind}");
    }
  } else if (previousKind === "PRESENT") {
    const closed =
      Object.keys(previous).length === PREVIOUS_VALUE_KEYS.length &&
      PREVIOUS_VALUE_KEYS.every((key) => Object.keys(previous).includes(key));
    if (!closed) {
      return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "payload.previous: PRESENT must have exactly {kind, value}");
    }
    const value = validateUnitInterval(previous["value"] as number, "payload.previous.value");
    if (!value.ok) return value;
  } else {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "payload.previous.kind: invalid enum");
  }

  const next = v["next"];
  if (!isRecord(next)) return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "payload.next: expected object");
  if (next["kind"] !== "PRESENT") {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "payload.next.kind: removal is unsupported; expected PRESENT");
  }
  if (
    Object.keys(next).length !== PREVIOUS_VALUE_KEYS.length ||
    !PREVIOUS_VALUE_KEYS.every((key) => Object.keys(next).includes(key))
  ) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "payload.next: PRESENT must have exactly {kind, value}");
  }
  const nextValue = validateUnitInterval(next["value"] as number, "payload.next.value");
  if (!nextValue.ok) return nextValue;

  if (v["relationship_state_schema_version"] !== "relationship-state-v0") {
    return fail(
      "INVALID_SCHEMA",
      "SS-SCHEMA-001",
      "payload.relationship_state_schema_version: expected relationship-state-v0"
    );
  }

  const semanticsId = validateIdentifier(
    v["feature_semantics_contract_id"] as string,
    "payload.feature_semantics_contract_id"
  );
  if (!semanticsId.ok) return semanticsId;
  const semanticsFingerprint = validateHash(
    v["feature_semantics_contract_fingerprint"] as string,
    "payload.feature_semantics_contract_fingerprint"
  );
  if (!semanticsFingerprint.ok) return semanticsFingerprint;

  const policyId = validateIdentifier(v["write_policy_id"] as string, "payload.write_policy_id");
  if (!policyId.ok) return policyId;
  const policyFingerprint = validateHash(
    v["write_policy_fingerprint"] as string,
    "payload.write_policy_fingerprint"
  );
  if (!policyFingerprint.ok) return policyFingerprint;

  const evidenceRaw = v["evidence_receipt_refs"];
  if (!Array.isArray(evidenceRaw) || evidenceRaw.length === 0) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "payload.evidence_receipt_refs: nonempty array required");
  }
  const evidence: CanonicalRefV0[] = [];
  let previousRef: string | undefined;
  for (let i = 0; i < evidenceRaw.length; i++) {
    const ref = validateRefElement(evidenceRaw[i], `payload.evidence_receipt_refs[${i}]`);
    if (!ref.ok) return ref;
    if (previousRef !== undefined && rawAsciiCompare(ref.value, previousRef) <= 0) {
      const reason = ref.value === previousRef ? "duplicate" : "not raw-ASCII-sorted";
      return fail(
        "INVALID_SCHEMA",
        "SS-SCHEMA-001",
        `payload.evidence_receipt_refs[${i}]: ${reason}`
      );
    }
    previousRef = ref.value;
    evidence.push(ref.value);
  }

  const receipt = validateRefElement(v["write_policy_receipt_ref"], "payload.write_policy_receipt_ref", [
    "workflow"
  ]);
  if (!receipt.ok) return receipt;

  const epoch = validateIdentifier(
    v["authority_epoch_start_transition_id"] as string,
    "payload.authority_epoch_start_transition_id"
  );
  if (!epoch.ok) return epoch;

  const prior = v["previous_governed_authority"];
  if (!isRecord(prior)) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "payload.previous_governed_authority: expected object");
  }
  const priorKind = prior["kind"];
  if (priorKind === "NONE") {
    if (Object.keys(prior).length !== 1) {
      return fail(
        "INVALID_SCHEMA",
        "SS-SCHEMA-001",
        "payload.previous_governed_authority: NONE must have exactly {kind}"
      );
    }
  } else if (priorKind === "PRIOR") {
    const closed =
      Object.keys(prior).length === PRIOR_AUTHORITY_KEYS.length &&
      PRIOR_AUTHORITY_KEYS.every((key) => Object.keys(prior).includes(key));
    if (!closed) {
      return fail(
        "INVALID_SCHEMA",
        "SS-SCHEMA-001",
        "payload.previous_governed_authority: PRIOR must have exactly {kind, commit_ref, authority_payload_hash}"
      );
    }
    const commitRef = validateRefElement(prior["commit_ref"], "payload.previous_governed_authority.commit_ref", [
      "commit"
    ]);
    if (!commitRef.ok) return commitRef;
    const priorHash = validateHash(
      prior["authority_payload_hash"] as string,
      "payload.previous_governed_authority.authority_payload_hash"
    );
    if (!priorHash.ok) return priorHash;
  } else {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "payload.previous_governed_authority.kind: invalid enum");
  }

  // Operation-kind cross-field rules (§5).
  if (operationKind === "INITIALIZE" && previousKind !== "ABSENT") {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "payload.previous: INITIALIZE requires previous.kind ABSENT");
  }
  if ((operationKind === "UPDATE" || operationKind === "REINITIALIZE") && previousKind !== "PRESENT") {
    return fail(
      "INVALID_SCHEMA",
      "SS-SCHEMA-001",
      `payload.previous: ${operationKind} requires previous.kind PRESENT`
    );
  }

  return ok({
    schema_version: RELATIONSHIP_GOVERNED_FEATURE_WRITER_AUTHORITY_PAYLOAD_SCHEMA_VERSION,
    operation_kind: operationKind,
    subject_id: subject.value,
    expected_revision: revision.value,
    counterpart_ref: counterpart.value,
    dimension_id: dimension.value,
    previous: previous as RelationshipGovernedFeaturePreviousValueV0,
    next: { kind: "PRESENT", value: nextValue.value },
    relationship_state_schema_version: "relationship-state-v0",
    feature_semantics_contract_id: semanticsId.value,
    feature_semantics_contract_fingerprint: semanticsFingerprint.value,
    write_policy_id: policyId.value,
    write_policy_fingerprint: policyFingerprint.value,
    evidence_receipt_refs: evidence,
    write_policy_receipt_ref: receipt.value,
    authority_epoch_start_transition_id: epoch.value,
    previous_governed_authority: prior as RelationshipGovernedFeaturePreviousGovernedAuthorityV0
  });
}

/**
 * Deterministic payload fingerprint under the runtime payload namespace
 * (diagnostic/integrity support only — the durable binding hash for a V2
 * record is subject-core's writer-authority-record projection).
 */
export async function deriveRelationshipGovernedFeatureWriterAuthorityPayloadFingerprintV0(
  payload: RelationshipGovernedFeatureWriterAuthorityPayloadV0
): Promise<HashV1> {
  return hashEnvelope(
    RELATIONSHIP_GOVERNED_FEATURE_WRITER_AUTHORITY_PAYLOAD_PROJECTION,
    payload
  );
}

// ---- §23 single-record cross-binding validation -------------------------------------

/**
 * Deterministic RELATIONSHIP_GOVERNED_FEATURE cross-binding validation
 * possible WITHOUT predecessor state. Input MUST be a bundle that already
 * passed validateAtomicCommitBundleV2 (structural stage).
 *
 * Verifies (single-record provable only):
 *   - writer_family = RELATIONSHIP_GOVERNED_FEATURE
 *   - writer_class = authority_payload.operation_kind
 *   - payload subject_id = canonical_proposal.subject_id
 *   - payload expected_revision = canonical_proposal.expected_state_revision
 *   - dimension_id reserved (relationship_core_*)
 *   - evidence refs nonempty/unique/sorted (payload validator) and exactly
 *     equal to canonical_proposal.cause_refs and the sole Relationship delta
 *     provenance_refs
 *   - canonical_proposal.external_refs exactly [write_policy_receipt_ref]
 *   - exactly one Relationship-domain delta with the current canonical
 *     replacement semantics expected by frozen Relationship transitions, and
 *     the replacement state carries payload.next for the payload dimension
 *
 * Deliberately NOT validated here (chain-validator stages):
 *   previous.value against the prior canonical snapshot, prior UPDATE
 *   provenance continuation, epoch continuity, no-other-member semantic diff.
 */
export function validateRelationshipGovernedFeatureAuthorityBindingV0(input: {
  readonly bundle: AtomicCommitBundleV2;
  readonly authority_payload: Record<string, unknown>;
}): ValidationResult<void> {
  const bundle = input.bundle;
  const authority = bundle.writer_authority;
  if (authority === null) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "authority: writer_authority is null");
  }
  if (authority.writer_family !== "RELATIONSHIP_GOVERNED_FEATURE") {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "authority: writer_family must be RELATIONSHIP_GOVERNED_FEATURE");
  }

  const payload = validateRelationshipGovernedFeatureWriterAuthorityPayloadV0(input.authority_payload);
  if (!payload.ok) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", `authority payload: ${payload.error.detail}`);
  }
  const p = payload.value;

  if (authority.writer_class !== p.operation_kind) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "authority: writer_class must equal payload.operation_kind");
  }
  const proposal = bundle.canonical_proposal;
  if (p.subject_id !== proposal.subject_id) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "authority payload.subject_id must equal canonical_proposal.subject_id");
  }
  if (p.expected_revision !== proposal.expected_state_revision) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "authority payload.expected_revision must equal canonical_proposal.expected_state_revision");
  }
  if (isReservedRelationshipCoreDimensionIdV0(p.dimension_id) === false) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "authority payload.dimension_id must be reserved relationship_core_*");
  }

  const relationshipDeltas = proposal.domain_deltas.filter((delta) => delta.domain === "relationship");
  if (relationshipDeltas.length !== 1) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "canonical_proposal must contain exactly one relationship-domain delta");
  }
  const relationshipDelta = relationshipDeltas[0];
  if (relationshipDelta === undefined) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "canonical_proposal relationship delta missing");
  }

  if (proposal.cause_refs.length !== p.evidence_receipt_refs.length ||
    !proposal.cause_refs.every((ref, index) => ref === p.evidence_receipt_refs[index])) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "canonical_proposal.cause_refs must exactly equal payload.evidence_receipt_refs");
  }
  if (
    relationshipDelta.provenance_refs.length !== p.evidence_receipt_refs.length ||
    !relationshipDelta.provenance_refs.every((ref, index) => ref === p.evidence_receipt_refs[index])
  ) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "relationship delta provenance_refs must exactly equal payload.evidence_receipt_refs");
  }

  if (
    proposal.external_refs.length !== 1 ||
    proposal.external_refs[0] !== p.write_policy_receipt_ref
  ) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "canonical_proposal.external_refs must be exactly [write_policy_receipt_ref]");
  }

  // Canonical replacement semantics: exactly the frozen whole-relationships
  // replacement shape minted by the frozen Relationship transitions.
  if (relationshipDelta.operations.length !== 1) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "relationship delta must contain exactly one operation");
  }
  const operation = relationshipDelta.operations[0];
  if (operation === undefined || operation.path !== "/relationships") {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "relationship delta operation must replace /relationships");
  }
  const replacement = validateRelationshipState(operation.value, "relationship delta replacement");
  if (!replacement.ok) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", `relationship delta replacement: ${replacement.error.reason} ${replacement.error.detail}`);
  }
  const replacementState = operation.value as unknown as {
    counterparts: readonly { counterpart_ref: string; dimensions: readonly { dimension_id: string; value: unknown }[] }[];
  };
  const counterpart = replacementState.counterparts.find(
    (candidate) => candidate.counterpart_ref === p.counterpart_ref
  );
  if (counterpart === undefined) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "replacement state must contain the payload counterpart");
  }
  const dimension = counterpart.dimensions.find(
    (candidate) => candidate.dimension_id === p.dimension_id
  );
  if (dimension === undefined) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "replacement state must contain the payload dimension");
  }
  if (dimension.value !== (p.next.value as number)) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "replacement dimension value must equal payload.next.value");
  }

  return ok(undefined);
}
