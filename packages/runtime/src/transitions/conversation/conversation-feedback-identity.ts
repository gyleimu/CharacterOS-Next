/**
 * BEHAVIOR_EXPERIENCE_FEEDBACK_V0 — deterministic feedback identity derivations.
 *
 * Domain-separated hashEnvelope projections (no shared projection with any
 * frozen derivation). No randomUUID, Math.random, wall clock or process-local
 * counters. The feedback transition/intent identity is bound to the STABLE
 * source event identity (§18): the same ingress source event always derives the
 * same feedback identity on the same canonical basis, so a replay either
 * reconciles the already-completed result or fails closed (reuse conflict).
 */

import { hashEnvelope } from "@characteros-next/subject-core";
import type {
  CanonicalRefV0,
  HashV1,
  IdentifierV0,
  LogicalTimeV0
} from "@characteros-next/subject-core";

function strip(digest: string): string {
  return digest.replace(/^sha256:/, "");
}

/** Full CharacterLanguageBehaviorV0 artifact payload hash (tamper-evident). */
export const BEHAVIOR_PAYLOAD_HASH_PROJECTION =
  "characteros-next/runtime/behavior-payload-hash/v1" as const;

export async function deriveBehaviorPayloadHash(artifact: unknown): Promise<HashV1> {
  return hashEnvelope(BEHAVIOR_PAYLOAD_HASH_PROJECTION, artifact);
}

/** Delivery identity: content-addressed over subject + conversation + artifact hash. */
export const BEHAVIOR_DELIVERY_ID_PROJECTION =
  "characteros-next/runtime/behavior-delivery-id/v1" as const;

export async function deriveBehaviorDeliveryId(params: {
  readonly subject_id: string;
  readonly conversation_id: string;
  readonly behavior_payload_hash: string;
}): Promise<IdentifierV0> {
  return `dlv-${strip(await hashEnvelope(BEHAVIOR_DELIVERY_ID_PROJECTION, params))}` as IdentifierV0;
}

/** Conversation ingress event ref (`event:<hex>`). */
export const CONVERSATION_INGRESS_EVENT_REF_PROJECTION =
  "characteros-next/memory/conversation-ingress-event-ref/v1" as const;

export async function deriveConversationIngressEventRef(params: {
  readonly subject_id: string;
  readonly conversation_id: string;
  readonly actor_ref: CanonicalRefV0;
  readonly text: string;
  readonly logical_time: LogicalTimeV0;
  readonly source_event_id: IdentifierV0;
  readonly in_reply_to_delivery_id: IdentifierV0 | null;
}): Promise<CanonicalRefV0> {
  return `event:${strip(await hashEnvelope(CONVERSATION_INGRESS_EVENT_REF_PROJECTION, params))}` as CanonicalRefV0;
}

/** Conversation reply outcome ref (`outcome:<hex>`). */
export const CONVERSATION_REPLY_OUTCOME_REF_PROJECTION =
  "characteros-next/memory/conversation-reply-outcome-ref/v1" as const;

export async function deriveConversationReplyOutcomeRef(params: {
  readonly subject_id: string;
  readonly source_event_id: IdentifierV0;
  readonly actor_ref: CanonicalRefV0;
  readonly text: string;
  readonly logical_time: LogicalTimeV0;
}): Promise<CanonicalRefV0> {
  return `outcome:${strip(await hashEnvelope(CONVERSATION_REPLY_OUTCOME_REF_PROJECTION, params))}` as CanonicalRefV0;
}

/**
 * Experience ref (`experience:<hex>`): the identity of ONE linked feedback
 * lineage — subject + source event + verified delivered parent. Deliberately
 * EXCLUDES the O2 transition id: the same source event fed back through a
 * different observation is a reuse conflict, never a second experience.
 */
export const BEHAVIOR_OUTCOME_EXPERIENCE_REF_PROJECTION =
  "characteros-next/memory/behavior-outcome-experience-ref/v1" as const;

export async function deriveBehaviorOutcomeExperienceRef(params: {
  readonly subject_id: string;
  readonly source_event_id: IdentifierV0;
  readonly behavior_delivery_id: IdentifierV0;
}): Promise<CanonicalRefV0> {
  return `experience:${strip(await hashEnvelope(BEHAVIOR_OUTCOME_EXPERIENCE_REF_PROJECTION, params))}` as CanonicalRefV0;
}

/**
 * Feedback Learning transition identity (`t-learn-<hex>`): bound to the stable
 * source event + canonical basis. Same event + same basis + same fingerprint
 ⇒ ALREADY_COMMITTED replay; changed payload ⇒ TRANSITION_ID_REUSE conflict.
 */
export const BEHAVIOR_OUTCOME_FEEDBACK_TRANSITION_ID_PROJECTION =
  "characteros-next/runtime/behavior-outcome-feedback-transition-id/v1" as const;

export async function deriveBehaviorOutcomeFeedbackTransitionId(params: {
  readonly subject_id: string;
  readonly source_event_id: string;
  readonly expected_state_revision: number;
  readonly rebuild_ordinal: number;
}): Promise<string> {
  const digest = strip(await hashEnvelope(BEHAVIOR_OUTCOME_FEEDBACK_TRANSITION_ID_PROJECTION, params));
  return `t-learn-${digest}`;
}

/** Feedback prepare-intent identity (`li-<hex>`) for repository prepare idempotency. */
export const BEHAVIOR_OUTCOME_FEEDBACK_PREPARE_INTENT_PROJECTION =
  "characteros-next/memory/behavior-outcome-feedback-prepare-intent/v1" as const;

export async function deriveBehaviorOutcomeFeedbackIntentId(params: {
  readonly subject_id: string;
  readonly source_event_id: string;
  readonly expected_state_revision: number;
  readonly rebuild_ordinal: number;
}): Promise<string> {
  const digest = strip(await hashEnvelope(BEHAVIOR_OUTCOME_FEEDBACK_PREPARE_INTENT_PROJECTION, params));
  return `li-${digest}`;
}
