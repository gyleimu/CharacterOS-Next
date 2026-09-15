/**
 * VISUAL_PERCEPTION_PRODUCT_BRIDGE_V0 — the thinnest lawful connection between
 * the vision adapter and CharacterOS.
 *
 * "Vision → Observation → existing CharacterOS input boundary". This bridge does
 * NOT touch canonical code: it maps one `VisualObservationV0` (observed facts
 * only) onto the FROZEN `ExternalStructuredObservationRequestV0` ingress, which
 * owns identity, idempotency (FIRST/REPLAY/CONFLICT) and the lived-experience
 * path. No emotion, belief, memory, relationship, personality, desire or action
 * ever crosses here — the adapter cannot even express them.
 */

import type { VisualObservationV0, VisionObservationSinkV0, VisionSinkOutcomeV0 } from "@characteros-next/vision";
import type { ProductRuntimeV0 } from "./product-runtime.js";

/** Two distinct external source identities: camera and desktop never merge. */
export const VISION_SOURCE_REF_BY_KIND_V0 = {
  camera: "source:vision-camera",
  desktop: "source:vision-desktop"
} as const;

/**
 * Structural floor for the ingress, which requires at least one entity ref. It
 * is a bookkeeping identity for "nothing identifiable was observed", not a claim
 * about the world.
 */
export const VISION_FALLBACK_ENTITY_REF_V0 = "entity:observed-scene";

const MAX_SCENE_CHARS_V0 = 2000;
const ENTITY_TYPE_PATTERN = /[^A-Za-z0-9._~-]+/gu;

/** Maps a free-form observed entity type onto a lawful canonical identifier. */
export function visionEntityRefV0(type: string): string {
  const normalized = type
    .normalize("NFKD")
    .toLowerCase()
    .replace(ENTITY_TYPE_PATTERN, "-")
    .replace(/^[^a-z0-9]+/u, "")
    .replace(/[-._~]+$/u, "")
    .slice(0, 120);
  return `entity:${normalized.length === 0 ? "unidentified" : normalized}`;
}

/**
 * One bounded scene string. Description first, then the notable/uncertain
 * qualifiers the model reported, so the canonical observation keeps what the
 * adapter knew without inventing anything.
 */
export function visionSceneTextV0(observation: VisualObservationV0, maxChars = MAX_SCENE_CHARS_V0): string {
  const parts = [observation.description.trim()];
  const notable = observation.notable_events ?? [];
  if (notable.length > 0) parts.push(`Notable: ${notable.join("; ")}`);
  const uncertainty = observation.uncertainty ?? [];
  if (uncertainty.length > 0) parts.push(`Uncertain: ${uncertainty.join("; ")}`);
  const scene = parts.filter((part) => part.length > 0).join(" ");
  return scene.length <= maxChars ? scene : `${scene.slice(0, maxChars - 1).trimEnd()}…`;
}

/** Ordered, deduplicated entity refs; never empty. */
export function visionEntityRefsV0(observation: VisualObservationV0): readonly string[] {
  const refs = [...new Set((observation.entities ?? []).map((entity) => visionEntityRefV0(entity.type)))].sort();
  return refs.length === 0 ? [VISION_FALLBACK_ENTITY_REF_V0] : refs;
}

export function createProductVisionSinkV0(runtime: ProductRuntimeV0): VisionObservationSinkV0 {
  return {
    sink_id: "product-canonical-observation-ingress",
    async accept(observation: VisualObservationV0): Promise<VisionSinkOutcomeV0> {
      try {
        const outcome = await runtime.submitExternalObservation({
          source: VISION_SOURCE_REF_BY_KIND_V0[observation.source],
          // The observation id is already a deterministic content address, so a
          // retried submission is an idempotent REPLAY rather than a second life.
          event: `event:${observation.observation_id}`,
          entities: visionEntityRefsV0(observation).join(","),
          scene: visionSceneTextV0(observation)
          // `task` is deliberately omitted: the observed scene is not the
          // subject's task, and vision reports facts only.
        });
        if (outcome.kind === "CONFLICT") return { kind: "REJECTED", detail: outcome.detail };
        if (outcome.kind === "INVALID") return { kind: "REJECTED", detail: outcome.detail };
        return { kind: "ACCEPTED", detail: outcome.kind };
      } catch (error) {
        return {
          kind: "REJECTED",
          detail: error instanceof Error ? error.message : String(error)
        };
      }
    }
  };
}
