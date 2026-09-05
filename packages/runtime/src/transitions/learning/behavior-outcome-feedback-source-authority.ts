/**
 * BEHAVIOR_EXPERIENCE_FEEDBACK_V0 — feedback source authority: durable semantic
 * verification that a BehaviorOutcomeFeedbackCandidateV0 corresponds to a REAL
 * linked feedback lineage:
 *
 *   composition-owned ingress event (exact factual reply text)
 *   → explicit verified DELIVERED behavior parent (composition-owned ledger)
 *   → committed source Observation (O2) with the claimed observation ref
 *   → temporal law (reply occurrence >= delivered time)
 *
 * §6 DELIVERY AUTHORITY LAW: the candidate carries NO delivery record, NO
 * reply text and NO outcome — all of it is read here from the composition-owned
 * ledgers. A caller cannot fabricate `{ status: "DELIVERED" }` and thereby
 * create lived history.
 *
 * TRUST MODEL: identical to learning-source-authority — trust is IDENTITY-bound
 * membership in a module-private WeakSet granted ONLY by
 * `validateTrustedBehaviorOutcomeFeedback`; it disappears across serialization,
 * cloning and restart; after restart the host re-supplies the candidate and
 * durable validation reruns. Least privilege: this boundary receives ONLY the
 * three read faces — never a MemoryPreparationAuthority, never SubjectCore
 * write surfaces. Zero memory writes, zero canonical mutation (pure read +
 * verdict).
 */

import type { CanonicalRefV0, HashV1 } from "@characteros-next/subject-core";
import { fail, ok, type ValidationResult } from "@characteros-next/subject-core";
import type { ConversationReplyOutcomeV0, ConversationIngressEventRecordV0 } from "@characteros-next/memory";
import type { RuntimeContext } from "../../types/runtime-context.js";
import type {
  BehaviorDeliveryRecordV0,
  ConversationDeliveryLedgerAuthority
} from "../conversation/behavior-delivery-ledger.js";
import type { ConversationIngressLedgerAuthority } from "../conversation/conversation-ingress-ledger.js";
import type { LearningSourceReadAuthority } from "./learning-source-authority.js";
import {
  validateBehaviorOutcomeFeedbackCandidate,
  type BehaviorOutcomeFeedbackCandidateV0
} from "./behavior-outcome-feedback-candidate.js";
import {
  deriveBehaviorOutcomeExperienceRef,
  deriveBehaviorPayloadHash,
  deriveConversationReplyOutcomeRef
} from "../conversation/conversation-feedback-identity.js";

/** The three narrow read faces this boundary needs (nothing more). */
export interface BehaviorOutcomeFeedbackReadAuthority {
  readonly deliveryLedger: ConversationDeliveryLedgerAuthority;
  readonly ingressLedger: ConversationIngressLedgerAuthority;
  /** The existing committed-transition read face (O2 bundle verification). */
  readonly committedTransitions: LearningSourceReadAuthority;
}

/** The validated/trusted representation the feedback encoder consumes. */
export interface TrustedBehaviorOutcomeFeedbackV0 {
  readonly subject_id: BehaviorOutcomeFeedbackCandidateV0["subject_id"];
  readonly conversation_id: BehaviorOutcomeFeedbackCandidateV0["conversation_id"];
  readonly source_event_id: BehaviorOutcomeFeedbackCandidateV0["source_event_id"];
  /** The verified ingress event record (composition-owned store truth). */
  readonly ingress_event: ConversationIngressEventRecordV0;
  /** The verified DELIVERED parent (composition-owned store truth). */
  readonly delivery: BehaviorDeliveryRecordV0;
  /** Behavior payload hash recomputed here from the ledger-owned artifact. */
  readonly behavior_payload_hash: HashV1;
  readonly observation_ref: BehaviorOutcomeFeedbackCandidateV0["observation_ref"];
  readonly observation_transition_id: BehaviorOutcomeFeedbackCandidateV0["observation_transition_id"];
  /** The nested factual outcome, derived here from ledger-owned facts only. */
  readonly outcome: ConversationReplyOutcomeV0;
  readonly experience_ref: CanonicalRefV0;
  readonly declared_salience: BehaviorOutcomeFeedbackCandidateV0["declared_salience"];
  readonly host_adapter: BehaviorOutcomeFeedbackCandidateV0["host_adapter"];
}

/** Module-private identity registry (see learning-source-authority.ts rationale). */
const trustedFeedbackRegistry = new WeakSet<object>();

/** Runtime trust verdict for the feedback encoder (mandatory runtime gate). */
export function isTrustedBehaviorOutcomeFeedback(value: unknown): value is TrustedBehaviorOutcomeFeedbackV0 {
  return value !== null && typeof value === "object" && trustedFeedbackRegistry.has(value);
}

function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  if (Object.isFrozen(value)) return;
  Object.freeze(value);
  for (const key of Object.keys(value as Record<string, unknown>)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
}

/**
 * Validates an UNKNOWN candidate and verifies the full feedback lineage against
 * composition-owned ledgers and the committed O2 bundle. Fail closed at every
 * step; no memory write and no canonical mutation on any path.
 */
export async function validateTrustedBehaviorOutcomeFeedback(
  authority: BehaviorOutcomeFeedbackReadAuthority,
  context: RuntimeContext,
  candidate: unknown
): Promise<ValidationResult<TrustedBehaviorOutcomeFeedbackV0>> {
  // ---- Step 1: closed-shape admission ------------------------------------------
  const shaped = validateBehaviorOutcomeFeedbackCandidate(candidate);
  if (!shaped.ok) return shaped;
  const c = shaped.value;

  // ---- Step 2: runtime subject binding ------------------------------------------
  if (c.subject_id !== context.subject_id) {
    return fail(
      "UNKNOWN_SUBJECT",
      "SS-AUTH-001",
      `feedback candidate subject ${c.subject_id} does not match runtime subject ${context.subject_id}`
    );
  }

  // ---- Step 3: the ingress event lives ONLY in the composition-owned ledger ----
  const ingress = await authority.ingressLedger.readIngressEvent(c.subject_id, c.source_event_id);
  if (ingress === null) {
    return fail(
      "INVALID_STAGE_DEPENDENCY",
      "MICL-STAGE-001",
      `feedback source event ${c.source_event_id}: no recorded ingress event (unknown or unrecorded)`
    );
  }
  if (ingress.subject_id !== c.subject_id) {
    return fail("UNKNOWN_SUBJECT", "SS-AUTH-001", "feedback ingress event belongs to a different subject");
  }
  if (ingress.conversation_id !== c.conversation_id) {
    return fail(
      "UNSUPPORTED_EVIDENCE_REF",
      "LLM-EVID-001",
      "feedback ingress event belongs to a different conversation"
    );
  }

  // ---- Step 4: explicit reply parent is REQUIRED for Experience (§8) ------------
  if (ingress.in_reply_to_delivery_id === null) {
    return fail(
      "INVALID_STAGE_DEPENDENCY",
      "MICL-STAGE-001",
      "feedback ingress event has no explicit reply parent: unlinked ingress is Observation-only, never Experience"
    );
  }

  // ---- Step 5: the parent must be a VERIFIED DELIVERED behavior (§5/§6/§23) -----
  const delivery = await authority.deliveryLedger.readDelivery(ingress.in_reply_to_delivery_id);
  if (delivery === null) {
    return fail(
      "INVALID_STAGE_DEPENDENCY",
      "MICL-STAGE-001",
      `feedback parent delivery ${ingress.in_reply_to_delivery_id}: no stored delivery record (caller-fabricated receipts are not authority)`
    );
  }
  if (delivery.status !== "DELIVERED") {
    return fail(
      "UNSUPPORTED_EVIDENCE_REF",
      "LLM-EVID-001",
      `feedback parent delivery ${delivery.delivery_id} is ${delivery.status}: a failed delivery cannot become the parent of a reply outcome`
    );
  }
  if (delivery.subject_id !== c.subject_id) {
    return fail("UNKNOWN_SUBJECT", "SS-AUTH-001", "feedback parent delivery belongs to a different subject");
  }
  if (delivery.conversation_id !== c.conversation_id) {
    return fail(
      "UNSUPPORTED_EVIDENCE_REF",
      "LLM-EVID-001",
      "feedback parent delivery belongs to a different conversation"
    );
  }

  // ---- Step 6: the source Observation must be a genuinely committed O2 ----------
  const bundle = await authority.committedTransitions.readCommittedBundle(c.observation_transition_id);
  if (bundle === null) {
    return fail(
      "INVALID_STAGE_DEPENDENCY",
      "MICL-STAGE-001",
      `feedback source ${c.observation_transition_id}: no committed bundle (unknown, reserved-only, rejected or uncommitted)`
    );
  }
  if (bundle.subject_id !== c.subject_id) {
    return fail("UNKNOWN_SUBJECT", "SS-AUTH-001", "feedback source bundle belongs to a different subject");
  }
  if (bundle.transition_type !== "Observation") {
    return fail(
      "INVALID_STAGE_DEPENDENCY",
      "MICL-STAGE-001",
      `feedback source must be a committed Observation, got ${bundle.transition_type}`
    );
  }
  if (!bundle.trace_entry.cause_refs.includes(c.observation_ref)) {
    return fail(
      "UNSUPPORTED_EVIDENCE_REF",
      "LLM-EVID-001",
      `feedback candidate observation_ref ${c.observation_ref} is not a cause ref of the source Observation`
    );
  }

  // ---- Step 7: temporal law (§19): reply occurrence >= delivered time -----------
  if (ingress.logical_time < delivery.delivered_logical_time) {
    return fail(
      "INVALID_LOGICAL_TIME",
      "TIME-OCCURRENCE-001",
      `feedback ingress at ${ingress.logical_time} precedes the delivered parent at ${delivery.delivered_logical_time}`
    );
  }

  // ---- Step 8: tamper evidence over the delivered behavior artifact -------------
  const artifactChecked = await deriveBehaviorPayloadHash(delivery.behavior);
  if (artifactChecked !== delivery.behavior_payload_hash) {
    return fail(
      "UNSUPPORTED_EVIDENCE_REF",
      "LLM-EVID-001",
      "feedback parent delivery behavior payload hash does not recompute (tampered artifact)"
    );
  }

  // ---- Trusted output: ledger-owned facts only, freshly built, deep-frozen ------
  const outcome: ConversationReplyOutcomeV0 = {
    outcome_kind: "CONVERSATION_REPLY",
    outcome_ref: (await deriveConversationReplyOutcomeRef({
      subject_id: c.subject_id,
      source_event_id: ingress.source_event_id,
      actor_ref: ingress.actor_ref,
      text: ingress.text,
      logical_time: ingress.logical_time
    })) as CanonicalRefV0,
    actor_ref: ingress.actor_ref,
    text: ingress.text,
    logical_time: ingress.logical_time,
    source_event_id: ingress.source_event_id
  };
  const experienceRef = await deriveBehaviorOutcomeExperienceRef({
    subject_id: c.subject_id,
    source_event_id: c.source_event_id,
    behavior_delivery_id: delivery.delivery_id
  });
  const trusted: TrustedBehaviorOutcomeFeedbackV0 = {
    subject_id: c.subject_id,
    conversation_id: c.conversation_id,
    source_event_id: c.source_event_id,
    ingress_event: ingress,
    delivery,
    behavior_payload_hash: artifactChecked,
    observation_ref: c.observation_ref,
    observation_transition_id: c.observation_transition_id,
    outcome,
    experience_ref: experienceRef,
    declared_salience: c.declared_salience,
    host_adapter: c.host_adapter
  };
  deepFreeze(trusted);
  trustedFeedbackRegistry.add(trusted);
  return ok(trusted);
}
