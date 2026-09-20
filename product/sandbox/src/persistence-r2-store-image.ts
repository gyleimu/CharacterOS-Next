/**
 * PERSISTENCE_R2_SCALABILITY_V0 — lossless physical encoding for the product
 * SessionStoreImageV0 file boundary.
 *
 * The runtime and SubjectCore continue to see the exact historical
 * `subject-session-store-image-v0` value.  Only the JSON-on-disk representation
 * changes:
 *
 *   - the first bundle keeps its complete `next_snapshot`;
 *   - later bundles keep a deterministic, reversible JSON delta from the
 *     preceding snapshot;
 *   - `bundle.trace_window`, which the canonical validator requires to be
 *     byte-value-identical to `bundle.next_snapshot.trace_window`, is represented
 *     by that already encoded snapshot value instead of a second physical copy.
 *
 * Decoding reconstructs complete legacy bundles before any existing restore,
 * checksum, hash, or authority validation runs.  Corrupt/unknown encodings throw
 * and therefore preserve the product's fail-closed restore law.
 */

import type { SessionStoreImageV0 } from "@characteros-next/runtime";

export const SESSION_STORE_IMAGE_R2_SCHEMA_VERSION =
  "subject-session-store-image-r2-v0" as const;

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

type JsonDeltaR2V0 =
  | { readonly op: "replace"; readonly value: JsonValue }
  | {
      readonly op: "object";
      readonly remove: readonly string[];
      readonly change: Readonly<Record<string, JsonDeltaR2V0>>;
    }
  | {
      readonly op: "array-splice";
      readonly prefix: number;
      readonly delete_count: number;
      readonly items: readonly JsonValue[];
    }
  | {
      readonly op: "array-window";
      readonly drop_prefix: number;
      readonly keep: number;
      readonly append: readonly JsonValue[];
    };

interface EncodedBundleR2V0 {
  readonly fields: Readonly<Record<string, JsonValue>>;
  readonly next_snapshot:
    | { readonly kind: "FULL"; readonly value: JsonValue }
    | { readonly kind: "DELTA"; readonly delta: JsonDeltaR2V0 };
}

export interface SessionStoreImageR2V0 {
  readonly schema_version: typeof SESSION_STORE_IMAGE_R2_SCHEMA_VERSION;
  readonly revisions: SessionStoreImageV0["revisions"];
  readonly committed_bundles: readonly EncodedBundleR2V0[];
}

// One product save writes the same freshly captured store first to the shared
// canonical document and then to the human sidecar.  The image is readonly and
// identity-stable for that operation, so a weak cache avoids encoding the 1909
// bundle chain twice without retaining it after the save graph is collected.
const encodedImageCache = new WeakMap<object, SessionStoreImageR2V0>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function serializedBytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

function asJsonValue(value: unknown, detail: string): JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map((item, index) => asJsonValue(item, `${detail}[${String(index)}]`));
  if (isRecord(value)) {
    const result: Record<string, JsonValue> = {};
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined) throw new Error(`persistence R2: ${detail}.${key} is undefined`);
      result[key] = asJsonValue(item, `${detail}.${key}`);
    }
    return result;
  }
  throw new Error(`persistence R2: ${detail} is not a finite JSON value`);
}

function shortest(candidates: readonly JsonDeltaR2V0[]): JsonDeltaR2V0 {
  let selected = candidates[0] as JsonDeltaR2V0;
  let selectedBytes = serializedBytes(selected);
  for (const candidate of candidates.slice(1)) {
    const bytes = serializedBytes(candidate);
    if (bytes < selectedBytes) {
      selected = candidate;
      selectedBytes = bytes;
    }
  }
  return selected;
}

function arrayDelta(previous: readonly JsonValue[], next: readonly JsonValue[]): JsonDeltaR2V0 {
  const replace: JsonDeltaR2V0 = { op: "replace", value: [...next] };

  let prefix = 0;
  while (prefix < previous.length && prefix < next.length && sameJson(previous[prefix], next[prefix])) prefix++;
  let suffix = 0;
  while (
    suffix < previous.length - prefix &&
    suffix < next.length - prefix &&
    sameJson(previous[previous.length - 1 - suffix], next[next.length - 1 - suffix])
  ) {
    suffix++;
  }
  const splice: JsonDeltaR2V0 = {
    op: "array-splice",
    prefix,
    delete_count: previous.length - prefix - suffix,
    items: next.slice(prefix, next.length - suffix)
  };

  // A bounded trace window advances as [a,b,c] -> [b,c,d].  A normal
  // prefix/suffix splice cannot express that cheaply, so explicitly encode the
  // retained suffix / next prefix overlap.  Equality is exact JSON equality.
  const previousItems = previous.map((item) => JSON.stringify(item));
  const nextItems = next.map((item) => JSON.stringify(item));
  let bestWindow: JsonDeltaR2V0 | null = null;
  if (nextItems.length === 0) {
    bestWindow = { op: "array-window", drop_prefix: previous.length, keep: 0, append: [] };
  } else {
    for (let drop = 0; drop < previousItems.length; drop++) {
      if (previousItems[drop] !== nextItems[0]) continue;
      const maximum = Math.min(previousItems.length - drop, nextItems.length);
      let keep = 0;
      while (keep < maximum && previousItems[drop + keep] === nextItems[keep]) keep++;
      if (keep === 0) continue;
      const candidate: JsonDeltaR2V0 = {
        op: "array-window",
        drop_prefix: drop,
        keep,
        append: next.slice(keep)
      };
      if (bestWindow === null || serializedBytes(candidate) < serializedBytes(bestWindow)) {
        bestWindow = candidate;
      }
    }
  }
  return shortest(bestWindow === null ? [replace, splice] : [replace, splice, bestWindow]);
}

function encodeDelta(previous: JsonValue, next: JsonValue): JsonDeltaR2V0 | null {
  if (sameJson(previous, next)) return null;
  const replace: JsonDeltaR2V0 = { op: "replace", value: next };
  if (Array.isArray(previous) && Array.isArray(next)) return arrayDelta(previous, next);
  if (isRecord(previous) && isRecord(next)) {
    const remove = Object.keys(previous).filter((key) => !(key in next));
    const change: Record<string, JsonDeltaR2V0> = {};
    for (const [key, nextValue] of Object.entries(next)) {
      const prior = previous[key];
      if (prior === undefined) {
        change[key] = { op: "replace", value: nextValue as JsonValue };
        continue;
      }
      const delta = encodeDelta(prior as JsonValue, nextValue as JsonValue);
      if (delta !== null) change[key] = delta;
    }
    return shortest([{ op: "object", remove, change }, replace]);
  }
  return replace;
}

function integer(value: unknown, detail: string): number {
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new Error(`persistence R2: ${detail} must be a non-negative integer`);
  }
  return value as number;
}

function applyDelta(previous: JsonValue, value: unknown, detail: string): JsonValue {
  if (!isRecord(value) || typeof value["op"] !== "string") {
    throw new Error(`persistence R2: ${detail} is not a delta object`);
  }
  const op = value["op"];
  if (op === "replace") {
    const keys = Object.keys(value);
    if (keys.length !== 2 || !("value" in value)) throw new Error(`persistence R2: ${detail} replace shape invalid`);
    return asJsonValue(value["value"], `${detail}.value`);
  }
  if (op === "object") {
    if (!isRecord(previous)) throw new Error(`persistence R2: ${detail} object delta has non-object base`);
    const keys = Object.keys(value).sort();
    if (JSON.stringify(keys) !== JSON.stringify(["change", "op", "remove"])) {
      throw new Error(`persistence R2: ${detail} object delta shape invalid`);
    }
    if (!Array.isArray(value["remove"]) || !isRecord(value["change"])) {
      throw new Error(`persistence R2: ${detail} object delta members invalid`);
    }
    const removal = new Set<string>();
    for (const key of value["remove"]) {
      if (typeof key !== "string" || !(key in previous)) {
        throw new Error(`persistence R2: ${detail} removes an unknown key`);
      }
      removal.add(key);
    }
    const result: Record<string, JsonValue> = {};
    for (const [key, item] of Object.entries(previous)) {
      if (!removal.has(key)) result[key] = item as JsonValue;
    }
    for (const [key, delta] of Object.entries(value["change"])) {
      if (!(key in result)) {
        const replacement = applyDelta(null, delta, `${detail}.change.${key}`);
        result[key] = replacement;
      } else {
        result[key] = applyDelta(result[key] as JsonValue, delta, `${detail}.change.${key}`);
      }
    }
    return result;
  }
  if (op === "array-splice") {
    if (!Array.isArray(previous)) throw new Error(`persistence R2: ${detail} splice has non-array base`);
    const keys = Object.keys(value).sort();
    if (JSON.stringify(keys) !== JSON.stringify(["delete_count", "items", "op", "prefix"])) {
      throw new Error(`persistence R2: ${detail} splice shape invalid`);
    }
    const prefix = integer(value["prefix"], `${detail}.prefix`);
    const deleteCount = integer(value["delete_count"], `${detail}.delete_count`);
    if (!Array.isArray(value["items"]) || prefix > previous.length || prefix + deleteCount > previous.length) {
      throw new Error(`persistence R2: ${detail} splice bounds invalid`);
    }
    const items = value["items"].map((item, index) => asJsonValue(item, `${detail}.items[${String(index)}]`));
    return [...previous.slice(0, prefix), ...items, ...previous.slice(prefix + deleteCount)];
  }
  if (op === "array-window") {
    if (!Array.isArray(previous)) throw new Error(`persistence R2: ${detail} window has non-array base`);
    const keys = Object.keys(value).sort();
    if (JSON.stringify(keys) !== JSON.stringify(["append", "drop_prefix", "keep", "op"])) {
      throw new Error(`persistence R2: ${detail} window shape invalid`);
    }
    const drop = integer(value["drop_prefix"], `${detail}.drop_prefix`);
    const keep = integer(value["keep"], `${detail}.keep`);
    if (!Array.isArray(value["append"]) || drop + keep > previous.length) {
      throw new Error(`persistence R2: ${detail} window bounds invalid`);
    }
    const append = value["append"].map((item, index) => asJsonValue(item, `${detail}.append[${String(index)}]`));
    return [...previous.slice(drop, drop + keep), ...append];
  }
  throw new Error(`persistence R2: ${detail} has unknown op ${String(op)}`);
}

function rebuildBundle(fields: Record<string, JsonValue>, nextSnapshot: JsonValue): Record<string, JsonValue> {
  if (!isRecord(nextSnapshot) || !isRecord(nextSnapshot["trace_window"])) {
    throw new Error("persistence R2: decoded next_snapshot has no trace_window");
  }
  const result: Record<string, JsonValue> = {};
  let insertedSnapshot = false;
  let insertedTraceWindow = false;
  for (const [key, value] of Object.entries(fields)) {
    if (key === "logical_time_before") {
      result["next_snapshot"] = nextSnapshot;
      insertedSnapshot = true;
    }
    if (key === "mutation_history_link") {
      result["trace_window"] = nextSnapshot["trace_window"] as JsonValue;
      insertedTraceWindow = true;
    }
    result[key] = value;
  }
  if (!insertedSnapshot || !insertedTraceWindow) {
    throw new Error("persistence R2: compact bundle field anchors are missing");
  }
  return result;
}

/** Converts a complete runtime image into the thin R2 file representation. */
export function encodeSessionStoreImageR2V0(image: SessionStoreImageV0): SessionStoreImageR2V0 {
  if (image.schema_version !== "subject-session-store-image-v0") {
    throw new Error("persistence R2: only subject-session-store-image-v0 can be encoded");
  }
  const cached = encodedImageCache.get(image as object);
  if (cached !== undefined) return cached;
  let previousSnapshot: JsonValue | null = null;
  const committedBundles = image.committed_bundles.map((unknownBundle, index): EncodedBundleR2V0 => {
    if (!isRecord(unknownBundle)) throw new Error(`persistence R2: bundle ${String(index)} is not an object`);
    const nextSnapshot = asJsonValue(unknownBundle["next_snapshot"], `bundle ${String(index)}.next_snapshot`);
    if (!isRecord(nextSnapshot) || !sameJson(unknownBundle["trace_window"], nextSnapshot["trace_window"])) {
      throw new Error(`persistence R2: bundle ${String(index)} trace_window is not identical to next_snapshot.trace_window`);
    }
    const fields: Record<string, JsonValue> = {};
    for (const [key, value] of Object.entries(unknownBundle)) {
      if (key === "next_snapshot" || key === "trace_window") continue;
      fields[key] = asJsonValue(value, `bundle ${String(index)}.${key}`);
    }
    const encodedSnapshot =
      previousSnapshot === null
        ? ({ kind: "FULL", value: nextSnapshot } as const)
        : ({
            kind: "DELTA",
            delta: encodeDelta(previousSnapshot, nextSnapshot) ?? {
              op: "object",
              remove: [],
              change: {}
            }
          } as const);
    previousSnapshot = nextSnapshot;
    return { fields, next_snapshot: encodedSnapshot };
  });
  const encoded: SessionStoreImageR2V0 = {
    schema_version: SESSION_STORE_IMAGE_R2_SCHEMA_VERSION,
    revisions: image.revisions,
    committed_bundles: committedBundles
  };
  encodedImageCache.set(image as object, encoded);
  return encoded;
}

/** Reads either an old complete image or the new thin representation. */
export function decodeSessionStoreImageAnyV0(value: unknown): SessionStoreImageV0 {
  if (!isRecord(value)) throw new Error("persistence R2: store image must be an object");
  if (value["schema_version"] === "subject-session-store-image-v0") {
    return value as unknown as SessionStoreImageV0;
  }
  if (value["schema_version"] !== SESSION_STORE_IMAGE_R2_SCHEMA_VERSION) {
    throw new Error(`persistence R2: unsupported store image schema ${String(value["schema_version"])}`);
  }
  if (!Array.isArray(value["revisions"]) || !Array.isArray(value["committed_bundles"])) {
    throw new Error("persistence R2: compact store arrays are missing");
  }
  let previousSnapshot: JsonValue | null = null;
  const bundles = value["committed_bundles"].map((unknownEncoded, index) => {
    if (!isRecord(unknownEncoded) || !isRecord(unknownEncoded["fields"]) || !isRecord(unknownEncoded["next_snapshot"])) {
      throw new Error(`persistence R2: compact bundle ${String(index)} shape invalid`);
    }
    const keys = Object.keys(unknownEncoded).sort();
    if (JSON.stringify(keys) !== JSON.stringify(["fields", "next_snapshot"])) {
      throw new Error(`persistence R2: compact bundle ${String(index)} has unknown fields`);
    }
    const snapshotEncoding = unknownEncoded["next_snapshot"];
    let nextSnapshot: JsonValue;
    if (snapshotEncoding["kind"] === "FULL") {
      if (index !== 0 || Object.keys(snapshotEncoding).length !== 2 || !("value" in snapshotEncoding)) {
        throw new Error(`persistence R2: compact bundle ${String(index)} FULL encoding invalid`);
      }
      nextSnapshot = asJsonValue(snapshotEncoding["value"], `compact bundle ${String(index)}.next_snapshot.value`);
    } else if (snapshotEncoding["kind"] === "DELTA") {
      if (previousSnapshot === null || Object.keys(snapshotEncoding).length !== 2 || !("delta" in snapshotEncoding)) {
        throw new Error(`persistence R2: compact bundle ${String(index)} DELTA encoding invalid`);
      }
      nextSnapshot = applyDelta(previousSnapshot, snapshotEncoding["delta"], `compact bundle ${String(index)}.delta`);
    } else {
      throw new Error(`persistence R2: compact bundle ${String(index)} snapshot encoding kind invalid`);
    }
    previousSnapshot = nextSnapshot;
    const fields: Record<string, JsonValue> = {};
    for (const [key, field] of Object.entries(unknownEncoded["fields"])) {
      if (key === "next_snapshot" || key === "trace_window") {
        throw new Error(`persistence R2: compact bundle ${String(index)} illegally embeds ${key}`);
      }
      fields[key] = asJsonValue(field, `compact bundle ${String(index)}.fields.${key}`);
    }
    return rebuildBundle(fields, nextSnapshot);
  });
  return {
    schema_version: "subject-session-store-image-v0",
    revisions: value["revisions"] as unknown as SessionStoreImageV0["revisions"],
    committed_bundles: bundles
  };
}

/** True only for the self-contained R2 file representation. */
export function isSessionStoreImageR2V0(value: unknown): value is SessionStoreImageR2V0 {
  return isRecord(value) && value["schema_version"] === SESSION_STORE_IMAGE_R2_SCHEMA_VERSION;
}
