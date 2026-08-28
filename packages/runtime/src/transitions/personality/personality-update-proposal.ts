/**
 * PersonalityState V0 — PersonalityUpdateProposalV0 contract, fail-closed
 * validation, and deterministic transition identity derivation.
 *
 * The proposal carries ONLY what the frozen architecture requires: target
 * dimensions (EXISTING registered ones only), bounded next values, the
 * expected canonical state revision, and auditable evidence binding. Evidence
 * binding uses only truthfully durable identifiers today: the episode refs of
 * the aggregate members plus a deterministic fingerprint over the aggregate
 * content — no fabricated durable references.
 *
 * This slice does NOT define how evidence produces a proposed value (that is
 * the future PersonalityPlasticityProducerV0).
 */

import type {
  HashV1,
  IdentifierV0,
  StateRevisionV0,
  UnitIntervalV0
} from "@characteros-next/subject-core";
import type { EpisodeRef } from "@characteros-next/memory";
import { fail, ok, isRecord, validateIdentifier, validateUnitInterval, type ValidationResult } from "@characteros-next/subject-core";
import { hashEnvelope } from "@characteros-next/subject-core";

export const PERSONALITY_UPDATE_PROPOSAL_SCHEMA_VERSION = "personality-update-proposal-v0" as const;
export const PERSONALITY_TRANSITION_ID_PROJECTION =
  "characteros-next/runtime/personality-transition-id/v1" as const;
export const PERSONALITY_EVIDENCE_MEMBER_SET_PROJECTION =
  "characteros-next/runtime/personality-evidence-member-set/v1" as const;

export interface PersonalityDimensionUpdateV0 {
  readonly dimension_id: IdentifierV0;
  readonly next_value: UnitIntervalV0;
}

/** Auditable evidence binding: only truthfully verifiable identifiers. */
export interface PersonalityEvidenceBindingV0 {
  /** Durable episode refs backing the evidence set (verbatim passthrough). */
  readonly member_refs: readonly EpisodeRef[];
  /**
   * EVIDENCE_MEMBER_SET_FINGERPRINT: deterministically recomputed over the
   * canonical sorted member_refs ONLY. It does NOT claim to bind quantitative
   * aggregate metrics (the executor recomputes and verifies it).
   */
  readonly member_set_fingerprint: HashV1;
}

export interface PersonalityUpdateProposalV0 {
  readonly schema_version: typeof PERSONALITY_UPDATE_PROPOSAL_SCHEMA_VERSION;
  readonly subject_id: IdentifierV0;
  readonly expected_state_revision: StateRevisionV0;
  /** 1..n updates; unique + raw-ASCII-sorted by dimension_id; atomic all-or-nothing. */
  readonly updates: readonly PersonalityDimensionUpdateV0[];
  readonly evidence_binding: PersonalityEvidenceBindingV0;
}

const PROPOSAL_KEYS: readonly string[] = [
  "schema_version",
  "subject_id",
  "expected_state_revision",
  "updates",
  "evidence_binding"
];

function isNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** Fail-closed proposal validation: closed keys, bounds, ordering, uniqueness. */
export function validatePersonalityUpdateProposal(
  v: unknown
): ValidationResult<PersonalityUpdateProposalV0> {
  if (!isRecord(v)) return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "proposal: expected object");
  for (const key of Object.keys(v)) {
    if (!PROPOSAL_KEYS.includes(key)) {
      return fail("INVALID_SCHEMA", "SS-SCHEMA-001", `proposal.${key}: unknown key`);
    }
  }
  if (v["schema_version"] !== PERSONALITY_UPDATE_PROPOSAL_SCHEMA_VERSION) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "proposal.schema_version");
  }
  const subjectRaw = v["subject_id"];
  if (typeof subjectRaw !== "string") return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "proposal.subject_id: expected identifier");
  const subject = validateIdentifier(subjectRaw, "proposal.subject_id");
  if (!subject.ok) return subject;
  const rev = v["expected_state_revision"];
  if (!isNumber(rev) || !Number.isSafeInteger(rev) || rev < 0) {
    return fail("INVALID_VALUE_RANGE", "SS-SCHEMA-001", "proposal.expected_state_revision: nonnegative safe integer required");
  }
  const updatesRaw = v["updates"];
  if (!Array.isArray(updatesRaw) || updatesRaw.length === 0) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "proposal.updates: nonempty array required");
  }
  const updates: PersonalityDimensionUpdateV0[] = [];
  let prevId: string | undefined;
  for (let i = 0; i < updatesRaw.length; i++) {
    const label = `proposal.updates[${i}]`;
    const item = updatesRaw[i];
    if (!isRecord(item)) return fail("INVALID_SCHEMA", "SS-SCHEMA-001", `${label}: expected object`);
    for (const key of Object.keys(item)) {
      if (key !== "dimension_id" && key !== "next_value") {
        return fail("INVALID_SCHEMA", "SS-SCHEMA-001", `${label}.${key}: unknown key`);
      }
    }
    const idRaw = item["dimension_id"];
    if (typeof idRaw !== "string") return fail("INVALID_SCHEMA", "SS-SCHEMA-001", `${label}.dimension_id: expected identifier`);
    const id = validateIdentifier(idRaw, `${label}.dimension_id`);
    if (!id.ok) return id;
    if (prevId !== undefined) {
      if (id.value === prevId) return fail("INVALID_SCHEMA", "SS-SCHEMA-001", `${label}: duplicate dimension_id`);
      if (id.value < prevId) return fail("INVALID_SCHEMA", "SS-SCHEMA-001", `${label}: dimension_ids not raw-ASCII-sorted`);
    }
    prevId = id.value;
    const value = validateUnitInterval(item["next_value"] as number, `${label}.next_value`);
    if (!value.ok) return value;
    updates.push({ dimension_id: id.value, next_value: value.value });
  }
  const eb = v["evidence_binding"];
  if (!isRecord(eb)) return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "proposal.evidence_binding: expected object");
  for (const key of Object.keys(eb)) {
    if (key !== "member_refs" && key !== "member_set_fingerprint") {
      return fail("INVALID_SCHEMA", "SS-SCHEMA-001", `proposal.evidence_binding.${key}: unknown key`);
    }
  }
  const refs = eb["member_refs"];
  if (!Array.isArray(refs) || refs.length === 0) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "proposal.evidence_binding.member_refs: nonempty episode-ref array required");
  }
  for (let i = 0; i < refs.length; i++) {
    if (typeof refs[i] !== "string" || !(refs[i] as string).startsWith("episode:")) {
      return fail("INVALID_SCHEMA", "SS-SCHEMA-001", `proposal.evidence_binding.member_refs[${i}]: episode ref required`);
    }
  }
  const fp = eb["member_set_fingerprint"];
  if (typeof fp !== "string" || !fp.startsWith("sha256:")) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "proposal.evidence_binding.member_set_fingerprint: sha256 hash required");
  }
  return ok({
      schema_version: PERSONALITY_UPDATE_PROPOSAL_SCHEMA_VERSION,
      subject_id: subject.value as IdentifierV0,
      expected_state_revision: rev as unknown as StateRevisionV0,
      updates: updates.map((u) => ({
        dimension_id: u.dimension_id as IdentifierV0,
        next_value: u.next_value as UnitIntervalV0
      })),
      evidence_binding: {
        member_refs: refs as unknown as readonly EpisodeRef[],
        member_set_fingerprint: fp as HashV1
      }
    });
}

function strip(digest: string): string {
  return digest.replace(/^sha256:/, "");
}

/**
 * EVIDENCE_MEMBER_SET_FINGERPRINT derivation — deterministically recomputable
 * from the canonical sorted member refs. Verified by the executor at execution
 * time; it does NOT hash quantitative aggregate metrics (honest naming).
 */
export async function deriveEvidenceMemberSetFingerprint(
  memberRefs: readonly EpisodeRef[]
): Promise<HashV1> {
  return hashEnvelope(PERSONALITY_EVIDENCE_MEMBER_SET_PROJECTION, {
    member_refs: [...memberRefs].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  });
}

/**
 * Deterministic transition identity: bound to subject, expected revision, the
 * exact update set and the evidence member-set fingerprint. No randomUUID,
 * Math.random, or wall clock. Same proposal ⇒ same transition id ⇒ SubjectCore
 * journal replay semantics apply (ALREADY_COMMITTED / REUSE_CONFLICT).
 */
export async function derivePersonalityTransitionId(
  proposal: PersonalityUpdateProposalV0
): Promise<string> {
  const digest = strip(
    await hashEnvelope(PERSONALITY_TRANSITION_ID_PROJECTION, {
      subject_id: proposal.subject_id,
      expected_state_revision: proposal.expected_state_revision,
      updates: proposal.updates,
      evidence_fingerprint: proposal.evidence_binding.member_set_fingerprint,
      evidence_refs: proposal.evidence_binding.member_refs
    })
  );
  return `t-personality-${digest}`;
}
