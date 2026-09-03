/**
 * Historical Writer Authority Registry — acceptance suite (§38/§39/§15/§16 +
 * RELATIONSHIP_GOVERNED_FEATURE_WRITER_AUTHORITY_V0 §5/§6/§33/§34/§47/§54):
 * static CharacterOS-owned schema recognition, exactly ONE authorization gate
 * and ONE governed write policy, zero admitted features, no dynamic
 * registration, frozen surfaces, descriptor fingerprint determinism, the
 * schema-recognized != authorized distinction, and the §34 direct regression
 * proving the historical resolver binds each identity to its EXACT registry
 * family (the pre-repair placeholder compared the write-policy registry
 * against the WRONG identity family — demonstrated failing before repair).
 *
 * Fully OFFLINE: pure deterministic functions only.
 */

import { describe, expect, it } from "vitest";

import type { CanonicalWriterAuthorityRecordV0 } from "@characteros-next/subject-core";

import * as registryModule from "./historical-writer-authority-registry.js";
import {
  GOVERNED_RELATIONSHIP_WRITE_POLICY_COUNT_V0,
  HOST_DYNAMIC_WRITER_AUTHORITY_REGISTRATION_V0,
  PRODUCTION_GOVERNED_RELATIONSHIP_WRITER_AUTHORITY_V0,
  REGISTERED_AUTHORIZATION_GATE_IDS_V0,
  REGISTERED_GOVERNED_RELATIONSHIP_WRITE_POLICY_IDS_V0,
  RECOGNIZED_WRITER_SCHEMA_CONTRACT_IDS_V0,
  RELATIONSHIP_GOVERNED_FEATURE_AUTHORIZATION_GATE_DESCRIPTOR_V0,
  RELATIONSHIP_GOVERNED_FEATURE_AUTHORIZATION_GATE_ID_V0,
  RELATIONSHIP_GOVERNED_FEATURE_WRITE_POLICY_DESCRIPTOR_V0,
  RELATIONSHIP_GOVERNED_FEATURE_WRITE_POLICY_ID_V0,
  RELATIONSHIP_GOVERNED_WRITER_SCHEMA_DESCRIPTOR_V0,
  RELATIONSHIP_GOVERNED_WRITER_SCHEMA_ID_V0,
  classifyHistoricalWriterAuthorityStatusV0,
  deriveRelationshipGovernedFeatureAuthorizationGateFingerprintV0,
  deriveRelationshipGovernedFeatureWritePolicyFingerprintV0,
  deriveRelationshipGovernedWriterSchemaFingerprintV0,
  getRecognizedWriterSchemaContractsV0,
  getRegisteredAuthorizationGatesV0,
  getRegisteredGovernedWritePoliciesV0,
  resolveAuthorizationGateV0,
  resolveGovernedWritePolicyV0,
  resolveRecognizedWriterSchemaContractV0
} from "./historical-writer-authority-registry.js";

const WRONG_HASH = "sha256:2222222222222222222222222222222222222222222222222222222222222222";

/** Structural (NOT admitted anywhere) RELATIONSHIP_GOVERNED_FEATURE authority fixture. */
async function governedAuthorityRecordFixture(input: {
  readonly write_policy_id: string;
  readonly write_policy_fingerprint: string;
  readonly gate_fingerprint?: string;
}): Promise<CanonicalWriterAuthorityRecordV0> {
  const record = {
    schema_version: "canonical-writer-authority-record-v0",
    proposal_ref: "proposal:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    payload_fingerprint: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    writer_family: "RELATIONSHIP_GOVERNED_FEATURE",
    writer_class: "INITIALIZE",
    writer_schema_id: RELATIONSHIP_GOVERNED_WRITER_SCHEMA_ID_V0,
    writer_schema_fingerprint: await deriveRelationshipGovernedWriterSchemaFingerprintV0(),
    authorization_gate_id: RELATIONSHIP_GOVERNED_FEATURE_AUTHORIZATION_GATE_ID_V0,
    authorization_gate_fingerprint: input.gate_fingerprint ?? (await deriveRelationshipGovernedFeatureAuthorizationGateFingerprintV0()),
    authority_payload: {
      schema_version: "relationship-governed-feature-writer-authority-payload-v0",
      operation_kind: "INITIALIZE",
      subject_id: "subject-s0",
      expected_revision: 0,
      counterpart_ref: "entity:alice-like",
      dimension_id: "relationship_core_fixture_dimension_v0",
      previous: { kind: "ABSENT" },
      next: { kind: "PRESENT", value: 0.5 },
      relationship_state_schema_version: "relationship-state-v0",
      feature_semantics_contract_id: "unadmitted-feature-semantics-v0",
      feature_semantics_contract_fingerprint: WRONG_HASH,
      write_policy_id: input.write_policy_id,
      write_policy_fingerprint: input.write_policy_fingerprint,
      evidence_receipt_refs: ["episode:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"],
      write_policy_receipt_ref: "workflow:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
      authority_epoch_start_transition_id: "t-epoch-1",
      previous_governed_authority: { kind: "NONE" }
    }
  } as unknown as CanonicalWriterAuthorityRecordV0;
  return record;
}

describe("Historical writer authority registry foundation", () => {
  it("recognizes exactly one writer schema contract: the Relationship governed payload schema", async () => {
    expect(Object.isFrozen(RECOGNIZED_WRITER_SCHEMA_CONTRACT_IDS_V0)).toBe(true);
    expect([...RECOGNIZED_WRITER_SCHEMA_CONTRACT_IDS_V0]).toStrictEqual([
      RELATIONSHIP_GOVERNED_WRITER_SCHEMA_ID_V0
    ]);
    const contracts = await getRecognizedWriterSchemaContractsV0();
    expect(contracts).toHaveLength(1);
    expect(contracts[0]?.writer_family).toBe("RELATIONSHIP_GOVERNED_FEATURE");
    expect(contracts[0]?.allowed_writer_classes).toStrictEqual([
      "INITIALIZE",
      "UPDATE",
      "REINITIALIZE"
    ]);
  });

  it("derives the descriptor fingerprint deterministically and resolves it exactly", async () => {
    const first = await deriveRelationshipGovernedWriterSchemaFingerprintV0();
    const second = await deriveRelationshipGovernedWriterSchemaFingerprintV0();
    expect(first).toBe(second);
    expect(first).toMatch(/^sha256:[0-9a-f]{64}$/);

    const resolved = await resolveRecognizedWriterSchemaContractV0({
      writer_family: "RELATIONSHIP_GOVERNED_FEATURE",
      writer_schema_id: RELATIONSHIP_GOVERNED_WRITER_SCHEMA_ID_V0,
      writer_schema_fingerprint: first
    });
    expect(resolved).not.toBeNull();
    expect(resolved?.writer_schema_id).toBe(RELATIONSHIP_GOVERNED_WRITER_SCHEMA_ID_V0);
  });

  it("fails closed on unknown schema ids, wrong families and fingerprint mismatches", async () => {
    const fingerprint = await deriveRelationshipGovernedWriterSchemaFingerprintV0();
    expect(
      await resolveRecognizedWriterSchemaContractV0({
        writer_family: "RELATIONSHIP_GOVERNED_FEATURE",
        writer_schema_id: "unknown-writer-schema-v0",
        writer_schema_fingerprint: fingerprint
      })
    ).toBeNull();
    expect(
      await resolveRecognizedWriterSchemaContractV0({
        writer_family: "RELATIONSHIP_GOVERNED_FEATURE",
        writer_schema_id: RELATIONSHIP_GOVERNED_WRITER_SCHEMA_ID_V0,
        writer_schema_fingerprint:
          "sha256:2222222222222222222222222222222222222222222222222222222222222222"
      })
    ).toBeNull();
  });

  it("registers exactly ONE authorization gate and ONE governed write policy (feature count stays ZERO)", async () => {
    expect(Object.isFrozen(REGISTERED_AUTHORIZATION_GATE_IDS_V0)).toBe(true);
    expect([...REGISTERED_AUTHORIZATION_GATE_IDS_V0]).toStrictEqual([
      RELATIONSHIP_GOVERNED_FEATURE_AUTHORIZATION_GATE_ID_V0
    ]);
    expect(Object.isFrozen(REGISTERED_GOVERNED_RELATIONSHIP_WRITE_POLICY_IDS_V0)).toBe(true);
    expect([...REGISTERED_GOVERNED_RELATIONSHIP_WRITE_POLICY_IDS_V0]).toStrictEqual([
      RELATIONSHIP_GOVERNED_FEATURE_WRITE_POLICY_ID_V0
    ]);
    expect(GOVERNED_RELATIONSHIP_WRITE_POLICY_COUNT_V0).toBe(1);
    const gates = await getRegisteredAuthorizationGatesV0();
    expect(gates).toHaveLength(1);
    const policies = await getRegisteredGovernedWritePoliciesV0();
    expect(policies).toHaveLength(1);
    expect(PRODUCTION_GOVERNED_RELATIONSHIP_WRITER_AUTHORITY_V0).toBe("NONE");
    expect(HOST_DYNAMIC_WRITER_AUTHORITY_REGISTRATION_V0).toBe("NO");
    expect(RELATIONSHIP_GOVERNED_FEATURE_WRITE_POLICY_DESCRIPTOR_V0.feature_admission_requirement).toBe(
      "POSITIVE_EXACT_REGISTERED_BINDING_REQUIRED"
    );
  });

  it("exposes no dynamic registration, no mutable Map and no authority issuer", () => {
    const surface = Object.keys(registryModule).sort();
    expect(surface).not.toContain("registerWriterAuthority");
    expect(surface).not.toContain("register");
    expect(surface).not.toContain("mintGovernedAuthority");
    expect(surface).not.toContain("authorizeWriter");
    const mutableSurface = surface.filter((name) => /^(add|set|delete)[A-Z]|^register(?!ed_)/.test(name));
    expect(mutableSurface).toStrictEqual([]);
  });

  it("keeps the schema descriptor deeply frozen and non-feature-shaped", () => {
    expect(Object.isFrozen(RELATIONSHIP_GOVERNED_WRITER_SCHEMA_DESCRIPTOR_V0)).toBe(true);
    expect(RELATIONSHIP_GOVERNED_WRITER_SCHEMA_DESCRIPTOR_V0.payload_field_count).toBe(17);
    expect(RELATIONSHIP_GOVERNED_WRITER_SCHEMA_DESCRIPTOR_V0.reserved_dimension_prefix).toBe(
      "relationship_core_"
    );
    const descriptorText = JSON.stringify(RELATIONSHIP_GOVERNED_WRITER_SCHEMA_DESCRIPTOR_V0);
    expect(descriptorText.includes("trust")).toBe(false);
    expect(descriptorText.includes("closeness")).toBe(false);
    expect(descriptorText.includes("relational_bond")).toBe(false);
  });

  it("keeps the gate and policy descriptors deeply frozen, deterministic and closed", async () => {
    expect(Object.isFrozen(RELATIONSHIP_GOVERNED_FEATURE_AUTHORIZATION_GATE_DESCRIPTOR_V0)).toBe(true);
    expect(Object.isFrozen(RELATIONSHIP_GOVERNED_FEATURE_WRITE_POLICY_DESCRIPTOR_V0)).toBe(true);
    const gateFp = await deriveRelationshipGovernedFeatureAuthorizationGateFingerprintV0();
    const gateFpAgain = await deriveRelationshipGovernedFeatureAuthorizationGateFingerprintV0();
    expect(gateFp).toBe(gateFpAgain);
    expect(gateFp).toMatch(/^sha256:[0-9a-f]{64}$/);
    const policyFp = await deriveRelationshipGovernedFeatureWritePolicyFingerprintV0();
    expect(policyFp).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(policyFp).not.toBe(gateFp);
    expect((await resolveAuthorizationGateV0({
      authorization_gate_id: RELATIONSHIP_GOVERNED_FEATURE_AUTHORIZATION_GATE_ID_V0,
      authorization_gate_fingerprint: gateFp
    })).layer).toBe("RESOLVED");
    expect((await resolveGovernedWritePolicyV0({
      write_policy_id: RELATIONSHIP_GOVERNED_FEATURE_WRITE_POLICY_ID_V0,
      write_policy_fingerprint: policyFp
    })).layer).toBe("RESOLVED");
  });
});

// ---- §34/§54 historical resolver identity-binding regression --------------------------

describe("Historical authority resolver identity binding (§34/§54)", () => {
  it("§34 DEMONSTRATION: the pre-repair placeholder fails the exact policy-identity binding", async () => {
    const policyFp = await deriveRelationshipGovernedFeatureWritePolicyFingerprintV0();
    const registered = await governedAuthorityRecordFixture({
      write_policy_id: RELATIONSHIP_GOVERNED_FEATURE_WRITE_POLICY_ID_V0,
      write_policy_fingerprint: policyFp
    });
    const unregistered = await governedAuthorityRecordFixture({
      write_policy_id: "unregistered-write-policy-v0",
      write_policy_fingerprint: policyFp
    });
    const a = await classifyHistoricalWriterAuthorityStatusV0(registered);
    const b = await classifyHistoricalWriterAuthorityStatusV0(unregistered);
    // The write-policy identity family MUST be consulted: a payload naming the
    // REGISTERED policy resolves the policy layer; a payload naming an
    // unregistered policy does NOT. The pre-repair placeholder compared the
    // policy registry against writer_schema_id (wrong identity family), so it
    // reported policy_layer "UNKNOWN" for BOTH records — demonstrated here by
    // this exact assertion before the resolver repair was applied.
    expect(a.policy_layer).toBe("RESOLVED");
    expect(b.policy_layer).toBe("UNKNOWN");
    // With the feature registry at ZERO entries, the unadmitted-feature layer
    // keeps a fully-registered record non-authoritative: NOT RESOLVED_VALID.
    expect(a.feature_layer).toBe("UNADMITTED");
    expect(a.status).not.toBe("RESOLVED_VALID");
  });

  it("binds each identity family to its EXACT registry (no cross-family resolution)", async () => {
    const gateFp = await deriveRelationshipGovernedFeatureAuthorizationGateFingerprintV0();
    const policyFp = await deriveRelationshipGovernedFeatureWritePolicyFingerprintV0();

    // schema id checked against the schema registry only: a record whose
    // writer_schema_id names the POLICY id never resolves at the schema layer.
    const schemaCrossFamily = await classifyHistoricalWriterAuthorityStatusV0({
      ...(await governedAuthorityRecordFixture({
        write_policy_id: RELATIONSHIP_GOVERNED_FEATURE_WRITE_POLICY_ID_V0,
        write_policy_fingerprint: policyFp
      })),
      writer_schema_id: RELATIONSHIP_GOVERNED_FEATURE_WRITE_POLICY_ID_V0,
      writer_schema_fingerprint: policyFp
    } as unknown as CanonicalWriterAuthorityRecordV0);
    expect(schemaCrossFamily.schema_layer).toBe("UNKNOWN");
    expect(schemaCrossFamily.gate_layer).toBe("PENDING");

    // gate id checked against the gate registry only: a gate id equal to the
    // schema id is gate-UNKNOWN.
    const gateCrossFamily = await governedAuthorityRecordFixture({
      write_policy_id: RELATIONSHIP_GOVERNED_FEATURE_WRITE_POLICY_ID_V0,
      write_policy_fingerprint: policyFp
    });
    const gateCross = await classifyHistoricalWriterAuthorityStatusV0({
      ...gateCrossFamily,
      authorization_gate_id: RELATIONSHIP_GOVERNED_WRITER_SCHEMA_ID_V0,
      authorization_gate_fingerprint: gateFp
    } as unknown as CanonicalWriterAuthorityRecordV0);
    expect(gateCross.gate_layer).toBe("UNKNOWN");
    expect(gateCross.status).toBe("UNRESOLVED");

    // gate FINGERPRINT injection: known gate id, wrong fingerprint → INVALID.
    const gateTampered = await governedAuthorityRecordFixture({
      write_policy_id: RELATIONSHIP_GOVERNED_FEATURE_WRITE_POLICY_ID_V0,
      write_policy_fingerprint: policyFp,
      gate_fingerprint: WRONG_HASH
    });
    const gateTamperedResult = await classifyHistoricalWriterAuthorityStatusV0(gateTampered);
    expect(gateTamperedResult.gate_layer).toBe("INVALID");
    expect(gateTamperedResult.status).toBe("RESOLVED_INVALID");

    // policy FINGERPRINT injection: registered policy id, wrong fingerprint → INVALID.
    const policyTampered = await governedAuthorityRecordFixture({
      write_policy_id: RELATIONSHIP_GOVERNED_FEATURE_WRITE_POLICY_ID_V0,
      write_policy_fingerprint: WRONG_HASH
    });
    const policyTamperedResult = await classifyHistoricalWriterAuthorityStatusV0(policyTampered);
    expect(policyTamperedResult.policy_layer).toBe("INVALID");
    expect(policyTamperedResult.status).toBe("RESOLVED_INVALID");

    // unadmitted feature semantics NEVER resolve to RESOLVED_VALID.
    const fullyRegistered = await classifyHistoricalWriterAuthorityStatusV0(
      await governedAuthorityRecordFixture({
        write_policy_id: RELATIONSHIP_GOVERNED_FEATURE_WRITE_POLICY_ID_V0,
        write_policy_fingerprint: policyFp
      })
    );
    expect(fullyRegistered.schema_layer).toBe("RESOLVED");
    expect(fullyRegistered.gate_layer).toBe("RESOLVED");
    expect(fullyRegistered.policy_layer).toBe("RESOLVED");
    expect(fullyRegistered.feature_layer).toBe("UNADMITTED");
    expect(fullyRegistered.status).toBe("UNRESOLVED");
  });
});
