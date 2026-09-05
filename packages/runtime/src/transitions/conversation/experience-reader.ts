/**
 * BEHAVIOR_EXPERIENCE_FEEDBACK_V0 — ExperienceReaderV0: the minimum
 * authoritative reader that recovers factual Experience content (§26).
 *
 * Entry is the feedback EPISODE (the retrievable Memory record). The reader
 * verifies, fail-closed:
 *   1. bound revision membership (episode + experience + event all belong)
 *   2. every payload hash against the repository-owned payloads
 *   3. the Experience self-ref re-derivation (subject + source event + delivery)
 *   4. the nested factual outcome and the ingress event (exact-text consistency)
 *   5. the delivery linkage: a stored DELIVERED receipt whose artifact hash
 *      recomputes from BOTH the ledger copy and the experience-bound copy
 *
 * It returns factual material only — it never generates interpretation, never
 * scores, never classifies. Any tampering (field edit, ref swap, artifact
 * mutation, cross-revision splice) fails closed.
 */

import type { CanonicalRefV0 } from "@characteros-next/subject-core";
import { isRecord, refKind, validateIdentifier } from "@characteros-next/subject-core";
import type { InMemoryMemoryRepository } from "@characteros-next/memory";
import {
  computeMemoryRecordPayloadHash,
  validateConversationIngressEventRecord,
  validateEpisodicMemoryRecord,
  validateExperienceRecord,
  type ConversationIngressEventRecordV0,
  type EpisodicMemoryRecordV0,
  type ExperienceRecordV0
} from "@characteros-next/memory";
import { validateCharacterLanguageBehaviorV0 } from "@characteros-next/behavior";
import type {
  BehaviorDeliveryRecordV0,
  ConversationDeliveryLedgerAuthority
} from "./behavior-delivery-ledger.js";
import {
  deriveBehaviorOutcomeExperienceRef,
  deriveBehaviorPayloadHash,
  deriveConversationIngressEventRef
} from "./conversation-feedback-identity.js";

export const EXPERIENCE_READER_SCHEMA_VERSION_V0 = "experience-reader-v0" as const;

export type ExperienceReadFailureCodeV0 =
  | "READER_MISCONFIGURED"
  | "REF_INVALID"
  | "REVISION_UNBOUND"
  | "REF_NOT_IN_REVISION"
  | "PAYLOAD_MISSING"
  | "PAYLOAD_HASH_MISMATCH"
  | "PAYLOAD_SCHEMA_INVALID"
  | "EXPERIENCE_LINKAGE_INVALID"
  | "EVENT_LINKAGE_INVALID"
  | "DELIVERY_LINKAGE_INVALID";

export type ExperienceReadResultV0 =
  | {
      readonly ok: true;
      readonly episode: EpisodicMemoryRecordV0;
      readonly experience: ExperienceRecordV0;
      readonly event: ConversationIngressEventRecordV0;
      /** The verified delivered behavior artifact (factual recovery). */
      readonly behavior: ExperienceRecordV0["behavior_artifact"];
      readonly behavior_delivery: BehaviorDeliveryRecordV0;
    }
  | { readonly ok: false; readonly code: ExperienceReadFailureCodeV0; readonly detail: string };

export interface ExperienceReaderV0 {
  readonly schema_version: typeof EXPERIENCE_READER_SCHEMA_VERSION_V0;
  read(input: unknown): Promise<ExperienceReadResultV0>;
}

function fail(code: ExperienceReadFailureCodeV0, detail: string): ExperienceReadResultV0 {
  return { ok: false, code, detail };
}

/**
 * Constructs the reader over trusted composition surfaces: the CONCRETE memory
 * repository (payload read face, same pattern as the episode content reader)
 * and the composition-owned delivery ledger.
 */
export function createExperienceReaderV0(deps: {
  readonly repository: InMemoryMemoryRepository;
  readonly deliveryLedger: ConversationDeliveryLedgerAuthority;
}): ExperienceReaderV0 {
  const readInput = async (input: unknown): Promise<ExperienceReadResultV0> => {
    if (deps.repository === undefined || deps.deliveryLedger === undefined || deps.deliveryLedger === null) {
      return fail("READER_MISCONFIGURED", "experience reader requires repository + delivery ledger");
    }
    if (!isRecord(input)) return fail("REF_INVALID", "input: expected object");
    const revision = input["repository_revision"];
    if (typeof revision !== "string" || revision.length === 0) {
      return fail("REF_INVALID", "input.repository_revision: nonempty string required");
    }
    const episodeRefInput = input["episode_ref"];
    if (typeof episodeRefInput !== "string" || refKind(episodeRefInput as CanonicalRefV0) !== "episode") {
      return fail("REF_INVALID", "input.episode_ref: episode ref required");
    }
    const episodeRef = episodeRefInput as CanonicalRefV0;

    // ---- 1. bound revision membership --------------------------------------------
    const manifest = await deps.repository.readManifest(revision as never);
    if (manifest === null) return fail("REVISION_UNBOUND", `revision ${revision} has no manifest`);
    const episodeEntry = manifest.record_hashes.find((r) => r.ref === episodeRef);
    if (episodeEntry === undefined) {
      return fail("REF_NOT_IN_REVISION", `episode ${episodeRef} is not bound to revision ${revision}`);
    }
    const experienceRefInput = input["experience_ref"];
    let experienceRef: CanonicalRefV0 | null = null;
    if (typeof experienceRefInput === "string") {
      if (refKind(experienceRefInput as CanonicalRefV0) !== "experience") {
        return fail("REF_INVALID", "input.experience_ref: experience ref required when supplied");
      }
      experienceRef = experienceRefInput as CanonicalRefV0;
    }

    // ---- 2. episode payload hash + schema -----------------------------------------
    const episodePayload = deps.repository.readStoredPayload(episodeRef);
    if (episodePayload === undefined) return fail("PAYLOAD_MISSING", `episode ${episodeRef} payload missing`);
    const episodeHash = await computeMemoryRecordPayloadHash(episodePayload);
    if (episodeHash !== episodeEntry.payload_hash) {
      return fail("PAYLOAD_HASH_MISMATCH", `episode ${episodeRef} payload hash mismatch`);
    }
    const episodeChecked = validateEpisodicMemoryRecord(episodePayload);
    if (!episodeChecked.ok) return fail("PAYLOAD_SCHEMA_INVALID", `episode: ${episodeChecked.error.detail}`);
    const episode = episodeChecked.value;

    // ---- 3. experience record via the episode's experience reference ---------------
    const experienceRefsInEpisode = episode.references.filter((r) => refKind(r) === "experience");
    if (experienceRefsInEpisode.length !== 1) {
      return fail("EXPERIENCE_LINKAGE_INVALID", "episode must reference exactly one experience record");
    }
    const boundExperienceRef = experienceRefsInEpisode[0] as CanonicalRefV0;
    if (experienceRef !== null && experienceRef !== boundExperienceRef) {
      return fail("EXPERIENCE_LINKAGE_INVALID", "supplied experience_ref does not match the episode-bound experience");
    }
    const experienceEntry = manifest.record_hashes.find((r) => r.ref === boundExperienceRef);
    if (experienceEntry === undefined) {
      return fail("REF_NOT_IN_REVISION", `experience ${boundExperienceRef} is not bound to revision ${revision}`);
    }
    const experiencePayload = deps.repository.readStoredPayload(boundExperienceRef);
    if (experiencePayload === undefined) return fail("PAYLOAD_MISSING", "experience payload missing");
    const experienceHash = await computeMemoryRecordPayloadHash(experiencePayload);
    if (experienceHash !== experienceEntry.payload_hash) {
      return fail("PAYLOAD_HASH_MISMATCH", "experience payload hash mismatch");
    }
    const experienceChecked = validateExperienceRecord(experiencePayload);
    if (!experienceChecked.ok) return fail("PAYLOAD_SCHEMA_INVALID", `experience: ${experienceChecked.error.detail}`);
    const experience = experienceChecked.value;
    if (experience.experience_ref !== boundExperienceRef) {
      return fail("EXPERIENCE_LINKAGE_INVALID", "experience payload ref mismatch");
    }

    // ---- 4. Experience self-ref re-derivation (identity binding) -------------------
    const reDerivedExperienceRef = await deriveBehaviorOutcomeExperienceRef({
      subject_id: experience.subject_id,
      source_event_id: experience.outcome.source_event_id,
      behavior_delivery_id: experience.behavior_delivery_id
    });
    if (reDerivedExperienceRef !== experience.experience_ref) {
      return fail("EXPERIENCE_LINKAGE_INVALID", "experience ref does not re-derive from bound facts (tamper evidence)");
    }

    // ---- 5. nested outcome ↔ ingress event exact consistency -----------------------
    const eventRef = experience.event_ref;
    const eventEntry = manifest.record_hashes.find((r) => r.ref === eventRef);
    if (eventEntry === undefined) {
      return fail("REF_NOT_IN_REVISION", `ingress event ${eventRef} is not bound to revision ${revision}`);
    }
    const eventPayload = deps.repository.readStoredPayload(eventRef);
    if (eventPayload === undefined) return fail("PAYLOAD_MISSING", "ingress event payload missing");
    const eventHash = await computeMemoryRecordPayloadHash(eventPayload);
    if (eventHash !== eventEntry.payload_hash) {
      return fail("PAYLOAD_HASH_MISMATCH", "ingress event payload hash mismatch");
    }
    const eventChecked = validateConversationIngressEventRecord(eventPayload);
    if (!eventChecked.ok) return fail("PAYLOAD_SCHEMA_INVALID", `ingress event: ${eventChecked.error.detail}`);
    const event = eventChecked.value;
    const reDerivedEventRef = await deriveConversationIngressEventRef({
      subject_id: event.subject_id,
      conversation_id: event.conversation_id,
      actor_ref: event.actor_ref,
      text: event.text,
      logical_time: event.logical_time,
      source_event_id: event.source_event_id,
      in_reply_to_delivery_id: event.in_reply_to_delivery_id
    });
    if (reDerivedEventRef !== event.event_ref) {
      return fail("EVENT_LINKAGE_INVALID", "ingress event ref does not re-derive from bound facts (tamper evidence)");
    }
    if (event.source_event_id !== experience.outcome.source_event_id) {
      return fail("EVENT_LINKAGE_INVALID", "ingress event / outcome source event mismatch");
    }
    if (event.text !== experience.outcome.text) {
      return fail("EVENT_LINKAGE_INVALID", "ingress event / outcome exact-text mismatch");
    }
    if (event.logical_time !== experience.outcome.logical_time) {
      return fail("EVENT_LINKAGE_INVALID", "ingress event / outcome logical time mismatch");
    }
    if (event.actor_ref !== experience.outcome.actor_ref) {
      return fail("EVENT_LINKAGE_INVALID", "ingress event / outcome actor mismatch");
    }
    if (event.subject_id !== experience.subject_id || event.conversation_id !== experience.conversation_id) {
      return fail("EVENT_LINKAGE_INVALID", "ingress event / experience subject or conversation mismatch");
    }
    if (event.in_reply_to_delivery_id !== experience.behavior_delivery_id) {
      return fail("DELIVERY_LINKAGE_INVALID", "ingress event parent does not match the experience delivery binding");
    }

    // ---- 6. delivery linkage: stored DELIVERED receipt + artifact tamper evidence --
    const delivery = await deps.deliveryLedger.readDelivery(experience.behavior_delivery_id);
    if (delivery === null) {
      return fail("DELIVERY_LINKAGE_INVALID", "no stored delivery record for the experience parent");
    }
    if (delivery.status !== "DELIVERED") {
      return fail("DELIVERY_LINKAGE_INVALID", "the bound delivery is not DELIVERED");
    }
    if (delivery.subject_id !== experience.subject_id || delivery.conversation_id !== experience.conversation_id) {
      return fail("DELIVERY_LINKAGE_INVALID", "delivery subject/conversation mismatch");
    }
    if (delivery.behavior_payload_hash !== experience.behavior_payload_hash) {
      return fail("DELIVERY_LINKAGE_INVALID", "delivery/experience behavior payload hash mismatch");
    }
    const artifactFromDelivery = await deriveBehaviorPayloadHash(delivery.behavior);
    if (artifactFromDelivery !== experience.behavior_payload_hash) {
      return fail("DELIVERY_LINKAGE_INVALID", "delivered behavior artifact hash does not recompute (tampered)");
    }
    const artifactChecked = await validateCharacterLanguageBehaviorV0(experience.behavior_artifact);
    if (!artifactChecked.ok) {
      return fail("PAYLOAD_SCHEMA_INVALID", `experience behavior artifact: ${artifactChecked.detail}`);
    }
    const artifactFromExperience = await deriveBehaviorPayloadHash(artifactChecked.behavior);
    if (artifactFromExperience !== experience.behavior_payload_hash) {
      return fail("PAYLOAD_HASH_MISMATCH", "experience-bound behavior artifact hash does not recompute (tampered)");
    }
    const subjectCheck = validateIdentifier(experience.subject_id, "experience.subject_id");
    if (!subjectCheck.ok) return fail("PAYLOAD_SCHEMA_INVALID", subjectCheck.error.detail);

    return {
      ok: true,
      episode,
      experience,
      event,
      behavior: artifactChecked.behavior,
      behavior_delivery: delivery
    };
  };

  return Object.freeze({
    schema_version: EXPERIENCE_READER_SCHEMA_VERSION_V0,
    read: readInput
  });
}
