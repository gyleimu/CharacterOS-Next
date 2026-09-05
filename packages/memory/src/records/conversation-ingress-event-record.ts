/**
 * BEHAVIOR_EXPERIENCE_FEEDBACK_V0 — ConversationIngressEventRecordV0 (pure).
 *
 * The durable factual conversation ingress record bound into a memory
 * repository revision (`event:<hex>` record). It preserves EXACT accepted NFC
 * user/actor text — never trimmed, translated or summarized — plus the minimum
 * causal facts needed by the Behavior → Experience → Memory feedback loop:
 * subject, conversation, actor, logical time, stable source event identity and
 * the optional explicit reply parent (a delivered-behavior delivery id).
 *
 * FACTS ONLY: no sentiment, no approval/rejection label, no reward, no trust,
 * no success semantics, no model interpretation of any kind. The record is
 * inert content addressed by refs, exactly like EpisodicMemoryRecordV0.
 */

import type { CanonicalRefV0, IdentifierV0, LogicalTimeV0 } from "@characteros-next/subject-core";
import {
  isRecord,
  isString,
  validateCanonicalText,
  validateIdentifier,
  validateLogicalTime
} from "@characteros-next/subject-core";
import { fail, ok, type ValidationResult } from "@characteros-next/subject-core";
import { parseEventRef, type EventRef } from "../refs.js";

export const CONVERSATION_INGRESS_EVENT_RECORD_SCHEMA_VERSION =
  "conversation-ingress-event-record-v0" as const;

/** Exact closed conversation ingress event record. */
export interface ConversationIngressEventRecordV0 {
  readonly schema_version: typeof CONVERSATION_INGRESS_EVENT_RECORD_SCHEMA_VERSION;
  /** Content-derived self ref (`event:<hex>`); re-derivable from bound facts. */
  readonly event_ref: EventRef;
  readonly subject_id: IdentifierV0;
  readonly conversation_id: IdentifierV0;
  /** The external actor ref (kinds `entity` | `subject`); never an LLM claim. */
  readonly actor_ref: CanonicalRefV0;
  /** Exact accepted NFC text — raw factual user text, never altered. */
  readonly text: string;
  /** Canonical logical time of the ingress occurrence. */
  readonly logical_time: LogicalTimeV0;
  /** Stable host source event identity (idempotency + replay conflict key). */
  readonly source_event_id: IdentifierV0;
  /**
   * Explicit reply parent: the delivery id of the delivered conversation
   * behavior this event replies to. null = unlinked ingress (normal
   * Observation only — never Experience).
   */
  readonly in_reply_to_delivery_id: IdentifierV0 | null;
  /** Host ingress adapter provenance label. */
  readonly host_adapter: string;
}

const RECORD_KEYS: readonly string[] = [
  "schema_version",
  "event_ref",
  "subject_id",
  "conversation_id",
  "actor_ref",
  "text",
  "logical_time",
  "source_event_id",
  "in_reply_to_delivery_id",
  "host_adapter"
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

/**
 * Closed-shape validation of one conversation ingress event record. Rejects
 * unknown keys, empty/whitespace text, non-NFC canonical text, bad ref grammar
 * and wrong ref kinds — fail closed, never repairs or coerces.
 */
export function validateConversationIngressEventRecord(
  v: unknown
): ValidationResult<ConversationIngressEventRecordV0> {
  if (!isRecord(v)) return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "record: not an object");
  const shell = closedKeys(v, RECORD_KEYS, "record");
  if (!shell.ok) return shell;

  if (v["schema_version"] !== CONVERSATION_INGRESS_EVENT_RECORD_SCHEMA_VERSION) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "record.schema_version mismatch");
  }
  const eventRef = parseEventRef(v["event_ref"], "record.event_ref");
  if (!eventRef.ok) return eventRef;

  const subject = validateIdentifier(v["subject_id"] as string, "record.subject_id");
  if (!subject.ok) return subject;
  const conversation = validateIdentifier(v["conversation_id"] as string, "record.conversation_id");
  if (!conversation.ok) return conversation;

  const actor = v["actor_ref"];
  if (typeof actor !== "string") {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "record.actor_ref: ref string required");
  }
  const kind = actor.slice(0, actor.indexOf(":"));
  if (kind !== "entity" && kind !== "subject") {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "record.actor_ref: kind must be entity|subject");
  }

  const text = validateCanonicalText(v["text"], "record.text");
  if (!text.ok) return text;

  const rawTime = v["logical_time"];
  if (typeof rawTime !== "number") {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "record.logical_time: expected number");
  }
  const time = validateLogicalTime(rawTime, "record.logical_time");
  if (!time.ok) return time;

  const sourceEventId = validateIdentifier(v["source_event_id"] as string, "record.source_event_id");
  if (!sourceEventId.ok) return sourceEventId;

  let parent: IdentifierV0 | null = null;
  if (v["in_reply_to_delivery_id"] !== null) {
    const parentChecked = validateIdentifier(
      v["in_reply_to_delivery_id"] as string,
      "record.in_reply_to_delivery_id"
    );
    if (!parentChecked.ok) return parentChecked;
    parent = parentChecked.value;
  }

  if (!isString(v["host_adapter"]) || (v["host_adapter"] as string).trim().length === 0) {
    return fail("INVALID_SCHEMA", "SS-SCHEMA-001", "record.host_adapter: nonempty string required");
  }

  return ok({
    schema_version: CONVERSATION_INGRESS_EVENT_RECORD_SCHEMA_VERSION,
    event_ref: eventRef.value,
    subject_id: subject.value,
    conversation_id: conversation.value,
    actor_ref: actor as CanonicalRefV0,
    text: text.value,
    logical_time: time.value,
    source_event_id: sourceEventId.value,
    in_reply_to_delivery_id: parent,
    host_adapter: v["host_adapter"] as string
  });
}
