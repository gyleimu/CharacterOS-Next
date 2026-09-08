/**
 * DURABLE_PRE_COGNITION_APPRAISAL_DISPOSITION_V0 — trusted disposition reader.
 *
 * resolveInitialAppraisalDispositionForFactualEventV0 inspects BOTH canonical
 * factual-event INITIAL artifacts under the same effective repository ancestry
 * — the canonical INITIAL Appraisal record and the canonical INITIAL
 * abstention record — and enforces the mutual-exclusion law:
 *
 *   0 Appraisal + 0 abstention            → PENDING
 *   1 Appraisal + 0 abstention            → APPRAISED
 *   0 Appraisal + 1 abstention            → ABSTAINED_INSUFFICIENT_CONTEXT
 *   Appraisal + abstention                → INTEGRITY_FAILURE
 *   >1 Appraisals / >1 abstentions        → INTEGRITY_FAILURE
 *   malformed/tampered visible candidate  → INTEGRITY_FAILURE
 *
 * ABSENCE IS NEVER ABSENCE-AS-ABSTENTION: PENDING is a distinct lawful state.
 * Conflicts are NEVER resolved by latest timestamp/revision — fail closed.
 * Corruption is NOT absence (existing Appraisal reader philosophy).
 *
 * Everything here is derived from durable canonical repository state only —
 * never caller booleans, transient executor results, or process-local maps —
 * so the result is identical before and after authoritative restore.
 */

import type { InMemoryMemoryRepository } from "@characteros-next/memory";
import type { CanonicalRefV0, HashV1, RepositoryRevisionIdV0 } from "@characteros-next/subject-core";
import { hashEnvelope } from "@characteros-next/subject-core";
import {
  FACTUAL_EVENT_APPRAISAL_RECORD_SCHEMA_VERSION,
  deriveFactualEventAppraisalRefV0,
  validateFactualEventAppraisalRecordV0,
  type FactualEventAppraisalRecordV0
} from "@characteros-next/appraisal";
import {
  FACTUAL_EVENT_APPRAISAL_ABSTENTION_RECORD_SCHEMA_VERSION,
  deriveFactualEventAppraisalAbstentionRefV0,
  validateFactualEventAppraisalAbstentionRecordV0,
  type FactualEventAppraisalAbstentionRecordV0
} from "@characteros-next/appraisal";
import type { TrustedFactualEventAppraisalV0 } from "./factual-event-appraisal-reader.js";

/** Verified, frozen canonical abstention record with its manifest-bound
 * payload hash — capability-shaped; the consumer cannot mutate it. */
export type TrustedFactualEventAppraisalAbstentionV0 = Readonly<FactualEventAppraisalAbstentionRecordV0> & {
  readonly payload_hash: string;
};

export type InitialAppraisalDispositionV0 =
  | { readonly kind: "PENDING" }
  | { readonly kind: "APPRAISED"; readonly appraisal: TrustedFactualEventAppraisalV0 }
  | { readonly kind: "ABSTAINED_INSUFFICIENT_CONTEXT"; readonly abstention: TrustedFactualEventAppraisalAbstentionV0 }
  | { readonly kind: "INTEGRITY_FAILURE"; readonly reason: string };

interface AbstentionMatch {
  readonly abstention_ref: CanonicalRefV0;
  readonly payload_hash: HashV1;
  readonly record: FactualEventAppraisalAbstentionRecordV0;
}

/**
 * The ONE durable INITIAL-disposition authority for a factual event. Reads
 * only the trusted effective visible record set at `revision`; every known
 * factual-event candidate is integrity-checked before filtering.
 */
export async function resolveInitialAppraisalDispositionForFactualEventV0(
  repository: InMemoryMemoryRepository,
  revision: RepositoryRevisionIdV0,
  subjectId: string,
  factualEventRef: string
): Promise<InitialAppraisalDispositionV0> {
  const visible = await repository.readVisibleRecordHashes(revision);
  let appraisalMatch: { appraisal_ref: CanonicalRefV0; payload_hash: HashV1; record: FactualEventAppraisalRecordV0 } | null = null;
  let abstentionMatch: AbstentionMatch | null = null;
  for (const entry of visible) {
    if (!entry.ref.startsWith("appraisal:")) continue;
    const payload = repository.readStoredPayload(entry.ref);
    if (payload === undefined || payload === null) continue;
    const schemaVersion = (payload as { schema_version?: unknown })["schema_version"];
    if (schemaVersion === FACTUAL_EVENT_APPRAISAL_RECORD_SCHEMA_VERSION) {
      const recomputed = await hashEnvelope("characteros-next/memory/record-payload/v1", payload);
      if (recomputed !== entry.payload_hash) {
        return { kind: "INTEGRITY_FAILURE", reason: `visible factual-event appraisal candidate ${entry.ref} payload hash mismatches its manifest entry` };
      }
      const checked = validateFactualEventAppraisalRecordV0(payload);
      if (!checked.ok) {
        return { kind: "INTEGRITY_FAILURE", reason: `visible factual-event appraisal candidate ${entry.ref} is malformed: ${checked.error.detail}` };
      }
      const record = checked.value;
      if (await deriveFactualEventAppraisalRefV0(record) !== entry.ref) {
        return { kind: "INTEGRITY_FAILURE", reason: `visible factual-event appraisal candidate ${entry.ref} does not re-derive its self-ref (tamper evidence)` };
      }
      if (record.subject_id !== subjectId) continue;
      if (record.factual_event_ref !== factualEventRef) continue;
      if (record.semantic_appraisal_episode !== "INITIAL") continue;
      if (appraisalMatch !== null) {
        return { kind: "INTEGRITY_FAILURE", reason: `multiple canonical factual-event INITIAL appraisals found for event ${factualEventRef}` };
      }
      appraisalMatch = { appraisal_ref: entry.ref, payload_hash: entry.payload_hash as HashV1, record };
    } else if (schemaVersion === FACTUAL_EVENT_APPRAISAL_ABSTENTION_RECORD_SCHEMA_VERSION) {
      const recomputed = await hashEnvelope("characteros-next/memory/record-payload/v1", payload);
      if (recomputed !== entry.payload_hash) {
        return { kind: "INTEGRITY_FAILURE", reason: `visible factual-event abstention candidate ${entry.ref} payload hash mismatches its manifest entry` };
      }
      const checked = validateFactualEventAppraisalAbstentionRecordV0(payload);
      if (!checked.ok) {
        return { kind: "INTEGRITY_FAILURE", reason: `visible factual-event abstention candidate ${entry.ref} is malformed: ${checked.error.detail}` };
      }
      const record = checked.value;
      if (await deriveFactualEventAppraisalAbstentionRefV0(record) !== entry.ref) {
        return { kind: "INTEGRITY_FAILURE", reason: `visible factual-event abstention candidate ${entry.ref} does not re-derive its self-ref (tamper evidence)` };
      }
      if (record.subject_id !== subjectId) continue;
      if (record.factual_event_ref !== factualEventRef) continue;
      if (record.semantic_appraisal_episode !== "INITIAL") continue;
      if (abstentionMatch !== null) {
        return { kind: "INTEGRITY_FAILURE", reason: `duplicate canonical factual-event INITIAL abstentions found for event ${factualEventRef}` };
      }
      abstentionMatch = { abstention_ref: entry.ref, payload_hash: entry.payload_hash as HashV1, record };
    }
    // Other appraisal-prefixed records (Experience appraisals etc.) are
    // different contracts — skipped, never mistaken for INITIAL evidence.
  }

  if (appraisalMatch !== null && abstentionMatch !== null) {
    return {
      kind: "INTEGRITY_FAILURE",
      reason: `both a canonical INITIAL Appraisal and a canonical abstention exist for event ${factualEventRef} — conflicting terminal dispositions (fail closed)`
    };
  }
  if (appraisalMatch !== null) {
    return {
      kind: "APPRAISED",
      appraisal: Object.freeze({ ...appraisalMatch.record, payload_hash: appraisalMatch.payload_hash })
    };
  }
  if (abstentionMatch !== null) {
    return {
      kind: "ABSTAINED_INSUFFICIENT_CONTEXT",
      abstention: Object.freeze({ ...abstentionMatch.record, payload_hash: abstentionMatch.payload_hash })
    };
  }
  return { kind: "PENDING" };
}
