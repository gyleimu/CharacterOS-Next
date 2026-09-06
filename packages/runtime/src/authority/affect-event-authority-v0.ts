/**
 * CANONICAL_AFFECT_EVENT_AUTHORITY_SHADOW_V0 — AffectEventAuthorityV0.
 *
 * Pure identity contract + trusted-history consumption authority for future
 * canonical Affect. This slice adds NO second Affect writer: the legacy
 * Observation path remains the only live Affect writer; the canonical
 * Appraisal path is shadow authority only.
 *
 * ELIGIBILITY IDENTITY (§21):
 *   hash(subject_id, factual_event_ref, semantic_appraisal_episode = INITIAL)
 * — deliberately EXCLUDES appraisal_ref, experience_ref, outcome_ref,
 * observation ref, provider/dynamics versions, state/Memory revisions. It
 * answers exactly: "has this factual event's INITIAL appraisal episode already
 * been emotionally consumed?" Dynamics upgrades never reopen old events (§23).
 *
 * APPLICATION STATUS (§25/§26/§27/§33/§34): derived ONLY from trusted
 * committed AtomicCommitBundle history (JOURNAL_DERIVED — no receipts, no
 * SubjectState markers). A legacy Observation counts as Affect consumption
 * only if it is a committed Observation bundle for the exact subject with the
 * exact factual event cause AND a lawful Affect-domain write — magnitude is
 * irrelevant (§27 zero-impulse events are consumed). Historical affect-writing
 * Observations without verified event lineage are quarantined as
 * UNPROVEN_LEGACY_LINEAGE (potential under-application is safer than double
 * emotional application).
 */

import type {
  AtomicCommitBundleAnyVersion,
  CanonicalRefV0,
  HashV1,
  IdentifierV0
} from "@characteros-next/subject-core";
import { hashEnvelope, refKind } from "@characteros-next/subject-core";

export const AFFECT_ELIGIBILITY_IDENTITY_PROJECTION =
  "characteros-next/affect/affect-eligibility-identity/v1" as const;
export const AFFECT_EXECUTION_IDENTITY_PROJECTION =
  "characteros-next/affect/affect-execution-identity/v1" as const;

/** Semantic appraisal episode kinds. V0: INITIAL only (§22). */
export type SemanticAppraisalEpisodeKindV0 = "INITIAL" | "REAPPRAISAL";

/**
 * Pure derivation: the Affect eligibility identity for one factual event's
 * INITIAL appraisal episode. Dynamics-version independent by construction.
 */
export async function deriveAffectEligibilityIdentityV0(input: {
  readonly subject_id: string;
  readonly factual_event_ref: CanonicalRefV0;
  readonly semantic_appraisal_episode: SemanticAppraisalEpisodeKindV0;
}): Promise<HashV1> {
  return hashEnvelope(AFFECT_ELIGIBILITY_IDENTITY_PROJECTION, {
    subject_id: input.subject_id,
    factual_event_ref: input.factual_event_ref,
    semantic_appraisal_episode: input.semantic_appraisal_episode
  });
}

/**
 * FUTURE EXECUTION CONTRACT SEAM (§23/§50): a separate execution identity that
 * DOES carry the dynamics version. Defined for future canonical writers only —
 * never used to reopen old factual events.
 */
export async function deriveAffectExecutionIdentityV0(input: {
  readonly eligibility_identity: HashV1;
  readonly dynamics_version: string;
}): Promise<HashV1> {
  return hashEnvelope(AFFECT_EXECUTION_IDENTITY_PROJECTION, {
    eligibility_identity: input.eligibility_identity,
    dynamics_version: input.dynamics_version
  });
}

export type AffectApplicationStatusV0 =
  | "NOT_ELIGIBLE"
  | "UNPROVEN_LEGACY_LINEAGE"
  | "LEGACY_ALREADY_APPLIED"
  | "CANONICAL_PENDING"
  | "CANONICAL_APPLIED"
  | "INTEGRITY_CONFLICT";

/** Narrow trusted-history face: committed bundles of one subject (complete chain). */
export interface TrustedAffectHistoryReaderV0 {
  readCommittedBundlesForSubject(subjectId: string): Promise<readonly AtomicCommitBundleAnyVersion[]>;
}

export interface AffectApplicationStatusResolutionV0 {
  readonly status: AffectApplicationStatusV0;
  readonly eligibility_identity: HashV1;
  /** The legacy Observation bundle that consumed the event, when proven. */
  readonly legacy_bundle_ref: CanonicalRefV0 | null;
  readonly detail: string;
}

function hasAffectDomainWrite(bundle: AtomicCommitBundleAnyVersion): boolean {
  return bundle.trace_entry.domain_mutations.some((m) => m.domain === "affect");
}

function isObservationBundle(bundle: AtomicCommitBundleAnyVersion): boolean {
  return bundle.transition_type === "Observation";
}

function causeRefsOf(bundle: AtomicCommitBundleAnyVersion): readonly string[] {
  return bundle.trace_entry.cause_refs as readonly string[];
}

/**
 * Trusted-history consumption authority. Consumption state is derived from
 * fully validated trusted committed bundle history at the exact current
 * canonical head — never from raw journal arrays, prepared revisions, failed
 * attempts, provider calls, or Memory Appraisal records alone.
 */
export class InMemoryAffectEventAuthorityV0 {
  constructor(private readonly trustedHistory: TrustedAffectHistoryReaderV0) {}

  async resolveApplicationStatus(input: {
    readonly subject_id: string;
    readonly factual_event_ref: CanonicalRefV0;
    /** Whether a canonical INITIAL Appraisal exists for the event. */
    readonly initial_appraisal_exists: boolean;
    /** Whether a future canonical Affect application exists (always false in this slice). */
    readonly canonical_affect_applied?: boolean;
  }): Promise<AffectApplicationStatusResolutionV0> {
    const eligibilityIdentity = await deriveAffectEligibilityIdentityV0({
      subject_id: input.subject_id,
      factual_event_ref: input.factual_event_ref,
      semantic_appraisal_episode: "INITIAL"
    });

    const bundles = await this.trustedHistory.readCommittedBundlesForSubject(input.subject_id);

    // ---- scan trusted Observation history ----------------------------------------
    let legacyApplied: AtomicCommitBundleAnyVersion | null = null;
    let provenPlainObservation = false;
    let unprovenAffectObservation = false;
    for (const bundle of bundles) {
      if (!isObservationBundle(bundle)) continue;
      if (bundle.subject_id !== input.subject_id) continue;
      const causes = causeRefsOf(bundle);
      const carriesEventCause = causes.includes(input.factual_event_ref);
      const affectWrite = hasAffectDomainWrite(bundle);
      const hasVerifiedEventCause = causes.some((ref) => refKind(ref as CanonicalRefV0) === "event");
      if (carriesEventCause) {
        // Proven lineage for THIS event.
        if (affectWrite) {
          if (legacyApplied === null) legacyApplied = bundle;
        } else {
          provenPlainObservation = true;
        }
      } else if (affectWrite && !hasVerifiedEventCause) {
        // Historical affect-writing Observation with no verified event lineage:
        // cannot prove it did not consume this event's facts (§33).
        unprovenAffectObservation = true;
      }
    }

    // ---- mixed-writer integrity (§34): legacy + canonical application --------------
    if (legacyApplied !== null && input.canonical_affect_applied === true) {
      return {
        status: "INTEGRITY_CONFLICT",
        eligibility_identity: eligibilityIdentity,
        legacy_bundle_ref: legacyApplied.commit_ref,
        detail: "trusted history shows both legacy and canonical Affect application for this eligibility identity"
      };
    }

    // ---- legacy consumption (§26/§27/§29) -------------------------------------------
    if (legacyApplied !== null) {
      return {
        status: "LEGACY_ALREADY_APPLIED",
        eligibility_identity: eligibilityIdentity,
        legacy_bundle_ref: legacyApplied.commit_ref,
        detail: "a committed Observation with the verified factual event cause lawfully executed an Affect-domain write (exactly-once is about application authority, not magnitude)"
      };
    }

    // ---- unproven lineage quarantine (§33) ------------------------------------------
    if (unprovenAffectObservation && !provenPlainObservation) {
      return {
        status: "UNPROVEN_LEGACY_LINEAGE",
        eligibility_identity: eligibilityIdentity,
        legacy_bundle_ref: null,
        detail: "historical affect-writing Observations lack verified event lineage; potential under-application is safer than double emotional application"
      };
    }

    // ---- canonical shadow/pending (§31/§32) -------------------------------------------
    if (input.initial_appraisal_exists) {
      return {
        status: "CANONICAL_PENDING",
        eligibility_identity: eligibilityIdentity,
        legacy_bundle_ref: null,
        detail: provenPlainObservation
          ? "a proven plain Observation (no Affect write) exists for this event; canonical INITIAL appraisal is pending future canonical application"
          : "canonical INITIAL appraisal exists with no Affect application in trusted history"
      };
    }

    return {
      status: "NOT_ELIGIBLE",
      eligibility_identity: eligibilityIdentity,
      legacy_bundle_ref: null,
      detail: "no canonical INITIAL appraisal exists for this factual event"
    };
  }
}

/** Composition factory for the trusted-history consumption authority. */
export function createAffectEventAuthorityV0(
  trustedHistory: TrustedAffectHistoryReaderV0
): InMemoryAffectEventAuthorityV0 {
  return new InMemoryAffectEventAuthorityV0(trustedHistory);
}

/** Ref-kind guard re-export (event identity is always an `event:` ref). */
export function isEventRefV0(ref: CanonicalRefV0): boolean {
  return refKind(ref) === "event";
}

// Subject/identifier scalar surface re-export for consumers.
export type AffectAuthorityIdentifierV0 = IdentifierV0;
export type AffectAuthorityHashV0 = HashV1;
