/* eslint-disable no-restricted-imports -- Research harness: inspects FROZEN PRODUCTION contracts and the research protocol by relative path. */
/**
 * MODEL-VISIBLE CONTRACT PARITY — production ↔ model-facing schema ↔ system prompt.
 *
 * WHY THIS EXISTS: the observed calibration rejection
 * (`clarification_basis.missing_information: exceeds 256 code points`) was lawful
 * under the host contract and invisible in the model-facing contract: the schema
 * declared a bare `{"type":"string"}` and the prompt named no bound. This module
 * inventories EVERY deterministic constraint the production validator applies to a
 * model-authored field and reports, per item, whether the executor can see it.
 *
 * The inventory is COMPUTED from the real artefacts (the production schema object,
 * the production validator's own constants, and the real model-facing prompt), not
 * asserted by hand, so it cannot quietly drift from the code.
 *
 * SCOPE: existing production law only. This module never defines a new constraint
 * and never changes acceptance: the production validator remains the authority and
 * the schema/prompt only advertise it.
 */
import {
  CLARIFICATION_BASIS_TEXT_MAX_CODE_POINTS,
  CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA,
  FACTUAL_ASSESSMENT_CLAIM_TEXT_MAX_CODE_POINTS_V0,
  FACTUAL_ASSESSMENT_MAX_CLAIMS_V0,
  SUBJECTIVE_SELECTION_MAX_CODE_POINTS_V1,
  SUBJECTIVE_SELECTION_RATIONALE_MAX_CODE_POINTS_V1
} from "../../../packages/runtime/dist/index.js";
import { CONVERSATION_COGNITION_SYSTEM_PROMPT_V8 } from "../../../packages/runtime/dist/providers/behavior/conversation-cognition-provider-v8.js";

export type ParityStatus =
  | "FULL_PARITY"
  | "SCHEMA_ONLY"
  | "PROMPT_ONLY"
  | "PRODUCTION_ONLY"
  | "NOT_MODEL_RELEVANT";

/** How the host decides a text value is non-empty — the two rules are NOT interchangeable. */
export type NonEmptyRule = "LENGTH" | "AFTER_TRIM" | "NOT_APPLICABLE";

export interface ParityItem {
  readonly id: string;
  readonly field_path: string;
  readonly production_constraint: string;
  readonly production_source: string;
  readonly production_constant: { readonly name: string; readonly value: number } | null;
  readonly non_empty_rule: NonEmptyRule;
  readonly schema_representation: string | null;
  readonly schema_exposes_bound: boolean;
  readonly prompt_representation: string | null;
  readonly prompt_exposes_bound: boolean;
  readonly status: ParityStatus;
  readonly note: string;
}

type SchemaPath = readonly (string | number)[];

interface ConstraintSpec {
  readonly id: string;
  readonly field_path: string;
  readonly production_constraint: string;
  readonly production_source: string;
  readonly production_constant: { readonly name: string; readonly value: number } | null;
  readonly non_empty_rule: NonEmptyRule;
  /** Where the bound lives in the canonical schema (null ⇒ the host enforces no schema-expressible bound). */
  readonly schema_path: SchemaPath | null;
  /** The exact token(s) the prompt must contain to count as exposing this field's bound. */
  readonly prompt_tokens: readonly string[];
  readonly model_relevant: boolean;
  readonly note: string;
}

const MAX_CLAIMS = FACTUAL_ASSESSMENT_MAX_CLAIMS_V0;
const CLAIM_TEXT = FACTUAL_ASSESSMENT_CLAIM_TEXT_MAX_CODE_POINTS_V0;
const BASIS_TEXT = CLARIFICATION_BASIS_TEXT_MAX_CODE_POINTS;
const STANCE = SUBJECTIVE_SELECTION_MAX_CODE_POINTS_V1;
const RATIONALE = SUBJECTIVE_SELECTION_RATIONALE_MAX_CODE_POINTS_V1;

/**
 * Every deterministic constraint the production validator applies to a
 * model-authored field, with the source that owns it. The `schema_path` is where
 * the bound MUST be declared for the executor to see it.
 */
export const CONSTRAINT_SPECS: readonly ConstraintSpec[] = Object.freeze([
  {
    id: "CLAIMS_CARDINALITY",
    field_path: "factual_assessment.claims",
    production_constraint: `at most ${MAX_CLAIMS} claims`,
    production_source: "packages/runtime/src/transitions/conversation/conversation-cognition-proposal.ts (FACTUAL_ASSESSMENT_MAX_CLAIMS_V0)",
    production_constant: { name: "FACTUAL_ASSESSMENT_MAX_CLAIMS_V0", value: MAX_CLAIMS },
    non_empty_rule: "NOT_APPLICABLE",
    schema_path: ["properties", "factual_assessment", "properties", "claims"],
    prompt_tokens: ["at most 8 claims"],
    model_relevant: true,
    note: "array cardinality, expressible as maxItems"
  },
  {
    id: "CLAIM_TEXT_LENGTH",
    field_path: "factual_assessment.claims[].text",
    production_constraint: `non-whitespace and at most ${CLAIM_TEXT} code points`,
    production_source:
      "packages/runtime/src/transitions/conversation/factual-claim-authorization.ts (V1 authorization: trim non-empty and <=512) and conversation-cognition-proposal.ts (FACTUAL_ASSESSMENT_CLAIM_TEXT_MAX_CODE_POINTS_V0)",
    production_constant: { name: "FACTUAL_ASSESSMENT_CLAIM_TEXT_MAX_CODE_POINTS_V0", value: CLAIM_TEXT },
    non_empty_rule: "AFTER_TRIM",
    schema_path: ["properties", "factual_assessment", "properties", "claims", "items", "oneOf", 0, "properties", "text"],
    prompt_tokens: ["factual_assessment.claims[].text must contain a non-whitespace character and at most 512 code points"],
    model_relevant: true,
    note: "the V1 path tests trim().length === 0 before the bound, so the schema must carry BOTH minLength/pattern and maxLength"
  },
  {
    id: "CLAIM_SOURCE_HANDLES_NON_EMPTY",
    field_path: "factual_assessment.claims[].source_handles",
    production_constraint: "non-empty and no repeated handle",
    production_source: "conversation-cognition-proposal.ts (validateRefArray / duplicate-handle rejection)",
    production_constant: null,
    non_empty_rule: "NOT_APPLICABLE",
    schema_path: ["properties", "factual_assessment", "properties", "claims", "items", "oneOf", 0, "properties", "source_handles"],
    prompt_tokens: ["source_handles must be non-empty and must not repeat a handle"],
    model_relevant: true,
    note: "minItems covers non-emptiness; duplicate rejection is a host rule stated in the prompt and not expressible as a JSON Schema keyword here"
  },
  {
    id: "BASIS_MISSING_INFORMATION_LENGTH",
    field_path: "clarification_basis.missing_information",
    production_constraint: `at least one character and at most ${BASIS_TEXT} code points`,
    production_source: "conversation-cognition-proposal.ts (validateBoundedCanonicalText, CLARIFICATION_BASIS_TEXT_MAX_CODE_POINTS)",
    production_constant: { name: "CLARIFICATION_BASIS_TEXT_MAX_CODE_POINTS", value: BASIS_TEXT },
    non_empty_rule: "LENGTH",
    schema_path: ["properties", "clarification_basis", "anyOf", 1, "properties", "missing_information"],
    prompt_tokens: [`clarification_basis.missing_information must contain at least one character and at most ${BASIS_TEXT} code points`],
    model_relevant: true,
    note: "THE OBSERVED FAILURE: this is the field whose bound the executor could not see. Non-emptiness here is LENGTH-based, so advertising pattern \\S would overstate the law"
  },
  {
    id: "BASIS_NEEDED_FOR_LENGTH",
    field_path: "clarification_basis.needed_for",
    production_constraint: `at least one character and at most ${BASIS_TEXT} code points`,
    production_source: "conversation-cognition-proposal.ts (validateBoundedCanonicalText, CLARIFICATION_BASIS_TEXT_MAX_CODE_POINTS)",
    production_constant: { name: "CLARIFICATION_BASIS_TEXT_MAX_CODE_POINTS", value: BASIS_TEXT },
    non_empty_rule: "LENGTH",
    schema_path: ["properties", "clarification_basis", "anyOf", 1, "properties", "needed_for"],
    prompt_tokens: [`clarification_basis.needed_for must contain at least one character and at most ${BASIS_TEXT} code points`],
    model_relevant: true,
    note: "same validator and same constant as missing_information"
  },
  {
    id: "SUBJECTIVE_STANCE_LENGTH",
    field_path: "subjective_selection.stance",
    production_constraint: `non-whitespace and at most ${STANCE} code points`,
    production_source: "conversation-cognition-proposal.ts (validateSubjectiveSelectionV1, SUBJECTIVE_SELECTION_MAX_CODE_POINTS_V1)",
    production_constant: { name: "SUBJECTIVE_SELECTION_MAX_CODE_POINTS_V1", value: STANCE },
    non_empty_rule: "AFTER_TRIM",
    schema_path: ["properties", "subjective_selection", "oneOf", 1, "properties", "stance"],
    prompt_tokens: [`subjective_selection.stance must contain a non-whitespace character and at most ${STANCE} code points`],
    model_relevant: true,
    note: "trim-based non-emptiness"
  },
  {
    id: "SUBJECTIVE_RATIONALE_LENGTH",
    field_path: "subjective_selection.subjective_rationale",
    production_constraint: `when a string: non-whitespace and at most ${RATIONALE} code points`,
    production_source: "conversation-cognition-proposal.ts (validateSubjectiveSelectionV1, SUBJECTIVE_SELECTION_RATIONALE_MAX_CODE_POINTS_V1)",
    production_constant: { name: "SUBJECTIVE_SELECTION_RATIONALE_MAX_CODE_POINTS_V1", value: RATIONALE },
    non_empty_rule: "AFTER_TRIM",
    schema_path: ["properties", "subjective_selection", "oneOf", 1, "properties", "subjective_rationale"],
    prompt_tokens: [
      `subjective_selection.subjective_rationale, when it is a string, must contain a non-whitespace character and at most ${RATIONALE} code points`
    ],
    model_relevant: true,
    note: "nullable field: the bound applies only to the string branch"
  },
  {
    id: "ADVERTISED_HANDLE_BUDGET",
    field_path: "(host-side) advertised handle menu",
    production_constraint: "at most 64 advertised handles",
    production_source: "conversation-cognition-proposal.ts (MAX_ADVERTISED_HANDLES_V0)",
    production_constant: { name: "MAX_ADVERTISED_HANDLES_V0", value: 64 },
    non_empty_rule: "NOT_APPLICABLE",
    schema_path: null,
    prompt_tokens: [],
    model_relevant: false,
    note: "NOT_MODEL_RELEVANT: a host-side advertising budget, not a constraint the executor can violate or must be told about"
  }
]);

function readSchemaPath(path: SchemaPath | null): unknown {
  if (path === null) return undefined;
  let cursor: unknown = CONVERSATION_COGNITION_PROPOSAL_V8_JSON_SCHEMA;
  for (const segment of path) {
    if (typeof cursor !== "object" || cursor === null) return undefined;
    cursor = (cursor as Record<string | number, unknown>)[segment as never];
  }
  return cursor;
}

function describeSchemaBound(node: unknown): { representation: string | null; exposesBound: boolean; declaresNonEmpty: boolean } {
  if (typeof node !== "object" || node === null) return { representation: null, exposesBound: false, declaresNonEmpty: false };
  const record = node as Record<string, unknown>;
  const parts: string[] = [];
  const maxLength = record["maxLength"];
  const maxItems = record["maxItems"];
  const minLength = record["minLength"];
  const minItems = record["minItems"];
  const pattern = record["pattern"];
  if (typeof maxLength === "number") parts.push(`maxLength=${String(maxLength)}`);
  if (typeof minLength === "number") parts.push(`minLength=${String(minLength)}`);
  if (pattern === "\\S") parts.push("pattern=\\S (non-whitespace)");
  if (typeof maxItems === "number") parts.push(`maxItems=${String(maxItems)}`);
  if (typeof minItems === "number") parts.push(`minItems=${String(minItems)}`);
  const uniqueItems = record["uniqueItems"] === true;
  if (uniqueItems) parts.push("uniqueItems=true (no repeats)");
  const type = record["type"];
  if (type !== undefined) parts.unshift(`type=${Array.isArray(type) ? type.join("|") : String(type)}`);
  return {
    representation: parts.length === 0 ? null : parts.join(", "),
    // Every keyword below is a bound the executor can SEE: a length cap, a
    // cardinality cap, an at-least-one array, a repeat prohibition, an
    // at-least-one-character rule or a non-whitespace rule.
    exposesBound:
      typeof maxLength === "number" ||
      typeof maxItems === "number" ||
      typeof minItems === "number" ||
      typeof minLength === "number" ||
      pattern === "\\S" ||
      uniqueItems,
    declaresNonEmpty:
      typeof minLength === "number" || pattern === "\\S" || typeof minItems === "number" || uniqueItems
  };
}

export function buildParityInventory(): readonly ParityItem[] {
  return CONSTRAINT_SPECS.map((spec) => {
    const schemaNode = readSchemaPath(spec.schema_path);
    const schema = describeSchemaBound(schemaNode);
    const promptToken = spec.prompt_tokens.find((token) => CONVERSATION_COGNITION_SYSTEM_PROMPT_V8.includes(token)) ?? null;
    const promptExposes = promptToken !== null;
    const productionOnly = spec.model_relevant && !schema.exposesBound && !promptExposes;
    const status: ParityStatus = !spec.model_relevant
      ? "NOT_MODEL_RELEVANT"
      : schema.exposesBound && promptExposes
        ? "FULL_PARITY"
        : schema.exposesBound
          ? "SCHEMA_ONLY"
          : promptExposes
            ? "PROMPT_ONLY"
            : "PRODUCTION_ONLY";
    void productionOnly;
    return {
      id: spec.id,
      field_path: spec.field_path,
      production_constraint: spec.production_constraint,
      production_source: spec.production_source,
      production_constant: spec.production_constant,
      non_empty_rule: spec.non_empty_rule,
      schema_representation: schema.representation,
      schema_exposes_bound: schema.exposesBound,
      prompt_representation: promptToken,
      prompt_exposes_bound: promptExposes,
      status,
      note: spec.note
    };
  });
}

export function inventorySummary(items: readonly ParityItem[] = buildParityInventory()): {
  readonly total: number;
  readonly by_status: Readonly<Record<string, number>>;
  readonly production_only: readonly string[];
  readonly unexplained_production_only: readonly string[];
} {
  const byStatus: Record<string, number> = {};
  for (const item of items) byStatus[item.status] = (byStatus[item.status] ?? 0) + 1;
  const productionOnly = items.filter((item) => item.status === "PRODUCTION_ONLY").map((item) => item.id);
  // A model-authored deterministic constraint that neither the schema nor the
  // prompt exposes is UNEXPLAINED: every such gap must be closed by exposing
  // existing production law (never by weakening it).
  const unexplained = items
    .filter((item) => item.status === "PRODUCTION_ONLY" && item.production_constant !== null)
    .map((item) => item.id);
  return { total: items.length, by_status: byStatus, production_only: productionOnly, unexplained_production_only: unexplained };
}
