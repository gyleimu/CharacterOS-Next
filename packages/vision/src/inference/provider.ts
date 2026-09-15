/**
 * The inference boundary. One narrow interface keeps the adapter independent of
 * WHICH local runtime serves MiniCPM-V 4.6 (Ollama today, a llama.cpp
 * `llama-server` OpenAI-compatible endpoint tomorrow) and keeps every provider
 * on the same timeout/error-code contract.
 */

import type { VisionErrorCodeV0, VisionSourceKindV0 } from "../types.js";

export interface VisionInferenceRequestV0 {
  readonly source: VisionSourceKindV0;
  /** base64 of ONE JPEG still; never persisted, never logged. */
  readonly image_jpeg_base64: string;
}

export type VisionInferenceOutcomeV0 =
  | { readonly kind: "OK"; readonly text: string; readonly latency_ms: number }
  | {
      readonly kind: "ERROR";
      readonly code: VisionErrorCodeV0;
      readonly detail: string;
      readonly latency_ms: number;
    };

export interface VisionInferenceProviderV0 {
  readonly provider_id: string;
  readonly model: string;
  infer(request: VisionInferenceRequestV0): Promise<VisionInferenceOutcomeV0>;
  /** Releases model resources (VRAM) if the runtime supports it. */
  release(): Promise<void>;
}

/** Reads `content` from a JSON value that may or may not be an object. */
export function readContentStringV0(value: unknown): string | null {
  if (typeof value !== "object" || value === null) return null;
  const message = (value as { message?: unknown }).message;
  if (typeof message !== "object" || message === null) return null;
  const content = (message as { content?: unknown }).content;
  return typeof content === "string" ? content : null;
}

export function boundedDetailV0(value: string, max = 300): string {
  const collapsed = value.replace(/\s+/gu, " ").trim();
  return collapsed.length <= max ? collapsed : `${collapsed.slice(0, max)}…`;
}
