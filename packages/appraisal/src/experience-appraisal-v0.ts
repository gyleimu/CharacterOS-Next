/**
 * EXPERIENCE_APPRAISAL_INTEGRATION_V0 — shared Appraisal semantic foundation.
 *
 * Architecture decision (frozen): NEW_BOUNDED_APPRAISAL_FOUNDATION_REQUIRED.
 * This module is the SINGLE shared semantic definition of the six-dimensional
 * Appraisal model, the Experience-Appraisal provider result contracts, the
 * canonical immutable Appraisal record, and their validators/identity.
 *
 * SEMANTIC LAW: FACT ≠ APPRAISAL ≠ AFFECT. The six dimensions are the
 * SUBJECT's subjective evaluation of authoritative facts — never external
 * facts themselves, never affect, never an emotion label. Subjective does not
 * mean objectively correct: the system never forces psychologically
 * "reasonable" values; admission checks grounding/schema/evidence only.
 *
 * PACKAGE DISCIPLINE: this package is a PURE contract/validation package
 * (schema, validation, identity only). It depends on subject-core scalars and
 * memory's branded ref types — never on runtime. Runtime owns
 * orchestration/admission/commit.
 *
 * Reuse law (§3/§53): the six active dimensions and the closed attribution
 * enum are EXACTLY the existing frozen Observation semantics
 * (relevance, goal_congruence, attribution: "self"|"other"|"situation",
 * controllability, uncertainty, intensity; UnitIntervalV0 numerics; no
 * coercion, no rounding, no NaN, no Infinity). The existing Observation
 * appraisal validator reuses these without behavior change.
 */

import type {
  CanonicalRefV0,
  HashV1,
  IdentifierV0,
  LogicalTimeV0,
  RepositoryRevisionIdV0,
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
import type {
  AppraisalRef,
  EpisodeRef,
  EventRef,
  ExperienceRef
} from "@characteros-next/memory";

// ----------------------------------------------------------------------------------
// Shared six-dimensional semantics (reused by the Observation appraisal path)
// ----------------------------------------------------------------------------------

/** Closed categorical attribution locus (existing frozen resolution). */
export type AppraisalAttributionV0 = "self" | "other" | "situation";

export const APPRAISAL_ATTRIBUTION_LITERALS_V0: readonly AppraisalAttributionV0[] = [
  "self",
  "other",
  "situation"
];

/** The six frozen Appraisal dimensions — the shared semantic surface. */
export interface AppraisalDimensionsV0 {
  readonly relevance: UnitIntervalV0;
  readonly goal_congruence: UnitIntervalV0;
  readonly attribution: AppraisalAttributionV0;
  readonly controllability: UnitIntervalV0;
  readonly uncertainty: UnitIntervalV0;
  readonly intensity: UnitIntervalV0;
}

const DIMENSION_KEYS: readonly string[] = [
  "relevance",
  "goal_congruence",
  "attribution",
  "controllability",
  "uncertainty",
  "intensity"
];

const NUMERIC_DIMENSION_KEYS: readonly string[] = [
  "relevance",
  "goal_congruence",
  "controllability",
  "uncertainty",
  "intensity"
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

function isAttributionLiteral(v: unknown): v is AppraisalAttributionV0 {
  return typeof v === "string" && (APPRAISAL_ATTRIBUTION_LITERALS_V0 as readonly string[]).includes(v);
}

/**
 * Validates one closed AppraisalDimensionsV0 object. No coercion, no defaults:
 * every numeric field must be a finite UnitIntervalV0 and attribution must be
 * the exact categorical literal.
 */
export function validateAppraisalDimensionsV0(v: unknown): ValidationResult<AppraisalDimensionsV0> {
  if (!isRecord(v)) return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "appraisal dimensions: expected object");
  const shell = closedKeys(v, DIMENSION_KEYS, "appraisal dimensions");
  if (!shell.ok) return shell;
  for (const field of NUMERIC_DIMENSION_KEYS) {
    const value = v[field];
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
      return fail("INVALID_VALUE_RANGE", "SS-SCHEMA-001", `appraisal.${field}: UnitIntervalV0 required`);
    }
    const checked = validateUnitInterval(value, `appraisal.${field}`);
    if (!checked.ok) return checked;
  }
  if (!isAttributionLiteral(v["attribution"])) {
    return fail(
      "INVALID_SCHEMA",
      "SS-SCHEMA-001",
      `appraisal.attribution: expected exactly "self" | "other" | "situation" (closed enum, no coercion)`
    );
  }
  return ok({
    relevance: v["relevance"] as UnitIntervalV0,
    goal_congruence: v["goal_congruence"] as UnitIntervalV0,
    attribution: v["attribution"],
    controllability: v["controllability"] as UnitIntervalV0,
    uncertainty: v["uncertainty"] as UnitIntervalV0,
    intensity: v["intensity"] as UnitIntervalV0
  });
}

// ----------------------------------------------------------------------------------
// Provider result contracts (§12/§13/§42)
// ----------------------------------------------------------------------------------

export const EXPERIENCE_APPRAISAL_PROPOSAL_SCHEMA_VERSION = "experience-appraisal-proposal-v0" as const;
export const EXPERIENCE_APPRAISAL_PROVIDER_CONTRACT_VERSION = "experience-appraisal-provider-v0" as const;

/** APPRAISED result: the provider's complete subjective evaluation proposal. */
export interface ExperienceAppraisalProposedV0 {
  readonly schema_version: typeof EXPERIENCE_APPRAISAL_PROPOSAL_SCHEMA_VERSION;
  readonly status: "APPRAISED";
  readonly subject_id: IdentifierV0;
  readonly experience_ref: ExperienceRef;
  readonly context_projection_hash: HashV1;
  readonly dimensions: AppraisalDimensionsV0;
  readonly assessment_confidence: UnitIntervalV0;
  readonly evidence_refs: readonly CanonicalRefV0[];
}

/** Abstention result: the provider declines without proposing any dimensions. */
export interface ExperienceAppraisalInsufficientV0 {
  readonly schema_version: typeof EXPERIENCE_APPRAISAL_PROPOSAL_SCHEMA_VERSION;
  readonly status: "INSUFFICIENT_CONTEXT";
  readonly subject_id: IdentifierV0;
  readonly experience_ref: ExperienceRef;
  readonly context_projection_hash: HashV1;
  readonly missing_inputs: readonly ["CURRENT_TASK"];
}

export type ExperienceAppraisalProposalV0 =
  | ExperienceAppraisalProposedV0
  | ExperienceAppraisalInsufficientV0;

const PROPOSAL_KEYS: readonly string[] = [
  "schema_version",
  "status",
  "subject_id",
  "experience_ref",
  "context_projection_hash",
  "dimensions",
  "assessment_confidence",
  "evidence_refs"
];

const INSUFFICIENT_KEYS: readonly string[] = [
  "schema_version",
  "status",
  "subject_id",
  "experience_ref",
  "context_projection_hash",
  "missing_inputs"
];

function isHashV1(v: unknown): v is HashV1 {
  return isString(v) && /^sha256:[0-9a-f]{64}$/.test(v);
}

/**
 * Closed validation of one Experience-Appraisal provider result. Rejects
 * rationale/emotion/sentiment/reward/appraisal_ref/authority fields (closed
 * keys), NaN/Infinity/out-of-range dimensions, invalid attribution, invalid
 * confidence and unordered/duplicate evidence arrays. No coercion, no defaults.
 */
export function validateExperienceAppraisalProposalV0(v: unknown): ValidationResult<ExperienceAppraisalProposalV0> {
  if (!isRecord(v)) return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "proposal: expected object");
  if (v["schema_version"] !== EXPERIENCE_APPRAISAL_PROPOSAL_SCHEMA_VERSION) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "proposal.schema_version mismatch");
  }
  const subject = validateIdentifier(v["subject_id"] as string, "proposal.subject_id");
  if (!subject.ok) return subject;
  if (!isString(v["experience_ref"]) || !(v["experience_ref"] as string).startsWith("experience:")) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "proposal.experience_ref: experience ref required");
  }
  if (!isHashV1(v["context_projection_hash"])) {
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
      schema_version: EXPERIENCE_APPRAISAL_PROPOSAL_SCHEMA_VERSION,
      status: "APPRAISED",
      subject_id: subject.value,
      experience_ref: v["experience_ref"] as ExperienceRef,
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
    if (
      !Array.isArray(missing) ||
      missing.length !== 1 ||
      missing[0] !== "CURRENT_TASK"
    ) {
      return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "proposal.missing_inputs: exactly [\"CURRENT_TASK\"] required");
    }
    return ok({
      schema_version: EXPERIENCE_APPRAISAL_PROPOSAL_SCHEMA_VERSION,
      status: "INSUFFICIENT_CONTEXT",
      subject_id: subject.value,
      experience_ref: v["experience_ref"] as ExperienceRef,
      context_projection_hash: v["context_projection_hash"] as HashV1,
      missing_inputs: ["CURRENT_TASK"]
    });
  }
  return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "proposal.status: APPRAISED | INSUFFICIENT_CONTEXT required");
}

// ----------------------------------------------------------------------------------
// Identity derivations (§25)
// ----------------------------------------------------------------------------------

const EXPERIENCE_APPRAISAL_PROPOSAL_HASH_PROJECTION =
  "characteros-next/appraisal/experience-appraisal-proposal-hash/v1" as const;
const EXPERIENCE_APPRAISAL_REF_PROJECTION =
  "characteros-next/appraisal/experience-appraisal-ref/v1" as const;

function strip(digest: string): string {
  return digest.replace(/^sha256:/, "");
}

/**
 * Proposal hash: binds ONLY the context projection hash, the structured
 * dimensions, the assessment confidence and the canonical evidence refs.
 * Never latency/retry/UUID/token/transport metadata.
 */
export async function deriveExperienceAppraisalProposalHashV0(proposal: {
  readonly context_projection_hash: string;
  readonly dimensions: AppraisalDimensionsV0;
  readonly assessment_confidence: UnitIntervalV0;
  readonly evidence_refs: readonly CanonicalRefV0[];
}): Promise<HashV1> {
  return hashEnvelope(EXPERIENCE_APPRAISAL_PROPOSAL_HASH_PROJECTION, {
    context_projection_hash: proposal.context_projection_hash,
    dimensions: proposal.dimensions,
    assessment_confidence: proposal.assessment_confidence,
    evidence_refs: proposal.evidence_refs
  });
}

/**
 * Canonical Appraisal ref: derived from the stable admitted record body
 * EXCLUDING its self ref (see validateExperienceAppraisalRecordV0 for the exact
 * bound field set). Content-addressed, domain-separated.
 */
export async function deriveExperienceAppraisalRefV0(record: {
  readonly subject_id: string;
  readonly experience_ref: string;
  readonly experience_payload_hash: string;
  readonly grounding: {
    readonly source_episode_ref: string;
    readonly source_episode_payload_hash: string;
    readonly source_event_ref: string;
    readonly source_event_payload_hash: string;
    readonly outcome_ref: string;
    readonly behavior_delivery_id: string;
    readonly behavior_payload_hash: string;
  };
  readonly evaluated_at_logical_time: number;
  readonly source_state: {
    readonly state_revision: number;
    readonly state_hash: string;
    readonly repository_revision: string;
  };
  readonly subject_context: { readonly current_task: string };
  readonly context_projection_hash: string;
  readonly dimensions: AppraisalDimensionsV0;
  readonly assessment_confidence: UnitIntervalV0;
  readonly evidence_refs: readonly CanonicalRefV0[];
  readonly provenance: {
    readonly provider_id: string;
    readonly provider_contract_version: string;
    readonly proposal_hash: string;
    readonly transition_id: string;
  };
}): Promise<AppraisalRef> {
  return `appraisal:${strip(
    await hashEnvelope(EXPERIENCE_APPRAISAL_REF_PROJECTION, {
      subject_id: record.subject_id,
      experience_ref: record.experience_ref,
      experience_payload_hash: record.experience_payload_hash,
      grounding: record.grounding,
      evaluated_at_logical_time: record.evaluated_at_logical_time,
      source_state: record.source_state,
      subject_context: record.subject_context,
      context_projection_hash: record.context_projection_hash,
      dimensions: record.dimensions,
      assessment_confidence: record.assessment_confidence,
      evidence_refs: record.evidence_refs,
      provenance: record.provenance
    })
  )}` as AppraisalRef;
}

// ----------------------------------------------------------------------------------
// Canonical immutable record (§6)
// ----------------------------------------------------------------------------------

export const EXPERIENCE_APPRAISAL_RECORD_SCHEMA_VERSION = "experience-appraisal-record-v0" as const;
export const EXPERIENCE_APPRAISAL_KIND_INITIAL = "INITIAL" as const;
export const EXPERIENCE_APPRAISAL_SUBJECT_CONTEXT_SCHEMA_VERSION =
  "experience-appraisal-subject-context-v0" as const;

/** The immutable canonical Appraisal record bound to authoritative Experience. */
export interface ExperienceAppraisalRecordV0 {
  readonly schema_version: typeof EXPERIENCE_APPRAISAL_RECORD_SCHEMA_VERSION;
  readonly appraisal_kind: typeof EXPERIENCE_APPRAISAL_KIND_INITIAL;
  readonly appraisal_ref: AppraisalRef;
  readonly subject_id: IdentifierV0;
  readonly experience_ref: ExperienceRef;
  readonly experience_payload_hash: HashV1;
  readonly grounding: {
    readonly source_episode_ref: EpisodeRef;
    readonly source_episode_payload_hash: HashV1;
    readonly source_event_ref: EventRef;
    readonly source_event_payload_hash: HashV1;
    readonly outcome_ref: CanonicalRefV0;
    readonly behavior_delivery_id: IdentifierV0;
    readonly behavior_payload_hash: HashV1;
  };
  readonly evaluated_at_logical_time: LogicalTimeV0;
  readonly source_state: {
    readonly state_revision: StateRevisionV0;
    readonly state_hash: HashV1;
    readonly repository_revision: RepositoryRevisionIdV0;
  };
  readonly subject_context: {
    readonly schema_version: typeof EXPERIENCE_APPRAISAL_SUBJECT_CONTEXT_SCHEMA_VERSION;
    readonly current_task: string;
  };
  readonly context_projection_hash: HashV1;
  readonly dimensions: AppraisalDimensionsV0;
  readonly assessment_confidence: UnitIntervalV0;
  readonly evidence_refs: readonly CanonicalRefV0[];
  readonly provenance: {
    readonly provider_id: IdentifierV0;
    readonly provider_contract_version: typeof EXPERIENCE_APPRAISAL_PROVIDER_CONTRACT_VERSION;
    readonly proposal_hash: HashV1;
    readonly transition_id: string;
  };
}

const RECORD_KEYS: readonly string[] = [
  "schema_version",
  "appraisal_kind",
  "appraisal_ref",
  "subject_id",
  "experience_ref",
  "experience_payload_hash",
  "grounding",
  "evaluated_at_logical_time",
  "source_state",
  "subject_context",
  "context_projection_hash",
  "dimensions",
  "assessment_confidence",
  "evidence_refs",
  "provenance"
];

const GROUNDING_KEYS: readonly string[] = [
  "source_episode_ref",
  "source_episode_payload_hash",
  "source_event_ref",
  "source_event_payload_hash",
  "outcome_ref",
  "behavior_delivery_id",
  "behavior_payload_hash"
];

const SOURCE_STATE_KEYS: readonly string[] = ["state_revision", "state_hash", "repository_revision"];

const SUBJECT_CONTEXT_KEYS: readonly string[] = ["schema_version", "current_task"];

const PROVENANCE_KEYS: readonly string[] = [
  "provider_id",
  "provider_contract_version",
  "proposal_hash",
  "transition_id"
];

function isHashV1Value(v: unknown): v is HashV1 {
  return isString(v) && /^sha256:[0-9a-f]{64}$/.test(v);
}

/**
 * Closed validation of one canonical ExperienceAppraisalRecordV0. Unknown keys
 * (rationale/explanation/external_fact/sentiment/emotion/reward/…) are
 * structurally impossible; every hash/ref/time/dimension field is validated
 * fail-closed with no coercion and no defaults.
 */
export function validateExperienceAppraisalRecordV0(v: unknown): ValidationResult<ExperienceAppraisalRecordV0> {
  if (!isRecord(v)) return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "record: expected object");
  const shell = closedKeys(v, RECORD_KEYS, "record");
  if (!shell.ok) return shell;
  if (v["schema_version"] !== EXPERIENCE_APPRAISAL_RECORD_SCHEMA_VERSION) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "record.schema_version mismatch");
  }
  if (v["appraisal_kind"] !== EXPERIENCE_APPRAISAL_KIND_INITIAL) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "record.appraisal_kind must be INITIAL");
  }
  if (!isString(v["appraisal_ref"]) || !(v["appraisal_ref"] as string).startsWith("appraisal:")) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "record.appraisal_ref: appraisal ref required");
  }
  const subject = validateIdentifier(v["subject_id"] as string, "record.subject_id");
  if (!subject.ok) return subject;
  if (!isString(v["experience_ref"]) || !(v["experience_ref"] as string).startsWith("experience:")) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "record.experience_ref: experience ref required");
  }
  if (!isHashV1Value(v["experience_payload_hash"])) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "record.experience_payload_hash: sha256 hash required");
  }

  if (!isRecord(v["grounding"])) return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "record.grounding: expected object");
  const groundingKeys = closedKeys(v["grounding"], GROUNDING_KEYS, "record.grounding");
  if (!groundingKeys.ok) return groundingKeys;
  const grounding = v["grounding"];
  if (!isString(grounding["source_episode_ref"]) || !(grounding["source_episode_ref"] as string).startsWith("episode:")) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "record.grounding.source_episode_ref: episode ref required");
  }
  if (!isHashV1Value(grounding["source_episode_payload_hash"])) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "record.grounding.source_episode_payload_hash: sha256 hash required");
  }
  if (!isString(grounding["source_event_ref"]) || !(grounding["source_event_ref"] as string).startsWith("event:")) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "record.grounding.source_event_ref: event ref required");
  }
  if (!isHashV1Value(grounding["source_event_payload_hash"])) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "record.grounding.source_event_payload_hash: sha256 hash required");
  }
  if (!isString(grounding["outcome_ref"]) || !(grounding["outcome_ref"] as string).startsWith("outcome:")) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "record.grounding.outcome_ref: outcome ref required");
  }
  const deliveryId = validateIdentifier(grounding["behavior_delivery_id"] as string, "record.grounding.behavior_delivery_id");
  if (!deliveryId.ok) return deliveryId;
  if (!isHashV1Value(grounding["behavior_payload_hash"])) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "record.grounding.behavior_payload_hash: sha256 hash required");
  }

  const rawEvaluatedAt = v["evaluated_at_logical_time"];
  if (typeof rawEvaluatedAt !== "number" || !Number.isSafeInteger(rawEvaluatedAt) || rawEvaluatedAt < 0) {
    return fail("INVALID_VALUE_RANGE", "SS-SCHEMA-001", "record.evaluated_at_logical_time: non-negative safe integer required");
  }

  if (!isRecord(v["source_state"])) return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "record.source_state: expected object");
  const stateKeys = closedKeys(v["source_state"], SOURCE_STATE_KEYS, "record.source_state");
  if (!stateKeys.ok) return stateKeys;
  const sourceState = v["source_state"];
  const stateRevision = sourceState["state_revision"];
  if (typeof stateRevision !== "number" || !Number.isSafeInteger(stateRevision) || stateRevision < 0) {
    return fail("INVALID_VALUE_RANGE", "SS-SCHEMA-001", "record.source_state.state_revision: non-negative safe integer required");
  }
  if (!isHashV1Value(sourceState["state_hash"])) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "record.source_state.state_hash: sha256 hash required");
  }
  if (!isString(sourceState["repository_revision"]) || (sourceState["repository_revision"] as string).length === 0) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "record.source_state.repository_revision: nonempty string required");
  }

  if (!isRecord(v["subject_context"])) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "record.subject_context: expected object");
  }
  const contextKeys = closedKeys(v["subject_context"], SUBJECT_CONTEXT_KEYS, "record.subject_context");
  if (!contextKeys.ok) return contextKeys;
  const subjectContext = v["subject_context"];
  if (subjectContext["schema_version"] !== EXPERIENCE_APPRAISAL_SUBJECT_CONTEXT_SCHEMA_VERSION) {
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
  if (!(v["evidence_refs"] as readonly string[]).includes(v["experience_ref"] as string)) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "record.evidence_refs: mandatory experience_ref missing");
  }

  if (!isRecord(v["provenance"])) return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "record.provenance: expected object");
  const provenanceKeys = closedKeys(v["provenance"], PROVENANCE_KEYS, "record.provenance");
  if (!provenanceKeys.ok) return provenanceKeys;
  const provenance = v["provenance"];
  const providerId = validateIdentifier(provenance["provider_id"] as string, "record.provenance.provider_id");
  if (!providerId.ok) return providerId;
  if (provenance["provider_contract_version"] !== EXPERIENCE_APPRAISAL_PROVIDER_CONTRACT_VERSION) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "record.provenance.provider_contract_version mismatch");
  }
  if (!isHashV1Value(provenance["proposal_hash"])) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "record.provenance.proposal_hash: sha256 hash required");
  }
  if (!isString(provenance["transition_id"]) || (provenance["transition_id"] as string).length === 0) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "record.provenance.transition_id: nonempty string required");
  }

  return ok({
    schema_version: EXPERIENCE_APPRAISAL_RECORD_SCHEMA_VERSION,
    appraisal_kind: EXPERIENCE_APPRAISAL_KIND_INITIAL,
    appraisal_ref: v["appraisal_ref"] as AppraisalRef,
    subject_id: subject.value,
    experience_ref: v["experience_ref"] as ExperienceRef,
    experience_payload_hash: v["experience_payload_hash"] as HashV1,
    grounding: {
      source_episode_ref: grounding["source_episode_ref"] as EpisodeRef,
      source_episode_payload_hash: grounding["source_episode_payload_hash"] as HashV1,
      source_event_ref: grounding["source_event_ref"] as EventRef,
      source_event_payload_hash: grounding["source_event_payload_hash"] as HashV1,
      outcome_ref: grounding["outcome_ref"] as CanonicalRefV0,
      behavior_delivery_id: deliveryId.value,
      behavior_payload_hash: grounding["behavior_payload_hash"] as HashV1
    },
    evaluated_at_logical_time: rawEvaluatedAt as LogicalTimeV0,
    source_state: {
      state_revision: stateRevision as StateRevisionV0,
      state_hash: sourceState["state_hash"] as HashV1,
      repository_revision: sourceState["repository_revision"] as never
    },
    subject_context: {
      schema_version: EXPERIENCE_APPRAISAL_SUBJECT_CONTEXT_SCHEMA_VERSION,
      current_task: currentTask.value
    },
    context_projection_hash: v["context_projection_hash"] as HashV1,
    dimensions: dimensions.value,
    assessment_confidence: confidence.value,
    evidence_refs: v["evidence_refs"] as readonly CanonicalRefV0[],
    provenance: {
      provider_id: providerId.value,
      provider_contract_version: EXPERIENCE_APPRAISAL_PROVIDER_CONTRACT_VERSION,
      proposal_hash: provenance["proposal_hash"] as HashV1,
      transition_id: provenance["transition_id"] as string
    }
  });
}
