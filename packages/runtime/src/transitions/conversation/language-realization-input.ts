/**
 * Versioned, host-owned language-realization input.
 *
 * V0 is the frozen original surface. V1 is the structured-conversation
 * extension used by v3 subjects and deliberately preserves its historical
 * null current_intent behavior. V2 is the canonical-Affect/v4 surface: it
 * carries the validated cognition current_intent and contains no raw Affect,
 * legacy affect channels, Mood, or reasoning summary. Affect can therefore
 * influence language only through the already-authoritative cognition result.
 */

import type {
  CanonicalRefV0,
  HashV1,
  IdentifierV0,
  StateRevisionV0
} from "@characteros-next/subject-core";
import {
  hashEnvelope,
  isRecord,
  validateCanonicalText,
  validateHash,
  validateIdentifier,
  validateRefArray,
  validateRefElement,
  validateStateRevision
} from "@characteros-next/subject-core";
import { validateCommunicationDirectiveV0 } from "@characteros-next/behavior";
import type {
  RelationshipInteractionFamiliarityCognitionInfluenceV0,
  RelationshipInteractionFamiliarityReadProjectionV0
} from "../../transitions/relationship/index.js";
import type {
  BeliefStanceProjectionV0,
  CognitiveContextProjectionAnyVersion,
  CognitionProposalV0
} from "../cognition-action/types.js";
import { validateCognitionProposal } from "../cognition-action/types.js";
import {
  CONVERSATION_COGNITION_PROPOSAL_HASH_PROJECTION_V2,
  deriveConversationCognitionProposalHashV3,
  deriveConversationCognitionProposalHashV4,
  deriveConversationCognitionProposalHashV5,
  validateConversationCognitionProposalV3,
  validateHostBoundConversationCognitionProposalV4,
  validateHostBoundConversationCognitionProposalV5,
  deriveConversationCognitionProposalHashV6,
  validateHostBoundConversationCognitionProposalV6,
  deriveConversationCognitionProposalHashV7,
  validateHostBoundConversationCognitionProposalV7,
  validateHostBoundConversationCognitionProposalV8,
  CONVERSATIONAL_ACT_KINDS_V0,
  validateSubjectiveChoiceV0,
  validateSubjectiveChoiceV1,
  validateSubjectiveSelectionV1,
  type ConversationCognitionProposalV3,
  type FactualAssessmentV0,
  type ConversationCognitionProposalV7,
  type ConversationalActKindV0,
  type SubjectiveChoiceV0,
  type SubjectiveChoiceV1,
  type SubjectiveSelectionV1
} from "./conversation-cognition-proposal.js";
import type { FactualAssessmentV1 } from "./factual-claim-authorization.js";

export const LANGUAGE_REALIZATION_INPUT_SCHEMA_VERSION_V0 =
  "language-realization-input-v0" as const;
export const LANGUAGE_REALIZATION_INPUT_SCHEMA_VERSION_V1 =
  "language-realization-input-v1" as const;
export const LANGUAGE_REALIZATION_INPUT_SCHEMA_VERSION_V2 =
  "language-realization-input-v2" as const;
/**
 * AFFECT_COGNITION_AUTHORITY_CONTRACT_AND_REVALIDATION_V0 — V3 binds the V2
 * conversation proposal (including `clarification_basis: null` on REALIZE).
 * V0/V1/V2 remain frozen and independently valid.
 */
export const LANGUAGE_REALIZATION_INPUT_SCHEMA_VERSION_V3 =
  "language-realization-input-v3" as const;
/** Family C2 explicit facts + selected intent handoff. */
export const LANGUAGE_REALIZATION_INPUT_SCHEMA_VERSION_V4 =
  "language-realization-input-v4" as const;

export const LANGUAGE_REALIZATION_INPUT_HASH_PROJECTION_V0 =
  "characteros-next/runtime/language-realization-input/v1" as const;
/** Frozen projection already used by the pre-existing structured v3 path. */
export const LANGUAGE_REALIZATION_INPUT_HASH_PROJECTION_V1 =
  "characteros-next/runtime/language-realization-input-v1/v1" as const;
export const LANGUAGE_REALIZATION_INPUT_HASH_PROJECTION_V2 =
  "characteros-next/runtime/language-realization-input-v2/v1" as const;
export const LANGUAGE_REALIZATION_INPUT_HASH_PROJECTION_V3 =
  "characteros-next/runtime/language-realization-input-v3/v1" as const;
export const LANGUAGE_REALIZATION_INPUT_HASH_PROJECTION_V4 =
  "characteros-next/runtime/language-realization-input-v4/v1" as const;
/** Family C3: facts + the already-selected subject choice. */
export const LANGUAGE_REALIZATION_INPUT_SCHEMA_VERSION_V5 =
  "language-realization-input-v5" as const;
export const LANGUAGE_REALIZATION_INPUT_HASH_PROJECTION_V5 =
  "characteros-next/runtime/language-realization-input-v5/v1" as const;
/** Family C4: facts + the tagged choice (applicability + subjective basis). */
export const LANGUAGE_REALIZATION_INPUT_SCHEMA_VERSION_V6 =
  "language-realization-input-v6" as const;
export const LANGUAGE_REALIZATION_INPUT_HASH_PROJECTION_V6 =
  "characteros-next/runtime/language-realization-input-v6/v1" as const;
/** Family C4.4: the renamed subjective-selection carrier. */
export const LANGUAGE_REALIZATION_INPUT_SCHEMA_VERSION_V7 =
  "language-realization-input-v7" as const;
export const LANGUAGE_REALIZATION_INPUT_HASH_PROJECTION_V7 =
  "characteros-next/runtime/language-realization-input-v7/v1" as const;
/** V7 cognition factual-authority handoff. */
export const LANGUAGE_REALIZATION_INPUT_SCHEMA_VERSION_V8 =
  "language-realization-input-v8" as const;
export const LANGUAGE_REALIZATION_INPUT_HASH_PROJECTION_V8 =
  "characteros-next/runtime/language-realization-input-v8/v1" as const;
/**
 * V9 closes the Language authority gap: the realization plan names which
 * ALREADY-authorized atoms constitute the primary response, the pre-Language
 * completeness gate refuses determined-content turns without an authorized
 * host-verifiable derivation, and the model-facing serialization excludes the
 * nonsemantic host request identity.
 */
export const LANGUAGE_REALIZATION_INPUT_SCHEMA_VERSION_V9 =
  "language-realization-input-v9" as const;
export const LANGUAGE_REALIZATION_INPUT_HASH_PROJECTION_V9 =
  "characteros-next/runtime/language-realization-input-v9/v1" as const;
export const LANGUAGE_REALIZATION_PLAN_SCHEMA_VERSION_V0 =
  "language-realization-plan-v0" as const;
export const LANGUAGE_MODEL_FACING_PAYLOAD_HASH_PROJECTION_V9 =
  "characteros-next/runtime/language-model-facing-payload/v9" as const;

/** Validated episode content resolved through the trusted Memory reader. */
export interface LanguageEpisodeContentV0 {
  readonly ref: CanonicalRefV0;
  readonly payload_hash: string;
  readonly scene: string;
}

/** Frozen language-stage output constraints. */
export interface LanguageRealizationConstraintsV0 {
  readonly max_text_code_points: 4096;
  readonly evidence_refs_only: true;
  readonly no_new_evidence_authority: true;
}

export interface LanguageCognitionProposalBindingV0 {
  readonly schema_version: "cognition-proposal-v0";
  readonly projection_hash: HashV1;
  readonly current_intent: string | null;
}

export interface LanguageCommunicationBindingV0 {
  readonly schema_version: "conversation-cognition-proposal-v1";
  readonly proposal_hash: HashV1;
  readonly directive: { readonly kind: "REALIZE_CURRENT_INTENT" };
}

/**
 * V2 conversation binding: the language stage accepts ONLY a REALIZE V2
 * proposal, whose clarification basis is structurally null. A V1 hash can never
 * satisfy this binding, and a modified basis changes the bound proposal hash.
 */
export interface LanguageCommunicationBindingV2 {
  readonly schema_version: "conversation-cognition-proposal-v2";
  readonly proposal_hash: HashV1;
  readonly directive: { readonly kind: "REALIZE_CURRENT_INTENT" };
  readonly clarification_basis: null;
}

export interface LanguageCommunicationBindingV3 {
  readonly schema_version: "conversation-cognition-proposal-v3";
  readonly proposal_hash: HashV1;
  readonly directive: { readonly kind: "REALIZE_CURRENT_INTENT" };
  readonly clarification_basis: null;
}

/**
 * V4 conversation binding (Family C3): the language stage accepts ONLY a V4
 * REALIZE proposal. `subjective_choice` is intrinsic to the bound proposal hash
 * — including when it is null — so Language can never be handed a stance that
 * Cognition did not select.
 */
export interface LanguageCommunicationBindingV4 {
  readonly schema_version: "conversation-cognition-proposal-v4";
  readonly proposal_hash: HashV1;
  readonly directive: { readonly kind: "REALIZE_CURRENT_INTENT" };
  readonly clarification_basis: null;
}

/**
 * V5 conversation binding (Family C4): the language stage accepts ONLY a V5
 * REALIZE proposal. The tagged choice (`NOT_APPLICABLE` | `SELECTED`, including
 * the subjective rationale) is intrinsic to the bound proposal hash, so Language
 * can never be handed a choice that Cognition did not produce.
 */
export interface LanguageCommunicationBindingV5 {
  readonly schema_version: "conversation-cognition-proposal-v5";
  readonly proposal_hash: HashV1;
  readonly directive: { readonly kind: "REALIZE_CURRENT_INTENT" };
  readonly clarification_basis: null;
}

/**
 * V6 conversation binding (Family C4.4): the language stage accepts ONLY a V6
 * REALIZE proposal. The tagged subjective selection (including the stance and the
 * bounded rationale) is intrinsic to the bound proposal hash.
 */
export interface LanguageCommunicationBindingV6 {
  readonly schema_version: "conversation-cognition-proposal-v6";
  readonly proposal_hash: HashV1;
  readonly directive: { readonly kind: "REALIZE_CURRENT_INTENT" };
  readonly clarification_basis: null;
}

export interface LanguageCommunicationBindingV7 {
  readonly schema_version: "conversation-cognition-proposal-v7";
  readonly proposal_hash: HashV1;
  readonly directive: { readonly kind: "REALIZE_CURRENT_INTENT" };
  readonly clarification_basis: null;
}

interface LanguageRealizationInputCommonV0 {
  readonly subject_id: IdentifierV0;
  readonly source_revision: StateRevisionV0;
  readonly response_request_id: IdentifierV0;
  readonly cognition_projection_hash: HashV1;
  readonly cognition_proposal_binding: LanguageCognitionProposalBindingV0;
  readonly scene: string;
  readonly task: string | null;
  readonly focus_refs: readonly CanonicalRefV0[];
  readonly active_entity_refs: readonly CanonicalRefV0[];
  readonly environment_refs: readonly CanonicalRefV0[];
  readonly current_observation_ref: CanonicalRefV0 | null;
  readonly belief_items: readonly BeliefStanceProjectionV0[];
  readonly traits_dimensions: Readonly<Record<string, number>>;
  readonly regulation: {
    readonly energy: number;
    readonly stress: number;
    readonly arousal: number;
    readonly fatigue: number;
  };
  readonly interaction_familiarity: readonly RelationshipInteractionFamiliarityReadProjectionV0[];
  readonly interaction_familiarity_cognition_influences: readonly RelationshipInteractionFamiliarityCognitionInfluenceV0[];
  readonly evidence_refs: readonly CanonicalRefV0[];
  readonly memory_episode_contents: readonly LanguageEpisodeContentV0[];
  readonly constraints: LanguageRealizationConstraintsV0;
}

interface LegacyAffectLanguageSurfaceV0 {
  readonly affect_channels: ReadonlyArray<{
    readonly channel: string;
    readonly strength: number;
  }>;
  readonly mood_baseline: number;
}

/** Frozen original language input retained for compatibility. */
export interface LanguageRealizationInputV0
  extends LanguageRealizationInputCommonV0,
    LegacyAffectLanguageSurfaceV0 {
  readonly schema_version: typeof LANGUAGE_REALIZATION_INPUT_SCHEMA_VERSION_V0;
}

/** Existing structured-conversation input, now made explicit and validated. */
export interface LanguageRealizationInputV1
  extends LanguageRealizationInputCommonV0,
    LegacyAffectLanguageSurfaceV0 {
  readonly schema_version: typeof LANGUAGE_REALIZATION_INPUT_SCHEMA_VERSION_V1;
  readonly communication_binding: LanguageCommunicationBindingV0;
}

/**
 * Canonical v4 handoff. There is intentionally no canonical_affect,
 * affect_channels, mood_baseline, or reasoning_summary member.
 */
export interface LanguageRealizationInputV2 extends LanguageRealizationInputCommonV0 {
  readonly schema_version: typeof LANGUAGE_REALIZATION_INPUT_SCHEMA_VERSION_V2;
  readonly communication_binding: LanguageCommunicationBindingV0;
}

/**
 * Canonical v4 handoff bound to the V2 conversation proposal. Still carries no
 * raw Affect: Affect reaches language only through the validated cognition
 * result.
 */
export interface LanguageRealizationInputV3 extends LanguageRealizationInputCommonV0 {
  readonly schema_version: typeof LANGUAGE_REALIZATION_INPUT_SCHEMA_VERSION_V3;
  readonly communication_binding: LanguageCommunicationBindingV2;
}

/**
 * C2 semantic handoff. It intentionally excludes raw Affect, Mood, regulation,
 * beliefs, personality and relationship state: Language receives the already
 * selected intent and the exact factual/supporting material needed to realize
 * it, not another opportunity to decide.
 */
export interface LanguageRealizationInputV4 {
  readonly schema_version: typeof LANGUAGE_REALIZATION_INPUT_SCHEMA_VERSION_V4;
  readonly subject_id: IdentifierV0;
  readonly source_revision: StateRevisionV0;
  readonly response_request_id: IdentifierV0;
  readonly current_turn_ref: CanonicalRefV0;
  readonly cognition_projection_hash: HashV1;
  readonly communication_binding: LanguageCommunicationBindingV3;
  readonly current_user_request: {
    readonly scene: string;
    readonly task: string | null;
  };
  readonly factual_assessment: FactualAssessmentV0;
  readonly selected_current_intent: string;
  readonly supporting_evidence: {
    readonly lawful_evidence_refs: readonly CanonicalRefV0[];
    readonly memory_episode_contents: readonly LanguageEpisodeContentV0[];
  };
  readonly constraints: LanguageRealizationConstraintsV0 & {
    readonly preserve_factual_assessment: true;
    readonly preserve_selected_intent: true;
    readonly no_invented_justification: true;
  };
}

export type LanguageRealizationInputAnyVersion =
  | LanguageRealizationInputV0
  | LanguageRealizationInputV1
  | LanguageRealizationInputV2
  | LanguageRealizationInputV3
  | LanguageRealizationInputV4
  | LanguageRealizationInputV5
  | LanguageRealizationInputV6
  | LanguageRealizationInputV7
  | LanguageRealizationInputV8
  | LanguageRealizationInputV9
  | LanguageRealizationInputV10;

/**
 * Family C3 handoff. Language receives the facts AND the already-selected subject
 * choice. It phrases them; it may not decide, recompute, or invent a stance —
 * in particular a null `selected_subjective_choice` forbids producing any
 * preference the subject did not have. No raw Affect is ever carried here.
 */
export interface LanguageRealizationInputV5 {
  readonly schema_version: typeof LANGUAGE_REALIZATION_INPUT_SCHEMA_VERSION_V5;
  readonly subject_id: IdentifierV0;
  readonly source_revision: StateRevisionV0;
  readonly response_request_id: IdentifierV0;
  readonly current_turn_ref: CanonicalRefV0;
  readonly cognition_projection_hash: HashV1;
  readonly communication_binding: LanguageCommunicationBindingV4;
  readonly current_user_request: {
    readonly scene: string;
    readonly task: string | null;
  };
  readonly factual_assessment: FactualAssessmentV0;
  readonly selected_subjective_choice: SubjectiveChoiceV0 | null;
  readonly supporting_evidence: {
    readonly lawful_evidence_refs: readonly CanonicalRefV0[];
    readonly memory_episode_contents: readonly LanguageEpisodeContentV0[];
  };
  readonly constraints: LanguageRealizationConstraintsV0 & {
    readonly preserve_factual_assessment: true;
    readonly preserve_selected_subjective_choice: true;
    readonly no_invented_choice: true;
    readonly no_invented_justification: true;
  };
}

/**
 * Family C4 handoff. Language receives the facts AND the tagged subject choice.
 * `NOT_APPLICABLE` forbids Language from producing any preference, willingness,
 * acceptance or refusal at all; `SELECTED` hands over the stance and the bounded
 * subjective rationale, which carries no factual authority. No raw Affect is
 * ever carried here.
 */
export interface LanguageRealizationInputV6 {
  readonly schema_version: typeof LANGUAGE_REALIZATION_INPUT_SCHEMA_VERSION_V6;
  readonly subject_id: IdentifierV0;
  readonly source_revision: StateRevisionV0;
  readonly response_request_id: IdentifierV0;
  readonly current_turn_ref: CanonicalRefV0;
  readonly cognition_projection_hash: HashV1;
  readonly communication_binding: LanguageCommunicationBindingV5;
  readonly current_user_request: {
    readonly scene: string;
    readonly task: string | null;
  };
  readonly factual_assessment: FactualAssessmentV0;
  readonly selected_subjective_choice: SubjectiveChoiceV1;
  readonly supporting_evidence: {
    readonly lawful_evidence_refs: readonly CanonicalRefV0[];
    readonly memory_episode_contents: readonly LanguageEpisodeContentV0[];
  };
  readonly constraints: LanguageRealizationConstraintsV0 & {
    readonly preserve_factual_assessment: true;
    readonly preserve_selected_subjective_choice: true;
    readonly no_invented_choice: true;
    readonly no_invented_justification: true;
    readonly no_factual_authority_for_rationale: true;
  };
}

export interface BuildLanguageRealizationInputV6Request {
  readonly subject_id: IdentifierV0;
  readonly source_revision: StateRevisionV0;
  readonly response_request_id: IdentifierV0;
  readonly projection: CognitiveContextProjectionAnyVersion;
  /** Unknown model result; the host revalidates the complete V5 proposal. */
  readonly conversation_proposal: unknown;
  readonly memory_episode_contents: readonly LanguageEpisodeContentV0[];
}

export type BuildLanguageRealizationInputV6Result =
  | { readonly ok: true; readonly input: LanguageRealizationInputV6; readonly input_hash: HashV1 }
  | { readonly ok: false; readonly detail: string };

/**
 * Family C4.4 handoff. Language receives the facts and the tagged subjective
 * selection under its explicit category names. `NO_SUBJECTIVE_SELECTION` forbids
 * Language from producing any preference at all; `SUBJECTIVE_SELECTION` hands over
 * the stance and the bounded subjective rationale, which carries no factual
 * authority. Ref handles never reach Language: the input carries canonical refs.
 */
export interface LanguageRealizationInputV7 {
  readonly schema_version: typeof LANGUAGE_REALIZATION_INPUT_SCHEMA_VERSION_V7;
  readonly subject_id: IdentifierV0;
  readonly source_revision: StateRevisionV0;
  readonly response_request_id: IdentifierV0;
  readonly current_turn_ref: CanonicalRefV0;
  readonly cognition_projection_hash: HashV1;
  readonly communication_binding: LanguageCommunicationBindingV6;
  readonly current_user_request: {
    readonly scene: string;
    readonly task: string | null;
  };
  readonly factual_assessment: FactualAssessmentV0;
  readonly selected_subjective_selection: SubjectiveSelectionV1;
  readonly supporting_evidence: {
    readonly lawful_evidence_refs: readonly CanonicalRefV0[];
    readonly memory_episode_contents: readonly LanguageEpisodeContentV0[];
  };
  readonly constraints: LanguageRealizationConstraintsV0 & {
    readonly preserve_factual_assessment: true;
    readonly preserve_selected_subjective_selection: true;
    readonly no_invented_choice: true;
    readonly no_invented_justification: true;
    readonly no_factual_authority_for_rationale: true;
  };
}

export interface BuildLanguageRealizationInputV7Request {
  readonly subject_id: IdentifierV0;
  readonly source_revision: StateRevisionV0;
  readonly response_request_id: IdentifierV0;
  readonly projection: CognitiveContextProjectionAnyVersion;
  /** Unknown model result; the host revalidates the complete V6 proposal. */
  readonly conversation_proposal: unknown;
  readonly memory_episode_contents: readonly LanguageEpisodeContentV0[];
}

export type BuildLanguageRealizationInputV7Result =
  | { readonly ok: true; readonly input: LanguageRealizationInputV7; readonly input_hash: HashV1 }
  | { readonly ok: false; readonly detail: string };

/** V8 is the mechanical Language carrier for a fully factual-authorized V7 proposal. */
export interface LanguageRealizationInputV8 {
  readonly schema_version: typeof LANGUAGE_REALIZATION_INPUT_SCHEMA_VERSION_V8;
  readonly subject_id: IdentifierV0;
  readonly source_revision: StateRevisionV0;
  readonly response_request_id: IdentifierV0;
  readonly current_turn_ref: CanonicalRefV0;
  readonly cognition_projection_hash: HashV1;
  readonly communication_binding: LanguageCommunicationBindingV7;
  readonly current_user_request: {
    readonly scene: string;
    readonly task: string | null;
  };
  readonly factual_assessment: FactualAssessmentV1;
  readonly selected_subjective_selection: SubjectiveSelectionV1;
  readonly supporting_evidence: {
    readonly lawful_evidence_refs: readonly CanonicalRefV0[];
    readonly memory_episode_contents: readonly LanguageEpisodeContentV0[];
  };
  readonly constraints: LanguageRealizationConstraintsV0 & {
    readonly preserve_factual_assessment: true;
    readonly preserve_selected_subjective_selection: true;
    readonly no_invented_choice: true;
    readonly no_invented_justification: true;
    readonly no_factual_authority_for_rationale: true;
  };
}

/**
 * Realization plan (LC-D): routing/selection metadata over atoms that are ALREADY
 * authoritative. It creates no authority of its own — it only names which existing
 * authorized semantics constitute the primary response Language must realize.
 */
export type LanguageRealizationPlanModeV0 =
  | "FACTUAL_DERIVATION_RESPONSE"
  | "SUBJECTIVE_SELECTION_RESPONSE"
  | "NO_FACTUAL_PRIMARY_RESPONSE";

export type LanguageRealizationPlanReferenceV0 =
  | {
      readonly kind: "FACTUAL_CLAIM";
      /** Index into factual_assessment.claims of an already-authorized claim. */
      readonly claim_index: number;
    }
  | { readonly kind: "SUBJECTIVE_STANCE" };

export interface LanguageRealizationPlanV0 {
  readonly schema_version: typeof LANGUAGE_REALIZATION_PLAN_SCHEMA_VERSION_V0;
  readonly mode: LanguageRealizationPlanModeV0;
  readonly references: readonly LanguageRealizationPlanReferenceV0[];
}

/** V9 is the Language carrier with a pre-Language realization completeness contract. */
export interface LanguageRealizationInputV9 {
  readonly schema_version: typeof LANGUAGE_REALIZATION_INPUT_SCHEMA_VERSION_V9;
  readonly subject_id: IdentifierV0;
  readonly source_revision: StateRevisionV0;
  /** Host carrier only: bound by input_hash and the invocation binding, never serialized to the model. */
  readonly response_request_id: IdentifierV0;
  readonly current_turn_ref: CanonicalRefV0;
  readonly cognition_projection_hash: HashV1;
  readonly communication_binding: LanguageCommunicationBindingV7;
  readonly current_user_request: {
    readonly scene: string;
    readonly task: string | null;
  };
  readonly factual_assessment: FactualAssessmentV1;
  readonly selected_subjective_selection: SubjectiveSelectionV1;
  readonly realization_plan: LanguageRealizationPlanV0;
  readonly supporting_evidence: {
    readonly lawful_evidence_refs: readonly CanonicalRefV0[];
    readonly memory_episode_contents: readonly LanguageEpisodeContentV0[];
  };
  readonly constraints: LanguageRealizationConstraintsV0 & {
    readonly preserve_factual_assessment: true;
    readonly preserve_selected_subjective_selection: true;
    readonly no_invented_choice: true;
    readonly no_invented_justification: true;
    readonly no_factual_authority_for_rationale: true;
    readonly realize_authorized_atoms_only: true;
  };
}

export interface BuildLanguageRealizationInputV8Request {
  readonly subject_id: IdentifierV0;
  readonly source_revision: StateRevisionV0;
  readonly response_request_id: IdentifierV0;
  readonly projection: CognitiveContextProjectionAnyVersion;
  readonly conversation_proposal: ConversationCognitionProposalV7 | unknown;
  readonly memory_episode_contents: readonly LanguageEpisodeContentV0[];
}

export type BuildLanguageRealizationInputV8Result =
  | { readonly ok: true; readonly input: LanguageRealizationInputV8; readonly input_hash: HashV1 }
  | { readonly ok: false; readonly detail: string };

export interface BuildLanguageRealizationInputV5Request {
  readonly subject_id: IdentifierV0;
  readonly source_revision: StateRevisionV0;
  readonly response_request_id: IdentifierV0;
  readonly projection: CognitiveContextProjectionAnyVersion;
  /** Unknown model result; the host revalidates the complete V4 proposal. */
  readonly conversation_proposal: unknown;
  readonly memory_episode_contents: readonly LanguageEpisodeContentV0[];
}

export type BuildLanguageRealizationInputV5Result =
  | { readonly ok: true; readonly input: LanguageRealizationInputV5; readonly input_hash: HashV1 }
  | { readonly ok: false; readonly detail: string };

export interface BuildLanguageRealizationInputV1Request {
  readonly subject_id: IdentifierV0;
  readonly source_revision: StateRevisionV0;
  readonly response_request_id: IdentifierV0;
  readonly projection: CognitiveContextProjectionAnyVersion;
  /** Unknown at this boundary; the host revalidates it before derivation. */
  readonly cognition: unknown;
  readonly conversation_cognition_proposal_hash: HashV1;
  readonly communication_directive: unknown;
  readonly memory_episode_contents: readonly LanguageEpisodeContentV0[];
}

export type BuildLanguageRealizationInputV1Result =
  | {
      readonly ok: true;
      readonly input:
        | LanguageRealizationInputV1
        | LanguageRealizationInputV2
        | LanguageRealizationInputV3;
      readonly input_hash: HashV1;
    }
  | { readonly ok: false; readonly detail: string };

export interface BuildLanguageRealizationInputV4Request {
  readonly subject_id: IdentifierV0;
  readonly source_revision: StateRevisionV0;
  readonly response_request_id: IdentifierV0;
  readonly projection: CognitiveContextProjectionAnyVersion;
  /** Unknown model result; the host revalidates the complete V3 proposal. */
  readonly conversation_proposal: unknown;
  readonly memory_episode_contents: readonly LanguageEpisodeContentV0[];
}

export type BuildLanguageRealizationInputV4Result =
  | { readonly ok: true; readonly input: LanguageRealizationInputV4; readonly input_hash: HashV1 }
  | { readonly ok: false; readonly detail: string };

const COMMON_KEYS = [
  "schema_version",
  "subject_id",
  "source_revision",
  "response_request_id",
  "cognition_projection_hash",
  "cognition_proposal_binding",
  "scene",
  "task",
  "focus_refs",
  "active_entity_refs",
  "environment_refs",
  "current_observation_ref",
  "belief_items",
  "traits_dimensions",
  "regulation",
  "interaction_familiarity",
  "interaction_familiarity_cognition_influences",
  "evidence_refs",
  "memory_episode_contents",
  "constraints"
] as const;
const LEGACY_KEYS = [...COMMON_KEYS, "affect_channels", "mood_baseline"] as const;
const STRUCTURED_LEGACY_KEYS = [...LEGACY_KEYS, "communication_binding"] as const;
const CANONICAL_KEYS = [...COMMON_KEYS, "communication_binding"] as const;
const BUILD_KEYS = [
  "subject_id",
  "source_revision",
  "response_request_id",
  "projection",
  "cognition",
  "conversation_cognition_proposal_hash",
  "communication_directive",
  "memory_episode_contents"
] as const;
const V4_KEYS = [
  "schema_version",
  "subject_id",
  "source_revision",
  "response_request_id",
  "current_turn_ref",
  "cognition_projection_hash",
  "communication_binding",
  "current_user_request",
  "factual_assessment",
  "selected_current_intent",
  "supporting_evidence",
  "constraints"
] as const;
const V5_KEYS = [
  "schema_version",
  "subject_id",
  "source_revision",
  "response_request_id",
  "current_turn_ref",
  "cognition_projection_hash",
  "communication_binding",
  "current_user_request",
  "factual_assessment",
  "selected_subjective_choice",
  "supporting_evidence",
  "constraints"
] as const;
const V6_KEYS = [
  "schema_version",
  "subject_id",
  "source_revision",
  "response_request_id",
  "current_turn_ref",
  "cognition_projection_hash",
  "communication_binding",
  "current_user_request",
  "factual_assessment",
  "selected_subjective_choice",
  "supporting_evidence",
  "constraints"
] as const;
const V7_KEYS = [
  "schema_version",
  "subject_id",
  "source_revision",
  "response_request_id",
  "current_turn_ref",
  "cognition_projection_hash",
  "communication_binding",
  "current_user_request",
  "factual_assessment",
  "selected_subjective_selection",
  "supporting_evidence",
  "constraints"
] as const;
const V8_KEYS = V7_KEYS;
const BUILD_V4_KEYS = [
  "subject_id",
  "source_revision",
  "response_request_id",
  "projection",
  "conversation_proposal",
  "memory_episode_contents"
] as const;

function exactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  detail: string
): string | null {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index])
    ? null
    : `${detail}: expected exactly [${wanted.join(",")}]`;
}

function validateCurrentIntent(value: unknown, detail: string): string | null {
  if (value === null) return null;
  const checked = validateCanonicalText(value, detail);
  return checked.ok ? null : checked.error.detail;
}

function validateFiniteRecord(
  value: unknown,
  keys: readonly string[],
  detail: string
): string | null {
  if (!isRecord(value)) return `${detail}: expected object`;
  const keyFailure = exactKeys(value, keys, detail);
  if (keyFailure !== null) return keyFailure;
  for (const key of keys) {
    if (typeof value[key] !== "number" || !Number.isFinite(value[key] as number)) {
      return `${detail}.${key}: expected finite number`;
    }
  }
  return null;
}

function validateEpisodeContents(value: unknown): string | null {
  if (!Array.isArray(value)) return "language input.memory_episode_contents: expected array";
  let previous: string | undefined;
  for (let index = 0; index < value.length; index += 1) {
    const item = value[index];
    const detail = `language input.memory_episode_contents[${index}]`;
    if (!isRecord(item)) return `${detail}: expected object`;
    const keyFailure = exactKeys(item, ["ref", "payload_hash", "scene"], detail);
    if (keyFailure !== null) return keyFailure;
    const ref = validateRefElement(item["ref"], `${detail}.ref`, ["episode"]);
    if (!ref.ok) return ref.error.detail;
    if (previous !== undefined && ref.value <= previous) {
      return `${detail}.ref: expected unique raw-ASCII ascending refs`;
    }
    previous = ref.value;
    const payloadHash = validateHash(item["payload_hash"] as string, `${detail}.payload_hash`);
    if (!payloadHash.ok) return payloadHash.error.detail;
    const scene = validateCanonicalText(item["scene"], `${detail}.scene`);
    if (!scene.ok) return scene.error.detail;
  }
  return null;
}

function validateInputCommon(value: Record<string, unknown>): string | null {
  if (typeof value["subject_id"] !== "string") return "language input.subject_id: expected string";
  const subject = validateIdentifier(value["subject_id"] as string, "language input.subject_id");
  if (!subject.ok) return subject.error.detail;
  const revision = validateStateRevision(value["source_revision"] as number, "language input.source_revision");
  if (!revision.ok) return revision.error.detail;
  if (typeof value["response_request_id"] !== "string") {
    return "language input.response_request_id: expected string";
  }
  const requestId = validateIdentifier(
    value["response_request_id"] as string,
    "language input.response_request_id"
  );
  if (!requestId.ok) return requestId.error.detail;
  const projectionHash = validateHash(
    value["cognition_projection_hash"] as string,
    "language input.cognition_projection_hash"
  );
  if (!projectionHash.ok) return projectionHash.error.detail;

  const binding = value["cognition_proposal_binding"];
  if (!isRecord(binding)) return "language input.cognition_proposal_binding: expected object";
  const bindingKeys = exactKeys(
    binding,
    ["schema_version", "projection_hash", "current_intent"],
    "language input.cognition_proposal_binding"
  );
  if (bindingKeys !== null) return bindingKeys;
  if (binding["schema_version"] !== "cognition-proposal-v0") {
    return "language input.cognition_proposal_binding.schema_version: unsupported cognition schema";
  }
  const bindingHash = validateHash(
    binding["projection_hash"] as string,
    "language input.cognition_proposal_binding.projection_hash"
  );
  if (!bindingHash.ok) return bindingHash.error.detail;
  if (bindingHash.value !== projectionHash.value) {
    return "language input cognition projection hashes disagree";
  }
  const intentFailure = validateCurrentIntent(
    binding["current_intent"],
    "language input.cognition_proposal_binding.current_intent"
  );
  if (intentFailure !== null) return intentFailure;

  const scene = validateCanonicalText(value["scene"], "language input.scene");
  if (!scene.ok) return scene.error.detail;
  if (value["task"] !== null) {
    const task = validateCanonicalText(value["task"], "language input.task");
    if (!task.ok) return task.error.detail;
  }
  for (const key of ["focus_refs", "active_entity_refs", "environment_refs", "evidence_refs"] as const) {
    const refs = validateRefArray(value[key], `language input.${key}`, { sorted: true });
    if (!refs.ok) return refs.error.detail;
  }
  if (value["current_observation_ref"] !== null) {
    const observation = validateRefElement(
      value["current_observation_ref"],
      "language input.current_observation_ref",
      ["observation"]
    );
    if (!observation.ok) return observation.error.detail;
  }
  if (!Array.isArray(value["belief_items"])) return "language input.belief_items: expected array";
  if (!isRecord(value["traits_dimensions"])) return "language input.traits_dimensions: expected object";
  for (const [dimension, number] of Object.entries(value["traits_dimensions"])) {
    if (dimension.length === 0 || typeof number !== "number" || !Number.isFinite(number)) {
      return `language input.traits_dimensions.${dimension}: expected finite number`;
    }
  }
  const regulationFailure = validateFiniteRecord(
    value["regulation"],
    ["energy", "stress", "arousal", "fatigue"],
    "language input.regulation"
  );
  if (regulationFailure !== null) return regulationFailure;
  if (!Array.isArray(value["interaction_familiarity"])) {
    return "language input.interaction_familiarity: expected array";
  }
  if (!Array.isArray(value["interaction_familiarity_cognition_influences"])) {
    return "language input.interaction_familiarity_cognition_influences: expected array";
  }
  const episodesFailure = validateEpisodeContents(value["memory_episode_contents"]);
  if (episodesFailure !== null) return episodesFailure;

  const constraints = value["constraints"];
  if (!isRecord(constraints)) return "language input.constraints: expected object";
  const constraintKeys = exactKeys(
    constraints,
    ["max_text_code_points", "evidence_refs_only", "no_new_evidence_authority"],
    "language input.constraints"
  );
  if (constraintKeys !== null) return constraintKeys;
  if (
    constraints["max_text_code_points"] !== 4096 ||
    constraints["evidence_refs_only"] !== true ||
    constraints["no_new_evidence_authority"] !== true
  ) {
    return "language input.constraints: frozen values required";
  }
  return null;
}

function validateCommunicationBinding(value: unknown): string | null {
  if (!isRecord(value)) return "language input.communication_binding: expected object";
  const keys = exactKeys(
    value,
    ["schema_version", "proposal_hash", "directive"],
    "language input.communication_binding"
  );
  if (keys !== null) return keys;
  if (value["schema_version"] !== "conversation-cognition-proposal-v1") {
    return "language input.communication_binding.schema_version: unsupported schema";
  }
  const proposalHash = validateHash(
    value["proposal_hash"] as string,
    "language input.communication_binding.proposal_hash"
  );
  if (!proposalHash.ok) return proposalHash.error.detail;
  const directive = validateCommunicationDirectiveV0(value["directive"]);
  if (!directive.ok || directive.directive.kind !== "REALIZE_CURRENT_INTENT") {
    return "language input.communication_binding.directive: REALIZE_CURRENT_INTENT required";
  }
  return null;
}

function validateCommunicationBindingV2(value: unknown): string | null {
  if (!isRecord(value)) return "language input.communication_binding: expected object";
  const keys = exactKeys(
    value,
    ["schema_version", "proposal_hash", "directive", "clarification_basis"],
    "language input.communication_binding"
  );
  if (keys !== null) return keys;
  if (value["schema_version"] !== "conversation-cognition-proposal-v2") {
    return "language input.communication_binding.schema_version: unsupported schema";
  }
  const proposalHash = validateHash(
    value["proposal_hash"] as string,
    "language input.communication_binding.proposal_hash"
  );
  if (!proposalHash.ok) return proposalHash.error.detail;
  const directive = validateCommunicationDirectiveV0(value["directive"]);
  if (!directive.ok || directive.directive.kind !== "REALIZE_CURRENT_INTENT") {
    return "language input.communication_binding.directive: REALIZE_CURRENT_INTENT required";
  }
  if (value["clarification_basis"] !== null) {
    return "language input.communication_binding.clarification_basis: must be null for REALIZE";
  }
  return null;
}

function validateLanguageRealizationInputV4(value: Record<string, unknown>): string | null {
  const keys = exactKeys(value, V4_KEYS, "language input v4");
  if (keys !== null) return keys;
  const subject = validateIdentifier(value["subject_id"] as string, "language input v4.subject_id");
  if (!subject.ok) return subject.error.detail;
  const revision = validateStateRevision(value["source_revision"] as number, "language input v4.source_revision");
  if (!revision.ok) return revision.error.detail;
  const requestId = validateIdentifier(value["response_request_id"] as string, "language input v4.response_request_id");
  if (!requestId.ok) return requestId.error.detail;
  const turnRef = validateRefElement(value["current_turn_ref"], "language input v4.current_turn_ref", ["observation"]);
  if (!turnRef.ok) return turnRef.error.detail;
  const projectionHash = validateHash(value["cognition_projection_hash"] as string, "language input v4.cognition_projection_hash");
  if (!projectionHash.ok) return projectionHash.error.detail;

  const binding = value["communication_binding"];
  if (!isRecord(binding)) return "language input v4.communication_binding: expected object";
  const bindingKeys = exactKeys(binding, ["schema_version", "proposal_hash", "directive", "clarification_basis"], "language input v4.communication_binding");
  if (bindingKeys !== null) return bindingKeys;
  if (binding["schema_version"] !== "conversation-cognition-proposal-v3") return "language input v4.communication_binding: V3 required";
  const proposalHash = validateHash(binding["proposal_hash"] as string, "language input v4.communication_binding.proposal_hash");
  if (!proposalHash.ok) return proposalHash.error.detail;
  const directive = validateCommunicationDirectiveV0(binding["directive"]);
  if (!directive.ok || directive.directive.kind !== "REALIZE_CURRENT_INTENT") return "language input v4.communication_binding: REALIZE required";
  if (binding["clarification_basis"] !== null) return "language input v4.communication_binding.clarification_basis: null required";

  const request = value["current_user_request"];
  if (!isRecord(request)) return "language input v4.current_user_request: expected object";
  const requestKeys = exactKeys(request, ["scene", "task"], "language input v4.current_user_request");
  if (requestKeys !== null) return requestKeys;
  const scene = validateCanonicalText(request["scene"], "language input v4.current_user_request.scene");
  if (!scene.ok) return scene.error.detail;
  if (request["task"] !== null) {
    const task = validateCanonicalText(request["task"], "language input v4.current_user_request.task");
    if (!task.ok) return task.error.detail;
  }
  const intent = validateCanonicalText(value["selected_current_intent"], "language input v4.selected_current_intent");
  if (!intent.ok) return intent.error.detail;
  if (intent.value.trim().length === 0) return "language input v4.selected_current_intent: non-empty required";

  const assessment = value["factual_assessment"];
  if (!isRecord(assessment) || exactKeys(assessment, ["claims"], "language input v4.factual_assessment") !== null || !Array.isArray(assessment["claims"])) {
    return "language input v4.factual_assessment: closed claims object required";
  }
  if (assessment["claims"].length > 8) return "language input v4.factual_assessment.claims: exceeds 8";
  for (let index = 0; index < assessment["claims"].length; index += 1) {
    const claim = assessment["claims"][index];
    if (!isRecord(claim)) return `language input v4.factual_assessment.claims[${index}]: expected object`;
    const claimKeys = exactKeys(claim, ["kind", "text", "source_refs"], `language input v4.factual_assessment.claims[${index}]`);
    if (claimKeys !== null) return claimKeys;
    if (claim["kind"] !== "SOURCE_QUOTE" && claim["kind"] !== "DERIVED_RESULT") return `language input v4.factual_assessment.claims[${index}].kind: unsupported`;
    const claimText = validateCanonicalText(claim["text"], `language input v4.factual_assessment.claims[${index}].text`);
    if (!claimText.ok || claimText.value.trim().length === 0 || [...claimText.value].length > 512) return `language input v4.factual_assessment.claims[${index}].text: invalid`;
    const refs = validateRefArray(claim["source_refs"], `language input v4.factual_assessment.claims[${index}].source_refs`, { sorted: true });
    if (!refs.ok || !Array.isArray(claim["source_refs"]) || claim["source_refs"].length === 0) return `language input v4.factual_assessment.claims[${index}].source_refs: invalid`;
  }

  const supporting = value["supporting_evidence"];
  if (!isRecord(supporting)) return "language input v4.supporting_evidence: expected object";
  const supportKeys = exactKeys(supporting, ["lawful_evidence_refs", "memory_episode_contents"], "language input v4.supporting_evidence");
  if (supportKeys !== null) return supportKeys;
  const lawfulRefs = validateRefArray(supporting["lawful_evidence_refs"], "language input v4.supporting_evidence.lawful_evidence_refs", { sorted: true });
  if (!lawfulRefs.ok) return lawfulRefs.error.detail;
  const episodeFailure = validateEpisodeContents(supporting["memory_episode_contents"]);
  if (episodeFailure !== null) return episodeFailure;
  for (const claim of assessment["claims"] as Array<Record<string, unknown>>) {
    for (const ref of claim["source_refs"] as string[]) {
      if (!(supporting["lawful_evidence_refs"] as string[]).includes(ref)) return `language input v4 factual source ${ref} absent from lawful evidence`;
    }
  }

  const constraints = value["constraints"];
  if (!isRecord(constraints)) return "language input v4.constraints: expected object";
  const constraintKeys = exactKeys(constraints, ["max_text_code_points", "evidence_refs_only", "no_new_evidence_authority", "preserve_factual_assessment", "preserve_selected_intent", "no_invented_justification"], "language input v4.constraints");
  if (constraintKeys !== null) return constraintKeys;
  if (constraints["max_text_code_points"] !== 4096 || constraints["evidence_refs_only"] !== true || constraints["no_new_evidence_authority"] !== true || constraints["preserve_factual_assessment"] !== true || constraints["preserve_selected_intent"] !== true || constraints["no_invented_justification"] !== true) {
    return "language input v4.constraints: frozen values required";
  }
  return null;
}

function validateCommunicationBindingV4(value: unknown): string | null {
  if (!isRecord(value)) return "language input v5.communication_binding: expected object";
  const keys = exactKeys(value, ["schema_version", "proposal_hash", "directive", "clarification_basis"], "language input v5.communication_binding");
  if (keys !== null) return keys;
  if (value["schema_version"] !== "conversation-cognition-proposal-v4") return "language input v5.communication_binding: V4 required";
  const proposalHash = validateHash(value["proposal_hash"] as string, "language input v5.communication_binding.proposal_hash");
  if (!proposalHash.ok) return proposalHash.error.detail;
  const directive = validateCommunicationDirectiveV0(value["directive"]);
  if (!directive.ok || directive.directive.kind !== "REALIZE_CURRENT_INTENT") return "language input v5.communication_binding: REALIZE required";
  if (value["clarification_basis"] !== null) return "language input v5.communication_binding.clarification_basis: null required";
  return null;
}

function validateCommunicationBindingV5(value: unknown): string | null {
  if (!isRecord(value)) return "language input v6.communication_binding: expected object";
  const keys = exactKeys(value, ["schema_version", "proposal_hash", "directive", "clarification_basis"], "language input v6.communication_binding");
  if (keys !== null) return keys;
  if (value["schema_version"] !== "conversation-cognition-proposal-v5") {
    return "language input v6.communication_binding.schema_version: expected conversation-cognition-proposal-v5";
  }
  const proposalHash = validateHash(value["proposal_hash"] as string, "language input v6.communication_binding.proposal_hash");
  if (!proposalHash.ok) return proposalHash.error.detail;
  const directive = validateCommunicationDirectiveV0(value["directive"]);
  if (!directive.ok || directive.directive.kind !== "REALIZE_CURRENT_INTENT") return "language input v6.communication_binding: REALIZE required";
  if (value["clarification_basis"] !== null) return "language input v6.communication_binding.clarification_basis: null required";
  return null;
}

function validateLanguageRealizationInputV5(value: Record<string, unknown>): string | null {
  const keys = exactKeys(value, V5_KEYS, "language input v5");
  if (keys !== null) return keys;
  const subject = validateIdentifier(value["subject_id"] as string, "language input v5.subject_id");
  if (!subject.ok) return subject.error.detail;
  const revision = validateStateRevision(value["source_revision"] as number, "language input v5.source_revision");
  if (!revision.ok) return revision.error.detail;
  const requestId = validateIdentifier(value["response_request_id"] as string, "language input v5.response_request_id");
  if (!requestId.ok) return requestId.error.detail;
  const turnRef = validateRefElement(value["current_turn_ref"], "language input v5.current_turn_ref", ["observation"]);
  if (!turnRef.ok) return turnRef.error.detail;
  const projectionHash = validateHash(value["cognition_projection_hash"] as string, "language input v5.cognition_projection_hash");
  if (!projectionHash.ok) return projectionHash.error.detail;
  const bindingFailure = validateCommunicationBindingV4(value["communication_binding"]);
  if (bindingFailure !== null) return bindingFailure;
  const request = value["current_user_request"];
  if (!isRecord(request)) return "language input v5.current_user_request: expected object";
  const requestKeys = exactKeys(request, ["scene", "task"], "language input v5.current_user_request");
  if (requestKeys !== null) return requestKeys;
  const scene = validateCanonicalText(request["scene"], "language input v5.current_user_request.scene");
  if (!scene.ok) return scene.error.detail;
  if (request["task"] !== null) {
    const task = validateCanonicalText(request["task"], "language input v5.current_user_request.task");
    if (!task.ok) return task.error.detail;
  }
  // The selected subject choice is the AUTHORITATIVE handoff; null is a lawful,
  // meaningful value (no selection was made) and must be preserved as null.
  const choice = value["selected_subjective_choice"];
  if (choice !== null) {
    const choiceCheck = validateSubjectiveChoiceV0(choice);
    if (!choiceCheck.ok) return `language input v5.${choiceCheck.detail}`;
  }
  const assessment = value["factual_assessment"];
  if (!isRecord(assessment) || exactKeys(assessment, ["claims"], "language input v5.factual_assessment") !== null || !Array.isArray(assessment["claims"])) {
    return "language input v5.factual_assessment: closed claims object required";
  }
  if (assessment["claims"].length > 8) return "language input v5.factual_assessment.claims: exceeds 8";
  for (let index = 0; index < assessment["claims"].length; index += 1) {
    const claim = assessment["claims"][index];
    if (!isRecord(claim)) return `language input v5.factual_assessment.claims[${index}]: expected object`;
    const claimKeys = exactKeys(claim, ["kind", "text", "source_refs"], `language input v5.factual_assessment.claims[${index}]`);
    if (claimKeys !== null) return claimKeys;
    if (claim["kind"] !== "SOURCE_QUOTE" && claim["kind"] !== "DERIVED_RESULT") return `language input v5.factual_assessment.claims[${index}].kind: unsupported`;
    const claimText = validateCanonicalText(claim["text"], `language input v5.factual_assessment.claims[${index}].text`);
    if (!claimText.ok || claimText.value.trim().length === 0 || [...claimText.value].length > 512) return `language input v5.factual_assessment.claims[${index}].text: invalid`;
    const refs = validateRefArray(claim["source_refs"], `language input v5.factual_assessment.claims[${index}].source_refs`, { sorted: true });
    if (!refs.ok || !Array.isArray(claim["source_refs"]) || claim["source_refs"].length === 0) return `language input v5.factual_assessment.claims[${index}].source_refs: invalid`;
  }
  const evidence = value["supporting_evidence"];
  if (!isRecord(evidence)) return "language input v5.supporting_evidence: expected object";
  const evidenceKeys = exactKeys(evidence, ["lawful_evidence_refs", "memory_episode_contents"], "language input v5.supporting_evidence");
  if (evidenceKeys !== null) return evidenceKeys;
  const lawful = validateRefArray(evidence["lawful_evidence_refs"], "language input v5.supporting_evidence.lawful_evidence_refs", { sorted: true });
  if (!lawful.ok) return lawful.error.detail;
  const episodeFailure = validateEpisodeContents(evidence["memory_episode_contents"]);
  if (episodeFailure !== null) return episodeFailure;
  const constraints = value["constraints"];
  if (!isRecord(constraints)) return "language input v5.constraints: expected object";
  const constraintKeys = exactKeys(constraints, ["max_text_code_points", "evidence_refs_only", "no_new_evidence_authority", "preserve_factual_assessment", "preserve_selected_subjective_choice", "no_invented_choice", "no_invented_justification"], "language input v5.constraints");
  if (constraintKeys !== null) return constraintKeys;
  if (constraints["max_text_code_points"] !== 4096 || constraints["evidence_refs_only"] !== true || constraints["no_new_evidence_authority"] !== true || constraints["preserve_factual_assessment"] !== true || constraints["preserve_selected_subjective_choice"] !== true || constraints["no_invented_choice"] !== true || constraints["no_invented_justification"] !== true) {
    return "language input v5.constraints: frozen values required";
  }
  return null;
}

function validateLanguageRealizationInputV6(value: Record<string, unknown>): string | null {
  const keys = exactKeys(value, V6_KEYS, "language input v6");
  if (keys !== null) return keys;
  const subject = validateIdentifier(value["subject_id"] as string, "language input v6.subject_id");
  if (!subject.ok) return subject.error.detail;
  const revision = validateStateRevision(value["source_revision"] as number, "language input v6.source_revision");
  if (!revision.ok) return revision.error.detail;
  const requestId = validateIdentifier(value["response_request_id"] as string, "language input v6.response_request_id");
  if (!requestId.ok) return requestId.error.detail;
  const turnRef = validateRefElement(value["current_turn_ref"], "language input v6.current_turn_ref", ["observation"]);
  if (!turnRef.ok) return turnRef.error.detail;
  const projectionHash = validateHash(value["cognition_projection_hash"] as string, "language input v6.cognition_projection_hash");
  if (!projectionHash.ok) return projectionHash.error.detail;
  const bindingFailure = validateCommunicationBindingV5(value["communication_binding"]);
  if (bindingFailure !== null) return bindingFailure;
  const request = value["current_user_request"];
  if (!isRecord(request)) return "language input v6.current_user_request: expected object";
  const requestKeys = exactKeys(request, ["scene", "task"], "language input v6.current_user_request");
  if (requestKeys !== null) return requestKeys;
  const scene = validateCanonicalText(request["scene"], "language input v6.current_user_request.scene");
  if (!scene.ok) return scene.error.detail;
  if (request["task"] !== null) {
    const task = validateCanonicalText(request["task"], "language input v6.current_user_request.task");
    if (!task.ok) return task.error.detail;
  }
  // The tagged choice is the AUTHORITATIVE handoff: `NOT_APPLICABLE` forbids any
  // invented preference, and `SELECTED` carries both the stance and the bounded
  // subjective rationale, which has no factual authority.
  const choiceCheck = validateSubjectiveChoiceV1(value["selected_subjective_choice"]);
  if (!choiceCheck.ok) return `language input v6.${choiceCheck.detail}`;
  const assessment = value["factual_assessment"];
  if (!isRecord(assessment) || exactKeys(assessment, ["claims"], "language input v6.factual_assessment") !== null || !Array.isArray(assessment["claims"])) {
    return "language input v6.factual_assessment: closed claims object required";
  }
  if (assessment["claims"].length > 8) return "language input v6.factual_assessment.claims: exceeds 8";
  for (let index = 0; index < assessment["claims"].length; index += 1) {
    const claim = assessment["claims"][index];
    if (!isRecord(claim)) return `language input v6.factual_assessment.claims[${index}]: expected object`;
    const claimKeys = exactKeys(claim, ["kind", "text", "source_refs"], `language input v6.factual_assessment.claims[${index}]`);
    if (claimKeys !== null) return claimKeys;
    if (claim["kind"] !== "SOURCE_QUOTE" && claim["kind"] !== "DERIVED_RESULT") return `language input v6.factual_assessment.claims[${index}].kind: unsupported`;
    const claimText = validateCanonicalText(claim["text"], `language input v6.factual_assessment.claims[${index}].text`);
    if (!claimText.ok || claimText.value.trim().length === 0 || [...claimText.value].length > 512) return `language input v6.factual_assessment.claims[${index}].text: invalid`;
    const refs = validateRefArray(claim["source_refs"], `language input v6.factual_assessment.claims[${index}].source_refs`, { sorted: true });
    if (!refs.ok || !Array.isArray(claim["source_refs"]) || claim["source_refs"].length === 0) return `language input v6.factual_assessment.claims[${index}].source_refs: invalid`;
  }
  const evidence = value["supporting_evidence"];
  if (!isRecord(evidence)) return "language input v6.supporting_evidence: expected object";
  const evidenceKeys = exactKeys(evidence, ["lawful_evidence_refs", "memory_episode_contents"], "language input v6.supporting_evidence");
  if (evidenceKeys !== null) return evidenceKeys;
  const lawful = validateRefArray(evidence["lawful_evidence_refs"], "language input v6.supporting_evidence.lawful_evidence_refs", { sorted: true });
  if (!lawful.ok) return lawful.error.detail;
  const episodeFailure = validateEpisodeContents(evidence["memory_episode_contents"]);
  if (episodeFailure !== null) return episodeFailure;
  const constraints = value["constraints"];
  if (!isRecord(constraints)) return "language input v6.constraints: expected object";
  const constraintKeys = exactKeys(constraints, ["max_text_code_points", "evidence_refs_only", "no_new_evidence_authority", "preserve_factual_assessment", "preserve_selected_subjective_choice", "no_invented_choice", "no_invented_justification", "no_factual_authority_for_rationale"], "language input v6.constraints");
  if (constraintKeys !== null) return constraintKeys;
  if (constraints["max_text_code_points"] !== 4096 || constraints["evidence_refs_only"] !== true || constraints["no_new_evidence_authority"] !== true || constraints["preserve_factual_assessment"] !== true || constraints["preserve_selected_subjective_choice"] !== true || constraints["no_invented_choice"] !== true || constraints["no_invented_justification"] !== true || constraints["no_factual_authority_for_rationale"] !== true) {
    return "language input v6.constraints: frozen values required";
  }
  return null;
}

function validateCommunicationBindingV6(value: unknown): string | null {
  if (!isRecord(value)) return "language input v7.communication_binding: expected object";
  const keys = exactKeys(value, ["schema_version", "proposal_hash", "directive", "clarification_basis"], "language input v7.communication_binding");
  if (keys !== null) return keys;
  if (value["schema_version"] !== "conversation-cognition-proposal-v6") {
    return "language input v7.communication_binding.schema_version: expected conversation-cognition-proposal-v6";
  }
  const proposalHash = validateHash(value["proposal_hash"] as string, "language input v7.communication_binding.proposal_hash");
  if (!proposalHash.ok) return proposalHash.error.detail;
  const directive = validateCommunicationDirectiveV0(value["directive"]);
  if (!directive.ok || directive.directive.kind !== "REALIZE_CURRENT_INTENT") return "language input v7.communication_binding: REALIZE required";
  if (value["clarification_basis"] !== null) return "language input v7.communication_binding.clarification_basis: null required";
  return null;
}

function validateCommunicationBindingV7(value: unknown): string | null {
  if (!isRecord(value)) return "language input v8.communication_binding: expected object";
  const keys = exactKeys(value, ["schema_version", "proposal_hash", "directive", "clarification_basis"], "language input v8.communication_binding");
  if (keys !== null) return keys;
  if (value["schema_version"] !== "conversation-cognition-proposal-v7") {
    return "language input v8.communication_binding.schema_version: expected conversation-cognition-proposal-v7";
  }
  const proposalHash = validateHash(value["proposal_hash"] as string, "language input v8.communication_binding.proposal_hash");
  if (!proposalHash.ok) return proposalHash.error.detail;
  const directive = validateCommunicationDirectiveV0(value["directive"]);
  if (!directive.ok || directive.directive.kind !== "REALIZE_CURRENT_INTENT") return "language input v8.communication_binding: REALIZE required";
  if (value["clarification_basis"] !== null) return "language input v8.communication_binding.clarification_basis: null required";
  return null;
}

function validateFactualAssessmentV1Carrier(value: unknown): string | null {
  if (!isRecord(value) || exactKeys(value, ["claims"], "language input v8.factual_assessment") !== null || !Array.isArray(value["claims"])) {
    return "language input v8.factual_assessment: closed claims object required";
  }
  if (value["claims"].length > 8) return "language input v8.factual_assessment.claims: exceeds 8";
  for (let index = 0; index < value["claims"].length; index += 1) {
    const claim = value["claims"][index];
    const detail = `language input v8.factual_assessment.claims[${index}]`;
    if (!isRecord(claim)) return `${detail}: expected object`;
    const commonText = validateCanonicalText(claim["text"], `${detail}.text`);
    if (!commonText.ok || commonText.value.trim().length === 0 || [...commonText.value].length > 512) {
      return `${detail}.text: invalid`;
    }
    const refs = validateRefArray(claim["source_refs"], `${detail}.source_refs`, { sorted: true });
    if (!refs.ok || !Array.isArray(claim["source_refs"]) || claim["source_refs"].length === 0) {
      return `${detail}.source_refs: invalid`;
    }
    if (claim["kind"] === "SOURCE_QUOTE") {
      const keys = exactKeys(claim, ["kind", "text", "source_refs"], detail);
      if (keys !== null) return keys;
      continue;
    }
    if (claim["kind"] !== "HOST_VERIFIABLE_DERIVATION") return `${detail}.kind: unsupported`;
    const keys = exactKeys(claim, ["kind", "operation", "source_refs", "derivation", "text"], detail);
    if (keys !== null) return keys;
    if (!isRecord(claim["derivation"])) return `${detail}.derivation: expected object`;
    const derivation = claim["derivation"];
    if (claim["operation"] === "INTEGER_ARITHMETIC") {
      const dKeys = exactKeys(derivation, ["source_expression", "operands", "claimed_result"], `${detail}.derivation`);
      if (dKeys !== null || !isRecord(derivation["operands"])) return `${detail}.derivation: invalid INTEGER_ARITHMETIC payload`;
      const operandKeys = exactKeys(derivation["operands"], ["left", "operator", "right"], `${detail}.derivation.operands`);
      if (operandKeys !== null) return operandKeys;
      if (!Number.isSafeInteger(derivation["operands"]["left"]) || !Number.isSafeInteger(derivation["operands"]["right"]) || (derivation["operands"]["operator"] !== "ADD" && derivation["operands"]["operator"] !== "SUBTRACT") || !Number.isSafeInteger(derivation["claimed_result"])) {
        return `${detail}.derivation: invalid INTEGER_ARITHMETIC values`;
      }
    } else if (claim["operation"] === "STRING_REVERSE") {
      const dKeys = exactKeys(derivation, ["source_instruction", "input", "claimed_result"], `${detail}.derivation`);
      if (dKeys !== null) return dKeys;
      for (const field of ["source_instruction", "input", "claimed_result"] as const) {
        const checked = validateCanonicalText(derivation[field], `${detail}.derivation.${field}`);
        if (!checked.ok || checked.value.trim().length === 0) return `${detail}.derivation.${field}: invalid`;
      }
    } else if (claim["operation"] === "RULE_CLASSIFICATION") {
      const dKeys = exactKeys(derivation, ["source_rule", "source_query", "claimed_result"], `${detail}.derivation`);
      if (dKeys !== null) return dKeys;
      for (const field of ["source_rule", "source_query", "claimed_result"] as const) {
        const checked = validateCanonicalText(derivation[field], `${detail}.derivation.${field}`);
        if (!checked.ok || checked.value.trim().length === 0) return `${detail}.derivation.${field}: invalid`;
      }
    } else {
      return `${detail}.operation: unsupported`;
    }
  }
  return null;
}

function validateLanguageRealizationInputV7(value: Record<string, unknown>): string | null {
  const keys = exactKeys(value, V7_KEYS, "language input v7");
  if (keys !== null) return keys;
  const subject = validateIdentifier(value["subject_id"] as string, "language input v7.subject_id");
  if (!subject.ok) return subject.error.detail;
  const revision = validateStateRevision(value["source_revision"] as number, "language input v7.source_revision");
  if (!revision.ok) return revision.error.detail;
  const requestId = validateIdentifier(value["response_request_id"] as string, "language input v7.response_request_id");
  if (!requestId.ok) return requestId.error.detail;
  const turnRef = validateRefElement(value["current_turn_ref"], "language input v7.current_turn_ref", ["observation"]);
  if (!turnRef.ok) return turnRef.error.detail;
  const projectionHash = validateHash(value["cognition_projection_hash"] as string, "language input v7.cognition_projection_hash");
  if (!projectionHash.ok) return projectionHash.error.detail;
  const bindingFailure = validateCommunicationBindingV6(value["communication_binding"]);
  if (bindingFailure !== null) return bindingFailure;
  const request = value["current_user_request"];
  if (!isRecord(request)) return "language input v7.current_user_request: expected object";
  const requestKeys = exactKeys(request, ["scene", "task"], "language input v7.current_user_request");
  if (requestKeys !== null) return requestKeys;
  const scene = validateCanonicalText(request["scene"], "language input v7.current_user_request.scene");
  if (!scene.ok) return scene.error.detail;
  if (request["task"] !== null) {
    const task = validateCanonicalText(request["task"], "language input v7.current_user_request.task");
    if (!task.ok) return task.error.detail;
  }
  const selectionCheck = validateSubjectiveSelectionV1(value["selected_subjective_selection"]);
  if (!selectionCheck.ok) return `language input v7.${selectionCheck.detail}`;
  const assessment = value["factual_assessment"];
  if (!isRecord(assessment) || exactKeys(assessment, ["claims"], "language input v7.factual_assessment") !== null || !Array.isArray(assessment["claims"])) {
    return "language input v7.factual_assessment: closed claims object required";
  }
  if (assessment["claims"].length > 8) return "language input v7.factual_assessment.claims: exceeds 8";
  for (let index = 0; index < assessment["claims"].length; index += 1) {
    const claim = assessment["claims"][index];
    if (!isRecord(claim)) return `language input v7.factual_assessment.claims[${index}]: expected object`;
    const claimKeys = exactKeys(claim, ["kind", "text", "source_refs"], `language input v7.factual_assessment.claims[${index}]`);
    if (claimKeys !== null) return claimKeys;
    if (claim["kind"] !== "SOURCE_QUOTE" && claim["kind"] !== "DERIVED_RESULT") return `language input v7.factual_assessment.claims[${index}].kind: unsupported`;
    const claimText = validateCanonicalText(claim["text"], `language input v7.factual_assessment.claims[${index}].text`);
    if (!claimText.ok || claimText.value.trim().length === 0 || [...claimText.value].length > 512) return `language input v7.factual_assessment.claims[${index}].text: invalid`;
    const refs = validateRefArray(claim["source_refs"], `language input v7.factual_assessment.claims[${index}].source_refs`, { sorted: true });
    if (!refs.ok || !Array.isArray(claim["source_refs"]) || claim["source_refs"].length === 0) return `language input v7.factual_assessment.claims[${index}].source_refs: invalid`;
  }
  const evidence = value["supporting_evidence"];
  if (!isRecord(evidence)) return "language input v7.supporting_evidence: expected object";
  const evidenceKeys = exactKeys(evidence, ["lawful_evidence_refs", "memory_episode_contents"], "language input v7.supporting_evidence");
  if (evidenceKeys !== null) return evidenceKeys;
  const lawful = validateRefArray(evidence["lawful_evidence_refs"], "language input v7.supporting_evidence.lawful_evidence_refs", { sorted: true });
  if (!lawful.ok) return lawful.error.detail;
  const episodeFailure = validateEpisodeContents(evidence["memory_episode_contents"]);
  if (episodeFailure !== null) return episodeFailure;
  const constraints = value["constraints"];
  if (!isRecord(constraints)) return "language input v7.constraints: expected object";
  const constraintKeys = exactKeys(constraints, ["max_text_code_points", "evidence_refs_only", "no_new_evidence_authority", "preserve_factual_assessment", "preserve_selected_subjective_selection", "no_invented_choice", "no_invented_justification", "no_factual_authority_for_rationale"], "language input v7.constraints");
  if (constraintKeys !== null) return constraintKeys;
  if (constraints["max_text_code_points"] !== 4096 || constraints["evidence_refs_only"] !== true || constraints["no_new_evidence_authority"] !== true || constraints["preserve_factual_assessment"] !== true || constraints["preserve_selected_subjective_selection"] !== true || constraints["no_invented_choice"] !== true || constraints["no_invented_justification"] !== true || constraints["no_factual_authority_for_rationale"] !== true) {
    return "language input v7.constraints: frozen values required";
  }
  return null;
}

function validateLanguageRealizationInputV8(value: Record<string, unknown>): string | null {
  const keys = exactKeys(value, V8_KEYS, "language input v8");
  if (keys !== null) return keys;
  const subject = validateIdentifier(value["subject_id"] as string, "language input v8.subject_id");
  if (!subject.ok) return subject.error.detail;
  const revision = validateStateRevision(value["source_revision"] as number, "language input v8.source_revision");
  if (!revision.ok) return revision.error.detail;
  const requestId = validateIdentifier(value["response_request_id"] as string, "language input v8.response_request_id");
  if (!requestId.ok) return requestId.error.detail;
  const turnRef = validateRefElement(value["current_turn_ref"], "language input v8.current_turn_ref", ["observation"]);
  if (!turnRef.ok) return turnRef.error.detail;
  const projectionHash = validateHash(value["cognition_projection_hash"] as string, "language input v8.cognition_projection_hash");
  if (!projectionHash.ok) return projectionHash.error.detail;
  const bindingFailure = validateCommunicationBindingV7(value["communication_binding"]);
  if (bindingFailure !== null) return bindingFailure;
  const request = value["current_user_request"];
  if (!isRecord(request)) return "language input v8.current_user_request: expected object";
  const requestKeys = exactKeys(request, ["scene", "task"], "language input v8.current_user_request");
  if (requestKeys !== null) return requestKeys;
  const scene = validateCanonicalText(request["scene"], "language input v8.current_user_request.scene");
  if (!scene.ok) return scene.error.detail;
  if (request["task"] !== null) {
    const task = validateCanonicalText(request["task"], "language input v8.current_user_request.task");
    if (!task.ok) return task.error.detail;
  }
  const selectionCheck = validateSubjectiveSelectionV1(value["selected_subjective_selection"]);
  if (!selectionCheck.ok) return `language input v8.${selectionCheck.detail}`;
  const assessmentFailure = validateFactualAssessmentV1Carrier(value["factual_assessment"]);
  if (assessmentFailure !== null) return assessmentFailure;
  const evidence = value["supporting_evidence"];
  if (!isRecord(evidence)) return "language input v8.supporting_evidence: expected object";
  const evidenceKeys = exactKeys(evidence, ["lawful_evidence_refs", "memory_episode_contents"], "language input v8.supporting_evidence");
  if (evidenceKeys !== null) return evidenceKeys;
  const lawful = validateRefArray(evidence["lawful_evidence_refs"], "language input v8.supporting_evidence.lawful_evidence_refs", { sorted: true });
  if (!lawful.ok) return lawful.error.detail;
  const episodeFailure = validateEpisodeContents(evidence["memory_episode_contents"]);
  if (episodeFailure !== null) return episodeFailure;
  const constraints = value["constraints"];
  if (!isRecord(constraints)) return "language input v8.constraints: expected object";
  const constraintKeys = exactKeys(constraints, ["max_text_code_points", "evidence_refs_only", "no_new_evidence_authority", "preserve_factual_assessment", "preserve_selected_subjective_selection", "no_invented_choice", "no_invented_justification", "no_factual_authority_for_rationale"], "language input v8.constraints");
  if (constraintKeys !== null) return constraintKeys;
  if (constraints["max_text_code_points"] !== 4096 || constraints["evidence_refs_only"] !== true || constraints["no_new_evidence_authority"] !== true || constraints["preserve_factual_assessment"] !== true || constraints["preserve_selected_subjective_selection"] !== true || constraints["no_invented_choice"] !== true || constraints["no_invented_justification"] !== true || constraints["no_factual_authority_for_rationale"] !== true) {
    return "language input v8.constraints: frozen values required";
  }
  return null;
}

const V9_KEYS = [...V8_KEYS, "realization_plan"];

function validateRealizationPlanV0(value: unknown, assessment: FactualAssessmentV1, selection: SubjectiveSelectionV1): string | null {
  if (!isRecord(value)) return "language input v9.realization_plan: expected object";
  const keys = exactKeys(value, ["schema_version", "mode", "references"], "language input v9.realization_plan");
  if (keys !== null) return keys;
  if (value["schema_version"] !== LANGUAGE_REALIZATION_PLAN_SCHEMA_VERSION_V0) {
    return "language input v9.realization_plan.schema_version: unsupported";
  }
  const mode = value["mode"];
  if (mode !== "FACTUAL_DERIVATION_RESPONSE" && mode !== "SUBJECTIVE_SELECTION_RESPONSE" && mode !== "NO_FACTUAL_PRIMARY_RESPONSE") {
    return "language input v9.realization_plan.mode: unsupported";
  }
  const references = value["references"];
  if (!Array.isArray(references)) return "language input v9.realization_plan.references: expected array";
  if (mode === "NO_FACTUAL_PRIMARY_RESPONSE" && references.length !== 0) {
    return "language input v9.realization_plan.references: conversational mode carries no references";
  }
  if (mode !== "NO_FACTUAL_PRIMARY_RESPONSE" && references.length === 0) {
    return "language input v9.realization_plan.references: nonempty array required";
  }
  const claims = assessment.claims;
  let derivationPrimary = false;
  let stancePrimary = false;
  for (let index = 0; index < references.length; index += 1) {
    const reference: unknown = references[index];
    if (!isRecord(reference)) return `language input v9.realization_plan.references[${index}]: expected object`;
    if (reference["kind"] === "FACTUAL_CLAIM") {
      const referenceKeys = exactKeys(reference, ["kind", "claim_index"], `language input v9.realization_plan.references[${index}]`);
      if (referenceKeys !== null) return referenceKeys;
      const claimIndex = reference["claim_index"];
      if (!Number.isInteger(claimIndex) || (claimIndex as number) < 0 || (claimIndex as number) >= claims.length) {
        return `language input v9.realization_plan.references[${index}].claim_index: out of range`;
      }
      if (claims[claimIndex as number]?.kind === "HOST_VERIFIABLE_DERIVATION") derivationPrimary = true;
      continue;
    }
    if (reference["kind"] === "SUBJECTIVE_STANCE") {
      const referenceKeys = exactKeys(reference, ["kind"], `language input v9.realization_plan.references[${index}]`);
      if (referenceKeys !== null) return referenceKeys;
      stancePrimary = true;
      continue;
    }
    return `language input v9.realization_plan.references[${index}].kind: unsupported`;
  }
  if (mode === "NO_FACTUAL_PRIMARY_RESPONSE") {
    if (selection.kind !== "NO_SUBJECTIVE_SELECTION") {
      return "language input v9.realization_plan.mode: conversational mode requires NO_SUBJECTIVE_SELECTION";
    }
    if (assessment.claims.length !== 0) {
      return "language input v9.realization_plan.mode: conversational mode requires no factual claims";
    }
    return null;
  }
  if (mode === "FACTUAL_DERIVATION_RESPONSE") {
    if (selection.kind !== "NO_SUBJECTIVE_SELECTION") {
      return "language input v9.realization_plan.mode: determined-content mode requires NO_SUBJECTIVE_SELECTION";
    }
    if (!derivationPrimary) {
      return "language input v9.realization_plan.references: determined-content mode requires at least one authorized host-verifiable derivation claim";
    }
    if (stancePrimary) return "language input v9.realization_plan.references: stance reference is not lawful in determined-content mode";
    return null;
  }
  if (selection.kind !== "SUBJECTIVE_SELECTION") {
    return "language input v9.realization_plan.mode: subjective mode requires an authoritative stance";
  }
  if (!stancePrimary) return "language input v9.realization_plan.references: subjective mode requires the authoritative stance";
  if (derivationPrimary) return "language input v9.realization_plan.references: factual claim references are not lawful in subjective mode";
  return null;
}

function validateLanguageRealizationInputV9(value: Record<string, unknown>): string | null {
  const keys = exactKeys(value, V9_KEYS, "language input v9");
  if (keys !== null) return keys;
  const subject = validateIdentifier(value["subject_id"] as string, "language input v9.subject_id");
  if (!subject.ok) return subject.error.detail;
  const revision = validateStateRevision(value["source_revision"] as number, "language input v9.source_revision");
  if (!revision.ok) return revision.error.detail;
  const requestId = validateIdentifier(value["response_request_id"] as string, "language input v9.response_request_id");
  if (!requestId.ok) return requestId.error.detail;
  const turnRef = validateRefElement(value["current_turn_ref"], "language input v9.current_turn_ref", ["observation"]);
  if (!turnRef.ok) return turnRef.error.detail;
  const projectionHash = validateHash(value["cognition_projection_hash"] as string, "language input v9.cognition_projection_hash");
  if (!projectionHash.ok) return projectionHash.error.detail;
  const bindingFailure = validateCommunicationBindingV7(value["communication_binding"]);
  if (bindingFailure !== null) return bindingFailure;
  const request = value["current_user_request"];
  if (!isRecord(request)) return "language input v9.current_user_request: expected object";
  const requestKeys = exactKeys(request, ["scene", "task"], "language input v9.current_user_request");
  if (requestKeys !== null) return requestKeys;
  const scene = validateCanonicalText(request["scene"], "language input v9.current_user_request.scene");
  if (!scene.ok) return scene.error.detail;
  if (request["task"] !== null) {
    const task = validateCanonicalText(request["task"], "language input v9.current_user_request.task");
    if (!task.ok) return task.error.detail;
  }
  const selectionCheck = validateSubjectiveSelectionV1(value["selected_subjective_selection"]);
  if (!selectionCheck.ok) return `language input v9.${selectionCheck.detail}`;
  const assessmentFailure = validateFactualAssessmentV1Carrier(value["factual_assessment"]);
  if (assessmentFailure !== null) return assessmentFailure;
  const planFailure = validateRealizationPlanV0(
    value["realization_plan"],
    value["factual_assessment"] as FactualAssessmentV1,
    selectionCheck.selection
  );
  if (planFailure !== null) return planFailure;
  const evidence = value["supporting_evidence"];
  if (!isRecord(evidence)) return "language input v9.supporting_evidence: expected object";
  const evidenceKeys = exactKeys(evidence, ["lawful_evidence_refs", "memory_episode_contents"], "language input v9.supporting_evidence");
  if (evidenceKeys !== null) return evidenceKeys;
  const lawful = validateRefArray(evidence["lawful_evidence_refs"], "language input v9.supporting_evidence.lawful_evidence_refs", { sorted: true });
  if (!lawful.ok) return lawful.error.detail;
  const episodeFailure = validateEpisodeContents(evidence["memory_episode_contents"]);
  if (episodeFailure !== null) return episodeFailure;
  const constraints = value["constraints"];
  if (!isRecord(constraints)) return "language input v9.constraints: expected object";
  const constraintKeys = exactKeys(constraints, ["max_text_code_points", "evidence_refs_only", "no_new_evidence_authority", "preserve_factual_assessment", "preserve_selected_subjective_selection", "no_invented_choice", "no_invented_justification", "no_factual_authority_for_rationale", "realize_authorized_atoms_only"], "language input v9.constraints");
  if (constraintKeys !== null) return constraintKeys;
  if (
    constraints["max_text_code_points"] !== 4096 ||
    constraints["evidence_refs_only"] !== true ||
    constraints["no_new_evidence_authority"] !== true ||
    constraints["preserve_factual_assessment"] !== true ||
    constraints["preserve_selected_subjective_selection"] !== true ||
    constraints["no_invented_choice"] !== true ||
    constraints["no_invented_justification"] !== true ||
    constraints["no_factual_authority_for_rationale"] !== true ||
    constraints["realize_authorized_atoms_only"] !== true
  ) {
    return "language input v9.constraints: frozen values required";
  }
  return null;
}

/** Closed, version-dispatched validation. Unknown or mixed schemas fail. */
export function validateLanguageRealizationInputAnyVersion(
  value: unknown
): { ok: true; input: LanguageRealizationInputAnyVersion } | { ok: false; detail: string } {
  if (!isRecord(value)) return { ok: false, detail: "language input: expected object" };
  const schema = value["schema_version"];
  if (schema === LANGUAGE_REALIZATION_INPUT_SCHEMA_VERSION_V10) {
    const v10Failure = validateLanguageRealizationInputV10(value);
    return v10Failure === null
      ? { ok: true, input: value as unknown as LanguageRealizationInputV10 }
      : { ok: false, detail: v10Failure };
  }
  if (schema === LANGUAGE_REALIZATION_INPUT_SCHEMA_VERSION_V9) {
    const v9Failure = validateLanguageRealizationInputV9(value);
    return v9Failure === null
      ? { ok: true, input: value as unknown as LanguageRealizationInputV9 }
      : { ok: false, detail: v9Failure };
  }
  if (schema === LANGUAGE_REALIZATION_INPUT_SCHEMA_VERSION_V8) {
    const v8Failure = validateLanguageRealizationInputV8(value);
    return v8Failure === null
      ? { ok: true, input: value as unknown as LanguageRealizationInputV8 }
      : { ok: false, detail: v8Failure };
  }
  if (schema === LANGUAGE_REALIZATION_INPUT_SCHEMA_VERSION_V7) {
    const v7Failure = validateLanguageRealizationInputV7(value);
    return v7Failure === null
      ? { ok: true, input: value as unknown as LanguageRealizationInputV7 }
      : { ok: false, detail: v7Failure };
  }
  if (schema === LANGUAGE_REALIZATION_INPUT_SCHEMA_VERSION_V6) {
    const v6Failure = validateLanguageRealizationInputV6(value);
    return v6Failure === null
      ? { ok: true, input: value as unknown as LanguageRealizationInputV6 }
      : { ok: false, detail: v6Failure };
  }
  if (schema === LANGUAGE_REALIZATION_INPUT_SCHEMA_VERSION_V5) {
    const v5Failure = validateLanguageRealizationInputV5(value);
    return v5Failure === null
      ? { ok: true, input: value as unknown as LanguageRealizationInputV5 }
      : { ok: false, detail: v5Failure };
  }
  if (schema === LANGUAGE_REALIZATION_INPUT_SCHEMA_VERSION_V4) {
    const v4Failure = validateLanguageRealizationInputV4(value);
    return v4Failure === null
      ? { ok: true, input: value as unknown as LanguageRealizationInputV4 }
      : { ok: false, detail: v4Failure };
  }
  const expected =
    schema === LANGUAGE_REALIZATION_INPUT_SCHEMA_VERSION_V0
      ? LEGACY_KEYS
      : schema === LANGUAGE_REALIZATION_INPUT_SCHEMA_VERSION_V1
        ? STRUCTURED_LEGACY_KEYS
        : schema === LANGUAGE_REALIZATION_INPUT_SCHEMA_VERSION_V2 ||
            schema === LANGUAGE_REALIZATION_INPUT_SCHEMA_VERSION_V3
          ? CANONICAL_KEYS
          : null;
  if (expected === null) {
    return { ok: false, detail: "language input.schema_version: unsupported version" };
  }
  const keyFailure = exactKeys(value, expected, "language input");
  if (keyFailure !== null) return { ok: false, detail: keyFailure };
  const commonFailure = validateInputCommon(value);
  if (commonFailure !== null) return { ok: false, detail: commonFailure };

  if (schema === LANGUAGE_REALIZATION_INPUT_SCHEMA_VERSION_V0 || schema === LANGUAGE_REALIZATION_INPUT_SCHEMA_VERSION_V1) {
    if (!Array.isArray(value["affect_channels"])) {
      return { ok: false, detail: "language input.affect_channels: expected array" };
    }
    if (typeof value["mood_baseline"] !== "number" || !Number.isFinite(value["mood_baseline"] as number)) {
      return { ok: false, detail: "language input.mood_baseline: expected finite number" };
    }
  }
  if (schema === LANGUAGE_REALIZATION_INPUT_SCHEMA_VERSION_V1 || schema === LANGUAGE_REALIZATION_INPUT_SCHEMA_VERSION_V2) {
    const communicationFailure = validateCommunicationBinding(value["communication_binding"]);
    if (communicationFailure !== null) return { ok: false, detail: communicationFailure };
  }
  if (schema === LANGUAGE_REALIZATION_INPUT_SCHEMA_VERSION_V3) {
    const communicationFailure = validateCommunicationBindingV2(value["communication_binding"]);
    if (communicationFailure !== null) return { ok: false, detail: communicationFailure };
  }
  if (
    schema === LANGUAGE_REALIZATION_INPUT_SCHEMA_VERSION_V1 &&
    (value["cognition_proposal_binding"] as Record<string, unknown>)["current_intent"] !== null
  ) {
    return { ok: false, detail: "language input v1 requires the frozen null current_intent" };
  }
  return { ok: true, input: value as unknown as LanguageRealizationInputAnyVersion };
}

/** Deterministic hash dispatcher; callers cannot select a projection manually. */
export async function deriveLanguageRealizationInputHashAnyVersion(
  input: LanguageRealizationInputAnyVersion
): Promise<HashV1> {
  if (input.schema_version === LANGUAGE_REALIZATION_INPUT_SCHEMA_VERSION_V10) {
    return hashEnvelope(LANGUAGE_REALIZATION_INPUT_HASH_PROJECTION_V10, input);
  }
  if (input.schema_version === LANGUAGE_REALIZATION_INPUT_SCHEMA_VERSION_V9) {
    return hashEnvelope(LANGUAGE_REALIZATION_INPUT_HASH_PROJECTION_V9, input);
  }
  if (input.schema_version === LANGUAGE_REALIZATION_INPUT_SCHEMA_VERSION_V8) {
    return hashEnvelope(LANGUAGE_REALIZATION_INPUT_HASH_PROJECTION_V8, input);
  }
  if (input.schema_version === LANGUAGE_REALIZATION_INPUT_SCHEMA_VERSION_V0) {
    return hashEnvelope(LANGUAGE_REALIZATION_INPUT_HASH_PROJECTION_V0, input);
  }
  if (input.schema_version === LANGUAGE_REALIZATION_INPUT_SCHEMA_VERSION_V1) {
    return hashEnvelope(LANGUAGE_REALIZATION_INPUT_HASH_PROJECTION_V1, input);
  }
  if (input.schema_version === LANGUAGE_REALIZATION_INPUT_SCHEMA_VERSION_V2) {
    return hashEnvelope(LANGUAGE_REALIZATION_INPUT_HASH_PROJECTION_V2, input);
  }
  if (input.schema_version === LANGUAGE_REALIZATION_INPUT_SCHEMA_VERSION_V3) {
    return hashEnvelope(LANGUAGE_REALIZATION_INPUT_HASH_PROJECTION_V3, input);
  }
  if (input.schema_version === LANGUAGE_REALIZATION_INPUT_SCHEMA_VERSION_V4) {
    return hashEnvelope(LANGUAGE_REALIZATION_INPUT_HASH_PROJECTION_V4, input);
  }
  if (input.schema_version === LANGUAGE_REALIZATION_INPUT_SCHEMA_VERSION_V5) {
    return hashEnvelope(LANGUAGE_REALIZATION_INPUT_HASH_PROJECTION_V5, input);
  }
  return hashEnvelope(LANGUAGE_REALIZATION_INPUT_HASH_PROJECTION_V6, input);
}

/** Frozen V0 compatibility helper. */
export async function deriveLanguageRealizationInputHashV0(
  input: LanguageRealizationInputV0
): Promise<HashV1> {
  return deriveLanguageRealizationInputHashAnyVersion(input);
}

/**
 * The one trusted cognition-to-language derivation boundary. The caller cannot
 * separately supply current_intent; it is taken only from the revalidated
 * cognition proposal. Version dispatch is selected only by projection schema.
 */
export async function buildLanguageRealizationInputV1(
  request: BuildLanguageRealizationInputV1Request
): Promise<BuildLanguageRealizationInputV1Result> {
  if (!isRecord(request)) return { ok: false, detail: "language input build request: expected object" };
  const requestKeys = exactKeys(request, BUILD_KEYS, "language input build request");
  if (requestKeys !== null) return { ok: false, detail: requestKeys };
  if (!isRecord(request.projection)) {
    return { ok: false, detail: "language input build request.projection: expected object" };
  }
  if (
    request.projection.schema_version !== "cognitive-context-projection-v0" &&
    request.projection.schema_version !== "cognitive-context-projection-v1" &&
    request.projection.schema_version !== "cognitive-context-projection-v2"
  ) {
    return { ok: false, detail: "language input build request.projection: unsupported schema" };
  }

  const cognitionCheck = validateCognitionProposal(request.cognition);
  if (!cognitionCheck.ok) return { ok: false, detail: cognitionCheck.error.detail };
  const cognition: CognitionProposalV0 = cognitionCheck.value;
  if (cognition.action_intent !== null) {
    return { ok: false, detail: "language input requires cognition.action_intent null" };
  }
  if (cognition.projection_hash !== request.projection.projection_hash) {
    return { ok: false, detail: "language input cognition/projection hash mismatch" };
  }
  if (request.subject_id !== request.projection.subject_id) {
    return { ok: false, detail: "language input subject/projection mismatch" };
  }
  if (request.source_revision !== request.projection.state_revision) {
    return { ok: false, detail: "language input revision/projection mismatch" };
  }
  const directiveCheck = validateCommunicationDirectiveV0(request.communication_directive);
  if (!directiveCheck.ok || directiveCheck.directive.kind !== "REALIZE_CURRENT_INTENT") {
    return { ok: false, detail: "language input requires validated REALIZE_CURRENT_INTENT directive" };
  }
  const proposalHashCheck = validateHash(
    request.conversation_cognition_proposal_hash,
    "conversation cognition proposal hash"
  );
  if (!proposalHashCheck.ok) return { ok: false, detail: proposalHashCheck.error.detail };
  const isV2Conversation = request.projection.schema_version === "cognitive-context-projection-v2";
  const expectedProposalHash = isV2Conversation
    ? await hashEnvelope(CONVERSATION_COGNITION_PROPOSAL_HASH_PROJECTION_V2, {
        schema_version: "conversation-cognition-proposal-v2",
        cognition,
        communication_directive: directiveCheck.directive,
        clarification_basis: null
      })
    : await hashEnvelope("characteros-next/runtime/conversation-cognition-proposal/v1", {
        schema_version: "conversation-cognition-proposal-v1",
        cognition,
        communication_directive: directiveCheck.directive
      });
  if (expectedProposalHash !== proposalHashCheck.value) {
    return { ok: false, detail: "conversation cognition proposal hash mismatch" };
  }

  const evidenceRefs = [...new Set<string>([
    ...(request.projection.memory_working_refs as readonly string[]),
    ...(request.projection.recent_retrieval_refs as readonly string[])
  ])].sort() as unknown as readonly CanonicalRefV0[];
  const common = {
    subject_id: request.subject_id,
    source_revision: request.source_revision,
    response_request_id: request.response_request_id,
    cognition_projection_hash: request.projection.projection_hash,
    cognition_proposal_binding: {
      schema_version: "cognition-proposal-v0" as const,
      projection_hash: request.projection.projection_hash,
      current_intent: isV2Conversation ? cognition.current_intent : null
    },
    scene: request.projection.context.scene,
    task: request.projection.context.task,
    focus_refs: [...request.projection.context.focus_refs],
    active_entity_refs: [...request.projection.context.active_entity_refs],
    environment_refs: [...request.projection.context.environment_refs],
    current_observation_ref: request.projection.context.current_observation_ref,
    belief_items: [...request.projection.belief_items],
    traits_dimensions: { ...request.projection.traits_dimensions },
    regulation: { ...request.projection.regulation },
    interaction_familiarity: [...request.projection.interaction_familiarity],
    interaction_familiarity_cognition_influences: [
      ...request.projection.interaction_familiarity_cognition_influences
    ],
    evidence_refs: evidenceRefs,
    memory_episode_contents: [...request.memory_episode_contents],
    constraints: {
      max_text_code_points: 4096 as const,
      evidence_refs_only: true as const,
      no_new_evidence_authority: true as const
    }
  };

  const input: LanguageRealizationInputV1 | LanguageRealizationInputV2 | LanguageRealizationInputV3 =
    isV2Conversation
      ? {
          schema_version: LANGUAGE_REALIZATION_INPUT_SCHEMA_VERSION_V3,
          ...common,
          communication_binding: {
            schema_version: "conversation-cognition-proposal-v2" as const,
            proposal_hash: proposalHashCheck.value,
            directive: { kind: "REALIZE_CURRENT_INTENT" as const },
            clarification_basis: null
          }
        }
      : {
          schema_version: LANGUAGE_REALIZATION_INPUT_SCHEMA_VERSION_V1,
          ...common,
          communication_binding: {
            schema_version: "conversation-cognition-proposal-v1" as const,
            proposal_hash: proposalHashCheck.value,
            directive: { kind: "REALIZE_CURRENT_INTENT" as const }
          },
          affect_channels: [...request.projection.affect_channels],
          mood_baseline: request.projection.mood_baseline
        };
  const checked = validateLanguageRealizationInputAnyVersion(input);
  if (!checked.ok) return checked;
  const frozen = cloneAndFreeze(input);
  return {
    ok: true,
    input: frozen,
    input_hash: await deriveLanguageRealizationInputHashAnyVersion(frozen)
  };
}

/** Trusted C2 proposal-to-language derivation. The caller cannot supply facts or intent separately. */
export async function buildLanguageRealizationInputV4(
  request: BuildLanguageRealizationInputV4Request
): Promise<BuildLanguageRealizationInputV4Result> {
  if (!isRecord(request)) return { ok: false, detail: "language input v4 build request: expected object" };
  const requestKeys = exactKeys(request, BUILD_V4_KEYS, "language input v4 build request");
  if (requestKeys !== null) return { ok: false, detail: requestKeys };
  if (!isRecord(request.projection)) return { ok: false, detail: "language input v4 build request.projection: expected object" };
  if (request.projection.schema_version !== "cognitive-context-projection-v2") {
    return { ok: false, detail: "language input v4 requires cognitive-context-projection-v2" };
  }
  if (request.subject_id !== request.projection.subject_id) return { ok: false, detail: "language input v4 subject/projection mismatch" };
  if (request.source_revision !== request.projection.state_revision) return { ok: false, detail: "language input v4 revision/projection mismatch" };
  if (request.projection.context.current_observation_ref === null) return { ok: false, detail: "language input v4 requires current observation turn identity" };
  const requestId = validateIdentifier(request.response_request_id as string, "language input v4 response_request_id");
  if (!requestId.ok) return { ok: false, detail: requestId.error.detail };
  const proposalCheck = validateConversationCognitionProposalV3(request.conversation_proposal, request.projection);
  if (!proposalCheck.ok) return { ok: false, detail: proposalCheck.detail };
  const proposal: ConversationCognitionProposalV3 = proposalCheck.proposal;
  if (proposal.communication_directive.kind !== "REALIZE_CURRENT_INTENT" || proposal.clarification_basis !== null) {
    return { ok: false, detail: "language input v4 requires a V3 REALIZE proposal" };
  }
  if (proposal.cognition.current_intent === null) return { ok: false, detail: "language input v4 requires selected current_intent" };
  const episodeFailure = validateEpisodeContents(request.memory_episode_contents);
  if (episodeFailure !== null) return { ok: false, detail: episodeFailure };
  const lawfulEvidenceRefs = [...new Set<string>([
    ...request.projection.memory_working_refs,
    ...request.projection.recent_retrieval_refs,
    ...request.projection.context.focus_refs,
    ...request.projection.context.active_entity_refs,
    ...request.projection.context.environment_refs,
    request.projection.context.current_observation_ref
  ])].sort() as unknown as readonly CanonicalRefV0[];
  const input: LanguageRealizationInputV4 = {
    schema_version: LANGUAGE_REALIZATION_INPUT_SCHEMA_VERSION_V4,
    subject_id: request.subject_id,
    source_revision: request.source_revision,
    response_request_id: requestId.value,
    current_turn_ref: request.projection.context.current_observation_ref,
    cognition_projection_hash: request.projection.projection_hash,
    communication_binding: {
      schema_version: "conversation-cognition-proposal-v3",
      proposal_hash: await deriveConversationCognitionProposalHashV3(proposal),
      directive: { kind: "REALIZE_CURRENT_INTENT" },
      clarification_basis: null
    },
    current_user_request: {
      scene: request.projection.context.scene,
      task: request.projection.context.task
    },
    factual_assessment: proposal.factual_assessment,
    selected_current_intent: proposal.cognition.current_intent,
    supporting_evidence: {
      lawful_evidence_refs: lawfulEvidenceRefs,
      memory_episode_contents: [...request.memory_episode_contents]
    },
    constraints: {
      max_text_code_points: 4096,
      evidence_refs_only: true,
      no_new_evidence_authority: true,
      preserve_factual_assessment: true,
      preserve_selected_intent: true,
      no_invented_justification: true
    }
  };
  const checked = validateLanguageRealizationInputAnyVersion(input);
  if (!checked.ok) return checked;
  const frozen = cloneAndFreeze(input);
  return { ok: true, input: frozen, input_hash: await deriveLanguageRealizationInputHashAnyVersion(frozen) };
}

/**
 * Family C3 cognition-to-language derivation boundary. The V4 proposal is
 * revalidated here (including its `subjective_choice`, whose null-ness is part
 * of the bound proposal hash) against the AUTHORITATIVE projection hash supplied
 * by the host from the exact cognition invocation — never from model output.
 */
export async function buildLanguageRealizationInputV5(
  request: BuildLanguageRealizationInputV5Request
): Promise<BuildLanguageRealizationInputV5Result> {
  if (!isRecord(request)) return { ok: false, detail: "language input v5 build request: expected object" };
  const requestKeys = exactKeys(request, BUILD_V4_KEYS, "language input v5 build request");
  if (requestKeys !== null) return { ok: false, detail: requestKeys };
  if (!isRecord(request.projection)) return { ok: false, detail: "language input v5 build request.projection: expected object" };
  if (request.projection.schema_version !== "cognitive-context-projection-v2") {
    return { ok: false, detail: "language input v5 requires cognitive-context-projection-v2" };
  }
  if (request.subject_id !== request.projection.subject_id) return { ok: false, detail: "language input v5 subject/projection mismatch" };
  if (request.source_revision !== request.projection.state_revision) return { ok: false, detail: "language input v5 revision/projection mismatch" };
  if (request.projection.context.current_observation_ref === null) return { ok: false, detail: "language input v5 requires current observation turn identity" };
  const requestId = validateIdentifier(request.response_request_id as string, "language input v5 response_request_id");
  if (!requestId.ok) return { ok: false, detail: requestId.error.detail };

  const proposalCheck = validateHostBoundConversationCognitionProposalV4(
    request.conversation_proposal,
    request.projection
  );
  if (!proposalCheck.ok) return { ok: false, detail: proposalCheck.detail };
  const proposal = proposalCheck.proposal;
  if (proposal.communication_directive.kind !== "REALIZE_CURRENT_INTENT" || proposal.clarification_basis !== null) {
    return { ok: false, detail: "language input v5 requires a V4 REALIZE proposal" };
  }
  const episodeFailure = validateEpisodeContents(request.memory_episode_contents);
  if (episodeFailure !== null) return { ok: false, detail: episodeFailure };

  const lawfulEvidenceRefs = [...new Set<string>([
    ...request.projection.memory_working_refs,
    ...request.projection.recent_retrieval_refs,
    ...request.projection.context.focus_refs,
    ...request.projection.context.active_entity_refs,
    ...request.projection.context.environment_refs,
    request.projection.context.current_observation_ref
  ])].sort() as unknown as readonly CanonicalRefV0[];

  const input: LanguageRealizationInputV5 = {
    schema_version: LANGUAGE_REALIZATION_INPUT_SCHEMA_VERSION_V5,
    subject_id: request.subject_id,
    source_revision: request.source_revision,
    response_request_id: requestId.value,
    current_turn_ref: request.projection.context.current_observation_ref,
    cognition_projection_hash: request.projection.projection_hash,
    communication_binding: {
      schema_version: "conversation-cognition-proposal-v4",
      proposal_hash: await deriveConversationCognitionProposalHashV4(proposal),
      directive: { kind: "REALIZE_CURRENT_INTENT" },
      clarification_basis: null
    },
    current_user_request: {
      scene: request.projection.context.scene,
      task: request.projection.context.task
    },
    factual_assessment: proposal.factual_assessment,
    selected_subjective_choice: proposal.subjective_choice,
    supporting_evidence: {
      lawful_evidence_refs: lawfulEvidenceRefs,
      memory_episode_contents: [...request.memory_episode_contents]
    },
    constraints: {
      max_text_code_points: 4096,
      evidence_refs_only: true,
      no_new_evidence_authority: true,
      preserve_factual_assessment: true,
      preserve_selected_subjective_choice: true,
      no_invented_choice: true,
      no_invented_justification: true
    }
  };
  const checked = validateLanguageRealizationInputAnyVersion(input);
  if (!checked.ok) return checked;
  const frozen = cloneAndFreeze(input);
  return { ok: true, input: frozen, input_hash: await deriveLanguageRealizationInputHashAnyVersion(frozen) };
}

/**
 * Family C4 cognition-to-language derivation boundary. The V5 proposal is
 * revalidated here (including the tagged `subjective_choice` — applicability,
 * stance and the bounded subjective rationale, all of which are part of the
 * bound proposal hash) against the AUTHORITATIVE projection hash supplied by the
 * host from the exact cognition invocation, never from model output.
 */
export async function buildLanguageRealizationInputV6(
  request: BuildLanguageRealizationInputV6Request
): Promise<BuildLanguageRealizationInputV6Result> {
  if (!isRecord(request)) return { ok: false, detail: "language input v6 build request: expected object" };
  const requestKeys = exactKeys(request, BUILD_V4_KEYS, "language input v6 build request");
  if (requestKeys !== null) return { ok: false, detail: requestKeys };
  if (!isRecord(request.projection)) return { ok: false, detail: "language input v6 build request.projection: expected object" };
  if (request.projection.schema_version !== "cognitive-context-projection-v2") {
    return { ok: false, detail: "language input v6 requires cognitive-context-projection-v2" };
  }
  if (request.subject_id !== request.projection.subject_id) return { ok: false, detail: "language input v6 subject/projection mismatch" };
  if (request.source_revision !== request.projection.state_revision) return { ok: false, detail: "language input v6 revision/projection mismatch" };
  if (request.projection.context.current_observation_ref === null) return { ok: false, detail: "language input v6 requires current observation turn identity" };
  const requestId = validateIdentifier(request.response_request_id as string, "language input v6 response_request_id");
  if (!requestId.ok) return { ok: false, detail: requestId.error.detail };

  const proposalCheck = validateHostBoundConversationCognitionProposalV5(
    request.conversation_proposal,
    request.projection
  );
  if (!proposalCheck.ok) return { ok: false, detail: proposalCheck.detail };
  const proposal = proposalCheck.proposal;
  if (proposal.communication_directive.kind !== "REALIZE_CURRENT_INTENT" || proposal.clarification_basis !== null) {
    return { ok: false, detail: "language input v6 requires a V5 REALIZE proposal" };
  }
  const episodeFailure = validateEpisodeContents(request.memory_episode_contents);
  if (episodeFailure !== null) return { ok: false, detail: episodeFailure };

  const lawfulEvidenceRefs = [...new Set<string>([
    ...request.projection.memory_working_refs,
    ...request.projection.recent_retrieval_refs,
    ...request.projection.context.focus_refs,
    ...request.projection.context.active_entity_refs,
    ...request.projection.context.environment_refs,
    request.projection.context.current_observation_ref
  ])].sort() as unknown as readonly CanonicalRefV0[];

  const input: LanguageRealizationInputV6 = {
    schema_version: LANGUAGE_REALIZATION_INPUT_SCHEMA_VERSION_V6,
    subject_id: request.subject_id,
    source_revision: request.source_revision,
    response_request_id: requestId.value,
    current_turn_ref: request.projection.context.current_observation_ref,
    cognition_projection_hash: request.projection.projection_hash,
    communication_binding: {
      schema_version: "conversation-cognition-proposal-v5",
      proposal_hash: await deriveConversationCognitionProposalHashV5(proposal),
      directive: { kind: "REALIZE_CURRENT_INTENT" },
      clarification_basis: null
    },
    current_user_request: {
      scene: request.projection.context.scene,
      task: request.projection.context.task
    },
    factual_assessment: proposal.factual_assessment,
    selected_subjective_choice: proposal.subjective_choice,
    supporting_evidence: {
      lawful_evidence_refs: lawfulEvidenceRefs,
      memory_episode_contents: [...request.memory_episode_contents]
    },
    constraints: {
      max_text_code_points: 4096,
      evidence_refs_only: true,
      no_new_evidence_authority: true,
      preserve_factual_assessment: true,
      preserve_selected_subjective_choice: true,
      no_invented_choice: true,
      no_invented_justification: true,
      no_factual_authority_for_rationale: true
    }
  };
  const checked = validateLanguageRealizationInputAnyVersion(input);
  if (!checked.ok) return checked;
  const frozen = cloneAndFreeze(input);
  return { ok: true, input: frozen, input_hash: await deriveLanguageRealizationInputHashAnyVersion(frozen) };
}

/** Family C4.4 cognition-to-language derivation boundary (canonical refs only). */
export async function buildLanguageRealizationInputV7(
  request: BuildLanguageRealizationInputV7Request
): Promise<BuildLanguageRealizationInputV7Result> {
  if (!isRecord(request)) return { ok: false, detail: "language input v7 build request: expected object" };
  const requestKeys = exactKeys(request, BUILD_V4_KEYS, "language input v7 build request");
  if (requestKeys !== null) return { ok: false, detail: requestKeys };
  if (!isRecord(request.projection)) return { ok: false, detail: "language input v7 build request.projection: expected object" };
  if (request.projection.schema_version !== "cognitive-context-projection-v2") {
    return { ok: false, detail: "language input v7 requires cognitive-context-projection-v2" };
  }
  if (request.subject_id !== request.projection.subject_id) return { ok: false, detail: "language input v7 subject/projection mismatch" };
  if (request.source_revision !== request.projection.state_revision) return { ok: false, detail: "language input v7 revision/projection mismatch" };
  if (request.projection.context.current_observation_ref === null) return { ok: false, detail: "language input v7 requires current observation turn identity" };
  const requestId = validateIdentifier(request.response_request_id as string, "language input v7 response_request_id");
  if (!requestId.ok) return { ok: false, detail: requestId.error.detail };

  const proposalCheck = validateHostBoundConversationCognitionProposalV6(
    request.conversation_proposal,
    request.projection
  );
  if (!proposalCheck.ok) return { ok: false, detail: proposalCheck.detail };
  const proposal = proposalCheck.proposal;
  if (proposal.communication_directive.kind !== "REALIZE_CURRENT_INTENT" || proposal.clarification_basis !== null) {
    return { ok: false, detail: "language input v7 requires a V6 REALIZE proposal" };
  }
  const episodeFailure = validateEpisodeContents(request.memory_episode_contents);
  if (episodeFailure !== null) return { ok: false, detail: episodeFailure };

  const lawfulEvidenceRefs = [...new Set<string>([
    ...request.projection.memory_working_refs,
    ...request.projection.recent_retrieval_refs,
    ...request.projection.context.focus_refs,
    ...request.projection.context.active_entity_refs,
    ...request.projection.context.environment_refs,
    request.projection.context.current_observation_ref
  ])].sort() as unknown as readonly CanonicalRefV0[];

  const input: LanguageRealizationInputV7 = {
    schema_version: LANGUAGE_REALIZATION_INPUT_SCHEMA_VERSION_V7,
    subject_id: request.subject_id,
    source_revision: request.source_revision,
    response_request_id: requestId.value,
    current_turn_ref: request.projection.context.current_observation_ref,
    cognition_projection_hash: request.projection.projection_hash,
    communication_binding: {
      schema_version: "conversation-cognition-proposal-v6",
      proposal_hash: await deriveConversationCognitionProposalHashV6(proposal),
      directive: { kind: "REALIZE_CURRENT_INTENT" },
      clarification_basis: null
    },
    current_user_request: {
      scene: request.projection.context.scene,
      task: request.projection.context.task
    },
    factual_assessment: proposal.factual_assessment,
    selected_subjective_selection: proposal.subjective_selection,
    supporting_evidence: {
      lawful_evidence_refs: lawfulEvidenceRefs,
      memory_episode_contents: [...request.memory_episode_contents]
    },
    constraints: {
      max_text_code_points: 4096,
      evidence_refs_only: true,
      no_new_evidence_authority: true,
      preserve_factual_assessment: true,
      preserve_selected_subjective_selection: true,
      no_invented_choice: true,
      no_invented_justification: true,
      no_factual_authority_for_rationale: true
    }
  };
  const checked = validateLanguageRealizationInputAnyVersion(input);
  if (!checked.ok) return checked;
  const frozen = cloneAndFreeze(input);
  return { ok: true, input: frozen, input_hash: await deriveLanguageRealizationInputHashAnyVersion(frozen) };
}

/** V7 factual-authority cognition-to-language boundary. */
export async function buildLanguageRealizationInputV8(
  request: BuildLanguageRealizationInputV8Request
): Promise<BuildLanguageRealizationInputV8Result> {
  if (!isRecord(request)) return { ok: false, detail: "language input v8 build request: expected object" };
  const requestKeys = exactKeys(request, BUILD_V4_KEYS, "language input v8 build request");
  if (requestKeys !== null) return { ok: false, detail: requestKeys };
  if (!isRecord(request.projection)) return { ok: false, detail: "language input v8 build request.projection: expected object" };
  if (request.projection.schema_version !== "cognitive-context-projection-v2") {
    return { ok: false, detail: "language input v8 requires cognitive-context-projection-v2" };
  }
  if (request.subject_id !== request.projection.subject_id) return { ok: false, detail: "language input v8 subject/projection mismatch" };
  if (request.source_revision !== request.projection.state_revision) return { ok: false, detail: "language input v8 revision/projection mismatch" };
  if (request.projection.context.current_observation_ref === null) return { ok: false, detail: "language input v8 requires current observation turn identity" };
  const requestId = validateIdentifier(request.response_request_id as string, "language input v8 response_request_id");
  if (!requestId.ok) return { ok: false, detail: requestId.error.detail };
  const proposalCheck = validateHostBoundConversationCognitionProposalV7(request.conversation_proposal, request.projection);
  if (!proposalCheck.ok) return { ok: false, detail: proposalCheck.detail };
  const proposal = proposalCheck.proposal;
  if (proposal.communication_directive.kind !== "REALIZE_CURRENT_INTENT" || proposal.clarification_basis !== null) {
    return { ok: false, detail: "language input v8 requires a V7 REALIZE proposal" };
  }
  const episodeFailure = validateEpisodeContents(request.memory_episode_contents);
  if (episodeFailure !== null) return { ok: false, detail: episodeFailure };
  const lawfulEvidenceRefs = [...new Set<string>([
    ...request.projection.memory_working_refs,
    ...request.projection.recent_retrieval_refs,
    ...request.projection.context.focus_refs,
    ...request.projection.context.active_entity_refs,
    ...request.projection.context.environment_refs,
    request.projection.context.current_observation_ref
  ])].sort() as unknown as readonly CanonicalRefV0[];
  const input: LanguageRealizationInputV8 = {
    schema_version: LANGUAGE_REALIZATION_INPUT_SCHEMA_VERSION_V8,
    subject_id: request.subject_id,
    source_revision: request.source_revision,
    response_request_id: requestId.value,
    current_turn_ref: request.projection.context.current_observation_ref,
    cognition_projection_hash: request.projection.projection_hash,
    communication_binding: {
      schema_version: "conversation-cognition-proposal-v7",
      proposal_hash: await deriveConversationCognitionProposalHashV7(proposal),
      directive: { kind: "REALIZE_CURRENT_INTENT" },
      clarification_basis: null
    },
    current_user_request: {
      scene: request.projection.context.scene,
      task: request.projection.context.task
    },
    factual_assessment: proposal.factual_assessment,
    selected_subjective_selection: proposal.subjective_selection,
    supporting_evidence: {
      lawful_evidence_refs: lawfulEvidenceRefs,
      memory_episode_contents: [...request.memory_episode_contents]
    },
    constraints: {
      max_text_code_points: 4096,
      evidence_refs_only: true,
      no_new_evidence_authority: true,
      preserve_factual_assessment: true,
      preserve_selected_subjective_selection: true,
      no_invented_choice: true,
      no_invented_justification: true,
      no_factual_authority_for_rationale: true
    }
  };
  const checked = validateLanguageRealizationInputAnyVersion(input);
  if (!checked.ok) return checked;
  const frozen = cloneAndFreeze(input);
  return { ok: true, input: frozen, input_hash: await deriveLanguageRealizationInputHashAnyVersion(frozen) };
}

export type BuildLanguageRealizationInputV9Request = BuildLanguageRealizationInputV8Request;

export type LanguageRealizationPlanVerdictV0 =
  | { readonly ok: true; readonly plan: LanguageRealizationPlanV0 }
  | { readonly ok: false; readonly code: "SEMANTIC_COMPLETENESS_FAILED"; readonly detail: string };

/**
 * Deterministic pre-Language completeness gate (LC-C). The host derives the plan from
 * the ALREADY-authorized proposal structure only — it never reads task text, never
 * invents references and never authorizes new semantics:
 *   - an authoritative stance exists → the stance is the primary response;
 *   - a determined-content turn (NO_SUBJECTIVE_SELECTION) requires at least one
 *     authorized host-verifiable derivation claim as the primary response.
 * Missing primary semantics is a typed rejection; Language is never invoked.
 */
export function deriveLanguageRealizationPlanV0(
  selection: SubjectiveSelectionV1,
  assessment: FactualAssessmentV1
): LanguageRealizationPlanVerdictV0 {
  if (selection.kind === "SUBJECTIVE_SELECTION") {
    return {
      ok: true,
      plan: Object.freeze({
        schema_version: LANGUAGE_REALIZATION_PLAN_SCHEMA_VERSION_V0,
        mode: "SUBJECTIVE_SELECTION_RESPONSE",
        references: Object.freeze([Object.freeze({ kind: "SUBJECTIVE_STANCE" as const })])
      })
    };
  }
  if (assessment.claims.length === 0) {
    // A determined-content turn that asserts NO factual claim has no answer semantics to
    // complete: it is an ordinary conversational realization with no factual content.
    // (Any asserted claim requires a host-verifiable derivation — see below.)
    return {
      ok: true,
      plan: Object.freeze({
        schema_version: LANGUAGE_REALIZATION_PLAN_SCHEMA_VERSION_V0,
        mode: "NO_FACTUAL_PRIMARY_RESPONSE" as const,
        references: Object.freeze([])
      })
    };
  }
  const derivationIndices: number[] = [];
  for (let index = 0; index < assessment.claims.length; index += 1) {
    if (assessment.claims[index]?.kind === "HOST_VERIFIABLE_DERIVATION") derivationIndices.push(index);
  }
  if (derivationIndices.length === 0) {
    return {
      ok: false,
      code: "SEMANTIC_COMPLETENESS_FAILED",
      detail:
        "determined-content turn requires an authorized host-verifiable derivation as the primary response; the authoritative proposal contains none"
    };
  }
  return {
    ok: true,
    plan: Object.freeze({
      schema_version: LANGUAGE_REALIZATION_PLAN_SCHEMA_VERSION_V0,
      mode: "FACTUAL_DERIVATION_RESPONSE",
      references: Object.freeze(derivationIndices.map((claim_index) =>
        Object.freeze({ kind: "FACTUAL_CLAIM" as const, claim_index })
      ))
    })
  };
}

export type BuildLanguageRealizationInputV9Result =
  | { readonly ok: true; readonly input: LanguageRealizationInputV9; readonly input_hash: HashV1 }
  | { readonly ok: false; readonly code: "SEMANTIC_COMPLETENESS_FAILED" | "INPUT_INVALID"; readonly detail: string };

/** V9 factual-authority + realization-completeness cognition-to-language boundary. */
export async function buildLanguageRealizationInputV9(
  request: BuildLanguageRealizationInputV8Request
): Promise<BuildLanguageRealizationInputV9Result> {
  if (!isRecord(request)) return { ok: false, code: "INPUT_INVALID", detail: "language input v9 build request: expected object" };
  const v8Built = await buildLanguageRealizationInputV8(request);
  if (!v8Built.ok) return { ok: false, code: "INPUT_INVALID", detail: v8Built.detail };
  const planVerdict = deriveLanguageRealizationPlanV0(
    v8Built.input.selected_subjective_selection,
    v8Built.input.factual_assessment
  );
  if (!planVerdict.ok) return { ok: false, code: planVerdict.code, detail: planVerdict.detail };
  const input: LanguageRealizationInputV9 = {
    ...v8Built.input,
    schema_version: LANGUAGE_REALIZATION_INPUT_SCHEMA_VERSION_V9,
    realization_plan: planVerdict.plan,
    constraints: {
      ...v8Built.input.constraints,
      realize_authorized_atoms_only: true
    }
  };
  const checked = validateLanguageRealizationInputAnyVersion(input);
  if (!checked.ok) return { ok: false, code: "INPUT_INVALID", detail: checked.detail };
  const frozen = cloneAndFreeze(input);
  return { ok: true, input: frozen, input_hash: await deriveLanguageRealizationInputHashAnyVersion(frozen) };
}

/**
 * RI-D: the MODEL-FACING semantic payload excludes the host-only request identity.
 * The host carrier object (and every host-side hash/binding over it) is unchanged;
 * only what the model receives is stripped, so two semantically identical requests
 * with different request ids produce identical model-facing bytes.
 */
export function modelFacingLanguagePayloadV9(input: LanguageRealizationInputV9): Record<string, unknown> {
  const { response_request_id: hostOnlyRequestId, ...payload } = input as LanguageRealizationInputV9 & { response_request_id: IdentifierV0 };
  void hostOnlyRequestId;
  return payload as unknown as Record<string, unknown>;
}

/** Hash over the identical model-facing payload (not over the host carrier). */
export async function deriveModelFacingLanguagePayloadHashV9(input: LanguageRealizationInputV9): Promise<HashV1> {
  return hashEnvelope(LANGUAGE_MODEL_FACING_PAYLOAD_HASH_PROJECTION_V9, modelFacingLanguagePayloadV9(input));
}

function cloneAndFreeze<T>(value: T): T {
  if (Array.isArray(value)) {
    return Object.freeze(value.map((item) => cloneAndFreeze(item))) as T;
  }
  if (isRecord(value)) {
    const copied: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) copied[key] = cloneAndFreeze(item);
    return Object.freeze(copied) as T;
  }
  return value;
}
// ---------------------------------------------------------------------------------
// AFFECT_COGNITION_RESPONSE_SEMANTICS_ATOM_V0 — live language carrier V10
// ---------------------------------------------------------------------------------
/**
 * V10 replaces the host-derived V9 plan with the AUTHORIZED response-semantics atom:
 * Language receives exactly the primary the host authorized (an authorized claim, the
 * authoritative stance, or a closed conversational/generative act bound to the current
 * turn). The zero-authority path is gone: REALIZE turns without a surviving atom fail
 * closed before Language, and the plan only ever routes already-authorized semantics.
 */
export const LANGUAGE_REALIZATION_INPUT_SCHEMA_VERSION_V10 =
  "language-realization-input-v10" as const;
export const LANGUAGE_REALIZATION_INPUT_HASH_PROJECTION_V10 =
  "characteros-next/runtime/language-realization-input-v10/v1" as const;
export const LANGUAGE_REALIZATION_PLAN_SCHEMA_VERSION_V1 =
  "language-realization-plan-v1" as const;

/** Authorized primary designation carried to Language (references only authorized atoms). */
export type LanguageRealizationPrimaryV1 =
  | {
      readonly kind: "PRIMARY_FACT";
      readonly claim_index: number;
      readonly claim_kind: "SOURCE_QUOTE" | "HOST_VERIFIABLE_DERIVATION";
    }
  | { readonly kind: "PRIMARY_STANCE" }
  | {
      readonly kind: "PRIMARY_CONVERSATIONAL_ACT";
      readonly act: ConversationalActKindV0;
      readonly target_ref: CanonicalRefV0;
    };

export interface LanguageRealizationPlanV1 {
  readonly schema_version: typeof LANGUAGE_REALIZATION_PLAN_SCHEMA_VERSION_V1;
  readonly primary: LanguageRealizationPrimaryV1;
}

export interface LanguageCommunicationBindingV8 {
  readonly schema_version: "conversation-cognition-proposal-v8";
  readonly proposal_hash: HashV1;
  readonly directive: { readonly kind: "REALIZE_CURRENT_INTENT" };
  readonly clarification_basis: null;
}

export interface LanguageRealizationInputV10 {
  readonly schema_version: typeof LANGUAGE_REALIZATION_INPUT_SCHEMA_VERSION_V10;
  readonly subject_id: IdentifierV0;
  readonly source_revision: StateRevisionV0;
  /** Host carrier only: bound by input_hash and the invocation binding, never serialized to the model. */
  readonly response_request_id: IdentifierV0;
  readonly current_turn_ref: CanonicalRefV0;
  readonly cognition_projection_hash: HashV1;
  readonly communication_binding: LanguageCommunicationBindingV8;
  readonly current_user_request: {
    readonly scene: string;
    readonly task: string | null;
  };
  readonly factual_assessment: FactualAssessmentV1;
  readonly selected_subjective_selection: SubjectiveSelectionV1;
  readonly realization_plan: LanguageRealizationPlanV1;
  readonly supporting_evidence: {
    readonly lawful_evidence_refs: readonly CanonicalRefV0[];
    readonly memory_episode_contents: readonly LanguageEpisodeContentV0[];
  };
  readonly constraints: LanguageRealizationConstraintsV0 & {
    readonly preserve_factual_assessment: true;
    readonly preserve_selected_subjective_selection: true;
    readonly no_invented_choice: true;
    readonly no_invented_justification: true;
    readonly no_factual_authority_for_rationale: true;
    readonly realize_authorized_atoms_only: true;
  };
}

const V10_KEYS = [...V8_KEYS, "realization_plan"];

function validateRealizationPlanV1(
  value: unknown,
  assessment: FactualAssessmentV1,
  selection: SubjectiveSelectionV1,
  currentObservationRef: CanonicalRefV0 | null
): string | null {
  if (!isRecord(value)) return "language input v10.realization_plan: expected object";
  const keys = exactKeys(value, ["schema_version", "primary"], "language input v10.realization_plan");
  if (keys !== null) return keys;
  if (value["schema_version"] !== LANGUAGE_REALIZATION_PLAN_SCHEMA_VERSION_V1) {
    return "language input v10.realization_plan.schema_version: unsupported";
  }
  const primary = value["primary"];
  if (!isRecord(primary)) return "language input v10.realization_plan.primary: expected object";
  const kind = primary["kind"];
  if (kind === "PRIMARY_FACT") {
    const primaryKeys = exactKeys(primary, ["kind", "claim_index", "claim_kind"], "language input v10.realization_plan.primary");
    if (primaryKeys !== null) return primaryKeys;
    const claimIndex = primary["claim_index"];
    if (!Number.isInteger(claimIndex) || (claimIndex as number) < 0 || (claimIndex as number) >= assessment.claims.length) {
      return "language input v10.realization_plan.primary.claim_index: must reference an authorized claim";
    }
    if (primary["claim_kind"] !== assessment.claims[claimIndex as number]?.kind) {
      return "language input v10.realization_plan.primary.claim_kind: must match the authorized claim";
    }
    return null;
  }
  if (kind === "PRIMARY_STANCE") {
    const primaryKeys = exactKeys(primary, ["kind"], "language input v10.realization_plan.primary");
    if (primaryKeys !== null) return primaryKeys;
    if (selection.kind !== "SUBJECTIVE_SELECTION") {
      return "language input v10.realization_plan.primary: PRIMARY_STANCE requires an authoritative stance";
    }
    return null;
  }
  if (kind === "PRIMARY_CONVERSATIONAL_ACT") {
    const primaryKeys = exactKeys(primary, ["kind", "act", "target_ref"], "language input v10.realization_plan.primary");
    if (primaryKeys !== null) return primaryKeys;
    if (!CONVERSATIONAL_ACT_KINDS_V0.includes(primary["act"] as never)) {
      return "language input v10.realization_plan.primary.act: not in the frozen conversational-act registry";
    }
    if (currentObservationRef === null || primary["target_ref"] !== currentObservationRef) {
      return "language input v10.realization_plan.primary.target_ref: must be the current turn observation ref";
    }
    if (selection.kind !== "NO_SUBJECTIVE_SELECTION") {
      return "language input v10.realization_plan.primary: a turn with an authoritative stance must realize that stance";
    }
    return null;
  }
  return "language input v10.realization_plan.primary.kind: must be PRIMARY_FACT, PRIMARY_STANCE or PRIMARY_CONVERSATIONAL_ACT";
}

function validateLanguageRealizationInputV10(value: Record<string, unknown>): string | null {
  const keys = exactKeys(value, V10_KEYS, "language input v10");
  if (keys !== null) return keys;
  const subject = validateIdentifier(value["subject_id"] as string, "language input v10.subject_id");
  if (!subject.ok) return subject.error.detail;
  const revision = validateStateRevision(value["source_revision"] as number, "language input v10.source_revision");
  if (!revision.ok) return revision.error.detail;
  const requestId = validateIdentifier(value["response_request_id"] as string, "language input v10.response_request_id");
  if (!requestId.ok) return requestId.error.detail;
  const turnRef = validateRefElement(value["current_turn_ref"], "language input v10.current_turn_ref", ["observation"]);
  if (!turnRef.ok) return turnRef.error.detail;
  const projectionHash = validateHash(value["cognition_projection_hash"] as string, "language input v10.cognition_projection_hash");
  if (!projectionHash.ok) return projectionHash.error.detail;
  const binding = value["communication_binding"];
  if (!isRecord(binding)) return "language input v10.communication_binding: expected object";
  const bindingKeys = exactKeys(binding, ["schema_version", "proposal_hash", "directive", "clarification_basis"], "language input v10.communication_binding");
  if (bindingKeys !== null) return bindingKeys;
  if (binding["schema_version"] !== "conversation-cognition-proposal-v8") return "language input v10.communication_binding.schema_version: unsupported";
  const proposalHash = validateHash(binding["proposal_hash"] as string, "language input v10.communication_binding.proposal_hash");
  if (!proposalHash.ok) return proposalHash.error.detail;
  const directive = binding["directive"];
  if (!isRecord(directive) || directive["kind"] !== "REALIZE_CURRENT_INTENT") return "language input v10.communication_binding.directive: REALIZE required";
  if (binding["clarification_basis"] !== null) return "language input v10.communication_binding.clarification_basis: must be null";
  const requestData = value["current_user_request"];
  if (!isRecord(requestData)) return "language input v10.current_user_request: expected object";
  const requestKeys = exactKeys(requestData, ["scene", "task"], "language input v10.current_user_request");
  if (requestKeys !== null) return requestKeys;
  const scene = validateCanonicalText(requestData["scene"], "language input v10.current_user_request.scene");
  if (!scene.ok) return scene.error.detail;
  if (requestData["task"] !== null) {
    const task = validateCanonicalText(requestData["task"], "language input v10.current_user_request.task");
    if (!task.ok) return task.error.detail;
  }
  const selectionCheck = validateSubjectiveSelectionV1(value["selected_subjective_selection"]);
  if (!selectionCheck.ok) return `language input v10.${selectionCheck.detail}`;
  const assessmentFailure = validateFactualAssessmentV1Carrier(value["factual_assessment"]);
  if (assessmentFailure !== null) return assessmentFailure;
  const planFailure = validateRealizationPlanV1(
    value["realization_plan"],
    value["factual_assessment"] as FactualAssessmentV1,
    selectionCheck.selection,
    turnRef.value
  );
  if (planFailure !== null) return planFailure;
  const evidence = value["supporting_evidence"];
  if (!isRecord(evidence)) return "language input v10.supporting_evidence: expected object";
  const evidenceKeys = exactKeys(evidence, ["lawful_evidence_refs", "memory_episode_contents"], "language input v10.supporting_evidence");
  if (evidenceKeys !== null) return evidenceKeys;
  const lawful = validateRefArray(evidence["lawful_evidence_refs"], "language input v10.supporting_evidence.lawful_evidence_refs", { sorted: true });
  if (!lawful.ok) return lawful.error.detail;
  const episodeFailure = validateEpisodeContents(evidence["memory_episode_contents"]);
  if (episodeFailure !== null) return episodeFailure;
  const constraints = value["constraints"];
  if (!isRecord(constraints)) return "language input v10.constraints: expected object";
  const constraintKeys = exactKeys(constraints, ["max_text_code_points", "evidence_refs_only", "no_new_evidence_authority", "preserve_factual_assessment", "preserve_selected_subjective_selection", "no_invented_choice", "no_invented_justification", "no_factual_authority_for_rationale", "realize_authorized_atoms_only"], "language input v10.constraints");
  if (constraintKeys !== null) return constraintKeys;
  if (
    constraints["max_text_code_points"] !== 4096 ||
    constraints["evidence_refs_only"] !== true ||
    constraints["no_new_evidence_authority"] !== true ||
    constraints["preserve_factual_assessment"] !== true ||
    constraints["preserve_selected_subjective_selection"] !== true ||
    constraints["no_invented_choice"] !== true ||
    constraints["no_invented_justification"] !== true ||
    constraints["no_factual_authority_for_rationale"] !== true ||
    constraints["realize_authorized_atoms_only"] !== true
  ) {
    return "language input v10.constraints: frozen values required";
  }
  return null;
}

export type BuildLanguageRealizationInputV10Result =
  | { readonly ok: true; readonly input: LanguageRealizationInputV10; readonly input_hash: HashV1 }
  | { readonly ok: false; readonly code: "SEMANTIC_COMPLETENESS_FAILED" | "INPUT_INVALID"; readonly detail: string };

/**
 * V10 builder. The plan is a pure ROUTE of the already-authorized atom: the host never
 * synthesizes semantics and never falls back to a zero-authority path.
 */
export async function buildLanguageRealizationInputV10(
  request: BuildLanguageRealizationInputV8Request
): Promise<BuildLanguageRealizationInputV10Result> {
  if (!isRecord(request)) return { ok: false, code: "INPUT_INVALID", detail: "language input v10 build request: expected object" };
  const proposalCheck = await validateHostBoundConversationCognitionProposalV8(request.conversation_proposal, request.projection as CognitiveContextProjectionAnyVersion);
  if (!proposalCheck.ok) {
    return {
      ok: false,
      code: proposalCheck.detail.startsWith("SEMANTIC_COMPLETENESS_FAILED") ? "SEMANTIC_COMPLETENESS_FAILED" : "INPUT_INVALID",
      detail: proposalCheck.detail
    };
  }
  const proposal = proposalCheck.proposal;
  if (proposal.communication_directive.kind !== "REALIZE_CURRENT_INTENT" || proposal.clarification_basis !== null) {
    return { ok: false, code: "INPUT_INVALID", detail: "language input v10 requires a V8 REALIZE proposal" };
  }
  const atom = proposal.response_semantics;
  let primary: LanguageRealizationPrimaryV1;
  if (atom.kind === "PRIMARY_FACT") {
    const claim = proposal.factual_assessment.claims[atom.claim_index];
    if (claim === undefined) return { ok: false, code: "SEMANTIC_COMPLETENESS_FAILED", detail: "primary fact references an absent authorized claim" };
    primary = Object.freeze({ kind: "PRIMARY_FACT" as const, claim_index: atom.claim_index, claim_kind: claim.kind });
  } else if (atom.kind === "PRIMARY_STANCE") {
    primary = Object.freeze({ kind: "PRIMARY_STANCE" as const });
  } else if (atom.kind === "PRIMARY_CONVERSATIONAL_ACT") {
    primary = Object.freeze({ kind: "PRIMARY_CONVERSATIONAL_ACT" as const, act: atom.act, target_ref: atom.target_ref });
  } else {
    // PRIMARY_CLARIFICATION never reaches Language: the CLARIFY branch is host-rendered.
    return { ok: false, code: "SEMANTIC_COMPLETENESS_FAILED", detail: "clarification turns do not build a language input" };
  }
  const episodeFailure = validateEpisodeContents(request.memory_episode_contents);
  if (episodeFailure !== null) return { ok: false, code: "INPUT_INVALID", detail: episodeFailure };
  const projection = request.projection as CognitiveContextProjectionAnyVersion;
  const lawfulEvidenceRefs = [...new Set<string>([
    ...projection.memory_working_refs,
    ...projection.recent_retrieval_refs,
    ...projection.context.focus_refs,
    ...projection.context.active_entity_refs,
    ...projection.context.environment_refs,
    projection.context.current_observation_ref as unknown as string
  ])].sort() as unknown as readonly CanonicalRefV0[];
  const input: LanguageRealizationInputV10 = {
    schema_version: LANGUAGE_REALIZATION_INPUT_SCHEMA_VERSION_V10,
    subject_id: request.subject_id,
    source_revision: request.source_revision,
    response_request_id: request.response_request_id,
    current_turn_ref: projection.context.current_observation_ref as CanonicalRefV0,
    cognition_projection_hash: projection.projection_hash,
    communication_binding: Object.freeze({
      schema_version: "conversation-cognition-proposal-v8" as const,
      proposal_hash: proposalCheck.proposal_hash,
      directive: Object.freeze({ kind: "REALIZE_CURRENT_INTENT" as const }),
      clarification_basis: null
    }),
    current_user_request: {
      scene: projection.context.scene,
      task: projection.context.task
    },
    factual_assessment: proposal.factual_assessment,
    selected_subjective_selection: proposal.subjective_selection,
    realization_plan: Object.freeze({
      schema_version: LANGUAGE_REALIZATION_PLAN_SCHEMA_VERSION_V1,
      primary
    }),
    supporting_evidence: {
      lawful_evidence_refs: lawfulEvidenceRefs,
      memory_episode_contents: [...request.memory_episode_contents]
    },
    constraints: Object.freeze({
      max_text_code_points: 4096,
      evidence_refs_only: true as const,
      no_new_evidence_authority: true as const,
      preserve_factual_assessment: true as const,
      preserve_selected_subjective_selection: true as const,
      no_invented_choice: true as const,
      no_invented_justification: true as const,
      no_factual_authority_for_rationale: true as const,
      realize_authorized_atoms_only: true as const
    })
  };
  const checked = validateLanguageRealizationInputAnyVersion(input);
  if (!checked.ok) return { ok: false, code: "INPUT_INVALID", detail: checked.detail };
  const frozen = cloneAndFreeze(input);
  return { ok: true, input: frozen, input_hash: await deriveLanguageRealizationInputHashAnyVersion(frozen) };
}

/** RI-D preserved: the model-facing payload excludes the host-only request identity. */
export function modelFacingLanguagePayloadV10(input: LanguageRealizationInputV10): Record<string, unknown> {
  const { response_request_id: hostOnlyRequestId, ...payload } = input as LanguageRealizationInputV10 & { response_request_id: IdentifierV0 };
  void hostOnlyRequestId;
  return payload as unknown as Record<string, unknown>;
}

export async function deriveModelFacingLanguagePayloadHashV10(input: LanguageRealizationInputV10): Promise<HashV1> {
  return hashEnvelope(LANGUAGE_MODEL_FACING_PAYLOAD_HASH_PROJECTION_V9, modelFacingLanguagePayloadV10(input));
}
