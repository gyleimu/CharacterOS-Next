/**
 * OpenAI-compatible provider — the llama.cpp (`llama-server`) path.
 *
 * `llama-server -m MiniCPM-V-4_6-Q4_K_M.gguf --mmproj mmproj-model-f16.gguf
 * --port 8080` exposes `/v1/chat/completions` with `image_url` data URIs, so the
 * very same adapter can run against raw GGUF weights without touching any other
 * code. Ollama also exposes this endpoint, but the native provider above is
 * preferred for it.
 */

import { OBSERVATION_JSON_SCHEMA_V0 } from "./observation-schema.js";
import { buildVisionPromptV0 } from "./prompts.js";
import {
  boundedDetailV0,
  type VisionInferenceOutcomeV0,
  type VisionInferenceProviderV0,
  type VisionInferenceRequestV0
} from "./provider.js";

export interface OpenAiCompatibleVisionProviderConfigV0 {
  /** e.g. `http://127.0.0.1:8080` (llama-server) */
  readonly endpoint: string;
  readonly model: string;
  readonly timeout_ms: number;
  readonly max_tokens: number;
  readonly api_key: string | null;
}

function normalizeEndpoint(endpoint: string): string {
  const trimmed = endpoint.endsWith("/") ? endpoint.slice(0, -1) : endpoint;
  return trimmed.endsWith("/v1") ? trimmed : `${trimmed}/v1`;
}

function readChoicesContentV0(value: unknown): string | null {
  if (typeof value !== "object" || value === null) return null;
  const choices = (value as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const first = choices[0];
  if (typeof first !== "object" || first === null) return null;
  const message = (first as { message?: unknown }).message;
  if (typeof message !== "object" || message === null) return null;
  const content = (message as { content?: unknown }).content;
  return typeof content === "string" ? content : null;
}

export function createOpenAiCompatibleVisionProviderV0(
  config: OpenAiCompatibleVisionProviderConfigV0
): VisionInferenceProviderV0 {
  const base = normalizeEndpoint(config.endpoint);

  return {
    provider_id: "openai-compatible",
    model: config.model,
    async infer(input: VisionInferenceRequestV0): Promise<VisionInferenceOutcomeV0> {
      const prompt = buildVisionPromptV0(input.source);
      const startedAt = Date.now();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), config.timeout_ms);
      try {
        const headers: Record<string, string> = { "content-type": "application/json" };
        if (config.api_key !== null) headers["authorization"] = `Bearer ${config.api_key}`;
        const response = await fetch(`${base}/chat/completions`, {
          method: "POST",
          headers,
          signal: controller.signal,
          body: JSON.stringify({
            model: config.model,
            stream: false,
            temperature: 0,
            max_tokens: config.max_tokens,
            response_format: {
              type: "json_schema",
              json_schema: { name: "visual_observation", strict: true, schema: OBSERVATION_JSON_SCHEMA_V0 }
            },
            messages: [
              { role: "system", content: prompt.system },
              {
                role: "user",
                content: [
                  { type: "text", text: prompt.instruction },
                  {
                    type: "image_url",
                    image_url: { url: `data:image/jpeg;base64,${input.image_jpeg_base64}` }
                  }
                ]
              }
            ]
          })
        });
        const latency = Date.now() - startedAt;
        if (!response.ok) {
          const text = await response.text().catch(() => "");
          return {
            kind: "ERROR",
            code: response.status >= 500 ? "MODEL_UNAVAILABLE" : "MODEL_REQUEST_FAILED",
            detail: `HTTP ${response.status} ${boundedDetailV0(text, 200)}`,
            latency_ms: latency
          };
        }
        const text = readChoicesContentV0((await response.json()) as unknown);
        if (text === null) {
          return {
            kind: "ERROR",
            code: "MODEL_REQUEST_FAILED",
            detail: "response carries no message content",
            latency_ms: latency
          };
        }
        return { kind: "OK", text, latency_ms: latency };
      } catch (error) {
        const aborted = error instanceof Error && error.name === "AbortError";
        return {
          kind: "ERROR",
          code: aborted ? "MODEL_TIMEOUT" : "MODEL_UNAVAILABLE",
          detail: boundedDetailV0(error instanceof Error ? error.message : String(error)),
          latency_ms: Date.now() - startedAt
        };
      } finally {
        clearTimeout(timer);
      }
    },
    async release(): Promise<void> {
      // llama-server owns its own residency; nothing to release over HTTP.
    }
  };
}
