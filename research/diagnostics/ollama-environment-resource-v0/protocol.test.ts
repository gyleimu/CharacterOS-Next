import { describe, expect, it } from "vitest";
import {
  ENVIRONMENT_RESOURCE_DIAGNOSTIC_PROTOCOL_V0,
  FROZEN_REPRESENTATIVE_REQUEST_V0,
  PRESSURE_LEVELS_V0,
  frozenRepresentativeFixtureV0,
  representativeFixtureMatchesFrozenV0
} from "./protocol.ts";

describe("Ollama environment resource diagnostic v0 protocol", () => {
  it("locks three bounded levels and six maximum model calls", () => {
    expect(PRESSURE_LEVELS_V0.map((level) => level.requested_mib)).toEqual([0, 512, 1024]);
    expect(PRESSURE_LEVELS_V0.flatMap((level) => level.call_ids)).toEqual(["0A", "0B", "1A", "1B", "2A", "2B"]);
    expect(ENVIRONMENT_RESOURCE_DIAGNOSTIC_PROTOCOL_V0.maximum_model_calls).toBe(6);
    expect(ENVIRONMENT_RESOURCE_DIAGNOSTIC_PROTOCOL_V0.safety_floor_mib).toBe(768);
  });

  it("reuses the exact frozen representative V1 request", async () => {
    const fixture = await frozenRepresentativeFixtureV0();
    expect(representativeFixtureMatchesFrozenV0(fixture.shape)).toBe(true);
    expect(fixture.shape.request_hash).toBe(FROZEN_REPRESENTATIVE_REQUEST_V0.request_hash);
    expect(fixture.shape.post_bytes).toBe(4522);
    expect(fixture.request.messages).toHaveLength(2);
  });
});
