/**
 * Relationship Reserved Namespace and Generic Writer Hardening V0 —
 * acceptance suite (§20-§29): exact prefix classification, generic
 * initialization denial, counterpart-registration denial (validator + executor
 * wiring), generic direct-update denial, evidence-channel-policy denial,
 * plasticity fail-closed propagation, zero registered features, frozen
 * denial-only V0 admission for reserved ids, and the closed no-side-effect
 * public surface.
 *
 * Ordinary opaque non-reserved dimensions are proven to retain their existing
 * generic behavior at every choke point. Fully OFFLINE: no model, no
 * transport, no real-model smoke.
 */

import { describe, expect, it } from "vitest";

import type { IdentifierV0, UnitIntervalV0 } from "@characteros-next/subject-core";

import {
  RELATIONSHIP_GOVERNED_DIMENSION_RESERVED_PREFIX_V0,
  isReservedRelationshipCoreDimensionIdV0
} from "./relationship-governed-dimension-namespace.js";
import * as namespaceModule from "./relationship-governed-dimension-namespace.js";
import {
  initializeRelationshipState
} from "./relationship-init.js";
import {
  validateRelationshipCounterpartRegistrationProposal,
  type RelationshipCounterpartRegistrationProposalV0
} from "./relationship-counterpart-registration-proposal.js";
import { RelationshipCounterpartRegistrationExecutor } from "./relationship-counterpart-registration-executor.js";
import {
  validateRelationshipUpdateProposal
} from "./relationship-update-proposal.js";
import { RelationshipTransitionExecutor } from "./relationship-transition-executor.js";
import {
  validateRelationshipEvidenceChannelPolicy,
  type RelationshipEvidenceChannelPolicyV0
} from "./relationship-evidence-channel-policy.js";
import {
  REGISTERED_RELATIONSHIP_DECISION_FEATURE_IDS_V0,
  queryRelationshipFeatureDecisionAdmissionV0
} from "./relationship-feature-decision-semantics.js";

// ---- deterministic fixtures -------------------------------------------------------

const ALICE = "entity:alice-like";
const RESERVED_ID = "relationship_core_relational_bond_strength_v0";
const OPAQUE_ID = "arbitrary_host_dimension";

function counterpartRef(value: string) {
  return value as unknown as RelationshipCounterpartRegistrationProposalV0["counterpart_ref"];
}

const asId = (value: string) => value as IdentifierV0;
const asUnit = (value: number) => value as UnitIntervalV0;

function registrationProposalFixture(dimensionId: string): unknown {
  return {
    schema_version: "relationship-counterpart-registration-proposal-v0",
    subject_id: "subject-s0",
    expected_state_revision: 0,
    counterpart_ref: counterpartRef(ALICE),
    dimensions: [{ dimension_id: dimensionId, value: 0.5 }],
    evidence_binding: {
      member_refs: ["episode:ep-01"],
      member_set_fingerprint:
        "sha256:0000000000000000000000000000000000000000000000000000000000000000"
    }
  };
}

function updateProposalFixture(dimensionId: string): unknown {
  return {
    schema_version: "relationship-update-proposal-v0",
    subject_id: "subject-s0",
    expected_state_revision: 0,
    counterpart_ref: counterpartRef(ALICE),
    updates: [{ dimension_id: dimensionId, next_value: 0.75 }],
    evidence_binding: {
      member_refs: ["episode:ep-01"],
      member_set_fingerprint:
        "sha256:0000000000000000000000000000000000000000000000000000000000000000"
    }
  };
}

function channelPolicyFixture(targetDimensionId: string): unknown {
  return {
    schema_version: "relationship-evidence-channel-policy-v0",
    policy_id: "test-channel-policy-v0",
    channels: [
      {
        channel_id: "test_channel_a",
        target_dimension_id: targetDimensionId,
        direction: "INCREASE"
      }
    ]
  };
}

/** Executor deps are never reached before validation rejects; safe dummies. */
function executorDepsStub(): ConstructorParameters<typeof RelationshipTransitionExecutor>[0] {
  return {
    subjectCore: {} as unknown as ConstructorParameters<typeof RelationshipTransitionExecutor>[0]["subjectCore"],
    issuer: {} as unknown as ConstructorParameters<typeof RelationshipTransitionExecutor>[0]["issuer"],
    memoryRepository: {} as unknown as ConstructorParameters<typeof RelationshipTransitionExecutor>[0]["memoryRepository"]
  };
}

function runtimeCtxStub(): Parameters<RelationshipTransitionExecutor["execute"]>[0] {
  return {
    subject_id: "subject-s0",
    current_logical_time: 1
  } as unknown as Parameters<RelationshipTransitionExecutor["execute"]>[0];
}

// ---- §20 namespace classification ---------------------------------------------------

describe("Relationship Reserved Namespace and Generic Writer Hardening V0", () => {
  describe("§20 exact prefix classification", () => {
    it("classifies relationship_core_* identifiers as reserved", () => {
      expect(RELATIONSHIP_GOVERNED_DIMENSION_RESERVED_PREFIX_V0).toBe("relationship_core_");
      expect(isReservedRelationshipCoreDimensionIdV0("relationship_core_x")).toBe(true);
      expect(
        isReservedRelationshipCoreDimensionIdV0("relationship_core_relational_bond_strength_v0")
      ).toBe(true);
    });

    it("does not classify lookalikes or ordinary opaque identifiers as reserved", () => {
      for (const id of [
        "relationship",
        "relationship_core",
        "relationship-core_x",
        "x_relationship_core_y",
        "test_trust_like",
        "relationship_test_dimension_v0",
        "arbitrary_host_dimension"
      ]) {
        expect(isReservedRelationshipCoreDimensionIdV0(id)).toBe(false);
      }
    });
  });

  // ---- §21 generic initialization denial ------------------------------------------

  describe("§21 generic initialization guard", () => {
    it("fails closed when generic initialization seeds a reserved dimension", () => {
      expect(() =>
        initializeRelationshipState([
          {
            counterpart_ref: counterpartRef(ALICE),
            dimensions: [{ dimension_id: asId(RESERVED_ID), value: asUnit(0.83) }]
          } as never
        ])
      ).toThrow(/RESERVED_DIMENSION_FORBIDDEN/);
    });

    it("preserves existing generic behavior for ordinary opaque dimensions", () => {
      const state = initializeRelationshipState([
        {
          counterpart_ref: counterpartRef(ALICE),
          dimensions: [{ dimension_id: asId(OPAQUE_ID), value: asUnit(0.5) }]
        } as never
      ]);
      expect(state.counterparts).toHaveLength(1);
      expect(state.counterparts[0]?.dimensions.map((d) => d.dimension_id)).toStrictEqual([OPAQUE_ID]);
    });
  });

  // ---- §22 counterpart registration denial ----------------------------------------

  describe("§22 counterpart initial-dimensions guard", () => {
    it("rejects a reserved initial dimension at the proposal validation choke point", () => {
      const checked = validateRelationshipCounterpartRegistrationProposal(
        registrationProposalFixture(RESERVED_ID)
      );
      expect(checked.ok).toBe(false);
      if (!checked.ok) {
        expect(checked.error.detail).toMatch(/reserved relationship_core_\* dimension forbidden/);
      }
    });

    it("keeps ordinary opaque initial dimensions admissible under existing rules", () => {
      const checked = validateRelationshipCounterpartRegistrationProposal(
        registrationProposalFixture(OPAQUE_ID)
      );
      expect(checked.ok).toBe(true);
    });

    it("executor wiring cannot bypass validation: a reserved proposal is rejected before any dep use", () => {
      const executor = new RelationshipCounterpartRegistrationExecutor(executorDepsStub());
      return executor
        .execute(runtimeCtxStub(), registrationProposalFixture(RESERVED_ID))
        .then((result) => {
          expect(result.kind).toBe("REJECTED_INVALID_PROPOSAL");
        });
    });
  });

  // ---- §23 generic direct update denial -------------------------------------------

  describe("§23 generic direct update guard", () => {
    it("rejects a reserved target at the update-proposal validation choke point", () => {
      const checked = validateRelationshipUpdateProposal(updateProposalFixture(RESERVED_ID));
      expect(checked.ok).toBe(false);
      if (!checked.ok) {
        expect(checked.error.detail).toMatch(/reserved relationship_core_\* dimension forbidden/);
      }
    });

    it("preserves existing generic update validation for ordinary opaque dimensions", () => {
      const checked = validateRelationshipUpdateProposal(updateProposalFixture(OPAQUE_ID));
      expect(checked.ok).toBe(true);
    });

    it("transition executor wiring cannot bypass validation: reserved proposal rejected before any dep use", () => {
      const executor = new RelationshipTransitionExecutor(executorDepsStub());
      return executor.execute(runtimeCtxStub(), updateProposalFixture(RESERVED_ID)).then((result) => {
        expect(result.kind).toBe("REJECTED_INVALID_PROPOSAL");
      });
    });
  });

  // ---- §24 evidence channel policy guard ------------------------------------------

  describe("§24 evidence channel policy guard", () => {
    it("rejects a generic channel policy binding a reserved target dimension", () => {
      const checked = validateRelationshipEvidenceChannelPolicy(
        channelPolicyFixture(RESERVED_ID)
      ) as { ok: boolean; error?: { detail: string } };
      expect(checked.ok).toBe(false);
      if (!checked.ok) {
        expect(checked.error?.detail).toMatch(
          /reserved relationship_core_\* dimension forbidden in generic channel policies/
        );
      }
    });

    it("keeps ordinary opaque targets routable under existing rules", () => {
      const checked = validateRelationshipEvidenceChannelPolicy(
        channelPolicyFixture(OPAQUE_ID)
      ) as { ok: boolean; value?: RelationshipEvidenceChannelPolicyV0 };
      expect(checked.ok).toBe(true);
      if (checked.ok) {
        expect(checked.value?.channels[0]?.target_dimension_id).toBe(OPAQUE_ID);
      }
    });
  });

  // ---- §27/§28 registry + frozen V0 admission boundary ------------------------------

  describe("§27/§28 registry and frozen V0 admission boundary", () => {
    it("feature-semantics registry remains zero-entry: no relationship_core_* feature resolves", () => {
      expect(Object.isFrozen(REGISTERED_RELATIONSHIP_DECISION_FEATURE_IDS_V0)).toBe(true);
      expect(REGISTERED_RELATIONSHIP_DECISION_FEATURE_IDS_V0).toHaveLength(0);
    });

    it("frozen denial-only V0 admission stays NOT_DECISION_ADMISSIBLE for a reserved-prefix id", () => {
      expect(queryRelationshipFeatureDecisionAdmissionV0(RESERVED_ID)).toStrictEqual({
        decision_admission: "NOT_DECISION_ADMISSIBLE",
        reason: "UNREGISTERED_FEATURE"
      });
    });
  });

  // ---- §29 no numeric / decision side effects ---------------------------------------

  describe("§29 closed namespace-authority surface", () => {
    it("exposes exactly the reserved-prefix constant and the pure classifier — nothing else", () => {
      expect(Object.keys(namespaceModule).sort()).toStrictEqual([
        "RELATIONSHIP_GOVERNED_DIMENSION_RESERVED_PREFIX_V0",
        "isReservedRelationshipCoreDimensionIdV0"
      ]);
      const forbiddenPattern = /(tendency|scale|admission|mapping|weight|score|provider|model|register)/i;
      expect(
        Object.keys(namespaceModule).filter((name) => forbiddenPattern.test(name))
      ).toStrictEqual([]);
    });
  });
});
