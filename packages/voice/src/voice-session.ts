/**
 * CHARACTEROS_VOICE_SESSION_V0 — one spoken exchange, end to end.
 *
 *   microphone → ASR → SpeechInputV0
 *     → CharacterOS text ingress (the EXISTING one)
 *     → reply text
 *     → SpeechExpressionProjection (read-only state)
 *     → TTS
 *     → speaker
 *
 * TWO PROPERTIES THIS MODULE EXISTS TO GUARANTEE:
 *
 * 1. SPEECH IS NOT AUTHORITATIVE. The session never commits anything, never
 *    holds a SubjectState, and never invents a delivery. The reply is delivered
 *    by CharacterOS exactly as a typed turn delivers it; speech merely renders
 *    the reply that already exists. There is deliberately no second delivery,
 *    because a delivered-but-unspoken duplicate would corrupt the single
 *    deferred reply slot the runtime keeps.
 *
 * 2. SPEECH FAILURE IS NOT TURN FAILURE. TTS being down, a model OOM, a
 *    timeout, or a cancelled synthesis all leave a perfectly valid text turn.
 *    Every speech failure is returned as data on the result, never thrown past
 *    the caller, and never able to fail the turn.
 */

import { createHash } from "node:crypto";

import {
  VoiceFailureV0,
  type SpeechExpressionInputsV0,
  type SpeechExpressionV0,
  type SpeechOutputRequestV0
} from "./contracts.js";
import {
  projectSpeechExpressionV0,
  type SpeechExpressionConfigV0
} from "./projection.js";
import type { SpeechRecognitionResultV0, VoiceAsrAdapterV0 } from "./adapters/sensevoice-asr-adapter.js";
import type { SpeechSynthesisResultV0, VoiceTtsAdapterV0 } from "./adapters/cosyvoice-tts-adapter.js";
import type { SpeechStreamResultV0 } from "./runtime-client.js";
import {
  SpeechQueueV0,
  type SpeechQueueSegmentResultV0
} from "./speech-queue.js";
import type { SpeechSegmentationConfigV0 } from "./segmentation.js";

// ----------------------------------------------------------------------------------
// §1 The narrow CharacterOS port
// ----------------------------------------------------------------------------------

/** The result of one CharacterOS text turn, reduced to what speech needs. */
export interface VoiceTurnResultV0 {
  readonly status: "COMPLETED" | "FAILED";
  /** The reply text; `null` when the turn failed. */
  readonly reply_text: string | null;
  readonly state_revision: number | null;
  readonly failure: string | null;
}

/**
 * The only CharacterOS surface the voice layer is allowed to touch: a read-only
 * state projection and the existing text ingress.
 *
 * This is a dependency-inversion port, so `packages/voice` imports no
 * CharacterOS package at all. The product composition root supplies the
 * implementation over the already-frozen host.
 */
export interface VoiceSubjectPortV0 {
  /** Read-only current state, in the bounded shape the projection consumes. */
  readSpeechExpressionInputs(): Promise<SpeechExpressionInputsV0>;
  /** Runs ONE existing text turn. Never called by speech synthesis. */
  submitUserText(text: string): Promise<VoiceTurnResultV0>;
}

// ----------------------------------------------------------------------------------
// §2 Session result
// ----------------------------------------------------------------------------------

export interface VoiceSessionTurnV0 {
  readonly turn_ref: string;
  /** `null` when the user typed instead of speaking. */
  readonly recognized: SpeechRecognitionResultV0 | null;
  readonly turn: VoiceTurnResultV0;
  /** `null` when the turn failed, or speech is disabled. */
  readonly expression: SpeechExpressionV0 | null;
  /** `null` when synthesis was not attempted or failed. */
  readonly speech: SpeechSynthesisResultV0 | null;
  /** Measurements when the reply was streamed; `null` for one-pass synthesis. */
  readonly speech_stream: SpeechStreamResultV0 | null;
  /** Per-sentence record of the whole reply, in the order it was spoken. */
  readonly speech_segments: readonly SpeechQueueSegmentResultV0[];
  /**
   * Why speech is missing, when it is. Present so callers can report a degraded
   * channel without treating it as a turn failure.
   */
  readonly speech_failure: VoiceFailureV0 | null;
}

function turnRefV0(seed: string): string {
  return `voice-turn:${createHash("sha256").update(seed, "utf8").digest("hex")}`;
}

// ----------------------------------------------------------------------------------
// §3 Session
// ----------------------------------------------------------------------------------

export interface VoiceSessionConfigV0 {
  readonly voice_id: string;
  readonly language: string;
  /** Speak replies through the runtime's audio device. */
  readonly speak: boolean;
  /** Ask the runtime for streaming synthesis. */
  readonly streaming: boolean;
  readonly expression_config?: SpeechExpressionConfigV0;
  /** Sentence-splitting limits for the speech queue. */
  readonly segmentation?: SpeechSegmentationConfigV0;
}

export interface VoiceSessionDepsV0 {
  readonly subject: VoiceSubjectPortV0;
  /** Absent means the deployment has no speech recognition. */
  readonly asr?: VoiceAsrAdapterV0;
  /** Absent means the deployment has no speech synthesis. */
  readonly tts?: VoiceTtsAdapterV0;
}

export class VoiceSessionV0 {
  /** Controller for the utterance currently being spoken, if any. */
  private activeSpeech: AbortController | null = null;
  /** One queue per session, so an interruption cancels the whole reply. */
  private speechQueue: SpeechQueueV0 | null = null;

  constructor(
    private readonly config: VoiceSessionConfigV0,
    private readonly deps: VoiceSessionDepsV0
  ) {}

  /** True when this deployment can hear. */
  canListen(): boolean {
    return this.deps.asr !== undefined;
  }

  /** True when this deployment can speak. */
  canSpeak(): boolean {
    return this.deps.tts !== undefined;
  }

  /** True while a reply is being spoken. */
  isSpeaking(): boolean {
    return this.speechQueue?.isSpeaking() ?? this.activeSpeech !== null;
  }

  /**
   * Interruption: stops the reply currently being spoken and drops the sentences
   * that have not been generated yet.
   *
   * Aborts the local request AND asks the runtime to stop generating and stop
   * the speaker, so an interruption actually silences the room rather than just
   * detaching the client. Deliberately minimal — there is no full-duplex
   * turn-taking here — and it can never touch CharacterOS state: the turn has
   * already committed by the time anything is spoken.
   */
  async cancelSpeech(): Promise<void> {
    const controller = this.activeSpeech;
    this.activeSpeech = null;
    controller?.abort();
    const queue = this.speechQueue;
    if (queue !== null && queue.isSpeaking()) {
      // The queue already asks the runtime to stop generating and stop the
      // speaker; calling the adapter again would double-cancel.
      await queue.cancel();
      return;
    }
    const tts = this.deps.tts;
    if (tts?.cancel !== undefined) {
      await tts.cancel();
    }
  }

  /**
   * Demo A / typed input: run one turn and speak the reply.
   *
   * `recognized` is `null` because the user typed; everything else is identical
   * to the spoken path, which is the point — speech is an output channel, not a
   * different kind of turn.
   */
  async handleText(text: string, options?: { readonly signal?: AbortSignal }): Promise<VoiceSessionTurnV0> {
    return await this.runTurn(text, null, options?.signal);
  }

  /**
   * Demo B / microphone: capture one utterance, then run it as a normal turn.
   *
   * Resolves to `null` when only silence was heard — an ordinary outcome, not an
   * error, and not a turn.
   */
  async handleMicrophone(options?: {
    readonly signal?: AbortSignal;
    readonly fixed_ms?: number | null;
  }): Promise<VoiceSessionTurnV0 | null> {
    const asr = this.deps.asr;
    if (asr === undefined) {
      throw new VoiceFailureV0("VOICE_RUNTIME_UNAVAILABLE", "this deployment has no speech recognition");
    }
    const recognized = await asr.listen({
      language: this.config.language,
      ...(options?.fixed_ms === undefined ? {} : { fixed_ms: options.fixed_ms }),
      ...(options?.signal === undefined ? {} : { signal: options.signal })
    });
    if (recognized === null) return null;
    if (recognized.input.text.trim().length === 0) return null;
    return await this.runTurn(recognized.input.text, recognized, options?.signal);
  }

  /**
   * Demo C helper: speak arbitrary text under an explicitly supplied state.
   *
   * Used to prove that the SAME sentence sounds different under different
   * CharacterOS states. It deliberately does not run a turn, so the comparison
   * isolates the projection: identical text, different state, different audio.
   */
  async speakWithState(
    text: string,
    inputs: SpeechExpressionInputsV0,
    options?: {
      readonly signal?: AbortSignal;
      readonly save_path?: string | null;
      readonly play?: boolean;
      readonly return_audio?: boolean;
    }
  ): Promise<{ expression: SpeechExpressionV0; speech: SpeechSynthesisResultV0 }> {
    const tts = this.requireTts();
    const expression = projectSpeechExpressionV0(inputs, {
      ...(this.config.expression_config === undefined ? {} : { config: this.config.expression_config })
    });
    const request = this.buildRequest(text, expression);
    const speech = await tts.synthesize(request, {
      play: options?.play ?? this.config.speak,
      save_path: options?.save_path ?? null,
      return_audio: options?.return_audio ?? false,
      ...(options?.signal === undefined ? {} : { signal: options.signal })
    });
    return { expression, speech };
  }

  /** The exact request this session would send for a reply. */
  buildRequest(text: string, expression: SpeechExpressionV0): SpeechOutputRequestV0 {
    return {
      schema_version: "speech-output-request-v0",
      request_ref: turnRefV0(`${this.config.voice_id}\n${text}\n${expression.provenance.state_revision ?? "none"}`),
      text,
      language: this.config.language,
      voice_id: this.config.voice_id,
      expression,
      streaming: this.config.streaming
    };
  }

  private requireTts(): VoiceTtsAdapterV0 {
    const tts = this.deps.tts;
    if (tts === undefined) {
      throw new VoiceFailureV0("VOICE_RUNTIME_UNAVAILABLE", "this deployment has no speech synthesis");
    }
    return tts;
  }

  /**
   * The single turn path shared by typed and spoken input.
   *
   * State is read AFTER the turn commits, so the delivery reflects the subject
   * as it is at the moment of speaking (including this exchange's effect on
   * affect). The read is read-only and cannot alter the turn.
   */
  private async runTurn(
    text: string,
    recognized: SpeechRecognitionResultV0 | null,
    signal?: AbortSignal
  ): Promise<VoiceSessionTurnV0> {
    const turn = await this.deps.subject.submitUserText(text);
    const ref = turnRefV0(`${text}\n${turn.state_revision ?? "none"}\n${recognized?.input.utterance_ref ?? "typed"}`);

    if (turn.status !== "COMPLETED" || turn.reply_text === null) {
      return {
        turn_ref: ref,
        recognized,
        turn,
        expression: null,
        speech: null,
        speech_stream: null,
        speech_segments: [],
        speech_failure: null
      };
    }

    if (!this.config.speak || this.deps.tts === undefined) {
      return {
        turn_ref: ref,
        recognized,
        turn,
        expression: null,
        speech: null,
        speech_stream: null,
        speech_segments: [],
        speech_failure: null
      };
    }

    let expression: SpeechExpressionV0;
    try {
      const inputs = await this.deps.subject.readSpeechExpressionInputs();
      expression = projectSpeechExpressionV0(inputs, {
        state_revision: turn.state_revision,
        ...(this.config.expression_config === undefined ? {} : { config: this.config.expression_config })
      });
    } catch (error) {
      // A projection failure is a speech-channel failure only.
      return {
        turn_ref: ref,
        recognized,
        turn,
        expression: null,
        speech: null,
        speech_stream: null,
        speech_segments: [],
        speech_failure:
          error instanceof VoiceFailureV0
            ? error
            : new VoiceFailureV0("VOICE_RUNTIME_MALFORMED", "speech expression projection failed", error)
      };
    }

    const tts = this.deps.tts;
    // One queue per session, so `cancelSpeech()` silences exactly the speech that
    // is playing and drops whatever has not been generated yet.
    this.speechQueue ??= new SpeechQueueV0(
      {
        voice_id: this.config.voice_id,
        language: this.config.language,
        streaming: this.config.streaming,
        ...(this.config.segmentation === undefined ? {} : { segmentation: this.config.segmentation })
      },
      { tts }
    );
    const queue = this.speechQueue;
    const controller = new AbortController();
    this.activeSpeech = controller;

    try {
      // The reply is delivered as one complete string (CharacterOS's language
      // realization is a single validated call), so the queue's job is to speak
      // its SENTENCES in order and stop cleanly on interruption — not to invent
      // a token stream that does not exist.
      const outcome = await queue.enqueue(turn.reply_text, expression);
      const spoken = outcome.segments.filter((segment) => !segment.skipped);
      const firstSpeech = spoken.find((segment) => segment.speech !== null)?.speech ?? null;
      const firstStream = spoken.find((segment) => segment.stream !== null)?.stream ?? null;
      const failure =
        spoken.length === 0
          ? new VoiceFailureV0("VOICE_CANCELLED", "speech was cancelled before any segment was spoken")
          : (spoken.find((segment) => segment.failure !== null)?.failure ?? null);
      return {
        turn_ref: ref,
        recognized,
        turn,
        expression,
        speech: firstSpeech,
        speech_stream: firstStream,
        speech_segments: outcome.segments,
        speech_failure: failure
      };
    } catch (error) {
      // GRACEFUL DEGRADATION: the text turn stands; only the audio is missing.
      return {
        turn_ref: ref,
        recognized,
        turn,
        expression,
        speech: null,
        speech_stream: null,
        speech_segments: [],
        speech_failure:
          error instanceof VoiceFailureV0
            ? error
            : new VoiceFailureV0("VOICE_RUNTIME_UNAVAILABLE", "speech synthesis failed", error)
      };
    } finally {
      if (this.activeSpeech === controller) this.activeSpeech = null;
    }
  }
}
