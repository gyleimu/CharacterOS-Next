/**
 * @characteros-next/voice — public surface.
 *
 * Voice is the PRESENTATION / INTERACTION channel of CharacterOS. Nothing in
 * this package owns, mutates, or reinterprets canonical subject state:
 *
 *   CharacterOS state (read-only projection)
 *     → SpeechExpressionProjection        deterministic, bounded, testable
 *     → SpeechExpressionV0
 *     → SpeechOutputRequestV0
 *     → VoiceTtsAdapterV0 (CosyVoice3)    model-specific, replaceable
 *     → audio
 *
 * The package deliberately imports NO CharacterOS package. It depends on the
 * subject only through the narrow `VoiceSubjectPortV0` port, so the speech layer
 * cannot reach into the core even by accident, and the core cannot depend on it.
 */

export {
  SPEECH_EXPRESSION_PROJECTION_ID,
  SPEECH_EXPRESSION_SCHEMA_VERSION,
  SPEECH_INPUT_SCHEMA_VERSION,
  SPEECH_OUTPUT_REQUEST_SCHEMA_VERSION,
  VOICE_PROFILE_SCHEMA_VERSION,
  VoiceFailureV0,
  type ObservedVocalAffectV0,
  type SpeechExpressionInputsV0,
  type SpeechExpressionProvenanceV0,
  type SpeechExpressionV0,
  type SpeechInputSourceV0,
  type SpeechInputV0,
  type SpeechOutputRequestV0,
  type SpeechTimestampV0,
  type VoiceFailureCodeV0,
  type VoiceProfileV0
} from "./contracts.js";

export {
  DEFAULT_SPEECH_EXPRESSION_CONFIG_V0,
  clampSignedUnitV0,
  clampUnitV0,
  normalizeSpeechExpressionInputsV0,
  projectSpeechExpressionV0,
  speechExpressionFingerprintV0,
  type SpeechExpressionConfigV0
} from "./projection.js";

export {
  DEFAULT_VOICE_RUNTIME_CONFIG_V0,
  VOICE_RUNTIME_ASR_LISTEN_PATH_V0,
  VOICE_RUNTIME_ASR_PATH_V0,
  VOICE_RUNTIME_DEFAULT_BASE_URL_V0,
  VOICE_RUNTIME_HEALTH_PATH_V0,
  VOICE_RUNTIME_TTS_PATH_V0,
  VOICE_RUNTIME_TTS_STREAM_PATH_V0,
  VOICE_RUNTIME_VOICES_PATH_V0,
  VoiceRuntimeClientV0,
  type AsrListenRequestV0,
  type AsrListenResultV0,
  type AsrRuntimeRequestV0,
  type AsrRuntimeResultV0,
  type TtsRuntimeRequestV0,
  type TtsRuntimeResultV0,
  type VoiceListResultV0,
  type VoiceModelStatusV0,
  type VoiceRuntimeConfigV0,
  type VoiceRuntimeHealthV0,
  type VoiceVramStatusV0
} from "./runtime-client.js";

export {
  COSYVOICE_TTS_ADAPTER_ID_V0,
  CosyVoiceTtsAdapterV0,
  DEFAULT_COSYVOICE_INSTRUCTION_CONFIG_V0,
  buildCosyVoiceInstructionV0,
  type CosyVoiceInstructionConfigV0,
  type CosyVoiceTtsAdapterOptionsV0,
  type SpeechSynthesisResultV0,
  type VoiceTtsAdapterV0
} from "./adapters/cosyvoice-tts-adapter.js";

export {
  SENSEVOICE_ASR_ADAPTER_ID_V0,
  SenseVoiceAsrAdapterV0,
  deriveLiveUtteranceRefV0,
  deriveUtteranceRefV0,
  type SenseVoiceAsrAdapterOptionsV0,
  type SpeechRecognitionResultV0,
  type VoiceAsrAdapterV0
} from "./adapters/sensevoice-asr-adapter.js";

export {
  VoiceSessionV0,
  type VoiceSessionConfigV0,
  type VoiceSessionDepsV0,
  type VoiceSessionTurnV0,
  type VoiceSubjectPortV0,
  type VoiceTurnResultV0
} from "./voice-session.js";
