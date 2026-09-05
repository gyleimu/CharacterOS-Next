/**
 * BEHAVIOR_EXPERIENCE_FEEDBACK_V0 — composition-owned conversation ingress
 * ledger (§7/§18 ingress authority + replay/conflict law).
 *
 * The ONLY authority that mints ConversationIngressEventRecordV0 records. The
 * exact accepted NFC text is preserved verbatim — never trimmed, translated or
 * summarized. The event ref is derived from the full factual content, so the
 * ledger implements the §18 law directly:
 *
 *   same source event identity + same derived ref  ⇒ REPLAY (the existing
 *                                                     record, +0)
 *   same source event identity + changed text/parent/actor/subject/conversation
 *                                                  ⇒ SOURCE_EVENT_CONFLICT
 *                                                     (fail closed)
 *
 * Storage is process memory exclusively; the host persists `exportState`
 * output and restores through the same validating face as deliveries.
 */

import type { CanonicalRefV0, IdentifierV0, LogicalTimeV0 } from "@characteros-next/subject-core";
import { isRecord, isString, validateIdentifier, validateLogicalTime } from "@characteros-next/subject-core";
import {
  CONVERSATION_INGRESS_EVENT_RECORD_SCHEMA_VERSION,
  validateConversationIngressEventRecord,
  type ConversationIngressEventRecordV0
} from "@characteros-next/memory";
import { deriveConversationIngressEventRef } from "./conversation-feedback-identity.js";

export const CONVERSATION_INGRESS_INPUT_SCHEMA_VERSION = "conversation-ingress-input-v0" as const;

/** Host ingress input: raw factual user/actor turn. */
export interface ConversationIngressInputV0 {
  readonly schema_version: typeof CONVERSATION_INGRESS_INPUT_SCHEMA_VERSION;
  readonly subject_id: IdentifierV0;
  readonly conversation_id: IdentifierV0;
  /** External actor ref (kinds `entity` | `subject`). */
  readonly actor_ref: CanonicalRefV0;
  /** EXACT accepted NFC text — preserved verbatim. */
  readonly text: string;
  readonly logical_time: LogicalTimeV0;
  /** Stable host source event identity (idempotency/conflict key). */
  readonly source_event_id: IdentifierV0;
  /** Explicit reply parent delivery id, or null for unlinked ingress. */
  readonly in_reply_to_delivery_id: IdentifierV0 | null;
  /** Host ingress adapter provenance label. */
  readonly host_adapter: string;
}

export type ConversationIngressOutcome =
  | { readonly kind: "RECORDED"; readonly record: ConversationIngressEventRecordV0 }
  | { readonly kind: "REPLAY"; readonly record: ConversationIngressEventRecordV0 }
  | { readonly kind: "CONFLICT"; readonly reason: "SOURCE_EVENT_CONFLICT"; readonly detail: string }
  | { readonly kind: "REJECTED"; readonly code: "INGRESS_INPUT_INVALID"; readonly detail: string };

/**
 * Narrow composition-owned ingress ledger authority. Feedback execution reads
 * through `readIngressEvent` — caller-supplied event-looking objects are never
 * trusted (§6 law applied to ingress facts).
 */
export interface ConversationIngressLedgerAuthority {
  recordIngressEvent(input: unknown): Promise<ConversationIngressOutcome>;
  readIngressEvent(
    subjectId: string,
    sourceEventId: string
  ): Promise<ConversationIngressEventRecordV0 | null>;
  exportState(): readonly ConversationIngressEventRecordV0[];
  restoreState(state: unknown): Promise<{ ok: true } | { ok: false; detail: string }>;
}

function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  if (Object.isFrozen(value)) return;
  Object.freeze(value);
  for (const key of Object.keys(value as Record<string, unknown>)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
}

function validateIngressInput(
  input: unknown
): { ok: true; value: ConversationIngressInputV0 } | { ok: false; detail: string } {
  if (!isRecord(input)) return { ok: false, detail: "ingress input: expected object" };
  if (input["schema_version"] !== CONVERSATION_INGRESS_INPUT_SCHEMA_VERSION) {
    return { ok: false, detail: "ingress input: schema_version mismatch" };
  }
  const subject = validateIdentifier(input["subject_id"] as string, "ingress.subject_id");
  if (!subject.ok) return { ok: false, detail: subject.error.detail };
  const conversation = validateIdentifier(input["conversation_id"] as string, "ingress.conversation_id");
  if (!conversation.ok) return { ok: false, detail: conversation.error.detail };
  const actor = input["actor_ref"];
  if (typeof actor !== "string") return { ok: false, detail: "ingress.actor_ref: ref string required" };
  const actorKind = actor.slice(0, actor.indexOf(":"));
  if (actorKind !== "entity" && actorKind !== "subject") {
    return { ok: false, detail: "ingress.actor_ref: kind must be entity|subject" };
  }
  if (!isString(input["text"]) || (input["text"] as string).trim().length === 0) {
    return { ok: false, detail: "ingress.text: nonempty text required" };
  }
  const rawTime = input["logical_time"];
  if (typeof rawTime !== "number") {
    return { ok: false, detail: "ingress.logical_time: expected number" };
  }
  const time = validateLogicalTime(rawTime, "ingress.logical_time");
  if (!time.ok) return { ok: false, detail: time.error.detail };
  const sourceEventId = validateIdentifier(input["source_event_id"] as string, "ingress.source_event_id");
  if (!sourceEventId.ok) return { ok: false, detail: sourceEventId.error.detail };
  let parent: IdentifierV0 | null = null;
  if (input["in_reply_to_delivery_id"] !== null) {
    const parentChecked = validateIdentifier(
      input["in_reply_to_delivery_id"] as string,
      "ingress.in_reply_to_delivery_id"
    );
    if (!parentChecked.ok) return { ok: false, detail: parentChecked.error.detail };
    parent = parentChecked.value;
  }
  if (!isString(input["host_adapter"]) || (input["host_adapter"] as string).trim().length === 0) {
    return { ok: false, detail: "ingress.host_adapter: nonempty string required" };
  }
  return {
    ok: true,
    value: {
      schema_version: CONVERSATION_INGRESS_INPUT_SCHEMA_VERSION,
      subject_id: subject.value,
      conversation_id: conversation.value,
      actor_ref: actor as CanonicalRefV0,
      text: input["text"] as string,
      logical_time: time.value,
      source_event_id: sourceEventId.value,
      in_reply_to_delivery_id: parent,
      host_adapter: input["host_adapter"] as string
    }
  };
}

/** Composition-owned in-memory ingress ledger (the ONLY concrete implementation). */
export class InMemoryConversationIngressLedger implements ConversationIngressLedgerAuthority {
  private readonly events = new Map<string, ConversationIngressEventRecordV0>();

  async recordIngressEvent(input: unknown): Promise<ConversationIngressOutcome> {
    const shaped = validateIngressInput(input);
    if (!shaped.ok) {
      return { kind: "REJECTED", code: "INGRESS_INPUT_INVALID", detail: shaped.detail };
    }
    const v = shaped.value;
    const eventRef = await deriveConversationIngressEventRef({
      subject_id: v.subject_id,
      conversation_id: v.conversation_id,
      actor_ref: v.actor_ref,
      text: v.text,
      logical_time: v.logical_time,
      source_event_id: v.source_event_id,
      in_reply_to_delivery_id: v.in_reply_to_delivery_id
    });
    const record: ConversationIngressEventRecordV0 = {
      schema_version: CONVERSATION_INGRESS_EVENT_RECORD_SCHEMA_VERSION,
      event_ref: eventRef as never,
      subject_id: v.subject_id,
      conversation_id: v.conversation_id,
      actor_ref: v.actor_ref,
      text: v.text,
      logical_time: v.logical_time,
      source_event_id: v.source_event_id,
      in_reply_to_delivery_id: v.in_reply_to_delivery_id,
      host_adapter: v.host_adapter
    };
    deepFreeze(record);
    const checked = validateConversationIngressEventRecord(record);
    if (!checked.ok) {
      return { kind: "REJECTED", code: "INGRESS_INPUT_INVALID", detail: checked.error.detail };
    }
    const key = `${v.subject_id}\u0000${v.source_event_id}`;
    const existing = this.events.get(key);
    if (existing !== undefined) {
      if (existing.event_ref === record.event_ref) {
        return { kind: "REPLAY", record: existing };
      }
      return {
        kind: "CONFLICT",
        reason: "SOURCE_EVENT_CONFLICT",
        detail: `ingress source event ${v.source_event_id} replayed with changed factual content`
      };
    }
    this.events.set(key, record);
    return { kind: "RECORDED", record };
  }

  async readIngressEvent(
    subjectId: string,
    sourceEventId: string
  ): Promise<ConversationIngressEventRecordV0 | null> {
    return this.events.get(`${subjectId}\u0000${sourceEventId}`) ?? null;
  }

  exportState(): readonly ConversationIngressEventRecordV0[] {
    return [...this.events.values()];
  }

  async restoreState(state: unknown): Promise<{ ok: true } | { ok: false; detail: string }> {
    if (!Array.isArray(state)) return { ok: false, detail: "ingress ledger restore: expected record array" };
    for (const entry of state) {
      const checked = validateConversationIngressEventRecord(entry);
      if (!checked.ok) return { ok: false, detail: `ingress ledger restore: ${checked.error.detail}` };
      const reRef = await deriveConversationIngressEventRef({
        subject_id: checked.value.subject_id,
        conversation_id: checked.value.conversation_id,
        actor_ref: checked.value.actor_ref,
        text: checked.value.text,
        logical_time: checked.value.logical_time,
        source_event_id: checked.value.source_event_id,
        in_reply_to_delivery_id: checked.value.in_reply_to_delivery_id
      });
      if (reRef !== checked.value.event_ref) {
        return { ok: false, detail: "ingress ledger restore: event_ref does not re-derive (tamper evidence)" };
      }
      const key = `${checked.value.subject_id}\u0000${checked.value.source_event_id}`;
      const existing = this.events.get(key);
      if (existing !== undefined && existing.event_ref !== checked.value.event_ref) {
        return { ok: false, detail: "ingress ledger restore: source event conflict in exported state" };
      }
      this.events.set(key, checked.value);
    }
    return { ok: true };
  }
}

/** Composition factory: the host never constructs ledger contents directly. */
export function createConversationIngressLedgerAuthorityV0(): ConversationIngressLedgerAuthority {
  return new InMemoryConversationIngressLedger();
}
