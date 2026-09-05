import { describe, expect, it } from "vitest";
import {
  PROVIDER_LOCK_V1,
  captureRepresentativeRequestV1,
  measureRepresentativeRequestV1,
  representativeFixtureAchievedV1,
  representativeProjectionV1,
  serializeProductionRequestV1
} from "./fixture.ts";

describe("representative cognition load diagnostic fixture v1", () => {
  it("uses the production provider shape and naturally reaches representative size", async () => {
    const projection = await representativeProjectionV1();
    const request = await captureRepresentativeRequestV1(projection);
    const shape = measureRepresentativeRequestV1(projection, request);
    const body = JSON.parse(serializeProductionRequestV1(request)) as Record<string, unknown>;

    expect(shape.post_bytes).toBeGreaterThanOrEqual(3_500);
    expect(shape.post_bytes).toBeLessThanOrEqual(5_000);
    expect(shape.approximate_prompt_tokens).toBeGreaterThanOrEqual(800);
    expect(shape.approximate_prompt_tokens).toBeLessThanOrEqual(1_100);
    expect(representativeFixtureAchievedV1(shape)).toBe(true);
    expect(shape.message_count).toBe(2);
    expect(body).toMatchObject({
      model: PROVIDER_LOCK_V1.model,
      think: false,
      stream: false,
      options: { temperature: 0, num_predict: 2048 }
    });
    expect(body).not.toHaveProperty("seed");
    expect(body).not.toHaveProperty("keep_alive");
  });

  it("contains only neutral diagnostic context and no artificial padding", async () => {
    const projection = await representativeProjectionV1();
    const request = await captureRepresentativeRequestV1(projection);
    const rendered = JSON.stringify({ projection, request }).toLowerCase();
    for (const forbidden of [
      "alice",
      "usual-way",
      "familiarity treatment",
      "causal experiment",
      "r3 scenario"
    ]) {
      expect(rendered).not.toContain(forbidden);
    }
    expect(new Set(request.messages.map((message) => message.content)).size).toBe(2);
  });

  it("is byte stable across independent lawful constructions", async () => {
    const firstProjection = await representativeProjectionV1();
    const secondProjection = await representativeProjectionV1();
    const first = measureRepresentativeRequestV1(
      firstProjection,
      await captureRepresentativeRequestV1(firstProjection)
    );
    const second = measureRepresentativeRequestV1(
      secondProjection,
      await captureRepresentativeRequestV1(secondProjection)
    );
    expect(second).toEqual(first);
  });
});
