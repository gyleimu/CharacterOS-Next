import { describe, expect, it } from "vitest";
import {
  normalizeObservationTextV0,
  observationDedupeKeyV0,
  observationSimilarityV0,
  observationTokensV0,
  ObservationDedupeRingV0
} from "./dedupe.js";
import type { VisualObservationV0 } from "./types.js";

function observation(overrides: Partial<VisualObservationV0> = {}): VisualObservationV0 {
  return {
    schema_version: "visual-observation-v0",
    observation_id: "vo-1",
    timestamp: "2026-09-16T00:00:00.000Z",
    source: "desktop",
    description: "VS Code is open. The terminal shows a failed test.",
    frame_ref: "sha256:aa",
    ...overrides
  };
}

describe("dedupe text normalization", () => {
  it("collapses case, punctuation and whitespace", () => {
    expect(normalizeObservationTextV0("The  USER is Sitting!")).toBe("the user is sitting");
  });

  it("keeps non-latin scripts", () => {
    expect(normalizeObservationTextV0("用户在 桌前 坐着")).toBe("用户在 桌前 坐着");
  });
});

describe("dedupe key", () => {
  it("is identical for cosmetic rewording", () => {
    const a = observationDedupeKeyV0(observation());
    const b = observationDedupeKeyV0(observation({ description: "vs code is open, the terminal shows a failed test" }));
    expect(a).toBe(b);
  });

  it("differs when the observed content differs", () => {
    const a = observationDedupeKeyV0(observation());
    const b = observationDedupeKeyV0(observation({ description: "The browser shows a search page." }));
    expect(a).not.toBe(b);
  });

  it("ignores identity, timestamp and frame address", () => {
    const a = observationDedupeKeyV0(observation());
    const b = observationDedupeKeyV0(
      observation({ observation_id: "vo-2", timestamp: "2026-09-16T01:00:00.000Z", frame_ref: "sha256:bb" })
    );
    expect(a).toBe(b);
  });

  it("separates the two sources", () => {
    expect(observationDedupeKeyV0(observation())).not.toBe(observationDedupeKeyV0(observation({ source: "camera" })));
  });

  it("notices a changed activity list", () => {
    const a = observationDedupeKeyV0(observation({ activities: ["coding"] }));
    const b = observationDedupeKeyV0(observation({ activities: ["coding", "talking"] }));
    expect(a).not.toBe(b);
  });
});

describe("dedupe ring", () => {
  const tokens = (text: string): ReadonlySet<string> => observationTokensV0(text);

  it("reports an identical key inside the window and forgets it after eviction", () => {
    const ring = new ObservationDedupeRingV0(2);
    ring.record("a", tokens("a wall with a clock"));
    expect(ring.inspect("a", tokens("a totally different scene")).exact).toBe(true);
    ring.record("b", tokens("a person is sitting"));
    ring.record("c", tokens("a terminal shows a failure"));
    // The two-entry window now holds only "b" and "c", so "a" is forgotten.
    expect(ring.inspect("a", tokens("a totally different scene")).exact).toBe(false);
  });

  it("catches the same scene restated in different words", () => {
    const ring = new ObservationDedupeRingV0(2);
    ring.record("k1", tokens("The image shows a wall with three framed pictures, including what appears to be a clock."));
    const decision = ring.inspect(
      "k2",
      tokens("The image shows a wall with several framed items, including what appears to be pictures and a clock.")
    );
    expect(decision.exact).toBe(false);
    expect(decision.duplicate).toBe(true);
    expect(decision.similarity).toBeGreaterThanOrEqual(0.7);
  });

  it("does not treat a genuinely different scene as a restatement", () => {
    const ring = new ObservationDedupeRingV0(2);
    ring.record("k1", tokens("A person is sitting at the desk looking at the monitor."));
    const decision = ring.inspect("k2", tokens("The room is empty and nobody is visible."));
    expect(decision.duplicate).toBe(false);
  });

  it("never collapses opposite observations that share most of their words", () => {
    const ring = new ObservationDedupeRingV0(2);
    ring.record("k1", tokens("A person is present and sitting at the desk."));
    const decision = ring.inspect("k2", tokens("No person is present at the desk."));
    expect(decision.duplicate).toBe(false);
  });

  it("computes similarity as an intersection over union", () => {
    expect(observationSimilarityV0(tokens("a b c"), tokens("a b c"))).toBe(1);
    expect(observationSimilarityV0(tokens("a b"), tokens("c d"))).toBe(0);
  });

  it("forgets everything on reset", () => {
    const ring = new ObservationDedupeRingV0(2);
    ring.record("a", tokens("a wall"));
    ring.reset();
    expect(ring.inspect("a", tokens("a wall")).duplicate).toBe(false);
  });

  it("refuses a nonsensical window size", () => {
    expect(() => new ObservationDedupeRingV0(0)).toThrow();
  });
});
