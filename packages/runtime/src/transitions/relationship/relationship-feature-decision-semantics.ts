/**
 * Relationship Feature Decision Semantics Foundation V0 — governance /
 * authority foundation for deciding whether an opaque canonical Relationship
 * feature has EXPLICIT decision semantics
 * (RELATIONSHIP_FEATURE_DECISION_SEMANTICS_FOUNDATION_V0 ARCHITECTURE_APPROVED).
 *
 * Establishes:
 *   - RelationshipFeatureDecisionSemanticsContractV0 closed schema
 *   - closed deterministic fail-closed validation incl. cross-field rules
 *   - deterministic fingerprints (hashEnvelope / JCS)
 *   - module-private static feature-semantics registry (exactly ONE admitted
 *     real feature: interaction familiarity)
 *   - exact fail-closed registry resolution
 *   - default NOT_DECISION_ADMISSIBLE for unregistered canonical features
 *   - explicit distinction: storage admission ≠ decision admission
 *
 * This slice DOES NOT implement:
 *   - a concrete Relationship feature (trust / attachment / closeness / affinity)
 *   - feature numeric mapping (x, 1-x, 2x-1, normalization, weighting, thresholds)
 *   - an action relation provider or relation workflow
 *   - Relationship tendency / Relationship scale contract
 *   - feature aggregation or cross-feature comparability
 *   - cross-domain arithmetic / action execution / model calls
 *
 * Canonical status: VERSIONED_RUNTIME_POLICY_NON_SUBJECT_STATE.
 *   No SubjectState mutation. No revision. No trace. No logical-time advance.
 *   No memory or Belief mutation.
 *
 * Feature semantics contracts are GLOBAL per exact feature semantic identity
 * (RELATIONSHIP, relationship-state-v0, dimension_id, contract id,
 * contract fingerprint); canonical VALUES remain exact counterpart-specific.
 * counterpart_ref is never part of the global registry key.
 */

import type {
  HashV1,
  IdentifierV0,
  UnitIntervalV0
} from "@characteros-next/subject-core";
import { hashEnvelope, validateUnitInterval } from "@characteros-next/subject-core";

// ---- identity literals (§4) ------------------------------------------------------

export const RELATIONSHIP_FEATURE_DECISION_SEMANTICS_CONTRACT_SCHEMA_VERSION =
  "relationship-feature-decision-semantics-contract-v0" as const;

export const RELATIONSHIP_FEATURE_DECISION_DOMAIN_ID_V0 = "RELATIONSHIP" as const;

export const RELATIONSHIP_FEATURE_DECISION_SOURCE_STATE_SCHEMA_VERSION_V0 =
  "relationship-state-v0" as const;

/** Fingerprint namespace literal EXACT (single literal, no line break). */
export const RELATIONSHIP_FEATURE_DECISION_SEMANTICS_CONTRACT_FINGERPRINT_PROJECTION =
  "characteros-next/runtime/relationship-feature-decision-semantics-contract/v1" as const;

// ---- decision role vocabulary (§6) -----------------------------------------------

/**
 * Exact closed decision-role vocabulary. Existence in this vocabulary grants
 * ZERO authority — authority comes exclusively from registry membership.
 */
export const RELATIONSHIP_FEATURE_DECISION_ROLES_V0 = Object.freeze([
  "DIRECTIONAL_DECISION_SIGNAL",
  "MAGNITUDE_ONLY",
  "MODULATOR",
  "GATE",
  "EVIDENCE_OR_RELIABILITY",
  "CONTEXT_ONLY",
  "NOT_DECISION_ADMISSIBLE"
] as const);

export type RelationshipFeatureDecisionRoleV0 =
  (typeof RELATIONSHIP_FEATURE_DECISION_ROLES_V0)[number];

/** Roles that MAY become decision-relevant (still require a typed action relation). */
const DECISION_ADMISSIBLE_ROLES_V0: ReadonlySet<string> = new Set([
  "DIRECTIONAL_DECISION_SIGNAL",
  "MAGNITUDE_ONLY",
  "MODULATOR",
  "GATE",
  "EVIDENCE_OR_RELIABILITY"
] as const);

/** Exact closed monotonicity vocabulary (§10). */
export const RELATIONSHIP_FEATURE_MONOTONICITY_SEMANTICS_V0 = Object.freeze([
  "INCREASING_QUANTITY",
  "DECREASING_QUANTITY",
  "NON_MONOTONIC",
  "UNSPECIFIED"
] as const);

export type RelationshipFeatureMonotonicitySemanticsV0 =
  (typeof RELATIONSHIP_FEATURE_MONOTONICITY_SEMANTICS_V0)[number];

// ---- semantic point type (§5) ----------------------------------------------------

/**
 * Exact closed semantic-point union. A point names WHERE a semantic anchor
 * sits on the canonical [0,1] quantity axis — it is descriptive metadata and
 * never a numeric transform input.
 */
export type RelationshipFeatureSemanticPointV0 =
  | {
      readonly kind: "NONE";
    }
  | {
      readonly kind: "LOWER_ENDPOINT";
    }
  | {
      readonly kind: "UPPER_ENDPOINT";
    }
  | {
      readonly kind: "EXPLICIT_VALUE";
      readonly value: UnitIntervalV0;
      readonly semantics_id: IdentifierV0;
    };

// ---- contract type (§7) ----------------------------------------------------------

/**
 * RelationshipFeatureDecisionSemanticsContractV0 — architecture-approved
 * closed shape. Records decision SEMANTICS only; owns NO numeric decision
 * transform (direct_numeric_mapping_authorized is fixed false).
 */
export interface RelationshipFeatureDecisionSemanticsContractV0 {
  readonly schema_version: typeof RELATIONSHIP_FEATURE_DECISION_SEMANTICS_CONTRACT_SCHEMA_VERSION;

  readonly feature_semantics_contract_id: IdentifierV0;
  readonly dimension_id: IdentifierV0;
  readonly domain_id: typeof RELATIONSHIP_FEATURE_DECISION_DOMAIN_ID_V0;
  readonly source_state_schema_version: typeof RELATIONSHIP_FEATURE_DECISION_SOURCE_STATE_SCHEMA_VERSION_V0;

  readonly input_numeric_type: "UNIT_INTERVAL_V0";

  readonly input_range: {
    readonly minimum: 0;
    readonly maximum: 1;
    readonly minimum_inclusive: true;
    readonly maximum_inclusive: true;
    readonly non_finite: "FORBIDDEN";
  };

  readonly quantity_semantics_id: IdentifierV0;

  readonly lower_endpoint_semantics: {
    readonly value: 0;
    readonly semantics_id: IdentifierV0;
  };

  readonly upper_endpoint_semantics: {
    readonly value: 1;
    readonly semantics_id: IdentifierV0;
  };

  readonly neutral_or_reference_semantics: {
    readonly neutral: RelationshipFeatureSemanticPointV0;
    readonly reference: RelationshipFeatureSemanticPointV0;
  };

  readonly polarity_semantics: "UNSIGNED" | "BIPOLAR_AROUND_EXPLICIT_REFERENCE";

  readonly magnitude_semantics:
    | {
        readonly kind: "NONE";
      }
    | {
        readonly kind: "VERSIONED_POLICY";
        readonly policy_id: IdentifierV0;
      };

  readonly monotonicity_semantics: RelationshipFeatureMonotonicitySemanticsV0;

  readonly decision_role: RelationshipFeatureDecisionRoleV0;

  readonly action_relation_requirement:
    | "EXACT_FEATURE_STATE_X_EXACT_ACTION_X_EXACT_COUNTERPART_TYPED_RELATION_REQUIRED"
    | "DECISION_USE_FORBIDDEN";

  readonly counterpart_binding_requirement: "EXACT_CANONICAL_COUNTERPART_REF";

  readonly direct_numeric_mapping_authorized: false;

  readonly cross_feature_comparability: "DENY";

  readonly aggregation_eligibility: "NONE_BY_DEFAULT";

  readonly normalization_authority: "NONE";

  readonly provenance_requirements: "EXACT_CURRENT_CANONICAL_RELATIONSHIP_PROJECTION_V0";
}

// ---- validation (§8) -------------------------------------------------------------

/** Stable fail-closed validation codes owned by this slice. */
export type RelationshipFeatureDecisionSemanticsValidationErrorCodeV0 =
  | "SCHEMA_VERSION_MISMATCH"
  | "INVALID_IDENTIFIER"
  | "INVALID_DOMAIN_ID"
  | "INVALID_SOURCE_STATE_SCHEMA_VERSION"
  | "INVALID_INPUT_NUMERIC_TYPE"
  | "INVALID_INPUT_RANGE"
  | "INVALID_ENDPOINT_SEMANTICS"
  | "INVALID_SEMANTIC_POINT"
  | "INVALID_POLARITY_SEMANTICS"
  | "INVALID_MAGNITUDE_SEMANTICS"
  | "INVALID_MONOTONICITY_SEMANTICS"
  | "INVALID_DECISION_ROLE"
  | "INVALID_ACTION_RELATION_REQUIREMENT"
  | "INVALID_COUNTERPART_BINDING_REQUIREMENT"
  | "INVALID_AUTHORITY_LITERAL"
  | "ROLE_ACTION_RELATION_MISMATCH"
  | "ADMISSIBLE_ROLE_MONOTONICITY_UNSPECIFIED"
  | "BIPOLAR_REFERENCE_NOT_EXPLICIT_INTERIOR_VALUE"
  | "EXTRA_FIELDS_REJECTED"
  | "EXPECTED_OBJECT";

export class RelationshipFeatureDecisionSemanticsValidationErrorV0 extends Error {
  readonly code: RelationshipFeatureDecisionSemanticsValidationErrorCodeV0;

  constructor(code: RelationshipFeatureDecisionSemanticsValidationErrorCodeV0, detail: string) {
    super(`RELATIONSHIP_FEATURE_DECISION_SEMANTICS_${code}: ${detail}`);
    this.name = "RelationshipFeatureDecisionSemanticsValidationErrorV0";
    this.code = code;
  }
}

/** IdentifierV0 grammar (mirrors subject-core scalar validator). */
const IDENTIFIER_RE = /^[A-Za-z0-9][A-Za-z0-9._~-]{0,127}$/;

/** Frozen ordered set of contract top-level field names. */
const CONTRACT_FIELDS_V0: readonly string[] = [
  "schema_version",
  "feature_semantics_contract_id",
  "dimension_id",
  "domain_id",
  "source_state_schema_version",
  "input_numeric_type",
  "input_range",
  "quantity_semantics_id",
  "lower_endpoint_semantics",
  "upper_endpoint_semantics",
  "neutral_or_reference_semantics",
  "polarity_semantics",
  "magnitude_semantics",
  "monotonicity_semantics",
  "decision_role",
  "action_relation_requirement",
  "counterpart_binding_requirement",
  "direct_numeric_mapping_authorized",
  "cross_feature_comparability",
  "aggregation_eligibility",
  "normalization_authority",
  "provenance_requirements"
];

const INPUT_RANGE_FIELDS_V0: readonly string[] = [
  "minimum",
  "maximum",
  "minimum_inclusive",
  "maximum_inclusive",
  "non_finite"
];

const ENDPOINT_FIELDS_V0: readonly string[] = ["value", "semantics_id"];

const NEUTRAL_REFERENCE_FIELDS_V0: readonly string[] = ["neutral", "reference"];

const MAGNITUDE_NONE_FIELDS: readonly string[] = ["kind"];
const MAGNITUDE_VERSIONED_FIELDS: readonly string[] = ["kind", "policy_id"];

function assertIdentifier(v: unknown, label: string): asserts v is IdentifierV0 {
  if (typeof v !== "string" || !IDENTIFIER_RE.test(v)) {
    throw new RelationshipFeatureDecisionSemanticsValidationErrorV0(
      "INVALID_IDENTIFIER",
      `${label}: invalid IdentifierV0`
    );
  }
}

function assertObject(v: unknown, label: string): asserts v is Record<string, unknown> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) {
    throw new RelationshipFeatureDecisionSemanticsValidationErrorV0(
      "EXPECTED_OBJECT",
      `${label}: expected plain object`
    );
  }
}

function assertExactKeys(
  obj: Record<string, unknown>,
  allowed: readonly string[],
  label: string
): void {
  const keys = Object.keys(obj).sort();
  const allowedSorted = [...allowed].sort();
  if (keys.length !== allowedSorted.length) {
    throw new RelationshipFeatureDecisionSemanticsValidationErrorV0(
      "EXTRA_FIELDS_REJECTED",
      `${label}: unexpected keys; expected exactly ${allowedSorted.join(",")} got ${keys.join(",")}`
    );
  }
  for (let i = 0; i < keys.length; i++) {
    if (keys[i] !== allowedSorted[i]) {
      throw new RelationshipFeatureDecisionSemanticsValidationErrorV0(
        "EXTRA_FIELDS_REJECTED",
        `${label}: unexpected key ${keys[i]}`
      );
    }
  }
}

/** §5 semantic-point closed-union validation (any malformed point fails closed). */
function validateSemanticPointV0(
  v: unknown,
  label: string
): asserts v is RelationshipFeatureSemanticPointV0 {
  assertObject(v, label);
  const kind = v["kind"];
  if (kind === "NONE" || kind === "LOWER_ENDPOINT" || kind === "UPPER_ENDPOINT") {
    assertExactKeys(v, ["kind"], label);
    return;
  }
  if (kind === "EXPLICIT_VALUE") {
    assertExactKeys(v, ["kind", "value", "semantics_id"], label);
    const value = v["value"];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new RelationshipFeatureDecisionSemanticsValidationErrorV0(
        "INVALID_SEMANTIC_POINT",
        `${label}.value: EXPLICIT_VALUE requires a finite UnitIntervalV0`
      );
    }
    const checked = validateUnitInterval(value, `${label}.value`);
    if (!checked.ok) {
      throw new RelationshipFeatureDecisionSemanticsValidationErrorV0(
        "INVALID_SEMANTIC_POINT",
        `${label}.value: EXPLICIT_VALUE outside inclusive [0,1]`
      );
    }
    const semanticsId = v["semantics_id"];
    if (typeof semanticsId !== "string" || !IDENTIFIER_RE.test(semanticsId)) {
      throw new RelationshipFeatureDecisionSemanticsValidationErrorV0(
        "INVALID_SEMANTIC_POINT",
        `${label}.semantics_id: invalid IdentifierV0`
      );
    }
    return;
  }
  throw new RelationshipFeatureDecisionSemanticsValidationErrorV0(
    "INVALID_SEMANTIC_POINT",
    `${label}: unknown semantic point kind ${String(kind)}`
  );
}

/**
 * §8-§11 Deterministic closed-schema validation of
 * RelationshipFeatureDecisionSemanticsContractV0, including the
 * architecture-approved cross-field rules:
 *
 *   - decision-admissible roles REQUIRE the exact typed action relation
 *   - CONTEXT_ONLY / NOT_DECISION_ADMISSIBLE REQUIRE DECISION_USE_FORBIDDEN
 *   - decision-admissible roles MUST NOT declare UNSPECIFIED monotonicity
 *   - BIPOLAR_AROUND_EXPLICIT_REFERENCE requires an EXPLICIT_VALUE reference
 *     strictly interior to [0,1] (no implicit 0.5, no generated transform)
 *
 * No repair. No coercion. No default insertion. No rounding.
 */
export function validateRelationshipFeatureDecisionSemanticsContractV0(
  value: unknown
): asserts value is RelationshipFeatureDecisionSemanticsContractV0 {
  assertObject(value, "feature_decision_semantics_contract");
  assertExactKeys(value, CONTRACT_FIELDS_V0, "feature_decision_semantics_contract");

  if (
    value["schema_version"] !==
    RELATIONSHIP_FEATURE_DECISION_SEMANTICS_CONTRACT_SCHEMA_VERSION
  ) {
    throw new RelationshipFeatureDecisionSemanticsValidationErrorV0(
      "SCHEMA_VERSION_MISMATCH",
      `expected ${RELATIONSHIP_FEATURE_DECISION_SEMANTICS_CONTRACT_SCHEMA_VERSION}`
    );
  }

  assertIdentifier(value["feature_semantics_contract_id"], "feature_semantics_contract_id");
  assertIdentifier(value["dimension_id"], "dimension_id");

  if (value["domain_id"] !== RELATIONSHIP_FEATURE_DECISION_DOMAIN_ID_V0) {
    throw new RelationshipFeatureDecisionSemanticsValidationErrorV0(
      "INVALID_DOMAIN_ID",
      `domain_id must be ${RELATIONSHIP_FEATURE_DECISION_DOMAIN_ID_V0}`
    );
  }
  if (value["source_state_schema_version"] !== RELATIONSHIP_FEATURE_DECISION_SOURCE_STATE_SCHEMA_VERSION_V0) {
    throw new RelationshipFeatureDecisionSemanticsValidationErrorV0(
      "INVALID_SOURCE_STATE_SCHEMA_VERSION",
      `source_state_schema_version must be ${RELATIONSHIP_FEATURE_DECISION_SOURCE_STATE_SCHEMA_VERSION_V0}`
    );
  }
  if (value["input_numeric_type"] !== "UNIT_INTERVAL_V0") {
    throw new RelationshipFeatureDecisionSemanticsValidationErrorV0(
      "INVALID_INPUT_NUMERIC_TYPE",
      "input_numeric_type must be UNIT_INTERVAL_V0"
    );
  }

  // input_range — EXACT frozen [0,1] inclusive, non-finite FORBIDDEN (§29).
  const range = value["input_range"];
  assertObject(range, "input_range");
  assertExactKeys(range, INPUT_RANGE_FIELDS_V0, "input_range");
  if (
    range["minimum"] !== 0 ||
    range["maximum"] !== 1 ||
    range["minimum_inclusive"] !== true ||
    range["maximum_inclusive"] !== true ||
    range["non_finite"] !== "FORBIDDEN"
  ) {
    throw new RelationshipFeatureDecisionSemanticsValidationErrorV0(
      "INVALID_INPUT_RANGE",
      "input_range must be exactly {minimum:0, maximum:1, inclusive both, non_finite FORBIDDEN}"
    );
  }

  assertIdentifier(value["quantity_semantics_id"], "quantity_semantics_id");

  // Endpoints — exact shapes with EXACT values 0 and 1.
  const lower = value["lower_endpoint_semantics"];
  assertObject(lower, "lower_endpoint_semantics");
  assertExactKeys(lower, ENDPOINT_FIELDS_V0, "lower_endpoint_semantics");
  if (lower["value"] !== 0) {
    throw new RelationshipFeatureDecisionSemanticsValidationErrorV0(
      "INVALID_ENDPOINT_SEMANTICS",
      "lower_endpoint_semantics.value must be exactly 0"
    );
  }
  assertIdentifier(lower["semantics_id"], "lower_endpoint_semantics.semantics_id");

  const upper = value["upper_endpoint_semantics"];
  assertObject(upper, "upper_endpoint_semantics");
  assertExactKeys(upper, ENDPOINT_FIELDS_V0, "upper_endpoint_semantics");
  if (upper["value"] !== 1) {
    throw new RelationshipFeatureDecisionSemanticsValidationErrorV0(
      "INVALID_ENDPOINT_SEMANTICS",
      "upper_endpoint_semantics.value must be exactly 1"
    );
  }
  assertIdentifier(upper["semantics_id"], "upper_endpoint_semantics.semantics_id");

  // neutral / reference semantic points (§30: no implicit 0.5 insertion).
  const neutralReference = value["neutral_or_reference_semantics"];
  assertObject(neutralReference, "neutral_or_reference_semantics");
  assertExactKeys(neutralReference, NEUTRAL_REFERENCE_FIELDS_V0, "neutral_or_reference_semantics");
  validateSemanticPointV0(neutralReference["neutral"], "neutral_or_reference_semantics.neutral");
  validateSemanticPointV0(
    neutralReference["reference"],
    "neutral_or_reference_semantics.reference"
  );

  const polarity = value["polarity_semantics"];
  if (polarity !== "UNSIGNED" && polarity !== "BIPOLAR_AROUND_EXPLICIT_REFERENCE") {
    throw new RelationshipFeatureDecisionSemanticsValidationErrorV0(
      "INVALID_POLARITY_SEMANTICS",
      "polarity_semantics must be UNSIGNED or BIPOLAR_AROUND_EXPLICIT_REFERENCE"
    );
  }

  const magnitude = value["magnitude_semantics"];
  assertObject(magnitude, "magnitude_semantics");
  if (magnitude["kind"] === "NONE") {
    assertExactKeys(magnitude, MAGNITUDE_NONE_FIELDS, "magnitude_semantics");
  } else if (magnitude["kind"] === "VERSIONED_POLICY") {
    assertExactKeys(magnitude, MAGNITUDE_VERSIONED_FIELDS, "magnitude_semantics");
    assertIdentifier(magnitude["policy_id"], "magnitude_semantics.policy_id");
  } else {
    throw new RelationshipFeatureDecisionSemanticsValidationErrorV0(
      "INVALID_MAGNITUDE_SEMANTICS",
      `unknown magnitude_semantics kind ${String(magnitude["kind"])}`
    );
  }

  const monotonicity = value["monotonicity_semantics"];
  if (!(RELATIONSHIP_FEATURE_MONOTONICITY_SEMANTICS_V0 as readonly string[]).includes(monotonicity as string)) {
    throw new RelationshipFeatureDecisionSemanticsValidationErrorV0(
      "INVALID_MONOTONICITY_SEMANTICS",
      `unknown monotonicity_semantics ${String(monotonicity)}`
    );
  }

  const role = value["decision_role"];
  if (!(RELATIONSHIP_FEATURE_DECISION_ROLES_V0 as readonly string[]).includes(role as string)) {
    throw new RelationshipFeatureDecisionSemanticsValidationErrorV0(
      "INVALID_DECISION_ROLE",
      `unknown decision_role ${String(role)}`
    );
  }

  const actionRelation = value["action_relation_requirement"];
  if (
    actionRelation !==
      "EXACT_FEATURE_STATE_X_EXACT_ACTION_X_EXACT_COUNTERPART_TYPED_RELATION_REQUIRED" &&
    actionRelation !== "DECISION_USE_FORBIDDEN"
  ) {
    throw new RelationshipFeatureDecisionSemanticsValidationErrorV0(
      "INVALID_ACTION_RELATION_REQUIREMENT",
      "unknown action_relation_requirement literal"
    );
  }

  if (value["counterpart_binding_requirement"] !== "EXACT_CANONICAL_COUNTERPART_REF") {
    throw new RelationshipFeatureDecisionSemanticsValidationErrorV0(
      "INVALID_COUNTERPART_BINDING_REQUIREMENT",
      "counterpart_binding_requirement must be EXACT_CANONICAL_COUNTERPART_REF"
    );
  }

  // §35 frozen authority literals — semantics never owns a numeric transform.
  if (value["direct_numeric_mapping_authorized"] !== false) {
    throw new RelationshipFeatureDecisionSemanticsValidationErrorV0(
      "INVALID_AUTHORITY_LITERAL",
      "direct_numeric_mapping_authorized must be exactly false"
    );
  }
  if (value["cross_feature_comparability"] !== "DENY") {
    throw new RelationshipFeatureDecisionSemanticsValidationErrorV0(
      "INVALID_AUTHORITY_LITERAL",
      "cross_feature_comparability must be exactly DENY"
    );
  }
  if (value["aggregation_eligibility"] !== "NONE_BY_DEFAULT") {
    throw new RelationshipFeatureDecisionSemanticsValidationErrorV0(
      "INVALID_AUTHORITY_LITERAL",
      "aggregation_eligibility must be exactly NONE_BY_DEFAULT"
    );
  }
  if (value["normalization_authority"] !== "NONE") {
    throw new RelationshipFeatureDecisionSemanticsValidationErrorV0(
      "INVALID_AUTHORITY_LITERAL",
      "normalization_authority must be exactly NONE"
    );
  }
  if (value["provenance_requirements"] !== "EXACT_CURRENT_CANONICAL_RELATIONSHIP_PROJECTION_V0") {
    throw new RelationshipFeatureDecisionSemanticsValidationErrorV0(
      "INVALID_AUTHORITY_LITERAL",
      "provenance_requirements must be EXACT_CURRENT_CANONICAL_RELATIONSHIP_PROJECTION_V0"
    );
  }

  // ---- cross-field rules (§9/§10/§11) -------------------------------------------

  const roleIsAdmissible = DECISION_ADMISSIBLE_ROLES_V0.has(role as string);

  if (roleIsAdmissible) {
    if (actionRelation !== "EXACT_FEATURE_STATE_X_EXACT_ACTION_X_EXACT_COUNTERPART_TYPED_RELATION_REQUIRED") {
      throw new RelationshipFeatureDecisionSemanticsValidationErrorV0(
        "ROLE_ACTION_RELATION_MISMATCH",
        "decision-admissible roles require the exact typed feature×action×counterpart action relation"
      );
    }
    if (monotonicity === "UNSPECIFIED") {
      throw new RelationshipFeatureDecisionSemanticsValidationErrorV0(
        "ADMISSIBLE_ROLE_MONOTONICITY_UNSPECIFIED",
        "decision-admissible roles must not declare UNSPECIFIED monotonicity"
      );
    }
  } else if (actionRelation !== "DECISION_USE_FORBIDDEN") {
    throw new RelationshipFeatureDecisionSemanticsValidationErrorV0(
      "ROLE_ACTION_RELATION_MISMATCH",
      "CONTEXT_ONLY / NOT_DECISION_ADMISSIBLE roles must forbid decision use"
    );
  }

  if (polarity === "BIPOLAR_AROUND_EXPLICIT_REFERENCE") {
    const reference = (neutralReference["reference"] ?? null) as RelationshipFeatureSemanticPointV0;
    if (
      reference.kind !== "EXPLICIT_VALUE" ||
      !((reference.value as number) > 0 && (reference.value as number) < 1)
    ) {
      throw new RelationshipFeatureDecisionSemanticsValidationErrorV0(
        "BIPOLAR_REFERENCE_NOT_EXPLICIT_INTERIOR_VALUE",
        "BIPOLAR_AROUND_EXPLICIT_REFERENCE requires an EXPLICIT_VALUE reference strictly interior to (0,1); no implicit 0.5"
      );
    }
  }
}

// ---- fingerprint (§13) -----------------------------------------------------------

/**
 * §13 Deterministic V0 contract fingerprint via hashEnvelope/JCS.
 *
 * Namespace: characteros-next/runtime/relationship-feature-decision-semantics-contract/v1
 *
 * Fingerprints the full canonical descriptor body. The contract has NO
 * self-referential fingerprint field. No wall clock, no random, no
 * environment, no host, no model, no vendor metadata.
 */
export async function deriveRelationshipFeatureDecisionSemanticsContractFingerprintV0(
  contract: RelationshipFeatureDecisionSemanticsContractV0
): Promise<HashV1> {
  validateRelationshipFeatureDecisionSemanticsContractV0(contract);
  return hashEnvelope(
    RELATIONSHIP_FEATURE_DECISION_SEMANTICS_CONTRACT_FINGERPRINT_PROJECTION,
    contract
  );
}

// ---- FIRST ADMITTED FEATURE: interaction familiarity (V1 slice) ----------------------
//
// RELATIONSHIP_REGISTERED_FEATURE_ADMISSION_V1 (INTERACTION_FAMILIARITY_ONLY):
// exactly ONE real source-controlled feature is statically admitted here.
// Meaning (normative): the bounded, policy-defined degree to which one exact
// counterpart has become an established participant in the subject's own
// admitted firsthand interaction history. Directional, subject- and
// counterpart-specific, unsigned, longitudinal, persistent. It is NOT trust,
// liking, affinity, safety, intimacy, dependence, loyalty, relationship
// quality, objective knowledge, predictive accuracy, memory availability or
// action utility — high familiarity stays compatible with low trust, negative
// affinity, danger and hostility. No Belief semantics, no raw cross-domain
// arithmetic, no action utility authorization (any action use still requires
// an exact future typed feature×action×counterpart relation).

export const INTERACTION_FAMILIARITY_DIMENSION_ID_V0: IdentifierV0 =
  "relationship_core_interaction_familiarity_v0" as IdentifierV0;

export const INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_ID_V0: IdentifierV0 =
  "relationship-interaction-familiarity-semantics-v0" as IdentifierV0;

export const INTERACTION_FAMILIARITY_QUANTITY_SEMANTICS_ID_V0: IdentifierV0 =
  "accumulated-firsthand-counterpart-familiarity-v0" as IdentifierV0;

/**
 * The exact admitted interaction-familiarity decision-semantics contract.
 * Endpoint semantics: 0 = no credited qualifying firsthand counterpart
 * interaction under the policy; 1 = familiarity credit saturation under V0 —
 * 1 MUST NOT mean perfect knowledge. Neutral NONE, reference LOWER_ENDPOINT,
 * polarity UNSIGNED, role MAGNITUDE_ONLY, monotonic non-decreasing
 * (INCREASING_QUANTITY — no decay/forgetting decrements). Deep frozen.
 */
export const INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_V0: RelationshipFeatureDecisionSemanticsContractV0 =
  {
    schema_version: RELATIONSHIP_FEATURE_DECISION_SEMANTICS_CONTRACT_SCHEMA_VERSION,
    feature_semantics_contract_id: INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_ID_V0,
    dimension_id: INTERACTION_FAMILIARITY_DIMENSION_ID_V0,
    domain_id: RELATIONSHIP_FEATURE_DECISION_DOMAIN_ID_V0,
    source_state_schema_version: RELATIONSHIP_FEATURE_DECISION_SOURCE_STATE_SCHEMA_VERSION_V0,
    input_numeric_type: "UNIT_INTERVAL_V0",
    input_range: {
      minimum: 0,
      maximum: 1,
      minimum_inclusive: true,
      maximum_inclusive: true,
      non_finite: "FORBIDDEN"
    },
    quantity_semantics_id: INTERACTION_FAMILIARITY_QUANTITY_SEMANTICS_ID_V0,
    lower_endpoint_semantics: {
      value: 0,
      semantics_id: "no-credited-qualifying-firsthand-counterpart-interaction-v0" as IdentifierV0
    },
    upper_endpoint_semantics: {
      value: 1,
      semantics_id: "familiarity-credit-saturation-v0" as IdentifierV0
    },
    neutral_or_reference_semantics: {
      neutral: { kind: "NONE" },
      reference: { kind: "LOWER_ENDPOINT" }
    },
    polarity_semantics: "UNSIGNED",
    magnitude_semantics: { kind: "NONE" },
    monotonicity_semantics: "INCREASING_QUANTITY",
    decision_role: "MAGNITUDE_ONLY",
    action_relation_requirement:
      "EXACT_FEATURE_STATE_X_EXACT_ACTION_X_EXACT_COUNTERPART_TYPED_RELATION_REQUIRED",
    counterpart_binding_requirement: "EXACT_CANONICAL_COUNTERPART_REF",
    direct_numeric_mapping_authorized: false,
    cross_feature_comparability: "DENY",
    aggregation_eligibility: "NONE_BY_DEFAULT",
    normalization_authority: "NONE",
    provenance_requirements: "EXACT_CURRENT_CANONICAL_RELATIONSHIP_PROJECTION_V0"
  };

function deepFreezeContract(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  if (Object.isFrozen(value)) return;
  Object.freeze(value);
  for (const key of Object.keys(value as Record<string, unknown>)) {
    deepFreezeContract((value as Record<string, unknown>)[key]);
  }
}
deepFreezeContract(INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_V0);

/**
 * PINNED exact semantics fingerprint (source-controlled fact): the
 * deterministic hashEnvelope/JCS derivation of
 * INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_V0 under
 * RELATIONSHIP_FEATURE_DECISION_SEMANTICS_CONTRACT_FINGERPRINT_PROJECTION.
 * The same hashEnvelope mechanism is used — no second fingerprint system.
 * The contract test suite asserts the pinned literal equals the live
 * derivation, so ANY contract edit breaks the pin deliberately.
 */
export const INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_FINGERPRINT_V0: HashV1 =
  "sha256:fcafcad1aba52ee640e83f73b1ec55d8fb9932515b470a324bd0033d9fb7f374" as HashV1;

// ---- static feature-semantics registry (§15/§16/§27) --------------------------------

/**
 * §15 Module-private static feature-semantics registry — exactly ONE admitted
 * real feature as of RELATIONSHIP_REGISTERED_FEATURE_ADMISSION_V1:
 * interaction familiarity. No register(), no add(), no set(), no delete(),
 * no mutable Map exposure, no dynamic registration, no plugin discovery, no
 * second feature.
 *
 * fingerprint = deterministic content integrity.
 * registry membership = CharacterOS decision-semantic authority.
 */
type RegisteredFeatureSemanticsEntryV0 = {
  readonly contract: RelationshipFeatureDecisionSemanticsContractV0;
  readonly feature_semantics_contract_fingerprint: HashV1;
};

const FEATURE_SEMANTICS_REGISTRY_V0: ReadonlyMap<string, RegisteredFeatureSemanticsEntryV0> =
  Object.freeze(
    new Map<string, RegisteredFeatureSemanticsEntryV0>([
      [
        INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_ID_V0,
        {
          contract: INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_V0,
          feature_semantics_contract_fingerprint:
            INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_FINGERPRINT_V0
        }
      ]
    ])
  );

/**
 * Informational frozen read-only view of registered feature identities.
 * Exactly ONE entry (interaction familiarity). Exposing this list grants no
 * mutation capability.
 */
export const REGISTERED_RELATIONSHIP_DECISION_FEATURE_IDS_V0: readonly string[] = Object.freeze([
  INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_ID_V0
]);

// ---- stable error taxonomy + resolution (§17/§18) --------------------------------

export type RelationshipFeatureDecisionSemanticsResolutionErrorCodeV0 =
  | "INVALID_CONTRACT"
  | "UNKNOWN_FEATURE_SEMANTICS"
  | "FEATURE_SEMANTICS_FINGERPRINT_MISMATCH"
  | "FEATURE_IDENTITY_MISMATCH";

export class RelationshipFeatureDecisionSemanticsResolutionErrorV0 extends Error {
  readonly code: RelationshipFeatureDecisionSemanticsResolutionErrorCodeV0;

  constructor(code: RelationshipFeatureDecisionSemanticsResolutionErrorCodeV0, detail: string) {
    super(`RELATIONSHIP_FEATURE_DECISION_SEMANTICS_RESOLUTION_${code}: ${detail}`);
    this.name = "RelationshipFeatureDecisionSemanticsResolutionErrorV0";
    this.code = code;
  }
}

/** Exact fail-closed resolution input binding the full feature semantic identity. */
export interface ResolveRelationshipFeatureDecisionSemanticsInputV0 {
  readonly domain_id: string;
  readonly source_state_schema_version: string;
  readonly dimension_id: string;
  readonly feature_semantics_contract_id: string;
  readonly feature_semantics_contract_fingerprint: string;
}

/**
 * §17 Minimum fail-closed resolver.
 *
 * Binds the exact feature semantic identity (domain, source schema, dimension,
 * contract id, contract fingerprint). Fixed literals RELATIONSHIP and
 * relationship-state-v0 are enforced; identity mismatches fail closed.
 *
 * The registry contains exactly ONE admitted real feature (interaction
 * familiarity); every other identity still fails closed as unknown/
 * unregistered — expected fail-closed behavior, not architecture failure.
 * No name special-casing, no fuzzy resolution.
 */
export function resolveRegisteredRelationshipFeatureDecisionSemanticsV0(
  input: ResolveRelationshipFeatureDecisionSemanticsInputV0
): RelationshipFeatureDecisionSemanticsContractV0 {
  if (
    input.domain_id !== RELATIONSHIP_FEATURE_DECISION_DOMAIN_ID_V0 ||
    input.source_state_schema_version !== RELATIONSHIP_FEATURE_DECISION_SOURCE_STATE_SCHEMA_VERSION_V0
  ) {
    throw new RelationshipFeatureDecisionSemanticsResolutionErrorV0(
      "FEATURE_IDENTITY_MISMATCH",
      "resolution requires exact domain_id RELATIONSHIP and source_state_schema_version relationship-state-v0"
    );
  }
  const entry = FEATURE_SEMANTICS_REGISTRY_V0.get(input.feature_semantics_contract_id);
  if (entry === undefined) {
    throw new RelationshipFeatureDecisionSemanticsResolutionErrorV0(
      "UNKNOWN_FEATURE_SEMANTICS",
      `no registered decision-semantic contract for feature_semantics_contract_id ${input.feature_semantics_contract_id} (registered: interaction familiarity only)`
    );
  }
  if (entry.contract.dimension_id !== input.dimension_id) {
    throw new RelationshipFeatureDecisionSemanticsResolutionErrorV0(
      "FEATURE_IDENTITY_MISMATCH",
      "dimension_id does not match the registered contract's bound dimension"
    );
  }
  if (entry.feature_semantics_contract_fingerprint !== input.feature_semantics_contract_fingerprint) {
    throw new RelationshipFeatureDecisionSemanticsResolutionErrorV0(
      "FEATURE_SEMANTICS_FINGERPRINT_MISMATCH",
      `feature_semantics_contract_fingerprint does not match the registered fingerprint for ${input.feature_semantics_contract_id}`
    );
  }
  return entry.contract;
}

// ---- default decision admission (§19/§20) -----------------------------------------

/**
 * §19/§20 Tagged, NON-NUMERIC decision-admission result. There is NO numeric
 * field: unregistered canonical features are never coerced into a value.
 */
export type RelationshipFeatureDecisionAdmissionV0 = {
  readonly decision_admission: "NOT_DECISION_ADMISSIBLE";
  readonly reason: "UNREGISTERED_FEATURE";
};

/**
 * §19 Read-only decision-admission query for decision enumeration.
 *
 * Storage admission (a canonical opaque dimension may exist in
 * relationship-state-v0) is explicitly DISTINCT from decision admission.
 *
 * Even for the admitted interaction-familiarity feature, DECISION admission
 * stays closed: decision-admissible use requires the exact typed
 * feature×action×counterpart relation, and no action-relation provider exists
 * yet. This query never throws merely because an opaque canonical feature
 * exists, never converts a value to zero, and never manufactures semantics.
 */
export function queryRelationshipFeatureDecisionAdmissionV0(
  dimension_id: string
): RelationshipFeatureDecisionAdmissionV0 {
  // Decision use is forbidden for every dimension: no typed action relation
  // exists. The exact opaque dimension_id is deliberately not pattern-matched
  // or coerced.
  void dimension_id;
  return { decision_admission: "NOT_DECISION_ADMISSIBLE", reason: "UNREGISTERED_FEATURE" };
}

// ---- local helpers -----------------------------------------------------------------
