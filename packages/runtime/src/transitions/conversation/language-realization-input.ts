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
  validateConversationCognitionProposalV3,
  validateHostBoundConversationCognitionProposalV4,
  validateSubjectiveChoiceV0,
  type ConversationCognitionProposalV3,
  type FactualAssessmentV0,
  type SubjectiveChoiceV0
} from "./conversation-cognition-proposal.js";

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
  | LanguageRealizationInputV5;

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

/** Closed, version-dispatched validation. Unknown or mixed schemas fail. */
export function validateLanguageRealizationInputAnyVersion(
  value: unknown
): { ok: true; input: LanguageRealizationInputAnyVersion } | { ok: false; detail: string } {
  if (!isRecord(value)) return { ok: false, detail: "language input: expected object" };
  const schema = value["schema_version"];
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
  return hashEnvelope(LANGUAGE_REALIZATION_INPUT_HASH_PROJECTION_V5, input);
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
