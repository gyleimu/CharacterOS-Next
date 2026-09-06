/**
 * PRE_COGNITION_CANONICAL_APPRAISAL_V0 — FactualEventAppraisalRecordV0.
 *
 * One authoritative incoming conversation factual event can receive ONE
 * immutable, manifest-visible canonical INITIAL Appraisal BEFORE cognition:
 *
 *   authoritative factual event (Ingress ↔ committed Observation ↔ event_ref)
 *   → canonical INITIAL Appraisal
 *
 * SEMANTIC LAW (§3/§4/§19): for one factual event X,
 *   subject_id X + factual_event_ref X + semantic episode INITIAL
 * admits at most ONE canonical INITIAL Appraisal. Identity is EVENT-centered —
 * never Experience ref, provider version, memory/state revision or dynamics
 * version. A later Experience representing the SAME factual event resolves to
 * the existing event-grounded INITIAL; it must not create another one.
 *
 * This record does NOT require an ExperienceRecordV0 (§14): its grounding
 * authority is the authoritative factual event + committed Observation
 * admission. It reuses the shared six-dimensional Appraisal semantics exactly
 * (§9/§46): AppraisalDimensionsV0, the same attribution enum, the same
 * confidence/UnitInterval/ref-array validation — no second dimension schema,
 * no emotion labels, no valence/activation.
 *
 * The provider (§10/§11) proposes ONLY subjective content (dimensions,
 * confidence, evidence); the system owns every authority field (subject,
 * event, observation grounding, times, revisions, provenance, self-ref).
 */

import type {
  CanonicalRefV0,
  HashV1,
  IdentifierV0,
  LogicalTimeV0,
  StateRevisionV0,
  UnitIntervalV0
} from "@characteros-next/subject-core";
import {
  fail,
  hashEnvelope,
  isRecord,
  isString,
  ok,
  validateCanonicalText,
  validateIdentifier,
  validateRefArray,
  validateUnitInterval,
  type ValidationResult
} from "@characteros-next/subject-core";
import { validateAppraisalDimensionsV0, type AppraisalDimensionsV0 } from "./experience-appraisal-v0.js";

// ----------------------------------------------------------------------------------
// Schema versions (§12: bounded new canonical record — repository-conforming)
// ----------------------------------------------------------------------------------

export const FACTUAL_EVENT_APPRAISAL_PROPOSAL_SCHEMA_VERSION =
  "factual-event-appraisal-proposal-v0" as const;
export const FACTUAL_EVENT_APPRAISAL_RECORD_SCHEMA_VERSION =
  "factual-event-appraisal-record-v0" as const;
/** §4/§19: the one semantic episode vocabulary, shared with the law. */
export const SEMANTIC_APPRAISAL_EPISODE_INITIAL = "INITIAL" as const;
export const SEMANTIC_APPRAISAL_EPISODES: readonly string[] = Object.freeze(["INITIAL"]);
export const FACTUAL_EVENT_APPRAISAL_PROVIDER_CONTRACT_VERSION =
  "factual-event-appraisal-provider-v0" as const;
export const FACTUAL_EVENT_APPRAISAL_SUBJECT_CONTEXT_SCHEMA_VERSION =
  "experience-appraisal-subject-context-v0" as const;

/** §3: the one event-centered identity tuple. */
export interface FactualEventAppraisalIdentityV0 {
  readonly subject_id: IdentifierV0;
  readonly factual_event_ref: CanonicalRefV0;
  readonly semantic_appraisal_episode: "INITIAL";
}

// ----------------------------------------------------------------------------------
// Provider proposal (§10/§11): closed, subjective content only
// ----------------------------------------------------------------------------------

const PROPOSAL_KEYS: readonly string[] = [
  "schema_version",
  "status",
  "subject_id",
  "factual_event_ref",
  "context_projection_hash",
  "dimensions",
  "assessment_confidence",
  "evidence_refs"
];

const INSUFFICIENT_KEYS: readonly string[] = [
  "schema_version",
  "status",
  "subject_id",
  "factual_event_ref",
  "context_projection_hash",
  "missing_inputs"
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

/** APPRAISED result: the provider's complete subjective evaluation proposal. */
export interface FactualEventAppraisalProposedV0 {
  readonly schema_version: typeof FACTUAL_EVENT_APPRAISAL_PROPOSAL_SCHEMA_VERSION;
  readonly status: "APPRAISED";
  readonly subject_id: IdentifierV0;
  readonly factual_event_ref: CanonicalRefV0;
  readonly context_projection_hash: HashV1;
  readonly dimensions: AppraisalDimensionsV0;
  readonly assessment_confidence: UnitIntervalV0;
  readonly evidence_refs: readonly CanonicalRefV0[];
}

/** Abstention result (§18): the provider declines without proposing dimensions. */
export interface FactualEventAppraisalInsufficientV0 {
  readonly schema_version: typeof FACTUAL_EVENT_APPRAISAL_PROPOSAL_SCHEMA_VERSION;
  readonly status: "INSUFFICIENT_CONTEXT";
  readonly subject_id: IdentifierV0;
  readonly factual_event_ref: CanonicalRefV0;
  readonly context_projection_hash: HashV1;
  readonly missing_inputs: readonly ["CURRENT_TASK"];
}

export type FactualEventAppraisalProposalV0 =
  | FactualEventAppraisalProposedV0
  | FactualEventAppraisalInsufficientV0;

/** §11: closed validation of one factual-event appraisal provider result. */
export function validateFactualEventAppraisalProposalV0(v: unknown): ValidationResult<FactualEventAppraisalProposalV0> {
  if (!isRecord(v)) return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "proposal: expected object");
  if (v["schema_version"] !== FACTUAL_EVENT_APPRAISAL_PROPOSAL_SCHEMA_VERSION) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "proposal.schema_version mismatch");
  }
  const subject = validateIdentifier(v["subject_id"] as string, "proposal.subject_id");
  if (!subject.ok) return subject;
  if (!isString(v["factual_event_ref"]) || !(v["factual_event_ref"] as string).startsWith("event:")) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "proposal.factual_event_ref: event ref required");
  }
  if (!isHashV1Value(v["context_projection_hash"])) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "proposal.context_projection_hash: sha256 hash required");
  }
  if (v["status"] === "APPRAISED") {
    const shell = closedKeys(v, PROPOSAL_KEYS, "proposal");
    if (!shell.ok) return shell;
    const dimensions = validateAppraisalDimensionsV0(v["dimensions"]);
    if (!dimensions.ok) return dimensions;
    const rawConfidence = v["assessment_confidence"];
    if (typeof rawConfidence !== "number" || !Number.isFinite(rawConfidence)) {
      return fail("INVALID_VALUE_RANGE", "SS-SCHEMA-001", "proposal.assessment_confidence: UnitIntervalV0 required");
    }
    const confidence = validateUnitInterval(rawConfidence, "proposal.assessment_confidence");
    if (!confidence.ok) return confidence;
    const evidence = validateRefArray(v["evidence_refs"], "proposal.evidence_refs", { sorted: true });
    if (!evidence.ok) return evidence;
    return ok({
      schema_version: FACTUAL_EVENT_APPRAISAL_PROPOSAL_SCHEMA_VERSION,
      status: "APPRAISED",
      subject_id: subject.value,
      factual_event_ref: v["factual_event_ref"] as CanonicalRefV0,
      context_projection_hash: v["context_projection_hash"] as HashV1,
      dimensions: dimensions.value,
      assessment_confidence: confidence.value,
      evidence_refs: v["evidence_refs"] as readonly CanonicalRefV0[]
    });
  }
  if (v["status"] === "INSUFFICIENT_CONTEXT") {
    const shell = closedKeys(v, INSUFFICIENT_KEYS, "proposal");
    if (!shell.ok) return shell;
    const missing = v["missing_inputs"];
    if (!Array.isArray(missing) || missing.length !== 1 || missing[0] !== "CURRENT_TASK") {
      return fail("INVALID_SCHEMA", "SS-SCHEMA-001", 'proposal.missing_inputs: exactly ["CURRENT_TASK"] required');
    }
    return ok({
      schema_version: FACTUAL_EVENT_APPRAISAL_PROPOSAL_SCHEMA_VERSION,
      status: "INSUFFICIENT_CONTEXT",
      subject_id: subject.value,
      factual_event_ref: v["factual_event_ref"] as CanonicalRefV0,
      context_projection_hash: v["context_projection_hash"] as HashV1,
      missing_inputs: ["CURRENT_TASK"]
    });
  }
  return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "proposal.status: APPRAISED | INSUFFICIENT_CONTEXT required");
}

// ----------------------------------------------------------------------------------
// Canonical immutable record (§13)
// ----------------------------------------------------------------------------------

export const FACTUAL_EVENT_APPRAISAL_REF_PROJECTION =
  "characteros-next/appraisal/factual-event-appraisal-ref/v1" as const;
const FACTUAL_EVENT_APPRAISAL_PROPOSAL_HASH_PROJECTION =
  "characteros-next/appraisal/factual-event-appraisal-proposal-hash/v1" as const;

function strip(digest: string): string {
  return digest.replace(/^sha256:/, "");
}

/** Proposal hash: binds ONLY the context projection hash, dimensions,
 * confidence and evidence refs — never transport/retry metadata. */
export async function deriveFactualEventAppraisalProposalHashV0(proposal: {
  readonly context_projection_hash: string;
  readonly dimensions: AppraisalDimensionsV0;
  readonly assessment_confidence: UnitIntervalV0;
  readonly evidence_refs: readonly CanonicalRefV0[];
}): Promise<HashV1> {
  return hashEnvelope(FACTUAL_EVENT_APPRAISAL_PROPOSAL_HASH_PROJECTION, {
    context_projection_hash: proposal.context_projection_hash,
    dimensions: proposal.dimensions,
    assessment_confidence: proposal.assessment_confidence,
    evidence_refs: proposal.evidence_refs
  });
}

const RECORD_KEYS: readonly string[] = [
  "schema_version",
  "semantic_appraisal_episode",
  "appraisal_ref",
  "subject_id",
  "factual_event_ref",
  "factual_event_payload_hash",
  "source_observation_ref",
  "source_observation_transition_id",
  "source_admission_history_sequence",
  "subject_state",
  "evaluated_at_logical_time",
  "subject_context",
  "context_projection_hash",
  "dimensions",
  "assessment_confidence",
  "evidence_refs",
  "provenance"
];

const SOURCE_STATE_KEYS: readonly string[] = ["state_revision", "state_hash", "repository_revision"];
const SUBJECT_CONTEXT_KEYS: readonly string[] = ["schema_version", "current_task"];
const PROVENANCE_KEYS: readonly string[] = [
  "provider_id",
  "provider_contract_version",
  "proposal_hash",
  "transition_id"
];

export interface FactualEventAppraisalRecordV0 {
  readonly schema_version: typeof FACTUAL_EVENT_APPRAISAL_RECORD_SCHEMA_VERSION;
  readonly semantic_appraisal_episode: "INITIAL";
  readonly appraisal_ref: CanonicalRefV0;
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
  readonly subject_context: {
    readonly schema_version: typeof FACTUAL_EVENT_APPRAISAL_SUBJECT_CONTEXT_SCHEMA_VERSION;
    readonly current_task: string;
  };
  readonly context_projection_hash: HashV1;
  readonly dimensions: AppraisalDimensionsV0;
  readonly assessment_confidence: UnitIntervalV0;
  readonly evidence_refs: readonly CanonicalRefV0[];
  readonly provenance: {
    readonly provider_id: IdentifierV0;
    readonly provider_contract_version: typeof FACTUAL_EVENT_APPRAISAL_PROVIDER_CONTRACT_VERSION;
    readonly proposal_hash: HashV1;
    readonly transition_id: string;
  };
}

/** Canonical self-ref: derived from the stable admitted body EXCLUDING the
 * self ref (§31: repository-native stable hashing over the canonical body). */
export async function deriveFactualEventAppraisalRefV0(record: {
  readonly schema_version: typeof FACTUAL_EVENT_APPRAISAL_RECORD_SCHEMA_VERSION;
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
  readonly subject_context: { readonly schema_version: typeof FACTUAL_EVENT_APPRAISAL_SUBJECT_CONTEXT_SCHEMA_VERSION; readonly current_task: string };
  readonly context_projection_hash: string;
  readonly dimensions: AppraisalDimensionsV0;
  readonly assessment_confidence: UnitIntervalV0;
  readonly evidence_refs: readonly CanonicalRefV0[];
  readonly provenance: {
    readonly provider_id: string;
    readonly provider_contract_version: typeof FACTUAL_EVENT_APPRAISAL_PROVIDER_CONTRACT_VERSION;
    readonly proposal_hash: string;
    readonly transition_id: string;
  };
}): Promise<CanonicalRefV0> {
  return `appraisal:${strip(await hashEnvelope(FACTUAL_EVENT_APPRAISAL_REF_PROJECTION, {
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
    subject_context: record.subject_context,
    context_projection_hash: record.context_projection_hash,
    dimensions: record.dimensions,
    assessment_confidence: record.assessment_confidence,
    evidence_refs: record.evidence_refs,
    provenance: record.provenance
  }))}` as CanonicalRefV0;
}

/** Closed validation of one canonical FactualEventAppraisalRecordV0. Unknown
 * keys are structurally impossible; every hash/ref/time/dimension field is
 * validated fail-closed with no coercion and no defaults. */
export function validateFactualEventAppraisalRecordV0(v: unknown): ValidationResult<FactualEventAppraisalRecordV0> {
  if (!isRecord(v)) return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "record: expected object");
  const shell = closedKeys(v, RECORD_KEYS, "record");
  if (!shell.ok) return shell;
  if (v["schema_version"] !== FACTUAL_EVENT_APPRAISAL_RECORD_SCHEMA_VERSION) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "record.schema_version mismatch");
  }
  if (v["semantic_appraisal_episode"] !== SEMANTIC_APPRAISAL_EPISODE_INITIAL) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "record.semantic_appraisal_episode must be INITIAL");
  }
  if (!isString(v["appraisal_ref"]) || !(v["appraisal_ref"] as string).startsWith("appraisal:")) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "record.appraisal_ref: appraisal ref required");
  }
  const subject = validateIdentifier(v["subject_id"] as string, "record.subject_id");
  if (!subject.ok) return subject;
  if (!isString(v["factual_event_ref"]) || !(v["factual_event_ref"] as string).startsWith("event:")) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "record.factual_event_ref: event ref required");
  }
  if (!isHashV1Value(v["factual_event_payload_hash"])) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "record.factual_event_payload_hash: sha256 hash required");
  }
  if (!isString(v["source_observation_ref"]) || !(v["source_observation_ref"] as string).startsWith("observation:")) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "record.source_observation_ref: observation ref required");
  }
  if (!isString(v["source_observation_transition_id"]) || (v["source_observation_transition_id"] as string).length === 0) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "record.source_observation_transition_id: nonempty string required");
  }
  const historySequence = v["source_admission_history_sequence"];
  if (typeof historySequence !== "number" || !Number.isSafeInteger(historySequence) || historySequence < 0) {
    return fail("INVALID_VALUE_RANGE", "SS-SCHEMA-001", "record.source_admission_history_sequence: non-negative safe integer required");
  }

  if (!isRecord(v["subject_state"])) return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "record.subject_state: expected object");
  const stateKeys = closedKeys(v["subject_state"], SOURCE_STATE_KEYS, "record.subject_state");
  if (!stateKeys.ok) return stateKeys;
  const subjectState = v["subject_state"];
  const stateRevision = subjectState["state_revision"];
  if (typeof stateRevision !== "number" || !Number.isSafeInteger(stateRevision) || stateRevision < 0) {
    return fail("INVALID_VALUE_RANGE", "SS-SCHEMA-001", "record.subject_state.state_revision: non-negative safe integer required");
  }
  if (!isHashV1Value(subjectState["state_hash"])) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "record.subject_state.state_hash: sha256 hash required");
  }
  if (!isString(subjectState["repository_revision"]) || (subjectState["repository_revision"] as string).length === 0) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "record.subject_state.repository_revision: nonempty string required");
  }

  const rawEvaluatedAt = v["evaluated_at_logical_time"];
  if (typeof rawEvaluatedAt !== "number" || !Number.isSafeInteger(rawEvaluatedAt) || rawEvaluatedAt < 0) {
    return fail("INVALID_VALUE_RANGE", "SS-SCHEMA-001", "record.evaluated_at_logical_time: non-negative safe integer required");
  }

  if (!isRecord(v["subject_context"])) return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "record.subject_context: expected object");
  const contextKeys = closedKeys(v["subject_context"], SUBJECT_CONTEXT_KEYS, "record.subject_context");
  if (!contextKeys.ok) return contextKeys;
  const subjectContext = v["subject_context"];
  if (subjectContext["schema_version"] !== FACTUAL_EVENT_APPRAISAL_SUBJECT_CONTEXT_SCHEMA_VERSION) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "record.subject_context.schema_version mismatch");
  }
  const currentTask = validateCanonicalText(subjectContext["current_task"], "record.subject_context.current_task");
  if (!currentTask.ok) return currentTask;

  if (!isHashV1Value(v["context_projection_hash"])) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "record.context_projection_hash: sha256 hash required");
  }
  const dimensions = validateAppraisalDimensionsV0(v["dimensions"]);
  if (!dimensions.ok) return dimensions;
  const rawConfidence = v["assessment_confidence"];
  if (typeof rawConfidence !== "number" || !Number.isFinite(rawConfidence)) {
    return fail("INVALID_VALUE_RANGE", "SS-SCHEMA-001", "record.assessment_confidence: UnitIntervalV0 required");
  }
  const confidence = validateUnitInterval(rawConfidence, "record.assessment_confidence");
  if (!confidence.ok) return confidence;
  const evidence = validateRefArray(v["evidence_refs"], "record.evidence_refs", { sorted: true });
  if (!evidence.ok) return evidence;

  if (!isRecord(v["provenance"])) return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "record.provenance: expected object");
  const provenanceKeys = closedKeys(v["provenance"], PROVENANCE_KEYS, "record.provenance");
  if (!provenanceKeys.ok) return provenanceKeys;
  const provenance = v["provenance"];
  const providerId = validateIdentifier(provenance["provider_id"] as string, "record.provenance.provider_id");
  if (!providerId.ok) return providerId;
  if (provenance["provider_contract_version"] !== FACTUAL_EVENT_APPRAISAL_PROVIDER_CONTRACT_VERSION) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "record.provenance.provider_contract_version mismatch");
  }
  if (!isHashV1Value(provenance["proposal_hash"])) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "record.provenance.proposal_hash: sha256 hash required");
  }
  if (!isString(provenance["transition_id"]) || (provenance["transition_id"] as string).length === 0) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "record.provenance.transition_id: nonempty string required");
  }

  return ok({
    schema_version: FACTUAL_EVENT_APPRAISAL_RECORD_SCHEMA_VERSION,
    semantic_appraisal_episode: SEMANTIC_APPRAISAL_EPISODE_INITIAL,
    appraisal_ref: v["appraisal_ref"] as CanonicalRefV0,
    subject_id: subject.value,
    factual_event_ref: v["factual_event_ref"] as CanonicalRefV0,
    factual_event_payload_hash: v["factual_event_payload_hash"] as HashV1,
    source_observation_ref: v["source_observation_ref"] as CanonicalRefV0,
    source_observation_transition_id: v["source_observation_transition_id"] as string,
    source_admission_history_sequence: historySequence,
    subject_state: {
      state_revision: stateRevision as StateRevisionV0,
      state_hash: subjectState["state_hash"] as HashV1,
      repository_revision: subjectState["repository_revision"] as string
    },
    evaluated_at_logical_time: rawEvaluatedAt as LogicalTimeV0,
    subject_context: {
      schema_version: FACTUAL_EVENT_APPRAISAL_SUBJECT_CONTEXT_SCHEMA_VERSION,
      current_task: currentTask.value
    },
    context_projection_hash: v["context_projection_hash"] as HashV1,
    dimensions: dimensions.value,
    assessment_confidence: confidence.value,
    evidence_refs: v["evidence_refs"] as readonly CanonicalRefV0[],
    provenance: {
      provider_id: providerId.value,
      provider_contract_version: FACTUAL_EVENT_APPRAISAL_PROVIDER_CONTRACT_VERSION,
      proposal_hash: provenance["proposal_hash"] as HashV1,
      transition_id: provenance["transition_id"] as string
    }
  });
}

/** §19: deterministic preparation-intent identity around the ONE-INITIAL
 * tuple (subject, factual event, INITIAL) — never provider/revision/version
 * dependent beyond the lawful expected state revision anchor. */
export async function deriveFactualEventAppraisalIntentId(params: {
  readonly subject_id: string;
  readonly factual_event_ref: string;
  readonly expected_state_revision: number;
  readonly rebuild_ordinal: number;
}): Promise<string> {
  const digest = await hashEnvelope("characteros-next/memory/factual-event-appraisal-prepare-intent/v1", params);
  return `li-${digest.replace(/^sha256:/, "")}`;
}

// ----------------------------------------------------------------------------------
// Provider contract (§54): shared subjective proposal interface around the
// same dimensions/evidence semantics — the system owns all authority fields.
// ----------------------------------------------------------------------------------

/** The pre-cognition context projection the provider answers. All authority
 * fields (subject, event, observation grounding, state anchors, times) are
 * system-constructed; the provider receives them read-only. */
export interface FactualEventAppraisalContextProjectionV0 {
  readonly schema_version: "factual-event-appraisal-context-v0";
  readonly subject_id: IdentifierV0;
  readonly factual_event_ref: CanonicalRefV0;
  readonly factual_event_payload_hash: HashV1;
  readonly source_observation_ref: CanonicalRefV0;
  readonly source_observation_transition_id: string;
  readonly source_admission_history_sequence: number;
  readonly state_revision: StateRevisionV0;
  readonly state_hash: HashV1;
  readonly repository_revision: string;
  readonly logical_time: LogicalTimeV0;
  /** §17: current subject task; null triggers INSUFFICIENT_CONTEXT law. */
  readonly current_task: string | null;
  readonly context_projection_hash: HashV1;
}

/** The factual-event appraisal provider port: proposes ONLY subjective
 * dimensions/confidence/evidence over the frozen factual context. */
export interface FactualEventAppraisalProviderV0 {
  proposeFactualEventAppraisal(
    context: FactualEventAppraisalContextProjectionV0
  ): Promise<unknown>;
}
