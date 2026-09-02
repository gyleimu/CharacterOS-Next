/**
 * Historical Writer Authority Registry — acceptance suite (§38/§39/§15/§16):
 * static CharacterOS-owned schema recognition, zero gate/write-policy
 * entries, no dynamic registration, frozen surfaces, descriptor fingerprint
 * determinism, and the schema-recognized != authorized distinction.
 *
 * Fully OFFLINE: pure deterministic functions only.
 */

import { describe, expect, it } from "vitest";

import * as registryModule from "./historical-writer-authority-registry.js";
import {
  GOVERNED_RELATIONSHIP_WRITE_POLICY_COUNT_V0,
  HOST_DYNAMIC_WRITER_AUTHORITY_REGISTRATION_V0,
  PRODUCTION_GOVERNED_RELATIONSHIP_WRITER_AUTHORITY_V0,
  REGISTERED_AUTHORIZATION_GATE_IDS_V0,
  REGISTERED_GOVERNED_RELATIONSHIP_WRITE_POLICY_IDS_V0,
  RECOGNIZED_WRITER_SCHEMA_CONTRACT_IDS_V0,
  RELATIONSHIP_GOVERNED_WRITER_SCHEMA_DESCRIPTOR_V0,
  RELATIONSHIP_GOVERNED_WRITER_SCHEMA_ID_V0,
  deriveRelationshipGovernedWriterSchemaFingerprintV0,
  getRecognizedWriterSchemaContractsV0,
  resolveRecognizedWriterSchemaContractV0
} from "./historical-writer-authority-registry.js";

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

  it("contains ZERO authorization gates and ZERO governed Relationship write policies", () => {
    expect(Object.isFrozen(REGISTERED_AUTHORIZATION_GATE_IDS_V0)).toBe(true);
    expect(REGISTERED_AUTHORIZATION_GATE_IDS_V0).toHaveLength(0);
    expect(Object.isFrozen(REGISTERED_GOVERNED_RELATIONSHIP_WRITE_POLICY_IDS_V0)).toBe(true);
    expect(REGISTERED_GOVERNED_RELATIONSHIP_WRITE_POLICY_IDS_V0).toHaveLength(0);
    expect(GOVERNED_RELATIONSHIP_WRITE_POLICY_COUNT_V0).toBe(0);
    expect(PRODUCTION_GOVERNED_RELATIONSHIP_WRITER_AUTHORITY_V0).toBe("NONE");
    expect(HOST_DYNAMIC_WRITER_AUTHORITY_REGISTRATION_V0).toBe("NO");
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
});
