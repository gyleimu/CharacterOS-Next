/**
 * PRE_COGNITION_CANONICAL_APPRAISAL_V0 — reader and trusted read authority.
 *
 * findInitialFactualEventAppraisalV0 (§20): 0 valid INITIAL → proceed;
 * exactly 1 fully validated → replay/already-completed; >1 → integrity
 * failure; malformed/tampered visible candidate → fail closed (corruption is
 * NOT absence). Visibility uses the existing effective revision ancestry
 * authority (§48) — never direct-manifest-only reads.
 *
 * The reader also exposes the narrow trusted read capability future
 * AffectApplication will consume (§49/§60): a fully verified, frozen
 * canonical record — never a raw repository payload or provider result.
 */

import type { InMemoryMemoryRepository } from "@characteros-next/memory";
import { hashEnvelope, type CanonicalRefV0, type HashV1, type RepositoryRevisionIdV0 } from "@characteros-next/subject-core";
import {
  deriveFactualEventAppraisalRefV0,
  validateFactualEventAppraisalRecordV0,
  type FactualEventAppraisalRecordV0
} from "@characteros-next/appraisal";

export type FindInitialFactualEventAppraisalResultV0 =
  | { readonly kind: "NOT_FOUND" }
  | { readonly kind: "FOUND"; readonly appraisal_ref: CanonicalRefV0; readonly payload_hash: HashV1; readonly record: FactualEventAppraisalRecordV0 }
  | { readonly kind: "INTEGRITY_FAILURE"; readonly detail: string };

export async function findInitialFactualEventAppraisalV0(
  repository: InMemoryMemoryRepository,
  revision: RepositoryRevisionIdV0,
  subjectId: string,
  factualEventRef: string
): Promise<FindInitialFactualEventAppraisalResultV0> {
  const visible = await repository.readVisibleRecordHashes(revision);
  const matches: { appraisal_ref: CanonicalRefV0; payload_hash: HashV1; record: FactualEventAppraisalRecordV0 }[] = [];
  for (const entry of visible) {
    if (!entry.ref.startsWith("appraisal:")) continue;
    const payload = repository.readStoredPayload(entry.ref);
    if (payload === undefined || payload === null) continue;
    // Only factual-event records carry this schema version; Experience records
    // are skipped (different contract, their own reader).
    if ((payload as { schema_version?: unknown })["schema_version"] !== "factual-event-appraisal-record-v0") continue;
    const recomputed = await hashEnvelope("characteros-next/memory/record-payload/v1", payload);
    if (recomputed !== entry.payload_hash) {
      return { kind: "INTEGRITY_FAILURE", detail: `visible factual-event appraisal candidate ${entry.ref} payload hash mismatches its manifest entry` };
    }
    const checked = validateFactualEventAppraisalRecordV0(payload);
    if (!checked.ok) {
      return { kind: "INTEGRITY_FAILURE", detail: `visible factual-event appraisal candidate ${entry.ref} is malformed: ${checked.error.detail}` };
    }
    const record = checked.value;
    if (record.subject_id !== subjectId) continue;
    if (record.factual_event_ref !== factualEventRef) continue;
    if (record.semantic_appraisal_episode !== "INITIAL") continue;
    matches.push({ appraisal_ref: entry.ref, payload_hash: entry.payload_hash as HashV1, record });
  }
  if (matches.length === 0) return { kind: "NOT_FOUND" };
  if (matches.length > 1) {
    return { kind: "INTEGRITY_FAILURE", detail: `${matches.length} canonical factual-event INITIAL appraisals found for event ${factualEventRef}` };
  }
  const match = matches[0];
  if (match === undefined) return { kind: "NOT_FOUND" };
  return { kind: "FOUND", appraisal_ref: match.appraisal_ref, payload_hash: match.payload_hash, record: match.record };
}

// ----------------------------------------------------------------------------------
// Trusted read authority (§49/§60): a verified, frozen canonical record —
// never a raw payload or provider result.
// ----------------------------------------------------------------------------------

export type TrustedFactualEventAppraisalV0 = Readonly<FactualEventAppraisalRecordV0> & {
  readonly payload_hash: string;
};

export type FactualEventAppraisalReadResultV0 =
  | { readonly ok: true; readonly record: TrustedFactualEventAppraisalV0 }
  | { readonly ok: false; readonly code: "NOT_FOUND" | "PAYLOAD_HASH_MISMATCH" | "MALFORMED" | "SELF_REF_MISMATCH" | "SUBJECT_MISMATCH"; readonly detail: string };

export interface FactualEventAppraisalReaderV0 {
  /** Reads and fully verifies one canonical record by self-ref. */
  read(input: {
    readonly repository_revision: RepositoryRevisionIdV0;
    readonly appraisal_ref: CanonicalRefV0;
    readonly subject_id: string;
  }): Promise<FactualEventAppraisalReadResultV0>;
  /** §50 unified surface: the canonical INITIAL for one factual event,
   * regardless of record kind. V0 scope: event-grounded records only —
   * historical Experience-grounded records are keyed by experience_ref and
   * are NOT returned here (read compatibility is NOT a historical-timing
   * rewrite; §50/§51). */
  readCanonicalInitialAppraisalForFactualEvent(input: {
    readonly subject_id: string;
    readonly factual_event_ref: string;
    readonly repository_revision: RepositoryRevisionIdV0;
  }): Promise<
    | { readonly kind: "FOUND"; readonly grounding: "factual_event"; readonly record: TrustedFactualEventAppraisalV0 }
    | { readonly kind: "NOT_FOUND" }
    | { readonly kind: "INTEGRITY_FAILURE"; readonly detail: string }
  >;
}

export function createFactualEventAppraisalReaderV0(deps: {
  readonly repository: InMemoryMemoryRepository;
}): FactualEventAppraisalReaderV0 {
  const read = async (input: {
    readonly repository_revision: RepositoryRevisionIdV0;
    readonly appraisal_ref: CanonicalRefV0;
    readonly subject_id: string;
  }): Promise<FactualEventAppraisalReadResultV0> => {
    const visible = await deps.repository.readVisibleRecordHashes(input.repository_revision);
    const entry = visible.find((e) => e.ref === input.appraisal_ref);
    if (entry === undefined) {
      return { ok: false, code: "NOT_FOUND", detail: `appraisal ${input.appraisal_ref} is not visible at revision ${input.repository_revision}` };
    }
    const payload = deps.repository.readStoredPayload(input.appraisal_ref);
    if (payload === undefined || payload === null) {
      return { ok: false, code: "NOT_FOUND", detail: `appraisal ${input.appraisal_ref} has no stored payload` };
    }
    if ((payload as { schema_version?: unknown })["schema_version"] !== "factual-event-appraisal-record-v0") {
      return { ok: false, code: "MALFORMED", detail: `appraisal ${input.appraisal_ref} is not a factual-event appraisal record` };
    }
    const recomputed = await hashEnvelope("characteros-next/memory/record-payload/v1", payload);
    if (recomputed !== entry.payload_hash) {
      return { ok: false, code: "PAYLOAD_HASH_MISMATCH", detail: `appraisal ${input.appraisal_ref} payload hash mismatches its manifest entry` };
    }
    const checked = validateFactualEventAppraisalRecordV0(payload);
    if (!checked.ok) {
      return { ok: false, code: "MALFORMED", detail: checked.error.detail };
    }
    const record = checked.value;
    const selfRefChecked = await deriveFactualEventAppraisalRefV0(record);
    if (selfRefChecked !== record.appraisal_ref) {
      return { ok: false, code: "SELF_REF_MISMATCH", detail: "appraisal ref does not re-derive from the admitted body (tamper evidence)" };
    }
    if (input.subject_id !== record.subject_id) {
      return { ok: false, code: "SUBJECT_MISMATCH", detail: "appraisal subject does not match the requested subject" };
    }
    // Frozen trusted output (capability-shaped; the consumer cannot mutate it).
    return { ok: true, record: Object.freeze({ ...record, payload_hash: entry.payload_hash }) };
  };

  const readCanonicalInitialAppraisalForFactualEvent = async (input: {
    readonly subject_id: string;
    readonly factual_event_ref: string;
    readonly repository_revision: RepositoryRevisionIdV0;
  }): Promise<
    | { readonly kind: "FOUND"; readonly grounding: "factual_event"; readonly record: TrustedFactualEventAppraisalV0 }
    | { readonly kind: "NOT_FOUND" }
    | { readonly kind: "INTEGRITY_FAILURE"; readonly detail: string }
  > => {
    const found = await findInitialFactualEventAppraisalV0(
      deps.repository,
      input.repository_revision,
      input.subject_id,
      input.factual_event_ref
    );
    if (found.kind === "NOT_FOUND") return { kind: "NOT_FOUND" };
    if (found.kind === "INTEGRITY_FAILURE") return { kind: "INTEGRITY_FAILURE", detail: found.detail };
    const verified = await read({
      repository_revision: input.repository_revision,
      appraisal_ref: found.appraisal_ref,
      subject_id: input.subject_id
    });
    if (!verified.ok) {
      return { kind: "INTEGRITY_FAILURE", detail: `${verified.code}: ${verified.detail}` };
    }
    return { kind: "FOUND", grounding: "factual_event", record: verified.record };
  };

  return { read, readCanonicalInitialAppraisalForFactualEvent };
}
