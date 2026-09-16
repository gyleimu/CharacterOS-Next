/**
 * CHARACTEROS_SPEECH_SEGMENTATION_V0 — cutting a finished reply into speakable
 * units.
 *
 * CharacterOS delivers a reply as ONE complete string (its language realization
 * is a single validated call, not a token stream), so there is no partial text
 * to start on. What this module provides is the next best thing: a deterministic
 * sentence split so the runtime can begin speaking the first sentence while the
 * later ones are still being synthesized, and so an interruption has a clean
 * boundary to stop at.
 *
 * Deliberately NOT token-by-token. Splitting on every few characters would
 * restart the model constantly, destroy prosody, and make the voice identity
 * drift. The boundaries used are sentence-final punctuation, with commas used
 * only to rescue a sentence that has grown too long to speak comfortably.
 */

export interface SpeechSegmentV0 {
  readonly index: number;
  readonly text: string;
  /** True when the segment ends at a sentence boundary, false when it was cut. */
  readonly terminated: boolean;
}

export interface SpeechSegmentationConfigV0 {
  /** Soft cap; a comma is accepted as a boundary past this length. */
  readonly max_chars: number;
  /**
   * Merge fragments shorter than this into the previous segment, to avoid
   * spending a whole model call on a two-character scrap.
   *
   * DISABLED BY DEFAULT (0). Preserving sentence boundaries matters more than
   * saving a call: a reply segmented sentence-by-sentence is what lets speech
   * start on the first sentence, and merging silently destroys that. Real
   * fragments worth dropping — punctuation-only runs like "……" — are already
   * filtered out. Set this only if a reply is known to contain scraps.
   */
  readonly min_chars: number;
  /** Hard cap; a segment longer than this is cut even without punctuation. */
  readonly hard_max_chars: number;
}

export const DEFAULT_SPEECH_SEGMENTATION_CONFIG_V0: SpeechSegmentationConfigV0 = {
  max_chars: 60,
  min_chars: 0,
  hard_max_chars: 160
};

/** Sentence-final punctuation, including the CJK forms and ellipsis. */
const SENTENCE_END = new Set(["。", "！", "？", "!", "?", "…", "；", ";", "\n"]);
/** Weaker boundaries, used only when a segment has grown too long. */
const CLAUSE_END = new Set(["，", ",", "、", "：", ":"]);

function isPurePunctuation(text: string): boolean {
  return text.trim().length > 0 && !/[\p{L}\p{N}]/u.test(text);
}

/**
 * Splits `text` into speakable segments.
 *
 * Deterministic: the same text and config always produce the same segments.
 * Whitespace-only and punctuation-only fragments are dropped rather than sent to
 * the model, which would otherwise produce noise for a segment like "……".
 */
export function splitSpeechSegmentsV0(
  text: string,
  config: SpeechSegmentationConfigV0 = DEFAULT_SPEECH_SEGMENTATION_CONFIG_V0
): readonly SpeechSegmentV0[] {
  const normalized = text.replace(/\r\n?/g, "\n").trim();
  if (normalized.length === 0) return [];

  const raw: { text: string; terminated: boolean }[] = [];
  let current = "";
  let terminated = false;

  const flush = (): void => {
    const trimmed = current.trim();
    if (trimmed.length > 0 && !isPurePunctuation(trimmed)) {
      raw.push({ text: trimmed, terminated });
    }
    current = "";
    terminated = false;
  };

  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i] as string;
    current += char;
    const body = current.trim();

    if (SENTENCE_END.has(char)) {
      // A run of ellipsis characters is ONE terminator: splitting between the
      // two halves of "……" would emit a bare "…" as its own segment.
      if (char === "…" && normalized[i + 1] === "…") {
        continue;
      }
      terminated = true;
      flush();
      continue;
    }
    if (CLAUSE_END.has(char) && body.length >= config.max_chars) {
      flush();
      continue;
    }
    if (body.length >= config.hard_max_chars) {
      flush();
    }
  }
  flush();

  // Optional fragment merging. Off by default: see SpeechSegmentationConfigV0.
  const merged: { text: string; terminated: boolean }[] = [];
  for (const segment of raw) {
    const previous = merged[merged.length - 1];
    if (config.min_chars > 0 && previous !== undefined && segment.text.length < config.min_chars) {
      merged[merged.length - 1] = {
        text: `${previous.text}${segment.text}`,
        terminated: segment.terminated
      };
    } else {
      merged.push({ ...segment });
    }
  }

  return merged.map((segment, index) => ({
    index,
    text: segment.text,
    terminated: segment.terminated
  }));
}

/** True when the text would be spoken as more than one segment. */
export function isMultiSegmentV0(
  text: string,
  config: SpeechSegmentationConfigV0 = DEFAULT_SPEECH_SEGMENTATION_CONFIG_V0
): boolean {
  return splitSpeechSegmentsV0(text, config).length > 1;
}
