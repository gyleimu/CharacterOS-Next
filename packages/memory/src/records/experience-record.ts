/**
 * BEHAVIOR_EXPERIENCE_FEEDBACK_V0 — ExperienceRecordV0 (pure).
 *
 * The immutable, subject-bound factual lineage record (`experience:<hex>`)
 * connecting a VERIFIED delivered conversation behavior to a FACTUAL external
 * conversation reply outcome, bound to the committed source Observation (O2).
 *
 * experience_kind = "BEHAVIOR_OUTCOME" — the only kind in this V0 slice.
 *
 * FACTS ONLY: the record carries the exact reply text and causal lineage. It
 * contains NO approval, NO rejection label, NO sentiment, NO reward, NO trust,
 * NO success/confidence semantics of any kind — the closed key set makes such
 * fields structurally impossible. The full delivered behavior artifact is
 * bound together with its payload hash; the MEMORY-side validator checks
 * closed structure only — the artifact contract and hash recomputation are
 * verified by the runtime feedback authority and experience reader (the memory
 * package deliberately does not depend on the behavior package).
 */

import type { CanonicalRefV0, HashV1, IdentifierV0, LogicalTimeV0 } from "@characteros-next/subject-core";
import {
  isRecord,
  isString,
  validateCanonicalText,
  validateHash,
  validateIdentifier,
  validateLogicalTime,
  validateRefArray,
  validateRefElement
} from "@characteros-next/subject-core";
import { fail, ok, type ValidationResult } from "@characteros-next/subject-core";
import { parseEventRef, parseExperienceRef, type EventRef, type ExperienceRef } from "../refs.js";

export const EXPERIENCE_RECORD_SCHEMA_VERSION = "experience-record-v0" as const;

/** The only experience kind in this slice. */
export const EXPERIENCE_KIND_BEHAVIOR_OUTCOME = "BEHAVIOR_OUTCOME" as const;

/** Closed factual conversation reply outcome (facts only, no semantics). */
export interface ConversationReplyOutcomeV0 {
  /** Closed outcome kind literal — conversation reply, nothing else in V0. */
  readonly outcome_kind: "CONVERSATION_REPLY";
  /** Content-derived self ref (`outcome:<hex>`). */
  readonly outcome_ref: CanonicalRefV0;
  /** The external actor ref (kinds `entity` | `subject`). */
  readonly actor_ref: CanonicalRefV0;
  /** Exact accepted NFC reply text — the canonical fact itself. */
  readonly text: string;
  /** Canonical logical time of the reply occurrence (>= delivered time). */
  readonly logical_time: LogicalTimeV0;
  /** Stable host source event identity (mirrors the ingress event record). */
  readonly source_event_id: IdentifierV0;
}

/** Cognition/projection lineage hashes carried from the conversation V1 trace. */
export interface ExperienceCognitionLineageV0 {
  readonly cognition_projection_hash: string;
  readonly conversation_cognition_proposal_hash: string;
  readonly realization_input_hash: string;
}

/** Exact closed behavior-outcome experience record. */
export interface ExperienceRecordV0 {
  readonly schema_version: typeof EXPERIENCE_RECORD_SCHEMA_VERSION;
  readonly experience_kind: typeof EXPERIENCE_KIND_BEHAVIOR_OUTCOME;
  /** Content-derived self ref (`experience:<hex>`). */
  readonly experience_ref: ExperienceRef;
  readonly subject_id: IdentifierV0;
  readonly conversation_id: IdentifierV0;
  /** The committed source Observation (O2) ref — kind `observation`. */
  readonly source_observation_ref: CanonicalRefV0;
  /** The committed source Observation transition identity. */
  readonly observation_transition_id: string;
  /** The verified delivered-behavior parent (delivery ledger identity). */
  readonly behavior_delivery_id: IdentifierV0;
  /** Payload hash of the full behavior artifact (recomputed by the reader). */
  readonly behavior_payload_hash: HashV1;
  /** The COMPLETE delivered behavior artifact (closed shape, runtime-verified). */
  readonly behavior_artifact: unknown;
  /** Cognition/projection lineage if available; null when not carried. */
  readonly cognition_lineage: ExperienceCognitionLineageV0 | null;
  /** The bound ingress event record ref (`event:<hex>`). */
  readonly event_ref: EventRef;
  /** The nested factual outcome. */
  readonly outcome: ConversationReplyOutcomeV0;
  /** Delivered logical time of the parent behavior. */
  readonly delivered_logical_time: LogicalTimeV0;
  /** Convenience copy of the outcome occurrence time (must equal outcome.logical_time). */
  readonly outcome_logical_time: LogicalTimeV0;
  /** Host feedback adapter provenance label. */
  readonly host_adapter: string;
  /** Cause/provenance refs, set-like: unique and lexicographically sorted. */
  readonly provenance_refs: readonly CanonicalRefV0[];
}

const RECORD_KEYS: readonly string[] = [
  "schema_version",
  "experience_kind",
  "experience_ref",
  "subject_id",
  "conversation_id",
  "source_observation_ref",
  "observation_transition_id",
  "behavior_delivery_id",
  "behavior_payload_hash",
  "behavior_artifact",
  "cognition_lineage",
  "event_ref",
  "outcome",
  "delivered_logical_time",
  "outcome_logical_time",
  "host_adapter",
  "provenance_refs"
];

const OUTCOME_KEYS: readonly string[] = [
  "outcome_kind",
  "outcome_ref",
  "actor_ref",
  "text",
  "logical_time",
  "source_event_id"
];

const LINEAGE_KEYS: readonly string[] = [
  "cognition_projection_hash",
  "conversation_cognition_proposal_hash",
  "realization_input_hash"
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

function validateLineage(v: unknown, d: string): ValidationResult<ExperienceCognitionLineageV0> {
  if (!isRecord(v)) return fail("INVALID_SCHEMA", "SS-SCHEMA-001", `${d}: not an object`);
  const keys = closedKeys(v, LINEAGE_KEYS, d);
  if (!keys.ok) return keys;
  for (const field of LINEAGE_KEYS) {
    if (!isString(v[field]) || (v[field] as string).length === 0) {
      return fail("INVALID_SCHEMA", "SS-SCHEMA-001", `${d}.${field}: nonempty string required`);
    }
  }
  return ok({
    cognition_projection_hash: v["cognition_projection_hash"] as string,
    conversation_cognition_proposal_hash: v["conversation_cognition_proposal_hash"] as string,
    realization_input_hash: v["realization_input_hash"] as string
  });
}

/**
 * Closed-shape validation of one behavior-outcome experience record. Rejects
 * unknown keys (no approval/reward/trust surface can ever appear), non-NFC
 * text, bad ref grammar/kinds, and internal inconsistencies — fail closed,
 * never repairs or coerces.
 */
export function validateExperienceRecord(v: unknown): ValidationResult<ExperienceRecordV0> {
  if (!isRecord(v)) return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "record: not an object");
  const shell = closedKeys(v, RECORD_KEYS, "record");
  if (!shell.ok) return shell;

  if (v["schema_version"] !== EXPERIENCE_RECORD_SCHEMA_VERSION) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "record.schema_version mismatch");
  }
  if (v["experience_kind"] !== EXPERIENCE_KIND_BEHAVIOR_OUTCOME) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "record.experience_kind must be BEHAVIOR_OUTCOME");
  }
  const experienceRef = parseExperienceRef(v["experience_ref"], "record.experience_ref");
  if (!experienceRef.ok) return experienceRef;

  const subject = validateIdentifier(v["subject_id"] as string, "record.subject_id");
  if (!subject.ok) return subject;
  const conversation = validateIdentifier(v["conversation_id"] as string, "record.conversation_id");
  if (!conversation.ok) return conversation;

  const observationRef = validateRefElement(
    v["source_observation_ref"],
    "record.source_observation_ref",
    ["observation"]
  );
  if (!observationRef.ok) return observationRef;

  if (!isString(v["observation_transition_id"]) || (v["observation_transition_id"] as string).length === 0) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "record.observation_transition_id: nonempty string required");
  }

  const deliveryId = validateIdentifier(v["behavior_delivery_id"] as string, "record.behavior_delivery_id");
  if (!deliveryId.ok) return deliveryId;

  const behaviorHash = validateHash(v["behavior_payload_hash"] as string, "record.behavior_payload_hash");
  if (!behaviorHash.ok) return behaviorHash;

  if (!isRecord(v["behavior_artifact"])) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "record.behavior_artifact: object required");
  }

  let lineage: ExperienceCognitionLineageV0 | null = null;
  if (v["cognition_lineage"] !== null) {
    const lineageChecked = validateLineage(v["cognition_lineage"], "record.cognition_lineage");
    if (!lineageChecked.ok) return lineageChecked;
    lineage = lineageChecked.value;
  }

  const eventRef = parseEventRef(v["event_ref"], "record.event_ref");
  if (!eventRef.ok) return eventRef;

  // ---- nested factual outcome ---------------------------------------------------
  if (!isRecord(v["outcome"])) return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "record.outcome: not an object");
  const outcomeKeys = closedKeys(v["outcome"], OUTCOME_KEYS, "record.outcome");
  if (!outcomeKeys.ok) return outcomeKeys;
  if (v["outcome"]["outcome_kind"] !== "CONVERSATION_REPLY") {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "record.outcome.outcome_kind must be CONVERSATION_REPLY");
  }
  const outcomeRef = validateRefElement(
    v["outcome"]["outcome_ref"],
    "record.outcome.outcome_ref",
    ["outcome"]
  );
  if (!outcomeRef.ok) return outcomeRef;
  const outcomeActor = v["outcome"]["actor_ref"];
  if (typeof outcomeActor !== "string") {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "record.outcome.actor_ref: ref string required");
  }
  const actorKind = outcomeActor.slice(0, outcomeActor.indexOf(":"));
  if (actorKind !== "entity" && actorKind !== "subject") {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "record.outcome.actor_ref: kind must be entity|subject");
  }
  const outcomeText = validateCanonicalText(v["outcome"]["text"], "record.outcome.text");
  if (!outcomeText.ok) return outcomeText;
  const rawOutcomeTime = v["outcome"]["logical_time"];
  if (typeof rawOutcomeTime !== "number") {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "record.outcome.logical_time: expected number");
  }
  const outcomeTime = validateLogicalTime(rawOutcomeTime, "record.outcome.logical_time");
  if (!outcomeTime.ok) return outcomeTime;
  const outcomeSourceEvent = validateIdentifier(
    v["outcome"]["source_event_id"] as string,
    "record.outcome.source_event_id"
  );
  if (!outcomeSourceEvent.ok) return outcomeSourceEvent;

  const rawDeliveredTime = v["delivered_logical_time"];
  if (typeof rawDeliveredTime !== "number") {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "record.delivered_logical_time: expected number");
  }
  const deliveredTime = validateLogicalTime(rawDeliveredTime, "record.delivered_logical_time");
  if (!deliveredTime.ok) return deliveredTime;
  const rawOutcomeLogicalTime = v["outcome_logical_time"];
  if (typeof rawOutcomeLogicalTime !== "number") {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "record.outcome_logical_time: expected number");
  }
  const outcomeLogicalTime = validateLogicalTime(rawOutcomeLogicalTime, "record.outcome_logical_time");
  if (!outcomeLogicalTime.ok) return outcomeLogicalTime;
  if (outcomeLogicalTime.value !== outcomeTime.value) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "record.outcome_logical_time must equal record.outcome.logical_time");
  }
  if (outcomeTime.value < deliveredTime.value) {
    return fail("INVALID_LOGICAL_TIME", "TIME-OCCURRENCE-001", "record: outcome occurrence precedes delivered time");
  }

  if (!isString(v["host_adapter"]) || (v["host_adapter"] as string).trim().length === 0) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "record.host_adapter: nonempty string required");
  }

  const provenance = validateRefArray(v["provenance_refs"], "record.provenance_refs", { sorted: true });
  if (!provenance.ok) return provenance;

  return ok({
    schema_version: EXPERIENCE_RECORD_SCHEMA_VERSION,
    experience_kind: EXPERIENCE_KIND_BEHAVIOR_OUTCOME,
    experience_ref: experienceRef.value,
    subject_id: subject.value,
    conversation_id: conversation.value,
    source_observation_ref: observationRef.value,
    observation_transition_id: v["observation_transition_id"] as string,
    behavior_delivery_id: deliveryId.value,
    behavior_payload_hash: behaviorHash.value,
    behavior_artifact: v["behavior_artifact"],
    cognition_lineage: lineage,
    event_ref: eventRef.value,
    outcome: {
      outcome_kind: "CONVERSATION_REPLY",
      outcome_ref: outcomeRef.value,
      actor_ref: outcomeActor as CanonicalRefV0,
      text: outcomeText.value,
      logical_time: outcomeTime.value,
      source_event_id: outcomeSourceEvent.value
    },
    delivered_logical_time: deliveredTime.value,
    outcome_logical_time: outcomeLogicalTime.value,
    host_adapter: v["host_adapter"] as string,
    provenance_refs: v["provenance_refs"] as readonly CanonicalRefV0[]
  });
}
