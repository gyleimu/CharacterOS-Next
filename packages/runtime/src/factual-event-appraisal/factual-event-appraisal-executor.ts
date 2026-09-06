/**
 * PRE_COGNITION_CANONICAL_APPRAISAL_V0 — bounded production executor.
 *
 * The ONE production entrypoint for the pre-cognition Appraisal lifecycle:
 *
 *   verified factual-event grounding (ConversationFactualEventAuthorityV0)
 *   → context build (null-task law)
 *   → existing-INITIAL check (replay)
 *   → provider → closed validation → echo/evidence admission checks
 *   → stale head re-verification (bounded: attempt 0 → rebuild → attempt 1)
 *   → canonical record → repository prepare → Learning commit (memory-content
 *   ONLY) → adoption.
 *
 * AUTHORITY: the provider proposes only dimensions/confidence/evidence; the
 * system constructs every authority field (subject, event grounding,
 * observation lineage, times, state anchors, provenance, self-ref). Only
 * /memory_state/repository_revision changes. This Appraisal is SHADOW with
 * respect to Affect (§25): no Affect-domain write, no second Affect writer.
 */

import type {
  CanonicalRefV0,
  DomainDeltaV0,
  SubjectStateV0,
  HashV1,
  CanonicalTransitionProposalV1,
  CommitReservedOutcome
} from "@characteros-next/subject-core";
import { hashEnvelope, proposalFingerprint, stateHash } from "@characteros-next/subject-core";
import type { InMemoryMemoryRepository, MemoryPrepareIntentV1 } from "@characteros-next/memory";
import { computeRepositoryRevisionHash } from "@characteros-next/memory";
import {
  deriveFactualEventAppraisalIntentId,
  deriveFactualEventAppraisalProposalHashV0,
  deriveFactualEventAppraisalRefV0,
  validateFactualEventAppraisalProposalV0,
  validateFactualEventAppraisalRecordV0,
  FACTUAL_EVENT_APPRAISAL_PROVIDER_CONTRACT_VERSION,
  type FactualEventAppraisalRecordV0
} from "@characteros-next/appraisal";
import type { RuntimeContext } from "../types/runtime-context.js";
import type { RuntimeDependencyContainer } from "../types/runtime-dependency-container.js";
import { anchorContext, stageFailure, TransitionStageFailure } from "../transitions/common.js";
import { FactualEventAppraisalContextBuilderV0, type FactualEventGroundingV0 } from "./factual-event-appraisal-context.js";
import { findInitialFactualEventAppraisalV0 } from "./factual-event-appraisal-reader.js";

/** Untrusted runtime input: identity refs only — never appraisal content. */
export interface FactualEventAppraisalInputV0 {
  readonly subject_id: string;
  readonly source_event_id: string;
  readonly observation_transition_id: string;
  readonly observation_ref: CanonicalRefV0;
}

export type FactualEventAppraisalExecutionResultV0 =
  | {
      readonly kind: "COMMITTED";
      readonly appraisal_ref: CanonicalRefV0;
      readonly payload_hash: HashV1;
      readonly memory_revision: string;
    }
  | {
      readonly kind: "ALREADY_COMPLETED";
      readonly appraisal_ref: CanonicalRefV0;
      readonly payload_hash: HashV1;
      readonly record: FactualEventAppraisalRecordV0;
    }
  | {
      /** §18: null task or provider abstention — zero canonical change. */
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
  readonly result?: FactualEventAppraisalExecutionResultV0;
  readonly preparedRevision?: string;
}

const STAGE = "OBSERVATION" as const;

function rebaseRequired(detail: string): FactualEventAppraisalExecutionResultV0 {
  return {
    kind: "REBASE_REQUIRED",
    failure: { error_code: "STALE_STATE_REVISION", reason: "REBASE-STALE-001", detail }
  };
}

async function deriveTransitionId(params: {
  readonly subject_id: string;
  readonly factual_event_ref: string;
  readonly expected_state_revision: number;
  readonly rebuild_ordinal: number;
}): Promise<string> {
  const digest = await hashEnvelope("characteros-next/runtime/factual-event-appraisal-transition-id/v1", params);
  return `t-learn-${digest.replace(/^sha256:/, "")}`;
}

/** Bounded production executor. One stale rebuild is permitted; a second
 * stale is the frozen terminal REBASE_REQUIRED (existing bounded pattern). */
export class FactualEventAppraisalExecutorV0 {
  constructor(private readonly deps: RuntimeDependencyContainer) {}

  async appraiseIncomingEvent(
    ctx: RuntimeContext,
    input: FactualEventAppraisalInputV0
  ): Promise<FactualEventAppraisalExecutionResultV0> {
    const provider = this.deps.factualEventAppraisalProvider;
    if (provider === null) {
      throw stageFailure(STAGE, "SERVICE_UNAVAILABLE", "FAIL-PRECOMMIT-001", "factual event appraisal provider not wired");
    }
    if (this.deps.experienceAppraisalStore === null) {
      throw stageFailure(STAGE, "SERVICE_UNAVAILABLE", "FAIL-PRECOMMIT-001", "factual event appraisal store not wired");
    }
    if (this.deps.learningAdoptionAuthority === null) {
      throw stageFailure(STAGE, "SERVICE_UNAVAILABLE", "FAIL-PRECOMMIT-001", "learning adoption authority not wired");
    }
    if (this.deps.factualEventAuthority === null) {
      throw stageFailure(STAGE, "SERVICE_UNAVAILABLE", "FAIL-PRECOMMIT-001", "conversation factual event authority not wired");
    }

    const first = await this.runAttempt(ctx, input, provider, 0, null);
    if (first.kind === "DONE") return first.result as FactualEventAppraisalExecutionResultV0;

    // ---- bounded single stale rebuild (existing pattern, §32) ---------------------
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
    if (rebuilt.kind === "DONE") return rebuilt.result as FactualEventAppraisalExecutionResultV0;
    return rebaseRequired("second stale rejection after the single permitted rebuild");
  }

  private async runAttempt(
    ctx: RuntimeContext,
    input: FactualEventAppraisalInputV0,
    provider: NonNullable<RuntimeDependencyContainer["factualEventAppraisalProvider"]>,
    rebuildOrdinal: number,
    reusePreparedRevision: string | null
  ): Promise<AttemptOutcome> {
    const adoptionAuthority = this.deps.learningAdoptionAuthority;
    if (adoptionAuthority === null) {
      throw stageFailure(STAGE, "SERVICE_UNAVAILABLE", "FAIL-PRECOMMIT-001", "learning adoption authority not wired");
    }
    const repository: InMemoryMemoryRepository = this.deps.experienceAppraisalStore as never;
    const authority = this.deps.factualEventAuthority as NonNullable<RuntimeDependencyContainer["factualEventAuthority"]>;

    // ---- one authoritative canonical basis ------------------------------------------
    const snapshot = await this.deps.subjectCore.readCurrentSnapshot(ctx.subject_id);
    if (snapshot === null) {
      throw stageFailure(STAGE, "UNKNOWN_SUBJECT", "SS-AUTH-001", `subject ${ctx.subject_id} not found`);
    }
    const anchored = anchorContext(ctx, snapshot, STAGE);
    const currentRevision = snapshot.memory_state.repository_revision as string;

    // ---- reuse an attachable prepared revision (stale rebuild path) ------------------
    if (reusePreparedRevision !== null) {
      const manifest = await repository.readManifest(reusePreparedRevision as never);
      if (manifest === null) {
        throw stageFailure(STAGE, "SERVICE_UNAVAILABLE", "FAIL-PREPARE-001", "attachable prepared revision vanished");
      }
      return this.commitPrepared(ctx, snapshot, anchored, reusePreparedRevision, adoptionAuthority);
    }

    // ---- §6/§7 factual grounding through the frozen authority ------------------------
    const resolution = await authority.resolveObservationEvent({
      subject_id: input.subject_id,
      observation_transition_id: input.observation_transition_id,
      observation_ref: input.observation_ref
    });
    if (!resolution.ok) {
      throw stageFailure(STAGE, "UNSUPPORTED_EVIDENCE_REF", "LLM-EVID-001", `factual event grounding failed (${resolution.code}): ${resolution.detail}`);
    }
    const bundle = await this.deps.learningSourceAuthority?.readCommittedBundle(input.observation_transition_id);
    if (bundle === undefined || bundle === null) {
      throw stageFailure(STAGE, "INVALID_STAGE_DEPENDENCY", "MICL-STAGE-001", `committed Observation bundle ${input.observation_transition_id} unavailable`);
    }
    const grounding: FactualEventGroundingV0 = {
      subject_id: input.subject_id,
      factual_event_ref: resolution.factual_event_ref as string,
      factual_event_payload_hash: resolution.event_payload_hash as string,
      source_observation_ref: input.observation_ref as string,
      source_observation_transition_id: input.observation_transition_id,
      source_admission_history_sequence: bundle.trace_entry.history_sequence as number
    };

    // ---- §17 context (null-task law) ---------------------------------------------------
    const contextBuilder = new FactualEventAppraisalContextBuilderV0(stateHash);
    const contextResult = await contextBuilder.build({ grounding, snapshot });
    if (!contextResult.ok) {
      return { kind: "DONE", result: { kind: "INSUFFICIENT_CONTEXT", detail: contextResult.detail } };
    }
    const context = contextResult.context;
    if (context.subject_id !== (ctx.subject_id as string)) {
      throw stageFailure(STAGE, "UNKNOWN_SUBJECT", "SS-AUTH-001", "appraisal context subject does not match the runtime subject");
    }

    // ---- §19/§20: existing canonical INITIAL ⇒ replay (+0), before provider -----------
    const existing = await findInitialFactualEventAppraisalV0(
      repository, currentRevision as never, ctx.subject_id as string, context.factual_event_ref as string
    );
    if (existing.kind === "INTEGRITY_FAILURE") {
      throw stageFailure(STAGE, "INVARIANT_VIOLATION", "SS-SCHEMA-001", existing.detail);
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

    // ---- provider invocation (input frozen by construction) ----------------------------
    let rawProposal: unknown;
    try {
      rawProposal = await provider.proposeFactualEventAppraisal(context);
    } catch (error) {
      throw stageFailure(STAGE, "SERVICE_UNAVAILABLE", "FAIL-SERVICE-001", `factual event appraisal provider failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    // §11: the raw provider result is untrusted — closed validation BEFORE admission.
    const checkedProposal = validateFactualEventAppraisalProposalV0(rawProposal);
    if (!checkedProposal.ok) {
      throw stageFailure(STAGE, "INVALID_SCHEMA", "SS-SCHEMA-001", `factual event appraisal proposal rejected: ${checkedProposal.error.detail}`);
    }
    const validated = checkedProposal.value;
    if (validated.status !== "APPRAISED") {
      return { kind: "DONE", result: { kind: "INSUFFICIENT_CONTEXT", detail: "provider abstained (INSUFFICIENT_CONTEXT)" } };
    }

    // ---- admission: echo/hash/evidence checks (§10/§15) --------------------------------
    if (validated.subject_id !== (ctx.subject_id as string)) {
      throw stageFailure(STAGE, "UNKNOWN_SUBJECT", "SS-AUTH-001", "proposal subject does not match the runtime subject");
    }
    if (validated.factual_event_ref !== context.factual_event_ref) {
      throw stageFailure(STAGE, "UNSUPPORTED_EVIDENCE_REF", "LLM-EVID-001", "proposal factual_event_ref does not match the evaluated event");
    }
    if (validated.context_projection_hash !== context.context_projection_hash) {
      throw stageFailure(STAGE, "INVALID_SCHEMA", "SS-SCHEMA-001", "proposal answers a different context projection (stale or foreign hash)");
    }
    // §15 narrowest lawful evidence boundary: the admitted factual observation
    // and the verified factual event — nothing else exists before cognition.
    const allowlist = new Set<string>([context.factual_event_ref as string, context.source_observation_ref as string]);
    for (const ref of validated.evidence_refs) {
      if (!allowlist.has(ref as string)) {
        throw stageFailure(STAGE, "UNSUPPORTED_EVIDENCE_REF", "LLM-EVID-001", `appraisal proposal cites ${ref} outside the pre-cognition grounding allowlist`);
      }
    }

    // ---- stale head re-verification AFTER provider return (§32) -------------------------
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
    const proposalHash = await deriveFactualEventAppraisalProposalHashV0({
      context_projection_hash: validated.context_projection_hash,
      dimensions: validated.dimensions,
      assessment_confidence: validated.assessment_confidence,
      evidence_refs: validated.evidence_refs
    });
    const transitionId = await deriveTransitionId({
      subject_id: ctx.subject_id as string,
      factual_event_ref: context.factual_event_ref as string,
      expected_state_revision: anchored.state_revision as number,
      rebuild_ordinal: rebuildOrdinal
    });
    const recordBody = {
      schema_version: "factual-event-appraisal-record-v0" as const,
      semantic_appraisal_episode: "INITIAL" as const,
      subject_id: ctx.subject_id as string,
      factual_event_ref: context.factual_event_ref,
      factual_event_payload_hash: context.factual_event_payload_hash,
      source_observation_ref: context.source_observation_ref,
      source_observation_transition_id: context.source_observation_transition_id,
      source_admission_history_sequence: context.source_admission_history_sequence,
      subject_state: {
        state_revision: snapshot.runtime_metadata.state_revision as number,
        state_hash: preStateHash,
        repository_revision: currentRevision
      },
      evaluated_at_logical_time: anchored.current_logical_time as number,
      subject_context: {
        schema_version: "experience-appraisal-subject-context-v0" as const,
        current_task: context.current_task as string
      },
      context_projection_hash: context.context_projection_hash,
      dimensions: validated.dimensions,
      assessment_confidence: validated.assessment_confidence,
      evidence_refs: validated.evidence_refs,
      provenance: {
        provider_id: "factual-event-appraisal-provider" as const,
        provider_contract_version: FACTUAL_EVENT_APPRAISAL_PROVIDER_CONTRACT_VERSION,
        proposal_hash: proposalHash,
        transition_id: transitionId
      }
    };
    const appraisalRef = await deriveFactualEventAppraisalRefV0(recordBody);
    const record = Object.freeze({ ...recordBody, appraisal_ref: appraisalRef }) as unknown as FactualEventAppraisalRecordV0;
    // §39: validate the complete canonical record and require exact self-ref
    // equality BEFORE repository storage.
    const recordChecked = validateFactualEventAppraisalRecordV0(record);
    if (!recordChecked.ok) {
      throw stageFailure(STAGE, "INVALID_SCHEMA", "SS-SCHEMA-001", `appraisal record invalid: ${recordChecked.error.detail}`);
    }
    if (recordChecked.value.appraisal_ref !== appraisalRef) {
      throw stageFailure(STAGE, "INVALID_SCHEMA", "SS-SCHEMA-001", "appraisal ref does not re-derive from the admitted body");
    }

    // ---- repository payload + intent-driven prepare --------------------------------------
    const intentId = await deriveFactualEventAppraisalIntentId({
      subject_id: ctx.subject_id as string,
      factual_event_ref: context.factual_event_ref as string,
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
      throw new TransitionStageFailure(STAGE, "SERVICE_UNAVAILABLE", "FAIL-PREPARE-001", "appraisal repository prepare failed (fail closed)", { cause: error });
    }
    if (preparedRevision === null || preparedRevision === currentRevision) {
      throw stageFailure(STAGE, "INVALID_MEMORY_REVISION", "MEM-REV-001", "prepared candidate revision must differ from the bound revision");
    }

    // ---- repository bindings: sorted distinct union of current + next --------------------
    const bindingRevisions = [...new Set([currentRevision, preparedRevision])].sort();
    const repositoryBindings = [];
    for (const revision of bindingRevisions) {
      const manifest = await repository.readManifest(revision as never);
      if (manifest === null) {
        throw stageFailure(STAGE, "SERVICE_UNAVAILABLE", "FAIL-PREPARE-001", `repository cannot prove a manifest for revision ${revision}`);
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
      cause_refs: [appraisalRef, context.factual_event_ref].sort(),
      domain_deltas: [memoryDelta],
      external_refs: []
    } as unknown as CanonicalTransitionProposalV1;
    const payloadFingerprintValue = await proposalFingerprint(canonicalProposal);

    const reserved = await this.deps.subjectCore.reserveAndRoute(canonicalProposal);
    switch (reserved.kind) {
      case "CONTINUE":
        break;
      case "ALREADY_COMMITTED": {
        const committedBundle = reserved.bundle;
        const boundRevision = committedBundle.next_snapshot.memory_state.repository_revision as string;
        const proves =
          committedBundle.subject_id === (anchored.subject_id as never) &&
          committedBundle.transition_type === "Learning" &&
          committedBundle.repository_revision_bindings.some((b) => (b.repository_revision as string) === boundRevision);
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
        prepared_result_ref: `workflow:w-feappr-${transitionId.replace("t-learn-", "")}` as never,
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
    const repository: InMemoryMemoryRepository = this.deps.experienceAppraisalStore as never;
    const currentRevision = snapshot.memory_state.repository_revision as string;
    if (preparedRevision === currentRevision) {
      throw stageFailure(STAGE, "INVALID_MEMORY_REVISION", "MEM-REV-001", "prepared candidate revision must differ from the bound revision");
    }

    const bindingRevisions = [...new Set([currentRevision, preparedRevision])].sort();
    const repositoryBindings = [];
    for (const revision of bindingRevisions) {
      const manifest = await repository.readManifest(revision as never);
      if (manifest === null) {
        throw stageFailure(STAGE, "SERVICE_UNAVAILABLE", "FAIL-PREPARE-001", `repository cannot prove a manifest for revision ${revision}`);
      }
      repositoryBindings.push({
        repository_revision: revision as never,
        repository_revision_hash: await computeRepositoryRevisionHash(manifest)
      });
    }

    const preparedManifest = await repository.readManifest(preparedRevision as never);
    if (preparedManifest === null) {
      throw stageFailure(STAGE, "SERVICE_UNAVAILABLE", "FAIL-PREPARE-001", "attachable prepared revision vanished");
    }
    const appraisalEntry = preparedManifest.record_hashes.find((r) => r.ref.startsWith("appraisal:"));
    if (appraisalEntry === undefined) {
      throw stageFailure(STAGE, "SERVICE_UNAVAILABLE", "FAIL-PREPARE-001", "attachable prepared revision has no appraisal record");
    }
    const appraisalRef = appraisalEntry.ref;
    const reusePayload = repository.readStoredPayload(appraisalRef);
    if (reusePayload === undefined || reusePayload === null) {
      throw stageFailure(STAGE, "INVALID_MEMORY_REVISION", "MEM-REV-001", "attachable prepared revision has no appraisal payload");
    }
    const reuseChecked = validateFactualEventAppraisalRecordV0(reusePayload);
    if (!reuseChecked.ok) {
      throw stageFailure(STAGE, "INVALID_MEMORY_REVISION", "MEM-REV-001", "attachable prepared revision has a malformed appraisal record");
    }
    const digest = await hashEnvelope("characteros-next/runtime/factual-event-appraisal-transition-id/v1", {
      subject_id: ctx.subject_id as string,
      factual_event_ref: reuseChecked.value.factual_event_ref,
      expected_state_revision: anchored.state_revision as number,
      rebuild_ordinal: 0
    });
    const transitionId = `t-learn-${digest.replace(/^sha256:/, "")}`;

    const memoryDelta: DomainDeltaV0 = {
      producer: "memory",
      domain: "memory-content",
      expected_repository_revision: snapshot.memory_state.repository_revision as never,
      operations: [
        { path: "/memory_state/repository_revision", value: preparedRevision as never }
      ],
      provenance_refs: []
    } as unknown as DomainDeltaV0;

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
      cause_refs: [appraisalRef, reuseChecked.value.factual_event_ref].sort(),
      domain_deltas: [memoryDelta],
      external_refs: []
    } as unknown as CanonicalTransitionProposalV1;
    const payloadFingerprintValue = await proposalFingerprint(canonicalProposal);

    const reserved = await this.deps.subjectCore.reserveAndRoute(canonicalProposal);
    if (reserved.kind === "ALREADY_COMMITTED") {
      const committedBundle = reserved.bundle;
      const boundRevision = committedBundle.next_snapshot.memory_state.repository_revision as string;
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
        prepared_result_ref: `workflow:w-feappr-${transitionId.replace("t-learn-", "")}` as never,
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
