/**
 * CHARACTEROS_VISUAL_PRODUCT_WORLD_AND_DIAGNOSTICS_DRAWER_V0 — shared product
 * structured-observation request builder.
 *
 * ONE normalization path for every product surface (CLI `/observe` and the local
 * web product's World panel): bare names gain the existing canonical ref prefixes
 * (`source:` / `event:` / `entity:`); an explicitly prefixed ref is passed
 * through unchanged. The frozen ingress validator remains the ONLY authority for
 * what is lawful — this module never bypasses or relaxes it.
 */

import type { ExternalStructuredObservationRequestV0 } from "./external-observation-ingress.js";

export interface ProductObservationFieldsV0 {
  readonly source?: string | undefined;
  readonly event?: string | undefined;
  readonly entities?: string | undefined;
  readonly scene?: string | undefined;
  readonly task?: string | undefined;
  readonly focus?: string | undefined;
  readonly environment?: string | undefined;
}

export type ProductObservationRequestResultV0 =
  | { readonly ok: true; readonly request: ExternalStructuredObservationRequestV0 }
  | { readonly ok: false; readonly detail: string };

function normalizeRefV0(value: string, prefix: string): string {
  return value.includes(":") ? value : `${prefix}:${value}`;
}

function refListV0(value: string, prefix: string): readonly string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => normalizeRefV0(entry, prefix));
}

/** Builds the EXISTING structured observation request from product form fields. */
export function buildStructuredObservationRequestV0(
  fields: ProductObservationFieldsV0
): ProductObservationRequestResultV0 {
  const source = fields.source;
  const event = fields.event;
  const scene = fields.scene;
  const entities = fields.entities;
  if (source === undefined || source.trim().length === 0) return { ok: false, detail: "missing source" };
  if (event === undefined || event.trim().length === 0) return { ok: false, detail: "missing event" };
  if (scene === undefined || scene.length === 0) return { ok: false, detail: "missing scene text" };
  if (entities === undefined) return { ok: false, detail: "missing entities" };
  const entityRefs = refListV0(entities, "entity");
  if (entityRefs.length === 0) return { ok: false, detail: "entities must name at least one entity" };
  const task = fields.task;
  const focus = fields.focus;
  const environment = fields.environment;
  return {
    ok: true,
    request: {
      source_ref: normalizeRefV0(source, "source"),
      event_ref: normalizeRefV0(event, "event"),
      entity_refs: entityRefs,
      scene,
      task: task === undefined || task.length === 0 ? null : task,
      ...(focus === undefined || focus.length === 0 ? {} : { focus_refs: refListV0(focus, "entity") }),
      ...(environment === undefined || environment.length === 0
        ? {}
        : { environment_refs: refListV0(environment, "environment") })
    }
  };
}
