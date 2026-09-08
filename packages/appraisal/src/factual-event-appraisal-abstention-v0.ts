/**
 * DURABLE_PRE_COGNITION_APPRAISAL_DISPOSITION_V0 — FactualEventAppraisalAbstentionRecordV0.
 *
 * The durable terminal proof that one factual event's INITIAL Appraisal
 * episode was lawfully CLOSED by abstention (INSUFFICIENT_CONTEXT) instead of
 * producing a canonical INITIAL Appraisal:
 *
 *   authoritative factual event (Ingress ↔ committed Observation ↔ event_ref)
 *   → lawful pre-cognition evaluation
 *   → canonical INITIAL abstention (terminal)
 *
 * CENTRAL SEMANTIC LAW: INSUFFICIENT_CONTEXT for semantic_appraisal_episode
 * INITIAL is TERMINAL. The INITIAL lifecycle for the factual event is closed;
 * later context changes must NOT create another INITIAL for the same event
 * (future re-evaluation belongs to a separate semantic episode, e.g.
 * REAPPRAISAL — not implemented here).
 *
 * ONE-INITIAL LAW (unchanged, §3/§4/§19 of the Appraisal contract): for one
 * factual event X, subject_id X + factual_event_ref X + semantic episode
 * INITIAL admits at most ONE canonical terminal — exactly one of:
 *   - one canonical INITIAL Appraisal record, OR
 *   - one canonical INITIAL abstention record.
 * Never both; never duplicates. Appraisal + abstention for the same identity
 * is an integrity failure (fail closed, never resolved by timestamp).
 *
 * ABSENCE IS NOT ABSTENTION: 0 Appraisal + 0 abstention is PENDING — the
 * abstention record exists precisely so restored runtime never has to guess.
 *
 * This record does NOT fabricate a neutral Appraisal (no dimensions exist
 * here): ABSTAINED_INSUFFICIENT_CONTEXT ≠ APPRAISED_AS_NEUTRAL, and that
 * distinction is durable by construction.
 *
 * The provider (when consulted) is audit provenance ONLY — never semantic
 * identity. Provider upgrades must not reopen INITIAL.
 */

import type {
  CanonicalRefV0,
  HashV1,
  IdentifierV0,
  LogicalTimeV0,
  StateRevisionV0
} from "@characteros-next/subject-core";
import {
  fail,
  hashEnvelope,
  isRecord,
  isString,
  ok,
  validateIdentifier,
  type ValidationResult
} from "@characteros-next/subject-core";
import {
  FACTUAL_EVENT_APPRAISAL_PROVIDER_CONTRACT_VERSION,
  SEMANTIC_APPRAISAL_EPISODE_INITIAL
} from "./factual-event-appraisal-v0.js";

// ----------------------------------------------------------------------------------
// Schema versions + projections (repository-native conventions, new domains)
// ----------------------------------------------------------------------------------

export const FACTUAL_EVENT_APPRAISAL_ABSTENTION_RECORD_SCHEMA_VERSION =
  "factual-event-appraisal-abstention-record-v0" as const;

/** §11: the one semantic reason code. Provenance stage explains WHERE the
 * conclusion arose; both stages close the same INITIAL lifecycle. */
export const FACTUAL_EVENT_APPRAISAL_ABSTENTION_REASON_V0 = "INSUFFICIENT_CONTEXT" as const;

export const FACTUAL_EVENT_APPRAISAL_ABSTENTION_REF_PROJECTION =
  "characteros-next/appraisal/factual-event-appraisal-abstention-ref/v1" as const;
export const FACTUAL_EVENT_APPRAISAL_ABSTENTION_PROPOSAL_HASH_PROJECTION =
  "characteros-next/appraisal/factual-event-appraisal-abstention-proposal-hash/v1" as const;
export const FACTUAL_EVENT_APPRAISAL_ABSTENTION_PREPARE_INTENT_PROJECTION =
  "characteros-next/memory/factual-event-appraisal-abstention-prepare-intent/v1" as const;

// ----------------------------------------------------------------------------------
// Record schema (closed, immutable, self-ref'd; `appraisal:` ref kind)
// ----------------------------------------------------------------------------------

export type FactualEventAppraisalAbstentionProvenanceV0 =
  | Readonly<{
      /** Lawful abstention before any provider call (context evaluation). */
      readonly stage: "CONTEXT_EVALUATION";
    }>
  | Readonly<{
      /** Provider lawfully returned INSUFFICIENT_CONTEXT for this projection. */
      readonly stage: "PROVIDER";
      readonly provider_id: IdentifierV0;
      readonly provider_contract_version: typeof FACTUAL_EVENT_APPRAISAL_PROVIDER_CONTRACT_VERSION;
      readonly proposal_hash: HashV1;
    }>;

export interface FactualEventAppraisalAbstentionRecordV0 {
  readonly schema_version: typeof FACTUAL_EVENT_APPRAISAL_ABSTENTION_RECORD_SCHEMA_VERSION;
  readonly semantic_appraisal_episode: "INITIAL";
  readonly abstention_ref: CanonicalRefV0;
  readonly subject_id: IdentifierV0;
  readonly factual_event_ref: CanonicalRefV0;
  readonly factual_event_payload_hash: HashV1;
  readonly source_observation_ref: CanonicalRefV0;
  readonly source_observation_transition_id: string;
  readonly source_admission_history_sequence: number;
  readonly subject_state: {
    readonly state_revision: StateRevisionV0;
    readonly state_hash: HashV1;
    readonly repository_revision: string;
  };
  readonly evaluated_at_logical_time: LogicalTimeV0;
  readonly reason: typeof FACTUAL_EVENT_APPRAISAL_ABSTENTION_REASON_V0;
  readonly provenance: FactualEventAppraisalAbstentionProvenanceV0;
}

const RECORD_KEYS: readonly string[] = [
  "schema_version",
  "semantic_appraisal_episode",
  "abstention_ref",
  "subject_id",
  "factual_event_ref",
  "factual_event_payload_hash",
  "source_observation_ref",
  "source_observation_transition_id",
  "source_admission_history_sequence",
  "subject_state",
  "evaluated_at_logical_time",
  "reason",
  "provenance"
];

const SOURCE_STATE_KEYS: readonly string[] = ["state_revision", "state_hash", "repository_revision"];
const CONTEXT_EVALUATION_PROVENANCE_KEYS: readonly string[] = ["stage"];
const PROVIDER_PROVENANCE_KEYS: readonly string[] = [
  "stage",
  "provider_id",
  "provider_contract_version",
  "proposal_hash"
];

function closedKeys(
  o: Record<string, unknown>,
  allowed: readonly string[],
  d: string
): ValidationResult<void> {
  for (const key of Object.keys(o)) {
    if (!allowed.includes(key)) return fail("INVALID_SCHEMA", "SS-SCHEMA-001", `${d}: unknown key ${key}`);
  }
  return ok(undefined);
}

function isHashV1Value(v: unknown): v is HashV1 {
  return isString(v) && /^sha256:[0-9a-f]{64}$/.test(v);
}

function isSafeNonNegativeInteger(v: unknown): v is number {
  return typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
}

/** §10: closed validation of one canonical abstention record. Unknown keys are
 * structurally impossible; every ref/hash/time field is validated fail-closed
 * with no coercion, no repair and no defaults. Provenance is a closed union:
 * CONTEXT_EVALUATION forbids provider fields; PROVIDER requires them. */
export function validateFactualEventAppraisalAbstentionRecordV0(v: unknown): ValidationResult<FactualEventAppraisalAbstentionRecordV0> {
  if (!isRecord(v)) return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "abstention record: expected object");
  const shell = closedKeys(v, RECORD_KEYS, "abstention record");
  if (!shell.ok) return shell;
  if (v["schema_version"] !== FACTUAL_EVENT_APPRAISAL_ABSTENTION_RECORD_SCHEMA_VERSION) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "abstention record.schema_version mismatch");
  }
  if (v["semantic_appraisal_episode"] !== SEMANTIC_APPRAISAL_EPISODE_INITIAL) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "abstention record.semantic_appraisal_episode must be INITIAL");
  }
  if (!isString(v["abstention_ref"]) || !(v["abstention_ref"] as string).startsWith("appraisal:")) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "abstention record.abstention_ref: appraisal ref required");
  }
  const subject = validateIdentifier(v["subject_id"] as string, "abstention record.subject_id");
  if (!subject.ok) return subject;
  if (!isString(v["factual_event_ref"]) || !(v["factual_event_ref"] as string).startsWith("event:")) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "abstention record.factual_event_ref: event ref required");
  }
  if (!isHashV1Value(v["factual_event_payload_hash"])) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "abstention record.factual_event_payload_hash: sha256 hash required");
  }
  if (!isString(v["source_observation_ref"]) || !(v["source_observation_ref"] as string).startsWith("observation:")) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "abstention record.source_observation_ref: observation ref required");
  }
  if (!isString(v["source_observation_transition_id"]) || (v["source_observation_transition_id"] as string).length === 0) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "abstention record.source_observation_transition_id: nonempty string required");
  }
  if (!isSafeNonNegativeInteger(v["source_admission_history_sequence"])) {
    return fail("INVALID_VALUE_RANGE", "SS-SCHEMA-001", "abstention record.source_admission_history_sequence: non-negative safe integer required");
  }
  if (!isSafeNonNegativeInteger(v["evaluated_at_logical_time"])) {
    return fail("INVALID_VALUE_RANGE", "SS-SCHEMA-001", "abstention record.evaluated_at_logical_time: non-negative safe integer required");
  }
  if (v["reason"] !== FACTUAL_EVENT_APPRAISAL_ABSTENTION_REASON_V0) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "abstention record.reason must be INSUFFICIENT_CONTEXT");
  }

  if (!isRecord(v["subject_state"])) return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "abstention record.subject_state: expected object");
  const stateKeys = closedKeys(v["subject_state"], SOURCE_STATE_KEYS, "abstention record.subject_state");
  if (!stateKeys.ok) return stateKeys;
  const subjectState = v["subject_state"];
  if (!isSafeNonNegativeInteger(subjectState["state_revision"])) {
    return fail("INVALID_VALUE_RANGE", "SS-SCHEMA-001", "abstention record.subject_state.state_revision: non-negative safe integer required");
  }
  if (!isHashV1Value(subjectState["state_hash"])) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "abstention record.subject_state.state_hash: sha256 hash required");
  }
  if (!isString(subjectState["repository_revision"]) || (subjectState["repository_revision"] as string).length === 0) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "abstention record.subject_state.repository_revision: nonempty string required");
  }

  if (!isRecord(v["provenance"])) return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "abstention record.provenance: expected object");
  const provenance = v["provenance"];
  if (provenance["stage"] === "CONTEXT_EVALUATION") {
    const contextKeys = closedKeys(provenance, CONTEXT_EVALUATION_PROVENANCE_KEYS, "abstention record.provenance");
    if (!contextKeys.ok) return contextKeys;
  } else if (provenance["stage"] === "PROVIDER") {
    const providerKeys = closedKeys(provenance, PROVIDER_PROVENANCE_KEYS, "abstention record.provenance");
    if (!providerKeys.ok) return providerKeys;
    const providerId = validateIdentifier(provenance["provider_id"] as string, "abstention record.provenance.provider_id");
    if (!providerId.ok) return providerId;
    if (provenance["provider_contract_version"] !== FACTUAL_EVENT_APPRAISAL_PROVIDER_CONTRACT_VERSION) {
      return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "abstention record.provenance.provider_contract_version mismatch");
    }
    if (!isHashV1Value(provenance["proposal_hash"])) {
      return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "abstention record.provenance.proposal_hash: sha256 hash required");
    }
  } else {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "abstention record.provenance.stage: CONTEXT_EVALUATION | PROVIDER required");
  }

  return ok({
    schema_version: FACTUAL_EVENT_APPRAISAL_ABSTENTION_RECORD_SCHEMA_VERSION,
    semantic_appraisal_episode: SEMANTIC_APPRAISAL_EPISODE_INITIAL,
    abstention_ref: v["abstention_ref"] as CanonicalRefV0,
    subject_id: subject.value,
    factual_event_ref: v["factual_event_ref"] as CanonicalRefV0,
    factual_event_payload_hash: v["factual_event_payload_hash"] as HashV1,
    source_observation_ref: v["source_observation_ref"] as CanonicalRefV0,
    source_observation_transition_id: v["source_observation_transition_id"] as string,
    source_admission_history_sequence: v["source_admission_history_sequence"] as number,
    subject_state: {
      state_revision: subjectState["state_revision"] as StateRevisionV0,
      state_hash: subjectState["state_hash"] as HashV1,
      repository_revision: subjectState["repository_revision"] as string
    },
    evaluated_at_logical_time: v["evaluated_at_logical_time"] as LogicalTimeV0,
    reason: FACTUAL_EVENT_APPRAISAL_ABSTENTION_REASON_V0,
    provenance: provenance as unknown as FactualEventAppraisalAbstentionProvenanceV0
  });
}

// ----------------------------------------------------------------------------------
// Canonical self-ref (§11): repository-native stable hashing over the canonical
// body EXCLUDING the self ref — new domain separator, no new hash primitive.
// ----------------------------------------------------------------------------------

function strip(digest: string): string {
  return digest.replace(/^sha256:/, "");
}

/** Canonical self-ref: derived from the stable admitted body EXCLUDING the
 * self ref. Stored under the existing `appraisal:` repository ref kind.
 * Structural input types mirror deriveFactualEventAppraisalRefV0. */
export async function deriveFactualEventAppraisalAbstentionRefV0(record: {
  readonly schema_version: typeof FACTUAL_EVENT_APPRAISAL_ABSTENTION_RECORD_SCHEMA_VERSION;
  readonly semantic_appraisal_episode: "INITIAL";
  readonly subject_id: string;
  readonly factual_event_ref: string;
  readonly factual_event_payload_hash: string;
  readonly source_observation_ref: string;
  readonly source_observation_transition_id: string;
  readonly source_admission_history_sequence: number;
  readonly subject_state: {
    readonly state_revision: number;
    readonly state_hash: string;
    readonly repository_revision: string;
  };
  readonly evaluated_at_logical_time: number;
  readonly reason: typeof FACTUAL_EVENT_APPRAISAL_ABSTENTION_REASON_V0;
  readonly provenance:
    | Readonly<{ readonly stage: "CONTEXT_EVALUATION" }>
    | Readonly<{
        readonly stage: "PROVIDER";
        readonly provider_id: string;
        readonly provider_contract_version: string;
        readonly proposal_hash: string;
      }>;
}): Promise<CanonicalRefV0> {
  return `appraisal:${strip(await hashEnvelope(FACTUAL_EVENT_APPRAISAL_ABSTENTION_REF_PROJECTION, {
    schema_version: record.schema_version,
    semantic_appraisal_episode: record.semantic_appraisal_episode,
    subject_id: record.subject_id,
    factual_event_ref: record.factual_event_ref,
    factual_event_payload_hash: record.factual_event_payload_hash,
    source_observation_ref: record.source_observation_ref,
    source_observation_transition_id: record.source_observation_transition_id,
    source_admission_history_sequence: record.source_admission_history_sequence,
    subject_state: record.subject_state,
    evaluated_at_logical_time: record.evaluated_at_logical_time,
    reason: record.reason,
    provenance: record.provenance
  }))}` as CanonicalRefV0;
}

// ----------------------------------------------------------------------------------
// Audit provenance + persistence identities (§12/§23/§39)
// ----------------------------------------------------------------------------------

/** Provider abstention audit hash over the closed validated abstention
 * proposal. Audit provenance ONLY — never part of the semantic identity. */
export async function deriveFactualEventAppraisalAbstentionProposalHashV0(proposal: {
  readonly schema_version: string;
  readonly status: string;
  readonly subject_id: string;
  readonly factual_event_ref: string;
  readonly context_projection_hash: string;
  readonly missing_inputs: readonly string[];
}): Promise<HashV1> {
  return hashEnvelope(FACTUAL_EVENT_APPRAISAL_ABSTENTION_PROPOSAL_HASH_PROJECTION, {
    schema_version: proposal.schema_version,
    status: proposal.status,
    subject_id: proposal.subject_id,
    factual_event_ref: proposal.factual_event_ref,
    context_projection_hash: proposal.context_projection_hash,
    missing_inputs: proposal.missing_inputs
  });
}

/** §23: deterministic preparation-intent identity around the ONE-INITIAL
 * semantic tuple (subject, factual event, INITIAL) + the current attempt
 * binding — mirroring deriveFactualEventAppraisalIntentId in a separate
 * domain. Attempt bindings may differ across rebuilds; the semantic identity
 * never creates a second terminal lifecycle. */
export async function deriveFactualEventAppraisalAbstentionIntentId(params: {
  readonly subject_id: string;
  readonly factual_event_ref: string;
  readonly expected_state_revision: number;
  readonly rebuild_ordinal: number;
}): Promise<string> {
  const digest = await hashEnvelope(FACTUAL_EVENT_APPRAISAL_ABSTENTION_PREPARE_INTENT_PROJECTION, params);
  return `li-${strip(digest)}`;
}
