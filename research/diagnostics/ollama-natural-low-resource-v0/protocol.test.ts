import { describe, expect, it } from "vitest";
import {
  FROZEN_REPRESENTATIVE_REQUEST_V0,
  NATURAL_CALL_IDS_V0,
  NATURAL_LOW_RESOURCE_PROTOCOL_V0,
  frozenRepresentativeFixtureV0,
  representativeFixtureMatchesFrozenV0
} from "./protocol.ts";

describe("Ollama natural low-resource reproduction v0 protocol", () => {
  it("allows exactly four cognition slots and forbids artificial pressure", () => {
    expect(NATURAL_CALL_IDS_V0).toEqual(["1", "2", "3", "4"]);
    expect(NATURAL_LOW_RESOURCE_PROTOCOL_V0.maximum_cognition_calls).toBe(4);
    expect(NATURAL_LOW_RESOURCE_PROTOCOL_V0.natural_window_lost_threshold_bytes).toBe(1024 ** 3);
    expect(NATURAL_LOW_RESOURCE_PROTOCOL_V0.artificial_pressure_allowed).toBe(false);
  });

  it("reuses the exact frozen Representative V1 request", async () => {
    const fixture = await frozenRepresentativeFixtureV0();
    expect(representativeFixtureMatchesFrozenV0(fixture.shape)).toBe(true);
    expect(fixture.shape.request_hash).toBe(FROZEN_REPRESENTATIVE_REQUEST_V0.request_hash);
    expect(fixture.shape.post_bytes).toBe(4522);
    expect(FROZEN_REPRESENTATIVE_REQUEST_V0.server_prompt_tokens).toBe(1068);
  });
});
