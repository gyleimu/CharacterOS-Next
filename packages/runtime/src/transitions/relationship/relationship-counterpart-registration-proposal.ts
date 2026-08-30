/**
 * RelationshipState V0 closed counterpart-registration proposal.
 *
 * One proposal registers EXACTLY ONE new counterpart that is NOT yet present in
 * canonical RelationshipState, optionally carrying its explicit initial generic
 * dimension set. This contract contains no semantic inference, no psychology,
 * and no automatic detection: only an explicit, pre-authorized runtime/host
 * request.
 *
 * Dimension cardinality follows the FROZEN RelationshipState contract: the
 * validator truthfully permits `dimensions: []`, so zero-dimension registration
 * is preserved here. Initial dimensions must arrive unique and raw-ASCII-sorted
 * — the same canonical-input rule the frozen state validator and the update
 * proposal already enforce; no normalization is performed.
 */

import type { EpisodeRef } from "@characteros-next/memory";
import { parseEpisodeRef } from "@characteros-next/memory";
import {
  fail,
  hashEnvelope,
  isRecord,
  ok,
  validateHash,
  validateIdentifier,
  validateRefElement,
  validateStateRevision,
  validateUnitInterval,
  type CanonicalRefV0,
  type HashV1,
  type IdentifierV0,
  type StateRevisionV0,
  type TransitionIdV0,
  type UnitIntervalV0,
  type ValidationResult
} from "@characteros-next/subject-core";
import { deriveEvidenceMemberSetFingerprint } from "../evidence-member-set-fingerprint-authority.js";

export const RELATIONSHIP_COUNTERPART_REGISTRATION_PROPOSAL_SCHEMA_VERSION =
  "relationship-counterpart-registration-proposal-v0" as const;
export const RELATIONSHIP_COUNTERPART_REGISTRATION_TRANSITION_ID_PROJECTION =
  "characteros-next/runtime/relationship-counterpart-registration-transition-id/v1" as const;

export interface RelationshipCounterpartRegistrationDimensionV0 {
  readonly dimension_id: IdentifierV0;
  readonly value: UnitIntervalV0;
}

/** Same frozen evidence binding shape as RelationshipUpdateProposalV0. */
export type RelationshipCounterpartRegistrationEvidenceBindingV0 = {
  readonly member_refs: readonly EpisodeRef[];
  readonly member_set_fingerprint: HashV1;
};

export interface RelationshipCounterpartRegistrationProposalV0 {
  readonly schema_version: typeof RELATIONSHIP_COUNTERPART_REGISTRATION_PROPOSAL_SCHEMA_VERSION;
  readonly subject_id: IdentifierV0;
  readonly expected_state_revision: StateRevisionV0;
  readonly counterpart_ref: CanonicalRefV0;
  readonly dimensions: readonly RelationshipCounterpartRegistrationDimensionV0[];
  readonly evidence_binding: RelationshipCounterpartRegistrationEvidenceBindingV0;
}

const PROPOSAL_KEYS: readonly string[] = [
  "schema_version",
  "subject_id",
  "expected_state_revision",
  "counterpart_ref",
  "dimensions",
  "evidence_binding"
];

const DIMENSION_KEYS: readonly string[] = ["dimension_id", "value"];

const EVIDENCE_KEYS: readonly string[] = ["member_refs", "member_set_fingerprint"];

function compareRaw(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/** Closed, fail-closed proposal admission. No normalization or repair. */
export function validateRelationshipCounterpartRegistrationProposal(
  value: unknown
): ValidationResult<RelationshipCounterpartRegistrationProposalV0> {
  if (!isRecord(value)) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "proposal: expected object");
  }
  for (const key of Object.keys(value)) {
    if (!PROPOSAL_KEYS.includes(key)) {
      return fail("INVALID_SCHEMA", "SS-SCHEMA-001", `proposal.${key}: unknown key`);
    }
  }
  if (value["schema_version"] !== RELATIONSHIP_COUNTERPART_REGISTRATION_PROPOSAL_SCHEMA_VERSION) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "proposal.schema_version");
  }
  if (typeof value["subject_id"] !== "string") {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "proposal.subject_id: expected identifier");
  }
  const subject = validateIdentifier(value["subject_id"], "proposal.subject_id");
  if (!subject.ok) return subject;
  if (typeof value["expected_state_revision"] !== "number") {
    return fail(
      "INVALID_VALUE_RANGE",
      "SS-SCHEMA-001",
      "proposal.expected_state_revision: nonnegative safe integer required"
    );
  }
  const revision = validateStateRevision(
    value["expected_state_revision"],
    "proposal.expected_state_revision"
  );
  if (!revision.ok) return revision;
  const counterpart = validateRefElement(
    value["counterpart_ref"],
    "proposal.counterpart_ref",
    ["entity", "subject"]
  );
  if (!counterpart.ok) return counterpart;

  const dimensionsRaw = value["dimensions"];
  if (!Array.isArray(dimensionsRaw)) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "proposal.dimensions: array required");
  }
  const dimensions: RelationshipCounterpartRegistrationDimensionV0[] = [];
  let previousDimensionId: string | undefined;
  for (let i = 0; i < dimensionsRaw.length; i++) {
    const label = `proposal.dimensions[${i}]`;
    const dimension = dimensionsRaw[i];
    if (!isRecord(dimension)) {
      return fail("INVALID_SCHEMA", "SS-SCHEMA-001", `${label}: expected object`);
    }
    for (const key of Object.keys(dimension)) {
      if (!DIMENSION_KEYS.includes(key)) {
        return fail("INVALID_SCHEMA", "SS-SCHEMA-001", `${label}.${key}: unknown key`);
      }
    }
    if (typeof dimension["dimension_id"] !== "string") {
      return fail(
        "INVALID_SCHEMA",
        "SS-SCHEMA-001",
        `${label}.dimension_id: expected identifier`
      );
    }
    const dimensionId = validateIdentifier(dimension["dimension_id"], `${label}.dimension_id`);
    if (!dimensionId.ok) return dimensionId;
    if (previousDimensionId !== undefined && compareRaw(dimensionId.value, previousDimensionId) <= 0) {
      const reason = dimensionId.value === previousDimensionId ? "duplicate" : "not raw-ASCII-sorted";
      return fail("INVALID_SCHEMA", "SS-SCHEMA-001", `${label}.dimension_id: ${reason}`);
    }
    previousDimensionId = dimensionId.value;
    if (typeof dimension["value"] !== "number") {
      return fail("INVALID_VALUE_RANGE", "SS-SCHEMA-001", `${label}.value: number required`);
    }
    const dimensionValue = validateUnitInterval(dimension["value"], `${label}.value`);
    if (!dimensionValue.ok) return dimensionValue;
    dimensions.push({ dimension_id: dimensionId.value, value: dimensionValue.value });
  }

  const evidence = value["evidence_binding"];
  if (!isRecord(evidence)) {
    return fail(
      "INVALID_SCHEMA",
      "SS-SCHEMA-001",
      "proposal.evidence_binding: expected object"
    );
  }
  for (const key of Object.keys(evidence)) {
    if (!EVIDENCE_KEYS.includes(key)) {
      return fail(
        "INVALID_SCHEMA",
        "SS-SCHEMA-001",
        `proposal.evidence_binding.${key}: unknown key`
      );
    }
  }
  const refsRaw = evidence["member_refs"];
  if (!Array.isArray(refsRaw) || refsRaw.length === 0) {
    return fail(
      "INVALID_SCHEMA",
      "SS-SCHEMA-001",
      "proposal.evidence_binding.member_refs: nonempty episode-ref array required"
    );
  }
  const memberRefs: EpisodeRef[] = [];
  let previousRef: string | undefined;
  for (let i = 0; i < refsRaw.length; i++) {
    const parsed = parseEpisodeRef(
      refsRaw[i],
      `proposal.evidence_binding.member_refs[${i}]`
    );
    if (!parsed.ok) return fail("INVALID_SCHEMA", "SS-SCHEMA-001", parsed.error.detail);
    if (previousRef !== undefined && compareRaw(parsed.value, previousRef) <= 0) {
      const reason = parsed.value === previousRef ? "duplicate" : "not raw-ASCII-sorted";
      return fail(
        "INVALID_SCHEMA",
        "SS-SCHEMA-001",
        `proposal.evidence_binding.member_refs[${i}]: ${reason}`
      );
    }
    previousRef = parsed.value;
    memberRefs.push(parsed.value);
  }
  if (typeof evidence["member_set_fingerprint"] !== "string") {
    return fail(
      "INVALID_SCHEMA",
      "SS-SCHEMA-001",
      "proposal.evidence_binding.member_set_fingerprint: sha256 hash required"
    );
  }
  const fingerprint = validateHash(
    evidence["member_set_fingerprint"],
    "proposal.evidence_binding.member_set_fingerprint"
  );
  if (!fingerprint.ok) return fingerprint;

  return ok({
    schema_version: RELATIONSHIP_COUNTERPART_REGISTRATION_PROPOSAL_SCHEMA_VERSION,
    subject_id: subject.value,
    expected_state_revision: revision.value,
    counterpart_ref: counterpart.value,
    dimensions,
    evidence_binding: {
      member_refs: memberRefs,
      member_set_fingerprint: fingerprint.value
    }
  });
}

/** Reuses the frozen, deterministic episode-member-set fingerprint authority. */
export function deriveCounterpartRegistrationEvidenceMemberSetFingerprint(
  memberRefs: readonly EpisodeRef[]
): Promise<HashV1> {
  return deriveEvidenceMemberSetFingerprint(memberRefs);
}

function strip(digest: string): string {
  return digest.replace(/^sha256:/, "");
}

/**
 * Deterministic journal identity for one counterpart-registration intent:
 * subject, expected revision, counterpart, and the exact bound evidence set.
 * Initial dimensions are deliberately payload — not identity — so a same-intent
 * changed dimension set routes to SubjectCore's REUSE_CONFLICT instead of a
 * silent second registration.
 */
export async function deriveRelationshipCounterpartRegistrationTransitionId(
  proposal: RelationshipCounterpartRegistrationProposalV0
): Promise<TransitionIdV0> {
  const digest = strip(
    await hashEnvelope(RELATIONSHIP_COUNTERPART_REGISTRATION_TRANSITION_ID_PROJECTION, {
      subject_id: proposal.subject_id,
      expected_state_revision: proposal.expected_state_revision,
      counterpart_ref: proposal.counterpart_ref,
      evidence_fingerprint: proposal.evidence_binding.member_set_fingerprint,
      evidence_refs: proposal.evidence_binding.member_refs
    })
  );
  const raw = `t-relationship-registration-${digest}`;
  const checked = validateIdentifier(raw, "relationship.registration.transition_id");
  if (!checked.ok) {
    throw new Error(
      `RELATIONSHIP_REGISTRATION_TRANSITION_ID_INVALID: ${checked.error.reason} ${checked.error.detail}`
    );
  }
  const identifier: string = checked.value;
  return identifier as TransitionIdV0;
}
