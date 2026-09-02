/**
 * Historical Writer Authority Registry — CharacterOS-owned static registry
 * FOUNDATION
 * (ATOMIC_COMMIT_BUNDLE_V2_AUTHORITY_SCHEMA_FOUNDATION, LEVEL_2).
 *
 * This is a source-controlled, static, append-only-by-version architecture:
 *   - NO register() / add() / set() / delete()
 *   - NO mutable Map exposure, no plugin registration, no host validator
 *     callbacks (HOST_DYNAMIC_WRITER_AUTHORITY_REGISTRATION = NO)
 *   - deeply frozen exported surfaces
 *
 * AUTHORITY DISTINCTIONS (frozen):
 *   schema recognized  != gate authorized
 *                      != write policy authorized
 *                      != canonical governed write capability
 *
 * The registry currently recognizes exactly ONE writer SCHEMA contract — the
 * Relationship governed feature writer-authority PAYLOAD SCHEMA itself. That
 * descriptor is NOT a first Relationship feature, NOT a write policy, NOT a
 * feature-semantics registration, and NOT a governed writer capability. The
 * gate and write-policy registries contain ZERO production entries, so no
 * production governed Relationship write can be authorized through this
 * registry. (PRODUCTION_GOVERNED_RELATIONSHIP_WRITER_AUTHORITY = NONE,
 * GOVERNED_RELATIONSHIP_WRITE_POLICY_COUNT = 0.)
 */

import type { HashV1 } from "@characteros-next/subject-core";
import { hashEnvelope } from "@characteros-next/subject-core";
import type { CanonicalWriterClassV0, CanonicalWriterFamilyV0 } from "@characteros-next/subject-core";

// ---- recognized schema contract shape ----------------------------------------------

/** One CharacterOS-recognized writer PAYLOAD SCHEMA contract. */
export interface RecognizedWriterSchemaContractV0 {
  readonly writer_family: CanonicalWriterFamilyV0;
  readonly writer_schema_id: string;
  readonly writer_schema_fingerprint: HashV1;
  readonly allowed_writer_classes: readonly CanonicalWriterClassV0[];
}

// ---- Relationship governed writer PAYLOAD SCHEMA descriptor (§17) -------------------

export const RELATIONSHIP_GOVERNED_WRITER_SCHEMA_ID_V0 =
  "relationship-governed-feature-writer-authority-payload-v0" as const;

export const RELATIONSHIP_GOVERNED_WRITER_SCHEMA_PROJECTION =
  "characteros-next/runtime/relationship-governed-writer-schema/v1" as const;

/**
 * CharacterOS-owned descriptor of the Relationship governed writer
 * authority PAYLOAD SCHEMA contract. Deterministic, source-controlled; it is
 * NOT a concrete feature, policy, semantics registration, or capability.
 */
export interface RelationshipGovernedWriterSchemaDescriptorV0 {
  readonly schema_id: typeof RELATIONSHIP_GOVERNED_WRITER_SCHEMA_ID_V0;
  readonly payload_schema_version: "relationship-governed-feature-writer-authority-payload-v0";
  readonly writer_family: "RELATIONSHIP_GOVERNED_FEATURE";
  readonly relationship_state_schema_version: "relationship-state-v0";
  readonly reserved_dimension_prefix: "relationship_core_";
  readonly payload_field_count: 17;
  readonly durable_authority_level: "LEVEL_2";
}

export const RELATIONSHIP_GOVERNED_WRITER_SCHEMA_DESCRIPTOR_V0: RelationshipGovernedWriterSchemaDescriptorV0 =
  {
    schema_id: RELATIONSHIP_GOVERNED_WRITER_SCHEMA_ID_V0,
    payload_schema_version: "relationship-governed-feature-writer-authority-payload-v0",
    writer_family: "RELATIONSHIP_GOVERNED_FEATURE",
    relationship_state_schema_version: "relationship-state-v0",
    reserved_dimension_prefix: "relationship_core_",
    payload_field_count: 17,
    durable_authority_level: "LEVEL_2"
  };
Object.freeze(RELATIONSHIP_GOVERNED_WRITER_SCHEMA_DESCRIPTOR_V0);

/** Deterministic descriptor fingerprint (no wall clock / randomness / env). */
export async function deriveRelationshipGovernedWriterSchemaFingerprintV0(): Promise<HashV1> {
  return hashEnvelope(
    RELATIONSHIP_GOVERNED_WRITER_SCHEMA_PROJECTION,
    RELATIONSHIP_GOVERNED_WRITER_SCHEMA_DESCRIPTOR_V0
  );
}

// ---- static registry (built once lazily; never exposed mutably) --------------------

interface RegistryEntryV0 {
  readonly contract: RecognizedWriterSchemaContractV0;
}

let registryCache: ReadonlyMap<string, RegistryEntryV0> | null = null;

async function getRegistry(): Promise<ReadonlyMap<string, RegistryEntryV0>> {
  if (registryCache === null) {
    const fingerprint = await deriveRelationshipGovernedWriterSchemaFingerprintV0();
    const map = new Map<string, RegistryEntryV0>();
    map.set(RELATIONSHIP_GOVERNED_WRITER_SCHEMA_ID_V0, {
      contract: {
        writer_family: "RELATIONSHIP_GOVERNED_FEATURE",
        writer_schema_id: RELATIONSHIP_GOVERNED_WRITER_SCHEMA_ID_V0,
        writer_schema_fingerprint: fingerprint,
        allowed_writer_classes: ["INITIALIZE", "UPDATE", "REINITIALIZE"]
      }
    });
    registryCache = map;
  }
  return registryCache;
}

/** Frozen informational view of recognized writer SCHEMA contract ids. */
export const RECOGNIZED_WRITER_SCHEMA_CONTRACT_IDS_V0: readonly string[] = Object.freeze([
  RELATIONSHIP_GOVERNED_WRITER_SCHEMA_ID_V0
]);

/**
 * Safe read-only getter for the recognized writer SCHEMA contracts (built
 * once with the real deterministic fingerprints). Schema recognition confers
 * no gate/policy/write authorization.
 */
export async function getRecognizedWriterSchemaContractsV0(): Promise<
  readonly RecognizedWriterSchemaContractV0[]
> {
  const registry = await getRegistry();
  return [...registry.values()].map((entry) => entry.contract);
}

/**
 * Pure lookup: recognizes a writer schema contract by EXACT schema id +
 * family + schema fingerprint. Unknown / mismatching → null (fail closed).
 * This is schema recognition only — NOT gate authorization, NOT policy
 * authorization, NOT a write capability.
 */
export async function resolveRecognizedWriterSchemaContractV0(input: {
  readonly writer_family: CanonicalWriterFamilyV0;
  readonly writer_schema_id: string;
  readonly writer_schema_fingerprint: string;
}): Promise<RecognizedWriterSchemaContractV0 | null> {
  const registry = await getRegistry();
  const entry = registry.get(input.writer_schema_id);
  if (entry === undefined) return null;
  if (entry.contract.writer_family !== input.writer_family) return null;
  if (entry.contract.writer_schema_fingerprint !== input.writer_schema_fingerprint) return null;
  return entry.contract;
}

// ---- gate / policy registries: ZERO production entries -----------------------------

/**
 * Authorization-gate registry. V0 contains ZERO production entries: no gate
 * capable of authorizing a Relationship governed feature write exists yet.
 */
export const REGISTERED_AUTHORIZATION_GATE_IDS_V0: readonly string[] = Object.freeze([]);

/**
 * Governed Relationship write-policy registry. V0 contains ZERO entries: no
 * concrete first-feature write policy exists yet.
 * (GOVERNED_RELATIONSHIP_WRITE_POLICY_COUNT = 0.)
 */
export const REGISTERED_GOVERNED_RELATIONSHIP_WRITE_POLICY_IDS_V0: readonly string[] =
  Object.freeze([]);

/** Frozen role literals for downstream claims/tests. */
export const HOST_DYNAMIC_WRITER_AUTHORITY_REGISTRATION_V0 = "NO" as const;
export const PRODUCTION_GOVERNED_RELATIONSHIP_WRITER_AUTHORITY_V0 = "NONE" as const;
export const GOVERNED_RELATIONSHIP_WRITE_POLICY_COUNT_V0 = 0 as const;
