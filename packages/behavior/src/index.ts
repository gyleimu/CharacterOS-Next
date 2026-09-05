/**
 * @characteros-next/behavior — pure language-behavior contracts
 * (PRODUCTION_LANGUAGE_BEHAVIOR_OUTPUT_V0).
 *
 * Pure types, strict fail-closed parsers/validators, deterministic host-owned
 * behavior construction and hash/identity rules. Depends ONLY on subject-core
 * public contracts; Runtime depends on THIS package — never the reverse. No
 * trusted execution authority lives here: only the trusted runtime executor
 * constructs production behavior artifacts.
 */
export {
  LANGUAGE_REALIZATION_DRAFT_SCHEMA_VERSION_V0,
  LANGUAGE_BEHAVIOR_MAX_TEXT_CODE_POINTS_V0,
  validateLanguageRealizationDraftV0,
  type LanguageRealizationDraftV0
} from "./language-realization-draft.js";
export {
  CHARACTER_LANGUAGE_BEHAVIOR_SCHEMA_VERSION_V0,
  CHARACTER_LANGUAGE_BEHAVIOR_ID_PROJECTION_V0,
  buildCharacterLanguageBehaviorV0,
  validateCharacterLanguageBehaviorV0,
  type CharacterLanguageBehaviorV0,
  type CharacterLanguageBehaviorConstructionInputV0
} from "./character-language-behavior.js";
export {
  COMMUNICATION_DIRECTIVE_KINDS_V0,
  validateCommunicationDirectiveV0,
  type CommunicationDirectiveV0,
  type CommunicationDirectiveKindV0
} from "./communication-directive.js";
export {
  CLARIFICATION_RENDERER_ID_V0,
  CLARIFICATION_TEXT_V0,
  CLARIFICATION_REALIZATION_INPUT_SCHEMA_VERSION_V0,
  CLARIFICATION_REALIZATION_INPUT_HASH_PROJECTION_V0,
  deriveClarificationRealizationInputHashV0,
  buildClarificationBehaviorV0,
  type ClarificationRealizationInputV0
} from "./clarification-behavior.js";
