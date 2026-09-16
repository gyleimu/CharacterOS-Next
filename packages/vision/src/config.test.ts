import { describe, expect, it } from "vitest";
import {
  isLoopbackEndpointV0,
  resolveVisionConfigV0,
  VISION_CONFIG_DEFAULTS_V0,
  VisionConfigurationErrorV0
} from "./config.js";

describe("vision configuration", () => {
  it("is fully usable with an empty environment", () => {
    const config = resolveVisionConfigV0({});
    expect(config.enabled).toBe(true);
    expect(config.attention_level).toBe("NORMAL");
    expect(config.ffmpeg_path).toBe("ffmpeg");
    expect(config.camera.enabled).toBe(true);
    expect(config.desktop.enabled).toBe(true);
    expect(config.camera.stream_fps).toBe(VISION_CONFIG_DEFAULTS_V0.camera_stream_fps);
    expect(config.desktop.stream_fps).toBe(VISION_CONFIG_DEFAULTS_V0.desktop_stream_fps);
    expect(config.camera.min_inference_interval_ms).toBe(5000);
    expect(config.desktop.min_inference_interval_ms).toBe(3000);
    expect(config.inference.provider).toBe("ollama");
    expect(config.inference.model).toBe("minicpm-v4.6");
    expect(config.debug_save_frames).toBe(false);
    expect(config.desktop.region).toBeNull();
  });

  it("reads attention and source switches from the environment", () => {
    const config = resolveVisionConfigV0({
      VISION_ATTENTION: "focused",
      VISION_CAMERA_ENABLED: "0",
      VISION_DESKTOP_ENABLED: "false",
      VISION_ENABLED: "no"
    });
    expect(config.attention_level).toBe("FOCUSED");
    expect(config.camera.enabled).toBe(false);
    expect(config.desktop.enabled).toBe(false);
    expect(config.enabled).toBe(false);
  });

  it("falls back instead of failing on unusable values", () => {
    const config = resolveVisionConfigV0({
      VISION_ATTENTION: "PANICKED",
      VISION_ANALYSIS_WIDTH: "not-a-number",
      VISION_CAMERA_DEVICE_INDEX: "-4",
      VISION_CHANGE_THRESHOLD_DESKTOP: "9",
      VISION_TIMEOUT_MS: "250",
      VISION_THINK: "maybe"
    });
    expect(config.attention_level).toBe("NORMAL");
    expect(config.analysis_width).toBe(VISION_CONFIG_DEFAULTS_V0.analysis_width);
    expect(config.camera.device_index).toBe(0);
    expect(config.desktop.change.min_mean_abs_difference).toBe(1);
    expect(config.inference.timeout_ms).toBe(1000);
    expect(config.inference.think).toBe(false);
  });

  it("parses a desktop capture region in both accepted spellings", () => {
    expect(resolveVisionConfigV0({ VISION_DESKTOP_REGION: "1280x720+10+20" }).desktop.region).toEqual({
      x: 10,
      y: 20,
      width: 1280,
      height: 720
    });
    expect(resolveVisionConfigV0({ VISION_DESKTOP_REGION: "1280,720,10,20" }).desktop.region).toEqual({
      x: 10,
      y: 20,
      width: 1280,
      height: 720
    });
    expect(resolveVisionConfigV0({ VISION_DESKTOP_REGION: "nonsense" }).desktop.region).toBeNull();
  });

  it("applies explicit overrides last", () => {
    const config = resolveVisionConfigV0({ VISION_ATTENTION: "IDLE" }, { attention_level: "FOCUSED" });
    expect(config.attention_level).toBe("FOCUSED");
  });

  it("selects the OpenAI-compatible provider only when asked", () => {
    expect(resolveVisionConfigV0({ VISION_PROVIDER: "openai-compatible" }).inference.provider).toBe(
      "openai-compatible"
    );
    expect(resolveVisionConfigV0({ VISION_PROVIDER: "ollama" }).inference.provider).toBe("ollama");
    expect(resolveVisionConfigV0({ VISION_PROVIDER: "something-else" }).inference.provider).toBe("ollama");
  });
});

describe("V-03 — local-only inference endpoint", () => {
  it("accepts loopback endpoints", () => {
    for (const endpoint of [
      "http://127.0.0.1:11434",
      "http://localhost:11434",
      "http://[::1]:11434",
      "http://127.0.0.5:8080",
      "localhost:11434",
      "::1",
      "127.0.0.1"
    ]) {
      expect(isLoopbackEndpointV0(endpoint)).toBe(true);
      expect(resolveVisionConfigV0({ VISION_ENDPOINT: endpoint }).inference.endpoint).toBe(endpoint);
    }
  });

  it("rejects a remote endpoint by default, fail closed", () => {
    for (const endpoint of [
      "https://remote.example",
      "https://api.openai.com/v1",
      "http://192.168.1.10:11434",
      "http://10.0.0.5:11434",
      "http://0.0.0.0:11434",
      "http://vision.internal:8080",
      "not a url at all"
    ]) {
      expect(isLoopbackEndpointV0(endpoint)).toBe(false);
      expect(() => resolveVisionConfigV0({ VISION_ENDPOINT: endpoint })).toThrowError(VisionConfigurationErrorV0);
      try {
        resolveVisionConfigV0({ VISION_ENDPOINT: endpoint });
      } catch (error) {
        expect((error as VisionConfigurationErrorV0).code).toBe("VISION_REMOTE_ENDPOINT_FORBIDDEN");
      }
    }
  });

  it("allows a remote endpoint only through an explicit opt-in", () => {
    const config = resolveVisionConfigV0({
      VISION_ENDPOINT: "https://remote.example",
      VISION_ALLOW_REMOTE_ENDPOINT: "true"
    });
    expect(config.inference.endpoint).toBe("https://remote.example");
    expect(config.inference.allow_remote_endpoint).toBe(true);
  });

  it("ignores an opt-in that is not set, and defaults to loopback", () => {
    const config = resolveVisionConfigV0({});
    expect(config.inference.allow_remote_endpoint).toBe(false);
    expect(isLoopbackEndpointV0(config.inference.endpoint)).toBe(true);
  });
});
