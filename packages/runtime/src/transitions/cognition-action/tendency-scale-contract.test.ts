/**
 * Tendency Scale Contract Foundation V0 — acceptance suite (§23-§32):
 * exact frozen Belief descriptor, fingerprint determinism, deep freeze,
 * registry authority (unknown id / wrong fingerprint / structural lookalike /
 * immutable surface), same-range non-comparability, normalization
 * non-comparability, per-operation default deny, absence of raw cross-domain
 * arithmetic in the production API, no subject-state effect and zero real
 * model calls.
 *
 * Fully OFFLINE: pure deterministic functions only — no model, no transport,
 * no localhost, no persistence dependency.
 */

import { describe, expect, it } from "vitest";

import type { HashV1, IdentifierV0 } from "@characteros-next/subject-core";
import { hashEnvelope } from "@characteros-next/subject-core";

import { deriveBeliefDecisionIntegrationPolicyFingerprintV0 } from "./belief-decision-integration-policy.js";
import {
  BELIEF_ACTION_ALIGNMENT_SCALE_FINGERPRINT_PROJECTION,
  BELIEF_ACTION_ALIGNMENT_SCALE_ID_V0,
  CROSS_DOMAIN_OPERATIONS_V0,
  DEFAULT_CROSS_DOMAIN_COMPARABILITY_V0,
  REGISTERED_TENDENCY_SCALE_IDS_V0,
  TENDENCY_COMPARABILITY_CONTRACT_FINGERPRINT_PROJECTION,
  TENDENCY_COMPARABILITY_CONTRACT_SCHEMA_VERSION,
  TENDENCY_SCALE_CONTRACT_FINGERPRINT_PROJECTION,
  TENDENCY_SCALE_CONTRACT_SCHEMA_VERSION,
  TendencyComparabilityContractValidationErrorV0,
  TendencyScaleContractResolutionErrorV0,
  TendencyScaleContractValidationErrorV0,
  deriveTendencyComparabilityContractFingerprintV0,
  deriveTendencyScaleContractFingerprintV0,
  getBeliefActionAlignmentScaleContractV0,
  queryCrossDomainOperationAuthorizationV0,
  resolveRegisteredTendencyScaleContractV0,
  validateTendencyComparabilityContractV0,
  validateTendencyScaleContractV0,
  type TendencyComparabilityContractV0,
  type TendencyComparabilityParticipantV0,
  type TendencyScaleContractV0
} from "./tendency-scale-contract.js";
import * as tendencyScaleModule from "./tendency-scale-contract.js";
import * as runtimeIndex from "../../index.js";

// ---- deterministic test-only fixtures --------------------------------------------

const asId = (value: string) => value as IdentifierV0;
const asHash = (value: string) => value as HashV1;

/** Deterministic test-only policy fingerprint (valid HashV1, fixed content). */
async function testPolicyFingerprintV0(policyId: string): Promise<HashV1> {
  return hashEnvelope("characteros-next/test/tendency-scale-policy/v1", {
    policy_id: policyId
  });
}

/**
 * §27/§28 deterministic TEST-ONLY valid scale descriptor. Identical numeric
 * range [-1,1] across suffixes; different domain/quantity semantics. NEVER
 * registered.
 */
async function buildTestScaleContractV0(
  suffix: "a" | "b",
  options?: { readonly domainNormalized?: boolean }
): Promise<TendencyScaleContractV0> {
  const upper = suffix.toUpperCase();
  const domain = `TEST_DOMAIN_${upper}`;
  const contract: TendencyScaleContractV0 = {
    schema_version: TENDENCY_SCALE_CONTRACT_SCHEMA_VERSION,
    scale_contract_id: asId(`test-${suffix}-scale-v0`),
    domain_id: asId(domain),
    domain_policy_id: asId(`test-${suffix}-domain-policy-v0`),
    domain_policy_fingerprint: asHash(
      await testPolicyFingerprintV0(`test-${suffix}-domain-policy-v0`)
    ),
    quantity_semantics_id: asId(`TEST_${upper}_QUANTITY_V0`),
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
    positive_direction_semantics: asId(`TEST_${upper}_POSITIVE_V0`),
    negative_direction_semantics: asId(`TEST_${upper}_NEGATIVE_V0`),
    magnitude_semantics: asId(`TEST_${upper}_MAGNITUDE_V0`),
    zero_semantics: asId(`TEST_${upper}_ZERO_V0`),
    saturation_semantics: asId(`TEST_${upper}_SATURATION_V0`),
    aggregation_semantics: asId(`TEST_${upper}_AGGREGATION_V0`),
    normalization_semantics: options?.domainNormalized
      ? {
          kind: "DOMAIN_NORMALIZED",
          policy_id: asId(`test-${suffix}-normalization-policy-v0`),
          policy_fingerprint: asHash(
            await testPolicyFingerprintV0(`test-${suffix}-normalization-policy-v0`)
          )
        }
      : { kind: "NATIVE_IDENTITY", policy_id: null, policy_fingerprint: null },
    intrinsic_comparability: "SAME_DOMAIN_SAME_SCALE_SAME_BOUND_SNAPSHOT_ONLY",
    provenance_requirements: "FULL_BOUND_SOURCE"
  };
  validateTendencyScaleContractV0(contract);
  return contract;
}

async function participantOf(
  contract: TendencyScaleContractV0
): Promise<TendencyComparabilityParticipantV0> {
  return {
    domain_id: contract.domain_id,
    scale_contract_id: contract.scale_contract_id,
    scale_contract_fingerprint: await deriveTendencyScaleContractFingerprintV0(contract)
  };
}

/** Test-only cross-domain comparability contract — validated, NEVER registered. */
async function buildTestComparabilityContractV0(): Promise<TendencyComparabilityContractV0> {
  const contract: TendencyComparabilityContractV0 = {
    schema_version: TENDENCY_COMPARABILITY_CONTRACT_SCHEMA_VERSION,
    comparability_contract_id: asId("test-cross-domain-comparability-v0"),
    participant_scales: [
      await participantOf(await buildTestScaleContractV0("a")),
      await participantOf(await buildTestScaleContractV0("b"))
    ],
    participant_set_semantics: "EXACT_SET",
    authorized_operations: ["COMPARE_ORDER"],
    snapshot_policy: "SAME_BOUND_SNAPSHOT",
    action_space_policy: "EXACT_SAME_FINGERPRINT",
    unlisted_operation_policy: "DENY"
  };
  validateTendencyComparabilityContractV0(contract);
  return contract;
}

/** Structural lookalike of the registered Belief descriptor (different id). */
function buildBeliefLookalikeCopyV0(
  belief: TendencyScaleContractV0
): TendencyScaleContractV0 {
  return {
    ...belief,
    scale_contract_id: asId("belief-action-alignment-scale-lookalike-v0")
  };
}

/**
 * §30 Exact approved value-export surface of the foundation module (types are
 * erased at runtime). Structural absence proof for raw cross-domain
 * arithmetic, canonical write ports and model/provider surfaces.
 */
const EXPECTED_MODULE_SURFACE_V0: readonly string[] = [
  "BELIEF_ACTION_ALIGNMENT_SCALE_FINGERPRINT_PROJECTION",
  "BELIEF_ACTION_ALIGNMENT_SCALE_ID_V0",
  "CROSS_DOMAIN_OPERATIONS_V0",
  "DEFAULT_CROSS_DOMAIN_COMPARABILITY_V0",
  "REGISTERED_TENDENCY_SCALE_IDS_V0",
  "TENDENCY_COMPARABILITY_CONTRACT_FINGERPRINT_PROJECTION",
  "TENDENCY_COMPARABILITY_CONTRACT_SCHEMA_VERSION",
  "TENDENCY_SCALE_CONTRACT_FINGERPRINT_PROJECTION",
  "TENDENCY_SCALE_CONTRACT_SCHEMA_VERSION",
  "TendencyComparabilityContractValidationErrorV0",
  "TendencyScaleContractResolutionErrorV0",
  "TendencyScaleContractValidationErrorV0",
  "deriveTendencyComparabilityContractFingerprintV0",
  "deriveTendencyScaleContractFingerprintV0",
  "getBeliefActionAlignmentScaleContractV0",
  "queryCrossDomainOperationAuthorizationV0",
  "resolveRegisteredTendencyScaleContractV0",
  "validateTendencyComparabilityContractV0",
  "validateTendencyScaleContractV0"
].sort();

async function expectScaleValidationError(
  run: () => Promise<unknown> | unknown,
  code: string
): Promise<void> {
  try {
    await run();
  } catch (error) {
    expect(error).toBeInstanceOf(TendencyScaleContractValidationErrorV0);
    expect((error as TendencyScaleContractValidationErrorV0).code).toBe(code);
    return;
  }
  throw new Error(`expected TendencyScaleContractValidationErrorV0 ${code}, but nothing threw`);
}

// ---- §23 exact Belief descriptor ---------------------------------------------------

describe("Tendency Scale Contract Foundation V0", () => {
  describe("§23 exact frozen Belief descriptor", () => {
    it("exposes the complete frozen Belief action-alignment scale contract field-for-field", async () => {
      const { contract } = await getBeliefActionAlignmentScaleContractV0();
      expect(contract).toStrictEqual({
        schema_version: "tendency-scale-contract-v0",
        scale_contract_id: "belief-action-alignment-scale-v0",
        domain_id: "BELIEF",
        domain_policy_id: "belief-decision-integration-policy-v0",
        domain_policy_fingerprint: contract.domain_policy_fingerprint,
        quantity_semantics_id: "BELIEF_ACTION_ALIGNMENT_NOT_UTILITY",
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
        positive_direction_semantics: "NET_BELIEF_ALIGNMENT_TOWARD_EXACT_ACTION",
        negative_direction_semantics: "NET_BELIEF_ALIGNMENT_AGAINST_EXACT_ACTION",
        magnitude_semantics: "ABSOLUTE_NET_DIRECTIONAL_MEAN_ALIGNMENT_NOT_CONFIDENCE",
        zero_semantics:
          "NO_NET_DIRECTIONAL_ALIGNMENT_EMPTY_OR_BALANCED_NOT_DOMAIN_ABSENCE",
        saturation_semantics:
          "BELIEF_ALIGNMENT_ENDPOINT_NOT_UTILITY_CERTAINTY_OR_REWARD",
        aggregation_semantics:
          "DIRECTIONAL_ARITHMETIC_MEAN_EXCLUDING_IRRELEVANT_EMPTY_ZERO",
        normalization_semantics: {
          kind: "NATIVE_IDENTITY",
          policy_id: null,
          policy_fingerprint: null
        },
        intrinsic_comparability: "SAME_DOMAIN_SAME_SCALE_SAME_BOUND_SNAPSHOT_ONLY",
        provenance_requirements: "FULL_BOUND_SOURCE"
      });
    });

    it("derives its domain policy fingerprint from the frozen Belief integration policy", async () => {
      const { contract } = await getBeliefActionAlignmentScaleContractV0();
      expect(contract.domain_policy_fingerprint).toBe(
        await deriveBeliefDecisionIntegrationPolicyFingerprintV0()
      );
    });
  });

  // ---- §24 fingerprint determinism -----------------------------------------------

  describe("§24 fingerprint determinism", () => {
    it("repeated derivation yields the exact same fingerprint with no environment or time dependence", async () => {
      const { contract } = await getBeliefActionAlignmentScaleContractV0();
      const first = await deriveTendencyScaleContractFingerprintV0(contract);
      const second = await deriveTendencyScaleContractFingerprintV0(contract);
      expect(first).toBe(second);
      expect(first).toMatch(/^sha256:[0-9a-f]{64}$/);
    });

    it("binds the frozen namespace: equals an independent hashEnvelope recomputation", async () => {
      const { contract } = await getBeliefActionAlignmentScaleContractV0();
      expect(await deriveTendencyScaleContractFingerprintV0(contract)).toBe(
        await hashEnvelope(TENDENCY_SCALE_CONTRACT_FINGERPRINT_PROJECTION, contract)
      );
    });

    it("carries both the canonical registry fingerprint and the Belief-scale identity fingerprint, each in its own namespace", async () => {
      const { contract, scale_contract_fingerprint, belief_scale_identity_fingerprint } =
        await getBeliefActionAlignmentScaleContractV0();
      expect(scale_contract_fingerprint).toBe(
        await hashEnvelope(TENDENCY_SCALE_CONTRACT_FINGERPRINT_PROJECTION, contract)
      );
      expect(belief_scale_identity_fingerprint).toBe(
        await hashEnvelope(BELIEF_ACTION_ALIGNMENT_SCALE_FINGERPRINT_PROJECTION, contract)
      );
      expect(scale_contract_fingerprint).not.toBe(belief_scale_identity_fingerprint);
    });
  });

  // ---- §25 deep freeze -----------------------------------------------------------

  describe("§25 deep freeze", () => {
    it("freezes the registered descriptor recursively, including nested numeric_range and normalization_semantics", async () => {
      const { contract } = await getBeliefActionAlignmentScaleContractV0();
      expect(Object.isFrozen(contract)).toBe(true);
      expect(Object.isFrozen(contract.numeric_range)).toBe(true);
      expect(Object.isFrozen(contract.normalization_semantics)).toBe(true);
    });
  });

  // ---- §26 registry authority ----------------------------------------------------

  describe("§26 registry authority", () => {
    it("resolves the registered Belief id with the exact canonical fingerprint to the SAME frozen descriptor", async () => {
      const { contract, scale_contract_fingerprint } =
        await getBeliefActionAlignmentScaleContractV0();
      const resolved = await resolveRegisteredTendencyScaleContractV0({
        scale_contract_id: BELIEF_ACTION_ALIGNMENT_SCALE_ID_V0,
        scale_contract_fingerprint
      });
      expect(resolved).toBe(contract);
      expect(Object.isFrozen(resolved)).toBe(true);
    });

    it("fails closed on unknown scale id", async () => {
      await expect(
        resolveRegisteredTendencyScaleContractV0({
          scale_contract_id: "unregistered-scale-v0",
          scale_contract_fingerprint: asHash(
            await testPolicyFingerprintV0("unregistered-scale-v0")
          )
        })
      ).rejects.toMatchObject({
        name: "TendencyScaleContractResolutionErrorV0",
        code: "UNKNOWN_SCALE"
      });
    });

    it("fails closed on fingerprint mismatch", async () => {
      await expect(
        resolveRegisteredTendencyScaleContractV0({
          scale_contract_id: BELIEF_ACTION_ALIGNMENT_SCALE_ID_V0,
          scale_contract_fingerprint: asHash(
            await testPolicyFingerprintV0("not-the-registered-content")
          )
        })
      ).rejects.toBeInstanceOf(TendencyScaleContractResolutionErrorV0);
      await expect(
        resolveRegisteredTendencyScaleContractV0({
          scale_contract_id: BELIEF_ACTION_ALIGNMENT_SCALE_ID_V0,
          scale_contract_fingerprint: asHash(
            await testPolicyFingerprintV0("not-the-registered-content")
          )
        })
      ).rejects.toMatchObject({ code: "FINGERPRINT_MISMATCH" });
    });

    it("does not let a caller substitute the Belief identity fingerprint as the registry fingerprint (§8 single authority)", async () => {
      const { belief_scale_identity_fingerprint } =
        await getBeliefActionAlignmentScaleContractV0();
      await expect(
        resolveRegisteredTendencyScaleContractV0({
          scale_contract_id: BELIEF_ACTION_ALIGNMENT_SCALE_ID_V0,
          scale_contract_fingerprint: belief_scale_identity_fingerprint
        })
      ).rejects.toMatchObject({ code: "FINGERPRINT_MISMATCH" });
    });

    it("structural lookalike copy gains no registry authority", async () => {
      const { contract } = await getBeliefActionAlignmentScaleContractV0();
      const lookalike = buildBeliefLookalikeCopyV0(contract);
      const lookalikeFingerprint = await deriveTendencyScaleContractFingerprintV0(lookalike);
      expect(lookalikeFingerprint).not.toBe(
        (await getBeliefActionAlignmentScaleContractV0()).scale_contract_fingerprint
      );
      await expect(
        resolveRegisteredTendencyScaleContractV0({
          scale_contract_id: lookalike.scale_contract_id,
          scale_contract_fingerprint: lookalikeFingerprint
        })
      ).rejects.toMatchObject({ code: "UNKNOWN_SCALE" });
    });

    it("exposes an immutable closed registered-id surface and cannot be mutated through the public API", async () => {
      expect(Object.isFrozen(REGISTERED_TENDENCY_SCALE_IDS_V0)).toBe(true);
      expect([...REGISTERED_TENDENCY_SCALE_IDS_V0]).toStrictEqual([
        BELIEF_ACTION_ALIGNMENT_SCALE_ID_V0
      ]);
      expect(() => {
        (REGISTERED_TENDENCY_SCALE_IDS_V0 as string[]).push("intruder-scale-v0");
      }).toThrow(TypeError);
      expect(REGISTERED_TENDENCY_SCALE_IDS_V0).toHaveLength(1);
    });

    it("never registers test-only descriptors", async () => {
      const testContract = await buildTestScaleContractV0("a");
      await expect(
        resolveRegisteredTendencyScaleContractV0({
          scale_contract_id: testContract.scale_contract_id,
          scale_contract_fingerprint: await deriveTendencyScaleContractFingerprintV0(testContract)
        })
      ).rejects.toMatchObject({ code: "UNKNOWN_SCALE" });
      expect([...REGISTERED_TENDENCY_SCALE_IDS_V0]).toStrictEqual([
        BELIEF_ACTION_ALIGNMENT_SCALE_ID_V0
      ]);
    });
  });

  // ---- §27 same range is NOT comparability ---------------------------------------

  describe("§27 same numeric range does not imply comparability", () => {
    it("denies every operation between two [-1,1] scales with different domain/quantity semantics", async () => {
      const contractA = await buildTestScaleContractV0("a");
      const contractB = await buildTestScaleContractV0("b");
      expect(contractA.numeric_range).toStrictEqual(contractB.numeric_range);
      expect(contractA.domain_id).not.toBe(contractB.domain_id);
      expect(contractA.quantity_semantics_id).not.toBe(contractB.quantity_semantics_id);

      const participants = [
        await participantOf(contractA),
        await participantOf(contractB)
      ];
      for (const operation of CROSS_DOMAIN_OPERATIONS_V0) {
        expect(queryCrossDomainOperationAuthorizationV0(operation, participants)).toBe("DENY");
      }
      expect(DEFAULT_CROSS_DOMAIN_COMPARABILITY_V0).toBe("DENY");
    });

    it("does not grant ADD/MAX from a same-domain same-scale identity check either (§15)", async () => {
      const { scale_contract_fingerprint } = await getBeliefActionAlignmentScaleContractV0();
      const beliefParticipant: TendencyComparabilityParticipantV0 = {
        domain_id: "BELIEF" as IdentifierV0,
        scale_contract_id: asId(BELIEF_ACTION_ALIGNMENT_SCALE_ID_V0),
        scale_contract_fingerprint
      };
      for (const operation of ["ADD", "MAX", "COMPARE_ORDER", "MEAN"] as const) {
        expect(
          queryCrossDomainOperationAuthorizationV0(operation, [
            beliefParticipant,
            beliefParticipant
          ])
        ).toBe("DENY");
      }
    });
  });

  // ---- §28 normalization is NOT comparability ------------------------------------

  describe("§28 normalization does not imply comparability", () => {
    it("denies every operation between structurally DOMAIN_NORMALIZED scales", async () => {
      const contractA = await buildTestScaleContractV0("a", { domainNormalized: true });
      const contractB = await buildTestScaleContractV0("b", { domainNormalized: true });
      expect(contractA.normalization_semantics.kind).toBe("DOMAIN_NORMALIZED");
      expect(contractB.normalization_semantics.kind).toBe("DOMAIN_NORMALIZED");

      const participants = [
        await participantOf(contractA),
        await participantOf(contractB)
      ];
      for (const operation of CROSS_DOMAIN_OPERATIONS_V0) {
        expect(queryCrossDomainOperationAuthorizationV0(operation, participants)).toBe("DENY");
      }
    });
  });

  // ---- §29 per-operation default deny --------------------------------------------

  describe("§29 operation default deny", () => {
    it("freezes the exact eight-operation enum in order", () => {
      expect(Object.isFrozen(CROSS_DOMAIN_OPERATIONS_V0)).toBe(true);
      expect([...CROSS_DOMAIN_OPERATIONS_V0]).toStrictEqual([
        "COMPARE_ORDER",
        "ADD",
        "SUBTRACT_CANCEL",
        "MEAN",
        "MAX",
        "TYPED_OVERRIDE",
        "TYPED_VETO",
        "APPLY_SHARED_THRESHOLD"
      ]);
    });

    it("denies every operation with no registered comparability contract", async () => {
      const { scale_contract_fingerprint } = await getBeliefActionAlignmentScaleContractV0();
      const beliefParticipant: TendencyComparabilityParticipantV0 = {
        domain_id: "BELIEF" as IdentifierV0,
        scale_contract_id: asId(BELIEF_ACTION_ALIGNMENT_SCALE_ID_V0),
        scale_contract_fingerprint
      };
      for (const operation of CROSS_DOMAIN_OPERATIONS_V0) {
        expect(
          queryCrossDomainOperationAuthorizationV0(operation, [beliefParticipant])
        ).toBe("DENY");
      }
    });
  });

  // ---- §30 raw cross-domain arithmetic absent from the production API ------------

  describe("§30 raw arithmetic absent from the production API", () => {
    it("exports exactly the approved closed surface (no sum/mean/max/cancel/weight/composition functions)", () => {
      expect(Object.keys(tendencyScaleModule).sort()).toStrictEqual(EXPECTED_MODULE_SURFACE_V0);
      const arithmeticNamePattern = /(sum|mean|averag|cancel|weight|compos|\bmax)/i;
      const arithmeticExports = EXPECTED_MODULE_SURFACE_V0.filter((name) =>
        arithmeticNamePattern.test(name)
      );
      expect(arithmeticExports).toStrictEqual([]);
    });

    it("exposes no tendency-foundation production function beyond the approved surface and the frozen Belief-domain exports", () => {
      const frozenBeliefTendencyExportsV0 = [
        "BELIEF_DECISION_TENDENCY_OUTPUT_FINGERPRINT_PROJECTION",
        "BELIEF_DECISION_TENDENCY_PROJECTION_SCHEMA_VERSION",
        "produceBeliefDecisionTendencyProjectionV0"
      ];
      // Broadened token family: some approved surface names do not contain
      // the word "Tendency" (action-alignment / cross-domain families), and
      // camelCase names carry no underscores.
      const surfaceTokenPattern = /(tendency|action_?alignment|cross_?domain)/i;
      const runtimeSurfaceExports = Object.keys(runtimeIndex).filter((name) =>
        surfaceTokenPattern.test(name)
      );
      expect([...runtimeSurfaceExports].sort()).toStrictEqual(
        [...EXPECTED_MODULE_SURFACE_V0, ...frozenBeliefTendencyExportsV0].sort()
      );
    });
  });

  // ---- §31 no subject-state effect -----------------------------------------------

  describe("§31 no subject-state effect", () => {
    it("validation, derivation and resolution mutate no input and expose no canonical write port", async () => {
      const contract = await buildTestScaleContractV0("a");
      const snapshot = structuredClone(contract);

      validateTendencyScaleContractV0(contract);
      await deriveTendencyScaleContractFingerprintV0(contract);
      await resolveRegisteredTendencyScaleContractV0({
        scale_contract_id: contract.scale_contract_id,
        scale_contract_fingerprint: await deriveTendencyScaleContractFingerprintV0(contract)
      }).catch(() => undefined);

      expect(contract).toStrictEqual(snapshot);

      const writePortPattern = /(subject|revision|trace|commit|store|port|workflow|memory)/i;
      expect(EXPECTED_MODULE_SURFACE_V0.filter((name) => writePortPattern.test(name))).toStrictEqual(
        []
      );
    });
  });

  // ---- §32 zero model calls -------------------------------------------------------

  describe("§32 zero real model calls", () => {
    it("exposes no provider, transport or model surface and runs fully offline", async () => {
      const modelSurfacePattern = /(provider|transport|model|ollama|client|fetch|llm)/i;
      expect(
        EXPECTED_MODULE_SURFACE_V0.filter((name) => modelSurfacePattern.test(name))
      ).toStrictEqual([]);

      const { contract } = await getBeliefActionAlignmentScaleContractV0();
      const first = await deriveTendencyScaleContractFingerprintV0(contract);
      const second = await deriveTendencyScaleContractFingerprintV0(contract);
      expect(first).toBe(second);
    });
  });

  // ---- §5 scale contract validation (fail closed, no repair) ----------------------

  describe("§5 scale contract validation", () => {
    it("rejects extra and missing structural fields", async () => {
      const contract = await buildTestScaleContractV0("a");
      await expectScaleValidationError(
        () => validateTendencyScaleContractV0({ ...contract, extra_field: 1 }),
        "EXTRA_FIELDS_REJECTED"
      );
      const missing = { ...contract } as Record<string, unknown>;
      delete missing["magnitude_semantics"];
      expect(() => validateTendencyScaleContractV0(missing)).toThrow(
        TendencyScaleContractValidationErrorV0
      );
    });

    it("rejects wrong schema version and frozen literal deviations", async () => {
      const contract = await buildTestScaleContractV0("a");
      await expectScaleValidationError(
        () => validateTendencyScaleContractV0({ ...contract, schema_version: "scale-v9" }),
        "SCHEMA_VERSION_MISMATCH"
      );
      await expectScaleValidationError(
        () =>
          validateTendencyScaleContractV0({
            ...contract,
            action_binding_semantics: "LOOSE_ACTION_SET" as "EXACT_ACTION_TUPLE"
          }),
        "INVALID_ACTION_BINDING_SEMANTICS"
      );
      await expectScaleValidationError(
        () =>
          validateTendencyScaleContractV0({
            ...contract,
            numeric_representation: "ARBITRARY_PRECISION" as "FINITE_IEEE_754_BINARY64"
          }),
        "INVALID_NUMERIC_REPRESENTATION"
      );
      await expectScaleValidationError(
        () =>
          validateTendencyScaleContractV0({
            ...contract,
            intrinsic_comparability: "ANY_DOMAIN_ANY_SCALE" as "SAME_DOMAIN_SAME_SCALE_SAME_BOUND_SNAPSHOT_ONLY"
          }),
        "INVALID_INTRINSIC_COMPARABILITY"
      );
      await expectScaleValidationError(
        () =>
          validateTendencyScaleContractV0({
            ...contract,
            provenance_requirements: "NONE" as "FULL_BOUND_SOURCE"
          }),
        "INVALID_PROVENANCE_REQUIREMENTS"
      );
    });

    it("rejects non-finite endpoints, inverted ranges and out-of-range neutral points", async () => {
      const contract = await buildTestScaleContractV0("a");
      await expectScaleValidationError(
        () =>
          validateTendencyScaleContractV0({
            ...contract,
            numeric_range: { ...contract.numeric_range, minimum: Number.NaN }
          }),
        "INVALID_NUMERIC_RANGE"
      );
      await expectScaleValidationError(
        () =>
          validateTendencyScaleContractV0({
            ...contract,
            numeric_range: { ...contract.numeric_range, maximum: Number.POSITIVE_INFINITY }
          }),
        "INVALID_NUMERIC_RANGE"
      );
      await expectScaleValidationError(
        () =>
          validateTendencyScaleContractV0({
            ...contract,
            numeric_range: { ...contract.numeric_range, minimum: 2 }
          }),
        "INVALID_NUMERIC_RANGE"
      );
      await expectScaleValidationError(
        () =>
          validateTendencyScaleContractV0({
            ...contract,
            neutral_point: 5
          }),
        "NEUTRAL_POINT_OUT_OF_RANGE"
      );
      await expectScaleValidationError(
        () =>
          validateTendencyScaleContractV0({
            ...contract,
            neutral_point: 1,
            numeric_range: { ...contract.numeric_range, maximum_inclusive: false }
          }),
        "NEUTRAL_POINT_OUT_OF_RANGE"
      );
    });

    it("rejects negative-zero policy deviation and unknown normalization kinds", async () => {
      const contract = await buildTestScaleContractV0("a");
      await expectScaleValidationError(
        () =>
          validateTendencyScaleContractV0({
            ...contract,
            numeric_range: {
              ...contract.numeric_range,
              negative_zero: "ALLOW" as "NORMALIZE_TO_POSITIVE_ZERO"
            }
          }),
        "INVALID_NEGATIVE_ZERO_POLICY"
      );
      await expectScaleValidationError(
        () =>
          validateTendencyScaleContractV0({
            ...contract,
            normalization_semantics: { kind: "FREE_FORM" } as unknown as typeof contract.normalization_semantics
          }),
        "INVALID_NORMALIZATION_KIND"
      );
      await expectScaleValidationError(
        () =>
          validateTendencyScaleContractV0({
            ...contract,
            normalization_semantics: {
              kind: "NATIVE_IDENTITY",
              policy_id: "should-be-null",
              policy_fingerprint: null
            } as unknown as typeof contract.normalization_semantics
          }),
        "INVALID_NORMALIZATION_KIND"
      );
      await expectScaleValidationError(
        () =>
          validateTendencyScaleContractV0({
            ...contract,
            normalization_semantics: {
              kind: "NATIVE_IDENTITY",
              policy_id: null,
              policy_fingerprint: null,
              extra: 1
            } as unknown as typeof contract.normalization_semantics
          }),
        "EXTRA_FIELDS_REJECTED"
      );
    });

    it("rejects malformed identifiers and hashes", async () => {
      const contract = await buildTestScaleContractV0("a");
      await expectScaleValidationError(
        () =>
          validateTendencyScaleContractV0({
            ...contract,
            domain_id: "-invalid-leading-hyphen" as IdentifierV0
          }),
        "INVALID_IDENTIFIER"
      );
      await expectScaleValidationError(
        () =>
          validateTendencyScaleContractV0({
            ...contract,
            domain_policy_fingerprint: "deadbeef" as HashV1
          }),
        "INVALID_HASH"
      );
    });
  });

  // ---- §13/§14 comparability contract foundation ----------------------------------

  describe("§13/§14 comparability contract foundation", () => {
    it("validates a test-only comparability contract and fingerprints it deterministically (never registered)", async () => {
      const contract = await buildTestComparabilityContractV0();
      const first = await deriveTendencyComparabilityContractFingerprintV0(contract);
      const second = await deriveTendencyComparabilityContractFingerprintV0(contract);
      expect(first).toBe(second);
      expect(first).toBe(
        await hashEnvelope(TENDENCY_COMPARABILITY_CONTRACT_FINGERPRINT_PROJECTION, contract)
      );
      expect([...REGISTERED_TENDENCY_SCALE_IDS_V0]).toStrictEqual([
        BELIEF_ACTION_ALIGNMENT_SCALE_ID_V0
      ]);
    });

    it("rejects unknown operations, duplicate EXACT_SET participants and non-DENY unlisted-operation policy", async () => {
      const contract = await buildTestComparabilityContractV0();
      expect(() =>
        validateTendencyComparabilityContractV0({
          ...contract,
          authorized_operations: ["FLOATING_POINT_ADD" as "ADD"]
        })
      ).toThrow(TendencyComparabilityContractValidationErrorV0);
      expect(() =>
        validateTendencyComparabilityContractV0({
          ...contract,
          participant_scales: [...contract.participant_scales, ...contract.participant_scales]
        })
      ).toThrow(TendencyComparabilityContractValidationErrorV0);
      expect(() =>
        validateTendencyComparabilityContractV0({
          ...contract,
          unlisted_operation_policy: "ALLOW" as "DENY"
        })
      ).toThrow(TendencyComparabilityContractValidationErrorV0);
    });
  });
});
