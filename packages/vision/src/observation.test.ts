import { describe, expect, it } from "vitest";
import { buildVisualObservationV0, parseModelObservationV0 } from "./observation.js";

const CLOCK = (atMs: number): string => new Date(atMs).toISOString();
const FRAME = Buffer.from([0xff, 0xd8, 1, 2, 3, 0xff, 0xd9]);

describe("model output validation", () => {
  it("accepts a complete lawful payload", () => {
    const result = parseModelObservationV0(
      JSON.stringify({
        description: "VS Code is open with a terminal showing a failed test.",
        confidence: 0.8,
        entities: [{ type: "application", description: "VS Code", confidence: 0.9 }],
        activities: ["coding"],
        visible_text: ["FAIL"],
        notable_events: ["test failure"],
        uncertainty: ["terminal text partially cut off"],
        application: "VS Code"
      })
    );
    expect(result.kind).toBe("OK");
    if (result.kind !== "OK") return;
    expect(result.observation.application).toBe("VS Code");
    expect(result.observation.activities).toEqual(["coding"]);
    expect(result.observation.confidence).toBe(0.8);
    expect(result.observation.truncated).toBe(false);
  });

  it("accepts a minimal payload and fills empty collections", () => {
    const result = parseModelObservationV0('{"description":"A person is sitting."}');
    expect(result.kind).toBe("OK");
    if (result.kind !== "OK") return;
    expect(result.observation.activities).toEqual([]);
    expect(result.observation.entities).toEqual([]);
    expect(result.observation.application).toBeNull();
    expect(result.observation.confidence).toBeNull();
  });

  it("treats explicit nulls on optional fields as absent", () => {
    const result = parseModelObservationV0(
      '{"description":"A desk.","confidence":null,"entities":null,"activities":null,"application":null}'
    );
    expect(result.kind).toBe("OK");
  });

  it("ignores unknown extra keys", () => {
    const result = parseModelObservationV0('{"description":"A desk.","mood":"happy","extra":42}');
    expect(result.kind).toBe("OK");
    if (result.kind !== "OK") return;
    expect(result.observation.description).toBe("A desk.");
  });

  it("rejects anything that is not JSON", () => {
    expect(parseModelObservationV0("The user is sitting at the desk.")).toEqual({
      kind: "INVALID",
      detail: "model output is not valid JSON"
    });
  });

  it("rejects JSON that is not an object", () => {
    expect(parseModelObservationV0("[1,2,3]").kind).toBe("INVALID");
    expect(parseModelObservationV0('"just a string"').kind).toBe("INVALID");
    expect(parseModelObservationV0("null").kind).toBe("INVALID");
  });

  it("rejects a missing or empty description", () => {
    expect(parseModelObservationV0("{}").kind).toBe("INVALID");
    expect(parseModelObservationV0('{"description":"   "}').kind).toBe("INVALID");
    expect(parseModelObservationV0('{"description":7}').kind).toBe("INVALID");
  });

  it("rejects wrongly typed optional fields instead of coercing them", () => {
    expect(parseModelObservationV0('{"description":"x","activities":"coding"}').kind).toBe("INVALID");
    expect(parseModelObservationV0('{"description":"x","activities":[1]}').kind).toBe("INVALID");
    expect(parseModelObservationV0('{"description":"x","visible_text":{"a":1}}').kind).toBe("INVALID");
    expect(parseModelObservationV0('{"description":"x","confidence":"0.5"}').kind).toBe("INVALID");
    expect(parseModelObservationV0('{"description":"x","confidence":1.5}').kind).toBe("INVALID");
    expect(parseModelObservationV0('{"description":"x","confidence":-0.1}').kind).toBe("INVALID");
    expect(parseModelObservationV0('{"description":"x","application":5}').kind).toBe("INVALID");
    expect(parseModelObservationV0('{"description":"x","entities":[{"type":"person"}]}').kind).toBe("INVALID");
    expect(parseModelObservationV0('{"description":"x","entities":["person"]}').kind).toBe("INVALID");
  });

  it("drops empty list entries rather than failing the frame", () => {
    const result = parseModelObservationV0('{"description":"x","activities":["","  ","walking"]}');
    expect(result.kind).toBe("OK");
    if (result.kind !== "OK") return;
    expect(result.observation.activities).toEqual(["walking"]);
  });

  it("truncates an over-long description on a word boundary and marks it", () => {
    const long = `${"word ".repeat(600)}end`;
    const result = parseModelObservationV0(JSON.stringify({ description: long }), {
      max_description_chars: 100,
      max_list_items: 4,
      max_item_chars: 20,
      max_entities: 2
    });
    expect(result.kind).toBe("OK");
    if (result.kind !== "OK") return;
    expect(result.observation.truncated).toBe(true);
    expect(result.observation.description.endsWith("…")).toBe(true);
    expect(result.observation.description.length).toBeLessThanOrEqual(101);
  });

  it("caps list length and entity count", () => {
    const result = parseModelObservationV0(
      JSON.stringify({
        description: "x",
        activities: ["a", "b", "c", "d", "e"],
        entities: [
          { type: "person", description: "p" },
          { type: "monitor", description: "m" },
          { type: "desk", description: "d" }
        ]
      }),
      { max_description_chars: 100, max_list_items: 2, max_item_chars: 20, max_entities: 2 }
    );
    expect(result.kind).toBe("OK");
    if (result.kind !== "OK") return;
    expect(result.observation.activities).toEqual(["a", "b"]);
    expect(result.observation.entities).toHaveLength(2);
    expect(result.observation.truncated).toBe(true);
  });
});

describe("observation assembly", () => {
  const parsed = parseModelObservationV0('{"description":"A person is sitting.","activities":["sitting"]}');

  it("is deterministic for the same still and timestamp", async () => {
    if (parsed.kind !== "OK") throw new Error("fixture must parse");
    const first = await buildVisualObservationV0({
      source: "camera",
      observation: parsed.observation,
      captured_at_ms: 1_700_000_000_000,
      frame_jpeg: FRAME,
      clock: CLOCK
    });
    const second = await buildVisualObservationV0({
      source: "camera",
      observation: parsed.observation,
      captured_at_ms: 1_700_000_000_000,
      frame_jpeg: FRAME,
      clock: CLOCK
    });
    expect(first.observation_id).toBe(second.observation_id);
    expect(first.schema_version).toBe("visual-observation-v0");
    expect(first.source).toBe("camera");
    expect(first.timestamp).toBe(new Date(1_700_000_000_000).toISOString());
  });

  it("distinguishes the same scene observed at a different moment", async () => {
    if (parsed.kind !== "OK") throw new Error("fixture must parse");
    const first = await buildVisualObservationV0({
      source: "camera",
      observation: parsed.observation,
      captured_at_ms: 1_700_000_000_000,
      frame_jpeg: FRAME,
      clock: CLOCK
    });
    const later = await buildVisualObservationV0({
      source: "camera",
      observation: parsed.observation,
      captured_at_ms: 1_700_000_030_000,
      frame_jpeg: FRAME,
      clock: CLOCK
    });
    expect(first.observation_id).not.toBe(later.observation_id);
  });

  it("carries a content address for the still and omits empty collections", async () => {
    if (parsed.kind !== "OK") throw new Error("fixture must parse");
    const observation = await buildVisualObservationV0({
      source: "desktop",
      observation: { ...parsed.observation, activities: [], confidence: null, application: null },
      captured_at_ms: 1_700_000_000_000,
      frame_jpeg: FRAME,
      clock: CLOCK
    });
    expect(observation.frame_ref).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(observation.activities).toBeUndefined();
    expect(observation.entities).toBeUndefined();
    expect(observation.uncertainty).toBeUndefined();
    expect(observation.confidence).toBeUndefined();
    expect(observation.application).toBeUndefined();
  });
});
