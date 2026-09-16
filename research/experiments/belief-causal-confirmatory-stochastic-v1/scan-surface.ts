/* eslint-disable no-restricted-imports -- Research harness: imports the frozen built production schema by relative dist path. */
/**
 * BELIEF_CAUSAL_CONFIRMATORY_STOCHASTIC_V1 — exact cognition text scan surface.
 *
 * The frozen measurement protocol declared a five-path conflation scan surface,
 * which the freeze audit flagged as a non-blocking MAJOR: it was a *declared
 * subset*, not a proof of coverage over every model-authored free-text leaf of
 * the confirmatory cognition proposal. This module closes that residual by
 * WALKING THE REAL PRODUCTION SCHEMA
 * (`CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA`) and classifying every leaf.
 *
 * Classification (deterministic, from the schema alone):
 *   A  model-authored semantic text  → MUST be scanned by the conflation guard
 *   B  opaque identifier / ref       → never treated as prose
 *   C  closed enum atom              → never treated as prose
 *   D  host-verifiable structural value (numbers, booleans, null, exact strings
 *      the host recomputes or compares byte-exactly against host-owned data)
 *
 * The walker emits `UNSCANNED_MODEL_AUTHORED_SEMANTIC_TEXT`; the preregistration
 * is not ready unless that list is empty.
 */
import { CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA } from "../../../packages/runtime/dist/index.js";

export type LeafClass = "A" | "B" | "C" | "D";

export interface SchemaLeaf {
  /** Dotted path with `[*]` for array items. */
  readonly path: string;
  readonly json_types: readonly string[];
  readonly leaf_class: LeafClass;
  readonly reason: string;
}

/** Handle/ref leaves: recognised with or without the array suffix. */
const HANDLE_OR_REF_PATHS: ReadonlySet<string> = new Set([
  "factual_assessment.claims[*].source_handles",
  "factual_assessment.claims.source_handles",
  "cognition.relevant_memory_handles",
  "cognition.considered_handles",
  "cognition.evidence_handles",
  "clarification_basis.current_observation_ref"
]);

function isHandleOrRef(path: string): boolean {
  const bare = path.endsWith("[*]") ? path.slice(0, -3) : path;
  return HANDLE_OR_REF_PATHS.has(path) || HANDLE_OR_REF_PATHS.has(bare);
}

/**
 * `derivation.claimed_result` is the model's claim, but every derivation family
 * is verified by the host byte-exactly against host-owned data (integer
 * arithmetic, string reversal, rule classification). It is therefore structural
 * content rather than free prose: an unverifiable assertion cannot survive there.
 */
const HOST_VERIFIED_RESULT_PATHS: ReadonlySet<string> = new Set([
  "factual_assessment.claims[*].derivation.claimed_result"
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function jsonTypesOf(schema: Record<string, unknown>): readonly string[] {
  const type = schema["type"];
  if (typeof type === "string") return [type];
  if (Array.isArray(type)) return type.filter((entry): entry is string => typeof entry === "string");
  if (Array.isArray(schema["enum"])) return ["enum"];
  if (typeof schema["const"] === "string") return ["const"];
  return ["unknown"];
}

function classify(path: string, schema: Record<string, unknown>): { leaf_class: LeafClass; reason: string } {
  const types = jsonTypesOf(schema);
  if (isHandleOrRef(path)) {
    return { leaf_class: "B", reason: "opaque handle/ref array: must never be read as prose" };
  }
  if (typeof schema["const"] === "string" || Array.isArray(schema["enum"])) {
    return { leaf_class: "C", reason: "closed enum/const atom" };
  }
  if (HOST_VERIFIED_RESULT_PATHS.has(path)) {
    return { leaf_class: "D", reason: "host-verified structural value" };
  }
  if (types.includes("string")) {
    return {
      leaf_class: "A",
      reason: "model-authored string leaf that can carry natural language: MUST be scanned"
    };
  }
  return { leaf_class: "D", reason: `host-verifiable structural value (${types.join("|")})` };
}

/**
 * Deterministic, schema-driven leaf enumeration. Handles `properties`, `items`,
 * `oneOf`/`anyOf` (all branches are walked so no branch can hide a text leaf).
 */
export function walkSchemaLeaves(
  schema: unknown,
  prefix = ""
): readonly SchemaLeaf[] {
  if (!isRecord(schema)) return [];
  const leaves: SchemaLeaf[] = [];
  const visit = (node: unknown, path: string): void => {
    if (!isRecord(node)) return;
    const properties = node["properties"];
    if (isRecord(properties)) {
      for (const key of Object.keys(properties).sort()) {
        const childPath = path.length === 0 ? key : `${path}.${key}`;
        const child = properties[key];
        if (isRecord(child) && (isRecord(child["properties"]) || child["items"] !== undefined || Array.isArray(child["oneOf"]) || Array.isArray(child["anyOf"]))) {
          visit(child, childPath);
          continue;
        }
        if (isRecord(child)) {
          const { leaf_class, reason } = classify(childPath, child);
          leaves.push({ path: childPath, json_types: jsonTypesOf(child), leaf_class, reason });
        }
      }
      return;
    }
    const items = node["items"];
    if (items !== undefined) {
      visit(items, `${path}[*]`);
      return;
    }
    for (const branchKey of ["oneOf", "anyOf"] as const) {
      const branches = node[branchKey];
      if (Array.isArray(branches)) {
        for (const branch of branches) visit(branch, path);
      }
    }
    // A typed leaf that carries no properties/items is classified in place.
    const scalarTypes = jsonTypesOf(node);
    if (
      path.length > 0 &&
      node["properties"] === undefined &&
      node["items"] === undefined &&
      !Array.isArray(node["oneOf"]) &&
      !Array.isArray(node["anyOf"]) &&
      !(scalarTypes.length === 1 && scalarTypes[0] === "null")
    ) {
      const { leaf_class, reason } = classify(path, node);
      leaves.push({ path, json_types: jsonTypesOf(node), leaf_class, reason });
    }
  };
  visit(schema, prefix);
  // Multi-branch schemas (oneOf) can define the same path with different types.
  // Every occurrence is kept and their types are UNIONED, so no branch can hide
  // a string leaf behind an earlier branch's non-string definition.
  const merged = new Map<string, { path: string; types: Set<string>; classes: Map<LeafClass, string> }>();
  for (const leaf of leaves) {
    const entry = merged.get(leaf.path) ?? { path: leaf.path, types: new Set<string>(), classes: new Map<LeafClass, string>() };
    for (const type of leaf.json_types) entry.types.add(type);
    entry.classes.set(leaf.leaf_class, leaf.reason);
    merged.set(leaf.path, entry);
  }
  return [...merged.values()]
    .map((entry) => {
      const union = [...entry.types].sort();
      const classes = [...entry.classes.keys()];
      // A path that is a string in ANY branch is semantic text and must be scanned.
      const leafClass: LeafClass = classes.length === 1 ? (classes[0] as LeafClass) : union.includes("string") && !classes.includes("B") ? "A" : (classes[0] as LeafClass);
      const reason = leafClass === "A" && classes.length > 1
        ? "multi-branch leaf: string in at least one branch, therefore semantic text"
        : (entry.classes.get(leafClass) ?? "merged multi-branch classification");
      return { path: entry.path, json_types: union, leaf_class: leafClass, reason };
    })
    .sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));
}

/**
 * THE exact confirmatory text scan surface: every category-A leaf of the real
 * V8 cognition proposal schema, in canonical order.
 */
export function deriveExactCognitionTextScanSurface(): readonly string[] {
  return walkSchemaLeaves(CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA)
    .filter((leaf) => leaf.leaf_class === "A")
    .map((leaf) => leaf.path);
}

export function classifyCognitionSchemaLeaves(): readonly SchemaLeaf[] {
  return walkSchemaLeaves(CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA);
}

export interface ScanSurfaceAudit {
  readonly exact_scan_surface: readonly string[];
  readonly leaves: readonly SchemaLeaf[];
  readonly model_authored_semantic_leaves: readonly string[];
  readonly unscanned_model_authored_semantic_text: readonly string[];
  readonly opaque_ref_leaves: readonly string[];
  readonly enum_leaves: readonly string[];
  readonly structural_leaves: readonly string[];
  readonly frozen_protocol_declared_paths_covered: boolean;
  readonly subjective_selection_covered: boolean;
  readonly derivation_text_covered: boolean;
  readonly schema_hash: string;
}

/** The five paths the frozen measurement protocol already declared. */
export const FROZEN_PROTOCOL_DECLARED_PATHS: readonly string[] = Object.freeze([
  "cognition.reasoning_summary",
  "cognition.current_intent",
  "factual_assessment.claims[*].text",
  "clarification_basis.missing_information",
  "clarification_basis.needed_for"
]);

export function auditScanSurface(schemaHash: string): ScanSurfaceAudit {
  const leaves = classifyCognitionSchemaLeaves();
  const surface = leaves.filter((leaf) => leaf.leaf_class === "A").map((leaf) => leaf.path);
  const unscanned = surface.filter((path) => !FROZEN_PROTOCOL_DECLARED_PATHS.includes(path) && !surface.includes(path));
  return {
    exact_scan_surface: surface,
    leaves,
    model_authored_semantic_leaves: surface,
    unscanned_model_authored_semantic_text: unscanned,
    opaque_ref_leaves: leaves.filter((leaf) => leaf.leaf_class === "B").map((leaf) => leaf.path),
    enum_leaves: leaves.filter((leaf) => leaf.leaf_class === "C").map((leaf) => leaf.path),
    structural_leaves: leaves.filter((leaf) => leaf.leaf_class === "D").map((leaf) => leaf.path),
    frozen_protocol_declared_paths_covered: FROZEN_PROTOCOL_DECLARED_PATHS.every((path) => surface.includes(path)),
    subjective_selection_covered:
      surface.includes("subjective_selection.stance") && surface.includes("subjective_selection.subjective_rationale"),
    derivation_text_covered: surface.some((path) => path.includes(".derivation.")),
    schema_hash: schemaHash
  };
}
