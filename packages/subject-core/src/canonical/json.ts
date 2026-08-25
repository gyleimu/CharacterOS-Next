/**
 * P2.1.3 — canonical-json-v1 serializer (RFC 8785 JCS over the I-JSON subset).
 * Source: docs/implementation/p2-1-contract-freeze.md §8.1–§8.2.
 *
 * Pure deterministic function: value -> canonical JSON text (UTF-8, no BOM, no
 * whitespace). Object member names are recursively sorted by raw UTF-16 code units;
 * arrays preserve admitted order; numbers use the ECMAScript shortest round-trip form
 * (`-0` serializes as `0`); strings use ECMAScript JSON escaping with literal UTF-8.
 * Duplicate keys cannot exist in JS objects; `undefined`, NaN/±Infinity, symbols,
 * functions and bigint fail closed instead of being coerced or dropped.
 *
 * Serialization happens only AFTER schema admission (§8.1): this module never repairs.
 */

export class NonCanonicalValueError extends Error {
  readonly path: string;
  constructor(path: string, reason: string) {
    super(`non-canonical value at ${path}: ${reason}`);
    this.name = "NonCanonicalValueError";
    this.path = path;
  }
}

function serializeString(s: string, path: string): string {
  // JCS string serialisation is exactly ECMAScript JSON.stringify for strings;
  // lone surrogates would produce invalid UTF-8 and are rejected first (§8.2 rule 4).
  if (!s.isWellFormed()) {
    throw new NonCanonicalValueError(path, "lone surrogate");
  }
  return JSON.stringify(s);
}

function serializeNumber(n: number, path: string): string {
  if (!Number.isFinite(n)) {
    throw new NonCanonicalValueError(path, "NaN or Infinity");
  }
  // ECMAScript Number::toString shortest round-trip; -0 becomes "0" (§8.2 rule 6).
  return JSON.stringify(n);
}

function compareKeys(a: string, b: string): number {
  // Raw UTF-16 code-unit ascending order (JCS §3.2.3); never locale-aware.
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function serialize(value: unknown, path: string, out: string[]): void {
  switch (typeof value) {
    case "boolean":
      out.push(value ? "true" : "false");
      return;
    case "number":
      out.push(serializeNumber(value, path));
      return;
    case "string":
      out.push(serializeString(value, path));
      return;
    case "object": {
      if (value === null) {
        out.push("null");
        return;
      }
      if (Array.isArray(value)) {
        out.push("[");
        for (let i = 0; i < value.length; i++) {
          if (i > 0) out.push(",");
          serialize(value[i], `${path}[${i}]`, out);
        }
        out.push("]");
        return;
      }
      const proto = Object.getPrototypeOf(value) as object | null;
      if (proto !== Object.prototype && proto !== null) {
        throw new NonCanonicalValueError(path, "exotic object");
      }
      const record = value as Record<string, unknown>;
      const keys = Object.keys(record).sort(compareKeys);
      out.push("{");
      for (let i = 0; i < keys.length; i++) {
        if (i > 0) out.push(",");
        const key = keys[i] as string;
        const child = record[key];
        if (child === undefined) {
          throw new NonCanonicalValueError(`${path}.${key}`, "undefined member");
        }
        out.push(serializeString(key, `${path}.${key}__key`));
        out.push(":");
        serialize(child, `${path}.${key}`, out);
      }
      out.push("}");
      return;
    }
    default:
      // undefined, function, symbol, bigint — none exists in I-JSON.
      throw new NonCanonicalValueError(path, `unsupported typeof ${typeof value}`);
  }
}

/** Serializes an admitted value to its canonical-json-v1 text form. */
export function canonicalJsonString(value: unknown): string {
  const out: string[] = [];
  serialize(value, "$", out);
  return out.join("");
}
