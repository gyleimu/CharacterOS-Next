/**
 * CANONICAL_AFFECT_EVENT_AUTHORITY_SHADOW_V0 — ConversationFactualEventAuthorityV0.
 *
 * FACTUAL EVENT IDENTITY (§3): a conversation factual event is
 * `{ subject_id, event_ref }` where `event_ref` is the canonical ingress event
 * ref derived from authoritative ingress facts. Observation / Outcome /
 * Experience / Appraisal are REPRESENTATION ALIASES that must all resolve back
 * to that same identity. No new canonical FactualEventRecordV0 is introduced;
 * the ingress ledger remains the composition-owned authority.
 *
 * SOURCE EVENT LAW (§4): same subject + same source_event_id + identical facts
 * ⇒ same event_ref (replay); changed payload ⇒ SOURCE_EVENT_CONFLICT; same
 * text with different source_event_id ⇒ DIFFERENT factual events (never
 * deduplicate on text).
 *
 * ALIAS LAW (§14): if two representations resolve to different event refs the
 * authority fails closed (ALIAS_CONFLICT) — never prefer/latest/first.
 *
 * Committed bundles are the only trusted observation provenance (§10):
 * transient pre-commit Observation objects are never trusted.
 */

import type {
  CanonicalRefV0,
  HashV1,
  IdentifierV0
} from "@characteros-next/subject-core";
import { hashEnvelope, isRecord, refKind } from "@characteros-next/subject-core";
import type { AtomicCommitBundleAnyVersion } from "@characteros-next/subject-core";
import type { ConversationIngressLedgerAuthority } from "../transitions/conversation/conversation-ingress-ledger.js";
import type { ConversationIngressEventRecordV0 } from "@characteros-next/memory";
import type { ExperienceReaderV0 } from "../transitions/conversation/experience-reader.js";
import { deriveConversationIngressEventRef } from "../transitions/conversation/conversation-feedback-identity.js";
import type {
  ExperienceAppraisalReaderV0
} from "../experience-appraisal/experience-appraisal-reader.js";

export type ConversationEventAliasKindV0 =
  | "INGRESS"
  | "OBSERVATION"
  | "OUTCOME"
  | "EXPERIENCE"
  | "APPRAISAL";

/** The canonical factual event identity plus its verified representation aliases. */
export interface ConversationFactualEventResolutionV0 {
  readonly ok: true;
  readonly subject_id: IdentifierV0;
  /** The canonical ingress `event:` ref — THE factual event identity. */
  readonly factual_event_ref: CanonicalRefV0;
  readonly source_event_id: IdentifierV0;
  readonly event_payload_hash: HashV1;
  /** Verified representation aliases resolving to this identity. */
  readonly verified_aliases: readonly CanonicalRefV0[];
}

export type ConversationFactualEventFailureV0 =
  | { readonly ok: false; readonly code: "INGRESS_UNKNOWN" | "INGRESS_FINGERPRINT_MISMATCH" | "SUBJECT_MISMATCH" | "NOT_OBSERVATION" | "EVENT_CAUSE_MISSING" | "EVENT_CAUSE_AMBIGUOUS" | "EXPERIENCE_UNRESOLVED" | "APPRAISAL_UNRESOLVED" | "ALIAS_CONFLICT" | "INPUT_INVALID"; readonly detail: string };

/** Narrow committed-transition read face (durable bundles only). */
export interface ConversationCommittedTransitionReaderV0 {
  readCommittedBundle(transitionId: string): Promise<AtomicCommitBundleAnyVersion | null>;
}

export interface ConversationFactualEventAuthorityV0 {
  /** §7: resolve from composition-owned ingress ledger (re-derives event_ref). */
  resolveIngressEvent(input: unknown): Promise<ConversationFactualEventResolutionV0 | ConversationFactualEventFailureV0>;
  /** §10: resolve a committed conversation Observation to its factual event. */
  resolveObservationEvent(input: unknown): Promise<ConversationFactualEventResolutionV0 | ConversationFactualEventFailureV0>;
  /** §12: resolve Outcome/Experience/Episode-derived Experience aliases. */
  resolveExperienceEvent(input: unknown): Promise<ConversationFactualEventResolutionV0 | ConversationFactualEventFailureV0>;
  /** §13: resolve a canonical Experience Appraisal to its factual event. */
  resolveAppraisalEvent(input: unknown): Promise<ConversationFactualEventResolutionV0 | ConversationFactualEventFailureV0>;
  /** §14: cross-check several aliases; different event refs ⇒ ALIAS_CONFLICT. */
  resolveAliasedEvent(input: unknown): Promise<ConversationFactualEventResolutionV0 | ConversationFactualEventFailureV0>;
}

function failV(code: ConversationFactualEventFailureV0 extends { ok: false; code: infer C } ? C : never, detail: string): ConversationFactualEventFailureV0 {
  return { ok: false, code, detail } as ConversationFactualEventFailureV0;
}

function isFailure(v: ConversationFactualEventResolutionV0 | ConversationFactualEventFailureV0): v is ConversationFactualEventFailureV0 {
  return (v as { ok?: unknown }).ok === false;
}

/**
 * Composition-owned authority. Reads ingress facts from the ingress ledger,
 * re-derives event refs, verifies them against committed Observation bundles
 * and the Experience/Appraisal readers. No generic graph engine.
 */
export class InMemoryConversationFactualEventAuthorityV0 implements ConversationFactualEventAuthorityV0 {
  constructor(
    private readonly ingressLedger: ConversationIngressLedgerAuthority,
    private readonly committedTransitions: ConversationCommittedTransitionReaderV0,
    private readonly experienceReader: ExperienceReaderV0,
    private readonly appraisalReader: ExperienceAppraisalReaderV0
  ) {}

  /** §7: ledger read + fingerprint re-derivation + subject verification. */
  async resolveIngressEvent(input: unknown): Promise<ConversationFactualEventResolutionV0 | ConversationFactualEventFailureV0> {
    if (!isRecord(input)) return failV("INPUT_INVALID", "input: expected object");
    const subject = input["subject_id"];
    const sourceEventId = input["source_event_id"];
    if (typeof subject !== "string" || typeof sourceEventId !== "string") {
      return failV("INPUT_INVALID", "subject_id and source_event_id required");
    }
    const record = await this.ingressLedger.readIngressEvent(subject, sourceEventId);
    if (record === null) {
      return failV("INGRESS_UNKNOWN", `no ingress event ${sourceEventId} for subject ${subject}`);
    }
    return this.fromIngressRecord(record);
  }

  private async fromIngressRecord(record: ConversationIngressEventRecordV0): Promise<ConversationFactualEventResolutionV0 | ConversationFactualEventFailureV0> {
    // Fingerprint law: re-derive the exact canonical event ref from the stored facts.
    const reDerived = await deriveConversationIngressEventRef({
      subject_id: record.subject_id,
      conversation_id: record.conversation_id,
      actor_ref: record.actor_ref,
      text: record.text,
      logical_time: record.logical_time,
      source_event_id: record.source_event_id,
      in_reply_to_delivery_id: record.in_reply_to_delivery_id
    });
    if (reDerived !== record.event_ref) {
      return failV("INGRESS_FINGERPRINT_MISMATCH", `ingress event ${record.source_event_id} event_ref does not re-derive from stored facts`);
    }
    return {
      ok: true,
      subject_id: record.subject_id,
      factual_event_ref: record.event_ref,
      source_event_id: record.source_event_id,
      event_payload_hash: await hashEnvelope(
        "characteros-next/memory/conversation-ingress-event-facts/v1",
        {
          subject_id: record.subject_id,
          conversation_id: record.conversation_id,
          actor_ref: record.actor_ref,
          text: record.text,
          logical_time: record.logical_time,
          source_event_id: record.source_event_id,
          in_reply_to_delivery_id: record.in_reply_to_delivery_id
        }
      ),
      verified_aliases: [record.event_ref]
    };
  }

  /** §10: committed bundle → observation ref in cause refs → exactly one verified event cause. */
  async resolveObservationEvent(input: unknown): Promise<ConversationFactualEventResolutionV0 | ConversationFactualEventFailureV0> {
    if (!isRecord(input)) return failV("INPUT_INVALID", "input: expected object");
    const subject = input["subject_id"];
    const transitionId = input["observation_transition_id"];
    const observationRefInput = input["observation_ref"];
    if (typeof subject !== "string" || typeof transitionId !== "string" || typeof observationRefInput !== "string") {
      return failV("INPUT_INVALID", "subject_id, observation_transition_id and observation_ref required");
    }
    const observationRef = observationRefInput as CanonicalRefV0;
    if (refKind(observationRef) !== "observation") {
      return failV("INPUT_INVALID", "observation_ref: kind observation required");
    }
    const bundle = await this.committedTransitions.readCommittedBundle(transitionId);
    if (bundle === null) return failV("NOT_OBSERVATION", "no committed bundle for the observation transition");
    if (bundle.subject_id !== subject) return failV("SUBJECT_MISMATCH", "observation bundle belongs to a different subject");
    if (bundle.transition_type !== "Observation") return failV("NOT_OBSERVATION", "committed transition is not an Observation");
    if (!bundle.trace_entry.cause_refs.includes(observationRef)) {
      return failV("EVENT_CAUSE_MISSING", "observation ref is not a cause ref of the committed bundle");
    }
    const eventCauses = bundle.trace_entry.cause_refs.filter((ref) => refKind(ref) === "event");
    if (eventCauses.length !== 1) {
      return failV(
        eventCauses.length === 0 ? "EVENT_CAUSE_MISSING" : "EVENT_CAUSE_AMBIGUOUS",
        `committed Observation carries ${eventCauses.length} event-kind cause refs; exactly one verified conversation event required`
      );
    }
    const eventRef = eventCauses[0] as CanonicalRefV0;
    // Independently verify the event through the ingress authority.
    const verified = await this.verifyEventRef(subject, eventRef);
    if (!verified.ok) return verified;
    const aliases = [observationRef, eventRef].sort() as readonly CanonicalRefV0[];
    return { ...verified, verified_aliases: aliases };
  }

  /** §12: Outcome/Experience/Episode → ExperienceReader → event → identity. */
  async resolveExperienceEvent(input: unknown): Promise<ConversationFactualEventResolutionV0 | ConversationFactualEventFailureV0> {
    if (!isRecord(input)) return failV("INPUT_INVALID", "input: expected object");
    const subject = input["subject_id"];
    const episodeRefInput = input["episode_ref"];
    if (typeof subject !== "string" || typeof episodeRefInput !== "string") {
      return failV("INPUT_INVALID", "subject_id and episode_ref required");
    }
    const experienceRead = await this.experienceReader.read({
      repository_revision: input["repository_revision"] as never,
      episode_ref: episodeRefInput as never
    });
    if (!experienceRead.ok) {
      return failV("EXPERIENCE_UNRESOLVED", `${experienceRead.code}: ${experienceRead.detail}`);
    }
    const eventRef = experienceRead.event.event_ref;
    const verified = await this.verifyEventRef(subject, eventRef);
    if (!verified.ok) return verified;
    const aliases = [
      experienceRead.episode.episode_ref,
      experienceRead.experience.experience_ref,
      experienceRead.experience.outcome.outcome_ref,
      eventRef
    ].sort() as readonly CanonicalRefV0[];
    return { ...verified, verified_aliases: aliases };
  }

  /** §13: canonical Appraisal → Experience → event → identity. */
  async resolveAppraisalEvent(input: unknown): Promise<ConversationFactualEventResolutionV0 | ConversationFactualEventFailureV0> {
    if (!isRecord(input)) return failV("INPUT_INVALID", "input: expected object");
    const subject = input["subject_id"];
    const appraisalRef = input["appraisal_ref"];
    if (typeof subject !== "string" || typeof appraisalRef !== "string") {
      return failV("INPUT_INVALID", "subject_id and appraisal_ref required");
    }
    const appraisalRead = await this.appraisalReader.read({
      repository_revision: input["repository_revision"] as never,
      appraisal_ref: appraisalRef as never,
      subject_id: subject
    });
    if (!appraisalRead.ok) {
      return failV("APPRAISAL_UNRESOLVED", `${appraisalRead.code}: ${appraisalRead.detail}`);
    }
    const experienceRead = await this.experienceReader.read({
      repository_revision: input["repository_revision"] as never,
      episode_ref: appraisalRead.record.grounding.source_episode_ref
    });
    if (!experienceRead.ok) {
      return failV("EXPERIENCE_UNRESOLVED", `${experienceRead.code}: ${experienceRead.detail}`);
    }
    const eventRef = experienceRead.event.event_ref;
    const verified = await this.verifyEventRef(subject, eventRef);
    if (!verified.ok) return verified;
    const aliases = [
      appraisalRead.record.appraisal_ref,
      experienceRead.episode.episode_ref,
      experienceRead.experience.experience_ref,
      experienceRead.experience.outcome.outcome_ref,
      eventRef
    ].sort() as readonly CanonicalRefV0[];
    return { ...verified, verified_aliases: aliases };
  }

  /** §14: cross-check aliases — all must resolve to the same factual event. */
  async resolveAliasedEvent(input: unknown): Promise<ConversationFactualEventResolutionV0 | ConversationFactualEventFailureV0> {
    if (!isRecord(input)) return failV("INPUT_INVALID", "input: expected object");
    const subject = input["subject_id"];
    if (typeof subject !== "string") return failV("INPUT_INVALID", "subject_id required");
    const resolutions: ConversationFactualEventResolutionV0[] = [];
    const ingressSourceEventId = input["ingress_source_event_id"];
    if (typeof ingressSourceEventId === "string") {
      const r = await this.resolveIngressEvent({ subject_id: subject, source_event_id: ingressSourceEventId });
      if (isFailure(r)) return r;
      resolutions.push(r);
    }
    if (isRecord(input["observation"]) && typeof input["observation"]["observation_transition_id"] === "string") {
      const r = await this.resolveObservationEvent({ subject_id: subject, ...(input["observation"] as object) });
      if (isFailure(r)) return r;
      resolutions.push(r);
    }
    if (isRecord(input["experience"]) && typeof input["experience"]["episode_ref"] === "string") {
      const r = await this.resolveExperienceEvent({ subject_id: subject, ...(input["experience"] as object) });
      if (isFailure(r)) return r;
      resolutions.push(r);
    }
    if (isRecord(input["appraisal"]) && typeof input["appraisal"]["appraisal_ref"] === "string") {
      const r = await this.resolveAppraisalEvent({ subject_id: subject, ...(input["appraisal"] as object) });
      if (isFailure(r)) return r;
      resolutions.push(r);
    }
    if (resolutions.length === 0) return failV("INPUT_INVALID", "no resolvable alias supplied");
    const identity = resolutions[0] as ConversationFactualEventResolutionV0;
    for (const resolution of resolutions) {
      if (resolution.factual_event_ref !== identity.factual_event_ref || resolution.source_event_id !== identity.source_event_id) {
        return failV("ALIAS_CONFLICT", `aliases resolve to different factual events (${identity.factual_event_ref} vs ${resolution.factual_event_ref})`);
      }
    }
    const mergedAliases = [...new Set<string>(resolutions.flatMap((r) => r.verified_aliases as readonly string[]))].sort();
    return { ...identity, verified_aliases: mergedAliases as unknown as readonly CanonicalRefV0[] };
  }

  private async verifyEventRef(
    subjectId: string,
    eventRef: CanonicalRefV0
  ): Promise<ConversationFactualEventResolutionV0 | ConversationFactualEventFailureV0> {
    // Locate the ingress record whose re-derived event_ref matches exactly.
    for (const record of this.ingressLedger.exportState()) {
      if (record.subject_id !== subjectId) continue;
      const resolution = await this.fromIngressRecord(record);
      if (!isFailure(resolution) && resolution.factual_event_ref === eventRef) {
        return resolution;
      }
    }
    return failV("EVENT_CAUSE_MISSING", `event ${eventRef} has no verified ingress record for subject ${subjectId}`);
  }
}

/** Narrow input guard re-export (subject/ref shape). */
export type ConversationFactualEventInputRef = CanonicalRefV0;
