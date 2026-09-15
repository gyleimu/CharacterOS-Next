import { describe, expect, it } from "vitest";
import { normalizeObservationTextV0, observationDedupeKeyV0, ObservationDedupeRingV0 } from "./dedupe.js";
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
  it("reports a repeat inside the window and forgets it after eviction", () => {
    const ring = new ObservationDedupeRingV0(2);
    expect(ring.isDuplicateAndRecord("a")).toBe(false);
    expect(ring.isDuplicateAndRecord("a")).toBe(true);
    expect(ring.isDuplicateAndRecord("b")).toBe(false);
    expect(ring.isDuplicateAndRecord("c")).toBe(false);
    // The two-entry window now holds only "b" and "c", so "a" is forgotten.
    expect(ring.isDuplicateAndRecord("a")).toBe(false);
  });

  it("separates a non-recording membership check from recording", () => {
    const ring = new ObservationDedupeRingV0(2);
    expect(ring.contains("a")).toBe(false);
    ring.record("a");
    expect(ring.contains("a")).toBe(true);
    ring.reset();
    expect(ring.contains("a")).toBe(false);
  });

  it("refuses a nonsensical window size", () => {
    expect(() => new ObservationDedupeRingV0(0)).toThrow();
  });
});
