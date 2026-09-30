/**
 * MINIMAL JSON-SCHEMA EVALUATOR for the keyword subset these probes use.
 *
 * WHY THIS EXISTS: the first feasibility probe set contained a schema that did NOT actually forbid
 * the targeted combination, so its "IGNORED" reading was an artefact of the instrument, not a fact
 * about the provider. A probe whose constraint does not constrain proves nothing. This evaluator
 * lets every candidate schema be checked LOCALLY, at 0 provider calls, before it is ever sent.
 *
 * Supported subset: type, const, enum, required, properties, additionalProperties:false,
 * oneOf, anyOf, if/then, maxLength.
 */

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export interface SchemaV0 {
  readonly [key: string]: unknown;
}

function matchesSchema(instance: unknown, schema: SchemaV0): boolean {
  if (schema["const"] !== undefined) return instance === schema["const"];
  if (Array.isArray(schema["enum"])) return (schema["enum"] as unknown[]).includes(instance);

  if (schema["type"] !== undefined) {
    const type = schema["type"] as string;
    const ok =
      (type === "object" && typeof instance === "object" && instance !== null && !Array.isArray(instance)) ||
      (type === "string" && typeof instance === "string") ||
      (type === "integer" && typeof instance === "number" && Number.isInteger(instance)) ||
      (type === "number" && typeof instance === "number") ||
      (type === "boolean" && typeof instance === "boolean") ||
      (type === "null" && instance === null);
    if (!ok) return false;
  }

  if (typeof schema["maxLength"] === "number" && typeof instance === "string") {
    if (instance.length > (schema["maxLength"] as number)) return false;
  }

  if (Array.isArray(schema["oneOf"])) {
    const branches = schema["oneOf"] as SchemaV0[];
    if (branches.filter((branch) => matchesSchema(instance, branch)).length !== 1) return false;
  }
  if (Array.isArray(schema["anyOf"])) {
    const branches = schema["anyOf"] as SchemaV0[];
    if (!branches.some((branch) => matchesSchema(instance, branch))) return false;
  }

  // if/then is evaluated BEFORE the object keywords so a failing `then` rejects the instance.
  if (schema["if"] !== undefined) {
    const condition = schema["if"] as SchemaV0;
    if (matchesSchema(instance, condition)) {
      if (schema["then"] !== undefined && !matchesSchema(instance, schema["then"] as SchemaV0)) return false;
    } else if (schema["else"] !== undefined && !matchesSchema(instance, schema["else"] as SchemaV0)) {
      return false;
    }
  }

  const isObject = typeof instance === "object" && instance !== null && !Array.isArray(instance);
  if (isObject) {
    const record = instance as Record<string, unknown>;
    if (Array.isArray(schema["required"])) {
      for (const key of schema["required"] as string[]) if (!(key in record)) return false;
    }
    const properties = (schema["properties"] ?? {}) as Record<string, SchemaV0>;
    for (const [key, sub] of Object.entries(properties)) {
      if (key in record && !matchesSchema(record[key], sub)) return false;
    }
    if (schema["additionalProperties"] === false) {
      for (const key of Object.keys(record)) if (!(key in properties)) return false;
    }
  }
  return true;
}

/** True when `instance` satisfies every keyword `schema` states. */
export function accepts(schema: SchemaV0, instance: unknown): boolean {
  return matchesSchema(instance, schema);
}
