/**
 * Relationship Interaction Familiarity Feature V1 — contract suite
 * (RELATIONSHIP_REGISTERED_FEATURE_ADMISSION_V1, INTERACTION_FAMILIARITY_ONLY):
 *
 *   SEMANTICS / REGISTRY  exact admitted descriptor, exact pinned fingerprint,
 *                         registry count = 1, only interaction familiarity
 *                         admitted, unknown/wrong identity denied
 *   REPRESENTATION        k/32 grid exactness, ABSENT != PRESENT 0,
 *                         off-grid/non-finite/out-of-range rejection
 *   RECEIPT               deterministic receipt refs, stale-input sensitivity,
 *                         structural fail-closed validation, raw episode refs
 *                         are never credits
 *   ACCRUAL               initialize 1/32, one credit per receipt, duplicate /
 *                         decrease / equal-value / saturation / arbitrary-next
 *                         rejection, REINITIALIZE unsupported
 *   HISTORICAL LAW        single-record familiarity law vectors
 *   GENERIC WRITERS       generic Relationship surfaces still reject
 *                         relationship_core_interaction_familiarity_v0
 *
 * Fully OFFLINE: deterministic fixtures only — no model, no transport.
 */

import { describe, expect, it } from "vitest";

import type { CanonicalRefV0, UnitIntervalV0 } from "@characteros-next/subject-core";

import * as namespaceModule from "./relationship-governed-dimension-namespace.js";
import { initializeRelationshipState } from "./relationship-init.js";
import {
  validateRelationshipCounterpartRegistrationProposal
} from "./relationship-counterpart-registration-proposal.js";
import {
  validateRelationshipUpdateProposal
} from "./relationship-update-proposal.js";
import {
  validateRelationshipEvidenceChannelPolicy
} from "./relationship-evidence-channel-policy.js";
import {
  INTERACTION_FAMILIARITY_DIMENSION_ID_V0,
  INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_FINGERPRINT_V0,
  INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_ID_V0,
  INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_V0,
  INTERACTION_FAMILIARITY_QUANTITY_SEMANTICS_ID_V0,
  REGISTERED_RELATIONSHIP_DECISION_FEATURE_IDS_V0,
  RELATIONSHIP_FEATURE_DECISION_DOMAIN_ID_V0,
  RELATIONSHIP_FEATURE_DECISION_SOURCE_STATE_SCHEMA_VERSION_V0,
  RelationshipFeatureDecisionSemanticsResolutionErrorV0,
  deriveRelationshipFeatureDecisionSemanticsContractFingerprintV0,
  resolveRegisteredRelationshipFeatureDecisionSemanticsV0,
  validateRelationshipFeatureDecisionSemanticsContractV0
} from "./relationship-feature-decision-semantics.js";
import {
  RELATIONSHIP_INTERACTION_FAMILIARITY_EVIDENCE_ADMISSION_POLICY_ID_V0,
  RELATIONSHIP_INTERACTION_FAMILIARITY_EVIDENCE_RECEIPT_REF_KIND_V0,
  RELATIONSHIP_INTERACTION_FAMILIARITY_EVIDENCE_RECEIPT_SCHEMA_VERSION_V0,
  RELATIONSHIP_INTERACTION_FAMILIARITY_QUALIFYING_CLASSES_V0,
  deriveRelationshipInteractionFamiliarityEvidenceReceiptRefV0,
  isRelationshipInteractionFamiliarityEvidenceReceiptRefV0,
  validateRelationshipInteractionFamiliarityEvidenceReceiptV0,
  type RelationshipInteractionFamiliarityEvidenceReceiptV0
} from "./relationship-interaction-familiarity-evidence-receipt.js";
import {
  RELATIONSHIP_INTERACTION_FAMILIARITY_ACCRUAL_POLICY_ID_V0,
  RELATIONSHIP_INTERACTION_FAMILIARITY_GRID_DENOMINATOR_V0,
  classifyInteractionFamiliarityGridValueV0,
  deriveInteractionFamiliarityInitializationV0,
  deriveInteractionFamiliarityUpdateV0,
  enforceInteractionFamiliarityLiveLawV0,
  validateInteractionFamiliarityAuthorityLawV0
} from "./relationship-interaction-familiarity-accrual-policy.js";
import {
  validateRelationshipGovernedFeatureWriterAuthorityPayloadV0
} from "./relationship-governed-writer-authority.js";

const asUnit = (value: number) => value as UnitIntervalV0;
const asRef = (value: string) => value as CanonicalRefV0;

const WRONG_HASH = "sha256:2222222222222222222222222222222222222222222222222222222222222222";

// ---- fixtures -------------------------------------------------------------------------

function receiptFixture(
  overrides: Partial<RelationshipInteractionFamiliarityEvidenceReceiptV0> = {}
): RelationshipInteractionFamiliarityEvidenceReceiptV0 {
  return {
    schema_version: RELATIONSHIP_INTERACTION_FAMILIARITY_EVIDENCE_RECEIPT_SCHEMA_VERSION_V0,
    subject_id: "subject-s0" as never,
    counterpart_ref: asRef("entity:alice-like"),
    episode_ref: asRef("episode:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
    episode_payload_hash: WRONG_HASH as never,
    qualifying_class: "DIRECT_COMMUNICATION",
    evidence_admission_policy_id: RELATIONSHIP_INTERACTION_FAMILIARITY_EVIDENCE_ADMISSION_POLICY_ID_V0,
    ...overrides
  };
}

async function receiptRef(
  overrides: Partial<RelationshipInteractionFamiliarityEvidenceReceiptV0> = {}
): Promise<string> {
  return deriveRelationshipInteractionFamiliarityEvidenceReceiptRefV0(receiptFixture(overrides));
}

function familiarityPayloadFixture(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    schema_version: "relationship-governed-feature-writer-authority-payload-v0",
    operation_kind: "INITIALIZE",
    subject_id: "subject-s0",
    expected_revision: 0,
    counterpart_ref: "entity:alice-like",
    dimension_id: INTERACTION_FAMILIARITY_DIMENSION_ID_V0,
    previous: { kind: "ABSENT" },
    next: { kind: "PRESENT", value: asUnit(1 / 32) },
    relationship_state_schema_version: "relationship-state-v0",
    feature_semantics_contract_id: INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_ID_V0,
    feature_semantics_contract_fingerprint: INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_FINGERPRINT_V0,
    write_policy_id: "relationship-governed-feature-write-policy-v0",
    write_policy_fingerprint: WRONG_HASH,
    evidence_receipt_refs: [asRef("appraisal:1111111111111111111111111111111111111111111111111111111111111111")],
    write_policy_receipt_ref: asRef("workflow:3333333333333333333333333333333333333333333333333333333333333333"),
    authority_epoch_start_transition_id: "t-familiarity-1",
    previous_governed_authority: { kind: "NONE" },
    ...overrides
  };
}

function validatedPayload(overrides: Record<string, unknown> = {}) {
  const checked = validateRelationshipGovernedFeatureWriterAuthorityPayloadV0(
    familiarityPayloadFixture(overrides)
  );
  if (!checked.ok) throw new Error(`fixture payload invalid: ${checked.error.detail}`);
  return checked.value;
}

function expectResolutionError(run: () => unknown, code: string): void {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(RelationshipFeatureDecisionSemanticsResolutionErrorV0);
    expect((error as RelationshipFeatureDecisionSemanticsResolutionErrorV0).code).toBe(code);
    return;
  }
  throw new Error(`expected resolution error ${code}`);
}

// ---- semantics / registry ---------------------------------------------------------------

describe("interaction familiarity semantics admission", () => {
  it("registers exactly ONE real governed feature: interaction familiarity", () => {
    expect(Object.isFrozen(REGISTERED_RELATIONSHIP_DECISION_FEATURE_IDS_V0)).toBe(true);
    expect([...REGISTERED_RELATIONSHIP_DECISION_FEATURE_IDS_V0]).toStrictEqual([
      INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_ID_V0
    ]);
  });

  it("carries the exact normative descriptor", () => {
    const contract = INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_V0;
    validateRelationshipFeatureDecisionSemanticsContractV0(contract);
    expect(contract.schema_version).toBe("relationship-feature-decision-semantics-contract-v0");
    expect(contract.feature_semantics_contract_id).toBe(
      "relationship-interaction-familiarity-semantics-v0"
    );
    expect(contract.dimension_id).toBe("relationship_core_interaction_familiarity_v0");
    expect(contract.domain_id).toBe("RELATIONSHIP");
    expect(contract.source_state_schema_version).toBe("relationship-state-v0");
    expect(contract.input_numeric_type).toBe("UNIT_INTERVAL_V0");
    expect(contract.input_range).toStrictEqual({
      minimum: 0,
      maximum: 1,
      minimum_inclusive: true,
      maximum_inclusive: true,
      non_finite: "FORBIDDEN"
    });
    expect(contract.quantity_semantics_id).toBe(INTERACTION_FAMILIARITY_QUANTITY_SEMANTICS_ID_V0);
    expect(contract.lower_endpoint_semantics).toStrictEqual({
      value: 0,
      semantics_id: "no-credited-qualifying-firsthand-counterpart-interaction-v0"
    });
    expect(contract.upper_endpoint_semantics).toStrictEqual({
      value: 1,
      semantics_id: "familiarity-credit-saturation-v0"
    });
    expect(contract.neutral_or_reference_semantics).toStrictEqual({
      neutral: { kind: "NONE" },
      reference: { kind: "LOWER_ENDPOINT" }
    });
    expect(contract.polarity_semantics).toBe("UNSIGNED");
    expect(contract.magnitude_semantics).toStrictEqual({ kind: "NONE" });
    expect(contract.monotonicity_semantics).toBe("INCREASING_QUANTITY");
    expect(contract.decision_role).toBe("MAGNITUDE_ONLY");
    expect(contract.action_relation_requirement).toBe(
      "EXACT_FEATURE_STATE_X_EXACT_ACTION_X_EXACT_COUNTERPART_TYPED_RELATION_REQUIRED"
    );
    expect(contract.counterpart_binding_requirement).toBe("EXACT_CANONICAL_COUNTERPART_REF");
    expect(contract.direct_numeric_mapping_authorized).toBe(false);
    expect(contract.cross_feature_comparability).toBe("DENY");
    expect(contract.aggregation_eligibility).toBe("NONE_BY_DEFAULT");
    expect(contract.normalization_authority).toBe("NONE");
    expect(contract.provenance_requirements).toBe("EXACT_CURRENT_CANONICAL_RELATIONSHIP_PROJECTION_V0");
    expect(Object.isFrozen(contract)).toBe(true);
  });

  it("pins the EXACT semantics fingerprint and derivation matches the pin", async () => {
    expect(INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_FINGERPRINT_V0).toMatch(
      /^sha256:[0-9a-f]{64}$/
    );
    const derived = await deriveRelationshipFeatureDecisionSemanticsContractFingerprintV0(
      INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_V0
    );
    expect(derived).toBe(INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_FINGERPRINT_V0);
    const again = await deriveRelationshipFeatureDecisionSemanticsContractFingerprintV0(
      INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_V0
    );
    expect(again).toBe(derived);
  });

  it("admits ONLY the exact interaction-familiarity identity and denies every other", () => {
    const admitted = resolveRegisteredRelationshipFeatureDecisionSemanticsV0({
      domain_id: RELATIONSHIP_FEATURE_DECISION_DOMAIN_ID_V0,
      source_state_schema_version: RELATIONSHIP_FEATURE_DECISION_SOURCE_STATE_SCHEMA_VERSION_V0,
      dimension_id: INTERACTION_FAMILIARITY_DIMENSION_ID_V0,
      feature_semantics_contract_id: INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_ID_V0,
      feature_semantics_contract_fingerprint: INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_FINGERPRINT_V0
    });
    expect(admitted.feature_semantics_contract_id).toBe(
      INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_ID_V0
    );

    // unknown feature
    expectResolutionError(
      () =>
        resolveRegisteredRelationshipFeatureDecisionSemanticsV0({
          domain_id: RELATIONSHIP_FEATURE_DECISION_DOMAIN_ID_V0,
          source_state_schema_version: RELATIONSHIP_FEATURE_DECISION_SOURCE_STATE_SCHEMA_VERSION_V0,
          dimension_id: "relationship_core_trust_like_v0" as never,
          feature_semantics_contract_id: "relationship-trust-semantics-v0",
          feature_semantics_contract_fingerprint: INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_FINGERPRINT_V0
        }),
      "UNKNOWN_FEATURE_SEMANTICS"
    );
    // wrong fingerprint on the admitted id
    expectResolutionError(
      () =>
        resolveRegisteredRelationshipFeatureDecisionSemanticsV0({
          domain_id: RELATIONSHIP_FEATURE_DECISION_DOMAIN_ID_V0,
          source_state_schema_version: RELATIONSHIP_FEATURE_DECISION_SOURCE_STATE_SCHEMA_VERSION_V0,
          dimension_id: INTERACTION_FAMILIARITY_DIMENSION_ID_V0,
          feature_semantics_contract_id: INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_ID_V0,
          feature_semantics_contract_fingerprint: WRONG_HASH
        }),
      "FEATURE_SEMANTICS_FINGERPRINT_MISMATCH"
    );
    // wrong dimension on the admitted id
    expectResolutionError(
      () =>
        resolveRegisteredRelationshipFeatureDecisionSemanticsV0({
          domain_id: RELATIONSHIP_FEATURE_DECISION_DOMAIN_ID_V0,
          source_state_schema_version: RELATIONSHIP_FEATURE_DECISION_SOURCE_STATE_SCHEMA_VERSION_V0,
          dimension_id: "relationship_core_other_v0" as never,
          feature_semantics_contract_id: INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_ID_V0,
          feature_semantics_contract_fingerprint: INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_FINGERPRINT_V0
        }),
      "FEATURE_IDENTITY_MISMATCH"
    );
    // wrong domain / source state schema
    expectResolutionError(
      () =>
        resolveRegisteredRelationshipFeatureDecisionSemanticsV0({
          domain_id: "BELIEF" as never,
          source_state_schema_version: RELATIONSHIP_FEATURE_DECISION_SOURCE_STATE_SCHEMA_VERSION_V0,
          dimension_id: INTERACTION_FAMILIARITY_DIMENSION_ID_V0,
          feature_semantics_contract_id: INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_ID_V0,
          feature_semantics_contract_fingerprint: INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_FINGERPRINT_V0
        }),
      "FEATURE_IDENTITY_MISMATCH"
    );
    expectResolutionError(
      () =>
        resolveRegisteredRelationshipFeatureDecisionSemanticsV0({
          domain_id: RELATIONSHIP_FEATURE_DECISION_DOMAIN_ID_V0,
          source_state_schema_version: "belief-state-v0" as never,
          dimension_id: INTERACTION_FAMILIARITY_DIMENSION_ID_V0,
          feature_semantics_contract_id: INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_ID_V0,
          feature_semantics_contract_fingerprint: INTERACTION_FAMILIARITY_FEATURE_SEMANTICS_CONTRACT_FINGERPRINT_V0
        }),
      "FEATURE_IDENTITY_MISMATCH"
    );
  });
});

// ---- receipt -----------------------------------------------------------------------------

describe("interaction familiarity evidence receipt", () => {
  it("derives an appraisal-family ref deterministically from identical canonical inputs", async () => {
    const first = await receiptRef();
    const second = await receiptRef();
    expect(first).toBe(second);
    expect(first.startsWith(`${RELATIONSHIP_INTERACTION_FAMILIARITY_EVIDENCE_RECEIPT_REF_KIND_V0}:`)).toBe(true);
    expect(first).toMatch(/^appraisal:[0-9a-f]{64}$/);
  });

  it("changes the ref when any bound identity input changes", async () => {
    const base = await receiptRef();
    expect(await receiptRef({ episode_payload_hash: "sha256:3333333333333333333333333333333333333333333333333333333333333333" as never })).not.toBe(base);
    expect(await receiptRef({ counterpart_ref: asRef("entity:bob-like") })).not.toBe(base);
    expect(await receiptRef({ qualifying_class: "SHARED_ACTIVITY" })).not.toBe(base);
    expect(await receiptRef({ episode_ref: asRef("episode:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb") })).not.toBe(base);
    expect(await receiptRef({ subject_id: "subject-s1" as never })).not.toBe(base);
  });

  it("fails closed on malformed receipts", () => {
    expect(validateRelationshipInteractionFamiliarityEvidenceReceiptV0({ nope: true }).ok).toBe(false);
    expect(
      validateRelationshipInteractionFamiliarityEvidenceReceiptV0({
        ...receiptFixture(),
        extra_key: 1
      }).ok
    ).toBe(false);
    expect(
      validateRelationshipInteractionFamiliarityEvidenceReceiptV0({
        ...receiptFixture(),
        episode_payload_hash: undefined
      }).ok
    ).toBe(false);
    expect(
      validateRelationshipInteractionFamiliarityEvidenceReceiptV0({
        ...receiptFixture(),
        qualifying_class: "SOME_FREE_FORM_CLASS"
      }).ok
    ).toBe(false);
    expect(
      validateRelationshipInteractionFamiliarityEvidenceReceiptV0({
        ...receiptFixture(),
        episode_ref: "not-a-canonical-ref" as never
      }).ok
    ).toBe(false);
    expect(
      validateRelationshipInteractionFamiliarityEvidenceReceiptV0({
        ...receiptFixture(),
        evidence_admission_policy_id: "some-other-policy-v0"
      }).ok
    ).toBe(false);
    // the closed V0 class vocabulary has exactly three members
    expect([...RELATIONSHIP_INTERACTION_FAMILIARITY_QUALIFYING_CLASSES_V0]).toStrictEqual([
      "DIRECT_COMMUNICATION",
      "SHARED_ACTIVITY",
      "DIRECTLY_OBSERVED_COUNTERPART_ACTION"
    ]);
  });

  it("never treats a raw episode ref as a familiarity credit identity", () => {
    expect(isRelationshipInteractionFamiliarityEvidenceReceiptRefV0("episode:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")).toBe(false);
    expect(isRelationshipInteractionFamiliarityEvidenceReceiptRefV0("memory:whatever")).toBe(false);
    expect(isRelationshipInteractionFamiliarityEvidenceReceiptRefV0("appraisal:1111111111111111111111111111111111111111111111111111111111111111")).toBe(true);
    expect(
      deriveInteractionFamiliarityInitializationV0({
        evidence_receipt_refs: [asRef("episode:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")]
      })
    ).toMatchObject({ ok: false, code: "FAMILIARITY_EVIDENCE_NOT_RECEIPT_REF" });
  });
});

// ---- representation / grid -----------------------------------------------------------------

describe("interaction familiarity grid representation", () => {
  it("accepts every exact k/32 grid value with exact binary-safe k", () => {
    for (let k = 0; k <= RELATIONSHIP_INTERACTION_FAMILIARITY_GRID_DENOMINATOR_V0; k++) {
      const checked = classifyInteractionFamiliarityGridValueV0(k / 32);
      expect(checked.ok, `k=${k}`).toBe(true);
      if (checked.ok) expect(checked.k).toBe(k);
    }
  });

  it("rejects off-grid, non-finite and out-of-range values", () => {
    for (const value of [0.1, 1 / 3, 0.97, 0.033, 2 / 3, 0.999]) {
      expect(classifyInteractionFamiliarityGridValueV0(value).ok, `off-grid ${String(value)}`).toBe(false);
    }
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(classifyInteractionFamiliarityGridValueV0(value).ok).toBe(false);
    }
    expect(classifyInteractionFamiliarityGridValueV0(1.5).ok).toBe(false);
    expect(classifyInteractionFamiliarityGridValueV0(-1 / 32).ok).toBe(false);
    expect(classifyInteractionFamiliarityGridValueV0("0.5").ok).toBe(false);
  });

  it("keeps ABSENT distinct from PRESENT 0: familiarity is never initialized at 0", () => {
    // 0 is on the grid, but the INITIALIZATION law only ever produces 1/32;
    // a proposal presenting next = 0 for an ABSENT target is rejected.
    const zero = enforceInteractionFamiliarityLiveLawV0({
      operation: "INITIALIZE",
      previous: { kind: "ABSENT" },
      next: { kind: "PRESENT", value: 0 },
      proposed_receipt_refs: [asRef("appraisal:1111111111111111111111111111111111111111111111111111111111111111")],
      prior: { kind: "NONE" }
    });
    expect(zero).toMatchObject({ ok: false, code: "FAMILIARITY_VALUE_LAW_MISMATCH" });
    const lawful = enforceInteractionFamiliarityLiveLawV0({
      operation: "INITIALIZE",
      previous: { kind: "ABSENT" },
      next: { kind: "PRESENT", value: 1 / 32 },
      proposed_receipt_refs: [asRef("appraisal:1111111111111111111111111111111111111111111111111111111111111111")],
      prior: { kind: "NONE" }
    });
    expect(lawful).toMatchObject({ ok: true, k: 1 });
  });
});

// ---- accrual -------------------------------------------------------------------------------

describe("interaction familiarity accrual law", () => {
  const R1 = "appraisal:1111111111111111111111111111111111111111111111111111111111111111";
  const R2 = "appraisal:2222222222222222222222222222222222222222222222222222222222222222";
  const R3 = "appraisal:3333333333333333333333333333333333333333333333333333333333333333";

  it("derives INITIALIZE 1/32 from exactly one receipt", () => {
    const derived = deriveInteractionFamiliarityInitializationV0({ evidence_receipt_refs: [asRef(R1)] });
    expect(derived).toMatchObject({ ok: true, k: 1, next_value: 1 / 32 });
    expect(deriveInteractionFamiliarityInitializationV0({ evidence_receipt_refs: [] })).toMatchObject({
      ok: false,
      code: "FAMILIARITY_EVIDENCE_CARDINALITY_MISMATCH"
    });
    expect(
      deriveInteractionFamiliarityInitializationV0({ evidence_receipt_refs: [asRef(R1), asRef(R2)] })
    ).toMatchObject({ ok: false, code: "FAMILIARITY_EVIDENCE_CARDINALITY_MISMATCH" });
  });

  it("advances UPDATE exactly one grid level per new receipt", () => {
    const derived = deriveInteractionFamiliarityUpdateV0({
      prior_receipt_refs: [asRef(R1)],
      proposed_receipt_refs: [asRef(R1), asRef(R2)],
      previous_value: 1 / 32
    });
    expect(derived).toMatchObject({ ok: true, k: 2, next_value: 2 / 32 });
    const third = deriveInteractionFamiliarityUpdateV0({
      prior_receipt_refs: [asRef(R1), asRef(R2)],
      proposed_receipt_refs: [asRef(R1), asRef(R2), asRef(R3)],
      previous_value: 2 / 32
    });
    expect(third).toMatchObject({ ok: true, k: 3, next_value: 3 / 32 });
  });

  it("rejects duplicate, decrease, equal-value and arbitrary-set updates", () => {
    // duplicate: proposed set equals the prior set (no new credit)
    expect(
      deriveInteractionFamiliarityUpdateV0({
        prior_receipt_refs: [asRef(R1)],
        proposed_receipt_refs: [asRef(R1)],
        previous_value: 1 / 32
      })
    ).toMatchObject({ ok: false, code: "FAMILIARITY_DUPLICATE_RECEIPT" });
    // decrease: proposed set is smaller than the prior set
    expect(
      deriveInteractionFamiliarityUpdateV0({
        prior_receipt_refs: [asRef(R1), asRef(R2)],
        proposed_receipt_refs: [asRef(R1)],
        previous_value: 2 / 32
      })
    ).toMatchObject({ ok: false, code: "FAMILIARITY_EVIDENCE_CARDINALITY_MISMATCH" });
    // dropped prior receipt with an added one (set continuity broken)
    expect(
      deriveInteractionFamiliarityUpdateV0({
        prior_receipt_refs: [asRef(R1), asRef(R2)],
        proposed_receipt_refs: [asRef(R1), asRef(R3)],
        previous_value: 2 / 32
      })
    ).toMatchObject({ ok: false, code: "FAMILIARITY_EVIDENCE_CARDINALITY_MISMATCH" });
    // previous value disagrees with |R_prev|/32
    expect(
      deriveInteractionFamiliarityUpdateV0({
        prior_receipt_refs: [asRef(R1)],
        proposed_receipt_refs: [asRef(R1), asRef(R2)],
        previous_value: 2 / 32
      })
    ).toMatchObject({ ok: false, code: "FAMILIARITY_PRIOR_VALUE_MISMATCH" });
    // malformed prior lineage
    expect(
      deriveInteractionFamiliarityUpdateV0({
        prior_receipt_refs: [],
        proposed_receipt_refs: [asRef(R1)],
        previous_value: 0
      })
    ).toMatchObject({ ok: false, code: "FAMILIARITY_PRIOR_LINEAGE_MALFORMED" });
  });

  it("saturates at 32/32: the 33rd receipt produces NO state advancement", () => {
    const full = Array.from({ length: 32 }, (_, i) =>
      asRef(`appraisal:${(i + 1).toString().padStart(64, "0")}`)
    );
    const saturated = deriveInteractionFamiliarityUpdateV0({
      prior_receipt_refs: full,
      proposed_receipt_refs: [...full, asRef(R3)],
      previous_value: 1
    });
    expect(saturated).toMatchObject({ ok: false, code: "FAMILIARITY_SATURATED_NO_PROPOSAL" });
    expect(saturated.ok).toBe(false);
  });

  it("rejects an arbitrary caller-selected next value and REINITIALIZE", () => {
    // caller proposes 0.5 (16/32) where the law derives 2/32
    expect(
      enforceInteractionFamiliarityLiveLawV0({
        operation: "UPDATE",
        previous: { kind: "PRESENT", value: asUnit(1 / 32) },
        next: { kind: "PRESENT", value: asUnit(0.5) },
        proposed_receipt_refs: [asRef(R1), asRef(R2)],
        prior: { kind: "PRIOR", receipt_refs: [asRef(R1)] }
      })
    ).toMatchObject({ ok: false, code: "FAMILIARITY_VALUE_LAW_MISMATCH" });
    expect(
      enforceInteractionFamiliarityLiveLawV0({
        operation: "REINITIALIZE",
        previous: { kind: "PRESENT", value: asUnit(1 / 32) },
        next: { kind: "PRESENT", value: asUnit(2 / 32) },
        proposed_receipt_refs: [asRef(R1), asRef(R2)],
        prior: { kind: "NONE" }
      })
    ).toMatchObject({ ok: false, code: "FAMILIARITY_REINITIALIZE_UNSUPPORTED" });
    // an UPDATE without a proven prior is not a lawful bootstrap
    expect(
      enforceInteractionFamiliarityLiveLawV0({
        operation: "UPDATE",
        previous: { kind: "PRESENT", value: asUnit(1 / 32) },
        next: { kind: "PRESENT", value: asUnit(2 / 32) },
        proposed_receipt_refs: [asRef(R1), asRef(R2)],
        prior: { kind: "NONE" }
      })
    ).toMatchObject({ ok: false, code: "FAMILIARITY_PRIOR_LINEAGE_MISMATCH" });
  });

  it("exposes the frozen accrual policy identity", () => {
    expect(RELATIONSHIP_INTERACTION_FAMILIARITY_ACCRUAL_POLICY_ID_V0).toBe(
      "relationship-interaction-familiarity-accrual-policy-v0"
    );
  });
});

// ---- historical single-record law ---------------------------------------------------------

describe("interaction familiarity historical authority law", () => {
  const R1 = "appraisal:1111111111111111111111111111111111111111111111111111111111111111";
  const R2 = "appraisal:2222222222222222222222222222222222222222222222222222222222222222";
  const PRIOR = {
    kind: "PRIOR",
    commit_ref: "commit:4444444444444444444444444444444444444444444444444444444444444444",
    authority_payload_hash: WRONG_HASH
  } as const;

  it("accepts lawful INITIALIZE and UPDATE authority payloads", () => {
    expect(validateInteractionFamiliarityAuthorityLawV0(validatedPayload())).toEqual({ ok: true });
    expect(
      validateInteractionFamiliarityAuthorityLawV0(
        validatedPayload({
          operation_kind: "UPDATE",
          expected_revision: 1,
          previous: { kind: "PRESENT", value: asUnit(1 / 32) },
          next: { kind: "PRESENT", value: asUnit(2 / 32) },
          evidence_receipt_refs: [asRef(R1), asRef(R2)],
          authority_epoch_start_transition_id: "t-epoch-0",
          previous_governed_authority: PRIOR
        })
      )
    ).toEqual({ ok: true });
  });

  it("rejects off-grid values, wrong cardinality and non-receipt evidence", () => {
    // off-grid next
    expect(
      validateInteractionFamiliarityAuthorityLawV0(validatedPayload({ next: { kind: "PRESENT", value: asUnit(0.1) } }))
    ).toMatchObject({ ok: false, code: "FAMILIARITY_OFF_GRID_VALUE" });
    // INITIALIZE at 2/32 instead of 1/32
    expect(
      validateInteractionFamiliarityAuthorityLawV0(validatedPayload({ next: { kind: "PRESENT", value: asUnit(2 / 32) } }))
    ).toMatchObject({ ok: false, code: "FAMILIARITY_VALUE_LAW_MISMATCH" });
    // two receipts at INITIALIZE
    expect(
      validateInteractionFamiliarityAuthorityLawV0(
        validatedPayload({ evidence_receipt_refs: [asRef(R1), asRef(R2)] })
      )
    ).toMatchObject({ ok: false, code: "FAMILIARITY_EVIDENCE_CARDINALITY_MISMATCH" });
    // raw episode ref as evidence
    expect(
      validateInteractionFamiliarityAuthorityLawV0(
        validatedPayload({ evidence_receipt_refs: ["episode:5555555555555555555555555555555555555555555555555555555555555555"] })
      )
    ).toMatchObject({ ok: false, code: "FAMILIARITY_EVIDENCE_NOT_RECEIPT_REF" });
    // 33 cumulative receipts (beyond saturation)
    const thirtyThree = Array.from({ length: 33 }, (_, i) =>
      asRef(`appraisal:${(i + 1).toString().padStart(64, "0")}`)
    );
    expect(
      validateInteractionFamiliarityAuthorityLawV0(
        validatedPayload({
          operation_kind: "UPDATE",
          previous: { kind: "PRESENT", value: asUnit(1) },
          next: { kind: "PRESENT", value: asUnit(1) },
          evidence_receipt_refs: thirtyThree,
          previous_governed_authority: PRIOR
        })
      )
    ).toMatchObject({ ok: false, code: "FAMILIARITY_EVIDENCE_CARDINALITY_MISMATCH" });
  });

  it("rejects wrong lineage and value arithmetic on UPDATE", () => {
    const updateOverrides = {
      operation_kind: "UPDATE",
      expected_revision: 1,
      previous: { kind: "PRESENT", value: asUnit(1 / 32) },
      next: { kind: "PRESENT", value: asUnit(2 / 32) },
      evidence_receipt_refs: [asRef(R1), asRef(R2)],
      authority_epoch_start_transition_id: "t-epoch-0"
    };
    // UPDATE without a PRIOR chain
    expect(
      validateInteractionFamiliarityAuthorityLawV0(validatedPayload(updateOverrides))
    ).toMatchObject({ ok: false, code: "FAMILIARITY_PRIOR_LINEAGE_MISMATCH" });
    // previous value disagrees with (|R_next|-1)/32
    expect(
      validateInteractionFamiliarityAuthorityLawV0(
        validatedPayload({ ...updateOverrides, previous: { kind: "PRESENT", value: asUnit(3 / 32) }, previous_governed_authority: PRIOR })
      )
    ).toMatchObject({ ok: false, code: "FAMILIARITY_PRIOR_VALUE_MISMATCH" });
    // next disagrees with |R_next|/32
    expect(
      validateInteractionFamiliarityAuthorityLawV0(
        validatedPayload({
          ...updateOverrides,
          next: { kind: "PRESENT", value: asUnit(4 / 32) },
          previous: { kind: "PRESENT", value: asUnit(1 / 32) },
          previous_governed_authority: PRIOR
        })
      )
    ).toMatchObject({ ok: false, code: "FAMILIARITY_VALUE_LAW_MISMATCH" });
    // REINITIALIZE never lawful
    expect(
      validateInteractionFamiliarityAuthorityLawV0(
        validatedPayload({
          operation_kind: "REINITIALIZE",
          previous: { kind: "PRESENT", value: asUnit(1 / 32) },
          evidence_receipt_refs: [asRef(R1), asRef(R2)],
          previous_governed_authority: PRIOR
        })
      )
    ).toMatchObject({ ok: false, code: "FAMILIARITY_REINITIALIZE_UNSUPPORTED" });
    // a different governed dimension is out of the familiarity law's scope
    expect(
      validateInteractionFamiliarityAuthorityLawV0(
        validatedPayload({ dimension_id: "relationship_core_other_v0" })
      )
    ).toMatchObject({ ok: false, code: "FAMILIARITY_DIMENSION_MISMATCH" });
  });
});

// ---- generic writers remain closed for the admitted dimension -----------------------------

describe("generic writers still reject relationship_core_interaction_familiarity_v0", () => {
  const FAMILIARITY = INTERACTION_FAMILIARITY_DIMENSION_ID_V0;
  const asCounterpart = (value: string) => value as never;

  it("rejects the admitted dimension at generic initialization", () => {
    expect(() =>
      initializeRelationshipState([
        {
          counterpart_ref: "entity:alice-like",
          dimensions: [{ dimension_id: FAMILIARITY, value: asUnit(1 / 32) }]
        } as never
      ])
    ).toThrow(/RESERVED_DIMENSION_FORBIDDEN/);
  });

  it("rejects the admitted dimension at generic counterpart registration and update", () => {
    const registration = validateRelationshipCounterpartRegistrationProposal({
      schema_version: "relationship-counterpart-registration-proposal-v0",
      subject_id: "subject-s0",
      expected_state_revision: 0,
      counterpart_ref: asCounterpart("entity:alice-like"),
      dimensions: [{ dimension_id: FAMILIARITY, value: 1 / 32 }],
      evidence_binding: {
        member_refs: ["episode:ep-01"],
        member_set_fingerprint: WRONG_HASH
      }
    } as never);
    expect(registration.ok).toBe(false);
    if (!registration.ok) {
      expect(registration.error.detail).toMatch(/reserved relationship_core_\* dimension forbidden/);
    }

    const update = validateRelationshipUpdateProposal({
      schema_version: "relationship-update-proposal-v0",
      subject_id: "subject-s0",
      expected_state_revision: 0,
      counterpart_ref: asCounterpart("entity:alice-like"),
      updates: [{ dimension_id: FAMILIARITY, next_value: 2 / 32 }],
      evidence_binding: {
        member_refs: ["episode:ep-01"],
        member_set_fingerprint: WRONG_HASH
      }
    } as never);
    expect(update.ok).toBe(false);
    if (!update.ok) {
      expect(update.error.detail).toMatch(/reserved relationship_core_\* dimension forbidden/);
    }
  });

  it("rejects the admitted dimension in generic evidence channel policies", () => {
    const policy = validateRelationshipEvidenceChannelPolicy({
      schema_version: "relationship-evidence-channel-policy-v0",
      policy_id: "test-channel-policy-v0",
      channels: [
        {
          channel_id: "test_channel_a",
          target_dimension_id: FAMILIARITY,
          direction: "INCREASE"
        }
      ]
    } as never);
    expect(policy.ok).toBe(false);
    if (!policy.ok) {
      expect(policy.error.detail).toMatch(/reserved relationship_core_\* dimension forbidden/);
    }
  });

  it("keeps the namespace surface closed (no bypass switch)", () => {
    const surface = Object.keys(namespaceModule).sort();
    expect(surface.filter((name) => /^(allow|bypass|enable|internal)[A-Z_]*$/i.test(name))).toStrictEqual([]);
    expect(surface).toContain("isReservedRelationshipCoreDimensionIdV0");
    expect(isRelationshipInteractionFamiliarityEvidenceReceiptRefV0("appraisal:1")).toBe(true);
  });
});
