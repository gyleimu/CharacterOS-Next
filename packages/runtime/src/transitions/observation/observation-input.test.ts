/**
 * P2.3.3.1 — ObservationInputV0 / ContextProducerPort tests.
 * Covers: valid observation input, invalid refs, missing required fields,
 * deterministic projection, no mutation of inputs.
 */

import { describe, expect, it } from "vitest";

import { hashEnvelope } from "@characteros-next/subject-core";
import { validateObservationInput } from "./types.js";
import {
  buildControlledProjectionView,
  CONTROLLED_PROJECTION_HASH_PROJECTION
} from "../../ports/context-producer-port.js";

function observationInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema_version: "observation-input-v0",
    subject_id: "subject-s0",
    observation_id: "observation:o-77",
    occurrence_logical_time: 42,
    source_refs: ["entity:e-1", "event:v-2", "source:s-3"],
    entity_refs: ["entity:e-1", "subject:s0"],
    ...overrides
  };
}

describe("validateObservationInput", () => {
  it("accepts a fully populated closed input", () => {
    const r = validateObservationInput(observationInput());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.observation_id).toBe("observation:o-77");
    expect(r.value.occurrence_logical_time).toBe(42);
  });

  it("rejects unknown keys, wrong literals and missing required fields", () => {
    const extra = observationInput({ raw_text: "sneaky NLU field" });
    expect(validateObservationInput(extra).ok).toBe(false);

    const wrongVersion = observationInput({ schema_version: "observation-input-v9" });
    expect(validateObservationInput(wrongVersion).ok).toBe(false);

    for (const key of [
      "subject_id",
      "observation_id",
      "occurrence_logical_time",
      "source_refs",
      "entity_refs"
    ]) {
      const missing = observationInput();
      delete missing[key];
      const r = validateObservationInput(missing);
      expect(r.ok).toBe(false);
    }
  });

  it("rejects invalid refs: malformed strings and foreign kinds", () => {
    const malformed = observationInput({ source_refs: ["not-a-ref"] });
    expect(validateObservationInput(malformed).ok).toBe(false);

    const wrongKindObservationId = observationInput({ observation_id: "episode:e-9" });
    expect(validateObservationInput(wrongKindObservationId).ok).toBe(false);

    const appraisalAsSource = observationInput({ source_refs: ["appraisal:ap-1"] });
    expect(validateObservationInput(appraisalAsSource).ok).toBe(false);

    const memoryAsEntity = observationInput({ entity_refs: ["memory:m-1"] });
    expect(validateObservationInput(memoryAsEntity).ok).toBe(false);
  });

  it("rejects duplicate and unsorted set-like refs", () => {
    const dup = observationInput({ source_refs: ["source:s-1", "source:s-1"] });
    expect(validateObservationInput(dup).ok).toBe(false);

    const unsorted = observationInput({ entity_refs: ["subject:s0", "entity:e-1"] });
    expect(validateObservationInput(unsorted).ok).toBe(false);
  });

  it("rejects non-canonical occurrence times", () => {
    const negative = observationInput({ occurrence_logical_time: -1 });
    const r = validateObservationInput(negative);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.error_code).toBe("INVALID_SCHEMA");
  });
});

describe("buildControlledProjectionView", () => {
  const ASSEMBLY = { context_scene: "lab", retrieval_result: null };

  it("is deterministic: same input+assembly ⇒ byte-identical view and hash", async () => {
    const checked = validateObservationInput(observationInput());
    if (!checked.ok) throw new Error("fixture invalid");
    const a = await buildControlledProjectionView(checked.value, ASSEMBLY);
    const b = await buildControlledProjectionView(checked.value, ASSEMBLY);
    expect(a).toEqual(b);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.projection_hash).toBe(b.projection_hash);
    expect(Object.isFrozen(a)).toBe(true);
  });

  it("hashes exactly the projected body with the frozen projection", async () => {
    const checked = validateObservationInput(observationInput());
    if (!checked.ok) throw new Error("fixture invalid");
    const view = await buildControlledProjectionView(checked.value, ASSEMBLY);
    const recomputed = await hashEnvelope(CONTROLLED_PROJECTION_HASH_PROJECTION, {
      projection_schema_version: "controlled-projection-view-v0",
      observation_id: view.observation_id,
      observation_refs: view.observation_refs,
      context_scene: view.context_scene,
      retrieval_result: view.retrieval_result
    });
    expect(recomputed).toBe(view.projection_hash);
  });

  it("projects the unique sorted union of fact refs", async () => {
    // source_refs [entity:e-1, event:v-2, source:s-3] + entity_refs [entity:e-1, subject:s0]
    // union, deduped, raw-ASCII sorted: entity:e-1, event:v-2, source:s-3, subject:s0
    const r = validateObservationInput(observationInput());
    if (!r.ok) throw new Error("fixture invalid");
    const view = await buildControlledProjectionView(r.value, ASSEMBLY);
    expect(view.observation_refs).toEqual([
      "entity:e-1",
      "event:v-2",
      "source:s-3",
      "subject:s0"
    ]);
  });

  it("changes the hash when the projection body changes (input-sensitive)", async () => {
    const base = validateObservationInput(observationInput());
    const changed = validateObservationInput(observationInput({ occurrence_logical_time: 43 }));
    if (!base.ok || !changed.ok) throw new Error("fixtures invalid");
    // Occurrence time is not projected; use a projected field change instead:
    const refsChanged = validateObservationInput(observationInput({ source_refs: ["source:s-9"] }));
    if (!refsChanged.ok) throw new Error("fixture invalid");
    const a = await buildControlledProjectionView(base.value, ASSEMBLY);
    const b = await buildControlledProjectionView(refsChanged.value, ASSEMBLY);
    expect(b.projection_hash).not.toBe(a.projection_hash);
  });

  it("never mutates the validated input", async () => {
    const input = observationInput();
    Object.freeze(input);
    const checked = validateObservationInput(input);
    expect(checked.ok).toBe(true);
    const before = JSON.stringify(input);
    if (checked.ok) {
      await buildControlledProjectionView(checked.value, ASSEMBLY);
    }
    expect(JSON.stringify(input)).toBe(before);
  });
});
