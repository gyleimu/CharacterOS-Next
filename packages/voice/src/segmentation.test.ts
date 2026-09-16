/**
 * CHARACTEROS_SPEECH_SEGMENTATION_V0 — sentence splitting behaviour.
 *
 * The boundary discipline matters: splitting too eagerly restarts the model
 * constantly and destroys prosody, splitting too late means the first sound is
 * delayed by the whole reply. These tests pin both ends — sentence-final
 * punctuation always splits, commas split only once a segment has grown long,
 * and fragments too short to be worth a model call are merged back.
 */

import { describe, expect, it } from "vitest";

import {
  DEFAULT_SPEECH_SEGMENTATION_CONFIG_V0,
  isMultiSegmentV0,
  splitSpeechSegmentsV0
} from "./segmentation.js";

const texts = (input: string): string[] => splitSpeechSegmentsV0(input).map((s) => s.text);

describe("sentence boundaries", () => {
  it("splits a multi-sentence reply at sentence-final punctuation", () => {
    // The ellipsis is its own terminator, so "只是……" is a complete segment
    // rather than a bare "…" plus a fragment.
    expect(texts("我当然记得你。只是……你已经很久没有来了。")).toEqual([
      "我当然记得你。",
      "只是……",
      "你已经很久没有来了。"
    ]);
  });

  it("treats each CJK and ASCII terminator as a boundary", () => {
    expect(texts("你好！你好？你好。你好!你好?")).toEqual(["你好！", "你好？", "你好。", "你好!", "你好?"]);
  });

  it("splits on newlines", () => {
    expect(texts("第一行\n第二行")).toEqual(["第一行", "第二行"]);
  });

  it("keeps a single sentence as one segment", () => {
    expect(texts("我没事。")).toEqual(["我没事。"]);
  });

  it("preserves order and assigns sequential indexes", () => {
    const segments = splitSpeechSegmentsV0("一。二。三。");
    expect(segments.map((s) => s.index)).toEqual([0, 1, 2]);
    expect(segments.map((s) => s.text)).toEqual(["一。", "二。", "三。"]);
  });

  it("marks whether a segment ended at a real boundary", () => {
    const segments = splitSpeechSegmentsV0("这是一个很长的句子没有标点符号".repeat(6));
    expect(segments.some((s) => s.terminated)).toBe(false);
  });
});

describe("defensive behaviour", () => {
  it("returns nothing for empty or whitespace input", () => {
    expect(splitSpeechSegmentsV0("")).toEqual([]);
    expect(splitSpeechSegmentsV0("   \n  ")).toEqual([]);
  });

  it("drops punctuation-only fragments instead of synthesizing them", () => {
    expect(texts("你好。……？")).toEqual(["你好。"]);
    expect(texts("……")).toEqual([]);
  });

  it("keeps short sentences as their own segments by default", () => {
    // Merging is opt-in: folding "好。" into the previous sentence would destroy
    // the boundary that lets speech start early.
    expect(texts("今天的天气真的很不错。好。")).toEqual(["今天的天气真的很不错。", "好。"]);
  });

  it("merges short fragments only when explicitly asked to", () => {
    const merged = splitSpeechSegmentsV0("今天的天气真的很不错。好。", {
      max_chars: 60,
      min_chars: 4,
      hard_max_chars: 160
    });
    expect(merged.map((s) => s.text)).toEqual(["今天的天气真的很不错。好。"]);
  });

  it("never emits a segment longer than the hard cap", () => {
    const long = "这是一个没有标点符号的很长的句子".repeat(12);
    const segments = splitSpeechSegmentsV0(long);
    for (const segment of segments) {
      expect(segment.text.length).toBeLessThanOrEqual(
        DEFAULT_SPEECH_SEGMENTATION_CONFIG_V0.hard_max_chars
      );
    }
    expect(segments.map((s) => s.text).join("")).toBe(long);
  });

  it("is deterministic for the same input", () => {
    const input = "一。二，三。四……五！";
    expect(texts(input)).toEqual(texts(input));
  });

  it("reports whether a reply spans multiple segments", () => {
    expect(isMultiSegmentV0("我没事。")).toBe(false);
    expect(isMultiSegmentV0("我没事。你呢？")).toBe(true);
  });
});

describe("comma handling", () => {
  it("does not split on a comma inside a short sentence", () => {
    expect(texts("你好，我是 CharacterOS。")).toEqual(["你好，我是 CharacterOS。"]);
  });

  it("uses a comma once the segment has grown past the soft cap", () => {
    const segments = splitSpeechSegmentsV0(
      "前面这一部分已经足够长了可以断开，后面这一部分同样也很长需要单独处理，最后还有一点。",
      { max_chars: 20, min_chars: 4, hard_max_chars: 200 }
    );
    expect(segments.length).toBeGreaterThan(1);
    expect(segments.every((s) => s.text.length > 0)).toBe(true);
  });

  it("honours a custom hard cap", () => {
    const segments = splitSpeechSegmentsV0("一二三四五六七八九十".repeat(3), {
      max_chars: 10,
      min_chars: 2,
      hard_max_chars: 12
    });
    for (const segment of segments) {
      expect(segment.text.length).toBeLessThanOrEqual(12);
    }
  });
});
