/**
 * EXPERIENCE_APPRAISAL_INTEGRATION_V0 — Appraisal provider port + canonical
 * reader + find-INITIAL resolver.
 *
 * PROVIDER PORT (§12/§13): the provider may propose ONLY the six subjective
 * dimensions, the assessment confidence and evidence refs. It may NOT produce
 * appraisal_ref, canonical time, state revision/hash, repository revision,
 * provenance identity, transition ID or any state delta — the system
 * constructs all authority metadata. No general-cognition reuse.
 *
 * READER (§34): given the bound revision and an appraisal ref, verifies
 * effective ancestry visibility, payload membership/hash, record schema,
 * self-ref derivation, subject, and the full grounding chain through the
 * ExperienceReaderV0. Fail closed.
 *
 * FIND-INITIAL (§35/§36): enumerates visible appraisal records and matches
 * subject_id + experience_ref + appraisal_kind=INITIAL. 0 found → proceed;
 * 1 valid → already completed; >1 → integrity failure. Physical presence
 * without ancestry visibility is never canonical.
 */

import type {
  CanonicalRefV0,
  HashV1,
  IdentifierV0,
  RepositoryRevisionIdV0,
  SubjectStateV0
} from "@characteros-next/subject-core";
import { hashEnvelope, isRecord, refKind } from "@characteros-next/subject-core";
import type { InMemoryMemoryRepository } from "@characteros-next/memory";
import {
  validateExperienceAppraisalProposalV0,
  validateExperienceAppraisalRecordV0,
  deriveExperienceAppraisalRefV0,
  type ExperienceAppraisalProposalV0,
  type ExperienceAppraisalRecordV0
} from "@characteros-next/appraisal";
import type { ExperienceReaderV0 } from "../transitions/conversation/experience-reader.js";
import type { ExperienceAppraisalContextProjectionV0 } from "./experience-appraisal-context.js";

// ----------------------------------------------------------------------------------
// Provider port
// ----------------------------------------------------------------------------------

/** Deterministic provider input: the frozen factual context projection. */
export type ExperienceAppraisalProviderInputV0 = ExperienceAppraisalContextProjectionV0;

export interface ExperienceAppraisalProviderV0 {
  proposeExperienceAppraisal(
    context: ExperienceAppraisalProviderInputV0
  ): Promise<ExperienceAppraisalProposalV0>;
}

/** Validates one raw provider result (closed schema; no coercion). */
export function validateProviderProposalV0(raw: unknown): ExperienceAppraisalProposalV0 {
  const checked = validateExperienceAppraisalProposalV0(raw);
  if (!checked.ok) throw new Error(`experience appraisal proposal invalid: ${checked.error.detail}`);
  return checked.value;
}

// ----------------------------------------------------------------------------------
// Canonical reader
// ----------------------------------------------------------------------------------

export type ExperienceAppraisalReadResultV0 =
  | { readonly ok: true; readonly record: ExperienceAppraisalRecordV0; readonly payload_hash: HashV1 }
  | { readonly ok: false; readonly code: ExperienceAppraisalReadFailureCodeV0; readonly detail: string };

export type ExperienceAppraisalReadFailureCodeV0 =
  | "READER_MISCONFIGURED"
  | "REF_INVALID"
  | "REVISION_UNBOUND"
  | "REF_NOT_IN_REVISION"
  | "PAYLOAD_MISSING"
  | "PAYLOAD_HASH_MISMATCH"
  | "PAYLOAD_SCHEMA_INVALID"
  | "SELF_REF_MISMATCH"
  | "SUBJECT_MISMATCH"
  | "GROUNDING_INVALID";

export interface ExperienceAppraisalReaderV0 {
  read(input: unknown): Promise<ExperienceAppraisalReadResultV0>;
}

export function createExperienceAppraisalReaderV0(deps: {
  readonly repository: InMemoryMemoryRepository;
  readonly experienceReader: ExperienceReaderV0;
}): ExperienceAppraisalReaderV0 {
  const read = async (input: unknown): Promise<ExperienceAppraisalReadResultV0> => {
    if (deps.repository === undefined || deps.repository === null || deps.experienceReader === undefined || deps.experienceReader === null) {
      return { ok: false, code: "READER_MISCONFIGURED", detail: "appraisal reader requires repository + experience reader" };
    }
    if (!isRecord(input)) return { ok: false, code: "REF_INVALID", detail: "input: expected object" };
    if (typeof input["repository_revision"] !== "string" || input["repository_revision"].length === 0) {
      return { ok: false, code: "REF_INVALID", detail: "input.repository_revision: nonempty string required" };
    }
    const revision = input["repository_revision"] as RepositoryRevisionIdV0;
    const appraisalRefInput = input["appraisal_ref"];
    if (typeof appraisalRefInput !== "string" || refKind(appraisalRefInput as CanonicalRefV0) !== "appraisal") {
      return { ok: false, code: "REF_INVALID", detail: "input.appraisal_ref: appraisal ref required" };
    }
    const appraisalRef = appraisalRefInput as never;

    // ---- 1/2/3. effective ancestry visibility + payload membership/hash/schema ----
    const visible = await deps.repository.readVisibleRecordHashes(revision);
    const entry = visible.find((r) => r.ref === appraisalRef);
    if (entry === undefined) {
      return { ok: false, code: "REF_NOT_IN_REVISION", detail: `appraisal ${String(appraisalRef)} is not visible at revision ${String(revision)}` };
    }
    const payload = deps.repository.readStoredPayload(appraisalRef);
    if (payload === undefined || payload === null) {
      return { ok: false, code: "PAYLOAD_MISSING", detail: "appraisal payload missing" };
    }
    const recomputed = await hashEnvelope("characteros-next/memory/record-payload/v1", payload);
    if (recomputed !== entry.payload_hash) {
      return { ok: false, code: "PAYLOAD_HASH_MISMATCH", detail: "appraisal payload hash mismatch" };
    }
    const checked = validateExperienceAppraisalRecordV0(payload);
    if (!checked.ok) {
      return { ok: false, code: "PAYLOAD_SCHEMA_INVALID", detail: checked.error.detail };
    }
    const record = checked.value;
    if (record.appraisal_ref !== appraisalRef) {
      return { ok: false, code: "SELF_REF_MISMATCH", detail: "appraisal payload ref mismatch" };
    }

    // ---- 4. self-ref derivation ----------------------------------------------------
    const reDerived = await deriveExperienceAppraisalRefV0(record);
    if (reDerived !== record.appraisal_ref) {
      return { ok: false, code: "SELF_REF_MISMATCH", detail: "appraisal ref does not re-derive from the admitted body (tamper evidence)" };
    }

    // ---- 5/6/7/8/9. grounding chain through the ExperienceReader --------------------
    if (typeof input["subject_id"] === "string" && input["subject_id"] !== record.subject_id) {
      return { ok: false, code: "SUBJECT_MISMATCH", detail: "appraisal subject does not match the requested subject" };
    }
    const experienceRead = await deps.experienceReader.read({
      repository_revision: revision,
      episode_ref: record.grounding.source_episode_ref
    });
    if (!experienceRead.ok) {
      return { ok: false, code: "GROUNDING_INVALID", detail: `experience chain unresolved (${experienceRead.code}: ${experienceRead.detail})` };
    }
    if (experienceRead.experience.experience_ref !== record.experience_ref) {
      return { ok: false, code: "GROUNDING_INVALID", detail: "grounding experience ref mismatch" };
    }
    if (experienceRead.hashes.experience !== record.experience_payload_hash) {
      return { ok: false, code: "GROUNDING_INVALID", detail: "grounding experience payload hash mismatch" };
    }
    if (experienceRead.episode.episode_ref !== record.grounding.source_episode_ref) {
      return { ok: false, code: "GROUNDING_INVALID", detail: "grounding episode ref mismatch" };
    }
    if (experienceRead.hashes.episode !== record.grounding.source_episode_payload_hash) {
      return { ok: false, code: "GROUNDING_INVALID", detail: "grounding episode payload hash mismatch" };
    }
    if (experienceRead.event.event_ref !== record.grounding.source_event_ref) {
      return { ok: false, code: "GROUNDING_INVALID", detail: "grounding event ref mismatch" };
    }
    if (experienceRead.hashes.event !== record.grounding.source_event_payload_hash) {
      return { ok: false, code: "GROUNDING_INVALID", detail: "grounding event payload hash mismatch" };
    }
    if (experienceRead.behavior_delivery.delivery_id !== record.grounding.behavior_delivery_id) {
      return { ok: false, code: "GROUNDING_INVALID", detail: "grounding delivery mismatch" };
    }

    return { ok: true, record, payload_hash: entry.payload_hash };
  };
  return { read };
}

// ----------------------------------------------------------------------------------
// Find-INITIAL resolver (§35/§36)
// ----------------------------------------------------------------------------------

export type FindInitialAppraisalResultV0 =
  | { readonly kind: "NOT_FOUND" }
  | { readonly kind: "FOUND"; readonly appraisal_ref: CanonicalRefV0; readonly payload_hash: HashV1; readonly record: ExperienceAppraisalRecordV0 }
  | { readonly kind: "INTEGRITY_FAILURE"; readonly detail: string };

/**
 * Enumerates visible appraisal-kind records at the bound revision and matches
 * subject_id + experience_ref + INITIAL. 0 → proceed; 1 valid → completed;
 * >1 valid → integrity failure (never newest-wins).
 */
export async function findInitialExperienceAppraisalV0(
  repository: InMemoryMemoryRepository,
  revision: RepositoryRevisionIdV0,
  subjectId: string,
  experienceRef: string
): Promise<FindInitialAppraisalResultV0> {
  const visible = await repository.readVisibleRecordHashes(revision);
  const matches: { appraisal_ref: CanonicalRefV0; payload_hash: HashV1; record: ExperienceAppraisalRecordV0 }[] = [];
  for (const entry of visible) {
    if (refKind(entry.ref) !== "appraisal") continue;
    const payload = repository.readStoredPayload(entry.ref);
    if (payload === undefined || payload === null) continue;
    const recomputed = await hashEnvelope("characteros-next/memory/record-payload/v1", payload);
    if (recomputed !== entry.payload_hash) continue; // tampered: not authoritative
    const checked = validateExperienceAppraisalRecordV0(payload);
    if (!checked.ok) continue; // malformed: not canonical (reader reports failures)
    const record = checked.value;
    if (record.subject_id !== subjectId) continue;
    if (record.experience_ref !== experienceRef) continue;
    if (record.appraisal_kind !== "INITIAL") continue;
    matches.push({ appraisal_ref: entry.ref, payload_hash: entry.payload_hash, record });
  }
  if (matches.length === 0) return { kind: "NOT_FOUND" };
  if (matches.length > 1) {
    return { kind: "INTEGRITY_FAILURE", detail: `${matches.length} canonical INITIAL appraisals found for experience ${experienceRef}` };
  }
  return { kind: "FOUND", ...matches[0] as { appraisal_ref: CanonicalRefV0; payload_hash: HashV1; record: ExperienceAppraisalRecordV0 } };
}

/** Convenience re-export: evidence allowlist anchor (subject-core scalar surface). */
export type AppraisalSubjectStateView = Pick<SubjectStateV0, "identity" | "memory_state" | "runtime_metadata" | "context">;
export type AppraisalIdentifierView = IdentifierV0;
