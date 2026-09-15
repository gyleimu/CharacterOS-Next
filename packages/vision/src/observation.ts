/**
 * Structured output: parse, validate, fail closed.
 *
 * A malformed model payload becomes `INVALID_MODEL_OUTPUT` — it is dropped and
 * logged. It is NEVER degraded into free-form text, partially accepted, or
 * forwarded to CharacterOS. Bounded truncation (with an explicit marker) is the
 * only permitted transformation, so an over-long but well-formed answer still
 * yields a lawful observation.
 */

import { createHash } from "node:crypto";
import {
  VISUAL_OBSERVATION_SCHEMA_VERSION,
  type VisualEntityV0,
  type VisualObservationV0,
  type VisionSourceKindV0
} from "./types.js";

export interface ObservationLimitsV0 {
  readonly max_description_chars: number;
  readonly max_list_items: number;
  readonly max_item_chars: number;
  readonly max_entities: number;
}

export const DEFAULT_OBSERVATION_LIMITS_V0: ObservationLimitsV0 = {
  max_description_chars: 2000,
  max_list_items: 12,
  max_item_chars: 200,
  max_entities: 8
};

export interface ModelObservationV0 {
  readonly description: string;
  readonly confidence: number | null;
  readonly entities: readonly VisualEntityV0[];
  readonly activities: readonly string[];
  readonly visible_text: readonly string[];
  readonly notable_events: readonly string[];
  readonly uncertainty: readonly string[];
  readonly application: string | null;
  readonly truncated: boolean;
}

export type ModelObservationParseResultV0 =
  | { readonly kind: "OK"; readonly observation: ModelObservationV0 }
  | { readonly kind: "INVALID"; readonly detail: string };

type FieldResult<T> = { readonly ok: true; readonly value: T; readonly truncated: boolean } | { readonly ok: false; readonly detail: string };

function truncateTextV0(value: string, max: number): { value: string; truncated: boolean } {
  if (value.length <= max) return { value, truncated: false };
  const cut = value.slice(0, max);
  const boundary = cut.search(/\s\S*$/u);
  const head = boundary > max * 0.6 ? cut.slice(0, boundary) : cut;
  return { value: `${head.trimEnd()}…`, truncated: true };
}

function readStringListV0(value: unknown, field: string, limits: ObservationLimitsV0): FieldResult<readonly string[]> {
  if (value === undefined || value === null) return { ok: true, value: [], truncated: false };
  if (!Array.isArray(value)) return { ok: false, detail: `${field} must be an array or null` };
  let truncated = false;
  const items: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") return { ok: false, detail: `${field} entries must be strings` };
    const trimmed = entry.trim();
    if (trimmed.length === 0) continue;
    const bounded = truncateTextV0(trimmed, limits.max_item_chars);
    truncated = truncated || bounded.truncated;
    items.push(bounded.value);
    if (items.length >= limits.max_list_items) {
      truncated = truncated || items.length < value.length;
      break;
    }
  }
  return { ok: true, value: items, truncated };
}

function readConfidenceV0(value: unknown, field: string): FieldResult<number | null> {
  if (value === undefined || value === null) return { ok: true, value: null, truncated: false };
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    return { ok: false, detail: `${field} must be a number in [0,1] or null` };
  }
  return { ok: true, value, truncated: false };
}

function readEntitiesV0(value: unknown, limits: ObservationLimitsV0): FieldResult<readonly VisualEntityV0[]> {
  if (value === undefined || value === null) return { ok: true, value: [], truncated: false };
  if (!Array.isArray(value)) return { ok: false, detail: "entities must be an array or null" };
  let truncated = false;
  const entities: VisualEntityV0[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      return { ok: false, detail: "entities entries must be objects" };
    }
    const record = entry as Record<string, unknown>;
    const type = record["type"];
    const description = record["description"];
    if (typeof type !== "string" || type.trim().length === 0) {
      return { ok: false, detail: "entities entries require a non-empty string type" };
    }
    if (typeof description !== "string" || description.trim().length === 0) {
      return { ok: false, detail: "entities entries require a non-empty string description" };
    }
    const confidence = readConfidenceV0(record["confidence"], "entities[].confidence");
    if (!confidence.ok) return confidence;
    const boundedType = truncateTextV0(type.trim(), limits.max_item_chars);
    const boundedDescription = truncateTextV0(description.trim(), limits.max_item_chars);
    truncated = truncated || boundedType.truncated || boundedDescription.truncated;
    entities.push(
      confidence.value === null
        ? { type: boundedType.value, description: boundedDescription.value }
        : { type: boundedType.value, description: boundedDescription.value, confidence: confidence.value }
    );
    if (entities.length >= limits.max_entities) {
      truncated = truncated || entities.length < value.length;
      break;
    }
  }
  return { ok: true, value: entities, truncated };
}

function readOptionalTextV0(value: unknown, field: string, limits: ObservationLimitsV0): FieldResult<string | null> {
  if (value === undefined || value === null) return { ok: true, value: null, truncated: false };
  if (typeof value !== "string") return { ok: false, detail: `${field} must be a string or null` };
  const trimmed = value.trim();
  if (trimmed.length === 0) return { ok: true, value: null, truncated: false };
  const bounded = truncateTextV0(trimmed, limits.max_item_chars);
  return { ok: true, value: bounded.value, truncated: bounded.truncated };
}

/**
 * Parses one raw model answer. Anything that is not a JSON object carrying a
 * non-empty `description` and well-typed optional fields is INVALID.
 */
export function parseModelObservationV0(
  text: string,
  limits: ObservationLimitsV0 = DEFAULT_OBSERVATION_LIMITS_V0
): ModelObservationParseResultV0 {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { kind: "INVALID", detail: "model output is not valid JSON" };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { kind: "INVALID", detail: "model output must be a JSON object" };
  }
  const record = parsed as Record<string, unknown>;
  const rawDescription = record["description"];
  if (typeof rawDescription !== "string" || rawDescription.trim().length === 0) {
    return { kind: "INVALID", detail: "description must be a non-empty string" };
  }
  const description = truncateTextV0(rawDescription.trim(), limits.max_description_chars);
  const confidence = readConfidenceV0(record["confidence"], "confidence");
  if (!confidence.ok) return { kind: "INVALID", detail: confidence.detail };
  const entities = readEntitiesV0(record["entities"], limits);
  if (!entities.ok) return { kind: "INVALID", detail: entities.detail };
  const activities = readStringListV0(record["activities"], "activities", limits);
  if (!activities.ok) return { kind: "INVALID", detail: activities.detail };
  const visibleText = readStringListV0(record["visible_text"], "visible_text", limits);
  if (!visibleText.ok) return { kind: "INVALID", detail: visibleText.detail };
  const notableEvents = readStringListV0(record["notable_events"], "notable_events", limits);
  if (!notableEvents.ok) return { kind: "INVALID", detail: notableEvents.detail };
  const uncertainty = readStringListV0(record["uncertainty"], "uncertainty", limits);
  if (!uncertainty.ok) return { kind: "INVALID", detail: uncertainty.detail };
  const application = readOptionalTextV0(record["application"], "application", limits);
  if (!application.ok) return { kind: "INVALID", detail: application.detail };

  return {
    kind: "OK",
    observation: {
      description: description.value,
      confidence: confidence.value,
      entities: entities.value,
      activities: activities.value,
      visible_text: visibleText.value,
      notable_events: notableEvents.value,
      uncertainty: uncertainty.value,
      application: application.value,
      truncated:
        description.truncated ||
        entities.truncated ||
        activities.truncated ||
        visibleText.truncated ||
        notableEvents.truncated ||
        uncertainty.truncated ||
        application.truncated
    }
  };
}

function canonicalJsonV0(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJsonV0).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => entry !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJsonV0(entry)}`).join(",")}}`;
}

function sha256HexV0(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Deterministic per-still identity: same still + same second ⇒ same observation. */
export async function buildVisualObservationV0(params: {
  readonly source: VisionSourceKindV0;
  readonly observation: ModelObservationV0;
  readonly captured_at_ms: number;
  readonly frame_jpeg: Buffer;
  readonly clock: (at_ms: number) => string;
}): Promise<VisualObservationV0> {
  const content = {
    source: params.source,
    description: params.observation.description,
    entities: params.observation.entities,
    activities: params.observation.activities,
    visible_text: params.observation.visible_text,
    notable_events: params.observation.notable_events,
    uncertainty: params.observation.uncertainty,
    application: params.observation.application,
    confidence: params.observation.confidence
  };
  const observationId = `vo-${sha256HexV0(`${params.source}\u0000${params.captured_at_ms}\u0000${canonicalJsonV0(content)}`).slice(0, 32)}`;
  const base = {
    schema_version: VISUAL_OBSERVATION_SCHEMA_VERSION,
    observation_id: observationId,
    timestamp: params.clock(params.captured_at_ms),
    source: params.source,
    description: params.observation.description,
    frame_ref: `sha256:${sha256HexV0(params.frame_jpeg)}`
  } as const;
  return {
    ...base,
    ...(params.observation.confidence === null ? {} : { confidence: params.observation.confidence }),
    ...(params.observation.entities.length === 0 ? {} : { entities: params.observation.entities }),
    ...(params.observation.activities.length === 0 ? {} : { activities: params.observation.activities }),
    ...(params.observation.visible_text.length === 0 ? {} : { visible_text: params.observation.visible_text }),
    ...(params.observation.notable_events.length === 0 ? {} : { notable_events: params.observation.notable_events }),
    ...(params.observation.uncertainty.length === 0 ? {} : { uncertainty: params.observation.uncertainty }),
    ...(params.observation.application === null ? {} : { application: params.observation.application })
  };
}
