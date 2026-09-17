/**
 * PERSISTENT_SUBJECT_VISION_PRODUCT_INTEGRATION_V0 — VISUAL PERCEPTION BOUNDARY.
 *
 * Vision is an INPUT MODALITY: a camera (or screen) frame becomes a bounded
 * STRUCTURED PERCEPTION CANDIDATE, and that candidate is submitted through the
 * EXISTING structured-observation ingress — the same one the World panel uses —
 * so it becomes this subject's own lived experience through the normal
 * Observation/Experience/Memory path.
 *
 * HARD LAWS (enforced by the callers, restated here so the boundary is unambiguous):
 *   - A provider is NOT an authority. Its output is a perception candidate only. It
 *     never writes canonical state: no Memory, no Experience, no Belief, no Affect,
 *     no Relationship, no Personality, no direct subject-state mutation.
 *   - NO IDENTITY INFERENCE: no face recognition, no biometric identification, and
 *     no claim that a visible person is any particular individual. A visible person
 *     may be described ("a person is visible"); binding it to an identity is a
 *     separate, future design that this slice deliberately does not attempt.
 *   - NO SENSITIVE-ATTRIBUTE INFERENCE: nothing infers race, religion, sexual
 *     orientation, health, political affiliation, criminality or personality.
 *   - NO VISUAL AFFECT: a perception never moves Affect. Whether an event affects
 *     the subject is decided by the existing Appraisal/event path, as for any other
 *     observation.
 *   - RAW FRAMES ARE NOT PERSISTED: image bytes live only inside the request that
 *     carries them; only the structured perception and its source metadata become
 *     durable, and only through the ingress ledger.
 *   - CAPTURE IS ON DEMAND: the product captures one frame per explicit user action.
 *     There is no continuous video loop and no interval mode in this slice.
 */

import { createHash } from "node:crypto";

export const PRODUCT_VISION_SCHEMA_VERSION = "product-vision-v0" as const;

/** Where a frame came from. One value per implemented capture surface. */
export type ProductVisionSourceTypeV0 = "CAMERA" | "SCREEN";

export const PRODUCT_VISION_IMPLEMENTED_SOURCES_V0: readonly ProductVisionSourceTypeV0[] = Object.freeze([
  "CAMERA"
]);

export const PRODUCT_VISION_MAX_IMAGE_BYTES_V0 = 8 * 1024 * 1024;
export const PRODUCT_VISION_MAX_SCENE_CHARS_V0 = 2000;
export const PRODUCT_VISION_MAX_OBJECTS_V0 = 8;
export const PRODUCT_VISION_MAX_VISIBLE_TEXT_V0 = 4;
export const PRODUCT_VISION_MAX_LABEL_CHARS_V0 = 120;

/**
 * The MINIMUM structured perception: one scene sentence, a few visible object
 * labels, optionally a few visible text snippets, and the provider's own
 * confidence. No ontology, no bounding boxes, no tracking, no embeddings.
 */
export interface ProductVisualPerceptionV0 {
  readonly schema_version: typeof PRODUCT_VISION_SCHEMA_VERSION;
  /** One factual sentence describing what is visible. */
  readonly scene: string;
  /** Short visible-object labels (never identities). */
  readonly objects: readonly string[];
  /** Visible text the provider could read, if any. */
  readonly visible_text: readonly string[];
  /** The provider's own confidence in [0, 1]. Never a truth claim. */
  readonly confidence: number;
}

export type ProductVisionResultV0 =
  | { readonly kind: "PERCEPTION"; readonly perception: ProductVisualPerceptionV0 }
  | {
      readonly kind: "FAILED";
      readonly code:
        | "VISION_UNAVAILABLE"
        | "VISION_TIMEOUT"
        | "VISION_FAILED"
        | "VISION_INVALID"
        | "IMAGE_TOO_LARGE"
        | "IMAGE_EMPTY";
      readonly detail: string;
    };

export interface VisualPerceptionPortV0 {
  readonly available: boolean;
  readonly source_types: readonly ProductVisionSourceTypeV0[];
  perceive(input: {
    readonly image: Uint8Array;
    readonly content_type: string;
    readonly source_type: ProductVisionSourceTypeV0;
  }): Promise<ProductVisionResultV0>;
}

/** The shipped default: vision is an optional capability, never a startup blocker. */
export function unavailableVisualPerceptionPortV0(): VisualPerceptionPortV0 {
  return Object.freeze({
    available: false,
    source_types: Object.freeze([]) as readonly ProductVisionSourceTypeV0[],
    perceive: async (): Promise<ProductVisionResultV0> => ({
      kind: "FAILED",
      code: "VISION_UNAVAILABLE",
      detail: "no visual perception adapter is configured (set CHARACTEROS_VISION_URL to enable camera perception)"
    })
  });
}

/** Deterministic capture identity: the SAME frame is the SAME event (ingress REPLAY). */
export function deriveVisionCaptureEventIdV0(image: Uint8Array): string {
  const digest = createHash("sha256").update(image).digest("hex");
  return `capture-${digest.slice(0, 16)}`;
}

function boundedLabel(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, PRODUCT_VISION_MAX_LABEL_CHARS_V0);
}

/**
 * Validates provider output into the closed perception shape. MALFORMED OUTPUT
 * FAILS CLOSED (VISION_INVALID): unknown fields are ignored, a missing or empty
 * scene is a failure, list entries are truncated to their bound, and a confidence
 * outside [0, 1] fails rather than being clamped (never repair meaning).
 */
export function validateVisualPerceptionV0(
  raw: unknown
): ProductVisionResultV0 {
  if (raw === null || typeof raw !== "object") {
    return { kind: "FAILED", code: "VISION_INVALID", detail: "provider returned no perception object" };
  }
  const record = raw as Record<string, unknown>;
  const scene = typeof record["scene"] === "string" ? record["scene"].trim() : "";
  if (scene.length === 0) {
    return { kind: "FAILED", code: "VISION_INVALID", detail: "provider returned no scene description" };
  }
  if ([...scene].length > PRODUCT_VISION_MAX_SCENE_CHARS_V0) {
    return { kind: "FAILED", code: "VISION_INVALID", detail: "scene description exceeds the product bound" };
  }
  const confidence = record["confidence"];
  if (confidence !== undefined && (typeof confidence !== "number" || !Number.isFinite(confidence) || confidence < 0 || confidence > 1)) {
    return { kind: "FAILED", code: "VISION_INVALID", detail: "confidence must be a number in [0, 1]" };
  }
  const listOf = (value: unknown, max: number): readonly string[] => {
    if (!Array.isArray(value)) return [];
    return value
      .map((entry) => boundedLabel(entry))
      .filter((entry): entry is string => entry !== null)
      .slice(0, max);
  };
  return {
    kind: "PERCEPTION",
    perception: Object.freeze({
      schema_version: PRODUCT_VISION_SCHEMA_VERSION,
      scene,
      objects: Object.freeze(listOf(record["objects"], PRODUCT_VISION_MAX_OBJECTS_V0)),
      visible_text: Object.freeze(listOf(record["visible_text"], PRODUCT_VISION_MAX_VISIBLE_TEXT_V0)),
      confidence: typeof confidence === "number" ? confidence : 0.5
    })
  };
}

export interface HttpVisionAdapterOptionsV0 {
  /** Base URL of the local vision service (plain HTTP, no vendor SDK). */
  readonly base_url: string;
  /** Optional bearer credential; sent as a header, never logged or persisted. */
  readonly token?: string | undefined;
  readonly timeout_ms?: number | undefined;
  readonly fetch_impl?: typeof fetch | undefined;
}

/**
 * Local/replaceable HTTP contract (documented, schema-checked, bounded):
 *   POST {base}/perceive { image_base64, content_type, source_type }
 *     → { scene, objects?: string[], visible_text?: string[], confidence?: number }
 * Camera capture only in this slice; SCREEN is declared but not implemented.
 */
export function createHttpVisionPortV0(options: HttpVisionAdapterOptionsV0): VisualPerceptionPortV0 {
  const timeoutMs = options.timeout_ms ?? 120_000;
  const doFetch = options.fetch_impl ?? fetch;
  return Object.freeze({
    available: true,
    source_types: PRODUCT_VISION_IMPLEMENTED_SOURCES_V0,
    perceive: async (input: {
      readonly image: Uint8Array;
      readonly content_type: string;
      readonly source_type: ProductVisionSourceTypeV0;
    }): Promise<ProductVisionResultV0> => {
      if (input.image.byteLength === 0) {
        return { kind: "FAILED", code: "IMAGE_EMPTY", detail: "empty image payload" };
      }
      if (input.image.byteLength > PRODUCT_VISION_MAX_IMAGE_BYTES_V0) {
        return { kind: "FAILED", code: "IMAGE_TOO_LARGE", detail: "image payload exceeds the product bound" };
      }
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), timeoutMs);
      let response: Response;
      try {
        response = await doFetch(`${options.base_url.replace(/\/$/, "")}/perceive`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(options.token === undefined ? {} : { authorization: `Bearer ${options.token}` })
          },
          body: JSON.stringify({
            image_base64: Buffer.from(input.image).toString("base64"),
            content_type: input.content_type,
            source_type: input.source_type
          }),
          signal: abort.signal
        });
      } catch (error) {
        const aborted = abort.signal.aborted;
        return {
          kind: "FAILED",
          code: aborted ? "VISION_TIMEOUT" : "VISION_FAILED",
          detail: aborted ? "vision service timed out" : (error as Error).message.slice(0, 200)
        };
      } finally {
        clearTimeout(timer);
      }
      if (!response.ok) {
        return { kind: "FAILED", code: "VISION_FAILED", detail: `vision service returned HTTP ${String(response.status)}` };
      }
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        return { kind: "FAILED", code: "VISION_INVALID", detail: "vision service returned a non-JSON body" };
      }
      return validateVisualPerceptionV0(body);
    }
  });
}

/**
 * The neutral entity ref every automated capture carries: the scene itself has no
 * identified entities, and this slice never invents one. An identified person or
 * object would require separate, lawful identity binding.
 */
export const PRODUCT_VISION_NEUTRAL_ENTITY_V0 = "visible-scene" as const;
