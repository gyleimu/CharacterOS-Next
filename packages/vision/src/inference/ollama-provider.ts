/**
 * Ollama provider — the primary local runtime.
 *
 * Ollama serves the official `minicpm-v4.6` library model through llama.cpp,
 * handles the vision projector for us, and exposes both a native chat endpoint
 * (used here, because it takes raw base64 images directly) and an
 * OpenAI-compatible one. `keep_alive` is explicit so VRAM residency is a
 * decision this adapter makes rather than a runtime default.
 */

import { OBSERVATION_JSON_SCHEMA_V0 } from "./observation-schema.js";
import { buildVisionPromptV0 } from "./prompts.js";
import {
  boundedDetailV0,
  readContentStringV0,
  type VisionInferenceOutcomeV0,
  type VisionInferenceProviderV0,
  type VisionInferenceRequestV0
} from "./provider.js";

export interface OllamaVisionProviderConfigV0 {
  /** e.g. `http://127.0.0.1:11434` */
  readonly endpoint: string;
  readonly model: string;
  readonly timeout_ms: number;
  readonly num_predict: number;
  /** How long the model stays resident after a call (e.g. `30s`, `5m`, `0`). */
  readonly keep_alive: string;
  /** `false` disables a thinking phase where supported; `null` omits the field. */
  readonly think: boolean | null;
}

function normalizeEndpoint(endpoint: string): string {
  return endpoint.endsWith("/") ? endpoint.slice(0, -1) : endpoint;
}

export function createOllamaVisionProviderV0(config: OllamaVisionProviderConfigV0): VisionInferenceProviderV0 {
  const base = normalizeEndpoint(config.endpoint);

  const request = async (
    path: string,
    body: Record<string, unknown>,
    timeoutMs: number
  ): Promise<{ ok: true; value: unknown } | { ok: false; detail: string; timeout: boolean; unreachable: boolean }> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${base}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        return {
          ok: false,
          detail: `HTTP ${response.status} ${boundedDetailV0(text, 200)}`,
          timeout: false,
          unreachable: response.status >= 500
        };
      }
      return { ok: true, value: (await response.json()) as unknown };
    } catch (error) {
      const aborted = error instanceof Error && error.name === "AbortError";
      return {
        ok: false,
        detail: boundedDetailV0(error instanceof Error ? error.message : String(error)),
        timeout: aborted,
        unreachable: !aborted
      };
    } finally {
      clearTimeout(timer);
    }
  };

  return {
    provider_id: "ollama",
    model: config.model,
    async infer(input: VisionInferenceRequestV0): Promise<VisionInferenceOutcomeV0> {
      const prompt = buildVisionPromptV0(input.source);
      const startedAt = Date.now();
      const body: Record<string, unknown> = {
        model: config.model,
        stream: false,
        format: OBSERVATION_JSON_SCHEMA_V0,
        keep_alive: config.keep_alive,
        options: { temperature: 0, num_predict: config.num_predict },
        messages: [
          { role: "system", content: prompt.system },
          { role: "user", content: prompt.instruction, images: [input.image_jpeg_base64] }
        ]
      };
      if (config.think !== null) body["think"] = config.think;
      const result = await request("/api/chat", body, config.timeout_ms);
      const latency = Date.now() - startedAt;
      if (!result.ok) {
        return {
          kind: "ERROR",
          code: result.timeout ? "MODEL_TIMEOUT" : result.unreachable ? "MODEL_UNAVAILABLE" : "MODEL_REQUEST_FAILED",
          detail: result.detail,
          latency_ms: latency
        };
      }
      const text = readContentStringV0(result.value);
      if (text === null) {
        return {
          kind: "ERROR",
          code: "MODEL_REQUEST_FAILED",
          detail: "response carries no message content",
          latency_ms: latency
        };
      }
      return { kind: "OK", text, latency_ms: latency };
    },
    async release(): Promise<void> {
      // Best-effort VRAM release; a failure here must never break shutdown.
      await request("/api/generate", { model: config.model, keep_alive: 0 }, 10000).catch(() => undefined);
    }
  };
}
