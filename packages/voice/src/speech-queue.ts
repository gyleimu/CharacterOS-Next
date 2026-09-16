/**
 * CHARACTEROS_SPEECH_QUEUE_V0 — ordered, cancellable delivery of a reply's
 * segments.
 *
 * WHY THIS IS NOT A PARALLEL PREFETCHER. The runtime serializes synthesis behind
 * one lock, because a single consumer GPU cannot run two generations at once.
 * Sending segment 1 and segment 2 concurrently would therefore not make segment
 * 2 faster; it would only queue behind segment 1 and make the ordering
 * unpredictable. What the queue actually buys is:
 *
 *   - ORDER: segments are spoken in the order they were written, always.
 *   - NO GAP: the next segment is dispatched the moment the previous synthesis
 *     returns, so the only delay between sentences is the model's own time.
 *   - A CANCEL BOUNDARY: an interruption stops the current segment and drops the
 *     ones not yet started, instead of letting a long reply play to the end.
 *
 * Cancellation is checked between segments AND passed into the in-flight
 * request, so it stops both what is playing and what has not been generated.
 */

import { VoiceFailureV0, type SpeechExpressionV0 } from "./contracts.js";
import {
  DEFAULT_SPEECH_SEGMENTATION_CONFIG_V0,
  splitSpeechSegmentsV0,
  type SpeechSegmentationConfigV0,
  type SpeechSegmentV0
} from "./segmentation.js";
import type { SpeechSynthesisResultV0, VoiceTtsAdapterV0 } from "./adapters/cosyvoice-tts-adapter.js";
import type { SpeechStreamResultV0 } from "./runtime-client.js";

export interface SpeechQueueSegmentResultV0 {
  readonly index: number;
  readonly text: string;
  readonly speech: SpeechSynthesisResultV0 | null;
  readonly stream: SpeechStreamResultV0 | null;
  readonly failure: VoiceFailureV0 | null;
  /** True when this segment was dropped rather than spoken. */
  readonly skipped: boolean;
}

export interface SpeechQueueResultV0 {
  readonly segments: readonly SpeechQueueSegmentResultV0[];
  readonly cancelled: boolean;
  readonly total_ms: number;
  /** Time from enqueue to the first segment's first audio. */
  readonly first_audio_ms: number | null;
}

export interface SpeechQueueConfigV0 {
  readonly voice_id: string;
  readonly language: string;
  /** Ask the runtime for incremental synthesis (recommended). */
  readonly streaming: boolean;
  readonly segmentation?: SpeechSegmentationConfigV0;
}

export interface SpeechQueueDepsV0 {
  readonly tts: VoiceTtsAdapterV0;
  /** Called when a segment starts, for progress reporting. */
  readonly onSegmentStart?: (segment: SpeechSegmentV0, total: number) => void;
  /** Called when a segment finishes (or fails, or is skipped). */
  readonly onSegmentComplete?: (result: SpeechQueueSegmentResultV0, total: number) => void;
}

export class SpeechQueueV0 {
  private cancelled = false;
  private speaking = false;
  private activeController: AbortController | null = null;
  private pending = 0;

  constructor(
    private readonly config: SpeechQueueConfigV0,
    private readonly deps: SpeechQueueDepsV0
  ) {}

  isSpeaking(): boolean {
    return this.speaking;
  }

  /** Segments dispatched but not yet finished. */
  pendingSegments(): number {
    return this.pending;
  }

  /** Segments this text would be spoken as — exposed for tests and diagnostics. */
  segmentsFor(text: string): readonly SpeechSegmentV0[] {
    return splitSpeechSegmentsV0(text, this.config.segmentation ?? DEFAULT_SPEECH_SEGMENTATION_CONFIG_V0);
  }

  /**
   * Speaks `text` segment by segment, in order.
   *
   * Resolves with a per-segment record. A speech failure fails only that segment:
   * the remaining ones still play, because a single bad request must not swallow
   * the rest of the reply.
   */
  async enqueue(text: string, expression: SpeechExpressionV0): Promise<SpeechQueueResultV0> {
    const started = Date.now();
    const segments = this.segmentsFor(text);
    const results: SpeechQueueSegmentResultV0[] = [];
    let firstAudioMs: number | null = null;

    this.cancelled = false;
    this.speaking = true;
    this.pending = segments.length;

    try {
      for (const segment of segments) {
        if (this.cancelled) {
          results.push({
            index: segment.index,
            text: segment.text,
            speech: null,
            stream: null,
            failure: null,
            skipped: true
          });
          this.pending -= 1;
          this.deps.onSegmentComplete?.(results[results.length - 1] as SpeechQueueSegmentResultV0, segments.length);
          continue;
        }

        this.deps.onSegmentStart?.(segment, segments.length);
        const controller = new AbortController();
        this.activeController = controller;

        const request = {
          schema_version: "speech-output-request-v0" as const,
          request_ref: `speech-queue:${segment.index}:${Date.now()}`,
          text: segment.text,
          language: this.config.language,
          voice_id: this.config.voice_id,
          expression,
          streaming: this.config.streaming
        };

        try {
          let speech: SpeechSynthesisResultV0 | null = null;
          let stream: SpeechStreamResultV0 | null = null;
          if (this.config.streaming && this.deps.tts.synthesizeStream !== undefined) {
            stream = await this.deps.tts.synthesizeStream(request, {
              play: true,
              signal: controller.signal
            });
          } else {
            speech = await this.deps.tts.synthesize(request, {
              play: true,
              signal: controller.signal
            });
          }
          // The runtime plays as it generates, so "first audio" is the first
          // segment's measured first chunk.
          if (firstAudioMs === null) {
            firstAudioMs =
              stream?.ttfa_ms ?? (speech === null ? null : Date.now() - started);
          }
          const completed: SpeechQueueSegmentResultV0 = {
            index: segment.index,
            text: segment.text,
            speech,
            stream,
            failure: null,
            skipped: false
          };
          results.push(completed);
          this.deps.onSegmentComplete?.(completed, segments.length);
        } catch (error) {
          const failure =
            error instanceof VoiceFailureV0
              ? error
              : new VoiceFailureV0("VOICE_RUNTIME_UNAVAILABLE", "segment synthesis failed", error);
          // A cancelled segment is not a failure of the reply.
          if (this.cancelled || failure.code === "VOICE_CANCELLED") {
            this.cancelled = true;
          }
          const failed: SpeechQueueSegmentResultV0 = {
            index: segment.index,
            text: segment.text,
            speech: null,
            stream: null,
            failure,
            skipped: false
          };
          results.push(failed);
          this.deps.onSegmentComplete?.(failed, segments.length);
          if (this.cancelled) continue;
        } finally {
          if (this.activeController === controller) this.activeController = null;
          this.pending -= 1;
        }
      }
    } finally {
      this.speaking = false;
      this.pending = 0;
    }

    return {
      segments: results,
      cancelled: this.cancelled,
      total_ms: Date.now() - started,
      first_audio_ms: firstAudioMs
    };
  }

  /**
   * Interruption: stop the current segment and drop the ones not yet started.
   *
   * Aborts the local request and asks the runtime to stop generating and stop
   * the speaker, so the room goes quiet rather than the client merely detaching.
   */
  async cancel(): Promise<void> {
    this.cancelled = true;
    const controller = this.activeController;
    this.activeController = null;
    controller?.abort();
    if (this.deps.tts.cancel !== undefined) {
      await this.deps.tts.cancel();
    }
  }
}
