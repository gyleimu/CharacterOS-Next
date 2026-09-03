/**
 * Relationship Feature Decision Semantics Foundation V0 — acceptance suite
 * (§28-§44): closed contract shape, exact [0,1] input range, no implicit 0.5,
 * semantic-point closed union, bipolar explicit-interior reference,
 * role×action-relation rules, monotonicity rules, semantics ≠ numeric
 * transform, no cross-feature authority, fingerprint determinism, EMPTY
 * registry, structural lookalike without authority, storage ≠ decision
 * admission, zero-not-coerced tagging, no register API, no subject-state
 * effect and zero model dependency.
 *
 * Fully OFFLINE: pure deterministic functions only — no model, no transport,
 * no localhost, no persistence dependency.
 *
 * ALL synthetic fixtures are test-only and NEVER registered; as of
 * RELATIONSHIP_REGISTERED_FEATURE_ADMISSION_V1 the registry admits exactly ONE
 * real feature (interaction familiarity) and still never gains a synthetic
 * entry from any test.
 */

import { describe, expect, it } from "vitest";

import type { IdentifierV0, UnitIntervalV0 } from "@characteros-next/subject-core";
import { hashEnvelope } from "@characteros-next/subject-core";

import * as relationshipFeatureSemanticsModule from "./relationship-feature-decision-semantics.js";
import {
  RELATIONSHIP_FEATURE_DECISION_DOMAIN_ID_V0,
  RELATIONSHIP_FEATURE_DECISION_ROLES_V0,
  RELATIONSHIP_FEATURE_DECISION_SEMANTICS_CONTRACT_FINGERPRINT_PROJECTION,
  RELATIONSHIP_FEATURE_DECISION_SEMANTICS_CONTRACT_SCHEMA_VERSION,
  RELATIONSHIP_FEATURE_DECISION_SOURCE_STATE_SCHEMA_VERSION_V0,
  REGISTERED_RELATIONSHIP_DECISION_FEATURE_IDS_V0,
  RelationshipFeatureDecisionSemanticsValidationErrorV0,
  deriveRelationshipFeatureDecisionSemanticsContractFingerprintV0,
  queryRelationshipFeatureDecisionAdmissionV0,
  resolveRegisteredRelationshipFeatureDecisionSemanticsV0,
  validateRelationshipFeatureDecisionSemanticsContractV0,
  type RelationshipFeatureDecisionRoleV0,
  type RelationshipFeatureDecisionSemanticsContractV0,
  type RelationshipFeatureSemanticPointV0
} from "./relationship-feature-decision-semantics.js";

// ---- deterministic test-only fixtures --------------------------------------------

const asId = (value: string) => value as IdentifierV0;
const asUnit = (value: number) => value as UnitIntervalV0;

type SyntheticOverridesV0 = {
  readonly decision_role?: RelationshipFeatureDecisionRoleV0;
  readonly monotonicity_semantics?: "INCREASING_QUANTITY" | "DECREASING_QUANTITY" | "NON_MONOTONIC" | "UNSPECIFIED";
  readonly action_relation_requirement?:
    | "EXACT_FEATURE_STATE_X_EXACT_ACTION_X_EXACT_COUNTERPART_TYPED_RELATION_REQUIRED"
    | "DECISION_USE_FORBIDDEN";
  readonly polarity_semantics?: "UNSIGNED" | "BIPOLAR_AROUND_EXPLICIT_REFERENCE";
  readonly reference?: RelationshipFeatureSemanticPointV0;
  readonly neutral?: RelationshipFeatureSemanticPointV0;
};

/**
 * Synthetic test-only contract fixture. Default variant is decision-admissible
 * (DIRECTIONAL_DECISION_SIGNAL + INCREASING_QUANTITY + REQUIRED relation).
 * NEVER registered.
 */
function buildSyntheticContractV0(overrides?: SyntheticOverridesV0): RelationshipFeatureDecisionSemanticsContractV0 {
  const contract: RelationshipFeatureDecisionSemanticsContractV0 = {
    schema_version: RELATIONSHIP_FEATURE_DECISION_SEMANTICS_CONTRACT_SCHEMA_VERSION,
    feature_semantics_contract_id: asId("test-feature-semantics-contract-v0"),
    dimension_id: asId("test_dimension_v0"),
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
    quantity_semantics_id: asId("TEST_RELATIONSHIP_QUANTITY_V0"),
    lower_endpoint_semantics: { value: 0, semantics_id: asId("TEST_LOWER_ENDPOINT_V0") },
    upper_endpoint_semantics: { value: 1, semantics_id: asId("TEST_UPPER_ENDPOINT_V0") },
    neutral_or_reference_semantics: {
      neutral: overrides?.neutral ?? { kind: "NONE" },
      reference: overrides?.reference ?? { kind: "NONE" }
    },
    polarity_semantics: overrides?.polarity_semantics ?? "UNSIGNED",
    magnitude_semantics: { kind: "NONE" },
    monotonicity_semantics: overrides?.monotonicity_semantics ?? "INCREASING_QUANTITY",
    decision_role: overrides?.decision_role ?? "DIRECTIONAL_DECISION_SIGNAL",
    action_relation_requirement:
      overrides?.action_relation_requirement ??
      "EXACT_FEATURE_STATE_X_EXACT_ACTION_X_EXACT_COUNTERPART_TYPED_RELATION_REQUIRED",
    counterpart_binding_requirement: "EXACT_CANONICAL_COUNTERPART_REF",
    direct_numeric_mapping_authorized: false,
    cross_feature_comparability: "DENY",
    aggregation_eligibility: "NONE_BY_DEFAULT",
    normalization_authority: "NONE",
    provenance_requirements: "EXACT_CURRENT_CANONICAL_RELATIONSHIP_PROJECTION_V0"
  };
  return contract;
}

const DECISION_ADMISSIBLE_ROLE_LIST_V0 = [
  "DIRECTIONAL_DECISION_SIGNAL",
  "MAGNITUDE_ONLY",
  "MODULATOR",
  "GATE",
  "EVIDENCE_OR_RELIABILITY"
] as const;

async function expectValidationError(
  run: () => Promise<unknown> | unknown,
  code: string
): Promise<void> {
  try {
    await run();
  } catch (error) {
    expect(error).toBeInstanceOf(RelationshipFeatureDecisionSemanticsValidationErrorV0);
    expect((error as RelationshipFeatureDecisionSemanticsValidationErrorV0).code).toBe(code);
    return;
  }
  throw new Error(
    `expected RelationshipFeatureDecisionSemanticsValidationErrorV0 ${code}, but nothing threw`
  );
}

function expectResolutionError(run: () => unknown, code: string): void {
  try {
    run();
  } catch (error) {
    expect((error as { code?: string }).code).toBe(code);
    return;
  }
  throw new Error(`expected resolution error ${code}, but nothing threw`);
}

// ---- §28 closed contract shape -----------------------------------------------------

describe("Relationship Feature Decision Semantics Foundation V0", () => {
  describe("§28 closed contract shape", () => {
    it("validates synthetic decision-admissible and context-only descriptors", () => {
      const directional = buildSyntheticContractV0();
      expect(() => validateRelationshipFeatureDecisionSemanticsContractV0(directional)).not.toThrow();

      const contextOnly = buildSyntheticContractV0({
        decision_role: "CONTEXT_ONLY",
        monotonicity_semantics: "UNSPECIFIED",
        action_relation_requirement: "DECISION_USE_FORBIDDEN"
      });
      expect(() => validateRelationshipFeatureDecisionSemanticsContractV0(contextOnly)).not.toThrow();
    });

    it("rejects missing fields, extra fields and malformed identifiers", () => {
      const contract = buildSyntheticContractV0();
      const missing = { ...contract } as Record<string, unknown>;
      delete missing["quantity_semantics_id"];
      expect(() => validateRelationshipFeatureDecisionSemanticsContractV0(missing)).toThrow(
        RelationshipFeatureDecisionSemanticsValidationErrorV0
      );
      expectValidationError(
        () => validateRelationshipFeatureDecisionSemanticsContractV0({ ...contract, extra_field: 1 }),
        "EXTRA_FIELDS_REJECTED"
      );
      expectValidationError(
        () =>
          validateRelationshipFeatureDecisionSemanticsContractV0({
            ...contract,
            dimension_id: "-bad-leading-hyphen" as IdentifierV0
          }),
        "INVALID_IDENTIFIER"
      );
    });

    it("rejects wrong fixed literals (domain, source schema, numeric type, schema version)", () => {
      const contract = buildSyntheticContractV0();
      expectValidationError(
        () =>
          validateRelationshipFeatureDecisionSemanticsContractV0({
            ...contract,
            domain_id: "BELIEF" as "RELATIONSHIP"
          }),
        "INVALID_DOMAIN_ID"
      );
      expectValidationError(
        () =>
          validateRelationshipFeatureDecisionSemanticsContractV0({
            ...contract,
            source_state_schema_version: "relationship-state-v9" as "relationship-state-v0"
          }),
        "INVALID_SOURCE_STATE_SCHEMA_VERSION"
      );
      expectValidationError(
        () =>
          validateRelationshipFeatureDecisionSemanticsContractV0({
            ...contract,
            input_numeric_type: "SIGNED_FLOAT" as "UNIT_INTERVAL_V0"
          }),
        "INVALID_INPUT_NUMERIC_TYPE"
      );
      expectValidationError(
        () =>
          validateRelationshipFeatureDecisionSemanticsContractV0({
            ...contract,
            schema_version: "relationship-feature-decision-semantics-contract-v9" as typeof contract.schema_version
          }),
        "SCHEMA_VERSION_MISMATCH"
      );
    });
  });

  // ---- §29 input range exact -----------------------------------------------------

  describe("§29 input range exact", () => {
    it("requires exactly [0,1] inclusive with non-finite FORBIDDEN and rejects alterations", () => {
      const contract = buildSyntheticContractV0();
      expect(contract.input_range).toStrictEqual({
        minimum: 0,
        maximum: 1,
        minimum_inclusive: true,
        maximum_inclusive: true,
        non_finite: "FORBIDDEN"
      });
      expectValidationError(
        () =>
          validateRelationshipFeatureDecisionSemanticsContractV0({
            ...contract,
            input_range: { ...contract.input_range, minimum: -1 as 0 }
          }),
        "INVALID_INPUT_RANGE"
      );
      expectValidationError(
        () =>
          validateRelationshipFeatureDecisionSemanticsContractV0({
            ...contract,
            input_range: { ...contract.input_range, maximum: 2 as 1 }
          }),
        "INVALID_INPUT_RANGE"
      );
      expectValidationError(
        () =>
          validateRelationshipFeatureDecisionSemanticsContractV0({
            ...contract,
            input_range: { ...contract.input_range, maximum_inclusive: false as true }
          }),
        "INVALID_INPUT_RANGE"
      );
      expectValidationError(
        () =>
          validateRelationshipFeatureDecisionSemanticsContractV0({
            ...contract,
            input_range: { ...contract.input_range, non_finite: "ALLOW" as "FORBIDDEN" }
          }),
        "INVALID_INPUT_RANGE"
      );
    });
  });

  // ---- §30 no implicit 0.5 -------------------------------------------------------

  describe("§30 no implicit neutral point", () => {
    it("inserts no 0.5: a valid UNSIGNED descriptor may declare neutral NONE and reference NONE", () => {
      const contract = buildSyntheticContractV0({
        decision_role: "CONTEXT_ONLY",
        monotonicity_semantics: "UNSPECIFIED",
        action_relation_requirement: "DECISION_USE_FORBIDDEN"
      });
      validateRelationshipFeatureDecisionSemanticsContractV0(contract);
      expect(contract.neutral_or_reference_semantics).toStrictEqual({
        neutral: { kind: "NONE" },
        reference: { kind: "NONE" }
      });
    });
  });

  // ---- §31 semantic point union --------------------------------------------------

  describe("§31 semantic point union", () => {
    it("accepts all four closed kinds in valid positions", () => {
      const base = buildSyntheticContractV0();
      for (const point of [
        { kind: "NONE" },
        { kind: "LOWER_ENDPOINT" },
        { kind: "UPPER_ENDPOINT" },
        { kind: "EXPLICIT_VALUE", value: asUnit(0.25), semantics_id: asId("TEST_POINT_V0") }
      ] as const) {
        expect(() =>
          validateRelationshipFeatureDecisionSemanticsContractV0({
            ...base,
            neutral_or_reference_semantics: { neutral: point, reference: point }
          })
        ).not.toThrow();
      }
    });

    it("rejects malformed shapes, extra fields, out-of-range/non-finite values and malformed semantics_id", () => {
      const base = buildSyntheticContractV0({
        decision_role: "CONTEXT_ONLY",
        monotonicity_semantics: "UNSPECIFIED",
        action_relation_requirement: "DECISION_USE_FORBIDDEN"
      });
      expectValidationError(
        () =>
          validateRelationshipFeatureDecisionSemanticsContractV0({
            ...base,
            neutral_or_reference_semantics: {
              neutral: { kind: "NONE", extra: 1 } as unknown as RelationshipFeatureSemanticPointV0,
              reference: { kind: "NONE" }
            }
          }),
        "EXTRA_FIELDS_REJECTED"
      );
      expectValidationError(
        () =>
          validateRelationshipFeatureDecisionSemanticsContractV0({
            ...base,
            neutral_or_reference_semantics: {
              neutral: { kind: "SOMEHOW_FLOATING" } as unknown as RelationshipFeatureSemanticPointV0,
              reference: { kind: "NONE" }
            }
          }),
        "INVALID_SEMANTIC_POINT"
      );
      expectValidationError(
        () =>
          validateRelationshipFeatureDecisionSemanticsContractV0({
            ...base,
            neutral_or_reference_semantics: {
              neutral: {
                kind: "EXPLICIT_VALUE",
                value: asUnit(1.1),
                semantics_id: asId("TEST_POINT_V0")
              } as unknown as RelationshipFeatureSemanticPointV0,
              reference: { kind: "NONE" }
            }
          }),
        "INVALID_SEMANTIC_POINT"
      );
      expectValidationError(
        () =>
          validateRelationshipFeatureDecisionSemanticsContractV0({
            ...base,
            neutral_or_reference_semantics: {
              neutral: {
                kind: "EXPLICIT_VALUE",
                value: asUnit(Number.NaN),
                semantics_id: asId("TEST_POINT_V0")
              } as unknown as RelationshipFeatureSemanticPointV0,
              reference: { kind: "NONE" }
            }
          }),
        "INVALID_SEMANTIC_POINT"
      );
      expectValidationError(
        () =>
          validateRelationshipFeatureDecisionSemanticsContractV0({
            ...base,
            neutral_or_reference_semantics: {
              neutral: {
                kind: "EXPLICIT_VALUE",
                value: asUnit(0.5),
                semantics_id: asId("-malformed-id")
              } as unknown as RelationshipFeatureSemanticPointV0,
              reference: { kind: "NONE" }
            }
          }),
        "INVALID_SEMANTIC_POINT"
      );
    });
  });

  // ---- §32 bipolar explicit interior reference ------------------------------------

  describe("§32 bipolar requires explicit interior reference", () => {
    it("rejects NONE, LOWER_ENDPOINT, UPPER_ENDPOINT, EXPLICIT_VALUE 0 and EXPLICIT_VALUE 1 as reference", () => {
      for (const reference of [
        { kind: "NONE" },
        { kind: "LOWER_ENDPOINT" },
        { kind: "UPPER_ENDPOINT" },
        { kind: "EXPLICIT_VALUE", value: asUnit(0), semantics_id: asId("TEST_REF_V0") },
        { kind: "EXPLICIT_VALUE", value: asUnit(1), semantics_id: asId("TEST_REF_V0") }
      ] as const) {
        expectValidationError(
          () =>
            validateRelationshipFeatureDecisionSemanticsContractV0(
              buildSyntheticContractV0({
                decision_role: "CONTEXT_ONLY",
                monotonicity_semantics: "UNSPECIFIED",
                action_relation_requirement: "DECISION_USE_FORBIDDEN",
                polarity_semantics: "BIPOLAR_AROUND_EXPLICIT_REFERENCE",
                reference
              })
            ),
          "BIPOLAR_REFERENCE_NOT_EXPLICIT_INTERIOR_VALUE"
        );
      }
    });

    it("accepts an exact strictly-interior EXPLICIT_VALUE reference and produces no transform", () => {
      const contract = buildSyntheticContractV0({
        decision_role: "CONTEXT_ONLY",
        monotonicity_semantics: "UNSPECIFIED",
        action_relation_requirement: "DECISION_USE_FORBIDDEN",
        polarity_semantics: "BIPOLAR_AROUND_EXPLICIT_REFERENCE",
        reference: { kind: "EXPLICIT_VALUE", value: asUnit(0.25), semantics_id: asId("TEST_REF_V0") }
      });
      expect(() => validateRelationshipFeatureDecisionSemanticsContractV0(contract)).not.toThrow();
      expect(contract.direct_numeric_mapping_authorized).toBe(false);
    });
  });

  // ---- §33 role × action-relation rules ------------------------------------------

  describe("§33 role and action-relation rules", () => {
    it("requires the exact typed action relation for every decision-admissible role", () => {
      for (const role of DECISION_ADMISSIBLE_ROLE_LIST_V0) {
        const required = buildSyntheticContractV0({
          decision_role: role,
          monotonicity_semantics: "INCREASING_QUANTITY"
        });
        expect(() => validateRelationshipFeatureDecisionSemanticsContractV0(required)).not.toThrow();

        expectValidationError(
          () =>
            validateRelationshipFeatureDecisionSemanticsContractV0(
              buildSyntheticContractV0({
                decision_role: role,
                monotonicity_semantics: "INCREASING_QUANTITY",
                action_relation_requirement: "DECISION_USE_FORBIDDEN"
              })
            ),
          "ROLE_ACTION_RELATION_MISMATCH"
        );
      }
    });

    it("requires DECISION_USE_FORBIDDEN for CONTEXT_ONLY and NOT_DECISION_ADMISSIBLE", () => {
      for (const role of ["CONTEXT_ONLY", "NOT_DECISION_ADMISSIBLE"] as const) {
        const forbidden = buildSyntheticContractV0({
          decision_role: role,
          monotonicity_semantics: "UNSPECIFIED",
          action_relation_requirement: "DECISION_USE_FORBIDDEN"
        });
        expect(() => validateRelationshipFeatureDecisionSemanticsContractV0(forbidden)).not.toThrow();

        expectValidationError(
          () =>
            validateRelationshipFeatureDecisionSemanticsContractV0(
              buildSyntheticContractV0({
                decision_role: role,
                monotonicity_semantics: "UNSPECIFIED",
                action_relation_requirement:
                  "EXACT_FEATURE_STATE_X_EXACT_ACTION_X_EXACT_COUNTERPART_TYPED_RELATION_REQUIRED"
              })
            ),
          "ROLE_ACTION_RELATION_MISMATCH"
        );
      }
    });
  });

  // ---- §34 monotonicity rules ------------------------------------------------------

  describe("§34 monotonicity rules", () => {
    it("rejects UNSPECIFIED monotonicity for decision-admissible roles", () => {
      for (const role of DECISION_ADMISSIBLE_ROLE_LIST_V0) {
        expectValidationError(
          () =>
            validateRelationshipFeatureDecisionSemanticsContractV0(
              buildSyntheticContractV0({ decision_role: role, monotonicity_semantics: "UNSPECIFIED" })
            ),
          "ADMISSIBLE_ROLE_MONOTONICITY_UNSPECIFIED"
        );
      }
    });

    it("allows UNSPECIFIED monotonicity for denied roles", () => {
      for (const role of ["CONTEXT_ONLY", "NOT_DECISION_ADMISSIBLE"] as const) {
        const contract = buildSyntheticContractV0({
          decision_role: role,
          monotonicity_semantics: "UNSPECIFIED",
          action_relation_requirement: "DECISION_USE_FORBIDDEN"
        });
        expect(() => validateRelationshipFeatureDecisionSemanticsContractV0(contract)).not.toThrow();
      }
    });
  });

  // ---- §35 semantics ≠ numeric transform -------------------------------------------

  describe("§35 semantics is not a numeric transform", () => {
    it("fixes direct_numeric_mapping_authorized to false and rejects true", () => {
      const contract = buildSyntheticContractV0();
      expect(contract.direct_numeric_mapping_authorized).toBe(false);
      expectValidationError(
        () =>
          validateRelationshipFeatureDecisionSemanticsContractV0({
            ...contract,
            direct_numeric_mapping_authorized: true as false
          }),
        "INVALID_AUTHORITY_LITERAL"
      );
    });
  });

  // ---- §36 no cross-feature authority ----------------------------------------------

  describe("§36 no cross-feature authority", () => {
    it("fixes DENY / NONE_BY_DEFAULT / NONE authority literals and rejects alterations", () => {
      const contract = buildSyntheticContractV0();
      expect(contract.cross_feature_comparability).toBe("DENY");
      expect(contract.aggregation_eligibility).toBe("NONE_BY_DEFAULT");
      expect(contract.normalization_authority).toBe("NONE");
      expectValidationError(
        () =>
          validateRelationshipFeatureDecisionSemanticsContractV0({
            ...contract,
            cross_feature_comparability: "ALLOW" as "DENY"
          }),
        "INVALID_AUTHORITY_LITERAL"
      );
      expectValidationError(
        () =>
          validateRelationshipFeatureDecisionSemanticsContractV0({
            ...contract,
            aggregation_eligibility: "ELIGIBLE" as "NONE_BY_DEFAULT"
          }),
        "INVALID_AUTHORITY_LITERAL"
      );
      expectValidationError(
        () =>
          validateRelationshipFeatureDecisionSemanticsContractV0({
            ...contract,
            normalization_authority: "DOMAIN_NORMALIZED" as "NONE"
          }),
        "INVALID_AUTHORITY_LITERAL"
      );
    });
  });

  // ---- §37 fingerprint determinism ---------------------------------------------------

  describe("§37 fingerprint determinism", () => {
    it("repeated derivation yields the identical fingerprint matching an independent recomputation", async () => {
      const contract = buildSyntheticContractV0();
      const first = await deriveRelationshipFeatureDecisionSemanticsContractFingerprintV0(contract);
      const second = await deriveRelationshipFeatureDecisionSemanticsContractFingerprintV0(contract);
      expect(first).toBe(second);
      expect(first).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(first).toBe(
        await hashEnvelope(
          RELATIONSHIP_FEATURE_DECISION_SEMANTICS_CONTRACT_FINGERPRINT_PROJECTION,
          contract
        )
      );
    });
  });

  // ---- §38 registry state (exactly ONE admitted real feature) --------------------------

  describe("§38 registry state", () => {
    it("registers exactly ONE decision-semantic feature: interaction familiarity", () => {
      expect(Object.isFrozen(REGISTERED_RELATIONSHIP_DECISION_FEATURE_IDS_V0)).toBe(true);
      expect([...REGISTERED_RELATIONSHIP_DECISION_FEATURE_IDS_V0]).toStrictEqual([
        "relationship-interaction-familiarity-semantics-v0"
      ]);
    });

    it("fails closed as unregistered for any opaque dimension, including the forbidden test names", () => {
      for (const dimensionId of [
        "test_trust_like",
        "test_closeness_like",
        "relationship_test_dimension_v0",
        "some_other_opaque_dimension_v0"
      ]) {
        expectResolutionError(
          () =>
            resolveRegisteredRelationshipFeatureDecisionSemanticsV0({
              domain_id: RELATIONSHIP_FEATURE_DECISION_DOMAIN_ID_V0,
              source_state_schema_version: RELATIONSHIP_FEATURE_DECISION_SOURCE_STATE_SCHEMA_VERSION_V0,
              dimension_id: dimensionId,
              feature_semantics_contract_id: "test-feature-semantics-contract-v0",
              feature_semantics_contract_fingerprint: "sha256:0000000000000000000000000000000000000000000000000000000000000000"
            }),
          "UNKNOWN_FEATURE_SEMANTICS"
        );
      }
      expect(REGISTERED_RELATIONSHIP_DECISION_FEATURE_IDS_V0).toHaveLength(1);
    });

    it("fails closed on wrong domain or source schema identity literals", () => {
      expectResolutionError(
        () =>
          resolveRegisteredRelationshipFeatureDecisionSemanticsV0({
            domain_id: "BELIEF",
            source_state_schema_version: RELATIONSHIP_FEATURE_DECISION_SOURCE_STATE_SCHEMA_VERSION_V0,
            dimension_id: "test_dimension_v0",
            feature_semantics_contract_id: "test-feature-semantics-contract-v0",
            feature_semantics_contract_fingerprint: "sha256:0000000000000000000000000000000000000000000000000000000000000000"
          }),
        "FEATURE_IDENTITY_MISMATCH"
      );
      expectResolutionError(
        () =>
          resolveRegisteredRelationshipFeatureDecisionSemanticsV0({
            domain_id: RELATIONSHIP_FEATURE_DECISION_DOMAIN_ID_V0,
            source_state_schema_version: "belief-state-v0",
            dimension_id: "test_dimension_v0",
            feature_semantics_contract_id: "test-feature-semantics-contract-v0",
            feature_semantics_contract_fingerprint: "sha256:0000000000000000000000000000000000000000000000000000000000000000"
          }),
        "FEATURE_IDENTITY_MISMATCH"
      );
    });
  });

  // ---- §39 structural lookalike --------------------------------------------------------

  describe("§39 structural lookalike has no registry authority", () => {
    it("valid structure plus a correctly derived fingerprint does NOT gain registry authority", async () => {
      const contract = buildSyntheticContractV0();
      const fingerprint =
        await deriveRelationshipFeatureDecisionSemanticsContractFingerprintV0(contract);
      expectResolutionError(
        () =>
          resolveRegisteredRelationshipFeatureDecisionSemanticsV0({
            domain_id: contract.domain_id,
            source_state_schema_version: contract.source_state_schema_version,
            dimension_id: contract.dimension_id,
            feature_semantics_contract_id: contract.feature_semantics_contract_id,
            feature_semantics_contract_fingerprint: fingerprint
          }),
          "UNKNOWN_FEATURE_SEMANTICS"
        );
      expect(REGISTERED_RELATIONSHIP_DECISION_FEATURE_IDS_V0).toHaveLength(1);
    });
  });

  // ---- §40/§41 storage ≠ decision admission, zero not coerced ----------------------------

  describe("§40/§41 storage admission is not decision admission", () => {
    it("returns the tagged non-numeric NOT_DECISION_ADMISSIBLE result for opaque canonical dimensions", () => {
      const admission = queryRelationshipFeatureDecisionAdmissionV0("host_supplied_opaque_dimension");
      expect(admission).toStrictEqual({
        decision_admission: "NOT_DECISION_ADMISSIBLE",
        reason: "UNREGISTERED_FEATURE"
      });
      expect(Object.keys(admission).sort()).toStrictEqual(["decision_admission", "reason"]);
      const values = Object.values(admission);
      expect(values.every((v) => typeof v === "string")).toBe(true);
    });

    it("never coerces an unregistered feature into numeric zero for any queried dimension", () => {
      for (const dimensionId of ["test_trust_like", "relationship_test_dimension_v0", "zzz"]) {
        const admission = queryRelationshipFeatureDecisionAdmissionV0(dimensionId);
        expect(admission.decision_admission).toBe("NOT_DECISION_ADMISSIBLE");
        expect("value" in admission).toBe(false);
        expect("numeric" in admission).toBe(false);
      }
    });
  });

  // ---- §42/§43/§44 production surface boundaries ------------------------------------------

  describe("§42-§44 production surface boundaries", () => {
    const EXPECTED_MODULE_SURFACE_V0: readonly string[] = [
      "INTERACTION_FAMILIARITY_DIMENSION_ID_V0",
      "INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_FINGERPRINT_V0",
      "INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_ID_V0",
      "INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_V0",
      "INTERACTION_FAMILIARITY_QUANTITY_SEMANTICS_ID_V0",
      "RELATIONSHIP_FEATURE_DECISION_DOMAIN_ID_V0",
      "RELATIONSHIP_FEATURE_DECISION_ROLES_V0",
      "RELATIONSHIP_FEATURE_DECISION_SEMANTICS_CONTRACT_FINGERPRINT_PROJECTION",
      "RELATIONSHIP_FEATURE_DECISION_SEMANTICS_CONTRACT_SCHEMA_VERSION",
      "RELATIONSHIP_FEATURE_DECISION_SOURCE_STATE_SCHEMA_VERSION_V0",
      "RELATIONSHIP_FEATURE_MONOTONICITY_SEMANTICS_V0",
      "REGISTERED_RELATIONSHIP_DECISION_FEATURE_IDS_V0",
      "RelationshipFeatureDecisionSemanticsResolutionErrorV0",
      "RelationshipFeatureDecisionSemanticsValidationErrorV0",
      "deriveRelationshipFeatureDecisionSemanticsContractFingerprintV0",
      "queryRelationshipFeatureDecisionAdmissionV0",
      "resolveRegisteredRelationshipFeatureDecisionSemanticsV0",
      "validateRelationshipFeatureDecisionSemanticsContractV0"
    ].sort();

    it("exports exactly the approved closed surface with no register/add/set mutation API", () => {
      expect(Object.keys(relationshipFeatureSemanticsModule).sort()).toStrictEqual(
        EXPECTED_MODULE_SURFACE_V0
      );
      const mutationPattern = /(register|add|set|delete)Relationship/i;
      expect(
        EXPECTED_MODULE_SURFACE_V0.filter((name) => mutationPattern.test(name))
      ).toStrictEqual([]);
    });

    it("exposes no canonical write path and mutates no input", async () => {
      const writePathPattern = /(subject|revision|trace|commit|store|port|workflow|memory)/i;
      expect(
        EXPECTED_MODULE_SURFACE_V0.filter((name) => writePathPattern.test(name))
      ).toStrictEqual([]);

      const contract = buildSyntheticContractV0();
      const snapshot = structuredClone(contract);
      validateRelationshipFeatureDecisionSemanticsContractV0(contract);
      await deriveRelationshipFeatureDecisionSemanticsContractFingerprintV0(contract);
      expect(contract).toStrictEqual(snapshot);
    });

    it("exposes no provider, transport or model surface and runs fully offline", () => {
      const modelSurfacePattern = /(provider|transport|model|ollama|client|fetch|llm)/i;
      expect(
        EXPECTED_MODULE_SURFACE_V0.filter((name) => modelSurfacePattern.test(name))
      ).toStrictEqual([]);
    });
  });

  // ---- role vocabulary + frozen constants ------------------------------------------------

  describe("frozen vocabulary constants", () => {
    it("freezes the exact seven-role and four-monotonicity vocabularies in order", () => {
      expect(Object.isFrozen(RELATIONSHIP_FEATURE_DECISION_ROLES_V0)).toBe(true);
      expect([...RELATIONSHIP_FEATURE_DECISION_ROLES_V0]).toStrictEqual([
        "DIRECTIONAL_DECISION_SIGNAL",
        "MAGNITUDE_ONLY",
        "MODULATOR",
        "GATE",
        "EVIDENCE_OR_RELIABILITY",
        "CONTEXT_ONLY",
        "NOT_DECISION_ADMISSIBLE"
      ]);
    });
  });
});
