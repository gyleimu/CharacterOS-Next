/**
 * CANONICAL_AFFECT_APPLICATION_V0 — the explicit-v4 impulse writer.
 *
 * For an explicit SubjectStateV4 subject, consume ONE verified canonical
 * INITIAL Appraisal for ONE authoritative factual event, apply the frozen
 * bounded Affect impulse exactly once, and atomically commit the resulting
 * CanonicalAffectV0 /affect replacement. The successful AtomicCommitBundleV2
 * itself is the durable consumption receipt (JOURNAL_DERIVED — no consumed
 * flag, no second ledger, no post-commit marker).
 *
 * Laws frozen by the slice:
 *   - EXPLICIT V4 ONLY: subject-state-v4 predecessor, canonical-affect-v0,
 *     BOUNDED_AFFECT_DYNAMICS_V0/tick profile. v3/unknown → fail closed.
 *   - DISPOSITION GATE: only APPRAISED proceeds. ABSTAINED → NOT_ELIGIBLE;
 *     PENDING → TARGET_NOT_READY; INTEGRITY_FAILURE → fail closed. Dynamics 0
 *     and commit 0 on every non-committed route.
 *   - ORDERING GATE: earlier admitted events inside the explicit-v4 trusted
 *     history boundary must be terminally resolved (applied, legacy-applied or
 *     abstained) before this event may apply — the admission key is
 *     (source_admission_history_sequence ASC, factual_event_ref ASCII ASC),
 *     grounded in committed Observation bundles only.
 *   - TIME: AffectApplication is the impulse writer; TimeTransition is the
 *     only recovery writer. advanceAffectTimeV0 is NEVER called here — no
 *     lazy decay, no catch-up, no event-time recovery; the impulse applies at
 *     the subject's CURRENT logical time (OCCURRENCE; logical time unchanged).
 *   - EXACTLY ONCE: one factual event + INITIAL → at most one canonical
 *     AffectApplication, enforced by deterministic execution identity +
 *     reservation + single CAS + journal-derived receipt recognition.
 *     Zero-impulse and saturation commits are lawful receipts.
 *   - LATE INFORMATION: APPLY_NOW_AS_LATE_INFORMATION — the impulse applies
 *     at the current logical time; original occurrence provenance is kept in
 *     the causal chain; no rewind, no historical replay, no snapshot rewrite.
 */

import type {
  AtomicCommitBundleAnyVersion,
  CanonicalTransitionProposalV1,
  CommitReservedOutcome,
  DomainDeltaV0,
  HashV1,
  IdentifierV0,
  RepositoryRevisionBindingV1,
  RepositoryRevisionIdV0,
  SubjectCoreFacade,
  UnitIntervalV0,
  SubjectStateV4
} from "@characteros-next/subject-core";
import {
  proposalFingerprint,
  stateHashAnyVersion,
  validateCanonicalAffectShape,
  validateMechanismConfigV1Shape,
  type ProducerAuthorizationIssuer
} from "@characteros-next/subject-core";
import { computeRepositoryRevisionHash, type InMemoryMemoryRepository } from "@characteros-next/memory";
import type { AffectImpulseV0 } from "@characteros-next/affect";
import { applyAffectImpulseV0, deriveAffectImpulseV0 } from "@characteros-next/affect";
import type { RuntimeContext } from "../../types/runtime-context.js";
import type { LearningSourceReadAuthority } from "../learning/learning-source-authority.js";
import type { ConversationFactualEventAuthorityV0 } from "../../authority/conversation-factual-event-authority-v0.js";
import {
  InMemoryAffectEventAuthorityV0,
  type AffectReceiptValidationSurfaceV0,
  type TrustedAffectHistoryReaderV0
} from "../../authority/affect-event-authority-v0.js";
import {
  AFFECT_APPLICATION_DYNAMICS_CONTRACT_ID_V0,
  AFFECT_APPLICATION_DYNAMICS_CONTRACT_REF_V0,
  deriveAffectApplicationExecutionIdentityV0,
  deriveAffectApplicationTransitionIdV0,
  deriveAffectEligibilityRefV0
} from "../../authority/affect-application-history-validator-v0.js";
import { resolveInitialAppraisalDispositionForFactualEventV0 } from "../../factual-event-appraisal/factual-event-appraisal-disposition-reader.js";
import { anchorContext, stageFailure } from "../common.js";

const STAGE = "OBSERVATION" as const;
export const V4_AFFECT_APPLICATION_FOUNDATION_MODE = "EXPLICIT_V4_FOUNDATION_V0" as const;
export type V4AffectApplicationFoundationMode = typeof V4_AFFECT_APPLICATION_FOUNDATION_MODE;

/** §14: the narrow verified capability minted from the durable disposition —
 * never raw repository records, never caller assertion. */
export interface VerifiedCanonicalInitialAppraisalV0 {
  readonly schema_version: "verified-canonical-initial-appraisal-v0";
  readonly subject_id: IdentifierV0;
  readonly semantic_appraisal_episode: "INITIAL";
  readonly appraisal_ref: string;
  readonly appraisal_payload_hash: HashV1;
  readonly factual_event_ref: string;
  readonly factual_event_payload_hash: HashV1;
  readonly source_observation_ref: string;
  readonly source_observation_transition_id: string;
  readonly source_observation_commit_ref: string;
  readonly source_admission_history_sequence: number;
  readonly original_occurrence_logical_time: number;
  readonly evaluated_at_logical_time: number;
  readonly dimensions: Readonly<{
    readonly relevance: UnitIntervalV0;
    readonly goal_congruence: UnitIntervalV0;
    readonly intensity: UnitIntervalV0;
  }>;
}

export interface CanonicalAffectApplicationInputV0 {
  readonly factual_event_ref: string;
}

export type CanonicalAffectApplicationExecutionResultV0 =
  | { readonly kind: "COMMITTED"; readonly bundle: AtomicCommitBundleAnyVersion }
  | {
      readonly kind: "ALREADY_APPLIED";
      readonly via: "CANONICAL" | "LEGACY";
    }
  | { readonly kind: "NOT_ELIGIBLE"; readonly reason: string }
  | { readonly kind: "TARGET_NOT_READY"; readonly reason: string }
  | { readonly kind: "PRIOR_AFFECT_WORK_PENDING"; readonly reason: string }
  | { readonly kind: "REBASE_REQUIRED"; readonly reason: string }
  | { readonly kind: "UNRESOLVED"; readonly reason: string }
  | {
      readonly kind: "REJECTED";
      readonly reason: string;
      readonly blocked?: "PRIOR_WORK_INTEGRITY_BLOCKED";
    };

export interface CanonicalAffectApplicationExecutorDepsV0 {
  readonly subjectCore: SubjectCoreFacade<SubjectStateV4>;
  readonly producerAuthorizationIssuer: ProducerAuthorizationIssuer;
  readonly repository: InMemoryMemoryRepository;
  readonly factualEventAuthority: ConversationFactualEventAuthorityV0;
  readonly learningSourceAuthority: LearningSourceReadAuthority;
  readonly affectAuthority: InMemoryAffectEventAuthorityV0;
  readonly trustedHistory: TrustedAffectHistoryReaderV0;
}

const STALE = "STALE_STATE_REVISION";

/**
 * §14/§15: mint the verified capability only after proving the canonical
 * Appraisal (closed schema, payload hash, self-ref, ancestry visibility via
 * the disposition resolver), the subject/event match, the committed
 * Observation grounding, the INITIAL episode, alias uniqueness through the
 * frozen factual event authority, disposition = APPRAISED, and that the
 * recorded admission sequence matches the committed Observation history.
 */
async function mintVerifiedCanonicalInitialAppraisalV0(
  deps: CanonicalAffectApplicationExecutorDepsV0,
  ctx: RuntimeContext,
  snapshot: SubjectStateV4,
  repositoryRevision: RepositoryRevisionIdV0,
  factualEventRef: string
): Promise<
  | { readonly ok: true; readonly verified: VerifiedCanonicalInitialAppraisalV0 }
  | { readonly ok: false; readonly result: CanonicalAffectApplicationExecutionResultV0 }
> {
  const disposition = await resolveInitialAppraisalDispositionForFactualEventV0(
    deps.repository, repositoryRevision, ctx.subject_id, factualEventRef
  );
  if (disposition.kind === "INTEGRITY_FAILURE") {
    return { ok: false, result: { kind: "REJECTED", reason: `disposition integrity failure: ${disposition.reason}` } };
  }
  if (disposition.kind === "PENDING") {
    return { ok: false, result: { kind: "TARGET_NOT_READY", reason: "no canonical INITIAL Appraisal and no durable abstention exist yet" } };
  }
  if (disposition.kind === "ABSTAINED_INSUFFICIENT_CONTEXT") {
    return { ok: false, result: { kind: "NOT_ELIGIBLE", reason: "the INITIAL episode is durably abstained (INSUFFICIENT_CONTEXT is terminal)" } };
  }
  const record = disposition.appraisal;

  // Committed Observation grounding through the frozen factual event
  // authority (alias uniqueness + event payload match included).
  const resolution = await deps.factualEventAuthority.resolveObservationEvent({
    subject_id: ctx.subject_id,
    observation_transition_id: record.source_observation_transition_id,
    observation_ref: record.source_observation_ref
  });
  if (!resolution.ok) {
    return { ok: false, result: { kind: "REJECTED", reason: `factual event grounding failed (${resolution.code}): ${resolution.detail}` } };
  }
  if (resolution.factual_event_ref !== record.factual_event_ref || factualEventRef !== record.factual_event_ref) {
    return { ok: false, result: { kind: "REJECTED", reason: "alias resolution disagrees with the canonical INITIAL Appraisal grounding" } };
  }
  if (resolution.event_payload_hash !== record.factual_event_payload_hash) {
    return { ok: false, result: { kind: "REJECTED", reason: "factual event payload hash does not match the canonical Appraisal grounding" } };
  }
  const observationBundle = await deps.learningSourceAuthority.readCommittedBundle(record.source_observation_transition_id);
  if (observationBundle === null) {
    return { ok: false, result: { kind: "REJECTED", reason: "committed Observation grounding bundle is unavailable" } };
  }
  if (observationBundle.trace_entry.history_sequence !== record.source_admission_history_sequence) {
    return { ok: false, result: { kind: "REJECTED", reason: "recorded admission sequence does not match the committed Observation history" } };
  }
  return {
    ok: true,
    verified: {
      schema_version: "verified-canonical-initial-appraisal-v0",
      subject_id: ctx.subject_id as IdentifierV0,
      semantic_appraisal_episode: "INITIAL",
      appraisal_ref: record.appraisal_ref,
      appraisal_payload_hash: disposition.appraisal.payload_hash as HashV1,
      factual_event_ref: record.factual_event_ref,
      factual_event_payload_hash: record.factual_event_payload_hash,
      source_observation_ref: record.source_observation_ref,
      source_observation_transition_id: record.source_observation_transition_id,
      source_observation_commit_ref: observationBundle.commit_ref,
      source_admission_history_sequence: record.source_admission_history_sequence,
      original_occurrence_logical_time: observationBundle.next_snapshot.runtime_metadata.logical_time,
      evaluated_at_logical_time: record.evaluated_at_logical_time,
      dimensions: {
        relevance: record.dimensions.relevance,
        goal_congruence: record.dimensions.goal_congruence,
        intensity: record.dimensions.intensity
      }
    }
  };
}

interface AttemptOutcome {
  readonly kind: "DONE" | "STALE";
  readonly result?: CanonicalAffectApplicationExecutionResultV0;
}

/** The ONE explicit-v4 AffectApplication executor. */
export class CanonicalAffectApplicationExecutorV0 {
  /** §64: only constructable through explicit foundation mode. */
  readonly mode: V4AffectApplicationFoundationMode;

  constructor(
    private readonly deps: CanonicalAffectApplicationExecutorDepsV0,
    mode: V4AffectApplicationFoundationMode
  ) {
    if (mode !== "EXPLICIT_V4_FOUNDATION_V0") {
      throw stageFailure(STAGE, "INVALID_SCHEMA", "SS-SCHEMA-001", "AffectApplication executor requires explicit foundation mode");
    }
    this.mode = mode;
  }

  async applyForEvent(
    ctx: RuntimeContext,
    input: CanonicalAffectApplicationInputV0
  ): Promise<CanonicalAffectApplicationExecutionResultV0> {
    const first = await this.runAttempt(ctx, input);
    if (first.kind === "DONE") return first.result as CanonicalAffectApplicationExecutionResultV0;
    // §46: bounded single rebuild. The rebuild re-reads the head — an unrelated
    // Time winner's recovered Affect becomes the new predecessor (§47); a
    // competing application's receipt resolves as ALREADY_APPLIED (§45). The
    // caller's context is re-anchored to the CURRENT head first.
    const reloaded = await this.deps.subjectCore.readCurrentSnapshot(ctx.subject_id);
    if (reloaded === null) {
      return { kind: "UNRESOLVED", reason: "canonical subject state unavailable after stale rejection" };
    }
    const rebaseCtx: RuntimeContext = {
      subject_id: reloaded.identity.subject_id,
      current_logical_time: reloaded.runtime_metadata.logical_time,
      state_revision: reloaded.runtime_metadata.state_revision
    } as unknown as RuntimeContext;
    const second = await this.runAttempt(rebaseCtx, input);
    if (second.kind === "DONE") return second.result as CanonicalAffectApplicationExecutionResultV0;
    return { kind: "REBASE_REQUIRED", reason: "second stale CAS rejection after the single permitted rebuild" };
  }

  private async runAttempt(
    ctx: RuntimeContext,
    input: CanonicalAffectApplicationInputV0
  ): Promise<AttemptOutcome> {
    const snapshot = await this.deps.subjectCore.readCurrentSnapshot(ctx.subject_id);
    if (snapshot === null) {
      throw stageFailure(STAGE, "UNKNOWN_SUBJECT", "SS-AUTH-001", `subject ${ctx.subject_id} not found`);
    }
    // §5: explicit v4 only — fail closed on v3/unknown/legacy shapes.
    if (snapshot.schema_version !== "subject-state-v4") {
      throw stageFailure(STAGE, "INVALID_SCHEMA", "SS-SCHEMA-001", `AffectApplication requires a subject-state-v4 predecessor, received ${snapshot.schema_version}`);
    }
    const mech = snapshot.mechanism_config;
    if (!validateMechanismConfigV1Shape(mech, "predecessor.mechanism_config").ok) {
      throw stageFailure(STAGE, "INVALID_SCHEMA", "SS-SCHEMA-001", "predecessor mechanism_config is not the v4 pairing");
    }
    const profile = (mech as { affect_profile?: { profile_id?: string; timebase?: string } }).affect_profile;
    if (profile?.profile_id !== AFFECT_APPLICATION_DYNAMICS_CONTRACT_ID_V0 || profile?.timebase !== "tick") {
      throw stageFailure(STAGE, "INVALID_SCHEMA", "SS-SCHEMA-001", "predecessor affect profile is not BOUNDED_AFFECT_DYNAMICS_V0/tick");
    }
    if (!validateCanonicalAffectShape(snapshot.affect, "predecessor.affect").ok) {
      throw stageFailure(STAGE, "INVALID_SCHEMA", "SS-SCHEMA-001", "predecessor /affect is not a CanonicalAffectV0");
    }
    const anchored = anchorContext(ctx, snapshot, STAGE);
    const repositoryRevision = snapshot.memory_state.repository_revision as RepositoryRevisionIdV0;
    const receiptSurface: AffectReceiptValidationSurfaceV0 = {
      repository: this.deps.repository,
      repository_revision: repositoryRevision
    };

    // ---- §16: disposition precheck (target) --------------------------------------
    const disposition = await resolveInitialAppraisalDispositionForFactualEventV0(
      this.deps.repository, repositoryRevision, ctx.subject_id, input.factual_event_ref
    );
    if (disposition.kind === "INTEGRITY_FAILURE") {
      return { kind: "DONE", result: { kind: "REJECTED", reason: `disposition integrity failure: ${disposition.reason}` } };
    }
    if (disposition.kind === "ABSTAINED_INSUFFICIENT_CONTEXT") {
      return { kind: "DONE", result: { kind: "NOT_ELIGIBLE", reason: "durably abstained INITIAL (INSUFFICIENT_CONTEXT is terminal)" } };
    }
    if (disposition.kind === "PENDING") {
      return { kind: "DONE", result: { kind: "TARGET_NOT_READY", reason: "target event has no canonical INITIAL Appraisal yet" } };
    }

    // ---- §14/§15: verified input ---------------------------------------------------
    const minted = await mintVerifiedCanonicalInitialAppraisalV0(
      this.deps, ctx, snapshot, repositoryRevision, input.factual_event_ref
    );
    if (!minted.ok) return { kind: "DONE", result: minted.result };
    const verified = minted.verified;

    // ---- §17/§18/§41: journal-derived eligibility status ---------------------------
    const status = await this.deps.affectAuthority.resolveApplicationStatus({
      subject_id: ctx.subject_id,
      factual_event_ref: input.factual_event_ref as never,
      initial_appraisal_exists: true,
      receipt_validation: receiptSurface
    });
    switch (status.status) {
      case "CANONICAL_APPLIED":
        return { kind: "DONE", result: { kind: "ALREADY_APPLIED", via: "CANONICAL" } };
      case "LEGACY_ALREADY_APPLIED":
        return { kind: "DONE", result: { kind: "ALREADY_APPLIED", via: "LEGACY" } };
      case "NOT_ELIGIBLE":
        return { kind: "DONE", result: { kind: "NOT_ELIGIBLE", reason: status.detail } };
      case "UNPROVEN_LEGACY_LINEAGE":
        return { kind: "DONE", result: { kind: "REJECTED", reason: `unproven legacy lineage: ${status.detail}` } };
      case "INTEGRITY_CONFLICT":
        return { kind: "DONE", result: { kind: "REJECTED", reason: `integrity conflict: ${status.detail}` } };
      case "CANONICAL_PENDING":
        break;
      default: {
        const exhaustive: never = status.status;
        return { kind: "DONE", result: { kind: "UNRESOLVED", reason: `unknown eligibility status ${String(exhaustive)}` } };
      }
    }

    // ---- §21/§22: ordering gate over earlier admitted events -----------------------
    const blocked = await this.priorWorkBlocker(ctx, verified, repositoryRevision, receiptSurface);
    if (blocked !== null) return { kind: "DONE", result: blocked };

    // ---- §24/§25/§26: impulse from the CURRENT head only (no recovery) -------------
    let impulse: AffectImpulseV0;
    try {
      impulse = deriveAffectImpulseV0({
        relevance: verified.dimensions.relevance,
        goal_congruence: verified.dimensions.goal_congruence,
        intensity: verified.dimensions.intensity
      });
    } catch (error) {
      throw stageFailure(STAGE, "INVALID_SCHEMA", "SS-SCHEMA-001", `impulse derivation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    const nextAffect = applyAffectImpulseV0(snapshot.affect, impulse);

    // ---- §31-§34: identities ---------------------------------------------------------
    const eligibilityIdentity = status.eligibility_identity;
    const predecessorStateHash = await stateHashAnyVersion(snapshot);
    const executionIdentity = await deriveAffectApplicationExecutionIdentityV0({
      eligibility_identity: eligibilityIdentity,
      canonical_appraisal_ref: verified.appraisal_ref,
      dynamics_contract_id: AFFECT_APPLICATION_DYNAMICS_CONTRACT_ID_V0,
      expected_subject_revision: anchored.state_revision as number,
      predecessor_state_hash: predecessorStateHash,
      predecessor_commit_ref: await this.predecessorCommitRef(ctx.subject_id, snapshot),
      application_logical_time: anchored.current_logical_time as number
    });
    const transitionId = deriveAffectApplicationTransitionIdV0(executionIdentity);
    const eligibilityRef = deriveAffectEligibilityRefV0(eligibilityIdentity);
    const executionRef = `workflow:affect-execution-v0-${executionIdentity.replace(/^sha256:/, "")}`;
    const dynamicsRef = AFFECT_APPLICATION_DYNAMICS_CONTRACT_REF_V0;

    // ---- §29/§30: the one lawful proposal ---------------------------------------------
    const affectDelta: DomainDeltaV0 = {
      producer: "affect",
      domain: "affect",
      expected_repository_revision: null,
      operations: [{ path: "/affect", value: nextAffect }],
      provenance_refs: []
    } as unknown as DomainDeltaV0;
    const canonicalProposal = {
      schema_version: "canonical-transition-proposal-v1",
      transition_id: transitionId,
      subject_id: anchored.subject_id,
      transition_type: "AffectApplication",
      expected_state_revision: anchored.state_revision as number,
      time_input: {
        kind: "OCCURRENCE",
        occurrence_logical_time: anchored.current_logical_time as number
      },
      cause_refs: [verified.appraisal_ref, verified.factual_event_ref, verified.source_observation_ref].sort(),
      domain_deltas: [affectDelta],
      external_refs: [eligibilityRef, dynamicsRef, executionRef].sort()
    } as unknown as CanonicalTransitionProposalV1;
    const payloadFingerprintValue = await proposalFingerprint(canonicalProposal);

    const reserved = await this.deps.subjectCore.reserveAndRoute(canonicalProposal);
    switch (reserved.kind) {
      case "CONTINUE":
        break;
      case "ALREADY_COMMITTED":
        return { kind: "DONE", result: { kind: "ALREADY_APPLIED", via: "CANONICAL" } };
      case "TERMINAL_NO_OP":
        return { kind: "DONE", result: { kind: "UNRESOLVED", reason: "reservation terminalized as NO_OP — outcome not determinable as applied" } };
      case "REUSE_CONFLICT":
        // Deterministic identity: a conflict means the same identity's
        // transition is in flight or already terminal — resolve on rebuild.
        return { kind: "STALE" };
    }

    const outcome: CommitReservedOutcome<SubjectStateV4> = await this.deps.subjectCore.commitReserved({
      proposal: canonicalProposal,
      continuation: reserved.continuation,
      producerAuthorization: this.deps.producerAuthorizationIssuer.issue([
        { producer: "affect", domain: "affect" }
      ]),
      preparedBinding: {
        prepared_result_ref: executionRef as never,
        transition_id: canonicalProposal.transition_id,
        subject_id: canonicalProposal.subject_id,
        transition_type: canonicalProposal.transition_type,
        payload_fingerprint: payloadFingerprintValue
      },
      repository_bindings: await this.repositoryBindings(snapshot)
    });
    if (outcome.kind === "COMMITTED") {
      return { kind: "DONE", result: { kind: "COMMITTED", bundle: outcome.bundle as unknown as AtomicCommitBundleAnyVersion } };
    }
    if (outcome.kind === "REJECTED" && (outcome.failure.error_code === STALE || outcome.failure.error_code === "COMMIT_CONFLICT")) {
      // Either a stale head or a lost CAS: the head moved — discard and let
      // the rebuild resolve the newest state (§46/§47).
      return { kind: "STALE" };
    }
    if (outcome.kind === "REJECTED") {
      return { kind: "DONE", result: { kind: "REJECTED", reason: `${outcome.failure.error_code}: ${outcome.failure.detail}` } };
    }
    return { kind: "DONE", result: { kind: "UNRESOLVED", reason: "commit outcome was neither committed nor rejected — refusing to blindly recommit" } };
  }

  /** §44: nothing is durable before the CAS — the eligibility simply remains
   * pending; retry may recompute. No pre-commit receipt exists. */

  /** The commit ref of the bundle that produced the current head (§33
   * predecessor head linkage); null only at genesis. */
  private async predecessorCommitRef(subjectId: string, snapshot: SubjectStateV4): Promise<string | null> {
    const revision = snapshot.runtime_metadata.state_revision as number;
    if (revision === 0) return null;
    const bundles = await this.deps.trustedHistory.readCommittedBundlesForSubject(subjectId);
    const predecessor = bundles.find(
      (b) => b.next_snapshot.runtime_metadata.state_revision === revision
    );
    if (predecessor === undefined) {
      throw stageFailure(STAGE, "SERVICE_UNAVAILABLE", "FAIL-SERVICE-001", `trusted predecessor bundle for revision ${revision} is unavailable`);
    }
    return predecessor.commit_ref;
  }

  private async repositoryBindings(snapshot: SubjectStateV4): Promise<readonly RepositoryRevisionBindingV1[]> {
    const revision = snapshot.memory_state.repository_revision as RepositoryRevisionIdV0;
    const manifest = await this.deps.repository.readManifest(revision);
    if (manifest === null) {
      throw stageFailure(STAGE, "SERVICE_UNAVAILABLE", "FAIL-PREPARE-001", `repository cannot prove a manifest for revision ${String(revision)}`);
    }
    return [{
      repository_revision: revision,
      repository_revision_hash: await computeRepositoryRevisionHash(manifest)
    }];
  }

  /** §22/§49-§53: enumerate earlier admitted factual events from the trusted
   * committed Observation history and block on unresolved prior Affect work. */
  private async priorWorkBlocker(
    ctx: RuntimeContext,
    verified: VerifiedCanonicalInitialAppraisalV0,
    repositoryRevision: RepositoryRevisionIdV0,
    receiptSurface: AffectReceiptValidationSurfaceV0
  ): Promise<CanonicalAffectApplicationExecutionResultV0 | null> {
    const history = await this.deps.trustedHistory.readCommittedBundlesForSubject(ctx.subject_id);

    // Earlier admitted events: committed Observation bundles carrying exactly
    // one event-kind cause ref, ordered by (history_sequence, event ref).
    const earlier = new Map<string, number>();
    for (const bundle of history) {
      if (bundle.transition_type !== "Observation") continue;
      if (bundle.subject_id !== ctx.subject_id) continue;
      const sequence = bundle.trace_entry.history_sequence;
      if (sequence >= verified.source_admission_history_sequence) continue;
      for (const ref of bundle.trace_entry.cause_refs as readonly string[]) {
        if (!ref.startsWith("event:")) continue;
        const known = earlier.get(ref);
        if (known === undefined || sequence < known) earlier.set(ref, sequence);
      }
    }
    const ordered = [...earlier.entries()].sort((a, b) => (a[1] !== b[1] ? a[1] - b[1] : (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)));

    for (const [eventRef] of ordered) {
      const priorDisposition = await resolveInitialAppraisalDispositionForFactualEventV0(
        this.deps.repository, repositoryRevision, ctx.subject_id, eventRef
      );
      if (priorDisposition.kind === "INTEGRITY_FAILURE") {
        return { kind: "REJECTED", reason: `prior event ${eventRef} disposition integrity failure: ${priorDisposition.reason}`, blocked: "PRIOR_WORK_INTEGRITY_BLOCKED" };
      }
      if (priorDisposition.kind === "PENDING") {
        return { kind: "PRIOR_AFFECT_WORK_PENDING", reason: `prior admitted event ${eventRef} has no terminal INITIAL disposition yet` };
      }
      if (priorDisposition.kind === "ABSTAINED_INSUFFICIENT_CONTEXT") continue;
      const priorStatus = await this.deps.affectAuthority.resolveApplicationStatus({
        subject_id: ctx.subject_id,
        factual_event_ref: eventRef as never,
        initial_appraisal_exists: true,
        receipt_validation: receiptSurface
      });
      if (priorStatus.status === "CANONICAL_APPLIED" || priorStatus.status === "LEGACY_ALREADY_APPLIED") continue;
      if (priorStatus.status === "INTEGRITY_CONFLICT") {
        return { kind: "REJECTED", reason: `prior event ${eventRef} eligibility integrity conflict: ${priorStatus.detail}`, blocked: "PRIOR_WORK_INTEGRITY_BLOCKED" };
      }
      return { kind: "PRIOR_AFFECT_WORK_PENDING", reason: `prior admitted event ${eventRef} is ${priorStatus.status}` };
    }
    void verified;
    return null;
  }
}

/** §64: the bounded explicit-v4 factory. Never touches the default
 * RuntimeCompositionRoot; the writer exists only in explicit-v4 composition. */
export function createCanonicalAffectApplicationV0ForExplicitV4(
  deps: CanonicalAffectApplicationExecutorDepsV0
): CanonicalAffectApplicationExecutorV0 {
  return new CanonicalAffectApplicationExecutorV0(deps, "EXPLICIT_V4_FOUNDATION_V0");
}
