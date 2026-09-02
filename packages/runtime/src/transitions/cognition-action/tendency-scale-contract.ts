/**
 * Tendency Scale Contract Foundation V0 — governance/foundation for describing
 * and authorizing domain tendency scales
 * (TENDENCY_SCALE_CONTRACT_V0 ARCHITECTURE_APPROVED).
 *
 * Establishes:
 *   - TendencyScaleContractV0 closed schema
 *   - frozen Belief action-alignment scale contract
 *   - deterministic fingerprints (hashEnvelope / JCS)
 *   - CharacterOS-owned closed static scale registry
 *   - registry-based scale authority
 *   - default-deny cross-domain comparability foundation
 *
 * This slice DOES NOT implement:
 *   - a second domain scale
 *   - Relationship numeric tendency
 *   - Personality numeric tendency
 *   - Affect/Fear tendency
 *   - cross-domain arithmetic
 *   - weights / calibration / composition arithmetic
 *   - final cross-domain arbitration
 *   - execution / model calls
 *
 * Canonical status: VERSIONED_RUNTIME_POLICY_NON_SUBJECT_STATE.
 *   No SubjectState mutation. No revision. No trace. No logical-time advance.
 *   No memory mutation.
 */

import type { HashV1, IdentifierV0 } from "@characteros-next/subject-core";
import { hashEnvelope } from "@characteros-next/subject-core";

import {
  BELIEF_DECISION_INTEGRATION_POLICY_ID_V0,
  deriveBeliefDecisionIntegrationPolicyFingerprintV0
} from "./belief-decision-integration-policy.js";

// ---- identity literals (§4/§6) ---------------------------------------------------

export const TENDENCY_SCALE_CONTRACT_SCHEMA_VERSION =
  "tendency-scale-contract-v0" as const;

export const TENDENCY_SCALE_CONTRACT_FINGERPRINT_PROJECTION =
  "characteros-next/runtime/tendency-scale-contract/v1" as const;

export const BELIEF_ACTION_ALIGNMENT_SCALE_ID_V0 =
  "belief-action-alignment-scale-v0" as const;

export const BELIEF_ACTION_ALIGNMENT_SCALE_FINGERPRINT_PROJECTION =
  "characteros-next/runtime/belief-action-alignment-scale/v1" as const;

export const TENDENCY_COMPARABILITY_CONTRACT_SCHEMA_VERSION =
  "tendency-comparability-contract-v0" as const;

export const TENDENCY_COMPARABILITY_CONTRACT_FINGERPRINT_PROJECTION =
  "characteros-next/runtime/tendency-comparability-contract/v1" as const;

// ---- cross-domain operation enum (§12) ------------------------------------------

/**
 * Cross-domain tendency operations enumerable for future comparability
 * contracts. No operation has authority merely by existing in this enum —
 * authorization comes exclusively from a registered
 * TendencyComparabilityContractV0.
 */
export const CROSS_DOMAIN_OPERATIONS_V0 = Object.freeze([
  "COMPARE_ORDER",
  "ADD",
  "SUBTRACT_CANCEL",
  "MEAN",
  "MAX",
  "TYPED_OVERRIDE",
  "TYPED_VETO",
  "APPLY_SHARED_THRESHOLD"
] as const);

export type CrossDomainOperationV0 = (typeof CROSS_DOMAIN_OPERATIONS_V0)[number];

// ---- TendencyScaleContractV0 (§4) ------------------------------------------------

/**
 * Normalization semantic union: either NATIVE_IDENTITY (the scale's native
 * representation IS its normalized form — no policy), or DOMAIN_NORMALIZED
 * (referencing a specific domain normalization policy by id + fingerprint).
 */
export type TendencyScaleNormalizationSemanticsV0 =
  | {
      readonly kind: "NATIVE_IDENTITY";
      readonly policy_id: null;
      readonly policy_fingerprint: null;
    }
  | {
      readonly kind: "DOMAIN_NORMALIZED";
      readonly policy_id: IdentifierV0;
      readonly policy_fingerprint: HashV1;
    };

/**
 * TendencyScaleContractV0 — closed schema describing the numeric and semantic
 * contract of a domain tendency scale.
 *
 * Closed schema: no extra structural fields, no free-form authority.
 */
export interface TendencyScaleContractV0 {
  readonly schema_version: typeof TENDENCY_SCALE_CONTRACT_SCHEMA_VERSION;
  readonly scale_contract_id: IdentifierV0;

  readonly domain_id: IdentifierV0;
  readonly domain_policy_id: IdentifierV0;
  readonly domain_policy_fingerprint: HashV1;

  readonly quantity_semantics_id: IdentifierV0;
  readonly action_binding_semantics: "EXACT_ACTION_TUPLE";
  readonly numeric_representation: "FINITE_IEEE_754_BINARY64";

  readonly numeric_range: {
    readonly minimum: number;
    readonly maximum: number;
    readonly minimum_inclusive: boolean;
    readonly maximum_inclusive: boolean;
    readonly non_finite: "FORBIDDEN";
    readonly negative_zero: "NORMALIZE_TO_POSITIVE_ZERO";
  };

  readonly neutral_point: number;
  readonly magnitude_reference_point: "ZERO" | "NEUTRAL_POINT";

  readonly positive_direction_semantics: IdentifierV0;
  readonly negative_direction_semantics: IdentifierV0;
  readonly magnitude_semantics: IdentifierV0;
  readonly zero_semantics: IdentifierV0;
  readonly saturation_semantics: IdentifierV0;
  readonly aggregation_semantics: IdentifierV0;

  readonly normalization_semantics: TendencyScaleNormalizationSemanticsV0;

  readonly intrinsic_comparability:
    "SAME_DOMAIN_SAME_SCALE_SAME_BOUND_SNAPSHOT_ONLY";

  readonly provenance_requirements: "FULL_BOUND_SOURCE";
}

// ---- validation (§5) -------------------------------------------------------------

/** Stable fail-closed validation codes for scale contract validation. */
export type TendencyScaleContractValidationErrorCodeV0 =
  | "SCHEMA_VERSION_MISMATCH"
  | "INVALID_IDENTIFIER"
  | "INVALID_HASH"
  | "INVALID_ACTION_BINDING_SEMANTICS"
  | "INVALID_NUMERIC_REPRESENTATION"
  | "INVALID_NUMERIC_RANGE"
  | "INVALID_NON_FINITE_POLICY"
  | "INVALID_NEGATIVE_ZERO_POLICY"
  | "INVALID_MAGNITUDE_REFERENCE_POINT"
  | "INVALID_INTRINSIC_COMPARABILITY"
  | "INVALID_PROVENANCE_REQUIREMENTS"
  | "INVALID_NORMALIZATION_KIND"
  | "NEUTRAL_POINT_OUT_OF_RANGE"
  | "EXTRA_FIELDS_REJECTED"
  | "EXPECTED_OBJECT";

export class TendencyScaleContractValidationErrorV0 extends Error {
  readonly code: TendencyScaleContractValidationErrorCodeV0;

  constructor(code: TendencyScaleContractValidationErrorCodeV0, detail: string) {
    super(`TENDENCY_SCALE_CONTRACT_${code}: ${detail}`);
    this.name = "TendencyScaleContractValidationErrorV0";
    this.code = code;
  }
}

/**
 * §5.2 IdentifierV0 grammar (mirrors subject-core scalar validator — local
 * copy to keep this file self-contained and avoid adding new exports there).
 */
const IDENTIFIER_RE = /^[A-Za-z0-9][A-Za-z0-9._~-]{0,127}$/;
const HASH_RE = /^sha256:[0-9a-f]{64}$/;

/** Frozen ordered set of TendencyScaleContractV0 top-level field names. */
const SCALE_CONTRACT_FIELDS_V0: readonly string[] = [
  "schema_version",
  "scale_contract_id",
  "domain_id",
  "domain_policy_id",
  "domain_policy_fingerprint",
  "quantity_semantics_id",
  "action_binding_semantics",
  "numeric_representation",
  "numeric_range",
  "neutral_point",
  "magnitude_reference_point",
  "positive_direction_semantics",
  "negative_direction_semantics",
  "magnitude_semantics",
  "zero_semantics",
  "saturation_semantics",
  "aggregation_semantics",
  "normalization_semantics",
  "intrinsic_comparability",
  "provenance_requirements"
];

const NUMERIC_RANGE_FIELDS_V0: readonly string[] = [
  "minimum",
  "maximum",
  "minimum_inclusive",
  "maximum_inclusive",
  "non_finite",
  "negative_zero"
];

const NORMALIZATION_NATIVE_FIELDS: readonly string[] = [
  "kind",
  "policy_id",
  "policy_fingerprint"
];
const NORMALIZATION_DOMAIN_FIELDS: readonly string[] = [
  "kind",
  "policy_id",
  "policy_fingerprint"
];

function assertIdentifier(v: unknown, label: string): asserts v is IdentifierV0 {
  if (typeof v !== "string" || !IDENTIFIER_RE.test(v)) {
    throw new TendencyScaleContractValidationErrorV0(
      "INVALID_IDENTIFIER",
      `${label}: invalid IdentifierV0`
    );
  }
}

function assertHash(v: unknown, label: string): asserts v is HashV1 {
  if (typeof v !== "string" || !HASH_RE.test(v)) {
    throw new TendencyScaleContractValidationErrorV0(
      "INVALID_HASH",
      `${label}: invalid HashV1`
    );
  }
}

function assertObject(v: unknown, label: string): asserts v is Record<string, unknown> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) {
    throw new TendencyScaleContractValidationErrorV0(
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
    throw new TendencyScaleContractValidationErrorV0(
      "EXTRA_FIELDS_REJECTED",
      `${label}: unexpected keys; expected exactly ${allowedSorted.join(",")} got ${keys.join(",")}`
    );
  }
  for (let i = 0; i < keys.length; i++) {
    if (keys[i] !== allowedSorted[i]) {
      throw new TendencyScaleContractValidationErrorV0(
        "EXTRA_FIELDS_REJECTED",
        `${label}: unexpected key ${keys[i]}`
      );
    }
  }
}

/**
 * Deterministic closed-schema validation of TendencyScaleContractV0.
 *
 * Validates exact schema, finite numeric endpoints, neutral point within
 * declared range, inclusive semantics, frozen literal fields, identifier/hash
 * format, and rejects unknown/extra structural fields.
 *
 * No repair. No coercion. No rounding.
 */
export function validateTendencyScaleContractV0(
  value: unknown
): asserts value is TendencyScaleContractV0 {
  assertObject(value, "scale_contract");
  assertExactKeys(value, SCALE_CONTRACT_FIELDS_V0, "scale_contract");

  if (value["schema_version"] !== TENDENCY_SCALE_CONTRACT_SCHEMA_VERSION) {
    throw new TendencyScaleContractValidationErrorV0(
      "SCHEMA_VERSION_MISMATCH",
      `expected ${TENDENCY_SCALE_CONTRACT_SCHEMA_VERSION}`
    );
  }

  assertIdentifier(value["scale_contract_id"], "scale_contract_id");
  assertIdentifier(value["domain_id"], "domain_id");
  assertIdentifier(value["domain_policy_id"], "domain_policy_id");
  assertHash(value["domain_policy_fingerprint"], "domain_policy_fingerprint");
  assertIdentifier(value["quantity_semantics_id"], "quantity_semantics_id");

  if (value["action_binding_semantics"] !== "EXACT_ACTION_TUPLE") {
    throw new TendencyScaleContractValidationErrorV0(
      "INVALID_ACTION_BINDING_SEMANTICS",
      "must be EXACT_ACTION_TUPLE"
    );
  }

  if (value["numeric_representation"] !== "FINITE_IEEE_754_BINARY64") {
    throw new TendencyScaleContractValidationErrorV0(
      "INVALID_NUMERIC_REPRESENTATION",
      "must be FINITE_IEEE_754_BINARY64"
    );
  }

  // numeric_range
  const range = value["numeric_range"];
  assertObject(range, "numeric_range");
  assertExactKeys(range, NUMERIC_RANGE_FIELDS_V0, "numeric_range");

  if (typeof range["minimum"] !== "number" || !Number.isFinite(range["minimum"])) {
    throw new TendencyScaleContractValidationErrorV0(
      "INVALID_NUMERIC_RANGE",
      "numeric_range.minimum must be finite number"
    );
  }
  if (typeof range["maximum"] !== "number" || !Number.isFinite(range["maximum"])) {
    throw new TendencyScaleContractValidationErrorV0(
      "INVALID_NUMERIC_RANGE",
      "numeric_range.maximum must be finite number"
    );
  }
  if (range["minimum"] > range["maximum"]) {
    throw new TendencyScaleContractValidationErrorV0(
      "INVALID_NUMERIC_RANGE",
      "numeric_range.minimum > maximum"
    );
  }
  if (typeof range["minimum_inclusive"] !== "boolean") {
    throw new TendencyScaleContractValidationErrorV0(
      "INVALID_NUMERIC_RANGE",
      "numeric_range.minimum_inclusive must be boolean"
    );
  }
  if (typeof range["maximum_inclusive"] !== "boolean") {
    throw new TendencyScaleContractValidationErrorV0(
      "INVALID_NUMERIC_RANGE",
      "numeric_range.maximum_inclusive must be boolean"
    );
  }
  if (range["non_finite"] !== "FORBIDDEN") {
    throw new TendencyScaleContractValidationErrorV0(
      "INVALID_NON_FINITE_POLICY",
      "numeric_range.non_finite must be FORBIDDEN"
    );
  }
  if (range["negative_zero"] !== "NORMALIZE_TO_POSITIVE_ZERO") {
    throw new TendencyScaleContractValidationErrorV0(
      "INVALID_NEGATIVE_ZERO_POLICY",
      "numeric_range.negative_zero must be NORMALIZE_TO_POSITIVE_ZERO"
    );
  }

  // neutral_point
  const neutral = value["neutral_point"];
  if (typeof neutral !== "number" || !Number.isFinite(neutral)) {
    throw new TendencyScaleContractValidationErrorV0(
      "INVALID_NUMERIC_RANGE",
      "neutral_point must be finite number"
    );
  }
  // inclusive semantics respected
  const minVal = range["minimum"] as number;
  const maxVal = range["maximum"] as number;
  const minInc = range["minimum_inclusive"] as boolean;
  const maxInc = range["maximum_inclusive"] as boolean;

  if (neutral < minVal || neutral > maxVal) {
    throw new TendencyScaleContractValidationErrorV0(
      "NEUTRAL_POINT_OUT_OF_RANGE",
      "neutral_point outside numeric_range"
    );
  }
  if (neutral === minVal && !minInc) {
    throw new TendencyScaleContractValidationErrorV0(
      "NEUTRAL_POINT_OUT_OF_RANGE",
      "neutral_point equals exclusive minimum"
    );
  }
  if (neutral === maxVal && !maxInc) {
    throw new TendencyScaleContractValidationErrorV0(
      "NEUTRAL_POINT_OUT_OF_RANGE",
      "neutral_point equals exclusive maximum"
    );
  }

  const magRef = value["magnitude_reference_point"];
  if (magRef !== "ZERO" && magRef !== "NEUTRAL_POINT") {
    throw new TendencyScaleContractValidationErrorV0(
      "INVALID_MAGNITUDE_REFERENCE_POINT",
      "magnitude_reference_point must be ZERO or NEUTRAL_POINT"
    );
  }

  assertIdentifier(value["positive_direction_semantics"], "positive_direction_semantics");
  assertIdentifier(value["negative_direction_semantics"], "negative_direction_semantics");
  assertIdentifier(value["magnitude_semantics"], "magnitude_semantics");
  assertIdentifier(value["zero_semantics"], "zero_semantics");
  assertIdentifier(value["saturation_semantics"], "saturation_semantics");
  assertIdentifier(value["aggregation_semantics"], "aggregation_semantics");

  // normalization_semantics union
  const norm = value["normalization_semantics"];
  assertObject(norm, "normalization_semantics");

  const normKind = norm["kind"];
  if (normKind === "NATIVE_IDENTITY") {
    assertExactKeys(norm, NORMALIZATION_NATIVE_FIELDS, "normalization_semantics");
    if (norm["policy_id"] !== null) {
      throw new TendencyScaleContractValidationErrorV0(
        "INVALID_NORMALIZATION_KIND",
        "NATIVE_IDENTITY policy_id must be null"
      );
    }
    if (norm["policy_fingerprint"] !== null) {
      throw new TendencyScaleContractValidationErrorV0(
        "INVALID_NORMALIZATION_KIND",
        "NATIVE_IDENTITY policy_fingerprint must be null"
      );
    }
  } else if (normKind === "DOMAIN_NORMALIZED") {
    assertExactKeys(norm, NORMALIZATION_DOMAIN_FIELDS, "normalization_semantics");
    assertIdentifier(norm["policy_id"], "normalization_semantics.policy_id");
    assertHash(norm["policy_fingerprint"], "normalization_semantics.policy_fingerprint");
  } else {
    throw new TendencyScaleContractValidationErrorV0(
      "INVALID_NORMALIZATION_KIND",
      `unknown normalization kind: ${String(normKind)}`
    );
  }

  if (
    value["intrinsic_comparability"] !==
    "SAME_DOMAIN_SAME_SCALE_SAME_BOUND_SNAPSHOT_ONLY"
  ) {
    throw new TendencyScaleContractValidationErrorV0(
      "INVALID_INTRINSIC_COMPARABILITY",
      "intrinsic_comparability must be SAME_DOMAIN_SAME_SCALE_SAME_BOUND_SNAPSHOT_ONLY"
    );
  }

  if (value["provenance_requirements"] !== "FULL_BOUND_SOURCE") {
    throw new TendencyScaleContractValidationErrorV0(
      "INVALID_PROVENANCE_REQUIREMENTS",
      "provenance_requirements must be FULL_BOUND_SOURCE"
    );
  }
}

// ---- fingerprint (§6) -----------------------------------------------------------

/**
 * Compute the descriptor body used for fingerprinting.
 * The descriptor does NOT embed its own fingerprint recursively.
 */
function scaleContractFingerprintBody(
  contract: TendencyScaleContractV0
): TendencyScaleContractV0 {
  // The entire TendencyScaleContractV0 descriptor is the canonical body
  // (it has no self-referential fingerprint field).
  return contract;
}

/**
 * §6 Deterministic V0 scale contract fingerprint via hashEnvelope/JCS.
 *
 * Namespace: characteros-next/runtime/tendency-scale-contract/v1
 *
 * Fingerprints the canonical descriptor. No wall clock, no random, no
 * environment, no host, no model vendor.
 */
export async function deriveTendencyScaleContractFingerprintV0(
  contract: TendencyScaleContractV0
): Promise<HashV1> {
  validateTendencyScaleContractV0(contract);
  return hashEnvelope(
    TENDENCY_SCALE_CONTRACT_FINGERPRINT_PROJECTION,
    scaleContractFingerprintBody(contract)
  );
}

// ---- Belief scale contract (§7/§8) -----------------------------------------------

/**
 * §7 Belief action-alignment scale — CharacterOS-owned registered contract.
 *
 * Built lazily (once, at first access) because domain_policy_fingerprint is
 * derived via async hashEnvelope. The result is deep-frozen.
 */
interface BeliefScaleRegistrationV0 {
  readonly contract: TendencyScaleContractV0;
  readonly scale_contract_fingerprint: HashV1;
  readonly belief_scale_identity_fingerprint: HashV1;
}

let beliefScaleCache: BeliefScaleRegistrationV0 | null = null;

async function buildBeliefScaleContractV0(): Promise<BeliefScaleRegistrationV0> {
  const policyFingerprint = await deriveBeliefDecisionIntegrationPolicyFingerprintV0();

  const contract: TendencyScaleContractV0 = {
    schema_version: TENDENCY_SCALE_CONTRACT_SCHEMA_VERSION,
    scale_contract_id:
      BELIEF_ACTION_ALIGNMENT_SCALE_ID_V0 as IdentifierV0,
    domain_id: "BELIEF" as IdentifierV0,
    domain_policy_id:
      BELIEF_DECISION_INTEGRATION_POLICY_ID_V0 as IdentifierV0,
    domain_policy_fingerprint: policyFingerprint,
    quantity_semantics_id:
      "BELIEF_ACTION_ALIGNMENT_NOT_UTILITY" as IdentifierV0,
    action_binding_semantics: "EXACT_ACTION_TUPLE",
    numeric_representation: "FINITE_IEEE_754_BINARY64",
    numeric_range: {
      minimum: -1,
      maximum: 1,
      minimum_inclusive: true,
      maximum_inclusive: true,
      non_finite: "FORBIDDEN",
      negative_zero: "NORMALIZE_TO_POSITIVE_ZERO"
    },
    neutral_point: 0,
    magnitude_reference_point: "ZERO",
    positive_direction_semantics:
      "NET_BELIEF_ALIGNMENT_TOWARD_EXACT_ACTION" as IdentifierV0,
    negative_direction_semantics:
      "NET_BELIEF_ALIGNMENT_AGAINST_EXACT_ACTION" as IdentifierV0,
    magnitude_semantics:
      "ABSOLUTE_NET_DIRECTIONAL_MEAN_ALIGNMENT_NOT_CONFIDENCE" as IdentifierV0,
    zero_semantics:
      "NO_NET_DIRECTIONAL_ALIGNMENT_EMPTY_OR_BALANCED_NOT_DOMAIN_ABSENCE" as IdentifierV0,
    saturation_semantics:
      "BELIEF_ALIGNMENT_ENDPOINT_NOT_UTILITY_CERTAINTY_OR_REWARD" as IdentifierV0,
    aggregation_semantics:
      "DIRECTIONAL_ARITHMETIC_MEAN_EXCLUDING_IRRELEVANT_EMPTY_ZERO" as IdentifierV0,
    normalization_semantics: {
      kind: "NATIVE_IDENTITY",
      policy_id: null,
      policy_fingerprint: null
    },
    intrinsic_comparability:
      "SAME_DOMAIN_SAME_SCALE_SAME_BOUND_SNAPSHOT_ONLY",
    provenance_requirements: "FULL_BOUND_SOURCE"
  };

  deepFreeze(contract);

  // Validate the frozen descriptor.
  validateTendencyScaleContractV0(contract);

  const genericFingerprint = await hashEnvelope(
    TENDENCY_SCALE_CONTRACT_FINGERPRINT_PROJECTION,
    scaleContractFingerprintBody(contract)
  );

  // §8 Belief-specific identity fingerprint under the Belief namespace.
  // This is a separate stable identity fingerprint — it does NOT replace
  // the generic scale-contract fingerprint (content integrity). The registry
  // uses both: registry membership = authority, fingerprints = integrity.
  const identityFingerprint = await hashEnvelope(
    BELIEF_ACTION_ALIGNMENT_SCALE_FINGERPRINT_PROJECTION,
    scaleContractFingerprintBody(contract)
  );

  return {
    contract,
    scale_contract_fingerprint: genericFingerprint,
    belief_scale_identity_fingerprint: identityFingerprint
  };
}

/**
 * §8 Get the canonical frozen Belief action-alignment scale contract.
 *
 * Authority model:
 *   - generic fingerprint = content integrity (scale-contract namespace)
 *   - identity fingerprint = stable Belief-scale identity (belief namespace)
 *   - registry membership = authority
 *
 * The two fingerprints are NOT contradictory authorities: the generic
 * fingerprint confirms the descriptor conforms to TendencyScaleContractV0;
 * the identity fingerprint is the stable Belief-scale name under which
 * this descriptor is registered. Resolution requires both to match AND
 * registry membership.
 */
export async function getBeliefActionAlignmentScaleContractV0(): Promise<{
  readonly contract: TendencyScaleContractV0;
  readonly scale_contract_fingerprint: HashV1;
  readonly belief_scale_identity_fingerprint: HashV1;
}> {
  if (beliefScaleCache === null) {
    beliefScaleCache = await buildBeliefScaleContractV0();
  }
  return beliefScaleCache;
}

// ---- static registry (§9/§10/§11) -----------------------------------------------

/**
 * §9 CharacterOS-owned closed static registry — module-private, never
 * exposed directly. Contains ONLY belief-action-alignment-scale-v0.
 *
 * No register(), no add(), no mutation, no plugin discovery, no dynamic
 * extension, no caller-provided descriptors.
 */
type RegisteredScaleEntryV0 = {
  readonly contract: TendencyScaleContractV0;
  readonly scale_contract_fingerprint: HashV1;
  readonly belief_scale_identity_fingerprint: HashV1 | null;
};

const REGISTERED_SCALE_IDS_V0 = [BELIEF_ACTION_ALIGNMENT_SCALE_ID_V0] as const;

// Lazy — built once on first resolution to avoid top-level await.
let registryCache: Map<string, RegisteredScaleEntryV0> | null = null;

async function getRegistry(): Promise<Map<string, RegisteredScaleEntryV0>> {
  if (registryCache === null) {
    const belief = await getBeliefActionAlignmentScaleContractV0();
    const map = new Map<string, RegisteredScaleEntryV0>();
    map.set(BELIEF_ACTION_ALIGNMENT_SCALE_ID_V0, {
      contract: belief.contract,
      scale_contract_fingerprint: belief.scale_contract_fingerprint,
      belief_scale_identity_fingerprint: belief.belief_scale_identity_fingerprint
    });
    // Freeze internal mutation surfaces — the map itself is module-private
    // and never returned, but we defensively seal its mutation surface.
    Object.freeze(map);
    registryCache = map;
  }
  return registryCache;
}

/** Input shape for registry resolution. */
export interface ResolveRegisteredTendencyScaleInputV0 {
  readonly scale_contract_id: string | IdentifierV0;
  readonly scale_contract_fingerprint: string | HashV1;
}

/**
 * §10/§11 Safe read-only public resolution surface.
 *
 * Resolves from the private static registry. Compares exact ID AND exact
 * registered fingerprint. Returns the canonical frozen descriptor on match.
 *
 * Unknown ID → fail closed.
 * Fingerprint mismatch → fail closed.
 * Caller structural lookalike → no authority (not in registry).
 *
 * Does NOT expose the registry Map.
 */
export async function resolveRegisteredTendencyScaleContractV0(
  input: ResolveRegisteredTendencyScaleInputV0
): Promise<TendencyScaleContractV0> {
  const registry = await getRegistry();
  const id = String(input.scale_contract_id);
  const entry = registry.get(id);
  if (entry === undefined) {
    throw new TendencyScaleContractResolutionErrorV0(
      "UNKNOWN_SCALE",
      `scale_contract_id not registered: ${id}`
    );
  }
  if (String(input.scale_contract_fingerprint) !== entry.scale_contract_fingerprint) {
    throw new TendencyScaleContractResolutionErrorV0(
      "FINGERPRINT_MISMATCH",
      `scale_contract_fingerprint does not match registered fingerprint for ${id}`
    );
  }
  return entry.contract;
}

export type TendencyScaleContractResolutionErrorCodeV0 =
  | "UNKNOWN_SCALE"
  | "FINGERPRINT_MISMATCH";

export class TendencyScaleContractResolutionErrorV0 extends Error {
  readonly code: TendencyScaleContractResolutionErrorCodeV0;

  constructor(code: TendencyScaleContractResolutionErrorCodeV0, detail: string) {
    super(`TENDENCY_SCALE_RESOLUTION_${code}: ${detail}`);
    this.name = "TendencyScaleContractResolutionErrorV0";
    this.code = code;
  }
}

// ---- comparability contract foundation (§13/§14) --------------------------------

/**
 * §13 Participant scale reference in a comparability contract.
 */
export interface TendencyComparabilityParticipantV0 {
  readonly domain_id: IdentifierV0;
  readonly scale_contract_id: IdentifierV0;
  readonly scale_contract_fingerprint: HashV1;
}

/**
 * §13 TendencyComparabilityContractV0 — architecture-approved TYPE only.
 *
 * Describes an authorized set of cross-domain tendency operations between
 * exactly the listed participant scales.
 *
 * NO concrete cross-domain comparability contract is registered in this
 * slice. This type is the foundation; authorization is exclusively via
 * future registered comparability contracts.
 */
export interface TendencyComparabilityContractV0 {
  readonly schema_version: typeof TENDENCY_COMPARABILITY_CONTRACT_SCHEMA_VERSION;
  readonly comparability_contract_id: IdentifierV0;

  readonly participant_scales: readonly TendencyComparabilityParticipantV0[];
  readonly participant_set_semantics: "EXACT_SET";

  readonly authorized_operations: readonly CrossDomainOperationV0[];

  readonly snapshot_policy: "SAME_BOUND_SNAPSHOT";
  readonly action_space_policy: "EXACT_SAME_FINGERPRINT";
  readonly unlisted_operation_policy: "DENY";
}

// ---- comparability contract validation + fingerprint (§13/§14) -----------------

/** Stable fail-closed validation codes for comparability contract validation. */
export type TendencyComparabilityContractValidationErrorCodeV0 =
  | "SCHEMA_VERSION_MISMATCH"
  | "INVALID_IDENTIFIER"
  | "INVALID_HASH"
  | "INVALID_PARTICIPANT_SCALES"
  | "DUPLICATE_PARTICIPANT_SCALE"
  | "INVALID_AUTHORIZED_OPERATIONS"
  | "INVALID_PARTICIPANT_SET_SEMANTICS"
  | "INVALID_SNAPSHOT_POLICY"
  | "INVALID_ACTION_SPACE_POLICY"
  | "INVALID_UNLISTED_OPERATION_POLICY"
  | "EXTRA_FIELDS_REJECTED"
  | "EXPECTED_OBJECT";

export class TendencyComparabilityContractValidationErrorV0 extends Error {
  readonly code: TendencyComparabilityContractValidationErrorCodeV0;

  constructor(code: TendencyComparabilityContractValidationErrorCodeV0, detail: string) {
    super(`TENDENCY_COMPARABILITY_CONTRACT_${code}: ${detail}`);
    this.name = "TendencyComparabilityContractValidationErrorV0";
    this.code = code;
  }
}

/** Frozen ordered set of TendencyComparabilityContractV0 top-level field names. */
const COMPARABILITY_CONTRACT_FIELDS_V0: readonly string[] = [
  "schema_version",
  "comparability_contract_id",
  "participant_scales",
  "participant_set_semantics",
  "authorized_operations",
  "snapshot_policy",
  "action_space_policy",
  "unlisted_operation_policy"
];

const PARTICIPANT_FIELDS_V0: readonly string[] = [
  "domain_id",
  "scale_contract_id",
  "scale_contract_fingerprint"
];

function comparabilityError(
  code: TendencyComparabilityContractValidationErrorCodeV0,
  detail: string
): never {
  throw new TendencyComparabilityContractValidationErrorV0(code, detail);
}

/**
 * §13 Deterministic closed-schema validation of TendencyComparabilityContractV0.
 *
 * TYPE/VALIDATION FOUNDATION ONLY — no concrete cross-domain comparability
 * contract is registered in this slice, and validation confers no authority by
 * itself (registry membership = authority).
 *
 * No repair. No coercion. No rounding.
 */
export function validateTendencyComparabilityContractV0(
  value: unknown
): asserts value is TendencyComparabilityContractV0 {
  assertObject(value, "comparability_contract");
  assertExactKeys(value, COMPARABILITY_CONTRACT_FIELDS_V0, "comparability_contract");

  if (value["schema_version"] !== TENDENCY_COMPARABILITY_CONTRACT_SCHEMA_VERSION) {
    comparabilityError(
      "SCHEMA_VERSION_MISMATCH",
      `expected ${TENDENCY_COMPARABILITY_CONTRACT_SCHEMA_VERSION}`
    );
  }

  assertIdentifier(value["comparability_contract_id"], "comparability_contract_id");

  const participants = value["participant_scales"];
  if (!Array.isArray(participants) || participants.length === 0) {
    comparabilityError(
      "INVALID_PARTICIPANT_SCALES",
      "participant_scales must be a non-empty array"
    );
  }
  const seenParticipants = new Set<string>();
  for (let i = 0; i < participants.length; i++) {
    const participant = participants[i];
    assertObject(participant, `participant_scales[${i}]`);
    assertExactKeys(participant, PARTICIPANT_FIELDS_V0, `participant_scales[${i}]`);
    assertIdentifier(participant["domain_id"], `participant_scales[${i}].domain_id`);
    assertIdentifier(participant["scale_contract_id"], `participant_scales[${i}].scale_contract_id`);
    assertHash(
      participant["scale_contract_fingerprint"],
      `participant_scales[${i}].scale_contract_fingerprint`
    );
    const participantKey = [
      participant["domain_id"] as string,
      participant["scale_contract_id"] as string,
      participant["scale_contract_fingerprint"] as string
    ].join("\u0000");
    if (seenParticipants.has(participantKey)) {
      comparabilityError(
        "DUPLICATE_PARTICIPANT_SCALE",
        `participant_scales[${i}]: duplicate EXACT_SET participant ${participantKey}`
      );
    }
    seenParticipants.add(participantKey);
  }

  if (value["participant_set_semantics"] !== "EXACT_SET") {
    comparabilityError("INVALID_PARTICIPANT_SET_SEMANTICS", "must be EXACT_SET");
  }

  const operations = value["authorized_operations"];
  if (!Array.isArray(operations)) {
    comparabilityError("INVALID_AUTHORIZED_OPERATIONS", "authorized_operations must be an array");
  }
  const seenOperations = new Set<string>();
  for (let i = 0; i < operations.length; i++) {
    const operation = operations[i];
    const known = CROSS_DOMAIN_OPERATIONS_V0.find((candidate) => candidate === operation);
    if (known === undefined) {
      comparabilityError(
        "INVALID_AUTHORIZED_OPERATIONS",
        `authorized_operations[${i}]: unknown cross-domain operation ${String(operation)}`
      );
    }
    if (seenOperations.has(known as string)) {
      comparabilityError(
        "INVALID_AUTHORIZED_OPERATIONS",
        `authorized_operations[${i}]: duplicate operation ${String(known)}`
      );
    }
    seenOperations.add(known as string);
  }

  if (value["snapshot_policy"] !== "SAME_BOUND_SNAPSHOT") {
    comparabilityError("INVALID_SNAPSHOT_POLICY", "must be SAME_BOUND_SNAPSHOT");
  }
  if (value["action_space_policy"] !== "EXACT_SAME_FINGERPRINT") {
    comparabilityError("INVALID_ACTION_SPACE_POLICY", "must be EXACT_SAME_FINGERPRINT");
  }
  if (value["unlisted_operation_policy"] !== "DENY") {
    comparabilityError("INVALID_UNLISTED_OPERATION_POLICY", "must be DENY");
  }
}

/**
 * §14 Deterministic V0 comparability contract fingerprint via hashEnvelope/JCS.
 *
 * Namespace: characteros-next/runtime/tendency-comparability-contract/v1
 *
 * Derivation/validation support only — NO concrete cross-domain comparability
 * contract is registered in this slice. The descriptor body has no
 * self-referential fingerprint field. No wall clock, no random, no
 * environment, no host, no model vendor.
 */
export async function deriveTendencyComparabilityContractFingerprintV0(
  contract: TendencyComparabilityContractV0
): Promise<HashV1> {
  validateTendencyComparabilityContractV0(contract);
  return hashEnvelope(TENDENCY_COMPARABILITY_CONTRACT_FINGERPRINT_PROJECTION, contract);
}

// ---- default-deny comparability gate (§15/§16/§17/§18) -------------------------

/**
 * §15 Default-deny cross-domain comparability gate.
 *
 * Since V0 has NO registered cross-domain comparability contracts, ALL
 * cross-domain operations must deny. Same-domain/same-scale intrinsic
 * comparability is descriptive — it does NOT grant cross-domain
 * composition authorization (ADD, MAX, etc.).
 *
 * This slice contains ZERO cross-domain arithmetic: no sum, no average,
 * no cross-domain max, no cancellation, no weighted score.
 */
export const DEFAULT_CROSS_DOMAIN_COMPARABILITY_V0 = "DENY" as const;
export type DefaultCrossDomainComparabilityV0 =
  typeof DEFAULT_CROSS_DOMAIN_COMPARABILITY_V0;

/**
 * §15/§18 Minimal future-facing comparability gate.
 *
 * Returns DENY for every cross-domain operation. Same-domain/same-scale
 * identity check is NOT a cross-domain operation and does NOT pass through
 * this gate (intrinsic comparability is descriptive, not authorization).
 *
 * Always DENY in this V0 foundation — no registered comparability contracts.
 */
export function queryCrossDomainOperationAuthorizationV0(
  operation: CrossDomainOperationV0,
  participants: readonly TendencyComparabilityParticipantV0[]
): "DENY" {
  // V0 has NO registered comparability contracts → every operation denies
  // regardless of operation or participants (default-deny, fail closed).
  void operation;
  void participants;
  return "DENY";
}

// ---- local helpers ---------------------------------------------------------------

/** Recursive structural freeze (local helper; repository convention). */
function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  if (Object.isFrozen(value)) return;
  Object.freeze(value);
  for (const key of Object.keys(value as Record<string, unknown>)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
}

// ---- exported constants (read-only) ---------------------------------------------

/**
 * Expose the registered scale IDs as a frozen readonly array (informational).
 * Does NOT grant registry mutation capability.
 */
export const REGISTERED_TENDENCY_SCALE_IDS_V0: readonly string[] =
  Object.freeze([...REGISTERED_SCALE_IDS_V0]);
