/**
 * BEHAVIOR_EXPERIENCE_FEEDBACK_V0 — FeedbackExperienceEncoderV0: the
 * deterministic reference mapping
 *
 *   TrustedBehaviorOutcomeFeedbackV0 → { episode, experience, event } records
 *
 * for ONE linked feedback lineage. Exactly three records per valid feedback
 * (§13: 1 experience payload + 1 ingress event payload + 1 episodic record);
 * no salience gate, no filter, no expansion.
 *
 * TRUST GATE (mandatory, runtime): `isTrustedBehaviorOutcomeFeedback(input)`
 * must be true before ANY record construction — a TypeScript annotation is not
 * a trust capability. PURE TRANSFORMATION: permitted inputs are ONLY the
 * trusted feedback plus the narrow deterministic encoding context. Forbidden
 * dependencies: repositories, SubjectCore, wall clock, randomness, LLM.
 *
 * All three records carry facts only: the exact reply text, the verified
 * delivered behavior (FULL artifact + payload hash) and causal lineage. No
 * approval/reward/sentiment/trust/success surface exists in the closed schemas.
 */

import type { CanonicalRefV0, LogicalTimeV0 } from "@characteros-next/subject-core";
import { hashEnvelope, isString } from "@characteros-next/subject-core";
import {
  EPISODIC_MEMORY_RECORD_SCHEMA_VERSION,
  SALIENCE_SOURCE_ENCODING_DECLARED,
  validateEpisodicMemoryRecord,
  validateExperienceRecord,
  validateConversationIngressEventRecord,
  type ConversationIngressEventRecordV0,
  type EpisodicMemoryRecordV0,
  type ExperienceRecordV0
} from "@characteros-next/memory";
import { isTrustedBehaviorOutcomeFeedback } from "./behavior-outcome-feedback-source-authority.js";
import { deriveBehaviorOutcomeFeedbackTransitionId } from "../conversation/conversation-feedback-identity.js";

/** Frozen episode-ref composition (existing projection, reused verbatim). */
const EPISODE_REF_PROJECTION = "characteros-next/memory/episode-ref/v1" as const;

/** Stable host scene label for feedback episodes (§14; never model-produced). */
export const CONVERSATION_FEEDBACK_SCENE_V0 = "conversation-feedback-v0" as const;

/** Narrow deterministic encoding context (closed shape). */
export interface FeedbackEncodingContextV0 {
  /** Canonical logical time at encoding read — becomes recorded_at_logical_time. */
  readonly current_logical_time: LogicalTimeV0;
  /** State revision basis of the feedback identity derivations. */
  readonly expected_state_revision: number;
  /** Rebuild ordinal of the attempt (0 first attempt; +1 per A13 rebuild). */
  readonly rebuild_ordinal: number;
  /** Opaque prepare-identity component for the frozen episode-ref composition. */
  readonly intent_id: string;
}

function sortedUniqueUnion(groups: ReadonlyArray<readonly string[]>): CanonicalRefV0[] {
  const unique = new Set<string>();
  for (const group of groups) {
    for (const ref of group) unique.add(ref);
  }
  return [...unique].sort() as CanonicalRefV0[];
}

async function hex64(projection: string, value: unknown): Promise<string> {
  const digest = await hashEnvelope(projection, value);
  return digest.replace(/^sha256:/, "");
}

function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  if (Object.isFrozen(value)) return;
  Object.freeze(value);
  for (const key of Object.keys(value as Record<string, unknown>)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
}

export interface FeedbackEncodedRecordsV0 {
  readonly episode: EpisodicMemoryRecordV0;
  readonly experience: ExperienceRecordV0;
  readonly event: ConversationIngressEventRecordV0;
}

/**
 * Deterministic encoder. One trusted feedback ⇒ exactly the three immutable,
 * deep-frozen records, each passing its canonical validator. Fails closed on
 * untrusted input or any produced-record schema violation (never repairs).
 */
export class FeedbackExperienceEncoderV0 {
  async encode(
    input: unknown,
    context: FeedbackEncodingContextV0
  ): Promise<FeedbackEncodedRecordsV0> {
    // ---- MANDATORY trust gate (runtime, not a type annotation) -----------------
    if (!isTrustedBehaviorOutcomeFeedback(input)) {
      throw new Error(
        "feedback encoder: input did not pass durable source-authority validation (trust gate)"
      );
    }
    const t = input;

    // ---- Closed-shape encoding-context admission --------------------------------
    if (context === null || typeof context !== "object") {
      throw new Error("feedback encoder: encoding context required");
    }
    if (typeof context.current_logical_time !== "number" || !Number.isSafeInteger(context.current_logical_time)) {
      throw new Error("feedback encoder: context.current_logical_time must be a safe integer");
    }
    if (
      typeof context.expected_state_revision !== "number" ||
      !Number.isSafeInteger(context.expected_state_revision) ||
      context.expected_state_revision < 0
    ) {
      throw new Error("feedback encoder: context.expected_state_revision must be a non-negative safe integer");
    }
    if (typeof context.rebuild_ordinal !== "number" || !Number.isSafeInteger(context.rebuild_ordinal) || context.rebuild_ordinal < 0) {
      throw new Error("feedback encoder: context.rebuild_ordinal must be a non-negative safe integer");
    }
    if (!isString(context.intent_id) || context.intent_id.length === 0) {
      throw new Error("feedback encoder: context.intent_id must be a non-empty deterministic identifier");
    }

    // ---- Identities ---------------------------------------------------------------
    // The episode provenance transition id MUST equal the canonical proposal
    // identity: the SAME frozen feedback derivation (single implementation),
    // exactly like the Learning executor/encoder pairing.
    const transitionId = await deriveBehaviorOutcomeFeedbackTransitionId({
      subject_id: t.subject_id,
      source_event_id: t.source_event_id,
      expected_state_revision: context.expected_state_revision,
      rebuild_ordinal: context.rebuild_ordinal
    });

    const episodeRef = `episode:${await hex64(EPISODE_REF_PROJECTION, {
      subject_id: t.subject_id,
      source_transition_id: t.observation_transition_id,
      intent_id: context.intent_id
    })}`;

    // ---- 1. ingress event record (verbatim from the verified ledger store) -------
    const eventRecord: ConversationIngressEventRecordV0 = { ...t.ingress_event };

    // ---- 2. experience record ------------------------------------------------------
    const causeRefs = sortedUniqueUnion([
      [t.observation_ref, t.ingress_event.event_ref, t.outcome.outcome_ref, t.ingress_event.actor_ref]
    ]);
    const experienceRecord: ExperienceRecordV0 = {
      schema_version: "experience-record-v0",
      experience_kind: "BEHAVIOR_OUTCOME",
      experience_ref: t.experience_ref as never,
      subject_id: t.subject_id,
      conversation_id: t.conversation_id,
      source_observation_ref: t.observation_ref,
      observation_transition_id: t.observation_transition_id,
      behavior_delivery_id: t.delivery.delivery_id,
      behavior_payload_hash: t.behavior_payload_hash,
      behavior_artifact: t.delivery.behavior,
      cognition_lineage:
        t.delivery.cognition_projection_hash !== null &&
        t.delivery.conversation_cognition_proposal_hash !== null &&
        t.delivery.realization_input_hash !== null
          ? {
              cognition_projection_hash: t.delivery.cognition_projection_hash,
              conversation_cognition_proposal_hash: t.delivery.conversation_cognition_proposal_hash,
              realization_input_hash: t.delivery.realization_input_hash
            }
          : null,
      event_ref: t.ingress_event.event_ref,
      outcome: t.outcome,
      delivered_logical_time: t.delivery.delivered_logical_time,
      outcome_logical_time: t.outcome.logical_time,
      host_adapter: t.host_adapter,
      provenance_refs: causeRefs
    };
    const experienceChecked = validateExperienceRecord(experienceRecord);
    if (!experienceChecked.ok) {
      throw new Error(`feedback encoder: produced experience record violates schema (${experienceChecked.error.detail})`);
    }

    // ---- 3. episodic memory record (the existing canonical record type) ------------
    const episodeCauseRefs = sortedUniqueUnion([
      [t.observation_ref, t.ingress_event.event_ref, t.experience_ref, t.outcome.outcome_ref]
    ]);
    const references = sortedUniqueUnion([
      [t.experience_ref, t.ingress_event.event_ref, t.outcome.outcome_ref, t.observation_ref, t.ingress_event.actor_ref]
    ]);
    const episodeRecord: EpisodicMemoryRecordV0 = {
      schema_version: EPISODIC_MEMORY_RECORD_SCHEMA_VERSION,
      episode_ref: episodeRef as never,
      occurrence_logical_time: t.outcome.logical_time,
      recorded_at_logical_time: context.current_logical_time as LogicalTimeV0,
      provenance: {
        transition_id: transitionId as never,
        producer: "memory",
        cause_refs: episodeCauseRefs
      },
      references,
      context: {
        scene: CONVERSATION_FEEDBACK_SCENE_V0,
        focus_refs: [t.ingress_event.actor_ref],
        environment_refs: []
      },
      appraisal_ref: null,
      affect_snapshot_ref: null,
      salience: {
        declared_score: t.declared_salience as never,
        source: SALIENCE_SOURCE_ENCODING_DECLARED
      }
    };
    const episodeChecked = validateEpisodicMemoryRecord(episodeRecord);
    if (!episodeChecked.ok) {
      throw new Error(`feedback encoder: produced episode record violates memory schema (${episodeChecked.error.detail})`);
    }
    const eventChecked = validateConversationIngressEventRecord(eventRecord);
    if (!eventChecked.ok) {
      throw new Error(`feedback encoder: produced event record violates schema (${eventChecked.error.detail})`);
    }

    const encoded: FeedbackEncodedRecordsV0 = {
      episode: episodeRecord,
      experience: experienceChecked.value,
      event: eventChecked.value
    };
    deepFreeze(encoded);
    return encoded;
  }
}
