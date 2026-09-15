/**
 * Cross-Domain Numeric Mixing Boundary V0 — negative suite
 * (AUDIT_REMEDIATION_AND_FREEZE_V0, TASK 3).
 *
 * Frozen principle: DIFFERENT DOMAINS SHARING THE SAME NUMERIC RANGE DOES NOT
 * MAKE THEIR SEMANTICS THE SAME. Illegal cross-domain arithmetic must be
 * default-DENIED. This suite exercises the EXISTING mechanisms only — no new
 * framework, registry, gate or authority subsystem is introduced here.
 *
 * Pre-existing mechanisms exercised:
 *   - the default-deny comparability gate
 *     `queryCrossDomainOperationAuthorizationV0` +
 *     `DEFAULT_CROSS_DOMAIN_COMPARABILITY_V0` (tendency-scale-contract.ts)
 *   - the frozen Relationship familiarity decision-semantics contract's own
 *     authority literals (no numeric mapping, no cross-feature comparability,
 *     no aggregation, no normalization)
 *   - `queryRelationshipFeatureDecisionAdmissionV0` — a numeric value alone
 *     authorizes nothing
 *
 * Domains covered (all three required):
 *   - BELIEF   credence (UnitIntervalV0 [0,1]) and stance (bipolar [-1,1])
 *   - AFFECT   numeric state (activation UnitIntervalV0 [0,1], valence [-1,1])
 *   - RELATIONSHIP interaction familiarity (UnitIntervalV0 [0,1], k/32 grid)
 *
 * Fully OFFLINE: pure deterministic functions only — 0 real model calls.
 */

import { describe, expect, it } from "vitest";

import type { HashV1, IdentifierV0 } from "@characteros-next/subject-core";
import { validateUnitInterval } from "@characteros-next/subject-core";

import {
  BELIEF_ACTION_ALIGNMENT_SCALE_ID_V0,
  CROSS_DOMAIN_OPERATIONS_V0,
  DEFAULT_CROSS_DOMAIN_COMPARABILITY_V0,
  TENDENCY_COMPARABILITY_CONTRACT_SCHEMA_VERSION,
  getBeliefActionAlignmentScaleContractV0,
  queryCrossDomainOperationAuthorizationV0,
  validateTendencyComparabilityContractV0,
  type CrossDomainOperationV0,
  type TendencyComparabilityContractV0,
  type TendencyComparabilityParticipantV0
} from "./tendency-scale-contract.js";

import * as relationshipFeatureSemanticsModule from "../../transitions/relationship/relationship-feature-decision-semantics.js";
import {
  INTERACTION_FAMILIARITY_DIMENSION_ID_V0,
  INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_ID_V0,
  INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_V0,
  RelationshipFeatureDecisionSemanticsValidationErrorV0,
  queryRelationshipFeatureDecisionAdmissionV0,
  validateRelationshipFeatureDecisionSemanticsContractV0
} from "../../transitions/relationship/relationship-feature-decision-semantics.js";

const asId = (value: string) => value as IdentifierV0;
const asHash = (value: string) => value as HashV1;

/** The three domains whose numeric ranges overlap but whose semantics do not. */
const DOMAIN_PARTICIPANTS: readonly {
  readonly label: string;
  readonly domain_id: string;
  readonly scale_contract_id: string;
  readonly scale_contract_fingerprint: string;
}[] = [
  {
    label: "BELIEF (credence / stance)",
    domain_id: "BELIEF",
    scale_contract_id: BELIEF_ACTION_ALIGNMENT_SCALE_ID_V0,
    scale_contract_fingerprint:
      "sha256:1111111111111111111111111111111111111111111111111111111111111111"
  },
  {
    label: "AFFECT (numeric state)",
    domain_id: "AFFECT",
    scale_contract_id: "affect-numeric-state-v0",
    scale_contract_fingerprint:
      "sha256:2222222222222222222222222222222222222222222222222222222222222222"
  },
  {
    label: "RELATIONSHIP (interaction familiarity)",
    domain_id: "RELATIONSHIP",
    scale_contract_id: INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_ID_V0,
    scale_contract_fingerprint:
      "sha256:3333333333333333333333333333333333333333333333333333333333333333"
  }
];

function participantOf(
  domain: (typeof DOMAIN_PARTICIPANTS)[number]
): TendencyComparabilityParticipantV0 {
  return {
    domain_id: asId(domain.domain_id),
    scale_contract_id: asId(domain.scale_contract_id),
    scale_contract_fingerprint: asHash(domain.scale_contract_fingerprint)
  };
}

describe("cross-domain numeric mixing is default-denied", () => {
  // ---- the premise: identical ranges, different semantics -----------------------------

  it("the three domains genuinely collide numerically — [0,1] and [-1,1] families are shared", async () => {
    // BELIEF stance scale is bipolar [-1,1].
    const belief = await getBeliefActionAlignmentScaleContractV0();
    expect(belief.contract.numeric_range.minimum).toBe(-1);
    expect(belief.contract.numeric_range.maximum).toBe(1);
    expect(belief.contract.domain_id).toBe("BELIEF");

    // RELATIONSHIP familiarity is a UnitIntervalV0 [0,1] quantity on a k/32 grid.
    const familiarityRange = INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_V0.input_range;
    expect(familiarityRange).toStrictEqual({
      minimum: 0,
      maximum: 1,
      minimum_inclusive: true,
      maximum_inclusive: true,
      non_finite: "FORBIDDEN"
    });
    expect(INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_V0.input_numeric_type).toBe(
      "UNIT_INTERVAL_V0"
    );

    // AFFECT activation lives in the SAME UnitIntervalV0 [0,1] family as
    // familiarity and belief credence; affect valence shares belief stance's
    // bipolar [-1,1] family. The shared [0,1] brand is what makes the numeric
    // ranges indistinguishable — and therefore what makes range alone useless
    // as an authorization signal.
    expect(validateUnitInterval(0.5, "affect.activation").ok).toBe(true);
    expect(validateUnitInterval(0.5, "relationship.familiarity").ok).toBe(true);
    expect(validateUnitInterval(0.5, "belief.credence").ok).toBe(true);
    // ...and the [0,1] constraint is real, not vacuous.
    expect(validateUnitInterval(-0.5, "out-of-range").ok).toBe(false);
    expect(validateUnitInterval(1.5, "out-of-range").ok).toBe(false);

    // The domains are nevertheless distinct identities.
    expect(new Set(DOMAIN_PARTICIPANTS.map((domain) => domain.domain_id)).size).toBe(3);
  });

  // ---- the existing default-deny gate -------------------------------------------------

  it("denies every operation for every cross-domain participant pairing", () => {
    const participants = DOMAIN_PARTICIPANTS.map(participantOf);

    for (let i = 0; i < participants.length; i++) {
      for (let j = 0; j < participants.length; j++) {
        const pair = [participants[i] as TendencyComparabilityParticipantV0, participants[j] as TendencyComparabilityParticipantV0];
        for (const operation of CROSS_DOMAIN_OPERATIONS_V0) {
          const label = `${DOMAIN_PARTICIPANTS[i]?.label} × ${DOMAIN_PARTICIPANTS[j]?.label} ${operation}`;
          expect(queryCrossDomainOperationAuthorizationV0(operation, pair), label).toBe("DENY");
        }
      }
    }

    // Degenerate arities deny too — there is no "no participants ⇒ allow" path.
    for (const operation of CROSS_DOMAIN_OPERATIONS_V0) {
      expect(queryCrossDomainOperationAuthorizationV0(operation, [])).toBe("DENY");
      expect(
        queryCrossDomainOperationAuthorizationV0(operation, [
          participants[0] as TendencyComparabilityParticipantV0
        ])
      ).toBe("DENY");
    }

    expect(DEFAULT_CROSS_DOMAIN_COMPARABILITY_V0).toBe("DENY");
  });

  it("names the exact fusion operations that stay unauthorized", () => {
    // ADD / MEAN / MAX / SUBTRACT_CANCEL / APPLY_SHARED_THRESHOLD are exactly the
    // operations a "generic 0..1 blending" implementation would need.
    const fusionOperations: readonly CrossDomainOperationV0[] = [
      "ADD",
      "SUBTRACT_CANCEL",
      "MEAN",
      "MAX",
      "APPLY_SHARED_THRESHOLD"
    ];
    const participants = [participantOf(DOMAIN_PARTICIPANTS[2] as (typeof DOMAIN_PARTICIPANTS)[number])];
    for (const operation of fusionOperations) {
      expect(CROSS_DOMAIN_OPERATIONS_V0).toContain(operation);
      expect(queryCrossDomainOperationAuthorizationV0(operation, participants)).toBe("DENY");
    }
  });

  it("even a structurally VALID comparability contract confers no authorization", async () => {
    const participants = [participantOf(DOMAIN_PARTICIPANTS[2] as (typeof DOMAIN_PARTICIPANTS)[number])];
    const wouldBeContract: TendencyComparabilityContractV0 = {
      schema_version: TENDENCY_COMPARABILITY_CONTRACT_SCHEMA_VERSION,
      comparability_contract_id: asId("would-be-cross-domain-contract-v0"),
      participant_scales: participants,
      participant_set_semantics: "EXACT_SET",
      authorized_operations: ["ADD", "MEAN", "MAX"],
      snapshot_policy: "SAME_BOUND_SNAPSHOT",
      action_space_policy: "EXACT_SAME_FINGERPRINT",
      unlisted_operation_policy: "DENY"
    };
    // It validates — validation is not authorization.
    expect(() => validateTendencyComparabilityContractV0(wouldBeContract)).not.toThrow();

    // No comparability contract is registered in V0, so the gate still denies.
    for (const operation of wouldBeContract.authorized_operations) {
      expect(queryCrossDomainOperationAuthorizationV0(operation, participants)).toBe("DENY");
    }

    // Widening an unlisted operation to ALLOW is rejected outright.
    expect(() =>
      validateTendencyComparabilityContractV0({
        ...wouldBeContract,
        unlisted_operation_policy: "ALLOW"
      } as unknown as TendencyComparabilityContractV0)
    ).toThrow();
  });

  // ---- the relationship contract's own fusion prohibitions -----------------------------

  it("the familiarity contract forbids numeric mapping, comparability, aggregation and normalization", () => {
    const contract = INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_V0;
    expect(contract.direct_numeric_mapping_authorized).toBe(false);
    expect(contract.cross_feature_comparability).toBe("DENY");
    expect(contract.aggregation_eligibility).toBe("NONE_BY_DEFAULT");
    expect(contract.normalization_authority).toBe("NONE");
    expect(contract.counterpart_binding_requirement).toBe("EXACT_CANONICAL_COUNTERPART_REF");
    expect(contract.provenance_requirements).toBe("EXACT_CURRENT_CANONICAL_RELATIONSHIP_PROJECTION_V0");
  });

  it("tampering any fusion literal on a familiarity-shaped contract is rejected by validation", () => {
    const base = structuredClone(
      INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_V0
    ) as unknown as Record<string, unknown>;

    // A "generic 0..1 blending" contract would need at least one of these.
    const tamperings: readonly { readonly field: string; readonly value: unknown }[] = [
      { field: "direct_numeric_mapping_authorized", value: true },
      { field: "cross_feature_comparability", value: "ALLOW" },
      { field: "aggregation_eligibility", value: "ELIGIBLE" },
      { field: "normalization_authority", value: "DOMAIN_NORMALIZED" }
    ];

    for (const tampering of tamperings) {
      const tampered = { ...base, [tampering.field]: tampering.value };
      expect(
        () => validateRelationshipFeatureDecisionSemanticsContractV0(tampered),
        `tampering ${tampering.field}`
      ).toThrow(RelationshipFeatureDecisionSemanticsValidationErrorV0);
    }

    // The untampered frozen contract still validates.
    expect(() =>
      validateRelationshipFeatureDecisionSemanticsContractV0(
        INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_V0
      )
    ).not.toThrow();
  });

  // ---- familiarity is not trust, and numericity is not authority ------------------------

  it("familiarity is NOT trust and being numeric authorizes nothing", () => {
    const contract = INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_V0;

    // The contract carries no trust/liking/quality semantic field at all: its
    // key set is the approved closed list.
    const keys = Object.keys(contract).sort();
    expect(keys).toStrictEqual(
      [
        "action_relation_requirement",
        "aggregation_eligibility",
        "counterpart_binding_requirement",
        "cross_feature_comparability",
        "decision_role",
        "direct_numeric_mapping_authorized",
        "dimension_id",
        "domain_id",
        "feature_semantics_contract_id",
        "input_numeric_type",
        "input_range",
        "lower_endpoint_semantics",
        "magnitude_semantics",
        "monotonicity_semantics",
        "neutral_or_reference_semantics",
        "normalization_authority",
        "polarity_semantics",
        "provenance_requirements",
        "quantity_semantics_id",
        "schema_version",
        "source_state_schema_version",
        "upper_endpoint_semantics"
      ].sort()
    );
    expect(keys.filter((key) => /trust|liking|quality|affinity|safety/i.test(key))).toStrictEqual([]);

    // The familiarity quantity semantics explicitly is NOT trust/liking/etc.
    expect(contract.quantity_semantics_id).toBe("accumulated-firsthand-counterpart-familiarity-v0");
    expect(contract.upper_endpoint_semantics.semantics_id).toBe("familiarity-credit-saturation-v0");

    // Decision use requires a typed relation that does not exist → a numeric
    // familiarity value authorizes no operation by itself.
    expect(contract.decision_role).toBe("MAGNITUDE_ONLY");
    expect(contract.action_relation_requirement).toBe(
      "EXACT_FEATURE_STATE_X_EXACT_ACTION_X_EXACT_COUNTERPART_TYPED_RELATION_REQUIRED"
    );
    expect(queryRelationshipFeatureDecisionAdmissionV0(INTERACTION_FAMILIARITY_DIMENSION_ID_V0)).toStrictEqual({
      decision_admission: "NOT_DECISION_ADMISSIBLE",
      reason: "NO_TYPED_ACTION_RELATION"
    });
  });

  // ---- no generic fusion helper exists on the surface -----------------------------------

  it("exposes no generic blend/fuse/mix/weight/average helper on the relationship surface", () => {
    const surface = Object.keys(relationshipFeatureSemanticsModule);
    const fusionPattern = /(blend|fuse|mix|weight|averag|\bsum\b|combine|compose)/i;
    expect(surface.filter((name) => fusionPattern.test(name))).toStrictEqual([]);
    // The cross-domain gate surface likewise carries no arithmetic helper.
    expect(
      Object.keys(relationshipFeatureSemanticsModule).filter((name) => /add|max|mean/i.test(name))
    ).toStrictEqual([]);
  });
});
