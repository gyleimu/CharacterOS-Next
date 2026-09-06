/**
 * EXPERIENCE_APPRAISAL_INTEGRATION_V0 — ExperienceAppraisalLearningExecutorV0.
 *
 * The ONE bounded production entrypoint for the Experience → Appraisal →
 * Learning lifecycle:
 *
 *   canonical subject state → ExperienceReader → context builder (null-task
 *   law) → existing-INITIAL check (replay) → provider → closed validation →
 *   echo/hash/evidence/allowlist admission checks → stale head re-verification
 *   (bounded: attempt 0 → rebuild → attempt 1) → canonical Appraisal record →
 *   repository prepare → Learning commit (memory-content ONLY) → adoption.
 *
 * AUTHORITY: the provider proposes only dimensions/confidence/evidence; the
 * system constructs appraisal_ref, times, state anchors, provenance and the
 * transition identity. Only /memory_state/repository_revision changes. No
 * Affect/Mood/Relationship/Belief/Personality writes, no affect producer calls.
 * Appraisal is a SEPARATE explicit lifecycle phase — never auto-run by the
 * Behavior → Experience feedback flow.
 */

import type {
  CanonicalRefV0,
  CanonicalTransitionProposalV1,
  CommitReservedOutcome,
  DomainDeltaV0,
  HashV1,
  IdentifierV0,
  SubjectStateV0,
  UnitIntervalV0
} from "@characteros-next/subject-core";
import { hashEnvelope, proposalFingerprint, stateHash } from "@characteros-next/subject-core";
import type { InMemoryMemoryRepository, MemoryPrepareIntentV1 } from "@characteros-next/memory";
import { computeRepositoryRevisionHash } from "@characteros-next/memory";
import {
  deriveExperienceAppraisalProposalHashV0,
  deriveExperienceAppraisalRefV0,
  validateExperienceAppraisalProposalV0,
  validateExperienceAppraisalRecordV0,
  EXPERIENCE_APPRAISAL_PROVIDER_CONTRACT_VERSION,
  type AppraisalDimensionsV0,
  type ExperienceAppraisalRecordV0
} from "@characteros-next/appraisal";
import type { RuntimeContext } from "../types/runtime-context.js";
import type { RuntimeDependencyContainer } from "../types/runtime-dependency-container.js";
import { anchorContext, stageFailure, TransitionStageFailure } from "../transitions/common.js";
import {
  ExperienceAppraisalContextBuilderV0
} from "./experience-appraisal-context.js";
import { findInitialFactualEventAppraisalV0 } from "../factual-event-appraisal/factual-event-appraisal-reader.js";
import {
  findInitialExperienceAppraisalV0,
  type ExperienceAppraisalProviderV0
} from "./experience-appraisal-reader.js";


/** Untrusted runtime input: refs only — never appraisal content. */
export interface ExperienceAppraisalInputV0 {
  readonly subject_id: IdentifierV0;
  /** The Experience-derived episode (what retrieval produces). */
  readonly episode_ref: CanonicalRefV0;
  /** The stable provider identity admitted into provenance. */
  readonly provider_id: IdentifierV0;
}

export type ExperienceAppraisalExecutionResultV0 =
  | {
      readonly kind: "COMMITTED";
      readonly appraisal_ref: CanonicalRefV0;
      readonly payload_hash: HashV1;
      readonly memory_revision: string;
    }
  | {
      /** §23/§48 replay: a valid canonical INITIAL already exists (+0). */
      readonly kind: "ALREADY_COMPLETED";
      readonly appraisal_ref: CanonicalRefV0;
      readonly payload_hash: HashV1;
      readonly record: ExperienceAppraisalRecordV0;
      /** PRE_COGNITION_CANONICAL_APPRAISAL_V0 — "factual_event" when the
       * resolved INITIAL is the event-grounded pre-cognition record (§27/§28). */
      readonly grounding?: "experience" | "factual_event";
    }
  | {
      /** §11/§42: null task or provider abstention — zero canonical change. */
      readonly kind: "INSUFFICIENT_CONTEXT";
      readonly detail: string;
    }
  | { readonly kind: "NO_OP" }
  | {
      readonly kind: "REJECTED";
      readonly failure: { readonly error_code: string; readonly reason: string; readonly detail: string };
    }
  | {
      readonly kind: "REBASE_REQUIRED";
      readonly failure: { readonly error_code: "STALE_STATE_REVISION"; readonly reason: "REBASE-STALE-001"; readonly detail: string };
    };

interface AttemptOutcome {
  readonly kind: "DONE" | "STALE";
  readonly result?: ExperienceAppraisalExecutionResultV0;
  readonly preparedRevision?: string;
}

interface AppraisedProposalV0 {
  readonly status: "APPRAISED";
  readonly subject_id: string;
  readonly experience_ref: string;
  readonly context_projection_hash: string;
  readonly dimensions: AppraisalDimensionsV0;
  readonly assessment_confidence: UnitIntervalV0;
  readonly evidence_refs: readonly CanonicalRefV0[];
}

/**
 * Bounded production executor. One stale rebuild is permitted; a second stale
 * is the frozen terminal REBASE_REQUIRED (existing bounded stale pattern).
 */
export class ExperienceAppraisalLearningExecutorV0 {
  constructor(private readonly deps: RuntimeDependencyContainer) {}

  async appraiseExperience(
    ctx: RuntimeContext,
    input: ExperienceAppraisalInputV0
  ): Promise<ExperienceAppraisalExecutionResultV0> {
    // ---- wiring gates --------------------------------------------------------------
    const provider = this.deps.experienceAppraisalProvider;
    if (provider === null) {
      throw stageFailure("OBSERVATION", "SERVICE_UNAVAILABLE", "FAIL-PRECOMMIT-001", "experience appraisal provider not wired");
    }
    if (this.deps.experienceAppraisalStore === null) {
      throw stageFailure("OBSERVATION", "SERVICE_UNAVAILABLE", "FAIL-PRECOMMIT-001", "experience appraisal store not wired");
    }
    const adoptionAuthority = this.deps.learningAdoptionAuthority;
    if (adoptionAuthority === null) {
      throw stageFailure("OBSERVATION", "SERVICE_UNAVAILABLE", "FAIL-PRECOMMIT-001", "learning adoption authority not wired");
    }

    const first = await this.runAttempt(ctx, input, provider, 0, null);
    if (first.kind === "DONE") return first.result as ExperienceAppraisalExecutionResultV0;

    // ---- bounded single stale rebuild (existing pattern) ---------------------------
    const reloaded = await this.deps.subjectCore.readCurrentSnapshot(ctx.subject_id);
    if (reloaded === null) {
      return rebaseRequired("canonical subject state unavailable after stale rejection");
    }
    const rebaseCtx: RuntimeContext = {
      subject_id: ctx.subject_id,
      current_logical_time: reloaded.runtime_metadata.logical_time,
      state_revision: reloaded.runtime_metadata.state_revision
    } as unknown as RuntimeContext;
    const rebuilt = await this.runAttempt(rebaseCtx, input, provider, 1, first.preparedRevision ?? null);
    if (rebuilt.kind === "DONE") return rebuilt.result as ExperienceAppraisalExecutionResultV0;
    return rebaseRequired("second stale rejection after the single permitted rebuild");
  }

  private async runAttempt(
    ctx: RuntimeContext,
    input: ExperienceAppraisalInputV0,
    provider: ExperienceAppraisalProviderV0,
    rebuildOrdinal: number,
    reusePreparedRevision: string | null
  ): Promise<AttemptOutcome> {
    const adoptionAuthority = this.deps.learningAdoptionAuthority;
    if (adoptionAuthority === null) {
      throw stageFailure("OBSERVATION", "SERVICE_UNAVAILABLE", "FAIL-PRECOMMIT-001", "learning adoption authority not wired");
    }
    const repository: InMemoryMemoryRepository = this.deps.experienceAppraisalStore as never;

    // ---- one authoritative canonical basis ------------------------------------------
    const snapshot = await this.deps.subjectCore.readCurrentSnapshot(ctx.subject_id);
    if (snapshot === null) {
      throw stageFailure("OBSERVATION", "UNKNOWN_SUBJECT", "SS-AUTH-001", `subject ${ctx.subject_id} not found`);
    }
    const anchored = anchorContext(ctx, snapshot, "OBSERVATION");
    const currentRevision = snapshot.memory_state.repository_revision as string;

    // ---- reuse an attachable prepared revision (stale rebuild path) ------------------
    if (reusePreparedRevision !== null) {
      const manifest = await repository.readManifest(reusePreparedRevision as never);
      if (manifest === null) {
        throw stageFailure("OBSERVATION", "SERVICE_UNAVAILABLE", "FAIL-PREPARE-001", "attachable prepared revision vanished");
      }
      return this.commitPrepared(ctx, snapshot, anchored, reusePreparedRevision, adoptionAuthority);
    }

    // ---- factual chain + context (§8); NULL TASK LAW (§11) ---------------------------
    const contextBuilder = new ExperienceAppraisalContextBuilderV0({
      reader: this.deps.experienceReader as never,
      stateHashOf: async (s) => stateHash(s)
    });
    const contextResult = await contextBuilder.build({ episode_ref: input.episode_ref }, snapshot);
    if (!contextResult.ok) {
      if (contextResult.code === "INSUFFICIENT_CONTEXT") {
        return { kind: "DONE", result: { kind: "INSUFFICIENT_CONTEXT", detail: contextResult.detail } };
      }
      throw stageFailure("OBSERVATION", "UNSUPPORTED_EVIDENCE_REF", "LLM-EVID-001", `appraisal context unresolved: ${contextResult.detail}`);
    }
    const context = contextResult.context;
    if (context.subject_id !== (ctx.subject_id as string)) {
      throw stageFailure("OBSERVATION", "UNKNOWN_SUBJECT", "SS-AUTH-001", "appraisal context subject does not match the runtime subject");
    }

    // PRE_COGNITION_CANONICAL_APPRAISAL_V0 (§27/§28): if the grounding factual
    // event already owns a canonical event-grounded INITIAL (created BEFORE
    // cognition), the Experience path RESOLVES/REUSES it — never a second
    // INITIAL, never a provider call (§37 replay law applies unchanged).
    const eventGrounded = await findInitialFactualEventAppraisalV0(
      repository, currentRevision as never, ctx.subject_id as string, context.event_ref as string
    );
    if (eventGrounded.kind === "INTEGRITY_FAILURE") {
      throw stageFailure("OBSERVATION", "INVARIANT_VIOLATION", "SS-SCHEMA-001", eventGrounded.detail);
    }
    if (eventGrounded.kind === "FOUND") {
      return {
        kind: "DONE",
        result: {
          kind: "ALREADY_COMPLETED",
          appraisal_ref: eventGrounded.appraisal_ref,
          payload_hash: eventGrounded.payload_hash,
          record: eventGrounded.record as unknown as ExperienceAppraisalRecordV0,
          grounding: "factual_event"
        }
      };
    }

    // ---- §23/§48: existing canonical INITIAL ⇒ replay (+0), before provider ---------
    const existing = await findInitialExperienceAppraisalV0(
      repository, currentRevision as never, ctx.subject_id as string, context.experience_ref
    );
    if (existing.kind === "INTEGRITY_FAILURE") {
      throw stageFailure("OBSERVATION", "INVARIANT_VIOLATION", "SS-SCHEMA-001", existing.detail);
    }
    if (existing.kind === "FOUND") {
      return {
        kind: "DONE",
        result: {
          kind: "ALREADY_COMPLETED",
          appraisal_ref: existing.appraisal_ref,
          payload_hash: existing.payload_hash,
          record: existing.record
        }
      };
    }

    // ---- provider invocation (input deep-frozen by construction) ----------------------
    let rawProposal: unknown;
    try {
      rawProposal = await provider.proposeExperienceAppraisal(context);
    } catch {
      throw stageFailure("OBSERVATION", "SERVICE_UNAVAILABLE", "FAIL-SERVICE-001", "experience appraisal provider failed");
    }
    // §15/§16: the raw provider result is untrusted — closed validation BEFORE admission.
    const checkedProposal = validateExperienceAppraisalProposalV0(rawProposal);
    if (!checkedProposal.ok) {
      throw stageFailure("OBSERVATION", "INVALID_SCHEMA", "SS-SCHEMA-001", `experience appraisal proposal rejected: ${checkedProposal.error.detail}`);
    }
    const validated = checkedProposal.value;
    if (validated.status !== "APPRAISED") {
      return { kind: "DONE", result: { kind: "INSUFFICIENT_CONTEXT", detail: "provider abstained (INSUFFICIENT_CONTEXT)" } };
    }
    const appraised = validated as AppraisedProposalV0;

    // ---- admission: echo/hash/evidence/allowlist checks (§18/§19) ----------------------
    if (appraised.subject_id !== (ctx.subject_id as string)) {
      throw stageFailure("OBSERVATION", "UNKNOWN_SUBJECT", "SS-AUTH-001", "proposal subject does not match the runtime subject");
    }
    if (appraised.experience_ref !== context.experience_ref) {
      throw stageFailure("OBSERVATION", "UNSUPPORTED_EVIDENCE_REF", "LLM-EVID-001", "proposal experience_ref does not match the evaluated Experience");
    }
    if (appraised.context_projection_hash !== context.context_projection_hash) {
      throw stageFailure("OBSERVATION", "INVALID_SCHEMA", "SS-SCHEMA-001", "proposal answers a different context projection (stale or foreign hash)");
    }
    const allowlist = new Set<string>([
      context.experience_ref,
      context.episode_ref,
      context.event_ref,
      context.source_observation_ref,
      context.outcome_ref,
      context.actor_ref
    ]);
    for (const ref of appraised.evidence_refs) {
      if (!allowlist.has(ref)) {
        throw stageFailure(
          "OBSERVATION",
          "UNSUPPORTED_EVIDENCE_REF",
          "LLM-EVID-001",
          `appraisal proposal cites ${ref} outside the verified grounding allowlist`
        );
      }
    }

    // ---- §22 temporal law: evaluation time >= outcome time ------------------------------
    if ((anchored.current_logical_time as number) < context.outcome_logical_time) {
      throw stageFailure("OBSERVATION", "INVALID_LOGICAL_TIME", "TIME-OCCURRENCE-001", "appraisal precedes the Experience outcome (no same-transition self-feedback)");
    }

    // ---- stale head re-verification AFTER provider return (§20) -------------------------
    const fresh = await this.deps.subjectCore.readCurrentSnapshot(ctx.subject_id);
    if (fresh === null) {
      return { kind: "STALE" };
    }
    const freshStateHash = await stateHash(fresh);
    const preStateHash = await stateHash(snapshot);
    const stale =
      fresh.runtime_metadata.state_revision !== snapshot.runtime_metadata.state_revision ||
      freshStateHash !== preStateHash ||
      fresh.memory_state.repository_revision !== currentRevision ||
      fresh.context.task !== snapshot.context.task ||
      fresh.identity.subject_id !== snapshot.identity.subject_id;
    if (stale) {
      return { kind: "STALE" };
    }

    // ---- construct the canonical record (system owns ALL authority metadata) -----------
    const proposalHash = await deriveExperienceAppraisalProposalHashV0({
      context_projection_hash: appraised.context_projection_hash,
      dimensions: appraised.dimensions,
      assessment_confidence: appraised.assessment_confidence,
      evidence_refs: appraised.evidence_refs
    });
    const transitionId = await deriveExperienceAppraisalTransitionId({
      subject_id: ctx.subject_id as string,
      experience_ref: context.experience_ref,
      expected_state_revision: anchored.state_revision as number,
      rebuild_ordinal: rebuildOrdinal
    });
    const recordBody = {
      schema_version: "experience-appraisal-record-v0" as const,
      appraisal_kind: "INITIAL" as const,
      subject_id: ctx.subject_id as string,
      experience_ref: context.experience_ref,
      experience_payload_hash: context.experience_payload_hash,
      grounding: {
        source_episode_ref: context.episode_ref,
        source_episode_payload_hash: context.episode_payload_hash,
        source_event_ref: context.event_ref,
        source_event_payload_hash: context.event_payload_hash,
        outcome_ref: context.outcome_ref,
        behavior_delivery_id: context.behavior_delivery_id,
        behavior_payload_hash: context.behavior_payload_hash
      },
      evaluated_at_logical_time: anchored.current_logical_time as number,
      source_state: {
        state_revision: snapshot.runtime_metadata.state_revision as number,
        state_hash: preStateHash,
        repository_revision: currentRevision
      },
      subject_context: {
        schema_version: "experience-appraisal-subject-context-v0" as const,
        current_task: context.current_task
      },
      context_projection_hash: context.context_projection_hash,
      dimensions: appraised.dimensions,
      assessment_confidence: appraised.assessment_confidence,
      evidence_refs: appraised.evidence_refs,
      provenance: {
        provider_id: input.provider_id as string,
        provider_contract_version: EXPERIENCE_APPRAISAL_PROVIDER_CONTRACT_VERSION,
        proposal_hash: proposalHash,
        transition_id: transitionId
      }
    };
    const appraisalRef = await deriveExperienceAppraisalRefV0(recordBody);
    const record = Object.freeze({ ...recordBody, appraisal_ref: appraisalRef }) as unknown as ExperienceAppraisalRecordV0;
    // §17: validate the complete canonical record and require exact self-ref
    // equality BEFORE repository storage — reader-time validation is not the
    // first real check.
    const recordChecked = validateExperienceAppraisalRecordV0(record);
    if (!recordChecked.ok) {
      throw stageFailure("OBSERVATION", "INVALID_SCHEMA", "SS-SCHEMA-001", `appraisal record invalid: ${recordChecked.error.detail}`);
    }
    if (recordChecked.value.appraisal_ref !== appraisalRef) {
      throw stageFailure("OBSERVATION", "INVALID_SCHEMA", "SS-SCHEMA-001", "appraisal ref does not re-derive from the admitted body");
    }

    // ---- repository payload + intent-driven prepare -------------------------------------
    const intentId = await deriveExperienceAppraisalIntentId({
      subject_id: ctx.subject_id as string,
      experience_ref: context.experience_ref,
      expected_state_revision: anchored.state_revision as number,
      rebuild_ordinal: rebuildOrdinal
    });
    let preparedRevision: string | null;
    try {
      const payloadHash = await repository.storePayload(appraisalRef, record);
      const intent: MemoryPrepareIntentV1 = {
        intent_id: intentId as never,
        parent_revision: snapshot.memory_state.repository_revision,
        records: [{ ref: appraisalRef, payload_hash: payloadHash }]
      };
      const prepared = await repository.prepareRevisionForIntent(intent);
      preparedRevision = prepared.repository_revision as string;
    } catch (error) {
      if (error instanceof TransitionStageFailure) throw error;
      throw new TransitionStageFailure("OBSERVATION", "SERVICE_UNAVAILABLE", "FAIL-PREPARE-001", "appraisal repository prepare failed (fail closed)", { cause: error });
    }
    if (preparedRevision === null || preparedRevision === currentRevision) {
      throw stageFailure("OBSERVATION", "INVALID_MEMORY_REVISION", "MEM-REV-001", "prepared candidate revision must differ from the bound revision");
    }

    // ---- repository bindings: sorted distinct union of current + next --------------------
    const bindingRevisions = [...new Set([currentRevision, preparedRevision])].sort();
    const repositoryBindings = [];
    for (const revision of bindingRevisions) {
      const manifest = await repository.readManifest(revision as never);
      if (manifest === null) {
        throw stageFailure("OBSERVATION", "SERVICE_UNAVAILABLE", "FAIL-PREPARE-001", `repository cannot prove a manifest for revision ${revision}`);
      }
      repositoryBindings.push({
        repository_revision: revision as never,
        repository_revision_hash: await computeRepositoryRevisionHash(manifest)
      });
    }

    // ---- Learning-owned memory-content delta (exactly the binding change) ---------
    const memoryDelta: DomainDeltaV0 = {
      producer: "memory",
      domain: "memory-content",
      expected_repository_revision: snapshot.memory_state.repository_revision as never,
      operations: [
        { path: "/memory_state/repository_revision", value: preparedRevision as never }
      ],
      provenance_refs: []
    } as unknown as DomainDeltaV0;

    // ---- canonical proposal + reservation + single atomic adoption ----------------
    const canonicalProposal = {
      schema_version: "canonical-transition-proposal-v1",
      transition_id: transitionId,
      subject_id: anchored.subject_id,
      transition_type: "Learning",
      expected_state_revision: anchored.state_revision as number,
      time_input: {
        kind: "OCCURRENCE",
        occurrence_logical_time: anchored.current_logical_time as number
      },
      cause_refs: [appraisalRef],
      domain_deltas: [memoryDelta],
      external_refs: []
    } as unknown as CanonicalTransitionProposalV1;
    const payloadFingerprintValue = await proposalFingerprint(canonicalProposal);

    const reserved = await this.deps.subjectCore.reserveAndRoute(canonicalProposal);
    switch (reserved.kind) {
      case "CONTINUE":
        break;
      case "ALREADY_COMMITTED": {
        const bundle = reserved.bundle;
        const boundRevision = bundle.next_snapshot.memory_state.repository_revision as string;
        const proves =
          bundle.subject_id === (anchored.subject_id as never) &&
          bundle.transition_type === "Learning" &&
          bundle.repository_revision_bindings.some((b) => (b.repository_revision as string) === boundRevision);
        if (proves && !adoptionAuthority.isAdopted(boundRevision as never)) {
          adoptionAuthority.markAdopted(boundRevision as never);
        }
        return {
          kind: "DONE",
          result: {
            kind: "COMMITTED",
            appraisal_ref: appraisalRef,
            payload_hash: await repository.payloadHashOf(appraisalRef) as HashV1,
            memory_revision: boundRevision
          }
        };
      }
      case "TERMINAL_NO_OP":
        return { kind: "DONE", result: { kind: "NO_OP" } };
      case "REUSE_CONFLICT":
        return {
          kind: "DONE",
          result: {
            kind: "REJECTED",
            failure: { error_code: "TRANSITION_ID_REUSE", reason: "IDEM-REUSE-001", detail: "appraisal transition id reuse with changed payload" }
          }
        };
    }

    const outcome: CommitReservedOutcome = await this.deps.subjectCore.commitReserved({
      proposal: canonicalProposal,
      continuation: reserved.continuation,
      producerAuthorization: this.deps.producerAuthorizationIssuer.issue([
        { producer: "memory", domain: "memory-content" }
      ]),
      preparedBinding: {
        prepared_result_ref: `workflow:w-appr-${transitionId.replace("t-learn-", "")}` as never,
        transition_id: canonicalProposal.transition_id,
        subject_id: canonicalProposal.subject_id,
        transition_type: canonicalProposal.transition_type,
        payload_fingerprint: payloadFingerprintValue
      },
      repository_bindings: repositoryBindings as never
    });
    if (outcome.kind === "COMMITTED") {
      adoptionAuthority.markAdopted(preparedRevision as never);
      return {
        kind: "DONE",
        result: {
          kind: "COMMITTED",
          appraisal_ref: appraisalRef,
          payload_hash: await repository.payloadHashOf(appraisalRef) as HashV1,
          memory_revision: preparedRevision
        }
      };
    }
    if (outcome.kind === "REJECTED" && outcome.failure.error_code === "STALE_STATE_REVISION") {
      return { kind: "STALE", preparedRevision: preparedRevision ?? undefined };
    }
    if (outcome.kind === "REJECTED") {
      return { kind: "DONE", result: { kind: "REJECTED", failure: outcome.failure } };
    }
    return { kind: "DONE", result: { kind: "NO_OP" } };
  }

  /** Commits an already-prepared revision (attachable stale-rebuild reuse). */
  private async commitPrepared(
    ctx: RuntimeContext,
    snapshot: SubjectStateV0,
    anchored: RuntimeContext,
    preparedRevision: string,
    adoptionAuthority: NonNullable<RuntimeDependencyContainer["learningAdoptionAuthority"]>
  ): Promise<AttemptOutcome> {
    const repository = this.deps.memory.repository;
    const currentRevision = snapshot.memory_state.repository_revision as string;
    if (preparedRevision === currentRevision) {
      throw stageFailure("OBSERVATION", "INVALID_MEMORY_REVISION", "MEM-REV-001", "prepared candidate revision must differ from the bound revision");
    }

    const bindingRevisions = [...new Set([currentRevision, preparedRevision])].sort();
    const repositoryBindings = [];
    for (const revision of bindingRevisions) {
      const manifest = await repository.readManifest(revision as never);
      if (manifest === null) {
        throw stageFailure("OBSERVATION", "SERVICE_UNAVAILABLE", "FAIL-PREPARE-001", `repository cannot prove a manifest for revision ${revision}`);
      }
      repositoryBindings.push({
        repository_revision: revision as never,
        repository_revision_hash: await computeRepositoryRevisionHash(manifest)
      });
    }

    // Find the appraisal ref from the prepared manifest (single appraisal record).
    const preparedManifest = await repository.readManifest(preparedRevision as never);
    if (preparedManifest === null) {
      throw stageFailure("OBSERVATION", "SERVICE_UNAVAILABLE", "FAIL-PREPARE-001", "attachable prepared revision vanished");
    }
    const appraisalEntry = preparedManifest.record_hashes.find((r) => r.ref.startsWith("appraisal:"));
    if (appraisalEntry === undefined) {
      throw stageFailure("OBSERVATION", "SERVICE_UNAVAILABLE", "FAIL-PREPARE-001", "attachable prepared revision has no appraisal record");
    }
    const appraisalRef = appraisalEntry.ref;

    const memoryDelta: DomainDeltaV0 = {
      producer: "memory",
      domain: "memory-content",
      expected_repository_revision: snapshot.memory_state.repository_revision as never,
      operations: [
        { path: "/memory_state/repository_revision", value: preparedRevision as never }
      ],
      provenance_refs: []
    } as unknown as DomainDeltaV0;

    // §20 transition-id bug repair: the identity must bind the EXPERIENCE
    // identity (not the appraisal ref). Recover it from the prepared record —
    // read via the executor's canonical repository face (the composition-owned
    // preparation wrapper has no raw payload face).
    const payloadRepository: InMemoryMemoryRepository = this.deps.experienceAppraisalStore as never;
    const reusePayload = payloadRepository.readStoredPayload(appraisalRef);
    if (reusePayload === undefined || reusePayload === null) {
      throw stageFailure("OBSERVATION", "INVALID_MEMORY_REVISION", "MEM-REV-001", "attachable prepared revision has no appraisal payload");
    }
    const reuseChecked = validateExperienceAppraisalRecordV0(reusePayload);
    if (!reuseChecked.ok) {
      throw stageFailure("OBSERVATION", "INVALID_MEMORY_REVISION", "MEM-REV-001", "attachable prepared revision has a malformed appraisal record");
    }
    const transitionId = await deriveExperienceAppraisalTransitionId({
      subject_id: ctx.subject_id as string,
      experience_ref: reuseChecked.value.experience_ref,
      expected_state_revision: anchored.state_revision as number,
      rebuild_ordinal: 0
    });
    const canonicalProposal = {
      schema_version: "canonical-transition-proposal-v1",
      transition_id: transitionId,
      subject_id: anchored.subject_id,
      transition_type: "Learning",
      expected_state_revision: anchored.state_revision as number,
      time_input: {
        kind: "OCCURRENCE",
        occurrence_logical_time: anchored.current_logical_time as number
      },
      cause_refs: [appraisalRef],
      domain_deltas: [memoryDelta],
      external_refs: []
    } as unknown as CanonicalTransitionProposalV1;
    const payloadFingerprintValue = await proposalFingerprint(canonicalProposal);

    const reserved = await this.deps.subjectCore.reserveAndRoute(canonicalProposal);
    if (reserved.kind === "ALREADY_COMMITTED") {
      const bundle = reserved.bundle;
      const boundRevision = bundle.next_snapshot.memory_state.repository_revision as string;
      if (!adoptionAuthority.isAdopted(boundRevision as never)) {
        adoptionAuthority.markAdopted(boundRevision as never);
      }
      return {
        kind: "DONE",
        result: {
          kind: "COMMITTED",
          appraisal_ref: appraisalRef,
          payload_hash: await repository.payloadHashOf(appraisalRef) as HashV1,
          memory_revision: boundRevision
        }
      };
    }
    if (reserved.kind !== "CONTINUE") {
      return { kind: "DONE", result: { kind: "NO_OP" } };
    }

    const outcome = await this.deps.subjectCore.commitReserved({
      proposal: canonicalProposal,
      continuation: reserved.continuation,
      producerAuthorization: this.deps.producerAuthorizationIssuer.issue([
        { producer: "memory", domain: "memory-content" }
      ]),
      preparedBinding: {
        prepared_result_ref: `workflow:w-appr-${transitionId.replace("t-learn-", "")}` as never,
        transition_id: canonicalProposal.transition_id,
        subject_id: canonicalProposal.subject_id,
        transition_type: canonicalProposal.transition_type,
        payload_fingerprint: payloadFingerprintValue
      },
      repository_bindings: repositoryBindings as never
    });
    if (outcome.kind === "COMMITTED") {
      adoptionAuthority.markAdopted(preparedRevision as never);
      return {
        kind: "DONE",
        result: {
          kind: "COMMITTED",
          appraisal_ref: appraisalRef,
          payload_hash: await repository.payloadHashOf(appraisalRef) as HashV1,
          memory_revision: preparedRevision
        }
      };
    }
    if (outcome.kind === "REJECTED" && outcome.failure.error_code === "STALE_STATE_REVISION") {
      return { kind: "STALE", preparedRevision };
    }
    if (outcome.kind === "REJECTED") {
      return { kind: "DONE", result: { kind: "REJECTED", failure: outcome.failure } };
    }
    return { kind: "DONE", result: { kind: "NO_OP" } };
  }
}

function rebaseRequired(detail: string): ExperienceAppraisalExecutionResultV0 {
  return {
    kind: "REBASE_REQUIRED",
    failure: { error_code: "STALE_STATE_REVISION", reason: "REBASE-STALE-001", detail }
  };
}


async function deriveExperienceAppraisalTransitionId(params: {
  readonly subject_id: string;
  readonly experience_ref: string;
  readonly expected_state_revision: number;
  readonly rebuild_ordinal: number;
}): Promise<string> {
  const digest = await hashEnvelope("characteros-next/runtime/experience-appraisal-transition-id/v1", params);
  return `t-learn-${digest.replace(/^sha256:/, "")}`;
}

async function deriveExperienceAppraisalIntentId(params: {
  readonly subject_id: string;
  readonly experience_ref: string;
  readonly expected_state_revision: number;
  readonly rebuild_ordinal: number;
}): Promise<string> {
  const digest = await hashEnvelope("characteros-next/memory/experience-appraisal-prepare-intent/v1", params);
  return `li-${digest.replace(/^sha256:/, "")}`;
}
