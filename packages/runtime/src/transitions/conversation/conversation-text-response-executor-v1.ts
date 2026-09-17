/**
 * ConversationTextResponseExecutorV1 — production structured-communication
 * response executor (STRUCTURED_COMMUNICATION_DIRECTIVE_V0).
 *
 * Shares the SAME authoritative cognition machinery as V0 (projection,
 * retrieval, evidence, grounding, NO_OP). Adds:
 *   - ConversationCognitionProviderV1 (ONE model call → nested cognition + directive)
 *   - Directive branching: CLARIFY → host-rendered fixed text (0 language calls)
 *                         REALIZE → existing language realization (1 language call)
 *
 * No branch fallback. No V0 downgrade. No familiarity/evidence shortcut.
 */

import type { IdentifierV0, SubjectStateV0, CanonicalRefV0 } from "@characteros-next/subject-core";
import type { CharacterLanguageBehaviorV0, CommunicationDirectiveV0 } from "@characteros-next/behavior";
import { buildCharacterLanguageBehaviorV0, buildClarificationBehaviorV0, deriveClarificationRealizationInputHashV0 } from "@characteros-next/behavior";
import { hashEnvelope, validateIdentifier } from "@characteros-next/subject-core";

import type { RuntimeDependencyContainer } from "../../types/runtime-dependency-container.js";
import type { TransitionCapabilities } from "../../ports/subject-core-port.js";
import type { RuntimeContext } from "../../types/runtime-context.js";
import { CognitionActionTransitionExecutor } from "../cognition-action/cognition-action-transition-executor.js";
import { createMiclStageMinter } from "../../micl/micl-capabilities.js";
import { InMemoryMiclWorkflowStore } from "../../micl/micl-workflow-store.js";
import { computeRepositoryRevisionHash } from "@characteros-next/memory";
import { FactualEventAppraisalExecutorV0 } from "../../factual-event-appraisal/factual-event-appraisal-executor.js";
import { allowedEvidenceSet, type CognitiveContextProjectionAnyVersion, type CognitionProposalV0 } from "../cognition-action/types.js";
import type { ConversationResponseRequestV0 } from "./conversation-text-response-executor.js";
import { ConversationCognitionProviderV2 } from "../../providers/behavior/conversation-cognition-provider-v2.js";
import {
  createRobustConversationCognitionProviderV8,
  isCognitionOutputDegraded,
  type NormalizationKind
} from "../../providers/behavior/robust-cognition-output-v8.js";
import {
  deriveConversationCognitionProposalHashV8,
  type ClarificationBasisV0,
  type ConversationCognitionProposalV8,
  type SubjectiveSelectionV1
} from "./conversation-cognition-proposal.js";
import type { FactualClaimAuthorizationTraceV0 } from "./factual-claim-authorization.js";
import { validateGenerativeClaimBindingV0 } from "./language-claim-binding.js";
import {
  buildLanguageRealizationInputV1,
  buildLanguageRealizationInputV10,
  type LanguageEpisodeContentV0
} from "./language-realization-input.js";

export const CONVERSATION_TEXT_RESPONSE_EXECUTOR_V1_SCHEMA_VERSION =
  "conversation-text-response-executor-v1" as const;

export type RealizationSourceV0 = "HOST_CLARIFICATION_V0" | "LANGUAGE_PROVIDER_V0";

export interface ConversationResponseTraceV1 {
  /** PRE_COGNITION_CANONICAL_APPRAISAL_V0 — outcome of the pre-cognition
   * factual-event INITIAL Appraisal stage when a factual_event binding was
   * supplied. COMMITTED/ALREADY_COMPLETED/INSUFFICIENT_CONTEXT. */
  readonly factual_appraisal?: {
    readonly outcome: "COMMITTED" | "ALREADY_COMPLETED" | "INSUFFICIENT_CONTEXT";
    readonly appraisal_ref: string;
  };
  readonly communication_directive_kind: string;
  readonly conversation_cognition_proposal_hash: string;
  /**
   * AFFECT_COGNITION_C3_REVALIDATION_V0 — protocol lineage. V4 is the Family C3
   * contract: an explicit turn-local subjective choice, with the projection
   * identity host-bound outside model output.
   */
  readonly conversation_proposal_schema_version?:
    | "conversation-cognition-proposal-v1"
    | "conversation-cognition-proposal-v2"
    | "conversation-cognition-proposal-v3"
    | "conversation-cognition-proposal-v4"
    | "conversation-cognition-proposal-v5"
    | "conversation-cognition-proposal-v6"
    | "conversation-cognition-proposal-v7"
    | "conversation-cognition-proposal-v8";
  readonly factual_authorization_trace?: readonly FactualClaimAuthorizationTraceV0[];
  readonly clarification_basis?: ClarificationBasisV0 | null;
  /**
   * C4.4 diagnostic only: the tagged turn-local subjective selection — the
   * applicability CATEGORY plus (when selected) the stance and its
   * non-authoritative subjective rationale. `cognition.current_intent` is
   * descriptive and is NEVER the selection authority.
   */
  readonly subjective_selection?: SubjectiveSelectionV1;
  readonly cognition_projection_hash: string;
  readonly realization_input_hash: string;
  readonly realization_source: RealizationSourceV0;
}

export type ConversationResponseFailureStageV1 =
  | "REQUEST_INVALID"
  | "APPRAISAL_FAILED"
  | "COGNITION_FAILED"
  | "MEMORY_EVIDENCE_FAILED"
  | "LANGUAGE_TRANSPORT_FAILED"
  | "LANGUAGE_SCHEMA_INVALID"
  | "LANGUAGE_EVIDENCE_INVALID"
  | "LANGUAGE_CLAIM_BINDING_INVALID"
  | "CLARIFICATION_RENDER_INVALID"
  | "STALE_CONTEXT";

export type ConversationTextResponseResultV1 =
  | {
      readonly kind: "OUTPUT_READY";
      readonly behavior: CharacterLanguageBehaviorV0;
      readonly trace: ConversationResponseTraceV1;
    }
  | {
      readonly kind: "FAILED";
      readonly stage: ConversationResponseFailureStageV1;
      readonly detail: string;
      readonly diagnostics?: {
        readonly factual_authorization_trace: readonly FactualClaimAuthorizationTraceV0[];
      };
    }
  | {
      /**
       * PRODUCT OUTPUT ROBUSTNESS: the model could not produce a contract-valid
       * cognition after one bounded regeneration. This is NOT a canonical outcome:
       * no cognition, delivery, Experience or turn advance is written. The host
       * renders a minimal safe reply and the session stays usable.
       */
      readonly kind: "DEGRADED";
      readonly stage: "EXECUTOR_OUTPUT_DEGRADED";
      readonly detail: string;
      readonly attempts: number;
      readonly normalization_applied: readonly NormalizationKind[];
      readonly diagnostics?: {
        readonly factual_authorization_trace: readonly FactualClaimAuthorizationTraceV0[];
      };
    };

/**
 * Deepest typed provider rejection hidden behind a fail-closed stage wrapper. The
 * cognition stage wraps provider errors as SERVICE_UNAVAILABLE/FAIL-SERVICE-001; the
 * conversation boundary still reports which typed rejection (factual authority or
 * response semantics) actually stopped the turn. Diagnostics only — never contract.
 */
function providerRejectionDetail(error: unknown): string | null {
  const seen = new Set<unknown>();
  let detail: string | null = null;
  let current: unknown = error;
  while (current instanceof Error && !seen.has(current)) {
    seen.add(current);
    if (typeof (current as { code?: unknown }).code === "string") detail = current.message;
    current = (current as { cause?: unknown }).cause;
  }
  return detail;
}

function failed(
  stage: ConversationResponseFailureStageV1,
  detail: string,
  factualTrace?: readonly FactualClaimAuthorizationTraceV0[]
): ConversationTextResponseResultV1 {
  return {
    kind: "FAILED",
    stage,
    detail,
    ...(factualTrace !== undefined && factualTrace.length > 0
      ? { diagnostics: { factual_authorization_trace: factualTrace } }
      : {})
  };
}

function degraded(
  detail: string,
  attempts: number,
  normalizationApplied: readonly NormalizationKind[],
  factualTrace?: readonly FactualClaimAuthorizationTraceV0[]
): ConversationTextResponseResultV1 {
  return {
    kind: "DEGRADED",
    stage: "EXECUTOR_OUTPUT_DEGRADED",
    detail,
    attempts,
    normalization_applied: normalizationApplied,
    ...(factualTrace !== undefined && factualTrace.length > 0
      ? { diagnostics: { factual_authorization_trace: factualTrace } }
      : {})
  };
}

export class ConversationTextResponseExecutorV1 {
  constructor(private readonly deps: RuntimeDependencyContainer) {}

  async execute(
    ctx: RuntimeContext,
    request: ConversationResponseRequestV0,
    capabilities: TransitionCapabilities
  ): Promise<ConversationTextResponseResultV1> {
    const conversationTransport = this.deps.conversationCognitionTransport;
    if (conversationTransport === null) {
      return failed("REQUEST_INVALID", "conversation cognition transport not wired");
    }
    const requestId = validateIdentifier(request?.response_request_id as string, "response_request_id");
    if (!requestId.ok) return failed("REQUEST_INVALID", requestId.error.detail);

    const snapshot = await this.deps.subjectCore.readCurrentSnapshot(ctx.subject_id);
    if (snapshot === null) return failed("REQUEST_INVALID", `subject ${ctx.subject_id} not found`);
    let sourceRevision = snapshot.runtime_metadata.state_revision;

    // ---- PRE_COGNITION_CANONICAL_APPRAISAL_V0 (§23/§53/§56) ----------------------
    // Ordering law: the canonical factual-event INITIAL Appraisal lifecycle
    // (provider + canonical commit) completes BEFORE cognition starts. A
    // canonical-commit failure is the boundary: cognition never starts from an
    // Appraisal that never became canonical (§59). INSUFFICIENT_CONTEXT is the
    // completed abstention outcome: no record, no Affect eligibility, cognition
    // proceeds (no fabricated neutral Appraisal, §18/§58).
    let factualAppraisalTrace: { outcome: "COMMITTED" | "ALREADY_COMPLETED" | "INSUFFICIENT_CONTEXT"; appraisal_ref: string } | undefined;
    if (request.factual_event !== undefined) {
      const appraisalExecutor = new FactualEventAppraisalExecutorV0(this.deps);
      let appraisalOutcome;
      try {
        appraisalOutcome = await appraisalExecutor.appraiseIncomingEvent(ctx, {
        subject_id: ctx.subject_id as string,
        source_event_id: request.factual_event.source_event_id,
        observation_transition_id: request.factual_event.observation_transition_id,
        observation_ref: request.factual_event.observation_ref as never
        });
      } catch (error) {
        return failed("APPRAISAL_FAILED", error instanceof Error ? error.message : String(error));
      }
      if (appraisalOutcome.kind === "COMMITTED") {
        factualAppraisalTrace = { outcome: "COMMITTED", appraisal_ref: appraisalOutcome.appraisal_ref as string };
      } else if (appraisalOutcome.kind === "ALREADY_COMPLETED") {
        factualAppraisalTrace = { outcome: "ALREADY_COMPLETED", appraisal_ref: appraisalOutcome.appraisal_ref as string };
      } else if (appraisalOutcome.kind === "INSUFFICIENT_CONTEXT") {
        factualAppraisalTrace = { outcome: "INSUFFICIENT_CONTEXT", appraisal_ref: "" };
      } else if (appraisalOutcome.kind === "ALREADY_DISPOSED") {
        // DURABLE_PRE_COGNITION_APPRAISAL_DISPOSITION_V0: the INITIAL for this
        // event is durably abstained (terminal). Same downstream meaning as a
        // fresh lawful abstention: no Affect eligibility, cognition proceeds.
        factualAppraisalTrace = { outcome: "INSUFFICIENT_CONTEXT", appraisal_ref: "" };
      } else {
        return failed(
          "APPRAISAL_FAILED",
          appraisalOutcome.kind === "REJECTED"
            ? `appraisal rejected: ${appraisalOutcome.failure.error_code} ${appraisalOutcome.failure.detail}`
            : `appraisal did not become canonical: ${appraisalOutcome.kind}`
        );
      }
    }

    // The appraisal commit may have advanced the canonical head; cognition
    // anchors at the CURRENT head (§23 ordering: cognition starts after the
    // appraisal lifecycle completed).
    const cognitionCtx = (await (async () => {
      if (request.factual_event === undefined) return ctx;
      const freshSnapshot = await this.deps.subjectCore.readCurrentSnapshot(ctx.subject_id);
      if (freshSnapshot === null) return ctx;
      sourceRevision = freshSnapshot.runtime_metadata.state_revision;
      return {
        subject_id: ctx.subject_id,
        current_logical_time: freshSnapshot.runtime_metadata.logical_time,
        state_revision: freshSnapshot.runtime_metadata.state_revision
      } as unknown as RuntimeContext;
    })());

    // ---- shared cognition pipeline; current canonical projections use C3 V4 -------
    const legacyConversationProvider = new ConversationCognitionProviderV2(conversationTransport);
    // PRODUCT OUTPUT ROBUSTNESS: the V8 provider stays the sole acceptance authority,
    // but it is now driven by a bounded executor that normalizes the model's content
    // (semantics-preserving only) and permits exactly ONE regeneration before degrading.
    const c2ConversationProvider = createRobustConversationCognitionProviderV8({
      transport: conversationTransport,
      executorId: "product-conversation-cognition"
    });
    const wrappedV0Provider = {
      propose: async (projection: CognitiveContextProjectionAnyVersion) => {
        const convProposal = projection.schema_version === "cognitive-context-projection-v2"
          ? await c2ConversationProvider.propose(projection)
          : await legacyConversationProvider.propose(projection);
        return convProposal.cognition;
      }
    };
    let cognitionExecutor = new CognitionActionTransitionExecutor({
      ...this.deps,
      cognitionProvider: wrappedV0Provider
    });

    let cognitionResult: Awaited<ReturnType<CognitionActionTransitionExecutor["execute"]>>;
    try {
      // PRE_COGNITION_CANONICAL_APPRAISAL_V0: when the governed pre-cognition
      // stage ran, the canonical head has lawfully advanced — mint FRESH
      // cognition capabilities against the post-appraisal head (the caller's
      // pre-appraisal sentinel bindings are stale by construction).
      let cognitionCapabilities = capabilities;
      if (request.factual_event !== undefined) {
        const freshSnapshot = await this.deps.subjectCore.readCurrentSnapshot(cognitionCtx.subject_id);
        if (freshSnapshot !== null && this.deps.experienceAppraisalStore !== null) {
          const manifest = await this.deps.experienceAppraisalStore.readManifest(
            freshSnapshot.memory_state.repository_revision as never
          );
          if (manifest !== null) {
            const miclFingerprint = await hashEnvelope("characteros-next/runtime/conversation-factual-cognition-micl/v1", {
              response_request_id: request.response_request_id,
              state_revision: freshSnapshot.runtime_metadata.state_revision
            });
            const minter = createMiclStageMinter(this.deps.subjectCore, new InMemoryMiclWorkflowStore(), {
              micl_id: `micl-conv-${request.response_request_id}` as never,
              micl_request_fingerprint: miclFingerprint as never,
              stage_key: "OBSERVATION"
            });
            cognitionCapabilities = minter.capabilities([
              {
                repository_revision: freshSnapshot.memory_state.repository_revision,
                repository_revision_hash: await computeRepositoryRevisionHash(manifest)
              }
            ] as never) as never;
            // Route cognition through the minting core so the reservation is
            // reserved against the SAME minted workflow.
            cognitionExecutor = new CognitionActionTransitionExecutor({
              ...this.deps,
              cognitionProvider: wrappedV0Provider,
              subjectCore: minter.core()
            });
          }
        }
      }
      cognitionResult = await cognitionExecutor.execute(
        cognitionCtx,
        { cause_refs: [...(request.cause_refs ?? [])], allowed_actions: [] },
        cognitionCapabilities
      );
    } catch (error) {
      const base = error instanceof Error ? error.message : String(error);
      const rejection = providerRejectionDetail(error);
      if (isCognitionOutputDegraded(error)) {
        // Bounded robustness exhausted: degrade gracefully instead of failing the host.
        const degradedAttempts = c2ConversationProvider.diagnostics.filter(
          (entry) => entry.event === "ATTEMPT_REJECTED" || entry.event === "ATTEMPT_SUCCEEDED"
        ).length;
        const normalizationApplied = [
          ...new Set(c2ConversationProvider.diagnostics.flatMap((entry) => entry.normalization_applied))
        ];
        return degraded(
          rejection === null || base.includes(rejection) ? base : `${base} (${rejection})`,
          degradedAttempts,
          normalizationApplied,
          c2ConversationProvider.lastFactualAuthorizationTrace
        );
      }
      return failed(
        "COGNITION_FAILED",
        rejection === null || base.includes(rejection) ? base : `${base} (${rejection})`,
        c2ConversationProvider.lastFactualAuthorizationTrace
      );
    }
    if (cognitionResult.outcome.kind !== "NO_OP") {
      return failed("COGNITION_FAILED", `cognition outcome: ${cognitionResult.outcome.kind}`);
    }
    if (cognitionResult.cognition.action_intent !== null) {
      return failed("COGNITION_FAILED", "conversational V1 action configuration requires action_intent null");
    }

    // ---- directive branching (from validated conversation cognition) ---------------
    const isV2Projection = cognitionResult.projection.schema_version === "cognitive-context-projection-v2";
    const conversationProposal = isV2Projection
      ? c2ConversationProvider.lastConversationProposal
      : legacyConversationProvider.lastConversationProposal;
    const lastDirective = isV2Projection
      ? c2ConversationProvider.lastDirective
      : legacyConversationProvider.lastDirective;
    if (lastDirective === null || conversationProposal === null) {
      // Unreachable after a successful propose(): preserve the historical
      // TypeError-on-violation instead of continuing with a null directive.
      throw new TypeError("conversation cognition directive missing after successful cognition");
    }
    const directive: CommunicationDirectiveV0 = lastDirective;
    const clarificationBasis = conversationProposal.clarification_basis;
    const evidenceProjection = cognitionResult.projection;
    // Version-appropriate protocol hash domain. The v4 canonical surface binds
    // the V4 proposal (facts + descriptive cognition + subjective choice +
    // directive + clarification_basis, explicitly null where absent); the frozen
    // v3 surface keeps its historical V1 domain and null-intent language handoff.
    const conversationProposalHash = isV2Projection
      ? await deriveConversationCognitionProposalHashV8(conversationProposal as ConversationCognitionProposalV8)
      : await hashEnvelope("characteros-next/runtime/conversation-cognition-proposal/v1", {
          schema_version: "conversation-cognition-proposal-v1",
          cognition: cognitionResult.cognition,
          communication_directive: directive
        });
    const proposalSchemaVersion = isV2Projection
      ? ("conversation-cognition-proposal-v8" as const)
      : ("conversation-cognition-proposal-v1" as const);
    const factualAuthorizationTrace = isV2Projection
      ? c2ConversationProvider.lastFactualAuthorizationTrace
      : undefined;

    if (directive.kind === "CLARIFY_MISSING_CONTEXT") {
      if (clarificationBasis === null) {
        return failed("COGNITION_FAILED", "CLARIFY without a lawful clarification basis");
      }
      return this.clarifyBranch(snapshot, sourceRevision, requestId.value, evidenceProjection, conversationProposalHash, proposalSchemaVersion, clarificationBasis, factualAppraisalTrace, factualAuthorizationTrace);
    }
    return this.realizeBranch(
      snapshot,
      sourceRevision,
      requestId.value,
      evidenceProjection,
      cognitionResult.cognition,
      isV2Projection ? conversationProposal as ConversationCognitionProposalV8 : null,
      conversationProposalHash,
      proposalSchemaVersion,
      directive,
      lawfulEvidence(evidenceProjection),
      factualAppraisalTrace,
      factualAuthorizationTrace
    );
  }

  private async clarifyBranch(
    snapshot: SubjectStateV0,
    sourceRevision: number,
    requestId: IdentifierV0,
    evidenceProjection: CognitiveContextProjectionAnyVersion,
    conversationProposalHash: string,
    proposalSchemaVersion: "conversation-cognition-proposal-v1" | "conversation-cognition-proposal-v2" | "conversation-cognition-proposal-v3" | "conversation-cognition-proposal-v4" | "conversation-cognition-proposal-v5" | "conversation-cognition-proposal-v6" | "conversation-cognition-proposal-v7" | "conversation-cognition-proposal-v8",
    clarificationBasis: ClarificationBasisV0,
    factualAppraisalTrace?: { outcome: "COMMITTED" | "ALREADY_COMPLETED" | "INSUFFICIENT_CONTEXT"; appraisal_ref: string },
    factualAuthorizationTrace?: readonly FactualClaimAuthorizationTraceV0[]
  ): Promise<ConversationTextResponseResultV1> {
    const built = await buildClarificationBehaviorV0({
      subject_id: snapshot.identity.subject_id,
      source_revision: sourceRevision as never,
      response_request_id: requestId,
      cognition_projection_hash: evidenceProjection.projection_hash,
      conversation_cognition_proposal_hash: conversationProposalHash as never
    });
    if (!built.ok) return failed("CLARIFICATION_RENDER_INVALID", built.detail);

    const freshSnapshot = await this.deps.subjectCore.readCurrentSnapshot(snapshot.identity.subject_id) as SubjectStateV0 | null;
    if (!freshSnapshot || freshSnapshot.runtime_metadata.state_revision !== sourceRevision) {
      return failed("STALE_CONTEXT", "subject/revision changed during clarification; stale text not delivered");
    }
    const inputHash = await deriveClarificationRealizationInputHashV0({
      schema_version: "clarification-realization-input-v0",
      subject_id: snapshot.identity.subject_id,
      source_revision: sourceRevision as never,
      response_request_id: requestId,
      cognition_projection_hash: evidenceProjection.projection_hash,
      conversation_cognition_proposal_hash: conversationProposalHash as never,
      communication_directive: { kind: "CLARIFY_MISSING_CONTEXT" },
      renderer_id: "clarify-missing-context-en-v0"
    });
    return {
      kind: "OUTPUT_READY",
      behavior: built.behavior,
      trace: {
        ...(factualAppraisalTrace !== undefined ? { factual_appraisal: factualAppraisalTrace } : {}),
        communication_directive_kind: "CLARIFY_MISSING_CONTEXT",
        conversation_cognition_proposal_hash: conversationProposalHash,
        conversation_proposal_schema_version: proposalSchemaVersion,
        clarification_basis: clarificationBasis,
        ...(factualAuthorizationTrace !== undefined ? { factual_authorization_trace: factualAuthorizationTrace } : {}),
        subjective_selection: { kind: "NO_SUBJECTIVE_SELECTION" },
        cognition_projection_hash: evidenceProjection.projection_hash,
        realization_input_hash: inputHash,
        realization_source: "HOST_CLARIFICATION_V0"
      }
    };
  }

  private async realizeBranch(
    snapshot: SubjectStateV0,
    sourceRevision: number,
    requestId: IdentifierV0,
    evidenceProjection: CognitiveContextProjectionAnyVersion,
    cognition: CognitionProposalV0,
    c2Proposal: ConversationCognitionProposalV8 | null,
    conversationProposalHash: string,
    proposalSchemaVersion: "conversation-cognition-proposal-v1" | "conversation-cognition-proposal-v2" | "conversation-cognition-proposal-v3" | "conversation-cognition-proposal-v4" | "conversation-cognition-proposal-v5" | "conversation-cognition-proposal-v6" | "conversation-cognition-proposal-v7" | "conversation-cognition-proposal-v8",
    directive: CommunicationDirectiveV0,
    lawfulEvidence: ReadonlySet<string>,
    factualAppraisalTrace?: { outcome: "COMMITTED" | "ALREADY_COMPLETED" | "INSUFFICIENT_CONTEXT"; appraisal_ref: string },
    factualAuthorizationTrace?: readonly FactualClaimAuthorizationTraceV0[]
  ): Promise<ConversationTextResponseResultV1> {
    const languageProvider = this.deps.languageRealizationProvider;
    if (languageProvider === null) return failed("REQUEST_INVALID", "language realization provider not wired");
    const episodeReader = this.deps.episodeContentReader;
    if (episodeReader === null) return failed("REQUEST_INVALID", "memory episode content reader not wired");

    const memoryEvidenceRefs = [...new Set<string>([
      ...(evidenceProjection.memory_working_refs as readonly string[]),
      ...(evidenceProjection.recent_retrieval_refs as readonly string[])
    ])].sort();
    const episodeRefs = memoryEvidenceRefs.filter((ref) => ref.startsWith("episode:")) as unknown as readonly CanonicalRefV0[];
    let episodeContents: readonly LanguageEpisodeContentV0[] = [];
    if (episodeRefs.length > 0) {
      const read = await episodeReader.read({
        repository_revision: snapshot.memory_state.repository_revision as never,
        refs: episodeRefs
      });
      if (!read.ok) return failed("MEMORY_EVIDENCE_FAILED", `${read.code}: ${read.detail}`);
      episodeContents = read.contents;
    }

    const builtInput = c2Proposal === null
      ? await buildLanguageRealizationInputV1({
          subject_id: snapshot.identity.subject_id,
          source_revision: sourceRevision as never,
          response_request_id: requestId,
          projection: evidenceProjection,
          cognition,
          conversation_cognition_proposal_hash: conversationProposalHash as never,
          communication_directive: directive,
          memory_episode_contents: episodeContents
        })
      : await buildLanguageRealizationInputV10({
          subject_id: snapshot.identity.subject_id,
          source_revision: sourceRevision as never,
          response_request_id: requestId,
          projection: evidenceProjection,
          conversation_proposal: c2Proposal,
          memory_episode_contents: episodeContents
        });
    if (!builtInput.ok) {
      // Pre-Language realization completeness gate (LC-C): missing primary authoritative
      // semantics fails closed BEFORE Language; the reasoning stage is never invoked.
      if ("code" in builtInput && builtInput.code === "SEMANTIC_COMPLETENESS_FAILED") {
        return failed("COGNITION_FAILED", `SEMANTIC_COMPLETENESS_FAILED: ${builtInput.detail}`);
      }
      return failed("LANGUAGE_SCHEMA_INVALID", builtInput.detail);
    }
    const languageInput = builtInput.input;
    const inputHash = builtInput.input_hash;

    let draft;
    try {
      draft = await languageProvider.realize({
        input: languageInput as never,
        input_hash: inputHash,
        lawful_evidence_refs: lawfulEvidence
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes("EVIDENCE_INVALID")) return failed("LANGUAGE_EVIDENCE_INVALID", msg);
      if (msg.includes("MODEL_SCHEMA_INVALID") || msg.includes("OUTPUT_TOO_LARGE") || msg.includes("INPUT_HASH_MISMATCH") || msg.includes("INVOCATION_BINDING_INVALID"))
        return failed("LANGUAGE_SCHEMA_INVALID", msg);
      return failed("LANGUAGE_TRANSPORT_FAILED", msg);
    }

    for (const ref of draft.evidence_refs) {
      if (!lawfulEvidence.has(ref)) return failed("LANGUAGE_EVIDENCE_INVALID", `draft cites ${ref} outside lawful evidence`);
    }

    // AUTHORIZED_CLAIM_LANGUAGE_REALIZATION_V0: the ONE relaxed act surface.
    // A GENERATIVE realization may use host-authorized claims, so a quoted factual
    // payload it carries must be traceable to one of them. No-op for every other
    // atom/act (GREET, ACKNOWLEDGE, PRIMARY_FACT, PRIMARY_STANCE, legacy paths).
    const claimBinding = validateGenerativeClaimBindingV0({
      response_semantics: c2Proposal?.response_semantics ?? null,
      authorized_claims: c2Proposal?.factual_assessment.claims ?? [],
      text: draft.text
    });
    if (!claimBinding.ok) return failed("LANGUAGE_CLAIM_BINDING_INVALID", claimBinding.detail);

    const freshSnapshot = await this.deps.subjectCore.readCurrentSnapshot(snapshot.identity.subject_id) as SubjectStateV0 | null;
    if (!freshSnapshot || freshSnapshot.runtime_metadata.state_revision !== sourceRevision) {
      return failed("STALE_CONTEXT", "subject/revision changed during language realization; stale text not delivered");
    }

    const built = await buildCharacterLanguageBehaviorV0({
      subject_id: snapshot.identity.subject_id,
      source_revision: sourceRevision as never,
      response_request_id: requestId,
      draft
    });
    if (!built.ok) return failed("LANGUAGE_SCHEMA_INVALID", built.detail);

    return {
      kind: "OUTPUT_READY",
      behavior: built.behavior,
      trace: {
        ...(factualAppraisalTrace !== undefined ? { factual_appraisal: factualAppraisalTrace } : {}),
        communication_directive_kind: "REALIZE_CURRENT_INTENT",
        conversation_cognition_proposal_hash: conversationProposalHash,
        conversation_proposal_schema_version: proposalSchemaVersion,
        clarification_basis: null,
        ...(factualAuthorizationTrace !== undefined ? { factual_authorization_trace: factualAuthorizationTrace } : {}),
        subjective_selection: c2Proposal?.subjective_selection ?? { kind: "NO_SUBJECTIVE_SELECTION" },
        cognition_projection_hash: evidenceProjection.projection_hash,
        realization_input_hash: inputHash,
        realization_source: "LANGUAGE_PROVIDER_V0"
      }
    };
  }
}

function lawfulEvidence(projection: CognitiveContextProjectionAnyVersion): ReadonlySet<string> {
  return allowedEvidenceSet(projection);
}
