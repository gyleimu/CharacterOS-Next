import { describe, expect, it } from "vitest";
import { OBSERVATION_FIELD_GUIDANCE_V0, OBSERVATION_JSON_SCHEMA_V0 } from "./observation-schema.js";
import { buildVisionPromptV0 } from "./prompts.js";

describe("structured output contract", () => {
  it("requires every field the validator understands", () => {
    expect([...OBSERVATION_JSON_SCHEMA_V0.required].sort()).toEqual(
      [
        "activities",
        "application",
        "confidence",
        "description",
        "entities",
        "notable_events",
        "uncertainty",
        "visible_text"
      ].sort()
    );
  });

  it("types the list fields as arrays of strings", () => {
    for (const field of ["activities", "visible_text", "notable_events", "uncertainty"] as const) {
      expect(OBSERVATION_JSON_SCHEMA_V0.properties[field].items.type).toBe("string");
      expect(OBSERVATION_JSON_SCHEMA_V0.properties[field].maxItems).toBeGreaterThan(0);
    }
  });

  it("types entities as objects, never as bare strings", () => {
    const entities = OBSERVATION_JSON_SCHEMA_V0.properties.entities;
    expect(entities.items.type).toBe("object");
    expect([...entities.items.required].sort()).toEqual(["description", "type"]);
  });

  it("allows confidence and application to be null", () => {
    expect(OBSERVATION_JSON_SCHEMA_V0.properties.confidence.type).toContain("null");
    expect(OBSERVATION_JSON_SCHEMA_V0.properties.application.type).toContain("null");
  });

  it("states the confidence scale the model got wrong without a grammar", () => {
    expect(OBSERVATION_FIELD_GUIDANCE_V0).toContain("0 to 1");
  });
});

describe("prompts", () => {
  it("uses the fixed camera system prompt and forbids mental-state inference", () => {
    const prompt = buildVisionPromptV0("camera");
    expect(prompt.system).toContain("You are a visual perception module.");
    expect(prompt.system).toContain("Do not infer hidden mental states");
    expect(prompt.instruction).toContain('type "person"');
    expect(prompt.instruction).toContain("application");
  });

  it("uses the fixed desktop system prompt and forbids invented text", () => {
    const prompt = buildVisionPromptV0("desktop");
    expect(prompt.system).toContain("You are observing a computer desktop.");
    expect(prompt.system).toContain("Do not invent text that cannot be clearly read.");
    expect(prompt.instruction).toContain("visible_text");
  });

  it("carries the prohibition instead of asking for hidden states", () => {
    expect(buildVisionPromptV0("camera").system).toContain("Do not infer hidden mental states");
    expect(buildVisionPromptV0("desktop").system).toContain("Do not invent text that cannot be clearly read.");
  });

  it("exposes no cognition-layer field, in the schema or in the guidance", () => {
    const contract = `${Object.keys(OBSERVATION_JSON_SCHEMA_V0.properties).join(" ")} ${OBSERVATION_FIELD_GUIDANCE_V0}`.toLowerCase();
    for (const forbidden of ["emotion", "belief", "memory", "relationship", "personality", "desire", "action"]) {
      expect(contract).not.toContain(forbidden);
    }
  });
});
