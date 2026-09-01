/**
 * BeliefState V0 closed mutation proposal.
 *
 * INSERT registers exactly one CharacterOS-owned proposition key and immutable
 * label. UPDATE targets one existing proposition id and carries only its next
 * subjective credence. Evidence is an exact nonempty canonical episode set.
 */

import type { EpisodeRef } from "@characteros-next/memory";
import { parseEpisodeRef } from "@characteros-next/memory";
import {
  fail,
  hashEnvelope,
  isRecord,
  ok,
  validateBeliefPropositionLabel,
  validateHash,
  validateIdentifier,
  validateStateRevision,
  validateUnitInterval,
  type HashV1,
  type IdentifierV0,
  type StateRevisionV0,
  type TransitionIdV0,
  type UnitIntervalV0,
  type ValidationResult
} from "@characteros-next/subject-core";
import { deriveEvidenceMemberSetFingerprint } from "../evidence-member-set-fingerprint-authority.js";

export const BELIEF_MUTATION_PROPOSAL_SCHEMA_VERSION =
  "belief-mutation-proposal-v0" as const;
export const BELIEF_TRANSITION_ID_PROJECTION =
  "characteros-next/runtime/belief-transition-id/v1" as const;

export interface BeliefEvidenceBindingV0 {
  readonly member_refs: readonly EpisodeRef[];
  readonly member_set_fingerprint: HashV1;
}

export type BeliefMutationV0 =
  | {
      readonly kind: "INSERT";
      readonly proposition_key: IdentifierV0;
      readonly proposition_label: string;
      readonly initial_credence: UnitIntervalV0;
    }
  | {
      readonly kind: "UPDATE";
      readonly proposition_id: IdentifierV0;
      readonly next_credence: UnitIntervalV0;
    };

export interface BeliefMutationProposalV0 {
  readonly schema_version: typeof BELIEF_MUTATION_PROPOSAL_SCHEMA_VERSION;
  readonly subject_id: IdentifierV0;
  readonly expected_state_revision: StateRevisionV0;
  readonly mutation: BeliefMutationV0;
  readonly evidence_binding: BeliefEvidenceBindingV0;
}

const PROPOSAL_KEYS: readonly string[] = [
  "schema_version",
  "subject_id",
  "expected_state_revision",
  "mutation",
  "evidence_binding"
];
const INSERT_KEYS: readonly string[] = [
  "kind",
  "proposition_key",
  "proposition_label",
  "initial_credence"
];
const UPDATE_KEYS: readonly string[] = ["kind", "proposition_id", "next_credence"];
const EVIDENCE_KEYS: readonly string[] = ["member_refs", "member_set_fingerprint"];

function compareRaw(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function rejectUnknownKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  detail: string
): ValidationResult<void> {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      return fail("INVALID_SCHEMA", "SS-SCHEMA-001", `${detail}.${key}: unknown key`);
    }
  }
  return ok(undefined);
}

/** Closed, fail-closed proposal admission. No normalization or repair. */
export function validateBeliefMutationProposal(
  value: unknown
): ValidationResult<BeliefMutationProposalV0> {
  if (!isRecord(value)) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "proposal: expected object");
  }
  const proposalKeys = rejectUnknownKeys(value, PROPOSAL_KEYS, "proposal");
  if (!proposalKeys.ok) return proposalKeys;
  if (value["schema_version"] !== BELIEF_MUTATION_PROPOSAL_SCHEMA_VERSION) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "proposal.schema_version");
  }
  if (typeof value["subject_id"] !== "string") {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "proposal.subject_id: expected identifier");
  }
  const subjectId = validateIdentifier(value["subject_id"], "proposal.subject_id");
  if (!subjectId.ok) return subjectId;
  if (typeof value["expected_state_revision"] !== "number") {
    return fail(
      "INVALID_VALUE_RANGE",
      "SS-SCHEMA-001",
      "proposal.expected_state_revision: nonnegative safe integer required"
    );
  }
  const expectedRevision = validateStateRevision(
    value["expected_state_revision"],
    "proposal.expected_state_revision"
  );
  if (!expectedRevision.ok) return expectedRevision;

  const rawMutation = value["mutation"];
  if (!isRecord(rawMutation)) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "proposal.mutation: expected object");
  }
  let mutation: BeliefMutationV0;
  if (rawMutation["kind"] === "INSERT") {
    const mutationKeys = rejectUnknownKeys(rawMutation, INSERT_KEYS, "proposal.mutation");
    if (!mutationKeys.ok) return mutationKeys;
    if (typeof rawMutation["proposition_key"] !== "string") {
      return fail(
        "INVALID_SCHEMA",
        "SS-SCHEMA-001",
        "proposal.mutation.proposition_key: expected identifier"
      );
    }
    const propositionKey = validateIdentifier(
      rawMutation["proposition_key"],
      "proposal.mutation.proposition_key"
    );
    if (!propositionKey.ok) return propositionKey;
    const propositionLabel = validateBeliefPropositionLabel(
      rawMutation["proposition_label"],
      "proposal.mutation.proposition_label"
    );
    if (!propositionLabel.ok) return propositionLabel;
    if (typeof rawMutation["initial_credence"] !== "number") {
      return fail(
        "INVALID_VALUE_RANGE",
        "SS-SCHEMA-001",
        "proposal.mutation.initial_credence: number required"
      );
    }
    const initialCredence = validateUnitInterval(
      rawMutation["initial_credence"],
      "proposal.mutation.initial_credence"
    );
    if (!initialCredence.ok) return initialCredence;
    mutation = {
      kind: "INSERT",
      proposition_key: propositionKey.value,
      proposition_label: propositionLabel.value,
      initial_credence: initialCredence.value
    };
  } else if (rawMutation["kind"] === "UPDATE") {
    const mutationKeys = rejectUnknownKeys(rawMutation, UPDATE_KEYS, "proposal.mutation");
    if (!mutationKeys.ok) return mutationKeys;
    if (typeof rawMutation["proposition_id"] !== "string") {
      return fail(
        "INVALID_SCHEMA",
        "SS-SCHEMA-001",
        "proposal.mutation.proposition_id: expected identifier"
      );
    }
    const propositionId = validateIdentifier(
      rawMutation["proposition_id"],
      "proposal.mutation.proposition_id"
    );
    if (!propositionId.ok) return propositionId;
    if (typeof rawMutation["next_credence"] !== "number") {
      return fail(
        "INVALID_VALUE_RANGE",
        "SS-SCHEMA-001",
        "proposal.mutation.next_credence: number required"
      );
    }
    const nextCredence = validateUnitInterval(
      rawMutation["next_credence"],
      "proposal.mutation.next_credence"
    );
    if (!nextCredence.ok) return nextCredence;
    mutation = {
      kind: "UPDATE",
      proposition_id: propositionId.value,
      next_credence: nextCredence.value
    };
  } else {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "proposal.mutation.kind: invalid enum");
  }

  const rawEvidence = value["evidence_binding"];
  if (!isRecord(rawEvidence)) {
    return fail(
      "INVALID_SCHEMA",
      "SS-SCHEMA-001",
      "proposal.evidence_binding: expected object"
    );
  }
  const evidenceKeys = rejectUnknownKeys(
    rawEvidence,
    EVIDENCE_KEYS,
    "proposal.evidence_binding"
  );
  if (!evidenceKeys.ok) return evidenceKeys;
  const rawRefs = rawEvidence["member_refs"];
  if (!Array.isArray(rawRefs) || rawRefs.length === 0) {
    return fail(
      "INVALID_SCHEMA",
      "SS-SCHEMA-001",
      "proposal.evidence_binding.member_refs: nonempty episode-ref array required"
    );
  }
  const memberRefs: EpisodeRef[] = [];
  let previousRef: string | undefined;
  for (let index = 0; index < rawRefs.length; index++) {
    const parsed = parseEpisodeRef(
      rawRefs[index],
      `proposal.evidence_binding.member_refs[${index}]`
    );
    if (!parsed.ok) {
      return fail("INVALID_SCHEMA", "SS-SCHEMA-001", parsed.error.detail);
    }
    if (previousRef !== undefined && compareRaw(parsed.value, previousRef) <= 0) {
      const reason = parsed.value === previousRef ? "duplicate" : "not raw-ASCII-sorted";
      return fail(
        "INVALID_SCHEMA",
        "SS-SCHEMA-001",
        `proposal.evidence_binding.member_refs[${index}]: ${reason}`
      );
    }
    previousRef = parsed.value;
    memberRefs.push(parsed.value);
  }
  if (typeof rawEvidence["member_set_fingerprint"] !== "string") {
    return fail(
      "INVALID_SCHEMA",
      "SS-SCHEMA-001",
      "proposal.evidence_binding.member_set_fingerprint: sha256 hash required"
    );
  }
  const memberSetFingerprint = validateHash(
    rawEvidence["member_set_fingerprint"],
    "proposal.evidence_binding.member_set_fingerprint"
  );
  if (!memberSetFingerprint.ok) return memberSetFingerprint;

  return ok({
    schema_version: BELIEF_MUTATION_PROPOSAL_SCHEMA_VERSION,
    subject_id: subjectId.value,
    expected_state_revision: expectedRevision.value,
    mutation,
    evidence_binding: {
      member_refs: memberRefs,
      member_set_fingerprint: memberSetFingerprint.value
    }
  });
}

/** Reuses the frozen deterministic episode member-set fingerprint authority. */
export function deriveBeliefEvidenceMemberSetFingerprint(
  memberRefs: readonly EpisodeRef[]
): Promise<HashV1> {
  return deriveEvidenceMemberSetFingerprint(memberRefs);
}

/**
 * Journal intent binds target/registration intent and evidence, while label and
 * credence remain payload so changed values under the same intent conflict.
 */
export async function deriveBeliefTransitionId(
  proposal: BeliefMutationProposalV0
): Promise<TransitionIdV0> {
  const target =
    proposal.mutation.kind === "INSERT"
      ? { kind: "INSERT" as const, proposition_key: proposal.mutation.proposition_key }
      : { kind: "UPDATE" as const, proposition_id: proposal.mutation.proposition_id };
  const digest = await hashEnvelope(BELIEF_TRANSITION_ID_PROJECTION, {
    subject_id: proposal.subject_id,
    expected_state_revision: proposal.expected_state_revision,
    mutation_intent: target,
    evidence_fingerprint: proposal.evidence_binding.member_set_fingerprint,
    evidence_refs: proposal.evidence_binding.member_refs
  });
  const raw = `t-belief-${digest.replace(/^sha256:/, "")}`;
  const checked = validateIdentifier(raw, "belief.transition_id");
  if (!checked.ok) {
    throw new Error(`BELIEF_TRANSITION_ID_INVALID: ${checked.error.reason} ${checked.error.detail}`);
  }
  const identifier: string = checked.value;
  return identifier as TransitionIdV0;
}
