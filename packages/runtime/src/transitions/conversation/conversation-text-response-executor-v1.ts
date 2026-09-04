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
import { buildClarificationBehaviorV0, deriveClarificationRealizationInputHashV0 } from "@characteros-next/behavior";
import { validateIdentifier } from "@characteros-next/subject-core";

import type { RuntimeDependencyContainer } from "../../types/runtime-dependency-container.js";
import type { TransitionCapabilities } from "../../ports/subject-core-port.js";
import type { RuntimeContext } from "../../types/runtime-context.js";
import { CognitionActionTransitionExecutor } from "../cognition-action/cognition-action-transition-executor.js";
import { allowedEvidenceSet, type CognitiveContextProjectionV0 } from "../cognition-action/types.js";
import type { ConversationResponseRequestV0 } from "./conversation-text-response-executor.js";
import { ConversationCognitionProviderV1, ConversationCognitionRejectionErrorV1 } from "../../providers/behavior/conversation-cognition-provider.js";
import { deriveLanguageRealizationInputHashV0 } from "./language-realization-input.js";
import type { LanguageEpisodeContentV0 } from "./language-realization-input.js";

export const CONVERSATION_TEXT_RESPONSE_EXECUTOR_V1_SCHEMA_VERSION =
  "conversation-text-response-executor-v1" as const;

export type RealizationSourceV0 = "HOST_CLARIFICATION_V0" | "LANGUAGE_PROVIDER_V0";

export interface ConversationResponseTraceV1 {
  readonly communication_directive_kind: string;
  readonly conversation_cognition_proposal_hash: string;
  readonly cognition_projection_hash: string;
  readonly realization_input_hash: string;
  readonly realization_source: RealizationSourceV0;
}

export type ConversationResponseFailureStageV1 =
  | "REQUEST_INVALID"
  | "COGNITION_FAILED"
  | "MEMORY_EVIDENCE_FAILED"
  | "LANGUAGE_TRANSPORT_FAILED"
  | "LANGUAGE_SCHEMA_INVALID"
  | "LANGUAGE_EVIDENCE_INVALID"
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
    };

function failed(stage: ConversationResponseFailureStageV1, detail: string): ConversationTextResponseResultV1 {
  return { kind: "FAILED", stage, detail };
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
    const sourceRevision = snapshot.runtime_metadata.state_revision;

    // ---- shared cognition pipeline with ConversationCognitionProviderV1 -----------
    const conversationProvider = new ConversationCognitionProviderV1(conversationTransport);
    const wrappedV0Provider = {
      propose: async (projection: CognitiveContextProjectionV0) => {
        const convProposal = await conversationProvider.propose(projection);
        return convProposal.cognition;
      }
    };
    const cognitionExecutor = new CognitionActionTransitionExecutor({
      ...this.deps,
      cognitionProvider: wrappedV0Provider
    });

    let cognitionResult: Awaited<ReturnType<CognitionActionTransitionExecutor["execute"]>>;
    try {
      cognitionResult = await cognitionExecutor.execute(
        ctx,
        { cause_refs: [...(request.cause_refs ?? [])], allowed_actions: [] },
        capabilities
      );
    } catch (error) {
      return failed("COGNITION_FAILED", error instanceof Error ? error.message : String(error));
    }
    if (cognitionResult.outcome.kind !== "NO_OP") {
      return failed("COGNITION_FAILED", `cognition outcome: ${cognitionResult.outcome.kind}`);
    }
    if (cognitionResult.cognition.action_intent !== null) {
      return failed("COGNITION_FAILED", "conversational V1 action configuration requires action_intent null");
    }

    // ---- directive branching (from validated conversation cognition) ---------------
    const directive: CommunicationDirectiveV0 = conversationProvider.lastDirective!;
    const evidenceProjection: CognitiveContextProjectionV0 = cognitionResult.projection;
    const conversationProposalHash = await (async () => {
      const { hashEnvelope } = await import("@characteros-next/subject-core");
      return hashEnvelope("characteros-next/runtime/conversation-cognition-proposal/v1", {
        schema_version: "conversation-cognition-proposal-v1",
        cognition: cognitionResult.cognition,
        communication_directive: directive
      });
    })();

    if (directive.kind === "CLARIFY_MISSING_CONTEXT") {
      return this.clarifyBranch(snapshot, sourceRevision, requestId.value, evidenceProjection, conversationProposalHash);
    }
    return this.realizeBranch(snapshot, sourceRevision, requestId.value, evidenceProjection, conversationProposalHash, directive, conversationProvider, lawfulEvidence(evidenceProjection));
  }

  private async clarifyBranch(
    snapshot: SubjectStateV0,
    sourceRevision: number,
    requestId: IdentifierV0,
    evidenceProjection: CognitiveContextProjectionV0,
    conversationProposalHash: string
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
        communication_directive_kind: "CLARIFY_MISSING_CONTEXT",
        conversation_cognition_proposal_hash: conversationProposalHash,
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
    evidenceProjection: CognitiveContextProjectionV0,
    conversationProposalHash: string,
    directive: CommunicationDirectiveV0,
    conversationProvider: ConversationCognitionProviderV1,
    lawfulEvidence: ReadonlySet<string>
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

    const { hashEnvelope } = await import("@characteros-next/subject-core");
    const languageInput = {
      schema_version: "language-realization-input-v1" as const,
      subject_id: snapshot.identity.subject_id,
      source_revision: sourceRevision,
      response_request_id: requestId,
      cognition_projection_hash: evidenceProjection.projection_hash,
      cognition_proposal_binding: {
        schema_version: cognitionResultSchemaVersion(evidenceProjection),
        projection_hash: evidenceProjection.projection_hash,
        current_intent: null
      },
      communication_binding: {
        schema_version: "conversation-cognition-proposal-v1" as const,
        proposal_hash: conversationProposalHash,
        directive: { kind: "REALIZE_CURRENT_INTENT" as const }
      },
      scene: evidenceProjection.context.scene,
      task: evidenceProjection.context.task,
      focus_refs: evidenceProjection.context.focus_refs,
      active_entity_refs: evidenceProjection.context.active_entity_refs,
      environment_refs: evidenceProjection.context.environment_refs,
      current_observation_ref: evidenceProjection.context.current_observation_ref,
      belief_items: evidenceProjection.belief_items,
      traits_dimensions: evidenceProjection.traits_dimensions,
      affect_channels: evidenceProjection.affect_channels,
      mood_baseline: evidenceProjection.mood_baseline,
      regulation: evidenceProjection.regulation,
      interaction_familiarity: evidenceProjection.interaction_familiarity,
      interaction_familiarity_cognition_influences: evidenceProjection.interaction_familiarity_cognition_influences,
      evidence_refs: memoryEvidenceRefs as unknown as readonly CanonicalRefV0[],
      memory_episode_contents: episodeContents,
      constraints: { max_text_code_points: 4096 as const, evidence_refs_only: true as const, no_new_evidence_authority: true as const }
    };
    const inputHash = await hashEnvelope("characteros-next/runtime/language-realization-input-v1/v1", languageInput) as never;

    let draft;
    try {
      draft = await this.deps.languageRealizationProvider!.realize({
        input: languageInput as never,
        input_hash: inputHash,
        lawful_evidence_refs: lawfulEvidence
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes("EVIDENCE_INVALID")) return failed("LANGUAGE_EVIDENCE_INVALID", msg);
      if (msg.includes("MODEL_SCHEMA_INVALID") || msg.includes("OUTPUT_TOO_LARGE") || msg.includes("INPUT_HASH_MISMATCH"))
        return failed("LANGUAGE_SCHEMA_INVALID", msg);
      return failed("LANGUAGE_TRANSPORT_FAILED", msg);
    }

    for (const ref of draft.evidence_refs) {
      if (!lawfulEvidence.has(ref)) return failed("LANGUAGE_EVIDENCE_INVALID", `draft cites ${ref} outside lawful evidence`);
    }

    const freshSnapshot = await this.deps.subjectCore.readCurrentSnapshot(snapshot.identity.subject_id) as SubjectStateV0 | null;
    if (!freshSnapshot || freshSnapshot.runtime_metadata.state_revision !== sourceRevision) {
      return failed("STALE_CONTEXT", "subject/revision changed during language realization; stale text not delivered");
    }

    const { buildCharacterLanguageBehaviorV0 } = await import("@characteros-next/behavior");
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
        communication_directive_kind: "REALIZE_CURRENT_INTENT",
        conversation_cognition_proposal_hash: conversationProposalHash,
        cognition_projection_hash: evidenceProjection.projection_hash,
        realization_input_hash: inputHash,
        realization_source: "LANGUAGE_PROVIDER_V0"
      }
    };
  }
}

function lawfulEvidence(projection: CognitiveContextProjectionV0): ReadonlySet<string> {
  return allowedEvidenceSet(projection);
}

function cognitionResultSchemaVersion(_: unknown): string {
  return "cognition-proposal-v0";
}

// Re-export for testing
const _ = ConversationCognitionProviderV1;
const __ = ConversationCognitionRejectionErrorV1;
