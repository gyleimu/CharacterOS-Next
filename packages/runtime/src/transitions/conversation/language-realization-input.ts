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

export const LANGUAGE_REALIZATION_INPUT_SCHEMA_VERSION_V0 =
  "language-realization-input-v0" as const;
export const LANGUAGE_REALIZATION_INPUT_SCHEMA_VERSION_V1 =
  "language-realization-input-v1" as const;
export const LANGUAGE_REALIZATION_INPUT_SCHEMA_VERSION_V2 =
  "language-realization-input-v2" as const;

export const LANGUAGE_REALIZATION_INPUT_HASH_PROJECTION_V0 =
  "characteros-next/runtime/language-realization-input/v1" as const;
/** Frozen projection already used by the pre-existing structured v3 path. */
export const LANGUAGE_REALIZATION_INPUT_HASH_PROJECTION_V1 =
  "characteros-next/runtime/language-realization-input-v1/v1" as const;
export const LANGUAGE_REALIZATION_INPUT_HASH_PROJECTION_V2 =
  "characteros-next/runtime/language-realization-input-v2/v1" as const;

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

export type LanguageRealizationInputAnyVersion =
  | LanguageRealizationInputV0
  | LanguageRealizationInputV1
  | LanguageRealizationInputV2;

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
      readonly input: LanguageRealizationInputV1 | LanguageRealizationInputV2;
      readonly input_hash: HashV1;
    }
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

/** Closed, version-dispatched validation. Unknown or mixed schemas fail. */
export function validateLanguageRealizationInputAnyVersion(
  value: unknown
): { ok: true; input: LanguageRealizationInputAnyVersion } | { ok: false; detail: string } {
  if (!isRecord(value)) return { ok: false, detail: "language input: expected object" };
  const schema = value["schema_version"];
  const expected =
    schema === LANGUAGE_REALIZATION_INPUT_SCHEMA_VERSION_V0
      ? LEGACY_KEYS
      : schema === LANGUAGE_REALIZATION_INPUT_SCHEMA_VERSION_V1
        ? STRUCTURED_LEGACY_KEYS
        : schema === LANGUAGE_REALIZATION_INPUT_SCHEMA_VERSION_V2
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
  return hashEnvelope(LANGUAGE_REALIZATION_INPUT_HASH_PROJECTION_V2, input);
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
  const expectedProposalHash = await hashEnvelope(
    "characteros-next/runtime/conversation-cognition-proposal/v1",
    {
      schema_version: "conversation-cognition-proposal-v1",
      cognition,
      communication_directive: directiveCheck.directive
    }
  );
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
      current_intent:
        request.projection.schema_version === "cognitive-context-projection-v2"
          ? cognition.current_intent
          : null
    },
    communication_binding: {
      schema_version: "conversation-cognition-proposal-v1" as const,
      proposal_hash: proposalHashCheck.value,
      directive: { kind: "REALIZE_CURRENT_INTENT" as const }
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

  const input: LanguageRealizationInputV1 | LanguageRealizationInputV2 =
    request.projection.schema_version === "cognitive-context-projection-v2"
      ? {
          schema_version: LANGUAGE_REALIZATION_INPUT_SCHEMA_VERSION_V2,
          ...common
        }
      : {
          schema_version: LANGUAGE_REALIZATION_INPUT_SCHEMA_VERSION_V1,
          ...common,
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
