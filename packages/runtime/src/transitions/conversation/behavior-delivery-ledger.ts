/**
 * BEHAVIOR_EXPERIENCE_FEEDBACK_V0 — composition-owned conversation delivery
 * ledger (§5/§6 delivery authority law).
 *
 * The ONLY authority that mints BehaviorDeliveryRecordV0 receipts for the
 * conversation vertical. Feedback execution NEVER trusts caller-supplied
 * receipt-looking objects: it re-reads the stored record through
 * `readDelivery` and verifies its contents (§6). The ledger computes the
 * behavior payload hash itself from the artifact (a caller-declared hash is
 * never stored), derives the delivery id deterministically, and deep-freezes
 * every record. Storage is process memory exclusively (V0 host-owned store;
 * the host persists `exportState` output to survive restart).
 *
 * Idempotency: the same subject + conversation + byte-identical behavior
 * artifact derives the SAME delivery id — recordDelivery returns the existing
 * record (+0). A regenerated (different) artifact is a different delivery.
 */

import type { CanonicalRefV0, HashV1, IdentifierV0, LogicalTimeV0, TransitionIdV0 } from "@characteros-next/subject-core";
import { isRecord, isString, validateIdentifier, validateLogicalTime } from "@characteros-next/subject-core";
import type { CharacterLanguageBehaviorV0 } from "@characteros-next/behavior";
import { validateCharacterLanguageBehaviorV0 } from "@characteros-next/behavior";
import {
  deriveBehaviorDeliveryId,
  deriveBehaviorPayloadHash
} from "./conversation-feedback-identity.js";

export const BEHAVIOR_DELIVERY_RECORD_SCHEMA_VERSION = "behavior-delivery-record-v0" as const;
export const BEHAVIOR_DELIVERY_STATUS_DELIVERED = "DELIVERED" as const;
export const BEHAVIOR_DELIVERY_STATUS_FAILED = "FAILED" as const;

export type BehaviorDeliveryStatusV0 = "DELIVERED" | "FAILED";

/** Exact closed conversation delivery record (§5 minimum facts). */
export interface BehaviorDeliveryRecordV0 {
  readonly schema_version: typeof BEHAVIOR_DELIVERY_RECORD_SCHEMA_VERSION;
  /** Deterministic delivery identity (`dlv-<hex>`). */
  readonly delivery_id: IdentifierV0;
  readonly subject_id: IdentifierV0;
  readonly conversation_id: IdentifierV0;
  /** The COMPLETE host-generated behavior artifact (closed shape). */
  readonly behavior: CharacterLanguageBehaviorV0;
  /** Payload hash over the full artifact (ledger-computed, never caller-supplied). */
  readonly behavior_payload_hash: HashV1;
  /** Cognition/projection lineage when available (from the conversation V1 trace). */
  readonly cognition_projection_hash: string | null;
  readonly conversation_cognition_proposal_hash: string | null;
  readonly realization_input_hash: string | null;
  /** Source observation ref of the generating turn when available. */
  readonly source_observation_ref: CanonicalRefV0 | null;
  readonly source_transition_id: TransitionIdV0 | null;
  /** Canonical logical time of the delivery acknowledgment. */
  readonly delivered_logical_time: LogicalTimeV0;
  readonly status: BehaviorDeliveryStatusV0;
  /** Host adapter provenance label. */
  readonly host_adapter: string;
}

/** Host delivery input: facts only — the hash/status authority stays here. */
export interface ConversationDeliveryInputV0 {
  readonly subject_id: IdentifierV0;
  readonly conversation_id: IdentifierV0;
  /** The generated behavior artifact (tamper-evidently validated + hashed here). */
  readonly behavior: CharacterLanguageBehaviorV0;
  readonly delivered_logical_time: LogicalTimeV0;
  readonly status: BehaviorDeliveryStatusV0;
  readonly host_adapter: string;
  readonly cognition_projection_hash?: string | null;
  readonly conversation_cognition_proposal_hash?: string | null;
  readonly realization_input_hash?: string | null;
  readonly source_observation_ref?: CanonicalRefV0 | null;
  readonly source_transition_id?: TransitionIdV0 | null;
}

/**
 * Narrow composition-owned delivery ledger authority. The record face mints;
 * the read face is what feedback execution trusts (§6: re-read, never accept).
 */
export interface ConversationDeliveryLedgerAuthority {
  recordConversationDelivery(input: unknown): Promise<
    { ok: true; record: BehaviorDeliveryRecordV0 } | { ok: false; code: DeliveryLedgerFailureCode; detail: string }
  >;
  readDelivery(deliveryId: string): Promise<BehaviorDeliveryRecordV0 | null>;
  /** Host-owned persistence surface (V0): frozen export for restart survival. */
  exportState(): readonly BehaviorDeliveryRecordV0[];
  /** Restore face: admits ONLY well-formed exported records (fail closed). */
  restoreState(state: unknown): Promise<{ ok: true } | { ok: false; detail: string }>;
}

export type DeliveryLedgerFailureCode =
  | "DELIVERY_INPUT_INVALID"
  | "DELIVERY_BEHAVIOR_INVALID";

function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  if (Object.isFrozen(value)) return;
  Object.freeze(value);
  for (const key of Object.keys(value as Record<string, unknown>)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
}

function optionalHash(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

/** Normalized delivery input: optional members collapse to explicit nulls. */
interface NormalizedDeliveryInputV0 {
  readonly subject_id: IdentifierV0;
  readonly conversation_id: IdentifierV0;
  readonly delivered_logical_time: LogicalTimeV0;
  readonly status: BehaviorDeliveryStatusV0;
  readonly host_adapter: string;
  readonly behavior: unknown;
  readonly cognition_projection_hash: string | null;
  readonly conversation_cognition_proposal_hash: string | null;
  readonly realization_input_hash: string | null;
  readonly source_observation_ref: CanonicalRefV0 | null;
  readonly source_transition_id: TransitionIdV0 | null;
}

function validateInputShape(input: unknown):
  | { ok: true; value: NormalizedDeliveryInputV0 }
  | { ok: false; code: DeliveryLedgerFailureCode; detail: string } {
  if (!isRecord(input)) return { ok: false, code: "DELIVERY_INPUT_INVALID", detail: "delivery input: expected object" };
  const subject = validateIdentifier(input["subject_id"] as string, "delivery.subject_id");
  if (!subject.ok) return { ok: false, code: "DELIVERY_INPUT_INVALID", detail: subject.error.detail };
  const conversation = validateIdentifier(input["conversation_id"] as string, "delivery.conversation_id");
  if (!conversation.ok) return { ok: false, code: "DELIVERY_INPUT_INVALID", detail: conversation.error.detail };
  const rawTime = input["delivered_logical_time"];
  if (typeof rawTime !== "number") {
    return { ok: false, code: "DELIVERY_INPUT_INVALID", detail: "delivery.delivered_logical_time: expected number" };
  }
  const time = validateLogicalTime(rawTime, "delivery.delivered_logical_time");
  if (!time.ok) return { ok: false, code: "DELIVERY_INPUT_INVALID", detail: time.error.detail };
  if (input["status"] !== BEHAVIOR_DELIVERY_STATUS_DELIVERED && input["status"] !== BEHAVIOR_DELIVERY_STATUS_FAILED) {
    return { ok: false, code: "DELIVERY_INPUT_INVALID", detail: "delivery.status: DELIVERED|FAILED required" };
  }
  if (!isString(input["host_adapter"]) || (input["host_adapter"] as string).trim().length === 0) {
    return { ok: false, code: "DELIVERY_INPUT_INVALID", detail: "delivery.host_adapter: nonempty string required" };
  }
  return {
    ok: true,
    value: {
      subject_id: subject.value,
      conversation_id: conversation.value,
      delivered_logical_time: time.value,
      status: input["status"] as BehaviorDeliveryStatusV0,
      host_adapter: input["host_adapter"] as string,
      behavior: input["behavior"] as CharacterLanguageBehaviorV0,
      cognition_projection_hash: optionalHash(input["cognition_projection_hash"]),
      conversation_cognition_proposal_hash: optionalHash(input["conversation_cognition_proposal_hash"]),
      realization_input_hash: optionalHash(input["realization_input_hash"]),
      source_observation_ref:
        typeof input["source_observation_ref"] === "string" ? (input["source_observation_ref"] as CanonicalRefV0) : null,
      source_transition_id:
        typeof input["source_transition_id"] === "string" ? (input["source_transition_id"] as TransitionIdV0) : null
    }
  };
}

/** Composition-owned in-memory delivery ledger (the ONLY concrete implementation). */
export class InMemoryConversationDeliveryLedger implements ConversationDeliveryLedgerAuthority {
  private readonly deliveries = new Map<string, BehaviorDeliveryRecordV0>();

  async recordConversationDelivery(
    input: unknown
  ): Promise<{ ok: true; record: BehaviorDeliveryRecordV0 } | { ok: false; code: DeliveryLedgerFailureCode; detail: string }> {
    const shaped = validateInputShape(input);
    if (!shaped.ok) return shaped;
    const artifactChecked = await validateCharacterLanguageBehaviorV0(shaped.value.behavior);
    if (!artifactChecked.ok) {
      return { ok: false, code: "DELIVERY_BEHAVIOR_INVALID", detail: artifactChecked.detail };
    }
    const behavior = artifactChecked.behavior;
    const behaviorPayloadHash = await deriveBehaviorPayloadHash(behavior);
    const deliveryId = await deriveBehaviorDeliveryId({
      subject_id: shaped.value.subject_id,
      conversation_id: shaped.value.conversation_id,
      behavior_payload_hash: behaviorPayloadHash
    });
    const existing = this.deliveries.get(deliveryId);
    if (existing !== undefined) return { ok: true, record: existing };
    const record: BehaviorDeliveryRecordV0 = {
      schema_version: BEHAVIOR_DELIVERY_RECORD_SCHEMA_VERSION,
      delivery_id: deliveryId,
      subject_id: shaped.value.subject_id,
      conversation_id: shaped.value.conversation_id,
      behavior,
      behavior_payload_hash: behaviorPayloadHash,
      cognition_projection_hash: shaped.value.cognition_projection_hash,
      conversation_cognition_proposal_hash: shaped.value.conversation_cognition_proposal_hash,
      realization_input_hash: shaped.value.realization_input_hash,
      source_observation_ref: shaped.value.source_observation_ref,
      source_transition_id: shaped.value.source_transition_id,
      delivered_logical_time: shaped.value.delivered_logical_time,
      status: shaped.value.status,
      host_adapter: shaped.value.host_adapter
    };
    deepFreeze(record);
    this.deliveries.set(deliveryId, record);
    return { ok: true, record };
  }

  async readDelivery(deliveryId: string): Promise<BehaviorDeliveryRecordV0 | null> {
    return this.deliveries.get(deliveryId) ?? null;
  }

  exportState(): readonly BehaviorDeliveryRecordV0[] {
    return [...this.deliveries.values()];
  }

  async restoreState(state: unknown): Promise<{ ok: true } | { ok: false; detail: string }> {
    if (!Array.isArray(state)) return { ok: false, detail: "delivery ledger restore: expected record array" };
    for (const entry of state) {
      // Re-admit ONLY through the same validation face: shape + artifact tamper
      // evidence + id/hash re-derivation. A forged exported record fails closed.
      if (!isRecord(entry)) return { ok: false, detail: "delivery ledger restore: record expected" };
      const reRecorded = await this.recordConversationDelivery({
        subject_id: entry["subject_id"],
        conversation_id: entry["conversation_id"],
        behavior: entry["behavior"],
        delivered_logical_time: entry["delivered_logical_time"],
        status: entry["status"],
        host_adapter: entry["host_adapter"],
        cognition_projection_hash: entry["cognition_projection_hash"],
        conversation_cognition_proposal_hash: entry["conversation_cognition_proposal_hash"],
        realization_input_hash: entry["realization_input_hash"],
        source_observation_ref: entry["source_observation_ref"],
        source_transition_id: entry["source_transition_id"]
      });
      if (!reRecorded.ok) return { ok: false, detail: `delivery ledger restore: ${reRecorded.detail}` };
      if (reRecorded.record.delivery_id !== entry["delivery_id"]) {
        return { ok: false, detail: "delivery ledger restore: delivery_id does not re-derive (tamper evidence)" };
      }
    }
    return { ok: true };
  }
}

/** Composition factory: the host never constructs ledger contents directly. */
export function createConversationDeliveryLedgerAuthorityV0(): ConversationDeliveryLedgerAuthority {
  return new InMemoryConversationDeliveryLedger();
}
