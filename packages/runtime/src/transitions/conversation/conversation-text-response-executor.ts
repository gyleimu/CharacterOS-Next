/**
 * ConversationTextResponseExecutorV0 — the FIRST production user-visible textual
 * behavior surface (PRODUCTION_LANGUAGE_BEHAVIOR_OUTPUT_V0).
 *
 * Production path (all stages internal; the caller supplies only a trusted
 * response request):
 *
 *   trusted conversation response request
 *   → existing CognitionActionTransitionExecutor (V0-compatible conversational
 *     action configuration: empty action space ⇒ action_intent null ⇒ zero
 *     ActionRunner calls)
 *   → existing validated CognitionProposalV0
 *   → existing familiarity / retrieval / evidence path (already inside the
 *     cognition execution)
 *   → deterministic language-realization input construction (+ input_hash)
 *   → LanguageRealizationProviderV0 (exactly ONE call)
 *   → validated LanguageRealizationDraftV0
 *   → stale-context verification (subject/revision unchanged)
 *   → host-built CharacterLanguageBehaviorV0
 *   → OUTPUT_READY (the product receives behavior.text)
 *
 * LAWS:
 *   - NO_ACTION ≠ NO_COMMUNICATION: the conversational entry uses an EMPTY
 *     action space; external action selection stays empty/null and zero action
 *     executions occur. Text realization is a separate production behavior
 *     stage AFTER cognition. Existing cognition-only operations are unchanged
 *     and never realize language (language capability is opt-in through THIS
 *     executor).
 *   - NON-CANONICAL: OUTPUT_READY mutates no SubjectState / Relationship /
 *     Belief / Affect / Personality / Memory. Experience write-back belongs to
 *     a future product-delivery slice.
 *   - EVIDENCE AUTHORITY: factual Memory content is resolved ONLY for lawful
 *     episode refs from the SAME cognition execution's evidence context
 *     (memory_working_refs ∪ recent_retrieval_refs) through the trusted Memory
 *     reader. Provider output evidence refs are re-validated against
 *     allowedEvidenceSet(projection) — the cognition evidence law is NOT
 *     weakened, and familiarity/receipt/authority refs can never satisfy it.
 *   - STALE CONTEXT: the language call adds latency, so subject/revision are
 *     re-verified before OUTPUT_READY; stale text is never silently delivered.
 *   - The result never contains a fake fallback character reply: a technical
 *     error is not character behavior.
 */

import type { IdentifierV0, SubjectStateV0, CanonicalRefV0 } from "@characteros-next/subject-core";
import type { CharacterLanguageBehaviorV0 } from "@characteros-next/behavior";
import { buildCharacterLanguageBehaviorV0 } from "@characteros-next/behavior";
import { validateIdentifier } from "@characteros-next/subject-core";

import type { RuntimeDependencyContainer } from "../../types/runtime-dependency-container.js";
import type { TransitionCapabilities } from "../../ports/subject-core-port.js";
import type { RuntimeContext } from "../../types/runtime-context.js";
import { CognitionActionTransitionExecutor } from "../cognition-action/cognition-action-transition-executor.js";
import { allowedEvidenceSet, type CognitiveContextProjectionV0 } from "../cognition-action/types.js";
import {
  deriveLanguageRealizationInputHashV0,
  type LanguageEpisodeContentV0,
  type LanguageRealizationInputV0
} from "./language-realization-input.js";
import {
  LanguageRealizationRejectionErrorV0,
  type LanguageRealizationRejectionCodeV0
} from "../../providers/behavior/language-realization-provider.js";

export const CONVERSATION_TEXT_RESPONSE_EXECUTOR_SCHEMA_VERSION_V0 =
  "conversation-text-response-executor-v0" as const;

/** Trusted product request: identity only — everything authoritative derives internally. */
export interface ConversationResponseRequestV0 {
  readonly response_request_id: IdentifierV0;
  /** Optional cognition trigger refs when current transition law requires them. */
  readonly cause_refs?: readonly CanonicalRefV0[];
}

/** Distinct failure stages (deliberately NOT collapsed into one service code). */
export type ConversationResponseFailureStageV0 =
  | "REQUEST_INVALID"
  | "COGNITION_FAILED"
  | "MEMORY_EVIDENCE_FAILED"
  | "LANGUAGE_TRANSPORT_FAILED"
  | "LANGUAGE_SCHEMA_INVALID"
  | "LANGUAGE_EVIDENCE_INVALID"
  | "STALE_CONTEXT";

export interface ConversationResponseOutputReadyV0 {
  readonly kind: "OUTPUT_READY";
  readonly behavior: CharacterLanguageBehaviorV0;
  /** Observation-only trace: ref-level correlation, never an authority. */
  readonly trace: {
    readonly language_input_hash: string;
    readonly cognition_projection_hash: string;
  };
}

export interface ConversationResponseFailedV0 {
  readonly kind: "FAILED";
  readonly stage: ConversationResponseFailureStageV0;
  readonly detail: string;
}

export type ConversationTextResponseResultV0 =
  | ConversationResponseOutputReadyV0
  | ConversationResponseFailedV0;

function failed(
  stage: ConversationResponseFailureStageV0,
  detail: string
): ConversationResponseFailedV0 {
  return { kind: "FAILED", stage, detail };
}

export class ConversationTextResponseExecutorV0 {
  constructor(private readonly deps: RuntimeDependencyContainer) {}

  async execute(
    ctx: RuntimeContext,
    request: ConversationResponseRequestV0,
    capabilities: TransitionCapabilities
  ): Promise<ConversationTextResponseResultV0> {
    // ---- wiring gates --------------------------------------------------------------
    const languageProvider = this.deps.languageRealizationProvider;
    if (languageProvider === null) {
      return failed("REQUEST_INVALID", "language realization provider not wired");
    }
    const episodeReader = this.deps.episodeContentReader;
    if (episodeReader === null) {
      return failed("REQUEST_INVALID", "memory episode content reader not wired");
    }
    const requestId = validateIdentifier(request?.response_request_id as string, "response_request_id");
    if (!requestId.ok) {
      return failed("REQUEST_INVALID", requestId.error.detail);
    }

    // ---- authoritative binding -------------------------------------------------------
    const snapshot = await this.deps.subjectCore.readCurrentSnapshot(ctx.subject_id);
    if (snapshot === null) {
      return failed("REQUEST_INVALID", `subject ${ctx.subject_id} not found`);
    }
    const sourceRevision = snapshot.runtime_metadata.state_revision;

    // ---- existing cognition execution (V0 conversational action configuration) ------
    const cognitionExecutor = new CognitionActionTransitionExecutor(this.deps);
    let cognition: Awaited<ReturnType<CognitionActionTransitionExecutor["execute"]>>;
    try {
      cognition = await cognitionExecutor.execute(
        ctx,
        { cause_refs: [...(request.cause_refs ?? [])], allowed_actions: [] },
        capabilities
      );
    } catch (error) {
      return failed(
        "COGNITION_FAILED",
        error instanceof Error ? error.message : String(error)
      );
    }
    if (cognition.outcome.kind !== "NO_OP") {
      return failed("COGNITION_FAILED", `cognition outcome: ${cognition.outcome.kind}`);
    }
    if (cognition.cognition.action_intent !== null) {
      return failed(
        "COGNITION_FAILED",
        "the conversational V0 action configuration requires action_intent null"
      );
    }
    const evidenceProjection: CognitiveContextProjectionV0 = cognition.projection;

    // ---- lawful Memory evidence: refs + validated episode contents -------------------
    const lawfulEvidence = allowedEvidenceSet(evidenceProjection);
    const memoryEvidenceRefs = [
      ...new Set<string>([
        ...(evidenceProjection.memory_working_refs as readonly string[]),
        ...(evidenceProjection.recent_retrieval_refs as readonly string[])
      ])
    ].sort();
    const episodeRefs = memoryEvidenceRefs.filter((ref) => ref.startsWith("episode:")) as unknown as readonly CanonicalRefV0[];
    let episodeContents: readonly LanguageEpisodeContentV0[] = [];
    if (episodeRefs.length > 0) {
      const read = await episodeReader.read({
        repository_revision: snapshot.memory_state.repository_revision as never,
        refs: episodeRefs
      });
      if (!read.ok) {
        return failed("MEMORY_EVIDENCE_FAILED", `${read.code}: ${read.detail}`);
      }
      episodeContents = read.contents;
    }

    // ---- deterministic language input + input_hash ------------------------------------
    const languageInput: LanguageRealizationInputV0 = {
      schema_version: "language-realization-input-v0",
      subject_id: snapshot.identity.subject_id,
      source_revision: sourceRevision,
      response_request_id: requestId.value,
      cognition_projection_hash: evidenceProjection.projection_hash,
      cognition_proposal_binding: {
        schema_version: cognition.cognition.schema_version,
        projection_hash: cognition.cognition.projection_hash,
        current_intent: cognition.cognition.current_intent
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
      interaction_familiarity_cognition_influences:
        evidenceProjection.interaction_familiarity_cognition_influences,
      evidence_refs: memoryEvidenceRefs as unknown as readonly CanonicalRefV0[],
      memory_episode_contents: episodeContents,
      constraints: { max_text_code_points: 4096, evidence_refs_only: true, no_new_evidence_authority: true }
    };
    const inputHash = await deriveLanguageRealizationInputHashV0(languageInput);

    // ---- language realization: EXACTLY ONE provider call -------------------------------
    let draft;
    try {
      draft = await languageProvider.realize({
        input: languageInput,
        input_hash: inputHash,
        lawful_evidence_refs: lawfulEvidence
      });
    } catch (error) {
      if (error instanceof LanguageRealizationRejectionErrorV0) {
        const mapping: Record<LanguageRealizationRejectionCodeV0, ConversationResponseFailureStageV0> = {
          OUTPUT_TOO_LARGE: "LANGUAGE_SCHEMA_INVALID",
          MODEL_SCHEMA_INVALID: "LANGUAGE_SCHEMA_INVALID",
          INPUT_HASH_MISMATCH: "LANGUAGE_SCHEMA_INVALID",
          EVIDENCE_INVALID: "LANGUAGE_EVIDENCE_INVALID"
        };
        return failed(mapping[error.code], error.message);
      }
      return failed(
        "LANGUAGE_TRANSPORT_FAILED",
        error instanceof Error ? error.message : String(error)
      );
    }

    // ---- stale-context verification (the language call added latency) -----------------
    const freshSnapshot = (await this.deps.subjectCore.readCurrentSnapshot(
      ctx.subject_id
    )) as SubjectStateV0 | null;
    if (
      freshSnapshot === null ||
      freshSnapshot.identity.subject_id !== snapshot.identity.subject_id ||
      freshSnapshot.runtime_metadata.state_revision !== sourceRevision
    ) {
      return failed(
        "STALE_CONTEXT",
        "the subject/revision changed while the language provider was running; stale text is not delivered"
      );
    }

    // ---- host-built production behavior ------------------------------------------------
    const built = await buildCharacterLanguageBehaviorV0({
      subject_id: snapshot.identity.subject_id,
      source_revision: sourceRevision,
      response_request_id: requestId.value,
      draft
    });
    if (!built.ok) {
      return failed("LANGUAGE_SCHEMA_INVALID", built.detail);
    }
    return {
      kind: "OUTPUT_READY",
      behavior: built.behavior,
      trace: {
        language_input_hash: inputHash,
        cognition_projection_hash: evidenceProjection.projection_hash
      }
    };
  }
}
