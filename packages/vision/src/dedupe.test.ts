import { describe, expect, it } from "vitest";
import {
  normalizeObservationTextV0,
  observationDedupeCandidateV0,
  observationDedupeKeyV0,
  observationSimilarityV0,
  observationTokensV0,
  ObservationDedupeRingV0,
  type DedupeCandidateV0
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
  const candidate = (key: string, description: string, application: string | null = null): DedupeCandidateV0 =>
    observationDedupeCandidateV0({ key, description, application });

  it("reports an identical key inside the window and forgets it after eviction", () => {
    const ring = new ObservationDedupeRingV0(2);
    ring.record(candidate("a", "a wall with a clock"));
    expect(ring.inspect(candidate("a", "a totally different scene")).exact).toBe(true);
    ring.record(candidate("b", "a person is sitting"));
    ring.record(candidate("c", "a terminal shows a failure"));
    // The two-entry window now holds only "b" and "c", so "a" is forgotten.
    expect(ring.inspect(candidate("a", "a totally different scene")).exact).toBe(false);
  });

  it("catches the same scene restated in different words", () => {
    const ring = new ObservationDedupeRingV0(2);
    ring.record(
      candidate("k1", "The image shows a wall with three framed pictures, including what appears to be a clock.")
    );
    const decision = ring.inspect(
      candidate("k2", "The image shows a wall with several framed items, including what appears to be pictures and a clock.")
    );
    expect(decision.exact).toBe(false);
    expect(decision.duplicate).toBe(true);
    expect(decision.similarity).toBeGreaterThanOrEqual(0.7);
  });

  it("does not treat a genuinely different scene as a restatement", () => {
    const ring = new ObservationDedupeRingV0(2);
    ring.record(candidate("k1", "A person is sitting at the desk looking at the monitor."));
    const decision = ring.inspect(candidate("k2", "The room is empty and nobody is visible."));
    expect(decision.duplicate).toBe(false);
  });

  it("never collapses opposite observations that share most of their words", () => {
    const ring = new ObservationDedupeRingV0(2);
    ring.record(candidate("k1", "A person is present and sitting at the desk."));
    const decision = ring.inspect(candidate("k2", "No person is present at the desk."));
    expect(decision.duplicate).toBe(false);
  });

  it("vetoes near-duplicates when a negation appears on only one side", () => {
    const ring = new ObservationDedupeRingV0(2);
    ring.record(candidate("k1", "The user is sitting at desk"));
    const withoutNegation = ring.inspect(candidate("k2", "The user is sitting at the desk"));
    const withNegation = ring.inspect(candidate("k3", "The user is not sitting at desk"));
    expect(withoutNegation.similarity).toBeGreaterThanOrEqual(0.7);
    expect(withoutNegation.duplicate).toBe(true);
    expect(withNegation.duplicate).toBe(false);
  });

  it("vetoes near-duplicates when the application changed", () => {
    const ring = new ObservationDedupeRingV0(2);
    ring.record(candidate("k1", "A window with text is visible.", "code editor"));
    const sameApp = ring.inspect(candidate("k2", "A window with some text is visible.", "code editor"));
    const otherApp = ring.inspect(candidate("k3", "A window with some text is visible.", "web browser"));
    expect(sameApp.duplicate).toBe(true);
    expect(otherApp.duplicate).toBe(false);
  });

  it("still dedupes structurally identical observations exactly", () => {
    const ring = new ObservationDedupeRingV0(2);
    ring.record(candidate("same", "The user is not sitting at the desk", "terminal"));
    expect(ring.inspect(candidate("same", "The user is not sitting at the desk", "terminal")).exact).toBe(true);
  });

  it("computes similarity as an intersection over union", () => {
    expect(observationSimilarityV0(tokens("a b c"), tokens("a b c"))).toBe(1);
    expect(observationSimilarityV0(tokens("a b"), tokens("c d"))).toBe(0);
  });

  it("forgets everything on reset", () => {
    const ring = new ObservationDedupeRingV0(2);
    ring.record(candidate("a", "a wall"));
    ring.reset();
    expect(ring.inspect(candidate("a", "a wall")).duplicate).toBe(false);
  });

  it("refuses a nonsensical window size", () => {
    expect(() => new ObservationDedupeRingV0(0)).toThrow();
  });
});
